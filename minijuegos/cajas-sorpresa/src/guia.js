// Guía de la primera visita. Los pasos de mirar avanzan con un toque, con OK
// o cuando la voz termina, entre 2 s y 3 s. Abrir la caja solo avanza al hacerlo.
// Saltar no recibe el foco solo. Salir no guarda la guía.

import { unirBloqueos, TRAS_DIALOGO_MS } from "./salida.js";

export const GUIA_MIN_MS = 2000;
export const GUIA_MAX_MS = 3000;
export const GUIA_BLOQUEO_MS = 1000;
export const TRAS_GUIA_MS = 1000;

export const PASOS = ["tienda", "probabilidades", "garantia", "abrir", "carta", "vitrina"];

const SIGUIENTE = {
  tienda: "probabilidades",
  probabilidades: "garantia",
  garantia: "abrir",
  abrir: "carta",
  carta: "vitrina",
};

export function guiaAvanzaConToque(paso) {
  return paso !== "abrir";
}

/** El foco del paso. Nunca es Saltar. */
export function focoDeGuia(paso) {
  if (paso === "abrir") return "abrir";
  return "frase-guia";
}

/**
 * Cuándo puede avanzar un paso de mirar si la voz sí terminó.
 * Sin fin de voz todavía: el tope es 3 s (sigue hablando).
 * Si la voz termina, en ese momento, pero no antes de 2 s ni después de 3 s.
 * La voz apagada y el error no usan esto: duran 2 s (evento «silencio»).
 */
export function cuandoAvanzaMuestra(aparecio, vozTerminoEn) {
  const base = Number(aparecio) || 0;
  const min = base + GUIA_MIN_MS;
  const max = base + GUIA_MAX_MS;
  if (vozTerminoEn == null || vozTerminoEn === "") return max;
  const fin = Number(vozTerminoEn);
  if (!Number.isFinite(fin)) return max;
  return Math.min(max, Math.max(min, fin));
}

/**
 * Hasta cuándo el paso no acepta la acción.
 * Sin habla: 1 s. Con habla: hasta que termina, entre 1 s y 3 s.
 * Si la voz falla o no termina, el tope es 3 s. No incluye los 400 ms del diálogo.
 */
export function finBloqueoPaso({ aparecio, sono = false, vozTerminoEn = null } = {}) {
  const base = Number(aparecio) || 0;
  const min = base + GUIA_BLOQUEO_MS;
  const max = base + GUIA_MAX_MS;
  if (!sono) return min;
  if (vozTerminoEn == null || vozTerminoEn === "") return max;
  const fin = Number(vozTerminoEn);
  if (!Number.isFinite(fin)) return max;
  return Math.min(max, Math.max(min, fin));
}

/** Bloqueo real: el del paso y el de después de «¿Salir?» se pisan. */
export function finBloqueoGuia({ aparecio, sono = false, vozTerminoEn = null, hastaDialogo = null } = {}) {
  return unirBloqueos(finBloqueoPaso({ aparecio, sono, vozTerminoEn }), hastaDialogo);
}

/**
 * Al volver de «¿Salir?» el paso empieza de nuevo y los 400 ms corren encima,
 * no después. El bloqueo acaba en el mayor de los dos, no en la suma.
 */
/**
 * Al pulsar Seguir solo quedan los 400 ms, pisados con el plazo del paso
 * si ese plazo todavía no se cumplió. Un bloqueo ya terminado no vuelve a empezar.
 */
export function bloqueoAlSeguir({ ahora, hastaPaso = 0 } = {}) {
  const t = Number(ahora) || 0;
  const previo = Number(hastaPaso) || 0;
  const paso = previo > t ? previo : 0;
  const dialogo = t + TRAS_DIALOGO_MS;
  return {
    hastaPaso: paso,
    hastaDialogo: dialogo,
    hasta: unirBloqueos(paso || null, dialogo),
  };
}

export function muestraPuedeAvanzar({ aparecio, ahora, evento, vozTerminoEn = null, hasta = 0 } = {}) {
  const t0 = Number(aparecio) || 0;
  const t = Number(ahora) || 0;
  const tope = Number(hasta) || 0;
  if (t < tope) return false;
  if (evento === "toque" || evento === "ok") return t - t0 >= GUIA_MIN_MS;
  if (evento === "voz") {
    if (vozTerminoEn == null || vozTerminoEn === "") return false;
    const fin = Number(vozTerminoEn);
    return Number.isFinite(fin) && t >= cuandoAvanzaMuestra(t0, fin);
  }
  if (evento === "silencio") return t - t0 >= GUIA_MIN_MS;
  if (evento === "tiempo") return t >= t0 + GUIA_MAX_MS;
  return false;
}

/**
 * evento: saltar | toque | ok | tiempo | voz | abrir
 * Solo Saltar, o llegar al final, guarda la guía.
 */
export function aplicarGuia(paso, evento) {
  if (evento === "saltar") return { paso, fin: true, guardo: true };
  const muestra = guiaAvanzaConToque(paso);
  const avanza = (muestra && (evento === "toque" || evento === "ok" || evento === "tiempo" || evento === "voz" || evento === "silencio"))
    || (paso === "abrir" && evento === "abrir");
  if (!avanza) return { paso, fin: false, guardo: false };
  const sig = SIGUIENTE[paso];
  if (!sig) return { paso, fin: true, guardo: true };
  return { paso: sig, fin: false, guardo: false };
}
