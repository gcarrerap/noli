import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { rngConSemilla } from "../src/rng.js";
import { faseDe, edadLuna, SINODICO, crearCalendario, revisarCalendario, calendarioCompleto, crearNoche, mod8, DIAS_CALENDARIO } from "../src/luna.js";
import { validarDatos } from "../src/datos.js";
import { crearMision, armarPregunta, palabrasDelViaje, crearPalabra, estrellasMision, parecidas, ITEMS } from "../src/mision.js";
import { nuevo, cargar, leeTodo, anotarPalabra, cerrarMision, cumplirReto, racha, MAX_REPASO } from "../src/progreso.js";
import { retoDelDia, tipoDelDia, retoFase, retoCumplido, RETOS } from "../src/reto.js";
import { audios } from "../src/audios.js";
import { DIBUJOS, dibujo, svgFase } from "../src/arte.js";
import { pista, GUIAS } from "../src/guia.js";

const leer = (f) => JSON.parse(readFileSync(new URL(f, import.meta.url), "utf8"));
const misiones = leer("../datos/misiones.json");
const vocab = leer("../datos/vocabulario.json");
const defs = misiones.misiones;

// ---------- Datos ----------

test("los datos están completos: misiones, textos, preguntas, palabras y dibujos", () => {
  assert.deepEqual(validarDatos(misiones, vocab, DIBUJOS), []);
  assert.ok(defs.length >= 6);
  for (const m of defs) assert.equal(m.textos.length, 4, `misión ${m.n}: 4 textos para escoger 3`);
});

test("validarDatos encuentra errores", () => {
  const roto = JSON.parse(JSON.stringify(misiones));
  roto.misiones[0].textos[0].pregunta.correcta = 5;
  roto.misiones[0].textos[1].es.pop();
  roto.misiones[1].palabras = ["moon", "unicornio", "rock"];
  roto.misiones[2].textos[1].pregunta.pista = [];
  const errs = validarDatos(roto, vocab, DIBUJOS);
  assert.ok(errs.some((e) => /correcta fuera de rango/.test(e)));
  assert.ok(errs.some((e) => /oración por oración/.test(e)));
  assert.ok(errs.some((e) => /unicornio/.test(e)));
  assert.ok(errs.some((e) => /dice dónde está la respuesta/.test(e)));
});

