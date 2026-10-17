// Página de administrador (admin.html): ver los perfiles de la nube y sobrescribir créditos, Pasarela y libros.
// Lógica pura: arma los datos nuevos de cada juego a partir de lo que hay en la nube. La red la hace src/admin/main.js.
// Ver DESIGN.md §7 → "Administrador".
import { leerLibro, saldo, agregar } from "./creditos.js";

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
