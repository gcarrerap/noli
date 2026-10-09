import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { CONFIG, RAREZAS } from "../src/reglas.js";
import { rngConSemilla } from "../src/rng.js";
import {
  estadoNuevo, cargar, puedeAbrir, sortearRareza, abrirCaja, comprar, simularColeccion,
  resumirCajas, cambiarLimite, ponerCerrada, cuentaRara, cuentaUltra, abrirConCreditos,
  abiertasHoy, marcarGuia,
} from "../src/coleccion.js";
import {
  PASOS, guiaAvanzaConToque, focoDeGuia, cuandoAvanzaMuestra, finBloqueoPaso,
  bloqueoAlSeguir, muestraPuedeAvanzar, aplicarGuia, GUIA_MIN_MS, GUIA_MAX_MS, GUIA_BLOQUEO_MS,
} from "../src/guia.js";
import { unirBloqueos, tapBloqueado, resolverAtras, toqueConDialogo, teclaConDialogo, TRAS_DIALOGO_MS } from "../src/salida.js";
import { decir, calentarVoces, escogerVoz, olvidarVoz, vozActual, paraVoz } from "../src/voz.js";
import { TEXTOS, textoGuia, vozGuia, fraseGarantia } from "../src/textos.js";
import { htmlFoto, rutaPieza, MARCA, fichasProbabilidad } from "../src/dibujo.js";

const piezas = JSON.parse(fs.readFileSync(new URL("../datos/piezas.json", import.meta.url), "utf8"));
const cero = () => 0;
const FECHA = "2026-10-09";

function idsDe(lista) {
  return lista.map((p) => p.id);
}

test("config de Ñoño y las 24 piezas", () => {
  assert.deepEqual(CONFIG.piezas, { comun: 16, rara: 6, ultra: 2 });
  assert.equal(CONFIG.piezas.comun + CONFIG.piezas.rara + CONFIG.piezas.ultra, 24);
  assert.equal(CONFIG.costoCaja, 5);
  assert.equal(CONFIG.limiteDiario, 2);
  assert.deepEqual(CONFIG.pesos, { comun: 75, rara: 20, ultra: 5 });
  assert.equal(CONFIG.garantiaRara, 8);
  assert.equal(CONFIG.garantiaUltra, 25);
  assert.equal(CONFIG.sinRepetir, 10);
  assert.deepEqual(CONFIG.polvoDuplicado, { comun: 1, rara: 3, ultra: 10 });
  assert.deepEqual(CONFIG.polvoPrecio, { comun: 5, rara: 15, ultra: 40 });
  assert.equal(piezas.length, 24);
  const conteo = { comun: 0, rara: 0, ultra: 0 };
  const ids = new Set();
  for (const p of piezas) {
    assert.equal(ids.has(p.id), false, p.id);
    ids.add(p.id);
    assert.ok(RAREZAS.includes(p.rareza), p.id);
    assert.equal(p.archivo, p.id);
    conteo[p.rareza] += 1;
    for (const suf of ["512.webp", "128.webp", "silueta.svg"]) {
      const ruta = new URL(`../assets/brumitos/${p.archivo}-${suf}`, import.meta.url);
      assert.equal(fs.existsSync(ruta), true, `${p.id} ${suf}`);
      const peso = fs.statSync(ruta).size;
      const tope = suf === "512.webp" ? 25000 : suf === "128.webp" ? 8000 : 1200;
      assert.ok(peso < tope, `${p.id} ${suf} pesa ${peso}`);
    }
  }
  assert.deepEqual(conteo, CONFIG.piezas);
});

test("probabilidades en muchos sorteos", () => {
  const rng = rngConSemilla("odds-brumitos");
  const n = 20000;
  const c = { comun: 0, rara: 0, ultra: 0 };
  for (let i = 0; i < n; i++) c[sortearRareza(rng)] += 1;
  assert.ok(Math.abs(c.comun / n - 0.75) < 0.02, String(c.comun / n));
  assert.ok(Math.abs(c.rara / n - 0.2) < 0.02, String(c.rara / n));
  assert.ok(Math.abs(c.ultra / n - 0.05) < 0.02, String(c.ultra / n));
});

