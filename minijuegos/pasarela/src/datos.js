// Datos de la Pasarela (los JSON de datos/): revisarlos e indexarlos. Lógica pura: no lee archivos ni la red
// (eso lo hace src/ui/cargar.js en el navegador y las pruebas con fs). Ver docs/ARQUITECTURA.md.

import { piezasDe } from "./taller.js";

/** Formas con las que se arma una prenda (kit/3d/formas.js las dibuja). */
export const FORMAS = ["tubo", "esfera", "caja", "capsula", "toro", "cono", "disco", "plano", "octaedro", "anillo", "calca"];

/** Partes del cuerpo a las que se pega una pieza (kit/3d/avatar.js). I = izquierda del personaje, D = derecha. */
export const ANCLAS = ["cadera", "torso", "cuello", "cabeza", "brazoI", "brazoD", "antebrazoI", "antebrazoD", "manoI", "manoD",
  "musloI", "musloD", "piernaI", "piernaD", "pieI", "pieD"];

/** Categorías que van por lugar (un accesorio o maquillaje por lugar: orejas, labios…) en lugar de una sola ranura */
export const CON_LUGAR = ["accesorio", "maquillaje"];
/** ¿Esta prenda se pone en un lugar (accesorio o maquillaje)? */
export const conLugar = (prenda) => CON_LUGAR.includes(prenda.categoria);

/** Qué parte del cuerpo enfoca la cámara al abrir el panel de una zona (src/ui/vista3d.js → ENFOQUES) */
export const ENFOQUES = ["cara", "cabeza", "alto", "torso", "cuerpo", "piernas", "pies"];

/**
 * Las prendas que se escogen en una zona: las de sus categorías y, si la zona dice "lugares", solo las de esos lugares.
 * @param {{categorias: string[], lugares?: string[]}} zona
 * @param {{porCategoria: Map}} idx
 */
export function prendasDeZona(zona, idx) {
  // "Mis diseños" (#80): las prendas que cosió en el Taller (taller.js → registrarDisenos)
  if (zona.disenos) return [...idx.prendas.values()].filter((p) => p.diseno).reverse();
  return (zona.categorias || []).flatMap((c) => idx.porCategoria.get(c) || []).filter((p) => !zona.lugares || zona.lugares.includes(p.lugar));
}

/** Lugares de las partes del atuendo además de los accesorios */
export const RANURAS = ["peinado", "arriba", "abajo", "vestido", "zapatos"];

const esNum = (v) => typeof v === "number" && Number.isFinite(v);
const esVec = (v, n) => Array.isArray(v) && v.length === n && v.every(esNum);
const esHex = (v) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);

/**
 * Revisa una pieza (forma) de una prenda. Devuelve la lista de errores (vacía si está bien).
 * @param {object} p pieza
 * @param {string} donde texto para el mensaje ("a-camiseta pieza 2")
 * @param {Set<string>} colores ids de colores válidos
 * @param {boolean} [dentroDeAnillo] la pieza repetida de un anillo no lleva ancla
 * @returns {string[]}
 */
