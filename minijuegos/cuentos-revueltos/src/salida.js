// Atrás abre «¿Salir?» con Seguir marcado. El segundo Atrás lo cierra.
// Al cerrar, los toques y OK se ignoran un momento para que el segundo
// toque no caiga en lo que quedó debajo.

export const TRAS_DIALOGO_MS = 400;

export function resolverAtras(dialogoAbierto) {
  return dialogoAbierto ? "cerrar" : "abrir";
}

// Con el diálogo abierto solo responde el diálogo. Se revisa antes que el resto.
export function zonaPermitida(dialogoAbierto, zona) {
  if (!dialogoAbierto) return true;
  return zona === "dialogo";
}

export function debeIgnorar(ahora, hasta) {
  return Number.isFinite(hasta) && ahora < hasta;
}

export function hastaIgnorar(ahora, ms = TRAS_DIALOGO_MS) {
  return ahora + ms;
}

// El candado de 400 ms y el candado del paso corren a la vez.
// Se sale cuando pasa el más largo. No se suman.
export function hastaLibre(bloqueoHasta, ignorarHasta) {
  const paso = Number.isFinite(bloqueoHasta) ? bloqueoHasta : 0;
  const dialogo = Number.isFinite(ignorarHasta) ? ignorarHasta : 0;
  return Math.max(paso, dialogo);
}
