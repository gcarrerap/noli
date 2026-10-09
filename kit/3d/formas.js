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

/** La misma geometría con sus coordenadas de textura multiplicadas (para que el patrón tenga su tamaño real en metros) */
function geoUV(clave, crear, fu, fv) {
  return geo(`${clave}|uv|${fu.toFixed(3)}|${fv.toFixed(3)}`, () => {
    const g = crear().clone();
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * fu, uv.getY(i) * fv);
    return g;
  });
}

/**
 * Crea la malla (o grupo) de una pieza, sin colocarla en el cuerpo.
 * @param {object} p pieza
 * @param {(col: string) => string} colorDe convierte "p", "s", un id de color o #hex en #hex
 * @param {{ brillo?: boolean }} prenda opciones de la prenda
 * @param {{ patron?: THREE.Texture|null, baldosa?: number, estampado?: (id: string) => THREE.Texture|null }} [extras]
 *   patron: textura que se repite en las piezas del color principal ("col": "p", sin "sinPatron"); baldosa: cuánto mide
 *   (metros) una repetición; estampado: textura de un estampado (formas "calca"). Ver docs/ESCENA-3D.md § Texturas.
 * @returns {THREE.Object3D}
 */
export function crearPieza(p, colorDe, prenda = {}, extras = {}) {
  const hex = p.f === "anillo" || p.f === "calca" ? null : colorDe(p.col);
  const op = { brillo: !!prenda.brillo && p.col !== "piel", opacidad: p.opacidad };
  // ¿Lleva el patrón? Solo las piezas del color principal (no botones ni gemas)
  const pat = extras.patron && p.col === "p" && !p.sinPatron && p.f !== "octaedro" ? extras.patron : null;
  const T = extras.baldosa || 0.12;
  const mat = (o = {}) => (pat ? material("#ffffff", { ...op, ...o, mapa: pat }) : material(hex, { ...op, ...o }));
  // geometría: con patrón, con las coordenadas de textura a la escala de la baldosa (fu × fv repeticiones)
  const G = (clave, crear, fu, fv) => (pat ? geoUV(clave, crear, fu / T, fv / T) : geo(clave, crear));
  const PI = Math.PI;
  let obj;
  switch (p.f) {
    case "tubo": {
      const [y0, y1] = p.y, [r0, r1] = p.r, alto = y0 - y1;
      const g = G(`tubo|${r0}|${r1}|${alto}`, () => new THREE.CylinderGeometry(r0, r1, alto, 18, 1, true), PI * (r0 + r1), alto);
      obj = new THREE.Group();
      obj.add(new THREE.Mesh(g, mat({ dobleCara: true })));
      const tapa = (r, y) => { const c = new THREE.Mesh(G(`circ|${r}`, () => new THREE.CircleGeometry(r, 18), 2 * r, 2 * r), mat({ dobleCara: true })); c.rotation.x = -PI / 2; c.position.y = y; obj.add(c); };
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
      const g = G(`esf|${p.r}|${ps}|${pl}|${ts}|${tl}`, () => new THREE.SphereGeometry(p.r, seg, Math.ceil(seg * 0.7), ps * RAD, pl * RAD, ts * RAD, tl * RAD),
        2 * PI * p.r * (pl / 360), PI * p.r * (tl / 180));
      obj = new THREE.Mesh(g, mat({ dobleCara: parcial }));
      break;
    }
    case "caja": obj = new THREE.Mesh(G(`caja|${p.tam}`, () => new THREE.BoxGeometry(...p.tam), Math.max(p.tam[0], p.tam[2]), p.tam[1]), mat()); break;
    case "capsula": obj = new THREE.Mesh(G(`cap|${p.r}|${p.largo}`, () => new THREE.CapsuleGeometry(p.r, p.largo, 4, 12), 2 * PI * p.r, p.largo + 2 * p.r), mat()); break;
    case "toro": obj = new THREE.Mesh(G(`toro|${p.r}|${p.grosor}|${p.arco || 360}`, () => new THREE.TorusGeometry(p.r, p.grosor, 6, p.r < 0.07 ? 16 : 24, (p.arco || 360) * RAD),
      2 * PI * p.r * ((p.arco || 360) / 360), 2 * PI * p.grosor), mat()); break;
    case "cono": obj = new THREE.Mesh(G(`cono|${p.r}|${p.alto}`, () => new THREE.ConeGeometry(p.r, p.alto, 10), 2 * PI * p.r, p.alto), mat()); break;
    case "disco": obj = new THREE.Mesh(G(`disco|${p.r}|${p.alto}`, () => new THREE.CylinderGeometry(p.r, p.r, p.alto, p.r < 0.1 ? 14 : 24), 2 * PI * p.r, 2 * p.r), mat()); break;
    case "plano": {
      obj = new THREE.Mesh(G("plano", () => new THREE.CircleGeometry(0.5, 24), p.tam[0], p.tam[1]), mat({ dobleCara: true }));
      obj.scale.set(p.tam[0], p.tam[1], 1);
      break;
    }
    case "octaedro": obj = new THREE.Mesh(geo(`oct|${p.r}`, () => new THREE.OctahedronGeometry(p.r)), material(hex, { ...op, brillo: true })); break;
    case "calca": {
      // Un estampado pegado a una tela curva: un pedazo de tubo (o de cono) apenas más grande que la prenda, centrado
      // al frente (+z) o atrás, con la imagen estirada exacto sobre él. Sin textura (Node, o estampado que no existe) no se ve.
      const tex = extras.estampado ? extras.estampado(p.estampado) : null;
      obj = new THREE.Group();
      if (tex) {
        const [y0, y1] = p.y, [r0, r1] = p.r, alto = y0 - y1, rm = (r0 + r1) / 2;
        const arco = Math.min(2 * PI * 0.45, p.ancho / rm), inicio = (p.lado === "espalda" ? PI : 0) - arco / 2;
        const g = geo(`calca|${r0}|${r1}|${alto}|${arco.toFixed(4)}|${p.lado || "frente"}`, () => new THREE.CylinderGeometry(r0, r1, alto, 10, 1, true, inicio, arco));
        obj.add(new THREE.Mesh(g, material("#ffffff", { mapa: tex, recorte: true })));
        obj.position.y = (y0 + y1) / 2;
        if (p.z) obj.scale.z = p.z;
      }
      break;
    }
    case "anillo": {
      // n copias de "pieza" repartidas en un círculo horizontal (plano x-z). Ángulo 0 = al frente (+z).
      obj = new THREE.Group();
      const [ini, largo] = p.arco || [0, 360];
      const paso = largo >= 360 ? largo / p.n : largo / (p.n - 1);
      for (let i = 0; i < p.n; i++) {
        const a = (ini + (p.desfase || 0) + i * paso) * RAD;
        const hijo = crearPieza(p.pieza, colorDe, prenda, extras);
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
