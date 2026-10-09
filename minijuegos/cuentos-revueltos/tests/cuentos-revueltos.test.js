import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validarCuento, validarIndice, califica, tareasCalificables, conRepaso, bancoPalabras } from "../src/cuentos.js";
import { duracionSiFalla, pasoLectura } from "../src/lectura.js";
import {
  guiaNueva, reducirGuia, debeAutoAvanzar, notaVoz, esMirar, saltarEnFlechas, textoPaso,
  AUTO_MIRAR_MS, TOPE_VOZ_MS, BLOQUEO_MIRAR_MS,
} from "../src/guia.js";
import { hablarTexto, decirGrabacion, prepararVoces } from "../src/voz.js";
import { ordenNuevo, tomar, poner, soltar, estaCompleto, cuentaPrimeraOrden, idsEnLectura } from "../src/orden.js";
import { cuentaPrimeraPregunta, fasePista, marcaPasoCompleto, textoCorto, fraseListo } from "../src/pista.js";
import {
  nuevo, anotarTarea, dominio, estrellasTurno, cerrarCapitulo, guardarCurso, cuentoDe,
  leeSolo, desbloqueado, ponerCuento, cumplirReto,
} from "../src/progreso.js";
import { retoDelDia } from "../src/reto.js";
import { archivosDe } from "../src/audios.js";
import { resolverAtras, zonaPermitida, debeIgnorar, hastaIgnorar, hastaLibre, toqueEnVelo, TRAS_DIALOGO_MS } from "../src/salida.js";
import { relojNuevo, relojPausar, relojReanudar, relojReiniciar, relojMs } from "../src/reloj.js";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const leer = (p) => JSON.parse(fs.readFileSync(path.join(raiz, p), "utf8"));
const indice = leer("datos/indice.json");
const cuentos = indice.orden.map((id) => leer(`datos/cuentos/${id}.json`));
const glosario = leer("datos/glosario.json");

function vozFalsa(voces, speak) {
  return {
    speaking: false,
    pending: false,
    getVoices: () => voces,
    cancel() {},
    resume() {},
    speak,
  };
}

class Enunciado {
  constructor(texto) { this.texto = texto; }
}

test("un error de speechSynthesis no es el final de la voz", () => {
  let fin = 0;
  let fallo = null;
  let hablo = 0;
  const sintesis = vozFalsa([{ lang: "es-MX" }], (u) => {
    hablo += 1;
    u.onerror?.({ error: "network" });
  });
  const ok = hablarTexto("Hola", "es", {
    sintesis,
    Utterance: Enunciado,
    despues: () => 0,
    cancelar() {},
    alTerminar: () => { fin += 1; },
    alFallar: (m) => { fallo = m; },
  });
  assert.equal(ok, true);
  assert.equal(hablo, 1);
  assert.equal(fin, 0);
  assert.equal(fallo, "network");
});

test("getVoices vacío es desconocido: se habla, y onend es el final", () => {
  let fin = 0;
  let fallo = 0;
  let dicho = null;
  const ayuda = vozFalsa([], (u) => {
    dicho = u;
    u.onstart?.();
    u.onend?.();
  });
  const ok = hablarTexto("Ponlo en orden.", "es", {
    sintesis: ayuda,
    Utterance: Enunciado,
    despues: () => 0,
    cancelar() {},
    alTerminar: () => { fin += 1; },
    alFallar: () => { fallo += 1; },
  });
  assert.equal(ok, true);
  assert.equal(fin, 1);
  assert.equal(fallo, 0);
  assert.equal(dicho.voice, undefined);
  assert.match(dicho.lang, /^es/i);

  dicho = null;
  const cuento = vozFalsa([], (u) => {
    dicho = u;
    u.onstart?.();
    u.onend?.();
  });
  hablarTexto("The wolf huffed.", "en", {
    sintesis: cuento,
    Utterance: Enunciado,
    despues: () => 0,
    cancelar() {},
    alTerminar() {},
    alFallar() { fallo += 1; },
  });
  assert.equal(fallo, 0);
  assert.equal(dicho.voice, undefined);
  assert.match(dicho.lang, /^en/i);
});

