import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { rngConSemilla } from "../src/rng.js";
import { ORDEN, animal, fraseIngles, fraseLlego } from "../src/animales.js";
import { TEXTOS, textoGuia, vozGuia, vozLeyenda, textoContar, textoCuantos, textoDiferencia, textoTotalDos, textoAcierto } from "../src/textos.js";
import { limpiarHabla, hablar, cuentaComoFin, prepararVoces, elegirVoz } from "../src/voz.js";
import { IGNORAR_MS, efectoAtras, resolverToque, alCerrarDialogo } from "../src/salida.js";
import { controlesCaben, eje20Cabe, animalesEnFila, CONTROL_PX, TV_MARGEN } from "../src/medidas.js";
import {
  PASOS, GUIA_MONOS, GUIA_JIRAFAS, guiaNueva, aplicarGuia, debeAvanzarSolo, abrirSalirGuia,
  seguirSalirGuia, palitosGuia, listoGuiaActivo, numerosGuiaActivos, focoGuia, saltarAlcanzable,
  guardarAlTerminar, bloqueada, anotarVoz, instanteAuto, finCandado, MIRAR_MIN_MS, MIRAR_MAX_MS,
  OPCIONES_GUIA_CONTEO, OPCIONES_GUIA_MAS, TRAS_GUIA_MS, trasGuiaBloquea,
} from "../src/guia.js";
import {
  NIVELES, crearVisita, crearCenso, opcionesConteo, armarDiferencia, armarTotal, unSoloError,
  conteoCorrecto, tipoErrorDetective, metasDe, animalNuevoDeNivel,
} from "../src/niveles.js";
import { barrasCoinciden as coincideGraf, geometriaDiferencia, geometriaBarras, gruposPalitos, moverBarra, ejeDe } from "../src/grafica.js";
import { pista, marcaPasoCompleto } from "../src/pista.js";
import {
  nuevo, cargar, anotarElemento, dominio, cerrarVisita, estrellasVisita, quiereFacil, marcarGuia,
  abrirAnimal, racha, cumplirReto, PARA_SUBIR, VENTANA,
} from "../src/progreso.js";
import { retoDelDia, tipoReto, META_RETO, LARGO_RETO } from "../src/reto.js";

const SIMBOLO = /[▲▼×+=−]/;

function visitas(n, k = 12, opts) {
  const out = [];
  for (let i = 0; i < k; i++) out.push(crearVisita(n, rngConSemilla("v-" + n + "-" + i), opts));
  return out;
}

test("la guía es el ejemplo fijo y la tele no dice Toca", () => {
  assert.deepEqual(PASOS, ["cuidar", "contar", "grafica", "subir", "listo", "mas"]);
  assert.equal(textoGuia("cuidar", false), "Ayuda al cuidador.");
  assert.equal(textoGuia("contar", true), "Cuenta los monos. Escoge el 3.");
  assert.equal(textoGuia("grafica", false), "Ahora la gráfica.");
  assert.equal(textoGuia("subir", false), "Sube los monos hasta 3.");
  assert.equal(textoGuia("subir", true), "Pulsa arriba hasta 3.");
  assert.equal(textoGuia("listo", false), "¡Brilla! Toca Listo.");
  assert.equal(textoGuia("listo", true), "¡Brilla! Pulsa OK.");
  assert.equal(textoGuia("mas", false), "¿De cuál hay más? Escoge la jirafa.");
  for (const paso of PASOS) {
    assert.doesNotMatch(textoGuia(paso, true), /Toca/);
    assert.doesNotMatch(vozGuia(paso, true), SIMBOLO);
    assert.doesNotMatch(vozGuia(paso, false), SIMBOLO);
    assert.doesNotMatch(limpiarHabla(vozGuia(paso, true)), SIMBOLO);
  }
  assert.equal(vozGuia("subir", true), "Pulsa arriba hasta 3.");
  assert.equal(vozGuia("listo", true), "Brilla. Pulsa OK.");
  assert.equal(TEXTOS.mas, "¿De qué animal hay más?");
  assert.equal(vozLeyenda("dibujos"), "Cada dibujo es 1 animal");
  assert.doesNotMatch(vozLeyenda("dibujos"), /=/);
});

