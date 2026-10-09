// El estudio: piso, paredes y los muebles de cada zona (percheros, estante de zapatos, tocador, vitrina, espejo y la
// puerta del escenario), todo con formas sencillas. La posición de cada mueble sale de datos/zonas.json; aquí solo
// se dibuja. Los choques los calcula src/movimiento.js con las mismas cajas. Ver docs/ESCENA-3D.md § El estudio.
import * as THREE from "../../../../kit/3d/vendor/three.module.min.js";
import { material } from "../../../../kit/3d/materiales.js";

const PALETA_ROPA = ["#ff7eb6", "#4c7dff", "#ffd23f", "#3cbf7e", "#8f5cf0", "#ff9a3c", "#2ec4c4", "#ef4343"];

/**
 * Crea el estudio.
 * @param {{ zonas: object[], obstaculos?: object[] }} zonas datos/zonas.json
 * @param {{ ancho: number, fondo: number }} medidas config.estudio
 * @returns {{ grupo: THREE.Group, marcas: Map<string, THREE.Vector3> }} marcas: dónde va el letrero de cada zona
 */
export function crearEstudio(zonas, medidas) {
  const grupo = new THREE.Group();
  grupo.name = "estudio";
  const W = medidas.ancho, D = medidas.fondo;
  const add = (geom, color, x, y, z, op) => { const m = new THREE.Mesh(geom, material(color, op)); m.position.set(x, y, z); grupo.add(m); return m; };

  // Piso con losetas de dos tonos (una sola textura chiquita repetida)
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#ffe9d6"; ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = "#ffdcc2"; ctx.fillRect(0, 0, 32, 32); ctx.fillRect(32, 32, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(W / 2, D / 2); tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshLambertMaterial({ map: tex }));
  piso.rotation.x = -Math.PI / 2; piso.name = "piso"; grupo.add(piso);
  // Tapete redondo al centro
  add(new THREE.CircleGeometry(1.7, 40), "#ffb3d1", 0, 0.004, 0.8).rotation.x = -Math.PI / 2;
  add(new THREE.RingGeometry(1.45, 1.6, 40), "#ffffff", 0, 0.006, 0.8).rotation.x = -Math.PI / 2;

  // Paredes: fondo y lados (el frente queda abierto, como un escenario, para la cámara)
  const H = 3.2;
  add(new THREE.BoxGeometry(W, H, 0.2), "#f6d1ff", 0, H / 2, -D / 2 - 0.1);
  add(new THREE.BoxGeometry(0.2, H, D), "#d6ecff", -W / 2 - 0.1, H / 2, 0);
  add(new THREE.BoxGeometry(0.2, H, D), "#d6ecff", W / 2 + 0.1, H / 2, 0);
  // Zoclo blanco
  add(new THREE.BoxGeometry(W, 0.18, 0.06), "#ffffff", 0, 0.09, -D / 2 + 0.03);
  add(new THREE.BoxGeometry(0.06, 0.18, D), "#ffffff", -W / 2 + 0.03, 0.09, 0);
  add(new THREE.BoxGeometry(0.06, 0.18, D), "#ffffff", W / 2 - 0.03, 0.09, 0);
  // Estrellitas en la pared del fondo
  for (let i = 0; i < 7; i++) {
    const e = add(new THREE.OctahedronGeometry(0.12), i % 2 ? "#ffd23f" : "#ff7eb6", -5 + i * 1.65, 2.6 + (i % 2) * 0.25, -D / 2 + 0.05, { emisivo: 0.25 });
    e.scale.z = 0.3;
  }

  const marcas = new Map();
  for (const z of zonas.zonas) {
    const [x, zz, w, d, h] = z.mueble.caja;
    mueble(grupo, z.mueble.tipo, x, zz, w, d, h, z.mueble.color);
    marcas.set(z.id, new THREE.Vector3(x, h + 0.45, zz));
  }
  for (const o of zonas.obstaculos || []) { const [x, zz, w, d, h] = o.caja; mueble(grupo, o.tipo, x, zz, w, d, h, o.color); }
  return { grupo, marcas };
}

