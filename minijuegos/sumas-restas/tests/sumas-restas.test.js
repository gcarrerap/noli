// Pruebas de "Sumas y restas": niveles, opciones con errores típicos, progreso (dominio, repaso, fallos),
// reto del día y racha. Todo es lógica pura con azar con semilla.
import { test } from "node:test";
import assert from "node:assert/strict";
import { NIVELES, TIPOS, respuesta } from "../src/niveles.js";
import { opciones, erroresTipicos } from "../src/generar.js";
import { rngConSemilla } from "../src/rng.js";
import { nuevo, cargar, registrar, dominio, cerrarRonda, armarRonda, cumplirReto, racha, semana, sumarDias, resumen } from "../src/progreso.js";
import { retoDelDia, problemaConPalabras } from "../src/reto.js";
import { pista } from "../src/dibujos.js";

const u = (n) => n % 10, d = (n) => Math.floor(n / 10);
const muchos = (gen, rnd, n = 500) => Array.from({ length: n }, () => gen(rnd));
const HOY = "2026-10-08";

// ---------- Niveles ----------

test("cada nivel da problemas válidos: sin negativos, cuentas correctas y dentro de su rango", () => {
  const rnd = rngConSemilla(1);
  for (const nv of NIVELES) for (const p of muchos(nv.gen, rnd)) {
    assert.equal(p.op === "+" ? p.a + p.b : p.a - p.b, p.r, `nivel ${nv.n}: ${JSON.stringify(p)}`);
    assert.ok(p.a >= 0 && p.b >= 1 && p.r >= 0, `nivel ${nv.n}: ${JSON.stringify(p)}`);
    const max = nv.n <= 6 ? 20 : 100;
    assert.ok(Math.max(p.a, p.b, p.r) <= max, `nivel ${nv.n} se pasa de ${max}: ${JSON.stringify(p)}`);
    assert.equal(nv.faltante ? p.falta !== "r" : p.falta === "r", true, `nivel ${nv.n}`);
  }
});

test("los niveles 1 y 2 se quedan en 10; el 3 y el 4 pasan el 10 la mayoría de las veces", () => {
  const rnd = rngConSemilla(2);
  for (const p of muchos(NIVELES[0].gen, rnd)) assert.ok(p.r <= 10 && p.op === "+");
  for (const p of muchos(NIVELES[1].gen, rnd)) assert.ok(p.a <= 10 && p.op === "-");
  for (const p of muchos(TIPOS.sumaPasa10, rnd)) assert.ok(p.a < 10 && p.b < 10 && p.r > 10, JSON.stringify(p));
  for (const p of muchos(TIPOS.restaPasa10, rnd)) assert.ok(p.a > 10 && p.r < 10 && u(p.a) < p.b, JSON.stringify(p));
});

test("nivel 7 y 8 nunca llevan ni piden prestado; nivel 9 siempre lleva y nivel 10 siempre pide prestado", () => {
  const rnd = rngConSemilla(3);
  for (const p of muchos(NIVELES[6].gen, rnd)) assert.ok(p.op === "+" && u(p.a) + u(p.b) < 10, JSON.stringify(p));
  for (const p of muchos(NIVELES[7].gen, rnd)) assert.ok(p.op === "-" && u(p.a) >= u(p.b), JSON.stringify(p));
  for (const p of muchos(NIVELES[8].gen, rnd)) assert.ok(p.op === "+" && u(p.a) + u(p.b) >= 10 && p.r < 100, JSON.stringify(p));
  for (const p of muchos(NIVELES[9].gen, rnd)) assert.ok(p.op === "-" && u(p.a) < u(p.b) && p.a >= 20, JSON.stringify(p));
});

// ---------- Opciones ----------

test("opciones: 4 distintas, una sola correcta, ninguna negativa, en todos los niveles", () => {
  const rnd = rngConSemilla(4);
  for (const nv of NIVELES) for (const p of muchos(nv.gen, rnd, 200)) {
    const ops = opciones(p, rnd);
    assert.equal(ops.length, 4);
    assert.equal(new Set(ops.map((o) => o.valor)).size, 4, JSON.stringify([p, ops]));
    assert.equal(ops.filter((o) => o.correcta).length, 1);
    assert.equal(ops.find((o) => o.correcta).valor, respuesta(p));
    assert.ok(ops.every((o) => o.valor >= 0));
  }
});

