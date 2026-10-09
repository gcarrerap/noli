// Pruebas de "Spelling": listas y frases, faltas típicas y opciones, letras para armar, diferencias,
// progreso del dictado (dominio, ronda, fallos), prueba de nivel, reto del día, racha y elección de voz. Todo es lógica pura.
import { test } from "node:test";
import assert from "node:assert/strict";
import { LISTAS, ETAPAS, PASOS, paso, pasoDe, buscar, conHueco, partir } from "../src/palabras.js";
import { faltas, opciones, letrasParaArmar, diferencias, igual, esReal } from "../src/faltas.js";
import { rngConSemilla } from "../src/rng.js";
import { nuevo, cargar, registrar, dominio, cerrarRonda, armarRonda, colocar, cumplirReto, racha, semana, resumen, sumarDias, elegida, VENTANA, NECESITA } from "../src/progreso.js";
import { empezarPrueba, responderPrueba, palabraActual } from "../src/nivelacion.js";
import { retoDelDia, alcance } from "../src/reto.js";
import { escogerVoz, ordenarVoces, letraPorLetra } from "../src/voz.js";
import { BANCO, SONIDOS, NIVELES, buscarCh, resaltar, chDe, registrarCh, pctCh, cerrarRondaCh, armarRondaCh, ponerNivelCh } from "../src/ch.js";
import fs from "node:fs";

const HOY = "2026-10-08";
const todas = LISTAS.flatMap((l) => l.palabras);

// ---------- Listas ----------

test("16 listas de 12 palabras, sin repetir ninguna, y cada frase usa su palabra", () => {
  assert.equal(LISTAS.length, 16);
  const vistas = new Set();
  for (const l of LISTAS) {
    assert.equal(l.palabras.length, 12, `lista ${l.n}`);
    for (const { palabra, frase } of l.palabras) {
      assert.ok(!vistas.has(palabra.toLowerCase()), `repetida: ${palabra}`);
      vistas.add(palabra.toLowerCase());
      assert.match(palabra, /^[A-Za-z]+$/);
      assert.ok(new RegExp(`\\b${palabra}\\b`, "i").test(frase), `${palabra}: "${frase}"`);
      assert.ok(frase.split(" ").length <= 12, `frase larga: ${frase}`);
    }
  }
});

test("las palabras se alargan de lista en lista", () => {
  const prom = (l) => l.palabras.reduce((s, p) => s + p.palabra.length, 0) / l.palabras.length;
  assert.ok(prom(LISTAS[0]) <= 3.1);
  assert.ok(prom(LISTAS[15]) > prom(LISTAS[11]) && prom(LISTAS[11]) > prom(LISTAS[3]));
});

test("pasos: tres etapas por lista, en orden escoge → arma → escribe", () => {
  assert.equal(PASOS, 48);
  assert.deepEqual([paso(0).lista, paso(0).etapa.id], [1, "escoge"]);
  assert.deepEqual([paso(2).lista, paso(2).etapa.id], [1, "escribe"]);
  assert.deepEqual([paso(3).lista, paso(3).etapa.id], [2, "escoge"]);
  assert.deepEqual([paso(47).lista, paso(47).etapa.id], [16, "escribe"]);
  assert.equal(pasoDe(5, "arma"), 13);
  assert.equal(paso(99).i, 47);
});

test("la frase con hueco esconde la palabra, y partir encuentra la palabra en la frase", () => {
  assert.equal(conHueco("The cat is asleep on my bed.", "cat"), "The _____ is asleep on my bed.");
  assert.equal(conHueco("Does your dog like to swim?", "does"), "_____ your dog like to swim?");
  for (const { palabra, frase } of todas) {
    assert.ok(!new RegExp(`\\b${palabra}\\b`, "i").test(conHueco(frase, palabra).replace("_____", "")) || frase.match(new RegExp(`\\b${palabra}\\b`, "gi")).length > 1, palabra);
    const ps = partir(frase, palabra);
    assert.equal(ps.filter((x) => x.es).length, 1, frase);
    assert.equal(ps.map((x) => x.antes + x.texto + x.despues).join(" "), frase);
  }
  assert.deepEqual(partir("What time is it?", "time")[1], { antes: "", texto: "time", despues: "", es: true });
  assert.deepEqual(partir("Look at the rainbow!", "rainbow")[3], { antes: "", texto: "rainbow", despues: "!", es: true });
});

