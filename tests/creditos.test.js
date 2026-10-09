// Pruebas de los créditos (#20): la lógica pura del libro (saldo, tope diario, reto una vez al día, gastar, unir,
// compactar), el protocolo y el kit, las acciones del catálogo y la sincronización entre dos dispositivos que
// ganan y gastan sin conexión (Firebase de mentira).
import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeFirestore } from "./fakes/firebase.js";

let almacen = new Map();
globalThis.localStorage = { getItem: (k) => (almacen.has(k) ? almacen.get(k) : null), setItem: (k, v) => almacen.set(k, String(v)) };
globalThis.window = globalThis;

const C = await import("../src/engine/creditos.js");
const { validarManifiesto } = await import("../src/engine/index.js");
const { esMensaje, mensaje } = await import("../kit/protocolo.js");
const { state, actions, saldoActual } = await import("../src/app/index.js");
const sync = await import("../src/app/sync.js");
const { leerJuegos } = await import("../src/services/index.js");

const DIA = 86400000;
const HOY = new Date(2026, 9, 8, 15, 0).getTime(); // 8 de octubre de 2026, 3 pm (hora local)
const libroCon = (...movs) => movs.reduce((l, m) => C.agregar(l, { d: "a", f: HOY, ...m }), C.libroVacio());

// ---------- Lógica pura ----------

test("saldo: suma movimientos y cierres; lo visible nunca es negativo", () => {
  const l = libroCon({ n: 5, j: "sumas", m: "estrellas" }, { n: -3, j: "pasarela", m: "gasto" });
  assert.equal(C.saldo(l), 2);
  const conCierre = { ...l, cierres: { b: { hasta: HOY - 100 * DIA, suma: 10 } } };
  assert.equal(C.saldo(conCierre), 12);
  const negativo = libroCon({ n: -4, m: "ajuste" });
  assert.equal(C.saldo(negativo), -4);
  assert.equal(C.saldoVisible(negativo), 0);
});

test("ganancia: 1 por estrella, +2 por el reto una vez al día, tope de 15 por juego al día", () => {
  let l = C.libroVacio();
  const g1 = C.ganancia(l, { juego: "sumas", estrellas: 3, reto: true, ahora: HOY });
  assert.deepEqual(g1, { estrellas: 3, reto: 2, total: 5, topado: false });
  l = libroCon({ n: 3, j: "sumas", m: "estrellas" }, { n: 2, j: "sumas", m: "reto" });
  // El reto ya se cobró hoy: solo estrellas
  assert.deepEqual(C.ganancia(l, { juego: "sumas", estrellas: 2, reto: true, ahora: HOY + 1000 }), { estrellas: 2, reto: 0, total: 2, topado: false });
  // Mañana el reto vuelve a contar
  assert.equal(C.ganancia(l, { juego: "sumas", estrellas: 0, reto: true, ahora: HOY + DIA }).reto, 2);
  // Otro juego tiene su propio tope
  assert.equal(C.ganancia(l, { juego: "spelling", estrellas: 3, ahora: HOY }).total, 3);
  // Llegando al tope: se recorta y avisa
  const casi = libroCon({ n: 14, j: "sumas", m: "estrellas" });
  assert.deepEqual(C.ganancia(casi, { juego: "sumas", estrellas: 3, ahora: HOY }), { estrellas: 1, reto: 0, total: 1, topado: true });
  const lleno = libroCon({ n: 15, j: "sumas", m: "estrellas" });
  assert.deepEqual(C.ganancia(lleno, { juego: "sumas", estrellas: 3, reto: true, ahora: HOY }), { estrellas: 0, reto: 0, total: 0, topado: true });
  // Estrellas fuera de rango se acomodan
  assert.equal(C.ganancia(C.libroVacio(), { juego: "x", estrellas: 9, ahora: HOY }).total, 3);
  assert.equal(C.ganancia(C.libroVacio(), { juego: "x", estrellas: -2, ahora: HOY }).total, 0);
});

test("ganadoHoy: no cuenta gastos, regalos ni otros días", () => {
  const l = libroCon({ n: 4, j: "sumas", m: "estrellas" }, { n: 5, m: "regalo" }, { n: -3, j: "sumas", m: "gasto" },
    { n: 6, j: "sumas", m: "estrellas", f: HOY - DIA });
  assert.deepEqual(C.ganadoHoy(l, "sumas", HOY), { total: 4, reto: false });
});

test("gastar: alcanza, no alcanza, cantidades inválidas", () => {
  const l = libroCon({ n: 5, j: "sumas", m: "estrellas" });
  const r = C.gastar(l, { cantidad: 3, juego: "pasarela", d: "a", f: HOY });
  assert.equal(r.ok, true); assert.equal(r.saldo, 2);
  assert.equal(r.libro.movs.at(-1).n, -3);
  assert.equal(C.saldo(l), 5, "no cambia el libro original");
  const no = C.gastar(r.libro, { cantidad: 3, juego: "pasarela", d: "a", f: HOY });
  assert.deepEqual([no.ok, no.motivo, no.saldo], [false, "no-alcanza", 2]);
  for (const cantidad of [0, -1, 1.5, 101, "3"]) assert.equal(C.gastar(l, { cantidad, juego: "p", d: "a", f: HOY }).ok, false, String(cantidad));
});

