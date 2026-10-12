import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { rngConSemilla } from "../src/rng.js";
import { ANIMALES, BASE, abiertos, siguiente, animal, cuantosPara } from "../src/animales.js";
import { vacia, mover, coincide, errores, marcas, conErrores, limitar } from "../src/grafica.js";
import { NIVELES, crearVisita, cuentasDistintas, opcionesConteo, PREGUNTAS_POR_VISITA } from "../src/niveles.js";
import { respuesta, esCorrecta, explicacion, crearPregunta } from "../src/preguntas.js";
import {
  nuevo, cargar, registrar, dominio, cerrarVisita, estrellasVisita, cumplirReto, racha, anotarDia, VENTANA, PARA_SUBIR,
} from "../src/progreso.js";
import { retoDelDia, tipoDelDia, RETOS } from "../src/reto.js";
import { acomodar, contados } from "../src/recinto.js";
import { visitaGuia, GUIA, textoPaso } from "../src/guia.js";

const pool = abiertos(0).map((a) => a.id);
const todos = ANIMALES.map((a) => a.id);
function visitas(n, k = 40, p = pool) {
  return Array.from({ length: k }, (_, i) => crearVisita(n, rngConSemilla(`v-${n}-${i}`), { pool: p }));
}
// Arma la gráfica como lo haría Noelia: pulsando + en cada columna hasta su cuenta.
function armar(v) {
  let g = vacia(v.cuentas.length);
  v.cuentas.forEach((c, i) => { for (let k = 0; k < 40 && g[i] < c; k++) g = mover(g, i, 1, v.escala, v.max); });
  return g;
}

test("cada visita trae los animales y cuentas de su nivel: distintas, en la escala y sin pasarse", () => {
  for (const nv of NIVELES) {
    for (const v of visitas(nv.n)) {
      assert.equal(v.animales.length, nv.k);
      assert.equal(new Set(v.animales).size, nv.k, "sin repetir animal");
      assert.ok(v.animales.every((id) => pool.includes(id)));
      assert.equal(new Set(v.cuentas).size, nv.k, "cuentas distintas: siempre hay uno con más y uno con menos");
      for (const c of v.cuentas) {
        assert.ok(c >= nv.min && c <= nv.max, `${c} en [${nv.min}, ${nv.max}]`);
        assert.equal(c % nv.escala, 0);
      }
      assert.equal(v.preguntas.length, PREGUNTAS_POR_VISITA);
      assert.equal(v.grafica, nv.n === 1 ? "dibujos" : "barras");
    }
  }
});

test("nivel 1: gráfica de dibujos con 3 animales y hasta 10; los demás con 4", () => {
  assert.equal(NIVELES[0].grafica, "dibujos");
  assert.equal(NIVELES[0].k, 3);
  assert.equal(NIVELES[0].max, 10);
  assert.ok(NIVELES.slice(1).every((n) => n.k === 4 && n.grafica === "barras"));
});

test("la gráfica construida coincide con los conteos", () => {
  for (const nv of NIVELES) {
    for (const v of visitas(nv.n, 20)) {
      const g = armar(v);
      assert.deepEqual(g, v.cuentas);
      assert.equal(coincide(g, v.cuentas), true);
      assert.deepEqual(errores(g, v.cuentas), []);
      const mal = mover(g, 0, 1, v.escala, v.max) === g ? mover(g, 0, -1, v.escala, v.max) : mover(g, 0, 1, v.escala, v.max);
      assert.equal(coincide(mal, v.cuentas), false);
      assert.deepEqual(errores(mal, v.cuentas), [0]);
    }
  }
});

test("mover no baja de 0 ni pasa del máximo, y no cambia la lista original", () => {
  const g = [0, 10];
  assert.equal(mover(g, 0, -1, 1, 10), g);
  assert.equal(mover(g, 1, 1, 1, 10), g);
  const h = mover(g, 0, 1, 1, 10);
  assert.deepEqual(h, [1, 10]);
  assert.deepEqual(g, [0, 10]);
  assert.equal(limitar(7, 2, 20), 8);
});