test("la rara llega a más tardar en la caja 8", () => {
  let e = estadoNuevo();
  for (let i = 1; i <= 7; i++) {
    const r = abrirCaja(e, { rng: cero, piezas, fecha: FECHA });
    assert.equal(r.pieza.rareza, "comun", "caja " + i);
    e = r.estado;
    assert.equal(cuentaRara(e), 8 - i);
  }
  const r8 = abrirCaja(e, { rng: cero, piezas, fecha: FECHA });
  assert.equal(r8.pieza.rareza, "rara");
  assert.equal(cuentaRara(r8.estado), 8);
});

test("la ultra llega a más tardar en la caja 25", () => {
  let e = estadoNuevo();
  for (let i = 1; i <= 24; i++) {
    const r = abrirCaja(e, { rng: cero, piezas, fecha: FECHA });
    assert.notEqual(r.pieza.rareza, "ultra", "caja " + i);
    e = r.estado;
  }
  assert.equal(cuentaUltra(e), 1);
  const r25 = abrirCaja(e, { rng: cero, piezas, fecha: FECHA });
  assert.equal(r25.pieza.rareza, "ultra");
  assert.equal(cuentaUltra(r25.estado), CONFIG.garantiaUltra);
});

test("las primeras 10 cajas no repiten", () => {
  let e = estadoNuevo();
  const rng = rngConSemilla("sin-repetir");
  const vistos = [];
  for (let i = 0; i < 10; i++) {
    const r = abrirCaja(e, { rng, piezas, fecha: FECHA });
    assert.equal(r.duplicado, false, r.pieza.id);
    assert.equal(vistos.includes(r.pieza.id), false);
    vistos.push(r.pieza.id);
    e = r.estado;
  }
  assert.equal(new Set(e.tenidas).size, 10);
});

test("un repetido se vuelve polvo y no créditos", () => {
  const comunes = idsDe(piezas.filter((p) => p.rareza === "comun"));
  let e = { ...estadoNuevo(), tenidas: comunes, cajas: 10, desdeRara: 0, desdeUltra: 0 };
  const comun = abrirCaja(e, { rng: cero, piezas, fecha: FECHA });
  assert.equal(comun.duplicado, true);
  assert.equal(comun.polvoGanado, 1);
  assert.equal(comun.estado.polvo, 1);
  assert.equal(comun.estado.tenidas.length, comunes.length);
  assert.equal(comun.estado.creditos, undefined);

  const raras = idsDe(piezas.filter((p) => p.rareza === "rara"));
  e = { ...estadoNuevo(), tenidas: raras, cajas: 20, desdeRara: 7, desdeUltra: 0 };
  const rara = abrirCaja(e, { rng: cero, piezas, fecha: FECHA });
  assert.equal(rara.pieza.rareza, "rara");
  assert.equal(rara.duplicado, true);
  assert.equal(rara.polvoGanado, 3);

  const ultras = idsDe(piezas.filter((p) => p.rareza === "ultra"));
  e = { ...estadoNuevo(), tenidas: ultras, cajas: 30, desdeRara: 0, desdeUltra: 24 };
  const ultra = abrirCaja(e, { rng: cero, piezas, fecha: FECHA });
  assert.equal(ultra.pieza.rareza, "ultra");
  assert.equal(ultra.duplicado, true);
  assert.equal(ultra.polvoGanado, 10);
});

