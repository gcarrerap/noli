// Dónde va cada animal dentro del recinto. Puro.
// Cada animal tiene su casilla y se pasea solo dentro de ella: así nunca se enciman y se pueden contar.
// Con `pares` (De 2 en 2) los animales van de dos en dos en cada casilla.

export function rejilla(casillas) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(casillas * 1.6)));
  const filas = Math.max(1, Math.ceil(casillas / cols));
  return { cols, filas };
}

// Devuelve { cols, filas, grupos: [{ col, fila, dx, dy, dur, retraso, animales }] } con x, y en casillas.
export function acomodar(n, rnd, pares = false) {
  const porGrupo = pares ? 2 : 1;
  const casillas = Math.ceil(n / porGrupo);
  const { cols, filas } = rejilla(casillas);
  const todas = [];
  for (let f = 0; f < filas; f++) for (let c = 0; c < cols; c++) todas.push({ col: c, fila: f });
  for (let i = todas.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [todas[i], todas[j]] = [todas[j], todas[i]]; }
  let quedan = n;
  const grupos = todas.slice(0, casillas).map((c) => {
    const animales = Math.min(porGrupo, quedan);
    quedan -= animales;
    return {
      ...c,
      animales,
      dx: Math.round((rnd() * 2 - 1) * 18),
      dy: Math.round((rnd() * 2 - 1) * 12),
      dur: +(2.2 + rnd() * 1.6).toFixed(2),
      retraso: +(-rnd() * 3).toFixed(2),
      espejo: rnd() < 0.5,
    };
  });
  grupos.sort((a, b) => a.fila - b.fila || a.col - b.col);
  return { cols, filas, grupos };
}

export const contados = (acomodo) => acomodo.grupos.reduce((s, g) => s + g.animales, 0);
