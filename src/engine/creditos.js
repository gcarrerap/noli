// Créditos de Noli (#20): se ganan en los juegos educativos y se gastan en juegos como la Pasarela (#19).
// Lógica pura: no lee localStorage ni la red (eso lo hacen app/creditos.js y app/sync.js). Ver DESIGN.md §12.
//
// El saldo NO se guarda como un número, sino como un **libro de movimientos**. Así dos dispositivos que ganan
// y gastan sin conexión no se pisan: al sincronizar se juntan los movimientos de los dos (unión por id).
//
//   libro = {
//     v: 1,
//     movs:    [{ id, f, n, j, m, d }],   // f: fecha (ms), n: cantidad (+ gana, − gasta), j: juego (o ""),
//                                         // m: motivo (ver MOTIVOS), d: dispositivo que lo creó
//     cierres: { [d]: { hasta, suma } },  // movimientos viejos del dispositivo d ya sumados (ver compactar)
//   }
//   saldo = Σ cierres.suma + Σ movs.n

/**
 * Reglas de los créditos. Es el único lugar donde se cambian (el costo de la Pasarela vive en el juego:
 * minijuegos/pasarela/datos/config.json).
 * @type {{ porEstrella: number, porReto: number, topeDiario: number, diasCompactar: number, maxGasto: number, maxRegalo: number }}
 */
export const REGLAS = Object.freeze({
  porEstrella: 1,   // créditos por cada estrella de una partida (0 a 3)
  porReto: 2,       // extra por completar el reto del día (una vez por juego y por día)
  topeDiario: 15,   // máximo de créditos que un juego da en un día (estrellas + reto); la partida sigue contando
  diasCompactar: 60,// los movimientos propios más viejos que esto se suman en un "cierre" para que el libro no crezca
  maxGasto: 100,    // lo más que un juego puede pedir en un solo gasto
  maxRegalo: 100,   // lo más que papá o mamá pueden regalar o quitar de una vez
});

/** Motivos de un movimiento, con el texto que se ve en el historial. */
export const MOTIVOS = Object.freeze({
  estrellas: "Estrellas",
  reto: "Reto del día",
  gasto: "Gastado",
  regalo: "Regalo de papás",
  ajuste: "Ajuste de papás",
});

/** Valores válidos de "creditos" en juego.json: el juego da créditos, los gasta, o ninguno (null). */
export const TIPOS_CREDITOS = ["gana", "gasta"];

/** @returns {{v:1, movs:Array, cierres:Object}} un libro vacío */
export const libroVacio = () => ({ v: 1, movs: [], cierres: {} });

/**
 * Normaliza lo que venga de localStorage o de la nube: si no es un libro válido devuelve uno vacío, y descarta
 * movimientos mal formados en lugar de tronar.
 * @param {*} x
 * @returns {{v:1, movs:Array, cierres:Object}}
 */
export function leerLibro(x) {
  if (!x || typeof x !== "object" || !Array.isArray(x.movs)) return libroVacio();
  const movs = x.movs.filter((m) => m && typeof m.id === "string" && Number.isFinite(m.f) && Number.isInteger(m.n) && typeof m.d === "string");
  const cierres = {};
  for (const [d, c] of Object.entries(x.cierres || {})) if (c && Number.isFinite(c.hasta) && Number.isInteger(c.suma)) cierres[d] = { hasta: c.hasta, suma: c.suma };
  return { v: 1, movs, cierres };
}

/**
 * Saldo real (puede ser negativo si dos dispositivos gastaron lo mismo sin conexión; ver saldoVisible).
 * @param {{movs:Array, cierres:Object}} libro
 * @returns {number}
 */
export function saldo(libro) {
  let s = 0;
  for (const c of Object.values(libro.cierres)) s += c.suma;
  for (const m of libro.movs) s += m.n;
  return s;
}

/** El saldo que ve Noelia: nunca menos de 0. Lo negativo se cubre con lo siguiente que gane. */
export const saldoVisible = (libro) => Math.max(0, saldo(libro));

/**
 * Día local (AAAA-MM-DD) de una fecha en ms. El tope diario y el reto se cuentan por día del reloj del aparato.
 * @param {number} ms
 * @returns {string}
 */
