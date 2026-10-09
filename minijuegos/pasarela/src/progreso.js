// Progreso de la Pasarela: puntos de estilo, nivel, qué se ha abierto y los últimos atuendos (el clóset de fotos).
// Lógica pura. Se guarda con Noli.guardar (el catálogo lo guarda y lo sincroniza con la nube).
//
//   progreso = {
//     v: 1,                         // versión del formato (leerProgreso convierte versiones viejas)
//     puntos: 0,                    // puntos de estilo acumulados (nunca bajan)
//     pasarelas: 0,                 // cuántas pasarelas con tema ha hecho
//     vistos: [ids],                // prendas, colores ("c:rosa"), temas ("t:playa") y poses ("o:vuelta") que ya vio (lo demás abierto brilla como nuevo)
//     atuendos: [{ fecha, tema, atuendo, estrellas: [e1, e2, e3], puntos }],   // los últimos, el más nuevo primero
//     piel: 0,                      // tono de piel del personaje (índice en config.tonosPiel)
//     ultimo: null | atuendo,       // lo último que se puso (para empezar con eso)
//     ultimoTema: null | id,        // para no repetir el mismo tema dos veces seguidas
//   }
import { limpiar } from "./atuendo.js";

/** @returns {object} el progreso de alguien que nunca ha jugado */
export const progresoNuevo = () => ({ v: 1, puntos: 0, pasarelas: 0, vistos: [], atuendos: [], piel: 0, ultimo: null, ultimoTema: null });

/**
 * Lee lo guardado (puede ser null, de otra versión o venir roto) y regresa un progreso válido.
 * @param {*} x
 * @param {object} idx índices de datos.js
 */
export function leerProgreso(x, idx) {
  const p = progresoNuevo();
  if (!x || typeof x !== "object") return p;
  if (Number.isInteger(x.puntos) && x.puntos >= 0) p.puntos = x.puntos;
  if (Number.isInteger(x.pasarelas) && x.pasarelas >= 0) p.pasarelas = x.pasarelas;
  if (Array.isArray(x.vistos)) p.vistos = x.vistos.filter((s) => typeof s === "string");
  if (Number.isInteger(x.piel) && x.piel >= 0 && x.piel < idx.config.tonosPiel.length) p.piel = x.piel;
  if (Array.isArray(x.atuendos)) p.atuendos = x.atuendos.filter((a) => a && idx.temas.has(a.tema)).map((a) => ({ ...a, atuendo: limpiar(a.atuendo, idx) }));
  if (x.ultimo) p.ultimo = limpiar(x.ultimo, idx);
  if (typeof x.ultimoTema === "string" && idx.temas.has(x.ultimoTema)) p.ultimoTema = x.ultimoTema;
  return p;
}

/**
 * Nivel para unos puntos: índice (0 = el primero), nombre, y cuánto falta para el siguiente.
 * @param {number} puntos
 * @param {{nombre, puntos}[]} niveles
 * @returns {{ i: number, nombre: string, siguiente: null | { nombre: string, puntos: number, faltan: number } }}
 */
export function nivelDe(puntos, niveles) {
  let i = 0;
  while (i + 1 < niveles.length && puntos >= niveles[i + 1].puntos) i++;
  const sig = niveles[i + 1];
  return { i, nombre: niveles[i].nombre, siguiente: sig ? { nombre: sig.nombre, puntos: sig.puntos, faltan: sig.puntos - puntos } : null };
}

/**
 * Lo abierto hasta el nivel i (inclusive).
 * @returns {{ prendas: Set<string>, colores: Set<string>, temas: Set<string>, poses: Set<string> }}
 */
export function abiertosHasta(i, niveles) {
  const r = { prendas: new Set(), colores: new Set(), temas: new Set(), poses: new Set() };
  for (const n of niveles.slice(0, i + 1)) {
    for (const x of n.prendas || []) r.prendas.add(x);
    for (const x of n.colores || []) r.colores.add(x);
    for (const x of n.temas || []) r.temas.add(x);
    for (const x of n.poses || []) r.poses.add(x);
  }
  return r;
}

