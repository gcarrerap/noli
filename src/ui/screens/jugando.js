// Reproductor: el juego abierto en un iframe a pantalla completa y el puente de mensajes con él
// (protocolo en kit/protocolo.js). El iframe se crea una vez por juego abierto, no en cada redibujo.
import { state, actions, conectarJuego } from "../../app/index.js";
import { mensaje, esMensaje } from "../../../kit/protocolo.js";
import { esc } from "../dom.js";

// SVG y no emoji: el navegador de la TV LG no tiene emojis a color (#5)
const CASITA = `<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5" fill="none" stroke="#ff6b4a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 10v9.5h13V10" fill="#ffc43d" stroke="#2b2236" stroke-width="1.6" stroke-linejoin="round"/><rect x="10" y="13.5" width="4" height="6" rx="1" fill="#2b2236"/></svg>`;

let actual = null; // { id, frame, desconectar }

export function renderJugando(app) {
  const j = state.jugando;
  if (actual && actual.id === j.id && app.contains(actual.frame)) return;
  cerrarReproductor();
  app.innerHTML = `
    <div class="jugando">
      <iframe class="juego" title="${esc(j.titulo)}" src="${esc(j.url)}" allow="autoplay; fullscreen"></iframe>
      <button class="casita" aria-label="Regresar al catálogo" title="Regresar">${CASITA}</button>
    </div>`;
  const frame = app.querySelector("iframe");
  app.querySelector(".casita").onclick = () => actions.cerrar();
  const enviar = (m) => { try { frame.contentWindow.postMessage(m, location.origin); } catch {} };
  frame.addEventListener("load", () => { enviar(hola(j.id)); frame.focus(); });
  actual = { id: j.id, frame, desconectar: conectarJuego((accion) => enviar(mensaje("entrada", { accion }))) };
}

const hola = (id) => mensaje("hola", { modo: state.modo, datos: actions.datosDe(id) });

export function cerrarReproductor() {
  if (!actual) return;
  actual.desconectar();
  actual = null;
}

// Mensajes que manda el juego. Solo se aceptan del iframe abierto y del mismo sitio.
export function instalarPuente() {
  window.addEventListener("message", (e) => {
    if (!actual || e.source !== actual.frame.contentWindow || e.origin !== location.origin || !esMensaje(e.data)) return;
    const m = e.data;
    if (m.tipo === "listo") actual.frame.contentWindow.postMessage(hola(actual.id), location.origin);
    else if (m.tipo === "guardar") actions.guardarDatos(actual.id, m.datos);
    else if (m.tipo === "terminar") actions.terminar(actual.id, m.estrellas);
    else if (m.tipo === "salir") actions.cerrar();
  });
}
