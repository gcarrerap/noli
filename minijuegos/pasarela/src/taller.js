// El Taller de diseño (#80): Noelia escoge un molde, lo ajusta con opciones (corta / media / larga…), lo decora
// (color, patrón, calcomanías), le pone nombre y temas, y lo cose (cuesta créditos). Lógica pura: de un diseño
// (unos cientos de bytes que se guardan en el progreso) sale una prenda como las de prendas.json.
// Ver docs/JUEGO.md § Taller de diseño y docs/ASSETS.md § G (cómo hacer un molde).
//
//   diseno = { id: "d-…", molde: "vestido", ajustes: { largo: "corto", vuelo: "amplio" }, color: "rosa", secundario: "blanco",
//              patron: null | "cebra", calcas: [{ estampado: "osito", lugar: "pecho" }], nombre: "Mi vestido", temas: ["fiesta"], fecha }
import { concuerda } from "./espanol.js";

/** Cuánto más grande que la tela va lo que se pone encima (listones, calcomanías), en metros */
export const HOLGURA = { tubo: 0.003, calca: 0.004 };

/** Las opciones escogidas de un molde, completas y válidas (lo que falta o no existe toma lo inicial) */
export function ajustesDe(molde, ajustes = {}) {
  const r = {};
  for (const c of molde.controles) {
    const pedida = ajustes && ajustes[c.id];
    const ok = c.opciones.some((o) => o.id === pedida);
    r[c.id] = ok ? pedida : (molde.inicial && molde.inicial[c.id]) || c.opciones[0].id;
  }
  return r;
}

/** Las opciones escogidas como objetos (en el orden de los controles) */
const opcionesDe = (molde, aj) => molde.controles.map((c) => c.opciones.find((o) => o.id === aj[c.id]));

/** Las variables de un molde con estos ajustes: las que ponen las opciones y las tablas de "variables" */
export function variablesDe(molde, ajustes) {
  const aj = ajustesDe(molde, ajustes), v = {};
  for (const o of opcionesDe(molde, aj)) Object.assign(v, o.valores || {});
  for (const [k, t] of Object.entries(molde.variables || {})) {
    let x = t.valores;
    for (const c of t.por) x = x && x[aj[c]];
    if (x !== undefined) v[k] = x;
  }
  return v;
}

/** Cambia "$nombre" por su valor (null = quitar el campo), también dentro de listas */
function sustituir(valor, v) {
  if (typeof valor === "string" && valor[0] === "$") return Object.prototype.hasOwnProperty.call(v, valor.slice(1)) ? v[valor.slice(1)] : undefined;
  if (Array.isArray(valor)) return valor.map((x) => sustituir(x, v));
  return valor;
}

/** y y radio a una fracción (0 arriba, 1 abajo) de un tubo */
function enTubo(base, t) {
  return { y: base.y[0] + (base.y[1] - base.y[0]) * t, r: base.r[0] + (base.r[1] - base.r[0]) * t };
}

/** Una pieza encima de otra (un tubo con nombre): misma ancla y fondo, un poco más grande */
function sobre(base, desde, hasta, holgura) {
  const a = enTubo(base, desde), b = enTubo(base, hasta);
  const r = (x) => Math.round((x + holgura) * 10000) / 10000;
  const q = { a: base.a, y: [a.y, b.y], r: [r(a.r), r(b.r)] };
  if (base.z !== undefined) q.z = base.z;
  if (base.espejo) q.espejo = true;
  return q;
}

/**
 * Las piezas de un molde con estos ajustes, listas para kit/3d/formas.js (sin "nombre", "solo" ni "sobre").
 * @param {object} molde
 * @param {object} ajustes
 * @param {{ estampado: string, lugar: string }[]} [calcas]
 * @returns {object[]}
 */
