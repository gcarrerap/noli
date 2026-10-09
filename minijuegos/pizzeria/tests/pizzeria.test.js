import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { rngConSemilla } from "../src/rng.js";
import { analizar, sonIguales } from "../src/area.js";
import { medir, lineasSvg, patron, opcionesCorte } from "../src/cortes.js";
import { ladosDe, opcionesForma, crearFigura, reiniciarIds } from "../src/figuras.js";
import { crearPedido, esCorrecto, POR_TURNO } from "../src/pedidos.js";
import { siguientePasoGuia, guiaTerminada, textoDeGuia, vozDeGuia, guiaAvanzaConToque, guiaServirActivo, focoDeGuia, toqueDuranteGuia, entradaGuia, entradaPedido, guiaBloqueada, siguienteAutoGuia, reanudarPasoGuia, GUIA_TOQUE_MS, GUIA_CIERRE_MS, GUIA_TOPE_MS, TRAS_GUIA_MS } from "../src/guia.js";
import { fasePista, debeBrillar, cuentaParaDominio, hablaSegura, glifoMas, glifoMenos, textoContador, vozContador, pistaVisible, textoPista, IDLE_COMPLETA_MS } from "../src/pista.js";
import { abiertos, recienAbierto, sumarPropinas, PROPINA, ADORNOS } from "../src/deco.js";
import { ajustar, celdas, cuentaFilas, totalBandeja, BANDEJA_MAX, opcionesCuantos, bandejaLista, focoTrasContador } from "../src/bandeja.js";
import {
  nuevo, cargar, registrar, dominio, cerrarTurno, estrellasTurno, quiereFacil,
  marcarGuia, textoRacha, racha, cumplirReto, VENTANA, PARA_SUBIR,
} from "../src/progreso.js";
import { retoDelDia, META_GIGANTE } from "../src/reto.js";
import { accionAtras, resolverAtras, alCerrarSalir, toqueEnVelo, ignoraTrasCierre, TRAS_DIALOGO_MS } from "../src/salida.js";

const banco = JSON.parse(fs.readFileSync(new URL("../datos/cortes.json", import.meta.url), "utf8"));
const textos = JSON.parse(fs.readFileSync(new URL("../datos/textos.json", import.meta.url), "utf8"));
const rnd = rngConSemilla("pizzeria-pruebas");
const HOY = "2026-10-09";

test("cada patrón igual parte el área en partes iguales y la trampa no", () => {
  for (const p of banco.patrones) {
    if (p.guia) continue;
    const m = medir(p);
    if (p.iguales) {
      assert.equal(m.partes, p.partes, p.id);
      assert.equal(m.iguales, true, p.id);
      assert.equal(sonIguales(m.areas), true, p.id);
    } else {
      const r = analizar(p.forma, p.cortes);
      const pareceIgual = sonIguales(r.areas) && r.partes === (p.parece || p.partes);
      assert.equal(pareceIgual, false, p.id);
    }
  }
});

test("la trampa de 3 cortes paralelos no son tercios", () => {
  const p = patron(banco, "redonda-paralelos");
  assert.equal(p.trampa, "paralelos");
  assert.equal(p.cortes.length, 3);
  const r = analizar(p.forma, p.cortes);
  assert.notEqual(r.partes, 3);
  assert.equal(sonIguales(r.areas), false);
  const orden = lineasSvg(p.cortes);
  assert.match(orden, /<line /);
  assert.match(orden, /x1="-100"/);
});

test("la guía fija tiene 2 partes: una igual y una desigual", () => {
  const buena = medir(patron(banco, "guia-buena"));
  const mala = analizar("redonda", patron(banco, "guia-mala").cortes);
  assert.equal(buena.partes, 2);
  assert.equal(buena.iguales, true);
  assert.equal(mala.partes, 2);
  assert.equal(sonIguales(mala.areas), false);
});

test("si se piden 4 lados, solo una opción los tiene", () => {
  for (let i = 0; i < 40; i++) {
    const pedido = crearPedido(1, rnd, banco, textos);
    if (pedido.pide !== "lados" || pedido.cantidad !== 4) continue;
    const con4 = pedido.opciones.filter((o) => ladosDe(o) === 4);
    assert.equal(con4.length, 1);
    assert.equal(con4[0].id, pedido.correcta);
  }
  let vistos = 0;
  const r2 = rngConSemilla("solo-4");
  for (let i = 0; i < 30; i++) {
    const { opciones, correcta } = opcionesForma(4, r2);
    assert.equal(opciones.filter((o) => ladosDe(o) === 4).length, 1);
    assert.equal(opciones.find((o) => o.id === correcta).puntos.length, 4);
    vistos++;
  }
  assert.equal(vistos, 30);
});

