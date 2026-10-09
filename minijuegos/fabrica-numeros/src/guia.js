// Reglas de la guía de la primera vez. Puras, para poder probarlas sin pantalla.
// Los pasos 0 y 3 se van con un toque, con OK, o solos cuando acaba la voz (nunca más de 3 s).
// Los pasos 1 y 2 solo cuando la banda llega a las piezas pedidas.
// Enviar no hace nada hasta el último paso.

/** Tope de un paso que solo se muestra: espera a la voz, y a los 3 s avanza igual. */
export const GUIA_VOZ_TOPE_MS = 3000;

const VOZ = ["Arma el 23", "Pon 2 barras", "Pon 3 cubitos", "¡Igual!", "Toca Enviar"];

/**
 * Cuánto esperar antes de avanzar solo.
 * msVoz es lo que duró la frase. Sin voz, o si no llegó a sonar, el tope.
 * Si sonó, ese tiempo, y nunca más del tope.
 */
export function esperaVozGuia(msVoz) {
  const v = Number(msVoz);
  if (!Number.isFinite(v) || v <= 0) return GUIA_VOZ_TOPE_MS;
  return Math.min(v, GUIA_VOZ_TOPE_MS);
}

export function guiaEnviarActivo(paso) {
  return paso === 4;
}

// Un toque o OK avanza, sin mirar cuántas piezas hay.
export function guiaAvanzaConToque(paso) {
  return paso === 0 || paso === 3;
}

// El paso de las barras o el de los cubitos, solo si ya están.
export function guiaBandaLista(paso, estado) {
  const e = estado || {};
  if (paso === 1) return (e.d || 0) === 2;
  if (paso === 2) return (e.u || 0) === 3;
  return false;
}

export function textoDeGuia(paso, modo = "tactil") {
  if (paso === 0) return "Arma este número";
  if (paso === 1) return modo === "tv" ? "▲ 2 veces" : "Pon 2 barras";
  if (paso === 2) return "Pon 3 cubitos";
  if (paso === 3) return "¡Igual!";
  if (paso === 4) return modo === "tv" ? "Pulsa OK" : "Toca Enviar";
  return "";
}

export function vozDeGuia(paso, modo = "tactil") {
  if (paso === 4 && modo === "tv") return "Pulsa OK";
  return VOZ[paso] || "";
}
