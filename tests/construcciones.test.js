// Pruebas de lo que hay en las islas (#176): Isla Cristal con sus 6 lugares de juego (3 abiertos, 3 cerrados), los
// juegos que empiezan en un nivel más avanzado (kit/niveles.js), los cristales, los costos, que todo se alcance caminando
// (con la física de verdad) y que los efectos caros solo existan en calidad alta.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { armarIslas, estrellasPosibles, sumarEstrellas, estrellasDeJuego, normalizar, mapaIslas, estadoRed, limitesRed,
  teletransportadorDe, aOrilla } from "../src/engine/islas.js";
import { armarConstrucciones, lugaresIslas, cristalesIslas, solidosIslas, caminosIsla, revisarConstrucciones, salidasDe,
  altosIslas } from "../src/engine/construcciones.js";
import { fisicaDe, cristalesDe, lugarCercano, rutaPorCaminos, cristalTocado, mapaMundo, colocarLugares, decorar,
  todosLosSitios } from "../src/engine/mundo.js";
import { urlDeJuego } from "../src/engine/catalogo.js";
import { pasoFisico, crearCuerpo, chocaEn } from "../kit/3d/fisica.js";
import { seguirRuta } from "../kit/3d/movimiento.js";
import { validarManifiesto } from "../src/engine/manifiesto.js";
import { pisoDe, conPiso, nivelActual, nivelNormal, escogible, trasRonda, deUrl } from "../kit/niveles.js";

const leer = (p) => JSON.parse(fs.readFileSync(new URL("../" + p, import.meta.url), "utf8"));
const MUNDO = leer("mundo/mundo.json"), ISLAS = leer("mundo/islas.json"), LUGARES = leer("mundo/lugares.json");
const CFG = fisicaDe(MUNDO);
const RED = armarIslas(ISLAS);
const CONS = armarConstrucciones(RED);
const CRISTAL = CONS.get("cristal");
const CATALOGO = leer("minijuegos/catalogo.json").juegos.map((id) => validarManifiesto(leer(`minijuegos/${id}/juego.json`), id).juego);
const LUGARES_ISLA = lugaresIslas(CONS, CATALOGO);
const DT = 1 / 60;

/** El mapa de la física como en el mundo: Isla Noli + islas + construcciones, con el primer puente construido */
function mapaCompleto(conexiones = ["noli-cristal"]) {
  const lugares = colocarLugares(CATALOGO, LUGARES);
  const mapa = mapaMundo(MUNDO, lugares, decorar(MUNDO, todosLosSitios(LUGARES)));
  const mi = mapaIslas(RED, estadoRed(RED, { visitadas: ["noli", "cristal"], conexiones }));
  return { solidos: [...mapa.solidos, ...mi.solidos, ...solidosIslas(CONS)], zonas: mi.zonas, limites: limitesRed(RED) };
}

/** Camina siguiendo una ruta con la física; regresa el cuerpo al final */
function caminar(c, ruta, mapa, segundos = 40) {
  for (let i = 0; i < segundos / DT && ruta.length; i++) { const s = seguirRuta(c, ruta); ruta = s.ruta; c = pasoFisico(c, { quiere: s.quiere }, DT, CFG, mapa).c; }
  return c;
}

// ---------- Datos ----------

test("construcciones: los datos de Isla Cristal están bien", () => {
  assert.deepEqual(revisarConstrucciones(ISLAS, RED, CFG), []);
  assert.ok(CRISTAL, "Isla Cristal tiene construcciones");
});

test("construcciones: revisarConstrucciones encuentra datos rotos", () => {
  const roto = JSON.parse(JSON.stringify(ISLAS));
  const C = roto.islas.find((i) => i.id === "cristal").construcciones;
  C.rocas.push({ id: "r1", x: 0, z: 10, r: 1, alto: 2.5 });                    // repetida y muy alta
  C.cristales.push({ id: "cc-1", en: "no-existe" });                           // repetido y en una roca que no existe
  C.lugares.push({ id: "c9", x: 0, z: 18, nivelInicial: 0 });                   // tapa la entrada del puente; nivel 0
  const e = revisarConstrucciones(roto, armarIslas(roto), CFG);
  for (const t of ["repetida: r1", "muy alta", "repetido: cc-1", "no-existe", "nivelInicial"]) assert.ok(e.some((m) => m.includes(t)), t);
  // Con los datos bien escritos, revisa dónde quedó cada cosa
  const tapa = JSON.parse(JSON.stringify(ISLAS));
  tapa.islas.find((i) => i.id === "cristal").construcciones.lugares.push({ id: "c9", x: 0, z: 18 });
  const e2 = revisarConstrucciones(tapa, armarIslas(tapa), CFG);
  assert.ok(e2.some((m) => m.includes("tapa la salida hacia noli-cristal")), e2.join("; "));
});