test("errores típicos: olvidar llevar, pedir prestado mal y contestar el total en el número que falta", () => {
  const vals = (p) => erroresTipicos(p).map((e) => e.valor);
  assert.ok(vals({ a: 38, op: "+", b: 7, r: 45, falta: "r" }).includes(35));   // olvidó llevar
  assert.ok(vals({ a: 42, op: "-", b: 7, r: 35, falta: "r" }).includes(45));   // 7 − 2 en las unidades
  assert.ok(vals({ a: 53, op: "-", b: 18, r: 35, falta: "r" }).includes(45));  // no le quitó 1 a las decenas
  assert.ok(vals({ a: 8, op: "+", b: 6, r: 14, falta: "a" }).includes(14));    // □ + 6 = 14 → contestó el total
  assert.ok(vals({ a: 23, op: "+", b: 5, r: 28, falta: "r" }).includes(73));   // sumó a las decenas
  // En sumas de un dígito no se habla de "llevar"
  assert.ok(!erroresTipicos({ a: 8, op: "+", b: 5, r: 13, falta: "r" }).some((e) => /llevar/.test(e.motivo)));
});

// ---------- Progreso ----------

const p1 = { a: 3, op: "+", b: 4, r: 7, falta: "r" };
function jugar(pr, n, cuantos, { mal = 0, seg = 2 } = {}) {
  for (let i = 0; i < cuantos; i++) pr = registrar(pr, n, { ...p1, a: i % 6 }, i >= mal, seg, HOY);
  return pr;
}

test("dominio: sube con 18 de 20 rápido; no con 17 de 20, ni con 18 de 20 lento, ni con menos de 20", () => {
  assert.equal(dominio(jugar(nuevo(), 1, 20, { mal: 2 }), 1).listo, true);
  assert.equal(dominio(jugar(nuevo(), 1, 20, { mal: 3 }), 1).listo, false);
  assert.equal(dominio(jugar(nuevo(), 1, 20, { mal: 2, seg: 9 }), 1).listo, false); // límite del nivel 1: 5 s
  assert.equal(dominio(jugar(nuevo(), 1, 19), 1).listo, false);
  // Cuentan los últimos 20: errores viejos ya no pesan
  assert.equal(dominio(jugar(jugar(nuevo(), 1, 10, { mal: 10 }), 1, 20), 1).listo, true);
  // Un problema de 5 minutos (se distrajo) cuenta como 60 s
  assert.equal(registrar(nuevo(), 1, p1, true, 300, HOY).niveles[1].ultimos[0][1], 60);
});

test("cerrarRonda: desbloquea el siguiente nivel una sola vez y guarda la mejor ronda", () => {
  let pr = jugar(nuevo(), 1, 20);
  let r = cerrarRonda(pr, 1, 10);
  assert.equal(r.subio, 2); assert.equal(r.pr.nivel, 2); assert.equal(r.estrellas, 3);
  assert.equal(r.pr.niveles[1].dominado, true);
  r = cerrarRonda(r.pr, 1, 6);
  assert.equal(r.subio, null); assert.equal(r.pr.nivel, 2); assert.equal(r.pr.niveles[1].estrellas, 3);
  // Sin dominio no sube
  assert.equal(cerrarRonda(jugar(nuevo(), 1, 20, { mal: 5 }), 1, 10).subio, null);
  // El último nivel no sube más allá
  pr = { ...jugar(nuevo(), 12, 20, { seg: 3 }), nivel: 12 };
  assert.equal(cerrarRonda(pr, 12, 10).pr.nivel, 12);
});

test("fallos: el que falla regresa en la ronda; sale después de 2 veces bien seguidas", () => {
  const malo = { a: 8, op: "+", b: 5, r: 13, falta: "r" };
  let pr = registrar({ ...nuevo(), nivel: 3 }, 3, malo, false, 4, HOY);
  assert.ok(pr.fallos["8+5"]);
  const ronda = armarRonda(pr, 3, rngConSemilla(5));
  assert.equal(ronda.length, 10);
  assert.ok(ronda.some((x) => x.tipo === "fallo" && x.p.a === 8 && x.p.b === 5));
  assert.equal(new Set(ronda.map((x) => `${x.p.a}${x.p.op}${x.p.b}`)).size, 10, "sin repetidos");
  pr = registrar(pr, 3, malo, true, 3, HOY); assert.ok(pr.fallos["8+5"]);
  pr = registrar(pr, 3, malo, true, 3, HOY); assert.equal(pr.fallos["8+5"], undefined);
});

