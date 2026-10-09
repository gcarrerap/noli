// Materiales de la escena, guardados por color para reusarlos (crear un material por pieza llena la memoria de la
// TV). Estilo caricatura: MeshToonMaterial con tres tonos de luz. Las prendas con "brillo" usan Phong con reflejo.
// Ver docs/ESCENA-3D.md § Materiales.
import * as THREE from "../../vendor/three.module.min.js";

let degradado = null;
/** Textura de 3 tonos para el sombreado de caricatura (sombra, medio, luz) */
function tonos() {
  if (degradado) return degradado;
  degradado = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
  degradado.minFilter = degradado.magFilter = THREE.NearestFilter;
  degradado.needsUpdate = true;
  return degradado;
}

const cache = new Map();

/**
 * Material para un color (cacheado).
 * @param {string} hex "#ff7eb6"
 * @param {{ brillo?: boolean, opacidad?: number, dobleCara?: boolean, emisivo?: number }} [op]
 * @returns {THREE.Material}
 */
export function material(hex, op = {}) {
  const clave = [hex, op.brillo ? 1 : 0, op.opacidad || 1, op.dobleCara ? 1 : 0, op.emisivo || 0].join("|");
  let m = cache.get(clave);
  if (m) return m;
  const base = { color: new THREE.Color(hex), side: op.dobleCara ? THREE.DoubleSide : THREE.FrontSide };
  if (op.opacidad && op.opacidad < 1) Object.assign(base, { transparent: true, opacity: op.opacidad, depthWrite: false });
  if (op.brillo) m = new THREE.MeshPhongMaterial({ ...base, shininess: 90, specular: new THREE.Color("#ffffff") });
  else m = new THREE.MeshToonMaterial({ ...base, gradientMap: tonos() });
  if (op.emisivo) { m.emissive = new THREE.Color(hex); m.emissiveIntensity = op.emisivo; }
  cache.set(clave, m);
  return m;
}

/** Libera todos los materiales (al salir del juego) */
export function liberarMateriales() {
  for (const m of cache.values()) m.dispose();
  cache.clear();
  if (degradado) { degradado.dispose(); degradado = null; }
}
