// Aviso "Hay una versión nueva · Actualizar" (igual que en el dominó). Vive fuera de #app para verse en cualquier pantalla.
import { state, applyUpdate } from "../../app/index.js";

export function renderUpdateBar() {
  let bar = document.getElementById("update");
  if (!state.updateAvailable || state.jugando) { if (bar) bar.remove(); return; } // no interrumpir un juego
  if (bar) return;
  bar = document.createElement("div");
  bar.id = "update"; bar.className = "update-bar"; bar.setAttribute("role", "status");
  bar.innerHTML = `<span>Hay juegos nuevos</span><button class="primario" id="updatenow">Actualizar</button>`;
  document.body.appendChild(bar);
  bar.querySelector("#updatenow").onclick = applyUpdate;
}
