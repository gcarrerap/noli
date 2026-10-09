// Visitas del safari. Puro: el azar entra por `rnd`.
// No hay nivel de escala de 2: en su lugar va la tabla de conteo.
import { animal, los } from "./animales.js";
import { entre, revolver } from "./rng.js";
import {
  TEXTOS, textoBarraMal, textoContar, textoCuantos, textoDiferencia, textoFalta, textoTotalDos, textoTotalTodos,
} from "./textos.js";
import { barrasCoinciden, ejeDe } from "./grafica.js";

export const POR_VISITA_TIPICA = 6;

export const NIVELES = [
  { n: 1, nombre: "Gráfica de dibujos", ejemplo: "3 monos", animales: ["mono", "leon", "jirafa"], min: 2, max: 6, modo: "dibujos", arma: true, contar: 3 },
  { n: 2, nombre: "Gráfica de barras", ejemplo: "4 animales", animales: ["mono", "leon", "jirafa", "elefante"], min: 2, max: 8, modo: "barras", arma: true, contar: 4 },
  { n: 3, nombre: "¿De qué hay más?", ejemplo: "¿Cuántos más?", animales: ["leon", "jirafa", "elefante", "cebra"], min: 2, max: 12, modo: "barras", arma: false, contar: 0 },
  { n: 4, nombre: "¿Cuántos en total?", ejemplo: "monos y leones", animales: ["jirafa", "elefante", "cebra", "hipopotamo"], min: 2, max: 10, modo: "barras", arma: false, contar: 0 },
  { n: 5, nombre: "Tabla de conteo", ejemplo: "palitos", animales: ["elefante", "cebra", "hipopotamo", "pinguino"], min: 4, max: 14, modo: "palitos", arma: true, contar: 3 },
  { n: 6, nombre: "Detective", ejemplo: "un error", animales: ["cebra", "hipopotamo", "pinguino", "flamenco"], min: 2, max: 10, modo: "barras", arma: false, contar: 0 },
];

export const nivel = (n) => NIVELES[Math.max(1, Math.min(NIVELES.length, n | 0)) - 1];

export function animalNuevoDeNivel(n) {
  if (n <= 1) return null;
  const id = NIVELES[n - 1] && NIVELES[n - 1].animales.slice(-1)[0];
  return id || null;
}

function conteosUnicos(rnd, n, min, max) {
  for (let k = 0; k < 40; k++) {
    const cs = Array.from({ length: n }, () => entre(rnd, min, max));
    const mayor = Math.max(...cs);
    if (cs.every((c) => c >= 1 && c <= 20) && cs.filter((c) => c === mayor).length === 1) return cs;
  }
  return Array.from({ length: n }, (_, i) => Math.min(20, min + i));
}

function categoriasDe(def, rnd, facil) {
  let ids = def.animales.slice();
  const n = facil ? Math.min(3, ids.length) : (def.contar === 3 ? 3 : ids.length);
  if (n < ids.length) ids = revolver(rnd, ids).slice(0, n);
  const min = def.min;
  const max = facil ? Math.min(def.max, 5) : def.max;
  const cs = conteosUnicos(rnd, ids.length, Math.min(min, max), max);
  return ids.map((id, i) => ({ id, cantidad: cs[i] }));
}

export function opcionesConteo(cantidad, rnd, otras = []) {
  const mal = [];
  const meter = (n) => {
    const v = n | 0;
    if (v !== cantidad && v >= 0 && v <= 20 && !mal.includes(v)) mal.push(v);
  };
  meter(cantidad - 1);
  meter(cantidad + 1);
  for (const o of otras) meter(o);
  let k = 2;
  while (mal.length < 2 && k < 15) {
    meter(cantidad + k);
    meter(cantidad - k);
    k++;
  }
  return revolver(rnd, [cantidad, mal[0], mal[1]]);
}

export function armarDiferencia(a, b, rnd) {
  const mayor = Math.max(a, b);
  const menor = Math.min(a, b);
  const dif = mayor - menor;
  const total = a + b;
  const errores = [];
  if (total !== dif) errores.push(total);
  if (mayor !== dif && !errores.includes(mayor)) errores.push(mayor);
  if (menor !== dif && !errores.includes(menor) && errores.length < 2) errores.push(menor);
  let extra = dif + 1;
  while (errores.length < 2) {
    if (!errores.includes(extra) && extra !== dif) errores.push(extra);
    extra++;
  }
  return { correcta: dif, opciones: revolver(rnd, [dif, errores[0], errores[1]]), total, mayor, menor };
}

