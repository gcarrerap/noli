// Pruebas del catálogo: manifiestos, navegación con flechas, protocolo, teclas, carga del registro,
// acciones de la app y que los juegos del repo cumplan el contrato.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

globalThis.localStorage = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; })();
globalThis.window = globalThis;

const { validarManifiesto, jugableEn, materias, filtrar, mover } = await import("../src/engine/index.js");
const { esMensaje, mensaje, estrellas } = await import("../kit/protocolo.js");
const { teclaAAccion } = await import("../kit/teclas.js");
const { cargarCatalogo } = await import("../src/services/index.js");
const { state, actions, conectarJuego, visibles } = await import("../src/app/index.js");

// ---------- Manifiesto ----------

test("manifiesto: completa los valores por omisión", () => {
  const { juego, errores } = validarManifiesto({ id: "sumas", titulo: " Sumas " }, "sumas");
  assert.equal(errores, undefined);
  assert.deepEqual(juego, { id: "sumas", titulo: "Sumas", descripcion: "", icono: "🎲", iconoArchivo: false, color: null, materia: "otros",
    edades: null, controles: ["tactil", "flechas"], entrada: "index.html", version: "1", creditos: null, costo: null });
});

test("manifiesto: rechaza id distinto a la carpeta, rutas fuera de la carpeta y controles desconocidos", () => {
  assert.match(validarManifiesto({ id: "otro", titulo: "x" }, "sumas").errores[0], /no coincide/);
  for (const entrada of ["../x.html", "/x.html", "https://x.com", "javascript:alert(1)"])
    assert.ok(validarManifiesto({ id: "a", titulo: "x", entrada }, "a").errores, entrada);
  assert.ok(validarManifiesto({ id: "a", titulo: "x", controles: ["joystick"] }, "a").errores);
  assert.ok(validarManifiesto({ id: "a", titulo: "x", edades: [6, 3] }, "a").errores);
  assert.ok(validarManifiesto({ id: "A b", titulo: "x" }, "A b").errores);
  assert.ok(validarManifiesto({ id: "a", titulo: "x", icono: "../otro/icono.svg" }, "a").errores);
  assert.ok(validarManifiesto(null, "a").errores);
});

test("manifiesto: en la TV solo entran juegos que se juegan con flechas o con el teléfono", () => {
  const solo = validarManifiesto({ id: "a", titulo: "x", controles: ["tactil"] }, "a").juego;
  assert.equal(jugableEn(solo, "tv"), false);
  assert.equal(jugableEn(solo, "tactil"), true);
  assert.equal(jugableEn({ ...solo, controles: ["remoto"] }, "tv"), true);
});

// ---------- Catálogo ----------

test("materias y filtro", () => {
  const js = [{ materia: "letras" }, { materia: "números" }, { materia: "letras" }];
  assert.deepEqual(materias(js), ["letras", "números"]);
  assert.equal(filtrar(js, "letras").length, 2);
  assert.equal(filtrar(js, null).length, 3);
});

test("mover: cuadrícula de 3 columnas y 7 tarjetas, sin dar la vuelta", () => {
  // 0 1 2
  // 3 4 5
  // 6
  assert.equal(mover(0, "izquierda", 3, 7), 0);
  assert.equal(mover(2, "derecha", 3, 7), 2);
  assert.equal(mover(1, "derecha", 3, 7), 2);
  assert.equal(mover(1, "abajo", 3, 7), 4);
  assert.equal(mover(4, "abajo", 3, 7), 6);   // no hay 7: va a la última
  assert.equal(mover(6, "abajo", 3, 7), 6);
  assert.equal(mover(6, "derecha", 3, 7), 6);
  assert.equal(mover(5, "arriba", 3, 7), 2);
  assert.equal(mover(2, "arriba", 3, 7), 2);
  assert.equal(mover(0, "ok", 3, 7), 0);
  assert.equal(mover(9, "arriba", 3, 7), 3); // índice fuera de rango: se corrige a la última y luego se mueve
  assert.equal(mover(0, "abajo", 1, 3), 1);
  assert.equal(mover(0, "abajo", 3, 0), 0);
});

// ---------- Protocolo y teclas ----------

test("protocolo: solo se aceptan mensajes de Noli con acciones conocidas", () => {
  assert.ok(esMensaje(mensaje("entrada", { accion: "ok" })));
  assert.ok(esMensaje(mensaje("terminar", { estrellas: 2 })));
  assert.ok(esMensaje(mensaje("guardar", { datos: { nivel: 1 } })));
  assert.equal(esMensaje(mensaje("guardar", { datos: "x" })), false);
  assert.equal(esMensaje(mensaje("entrada", { accion: "saltar" })), false);
  assert.equal(esMensaje({ tipo: "salir" }), false);
  assert.equal(esMensaje({ noli: 2, tipo: "salir" }), false);
  assert.equal(esMensaje("salir"), false);
  assert.deepEqual([estrellas(-1), estrellas(2.4), estrellas(9), estrellas("x")], [0, 2, 3, 0]);
});

test("teclas: flechas, OK y el botón atrás de las TVs", () => {
  assert.equal(teclaAAccion({ key: "ArrowUp" }), "arriba");
  assert.equal(teclaAAccion({ key: "Enter" }), "ok");
  assert.equal(teclaAAccion({ key: "Unidentified", keyCode: 10009 }), "atras"); // Samsung
  assert.equal(teclaAAccion({ key: "Unidentified", keyCode: 461 }), "atras");   // LG
  assert.equal(teclaAAccion({ key: "GoBack" }), "atras");                      // Android TV
  assert.equal(teclaAAccion({ key: "a", keyCode: 65 }), null);
  assert.equal(teclaAAccion({ key: "ArrowUp", ctrlKey: true }), null);
});

