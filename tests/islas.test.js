// Pruebas de las islas del mundo (#164): datos, la red, estrellas del mundo, lo que se guarda y cómo se junta, y que
// cada puente se cruce caminando y cada camino de plataformas brincando de verdad (con la física del mundo).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { revisarIslas, armarIslas, vecinas, alcanzablesDesde, variosCaminos, normalizar, unirMundo, mismoMundo, sumarEstrellas,
  estrellasDeJuego, disponibles, puedeConstruir, construir, conVisita, estrellasPosibles, estadoRed, mapaIslas, limitesRed, islaEn,
  muelleEn, posPlataforma, solidoPlataforma, enTeletransportador, teletransportadorDe, vistaMapa, aOrilla, revisarSaltos, INICIO } from "../src/engine/islas.js";
import { fisicaDe } from "../src/engine/mundo.js";
import { pasoFisico, crearCuerpo, arrastre, hayPiso, alturaBajo, chocaEn } from "../kit/3d/fisica.js";
import { validarManifiesto } from "../src/engine/manifiesto.js";
import { seguirRuta } from "../kit/3d/movimiento.js";

const leer = (p) => JSON.parse(fs.readFileSync(new URL("../" + p, import.meta.url), "utf8"));
const MUNDO = leer("mundo/mundo.json"), ISLAS = leer("mundo/islas.json");
const CFG = fisicaDe(MUNDO);
const RED = armarIslas(ISLAS);
const CRISTALES = MUNDO.cristales.map((c) => c.id);
const CATALOGO = leer("minijuegos/catalogo.json").juegos.map((id) => validarManifiesto(leer(`minijuegos/${id}/juego.json`), id).juego);
const DT = 1 / 60;

// ---------- Datos y red ----------

test("islas: los datos de mundo/islas.json están bien", () => {
  assert.deepEqual(revisarIslas(ISLAS, MUNDO, CFG), []);
  assert.equal(RED.islas.length, 10);
});

test("islas: revisarIslas encuentra datos rotos", () => {
  const roto = JSON.parse(JSON.stringify(ISLAS));
  roto.conexiones.push({ id: "x", de: "noli", a: "no-existe", tipo: "puente", costo: null });
  assert.ok(revisarIslas(roto, MUNDO).some((e) => e.includes("no existen")));
  const barato = JSON.parse(JSON.stringify(ISLAS));
  barato.conexiones[0].costo = { cristales: 1, estrellas: 5 };
  assert.ok(revisarIslas(barato, MUNDO).some((e) => e.includes("lo mínimo es 20")), "cada conexión cuesta al menos 20 estrellas");
  const encimadas = JSON.parse(JSON.stringify(ISLAS));
  encimadas.islas.find((i) => i.id === "dulce").centro = { x: 0, z: -80 };
  assert.ok(revisarIslas(encimadas, MUNDO).some((e) => e.includes("encimadas")));
  const sinPuente = JSON.parse(JSON.stringify(ISLAS));
  for (const k of sinPuente.conexiones) if (k.a === "nubes" || k.de === "nubes") k.tipo = "plataformas";
  assert.ok(revisarIslas(sinPuente, MUNDO).some((e) => e.startsWith("nubes: no se llega solo con puentes")));
  const otraNoli = JSON.parse(JSON.stringify(ISLAS));
  otraNoli.islas[0].forma.z1 = 20;
  assert.ok(revisarIslas(otraNoli, MUNDO).some((e) => e.includes("mundo.limites")));
});

test("red: es una red, no una cadena; solo con puentes (sin brincar) se llega a todas, y hay varios caminos al final", () => {
  for (const i of RED.islas) assert.ok(vecinas(RED, i.id).length >= 2, `${i.id} tiene una sola conexión`);
  assert.ok(RED.islas.filter((i) => vecinas(RED, i.id).length >= 3).length >= 5, "varias islas conectan con tres o más");
  assert.equal(alcanzablesDesde(RED, INICIO, (k) => k.tipo === "puente").size, 10);
  assert.ok(variosCaminos(RED, "noli", "nubes"), "quitando cualquier conexión todavía se llega a las Nubes");
  assert.ok(RED.conexiones.some((k) => k.tipo === "plataformas" && k.moviles), "hay caminos con plataformas que se mueven");
  assert.ok(RED.conexiones.some((k) => k.tipo === "plataformas" && !k.moviles));
});

