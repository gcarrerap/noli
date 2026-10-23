// Pruebas del modo secreto del búho (#166): la frase (normalizar y SHA-256; aquí nunca va la frase real, el repo es
// público), el reloj, las preguntas, los datos del búho y su lugar en Isla Noli.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";

import { normalizarFrase, sha256, esFraseSecreta, relojSecreto, otraPregunta, revisarBuho, solidoBuho, juntoAlBuho } from "../src/engine/secreto.js";
import { armarIslas, estadoRed, libresNoli, salidasNoli, teletransportadorDe } from "../src/engine/islas.js";
import { colocarLugares, decorar, todosLosSitios, mapaMundo, fisicaDe, crearCaminos, rutaPorCaminos, puntoLibre } from "../src/engine/mundo.js";
import { pasoFisico, crearCuerpo } from "../kit/3d/fisica.js";
import { seguirRuta } from "../kit/3d/movimiento.js";

const leer = (p) => JSON.parse(fs.readFileSync(new URL("../" + p, import.meta.url), "utf8"));
const MUNDO = leer("mundo/mundo.json"), LUGARES = leer("mundo/lugares.json"), BUHO = leer("mundo/buho.json");
const RED = armarIslas(leer("mundo/islas.json"));
const CFG = fisicaDe(MUNDO);

test("frase: minúsculas, sin acentos, sin espacios ni signos", () => {
  for (const t of ["hola buho", "¡Hola, Búho!", "HOLA  BUHO", "  hola-búho. "]) assert.equal(normalizarFrase(t), "holabuho", t);
  assert.equal(normalizarFrase(""), ""); assert.equal(normalizarFrase(null), "");
});

test("SHA-256 en JS puro: igual que el de Node (vectores conocidos y textos con acentos)", () => {
  assert.equal(sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(sha256(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  for (const t of ["holabuho", "x".repeat(55), "x".repeat(56), "x".repeat(64), "x".repeat(200), "ñandú"]) assert.equal(sha256(t), createHash("sha256").update(t).digest("hex"), t);
});

test("frase secreta: con el hash de una frase de ejemplo, sus variantes abren y otras no", () => {
  const hash = sha256("holabuho"); // ejemplo; la de verdad no se escribe en el repo
  for (const t of ["hola buho", "¡Hola, Búho!", "HOLA  BUHO"]) assert.equal(esFraseSecreta(t, hash), true, t);
  for (const t of ["hola", "buho hola", "", "   "]) assert.equal(esFraseSecreta(t, hash), false, t);
  assert.equal(esFraseSecreta("x", ""), false, "sin hash, nunca");
});

test("reloj y preguntas", () => {
  assert.equal(relojSecreto(600000, 0), "10:00");
  assert.equal(relojSecreto(600000, 1), "10:00", "redondea hacia arriba");
  assert.equal(relojSecreto(61000, 0), "1:01");
  assert.equal(relojSecreto(0, 5000), "0:00");
  const ps = ["a", "b", "c"];
  for (let i = 0; i < 20; i++) assert.notEqual(otraPregunta(ps, "a"), "a", "no repite la anterior");
  assert.equal(otraPregunta(["sola"], "sola"), "sola");
});

test("buho.json: datos bien (10 minutos, un SHA-256, preguntas y respuestas) y revisarBuho encuentra los rotos", () => {
  assert.deepEqual(revisarBuho(BUHO), []);
  assert.equal(BUHO.minutos, 10);
  assert.ok(revisarBuho({ ...BUHO, hash: "no-es-un-hash" }).some((e) => e.includes("SHA-256")));
  assert.ok(revisarBuho({ ...BUHO, preguntas: ["una"] }).length);
});

test("búho: está en Isla Noli, no tapa nada, se llega caminando y se le habla solo de cerca", () => {
  const todos = todosLosSitios(LUGARES);
  const libres = libresNoli(RED); libres.puntos.push({ x: BUHO.x, z: BUHO.z, r: BUHO.radio + 1.6 });
  const deco = decorar(MUNDO, todos, libres);
  const mapa = mapaMundo(MUNDO, todos, deco);
  mapa.solidos.push(solidoBuho(BUHO));
  const l = MUNDO.limites;
  assert.ok(BUHO.x > l.x0 + 3 && BUHO.x < l.x1 - 3 && BUHO.z > l.z0 + 3 && BUHO.z < l.z1 - 2, "dentro de Isla Noli");
  // No tapa: el inicio, las puertas, las salidas a los puentes y el teletransportador siguen libres y alcanzables
  const salidas = salidasNoli(RED), t = teletransportadorDe(RED.por.get("noli"));
  const extra = [...salidas.map((s) => s.adentro), ...salidas.map((s) => s.lejos), t];
  const caminos = crearCaminos(MUNDO, todos, mapa, CFG, extra);
  for (const p of [MUNDO.inicio, ...todos.map((s) => s.punto), ...salidas.map((s) => s.adentro), t]) {
    assert.ok(puntoLibre(p, mapa, CFG), `(${p.x.toFixed(1)}, ${p.z.toFixed(1)})`);
    assert.ok(rutaPorCaminos(caminos, MUNDO.inicio, p), `ruta a (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`);
  }
  for (const a of deco.arboles) assert.ok(Math.hypot(a.x - BUHO.x, a.z - BUHO.z) > BUHO.radio + 1.5, "un árbol junto al búho");
  // Junto al búho: se llega caminando desde la plaza y ahí sale "Hablar con el búho"
  const frente = { x: BUHO.x, z: BUHO.z - BUHO.radio - 1.0 };
  assert.ok(puntoLibre(frente, mapa, CFG));
  let c = crearCuerpo(MUNDO.inicio.x, MUNDO.inicio.z), ruta = rutaPorCaminos(caminos, c, frente);
  for (let i = 0; i < 60 * 20 && ruta.length; i++) { const s = seguirRuta(c, ruta); ruta = s.ruta; c = pasoFisico(c, { quiere: s.quiere }, 1 / 60, CFG, mapa).c; }
  assert.ok(juntoAlBuho(c, BUHO), "llegó junto al búho");
  assert.ok(!juntoAlBuho({ x: BUHO.x + 6, y: 0, z: BUHO.z }, BUHO), "de lejos no");
  assert.ok(!juntoAlBuho({ x: c.x, y: 1, z: c.z }, BUHO), "brincando no");
});

test("modo secreto: todas las conexiones existen (sin muelles) y al apagarlo regresan las de verdad", () => {
  const datos = { visitadas: ["noli"], conexiones: [] };
  const magia = estadoRed(RED, datos, { todas: true });
  assert.equal(magia.hechas.size, RED.conexiones.length);
  assert.equal(magia.muelles.length, 0);
  const normal = estadoRed(RED, datos);
  assert.equal(normal.hechas.size, 0);
  assert.ok(normal.muelles.length > 0);
});