test("unir: unión por id, conmutativa, idempotente y sin perder nada", () => {
  const base = libroCon({ n: 5, j: "sumas", m: "estrellas", id: "x1" });
  const a = C.agregar(base, { n: -3, j: "pasarela", m: "gasto", d: "a", f: HOY + 10, id: "a1" });
  const b = C.agregar(base, { n: 2, j: "spelling", m: "estrellas", d: "b", f: HOY + 5, id: "b1" });
  const ab = C.unir(a, b), ba = C.unir(b, a);
  assert.deepEqual(ab, ba);
  assert.deepEqual(ab.movs.map((m) => m.id), ["x1", "b1", "a1"]);
  assert.equal(C.saldo(ab), 4);
  assert.ok(C.iguales(C.unir(ab, ab), ab));
  assert.ok(C.iguales(C.unir(ab, a), ab));
  assert.equal(C.iguales(ab, a), false);
});

test("compactar: suma los movimientos propios viejos en un cierre; unir los respeta", () => {
  let l = C.libroVacio();
  l = C.agregar(l, { n: 3, j: "sumas", m: "estrellas", d: "a", f: HOY - 90 * DIA, id: "viejo-a" });
  l = C.agregar(l, { n: 4, j: "sumas", m: "estrellas", d: "b", f: HOY - 90 * DIA, id: "viejo-b" });
  l = C.agregar(l, { n: 2, j: "sumas", m: "estrellas", d: "a", f: HOY, id: "nuevo-a" });
  const c = C.compactar(l, "a", HOY);
  assert.equal(C.saldo(c), C.saldo(l));
  assert.deepEqual(c.movs.map((m) => m.id), ["viejo-b", "nuevo-a"], "solo compacta los suyos");
  assert.deepEqual(c.cierres.a, { hasta: HOY - 90 * DIA, suma: 3 });
  // Otro dispositivo todavía tiene el movimiento viejo de "a": al juntar no se cuenta dos veces
  const junto = C.unir(c, l);
  assert.equal(C.saldo(junto), 9);
  assert.ok(C.iguales(junto, c));
  assert.equal(C.compactar(c, "a", HOY), c, "nada que compactar: el mismo libro");
});

test("leerLibro: tolera basura", () => {
  assert.deepEqual(C.leerLibro(null), C.libroVacio());
  assert.deepEqual(C.leerLibro({ movs: "x" }), C.libroVacio());
  const l = C.leerLibro({ movs: [{ id: "a", f: 1, n: 2, d: "x", m: "estrellas" }, { id: 3 }, null], cierres: { x: { hasta: 1, suma: 2 }, y: "mal" } });
  assert.equal(l.movs.length, 1);
  assert.deepEqual(Object.keys(l.cierres), ["x"]);
});

// ---------- Manifiesto y protocolo ----------

test("manifiesto: creditos y costo", () => {
  assert.equal(validarManifiesto({ id: "a", titulo: "x", creditos: "gana" }, "a").juego.creditos, "gana");
  assert.equal(validarManifiesto({ id: "a", titulo: "x", creditos: "gasta", costo: 3 }, "a").juego.costo, 3);
  assert.ok(validarManifiesto({ id: "a", titulo: "x", creditos: "regala" }, "a").errores);
  assert.ok(validarManifiesto({ id: "a", titulo: "x", creditos: "gasta", costo: 0 }, "a").errores);
  assert.ok(validarManifiesto({ id: "a", titulo: "x", creditos: "gana", costo: 3 }, "a").errores);
});

test("protocolo: gastar y gasto", () => {
  assert.ok(esMensaje(mensaje("gastar", { id: "g1", cantidad: 3, motivo: "pasarela" })));
  assert.equal(esMensaje(mensaje("gastar", { id: "g1", cantidad: 0 })), false);
  assert.equal(esMensaje(mensaje("gastar", { id: "", cantidad: 3 })), false);
  assert.equal(esMensaje(mensaje("gastar", { id: "g1", cantidad: "3" })), false);
  assert.ok(esMensaje(mensaje("gasto", { id: "g1", ok: true, saldo: 2 })));
  assert.equal(esMensaje(mensaje("gasto", { id: "g1" })), false);
});

// ---------- Acciones del catálogo ----------

