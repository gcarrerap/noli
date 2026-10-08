// Teclado y control de la TV en el catálogo. Convierte teclas en acciones (kit/teclas.js) y se las pasa a la app.
// Con un juego abierto el foco está dentro del iframe y las teclas las atiende el kit del juego; si el foco
// quedó en el catálogo (por ejemplo, después de tocar la casita), se reenvían al juego por la app.
import { state, actions } from "../app/index.js";
import { teclaAAccion } from "../../kit/teclas.js";
import { moverFoco as moverFocoEn } from "../../kit/foco.js";
import { moverFoco, teclaEnFiltros, enfocarFiltros, enfocarTarjeta } from "./screens/catalogo.js";
import { accionEnPanel } from "./components/remoto.js";

export let conTeclado = false;

export function instalarEntrada() {
  document.addEventListener("pointerdown", () => { conTeclado = false; document.documentElement.classList.remove("teclado"); }, true);
  document.addEventListener("keydown", (e) => {
    const accion = teclaAAccion(e);
    if (!accion) return;
    // Escribiendo en un campo (el código de la nube): solo las flechas arriba/abajo y "atrás" (Escape) salen de él
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && !["arriba", "abajo"].includes(accion) && e.key !== "Escape") return;
    e.preventDefault();
    aplicarAccion(accion);
  });
}

// Una acción del control: de una tecla (control de la TV, teclado) o del teléfono usado como control remoto
// (app/remoto.js). Las dos se comportan igual: mueven el foco, pasan a los filtros, abren juegos.
export function aplicarAccion(accion) {
  conTeclado = true; document.documentElement.classList.add("teclado");

  if (state.nubeAbierta) {
    const modal = document.getElementById("modal");
    if (accion === "atras") return actions.cerrarNube();
    if (moverFocoEn(accion, modal)) return;
    if (accion === "ok" && modal.contains(document.activeElement)) document.activeElement.click();
    return;
  }
  if (state.jugando) return actions.entrada(accion);
  if (state.remoto.panel && accionEnPanel(accion)) return;
  const el = document.activeElement;
  if (el && el.classList.contains("chip")) return teclaEnFiltros(accion, el);
  if (el && el.id === "nubeBtn") {
    if (accion === "ok") return el.click();
    if (accion === "abajo") return enfocarFiltros() || enfocarTarjeta();
    return;
  }
  if (!el || !el.classList.contains("tarjeta")) {
    // Primera tecla: poner el foco en la tarjeta actual (o en los filtros si no hay tarjetas)
    if (accion !== "atras" && !enfocarTarjeta()) enfocarFiltros();
    return;
  }
  if (accion === "arriba" && state.foco < state.cols) { if (!enfocarFiltros()) { const n = document.getElementById("nubeBtn"); if (n) n.focus(); } return; }
  actions.entrada(accion);
}

export { moverFoco };