test("red: el primer puente (Noli → Cristal) es de cristal y cuesta 5 cristales y 20 estrellas; los que salen de Cristal (#176) tienen costo; los demás, muy pronto", () => {
  const k = RED.porCon.get("noli-cristal");
  assert.equal(k.tipo, "puente"); assert.equal(k.material, "cristal");
  assert.deepEqual(k.costo, { cristales: 5, estrellas: 20 });
  assert.ok(CRISTALES.length >= 5, "Isla Noli tiene los cristales del primer puente");
  assert.deepEqual(RED.porCon.get("cristal-dulce").costo, { cristales: 5, estrellas: 25 });
  assert.deepEqual(RED.porCon.get("cristal-bosque").costo, { cristales: 5, estrellas: 25 });
  assert.deepEqual(RED.porCon.get("cristal-numeros").costo, { cristales: 5, estrellas: 20 });
  const conCosto = new Set(["noli-cristal", "cristal-dulce", "cristal-bosque", "cristal-numeros"]);
  for (const o of RED.conexiones) if (!conCosto.has(o.id)) assert.equal(o.costo, null, o.id);
});

test("balance: las estrellas que dan los juegos de Isla Noli alcanzan para el primer puente", () => {
  const educativos = CATALOGO.filter((j) => j.creditos === "gana").map((j) => j.id);
  const posibles = estrellasPosibles({ noli: educativos }, ["noli"], ISLAS.topeEstrellas);
  assert.ok(posibles >= RED.porCon.get("noli-cristal").costo.estrellas, `${posibles} estrellas posibles`);
  // Y obliga a usar varios juegos: con uno solo no alcanza
  assert.ok(ISLAS.topeEstrellas < RED.porCon.get("noli-cristal").costo.estrellas);
});

// ---------- Estrellas del mundo ----------

test("estrellas: suman hasta 5 por isla y juego, y no pasan de ahí", () => {
  let d = normalizar(null);
  let r = sumarEstrellas(d, { juego: "sumas-restas", estrellas: 3, tope: 5 });
  assert.equal(r.ganadas, 3); d = r.datos;
  r = sumarEstrellas(d, { juego: "sumas-restas", estrellas: 3, tope: 5 });
  assert.equal(r.ganadas, 2, "solo hasta el tope"); d = r.datos;
  r = sumarEstrellas(d, { juego: "sumas-restas", estrellas: 3, tope: 5 });
  assert.equal(r.ganadas, 0); assert.equal(r.datos, d, "sin cambios, el mismo objeto");
  assert.equal(estrellasDeJuego(d, "noli", "sumas-restas"), 5);
  // Otro juego, y el mismo juego en otra isla, tienen su propio tope
  d = sumarEstrellas(d, { juego: "spelling", estrellas: 2, tope: 5 }).datos;
  d = sumarEstrellas(d, { isla: "numeros", juego: "sumas-restas", estrellas: 3, tope: 5 }).datos;
  assert.equal(estrellasDeJuego(d, "numeros", "sumas-restas"), 3);
  assert.equal(disponibles(d, RED, CRISTALES).estrellas, 10);
});

// ---------- Construir ----------

test("construir: hacen falta cristales y estrellas; se gastan los dos; no se construye dos veces", () => {
  let d = normalizar({ v: 1, cristales: CRISTALES.slice(0, 4) });
  const darEstrellas = (d, juegos) => juegos.reduce((x, j) => sumarEstrellas(x, { juego: j, estrellas: 5, tope: 5 }).datos, d);
  let p = puedeConstruir(d, RED, "noli-cristal", CRISTALES);
  assert.deepEqual(p.faltan, { cristales: 1, estrellas: 20 }); assert.equal(p.ok, false);
  d = darEstrellas(d, ["a", "b", "c"]);
  assert.deepEqual(puedeConstruir(d, RED, "noli-cristal", CRISTALES).faltan, { cristales: 1, estrellas: 5 });
  d = darEstrellas({ ...d, cristales: CRISTALES }, ["d", "e"]);
  assert.equal(puedeConstruir(d, RED, "noli-cristal", CRISTALES).ok, true);
  const h = construir(d, RED, "noli-cristal", CRISTALES);
  assert.deepEqual(h.conexiones, ["noli-cristal"]);
  assert.deepEqual(disponibles(h, RED, CRISTALES), { cristales: CRISTALES.length - 5, estrellas: 25 - 20 }, "se gastaron");
  assert.equal(puedeConstruir(h, RED, "noli-cristal", CRISTALES).hecha, true);
  assert.equal(construir(h, RED, "noli-cristal", CRISTALES), null, "no dos veces");
  // Sin costo todavía: muy pronto
  assert.equal(puedeConstruir(h, RED, "dulce-pasarela", CRISTALES).pronto, true);
  // Las estrellas gastadas ya no sirven para otro puente (se resta lo de las construidas)
  assert.equal(disponibles(h, RED, CRISTALES).estrellas, 5);
});

