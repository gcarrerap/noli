// Mi Casita: bolsa fija, pago exacto, cuadrícula, desbloqueos y la guía.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(dir, "..");
const leer = (rel) => JSON.parse(fs.readFileSync(path.join(raiz, rel), "utf8"));

const textos = leer("datos/textos.json");
const { muebles } = leer("datos/muebles.json");
const { cuartos } = leer("datos/cuartos.json");
const { niveles } = leer("datos/desbloqueos.json");
const bolsas = leer("datos/bolsas.json");
const juego = leer("juego.json");
const usd = JSON.parse(fs.readFileSync(path.join(raiz, "../tienda/datos/usd.json"), "utf8"));
const mxn = JSON.parse(fs.readFileSync(path.join(raiz, "../tienda/datos/mxn.json"), "utf8"));

const { pagarExacto, puedePagar, sumaBolsa, restarBolsa } = await import("../src/dinero.js");
const { cabe, choques, formaDe, mover, ponerEn, aceptaSeis, girarAyuda, dentro, tamCuadro } = await import("../src/casa.js");
const { abiertos, recienAbiertos, bolsaDe } = await import("../src/desbloqueo.js");
const { pistaPagar, monedasQueSirven, pistaLugar, FLECHA_MS, COMPLETA_MS } = await import("../src/pista.js");
const {
  guiaNueva, aplicarGuia, bolsaGuia, textoGuia, vozGuia, monedasDeGuia,
  focoDeGuia, guiaAvanzaConToque, guiaPagarActivo, okDeGuia, pausaDePaso, esperaMuestra, demoraMuestra,
  relojConSalir, esperasAlSalir, entradaTrasCierre, TRAS_DIALOGO_MS,
  GUIA_TOQUE_MS, GUIA_PAUSA_MS, GUIA_PAUSA_MAX_MS, GUIA_COMPRA_MS, PASOS,
} = await import("../src/guia.js");
const {
  visitaNueva, debeCobrar, alAgregar, alPagar, alQuitar, dejarPieza, devolverPieza,
  algunoAlcanza, cerrarVisita, elegirMueble, moverPieza, tocarCuadro, avisoDePago,
  girarPieza, abrirBarra, cerrarBarra,
} = await import("../src/visita.js");
const { nuevo, cargar, monedaDeTienda, fechaLocal, COSTO } = await import("../src/progreso.js");
const { fraseMedida, fraseGiro, fraseTrasGiro, fraseFaltan, fraseToca, fraseBrilla, textoMover } = await import("../src/frases.js");
const { paraVoz, decir } = await import("../src/voz.js");
const {
  resolverAtras, dosAtras, resolverToque, teclaConDialogo, teclaConBarra, toqueEnVelo, atrasEnPantalla, FASES_CON_GUARDIA,
} = await import("../src/salida.js");
const { piezaSvg } = await import("../src/monedas.js");

const porId = Object.fromEntries(muebles.map((m) => [m.id, m]));
const cuarto = (id) => cuartos.find((c) => c.id === id);
const idx = {
  muebles: new Map(muebles.map((m) => [m.id, m])),
  cuartos: new Map(cuartos.map((c) => [c.id, c])),
};
const lampara = porId.lampara;
const HOY = "2026-10-09";

test("el manifiesto gasta 3 y el icono es la casita lavanda", () => {
  assert.equal(juego.id, "mi-casita");
  assert.equal(juego.color, "#9b8cff");
  assert.equal(juego.creditos, "gasta");
  assert.equal(juego.costo, 3);
  assert.equal(COSTO, 3);
  assert.equal(fs.existsSync(path.join(raiz, "icono.svg")), true);
});

test("la lámpara de la guía cuesta 6 y el texto sirve en dólares y en pesos", () => {
  assert.equal(lampara.precio, 6);
  assert.equal(textos.guiaPrecio, "Cuesta 6.");
  assert.equal(textos.guiaMonedas, "Toca 5 y 1. Son 6.");
  assert.equal(textoGuia("monedas", "tactil", textos), "Toca 5 y 1. Son 6.");
  assert.equal(textoGuia("monedas", "tv", textos), "Pulsa 5 y 1. Son 6.");
  assert.equal(textoGuia("pagar", "tv", textos), "¡Brilla! Pulsa OK.");
  assert.equal(textoGuia("cuadro", "tv", textos), "Muévela y OK");
  assert.equal(textoGuia("cuadro", "tactil", textos), "Toca un cuadro");
  assert.equal(fraseBrilla("tv", textos), "¡Brilla! Pulsa OK.");
  assert.equal(fraseBrilla("tactil", textos, true), "Brilla. Toca Pagar.");
  for (const id of ["usd", "mxn"]) {
    const piezas = id === "usd" ? usd.piezas : mxn.piezas;
    const bolsa = bolsaGuia(id);
    const sol = pagarExacto(6, bolsa, piezas);
    assert.ok(sol);
    assert.equal(fraseToca(sol, piezas, textos).texto, "Toca 5 y 1. Son 6.");
  }
});

