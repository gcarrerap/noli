// Pruebas del teléfono como control remoto (issue #3): códigos y salas, el QR, y una TV y un teléfono de mentira
// (Firebase y WebRTC en memoria) que se emparejan, mandan acciones, se pasan al respaldo por Firestore y se
// vuelven a conectar.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fakeFirestore, fakeFirebase } from "./fakes/firebase.js";
import { fakeWebRTC } from "./fakes/webrtc.js";

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)) };
globalThis.window = globalThis;

const { nuevoCodigo, esCodigo, leerCodigo, salaVigente, controlVivo, urlControl, qr, qrSvg, SALA_VIDA_MS, CONTROL_VIVO_MS } = await import("../src/engine/index.js");
const { SALAS, abrirSala, renovarSala, cerrarSala, unirseSala, mandarAccion } = await import("../src/services/index.js");
const { crearTv, crearControl } = await import("../src/app/enlace.js");
const { state, remoto, alRemoto, actions } = await import("../src/app/index.js");
const firebaseSvc = await import("../src/services/firebase.js");

const esperar = async (n = 40) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const docs = (fs, sub) => [...fs._docs.keys()].filter((p) => p.includes(`/${sub}/`));

beforeEach(() => mem.clear());

// ---------- Códigos y salas (lógica pura) ----------

test("códigos: 4 dígitos sin cero al principio; se aceptan espacios y guiones al escribirlos", () => {
  assert.equal(nuevoCodigo(() => 0), "1000");
  assert.equal(nuevoCodigo(() => 0.99999), "9999");
  for (let i = 0; i < 200; i++) assert.ok(esCodigo(nuevoCodigo()));
  assert.equal(leerCodigo(" 47 29 "), "4729");
  assert.equal(leerCodigo("4-7-2-9"), "4729");
  for (const malo of ["472", "47290", "abcd", "", null, undefined]) assert.equal(leerCodigo(malo), null, String(malo));
});

test("sala vigente, teléfono vivo y liga del control", () => {
  const t = 1_000_000;
  assert.equal(salaVigente({ codigo: "4729", vence: t + 1 }, t), true);
  assert.equal(salaVigente({ codigo: "4729", vence: t }, t), false);
  assert.equal(salaVigente(null, t), false);
  assert.equal(controlVivo({ control: { visto: t - CONTROL_VIVO_MS + 1 } }, t), true);
  assert.equal(controlVivo({ control: { visto: t - CONTROL_VIVO_MS } }, t), false);
  assert.equal(controlVivo({ control: null }, t), false);
  assert.equal(urlControl("https://gcarrerap.github.io/noli/?modo=tv#x", "4729"), "https://gcarrerap.github.io/noli/control.html?sala=4729");
  assert.equal(urlControl("http://localhost:8000/index.html?modo=tv", "1234"), "http://localhost:8000/control.html?sala=1234");
});

// ---------- QR ----------

// Referencia generada con la librería qrcode de Python (nivel M, máscara 3, modo byte); también se probó leyendo
// los QR generados con zxing (ver la descripción del PR).
const REF = "1fdf1727f,105045641,1740e765d,175f0d15d,17419755d,104372141,1fd55557f,1538700,16eb7fb4b,1c0b9366d,12fb90ebb,141522269,19785f5bb,1d85cf52a,105747c4c,ba0e18ec,bdf87fdc,608f97db,15e350f4,8bfe653,96fb39af,15a376a49,eb202c7,abfa2079,136c8c7f2,10b2718,1fd80e750,105f6ff1c,174bffff6,17525972d,1756b8960,1043483b1,1fda5cedc";

test("qr: igual, cuadrito por cuadrito, al de una librería de referencia", () => {
  const m = qr("https://gcarrerap.github.io/noli/control.html?sala=4729", { mascara: 3 });
  assert.equal(m.length, 33); // versión 4
  const filas = m.map((r) => parseInt(r.map((b) => (b ? 1 : 0)).join(""), 2).toString(16));
  assert.deepEqual(filas, REF.split(","));
});

