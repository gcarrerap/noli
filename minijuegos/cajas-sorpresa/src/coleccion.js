// Colección, polvo de estrellas, garantías y límite del día.
// Funciones puras: el azar entra por `rng` y el reloj por `fecha`.
import { RAREZAS, LIMITE_MIN, LIMITE_MAX, HISTORIAL_MAX } from "./reglas.js";

const ORDEN = { ultra: 3, rara: 2, comun: 1 };

let reglasActivas = null;

/** Las reglas llegan del JSON. Las pruebas y el juego las instalan antes de jugar. */
export function usarReglas(config) {
  reglasActivas = config;
  return reglasActivas;
}

function cfg(config) {
  const c = config || reglasActivas;
  if (!c) throw new Error("faltan las reglas");
  return c;
}

export function estadoNuevo(config) {
  const reglas = cfg(config);
  return {
    v: 1,
    tenidas: [],
    polvo: 0,
    desdeRara: 0,
    desdeUltra: 0,
    cajas: 0,
    dia: "",
    hoy: 0,
    limite: reglas.limiteDiario,
    cerrada: false,
    historial: [],
    guiaHecha: false,
    voz: true,
    semilla: null,
    meta: "",
    pendiente: null,
    puertaHasta: 0,
    puertaFallos: 0,
    puertaNivel: 0,
  };
}

function listaIds(v) {
  if (!Array.isArray(v)) return [];
  const ids = [];
  for (const x of v) if (typeof x === "string" && x && !ids.includes(x)) ids.push(x);
  return ids.sort();
}

function pendienteDe(p) {
  if (!p || typeof p !== "object") return null;
  if (typeof p.id !== "string" || !p.id) return null;
  return {
    id: p.id,
    duplicado: p.duplicado === true,
    polvoGanado: entero(p.polvoGanado, 0),
    familiaNueva: typeof p.familiaNueva === "string" && p.familiaNueva ? p.familiaNueva : null,
  };
}

export function cargar(datos, config) {
  const base = estadoNuevo(config);
  if (!datos || typeof datos !== "object") return base;
  const limite = Number.isInteger(datos.limite) ? datos.limite : base.limite;
  return {
    ...base,
    tenidas: listaIds(datos.tenidas),
    polvo: entero(datos.polvo, 0),
    desdeRara: entero(datos.desdeRara, 0),
    desdeUltra: entero(datos.desdeUltra, 0),
    cajas: entero(datos.cajas, 0),
    dia: typeof datos.dia === "string" ? datos.dia : "",
    hoy: entero(datos.hoy, 0),
    limite: Math.min(LIMITE_MAX, Math.max(LIMITE_MIN, limite)),
    cerrada: datos.cerrada === true,
    historial: historialDe(datos.historial),
    guiaHecha: datos.guiaHecha === true,
    voz: datos.voz !== false,
    semilla: Number.isInteger(datos.semilla) ? datos.semilla : null,
    meta: typeof datos.meta === "string" ? datos.meta : "",
    pendiente: pendienteDe(datos.pendiente),
    puertaHasta: marcaTiempo(datos.puertaHasta),
    puertaFallos: entero(datos.puertaFallos, 0),
    puertaNivel: entero(datos.puertaNivel, 0),
  };
}

function entero(n, fallo) {
  return Number.isInteger(n) && n >= 0 ? n : fallo;
}

/** Una marca de tiempo guardada. Nunca se recorta a 32 bits. */
function marcaTiempo(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return 0;
  return x;
}

function historialDe(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const m of v) {
    if (!m || typeof m !== "object") continue;
    if (typeof m.id !== "string" || !RAREZAS.includes(m.rareza)) continue;
    out.push({
      dia: typeof m.dia === "string" ? m.dia : "",
      id: m.id,
      rareza: m.rareza,
      nueva: m.nueva === true,
      polvo: entero(m.polvo, 0),
    });
  }
  return out.slice(-HISTORIAL_MAX);
}

/**
 * Frascos ya abiertos en el día que se pregunta.
 * Si hoy es anterior al día guardado, la cuenta sigue (mover el reloj no regala
 * frascos). Ese día futuro hay que bajarlo con `alinearDia` al cargar: si no,
 * la tienda se queda cerrada hasta esa fecha.
 * Un día posterior de verdad reinicia la cuenta.
 */
export function abiertasHoy(estado, fecha) {
  if (!estado || !estado.dia) return 0;
  return fecha <= estado.dia ? estado.hoy : 0;
}

/**
 * Al cargar: si hoy es anterior al día guardado, ese día era un reloj adelantado
 * (o se atrasó). Se guarda hoy y se conserva la cuenta. Un día de verdad nuevo
 * no se toca aquí: la cuenta se reinicia al abrir.
 */