// ---------- Faltas y opciones ----------

test("cada palabra tiene al menos dos faltas (tres desde la lista 5, que se juega con 4 opciones), y ninguna es una palabra real ni suena igual", () => {
  for (const { palabra } of todas) {
    const fs = faltas(palabra);
    assert.ok(fs.length >= (buscar(palabra).lista >= 5 ? 3 : 2), `${palabra}: ${fs.map((f) => f.texto)}`);
    for (const f of fs) {
      assert.notEqual(f.texto.toLowerCase(), palabra.toLowerCase());
      assert.ok(!esReal(f.texto), `${palabra} → ${f.texto}`);
      assert.match(f.texto, /^[A-Za-z]+$/);
    }
  }
  const malas = (w) => faltas(w).map((f) => f.texto);
  for (const [w, prohibida] of [["sea", "see"], ["mail", "male"], ["week", "weak"], ["road", "rode"], ["write", "rite"], ["piece", "peace"], ["kite", "kit"], ["ship", "chip"], ["made", "mad"], ["six", "sex"]])
    assert.ok(!malas(w).includes(prohibida), `${w} → ${prohibida}`);
});

test("faltas típicas: e mágica, ee como i, consonante doble, letras mudas, e antes de s", () => {
  const m = (w) => faltas(w).map((f) => f.texto);
  assert.ok(m("cake").includes("cak") && m("cake").includes("caik"));
  assert.ok(m("green").includes("grin") || m("green").includes("gren"));
  assert.ok(m("running").includes("runing"));
  assert.ok(m("rabbit").includes("rabit"));
  assert.ok(!m("knee").includes("nee"), "nee suena igual que knee");
  assert.ok(m("write").includes("wryte") || m("write").includes("wrete"));
  assert.ok(m("stop").includes("estop"));
  assert.ok(m("Wednesday").includes("Wensday"), "mantiene la mayúscula");
});

test("opciones: distintas, una sola correcta, 4 por omisión (o las que se pidan)", () => {
  const rnd = rngConSemilla(1);
  for (const { palabra } of todas) for (const n of buscar(palabra).lista >= 5 ? [3, 4] : [3]) {
    const ops = opciones(palabra, rnd, n);
    assert.equal(ops.length, n, palabra);
    assert.equal(ops.filter((o) => o.correcta).length, 1);
    assert.equal(ops.find((o) => o.correcta).texto, palabra);
    assert.equal(new Set(ops.map((o) => o.texto.toLowerCase())).size, n, `${palabra}: ${ops.map((o) => o.texto)}`);
  }
});

test("letras para armar: todas las de la palabra más las de sobra, y no en orden", () => {
  const rnd = rngConSemilla(2);
  for (const { palabra } of todas) for (const extras of [0, 1, 2]) {
    const ls = letrasParaArmar(palabra, rnd, extras);
    assert.equal(ls.length, palabra.length + extras);
    const resto = [...ls];
    for (const c of palabra.toLowerCase()) { const k = resto.indexOf(c); assert.ok(k >= 0, `${palabra}: ${ls}`); resto.splice(k, 1); }
    if (new Set(palabra.toLowerCase()).size > 1) assert.notEqual(ls.slice(0, palabra.length).join(""), palabra.toLowerCase());
  }
});

test("diferencias: marca solo las letras que faltaron o cambiaron", () => {
  const mal = (w, t) => diferencias(w, t).map((x) => (x.ok ? "." : x.letra)).join("");
  assert.equal(diferencias("running", "runing").filter((x) => !x.ok).length, 1);
  assert.equal(mal("cake", "cake"), "....");
  assert.equal(mal("cake", "kake"), "c...");
  assert.equal(mal("green", "grin"), "..ee.");
  assert.equal(mal("cat", ""), "cat");
  assert.ok(igual("June", " june "));
  assert.ok(!igual("June", "jun"));
});

// ---------- Progreso (dictado) ----------

const responder = (pr, n, oks) => oks.reduce((p, ok) => registrar(p, n, "cat", !!ok, HOY), pr);
const veinte = (malas) => Array.from({ length: 20 }, (_, k) => (k < malas ? 0 : 1));

