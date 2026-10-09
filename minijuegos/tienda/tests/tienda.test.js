// Pruebas de La Tienda: las dos monedas, el cambio, las opciones, el reto del día y la racha.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { revisarDatos, indexar } from "../src/datos.js";
import { formar, sumaConteo, sumarLista, texto, textoLargo, opcionesCobro, opcionesSuma, describir } from "../src/dinero.js";
import { rngConSemilla } from "../src/rng.js";
import { generarVisita, armarDia, armarMonton } from "../src/visita.js";
import { nuevo, cargar, registrar, dominio, cerrarDia, estrellasDia, cumplirReto, racha, semana, comprar, estado, VENTANA, PARA_SUBIR } from "../src/progreso.js";
import { retoDelDia, cumplioReto } from "../src/reto.js";
import { piezaSvg, clienteSvg, productoSvg, tiendaSvg } from "../src/dibujos.js";

const leer = (f) => JSON.parse(fs.readFileSync(new URL("../datos/" + f, import.meta.url), "utf8"));
const config = leer("config.json");
const monedas = {};
for (const id of config.monedas) monedas[id] = leer(id + ".json");
const crudo = { config, monedas, productos: leer("productos.json"), clientes: leer("clientes.json"), retos: leer("retos.json") };
const datos = indexar(crudo);
const usd = datos.monedas.usd;
const mxn = datos.monedas.mxn;
const HOY = "2026-10-09";
const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

function visitas(moneda, n, semilla, cuantas = 40) {
  const rnd = rngConSemilla(semilla);
  return Array.from({ length: cuantas }, () => generarVisita(moneda, n, datos.productos, datos.clientes, rnd));
}

test("los datos de la tienda están completos y la moneda inicial es el dólar", () => {
  assert.deepEqual(revisarDatos(crudo), []);
  assert.equal(config.monedaInicial, "usd");
  assert.deepEqual(config.monedas, ["usd", "mxn"]);
  assert.equal(nuevo().moneda, "usd");
  assert.deepEqual(usd.niveles.map((n) => n.modo), mxn.niveles.map((n) => n.modo));
  assert.deepEqual(usd.niveles.map((n) => n.modo), ["contar", "contar", "contar", "cambio", "dos", "cambio", "alcanza"]);
});

test("dólares: centavo, níquel, dime, quarter y billetes de 1, 5, 10, 20 y 100", () => {
  assert.deepEqual(usd.piezas.map((p) => p.valor), [1, 5, 10, 25, 100, 500, 1000, 2000, 10000]);
  assert.deepEqual(usd.piezas.filter((p) => p.tipo === "moneda").map((p) => p.nombreEn), ["penny", "nickel", "dime", "quarter"]);
  assert.equal(texto(usd, 1), "1¢");
  assert.equal(texto(usd, 25), "25¢");
  assert.equal(texto(usd, 100), "$1");
  assert.equal(texto(usd, 125), "$1.25");
  assert.equal(texto(usd, 2000), "$20");
  assert.equal(textoLargo(usd, 1), "1 centavo");
  assert.equal(textoLargo(usd, 125), "1 dólar y 25 centavos");
  assert.equal(textoLargo(usd, 200), "2 dólares");
});

test("pesos: monedas de 1, 2, 5 y 10 y billetes de 20, 50 y 100", () => {
  assert.deepEqual(mxn.piezas.map((p) => p.valor), [1, 2, 5, 10, 20, 50, 100]);
  assert.deepEqual(mxn.piezas.filter((p) => p.tipo === "moneda").map((p) => p.valor), [1, 2, 5, 10]);
  assert.deepEqual(mxn.piezas.filter((p) => p.tipo === "billete").map((p) => p.valor), [20, 50, 100]);
  assert.equal(texto(mxn, 1), "$1");
  assert.equal(texto(mxn, 20), "$20");
  assert.equal(textoLargo(mxn, 1), "1 peso");
  assert.equal(textoLargo(mxn, 20), "20 pesos");
});

test("el cambio correcto siempre se puede formar con la caja, en dólares y en pesos", () => {
  for (const moneda of [usd, mxn]) {
    for (let c = 0; c <= moneda.cambioMax; c++) {
      const f = formar(c, moneda.piezas, moneda.caja);
      assert.ok(f, `${moneda.id} no forma ${c}`);
      assert.equal(sumaConteo(f, moneda.piezas), c);
    }
  }
});