test("contar marca con palito y solo el 3 avanza; Listo espera su paso", () => {
  let g = guiaNueva(0);
  assert.equal(focoGuia(g), "frase");
  assert.notEqual(focoGuia(g), "saltar");
  g = aplicarGuia(g, { tipo: "tiempo" }, 3000);
  assert.equal(g.paso, "contar");
  assert.equal(debeAvanzarSolo(g, 99999), false);
  assert.equal(saltarAlcanzable("contar"), false);
  assert.equal(saltarAlcanzable("cuidar"), false);
  const t = g.bloqueoHasta;
  assert.equal(aplicarGuia(g, { tipo: "numero", n: 3 }, t).paso, "contar");
  g = aplicarGuia(g, { tipo: "marcar", i: 0 }, t);
  g = aplicarGuia(g, { tipo: "marcar", i: 0 }, t);
  assert.equal(palitosGuia(g), 1);
  g = aplicarGuia(g, { tipo: "marcar", i: 1 }, t);
  g = aplicarGuia(g, { tipo: "marcar", i: 2 }, t);
  assert.equal(palitosGuia(g), GUIA_MONOS);
  assert.equal(numerosGuiaActivos(g, t), false);
  assert.equal(focoGuia(g), "animal-2");
  assert.equal(aplicarGuia(g, { tipo: "numero", n: 3 }, t).paso, "contar");
  const cuando = g.opcionesDesde;
  assert.equal(numerosGuiaActivos(g, cuando), true);
  g = { ...g, opcionesDesde: 0 };
  assert.deepEqual(OPCIONES_GUIA_CONTEO, [2, 3, 4]);
  assert.notEqual(OPCIONES_GUIA_CONTEO[0], 3);
  assert.equal(focoGuia(g), "op-0");
  g = aplicarGuia(g, { tipo: "numero", n: 2 }, cuando);
  assert.equal(g.paso, "contar");
  assert.equal(g.mal, true);
  g = aplicarGuia(g, { tipo: "ok" }, t);
  assert.equal(g.paso, "contar");
  g = aplicarGuia(g, { tipo: "numero", n: 3 }, t);
  assert.equal(g.paso, "grafica");
  g = aplicarGuia(g, { tipo: "tiempo" }, g.autoHasta);
  assert.equal(g.paso, "subir");
  const s = g.bloqueoHasta;
  g = aplicarGuia(g, { tipo: "barra", indice: 1, delta: 1 }, s);
  assert.equal(g.barras[1], GUIA_JIRAFAS);
  g = aplicarGuia(g, { tipo: "barra", indice: 0, delta: 1 }, s);
  g = aplicarGuia(g, { tipo: "barra", indice: 0, delta: 1 }, s);
  assert.equal(g.paso, "subir");
  g = aplicarGuia(g, { tipo: "barra", indice: 0, delta: 1 }, s);
  assert.equal(g.paso, "listo");
  assert.equal(g.barras[0], GUIA_MONOS);
  assert.equal(listoGuiaActivo(g), true);
  assert.equal(focoGuia(g), "listo");
  assert.equal(aplicarGuia(g, { tipo: "ok" }, g.bloqueoHasta).paso, "listo");
  g = aplicarGuia(g, { tipo: "listo" }, g.bloqueoHasta);
  assert.equal(g.paso, "mas");
  assert.equal(OPCIONES_GUIA_MAS[0].id, "mono");
  assert.equal(focoGuia(g), "op-0");
  g = aplicarGuia(g, { tipo: "opcion", id: "mono" }, g.bloqueoHasta);
  assert.equal(g.fin, false);
  g = aplicarGuia(g, { tipo: "opcion", id: "jirafa" }, g.bloqueoHasta);
  assert.equal(g.fin, true);
  assert.equal(g.guardada, false);
  assert.equal(guardarAlTerminar("fin"), true);
  assert.equal(guardarAlTerminar("saltar"), true);
  assert.equal(guardarAlTerminar("salir"), false);
});