// ---------- Guardar y juntar ----------

test("guardado: v1 → v2, Noli siempre visitada; visitar marca la isla y la última", () => {
  const d = normalizar({ v: 1, cristales: ["c-fuente", "c-fuente", 3] });
  assert.equal(d.v, 2); assert.deepEqual(d.cristales, ["c-fuente"]); assert.deepEqual(d.visitadas, ["noli"]);
  assert.deepEqual(d.conexiones, []); assert.deepEqual(d.estrellas, { dadas: {} });
  const e = conVisita(d, "cristal");
  assert.deepEqual(e.visitadas, ["noli", "cristal"]); assert.equal(e.ultimaIsla, "cristal");
  assert.equal(conVisita(e, "cristal"), e, "sin cambios, el mismo objeto");
});

test("juntar: dos aparatos sin conexión no pierden ni duplican nada; el administrador (rev) gana", () => {
  const base = normalizar({ cristales: ["c-fuente"] });
  const a = { ...sumarEstrellas(base, { juego: "spelling", estrellas: 3, tope: 5 }).datos, conexiones: ["noli-cristal"], visitadas: ["noli", "cristal"] };
  const b = { ...sumarEstrellas(base, { juego: "spelling", estrellas: 5, tope: 5 }).datos, cristales: ["c-fuente", "c-hongos"], conexiones: ["noli-cristal"] };
  const u = unirMundo(a, b);
  assert.deepEqual(u.cristales.sort(), ["c-fuente", "c-hongos"]);
  assert.deepEqual(u.visitadas.sort(), ["cristal", "noli"]);
  assert.deepEqual(u.conexiones, ["noli-cristal"], "el mismo puente construido en los dos: se cobra una vez");
  assert.equal(estrellasDeJuego(u, "noli", "spelling"), 5, "el máximo, no la suma");
  assert.ok(mismoMundo(u, unirMundo(b, a)), "no importa el orden");
  const admin = { ...normalizar({}), rev: 1 };
  assert.ok(mismoMundo(unirMundo(admin, a), admin), "lo que sobrescribió el administrador gana");
  assert.ok(!mismoMundo(a, b));
});

// ---------- Mapa ----------

test("mapa: visitadas completas, sus vecinas con «?», las demás tapadas; las conexiones que se ven y las hechas", () => {
  const v = vistaMapa(RED, normalizar({}));
  assert.equal(v.islas.noli, "visitada");
  for (const id of vecinas(RED, "noli")) assert.equal(v.islas[id], "vista", id);
  assert.equal(v.islas.nubes, "oculta");
  assert.equal(v.conexiones["noli-cristal"], "vista");
  assert.equal(v.conexiones["numeros-nubes"], "oculta");
  const w = vistaMapa(RED, { visitadas: ["noli", "cristal"], conexiones: ["noli-cristal"] });
  assert.equal(w.conexiones["noli-cristal"], "hecha"); assert.equal(w.islas.numeros, "vista");
  assert.ok(Object.values(vistaMapa(RED, {}, { todo: true }).islas).every((x) => x === "visitada"));
});

// ---------- Física: cruzar ----------

/** El mapa de choques de las islas, sin Isla Noli por dentro (aquí solo importan orillas, puentes y plataformas) */
function mapaDe(datos, op) {
  const e = estadoRed(RED, datos, op), m = mapaIslas(RED, e);
  return { solidos: m.solidos, zonas: m.zonas, limites: limitesRed(RED), estado: e };
}