test("cargar: datos rotos dan un progreso nuevo; la lista se mantiene en rango; la v1 se convierte", () => {
  assert.deepEqual(cargar(null), nuevo());
  assert.deepEqual(cargar({ v: 99 }), nuevo());
  assert.equal(cargar({ v: 2, lista: 500 }).lista, LISTAS.length);
  assert.equal(cargar({ v: 2, lista: 3, elegida: 9 }).elegida, 3);
  assert.equal(elegida({ ...nuevo(), lista: 5, elegida: 2 }), 2);
  assert.equal(elegida({ ...nuevo(), lista: 5 }), 5);
  // v1: iba en el paso 7 (lista 3, arma) con una palabra fallada y un reto cumplido
  const v1 = { v: 1, paso: 7, pasos: {}, palabras: { cat: { total: 2, aciertos: 1 } }, fallos: { cat: { lista: 1, veces: 1, seguidos: 0 } }, dias: {}, retos: { [HOY]: { tipo: "abeja", cumplido: true, puntos: 7 } } };
  const c = cargar(v1);
  assert.equal(c.v, 2);
  assert.equal(c.lista, 3);
  assert.equal(c.nivelado, false, "se le ofrece la prueba de nivel");
  assert.ok(c.fallos.cat && c.retos[HOY].cumplido);
});

test("dominio del dictado: pasa con 18 de las últimas 20 y no con 17 ni con menos de 20", () => {
  assert.equal(dominio(responder(nuevo(), 1, veinte(2)), 1).listo, true);
  assert.equal(dominio(responder(nuevo(), 1, veinte(3)), 1).listo, false);
  assert.equal(dominio(responder(nuevo(), 1, Array(19).fill(1)), 1).listo, false);
  // Solo cuentan las últimas 20
  assert.equal(dominio(responder(nuevo(), 1, [...Array(10).fill(0), ...veinte(0)]), 1).listo, true);
  assert.deepEqual([VENTANA, NECESITA], [20, 18]);
});

test("cerrar ronda: al dominar abre la lista siguiente (y la deja escogida); repasar una vieja no abre nada", () => {
  let pr = responder(nuevo(), 1, veinte(0));
  const r = cerrarRonda(pr, 1, 10);
  assert.deepEqual([r.subio, r.pr.lista, r.pr.elegida, r.estrellas, r.pr.listas[1].dominada], [2, 2, 2, 3, true]);
  pr = responder(r.pr, 1, veinte(0));
  assert.equal(cerrarRonda(pr, 1, 10).subio, null);
  pr = responder({ ...nuevo(), lista: 16 }, 16, veinte(0));
  const fin = cerrarRonda(pr, 16, 10);
  assert.equal(fin.subio, null);
  assert.equal(fin.pr.listas[16].dominada, true);
});

test("la práctica y los retos (lista null) cuentan para las palabras pero no para pasar la lista", () => {
  const r = registrar(nuevo(), null, "cake", false, HOY);
  assert.deepEqual(r.listas, {});
  assert.equal(r.fallos.cake.lista, 5);
  assert.deepEqual(r.dias[HOY], { palabras: 1, aciertos: 0, reto: false });
});

test("fallos: la palabra fallada se va con 2 bien seguidas", () => {
  let pr = registrar(nuevo(), 1, "cat", false, HOY);
  assert.equal(pr.fallos.cat.veces, 1);
  pr = registrar(pr, 1, "cat", true, HOY);
  assert.ok(pr.fallos.cat);
  pr = registrar(pr, 1, "cat", true, HOY);
  assert.equal(pr.fallos.cat, undefined);
  assert.deepEqual(pr.palabras.cat, { total: 3, aciertos: 2 });
});

test("armar ronda: 10 palabras sin repetir; primero las falladas, repaso de las 3 listas anteriores y el resto de la lista", () => {
  const rnd = rngConSemilla(3);
  let pr = { ...nuevo(), lista: 6 };
  pr = registrar(pr, null, "pig", false, HOY);
  pr = registrar(pr, null, "Wednesday", false, HOY);   // de una lista que todavía no ve: no sale
  const r = armarRonda(pr, 6, rnd);
  assert.equal(r.length, 10);
  assert.equal(new Set(r.map((x) => x.palabra)).size, 10);
  assert.ok(r.some((x) => x.palabra === "pig" && x.tipo === "fallo"));
  assert.ok(!r.some((x) => x.palabra === "Wednesday"));
  const repaso = r.filter((x) => x.tipo === "repaso");
  assert.equal(repaso.length, 2);
  assert.ok(repaso.every((x) => x.lista >= 3 && x.lista < 6));
  assert.ok(r.filter((x) => x.tipo === "nueva").every((x) => x.lista === 6));
  assert.ok(armarRonda(nuevo(), 1, rnd).every((x) => x.lista === 1));
});

