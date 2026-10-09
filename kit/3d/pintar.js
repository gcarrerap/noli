// Colores de los SVG de la ropa (patrones y estampados): cambiar los marcadores {p} {s} {t} {m} {c} por colores de
// verdad. Sin Three.js: lo usan las texturas 3D (texturas.js) y el dibujo 2D (minijuegos/pasarela/src/ui/dibujo2d.js).
// Qué es cada marcador: texturas.js (arriba).

/** Luminosidad (0 a 1) de un color #rrggbb */
export function luz(hex) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** La tinta que contrasta con un color: casi negro sobre colores claros, blanco sobre oscuros */
export const tinta = (hex) => (luz(hex) > 0.55 ? "#2b2236" : "#ffffff");

/** Mezcla dos colores #rrggbb (k = 0 → a, 1 → b) */
export function mezcla(a, b, k = 0.5) {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const c = (s) => Math.round(((x >> s) & 255) * (1 - k) + ((y >> s) & 255) * k);
  return "#" + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1);
}

/**
 * Cambia los marcadores de color de un SVG por colores de verdad.
 * @param {string} svg texto del SVG
 * @param {{ p: string, s?: string, c?: string }} col colores #hex
 * @returns {string}
 */
export function pintarSVG(svg, col) {
  const t = tinta(col.p);
  const vals = { p: col.p, s: col.s || "#ffffff", t, m: mezcla(col.p, t, 0.55), c: col.c || t };
  return svg.replace(/\{([pstmc])\}/g, (_, k) => vals[k]);
}

/** Lo de adentro de un <svg>…</svg> (para meterlo en otro SVG: patrones y estampados del dibujo 2D) */
export function interiorSVG(svg) {
  const i = svg.indexOf(">", svg.indexOf("<svg")), j = svg.lastIndexOf("</svg>");
  return i < 0 || j < 0 ? "" : svg.slice(i + 1, j);
}