export function revisarPieza(p, donde, colores, dentroDeAnillo = false, estampados = null) {
  const e = [];
  if (!p || typeof p !== "object") return [`${donde}: no es un objeto`];
  if (!FORMAS.includes(p.f)) e.push(`${donde}: forma "${p.f}" desconocida (${FORMAS.join(", ")})`);
  if (!dentroDeAnillo && !ANCLAS.includes(p.a)) e.push(`${donde}: ancla "${p.a}" desconocida`);
  if (dentroDeAnillo && p.a) e.push(`${donde}: la pieza de un anillo no lleva ancla`);
  if (p.espejo && /D$/.test(p.a || "")) e.push(`${donde}: "espejo" va con el ancla de la izquierda (…I) o una del centro, no con …D`);
  if (p.pos !== undefined && !esVec(p.pos, 3)) e.push(`${donde}: "pos" debe ser [x, y, z]`);
  if (p.rot !== undefined && !esVec(p.rot, 3)) e.push(`${donde}: "rot" debe ser [x, y, z] en grados`);
  if (p.esc !== undefined && !esVec(p.esc, 3)) e.push(`${donde}: "esc" debe ser [x, y, z]`);
  if (p.opacidad !== undefined && !(esNum(p.opacidad) && p.opacidad > 0 && p.opacidad <= 1)) e.push(`${donde}: "opacidad" de 0 a 1`);
  const col = p.col;
  if (p.f !== "anillo" && p.f !== "calca" && !(col === "p" || col === "s" || esHex(col) || colores.has(col))) e.push(`${donde}: "col" debe ser "p", "s", un color o #hex`);
  const pide = { tubo: ["y", "r"], esfera: ["r"], caja: ["tam"], capsula: ["r", "largo"], toro: ["r", "grosor"], cono: ["r", "alto"],
    disco: ["r", "alto"], plano: ["tam"], octaedro: ["r"], anillo: ["radio", "n", "pieza"],
    calca: ["y", "r", "ancho", "estampado"] }[p.f] || [];
  for (const k of pide) if (p[k] === undefined) e.push(`${donde}: falta "${k}"`);
  if (p.f === "tubo" && !(esVec(p.y, 2) && esVec(p.r, 2) && p.y[0] > p.y[1])) e.push(`${donde}: tubo pide y [arriba, abajo] y r [arriba, abajo]`);
  if (p.f === "tubo" && p.tapa !== undefined && !["arriba", "abajo", "ambas"].includes(p.tapa)) e.push(`${donde}: "tapa" es arriba, abajo o ambas`);
  if (p.f === "caja" && !esVec(p.tam, 3)) e.push(`${donde}: caja pide tam [ancho, alto, fondo]`);
  if (p.f === "plano" && !esVec(p.tam, 2)) e.push(`${donde}: plano pide tam [ancho, alto]`);
  if (p.f === "calca") {
    if (!(esVec(p.y, 2) && esVec(p.r, 2) && p.y[0] > p.y[1])) e.push(`${donde}: calca pide y [arriba, abajo] y r [arriba, abajo] (un poco más que la tela)`);
    if (p.lado !== undefined && !["frente", "espalda"].includes(p.lado)) e.push(`${donde}: "lado" es frente o espalda`);
    if (estampados && p.estampado && !estampados.has(p.estampado)) e.push(`${donde}: estampado "${p.estampado}" no está en estampados.json`);
  }
  if (p.f === "anillo") {
    if (!(Number.isInteger(p.n) && p.n >= 2 && p.n <= 24)) e.push(`${donde}: "n" de 2 a 24`);
    if (p.pieza) e.push(...revisarPieza(p.pieza, donde + " (pieza del anillo)", colores, true));
  }
  return e;
}

/**
 * Revisa todos los datos del juego y su consistencia (que cada prenda se abra en algún nivel, que los temas usen
 * etiquetas y colores que existen, etc.). Devuelve la lista de errores; vacía = todo bien.
 * @param {{config, colores, temas, prendas, desbloqueos, zonas, jueces}} d los JSON ya leídos
 * @returns {string[]}
 */
