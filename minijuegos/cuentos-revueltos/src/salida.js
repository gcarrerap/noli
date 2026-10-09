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
/** En el teléfono, tocar lo oscuro de «¿Salir?» es Seguir. En la tele, no. */
export function toqueEnVelo({ tv = false, enDialogo = false } = {}) {
  if (tv || enDialogo) return "nada";
  return "seguir";
}

// Tras la guía no se marca un libro: un OK que sigue pulsado no debe abrirlo.
export function focoAlAbrirEstante(primerId, { trasGuia = false } = {}) {
  if (trasGuia) return null;
  return primerId ? `libro-${primerId}` : "reto";
}

// La tarea nueva espera al menos 1 s. Si ya había un candado más largo, se queda ese.
export function bloqueoAlEntrar(actual, ahora, ms = 1000) {
  const a = Number(actual);
  const t = Number(ahora);
  const base = Number.isFinite(a) ? a : 0;
  const momento = Number.isFinite(t) ? t : 0;
  return Math.max(base, momento + ms);
}

export function hastaLibre(bloqueoHasta, ignorarHasta) {
  const paso = Number.isFinite(bloqueoHasta) ? bloqueoHasta : 0;
  const dialogo = Number.isFinite(ignorarHasta) ? ignorarHasta : 0;
  return Math.max(paso, dialogo);
}