// ---------- Prueba de nivel ----------

// Simula a una niña que escribe bien todas las palabras de las listas < sabe, y mal las demás
function nivelar(sabe, semilla = 1) {
  const rnd = rngConSemilla(semilla);
  let e = empezarPrueba(rnd), n = 0;
  while (!e.fin && n++ < 100) e = responderPrueba(e, palabraActual(e).lista < sabe, rnd);
  return e;
}

test("prueba de nivel: empieza en la primera lista que no sabe, con pocas palabras", () => {
  for (let sabe = 1; sabe <= 16; sabe++) {
    const e = nivelar(sabe);
    assert.equal(e.fin, sabe, `sabe hasta la ${sabe - 1}`);
    assert.ok(e.total <= 20, `${e.total} palabras para ${sabe}`);
  }
  // Si sabe todas, empieza en la última
  assert.equal(nivelar(99).fin, 16);
  // Una niña de segundo grado (sabe hasta la 8) termina en unas 12 palabras
  assert.ok(nivelar(9).total <= 12, String(nivelar(9).total));
});

test("prueba de nivel: dicta palabras de la lista que está probando; colocar deja dominadas las de abajo", () => {
  const rnd = rngConSemilla(2);
  const e = empezarPrueba(rnd);
  assert.equal(e.lista, 1);
  assert.equal(e.palabras.length, 2);
  assert.ok(e.palabras.every((p) => p.lista === 1 && p.frase));
  const e2 = responderPrueba(responderPrueba(e, true, rnd), true, rnd);
  assert.equal(e2.lista, 3);
  const pr = colocar(nuevo(), 7);
  assert.equal(pr.lista, 7);
  assert.equal(pr.nivelado, true);
  assert.ok([1, 2, 3, 4, 5, 6].every((n) => pr.listas[n].dominada && pr.listas[n].porPrueba));
  assert.equal(pr.listas[7], undefined);
});

// ---------- Reto del día y racha ----------

test("reto del día: la misma fecha da el mismo reto; rota entre los tres tipos", () => {
  assert.deepEqual(retoDelDia(HOY, 6), retoDelDia(HOY, 6));
  const tipos = new Set([0, 1, 2].map((k) => retoDelDia(sumarDias(HOY, k), 6).tipo));
  assert.deepEqual([...tipos].sort(), ["abeja", "contrarreloj", "detective"]);
});

test("reto del día: palabras de las 3 listas más recientes; el spelling bee siempre es dictado", () => {
  assert.deepEqual(alcance(1), { hasta: 1, desde: 1 });
  assert.deepEqual(alcance(6), { hasta: 6, desde: 4 });
  for (let k = 0; k < 9; k++) {
    const r = retoDelDia(sumarDias(HOY, k), 6);
    const ps = r.palabras || r.frases;
    assert.ok(ps.every((p) => p.lista >= 4 && p.lista <= 6), r.tipo);
    if (r.tipo === "abeja") { assert.equal(r.palabras.length, 8); assert.equal(r.modo, "escribe"); }
    if (r.tipo === "detective") for (const f of r.frases) { assert.notEqual(f.falta.toLowerCase(), f.palabra.toLowerCase()); assert.ok(!esReal(f.falta)); }
    if (r.tipo === "contrarreloj") assert.ok(r.palabras.length >= 40);
  }
});

test("racha: días seguidos con el reto cumplido; se rompe si falta un día; la de ayer sigue viva hoy", () => {
  let pr = nuevo();
  for (const k of [-3, -2, -1]) pr = cumplirReto(pr, sumarDias(HOY, k), "abeja", 7, true);
  assert.equal(racha(pr, HOY), 3);
  pr = cumplirReto(pr, HOY, "abeja", 7, true);
  assert.equal(racha(pr, HOY), 4);
  assert.equal(racha(pr, sumarDias(HOY, 2)), 0);
  assert.equal(cumplirReto(pr, HOY, "abeja", 2, false).retos[HOY].cumplido, true);
  assert.equal(semana(pr, HOY).filter((d) => d.reto).length, 4);
});

