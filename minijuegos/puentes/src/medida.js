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
  if (unidad === "in") return { archivo: "regla-in-6", max: 6, ancho: 509.2, cero: 26, unidadX: 475.2 };
  if (tv) return { archivo: "regla-cm-20", max: 20, ancho: 652, cero: 26, unidadX: 618 };
  return { archivo: "regla-cm-12", max: 12, ancho: 412, cero: 26, unidadX: 378 };
}

// Ancho útil del hueco: el mismo recorte que usa la pantalla
// (padding del juego, tope de la tele).
export function anchoDeVista(viewport, tv = false) {
  const w = Number(viewport) || 0;
  const pad = tv ? 80 : 28;
  return Math.max(220, Math.min(w - pad, 980));
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

// Solo para pruebas y la guía: el juego NO enciende «Listo» al coincidir,
// porque eso le dice la respuesta (#74).
export function listoBrilla(valor, correcta) {
  return (valor | 0) === (correcta | 0);
}

// «Listo» siempre se puede pulsar. Un número mal es un fallo, nunca un silencio (#74).
export function resultadoListo(valor, correcta, fase) {
  if (fase === "estimaLibre") return cerca(valor, correcta) ? "bien" : "fallo";
  if ((valor | 0) === (correcta | 0)) return "bien";
  return "fallo";
}

// Errores suaves: el primer fallo da la pista completa y otra oportunidad;
// el segundo enseña la respuesta. Ninguno de los dos cuenta a la primera.
export const INTENTOS = 2;
export function trasFallo(fallos) {
  return (fallos | 0) >= INTENTOS ? "revelar" : "otra";
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

// La suma justa con todas las piezas. El juego ya no la usa para encender «Cruzar».
export function cruzarBrilla(elegidas, objetivo, piezas) {
  return elegidas.length === piezas && suma(elegidas) === objetivo;
}

// «Cruzar» se activa al poner todas las tablas, sin decir si la suma está bien.
export function cruzarListo(elegidas, piezas) {
  return (elegidas || []).length === (piezas | 0);
}

export function resultadoCruzar(elegidas, objetivo, piezas) {
  if (!cruzarListo(elegidas, piezas)) return "incompleto";
  const s = suma(elegidas);
  if (s === objetivo) return "bien";
  return s < objetivo ? "corta" : "sobra";
}

// Cada tabla ofrecida se usa una vez: se guarda el índice del botón, no el largo.
export function puedeUsar(usadas, i, piezas) {
  const u = usadas || [];
  return !u.includes(i | 0) && u.length < (piezas | 0);
}

// El árbol y su tabla de 10 cm, a la misma escala y sin pasar del alto disponible.
// La escala no depende del árbol de hoy: uno de 14 se ve más alto que uno de 8.
export const ARBOL_MAX = 14;
export function escalaArbol({ pxPorCm = 20, altoVista = 640 } = {}) {
  const tope = Math.max(160, Math.min(340, (Number(altoVista) || 640) * 0.4));
  return Math.min(Number(pxPorCm) || 20, tope / ARBOL_MAX);
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

// Alto del arte de la orilla, en las mismas unidades que la regla.
// El ancho nativo (120) cabe junto al cero sin aplastar el dibujo.
export const BANCO_ARTE = 120;

// Una escala por unidad y viewport. No depende del hueco de este cruce,
// así la referencia y el río usan los mismos px por centímetro o pulgada.
// Cabe la orilla y la regla entera, con su unidad, dentro del ancho.
export function escalaFija({ unidad = "cm", tv = false, ancho = 320, corta = false } = {}) {
  const uNombre = unidad === "in" ? "in" : "cm";
  const reg = reglaArchivo(uNombre, !!(tv && uNombre !== "in" && !corta));
  const unit = uDe(uNombre);
  const tope = tv ? 168 : 128;
  const libre = Math.max(1, ancho);
  const conOrilla = libre / (BANCO_ARTE + reg.ancho - reg.cero);
  const u = Math.min(libre / reg.ancho, tope / 160, conOrilla);
  return { u, unit, px: unit * u, reg };
}

// Ancho en las mismas unidades que la escena. El clip de 1 pulgada
// se dibuja a 1 pulgada, no con el viewBox de 3 cm.
export function cajaReferencia(id) {
  if (id === "tabla10") return { w: 10 * U_CM, h: 36, unidades: 10 };
  if (id === "clip") return { w: 3 * U_CM, h: 30, unidades: 3 };
  if (id === "tabla1in") return { w: U_IN, h: 36, unidades: 1 };
  if (id === "clipin") return { w: U_IN, h: 30 * (U_IN / (3 * U_CM)), unidades: 1 };
  return { w: U_CM, h: U_CM, unidades: 1 };
}

// Los bloques del nivel 1 no caben en la regla de 12: cada uno apunta a ~40 px.
export function escalaBloques({ longitud = 1, ancho = 332 } = {}) {
  const n = Math.max(1, longitud | 0);
  const banco = 36;
  const ideal = 40;
  let hueco = n * ideal;
  let orilla = banco;
  if (orilla * 2 + hueco > ancho) {
    hueco = Math.max(n * 28, ancho - orilla * 2);
    if (orilla * 2 + hueco > ancho) {
      orilla = 18;
      hueco = Math.max(n, ancho - orilla * 2);
    }
  }
  return { banco: orilla, hueco, cubo: hueco / n };
}

// Todas las tablas de una fila comparten el alto. El ancho es proporcional
// al largo, y la más larga cabe en su botón.
export function altoComunTablas(largos, unidad, ancho) {
  const lista = Array.isArray(largos) && largos.length ? largos : [1];
  const maxN = Math.max(...lista.map((n) => Math.abs(n | 0)), 1);
  const cols = Math.max(1, lista.length);
  const slot = Math.max(48, (Math.max(1, ancho) - 8 * (cols + 1)) / cols);
  const unit = uDe(unidad === "in" ? "in" : "cm");
  return Math.max(8, Math.min(32, (slot * 36) / (maxN * unit)));
}

export function cajaTabla(n, unidad, alto) {
  const unit = uDe(unidad === "in" ? "in" : "cm");
  const h = alto || 32;
  return { w: (Math.max(1, n | 0) * unit / 36) * h, h };
}

// El hueco, en px, con la escala fija. Sirve para comprobar que no cambia
// de un cruce a otro.
export function huecoEnPx({ unidad = "cm", longitud = 1, tv = false, ancho = 320, desplaza = 0, corta = false } = {}) {
  const lay = layoutRegla({ unidad, longitud, tv, ancho, desplaza, corta });
  return { u: lay.u, unit: lay.unit, px: lay.unit * lay.u, reg: lay.reg, gapU: lay.gapU, gapPx: lay.gapPx, pos: lay.pos };
}

// La orilla izquierda termina en el cero de la regla sin correr.
// El hueco sale de ahí. La regla puede deslizarse; la marca del final no.
export function layoutRegla({
  unidad = "cm", longitud = 1, tv = false, ancho = 320,
  desplaza = 0, corta = false, llenar = false,
} = {}) {
  const uNombre = unidad === "in" ? "in" : "cm";
  const escala = escalaFija({ unidad: uNombre, tv, ancho, corta });
  const { unit, reg, u } = escala;
  const largo = Math.max(1, Number(longitud) || 1);
  const gapU = largo * unit;
  const slide = Number(desplaza) || 0;
  if (llenar) {
    const bancoU = 90;
    const total = bancoU * 2 + gapU;
    const tope = tv ? 168 : 128;
    const uD = Math.min(Math.max(1, ancho) / total, tope / 160);
    const bancoI = bancoU * uD;
    const gapPx = gapU * uD;
    const bancoD = bancoU * uD;
    const w = bancoI + gapPx + bancoD;
    return {
      u: uD, unit, reg, gapU, gapPx, bancoI, bancoD, w,
      marcaX: bancoI + gapPx, unidadX: null,
      reglaX: 0, reglaW: w, alto: Math.max(64, 160 * uD), rielH: Math.max(48, 78 * uD),
      pos: { left: bancoU, x: 0, gapU },
    };
  }
  const bancoI = BANCO_ARTE * u;
  const gapPx = gapU * u;
  const w = (BANCO_ARTE - reg.cero + reg.ancho) * u;
  const bancoD = Math.max(0, w - bancoI - gapPx);
  const reglaX = (BANCO_ARTE - reg.cero + slide * unit) * u;
  const unidadX = (BANCO_ARTE + reg.unidadX + slide * unit) * u;
  return {
    u, unit, reg, gapU, gapPx, bancoI, bancoD, w,
    marcaX: bancoI + gapPx, unidadX,
    reglaX, reglaW: reg.ancho * u,
    alto: Math.max(64, 160 * u), rielH: Math.max(48, 78 * u),
    pos: { left: BANCO_ARTE, x: BANCO_ARTE - reg.cero + slide * unit, gapU },
  };
}

// «Cero» señala la orilla, aunque la regla esté corrida sobre el agua.
// «Marca» señala el final del hueco, o el inicio si el cero quedó a la izquierda.
export function xDeFlecha({ blanco = "", bancoI = 0, marcaX = 0, desplaza = 0 } = {}) {
  if (blanco === "marca") return Number(desplaza) < 0 ? bancoI : marcaX;
  return bancoI;
}

export function brilloCeroVisible({ desplaza = 0, fasePista = "frase", forzar = false, nivel = 1 } = {}) {
  if (forzar) return true;
  if ((desplaza | 0) === 0) return false;
  if ((nivel | 0) === 7 && (fasePista === "encima" || fasePista === "completa")) return true;
  if ((nivel | 0) === 2 && (fasePista === "encima" || fasePista === "completa")) return true;
  return false;
}
