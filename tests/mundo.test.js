// Pruebas del mundo del menú principal (#25): datos, lugares, choques, brincos, plataformas, cristales, "Ir a…" y la
// elección entre el mundo 3D y el menú 2D. Todo es lógica pura (src/engine/mundo.js y kit/3d/fisica.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { revisarMundo, colocarLugares, mapaMundo, fisicaDe, decorar, todosLosSitios, lugarCercano, cristalesDe, cristalTocado,
  crearCaminos, rutaPorCaminos, puntoLibre, plataformasAlcanzables, elegirVista, solidoDe, centroSitio, acomodarLetreros, brazoCamara } from "../src/engine/mundo.js";
import { pasoFisico, crearCuerpo, chocaEn, alturaBajo, alcanzables, separacion, centro, FISICA } from "../kit/3d/fisica.js";
import { validarManifiesto, jugableEn } from "../src/engine/manifiesto.js";
import { seguirRuta, crearPulsador } from "../kit/3d/movimiento.js";

const leer = (p) => JSON.parse(fs.readFileSync(new URL("../" + p, import.meta.url), "utf8"));
const MUNDO = leer("mundo/mundo.json"), LUGARES = leer("mundo/lugares.json");
const CATALOGO = leer("minijuegos/catalogo.json").juegos.map((id) => validarManifiesto(leer(`minijuegos/${id}/juego.json`), id).juego);
const CFG = fisicaDe(MUNDO);

function armar(juegos = CATALOGO) {
  const lugares = colocarLugares(juegos, LUGARES);
  const todos = todosLosSitios(LUGARES);
  const deco = decorar(MUNDO, todos);
  // Para probar caminos se ponen edificios en TODOS los sitios (así un juego nuevo nunca cae en un sitio encerrado)
  const mapa = mapaMundo(MUNDO, todos, deco);
  return { lugares, todos, deco, mapa };
}

// Corre la física: mantiene una dirección y brinca en el primer cuadro (si `brincar`). Regresa el cuerpo al final.
function simular(c, dir, segundos, mapa, { brincar = false, dt = 1 / 60 } = {}) {
  for (let t = 0, i = 0; t < segundos; t += dt, i++) c = pasoFisico(c, { quiere: dir, brincar: brincar && i === 0 }, dt, CFG, mapa).c;
  return c;
}

// ---------- Datos ----------

test("mundo: los datos de mundo/ están bien", () => {
  assert.deepEqual(revisarMundo(MUNDO, LUGARES), []);
});

test("mundo: revisarMundo encuentra datos rotos", () => {
  const malo = { ...MUNDO, plataformas: [...MUNDO.plataformas, { id: "fuente", forma: "triangulo", x: 0, z: 0, alto: 1 }],
    rutas: [{ id: "x", plataformas: ["no-existe"] }], cristales: [{ id: "c", en: "tampoco" }] };
  const e = revisarMundo(malo, { ...LUGARES, juegos: { x: { sitio: "luna", edificio: "cohete" } } });
  for (const t of ["repetida", "forma", "no-existe", "tampoco", "luna", "cohete"]) assert.ok(e.some((m) => m.includes(t)), t);
});

test("manifiesto: \"lugar\" es opcional y se valida", () => {
  const base = { id: "x", titulo: "X" };
  assert.equal(validarManifiesto(base, "x").juego.lugar, null);
  assert.equal(validarManifiesto({ ...base, lugar: "torre" }, "x").juego.lugar, "torre");
  assert.ok(validarManifiesto({ ...base, lugar: "Mi Torre!" }, "x").errores);
});

// ---------- Lugares ----------

test("lugares: cada juego del catálogo tiene su lugar (si no alcanzan los sitios, agrega más en lugares.json)", () => {
  for (const modo of ["tactil", "tv"]) {
    const juegos = CATALOGO.filter((j) => jugableEn(j, modo));
    const { lugares } = armar(juegos);
    assert.equal(lugares.length, juegos.length, `modo ${modo}`);
    assert.equal(new Set(lugares.map((l) => l.sitio)).size, lugares.length, "un juego por sitio");
  }
  assert.ok(LUGARES.sitios.length >= CATALOGO.length + 3, "quedan sitios libres para juegos nuevos");
});