test("cada precio abierto se paga exacto con la bolsa fija de ese nivel", () => {
  for (const moneda of [usd, mxn]) {
    for (const nivel of [1, 2, 3]) {
      const bolsa = bolsaDe(nivel, moneda.id, bolsas);
      const otra = bolsaDe(nivel, moneda.id, bolsas);
      assert.deepEqual(bolsa, otra, "la bolsa no cambia entre visitas");
      const ab = abiertos(nivel === 1 ? 1 : nivel === 2 ? 5 : 9, niveles);
      assert.equal(ab.dinero, nivel);
      const lista = ab.muebles.map((id) => porId[id]);
      assert.ok(lista.length >= 3);
      for (const m of lista) {
        const sol = pagarExacto(m.precio, bolsa, moneda.piezas);
        assert.ok(sol, `${moneda.id} nivel ${nivel} no paga ${m.id} (${m.precio})`);
        let suma = 0;
        for (const [pid, n] of Object.entries(sol)) {
          assert.ok((bolsa[pid] || 0) >= n);
          suma += moneda.piezas.find((p) => p.id === pid).valor * n;
        }
        assert.equal(suma, m.precio);
      }
      const total = sumaBolsa(bolsa, moneda.piezas);
      const baratos = [...lista].sort((a, b) => a.precio - b.precio).slice(0, 3);
      const tres = baratos.reduce((s, m) => s + m.precio, 0);
      assert.ok(total >= tres, `${moneda.id} nivel ${nivel}: la bolsa ${total} no alcanza 3 muebles (${tres})`);
      assert.ok(total < lista.reduce((s, m) => s + m.precio, 0), "no alcanza para comprar todo de una vez");
    }
  }
});

test("no se arrastran monedas de una visita a la otra", () => {
  const bolsa = bolsaDe(1, "usd", bolsas);
  const queda = restarBolsa(bolsa, { nickel: 2, penny: 1 });
  assert.notDeepEqual(queda, bolsa);
  assert.deepEqual(bolsaDe(1, "usd", bolsas), bolsa);
  const pr = { ...nuevo(), visita: { dia: HOY, abierta: false, bolsa: queda } };
  assert.equal(debeCobrar(pr, HOY), true);
});

test("si sale, la visita de ese día no se vuelve a cobrar; al terminarla, sí", () => {
  let pr = { ...nuevo(), visita: visitaNueva(HOY, bolsaDe(1, "usd", bolsas), "recamara") };
  assert.equal(debeCobrar(pr, HOY), false);
  assert.equal(debeCobrar(pr, "2026-10-10"), true);
  pr = cerrarVisita(pr);
  assert.equal(pr.visitas, 1);
  assert.equal(pr.visita.abierta, false);
  assert.equal(debeCobrar(pr, HOY), true);
  assert.equal(cerrarVisita(pr).visitas, 1);
});

test("pagar de más no cobra, y a la segunda falla se iluminan las que sirven", () => {
  const piezas = usd.piezas;
  const bolsa = bolsaDe(1, "usd", bolsas);
  let v = elegirMueble(visitaNueva(HOY, bolsa, "recamara"), "lampara");
  v = alAgregar(v, "nickel", 6, piezas);
  assert.equal(v.fallos, 0);
  v = alAgregar(v, "penny", 6, piezas);
  v = alAgregar(v, "penny", 6, piezas);
  assert.equal(v.fallos, 1, "pasarse cuenta como un intento");
  assert.equal(monedasQueSirven(6, bolsa, piezas, v.fallos), null);
  const mal = alPagar(v, 6, piezas);
  assert.equal(mal.ok, false);
  assert.equal(mal.visita.fallos, 2);
  assert.equal(mal.visita.bolsa.nickel, bolsa.nickel, "no se pierden monedas");
  const luz = monedasQueSirven(6, bolsa, piezas, mal.visita.fallos);
  assert.deepEqual(luz, { nickel: 1, penny: 1 });
  let bien = elegirMueble(visitaNueva(HOY, bolsa, "recamara"), "lampara");
  bien = alAgregar(bien, "nickel", 6, piezas);
  bien = alAgregar(bien, "penny", 6, piezas);
  const pago = alPagar(bien, 6, piezas);
  assert.equal(pago.ok, true);
  assert.equal(pago.visita.fase, "acomodar");
  assert.equal(pago.visita.bolsa.nickel, bolsa.nickel - 1);
  const devuelta = devolverPieza({ ...nuevo(), visita: pago.visita, puestos: [] });
  assert.equal(devuelta.visita.bolsa.nickel, bolsa.nickel);
  assert.equal(devuelta.visita.fase, "tienda");
});

test("Quitar saca la última moneda y no es Atrás", () => {
  const piezas = mxn.piezas;
  let v = elegirMueble(visitaNueva(HOY, bolsaGuia("mxn"), "recamara"), "lampara");
  v = alAgregar(v, "p5", 6, piezas);
  v = alAgregar(v, "p1", 6, piezas);
  v = alQuitar(v);
  assert.deepEqual(v.orden, ["p5"]);
  assert.equal(alQuitar(alQuitar(v)).orden.length, 0);
});