test("¿Salir? pausa el avance y la voz, y Seguir los reinicia", () => {
  let g = guiaNueva(0);
  assert.equal(g.autoHasta, 3000);
  assert.equal(g.vozHasta, 3000);
  assert.equal(debeAvanzarSolo(g, 1999), false);
  assert.equal(debeAvanzarSolo(g, 2000), true);
  assert.equal(debeAvanzarSolo(anotarVoz(g, "hablando", 100), 2000), false);
  assert.equal(debeAvanzarSolo(anotarVoz(g, "hablando", 100), 3000), true);

  g = abrirSalirGuia(g, 2900);
  assert.equal(g.saliendo, true);
  assert.equal(efectoAtras(true), "cerrar");
  assert.equal(debeAvanzarSolo(g, 2900 + 100), false);
  assert.equal(debeAvanzarSolo(g, 9000), false);
  assert.equal(aplicarGuia(g, { tipo: "tiempo" }, 9000), g);
  assert.equal(aplicarGuia(g, { tipo: "ok" }, 9000), g);
  assert.equal(aplicarGuia(g, { tipo: "saltar" }, 9000).fin, false);
  assert.equal(resolverToque({ saliendo: true, ahora: 9000, act: "marcar" }), "nada");
  assert.equal(resolverToque({ saliendo: true, ahora: 9000, act: "ok" }), "nada");
  assert.equal(resolverToque({ saliendo: true, ahora: 9000, act: "seguir" }), "seguir");
  assert.equal(resolverToque({ saliendo: true, ahora: 9000, act: "salir" }), "salir");

  g = seguirSalirGuia(g, 2900);
  assert.equal(g.paso, "cuidar");
  assert.equal(g.saliendo, false);
  assert.equal(g.autoHasta, 2900 + 3000);
  assert.equal(g.vozHasta, 2900 + 3000);
  assert.equal(g.bloqueoHasta, 2900);
  assert.equal(g.ignorarHasta, 2900 + IGNORAR_MS);
  assert.equal(IGNORAR_MS, 400);
  assert.equal(finCandado(g), 2900 + IGNORAR_MS);
  assert.notEqual(finCandado(g), 2900 + IGNORAR_MS + 1000);
  assert.equal(bloqueada(g, 2900 + 399), true);
  assert.equal(bloqueada(g, 2900 + 400), false);
  assert.equal(g.vozEstado, "esperando");
  assert.equal(aplicarGuia(g, { tipo: "ok" }, 2900 + 650).paso, "cuidar");
  const conFallo = anotarVoz(g, "fallo", 2900 + 50);
  assert.equal(aplicarGuia(conFallo, { tipo: "ok" }, 2900 + 650).paso, "contar");
  let fresco = abrirSalirGuia(guiaNueva(0), 400);
  fresco = seguirSalirGuia(fresco, 700);
  assert.equal(fresco.bloqueoHasta, 700 + 600);
  assert.equal(fresco.autoHasta, 700 + 3000);
  assert.equal(aplicarGuia(fresco, { tipo: "ok" }, 700 + 500).paso, "cuidar");
  assert.equal(debeAvanzarSolo(g, 2900 + 100), false);
  assert.equal(debeAvanzarSolo(g, 2900 + 1999), false);
  assert.equal(debeAvanzarSolo(g, 2900 + 2000), true);
  assert.equal(bloqueada(g, 2900 + 200), true);
  assert.equal(aplicarGuia(g, { tipo: "ok" }, 2900 + 200).paso, "cuidar");
  assert.equal(resolverToque({ saliendo: false, ignorarHasta: g.ignorarHasta, ahora: 2900 + 399, act: "ok" }), "nada");
  assert.equal(resolverToque({ saliendo: false, ignorarHasta: g.ignorarHasta, ahora: 2900 + 400, act: "ok" }), "juego");
  assert.deepEqual(alCerrarDialogo(2900), { saliendo: false, ignorarHasta: 2900 + 400 });
  assert.equal(efectoAtras(false), "abrir");
});

test("Saltar guarda la guía; en mirar OK espera a la voz y en acción el bloqueo aguanta", () => {
  const s = aplicarGuia(guiaNueva(0), { tipo: "saltar" }, 0);
  assert.equal(s.fin, true);
  assert.equal(s.guardada, true);
  const g = guiaNueva(0);
  assert.equal(bloqueada(g, 500), true);
  assert.equal(aplicarGuia(g, { tipo: "ok" }, 0).paso, "cuidar");
  assert.equal(aplicarGuia(g, { tipo: "toque" }, 100).paso, "cuidar");
  assert.equal(aplicarGuia(g, { tipo: "ok" }, 999).paso, "cuidar");
  const contando = aplicarGuia(g, { tipo: "ok" }, 1000);
  assert.equal(contando.paso, "contar");
  assert.equal(aplicarGuia(contando, { tipo: "marcar", i: 0 }, 500).marcados[0], false);
  assert.equal(aplicarGuia(contando, { tipo: "marcar", i: 0 }, contando.bloqueoHasta).marcados[0], true);
  assert.equal(trasGuiaBloquea(100, 1000), true);
  assert.equal(TRAS_GUIA_MS, 1000);
});

function vozFalsa(speak) {
  return {
    speaking: false,
    pending: false,
    cancel() {},
    getVoices() { return [{ lang: "es-ES", name: "Paulina" }]; },
    speak,
  };
}

function Frase(texto) { this.text = texto; }

