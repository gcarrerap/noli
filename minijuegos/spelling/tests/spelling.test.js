// Pruebas de "Spelling": listas y frases, faltas típicas y opciones, letras para armar, diferencias,
// progreso (dominio por etapa, ronda, fallos), reto del día, racha y elección de voz. Todo es lógica pura.
import { test } from "node:test";
import assert from "node:assert/strict";
import { LISTAS, ETAPAS, PASOS, paso, pasoDe, buscar, conHueco, partir } from "../src/palabras.js";
import { faltas, opciones, letrasParaArmar, diferencias, igual, esReal } from "../src/faltas.js";
import { rngConSemilla } from "../src/rng.js";
import { nuevo, cargar, registrar, dominio, cerrarRonda, armarRonda, cumplirReto, racha, semana, resumen, sumarDias, elegido } from "../src/progreso.js";
import { retoDelDia, alcance } from "../src/reto.js";
import { escogerVoz, letraPorLetra } from "../src/voz.js";

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

// ---------- Progreso ----------

const responder = (pr, i, oks) => oks.reduce((p, ok, k) => registrar(p, i, "cat", !!ok, sumarDias(HOY, 0)), pr);

test("cargar: datos rotos o viejos dan un progreso nuevo; el paso se mantiene en rango", () => {
  assert.deepEqual(cargar(null), nuevo());
  assert.deepEqual(cargar({ v: 99 }), nuevo());
  assert.equal(cargar({ v: 1, paso: 500 }).paso, PASOS - 1);
  assert.equal(cargar({ v: 1, paso: 3, elegido: 9 }).elegido, 3);
  assert.equal(elegido({ ...nuevo(), paso: 5, elegido: 2 }), 2);
  assert.equal(elegido({ ...nuevo(), paso: 5 }), 5);
});

test("dominio: Escoge pasa con 9 de 10 y no con 8; Escribe pide 18 de 20", () => {
  assert.equal(dominio(responder(nuevo(), 0, [1, 1, 1, 1, 0, 1, 1, 1, 1, 1]), 0).listo, true);
  assert.equal(dominio(responder(nuevo(), 0, [1, 1, 0, 1, 0, 1, 1, 1, 1, 1]), 0).listo, false);
  assert.equal(dominio(responder(nuevo(), 0, [1, 1, 1, 1, 1, 1, 1, 1, 1]), 0).listo, false, "faltan respuestas");
  const veinte = (malas) => Array.from({ length: 20 }, (_, k) => (k < malas ? 0 : 1));
  assert.equal(dominio(responder(nuevo(), 2, veinte(2)), 2).listo, true);
  assert.equal(dominio(responder(nuevo(), 2, veinte(3)), 2).listo, false);
  assert.equal(dominio(responder(nuevo(), 2, veinte(0)), 2).ventana, 20);
});

test("cerrar ronda: al dominar abre el paso siguiente (y lo deja escogido); repasar un paso viejo no abre nada", () => {
  let pr = responder(nuevo(), 0, Array(10).fill(1));
  const r = cerrarRonda(pr, 0, 10);
  assert.equal(r.subio, 1);
  assert.equal(r.pr.paso, 1);
  assert.equal(r.pr.elegido, 1);
  assert.equal(r.estrellas, 3);
  assert.equal(r.pr.pasos[0].dominado, true);
  // Volver a jugar el paso 0 ya dominado no sube otra vez
  pr = responder(r.pr, 0, Array(10).fill(1));
  assert.equal(cerrarRonda(pr, 0, 10).subio, null);
  // El último paso no abre nada más
  pr = { ...nuevo(), paso: PASOS - 1 };
  pr = responder(pr, PASOS - 1, Array(20).fill(1));
  const fin = cerrarRonda(pr, PASOS - 1, 10);
  assert.equal(fin.subio, null);
  assert.equal(fin.pr.pasos[PASOS - 1].dominado, true);
});

test("fallos: la palabra fallada se va con 2 bien seguidas", () => {
  let pr = registrar(nuevo(), 0, "cat", false, HOY);
  assert.equal(pr.fallos.cat.veces, 1);
  pr = registrar(pr, 0, "cat", true, HOY);
  assert.ok(pr.fallos.cat);
  pr = registrar(pr, 0, "cat", true, HOY);
  assert.equal(pr.fallos.cat, undefined);
  assert.deepEqual(pr.palabras.cat, { total: 3, aciertos: 2 });
  assert.deepEqual(pr.dias[HOY], { palabras: 3, aciertos: 2, reto: false });
  // En los retos (paso null) cuenta la palabra pero no el dominio
  const r = registrar(nuevo(), null, "cake", false, HOY);
  assert.deepEqual(r.pasos, {});
  assert.equal(r.fallos.cake.lista, 5);
});

test("armar ronda: 10 palabras sin repetir; primero las falladas, repaso de listas anteriores y el resto de la lista", () => {
  const rnd = rngConSemilla(3);
  let pr = { ...nuevo(), paso: pasoDe(4, "escoge") };
  pr = registrar(pr, 0, "pig", false, HOY);
  pr = registrar(pr, 0, "Wednesday", false, HOY);   // de una lista que todavía no ve: no sale
  const r = armarRonda(pr, pr.paso, rnd);
  assert.equal(r.length, 10);
  assert.equal(new Set(r.map((x) => x.palabra)).size, 10);
  assert.ok(r.some((x) => x.palabra === "pig" && x.tipo === "fallo"));
  assert.ok(!r.some((x) => x.palabra === "Wednesday"));
  assert.equal(r.filter((x) => x.tipo === "repaso").length, 2);
  assert.ok(r.filter((x) => x.tipo === "nueva").every((x) => x.lista === 4));
  // La primera lista no tiene repaso
  const r1 = armarRonda(nuevo(), 0, rnd);
  assert.equal(r1.length, 10);
  assert.ok(r1.every((x) => x.lista === 1));
});