test("la cuadrícula no deja salir ni encimar, y girar cambia el largo", () => {
  const rec = cuarto("recamara");
  assert.equal(dentro(rec, 0, 0, 2, 3), true);
  assert.equal(dentro(rec, 5, 0, 2, 3), false);
  assert.equal(cabe(rec, [], 5, 0, 2, 3), false);
  const cama = formaDe(porId.cama, 0);
  assert.deepEqual([cama.w, cama.h], [2, 3]);
  const girada = formaDe(porId.cama, 1);
  assert.deepEqual([girada.w, girada.h], [3, 2]);
  const puestos = [{ id: "silla", cuarto: "recamara", x: 0, y: 0, w: 1, h: 1 }];
  assert.equal(cabe(rec, puestos, 0, 0, 1, 1), false);
  assert.equal(cabe(rec, puestos, 1, 0, 1, 1), true);
  assert.equal(choques(puestos, "recamara", 0, 0, 2, 2)[0].id, "silla");
  const mov = mover(rec, 0, 0, 1, 1, "izquierda");
  assert.deepEqual(mov, { x: 0, y: 0 });
  assert.deepEqual(mover(rec, 0, 0, 1, 1, "derecha"), { x: 1, y: 0 });
  assert.deepEqual(ponerEn(rec, 5, 5, 2, 2), { x: 4, y: 4 });
});

test("la alfombra de 6 acepta 2 por 3 y 1 por 6, sin signo de por", () => {
  const alf = porId.alfombra6;
  assert.equal(aceptaSeis(alf), true);
  assert.equal(alf.formas.some((f) => f.w === 2 && f.h === 3), true);
  assert.equal(alf.formas.some((f) => f.w === 1 && f.h === 6), true);
  const rec = cuarto("recamara");
  assert.equal(cabe(rec, [], 0, 0, 1, 6), true);
  assert.equal(cabe(rec, [], 0, 0, 6, 1), true);
  assert.equal(cabe(cuarto("cocina"), [], 0, 0, 1, 6), false);
  assert.equal(fraseMedida(2, 3, textos), "3 cuadros de largo, 2 de ancho");
  assert.equal(fraseGiro(2, 3, 3, 2, textos), "2 de largo y 3 de ancho es igual que 3 de largo y 2 de ancho.");
  assert.equal(fraseGiro(6, 1, 1, 6, textos), "");
  assert.equal(fraseTrasGiro(0, 2, 3, 3, 2, textos), "");
  assert.equal(fraseTrasGiro(1, 2, 3, 3, 2, textos), textos.mismo);
  assert.equal(fraseTrasGiro(2, 3, 2, 2, 3, textos), textos.mismo);
  const texto = JSON.stringify(textos) + fraseMedida(3, 2, textos) + textos.pedido;
  assert.equal(texto.includes("×"), false);
  assert.equal(texto.includes("Measurement"), false);
  assert.match(textos.pedido, /6 cuadros/);
});

test("Gíralo solo cuando girar hace que quepa, y el choque nombra la silla", () => {
  const rec = cuarto("recamara");
  const puestos = [{ id: "silla", cuarto: "recamara", x: 0, y: 0, w: 1, h: 1 }];
  const cama = porId.cama;
  const no = pistaLugar({ cuarto: rec, puestos, x: 0, y: 0, mueble: cama, rot: 0, textos, catalogo: porId });
  assert.equal(no.tipo, "choque");
  assert.equal(no.texto, "Ahí hay una silla");
  const pared = { ...rec, cols: 3, filas: 2 };
  assert.equal(girarAyuda(pared, [], 0, 0, cama, 0), true);
  const gira = pistaLugar({ cuarto: pared, puestos: [], x: 0, y: 0, mueble: cama, rot: 0, textos, catalogo: porId });
  assert.equal(gira.texto, "Gíralo");
  const cabeYa = pistaLugar({ cuarto: rec, puestos: [], x: 0, y: 0, mueble: cama, rot: 0, textos, catalogo: porId });
  assert.equal(cabeYa.tipo, "ok");
  assert.notEqual(cabeYa.texto, "Gíralo");
});

test("las pistas de pagar: paso completo al inicio, y después la escalera", () => {
  const piezas = usd.piezas;
  const bolsa = bolsaDe(1, "usd", bolsas);
  const n1 = pistaPagar({ nivelDinero: 1, precio: 6, bolsa, piezas, textos, errores: 0, ms: 0 });
  assert.equal(n1.texto, "Toca 5 y 1. Son 6.");
  const bolsa2 = bolsaDe(2, "usd", bolsas);
  const pronto = pistaPagar({ nivelDinero: 2, precio: 30, bolsa: bolsa2, piezas, textos, errores: 0, ms: 0 });
  assert.equal(pronto.texto, textos.empiezaGrande);
  assert.equal(pronto.flecha, null);
  const flecha = pistaPagar({ nivelDinero: 2, precio: 30, bolsa: bolsa2, piezas, textos, errores: 0, ms: FLECHA_MS });
  assert.equal(flecha.flecha, "dime");
  const tarde = pistaPagar({ nivelDinero: 2, precio: 30, bolsa: bolsa2, piezas, textos, errores: 0, ms: COMPLETA_MS });
  assert.match(tarde.texto, /^Toca /);
  const error = pistaPagar({ nivelDinero: 2, precio: 30, bolsa: bolsa2, piezas, textos, errores: 1, ms: 0 });
  assert.match(error.texto, /^Toca /);
});

