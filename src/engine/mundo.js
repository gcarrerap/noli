// El mundo del menú principal (#25), la parte pura: revisar mundo/mundo.json y mundo/lugares.json, poner cada juego
// en su sitio, armar el mapa de choques, decorar (árboles, hongos, flores) sin estorbar, rutas para "Ir a…" y decidir
// si se usa el mundo 3D o el menú 2D. No sabe nada de Three.js ni del DOM; las pruebas lo corren en Node.
// Ver docs/MUNDO.md.
import { libre, alcanzables, chocaEn, FISICA } from "../../kit/3d/fisica.js";

const RAD = Math.PI / 180;

// ---------- Revisar los datos ----------

/** Errores en los datos del mundo (lista vacía si todo está bien) */
export function revisarMundo(mundo, lugares) {
  const e = [];
  const num = (v) => typeof v === "number" && isFinite(v);
  if (!mundo || typeof mundo !== "object") return ["mundo.json no es un objeto"];
  if (!lugares || typeof lugares !== "object") return ["lugares.json no es un objeto"];
  const l = mundo.limites;
  if (!l || ![l.x0, l.x1, l.z0, l.z1].every(num) || l.x0 >= l.x1 || l.z0 >= l.z1) e.push("mundo.limites debe ser { x0, x1, z0, z1 }");
  if (!mundo.inicio || !num(mundo.inicio.x) || !num(mundo.inicio.z)) e.push("mundo.inicio debe ser { x, z }");
  const ids = new Set();
  for (const p of mundo.plataformas || []) {
    if (!p.id || ids.has(p.id)) e.push(`plataforma sin id o repetida: ${p.id}`);
    ids.add(p.id);
    if (!["cilindro", "caja"].includes(p.forma)) e.push(`${p.id}: "forma" debe ser "cilindro" o "caja"`);
    if (!num(p.x) || !num(p.z) || !num(p.alto) || p.alto <= 0) e.push(`${p.id}: faltan x, z o alto`);
    if (p.forma === "cilindro" && !(num(p.r) && p.r > 0)) e.push(`${p.id}: falta "r"`);
    if (p.forma === "caja" && !(num(p.ancho) && num(p.fondo))) e.push(`${p.id}: faltan "ancho" y "fondo"`);
    if (p.grosor != null && !(num(p.grosor) && p.grosor > 0 && p.grosor <= p.alto)) e.push(`${p.id}: "grosor" debe ser de 0 a "alto"`);
  }
  for (const r of mundo.rutas || []) for (const id of r.plataformas || []) if (!ids.has(id)) e.push(`ruta ${r.id}: no existe la plataforma ${id}`);
  for (const c of mundo.cristales || []) if (!ids.has(c.en)) e.push(`cristal ${c.id}: no existe la plataforma ${c.en}`);
  const ed = lugares.edificios || {};
  if (!ed.portal) e.push("lugares.edificios debe tener \"portal\" (el de los juegos sin edificio propio)");
  for (const [k, v] of Object.entries(ed)) if (!v || !num(v.radio) || !num(v.alto)) e.push(`edificio ${k}: faltan radio y alto`);
  const sitios = new Set();
  for (const s of lugares.sitios || []) {
    if (!s.id || sitios.has(s.id)) e.push(`sitio sin id o repetido: ${s.id}`);
    sitios.add(s.id);
    if (!num(s.angulo) || !num(s.distancia)) e.push(`sitio ${s.id}: faltan angulo y distancia`);
  }
  for (const [id, j] of Object.entries(lugares.juegos || {})) {
    if (!sitios.has(j.sitio)) e.push(`juego ${id}: no existe el sitio ${j.sitio}`);
    if (j.edificio && !ed[j.edificio]) e.push(`juego ${id}: no existe el edificio ${j.edificio}`);
  }
  return e;
}

// ---------- Lugares ----------

/** Centro (x, z) de un sitio: ángulo 0 = hacia el fondo (−z), 90 = a la derecha (+x); distancia desde la plaza */
export const centroSitio = (s) => ({ x: Math.sin(s.angulo * RAD) * s.distancia, z: -Math.cos(s.angulo * RAD) * s.distancia });

/**
 * Pone cada juego en un sitio. Primero los que tienen sitio en lugares.json; los demás, en el siguiente sitio libre
 * (en el orden de lugares.sitios). Edificio: el de lugares.json, si no el "lugar" de su juego.json, si no un portal.
 * Si no alcanzan los sitios, el juego no sale en el mundo (la prueba del catálogo lo revisa: hay que agregar sitios).
 * @param {object[]} juegos manifiestos (en el orden del catálogo)
 * @returns {object[]} lugares: { id, juego, sitio, edificio, x, z, rot, punto: {x, z}, mira, radio, radioChoque, alto }
 */
