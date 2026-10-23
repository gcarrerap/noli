// Las islas del mundo (#164), la parte pura: revisar mundo/islas.json, la red de conexiones (puentes y caminos de
// plataformas), su geometría (orillas, tiras de piso, barandales, plataformas que se mueven), lo que se guarda en
// "_mundo" (v2: islas visitadas, conexiones construidas, estrellas del mundo) y cómo se juntan dos versiones.
// No sabe nada de Three.js ni del DOM; las pruebas lo corren en Node. Ver docs/MUNDO.md § Las islas.
import { aSegmento, alcanceBrinco, FISICA } from "../../kit/3d/fisica.js";

const TIPOS = ["puente", "plataformas"];
export const ANCHO_PUENTE = 2.4;   // m de piso del puente (entre barandales)
export const ENTRA = 1.2;          // m que el piso del puente se mete en cada isla (para que no quede un hueco)
export const MUELLE = 3;           // m que sale el muelle sobre el agua (conexión sin construir)
export const INICIO = "noli";
export const TOPE_ESTRELLAS = 5;  // estrellas del mundo por isla y juego (igual que islas.json → topeEstrellas; una prueba lo revisa)

// ---------- Forma de cada isla ----------

/** La forma de una isla: { tipo: "caja", x0, x1, z0, z1 } o { tipo: "circulo", x, z, r } */
export function formaDe(isla, cfg) {
  if (isla.forma && isla.forma.tipo === "caja") return { tipo: "caja", ...isla.forma };
  return { tipo: "circulo", x: isla.centro.x, z: isla.centro.z, r: isla.radio || cfg.radio || 24 };
}

/** Centro de una isla */
export const centroIsla = (isla, cfg) => {
  const f = formaDe(isla, cfg);
  return f.tipo === "caja" ? { x: (f.x0 + f.x1) / 2, z: (f.z0 + f.z1) / 2 } : { x: f.x, z: f.z };
};

/** ¿(x, z) está en la isla (con margen: positivo agranda, negativo achica)? */
export function dentro(forma, x, z, margen = 0) {
  if (forma.tipo === "circulo") return Math.hypot(x - forma.x, z - forma.z) <= forma.r + margen;
  return x >= forma.x0 - margen && x <= forma.x1 + margen && z >= forma.z0 - margen && z <= forma.z1 + margen;
}

/** Qué tan adentro de la orilla está (x, z): metros hasta la orilla (negativo si está afuera) */
export function aOrilla(forma, x, z) {
  if (forma.tipo === "circulo") return forma.r - Math.hypot(x - forma.x, z - forma.z);
  return Math.min(x - forma.x0, forma.x1 - x, z - forma.z0, forma.z1 - z);
}

/** Punto de la orilla en la línea del centro hacia `hacia` */
export function orillaHacia(forma, hacia) {
  if (forma.tipo === "circulo") {
    const dx = hacia.x - forma.x, dz = hacia.z - forma.z, d = Math.hypot(dx, dz) || 1;
    return { x: forma.x + dx / d * forma.r, z: forma.z + dz / d * forma.r };
  }
  const cx = (forma.x0 + forma.x1) / 2, cz = (forma.z0 + forma.z1) / 2;
  const dx = hacia.x - cx, dz = hacia.z - cz;
  const t = Math.min(dx ? (dx > 0 ? forma.x1 - cx : forma.x0 - cx) / dx : Infinity, dz ? (dz > 0 ? forma.z1 - cz : forma.z0 - cz) / dz : Infinity);
  return { x: cx + dx * t, z: cz + dz * t };
}

// ---------- La red ----------

/** Todo lo de islas.json ya armado: islas con su forma, conexiones con su geometría, índices */
export function armarIslas(cfg) {
  const islas = cfg.islas.map((i) => ({ ...i, f: formaDe(i, cfg), c: centroIsla(i, cfg) }));
  const por = new Map(islas.map((i) => [i.id, i]));
  const conexiones = (cfg.conexiones || []).map((k) => geometria(k, por, cfg));
  const porCon = new Map(conexiones.map((k) => [k.id, k]));
  return { cfg, islas, por, conexiones, porCon };
}

