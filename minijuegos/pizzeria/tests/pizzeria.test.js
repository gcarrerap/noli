import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { rngConSemilla } from "../src/rng.js";
import { analizar, sonIguales } from "../src/area.js";
import { medir, lineasSvg, patron, opcionesCorte } from "../src/cortes.js";
import { ladosDe, opcionesForma, crearFigura, reiniciarIds } from "../src/figuras.js";
import { crearPedido, esCorrecto, POR_TURNO } from "../src/pedidos.js";
import { siguientePasoGuia, guiaTerminada, textoDeGuia } from "../src/guia.js";
import { fasePista, debeBrillar, cuentaParaDominio, hablaSegura, glifoMas, glifoMenos } from "../src/pista.js";
import { abiertos, recienAbierto, sumarPropinas, PROPINA, ADORNOS } from "../src/deco.js";
import { ajustar, celdas, cuentaFilas, totalBandeja, BANDEJA_MAX, opcionesCuantos, bandejaLista } from "../src/bandeja.js";
import {
  nuevo, cargar, registrar, dominio, cerrarTurno, estrellasTurno, quiereFacil,
  marcarGuia, textoRacha, racha, cumplirReto, VENTANA, PARA_SUBIR,
} from "../src/progreso.js";
import { retoDelDia, META_GIGANTE } from "../src/reto.js";
import { accionAtras, resolverAtras } from "../src/salida.js";

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

test("la guía solo avanza cuando ella hace el paso", () => {
  assert.equal(textoDeGuia(0, textos), "Corta en 2 partes iguales.");
  assert.equal(textoDeGuia(1, textos), "Esta no: una es más grande.");
  assert.equal(textoDeGuia(2, textos), "Esta sí: las 2 son iguales.");
  assert.equal(textoDeGuia(3, textos), "Tócala para servir.");
  let paso = 0;
  paso = siguientePasoGuia(paso, { tipo: "activar", opcion: "buena" });
  assert.equal(paso, 0);
  paso = siguientePasoGuia(paso, { tipo: "foco", opcion: "mala" });
  assert.equal(paso, 1);
  paso = siguientePasoGuia(paso, { tipo: "activar", opcion: "buena" });
  assert.equal(paso, 1);
  paso = siguientePasoGuia(paso, { tipo: "activar", opcion: "mala" });
  assert.equal(paso, 2);
  paso = siguientePasoGuia(paso, { tipo: "foco", opcion: "mala" });
  assert.equal(paso, 2);
  paso = siguientePasoGuia(paso, { tipo: "foco", opcion: "buena" });
  assert.equal(paso, 3);
  paso = siguientePasoGuia(paso, { tipo: "activar", opcion: "mala" });
  assert.equal(paso, 3);
  paso = siguientePasoGuia(paso, { tipo: "activar", opcion: "buena" });
  assert.equal(paso, 4);
  assert.equal(guiaTerminada(paso), true);
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
  assert.equal(c.tipo, "exigente");
  assert.equal(c.problemas.length, 6);
  assert.ok(c.problemas.every((p) => p.tipo === "doble" && p.pasos.length === 2));
  assert.equal(a.segundos, undefined);
  assert.equal(c.tiempo, undefined);
});

test("la racha no regaña y atrás abre salir, menos en la guía", () => {
  const pr = cumplirReto(nuevo(), HOY, "gigante", 5, false);
  assert.equal(racha(pr, HOY), 0);
  assert.match(textoRacha(0, textos), /empezar una racha/);
  assert.doesNotMatch(textoRacha(0, textos), /perdist|regañ|romp/i);
  assert.equal(textoRacha(2, textos), "Racha: 2 días");
  assert.equal(resolverAtras(false), "abrir");
  assert.equal(resolverAtras(true), "cerrar");
  assert.equal(accionAtras("pedido", false), "preguntar");
  assert.equal(accionAtras("inicio", false), "preguntar");
  assert.equal(accionAtras("pedido", true), "saltar-guia");
  assert.equal(accionAtras("papas", false), "progreso");
  assert.equal(marcarGuia(nuevo()).guiaHecha, true);
});

test("las pistas crecen y contar no usa símbolos", () => {
  assert.equal(fasePista({ nivel: 1, tipo: "forma", ms: 0 }), "completa");
  assert.equal(fasePista({ nivel: 3, tipo: "corta", ms: 0 }), "frase");
  assert.equal(fasePista({ nivel: 3, tipo: "corta", ms: 20000 }), "encima");
  assert.equal(fasePista({ nivel: 3, tipo: "corta", ms: 40000 }), "completa");
  assert.equal(fasePista({ nivel: 3, tipo: "corta", ms: 0, fallo: true }), "completa");
  assert.equal(fasePista({ nivel: 6, tipo: "decora" }), "completa");
  assert.equal(fasePista({ nivel: 7, tipo: "bandeja" }), "completa");
  assert.equal(cuentaParaDominio({ nivel: 3, tipo: "corta", vioCompleta: true }), false);
  assert.equal(cuentaParaDominio({ nivel: 1, tipo: "forma", vioCompleta: true }), true);
  assert.equal(cuentaParaDominio({ nivel: 6, tipo: "decora", vioCompleta: true }), true);
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
  assert.equal(/pointermove|ondrag|draggable/.test(juego), false);
  assert.equal(/contrarreloj|setInterval\(/.test(juego), false);
  assert.equal(/½|¼|v[ée]rtice/i.test(juego), false);
});
