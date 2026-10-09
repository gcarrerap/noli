import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { rngConSemilla } from "../src/rng.js";
import {
  longitudReal, marcaAlFinal, confirmarCero, decirUnidad, hablaSegura, cerca, opcionesCerca,
  combinacion, cruzarBrilla, cubosDe, seMidioBien, moverRegla, U_CM, U_IN, resultadoListo,
  escalaFija, cajaReferencia, escalaBloques, altoComunTablas, cajaTabla, huecoEnPx,
  anchoDeVista, layoutRegla, xDeFlecha,
  trasFallo, INTENTOS, cruzarListo, resultadoCruzar, puedeUsar, escalaArbol, ARBOL_MAX,
} from "../src/medida.js";
import {
  crearCruce, sumaValida, unidadDeCruce, planSuma, POR_TURNO, ZONAS, NIVELES_MAX, maxRegla,
} from "../src/niveles.js";
import {
  crearReloj, abrirDialogoGuia, seguirDialogoGuia, debeAvanzarSolo, msHastaAvance,
  alAvisoVoz, marcarVozEmpezada, responderGuia, guiaTerminada, textoDeGuia, vozDeGuia,
  saltarAlcanzable, focoDeGuia, HUECO_GUIA, GUIA_TOQUE_MS, GUIA_TOPE_MS, GUIA_CIERRE_MS,
  limiteEntrada, guiaBloqueada,
} from "../src/guia.js";
import { anulaPrimera, cuentaPrimera, fasePista, glifoMas, textoPista } from "../src/pista.js";
import {
  nuevo, cargar, registrar, dominio, cerrarTurno, estrellasTurno, quiereFacil,
  marcarGuia, cicloUnidad, PARA_SUBIR, VENTANA,
} from "../src/progreso.js";
import { retoDelDia, retosCoherentes, estimaBien, META } from "../src/reto.js";
import { resolverAtras, resolverEntrada, marcarIgnorar, TRAS_DIALOGO_MS, accionAtras, entradaIgnorada } from "../src/salida.js";
import { decir, interpretarVoz, elegirVoz, prepararVoces } from "../src/voz.js";
import { htmlComparar, posicionRegla, svgInline } from "../src/escena.js";
import { notaReferencia, explicaBloques } from "../src/frases.js";

const textos = JSON.parse(fs.readFileSync(new URL("../datos/textos.json", import.meta.url), "utf8"));
const HOY = "2026-10-09";

test("la regla se lee con el cero y sin el cero", () => {
  assert.equal(longitudReal(0, 6), 6);
  assert.equal(marcaAlFinal(6, 0), 6);
  assert.equal(longitudReal(2, 8), 6);
  assert.equal(marcaAlFinal(6, 2), 8);
  assert.notEqual(longitudReal(2, 8), marcaAlFinal(6, 2));
  assert.equal(confirmarCero(0).puesta, true);
  assert.equal(confirmarCero(0).anulaPrimera, false);
  assert.equal(confirmarCero(2).brilloCero, true);
  assert.equal(confirmarCero(2).puesta, false);
  assert.equal(confirmarCero(-1).anulaPrimera, true);
  assert.equal(moverRegla(4, 1), 4);
  assert.equal(moverRegla(-2, -1), -2);
});

test("siempre hay tablas que completan el hueco", () => {
  for (let semilla = 1; semilla <= 40; semilla++) {
    const rnd = rngConSemilla("tablas-" + semilla);
    for (const tv of [false, true]) {
      for (const ajuste of ["ambas", "cm", "in"]) {
        const bien = semilla % 2 ? 0 : 8;
        const c = crearCruce(5, rnd, { indice: semilla, tv, ajuste, bien });
        assert.equal(c.tipo, "juntar", semilla);
        assert.equal(sumaValida(c), true, JSON.stringify(c.solucion));
        assert.ok(c.piezas >= 2);
        assert.ok(combinacion(c.ofrecidas, c.longitud, c.piezas));
        if (bien < 4 && ajuste !== "in" && !tv) assert.ok(c.longitud <= 20);
        if (ajuste === "in") assert.ok(c.longitud <= 16);
      }
    }
  }
  assert.equal(planSuma({ bien: 0, tv: false, unidad: "cm" }).tope, 20);
  assert.equal(planSuma({ bien: 8, tv: true, unidad: "cm" }).tope, 100);
  assert.ok(planSuma({ bien: 8, tv: false, unidad: "cm" }).tope <= 40);
});

test("la estimación buena queda a ±2 y las otras no", () => {
  for (let semilla = 1; semilla <= 30; semilla++) {
    const rnd = rngConSemilla("estima-" + semilla);
    const c = crearCruce(4, rnd, { indice: semilla, ajuste: "cm" });
    const buenas = c.opciones.filter((n) => cerca(n, c.longitud, 2));
    assert.deepEqual(buenas, [c.longitud]);
    assert.equal(c.referencia === "cubito" || c.referencia === "tabla10" || c.referencia === "clip", true);
    const libre = opcionesCerca(9, rnd);
    assert.equal(libre.filter((n) => cerca(n, 9)).length, 1);
  }
});

