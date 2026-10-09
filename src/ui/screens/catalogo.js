// Pantalla del catálogo: saludo, filtros por materia y una tarjeta por juego.
// Se maneja con el dedo o con flechas/OK (teclado, control de la TV). Las flechas dentro de la cuadrícula las
// resuelve la app (actions.entrada); esta pantalla solo se encarga de pasar entre filtros y cuadrícula.
import { state, actions, visibles } from "../../app/index.js";
import { materias, jugableEn } from "../../engine/index.js";
import { esc } from "../dom.js";
import { nombreMateria, estrellasHtml } from "../labels.js";
import { botonNube } from "../components/nube.js";
import { botonCreditos, MONEDA } from "../components/creditos.js";
import { chipRemoto, instalarChipRemoto } from "../components/remoto.js";
import { hayWebGL } from "../../../kit/3d/webgl.js";

// Botón para ir al mundo 3D (#25), al principio de los filtros. Solo si el aparato tiene WebGL.
const MUNDO = `<svg viewBox="0 0 24 24" width="1.2em" height="1.2em" aria-hidden="true"><path d="M3 20.5h18" stroke="#2b2236" stroke-width="1.6" stroke-linecap="round"/><path d="M6.5 20.5V11L9 7.5l2.5 3.5v9.5z" fill="#ffe08a" stroke="#2b2236" stroke-width="1.4" stroke-linejoin="round"/><path d="M9 7.5V3.5l2.4 1-2.4 1" fill="#ff6b4a" stroke="#2b2236" stroke-width="1.1" stroke-linejoin="round"/><circle cx="16.5" cy="12" r="3.6" fill="#6fd6a8" stroke="#2b2236" stroke-width="1.4"/><path d="M16.5 15.6v4.9" stroke="#2b2236" stroke-width="1.6"/><path d="m19.5 4.5.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" fill="#c86bfa"/></svg>`;
let webgl = null;
const puedeMundo = () => (webgl === null ? (webgl = hayWebGL()) : webgl);

const LETRAS = ["N", "o", "l", "i"];

export function renderCatalogo(app) {
  const lista = visibles();
  const mats = materias(state.juegos.filter((j) => jugableEn(j, state.modo)));
  const tv = state.modo === "tv"; // en la TV, al final de los filtros va el botón del control remoto (issue #3)
  const mundo = puedeMundo();
  app.innerHTML = `
    <header class="cabeza">
      ${botonCreditos()}
      ${botonNube()}
      <h1 class="marca" aria-label="Noli">${LETRAS.map((l, i) => `<span class="l${i}">${l}</span>`).join("")}</h1>
      <p class="saludo">¡Hola, Noelia! ¿A qué jugamos hoy?</p>
    </header>
    ${mats.length > 1 || tv || mundo ? `<nav class="chips" aria-label="Materias">
      ${mundo ? `<button class="chip chip-mundo" id="chip-mundo">${MUNDO}Mundo mágico</button>` : ""}
      ${(mats.length > 1 ? [null, ...mats] : []).map((m) => `<button class="chip${m === state.materia ? " sel" : ""}" data-materia="${esc(m || "")}" aria-pressed="${m === state.materia}">
        ${esc(nombreMateria(m))}</button>`).join("")}
      ${tv ? chipRemoto() : ""}
    </nav>` : ""}
    <main class="rejilla" id="rejilla">
      ${state.cargando ? `<p class="vacio">Cargando juegos…</p>`
        : !lista.length ? `<p class="vacio">Todavía no hay juegos aquí.<br><small>Se agregan en <code>minijuegos/</code>.</small></p>`
        : lista.map((j, i) => tarjeta(j, i)).join("")}
    </main>`;

  app.querySelector("#nubeBtn").onclick = actions.abrirNube;
  app.querySelector("#creditosBtn").onclick = actions.abrirCreditos;
  for (const b of app.querySelectorAll(".chip[data-materia]")) b.onclick = () => actions.elegirMateria(b.dataset.materia || null);
  for (const t of app.querySelectorAll(".tarjeta")) {
    t.onclick = () => actions.abrir(t.dataset.id);
    t.onfocus = () => actions.enfocar(+t.dataset.i);
  }
  instalarChipRemoto(app);
  const bm = app.querySelector("#chip-mundo");
  if (bm) bm.onclick = () => actions.ponerVista("mundo", { recordar: true });
  medirColumnas();
}

function tarjeta(j, i) {
  const p = state.progreso[j.id];
  const color = j.color ? ` style="--c:${esc(j.color)}"` : "";
  return `<button class="tarjeta${i === state.foco ? " foco" : ""}" data-id="${esc(j.id)}" data-i="${i}"${color}
      tabindex="${i === state.foco ? 0 : -1}" aria-label="${esc(j.titulo)}">
    <span class="icono" aria-hidden="true">${j.iconoUrl ? `<img src="${esc(j.iconoUrl)}" alt="">` : esc(j.icono)}</span>
    <span class="titulo">${esc(j.titulo)}</span>
    ${j.descripcion ? `<span class="desc">${esc(j.descripcion)}</span>` : ""}
    <span class="pie">${j.creditos === "gasta" && j.costo ? `<span class="costo">${MONEDA}${j.costo}</span>` : estrellasHtml(p ? p.estrellas : 0)}</span>
  </button>`;
}

// Columnas reales de la cuadrícula (dependen del ancho de la pantalla), para que "abajo" baje una fila
export function medirColumnas() {
  const r = document.getElementById("rejilla");
  if (!r) return;
  const cols = getComputedStyle(r).gridTemplateColumns.split(" ").filter(Boolean).length;
  state.cols = Math.max(1, cols || 1);
}

// Solo cambió el foco: mover la marca sin redibujar todo
export function moverFoco(conTeclado) {
  const ts = document.querySelectorAll(".tarjeta");
  ts.forEach((t, i) => { const f = i === state.foco; t.classList.toggle("foco", f); t.tabIndex = f ? 0 : -1; });
  const t = ts[state.foco];
  if (t && conTeclado && document.activeElement !== t) t.focus();
  if (t && conTeclado) t.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

// Teclas cuando el foco está en los filtros: izquierda/derecha entre filtros, abajo a la cuadrícula
export function teclaEnFiltros(accion, el) {
  const chips = [...document.querySelectorAll(".chips .chip")];
  const i = chips.indexOf(el);
  if (accion === "arriba") { document.getElementById("nubeBtn")?.focus(); return true; }
  if (accion === "izquierda" && i > 0) chips[i - 1].focus();
  else if (accion === "derecha" && i < chips.length - 1) chips[i + 1].focus();
  else if (accion === "ok") el.click();
  else if (accion === "abajo") enfocarTarjeta();
  return true;
}

export function enfocarTarjeta() {
  const t = document.querySelectorAll(".tarjeta")[state.foco];
  if (t) t.focus();
  return !!t;
}

export function enfocarFiltros() {
  const c = document.querySelector(".chips .chip.sel") || document.querySelector(".chips .chip");
  if (c) { c.focus(); return true; }
  return false;
}
