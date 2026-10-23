// Página de administrador (admin.html): ver los perfiles de la nube y sobrescribir créditos, Pasarela y libros.
// Lógica pura: arma los datos nuevos de cada juego a partir de lo que hay en la nube. La red la hace src/admin/main.js.
// Ver DESIGN.md §7 → "Administrador".
import { leerLibro, saldo, agregar } from "./creditos.js";
import { normalizar as normalizarMundo } from "./islas.js";

/** Dispositivo con el que se marcan los cambios del administrador (en el libro de créditos y en la nube) */
export const DISPOSITIVO_ADMIN = "admin";

// ---------- Créditos ----------

/**
 * Créditos: el libro no se pisa (los dispositivos lo JUNTAN con el suyo, §12), así que para dejar un saldo se agrega
 * un movimiento "ajuste" (o "regalo" si sube) con la diferencia.
 * @param {*} datos el libro que hay en la nube (o null)
 * @param {number} objetivo saldo que se quiere
 * @param {number} ahora ms
 * @returns {{ libro: object, n: number }} n: el movimiento que se agregó (0 si ya estaba en ese saldo)
 */
export function ponerSaldo(datos, objetivo, ahora) {
  const libro = leerLibro(datos);
  if (!Number.isInteger(objetivo) || objetivo < 0) throw new Error("El saldo debe ser un número entero, 0 o más.");
  const n = objetivo - saldo(libro);
  if (n === 0) return { libro, n };
  return { libro: agregar(libro, { n, m: n > 0 ? "regalo" : "ajuste", d: DISPOSITIVO_ADMIN, f: ahora }), n };
}

export const saldoDe = (datos) => saldo(leerLibro(datos));

// ---------- Pasarela ----------

/** Lo que se edita de la Pasarela: puntos de estilo, pasarelas hechas y premios abiertos */
export const CAMPOS_PASARELA = ["puntos", "pasarelas", "premios"];

/**
 * Resumen de la Pasarela para la lista.
 * @param {*} datos lo guardado por el juego (o null)
 * @param {{ niveles: {nombre, puntos}[], premios: string[] }} desbloqueos minijuegos/pasarela/datos/desbloqueos.json
 */
export function resumenPasarela(datos, desbloqueos) {
  const d = datos && typeof datos === "object" ? datos : {};
  const num = (x) => (Number.isInteger(x) && x >= 0 ? x : 0);
  const puntos = num(d.puntos), pasarelas = num(d.pasarelas);
  const total = (desbloqueos && desbloqueos.premios || []).length;
  // Igual que el juego (progreso.js → leerProgreso): sin "premios" (versiones viejas) se calculan de las pasarelas
  const premios = Math.min(total, Number.isInteger(d.premios) && d.premios >= 0 ? d.premios : Math.round(pasarelas * 1.5));
  return { puntos, pasarelas, premios, totalPremios: total, nivel: nivelPorPuntos(puntos, desbloqueos) };
}

export function nivelPorPuntos(puntos, desbloqueos) {
  const niveles = (desbloqueos && desbloqueos.niveles) || [];
  let nombre = niveles[0] ? niveles[0].nombre : "";
  for (const n of niveles) if (puntos >= n.puntos) nombre = n.nombre;
  return nombre;
}

/**
 * La Pasarela con nuevos puntos, pasarelas y premios. Lo demás (atuendos, diseños, dibujos, piel…) se queda.
 * @param {*} datos lo que hay en la nube (o null)
 * @param {{ puntos?: number, pasarelas?: number, premios?: number }} cambios
 * @param {number} totalPremios cuántos premios hay en la fila
 */
export function conPasarela(datos, cambios, totalPremios) {
  const d = datos && typeof datos === "object" ? { ...datos } : { v: 3, vistos: [], atuendos: [], piel: 0, ultimo: null, ultimoTema: null, disenos: [], borrador: null, dibujos: [] };
  for (const k of CAMPOS_PASARELA) {
    if (cambios[k] === undefined) continue;
    const v = cambios[k];
    if (!Number.isInteger(v) || v < 0) throw new Error(`${k}: debe ser un número entero, 0 o más.`);
    d[k] = k === "premios" ? Math.min(v, totalPremios) : v;
  }
  for (const k of CAMPOS_PASARELA) if (!Number.isInteger(d[k])) d[k] = 0;
  d.v = Math.max(3, Number.isInteger(d.v) ? d.v : 3);
  return d;
}

// ---------- Libros (Biblioteca) ----------

/**
 * Progreso de un libro tal como lo guarda la Biblioteca (minijuegos/biblioteca/src/libro.js → progresoDe).
 * @returns {{ leidos: number[], encontrados: number[], todos: boolean, pos: null | {c, p} }}
 */
