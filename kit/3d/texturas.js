// Texturas para la ropa: patrones que se repiten (cebra, puntos…), estampados (un osito en el pecho) y dibujos en
// pixeles. Todo sale de un SVG con marcadores de color o de una imagen, se dibuja UNA vez en un canvas chico y se
// guarda por (arte, colores): la TV tiene poca memoria de video. Ver minijuegos/pasarela/docs/ESCENA-3D.md § Texturas.
//
// Marcadores de color en los SVG (los cambia pintarSVG antes de dibujar):
//   {p} color principal de la prenda · {s} color secundario · {t} tinta: negro o blanco, el que contraste con {p}
//   {m} mitad entre {p} y {t} (sombras, centros de las manchas) · {c} color de la calcomanía (si no hay, {t})
// Sin `document` (en las pruebas con Node) no hay texturas: las funciones devuelven null y la ropa sale lisa.
import * as THREE from "./vendor/three.module.min.js";
export { luz, tinta, mezcla, pintarSVG, interiorSVG } from "./pintar.js";

const cache = new Map();

const hayDOM = () => typeof document !== "undefined" && typeof Image !== "undefined";

function lienzo(tam) {
  const c = document.createElement("canvas");
  c.width = c.height = tam;
  return c;
}

/**
 * Textura de un SVG con sus colores (cacheada). Se crea al momento con el color de fondo y se dibuja el SVG en
 * cuanto carga (las imágenes SVG cargan solas, sin red: van en un data: URL).
 * @param {string} svg el SVG ya pintado (pintarSVG)
 * @param {{ repetir?: boolean, tam?: number, fondo?: string }} [op] repetir: patrón (RepeatWrapping); fondo: color mientras carga
 * @returns {THREE.Texture | null}
 */
export function texturaSVG(svg, op = {}) {
  if (!hayDOM()) return null;
  const clave = (op.repetir ? "R" : "U") + (op.tam || 256) + svg;
  if (cache.has(clave)) return cache.get(clave);
  const tam = op.tam || 256, c = lienzo(tam), ctx = c.getContext("2d");
  if (op.fondo) { ctx.fillStyle = op.fondo; ctx.fillRect(0, 0, tam, tam); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (op.repetir) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 2;
  const img = new Image();
  img.onload = () => { ctx.clearRect(0, 0, tam, tam); ctx.drawImage(img, 0, 0, tam, tam); tex.needsUpdate = true; };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  cache.set(clave, tex);
  return tex;
}

/**
 * Textura de una imagen (PNG con fondo transparente: un dibujo de Noelia fotografiado). No cambia de color.
 * @param {string} url
 * @returns {THREE.Texture | null}
 */
export function texturaImagen(url) {
  if (!hayDOM()) return null;
  if (cache.has(url)) return cache.get(url);
  const tex = new THREE.TextureLoader().load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(url, tex);
  return tex;
}

/**
 * Textura de un dibujo en pixeles (fase 3: estampados que dibuja Noelia). Se ve pixelado a propósito (sin suavizar).
 * @param {string} clave para el caché (el dibujo comprimido + colores)
 * @param {number} lado pixeles por lado
 * @param {(string|null)[]} colores un #hex (o null = transparente) por pixel, renglón por renglón desde arriba
 * @returns {THREE.Texture | null}
 */
export function texturaPixeles(clave, lado, colores) {
  if (!hayDOM()) return null;
  const k = "X" + clave;
  if (cache.has(k)) return cache.get(k);
  const c = lienzo(lado), ctx = c.getContext("2d");
  colores.forEach((hex, i) => { if (hex) { ctx.fillStyle = hex; ctx.fillRect(i % lado, Math.floor(i / lado), 1, 1); } });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  cache.set(k, tex);
  return tex;
}

/** Libera las texturas (al salir del juego) */
export function liberarTexturas() {
  for (const t of cache.values()) t.dispose();
  cache.clear();
}
