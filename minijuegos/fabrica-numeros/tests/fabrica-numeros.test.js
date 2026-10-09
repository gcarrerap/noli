// Pruebas de la Fábrica de Números: valor que se conserva, niveles, dominio y reto del día.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { rngConSemilla, entre } from "../src/rng.js";
import { C1, C2, grupo } from "../src/bloques.js";
import { enPalabras, desarrollada, esDecenaExactaRegular, esIrregular, enIngles, tieneCero } from "../src/palabras.js";
import {
  vacio, desdeNumero, valor, subir, bajar, pegar, triturar, puedeEnviar, informe, bandaEquivocada,
  FRASE, duracionCanje, guionCanje, estiloCanje, DURACION_CORTA,
} from "../src/valor.js";
import {
  NIVELES, crearPedido, esCorrecto, subetapa, prestamos, secuenciaCruza, ejemploDe,
} from "../src/niveles.js";
import {
  nuevo, cargar, registrar, dominio, cerrarTurno, pedidoPara, planTurno, quiereFacil,
  cumplirReto, racha, semana, sumarDias, marcarIngles, piezasDe, VENTANA, estrellasTurno,
} from "../src/progreso.js";
import { PIEZAS, ciclarRanura, decoNueva, pisosFabrica, piezasDisponibles } from "../src/deco.js";
import { retoDelDia, pistasDe, soluciones, cumplePista } from "../src/reto.js";

const muchos = (n, sub, rnd, k = 200, extra = {}) => Array.from({ length: k }, () => crearPedido(n, rnd, { sub, ...extra }));
const HOY = "2026-10-09";

function llevarDe(a, b) {
  const u = (a % 10) + (b % 10);
  const llevaU = u >= 10 ? 1 : 0;
  const d = Math.floor(a / 10) % 10 + Math.floor(b / 10) % 10 + llevaU;
  const llevaD = d >= 10 ? 1 : 0;
  const c = Math.floor(a / 100) + Math.floor(b / 100) + llevaD;
  return { llevaU, llevaD, llevaC: c >= 10 ? 1 : 0, r: a + b };
}

// ---------- Valor y reagrupamiento ----------

test("el valor de un número armado es el número, de 0 a 1000", () => {
  for (let n = 0; n <= 1000; n += 1) assert.equal(valor(desdeNumero(n)), n);
  assert.deepEqual(desdeNumero(1000), { mil: 1, c: 0, d: 0, u: 0 });
});

test("subir y bajar no dan la vuelta y conservar el valor al deshacer", () => {
  let e = desdeNumero(347);
  const v = valor(e);
  const sube = subir(e, "u");
  assert.equal(sube.accion, "suma");
  assert.equal(valor(sube.estado), v + 1);
  assert.equal(valor(bajar(sube.estado, "u").estado), v);
  const en9 = { mil: 0, c: 3, d: 4, u: 9 };
  const a10 = subir(en9, "u");
  assert.equal(a10.estado.u, 10, "de 9 pasa a 10, no a 0");
  assert.equal(puedeEnviar(a10.estado), false);
  const otra = subir(a10.estado, "u");
  assert.equal(otra.accion, "pegar");
  assert.equal(otra.estado.u, 10);
  const cero = { mil: 0, c: 2, d: 0, u: 0 };
  assert.equal(bajar(cero, "u").accion, "nada");
  assert.equal(bajar({ mil: 0, c: 2, d: 3, u: 0 }, "u").accion, "triturar");
  assert.equal(bajar(cero, "u").estado.u, 0);
});