test("el polvo compra una pieza que falta", () => {
  const pipo = piezas.find((p) => p.id === "pipo");
  const lula = piezas.find((p) => p.id === "lula");
  const toto = piezas.find((p) => p.id === "toto");
  let e = { ...estadoNuevo(), polvo: 5 };
  const bien = comprar(e, pipo.id, piezas);
  assert.equal(bien.ok, true);
  assert.equal(bien.estado.polvo, 0);
  assert.ok(bien.estado.tenidas.includes("pipo"));
  assert.equal(comprar(bien.estado, pipo.id, piezas).razon, "ya-la-tiene");

  e = { ...estadoNuevo(), polvo: 4 };
  assert.equal(comprar(e, pipo.id, piezas).ok, false);
  assert.equal(comprar(e, pipo.id, piezas).estado.polvo, 4);

  e = { ...estadoNuevo(), polvo: 15 };
  const rara = comprar(e, lula.id, piezas);
  assert.equal(rara.ok, true);
  assert.equal(rara.precio, 15);
  assert.equal(rara.estado.polvo, 0);

  e = { ...estadoNuevo(), polvo: 39 };
  assert.equal(comprar(e, toto.id, piezas).ok, false);
  e = { ...estadoNuevo(), polvo: 40 };
  const ultra = comprar(e, toto.id, piezas);
  assert.equal(ultra.ok, true);
  assert.equal(ultra.estado.polvo, 0);
  assert.equal(ultra.estado.cajas, 0);
});

test("límite del día, tienda cerrada y créditos que no alcanzan", async () => {
  let e = estadoNuevo();
  assert.equal(puedeAbrir(e, { creditos: 5, fecha: FECHA, piezas }).ok, true);
  e = abrirCaja(e, { rng: cero, piezas, fecha: FECHA }).estado;
  e = abrirCaja(e, { rng: cero, piezas, fecha: FECHA }).estado;
  assert.equal(abiertasHoy(e, FECHA), 2);
  assert.equal(puedeAbrir(e, { creditos: 20, fecha: FECHA, piezas }).razon, "limite");
  assert.equal(puedeAbrir(e, { creditos: 20, fecha: "2026-10-10", piezas }).ok, true);

  e = cambiarLimite(estadoNuevo(), -1);
  e = abrirCaja(e, { rng: cero, piezas, fecha: FECHA }).estado;
  assert.equal(puedeAbrir(e, { creditos: 20, fecha: FECHA, piezas }).razon, "limite");

  const cerrada = ponerCerrada(estadoNuevo(), true);
  assert.equal(puedeAbrir(cerrada, { creditos: 20, fecha: FECHA, piezas }).razon, "cerrada");

  const pobre = estadoNuevo();
  let gastos = 0;
  const no = await abrirConCreditos(pobre, {
    creditos: 4, fecha: FECHA, piezas, rng: cero,
    gastar: () => { gastos += 1; return { ok: true, saldo: 0 }; },
  });
  assert.equal(no.ok, false);
  assert.equal(no.razon, "creditos");
  assert.equal(gastos, 0);
  assert.equal(no.estado.cajas, 0);
  assert.equal(no.creditos, 4);

  const cobroFalso = await abrirConCreditos(estadoNuevo(), {
    creditos: 5, fecha: FECHA, piezas, rng: cero,
    gastar: () => { gastos += 1; return { ok: false, saldo: 3 }; },
  });
  assert.equal(gastos, 1);
  assert.equal(cobroFalso.ok, false);
  assert.equal(cobroFalso.estado.cajas, 0);
  assert.equal(cobroFalso.creditos, 3);

  const limite = { ...estadoNuevo(), hoy: 2, dia: FECHA };
  const noLimite = await abrirConCreditos(limite, {
    creditos: 10, fecha: FECHA, piezas, rng: cero,
    gastar: () => { gastos += 1; return { ok: true, saldo: 5 }; },
  });
  assert.equal(noLimite.razon, "limite");
  assert.equal(gastos, 1);

  const noCerrada = await abrirConCreditos(ponerCerrada(estadoNuevo(), true), {
    creditos: 10, fecha: FECHA, piezas, rng: cero,
    gastar: () => { gastos += 1; return { ok: true, saldo: 5 }; },
  });
  assert.equal(noCerrada.razon, "cerrada");
  assert.equal(gastos, 1);
});

