// Atrás abre «¿Salir?» con Seguir marcado. Otro Atrás cierra el diálogo
// y no sale del juego. Salir del catálogo solo ocurre al confirmar Salir.
// Tras cerrar, los toques y OK se ignoran un momento para que el segundo
// toque no caiga en lo que quedó debajo.

export const TRAS_DIALOGO_MS = 400;

export function resolverAtras(dialogoAbierto) {
  return dialogoAbierto ? "cerrar" : "abrir";
}

// "preguntar" abre el diálogo. Las pantallas de adentro regresan a su padre.
export function accionAtras(pantalla) {
  if (pantalla === "papas") return "progreso";
  if (pantalla === "progreso") return "inicio";
  return "preguntar";
}

// Seguir en la guía, en la respuesta o a mitad del cruce se queda.
// Si el cruce ya terminó y solo faltaba seguir, sí avanza.
export function alCerrarSalir({ salir = false, resuelto = false, revelado = false, guia = false } = {}) {
  if (salir) return "salir";
  if (guia || revelado || !resuelto) return "quedarse";
  return "avanzar";
}

export function marcarIgnorar(ahora, ms = TRAS_DIALOGO_MS) {
  return ahora + ms;
}

export function entradaIgnorada(ignorarHasta, ahora, tipo) {
  if (tipo !== "toque" && tipo !== "ok") return false;
  return ahora < (ignorarHasta | 0);
}

// Se revisa antes que cualquier otro handler.
export function resolverEntrada({ dialogo = false, ignorarHasta = 0, ahora = 0, tipo = "toque" } = {}) {
  if (dialogo) return "dialogo";
  if (entradaIgnorada(ignorarHasta, ahora, tipo)) return "ignorar";
  return "seguir";
}