test("lugares: los asignados van en su sitio con su edificio; uno nuevo cae en el siguiente sitio libre con un portal", () => {
  const { lugares } = armar();
  const por = Object.fromEntries(lugares.map((l) => [l.id, l]));
  assert.equal(por["sumas-restas"].edificio, "torre");
  assert.equal(por.spelling.edificio, "arbol");
  assert.equal(por.pasarela.edificio, "escenario");
  assert.equal(por.pasarela.sitio, "norte");
  assert.equal(por.ejemplo.edificio, "portal");
  const nuevo = { id: "nuevo", titulo: "Nuevo", controles: ["tactil"] };
  const conNuevo = colocarLugares([...CATALOGO, nuevo, { ...nuevo, id: "con-torre", lugar: "torre" }, { ...nuevo, id: "raro", lugar: "cohete" }], LUGARES);
  const n = conNuevo.find((l) => l.id === "nuevo");
  assert.equal(n.edificio, "portal");
  assert.ok(!lugares.some((l) => l.sitio === n.sitio), "sitio libre");
  assert.equal(conNuevo.find((l) => l.id === "con-torre").edificio, "torre", "el \"lugar\" del juego.json");
  assert.equal(conNuevo.find((l) => l.id === "raro").edificio, "portal", "edificio que no existe → portal");
});

test("lugares: más juegos que sitios → los que no caben no salen (no truena)", () => {
  const muchos = Array.from({ length: LUGARES.sitios.length + 3 }, (_, i) => ({ id: "j" + i, titulo: "J" }));
  assert.equal(colocarLugares(muchos, LUGARES).length, LUGARES.sitios.length);
});

test("lugares: la puerta queda entre el edificio y la plaza, mirando al edificio", () => {
  for (const l of todosLosSitios(LUGARES)) {
    assert.ok(Math.hypot(l.punto.x, l.punto.z) < Math.hypot(l.x, l.z), l.id);
    const dir = { x: -Math.sin(l.mira * Math.PI / 180), z: -Math.cos(l.mira * Math.PI / 180) }; // kit/3d/movimiento.js → direccion
    const hacia = { x: l.x - l.punto.x, z: l.z - l.punto.z }, d = Math.hypot(hacia.x, hacia.z);
    assert.ok(dir.x * hacia.x / d + dir.z * hacia.z / d > 0.99, `${l.id} mira al edificio`);
    // Todos los sitios están hacia el fondo o a los lados (la cámara mira a −z: un edificio "detrás" de la cámara no se vería)
    assert.ok(l.z < l.punto.z + 0.01 || Math.abs(l.x) > Math.abs(l.punto.x), `${l.id} se ve desde su puerta`);
  }
});

test("lugares: lugarCercano solo en la puerta y con los pies en el piso", () => {
  const { lugares } = armar();
  const l = lugares[0];
  assert.equal(lugarCercano({ ...l.punto, y: 0 }, lugares), l);
  assert.equal(lugarCercano({ ...l.punto, y: 1.5 }, lugares), null);
  assert.equal(lugarCercano({ x: MUNDO.inicio.x, z: MUNDO.inicio.z, y: 0 }, lugares), null);
});

// ---------- Que nada estorbe ----------

test("caminos: el inicio y todas las puertas están libres, y de la plaza se llega caminando a CADA sitio (sin brincar)", () => {
  const { todos, mapa } = armar();
  assert.ok(puntoLibre(MUNDO.inicio, mapa, CFG), "inicio");
  const caminos = crearCaminos(MUNDO, todos, mapa, CFG);
  for (const s of todos) {
    assert.ok(puntoLibre(s.punto, mapa, CFG), `puerta de ${s.sitio}`);
    const r = rutaPorCaminos(caminos, MUNDO.inicio, s.punto);
    assert.ok(r, `ruta a ${s.sitio}`);
    // Y caminando de verdad (con la física, siguiendo la ruta) se llega
    let c = crearCuerpo(MUNDO.inicio.x, MUNDO.inicio.z), ruta = r;
    for (let i = 0; i < 60 * 20 && ruta.length; i++) {
      const s2 = seguirRuta(c, ruta); ruta = s2.ruta;
      c = pasoFisico(c, { quiere: s2.quiere }, 1 / 60, CFG, mapa).c;
    }
    assert.ok(Math.hypot(c.x - s.punto.x, c.z - s.punto.z) < 0.3, `llegó caminando a ${s.sitio}`);
    assert.equal(c.y, 0, "sin subirse a nada");
  }
});

test("caminos: de una puerta a otra también hay ruta", () => {
  const { todos, mapa } = armar();
  const caminos = crearCaminos(MUNDO, todos, mapa, CFG);
  for (const a of todos) for (const b of todos) if (a !== b) assert.ok(rutaPorCaminos(caminos, a.punto, b.punto), `${a.sitio} → ${b.sitio}`);
});