test("hay pentágonos irregulares, cuadriláteros que no son cuadrados y figuras giradas", () => {
  reiniciarIds();
  const r = rngConSemilla("formas");
  let irregular = 0, noCuadrado = 0, girada = 0;
  for (let i = 0; i < 25; i++) {
    const p = crearPedido(1, r, banco, textos);
    for (const o of p.opciones) {
      if (o.tipo === "pent-irregular") irregular++;
      if (["rectangulo", "rombo", "trapecio", "cuad-irregular"].includes(o.tipo)) noCuadrado++;
      if (o.rotacion) girada++;
      if (!o.circulo) assert.equal(ladosDe(o), o.puntos.length);
    }
  }
  assert.ok(irregular > 0, "pentágono irregular");
  assert.ok(noCuadrado > 0, "cuadrilátero que no es cuadrado");
  assert.ok(girada > 0, "girada");
});

test("las fracciones van en palabras y no se dice vértices", () => {
  const prohibido = /½|¼|⅓|v[ée]rtice/i;
  const crudo = fs.readFileSync(new URL("../datos/textos.json", import.meta.url), "utf8")
    + fs.readFileSync(new URL("../datos/cortes.json", import.meta.url), "utf8");
  assert.equal(prohibido.test(crudo), false);
  for (let nivel = 1; nivel <= 7; nivel++) {
    for (let i = 0; i < 12; i++) {
      const p = crearPedido(nivel, rnd, banco, textos, { bien: i });
      assert.equal(prohibido.test(p.texto), false, p.texto);
      assert.equal(prohibido.test(p.leer || ""), false, p.leer);
      assert.equal(hablaSegura(p.leer), p.leer);
    }
  }
});

test("mitades y tercios se piden en partes iguales, y 1 parte va en singular", () => {
  const r2 = rngConSemilla("corta-2");
  for (let i = 0; i < 8; i++) {
    const p = crearPedido(2, r2, banco, textos);
    assert.equal(p.texto, "Corta en 2 partes iguales.");
    assert.equal(p.leer, p.texto);
  }
  const r4 = rngConSemilla("corta-3");
  let tercios = 0;
  for (let i = 0; i < 24; i++) {
    const p = crearPedido(4, r4, banco, textos);
    if (p.tipo !== "corta") continue;
    assert.equal(p.texto, "Corta en 3 partes iguales.");
    tercios++;
  }
  assert.ok(tercios > 0);
  let singular = 0;
  const r6 = rngConSemilla("pista-una");
  for (let bien = 0; bien < 8; bien++) {
    for (let i = 0; i < 12; i++) {
      const p = crearPedido(6, r6, banco, textos, { bien });
      assert.equal(/1 partes/.test(`${p.texto} ${p.pista}`), false, p.pista);
      if (p.cuantas === 1) {
        singular++;
        assert.match(p.pista, /1 parte$/);
      } else {
        assert.match(p.pista, new RegExp(`${p.cuantas} partes$`));
      }
    }
  }
  assert.ok(singular > 0);
});

test("en el nivel 6, 2 de 4 partes va antes que la mitad", () => {
  const r = rngConSemilla("decora");
  for (let i = 0; i < 20; i++) {
    const p = crearPedido(6, r, banco, textos, { bien: 0 });
    assert.match(p.texto, /\d de \d partes/);
    assert.equal(/la mitad|un tercio|un cuarto|tres cuartos|dos tercios/.test(p.texto), false, p.texto);
  }
  let mitad = 0;
  for (let i = 0; i < 30; i++) {
    const p = crearPedido(6, r, banco, textos, { bien: 6 });
    assert.equal(/\d de \d partes/.test(p.texto), false, p.texto);
    if (p.texto.includes("la mitad")) mitad++;
  }
  assert.ok(mitad > 0);
});

test("el nivel 4 siempre ofrece la trampa de cortes paralelos", () => {
  const r = rngConSemilla("tercios");
  for (let i = 0; i < 15; i++) {
    const p = crearPedido(4, r, banco, textos);
    if (p.tipo !== "corta") continue;
    assert.ok(p.opciones.includes("redonda-paralelos"), p.opciones.join(","));
    const buenas = p.opciones.filter((id) => patron(banco, id).iguales && patron(banco, id).partes === 3);
    assert.equal(buenas.length, 1);
    assert.equal(buenas[0], p.correcta);
  }
});

test("hasta el nivel 5 hay partes iguales con distinta forma", () => {
  const tri = patron(banco, "rect-cuartos-triangulos");
  assert.equal(medir(tri).iguales, true);
  assert.equal(tri.formaPieza, "triangulos");
  const r = rngConSemilla("formas-iguales");
  let vio = false;
  for (let i = 0; i < 40; i++) {
    const p = crearPedido(5, r, banco, textos);
    if (p.tipo === "corta" && p.correcta === "rect-cuartos-triangulos") vio = true;
  }
  assert.equal(vio, true);
});

