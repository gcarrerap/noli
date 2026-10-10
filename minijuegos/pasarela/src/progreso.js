// Progreso de la Pasarela: puntos de estilo, nivel, qué se ha abierto y los últimos atuendos (el clóset de fotos).
// Lógica pura. Se guarda con Noli.guardar (el catálogo lo guarda y lo sincroniza con la nube).
//
//   progreso = {
//     v: 3,                         // versión del formato (leerProgreso convierte versiones viejas; v1 no tenía diseños; v2 no tenía premios)
//     premios: 0,                   // cuántos de la fila de premios de desbloqueos.json ya abrió (#88)
//     puntos: 0,                    // puntos de estilo acumulados (nunca bajan)
//     pasarelas: 0,                 // cuántas pasarelas con tema ha hecho
//     vistos: [ids],                // prendas, colores ("c:rosa"), temas ("t:playa") y poses ("o:vuelta") que ya vio (lo demás abierto brilla como nuevo)
//     atuendos: [{ fecha, tema, atuendo, estrellas: [e1, e2, e3], puntos }],   // los últimos, el más nuevo primero
//     piel: 0,                      // tono de piel del personaje (índice en config.tonosPiel)
//     ultimo: null | atuendo,       // lo último que se puso (para empezar con eso)
//     ultimoTema: null | id,        // para no repetir el mismo tema dos veces seguidas
//     disenos: [diseno],            // lo que cosió en el Taller de diseño (#80; src/taller.js), el más viejo primero
//     borrador: null | diseno,      // lo que estaba diseñando y no cosió (se guarda solo)
//     dibujos: [dibujo],            // estampados que dibujó (#81; src/pixeles.js), comprimidos
//   }
import { limpiar } from "./atuendo.js";
import { limpiarDiseno, registrarDisenos } from "./taller.js";
import { limpiarDibujo, registrarDibujos } from "./pixeles.js";

/** Versión del formato que escribe este código */
export const VERSION_PROGRESO = 3;

/** @returns {object} el progreso de alguien que nunca ha jugado */
export const progresoNuevo = () => ({ v: VERSION_PROGRESO, puntos: 0, pasarelas: 0, vistos: [], atuendos: [], piel: 0, ultimo: null, ultimoTema: null, disenos: [], borrador: null, dibujos: [], premios: 0 });

/**
 * Lee lo guardado (puede ser null, de otra versión o venir roto) y regresa un progreso válido. v1 → v2: sin
 * diseños. OJO: registra los diseños en idx (taller.js → registrarDisenos) antes de revisar los atuendos, para que
 * un atuendo con un diseño puesto no pierda esa prenda (también lo usa el mundo del menú principal).
 * @param {*} x
 * @param {object} idx índices de datos.js
 */