export function piezasDe(molde, ajustes, calcas = []) {
  const aj = ajustesDe(molde, ajustes), v = variablesDe(molde, aj);
  const conNombre = new Map(), out = [];
  for (const pz of molde.piezas) {
    if (pz.solo && Object.entries(pz.solo).some(([c, ops]) => !ops.includes(aj[c]))) continue;
    const q = {};
    for (const [k, x] of Object.entries(pz)) {
      if (k === "nombre" || k === "solo") continue;
      const y = sustituir(x, v);
      if (y !== null && y !== undefined) q[k] = y;
    }
    if (pz.nombre) conNombre.set(pz.nombre, q);
    out.push(q);
  }
  // Lo que va encima de otra pieza (listones): se calcula con la pieza de abajo ya armada
  const r = [];
  for (const q of out) {
    if (!q.sobre) { r.push(q); continue; }
    const base = conNombre.get(q.sobre.pieza);
    if (!base || base.f !== "tubo") continue;
    const { sobre: s, ...resto } = q;
    r.push({ ...resto, ...sobre(base, s.desde, s.hasta, HOLGURA.tubo), f: "tubo" });
  }
  // Calcomanías en sus lugares
  for (const c of calcas || []) {
    const l = (molde.lugares || []).find((x) => x.id === c.lugar);
    const base = l && conNombre.get(l.pieza);
    if (!base || base.f !== "tubo") continue;
    const q = { f: "calca", ...sobre(base, l.desde, l.hasta, HOLGURA.calca), ancho: l.ancho, estampado: c.estampado };
    if (l.lado) q.lado = l.lado;
    if (!l.espejo) delete q.espejo;
    r.push(q);
  }
  return r;
}

/**
 * Las etiquetas de un diseño para los jueces: las más fuertes de cada tema que escogió (como mucho config.taller.maxTemas).
 * @param {string[]} temas ids
 * @param {{ temas: Map }} idx
 */
export function etiquetasDeTemas(temas, idx) {
  const r = new Set();
  for (const id of temas || []) {
    const t = idx.temas.get(id);
    if (!t) continue;
    const max = Math.max(...Object.values(t.etiquetas));
    for (const [e, w] of Object.entries(t.etiquetas)) if (w === max) r.add(e);
  }
  return [...r];
}

/** El molde con estos ajustes: nombre de la prenda (es/en), género, figura 2D */
export function variante(molde, ajustes) {
  const aj = ajustesDe(molde, ajustes);
  const r = { es: molde.es, en: molde.en, genero: molde.genero, plural: !!molde.plural, enPlural: !!molde.enPlural, dibujo2d: molde.dibujo2d };
  for (const o of opcionesDe(molde, aj)) {
    if (o.dibujo2d) r.dibujo2d = o.dibujo2d;
    if (o.prenda) Object.assign(r, o.prenda);
  }
  if (r.plural && r.enPlural === false && molde.enPlural) r.enPlural = true;
  return r;
}

