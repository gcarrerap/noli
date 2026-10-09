// Atrás abre «¿Salir?» con Seguir marcado. Otro Atrás cierra el diálogo
// y no sale del juego. En una pantalla de adentro regresa a su padre.
// Salir del catálogo solo ocurre al confirmar el botón Salir.
// La guía se salta con Saltar, no con Atrás.

export function resolverAtras(dialogoAbierto) {
  return dialogoAbierto ? "cerrar" : "abrir";
}

// Seguir en «Así era.» se queda para que ella vea la respuesta.
// En «¡Qué rico!» el pedido ya terminó y sí se sigue.
export function alCerrarSalir({ salir = false, resuelto = false, revelado = false, guia = false } = {}) {
  if (salir) return "salir";
  if (guia || revelado || !resuelto) return "quedarse";
  return "avanzar";
}

// "preguntar" abre el diálogo. "progreso" e "inicio" cambian de pantalla.
export function accionAtras(pantalla) {
  if (pantalla === "papas") return "progreso";
  if (pantalla === "inicio" || pantalla === "pedido" || pantalla === "guia" || pantalla === "fin" || pantalla === "finReto") return "preguntar";
  return "inicio";
}