// Palabras con contenido de una opción (sin artículos ni palabras de relleno), para comparar con el texto.
const RELLENO = new Set("a an the it is are was were to of and or in on at with very about its they them their from for this that be no not there".split(" "));
const palabras = (s) => s.toLowerCase().replace(/'s\b/g, "").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w && !RELLENO.has(w));

test("preguntas de dato: una sola respuesta correcta y está en la oración de la pista", () => {
  for (const m of defs) for (const t of m.textos) {
    const p = t.pregunta;
    if (p.tipo !== "dato") continue;
    const enPista = new Set(p.pista.flatMap((k) => palabras(t.en[k])));
    const buena = palabras(p.opciones[p.correcta].en);
    assert.ok(buena.length && buena.every((w) => enPista.has(w)), `${t.id}: «${p.opciones[p.correcta].en}» no sale en la pista`);
    p.opciones.forEach((o, k) => {
      if (k === p.correcta) return;
      const ws = palabras(o.en);
      assert.ok(!ws.every((w) => enPista.has(w)), `${t.id}: la opción mala «${o.en}» también sale en la pista`);
    });
  }
});

test("preguntas de idea principal: la buena nombra lo que repite el texto y las malas no", () => {
  for (const m of defs) for (const t of m.textos) {
    const p = t.pregunta;
    if (p.tipo !== "idea") continue;
    const cuenta = (ws) => ws.filter((w) => t.en.filter((s) => palabras(s).some((x) => x.startsWith(w.slice(0, 5)))).length >= 2).length;
    const buena = cuenta(palabras(p.opciones[p.correcta].en));
    assert.ok(buena >= 1, `${t.id}: la idea principal tiene que nombrar algo que el texto repite`);
    p.opciones.forEach((o, k) => { if (k !== p.correcta) assert.ok(cuenta(palabras(o.en)) < buena, `${t.id}: «${o.en}» compite con la buena`); });
  }
});

test("armarPregunta revuelve las opciones y sigue la correcta", () => {
  for (let s = 0; s < 30; s++) {
    const t = defs[s % defs.length].textos[s % 4];
    const q = armarPregunta(t, rngConSemilla("q" + s));
    assert.equal(q.opciones.length, 3);
    assert.equal(q.opciones[q.buena].en, t.pregunta.opciones[t.pregunta.correcta].en);
    assert.equal(q.opciones.filter((o) => o.k === t.pregunta.correcta).length, 1, "una sola correcta");
  }
});

// ---------- La Luna ----------

test("fase de la Luna en fechas conocidas", () => {
  // Fechas de NASA (fases en UTC); se mira la noche de esa fecha en el centro de EE. UU.
  assert.equal(faseDe("2024-04-08"), 0);   // eclipse total: luna nueva
  assert.equal(faseDe("2024-04-15"), 2);   // cuarto creciente
  assert.equal(faseDe("2024-04-23"), 4);   // luna llena
  assert.equal(faseDe("2024-05-01"), 6);   // cuarto menguante
  assert.equal(faseDe("2025-10-06"), 4);   // luna llena del 7 oct 2025, 3:47 UTC
  assert.equal(faseDe("2025-10-13"), 6);   // cuarto menguante
  assert.equal(faseDe("2025-10-21"), 0);   // luna nueva
  const e = edadLuna(Date.UTC(2000, 0, 6, 18, 14));
  assert.ok(e < 0.01 || e > SINODICO - 0.01);
});

test("fase de la Luna: cada día avanza poco y el ciclo dura un mes", () => {
  let cambios = 0;
  for (let d = 1; d <= 59; d++) {
    const f = (x) => faseDe(`2026-01-${String(x).padStart(2, "0")}`);
    if (d >= 31) break;
    const a = f(d), b = f(d + 1);
    assert.ok(b === a || b === mod8(a + 1), `del ${d} al ${d + 1} de enero: ${a} → ${b}`);
    if (b !== a) cambios++;
  }
  assert.ok(cambios >= 7 && cambios <= 9);
});

test("calendario: la secuencia sigue las fases y la bandeja trae justo las que faltan", () => {
  for (const total of [4, 8]) for (let s = 0; s < 40; s++) {
    const huecos = total === 4 ? 1 + (s % 3) : 1 + (s % 6);
    const c = crearCalendario({ fases: total, huecos }, rngConSemilla(`c${total}-${s}`));
    assert.equal(c.dias.length, total);
    assert.deepEqual(c.dias.map((d) => d.dia), DIAS_CALENDARIO[total]);
    c.dias.forEach((d, i) => { if (i) assert.equal(d.fase, mod8(c.dias[i - 1].fase + (total === 8 ? 1 : 2))); });
    if (total === 4) assert.ok(c.dias.every((d) => d.fase % 2 === 0), "con 4 fases solo las principales");
    assert.equal(c.dias[0].fijo, true, "el primer día siempre trae su luna");
    assert.equal(c.dias.filter((d) => d.fijo).length >= (total === 8 ? 2 : 1), true);
    assert.equal(c.bandeja.length, c.dias.filter((d) => !d.fijo).length);
    assert.deepEqual([...c.bandeja].sort(), c.dias.filter((d) => !d.fijo).map((d) => d.fase).sort());
    // Ponerlas bien: no queda nada mal
    const bien = {};
    c.dias.forEach((d, i) => { if (!d.fijo) bien[i] = d.fase; });
    assert.equal(calendarioCompleto(c, bien), true);
    assert.deepEqual(revisarCalendario(c, bien), []);
    assert.equal(calendarioCompleto(c, {}), false);
  }
});

test("calendario: revisar marca los días mal puestos o vacíos", () => {
  const c = crearCalendario({ fases: 8, huecos: 4 }, rngConSemilla("rev"));
  const huecos = c.dias.map((d, i) => (d.fijo ? -1 : i)).filter((i) => i >= 0);
  const puestas = {};
  huecos.forEach((i) => { puestas[i] = c.dias[i].fase; });
  puestas[huecos[0]] = mod8(c.dias[huecos[0]].fase + 4);
  delete puestas[huecos[1]];
  assert.deepEqual(revisarCalendario(c, puestas), [huecos[0], huecos[1]]);
});

test("¿cómo se verá?: la buena es una o dos semanas después y las opciones no se repiten", () => {
  for (const total of [4, 8]) for (let s = 0; s < 60; s++) {
    const n = crearNoche({ fases: total }, rngConSemilla(`n${total}-${s}`));
    assert.equal(n.correcta, mod8(n.hoy + 2 * n.semanas));
    assert.equal(n.opciones.length, 3);
    assert.equal(new Set(n.opciones).size, 3);
    assert.equal(n.opciones.filter((f) => f === n.correcta).length, 1);
    if (total === 4) { assert.equal(n.semanas, 1); assert.ok(n.opciones.every((f) => f % 2 === 0)); }
  }
});

// ---------- Misión ----------

test("una misión trae 3 textos distintos de los 4, 3 palabras y su actividad de la Luna", () => {
  for (const def of defs) for (let s = 0; s < 10; s++) {
    const m = crearMision(def, vocab, { rnd: rngConSemilla(`m${def.n}-${s}`) });
    assert.equal(m.textos.length, 3);
    assert.equal(new Set(m.textos.map((t) => t.id)).size, 3);
    assert.ok(m.textos.every((t) => def.textos.some((x) => x.id === t.id)));
    assert.deepEqual(m.palabras.map((w) => w.id), def.palabras);
    for (const w of m.palabras) { assert.equal(w.opciones.length, 3); assert.equal(new Set(w.opciones).size, 3); assert.ok(w.opciones.includes(w.id)); }
    assert.equal(m.luna.tipo, def.luna.tipo);
  }
  const a = crearMision(defs[3], vocab, { rnd: rngConSemilla("igual") });
  const b = crearMision(defs[3], vocab, { rnd: rngConSemilla("igual") });
  assert.deepEqual(a, b, "con la misma semilla, la misma misión");
});

test("las palabras que falla regresan en el viaje", () => {
  assert.deepEqual(palabrasDelViaje(defs[0], []), ["moon", "earth", "orbit"]);
  assert.deepEqual(palabrasDelViaje(defs[0], ["crater", "dust"]), ["moon", "earth", "crater"]);
  assert.deepEqual(palabrasDelViaje(defs[0], ["moon", "dust"]), ["moon", "earth", "dust"], "una que ya está no cuenta");
  const m = crearMision(defs[1], vocab, { repaso: ["orbit"], rnd: rngConSemilla("rep") });
  assert.ok(m.palabras.some((w) => w.id === "orbit"));
});

test("las opciones de una palabra nunca traen un dibujo que se le parezca", () => {
  assert.equal(parecidas(vocab, "orbit", "moon"), true);
  assert.equal(parecidas(vocab, "star", "sun"), true);
  for (const p of vocab.palabras) for (let s = 0; s < 30; s++) {
    const w = crearPalabra(p.id, vocab, rngConSemilla(`${p.id}-${s}`));
    assert.equal(w.opciones.length, 3);
    for (const o of w.opciones) if (o !== p.id) assert.equal(parecidas(vocab, p.id, o), false, `${p.id} con ${o}`);
  }
  for (const [a, b] of vocab.parecidas) assert.ok(vocab.palabras.some((p) => p.id === a) && vocab.palabras.some((p) => p.id === b));
});

test("estrellas por aciertos a la primera de 7", () => {
  assert.equal(ITEMS, 7);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map(estrellasMision), [0, 0, 1, 1, 2, 2, 3, 3]);
});

