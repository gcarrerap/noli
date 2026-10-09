import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { rngConSemilla } from "../src/rng.js";
import { buscar } from "../../spelling/src/palabras.js";
import {
  AMBIGUAS, PLURALES_ES, PLURALES_S, PLURALES_IRR, PASADOS_ED, PASADOS_IRR, ORACIONES,
  tieneGrabacion, dibujosUsados, pideEs, tambienCorrecta, TERCERA, terceraDe, pasadoDe, SUSTANTIVOS,
} from "../src/banco.js";
import {
  generarTurno, crearTaller, problemas, efectoOracion, probarBrilla, quitarUltima,
  puertaPlural, puertaPasado, puertaRobot, fraseConPausa, buenasDe, focoSiguienteFicha,
} from "../src/puertas.js";
import { anulaPrimera, pasoPista, pista, FLECHA_S, COMPLETA_S } from "../src/pista.js";
import {
  esMirar, relojNuevo, pausarReloj, seguirReloj, sueltaEn, avanzaSolo, aplicarGuia,
  focoDePaso, saltarEnCiclo, vozPaso, textoPaso, BLOQUEO_MS, MIN_MIRAR_MS, TOPE_VOZ_MS, TRAS_GUIA_MS,
} from "../src/guia.js";
import { ignoraEntrada, responder, rutaAtras, toqueEnVelo, alTerminarPremio, TRAGAR_MS } from "../src/salida.js";
import {
  nuevo, cargar, registrar, dominio, cerrarTurno, guardarGuia, paraSubir,
  estrellasTurno, cumplirReto, racha, lineaRacha, anotarFallo, VENTANA,
} from "../src/progreso.js";
import { retoDelDia, RETO } from "../src/reto.js";
import { ORDEN, aspecto, sumarPieza } from "../src/piezas.js";
import { limpiarHabla, hablarSistema, calentarVoces, usarVoces, elegirVoz } from "../src/voz.js";
import { textoRacha, NIVELES, UI, hintDePuerta, vozDePista, textoGuia } from "../src/textos.js";

function secuencia(nums) {
  let i = 0;
  return () => nums[i++] ?? 0;
}

function turnos(nivel, k = 24) {
  const out = [];
  for (let i = 0; i < k; i++) out.push(generarTurno(nivel, rngConSemilla(`t-${nivel}-${i}`), []));
  return out;
}

test("el nivel 1 sube con 9 de los últimos 10 y los demás con 8", () => {
  assert.equal(paraSubir(1), 9);
  for (const n of [2, 3, 4, 5, 6, 7]) assert.equal(paraSubir(n), 8);
  let pr = nuevo();
  for (let i = 0; i < 10; i++) pr = registrar(pr, 1, i < 9, "2026-10-09");
  assert.equal(dominio(pr, 1).listo, true);
  pr = nuevo();
  for (let i = 0; i < 10; i++) pr = registrar(pr, 1, i < 8, "2026-10-09");
  assert.equal(dominio(pr, 1).listo, false);
  assert.equal(dominio(pr, 1).aciertos, 8);
  pr = nuevo();
  for (let i = 0; i < 10; i++) pr = registrar(pr, 2, i < 8, "2026-10-09");
  assert.equal(dominio(pr, 2).listo, true);
  pr = nuevo();
  for (let i = 0; i < 9; i++) pr = registrar(pr, 1, true, "2026-10-09");
  assert.equal(dominio(pr, 1).listo, false);
  assert.equal(VENTANA, 10);
});

test("las palabras ambiguas solo salen en un marco que las deja claras", () => {
  let hubo = false;
  for (const nivel of [1, 2, 3, 4, 5, 6, 7]) {
    for (const turno of turnos(nivel, 16)) {
      for (const puerta of turno) {
        assert.deepEqual(problemas(puerta), [], `${nivel} ${puerta.tipo} ${puerta.estructura}`);
        if (puerta.tipo === "taller" && AMBIGUAS.includes(puerta.palabra)) {
          hubo = true;
          assert.ok(puerta.marco === "a" || puerta.marco === "can");
          if (puerta.marco === "a") assert.equal(puerta.categoria, "noun");
          if (puerta.marco === "can") assert.equal(puerta.categoria, "verb");
          assert.ok(puerta.lectura.includes(puerta.palabra));
        }
        if (puerta.tipo === "laberinto") assert.equal(AMBIGUAS.includes(puerta.respuesta), false);
      }
    }
  }
  assert.equal(hubo, true);
  const clara = crearTaller(1, secuencia([0.1, 0.95, 0]), new Set(), new Set());
  assert.equal(clara.marco, null);
  assert.equal(AMBIGUAS.includes(clara.palabra), false);
  const enMarco = crearTaller(1, secuencia([0, 0, 0]), new Set(), new Set());
  assert.equal(enMarco.marco, "a");
  assert.equal(enMarco.palabra, "jump");
  assert.deepEqual(enMarco.lectura, ["a", "jump"]);
});

