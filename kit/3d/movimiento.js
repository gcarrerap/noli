// Moverse en 3D sin girar la cámara: ángulos, seguir una ruta y flechas → dirección. Lógica pura (no usa Three.js).
// Lo usan la Pasarela (minijuegos/pasarela/src/movimiento.js, que agrega los choques del estudio) y el mundo del
// menú principal (src/mundo/, que agrega brincos y plataformas con kit/3d/fisica.js).
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

/**
 * Para botones que no deben repetirse (brincar): una tecla mantenida manda keydown una y otra vez (y el control de
 * la TV no siempre marca `repeat`). Cuenta como pulsación nueva solo si pasaron `ms` desde el último evento.
 * @returns {(ahora: number) => boolean}
 */
export function crearPulsador(ms = 250) {
  let ultimo = -Infinity;
  return (ahora) => { const nueva = ahora - ultimo > ms; ultimo = ahora; return nueva; };
}