test("qr: crece con el texto, escoge una máscara y truena si no cabe", () => {
  assert.equal(qr("x").length, 21);
  assert.equal(qr("x".repeat(100)).length, 4 * 6 + 17);
  assert.equal(qr("x".repeat(200)).length, 4 * 10 + 17);
  assert.throws(() => qr("x".repeat(300)), /demasiado largo/);
  // Los tres patrones de las esquinas
  const m = qr("hola");
  for (const [x, y] of [[0, 0], [14, 0], [0, 14]]) {
    assert.equal(m[y][x], true); assert.equal(m[y + 1][x + 1], false); assert.equal(m[y + 3][x + 3], true);
  }
  const svg = qrSvg(m, { titulo: "Liga" });
  assert.match(svg, /^<svg[^>]+viewBox="0 0 29 29"/);
  assert.match(svg, /aria-label="Liga"/);
});

// ---------- Salas en Firestore ----------

test("abrir sala: usa el código de antes si está libre o es de esta TV; si otra TV lo tiene, otro al azar", async () => {
  const fs = fakeFirestore();
  let t = 1_000_000;
  const now = () => t;
  const c1 = await abrirSala(fs, { tv: "tvA", sesion: "s1", preferido: "4729", now });
  assert.equal(c1, "4729");
  const sala = fs._docs.get(`${SALAS}/4729`);
  assert.equal(sala.tv, "tvA"); assert.equal(sala.vence, t + SALA_VIDA_MS); assert.equal(sala.control, null);

  // Otra TV no puede quitársela mientras esté vigente
  const c2 = await abrirSala(fs, { tv: "tvB", sesion: "s2", preferido: "4729", now, rand: () => 0.5 });
  assert.equal(c2, "5500");

  // La misma TV (recargó la página) la vuelve a abrir con otra sesión y conserva al teléfono
  await unirseSala(fs, "4729", { id: "tel", sid: "x" }, t);
  assert.equal(await abrirSala(fs, { tv: "tvA", sesion: "s3", preferido: "4729", now }), "4729");
  assert.equal(fs._docs.get(`${SALAS}/4729`).sesion, "s3");
  assert.equal(fs._docs.get(`${SALAS}/4729`).control.id, "tel");

  // Vencida, cualquiera puede usarla (y el teléfono viejo no se hereda)
  t += SALA_VIDA_MS + 1;
  assert.equal(await abrirSala(fs, { tv: "tvB", sesion: "s4", preferido: "4729", now }), "4729");
  assert.equal(fs._docs.get(`${SALAS}/4729`).control, null);
  // La TV anterior se entera al renovar: ya no es suya
  assert.equal(await renovarSala(fs, "4729", "s3", t), false);
  assert.equal(await renovarSala(fs, "4729", "s4", t + 5), true);
  assert.equal(fs._docs.get(`${SALAS}/4729`).vence, t + 5 + SALA_VIDA_MS);
  // Solo la dueña la cierra
  await cerrarSala(fs, "4729", "s3");
  assert.ok(fs._docs.has(`${SALAS}/4729`));
  await cerrarSala(fs, "4729", "s4");
  assert.ok(!fs._docs.has(`${SALAS}/4729`));
});

test("abrir sala: si todos los códigos al azar están ocupados, truena", async () => {
  const fs = fakeFirestore();
  await abrirSala(fs, { tv: "tvA", sesion: "s1", rand: () => 0 });
  await assert.rejects(abrirSala(fs, { tv: "tvB", sesion: "s2", rand: () => 0, intentos: 3 }), (e) => e.code === "sin-codigo");
});

test("unirse: código que no existe o sala vencida → no-existe", async () => {
  const fs = fakeFirestore();
  await assert.rejects(unirseSala(fs, "1234", { id: "tel", sid: "a" }), (e) => e.code === "no-existe");
  const t = Date.now();
  await abrirSala(fs, { tv: "tv", sesion: "s", preferido: "1234", now: () => t });
  await assert.rejects(unirseSala(fs, "1234", { id: "tel", sid: "a" }, t + SALA_VIDA_MS), (e) => e.code === "no-existe");
  const sala = await unirseSala(fs, "1234", { id: "tel", sid: "a" }, t + 10);
  assert.deepEqual(sala.control, { id: "tel", sid: "a", visto: t + 10 });
});

