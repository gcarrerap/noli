// Dibuja la pantalla que toca. Se llama cada vez que cambia el estado (ver src/main.js).
//   - Un juego abierto: el reproductor (el mundo 3D, si está, se pausa debajo; en la TV se libera).
//   - Si no, el menú principal: el mundo 3D (#25) o el menú 2D de tarjetas (state.vista).
import { state } from "../app/index.js";
import { $ } from "./dom.js";
import { renderCatalogo } from "./screens/catalogo.js";
import { renderJugando, cerrarReproductor } from "./screens/jugando.js";
import { mostrarMundo, ocultarMundo, desmontarMundo } from "./screens/mundo.js";

export function render() {
  const app = $("#app");
  const mundo = state.vista === "mundo";
  document.documentElement.dataset.modo = state.modo;
  document.documentElement.classList.toggle("en-juego", !!state.jugando);
  document.documentElement.classList.toggle("en-mundo", mundo && !state.jugando);
  if (state.jugando) {
    if (mundo) ocultarMundo();
    return renderJugando(app);
  }
  cerrarReproductor();
  if (mundo) {
    if (app.firstChild) app.innerHTML = "";
    return mostrarMundo();
  }
  desmontarMundo();
  renderCatalogo(app);
}
