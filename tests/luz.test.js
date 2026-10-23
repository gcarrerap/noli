// Pruebas de la luz del mundo (#hora-real): el sol sigue la hora real del aparato (src/engine/luz.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { posicionSol, luzAhora, mezclarColor } from "../src/engine/luz.js";

const leer = (p) => JSON.parse(fs.readFileSync(new URL("../" + p, import.meta.url), "utf8"));
const LUZ = leer("mundo/mundo.json").luz;
const KY = { lat: LUZ.lat, lon: LUZ.lon }; // Independence, Kentucky (la casa)

test("luz: el sol sale y se pone cerca de la hora que da el lugar (Independence, KY, 22 oct)", () => {
  const alt = (h, m) => posicionSol(new Date(`2026-10-22T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00-04:00`), KY.lat, KY.lon).altitud;
  // Al mediodía está alto; a media tarde sigue arriba; ya de noche, muy abajo
  assert.ok(alt(12, 0) > 30, "mediodía: sol alto");
  assert.ok(alt(15, 0) > 10, "media tarde: aún arriba");
  // Kentucky está en el extremo occidental de la zona horaria: el sol sale ~8:00 y se pone ~18:46 EDT
  assert.ok(alt(18, 30) > 0 && alt(19, 0) < 0, "el sol se pone a eso de las 18:46");
  assert.ok(alt(7, 45) < 0 && alt(8, 10) > 0, "el sol sale a eso de las 8:00");
  assert.ok(alt(22, 20) < -30, "22:20 es noche cerrada");
});

test("luz: el sol va de este a oeste (+x a -x) y el norte está al fondo (−z)", () => {
  const manana = posicionSol(new Date("2026-10-22T07:45:00-04:00"), KY.lat, KY.lon);
  const tarde = posicionSol(new Date("2026-10-22T17:45:00-04:00"), KY.lat, KY.lon);
  assert.ok(manana.direccion.x > 0.5, "en la mañana sale por el este (+x)");
  assert.ok(tarde.direccion.x < -0.5, "en la tarde se va por el oeste (−x)");
  const mediodia = posicionSol(new Date("2026-10-22T13:20:00-04:00"), KY.lat, KY.lon);
  assert.ok(mediodia.direccion.z > 0.5, "a mediodía está al sur, del lado de la cámara (+z)");
});

test("luz: el vector de dirección es unitario", () => {
  for (const h of [0, 6, 9, 13, 18, 23]) {
    const { direccion: d } = posicionSol(new Date(`2026-10-22T${String(h).padStart(2, "0")}:00:00-04:00`), KY.lat, KY.lon);
    assert.ok(Math.abs(Math.hypot(d.x, d.y, d.z) - 1) < 1e-9);
  }
});

test("luz: de día el mundo se ve como antes (cielo lavanda, sol fuerte)", () => {
  const L = luzAhora(new Date("2026-10-22T13:00:00-04:00"), LUZ);
  assert.equal(L.fase, "dia");
  assert.equal(L.cielo, LUZ.dia.cielo);
  assert.equal(L.luzCieloI, LUZ.dia.luzCieloI);
  assert.equal(L.solI, LUZ.dia.solI);
  assert.equal(L.estrellas, 0, "de día no hay estrellas");
});

test("luz: de noche el cielo es oscuro, la luz baja y salen las estrellas", () => {
  const L = luzAhora(new Date("2026-10-22T22:20:00-04:00"), LUZ);
  assert.equal(L.fase, "noche");
  assert.equal(L.cielo, LUZ.noche.cielo);
  assert.ok(L.solI < LUZ.dia.solI, "la luz es más suave");
  assert.equal(L.estrellas, 1, "estrellas encendidas");
  assert.ok(L.direccion.y > 0, "la luz de la luna viene de arriba");
});

test("luz: el atardecer tiñe el cielo entre el día y la noche", () => {
  const L = luzAhora(new Date("2026-10-22T18:45:00-04:00"), LUZ);
  assert.ok(["crepusculo", "amanecer"].includes(L.fase));
  assert.notEqual(L.cielo, LUZ.dia.cielo);
  assert.notEqual(L.cielo, LUZ.noche.cielo);
  assert.ok(L.estrellas < 1);
});

test("luz: mezclarColor va de un color al otro y a la mitad queda entre los dos", () => {
  assert.equal(mezclarColor("#000000", "#ffffff", 0), "#000000");
  assert.equal(mezclarColor("#000000", "#ffffff", 1), "#ffffff");
  assert.equal(mezclarColor("#000000", "#ffffff", 0.5), "#808080");
});

test("luz: la configuración de mundo.json tiene los campos que usa el motor", () => {
  for (const k of ["lat", "lon"]) assert.equal(typeof LUZ[k], "number");
  for (const ext of ["dia", "noche"]) {
    for (const k of ["cielo", "niebla", "luzCielo", "luzSuelo", "sol"]) assert.match(LUZ[ext][k], /^#[0-9a-f]{6}$/i, `${ext}.${k}`);
    for (const k of ["luzCieloI", "solI"]) assert.equal(typeof LUZ[ext][k], "number", `${ext}.${k}`);
  }
  for (const k of ["cielo", "sol"]) assert.match(LUZ.horizonte[k], /^#[0-9a-f]{6}$/i, `horizonte.${k}`);
});