/** Puntos de orilla, dirección y largo de una conexión (y sus plataformas, si es de ese tipo) */
function geometria(k, por, cfg) {
  const A = por.get(k.de), B = por.get(k.a);
  if (!A || !B) return { ...k, roto: true };
  const a = k.desde || orillaHacia(A.f, k.hasta || centroIsla(B, cfg));
  const b = k.hasta || orillaHacia(B.f, a);
  const largo = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  const dir = { x: (b.x - a.x) / largo, z: (b.z - a.z) / largo };
  const lado = { x: -dir.z, z: dir.x };
  const g = { ...k, p0: a, p1: b, largo, dir, lado };
  if (k.tipo === "plataformas") g.plataformas = plataformasDe(g, cfg.plataformas || {});
  return g;
}

/**
 * Las plataformas de un camino de plataformas: discos sobre el agua de una orilla a la otra, con huecos iguales.
 * En los caminos "moviles", una sí y una no se mueve de lado (perpendicular al camino).
 */
export function plataformasDe(g, P) {
  const r = P.r || 0.85, hueco = P.hueco || 1.2, altos = P.alto || [0.45, 0.7], grosor = P.grosor || 0.35;
  let n = Math.max(1, Math.round((g.largo - hueco) / (2 * r + hueco)));
  const huecoDe = (k) => (g.largo - k * 2 * r) / (k + 1);
  while (huecoDe(n) > hueco * 1.25) n++;
  const h = huecoDe(n), out = [];
  for (let i = 0; i < n; i++) {
    const d = h * (i + 1) + r * (2 * i + 1);
    const p = { id: `${g.id}:${i}`, x: g.p0.x + g.dir.x * d, z: g.p0.z + g.dir.z * d, r, alto: altos[i % altos.length], grosor, material: g.material };
    if (g.moviles && i % 2 === 1 && P.mover) p.mueve = { ex: g.lado.x, ez: g.lado.z, ...P.mover, fase: i * 0.37 };
    out.push(p);
  }
  return out;
}

/**
 * Dónde está una plataforma que se mueve en el tiempo t (s): va y viene de lado, con una pausa en cada punta.
 * { x, z, quieta } (quieta: está en una pausa). Las que no se mueven, siempre en su lugar.
 */
export function posPlataforma(p, t) {
  if (!p.mueve) return { x: p.x, z: p.z, quieta: true };
  const { distancia, periodo, pausa, ex, ez, fase = 0 } = p.mueve;
  const viaje = Math.max(0.1, periodo / 2 - pausa);
  const T = periodo, u = (((t + fase * T) % T) + T) % T;
  let s, quieta = false; // s: de −1 a 1
  if (u < pausa) { s = -1; quieta = true; }
  else if (u < pausa + viaje) s = -Math.cos(((u - pausa) / viaje) * Math.PI);
  else if (u < 2 * pausa + viaje) { s = 1; quieta = true; }
  else s = Math.cos(((u - 2 * pausa - viaje) / viaje) * Math.PI);
  const off = (distancia / 2) * s;
  return { x: p.x + ex * off, z: p.z + ez * off, quieta };
}

/** Las islas vecinas de una (por cualquier conexión) */
export const vecinas = (red, id) => red.conexiones.filter((k) => k.de === id || k.a === id).map((k) => (k.de === id ? k.a : k.de));

/** Islas a las que se llega desde `desde` usando solo las conexiones que cumplen `usar` */
export function alcanzablesDesde(red, desde, usar = () => true) {
  const ok = new Set([desde]), cola = [desde];
  while (cola.length) {
    const u = cola.shift();
    for (const k of red.conexiones) {
      if (!usar(k)) continue;
      const v = k.de === u ? k.a : k.a === u ? k.de : null;
      if (v && !ok.has(v)) { ok.add(v); cola.push(v); }
    }
  }
  return ok;
}

/** ¿Hay al menos dos caminos sin conexiones en común de `a` a `b`? (quitando cualquier conexión, todavía se llega) */
export function variosCaminos(red, a, b) {
  return red.conexiones.every((q) => alcanzablesDesde(red, a, (k) => k !== q).has(b));
}

// ---------- Revisar los datos ----------