/** Camina de una isla a la otra por una conexión (brincando de plataforma en plataforma); regresa el cuerpo y si llegó */
function cruzar(k, mapa, { desde = k.p0, dir = k.dir, haciaIsla = k.a } = {}) {
  let c = crearCuerpo(desde.x - dir.x * 3, desde.z - dir.z * 3);
  const meta = RED.por.get(haciaIsla).f;
  const plats = (k.plataformas || []).slice();
  if (dir !== k.dir) plats.reverse();
  const solidos = new Map(mapa.solidos.filter((s) => s.plataforma).map((s) => [s.id, s]));
  let t = 0, i = 0, cayo = false;
  const mover = () => { // las plataformas que se mueven, como lo hace la vista
    for (const s of solidos.values()) {
      const p = s.plataforma, q = posPlataforma(p, t);
      s.mov = { dx: q.x - s.x, dz: q.z - s.z }; s.x = q.x; s.z = q.z;
    }
  };
  for (let n = 0; n < 60 * 120 && aOrilla(meta, c.x, c.z) < 2; n++) {
    t += DT; mover();
    const a = arrastre(c, mapa, CFG);
    if ((a.dx || a.dz) && !chocaEn(c.x + a.dx, c.y, c.z + a.dz, mapa, CFG)) c = { ...c, x: c.x + a.dx, z: c.z + a.dz };
    let objetivo, brincar = false;
    if (i < plats.length) {
      const s = solidos.get(plats[i].id), est = posPlataforma(plats[i], t);
      objetivo = { x: s.x, z: s.z };
      const sep = Math.hypot(c.x - s.x, c.z - s.z) - s.r - CFG.radio;
      // Espera en su lugar a que la siguiente se quede quieta en una punta; luego camina y brinca ya junto a la orilla
      if (!est.quieta && sep > 0.4) objetivo = null;
      // Brinca ya junto a la orilla de la plataforma, o al llegar a la orilla de donde está (como lo haría Noelia)
      const adelante = objetivo ? alturaBajo(c.x + (s.x - c.x) / (Math.hypot(s.x - c.x, s.z - c.z) || 1) * 0.3, c.z + (s.z - c.z) / (Math.hypot(s.x - c.x, s.z - c.z) || 1) * 0.3, c.y + 0.01, mapa, CFG) : c.y;
      brincar = (c.enSuelo || c.coyote > 0) && Math.abs(c.y - s.y1) > 1e-6 && (sep < 0.35 || adelante < c.y - 0.05);
      if (c.enSuelo && Math.abs(c.y - s.y1) < 1e-6 && Math.hypot(c.x - s.x, c.z - s.z) < s.r * 0.5) i++;
    } else objetivo = { x: (dir === k.dir ? k.p1 : k.p0).x + dir.x * 4, z: (dir === k.dir ? k.p1 : k.p0).z + dir.z * 4 };
    let q = { x: 0, z: 0 };
    if (objetivo) { const dx = objetivo.x - c.x, dz = objetivo.z - c.z, d = Math.hypot(dx, dz); if (d > 0.1) q = { x: dx / d, z: dz / d }; }
    // Del último brinco a la orilla: brincar cuando ya no hay plataforma debajo hacia adelante
    if (i >= plats.length && plats.length && c.enSuelo && c.y > 0.1) {
      const s = solidos.get(plats[plats.length - 1].id);
      if (Math.hypot(c.x - s.x, c.z - s.z) > s.r - 0.3) brincar = true;
    }
    c = pasoFisico(c, { quiere: q, brincar }, DT, CFG, mapa).c;
    if (c.y < -1) { cayo = true; break; }
  }
  return { c, llego: !cayo && aOrilla(meta, c.x, c.z) >= 2 && c.y >= -1e-6, cayo };
}

test("física: en el mar no hay piso (se cae); en las islas, los puentes y los muelles sí", () => {
  const m = mapaDe({ visitadas: ["noli"], conexiones: ["noli-cristal"] });
  assert.ok(hayPiso(0, 0, m, CFG), "Isla Noli");
  assert.ok(hayPiso(0, -45, m, CFG), "el puente de cristal");
  assert.ok(!hayPiso(0, -100 + 50, m, CFG) || hayPiso(0, -50, m, CFG));
  assert.ok(!hayPiso(-20, -45, m, CFG), "el mar");
  assert.ok(alturaBajo(-20, -45, 1, m, CFG) < -10);
  let c = crearCuerpo(-34, -20);
  for (let n = 0; n < 120; n++) c = pasoFisico(c, { quiere: { x: -1, z: 0 } }, DT, CFG, m).c;
  assert.ok(c.y < -1, "caminar fuera de la orilla: cae al agua");
});

test("física: cada puente construido se cruza caminando, sin brincar, y sus barandales no dejan caer", () => {
  const m = mapaDe({ visitadas: RED.islas.map((i) => i.id) }, { todas: true });
  for (const k of RED.conexiones.filter((x) => x.tipo === "puente")) {
    const r = cruzar(k, m);
    assert.ok(r.llego, `${k.id}: no llegó a ${k.a}`);
    // Empujando de lado a mitad del puente, no se cae
    const mid = { x: (k.p0.x + k.p1.x) / 2, z: (k.p0.z + k.p1.z) / 2 };
    let c = crearCuerpo(mid.x, mid.z);
    for (let n = 0; n < 120; n++) c = pasoFisico(c, { quiere: { x: k.lado.x, z: k.lado.z } }, DT, CFG, m).c;
    assert.ok(c.y > -0.01 && hayPiso(c.x, c.z, m, CFG), `${k.id}: se cayó por el barandal`);
  }
});