test("el reto del día es el mismo con la misma fecha y no tiene reloj", () => {
  const tv = false;
  const a = retoDelDia(HOY, "ambas", textos, tv);
  const b = retoDelDia(HOY, "ambas", textos, tv);
  assert.deepEqual(a, b);
  assert.equal(a.problemas.length, META.cuantos);
  assert.equal(a.necesita, META.necesita);
  assert.equal(a.limiteMs, undefined);
  assert.equal(a.reloj, undefined);
  assert.equal(retosCoherentes(a), true);
  assert.notDeepEqual(retoDelDia("2026-01-02", "ambas", textos, tv).problemas, a.problemas);
  let vioAguila = a.tipo === "aguila";
  let vioLargo = a.tipo === "largo";
  for (let dia = 1; dia <= 24 && !(vioAguila && vioLargo); dia++) {
    const r = retoDelDia(`2026-03-${String(dia).padStart(2, "0")}`, "cm", textos, true);
    assert.equal(retosCoherentes(r), true);
    if (r.tipo === "aguila") {
      vioAguila = true;
      assert.ok(r.problemas.every((p) => p.referencia));
      const arbol = r.problemas.find((p) => p.tipo === "arbol");
      assert.ok(arbol);
      assert.equal(arbol.opciones.filter((n) => cerca(n, arbol.longitud)).length, 1);
    }
    if (r.tipo === "largo") vioLargo = true;
  }
  assert.equal(vioAguila && vioLargo, true);
  assert.equal(estimaBien(8, 10), true);
  assert.equal(estimaBien(7, 10), false);
});

test("nivel 6 resta hasta 20 con los troncos alineados a la izquierda", () => {
  for (let i = 0; i < 25; i++) {
    const c = crearCruce(6, rngConSemilla("resta-" + i), { indice: i, ajuste: "ambas" });
    assert.equal(c.tipo, "comparar");
    assert.equal(c.largo - c.corto, c.longitud);
    assert.ok(c.longitud >= 1 && c.longitud <= 20);
    assert.ok(c.largo <= 20 && c.corto >= 1);
    assert.equal(c.unidad, "cm");
  }
  const html = htmlComparar({
    corto: 4, largo: 10, svgCorto: "<svg></svg>", svgLargo: "<svg></svg>",
    svgDif: "<svg data-dif></svg>", svgLinea: "<svg data-linea></svg>",
    etCorto: "Corto: 4 cm", etLargo: "Largo: 10 cm",
    flecha: '<span class="flecha-pista"></span>',
  });
  assert.match(html, /data-estilo="cuantos-mas"/);
  assert.match(html, /data-dif/);
  assert.match(html, /data-linea/);
  assert.match(html, /width:40%/);
  assert.match(html, /comp-dif/);
  const dif = html.slice(html.indexOf('class="comp-dif"'), html.indexOf('class="comp-punteo"'));
  assert.match(dif, /flecha-pista/);
  assert.equal(dif.includes("Corto"), false);
  assert.match(html, /comp-eti/);
  assert.equal(html.includes("comp-leyenda"), false);
});

test("los bloques mal medidos no cuentan como bien", () => {
  assert.equal(seMidioBien("bien"), true);
  assert.equal(seMidioBien("hueco"), false);
  assert.equal(seMidioBien("encimado"), false);
  const hueco = cubosDe(4, "hueco");
  assert.ok(hueco.some((c) => c.coral));
  assert.ok(Math.max(...hueco.map((c) => c.x)) > 3);
  assert.deepEqual(cubosDe(4, "bien").map((c) => c.x), [0, 1, 2, 3]);
  assert.equal(explicaBloques("hueco", textos), "Había un hueco entre los bloques.");
  assert.equal(explicaBloques("encimado", textos), "Había bloques encimados.");
  assert.match(explicaBloques("bien", textos), /pegados/);
  let vioMal = false;
  for (let i = 0; i < 20; i++) {
    const c = crearCruce(1, rngConSemilla("bloques-" + i), { facil: false });
    assert.equal(c.fases[0], "bien");
    if (c.modoBloques !== "bien") {
      vioMal = true;
      assert.deepEqual(c.fases, ["bien", "cuantos"]);
    }
  }
  assert.equal(vioMal, true);
});

test("cm primero, pulgadas desde el 3, y Para papás deja una sola", () => {
  assert.equal(unidadDeCruce(2, "ambas", 0), "cm");
  assert.equal(unidadDeCruce(3, "ambas", 0), "in");
  assert.equal(unidadDeCruce(6, "ambas", 1), "cm");
  assert.equal(unidadDeCruce(4, "cm", 1), "cm");
  assert.equal(unidadDeCruce(2, "in", 0), "in");
  assert.equal(unidadDeCruce(1, "in", 0), "bloque");
  assert.equal(cicloUnidad("ambas"), "cm");
  assert.equal(cicloUnidad("cm"), "in");
  assert.equal(cicloUnidad("in"), "ambas");
  assert.equal(decirUnidad(1, "cm"), "1 centímetro");
  assert.equal(decirUnidad(6, "cm"), "6 centímetros");
  assert.equal(decirUnidad(2, "in"), "2 pulgadas");
  assert.equal(/\bcm\b|\bin\b/.test(decirUnidad(6, "cm") + decirUnidad(2, "in")), false);
  const sinCm = JSON.stringify(textos).replace(/centímetros/gi, "").replace(/centímetro/gi, "");
  assert.equal(/\bmetros?\b|\bpies\b|\bpie\b/.test(sinCm), false);
});

