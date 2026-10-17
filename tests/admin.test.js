// Pruebas de la página de administrador (admin.html): la lógica para sobrescribir créditos, Pasarela y libros
// (src/engine/admin.js), listar y nombrar perfiles, y que un dispositivo vinculado reciba lo que escribe el admin.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fakeFirestore } from "./fakes/firebase.js";

let almacen = new Map();
globalThis.localStorage = { getItem: (k) => (almacen.has(k) ? almacen.get(k) : null), setItem: (k, v) => almacen.set(k, String(v)) };
globalThis.window = globalThis;

const { ponerSaldo, saldoDe, resumenPasarela, conPasarela, libroDe, conLibro, resumenPerfil, DISPOSITIVO_ADMIN, agregar, libroVacio, saldo } =
  await import("../src/engine/index.js");
const { listarPerfiles, nombrarPerfil, crearPerfil, subirJuego, leerJuegos } = await import("../src/services/index.js");
const { state, actions } = await import("../src/app/index.js");
const sync = await import("../src/app/sync.js");

const desbloqueos = JSON.parse(readFileSync(new URL("../minijuegos/pasarela/datos/desbloqueos.json", import.meta.url)));
const TOTAL = desbloqueos.premios.length;

test("créditos: deja el saldo pedido con un movimiento de papás, sin borrar el historial", () => {
  let libro = agregar(libroVacio(), { n: 7, m: "estrellas", d: "tel", f: 1 });
  libro = agregar(libro, { n: -3, m: "gasto", d: "tel", f: 2 });
  const sube = ponerSaldo(libro, 20, 100);
  assert.equal(sube.n, 16);
  assert.equal(saldo(sube.libro), 20);
  assert.equal(sube.libro.movs.length, 3);
  assert.deepEqual({ m: sube.libro.movs[2].m, d: sube.libro.movs[2].d }, { m: "regalo", d: DISPOSITIVO_ADMIN });
  const baja = ponerSaldo(sube.libro, 5, 200);
  assert.equal(baja.n, -15);
  assert.equal(baja.libro.movs.at(-1).m, "ajuste");
  assert.equal(saldoDe(baja.libro), 5);
  assert.equal(ponerSaldo(baja.libro, 5, 300).n, 0);
  assert.equal(saldo(ponerSaldo(null, 12, 1).libro), 12, "sin libro en la nube, empieza uno");
  assert.throws(() => ponerSaldo(null, -1, 1));
});

test("Pasarela: cambia puntos, pasarelas y premios y conserva lo demás", () => {
  const antes = { v: 3, puntos: 10, pasarelas: 2, premios: 3, vistos: ["x"], atuendos: [{ tema: "playa" }], disenos: [{ id: "d1" }], piel: 2 };
  const d = conPasarela(antes, { puntos: 120, pasarelas: 15, premios: 9999 }, TOTAL);
  assert.equal(d.puntos, 120); assert.equal(d.pasarelas, 15); assert.equal(d.premios, TOTAL, "no más premios de los que hay");
  assert.deepEqual(d.disenos, antes.disenos); assert.equal(d.piel, 2); assert.deepEqual(d.vistos, ["x"]);
  assert.equal(antes.puntos, 10, "no cambia lo que recibe");
  const nuevo = conPasarela(null, { premios: 4 }, TOTAL);
  assert.deepEqual([nuevo.v, nuevo.puntos, nuevo.pasarelas, nuevo.premios], [3, 0, 0, 4]);
  assert.throws(() => conPasarela(null, { puntos: -2 }, TOTAL));
  const r = resumenPasarela(d, desbloqueos);
  assert.equal(r.nivel, "Chispa");
  assert.equal(r.totalPremios, TOTAL);
  assert.equal(resumenPasarela({ pasarelas: 4 }, desbloqueos).premios, 6, "sin premios (versión vieja): 1.5 por pasarela, como el juego");
});