export function colocarLugares(juegos, lugares) {
  const sitios = lugares.sitios || [], ed = lugares.edificios || {}, asignados = lugares.juegos || {};
  const ocupado = new Set(), porJuego = new Map(), pendientes = [];
  for (const j of juegos) {
    const a = asignados[j.id];
    if (a && sitios.some((s) => s.id === a.sitio) && !ocupado.has(a.sitio)) { ocupado.add(a.sitio); porJuego.set(j.id, a.sitio); }
    else pendientes.push(j);
  }
  for (const j of pendientes) {
    const s = sitios.find((x) => !ocupado.has(x.id));
    if (!s) break;
    ocupado.add(s.id); porJuego.set(j.id, s.id);
  }
  const out = [];
  for (const j of juegos) {
    const sid = porJuego.get(j.id);
    if (!sid) continue;
    const s = sitios.find((x) => x.id === sid);
    const pedido = (asignados[j.id] && asignados[j.id].edificio) || j.lugar;
    const edificio = pedido && ed[pedido] ? pedido : "portal";
    out.push(lugarEn(s, edificio, ed[edificio], lugares.acercarse || 1.9, j));
  }
  return out;
}

function lugarEn(s, edificio, e, acercarse, juego) {
  const c = centroSitio(s);
  const d = Math.hypot(c.x, c.z) || 1;
  const hacia = { x: -c.x / d, z: -c.z / d }; // del edificio hacia la plaza
  const frente = e.radio + 1.1;
  return {
    id: juego.id, juego, sitio: s.id, edificio,
    x: c.x, z: c.z,
    rot: Math.atan2(hacia.x, hacia.z), // el edificio mira hacia la plaza (rotation.y en Three.js)
    punto: { x: c.x + hacia.x * frente, z: c.z + hacia.z * frente },
    mira: Math.atan2(hacia.x, hacia.z) / RAD, // ángulo del personaje parado en la puerta, viendo al edificio
    radio: acercarse, radioChoque: e.radio, alto: e.alto,
  };
}

// ---------- Choques ----------

/** Sólido (para kit/3d/fisica.js) de una plataforma de mundo.json */
export function solidoDe(p) {
  const y0 = p.grosor != null ? Math.max(0, p.alto - p.grosor) : 0;
  if (p.forma === "cilindro") return { id: p.id, tipo: "cilindro", x: p.x, z: p.z, r: p.r, y0, y1: p.alto };
  return { id: p.id, tipo: "caja", x0: p.x - p.ancho / 2, x1: p.x + p.ancho / 2, z0: p.z - p.fondo / 2, z1: p.z + p.fondo / 2, y0, y1: p.alto };
}

/**
 * El mapa de choques: plataformas, edificios (cilindros altos) y troncos de árboles.
 * @returns {{ solidos: object[], limites: object, plataformas: object[] }}
 */
export function mapaMundo(mundo, lugaresColocados, deco = { arboles: [] }) {
  const plataformas = (mundo.plataformas || []).map(solidoDe);
  const edificios = lugaresColocados.map((l) => ({ id: "edificio:" + l.id, tipo: "cilindro", x: l.x, z: l.z, r: l.radioChoque, y0: 0, y1: l.alto }));
  const troncos = deco.arboles.map((a, i) => ({ id: "arbol:" + i, tipo: "cilindro", x: a.x, z: a.z, r: 0.45 * a.escala, y0: 0, y1: 4 * a.escala }));
  return { solidos: [...plataformas, ...edificios, ...troncos], limites: mundo.limites, plataformas };
}

/** Ajustes de física del mundo */
export const fisicaDe = (mundo) => Object.assign({}, FISICA, mundo.movimiento || {});

// ---------- Decoración (con semilla: siempre sale igual) ----------

/** Números al azar repetibles (mulberry32) */
export function azar(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Distancia de un punto al segmento a–b */
function aSegmento(p, a, b) {
  const vx = b.x - a.x, vz = b.z - a.z, l2 = vx * vx + vz * vz || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.z - a.z) * vz) / l2));
  return Math.hypot(p.x - (a.x + vx * t), p.z - (a.z + vz * t));
}

/**
 * Árboles, hongos chiquitos, flores y luciérnagas. Los árboles nunca quedan en la plaza, en un camino (de la plaza a
 * cualquier sitio, ocupado o no), junto a un edificio, una plataforma o el estanque.
 * @param {object[]} sitiosTodos lugares de TODOS los sitios (colocados con un portal), para dejar libres sus caminos
 */