export function libroDe(datos, idLibro) {
  const pr = (datos && datos.libros && datos.libros[idLibro]) || {};
  const nums = (x) => (Array.isArray(x) ? x.filter(Number.isInteger) : []);
  return {
    leidos: nums(pr.leidos),
    encontrados: nums(pr.encontrados),
    todos: pr.todos === true,
    pos: pr.pos && Number.isInteger(pr.pos.c) && Number.isInteger(pr.pos.p) ? { c: pr.pos.c, p: pr.pos.p } : null,
  };
}

/**
 * La Biblioteca con un libro cambiado. Lo demás del libro (modo, voz despacio, guía) y los otros libros se quedan.
 * Si la página donde iba ya no está en un capítulo abierto, se quita (empieza en el primero abierto que no ha leído).
 * @param {*} datos lo que hay en la nube (o null)
 * @param {string} idLibro
 * @param {{ leidos: number[], encontrados: number[], todos: boolean }} cambios
 */
export function conLibro(datos, idLibro, { leidos, encontrados, todos }) {
  const d = datos && typeof datos === "object" ? datos : { v: 1, libros: {} };
  const antes = (d.libros && d.libros[idLibro]) || {};
  const orden = (xs) => [...new Set(xs.filter(Number.isInteger))].sort((a, b) => a - b);
  const nuevo = { ...antes, leidos: orden(leidos), encontrados: orden(encontrados), todos: !!todos };
  const pos = antes.pos;
  if (pos && !(nuevo.todos || nuevo.encontrados.includes(pos.c) || nuevo.leidos.includes(pos.c))) delete nuevo.pos;
  return { ...d, v: 1, libros: { ...(d.libros || {}), [idLibro]: nuevo } };
}

// ---------- Juegos: nivel, monedas… (#160) ----------

/**
 * Lo que se puede sobrescribir de cada juego, campo por campo. `ruta` es dónde vive el número en lo que guarda el juego
 * (con puntos para entrar a objetos); `sigue` es otro campo que se pone igual (el nivel "elegido", para que juegue el
 * nivel nuevo). `v` es la versión con la que se empieza si el juego todavía no tiene nada guardado.
 * Los topes son los mismos que usa cada juego al cargar (minijuegos/<id>/src/progreso.js → cargar).
 */
export const CAMPOS_JUEGO = {
  "sumas-restas": { v: 1, campos: [{ ruta: "nivel", nombre: "Nivel", min: 1, max: 12 }] },
  "fabrica-numeros": { v: 1, campos: [{ ruta: "nivel", nombre: "Nivel", min: 1, max: 8, sigue: "elegido" }] },
  huerto: { v: 1, campos: [{ ruta: "nivel", nombre: "Nivel", min: 1, max: 6, sigue: "elegido" }] },
  "reloj-dragon": { v: 1, campos: [{ ruta: "nivel", nombre: "Nivel", min: 1, max: 8, sigue: "elegido" },
    { ruta: "album", nombre: "Estampas del álbum", min: 0, max: 3 }] },
  pizzeria: { v: 1, campos: [{ ruta: "nivel", nombre: "Nivel", min: 1, max: 7, sigue: "elegido" },
    { ruta: "propinas", nombre: "Propinas", min: 0 }] },
  puentes: { v: 1, campos: [{ ruta: "nivel", nombre: "Nivel", min: 1, max: 7, sigue: "elegido" }] },
  "safari-datos": { v: 1, campos: [{ ruta: "nivel", nombre: "Nivel", min: 1, max: 6, sigue: "elegido" },
    { ruta: "zoo", nombre: "Animales nuevos en el zoo", min: 0, max: 8 }] },
  tienda: { v: 1, campos: [{ ruta: "porMoneda.usd.nivel", nombre: "Nivel con dólares", min: 1, max: 7, sigue: "porMoneda.usd.elegido" },
    { ruta: "porMoneda.mxn.nivel", nombre: "Nivel con pesos", min: 1, max: 7, sigue: "porMoneda.mxn.elegido" },
    { ruta: "tienda.monedas", nombre: "Monedas de la tienda", min: 0 }] },
  spelling: { v: 2, campos: [{ ruta: "lista", nombre: "Lista", min: 1, max: 16, sigue: "elegida" }] },
  "robot-palabras": { v: 1, campos: [{ ruta: "nivel", nombre: "Nivel", min: 1, max: 7, sigue: "elegido" }] },
  "mision-luna": { v: 1, campos: [{ ruta: "abierta", nombre: "Misión abierta", min: 1, max: 6, sigue: "elegida" }] },
  "mi-casita": { v: 1, campos: [{ ruta: "visitas", nombre: "Visitas", min: 0 }] },
  "cajas-sorpresa": { v: 1, campos: [{ ruta: "polvo", nombre: "Polvo de estrellas", min: 0 }, { ruta: "abiertas", nombre: "Cajas abiertas", min: 0 }] },
};