test("la bandeja usa filas horizontales y columnas verticales, hasta 5", () => {
  const c = celdas(3, 4);
  assert.equal(c.length, 12);
  const fila0 = c.filter((x) => x.f === 0);
  assert.ok(fila0.every((x) => x.y === fila0[0].y));
  assert.deepEqual(fila0.map((x) => x.x), [0, 1, 2, 3]);
  assert.deepEqual(cuentaFilas(3, 4), [4, 8, 12]);
  assert.deepEqual(cuentaFilas(3, 3), [3, 6, 9]);
  assert.equal(totalBandeja(5, 5), 25);
  assert.equal(ajustar(1, -1), 1);
  assert.equal(ajustar(5, 1), BANDEJA_MAX);
  assert.equal(ajustar(5, 1, 3), 3);
  const alto = rngConSemilla("cinco");
  const forzar = () => 0.999;
  const grande = { filas: 2 + Math.floor(forzar() * 4), columnas: 2 + Math.floor(forzar() * 4) };
  assert.equal(grande.filas, 5);
  assert.equal(grande.columnas, 5);
  const ops = opcionesCuantos(3, 4, alto);
  assert.equal(ops.length, 3);
  assert.equal(new Set(ops).size, 3);
  assert.ok(ops.includes(12));
  assert.equal(bandejaLista(3, 4, { filas: 3, columnas: 4 }), true);
  assert.equal(bandejaLista(2, 4, { filas: 3, columnas: 4 }), false);
  const pedido = { filas: 3, columnas: 4 };
  assert.equal(focoTrasContador("filas", { filas: 3, columnas: 1 }, pedido), "columnas");
  assert.equal(focoTrasContador("columnas", { filas: 1, columnas: 4 }, pedido), "filas");
  assert.equal(focoTrasContador("columnas", { filas: 3, columnas: 4 }, pedido), "listo");
  assert.equal(focoTrasContador("filas", { filas: 2, columnas: 4 }, pedido), "filas");
  assert.notEqual(focoTrasContador("filas", { filas: 3, columnas: 4 }, pedido), "saltar");
});

test("el brillo solo cabe en decora y bandeja", () => {
  assert.equal(debeBrillar("corta", true), false);
  assert.equal(debeBrillar("forma", true), false);
  assert.equal(debeBrillar("decora", false), false);
  assert.equal(debeBrillar("decora", true), true);
  assert.equal(debeBrillar("bandeja", true), true);
  assert.equal(glifoMas("tv"), "▲");
  assert.equal(glifoMas("tactil"), "+");
  assert.equal(glifoMenos("tv"), "▼");
  assert.equal(hablaSegura("Filas + ▲"), "Filas");
});

test("la guía: mirar avanza solo, servir espera su paso y el foco cae en la pizza igual", () => {
  assert.equal(GUIA_TOQUE_MS, 2000);
  assert.equal(guiaAvanzaConToque(0), true);
  assert.equal(guiaAvanzaConToque(1), true);
  assert.equal(guiaAvanzaConToque(2), true);
  assert.equal(guiaAvanzaConToque(3), false);
  assert.equal(textoDeGuia(0, textos), "Corta en 2 partes iguales.");
  assert.equal(textoDeGuia(1, textos), "Esta no: una es más grande.");
  assert.equal(textoDeGuia(2, textos), "Esta sí: las 2 son iguales.");
  assert.equal(textoDeGuia(3, textos, "tactil"), "Tócala para servir.");
  assert.equal(textoDeGuia(3, textos, "tv"), "Pulsa OK para servir.");
  assert.equal(vozDeGuia(3, textos, "tv"), "Pulsa OK para servir.");
  assert.equal(/[▲▼+−½¼]/.test([0, 1, 2, 3].map((p) => vozDeGuia(p, textos, "tv")).join(" ")), false);
  assert.doesNotMatch(textoDeGuia(3, textos, "tv"), /Toca/);
  for (const paso of [0, 1, 2]) {
    assert.equal(focoDeGuia(paso), "pedido-guia");
    assert.notEqual(focoDeGuia(paso), "saltar");
  }
  assert.equal(focoDeGuia(3), "buena");
  assert.notEqual(focoDeGuia(3), "saltar");
  assert.notEqual(focoDeGuia(3), "pedido-guia");
  for (const paso of [0, 1, 2, 3]) assert.equal(guiaServirActivo(paso), paso === 3);
  assert.equal(siguientePasoGuia(0, { tipo: "toque", opcion: "mala" }), 1);
  assert.equal(siguientePasoGuia(0, { tipo: "toque", opcion: "buena" }), 1);
  assert.equal(siguientePasoGuia(0, { tipo: "ok" }), 1);
  assert.equal(siguientePasoGuia(0, { tipo: "tiempo" }), 1);
  assert.equal(siguientePasoGuia(1, { tipo: "toque" }), 2);
  assert.equal(siguientePasoGuia(1, { tipo: "ok" }), 2);
  assert.equal(siguientePasoGuia(1, { tipo: "tiempo" }), 2);
  assert.equal(siguientePasoGuia(1, { tipo: "activar", opcion: "buena" }), 2);
  assert.equal(siguientePasoGuia(1, { tipo: "activar", opcion: "mala" }), 2);
  assert.equal(siguientePasoGuia(1, { tipo: "ok", repetido: true }), 1);
  assert.equal(siguientePasoGuia(2, { tipo: "ok" }), 3);
  let paso = 3;
  for (let i = 0; i < 4; i++) paso = siguientePasoGuia(paso, { tipo: "ok" });
  assert.equal(paso, 3);
  assert.equal(siguientePasoGuia(3, { tipo: "activar", opcion: "mala" }), 3);
  paso = siguientePasoGuia(3, { tipo: "activar", opcion: "buena" });
  assert.equal(paso, 4);
  assert.equal(guiaTerminada(paso), true);
  assert.equal(textoContador("tv"), "Pulsa ▲");
  assert.equal(textoContador("tactil"), "Pulsa +");
  assert.equal(vozContador("tv"), "Pulsa arriba");
  assert.equal(/[▲▼+]/.test(vozContador("tv")), false);
  assert.equal(pistaVisible("¿Son del mismo tamaño?", { resuelto: true }), "");
  assert.equal(pistaVisible("¿Son del mismo tamaño?", { revelado: true }), "");
  assert.equal(pistaVisible("¿Son del mismo tamaño?", {}), "¿Son del mismo tamaño?");
});