test("cada visita cobra bien y, si hay cambio, la caja lo arma", () => {
  for (const moneda of [usd, mxn]) for (const nivel of moneda.niveles) {
    for (const v of visitas(moneda, nivel.n, moneda.id + nivel.n, 25)) {
      assert.ok(v, `${moneda.id} nivel ${nivel.n}`);
      assert.equal(v.modo, nivel.modo);
      assert.equal(sumarLista(v.pago), v.pagoTotal);
      assert.equal(v.productos.reduce((s, p) => s + p.precio, 0), v.total);
      if (v.modo === "alcanza") {
        assert.equal(v.cambio, 0);
        assert.equal(v.alcanza, v.pagoTotal >= v.total);
      } else {
        assert.equal(v.pagoTotal - v.total, v.cambio);
        assert.ok(v.cambio >= 0);
      }
      if (v.cambio > 0) {
        const f = formar(v.cambio, moneda.piezas, moneda.caja);
        assert.ok(f, `${moneda.id} nivel ${nivel.n} cambio ${v.cambio}`);
        assert.equal(sumaConteo(f, moneda.piezas), v.cambio);
      }
      if (v.opciones) {
        const min = v.modo === "alcanza" ? 2 : 3;
        assert.ok(v.opciones.length >= min && v.opciones.length <= 4, `${moneda.id} ${nivel.n} ${v.opciones.length}`);
        assert.equal(new Set(v.opciones.map((o) => o.texto || o.valor)).size, v.opciones.length);
        assert.equal(v.opciones.filter((o) => o.correcta).length, 1);
      }
      if (v.modo === "contar") {
        assert.equal(v.opciones.find((o) => o.correcta).valor, v.pagoTotal);
        assert.ok(v.pagoTotal >= nivel.min && v.pagoTotal <= nivel.max, `${moneda.id} ${v.pagoTotal}`);
      }
      if (v.modo === "alcanza") assert.equal(v.pagoTotal >= v.total, v.alcanza);
      if (v.modo === "dos") {
        assert.ok(v.cambio > 0 && v.pasos.includes("suma") && v.pasos.includes("cambio"));
        assert.equal(v.opciones.find((o) => o.correcta).valor, v.total);
      }
    }
  }
});

test("opciones de cobro: distintas, una correcta, con el error de contar 25 como 10", () => {
  const quarter = usd.piezas.find((p) => p.id === "quarter");
  const dime = usd.piezas.find((p) => p.id === "dime");
  const rnd = rngConSemilla(3);
  for (let i = 0; i < 20; i++) {
    const ops = opcionesCobro([quarter, dime], usd, rnd);
    assert.equal(ops.length, 4);
    assert.equal(new Set(ops.map((o) => o.valor)).size, 4);
    assert.equal(ops.filter((o) => o.correcta).length, 1);
    assert.equal(ops.find((o) => o.correcta).valor, 35);
    assert.ok(ops.some((o) => o.valor === 20), "contar el quarter como dime");
  }
  const bill = mxn.piezas.find((p) => p.valor === 50);
  const ops = opcionesCobro([bill, mxn.piezas[0]], mxn, rngConSemilla(4));
  assert.equal(ops.find((o) => o.correcta).valor, 51);
  assert.ok(ops.some((o) => o.valor === 21), "contar 50 como 20");
});

test("opciones de suma: una es la correcta y no se repiten", () => {
  const rnd = rngConSemilla(5);
  for (let i = 0; i < 30; i++) {
    const ops = opcionesSuma(3, 5, rnd);
    assert.equal(new Set(ops.map((o) => o.valor)).size, ops.length);
    assert.equal(ops.filter((o) => o.correcta).length, 1);
    assert.equal(ops.find((o) => o.correcta).valor, 8);
  }
});

test("los clientes de monedas chicas y los de billete salen cuando se piden", () => {
  const chicas = visitas(usd, 1, "chicas").map((_, i) => generarVisita(usd, 1, datos.productos, datos.clientes, rngConSemilla("c" + i), "chicas"));
  assert.ok(chicas.every((v) => v.pago.every((p) => p.id === "penny") && v.pago.length >= 6));
  const con = Array.from({ length: 15 }, (_, i) => generarVisita(mxn, 3, datos.productos, datos.clientes, rngConSemilla("b" + i), "conBillete"));
  assert.ok(con.every((v) => v.pago.some((p) => p.tipo === "billete") && v.pagoTotal <= 100));
  assert.ok(describir(chicas[0].pago).includes("monedas de 1"));
});