// ---------- Lugares de juego ----------

test("lugares: Isla Cristal tiene 6 lugares construidos desde ya; 3 con juego (empiezan más adelante) y 3 cerrados", () => {
  const ls = LUGARES_ISLA.filter((l) => l.isla === "cristal");
  assert.equal(ls.length, 6);
  const abiertos = Object.fromEntries(ls.filter((l) => !l.cerrado).map((l) => [l.juego.id, l.nivelInicial]));
  assert.deepEqual(abiertos, { "fabrica-numeros": 4, "sumas-restas": 7, "robot-palabras": 3 });
  assert.equal(ls.filter((l) => l.cerrado).length, 3);
  for (const l of ls) {
    assert.equal(l.id, `cristal:${l.sitio}`, "el id del lugar no choca con los de Isla Noli");
    assert.ok(l.punto.z > l.z, `${l.id}: la puerta mira a la cámara (+z), así siempre se ve`);
  }
});

test("lugares: abrir un lugar cerrado es solo datos (poner el juego y su nivel); un juego que no está en el catálogo queda cerrado", () => {
  const otro = JSON.parse(JSON.stringify(ISLAS));
  const c4 = otro.islas.find((i) => i.id === "cristal").construcciones.lugares.find((l) => l.id === "c4");
  Object.assign(c4, { juego: "huerto", nivelInicial: 3 });
  const l = lugaresIslas(armarConstrucciones(armarIslas(otro)), CATALOGO).find((x) => x.id === "cristal:c4");
  assert.equal(l.cerrado, false); assert.equal(l.juego.id, "huerto"); assert.equal(l.nivelInicial, 3);
  assert.deepEqual(revisarConstrucciones(otro, armarIslas(otro), CFG), []);
  const sinJuego = lugaresIslas(CONS, CATALOGO.filter((j) => j.id !== "sumas-restas")).find((x) => x.juego === null && x.sitio === "c2");
  assert.ok(sinJuego && sinJuego.cerrado, "sin el juego en el catálogo, el lugar se cierra (no truena)");
});

test("lugares: «Entrar a…» solo sale en la puerta de un lugar abierto (los cerrados no se ofrecen)", () => {
  const abiertos = LUGARES_ISLA.filter((l) => !l.cerrado);
  for (const l of LUGARES_ISLA) {
    const r = lugarCercano({ ...l.punto, y: 0 }, abiertos);
    if (l.cerrado) assert.equal(r, null, l.id); else assert.equal(r, l, l.id);
  }
});

// ---------- Caminar ----------

test("caminos: desde el puente de Isla Noli, de verdad caminando y sin brincar, se llega a la puerta de CADA lugar y a las otras salidas", () => {
  const mapa = mapaCompleto(), cam = caminosIsla(RED, CRISTAL, CFG);
  const llegada = salidasDe(RED, "cristal").find((s) => s.id === "noli-cristal");
  const destinos = [...LUGARES_ISLA.filter((l) => l.isla === "cristal").map((l) => ({ n: l.id, ...l.punto })),
    ...salidasDe(RED, "cristal").filter((s) => s.id !== "noli-cristal").map((s) => ({ n: s.id, ...s.adentro }))];
  for (const d of destinos) {
    assert.ok(!chocaEn(d.x, 0, d.z, mapa, CFG), `${d.n}: el punto está libre`);
    const r = rutaPorCaminos(cam, llegada.adentro, d);
    assert.ok(r, `ruta a ${d.n}`);
    const c = caminar(crearCuerpo(llegada.adentro.x, llegada.adentro.z), r, mapa);
    assert.ok(Math.hypot(c.x - d.x, c.z - d.z) < 0.35, `llegó caminando a ${d.n} (quedó a ${Math.hypot(c.x - d.x, c.z - d.z).toFixed(2)} m)`);
    assert.equal(c.y, 0, `${d.n}: sin subirse a nada`);
  }
});

test("caminos: desde el teletransportador también se llega a cada puerta, y el teletransportador queda libre", () => {
  const mapa = mapaCompleto(), cam = caminosIsla(RED, CRISTAL, CFG), t = teletransportadorDe(RED.por.get("cristal"));
  const ini = { x: t.x, z: t.z + 2.2 }; // donde aparece al viajar (vista.js → teletransportar)
  assert.ok(!chocaEn(ini.x, 0, ini.z, mapa, CFG) && !chocaEn(t.x, 0, t.z, mapa, CFG));
  for (const l of LUGARES_ISLA.filter((x) => x.isla === "cristal")) {
    const r = rutaPorCaminos(cam, ini, l.punto);
    assert.ok(r, `ruta a ${l.id}`);
    const c = caminar(crearCuerpo(ini.x, ini.z), r, mapa);
    assert.ok(Math.hypot(c.x - l.punto.x, c.z - l.punto.z) < 0.35, `llegó a ${l.id}`);
  }
});