test("con ¿Salir? abierto, Seguir y Salir no avanzan ningún paso de la guía", () => {
  for (const paso of [0, 1, 2, 3]) {
    const seguir = toqueDuranteGuia(paso, { dialogoAbierto: true, ir: "seguir-juego" });
    assert.equal(seguir.accion, "seguir");
    assert.equal(seguir.paso, paso);
    const salir = toqueDuranteGuia(paso, { dialogoAbierto: true, ir: "salir-juego" });
    assert.equal(salir.accion, "salir");
    assert.equal(salir.paso, paso);
    const fondo = toqueDuranteGuia(paso, { dialogoAbierto: true });
    assert.equal(fondo.accion, "nada");
    assert.equal(fondo.paso, paso);
    const pizza = toqueDuranteGuia(paso, { dialogoAbierto: true, ir: "guia" });
    assert.equal(pizza.accion, "nada");
    assert.equal(pizza.paso, paso);
  }
  assert.equal(toqueDuranteGuia(0, { ir: "saltar-guia" }).accion, "saltar");
  assert.equal(toqueDuranteGuia(1, {}).accion, "avanzar");
  assert.equal(toqueDuranteGuia(1, {}).paso, 2);
  assert.equal(toqueDuranteGuia(3, {}).accion, "jugar");
  assert.equal(toqueDuranteGuia(3, {}).paso, 3);
  const juego = fs.readFileSync(new URL("../src/juego.js", import.meta.url), "utf8");
  const click = juego.slice(juego.indexOf('$main.addEventListener("click"'));
  const corte = click.indexOf("Noli.alEntrar");
  const cuerpo = corte > 0 ? click.slice(0, corte) : click;
  assert.match(cuerpo, /toqueDuranteGuia/);
  assert.ok(cuerpo.indexOf("if (saliendo)") < cuerpo.indexOf("if (esGuia())"));
});

test("un OK o un toque rápido no salta la guía ni contesta el primer pedido", () => {
  assert.equal(GUIA_CIERRE_MS, 1000);
  assert.equal(GUIA_TOPE_MS, 3000);
  assert.equal(TRAS_GUIA_MS, 1000);
  const base = 1760000000000;
  function simular(eventos, vozSigue = false) {
    let paso = 0;
    let aparecio = base;
    for (const ev of eventos) {
      const r = entradaGuia(paso, ev.evento, { ahora: ev.ahora, aparecio, vozSigue });
      if (r.accion === "avanzo") {
        paso = r.paso;
        aparecio = ev.ahora;
      }
    }
    return paso;
  }
  const rapidos = (tipo, extra) => [0, 200, 400, 700].map((dt) => ({
    ahora: base + dt,
    evento: { tipo, ...extra },
  }));
  assert.equal(simular(rapidos("ok")), 0);
  assert.equal(simular(rapidos("toque")), 0);
  assert.equal(simular(rapidos("activar", { opcion: "buena" })), 0);
  assert.equal(guiaBloqueada({ ahora: base + 1500, aparecio: base, vozSigue: true }), true);
  assert.equal(guiaBloqueada({ ahora: base + 1500, aparecio: base, vozSigue: false }), false);
  assert.equal(guiaBloqueada({ ahora: base + 3000, aparecio: base, vozSigue: true }), false);
  assert.equal(entradaGuia(0, { tipo: "ok" }, { ahora: base + 1000, aparecio: base, vozSigue: false }).paso, 1);
  assert.equal(entradaGuia(3, { tipo: "activar", opcion: "buena" }, { ahora: base + 999, aparecio: base, vozSigue: false }).paso, 3);
  assert.equal(entradaGuia(3, { tipo: "activar", opcion: "buena" }, { ahora: base + 1000, aparecio: base, vozSigue: false }).paso, 4);
  assert.equal(focoDeGuia(3), "buena");
  assert.equal(entradaGuia(1, { tipo: "saltar" }, { ahora: base + 10, aparecio: base, vozSigue: true }).accion, "saltar");
  const desde = base + 50000;
  for (const dt of [0, 100, 400, 999]) {
    assert.equal(entradaPedido("op-0", { ahora: desde + dt, desde, trasGuia: true }), null);
  }
  assert.equal(entradaPedido("op-0", { ahora: desde + 1000, desde, trasGuia: true }), "op-0");
  assert.equal(entradaPedido("op-0", { ahora: desde, desde, trasGuia: false }), "op-0");
  const juego = fs.readFileSync(new URL("../src/juego.js", import.meta.url), "utf8");
  assert.match(juego, /entradaGuia/);
  assert.match(juego, /entradaPedido/);
});

