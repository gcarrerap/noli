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

/**
 * Después de una carta, Abrir pide una pausa de verdad.
 * Cada OK o toque que se ignora vuelve a contar 1 s.
 * Un toque mientras la carta anterior sigue en pantalla no abre la siguiente.
 */
export function pulsoTrasCarta({ ahora, hasta = 0, carta = false } = {}) {
  const t = Number(ahora) || 0;
  const plazo = Number(hasta) || 0;
  if (carta) return { abre: false, hasta: plazo };
  if (t < plazo) return { abre: false, hasta: t + TRAS_ABRIR_MS };
  return { abre: true, hasta: plazo };
}

/**
 * El único guardia de Abrir. Cubre el plazo de la carta y el de «¿Salir?».
 * Mientras el diálogo sigue vigente no se abre y tampoco se alarga el de la carta.
 * Un toque ignorado por la carta sí vuelve a contar 1 s.
 */
export function pulsoAbrir({ ahora, hastaPaso = 0, hastaDialogo = 0, carta = false } = {}) {
  const t = Number(ahora) || 0;
  const paso = Number(hastaPaso) || 0;
  const dialogo = Number(hastaDialogo) || 0;
  if (carta || (dialogo && t < dialogo)) return { abre: false, hastaPaso: paso, hastaDialogo: dialogo };
  const pulso = pulsoTrasCarta({ ahora: t, hasta: paso, carta: false });
  return { abre: pulso.abre, hastaPaso: pulso.hasta, hastaDialogo: dialogo };
}

/** Al entrar en la tienda, Abrir espera 1 s y el foco cae en la vitrina. */
export function entradaTienda({ ahora, hasta = 0 } = {}) {
  const t = Number(ahora) || 0;
  const previo = Number(hasta) || 0;
  return { hasta: Math.max(previo, t + TRAS_ABRIR_MS), foco: "vitrina" };
}

/**
 * Al abrir una ficha, Conseguir espera 1 s.
 * En la tele el foco cae en Volver, no en Conseguir.
 */
export function entradaDetalle({ ahora, hasta = 0, tv = false, tiene = false } = {}) {
  const t = Number(ahora) || 0;
  const previo = Number(hasta) || 0;
  return { hasta: Math.max(previo, t + TRAS_ABRIR_MS), foco: tv || tiene ? "volver" : "conseguir" };
}