/** Errores en mundo/islas.json (lista vacía si todo está bien). mundo: mundo.json (Isla Noli = sus límites) */
export function revisarIslas(cfg, mundo, fisica = FISICA) {
  const e = [];
  const num = (v) => typeof v === "number" && isFinite(v);
  if (!cfg || !Array.isArray(cfg.islas)) return ["islas.json: faltan las islas"];
  const ids = new Set();
  for (const i of cfg.islas) {
    if (!i.id || ids.has(i.id)) e.push(`isla sin id o repetida: ${i.id}`);
    ids.add(i.id);
    if (!i.nombre) e.push(`${i.id}: falta el nombre`);
    if (!(i.forma && i.forma.tipo === "caja") && !(i.centro && num(i.centro.x) && num(i.centro.z))) e.push(`${i.id}: falta el centro`);
    if (!i.colores || !i.colores.suelo) e.push(`${i.id}: faltan los colores`);
  }
  if (!ids.has(INICIO)) e.push(`falta la isla "${INICIO}"`);
  const noli = cfg.islas.find((i) => i.id === INICIO);
  if (noli && mundo && mundo.limites) {
    const f = noli.forma || {}, l = mundo.limites;
    if (f.tipo !== "caja" || f.x0 !== l.x0 || f.x1 !== l.x1 || f.z0 !== l.z0 || f.z1 !== l.z1) e.push("noli: su forma debe ser la caja de mundo.limites");
  }
  if (!num(cfg.topeEstrellas) || cfg.topeEstrellas < 1) e.push("topeEstrellas debe ser un número");
  const minimo = cfg.costoMinimoEstrellas || 0;
  const kids = new Set();
  for (const k of cfg.conexiones || []) {
    if (!k.id || kids.has(k.id)) e.push(`conexión sin id o repetida: ${k.id}`);
    kids.add(k.id);
    if (!ids.has(k.de) || !ids.has(k.a)) { e.push(`${k.id}: une islas que no existen (${k.de}, ${k.a})`); continue; }
    if (k.de === k.a) e.push(`${k.id}: une una isla consigo misma`);
    if (!TIPOS.includes(k.tipo)) e.push(`${k.id}: "tipo" debe ser "puente" o "plataformas"`);
    if (k.costo !== null) {
      if (!k.costo || !Number.isInteger(k.costo.cristales) || !Number.isInteger(k.costo.estrellas) || k.costo.cristales < 0) e.push(`${k.id}: el costo debe ser { cristales, estrellas } o null`);
      else if (k.costo.estrellas < minimo) e.push(`${k.id}: cuesta ${k.costo.estrellas} estrellas; lo mínimo es ${minimo}`);
    }
  }
  if (e.length) return e;
  const red = armarIslas(cfg);
  // Que todas se alcancen solo con puentes (sin brincar): las plataformas son atajos, nunca el único camino
  const conPuentes = alcanzablesDesde(red, INICIO, (k) => k.tipo === "puente");
  for (const i of red.islas) if (!conPuentes.has(i.id)) e.push(`${i.id}: no se llega solo con puentes (sin brincar)`);
  // Que no se encimen las islas
  for (let x = 0; x < red.islas.length; x++) for (let y = x + 1; y < red.islas.length; y++) {
    if (separacionIslas(red.islas[x].f, red.islas[y].f) < 8) e.push(`${red.islas[x].id} y ${red.islas[y].id} están encimadas o muy juntas`);
  }
  for (const k of red.conexiones) {
    // Que no pase por encima de otra isla, ni se cruce con otra conexión
    for (const i of red.islas) {
      if (i.id === k.de || i.id === k.a) continue;
      if (segmentoIsla(k.p0, k.p1, i.f) < ANCHO_PUENTE) e.push(`${k.id}: pasa sobre ${i.id}`);
    }
    if (k.largo < 4) e.push(`${k.id}: muy corta (${k.largo.toFixed(1)} m)`);
    // Los extremos en la orilla de su isla
    const A = red.por.get(k.de).f, B = red.por.get(k.a).f;
    if (Math.abs(aOrilla(A, k.p0.x, k.p0.z)) > 0.05) e.push(`${k.id}: "desde" no está en la orilla de ${k.de}`);
    if (Math.abs(aOrilla(B, k.p1.x, k.p1.z)) > 0.05) e.push(`${k.id}: "hasta" no está en la orilla de ${k.a}`);
    if (k.plataformas) for (const msg of revisarSaltos(k, fisica)) e.push(msg);
  }
  for (let x = 0; x < red.conexiones.length; x++) for (let y = x + 1; y < red.conexiones.length; y++) {
    const p = red.conexiones[x], q = red.conexiones[y];
    if ([p.de, p.a].some((i) => i === q.de || i === q.a)) continue; // comparten una isla: se tocan ahí
    if (seCruzan(p.p0, p.p1, q.p0, q.p1)) e.push(`${p.id} y ${q.id} se cruzan`);
  }
  for (const i of red.islas) {
    const t = teletransportadorDe(i);
    if (aOrilla(i.f, t.x, t.z) < 3) e.push(`${i.id}: el teletransportador está muy cerca de la orilla`);
  }
  return e;
}