test("la referencia sigue a la unidad y el desfase deja el 0 fuera del río", () => {
  for (let i = 0; i < 12; i++) {
    const c = crearCruce(4, rngConSemilla("ref-in-" + i), { indice: i, ajuste: "in" });
    assert.equal(c.unidad, "in");
    assert.ok(c.referencia === "tabla1in" || c.referencia === "clipin");
    assert.equal(/centímetro/i.test(notaReferencia(c, textos, false)), false);
    assert.match(notaReferencia(c, textos, true), /pulgada/);
  }
  const k = 2;
  const n = 6;
  const pos = posicionRegla({ anchoVb: 412, cero: 26, gapU: n * U_CM, desplaza: -k, unidadU: U_CM });
  assert.equal(pos.left + (-k) * U_CM + k * U_CM, pos.left);
  assert.equal(pos.left + (-k) * U_CM + (k + n) * U_CM, pos.left + n * U_CM);
  const larga = textoPista({ nivel: 7, tipo: "desfase", longitud: 6, desplazaInicial: 2, unidad: "cm" }, "completa", textos, "leer");
  assert.equal(larga, "Empieza en 2 y termina en 8. 8 menos 2 es 6.");
  assert.equal(textoPista({ nivel: 2, tipo: "medir", longitud: 6, unidad: "cm" }, "frase", textos, "poner"), textos.pistaCero);
  assert.equal(textoPista({ nivel: 2, tipo: "medir", longitud: 6, unidad: "cm" }, "frase", textos, "tabla"), "");
  assert.equal(textoPista({ nivel: 2, tipo: "medir", longitud: 6, unidad: "cm" }, "completa", textos, "tabla").includes("orilla"), false);
  assert.equal(textoPista({ nivel: 3, tipo: "medir", longitud: 4, unidad: "in" }, "frase", textos, "poner"), textos.pistaCero);
  assert.equal(textoPista({ nivel: 3, tipo: "medir", longitud: 4, unidad: "in" }, "completa", textos, "poner"), textos.pistaCeroLarga);
  assert.equal(textoPista({ nivel: 3, tipo: "medir", longitud: 4, unidad: "in" }, "frase", textos, "tabla"), textos.pistaMira);
  assert.equal(resultadoListo(3, 6, "comparar"), "fallo");
  assert.equal(resultadoListo(6, 6, "comparar"), "bien");
  assert.equal(resultadoListo(3, 6, "leer"), "fallo");
  assert.match(svgInline('<text><tspan class="unidad"> in</tspan></text>'), /pulg\./);
  assert.equal(/[^.]in\b/.test(svgInline('<text><tspan class="unidad"> in</tspan></text>')), false);
  const regla = fs.readFileSync(new URL("../img/regla-in-6.svg", import.meta.url), "utf8");
  const reglaLista = svgInline(regla);
  assert.match(reglaLista, /class="unidad"[^>]*>\s*pulg\./);
  assert.equal(/class="unidad"[^>]*>\s*in\s*</.test(reglaLista), false);
});

