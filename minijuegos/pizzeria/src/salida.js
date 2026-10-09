// Atrás abre «¿Salir?» con Seguir marcado. Otro Atrás cierra el diálogo
// y no sale del juego. En una pantalla de adentro regresa a su padre.
// Salir del catálogo solo ocurre al confirmar el botón Salir.
// La guía se salta con Saltar, no con Atrás.

export function resolverAtras(dialogoAbierto) {
  return dialogoAbierto ? "cerrar" : "abrir";
}

// "preguntar" abre el diálogo. "progreso" e "inicio" cambian de pantalla.
export function accionAtras(pantalla) {
  if (pantalla === "papas") return "progreso";
  if (pantalla === "inicio" || pantalla === "pedido" || pantalla === "guia" || pantalla === "fin" || pantalla === "finReto") return "preguntar";
  return "inicio";
}