test("libros: encontrados, leídos y todos; respeta lo demás del libro y quita la página si ya no está abierta", () => {
  const antes = { v: 1, libros: { halloween: { leidos: [1, 2], encontrados: [1, 2, 3], pos: { c: 3, p: 4 }, modo: "yo", guia: true }, otro: { leidos: [1] } } };
  const d = conLibro(antes, "halloween", { leidos: [5, 1, 1], encontrados: [1, 5, 6], todos: false });
  const pr = libroDe(d, "halloween");
  assert.deepEqual(pr.leidos, [1, 5]); assert.deepEqual(pr.encontrados, [1, 5, 6]); assert.equal(pr.todos, false);
  assert.equal(pr.pos, null, "el capítulo 3 ya no está abierto");
  assert.equal(d.libros.halloween.modo, "yo"); assert.equal(d.libros.halloween.guia, true);
  assert.deepEqual(d.libros.otro, { leidos: [1] });
  const conPos = conLibro(antes, "halloween", { leidos: [], encontrados: [3], todos: false });
  assert.deepEqual(libroDe(conPos, "halloween").pos, { c: 3, p: 4 });
  assert.equal(libroDe(conLibro(null, "halloween", { leidos: [], encontrados: [], todos: true }), "halloween").todos, true);
});

test("resumen de un perfil para la lista de cuentas", () => {
  const libro = ponerSaldo(null, 9, 5).libro;
  const juegos = [
    { juego: "_creditos", datos: libro, actualizado: 50, dispositivo: "tel" },
    { juego: "pasarela", datos: { puntos: 20, pasarelas: 3, premios: 5 }, actualizado: 80, dispositivo: "tv" },
    { juego: "biblioteca", datos: { libros: { halloween: { leidos: [1, 2] } } }, actualizado: 70, dispositivo: DISPOSITIVO_ADMIN },
  ];
  const r = resumenPerfil({ perfil: "p".repeat(24), creado: 1, nombre: "Noelia" }, juegos, { desbloqueos, libros: [{ id: "halloween", capitulos: 12 }] });
  assert.equal(r.creditos, 9); assert.equal(r.ultima, 80); assert.deepEqual(r.dispositivos, ["tel", "tv"]);
  assert.equal(r.pasarela.nivel, "Aprendiz"); assert.deepEqual(r.libros, [{ id: "halloween", leidos: 2, capitulos: 12 }]);
});

test("listar y nombrar perfiles; un dispositivo vinculado recibe lo que escribe el admin", async () => {
  const fs = fakeFirestore();
  let reloj = 1_000_000;
  sync._configurar({ obtenerFs: async () => fs, espera: 0, ahora: () => reloj });
  // El teléfono activa la nube con algo de progreso
  almacen = new Map(); sync._reiniciar(); state.progreso = {}; state.juegos = [{ id: "pasarela" }];
  actions.guardarDatos("pasarela", { v: 3, puntos: 5, pasarelas: 1, premios: 1, disenos: [{ id: "d1" }] });
  await actions.activarNube();
  const perfil = state.nube.perfil;
  await crearPerfil(fs, "q".repeat(24), 7);
  await nombrarPerfil(fs, perfil, "  Noelia  ");
  const lista = await listarPerfiles(fs);
  assert.equal(lista.length, 2);
  assert.equal(lista.find((p) => p.perfil === perfil).nombre, "Noelia");
  // El admin sobrescribe la Pasarela y los créditos (más nuevo que lo del teléfono)
  const nube = Object.fromEntries((await leerJuegos(fs, perfil)).map((j) => [j.juego, j.datos]));
  await subirJuego(fs, perfil, "pasarela", conPasarela(nube.pasarela, { puntos: 200, pasarelas: 30, premios: 45 }, TOTAL), reloj + 1000, DISPOSITIVO_ADMIN);
  await subirJuego(fs, perfil, "_creditos", ponerSaldo(nube._creditos, 25, reloj + 1000).libro, reloj + 1000, DISPOSITIVO_ADMIN);
  await new Promise((r) => setTimeout(r, 10));
  const local = JSON.parse(almacen.get("noli.datos.pasarela"));
  assert.deepEqual([local.puntos, local.pasarelas, local.premios], [200, 30, 45]);
  assert.deepEqual(local.disenos, [{ id: "d1" }], "lo que diseñó se queda");
  assert.equal(saldo(state.creditos), 25);
});
