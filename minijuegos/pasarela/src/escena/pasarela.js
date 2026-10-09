// El escenario de la pasarela: una pasarela larga con focos, la pared del fondo con estrellas y la mesa de los tres
// jueces (que son personajes como el de Noelia, con su propia ropa). Está lejos del estudio (en z = −30), así la
// cámara salta de un lugar al otro sin que se vea el cambio. Ver docs/ESCENA-3D.md § La pasarela.
import * as THREE from "../../../../kit/3d/vendor/three.module.min.js";
import { material } from "../../../../kit/3d/materiales.js";
import { crearAvatar } from "../../../../kit/3d/avatar.js";
import { atuendoVacio, poner } from "../atuendo.js";

/** Dónde está el escenario y por dónde camina el personaje */
export const ESCENARIO = Object.freeze({ z0: -30, inicio: -36.2, fin: -30.6, alto: 0.3 });

// Ropa fija de cada juez (prendas de prendas.json)
const ROPA_JUECES = {
  estrella: [["p-suelto", "negro"], ["v-gala", "rosa"], ["z-zapatillas", "dorado"], ["x-collar", "blanco"]],
  colorina: [["p-rizos", "naranja"], ["a-tirantes", "amarillo"], ["b-tutu", "turquesa"], ["z-tenis", "rosa"], ["x-lentes", "turquesa"]],
  detalle: [["p-melena", "plateado"], ["a-camisa", "azul"], ["b-pantalon", "negro"], ["z-botas", "cafe"], ["x-mono", "rojo"]],
};

/**
 * Crea el escenario con los jueces.
 * @param {object} idx índices de datos.js
 * @returns {{ grupo: THREE.Group, jueces: object[], animar: (dt: number, t: number) => void, focos: THREE.Object3D[] }}
 */
export function crearPasarela(idx) {
  const grupo = new THREE.Group(); grupo.name = "pasarela";
  const E = ESCENARIO;
  const add = (geom, col, x, y, z, op) => { const m = new THREE.Mesh(geom, material(col, op)); m.position.set(x, y, z); grupo.add(m); return m; };
  // Piso oscuro y la pasarela
  add(new THREE.PlaneGeometry(14, 14), "#3b2d55", 0, 0, E.z0 - 4).rotation.x = -Math.PI / 2;
  add(new THREE.BoxGeometry(2, E.alto, 7), "#ffffff", 0, E.alto / 2, E.z0 - 3.4);
  add(new THREE.BoxGeometry(1.5, 0.01, 7), "#ff7eb6", 0, E.alto + 0.005, E.z0 - 3.4);
  // Focos a los lados de la pasarela
  const focos = [];
  for (let i = 0; i < 7; i++) for (const s of [-1, 1]) {
    const f = add(new THREE.SphereGeometry(0.08, 10, 8), i % 2 ? "#ffd23f" : "#8fd3ff", s * 1.08, E.alto + 0.08, E.z0 - 0.4 - i * 1.0, { emisivo: 0.9 });
    focos.push(f);
  }
  // Fondo con telón y estrellas
  add(new THREE.BoxGeometry(6, 4, 0.2), "#8f5cf0", 0, 2, E.inicio - 0.8);
  add(new THREE.BoxGeometry(2.2, 2.8, 0.1), "#ff7eb6", 0, 1.4 + E.alto, E.inicio - 0.65);
  for (let i = 0; i < 9; i++) {
    const e = add(new THREE.OctahedronGeometry(0.15), "#ffd23f", -2.6 + i * 0.65, 3.4 + Math.sin(i) * 0.2, E.inicio - 0.65, { emisivo: 0.6 });
    e.scale.z = 0.3; focos.push(e);
  }
  // Mesa de los jueces (a un lado del final de la pasarela)
  add(new THREE.BoxGeometry(0.8, 0.75, 2.6), "#ffd23f", 2.4, 0.375, E.z0 - 1.6);
  const jueces = idx.jueces.map((j, i) => {
    const av = crearAvatar({ piel: idx.config.tonosPiel[[1, 0, 3][i % 3]], base: idx.config.colorBase });
    let a = atuendoVacio();
    for (const [id, col] of ROPA_JUECES[j.id] || []) { const p = idx.prendas.get(id); if (p) a = poner(a, p, col); }
    av.vestir(a, idx);
    av.raiz.position.set(2.95, 0, E.z0 - 0.75 - i * 0.85);
    av.raiz.rotation.y = -Math.PI / 2 + 0.25; // miran hacia la pasarela
    av.raiz.scale.setScalar(0.92);
    grupo.add(av.raiz);
    return { id: j.id, nombre: j.nombre, av, modo: "quieto" };
  });
  // Cada foco con su propio material, para que parpadeen a destiempo (los materiales normales se comparten por color)
  for (const f of focos) f.material = f.material.clone();
  let t = 0;
  function animar(dt) {
    t += dt;
    focos.forEach((f, i) => { f.material.emissiveIntensity = 0.5 + 0.5 * Math.abs(Math.sin(t * 2 + i)); });
    for (const j of jueces) j.av.animar(j.modo, dt);
  }
  return { grupo, jueces, animar, focos };
}