test("una moneda nueva, definida solo en datos, también se puede contar y dar cambio", () => {
  const euro = {
    id: "eur", simbolo: "€", simboloMenor: "c", decimales: 2, menorPorMayor: 100,
    mayor: { uno: "euro", muchos: "euros" }, menor: { uno: "céntimo", muchos: "céntimos" },
    cambioMax: 19,
    piezas: [
      { id: "c1", valor: 1, tipo: "moneda", nombre: "moneda de 1", plural: "monedas de 1", etiqueta: "1", color: "#ccc", borde: "#333", tinta: "#111", tam: 1 },
      { id: "c2", valor: 2, tipo: "moneda", nombre: "moneda de 2", plural: "monedas de 2", etiqueta: "2", color: "#ddd", borde: "#333", tinta: "#111", tam: 1 },
      { id: "b10", valor: 10, tipo: "billete", nombre: "billete de 10", plural: "billetes de 10", etiqueta: "10", color: "#ace", borde: "#246", tinta: "#123", tam: 1, banda: "EURO" },
    ],
    caja: { c1: 1, c2: 4, b10: 1 },
    confusiones: [{ de: 2, como: 1, motivo: "La de 2 vale 2, no 1." }],
    niveles: [
      { n: 1, nombre: "Contar", modo: "contar", piezas: ["c1", "c2"], min: 3, max: 12, minPiezas: 2, maxPiezas: 6 },
      { n: 4, nombre: "Cambio", modo: "cambio", billetes: ["b10"], billeteMax: 10, precioMin: 1 },
    ],
  };
  for (let c = 0; c <= 9; c++) assert.equal(sumaConteo(formar(c, euro.piezas, euro.caja), euro.piezas), c);
  const rnd = rngConSemilla(9);
  for (let i = 0; i < 15; i++) {
    const v = generarVisita(euro, 1, datos.productos, datos.clientes, rnd);
    assert.equal(v.opciones.filter((o) => o.correcta).length, 1);
    assert.equal(v.opciones.find((o) => o.correcta).valor, v.pagoTotal);
  }
  for (const v of Array.from({ length: 10 }, () => generarVisita(euro, 4, datos.productos, datos.clientes, rnd))) {
    assert.equal(v.cambio, 10 - v.total);
    assert.equal(sumaConteo(formar(v.cambio, euro.piezas, euro.caja), euro.piezas), v.cambio);
  }
});

test("sube con 8 de los últimos 10 y los errores regresan", () => {
  let pr = nuevo();
  const visita = generarVisita(usd, 1, datos.productos, datos.clientes, rngConSemilla(1));
  for (let i = 0; i < 10; i++) pr = registrar(pr, "usd", 1, i < 8, visita, HOY);
  assert.equal(dominio(estado(pr, "usd"), 1).listo, true);
  let pr2 = nuevo();
  for (let i = 0; i < 10; i++) pr2 = registrar(pr2, "usd", 1, i < 7, visita, HOY);
  assert.equal(dominio(estado(pr2, "usd"), 1).listo, false);
  assert.equal(VENTANA, 10);
  assert.equal(PARA_SUBIR, 8);
  const cerrado = cerrarDia(pr, "usd", 1, 8, HOY);
  assert.equal(cerrado.subio, 2);
  assert.equal(cerrado.estrellas, 3);
  assert.equal(cerrado.pr.tienda.monedas, 8);
  assert.equal(estrellasDia(6), 2);
  assert.equal(estrellasDia(4), 1);
  assert.equal(estrellasDia(3), 0);
  let mal = registrar(nuevo(), "usd", 1, false, visita, HOY);
  const dia = armarDia(1, Object.values(estado(mal, "usd").fallos), usd, datos.productos, datos.clientes, rngConSemilla(2), 8);
  assert.equal(dia[0].tipo, "fallo");
  assert.equal(dia.length, 8);
  mal = registrar(mal, "usd", 1, true, visita, HOY);
  mal = registrar(mal, "usd", 1, true, visita, HOY);
  assert.equal(Object.keys(estado(mal, "usd").fallos).length, 0);
});

test("la moneda elegida se guarda con el progreso", () => {
  const pr = cargar({ ...nuevo(), moneda: "mxn", voz: true, tienda: { monedas: 3, mejoras: ["letrero"] } });
  assert.equal(pr.moneda, "mxn");
  assert.equal(pr.voz, true);
  assert.equal(pr.tienda.monedas, 3);
  assert.deepEqual(cargar(null), nuevo());
  assert.deepEqual(cargar({ v: 9 }), nuevo());
  const comprado = comprar({ ...nuevo(), tienda: { monedas: 6, mejoras: [] } }, "maceta", config.mejoras);
  assert.ok(comprado.tienda.mejoras.includes("maceta"));
  assert.equal(comprado.tienda.monedas, 0);
  assert.equal(comprar(comprado, "toldo", config.mejoras).tienda.monedas, 0);
});

