// La luz del mundo sigue la hora real (#hora-real): el sol recorre el cielo según la hora del aparato y el lugar
// (mundo/mundo.json → luz: lat, lon), y el cielo, la niebla, la luz y las estrellas se van poniendo de noche o de día.
// Lógica pura: sin DOM ni Three.js (se prueba en Node). Ver docs/MUNDO.md § Luz y hora.

const RAD = Math.PI / 180;

/** Días desde J2000 (2000-01-01 12:00 UTC), con fracción */
function diasJ2000(fecha) {
  return (fecha.getTime() - 946728000000) / 86400000;
}

/**
 * Posición del sol (algoritmo solar simplificado de NOAA; error de minutos, de sobra para pintar un cielo).
 * @returns {{ altitud: number, azimut: number, direccion: {x:number,y:number,z:number} }}
 *   altitud en grados (0 = horizonte); azimut en grados desde el norte (90 = este);
 *   direccion: unitario en el mundo, con x hacia el este (+x) y el norte hacia el fondo (−z), y hacia arriba (+y).
 */
export function posicionSol(fecha, lat, lon) {
  const n = diasJ2000(fecha);
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * RAD;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const eps = (23.439 - 0.0000004 * n) * RAD;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const gmst = ((280.46061837 + 360.98564736629 * n) % 360) * RAD;
  const H = gmst + lon * RAD - ra;
  const phi = lat * RAD;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const azS = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  const azN = azS + Math.PI;
  return {
    altitud: alt / RAD,
    azimut: ((azN / RAD) % 360 + 360) % 360,
    direccion: { x: Math.cos(alt) * Math.sin(azN), y: Math.sin(alt), z: -Math.cos(alt) * Math.cos(azN) },
  };
}

const aRGB = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const aHex = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

/** Mezcla dos colores hex: t = 0 → a, t = 1 → b */
export function mezclarColor(a, b, t) {
  const A = aRGB(a), B = aRGB(b);
  return aHex(A.map((v, i) => v + (B[i] - v) * t));
}

const suave = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
const mezclar = (a, b, t) => a + (b - a) * t;

/**
 * La luz de este momento.
 * @param {Date} fecha
 * @param {{ lat: number, lon: number, dia: object, noche: object, horizonte: object }} cfg (mundo.json → luz)
 * @returns {{ fase: string, altitud: number, cielo: string, niebla: string, luzCielo: string, luzSuelo: string,
 *   luzCieloI: number, sol: string, solI: number, direccion: {x:number,y:number,z:number}, estrellas: number }}
 */
export function luzAhora(fecha, cfg) {
  const { altitud, direccion } = posicionSol(fecha, cfg.lat, cfg.lon);
  const d = suave((altitud + 6) / 16);                    // 0 de noche (≤ −6°) → 1 de día (≥ 10°)
  const h = Math.max(0, 1 - Math.abs(altitud) / 8);       // amanecer y atardecer: el color naranja cerca del horizonte
  const N = cfg.noche, D = cfg.dia, H = cfg.horizonte;
  const tono = (k) => mezclarColor(mezclarColor(N[k], D[k], d), H[k] || H.cielo, h * 0.6);
  // Con el sol abajo, la luz viene de arriba y de un lado (la luna): así el mundo nunca queda a oscuras del todo
  let dir = direccion;
  if (altitud < 0) dir = { x: -direccion.x, y: Math.max(0.35, -direccion.y), z: -direccion.z };
  else dir = { ...direccion, y: Math.max(0.12, direccion.y) };
  const fase = altitud < -6 ? "noche" : altitud < 0 ? "crepusculo" : altitud < 10 ? "amanecer" : "dia";
  return {
    fase,
    altitud,
    cielo: tono("cielo"),
    niebla: tono("niebla"),
    luzCielo: mezclarColor(N.luzCielo, D.luzCielo, d),
    luzSuelo: mezclarColor(N.luzSuelo, D.luzSuelo, d),
    luzCieloI: mezclar(N.luzCieloI, D.luzCieloI, d),
    sol: mezclarColor(mezclarColor(N.sol, D.sol, d), H.sol, h * 0.7),
    solI: mezclar(N.solI, D.solI, d),
    direccion: dir,
    estrellas: suave((-altitud - 2) / 8),                 // aparecen cuando el sol ya está 2° bajo el horizonte
  };
}