/** Quita lo raro de un nombre escrito a mano: espacios de más, caracteres de control y lo que pase del máximo */
export function limpiarNombre(s, max = 18) {
  return String(s == null ? "" : s).replace(/[\u0000-\u001f]/g, " ").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

/**
 * Revisa un diseño (guardado, de otra versión o roto) contra los datos: quita lo que ya no existe.
 * @returns {object|null} el diseño limpio, o null si su molde ya no existe
 */
export function limpiarDiseno(d, idx) {
  if (!d || typeof d !== "object" || !idx.moldes) return null;
  const molde = idx.moldes.get(d.molde);
  if (!molde) return null;
  const cfg = idx.config.taller || {};
  const lugares = new Set((molde.lugares || []).map((l) => l.id));
  const usados = new Set();
  const calcas = (Array.isArray(d.calcas) ? d.calcas : []).filter((c) => {
    if (!c || !lugares.has(c.lugar) || usados.has(c.lugar) || !(idx.estampados && idx.estampados.has(c.estampado))) return false;
    usados.add(c.lugar);
    return true;
  }).map((c) => ({ estampado: c.estampado, lugar: c.lugar }));
  const color = idx.colores.has(d.color) ? d.color : idx.niveles[0].colores[0];
  const r = {
    id: typeof d.id === "string" && /^d-[a-z0-9-]{1,24}$/.test(d.id) ? d.id : "d-" + Math.random().toString(36).slice(2, 10),
    molde: molde.id,
    ajustes: ajustesDe(molde, d.ajustes),
    color,
    secundario: idx.colores.has(d.secundario) ? d.secundario : "blanco",
    patron: d.patron && idx.patrones && idx.patrones.has(d.patron) ? d.patron : null,
    calcas,
    nombre: limpiarNombre(d.nombre, cfg.maxNombre), // puede quedar vacío en el borrador; la prenda usa entonces el nombre del molde
    temas: (Array.isArray(d.temas) ? d.temas : []).filter((t) => idx.temas.has(t)).slice(0, cfg.maxTemas || 2),
    fecha: Number.isFinite(d.fecha) ? d.fecha : 0,
  };
  return r;
}

/** Un diseño nuevo de un molde, con los colores del primer nivel */
export function nuevoDiseno(moldeId, idx, ahora = 0) {
  return limpiarDiseno({ id: "d-" + ahora.toString(36) + Math.random().toString(36).slice(2, 6), molde: moldeId, ajustes: {}, color: "rosa", secundario: "blanco", calcas: [], nombre: "", temas: [], fecha: ahora }, idx);
}

/**
 * La prenda de un diseño (como las de prendas.json, con "diseno": true).
 * @param {object} d diseño ya limpio
 * @param {object} idx
 * @returns {object|null}
 */
export function prendaDeDiseno(d, idx) {
  const molde = idx.moldes && idx.moldes.get(d.molde);
  if (!molde) return null;
  const v = variante(molde, d.ajustes);
  const en2d = [];
  for (const c of d.calcas || []) {
    const l = (molde.lugares || []).find((x) => x.id === c.lugar);
    for (const q of (l && l.en2d) || []) en2d.push({ estampado: c.estampado, x: q.x, y: q.y, tam: q.tam });
  }
  const p = {
    id: d.id, categoria: molde.categoria, es: v.es, en: v.en, genero: v.genero, plural: v.plural, enPlural: v.enPlural,
    nombre: d.nombre || v.es, diseno: true, molde: molde.id,
    etiquetas: etiquetasDeTemas(d.temas, idx),
    colores: [d.color], secundario: d.secundario,
    dibujo2d: v.dibujo2d, piezas: piezasDe(molde, d.ajustes, d.calcas),
    patrones: false,
  };
  if (molde.lugar) p.lugar = molde.lugar;
  if (d.patron) p.patronFijo = d.patron;
  if (en2d.length) p.estampado2d = en2d;
  return p;
}

/**
 * Pone las prendas de los diseños en idx.prendas (y quita las de antes). Cambia idx: la vista 3D y la 2D usan el
 * mismo objeto, así ven los diseños nuevos sin rehacerse. No las pone en idx.porCategoria: solo salen en el
 * perchero "Mis diseños" (prendasDeZona) y no en las sugerencias de los jueces.
 * @param {object} idx
 * @param {object[]} disenos ya limpios
 * @returns {object} idx
 */
export function registrarDisenos(idx, disenos) {
  for (const [id, p] of [...idx.prendas]) if (p.diseno) idx.prendas.delete(id);
  for (const d of disenos || []) {
    const p = prendaDeDiseno(d, idx);
    if (p) idx.prendas.set(p.id, p);
  }
  return idx;
}

/** Cuántos diseños puede tener cosidos en este nivel (config.taller: espacios al empezar, uno más cada N niveles, máximo) */
export function espacios(nivelI, config) {
  const t = config.taller || {};
  return Math.min(t.maxEspacios || 9, (t.espacios || 4) + Math.floor(nivelI / (t.espacioCadaNiveles || 6)));
}

/** Nombres sugeridos para un diseño (para escoger con el control de la TV, sin teclado) */
export function nombresSugeridos(d, idx) {
  const molde = idx.moldes.get(d.molde);
  if (!molde) return [];
  const v = variante(molde, d.ajustes);
  const art = v.plural ? "Mis" : "Mi";
  const nombre = v.es.charAt(0).toUpperCase() + v.es.slice(1);
  const r = [`${art} ${v.es}`];
  const pa = d.patron && idx.patrones.get(d.patron);
  if (pa) r.push(`${nombre} de ${pa.es}`);
  const c = d.calcas && d.calcas[0] && idx.estampados.get(d.calcas[0].estampado);
  if (c) r.push(`${nombre} ${c.es === "osito" ? "del" : "de"} ${c.es}`);
  const t = d.temas && d.temas[0] && idx.temas.get(d.temas[0]);
  if (t) r.push(`${nombre} para ${t.nombre.toLowerCase()}`);
  const col = idx.colores.get(d.color);
  if (col) r.push(`${nombre} ${/o$/.test(col.es) ? concuerda(col.es, v) : col.es}`);
  return [...new Set(r.map((x) => limpiarNombre(x, (idx.config.taller || {}).maxNombre)))].slice(0, 4);
}

/** Las prendas de "Mis diseños" (para el perchero), las más nuevas primero */
export const prendasDeDisenos = (idx) => [...idx.prendas.values()].filter((p) => p.diseno);