let reloj = HOY;
const fs = fakeFirestore();
sync._configurar({ obtenerFs: async () => fs, espera: 0, ahora: () => reloj });
const pausa = (ms = 5) => new Promise((r) => setTimeout(r, ms));
const JUEGOS = [{ id: "sumas-restas", titulo: "Sumas", creditos: "gana" }, { id: "pasarela", titulo: "Pasarela", creditos: "gasta", costo: 3 },
  { id: "ejemplo", titulo: "Ejemplo", creditos: null }];

function dispositivo(mapa) {
  almacen = mapa;
  sync._reiniciar();
  state.progreso = JSON.parse(mapa.get("noli.progreso") || "{}");
  state.creditos = C.leerLibro(JSON.parse(mapa.get("noli.creditos") || "null"));
  state.juegos = JUEGOS;
}

const telefono = new Map(), tv = new Map();

test("acciones: un juego educativo da créditos al terminar; uno sin créditos no", () => {
  dispositivo(telefono);
  actions.terminar("sumas-restas", 3);
  assert.equal(saldoActual(), 3);
  assert.equal(state.celebrar.creditos, 3);
  actions.terminar("sumas-restas", 2, true);
  assert.equal(saldoActual(), 7, "2 estrellas + 2 del reto");
  actions.terminar("ejemplo", 3);
  assert.equal(saldoActual(), 7);
  assert.equal(state.celebrar.creditos, 0);
  assert.equal(C.leerLibro(JSON.parse(telefono.get("noli.creditos"))).movs.length, 3, "se guarda en el dispositivo");
});

test("acciones: el tope diario avisa en la celebración", () => {
  for (let i = 0; i < 4; i++) actions.terminar("sumas-restas", 3);
  assert.equal(C.ganadoHoy(state.creditos, "sumas-restas", reloj).total, 15);
  assert.equal(state.celebrar.topado, true);
  actions.terminar("sumas-restas", 3);
  assert.equal(state.celebrar.creditos, 0);
  assert.equal(saldoActual(), 15);
});

test("acciones: gastar solo desde un juego que gasta, y solo si alcanza", () => {
  assert.deepEqual(actions.gastar("ejemplo", 3), { ok: false, saldo: 15 });
  assert.deepEqual(actions.gastar("sumas-restas", 3), { ok: false, saldo: 15 });
  assert.deepEqual(actions.gastar("pasarela", 3), { ok: true, saldo: 12 });
  assert.deepEqual(actions.gastar("pasarela", 20), { ok: false, saldo: 12 });
});

test("acciones: papás regalan y quitan; queda en el historial", () => {
  actions.regalarCreditos(5);
  actions.regalarCreditos(-2);
  assert.equal(saldoActual(), 15);
  const h = C.historial(state.creditos, 2);
  assert.deepEqual(h.map((m) => [m.m, m.n]), [["ajuste", -2], ["regalo", 5]]);
});

// ---------- Nube: juntar, no pisar ----------

test("nube: dos dispositivos ganan y gastan sin conexión y al sincronizar no se pierde nada", async () => {
  // El teléfono activa la nube con lo que ya tenía (saldo 15)
  dispositivo(telefono);
  await actions.activarNube();
  const perfil = state.nube.perfil;
  const enNube = async () => C.leerLibro((await leerJuegos(fs, perfil)).find((j) => j.juego === sync.CREDITOS).datos);
  assert.equal(C.saldo(await enNube()), 15);

  // La TV se vincula (mismo perfil) y recibe el saldo
  dispositivo(tv);
  tv.set("noli.nube.perfil", perfil); sync._reiniciar(); state.creditos = C.libroVacio();
  await sync.conectar();
  assert.equal(saldoActual(), 15);
  assert.notEqual(sync.dispositivo, JSON.parse(JSON.stringify(telefono.get("noli.dev"))), "cada uno su id");

  // Se va el internet. La TV gana 3 y gasta 3; el teléfono gana 2 y gasta 3.
  fs.offline = true;
  reloj += 60000; actions.terminar("sumas-restas", 3); // ya topado hoy en sumas: no da
  assert.equal(saldoActual(), 15);
  reloj += DIA; actions.terminar("sumas-restas", 3);   // al día siguiente sí
  assert.equal(actions.gastar("pasarela", 3).ok, true);
  await pausa();
  assert.equal(saldoActual(), 15);

  dispositivo(telefono);
  reloj += 1000; actions.terminar("sumas-restas", 2);
  assert.equal(actions.gastar("pasarela", 3).ok, true);
  await pausa();
  assert.equal(saldoActual(), 14);

  // Regresa el internet: los dos se juntan en la nube y cada uno recibe lo del otro
  fs.offline = false;
  await sync.conectar();          // teléfono
  await pausa();
  dispositivo(tv);
  await sync.conectar();          // TV
  await pausa();
  const esperado = 15 + 3 - 3 + 2 - 3;
  assert.equal(C.saldo(await enNube()), esperado);
  assert.equal(saldoActual(), esperado);
  dispositivo(telefono);
  await sync.conectar();
  await pausa();
  assert.equal(saldoActual(), esperado);
});