test("simulación: 5000 colecciones con semilla fija", () => {
  const muestras = [];
  const t0 = Date.now();
  for (let i = 0; i < 5000; i++) {
    muestras.push(simularColeccion(rngConSemilla("brumitos-59:" + i), piezas, CONFIG));
  }
  const r = resumirCajas(muestras);
  assert.ok(Date.now() - t0 < 8000, "la simulación tardó demasiado");
  assert.equal(r.n, 5000);
  assert.ok(r.mediana <= 50, `mediana ${r.mediana}`);
  assert.ok(r.p90 <= 65, `p90 ${r.p90}`);
  assert.ok(r.peor <= 90, `peor ${r.peor}`);
  assert.equal(simularColeccion(rngConSemilla("brumitos-59:0"), piezas, CONFIG), muestras[0]);
});

test("guardar y cargar la colección", () => {
  const e = {
    ...estadoNuevo(),
    tenidas: ["lula", "pipo"],
    polvo: 7,
    desdeRara: 2,
    desdeUltra: 4,
    cajas: 3,
    dia: FECHA,
    hoy: 1,
    limite: 3,
    cerrada: true,
    guiaHecha: true,
    voz: false,
    semilla: 99,
    historial: [{ dia: FECHA, id: "pipo", rareza: "comun", nueva: true, polvo: 0 }],
  };
  assert.deepEqual(cargar(JSON.parse(JSON.stringify(e))), e);
  assert.equal(cargar(null).guiaHecha, false);
  assert.equal(cargar("x").polvo, 0);
  assert.equal(marcarGuia(estadoNuevo()).guiaHecha, true);
});

test("la guía espera la voz entre 2 s y 3 s", () => {
  assert.equal(cuandoAvanzaMuestra(0, null), GUIA_MAX_MS);
  assert.equal(cuandoAvanzaMuestra(100, 100 + 1500), 100 + GUIA_MIN_MS);
  assert.equal(cuandoAvanzaMuestra(100, 100 + 2500), 100 + 2500);
  assert.equal(cuandoAvanzaMuestra(100, 100 + 4000), 100 + GUIA_MAX_MS);
  assert.equal(muestraPuedeAvanzar({ aparecio: 0, ahora: 1999, evento: "toque", hasta: 0 }), false);
  assert.equal(muestraPuedeAvanzar({ aparecio: 0, ahora: 2000, evento: "ok", hasta: 0 }), true);
  assert.equal(muestraPuedeAvanzar({ aparecio: 0, ahora: 3000, evento: "tiempo", hasta: 0 }), true);
  assert.equal(aplicarGuia("tienda", "tiempo").paso, "probabilidades");
  assert.equal(aplicarGuia("abrir", "toque").paso, "abrir");
  assert.equal(aplicarGuia("abrir", "abrir").paso, "carta");
  assert.equal(aplicarGuia("fin", "voz").fin, true);
  assert.equal(aplicarGuia("fin", "voz").guardo, true);
  assert.equal(aplicarGuia("tienda", "saltar").guardo, true);
  assert.equal(aplicarGuia("probabilidades", "toque").guardo, false);
  for (const paso of PASOS) {
    assert.notEqual(focoDeGuia(paso), "saltar");
    assert.equal(guiaAvanzaConToque(paso), paso !== "abrir");
  }
});