test("ninguna puerta usa estructuras de niveles cerrados", () => {
  for (let nivel = 1; nivel <= 7; nivel++) {
    for (const turno of turnos(nivel, 20)) {
      assert.equal(turno.length, 6);
      for (const puerta of turno) {
        const mal = problemas(puerta);
        assert.deepEqual(mal, [], `nivel ${nivel}: ${mal.join(",")} ${puerta.lectura.join(" ")}`);
        assert.ok(puerta.lectura.length <= 6);
        assert.equal(puerta.espera, true);
        assert.equal(puerta.limiteMs, undefined);
        if (nivel < 7) {
          for (const w of puerta.lectura) assert.equal(TERCERA.has(w), false, w);
        }
        if (nivel === 4 && puerta.tipo === "laberinto") {
          const s = puerta.lectura.join(" ");
          assert.match(s, /^(Two \S+ can run|I see two \S+)$/);
          assert.equal(s.includes("ran"), false);
          assert.equal(s.includes("away"), false);
        }
      }
    }
  }
});

test("fish y fishes no pueden ser correcta e incorrecta a la vez", () => {
  assert.equal(tambienCorrecta("fish", "fishes"), true);
  assert.equal(tambienCorrecta("sheep", "sheeps"), true);
  for (const turno of turnos(4, 30).concat(turnos(3, 10))) {
    for (const puerta of turno) {
      if (puerta.tipo !== "laberinto") continue;
      for (const op of puerta.opciones) {
        if (op.palabra !== puerta.respuesta) {
          assert.equal(tambienCorrecta(puerta.respuesta, op.palabra), false, puerta.respuesta + "/" + op.palabra);
        }
      }
      assert.equal(puerta.opciones.some((o) => o.palabra === "fishes"), false);
    }
  }
  const fish = PLURALES_IRR.find((p) => p.base === "fish");
  assert.equal(fish.plural, "fish");
  assert.equal(PLURALES_ES.some((p) => p.base === "fish"), false);
});

test("el plural en -es solo va después de s, sh, ch o x", () => {
  assert.deepEqual(PLURALES_ES.map((p) => p.base).sort(), ["box", "bus", "dish", "watch"]);
  for (const p of PLURALES_ES) assert.equal(pideEs(p.base), true, p.base);
  for (const p of PLURALES_S) assert.equal(pideEs(p.base), false, p.base);
  assert.equal(PLURALES_IRR.length, 10);
  assert.equal(PASADOS_IRR.length, 12);
  assert.deepEqual(PASADOS_ED.map((p) => p.sonido).sort(), ["d", "id", "id", "t", "t"]);
});

test("el banco de Spelling se lee y no hace falta copia de la palabra", () => {
  assert.equal(tieneGrabacion("cat"), true);
  assert.equal(tieneGrabacion("jumped"), true);
  assert.equal(tieneGrabacion("played"), true);
  assert.equal(tieneGrabacion("wanted"), true);
  assert.equal(tieneGrabacion("mice"), false);
  assert.equal(buscar("cat").palabra, "cat");
  const audio = new URL("../../spelling/audio/p/jumped.mp3", import.meta.url);
  assert.equal(fs.existsSync(audio), true);
  for (const id of dibujosUsados()) {
    const archivo = new URL(`../dibujos/dibujo-${id}.svg`, import.meta.url);
    assert.equal(fs.existsSync(archivo), true, id);
  }
});

test("la puerta secreta es el único reto, sin reloj, y sale igual con la misma fecha", () => {
  assert.equal(RETO.contrarreloj, false);
  assert.equal(RETO.necesita, 4);
  assert.equal(RETO.cuantos, 6);
  assert.equal(RETO.nombre, "Puerta secreta");
  const a = retoDelDia("2026-10-09", 4);
  const b = retoDelDia("2026-10-09", 4);
  const c = retoDelDia("2026-10-10", 4);
  assert.deepEqual(a.puertas, b.puertas);
  assert.notDeepEqual(a.puertas, c.puertas);
  assert.equal(a.puertas.length, 6);
  for (const puerta of a.puertas) assert.deepEqual(problemas(puerta), []);
});