test("mirar espera a la voz: 2.5 s, spam y un tope de 3 s con tiempos enormes", () => {
  const t0 = 1.7e12;
  let g = anotarVoz(guiaNueva(t0), "hablando", t0 + 40);
  for (let t = t0; t < t0 + 2500; t += 50) {
    assert.equal(aplicarGuia(g, { tipo: "ok" }, t).paso, "cuidar");
  }
  for (let t = t0; t < t0 + 2500; t += 80) {
    assert.equal(aplicarGuia(g, { tipo: "toque" }, t).paso, "cuidar");
  }
  assert.equal(aplicarGuia(g, { tipo: "ok" }, t0 + 1100).paso, "cuidar");
  g = anotarVoz(g, "termino", t0 + 2500);
  assert.equal(g.vozEstado, "termino");
  assert.equal(g.bloqueoHasta, t0 + 2500);
  assert.equal(aplicarGuia(g, { tipo: "ok" }, t0 + 2499).paso, "cuidar");
  assert.equal(aplicarGuia(g, { tipo: "ok" }, t0 + 2500).paso, "contar");

  const eterna = anotarVoz(guiaNueva(t0), "hablando", t0 + 10);
  assert.equal(aplicarGuia(eterna, { tipo: "ok" }, t0 + 2999).paso, "cuidar");
  assert.equal(aplicarGuia(eterna, { tipo: "toque" }, t0 + 2999).paso, "cuidar");
  assert.equal(aplicarGuia(eterna, { tipo: "ok" }, t0 + 3000).paso, "contar");

  const muda = guiaNueva(t0);
  assert.equal(muda.vozEstado, "esperando");
  for (let t = t0; t < t0 + 1000; t += 50) {
    assert.equal(aplicarGuia(muda, { tipo: "ok" }, t).paso, "cuidar");
  }
  assert.equal(aplicarGuia(muda, { tipo: "ok" }, t0 + 1000).paso, "contar");

  const grafica = anotarVoz({
    ...guiaNueva(t0),
    paso: "grafica",
    aparecio: t0,
    bloqueoHasta: t0 + 1000,
    autoHasta: t0 + 3000,
    vozHasta: t0 + 3000,
    vozEstado: "esperando",
  }, "hablando", t0 + 20);
  assert.equal(aplicarGuia(grafica, { tipo: "ok" }, t0 + 1100).paso, "grafica");
  assert.equal(aplicarGuia(grafica, { tipo: "toque" }, t0 + 2600).paso, "grafica");
  const dicha = anotarVoz(grafica, "termino", t0 + 2600);
  assert.equal(aplicarGuia(dicha, { tipo: "ok" }, t0 + 2600).paso, "subir");
  assert.equal(textoGuia("cuidar", false), "Ayuda al cuidador.");
  assert.equal(textoGuia("grafica", false), "Ahora la gráfica.");
});

test("un error de voz no cierra el paso de mirar: cae al reloj de 2 a 3 s", () => {
  assert.equal(MIRAR_MIN_MS, 2000);
  assert.equal(MIRAR_MAX_MS, 3000);
  assert.equal(cuentaComoFin("termino"), true);
  assert.equal(cuentaComoFin("fallo"), false);
  assert.equal(cuentaComoFin("hablando"), false);

  const vistos = [];
  let hablo = false;
  const roto = vozFalsa((u) => {
    hablo = true;
    u.onerror({ error: "synthesis-failed" });
    u.onend();
  });
  const mal = hablar("Ayuda al cuidador.", { sintesis: roto, Utterance: Frase, onEstado: (e) => vistos.push(e) });
  assert.equal(hablo, true);
  assert.equal(mal.estado, "fallo");
  assert.equal(mal.motivo, "error");
  assert.equal(vistos.includes("termino"), false);
  assert.equal(cuentaComoFin(mal.estado), false);

  let g = anotarVoz(guiaNueva(0), mal.estado, 80);
  assert.equal(g.vozEstado, "fallo");
  assert.equal(g.bloqueoHasta, 1000);
  assert.equal(instanteAuto(g), MIRAR_MIN_MS);
  assert.equal(debeAvanzarSolo(g, MIRAR_MIN_MS - 1), false);
  assert.equal(debeAvanzarSolo(g, MIRAR_MIN_MS), true);
  assert.equal(aplicarGuia(g, { tipo: "tiempo" }, MIRAR_MIN_MS).paso, "contar");
  assert.equal(aplicarGuia(g, { tipo: "ok" }, 50).paso, "cuidar");
  const hablando = anotarVoz(guiaNueva(0), "hablando", 100);
  assert.equal(instanteAuto(hablando), MIRAR_MAX_MS);
  assert.equal(debeAvanzarSolo(hablando, MIRAR_MIN_MS), false);
  assert.equal(debeAvanzarSolo(hablando, MIRAR_MAX_MS), true);

  const nuncaLista = [];
  const nunca = vozFalsa(() => { /* speak no dispara onstart ni onend */ });
  const callado = hablar("Ahora la gráfica.", { sintesis: nunca, Utterance: Frase, onEstado: (e) => nuncaLista.push(e) });
  assert.equal(callado.estado, "esperando");
  assert.equal(cuentaComoFin(callado.estado), false);
  assert.equal(nuncaLista.includes("termino"), false);
  assert.equal(anotarVoz(guiaNueva(0), "fallo").vozEstado, "fallo");
  assert.equal(debeAvanzarSolo(guiaNueva(0), MIRAR_MIN_MS - 1), false);
  assert.equal(debeAvanzarSolo(guiaNueva(0), MIRAR_MIN_MS), true);

  const bienLista = [];
  const bien = vozFalsa((u) => { u.onstart(); u.onend(); });
  const ok = hablar("Ayuda al cuidador.", { sintesis: bien, Utterance: Frase, onEstado: (e) => bienLista.push(e) });
  assert.equal(ok.estado, "termino");
  assert.deepEqual(bienLista, ["hablando", "termino"]);
  const acabada = anotarVoz(guiaNueva(0), "termino", 400);
  assert.equal(acabada.vozEstado, "termino");
  assert.equal(debeAvanzarSolo(acabada, MIRAR_MIN_MS - 1), false);
  assert.equal(debeAvanzarSolo(acabada, MIRAR_MIN_MS), true);
  assert.equal(instanteAuto(acabada), MIRAR_MIN_MS);
  assert.equal(acabada.bloqueoHasta, 1000);
});