test("resumen para papás", () => {
  let pr = colocar(nuevo(), 3);
  pr = registrar(pr, 3, "ship", false, HOY);
  pr = registrar(pr, 3, "ship", false, HOY);
  pr = registrar(pr, 3, "fish", true, HOY);
  const R = resumen(pr);
  assert.equal(R.listas.length, 16);
  assert.deepEqual(R.listas[2], { n: 3, nombre: LISTAS[2].nombre, total: 3, pct: 33, recientes: "1/3", dominada: false, porPrueba: false, abierta: true });
  assert.equal(R.listas[0].porPrueba, true);
  assert.equal(R.listas[3].abierta, false);
  assert.deepEqual(R.fallos[0], { palabra: "ship", veces: 2 });
});

// ---------- Voz ----------

test("grabaciones: cada palabra tiene su audio (normal, despacio y frase), las 26 letras y la prueba", () => {
  const hay = (r) => fs.existsSync(new URL(`../audio/${r}.mp3`, import.meta.url));
  const faltan = [];
  for (const { palabra } of [...todas, ...BANCO]) for (const d of ["p", "d", "f"]) if (!hay(`${d}/${palabra.toLowerCase()}`)) faltan.push(`${d}/${palabra}`);
  for (const c of "abcdefghijklmnopqrstuvwxyz") if (!hay(`l/${c}`)) faltan.push(`l/${c}`);
  if (!hay("prueba")) faltan.push("prueba");
  assert.deepEqual(faltan, [], "graba lo que falta con: python3 minijuegos/spelling/herramientas/grabar.py --voz …");
});

test("voz: prefiere inglés de EE. UU. y voces conocidas; sin inglés no hay voz", () => {
  const v = (name, lang, localService = true) => ({ name, lang, localService });
  assert.equal(escogerVoz([v("Paulina", "es-MX"), v("Daniel", "en-GB"), v("Samantha", "en-US")]).name, "Samantha");
  assert.equal(escogerVoz([v("Paulina", "es-MX"), v("Daniel", "en-GB")]).name, "Daniel");
  assert.equal(escogerVoz([v("Fred", "en-US"), v("Google US English", "en-US", false)]).name, "Google US English");
  // Voces de broma al final; las de red después de las locales del mismo tipo; solo inglés
  assert.deepEqual(ordenarVoces([v("Bubbles", "en-US"), v("Tom", "en-US", false), v("Tom", "en_US"), v("Paulina", "es-MX")]).map((x) => `${x.name}${x.localService ? "" : "*"}`),
    ["Tom", "Tom*", "Bubbles"]);
  assert.equal(escogerVoz([v("Paulina", "es-MX")]), null);
  assert.equal(escogerVoz([]), null);
  assert.equal(letraPorLetra("cake"), "C. A. K. E.");
});

test("ETAPAS: de la más fácil a la más difícil", () => {
  assert.deepEqual(ETAPAS.map((e) => e.id), ["escoge", "arma", "escribe"]);
  assert.ok(buscar("CAKE").lista === 5);
});

// ---------- Sonidos de CH ----------

test("CH: banco amplio, cada palabra con su sonido, nivel y frase; sin repetir ni chocar con las listas", () => {
  assert.ok(BANCO.length >= 120);
  assert.equal(NIVELES, 5);
  const vistas = new Set();
  for (const p of BANCO) {
    const w = p.palabra.toLowerCase();
    assert.ok(!vistas.has(w), `repetida: ${w}`);
    vistas.add(w);
    assert.match(p.palabra, /^[A-Za-z]+$/);
    assert.ok(/ch/i.test(p.palabra), `${p.palabra} no tiene ch`);
    assert.ok(["ch", "k", "sh"].includes(p.sonido), p.palabra);
    assert.ok([1, 2, 3, 4, 5].includes(p.n), `${p.palabra} sin nivel`);
    assert.ok(new RegExp(`\\b${p.palabra}\\b`, "i").test(p.frase), `${p.palabra}: "${p.frase}"`);
    assert.ok(p.frase.split(" ").length <= 12, `frase larga: ${p.frase}`);
    // Si ya está en una lista, su grabación de frase es la misma: la frase debe ser idéntica
    const enLista = buscar(p.palabra);
    if (enLista) assert.equal(enLista.frase, p.frase, `${p.palabra}: la frase difiere de la de la lista`);
  }
  assert.ok(BANCO.filter((p) => p.sonido === "k").length >= 25 && BANCO.filter((p) => p.sonido === "sh").length >= 15);
});