test("decoración: siempre igual (semilla), y ningún árbol en la plaza, un camino, una plataforma o una puerta", () => {
  const { todos, deco } = armar();
  assert.deepEqual(decorar(MUNDO, todos), deco, "misma semilla, mismo mundo");
  assert.ok(deco.arboles.length > 30, `${deco.arboles.length} árboles`);
  assert.ok(deco.flores.length > 20 && deco.hongos.length > 5);
  for (const a of deco.arboles) {
    assert.ok(Math.hypot(a.x, a.z) > MUNDO.plaza.radio, "fuera de la plaza");
    for (const s of todos) assert.ok(Math.hypot(a.x - s.punto.x, a.z - s.punto.z) > 1.5, "lejos de las puertas");
  }
});

test("plataformas: no se enciman con edificios y ninguna tapa una puerta", () => {
  const { todos } = armar();
  for (const p of MUNDO.plataformas.map(solidoDe)) {
    for (const s of todos) {
      assert.ok(separacion(p, { tipo: "cilindro", x: s.x, z: s.z, r: s.radioChoque }) > 0.8, `${p.id} vs ${s.sitio}`);
      assert.ok(separacion(p, { tipo: "cilindro", x: s.punto.x, z: s.punto.z, r: s.radio }) > 0, `${p.id} tapa la puerta de ${s.sitio}`);
    }
  }
});

// ---------- Física ----------

const PISO = { solidos: [], limites: MUNDO.limites };

test("física: camina, se detiene y gira hacia donde va", () => {
  let c = crearCuerpo(0, 0);
  c = simular(c, { x: 1, z: 0 }, 1, PISO);
  assert.ok(Math.abs(c.x - CFG.velocidad) < 0.1, `x = ${c.x}`);
  assert.ok(Math.abs(c.ang - -90) < 1, "mira a la derecha");
  const quieto = simular(c, { x: 0, z: 0 }, 0.5, PISO);
  assert.equal(quieto.x, c.x);
});

test("física: brinca la altura configurada y vuelve al piso", () => {
  let c = crearCuerpo(0, 0), max = 0;
  for (let i = 0; i < 60; i++) { c = pasoFisico(c, { quiere: { x: 0, z: 0 }, brincar: i === 0 }, 1 / 60, CFG, PISO).c; max = Math.max(max, c.y); }
  assert.ok(Math.abs(max - CFG.brinco) < 0.08, `subió ${max}`);
  assert.equal(c.y, 0); assert.ok(c.enSuelo);
});

test("pulsador: una tecla que se repite (mantener apretado) cuenta como un solo brinco", () => {
  const p = crearPulsador(250);
  assert.equal(p(1000), true);
  assert.equal(p(1033), false, "repetición de la tecla");
  assert.equal(p(1066), false);
  assert.equal(p(1500), true, "se soltó y se volvió a apretar");
});

test("física: brincar en el aire no hace nada (sin brincos infinitos)", () => {
  let c = simular(crearCuerpo(0, 0), { x: 0, z: 0 }, 0.2, PISO, { brincar: true });
  const y = c.y, vy = c.vy;
  c = pasoFisico(c, { quiere: { x: 0, z: 0 }, brincar: true }, 1 / 60, CFG, PISO).c;
  assert.ok(c.vy < vy && c.y < y + 0.2, "sigue la misma parábola");
});

test("física: memoria (apretar un poco antes de caer cuenta) y coyote (brincar justo después de la orilla)", () => {
  // Memoria: apretar 0.1 s antes de tocar el piso
  let c = { ...crearCuerpo(0, 0, 0, 0.5), enSuelo: false, vy: -4 };
  let r = pasoFisico(c, { quiere: { x: 0, z: 0 }, brincar: true }, 1 / 60, CFG, PISO);
  let brinco = false;
  for (let i = 0; i < 20; i++) { r = pasoFisico(r.c, { quiere: { x: 0, z: 0 } }, 1 / 60, CFG, PISO); if (r.brinco) brinco = true; }
  assert.ok(brinco, "brincó al tocar el piso");
  // Coyote: salir caminando de una caja y apretar brincar 3 cuadros después
  const caja = { solidos: [{ tipo: "caja", x0: -1, x1: 1, z0: -1, z1: 1, y0: 0, y1: 1 }], limites: MUNDO.limites };
  c = crearCuerpo(0.98, 0, 0, 1);
  c = simular(c, { x: 1, z: 0 }, 0.12, caja);
  assert.ok(!c.enSuelo, "ya se salió");
  r = pasoFisico(c, { quiere: { x: 1, z: 0 }, brincar: true }, 1 / 60, CFG, caja);
  assert.ok(r.brinco, "todavía pudo brincar");
});