test("el paso completo a los 40 s no cuenta como a la primera", () => {
  assert.equal(FLECHA_S, 20);
  assert.equal(COMPLETA_S, 40);
  assert.equal(anulaPrimera(1, 40, 0), false);
  assert.equal(anulaPrimera(2, 19, 0), false);
  assert.equal(anulaPrimera(2, 20, 0), false);
  assert.equal(anulaPrimera(2, 40, 0), true);
  assert.equal(anulaPrimera(2, 0, 1), true);
  assert.equal(pasoPista(1, 0, 0), "completo");
  assert.equal(pasoPista(2, 0, 0), "corto");
  assert.equal(pasoPista(2, 20, 0), "flecha");
  assert.equal(pasoPista(2, 40, 0), "completo");
  assert.equal(pista({ nivel: 1, palabra: "head", categoria: "noun" }).texto, "Head es una pieza.");
  assert.equal(pista({ nivel: 2, segundos: 0 }).texto, "Escucha otra vez.");
  assert.equal(pista({ nivel: 3, segundos: 40, palabra: "jump", categoria: "verb" }).anula, true);
});

test("¿Salir? pausa el paso de la guía y Seguir reinicia el reloj y la voz", () => {
  let r = relojNuevo(1, 0);
  r = pausarReloj(r, 500);
  assert.equal(r.pausa, true);
  assert.equal(avanzaSolo(r, 10000, { epoch: 1, termino: true }), false);
  const parado = aplicarGuia(r, { tipo: "ok" }, 10000, { epoch: 1, termino: true });
  assert.equal(parado.hecho, "ignorar");
  assert.equal(parado.reloj.paso, 1);
  r = seguirReloj(r, 5000);
  assert.equal(r.pausa, false);
  assert.equal(r.paso, 1);
  assert.equal(r.inicio, 5000);
  assert.equal(r.vozEpoch, 2);
  assert.equal(r.tragarHasta, 5000 + TRAGAR_MS);
  assert.equal(avanzaSolo(r, 5000 + 2999, { epoch: 2, termino: false }), false);
  assert.equal(avanzaSolo(r, 5000 + TOPE_VOZ_MS, { epoch: 2, termino: false }), true);
  assert.equal(avanzaSolo(r, 5000 + 1500, { epoch: 1, termino: true }), false);
  assert.equal(avanzaSolo(r, 5000 + MIN_MIRAR_MS - 1, { epoch: 2, termino: true }), false);
  assert.equal(avanzaSolo(r, 5000 + MIN_MIRAR_MS, { epoch: 2, termino: true }), true);
});

test("tras cerrar ¿Salir?, un toque u OK antes de 400 ms no pasa", () => {
  assert.equal(TRAGAR_MS, 400);
  const hasta = 1000 + TRAGAR_MS;
  assert.equal(ignoraEntrada(hasta, 1399, "toque"), true);
  assert.equal(ignoraEntrada(hasta, 1399, "ok"), true);
  assert.equal(ignoraEntrada(hasta, 1399, "caja"), true);
  assert.equal(ignoraEntrada(hasta, 1400, "ok"), false);
  assert.equal(ignoraEntrada(hasta, 1400, "toque"), false);
  assert.equal(ignoraEntrada(hasta, 1399, "flecha"), false);
  const r = { paso: 1, inicio: 0, pausa: false, vozEpoch: 1, tragarHasta: 5000 };
  assert.equal(aplicarGuia(r, { tipo: "ok" }, 4999, null).hecho, "ignorar");
  assert.equal(aplicarGuia(r, { tipo: "toque" }, 4999, null).hecho, "ignorar");
  assert.equal(aplicarGuia(r, { tipo: "ok" }, 5000, null).hecho, "avanzo");
  const ctx = { dialogo: true, reloj: relojNuevo(2, 0), tragarHasta: 0 };
  const seguido = responder(ctx, { tipo: "seguir", ahora: 8000 });
  assert.equal(seguido.hecho, "seguir");
  assert.equal(seguido.dialogo, false);
  assert.equal(seguido.reloj.inicio, 8000);
  assert.equal(seguido.reloj.vozEpoch, 2);
  assert.equal(seguido.repetirVoz, true);
  assert.equal(ignoraEntrada(seguido.tragarHasta, 8399, "ok"), true);
  assert.equal(ignoraEntrada(seguido.tragarHasta, 8400, "toque"), false);
});