test("la guía solo avanza cuando ella hace el paso", () => {
  const piezas = usd.piezas;
  let g = guiaNueva();
  g = aplicarGuia(g, { tipo: "escoger", id: "silla" }, piezas);
  assert.equal(g.paso, "escoger");
  g = aplicarGuia(g, { tipo: "escoger", id: "lampara" }, piezas);
  assert.equal(g.paso, "precio");
  g = aplicarGuia(g, { tipo: "monedas", orden: ["nickel", "penny"] }, piezas);
  assert.equal(g.paso, "precio");
  g = aplicarGuia(g, { tipo: "toque" }, piezas);
  assert.equal(g.paso, "monedas");
  g = aplicarGuia(g, { tipo: "monedas", orden: ["dime"] }, piezas);
  assert.equal(g.paso, "monedas");
  assert.equal(monedasDeGuia(g.orden, piezas), false);
  g = aplicarGuia(g, { tipo: "monedas", orden: ["nickel", "penny"] }, piezas);
  assert.equal(g.paso, "pagar");
  g = aplicarGuia(g, { tipo: "ok", modo: "tv" }, piezas);
  assert.equal(g.paso, "pagar");
  g = aplicarGuia(g, { tipo: "pagar" }, piezas);
  assert.equal(g.paso, "cuadro");
  g = aplicarGuia(g, { tipo: "ok", modo: "tv" }, piezas);
  assert.equal(g.paso, "cuadro", "en la TV, OK sin mover no cuenta");
  g = aplicarGuia(g, { tipo: "cuadro", modo: "tv" }, piezas);
  assert.equal(g.paso, "cuadro");
  g = aplicarGuia(g, { tipo: "mover" }, piezas);
  g = aplicarGuia(g, { tipo: "ok", modo: "tv" }, piezas);
  assert.equal(g.paso, "fin");
  assert.equal(g.lista, false);
  g = aplicarGuia(g, { tipo: "toque" }, piezas);
  assert.equal(g.lista, true);
  const tactil = aplicarGuia({ ...guiaNueva(), paso: "cuadro", orden: [], movio: false, lista: false }, { tipo: "cuadro", modo: "tactil" }, piezas);
  assert.equal(tactil.paso, "fin");
  assert.equal(tactil.lista, false);
  const salto = aplicarGuia(guiaNueva(), { tipo: "saltar" }, piezas);
  assert.equal(salto.lista, true);
  assert.equal(aplicarGuia(salto, { tipo: "escoger", id: "lampara" }, piezas).paso, "fin");
});

