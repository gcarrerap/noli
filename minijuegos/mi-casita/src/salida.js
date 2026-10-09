// Atrás abre «¿Salir?» con Seguir marcado. Un segundo Atrás lo cierra.
// Salir del catálogo solo ocurre al confirmar.

export function resolverAtras(dialogoAbierto) {
  return dialogoAbierto ? "cerrar" : "abrir";
}

/** Dos Atrás seguidos abren y cierran «¿Salir?». No sale del juego y no cobra. */
export function dosAtras() {
  return {
    primero: resolverAtras(false),
    segundo: resolverAtras(true),
    sale: false,
    cobra: false,
  };
}

/** Pagar, acomodar, el cierre de la visita y el cobro pueden tragarse un toque. */
export const FASES_CON_GUARDIA = ["pagar", "acomodar", "fin", "cobrando"];

/**
 * Seguir y Salir se atienden antes que la fase.
 * Un toque o OK sobre ellos responde aunque ella esté pagando, acomodando,
 * en el cierre o mientras se cobran los créditos.
 * Devuelve "seguir", "salir", "nada" (la fase se lo queda) o "juego".
 */
export function resolverToque(act, fase, dialogoAbierto = false) {
  if (dialogoAbierto) {
    if (act === "seguir" || act === "salir") return act;
    return "nada";
  }
  if (act === "seguir" || act === "salir") return act;
  if (fase === "cobrando") return "nada";
  return "juego";
}

/** Con el diálogo abierto, las teclas solo mueven entre Seguir y Salir o lo cierran. */
export function teclaConDialogo(accion, actFoco) {
  if (accion === "atras") return "cerrar";
  if (accion === "ok") return actFoco === "seguir" || actFoco === "salir" ? actFoco : "nada";
  if (accion === "arriba" || accion === "abajo" || accion === "izquierda" || accion === "derecha") return "foco";
  return "nada";
}

/**
 * Con la barra de la TV abierta, las flechas se quedan en Dejar, Girar y Devolver.
 * Atrás cierra la barra. Girar gira y vuelve a mover el mueble.
 * Devuelve "foco", "cerrar", "girar" o "juego".
 */
export function teclaConBarra(accion) {
  if (accion === "atras") return "cerrar";
  if (accion === "girar") return "girar";
  if (accion === "arriba" || accion === "abajo" || accion === "izquierda" || accion === "derecha") return "foco";
  return "juego";
}

/** Atrás abre «¿Salir?» también en el resultado y al cerrar la visita. */
export function atrasEnPantalla(pantalla, dialogoAbierto) {
  if (pantalla === "fin" || pantalla === "resultado" || pantalla === "guia-fin") {
    return resolverAtras(dialogoAbierto);
  }
  return resolverAtras(dialogoAbierto);
}