test("un paso que solo se mira espera a la voz y no pasa de 3 s", () => {
  assert.equal(siguienteAutoGuia({ transcurrido: 2000, vozSigue: true }).avanzar, false);
  assert.equal(siguienteAutoGuia({ transcurrido: 2600, vozSigue: true }).avanzar, false);
  assert.equal(siguienteAutoGuia({ transcurrido: 2600, vozSigue: false }).avanzar, true);
  assert.equal(siguienteAutoGuia({ transcurrido: 3000, vozSigue: true }).avanzar, true);
  assert.equal(siguienteAutoGuia({ transcurrido: 5000, vozSigue: true }).avanzar, true);
  assert.equal(siguienteAutoGuia({ transcurrido: 1999, vozSigue: false }).avanzar, false);
  assert.equal(siguienteAutoGuia({ transcurrido: 2000, vozSigue: false }).avanzar, true);
  assert.equal(siguienteAutoGuia({ transcurrido: 0, vozSigue: true }).espera, GUIA_TOPE_MS);
  assert.equal(siguienteAutoGuia({ transcurrido: 0, vozSigue: false }).espera, GUIA_TOQUE_MS);
  function simular(vozHasta) {
    let t = 0;
    let paso = 0;
    while (paso < 1 && t <= 4000) {
      const vozSigue = t < vozHasta;
      const d = siguienteAutoGuia({ transcurrido: t, vozSigue });
      if (d.avanzar) {
        paso = siguientePasoGuia(paso, { tipo: "tiempo" });
        break;
      }
      const siguiente = t + d.espera;
      if (vozSigue && vozHasta < siguiente) t = vozHasta;
      else t = siguiente;
    }
    return { paso, t };
  }
  assert.deepEqual(simular(2600), { paso: 1, t: 2600 });
  assert.deepEqual(simular(5000), { paso: 1, t: GUIA_TOPE_MS });
  assert.deepEqual(simular(0), { paso: 1, t: GUIA_TOQUE_MS });
  assert.deepEqual(simular(400), { paso: 1, t: GUIA_TOQUE_MS });
  const juego = fs.readFileSync(new URL("../src/juego.js", import.meta.url), "utf8");
  assert.match(juego, /siguienteAutoGuia/);
  assert.equal(guiaBloqueada({ ahora: 1500, aparecio: 0, vozSigue: true }), true);
});

test("tras cerrar ¿Salir? un toque o un OK de los siguientes 400 ms no cae debajo", () => {
  assert.equal(TRAS_DIALOGO_MS, 400);
  const cerro = 5000;
  for (const dt of [90, 200, 300, 399]) {
    assert.equal(ignoraTrasCierre({ ahora: cerro + dt, cerro }), true);
  }
  assert.equal(ignoraTrasCierre({ ahora: cerro + 400, cerro }), false);
  assert.equal(ignoraTrasCierre({ ahora: cerro, cerro: 0 }), false);
  function aplicar(accion, dt) {
    if (ignoraTrasCierre({ ahora: cerro + dt, cerro })) return "nada";
    return accion;
  }
  assert.equal(aplicar("servir", 200), "nada");
  assert.equal(aplicar("rebanada", 300), "nada");
  assert.equal(aplicar("opcion", 90), "nada");
  assert.equal(aplicar("ok", 300), "nada");
  assert.equal(aplicar("servir", 400), "servir");
  assert.equal(aplicar("ok", 400), "ok");
  const juego = fs.readFileSync(new URL("../src/juego.js", import.meta.url), "utf8");
  const click = juego.slice(juego.indexOf('$main.addEventListener("click"'));
  assert.ok(click.indexOf("ignoraTrasCierre") > 0);
  assert.ok(click.indexOf("ignoraTrasCierre") < click.indexOf("if (esGuia())"));
  assert.match(juego, /accion === "ok" && ignoraTrasCierre/);
});