test("física: choca de lado con lo alto, sube escalones bajitos y se para encima de lo que brinca", () => {
  const mapa = { solidos: [{ tipo: "caja", x0: 1, x1: 3, z0: -1, z1: 1, y0: 0, y1: 0.8 }, { tipo: "caja", x0: -3, x1: -1, z0: -1, z1: 1, y0: 0, y1: 0.25 }], limites: MUNDO.limites };
  let c = simular(crearCuerpo(0, 0), { x: 1, z: 0 }, 1, mapa);
  assert.ok(c.x <= 1 - CFG.radio + 0.01 && c.y === 0, "no atraviesa la caja alta");
  c = simular(crearCuerpo(0, 0), { x: -1, z: 0 }, 0.6, mapa);
  assert.equal(c.y, 0.25, "subió el escalón caminando");
  c = simular(crearCuerpo(0, 0), { x: 1, z: 0 }, 0.6, mapa, { brincar: true });
  c = simular(c, { x: 0, z: 0 }, 0.5, mapa);
  assert.equal(c.y, 0.8, "brincando quedó encima");
  // Se resbala por la pared (no se atora)
  c = simular(crearCuerpo(0.5, 0), { x: 1, z: 1 }, 0.5, mapa);
  assert.ok(c.z > 1, "se deslizó");
});

test("física: se pega en la cabeza con lo que está arriba, y por debajo de lo alto se pasa caminando", () => {
  const techo = { solidos: [{ tipo: "caja", x0: -1, x1: 1, z0: -1, z1: 1, y0: 1.8, y1: 2.2 }], limites: MUNDO.limites };
  let max = 0, c = crearCuerpo(0, 0);
  for (let i = 0; i < 60; i++) { c = pasoFisico(c, { quiere: { x: 0, z: 0 }, brincar: i === 0 }, 1 / 60, CFG, techo).c; max = Math.max(max, c.y); }
  assert.ok(max <= 1.8 - CFG.alto + 0.01, `se pegó: ${max}`);
  c = simular(crearCuerpo(-3, 0), { x: 1, z: 0 }, 1.5, techo);
  assert.ok(c.x > 1, "pasó por debajo");
});

test("física: caer de una plataforma no castiga (cae al piso y sigue), y si quedó adentro de algo puede salir", () => {
  const alta = { solidos: [{ tipo: "cilindro", x: 0, z: 0, r: 1, y0: 0, y1: 4 }], limites: MUNDO.limites };
  let c = simular(crearCuerpo(0, 0, 0, 4), { x: 1, z: 0 }, 1.5, alta);
  assert.equal(c.y, 0); assert.ok(c.enSuelo);
  c = simular(crearCuerpo(0.5, 0), { x: 1, z: 0 }, 1, alta); // adentro del cilindro, en el piso
  assert.ok(c.x > 1 + CFG.radio, "salió");
});

test("física: con un cuadro lento (dt de 50 ms) no atraviesa una plataforma delgada", () => {
  const delgada = { solidos: [{ tipo: "caja", x0: -1, x1: 1, z0: -1, z1: 1, y0: 0.9, y1: 1 }], limites: MUNDO.limites };
  let c = { ...crearCuerpo(0, 0, 0, 3), enSuelo: false, vy: -12 };
  for (let i = 0; i < 20; i++) c = pasoFisico(c, { quiere: { x: 0, z: 0 } }, 0.05, CFG, delgada).c;
  assert.equal(c.y, 1);
});

test("física: en el aire conserva la velocidad del brinco si se suelta el joystick", () => {
  let c = simular(crearCuerpo(0, 0), { x: 1, z: 0 }, 0.3, PISO);
  const x0 = c.x;
  c = pasoFisico(c, { quiere: { x: 1, z: 0 }, brincar: true }, 1 / 60, CFG, PISO).c;
  c = simular(c, { x: 0, z: 0 }, 0.4, PISO);
  assert.ok(c.x - x0 > CFG.velocidad * 0.35, "siguió hacia adelante");
});

// ---------- Plataformas ----------