test("al abrir se piden las voces y voiceschanged elige la que llega después", () => {
  const voces = [];
  let oyente = null;
  let pedidos = 0;
  let dicho = null;
  const sintesis = {
    speaking: false,
    pending: false,
    getVoices() { pedidos += 1; return voces.slice(); },
    cancel() {},
    resume() {},
    addEventListener(tipo, fn) { if (tipo === "voiceschanged") oyente = fn; },
    speak(u) { dicho = u; u.onstart?.(); u.onend?.(); },
  };
  prepararVoces(sintesis);
  assert.ok(pedidos >= 1);
  assert.equal(typeof oyente, "function");
  const opts = { sintesis, Utterance: Enunciado, despues: () => 0, cancelar() {}, alTerminar() {}, alFallar() {} };
  hablarTexto("Hola", "es", opts);
  assert.equal(dicho.voice, undefined);
  assert.match(dicho.lang, /^es/i);
  const paulina = { lang: "es-MX", name: "Paulina" };
  voces.push(paulina);
  oyente();
  voces.length = 0;
  hablarTexto("Hola", "es", opts);
  assert.equal(dicho.voice, paulina);
  assert.match(dicho.lang, /^es/i);
});

test("onend sin onstart, o una voz que no arranca, no es el final", () => {
  let fin = 0;
  const motivos = [];
  const sinArranque = vozFalsa([{ lang: "en-US" }], (u) => { u.onend?.(); });
  hablarTexto("Wolf", "en", {
    sintesis: sinArranque,
    Utterance: Enunciado,
    despues: () => 0,
    cancelar() {},
    alTerminar: () => { fin += 1; },
    alFallar: (m) => motivos.push(m),
  });
  assert.equal(fin, 0);
  assert.deepEqual(motivos, ["no-arranco"]);

  let vigilante = null;
  const quieta = vozFalsa([{ lang: "en-US" }], () => {});
  hablarTexto("Wolf", "en", {
    sintesis: quieta,
    Utterance: Enunciado,
    vigiliaMs: 700,
    despues: (fn) => { vigilante = fn; return 1; },
    cancelar() {},
    alTerminar: () => { fin += 1; },
    alFallar: (m) => motivos.push(m),
  });
  assert.equal(fin, 0);
  assert.equal(motivos.length, 1);
  vigilante();
  assert.equal(fin, 0);
  assert.deepEqual(motivos, ["no-arranco", "no-arranco"]);
});

test("la voz que arranca y termina sí avisa el final", () => {
  let fin = 0;
  let fallo = 0;
  const sintesis = vozFalsa([{ lang: "es-ES" }], (u) => { u.onstart?.(); u.onend?.(); });
  hablarTexto("Ponlo en orden.", "es", {
    sintesis,
    Utterance: Enunciado,
    despues: () => 0,
    cancelar() {},
    alTerminar: () => { fin += 1; },
    alFallar: () => { fallo += 1; },
  });
  assert.equal(fin, 1);
  assert.equal(fallo, 0);
});

test("interrumpir la voz no cuenta como final", () => {
  let fin = 0;
  let fallo = 0;
  const sintesis = vozFalsa([{ lang: "es-MX" }], (u) => { u.onerror?.({ error: "interrupted" }); });
  hablarTexto("Hola", "es", {
    sintesis,
    Utterance: Enunciado,
    despues: () => 0,
    cancelar() {},
    alTerminar: () => { fin += 1; },
    alFallar: () => { fallo += 1; },
  });
  assert.equal(fin, 0);
  assert.equal(fallo, 0);
});

test("si no hay grabación ni voz, la frase no se salta", () => {
  let fin = 0;
  let fallo = 0;
  decirGrabacion("audio/f/no-esta.mp3", {
    respaldo: "The wolf huffed.",
    alTerminar: () => { fin += 1; },
    alFallar: () => { fallo += 1; },
  });
  assert.equal(fin, 0);
  assert.equal(fallo, 1);
});

