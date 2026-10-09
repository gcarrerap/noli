// El menú principal en 3D (#25): un mundo mágico donde Noelia camina (y brinca) hasta el lugar de cada juego.
// Esta pantalla arma el mundo (datos + escena 3D, que se baja con import() solo aquí), dibuja lo que va encima del
// lienzo (créditos, nube, cristales, letreros, aviso de "entrar", joystick, botón de brincar, menú) y convierte la
// entrada (dedo, teclado, control de la TV, teléfono como control) en movimiento.
//
// Vive fuera de #app (en <div id="mundo">) para que el juego abierto (iframe en #app) quede encima sin destruir el
// mundo: en el teléfono el mundo solo se pausa; en la TV se libera (poca memoria) y se vuelve a armar al regresar.
// Si algo falla al armarlo, la app regresa al menú 2D (nunca pantalla en blanco). Ver docs/MUNDO.md.
import { state, actions } from "../../app/index.js";
import { cargarMundo } from "../../services/index.js";
import { revisarMundo, colocarLugares, decorar, todosLosSitios, mapaMundo, fisicaDe, crearCaminos, cristalesDe, materias,
  jugableEn, acomodarLetreros } from "../../engine/index.js";
import { crearJoystick } from "../../../kit/3d/joystick.js";
import { direccionDeTeclas, crearPulsador } from "../../../kit/3d/movimiento.js";
import { moverFoco, focoInicial } from "../../../kit/foco.js";
import { teclaAAccion } from "../../../kit/teclas.js";
import { botonCreditos, MONEDA } from "../components/creditos.js";
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
  brincar: `<svg viewBox="0 0 24 24" width="1.7em" height="1.7em" aria-hidden="true"><path d="M12 3 4.5 12h4.6v8.5h5.8V12h4.6z" fill="currentColor"/></svg>`,
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
      const errores = revisarMundo(datos.mundo, datos.lugares);
      if (errores.length) throw new Error("mundo/: " + errores.join("; "));
      cache = { ...datos, mod };
    }
    if (M !== m) return; // lo quitaron mientras cargaba
    const { mundo, lugares: L, mod } = cache;
    const juegos = state.juegos.filter((j) => jugableEn(j, state.modo));
    const lugares = colocarLugares(juegos, L);
    const deco = decorar(mundo, todosLosSitios(L));
    const cfg = fisicaDe(mundo);
    const mapa = mapaMundo(mundo, lugares, deco);
    const caminos = crearCaminos(mundo, lugares, mapa, cfg);
    const cristales = cristalesDe(mundo);
    const guardado = actions.datosMundo();
    const tiene = new Set(guardado && Array.isArray(guardado.cristales) ? guardado.cristales.filter((id) => cristales.some((c) => c.id === id)) : []);
    const reducir = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    Object.assign(m, { mundo, lugares, cristales, tiene, cfg });
    m.vista = mod.crearVistaMundo(m.raiz.querySelector("#mundoLienzo"), { mundo, lugares, deco, mapa, caminos, cfg, cristales }, {
      tv: state.modo === "tv", reducir, tiene, desde: volverA,
      alLugar: (l) => { m.cerca = l; dibujarAviso(); },
      alCristal: encontrarCristal,
      alBajarMucho: () => { if (!m.preguntoLento && !parametros.has("sinaviso")) { m.preguntoLento = true; abrirMenu("lento"); } },
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
  $("mundoAviso").onclick = () => { if (m.cerca) entrar(m.cerca.id); };

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
      if (Math.hypot(m.joy.x, m.joy.z) > 0.05) dir = m.joy;
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
  $("mundoHud").innerHTML = `
    <div class="mundo-hud-izq">${botonCreditos()}${botonNube()}</div>
    <div class="mundo-cristales" title="Cristales encontrados">${ICONO.cristal}<b>${M.tiene.size}</b><span>/ ${M.cristales.length}</span></div>
    <div class="mundo-hud-der">
      ${tv ? `<span class="mundo-pista" id="mundoPista">${pistaTv()}</span>` : ""}
      <button class="mundo-menu-btn" id="mundoMenuBtn" aria-label="Menú: ir a un juego">${ICONO.menu}<span>Menú</span></button>
    </div>`;
  $("creditosBtn").onclick = actions.abrirCreditos;
  $("nubeBtn").onclick = actions.abrirNube;
  $("mundoMenuBtn").onclick = () => abrirMenu();

  // Letreros: uno por juego (se acomodan cada cuadro sobre su edificio)
  const sel = state.materia;
  $("mundoLetreros").innerHTML = M.lugares.map((l) => {
    const j = l.juego, p = state.progreso[j.id];
    const pie = j.creditos === "gasta" && j.costo ? `<span class="costo">${MONEDA}${j.costo}</span>` : estrellasHtml(p ? p.estrellas : 0);
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
const pistaTv = () => `<kbd>OK</kbd> ${M && M.cerca ? "entrar" : "brincar"} · <kbd>Atrás</kbd> menú`;

function dibujarAviso() {
  const b = M && M.raiz.querySelector("#mundoAviso");
  if (!b) return;
  const p = M.raiz.querySelector("#mundoPista");
  if (p) p.innerHTML = pistaTv();
  const l = M.cerca;
  b.hidden = !l || M.menu;
  if (!l) return;
  const pista = state.modo === "tv" || document.documentElement.classList.contains("teclado") ? `<kbd>OK</kbd>` : "";
  b.style.setProperty("--c", l.juego.color || "#c86bfa");
  b.innerHTML = `${pista}<span>Entrar a <b>${esc(l.juego.titulo)}</b></span>`;
  dibujarLetreros(true);
}

let toastTimer = null;
function toast(txt) {
  const t = M && M.raiz.querySelector("#mundoToast");
  if (!t) return;
  t.textContent = txt; t.classList.remove("ver"); void t.offsetWidth; t.classList.add("ver");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("ver"), 3200);
}

function encontrarCristal(c) {
  const n = M.tiene.size, total = M.cristales.length;
  actions.guardarMundo({ v: 1, cristales: [...M.tiene] });
  toast(n >= total ? "¡Encontraste todos los cristales mágicos!" : `¡Encontraste un cristal! Llevas ${n} de ${total}.`);
  const b = M.raiz.querySelector(".mundo-cristales b");
  if (b) { b.textContent = n; b.parentNode.classList.remove("brilla"); void b.offsetWidth; b.parentNode.classList.add("brilla"); }
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
    <p class="mundo-menu-sub">${ICONO.cristal}<span>Cristales mágicos: <b>${M.tiene.size} de ${M.cristales.length}</b>. ${M.tiene.size < M.cristales.length ? "Búscalos brincando en las plataformas." : "¡Los encontraste todos!"}</span></p>
    <div class="fila">
      <button class="mundo-boton" data-foco data-k="creditos" id="mCreditos">${MONEDA}Créditos</button>
      <button class="mundo-boton" data-foco data-k="nube" id="mNube">Nube</button>
      ${tv ? chipRemoto().replace('class="chip remoto', 'data-foco data-k="remoto" class="chip remoto') : ""}
      <button class="mundo-boton" data-foco data-k="sencillo" id="mSencillo">${ICONO.sencillo}Menú sencillo</button>
      <button class="primario" data-foco data-k="cerrar" id="mCerrar">Seguir paseando</button>
    </div></div>`;
  for (const b of el.querySelectorAll("[data-ira]")) b.onclick = () => { const id = b.dataset.ira; cerrarMenu(); M.vista.irA(id); };
  for (const b of el.querySelectorAll("[data-materia]")) b.onclick = () => actions.elegirMateria(b.dataset.materia || null);
  el.querySelector("#mCreditos").onclick = actions.abrirCreditos;
  el.querySelector("#mNube").onclick = actions.abrirNube;
  el.querySelector("#mSencillo").onclick = () => actions.ponerVista("2d", { recordar: true });
  el.querySelector("#mCerrar").onclick = cerrarMenu;
  el.onclick = (e) => { if (e.target === el) cerrarMenu(); };
  instalarChipRemoto(el);
  if (enfocado) { const b = el.querySelector(`[data-k="${enfocado}"]`); if (b) b.focus(); }
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
    if (accion === "ok" && caja.contains(document.activeElement)) document.activeElement.click();
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
  if (accion === "ok" || accion === "brincar") { if (pulsar(performance.now())) M.vista.brincar(); }
}
