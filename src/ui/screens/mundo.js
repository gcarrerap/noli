// El menú principal en 3D (#25): un mundo mágico donde Noelia camina (y brinca) hasta el lugar de cada juego.
// Esta pantalla arma el mundo (datos + escena 3D, que se baja con import() solo aquí), dibuja lo que va encima del
// lienzo (créditos, nube, cristales, letreros, aviso de "entrar", joystick, botón de brincar, menú) y convierte la
// entrada (dedo, teclado, control de la TV, teléfono como control) en movimiento.
//
// Vive fuera de #app (en <div id="mundo">) para que el juego abierto (iframe en #app) quede encima sin destruir el
// mundo: en el teléfono el mundo solo se pausa; en la TV se libera (poca memoria) y se vuelve a armar al regresar.
// Si algo falla al armarlo, la app regresa al menú 2D (nunca pantalla en blanco). Ver docs/MUNDO.md.
import { state, actions } from "../../app/index.js";
import { cargarMundo, BASE_MUNDO } from "../../services/index.js";
import { revisarMundo, colocarLugares, decorar, todosLosSitios, mapaMundo, fisicaDe, crearCaminos, cristalesDe, materias,
  jugableEn, acomodarLetreros, librosDe, estadoLibros, conHallazgo, dia, revisarIslas, armarIslas, libresNoli, salidasNoli,
  teletransportadorDe, puedeConstruir, construir, conVisita, disponibles, vistaMapa, estrellasDeJuego, puntoMapa, revisarBuho, solidoBuho,
  esFraseSecreta, relojSecreto, otraPregunta } from "../../engine/index.js";
import { crearJoystick } from "../../../kit/3d/joystick.js";
import { direccionDeTeclas, crearPulsador } from "../../../kit/3d/movimiento.js";
import { moverFoco, focoInicial } from "../../../kit/foco.js";
import { teclaAAccion } from "../../../kit/teclas.js";
import { botonCreditos, MONEDA, ESTRELLA_MUNDO } from "../components/creditos.js";
import { botonNube } from "../components/nube.js";
import { chipRemoto, instalarChipRemoto } from "../components/remoto.js";
import { esc } from "../dom.js";
import { nombreMateria, estrellasHtml } from "../labels.js";

const FLECHAS = ["arriba", "abajo", "izquierda", "derecha"];
const parametros = new URLSearchParams(location.search);

// Íconos (SVG, sin emojis: en la TV LG salen en blanco y negro, #5)
const ICONO = {
  menu: `<svg viewBox="0 0 24 24" width="1.4em" height="1.4em" aria-hidden="true"><path d="M3.5 6.5 9 4l6 2.5L20.5 4v13.5L15 20l-6-2.5-5.5 2.5z" fill="#fff4cc" stroke="#2b2236" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 4v13.5M15 6.5V20" stroke="#2b2236" stroke-width="1.4"/><circle cx="12" cy="11" r="1.6" fill="#ff6b4a"/></svg>`,
  cristal: `<svg viewBox="0 0 24 24" width="1.3em" height="1.3em" aria-hidden="true"><path d="M12 2.5 18 9l-6 12.5L6 9z" fill="#9fe6ff" stroke="#2b2236" stroke-width="1.5" stroke-linejoin="round"/><path d="M6 9h12M12 2.5 9.5 9l2.5 12.5L14.5 9z" fill="none" stroke="#2b2236" stroke-width="1" stroke-linejoin="round"/></svg>`,
  libro: `<svg viewBox="0 0 24 24" width="1.3em" height="1.3em" aria-hidden="true"><path d="M4 5.5c2.7-1 5.4-1 8 .8 2.6-1.8 5.3-1.8 8-.8v13c-2.7-1-5.4-1-8 .8-2.6-1.8-5.3-1.8-8-.8z" fill="#c9a6ff" stroke="#2b2236" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 6.3v13" stroke="#2b2236" stroke-width="1.4"/><circle cx="18.5" cy="4.5" r="2" fill="#f28c28" stroke="#2b2236" stroke-width="1"/></svg>`,
  brincar: `<svg viewBox="0 0 24 24" width="1.7em" height="1.7em" aria-hidden="true"><path d="M12 3 4.5 12h4.6v8.5h5.8V12h4.6z" fill="currentColor"/></svg>`,
  mapa: `<svg viewBox="0 0 24 24" width="1.4em" height="1.4em" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="#8fd3f4" stroke="#2b2236" stroke-width="1.6"/><ellipse cx="9" cy="10" rx="3.4" ry="2.6" fill="#bfe6a4" stroke="#2b2236" stroke-width="1.1"/><ellipse cx="15.5" cy="15" rx="2.6" ry="2" fill="#ffd3e8" stroke="#2b2236" stroke-width="1.1"/><path d="M11.5 11.5l2.6 2.4" stroke="#2b2236" stroke-width="1.2" stroke-dasharray="1.2 1"/></svg>`,
  tele: `<svg viewBox="0 0 24 24" width="1.3em" height="1.3em" aria-hidden="true"><ellipse cx="12" cy="18" rx="8" ry="3" fill="#d9c8ff" stroke="#2b2236" stroke-width="1.4"/><path d="M7 17V8M17 17V8" stroke="#c9a6ff" stroke-width="2.2" stroke-linecap="round"/><path d="M12 4.5l1.2 2.5 2.6.3-2 1.8.6 2.6-2.4-1.4-2.4 1.4.6-2.6-2-1.8 2.6-.3z" fill="#ffd166" stroke="#2b2236" stroke-width="1"/></svg>`,
  buho: `<svg viewBox="0 0 24 24" width="1.3em" height="1.3em" aria-hidden="true"><ellipse cx="12" cy="14" rx="7.5" ry="8" fill="#b07a4a" stroke="#2b2236" stroke-width="1.4"/><path d="M5 6.5l2.5 3M19 6.5l-2.5 3" stroke="#2b2236" stroke-width="1.4"/><circle cx="9" cy="12" r="2.8" fill="#fff" stroke="#e6b13a" stroke-width="1.2"/><circle cx="15" cy="12" r="2.8" fill="#fff" stroke="#e6b13a" stroke-width="1.2"/><circle cx="9" cy="12" r="1.2" fill="#2b2236"/><circle cx="15" cy="12" r="1.2" fill="#2b2236"/><path d="M12 14l-1.2 1.6h2.4z" fill="#f39a2e"/><path d="M6.5 5.5h11l-5.5-2.5z" fill="#7b4fc0" stroke="#2b2236" stroke-width="1"/></svg>`,
  sencillo: `<svg viewBox="0 0 24 24" width="1.2em" height="1.2em" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="2" fill="#ffc43d" stroke="#2b2236" stroke-width="1.4"/><rect x="13.5" y="3.5" width="7" height="7" rx="2" fill="#4cb3ff" stroke="#2b2236" stroke-width="1.4"/><rect x="3.5" y="13.5" width="7" height="7" rx="2" fill="#3ccf8e" stroke="#2b2236" stroke-width="1.4"/><rect x="13.5" y="13.5" width="7" height="7" rx="2" fill="#ff6b4a" stroke="#2b2236" stroke-width="1.4"/></svg>`,
};