test("pegar y triturar conservan el valor en cada banda", () => {
  const casos = [
    [{ mil: 0, c: 3, d: 4, u: 10 }, "u"],
    [{ mil: 0, c: 3, d: 10, u: 7 }, "d"],
    [{ mil: 0, c: 10, d: 0, u: 0 }, "c"],
  ];
  for (const [e, banda] of casos) {
    const v = valor(e);
    const p = pegar(e, banda);
    assert.equal(valor(p.estado), v, banda);
    assert.equal(p.frase, FRASE.pegar[banda]);
    assert.equal(puedeEnviar(p.estado) || p.estado.d === 10 || p.estado.c === 10, true);
  }
  assert.equal(FRASE.pegar.d, "10 barras son 1 placa");
  assert.deepEqual(pegar({ mil: 0, c: 3, d: 4, u: 10 }, "u").estado, { mil: 0, c: 3, d: 5, u: 0 });
  assert.deepEqual(pegar({ mil: 0, c: 10, d: 0, u: 0 }, "c").estado, { mil: 1, c: 0, d: 0, u: 0 });
  const mil = desdeNumero(1000);
  const roto = triturar(mil, "c");
  assert.equal(valor(roto.estado), 1000);
  assert.equal(roto.estado.c, 10);
  assert.equal(valor(pegar(roto.estado, "c").estado), 1000);
  const conBarras = desdeNumero(340);
  const diez = triturar(conBarras, "u");
  assert.equal(valor(diez.estado), 340);
  assert.equal(diez.estado.u, 10);
  assert.equal(diez.estado.d, 3);
  assert.equal(valor(pegar(diez.estado, "u").estado), 340);
});

