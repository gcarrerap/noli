// Cajas Sorpresa (#59): economía, garantías, sin repetir al principio, polvo de estrellas y la simulación fija.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rngConSemilla } from "../src/rng.js";
import {
  estadoNuevo, cargar, abrir, canjear, puedeAbrir, rarezaDeCaja, faltanRara, faltanUltra, quedanHoy,
  cambiarLimite, completa, cuantasTiene, tiene, deCada, precioPolvo, RAREZAS,
} from "../src/cajas.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const leer = (rel) => JSON.parse(fs.readFileSync(path.join(dir, "..", rel), "utf8"));
const cfg = leer("datos/config.json");
const { piezas } = leer("datos/coleccion.json");
const HOY = "2026-10-17";

// Abre n cajas seguidas con la misma semilla, como si el límite diario no existiera
function abrirVarias(n, semilla = 7, e = estadoNuevo()) {
  const rng = rngConSemilla(semilla);
  const salidas = [];
  for (let i = 0; i < n; i++) {
    const r = abrir(e, cfg, piezas, rng, "d" + i);
    e = r.estado; salidas.push(r.resultado);
  }
  return { e, salidas };
}

test("la colección: 24 piezas (16 comunes, 6 raras, 2 ultra raras), ids únicos y las 3 de prueba de Petra", () => {
  assert.equal(piezas.length, 24);
  const cuenta = Object.fromEntries(RAREZAS.map((r) => [r, piezas.filter((p) => p.rareza === r).length]));
  assert.deepEqual(cuenta, { comun: 16, rara: 6, ultra: 2 });
  assert.equal(new Set(piezas.map((p) => p.id)).size, 24);
  for (const id of ["calabacin", "unibrumi", "reina-calabaza"]) assert.ok(piezas.some((p) => p.id === id), id);
  for (const p of piezas) {
    assert.match(p.id, /^[a-z0-9-]+$/);
    assert.match(p.cuerpo, /^#[0-9a-f]{6}$/i);
    assert.match(p.disfraz, /^#[0-9a-f]{6}$/i);
  }
});

test("la economía es la acordada en #59", () => {
  assert.equal(cfg.costo, 5);
  assert.equal(cfg.limiteDia, 2);
  assert.deepEqual(cfg.probabilidad, { comun: 0.75, rara: 0.2, ultra: 0.05 });
  assert.deepEqual(cfg.garantia, { rara: 8, ultra: 25 });
  assert.equal(cfg.sinRepetir, 10);
  assert.deepEqual(cfg.polvoPorRepetida, { comun: 1, rara: 3, ultra: 10 });
  assert.deepEqual(cfg.precioPolvo, { comun: 5, rara: 15, ultra: 40 });
});

test("se explica sin porcentajes: 3 de cada 4, 1 de cada 5, 1 de cada 20", () => {
  assert.deepEqual(deCada(cfg.probabilidad.comun), { n: 3, de: 4 });
  assert.deepEqual(deCada(cfg.probabilidad.rara), { n: 1, de: 5 });
  assert.deepEqual(deCada(cfg.probabilidad.ultra), { n: 1, de: 20 });
});

test("las probabilidades se cumplen a la larga (sin garantías de por medio)", () => {
  const rng = rngConSemilla(42);
  const n = 40000, c = { comun: 0, rara: 0, ultra: 0 };
  for (let i = 0; i < n; i++) c[rarezaDeCaja(estadoNuevo(), cfg, rng)]++;
  assert.ok(Math.abs(c.comun / n - 0.75) < 0.01, `comunes ${c.comun / n}`);
  assert.ok(Math.abs(c.rara / n - 0.2) < 0.01, `raras ${c.rara / n}`);
  assert.ok(Math.abs(c.ultra / n - 0.05) < 0.005, `ultra ${c.ultra / n}`);
});

test("garantías: nunca pasan más de 8 cajas sin rara ni 25 sin ultra rara", () => {
  for (let semilla = 1; semilla <= 60; semilla++) {
    const { salidas } = abrirVarias(200, semilla);
    let sinRara = 0, sinUltra = 0;
    for (const { pieza } of salidas) {
      sinRara = pieza.rareza === "comun" ? sinRara + 1 : 0;
      sinUltra = pieza.rareza === "ultra" ? 0 : sinUltra + 1;
      assert.ok(sinRara < cfg.garantia.rara, `semilla ${semilla}: ${sinRara} sin rara`);
      assert.ok(sinUltra < cfg.garantia.ultra, `semilla ${semilla}: ${sinUltra} sin ultra`);
    }
  }
});

test("garantía forzada: con 7 cajas sin rara, la 8 es rara o ultra; con 24 sin ultra, la 25 es ultra", () => {
  const siempreComun = () => 0.99;
  assert.notEqual(rarezaDeCaja({ ...estadoNuevo(), sinRara: 7 }, cfg, siempreComun), "comun");
  assert.equal(rarezaDeCaja({ ...estadoNuevo(), sinRara: 6 }, cfg, siempreComun), "comun");
  assert.equal(rarezaDeCaja({ ...estadoNuevo(), sinUltra: 24 }, cfg, siempreComun), "ultra");
});

test("los contadores de la garantía bajan con cada caja y se reinician al salir la rareza", () => {
  let e = estadoNuevo();
  assert.equal(faltanRara(e, cfg), 8);
  assert.equal(faltanUltra(e, cfg), 25);
  const comun = piezas.find((p) => p.rareza === "comun");
  e = { ...e, sinRara: 3, sinUltra: 10 };
  assert.equal(faltanRara(e, cfg), 5);
  assert.equal(faltanUltra(e, cfg), 15);
  // una caja común con rng que siempre da común
  const r = abrir(e, cfg, piezas.filter((p) => p === comun), () => 0.99, HOY);
  assert.equal(faltanRara(r.estado, cfg), 4);
  // una rara reinicia la de rara pero no la de ultra
  const rara = abrir({ ...e, abiertas: 50 }, cfg, piezas, () => 0.06, HOY).estado;
  assert.equal(rara.sinRara, 0);
  assert.equal(rara.sinUltra, 11);
});

test("en las primeras 10 cajas no se repite nada", () => {
  for (let semilla = 1; semilla <= 300; semilla++) {
    const { salidas } = abrirVarias(10, semilla);
    const ids = salidas.map((s) => s.pieza.id);
    assert.equal(new Set(ids).size, 10, `semilla ${semilla}: ${ids}`);
    assert.ok(salidas.every((s) => s.nueva && s.polvo === 0));
  }
});

test("sin repetir aunque ya no queden de la rareza que salió: se da una que falte de otra", () => {
  const e = { ...estadoNuevo(), abiertas: 3, tengo: { "reina-calabaza": 1, fenix: 1 } };
  const r = abrir(e, cfg, piezas, () => 0.01, HOY); // 0.01 = ultra
  assert.ok(r.resultado.nueva);
  assert.equal(r.resultado.pieza.rareza, "comun");
});

test("los repetidos se vuelven polvo de estrellas (1, 3 o 10), nunca créditos", () => {
  const { e, salidas } = abrirVarias(80, 3);
  const repetidas = salidas.filter((s) => !s.nueva);
  assert.ok(repetidas.length > 0);
  for (const s of repetidas) assert.equal(s.polvo, cfg.polvoPorRepetida[s.pieza.rareza]);
  assert.equal(e.polvo, repetidas.reduce((t, s) => t + s.polvo, 0));
  assert.ok(!("creditos" in e));
});

test("con polvo se escoge exactamente la pieza que falta, al precio de su rareza", () => {
  const unibrumi = piezas.find((p) => p.id === "unibrumi");
  let e = { ...estadoNuevo(), polvo: 14 };
  let r = canjear(e, cfg, unibrumi);
  assert.equal(r.ok, false); assert.equal(r.motivo, "polvo"); assert.equal(r.faltan, 1);
  e = { ...e, polvo: 20 };
  r = canjear(e, cfg, unibrumi);
  assert.ok(r.ok); assert.equal(r.estado.polvo, 5); assert.ok(tiene(r.estado, "unibrumi"));
  assert.equal(canjear(r.estado, cfg, unibrumi).motivo, "ya");
  assert.equal(canjear({ ...e, cerrada: true }, cfg, unibrumi).motivo, "cerrada");
  assert.equal(precioPolvo(cfg, piezas.find((p) => p.id === "fenix")), 40);
});

test("límite diario: 2 cajas al día, se reinicia al cambiar de día, y papás lo mueven entre 0 y 5", () => {
  let e = estadoNuevo();
  assert.equal(quedanHoy(e, cfg, HOY), 2);
  const rng = rngConSemilla(1);
  e = abrir(e, cfg, piezas, rng, HOY).estado;
  e = abrir(e, cfg, piezas, rng, HOY).estado;
  assert.equal(quedanHoy(e, cfg, HOY), 0);
  assert.deepEqual(puedeAbrir(e, cfg, piezas, HOY, 50), { ok: false, motivo: "limite" });
  assert.equal(quedanHoy(e, cfg, "2026-10-18"), 2);
  assert.ok(puedeAbrir(e, cfg, piezas, "2026-10-18", 50).ok);
  e = cambiarLimite(e, cfg, +1);
  assert.equal(quedanHoy(e, cfg, HOY), 1);
  for (let i = 0; i < 10; i++) e = cambiarLimite(e, cfg, +1);
  assert.equal(e.limite, 5);
  for (let i = 0; i < 10; i++) e = cambiarLimite(e, cfg, -1);
  assert.equal(e.limite, 0);
});

test("puedeAbrir: tienda cerrada, sin créditos y colección completa", () => {
  const e = estadoNuevo();
  assert.deepEqual(puedeAbrir({ ...e, cerrada: true }, cfg, piezas, HOY, 50), { ok: false, motivo: "cerrada" });
  assert.deepEqual(puedeAbrir(e, cfg, piezas, HOY, 3), { ok: false, motivo: "creditos", faltan: 2 });
  assert.ok(puedeAbrir(e, cfg, piezas, HOY, 5).ok);
  const llena = { ...e, tengo: Object.fromEntries(piezas.map((p) => [p.id, 1])) };
  assert.ok(completa(llena, piezas));
  assert.equal(puedeAbrir(llena, cfg, piezas, HOY, 50).motivo, "completa");
});

test("abrir no cambia el estado de entrada y guarda el historial (con tope)", () => {
  const e = estadoNuevo();
  const copia = JSON.stringify(e);
  const r = abrir(e, cfg, piezas, rngConSemilla(9), HOY, "2026-10-17T10:00:00");
  assert.equal(JSON.stringify(e), copia);
  assert.equal(r.estado.historial.length, 1);
  assert.deepEqual(Object.keys(r.estado.historial[0]).sort(), ["f", "id", "nueva", "polvo", "r"]);
  const { e: muchas } = abrirVarias(cfg.historialMax + 30, 5);
  assert.equal(muchas.historial.length, cfg.historialMax);
});

test("cargar normaliza datos viejos o rotos sin perder lo bueno", () => {
  assert.deepEqual(cargar(null), estadoNuevo());
  const e = cargar({ tengo: { murci: 2, malo: -1 }, polvo: "x", limite: 3, cerrada: true, historial: [null, { id: "murci" }] });
  assert.deepEqual(e.tengo, { murci: 2 });
  assert.equal(e.polvo, 0);
  assert.equal(e.limite, 3);
  assert.equal(e.cerrada, true);
  assert.equal(e.historial.length, 1);
  assert.equal(cuantasTiene(e, piezas), 1);
});

// La simulación de #59: 5,000 colecciones con semilla fija. Noelia canjea con polvo en cuanto le alcanza para
// una pieza que falta. Si alguien cambia un número de la economía, esta prueba falla a propósito.
test("simulación de 5,000 colecciones: la mitad en 46 cajas o menos, 9 de cada 10 en 60, el peor en 81", () => {
  const rng = rngConSemilla(12345);
  const cajas = [];
  for (let k = 0; k < 5000; k++) {
    let e = estadoNuevo(), n = 0;
    while (!completa(e, piezas)) {
      e = abrir(e, cfg, piezas, rng, "d").estado; n++;
      let compro = true;
      while (compro) {
        compro = false;
        for (const p of piezas) {
          const r = canjear(e, cfg, p);
          if (r.ok) { e = r.estado; compro = true; break; }
        }
      }
    }
    cajas.push(n);
  }
  cajas.sort((a, b) => a - b);
  const mediana = cajas[2499], p90 = cajas[4499], peor = cajas[4999];
  // Los mismos números de la simulación de #59, exactos: con 2 cajas al día, más o menos un mes
  assert.deepEqual({ mediana, p90, peor }, { mediana: 46, p90: 60, peor: 81 });
});

test("dibujos: provisional en SVG hasta que llegue el arte de Petra; marca de rareza con 1, 2 o 3 estrellas", async () => {
  const { brumitoSvg, imagenPieza, huecoPieza, estrellasRareza } = await import("../src/dibujos.js");
  for (const p of piezas) {
    const svg = brumitoSvg(p);
    assert.match(svg, /^<svg[\s\S]*<\/svg>$/);
    assert.ok(svg.includes(p.cuerpo) && svg.includes(p.disfraz), p.id);
    assert.equal(imagenPieza(p), svg);
  }
  const p = { ...piezas[0], imagen: true, silueta: true };
  assert.match(imagenPieza(p, true), /src="arte\/calabacin-512\.webp"/);
  assert.match(imagenPieza(p), /src="arte\/calabacin-128\.webp"[^>]*loading="lazy"/);
  assert.match(huecoPieza(p), /src="arte\/calabacin-silueta\.svg"/);
  for (const [r, n] of [["comun", 1], ["rara", 2], ["ultra", 3]]) assert.equal((estrellasRareza(r).match(/<svg/g) || []).length, n);
});

test("si una pieza dice que ya tiene arte, los archivos existen", () => {
  for (const p of piezas) {
    if (p.imagen) for (const t of [512, 128]) assert.ok(fs.existsSync(path.join(dir, "..", `arte/${p.id}-${t}.webp`)), `${p.id}-${t}`);
    if (p.silueta) assert.ok(fs.existsSync(path.join(dir, "..", `arte/${p.id}-silueta.svg`)), p.id);
  }
});