test("la guía: mostrar, acción, Pagar, foco, Atrás y el modo", () => {
  const piezas = usd.piezas;
  assert.equal(GUIA_TOQUE_MS, 2000);
  assert.equal(guiaAvanzaConToque("precio"), true);
  assert.equal(guiaAvanzaConToque("fin"), true);
  for (const paso of ["escoger", "monedas", "pagar", "cuadro"]) assert.equal(guiaAvanzaConToque(paso), false, paso);
  for (const paso of ["escoger", "precio", "monedas", "cuadro", "fin"]) assert.equal(guiaPagarActivo(paso), false, paso);
  assert.equal(guiaPagarActivo("pagar"), true);

  let g = guiaNueva();
  for (let i = 0; i < 5; i++) {
    g = aplicarGuia(g, { tipo: "ok" }, piezas);
    g = aplicarGuia(g, { tipo: "toque" }, piezas);
    g = aplicarGuia(g, { tipo: "tiempo" }, piezas);
    g = aplicarGuia(g, { tipo: "pagar" }, piezas);
  }
  assert.equal(g.paso, "escoger", "OK repetido no salta el paso de escoger");

  g = aplicarGuia(g, { tipo: "escoger", id: "lampara" }, piezas);
  assert.equal(aplicarGuia(g, { tipo: "ok" }, piezas).paso, "monedas");
  assert.equal(aplicarGuia(g, { tipo: "tiempo" }, piezas).paso, "monedas");
  const monedas = aplicarGuia(g, { tipo: "toque" }, piezas);
  assert.equal(aplicarGuia(monedas, { tipo: "ok" }, piezas).paso, "monedas");
  assert.equal(aplicarGuia(monedas, { tipo: "pagar" }, piezas).paso, "monedas");
  assert.equal(aplicarGuia(monedas, { tipo: "toque" }, piezas).paso, "monedas");

  for (const paso of PASOS) {
    assert.notEqual(focoDeGuia(paso, [], piezas), "saltar");
    assert.notEqual(focoDeGuia(paso, ["nickel"], piezas), "saltar");
  }
  assert.equal(focoDeGuia("escoger", [], piezas), "mueble-lampara");
  assert.equal(focoDeGuia("precio", [], piezas), "precio");
  assert.equal(focoDeGuia("monedas", [], piezas), "moneda-cinco");
  assert.equal(focoDeGuia("monedas", ["nickel"], piezas), "moneda-uno");
  assert.equal(focoDeGuia("pagar", ["nickel", "penny"], piezas), "pagar");
  assert.equal(focoDeGuia("fin", [], piezas), "fin-guia");

  let cuadro = { paso: "cuadro", orden: [], movio: false, lista: false };
  cuadro = aplicarGuia(cuadro, { tipo: "ok", modo: "tactil" }, piezas);
  assert.equal(cuadro.paso, "cuadro");
  cuadro = aplicarGuia(cuadro, { tipo: "ok", modo: "tv" }, piezas);
  assert.equal(cuadro.paso, "cuadro");

  const tv = PASOS.map((paso) => `${textoGuia(paso, "tv", textos)} ${vozGuia(paso, "tv", textos)}`).join(" ");
  assert.equal(/Toca/.test(tv), false);
  const voces = PASOS.flatMap((paso) => [vozGuia(paso, "tv", textos), vozGuia(paso, "tactil", textos)]).join(" ");
  assert.equal(paraVoz(voces), voces);
  assert.equal(fraseToca({ nickel: 1 }, piezas, textos, "tv").texto, "Pulsa 5. Son 5.");
  assert.equal(fraseToca({ nickel: 1 }, piezas, textos, "tv").voz, "Pulsa 5. Son 5.");

  const atras = dosAtras();
  assert.deepEqual([atras.primero, atras.segundo], ["abrir", "cerrar"]);
  assert.equal(atras.sale, false);
  assert.equal(atras.cobra, false);
  assert.equal(resolverAtras(false), "abrir");
  assert.equal(resolverAtras(true), "cerrar");

  for (const fase of FASES_CON_GUARDIA) {
    assert.equal(resolverToque("seguir", fase), "seguir", fase);
    assert.equal(resolverToque("salir", fase), "salir", fase);
  }
  assert.equal(resolverToque("pagar", "cobrando"), "nada");
  assert.equal(resolverToque("dejar", "cobrando"), "nada");
  assert.equal(resolverToque("dejar", "acomodar"), "juego");
  assert.equal(resolverToque("inicio", "fin"), "juego");

  for (const act of ["escoger", "moneda", "pagar", "dejar", "celda", "saltar", "mover"]) {
    for (const fase of ["pagar", "acomodar", "fin", "guia", "cobrando"]) {
      assert.equal(resolverToque(act, fase, true), "nada", act + " " + fase);
    }
  }
  assert.equal(teclaConDialogo("ok", "pagar"), "nada");
  assert.equal(teclaConDialogo("ok", "dejar"), "nada");
  assert.equal(teclaConDialogo("ok", "saltar"), "nada");
  assert.equal(teclaConDialogo("ok", "seguir"), "seguir");
  assert.equal(teclaConDialogo("ok", "salir"), "salir");
  assert.equal(teclaConDialogo("atras", "dejar"), "cerrar");
  assert.equal(teclaConDialogo("arriba", "seguir"), "foco");

  for (const pantalla of ["fin", "resultado", "guia-fin", "pagar", "acomodar"]) {
    assert.equal(atrasEnPantalla(pantalla, false), "abrir", pantalla);
    assert.equal(atrasEnPantalla(pantalla, true), "cerrar", pantalla);
  }

  const sucia = elegirMueble({
    ...visitaNueva(HOY, { penny: 1 }, "recamara"),
    corto: true,
    orden: ["penny"],
    fallos: 2,
  }, "silla");
  assert.equal(sucia.corto, false);
  assert.deepEqual(sucia.orden, []);
  assert.equal(sucia.fallos, 0);
  assert.equal(avisoDePago({ suma: 8, precio: 6, corto: true }), "pasaste");
  assert.equal(avisoDePago({ empezar: true, suma: 8, precio: 6, corto: true }), "");
  assert.equal(avisoDePago({ suma: 0, precio: 6, corto: sucia.corto }), "");

  const css = fs.readFileSync(path.join(raiz, "estilo.css"), "utf8");
  assert.match(css, /\.cab \.saltar\s*\{[^}]*min-height:\s*64px/);
  assert.match(css, /\.cab \.boton\s*\{[^}]*min-height:\s*64px/);
  assert.match(css, /html\[data-modo="tv"\] \.boton\.grande\s*\{[^}]*min-height:\s*64px/);
  assert.match(css, /button:disabled/);
  assert.match(css, /\.rejilla\s*\{[^}]*--cuadro:\s*44px/);
  assert.match(css, /html\[data-modo="tv"\] \.rejilla\s*\{\s*--cuadro:\s*48px/);
  assert.match(css, /min\(62px,\s*calc\(\(100cqi - 6px\) \/ 6\)\)/);
  assert.equal(tamCuadro(360), 44);
  assert.equal(tamCuadro(399), 44);
  assert.equal(tamCuadro(412), 62);
  assert.ok(6 * tamCuadro(412) + 6 + 24 <= 412);
  assert.ok(tamCuadro(412) > tamCuadro(360));

  assert.equal(GUIA_PAUSA_MS, 1000);
  assert.equal(GUIA_PAUSA_MAX_MS, 3000);
  assert.equal(GUIA_COMPRA_MS, 1000);
  assert.equal(pausaDePaso(0), 1000);
  assert.equal(pausaDePaso(400), 1000);
  assert.equal(pausaDePaso(2000), 2000);
  assert.equal(pausaDePaso(9000), 3000);
  for (const paso of ["escoger", "monedas", "pagar", "cuadro", "precio", "fin"]) {
    assert.equal(okDeGuia({ paso, focoId: focoDeGuia(paso, [], piezas), pausa: true }), "nada", paso);
  }
  assert.equal(okDeGuia({ paso: "escoger", focoId: "mueble-lampara" }), "escoger");
  assert.equal(okDeGuia({ paso: "escoger", focoId: "saltar" }), "nada");
  assert.equal(okDeGuia({ paso: "monedas", focoId: "moneda-cinco" }), "moneda");
  assert.equal(okDeGuia({ paso: "monedas", focoId: focoDeGuia("monedas", ["nickel"], piezas) }), "moneda");
  assert.equal(okDeGuia({ paso: "monedas", focoId: "moneda-dime" }), "nada");
  assert.equal(okDeGuia({ paso: "pagar", focoId: "pagar" }), "pagar");
  assert.equal(okDeGuia({ paso: "pagar", focoId: "quitar" }), "nada");
  assert.equal(okDeGuia({ paso: "precio", focoId: "saltar" }), "mostrar");
  assert.equal(okDeGuia({ paso: "cuadro", focoId: "cuadro" }), "cuadro");
  assert.equal(okDeGuia({ paso: "cuadro", focoId: "saltar" }), "nada");
  let spam = guiaNueva();
  for (let i = 0; i < 8; i++) {
    assert.equal(okDeGuia({ paso: spam.paso, focoId: "saltar" }), "nada");
    spam = aplicarGuia(spam, { tipo: "ok", modo: "tv" }, piezas);
  }
  assert.equal(spam.paso, "escoger");
});

test("un paso que solo se mira espera a la voz, como mucho 3 s", () => {
  assert.equal(esperaMuestra(0), GUIA_TOQUE_MS);
  assert.equal(esperaMuestra(400), 2000);
  assert.equal(esperaMuestra(2000), 2000);
  assert.equal(esperaMuestra(2600), 2600);
  assert.equal(esperaMuestra(9000), GUIA_PAUSA_MAX_MS);
  assert.equal(esperaMuestra(Number.NaN), 2000);
  assert.equal(pausaDePaso(2600), 2600);
  assert.equal(pausaDePaso(0), GUIA_PAUSA_MS);
});

function motorVoz(parcial) {
  const s = {
    speaking: false,
    pending: false,
    cancel() { this.speaking = false; this.pending = false; },
    getVoices() { return [{ lang: "es-MX" }]; },
    speak() {},
    ...parcial,
  };
  function Utterance(texto) { this.text = texto; }
  return { sintesis: s, Utterance };
}

test("si la voz falla, no hay voces o no empieza, el paso espera 2 s", () => {
  assert.equal(demoraMuestra("ok", 100), 2000);
  assert.equal(demoraMuestra("ok", 2600), 2600);
  assert.equal(demoraMuestra("ok", 9000), 3000);
  assert.equal(demoraMuestra("hablando", 0), 3000);
  assert.equal(demoraMuestra("falla", 30), 2000);
  const seguir = esperasAlSalir({ seguir: true, msVoz: 0 });
  assert.equal(seguir.muestra, demoraMuestra("falla", 40));

  const oir = (opciones) => {
    let estado = "";
    decir("Cuesta 6.", "es-MX", () => { estado = "ok"; }, {
      ...opciones,
      alFallar: () => { estado = "falla"; },
    });
    return estado;
  };

  const error = motorVoz({
    speak(u) { u.onerror({ error: "not-allowed" }); },
  });
  assert.equal(oir(error), "falla");
  assert.equal(demoraMuestra("falla", 0), 2000);

  let hablo = false;
  const vacio = motorVoz({
    getVoices() { return []; },
    speak() { hablo = true; },
  });
  assert.equal(oir(vacio), "falla");
  assert.equal(hablo, false);

  const mudo = motorVoz({
    speak() { /* no llama a onend ni a onerror */ },
  });
  assert.equal(oir(mudo), "falla");
  assert.equal(mudo.sintesis.speaking, false);

  const larga = motorVoz({
    speak(u) {
      this.speaking = true;
      u.onstart();
      u.onend();
    },
  });
  assert.equal(oir(larga), "ok");
});

test("«¿Salir?» pausa la guía y Seguir la empieza otra vez", () => {
  assert.equal(TRAS_DIALOGO_MS, 400);
  assert.equal(relojConSalir(true), "pausa");
  assert.equal(relojConSalir(false, true), "reinicio");
  assert.equal(relojConSalir(false), "sigue");
  const antes = esperasAlSalir({ msVoz: 2600 });
  const abierto = esperasAlSalir({ abierto: true, msVoz: 2600 });
  const seguir = esperasAlSalir({ seguir: true, msVoz: 2600 });
  assert.equal(abierto.muestra, null);
  assert.equal(abierto.pausa, null);
  assert.equal(seguir.muestra, antes.muestra);
  assert.equal(seguir.muestra, 2600);
  assert.equal(seguir.pausa, antes.pausa);
  assert.equal(seguir.pausa, 2600);
  assert.equal(seguir.ignoraMs, 400);
  assert.equal(esperasAlSalir({ seguir: true, msVoz: 0 }).muestra, 2000);
  assert.equal(esperasAlSalir({ seguir: true, msVoz: 9000 }).muestra, 3000);
  assert.equal(entradaTrasCierre(0, "toque"), "ignora");
  assert.equal(entradaTrasCierre(399, "ok"), "ignora");
  assert.equal(entradaTrasCierre(400, "toque"), "sigue");
  assert.equal(entradaTrasCierre(400, "ok"), "sigue");
  assert.equal(entradaTrasCierre(0, "atras"), "sigue");
  assert.equal(entradaTrasCierre(Number.NaN, "ok"), "ignora");
  assert.equal(toqueEnVelo({ modo: "tactil", enDialogo: false }), "seguir");
  assert.equal(toqueEnVelo({ modo: "tactil", enDialogo: true }), "nada");
  assert.equal(toqueEnVelo({ modo: "tv", enDialogo: false }), "nada");
});

test("girar solo cambia largo y ancho, y el área no cambia", () => {
  for (const m of muebles) {
    const a0 = formaDe(m, 0);
    const a1 = formaDe(m, 1);
    const a2 = formaDe(m, 2);
    assert.deepEqual([a1.w, a1.h], [a0.h, a0.w], m.id);
    assert.deepEqual([a2.w, a2.h], [a0.w, a0.h], m.id);
    assert.equal(a1.w * a1.h, a0.w * a0.h, m.id);
    assert.equal(a2.w * a2.h, a0.w * a0.h, m.id);
  }
  const alf = porId.alfombra6;
  assert.deepEqual([formaDe(alf, 0).w, formaDe(alf, 0).h], [2, 3]);
  assert.deepEqual([formaDe(alf, 1).w, formaDe(alf, 1).h], [3, 2]);
  assert.equal(formaDe(alf, 1).archivo, "alfombra-3-2.svg");
  assert.notDeepEqual([formaDe(alf, 1).w, formaDe(alf, 1).h], [6, 1]);
});

test("la flecha mueve el foco en la barra solo si hay botón; si no, mueve el mueble", () => {
  let v = abrirBarra({ ...visitaNueva(HOY, { penny: 1 }, "recamara"), x: 1, y: 1, rot: 0, mueble: "alfombra6" });
  assert.equal(v.barra, true);
  assert.equal(teclaConBarra("derecha", true), "foco");
  assert.equal(teclaConBarra("izquierda", true), "foco");
  assert.equal(teclaConBarra("arriba", false), "mover");
  assert.equal(teclaConBarra("derecha", false), "mover");
  assert.equal(teclaConBarra("abajo", false), "mover");
  assert.equal(teclaConBarra("izquierda", false), "mover");
  assert.equal(teclaConBarra("atras"), "cerrar");
  assert.equal(teclaConBarra("girar"), "girar");
  assert.equal(teclaConBarra("ok"), "juego");
  v = moverPieza(cerrarBarra(v), cuarto("recamara"), "abajo", porId.alfombra6);
  assert.equal(v.barra, false);
  assert.equal(v.y, 2);
  v = girarPieza(v);
  assert.equal(v.barra, false);
  assert.equal(v.rot, 1);
  assert.deepEqual([formaDe(porId.alfombra6, v.rot).w, formaDe(porId.alfombra6, v.rot).h], [3, 2]);
  const cerrada = cerrarBarra(abrirBarra(v));
  assert.equal(cerrada.barra, false);
  const movida = moverPieza({ ...cerrada, x: 0, y: 0 }, cuarto("recamara"), "derecha", porId.alfombra6);
  assert.equal(movida.x, 1);
  assert.equal(textoMover("tactil", false, textos), "Toca un cuadro o usa las flechas");
  assert.equal(textoMover("tv", false, textos), textos.moverTv);
  assert.equal(textoMover("tv", true, textos), "");
});

test("los desbloqueos siguen la curva y abren cuarto a cuarto", () => {
  assert.deepEqual(abiertos(0, niveles).cuartos, ["recamara"]);
  assert.ok(abiertos(0, niveles).muebles.includes("lampara"));
  assert.equal(abiertos(0, niveles).muebles.includes("cama"), false);
  assert.ok(abiertos(1, niveles).muebles.includes("cama"));
  assert.equal(abiertos(4, niveles).dinero, 2);
  assert.deepEqual(recienAbiertos(4, niveles).cuartos, ["cocina"]);
  assert.ok(abiertos(7, niveles).cuartos.includes("jardin"));
  assert.ok(abiertos(9, niveles).muebles.includes("sofa"));
  const idsCurva = niveles.flatMap((n) => n.muebles || []);
  assert.deepEqual(new Set(idsCurva).size, idsCurva.length);
  for (const id of idsCurva) assert.ok(porId[id], id);
  for (const m of muebles) assert.ok(idsCurva.includes(m.id), m.id);
  for (const n of niveles) for (const c of n.cuartos || []) assert.ok(cuartos.some((x) => x.id === c));
});

test("dejar la lámpara y seguir cuando ya no alcanza", () => {
  const rec = cuarto("recamara");
  let v = elegirMueble(visitaNueva(HOY, bolsaDe(1, "usd", bolsas), "recamara"), "lampara");
  v = alAgregar(alAgregar(v, "nickel", 6, usd.piezas), "penny", 6, usd.piezas);
  const pago = alPagar(v, 6, usd.piezas);
  let pr = { ...nuevo(), visita: pago.visita, puestos: [] };
  pr = { ...pr, visita: moverPieza(pr.visita, rec, "derecha", lampara) };
  pr = { ...pr, visita: tocarCuadro(pr.visita, rec, 2, 2, lampara) };
  const dejado = dejarPieza(pr, rec, lampara);
  assert.equal(dejado.ok, true);
  assert.equal(dejado.pr.puestos[0].id, "lampara");
  assert.equal(dejado.pr.puestos[0].x, 2);
  assert.equal(dejarPieza(dejado.pr, rec, lampara).ok, false);
  const lista = [porId.cama];
  assert.equal(algunoAlcanza(dejado.pr.visita.bolsa, lista, usd.piezas), true);
  const pobre = { penny: 1 };
  assert.equal(algunoAlcanza(pobre, [porId.silla, porId.lampara], usd.piezas), false);
});

test("el progreso se lee con cuidado y la moneda sigue a La Tienda", () => {
  assert.equal(nuevo().voz, true);
  assert.equal(nuevo().guia, false);
  const sucio = cargar({
    guia: true, voz: false, visitas: 2,
    puestos: [
      { id: "silla", cuarto: "recamara", x: 0, y: 0, w: 1, h: 1 },
      { id: "silla", cuarto: "recamara", x: 1, y: 0, w: 1, h: 1 },
      { id: "no-existe", cuarto: "recamara", x: 0, y: 0, w: 1, h: 1 },
      { id: "cama", cuarto: "recamara", x: 5, y: 5, w: 2, h: 3 },
    ],
    visita: { dia: HOY, abierta: true, bolsa: { penny: 3 }, fase: "pagar", mueble: "lampara", orden: ["penny"] },
  }, idx);
  assert.equal(sucio.guia, true);
  assert.equal(sucio.voz, false);
  assert.equal(sucio.puestos.length, 1);
  assert.equal(sucio.visita.abierta, true);
  assert.equal(sucio.visita.bolsa.penny, 3);
  assert.equal(monedaDeTienda(() => null), "usd");
  assert.equal(monedaDeTienda((k) => (k === "noli.datos.tienda" ? JSON.stringify({ moneda: "mxn", voz: true }) : null)), "mxn");
  assert.equal(fechaLocal(new Date(2026, 9, 9)), HOY);
  assert.match(fraseFaltan(2, textos), /Te faltan 2 créditos/);
  assert.equal(fraseFaltan(1, textos), "Te falta 1 crédito");
});

test("Atrás abre ¿Salir? y el segundo lo cierra; la voz no dice símbolos", () => {
  assert.equal(resolverAtras(false), "abrir");
  assert.equal(resolverAtras(true), "cerrar");
  assert.equal(paraVoz("▲ mueve + el mueble"), "mueve el mueble");
  assert.equal(paraVoz(textos.vozMonedas), textos.vozMonedas);
  assert.equal(/[▲+×]/.test(paraVoz(textos.moverTv + textos.moverTactil)), false);
});

test("el dibujo de la moneda es el de La Tienda y no es la estrella del crédito", () => {
  const penny = usd.piezas.find((p) => p.id === "penny");
  const svg = piezaSvg(penny);
  assert.match(svg, /<svg/);
  assert.match(svg, /1¢/);
  assert.equal(svg.includes("★"), false);
  const peso = piezaSvg(mxn.piezas.find((p) => p.id === "p1"));
  assert.match(peso, /\$1/);
  assert.notEqual(svg, peso);
});

test("no hay emoji en los textos ni en el código del juego", () => {
  const archivos = ["datos", "src"].flatMap((carp) => fs.readdirSync(path.join(raiz, carp)).map((f) => path.join(raiz, carp, f)));
  archivos.push(path.join(raiz, "index.html"));
  const emoji = /\p{Extended_Pictographic}/u;
  for (const f of archivos) {
    if (!fs.existsSync(f) || !/\.(js|json|html|css)$/.test(f)) continue;
    assert.equal(emoji.test(fs.readFileSync(f, "utf8")), false, f);
  }
});
