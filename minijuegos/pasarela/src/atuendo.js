// El atuendo: qué trae puesto el personaje. Lógica pura. Ver docs/JUEGO.md.
//
//   atuendo = { peinado, arriba, abajo, vestido, zapatos: { id, color, patron? } | null,  accesorios: { [lugar]: { id, color, patron? } } }
//   patron: id de patrones.json (cebra, puntos…) o nada (lisa). Solo en prendas que aceptan patrón (datos.aceptaPatron).
//
// Reglas: un vestido ocupa arriba y abajo (ponerse un vestido quita lo de arriba y lo de abajo, y al revés); de
// accesorios y maquillaje, uno por lugar (cabeza, cara, orejas, cuello, muñeca… labios, ojos, mejillas, pintura).
// El maquillaje se guarda junto con los accesorios (en "accesorios", por lugar): sus lugares no se repiten.

import { aceptaPatron } from "./datos.js";

/** @returns {object} un atuendo vacío */
export const atuendoVacio = () => ({ peinado: null, arriba: null, abajo: null, vestido: null, zapatos: null, accesorios: {} });

/** Lo que trae puesto la primera vez (también lo usa el mundo del menú principal si nunca ha jugado la Pasarela) */
export const ATUENDO_INICIAL = [["p-cola", "cafe"], ["a-camiseta", "rosa"], ["b-shorts", "azul"], ["z-tenis", "blanco"]];
/** @param {object} idx índices de datos.js */
export function atuendoInicial(idx) {
  let a = atuendoVacio();
  for (const [id, c] of ATUENDO_INICIAL) { const p = idx.prendas.get(id); if (p) a = poner(a, p, c); }
  return a;
}

/**
 * Pone una prenda (devuelve un atuendo nuevo). Si ya la traía con el mismo color, se la quita (tocar dos veces = quitar).
 * @param {object} atuendo
 * @param {{id, categoria, lugar?}} prenda
 * @param {string} color id del color
 * @param {string|null} [patron] id del patrón (o nada = lisa)
 * @returns {object}
 */
export function poner(atuendo, prenda, color, patron = null) {
  const a = { ...atuendo, accesorios: { ...atuendo.accesorios } };
  const pieza = patron ? { id: prenda.id, color, patron } : { id: prenda.id, color };
  const igual = (x) => x && x.id === prenda.id && x.color === color && (x.patron || null) === (patron || null);
  if (prenda.lugar) {
    if (igual(a.accesorios[prenda.lugar])) delete a.accesorios[prenda.lugar];
    else a.accesorios[prenda.lugar] = pieza;
    return a;
  }
  if (igual(a[prenda.categoria])) { a[prenda.categoria] = null; return a; }
  a[prenda.categoria] = pieza;
  if (prenda.categoria === "vestido") { a.arriba = null; a.abajo = null; }
  if (prenda.categoria === "arriba" || prenda.categoria === "abajo") a.vestido = null;
  return a;
}

/**
 * Cambia el patrón de una prenda que ya trae puesta (con el mismo color). Tocar el patrón que ya tiene lo quita
 * (vuelve a lisa). Si no la trae puesta, no cambia nada.
 * @param {object} atuendo
 * @param {{id, categoria, lugar?}} prenda
 * @param {string|null} patron
 * @returns {object}
 */
export function ponerPatron(atuendo, prenda, patron) {
  const actual = prenda.lugar ? atuendo.accesorios[prenda.lugar] : atuendo[prenda.categoria];
  if (!actual || actual.id !== prenda.id) return atuendo;
  const nuevo = patron && actual.patron !== patron ? { id: actual.id, color: actual.color, patron } : { id: actual.id, color: actual.color };
  if (prenda.lugar) return { ...atuendo, accesorios: { ...atuendo.accesorios, [prenda.lugar]: nuevo } };
  return { ...atuendo, accesorios: { ...atuendo.accesorios }, [prenda.categoria]: nuevo };
}