let M = null;          // el mundo montado: { raiz, estado, vista, lugares, ... } (ver montar)
let cache = null;      // datos y módulo 3D ya bajados (para volver a armar rápido en la TV)
let volverA = null;    // id del juego en cuya puerta reaparece al regresar
const pulsar = crearPulsador(250); // un brinco por pulsación aunque la tecla se repita
let saludado = false;  // el "¡Hola, Noelia!" sale una vez (en la TV el mundo se vuelve a armar después de cada juego)

// ---------- Lo que llama render() ----------

/** Muestra el mundo (lo arma la primera vez; si estaba pausado debajo de un juego, lo reanuda). */
export function mostrarMundo() {
  if (!M) montar();
  M.raiz.hidden = false;
  if (M.estado === "esperando" && !state.cargando) armar();
  if (M.estado !== "listo") return;
  if (M.pausado) {
    M.pausado = false; M.vista.pausar(false);
    if (volverA) { M.vista.volverDe(volverA); volverA = null; }
  }
  actualizar();
}

/** Hay un juego abierto encima: en el teléfono se pausa; en la TV se libera para dejarle la memoria al juego. */
export function ocultarMundo() {
  if (!M) return;
  if (state.modo === "tv" || M.estado !== "listo") { desmontarMundo(); return; }
  M.pausado = true; M.vista.pausar(true); M.vista.mover({ x: 0, z: 0 });
  M.raiz.hidden = true;
}

/** Quita el mundo y libera la escena (al cambiar al menú 2D, o en la TV al abrir un juego). */
export function desmontarMundo() {
  if (!M) return;
  const m = M; M = null;
  m.estado = "cerrado";
  for (const q of m.quitar) q();
  if (m.vista) try { m.vista.liberar(); } catch (e) { console.warn("[mundo]", e); }
  m.raiz.remove();
}

/** ¿El mundo está a la vista y recibe las acciones del control? */
export const mundoActivo = () => !!M && !state.jugando;

// ---------- Armar ----------

function montar() {
  const raiz = document.createElement("div");
  raiz.id = "mundo"; raiz.className = "mundo";
  raiz.innerHTML = `
    <div class="mundo-lienzo" id="mundoLienzo"></div>
    <div class="mundo-letreros" id="mundoLetreros"></div>
    <header class="mundo-hud" id="mundoHud"></header>
    <div class="mundo-joy" id="mundoJoy"></div>
    <button class="mundo-brincar" id="mundoBrincar" aria-label="Brincar">${ICONO.brincar}<span>Brincar</span></button>
    <div class="mundo-abajo"><button class="mundo-aviso" id="mundoAviso" hidden></button></div>
    <div class="mundo-toast" id="mundoToast" role="status" aria-live="polite"></div>
    <div class="mundo-menu" id="mundoMenu" hidden role="dialog" aria-modal="true" aria-labelledby="mundoMenuTitulo"></div>
    <div class="mundo-carga" id="mundoCarga">
      <div class="mundo-carga-caja">
        <div class="chispas" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
        <p>Abriendo el mundo mágico…</p>
        <button class="mundo-sencillo" id="mundoCargaSencillo">${ICONO.sencillo}Menú sencillo</button>
      </div>
    </div>
    <div class="mundo-fps" id="mundoFps" hidden></div>`;
  document.body.insertBefore(raiz, document.getElementById("app"));
  M = { raiz, estado: "esperando", vista: null, quitar: [], menu: false, cerca: null, pausado: false, teclas: { hasta: {}, apretadas: {} }, joy: { x: 0, z: 0 } };
  const $ = (id) => raiz.querySelector("#" + id);
  $("mundoCargaSencillo").onclick = () => actions.ponerVista("2d", { recordar: true });
}

async function armar() {
  const m = M;
  m.estado = "armando";
  try {
    if (!cache) {
      const [datos, mod] = await Promise.all([cargarMundo(), import("../../mundo/vista.js")]);
      const errores = [...revisarMundo(datos.mundo, datos.lugares), ...revisarIslas(datos.islas, datos.mundo, fisicaDe(datos.mundo)), ...revisarBuho(datos.buho)];
      if (errores.length) throw new Error("mundo/: " + errores.join("; "));
      cache = { ...datos, mod };
    }
    if (M !== m) return; // lo quitaron mientras cargaba
    const { mundo, lugares: L, islas, buho, mod } = cache;
    const red = armarIslas(islas);
    actions.topeEstrellas = islas.topeEstrellas;
    const juegos = state.juegos.filter((j) => jugableEn(j, state.modo));
    const lugares = colocarLugares(juegos, L);
    const libres = libresNoli(red);
    libres.puntos.push({ x: buho.x, z: buho.z, r: buho.radio + 1.6 }); // el búho (#166)
    const deco = decorar(mundo, todosLosSitios(L), libres);
    const cfg = fisicaDe(mundo);
    const mapa = mapaMundo(mundo, lugares, deco);
    mapa.solidos.push(solidoBuho(buho));
    const salidas = salidasNoli(red);
    const caminos = crearCaminos(mundo, lugares, mapa, cfg, [...salidas.map((x) => x.adentro), ...salidas.map((x) => x.lejos), teletransportadorDe(red.por.get("noli"))]);
    const cristales = cristalesDe(mundo);
    const guardado = actions.datosMundo();
    const tiene = new Set(guardado && Array.isArray(guardado.cristales) ? guardado.cristales.filter((id) => cristales.some((c) => c.id === id)) : []);
    const reducir = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    Object.assign(m, { mundo, lugares, cristales, tiene, cfg, red, muelle: null, tele: null, claveIslas: claveIslas(guardado), buho,
      junto: false, secreto: null, ultimaConocida: "noli", pregunta: "", contesta: "" });
    m.libros = prepararLibros(mundo, juegos);
    m.vista = mod.crearVistaMundo(m.raiz.querySelector("#mundoLienzo"), { mundo, lugares, deco, mapa, caminos, cfg, cristales, red, islas }, {
      tv: state.modo === "tv", reducir, tiene, desde: volverA,
      alLugar: (l) => { m.cerca = l; dibujarAviso(); },
      alCristal: encontrarCristal,
      libro: m.libros ? libroQueToca() : null,
      alLibro: encontrarLibro,
      alPista: (n) => toast(n >= 2 ? "Mira la luz morada: ahí está el libro escondido." : "Hay un libro escondido por aquí. Busca un brillo morado."),
      alBajarMucho: () => { if (!m.preguntoLento && !parametros.has("sinaviso")) { m.preguntoLento = true; abrirMenu("lento"); } },
      datosIslas: guardado,
      alIsla: llegarAIsla,
      alMuelle: (x) => { m.muelle = x; dibujarAviso(); },
      alTele: (x) => { m.tele = x; dibujarAviso(); },
      alCaida: () => toast("¡Splash! Regresaste a la isla."),
      buho,
      alBuho: (x) => { m.junto = x; dibujarAviso(); },
      puedeTomar: () => !m.secreto,
    });
    volverA = null;
    m.estado = "listo";
    instalar(m);
    vestirConPasarela(m);
    m.raiz.querySelector("#mundoCarga").hidden = true;
    actualizar();
    if (!saludado) { saludado = true; toast(state.modo === "tv" ? "¡Hola, Noelia! Camina con las flechas hasta un juego." : "¡Hola, Noelia! Camina hasta un juego para entrar."); }
  } catch (e) {
    console.warn("[mundo] no se pudo armar; se usa el menú 2D", e);
    if (M === m) { desmontarMundo(); actions.ponerVista("2d"); }
  }
}

