// Atrás nunca saca del juego. Abre «¿Salir?» o, si ya está abierto, lo cierra.
// Salir del catálogo solo ocurre al confirmar el botón Salir.

export function resolverAtras(dialogoAbierto) {
  return dialogoAbierto ? "cerrar" : "abrir";
}
