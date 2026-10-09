// Medidas que tienen que caber: 4 barras con controles de 64 px en 360,
// y el eje de 0 a 20 en la tele con margen.

export const CONTROL_PX = 64;
export const TELEFONO_ANCHO = 360;
export const TV_ALTO = 720;
export const TV_MARGEN = 36;
export const EJE20_ALTO_TV = 520;
export const CROMO_TV = 88;

export function controlesCaben(categorias = 4, ancho = TELEFONO_ANCHO, control = CONTROL_PX) {
  if (categorias < 1 || categorias > 4) return false;
  return control * 2 + 24 <= ancho;
}

export function eje20Cabe(alto = TV_ALTO, margen = TV_MARGEN, eje = EJE20_ALTO_TV, cromo = CROMO_TV) {
  return margen * 2 + eje + cromo <= alto;
}

export function animalesEnFila(ancho = TELEFONO_ANCHO, control = CONTROL_PX) {
  return Math.max(1, Math.floor(ancho / control));
}
