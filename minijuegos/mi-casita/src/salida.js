// Atrás abre «¿Salir?» con Seguir marcado. Un segundo Atrás lo cierra.
// Salir del catálogo solo ocurre al confirmar.

export function resolverAtras(dialogoAbierto) {
  return dialogoAbierto ? "cerrar" : "abrir";
}
