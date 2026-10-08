// El enlace entre el teléfono (control) y la TV (issue #3). Dos fábricas sin estado global, para poder probarlas
// con una TV y un teléfono "de mentira" en el mismo proceso (como app/call-session.js de myPata): reciben Firestore,
// el código de la sala, quién eres y el entorno (RTCPeerConnection, servidores ICE).
//
// Canal: un RTCDataChannel de WebRTC directo del teléfono a la TV (decenas de ms, sin servidor de por medio). Solo
// el teléfono ofrece y la TV solo responde (como en las llamadas de myPata: así nunca chocan dos ofertas); la
// señalización va por Firestore (services/salas.js). Mientras el canal no está abierto (o si no abre nunca, por
// ejemplo con CGNAT), las acciones van como documentos en Firestore: unos 100–300 ms, suficiente para juegos por
// turnos. La TV escucha las dos vías siempre, así que el cambio de una a otra no se nota.
//
// Para que corra en los navegadores de las TVs (Chromium viejo), aquí no se usa ?. ni ?? y las descripciones se
// crean con createOffer/createAnswer (setLocalDescription() sin argumentos es de Chromium 80 en adelante).
import { ACCIONES } from "../../kit/protocolo.js";
import { salaVigente, controlVivo, LATIDO_TV_MS, LATIDO_CONTROL_MS, ESPERA_WEBRTC_MS } from "../engine/index.js";
import { renovarSala, cerrarSala, unirseSala, verSala, mandarSenal, verSenales, mandarAccion, verAcciones, nuevoId } from "../services/index.js";

export const STUN = [{ urls: "stun:stun.l.google.com:19302" }];
const CANAL = "noli";

const plano = (d) => (d ? { type: d.type, sdp: d.sdp } : d); // Firestore no guarda clases
const candidatoPlano = (c) => (c && c.toJSON ? c.toJSON() : c);
const abierto = (dc) => !!dc && dc.readyState === "open";
const intervalo = (fn, ms) => { const t = setInterval(fn, ms); if (t && t.unref) t.unref(); return t; };
const despues = (fn, ms) => { const t = setTimeout(fn, ms); if (t && t.unref) t.unref(); return t; };

// Las señales se atienden una por una, en orden: una conexión no aguanta dos cambios a la vez
function cola(fn) {
  let q = Promise.resolve();
  return (m) => { q = q.then(() => fn(m)).catch((e) => console.warn("control remoto: señal", e)); };
}

// ---------------------------------------------------------------------------------------------------------------
// La TV: escucha la sala, contesta las ofertas del teléfono y entrega las acciones que llegan por cualquier vía.
// opts: { fs, codigo, sesion, env: { RTCPeerConnection, iceServers }, alAccion(accion, via), alCambiar() }
// ---------------------------------------------------------------------------------------------------------------
export function crearTv({ fs, codigo, sesion, env = {}, alAccion, alCambiar = () => {}, latidoMs = LATIDO_TV_MS, ahora = Date.now }) {
  const s = { sala: null, perdida: false }; // perdida: la sala ya no es de esta TV (se venció y otra la tomó)
  let con = null; // { pc, de, sid, dc, pendientes }
  const huerfanos = new Map(); // candidatos ICE que llegaron antes que su oferta, por sid
  const quitar = [];
  let cerrada = false;

  const recibir = (accion, via) => { if (!cerrada && ACCIONES.indexOf(accion) >= 0) alAccion(accion, via); };

  function abrir(de, sid) {
    const pc = new env.RTCPeerConnection({ iceServers: env.iceServers || STUN });
    const c = { pc, de, sid, dc: null, pendientes: huerfanos.get(sid) || [] };
    huerfanos.delete(sid);
    pc.onicecandidate = (e) => {
      if (e.candidate) mandarSenal(fs, codigo, { de: "tv", deSid: sesion, para: de, paraSid: sid, tipo: "ice", candidato: candidatoPlano(e.candidate) }).catch(() => {});
    };
    pc.ondatachannel = (e) => {
      const dc = e.channel;
      c.dc = dc;
      dc.onopen = () => alCambiar();
      dc.onclose = () => alCambiar();
      dc.onmessage = (ev) => {
        let m = null;
        try { m = JSON.parse(ev.data); } catch (x) { return; }
        if (m && con === c) recibir(m.accion, "webrtc");
      };
      alCambiar();
    };
    pc.onconnectionstatechange = () => alCambiar();
    return c;
  }
  function soltar() {
    if (!con) return;
    try { con.pc.close(); } catch (x) {}
    con = null;
  }

  const alSenal = cola(async (m) => {
    if (cerrada || m.paraSid !== sesion) return; // para una vez anterior de esta TV
    if (m.tipo === "desc" && m.desc && m.desc.type === "offer") {
      // Un teléfono nuevo, o el mismo que volvió a conectarse (otro sid): la conexión anterior sobra
      if (con && con.sid !== m.deSid) soltar();
      if (!con) con = abrir(m.de, m.deSid);
      const c = con;
      await c.pc.setRemoteDescription(m.desc);
      for (const cand of c.pendientes.splice(0)) await c.pc.addIceCandidate(cand).catch(() => {});
      const resp = await c.pc.createAnswer();
      await c.pc.setLocalDescription(resp);
      await mandarSenal(fs, codigo, { de: "tv", deSid: sesion, para: c.de, paraSid: c.sid, tipo: "desc", desc: plano(c.pc.localDescription || resp) });
      alCambiar();
    } else if (m.tipo === "ice") {
      if (con && con.sid === m.deSid) {
        if (!con.pc.remoteDescription) con.pendientes.push(m.candidato);
        else await con.pc.addIceCandidate(m.candidato).catch(() => {});
      } else {
        if (!huerfanos.has(m.deSid)) huerfanos.set(m.deSid, []);
        huerfanos.get(m.deSid).push(m.candidato);
      }
    }
  });

  quitar.push(verSenales(fs, codigo, "tv", alSenal));
  quitar.push(verAcciones(fs, codigo, sesion, (m) => recibir(m.accion, "firestore")));
  quitar.push(verSala(fs, codigo, (sala) => {
    s.sala = sala;
    if (sala && sala.sesion !== sesion) s.perdida = true;
    alCambiar();
  }));
  const latido = intervalo(() => {
    renovarSala(fs, codigo, sesion, ahora())
      .then((ok) => { if (!ok) s.perdida = true; alCambiar(); })
      .catch(() => alCambiar());
  }, latidoMs);

  function estado() {
    const directo = !!con && abierto(con.dc);
    const vivo = !s.perdida && controlVivo(s.sala, ahora());
    return {
      conectado: !s.perdida && (directo || vivo),
      via: directo ? "webrtc" : vivo ? "firestore" : null,
      perdida: s.perdida,
    };
  }

  async function cerrar() {
    if (cerrada) return;
    cerrada = true;
    clearInterval(latido);
    for (const f of quitar) { try { f(); } catch (x) {} }
    soltar();
    await cerrarSala(fs, codigo, sesion).catch(() => {});
  }

  return { estado, cerrar, _con: () => con };
}

