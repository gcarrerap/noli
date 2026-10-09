// Los cortes viven en datos. Aquí solo se leen, se dibujan como <line>
// y se miden con las pruebas de área.

import { analizar, sonIguales, rebanadas, pathDe } from "./area.js";
import { revolver } from "./rng.js";

export function patron(banco, id) {
  return (banco.patrones || []).find((p) => p.id === id) || null;
}

export function lineasSvg(cortes) {
  return (cortes || []).map((c) => `<line x1="${c.x1}" y1="${c.y1}" x2="${c.x2}" y2="${c.y2}"/>`).join("");
}

export function medir(p) {
  const r = analizar(p.forma, p.cortes);
  return { partes: r.partes, areas: r.areas, iguales: sonIguales(r.areas) && r.partes === p.partes };
}

export function rebanadasDe(p) {
  return rebanadas(p.forma, p.cortes);
}

export { pathDe };

function pool(banco, fn) {
  return (banco.patrones || []).filter((p) => !p.guia && fn(p));
}

export function opcionesCorte(banco, rnd, { partes, familia, facil = false, forzarParalelos = false, preferirForma = null }) {
  let buenas = pool(banco, (p) => p.iguales && p.partes === partes && (!familia || p.familia === familia));
  if (preferirForma) {
    const especiales = buenas.filter((p) => p.formaPieza === preferirForma);
    if (especiales.length) buenas = especiales;
  }
  const correcta = buenas[Math.floor(rnd() * buenas.length)];
  let trampas = pool(banco, (p) => p.id !== correcta.id && !p.iguales);
  if (forzarParalelos) {
    const par = pool(banco, (p) => p.trampa === "paralelos");
    trampas = trampas.filter((p) => p.trampa !== "paralelos");
    const otras = revolver(rnd, trampas).slice(0, facil ? 0 : 1);
    const opciones = revolver(rnd, [correcta, ...par, ...otras]);
    return { opciones, correcta: correcta.id };
  }
  const nTrampas = facil ? 1 : 2;
  const elegidas = revolver(rnd, trampas).slice(0, nTrampas);
  const opciones = revolver(rnd, [correcta, ...elegidas]);
  return { opciones, correcta: correcta.id };
}

export function svgPila(caras) {
  const colores = ["#ff6b4a", "#4cb3ff", "#ffc43d", "#c86bfa", "#3ccf8e"];
  const paths = caras.map((r, i) => {
    const pts = r.puntos.map((p) => [p[0] - r.centro[0], p[1] - r.centro[1]]);
    return `<path d="${pathDe(pts)}" fill="${colores[i % colores.length]}" fill-opacity=".5" stroke="#2b2236" stroke-width="3"/>`;
  }).join("");
  return `<svg viewBox="-110 -110 220 220" aria-hidden="true">${paths}</svg>`;
}
