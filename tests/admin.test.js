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

// ---------- #160: nivel, monedas, estrellas y cristales de cada juego ----------

const { CAMPOS_JUEGO, leerRuta, ponerRuta, valorCampo, conCampos, resumenJuego, estrellasDe, conEstrellas, cristalesEncontrados,
  conCristales, leerJson } = await import("../src/engine/index.js");

test("#160: cada juego del catálogo con campos existe, y los topes son los de cada juego", async () => {
  const { juegos } = JSON.parse(readFileSync(new URL("../minijuegos/catalogo.json", import.meta.url)));
  for (const id of Object.keys(CAMPOS_JUEGO)) assert.ok(juegos.includes(id), `${id} está en el catálogo`);
  const topes = {
    "sumas-restas": ["niveles.js", "NIVELES"], "fabrica-numeros": ["niveles.js", "NIVELES"], huerto: ["niveles.js", "NIVELES"],
    "reloj-dragon": ["niveles.js", "NIVELES"], "safari-datos": ["niveles.js", "NIVELES"], puentes: ["niveles.js", "NIVELES_MAX"],
    pizzeria: ["pedidos.js", "NIVELES_MAX"], "robot-palabras": ["textos.js", "NIVELES"], spelling: ["palabras.js", "LISTAS"],
  };
  for (const [id, [archivo, nombre]] of Object.entries(topes)) {
    const m = await import(`../minijuegos/${id}/src/${archivo}`);
    const tope = Array.isArray(m[nombre]) ? m[nombre].length : m[nombre];
    assert.equal(CAMPOS_JUEGO[id].campos[0].max, tope, `${id}: el nivel llega hasta ${tope}`);
  }
  const misiones = JSON.parse(readFileSync(new URL("../minijuegos/mision-luna/datos/misiones.json", import.meta.url))).misiones.length;
  assert.equal(CAMPOS_JUEGO["mision-luna"].campos[0].max, misiones);
});

test("#160: rutas con puntos, sin cambiar lo que recibe", () => {
  const d = { tienda: { monedas: 3, mejoras: ["letrero"] } };
  const n = ponerRuta(d, "tienda.monedas", 40);
  assert.equal(leerRuta(n, "tienda.monedas"), 40); assert.deepEqual(n.tienda.mejoras, ["letrero"]);
  assert.equal(d.tienda.monedas, 3);
  assert.equal(leerRuta(ponerRuta(null, "porMoneda.mxn.nivel", 2), "porMoneda.mxn.nivel"), 2);
  assert.equal(leerRuta({}, "a.b.c"), undefined);
});

test("#160: sobrescribir el nivel escoge ese nivel y deja lo demás", () => {
  const antes = { v: 1, nivel: 2, elegido: 1, niveles: { 1: { total: 9 } }, dias: { x: 1 }, deco: { slots: {} } };
  const d = conCampos("fabrica-numeros", antes, { nivel: 6 });
  assert.deepEqual([d.nivel, d.elegido], [6, 6]);
  assert.deepEqual(d.niveles, antes.niveles); assert.deepEqual(d.deco, antes.deco);
  assert.equal(antes.nivel, 2);
  assert.equal(conCampos("fabrica-numeros", d, { nivel: 6 }), null, "sin cambios");
  assert.throws(() => conCampos("fabrica-numeros", d, { nivel: 9 }), /1 a 8/);
  assert.throws(() => conCampos("fabrica-numeros", d, { nivel: 0 }));
  assert.throws(() => conCampos("sumas-restas", d, { nivel: 1.5 }));
  // sumas-restas no tiene "elegido"
  assert.equal("elegido" in conCampos("sumas-restas", { v: 1, nivel: 1 }, { nivel: 4 }), false);
  // sin nada guardado empieza con la versión del juego
  assert.deepEqual(conCampos("spelling", null, { lista: 5 }), { v: 2, lista: 5, elegida: 5 });
});

