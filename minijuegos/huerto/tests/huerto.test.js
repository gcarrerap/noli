import { test } from "node:test";
import assert from "node:assert/strict";
import { rngConSemilla } from "../src/rng.js";
import { TEXTOS, preguntaPar } from "../src/textos.js";
import { limpiarHabla } from "../src/voz.js";
import { SEMILLAS, semillasAbiertas, semillaNueva, semillaDeNivel } from "../src/semillas.js";
import {
  NIVELES, crearEncargo, crearTemporada, infoPar, esPar, respuestaParEs, coincide, cabeEnCuadricula,
  saltosCoinciden, opcionesSalto, sumaRepetida, saltosArreglo, limitar, POR_TEMPORADA, planBase,
} from "../src/niveles.js";
import { pista, marcaPasoCompleto } from "../src/pista.js";
import {
  GUIA, pasoGuia, saltosGuia, textoGuia, guiaAvanzaConToque, listoGuiaActivo, focoGuia,
  topeGuia, efectoAtrasGuia, GUIA_TOQUE_MS, GUIA_VOZ_MAX_MS, GUARDIA_SALIR_MS, esperaAutoGuia,
  cadenaFocoGuia, focoAlCerrarSalir, relojPasoMostrar, entradaTrasCerrar,
} from "../src/guia.js";
import {
  nuevo, cargar, registrar, anotarEncargo, dominio, cerrarTemporada, quiereFacil, planSlots, estrellasTemporada,
  cumplirReto, racha, marcarGuia, ponerVoz, VENTANA, PARA_SUBIR,
} from "../src/progreso.js";
import { retoDelDia, RETO_GRANDE } from "../src/reto.js";

const rnd = rngConSemilla("huerto-pruebas");
function temporadas(n, k = 12) {
  const out = [];
  for (let i = 0; i < k; i++) out.push(crearTemporada(n, rngConSemilla("t-" + n + "-" + i)));
  return out;
}

const SIMBOLO_HABLA = /[+▲▼×]/;

test("la guía es el ejemplo fijo de 2 filas de 3 y cuenta 3, 6", () => {
  assert.deepEqual(GUIA, { filas: 2, porFila: 3 });
  assert.deepEqual(saltosGuia(), [3, 6]);
  assert.equal(textoGuia("filas", false).texto, "Toca + hasta 2.");
  assert.equal(textoGuia("filas", true).texto, "Pulsa ▲ hasta 2.");
  assert.equal(textoGuia("filas", false).leer, "Toca más hasta 2.");
  assert.equal(textoGuia("filas", true).leer, "Pulsa arriba hasta 2.");
  assert.equal(textoGuia("listo", true).texto, "¡Brilla! Pulsa OK.");
  assert.equal(textoGuia("listo", true).leer, "Brilla. Pulsa OK.");
  assert.doesNotMatch(textoGuia("filas", true).leer, /Toca más/);
  assert.doesNotMatch(textoGuia("filas", true).leer + textoGuia("listo", true).leer, SIMBOLO_HABLA);
  assert.equal(pasoGuia({ acepto: false, filas: 1, porFila: 1, fase: "plantar" }), "pedido");
  assert.equal(pasoGuia({ acepto: true, filas: 1, porFila: 1, fase: "plantar" }), "filas");
  assert.equal(pasoGuia({ acepto: true, filas: 2, porFila: 1, fase: "plantar" }), "cada");
  assert.equal(pasoGuia({ acepto: true, filas: 2, porFila: 3, fase: "plantar" }), "listo");
  assert.equal(pasoGuia({ acepto: true, filas: 2, porFila: 3, fase: "cosecha" }), "abejas");
});

test("cada encargo cabe en la cuadrícula, sin cero y sin ×", () => {
  for (let n = 1; n <= 6; n++) {
    for (const temporada of temporadas(n, 16)) {
      assert.equal(temporada.length, POR_TEMPORADA);
      for (const e of temporada) {
        assert.equal(cabeEnCuadricula(e), true, JSON.stringify(e));
        assert.equal(saltosCoinciden(e), true, JSON.stringify(e));
        assert.doesNotMatch(e.texto + e.leer + (e.texto2 || "") + (e.frase || ""), /×/);
        assert.doesNotMatch(e.leer, SIMBOLO_HABLA);
        if (e.leer2) assert.doesNotMatch(e.leer2, SIMBOLO_HABLA);
        if (e.secuencia) assert.ok(e.secuencia.every((x) => x >= 1), e.secuencia.join(","));
        if (e.cantidad != null) assert.ok(e.cantidad >= 1 && e.cantidad <= 20);
        if (e.inicio != null) assert.ok(e.inicio >= 1);
      }
    }
  }
});