test("getVoices vacío no es «sin voz»: speak sigue y onend cierra entre 2 y 3 s", () => {
  assert.equal(elegirVoz([]), null);
  let lecturas = 0;
  let lista = [];
  const oyentes = [];
  let dicho = null;
  const s = {
    speaking: false,
    pending: false,
    cancel() {},
    getVoices() { lecturas++; return lista; },
    addEventListener(tipo, fn) { oyentes.push({ tipo, fn }); },
    speak(u) { dicho = u; u.onend(); },
  };
  assert.equal(prepararVoces(s), null);
  assert.ok(lecturas >= 1);
  assert.equal(oyentes.length, 1);
  assert.equal(oyentes[0].tipo, "voiceschanged");

  const eventos = [];
  const r = hablar("Ahora la gráfica.", { sintesis: s, Utterance: Frase, onEstado: (e) => eventos.push(e) });
  assert.ok(dicho);
  assert.equal(dicho.lang, "es-ES");
  assert.equal(dicho.voice, undefined);
  assert.equal(r.estado, "termino");
  assert.equal(cuentaComoFin(r.estado), true);
  assert.deepEqual(eventos, ["termino"]);

  const g = anotarVoz(guiaNueva(0), r.estado, 50);
  assert.equal(debeAvanzarSolo(g, MIRAR_MIN_MS - 1), false);
  assert.equal(debeAvanzarSolo(g, MIRAR_MIN_MS), true);
  assert.equal(instanteAuto(g), MIRAR_MIN_MS);
  assert.ok(instanteAuto(g) <= MIRAR_MAX_MS);
  assert.equal(debeAvanzarSolo(g, MIRAR_MAX_MS), true);

  lista = [{ lang: "en-US", name: "Alex" }, { lang: "es-MX", name: "Paulina" }];
  oyentes[0].fn();
  assert.equal(elegirVoz(lista).name, "Paulina");
  hablar("Cuenta los monos.", { sintesis: s, Utterance: Frase });
  assert.equal(dicho.voice.name, "Paulina");
  assert.equal(dicho.lang, "es-ES");
});

test("no hay escala de 2: el nivel 5 es la tabla de conteo", () => {
  assert.equal(NIVELES.length, 6);
  assert.equal(NIVELES[4].nombre, "Tabla de conteo");
  assert.equal(NIVELES[4].modo, "palitos");
  for (const n of NIVELES) assert.doesNotMatch(n.nombre + n.ejemplo, /escala|2 en 2/);
  assert.deepEqual(ORDEN, ["mono", "leon", "jirafa", "elefante", "cebra", "hipopotamo", "pinguino", "flamenco"]);
  assert.equal(animalNuevoDeNivel(2), "elefante");
  assert.equal(fraseIngles("jirafa"), "Jirafa. giraffe.");
  assert.equal(textoContar("jirafa"), "Cuenta las jirafas.");
  assert.equal(textoContar("mono"), "Cuenta los monos.");
  assert.equal(textoCuantos("jirafa"), "¿Cuántas jirafas hay?");
  assert.equal(textoDiferencia("jirafa", "mono"), "¿Cuántas jirafas más que los monos?");
  assert.equal(textoTotalDos("jirafa", "elefante"), "¿Cuántos animales hay entre jirafas y elefantes?");
  assert.equal(textoAcierto({ clase: "diferencia", correcta: 4 }), "¡Sí! Son 4 más.");
  assert.equal(textoAcierto({ clase: "mas", correcta: "jirafa" }), "¡Sí! Hay más jirafas.");
  assert.equal(textoAcierto({ tipo: "contar", cantidad: 3 }), "¡Sí! Son 3.");
  assert.equal(fraseLlego("elefante"), "Llegó el elefante.");
  assert.equal(fraseLlego("cebra"), "Llegó la cebra.");
});