/** El patrón de esta prenda si la trae puesta (o null: lisa o no puesta) */
export function patronPuesto(atuendo, prenda) {
  const p = prenda.lugar ? atuendo.accesorios[prenda.lugar] : atuendo[prenda.categoria];
  return p && p.id === prenda.id && p.patron ? p.patron : null;
}

/**
 * Quita lo que haya en una ranura ("arriba", "zapatos"…) o en un lugar de accesorio ("cabeza"…).
 */
export function quitar(atuendo, donde) {
  const a = { ...atuendo, accesorios: { ...atuendo.accesorios } };
  if (donde in a.accesorios) delete a.accesorios[donde];
  else if (donde in a && donde !== "accesorios") a[donde] = null;
  return a;
}

/**
 * Todas las piezas puestas, en orden de la cabeza a los pies y luego accesorios.
 * @returns {{id, color, ranura}[]}
 */
export function puestas(atuendo) {
  const r = [];
  for (const k of ["peinado", "arriba", "vestido", "abajo", "zapatos"]) if (atuendo[k]) r.push({ ...atuendo[k], ranura: k });
  for (const [lugar, p] of Object.entries(atuendo.accesorios)) if (p) r.push({ ...p, ranura: lugar });
  return r;
}

/** ¿Trae puesta esta prenda (con cualquier color)? Devuelve su color o null. */
export function colorPuesto(atuendo, prenda) {
  const p = prenda.lugar ? atuendo.accesorios[prenda.lugar] : atuendo[prenda.categoria];
  return p && p.id === prenda.id ? p.color : null;
}

/**
 * El atuendo en inglés, para aprender palabras: "a pink T-shirt, blue shorts and white sneakers".
 * Color antes del nombre (como en inglés); sin "a" en los plurales (shorts, sneakers, sunglasses) y en "hair".
 * @param {object} atuendo
 * @param {{prendas: Map, colores: Map}} idx índices de datos.js
 * @returns {string}
 */
export function fraseIngles(atuendo, idx) {
  const partes = puestas(atuendo).map((p) => {
    const pr = idx.prendas.get(p.id);
    if (!pr) return null;
    const c = idx.colores.get(p.color), pid = p.patron || pr.patronFijo, pa = pid && idx.patrones ? idx.patrones.get(pid) : null;
    // "a pink zebra print T-shirt": color, patrón y prenda (como en inglés)
    const txt = (c ? c.en + " " : "") + (pa ? pa.en + " " : "") + pr.en;
    // Un diseño del Taller (#80) dice su nombre: a pink long dress called "Estrellita"
    const nombre = pr.diseno && pr.nombre ? ` called "${pr.nombre}"` : "";
    if (pr.enPlural) return txt + nombre;
    return (/^[aeiou]/i.test(txt) ? "an " : "a ") + txt + nombre;
  }).filter(Boolean);
  if (!partes.length) return "";
  if (partes.length === 1) return partes[0];
  return partes.slice(0, -1).join(", ") + " and " + partes[partes.length - 1];
}

/** Revisa un atuendo guardado (de una versión vieja o roto): quita lo que ya no existe. */
export function limpiar(atuendo, idx) {
  const a = atuendoVacio();
  if (!atuendo || typeof atuendo !== "object") return a;
  const ok = (p) => p && idx.prendas.has(p.id) && idx.colores.has(p.color);
  // El patrón se queda solo si existe y la prenda lo acepta (si no, la prenda queda lisa)
  const copia = (p) => {
    const r = { id: p.id, color: p.color };
    if (p.patron && idx.patrones && idx.patrones.has(p.patron) && aceptaPatron(idx.prendas.get(p.id), idx.config || {})) r.patron = p.patron;
    return r;
  };
  for (const k of ["peinado", "arriba", "abajo", "vestido", "zapatos"]) if (ok(atuendo[k]) && idx.prendas.get(atuendo[k].id).categoria === k) a[k] = copia(atuendo[k]);
  for (const [lugar, p] of Object.entries(atuendo.accesorios || {})) if (ok(p) && idx.prendas.get(p.id).lugar === lugar) a.accesorios[lugar] = copia(p);
  if (a.vestido) { a.arriba = null; a.abajo = null; }
  return a;
}
