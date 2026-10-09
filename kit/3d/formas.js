// Formas: convierte una pieza de prendas.json ({ f: "tubo", a: "torso", y: [...], r: [...], ... }) en una malla de
// Three.js. Las geometrías se guardan por sus medidas, así dos prendas con la misma forma comparten geometría.
// Qué significa cada campo de cada forma: docs/ESCENA-3D.md § Formas (y ejemplos en docs/ASSETS.md).
import * as THREE from "./vendor/three.module.min.js";
import { material } from "./materiales.js";

const RAD = Math.PI / 180;
const geos = new Map();
/** Geometría cacheada: misma clave → misma geometría */
function geo(clave, crear) {
  let g = geos.get(clave);
  if (!g) { g = crear(); geos.set(clave, g); }
  return g;
}

/**
 * Crea la malla (o grupo) de una pieza, sin colocarla en el cuerpo.
 * @param {object} p pieza
 * @param {(col: string) => string} colorDe convierte "p", "s", un id de color o #hex en #hex
 * @param {{ brillo?: boolean }} prenda opciones de la prenda
 * @returns {THREE.Object3D}
 */
export function crearPieza(p, colorDe, prenda = {}) {
  const hex = p.f === "anillo" ? null : colorDe(p.col);
  const op = { brillo: !!prenda.brillo && p.col !== "piel", opacidad: p.opacidad };
  let obj;
  switch (p.f) {
    case "tubo": {
      const [y0, y1] = p.y, [r0, r1] = p.r, alto = y0 - y1;
      const g = geo(`tubo|${r0}|${r1}|${alto}`, () => new THREE.CylinderGeometry(r0, r1, alto, 18, 1, true));
      obj = new THREE.Group();
      const m = new THREE.Mesh(g, material(hex, { ...op, dobleCara: true }));
      obj.add(m);
      const tapa = (r, y) => { const c = new THREE.Mesh(geo(`circ|${r}`, () => new THREE.CircleGeometry(r, 18)), material(hex, { ...op, dobleCara: true })); c.rotation.x = -Math.PI / 2; c.position.y = y; obj.add(c); };
      if (p.tapa === "arriba" || p.tapa === "ambas") tapa(r0, alto / 2);
      if (p.tapa === "abajo" || p.tapa === "ambas") tapa(r1, -alto / 2);
      obj.position.y = (y0 + y1) / 2;
      if (p.z) obj.scale.z = p.z;
      break;
    }
    case "esfera": {
      const [ps, pl] = p.phi || [0, 360], [ts, tl] = p.theta || [0, 180];
      const parcial = pl < 360 || tl < 180;
      // Menos caras en las esferas chicas (botones, perlas): no se nota y ahorra triángulos (presupuesto en docs/RENDIMIENTO.md)
      const seg = p.r < 0.04 ? 8 : p.r < 0.1 ? 12 : 18;
      const g = geo(`esf|${p.r}|${ps}|${pl}|${ts}|${tl}`, () => new THREE.SphereGeometry(p.r, seg, Math.ceil(seg * 0.7), ps * RAD, pl * RAD, ts * RAD, tl * RAD));
      obj = new THREE.Mesh(g, material(hex, { ...op, dobleCara: parcial }));
      break;
    }
    case "caja": obj = new THREE.Mesh(geo(`caja|${p.tam}`, () => new THREE.BoxGeometry(...p.tam)), material(hex, op)); break;
    case "capsula": obj = new THREE.Mesh(geo(`cap|${p.r}|${p.largo}`, () => new THREE.CapsuleGeometry(p.r, p.largo, 4, 12)), material(hex, op)); break;
    case "toro": obj = new THREE.Mesh(geo(`toro|${p.r}|${p.grosor}|${p.arco || 360}`, () => new THREE.TorusGeometry(p.r, p.grosor, 6, p.r < 0.07 ? 16 : 24, (p.arco || 360) * RAD)), material(hex, op)); break;
    case "cono": obj = new THREE.Mesh(geo(`cono|${p.r}|${p.alto}`, () => new THREE.ConeGeometry(p.r, p.alto, 10)), material(hex, op)); break;
    case "disco": obj = new THREE.Mesh(geo(`disco|${p.r}|${p.alto}`, () => new THREE.CylinderGeometry(p.r, p.r, p.alto, p.r < 0.1 ? 14 : 24)), material(hex, op)); break;
    case "plano": {
      obj = new THREE.Mesh(geo("plano", () => new THREE.CircleGeometry(0.5, 24)), material(hex, { ...op, dobleCara: true }));
      obj.scale.set(p.tam[0], p.tam[1], 1);
      break;
    }
    case "octaedro": obj = new THREE.Mesh(geo(`oct|${p.r}`, () => new THREE.OctahedronGeometry(p.r)), material(hex, { ...op, brillo: true })); break;
    case "anillo": {
      // n copias de "pieza" repartidas en un círculo horizontal (plano x-z). Ángulo 0 = al frente (+z).
      obj = new THREE.Group();
      const [ini, largo] = p.arco || [0, 360];
      const paso = largo >= 360 ? largo / p.n : largo / (p.n - 1);
      for (let i = 0; i < p.n; i++) {
        const a = (ini + (p.desfase || 0) + i * paso) * RAD;
        const hijo = crearPieza(p.pieza, colorDe, prenda);
        hijo.position.x += Math.sin(a) * p.radio;
        hijo.position.z += Math.cos(a) * p.radio;
        obj.add(hijo);
      }
      break;
    }
    default: throw new Error("forma desconocida: " + p.f);
  }
  // Colocación de la pieza respecto a su ancla: pos, rot (grados, orden XYZ) y esc (se multiplica)
  if (p.pos) obj.position.add(new THREE.Vector3(...p.pos));
  if (p.rot) obj.rotation.set(p.rot[0] * RAD, p.rot[1] * RAD, p.rot[2] * RAD);
  if (p.esc) obj.scale.multiply(new THREE.Vector3(...p.esc));
  obj.traverse((o) => { o.castShadow = false; o.userData.prenda = true; });
  return obj;
}

/**
 * La pieza del otro lado ("espejo": true): ancla …I → …D (o la misma si es del centro), x negativa y giros en y y z al revés.
 * @param {object} p
 * @returns {object} la pieza reflejada
 */
export function reflejar(p) {
  const q = { ...p, espejo: false, a: /I$/.test(p.a) ? p.a.slice(0, -1) + "D" : p.a };
  if (p.pos) q.pos = [-p.pos[0], p.pos[1], p.pos[2]];
  if (p.rot) q.rot = [p.rot[0], -p.rot[1], -p.rot[2]];
  return q;
}

/** Libera las geometrías guardadas (al salir del juego) */
export function liberarFormas() {
  for (const g of geos.values()) g.dispose();
  geos.clear();
}