test("armarRonda: incluye repaso de niveles dominados y no de niveles más altos", () => {
  let pr = { ...nuevo(), nivel: 4, niveles: { 1: { ultimos: [], total: 0, aciertos: 0, dominado: true, estrellas: 3, rondas: 1 } } };
  pr = registrar(pr, 9, { a: 38, op: "+", b: 7, r: 45, falta: "r" }, false, 5, HOY); // fallo de un nivel más alto
  const ronda = armarRonda(pr, 4, rngConSemilla(6));
  assert.equal(ronda.filter((x) => x.tipo === "repaso").length, 2);
  assert.ok(ronda.every((x) => x.n <= 4));
});

test("cargar: datos vacíos, rotos o de otra versión empiezan de cero", () => {
  assert.deepEqual(cargar(null), nuevo());
  assert.deepEqual(cargar("x"), nuevo());
  assert.deepEqual(cargar({ v: 99 }), nuevo());
  assert.equal(cargar({ v: 1, nivel: 40 }).nivel, 12);
});

// ---------- Reto y racha ----------

test("reto del día: misma fecha → mismo reto; rota entre los tres tipos", () => {
  assert.deepEqual(retoDelDia(HOY, 5), retoDelDia(HOY, 5));
  const tipos = new Set([0, 1, 2].map((i) => retoDelDia(sumarDias(HOY, i), 5).tipo));
  assert.deepEqual([...tipos].sort(), ["contrarreloj", "palabras", "sinErrores"]);
  // Usa el nivel anterior al actual (lo que ya practicó)
  assert.equal(retoDelDia(HOY, 5).n, 4);
  assert.equal(retoDelDia(HOY, 1).n, 1);
});

test("problemas con palabras: el texto trae los números y nunca es de número que falta", () => {
  const rnd = rngConSemilla(7);
  for (const n of [1, 5, 6, 10, 12]) for (let i = 0; i < 50; i++) {
    const w = problemaConPalabras(rnd, n);
    assert.equal(w.p.falta, "r");
    assert.ok(w.texto.includes(String(w.p.b)) && w.texto.includes(String(w.p.a)), w.texto);
    assert.ok(!/ 1 (canicas|galletas|globos|libros)/.test(w.texto), w.texto); // singular con 1
  }
});

test("racha: cuenta días seguidos con el reto cumplido; hoy pendiente no la rompe; un día sin reto sí", () => {
  let pr = nuevo();
  for (const f of ["2026-10-05", "2026-10-06", "2026-10-07"]) pr = cumplirReto(pr, f, "palabras", 5, true);
  assert.equal(racha(pr, HOY), 3);                       // hoy todavía no
  pr = cumplirReto(pr, HOY, "contrarreloj", 3, false);
  assert.equal(racha(pr, HOY), 3);                       // intentó pero no cumplió: la de ayer sigue
  pr = cumplirReto(pr, HOY, "contrarreloj", 9, true);
  assert.equal(racha(pr, HOY), 4);
  assert.equal(racha(pr, "2026-10-10"), 0);              // faltó el 9
  // Un mejor intento no borra lo cumplido
  assert.equal(cumplirReto(pr, HOY, "contrarreloj", 1, false).retos[HOY].cumplido, true);
  assert.equal(semana(pr, HOY).filter((d) => d.reto).length, 4);
  assert.equal(semana(pr, HOY)[6].fecha, HOY);
});

test("resumen para papás y pista dibujada para cada nivel", () => {
  const pr = jugar(nuevo(), 1, 20, { mal: 4 });
  const R = resumen(pr);
  assert.equal(R.niveles[0].pct, 80);
  assert.equal(R.dias[0].problemas, 20);
  const rnd = rngConSemilla(8);
  for (const nv of NIVELES) for (const p of muchos(nv.gen, rnd, 30)) {
    const s = pista(p, nv.ayuda);
    assert.match(s, /^<svg/); assert.doesNotMatch(s, /NaN|undefined/);
  }
});