/** Distancia entre dos islas (aproximada para la caja: su círculo más cercano) */
function separacionIslas(f, g) {
  if (f.tipo === "caja" && g.tipo === "caja") return Math.max(0, f.x0 - g.x1, g.x0 - f.x1, f.z0 - g.z1, g.z0 - f.z1);
  if (f.tipo === "caja") return separacionIslas(g, f);
  if (g.tipo === "circulo") return Math.hypot(f.x - g.x, f.z - g.z) - f.r - g.r;
  const dx = Math.max(g.x0 - f.x, 0, f.x - g.x1), dz = Math.max(g.z0 - f.z, 0, f.z - g.z1);
  return Math.hypot(dx, dz) - f.r;
}

/** Qué tan lejos pasa el segmento a–b de la isla (negativo si entra) */
function segmentoIsla(a, b, f) {
  if (f.tipo === "circulo") return aSegmento(f.x, f.z, a.x, a.z, b.x, b.z) - f.r;
  let m = Infinity;
  for (let i = 0; i <= 40; i++) { const t = i / 40; m = Math.min(m, -aOrilla(f, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)); }
  return m;
}

function seCruzan(p1, p2, q1, q2) {
  const o = (a, b, c) => Math.sign((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x));
  return o(p1, p2, q1) !== o(p1, p2, q2) && o(q1, q2, p1) !== o(q1, q2, p2);
}

/**
 * Que cada brinco de un camino de plataformas se pueda dar con holgura (85 % de la altura, 75 % del alcance), aun con
 * las móviles en su peor punto (la de al lado en la otra punta).
 */
export function revisarSaltos(k, fis = FISICA, holgura = { alto: 0.85, lejos: 0.75 }) {
  const e = [], cfg = { ...FISICA, ...fis };
  const m = 2 * cfg.radio * cfg.margen;
  const ps = k.plataformas;
  const lat = (p) => (p.mueve ? p.mueve.distancia / 2 : 0);
  const salto = (sep, dh, quien) => {
    if (dh > cfg.brinco * holgura.alto) { e.push(`${k.id}: ${quien} está muy alto`); return; }
    const al = alcanceBrinco(dh, cfg);
    if (al === null || sep - m > al * holgura.lejos) e.push(`${k.id}: ${quien} está muy lejos (${sep.toFixed(2)} m)`);
  };
  // De la orilla a la primera y de la última a la otra orilla
  const ida = (p) => Math.hypot(p.x - k.p0.x, p.z - k.p0.z) - p.r;
  const vuelta = (p) => Math.hypot(p.x - k.p1.x, p.z - k.p1.z) - p.r;
  salto(Math.hypot(ida(ps[0]), lat(ps[0])), ps[0].alto, "la primera plataforma");
  salto(Math.hypot(vuelta(ps[ps.length - 1]), lat(ps[ps.length - 1])), -ps[ps.length - 1].alto, "la otra orilla");
  for (let i = 1; i < ps.length; i++) {
    const p = ps[i - 1], q = ps[i];
    const largo = Math.hypot(q.x - p.x, q.z - p.z), lado = lat(p) + lat(q);
    salto(Math.hypot(largo, lado) - p.r - q.r, Math.max(q.alto - p.alto, p.alto - q.alto), `la plataforma ${i + 1}`);
  }
  return e;
}

// ---------- Lo que se guarda: "_mundo" ----------

/**
 * Los datos del mundo en la versión 2, sin importar de dónde vengan (v1, vacío, roto):
 * { v: 2, rev, cristales: [ids], visitadas: [ids], conexiones: [ids], ultimaIsla, estrellas: { dadas: { isla: { juego: n } } } }
 * rev: lo sube el administrador al sobrescribir (al juntar, gana el rev más alto; con el mismo, se juntan).
 */