test("cada visita cabe, la gráfica coincide con los conteos y la pregunta sale de la gráfica", () => {
  for (let n = 1; n <= 6; n++) {
    for (const v of visitas(n, 10)) {
      assert.ok(v.elementos.length >= 6 && v.elementos.length <= 7, v.elementos.length + " nivel " + n);
      assert.ok(v.categorias.length >= 3 && v.categorias.length <= 4);
      assert.ok(v.categorias.every((c) => c.cantidad >= 1 && c.cantidad <= 20));
      const mayor = Math.max(...v.categorias.map((c) => c.cantidad));
      assert.equal(v.categorias.filter((c) => c.cantidad === mayor).length, 1);
      for (const e of v.elementos) {
        assert.doesNotMatch((e.texto || "") + (e.leer || ""), /quién necesita|escala|=|▲|\+/i);
        assert.doesNotMatch(e.leer || "", SIMBOLO);
        if (e.tipo === "contar") {
          assert.equal(conteoCorrecto(e, e.cantidad), true);
          assert.ok(e.opciones.includes(e.cantidad));
          assert.equal(new Set(e.opciones).size, 3);
        }
        if (e.tipo === "grafica") {
          assert.ok(e.alturasIniciales.every((h) => h === 0));
          assert.deepEqual(metasDe(e), e.categorias.map((c) => c.cantidad));
          assert.equal(coincideGraf(metasDe(e), e.categorias.map((c) => c.cantidad)), true);
          assert.equal(e.modo === "palitos" || e.modo === "dibujos" || e.modo === "barras", true);
        }
        if (e.tipo === "pregunta") {
          assert.ok(e.opciones.includes(e.correcta));
          assert.equal(new Set(e.opciones).size, e.opciones.length);
          if (e.clase === "mas") {
            assert.equal(e.texto, TEXTOS.mas);
            const top = [...e.categorias].sort((a, b) => b.cantidad - a.cantidad)[0];
            assert.equal(e.correcta, top.id);
          }
          if (e.clase === "diferencia") {
            const a = e.categorias.find((c) => c.id === e.par[0]).cantidad;
            const b = e.categorias.find((c) => c.id === e.par[1]).cantidad;
            assert.equal(e.correcta, Math.abs(a - b));
            assert.ok(e.opciones.includes(a + b), "falta el total " + e.opciones.join(","));
            const uno = Math.max(a, b);
            assert.ok(uno === e.correcta || e.opciones.includes(uno));
          }
          if (e.clase === "total" || e.clase === "total-todos") {
            const vals = e.par.map((id) => e.categorias.find((c) => c.id === id).cantidad);
            assert.equal(e.correcta, vals.reduce((s, x) => s + x, 0));
          }
          if (e.clase === "cuantos") {
            const cat = e.categorias.find((c) => c.id === e.par[0]);
            assert.equal(e.correcta, cat.cantidad);
          }
        }
        if (e.tipo === "detective") {
          assert.equal(unSoloError(e), true, JSON.stringify({ error: e.error, mostrado: e.mostrado, real: e.real }));
          assert.equal(ejeDe(e.real) === 10 || ejeDe(e.real) === 20, true);
        }
      }
      if (n === 3) {
        const difs = v.elementos.filter((e) => e.clase === "diferencia");
        for (let d = 1; d < difs.length; d++) {
          const antes = [...difs[d - 1].par].sort().join();
          const ahora = [...difs[d].par].sort().join();
          assert.notEqual(ahora, antes);
        }
      }
    }
  }
});

test("la diferencia se sombrea desde la barra baja, como en Puentes", () => {
  const barras = geometriaBarras([3, 5], 10);
  assert.equal(barras[0].y, 300 - 90);
  assert.equal(barras[1].alto, 150);
  const dif = geometriaDiferencia([3, 5], 0, 1, 10);
  assert.equal(dif.yLinea, 300 - 90);
  assert.equal(dif.sombra.h, 60);
  assert.equal(dif.sombra.y, 300 - 150);
  assert.ok(dif.linea.w > dif.sombra.w);
  assert.deepEqual(gruposPalitos(7), [5, 2]);
  assert.deepEqual(gruposPalitos(20), [5, 5, 5, 5]);
  assert.deepEqual(gruposPalitos(0), []);
  assert.deepEqual(moverBarra([1, 0], 1, 1, 10), [1, 1]);
  assert.equal(coincideGraf([2, 4], [2, 4]), true);
  const armado = armarDiferencia(5, 3, rngConSemilla(1));
  assert.equal(armado.correcta, 2);
  assert.ok(armado.opciones.includes(8));
  assert.ok(armado.opciones.includes(5));
  const total = armarTotal([4, 6], rngConSemilla(2));
  assert.equal(total.correcta, 10);
  assert.ok(total.opciones.includes(2) || total.opciones.includes(6));
});