test("nivel 1 mezcla 2 y 10; el 4 no reparte; el 6 reparte y el giro va primero", () => {
  for (const t of temporadas(1, 10)) {
    const pasos = new Set(t.map((e) => e.porFila));
    assert.ok(pasos.has(2) && pasos.has(10));
    assert.ok(t.every((e) => e.tipo === "plantar" && e.cosecha));
  }
  for (const t of temporadas(2, 8)) assert.ok(t.every((e) => e.porFila === 5 && e.cosecha));
  for (const t of temporadas(4, 10)) {
    assert.ok(t.every((e) => e.tipo === "plantar" && e.filas <= 5 && e.porFila <= 5));
    assert.ok(t.every((e) => e.tipo !== "repartir"));
    assert.match(t.find((e) => e.filas === 4 && e.porFila === 5)?.suma || sumaRepetida(4, 5).escrito, /5 \+ 5 \+ 5 \+ 5 = 20/);
  }
  for (const t of temporadas(5, 8)) {
    assert.ok(t.every((e) => e.tipo === "saltar" && e.secuencia.length <= 5));
    assert.ok(t.some((e) => e.direccion === 1) || t.some((e) => e.direccion === -1));
  }
  for (const t of temporadas(6, 10)) {
    assert.deepEqual(t.map((e) => e.tipo), ["giro", "giro", "giro", "forma", "forma", "repartir"]);
    const iGiro = t.map((e) => e.tipo).lastIndexOf("giro");
    const iForma = t.map((e) => e.tipo).indexOf("forma");
    assert.ok(iGiro < iForma);
    assert.equal(t.some((e) => e.tipo === "repartir" && /filas iguales/.test(e.texto)), true);
  }
  for (const t of temporadas(3, 6)) {
    assert.ok(t.some((e) => esPar(e.cantidad)) && t.some((e) => !esPar(e.cantidad)));
  }
});

test("pares y nones hasta 100, y el doble 8 = 4 + 4", () => {
  for (let n = 1; n <= 100; n++) {
    const inf = infoPar(n);
    assert.equal(inf.par, n % 2 === 0);
    assert.equal(esPar(n), inf.par);
    assert.equal(respuestaParEs(n, "par"), inf.par);
    assert.equal(respuestaParEs(n, "non"), !inf.par);
    assert.equal(inf.sobra, n % 2);
    if (inf.par) {
      assert.equal(inf.doble, `${n} = ${n / 2} + ${n / 2}`);
      assert.equal(inf.filas, 2);
      assert.equal(inf.porFila, n / 2);
    } else {
      assert.equal(inf.doble, null);
    }
  }
  assert.equal(infoPar(8).doble, "8 = 4 + 4");
  assert.equal(TEXTOS.nones, "nones");
  assert.match(preguntaPar(8), /non/);
});

test("los saltos de un arreglo llegan al total y caben en 5", () => {
  assert.deepEqual(saltosArreglo(4, 5), [5, 10, 15, 20]);
  assert.equal(sumaRepetida(4, 5).escrito, "5 + 5 + 5 + 5 = 20");
  const e = crearEncargo(4, rnd, { tipo: "plantar", facil: false });
  assert.equal(e.secuencia.at(-1), e.filas * e.porFila);
  assert.ok(e.secuencia.length <= 5);
  for (let i = 0; i < 30; i++) {
    const s = crearEncargo(5, rngConSemilla("s" + i), { tipo: "saltar" });
    assert.ok(s.secuencia.every((n) => n >= 1));
    assert.ok(s.secuencia.length <= 5);
    if (s.direccion === -1) assert.ok(s.secuencia.at(-1) >= 1);
    const actual = s.inicio;
    const ops = opcionesSalto(s.secuencia[0], actual, s.paso, s.direccion, rngConSemilla("o" + i));
    assert.equal(ops.length, 3);
    assert.equal(new Set(ops).size, 3);
    assert.ok(ops.includes(s.secuencia[0]));
    assert.ok(ops.every((n) => n >= 1));
  }
});