/** El personaje con la ropa y el tono de piel de la Pasarela (si el juego está; si algo falla, se queda como está) */
async function vestirConPasarela(m) {
  if (!state.juegos.some((j) => j.id === "pasarela")) return;
  try {
    const base = new URL("../../../minijuegos/pasarela/", import.meta.url);
    const [{ cargarDatos }, { leerProgreso }, { atuendoInicial }] = await Promise.all([
      import("../../../minijuegos/pasarela/src/ui/cargar.js"), import("../../../minijuegos/pasarela/src/progreso.js"),
      import("../../../minijuegos/pasarela/src/atuendo.js")]);
    const { idx } = await cargarDatos(new URL("datos/", base).href);
    if (M !== m || !m.vista) return;
    const p = leerProgreso(actions.datosDe("pasarela"), idx);
    m.vista.vestir(p.ultimo || atuendoInicial(idx), idx, idx.config.tonosPiel[p.piel]);
  } catch (e) { console.warn("[mundo] sin ropa de la Pasarela", e); }
}

function instalar(m) {
  const $ = (id) => m.raiz.querySelector("#" + id);
  const on = (el, ev, fn, op) => { el.addEventListener(ev, fn, op); m.quitar.push(() => el.removeEventListener(ev, fn, op)); };

  // Joystick (solo con dedo; en la TV no se ve) y botón de brincar
  const joy = crearJoystick($("mundoJoy"), (d) => { m.joy = d; });
  m.quitar.push(() => joy.quitar());
  on($("mundoBrincar"), "pointerdown", (e) => { e.preventDefault(); if (!m.menu) m.vista.brincar(); });
  $("mundoAviso").onclick = () => { if (m.cerca) entrar(m.cerca.id); else if (m.muelle) construirAqui(); else if (m.tele) abrirMenu("tele"); else if (m.junto) hablarConBuho(); };

  // Tocar el piso: caminar hasta ahí
  on($("mundoLienzo"), "pointerup", (e) => {
    if (m.menu || e.pointerType === "mouse" && e.button !== 0) return;
    const p = m.vista.alPiso(e.clientX, e.clientY);
    if (p) m.vista.irAPunto(p.x, p.z);
  });

  // Flechas mantenidas (el keydown lo convierte entrada.js en acciones; aquí se sabe cuándo se sueltan)
  on(window, "keydown", (e) => { const a = teclaAAccion(e); if (FLECHAS.includes(a)) m.teclas.apretadas[a] = true; });
  on(window, "keyup", (e) => { const a = teclaAAccion(e); if (FLECHAS.includes(a)) { m.teclas.apretadas[a] = false; m.teclas.hasta[a] = 0; } });
  on(window, "blur", () => { m.teclas = { hasta: {}, apretadas: {} }; });
  on(window, "resize", () => dibujarLetreros(true));

  // Cada cuadro: dirección (joystick o flechas) y letreros
  m.quitar.push(m.vista.cadaCuadro(() => {
    if (M !== m) return;
    let dir = { x: 0, z: 0 };
    // Con el menú o una ventana abierta (nube, créditos, control remoto) las flechas son para esa ventana
    if (!m.menu && !state.nubeAbierta && !state.creditosAbierto && !state.remoto.panel) {
      // El joystick va de 0 a `turbo` veces la velocidad: entre más lejos del centro, más rápido
      if (Math.hypot(m.joy.x, m.joy.z) > 0.05) { const t = (m.cfg && m.cfg.turbo) || 1; dir = { x: m.joy.x * t, z: m.joy.z * t }; }
      else {
        const d = direccionDeTeclas(m.teclas.hasta, performance.now());
        for (const k of FLECHAS) if (m.teclas.apretadas[k]) { const e = direccionDeTeclas({ [k]: Infinity }, 0); d.x += e.x; d.z += e.z; }
        dir = { x: Math.sign(d.x), z: Math.sign(d.z) };
      }
    }
    m.vista.mover(dir);
    dibujarLetreros(false);
  }));

  if (parametros.has("fps")) {
    window.noliMundo = { get vista() { return M && M.vista; } }; // para diagnosticar (y para las pruebas en el navegador)
    const t = setInterval(() => { if (!M || !M.vista) return; const f = $("mundoFps"), i = M.vista.info; f.hidden = false; f.textContent = `${Math.round(M.vista.fps)} fps · ${M.vista.calidad} · ${i.dibujos} dibujos · ${i.triangulos} triángulos`; }, 500);
    m.quitar.push(() => clearInterval(t));
  }
}

// ---------- Dibujar lo que va encima ----------

/** HUD, letreros y menú (cuando cambia el estado: créditos, materia, estrellas, nube, control remoto) */
function actualizar() {
  if (!M || M.estado !== "listo") return;
  const $ = (id) => M.raiz.querySelector("#" + id);
  const tv = state.modo === "tv";
  // Cristales que llegaron de la nube (encontrados en otro aparato)
  const guardado = actions.datosMundo();
  for (const id of guardado && Array.isArray(guardado.cristales) ? guardado.cristales : []) {
    if (!M.tiene.has(id) && M.cristales.some((c) => c.id === id)) { M.tiene.add(id); M.vista.quitarCristal(id); }
  }
  // Islas visitadas o conexiones construidas que llegaron de la nube (o del administrador)
  const clave = claveIslas(guardado);
  if (clave !== M.claveIslas) { M.claveIslas = clave; M.vista.actualizarIslas(guardado); }
  const disp = disponibles(guardado, M.red, M.cristales.map((c) => c.id));
  refrescarLibro();
  $("mundoHud").innerHTML = `
    <div class="mundo-hud-izq">${botonCreditos()}${botonNube()}</div>
    <div class="mundo-contadores"><div class="mundo-cristales" title="Cristales encontrados">${ICONO.cristal}<b>${M.tiene.size}</b><span>/ ${M.cristales.length}</span></div>
    <div class="mundo-cristales mundo-estrellas" title="Estrellas del mundo para construir">${ESTRELLA_MUNDO}<b>${disp.estrellas}</b></div>
    ${M.secreto ? `<div class="mundo-cristales mundo-secreto" title="Magia del búho">${ICONO.buho}<b id="mundoReloj">${relojSecreto(M.secreto.hasta, Date.now())}</b></div>` : ""}
    ${M.libros ? `<div class="mundo-cristales mundo-libros" title="Capítulos encontrados">${ICONO.libro}<b>${estadoHoy().tiene.size}</b><span>/ ${M.libros.total}</span></div>` : ""}</div>
    <div class="mundo-hud-der">
      ${tv ? `<span class="mundo-pista" id="mundoPista">${pistaTv()}</span>` : ""}
      ${tv ? "" : `<button class="mundo-menu-btn solo-icono" id="mundoMapaBtn" aria-label="Mapa de las islas" title="Mapa">${ICONO.mapa}</button>`}
      <button class="mundo-menu-btn" id="mundoMenuBtn" aria-label="Menú: ir a un juego">${ICONO.menu}<span>Menú</span></button>
    </div>`;
  $("creditosBtn").onclick = actions.abrirCreditos;
  $("nubeBtn").onclick = actions.abrirNube;
  $("mundoMenuBtn").onclick = () => abrirMenu();
  if ($("mundoMapaBtn")) $("mundoMapaBtn").onclick = () => abrirMenu("mapa");

  // Letreros: uno por juego (se acomodan cada cuadro sobre su edificio)
  const sel = state.materia;
  $("mundoLetreros").innerHTML = M.lugares.map((l) => {
    const j = l.juego, p = state.progreso[j.id];
    const pie = (j.creditos === "gasta" && j.costo ? `<span class="costo">${MONEDA}${j.costo}</span>` : estrellasHtml(p ? p.estrellas : 0)) + estrellasMundoHtml(j, guardado);
    const apagado = sel && j.materia !== sel ? " apagado" : "";
    return `<button class="letrero${apagado}" data-id="${esc(j.id)}" style="--c:${esc(j.color || "#c86bfa")}" tabindex="-1" aria-label="${esc(j.titulo)}">
      <span class="ico">${j.iconoUrl ? `<img src="${esc(j.iconoUrl)}" alt="">` : esc(j.icono)}</span>
      <span class="nombre">${esc(j.titulo)}</span><span class="pie">${pie}</span></button>`;
  }).join("");
  for (const b of $("mundoLetreros").children) b.onclick = () => entrar(b.dataset.id);
  M.vista.resaltar(sel ? new Set(M.lugares.filter((l) => l.juego.materia === sel).map((l) => l.id)) : null);
  dibujarLetreros(true);
  dibujarAviso();
  if (M.menu) dibujarMenu();
}