export function normalizar(d) {
  const o = d && typeof d === "object" ? d : {};
  const lista = (x) => (Array.isArray(x) ? [...new Set(x.filter((v) => typeof v === "string"))] : []);
  const dadas = {};
  const D = o.estrellas && o.estrellas.dadas && typeof o.estrellas.dadas === "object" ? o.estrellas.dadas : {};
  for (const [isla, js] of Object.entries(D)) {
    if (!js || typeof js !== "object") continue;
    for (const [j, n] of Object.entries(js)) if (Number.isInteger(n) && n > 0) (dadas[isla] = dadas[isla] || {})[j] = n;
  }
  const visitadas = lista(o.visitadas);
  if (!visitadas.includes(INICIO)) visitadas.unshift(INICIO);
  return {
    ...o, v: 2, rev: Number.isInteger(o.rev) ? o.rev : 0,
    cristales: lista(o.cristales), visitadas, conexiones: lista(o.conexiones),
    ultimaIsla: typeof o.ultimaIsla === "string" ? o.ultimaIsla : INICIO,
    estrellas: { dadas },
  };
}

/** Junta dos versiones de "_mundo" (dos aparatos sin conexión): no se pierde ni se duplica nada */
export function unirMundo(a, b) {
  const A = normalizar(a), B = normalizar(b);
  if (A.rev !== B.rev) return A.rev > B.rev ? A : B; // el administrador sobrescribió: gana su versión
  const u = (x, y) => [...new Set([...x, ...y])];
  const dadas = JSON.parse(JSON.stringify(A.estrellas.dadas));
  for (const [isla, js] of Object.entries(B.estrellas.dadas)) for (const [j, n] of Object.entries(js)) {
    dadas[isla] = dadas[isla] || {};
    dadas[isla][j] = Math.max(dadas[isla][j] || 0, n);
  }
  return { ...B, ...A, cristales: u(A.cristales, B.cristales), visitadas: u(A.visitadas, B.visitadas), conexiones: u(A.conexiones, B.conexiones), estrellas: { dadas } };
}

/** ¿Las dos versiones dicen lo mismo? */
export function mismoMundo(a, b) {
  const A = normalizar(a), B = normalizar(b);
  const ord = (x) => [...x].sort().join("|");
  const est = (d) => Object.entries(d).map(([i, js]) => Object.entries(js).map(([j, n]) => `${i}/${j}=${n}`)).flat().sort().join("|");
  return A.rev === B.rev && ord(A.cristales) === ord(B.cristales) && ord(A.visitadas) === ord(B.visitadas)
    && ord(A.conexiones) === ord(B.conexiones) && est(A.estrellas.dadas) === est(B.estrellas.dadas);
}

// ---------- Estrellas del mundo y costos ----------

/**
 * Suma las estrellas de una partida de un juego educativo, en la isla de donde se abrió, sin pasar del tope (5 por
 * isla y juego). { datos, ganadas } (datos: el mismo objeto si no cambió).
 */
export function sumarEstrellas(datos, { isla = INICIO, juego, estrellas, tope }) {
  const d = normalizar(datos);
  const antes = (d.estrellas.dadas[isla] && d.estrellas.dadas[isla][juego]) || 0;
  const despues = Math.min(tope, antes + Math.max(0, Math.trunc(estrellas) || 0));
  if (despues === antes) return { datos, ganadas: 0 };
  const dadas = { ...d.estrellas.dadas, [isla]: { ...(d.estrellas.dadas[isla] || {}), [juego]: despues } };
  return { datos: { ...d, estrellas: { dadas } }, ganadas: despues - antes };
}

/** Estrellas del mundo que ya dio un juego en una isla */
export const estrellasDeJuego = (datos, isla, juego) => {
  const d = normalizar(datos).estrellas.dadas;
  return (d[isla] && d[isla][juego]) || 0;
};

/** Lo que cuestan las conexiones construidas: { cristales, estrellas } */
function gastado(d, red) {
  const g = { cristales: 0, estrellas: 0 };
  for (const id of d.conexiones) {
    const k = red.porCon.get(id);
    if (k && k.costo) { g.cristales += k.costo.cristales; g.estrellas += k.costo.estrellas; }
  }
  return g;
}

/**
 * Lo que tiene para construir: { cristales, estrellas }. Lo gastado no se guarda como contador: sale de las
 * conexiones construidas (así juntar dos aparatos nunca cobra dos veces).
 * @param {string[]} cristalesValidos ids de los cristales que existen en el mundo
 */
export function disponibles(datos, red, cristalesValidos) {
  const d = normalizar(datos), ok = new Set(cristalesValidos);
  const g = gastado(d, red);
  let est = 0;
  for (const js of Object.values(d.estrellas.dadas)) for (const n of Object.values(js)) est += n;
  return { cristales: Math.max(0, d.cristales.filter((id) => ok.has(id)).length - g.cristales), estrellas: Math.max(0, est - g.estrellas) };
}

