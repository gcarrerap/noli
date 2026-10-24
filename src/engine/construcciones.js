// Lo que hay en cada isla (#176), la parte pura: los lugares de juego (todos construidos desde el principio; los que
// todavía no tienen juego quedan cerrados), la pared de rocas de la orilla, las rocas para brincar, el cristal del
// centro y los cristales para encontrar. Sale de mundo/islas.json → islas[].construcciones, en metros RELATIVOS al
// centro de la isla, para que la misma forma sirva en cualquier isla. No sabe nada de Three.js ni del DOM.
// Ver docs/MUNDO.md § Cómo se arma una isla.
import { libre, chocaEn, FISICA } from "../../kit/3d/fisica.js";
import { azar } from "./mundo.js";
import { aOrilla, teletransportadorDe, ANCHO_PUENTE } from "./islas.js";

const RAD = Math.PI / 180;
export const ACERCARSE = 1.9;  // m: qué tan cerca de la puerta sale «Entrar a…» (como en Isla Noli)
const FRENTE = 1.1;            // m de la pared de la gruta a donde se para Noelia

/** Distancia del punto p al segmento a–b */
function aSeg(p, a, b) {
  const vx = b.x - a.x, vz = b.z - a.z, l2 = vx * vx + vz * vz || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.z - a.z) * vz) / l2));
  return Math.hypot(p.x - (a.x + vx * t), p.z - (a.z + vz * t));
}

/** Las salidas de una isla (donde llega cada conexión): { id, orilla, adentro (2.5 m), dir (hacia adentro) } */
export function salidasDe(red, id) {
  const out = [];
  for (const k of red.conexiones) {
    if (k.de !== id && k.a !== id) continue;
    const o = k.de === id ? k.p0 : k.p1, d = k.de === id ? { x: -k.dir.x, z: -k.dir.z } : k.dir;
    out.push({ id: k.id, orilla: o, dir: d, adentro: { x: o.x + d.x * 2.5, z: o.z + d.z * 2.5 }, lejos: { x: o.x + d.x * 7, z: o.z + d.z * 7 } });
  }
  return out;
}

/**
 * Arma lo de todas las islas que tienen construcciones: Map(isla → { isla, edificio, sitios, centro, rocas, orilla,
 * arcos, cristales, arte }). Todo en coordenadas del mundo.
 */
export function armarConstrucciones(red) {
  const out = new Map();
  for (const i of red.islas) {
    const C = i.construcciones;
    if (!C || i.f.tipo !== "circulo") continue;
    const c = i.c, abs = (p) => ({ x: c.x + p.x, z: c.z + p.z });
    const ed = C.edificio || { tipo: "gruta", radio: 2.2, alto: 4.4 };
    const sitios = (C.lugares || []).map((s) => ({ ...s, ...abs(s), rel: { x: s.x, z: s.z } }));
    const rocas = (C.rocas || []).map((r) => ({ ...r, ...abs(r) }));
    const porRoca = new Map(rocas.map((r) => [r.id, r]));
    const cristales = (C.cristales || []).map((k) => {
      const r = k.en ? porRoca.get(k.en) : null;
      return r ? { id: k.id, color: k.color, x: r.x, z: r.z, y: r.alto, en: k.en } : { id: k.id, color: k.color, ...abs(k), y: 0 };
    });
    const centro = C.centro ? { ...C.centro, ...abs(C.centro) } : null;
    const { orilla, arcos } = paredOrilla(i, C.orilla, salidasDe(red, i.id));
    out.set(i.id, { isla: i.id, edificio: ed, sitios, centro, rocas, orilla, arcos, cristales, arte: C.arte || {} });
  }
  return out;
}

/**
 * La pared de rocas de la orilla: un anillo de rocas al fondo y a los lados, con un hueco en cada salida y un arco de roca
 * encima. Al frente (hacia la cámara, +z, más allá de `frenteDesde`) no hay pared: taparía la vista.
 */