let ultimoLetreros = 0;
function dibujarLetreros(forzar) {
  const cont = M && M.raiz.querySelector("#mundoLetreros");
  if (!cont || !M.vista) return;
  const ahora = performance.now();
  if (!forzar && ahora - ultimoLetreros < 33) return; // 30 veces por segundo basta (en la TV ahorra trabajo)
  ultimoLetreros = ahora;
  const pos = M.vista.letreros(), items = [];
  for (const el of cont.children) {
    const p = pos.get(el.dataset.id);
    if (!p) continue;
    if (!el._tam) el._tam = { w: el.offsetWidth || 120, h: el.offsetHeight || 90 }; // tamaño sin escalar (no cambia)
    items.push({ id: el.dataset.id, x: p.x, y: p.y, d: p.d, w: el._tam.w, h: el._tam.h });
  }
  if (!M.hudAbajo || forzar) { // dónde termina el HUD (cambia con el tamaño de la pantalla)
    let b = 0;
    for (const h of M.raiz.querySelectorAll(".mundo-hud > *")) b = Math.max(b, h.getBoundingClientRect().bottom);
    M.hudAbajo = b + 4;
  }
  const ver = M.menu ? new Map() : acomodarLetreros(items, { ancho: innerWidth, alto: innerHeight, arriba: M.hudAbajo });
  for (const el of cont.children) {
    const v = ver.get(el.dataset.id), p = pos.get(el.dataset.id);
    if (!v) { el.style.visibility = "hidden"; continue; }
    el.style.visibility = "";
    el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -100%) scale(${v.k.toFixed(3)})`;
    el.style.zIndex = String(100 - Math.round(p.d));
    el.classList.toggle("cerca", !!M.cerca && M.cerca.id === el.dataset.id);
  }
}

// En la TV, arriba: qué hace OK aquí (en la puerta de un juego entra; en cualquier otro lado brinca)
const pistaTv = () => `<kbd>OK</kbd> ${M && M.cerca ? "entrar" : M && M.muelle ? "construir" : M && M.tele ? "viajar" : M && M.junto ? "hablar" : "brincar"} · <kbd>Atrás</kbd> menú`;

function dibujarAviso() {
  const b = M && M.raiz.querySelector("#mundoAviso");
  if (!b) return;
  const p = M.raiz.querySelector("#mundoPista");
  if (p) p.innerHTML = pistaTv();
  const l = M.cerca, mu = !l && M.muelle, te = !l && !mu && M.tele, bu = !l && !mu && !te && M.junto;
  b.hidden = !(l || mu || te || bu) || M.menu;
  b.classList.toggle("construir", !!mu);
  if (b.hidden) return;
  const pista = state.modo === "tv" || document.documentElement.classList.contains("teclado") ? `<kbd>OK</kbd>` : "";
  if (l) {
    b.style.setProperty("--c", l.juego.color || "#c86bfa");
    b.innerHTML = `${pista}<span>Entrar a <b>${esc(l.juego.titulo)}</b></span>`;
  } else if (mu) {
    const k = M.red.porCon.get(mu.id), datos = actions.datosMundo();
    const p = puedeConstruir(datos, M.red, mu.id, M.cristales.map((c) => c.id));
    const destino = M.red.por.get(mu.isla === k.de ? k.a : k.de).nombre;
    b.style.setProperty("--c", k.material === "cristal" ? "#4cb3ff" : "#c9925f");
    if (p.pronto) b.innerHTML = `<span>Hacia <b>${esc(destino)}</b>: muy pronto</span>`;
    else {
      const d = disponibles(datos, M.red, M.cristales.map((c) => c.id));
      const costo = `<span class="costo-puente">${ICONO.cristal}${Math.min(d.cristales, p.costo.cristales)}/${p.costo.cristales} ${ESTRELLA_MUNDO}${Math.min(d.estrellas, p.costo.estrellas)}/${p.costo.estrellas}</span>`;
      b.innerHTML = p.ok ? `<span class="dos">${pista} Construir <b>${esc(NOMBRE_CONEXION(k))}</b></span>${costo}`
        : `<span class="dos">${esc(faltanTexto(p.faltan))}</span>${costo}`;
    }
  } else if (te) {
    b.style.setProperty("--c", "#9b7bff");
    b.innerHTML = `${pista}${ICONO.tele}<span>Viajar con el <b>teletransportador</b></span>`;
  } else {
    b.style.setProperty("--c", "#a0703f");
    b.innerHTML = `${pista}${ICONO.buho}<span>Hablar con el <b>búho</b></span>`;
  }
  dibujarLetreros(true);
}

let toastTimer = null;
function toast(txt) {
  const t = M && M.raiz.querySelector("#mundoToast");
  if (!t) return;
  t.textContent = txt; t.classList.remove("ver"); void t.offsetWidth; t.classList.add("ver");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("ver"), 3200);
}

// ---------- Islas (#164) ----------

/** Lo que cambia las islas que se dibujan (visitadas y construidas) */
const claveIslas = (d) => `${[...d.visitadas].sort().join(",")}|${[...d.conexiones].sort().join(",")}`;

/** En el letrero de un juego educativo: cuántas estrellas del mundo le quedan por dar en Isla Noli */
function estrellasMundoHtml(j, datos) {
  if (j.creditos !== "gana") return "";
  const tope = actions.topeEstrellas, n = estrellasDeJuego(datos, "noli", j.id);
  return `<span class="em${n >= tope ? " completo" : ""}" title="Estrellas del mundo">${ESTRELLA_MUNDO}${n >= tope ? "¡Completo!" : `${n}/${tope}`}</span>`;
}

const NOMBRE_CONEXION = (k) => (k.tipo === "plataformas" ? "el camino de plataformas" : k.material === "cristal" ? "el puente de cristal" : "el puente");

function llegarAIsla(isla) {
  const antes = actions.datosMundo();
  if (antes.visitadas.includes(isla.id)) M.ultimaConocida = isla.id;
  if (M.secreto) { toast(isla.nombre); return; } // modo secreto (#166): no se marca como conocida
  const nueva = !antes.visitadas.includes(isla.id);
  const d = conVisita(antes, isla.id);
  if (d !== antes) { actions.guardarMundo(d); M.claveIslas = claveIslas(actions.datosMundo()); if (nueva) M.vista.actualizarIslas(actions.datosMundo()); }
  if (nueva) toast(`¡Llegaste a ${isla.nombre}!`);
}

/** Construir en el muelle donde está parado (si le alcanza) */
function construirAqui() {
  const mu = M && M.muelle;
  if (!mu) return;
  const k = M.red.porCon.get(mu.id), datos = actions.datosMundo(), validos = M.cristales.map((c) => c.id);
  const p = puedeConstruir(datos, M.red, mu.id, validos);
  if (p.pronto) return toast(`Pronto se podrá construir ${NOMBRE_CONEXION(k)} hacia ${M.red.por.get(mu.isla === k.de ? k.a : k.de).nombre}.`);
  if (!p.ok) return toast(faltanTexto(p.faltan));
  const d = construir(datos, M.red, mu.id, validos);
  actions.guardarMundo(d);
  M.claveIslas = claveIslas(actions.datosMundo());
  M.vista.actualizarIslas(actions.datosMundo(), mu.id);
  M.muelle = null;
  toast(`¡Construiste ${NOMBRE_CONEXION(k)}! Ya puedes ir a ${M.red.por.get(mu.isla === k.de ? k.a : k.de).nombre}.`);
  actualizar();
}

function faltanTexto(f) {
  const partes = [];
  if (f.cristales) partes.push(`${f.cristales} ${f.cristales === 1 ? "cristal" : "cristales"}`);
  if (f.estrellas) partes.push(`${f.estrellas} ${f.estrellas === 1 ? "estrella" : "estrellas"}`);
  return `Te ${f.cristales + f.estrellas === 1 ? "falta" : "faltan"} ${partes.join(" y ")}.${f.estrellas ? " Gana estrellas en los juegos." : " Búscalos brincando en las plataformas."}`;
}

// ---------- El búho y el modo secreto (#166) ----------

function hablarConBuho() {
  if (!M) return;
  M.pregunta = otraPregunta(M.buho.preguntas, M.pregunta);
  M.contesta = ""; M.borrador = "";
  abrirMenu("buho");
}

/** Lo que contestó: la frase secreta abre la magia; cualquier otra cosa, una respuesta simpática y otra pregunta */
function responderBuho(texto) {
  if (!M) return;
  if (!String(texto || "").trim()) return;
  if (esFraseSecreta(texto, M.buho.hash)) {
    activarSecreto();
    M.contesta = "¡Uh, uh! Los puentes mágicos están abiertos.";
  } else {
    const r = M.buho.respuestas;
    M.contesta = r[Math.floor(Math.random() * r.length)];
    M.pregunta = otraPregunta(M.buho.preguntas, M.pregunta);
  }
  dibujarMenu();
}

/** Todas las conexiones por unos minutos, sin guardar nada (solo vive aquí, en memoria) */
function activarSecreto() {
  const m = M;
  if (m.secreto) clearInterval(m.secreto.timer);
  const hasta = Date.now() + m.buho.minutos * 60000;
  const timer = setInterval(() => {
    if (M !== m || !m.secreto) return clearInterval(timer);
    const r = m.raiz.querySelector("#mundoReloj");
    if (r) r.textContent = relojSecreto(m.secreto.hasta, Date.now());
    if (Date.now() >= m.secreto.hasta) terminarSecreto();
  }, 1000);
  m.quitar.push(() => clearInterval(timer));
  m.secreto = { hasta, timer };
  m.vista.secreto(true);
  m.muelle = null;
  actualizar();
}

function terminarSecreto() {
  const m = M;
  if (!m || !m.secreto) return;
  clearInterval(m.secreto.timer);
  m.secreto = null;
  m.vista.secreto(false, m.ultimaConocida);
  toast("La magia del búho se acabó.");
  if (m.menu === "tele" || m.menu === "mapa") dibujarMenu();
  actualizar();
}

function encontrarCristal(c) {
  const n = M.tiene.size, total = M.cristales.length;
  actions.guardarMundo({ ...actions.datosMundo(), cristales: [...new Set([...actions.datosMundo().cristales, ...M.tiene])] });
  toast(n >= total ? "¡Encontraste todos los cristales mágicos!" : `¡Encontraste un cristal! Llevas ${n} de ${total}.`);
  const b = M.raiz.querySelector(".mundo-cristales b");
  if (b) { b.textContent = n; b.parentNode.classList.remove("brilla"); void b.offsetWidth; b.parentNode.classList.add("brilla"); }
}

// ---------- Libros escondidos (#103) ----------

function prepararLibros(mundo, juegos) {
  const L = mundo.libros;
  if (!L || !juegos.some((j) => j.id === L.juego)) return null;
  const pos = librosDe(mundo);
  return { L, pos, total: pos.length };
}

function estadoHoy() {
  const { L, total } = M.libros;
  return estadoLibros(actions.datosDe(L.juego), L.libro, total, dia(Date.now()), L.porDia);
}

function libroQueToca() {
  const e = estadoHoy();
  return e.siguiente ? M.libros.pos.find((p) => p.n === e.siguiente) || null : null;
}

/** Si cambió lo encontrado (llegó de la nube, cambió el día, papás abrieron capítulos), pone el libro que toca */
function refrescarLibro() {
  if (!M.libros || !M.vista || M.menu === "libro") return;
  const quiere = libroQueToca(), hay = M.vista.libro;
  if ((quiere && quiere.n) !== (hay && hay.n)) M.vista.ponerLibro(quiere);
}

function encontrarLibro(l) {
  const { L } = M.libros;
  actions.guardarDatos(L.juego, conHallazgo(actions.datosDe(L.juego), L.libro, l.n, dia(Date.now())));
  M.hallado = l.n;
  const b = M.raiz.querySelector(".mundo-libros b");
  if (b) { b.textContent = estadoHoy().tiene.size; b.parentNode.classList.remove("brilla"); void b.offsetWidth; b.parentNode.classList.add("brilla"); }
  abrirMenu("libro");
}

function leerCapitulo(n) {
  if (!M || !M.libros) return;
  const id = M.libros.L.juego;
  cerrarMenu();
  volverA = id;
  actions.abrir(id, { hash: "#c" + n });
}

function entrar(id) {
  if (!M) return;
  cerrarMenu();
  volverA = id;
  actions.abrir(id);
}

// ---------- Menú del mundo (Atrás o el botón "Menú") ----------

function abrirMenu(tipo = "menu") {
  if (!M || M.estado !== "listo") return;
  M.menu = tipo;
  M.vista.mover({ x: 0, z: 0 });
  dibujarMenu();
  dibujarAviso();
  dibujarLetreros(true);
  focoInicial(M.raiz.querySelector("#mundoMenu"));
}

function cerrarMenu() {
  if (!M || !M.menu) return;
  M.menu = false;
  const el = M.raiz.querySelector("#mundoMenu");
  el.hidden = true; el.innerHTML = "";
  dibujarAviso(); dibujarLetreros(true);
  if (M.libros) refrescarLibro();
}

function dibujarMenu() {
  const el = M.raiz.querySelector("#mundoMenu");
  const enfocado = el.contains(document.activeElement) ? document.activeElement.dataset.k : null;
  el.hidden = false;
  if (M.menu === "lento") {
    el.innerHTML = `<div class="mundo-menu-caja chica">
      <h2 id="mundoMenuTitulo">Este aparato va un poco lento</h2>
      <p>¿Quieres cambiar al menú sencillo? Siempre puedes regresar al mundo desde ahí.</p>
      <div class="fila"><button class="primario" data-foco="inicial" data-k="si" id="mLentoSi">Sí, menú sencillo</button>
      <button class="mundo-boton" data-foco data-k="no" id="mLentoNo">Seguir en el mundo</button></div></div>`;
    el.querySelector("#mLentoSi").onclick = () => actions.ponerVista("2d", { recordar: true });
    el.querySelector("#mLentoNo").onclick = cerrarMenu;
    return;
  }
  if (M.menu === "libro") {
    const e = estadoHoy(), n = M.hallado;
    const sigue = e.completo ? "¡Encontraste todos los capítulos del libro!"
      : e.lleno ? `Por hoy ya encontraste ${M.libros.L.porDia}. ¡Mañana hay otro libro escondido!`
      : "El siguiente capítulo ya está escondido en otro lugar del mundo.";
    el.innerHTML = `<div class="mundo-menu-caja chica mundo-hallazgo">
      <p class="mundo-hallazgo-ico">${ICONO.libro}</p>
      <h2 id="mundoMenuTitulo">¡Encontraste el Capítulo ${n}!</h2>
      <p>Ya lo puedes leer en la Biblioteca. ${esc(sigue)}</p>
      <div class="fila"><button class="primario" data-foco="inicial" data-k="leer" id="mLeer">${ICONO.libro}Leer ahora</button>
      <button class="mundo-boton" data-foco data-k="despues" id="mDespues">Seguir paseando</button></div></div>`;
    el.querySelector("#mLeer").onclick = () => leerCapitulo(n);
    el.querySelector("#mDespues").onclick = cerrarMenu;
    return;
  }
  if (M.menu === "mapa") {
    el.innerHTML = `<div class="mundo-menu-caja mundo-mapa">
      <h2 id="mundoMenuTitulo">${ICONO.mapa}Mapa de las islas</h2>
      ${mapaSvg()}
      <p class="mundo-menu-sub">${M.secreto ? `${ICONO.buho}<span>Magia del búho: se ve todo el mapa (quedan <b>${relojSecreto(M.secreto.hasta, Date.now())}</b>).</span>` : `<span>Las islas que ya visitaste se ven completas; las que tienen <b>?</b> están cerca. ¡Construye puentes para llegar!</span>`}</p>
      <div class="fila"><button class="primario" data-foco="inicial" data-k="cerrar" id="mCerrar">Seguir paseando</button></div></div>`;
    el.querySelector("#mCerrar").onclick = cerrarMenu;
    el.onclick = (e) => { if (e.target === el) cerrarMenu(); };
    return;
  }
  if (M.menu === "buho") {
    const sec = M.secreto;
    el.innerHTML = `<div class="mundo-menu-caja chica mundo-buho">
      <p class="mundo-hallazgo-ico">${ICONO.buho}</p>
      ${M.contesta ? `<p class="buho-dice">${esc(M.contesta)}</p>` : ""}
      <h2 id="mundoMenuTitulo">${esc(M.pregunta)}</h2>
      <form id="mBuhoForm" class="buho-form" autocomplete="off">
        <input id="mBuhoTexto" type="text" data-foco="inicial" data-k="texto" maxlength="60" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Tu respuesta" placeholder="Escribe aquí">
        <button class="primario" data-foco data-k="responder" type="submit">Responder</button>
      </form>
      ${sec ? `<p class="mundo-menu-sub"><span>Magia del búho: quedan <b>${relojSecreto(sec.hasta, Date.now())}</b>.</span></p>` : ""}
      <div class="fila">
        ${sec ? `<button class="mundo-boton" data-foco data-k="terminar" id="mBuhoFin">Terminar la magia</button>` : ""}
        <button class="mundo-boton" data-foco data-k="adios" id="mCerrar">Adiós, búho</button>
      </div></div>`;
    const f = el.querySelector("#mBuhoForm"), campo = f.querySelector("#mBuhoTexto");
    campo.value = M.borrador || ""; // si se vuelve a dibujar mientras escribe, no se pierde lo escrito
    campo.oninput = () => { M.borrador = campo.value; };
    f.onsubmit = (e) => { e.preventDefault(); const t = campo.value; M.borrador = ""; responderBuho(t); };
    if (sec) el.querySelector("#mBuhoFin").onclick = () => { terminarSecreto(); cerrarMenu(); };
    el.querySelector("#mCerrar").onclick = cerrarMenu;
    el.onclick = (e) => { if (e.target === el) cerrarMenu(); };
    const b = el.querySelector(`[data-k="${enfocado || "texto"}"]`);
    if (b) b.focus();
    return;
  }
  if (M.menu === "tele") {
    const datos = actions.datosMundo(), aqui = M.vista.isla;
    const destinos = M.red.islas.filter((i) => (M.secreto || datos.visitadas.includes(i.id)) && i.id !== aqui);
    el.innerHTML = `<div class="mundo-menu-caja chica">
      <h2 id="mundoMenuTitulo">${ICONO.tele}¿A qué isla viajamos?</h2>
      ${destinos.length ? `<div class="mundo-ir mundo-islas">${destinos.map((i, n) => `<button class="ir" data-isla="${esc(i.id)}" data-k="isla-${esc(i.id)}" ${n === 0 ? 'data-foco="inicial"' : "data-foco"} style="--c:#9b7bff">
        <span class="ico isla-ico" style="background:${esc(i.colores.suelo)}"></span><span class="nombre">${esc(i.nombre)}</span></button>`).join("")}</div>`
        : `<p>Todavía no visitas otras islas. ¡Construye un puente para llegar a una!</p>`}
      <div class="fila"><button class="${destinos.length ? "mundo-boton" : "primario"}" data-foco${destinos.length ? "" : '="inicial"'} data-k="cerrar" id="mCerrar">Quedarme aquí</button></div></div>`;
    for (const b of el.querySelectorAll("[data-isla]")) b.onclick = () => { const id = b.dataset.isla; cerrarMenu(); M.vista.teletransportar(id); toast(`¡Bienvenida a ${M.red.por.get(id).nombre}!`); };
    el.querySelector("#mCerrar").onclick = cerrarMenu;
    el.onclick = (e) => { if (e.target === el) cerrarMenu(); };
    return;
  }
  const mats = materias(M.lugares.map((l) => l.juego));
  const tv = state.modo === "tv";
  el.innerHTML = `<div class="mundo-menu-caja">
    <h2 id="mundoMenuTitulo">¿A dónde vamos?</h2>
    <div class="mundo-ir">${M.lugares.map((l, i) => {
      const j = l.juego, p = state.progreso[j.id];
      const apagado = state.materia && j.materia !== state.materia ? " apagado" : "";
      return `<button class="ir${apagado}" data-ira="${esc(j.id)}" data-k="ir-${esc(j.id)}" ${i === 0 ? 'data-foco="inicial"' : "data-foco"} style="--c:${esc(j.color || "#c86bfa")}">
        <span class="ico">${j.iconoUrl ? `<img src="${esc(j.iconoUrl)}" alt="">` : esc(j.icono)}</span>
        <span class="nombre">${esc(j.titulo)}</span>
        <span class="pie">${j.creditos === "gasta" && j.costo ? `<span class="costo">${MONEDA}${j.costo}</span>` : estrellasHtml(p ? p.estrellas : 0)}</span></button>`;
    }).join("")}</div>
    ${mats.length > 1 ? `<p class="mundo-menu-sub">Brillan los juegos de:</p><nav class="chips mundo-chips" aria-label="Materias">
      ${[null, ...mats].map((m) => `<button class="chip${m === state.materia ? " sel" : ""}" data-foco data-k="mat-${esc(m || "")}" data-materia="${esc(m || "")}" aria-pressed="${m === state.materia}">${esc(nombreMateria(m))}</button>`).join("")}
    </nav>` : ""}
    ${M.libros ? (() => { const e = estadoHoy(); return `<p class="mundo-menu-sub">${ICONO.libro}<span>Capítulos del libro: <b>${e.tiene.size} de ${M.libros.total}</b>. ${e.completo ? "¡Los encontraste todos!" : e.lleno ? "Mañana hay otro escondido." : "Hay uno escondido en el mundo: búscalo."}</span></p>`; })() : ""}
    <p class="mundo-menu-sub">${ICONO.cristal}<span>Cristales mágicos: <b>${M.tiene.size} de ${M.cristales.length}</b>. ${M.tiene.size < M.cristales.length ? "Búscalos brincando en las plataformas." : "¡Los encontraste todos!"}</span></p>
    ${(() => { const d = disponibles(actions.datosMundo(), M.red, M.cristales.map((c) => c.id)); return `<p class="mundo-menu-sub">${ESTRELLA_MUNDO}<span>Para construir puentes tienes <b>${d.cristales} ${d.cristales === 1 ? "cristal" : "cristales"}</b> y <b>${d.estrellas} ${d.estrellas === 1 ? "estrella" : "estrellas"} del mundo</b>. Las estrellas se ganan en los juegos (hasta ${actions.topeEstrellas} en cada uno).</span></p>`; })()}
    <div class="fila">
      <button class="mundo-boton" data-foco data-k="mapa" id="mMapa">${ICONO.mapa}Mapa</button>
      <button class="mundo-boton" data-foco data-k="creditos" id="mCreditos">${MONEDA}Créditos</button>
      <button class="mundo-boton" data-foco data-k="nube" id="mNube">Nube</button>
      ${tv ? chipRemoto().replace('class="chip remoto', 'data-foco data-k="remoto" class="chip remoto') : ""}
      <button class="mundo-boton" data-foco data-k="sencillo" id="mSencillo">${ICONO.sencillo}Menú sencillo</button>
      <button class="primario" data-foco data-k="cerrar" id="mCerrar">Seguir paseando</button>
    </div></div>`;
  for (const b of el.querySelectorAll("[data-ira]")) b.onclick = () => { const id = b.dataset.ira; cerrarMenu(); M.vista.irA(id); };
  el.querySelector("#mMapa").onclick = () => abrirMenu("mapa");
  for (const b of el.querySelectorAll("[data-materia]")) b.onclick = () => actions.elegirMateria(b.dataset.materia || null);
  el.querySelector("#mCreditos").onclick = actions.abrirCreditos;
  el.querySelector("#mNube").onclick = actions.abrirNube;
  el.querySelector("#mSencillo").onclick = () => actions.ponerVista("2d", { recordar: true });
  el.querySelector("#mCerrar").onclick = cerrarMenu;
  el.onclick = (e) => { if (e.target === el) cerrarMenu(); };
  instalarChipRemoto(el);
  if (enfocado) { const b = el.querySelector(`[data-k="${enfocado}"]`); if (b) b.focus(); }
}

/** El mapa (#164): lo visitado completo, lo vecino como silueta con «?», lo demás tapado por nubes. Con el dibujo de
 *  Petra (#165, islas.json → mapa) las nubes y los «?» van encima del dibujo; sin él, un mapa hecho en código.
 *  Arriba = hacia el fondo del mundo (−z), como en el juego. */
function mapaSvg() {
  const red = M.red, v = vistaMapa(red, actions.datosMundo(), { todo: !!M.secreto });
  const ilustrado = mapaIlustrado(red, v);
  if (ilustrado) return ilustrado;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const i of red.islas) {
    const f = i.f, a = f.tipo === "caja" ? [f.x0, f.x1, f.z0, f.z1] : [f.x - f.r, f.x + f.r, f.z - f.r, f.z + f.r];
    x0 = Math.min(x0, a[0]); x1 = Math.max(x1, a[1]); z0 = Math.min(z0, a[2]); z1 = Math.max(z1, a[3]);
  }
  const m = 14; x0 -= m; x1 += m; z0 -= m; z1 += m;
  const n = (x) => x.toFixed(1);
  const lineas = red.conexiones.map((k) => {
    const e = v.conexiones[k.id];
    if (e === "oculta") return "";
    const estilo = e === "hecha" ? (k.tipo === "puente" ? `stroke="${k.material === "cristal" ? "#4cb3ff" : "#a7744a"}" stroke-width="3.2"` : `stroke="#7a62c9" stroke-width="3" stroke-dasharray="1 3.2" stroke-linecap="round"`)
      : `stroke="#ffffff" stroke-width="1.6" stroke-dasharray="3 3" opacity="0.8"`;
    return `<line x1="${n(k.p0.x)}" y1="${n(k.p0.z)}" x2="${n(k.p1.x)}" y2="${n(k.p1.z)}" ${estilo}/>`;
  }).join("");
  const nombres = [];
  const islas = red.islas.map((i) => {
    const e = v.islas[i.id], f = i.f, c = i.c;
    const forma = (fill, extra = "") => f.tipo === "caja"
      ? `<rect x="${n(f.x0)}" y="${n(f.z0)}" width="${n(f.x1 - f.x0)}" height="${n(f.z1 - f.z0)}" rx="8" fill="${fill}" ${extra}/>`
      : `<circle cx="${n(f.x)}" cy="${n(f.z)}" r="${n(f.r)}" fill="${fill}" ${extra}/>`;
    if (e === "visitada") return `<g class="isla">${forma(i.colores.orilla || "#e9d9b4")}${f.tipo === "caja" ? `<rect x="${n(f.x0 + 2)}" y="${n(f.z0 + 2)}" width="${n(f.x1 - f.x0 - 4)}" height="${n(f.z1 - f.z0 - 4)}" rx="7" fill="${i.colores.suelo}"/>` : `<circle cx="${n(f.x)}" cy="${n(f.z)}" r="${n(f.r - 2)}" fill="${i.colores.suelo}"/>`}</g>${void nombres.push(`<text x="${n(c.x)}" y="${n(f.tipo === "caja" ? c.z + 3 : f.z + f.r + 9)}" text-anchor="middle" font-size="8.5" class="nombre-isla">${esc(i.nombre)}</text>`) || ""}`;
    if (e === "vista") return `<g class="isla vista">${forma("#c9d3e6", 'opacity="0.85" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="3 2"')}
      <text x="${n(c.x)}" y="${n(c.z + 8)}" text-anchor="middle" font-size="22" class="interroga">?</text></g>`;
    const r = f.tipo === "caja" ? 20 : f.r;
    return `<g class="nube-mapa"><ellipse cx="${n(c.x - r * 0.35)}" cy="${n(c.z + 2)}" rx="${n(r * 0.75)}" ry="${n(r * 0.55)}"/><ellipse cx="${n(c.x + r * 0.4)}" cy="${n(c.z + 4)}" rx="${n(r * 0.7)}" ry="${n(r * 0.5)}"/><ellipse cx="${n(c.x)}" cy="${n(c.z - 6)}" rx="${n(r * 0.6)}" ry="${n(r * 0.5)}"/></g>`;
  }).join("");
  const p = M.vista.pos;
  return `<svg class="mapa-svg" viewBox="${n(x0)} ${n(z0)} ${n(x1 - x0)} ${n(z1 - z0)}" role="img" aria-label="Mapa de las islas">
    <rect x="${n(x0)}" y="${n(z0)}" width="${n(x1 - x0)}" height="${n(z1 - z0)}" rx="14" fill="#8fd3f4"/>
    ${lineas}${islas}${nombres.join("")}
    <g class="aqui" transform="translate(${n(p.x)} ${n(p.z)})"><circle r="5.5" fill="#ff4f6d" stroke="#ffffff" stroke-width="2"/><circle r="1.8" fill="#ffffff"/></g>
  </svg>`;
}