export function armarTotal(valores, rnd) {
  const nums = valores.slice();
  const suma = nums.reduce((s, n) => s + n, 0);
  const errores = [];
  if (nums.length === 2) {
    const dif = Math.abs(nums[0] - nums[1]);
    const uno = Math.max(nums[0], nums[1]);
    if (dif !== suma) errores.push(dif);
    if (uno !== suma && !errores.includes(uno)) errores.push(uno);
  } else {
    const olvido = suma - Math.min(...nums);
    const uno = Math.max(...nums);
    if (olvido !== suma) errores.push(olvido);
    if (uno !== suma && !errores.includes(uno)) errores.push(uno);
  }
  let extra = suma + 1;
  while (errores.length < 2) {
    if (!errores.includes(extra) && extra !== suma) errores.push(extra);
    extra++;
  }
  return { correcta: suma, opciones: revolver(rnd, [suma, errores[0], errores[1]]) };
}

function paresDistintos(categorias) {
  const pares = [];
  for (let i = 0; i < categorias.length; i++) {
    for (let j = i + 1; j < categorias.length; j++) {
      if (categorias[i].cantidad !== categorias[j].cantidad) pares.push([categorias[i], categorias[j]]);
    }
  }
  return pares;
}

function basePregunta(categorias, modo, horizontal) {
  return {
    categorias,
    modo,
    horizontal: !!horizontal,
    eje: ejeDe(categorias.map((c) => c.cantidad)),
  };
}

function pregCuantos(cat, rnd, base) {
  return {
    tipo: "pregunta",
    clase: "cuantos",
    correcta: cat.cantidad,
    opciones: opcionesConteo(cat.cantidad, rnd, []),
    texto: textoCuantos(cat.id),
    leer: textoCuantos(cat.id),
    par: [cat.id],
    ...base,
  };
}

function pregMas(categorias, rnd, base) {
  const orden = categorias.map((c, i) => ({ ...c, i })).sort((a, b) => b.cantidad - a.cantidad || a.i - b.i);
  const ids = [orden[0].id, orden[orden.length - 1].id];
  if (orden.length > 2) ids.push(orden[1].id);
  return {
    tipo: "pregunta",
    clase: "mas",
    correcta: orden[0].id,
    opciones: revolver(rnd, ids),
    texto: TEXTOS.mas,
    leer: TEXTOS.mas,
    par: [orden[0].id],
    ...base,
  };
}

function pregDif(a, b, rnd, base) {
  const mayor = a.cantidad >= b.cantidad ? a : b;
  const menor = mayor === a ? b : a;
  const armado = armarDiferencia(a.cantidad, b.cantidad, rnd);
  return {
    tipo: "pregunta",
    clase: "diferencia",
    correcta: armado.correcta,
    opciones: armado.opciones,
    texto: textoDiferencia(mayor.id, menor.id),
    leer: textoDiferencia(mayor.id, menor.id),
    par: [mayor.id, menor.id],
    ...base,
  };
}

function pregTotal(lista, rnd, base) {
  const armado = armarTotal(lista.map((c) => c.cantidad), rnd);
  const todos = lista.length > 2;
  return {
    tipo: "pregunta",
    clase: todos ? "total-todos" : "total",
    correcta: armado.correcta,
    opciones: armado.opciones,
    texto: todos ? textoTotalTodos() : textoTotalDos(lista[0].id, lista[1].id),
    leer: todos ? textoTotalTodos() : textoTotalDos(lista[0].id, lista[1].id),
    par: lista.map((c) => c.id),
    ...base,
  };
}

function preguntasDe(n, categorias, rnd, modo, horizontal) {
  const base = basePregunta(categorias, modo, horizontal);
  if (n === 1 || n === 5) return [pregCuantos(categorias[0], rnd, base), pregMas(categorias, rnd, base)];
  if (n === 2) return [pregMas(categorias, rnd, base)];
  const pares = paresDistintos(categorias);
  if (n === 3) {
    const i1 = Math.floor(rnd() * pares.length);
    const i2 = pares.length > 1
      ? (i1 + 1 + Math.floor(rnd() * (pares.length - 1))) % pares.length
      : i1;
    const p1 = pares[i1];
    const p2 = pares[i2];
    return [
      pregCuantos(categorias[0], rnd, base),
      pregMas(categorias, rnd, base),
      pregDif(p1[0], p1[1], rnd, base),
      pregDif(p2[0], p2[1], rnd, base),
      pregCuantos(categorias[1] || categorias[0], rnd, base),
      pregMas(categorias, rnd, base),
    ];
  }
  const p = pares[Math.floor(rnd() * pares.length)];
  const ultima = categorias.length - 1;
  return [
    pregTotal([categorias[0], categorias[1]], rnd, base),
    pregTotal([categorias[ultima - 1], categorias[ultima]], rnd, base),
    pregTotal(categorias, rnd, base),
    pregCuantos(categorias[0], rnd, base),
    pregMas(categorias, rnd, base),
    pregDif(p[0], p[1], rnd, base),
  ];
}