export function dia(ms) {
  const d = new Date(ms);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

/**
 * Lo que un juego ya dio hoy: total de créditos (estrellas + reto) y si ya se dio el bono del reto.
 * Cuenta los movimientos de todos los dispositivos que ya estén en el libro.
 * @param {{movs:Array}} libro
 * @param {string} juego
 * @param {number} ahora ms
 * @returns {{ total: number, reto: boolean }}
 */
export function ganadoHoy(libro, juego, ahora) {
  const hoy = dia(ahora);
  let total = 0, reto = false;
  for (const m of libro.movs) {
    if (m.j !== juego || m.n <= 0 || (m.m !== "estrellas" && m.m !== "reto") || dia(m.f) !== hoy) continue;
    total += m.n;
    if (m.m === "reto") reto = true;
  }
  return { total, reto };
}

/**
 * Cuántos créditos da una partida terminada, respetando el tope diario y el reto una vez al día.
 * Primero se cuentan las estrellas y después el reto; lo que pase del tope se recorta.
 * @param {{movs:Array}} libro
 * @param {{ juego: string, estrellas: number, reto?: boolean, ahora: number }} partida
 * @param {typeof REGLAS} [reglas]
 * @returns {{ estrellas: number, reto: number, total: number, topado: boolean }}
 */
export function ganancia(libro, { juego, estrellas, reto = false, ahora }, reglas = REGLAS) {
  const hoy = ganadoHoy(libro, juego, ahora);
  let queda = Math.max(0, reglas.topeDiario - hoy.total);
  const pedirE = Math.max(0, Math.min(3, Math.round(Number(estrellas) || 0))) * reglas.porEstrella;
  const e = Math.min(pedirE, queda); queda -= e;
  const pedirR = reto && !hoy.reto ? reglas.porReto : 0;
  const r = Math.min(pedirR, queda);
  return { estrellas: e, reto: r, total: e + r, topado: e + r < pedirE + pedirR };
}

let cuenta = 0;
/**
 * Id único de un movimiento: dispositivo + fecha + contador + azar. Dos dispositivos nunca generan el mismo.
 * @param {string} d dispositivo
 * @param {number} f fecha (ms)
 * @param {() => number} [rnd]
 */
export function idMov(d, f, rnd = Math.random) {
  cuenta = (cuenta + 1) % 1e6;
  return d + "-" + f.toString(36) + "-" + cuenta.toString(36) + rnd().toString(36).slice(2, 6);
}

/**
 * Agrega un movimiento (devuelve un libro nuevo; no cambia el que recibe).
 * @param {{v:1, movs:Array, cierres:Object}} libro
 * @param {{ n: number, j?: string, m: string, d: string, f: number, id?: string }} mov
 */
export function agregar(libro, { n, j = "", m, d, f, id }) {
  if (!Number.isInteger(n) || n === 0) return libro;
  if (!MOTIVOS[m]) throw new Error("motivo desconocido: " + m);
  return { ...libro, movs: [...libro.movs, { id: id || idMov(d, f), f, n, j, m, d }] };
}

/**
 * Intenta gastar. Solo se puede gastar lo que hay (saldo real ≥ cantidad).
 * @param {{v:1, movs:Array, cierres:Object}} libro
 * @param {{ cantidad: number, juego: string, d: string, f: number }} gasto
 * @param {typeof REGLAS} [reglas]
 * @returns {{ ok: boolean, libro: object, saldo: number, motivo?: string }}
 */
export function gastar(libro, { cantidad, juego, d, f }, reglas = REGLAS) {
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > reglas.maxGasto) return { ok: false, libro, saldo: saldoVisible(libro), motivo: "cantidad" };
  if (saldo(libro) < cantidad) return { ok: false, libro, saldo: saldoVisible(libro), motivo: "no-alcanza" };
  const nuevo = agregar(libro, { n: -cantidad, j: juego, m: "gasto", d, f });
  return { ok: true, libro: nuevo, saldo: saldoVisible(nuevo) };
}

/**
 * Junta dos libros (el de este dispositivo y el de la nube). Conmutativa e idempotente: unir(a, b) = unir(b, a)
 * y unir(a, a) = a. Nunca pierde un movimiento:
 *  - cierres: por dispositivo gana el que llega más lejos (`hasta` mayor); solo ese dispositivo escribe su cierre;
 *  - movimientos: unión por id, quitando los que ya están sumados en el cierre de su dispositivo (f ≤ hasta).
 * @returns {{v:1, movs:Array, cierres:Object}}
 */
export function unir(a, b) {
  const cierres = { ...a.cierres };
  for (const [d, c] of Object.entries(b.cierres)) if (!cierres[d] || c.hasta > cierres[d].hasta) cierres[d] = c;
  const porId = new Map();
  for (const m of [...a.movs, ...b.movs]) {
    const c = cierres[m.d];
    if (c && m.f <= c.hasta) continue;
    if (!porId.has(m.id)) porId.set(m.id, m);
  }
  const movs = [...porId.values()].sort((x, y) => x.f - y.f || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  return { v: 1, movs, cierres };
}

/**
 * ¿Tienen los dos libros exactamente lo mismo? (para saber si hay que subir lo juntado)
 */
export function iguales(a, b) {
  if (a.movs.length !== b.movs.length) return false;
  const ids = new Set(a.movs.map((m) => m.id));
  if (!b.movs.every((m) => ids.has(m.id))) return false;
  const da = Object.keys(a.cierres), db = Object.keys(b.cierres);
  if (da.length !== db.length) return false;
  return da.every((d) => b.cierres[d] && b.cierres[d].hasta === a.cierres[d].hasta && b.cierres[d].suma === a.cierres[d].suma);
}

/**
 * Suma en el cierre de ESTE dispositivo sus movimientos de hace más de `diasCompactar` días, para que el libro no
 * crezca para siempre (un documento de Firestore tiene límite). Solo compacta los propios: así ningún otro
 * dispositivo escribe ese cierre y unir() sigue siendo correcto.
 * @param {{v:1, movs:Array, cierres:Object}} libro
 * @param {string} d dispositivo
 * @param {number} ahora ms
 * @param {typeof REGLAS} [reglas]
 */
export function compactar(libro, d, ahora, reglas = REGLAS) {
  const limite = ahora - reglas.diasCompactar * 86400000;
  const viejos = libro.movs.filter((m) => m.d === d && m.f <= limite);
  if (!viejos.length) return libro;
  const previo = libro.cierres[d] || { hasta: 0, suma: 0 };
  const hasta = Math.max(previo.hasta, ...viejos.map((m) => m.f));
  const suma = previo.suma + viejos.reduce((s, m) => s + m.n, 0);
  return { v: 1, movs: libro.movs.filter((m) => !(m.d === d && m.f <= hasta)), cierres: { ...libro.cierres, [d]: { hasta, suma } } };
}

/**
 * Los últimos movimientos para el historial de papás (más nuevos primero).
 * @param {{movs:Array}} libro
 * @param {number} [n]
 */
export const historial = (libro, n = 30) => libro.movs.slice(-n).reverse();