/** El mapa con el dibujo de Petra; null si islas.json no lo trae (o le falta el lugar de alguna isla) */
function mapaIlustrado(red, v) {
  const A = red.cfg.mapa, aqui = M.vista.pos, p = puntoMapa(red, aqui.x, aqui.z);
  if (!A || !A.imagen || !p) return null;
  const W = A.ancho, H = A.alto, rx = A.r * W, ry = rx * 0.62, n = (x) => x.toFixed(1);
  const pos = (i) => ({ x: i.mapa.u * W, y: i.mapa.v * H });
  const lineas = red.conexiones.map((k) => {
    const e = v.conexiones[k.id];
    if (e === "oculta") return "";
    const a = pos(red.por.get(k.de)), b = pos(red.por.get(k.a));
    const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
    // De orilla a orilla del dibujo (no del centro: no se pinta sobre las islas)
    const ka = Math.min(0.45, 1 / Math.hypot(dx / l / rx, dy / l / ry) / l * 0.9), kb = 1 - ka;
    const estilo = e === "hecha" ? (k.tipo === "puente" ? `stroke="${k.material === "cristal" ? "#2f9be0" : "#8a5a36"}" stroke-width="9" stroke-linecap="round"` : `stroke="#6a4fc4" stroke-width="9" stroke-dasharray="1 14" stroke-linecap="round"`)
      : `stroke="#ffffff" stroke-width="5" stroke-dasharray="14 12" opacity="0.9"`;
    return `<line x1="${n(a.x + dx * ka)}" y1="${n(a.y + dy * ka)}" x2="${n(a.x + dx * kb)}" y2="${n(a.y + dy * kb)}" ${estilo}/>`;
  }).join("");
  let encima = "", nombres = "";
  for (const i of red.islas) {
    const e = v.islas[i.id], c = pos(i);
    if (e === "visitada") nombres += `<text x="${n(c.x)}" y="${n(c.y + ry + 34)}" text-anchor="middle" font-size="34" class="nombre-isla">${esc(i.nombre)}</text>`;
    else if (e === "vista") encima += `<ellipse cx="${n(c.x)}" cy="${n(c.y)}" rx="${n(rx * 1.05)}" ry="${n(ry * 1.15)}" fill="#ffffff" opacity="0.62"/>
      <text x="${n(c.x)}" y="${n(c.y + 34)}" text-anchor="middle" font-size="96" class="interroga">?</text>`;
    else encima += `<g class="nube-mapa"><ellipse cx="${n(c.x - rx * 0.5)}" cy="${n(c.y + ry * 0.2)}" rx="${n(rx * 0.85)}" ry="${n(ry * 1.05)}"/><ellipse cx="${n(c.x + rx * 0.5)}" cy="${n(c.y + ry * 0.25)}" rx="${n(rx * 0.85)}" ry="${n(ry * 1.0)}"/><ellipse cx="${n(c.x)}" cy="${n(c.y - ry * 0.55)}" rx="${n(rx * 0.9)}" ry="${n(ry * 1.05)}"/><ellipse cx="${n(c.x)}" cy="${n(c.y + ry * 0.6)}" rx="${n(rx * 1.05)}" ry="${n(ry * 0.8)}"/></g>`;
  }
  const src = new URL(A.imagen, BASE_MUNDO).href;
  return `<svg class="mapa-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Mapa de las islas">
    <image href="${esc(src)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>
    ${encima}${lineas}${nombres}
    <g class="aqui" transform="translate(${n(p.u * W)} ${n(p.v * H)})"><circle r="20" fill="#ff4f6d" stroke="#ffffff" stroke-width="7"/><circle r="7" fill="#ffffff"/></g>
  </svg>`;
}