/** Lo abierto con estos puntos */
export const abiertos = (puntos, niveles) => abiertosHasta(nivelDe(puntos, niveles).i, niveles);

/** Colores que se pueden escoger para una prenda: los suyos que ya estén abiertos (en el orden de la prenda). */
export const coloresDe = (prenda, ab) => prenda.colores.filter((c) => ab.colores.has(c));

/** Nivel en el que se abre una prenda (para enseñar el candado "en el nivel X"), o null. */
export function nivelDePrenda(id, niveles) {
  const i = niveles.findIndex((n) => (n.prendas || []).includes(id));
  return i < 0 ? null : { i, nombre: niveles[i].nombre, puntos: niveles[i].puntos };
}

/**
 * Registra una pasarela calificada: suma puntos, guarda el atuendo en el clóset y dice qué se abrió.
 * @param {object} progreso
 * @param {{ tema: string, atuendo: object, jueces: {estrellas}[], puntos: number }} pasarela
 * @param {number} ahora ms
 * @param {object} idx
 * @returns {{ progreso: object, subio: boolean, nivel: object, nuevos: { prendas: string[], colores: string[], temas: string[], poses: string[] } }}
 */
export function registrarPasarela(progreso, pasarela, ahora, idx) {
  const antes = nivelDe(progreso.puntos, idx.niveles);
  const puntos = progreso.puntos + pasarela.puntos;
  const despues = nivelDe(puntos, idx.niveles);
  const nuevos = { prendas: [], colores: [], temas: [], poses: [] };
  for (const n of idx.niveles.slice(antes.i + 1, despues.i + 1)) {
    nuevos.prendas.push(...(n.prendas || []));
    nuevos.colores.push(...(n.colores || []));
    nuevos.temas.push(...(n.temas || []));
    nuevos.poses.push(...(n.poses || []));
  }
  const foto = { fecha: ahora, tema: pasarela.tema, atuendo: pasarela.atuendo, estrellas: pasarela.jueces.map((j) => j.estrellas), puntos: pasarela.puntos };
  const max = idx.config.maxAtuendosGuardados || 12;
  return {
    progreso: { ...progreso, puntos, pasarelas: progreso.pasarelas + 1, atuendos: [foto, ...progreso.atuendos].slice(0, max), ultimoTema: pasarela.tema },
    subio: despues.i > antes.i,
    nivel: despues,
    nuevos,
  };
}

/** ¿Es nuevo (abierto y todavía no lo ve)? clave: id de prenda, "c:color", "t:tema" u "o:pose" */
export const esNuevo = (progreso, clave) => !progreso.vistos.includes(clave);

/** Marca como vistas unas claves (devuelve progreso nuevo; si no cambia nada, el mismo). */
export function marcarVistos(progreso, claves) {
  const falta = claves.filter((c) => !progreso.vistos.includes(c));
  return falta.length ? { ...progreso, vistos: [...progreso.vistos, ...falta] } : progreso;
}

/** Claves de todo lo del primer nivel: se marcan vistas al empezar (lo del clóset inicial no brilla como nuevo). */
export function clavesIniciales(niveles) {
  const n = niveles[0];
  return [...(n.prendas || []), ...(n.colores || []).map((c) => "c:" + c), ...(n.temas || []).map((t) => "t:" + t), ...(n.poses || []).map((o) => "o:" + o)];
}

/**
 * Escoge el tema de la pasarela: al azar entre los abiertos, sin repetir el último (si hay más de uno).
 * @param {string[]} temas ids abiertos
 * @param {string|null} ultimo
 * @param {() => number} rnd
 */
export function escogerTema(temas, ultimo, rnd = Math.random) {
  const opciones = temas.length > 1 ? temas.filter((t) => t !== ultimo) : temas;
  return opciones[Math.floor(rnd() * opciones.length) % opciones.length];
}