test("plataformas: todas se alcanzan brincando (con holgura)", () => {
  const ok = plataformasAlcanzables(MUNDO);
  for (const p of MUNDO.plataformas) assert.ok(ok.has(p.id), `${p.id} no se alcanza`);
  // Y una imposible no sale
  const muyAlta = [{ id: "a", tipo: "cilindro", x: 0, z: 0, r: 1, y0: 0, y1: 3 }];
  assert.equal(alcanzables(muyAlta, CFG).size, 0);
});

test("plataformas: cada ruta se sube brincando de verdad (simulación), de la primera a la última", () => {
  const { mapa } = armar();
  const por = new Map(MUNDO.plataformas.map((p) => [p.id, solidoDe(p)]));
  for (const ruta of MUNDO.rutas) {
    const ps = ruta.plataformas.map((id) => por.get(id));
    // Del piso a la primera: desde 0.5 m de su orilla, del lado de la plaza
    const p0 = ps[0], c0 = centro(p0), d0 = Math.hypot(c0.x, c0.z) || 1;
    const lejos = (p0.tipo === "cilindro" ? p0.r : Math.max(p0.x1 - p0.x0, p0.z1 - p0.z0) / 2) + CFG.radio + 0.5;
    let c = crearCuerpo(c0.x - (c0.x / d0) * lejos, c0.z - (c0.z / d0) * lejos);
    assert.ok(!chocaEn(c.x, 0, c.z, mapa, CFG), `${ruta.id}: hay piso junto a ${p0.id}`);
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i], cp = centro(p);
      // Caminar hacia el centro y brincar ya junto a la orilla (como lo haría Noelia); termina al quedar parada encima
      for (let t = 0; t < 3; t += 1 / 60) {
        const dx = cp.x - c.x, dz = cp.z - c.z, d = Math.hypot(dx, dz);
        const q = d > 0.15 ? { x: dx / d, z: dz / d } : { x: 0, z: 0 };
        const junto = separacion({ tipo: "cilindro", x: c.x, z: c.z, r: CFG.radio }, p) < 0.3;
        c = pasoFisico(c, { quiere: q, brincar: (c.enSuelo || c.coyote > 0) && junto && c.y < p.y1 - CFG.escalon }, 1 / 60, CFG, mapa).c;
        if (c.enSuelo && Math.abs(c.y - p.y1) < 1e-6) break;
      }
      assert.ok(Math.abs(c.y - p.y1) < 1e-6, `${ruta.id}: no llegó arriba de ${p.id} (y = ${c.y.toFixed(2)})`);
      // Ya arriba, camina hacia el centro antes del siguiente brinco (no brinca desde la orilla donde cayó)
      for (let t = 0; t < 1; t += 1 / 60) {
        const dx = cp.x - c.x, dz = cp.z - c.z, d = Math.hypot(dx, dz);
        if (d < 0.2) break;
        c = pasoFisico(c, { quiere: { x: dx / d * 0.5, z: dz / d * 0.5 } }, 1 / 60, CFG, mapa).c;
      }
      assert.ok(Math.abs(c.y - p.y1) < 1e-6, `${ruta.id}: se cayó de ${p.id}`);
    }
  }
});

test("plataformas: alturaBajo toma lo más alto debajo, con margen en la orilla", () => {
  const m = { solidos: [{ tipo: "cilindro", x: 0, z: 0, r: 1, y0: 0, y1: 1 }, { tipo: "cilindro", x: 0, z: 0, r: 0.5, y0: 0, y1: 2 }] };
  assert.equal(alturaBajo(0, 0, 5, m, CFG), 2);
  assert.equal(alturaBajo(0.8, 0, 5, m, CFG), 1);
  assert.equal(alturaBajo(1 + CFG.radio * CFG.margen - 0.01, 0, 5, m, CFG), 1, "en la orilla");
  assert.equal(alturaBajo(1.5, 0, 5, m, CFG), 0);
  assert.equal(alturaBajo(0, 0, 1.5, m, CFG), 1, "lo que está más alto que yMax no cuenta");
});

// ---------- Cristales ----------

test("cristales: cada uno está sobre una plataforma alcanzable y se toca al pararse ahí", () => {
  const cs = cristalesDe(MUNDO), ok = plataformasAlcanzables(MUNDO);
  assert.ok(cs.length >= 5);
  for (const c of MUNDO.cristales) assert.ok(ok.has(c.en), c.id);
  const c = cs[1];
  assert.equal(cristalTocado({ x: c.x, y: c.y, z: c.z }, cs, new Set()), c);
  assert.equal(cristalTocado({ x: c.x, y: c.y, z: c.z }, cs, new Set([c.id])), null, "ya lo tiene");
  assert.equal(cristalTocado({ x: c.x, y: 0, z: c.z }, cs.filter((x) => x.y > 1.5), new Set()), null, "desde el piso no");
});