test("getVoices vacío no es falta de voz: speak y onend sí cuentan", () => {
  olvidarVoz();
  let termino = 0;
  const synth = {
    getVoices() { return []; },
    speak(u) { this.u = u; },
    cancel() {},
    speaking: false,
  };
  const U = function (t) { this.text = t; };
  const r = decir("Cada caja trae un Brumito.", {
    speechSynthesis: synth,
    SpeechSynthesisUtterance: U,
    onend: () => { termino += 1; },
  });
  assert.equal(r.sono, true);
  assert.equal(synth.u.lang, "es-MX");
  assert.ok(synth.u.voice == null);
  synth.u.onend();
  assert.equal(termino, 1);
  assert.equal(cuandoAvanzaMuestra(0, 2200), 2200);
});

test("onerror no cuenta como el final de la voz, aunque luego llegue onend", () => {
  olvidarVoz();
  let termino = 0;
  const synth = {
    getVoices() { return [{ lang: "es-MX", name: "Paulina" }]; },
    speak(u) { this.u = u; },
    cancel() {},
    speaking: false,
  };
  const U = function (t) { this.text = t; };
  const r = decir("Hola", {
    speechSynthesis: synth,
    SpeechSynthesisUtterance: U,
    onend: () => { termino += 1; },
  });
  assert.equal(r.sono, true);
  synth.u.onerror({ error: "synthesis-failed" });
  synth.u.onend();
  assert.equal(termino, 0);
  assert.equal(cuandoAvanzaMuestra(0, null), 3000);

  let otro = 0;
  const roto = decir("Hola", {
    speechSynthesis: { getVoices() { return []; }, speak() { throw new Error("no"); }, cancel() {}, speaking: false },
    SpeechSynthesisUtterance: U,
    onend: () => { otro += 1; },
  });
  assert.equal(roto.sono, false);
  assert.equal(otro, 0);
  assert.equal(decir("", { speechSynthesis: synth, SpeechSynthesisUtterance: U, onend: () => { otro += 1; } }).sono, false);
  assert.equal(otro, 0);
});

test("al cargar se calientan las voces y voiceschanged elige español", () => {
  olvidarVoz();
  let voces = [];
  let aviso = null;
  const synth = {
    getVoices() { return voces; },
    addEventListener(ev, fn) { if (ev === "voiceschanged") aviso = fn; },
    speak(u) { this.u = u; },
    cancel() {},
    speaking: false,
  };
  calentarVoces(synth);
  assert.equal(typeof aviso, "function");
  assert.equal(vozActual(), null);
  const U = function (t) { this.text = t; };
  decir("Hola", { speechSynthesis: synth, SpeechSynthesisUtterance: U });
  assert.ok(synth.u.voice == null);

  const mx = { lang: "es-MX", name: "Paulina" };
  const es = { lang: "es-ES", name: "Lucia" };
  const en = { lang: "en-US", name: "Samantha" };
  assert.equal(escogerVoz([]), null);
  assert.equal(escogerVoz([en, es, mx]), mx);
  voces = [en, es, mx];
  aviso();
  assert.equal(vozActual(), mx);
  decir("Hola", { speechSynthesis: synth, SpeechSynthesisUtterance: U });
  assert.equal(synth.u.voice, mx);
  assert.equal(synth.u.lang, "es-MX");
});

