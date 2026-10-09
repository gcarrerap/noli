// El mundo mágico en 3D (#25): pasto, plaza con fuente, caminos, estanque, plataformas, edificios, árboles, hongos,
// flores, luciérnagas y cristales. Todo sale de mundo/mundo.json, mundo/lugares.json y de la decoración con semilla
// (src/engine/mundo.js); aquí solo se dibuja. Lo que no se mueve va junto en lotes (pocas llamadas de dibujo, ver
// docs/MUNDO.md § Rendimiento); lo que se repite mucho (árboles, flores, luciérnagas) va en InstancedMesh.
import * as THREE from "../../kit/3d/vendor/three.module.min.js";
import { material } from "../../kit/3d/materiales.js";
import { crearLote } from "../../kit/3d/lote.js";
import { edificio } from "./edificios.js";
import { solidoDe } from "../engine/mundo.js";

const RAD = Math.PI / 180;
const PIEDRITA = new THREE.OctahedronGeometry(0.13); // 8 triángulos (una esfera serían 80, y hay cientos)

/**
 * @param {object} mundo mundo/mundo.json
 * @param {object[]} lugares colocarLugares(...)
 * @param {object} deco decorar(...)
 * @param {{ x, z, y, id, color }[]} cristales cristalesDe(...)
 * @param {{ reducir?: boolean }} op reducir: prefers-reduced-motion (menos cosas moviéndose)
 */