// ---------- ¿Mundo o menú 2D? ----------

test("vista: mundo por omisión; 2D sin WebGL, si se recordó o con ?menu2d; ?menu3d gana a lo recordado", () => {
  const p = (q) => new URLSearchParams(q);
  assert.deepEqual(elegirVista({ webgl: true, pref: null, params: p("") }), { vista: "mundo", motivo: "normal" });
  assert.equal(elegirVista({ webgl: false, pref: null, params: p("") }).vista, "2d");
  assert.equal(elegirVista({ webgl: false, pref: null, params: p("menu3d") }).vista, "2d", "sin WebGL no hay mundo aunque se pida");
  assert.equal(elegirVista({ webgl: true, pref: "2d", params: p("") }).vista, "2d");
  assert.equal(elegirVista({ webgl: true, pref: "2d", params: p("menu3d") }).vista, "mundo");
  assert.equal(elegirVista({ webgl: true, pref: "3d", params: p("menu2d") }).vista, "2d");
});

test("sitios: el centro de un sitio sale de su ángulo y distancia", () => {
  const c = centroSitio({ angulo: 90, distancia: 10 });
  assert.ok(Math.abs(c.x - 10) < 1e-9 && Math.abs(c.z) < 1e-9);
  assert.ok(FISICA.brinco > FISICA.escalon);
});

// ---------- Letreros ----------

test("letreros: los cercanos ganan si se enciman, los lejanos y los de fuera de la pantalla no salen", () => {
  const P = { ancho: 1920, alto: 1080, arriba: 90 };
  const r = acomodarLetreros([
    { id: "lejos", x: 960, y: 300, d: 26, w: 140, h: 100 },
    { id: "cerca", x: 980, y: 310, d: 12, w: 140, h: 100 },   // encima del lejano: gana este
    { id: "aparte", x: 400, y: 300, d: 25, w: 140, h: 100 },
    { id: "muy-lejos", x: 1500, y: 300, d: 40, w: 140, h: 100 },
    { id: "arriba", x: 700, y: 50, d: 10, w: 140, h: 100 },    // bajo el HUD
    { id: "fuera", x: 5, y: 500, d: 10, w: 140, h: 100 },
  ], P);
  assert.deepEqual([...r.keys()].sort(), ["aparte", "cerca"]);
  assert.ok(r.get("cerca").k > r.get("aparte").k, "el cercano se ve más grande");
});

// ---------- Cámara ----------

test("cámara: se acerca si un edificio alto queda entre ella y el personaje; los bajitos y los de al lado no cuentan", () => {
  const ojo = { x: 0, y: 1.2, z: 0 }, cam = { x: 0, y: 5, z: 8 };
  assert.equal(brazoCamara(ojo, cam, []), 1);
  const alto = { tipo: "cilindro", x: 0, z: 5, r: 1, y1: 7 };
  const k = brazoCamara(ojo, cam, [alto]);
  assert.ok(k < 0.5 && k >= 0.3, `k = ${k}`);
  assert.equal(brazoCamara(ojo, cam, [{ ...alto, y1: 1.5 }]), 1, "bajito: se ve por encima");
  assert.equal(brazoCamara(ojo, cam, [{ ...alto, x: 6 }]), 1, "a un lado");
  assert.equal(brazoCamara(ojo, cam, [{ ...alto, z: 0.5 }]), 1, "pegado al personaje (en la puerta) no cuenta");
  // En el mundo real: desde cada puerta, la cámara no queda dentro de ningún edificio
  const { todos, mapa } = armar();
  const eds = mapa.solidos.filter((s) => s.id.startsWith("edificio:"));
  for (const s of todos) {
    const o = { x: s.punto.x, y: 1.2, z: s.punto.z };
    const b = brazoCamara(o, { x: o.x, y: 5.4, z: o.z + 7.2 }, eds);
    const c = { x: o.x, z: o.z + 7.2 * b };
    for (const e of eds) assert.ok(Math.hypot(c.x - e.x, c.z - e.z) > e.r || b === 0.3, `cámara de ${s.sitio} dentro de ${e.id}`);
  }
});
