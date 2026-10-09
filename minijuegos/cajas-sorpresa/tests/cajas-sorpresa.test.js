import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { normalizarReglas, RAREZAS } from "../src/reglas.js";
import { rngConSemilla } from "../src/rng.js";
import {
  usarReglas, estadoNuevo, cargar, puedeAbrir, sortearRareza, abrirCaja, comprar, simularColeccion,
  resumirCajas, cambiarLimite, ponerCerrada, cuentaRara, cuentaUltra, abrirConCreditos,
  abiertasHoy, alinearDia, marcarGuia, fechaLocal, ponerMeta,
} from "../src/coleccion.js";
import {
  PASOS, guiaAvanzaConToque, focoDeGuia, cuandoAvanzaMuestra, finBloqueoPaso,
  aceptaEntradaGuia, bloqueoAlSeguir, muestraPuedeAvanzar, aplicarGuia, GUIA_MIN_MS, GUIA_MAX_MS, GUIA_BLOQUEO_MS,
} from "../src/guia.js";
import { unirBloqueos, tapBloqueado, resolverAtras, toqueConDialogo, toqueEnVelo, teclaConDialogo, atrasEnPantalla, TRAS_DIALOGO_MS } from "../src/salida.js";
import { decir, calentarVoces, escogerVoz, escogerVozIngles, olvidarVoz, vozActual, paraVoz } from "../src/voz.js";
import { TEXTOS, textoGuia, vozGuia, fraseGarantia, fraseVisita, fraseNueva, fraseTuya, fraseCosto, fraseGuardar } from "../src/textos.js";
import { htmlFoto, rutaPieza, rutaFamilia, frascoSvg, MARCA, fichasProbabilidad } from "../src/dibujo.js";
import { FAMILIAS, familiaCompleta, familiaQueSeCompleto, ordenarFamilia } from "../src/familias.js";
import { etapaSiguiente, esperaDeEtapa, seDeshabilitaAbrir, pulsoTrasCarta, pulsoAbrir, entradaTienda, entradaDetalle, REVELAR_MS, CARTA_MS, TRAS_ABRIR_MS } from "../src/apertura.js";
import { preguntaPapas, aciertoPapas, pulsoPapas, responderPapas, entrarPuerta, salirPuerta, pulsoPuerta, plazoDescanso, PAPAS_QUIETO_MS, PAPAS_CIERRE_MS } from "../src/papas.js";
import { QUIEN_VISIBLE, opcionesQuien, candidatosMeta } from "../src/quien.js";

const piezas = JSON.parse(fs.readFileSync(new URL("../datos/piezas.json", import.meta.url), "utf8"));
const REGLAS = normalizarReglas(JSON.parse(fs.readFileSync(new URL("../datos/reglas.json", import.meta.url), "utf8")));
usarReglas(REGLAS);
const cero = () => 0;
const FECHA = "2026-10-09";

function idsDe(lista) {
  return lista.map((p) => p.id);
}