/**
 * ¿Se puede construir la conexión? { ok, pronto (sin costo todavía), hecha, faltan: { cristales, estrellas }, costo }
 */
export function puedeConstruir(datos, red, id, cristalesValidos) {
  const k = red.porCon.get(id), d = normalizar(datos);
  if (!k) return { ok: false, pronto: true, hecha: false, faltan: { cristales: 0, estrellas: 0 }, costo: null };
  if (d.conexiones.includes(id)) return { ok: false, pronto: false, hecha: true, faltan: { cristales: 0, estrellas: 0 }, costo: k.costo };
  if (!k.costo) return { ok: false, pronto: true, hecha: false, faltan: { cristales: 0, estrellas: 0 }, costo: null };
  const t = disponibles(d, red, cristalesValidos);
  const faltan = { cristales: Math.max(0, k.costo.cristales - t.cristales), estrellas: Math.max(0, k.costo.estrellas - t.estrellas) };
  return { ok: !faltan.cristales && !faltan.estrellas, pronto: false, hecha: false, faltan, costo: k.costo };
}

/** Los datos con la conexión construida (o null si no se puede) */
export function construir(datos, red, id, cristalesValidos) {
  if (!puedeConstruir(datos, red, id, cristalesValidos).ok) return null;
  const d = normalizar(datos);
  return { ...d, conexiones: [...d.conexiones, id] };
}

/** Los datos con una isla visitada (el mismo objeto si ya lo estaba y no cambió la última) */
export function conVisita(datos, isla) {
  const d = normalizar(datos);
  if (d.visitadas.includes(isla) && d.ultimaIsla === isla) return datos;
  return { ...d, visitadas: d.visitadas.includes(isla) ? d.visitadas : [...d.visitadas, isla], ultimaIsla: isla };
}

/** Estrellas que se pueden ganar en total con los juegos de unas islas (para revisar que alcancen para los puentes) */
export const estrellasPosibles = (juegosPorIsla, islas, tope) => [...islas].reduce((s, i) => s + (juegosPorIsla[i] || []).length * tope, 0);

// ---------- Lo que se ve y por dónde se camina ----------

/**
 * Qué conexiones existen ahora: las construidas (o todas, con `todas`). Y los muelles: las conexiones sin construir que
 * salen de una isla visitada (uno en cada orilla visitada).
 */
export function estadoRed(red, datos, { todas = false } = {}) {
  const d = normalizar(datos);
  const hechas = new Set(todas ? red.conexiones.map((k) => k.id) : d.conexiones.filter((id) => red.porCon.has(id)));
  const visitadas = new Set(d.visitadas);
  const muelles = [];
  for (const k of red.conexiones) {
    if (hechas.has(k.id)) continue;
    if (visitadas.has(k.de)) muelles.push({ id: k.id, isla: k.de, punto: k.p0, dir: k.dir });
    if (visitadas.has(k.a)) muelles.push({ id: k.id, isla: k.a, punto: k.p1, dir: { x: -k.dir.x, z: -k.dir.z } });
  }
  return { hechas, muelles, visitadas };
}

/** Los dos barandales de un tramo (de p a q, con ancho entre ellos), como sólidos "segmento" */
function barandales(id, p, q, lado, ancho = ANCHO_PUENTE) {
  const o = ancho / 2 + 0.12;
  return [-1, 1].map((s) => ({ id: `${id}:baranda${s > 0 ? "+" : "-"}`, tipo: "segmento",
    ax: p.x + lado.x * o * s, az: p.z + lado.z * o * s, bx: q.x + lado.x * o * s, bz: q.z + lado.z * o * s, g: 0.1, y0: 0, y1: 1.1 }));
}

/** Sólido de una plataforma de un camino (en su lugar de reposo; la vista la mueve) */
export const solidoPlataforma = (p, pos = p) => ({ id: p.id, tipo: "cilindro", x: pos.x, z: pos.z, r: p.r, y0: Math.max(0, p.alto - p.grosor), y1: p.alto, plataforma: p });

/**
 * Piso y sólidos de las islas para la física: zonas (islas, puentes construidos, muelles) y sólidos (barandales,
 * plataformas de los caminos construidos; las que se mueven van marcadas con `mueve`).
 */