test("la guía del 6 y el diálogo de salir", () => {
  assert.equal(textoDeGuia(0, textos), "El conejo quiere cruzar.");
  assert.equal(textoDeGuia(2, textos), "Mueve la regla: el 0 va en la orilla.");
  assert.equal(textoDeGuia(2, textos, "tv"), "Mueve la regla con ◀ ▶ hasta el 0 y pulsa OK.");
  assert.equal(vozDeGuia(2, textos, "tv"), "Mueve la regla con las flechas hasta el 0 y pulsa OK.");
  assert.equal(/[◀▶▲▼]/.test(vozDeGuia(2, textos, "tv")), false);
  assert.equal(/\bcm\b|[▲+]/.test(vozDeGuia(5, textos, "tv")), false);
  assert.equal(saltarAlcanzable(0), false);
  assert.equal(saltarAlcanzable(1), false);
  assert.equal(saltarAlcanzable(2), false);
  assert.equal(saltarAlcanzable(3), false);
  assert.equal(focoDeGuia(2), "poner");
  assert.notEqual(focoDeGuia(0), "saltar");

  let reloj = crearReloj(0, 0);
  assert.equal(responderGuia(reloj, 0, { tipo: "toque" }).accion, "nada");
  assert.equal(responderGuia(reloj, 0, { tipo: "ok" }).accion, "nada");
  assert.equal(responderGuia(reloj, GUIA_CIERRE_MS, { tipo: "toque" }).accion, "avanzo");
  assert.equal(responderGuia(reloj, GUIA_CIERRE_MS, { tipo: "ok" }).accion, "avanzo");
  assert.equal(debeAvanzarSolo(reloj, GUIA_TOQUE_MS - 1), false);
  assert.equal(debeAvanzarSolo(reloj, GUIA_TOQUE_MS), true);
  assert.equal(debeAvanzarSolo(marcarVozEmpezada(reloj), GUIA_TOQUE_MS), false);
  assert.equal(debeAvanzarSolo(marcarVozEmpezada(reloj), GUIA_TOPE_MS), true);

  const temprano = alAvisoVoz(marcarVozEmpezada(reloj), 1200, "fin");
  assert.equal(temprano.avanza, false);
  assert.equal(debeAvanzarSolo(temprano.reloj, GUIA_TOQUE_MS), true);

  reloj = crearReloj(0, 2);
  assert.equal(responderGuia(reloj, 100, { tipo: "poner", desplaza: 0 }).accion, "nada");
  assert.equal(responderGuia(reloj, 1000, { tipo: "poner", desplaza: 2 }).accion, "nada");
  assert.equal(responderGuia(reloj, 1000, { tipo: "poner", desplaza: 0 }).paso ?? responderGuia(reloj, 1000, { tipo: "poner", desplaza: 0 }).accion, "avanzo");
  assert.equal(responderGuia(crearReloj(0, 4), 1000, { tipo: "elegir", valor: 4 }).accion, "nada");
  assert.equal(responderGuia(crearReloj(0, 4), 1000, { tipo: "elegir", valor: HUECO_GUIA }).accion, "avanzo");
  assert.equal(guiaTerminada(6), true);

  const pausa = abrirDialogoGuia(crearReloj(0, 1), 800);
  assert.equal(debeAvanzarSolo(pausa, 99999), false);
  assert.equal(msHastaAvance(pausa, 99999), null);
  assert.equal(alAvisoVoz(pausa, 900, "fin").avanza, false);
  assert.equal(responderGuia(pausa, 900, { tipo: "saltar" }).accion, "nada");
  assert.equal(responderGuia(pausa, 900, { tipo: "toque" }).accion, "nada");
  const sigue = seguirDialogoGuia(pausa, 5000);
  assert.equal(sigue.inicio, 5000);
  assert.equal(sigue.pausado, false);
  assert.equal(sigue.reiniciarVoz, true);
  assert.equal(sigue.ignorarHasta, 5000 + TRAS_DIALOGO_MS);
  assert.equal(debeAvanzarSolo(sigue, 6999), false);
  assert.equal(debeAvanzarSolo(sigue, 7000), true);
  assert.equal(responderGuia(sigue, 5399, { tipo: "toque" }).accion, "ignorar");
  assert.equal(responderGuia(sigue, 5399, { tipo: "ok" }).accion, "ignorar");
  assert.equal(responderGuia(sigue, 5400, { tipo: "ok" }).accion, "nada");
  assert.equal(responderGuia(sigue, 5000 + GUIA_CIERRE_MS - 1, { tipo: "toque" }).accion, "nada");
  assert.equal(responderGuia(sigue, 5000 + GUIA_CIERRE_MS, { tipo: "toque" }).accion, "avanzo");
  assert.equal(limiteEntrada(sigue, "toque"), 5000 + GUIA_CIERRE_MS);
  assert.equal(limiteEntrada(sigue, "ok"), 5000 + GUIA_CIERRE_MS);

  const accion = seguirDialogoGuia(abrirDialogoGuia(crearReloj(0, 2), 10), 5000);
  const suma = 5000 + TRAS_DIALOGO_MS + GUIA_CIERRE_MS;
  assert.equal(limiteEntrada(accion, "poner"), 5000 + GUIA_CIERRE_MS);
  assert.notEqual(limiteEntrada(accion, "poner"), suma);
  assert.equal(responderGuia(accion, 5000 + TRAS_DIALOGO_MS, { tipo: "poner", desplaza: 0 }).accion, "nada");
  assert.equal(responderGuia(accion, 5000 + GUIA_CIERRE_MS - 1, { tipo: "poner", desplaza: 0 }).accion, "nada");
  assert.equal(responderGuia(accion, 5000 + GUIA_CIERRE_MS, { tipo: "poner", desplaza: 0 }).accion, "avanzo");

  assert.equal(marcarIgnorar(1000), 1400);
  assert.equal(resolverEntrada({ dialogo: true, ahora: 1000, tipo: "ok" }), "dialogo");
  assert.equal(resolverEntrada({ ignorarHasta: 1400, ahora: 1399, tipo: "toque" }), "ignorar");
  assert.equal(resolverEntrada({ ignorarHasta: 1400, ahora: 1400, tipo: "ok" }), "seguir");
  assert.equal(resolverAtras(true), "cerrar");
  assert.equal(resolverAtras(false), "abrir");
  assert.equal(accionAtras("guia"), "preguntar");
  assert.equal(accionAtras("feedback"), "preguntar");
  assert.equal(accionAtras("papas"), "progreso");
});

test("un speechSynthesis que falla no termina el paso de mirar", () => {
  const anterior = globalThis.window;
  const Utterance = function Utterance(texto) { this.text = texto; };
  const synth = {
    speaking: false,
    cancel() {},
    getVoices() { return [{ lang: "es-MX", name: "Prueba" }]; },
    speak(u) {
      if (typeof u.onerror === "function") u.onerror({ error: "synthesis-failed" });
    },
  };
  globalThis.window = { speechSynthesis: synth, SpeechSynthesisUtterance: Utterance };
  try {
    let fin = 0;
    let no = 0;
    const ok = decir("El conejo quiere cruzar.", "es-MX", () => { fin++; }, (motivo) => { no++; assert.equal(motivo, "error"); });
    assert.equal(fin, 0);
    assert.equal(no, 1);
    assert.equal(ok, false);
    assert.equal(interpretarVoz("error", false).termino, false);
    assert.equal(interpretarVoz("end", false).termino, false);
    assert.equal(interpretarVoz("end", true).termino, true);
    assert.equal(interpretarVoz("sin-voces", false).termino, false);

    const aviso = alAvisoVoz(crearReloj(0, 0), 50, "error");
    assert.equal(aviso.avanza, false);
    assert.equal(aviso.reloj.vozFallo, true);
    assert.equal(debeAvanzarSolo(aviso.reloj, 1999), false);
    assert.equal(debeAvanzarSolo(aviso.reloj, 2000), true);
    assert.equal(debeAvanzarSolo(aviso.reloj, 3000), true);
    assert.equal(responderGuia(aviso.reloj, 50, { tipo: "toque" }).accion, "nada");
    assert.equal(responderGuia(aviso.reloj, 50, { tipo: "ok" }).accion, "nada");
    assert.equal(responderGuia(aviso.reloj, GUIA_CIERRE_MS, { tipo: "ok" }).accion, "avanzo");
  } finally {
    if (anterior === undefined) delete globalThis.window;
    else globalThis.window = anterior;
  }
});