export function revisarDatos(d) {
  const e = [];
  const colores = new Set(d.colores.colores.map((c) => c.id));
  const etiquetas = new Set(d.config.etiquetas);
  const categorias = new Set(d.config.categorias.map((c) => c.id));
  const lugares = new Set(d.config.lugares);

  // Patrones y estampados (arte SVG o PNG)
  const patrones = new Set(), estampados = new Set();
  for (const [lista, set, carpeta, nombre] of [[d.patrones ? d.patrones.patrones : [], patrones, "patrones", "patrón"], [d.estampados ? d.estampados.estampados : [], estampados, "estampados", "estampado"]]) {
    for (const x of lista) {
      if (!/^[a-z0-9-]+$/.test(x.id || "") || set.has(x.id)) e.push(`${nombre} ${x.id}: id en minúsculas y sin repetir`);
      set.add(x.id);
      if (!x.es || !x.en) e.push(`${nombre} ${x.id}: falta es o en`);
      const ext = carpeta === "patrones" ? /\.svg$/ : /\.(svg|png)$/;
      if (!(typeof x.archivo === "string" && x.archivo.startsWith(carpeta + "/") && ext.test(x.archivo))) e.push(`${nombre} ${x.id}: archivo en ${carpeta}/ (${carpeta === "patrones" ? ".svg" : ".svg o .png"})`);
      for (const t of x.etiquetas || []) if (!etiquetas.has(t)) e.push(`${nombre} ${x.id}: etiqueta "${t}" desconocida`);
    }
  }

  for (const c of d.colores.colores) if (!c.id || !c.es || !c.en || !esHex(c.hex)) e.push(`color ${c.id}: pide id, es, en y hex`);

  const ids = new Set();
  for (const p of d.prendas.prendas) {
    const donde = p.id || "(sin id)";
    if (ids.has(p.id)) e.push(`${donde}: id repetido`);
    ids.add(p.id);
    if (!/^[a-z]-[a-z0-9-]+$/.test(p.id || "")) e.push(`${donde}: id con letra de categoría, guion y nombre (a-camiseta)`);
    if (!categorias.has(p.categoria)) e.push(`${donde}: categoría "${p.categoria}" desconocida`);
    if (!p.es || !p.en) e.push(`${donde}: falta el nombre en español (es) o en inglés (en)`);
    if (!["m", "f"].includes(p.genero)) e.push(`${donde}: genero "m" o "f" (para el/la)`);
    if (!Array.isArray(p.etiquetas) || !p.etiquetas.length) e.push(`${donde}: sin etiquetas`);
    else for (const t of p.etiquetas) if (!etiquetas.has(t)) e.push(`${donde}: etiqueta "${t}" no está en config.json`);
    if (!Array.isArray(p.colores) || !p.colores.length) e.push(`${donde}: sin colores`);
    else for (const c of p.colores) if (!colores.has(c)) e.push(`${donde}: color "${c}" no está en colores.json`);
    if (p.secundario !== undefined && !(colores.has(p.secundario) || esHex(p.secundario))) e.push(`${donde}: secundario debe ser un color o #hex`);
    if (conLugar(p) && !lugares.has(p.lugar)) e.push(`${donde}: ${p.categoria} sin lugar válido (${[...lugares].join(", ")})`);
    if (!conLugar(p) && p.lugar) e.push(`${donde}: solo los accesorios y el maquillaje llevan lugar`);
    if (!p.dibujo2d) e.push(`${donde}: falta dibujo2d (modo sencillo)`);
    if (p.modelo !== undefined && !/^modelos\/[a-z0-9-]+\.glb$/.test(p.modelo)) e.push(`${donde}: modelo debe ser modelos/<nombre>.glb`);
    if (p.modelo && !ANCLAS.includes(p.ancla)) e.push(`${donde}: una prenda con modelo pide "ancla" (${ANCLAS.join(", ")})`);
    if (!p.modelo && (!Array.isArray(p.piezas) || !p.piezas.length)) e.push(`${donde}: sin piezas ni modelo`);
    (p.piezas || []).forEach((pz, i) => e.push(...revisarPieza(pz, `${donde} pieza ${i + 1}`, colores, false, estampados)));
    if (p.patrones !== undefined && typeof p.patrones !== "boolean") e.push(`${donde}: "patrones" es true o false`);
    if (p.estampado2d !== undefined) {
      const q = p.estampado2d;
      if (!(q && estampados.has(q.estampado) && esNum(q.x) && esNum(q.y) && esNum(q.tam))) e.push(`${donde}: estampado2d pide { estampado, x, y, tam }`);
    }
  }

  const temas = new Set();
  for (const t of d.temas.temas) {
    temas.add(t.id);
    if (!t.nombre || !t.icono) e.push(`tema ${t.id}: falta nombre o icono`);
    for (const [k, v] of Object.entries(t.etiquetas || {})) {
      if (!etiquetas.has(k)) e.push(`tema ${t.id}: etiqueta "${k}" desconocida`);
      if (![1, 2, 3].includes(v)) e.push(`tema ${t.id}: el peso de "${k}" es 1, 2 o 3`);
    }
    for (const k of t.evitar || []) if (!etiquetas.has(k)) e.push(`tema ${t.id}: evitar "${k}" desconocida`);
    for (const c of t.colores || []) if (!colores.has(c)) e.push(`tema ${t.id}: color "${c}" desconocido`);
  }

  const poses = new Set((d.poses ? d.poses.poses : []).map((x) => x.id));
  const abre = { prendas: new Map(), colores: new Map(), temas: new Map(), poses: new Map(), patrones: new Map(), estampados: new Map() };
  let antes = -1;
  d.desbloqueos.niveles.forEach((n, i) => {
    if (!(Number.isInteger(n.puntos) && n.puntos > antes)) e.push(`nivel ${n.nombre}: los puntos deben subir de nivel en nivel`);
    antes = n.puntos;
    if (i === 0 && n.puntos !== 0) e.push("el primer nivel debe empezar en 0 puntos");
    for (const [k, valid] of [["prendas", ids], ["colores", colores], ["temas", temas], ["poses", poses], ["patrones", patrones], ["estampados", estampados]]) {
      for (const x of n[k] || []) {
        if (!valid.has(x)) e.push(`nivel ${n.nombre}: ${k} "${x}" no existe`);
        if (abre[k].has(x)) e.push(`nivel ${n.nombre}: "${x}" ya se abría en ${abre[k].get(x)}`);
        abre[k].set(x, n.nombre);
      }
    }
  });
  for (const x of ids) if (!abre.prendas.has(x)) e.push(`${x}: no se abre en ningún nivel (desbloqueos.json)`);
  for (const x of colores) if (!abre.colores.has(x)) e.push(`color ${x}: no se abre en ningún nivel`);
  for (const x of temas) if (!abre.temas.has(x)) e.push(`tema ${x}: no se abre en ningún nivel`);
  for (const x of poses) if (!abre.poses.has(x)) e.push(`pose ${x}: no se abre en ningún nivel`);
  for (const x of patrones) if (!abre.patrones.has(x)) e.push(`patrón ${x}: no se abre en ningún nivel`);
  for (const x of estampados) if (!abre.estampados.has(x)) e.push(`estampado ${x}: no se abre en ningún nivel`);
  if (d.poses && !(d.desbloqueos.niveles[0].poses || []).length) e.push("el primer nivel debe abrir al menos una pose");

  const catsConZona = new Set();
  for (const z of d.zonas.zonas) {
    for (const c of z.categorias || []) {
      if (!categorias.has(c)) e.push(`zona ${z.id}: categoría "${c}" desconocida`);
      if (CON_LUGAR.includes(c)) for (const l of z.lugares || [...lugares]) catsConZona.add(c + ":" + l);
      else catsConZona.add(c);
    }
    for (const l of z.lugares || []) if (!lugares.has(l)) e.push(`zona ${z.id}: lugar "${l}" desconocido`);
    if (z.enfoque !== undefined && !ENFOQUES.includes(z.enfoque)) e.push(`zona ${z.id}: enfoque "${z.enfoque}" (${ENFOQUES.join(", ")})`);
    if (!z.categorias && !z.disenos && !["espejo", "pasarela", "taller"].includes(z.accion)) e.push(`zona ${z.id}: pide categorias, "disenos": true o accion (espejo, pasarela, taller)`);
    if (!esVec(z.punto, 2) || !esVec(z.mueble && z.mueble.caja, 5)) e.push(`zona ${z.id}: punto [x, z] y mueble.caja [x, z, ancho, fondo, alto]`);
  }
  for (const c of categorias) if (!CON_LUGAR.includes(c) && !catsConZona.has(c)) e.push(`categoría ${c}: ninguna zona del estudio la abre`);
  for (const p of d.prendas.prendas) if (conLugar(p) && !catsConZona.has(p.categoria + ":" + p.lugar)) e.push(`${p.id}: ninguna zona del estudio abre ${p.categoria} de ${p.lugar}`);

  for (const j of d.jueces.jueces) {
    const s = Object.values(j.pesos).reduce((a, b) => a + b, 0);
    if (Math.abs(s - 1) > 1e-9) e.push(`juez ${j.id}: los pesos deben sumar 1 (suman ${s})`);
  }

  // Moldes del Taller de diseño (#80): cada combinación de opciones tiene que armar piezas válidas
  const vistosMoldes = new Set();
  for (const m of d.moldes ? d.moldes.moldes : []) {
    const donde = `molde ${m.id}`;
    if (!/^[a-z0-9-]+$/.test(m.id || "") || vistosMoldes.has(m.id)) e.push(`${donde}: id en minúsculas y sin repetir`);
    vistosMoldes.add(m.id);
    if (!categorias.has(m.categoria) || m.categoria === "peinado" || m.categoria === "maquillaje") e.push(`${donde}: categoría de ropa o accesorio`);
    if (CON_LUGAR.includes(m.categoria) && !lugares.has(m.lugar)) e.push(`${donde}: un accesorio pide "lugar"`);
    if (!m.es || !m.en || !["f", "m"].includes(m.genero)) e.push(`${donde}: falta es, en o genero (f/m)`);
    if (!Array.isArray(m.controles) || m.controles.length < 1 || m.controles.length > 3) { e.push(`${donde}: de 1 a 3 controles`); continue; }
    for (const c of m.controles) {
      const ids = (c.opciones || []).map((o) => o.id);
      if (ids.length < 2 || ids.length > 4 || new Set(ids).size !== ids.length) e.push(`${donde} control ${c.id}: de 2 a 4 opciones sin repetir`);
      for (const o of c.opciones || []) if (!o.es || !o.en) e.push(`${donde} ${c.id}.${o.id}: falta es o en`);
      if (m.inicial && m.inicial[c.id] && !ids.includes(m.inicial[c.id])) e.push(`${donde}: inicial.${c.id} no es una opción`);
    }
    const nombres = new Set((m.piezas || []).filter((p) => p.nombre).map((p) => p.nombre));
    for (const l of m.lugares || []) {
      if (!nombres.has(l.pieza)) e.push(`${donde} lugar ${l.id}: "pieza" debe ser el nombre de un tubo del molde`);
      if (!(esNum(l.desde) && esNum(l.hasta) && l.desde >= 0 && l.desde < l.hasta && l.hasta <= 1)) e.push(`${donde} lugar ${l.id}: desde < hasta, entre 0 y 1`);
    }
    // Todas las combinaciones (son pocas: 3 controles × 4 opciones = 64 como mucho)
    let combos = [{}];
    for (const c of m.controles) combos = combos.flatMap((a) => (c.opciones || []).map((o) => ({ ...a, [c.id]: o.id })));
    const una = [...estampados][0];
    for (const aj of combos) {
      const calcas = una ? (m.lugares || []).map((l) => ({ estampado: una, lugar: l.id })) : [];
      let piezas;
      try { piezas = piezasDe(m, aj, calcas); } catch (err) { e.push(`${donde} ${JSON.stringify(aj)}: ${err.message}`); continue; }
      piezas.forEach((pz, i) => e.push(...revisarPieza(pz, `${donde} ${Object.values(aj).join("/")} pieza ${i + 1}`, colores, false, estampados)));
      if (piezas.length < (m.piezas || []).filter((p) => !p.solo).length) e.push(`${donde} ${Object.values(aj).join("/")}: falta alguna pieza ("sobre" a una pieza que no es tubo)`);
    }
  }

  return e;
}