test("¿Salir? pausa la guía y Seguir empieza otra vez el paso y la voz", () => {
  assert.equal(siguienteAutoGuia({ transcurrido: 2500, vozSigue: false }).avanzar, true);
  for (const paso of [0, 1]) {
    const re = reanudarPasoGuia({ ahora: 3000, vozSigue: false });
    assert.equal(re.auto.avanzar, false);
    assert.equal(re.auto.espera, GUIA_TOQUE_MS);
    assert.equal(re.bloqueada, true);
    assert.equal(guiaBloqueada({ ahora: 3000 + 300, aparecio: re.desde, vozSigue: false }), true);
    assert.notEqual(siguientePasoGuia(paso, { tipo: "tiempo" }), paso);
  }
  const hablando = reanudarPasoGuia({ ahora: 2600, vozSigue: true });
  assert.equal(hablando.auto.avanzar, false);
  assert.equal(hablando.auto.espera, GUIA_TOPE_MS);
  assert.equal(hablando.bloqueada, true);

  function simular({ abiertoEn, cerradoEn, vozHasta }) {
    let paso = 0;
    let aparecio = 0;
    let t = 0;
    let dialog = false;
    for (let guard = 0; paso < 1 && guard < 20; guard++) {
      if (!dialog && abiertoEn > t) {
        const antes = siguienteAutoGuia({ transcurrido: abiertoEn - aparecio, vozSigue: abiertoEn < vozHasta });
        if (antes.avanzar) {
          paso = 1;
          t = abiertoEn;
          break;
        }
        dialog = true;
        t = abiertoEn;
      }
      if (dialog) {
        const re = reanudarPasoGuia({ ahora: cerradoEn, vozSigue: cerradoEn < vozHasta });
        if (re.auto.avanzar) {
          paso = 1;
          t = cerradoEn;
          break;
        }
        aparecio = re.desde;
        dialog = false;
        t = cerradoEn;
      }
      const vozSigue = t < vozHasta;
      const d = siguienteAutoGuia({ transcurrido: t - aparecio, vozSigue });
      if (d.avanzar) {
        paso = siguientePasoGuia(paso, { tipo: "tiempo" });
        break;
      }
      let siguiente = t + d.espera;
      if (vozSigue && vozHasta > t && vozHasta < siguiente) siguiente = vozHasta;
      if (abiertoEn > t && abiertoEn < siguiente) {
        t = abiertoEn;
        continue;
      }
      t = siguiente;
    }
    return { paso, t, aparecio };
  }

  const quieto = simular({ abiertoEn: 100, cerradoEn: 2500, vozHasta: 0 });
  assert.deepEqual({ paso: quieto.paso, t: quieto.t, aparecio: quieto.aparecio }, { paso: 1, t: 4500, aparecio: 2500 });
  const conVoz = simular({ abiertoEn: 200, cerradoEn: 2600, vozHasta: 9000 });
  assert.deepEqual({ paso: conVoz.paso, t: conVoz.t, aparecio: conVoz.aparecio }, { paso: 1, t: 5600, aparecio: 2600 });
  const vozCorta = simular({ abiertoEn: 100, cerradoEn: 2000, vozHasta: 3200 });
  assert.deepEqual({ paso: vozCorta.paso, t: vozCorta.t, aparecio: vozCorta.aparecio }, { paso: 1, t: 4000, aparecio: 2000 });
  const juego = fs.readFileSync(new URL("../src/juego.js", import.meta.url), "utf8");
  assert.match(juego, /reanudarPasoGuia/);
});

test("en el teléfono el fondo de ¿Salir? es Seguir y en la tele no", () => {
  assert.equal(toqueEnVelo({ modo: "tactil", enDialogo: false }), "seguir");
  assert.equal(toqueEnVelo({ modo: "tactil", enDialogo: true }), "nada");
  assert.equal(toqueEnVelo({ modo: "tv", enDialogo: false }), "nada");
  const juego = fs.readFileSync(new URL("../src/juego.js", import.meta.url), "utf8");
  assert.match(juego, /toqueEnVelo/);
});

test("sube con 8 de los últimos 10 y la propina es fija", () => {
  let pr = nuevo();
  for (let i = 0; i < 7; i++) pr = registrar(pr, 1, true, HOY);
  for (let i = 0; i < 3; i++) pr = registrar(pr, 1, false, HOY);
  assert.equal(dominio(pr, 1).listo, false);
  pr = nuevo();
  for (let i = 0; i < PARA_SUBIR; i++) pr = registrar(pr, 1, true, HOY);
  assert.equal(dominio(pr, 1).intentos, PARA_SUBIR);
  assert.equal(dominio(pr, 1).listo, false);
  pr = nuevo();
  for (let i = 0; i < 8; i++) pr = registrar(pr, 1, true, HOY);
  for (let i = 0; i < 2; i++) pr = registrar(pr, 1, false, HOY);
  assert.equal(dominio(pr, 1).listo, true);
  const cerrado = cerrarTurno(pr, 1, 6);
  assert.equal(cerrado.subio, 2);
  assert.equal(cerrado.pr.propinas, 6 * PROPINA);
  assert.equal(estrellasTurno(6, 6), 3);
  assert.equal(estrellasTurno(5, 6), 2);
  assert.equal(estrellasTurno(3, 6), 1);
  assert.equal(estrellasTurno(2, 6), 0);
  assert.equal(POR_TURNO, 6);
  assert.equal(quiereFacil(registrar(registrar(registrar(nuevo(), 1, false, HOY), 1, false, HOY), 1, false, HOY), 1), true);
});