function elementoContar(cat, categorias, rnd, mixto) {
  const otras = categorias.filter((c) => c.id !== cat.id).map((c) => c.cantidad);
  const el = {
    tipo: "contar",
    id: cat.id,
    cantidad: cat.cantidad,
    recinto: animal(cat.id).recinto,
    mixto: !!mixto,
    opciones: opcionesConteo(cat.cantidad, rnd, otras),
    texto: textoContar(cat.id),
    leer: textoContar(cat.id),
    categorias,
  };
  if (mixto) {
    const piezas = [];
    for (const c of categorias) {
      for (let k = 0; k < c.cantidad; k++) piezas.push(c.id);
    }
    el.orden = revolver(rnd, piezas);
  }
  return el;
}

export function tipoErrorDetective(indice, hechosAntes, forzarAltura) {
  if (forzarAltura || (hechosAntes | 0) < 4) return "altura";
  if ((indice | 0) <= 3) return "altura";
  if ((indice | 0) === 4) return "etiquetas";
  return "falta";
}

function itemDetective(categorias, tipo, rnd) {
  const realIds = categorias.map((c) => c.id);
  const real = categorias.map((c) => c.cantidad);
  const eje = ejeDe(real);
  const base = {
    tipo: "detective",
    error: tipo,
    categorias,
    realIds,
    real,
    eje,
    modo: "barras",
    horizontal: false,
    falta: null,
    visibles: realIds.slice(),
    etiquetas: realIds.slice(),
    mostrado: real.slice(),
    opciones: null,
    correcta: null,
    errorIndice: 0,
    texto: TEXTOS.arregla,
    leer: TEXTOS.arregla,
  };
  if (tipo === "altura") {
    const i = Math.floor(rnd() * real.length);
    let delta = rnd() < 0.5 ? -1 : 1;
    if (real[i] + delta < 0 || real[i] + delta > 20) delta = -delta;
    if (real[i] + delta === real[i]) delta = real[i] === 0 ? 1 : -1;
    const mostrado = real.slice();
    mostrado[i] = real[i] + delta;
    return {
      ...base,
      mostrado,
      errorIndice: i,
      texto: TEXTOS.arregla,
      leer: `Cuenta otra vez ${los(realIds[i])} ${animal(realIds[i]).plural}.`,
    };
  }
  if (tipo === "etiquetas") {
    const i = Math.floor(rnd() * realIds.length);
    let j = Math.floor(rnd() * (realIds.length - 1));
    if (j >= i) j++;
    const etiquetas = realIds.slice();
    [etiquetas[i], etiquetas[j]] = [etiquetas[j], etiquetas[i]];
    const otro = realIds.find((id) => id !== realIds[i] && id !== realIds[j]) || realIds[0];
    return {
      ...base,
      etiquetas,
      errorIndice: i,
      texto: TEXTOS.queMal,
      leer: TEXTOS.queMal,
      correcta: "etiquetas",
      opciones: revolver(rnd, [
        { id: "etiquetas", texto: TEXTOS.etiquetas },
        { id: "altura", texto: textoBarraMal(otro) },
        { id: "falta", texto: TEXTOS.faltaUno },
      ]),
    };
  }
  const falta = realIds[realIds.length - 1];
  const visibles = realIds.slice(0, -1);
  const visibleCats = categorias.slice(0, -1);
  return {
    ...base,
    falta,
    visibles,
    categorias: visibleCats,
    real,
    realIds,
    mostrado: visibleCats.map((c) => c.cantidad),
    etiquetas: visibles.slice(),
    texto: TEXTOS.queMal,
    leer: TEXTOS.queMal,
    correcta: "falta",
    opciones: revolver(rnd, [
      { id: "falta", texto: textoFalta(falta) },
      { id: "altura", texto: textoBarraMal(visibles[0]) },
      { id: "etiquetas", texto: TEXTOS.etiquetas },
    ]),
  };
}

export function unSoloError(item) {
  if (!item || item.tipo !== "detective") return false;
  if (item.error === "altura") {
    if (!item.mostrado || !item.real) return false;
    const mal = item.mostrado.filter((h, i) => h !== item.real[i]).length;
    return mal === 1 && item.etiquetas.join() === item.realIds.join() && !item.falta;
  }
  if (item.error === "etiquetas") {
    const diffs = item.etiquetas.filter((id, i) => id !== item.realIds[i]).length;
    return diffs === 2 && barrasCoinciden(item.mostrado, item.real) && !item.falta;
  }
  if (item.error === "falta") {
    return !!item.falta && item.visibles && !item.visibles.includes(item.falta) && item.visibles.length === item.realIds.length - 1;
  }
  return false;
}