test("un fallo de voz no adelanta el paso para mirar: entre 2 y 3 segundos", () => {
  let g = guiaNueva(0);
  assert.equal(esMirar(g.paso), true);
  g = reducirGuia(g, { tipo: "voz", resultado: "fallo", ahora: 100 });
  assert.equal(g.paso, 0);
  assert.equal(g.voz.fallo, true);
  assert.equal(g.voz.termino, false);
  assert.equal(g.voz.activa, false);
  assert.equal(debeAutoAvanzar(g, AUTO_MIRAR_MS - 1), false);
  assert.equal(debeAutoAvanzar(g, AUTO_MIRAR_MS), true);

  const hablando = guiaNueva(0);
  assert.equal(debeAutoAvanzar(hablando, AUTO_MIRAR_MS), false);
  assert.equal(debeAutoAvanzar(hablando, TOPE_VOZ_MS - 1), false);
  assert.equal(debeAutoAvanzar(hablando, TOPE_VOZ_MS), true);

  const dijo = notaVoz(guiaNueva(0), "termino");
  assert.equal(debeAutoAvanzar(dijo, 1000), false);
  assert.equal(debeAutoAvanzar(dijo, AUTO_MIRAR_MS), true);
});

test("en un paso para mirar, el candado dura 1 s y no se trunca a 32 bits", () => {
  const g0 = guiaNueva(0);
  assert.equal(g0.bloqueoHasta, BLOQUEO_MIRAR_MS);
  assert.equal(reducirGuia(g0, { tipo: "toque", ahora: 0 }).paso, 0);
  assert.equal(reducirGuia(g0, { tipo: "ok", ahora: 999 }).paso, 0);
  assert.equal(reducirGuia(g0, { tipo: "toque", ahora: 1000 }).paso, 1);
  const T = 1.7e12;
  const grande = guiaNueva(T);
  assert.equal(grande.bloqueoHasta, T + BLOQUEO_MIRAR_MS);
  assert.notEqual((T + BLOQUEO_MIRAR_MS) | 0, T + BLOQUEO_MIRAR_MS);
  assert.equal(reducirGuia(grande, { tipo: "ok", ahora: T + 999 }).paso, 0);
  let rafaga = reducirGuia(grande, { tipo: "ok", ahora: T + 1000 });
  rafaga = reducirGuia(rafaga, { tipo: "ok", ahora: T + 1000 });
  assert.equal(rafaga.paso, 1);
  assert.equal(saltarEnFlechas(), false);
  assert.equal(textoPaso(2, true, false).includes("Toca"), false);
  assert.match(textoPaso(2, false, false), /primera/);
  assert.equal(fraseListo(true).texto.includes("Toca"), false);
  assert.equal(textoCorto("cruce"), "Elige un final.");
  assert.equal(toqueEnVelo({ tv: false }), "seguir");
  assert.equal(toqueEnVelo({ tv: true }), "nada");
  assert.equal(toqueEnVelo({ enDialogo: true }), "nada");
  assert.equal(hastaLibre(T + 1500, T + 400), T + 1500);
});

test("¿Salir? pausa el paso, ignora la voz y al seguir empieza otra vez", () => {
  let g = reducirGuia(guiaNueva(0), { tipo: "atras", ahora: 800 });
  assert.equal(g.dialogo, true);
  assert.equal(relojMs(g.reloj, 5000), 800);
  assert.equal(debeAutoAvanzar(g, 5000), false);
  g = reducirGuia(g, { tipo: "voz", resultado: "termino", ahora: 900 });
  assert.equal(g.voz.termino, false);
  g = reducirGuia(g, { tipo: "seguir", ahora: 2000 });
  assert.equal(g.dialogo, false);
  assert.equal(g.paso, 0);
  assert.equal(g.voz.activa, true);
  assert.equal(g.voz.termino, false);
  assert.equal(g.voz.fallo, false);
  assert.equal(g.reloj.inicio, 2000);
  assert.equal(g.ignorarHasta, 2000 + TRAS_DIALOGO_MS);
  assert.equal(reducirGuia(g, { tipo: "toque", ahora: 2100 }).paso, 0);
  assert.equal(reducirGuia(g, { tipo: "ok", ahora: 2300 }).paso, 0);
  assert.equal(reducirGuia(g, { tipo: "toque", ahora: 2400 }).paso, 1);
  assert.equal(debeAutoAvanzar(g, 2300), false);
});

