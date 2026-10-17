// Botón y ventana de la nube (#7): guardar el progreso en la nube, vincular la TV y el teléfono, desvincular.
// Vive fuera de #app (en #modal) para no redibujar el catálogo. Se maneja con el dedo o con flechas (kit/foco.js).
import { state, actions } from "../../app/index.js";
import { esc } from "../dom.js";
import { focoInicial } from "../../../kit/foco.js";

export const NUBE_ICONO = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M7 18.5h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.6 9.2 4.7 4.7 0 0 0 7 18.5z" fill="#4cb3ff" stroke="#2b2236" stroke-width="1.4" stroke-linejoin="round"/></svg>`;

const ESTADO = {
  apagada: ["Solo en este dispositivo", "gris"],
  conectando: ["Conectando…", "gris"],
  lista: ["Sincronizado", "verde"],
  "sin-conexion": ["Sin conexión: se sube al regresar", "amarillo"],
  esperando: ["Esperando al otro dispositivo…", "amarillo"],
  error: ["Hay un problema", "rojo"],
};

// La pastilla del catálogo (arriba a la derecha)
export function botonNube() {
  const [txt, color] = ESTADO[state.nube.estado] || ESTADO.apagada;
  return `<button class="nube-btn" id="nubeBtn" aria-label="Nube: ${esc(txt)}" title="${esc(txt)}">${NUBE_ICONO}<i class="punto ${color}"></i></button>`;
}

let dibujado = "";
export function renderNube() {
  const cont = document.getElementById("modal");
  if (!cont) return;
  if (!state.nubeAbierta) { if (cont.innerHTML) { cont.innerHTML = ""; dibujado = ""; } return; }
  const n = state.nube;
  const html = ventana(n);
  if (html === dibujado) return;
  const habiaFoco = cont.contains(document.activeElement) ? document.activeElement.id : null;
  const codigoEscrito = cont.querySelector("#codigoOtro")?.value || "";
  dibujado = html;
  cont.innerHTML = html;
  const $ = (s) => cont.querySelector(s);
  const on = (s, fn) => { const e = $(s); if (e) e.onclick = fn; };
  on("#nubeCerrar", actions.cerrarNube);
  on(".fondo", (e) => { if (e.target === e.currentTarget) actions.cerrarNube(); });
  on("#nubeActivar", actions.activarNube);
  on("#nubeGoogle", actions.entrarConGoogle);
  on("#nubeVincularEste", actions.empezarVinculo);
  on("#nubeCancelar", actions.cancelarVinculo);
  on("#nubeReintentar", actions.reintentarNube);
  on("#nubeDesvincular", () => { if (confirm(state.nube.cuenta
    ? "¿Salir de la cuenta de Google y dejar de sincronizar este dispositivo? Lo guardado aquí se queda."
    : "¿Dejar de sincronizar este dispositivo? Lo guardado aquí se queda.")) actions.desvincular(); });
  on("#nubeCompartir", () => compartirLink($("#nubeCompartir")));
  const input = $("#codigoOtro");
  if (input) {
    input.value = codigoEscrito;
    const enviar = async () => { if (await actions.vincularOtro(input.value)) input.value = ""; };
    on("#nubeVincularOtro", enviar);
    input.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); enviar(); } };
  }
  const f = habiaFoco && cont.querySelector("#" + habiaFoco);
  if (f) f.focus(); else focoInicial(cont);
}