function visitaDetective(rnd, hechosAntes, forzarAltura) {
  const def = nivel(6);
  const elementos = [];
  for (let i = 0; i < 6; i++) {
    const tipo = tipoErrorDetective(i, hechosAntes, forzarAltura);
    const cats = categoriasDe(def, rnd, false).slice(0, tipo === "falta" ? 4 : 3 + (i % 2));
    const uso = cats.length >= 3 ? cats : categoriasDe(def, rnd, false);
    elementos.push(itemDetective(uso.slice(0, Math.min(4, Math.max(3, uso.length))), tipo, rnd));
  }
  return {
    nivel: 6,
    modo: "barras",
    horizontal: false,
    categorias: elementos[0].categorias,
    elementos,
    eje: 10,
  };
}

function repartirSuma(rnd, n, suma) {
  const base = Array(n).fill(2);
  let resto = suma - n * 2;
  let guard = 0;
  while (resto > 0 && guard < 80) {
    const i = Math.floor(rnd() * n);
    if (base[i] < 20) { base[i]++; resto--; }
    guard++;
  }
  return base;
}

export function crearCenso(rnd, nivelActual) {
  const def = nivel(nivelActual);
  const ids = revolver(rnd, def.animales.slice()).slice(0, Math.min(4, def.animales.length));
  const n = ids.length;
  const suma = entre(rnd, Math.max(12, n * 2), 20);
  const cs = repartirSuma(rnd, n, suma);
  const categorias = ids.map((id, i) => ({ id, cantidad: cs[i] }));
  const base = basePregunta(categorias, "barras", false);
  const elementos = [];
  const vistos = new Set();
  const meter = (el) => {
    if (!el || elementos.length >= 6 || vistos.has(el.texto)) return false;
    vistos.add(el.texto);
    elementos.push(el);
    return true;
  };
  for (const c of categorias) meter(elementoContar(c, categorias, rnd, true));
  meter(pregMas(categorias, rnd, base));
  if (categorias.length >= 2) {
    meter(pregTotal([categorias[0], categorias[1]], rnd, base));
    if (categorias.length > 2) meter(pregTotal(categorias, rnd, base));
  }
  for (const c of categorias) meter(pregCuantos(c, rnd, base));
  if (categorias.length >= 3) {
    meter(pregTotal([categorias[0], categorias[categorias.length - 1]], rnd, base));
    meter(pregTotal([categorias[1], categorias[2]], rnd, base));
  }
  return {
    nivel: Math.max(1, nivelActual | 0),
    modo: "censo",
    horizontal: false,
    categorias,
    elementos,
    eje: ejeDe(cs),
    suma: cs.reduce((s, x) => s + x, 0),
  };
}

export function crearVisita(nivelN, rnd, opts = {}) {
  const n = Math.max(1, Math.min(6, nivelN | 0 || 1));
  if (n === 6) return visitaDetective(rnd, opts.hechosDetective || 0, !!opts.forzarAltura);
  const def = nivel(n);
  const facil = !!opts.facil;
  let categorias = categoriasDe(def, rnd, facil);
  if (def.contar === 3) categorias = categorias.slice(0, 3);
  const horizontal = n === 2 && !facil && rnd() < 0.34;
  const elementos = [];
  if (def.arma) {
    const contar = def.contar === 4 ? categorias : categorias.slice(0, 3);
    for (const c of contar) elementos.push(elementoContar(c, categorias, rnd, false));
    elementos.push({
      tipo: "grafica",
      modo: def.modo,
      eje: ejeDe(categorias.map((c) => c.cantidad)),
      horizontal: horizontal && def.modo === "barras",
      categorias,
      alturasIniciales: categorias.map(() => 0),
      texto: def.modo === "palitos" ? "Pon el número de cada fila." : "Arma la gráfica.",
      leer: def.modo === "palitos" ? "Pon el número de cada fila." : "Arma la gráfica.",
    });
  }
  const pregs = preguntasDe(n, categorias, rnd, def.modo, horizontal && n === 2);
  for (const p of pregs) elementos.push(p);
  return {
    nivel: n,
    modo: def.modo,
    horizontal: horizontal && n === 2,
    categorias,
    elementos,
    eje: ejeDe(categorias.map((c) => c.cantidad)),
  };
}

export function respuestaEs(elemento, valor) {
  if (!elemento) return false;
  if (elemento.tipo === "contar" || elemento.tipo === "pregunta") return valor === elemento.correcta || valor === elemento.cantidad && elemento.tipo === "contar";
  if (elemento.tipo === "detective") return valor === elemento.correcta;
  return false;
}

export function conteoCorrecto(elemento, elegido) {
  return !!elemento && elemento.tipo === "contar" && elegido === elemento.cantidad;
}

export function metasDe(elemento) {
  if (!elemento) return [];
  if (elemento.tipo === "grafica") return elemento.categorias.map((c) => c.cantidad);
  if (elemento.tipo === "detective" && elemento.error === "altura") return elemento.real.slice();
  return [];
}