test("salir no guarda la guía; saltar y terminarla, sí", () => {
  let g = reducirGuia(guiaNueva(0), { tipo: "atras", ahora: 100 });
  g = reducirGuia(g, { tipo: "salir", ahora: 200 });
  assert.equal(g.fin, true);
  assert.equal(g.guardar, false);
  assert.equal(g.salir, true);
  const salto = reducirGuia(guiaNueva(0), { tipo: "saltar", ahora: 2000 });
  assert.equal(salto.fin, true);
  assert.equal(salto.guardar, true);
});

test("si la lectura falla, la frase no se salta", () => {
  const frases = ["The wolf huffed.", "The pigs felt cozy."];
  const fallo = pasoLectura(frases, 0, "fallo");
  assert.equal(fallo.indice, 0);
  assert.equal(fallo.seguir, false);
  assert.equal(fallo.saltar, false);
  assert.ok(fallo.esperarMs >= 2000 && fallo.esperarMs <= 3000);
  assert.equal(fallo.tiempos.length, 3);
  assert.ok(duracionSiFalla("Hi.") >= 2000);
  assert.ok(duracionSiFalla("Jack climbs up the tall green plant to the clouds.") <= 3000);
  const fin = pasoLectura(frases, 0, "fin");
  assert.equal(fin.indice, 1);
  assert.equal(fin.seguir, true);
  assert.equal(fin.saltar, false);
});

test("los cuatro cuentos caben en el librero y en las reglas", () => {
  assert.deepEqual(validarIndice(indice.orden), []);
  cuentos.forEach((c, i) => {
    assert.deepEqual(validarCuento(c, i), [], c.id);
    const porque = c.capitulos.reduce((n, cap) => n + cap.tareas.filter((t) => t.tipo === "porque").length, 0);
    assert.equal(porque, 1, c.id);
  });
});