test("coincide solo cuando filas y en cada fila son las del encargo", () => {
  const e = crearEncargo(6, rngConSemilla("g"), { tipo: "giro" });
  assert.equal(coincide(e.filas, e.porFila, e, "plantar"), true);
  assert.equal(coincide(e.filas2, e.porFila2, e, "giro2"), true);
  assert.equal(coincide(e.filas, e.porFila, e, "giro2"), false);
  assert.equal(limitar(0, 10), 1);
  assert.equal(e.filas * e.porFila, e.filas2 * e.porFila2);
  assert.notEqual(e.filas, e.filas2);
});

test("la guía no avanza sin el conteo, Listo espera el brillo y Atrás no sale dos veces", () => {
  const base = { acepto: true, filas: 1, porFila: 1, fase: "plantar" };
  assert.equal(pasoGuia(base), "filas");
  assert.equal(listoGuiaActivo(base), false);
  assert.equal(focoGuia(base), "contador-filas");
  assert.notEqual(focoGuia(base), "saltar");
  const dos = { ...base, filas: 2 };
  assert.equal(pasoGuia(dos), "cada");
  assert.equal(focoGuia(dos), "contador-cada");
  assert.equal(listoGuiaActivo(dos), false);
  assert.equal(pasoGuia({ ...base, filas: 5, porFila: 1 }), "filas");
  assert.equal(topeGuia("filas", 5), 2);
  assert.equal(topeGuia("cada", 10), 3);
  const listo = { ...dos, porFila: 3 };
  assert.equal(pasoGuia(listo), "listo");
  assert.equal(listoGuiaActivo(listo), true);
  assert.equal(focoGuia(listo), "listo");
  assert.equal(guiaAvanzaConToque("pedido"), true);
  assert.equal(guiaAvanzaConToque("filas"), false);
  assert.equal(guiaAvanzaConToque("cada"), false);
  assert.equal(GUIA_TOQUE_MS, 2000);
  assert.deepEqual(cadenaFocoGuia(), ["contador-filas", "contador-cada", "listo"]);
  assert.equal(cadenaFocoGuia().includes("saltar"), false);
  assert.equal(focoAlCerrarSalir("listo", false, base), "listo");
  assert.equal(focoAlCerrarSalir("contador-cada", true, dos), "contador-cada");
  assert.equal(focoAlCerrarSalir("", true, base), "contador-filas");
  assert.equal(efectoAtrasGuia(false), "preguntar");
  assert.equal(efectoAtrasGuia(true), "seguir");
  assert.notEqual(efectoAtrasGuia(true), "salir");
  assert.notEqual(efectoAtrasGuia(false), "saltar");
  for (const estado of [base, dos, listo, { acepto: false, filas: 1, porFila: 1, fase: "plantar" }]) {
    assert.notEqual(focoGuia(estado), "saltar");
  }
});

test("el paso que solo se muestra espera a la voz, con tope de 3 s", () => {
  assert.equal(guiaAvanzaConToque("pedido"), true);
  assert.equal(guiaAvanzaConToque("filas"), false);
  assert.equal(esperaAutoGuia(0), 2000);
  assert.equal(esperaAutoGuia(undefined), 2000);
  assert.equal(esperaAutoGuia(2600), 2600);
  assert.equal(esperaAutoGuia(9000), 3000);
  assert.equal(GUIA_VOZ_MAX_MS, 3000);
  assert.equal(GUIA_TOQUE_MS, 2000);
});

test("¿Salir? pausa el paso que se muestra y Seguir lo empieza de nuevo", () => {
  assert.equal(relojPasoMostrar({ dialog: true, transcurrido: 1900 }).avanzar, false);
  assert.equal(relojPasoMostrar({ dialog: true, transcurrido: 1900 }).correr, false);
  assert.equal(relojPasoMostrar({ dialog: true, transcurrido: 9000, vozSigue: true }).avanzar, false);
  assert.equal(relojPasoMostrar({ dialog: false, transcurrido: 1900, vozSigue: false }).avanzar, false);
  assert.equal(relojPasoMostrar({ dialog: false, transcurrido: 2000, vozSigue: true }).avanzar, false);
  assert.equal(relojPasoMostrar({ dialog: false, transcurrido: 2600, vozSigue: true }).avanzar, false);
  assert.equal(relojPasoMostrar({ dialog: false, transcurrido: 3000, vozSigue: true }).avanzar, true);
  assert.equal(relojPasoMostrar({ dialog: false, transcurrido: 2000, vozSigue: false }).avanzar, true);
  const otra = relojPasoMostrar({ dialog: false, transcurrido: 0, vozSigue: false });
  assert.equal(otra.avanzar, false);
  assert.equal(otra.espera, 2000);
  assert.equal(otra.correr, true);
  const conVoz = relojPasoMostrar({ dialog: false, transcurrido: 0, vozSigue: true });
  assert.equal(conVoz.avanzar, false);
  assert.equal(conVoz.espera, 3000);
});

