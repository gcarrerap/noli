// Pruebas de la nube (#7) con el Firebase de mentira: activar, vincular un segundo dispositivo con código,
// gana lo más nuevo, cambios en vivo, sin conexión y los errores del código.
// Dos "dispositivos" se simulan cambiando el localStorage y volviendo a leer el estado de la nube.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeFirestore } from "./fakes/firebase.js";

let almacen = new Map();
globalThis.localStorage = { getItem: (k) => (almacen.has(k) ? almacen.get(k) : null), setItem: (k, v) => almacen.set(k, String(v)) };
globalThis.window = globalThis;

const { state, actions } = await import("../src/app/index.js");
const sync = await import("../src/app/sync.js");
const { completarVinculo, crearVinculo, subirJuego, leerJuegos, PERFILES } = await import("../src/services/index.js");

const fs = fakeFirestore();
let reloj = 1_000_000;
sync._configurar({ obtenerFs: async () => fs, espera: 0, ahora: () => reloj });
const pausa = (ms = 5) => new Promise((r) => setTimeout(r, ms));
const JUEGO = "sumas-restas";

// Cambia de dispositivo: otro localStorage y el estado vuelve a leerse de él
function dispositivo(mapa) {
  almacen = mapa;
  sync._reiniciar();
  state.progreso = JSON.parse(mapa.get("noli.progreso") || "{}");
  state.juegos = [{ id: JUEGO }];
}
const nubeDe = async (perfil) => Object.fromEntries((await leerJuegos(fs, perfil)).map((j) => [j.juego, j]));

const telefono = new Map(), tv = new Map();
let perfil;

test("activar: el primer dispositivo crea el perfil y sube lo que ya tenía", async () => {
  dispositivo(telefono);
  reloj += 1000; actions.guardarDatos(JUEGO, { nivel: 3 });
  actions.terminar(JUEGO, 2);
  assert.equal(state.nube.estado, "apagada");
  await actions.activarNube();
  perfil = state.nube.perfil;
  assert.match(perfil, /^[a-z2-9]{24}$/);
  assert.equal(state.nube.estado, "lista");
  const nube = await nubeDe(perfil);
  assert.deepEqual(nube[JUEGO].datos, { nivel: 3 });
  assert.equal(nube._catalogo.datos[JUEGO].estrellas, 2);
  assert.ok(fs._docs.has(`${PERFILES}/${perfil}`));
});

test("vincular: la TV enseña un código, el teléfono lo escribe y la TV recibe el progreso", async () => {
  // La TV ya tenía algo de antes, sin fecha: pierde contra la nube
  dispositivo(tv);
  tv.set("noli.datos." + JUEGO, JSON.stringify({ nivel: 1 }));
  await actions.empezarVinculo();
  const codigo = state.nube.codigo;
  assert.match(codigo, /^\d{6}$/);
  assert.equal(state.nube.estado, "esperando");
  // El teléfono escribe el código
  await completarVinculo(fs, codigo, perfil, reloj);
  await pausa();
  assert.equal(state.nube.perfil, perfil);
  assert.equal(state.nube.estado, "lista");
  assert.deepEqual(JSON.parse(tv.get("noli.datos." + JUEGO)), { nivel: 3 });
  assert.equal(state.progreso[JUEGO].estrellas, 2);
  assert.equal(fs._docs.has("noli_vinculos/" + codigo), false, "el código se borra");
});

test("lo que guarda la TV se sube, y el teléfono lo toma al abrir", async () => {
  reloj += 1000; actions.guardarDatos(JUEGO, { nivel: 4 });
  await pausa();
  assert.deepEqual((await nubeDe(perfil))[JUEGO].datos, { nivel: 4 });
  dispositivo(telefono);
  await sync.conectar();
  assert.deepEqual(JSON.parse(telefono.get("noli.datos." + JUEGO)), { nivel: 4 });
});

test("cambios en vivo: si otro dispositivo guarda algo más nuevo, llega solo", async () => {
  await subirJuego(fs, perfil, JUEGO, { nivel: 5 }, reloj + 500, "otro");
  assert.deepEqual(JSON.parse(telefono.get("noli.datos." + JUEGO)), { nivel: 5 });
  // Algo más viejo que lo de aquí no se aplica
  await subirJuego(fs, perfil, JUEGO, { nivel: 2 }, reloj - 5000, "otro");
  assert.deepEqual(JSON.parse(telefono.get("noli.datos." + JUEGO)), { nivel: 5 });
});

test("sin conexión: se guarda aquí, queda pendiente y se sube al regresar", async () => {
  fs.offline = true;
  reloj += 2000; actions.guardarDatos(JUEGO, { nivel: 6 });
  await pausa();
  assert.equal(state.nube.estado, "sin-conexion");
  assert.deepEqual(JSON.parse(telefono.get("noli.datos." + JUEGO)), { nivel: 6 });
  assert.equal(JSON.parse(telefono.get("noli.nube.meta"))[JUEGO].pendiente, true);
  fs.offline = false;
  await sync.subirPendientes();
  assert.equal(state.nube.estado, "lista");
  assert.deepEqual((await nubeDe(perfil))[JUEGO].datos, { nivel: 6 });
  assert.equal(JSON.parse(telefono.get("noli.nube.meta"))[JUEGO].pendiente, false);
});

test("al reconectar, lo de aquí más nuevo le gana a lo de la nube", async () => {
  dispositivo(tv);                                  // la TV se quedó en nivel 4
  reloj += 1000; tv.set("noli.datos." + JUEGO, JSON.stringify({ nivel: 7 }));
  sync.marcarCambio(JUEGO);                         // jugó sin conexión, más reciente que el nivel 6 del teléfono
  await sync.conectar();
  assert.deepEqual((await nubeDe(perfil))[JUEGO].datos, { nivel: 7 });
});

test("código para vincular: no existe, ya venció o ya se usó", async () => {
  await assert.rejects(completarVinculo(fs, "12", perfil, reloj), /6 números/);
  await assert.rejects(completarVinculo(fs, "000000", perfil, reloj), /no existe/);
  const c = await crearVinculo(fs, { ahora: reloj });
  await assert.rejects(completarVinculo(fs, c, perfil, reloj + 11 * 60 * 1000), /venció/);
  await completarVinculo(fs, c, perfil, reloj);
  await assert.rejects(completarVinculo(fs, c, perfil, reloj), /ya se usó/);
  // Desde la app, el error queda como mensaje
  assert.equal(await actions.vincularOtro("999999"), false);
  assert.match(state.nube.error, /no existe/);
});

test("desvincular: deja de sincronizar y conserva lo guardado aquí", async () => {
  actions.desvincular();
  assert.equal(state.nube.estado, "apagada");
  assert.equal(state.nube.perfil, null);
  assert.deepEqual(JSON.parse(tv.get("noli.datos." + JUEGO)), { nivel: 7 });
  reloj += 1000; actions.guardarDatos(JUEGO, { nivel: 8 });
  await pausa();
  assert.deepEqual((await nubeDe(perfil))[JUEGO].datos, { nivel: 7 }, "ya no sube");
});