export function mapaIslas(red, estado) {
  const zonas = red.islas.map((i) => (i.f.tipo === "caja" ? { tipo: "caja", x0: i.f.x0, x1: i.f.x1, z0: i.f.z0, z1: i.f.z1, isla: i.id } : { tipo: "circulo", x: i.f.x, z: i.f.z, r: i.f.r, isla: i.id }));
  const solidos = [];
  for (const k of red.conexiones) {
    if (!estado.hechas.has(k.id)) continue;
    if (k.tipo === "puente") {
      const p = { x: k.p0.x - k.dir.x * ENTRA, z: k.p0.z - k.dir.z * ENTRA }, q = { x: k.p1.x + k.dir.x * ENTRA, z: k.p1.z + k.dir.z * ENTRA };
      zonas.push({ tipo: "tira", ax: p.x, az: p.z, bx: q.x, bz: q.z, ancho: ANCHO_PUENTE, conexion: k.id });
      solidos.push(...barandales(k.id, k.p0, k.p1, k.lado));
    } else for (const p of k.plataformas) solidos.push(solidoPlataforma(p));
  }
  for (const m of estado.muelles) {
    const lado = { x: -m.dir.z, z: m.dir.x };
    const p = { x: m.punto.x - m.dir.x * ENTRA, z: m.punto.z - m.dir.z * ENTRA }, q = { x: m.punto.x + m.dir.x * MUELLE, z: m.punto.z + m.dir.z * MUELLE };
    zonas.push({ tipo: "tira", ax: p.x, az: p.z, bx: q.x, bz: q.z, ancho: ANCHO_PUENTE, muelle: m.id });
    solidos.push(...barandales("muelle:" + m.id + ":" + m.isla, m.punto, q, lado));
    // Al final del muelle, otra baranda: no se cae al agua por la punta
    const o = ANCHO_PUENTE / 2 + 0.12;
    solidos.push({ id: `muelle:${m.id}:${m.isla}:punta`, tipo: "segmento", ax: q.x - lado.x * o, az: q.z - lado.z * o, bx: q.x + lado.x * o, bz: q.z + lado.z * o, g: 0.1, y0: 0, y1: 1.1 });
  }
  return { zonas, solidos };
}

/** Límites de todo el archipiélago (con un margen de mar) */
export function limitesRed(red, margen = 30) {
  const l = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const i of red.islas) {
    const f = i.f, x0 = f.tipo === "caja" ? f.x0 : f.x - f.r, x1 = f.tipo === "caja" ? f.x1 : f.x + f.r;
    const z0 = f.tipo === "caja" ? f.z0 : f.z - f.r, z1 = f.tipo === "caja" ? f.z1 : f.z + f.r;
    l.x0 = Math.min(l.x0, x0 - margen); l.x1 = Math.max(l.x1, x1 + margen); l.z0 = Math.min(l.z0, z0 - margen); l.z1 = Math.max(l.z1, z1 + margen);
  }
  return l;
}

/** La isla en la que está (x, z) parado en el piso, o null (en el mar, en un puente o en una plataforma) */
export function islaEn(red, x, z) {
  for (const i of red.islas) if (dentro(i.f, x, z)) return i;
  return null;
}

/** El muelle en el que está parado (sobre el agua), o null */
export function muelleEn(estado, x, z) {
  for (const m of estado.muelles) {
    const t = (x - m.punto.x) * m.dir.x + (z - m.punto.z) * m.dir.z;
    const l = Math.abs((x - m.punto.x) * -m.dir.z + (z - m.punto.z) * m.dir.x);
    if (t > -0.6 && t < MUELLE + 0.3 && l < ANCHO_PUENTE / 2 + 0.3) return m;
  }
  return null;
}

/** Dónde está el teletransportador de una isla */
export const teletransportadorDe = (isla) => isla.teletransportador || (isla.c ? { ...isla.c } : { ...isla.centro });

/** ¿Está parado en el teletransportador de su isla? (radio 1.4 m) */
export function enTeletransportador(red, c) {
  if (c.y > 0.3) return null;
  for (const i of red.islas) { const t = teletransportadorDe(i); if (Math.hypot(c.x - t.x, c.z - t.z) < 1.4) return i; }
  return null;
}

/**
 * Lo que se ve en el mapa: cada isla "visitada" (completa), "vista" (vecina de una visitada: silueta con «?») u
 * "oculta" (tapada por nubes); cada conexión "hecha" (construida), "vista" (sin construir pero con un extremo
 * visitado) u "oculta".
 */