test("detective empieza por la altura y el reto no tiene reloj", () => {
  assert.equal(tipoErrorDetective(5, 0, false), "altura");
  assert.equal(tipoErrorDetective(4, 4, false), "etiquetas");
  assert.equal(tipoErrorDetective(5, 4, false), "falta");
  assert.equal(tipoErrorDetective(5, 8, true), "altura");
  const primero = crearVisita(6, rngConSemilla("det"), { hechosDetective: 0 });
  assert.ok(primero.elementos.every((e) => e.error === "altura" && unSoloError(e)));
  const luego = crearVisita(6, rngConSemilla("det2"), { hechosDetective: 4 });
  assert.equal(luego.elementos[4].error, "etiquetas");
  assert.equal(luego.elementos[5].error, "falta");
  assert.equal(unSoloError(luego.elementos[5]), true);
  assert.ok(luego.elementos[5].opciones.some((o) => o.id === "falta" && o.texto.includes(animal(luego.elementos[5].falta).es)));

  const censo = retoDelDia("2026-10-09", 2);
  const otro = retoDelDia("2026-10-09", 2);
  assert.deepEqual(censo, otro);
  assert.equal(censo.limiteMs, undefined);
  assert.equal(censo.segundos, undefined);
  assert.doesNotMatch(censo.meta, /segundos|reloj|rápido/);
  assert.equal(censo.necesita, META_RETO);
  assert.ok(tipoReto("2026-10-09") === "censo" || tipoReto("2026-10-09") === "detective");
  retoDelDia("2026-10-10", 6);
  for (const fecha of ["2026-10-09", "2026-10-10", "2026-01-01", "2026-06-15"]) {
    const r = retoDelDia(fecha, 4);
    assert.equal(r.visita.elementos.length, LARGO_RETO);
    assert.equal(r.necesita, 4);
    assert.equal(r.limiteMs, undefined);
    if (r.tipo === "censo") {
      assert.ok(r.visita.suma <= 20 && r.visita.suma >= 12);
      assert.ok(r.visita.categorias.every((c) => c.cantidad <= 20));
      assert.equal(r.visita.categorias.reduce((s, c) => s + c.cantidad, 0), r.visita.suma);
    } else {
      assert.equal(r.visita.elementos.length, 6);
      assert.ok(r.visita.elementos.every((e) => e.tipo === "detective" && unSoloError(e)));
    }
  }
  assert.ok(visitas(2, 24).some((v) => v.horizontal));
});

test("las 4 barras caben en 360 y el eje de 20 cabe en la tele", () => {
  assert.equal(controlesCaben(4, 360, 64), true);
  assert.equal(CONTROL_PX, 64);
  assert.equal(TV_MARGEN, 36);
  assert.equal(eje20Cabe(720), true);
  assert.ok(animalesEnFila(360, 64) >= 5);
  const css = fs.readFileSync(new URL("../estilo.css", import.meta.url), "utf8");
  assert.match(css, /64px/);
  assert.match(css, /36px/);
  assert.match(css, /520px/);
  assert.match(css, /overflow-x:\s*hidden/);
  const juego = fs.readFileSync(new URL("../src/juego.js", import.meta.url), "utf8");
  assert.doesNotMatch(juego, /pointermove|arrastrar|dragstart/);
  assert.match(juego, /linea-punteada\.svg/);
  assert.match(juego, /diferencia\.svg/);
});

test("la pista del nivel 1 es el paso entero y a los 40 s ya no es a la primera", () => {
  const e = crearVisita(1, rngConSemilla("p"), {}).elementos.find((x) => x.tipo === "contar");
  const corta = pista(e, { marcados: [false] }, { nivel: 1, segundos: 0, errores: 0, tv: true });
  assert.equal(corta.paso, "completo");
  assert.match(corta.leer, /cuenta las rayitas/);
  assert.doesNotMatch(corta.leer, /Escoge el/);
  const trasError = pista(e, { marcados: [false] }, { nivel: 1, segundos: 0, errores: 1, tv: false });
  assert.match(trasError.leer, /Escoge el/);
  assert.match(trasError.leer, /Toca cada/);
  assert.doesNotMatch(corta.leer, SIMBOLO);
  const e2 = crearVisita(3, rngConSemilla("p3"), {}).elementos.find((x) => x.clase === "diferencia");
  const c = pista(e2, {}, { nivel: 3, segundos: 0, errores: 0 });
  assert.equal(c.paso, "corto");
  assert.equal(c.linea, false);
  const f = pista(e2, {}, { nivel: 3, segundos: 20, errores: 0 });
  assert.equal(f.paso, "flecha");
  assert.equal(f.linea, true);
  const full = pista(e2, {}, { nivel: 3, segundos: 40, errores: 0 });
  assert.equal(full.paso, "completo");
  assert.equal(full.sombra, false);
  assert.doesNotMatch(full.leer, /\d/);
  const visita4 = crearVisita(4, rngConSemilla("totales"), {});
  const par = visita4.elementos.find((x) => x.clase === "total");
  const todos = visita4.elementos.find((x) => x.clase === "total-todos");
  assert.ok(par && par.par.length === 2);
  assert.ok(todos && todos.par.length > 2);
  assert.match(par.texto, /^¿Cuántos animales hay entre .+ y .+\?$/);
  const luzPar = pista(par, {}, { nivel: 4, segundos: 20, errores: 0 });
  assert.equal(luzPar.flecha, "par");
  assert.equal(luzPar.luces, true);
  assert.deepEqual(luzPar.par, par.par);
  const luzTodos = pista(todos, {}, { nivel: 4, segundos: 20, errores: 0 });
  assert.equal(luzTodos.flecha, "barras");
  assert.equal(luzTodos.luces, true);
  assert.equal(luzPar.texto, "Suma una y luego la otra.");
  assert.equal(luzTodos.texto, "Suma todas las barras.");
  assert.equal(marcaPasoCompleto(3, "completo", 40), true);
  assert.equal(marcaPasoCompleto(1, "completo", 40), false);
  assert.equal(marcaPasoCompleto(3, "completo", 39), false);
  const mal = pista(e2, {}, { nivel: 3, segundos: 1, errores: 1 });
  assert.equal(mal.paso, "completo");
  assert.equal(mal.sombra, true);
  assert.match(mal.leer, /Son /);
  const det = crearVisita(6, rngConSemilla("pd"), { hechosDetective: 0 }).elementos[0];
  const pd = pista(det, {}, { nivel: 6, segundos: 20, errores: 0 });
  assert.match(pd.texto, /Cuenta otra vez l/);
});

