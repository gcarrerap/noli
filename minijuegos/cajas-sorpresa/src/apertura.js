// La apertura son tres toques: la bruma sube, la bruma sube más y al tercero
// salta la tapa. La rareza (marco, estrellas y brillo) espera un poco más.
// Un toque acorta la espera. Los tiempos no dependen de la rareza.

export const ETAPA_MS = 900;
export const REVELAR_MS = 600;
export const CARTA_MS = 1800;
export const TRAS_ABRIR_MS = 1000;
export const TRAS_COMPRA_MS = 1000;

const ETAPAS = ["cerrado", "bruma1", "bruma2", "figura", "rareza"];

export function etapaSiguiente(etapa) {
  const i = ETAPAS.indexOf(etapa);
  if (i < 0 || i >= ETAPAS.length - 1) return "rareza";
  return ETAPAS[i + 1];
}

/** Milisegundos hasta que la etapa avanza sola. La figura espera el marco. */
export function esperaDeEtapa(etapa, { reducida = false } = {}) {
  if (etapa === "rareza") return 0;
  if (etapa === "figura") return reducida ? 0 : REVELAR_MS;
  if (etapa === "cerrado" || etapa === "bruma1" || etapa === "bruma2") return reducida ? 200 : ETAPA_MS;
  return 0;
}

/**
 * Abrir se deshabilita solo por un motivo de verdad: está cobrando, no puede
 * abrir, o la guía está en otro paso. Un plazo de tiempo no lo apaga, para que
 * la tele no pierda el foco.
 */
export function seDeshabilitaAbrir({ cobrando = false, enGuia = false, paso = "", puede = true } = {}) {
  if (cobrando) return true;
  if (enGuia) return paso !== "abrir";
  return !puede;
}