export function vistaMapa(red, datos, { todo = false } = {}) {
  const d = normalizar(datos), visit = new Set(d.visitadas), hechas = new Set(d.conexiones);
  const islas = {}, conexiones = {};
  for (const i of red.islas) islas[i.id] = todo || visit.has(i.id) ? "visitada" : "oculta";
  for (const k of red.conexiones) {
    const toca = visit.has(k.de) || visit.has(k.a);
    conexiones[k.id] = todo || hechas.has(k.id) ? "hecha" : toca ? "vista" : "oculta";
    if (!todo && toca) for (const i of [k.de, k.a]) if (islas[i] === "oculta") islas[i] = "vista";
  }
  return { islas, conexiones };
}

// ---------- Isla Noli: lo que hay que dejar libre ----------

/**
 * Las salidas de Isla Noli hacia sus conexiones: { id, orilla (en el borde), adentro (2.5 m hacia adentro) }.
 * Al decorar se deja libre un pasillo de la orilla hacia adentro y "Ir a…" las conoce como puntos de paso.
 */
export function salidasNoli(red) {
  const out = [];
  for (const k of red.conexiones) {
    if (k.de !== INICIO && k.a !== INICIO) continue;
    const o = k.de === INICIO ? k.p0 : k.p1, d = k.de === INICIO ? k.dir : { x: -k.dir.x, z: -k.dir.z };
    out.push({ id: k.id, orilla: o, adentro: { x: o.x - d.x * 2.5, z: o.z - d.z * 2.5 }, lejos: { x: o.x - d.x * 9, z: o.z - d.z * 9 } });
  }
  return out;
}

/** Lo que la decoración de Isla Noli deja libre: los pasillos a las salidas y el teletransportador */
export function libresNoli(red) {
  const t = teletransportadorDe(red.por.get(INICIO));
  return { segmentos: salidasNoli(red).map((s) => ({ a: s.orilla, b: s.lejos, r: ANCHO_PUENTE / 2 + 1.2 })), puntos: [{ x: t.x, z: t.z, r: 2.4 }] };
}

// ---------- El mapa ilustrado (#165) ----------

/**
 * Dónde se dibuja en el mapa de Petra un punto del mundo: { u, v } (0 a 1 del dibujo), o null si no hay mapa ilustrado.
 * En una isla: alrededor de su centro en el dibujo (las islas del dibujo no tienen la misma forma que las del mundo,
 * así que se acomoda dentro del 75 % de su radio). En un puente o camino de plataformas: entre las dos islas.
 */
export function puntoMapa(red, x, z) {
  const M = red.cfg.mapa;
  if (!M || red.islas.some((i) => !i.mapa)) return null;
  const rx = M.r, ry = M.r * (M.ancho / M.alto) * 0.62;
  const centro = (i) => ({ u: i.mapa.u, v: i.mapa.v });
  const enIsla = (i, x, z) => {
    const f = i.f, c = i.c;
    const ox = f.tipo === "caja" ? (x - c.x) / ((f.x1 - f.x0) / 2) : (x - c.x) / f.r;
    const oz = f.tipo === "caja" ? (z - c.z) / ((f.z1 - f.z0) / 2) : (z - c.z) / f.r;
    const l = Math.hypot(ox, oz), k = l > 1 ? 1 / l : 1;
    return { u: i.mapa.u + ox * k * rx * 0.75, v: i.mapa.v + oz * k * ry * 0.75 };
  };
  const i = islaEn(red, x, z);
  if (i) return enIsla(i, x, z);
  // Lo más cercano: una conexión (por dónde va de una orilla a la otra) o la orilla de una isla
  let mejor = null, md = Infinity;
  for (const k of red.conexiones) {
    const vx = k.p1.x - k.p0.x, vz = k.p1.z - k.p0.z;
    const t = Math.max(0, Math.min(1, ((x - k.p0.x) * vx + (z - k.p0.z) * vz) / (vx * vx + vz * vz)));
    const d = Math.hypot(x - (k.p0.x + vx * t), z - (k.p0.z + vz * t));
    if (d < md) {
      md = d;
      const A = enIsla(red.por.get(k.de), k.p0.x, k.p0.z), B = enIsla(red.por.get(k.a), k.p1.x, k.p1.z);
      mejor = { u: A.u + (B.u - A.u) * t, v: A.v + (B.v - A.v) * t };
    }
  }
  for (const s of red.islas) {
    const d = -aOrilla(s.f, x, z);
    if (d < md) { md = d; mejor = enIsla(s, x, z); }
  }
  return mejor || centro(red.islas[0]);
}