export function alinearDia(estado, fecha) {
  if (!estado || typeof fecha !== "string" || !fecha) return estado;
  if (estado.dia && fecha < estado.dia) return { ...estado, dia: fecha };
  return estado;
}

export function cuentaRara(estado, config) {
  return Math.max(1, cfg(config).garantiaRara - estado.desdeRara);
}

export function cuentaUltra(estado, config) {
  return Math.max(1, cfg(config).garantiaUltra - estado.desdeUltra);
}

/** «cerrada» y «limite» se dicen igual: la tienda descansa. */
export function puedeAbrir(estado, { creditos, fecha, config, piezas = null } = {}) {
  config = cfg(config);
  if (estado.cerrada) return { ok: false, razon: "cerrada" };
  if (abiertasHoy(estado, fecha) >= estado.limite) return { ok: false, razon: "limite" };
  if (piezas && estado.tenidas.length >= piezas.length) return { ok: false, razon: "completa" };
  if (!(Number.isInteger(creditos) && creditos >= config.costoCaja)) return { ok: false, razon: "creditos" };
  return { ok: true, costo: config.costoCaja };
}

export function sortearRareza(rng, config) {
  config = cfg(config);
  const { comun, rara, ultra } = config.pesos;
  const total = comun + rara + ultra;
  let t = rng() * total;
  if (t < comun) return "comun";
  t -= comun;
  if (t < rara) return "rara";
  return ultra > 0 ? "ultra" : "rara";
}

function poolDe(rareza, estado, piezas, config) {
  const primeras = estado.cajas < config.sinRepetir;
  let pool = piezas.filter((p) => p.rareza === rareza);
  if (primeras) {
    const nuevas = pool.filter((p) => !estado.tenidas.includes(p.id));
    pool = nuevas.length ? nuevas : piezas.filter((p) => !estado.tenidas.includes(p.id));
  }
  if (!pool.length) pool = piezas.slice();
  return pool;
}

/**
 * Abre una caja. No mira créditos ni el límite: eso lo decide `puedeAbrir`
 * antes de cobrar. `rarezaForzada` solo la usa la captura de pantalla.
 */
export function abrirCaja(estado, { rng, piezas, fecha, config, registrar = true, rarezaForzada = null } = {}) {
  config = cfg(config);
  let rareza = rarezaForzada;
  if (!RAREZAS.includes(rareza)) {
    const tocaUltra = estado.desdeUltra + 1 >= config.garantiaUltra;
    const tocaRara = estado.desdeRara + 1 >= config.garantiaRara;
    if (tocaUltra) rareza = "ultra";
    else if (tocaRara) rareza = "rara";
    else rareza = sortearRareza(rng, config);
  }
  const pool = poolDe(rareza, estado, piezas, config);
  let indice = Math.floor(rng() * pool.length);
  if (!Number.isFinite(indice) || indice < 0) indice = 0;
  if (indice >= pool.length) indice = pool.length - 1;
  const pieza = pool[indice];
  const duplicado = estado.tenidas.includes(pieza.id);
  const polvoGanado = duplicado ? config.polvoDuplicado[pieza.rareza] || 0 : 0;
  let desdeRara = estado.desdeRara;
  let desdeUltra = estado.desdeUltra;
  if (pieza.rareza === "ultra") { desdeUltra = 0; desdeRara = 0; }
  else if (pieza.rareza === "rara") { desdeRara = 0; desdeUltra += 1; }
  else { desdeRara += 1; desdeUltra += 1; }
  const sigue = !!(estado.dia && fecha <= estado.dia);
  const dia = sigue && fecha < estado.dia ? fecha : (sigue ? estado.dia : fecha);
  const hoy = (sigue ? estado.hoy : 0) + 1;
  const mov = { dia, id: pieza.id, rareza: pieza.rareza, nueva: !duplicado, polvo: polvoGanado };
  const historial = registrar ? [...estado.historial, mov].slice(-HISTORIAL_MAX) : estado.historial;
  return {
    pieza,
    duplicado,
    polvoGanado,
    estado: {
      ...estado,
      tenidas: duplicado ? estado.tenidas : [...estado.tenidas, pieza.id].sort(),
      polvo: estado.polvo + polvoGanado,
      desdeRara,
      desdeUltra,
      cajas: estado.cajas + 1,
      dia,
      hoy,
      historial,
      meta: !duplicado && estado.meta === pieza.id ? "" : estado.meta,
    },
  };
}

export function ponerMeta(estado, id) {
  if (typeof id !== "string" || !id) return estado;
  if (estado.tenidas.includes(id)) return estado;
  return { ...estado, meta: id };
}