test("caminos: cruzando el puente de cristal desde Isla Noli se entra a la isla sin chocar con la pared de la orilla", () => {
  const mapa = mapaCompleto(), k = RED.porCon.get("noli-cristal"), llegada = salidasDe(RED, "cristal").find((s) => s.id === "noli-cristal");
  const c = caminar(crearCuerpo(k.p0.x - k.dir.x, k.p0.z - k.dir.z), [{ ...k.p1 }, { ...llegada.lejos }], mapa, 30);
  assert.ok(Math.hypot(c.x - llegada.lejos.x, c.z - llegada.lejos.z) < 0.35, "llegó adentro de Isla Cristal");
});

// ---------- Cristales ----------

test("cristales: 15 en Isla Cristal, todos alcanzables (en el piso caminando; en las rocas con un brinco fácil)", () => {
  const cs = CRISTAL.cristales;
  assert.equal(cs.length, 15);
  const ids = [...cristalesDe(MUNDO), ...cristalesIslas(CONS)].map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, "ningún id repetido en todo el mundo");
  const mapa = mapaCompleto(), cam = caminosIsla(RED, CRISTAL, CFG);
  const llegada = salidasDe(RED, "cristal").find((s) => s.id === "noli-cristal").adentro;
  const todos = cristalesIslas(CONS);
  for (const k of cs) {
    if (!k.en) {
      const r = rutaPorCaminos(cam, llegada, k);
      assert.ok(r, `ruta al cristal ${k.id}`);
      const c = caminar(crearCuerpo(llegada.x, llegada.z), r, mapa);
      assert.equal(cristalTocado({ x: c.x, y: c.y, z: c.z }, todos, new Set()) && cristalTocado({ x: c.x, y: c.y, z: c.z }, todos, new Set()).id, k.id, `tomó ${k.id} caminando`);
      continue;
    }
    // En una roca: llegar caminando junto a ella y brincar hacia su centro
    const roca = CRISTAL.rocas.find((r) => r.id === k.en);
    assert.ok(roca.alto <= CFG.brinco * 0.85, `${roca.id}: un brinco fácil`);
    const junto = { x: roca.x, z: roca.z + roca.r + CFG.radio + 0.45 };
    const r = rutaPorCaminos(cam, llegada, junto);
    assert.ok(r, `ruta junto a ${roca.id}`);
    let c = caminar(crearCuerpo(llegada.x, llegada.z), r, mapa);
    for (let t = 0; t < 2; t += DT) {
      const dx = roca.x - c.x, dz = roca.z - c.z, d = Math.hypot(dx, dz);
      c = pasoFisico(c, { quiere: d > 0.15 ? { x: dx / d, z: dz / d } : { x: 0, z: 0 }, brincar: c.enSuelo && c.y < 0.01 && d < roca.r + 0.9 }, DT, CFG, mapa).c;
    }
    assert.ok(Math.abs(c.y - roca.alto) < 1e-6, `quedó arriba de ${roca.id} (y = ${c.y.toFixed(2)})`);
    const tocado = cristalTocado({ x: c.x, y: c.y, z: c.z }, todos, new Set());
    assert.equal(tocado && tocado.id, k.id, `tomó ${k.id}`);
  }
});

test("cristales: alcanzan para la siguiente conexión (lo que detiene a Noelia son las estrellas, nunca los cristales)", () => {
  const sobranDeNoli = MUNDO.cristales.length - RED.porCon.get("noli-cristal").costo.cristales;
  const siguientes = RED.conexiones.filter((k) => (k.de === "cristal" || k.a === "cristal") && k.id !== "noli-cristal");
  const caro = Math.max(...siguientes.map((k) => k.costo.cristales));
  assert.ok(CRISTAL.cristales.length + sobranDeNoli >= siguientes.reduce((s, k) => s + k.costo.cristales, 0), "alcanzan para todas las que salen de Cristal");
  assert.ok(CRISTAL.cristales.length >= caro);
});

// ---------- Costos y estrellas ----------

