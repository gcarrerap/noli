// Cuadrícula: caber, girar y no encimar. Puro.

function paridad(rot) {
  const n = Math.trunc(Number(rot) || 0);
  return ((n % 2) + 2) % 2;
}

/** Girar cambia largo y ancho. Dos giros vuelven al mismo tamaño. */
export function formaDe(mueble, rot = 0) {
  const i = paridad(rot);
  const swap = i === 1;
  const w = swap ? mueble.h : mueble.w;
  const h = swap ? mueble.w : mueble.h;
  const formas = mueble?.formas;
  if (formas?.length) {
    const exacta = formas.find((f) => f.w === w && f.h === h);
    return {
      w,
      h,
      archivo: (exacta && exacta.archivo) || mueble.archivo,
      giro: exacta ? (exacta.giro || 0) : (swap ? 90 : 0),
      i,
    };
  }
  return { w, h, archivo: mueble.archivo, giro: swap ? 90 : 0, i };
}

/**
 * Lado de cada cuadro del cuarto, en px.
 * Bajo 400 px se queda en 44. Si hay sitio, crece sin salirse:
 * 6 columnas, el borde de 6 px y el relleno de 24 px caben en el ancho.
 * Nunca pasa de 62, para que a 412 px no haya scroll de lado.
 */
export function tamCuadro(ancho) {
  const n = Number(ancho) || 0;
  if (n < 400) return 44;
  const c = Math.floor((n - 24 - 6) / 6);
  return Math.max(44, Math.min(62, c));
}

export function dentro(cuarto, x, y, w, h) {
  return !!cuarto && x >= 0 && y >= 0 && x + w <= cuarto.cols && y + h <= cuarto.filas;
}

export function solapa(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function choques(puestos, cuartoId, x, y, w, h) {
  const box = { x, y, w, h };
  return (puestos || []).filter((p) => p.cuarto === cuartoId && solapa(p, box));
}

export function cabe(cuarto, puestos, x, y, w, h) {
  if (!dentro(cuarto, x, y, w, h)) return false;
  return choques(puestos, cuarto.id, x, y, w, h).length === 0;
}

/** Girar en el mismo cuadro hace que quepa (y ahora no cabe). */
export function girarAyuda(cuarto, puestos, x, y, mueble, rot) {
  const ahora = formaDe(mueble, rot);
  const luego = formaDe(mueble, rot + 1);
  if (cabe(cuarto, puestos, x, y, ahora.w, ahora.h)) return false;
  return cabe(cuarto, puestos, x, y, luego.w, luego.h);
}

export function mover(cuarto, x, y, w, h, dir) {
  const d = { arriba: [0, -1], abajo: [0, 1], izquierda: [-1, 0], derecha: [1, 0] }[dir];
  if (!d || !cuarto) return { x, y };
  let nx = x + d[0];
  let ny = y + d[1];
  const maxX = Math.max(0, cuarto.cols - w);
  const maxY = Math.max(0, cuarto.filas - h);
  if (nx < 0) nx = 0;
  if (ny < 0) ny = 0;
  if (nx > maxX) nx = maxX;
  if (ny > maxY) ny = maxY;
  return { x: nx, y: ny };
}

/** El cuadro que tocó queda dentro del mueble, sin salirse del cuarto. */
export function ponerEn(cuarto, cx, cy, w, h) {
  let x = cx;
  let y = cy;
  if (cuarto) {
    if (x + w > cuarto.cols) x = Math.max(0, cuarto.cols - w);
    if (y + h > cuarto.filas) y = Math.max(0, cuarto.filas - h);
    if (x < 0) x = 0;
    if (y < 0) y = 0;
  }
  return { x, y };
}

export function celdas(x, y, w, h) {
  const out = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) out.push([x + dx, y + dy]);
  return out;
}

/** La alfombra de 6 acepta 2 por 3 y 1 por 6. Girar solo intercambia largo y ancho. */
export function formasAlfombra(mueble) {
  const vistos = [];
  const agregar = (w, h) => {
    const clave = `${w}x${h}`;
    if (!vistos.includes(clave)) vistos.push(clave);
  };
  for (const f of mueble?.formas || []) agregar(f.w, f.h);
  for (let r = 0; r < 2; r++) {
    const f = formaDe(mueble, r);
    agregar(f.w, f.h);
  }
  return vistos;
}

export function aceptaSeis(mueble) {
  const f = formasAlfombra(mueble);
  return f.includes("2x3") && f.includes("3x2") && f.includes("1x6") && f.includes("6x1");
}