export function decorar(mundo, sitiosTodos) {
  const d = mundo.decoracion || {}, rnd = azar(d.semilla || 1), l = mundo.limites;
  const plaza = (mundo.plaza && mundo.plaza.radio) || 5;
  const plats = (mundo.plataformas || []).map(solidoDe);
  const est = mundo.estanque;
  const caminos = sitiosTodos.map((s) => ({ a: { x: 0, z: 0 }, b: s.punto }));
  const libreDe = (p, holgura) => {
    if (Math.hypot(p.x, p.z) < plaza + holgura) return false;
    if (Math.hypot(p.x - mundo.inicio.x, p.z - mundo.inicio.z) < 3) return false;
    for (const c of caminos) if (aSegmento(p, c.a, c.b) < 1.6 + holgura) return false;
    for (const s of sitiosTodos) if (Math.hypot(p.x - s.x, p.z - s.z) < s.radioChoque + 1.4 + holgura) return false;
    for (const s of plats) {
      const cx = s.tipo === "cilindro" ? s.x : (s.x0 + s.x1) / 2, cz = s.tipo === "cilindro" ? s.z : (s.z0 + s.z1) / 2;
      const r = s.tipo === "cilindro" ? s.r : Math.hypot(s.x1 - s.x0, s.z1 - s.z0) / 2;
      if (Math.hypot(p.x - cx, p.z - cz) < r + 1.4 + holgura) return false;
    }
    if (est && Math.hypot(p.x - est.x, p.z - est.z) < est.r + 0.8 + holgura) return false;
    return true;
  };
  const colores = d.colores || ["#ffb3d1"];
  const arboles = [];
  const ponerArbol = (x, z, escala) => {
    const p = { x, z };
    if (!libreDe(p, escala * 0.6)) return false;
    for (const a of arboles) if (Math.hypot(a.x - x, a.z - z) < 2.2 * Math.max(a.escala, escala)) return false;
    arboles.push({ x, z, escala, color: colores[Math.floor(rnd() * colores.length)], giro: rnd() * Math.PI * 2 });
    return true;
  };
  // Borde: una fila de árboles por dentro de los límites (de cerca no se ve el final del mundo). Al frente (z1) no:
  // ahí está la cámara (detrás del personaje) y solo taparían la vista.
  const paso = d.arbolesBorde || 3.4, m = 1.4;
  for (let x = l.x0 + m; x <= l.x1 - m; x += paso) ponerArbol(x + (rnd() - 0.5), l.z0 + m + rnd() * 0.6, 1.1 + rnd() * 0.5);
  for (let z = l.z0 + m + paso; z <= l.z1 - m - paso; z += paso) { ponerArbol(l.x0 + m + rnd() * 0.6, z + (rnd() - 0.5), 1.1 + rnd() * 0.5); ponerArbol(l.x1 - m - rnd() * 0.6, z + (rnd() - 0.5), 1.1 + rnd() * 0.5); }
  // Sueltos, donde no estorben
  for (let i = 0, n = 0; n < (d.arbolesSueltos || 0) && i < 2000; i++) {
    if (ponerArbol(l.x0 + 3 + rnd() * (l.x1 - l.x0 - 6), l.z0 + 3 + rnd() * (l.z1 - l.z0 - 6), 0.8 + rnd() * 0.6)) n++;
  }
  const sueltos = (n, holgura, crear) => {
    const r = [];
    for (let i = 0; r.length < n && i < n * 60; i++) {
      const p = { x: l.x0 + 1 + rnd() * (l.x1 - l.x0 - 2), z: l.z0 + 1 + rnd() * (l.z1 - l.z0 - 2) };
      if (libreDe(p, holgura) && !arboles.some((a) => Math.hypot(a.x - p.x, a.z - p.z) < a.escala * 1.2)) r.push(crear(p));
    }
    return r;
  };
  const hongos = sueltos(d.hongos || 0, -0.8, (p) => ({ ...p, escala: 0.25 + rnd() * 0.35, color: colores[Math.floor(rnd() * colores.length)] }));
  const flores = sueltos(d.flores || 0, -1.2, (p) => ({ ...p, color: colores[Math.floor(rnd() * colores.length)] }));
  const luciernagas = [];
  for (let i = 0; i < (d.luciernagas || 0); i++) {
    luciernagas.push({ x: l.x0 + 2 + rnd() * (l.x1 - l.x0 - 4), y: 0.8 + rnd() * 2.6, z: l.z0 + 2 + rnd() * (l.z1 - l.z0 - 4), fase: rnd() * Math.PI * 2 });
  }
  return { arboles, hongos, flores, luciernagas };
}