test("los adornos se abren en orden fijo y no hay tienda", () => {
  assert.deepEqual(abiertos(0).map((a) => a.id), []);
  assert.deepEqual(abiertos(3).map((a) => a.id), ["letrero-1"]);
  assert.deepEqual(abiertos(6).map((a) => a.id), ["letrero-1", "mesa-1"]);
  assert.deepEqual(abiertos(100).map((a) => a.id), ADORNOS.map((a) => a.id));
  assert.deepEqual(recienAbierto(2, 3).map((a) => a.id), ["letrero-1"]);
  assert.equal(sumarPropinas(0, 1), PROPINA);
  assert.equal(PROPINA, 1);
  const src = fs.readFileSync(new URL("../src/deco.js", import.meta.url), "utf8");
  assert.equal(/tienda|comprar|precio/i.test(src), false);
});

test("el reto del día es determinista y la pizza gigante pide 8 y 5", () => {
  const a = retoDelDia("2026-10-08", 4, banco, textos);
  const b = retoDelDia("2026-10-08", 4, banco, textos);
  assert.equal(a.tipo, "gigante");
  assert.equal(a.nombre, "Pizza gigante");
  assert.equal(a.cuantos, META_GIGANTE.cuantos);
  assert.equal(a.necesita, 5);
  assert.equal(a.problemas.length, 8);
  assert.deepEqual(a.problemas.map((p) => p.texto), b.problemas.map((p) => p.texto));
  const c = retoDelDia("2026-10-09", 3, banco, textos);
  const d = retoDelDia("2026-10-09", 3, banco, textos);
  assert.equal(c.tipo, "gigante");
  assert.equal(c.nombre, "Pizza gigante");
  assert.equal(c.cuantos, 8);
  assert.equal(c.necesita, 5);
  assert.equal(c.problemas.length, 8);
  assert.deepEqual(c.problemas.map((p) => p.texto), d.problemas.map((p) => p.texto));
  assert.ok(c.problemas.every((p) => p.tipo !== "doble" && p.tipo !== "exigente"));
  assert.equal(a.segundos, undefined);
  assert.equal(c.tiempo, undefined);
  assert.equal(/exigente/i.test(fs.readFileSync(new URL("../src/reto.js", import.meta.url), "utf8")), false);
});

test("la racha no regaña y atrás abre salir, también en la guía", () => {
  const pr = cumplirReto(nuevo(), HOY, "gigante", 5, false);
  assert.equal(racha(pr, HOY), 0);
  assert.match(textoRacha(0, textos), /empezar una racha/);
  assert.doesNotMatch(textoRacha(0, textos), /perdist|regañ|romp/i);
  assert.equal(textoRacha(2, textos), "Racha: 2 días");
  assert.equal(resolverAtras(false), "abrir");
  assert.equal(resolverAtras(true), "cerrar");
  assert.notEqual(resolverAtras(true), "salir");
  assert.equal(accionAtras("pedido"), "preguntar");
  assert.equal(accionAtras("inicio"), "preguntar");
  assert.equal(accionAtras("guia"), "preguntar");
  assert.notEqual(accionAtras("guia"), "saltar-guia");
  assert.equal(accionAtras("fin"), "preguntar");
  assert.equal(accionAtras("finReto"), "preguntar");
  assert.equal(alCerrarSalir({ resuelto: true, revelado: true }), "quedarse");
  assert.equal(alCerrarSalir({ resuelto: true, revelado: false }), "avanzar");
  assert.equal(alCerrarSalir({ salir: true, resuelto: true, revelado: true }), "salir");
  assert.equal(alCerrarSalir({ guia: true }), "quedarse");
  assert.notEqual(accionAtras("fin"), "inicio");
  assert.equal(accionAtras("papas"), "progreso");
  assert.equal(marcarGuia(nuevo()).guiaHecha, true);
});