test("Atrás abre ¿Salir? y el segundo lo cierra; solo el diálogo responde", () => {
  assert.equal(rutaAtras(false), "abrir");
  assert.equal(rutaAtras(true), "cerrar");
  const abierto = responder({ dialogo: false, reloj: relojNuevo(3, 10), tragarHasta: 0 }, { tipo: "atras", ahora: 20 });
  assert.equal(abierto.hecho, "abrir");
  assert.equal(abierto.dialogo, true);
  assert.equal(abierto.reloj.pausa, true);
  const cerrado = responder(abierto, { tipo: "atras", ahora: 30 });
  assert.equal(cerrado.hecho, "seguir");
  assert.equal(cerrado.dialogo, false);
  assert.equal(responder(abierto, { tipo: "toque", ahora: 25 }).hecho, "ignorar");
  assert.equal(responder(abierto, { tipo: "caja", ahora: 25 }).hecho, "ignorar");
  assert.equal(responder(abierto, { tipo: "ok", ahora: 25 }).hecho, "dialogo");
  assert.equal(responder(abierto, { tipo: "salir-si", ahora: 25 }).hecho, "salir");
  assert.equal(responder({ dialogo: false, reloj: null, tragarHasta: 0 }, { tipo: "atras", ahora: 1 }).hecho, "abrir");
});

test("la guía: mirar avanza solo, actuar no, y Saltar no recibe el foco", () => {
  assert.equal(esMirar(1), true);
  assert.equal(esMirar(3), false);
  assert.equal(avanzaSolo(relojNuevo(3, 0), 99999, { epoch: 1, termino: true }), false);
  assert.equal(aplicarGuia(relojNuevo(3, 0), { tipo: "ok" }, 5000, null).hecho, "no");
  assert.equal(aplicarGuia(relojNuevo(3, 0), { tipo: "caja", categoria: "verb" }, 5000, null).hecho, "mal");
  assert.equal(aplicarGuia(relojNuevo(3, 0), { tipo: "ok" }, 5000, null).hecho, "no");
  assert.equal(aplicarGuia(relojNuevo(3, 0), { tipo: "caja", categoria: "noun" }, 5000, null).hecho, "avanzo");
  assert.equal(aplicarGuia(relojNuevo(4, 0), { tipo: "caja", categoria: "verb" }, 5000, null).hecho, "avanzo");
  assert.equal(aplicarGuia(relojNuevo(1, 0), { tipo: "toque" }, 300, null).hecho, "bloqueo");
  assert.equal(aplicarGuia(relojNuevo(1, 0), { tipo: "ok" }, BLOQUEO_MS[1], null).hecho, "avanzo");
  assert.equal(aplicarGuia(relojNuevo(2, 0), { tipo: "ok" }, 30, null).hecho, "bloqueo");
  assert.equal(aplicarGuia(relojNuevo(2, 0), { tipo: "ok" }, BLOQUEO_MS[2], null).hecho, "avanzo");
  assert.equal(aplicarGuia(relojNuevo(3, 0), { tipo: "caja", categoria: "noun" }, BLOQUEO_MS[3] - 1, null).hecho, "bloqueo");
  assert.equal(aplicarGuia(relojNuevo(5, 0), { tipo: "ok" }, BLOQUEO_MS[5] - 1, null).hecho, "bloqueo");
  assert.equal(aplicarGuia(relojNuevo(5, 0), { tipo: "ok" }, 5000, null).hecho, "fin");
  assert.equal(aplicarGuia(relojNuevo(5, 0), { tipo: "ok" }, 5000, null).tragarHasta, 5000 + TRAS_GUIA_MS);
  for (const paso of [1, 2, 3, 4, 5]) {
    assert.notEqual(focoDePaso(paso), "saltar");
    assert.equal(saltarEnCiclo(paso), false);
    assert.doesNotMatch(vozPaso(paso, true), /[◀▶▼▲+×]/);
    assert.equal(limpiarHabla(textoPaso(paso, true)).includes("◀"), false);
  }
  assert.match(textoPaso(3, true), /Pulsa ◀/);
  assert.match(vozPaso(3, true), /Pulsa izquierda/);
  assert.match(textoPaso(4, true), /Pulsa ▼/);
  assert.equal(vozPaso(4, false).includes("Toca"), false);
  assert.match(textoPaso(1, false), /Arma tu robot/);
  assert.match(textoPaso(2, false), /Pieza, moverse, cómo es/);
  assert.match(textoPaso(5, false), /Tu robot salta/);
  const pr = guardarGuia(guardarGuia(nuevo(), "fin"), "saltar");
  assert.equal(pr.guiaHecha, true);
  assert.equal(guardarGuia(nuevo(), "fin").guiaHecha, false);
});