export function leerProgreso(x, idx) {
  const p = progresoNuevo();
  if (!x || typeof x !== "object") { registrarDibujos(idx, []); registrarDisenos(idx, []); return p; }
  // Primero los dibujos (#81): los diseños pueden traerlos como calcomanías
  if (Array.isArray(x.dibujos)) {
    const ids = new Set(), max = (idx.config.taller || {}).maxDibujos || 6;
    p.dibujos = x.dibujos.map((d) => limpiarDibujo(d, idx)).filter((d) => d && !ids.has(d.id) && ids.add(d.id)).slice(0, max);
  }
  registrarDibujos(idx, p.dibujos);
  if (Array.isArray(x.disenos)) {
    const ids = new Set();
    p.disenos = x.disenos.map((d) => limpiarDiseno(d, idx)).filter((d) => d && !ids.has(d.id) && ids.add(d.id));
  }
  if (x.borrador) p.borrador = limpiarDiseno(x.borrador, idx);
  registrarDisenos(idx, p.disenos);
  if (Number.isInteger(x.puntos) && x.puntos >= 0) p.puntos = x.puntos;
  if (Number.isInteger(x.pasarelas) && x.pasarelas >= 0) p.pasarelas = x.pasarelas;
  // Premios abiertos (#88). v1/v2 abrían por niveles: se le dan 1.5 premios por pasarela jugada (lo que habría
  // ganado con el sistema nuevo, más o menos), así nadie pierde lo que ya tenía.
  if (Number.isInteger(x.premios) && x.premios >= 0) p.premios = Math.min(x.premios, idx.premios.length);
  else p.premios = Math.min(idx.premios.length, Math.round(p.pasarelas * 1.5));
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

/** Lo que se abre (las llaves de desbloqueos.json) */
export const QUE_ABRE = ["prendas", "colores", "temas", "poses", "patrones", "estampados"];

/**
 * Lo abierto con n premios (#88): el clóset inicial (niveles[0]) y los primeros n de la fila de premios.
 * @param {number} n
 * @param {{ niveles: object[], premios: {k, id}[] }} idx
 * @returns {{ prendas: Set<string>, colores: Set<string>, temas: Set<string>, poses: Set<string>, patrones: Set<string>, estampados: Set<string> }}
 */
export function abiertosCon(n, idx) {
  const r = Object.fromEntries(QUE_ABRE.map((k) => [k, new Set()]));
  const ini = idx.niveles[0];
  for (const k of QUE_ABRE) for (const x of ini[k] || []) r[k].add(x);
  for (const q of idx.premios.slice(0, Math.max(0, n))) r[q.k].add(q.id);
  return r;
}

/** Lo abierto con este progreso */
export const abiertos = (progreso, idx) => abiertosCon(progreso.premios, idx);

/** Cuántos premios gana una pasarela: config.premios.porPasarela, y uno más con extraDesde puntos o más */
export function premiosDe(puntos, config) {
  const c = config.premios || {};
  return (c.porPasarela || 1) + (puntos >= (c.extraDesde || 10) ? 1 : 0);
}

/** Colores que se pueden escoger para una prenda: los suyos que ya estén abiertos (en el orden de la prenda). */
export const coloresDe = (prenda, ab) => prenda.colores.filter((c) => ab.colores.has(c));

/**
 * Cuántos premios faltan para abrir algo (para el candado: "faltan 3 premios"), o null si no está en la fila.
 * @param {string} clave como las de los premios ("x-gorra", "c:verde"…)
 */
export function faltanPara(clave, progreso, idx) {
  const i = idx.premios.findIndex((q) => q.clave === clave);
  return i < 0 ? null : Math.max(0, i + 1 - progreso.premios);
}

/**
 * Registra una pasarela calificada: suma puntos, abre los premios que tocan (#88: siempre al menos uno), guarda el
 * atuendo en el clóset y dice qué se abrió.
 * @param {object} progreso
 * @param {{ tema: string, atuendo: object, jueces: {estrellas}[], puntos: number }} pasarela
 * @param {number} ahora ms
 * @param {object} idx
 * @returns {{ progreso: object, subio: boolean, nivel: object, nuevos: Record<string, string[]>, ganados: number }} nuevos: una lista por cada llave de QUE_ABRE
 */
export function registrarPasarela(progreso, pasarela, ahora, idx) {
  const antes = nivelDe(progreso.puntos, idx.niveles);
  const puntos = progreso.puntos + pasarela.puntos;
  const despues = nivelDe(puntos, idx.niveles);
  const nuevos = Object.fromEntries(QUE_ABRE.map((k) => [k, []]));
  const premios = Math.min(idx.premios.length, progreso.premios + premiosDe(pasarela.puntos, idx.config));
  for (const q of idx.premios.slice(progreso.premios, premios)) nuevos[q.k].push(q.id);
  const foto = { fecha: ahora, tema: pasarela.tema, atuendo: pasarela.atuendo, estrellas: pasarela.jueces.map((j) => j.estrellas), puntos: pasarela.puntos };
  const max = idx.config.maxAtuendosGuardados || 12;
  return {
    progreso: { ...progreso, puntos, premios, pasarelas: progreso.pasarelas + 1, atuendos: [foto, ...progreso.atuendos].slice(0, max), ultimoTema: pasarela.tema },
    subio: despues.i > antes.i,
    nivel: despues,
    nuevos,
    ganados: premios - progreso.premios,
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