/** Dibuja un mueble dentro de su caja (x, z centro; w ancho en x; d fondo en z; h alto) */
function mueble(grupo, tipo, x, z, w, d, h, color) {
  const g = new THREE.Group(); g.position.set(x, 0, z); grupo.add(g);
  const add = (geom, col, px, py, pz, op) => { const m = new THREE.Mesh(geom, material(col, op)); m.position.set(px, py, pz); g.add(m); return m; };
  const largo = Math.max(w, d), aLoLargoDeZ = d > w;
  switch (tipo) {
    case "perchero": {
      // Dos postes, una barra y prendas colgadas de colores
      for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.04, 0.04, h, 10), "#c3c7d3", aLoLargoDeZ ? 0 : (s * w) / 2.2, h / 2, aLoLargoDeZ ? (s * d) / 2.2 : 0);
      const barra = add(new THREE.CylinderGeometry(0.03, 0.03, largo * 0.92, 10), "#c3c7d3", 0, h - 0.08, 0);
      barra.rotation[aLoLargoDeZ ? "x" : "z"] = Math.PI / 2;
      add(new THREE.BoxGeometry(aLoLargoDeZ ? w : largo, 0.08, aLoLargoDeZ ? largo : d), color, 0, 0.04, 0);
      const n = Math.floor(largo / 0.32);
      for (let i = 0; i < n; i++) {
        const t = -largo / 2 + 0.2 + i * ((largo - 0.4) / Math.max(1, n - 1));
        const prenda = add(new THREE.BoxGeometry(aLoLargoDeZ ? 0.42 : 0.05, 0.62, aLoLargoDeZ ? 0.05 : 0.42), PALETA_ROPA[i % PALETA_ROPA.length], aLoLargoDeZ ? 0 : t, h - 0.45, aLoLargoDeZ ? t : 0);
        prenda.rotation.y = aLoLargoDeZ ? Math.PI / 2 : 0;
      }
      break;
    }
    case "estante": {
      add(new THREE.BoxGeometry(w, h, d), color, 0, h / 2, 0);
      for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) {
        const t = -largo / 2 + 0.35 + i * ((largo - 0.7) / 3);
        add(new THREE.BoxGeometry(0.22, 0.14, 0.3), PALETA_ROPA[(r * 4 + i) % PALETA_ROPA.length], aLoLargoDeZ ? (x > 0 ? -w / 2 - 0.02 : w / 2 + 0.02) : t, 0.3 + r * 0.45, aLoLargoDeZ ? t : 0);
      }
      break;
    }
    case "tocador": {
      add(new THREE.BoxGeometry(w * 0.8, 0.75, d), color, 0, 0.375, 0);
      const espejo = add(new THREE.CircleGeometry(0.5, 32), "#e8f6ff", x > 0 ? -w * 0.42 : w * 0.42, 1.35, 0, { emisivo: 0.3 });
      espejo.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2;
      const marco = add(new THREE.TorusGeometry(0.5, 0.05, 8, 32), "#ffd23f", x > 0 ? -w * 0.4 : w * 0.4, 1.35, 0);
      marco.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2;
      for (let i = 0; i < 3; i++) add(new THREE.SphereGeometry(0.08, 10, 8), PALETA_ROPA[i], 0, 0.82, -0.4 + i * 0.4);
      break;
    }
    case "vitrina": {
      add(new THREE.BoxGeometry(w * 0.85, h * 0.7, d), color, 0, (h * 0.7) / 2, 0);
      add(new THREE.BoxGeometry(w * 0.85, h * 0.3, d), "#e8f6ff", 0, h * 0.85, 0, { opacidad: 0.35 });
      add(new THREE.TorusGeometry(0.12, 0.03, 8, 16), "#e3b12a", 0, h * 0.8, -0.4);
      add(new THREE.OctahedronGeometry(0.1), "#ff7eb6", 0, h * 0.8, 0.1, { brillo: true });
      add(new THREE.SphereGeometry(0.09, 10, 8), "#8fd3ff", 0, h * 0.78, 0.5);
      break;
    }
    case "espejo": {
      add(new THREE.BoxGeometry(w, h, d), "#ffd23f", 0, h / 2, 0);
      add(new THREE.PlaneGeometry(w * 0.82, h * 0.86), "#e8f6ff", 0, h / 2, d / 2 + 0.01, { emisivo: 0.35 });
      add(new THREE.PlaneGeometry(w * 0.2, h * 0.5), "#ffffff", -w * 0.2, h * 0.55, d / 2 + 0.02, { opacidad: 0.5 }).rotation.z = 0.3;
      break;
    }
    case "puerta": {
      add(new THREE.BoxGeometry(w, h, d), "#ffd23f", 0, h / 2, 0);
      add(new THREE.PlaneGeometry(w * 0.8, h * 0.85), color, 0, h * 0.43, d / 2 + 0.01);
      add(new THREE.PlaneGeometry(0.06, h * 0.85), "#b8282c", 0, h * 0.43, d / 2 + 0.02);
      const estrella = add(new THREE.OctahedronGeometry(0.22), "#ffd23f", 0, h + 0.25, 0.1, { emisivo: 0.4 });
      estrella.scale.z = 0.4;
      break;
    }
    case "planta": {
      add(new THREE.CylinderGeometry(w * 0.4, w * 0.32, h * 0.35, 14), "#ff9a3c", 0, h * 0.175, 0);
      add(new THREE.SphereGeometry(w * 0.55, 14, 10), color, 0, h * 0.65, 0);
      add(new THREE.SphereGeometry(w * 0.4, 12, 8), color, w * 0.2, h * 0.9, 0.05);
      break;
    }
    default: add(new THREE.BoxGeometry(w, h, d), color, 0, h / 2, 0);
  }
  return g;
}
