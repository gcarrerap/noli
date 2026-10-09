// Cruceros del bosque. Un turno son 6 cruces, de 1 o 2 fases.
// Centímetros primero; las pulgadas entran en el nivel 3.
// En Para papás se puede dejar una sola unidad.

import { entre, revolver } from "./rng.js";
import { combinacion, contieneSolucion, cubosDe, opcionesCerca, opcionesNumero, suma } from "./medida.js";

export const NIVELES_MAX = 7;
export const POR_TURNO = 6;
export const ZONAS = ["bosque", "pantano", "nieve"];
export const ANIMALES = ["conejo", "ardilla", "zorro", "tortuga", "mapache"];
export const HUECO = { bosque: "rio", pantano: "pantano", nieve: "nieve" };

export function zonaDe(i) {
  return ZONAS[Math.min(ZONAS.length - 1, Math.floor((i | 0) / 2))];
}

export function maxRegla(unidad, tv) {
  if (unidad === "in") return 6;
  if (unidad === "bloque") return 8;
  return tv ? 20 : 12;
}

export function maxPieza(unidad) {
  return unidad === "in" ? 8 : 20;
}

// Al principio las sumas caben en 20. Después suben (en la tele, hasta 100).
export function planSuma({ bien = 0, tv = false, unidad = "cm", facil = false } = {}) {
  const maxP = maxPieza(unidad);
  let tope;
  if (unidad === "in") tope = Math.min(16, maxP * 2);
  else if ((bien | 0) < 4 || facil) tope = 20;
  else tope = tv ? 100 : 40;
  tope = Math.min(tope, maxP * 5);
  if (facil) tope = Math.min(tope, 12);
  let piezas = 2;
  if (tope > maxP * 2) piezas = 3;
  if (tope > maxP * 3) piezas = 5;
  return { tope, piezas, maxP };
}

export function unidadDeCruce(nivel, ajuste = "ambas", indice = 0) {
  const n = nivel | 0;
  if (n <= 1) return "bloque";
  if (ajuste === "cm") return "cm";
  if (ajuste === "in") return "in";
  if (n === 2 || n === 6) return "cm";
  if (n === 3) return "in";
  return indice % 2 === 0 ? "cm" : "in";
}

function baseCruce(nivel, i, unidad, extra) {
  const zona = extra.zona || zonaDe(i);
  return {
    nivel, unidad, zona,
    hueco: extra.hueco || HUECO[zona] || "rio",
    animal: extra.animal || ANIMALES[i % ANIMALES.length],
    repaso: !!extra.repaso,
    desplazaInicial: 0,
    puedeMover: false,
    yaPuesta: false,
    referencia: null,
    margen: 0,
  };
}

function cruceBloques(base, rnd, facil) {
  const longitud = entre(rnd, facil ? 3 : 4, facil ? 6 : 8);
  const modo = facil ? "bien" : (rnd() < 0.34 ? "bien" : rnd() < 0.5 ? "hueco" : "encimado");
  return {
    ...base,
    tipo: "bloques",
    longitud,
    modoBloques: modo,
    cubos: cubosDe(longitud, modo),
    fases: modo === "bien" ? ["bien"] : ["bien", "cuantos"],
    opciones: opcionesNumero(longitud, rnd, 1, 10),
  };
}

function cruceMedir(base, rnd, facil, tv) {
  const max = maxRegla(base.unidad, tv);
  const longitud = entre(rnd, 3, facil ? Math.min(8, max) : max);
  const signos = [1, 2, -1, 2];
  const desplazaInicial = signos[Math.floor(rnd() * signos.length)];
  return {
    ...base,
    tipo: "medir",
    longitud,
    fases: ["poner", "tabla"],
    ofrecidas: opcionesNumero(longitud, rnd, 1, max),
    piezas: 1,
    solucion: [longitud],
    puedeMover: true,
    desplazaInicial,
  };
}

function cruceEstima(base, rnd, facil, tv, libre) {
  const max = maxRegla(base.unidad, tv);
  const longitud = entre(rnd, 3, facil ? Math.min(8, max) : max);
  const refs = base.unidad === "in" ? ["tabla1in", "clipin"] : ["cubito", "tabla10", "clip"];
  return {
    ...base,
    tipo: "estima",
    longitud,
    fases: [libre ? "estimaLibre" : "estima", "leer"],
    opciones: libre ? null : opcionesCerca(longitud, rnd, { min: 1, max: Math.max(max, longitud + 8) }),
    referencia: refs[Math.floor(rnd() * refs.length)],
    margen: libre ? 2 : 0,
    yaPuesta: true,
  };
}