// ---------- Reto del día y racha ----------

test("reto del día: la misma fecha da el mismo reto; rota entre los tres tipos", () => {
  assert.deepEqual(retoDelDia(HOY, 10), retoDelDia(HOY, 10));
  const tipos = new Set([0, 1, 2].map((k) => retoDelDia(sumarDias(HOY, k), 10).tipo));
  assert.deepEqual([...tipos].sort(), ["abeja", "contrarreloj", "detective"]);
});

test("reto del día: usa palabras que ya vio, y el bee se escribe en cuanto llegó a Escribe", () => {
  assert.deepEqual(alcance(0), { hasta: 1, hastaBee: 1, modo: "escoge" });
  assert.deepEqual(alcance(1), { hasta: 1, hastaBee: 1, modo: "arma" });
  assert.deepEqual(alcance(2), { hasta: 1, hastaBee: 1, modo: "escribe" });
  assert.deepEqual(alcance(pasoDe(5, "escoge")), { hasta: 4, hastaBee: 4, modo: "escribe" });
  assert.deepEqual(alcance(pasoDe(5, "arma")), { hasta: 5, hastaBee: 4, modo: "escribe" });
  for (let k = 0; k < 9; k++) {
    const fecha = sumarDias(HOY, k), i = pasoDe(5, "arma"), r = retoDelDia(fecha, i);
    if (r.tipo === "abeja") { assert.equal(r.palabras.length, 8); assert.ok(r.palabras.every((p) => p.lista <= 4 && p.lista >= 2)); }
    if (r.tipo === "detective") {
      assert.equal(r.frases.length, 5);
      for (const f of r.frases) { assert.ok(f.lista <= 5); assert.notEqual(f.falta.toLowerCase(), f.palabra.toLowerCase()); assert.ok(!esReal(f.falta)); }
    }
    if (r.tipo === "contrarreloj") { assert.ok(r.palabras.length >= 40); assert.ok(r.palabras.every((p) => p.lista <= 5 && p.lista >= 2)); }
  }
  // Recién empezando, el reto sale de la lista 1
  for (let k = 0; k < 3; k++) {
    const r = retoDelDia(sumarDias(HOY, k), 0);
    for (const p of r.palabras || r.frases) assert.equal(p.lista, 1);
  }
});

test("racha: días seguidos con el reto cumplido; se rompe si falta un día; la de ayer sigue viva hoy", () => {
  let pr = nuevo();
  for (const k of [-3, -2, -1]) pr = cumplirReto(pr, sumarDias(HOY, k), "abeja", 7, true);
  assert.equal(racha(pr, HOY), 3);
  pr = cumplirReto(pr, HOY, "abeja", 7, true);
  assert.equal(racha(pr, HOY), 4);
  assert.equal(racha(pr, sumarDias(HOY, 2)), 0);
  // Un intento fallido no borra uno cumplido ese mismo día
  assert.equal(cumplirReto(pr, HOY, "abeja", 2, false).retos[HOY].cumplido, true);
  assert.equal(semana(pr, HOY).filter((d) => d.reto).length, 4);
});

test("resumen para papás", () => {
  let pr = registrar(nuevo(), 0, "cat", false, HOY);
  pr = registrar(pr, 0, "cat", false, HOY);
  pr = registrar(pr, 0, "map", true, HOY);
  const R = resumen(pr);
  assert.equal(R.listas.length, 16);
  assert.deepEqual(R.listas[0].etapas[0], { id: "escoge", nombre: "Escoge", total: 3, pct: 33, dominado: false, abierto: true });
  assert.equal(R.listas[0].etapas[1].abierto, false);
  assert.deepEqual(R.fallos[0], { palabra: "cat", veces: 2 });
});

// ---------- Voz ----------

test("voz: prefiere inglés de EE. UU. y voces conocidas; sin inglés no hay voz", () => {
  const v = (name, lang, localService = true) => ({ name, lang, localService });
  assert.equal(escogerVoz([v("Paulina", "es-MX"), v("Daniel", "en-GB"), v("Samantha", "en-US")]).name, "Samantha");
  assert.equal(escogerVoz([v("Paulina", "es-MX"), v("Daniel", "en-GB")]).name, "Daniel");
  assert.equal(escogerVoz([v("Fred", "en-US"), v("Google US English", "en-US", false)]).name, "Google US English");
  assert.equal(escogerVoz([v("Paulina", "es-MX")]), null);
  assert.equal(escogerVoz([]), null);
  assert.equal(letraPorLetra("cake"), "C. A. K. E.");
});

test("ETAPAS: de la más fácil a la más difícil", () => {
  assert.deepEqual(ETAPAS.map((e) => e.id), ["escoge", "arma", "escribe"]);
  assert.ok(buscar("CAKE").lista === 5);
});