test("CH: los niveles van de lo conocido a lo raro: el 1 tiene palabras de sobra de cada sonido y el 5 las más difíciles", () => {
  for (const s of SONIDOS) {
    // con las palabras del nivel 1 se arma una ronda sola (4 o más de cada sonido)
    assert.ok(BANCO.filter((p) => p.sonido === s.id && p.n === 1).length >= 5, `${s.id} nivel 1`);
    for (let n = 2; n <= 4; n++) assert.ok(BANCO.filter((p) => p.sonido === s.id && p.n === n).length >= 3, `${s.id} nivel ${n}`);
  }
  const largo = (n) => BANCO.filter((p) => p.n === n).reduce((t, p) => t + p.palabra.length, 0) / BANCO.filter((p) => p.n === n).length;
  for (let n = 3; n <= 5; n++) assert.ok(largo(n) > largo(n - 2), `las palabras del nivel ${n} no son más largas que las del ${n - 2}`);
  assert.ok(largo(2) > largo(1) && largo(5) > largo(1) + 2);
  // el nivel 1 son palabras que conoce un niño de 7 años
  for (const w of "chips chair cheese child lunch school Christmas chef machine".split(" ")) assert.equal(buscarCh(w).n, 1, w);
  for (const w of "chimpanzee orchestra architect chandelier archive technique".split(" ")) assert.ok(buscarCh(w).n >= 4, w);
  assert.ok(BANCO.filter((p) => p.n === 1).length >= 25);
});

test("CH: las palabras de la imagen de la maestra están, con el sonido que dice la lección", () => {
  const de = { ch: "chips chest child rich such chick", k: "mechanic character chemist school Christmas scheme architect",
    sh: "chef machine parachute chauffeur chic champagne" };
  for (const [sonido, ws] of Object.entries(de)) for (const w of ws.split(" ")) assert.equal(buscarCh(w)?.sonido, sonido, w);
  for (const s of SONIDOS) for (const e of s.ejemplos) assert.equal(buscarCh(e)?.sonido, s.id, `ejemplo ${e}`);
});

test("CH: sin homófonos conocidos en el banco (escucharla no debe ser ambiguo)", () => {
  const malas = ["chews", "choose", "chute", "chord", "cord", "which", "witch", "beech", "cheep", "chili", "chilly", "choir", "avalanche"];
  for (const w of malas) assert.equal(buscarCh(w), null, w);
});

test("CH: resaltar parte la palabra marcando las ch", () => {
  assert.deepEqual(resaltar("school"), [{ texto: "s", ch: false }, { texto: "ch", ch: true }, { texto: "ool", ch: false }]);
  assert.deepEqual(resaltar("Chicago").map((t) => t.texto), ["Ch", "icago"]);
  assert.deepEqual(resaltar("church").filter((t) => t.ch).length, 2);
  assert.equal(resaltar("chef").map((t) => t.texto).join(""), "chef");
});

test("CH: progreso por sonido y modo; datos rotos, ausentes o de la versión anterior dan valores seguros (nivel 1)", () => {
  assert.deepEqual(chDe(undefined).niveles, { sonido: 1, escribe: 1 });
  assert.deepEqual(chDe({ ch: { nivel: 3, niveles: { sonido: 99, escribe: -3 }, stats: "mal" } }).niveles, { sonido: 5, escribe: 1 });
  assert.deepEqual(chDe({ ch: { nivel: 3 } }).niveles, { sonido: 1, escribe: 1 });   // el "nivel" de antes ya no cuenta
  let pr = nuevo();
  pr = registrarCh(pr, "sonido", "k", true);
  pr = registrarCh(pr, "sonido", "k", false);
  pr = registrarCh(pr, "escribe", "sh", false);
  assert.equal(pctCh(pr, "sonido", "k"), 50);
  assert.equal(pctCh(pr, "escribe", "sh"), 0);
  assert.equal(pctCh(pr, "escribe", "k"), null);
  assert.equal(chDe(pr).stats.sonido.k.t, 2);
  assert.equal(Object.keys(pr.listas).length, 0);      // no toca las listas
  assert.equal(cargar(JSON.parse(JSON.stringify(pr))).ch.stats.sonido.k.a, 1);   // se guarda y se recupera
});

