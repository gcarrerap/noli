// «¿Salir?»: Atrás lo abre, el segundo Atrás lo cierra, Seguir queda marcado.
// Al cerrarlo, los toques y OK se ignoran un momento para que el segundo
// toque no caiga en lo que había debajo.

export const IGNORAR_MS = 400;

export function efectoAtras(dialogoAbierto) {
  return dialogoAbierto ? "cerrar" : "abrir";
}

export function alCerrarDialogo(ahora) {
  return { saliendo: false, ignorarHasta: ahora + IGNORAR_MS };
}

// Con el diálogo abierto solo responden Seguir y Salir.
// Justo después de cerrarlo, un toque o OK no hace nada.
export function resolverToque({ saliendo = false, ignorarHasta = 0, ahora = 0, act = "" } = {}) {
  if (saliendo) {
    if (act === "seguir") return "seguir";
    if (act === "salir" || act === "salir-menu") return "salir";
    return "nada";
  }
  if (ahora < ignorarHasta) return "nada";
  return "juego";
}