test("getVoices vacío no impide hablar y onend no adelanta el paso", () => {
  const anterior = globalThis.window;
  const Utterance = function Utterance(texto) { this.text = texto; this.lang = ""; };
  let emitida = null;
  let llamadas = 0;
  const voces = [];
  let alCambiar = null;
  const synth = {
    speaking: false,
    cancel() {},
    getVoices() { return voces; },
    addEventListener(tipo, fn) { if (tipo === "voiceschanged") alCambiar = fn; },
    speak(u) {
      llamadas++;
      emitida = u;
      if (typeof u.onstart === "function") u.onstart();
      if (typeof u.onend === "function") u.onend();
    },
  };
  globalThis.window = { speechSynthesis: synth, SpeechSynthesisUtterance: Utterance };
  try {
    prepararVoces(synth);
    assert.equal(typeof alCambiar, "function");
    let fin = 0;
    let no = 0;
    const ok = decir("El conejo quiere cruzar.", "es-MX", () => { fin++; }, () => { no++; });
    assert.equal(llamadas, 1);
    assert.equal(ok, false);
    assert.equal(fin, 1);
    assert.equal(no, 0);
    assert.equal(emitida.lang, "es-MX");
    assert.equal(emitida.voice, undefined);
    const aviso = alAvisoVoz(marcarVozEmpezada(crearReloj(0, 0)), 20, "fin");
    assert.equal(aviso.avanza, false);
    assert.equal(debeAvanzarSolo(aviso.reloj, 1999), false);
    assert.equal(debeAvanzarSolo(aviso.reloj, 2000), true);
    assert.equal(debeAvanzarSolo(aviso.reloj, 3000), true);
    assert.equal(responderGuia(aviso.reloj, 20, { tipo: "toque" }).accion, "nada");
    assert.equal(responderGuia(aviso.reloj, 20, { tipo: "ok" }).accion, "nada");
    assert.equal(responderGuia(aviso.reloj, GUIA_CIERRE_MS, { tipo: "toque" }).accion, "avanzo");

    const paulina = { lang: "es-MX", name: "Paulina" };
    voces.push(paulina);
    alCambiar();
    assert.equal(elegirVoz(voces), paulina);
    synth.speak = (u) => {
      llamadas++;
      emitida = u;
      if (typeof u.onstart === "function") u.onstart();
      if (typeof u.onend === "function") u.onend();
    };
    fin = 0;
    no = 0;
    let empezo = 0;
    decir("Hola.", "es-MX", () => { fin++; }, () => { no++; }, () => { empezo++; });
    assert.equal(emitida.voice, paulina);
    assert.equal(emitida.lang, "es-MX");
    assert.equal(empezo, 1);
    assert.equal(fin, 1);
    assert.equal(no, 0);
    const temprano = alAvisoVoz(marcarVozEmpezada(crearReloj(0, 0)), 30, "fin");
    assert.equal(temprano.avanza, false);
    assert.equal(debeAvanzarSolo(temprano.reloj, 2000), true);
  } finally {
    if (anterior === undefined) delete globalThis.window;
    else globalThis.window = anterior;
  }
});

test("sin empezar tampoco cuenta como el final", () => {
  const anterior = globalThis.window;
  const Utterance = function Utterance(texto) { this.text = texto; };
  globalThis.window = {
    speechSynthesis: {
      speaking: false,
      cancel() {},
      getVoices() { return [{ lang: "es-MX" }]; },
      speak(u) { if (typeof u.onend === "function") u.onend(); },
    },
    SpeechSynthesisUtterance: Utterance,
  };
  try {
    let fin = 0;
    let no = 0;
    const ok = decir("Hola.", "es-MX", () => { fin++; }, (motivo) => { no++; assert.equal(motivo, "no-empieza"); });
    assert.equal(fin, 0);
    assert.equal(no, 1);
    assert.equal(ok, false);
    const aviso = alAvisoVoz(crearReloj(100, 1), 150, "no-empieza");
    assert.equal(aviso.avanza, false);
    assert.equal(debeAvanzarSolo(aviso.reloj, 100 + 1999), false);
    assert.equal(debeAvanzarSolo(aviso.reloj, 100 + 2000), true);
  } finally {
    if (anterior === undefined) delete globalThis.window;
    else globalThis.window = anterior;
  }
});