test("8 de 10 sube, la racha no se arma con un fallo y el animal nuevo va en orden", () => {
  let pr = nuevo();
  assert.equal(pr.voz, true);
  assert.equal(pr.abiertos, 3);
  for (let i = 0; i < 7; i++) pr = anotarElemento(pr, 1, true, "2026-10-09", false);
  assert.equal(dominio(pr, 1).listo, false);
  pr = anotarElemento(pr, 1, true, "2026-10-09", false);
  pr = anotarElemento(pr, 1, true, "2026-10-09", false);
  pr = anotarElemento(pr, 1, true, "2026-10-09", false);
  assert.equal(dominio(pr, 1).aciertos >= PARA_SUBIR, true);
  const cerrado = cerrarVisita(pr, 1, 6, 6);
  assert.equal(cerrado.subio, 2);
  assert.equal(cerrado.estrellas, 3);
  assert.equal(estrellasVisita(5, 6), 2);
  assert.equal(estrellasVisita(3, 6), 1);
  assert.equal(estrellasVisita(2, 6), 0);
  const abierto = abrirAnimal(cerrado.pr, 2);
  assert.equal(abierto.nuevo, "elefante");
  let duro = nuevo();
  duro = anotarElemento(duro, 2, false, "2026-10-09", false);
  duro = anotarElemento(duro, 2, false, "2026-10-09", false);
  assert.equal(quiereFacil(duro, 2), false);
  duro = anotarElemento(duro, 2, false, "2026-10-09", false);
  assert.equal(quiereFacil(duro, 2), true);
  const antes = dominio(duro, 2).intentos;
  const salto = anotarElemento(duro, 2, true, "2026-10-09", true);
  assert.equal(dominio(salto, 2).intentos, antes);
  const fallo = anotarElemento(duro, 2, false, "2026-10-09", true);
  assert.equal(dominio(fallo, 2).intentos, antes + 1);
  let r = nuevo();
  r = cumplirReto(r, "2026-10-08", "censo", 4, true);
  r = cumplirReto(r, "2026-10-09", "detective", 3, false);
  assert.equal(racha(r, "2026-10-09"), 1);
  assert.equal(marcarGuia(r).guiaHecha, true);
  assert.equal(cargar(null).nivel, 1);
  assert.equal(cargar({ v: 1, nivel: 9, voz: false }).nivel, 6);
  assert.equal(VENTANA, 10);
});

function manadaAgrupada(orden) {
  const visto = new Set();
  let prev = null;
  for (const id of orden) {
    if (id === prev) continue;
    if (visto.has(id)) return false;
    visto.add(id);
    prev = id;
  }
  return true;
}

test("el censo suma como mucho 20 y las opciones de conteo no se repiten", () => {
  const ordenes = new Set();
  let algunaMezclada = false;
  for (let i = 0; i < 12; i++) {
    const c = crearCenso(rngConSemilla("censo-" + i), 4);
    assert.equal(c.elementos.length, 6);
    assert.equal(new Set(c.elementos.map((e) => e.texto)).size, c.elementos.length);
    assert.ok(c.suma <= 20 && c.suma >= 12);
    assert.ok(c.categorias.every((x) => x.cantidad >= 2 && x.cantidad <= 20));
    assert.equal(c.modo, "censo");
    const mixtos = c.elementos.filter((e) => e.tipo === "contar" && e.mixto);
    assert.equal(mixtos.length >= 1, true);
    for (const m of mixtos) {
      assert.equal(m.orden.length, c.suma);
      const cuenta = {};
      for (const id of m.orden) cuenta[id] = (cuenta[id] || 0) + 1;
      for (const cat of c.categorias) assert.equal(cuenta[cat.id], cat.cantidad);
      if (!manadaAgrupada(m.orden)) algunaMezclada = true;
    }
    ordenes.add(c.categorias.map((x) => x.id).join(","));
  }
  assert.ok(ordenes.size > 1);
  assert.equal(algunaMezclada, true);
  const corto = crearCenso(rngConSemilla("censo-corto"), 1);
  assert.equal(corto.elementos.length, 6);
  assert.equal(new Set(corto.elementos.map((e) => e.texto)).size, 6);
  const ops = opcionesConteo(4, rngConSemilla(3), [9]);
  assert.equal(ops.length, 3);
  assert.ok(ops.includes(4));
  assert.equal(new Set(ops).size, 3);
  assert.equal(animal("pinguino").recinto, "hielo");
  assert.equal(animal("mono").comida, "platanos");
});