test("foco: elegir el botón más cercano en la dirección de la flecha", async () => {
  const { elegir } = await import("../kit/foco.js");
  // [0] [1]
  // [2] [3]
  //   [4]  (ancho)
  const r = [{ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 0, w: 10, h: 10 }, { x: 0, y: 20, w: 10, h: 10 }, { x: 20, y: 20, w: 10, h: 10 }, { x: 0, y: 40, w: 30, h: 10 }];
  assert.equal(elegir(r, 0, "derecha"), 1);
  assert.equal(elegir(r, 0, "abajo"), 2);
  assert.equal(elegir(r, 1, "abajo"), 3);
  assert.equal(elegir(r, 3, "abajo"), 4);
  assert.equal(elegir(r, 4, "arriba") === 2 || elegir(r, 4, "arriba") === 3, true);
  assert.equal(elegir(r, 0, "izquierda"), 0);  // no hay nada: se queda
  assert.equal(elegir(r, -1, "abajo"), 0);     // sin foco: el primero
});

// ---------- Cargar el catálogo ----------

function fetchFalso(archivos) {
  return async (url) => {
    const ruta = new URL(url).pathname.replace(/^\/minijuegos\//, "");
    if (!(ruta in archivos)) return { ok: false, status: 404, json: async () => null };
    return { ok: true, status: 200, json: async () => archivos[ruta] };
  };
}
const base = new URL("https://noli.test/minijuegos/");

test("cargarCatalogo: en orden, con la url de entrada; un juego roto no tumba a los demás", async () => {
  const { juegos, errores } = await cargarCatalogo({ base, fetchFn: fetchFalso({
    "catalogo.json": { juegos: ["letras", "roto", "falta", "sumas", "../x"] },
    "letras/juego.json": { id: "letras", titulo: "Letras", materia: "Letras" },
    "roto/juego.json": { id: "otro", titulo: "Roto" },
    "sumas/juego.json": { id: "sumas", titulo: "Sumas", entrada: "juego/inicio.html", icono: "img/icono.svg" },
  }) });
  assert.deepEqual(juegos.map((j) => j.id), ["letras", "sumas"]);
  assert.equal(juegos[0].url, "https://noli.test/minijuegos/letras/index.html");
  assert.equal(juegos[0].materia, "letras");
  assert.equal(juegos[1].url, "https://noli.test/minijuegos/sumas/juego/inicio.html");
  assert.equal(juegos[1].iconoUrl, "https://noli.test/minijuegos/sumas/img/icono.svg");
  assert.equal(juegos[0].iconoUrl, null);
  assert.equal(errores.length, 3);
});

// ---------- Acciones ----------

test("app: cargar, navegar, abrir, reenviar la entrada al juego, terminar y regresar", async () => {
  await actions.iniciar({ base, fetchFn: fetchFalso({
    "catalogo.json": { juegos: ["a", "b", "c"] },
    "a/juego.json": { id: "a", titulo: "A", materia: "letras" },
    "b/juego.json": { id: "b", titulo: "B", materia: "números" },
    "c/juego.json": { id: "c", titulo: "C", materia: "letras" },
  }) });
  assert.equal(state.cargando, false);
  assert.equal(state.juegos.length, 3);

  state.cols = 2;
  actions.entrada("derecha"); assert.equal(state.foco, 1);
  actions.entrada("abajo"); assert.equal(state.foco, 2);
  actions.entrada("ok"); assert.equal(state.jugando.id, "c");

  const recibidas = [];
  const desconectar = conectarJuego((a) => recibidas.push(a));
  actions.entrada("izquierda"); actions.entrada("ok");
  assert.deepEqual(recibidas, ["izquierda", "ok"]);
  assert.equal(state.foco, 2); // el catálogo no se movió

  actions.terminar("c", 2); actions.terminar("c", 1);
  assert.equal(state.progreso.c.estrellas, 2); // se queda la mejor
  assert.equal(state.progreso.c.veces, 2);
  assert.equal(JSON.parse(localStorage.getItem("noli.progreso")).c.estrellas, 2);

  actions.guardarDatos("c", { nivel: 3 });
  assert.deepEqual(actions.datosDe("c"), { nivel: 3 });
  assert.equal(actions.datosDe("a"), null);

  actions.cerrar(); desconectar();
  assert.equal(state.jugando, null);
  assert.equal(state.foco, 2); // regresa a la tarjeta del juego

  actions.elegirMateria("letras");
  assert.deepEqual(visibles().map((j) => j.id), ["a", "c"]);
  assert.equal(state.foco, 0);
  actions.elegirMateria(null);
});

// ---------- Los juegos del repo ----------

test("cada juego de minijuegos/catalogo.json tiene carpeta, manifiesto válido y página de entrada", () => {
  const raiz = new URL("../minijuegos/", import.meta.url);
  const { juegos } = JSON.parse(fs.readFileSync(new URL("catalogo.json", raiz), "utf8"));
  assert.ok(Array.isArray(juegos) && juegos.length > 0);
  assert.equal(new Set(juegos).size, juegos.length, "ids repetidos en catalogo.json");
  for (const id of juegos) {
    const carpeta = new URL(id + "/", raiz);
    const { juego, errores } = validarManifiesto(JSON.parse(fs.readFileSync(new URL("juego.json", carpeta), "utf8")), id);
    assert.equal(errores, undefined, String(errores));
    assert.ok(fs.existsSync(new URL(juego.entrada, carpeta)), `${id}: falta ${juego.entrada}`);
  }
});
