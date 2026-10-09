// Medidas enteras. 1 cm = 30 unidades SVG y 1 pulgada = 76.2.
// La voz dice «centímetros» y «pulgadas», nunca la abreviatura.

import { revolver } from "./rng.js";

export const U_CM = 30;
export const U_IN = 76.2;
export const DESPLAZA_MIN = -2;
export const DESPLAZA_MAX = 4;
export const MARGEN_ESTIMA = 2;

export function uDe(unidad) {
  return unidad === "in" ? U_IN : U_CM;
}

export function marcaAlFinal(longitud, desplaza) {
  return (longitud | 0) + (desplaza | 0);
}

// Con el cero en la orilla, la marca del final es la longitud.
// Si la regla está corrida, se cuentan los espacios (fin − inicio).
export function longitudReal(marcaInicio, marcaFin) {
  return (marcaFin | 0) - (marcaInicio | 0);
}

export function ceroEnOrilla(desplaza) {
  return (desplaza | 0) === 0;
}

export function moverRegla(desplaza, delta) {
  const d = (desplaza | 0) + (delta < 0 ? -1 : 1);
  return Math.max(DESPLAZA_MIN, Math.min(DESPLAZA_MAX, d));
}

// Confirmar con el cero fuera de la orilla enciende la pista y no es a la primera.
export function confirmarCero(desplaza) {
  if ((desplaza | 0) === 0) return { puesta: true, brilloCero: false, anulaPrimera: false };
  return { puesta: false, brilloCero: true, anulaPrimera: true };
}

export function reglaArchivo(unidad, tv) {
  if (unidad === "in") return { archivo: "regla-in-6", max: 6, ancho: 509.2, cero: 26 };
  if (tv) return { archivo: "regla-cm-20", max: 20, ancho: 652, cero: 26 };
  return { archivo: "regla-cm-12", max: 12, ancho: 412, cero: 26 };
}

export function decirUnidad(n, unidad) {
  const k = Math.abs(n | 0);
  if (unidad === "in") return k === 1 ? "1 pulgada" : `${k} pulgadas`;
  if (unidad === "bloque") return k === 1 ? "1 bloque" : `${k} bloques`;
  return k === 1 ? "1 centímetro" : `${k} centímetros`;
}

export function hablaSegura(texto) {
  return String(texto || "")
    .replace(/[▲▼◀▶+−=×]/g, " ")
    .replace(/\bcm\b/gi, "centímetros")
    .replace(/\bin\b/gi, "pulgadas")
    .replace(/\s+/g, " ")
    .trim();
}

export function cerca(dicho, real, margen = MARGEN_ESTIMA) {
  return Math.abs((dicho | 0) - (real | 0)) <= margen;
}

export function opcionesCerca(real, rnd, { separacion = 3, cuantas = 3, min = 1, max = 30 } = {}) {
  const malos = [];
  let guard = 0;
  while (malos.length < cuantas - 1 && guard < 60) {
    guard++;
    const signo = rnd() < 0.5 ? -1 : 1;
    const n = real + signo * (separacion + Math.floor(rnd() * 3));
    if (n < min || n > max || n === real || malos.includes(n) || cerca(n, real)) continue;
    malos.push(n);
  }
  let extra = separacion;
  while (malos.length < cuantas - 1) {
    const n = Math.min(max, Math.max(min, real + extra));
    extra++;
    if (n !== real && !malos.includes(n) && !cerca(n, real)) malos.push(n);
    if (extra > 40) break;
  }
  return revolver(rnd, [real, ...malos.slice(0, cuantas - 1)]);
}

export function opcionesNumero(real, rnd, min, max) {
  const cand = [];
  for (let d = 1; d <= 5; d++) {
    if (real - d >= min) cand.push(real - d);
    if (real + d <= max) cand.push(real + d);
  }
  const malos = [];
  for (const n of revolver(rnd, cand)) {
    if (malos.length >= 2) break;
    if (!malos.includes(n)) malos.push(n);
  }
  while (malos.length < 2) {
    const n = Math.min(max, real + malos.length + 1);
    if (!malos.includes(n) && n !== real) malos.push(n);
    else break;
  }
  return revolver(rnd, [real, ...malos]);
}

export function valorInicial(correcta, max) {
  const v = (correcta | 0) === 1 ? 2 : 1;
  return Math.max(0, Math.min(max, v));
}

export function ajustarValor(valor, delta, max) {
  const d = delta < 0 ? -1 : 1;
  return Math.max(0, Math.min(max, (valor | 0) + d));
}

export function listoBrilla(valor, correcta) {
  return (valor | 0) === (correcta | 0);
}

// «Listo» bien sigue. En la comparación un número mal es un fallo, no un silencio.
export function resultadoListo(valor, correcta, fase) {
  if (fase === "estimaLibre") return cerca(valor, correcta) ? "bien" : "fallo";
  if ((valor | 0) === (correcta | 0)) return "bien";
  if (fase === "comparar") return "fallo";
  return "ignorar";
}

export function suma(nums) {
  return (nums || []).reduce((s, n) => s + n, 0);
}

// Subconjunto de exactamente `piezas` largos (o cualquiera, si piezas es null) que suma el objetivo.
export function combinacion(largos, objetivo, piezas = null) {
  const n = largos.length;
  let hallada = null;
  const acc = [];
  const walk = (i, sum) => {
    if (hallada) return;
    const sirve = piezas == null ? acc.length > 0 : acc.length === piezas;
    if (sirve && sum === objetivo) { hallada = acc.slice(); return; }
    if (i >= n || sum > objetivo) return;
    if (piezas != null && acc.length >= piezas) return;
    walk(i + 1, sum);
    acc.push(largos[i]);
    walk(i + 1, sum + largos[i]);
    acc.pop();
  };
  walk(0, 0);
  return hallada;
}

export function contieneSolucion(ofrecidas, solucion) {
  const bag = ofrecidas.slice();
  for (const p of solucion) {
    const i = bag.indexOf(p);
    if (i < 0) return false;
    bag.splice(i, 1);
  }
  return true;
}

export function cruzarBrilla(elegidas, objetivo, piezas) {
  return elegidas.length === piezas && suma(elegidas) === objetivo;
}

export function cubosDe(longitud, modo) {
  const n = longitud | 0;
  if (modo === "hueco") {
    return Array.from({ length: n }, (_, i) => ({ x: i < n - 1 ? i : i + 1, coral: i === n - 1 }));
  }
  if (modo === "encimado") {
    return Array.from({ length: n }, (_, i) => ({ x: Math.round(i * 0.55 * 100) / 100, coral: i === n - 1 }));
  }
  return Array.from({ length: n }, (_, i) => ({ x: i, coral: false }));
}

export function seMidioBien(modo) {
  return modo === "bien";
}

export function spanBloques(cubos) {
  if (!cubos.length) return 1;
  return Math.max(...cubos.map((c) => c.x)) + 1;
}

export function brilloCeroVisible({ desplaza = 0, fasePista = "frase", forzar = false, nivel = 1 } = {}) {
  if (forzar) return true;
  if ((desplaza | 0) === 0) return false;
  if ((nivel | 0) === 7 && (fasePista === "encima" || fasePista === "completa")) return true;
  if ((nivel | 0) === 2 && (fasePista === "encima" || fasePista === "completa")) return true;
  return false;
}