export function crearMundo(mundo, lugares, deco, cristales, op = {}) {
  const grupo = new THREE.Group(); grupo.name = "mundo";
  const lote = crearLote();
  const C = mundo.colores || {};
  const animados = [];
  const l = mundo.limites;

  // ---- Piso: pasto con manchitas (una textura chiquita repetida) ----
  const cv = document.createElement("canvas"); cv.width = cv.height = 64;
  const x = cv.getContext("2d");
  x.fillStyle = C.pasto || "#bfe6a4"; x.fillRect(0, 0, 64, 64);
  x.fillStyle = C.pasto2 || "#a9db93";
  for (const [a, b, r] of [[10, 12, 5], [40, 8, 4], [52, 40, 6], [22, 44, 4], [34, 26, 3]]) { x.beginPath(); x.arc(a, b, r, 0, Math.PI * 2); x.fill(); }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace;
  const W = l.x1 - l.x0 + 70, D = l.z1 - l.z0 + 70;
  tex.repeat.set(W / 4, D / 4);
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshLambertMaterial({ map: tex }));
  piso.rotation.x = -Math.PI / 2; piso.position.set((l.x0 + l.x1) / 2, 0, (l.z0 + l.z1) / 2); piso.name = "piso";
  grupo.add(piso);

  const plano = (geom, hex, pos, o = {}) => lote.poner(geom, hex, { pos, rot: [-90, o.giro || 0, 0], esc: o.esc, op: o.op });

  // ---- Plaza, caminos y estanque (planos un poquito arriba del pasto) ----
  const R = (mundo.plaza && mundo.plaza.radio) || 5;
  plano(new THREE.CircleGeometry(R, 48), C.plaza || "#f4e4c9", [0, 0.012, 0]);
  plano(new THREE.RingGeometry(R - 0.25, R, 48), "#e3cfae", [0, 0.016, 0]);
  plano(new THREE.RingGeometry(1.9, 2.15, 40), "#e9d6f7", [0, 0.016, -0.4]);
  for (const lu of lugares) {
    const dx = lu.punto.x, dz = lu.punto.z, largo = Math.hypot(dx, dz) - R + 0.6;
    const ang = Math.atan2(dx, dz); // giro del camino alrededor de y
    const cx = (dx / Math.hypot(dx, dz)) * (R - 0.3 + largo / 2), cz = (dz / Math.hypot(dx, dz)) * (R - 0.3 + largo / 2);
    lote.poner(new THREE.PlaneGeometry(1.7, largo), C.camino || "#ecd7b3", { pos: [cx, 0.01, cz], rot: [-90, 0, ang / RAD + 180] });
    // Piedritas que brillan a los lados del camino
    for (let d = 1.2; d < largo; d += 1.6) {
      for (const s of [-1, 1]) {
        const ux = dx / Math.hypot(dx, dz), uz = dz / Math.hypot(dx, dz);
        const px = ux * (R - 0.3 + d) + uz * s * 1.05, pz = uz * (R - 0.3 + d) - ux * s * 1.05;
        lote.poner(PIEDRITA, d % 3.2 < 1.6 ? "#fff3b0" : "#d9c8ff", { pos: [px, 0.07, pz], esc: [1, 0.7, 1], op: { emisivo: 0.5 } });
      }
    }
    // Tapete en la puerta
    plano(new THREE.CircleGeometry(1.1, 28), "#fff0f7", [lu.punto.x, 0.018, lu.punto.z]);
  }
  const est = mundo.estanque;
  if (est) {
    plano(new THREE.CircleGeometry(est.r, 40), C.agua || "#8fd3f4", [est.x, 0.02, est.z]);
    plano(new THREE.RingGeometry(est.r * 0.55, est.r * 0.6, 40), "#b9e7fb", [est.x, 0.024, est.z]);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      lote.poner(new THREE.DodecahedronGeometry(0.32), "#d9cfe8", { pos: [est.x + Math.cos(a) * (est.r + 0.15), 0.08, est.z + Math.sin(a) * (est.r + 0.15)], esc: [1, 0.5, 1], rot: [0, i * 37, 0] });
    }
  }

  // ---- Plataformas ----
  for (const p of mundo.plataformas || []) plataforma(lote, p, solidoDe(p));

  // ---- Edificios ----
  const marcas = new Map(), resaltes = new Map();
  for (const lu of lugares) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(lu.x, 0, lu.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), lu.rot), new THREE.Vector3(1, 1, 1));
    const e = edificio(lu.edificio, lote, m, { color: lu.juego.color, reducir: op.reducir });
    for (const a of e.animados) {
      const g = new THREE.Group(); g.position.set(lu.x, 0, lu.z); g.rotation.y = lu.rot; g.add(a.obj); grupo.add(g);
      animados.push(a);
    }
    // El letrero va arriba del frente del edificio, no muy alto (si no, desde lejos queda fuera de la pantalla)
    const fx = Math.sin(lu.rot), fz = Math.cos(lu.rot);
    marcas.set(lu.id, new THREE.Vector3(lu.x + fx * lu.radioChoque * 0.8, Math.min(lu.alto + 0.3, 3.6), lu.z + fz * lu.radioChoque * 0.8));
    // Anillo que brilla alrededor (para la materia elegida); empieza escondido
    const anillo = new THREE.Mesh(new THREE.RingGeometry(lu.radioChoque + 0.25, lu.radioChoque + 0.6, 40), material("#ffd166", { emisivo: 0.8, dobleCara: true }));
    anillo.rotation.x = -Math.PI / 2; anillo.position.set(lu.x, 0.03, lu.z); anillo.visible = false;
    grupo.add(anillo); resaltes.set(lu.id, anillo);
  }

  lote.cerrar(grupo);
  // Letreritos flotantes (números y letras): de cerca se verían enormes (ver despejar)
  const sprites = [];
  grupo.traverse((o) => { if (o.isSprite) sprites.push(o); });
  const vs = new THREE.Vector3();

  // ---- Decoración repetida: InstancedMesh (una llamada de dibujo por tipo) ----
  const tmp = new THREE.Object3D(), col = new THREE.Color();
  // poner(item, objeto, color): acomoda la instancia; si conColor, cada una toma el color que ponga en `color`
  const instancias = (geom, mat, lista, poner, conColor = false) => {
    if (!lista.length) return null;
    const im = new THREE.InstancedMesh(geom, mat, lista.length);
    lista.forEach((it, i) => { poner(it, tmp, col); tmp.updateMatrix(); im.setMatrixAt(i, tmp.matrix); if (conColor) im.setColorAt(i, col); });
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    grupo.add(im); return im;
  };
  const blanco = () => material("#ffffff");
  // Árboles: tronco y copa. f = qué tan "parado" está (1 normal, 0 encogido: ver despejar)
  const ponerTronco = (a, t, f = 1) => { const e = a.escala * f; t.position.set(a.x, 1.1 * e, a.z); t.scale.setScalar(e); t.rotation.set(0, 0, 0); };
  const ponerCopa = (a, t, f = 1) => { const e = a.escala * f; t.position.set(a.x, 3.1 * e, a.z); t.scale.set(e, e * 1.15, e); t.rotation.set(0, a.giro, 0); };
  const troncos = instancias(new THREE.CylinderGeometry(0.28, 0.4, 2.2, 7), material("#a97852"), deco.arboles, (a, t) => ponerTronco(a, t));
  const copas = instancias(new THREE.IcosahedronGeometry(1.5, 1), blanco(), deco.arboles, (a, t, c) => { ponerCopa(a, t); c.set(a.color); }, true);
  const parado = deco.arboles.map(() => 1);
  instancias(new THREE.CylinderGeometry(0.12, 0.16, 0.8, 6), material("#fff6e8"), deco.hongos, (h, t) => { t.position.set(h.x, 0.4 * h.escala, h.z); t.scale.setScalar(h.escala); t.rotation.set(0, 0, 0); });
  instancias(new THREE.SphereGeometry(0.45, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), blanco(), deco.hongos, (h, t, c) => { t.position.set(h.x, 0.72 * h.escala, h.z); t.scale.set(h.escala, h.escala * 0.8, h.escala); t.rotation.set(0, 0, 0); c.set(h.color); }, true);
  instancias(new THREE.OctahedronGeometry(0.12), material("#ffffff", { emisivo: 0.25 }), deco.flores, (f, t, c) => { t.position.set(f.x, 0.14, f.z); t.scale.set(1, 0.6, 1); t.rotation.set(0, f.x * 3, 0); c.set(f.color); }, true);
  // Estrellas en el cielo, sobre el borde del mundo
  const estrellas = [];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    estrellas.push({ x: Math.sin(a) * 34, y: 9 + (i % 5) * 1.6, z: -10 + Math.cos(a) * 30 });
  }
  instancias(new THREE.OctahedronGeometry(0.35), material("#fff3a6", { emisivo: 0.9 }), estrellas, (e, t) => { t.position.set(e.x, e.y, e.z); t.scale.set(1, 1.3, 0.4); t.rotation.set(0, Math.atan2(-e.x, -e.z), 0); });

  // Luciérnagas: se mueven (se actualizan sus matrices cada cuadro; son pocas)
  const luz = instancias(new THREE.IcosahedronGeometry(0.07, 0), material("#fff27a", { emisivo: 1 }), deco.luciernagas, (f, t) => { t.position.set(f.x, f.y, f.z); t.scale.setScalar(1); });
  if (luz && !op.reducir) {
    animados.push({ animar(dt, tt) {
      deco.luciernagas.forEach((f, i) => {
        tmp.position.set(f.x + Math.sin(tt * 0.5 + f.fase) * 0.8, f.y + Math.sin(tt * 1.3 + f.fase * 2) * 0.35, f.z + Math.cos(tt * 0.4 + f.fase) * 0.8);
        tmp.scale.setScalar(0.7 + 0.5 * Math.abs(Math.sin(tt * 2 + f.fase)));
        tmp.updateMatrix(); luz.setMatrixAt(i, tmp.matrix);
      });
      luz.instanceMatrix.needsUpdate = true;
    } });
  }

  // ---- Cristales para encontrar ----
  const mallasCristal = new Map();
  for (const c of cristales) {
    const g = new THREE.Group();
    const gema = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), material(c.color, { brillo: true, emisivo: 0.45 }));
    gema.scale.set(1, 1.5, 1); g.add(gema);
    const brillo = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), material(c.color, { opacidad: 0.35, emisivo: 0.8, dobleCara: true }));
    brillo.rotation.x = -Math.PI / 2; brillo.position.y = -0.62; g.add(brillo);
    g.position.set(c.x, c.y + 0.8, c.z);
    g.userData = { y0: c.y + 0.8, fase: c.x, tomado: -1 };
    grupo.add(g); mallasCristal.set(c.id, g);
  }
  animados.push({ animar(dt, tt) {
    for (const g of mallasCristal.values()) {
      if (!g.visible) continue;
      const u = g.userData;
      if (u.tomado >= 0) { // se lo llevó: sube, crece y desaparece
        u.tomado += dt;
        g.position.y += dt * 2.5; g.scale.setScalar(1 + u.tomado * 2);
        if (u.tomado > 0.45) g.visible = false;
        continue;
      }
      g.rotation.y += dt * 1.6;
      if (!op.reducir) g.children[0].position.y = Math.sin(tt * 2 + u.fase) * 0.12;
    }
  } });

  return {
    grupo,
    /** Dónde va el letrero de cada juego: Map(id → Vector3) */
    marcas,
    /**
     * Encoge (con magia) los árboles que quedan entre la cámara y el personaje, para que nunca lo tapen, y vuelve a
     * parar los que ya no estorban. cam y obj: posiciones (x, z) de la cámara y del personaje.
     */
    despejar(cam, obj, dt, inmediato = false) {
      // Los números y letras que flotan solo se ven si están más lejos que el personaje (si no, le tapan la vista)
      const dObj = Math.hypot(obj.x - cam.x, obj.z - cam.z);
      for (const sp of sprites) { sp.getWorldPosition(vs); sp.visible = Math.hypot(vs.x - cam.x, vs.z - cam.z) > Math.max(5, dObj + 1); }
      if (!troncos) return;
      const vx = obj.x - cam.x, vz = obj.z - cam.z, l2 = vx * vx + vz * vz || 1;
      const k = inmediato ? 1 : 1 - Math.pow(0.002, dt);
      let cambio = false;
      deco.arboles.forEach((a, i) => {
        const t = ((a.x - cam.x) * vx + (a.z - cam.z) * vz) / l2; // 0 = en la cámara, 1 = en el personaje
        let meta = 1;
        if (t > -0.15 && t < 1.05) {
          const d = Math.hypot(a.x - (cam.x + vx * t), a.z - (cam.z + vz * t));
          if (d < 1.9 * a.escala + 0.5) meta = 0.04;
        }
        const f = parado[i] + (meta - parado[i]) * k;
        if (Math.abs(f - parado[i]) < 1e-3 && Math.abs(meta - f) < 1e-3) return;
        parado[i] = Math.abs(meta - f) < 1e-3 ? meta : f;
        ponerTronco(a, tmp, parado[i]); tmp.updateMatrix(); troncos.setMatrixAt(i, tmp.matrix);
        ponerCopa(a, tmp, parado[i]); tmp.updateMatrix(); copas.setMatrixAt(i, tmp.matrix);
        cambio = true;
      });
      if (cambio) { troncos.instanceMatrix.needsUpdate = true; copas.instanceMatrix.needsUpdate = true; }
    },
    /** Anima lo que se mueve (dt en s, t en s) */
    animar(dt, t) { for (const a of animados) a.animar(dt, t); },
    /** Enciende el anillo de los lugares de la materia elegida (null = ninguno) */
    resaltar(ids) { for (const [id, a] of resaltes) a.visible = !!ids && ids.has(id); },
    /** Un cristal recién tomado (con animación) o que ya se tenía (sin animación) */
    quitarCristal(id, animar = true) {
      const g = mallasCristal.get(id);
      if (!g) return;
      if (animar && !op.reducir) g.userData.tomado = 0; else g.visible = false;
    },
  };
}

