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
const { cabe, choques, formaDe, mover, ponerEn, aceptaSeis, girarAyuda, dentro } = await import("../src/casa.js");
const { abiertos, recienAbiertos, bolsaDe } = await import("../src/desbloqueo.js");
const { pistaPagar, monedasQueSirven, pistaLugar, FLECHA_MS, COMPLETA_MS } = await import("../src/pista.js");
const { guiaNueva, aplicarGuia, bolsaGuia, textoGuia, monedasDeGuia } = await import("../src/guia.js");
const {
  visitaNueva, debeCobrar, alAgregar, alPagar, alQuitar, dejarPieza, devolverPieza,
  algunoAlcanza, cerrarVisita, elegirMueble, moverPieza, tocarCuadro,
} = await import("../src/visita.js");
const { nuevo, cargar, monedaDeTienda, fechaLocal, COSTO } = await import("../src/progreso.js");
const { fraseMedida, fraseGiro, fraseFaltan, fraseToca } = await import("../src/frases.js");
const { paraVoz } = await import("../src/voz.js");
const { resolverAtras } = await import("../src/salida.js");
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
  assert.equal(textoGuia("cuadro", "tv", textos), "Muévela y OK");
  assert.equal(textoGuia("cuadro", "tactil", textos), "Toca un cuadro");
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
  assert.equal(fraseGiro(2, 3, 3, 2, textos), "2 por 3 es lo mismo que 3 por 2.");
  assert.equal(fraseGiro(6, 1, 1, 6, textos), "");
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
  g = aplicarGuia(g, { tipo: "verPrecio" }, piezas);
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
  assert.equal(g.lista, true);
  let tactil = aplicarGuia({ ...guiaNueva(), paso: "cuadro", orden: [] }, { tipo: "cuadro", modo: "tactil" }, piezas);
  assert.equal(tactil.lista, true);
  const salto = aplicarGuia(guiaNueva(), { tipo: "saltar" }, piezas);
  assert.equal(salto.lista, true);
  assert.equal(aplicarGuia(salto, { tipo: "escoger", id: "lampara" }, piezas).paso, "fin");
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