test("balance: con los juegos de Noli y de Cristal alcanzan las estrellas para la siguiente conexión (después del primer puente)", () => {
  const educativos = CATALOGO.filter((j) => j.creditos === "gana").map((j) => j.id);
  const deCristal = LUGARES_ISLA.filter((l) => l.isla === "cristal" && !l.cerrado && l.juego.creditos === "gana").map((l) => l.juego.id);
  assert.equal(deCristal.length, 3);
  const posibles = estrellasPosibles({ noli: educativos, cristal: deCristal }, ["noli", "cristal"], ISLAS.topeEstrellas);
  const siguientes = RED.conexiones.filter((k) => k.de === "cristal" || k.a === "cristal").filter((k) => k.id !== "noli-cristal");
  for (const k of siguientes) {
    assert.ok(k.costo && k.costo.estrellas >= ISLAS.costoMinimoEstrellas, `${k.id} tiene costo`);
    assert.ok(posibles - RED.porCon.get("noli-cristal").costo.estrellas >= k.costo.estrellas, `${k.id}: ${posibles} posibles`);
  }
});

test("estrellas: el mismo juego en Isla Cristal tiene su propio tope de 5", () => {
  let d = normalizar(null);
  d = sumarEstrellas(d, { juego: "sumas-restas", estrellas: 5, tope: 5 }).datos;
  const r = sumarEstrellas(d, { isla: "cristal", juego: "sumas-restas", estrellas: 3, tope: 5 });
  assert.equal(r.ganadas, 3);
  assert.equal(estrellasDeJuego(r.datos, "noli", "sumas-restas"), 5);
  assert.equal(estrellasDeJuego(r.datos, "cristal", "sumas-restas"), 3);
});

// ---------- Niveles (kit/niveles.js) ----------

test("niveles: el piso de la isla desbloquea hasta ahí, nunca baja lo ganado y en Isla Noli sigue el nivel de antes", () => {
  assert.equal(pisoDe(7, 12), 7); assert.equal(pisoDe(20, 8), 8, "acotado a los niveles del juego"); assert.equal(pisoDe(undefined, 8), 1);
  const pr = { nivel: 3, elegido: 2 };
  const p = conPiso(pr, 7);
  assert.deepEqual(p, { nivel: 7, elegido: 2 }, "desbloquea hasta el piso; lo escogido en Isla Noli no cambia");
  assert.equal(nivelNormal(p), 2, "en Isla Noli sigue en el 2");
  assert.equal(nivelActual(p, 7), 7, "en la isla empieza en el piso");
  assert.equal(conPiso({ nivel: 9, elegido: 9 }, 7).nivel, 9, "lo ganado no baja");
  assert.equal(nivelActual({ nivel: 9, elegido: 4 }, 7), 9, "en la isla: el más alto desbloqueado");
  assert.equal(nivelActual({ nivel: 9, elegido: 4 }, 7, 8), 8, "o el que escoja ahí");
  assert.equal(nivelActual({ nivel: 9, elegido: 4 }, 7, 3), 7, "nunca abajo del piso");
  assert.equal(conPiso(pr, 1), pr, "sin piso, el mismo objeto");
  assert.equal(nivelActual(pr, 1), 2);
  // Sin `elegido` guardado (Sumas y restas al principio): se guarda el que se jugaba
  assert.deepEqual(conPiso({ nivel: 3 }, 7), { nivel: 7, elegido: 3 });
  assert.ok(escogible({ nivel: 9 }, 7, 8) && !escogible({ nivel: 9 }, 7, 5) && !escogible({ nivel: 9 }, 7, 10));
  assert.deepEqual(trasRonda({ nivel: 7, elegido: 2 }, { nivel: 8, elegido: 8 }, 7), { nivel: 8, elegido: 2 }, "subir en la isla no cambia lo escogido en Isla Noli");
  assert.deepEqual(trasRonda({ nivel: 7, elegido: 2 }, { nivel: 8, elegido: 8 }, 1), { nivel: 8, elegido: 8 });
});

test("niveles: la URL lleva la isla y el nivel; el kit los lee (y sin isla es Isla Noli desde el principio)", () => {
  assert.equal(urlDeJuego("minijuegos/sumas-restas/index.html", { isla: "cristal", nivelInicial: 7 }), "minijuegos/sumas-restas/index.html?isla=cristal&nivel=7");
  assert.equal(urlDeJuego("minijuegos/x/index.html?a=1", { isla: "cristal", nivelInicial: 1 }), "minijuegos/x/index.html?a=1&isla=cristal");
  assert.equal(urlDeJuego("minijuegos/biblioteca/index.html", { hash: "#c3" }), "minijuegos/biblioteca/index.html#c3");
  assert.equal(urlDeJuego("minijuegos/x/index.html", { isla: "noli", nivelInicial: 5 }), "minijuegos/x/index.html");
  assert.deepEqual(deUrl("?isla=cristal&nivel=7"), { isla: "cristal", nivelInicial: 7 });
  assert.deepEqual(deUrl(""), { isla: "noli", nivelInicial: 1 });
  assert.deepEqual(deUrl("?isla=<script>&nivel=x"), { isla: "noli", nivelInicial: 1 });
});