test("los 400 ms y el bloqueo del paso se pisan y no se suman", () => {
  const ahora = 5000;
  const corto = bloqueoAlSeguir({ ahora, sono: false });
  assert.equal(corto.hastaPaso, ahora + GUIA_BLOQUEO_MS);
  assert.equal(corto.hastaDialogo, ahora + TRAS_DIALOGO_MS);
  assert.equal(corto.hasta, ahora + GUIA_BLOQUEO_MS);
  assert.notEqual(corto.hasta, ahora + GUIA_BLOQUEO_MS + TRAS_DIALOGO_MS);

  const largo = bloqueoAlSeguir({ ahora, sono: true });
  assert.equal(largo.hasta, ahora + GUIA_MAX_MS);
  assert.notEqual(largo.hasta, ahora + GUIA_MAX_MS + TRAS_DIALOGO_MS);

  const casi = unirBloqueos(ahora + 1000, ahora + 900 + TRAS_DIALOGO_MS);
  assert.equal(casi, ahora + 1300);
  assert.notEqual(casi, ahora + 1400);

  assert.equal(tapBloqueado({ act: "saltar", ahora: ahora + 200, hastaPaso: ahora + 1000, hastaDialogo: ahora + 400 }), true);
  assert.equal(tapBloqueado({ act: "saltar", ahora: ahora + 500, hastaPaso: ahora + 1000, hastaDialogo: ahora + 400 }), false);
  assert.equal(tapBloqueado({ act: "abrir", ahora: ahora + 500, hastaPaso: ahora + 1000, hastaDialogo: ahora + 400 }), true);
  assert.equal(tapBloqueado({ act: "abrir", ahora: ahora + 1000, hastaPaso: ahora + 1000, hastaDialogo: ahora + 400 }), false);
  assert.equal(tapBloqueado({ act: "ok", ahora: ahora + 100, hastaPaso: 0, hastaDialogo: ahora + 400 }), true);
});

test("¿Salir? se abre con Atrás y un segundo Atrás lo cierra", () => {
  assert.equal(resolverAtras(false), "abrir");
  assert.equal(resolverAtras(true), "cerrar");
  assert.equal(toqueConDialogo("abrir"), "nada");
  assert.equal(toqueConDialogo("seguir"), "seguir");
  assert.equal(toqueConDialogo("velo"), "seguir");
  assert.equal(toqueConDialogo("salir"), "salir");
  assert.equal(teclaConDialogo("ok", "seguir"), "seguir");
  assert.equal(teclaConDialogo("ok", "saltar"), "nada");
  assert.equal(teclaConDialogo("atras", "salir"), "cerrar");
});

test("en pantalla no hay porcentajes y en la tele no se dice Toca", () => {
  const dicho = JSON.stringify(TEXTOS) + PASOS.map((p) => textoGuia(p, "tv") + vozGuia(p, "tactil") + vozGuia(p, "tv")).join(" ");
  assert.equal(dicho.includes("%"), false);
  assert.equal(/por ciento/i.test(dicho), false);
  assert.equal(TEXTOS.descansando, "La tienda está descansando hoy, vuelve mañana");
  assert.equal(fraseGarantia(8, false), "Tu rara llega en 8 cajas o menos");
  assert.equal(fraseGarantia(1, true), "Tu ultra rara llega en 1 caja o menos");
  for (const paso of PASOS) {
    assert.equal(/toca/i.test(textoGuia(paso, "tv")), false, paso);
    assert.equal(/[▲+]/.test(vozGuia(paso, "tv") + vozGuia(paso, "tactil")), false);
  }
  assert.equal(textoGuia("abrir", "tv"), "Pulsa OK.");
  assert.match(textoGuia("abrir", "tactil"), /Toca/);
  const pipo = piezas[0];
  const vacio = htmlFoto(pipo, { tiene: false });
  const mini = htmlFoto(pipo, { tiene: true });
  const grande = htmlFoto(pipo, { grande: true, tiene: true });
  assert.match(vacio, /silueta\.svg/);
  assert.doesNotMatch(vacio, /webp/);
  assert.match(mini, /-128\.webp/);
  assert.match(mini, /loading="lazy"/);
  assert.doesNotMatch(mini, /-512\.webp/);
  assert.match(grande, /-512\.webp/);
  assert.equal(MARCA.comun.estrellas, 1);
  assert.equal(MARCA.rara.estrellas, 2);
  assert.equal(MARCA.ultra.estrellas, 3);
  assert.match(fichasProbabilidad("comun"), /mini-comun/);
  assert.equal(paraVoz("Pulsa + y ▲"), "Pulsa y");
  assert.equal(rutaPieza("pipo", "silueta"), "assets/brumitos/pipo-silueta.svg");
});