export function comprar(estado, id, piezas, config) {
  config = cfg(config);
  const pieza = (piezas || []).find((p) => p.id === id);
  if (!pieza) return { ok: false, razon: "no-existe", estado };
  if (estado.tenidas.includes(pieza.id)) return { ok: false, razon: "ya-la-tiene", estado };
  const precio = config.polvoPrecio[pieza.rareza];
  if (!Number.isInteger(precio) || estado.polvo < precio) return { ok: false, razon: "polvo", estado, precio };
  return {
    ok: true,
    precio,
    pieza,
    estado: {
      ...estado,
      polvo: estado.polvo - precio,
      tenidas: [...estado.tenidas, pieza.id].sort(),
      meta: estado.meta === pieza.id ? "" : estado.meta,
    },
  };
}

/** Compra la que falta de mayor rareza, en cuanto el polvo alcanza. */
export function comprarMayorPosible(estado, piezas, config) {
  config = cfg(config);
  const faltan = piezas
    .filter((p) => !estado.tenidas.includes(p.id))
    .sort((a, b) => (ORDEN[b.rareza] - ORDEN[a.rareza]) || (a.id < b.id ? -1 : 1));
  for (const p of faltan) {
    const r = comprar(estado, p.id, piezas, config);
    if (r.ok) return r.estado;
  }
  return estado;
}

/**
 * Cajas hasta completar la colección. Después de cada caja gasta el polvo
 * en la pieza que falta de mayor rareza. Ignora el límite del día y los créditos:
 * aquí se cuentan cajas, no días.
 */
export function simularColeccion(rng, piezas, config) {
  config = cfg(config);
  let estado = estadoNuevo(config);
  let guard = 0;
  while (estado.tenidas.length < piezas.length && guard < 400) {
    guard += 1;
    const r = abrirCaja(estado, { rng, piezas, fecha: "sim", config, registrar: false });
    estado = r.estado;
    let sig = comprarMayorPosible(estado, piezas, config);
    while (sig !== estado) {
      estado = sig;
      sig = comprarMayorPosible(estado, piezas, config);
    }
  }
  return estado.cajas;
}

export function resumirCajas(muestras) {
  const a = [...muestras].sort((x, y) => x - y);
  const en = (p) => a[Math.min(a.length - 1, Math.max(0, Math.ceil(p * a.length) - 1))];
  return { mediana: en(0.5), p90: en(0.9), peor: a[a.length - 1], n: a.length };
}

export function cambiarLimite(estado, delta) {
  const limite = Math.min(LIMITE_MAX, Math.max(LIMITE_MIN, estado.limite + delta));
  return { ...estado, limite };
}

export function ponerCerrada(estado, cerrada) {
  return { ...estado, cerrada: !!cerrada };
}

export function ponerVoz(estado, voz) {
  return { ...estado, voz: !!voz };
}

export function marcarGuia(estado) {
  return estado.guiaHecha ? estado : { ...estado, guiaHecha: true };
}

/** Cobra con `gastar` solo si la tienda deja abrir. Si no alcanza, el estado no cambia. */
export async function abrirConCreditos(estado, opts) {
  const config = cfg(opts.config);
  const p = puedeAbrir(estado, {
    creditos: opts.creditos, fecha: opts.fecha, config, piezas: opts.piezas,
  });
  if (!p.ok) return { ok: false, razon: p.razon, estado, creditos: opts.creditos };
  const r = abrirCaja(estado, { ...opts, config });
  const estimado = typeof opts.creditos === "number" ? opts.creditos - p.costo : opts.creditos;
  let estadoListo = r.estado;
  if (typeof opts.alCobrar === "function") {
    const extra = opts.alCobrar({ ...r, creditos: estimado, costo: p.costo });
    if (extra) estadoListo = extra;
  }
  const cobro = await opts.gastar(p.costo);
  if (!cobro || cobro.ok !== true) {
    if (typeof opts.alFallar === "function") opts.alFallar(estado);
    const creditos = cobro && typeof cobro.saldo === "number" ? cobro.saldo : opts.creditos;
    return { ok: false, razon: "creditos", estado, creditos };
  }
  const creditos = typeof cobro.saldo === "number" ? cobro.saldo : estimado;
  return { ok: true, ...r, estado: estadoListo, creditos, costo: p.costo };
}

/** Día local AAAA-MM-DD. El reloj entra entero: nunca se recorta a 32 bits. */
export function fechaLocal(d = new Date()) {
  const t = d instanceof Date ? d : new Date(Number(d) || 0);
  const m = String(t.getMonth() + 1).padStart(2, "0");
  const dia = String(t.getDate()).padStart(2, "0");
  return `${t.getFullYear()}-${m}-${dia}`;
}
