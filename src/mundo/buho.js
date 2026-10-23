// El búho sabio de Isla Noli (#166), armado con formas sencillas a partir de la hoja de Petra (mundo/arte/buho.png):
// cuerpo de huevo color caramelo, panza crema, ojos grandes con lentes redondos dorados, pico naranja, orejitas,
// alas cortas, patas naranjas y birrete morado con borla dorada. Mira hacia +z (hacia la cámara). Las piezas quietas
// van juntas en un lote (pocos dibujos); se mueve el grupo entero (respira, gira la cabeza un poquito).
import * as THREE from "../../kit/3d/vendor/three.module.min.js";
import { crearLote } from "../../kit/3d/lote.js";

const C = { cuerpo: "#b07a4a", panza: "#f3d9a8", cara: "#f6e2b8", ojo: "#ffffff", pupila: "#2b2236", pico: "#f39a2e", lentes: "#e6b13a", gorro: "#7b4fc0", borla: "#f0c040", tronco: "#a97852" };

/** @returns {{ grupo: THREE.Group, animar: (dt, t, mirando: boolean) => void }} */
export function crearBuho({ reducir = false } = {}) {
  const grupo = new THREE.Group(); grupo.name = "buho";
  const cuerpo = new THREE.Group(); grupo.add(cuerpo);
  const cabeza = new THREE.Group(); cabeza.position.y = 1.12; cuerpo.add(cabeza);

  // Un tronquito donde se para (así se ve a la altura de Noelia)
  const base = crearLote();
  base.poner(new THREE.CylinderGeometry(0.5, 0.58, 0.45, 12), C.tronco, { pos: [0, 0.225, 0] });
  base.poner(new THREE.CylinderGeometry(0.46, 0.46, 0.03, 12), "#e9cfa6", { pos: [0, 0.455, 0] });
  base.cerrar(grupo);

  const L = crearLote();
  // Cuerpo de huevo y panza
  L.poner(new THREE.SphereGeometry(0.42, 18, 14), C.cuerpo, { pos: [0, 0.82, 0], esc: [1, 1.15, 0.92] });
  L.poner(new THREE.SphereGeometry(0.3, 16, 12), C.panza, { pos: [0, 0.76, 0.2], esc: [1, 1.15, 0.6] });
  for (const [x, y] of [[-0.1, 0.84], [0, 0.82], [0.1, 0.84], [-0.06, 0.7], [0.06, 0.7]]) L.poner(new THREE.TorusGeometry(0.035, 0.008, 4, 8, Math.PI), "#c99a62", { pos: [x, y, 0.37], rot: [0, 0, 180] });
  // Alas cortas
  for (const s of [-1, 1]) L.poner(new THREE.SphereGeometry(0.16, 10, 8), "#9a6a3e", { pos: [s * 0.4, 0.82, 0], esc: [0.45, 1.25, 0.9], rot: [0, 0, s * -12] });
  // Patas
  for (const s of [-1, 1]) for (const d of [-0.05, 0, 0.05]) L.poner(new THREE.SphereGeometry(0.045, 8, 6), C.pico, { pos: [s * 0.14 + d, 0.48, 0.12], esc: [0.8, 0.6, 1.4] });
  L.cerrar(cuerpo);

  const Lc = crearLote();
  // Cabeza (un poco más ancha), cara crema
  Lc.poner(new THREE.SphereGeometry(0.36, 18, 14), C.cuerpo, { pos: [0, 0, 0], esc: [1.12, 0.92, 0.95] });
  Lc.poner(new THREE.CircleGeometry(0.17, 20), C.cara, { pos: [-0.15, 0.02, 0.322], rot: [0, -12, 0] });
  Lc.poner(new THREE.CircleGeometry(0.17, 20), C.cara, { pos: [0.15, 0.02, 0.322], rot: [0, 12, 0] });
  // Ojos grandes con brillo, lentes dorados y pico
  for (const s of [-1, 1]) {
    Lc.poner(new THREE.CircleGeometry(0.11, 18), C.ojo, { pos: [s * 0.14, 0.03, 0.335], rot: [0, s * 12, 0] });
    Lc.poner(new THREE.CircleGeometry(0.065, 16), C.pupila, { pos: [s * 0.135, 0.03, 0.342], rot: [0, s * 12, 0] });
    Lc.poner(new THREE.CircleGeometry(0.022, 8), "#ffffff", { pos: [s * 0.135 + 0.025, 0.06, 0.348], rot: [0, s * 12, 0] });
    Lc.poner(new THREE.TorusGeometry(0.135, 0.018, 6, 24), C.lentes, { pos: [s * 0.145, 0.03, 0.35], rot: [0, s * 12, 0], op: { brillo: true } });
    // Orejitas
    Lc.poner(new THREE.ConeGeometry(0.08, 0.2, 6), C.cuerpo, { pos: [s * 0.27, 0.27, 0], rot: [0, 0, s * -28] });
  }
  Lc.poner(new THREE.BoxGeometry(0.06, 0.02, 0.02), C.lentes, { pos: [0, 0.04, 0.36] });
  Lc.poner(new THREE.ConeGeometry(0.055, 0.13, 6), C.pico, { pos: [0, -0.07, 0.36], rot: [100, 0, 0] });
  // Birrete: gorrito morado y la tabla plana cuadrada arriba, con su borla dorada
  Lc.poner(new THREE.CylinderGeometry(0.2, 0.24, 0.12, 14), C.gorro, { pos: [0, 0.31, -0.02] });
  Lc.poner(new THREE.BoxGeometry(0.52, 0.04, 0.52), C.gorro, { pos: [0, 0.38, -0.02], rot: [0, 45, 0] });
  Lc.poner(new THREE.SphereGeometry(0.035, 8, 6), C.borla, { pos: [0, 0.41, -0.02] });
  Lc.poner(new THREE.CylinderGeometry(0.01, 0.01, 0.2, 4), C.borla, { pos: [0.2, 0.32, 0.15], rot: [0, 0, 8] });
  Lc.poner(new THREE.ConeGeometry(0.04, 0.09, 6), C.borla, { pos: [0.21, 0.2, 0.15] });
  Lc.cerrar(cabeza);

  let mira = 0;
  return {
    grupo,
    /** Respira y, si Noelia está cerca, la voltea a ver */
    animar(dt, t, mirando) {
      if (reducir) return;
      cuerpo.position.y = Math.sin(t * 2) * 0.015;
      const meta = mirando ? Math.sin(t * 1.3) * 0.15 : Math.sin(t * 0.6) * 0.45;
      mira += (meta - mira) * Math.min(1, dt * 3);
      cabeza.rotation.y = mira;
      cabeza.rotation.z = mirando ? Math.sin(t * 2.6) * 0.08 : 0;
    },
  };
}
