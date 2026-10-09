// Créditos (#20): la pastilla con el saldo en el catálogo (arriba a la izquierda) y la ventana con el saldo, cómo se
// ganan, en qué se gastan, el historial y, para papás, regalar o quitar créditos.
// Vive fuera de #app (en #modalCreditos) para no redibujar el catálogo. Se maneja con el dedo o con flechas
// (kit/foco.js). Sin emojis (#5): la moneda es SVG.
import { state, actions, saldoActual } from "../../app/index.js";
import { REGLAS, MOTIVOS, ganadoHoy, historial } from "../../engine/index.js";
import { esc } from "../dom.js";
import { focoInicial } from "../../../kit/foco.js";

/** Moneda de Noli (SVG): estrella sobre círculo dorado. */
export const MONEDA = `<svg class="moneda" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#ffc43d" stroke="#2b2236" stroke-width="1.6"/><circle cx="12" cy="12" r="7.2" fill="none" stroke="#e0a100" stroke-width="1.2"/><path d="M12 6.8l1.5 3.1 3.4.4-2.5 2.3.7 3.4-3.1-1.7-3.1 1.7.7-3.4-2.5-2.3 3.4-.4z" fill="#fff4cc" stroke="#e0a100" stroke-width=".8" stroke-linejoin="round"/></svg>`;

/** La pastilla del catálogo con el saldo. */
export function botonCreditos() {
  const s = saldoActual();
  return `<button class="creditos-btn" id="creditosBtn" aria-label="${s} créditos" title="Créditos">${MONEDA}<b>${s}</b></button>`;
}

// Estado propio de la ventana (no es del juego ni se guarda): la pregunta para papás
let papas = { abierto: false, ok: false, pregunta: null, error: "" };
const nuevaPregunta = () => {
  const a = 6 + Math.floor(Math.random() * 4), b = 6 + Math.floor(Math.random() * 4), r = a * b;
  const opciones = [r, r + a, r - b].sort(() => Math.random() - 0.5);
  return { a, b, r, opciones };
};

let dibujado = "";
/** Dibuja (o quita) la ventana según state.creditosAbierto. */
export function renderCreditos() {
  const cont = document.getElementById("modalCreditos");
  if (!cont) return;
  if (!state.creditosAbierto) {
    if (cont.innerHTML) { cont.innerHTML = ""; dibujado = ""; }
    papas = { abierto: false, ok: false, pregunta: null, error: "" };
    return;
  }
  const html = ventana();
  if (html === dibujado) return;
  const habiaFoco = cont.contains(document.activeElement) ? document.activeElement.id : null;
  dibujado = html;
  cont.innerHTML = html;
  const on = (s, fn) => { const e = cont.querySelector(s); if (e) e.onclick = fn; };
  on("#creditosCerrar", actions.cerrarCreditos);
  on(".fondo", (e) => { if (e.target === e.currentTarget) actions.cerrarCreditos(); });
  on("#papasAbrir", () => { papas = { abierto: true, ok: false, pregunta: nuevaPregunta(), error: "" }; renderCreditos(); });
  for (const b of cont.querySelectorAll("[data-respuesta]")) b.onclick = () => {
    if (+b.dataset.respuesta === papas.pregunta.r) papas = { ...papas, ok: true, error: "" };
    else papas = { ...papas, pregunta: nuevaPregunta(), error: "Esa no es. Intenta otra vez." };
    renderCreditos();
  };
  for (const b of cont.querySelectorAll("[data-regalo]")) b.onclick = () => actions.regalarCreditos(+b.dataset.regalo);
  const f = habiaFoco && cont.querySelector("#" + habiaFoco);
  if (f) f.focus(); else focoInicial(cont);
}

const titulo = (id) => { const j = state.juegos.find((x) => x.id === id); return j ? j.titulo : id || ""; };
function fecha(ms) {
  const d = new Date(ms);
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" });
}

function ventana() {
  const s = saldoActual();
  const ahora = Date.now();
  const ganan = state.juegos.filter((j) => j.creditos === "gana");
  const gastan = state.juegos.filter((j) => j.creditos === "gasta");
  const movs = historial(state.creditos, 20);
  return `<div class="fondo"><div class="ventana creditos" role="dialog" aria-modal="true" aria-labelledby="creditosTitulo">
    <header><h2 id="creditosTitulo">${MONEDA} Créditos</h2>
      <button class="cerrar" id="creditosCerrar" aria-label="Cerrar" data-foco="inicial">×</button></header>
    <p class="saldo-grande">${MONEDA}<b>${s}</b><span>${s === 1 ? "crédito" : "créditos"}</span></p>
    <section><h3>Cómo se ganan</h3>
      <p>Jugando: <b>${REGLAS.porEstrella} por cada estrella</b> y <b>${REGLAS.porReto} más</b> por el reto del día. Cada juego da hasta ${REGLAS.topeDiario} al día.</p>
      ${ganan.length ? `<ul class="hoy">${ganan.map((j) => { const g = ganadoHoy(state.creditos, j.id, ahora).total; return `<li><span>${esc(j.titulo)}</span><b>${g} de ${REGLAS.topeDiario} hoy</b></li>`; }).join("")}</ul>` : ""}
    </section>
    ${gastan.length ? `<section><h3>En qué se usan</h3><ul class="hoy">${gastan.map((j) => `<li><span>${esc(j.titulo)}</span><b>${j.costo ? j.costo + " por partida" : ""}</b></li>`).join("")}</ul></section>` : ""}
    <section><h3>Historial</h3>
      ${movs.length ? `<ul class="historial">${movs.map((m) => `<li><span class="cuando">${esc(fecha(m.f))}</span><span>${esc(MOTIVOS[m.m] || m.m)}${m.j ? " · " + esc(titulo(m.j)) : ""}</span><b class="${m.n > 0 ? "mas" : "menos"}">${m.n > 0 ? "+" : "−"}${Math.abs(m.n)}</b></li>`).join("")}</ul>`
        : `<p class="nota">Todavía no hay movimientos. ¡A jugar!</p>`}
    </section>
    <section class="papas"><h3>Para papás</h3>${papasHtml()}</section>
  </div></div>`;
}

function papasHtml() {
  if (!papas.abierto) return `<div class="botones"><button class="boton chico" id="papasAbrir" data-foco>Regalar o quitar créditos</button></div>`;
  if (!papas.ok) {
    const p = papas.pregunta;
    return `<p>Para seguir, ¿cuánto es <b>${p.a} × ${p.b}</b>?</p>
      ${papas.error ? `<p class="aviso mal" role="alert">${esc(papas.error)}</p>` : ""}
      <div class="botones">${p.opciones.map((o, i) => `<button class="boton" id="resp${i}" data-respuesta="${o}" data-foco>${o}</button>`).join("")}</div>`;
  }
  return `<div class="botones">${[1, 5, 10].map((n) => `<button class="boton primario" id="reg${n}" data-regalo="${n}" data-foco>+${n}</button>`).join("")}
    ${[-1, -5].map((n) => `<button class="boton" id="qui${-n}" data-regalo="${n}" data-foco>−${-n}</button>`).join("")}</div>
    <p class="nota">Queda en el historial como regalo o ajuste de papás.</p>`;
}