/**
 * Índices para buscar rápido: prendas por id y por categoría, colores y temas por id.
 * @param {object} d los JSON ya leídos
 */
export function indexar(d) {
  const prendas = new Map(d.prendas.prendas.map((p) => [p.id, p]));
  const porCategoria = new Map(d.config.categorias.map((c) => [c.id, []]));
  for (const p of d.prendas.prendas) porCategoria.get(p.categoria).push(p);
  return {
    config: d.config,
    prendas,
    porCategoria,
    colores: new Map(d.colores.colores.map((c) => [c.id, c])),
    temas: new Map(d.temas.temas.map((t) => [t.id, t])),
    niveles: d.desbloqueos.niveles,
    poses: new Map((d.poses ? d.poses.poses : []).map((x) => [x.id, x])),
    // Patrones y estampados: cada uno con su .svg (texto) o .url (PNG), que pone cargar.js (o las pruebas)
    patrones: new Map((d.patrones ? d.patrones.patrones : []).map((x) => [x.id, x])),
    estampados: new Map((d.estampados ? d.estampados.estampados : []).map((x) => [x.id, x])),
    // Moldes del Taller de diseño (#80; src/taller.js)
    moldes: new Map((d.moldes ? d.moldes.moldes : []).map((x) => [x.id, x])),
    zonas: d.zonas,
    jueces: d.jueces.jueces,
  };
}

