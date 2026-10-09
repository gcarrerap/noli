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
