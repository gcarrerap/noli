import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import {
  progresoDe, conProgreso, abierto, mover, dondeSeguir, palabrasConTiempo, palabraEn, marcarLeido, contarPalabras, BUSQUEDA,
} from "../src/libro.js";

const BASE = new URL("../libros/halloween/", import.meta.url);
const libro = JSON.parse(readFileSync(new URL("libro.json", BASE), "utf8"));
const meta = JSON.parse(readFileSync(new URL("meta.json", BASE), "utf8"));
const paginas = libro.capitulos.flatMap((c) => c.paginas.map((p, i) => ({ c: c.n, i, p })));

// ---------- El libro ----------

test("el libro tiene 12 capítulos en orden, con título y páginas", () => {
  assert.equal(libro.titulo, meta.titulo);
  assert.deepEqual(libro.capitulos.map((c) => c.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  for (const c of libro.capitulos) {
    assert.ok(c.titulo.length > 3, `cap ${c.n} sin título`);
    assert.ok(c.paginas.length >= 5, `cap ${c.n}: pocas páginas`);
  }
});

test("dura unas 3 horas: 10,000–12,000 palabras", () => {
  const n = contarPalabras(libro);
  assert.ok(n >= 10000 && n <= 12000, `${n} palabras`);
});

test("libro.json dice lo mismo que el texto (texto/cap-NN.md)", () => {
  for (const c of libro.capitulos) {
    const md = readFileSync(new URL(`texto/cap-${String(c.n).padStart(2, "0")}.md`, BASE), "utf8")
      .replace(/<!--[\s\S]*?-->/g, "").replace(/^#.*$/m, "").replace(/\*/g, "");
    const delMd = md.split(/\s+/).filter((w) => w && w !== "---");
    const delJson = c.paginas.flatMap((p) => p.parrafos.flat().flatMap((o) => o.palabras.map((w) => w.w)));
    assert.deepEqual(delJson, delMd, `cap ${c.n}: hay que volver a correr herramientas/libro.py`);
  }
});

test("cada página tiene su grabación y cada palabra su tiempo, en orden y dentro del audio", () => {
  for (const { c, i, p } of paginas) {
    assert.ok(p.audio, `cap ${c} pág ${i + 1} sin audio`);
    assert.ok(existsSync(new URL(p.audio, BASE)), `falta ${p.audio}`);
    let antes = 0;
    for (const o of p.parrafos.flat()) {
      assert.ok(o.t0 < o.t1 && o.t1 <= p.duracion + 0.01, `cap ${c} pág ${i + 1}: oración fuera del audio`);
      for (const w of o.palabras.filter((x) => /[A-Za-z0-9]/.test(x.w))) {
        assert.equal(typeof w.t0, "number", `"${w.w}" sin tiempo`);
        assert.ok(w.t0 < w.t1, `"${w.w}" (cap ${c}) dura 0`);
        assert.ok(w.t0 >= antes - 0.01, `"${w.w}" (cap ${c} pág ${i + 1}) empieza antes que la anterior`);
        assert.ok(w.t0 >= o.t0 - 0.01 && w.t1 <= o.t1 + 0.01, `"${w.w}" fuera de su oración`);
        antes = w.t1;
      }
    }
  }
});

test("las ilustraciones que dice libro.json existen en las dos medidas", () => {
  const ids = [libro.portada, ...paginas.map(({ p }) => p.ilustracion)].filter(Boolean);
  for (const id of ids) {
    for (const s of ["g", "c"]) assert.ok(existsSync(new URL(`arte/web/${id}-${s}.jpg`, BASE)), `falta arte/web/${id}-${s}.jpg`);
  }
  // Toda ilustración de escenas.json tiene su página (o es la portada)
  const escenas = JSON.parse(readFileSync(new URL("escenas.json", BASE), "utf8")).map((e) => e.id);
  const enPaginas = new Set(paginas.flatMap(({ p }) => [p.ilustracion, p.espera]).filter(Boolean));
  for (const e of escenas) if (e !== "portada") assert.ok(enPaginas.has(e), `${e} no está en ninguna página`);
});

test("las escenas no piden texto en la imagen y adjuntan hojas que existen", () => {
  const escenas = JSON.parse(readFileSync(new URL("escenas.json", BASE), "utf8"));
  const hojas = new Set(readdirSync(new URL("arte/personajes/", BASE)));
  for (const e of escenas) {
    assert.match(e.prompt, /No text, no letters, no words in the image/);
    for (const r of e.referencias) assert.ok(hojas.has(r.split("/").pop()), `${e.id}: falta ${r}`);
  }
});

// ---------- Lógica ----------

test("progreso: valores por omisión y guardar sin perder lo demás", () => {
  const pr = progresoDe(null, "halloween");
  assert.deepEqual(pr, { pos: null, leidos: [], encontrados: [], modo: "leeme", despacio: false, guia: false, todos: false });
  const d0 = { v: 1, libros: { halloween: { encontrados: [1, 2] }, otro: { leidos: [1] } } };
  const d1 = conProgreso(d0, "halloween", { ...progresoDe(d0, "halloween"), leidos: [1] });
  assert.deepEqual(d1.libros.halloween.encontrados, [1, 2]);
  assert.deepEqual(d1.libros.otro, { leidos: [1] });
  assert.equal(progresoDe({ libros: { halloween: { modo: "raro", pos: { c: "x" } } } }, "halloween").modo, "leeme");
});

test("capítulos abiertos: todos sin búsqueda; con búsqueda, los encontrados, leídos, el que lee, o todos si papás", () => {
  const pr = progresoDe({ libros: { halloween: { encontrados: [1, 3] } } }, "halloween");
  assert.equal(BUSQUEDA, true);
  const pr2 = progresoDe({ libros: { halloween: { leidos: [5], pos: { c: 6, p: 2 } } } }, "halloween");
  assert.ok(abierto(libro, pr2, 5, true) && abierto(libro, pr2, 6, true) && !abierto(libro, pr2, 7, true));
  assert.ok(abierto(libro, progresoDe({ libros: { halloween: { todos: true } } }, "halloween"), 9, true));
  assert.ok(abierto(libro, pr, 2, false));
  assert.ok(abierto(libro, pr, 3, true));
  assert.ok(!abierto(libro, pr, 2, true));
  assert.ok(!abierto(libro, pr, 13, false));
});

test("mover entre páginas no se sale del capítulo", () => {
  assert.deepEqual(mover(libro, { c: 1, p: 0 }, 1), { c: 1, p: 1 });
  assert.equal(mover(libro, { c: 1, p: 0 }, -1), null);
  const ult = libro.capitulos[0].paginas.length - 1;
  assert.equal(mover(libro, { c: 1, p: ult }, 1), null);
});

test("dónde seguir: la página guardada, o el primer capítulo abierto sin leer", () => {
  assert.deepEqual(dondeSeguir(libro, progresoDe({ libros: { halloween: { pos: { c: 4, p: 2 } } } }, "halloween"), false), { c: 4, p: 2 });
  assert.deepEqual(dondeSeguir(libro, progresoDe({ libros: { halloween: { leidos: [1, 2] } } }, "halloween"), false), { c: 3, p: 0 });
  const pr = progresoDe({ libros: { halloween: { pos: { c: 5, p: 0 }, encontrados: [1, 2], leidos: [1] } } }, "halloween");
  assert.deepEqual(dondeSeguir(libro, pr, true), { c: 5, p: 0 }, "el que está leyendo sigue abierto");
  const pr3 = progresoDe({ libros: { halloween: { encontrados: [1, 2], leidos: [1] } } }, "halloween");
  assert.deepEqual(dondeSeguir(libro, pr3, true), { c: 2, p: 0 });
  assert.equal(dondeSeguir(libro, progresoDe(null, "halloween"), true), null);
});

test("qué palabra suena: la última que empezó, y nada en una pausa larga", () => {
  const lista = [{ t0: 0.5, t1: 0.8 }, { t0: 0.85, t1: 1.2 }, { t0: 2.5, t1: 2.9 }];
  assert.equal(palabraEn(lista, 0.2), -1);
  assert.equal(palabraEn(lista, 0.6), 0);
  assert.equal(palabraEn(lista, 0.82), 0);
  assert.equal(palabraEn(lista, 1.0), 1);
  assert.equal(palabraEn(lista, 1.5), 1);
  assert.equal(palabraEn(lista, 2.0), -1);
  assert.equal(palabraEn(lista, 3.0), 2);
  assert.equal(palabraEn(lista, 9), -1);
  const real = palabrasConTiempo(libro.capitulos[0].paginas[0]);
  assert.ok(real.length > 50);
  const mitad = real[20];
  assert.equal(palabraEn(real, (mitad.t0 + mitad.t1) / 2), 20);
});

test("marcar leído no repite y ordena", () => {
  const pr = progresoDe({ libros: { halloween: { leidos: [3, 1] } } }, "halloween");
  assert.deepEqual(marcarLeido(pr, 2), [1, 2, 3]);
  assert.equal(marcarLeido(pr, 3), pr.leidos);
});

test("el juego no usa localStorage directo, ni await al nivel del módulo, ni ?.", () => {
  for (const f of ["../src/juego.js", "../src/libro.js"]) {
    const js = readFileSync(new URL(f, import.meta.url), "utf8");
    assert.ok(!/localStorage/.test(js), `${f}: localStorage`);
    assert.ok(!/^\s*(const|let|var)?[^\n(]*\bawait\b/m.test(js.replace(/async[\s\S]*?\n\}/g, "")), `${f}: await al nivel del módulo`);
    assert.ok(!/\?\./.test(js), `${f}: ?. no corre en las TVs viejas`);
  }
});
