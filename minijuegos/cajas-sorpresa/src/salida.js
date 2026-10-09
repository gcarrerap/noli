// Atrás abre «¿Salir?» con Seguir marcado. Otro Atrás lo cierra.
// Tras cerrarlo, 400 ms no entran toques ni OK. Ese plazo se pisa con el
// bloqueo del paso: cuenta el que termina más tarde, nunca la suma.

export const TRAS_DIALOGO_MS = 400;

export function resolverAtras(dialogoAbierto) {
  return dialogoAbierto ? "cerrar" : "abrir";
}

export function teclaConDialogo(accion, focoId) {
  if (accion === "atras") return "cerrar";
  if (accion === "ok") return focoId === "salir" ? "salir" : "seguir";
  if (accion === "arriba" || accion === "abajo" || accion === "izquierda" || accion === "derecha") return "foco";
  return "nada";
}

/** En el teléfono, lo oscuro de «¿Salir?» es Seguir. En la tele, no. */
export function toqueEnVelo({ tv = false, enDialogo = false } = {}) {
  if (tv || enDialogo) return "nada";
  return "seguir";
}

export function toqueConDialogo(act) {
  if (act === "seguir" || act === "velo") return "seguir";
  if (act === "salir") return "salir";
  return "nada";
}

/** Atrás abre «¿Salir?» en todas las pantallas, también la carta y la vitrina. */
export function atrasEnPantalla(pantalla, dialogoAbierto) {
  void pantalla;
  return dialogoAbierto ? "cerrar" : "preguntar";
}

/**
 * Une dos relojes que corren a la vez.
 * Si el paso bloquea hasta T+1000 y el diálogo hasta T+400, el bloqueo acaba en T+1000.
 */
function instante(n) {
  if (n == null || n === "") return null;
  const x = Number(n);
  return Number.isFinite(x) ? x : null;
}

export function unirBloqueos(hastaPaso, hastaDialogo) {
  const a = instante(hastaPaso);
  const b = instante(hastaDialogo);
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
  const t = Number(ahora) || 0;
  const dialogo = Number(hastaDialogo) || 0;
  const paso = Number(hastaPaso) || 0;
  if (dialogo && t < dialogo) return true;
  if (act === "saltar") return false;
  return paso > 0 && t < paso;
}