export function armarSuma(rnd, { tope, piezas, maxP }) {
  const minSuma = piezas * 1;
  const maxSuma = Math.min(tope, piezas * maxP);
  const objetivo = entre(rnd, Math.max(4, minSuma), Math.max(4, maxSuma));
  const partes = Array(piezas).fill(1);
  let resta = objetivo - piezas;
  let guard = 0;
  while (resta > 0 && guard < 500) {
    guard++;
    const i = Math.floor(rnd() * piezas);
    if (partes[i] < maxP) { partes[i]++; resta--; }
  }
  return { objetivo: suma(partes), partes };
}

function cruceJuntar(base, rnd, opts) {
  const plan = planSuma({ bien: opts.bien | 0, tv: !!opts.tv, unidad: base.unidad, facil: !!opts.facil });
  if (opts.piezas) plan.piezas = opts.piezas;
  const { objetivo, partes } = armarSuma(rnd, plan);
  const ofrecidas = partes.slice();
  let guard = 0;
  const extras = plan.piezas >= 5 ? 1 : 2;
  while (ofrecidas.length < partes.length + extras && guard < 40) {
    guard++;
    const d = entre(rnd, 1, plan.maxP);
    if (!ofrecidas.includes(d)) ofrecidas.push(d);
  }
  return {
    ...base,
    tipo: "juntar",
    longitud: objetivo,
    fases: ["juntar"],
    ofrecidas: revolver(rnd, ofrecidas),
    solucion: partes.slice(),
    piezas: partes.length,
    yaPuesta: true,
    hueco: opts.largo ? "barranco" : base.hueco,
  };
}

function cruceComparar(base, rnd, facil) {
  const inch = base.unidad === "in";
  const maxL = inch ? 8 : 20;
  const diffMax = inch ? Math.min(5, maxL - 1) : (facil ? 8 : maxL - 1);
  let diff = entre(rnd, 1, diffMax);
  let corto = entre(rnd, 1, Math.max(1, maxL - diff));
  if (corto + diff > maxL) diff = Math.max(1, maxL - corto);
  return {
    ...base,
    tipo: "comparar",
    longitud: diff,
    corto,
    largo: corto + diff,
    fases: ["comparar"],
    yaPuesta: false,
  };
}

function cruceDesfase(base, rnd, facil, tv) {
  const max = maxRegla(base.unidad, tv);
  const desplaza = entre(rnd, 1, facil ? 2 : 3);
  const longitud = entre(rnd, 2, Math.max(2, max - desplaza));
  return {
    ...base,
    tipo: "desfase",
    longitud,
    fases: ["leer"],
    desplazaInicial: desplaza,
    yaPuesta: true,
    puedeMover: false,
  };
}

export function crearCruce(nivel, rnd, opts = {}) {
  const n = Math.max(1, Math.min(NIVELES_MAX, nivel | 0));
  const i = opts.indice | 0;
  const unidad = n === 1 ? "bloque" : unidadDeCruce(n, opts.ajuste || "ambas", i);
  const base = baseCruce(n, i, unidad, opts);
  const facil = !!opts.facil;
  const tv = !!opts.tv;
  if (n === 1) return cruceBloques(base, rnd, facil);
  if (n === 2 || n === 3) return cruceMedir(base, rnd, facil, tv);
  if (n === 4) return cruceEstima(base, rnd, facil, tv, false);
  if (n === 5) return cruceJuntar(base, rnd, { facil, tv, bien: opts.bien | 0 });
  if (n === 6) return cruceComparar(base, rnd, facil);
  return cruceDesfase(base, rnd, facil, tv);
}

export function cruceEstimaLibre(rnd, i, unidad) {
  const u = unidad === "in" ? "in" : "cm";
  const c = cruceEstima(baseCruce(4, i, u, {}), rnd, false, false, true);
  c.fases = ["estimaLibre"];
  return c;
}

export function cruceArbol(rnd) {
  const alto = entre(rnd, 8, 14);
  return {
    ...baseCruce(4, 5, "cm", { zona: "bosque", animal: "conejo" }),
    tipo: "arbol",
    longitud: alto,
    fases: ["estima"],
    opciones: opcionesCerca(alto, rnd, { min: 2, max: 24 }),
    referencia: "tabla10",
    margen: 2,
  };
}

export function cruceLargo(rnd, i, unidad, tv) {
  const u = unidad === "in" ? "in" : "cm";
  const piezas = u === "in" ? 2 : (i % 2 === 0 ? 2 : 3);
  return cruceJuntar(baseCruce(5, i, u, { hueco: "barranco" }), rnd, {
    facil: false, tv, bien: 8, piezas, largo: true,
  });
}

export function sumaValida(cruce) {
  if (!cruce || cruce.tipo !== "juntar") return true;
  if (suma(cruce.solucion) !== cruce.longitud) return false;
  if (!contieneSolucion(cruce.ofrecidas, cruce.solucion)) return false;
  const hallada = combinacion(cruce.ofrecidas, cruce.longitud, cruce.piezas);
  return !!hallada;
}
