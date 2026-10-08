// Dibuja la pantalla que toca (catálogo o juego). Se llama cada vez que cambia el estado (ver src/main.js).
import { state } from "../app/index.js";
import { $ } from "./dom.js";
import { renderCatalogo } from "./screens/catalogo.js";
import { renderJugando, cerrarReproductor } from "./screens/jugando.js";

export function render() {
  const app = $("#app");
  document.documentElement.dataset.modo = state.modo;
  document.documentElement.classList.toggle("en-juego", !!state.jugando);
  if (state.jugando) return renderJugando(app);
  cerrarReproductor();
  renderCatalogo(app);
}