/** Archivos de datos/ que hay que leer, con la clave que usa revisarDatos/indexar. */
export const ARCHIVOS = { config: "config.json", colores: "colores.json", temas: "temas.json", prendas: "prendas.json",
  desbloqueos: "desbloqueos.json", zonas: "zonas.json", jueces: "jueces.json", poses: "poses.json",
  patrones: "patrones.json", estampados: "estampados.json", moldes: "moldes.json" };

/**
 * ¿Esta prenda acepta un patrón? La ropa de config.categoriasConPatron sí (salvo "patrones": false); los accesorios
 * solo si dicen "patrones": true. El peinado y el maquillaje nunca.
 * @param {{categoria: string, patrones?: boolean, modelo?: string}} prenda
 * @param {{categoriasConPatron?: string[]}} config
 */
export function aceptaPatron(prenda, config) {
  if (prenda.modelo) return false;
  if (prenda.patrones === false) return false;
  return prenda.patrones === true || (config.categoriasConPatron || []).includes(prenda.categoria);
}

/**
 * El arte que hay que leer aparte de los JSON: { tipo: "patrones" | "estampados", id, archivo }.
 * cargar.js lo lee del sitio; las pruebas, del disco. Después se pone en cada uno .svg (texto) o .url (PNG).
 */
export function arteDe(d) {
  const r = [];
  for (const [tipo, lista] of [["patrones", d.patrones ? d.patrones.patrones : []], ["estampados", d.estampados ? d.estampados.estampados : []]])
    for (const x of lista) r.push({ tipo, id: x.id, archivo: x.archivo, x });
  return r;
}
