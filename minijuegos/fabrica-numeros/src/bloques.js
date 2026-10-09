// Bloques de base 10. `grupo` y los colores están copiados de sumas-restas/src/dibujos.js
// (la pista de decenas y unidades) para que Noelia los reconozca. No se suben al kit:
// cada juego es una isla. Las placas, barras y cubitos que se ven en pantalla son los SVG de img/.

export const C1 = "#4cb3ff";
export const C2 = "#ff6b4a";
const TACHE = "#2b2236";

const tache = (cx, cy, w, h) => `<path d="M${cx - w} ${cy - h}L${cx + w} ${cy + h}M${cx + w} ${cy - h}L${cx - w} ${cy + h}" stroke="${TACHE}" stroke-width="2.5" stroke-linecap="round"/>`;

// Dibuja `decenas` barras y `unidades` cuadritos a partir de x.
// Medidas de sumas-restas: Q = 9, barra 11×92, cubito ~10×10, rx 2, trazo rgba(0,0,0,.25).
export function grupo(x, decenas, unidades, color, tacheD = 0, tacheU = 0, rotas = 0) {
  const Q = 9, s0 = [];
  let cx = x;
  for (let i = 0; i < decenas; i++) {
    s0.push(`<rect x="${cx}" y="2" width="${Q + 2}" height="${10 * Q + 2}" rx="2" fill="${color}" stroke="rgba(0,0,0,.25)"/>`);
    for (let k = 1; k < 10; k++) s0.push(`<line x1="${cx}" x2="${cx + Q + 2}" y1="${2 + k * Q + 1}" y2="${2 + k * Q + 1}" stroke="rgba(0,0,0,.18)"/>`);
    if (i >= decenas - tacheD) s0.push(tache(cx + (Q + 2) / 2, 2 + 5 * Q, 10, 46));
    cx += Q + 7;
  }
  for (let i = 0; i < unidades; i++) {
    const col = Math.floor(i / 5), fila = i % 5, ux = cx + col * (Q + 4), uy = 2 + 10 * Q - (fila + 1) * (Q + 4) + 4;
    const rota = i < rotas;
    s0.push(`<rect x="${ux}" y="${uy}" width="${Q + 1}" height="${Q + 1}" rx="2" fill="${color}" stroke="${rota ? TACHE : "rgba(0,0,0,.25)"}" ${rota ? 'stroke-dasharray="2 2"' : ""}/>`);
    if (i >= unidades - tacheU) s0.push(tache(ux + (Q + 1) / 2, uy + (Q + 1) / 2, 6, 6));
  }
  const ancho = cx - x + Math.ceil(unidades / 5) * (Q + 4);
  return { s: s0.join(""), ancho: Math.max(ancho, 1) };
}