/** Lugares de todos los sitios (cada uno con un portal), para dejar libres sus caminos al decorar y probarlos */
export function todosLosSitios(lugares) {
  return (lugares.sitios || []).map((s) => lugarEn(s, "portal", lugares.edificios.portal, lugares.acercarse || 1.9, { id: "sitio:" + s.id }));
}

// ---------- Cerca de qué ----------

/** El lugar en cuya puerta está parado el personaje (solo con los pies cerca del piso), o null */
export function lugarCercano(pos, lugares) {
  if (pos.y > 0.6) return null;
  let mejor = null, md = Infinity;
  for (const l of lugares) {
    const d = Math.hypot(pos.x - l.punto.x, pos.z - l.punto.z);
    if (d <= l.radio && d < md) { md = d; mejor = l; }
  }
  return mejor;
}

/** Posición de cada cristal (sobre su plataforma) */
export function cristalesDe(mundo) {
  const plats = new Map((mundo.plataformas || []).map((p) => [p.id, p]));
  return (mundo.cristales || []).map((c) => { const p = plats.get(c.en); return { id: c.id, color: c.color, x: p.x, z: p.z, y: p.alto }; });
}

/** El cristal que el personaje está tocando (que todavía no tenga), o null */
export function cristalTocado(pos, cristales, tiene) {
  for (const c of cristales) {
    if (tiene.has(c.id)) continue;
    if (Math.hypot(pos.x - c.x, pos.z - c.z) < 0.8 && pos.y > c.y - 0.4 && pos.y < c.y + 1.2) return c;
  }
  return null;
}

// ---------- "Ir a…": rutas por el piso ----------

/**
 * Puntos por donde se puede caminar para ir de un lado a otro: un anillo alrededor de la fuente y la puerta de cada
 * sitio. Las conexiones entre ellos (sin chocar) se calculan una vez.
 */
export function crearCaminos(mundo, sitiosTodos, mapa, cfg) {
  const plaza = (mundo.plaza && mundo.plaza.radio) || 5;
  const nodos = [];
  for (let i = 0; i < 12; i++) nodos.push({ x: Math.sin(i * 30 * RAD) * plaza * 0.62, z: -Math.cos(i * 30 * RAD) * plaza * 0.62 });
  for (const s of sitiosTodos) nodos.push({ ...s.punto });
  nodos.push({ x: mundo.inicio.x, z: mundo.inicio.z });
  const vecinos = nodos.map(() => []);
  for (let i = 0; i < nodos.length; i++) for (let j = i + 1; j < nodos.length; j++) {
    if (libre(nodos[i], nodos[j], mapa, cfg)) {
      const d = Math.hypot(nodos[i].x - nodos[j].x, nodos[i].z - nodos[j].z);
      vecinos[i].push([j, d]); vecinos[j].push([i, d]);
    }
  }
  return { nodos, vecinos, mapa, cfg };
}

/**
 * Ruta por el piso de `desde` a `hasta` (lista de puntos), o null si no hay. Directo si se puede; si no, por los
 * puntos de crearCaminos (camino más corto).
 */
export function rutaPorCaminos(caminos, desde, hasta) {
  const { nodos, vecinos, mapa, cfg } = caminos;
  if (libre(desde, hasta, mapa, cfg)) return [hasta];
  const n = nodos.length, dist = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), hecho = new Array(n).fill(false);
  const alFinal = nodos.map((p) => (libre(p, hasta, mapa, cfg) ? Math.hypot(p.x - hasta.x, p.z - hasta.z) : Infinity));
  for (let i = 0; i < n; i++) if (libre(desde, nodos[i], mapa, cfg)) dist[i] = Math.hypot(desde.x - nodos[i].x, desde.z - nodos[i].z);
  let mejor = -1, mejorD = Infinity;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!hecho[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0) break;
    hecho[u] = true;
    if (dist[u] + alFinal[u] < mejorD) { mejorD = dist[u] + alFinal[u]; mejor = u; }
    for (const [v, d] of vecinos[u]) if (dist[u] + d < dist[v]) { dist[v] = dist[u] + d; prev[v] = u; }
  }
  if (mejor < 0) return null;
  const r = [hasta];
  for (let u = mejor; u >= 0; u = prev[u]) r.unshift({ ...nodos[u] });
  return r;
}

/** ¿El punto está libre (se puede parar ahí en el piso)? */
export const puntoLibre = (p, mapa, cfg) => !chocaEn(p.x, 0, p.z, mapa, cfg);