// ---------- TV y teléfono ----------

async function pareja({ bloqueada = false, esperaMs = 20 } = {}) {
  const fs = fakeFirestore();
  const rtc = fakeWebRTC();
  rtc.red.bloqueada = bloqueada;
  const codigo = await abrirSala(fs, { tv: "tvA", sesion: "ses1" });
  const llegaron = [];
  const tv = crearTv({ fs, codigo, sesion: "ses1", env: rtc, alAccion: (a, via) => llegaron.push([a, via]) });
  const tel = crearControl({ fs, codigo, yo: "tel1", env: rtc, esperaMs });
  return { fs, rtc, codigo, tv, tel, llegaron };
}

test("emparejar: el teléfono ofrece, la TV responde y las acciones van directo por WebRTC", async () => {
  const { fs, tv, tel, llegaron } = await pareja();
  assert.deepEqual(tv.estado(), { conectado: false, via: null, perdida: false });
  assert.equal(await tel.conectar(), true);
  await esperar();
  assert.deepEqual(tel.estado(), { estado: "conectado", via: "webrtc" });
  assert.deepEqual(tv.estado(), { conectado: true, via: "webrtc", perdida: false });
  for (const a of ["derecha", "abajo", "ok", "atras"]) assert.equal(tel.enviar(a), "webrtc");
  assert.equal(tel.enviar("saltar"), null, "solo las seis acciones");
  await esperar();
  assert.deepEqual(llegaron, [["derecha", "webrtc"], ["abajo", "webrtc"], ["ok", "webrtc"], ["atras", "webrtc"]]);
  assert.equal(docs(fs, "senales").length, 0, "las señales se borran al recibirlas");
  assert.equal(docs(fs, "acciones").length, 0);
  tel.cerrar(); await tv.cerrar();
});

test("respaldo: si WebRTC no conecta en el tiempo de espera, las acciones van por Firestore", async () => {
  const { fs, tv, tel, llegaron } = await pareja({ bloqueada: true, esperaMs: 20 });
  await tel.conectar();
  await esperar();
  assert.deepEqual(tel.estado(), { estado: "conectado", via: null }, "todavía esperando a WebRTC");
  // Aun antes de que se venza la espera, lo que se toca ya llega (por Firestore)
  assert.equal(tel.enviar("ok"), "firestore");
  await dormir(30); await esperar();
  assert.deepEqual(tel.estado(), { estado: "conectado", via: "firestore" });
  assert.deepEqual(tv.estado(), { conectado: true, via: "firestore", perdida: false }, "la TV ve al teléfono por su aviso en la sala");
  assert.equal(tel.enviar("izquierda"), "firestore");
  await esperar();
  assert.deepEqual(llegaron, [["ok", "firestore"], ["izquierda", "firestore"]]);
  assert.equal(docs(fs, "acciones").length, 0, "la TV borra cada acción al recibirla");
  tel.cerrar(); await tv.cerrar();
});

test("respaldo: la TV ignora acciones de otra sesión y acciones desconocidas", async () => {
  const { fs, codigo, tv, llegaron } = await pareja();
  await mandarAccion(fs, codigo, { accion: "ok", sesion: "vieja", de: "x" });
  await mandarAccion(fs, codigo, { accion: "borrar-todo", sesion: "ses1", de: "x" });
  await mandarAccion(fs, codigo, { accion: "abajo", sesion: "ses1", de: "x" });
  await esperar();
  assert.deepEqual(llegaron, [["abajo", "firestore"]]);
  await tv.cerrar();
});