// ---------- Progreso ----------

test("progreso: rocas, repaso, misiones que se abren y voz", () => {
  let pr = nuevo();
  let r = anotarPalabra(pr, "crater", false);
  assert.deepEqual(r.pr.repaso, ["crater"]);
  assert.equal(r.roca, false);
  r = anotarPalabra(r.pr, "crater", true);
  assert.equal(r.roca, true);
  assert.deepEqual(r.pr.repaso, []);
  assert.equal(anotarPalabra(r.pr, "crater", true).roca, false, "la roca llega una vez");
  pr = r.pr;
  for (const w of ["a", "b", "c", "d", "e", "f", "g"]) pr = anotarPalabra(pr, w, false).pr;
  assert.equal(pr.repaso.length, MAX_REPASO);

  let c = cerrarMision(nuevo(), 1, 1, 6);
  assert.equal(c.abrio, null);
  assert.equal(c.foto, true);
  assert.equal(c.pr.abierta, 1);
  c = cerrarMision(c.pr, 1, 2, 6);
  assert.equal(c.abrio, 2);
  assert.equal(c.foto, false);
  assert.equal(c.pr.misiones[1].estrellas, 2);
  assert.equal(c.pr.misiones[1].jugadas, 2);
  assert.equal(cerrarMision({ ...c.pr, abierta: 6 }, 6, 3, 6).abrio, null, "la última no abre nada");

  assert.equal(leeTodo(nuevo(), 1), true);
  assert.equal(leeTodo(nuevo(), 3), false);
  assert.equal(leeTodo({ ...nuevo(), lectura: "siempre" }, 5), true);
  assert.equal(leeTodo({ ...nuevo(), lectura: "pedir" }, 1), false);
  assert.equal(leeTodo({ ...nuevo(), voz: false }, 1), false);
});

test("cargar aguanta datos viejos o rotos", () => {
  assert.deepEqual(cargar(null), nuevo());
  assert.deepEqual(cargar({ v: 2 }), nuevo());
  const p = cargar({ v: 1, abierta: 40, elegida: 0, repaso: ["x", 3], lectura: "raro", misiones: "no" }, 6);
  assert.equal(p.abierta, 6);
  assert.equal(p.elegida, 6);
  assert.deepEqual(p.repaso, ["x"]);
  assert.equal(p.lectura, "auto");
  assert.deepEqual(p.misiones, {});
});

// ---------- Reto del día ----------