test("las estrellas salen de los aciertos a la primera y las piezas van en orden", () => {
  assert.equal(estrellasTurno(6), 3);
  assert.equal(estrellasTurno(5), 2);
  assert.equal(estrellasTurno(3), 1);
  assert.equal(estrellasTurno(2), 0);
  let pr = nuevo();
  for (let i = 0; i < 10; i++) pr = registrar(pr, 1, true, "2026-10-09");
  const fin = cerrarTurno(pr, 1, 6);
  assert.equal(fin.estrellas, 3);
  assert.equal(fin.subio, 2);
  assert.equal(fin.pieza, ORDEN[0]);
  assert.deepEqual(fin.pr.piezas, [ORDEN[0]]);
  let piezas = [];
  for (const id of ORDEN) {
    const s = sumarPieza(piezas);
    assert.equal(s.nueva, id);
    piezas = s.piezas;
  }
  assert.equal(sumarPieza(piezas).nueva, null);
  const look = aspecto(["cabeza-2", "piernas-1"]);
  assert.equal(look.cabeza, "cabeza-2");
  assert.equal(look.base, "piernas-1");
  assert.equal(look.brazos, "brazos-1");
});

test("la oración al revés se ríe, sin verbo duda, y Quitar saca la última", () => {
  const puerta = {
    meta: ["The", "tiny", "robot", "jumps"],
    alReves: ["The", "robot", "tiny", "jumps"],
    verbo: "jumps",
  };
  assert.equal(efectoOracion(["The", "robot", "tiny", "jumps"], puerta), "risa");
  assert.equal(efectoOracion(["The", "tiny", "robot"], puerta), "duda");
  assert.equal(efectoOracion(puerta.meta, puerta), "actua");
  assert.equal(probarBrilla(puerta.meta, puerta), true);
  assert.equal(probarBrilla(["The", "robot", "tiny", "jumps"], puerta), false);
  assert.deepEqual(quitarUltima(["The", "tiny"]), ["The"]);
  assert.equal(efectoOracion(["The", "tiny", "robot", "jump"], puerta), "falta-s");
  assert.equal(efectoOracion(["The", "robot", "tiny", "jump"], puerta), "risa");
});

test("los fallos regresan y la racha no regaña", () => {
  const pr = anotarFallo(nuevo(), "dog");
  const puerta = crearTaller(1, secuencia([0.1, 0.95, 0]), new Set(), new Set(pr.fallos));
  assert.equal(puerta.palabra, "dog");
  assert.equal(textoRacha(0).includes("perdist"), false);
  assert.match(lineaRacha(nuevo(), "2026-10-09"), /reto de hoy/);
  let con = cumplirReto(nuevo(), "2026-10-09", "puerta-secreta", 4, true);
  con = cumplirReto(con, "2026-10-08", "puerta-secreta", 4, true);
  assert.equal(racha(con, "2026-10-09"), 2);
  assert.equal(cargar(null).voz, true);
  assert.equal(cargar({ v: 1, voz: false }).voz, false);
  assert.equal(NIVELES.length, 7);
});

function vozFalsa(speak) {
  class Frase {
    constructor(texto) {
      this.texto = texto;
      this.onstart = null;
      this.onend = null;
      this.onerror = null;
    }
  }
  return {
    Utterance: Frase,
    sintesis: {
      speaking: false,
      pending: false,
      getVoices: () => [{ lang: "es-MX", name: "Prueba" }],
      cancel() {},
      speak,
    },
  };
}

test("un error de speechSynthesis no cuenta como el fin de la voz", async () => {
  const fallo = vozFalsa((u) => { u.onerror?.({ error: "synthesis-failed" }); });
  const mal = await hablarSistema("Arma tu robot.", "es-MX", fallo);
  assert.equal(mal.acabo, false);
  const reloj = relojNuevo(1, 0);
  const voz = { epoch: 1, termino: mal.acabo, falla: true };
  assert.equal(avanzaSolo(reloj, 100, voz), false);
  assert.equal(avanzaSolo(reloj, MIN_MIRAR_MS - 1, voz), false);
  assert.equal(avanzaSolo(reloj, MIN_MIRAR_MS, voz), true);
  assert.equal(avanzaSolo(reloj, TOPE_VOZ_MS, { epoch: 1, termino: false }), true);
  assert.equal(avanzaSolo(reloj, MIN_MIRAR_MS, { epoch: 1, termino: false }), false);
  assert.equal(aplicarGuia(reloj, { tipo: "toque" }, 40, voz).hecho, "bloqueo");
  assert.equal(aplicarGuia(relojNuevo(1, 0), { tipo: "ok" }, 40, voz).hecho, "bloqueo");

  const quieta = vozFalsa(() => {});
  assert.equal((await hablarSistema("Tu robot salta.", "es-MX", { ...quieta, topeMs: 20 })).acabo, false);

  const bien = vozFalsa((u) => { u.onstart?.(); u.onend?.(); });
  assert.equal((await hablarSistema("Arma tu robot.", "es-MX", bien)).acabo, true);
  assert.equal(avanzaSolo(relojNuevo(1, 0), MIN_MIRAR_MS - 1, { epoch: 1, termino: true }), false);
  assert.equal(avanzaSolo(relojNuevo(1, 0), MIN_MIRAR_MS, { epoch: 1, termino: true }), true);
});