test("física: sin construir no se cruza: el muelle llega hasta su punta y ahí se detiene", () => {
  const m = mapaDe({ visitadas: ["noli"] });
  const k = RED.porCon.get("noli-cristal");
  assert.ok(m.estado.muelles.some((x) => x.id === "noli-cristal"));
  let c = crearCuerpo(k.p0.x - k.dir.x * 3, k.p0.z - k.dir.z * 3);
  for (let n = 0; n < 60 * 8; n++) c = pasoFisico(c, { quiere: k.dir }, DT, CFG, m).c;
  assert.ok(c.y > -0.01, "no se cae por la punta");
  assert.ok(muelleEn(m.estado, c.x, c.z), "se queda en el muelle");
  assert.equal(islaEn(RED, c.x, c.z), null);
});

test("física: cada camino de plataformas se cruza brincando de verdad, también las que se mueven (y lleva al personaje)", () => {
  const m = mapaDe({ visitadas: RED.islas.map((i) => i.id) }, { todas: true });
  for (const k of RED.conexiones.filter((x) => x.tipo === "plataformas")) {
    assert.deepEqual(revisarSaltos(k, CFG), [], k.id);
    const ida = cruzar(k, m);
    assert.ok(ida.llego, `${k.id}: no llegó a ${k.a}${ida.cayo ? " (se cayó)" : ""}`);
    const vuelta = cruzar(k, m, { desde: k.p1, dir: { x: -k.dir.x, z: -k.dir.z }, haciaIsla: k.de });
    assert.ok(vuelta.llego, `${k.id}: no regresó a ${k.de}${vuelta.cayo ? " (se cayó)" : ""}`);
  }
  // Parado en una que se mueve, el personaje se mueve con ella
  const k = RED.conexiones.find((x) => x.moviles), p = k.plataformas.find((x) => x.mueve);
  const s = solidoPlataforma(p); s.mov = { dx: 0.05, dz: -0.02 };
  const c = { ...crearCuerpo(p.x, p.z, 0, p.alto), enSuelo: true };
  assert.deepEqual(arrastre(c, { solidos: [s] }, CFG), { dx: 0.05, dz: -0.02 });
  assert.deepEqual(arrastre({ ...c, enSuelo: false }, { solidos: [s] }, CFG), { dx: 0, dz: 0 });
});

test("plataformas que se mueven: van y vienen de lado, con una pausa en cada punta", () => {
  const p = RED.conexiones.find((x) => x.moviles).plataformas.find((x) => x.mueve);
  const { periodo, distancia } = p.mueve;
  let min = Infinity, max = -Infinity, quietas = 0, n = 0;
  for (let t = 0; t < periodo; t += 0.05, n++) {
    const q = posPlataforma(p, t);
    const off = (q.x - p.x) * p.mueve.ex + (q.z - p.z) * p.mueve.ez;
    min = Math.min(min, off); max = Math.max(max, off);
    if (q.quieta) quietas++;
  }
  assert.ok(Math.abs(max - min - distancia) < 0.01);
  assert.ok(quietas / n > 0.3, "hay pausas para subirse sin prisa");
  const fija = RED.conexiones.find((x) => x.tipo === "plataformas" && !x.moviles).plataformas[0];
  assert.deepEqual(posPlataforma(fija, 3), { x: fija.x, z: fija.z, quieta: true });
});

// ---------- Teletransportador ----------

test("teletransportador: uno en cada isla, lejos de la orilla; se detecta parado encima", () => {
  for (const i of RED.islas) {
    const t = teletransportadorDe(i);
    assert.ok(aOrilla(i.f, t.x, t.z) > 3, i.id);
    assert.equal(enTeletransportador(RED, { x: t.x + 0.5, y: 0, z: t.z }), i);
  }
  assert.equal(enTeletransportador(RED, { x: 0, y: 0, z: 0 }), null);
});

test("islas: el tope de estrellas de islas.json es el mismo que usa el catálogo", async () => {
  const { TOPE_ESTRELLAS } = await import("../src/engine/islas.js");
  assert.equal(ISLAS.topeEstrellas, TOPE_ESTRELLAS);
});