// ---------- Entrada: teclado, control de la TV y teléfono como control ----------

/** Una acción del control (ver ui/entrada.js). */
export function accionMundo(accion) {
  if (!M || M.estado !== "listo") {
    if (accion === "ok" && M) { const b = M.raiz.querySelector("#mundoCargaSencillo"); if (b && document.activeElement === b) b.click(); }
    return;
  }
  if (M.menu) {
    const caja = M.raiz.querySelector("#mundoMenu");
    if (accion === "atras") return cerrarMenu();
    if (moverFoco(accion, caja)) return;
    const a = document.activeElement;
    if (accion === "ok" && a && a.tagName === "INPUT" && a.form) a.form.requestSubmit();
    else if (accion === "ok" && caja.contains(a)) a.click();
    else if (accion === "ok") focoInicial(caja);
    return;
  }
  if (FLECHAS.includes(accion)) {
    // Cada flecha empuja un ratito; si llega repetida (tecla mantenida o teléfono remoto) sigue caminando
    const ahora = performance.now(), antes = M.teclas.hasta[accion] || 0;
    const impulso = (M.mundo.movimiento && M.mundo.movimiento.impulsoTeclaMs) || 200;
    M.teclas.hasta[accion] = Math.max(antes, ahora + (antes > ahora ? impulso : 450));
    return;
  }
  if (accion === "atras") return abrirMenu();
  if (accion === "ok" && M.cerca) return entrar(M.cerca.id);
  if (accion === "ok" && M.muelle) return construirAqui();
  if (accion === "ok" && M.tele) return abrirMenu("tele");
  if (accion === "ok" && M.junto) return hablarConBuho();
  if (accion === "ok" || accion === "brincar") { if (pulsar(performance.now())) M.vista.brincar(); }
}