test("el guion del canje cuenta hasta 10 y el segundo canje dura a lo más 600 ms", () => {
  const g = guionCanje("pegar", "d");
  assert.deepEqual(g.cuenta, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(g.frase, "10 barras son 1 placa");
  assert.equal(duracionCanje(true), 2000);
  assert.ok(duracionCanje(false) <= DURACION_CORTA);
  assert.equal(estiloCanje(false), "cae");
  assert.equal(estiloCanje(true), "desvanece");
});

test("informe: faltan y sobran por banda, y la pista señala la banda chica", () => {
  const filas = informe(desdeNumero(329), 347);
  assert.equal(filas.find((f) => f.banda === "d").texto, "faltan 2 barras");
  assert.equal(filas.find((f) => f.banda === "u").texto, "sobran 2 cubitos");
  assert.equal(filas.find((f) => f.banda === "c").ok, true);
  assert.equal(bandaEquivocada(desdeNumero(329), 347), "u");
});

test("grupo copia los colores de sumas-restas", () => {
  assert.equal(C1, "#4cb3ff");
  assert.equal(C2, "#ff6b4a");
  const g = grupo(0, 2, 3, C1);
  assert.match(g.s, /#4cb3ff/);
  assert.match(g.s, /rgba\(0,0,0,\.25\)/);
  assert.doesNotMatch(g.s, /NaN|undefined/);
});

// ---------- Niveles ----------

test("nivel 1 solo hasta 99 y sin cero; nivel 2 hasta 999 sin ceros; nivel 3 siempre con cero", () => {
  const rnd = rngConSemilla(1);
  for (const p of muchos(1, "base", rnd, 300)) {
    assert.equal(p.objetivo, valor(desdeNumero(p.objetivo)));
    assert.ok(p.objetivo >= 11 && p.objetivo <= 99, p.objetivo);
    assert.equal(tieneCero(p.objetivo), false);
    assert.ok(!p.texto.includes("más grande"));
  }
  for (const p of muchos(2, "base", rnd, 300)) {
    const c = Math.floor(p.objetivo / 100), d = Math.floor(p.objetivo / 10) % 10, u = p.objetivo % 10;
    assert.ok(c >= 1 && c <= 9 && d >= 1 && d <= 9 && u >= 1 && u <= 9, p.objetivo);
    assert.equal(tieneCero(p.objetivo), false);
  }
  let interno = 0, mil = 0;
  for (const p of muchos(3, "base", rnd, 300)) {
    assert.equal(tieneCero(p.objetivo), true);
    assert.equal(p.dificil, true);
    assert.ok(p.objetivo <= 1000 && p.objetivo >= 10);
    if (p.objetivo === 1000) mil++;
    const d = Math.floor(p.objetivo / 10) % 10, u = p.objetivo % 10;
    if (d === 0 && u > 0) interno++;
  }
  assert.ok(interno > 20, interno);
  assert.ok(mil > 0, "incluye 1000");
});

test("nivel 4: primero desarrollada, luego decenas exactas, después irregulares", () => {
  const rnd = rngConSemilla(2);
  assert.equal(subetapa(4, 0), "desarrollada");
  assert.equal(subetapa(4, 3), "decenas");
  assert.equal(subetapa(4, 6), "irregulares");
  assert.equal(subetapa(4, 6, true), "decenas");
  for (const p of muchos(4, "desarrollada", rnd)) {
    assert.equal(p.tipo, "desarrollada");
    assert.equal(p.texto, desarrollada(p.objetivo));
    assert.match(p.texto, /\d+ \+ \d+ \+ \d+/);
    assert.equal(tieneCero(p.objetivo), false);
  }
  for (const p of muchos(4, "decenas", rnd)) {
    assert.equal(esDecenaExactaRegular(p.objetivo), true, p.texto);
    assert.equal(esIrregular(p.objetivo), false);
    assert.equal(p.texto, enPalabras(p.objetivo));
    assert.ok(p.leer);
  }
  const vistos = new Set();
  for (const p of muchos(4, "irregulares", rnd, 80)) {
    assert.equal(esIrregular(p.objetivo), true, p.texto);
    assert.equal(p.texto, enPalabras(p.objetivo));
    vistos.add(p.objetivo);
  }
  assert.ok([...vistos].some((n) => n % 100 === 16 || (n % 100 >= 21 && n % 100 <= 29) || [5, 7, 9].includes(Math.floor(n / 100))));
});

test("palabras: dieciséis, veintiuno, quinientos, cien y mil", () => {
  assert.equal(enPalabras(16), "dieciséis");
  assert.equal(enPalabras(21), "veintiuno");
  assert.equal(enPalabras(500), "quinientos");
  assert.equal(enPalabras(700), "setecientos");
  assert.equal(enPalabras(900), "novecientos");
  assert.equal(enPalabras(230), "doscientos treinta");
  assert.equal(enPalabras(347), "trescientos cuarenta y siete");
  assert.equal(enPalabras(100), "cien");
  assert.equal(enPalabras(1000), "mil");
  assert.equal(desarrollada(347), "300 + 40 + 7");
  assert.equal(enIngles(347), "three hundred forty-seven");
  assert.equal(enIngles(16), "sixteen");
});

test("nivel 5: comparar sin 'más grande', y ordenar camiones es una permutación", () => {
  const rnd = rngConSemilla(3);
  const tipos = new Set();
  for (const p of muchos(5, "base", rnd, 300)) {
    assert.equal(/más grande|uno más grande/.test(p.texto), false, p.texto);
    tipos.add(p.tipo);
    if (p.tipo === "mas") assert.equal(p.objetivo, p.referencia + 1);
    if (p.tipo === "menos") assert.equal(p.objetivo, p.referencia - 1);
    if (p.tipo === "mayor") {
      assert.match(p.texto, /mayor que/);
      assert.equal(esCorrecto(p, p.referencia + 1), true);
      assert.equal(esCorrecto(p, p.referencia), false);
    }
    if (p.tipo === "menor") {
      assert.match(p.texto, /menor que/);
      assert.equal(esCorrecto(p, p.referencia - 1), true);
      assert.equal(esCorrecto(p, p.referencia), false);
    }
    if (p.tipo === "ordenar") {
      assert.equal(p.camiones.length, 3);
      assert.equal(new Set(p.camiones).size, 3);
      const orden = [...p.camiones].sort((a, b) => a - b);
      assert.equal(esCorrecto(p, 0, { orden }), true);
      assert.equal(esCorrecto(p, 0, { orden: p.camiones }), false);
    }
  }
  for (const t of ["mas", "menos", "mayor", "menor", "igual", "ordenar"]) assert.ok(tipos.has(t), t);
});

test("nivel 6: los saltos de 10 cruzan una centena y también se cuenta hacia atrás", () => {
  const rnd = rngConSemilla(4);
  let arriba = 0, abajo = 0, cien = 0;
  for (const p of muchos(6, "base", rnd, 300)) {
    assert.equal(p.tipo, "contar");
    const seq = [...p.secuencia, p.objetivo];
    assert.equal(seq.length, 4);
    for (let i = 1; i < seq.length; i++) assert.equal(seq[i] - seq[i - 1], p.paso);
    assert.ok(seq.every((x) => x >= 0 && x <= 1000));
    if (Math.abs(p.paso) === 10) {
      assert.equal(secuenciaCruza(seq), true, seq.join(","));
      if (p.paso > 0) arriba++; else abajo++;
    } else {
      assert.equal(Math.abs(p.paso), 100);
      cien++;
    }
  }
  assert.ok(arriba > 20 && abajo > 20, `arriba ${arriba} abajo ${abajo}`);
  assert.ok(cien > 20, cien);
});

test("nivel 7 y 8: subetapas, sin negativos y sin pasar de 1000", () => {
  const rnd = rngConSemilla(5);
  assert.deepEqual([0, 3, 6].map((b) => subetapa(7, b)), ["sin", "una", "dos"]);
  assert.deepEqual([0, 2, 4, 6].map((b) => subetapa(8, b)), ["sin", "una", "dos", "ceros"]);
  assert.equal(subetapa(8, 6, true), "dos");
  for (const sub of ["sin", "una", "dos"]) for (const p of muchos(7, sub, rnd, 80)) {
    assert.equal(p.tipo, "sumar");
    assert.equal(p.a + p.b, p.objetivo);
    assert.ok(p.objetivo >= 0 && p.objetivo <= 1000, JSON.stringify(p));
    assert.ok(p.a >= 1 && p.b >= 1);
    const L = llevarDe(p.a, p.b);
    if (sub === "sin") assert.equal(L.llevaU + L.llevaD + L.llevaC, 0, JSON.stringify(p));
    if (sub === "una") assert.equal(L.llevaU === 1 && L.llevaD === 0 && L.llevaC === 0, true, JSON.stringify(p));
    if (sub === "dos") assert.equal(L.llevaU === 1 && L.llevaD === 1, true, JSON.stringify(p));
    assert.equal(p.dificil, sub !== "sin");
  }
  for (const sub of ["sin", "una", "dos", "ceros"]) for (const p of muchos(8, sub, rnd, 80)) {
    assert.equal(p.tipo, "restar");
    assert.equal(p.a - p.b, p.objetivo);
    assert.ok(p.objetivo >= 0 && p.a <= 1000 && p.b >= 1, JSON.stringify(p));
    const P = prestamos(p.a, p.b);
    if (sub === "sin") assert.equal(P.n, 0, JSON.stringify(p));
    if (sub === "una") assert.equal(P.unos && !P.decenas && !P.cascada, true, JSON.stringify(p));
    if (sub === "dos") assert.equal(P.unos && P.decenas && !P.cascada && !P.centenas, true, JSON.stringify(p));
    if (sub === "ceros") assert.equal(P.medio, true, JSON.stringify(p));
    assert.equal(p.dificil, sub !== "sin");
  }
  assert.equal(prestamos(400, 128).medio, true);
  assert.equal(prestamos(503, 247).medio, true);
  assert.equal(ejemploDe({ tipo: "mayor", referencia: 20 }), 21);
});

// ---------- Dominio ----------

function jugar(pr, n, cuantos, { mal = 0, dificil = false } = {}) {
  for (let i = 0; i < cuantos; i++) {
    pr = registrar(pr, n, { ok: i >= mal, dificil, banda: "d" }, HOY, 1);
  }
  return pr;
}

test("dominio: 8 de 10 a la primera; el segundo intento no cuenta; 3, 7 y 8 piden 4 difíciles", () => {
  assert.equal(dominio(jugar(nuevo(), 1, 10, { mal: 2 }), 1).listo, true);
  assert.equal(dominio(jugar(nuevo(), 1, 10, { mal: 3 }), 1).listo, false);
  assert.equal(dominio(jugar(nuevo(), 1, 9), 1).listo, false);
  let pr = nuevo();
  pr = registrar(pr, 1, { ok: false, dificil: false, banda: "u" }, HOY, 1);
  const antes = pr.niveles[1].ultimos.length;
  pr = registrar(pr, 1, { ok: true, dificil: false, banda: null }, HOY, 2);
  assert.equal(pr.niveles[1].ultimos.length, antes, "el segundo intento no entra");
  assert.equal(pr.niveles[1].seguidosMal, 1);
  assert.equal(dominio(jugar(nuevo(), 3, 10, { dificil: false }), 3).listo, false);
  assert.equal(dominio(jugar(nuevo(), 3, 10, { mal: 2, dificil: true }), 3).listo, true);
  let mix = nuevo();
  for (let i = 0; i < 10; i++) mix = registrar(mix, 7, { ok: true, dificil: i < 3, banda: null }, HOY, 1);
  assert.equal(dominio(mix, 7).listo, false, "solo 3 reagrupamientos");
  let listo = nuevo();
  for (let i = 0; i < 10; i++) listo = registrar(listo, 8, { ok: i >= 2, dificil: i < 4, banda: "u" }, HOY, 1);
  assert.equal(dominio(listo, 8).aciertos, 8);
  assert.equal(dominio(listo, 8).dificiles, 4);
  assert.equal(dominio(listo, 8).listo, true);
});

test("tres fallos seguidos no bajan de nivel: piden un pedido fácil y marcan la banda", () => {
  let pr = { ...nuevo(), nivel: 4, elegido: 4 };
  for (let i = 0; i < 3; i++) pr = registrar(pr, 4, { ok: false, dificil: false, banda: "d" }, HOY, 1);
  assert.equal(pr.nivel, 4);
  assert.equal(quiereFacil(pr, 4), true);
  const p = pedidoPara(pr, 4, rngConSemilla(9));
  assert.equal(p.facil, true);
  assert.equal(p.pistaBanda, "d");
  assert.ok(p.subetapa === "desarrollada" || p.subetapa === "decenas");
  pr = registrar(pr, 4, { ok: true, dificil: false, banda: null }, HOY, 1);
  assert.equal(quiereFacil(pr, 4), false);
});

test("cerrarTurno sube una sola vez, da una pieza y otra especial al subir", () => {
  let pr = jugar(nuevo(), 1, 10);
  let r = cerrarTurno(pr, 1, 6);
  assert.equal(r.subio, 2);
  assert.equal(r.estrellas, 3);
  assert.equal(r.pr.deco.ganadas, 1);
  assert.equal(r.pr.deco.especiales, 1);
  assert.equal(r.pr.niveles[1].dominado, true);
  r = cerrarTurno(r.pr, 1, 3);
  assert.equal(r.subio, null);
  assert.equal(r.pr.nivel, 2);
  assert.equal(r.pr.deco.ganadas, 2);
  assert.equal(r.pr.deco.especiales, 1);
  assert.equal(estrellasTurno(5), 2);
  assert.equal(estrellasTurno(3), 1);
  assert.equal(estrellasTurno(2), 0);
  const plan = planTurno(r.pr, 2, rngConSemilla(8));
  assert.equal(plan.length, 6);
  assert.equal(plan.filter((x) => x.repaso).length, 1);
  assert.equal(cerrarTurno(jugar({ ...nuevo(), nivel: 8 }, 8, 10, { dificil: true }), 8, 6).pr.nivel, 8);
});

test("el sello de inglés no cuenta para el dominio y la fábrica crece por niveles", () => {
  let pr = jugar(nuevo(), 2, 4);
  const antes = dominio(pr, 2).intentos;
  pr = marcarIngles(pr);
  assert.equal(dominio(pr, 2).intentos, antes);
  assert.equal(piezasDe(pr).some((p) => p.ingles), true);
  assert.equal(piezasDe(nuevo()).some((p) => p.ingles), false);
  assert.equal(PIEZAS.length, 20);
  assert.equal(PIEZAS.filter((p) => p.arte).length, 20);
  assert.equal(PIEZAS.some((p) => p.simple), false);
  assert.equal(pisosFabrica(1), 1);
  assert.equal(pisosFabrica(6), 4);
  let deco = decoNueva();
  deco = { ...deco, ganadas: 3 };
  const ids = piezasDisponibles(deco, false).filter((p) => p.ranura === "banderines").map((p) => p.id);
  assert.ok(ids.length >= 1);
  const sig = ciclarRanura(deco, "banderines", 1, false);
  assert.equal(sig.slots.banderines, ids[0]);
  const vuelta = ciclarRanura(sig, "banderines", -1, false);
  assert.equal(vuelta.slots.banderines, 0);
});

test("cargar ignora datos rotos", () => {
  assert.equal(cargar(null).nivel, 1);
  assert.equal(cargar({ v: 2 }).nivel, 1);
  assert.equal(cargar({ v: 1, nivel: 40 }).nivel, 8);
});

// ---------- Reto ----------

test("reto del día: misma fecha, mismo reto; rota; la línea no es por tiempo", () => {
  assert.deepEqual(retoDelDia(HOY, 5), retoDelDia(HOY, 5));
  const tipos = new Set([0, 1, 2].map((i) => retoDelDia(sumarDias(HOY, i), 5).tipo));
  assert.deepEqual([...tipos].sort(), ["gigante", "linea", "misterioso"]);
  for (let i = 0; i < 6; i++) {
    const r = retoDelDia(sumarDias(HOY, i), 5);
    assert.equal(r.segundos, undefined);
    assert.ok(r.problemas.length >= 4 && r.problemas.length <= 6);
    assert.ok(r.necesita <= r.problemas.length);
    if (r.tipo === "gigante") assert.ok(r.problemas.every((p) => tieneCero(p.objetivo)));
    if (r.tipo === "linea") assert.equal(r.cuantos, 6);
    if (r.tipo === "misterioso") {
      assert.ok(r.problemas.length <= 5);
      for (const p of r.problemas) {
        assert.ok(p.pistas.length <= 3);
        assert.ok(p.pistas.some((x) => x.tipo === "centenas"));
        assert.deepEqual(soluciones(p.pistas), [p.objetivo]);
      }
    }
  }
  const diaGigante = [0, 1, 2].map((i) => sumarDias(HOY, i)).find((f) => retoDelDia(f, 1).tipo === "gigante");
  const chico = retoDelDia(diaGigante, 1);
  assert.equal(chico.tipo, "gigante");
  assert.ok(chico.problemas.every((p) => !tieneCero(p.objetivo) && p.objetivo <= 99));
});

test("pistas del camión misterioso: a lo más 3 y una de centenas, para cualquier número", () => {
  const rnd = rngConSemilla(11);
  for (let i = 0; i < 100; i++) {
    const n = entre(rnd, 0, 999);
    const ps = pistasDe(n);
    assert.ok(ps.length <= 3);
    assert.equal(ps[0].tipo, "centenas");
    assert.deepEqual(soluciones(ps), [n]);
    assert.ok(ps.every((p) => cumplePista(n, p)));
  }
});

test("racha suave: hoy pendiente no la rompe", () => {
  let pr = nuevo();
  for (const f of ["2026-10-06", "2026-10-07", "2026-10-08"]) pr = cumplirReto(pr, f, "linea", 6, true);
  assert.equal(racha(pr, HOY), 3);
  pr = cumplirReto(pr, HOY, "gigante", 2, false);
  assert.equal(racha(pr, HOY), 3);
  pr = cumplirReto(pr, HOY, "gigante", 4, true);
  assert.equal(racha(pr, HOY), 4);
  assert.equal(semana(pr, HOY).filter((d) => d.reto).length, 4);
});

test("los SVG de Petra traen el viewBox y los ids que usa el juego", () => {
  const img = new URL("../img/", import.meta.url);
  const leer = (n) => fs.readFileSync(new URL(n, img), "utf8");
  for (const nombre of ["camion-rojo", "camion-azul", "camion-verde", "camion-amarillo", "camion-morado"]) {
    const s = leer(nombre + ".svg");
    assert.match(s, /viewBox="0 0 330 196"/);
    for (const id of ["numero", "panel", "carroceria", "cabina", "zona-carga"]) assert.match(s, new RegExp(`id="${id}"`));
  }
  for (const nombre of ["maquina", "maquina-triturar", "maquina-pegar"]) {
    const s = leer(nombre + ".svg");
    assert.match(s, /viewBox="0 8 240 244"/);
    for (const id of ["luz", "engrane-izq", "engrane-der", "cartel"]) assert.match(s, new RegExp(`id="${id}"`));
  }
  for (const nombre of ["banda-centenas", "banda-decenas", "banda-unidades"]) {
    const s = leer(nombre + ".svg");
    assert.match(s, /viewBox="0 4 160 60"/);
    assert.match(s, /id="marcas"/);
  }
  for (const nombre of ["cartel-centenas", "cartel-decenas", "cartel-unidades"]) assert.match(leer(nombre + ".svg"), /id="valor"/);
  assert.match(leer("deco-banderines-1.svg"), /class="banderin"/);
  assert.match(leer("deco-chimenea-1.svg"), /id="humo"/);
  assert.match(leer("deco-luces-1.svg"), /class="foco"/);
  assert.match(leer("deco-luces-3.svg"), /id="rayos"/);
  assert.equal((leer("deco-guirnalda-puntos.svg").match(/class="banderin"/g) || []).length, 9);
  assert.equal((leer("deco-estrellas-techo.svg").match(/class="banderin"/g) || []).length, 5);
  for (const nombre of ["deco-tubo-chimenea", "deco-nube-humo"]) {
    const s = leer(nombre + ".svg");
    assert.match(s, /id="humo"/);
    assert.match(s, /class="nube"/);
  }
  assert.match(leer("deco-velas.svg"), /viewBox="0 -8 160 124"/);
  assert.match(leer("deco-velas.svg"), /class="foco"/);
  assert.match(leer("deco-luces-redondas.svg"), /viewBox="0 4 160 76"/);
  assert.match(leer("deco-luces-redondas.svg"), /class="foco"/);
  for (const nombre of ["puerta-estrella", "puerta-sol", "puerta-flor", "puerta-corazon"]) {
    assert.match(leer(nombre + ".svg"), /id="figura"/);
  }
  assert.match(leer("sello-en.svg"), /id="texto"/);
  assert.match(leer("cubo-1000.svg"), /viewBox="0 0 139 139"/);
  assert.match(leer("cubo-1000.svg"), /#4cb3ff/);
  assert.match(leer("cubo-1000-coral.svg"), /#ff6b4a/);
  assert.match(fs.readFileSync(new URL("../icono.svg", import.meta.url), "utf8"), /viewBox="0 0 100 100"/);
  assert.equal(NIVELES.length, 8);
});