test("#160: La Tienda: nivel por moneda y monedas de la tienda", () => {
  const antes = { v: 1, moneda: "usd", porMoneda: { usd: { nivel: 2, elegido: 2, niveles: { 1: {} } } }, tienda: { monedas: 5, mejoras: ["letrero"] } };
  const def = CAMPOS_JUEGO.tienda.campos;
  assert.deepEqual(def.map((c) => valorCampo(antes, c)), [2, 1, 5]);
  const d = conCampos("tienda", antes, { "porMoneda.usd.nivel": 4, "porMoneda.mxn.nivel": 1, "tienda.monedas": 120 });
  assert.deepEqual(d.porMoneda.usd, { nivel: 4, elegido: 4, niveles: { 1: {} } });
  assert.equal(d.porMoneda.mxn, undefined, "si nunca jugó con pesos y se deja en 1, no se crea");
  assert.deepEqual(conCampos("tienda", antes, { "porMoneda.mxn.nivel": 3 }).porMoneda.mxn, { nivel: 3, elegido: 3 });
  assert.deepEqual(d.tienda, { monedas: 120, mejoras: ["letrero"] });
  assert.match(resumenJuego("tienda", antes), /Nivel con dólares 2\/7 · Monedas de la tienda 5/);
  assert.doesNotMatch(resumenJuego("tienda", antes), /pesos/, "no ha jugado con pesos");
});

test("#160: resumen de cada juego para su categoría", () => {
  assert.equal(resumenJuego("sumas-restas", null), "Sin jugar");
  assert.equal(resumenJuego("sumas-restas", { v: 1, nivel: 3 }, 2), "Nivel 3/12 · ⭐⭐");
  assert.equal(resumenJuego("ejemplo", { v: 1 }), "Con datos");
  assert.match(resumenJuego("cajas-sorpresa", { v: 1, polvo: 7, abiertas: 4, tengo: { a: 1, b: 2, c: 0 } }), /Polvo de estrellas 7 · Cajas abiertas 4 · 2 Brumitos/);
  assert.match(resumenJuego("mision-luna", { v: 1, abierta: 3, rocas: { a: 1 }, fotos: {} }), /Misión abierta 3\/6 · 1 rocas, 0 fotos/);
});

test("#160: estrellas del catálogo y cristales del mundo", () => {
  const cat = { huerto: { estrellas: 1, veces: 4, ultima: 9 } };
  assert.equal(estrellasDe(cat, "huerto"), 1); assert.equal(estrellasDe(cat, "puentes"), 0);
  assert.deepEqual(conEstrellas(cat, "huerto", 3).huerto, { estrellas: 3, veces: 4, ultima: 9 });
  assert.deepEqual(conEstrellas(null, "puentes", 2), { puentes: { estrellas: 2, veces: 0, ultima: 0 } });
  assert.equal(conEstrellas(cat, "huerto", 1), null);
  assert.throws(() => conEstrellas(cat, "huerto", 4));
  const mundo = JSON.parse(readFileSync(new URL("../mundo/mundo.json", import.meta.url)));
  const ids = mundo.cristales.map((c) => c.id);
  const d = conCristales({ v: 1, cristales: [ids[0]], otra: 1 }, [ids[1], ids[1], "no-existe"], ids);
  assert.deepEqual(d, { v: 1, cristales: [ids[1]], otra: 1 });
  assert.deepEqual(cristalesEncontrados(d), [ids[1]]); assert.deepEqual(cristalesEncontrados(null), []);
});

test("#160: el JSON escrito a mano debe ser un objeto", () => {
  assert.deepEqual(leerJson('{"v":1,"nivel":3}'), { v: 1, nivel: 3 });
  assert.throws(() => leerJson("[1,2]"), /objeto/);
  assert.throws(() => leerJson("{nivel:3"), /no es válido/);
});

test("#160: la página de administrador no tiene liga desde Noli", () => {
  for (const f of ["index.html", "src/main.js"]) assert.doesNotMatch(readFileSync(new URL(`../${f}`, import.meta.url), "utf8"), /admin\.html/);
});
