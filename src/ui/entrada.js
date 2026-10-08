// Teclado y control de la TV en el catálogo. Convierte teclas en acciones (kit/teclas.js) y se las pasa a la app.
// Con un juego abierto el foco está dentro del iframe y las teclas las atiende el kit del juego; si el foco
// quedó en el catálogo (por ejemplo, después de tocar la casita), se reenvían al juego por la app.
import { state, actions } from "../app/index.js";
import { teclaAAccion } from "../../kit/teclas.js";
import { moverFoco, teclaEnFiltros, enfocarFiltros, enfocarTarjeta } from "./screens/catalogo.js";

export let conTeclado = false;

export function instalarEntrada() {
  document.addEventListener("pointerdown", () => { conTeclado = false; document.documentElement.classList.remove("teclado"); }, true);
  document.addEventListener("keydown", (e) => {
    const accion = teclaAAccion(e);
    if (!accion) return;
    // Escribiendo en un campo (no hay ahora, pero el control remoto tendrá uno): no interceptar
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    e.preventDefault();
    conTeclado = true; document.documentElement.classList.add("teclado");

    if (state.jugando) return actions.entrada(accion);
    const el = document.activeElement;
    if (el && el.classList.contains("chip")) return teclaEnFiltros(accion, el);
    if (!el || !el.classList.contains("tarjeta")) {
      // Primera tecla: poner el foco en la tarjeta actual
      if (accion !== "atras") return enfocarTarjeta();
      return;
    }
    if (accion === "arriba" && state.foco < state.cols && enfocarFiltros()) return;
    actions.entrada(accion);
  });
}

export { moverFoco };