test("cada palabra tiene dibujo y cada frase tiene grabación", () => {
  const usadas = new Set();
  for (const c of cuentos) {
    for (const p of c.paginas) for (const o of p.oraciones) o.replace(/[A-Za-z']+/g, (w) => usadas.add(w.toLowerCase()));
    for (const cap of c.capitulos) for (const t of cap.tareas) {
      for (const txt of [t.pregunta, t.oracion, ...(t.opciones || []).map((op) => op.texto || op.titulo)]) {
        if (txt) String(txt).replace(/[A-Za-z']+/g, (w) => usadas.add(w.toLowerCase()));
      }
    }
  }
  for (const w of usadas) assert.ok(glosario[w], `falta ${w}`);
  for (const [clave, dato] of Object.entries(glosario)) {
    assert.ok(dato.es && dato.dibujo, clave);
    assert.equal(fs.existsSync(path.join(raiz, "arte", dato.dibujo)), true, dato.dibujo);
  }
  const lista = archivosDe(cuentos);
  for (const a of [...lista.frases, ...lista.palabras]) {
    assert.equal(fs.existsSync(path.join(raiz, "audio", a.archivo)), true, a.archivo);
  }
});

test("se ordena por id aunque el texto se parezca, y reacomodar no es a la primera", () => {
  let s = ordenNuevo(["paja", "palos"], ["palos", "paja"]);
  s = poner(tomar(s, "palos"), 1);
  assert.equal(s.errores, 0);
  assert.equal(estaCompleto(s), false);
  s = poner(tomar(s, "paja"), 0);
  assert.equal(estaCompleto(s), true);
  assert.equal(cuentaPrimeraOrden({ nivel: 1, vioCompleta: false, cambios: 2, errores: 0, tarjetas: 2, acerto: true }), true);
  assert.equal(cuentaPrimeraOrden({ nivel: 1, vioCompleta: false, cambios: 4, errores: 0, tarjetas: 3, acerto: true }), false);
  assert.equal(cuentaPrimeraOrden({ nivel: 2, vioCompleta: true, cambios: 3, errores: 0, tarjetas: 3, acerto: true }), false);
  assert.equal(cuentaPrimeraPregunta({ nivel: 1, vioCompleta: true, acerto: true }), true);
  assert.equal(cuentaPrimeraPregunta({ nivel: 2, vioCompleta: true, acerto: true }), false);
  assert.equal(fasePista({ nivel: 1, tipo: "ordenar", ms: 0, errores: 0 }), "completa");
  let suelta = ordenNuevo(["paja", "palos"], ["palos", "paja"]);
  suelta = tomar(suelta, "palos");
  suelta = poner(suelta, 0);
  suelta = tomar(suelta, "palos");
  suelta = soltar(suelta);
  assert.equal(suelta.huecos[0], null);
  assert.deepEqual(suelta.mazo, ["paja", "palos"]);
  assert.deepEqual(idsEnLectura(ordenNuevo(["a", "b"], ["b"])), ["b"]);
  assert.equal(marcaPasoCompleto({ nivel: 1, fase: "completa", ms: 40000, errores: 0 }), false);
  assert.equal(marcaPasoCompleto({ nivel: 2, fase: "completa", ms: 40000, errores: 0 }), true);
});

test("el cruce no se califica y las estrellas salen de los aciertos a la primera", () => {
  assert.equal(califica({ tipo: "cruce" }), false);
  assert.equal(tareasCalificables([{ tipo: "cruce" }, { tipo: "quien" }]).length, 1);
  assert.equal(estrellasTurno(6, 6), 3);
  assert.equal(estrellasTurno(5, 6), 2);
  assert.equal(estrellasTurno(3, 6), 1);
  assert.equal(estrellasTurno(2, 6), 0);
});

test("el reto del día no tiene reloj y sale igual con la misma fecha", () => {
  const pr = nuevo();
  const a = retoDelDia("2026-10-09", cuentos, pr);
  const b = retoDelDia("2026-10-09", cuentos, pr);
  assert.deepEqual(a, b);
  assert.equal(a.reloj, false);
  assert.equal(a.items.length, 4);
  assert.equal(a.necesita, 3);
  for (const it of a.items) assert.equal(it.opciones.length, 3);
  const otro = retoDelDia("2026-10-10", cuentos, pr);
  assert.equal(otro.reloj, false);
});

test("dominio, reanudación, lectura sola y el libro siguiente", () => {
  let pr = nuevo();
  for (let i = 0; i < 8; i++) pr = anotarTarea(pr, "cerditos", { ok: true }, "2026-10-09");
  assert.equal(dominio(pr, "cerditos").listo, false);
  pr = anotarTarea(pr, "cerditos", { ok: false }, "2026-10-09");
  pr = anotarTarea(pr, "cerditos", { ok: true }, "2026-10-09");
  assert.equal(dominio(pr, "cerditos").listo, true);
  pr = guardarCurso(pr, "cerditos", { cap: 1, i: 2, tareas: [{ tipo: "quien" }], come: "hungry", aciertosCap: 3 });
  assert.equal(cuentoDe(pr, "cerditos").enCurso, true);
  assert.equal(cuentoDe(pr, "cerditos").i, 2);
  assert.equal(cuentoDe(pr, "cerditos").aciertosCap, 3);
  const cerrado = cerrarCapitulo(pr, "cerditos", 5, 5, true);
  assert.equal(cerrado.estrellas, 3);
  assert.equal(leeSolo(cerrado.pr, "cerditos"), true);
  assert.equal(cuentoDe(cerrado.pr, "cerditos").estrellas, 3);
  const libros = cuentos.map((c) => ({ id: c.id }));
  assert.equal(desbloqueado(libros, nuevo(), "cerditos"), true);
  assert.equal(desbloqueado(libros, nuevo(), "caperucita"), false);
  const abierto = ponerCuento(nuevo(), "cerditos", { ...cuentoDe(nuevo(), "cerditos"), completo: true });
  assert.equal(desbloqueado(libros, abierto, "caperucita"), true);
  const banco = bancoPalabras(cuentos);
  const tareas = [
    { tipo: "ordenar", tarjetas: ["paja"] },
    { tipo: "palabra", palabra: "cozy", oracion: "The pigs felt cozy.", opciones: [] },
  ];
  const repasadas = conRepaso(tareas, ["huffed"], banco);
  assert.equal(repasadas.at(-1).palabra, "huffed");
  assert.equal(repasadas.at(-1).repaso, true);
});

test("los 400 ms y el candado del paso se solapan: no se suman", () => {
  let g = guiaNueva(0);
  g = reducirGuia(g, { tipo: "toque", ahora: 1000 });
  g = reducirGuia(g, { tipo: "toque", ahora: 2000 });
  assert.equal(g.paso, 2);
  assert.equal(g.bloqueoHasta, 3500);
  g = reducirGuia(g, { tipo: "atras", ahora: 2200 });
  g = reducirGuia(g, { tipo: "seguir", ahora: 2400 });
  assert.equal(g.ignorarHasta, 2800);
  assert.equal(g.bloqueoHasta, 3500);
  assert.equal(hastaLibre(g.bloqueoHasta, g.ignorarHasta), 3500);
  assert.notEqual(hastaLibre(g.bloqueoHasta, g.ignorarHasta), 3500 + TRAS_DIALOGO_MS);
  assert.equal(reducirGuia(g, { tipo: "tomar", id: "casas", ahora: 2800 }).paso, 2);
  assert.equal(reducirGuia(g, { tipo: "tomar", id: "casas", ahora: 3499 }).paso, 2);
  assert.equal(reducirGuia(g, { tipo: "tomar", id: "casas", ahora: 3500 }).paso, 3);

  let tarde = guiaNueva(0);
  tarde = reducirGuia(tarde, { tipo: "toque", ahora: 1000 });
  tarde = reducirGuia(tarde, { tipo: "toque", ahora: 2000 });
  tarde = reducirGuia(tarde, { tipo: "atras", ahora: 4000 });
  tarde = reducirGuia(tarde, { tipo: "seguir", ahora: 4100 });
  assert.equal(tarde.bloqueoHasta, 3500);
  assert.equal(tarde.ignorarHasta, 4500);
  assert.equal(hastaLibre(tarde.bloqueoHasta, tarde.ignorarHasta), 4500);
  assert.equal(reducirGuia(tarde, { tipo: "tomar", id: "casas", ahora: 4499 }).paso, 2);
  assert.equal(reducirGuia(tarde, { tipo: "tomar", id: "casas", ahora: 4500 }).paso, 3);

  let mira = guiaNueva(0);
  mira = reducirGuia(mira, { tipo: "atras", ahora: 100 });
  mira = reducirGuia(mira, { tipo: "seguir", ahora: 200 });
  assert.equal(mira.bloqueoHasta, 1000);
  assert.equal(mira.ignorarHasta, 600);
  assert.equal(reducirGuia(mira, { tipo: "toque", ahora: 600 }).paso, 0);
  assert.equal(reducirGuia(mira, { tipo: "toque", ahora: 1000 }).paso, 1);
  assert.equal(reducirGuia(mira, { tipo: "saltar", ahora: 600 }).fin, false);
  assert.equal(reducirGuia(mira, { tipo: "saltar", ahora: 1000 }).fin, true);
});

test("tras el diálogo se ignoran toques un momento, y el reloj de la pista se reanuda", () => {
  assert.equal(resolverAtras(false), "abrir");
  assert.equal(resolverAtras(true), "cerrar");
  assert.equal(zonaPermitida(true, "fondo"), false);
  assert.equal(zonaPermitida(true, "dialogo"), true);
  assert.equal(debeIgnorar(100, hastaIgnorar(100)), true);
  assert.equal(debeIgnorar(hastaIgnorar(100), hastaIgnorar(100)), false);
  const p = relojPausar(relojNuevo(0), 1000);
  assert.equal(relojMs(p, 9000), 1000);
  assert.equal(relojMs(relojReanudar(p, 9000), 9500), 1500);
  assert.equal(relojMs(relojReiniciar(9000), 9500), 500);
  const cumplido = cumplirReto(nuevo(), "2026-10-09", "palabra", 3, true);
  assert.equal(cumplido.retos["2026-10-09"].cumplido, true);
});

test("la pantalla no arrastra ni usa emojis", () => {
  const juego = fs.readFileSync(path.join(raiz, "src/juego.js"), "utf8");
  const estilo = fs.readFileSync(path.join(raiz, "estilo.css"), "utf8");
  const textos = fs.readFileSync(path.join(raiz, "src/textos.js"), "utf8");
  for (const src of [juego, estilo, textos]) {
    assert.equal(src.includes("×"), false);
    assert.equal(/\p{Extended_Pictographic}/u.test(src), false);
  }
  assert.doesNotMatch(juego, /draggable|ondrag|ondrop|dragstart|pointermove/);
  assert.match(juego, /Escuchar|escuchar/);
  assert.match(juego, /boton-listo\.svg/);
});
