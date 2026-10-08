// Navegación con flechas para cualquier pantalla de un juego: mueve el foco al botón más cercano en esa
// dirección, según dónde está dibujado. Así un juego no tiene que llevar la cuenta de filas y columnas.
//
//   import { moverFoco } from "../../kit/noli.js";
//   Noli.alEntrar((a) => { if (moverFoco(a)) return; if (a === "ok") document.activeElement.click(); });
//
// Considera los elementos con [data-foco] dentro de `raiz` que se ven en pantalla. Devuelve true si la acción
// era una flecha (aunque no haya a dónde moverse).

const DIR = { arriba: [0, -1], abajo: [0, 1], izquierda: [-1, 0], derecha: [1, 0] };

// Escoge el índice del mejor candidato. Puro (recibe rectángulos), para poder probarlo sin navegador.
// rects: [{ x, y, w, h }]; actual: índice o -1
export function elegir(rects, actual, accion) {
  const d = DIR[accion];
  if (!d || !rects.length) return actual;
  if (actual < 0) return 0;
  const c = (r) => [r.x + r.w / 2, r.y + r.h / 2];
  const [ax, ay] = c(rects[actual]);
  let mejor = actual, mejorPeso = Infinity;
  rects.forEach((r, i) => {
    if (i === actual) return;
    const [bx, by] = c(r);
    const dx = bx - ax, dy = by - ay;
    const avance = dx * d[0] + dy * d[1];        // cuánto avanza en la dirección pedida
    if (avance <= 1) return;
    const lateral = Math.abs(dx * d[1]) + Math.abs(dy * d[0]); // cuánto se desvía
    const peso = avance + lateral * 2;
    if (peso < mejorPeso) { mejorPeso = peso; mejor = i; }
  });
  return mejor;
}

export function moverFoco(accion, raiz = document) {
  if (!DIR[accion]) return false;
  const els = [...raiz.querySelectorAll("[data-foco]")].filter((e) => !e.disabled && e.offsetParent !== null);
  if (!els.length) return true;
  const rects = els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const i = elegir(rects, els.indexOf(document.activeElement), accion);
  els[i].focus();
  document.documentElement.classList.add("teclado");
  return true;
}

// Pone el foco en el primer [data-foco] (o en el marcado con data-foco="inicial")
export function focoInicial(raiz = document) {
  const e = raiz.querySelector('[data-foco="inicial"]') || raiz.querySelector("[data-foco]");
  if (e) e.focus({ preventScroll: true });
}
