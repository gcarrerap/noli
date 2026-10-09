// Prendas hechas en Blender (archivos .glb en modelos/). La mayoría de la ropa se arma con formas (formas.js), pero
// una prenda puede traer "modelo": "modelos/corona-gema.glb" en prendas.json. Aquí se cargan una vez, se copian para
// cada uso y se pintan: los materiales llamados "principal" toman el color escogido, los "secundario" el secundario,
// y los demás se quedan como vienen. Cómo hacer uno: docs/ASSETS.md § Prendas con Blender.
import * as THREE from "../../../../kit/3d/vendor/three.module.min.js";
import { GLTFLoader } from "../../../../kit/3d/vendor/GLTFLoader.js";
import { material } from "../../../../kit/3d/materiales.js";

const cargados = new Map(); // id de prenda → escena del glb (original, no se pone en el personaje)
let loader = null;

/**
 * Carga el .glb de una prenda (una sola vez). Promesa que se cumple al terminar.
 * @param {{ id: string, modelo: string }} prenda
 * @param {string} [base] carpeta del juego relativa a la página ("" en index.html, "../" en herramientas/)
 */
export function cargarModelo(prenda, base = "") {
  if (cargados.has(prenda.id)) return Promise.resolve(cargados.get(prenda.id));
  loader = loader || new GLTFLoader();
  return new Promise((ok, mal) => loader.load(base + prenda.modelo, (gltf) => { cargados.set(prenda.id, gltf.scene); ok(gltf.scene); },
    undefined, () => mal(new Error(`No se pudo cargar ${prenda.modelo}`))));
}

/** ¿Ya está cargado el modelo de esta prenda? */
export const modeloListo = (prenda) => cargados.has(prenda.id);

/**
 * Una copia del modelo de la prenda, pintada y colocada (pos/rot/esc de la prenda), lista para pegarla a su ancla.
 * Si todavía no se ha cargado devuelve null (el personaje se vuelve a vestir cuando termine de cargar).
 * @param {{ id, pos?, rot?, esc?, brillo? }} prenda
 * @param {(col: string) => string} colorDe "p" | "s" → #hex
 * @returns {THREE.Object3D | null}
 */
export function modeloPara(prenda, colorDe) {
  const original = cargados.get(prenda.id);
  if (!original) return null;
  const copia = original.clone(true);
  copia.traverse((o) => {
    if (!o.isMesh) return;
    const nombre = (o.material && o.material.name || "").toLowerCase();
    if (nombre.startsWith("principal")) o.material = material(colorDe("p"), { brillo: !!prenda.brillo });
    else if (nombre.startsWith("secundario")) o.material = material(colorDe("s"), { brillo: !!prenda.brillo });
    o.userData.prenda = true;
  });
  const RAD = Math.PI / 180;
  if (prenda.pos) copia.position.set(...prenda.pos);
  if (prenda.rot) copia.rotation.set(prenda.rot[0] * RAD, prenda.rot[1] * RAD, prenda.rot[2] * RAD);
  if (prenda.esc) copia.scale.set(...prenda.esc);
  return copia;
}
