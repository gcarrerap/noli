// Control remoto en la TV (issue #3): el botón de los filtros, el recuadro con el código y el QR, y el aviso de
// "Teléfono conectado". El recuadro vive fuera de #app (como el aviso de versión nueva) para no redibujar el catálogo.
// Sin emojis: en la TV LG salen en blanco y negro (#5). El teléfono se dibuja en SVG y los estados con un punto.
import { state, remoto } from "../../app/index.js";
import { qr, qrSvg, urlControl } from "../../engine/index.js";
import { esc } from "../dom.js";

const TELEFONO = `<svg class="ico-tel" viewBox="0 0 24 24" width="1.1em" height="1.1em" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="2.6" fill="#4cb3ff" stroke="#2b2236" stroke-width="1.6"/><rect x="8.2" y="5.2" width="7.6" height="11.6" rx="1" fill="#fff"/><circle cx="12" cy="19" r="1" fill="#2b2236"/></svg>`;

// ---------- El botón (va al final de los filtros, solo en la TV) ----------
export function chipRemoto() {
  return `<button class="chip remoto ${state.remoto.estado}" id="chip-remoto">${etiquetaChip()}</button>`;
}
function etiquetaChip() {
  const r = state.remoto;
  const txt = { apagado: "Usar mi teléfono", preparando: "Preparando…", esperando: `Código ${r.codigo || ""}`,
    conectado: "Teléfono conectado", error: "Usar mi teléfono" }[r.estado] || "Usar mi teléfono";
  return `${TELEFONO}${esc(txt)}${r.estado === "conectado" ? `<span class="punto" aria-hidden="true"></span>` : ""}`;
}
export function instalarChipRemoto(raiz = document) {
  const b = raiz.querySelector("#chip-remoto");
  if (!b) return;
  b.onclick = () => {
    const e = state.remoto.estado;
    if (e === "apagado" || e === "error") remoto.encender();
    else remoto.mostrarPanel(true);
  };
}

// ---------- Recuadro ----------
let qrDe = null, qrHtml = "", avisoTimer = null, estadoAntes = "apagado", dibujado = "";

export function renderRemoto() {
  const r = state.remoto;
  const clave = JSON.stringify([r, !!state.jugando, !!document.getElementById("chip-remoto")]);
  if (clave === dibujado && (!r.panel || document.getElementById("remoto"))) return; // nada cambió
  dibujado = clave;
  // El botón cambia sin redibujar el catálogo (así no se pierde el foco)
  const chip = document.getElementById("chip-remoto");
  if (chip) { chip.className = `chip remoto ${r.estado}`; chip.innerHTML = etiquetaChip(); }

  if (r.estado === "conectado" && estadoAntes !== "conectado") aviso("¡Teléfono conectado!");
  if (estadoAntes === "conectado" && r.estado === "esperando") aviso("Se desconectó el teléfono");
  estadoAntes = r.estado;

  let el = document.getElementById("remoto");
  if (!r.panel || state.jugando) {
    if (el) { el.remove(); devolverFoco(); }
    return;
  }
  const nuevo = !el;
  if (nuevo) {
    el = document.createElement("div");
    el.id = "remoto"; el.className = "remoto-fondo";
    el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "remoto-titulo");
    document.body.appendChild(el);
  }
  const enfocado = document.activeElement && el.contains(document.activeElement) ? document.activeElement.dataset.b : null;
  el.innerHTML = `<div class="remoto-caja">${contenido(r)}</div>`;
  el.querySelector("[data-b=listo]").onclick = () => remoto.mostrarPanel(false);
  const apagar = el.querySelector("[data-b=apagar]");
  if (apagar) apagar.onclick = () => remoto.apagar();
  const otra = el.querySelector("[data-b=reintentar]");
  if (otra) otra.onclick = () => { remoto.apagar({ olvidar: false }).then(() => remoto.encender()); };
  const foco = el.querySelector(`[data-b=${enfocado}]`) || el.querySelector(".remoto-botones button");
  if (foco && (nuevo || enfocado)) foco.focus();
}

function contenido(r) {
  const titulo = `<h2 id="remoto-titulo">Usa tu teléfono como control</h2>`;
  if (r.estado === "preparando") return `${titulo}<p class="remoto-estado">Preparando…</p>${botones(["listo"])}`;
  if (r.estado === "error") return `${titulo}<p class="remoto-estado error">${esc(r.error)}</p>${botones(["reintentar", "listo"])}`;
  const url = urlControl(location.href, r.codigo);
  if (qrDe !== url) { qrDe = url; qrHtml = qrSvg(qr(url), { titulo: "QR para abrir el control en el teléfono" }); }
  const corta = url.replace(/^https?:\/\//, "").replace(/\?.*$/, "");
  return `${titulo}
    <div class="remoto-cuerpo">
      <div class="remoto-qr">${qrHtml}</div>
      <div class="remoto-pasos">
        <p>Apunta la cámara del teléfono a este código…</p>
        <p>…o abre <b>${esc(corta)}</b> y escribe:</p>
        <p class="remoto-codigo" aria-label="Código ${esc(r.codigo.split("").join(" "))}">${r.codigo.split("").map((d) => `<span>${d}</span>`).join("")}</p>
        <p class="remoto-estado ${r.estado}"><span class="punto" aria-hidden="true"></span>${r.estado === "conectado" ? "Teléfono conectado" : "Esperando al teléfono…"}</p>
      </div>
    </div>
    ${botones(["listo", "apagar"])}`;
}
function botones(cuales) {
  const txt = { listo: "Listo", apagar: "Apagar el control", reintentar: "Reintentar" };
  return `<div class="remoto-botones">${cuales.map((b, i) => `<button class="${i === 0 ? "primario" : "chip"}" data-b="${b}">${txt[b]}</button>`).join("")}</div>`;
}

// Flechas/OK/atrás con el recuadro abierto (del control de la TV o del teléfono)
export function accionEnPanel(accion) {
  const el = document.getElementById("remoto");
  if (!el) return false;
  const bs = [...el.querySelectorAll(".remoto-botones button")];
  const i = bs.indexOf(document.activeElement);
  if (accion === "atras") remoto.mostrarPanel(false);
  else if (accion === "izquierda" || accion === "arriba") (bs[i - 1] || bs[0]).focus();
  else if (accion === "derecha" || accion === "abajo") (bs[i + 1] || bs[bs.length - 1]).focus();
  else if (accion === "ok") { if (i >= 0) bs[i].click(); else if (bs[0]) bs[0].focus(); }
  return true;
}

function devolverFoco() {
  const b = document.getElementById("chip-remoto");
  if (b && document.documentElement.classList.contains("teclado")) b.focus();
}

function aviso(txt) {
  let el = document.getElementById("remoto-aviso");
  if (!el) {
    el = document.createElement("div");
    el.id = "remoto-aviso"; el.className = "remoto-aviso"; el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.innerHTML = TELEFONO + esc(txt);
  el.classList.remove("ver"); void el.offsetWidth; el.classList.add("ver");
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => el.classList.remove("ver"), 2600);
}