test("escala de 2 en 2: cada + sube 2, el eje va 0, 2, 4… 20 y toda cuenta se alcanza", () => {
  const n5 = NIVELES.find((n) => n.escala === 2);
  assert.equal(n5.n, 5);
  assert.deepEqual(marcas(2, 20), [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
  assert.deepEqual(marcas(1, 10), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(mover([0], 0, 1, 2, 20), [2]);
  assert.deepEqual(mover([6], 0, -1, 2, 20), [4]);
  for (const v of visitas(5)) {
    assert.ok(v.cuentas.every((c) => c % 2 === 0 && c >= 2 && c <= 20));
    let g = vacia(4);
    const pasos = v.cuentas.map((c, i) => { let k = 0; while (g[i] < c) { g = mover(g, i, 1, 2, 20); k++; } return k; });
    assert.deepEqual(pasos, v.cuentas.map((c) => c / 2), "cada pulsación suma 2");
    for (const p of v.preguntas) if (p.forma === "numero") assert.ok(p.opciones.every((x) => x % 2 === 0), "opciones de 2 en 2");
  }
});

test("las respuestas se calculan de la gráfica, no de lo que se guardó", () => {
  const cats = ["mono", "leon", "jirafa", "pinguino"].map(animal);
  const valores = [7, 3, 9, 5];
  const r = rngConSemilla("r");
  assert.equal(respuesta(crearPregunta("cuantos", [0], cats, valores, 1, r), valores), 7);
  assert.equal(respuesta(crearPregunta("mas", [], cats, valores, 1, r), valores), 2);
  assert.equal(respuesta(crearPregunta("menos", [], cats, valores, 1, r), valores), 1);
  assert.equal(respuesta(crearPregunta("difMas", [0, 1], cats, valores, 1, r), valores), 4);
  assert.equal(respuesta(crearPregunta("difMenos", [1, 0], cats, valores, 1, r), valores), 4);
  assert.equal(respuesta(crearPregunta("juntos", [0, 1], cats, valores, 1, r), valores), 10);
  assert.equal(respuesta(crearPregunta("juntos", [0, 1, 3], cats, valores, 1, r), valores), 15);
  assert.equal(respuesta(crearPregunta("total", [], cats, valores, 1, r), valores), 24);
  // Si la gráfica dice otra cosa, la respuesta sigue a la gráfica.
  const p = crearPregunta("difMas", [0, 1], cats, valores, 1, r);
  assert.equal(respuesta(p, [8, 3, 9, 5]), 5);
  assert.equal(esCorrecta(p, valores, 4), true);
  assert.equal(esCorrecta(p, valores, 10), false);
});

test("cada pregunta tiene 3 opciones distintas y positivas, una de ellas la buena (leída de la gráfica armada)", () => {
  for (const nv of NIVELES) {
    for (const v of visitas(nv.n)) {
      const g = armar(v);
      for (const p of v.preguntas) {
        const r = respuesta(p, g);
        if (p.forma === "animal") {
          assert.ok(p.tipo === "mas" || p.tipo === "menos");
          assert.deepEqual(p.opciones, v.animales.map((_, i) => i));
          assert.ok(p.opciones.includes(r));
        } else {
          assert.equal(p.opciones.length, 3, JSON.stringify(p));
          assert.equal(new Set(p.opciones).size, 3);
          assert.ok(p.opciones.every((x) => Number.isInteger(x) && x > 0));
          assert.ok(p.opciones.includes(r), `${p.texto} → ${r} en ${p.opciones}`);
          assert.ok(r > 0);
        }
        assert.match(p.texto, /^¿.+\?$/);
      }
    }
  }
});

test("nunca se repite la misma pregunta en una visita", () => {
  for (const nv of NIVELES) {
    for (const v of visitas(nv.n, 80)) {
      const firmas = v.preguntas.map((p) => p.tipo + ":" + [...p.ids].sort().join(","));
      assert.equal(new Set(firmas).size, firmas.length, firmas.join(" | "));
    }
  }
});

test("las preguntas de cada nivel son las de su tema", () => {
  const tipos = (n) => new Set(visitas(n).flatMap((v) => v.preguntas.map((p) => p.tipo)));
  assert.deepEqual([...tipos(1)].sort(), ["cuantos", "mas", "menos"]);
  const t3 = visitas(3).map((v) => v.preguntas.filter((p) => p.tipo.startsWith("dif")).length);
  assert.ok(t3.every((x) => x >= 2), "en ¿Cuántos más? hay al menos dos de comparar");
  const t4 = visitas(4).map((v) => v.preguntas.filter((p) => p.tipo === "juntos" || p.tipo === "total").length);
  assert.ok(t4.every((x) => x >= 2), "en Total hay al menos dos de juntar");
  assert.ok(visitas(4).some((v) => v.preguntas.some((p) => p.tipo === "juntos" && p.ids.length === 3)), "a veces junta tres");
});

test("las palabras: «Cuántos» o «Cuántas» concuerda con el primer animal; plural correcto", () => {
  const r = rngConSemilla("p");
  const cats = ["jirafa", "cebra", "mono", "leon"].map(animal);
  const v = [4, 6, 8, 2];
  assert.equal(crearPregunta("cuantos", [0], cats, v, 1, r).texto, "¿Cuántas jirafas hay?");
  assert.equal(crearPregunta("cuantos", [2], cats, v, 1, r).texto, "¿Cuántos monos hay?");
  assert.equal(crearPregunta("juntos", [0, 1], cats, v, 1, r).texto, "¿Cuántas jirafas y cebras hay en total?");
  assert.equal(crearPregunta("juntos", [0, 2], cats, v, 1, r).texto, "¿Cuántas jirafas y monos hay en total?");
  assert.equal(crearPregunta("juntos", [2, 0], cats, v, 1, r).texto, "¿Cuántos monos y jirafas hay en total?");
  assert.equal(crearPregunta("difMas", [2, 0], cats, v, 1, r).texto, "¿Cuántos monos más que jirafas hay?");
  assert.equal(crearPregunta("difMenos", [0, 2], cats, v, 1, r).texto, "¿Cuántas jirafas menos que monos hay?");
  assert.equal(cuantosPara([animal("rana"), animal("tortuga")]), "Cuántas");
  assert.equal(crearPregunta("juntos", [0, 1, 2], cats, v, 1, r).texto, "¿Cuántas jirafas, cebras y monos hay en total?");
});

test("la explicación hace la cuenta bien", () => {
  const cats = ["mono", "leon", "jirafa"].map(animal);
  const v = [7, 3, 5];
  const r = rngConSemilla("e");
  assert.equal(explicacion(crearPregunta("difMas", [0, 1], cats, v, 1, r), cats, v).texto, "Monos: 7, leones: 3. 7 − 3 = 4.");
  assert.equal(explicacion(crearPregunta("difMenos", [1, 0], cats, v, 1, r), cats, v).leer, "7 menos 3 son 4.");
  assert.equal(explicacion(crearPregunta("juntos", [0, 2], cats, v, 1, r), cats, v).texto, "7 + 5 = 12.");
  assert.equal(explicacion(crearPregunta("total", [], cats, v, 1, r), cats, v).texto, "7 + 3 + 5 = 15.");
  assert.equal(explicacion(crearPregunta("mas", [], cats, v, 1, r), cats, v).texto, "Monos: 7. Es la columna más alta.");
  assert.equal(explicacion(crearPregunta("cuantos", [1], cats, v, 1, r), cats, v).texto, "Hay 3 leones.");
  for (const p of [crearPregunta("difMas", [0, 1], cats, v, 1, r), crearPregunta("total", [], cats, v, 1, r)]) {
    assert.doesNotMatch(explicacion(p, cats, v).leer, /[+−=]/, "la voz no lee signos");
  }
});

test("detective: la gráfica trae justo los errores pedidos, dentro del eje", () => {
  for (let i = 0; i < 200; i++) {
    const rnd = rngConSemilla("d" + i);
    const escala = i % 2 ? 2 : 1, max = escala * 10;
    const cuentas = cuentasDistintas(rnd, 4, escala, escala * 2, max);
    for (const n of [0, 1, 2]) {
      const g = conErrores(cuentas, n, rnd, escala, max);
      assert.equal(errores(g, cuentas).length, n);
      assert.ok(g.every((x) => x >= escala && x <= max && x % escala === 0));
    }
  }
  const v6 = visitas(6, 80);
  assert.ok(v6.every((v) => v.detective && v.detective.errores <= 1));
  assert.ok(v6.some((v) => v.detective.errores === 0), "a veces está bien");
  assert.ok(v6.filter((v) => v.detective.errores === 1).length > 40, "casi siempre trae uno");
  assert.ok(visitas(2).every((v) => v.detective === null));
});

test("opciones al contar: la buena y dos cercanas, de la escala", () => {
  for (let i = 0; i < 100; i++) {
    const r = rngConSemilla("c" + i);
    for (const [c, e] of [[1, 1], [2, 1], [10, 1], [2, 2], [20, 2], [12, 1]]) {
      const ops = opcionesConteo(c, e, r);
      assert.equal(ops.length, 3);
      assert.ok(ops.includes(c));
      assert.equal(new Set(ops).size, 3);
      assert.ok(ops.every((x) => x >= e && x % e === 0));
      assert.ok(ops.every((x) => Math.abs(x - c) <= 3 * e));
    }
  }
});

test("el recinto pone a cada animal en su casilla, sin encimarse; en pares, de dos en dos", () => {
  for (let n = 1; n <= 20; n++) {
    for (const pares of [false, true]) {
      if (pares && n % 2) continue;
      const a = acomodar(n, rngConSemilla("a" + n), pares);
      assert.equal(contados(a), n);
      assert.equal(new Set(a.grupos.map((g) => g.fila + "," + g.col)).size, a.grupos.length);
      assert.ok(a.grupos.every((g) => g.col < a.cols && g.fila < a.filas));
      if (pares) assert.ok(a.grupos.every((g) => g.animales === 2));
    }
  }
});

test("reto del día: determinista con la misma fecha y alterna Censo y Detective", () => {
  const a = retoDelDia("2026-10-12", pool);
  const b = retoDelDia("2026-10-12", pool);
  assert.deepEqual(a, b);
  assert.notDeepEqual(retoDelDia("2026-10-13", pool).visita, a.visita);
  const tipos = new Set();
  for (let d = 1; d <= 28; d++) {
    const f = `2026-11-${String(d).padStart(2, "0")}`;
    const r = retoDelDia(f, pool);
    tipos.add(r.tipo);
    assert.equal(r.tipo, tipoDelDia(f));
    if (r.tipo === "censo") {
      assert.equal(r.visita.detective, null);
      assert.ok(r.visita.cuentas.every((c) => c >= 5 && c <= 12));
      assert.equal(r.visita.max, 12);
    } else {
      assert.equal(r.visita.detective.errores, 2);
      assert.equal(errores(r.visita.detective.inicial, r.visita.cuentas).length, 2);
    }
    assert.equal(r.visita.preguntas.length, 3);
    assert.ok(r.necesita < r.items);
  }
  assert.deepEqual([...tipos].sort(), ["censo", "detective"]);
  assert.equal(RETOS.censo.items, 4 + 3);
  assert.equal(RETOS.detective.items, 1 + 3);
});

test("progreso: sube con 8 de las últimas 10 preguntas bien a la primera", () => {
  let pr = nuevo();
  for (let i = 0; i < 9; i++) pr = registrar(pr, 1, i !== 3, "2026-10-12");
  assert.equal(dominio(pr, 1).listo, false, "faltan intentos");
  pr = registrar(pr, 1, true, "2026-10-12");
  assert.deepEqual(dominio(pr, 1), { intentos: 10, aciertos: 9, listo: true });
  const r = cerrarVisita(pr, 1, 3);
  assert.equal(r.subio, 2);
  assert.equal(r.pr.nivel, 2);
  assert.equal(r.pr.elegido, 2);
  let mal = nuevo();
  for (let i = 0; i < 10; i++) mal = registrar(mal, 1, i % 4 !== 0, "2026-10-12");
  assert.equal(dominio(mal, 1).aciertos, 7);
  assert.equal(cerrarVisita(mal, 1, 3).subio, null);
  assert.equal(VENTANA, 10);
  assert.equal(PARA_SUBIR, 8);
});

test("estrellas por visita y un animal nuevo por visita bien hecha, en orden fijo", () => {
  assert.deepEqual([0, 1, 2, 3].map(estrellasVisita), [0, 1, 2, 3]);
  assert.equal(estrellasVisita(5), 3);
  let pr = nuevo();
  const abiertosAntes = abiertos(pr.zoo).length;
  assert.equal(abiertosAntes, BASE);
  let r = cerrarVisita(pr, 1, 1);
  assert.equal(r.nuevoAnimal, null);
  r = cerrarVisita(pr, 1, 2);
  assert.equal(r.nuevoAnimal.id, "elefante");
  assert.equal(r.pr.zoo, 1);
  pr = r.pr;
  const orden = [];
  for (let i = 0; i < 20; i++) { const x = cerrarVisita(pr, 1, 3); if (x.nuevoAnimal) orden.push(x.nuevoAnimal.id); pr = x.pr; }
  assert.deepEqual(orden, todos.slice(BASE + 1));
  assert.equal(siguiente(pr.zoo), null);
  assert.equal(abiertos(pr.zoo).length, ANIMALES.length);
});

test("cargar arregla datos viejos o rotos", () => {
  assert.deepEqual(cargar(null), nuevo());
  assert.deepEqual(cargar({ v: 2 }), nuevo());
  const p = cargar({ v: 1, nivel: 99, elegido: 50, zoo: 400, voz: false });
  assert.equal(p.nivel, NIVELES.length);
  assert.equal(p.elegido, NIVELES.length);
  assert.equal(p.zoo, ANIMALES.length - BASE);
  assert.equal(p.voz, false);
});

test("reto: racha y que solo cuente el día una vez", () => {
  let pr = nuevo();
  pr = cumplirReto(pr, "2026-10-10", "censo", 6, true);
  pr = cumplirReto(pr, "2026-10-11", "detective", 4, true);
  pr = cumplirReto(pr, "2026-10-12", "censo", 3, false);
  assert.equal(racha(pr, "2026-10-12"), 2);
  pr = cumplirReto(pr, "2026-10-12", "censo", 2, false);
  assert.equal(pr.retos["2026-10-12"].puntos, 3, "se queda con lo mejor del día");
  pr = cumplirReto(pr, "2026-10-12", "censo", 5, true);
  assert.equal(racha(pr, "2026-10-12"), 3);
  const antes = pr.niveles;
  pr = anotarDia(pr, "2026-10-12", true);
  assert.equal(pr.niveles, antes, "el reto no mueve los niveles");
  assert.equal(pr.dias["2026-10-12"].preguntas, 1);
});

test("guía: visita fija de monos 3, leones 2 y jirafas 4, con una pregunta", () => {
  const g = visitaGuia();
  assert.deepEqual(g.animales, GUIA.animales);
  assert.deepEqual(g.cuentas, GUIA.cuentas);
  assert.equal(g.grafica, "dibujos");
  assert.equal(g.preguntas.length, 1);
  assert.equal(g.preguntas[0].tipo, "mas");
  assert.equal(respuesta(g.preguntas[0], g.cuentas), 2);
  assert.deepEqual(visitaGuia(), g);
  assert.equal(textoPaso("contar", { animal: animal("jirafa") }).texto, "Cuenta las jirafas. Toca el número.");
  assert.equal(textoPaso("grafica", { tv: true, cuenta: 3 }).texto, "Sube la columna con ▲ hasta 3. OK pasa a la otra.");
  assert.doesNotMatch(textoPaso("grafica", { tv: true, cuenta: 3 }).leer, /[▲+]/);
  assert.doesNotMatch(textoPaso("grafica", { tv: false, cuenta: 3 }).leer, /[▲+]/);
});

test("sin emojis en el juego (#5) y sin await al nivel del módulo", () => {
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/u;
  const dir = new URL("../src/", import.meta.url);
  for (const f of readdirSync(dir)) {
    const t = readFileSync(new URL(f, dir), "utf8");
    assert.doesNotMatch(t, emoji, f);
    assert.doesNotMatch(t, /^await\s/m, f);
  }
  for (const f of ["index.html", "juego.json", "estilo.css"]) {
    assert.doesNotMatch(readFileSync(new URL("../" + f, import.meta.url), "utf8"), emoji, f);
  }
});

test("cada animal tiene nombre en español y en inglés, y su dibujo", async () => {
  const { svgAnimal } = await import("../src/arte.js");
  for (const a of ANIMALES) {
    assert.ok(a.nombre && a.plural && a.en && a.enPlural);
    const s = svgAnimal(a.id);
    assert.match(s, /^<svg [^>]*viewBox="0 0 40 40"/);
    assert.ok(s.length > 200, a.id);
  }
  assert.equal(new Set(ANIMALES.map((a) => svgAnimal(a.id))).size, ANIMALES.length, "todos distintos");
});