test("niveles: los 3 juegos de Isla Cristal usan el piso de la isla (kit/niveles.js) y no guardan lo escogido ahí", () => {
  for (const id of ["sumas-restas", "fabrica-numeros", "robot-palabras"]) {
    const src = fs.readFileSync(new URL(`../minijuegos/${id}/src/juego.js`, import.meta.url), "utf8");
    assert.match(src, /from "\.\.\/\.\.\/\.\.\/kit\/niveles\.js"/, id);
    assert.match(src, /pisoDe\(Noli\.nivelInicial, NIVELES\.length\)/, id);
    assert.match(src, /conPiso\(/, `${id}: desbloquea el piso al cargar`);
    assert.match(src, /trasRonda\(/, `${id}: lo escogido en la isla no se guarda`);
    assert.match(src, /if \(PISO > 1\)/, `${id}: escoger un nivel en la isla no se guarda`);
  }
});

// ---------- La cámara y la escena ----------

test("cámara: las grutas y el cristal gigante cuentan para que la cámara se acerque", () => {
  const altos = altosIslas(CONS);
  assert.ok(altos.some((s) => s.id === "cristal:centro"));
  assert.equal(altos.filter((s) => s.id.startsWith("edificio:cristal:")).length, 6);
});

test("escena: los efectos caros (refracción, luces de colores) solo existen en calidad alta; todos los cristales son UNA malla", async () => {
  const { crearConstrucciones } = await import("../src/mundo/escena-construcciones.js");
  const c = crearConstrucciones(CRISTAL, RED.por.get("cristal"), LUGARES_ISLA.filter((l) => l.isla === "cristal"), { alta: false });
  const buscar = (f) => { const r = []; c.grupo.traverse((o) => { if (f(o)) r.push(o); }); return r; };
  const luces = () => buscar((o) => o.isPointLight && o.visible).length;
  const fisico = () => buscar((o) => o.isMesh && o.material && o.material.isMeshPhysicalMaterial).length;
  assert.equal(luces(), 0); assert.equal(fisico(), 0);
  c.efectos({ alta: true });
  assert.ok(luces() >= 2, "luces de colores en calidad alta"); assert.equal(fisico(), 1, "el cristal gigante con refracción");
  c.efectos({ alta: false });
  assert.equal(luces(), 0); assert.equal(fisico(), 0, "al bajar la calidad se apagan");
  assert.equal(buscar((o) => o.name === "cristales").length, 1, "todos los cristales en una malla");
  for (const l of LUGARES_ISLA.filter((x) => x.isla === "cristal")) assert.ok(c.marcas.has(l.id), `letrero de ${l.id}`);
  // Pocos dibujos: lo quieto se junta por material
  const mallas = buscar((o) => o.isMesh || o.isPoints).length;
  assert.ok(mallas < 40, `${mallas} mallas`);
  c.liberar();
});

test("escena: la pared de la orilla deja libre cada salida y lleva arcos en las del fondo y los lados", () => {
  for (const s of salidasDe(RED, "cristal")) {
    for (const r of CRISTAL.orilla) {
      const t = ((r.x - s.orilla.x) * s.dir.x + (r.z - s.orilla.z) * s.dir.z);
      const lado = Math.abs((r.x - s.orilla.x) * -s.dir.z + (r.z - s.orilla.z) * s.dir.x);
      if (t > -1 && t < 8) assert.ok(lado > 2.4 + r.r * 0.5, `${r.id} tapa ${s.id}`);
    }
  }
  assert.deepEqual(CRISTAL.arcos.map((a) => a.id).sort(), ["cristal-bosque", "cristal-dulce", "cristal-numeros"]);
  for (const r of CRISTAL.orilla) assert.ok(aOrilla(RED.por.get("cristal").f, r.x, r.z) > 0, `${r.id} dentro de la isla`);
  // Al frente (hacia la cámara) no hay pared: no tapa la vista
  const c = RED.por.get("cristal").c;
  for (const r of CRISTAL.orilla) assert.ok(r.z - c.z <= ISLAS.islas.find((i) => i.id === "cristal").construcciones.orilla.frenteDesde, `${r.id} al frente`);
});
