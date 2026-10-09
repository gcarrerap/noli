// Datos de la Pasarela (los JSON de datos/): revisarlos e indexarlos. Lógica pura: no lee archivos ni la red
// (eso lo hace src/ui/cargar.js en el navegador y las pruebas con fs). Ver docs/ARQUITECTURA.md.

/** Formas con las que se arma una prenda (src/escena/formas.js las dibuja). */
export const FORMAS = ["tubo", "esfera", "caja", "capsula", "toro", "cono", "disco", "plano", "octaedro", "anillo"];

/** Partes del cuerpo a las que se pega una pieza (src/escena/avatar.js). I = izquierda del personaje, D = derecha. */
export const ANCLAS = ["cadera", "torso", "cuello", "cabeza", "brazoI", "brazoD", "antebrazoI", "antebrazoD", "manoI", "manoD",
  "musloI", "musloD", "piernaI", "piernaD", "pieI", "pieD"];

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
export function revisarPieza(p, donde, colores, dentroDeAnillo = false) {
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
  if (p.f !== "anillo" && !(col === "p" || col === "s" || esHex(col) || colores.has(col))) e.push(`${donde}: "col" debe ser "p", "s", un color o #hex`);
  const pide = { tubo: ["y", "r"], esfera: ["r"], caja: ["tam"], capsula: ["r", "largo"], toro: ["r", "grosor"], cono: ["r", "alto"],
    disco: ["r", "alto"], plano: ["tam"], octaedro: ["r"], anillo: ["radio", "n", "pieza"] }[p.f] || [];
  for (const k of pide) if (p[k] === undefined) e.push(`${donde}: falta "${k}"`);
  if (p.f === "tubo" && !(esVec(p.y, 2) && esVec(p.r, 2) && p.y[0] > p.y[1])) e.push(`${donde}: tubo pide y [arriba, abajo] y r [arriba, abajo]`);
  if (p.f === "tubo" && p.tapa !== undefined && !["arriba", "abajo", "ambas"].includes(p.tapa)) e.push(`${donde}: "tapa" es arriba, abajo o ambas`);
  if (p.f === "caja" && !esVec(p.tam, 3)) e.push(`${donde}: caja pide tam [ancho, alto, fondo]`);
  if (p.f === "plano" && !esVec(p.tam, 2)) e.push(`${donde}: plano pide tam [ancho, alto]`);
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
    if (p.categoria === "accesorio" && !lugares.has(p.lugar)) e.push(`${donde}: accesorio sin lugar válido (${[...lugares].join(", ")})`);
    if (p.categoria !== "accesorio" && p.lugar) e.push(`${donde}: solo los accesorios llevan lugar`);
    if (!p.dibujo2d) e.push(`${donde}: falta dibujo2d (modo sencillo)`);
    if (p.modelo !== undefined && !/^modelos\/[a-z0-9-]+\.glb$/.test(p.modelo)) e.push(`${donde}: modelo debe ser modelos/<nombre>.glb`);
    if (p.modelo && !ANCLAS.includes(p.ancla)) e.push(`${donde}: una prenda con modelo pide "ancla" (${ANCLAS.join(", ")})`);
    if (!p.modelo && (!Array.isArray(p.piezas) || !p.piezas.length)) e.push(`${donde}: sin piezas ni modelo`);
    (p.piezas || []).forEach((pz, i) => e.push(...revisarPieza(pz, `${donde} pieza ${i + 1}`, colores)));
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

  const abre = { prendas: new Map(), colores: new Map(), temas: new Map() };
  let antes = -1;
  d.desbloqueos.niveles.forEach((n, i) => {
    if (!(Number.isInteger(n.puntos) && n.puntos > antes)) e.push(`nivel ${n.nombre}: los puntos deben subir de nivel en nivel`);
    antes = n.puntos;
    if (i === 0 && n.puntos !== 0) e.push("el primer nivel debe empezar en 0 puntos");
    for (const [k, valid] of [["prendas", ids], ["colores", colores], ["temas", temas]]) {
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

  const catsConZona = new Set();
  for (const z of d.zonas.zonas) {
    for (const c of z.categorias || []) { if (!categorias.has(c)) e.push(`zona ${z.id}: categoría "${c}" desconocida`); catsConZona.add(c); }
    if (!z.categorias && !["espejo", "pasarela"].includes(z.accion)) e.push(`zona ${z.id}: pide categorias o accion (espejo, pasarela)`);
    if (!esVec(z.punto, 2) || !esVec(z.mueble && z.mueble.caja, 5)) e.push(`zona ${z.id}: punto [x, z] y mueble.caja [x, z, ancho, fondo, alto]`);
  }
  for (const c of categorias) if (!catsConZona.has(c)) e.push(`categoría ${c}: ninguna zona del estudio la abre`);

  for (const j of d.jueces.jueces) {
    const s = Object.values(j.pesos).reduce((a, b) => a + b, 0);
    if (Math.abs(s - 1) > 1e-9) e.push(`juez ${j.id}: los pesos deben sumar 1 (suman ${s})`);
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
    zonas: d.zonas,
    jueces: d.jueces.jueces,
  };
}

/** Archivos de datos/ que hay que leer, con la clave que usa revisarDatos/indexar. */
export const ARCHIVOS = { config: "config.json", colores: "colores.json", temas: "temas.json", prendas: "prendas.json",
  desbloqueos: "desbloqueos.json", zonas: "zonas.json", jueces: "jueces.json" };