test("tras cerrar ¿Salir? un toque o OK no pasa durante 400 ms", () => {
  assert.equal(GUARDIA_SALIR_MS, 400);
  for (const tipo of ["toque", "ok"]) {
    assert.equal(entradaTrasCerrar({ ms: 0, tipo }), "ignorar");
    assert.equal(entradaTrasCerrar({ ms: 399, tipo }), "ignorar");
    assert.equal(entradaTrasCerrar({ ms: 400, tipo }), "pasar");
  }
  assert.equal(entradaTrasCerrar({ ms: 0, tipo: "atras" }), "pasar");
  assert.equal(entradaTrasCerrar({ ms: 10, tipo: "arriba" }), "pasar");
  assert.equal(entradaTrasCerrar({ ms: Number.NaN, tipo: "toque" }), "ignorar");
});

test("ver el paso completo a los 40 s no cuenta como primer intento", () => {
  assert.equal(marcaPasoCompleto(2, "completo", 40), true);
  assert.equal(marcaPasoCompleto(2, "completo", 39), false);
  assert.equal(marcaPasoCompleto(2, "corto", 40), false);
  assert.equal(marcaPasoCompleto(1, "completo", 40), false);
  let pr = nuevo();
  pr = anotarEncargo(pr, 2, true, "2026-10-09", true);
  assert.equal(dominio(pr, 2).intentos, 0);
  assert.equal(dominio(pr, 2).aciertos, 0);
  pr = anotarEncargo(pr, 2, true, "2026-10-09", false);
  assert.equal(dominio(pr, 2).aciertos, 1);
  pr = anotarEncargo(pr, 2, false, "2026-10-09", true);
  assert.equal(dominio(pr, 2).intentos, 2);
  assert.equal(dominio(pr, 2).aciertos, 1);
  pr = anotarEncargo(pr, 1, true, "2026-10-09", true);
  assert.equal(dominio(pr, 1).aciertos, 1);
});

