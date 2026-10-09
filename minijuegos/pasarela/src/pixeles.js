// Estampados dibujados por Noelia (#81): pixel art de 16×16 con la paleta del juego. Lógica pura: pintar, rellenar,
// espejo, deshacer, y guardar comprimido en el progreso. Ver docs/JUEGO.md § Dibujar estampados y ADR 16.
//
// En memoria un dibujo es una lista de lado×lado "fichas", renglón por renglón desde arriba:
//   ""  transparente · "P" el color principal de la prenda · "S" el secundario · "rosa", "negro"… un color de colores.json
// Guardado (en progreso.dibujos):
//   { id: "px-…", nombre: "Mi gatito", lado: 16, paleta: ["negro", "rosa"], datos: "17.3P0a…", fecha }
//   datos: corridas comprimidas (run-length): un número (si es más de 1) y un caracter. "." transparente, "P", "S", y
//   "a"–"z" = el color en esa posición de "paleta". Un dibujo típico ocupa entre 50 y 400 caracteres.

/** Lado del dibujo (pixeles). 16: cuadros de ~20 px en un teléfono, fáciles para un dedo de 7 años (ADR 16) */
export const LADO = 16;

// Letras para los colores de la paleta (no números: los números son las cuentas de las corridas)
const CHARS = "abcdefghijklmnopqrstuvwxyz";

/** Un dibujo vacío (todo transparente) */
export const vacio = (lado = LADO) => Array(lado * lado).fill("");

/**
 * Pinta una celda (y su espejo, si está prendido). Regresa una lista nueva (la de antes no cambia: para deshacer).
 * @param {string[]} celdas
 * @param {number} i índice de la celda
 * @param {string} ficha "", "P", "S" o un id de color
 * @param {{ lado?: number, espejo?: boolean }} [op]
 */
export function pintar(celdas, i, ficha, op = {}) {
  const lado = op.lado || LADO;
  if (!(i >= 0 && i < celdas.length)) return celdas;
  const j = espejoDe(i, lado);
  if (celdas[i] === ficha && (!op.espejo || celdas[j] === ficha)) return celdas;
  const r = celdas.slice();
  r[i] = ficha;
  if (op.espejo) r[j] = ficha;
  return r;
}

/** La celda del otro lado (espejo izquierda ↔ derecha) */
export const espejoDe = (i, lado = LADO) => Math.floor(i / lado) * lado + (lado - 1 - (i % lado));

/**
 * Cubeta: rellena la mancha del mismo color que la celda tocada (vecinos arriba, abajo, izquierda, derecha).
 * Con espejo, rellena también desde la celda del otro lado.
 */
export function rellenar(celdas, i, ficha, op = {}) {
  const lado = op.lado || LADO;
  if (!(i >= 0 && i < celdas.length)) return celdas;
  const r = celdas.slice();
  const llenar = (k) => {
    const de = r[k];
    if (de === ficha) return;
    const pila = [k];
    while (pila.length) {
      const c = pila.pop();
      if (r[c] !== de) continue;
      r[c] = ficha;
      const x = c % lado, y = Math.floor(c / lado);
      if (x > 0) pila.push(c - 1);
      if (x < lado - 1) pila.push(c + 1);
      if (y > 0) pila.push(c - lado);
      if (y < lado - 1) pila.push(c + lado);
    }
  };
  llenar(i);
  if (op.espejo) llenar(espejoDe(i, lado));
  return r;
}

/**
 * Historial para deshacer: guarda el estado de antes de cada trazo (un trazo = dedo abajo → arriba, o un OK).
 * @param {string[][]} historial
 * @param {string[]} antes
 * @param {number} [max]
 */
export function recordar(historial, antes, max = 40) {
  const h = historial.length && historial[historial.length - 1] === antes ? historial : [...historial, antes];
  return h.length > max ? h.slice(h.length - max) : h;
}

/** Deshacer: { celdas, historial } con el último estado guardado (o lo mismo si no hay) */
export function deshacer(historial, celdas) {
  if (!historial.length) return { celdas, historial };
  return { celdas: historial[historial.length - 1], historial: historial.slice(0, -1) };
}

/** Las celdas en línea recta de a a b (para que un trazo rápido con el dedo no deje huecos) */
export function linea(a, b, lado = LADO) {
  const x0 = a % lado, y0 = Math.floor(a / lado), x1 = b % lado, y1 = Math.floor(b / lado);
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  const r = [];
  for (let k = 1; k <= n; k++) r.push(Math.round(y0 + ((y1 - y0) * k) / n) * lado + Math.round(x0 + ((x1 - x0) * k) / n));
  return r;
}