/** Lee un valor por ruta ("tienda.monedas") */
export function leerRuta(datos, ruta) {
  let x = datos;
  for (const k of ruta.split(".")) { if (!x || typeof x !== "object") return undefined; x = x[k]; }
  return x;
}

/** Copia de `datos` con un valor puesto en la ruta (crea los objetos que falten; no cambia lo que recibe) */
export function ponerRuta(datos, ruta, valor) {
  const [k, ...resto] = ruta.split(".");
  const base = datos && typeof datos === "object" && !Array.isArray(datos) ? datos : {};
  return { ...base, [k]: resto.length ? ponerRuta(base[k], resto.join("."), valor) : valor };
}

/** Valor de un campo como lo vería el juego (si no hay nada, el mínimo) */
export function valorCampo(datos, campo) {
  const x = leerRuta(datos, campo.ruta);
  const n = Number.isInteger(x) ? x : campo.min;
  return Math.max(campo.min, campo.max != null ? Math.min(campo.max, n) : n);
}

/**
 * Los datos de un juego con campos nuevos. Lo demás (historial, días, retos, adornos…) se queda.
 * @param {string} juego id del juego
 * @param {*} datos lo que hay en la nube (o null)
 * @param {Record<string, number>} cambios { ruta: valor }
 * @returns {object|null} null si no cambia nada
 */
export function conCampos(juego, datos, cambios) {
  const def = CAMPOS_JUEGO[juego];
  if (!def) throw new Error(`${juego}: no tiene campos para editar.`);
  let d = datos && typeof datos === "object" && !Array.isArray(datos) ? datos : { v: def.v };
  if (d.v == null) d = { ...d, v: def.v };
  let cambio = d !== datos;
  for (const c of def.campos) {
    if (!(c.ruta in cambios)) continue;
    const v = cambios[c.ruta];
    if (!Number.isInteger(v) || v < c.min || (c.max != null && v > c.max))
      throw new Error(`${c.nombre}: debe ser un número entero de ${c.min}${c.max != null ? ` a ${c.max}` : " o más"}.`);
    if (leerRuta(d, c.ruta) === v && (!c.sigue || leerRuta(d, c.sigue) === v)) continue;
    if (leerRuta(d, c.ruta) === undefined && v === c.min) continue; // no estaba y se queda en lo que el juego ya supone
    d = ponerRuta(d, c.ruta, v);
    if (c.sigue) d = ponerRuta(d, c.sigue, v);
    cambio = true;
  }
  return cambio ? d : null;
}

/** Resumen corto de un juego para el título de su categoría */
export function resumenJuego(juego, datos, estrellas) {
  const partes = [];
  const def = CAMPOS_JUEGO[juego];
  const hay = datos && typeof datos === "object";
  if (def && hay) for (const c of def.campos) {
    if (c.ruta.startsWith("porMoneda.") && leerRuta(datos, c.ruta) === undefined) continue; // no ha jugado con esa moneda
    partes.push(`${c.nombre} ${valorCampo(datos, c)}${c.max != null && c.min === 1 ? `/${c.max}` : ""}`);
  }
  if (hay && juego === "robot-palabras" && Array.isArray(datos.piezas)) partes.push(`${datos.piezas.length} piezas`);
  if (hay && juego === "mision-luna") partes.push(`${Object.keys(datos.rocas || {}).length} rocas, ${Object.keys(datos.fotos || {}).length} fotos`);
  if (hay && juego === "mi-casita" && Array.isArray(datos.puestos)) partes.push(`${datos.puestos.length} muebles`);
  if (hay && juego === "cajas-sorpresa") partes.push(`${Object.values(datos.tengo || {}).filter((n) => n >= 1).length} Brumitos`);
  if (estrellas) partes.push(`${"⭐".repeat(estrellas)}`);
  return partes.join(" · ") || (hay ? "Con datos" : "Sin jugar");
}

// ---------- Estrellas del catálogo y cristales del mundo ----------


/** Las estrellas de la mejor partida de un juego (lo que guarda el catálogo en "_catalogo") */
export const estrellasDe = (catalogo, juego) => {
  const e = catalogo && catalogo[juego] && catalogo[juego].estrellas;
  return Number.isInteger(e) ? Math.max(0, Math.min(3, e)) : 0;
};

