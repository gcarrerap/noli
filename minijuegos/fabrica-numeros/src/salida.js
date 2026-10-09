// Atrás en el inicio y en el juego abre «¿Salir?». En una pantalla de adentro
// regresa a su padre (Para papás → Mi progreso; el resto → la fábrica).
// Salir del catálogo solo ocurre al confirmar el botón Salir.

export function resolverAtras(dialogoAbierto) {
  return dialogoAbierto ? "cerrar" : "abrir";
}

// "preguntar" abre el diálogo. "progreso" e "inicio" cambian de pantalla.
export function accionAtras(pantalla) {
  if (pantalla === "papas") return "progreso";
  if (pantalla === "inicio" || pantalla === "problema" || pantalla === "ordenar") return "preguntar";
  return "inicio";
}