test("reconectar: si el teléfono pierde el canal (se bloqueó, cambió de red), ofrece otro y la TV lo toma", async () => {
  const { rtc, tv, tel, llegaron } = await pareja();
  await tel.conectar(); await esperar();
  const viejo = tv._con();
  tel._pc().close(); // la pantalla se bloqueó y el navegador cerró la conexión
  await esperar();
  assert.equal(tel.estado().via, null);
  assert.equal(await tel.reconectar(), true);
  await esperar();
  assert.notEqual(tv._con(), viejo, "conexión nueva en la TV");
  assert.equal(viejo.pc.cerrada, true, "la vieja se cerró");
  assert.deepEqual(tel.estado(), { estado: "conectado", via: "webrtc" });
  tel.enviar("arriba"); await esperar();
  assert.deepEqual(llegaron, [["arriba", "webrtc"]]);
  // Con el canal abierto, reconectar no hace nada
  const n = rtc.red.conexiones.length;
  assert.equal(await tel.reconectar(), true);
  assert.equal(rtc.red.conexiones.length, n);
  tel.cerrar(); await tv.cerrar();
});

test("la TV recarga la página: abre la misma sala con otra sesión y el teléfono se vuelve a conectar solo", async () => {
  const { fs, rtc, codigo, tv, tel } = await pareja();
  await tel.conectar(); await esperar();
  // La página de la TV se recargó (la vieja ya no escucha nada)
    // La página de la TV se recargó: la vieja desaparece sin cerrar la sala (su sesión ya no recibe nada)
  const llegaron2 = [];
  await abrirSala(fs, { tv: "tvA", sesion: "ses2", preferido: codigo });
  const tv2 = crearTv({ fs, codigo, sesion: "ses2", env: rtc, alAccion: (a, via) => llegaron2.push([a, via]) });
  await esperar(80);
  assert.deepEqual(tel.estado(), { estado: "conectado", via: "webrtc" });
  assert.deepEqual(tv2.estado(), { conectado: true, via: "webrtc", perdida: false });
  tel.enviar("ok"); await esperar();
  assert.deepEqual(llegaron2, [["ok", "webrtc"]]);
  tel.cerrar(); await tv2.cerrar(); await tv.cerrar();
});

test("la TV apaga el control: el teléfono queda sin TV y no manda nada", async () => {
  const { tv, tel } = await pareja();
  await tel.conectar(); await esperar();
  await tv.cerrar(); await esperar();
  assert.equal(tel.estado().estado, "sin-tv");
  assert.equal(tel.enviar("ok"), null);
  tel.cerrar();
});

test("código equivocado: no-existe, y reconectar no insiste", async () => {
  const fs = fakeFirestore(), rtc = fakeWebRTC();
  const tel = crearControl({ fs, codigo: "9999", yo: "tel", env: rtc });
  assert.equal(await tel.conectar(), false);
  assert.equal(tel.estado().estado, "no-existe");
  assert.equal(await tel.reconectar(), false);
  assert.equal(rtc.red.conexiones.length, 0);
});

test("otro teléfono toma el control: el primero se entera y solo vuelve si lo pide", async () => {
  const { fs, rtc, codigo, tv, tel, llegaron } = await pareja();
  await tel.conectar(); await esperar();
  const tel2 = crearControl({ fs, codigo, yo: "tel2", env: rtc, esperaMs: 20 });
  await tel2.conectar(); await esperar();
  assert.equal(tel.estado().estado, "otro");
  assert.equal(tel.enviar("ok"), null);
  assert.equal(await tel.reconectar(), false);
  tel2.enviar("abajo"); await esperar();
  assert.deepEqual(llegaron, [["abajo", "webrtc"]]);
  assert.equal(await tel.reconectar({ forzar: true }), true);
  await esperar();
  assert.equal(tel.estado().estado, "conectado");
  assert.equal(tel2.estado().estado, "otro");
  tel.cerrar(); tel2.cerrar(); await tv.cerrar();
});

test("sin WebRTC en el teléfono: todo por Firestore desde el principio", async () => {
  const fs = fakeFirestore();
  const codigo = await abrirSala(fs, { tv: "tvA", sesion: "s" });
  const llegaron = [];
  const tv = crearTv({ fs, codigo, sesion: "s", env: fakeWebRTC(), alAccion: (a) => llegaron.push(a) });
  const tel = crearControl({ fs, codigo, yo: "t", env: {} });
  await tel.conectar(); await esperar();
  assert.deepEqual(tel.estado(), { estado: "conectado", via: "firestore" });
  tel.enviar("derecha"); await esperar();
  assert.deepEqual(llegaron, ["derecha"]);
  tel.cerrar(); await tv.cerrar();
});