/** ¿Está vacío? */
export const estaVacio = (celdas) => celdas.every((c) => !c);

/**
 * Comprime un dibujo para guardarlo.
 * @param {string[]} celdas
 * @returns {{ lado: number, paleta: string[], datos: string }}
 */
export function comprimir(celdas, lado = LADO) {
  const paleta = [];
  const car = (f) => {
    if (!f) return ".";
    if (f === "P" || f === "S") return f;
    let k = paleta.indexOf(f);
    if (k < 0) { if (paleta.length >= CHARS.length) return "."; paleta.push(f); k = paleta.length - 1; }
    return CHARS[k];
  };
  let datos = "", prev = null, n = 0;
  const soltar = () => { if (prev !== null) datos += (n > 1 ? n : "") + prev; };
  for (const f of celdas) {
    const c = car(f);
    if (c === prev) n++;
    else { soltar(); prev = c; n = 1; }
  }
  soltar();
  return { lado, paleta, datos };
}

/**
 * Descomprime lo guardado. Tolera basura: lo que no se entienda queda transparente, y siempre regresa lado×lado celdas.
 * @param {{ lado?: number, paleta?: string[], datos?: string }} g
 * @param {(id: string) => boolean} [existe] si el color existe (si no, se cambia por "negro")
 * @returns {string[]}
 */
export function descomprimir(g, existe = () => true) {
  const lado = g && Number.isInteger(g.lado) && g.lado >= 4 && g.lado <= 32 ? g.lado : LADO;
  const total = lado * lado, r = [];
  const paleta = Array.isArray(g && g.paleta) ? g.paleta.map((c) => (typeof c === "string" && existe(c) ? c : "negro")) : [];
  const txt = typeof (g && g.datos) === "string" ? g.datos : "";
  const re = /(\d*)([.PSa-z])/g;
  let m;
  while ((m = re.exec(txt)) && r.length < total) {
    const n = Math.min(m[1] ? parseInt(m[1], 10) : 1, total - r.length);
    const c = m[2];
    const f = c === "." ? "" : c === "P" || c === "S" ? c : paleta[CHARS.indexOf(c)] || "";
    for (let k = 0; k < n; k++) r.push(f);
  }
  while (r.length < total) r.push("");
  return r;
}

/** ¿Usa los colores de la prenda (P o S)? Entonces cambia de color con la prenda */
export const usaColoresDePrenda = (celdas) => celdas.some((f) => f === "P" || f === "S");

/**
 * Revisa un dibujo guardado (de otra versión o roto).
 * @returns {object|null}
 */
export function limpiarDibujo(x, idx, maxNombre = 18) {
  if (!x || typeof x !== "object" || typeof x.id !== "string" || !/^px-[a-z0-9-]{1,24}$/.test(x.id)) return null;
  const celdas = descomprimir(x, (c) => idx.colores.has(c));
  if (estaVacio(celdas)) return null;
  const g = comprimir(celdas, Math.round(Math.sqrt(celdas.length)));
  const nombre = String(x.nombre == null ? "" : x.nombre).replace(/[\u0000-\u001f]/g, " ").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, maxNombre);
  return { id: x.id, nombre: nombre || "Mi dibujo", ...g, fecha: Number.isFinite(x.fecha) ? x.fecha : 0 };
}

/**
 * Pone los dibujos en idx.estampados (como estampados "propios") y quita los de antes. Como registrarDisenos: cambia idx.
 * Cada uno lleva .pixeles = { lado, celdas, hex: { idColor: "#hex" }, clave } (kit/3d/pintar.js → pintarPixeles).
 */
export function registrarDibujos(idx, dibujos) {
  for (const [id, e] of [...idx.estampados]) if (e.propio) idx.estampados.delete(id);
  for (const d of dibujos || []) {
    const celdas = descomprimir(d, (c) => idx.colores.has(c));
    const hex = {};
    for (const c of d.paleta || []) if (idx.colores.has(c)) hex[c] = idx.colores.get(c).hex;
    idx.estampados.set(d.id, { id: d.id, es: d.nombre, en: "my drawing", etiquetas: [], propio: true,
      pixeles: { lado: d.lado || LADO, celdas, hex, clave: d.datos + "|" + (d.paleta || []).join(","), deLaPrenda: usaColoresDePrenda(celdas) } });
  }
  return idx;
}