test("getVoices vacío no es «sin voz»: se habla y onend sí cuenta", async () => {
  usarVoces([]);
  let dicha = null;
  let lecturas = 0;
  let alCambiar = null;
  const voces = [];
  class Frase {
    constructor(texto) { this.texto = texto; }
  }
  const s = {
    speaking: false,
    pending: false,
    getVoices() { lecturas++; return voces.slice(); },
    cancel() {},
    speak(u) {
      dicha = u;
      u.onstart?.();
      u.onend?.();
    },
    addEventListener(tipo, fn) { if (tipo === "voiceschanged") alCambiar = fn; },
  };
  calentarVoces(s);
  assert.ok(lecturas >= 1);
  assert.equal(typeof alCambiar, "function");

  const vacio = await hablarSistema("Arma tu robot.", "es-MX", { sintesis: s, Utterance: Frase });
  assert.equal(vacio.acabo, true);
  assert.equal(dicha.lang, "es-MX");
  assert.equal(dicha.voice, undefined);
  assert.equal(dicha.texto, "Arma tu robot.");
  const reloj = relojNuevo(1, 0);
  assert.equal(avanzaSolo(reloj, MIN_MIRAR_MS - 1, { epoch: 1, termino: true }), false);
  assert.equal(avanzaSolo(reloj, MIN_MIRAR_MS, { epoch: 1, termino: true }), true);
  assert.equal(avanzaSolo(reloj, TOPE_VOZ_MS, { epoch: 1, termino: false }), true);

  voces.push({ lang: "en-US", name: "Samantha" }, { lang: "es-MX", name: "Paulina" });
  alCambiar();
  assert.equal(elegirVoz(voces, "es-MX").name, "Paulina");
  assert.equal(elegirVoz(voces, "en-GB").name, "Samantha");
  s.getVoices = () => [];
  const elegida = await hablarSistema("Pieza, moverse, cómo es.", "es-MX", { sintesis: s, Utterance: Frase });
  assert.equal(elegida.acabo, true);
  assert.equal(dicha.lang, "es-MX");
  assert.equal(dicha.voice.name, "Paulina");
});