// ---------- La app de la TV ----------

test("app de la TV: prender, enseñar el código, conectarse el teléfono, entregar acciones y apagar", async () => {
  const fs = fakeFirestore(), rtc = fakeWebRTC();
  const entorno = { conectar: async () => ({ fs, uid: "tvA" }), env: rtc };
  state.modo = "tv";
  await remoto.encender({ entorno });
  assert.equal(state.remoto.estado, "esperando");
  assert.ok(esCodigo(state.remoto.codigo));
  assert.equal(state.remoto.panel, true);
  assert.equal(mem.get("noli.remoto"), "1");
  assert.equal(mem.get("noli.sala"), state.remoto.codigo);

  const recibidas = [];
  alRemoto((a) => recibidas.push(a));
  const tel = crearControl({ fs, codigo: state.remoto.codigo, yo: "tel", env: rtc });
  await tel.conectar(); await esperar();
  assert.equal(state.remoto.estado, "conectado");
  assert.equal(state.remoto.via, "webrtc");
  assert.equal(state.remoto.panel, false, "el recuadro se quita solo al conectarse");
  tel.enviar("derecha"); tel.enviar("ok"); await esperar();
  assert.deepEqual(recibidas, ["derecha", "ok"]);

  // Prender otra vez no abre otra sala: solo enseña el recuadro
  const codigo = state.remoto.codigo;
  await remoto.encender({ entorno });
  assert.equal(state.remoto.codigo, codigo);
  assert.equal(state.remoto.panel, true);

  await remoto.apagar(); await esperar();
  assert.equal(state.remoto.estado, "apagado");
  assert.equal(mem.get("noli.remoto"), "");
  assert.ok(!fs._docs.has(`${SALAS}/${codigo}`), "la sala se borra");
  assert.equal(tel.estado().estado, "sin-tv");
  tel.cerrar();
  alRemoto(null);
});

test("app de la TV: al recargar retoma el control remoto con el mismo código", async () => {
  const fs = fakeFirestore(), rtc = fakeWebRTC();
  const entorno = { conectar: async () => ({ fs, uid: "tvA" }), env: rtc };
  state.modo = "tv";
  await remoto.encender({ entorno });
  const codigo = state.remoto.codigo;
  // "Recargar": la página nueva no cierra la sala de la vieja; la vuelve a abrir
  await remoto.apagar({ olvidar: false });
  await abrirSala(fs, { tv: "tvA", sesion: "vieja", preferido: codigo }); // la sala de la página anterior sigue ahí
  await remoto.retomar({ entorno });
  assert.equal(state.remoto.codigo, codigo);
  assert.equal(state.remoto.panel, false, "al retomar no tapa la pantalla");
  await remoto.apagar();
  // Apagado a propósito: al recargar ya no se prende
  assert.equal(await remoto.retomar({ entorno }), undefined);
  assert.equal(state.remoto.estado, "apagado");
});

test("app de la TV: sin internet o sin reglas, error claro", async () => {
  await remoto.encender({ entorno: { conectar: async () => { throw Object.assign(new Error("x"), { code: "permission-denied" }); } } });
  assert.equal(state.remoto.estado, "error");
  assert.match(state.remoto.error, /reglas/);
  await remoto.encender({ entorno: { conectar: async () => { throw new TypeError("Failed to fetch"); } } });
  assert.match(state.remoto.error, /internet/);
  await remoto.apagar();
});