export function paredOrilla(isla, O, salidas) {
  if (!O) return { orilla: [], arcos: [] };
  const c = isla.c, rnd = azar(isla.id.split("").reduce((s, ch) => s * 31 + ch.charCodeAt(0), 11));
  const n = Math.round((2 * Math.PI * O.r) / 2.3);
  const frenteDesde = O.frenteDesde ?? 6;
  // Primero, los dos pilares de cada hueco (en el anillo, a cada lado de la salida); el arco va de uno a otro
  const orilla = [], arcos = [];
  for (const s of salidas) {
    const d = Math.hypot(s.orilla.x - c.x, s.orilla.z - c.z) || 1;
    const m = { x: c.x + (s.orilla.x - c.x) * (O.r / d), z: c.z + (s.orilla.z - c.z) * (O.r / d) };
    const lado = { x: -s.dir.z, z: s.dir.x }, o = O.hueco / 2 + 1.25;
    if (m.z - c.z > frenteDesde) continue; // al frente no hay pared ni arco
    const [h0, h1] = O.alto || [2.6, 3.8];
    const par = [1, -1].map((sg) => ({ id: `${isla.id}:pilar:${s.id}:${sg > 0 ? "+" : "-"}`, x: m.x + lado.x * o * sg, z: m.z + lado.z * o * sg,
      r: 1.25, alto: +(h0 + rnd() * (h1 - h0)).toFixed(2), pilar: true }));
    orilla.push(...par);
    arcos.push({ id: s.id, a: par[0], b: par[1], alto: Math.min(par[0].alto, par[1].alto) + 0.4 });
  }
  for (let k = 0; k < n; k++) {
    const a = (k / n) * 2 * Math.PI + rnd() * 0.05;
    const r = 1.25 + rnd() * 0.45;
    const x = c.x + Math.sin(a) * (O.r + rnd() * 0.6), z = c.z - Math.cos(a) * (O.r + rnd() * 0.6);
    const q = { x, z };
    if (salidas.some((s) => aSeg(q, s.orilla, { x: c.x, z: c.z }) < O.hueco / 2 + r)) continue;
    if (orilla.some((p) => p.pilar && Math.hypot(p.x - x, p.z - z) < p.r + r * 0.6)) continue; // ya hay un pilar ahí
    if (z - c.z > frenteDesde) continue; // al frente (donde va la cámara) no hay pared: taparía la vista
    const [h0, h1] = O.alto || [2.6, 3.8];
    orilla.push({ id: `${isla.id}:orilla:${k}`, x, z, r, alto: +(h0 + rnd() * (h1 - h0)).toFixed(2) });
  }
  return { orilla, arcos };
}

/**
 * Los lugares de juego de las islas, en el mismo formato que colocarLugares (Isla Noli) más { isla, nivelInicial,
 * cerrado }. Un lugar sin juego (o con un juego que no está en el catálogo) queda cerrado: se ve, pero no se entra.
 * La puerta mira hacia la cámara (+z): así siempre se ve.
 * @param {Map} cons armarConstrucciones(...)
 * @param {object[]} juegos manifiestos del catálogo
 */
export function lugaresIslas(cons, juegos) {
  const porId = new Map(juegos.map((j) => [j.id, j]));
  const out = [];
  for (const C of cons.values()) {
    for (const s of C.sitios) {
      const juego = s.juego ? porId.get(s.juego) || null : null;
      out.push({
        id: `${C.isla}:${s.id}`, isla: C.isla, sitio: s.id, juego, nivelInicial: juego ? s.nivelInicial || 1 : 1, cerrado: !juego,
        edificio: C.edificio.tipo, x: s.x, z: s.z, rot: 0,
        punto: { x: s.x, z: s.z + C.edificio.radio + FRENTE }, mira: 0,
        radio: ACERCARSE, radioChoque: C.edificio.radio, alto: C.edificio.alto,
      });
    }
  }
  return out;
}

/** Los cristales para encontrar en las islas (como cristalesDe de Isla Noli: { id, color, x, y, z }) */
export const cristalesIslas = (cons) => [...cons.values()].flatMap((C) => C.cristales.map(({ id, color, x, y, z }) => ({ id, color, x, y, z })));