test("config de Ñoño y las 24 piezas", () => {
  assert.deepEqual(REGLAS.piezas, { comun: 16, rara: 6, ultra: 2 });
  assert.equal(REGLAS.piezas.comun + REGLAS.piezas.rara + REGLAS.piezas.ultra, 24);
  assert.equal(REGLAS.costoCaja, 5);
  assert.equal(REGLAS.limiteDiario, 2);
  assert.deepEqual(REGLAS.pesos, { comun: 75, rara: 20, ultra: 5 });
  assert.equal(REGLAS.garantiaRara, 8);
  assert.equal(REGLAS.garantiaUltra, 25);
  assert.equal(REGLAS.sinRepetir, 10);
  assert.deepEqual(REGLAS.polvoDuplicado, { comun: 1, rara: 3, ultra: 10 });
  assert.deepEqual(REGLAS.polvoPrecio, { comun: 5, rara: 15, ultra: 40 });
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
  assert.deepEqual(conteo, REGLAS.piezas);
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
  assert.equal(cuentaUltra(r25.estado), REGLAS.garantiaUltra);
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
  const pipo = piezas.find((p) => p.rareza === "comun");
  const lula = piezas.find((p) => p.rareza === "rara");
  const toto = piezas.find((p) => p.rareza === "ultra");
  let e = { ...estadoNuevo(), polvo: 5 };
  const bien = comprar(e, pipo.id, piezas);
  assert.equal(bien.ok, true);
  assert.equal(bien.estado.polvo, 0);
  assert.ok(bien.estado.tenidas.includes(pipo.id));
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
  for (let i = 0; i < 5000; i++) {
    muestras.push(simularColeccion(rngConSemilla("brumitos-59:" + i), piezas, REGLAS));
  }
  const r = resumirCajas(muestras);
  assert.equal(r.n, 5000);
  assert.ok(r.mediana <= 47, `mediana ${r.mediana}`);
  assert.ok(r.p90 <= 61, `p90 ${r.p90}`);
  assert.ok(r.peor <= 81, `peor ${r.peor}`);
  assert.equal(simularColeccion(rngConSemilla("brumitos-59:0"), piezas, REGLAS), muestras[0]);
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
  assert.equal(PASOS.length, 5);
  assert.equal(PASOS.includes("fin"), false);
  assert.equal(PASOS.includes("garantia"), false);
  assert.equal(aplicarGuia("probabilidades", "voz").paso, "abrir");
  assert.equal(aplicarGuia("vitrina", "voz").fin, true);
  assert.equal(aplicarGuia("vitrina", "voz").guardo, true);
  assert.equal(aplicarGuia("carta", "voz").fin, false);
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
  let errores = 0;
  assert.equal(r.sono, true);
  const r2 = decir("Hola", {
    speechSynthesis: synth,
    SpeechSynthesisUtterance: U,
    onend: () => { termino += 1; },
    onerror: () => { errores += 1; },
  });
  assert.equal(r2.sono, true);
  synth.u.onerror({ error: "synthesis-failed" });
  synth.u.onend();
  assert.equal(termino, 0);
  assert.equal(errores, 1);
  assert.equal(cuandoAvanzaMuestra(0, null), 3000);
  assert.equal(muestraPuedeAvanzar({ aparecio: 0, ahora: 1999, evento: "silencio", hasta: 0 }), false);
  assert.equal(muestraPuedeAvanzar({ aparecio: 0, ahora: 2000, evento: "silencio", hasta: 0 }), true);

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

test("la frase en inglés se dice en en-US y no con la voz de español", () => {
  olvidarVoz();
  const mx = { lang: "es-MX", name: "Paulina" };
  const en = { lang: "en-US", name: "Samantha" };
  const U = function (t) { this.text = t; };
  const vacio = {
    getVoices() { return []; },
    speak(u) { this.u = u; },
    cancel() {},
    speaking: false,
  };
  decir("Pipo is the baby. He is afraid of the dark.", {
    lang: "en-US",
    speechSynthesis: vacio,
    SpeechSynthesisUtterance: U,
  });
  assert.equal(vacio.u.lang, "en-US");
  assert.ok(vacio.u.voice == null);

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
  voces = [mx, en];
  aviso();
  decir("Pipo is the baby.", { lang: "en-US", speechSynthesis: synth, SpeechSynthesisUtterance: U });
  assert.equal(synth.u.lang, "en-US");
  assert.equal(synth.u.voice, en);
  assert.equal(escogerVozIngles([mx, en]), en);
  assert.equal(escogerVozIngles([]), null);

  const solo = {
    getVoices() { return [mx]; },
    addEventListener(ev, fn) { if (ev === "voiceschanged") this.aviso = fn; },
    speak(u) { this.u = u; },
    cancel() {},
    speaking: false,
  };
  calentarVoces(solo);
  solo.aviso();
  decir("Pipo is the baby.", { lang: "en-US", speechSynthesis: solo, SpeechSynthesisUtterance: U });
  assert.equal(solo.u.lang, "en-US");
  assert.ok(solo.u.voice == null);
  decir("Hola", { speechSynthesis: solo, SpeechSynthesisUtterance: U });
  assert.equal(solo.u.lang, "es-MX");
  assert.equal(solo.u.voice, mx);
});

test("cuatro familias de seis y la foto no es un premio del frasco", () => {
  const plan = {
    calabaza: { comun: 4, rara: 1, ultra: 1 },
    bruma: { comun: 4, rara: 2, ultra: 0 },
    sabana: { comun: 4, rara: 1, ultra: 1 },
    dulce: { comun: 4, rara: 2, ultra: 0 },
  };
  const generaciones = {
    bebe: "bebe", nino: "hijo", nina: "hijo", adolescente: "adolescente",
    mama: "mama", papa: "papa", abuelo: "mayor", abuela: "mayor",
  };
  assert.deepEqual(FAMILIAS.map((f) => f.id), ["calabaza", "bruma", "sabana", "dulce"]);
  for (const f of FAMILIAS) {
    const miembros = ordenarFamilia(piezas, f.id);
    assert.equal(miembros.length, 6, f.id);
    const c = { comun: 0, rara: 0, ultra: 0 };
    const gens = new Set();
    for (const p of miembros) {
      c[p.rareza] += 1;
      assert.ok(generaciones[p.rol], p.id);
      gens.add(generaciones[p.rol]);
      assert.match(p.ingles, /\w/);
      assert.equal(p.ingles.includes("%"), false, p.id);
    }
    assert.deepEqual(c, plan[f.id], f.id);
    assert.equal(gens.size, 6, f.id);
    const ruta = new URL(`../${rutaFamilia(f.id)}`, import.meta.url);
    const peso = fs.statSync(ruta).size;
    assert.ok(peso > 0 && peso < 30000, `${f.id} ${peso}`);
  }
  const toto = piezas.find((p) => p.id === "toto");
  const pipo = piezas.find((p) => p.id === "pipo");
  assert.equal(toto.familia, "calabaza");
  assert.equal(toto.rol, "abuelo");
  assert.equal(toto.rareza, "ultra");
  assert.equal(pipo.familia, "sabana");
  assert.equal(pipo.rol, "bebe");
  assert.equal(pipo.rareza, "ultra");
  assert.equal(pipo.ingles, "Pipo is the baby. He is afraid of the dark.");

  const dulce = piezas.filter((p) => p.familia === "dulce").map((p) => p.id);
  const falta = dulce[dulce.length - 1];
  const antes = dulce.filter((id) => id !== falta);
  assert.equal(familiaCompleta(antes, piezas, "dulce"), false);
  assert.equal(familiaQueSeCompleto(antes, dulce, piezas), "dulce");
  assert.equal(familiaQueSeCompleto(dulce, dulce, piezas), null);
  assert.equal(familiaCompleta([], piezas, "calabaza"), false);
});

test("el frasco es el mismo dibujo para todas las rarezas", () => {
  const svg = frascoSvg();
  assert.equal(frascoSvg(), svg);
  assert.match(svg, /tapa-frasco/);
  assert.match(svg, /bruma-derrame/);
  assert.match(svg, /brumito-sube/);
  assert.doesNotMatch(svg, /rara|ultra|comun|brillo/i);
  assert.equal(frascoSvg.length, 0);
  assert.equal(svg.includes("512"), false);
});

test("los plazos usan la hora entera y Seguir no reinicia un bloqueo ya cumplido", () => {
  const ahora = 1.7e12;
  assert.notEqual(ahora | 0, ahora);
  const paso = finBloqueoPaso({ aparecio: ahora, sono: false });
  assert.equal(paso, ahora + GUIA_BLOQUEO_MS);
  assert.ok(paso > 1e12);
  assert.equal(tapBloqueado({ act: "abrir", ahora, hastaPaso: paso, hastaDialogo: 0 }), true);
  assert.equal(tapBloqueado({ act: "abrir", ahora: paso, hastaPaso: paso, hastaDialogo: 0 }), false);

  const conVoz = finBloqueoPaso({ aparecio: ahora, sono: true, vozTerminoEn: ahora + 2500 });
  assert.equal(conVoz, ahora + 2500);
  assert.equal(finBloqueoPaso({ aparecio: ahora, sono: true, vozTerminoEn: null }), ahora + GUIA_MAX_MS);

  const acabado = bloqueoAlSeguir({ ahora, hastaPaso: ahora - 10 });
  assert.equal(acabado.hastaPaso, 0);
  assert.equal(acabado.hastaDialogo, ahora + TRAS_DIALOGO_MS);
  assert.equal(acabado.hasta, ahora + TRAS_DIALOGO_MS);
  assert.notEqual(acabado.hasta, ahora + GUIA_BLOQUEO_MS);

  const vivo = bloqueoAlSeguir({ ahora, hastaPaso: ahora + 800 });
  assert.equal(vivo.hastaPaso, ahora + 800);
  assert.equal(vivo.hasta, ahora + 800);
  assert.notEqual(vivo.hasta, ahora + 800 + TRAS_DIALOGO_MS);
  assert.notEqual(vivo.hasta, ahora + GUIA_BLOQUEO_MS);

  const casi = unirBloqueos(ahora + 1000, ahora + 900 + TRAS_DIALOGO_MS);
  assert.equal(casi, ahora + 1300);
  assert.notEqual(casi, ahora + 1400);

  assert.equal(tapBloqueado({ act: "saltar", ahora: ahora + 200, hastaPaso: ahora + 1000, hastaDialogo: ahora + 400 }), true);
  assert.equal(tapBloqueado({ act: "saltar", ahora: ahora + 500, hastaPaso: ahora + 1000, hastaDialogo: ahora + 400 }), false);
  assert.equal(tapBloqueado({ act: "abrir", ahora: ahora + 500, hastaPaso: ahora + 1000, hastaDialogo: ahora + 400 }), true);
  assert.equal(tapBloqueado({ act: "abrir", ahora: ahora + 1000, hastaPaso: ahora + 1000, hastaDialogo: ahora + 400 }), false);
  assert.equal(tapBloqueado({ act: "ok", ahora: ahora + 100, hastaPaso: 0, hastaDialogo: ahora + 400 }), true);

  const dia = fechaLocal(ahora);
  const manana = fechaLocal(ahora + 86400000);
  assert.match(dia, /^20\d\d-\d\d-\d\d$/);
  assert.notEqual(dia, manana);
  assert.notEqual(dia, fechaLocal(ahora | 0));
  const limitado = { ...estadoNuevo(), dia, hoy: 2 };
  assert.equal(puedeAbrir(limitado, { creditos: 20, fecha: dia, piezas }).razon, "limite");
  assert.equal(puedeAbrir(limitado, { creditos: 20, fecha: manana, piezas }).ok, true);
});

test("un paso de mirar espera una voz de 2.5 s y el OK cada 50 ms no la corta", () => {
  const aparecio = 1.7e12;
  assert.notEqual(aparecio | 0, aparecio);
  const fin = aparecio + 2500;
  for (let dt = 0; dt < 2500; dt += 50) {
    const ahora = aparecio + dt;
    assert.equal(aceptaEntradaGuia({ aparecio, ahora, sono: true, vozTerminoEn: null }), false);
    assert.equal(muestraPuedeAvanzar({
      aparecio, ahora, evento: "ok", sono: true, vozTerminoEn: null, hasta: 0,
    }), false);
  }
  assert.equal(aceptaEntradaGuia({ aparecio, ahora: fin, sono: true, vozTerminoEn: null }), false);
  assert.equal(aceptaEntradaGuia({ aparecio, ahora: fin, sono: true, vozTerminoEn: fin }), true);
  assert.equal(muestraPuedeAvanzar({
    aparecio, ahora: fin, evento: "toque", sono: true, vozTerminoEn: fin, hasta: 0,
  }), true);
  assert.equal(muestraPuedeAvanzar({
    aparecio, ahora: aparecio + 2000, evento: "ok", sono: true, vozTerminoEn: null, hasta: 0,
  }), false);

  const corta = aparecio + 400;
  assert.equal(aceptaEntradaGuia({ aparecio, ahora: aparecio + 999, sono: true, vozTerminoEn: corta }), false);
  assert.equal(aceptaEntradaGuia({ aparecio, ahora: aparecio + 1000, sono: true, vozTerminoEn: corta }), true);

  assert.equal(aceptaEntradaGuia({ aparecio, ahora: aparecio + 1999, sono: true, fallo: true }), false);
  assert.equal(aceptaEntradaGuia({ aparecio, ahora: aparecio + 2000, sono: true, fallo: true }), true);
  assert.equal(aceptaEntradaGuia({ aparecio, ahora: aparecio + 2999, sono: true, vozTerminoEn: null }), false);
  assert.equal(aceptaEntradaGuia({ aparecio, ahora: aparecio + 3000, sono: true, vozTerminoEn: null }), true);

  const plazo = finBloqueoPaso({ aparecio, sono: true, vozTerminoEn: fin });
  assert.equal(plazo, fin);
  assert.ok(plazo > 1e12);
  assert.notEqual(plazo, (aparecio | 0) + 2500);
  assert.equal(finBloqueoPaso({ aparecio, sono: true, fallo: true }), aparecio + GUIA_MIN_MS);
  assert.equal(finBloqueoPaso({ aparecio, sono: false }), aparecio + GUIA_BLOQUEO_MS);
});

test("¿Salir? se abre con Atrás en todas las pantallas y OK confirma", () => {
  assert.equal(resolverAtras(false), "abrir");
  assert.equal(resolverAtras(true), "cerrar");
  for (const pantalla of ["tienda", "vitrina", "carta", "foto", "detalle", "papas", "abriendo"]) {
    assert.equal(atrasEnPantalla(pantalla, false), "preguntar", pantalla);
    assert.equal(atrasEnPantalla(pantalla, true), "cerrar", pantalla);
  }
  assert.equal(toqueConDialogo("abrir"), "nada");
  assert.equal(toqueConDialogo("seguir"), "seguir");
  assert.equal(toqueConDialogo("velo"), "seguir");
  assert.equal(toqueConDialogo("salir"), "salir");
  assert.equal(toqueEnVelo({ tv: false, enDialogo: false }), "seguir");
  assert.equal(toqueEnVelo({ tv: false, enDialogo: true }), "nada");
  assert.equal(toqueEnVelo({ tv: true, enDialogo: false }), "nada");
  assert.equal(teclaConDialogo("ok", "seguir"), "seguir");
  assert.equal(teclaConDialogo("ok", "salir"), "salir");
  assert.equal(teclaConDialogo("ok", ""), "seguir");
  assert.equal(teclaConDialogo("atras", "salir"), "cerrar");
});

test("Saltar no entra en las flechas y las frases concuerdan", () => {
  const juego = fs.readFileSync(new URL("../src/juego.js", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../estilo.css", import.meta.url), "utf8");
  assert.match(juego, /class="boton saltar" tabindex="-1" data-act="saltar"/);
  assert.equal(juego.includes('data-foco-id="saltar"'), false);
  assert.match(css, /\.saltar\s*\{[^}]*min-height:\s*64px/);
  assert.match(css, /\.boton\s*\{[^}]*min-height:\s*64px/);
  assert.match(css, /\.boton\s*\{[^}]*min-width:\s*64px/);
  assert.match(css, /\.hueco\s*\{[^}]*min-height:\s*64px/);
  assert.match(css, /\.boton\.boton-oir\s*\{[^}]*min-height:\s*64px/);
  assert.equal(fraseNueva("f"), "Nueva");
  assert.equal(fraseNueva("m"), "Nuevo");
  assert.equal(fraseTuya("f"), "Ahora es tuya");
  assert.equal(fraseTuya("m"), "Ahora es tuyo");
  assert.equal(fraseVisita("Pipo"), "¡Pipo vino de visita otra vez!");
  assert.equal(fraseVisita("Lula"), "¡Lula vino de visita otra vez!");
  assert.equal(fraseGarantia(1, false), "Tu rara llega en 1 caja o menos");
  assert.equal(fraseGarantia(2, true), "Tu ultra rara llega en 2 cajas o menos");
  for (const p of piezas) {
    assert.ok(p.genero === "m" || p.genero === "f", p.id);
    if (p.genero === "f") assert.match(p.ingles, /\b(She|Her)\b/, p.id);
    else assert.match(p.ingles, /\b(He|His)\b/, p.id);
  }
});

test("en pantalla no hay porcentajes y en la tele no se dice Toca", () => {
  const dicho = JSON.stringify(TEXTOS) + PASOS.map((p) => textoGuia(p, "tv", REGLAS) + vozGuia(p, "tactil", REGLAS) + vozGuia(p, "tv", REGLAS)).join(" ");
  assert.equal(dicho.includes("%"), false);
  assert.equal(/por ciento/i.test(dicho), false);
  assert.equal(TEXTOS.descansando, "La tienda está descansando hoy, vuelve mañana");
  assert.equal(fraseGarantia(8, false), "Tu rara llega en 8 cajas o menos");
  assert.equal(fraseGarantia(1, true), "Tu ultra rara llega en 1 caja o menos");
  for (const paso of PASOS) {
    assert.equal(/toca/i.test(textoGuia(paso, "tv", REGLAS)), false, paso);
    assert.equal(/[▲+]/.test(vozGuia(paso, "tv", REGLAS) + vozGuia(paso, "tactil", REGLAS)), false);
  }
  assert.equal(textoGuia("abrir", "tv", REGLAS), "Pulsa OK.");
  assert.match(textoGuia("abrir", "tactil", REGLAS), /Toca/);
  for (const paso of PASOS) assert.equal(/llega en/.test(textoGuia(paso, "tv", REGLAS)), false, paso);
  assert.equal(fraseCosto(REGLAS.costoCaja), "5 créditos");
  assert.equal(fraseCosto(7), "7 créditos");
  assert.equal(fraseCosto(1), "1 crédito");
  assert.equal(fraseGuardar("Hada", "f"), "Guardar para esta Hada");
  assert.equal(fraseGuardar("Toto", "m"), "Guardar para este Toto");
  const juegoSrc = fs.readFileSync(new URL("../src/juego.js", import.meta.url), "utf8");
  assert.equal(juegoSrc.includes("TEXTOS.costo"), false);
  assert.match(juegoSrc, /fraseCosto\(reglas\.costoCaja\)/);
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

test("atrasar el reloj no reinicia el límite del día", () => {
  const e = { ...estadoNuevo(), dia: "2026-10-09", hoy: 2, limite: 2 };
  assert.equal(abiertasHoy(e, "2026-10-08"), 2);
  assert.equal(puedeAbrir(e, { creditos: 20, fecha: "2026-10-08", piezas }).razon, "limite");
  const seguido = abrirCaja({ ...e, limite: 4 }, { rng: cero, piezas, fecha: "2026-10-08" });
  assert.equal(seguido.estado.dia, "2026-10-08");
  assert.equal(seguido.estado.hoy, 3);
  assert.equal(abiertasHoy(seguido.estado, "2026-10-08"), 3);
  assert.equal(puedeAbrir(seguido.estado, { creditos: 20, fecha: "2026-10-09", piezas }).ok, true);
  assert.equal(puedeAbrir(e, { creditos: 20, fecha: "2026-10-10", piezas }).ok, true);
  const reglasSrc = fs.readFileSync(new URL("../src/reglas.js", import.meta.url), "utf8");
  const colSrc = fs.readFileSync(new URL("../src/coleccion.js", import.meta.url), "utf8");
  assert.equal(reglasSrc.includes("export const CONFIG"), false);
  assert.equal(colSrc.includes("CONFIG"), false);
});

test("la apertura son tres brumas y la rareza espera, sin apagar Abrir por un plazo", () => {
  assert.equal(etapaSiguiente("cerrado"), "bruma1");
  assert.equal(etapaSiguiente("bruma1"), "bruma2");
  assert.equal(etapaSiguiente("bruma2"), "figura");
  assert.equal(etapaSiguiente("figura"), "rareza");
  assert.equal(esperaDeEtapa("bruma1"), esperaDeEtapa("bruma2"));
  assert.equal(esperaDeEtapa("figura"), REVELAR_MS);
  assert.equal(REVELAR_MS, 600);
  assert.ok(CARTA_MS >= 1500 && CARTA_MS <= 2000);
  assert.equal(seDeshabilitaAbrir({ puede: true }), false);
  assert.equal(seDeshabilitaAbrir({ cobrando: true, puede: true }), true);
  assert.equal(seDeshabilitaAbrir({ puede: false }), true);
  assert.equal(seDeshabilitaAbrir({ enGuia: true, paso: "abrir", puede: true }), false);
  assert.equal(seDeshabilitaAbrir({ enGuia: true, paso: "tienda", puede: true }), true);
  const juego = fs.readFileSync(new URL("../src/juego.js", import.meta.url), "utf8");
  const tienda = juego.slice(juego.indexOf("function htmlTienda"), juego.indexOf("function htmlHueco"));
  assert.equal(tienda.includes("htmlGarantias"), false);
  assert.equal(tienda.includes("fraseGarantia"), false);
});

test("el reloj adelantado no deja la tienda cerrada hasta esa fecha", () => {
  const base = { ...estadoNuevo(), hoy: 2, limite: 2 };
  const futuro = alinearDia({ ...base, dia: "2026-11-08" }, "2026-10-09");
  assert.equal(futuro.dia, "2026-10-09");
  assert.equal(futuro.hoy, 2);
  assert.equal(abiertasHoy(futuro, "2026-10-09"), 2);
  assert.equal(puedeAbrir(futuro, { creditos: 20, fecha: "2026-10-09", piezas }).razon, "limite");
  assert.equal(puedeAbrir(futuro, { creditos: 20, fecha: "2026-10-10", piezas }).ok, true);
  assert.equal(puedeAbrir({ ...base, dia: "2026-11-08" }, { creditos: 20, fecha: "2026-10-10", piezas }).razon, "limite");

  const atras = alinearDia({ ...base, dia: "2026-10-09" }, "2026-10-08");
  assert.equal(atras.dia, "2026-10-08");
  assert.equal(atras.hoy, 2);
  assert.equal(puedeAbrir(atras, { creditos: 20, fecha: "2026-10-08", piezas }).razon, "limite");
  assert.equal(puedeAbrir(atras, { creditos: 20, fecha: "2026-10-09", piezas }).ok, true);

  const nuevo = alinearDia({ ...base, dia: "2026-10-08" }, "2026-10-09");
  assert.equal(nuevo.dia, "2026-10-08");
  assert.equal(nuevo.hoy, 2);
  assert.equal(abiertasHoy(nuevo, "2026-10-09"), 0);
});

test("papás pide una multiplicación y el repetido se celebra", () => {
  const rng = rngConSemilla("papas-puerta");
  for (let i = 0; i < 40; i++) {
    const p = preguntaPapas(rng);
    assert.ok(p.a >= 6 && p.a <= 9);
    assert.ok(p.b >= 6 && p.b <= 9);
    assert.equal(p.r, p.a * p.b);
    assert.equal(new Set(p.opciones).size, 3);
    assert.ok(p.opciones.includes(p.r));
    assert.equal(aciertoPapas(p, String(p.r)), true);
    assert.equal(aciertoPapas(p, p.r + 1), false);
  }
  const batu = piezas.find((p) => p.id === "batu");
  assert.equal(opcionesQuien(batu, [], piezas, rng), null);
  assert.equal(opcionesQuien(batu, ["tefi"], piezas, rng), null);
  const ops = opcionesQuien(batu, ["tefi", "pumo"], piezas, rngConSemilla("quien"));
  assert.equal(ops.length, 3);
  assert.equal(ops.filter((o) => o.id === "batu").length, 1);
  for (const o of ops) {
    if (o.id !== "batu") assert.ok(o.id === "tefi" || o.id === "pumo");
  }
  const meta = candidatosMeta(["batu"], piezas);
  assert.ok(meta.length >= 2);
  assert.equal(meta.some((p) => p.id === "batu"), false);
  const elegida = ponerMeta(estadoNuevo(), meta[0].id);
  assert.equal(elegida.meta, meta[0].id);
  assert.equal(ponerMeta({ ...elegida, tenidas: [meta[0].id] }, meta[0].id).meta, elegida.meta);
  assert.equal(QUIEN_VISIBLE, false);
});

test("el OK cada 50 ms no abre Para papás y la respuesta buena cambia de sitio", () => {
  const t0 = 1.7e12;
  assert.notEqual(t0 | 0, t0);
  const p = preguntaPapas(rngConSemilla("papas-spam"));
  let hasta = 0;
  let abre = false;
  for (let dt = 0; dt <= 10000; dt += 50) {
    const r = pulsoPapas({ ahora: t0 + dt, foco: "volver", valor: p.r, pregunta: p, hasta });
    hasta = r.hasta;
    if (r.abre) abre = true;
  }
  assert.equal(abre, false);

  const sitios = new Set();
  let medianas = 0;
  const rng = rngConSemilla("papas-sitio");
  const n = 90;
  for (let i = 0; i < n; i++) {
    const q = preguntaPapas(rng);
    assert.equal(new Set(q.opciones).size, 3);
    assert.ok(q.a >= 6 && q.a <= 9 && q.b >= 6 && q.b <= 9);
    assert.equal(q.r, q.a * q.b);
    sitios.add(q.opciones.indexOf(q.r));
    const ord = [...q.opciones].sort((x, y) => x - y);
    if (ord[1] === q.r) medianas += 1;
  }
  assert.equal(sitios.size, 3);
  assert.ok(medianas < n);
});

test("Seguir no cobra si Abrir llega a los 90, 150 o 300 ms", () => {
  const t0 = 1.7e12;
  assert.notEqual(t0 | 0, t0);
  const dialogo = t0 + TRAS_DIALOGO_MS;
  for (const via of ["toque", "ok"]) {
    let paso = 0;
    for (const dt of [90, 150, 300]) {
      const r = pulsoAbrir({ ahora: t0 + dt, hastaPaso: paso, hastaDialogo: dialogo, via });
      assert.equal(r.abre, false, `${via} ${dt}`);
      assert.equal(r.hastaPaso, paso, `${via} ${dt} no alarga el plazo`);
      paso = r.hastaPaso;
    }
    const tarde = pulsoAbrir({ ahora: t0 + 450, hastaPaso: paso, hastaDialogo: dialogo, via });
    assert.equal(tarde.abre, true, `${via} 450`);
  }
});

test("toques al azar durante 60 s no abren Para papás y dos aciertos seguidos sí", () => {
  const t0 = 1.7e12;
  assert.notEqual(t0 | 0, t0);
  const rng = rngConSemilla("papas-rafaga");
  let t = t0;
  const fin = t0 + 60000;
  let pregunta = preguntaPapas(rng);
  let seguidas = 0;
  let fallos = 0;
  let aceptaDesde = t + PAPAS_QUIETO_MS;
  let cerradoHasta = 0;
  let abrio = false;
  while (t < fin) {
    t += 50 + Math.floor(rng() * 251);
    if (t > fin) break;
    if (cerradoHasta && t >= cerradoHasta) {
      cerradoHasta = 0;
      seguidas = 0;
      fallos = 0;
      pregunta = preguntaPapas(rng);
      aceptaDesde = t + PAPAS_QUIETO_MS;
    }
    const valor = pregunta.opciones[Math.floor(rng() * pregunta.opciones.length)];
    const r = responderPapas({ ahora: t, pregunta, valor, enOpcion: true, seguidas, fallos, aceptaDesde, cerradoHasta });
    if (r.abre) abrio = true;
    seguidas = r.seguidas;
    fallos = r.fallos;
    aceptaDesde = r.aceptaDesde;
    cerradoHasta = r.cerradoHasta;
    if (r.nueva) pregunta = preguntaPapas(rng);
  }
  assert.equal(abrio, false);

  const padre = rngConSemilla("papas-padre");
  const primera = preguntaPapas(padre);
  const espera = responderPapas({
    ahora: t0 + 200,
    pregunta: primera,
    valor: primera.r,
    enOpcion: true,
    aceptaDesde: t0 + PAPAS_QUIETO_MS,
  });
  assert.equal(espera.abre, false);
  assert.equal(espera.seguidas, 0);
  assert.ok(espera.aceptaDesde > t0 + PAPAS_QUIETO_MS);
  const uno = responderPapas({
    ahora: espera.aceptaDesde,
    pregunta: primera,
    valor: primera.r,
    enOpcion: true,
    aceptaDesde: espera.aceptaDesde,
  });
  assert.equal(uno.abre, false);
  assert.equal(uno.seguidas, 1);
  assert.equal(uno.nueva, true);
  assert.equal(uno.foco, "volver");
  const segunda = preguntaPapas(padre);
  assert.equal(new Set(segunda.opciones).size, 3);
  const pronto = responderPapas({
    ahora: uno.aceptaDesde - 1,
    pregunta: segunda,
    valor: segunda.r,
    enOpcion: true,
    seguidas: uno.seguidas,
    aceptaDesde: uno.aceptaDesde,
  });
  assert.equal(pronto.abre, false);
  const dos = responderPapas({
    ahora: uno.aceptaDesde,
    pregunta: segunda,
    valor: segunda.r,
    enOpcion: true,
    seguidas: uno.seguidas,
    aceptaDesde: uno.aceptaDesde,
  });
  assert.equal(dos.abre, true);

  const mal = primera.opciones.find((n) => n !== primera.r);
  const fallo1 = responderPapas({
    ahora: t0 + PAPAS_QUIETO_MS,
    pregunta: primera,
    valor: mal,
    enOpcion: true,
    aceptaDesde: t0 + PAPAS_QUIETO_MS,
  });
  assert.equal(fallo1.abre, false);
  assert.equal(fallo1.fallos, 1);
  assert.equal(fallo1.nueva, true);
  assert.equal(fallo1.foco, "volver");
  const otra = preguntaPapas(padre);
  const mal2 = otra.opciones.find((n) => n !== otra.r);
  const fallo2 = responderPapas({
    ahora: fallo1.aceptaDesde,
    pregunta: otra,
    valor: mal2,
    enOpcion: true,
    seguidas: fallo1.seguidas,
    fallos: fallo1.fallos,
    aceptaDesde: fallo1.aceptaDesde,
  });
  assert.equal(fallo2.abre, false);
  assert.equal(fallo2.aviso, "descanso");
  assert.equal(fallo2.foco, "volver");
  assert.equal(fallo2.cerradoHasta, fallo1.aceptaDesde + PAPAS_CIERRE_MS);
  const durante = responderPapas({
    ahora: fallo2.cerradoHasta - 1,
    pregunta: otra,
    valor: otra.r,
    enOpcion: true,
    cerradoHasta: fallo2.cerradoHasta,
    aceptaDesde: fallo2.aceptaDesde,
  });
  assert.equal(durante.abre, false);
  assert.equal(/\d/.test(TEXTOS.papasDescanso), false);
  assert.equal(/\d/.test(TEXTOS.papasOtra), false);
});

test("volver, las flechas y un toque en cualquier sitio no abren Para papás", () => {
  const t0 = 1.7e12;
  assert.notEqual(t0 | 0, t0);
  const rng = rngConSemilla("papas-reentrada");
  const primera = preguntaPapas(rng);
  let estado = entrarPuerta({ ahora: t0, seguidas: 0, aceptaDesde: 0 });
  estado = { ...estado, ...salirPuerta(), seguidas: 1 };
  const vuelta = entrarPuerta({ ahora: t0 + 1600, seguidas: estado.seguidas, aceptaDesde: estado.aceptaDesde });
  assert.equal(vuelta.seguidas, 0);
  assert.equal(vuelta.aviso, "");
  assert.ok(vuelta.aceptaDesde >= t0 + 1600 + PAPAS_QUIETO_MS);
  const pronto = responderPapas({
    ahora: t0 + 1660,
    pregunta: primera,
    valor: primera.r,
    enOpcion: true,
    seguidas: vuelta.seguidas,
    aceptaDesde: vuelta.aceptaDesde,
  });
  assert.equal(pronto.abre, false);
  assert.equal(pronto.seguidas, 0);
  const otraVuelta = entrarPuerta({
    ahora: t0 + 1660 + 1600,
    seguidas: 1,
    aceptaDesde: salirPuerta().aceptaDesde,
  });
  const segunda = responderPapas({
    ahora: t0 + 1660 + 1600 + 60,
    pregunta: primera,
    valor: primera.r,
    enOpcion: true,
    seguidas: otraVuelta.seguidas,
    aceptaDesde: otraVuelta.aceptaDesde,
  });
  assert.equal(segunda.abre, false);

  const acciones = ["arriba", "abajo", "izquierda", "derecha", "ok"];
  let desde = t0 + PAPAS_QUIETO_MS;
  let seguidas = 0;
  let abrioFlechas = false;
  let t = t0;
  const fin = t0 + 60000;
  while (t < fin) {
    t += 50 + Math.floor(rng() * 251);
    if (t > fin) break;
    const accion = acciones[Math.floor(rng() * acciones.length)];
    const enOpcion = accion === "ok" && rng() < 0.5;
    const pulso = pulsoPuerta({ ahora: t, aceptaDesde: desde, cuenta: enOpcion });
    if (!pulso.cuenta) {
      desde = pulso.aceptaDesde;
      continue;
    }
    const r = responderPapas({
      ahora: t,
      pregunta: primera,
      valor: primera.r,
      enOpcion: true,
      seguidas,
      aceptaDesde: desde,
    });
    if (r.abre) abrioFlechas = true;
    seguidas = r.seguidas;
    desde = r.aceptaDesde;
  }
  assert.equal(abrioFlechas, false);

  let desdeToque = t0 + PAPAS_QUIETO_MS;
  let seguidasToque = 0;
  let abrioToque = false;
  t = t0;
  while (t < fin) {
    t += 50 + Math.floor(rng() * 251);
    if (t > fin) break;
    const enRespuesta = rng() < 0.6;
    const pulso = pulsoPuerta({ ahora: t, aceptaDesde: desdeToque, cuenta: enRespuesta });
    if (!pulso.cuenta) {
      desdeToque = pulso.aceptaDesde;
      continue;
    }
    const r = responderPapas({
      ahora: t,
      pregunta: primera,
      valor: primera.opciones[Math.floor(rng() * 3)],
      enOpcion: true,
      seguidas: seguidasToque,
      aceptaDesde: desdeToque,
    });
    if (r.abre) abrioToque = true;
    seguidasToque = r.seguidas;
    desdeToque = r.aceptaDesde;
  }
  assert.equal(abrioToque, false);

  const adulto = entrarPuerta({ ahora: t0, aceptaDesde: 0 });
  const uno = responderPapas({
    ahora: adulto.aceptaDesde,
    pregunta: primera,
    valor: primera.r,
    enOpcion: true,
    seguidas: adulto.seguidas,
    aceptaDesde: adulto.aceptaDesde,
    escalada: 2,
  });
  assert.equal(uno.abre, false);
  assert.equal(uno.seguidas, 1);
  const segundaPregunta = preguntaPapas(rng);
  const dos = responderPapas({
    ahora: uno.aceptaDesde,
    pregunta: segundaPregunta,
    valor: segundaPregunta.r,
    enOpcion: true,
    seguidas: uno.seguidas,
    aceptaDesde: uno.aceptaDesde,
    escalada: uno.escalada,
  });
  assert.equal(dos.abre, true);
  assert.equal(dos.escalada, 0);
});

test("el descanso de Para papás se guarda, crece y se borra al entrar", () => {
  const t0 = 1.7e12;
  assert.notEqual(t0 | 0, t0);
  const p = preguntaPapas(rngConSemilla("papas-descanso"));
  const mal = p.opciones.find((n) => n !== p.r);
  let nivel = 0;
  let cuando = t0;
  const plazos = [];
  for (let i = 0; i < 3; i++) {
    const uno = responderPapas({
      ahora: cuando,
      pregunta: p,
      valor: mal,
      enOpcion: true,
      aceptaDesde: cuando,
      escalada: nivel,
    });
    assert.equal(uno.fallos, 1);
    const dos = responderPapas({
      ahora: uno.aceptaDesde,
      pregunta: p,
      valor: mal,
      enOpcion: true,
      fallos: uno.fallos,
      aceptaDesde: uno.aceptaDesde,
      escalada: uno.escalada,
    });
    assert.equal(dos.aviso, "descanso");
    assert.equal(dos.cerradoHasta - uno.aceptaDesde, plazoDescanso(nivel));
    plazos.push(dos.cerradoHasta - uno.aceptaDesde);
    nivel = dos.escalada;
    cuando = dos.cerradoHasta;
  }
  assert.deepEqual(plazos, [30000, 120000, 300000]);
  assert.equal(plazoDescanso(9), 300000);
  const durante = responderPapas({
    ahora: t0 + 1000,
    pregunta: p,
    valor: p.r,
    enOpcion: true,
    cerradoHasta: t0 + plazos[0],
    aceptaDesde: t0 + plazos[0],
    escalada: 1,
  });
  assert.equal(durante.abre, false);
  const guardado = cargar({
    ...estadoNuevo(),
    puertaHasta: t0 + PAPAS_CIERRE_MS,
    puertaFallos: 1,
    puertaNivel: 1,
  });
  assert.equal(guardado.puertaHasta, t0 + PAPAS_CIERRE_MS);
  assert.notEqual(guardado.puertaHasta, (t0 + PAPAS_CIERRE_MS) | 0);
  assert.equal(guardado.puertaFallos, 1);
  assert.equal(guardado.puertaNivel, 1);
  const recargado = cargar(JSON.parse(JSON.stringify(guardado)));
  assert.equal(recargado.puertaHasta > t0 + 1000, true);
  const alVolver = responderPapas({
    ahora: t0 + 1000,
    pregunta: p,
    valor: p.r,
    enOpcion: true,
    cerradoHasta: recargado.puertaHasta,
    fallos: recargado.puertaFallos,
    escalada: recargado.puertaNivel,
    aceptaDesde: entrarPuerta({ ahora: t0 + 1000, aceptaDesde: 0 }).aceptaDesde,
  });
  assert.equal(alVolver.abre, false);
  assert.equal(alVolver.aviso, "descanso");
});

test("volver de Para papás no deja comprar con OK ni con toques durante 10 s", () => {
  const t0 = 1.7e12;
  assert.notEqual(t0 | 0, t0);
  for (const via of ["ok", "toque"]) {
    let pantalla = "papas";
    let foco = "volver";
    let hastaPaso = 0;
    let cajas = 0;
    let gasto = 0;
    for (let dt = 0; dt <= 10000; dt += 50) {
      const ahora = t0 + dt;
      if (pantalla === "papas") {
        const entrada = entradaTienda({ ahora, hasta: hastaPaso });
        pantalla = "tienda";
        foco = entrada.foco;
        hastaPaso = entrada.hasta;
        continue;
      }
      const quiereAbrir = via === "toque" || foco === "abrir";
      if (!quiereAbrir) continue;
      const r = pulsoAbrir({ ahora, hastaPaso, hastaDialogo: 0 });
      hastaPaso = r.hastaPaso;
      if (r.abre) {
        cajas += 1;
        gasto += 5;
      }
    }
    assert.equal(cajas, 0, via);
    assert.equal(gasto, 0, via);
    assert.equal(foco, "vitrina", via);
    assert.ok(hastaPaso > t0 + 10000 || via === "ok");
  }
});

test("el OK y los toques desde Para papás no gastan polvo ni créditos", () => {
  const t0 = 1.7e12;
  assert.notEqual(t0 | 0, t0);
  for (const via of ["ok", "toque"]) {
    let pantalla = "papas";
    let foco = "volver";
    let hasta = 0;
    let polvo = 25;
    let creditos = 20;
    for (let dt = 0; dt <= 10000; dt += 50) {
      const ahora = t0 + dt;
      const cerrado = ahora < hasta;
      if (pantalla === "papas") {
        const entrada = entradaTienda({ ahora, hasta });
        pantalla = "tienda";
        foco = entrada.foco;
        hasta = entrada.hasta;
        continue;
      }
      const quiereAbrir = pantalla === "tienda" && (via === "toque" && foco === "abrir" || foco === "abrir");
      const quiereConseguir = pantalla === "detalle" && (via === "toque" || foco === "conseguir");
      if (cerrado && (quiereAbrir || quiereConseguir)) {
        const pulso = pulsoTrasCarta({ ahora, hasta, carta: false });
        hasta = pulso.hasta;
        continue;
      }
      if (cerrado) continue;
      if (pantalla === "tienda") {
        pantalla = "vitrina";
        foco = "hueco";
        continue;
      }
      if (pantalla === "vitrina") {
        const ficha = entradaDetalle({ ahora, hasta, tv: via === "ok", tiene: false });
        pantalla = "detalle";
        foco = ficha.foco;
        hasta = ficha.hasta;
        continue;
      }
      if (pantalla === "detalle" && (via === "toque" || foco === "conseguir")) {
        polvo -= 5;
        continue;
      }
      if (pantalla === "detalle" && foco === "volver") {
        const entrada = entradaTienda({ ahora, hasta });
        pantalla = "tienda";
        foco = entrada.foco;
        hasta = entrada.hasta;
      }
    }
    assert.equal(polvo, 25, via);
    assert.equal(creditos, 20, via);
    if (via === "ok") assert.notEqual(foco, "conseguir");
  }
});

test("un OK cada 50 ms durante 10 s después de la carta no abre otro frasco", () => {
  const t0 = 1.7e12;
  assert.notEqual(t0 | 0, t0);
  let hasta = t0 + TRAS_ABRIR_MS;
  let abrio = false;
  for (let dt = 0; dt <= 10000; dt += 50) {
    const r = pulsoTrasCarta({ ahora: t0 + dt, hasta, carta: false });
    hasta = r.hasta;
    if (r.abre) abrio = true;
  }
  assert.equal(abrio, false);
  assert.ok(hasta > t0 + 10000);
  assert.notEqual(hasta, (t0 | 0) + 10000);
  const durante = pulsoTrasCarta({ ahora: t0 + 200, hasta: t0 + TRAS_ABRIR_MS, carta: true });
  assert.equal(durante.abre, false);
  assert.equal(durante.hasta, t0 + TRAS_ABRIR_MS);
  assert.equal(pulsoTrasCarta({ ahora: hasta, hasta, carta: false }).abre, true);
});

test("el pendiente se guarda en el mismo cobro y se puede repetir la carta", async () => {
  let gastos = 0;
  let guardado = null;
  let rPieza = "";
  const r = await abrirConCreditos(estadoNuevo(), {
    creditos: 10, fecha: FECHA, piezas, rng: cero,
    gastar() {
      assert.equal(guardado && guardado.pendiente && guardado.pendiente.id, rPieza);
      gastos += 1;
      return { ok: true, saldo: 5 };
    },
    alCobrar(res) {
      rPieza = res.pieza.id;
      guardado = {
        ...res.estado,
        pendiente: {
          id: res.pieza.id,
          duplicado: res.duplicado,
          polvoGanado: res.polvoGanado,
          familiaNueva: null,
        },
      };
      return guardado;
    },
  });
  assert.equal(gastos, 1);
  assert.equal(r.estado.cajas, 1);
  assert.equal(r.estado.pendiente.id, r.pieza.id);
  const otra = cargar(JSON.parse(JSON.stringify(r.estado)));
  assert.equal(otra.pendiente.id, r.pieza.id);
  assert.equal(otra.pendiente.duplicado, false);
  assert.equal(otra.cajas, 1);

  let revertido = false;
  const fallo = await abrirConCreditos(estadoNuevo(), {
    creditos: 10, fecha: FECHA, piezas, rng: cero,
    gastar() { return { ok: false, saldo: 10 }; },
    alCobrar(res) { return { ...res.estado, pendiente: { id: res.pieza.id, duplicado: false, polvoGanado: 0, familiaNueva: null } }; },
    alFallar() { revertido = true; },
  });
  assert.equal(fallo.ok, false);
  assert.equal(revertido, true);
  assert.equal(fallo.estado.pendiente, null);
});