test("pistas: nivel 1 cuenta sin regalar los números, nivel 2 suma 5, nivel 4 filas luego cada fila, nivel 6 prueba con 2", () => {
  const n1 = pista({ fase: "cosecha", salto: 0 }, { nivel: 1, secuencia: [2, 4, 6], paso: 2, direccion: 1 }, { segundos: 0 });
  assert.equal(n1.texto, "Cuenta de 2 en 2.");
  assert.doesNotMatch(n1.texto, /2, 4/);
  const n1full = pista({ fase: "cosecha", salto: 0 }, { nivel: 1, secuencia: [2, 4, 6], paso: 2, direccion: 1 }, { segundos: 40 });
  assert.match(n1full.texto, /2, 4, 6/);
  const n1diez = pista({ fase: "cosecha", salto: 0 }, { nivel: 1, secuencia: [10, 20], paso: 10, direccion: 1 }, { segundos: 0 });
  assert.equal(n1diez.texto, "Cuenta de 10 en 10.");
  const muestra = pista({ fase: "muestra", filas: 1, porFila: 1 }, { nivel: 3, filas: 2, porFila: 10 }, { segundos: 0 });
  assert.equal(muestra.texto, "");
  const tvListo = pista({ fase: "plantar", filas: 2, porFila: 3 }, { nivel: 4, filas: 2, porFila: 3 }, { segundos: 40, tv: true });
  assert.equal(tvListo.texto, "¡Brilla! Pulsa OK.");
  assert.equal(tvListo.leer, "Brilla. Pulsa OK.");
  assert.doesNotMatch(tvListo.leer, /Toca más|▲|\+/);
  const n2 = pista({ fase: "cosecha", salto: 0 }, { nivel: 2, secuencia: [5, 10, 15], paso: 5, direccion: 1 }, { segundos: 0 });
  assert.equal(n2.texto, "Suma 5 más.");
  assert.equal(n2.paso, "corto");
  const flecha = pista({ fase: "cosecha", salto: 0 }, { nivel: 2, secuencia: [5, 10], paso: 5, direccion: 1 }, { segundos: 20 });
  assert.equal(flecha.paso, "flecha");
  assert.equal(flecha.flecha, "opciones");
  const completo = pista({ fase: "cosecha", salto: 1 }, { nivel: 2, secuencia: [5, 10, 15], paso: 5, direccion: 1 }, { segundos: 40 });
  assert.equal(completo.paso, "completo");
  const trasError = pista({ fase: "plantar", filas: 1, porFila: 1 }, { nivel: 2, filas: 3, porFila: 5 }, { errores: 1 });
  assert.equal(trasError.paso, "completo");
  const n4a = pista({ fase: "plantar", filas: 1, porFila: 1 }, { nivel: 4, filas: 4, porFila: 5 }, { segundos: 40 });
  assert.match(n4a.texto, /4 filas/);
  const n4b = pista({ fase: "plantar", filas: 4, porFila: 1 }, { nivel: 4, filas: 4, porFila: 5 }, { segundos: 40 });
  assert.match(n4b.texto, /5 en cada fila/);
  const n4corto = pista({ fase: "plantar", filas: 1, porFila: 1 }, { nivel: 4, filas: 4, porFila: 5 }, { segundos: 0 });
  assert.match(n4corto.texto, /filas/);
  const n6 = pista({ fase: "plantar", filas: 1, porFila: 1 }, { nivel: 6, filas: 2, porFila: 6 }, { segundos: 0 });
  assert.match(n6.texto, /2 filas/);
  const n3 = pista({ fase: "par" }, { nivel: 3 }, { segundos: 0 });
  assert.match(n3.texto, /parejas/);
  assert.doesNotMatch(n4a.leer + n6.leer + textoGuia("listo", false).leer, SIMBOLO_HABLA);
  const tvFilas = pista({ fase: "plantar", filas: 1, porFila: 1 }, { nivel: 2, filas: 3, porFila: 5 }, { segundos: 40, tv: true });
  assert.match(tvFilas.texto, /▲/);
  assert.equal(tvFilas.leer, "Pulsa arriba hasta 3.");
  assert.doesNotMatch(tvFilas.leer, /Toca más/);
});

test("la voz quita los símbolos", () => {
  assert.equal(limpiarHabla("Toca + hasta 2 y pulsa ▲"), "Toca hasta 2 y pulsa");
  assert.doesNotMatch(limpiarHabla("5 + 5"), SIMBOLO_HABLA);
});

test("semillas en orden fijo y la del nivel", () => {
  assert.deepEqual(SEMILLAS.map((s) => s.id), ["zanahoria", "lechuga", "fresa", "girasol", "calabaza"]);
  assert.deepEqual(semillasAbiertas(1).map((s) => s.id), ["zanahoria"]);
  assert.deepEqual(semillasAbiertas(3).map((s) => s.id), ["zanahoria", "lechuga", "fresa"]);
  assert.equal(semillaDeNivel(6).id, "calabaza");
  assert.equal(semillaNueva(1), null);
  assert.equal(semillaNueva(2).id, "lechuga");
  assert.equal(semillaNueva(6), null);
});

test("dominio con 8 de 10, tres fallos piden fácil y la temporada da estrellas", () => {
  let pr = nuevo();
  assert.equal(dominio(pr, 1).listo, false);
  for (let i = 0; i < 8; i++) pr = registrar(pr, 1, true, "2026-10-09");
  assert.equal(dominio(pr, 1).listo, false);
  pr = registrar(pr, 1, true, "2026-10-09");
  pr = registrar(pr, 1, true, "2026-10-09");
  assert.equal(dominio(pr, 1).listo, true);
  const cerrado = cerrarTemporada(pr, 1, 6);
  assert.equal(cerrado.subio, 2);
  assert.equal(cerrado.estrellas, 3);
  assert.equal(cerrado.pr.nivel, 2);
  assert.equal(estrellasTemporada(5), 2);
  assert.equal(estrellasTemporada(4), 1);
  assert.equal(estrellasTemporada(3), 1);
  assert.equal(estrellasTemporada(2), 0);
  let mal = nuevo();
  mal = registrar(mal, 1, false, "2026-10-09");
  mal = registrar(mal, 1, false, "2026-10-09");
  assert.equal(quiereFacil(mal, 1), false);
  mal = registrar(mal, 1, false, "2026-10-09");
  assert.equal(quiereFacil(mal, 1), true);
  mal = registrar(mal, 1, true, "2026-10-09");
  assert.equal(quiereFacil(mal, 1), false);
  assert.equal(VENTANA, 10);
  assert.equal(PARA_SUBIR, 8);
});