test("el trago de 400 ms y el bloqueo del paso se solapan", () => {
  let queda = pausarReloj(relojNuevo(3, 1000), 1000 + BLOQUEO_MS[3] - 500);
  queda = seguirReloj(queda, 8000);
  assert.equal(queda.inicio, 8000);
  assert.equal(queda.tragarHasta, 8000 + TRAGAR_MS);
  assert.equal(queda.bloqueoHasta, 8000 + 500);
  assert.equal(sueltaEn(queda), 8000 + 500);
  assert.equal(aplicarGuia(queda, { tipo: "caja", categoria: "noun" }, 8000 + TRAGAR_MS - 1, null).hecho, "ignorar");
  assert.equal(aplicarGuia(queda, { tipo: "caja", categoria: "noun" }, 8000 + TRAGAR_MS, null).hecho, "bloqueo");
  assert.equal(aplicarGuia(queda, { tipo: "caja", categoria: "noun" }, 8000 + 499, null).hecho, "bloqueo");
  assert.equal(aplicarGuia(queda, { tipo: "caja", categoria: "noun" }, 8000 + 500, null).hecho, "avanzo");

  let libre = pausarReloj(relojNuevo(4, 0), BLOQUEO_MS[4] + 10);
  libre = seguirReloj(libre, 3000);
  assert.equal(sueltaEn(libre), 3000 + TRAGAR_MS);
  assert.equal(aplicarGuia(libre, { tipo: "caja", categoria: "verb" }, 3000 + TRAGAR_MS - 1, null).hecho, "ignorar");
  assert.equal(aplicarGuia(libre, { tipo: "caja", categoria: "verb" }, 3000 + TRAGAR_MS, null).hecho, "avanzo");

  let entero = seguirReloj(pausarReloj(relojNuevo(3, 0), 0), 1000);
  assert.equal(entero.bloqueoHasta, 1000 + BLOQUEO_MS[3]);
  assert.equal(sueltaEn(entero), 1000 + BLOQUEO_MS[3]);
  assert.notEqual(sueltaEn(entero), 1000 + BLOQUEO_MS[3] + TRAGAR_MS);
  assert.equal(aplicarGuia(entero, { tipo: "caja", categoria: "noun" }, 1000 + BLOQUEO_MS[3] - 1, null).hecho, "bloqueo");
  assert.equal(aplicarGuia(entero, { tipo: "caja", categoria: "noun" }, 1000 + BLOQUEO_MS[3], null).hecho, "avanzo");

  const mira = seguirReloj(pausarReloj(relojNuevo(1, 0), 10), 2000);
  assert.equal(mira.bloqueoHasta, 2000 + (BLOQUEO_MS[1] - 10));
  assert.equal(sueltaEn(mira), 2000 + (BLOQUEO_MS[1] - 10));
  assert.equal(aplicarGuia(mira, { tipo: "ok" }, 2000 + TRAGAR_MS, null).hecho, "bloqueo");
  assert.equal(aplicarGuia(mira, { tipo: "ok" }, 2000 + BLOQUEO_MS[1] - 10, null).hecho, "avanzo");

  let ya = pausarReloj(relojNuevo(1, 0), BLOQUEO_MS[1] + 50);
  ya = seguirReloj(ya, 5000);
  assert.equal(ya.bloqueoHasta, 5000);
  assert.equal(sueltaEn(ya), 5000 + TRAGAR_MS);
  assert.equal(aplicarGuia(ya, { tipo: "toque" }, 5000 + 300, null).hecho, "ignorar");
  assert.equal(aplicarGuia(ya, { tipo: "ok" }, 5000 + TRAGAR_MS, null).hecho, "avanzo");
});