test("los candados aguantan un Date.now de verdad", () => {
  const epoca = 1_759_000_000_000;
  assert.notEqual(epoca | 0, epoca);
  const reloj = crearReloj(epoca, 0);
  assert.equal(limiteEntrada(reloj, "ok"), epoca + GUIA_CIERRE_MS);
  assert.equal(responderGuia(reloj, epoca + 173, { tipo: "ok" }).accion, "nada");
  assert.equal(responderGuia(reloj, epoca + 173, { tipo: "toque" }).accion, "nada");
  assert.equal(responderGuia(reloj, epoca + GUIA_CIERRE_MS - 1, { tipo: "ok" }).accion, "nada");
  assert.equal(responderGuia(reloj, epoca + GUIA_CIERRE_MS, { tipo: "ok" }).accion, "avanzo");

  const sigue = seguirDialogoGuia(abrirDialogoGuia(crearReloj(epoca, 1), epoca), epoca);
  for (const ms of [90, 150, 300]) {
    assert.equal(responderGuia(sigue, epoca + ms, { tipo: "toque" }).accion, "ignorar");
    assert.equal(responderGuia(sigue, epoca + ms, { tipo: "ok" }).accion, "ignorar");
  }
  assert.equal(responderGuia(sigue, epoca + GUIA_CIERRE_MS, { tipo: "toque" }).accion, "avanzo");
  assert.equal(entradaIgnorada(marcarIgnorar(epoca), epoca + 90, "toque"), true);
  assert.equal(entradaIgnorada(marcarIgnorar(epoca), epoca + 150, "ok"), true);
  assert.equal(entradaIgnorada(marcarIgnorar(epoca), epoca + 300, "toque"), true);
  assert.equal(resolverEntrada({ ignorarHasta: marcarIgnorar(epoca), ahora: epoca + 90, tipo: "toque" }), "ignorar");
  assert.equal(resolverEntrada({ ignorarHasta: marcarIgnorar(epoca), ahora: epoca + 400, tipo: "ok" }), "seguir");
  assert.equal(entradaIgnorada(epoca | 0, epoca + 90, "toque"), false);
});

test("un paso de mirar espera a la voz, con tope de 3 s", () => {
  const epoca = 1_759_000_000_000;
  const hablando = marcarVozEmpezada(crearReloj(epoca, 0));
  assert.equal(hablando.vozSigue, true);
  assert.equal(limiteEntrada(hablando, "ok"), epoca + GUIA_TOPE_MS);
  assert.equal(guiaBloqueada(hablando, epoca + 1050, "ok"), true);
  assert.equal(guiaBloqueada(hablando, epoca + 2000, "toque"), true);
  assert.equal(responderGuia(hablando, epoca + 1050, { tipo: "ok" }).accion, "nada");
  assert.equal(responderGuia(hablando, epoca + 2000, { tipo: "toque" }).accion, "nada");
  assert.equal(guiaBloqueada(hablando, epoca + GUIA_TOPE_MS - 1, "ok"), true);
  assert.equal(guiaBloqueada(hablando, epoca + GUIA_TOPE_MS, "ok"), false);
  assert.equal(responderGuia(hablando, epoca + GUIA_TOPE_MS, { tipo: "ok" }).accion, "avanzo");

  const paso1 = marcarVozEmpezada(crearReloj(epoca, 1));
  assert.equal(responderGuia(paso1, epoca + 80, { tipo: "toque" }).accion, "nada");
  assert.equal(responderGuia(paso1, epoca + 1050, { tipo: "toque" }).accion, "nada");
  assert.equal(responderGuia(paso1, epoca + GUIA_TOPE_MS, { tipo: "ok" }).accion, "avanzo");

  const callo = alAvisoVoz(hablando, epoca + 1500, "fin").reloj;
  assert.equal(callo.vozSigue, false);
  assert.equal(limiteEntrada(callo, "ok"), epoca + GUIA_CIERRE_MS);
  assert.equal(responderGuia(callo, epoca + 1500, { tipo: "ok" }).accion, "avanzo");
  assert.equal(responderGuia(crearReloj(epoca, 0), epoca + 1050, { tipo: "ok" }).accion, "avanzo");

  const accion = marcarVozEmpezada(crearReloj(epoca, 2));
  assert.equal(limiteEntrada(accion, "poner"), epoca + GUIA_CIERRE_MS);
  assert.equal(responderGuia(accion, epoca + 1050, { tipo: "poner", desplaza: 0 }).accion, "avanzo");
});

test("la referencia y el hueco comparten los px por unidad", () => {
  const ancho = 332;
  const largo = huecoEnPx({ unidad: "cm", longitud: 10, ancho });
  const corto = huecoEnPx({ unidad: "cm", longitud: 4, ancho, desplaza: 2 });
  assert.equal(largo.px, corto.px);
  assert.equal(largo.u, corto.u);
  assert.ok(Math.abs(largo.gapPx / 10 - corto.gapPx / 4) < 1e-9);
  const tabla = cajaReferencia("tabla10");
  const cubo = cajaReferencia("cubito");
  const clip = cajaReferencia("clip");
  assert.ok(Math.abs((tabla.w * largo.u) / tabla.unidades - largo.gapPx / 10) < 1e-9);
  assert.ok(Math.abs((cubo.w * largo.u) / cubo.unidades - largo.px) < 1e-9);
  assert.ok(Math.abs((clip.w * largo.u) / clip.unidades - largo.px) < 1e-9);
  assert.equal(escalaFija({ unidad: "cm", ancho, tv: false }).px, largo.px);

  const pulgadas = huecoEnPx({ unidad: "in", longitud: 4, ancho });
  const otras = huecoEnPx({ unidad: "in", longitud: 1, ancho });
  assert.equal(pulgadas.px, otras.px);
  const tablaIn = cajaReferencia("tabla1in");
  const clipIn = cajaReferencia("clipin");
  assert.ok(Math.abs((tablaIn.w * pulgadas.u) / tablaIn.unidades - pulgadas.gapPx / 4) < 1e-9);
  assert.ok(Math.abs(clipIn.w * pulgadas.u - pulgadas.px) < 1e-9);

  const bloques = escalaBloques({ longitud: 8, ancho });
  assert.ok(bloques.cubo > 28);
  assert.ok(Math.abs(bloques.hueco - bloques.cubo * 8) < 1e-9);
  const pocos = escalaBloques({ longitud: 4, ancho });
  assert.ok(pocos.cubo >= bloques.cubo);

  const alto = altoComunTablas([12, 2, 1], "cm", ancho);
  const chica = cajaTabla(1, "cm", alto);
  const grande = cajaTabla(12, "cm", alto);
  assert.equal(chica.h, grande.h);
  assert.ok(chica.w * 12 - grande.w < 1e-6 && grande.w - chica.w * 12 < 1e-6);
  assert.ok(chica.w < grande.w);
});