// ---------- Isla Noli: se llega caminando a cada salida y al teletransportador ----------

test("Isla Noli: de la plaza se llega caminando a la entrada de cada puente y al teletransportador; ahí no hay árboles", async () => {
  const { colocarLugares, decorar, todosLosSitios, mapaMundo, crearCaminos, rutaPorCaminos, puntoLibre } = await import("../src/engine/mundo.js");
  const { salidasNoli, libresNoli } = await import("../src/engine/islas.js");
  const LUGARES = leer("mundo/lugares.json");
  const todos = todosLosSitios(LUGARES);
  const libres = libresNoli(RED);
  const deco = decorar(MUNDO, todos, libres);
  const mapa = mapaMundo(MUNDO, todos, deco); // edificios en TODOS los sitios
  const salidas = salidasNoli(RED), t = teletransportadorDe(RED.por.get("noli"));
  assert.equal(salidas.length, 3);
  const extra = [...salidas.map((s) => s.adentro), ...salidas.map((s) => s.lejos), t];
  const caminos = crearCaminos(MUNDO, todos, mapa, CFG, extra);
  for (const p of [...salidas.map((s) => s.adentro), t]) {
    assert.ok(puntoLibre(p, mapa, CFG), `(${p.x.toFixed(1)}, ${p.z.toFixed(1)}) está ocupado`);
    const r = rutaPorCaminos(caminos, { x: 0, z: 2 }, p);
    assert.ok(r, `no hay ruta a (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`);
    // Seguir la ruta con la física de verdad
    let c = crearCuerpo(0, 2), ruta = r;
    for (let n = 0; n < 60 * 40 && ruta.length; n++) {
      const s2 = seguirRuta(c, ruta); ruta = s2.ruta;
      c = pasoFisico(c, { quiere: s2.quiere }, DT, CFG, mapa).c;
    }
    assert.ok(Math.hypot(c.x - p.x, c.z - p.z) < 0.5, `no llegó caminando a (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`);
  }
  for (const a of deco.arboles) for (const s of libres.segmentos) {
    const vx = s.b.x - s.a.x, vz = s.b.z - s.a.z, l2 = vx * vx + vz * vz;
    const u = Math.max(0, Math.min(1, ((a.x - s.a.x) * vx + (a.z - s.a.z) * vz) / l2));
    assert.ok(Math.hypot(a.x - (s.a.x + vx * u), a.z - (s.a.z + vz * u)) >= s.r, "un árbol en el pasillo de un puente");
  }
});

// ---------- El mapa ilustrado de Petra (#165) ----------

test("mapa ilustrado: existe la imagen, cada isla sabe dónde está en el dibujo y el personaje se ubica en él", async () => {
  const { puntoMapa } = await import("../src/engine/islas.js");
  assert.ok(fs.existsSync(new URL("../mundo/" + ISLAS.mapa.imagen, import.meta.url)), "falta la imagen del mapa");
  for (const i of RED.islas) assert.ok(i.mapa && i.mapa.u > 0 && i.mapa.u < 1 && i.mapa.v > 0 && i.mapa.v < 1, i.id);
  // Arriba en el dibujo = al fondo del mundo: las Nubes arriba de todo, Noli abajo
  const v = (id) => RED.por.get(id).mapa.v;
  assert.ok(v("nubes") < v("numeros") && v("numeros") < v("cristal") && v("cristal") < v("noli"));
  const cerca = (p, q, tol = 0.02) => Math.abs(p.u - q.u) < tol && Math.abs(p.v - q.v) < tol;
  const noli = RED.por.get("noli"), cris = RED.por.get("cristal");
  assert.ok(cerca(puntoMapa(RED, noli.c.x, noli.c.z), noli.mapa), "en el centro de Noli");
  assert.ok(cerca(puntoMapa(RED, cris.c.x, cris.c.z), cris.mapa), "en el centro de Cristal");
  // A medio puente: entre las dos islas del dibujo
  const k = RED.porCon.get("noli-cristal"), m = puntoMapa(RED, (k.p0.x + k.p1.x) / 2, (k.p0.z + k.p1.z) / 2);
  assert.ok(m.v < noli.mapa.v && m.v > cris.mapa.v, "a medio puente");
  // En el mar, junto a una isla: no se sale del dibujo
  const p = puntoMapa(RED, 500, 500);
  assert.ok(p.u >= 0 && p.u <= 1 && p.v >= 0 && p.v <= 1);
});