/** Los sólidos de las islas para la física: grutas, el cristal del centro, la pared de la orilla y las rocas */
export function solidosIslas(cons) {
  const s = [];
  for (const C of cons.values()) {
    for (const g of C.sitios) s.push({ id: `edificio:${C.isla}:${g.id}`, tipo: "cilindro", x: g.x, z: g.z, r: C.edificio.radio, y0: 0, y1: C.edificio.alto });
    if (C.centro) s.push({ id: `${C.isla}:centro`, tipo: "cilindro", x: C.centro.x, z: C.centro.z, r: C.centro.r, y0: 0, y1: C.centro.alto });
    for (const r of C.orilla) s.push({ id: r.id, tipo: "cilindro", x: r.x, z: r.z, r: r.r, y0: 0, y1: r.alto });
    for (const r of C.rocas) s.push({ id: `${C.isla}:${r.id}`, tipo: "cilindro", x: r.x, z: r.z, r: r.r, y0: 0, y1: r.alto });
  }
  return s;
}

/** Los cilindros altos de una isla (para que la cámara se acerque si uno queda entre ella y el personaje) */
export const altosIslas = (cons) => solidosIslas(cons).filter((s) => s.y1 > 2.5 && (s.id.startsWith("edificio:") || s.id.endsWith(":centro")));

/** Límites (caja) de una isla, para la física de sus caminos */
const limitesIsla = (i) => ({ x0: i.f.x - i.f.r, x1: i.f.x + i.f.r, z0: i.f.z - i.f.r, z1: i.f.z + i.f.r });

/**
 * Los puntos por donde se camina en una isla (para "Ir a…" y para tocar el piso): dos anillos (alrededor del centro y a
 * media isla), la puerta de cada lugar, las salidas y el teletransportador. Mismo formato que crearCaminos: sirve con
 * rutaPorCaminos.
 */
export function caminosIsla(red, C, cfg = FISICA) {
  const i = red.por.get(C.isla), c = i.c;
  const mapa = { solidos: solidosIslas(new Map([[C.isla, C]])), limites: limitesIsla(i) };
  const nodos = [];
  const anillo = (r, n, desfase = 0) => { for (let k = 0; k < n; k++) { const a = (k / n) * 2 * Math.PI + desfase; nodos.push({ x: c.x + Math.sin(a) * r, z: c.z - Math.cos(a) * r }); } };
  const rc = C.centro ? C.centro.r + 1.6 : 3;
  anillo(rc, 12, 0.13);
  anillo((rc + (C.orilla.length ? 19 : i.f.r - 4)) / 2, 16, 0.07);
  anillo(C.orilla.length ? 17.6 : i.f.r - 4, 24, 0.05);
  for (const s of C.sitios) nodos.push({ x: s.x, z: s.z + C.edificio.radio + FRENTE });
  for (const s of salidasDe(red, C.isla)) { nodos.push({ ...s.adentro }, { ...s.lejos }); }
  const t = teletransportadorDe(i); nodos.push({ x: t.x, z: t.z + 2.2 });
  const libres = nodos.filter((p) => !chocaEn(p.x, 0, p.z, mapa, cfg));
  const vecinos = libres.map(() => []);
  for (let a = 0; a < libres.length; a++) for (let b = a + 1; b < libres.length; b++) {
    if (Math.hypot(libres[a].x - libres[b].x, libres[a].z - libres[b].z) > 16) continue;
    if (libre(libres[a], libres[b], mapa, cfg)) {
      const d = Math.hypot(libres[a].x - libres[b].x, libres[a].z - libres[b].z);
      vecinos[a].push([b, d]); vecinos[b].push([a, d]);
    }
  }
  return { nodos: libres, vecinos, mapa, cfg };
}

/**
 * Errores en las construcciones de las islas (lista vacía si todo está bien): ids, que todo quede dentro de la isla y
 * sin encimarse, que nada tape las salidas ni el teletransportador, que los cristales estén en rocas que existen y que
 * las rocas se alcancen con un brinco fácil.
 */