test("la marca del final cabe a 360, a 412 y en la tele", () => {
  const vistas = [
    { viewport: 360, tv: false },
    { viewport: 412, tv: false },
    { viewport: 1280, tv: true },
  ];
  let vistos = 0;
  for (const vista of vistas) {
    const ancho = anchoDeVista(vista.viewport, vista.tv);
    for (let nivel = 1; nivel <= NIVELES_MAX; nivel++) {
      for (let i = 0; i < 24; i++) {
        for (const ajuste of ["ambas", "cm", "in"]) {
          const c = crearCruce(nivel, rngConSemilla(`marca-${vista.viewport}-${nivel}-${i}-${ajuste}-${vista.tv ? 1 : 0}`), {
            indice: i, tv: vista.tv, ajuste, bien: i,
          });
          if (c.tipo === "bloques" || c.tipo === "comparar" || c.tipo === "arbol") continue;
          const unidad = c.unidad === "in" ? "in" : "cm";
          const tope = maxRegla(unidad, vista.tv);
          const llenar = c.tipo === "juntar" && c.longitud > tope;
          const longitud = llenar ? c.longitud : Math.min(c.longitud, tope);
          const desplaza = c.tipo === "desfase" ? -Number(c.desplazaInicial || 0) : Number(c.desplazaInicial || 0);
          const lay = layoutRegla({ unidad, longitud, tv: vista.tv, ancho, desplaza, llenar });
          const corrida = layoutRegla({ unidad, longitud, tv: vista.tv, ancho, desplaza: 4, llenar });
          assert.ok(lay.marcaX >= 0);
          assert.ok(lay.marcaX <= ancho, `marca ${lay.marcaX} fuera de ${ancho} (nivel ${nivel}, ${unidad}, ${longitud})`);
          assert.equal(lay.marcaX, corrida.marcaX);
          if (!llenar) {
            const puesta = layoutRegla({ unidad, longitud, tv: vista.tv, ancho, desplaza: 0 });
            assert.ok(puesta.unidadX <= ancho, `unidad ${puesta.unidadX} fuera de ${ancho}`);
            assert.ok(puesta.unidadX <= puesta.w + 1e-6);
            assert.ok(puesta.reglaX >= -1e-6);
            assert.ok(puesta.reglaX + puesta.reglaW <= puesta.w + 1e-6);
            assert.ok(puesta.marcaX <= puesta.unidadX);
          }
          vistos++;
        }
      }
    }
  }
  assert.ok(vistos > 200);
});

test("la flecha del cero señala la orilla y pulg. se lee", () => {
  const ancho = anchoDeVista(360, false);
  const lay = layoutRegla({ unidad: "in", longitud: 6, ancho, desplaza: 2 });
  const ceroEnRegla = lay.bancoI + 2 * lay.unit * lay.u;
  assert.ok(ceroEnRegla > lay.bancoI + 1);
  assert.ok(ceroEnRegla < lay.marcaX);
  assert.equal(xDeFlecha({ blanco: "cero", bancoI: lay.bancoI, marcaX: lay.marcaX, desplaza: 2 }), lay.bancoI);
  const regla = fs.readFileSync(new URL("../img/regla-in-6.svg", import.meta.url), "utf8");
  const tam = regla.match(/<text class="unidad"[^>]*font-size="(\d+)"/);
  assert.ok(tam);
  assert.ok(Number(tam[1]) >= 24);
  const css = fs.readFileSync(new URL("../estilo.css", import.meta.url), "utf8");
  assert.match(css, /\.opciones\.apunta\{[^}]*padding-top:\s*46px/);
  assert.equal(css.includes("overflow-wrap:anywhere"), false);
});