test("CH: cada juego tiene su nivel: sube con 8 de 10, baja con 4 o menos, de 1 a 5", () => {
  let r = cerrarRondaCh(nuevo(), "escribe", 9);
  assert.deepEqual([r.nivel, r.cambio, r.estrellas], [2, 1, 2]);
  assert.deepEqual(chDe(r.pr).niveles, { sonido: 1, escribe: 2 });     // el otro juego no cambia
  r = cerrarRondaCh(r.pr, "escribe", 7);
  assert.deepEqual([r.nivel, r.cambio], [2, 0]);
  r = cerrarRondaCh(r.pr, "escribe", 3);
  assert.deepEqual([r.nivel, r.cambio], [1, -1]);
  r = cerrarRondaCh(r.pr, "escribe", 0);
  assert.deepEqual([r.nivel, r.cambio], [1, 0]);                       // nunca baja de 1
  let pr = nuevo();
  for (let i = 0; i < 7; i++) pr = cerrarRondaCh(pr, "sonido", 10).pr;
  assert.equal(chDe(pr).niveles.sonido, 5);                            // tope
  assert.equal(chDe(pr).rondas.sonido, 7);
  assert.equal(chDe(pr).rondas.escribe, 0);
  assert.equal(chDe(pr).estrellas.sonido, 3);
});

test("CH: el nivel también se cambia a mano, dentro de 1 a 5", () => {
  let pr = ponerNivelCh(nuevo(), "escribe", 3);
  assert.equal(chDe(pr).niveles.escribe, 3);
  assert.equal(chDe(ponerNivelCh(pr, "escribe", 0)).niveles.escribe, 1);
  assert.equal(chDe(ponerNivelCh(pr, "escribe", 9)).niveles.escribe, 5);
  assert.equal(chDe(pr).niveles.sonido, 1);
});

test("CH: una ronda trae 10 palabras distintas, de su nivel o más fáciles, con los tres sonidos (4 del más flojo)", () => {
  for (const modo of ["sonido", "escribe"]) for (let nivel = 1; nivel <= 5; nivel++) for (let semilla = 1; semilla <= 20; semilla++) {
    const pr = ponerNivelCh(nuevo(), modo, nivel);
    const r = armarRondaCh(pr, modo, rngConSemilla(semilla));
    assert.equal(r.length, 10);
    assert.equal(new Set(r.map((p) => p.palabra)).size, 10);
    const por = (s) => r.filter((p) => p.sonido === s).length;
    assert.deepEqual([por("ch"), por("k"), por("sh")].sort(), [3, 3, 4], `${modo} nivel ${nivel}`);
    for (const p of r) assert.ok(p.n <= nivel, `${p.palabra} (nivel ${p.n}) en ${modo} nivel ${nivel}`);
  }
  // el sonido que más falla recibe la palabra extra
  let pr = ponerNivelCh(nuevo(), "escribe", 2);
  for (let i = 0; i < 6; i++) pr = registrarCh(pr, "escribe", "sh", false);
  for (const s of ["ch", "k"]) for (let i = 0; i < 6; i++) pr = registrarCh(pr, "escribe", s, true);
  for (let semilla = 1; semilla <= 10; semilla++) assert.equal(armarRondaCh(pr, "escribe", rngConSemilla(semilla)).filter((p) => p.sonido === "sh").length, 4);
});

test("CH: la primera ronda es de palabras fáciles (nivel 1)", () => {
  for (const modo of ["sonido", "escribe"]) for (let semilla = 1; semilla <= 30; semilla++)
    for (const p of armarRondaCh(nuevo(), modo, rngConSemilla(semilla))) assert.equal(p.n, 1, p.palabra);
});

test("CH: las palabras que falló salen más seguido", () => {
  const base = ponerNivelCh(nuevo(), "escribe", 5);
  const con = { ...base, fallos: { mechanic: { lista: 1, veces: 1, seguidos: 0 } } };
  let sin = 0, falla = 0;
  for (let semilla = 1; semilla <= 300; semilla++) {
    sin += armarRondaCh(base, "escribe", rngConSemilla(semilla)).some((p) => p.palabra === "mechanic") ? 1 : 0;
    falla += armarRondaCh(con, "escribe", rngConSemilla(semilla)).some((p) => p.palabra === "mechanic") ? 1 : 0;
  }
  assert.ok(falla > sin * 1.5, `${falla} vs ${sin}`);
});