/** Dibuja una plataforma según su tipo (la forma de choque es su cilindro o caja; el dibujo la cubre) */
function plataforma(lote, p, s) {
  const y0 = s.y0, y1 = s.y1, h = y1 - y0;
  switch (p.tipo) {
    case "fuente": {
      if (y0 === 0 && p.r > 1) { // la taza
        lote.poner(new THREE.CylinderGeometry(p.r, p.r + 0.1, y1, 28), "#efe6fb", { pos: [p.x, y1 / 2, p.z] });
        lote.poner(new THREE.CircleGeometry(p.r - 0.2, 28), "#8fd3f4", { pos: [p.x, y1 + 0.005, p.z], rot: [-90, 0, 0] });
        lote.poner(new THREE.TorusGeometry(p.r - 0.1, 0.1, 6, 28), "#ffffff", { pos: [p.x, y1, p.z], rot: [90, 0, 0] });
      } else { // la columna de arriba, con su platito
        lote.poner(new THREE.CylinderGeometry(p.r * 0.55, p.r * 0.7, y1, 18), "#e7dcf7", { pos: [p.x, y1 / 2, p.z] });
        lote.poner(new THREE.CylinderGeometry(p.r, p.r * 0.6, 0.18, 22), "#efe6fb", { pos: [p.x, y1 - 0.09, p.z] });
        lote.poner(new THREE.CircleGeometry(p.r - 0.1, 22), "#a6dcf7", { pos: [p.x, y1 + 0.003, p.z], rot: [-90, 0, 0] });
      }
      break;
    }
    case "hongo": {
      const cap = p.r, alto = Math.min(0.75, y1 * 0.6);
      lote.poner(new THREE.CylinderGeometry(cap * 0.38, cap * 0.48, y1 - alto * 0.4, 14), "#fff4e4", { pos: [p.x, (y1 - alto * 0.4) / 2, p.z] });
      lote.poner(new THREE.SphereGeometry(cap, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), p.id.endsWith("2") ? "#c86bfa" : "#ff6b8b", { pos: [p.x, y1 - alto, p.z], esc: [1, alto / cap, 1] });
      lote.poner(new THREE.CircleGeometry(cap, 20), "#fff1f6", { pos: [p.x, y1 - alto + 0.002, p.z], rot: [90, 0, 0] });
      for (let i = 0; i < 5; i++) {
        const a = i * 72 * RAD + 0.3, rr = cap * 0.62;
        lote.poner(new THREE.SphereGeometry(0.12 * cap, 8, 6), "#ffffff", { pos: [p.x + Math.cos(a) * rr, y1 - alto * 0.22, p.z + Math.sin(a) * rr], esc: [1, 0.45, 1] });
      }
      break;
    }
    case "nenufar": {
      lote.poner(new THREE.CylinderGeometry(p.r, p.r * 0.92, h, 20, 1, false, 0.35, Math.PI * 2 - 0.7), "#5ccf8a", { pos: [p.x, y0 + h / 2, p.z] });
      lote.poner(new THREE.SphereGeometry(0.14, 8, 6), "#ffb3d1", { pos: [p.x + p.r * 0.35, y1 + 0.08, p.z - p.r * 0.2], op: { emisivo: 0.2 } });
      if (y0 > 0.05) lote.poner(new THREE.OctahedronGeometry(0.12), "#bff3ff", { pos: [p.x, y0 - 0.25, p.z], op: { emisivo: 0.9 } });
      break;
    }
    case "roca": {
      lote.poner(new THREE.CylinderGeometry(p.r * 0.95, p.r * 1.1, y1, 8), "#cbbfe0", { pos: [p.x, y1 / 2, p.z] });
      lote.poner(new THREE.CylinderGeometry(p.r * 0.98, p.r * 0.98, 0.12, 8), "#9fdc8a", { pos: [p.x, y1 - 0.05, p.z] });
      break;
    }
    case "piedra": {
      lote.poner(new THREE.BoxGeometry(p.ancho, h, p.fondo), "#d6c8f2", { pos: [p.x, y0 + h / 2, p.z] });
      lote.poner(new THREE.BoxGeometry(p.ancho * 1.02, 0.1, p.fondo * 1.02), "#a5dc8f", { pos: [p.x, y1 - 0.04, p.z] });
      // Debajo: punta de piedra y un brillo mágico (por eso flota)
      lote.poner(new THREE.ConeGeometry(Math.min(p.ancho, p.fondo) * 0.45, 0.6, 6), "#bfb0e3", { pos: [p.x, y0 - 0.3, p.z], rot: [180, 0, 0] });
      lote.poner(new THREE.OctahedronGeometry(0.14), "#e8c4ff", { pos: [p.x, Math.max(0.2, y0 - 0.9), p.z], op: { emisivo: 0.9 } });
      break;
    }
    case "cristal": {
      lote.poner(new THREE.BoxGeometry(p.ancho, h, p.fondo), "#9fe6ff", { pos: [p.x, y0 + h / 2, p.z], op: { brillo: true, emisivo: 0.25 } });
      lote.poner(new THREE.BoxGeometry(p.ancho * 0.7, 0.04, p.fondo * 0.7), "#e8fbff", { pos: [p.x, y1 + 0.01, p.z], op: { emisivo: 0.5 } });
      break;
    }
    case "nube": {
      const r = p.r, cy = y1 - h * 0.45;
      lote.poner(new THREE.SphereGeometry(r, 12, 8), "#ffffff", { pos: [p.x, cy, p.z], esc: [1, h / r * 0.55, 1] });
      for (let i = 0; i < 4; i++) {
        const a = i * 90 * RAD + 0.6;
        lote.poner(new THREE.SphereGeometry(r * 0.45, 8, 6), i % 2 ? "#f4efff" : "#ffffff", { pos: [p.x + Math.cos(a) * r * 0.8, cy - 0.05, p.z + Math.sin(a) * r * 0.8], esc: [1, 0.7, 1] });
      }
      break;
    }
    default:
      if (p.forma === "cilindro") lote.poner(new THREE.CylinderGeometry(p.r, p.r, h, 16), "#d6c8f2", { pos: [p.x, y0 + h / 2, p.z] });
      else lote.poner(new THREE.BoxGeometry(p.ancho, h, p.fondo), "#d6c8f2", { pos: [p.x, y0 + h / 2, p.z] });
  }
}