test("reto del día: misma fecha, misma moneda y mismo nivel → el mismo reto; rota los tres tipos", () => {
  assert.deepEqual(retoDelDia(HOY, 3, usd, datos), retoDelDia(HOY, 3, usd, datos));
  assert.deepEqual(retoDelDia(HOY, 5, mxn, datos), retoDelDia(HOY, 5, mxn, datos));
  assert.equal(retoDelDia(HOY, 1, usd, datos).tipo, retoDelDia(HOY, 6, mxn, datos).tipo);
  const tipos = new Set([0, 1, 2].map((i) => retoDelDia(`2026-10-${String(9 + i).padStart(2, "0")}`, 4, usd, datos).tipo));
  assert.deepEqual([...tipos].sort(), ["cambioPerfecto", "horaPico", "misterioso"]);
  const m = retoDelDia(HOY, 2, mxn, datos);
  if (m.problemas) for (const p of m.problemas) {
    assert.equal(p.opciones.filter((o) => o.correcta).length, 1);
    assert.equal(new Set(p.opciones.map((o) => o.valor)).size, p.opciones.length);
    assert.equal(p.opciones.find((o) => o.correcta).valor, p.respuesta);
    assert.ok(p.texto.length > 10);
  }
  const alto = retoDelDia("2026-10-11", 6, usd, datos);
  assert.equal(alto.tipo, retoDelDia("2026-10-11", 1, usd, datos).tipo);
  if (alto.problemas) for (const p of alto.problemas) {
    assert.equal(p.opciones.filter((o) => o.correcta).length, 1);
    assert.equal(p.opciones.find((o) => o.correcta).valor, p.respuesta);
  }
  assert.equal(cumplioReto({ tipo: "horaPico", objetivo: 5 }, 5), true);
  assert.equal(cumplioReto({ tipo: "cambioPerfecto", cuantos: 8 }, 7), false);
  assert.equal(cumplioReto({ tipo: "misterioso", necesita: 3 }, 3), true);
});

test("la racha se rompe si falta un día", () => {
  let pr = nuevo();
  for (const f of ["2026-10-06", "2026-10-07", "2026-10-08"]) pr = cumplirReto(pr, f, "horaPico", 5, true);
  assert.equal(racha(pr, HOY), 3);
  pr = cumplirReto(pr, HOY, "cambioPerfecto", 4, false);
  assert.equal(racha(pr, HOY), 3);
  pr = cumplirReto(pr, HOY, "cambioPerfecto", 8, true);
  assert.equal(racha(pr, HOY), 4);
  assert.equal(racha(pr, "2026-10-11"), 0);
  assert.equal(cumplirReto(pr, HOY, "horaPico", 1, false).retos[HOY].cumplido, true);
  assert.equal(semana(pr, HOY).filter((d) => d.reto).length, 4);
});

test("los dibujos son SVG, sin emojis, para monedas, billetes, clientes y la tienda", () => {
  for (const moneda of [usd, mxn]) for (const p of moneda.piezas) {
    const s = piezaSvg(p);
    assert.match(s, /^<svg/);
    assert.equal(emoji.test(s), false);
    assert.match(s, new RegExp(p.etiqueta.replace("$", "\\$").replace("¢", "¢")));
  }
  for (const c of datos.clientes) for (const exp of ["feliz", "sorpresa", "pensativo"]) {
    const s = clienteSvg(c, exp);
    assert.match(s, new RegExp(`data-expresion="${exp}"`));
    assert.equal(emoji.test(s), false);
  }
  for (const p of datos.productos) assert.match(productoSvg(p), /^<svg/);
  const tienda = tiendaSvg(["letrero", "toldo", "maceta", "alfombra", "estante"]);
  assert.match(tienda, /NOLI/);
  assert.equal(emoji.test(tiendaSvg([])), false);
  const monton = armarMonton(usd.piezas.filter((p) => p.tipo === "moneda"), rngConSemilla(1), { min: 10, max: 40, minPiezas: 2, maxPiezas: 5 });
  assert.ok(sumarLista(monton) >= 10 && sumarLista(monton) <= 40);
});