test("las pistas crecen y contar no usa símbolos", () => {
  assert.equal(fasePista({ nivel: 1, tipo: "forma", ms: 0 }), "completa");
  assert.equal(fasePista({ nivel: 3, tipo: "corta", ms: 0 }), "frase");
  assert.equal(fasePista({ nivel: 3, tipo: "corta", ms: 20000 }), "encima");
  assert.equal(fasePista({ nivel: 3, tipo: "corta", ms: 40000 }), "completa");
  assert.equal(fasePista({ nivel: 3, tipo: "corta", ms: 0, fallo: true }), "completa");
  assert.equal(fasePista({ nivel: 6, tipo: "decora", ms: 0 }), "frase");
  assert.equal(fasePista({ nivel: 6, tipo: "decora", ms: 20000 }), "encima");
  assert.equal(fasePista({ nivel: 6, tipo: "decora", ms: 40000 }), "completa");
  assert.equal(fasePista({ nivel: 6, tipo: "decora", ms: 0, fallo: true }), "completa");
  assert.equal(fasePista({ nivel: 7, tipo: "bandeja", ms: 0 }), "frase");
  assert.equal(fasePista({ nivel: 7, tipo: "bandeja", ms: 20000 }), "encima");
  assert.equal(fasePista({ nivel: 7, tipo: "bandeja", ms: 40000 }), "completa");
  assert.equal(fasePista({ nivel: 7, tipo: "bandeja", ms: 0, fallo: true }), "completa");
  assert.equal(cuentaParaDominio({ nivel: 3, tipo: "corta", vioCompleta: true }), false);
  assert.equal(cuentaParaDominio({ nivel: 1, tipo: "forma", vioCompleta: true }), true);
  assert.equal(cuentaParaDominio({ nivel: 6, tipo: "decora", vioCompleta: true }), false);
  assert.equal(cuentaParaDominio({ nivel: 6, tipo: "decora", vioCompleta: false }), true);
  assert.equal(cuentaParaDominio({ nivel: 7, tipo: "bandeja", vioCompleta: false }), true);
  assert.equal(IDLE_COMPLETA_MS, 40000);
  const fase40 = fasePista({ nivel: 4, tipo: "corta", ms: IDLE_COMPLETA_MS, fallo: false });
  assert.equal(fase40, "completa");
  assert.equal(cuentaParaDominio({ nivel: 4, tipo: "corta", vioCompleta: fase40 === "completa" }), false);
  assert.equal(cuentaParaDominio({ nivel: 2, tipo: "corta", vioCompleta: true }), false);
  assert.equal(cuentaParaDominio({ nivel: 5, tipo: "corta", vioCompleta: true }), false);
  assert.equal(cuentaParaDominio({ nivel: 4, tipo: "corta", vioCompleta: false }), true);
  assert.equal(cuentaParaDominio({ nivel: 7, tipo: "bandeja", vioCompleta: true }), false);
  const deco = crearPedido(6, rngConSemilla("pista-deco"), banco, textos, { bien: 0 });
  assert.equal(textoPista(deco, "frase", textos, "tactil"), "Toca una rebanada");
  assert.equal(textoPista(deco, "encima", textos, "tv"), "Pulsa OK en una rebanada");
  assert.equal(textoPista(deco, "completa", textos, "tv"), deco.pista);
  const ban = crearPedido(7, rngConSemilla("pista-ban"), banco, textos);
  assert.equal(textoPista(ban, "frase", textos, "tv"), "Pulsa ▲");
  assert.equal(textoPista(ban, "completa", textos, "tactil"), ban.pista);
});

test("responder bien y mal", () => {
  const corta = crearPedido(2, rngConSemilla("ok"), banco, textos);
  assert.equal(esCorrecto(corta, corta.correcta), true);
  assert.equal(esCorrecto(corta, "no-existe"), false);
  const bandeja = crearPedido(7, rngConSemilla("brownie"), banco, textos);
  assert.ok(bandeja.filas <= 5 && bandeja.columnas <= 5);
  assert.ok(bandeja.filas >= 2 && bandeja.columnas >= 2);
  assert.equal(esCorrecto(bandeja, { filas: bandeja.filas, columnas: bandeja.columnas }), true);
  assert.equal(esCorrecto({ tipo: "cuantos", total: bandeja.total }, bandeja.total), true);
  const deco = crearPedido(6, rngConSemilla("deco-ok"), banco, textos, { bien: 0 });
  assert.equal(esCorrecto(deco, deco.cuantas), true);
  assert.equal(esCorrecto(deco, deco.cuantas + 1), false);
});

test("cargar progreso viejo o roto no truena y la voz empieza encendida", () => {
  assert.equal(nuevo().voz, true);
  assert.equal(cargar(null).nivel, 1);
  assert.equal(cargar({ v: 1, nivel: 9, voz: false, propinas: 4, guiaHecha: true }).nivel, 7);
  assert.equal(cargar({ v: 1, voz: false }).voz, false);
  assert.equal(cargar({ v: 1 }).voz, true);
});

test("opciones de corte: una sola correcta", () => {
  const r = rngConSemilla("cortes-op");
  for (let i = 0; i < 20; i++) {
    const { opciones, correcta } = opcionesCorte(banco, r, { partes: 2 });
    const buenas = opciones.filter((p) => p.iguales && p.partes === 2);
    assert.equal(buenas.length, 1);
    assert.equal(buenas[0].id, correcta);
  }
});

test("el juego no arrastra la bandeja ni espera un reloj", () => {
  const juego = fs.readFileSync(new URL("../src/juego.js", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../estilo.css", import.meta.url), "utf8");
  assert.equal(/pointermove|ondrag|draggable/.test(juego), false);
  assert.equal(/contrarreloj|setInterval\(/.test(juego), false);
  assert.equal(/½|¼|v[ée]rtice/i.test(juego), false);
  assert.equal(/esGuia\(\) && !saliendo\)[\s\S]{0,40}terminarGuia/.test(juego), false);
  assert.match(juego, /class="cab"[\s\S]{0,220}class="saltar"/);
  assert.match(css, /\.saltar\{[^}]*min-height:64px/);
  assert.match(css, /button:disabled\{[^}]*opacity:\.38/);
});
