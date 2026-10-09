// Atrás abre «¿Salir?» con Seguir marcado. Otro Atrás lo cierra.
// Tras cerrarlo, 400 ms no entran toques ni OK. Ese plazo se pisa con el
// bloqueo del paso: cuenta el que termina más tarde, nunca la suma.

export const TRAS_DIALOGO_MS = 400;

export function resolverAtras(dialogoAbierto) {
  return dialogoAbierto ? "cerrar" : "abrir";
}

export function teclaConDialogo(accion, focoId) {
  if (accion === "atras") return "cerrar";
  if (accion === "ok") return focoId === "seguir" || focoId === "salir" ? focoId : "nada";
  if (accion === "arriba" || accion === "abajo" || accion === "izquierda" || accion === "derecha") return "foco";
  return "nada";
}

export function toqueConDialogo(act) {
  if (act === "seguir" || act === "velo") return "seguir";
  if (act === "salir") return "salir";
  return "nada";
}

/**
 * Une dos relojes que corren a la vez.
 * Si el paso bloquea hasta T+1000 y el diálogo hasta T+400, el bloqueo acaba en T+1000.
 */
export function unirBloqueos(hastaPaso, hastaDialogo) {
  const a = Number.isFinite(hastaPaso) ? hastaPaso : null;
  const b = Number.isFinite(hastaDialogo) ? hastaDialogo : null;
  if (a == null && b == null) return 0;
  if (a == null) return b;
  if (b == null) return a;
  return Math.max(a, b);
}

/**
 * Durante los 400 ms se ignora todo toque, también Saltar.
 * Después, Saltar sí responde aunque el paso siga bloqueado.
 * El resto espera a que terminen los dos relojes (el más largo, no la suma).
 */
export function tapBloqueado({ act = "", ahora = 0, hastaPaso = 0, hastaDialogo = 0 } = {}) {
  if (Number.isFinite(hastaDialogo) && ahora < hastaDialogo) return true;
  if (act === "saltar") return false;
  return Number.isFinite(hastaPaso) && ahora < hastaPaso;
}
