// Aviso breve de la última partida ("¡Muy bien! ★★★") al regresar al catálogo: el juego ya enseña su propio final,
// así que aquí no se tapa. Vive fuera de #app.
import { state } from "../../app/index.js";
import { estrellasHtml, FELICITACION } from "../labels.js";

let visto = null, timer = null;

export function renderCelebrar() {
  const c = state.celebrar;
  if (!c || c === visto || state.jugando) return;
  visto = c;
  let el = document.getElementById("celebrar");
  if (!el) { el = document.createElement("div"); el.id = "celebrar"; el.className = "celebrar"; el.setAttribute("role", "status"); document.body.appendChild(el); }
  el.innerHTML = `<strong>${FELICITACION[c.estrellas]}</strong>${estrellasHtml(c.estrellas)}`;
  el.classList.remove("ver"); void el.offsetWidth; el.classList.add("ver");
  clearTimeout(timer);
  timer = setTimeout(() => el.classList.remove("ver"), 3200);
}