/** Ids de las plataformas que se alcanzan brincando (todas deberían) */
export const plataformasAlcanzables = (mundo) => alcanzables((mundo.plataformas || []).map(solidoDe), fisicaDe(mundo));

// ---------- Cámara ----------

/**
 * Qué tanto se puede alejar la cámara sin que un edificio quede entre ella y el personaje (como un brazo que se
 * encoge): 1 = toda la distancia; menos si algo estorba (nunca menos de `minimo`). Solo cuentan los sólidos más altos
 * que la línea de vista en ese punto (los bajitos se ven por encima).
 * @param {{x, y, z}} ojo a dónde mira la cámara (el personaje)
 * @param {{x, y, z}} cam dónde quiere estar la cámara
 * @param {{ tipo: "cilindro", x, z, r, y1 }[]} cilindros
 */
export function brazoCamara(ojo, cam, cilindros, { margen = 0.6, minimo = 0.3 } = {}) {
  const dx = cam.x - ojo.x, dz = cam.z - ojo.z, dy = cam.y - ojo.y;
  const a = dx * dx + dz * dz;
  if (a < 1e-9) return 1;
  let t = 1;
  for (const s of cilindros) {
    if (s.tipo !== "cilindro") continue;
    const r = s.r + margen, fx = ojo.x - s.x, fz = ojo.z - s.z;
    const b = 2 * (fx * dx + fz * dz), c = fx * fx + fz * fz - r * r;
    if (c <= 0) continue; // el personaje está pegado (en la puerta): no cuenta
    const disc = b * b - 4 * a * c;
    if (disc < 0) continue;
    const t0 = (-b - Math.sqrt(disc)) / (2 * a);
    if (t0 <= 0 || t0 >= t) continue;
    if (s.y1 < ojo.y + dy * t0) continue; // la línea de vista pasa por encima
    t = t0;
  }
  return t >= 1 ? 1 : Math.max(minimo, t - 0.05);
}

// ---------- Letreros ----------

/**
 * Qué letreros se ven y de qué tamaño. Los más cercanos ganan: si uno se enciman con otro más cercano, se esconde
 * (desde lejos se juntaban todos en una fila). Los muy lejanos no salen; al acercarse aparecen.
 * @param {{ id, x, y, d, w, h }[]} items posición en pantalla (x, y = abajo al centro), distancia a la cámara y tamaño
 *   sin escalar (px)
 * @param {{ ancho: number, alto: number, arriba: number, lejos?: number }} pantalla arriba: px reservados para el HUD (un
 *   letrero que se metería ahí no sale)
 * @returns {Map<string, { k: number }>} los que se ven, con su escala
 */
export function acomodarLetreros(items, { ancho, alto, arriba, lejos = 30 }) {
  const r = new Map(), puestos = [];
  for (const it of items.slice().sort((a, b) => a.d - b.d)) {
    if (it.d > lejos || it.y > alto || it.x < 30 || it.x > ancho - 30) continue;
    const k = Math.max(0.62, Math.min(1.05, 1.25 - it.d / 32));
    const w = it.w * k, h = it.h * k;
    if (it.y - h < arriba) continue; // taparía el HUD
    const caja = { x0: it.x - w / 2, x1: it.x + w / 2, y0: it.y - h, y1: it.y };
    const choca = puestos.some((o) => {
      const ix = Math.min(o.x1, caja.x1) - Math.max(o.x0, caja.x0), iy = Math.min(o.y1, caja.y1) - Math.max(o.y0, caja.y0);
      return ix > 0 && iy > 0 && ix * iy > 0.25 * w * h;
    });
    if (choca) continue;
    puestos.push(caja);
    r.set(it.id, { k });
  }
  return r;
}

// ---------- ¿Mundo 3D o menú 2D? ----------

/**
 * Decide qué menú usar.
 * @param {{ webgl: boolean, pref: string|null, params: URLSearchParams|{has(k): boolean} }} op pref: lo recordado en este
 *   aparato ("2d" si dijo que sí al menú sencillo, "3d" si eligió el mundo)
 * @returns {{ vista: "mundo"|"2d", motivo: string }}
 */
export function elegirVista({ webgl, pref, params }) {
  if (params && params.has("menu2d")) return { vista: "2d", motivo: "forzado" };
  if (!webgl) return { vista: "2d", motivo: "sin-webgl" };
  if (params && params.has("menu3d")) return { vista: "mundo", motivo: "forzado" };
  if (pref === "2d") return { vista: "2d", motivo: "recordado" };
  return { vista: "mundo", motivo: "normal" };
}
