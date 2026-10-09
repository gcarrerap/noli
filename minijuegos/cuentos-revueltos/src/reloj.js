// Reloj de un paso. Se puede pausar (el tiempo no corre) o reiniciar desde cero.

export function relojNuevo(ahora) {
  return { inicio: ahora, pausa: null };
}

export function relojPausar(reloj, ahora) {
  if (!reloj || reloj.pausa != null) return reloj;
  return { inicio: reloj.inicio, pausa: ahora };
}

export function relojReiniciar(ahora) {
  return { inicio: ahora, pausa: null };
}

// Sigue desde el tiempo ya contado. No reinicia el paso.
export function relojReanudar(reloj, ahora) {
  if (!reloj || reloj.pausa == null) return reloj;
  return { inicio: ahora - (reloj.pausa - reloj.inicio), pausa: null };
}

export function relojMs(reloj, ahora) {
  if (!reloj) return 0;
  const fin = reloj.pausa != null ? reloj.pausa : ahora;
  return Math.max(0, fin - reloj.inicio);
}