// ---------------------------------------------------------------------------------------------------------------
// El teléfono: se une a la sala, ofrece el canal y manda las acciones (por el canal si está abierto, si no por
// Firestore). Se vuelve a conectar solo: al regresar a la pantalla, al recuperar la red, si el canal se cae o si la
// TV recargó la página y abrió de nuevo la misma sala.
// opts: { fs, codigo, yo, env: { RTCPeerConnection, iceServers }, alCambiar() }
// estado().estado: "conectando" | "conectado" | "sin-tv" (la TV se apagó o cerró la sala) | "no-existe" (código
// equivocado) | "otro" (otro teléfono tomó el control) | "error"
// ---------------------------------------------------------------------------------------------------------------
export function crearControl({ fs, codigo, yo, env = {}, alCambiar = () => {}, esperaMs = ESPERA_WEBRTC_MS, latidoMs = LATIDO_CONTROL_MS, ahora = Date.now }) {
  const s = { estado: "conectando", sesionTv: null, respaldo: false, unido: false };
  let sid = null, pc = null, dc = null, pendientes = [];
  let quitarSala = null, quitarSenales = null, latido = null, espera = null, reintento = null;
  let conectando = null, cerrado = false;

  function cambiar(estado) { if (estado && s.estado !== estado) s.estado = estado; alCambiar(); }

  function soltarPc() {
    clearTimeout(espera); espera = null;
    if (dc) { dc.onopen = dc.onclose = null; try { dc.close(); } catch (x) {} }
    if (pc) { try { pc.close(); } catch (x) {} }
    dc = null; pc = null; pendientes = [];
  }

  const alSenal = cola(async (m) => {
    if (cerrado || !pc || m.paraSid !== sid) return; // de una conexión anterior
    if (m.tipo === "desc" && m.desc && m.desc.type === "answer") {
      if (pc.signalingState !== "have-local-offer") return;
      await pc.setRemoteDescription(m.desc);
      for (const cand of pendientes.splice(0)) await pc.addIceCandidate(cand).catch(() => {});
    } else if (m.tipo === "ice") {
      if (!pc.remoteDescription) pendientes.push(m.candidato);
      else await pc.addIceCandidate(m.candidato).catch(() => {});
    }
  });

  async function ofrecer() {
    soltarPc();
    if (!env.RTCPeerConnection) { s.respaldo = true; return; } // sin WebRTC: todo por Firestore
    const miSid = sid, sesion = s.sesionTv;
    try {
      pc = new env.RTCPeerConnection({ iceServers: env.iceServers || STUN });
      dc = pc.createDataChannel(CANAL, { ordered: true });
      const mio = dc;
      dc.onopen = () => { if (dc === mio) { s.respaldo = false; clearTimeout(espera); alCambiar(); } };
      dc.onclose = () => { if (dc === mio) { alCambiar(); programarReconexion(); } };
      pc.onicecandidate = (e) => {
        if (e.candidate && sid === miSid) mandarSenal(fs, codigo, { de: yo, deSid: miSid, para: "tv", paraSid: sesion, tipo: "ice", candidato: candidatoPlano(e.candidate) }).catch(() => {});
      };
      const mipc = pc;
      pc.onconnectionstatechange = () => { if (pc === mipc && pc.connectionState === "failed") programarReconexion(); };
      const oferta = await pc.createOffer();
      await pc.setLocalDescription(oferta);
      if (sid !== miSid) return;
      await mandarSenal(fs, codigo, { de: yo, deSid: miSid, para: "tv", paraSid: sesion, tipo: "desc", desc: plano(pc.localDescription || oferta) });
    } catch (e) {
      console.warn("control remoto: WebRTC", e);
      s.respaldo = true; alCambiar(); return;
    }
    // Si el canal no abre a tiempo, las acciones se van por Firestore (sigue intentando por si abre después)
    espera = despues(() => { if (!abierto(dc)) { s.respaldo = true; alCambiar(); } }, esperaMs);
  }

  function alSala(sala) {
    if (cerrado || !s.unido) return;
    if (!salaVigente(sala, ahora())) return cambiar("sin-tv"); // se sigue escuchando: si la TV regresa, nos conectamos
    if (sala.sesion !== s.sesionTv) { conectar(); return; } // la TV recargó y abrió otra vez esta sala
    if (sala.control && (sala.control.id !== yo || sala.control.sid !== sid)) return cambiar("otro");
    cambiar("conectado");
  }

  // Unirse a la sala (o volver a unirse) y ofrecer un canal nuevo
  function conectar() {
    if (cerrado) return Promise.resolve(false);
    if (conectando) return conectando;
    conectando = (async () => {
      clearTimeout(reintento); reintento = null;
      sid = nuevoId();
      let sala;
      try { sala = await unirseSala(fs, codigo, { id: yo, sid }, ahora()); }
      catch (e) {
        if (e && e.code === "no-existe") cambiar(s.unido ? "sin-tv" : "no-existe");
        else { console.warn("control remoto: unirse", e); cambiar("error"); programarReconexion(5000); }
        return false;
      }
      if (cerrado) return false;
      s.unido = true; s.sesionTv = sala.sesion;
      if (!quitarSenales) quitarSenales = verSenales(fs, codigo, yo, alSenal);
      if (!quitarSala) quitarSala = verSala(fs, codigo, alSala, () => {});
      if (!latido) latido = intervalo(avisar, latidoMs);
      cambiar("conectado");
      await ofrecer();
      return true;
    })().finally(() => { conectando = null; });
    return conectando;
  }

  // Cada rato: "sigo aquí" (solo si el control es nuestro; si otro teléfono lo tomó, no se lo quitamos)
  function avisar() {
    if (cerrado || s.estado !== "conectado") return;
    unirseSala(fs, codigo, { id: yo, sid }, ahora()).catch(() => {});
  }

  function programarReconexion(ms = 1000) {
    if (cerrado || reintento) return;
    reintento = despues(() => { reintento = null; reconectar(); }, ms);
  }

  // Volver a conectar si hace falta (la interfaz lo llama al regresar a la pantalla o al recuperar la red)
  function reconectar({ forzar = false } = {}) {
    if (cerrado || s.estado === "no-existe") return Promise.resolve(false);
    if (s.estado === "otro" && !forzar) return Promise.resolve(false);
    if (!forzar && s.estado === "conectado" && abierto(dc)) return Promise.resolve(true);
    return conectar();
  }

  // Manda una acción. Devuelve por dónde se fue ("webrtc" | "firestore"), o null si no se pudo.
  function enviar(accion) {
    if (cerrado || ACCIONES.indexOf(accion) < 0 || !s.sesionTv || s.estado !== "conectado") return null;
    if (abierto(dc)) {
      try { dc.send(JSON.stringify({ accion })); return "webrtc"; } catch (x) {}
    }
    mandarAccion(fs, codigo, { accion, sesion: s.sesionTv, de: yo }).catch(() => {});
    return "firestore";
  }

  function estado() {
    const directo = abierto(dc);
    return { estado: s.estado, via: s.estado !== "conectado" ? null : directo ? "webrtc" : s.respaldo ? "firestore" : null };
  }

  function cerrar() {
    cerrado = true;
    clearInterval(latido); clearTimeout(reintento);
    if (quitarSala) quitarSala();
    if (quitarSenales) quitarSenales();
    soltarPc();
  }

  return { conectar, reconectar, enviar, estado, cerrar, _pc: () => pc };
}