test("app de la TV: sin la interfaz registrada, las acciones entran por actions.entrada", async () => {
  const fs = fakeFirestore(), rtc = fakeWebRTC();
  state.modo = "tv"; state.jugando = { id: "x" };
  const alJuego = [];
  const { conectarJuego } = await import("../src/app/index.js");
  const soltar = conectarJuego((a) => alJuego.push(a));
  await remoto.encender({ entorno: { conectar: async () => ({ fs, uid: "tvA" }), env: rtc } });
  const tel = crearControl({ fs, codigo: state.remoto.codigo, yo: "tel", env: rtc });
  await tel.conectar(); await esperar();
  tel.enviar("izquierda"); await esperar();
  assert.deepEqual(alJuego, ["izquierda"], "con un juego abierto, la acción le llega al juego");
  tel.cerrar(); await remoto.apagar(); soltar(); state.jugando = null;
  assert.equal(typeof actions.entrada, "function");
});

// ---------- Firebase ----------

test("firebase: el control remoto comparte la conexión de la nube y recibe el usuario anónimo", async () => {
  const fb = fakeFirebase();
  globalThis.firebase = fb.firebase;
  firebaseSvc._resetInitForTests();
  const a = await firebaseSvc.conectarFirebase({ projectId: "dominomx" });
  const b = await firebaseSvc.conectarFirebase({ projectId: "dominomx" });
  assert.equal(a.uid, "anon1");
  assert.equal(a.fs, fb.fs);
  assert.equal(b.fs, a.fs);
  assert.deepEqual(fb.calls.filter((c) => c.startsWith("initializeApp")), ["initializeApp:dominomx"], "una sola vez");
  firebaseSvc._resetInitForTests();
  await assert.rejects(firebaseSvc.conectarFirebase(null), /sin config/);
  firebaseSvc._resetInitForTests();
  delete globalThis.firebase;
});

// ---------- El teléfono (app/telefono.js) ----------

test("teléfono: el código sale de la liga del QR o del último usado; uno equivocado se olvida", async () => {
  const { telefono } = await import("../src/app/telefono.js");
  mem.set("noli.control", "5555");
  assert.equal(telefono.codigoInicial("?sala=4729"), "4729");
  assert.equal(telefono.codigoInicial("?sala=abc"), "5555");
  assert.equal(telefono.codigoInicial(""), "5555");

  const fs = fakeFirestore(), rtc = fakeWebRTC();
  const entorno = { conectar: async () => ({ fs, uid: "tel" }), env: rtc };
  assert.equal(await telefono.conectar("5555", { entorno }), false);
  assert.equal(telefono.estado().estado, "no-existe");
  assert.equal(mem.get("noli.control"), "", "el código guardado ya no sirve");

  const codigo = await abrirSala(fs, { tv: "tvA", sesion: "s" });
  const llegaron = [];
  const tv = crearTv({ fs, codigo, sesion: "s", env: rtc, alAccion: (a) => llegaron.push(a) });
  let avisos = 0;
  const dejar = telefono.alCambiar(() => avisos++);
  assert.equal(await telefono.conectar(` ${codigo} `, { entorno }), true);
  await esperar();
  assert.deepEqual(telefono.estado(), { estado: "conectado", via: "webrtc" });
  assert.equal(mem.get("noli.control"), codigo);
  assert.ok(avisos > 0);
  telefono.enviar("ok"); await esperar();
  assert.deepEqual(llegaron, ["ok"]);
  telefono.soltar({ olvidar: true });
  assert.equal(telefono.estado().estado, "apagado");
  assert.equal(mem.get("noli.control"), "");
  dejar(); await tv.cerrar();
});

test("diagnostico.html entiende las teclas igual que kit/teclas.js", async () => {
  const fsn = await import("node:fs");
  const html = fsn.readFileSync(new URL("../diagnostico.html", import.meta.url), "utf8");
  const kit = fsn.readFileSync(new URL("../kit/teclas.js", import.meta.url), "utf8");
  const objeto = (src, nombre) => {
    const m = src.match(new RegExp(nombre + "\\s*=\\s*(\\{[\\s\\S]*?\\});"));
    return Function("return " + m[1].replace(/\/\/.*$/gm, ""))();
  };
  assert.deepEqual(objeto(html, "POR_NOMBRE"), objeto(kit, "POR_NOMBRE"));
  assert.deepEqual(objeto(html, "POR_CODIGO"), objeto(kit, "POR_CODIGO"));
});