export function revisarConstrucciones(cfg, red, fisica = FISICA) {
  const e = [];
  const num = (v) => typeof v === "number" && isFinite(v);
  const brinco = (fisica.brinco || FISICA.brinco) * 0.85;
  const idsCristal = new Set();
  for (const i of red.islas) {
    const C = i.construcciones;
    if (!C) continue;
    if (i.f.tipo !== "circulo") { e.push(`${i.id}: solo las islas redondas tienen construcciones`); continue; }
    const ed = C.edificio;
    if (!ed || !num(ed.radio) || !num(ed.alto)) e.push(`${i.id}: falta construcciones.edificio { tipo, radio, alto }`);
    const ids = new Set();
    for (const s of C.lugares || []) {
      if (!s.id || ids.has(s.id)) e.push(`${i.id}: lugar sin id o repetido: ${s.id}`);
      ids.add(s.id);
      if (!num(s.x) || !num(s.z)) e.push(`${i.id}:${s.id}: faltan x y z`);
      if (s.juego != null && typeof s.juego !== "string") e.push(`${i.id}:${s.id}: "juego" debe ser el id de un juego`);
      if (s.nivelInicial != null && !(Number.isInteger(s.nivelInicial) && s.nivelInicial >= 1)) e.push(`${i.id}:${s.id}: "nivelInicial" debe ser un entero desde 1`);
    }
    const rids = new Set();
    for (const r of C.rocas || []) {
      if (!r.id || rids.has(r.id)) e.push(`${i.id}: roca sin id o repetida: ${r.id}`);
      rids.add(r.id);
      if (!num(r.x) || !num(r.z) || !num(r.r) || !num(r.alto)) e.push(`${i.id}:${r.id}: faltan x, z, r o alto`);
      else if (r.alto > brinco) e.push(`${i.id}:${r.id}: muy alta (${r.alto} m); un brinco fácil llega a ${brinco.toFixed(2)} m`);
    }
    for (const k of C.cristales || []) {
      if (!k.id || idsCristal.has(k.id)) e.push(`cristal sin id o repetido: ${k.id}`);
      idsCristal.add(k.id);
      if (k.en && !rids.has(k.en)) e.push(`${i.id}: el cristal ${k.id} está en la roca ${k.en}, que no existe`);
      else if (!k.en && !(num(k.x) && num(k.z))) e.push(`${i.id}: el cristal ${k.id} necesita "en" (una roca) o x y z`);
    }
  }
  if (e.length) return e;
  const cons = armarConstrucciones(red);
  for (const C of cons.values()) {
    const i = red.por.get(C.isla), sal = salidasDe(red, C.isla), t = teletransportadorDe(i);
    const piezas = [
      ...C.sitios.map((s) => ({ id: s.id, x: s.x, z: s.z, r: C.edificio.radio })),
      ...C.rocas.map((r) => ({ id: r.id, x: r.x, z: r.z, r: r.r })),
      ...(C.centro ? [{ id: "centro", x: C.centro.x, z: C.centro.z, r: C.centro.r }] : []),
    ];
    for (const p of piezas) {
      if (aOrilla(i.f, p.x, p.z) < p.r + 3) e.push(`${C.isla}:${p.id}: muy cerca de la orilla`);
      for (const s of sal) if (aSeg(p, s.orilla, s.lejos) < p.r + ANCHO_PUENTE / 2 + 0.6) e.push(`${C.isla}:${p.id}: tapa la salida hacia ${s.id}`);
      if (Math.hypot(p.x - t.x, p.z - t.z) < p.r + 2.4) e.push(`${C.isla}:${p.id}: tapa el teletransportador`);
    }
    for (let a = 0; a < piezas.length; a++) for (let b = a + 1; b < piezas.length; b++) {
      const p = piezas[a], q = piezas[b];
      if (Math.hypot(p.x - q.x, p.z - q.z) < p.r + q.r + 1.2) e.push(`${C.isla}: ${p.id} y ${q.id} están encimados o muy juntos`);
    }
    for (const s of C.sitios) {
      const puerta = { x: s.x, z: s.z + C.edificio.radio + FRENTE };
      for (const p of piezas) if (p.id !== s.id && Math.hypot(puerta.x - p.x, puerta.z - p.z) < p.r + 1) e.push(`${C.isla}:${p.id} tapa la puerta de ${s.id}`);
    }
    for (const k of C.cristales) if (aOrilla(i.f, k.x, k.z) < 3.5) e.push(`${C.isla}: el cristal ${k.id} está muy cerca de la orilla`);
  }
  return e;
}