test("el repaso del nivel 6 no adelanta una forma al giro", () => {
  let pr = nuevo();
  pr = { ...pr, nivel: 6, niveles: { 1: { ...pr.niveles[1], dominado: true, ultimos: [], total: 0, aciertos: 0, estrellas: 0, turnos: 0, seguidosMal: 0 } } };
  pr.niveles[1] = { ultimos: [], total: 10, aciertos: 10, dominado: true, estrellas: 3, turnos: 1, seguidosMal: 0 };
  const plan = planSlots(pr, 6, rngConSemilla("repaso"));
  assert.equal(plan[4].repaso, true);
  assert.equal(plan[4].nivel, 1);
  const tipos = plan.filter((s) => s.nivel === 6).map((s) => s.tipo);
  const iGiro = tipos.lastIndexOf("giro");
  const iForma = tipos.indexOf("forma");
  assert.ok(iForma === -1 || iGiro < iForma);
  assert.ok(plan.some((s) => s.tipo === "repartir"));
  assert.deepEqual(planBase(6).map((s) => s.tipo), ["giro", "giro", "giro", "forma", "forma", "repartir"]);
});

test("reto del día determinista: Huerto grande, 6 encargos y 4 bien", () => {
  const a = retoDelDia("2026-10-09", 4);
  const b = retoDelDia("2026-10-09", 4);
  assert.deepEqual(a, b);
  assert.equal(a.nombre, "Huerto grande");
  assert.equal(a.cuantos, 6);
  assert.equal(a.necesita, 4);
  assert.equal(a.problemas.length, 6);
  assert.notDeepEqual(retoDelDia("2026-10-10", 4).problemas, a.problemas);
  assert.equal(RETO_GRANDE.necesita, 4);
  const sube = retoDelDia("2026-10-09", 6);
  assert.deepEqual(sube.problemas.map((e) => e.tipo), ["giro", "giro", "giro", "forma", "forma", "repartir"]);
  for (const e of a.problemas) assert.equal(cabeEnCuadricula(e), true);
});

test("progreso: guía, voz y racha que no se arma con un día suelto", () => {
  let pr = cargar(null);
  assert.equal(pr.guiaHecha, false);
  assert.equal(pr.voz, true);
  pr = marcarGuia(pr);
  pr = ponerVoz(pr, false);
  assert.equal(pr.guiaHecha, true);
  assert.equal(pr.voz, false);
  pr = cumplirReto(pr, "2026-10-07", "grande", 4, true);
  pr = cumplirReto(pr, "2026-10-08", "grande", 5, true);
  assert.equal(racha(pr, "2026-10-09"), 2);
  assert.equal(racha(pr, "2026-10-11"), 0);
  const otra = cargar(pr);
  assert.equal(otra.voz, false);
  assert.equal(otra.guiaHecha, true);
  assert.equal(cargar({ v: 2 }).nivel, 1);
  assert.equal(NIVELES.length, 6);
});

test("el nivel 5 cuenta hacia adelante y hacia atrás sin pasar por cero", () => {
  let adelante = 0;
  let atras = 0;
  for (let i = 0; i < 40; i++) {
    const e = crearEncargo(5, rngConSemilla("dir-" + i), { tipo: "saltar" });
    if (e.direccion === 1) adelante++;
    else atras++;
    assert.ok(e.secuencia[0] !== e.inicio);
    assert.ok(e.secuencia.every((n) => n >= 1));
    const diffs = e.secuencia.map((n, i) => i === 0 ? n - e.inicio : n - e.secuencia[i - 1]);
    assert.ok(diffs.every((d) => d === e.paso * e.direccion));
  }
  assert.ok(adelante > 0 && atras > 0);
});