test("cada puerta del banco tiene una sola respuesta, con formas reales de la misma palabra", () => {
  const malas = ["boxs", "jumpt", "runned", "fishes", "sheeps", "mouses", "goed", "eated", "swimmed"];
  const todas = [];
  for (const item of [...PLURALES_S, ...PLURALES_ES]) todas.push(puertaPlural(item, 3, () => 0));
  for (const item of PLURALES_IRR) todas.push(puertaPlural(item, 4, () => 0));
  for (const item of [...PASADOS_ED, ...PASADOS_IRR]) todas.push(puertaPasado(item, item.sonido ? 5 : 6, () => 0));
  for (const item of ORACIONES) todas.push(puertaRobot(item, () => 0));
  assert.ok(todas.length >= 30);
  for (const p of todas) {
    assert.deepEqual(problemas(p), [], `${p.estructura} ${p.respuesta} ${problemas(p).join(",")}`);
    assert.equal(buenasDe(p).length, 1, p.respuesta);
    assert.equal(buenasDe(p)[0], p.respuesta);
    assert.ok(p.opciones.length >= 3, p.respuesta);
    assert.ok(p.dibujo, p.respuesta);
    const bases = new Set(p.familia);
    for (const o of p.opciones) {
      assert.equal(bases.has(o.palabra), true, o.palabra);
      assert.equal(malas.includes(o.palabra), false, o.palabra);
    }
    const pausa = fraseConPausa(p).split(/\s+/);
    assert.equal(pausa.includes("mm"), true, fraseConPausa(p));
    assert.equal(pausa.includes(p.respuesta), false, `${p.respuesta} en ${fraseConPausa(p)}`);
  }
  for (const nivel of [3, 4, 5, 6, 7]) {
    for (const turno of turnos(nivel, 12)) {
      for (const puerta of turno) {
        if (puerta.tipo !== "laberinto") continue;
        assert.equal(buenasDe(puerta).length, 1, puerta.respuesta);
        assert.equal(fraseConPausa(puerta).split(/\s+/).includes(puerta.respuesta), false);
      }
    }
  }
  const mouse = puertaPlural(PLURALES_IRR.find((p) => p.base === "mouse"), 4, () => 0);
  assert.deepEqual(mouse.familia.slice().sort(), ["a mouse", "mice", "mouse"].sort());
  assert.equal(hintDePuerta(mouse, false).texto.includes("mice"), false);
  assert.equal(hintDePuerta(mouse, true).texto, "Dos ratones: mice.");
  const box = puertaPlural(PLURALES_ES.find((p) => p.base === "box"), 3, () => 0);
  assert.equal(hintDePuerta(box, false).texto, "Más de uno: termina en -es.");
  assert.equal(hintDePuerta(box, true).texto.includes("boxes"), false);
  const jumped = puertaPasado(PASADOS_ED.find((p) => p.base === "jump"), 5, () => 0);
  assert.equal(hintDePuerta(jumped, false).texto, "Ayer: termina en -ed.");
  assert.equal(hintDePuerta(jumped, true).texto, "Ayer: jumped.");
  assert.deepEqual(hintDePuerta(jumped, true).voz.map((t) => t.lang), ["es", "en"]);
  const robot = puertaRobot(ORACIONES[0], () => 0);
  assert.equal(hintDePuerta(robot, false).texto, "Un robot: le pones -s.");
  assert.equal(hintDePuerta(robot, true).texto.includes(robot.respuesta), true);
  const fish = puertaPlural(PLURALES_IRR.find((p) => p.base === "fish"), 4, () => 0);
  assert.equal(fish.opciones.some((o) => o.palabra === "fishes"), false);
  assert.equal(buenasDe(fish).length, 1);
  assert.equal(SUSTANTIVOS.some((s) => s.id === "watch"), false);
  assert.equal(AMBIGUAS.includes("watch"), true);
  for (const item of [...PASADOS_ED, ...PASADOS_IRR]) {
    assert.equal(new Set([item.base, terceraDe(item.base), item.pasado]).size, 3, item.base);
    assert.equal(pasadoDe(item.base), item.pasado);
  }
  assert.equal(vozDePista("head", "noun").texto, "Head es una pieza.");
  assert.equal(vozDePista("jump", "verb").texto, "Jump es moverse.");
  assert.equal(vozDePista("big", "adjective").texto, "Big es cómo es.");
  assert.match(vozDePista("head", "noun").texto, /una pieza/);
  assert.equal(vozDePista("head", "noun").texto.includes("un pieza"), false);
  for (const paso of [1, 2, 3, 4, 5]) assert.equal(textoGuia(paso, true).includes("Toca"), false);
  assert.equal(UI.brillaTv.includes("Toca"), false);
  assert.equal(UI.brillaVozTv.includes("Toca"), false);
  assert.equal(UI.miraEse, "Mira la s.");
  assert.equal(UI.orden, "¿Quién va primero?");
  const fichas = [{ palabra: "The" }, { palabra: "tiny" }, { palabra: "robot" }, { palabra: "jumps" }];
  assert.equal(focoSiguienteFicha(fichas, [], ["The", "tiny", "robot", "jumps"]), "ficha-0");
  assert.equal(focoSiguienteFicha(fichas, [{ i: 0, palabra: "The" }], ["The", "tiny", "robot", "jumps"]), "ficha-1");
  assert.equal(toqueEnVelo({ tv: false, enDialogo: false }), "seguir");
  assert.equal(toqueEnVelo({ tv: true, enDialogo: false }), "nada");
  assert.equal(toqueEnVelo({ tv: false, enDialogo: true }), "nada");
  assert.equal(alTerminarPremio({ dialogo: true, ms: 400 }).accion, "guardar");
  assert.equal(alTerminarPremio({ dialogo: false, ms: 400 }).accion, "correr");
  let buenas = 0;
  for (const turno of turnos(7, 8)) {
    for (const puerta of turno) {
      if (puerta.tipo !== "oracion") continue;
      const idxs = puerta.fichas.map((_, i) => i);
      const colocar = (usados, n) => {
        if (n === puerta.meta.length) {
          const palabras = usados.map((i) => puerta.fichas[i].palabra);
          if (efectoOracion(palabras, puerta) === "actua") buenas++;
          return;
        }
        for (const i of idxs) if (!usados.includes(i)) colocar([...usados, i], n + 1);
      };
      const antes = buenas;
      colocar([], 0);
      assert.equal(buenas - antes, 1, puerta.meta.join(" "));
    }
  }
});

test("los OK de más no contestan justo después de la guía", () => {
  const hasta = 1000 + TRAS_GUIA_MS;
  assert.equal(ignoraEntrada(hasta, 1999, "ok"), true);
  assert.equal(ignoraEntrada(hasta, 1999, "toque"), true);
  assert.equal(ignoraEntrada(hasta, 2000, "ok"), false);
});
