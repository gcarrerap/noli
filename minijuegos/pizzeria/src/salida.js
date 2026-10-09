// Atrás abre «¿Salir?» con Seguir marcado. Otro Atrás cierra el diálogo.
// En una pantalla de adentro regresa a su padre. Salir del catálogo solo
// ocurre al confirmar el botón Salir. Durante la guía, Atrás la salta.

export function resolverAtras(dialogoAbierto) {
  return dialogoAbierto ? "cerrar" : "abrir";
}

// "preguntar" abre el diálogo. "saltar-guia" termina la guía.
// "progreso" e "inicio" cambian de pantalla.
export function accionAtras(pantalla, enGuia) {
  if (enGuia) return "saltar-guia";
  if (pantalla === "papas") return "progreso";
  if (pantalla === "inicio" || pantalla === "pedido") return "preguntar";
  return "inicio";
}