/** El catálogo con otras estrellas para un juego (veces y última se quedan). null si no cambia */
export function conEstrellas(catalogo, juego, estrellas) {
  if (!Number.isInteger(estrellas) || estrellas < 0 || estrellas > 3) throw new Error("Las estrellas van de 0 a 3.");
  const c = catalogo && typeof catalogo === "object" ? catalogo : {};
  const antes = c[juego] || { estrellas: 0, veces: 0, ultima: 0 };
  if (antes.estrellas === estrellas) return null;
  return { ...c, [juego]: { veces: 0, ultima: 0, ...antes, estrellas } };
}

/** Cristales que ya encontró en el mundo ("_mundo": { v: 1, cristales: [ids] }) */
export const cristalesEncontrados = (datos) =>
  (datos && Array.isArray(datos.cristales) ? datos.cristales.filter((x) => typeof x === "string") : []);

/** El mundo con otros cristales encontrados (solo ids que existen) */
export function conCristales(datos, ids, validos) {
  const ok = new Set(validos);
  const d = datos && typeof datos === "object" ? datos : {};
  const cristales = [...new Set(ids)].filter((id) => ok.has(id));
  // v2 (#164): se junta entre aparatos; subir rev hace que lo del administrador gane (engine/islas.js → unirMundo)
  if (d.v >= 2) return { ...d, cristales, rev: (Number.isInteger(d.rev) ? d.rev : 0) + 1 };
  return { ...d, v: 1, cristales };
}

/**
 * El mundo con otras islas visitadas, conexiones construidas y estrellas del mundo (#164). Sube rev: al juntarse con
 * lo de los aparatos, gana lo del administrador (si no, la unión volvería a poner lo que se quitó).
 * @param {{ visitadas?: string[], conexiones?: string[], estrellas?: { [isla]: { [juego]: number } } }} cambios
 */
export function conIslas(datos, cambios, { islas = [], conexiones = [], tope = 5 } = {}) {
  const d = normalizarMundo(datos);
  const okI = new Set(islas), okC = new Set(conexiones);
  const out = { ...d, rev: d.rev + 1 };
  if (cambios.visitadas) out.visitadas = [...new Set(["noli", ...cambios.visitadas])].filter((id) => okI.has(id));
  if (cambios.conexiones) out.conexiones = [...new Set(cambios.conexiones)].filter((id) => okC.has(id));
  if (cambios.estrellas) {
    const dadas = JSON.parse(JSON.stringify(d.estrellas.dadas));
    for (const [isla, js] of Object.entries(cambios.estrellas)) for (const [j, n] of Object.entries(js)) {
      if (!Number.isInteger(n) || n < 0 || n > tope) throw new Error(`Las estrellas del mundo van de 0 a ${tope}.`);
      dadas[isla] = dadas[isla] || {};
      if (n) dadas[isla][j] = n; else delete dadas[isla][j];
    }
    out.estrellas = { dadas };
  }
  return out;
}

/** Sobrescribir los datos completos de un juego con un JSON escrito a mano */
export function leerJson(texto) {
  let d;
  try { d = JSON.parse(texto); } catch (e) { throw new Error("El JSON no es válido: " + e.message); }
  if (!d || typeof d !== "object" || Array.isArray(d)) throw new Error("Debe ser un objeto { … }.");
  return d;
}

// ---------- Perfiles ----------

/** Fecha y hora legible (es-MX) o "—" */
export function fecha(ms) {
  if (!ms) return "—";
  try { return new Date(ms).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }); } catch { return String(ms); }
}

/**
 * Resumen de un perfil para la lista de cuentas.
 * @param {{ perfil, creado, nombre }} p
 * @param {{ juego, datos, actualizado, dispositivo }[]} juegos
 * @param {{ desbloqueos?: object, libros?: { id: string, capitulos: number }[] }} ctx
 */
export function resumenPerfil(p, juegos, ctx = {}) {
  const por = Object.fromEntries(juegos.map((j) => [j.juego, j]));
  const ultima = juegos.reduce((m, j) => Math.max(m, j.actualizado || 0), 0);
  const dispositivos = [...new Set(juegos.map((j) => j.dispositivo).filter((d) => d && d !== DISPOSITIVO_ADMIN))];
  const libros = (ctx.libros || []).map((l) => ({ id: l.id, leidos: libroDe(por.biblioteca && por.biblioteca.datos, l.id).leidos.length, capitulos: l.capitulos }));
  return {
    perfil: p.perfil, nombre: p.nombre || "", creado: p.creado || 0, ultima, dispositivos,
    creditos: por._creditos ? saldoDe(por._creditos.datos) : 0,
    pasarela: por.pasarela ? resumenPasarela(por.pasarela.datos, ctx.desbloqueos) : null,
    libros, juegos: juegos.length,
  };
}
