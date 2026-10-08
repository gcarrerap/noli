// Reproductor: el juego abierto en un iframe a pantalla completa y el puente de mensajes con él
// (protocolo en kit/protocolo.js). El iframe se crea una vez por juego abierto, no en cada redibujo.
import { state, actions, conectarJuego } from "../../app/index.js";
import { mensaje, esMensaje } from "../../../kit/protocolo.js";
import { esc } from "../dom.js";

let actual = null; // { id, frame, desconectar }

export function renderJugando(app) {
  const j = state.jugando;
  if (actual && actual.id === j.id && app.contains(actual.frame)) return;
  cerrarReproductor();
  app.innerHTML = `
    <div class="jugando">
      <iframe class="juego" title="${esc(j.titulo)}" src="${esc(j.url)}" allow="autoplay; fullscreen"></iframe>
      <button class="casita" aria-label="Regresar al catálogo" title="Regresar">🏠</button>
    </div>`;
  const frame = app.querySelector("iframe");
  app.querySelector(".casita").onclick = () => actions.cerrar();
  const enviar = (m) => { try { frame.contentWindow.postMessage(m, location.origin); } catch {} };
  frame.addEventListener("load", () => { enviar(mensaje("hola", { modo: state.modo })); frame.focus(); });
  actual = { id: j.id, frame, desconectar: conectarJuego((accion) => enviar(mensaje("entrada", { accion }))) };
}

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
    if (m.tipo === "listo") actual.frame.contentWindow.postMessage(mensaje("hola", { modo: state.modo }), location.origin);
    else if (m.tipo === "terminar") actions.terminar(actual.id, m.estrellas);
    else if (m.tipo === "salir") actions.cerrar();
  });
}