// Link de recuperación de este perfil (ver sync.recuperar)
const linkActual = () => actions.linkRecuperacion(location.origin + location.pathname) || "";
const puedeCompartir = () => typeof navigator !== "undefined" && typeof navigator.share === "function";
async function compartirLink(boton) {
  const url = linkActual();
  if (!url) return;
  if (puedeCompartir()) {
    try { await navigator.share({ title: "Noli: link de recuperación", url }); } catch {}
    return;
  }
  let ok = false;
  try { await navigator.clipboard.writeText(url); ok = true; } catch {}
  if (!ok) { // sin portapapeles: seleccionar el texto para copiarlo a mano
    const el = document.getElementById("nubeLink");
    if (el && window.getSelection) { const r = document.createRange(); r.selectNodeContents(el); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
  }
  if (boton) { boton.textContent = ok ? "¡Copiado!" : "Cópialo de arriba"; setTimeout(() => { boton.textContent = "Copiar link"; }, 2000); }
}

function ventana(n) {
  const [txt, color] = ESTADO[n.estado] || ESTADO.apagada;
  let cuerpo;
  if (n.estado === "esperando" && n.codigo) {
    cuerpo = `
      <p>En el dispositivo que <b>ya tiene el progreso</b>, abre la nube, toca <b>Vincular otro dispositivo</b> y escribe:</p>
      <p class="codigo" aria-label="Código ${n.codigo.split("").join(" ")}">${n.codigo.slice(0, 3)}<span> </span>${n.codigo.slice(3)}</p>
      <p class="nota">El código dura 10 minutos.</p>
      <div class="botones"><button class="boton" id="nubeCancelar" data-foco="inicial">Cancelar</button></div>`;
  } else if (!n.perfil) {
    cuerpo = `
      <p>Guarda el progreso de Noelia en la nube para seguir en la TV o en el teléfono donde se quedó.</p>
      <div class="botones col">
        <button class="boton primario" id="nubeGoogle" data-foco>Entrar con la cuenta de Google de Noelia</button>
        <button class="boton" id="nubeVincularEste" data-foco="inicial">Ya lo tengo en otro dispositivo: vincular con código</button>
        <button class="boton" id="nubeActivar" data-foco>Es el primero: guardar en la nube sin cuenta</button>
      </div>
      <p class="nota">En la TV es más fácil vincular con código desde el teléfono que escribir la cuenta con el control.</p>`;
  } else {
    cuerpo = `
      <p>Este dispositivo comparte el progreso con los que estén vinculados.</p>
      ${n.cuenta ? `<p class="cuenta">Cuenta de Google: <b>${esc(n.cuenta)}</b></p>`
        : `<div class="botones col"><button class="boton" id="nubeGoogle" data-foco>Entrar con la cuenta de Google de Noelia</button></div>
      <p class="nota">Así su progreso queda en su cuenta: en un teléfono nuevo solo entra con ella.</p>`}
      ${n.estado === "error" || n.estado === "sin-conexion" ? `<div class="botones"><button class="boton" id="nubeReintentar" data-foco>Reintentar</button></div>` : ""}
      <label class="otro"><span>Para vincular otro dispositivo, escribe el código que enseña:</span>
        <span class="fila"><input id="codigoOtro" inputmode="numeric" pattern="[0-9]*" maxlength="7" autocomplete="off" placeholder="123 456" data-foco="inicial">
        <button class="boton primario" id="nubeVincularOtro" data-foco>Vincular</button></span></label>
      <div class="recuperar">
        <p><b>Link de recuperación</b> (para papá o mamá): guárdalo en tus notas. Si un dispositivo pierde el progreso,
          ábrelo ahí y se recupera todo lo de la nube.</p>
        <p class="link" id="nubeLink">${esc(linkActual())}</p>
        <div class="botones"><button class="boton" id="nubeCompartir" data-foco>${puedeCompartir() ? "Compartir link" : "Copiar link"}</button></div>
        <p class="nota">Quien tenga este link puede ver y cambiar el progreso: no lo publiques.</p>
      </div>
      <div class="botones"><button class="boton chico" id="nubeDesvincular" data-foco>${n.cuenta ? "Salir de la cuenta y desvincular" : "Desvincular este dispositivo"}</button></div>`;
  }
  return `<div class="fondo"><div class="ventana" role="dialog" aria-modal="true" aria-labelledby="nubeTitulo">
    <header><h2 id="nubeTitulo">${NUBE_ICONO} Progreso en la nube</h2>
      <button class="cerrar" id="nubeCerrar" aria-label="Cerrar" data-foco>×</button></header>
    <p class="estado"><i class="punto ${color}"></i>${esc(txt)}</p>
    ${n.aviso ? `<p class="aviso ok" role="status">${esc(n.aviso)}</p>` : ""}
    ${n.error ? `<p class="aviso mal" role="alert">${esc(n.error)}</p>` : ""}
    ${cuerpo}
  </div></div>`;
}