test("8 de 10 sube, la pista completa no es a la primera y la racha no baja el nivel", () => {
  assert.equal(estrellasTurno(POR_TURNO), 3);
  assert.equal(estrellasTurno(5), 2);
  assert.equal(estrellasTurno(3), 1);
  assert.equal(estrellasTurno(2), 0);
  assert.equal(PARA_SUBIR, 8);
  assert.equal(VENTANA, 10);
  let p = nuevo();
  for (let i = 0; i < 8; i++) p = registrar(p, 1, true, HOY);
  p = registrar(p, 1, false, HOY);
  p = registrar(p, 1, false, HOY);
  assert.equal(dominio(p, 1).listo, true);
  const sube = cerrarTurno(p, 1, 6);
  assert.equal(sube.subio, 2);
  assert.equal(sube.pr.nivel, 2);

  let quieta = nuevo();
  quieta = registrar(quieta, 1, false, HOY);
  quieta = registrar(quieta, 1, false, HOY);
  quieta = registrar(quieta, 1, false, HOY);
  assert.equal(quiereFacil(quieta, 1), true);
  assert.equal(cerrarTurno(quieta, 1, 0).pr.nivel, 1);

  assert.equal(cuentaPrimera({ ok: true, nivel: 2, vioCompleta: true }), false);
  assert.equal(cuentaPrimera({ ok: true, nivel: 1, vioCompleta: true }), true);
  assert.equal(cuentaPrimera({ ok: true, nivel: 2, ceroMal: true }), false);
  assert.equal(anulaPrimera({ nivel: 7, fallo: true }), true);
  assert.equal(fasePista({ nivel: 2, ms: 40000 }).includes("completa") || fasePista({ nivel: 2, ms: 40000 }) === "completa", true);
  assert.equal(glifoMas("tv"), "▲");
  assert.equal(glifoMas("tactil"), "+");
  const pista = textoPista({ nivel: 1, tipo: "bloques" }, "completa", textos);
  assert.match(pista, /bloques/i);
  assert.equal(marcarGuia(nuevo()).guiaHecha, true);
  assert.equal(cargar({ v: 1, unidad: "in", voz: false }).unidad, "in");
  assert.equal(NIVELES_MAX, 7);
  assert.deepEqual(ZONAS, ["bosque", "pantano", "nieve"]);
  assert.equal(U_CM, 30);
  assert.equal(U_IN, 76.2);
  assert.equal(cruzarBrilla([4, 2], 6, 2), true);
  assert.equal(cruzarBrilla([4], 6, 2), false);
});

// #74: el juego aceptaba cualquier respuesta porque «Listo» y «Cruzar» la delataban.
test("#74: un número mal en leer o comparar es un fallo, nunca un silencio", () => {
  for (const fase of ["leer", "comparar"]) {
    for (let v = 0; v <= 20; v++) {
      assert.equal(resultadoListo(v, 7, fase), v === 7 ? "bien" : "fallo", `${fase} ${v}`);
    }
  }
  assert.equal(resultadoListo(9, 7, "estimaLibre"), "bien");
  assert.equal(resultadoListo(10, 7, "estimaLibre"), "fallo");
});

test("#74: primer fallo da otra oportunidad; el segundo enseña la respuesta y nada cuenta a la primera", () => {
  assert.equal(INTENTOS, 2);
  assert.equal(trasFallo(1), "otra");
  assert.equal(trasFallo(2), "revelar");
  assert.equal(cuentaPrimera({ ok: true, nivel: 7, fallo: true }), false);
  assert.equal(cuentaPrimera({ ok: true, nivel: 6, fallo: true }), false);
});

test("#74: «Cruzar» se activa con todas las tablas puestas, no con la suma justa", () => {
  assert.equal(cruzarListo([3, 3], 2), true);
  assert.equal(cruzarListo([3], 2), false);
  assert.equal(resultadoCruzar([3], 8, 2), "incompleto");
  assert.equal(resultadoCruzar([3, 4], 8, 2), "corta");
  assert.equal(resultadoCruzar([5, 4], 8, 2), "sobra");
  assert.equal(resultadoCruzar([6, 2], 8, 2), "bien");
  assert.equal(resultadoCruzar([2, 3, 3], 8, 3), "bien");
});

test("#74: cada tabla ofrecida se usa una sola vez", () => {
  assert.equal(puedeUsar([], 0, 2), true);
  assert.equal(puedeUsar([0], 0, 2), false, "la misma tabla dos veces");
  assert.equal(puedeUsar([0], 1, 2), true);
  assert.equal(puedeUsar([0, 1], 2, 2), false, "ya están todas las piezas");
});

test("#74: el árbol se dibuja a escala y cabe en la pantalla", () => {
  for (const altoVista of [560, 640, 720, 1080]) {
    for (const pxPorCm of [18, 19.7, 24, 31.5]) {
      const u = escalaArbol({ pxPorCm, altoVista });
      assert.ok(u <= pxPorCm, "nunca más grande que la escala de la referencia");
      assert.ok(ARBOL_MAX * u <= Math.max(160, altoVista * 0.4) + 0.01, "el árbol más alto cabe");
      assert.ok(u >= 11, "un centímetro se sigue viendo");
      // 8 y 14 cm se distinguen a simple vista.
      assert.ok((14 - 8) * u >= 60);
    }
  }
});

test("#74: el juego ya no enciende Listo ni Cruzar según la respuesta", () => {
  const src = fs.readFileSync(new URL("../src/juego.js", import.meta.url), "utf8");
  assert.equal(/listoBrilla|cruzarBrilla/.test(src), false);
  assert.equal(/data-act="listo"[^>]*disabled/.test(src), false);
  assert.match(src, /data-i="\$\{i\}"/);
  for (const k of ["casiOtra", "juntaCorta", "juntaSobra", "asiEraTablas"]) assert.ok(textos[k], k);
});