test("reto del día: determinista con la misma fecha y de los dos tipos", () => {
  assert.deepEqual(retoDelDia("2026-10-12", vocab), retoDelDia("2026-10-12", vocab));
  const tipos = new Set(Array.from({ length: 30 }, (_, i) => tipoDelDia(`2026-11-${String(i + 1).padStart(2, "0")}`)));
  assert.deepEqual([...tipos].sort(), ["fase", "palabra"]);
});

test("reto «Fase de hoy»: la respuesta es la fase real de esa noche", () => {
  for (let i = 0; i < 60; i++) {
    const d = new Date(2026, 0, 1 + i * 3);
    const fecha = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const items = retoFase(fecha, rngConSemilla("f" + i));
    assert.equal(items.length, RETOS.fase.items);
    const hoy = faseDe(fecha);
    assert.equal(items[0].opciones[items[0].buena], hoy);
    assert.equal(items[2].opciones[items[2].buena], hoy);
    assert.equal(items[1].muestra, hoy);
    for (const it of items) {
      assert.equal(new Set(it.opciones).size, it.opciones.length);
      assert.ok(it.opciones.length >= 2);
    }
  }
});

test("reto «Palabra espacial»: 6 palabras distintas; cumplido con 5", () => {
  const fecha = Array.from({ length: 40 }, (_, i) => `2026-12-${String(i % 28 + 1).padStart(2, "0")}`).find((f) => tipoDelDia(f) === "palabra");
  const r = retoDelDia(fecha, vocab);
  assert.equal(r.items.length, 6);
  assert.equal(new Set(r.items.map((w) => w.id)).size, 6);
  assert.equal(retoCumplido(r, 4), false);
  assert.equal(retoCumplido(r, 5), true);
});

test("racha de retos cumplidos", () => {
  let pr = nuevo();
  pr = cumplirReto(pr, "2026-10-10", "fase", 3, true);
  pr = cumplirReto(pr, "2026-10-11", "palabra", 6, true);
  assert.equal(racha(pr, "2026-10-12"), 2);
  pr = cumplirReto(pr, "2026-10-12", "fase", 1, false);
  assert.equal(racha(pr, "2026-10-12"), 2);
  pr = cumplirReto(pr, "2026-10-12", "fase", 3, true);
  assert.equal(racha(pr, "2026-10-12"), 3);
  assert.equal(cumplirReto(pr, "2026-10-12", "fase", 0, false).retos["2026-10-12"].cumplido, true, "no se pierde lo cumplido");
});

// ---------- Grabaciones, arte y reglas del repo ----------

test("grabaciones completas: cada texto, pregunta, opción, palabra y fase tiene su MP3", () => {
  const lista = audios(misiones, vocab);
  const faltan = lista.filter((a) => !existsSync(new URL(`../audio/${a.archivo}`, import.meta.url))).map((a) => a.archivo);
  assert.deepEqual(faltan, []);
  assert.equal(new Set(lista.map((a) => a.archivo)).size, lista.length);
  assert.ok(existsSync(new URL("../LICENCIAS.md", import.meta.url)));
});

test("arte: una fase por número y un dibujo por palabra; sin emojis en las pantallas", () => {
  for (let f = 0; f < 8; f++) assert.match(svgFase(f), /^<svg[^>]*viewBox/);
  for (const p of vocab.palabras) assert.ok(DIBUJOS.has(p.id), p.id);
  assert.match(dibujo("no-existe"), /^<svg/);
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  for (const f of readdirSync(new URL("../src/", import.meta.url))) {
    const s = readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
    assert.equal(emoji.test(s), false, `${f} tiene un emoji`);
    assert.equal(/^\s*(const|let|var)?[^/\n]*\bawait\b/m.test(s), false, `${f}: sin await (algunas TVs no lo soportan al nivel del módulo)`);
    assert.equal(/localStorage/.test(s), false, `${f}: el progreso va con Noli.guardar`);
  }
});

test("guía: una tarjeta por etapa y pistas para el dedo y para el control", () => {
  for (const k of ["combustible", "viaje", "calendario", "noche"]) assert.ok(GUIAS[k].texto);
  for (const paso of ["leer", "pregunta", "palabra", "calendario", "noche"]) {
    assert.ok(pista(paso));
    assert.ok(pista(paso, { tv: true }));
    assert.match(pista(paso, { tv: true }), /OK|flechas/);
  }
  assert.notEqual(pista("calendario", { tomada: true }), pista("calendario"));
});

test("juego.json: inglés, apto para TV y gana créditos", () => {
  const j = leer("../juego.json");
  assert.equal(j.id, "mision-luna");
  assert.equal(j.materia, "inglés");
  assert.deepEqual(j.edades, [7, 10]);
  assert.deepEqual(j.controles, ["tactil", "flechas", "remoto"]);
  assert.equal(j.tv, true);
  assert.equal(j.creditos, "gana");
  assert.equal(j.icono, "icono.svg");
});
