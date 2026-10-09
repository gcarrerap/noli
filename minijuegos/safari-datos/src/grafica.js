// Geometría de las barras y de «¿cuántos más?».
// La línea punteada sale de la barra más baja y la diferencia se sombrea
// con los SVG compartidos con Puentes (diferencia.svg y linea-punteada.svg).
// 1 animal = 30 de alto. La base del eje de 10 está en y = 300; la de 20, en y = 600.

export const UNIDAD = 30;
export const EJE_X = 40;
export const ANCHO_PLOT = 360;
export const BASE_10 = 300;
export const BASE_20 = 600;

export function baseDe(eje) {
  return eje === 20 ? BASE_20 : BASE_10;
}

export function ejeDe(cantidades) {
  const max = cantidades.reduce((m, n) => Math.max(m, n), 0);
  return max > 10 ? 20 : 10;
}

export function geometriaBarras(cantidades, eje) {
  const base = baseDe(eje);
  const n = Math.max(1, cantidades.length);
  const hueco = ANCHO_PLOT / n;
  const ancho = Math.min(58, hueco - 12);
  return cantidades.map((c, i) => ({
    i,
    cantidad: c,
    x: EJE_X + i * hueco + (hueco - ancho) / 2,
    ancho,
    base,
    y: base - c * UNIDAD,
    alto: c * UNIDAD,
  }));
}

// idBajo / idAlto son índices. La sombra cubre solo lo que la barra alta
// pasa de la baja, el mismo recorte que Puentes nivel 6.
export function geometriaDiferencia(cantidades, iBajo, iAlto, eje) {
  const barras = geometriaBarras(cantidades, eje);
  const bajo = barras[iBajo];
  const alto = barras[iAlto];
  const yLinea = bajo.y;
  const x1 = Math.min(bajo.x, alto.x);
  const x2 = Math.max(bajo.x + bajo.ancho, alto.x + alto.ancho);
  return {
    yLinea,
    linea: { x: x1, y: yLinea - 5, w: Math.max(0, x2 - x1), h: 10 },
    sombra: { x: alto.x, y: alto.y, w: alto.ancho, h: Math.max(0, yLinea - alto.y) },
  };
}

export function gruposPalitos(n) {
  const grupos = [];
  let r = Math.max(0, n | 0);
  while (r >= 5) { grupos.push(5); r -= 5; }
  if (r > 0) grupos.push(r);
  return grupos;
}

export function barrasCoinciden(alturas, metas) {
  if (!alturas || !metas || alturas.length !== metas.length) return false;
  return alturas.every((h, i) => h === metas[i]);
}

export function moverBarra(alturas, i, delta, max) {
  const next = alturas.slice();
  const tope = max == null ? 20 : max;
  const actual = next[i] || 0;
  next[i] = Math.max(0, Math.min(tope, actual + (delta > 0 ? 1 : -1)));
  return next;
}

export function indiceMasBajo(cantidades, iA, iB) {
  return cantidades[iA] <= cantidades[iB] ? iA : iB;
}

export function indiceMasAlto(cantidades, iA, iB) {
  return cantidades[iA] >= cantidades[iB] ? iA : iB;
}
