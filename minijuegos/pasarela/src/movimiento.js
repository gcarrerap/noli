// Moverse por el estudio: caminar, chocar con muebles y paredes, saber qué zona está cerca y caminar sola hasta
// una zona. Lógica pura (no sabe nada de Three.js); la escena solo dibuja donde esto diga. Ver docs/ESCENA-3D.md.
//
// Coordenadas del piso: x (izquierda − / derecha +, vista desde la cámara) y z (fondo − / frente +).
// La cámara nunca gira: "arriba" en el joystick o en las flechas siempre es hacia el fondo de la pantalla.
// Ángulo del personaje (grados): 0 = mira al fondo (−z), 90 = mira a la izquierda (−x), −90 = a la derecha (+x).

const RAD = Math.PI / 180;

/** Dirección (x, z) a la que mira un ángulo */
export const direccion = (ang) => ({ x: -Math.sin(ang * RAD), z: -Math.cos(ang * RAD) });
/** Ángulo de una dirección (x, z) */
export const anguloDe = (x, z) => Math.atan2(-x, -z) / RAD;
/** Diferencia de ángulos en (−180, 180] */
export function difAngulo(a, b) {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/**
 * Cajas con las que se choca (vista de arriba): las paredes del estudio, los muebles de las zonas y los obstáculos.
 * Una caja es { x0, x1, z0, z1 }.
 * @param {{ zonas: {mueble: {caja}}[], obstaculos?: {caja}[] }} zonas zonas.json
 * @returns {{ cajas: {x0,x1,z0,z1}[], limites: {x0,x1,z0,z1} }}
 */
export function mapaDeChoques(zonas, estudio = { ancho: 12, fondo: 10 }) {
  const aCaja = ([x, z, w, d]) => ({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
  const cajas = [...zonas.zonas.map((zn) => aCaja(zn.mueble.caja)), ...(zonas.obstaculos || []).map((o) => aCaja(o.caja))];
  return { cajas, limites: { x0: -estudio.ancho / 2, x1: estudio.ancho / 2, z0: -estudio.fondo / 2, z1: estudio.fondo / 2 } };
}

/** ¿Un círculo de radio r en (x, z) choca con algo? */
export function choca(x, z, r, mapa) {
  const l = mapa.limites;
  if (x - r < l.x0 || x + r > l.x1 || z - r < l.z0 || z + r > l.z1) return true;
  for (const c of mapa.cajas) {
    const cx = Math.max(c.x0, Math.min(x, c.x1)), cz = Math.max(c.z0, Math.min(z, c.z1));
    if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return true;
  }
  return false;
}

/**
 * Un paso de caminar. Se desliza junto a las paredes: si el paso completo choca, prueba solo en x y solo en z.
 * El personaje gira poco a poco hacia donde camina (sin girar de golpe).
 * @param {{x, z, ang}} pos
 * @param {{x: number, z: number}} quiere dirección deseada en pantalla (largo 0 a 1: joystick a medias = más lento)
 * @param {number} dt segundos
 * @param {{velocidad: number, giro: number, radio: number}} cfg velocidad en m/s, giro en grados/s
 * @param {object} mapa de mapaDeChoques
 * @returns {{x, z, ang, caminando: boolean}}
 */
export function paso(pos, quiere, dt, cfg, mapa) {
  let largo = Math.hypot(quiere.x, quiere.z);
  if (largo < 0.08) return { ...pos, caminando: false };
  if (largo > 1) { quiere = { x: quiere.x / largo, z: quiere.z / largo }; largo = 1; }
  const v = cfg.velocidad * dt;
  const dx = quiere.x * v, dz = quiere.z * v;
  let { x, z } = pos;
  if (!choca(x + dx, z + dz, cfg.radio, mapa)) { x += dx; z += dz; }
  else if (!choca(x + dx, z, cfg.radio, mapa)) x += dx;
  else if (!choca(x, z + dz, cfg.radio, mapa)) z += dz;
  const objetivo = anguloDe(quiere.x, quiere.z);
  const d = difAngulo(pos.ang, objetivo);
  const max = cfg.giro * dt;
  const ang = pos.ang + Math.max(-max, Math.min(max, d));
  return { x, z, ang, caminando: true };
}

/**
 * La zona más cercana a la que el personaje está "llegando" (dentro de su radio), o null.
 * @param {{x, z}} pos
 * @param {{id, punto: [number, number], radio}[]} zonas
 */
export function zonaCercana(pos, zonas) {
  let mejor = null, md = Infinity;
  for (const zn of zonas) {
    const d = Math.hypot(pos.x - zn.punto[0], pos.z - zn.punto[1]);
    if (d <= zn.radio && d < md) { md = d; mejor = zn; }
  }
  return mejor;
}

/**
 * Ruta para caminar sola hasta una zona (con "Ir a…" en la TV o tocando un mueble): primero al centro del estudio
 * (que está libre) y luego al punto de la zona. Si ya está cerca del camino directo sin choques, va directo.
 * @returns {{x, z}[]} puntos a seguir
 */
export function rutaHacia(pos, zona, mapa, radio = 0.35) {
  const destino = { x: zona.punto[0], z: zona.punto[1] };
  if (libre(pos, destino, mapa, radio)) return [destino];
  const centro = { x: 0, z: 0.8 };
  return [centro, destino];
}

/** ¿Se puede ir en línea recta de a a b sin chocar? (revisa cada 10 cm) */
export function libre(a, b, mapa, radio) {
  const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(d / 0.1));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (choca(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, radio, mapa)) return false;
  }
  return true;
}

/**
 * Hacia dónde caminar para seguir una ruta: devuelve la dirección deseada y la ruta que queda (quita los puntos a
 * los que ya llegó). Al terminar devuelve dirección 0.
 * @param {{x, z}} pos
 * @param {{x, z}[]} ruta
 */
export function seguirRuta(pos, ruta) {
  let r = ruta;
  while (r.length && Math.hypot(r[0].x - pos.x, r[0].z - pos.z) < 0.12) r = r.slice(1);
  if (!r.length) return { quiere: { x: 0, z: 0 }, ruta: r };
  const dx = r[0].x - pos.x, dz = r[0].z - pos.z, d = Math.hypot(dx, dz);
  const f = Math.min(1, d / 0.4); // frena al llegar
  return { quiere: { x: (dx / d) * Math.max(f, 0.35), z: (dz / d) * Math.max(f, 0.35) }, ruta: r };
}

/**
 * Teclas → dirección. Cada flecha del control "empuja" un ratito (impulsoMs); como el control y el teléfono repiten la
 * tecla mientras se mantiene apretada, el personaje camina mientras se aprieta. Dos flechas a la vez = diagonal.
 * @param {Object<string, number>} hasta { arriba: ms, abajo: ms, ... } hasta cuándo empuja cada flecha
 * @param {number} ahora ms
 */
export function direccionDeTeclas(hasta, ahora) {
  const on = (k) => (hasta[k] || 0) > ahora;
  return { x: (on("derecha") ? 1 : 0) - (on("izquierda") ? 1 : 0), z: (on("abajo") ? 1 : 0) - (on("arriba") ? 1 : 0) };
}
