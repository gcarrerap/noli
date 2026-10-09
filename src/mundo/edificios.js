// Los edificios del mundo (#25): uno por tipo de mundo/lugares.json → edificios. Cada uno se dibuja con formas
// sencillas que van al lote (una malla por color, ver kit/3d/lote.js) y, si se mueve algo (números o letras que
// flotan, el remolino del portal), lo regresa aparte para animarlo.
//
// Medidas en metros, en el sistema del edificio: centro en (0, 0, 0), la puerta mirando hacia +z (hacia la plaza).
// El radio de choque (lugares.json) debe cubrir todo lo que está a la altura del personaje.
import * as THREE from "../../kit/3d/vendor/three.module.min.js";
import { material } from "../../kit/3d/materiales.js";
import { mergeGeometries } from "../../kit/3d/vendor/BufferGeometryUtils.js";

const G = {
  caja: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  cil: (r0, r1, h, seg = 16) => new THREE.CylinderGeometry(r0, r1, h, seg),
  cono: (r, h, seg = 16) => new THREE.ConeGeometry(r, h, seg),
  esfera: (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h),
  bola: (r, detalle = 1) => new THREE.IcosahedronGeometry(r, detalle),
  toro: (r, t, arco = 360, seg = 24) => new THREE.TorusGeometry(r, t, 8, seg, arco * Math.PI / 180),
  disco: (r, seg = 24) => new THREE.CircleGeometry(r, seg),
  gema: (r) => new THREE.OctahedronGeometry(r),
};

/** Un letrerito flotante con un texto (número o letra), dibujado en un canvas: sale igual en todas las TVs */
export function sprite(texto, color, tam = 0.9) {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const x = c.getContext("2d");
  x.fillStyle = "#ffffff"; x.beginPath(); x.arc(32, 32, 29, 0, Math.PI * 2); x.fill();
  x.lineWidth = 4; x.strokeStyle = color; x.stroke();
  x.fillStyle = color; x.font = "bold 40px Fredoka, 'Arial Rounded MT Bold', Arial, sans-serif";
  x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(texto, 32, 35);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, fog: true }));
  s.scale.set(tam, tam, 1);
  return s;
}

/** Cosas que giran alrededor del edificio (números del castillo, letras del árbol) */
function orbita(textos, colores, radio, alto) {
  const g = new THREE.Group();
  textos.forEach((t, i) => {
    const s = sprite(t, colores[i % colores.length]);
    const a = (i / textos.length) * Math.PI * 2;
    s.position.set(Math.cos(a) * radio, alto + Math.sin(i * 1.7) * 0.5, Math.sin(a) * radio);
    s.userData.y0 = s.position.y; s.userData.fase = i;
    g.add(s);
  });
  return {
    obj: g,
    animar(dt, t) {
      g.rotation.y += dt * 0.25;
      for (const s of g.children) s.position.y = s.userData.y0 + Math.sin(t * 1.4 + s.userData.fase) * 0.18;
    },
  };
}

/**
 * Dibuja un edificio.
 * @param {string} tipo "torre" | "arbol" | "escenario" | "casita" | "tienda" | "fabrica" | "huerto" | "reloj" | "cabana" | "portal"
 * @param {object} lote kit/3d/lote.js
 * @param {THREE.Matrix4} matriz posición y giro del edificio en el mundo
 * @param {{ color?: string, icono?: string, reducir?: boolean }} op color e ícono del juego (para el portal)
 * @returns {{ animados: { obj: THREE.Object3D, animar: (dt, t) => void }[] }} lo que se mueve (en coordenadas del edificio)
 */
export function edificio(tipo, lote, matriz, op = {}) {
  const p = (geom, hex, o = {}) => lote.poner(geom, hex, { ...o, padre: matriz });
  const animados = [];
  const PIEDRA = "#f1e7ff", OSCURO = "#4a3a64";

  if (tipo === "torre") {
    // Castillo de números: torre redonda, almenas, techo de cono, dos torrecitas, puerta, ventanas y bandera
    p(G.cil(1.75, 1.9, 4.4, 20), "#ffe08a", { pos: [0, 2.2, 0] });
    p(G.cil(1.95, 1.95, 0.35, 20), "#ffd166", { pos: [0, 4.55, 0] });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      p(G.caja(0.45, 0.45, 0.35), "#ffd166", { pos: [Math.sin(a) * 1.8, 4.95, Math.cos(a) * 1.8], rot: [0, a * 180 / Math.PI, 0] });
    }
    p(G.cono(1.6, 2.4, 20), "#ff6b4a", { pos: [0, 6.0, 0] });
    p(G.cil(0.03, 0.03, 0.9, 6), OSCURO, { pos: [0, 7.6, 0] });
    p(G.caja(0.55, 0.32, 0.03), "#4cb3ff", { pos: [0.3, 7.85, 0] });
    for (const s of [-1, 1]) {
      p(G.cil(0.55, 0.6, 3.2, 14), "#ffe9b0", { pos: [s * 1.95, 1.6, -0.5] });
      p(G.cono(0.72, 1.4, 14), s < 0 ? "#c86bfa" : "#4cb3ff", { pos: [s * 1.95, 3.9, -0.5] });
    }
    // Puerta (arco) y ventanas
    p(G.caja(1.0, 1.5, 0.2), OSCURO, { pos: [0, 0.75, 1.8] });
    p(G.cil(0.5, 0.5, 0.2, 14), OSCURO, { pos: [0, 1.5, 1.8], rot: [90, 0, 0] });
    for (const [x, y] of [[-0.9, 2.9], [0.9, 2.9], [0, 3.6]]) p(G.disco(0.26, 14), "#8fd3f4", { pos: [x, y, Math.sqrt(1.78 * 1.78 - x * x) + 0.02], rot: [0, Math.asin(x / 1.78) * 180 / Math.PI, 0] });
    // Números que flotan alrededor
    const o = orbita(["1", "2", "3", "+", "−", "="], ["#ff6b4a", "#4cb3ff", "#3ccf8e", "#c86bfa"], 3.0, 3.6);
    animados.push(o);
  } else if (tipo === "arbol") {
    // Árbol de las letras: tronco ancho con puerta, raíces, copa de tres bolas y letras que flotan
    p(G.cil(1.25, 1.6, 4.6, 16), "#b07a52", { pos: [0, 2.3, 0] });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      p(G.esfera(0.55, 10, 8), "#9b6744", { pos: [Math.sin(a) * 1.45, 0.15, Math.cos(a) * 1.45], esc: [1.4, 0.55, 0.8], rot: [0, a * 180 / Math.PI, 0] });
    }
    p(G.bola(2.5), "#6fd6a8", { pos: [0, 6.2, 0], esc: [1, 0.8, 1] });
    p(G.bola(1.8), "#8fe6bf", { pos: [-1.7, 5.4, 0.4], esc: [1, 0.85, 1] });
    p(G.bola(1.7), "#58c79a", { pos: [1.6, 5.6, -0.3], esc: [1, 0.85, 1] });
    p(G.caja(0.9, 1.4, 0.2), OSCURO, { pos: [0, 0.7, 1.45] });
    p(G.cil(0.45, 0.45, 0.2, 14), OSCURO, { pos: [0, 1.4, 1.45], rot: [90, 0, 0] });
    p(G.disco(0.28, 14), "#ffd166", { pos: [0.55, 2.9, 1.42], op: { emisivo: 0.4 } });
    // Libros en el marco de la puerta
    ["#ff6b4a", "#4cb3ff", "#ffd166"].forEach((c, i) => p(G.caja(0.14, 0.4, 0.3), c, { pos: [-0.85 + i * 0.16, 0.2, 1.55] }));
    const o = orbita(["A", "B", "C", "a", "e", "S"], ["#3ccf8e", "#c86bfa", "#ff6b4a", "#4cb3ff"], 3.2, 3.4);
    animados.push(o);
  } else if (tipo === "escenario") {
    // Escenario: tarima, escalones, telón morado con estrellas, focos de colores y una estrella grande arriba
    p(G.caja(4.4, 0.6, 2.8), "#ff9ccc", { pos: [0, 0.3, 0] });
    p(G.caja(4.5, 0.08, 2.9), "#ffffff", { pos: [0, 0.62, 0] });
    p(G.caja(1.4, 0.3, 0.5), "#ffc1df", { pos: [0, 0.15, 1.6] });
    for (const s of [-1, 1]) {
      p(G.caja(0.35, 3.8, 0.35), "#7e4ad6", { pos: [s * 2.2, 1.9, -1.2] });
      p(G.caja(1.3, 3.2, 0.12), "#9b5de5", { pos: [s * 1.45, 2.2, -1.15] });
    }
    p(G.caja(4.8, 0.7, 0.4), "#7e4ad6", { pos: [0, 3.95, -1.2] });
    p(G.caja(1.6, 3.2, 0.06), "#5e3aa8", { pos: [0, 2.2, -1.28] });
    p(G.gema(0.55), "#ffd166", { pos: [0, 4.9, -1.2], esc: [1, 1, 0.4], op: { emisivo: 0.5 } });
    for (let i = 0; i < 7; i++) p(G.esfera(0.09, 8, 6), ["#ffd166", "#ff6b4a", "#4cb3ff", "#3ccf8e"][i % 4], { pos: [-1.8 + i * 0.6, 3.6, -0.98], op: { emisivo: 0.7 } });
    for (const s of [-1, 1]) {
      p(G.cil(0.05, 0.05, 2.6, 6), OSCURO, { pos: [s * 2.6, 1.3, 1.3] });
      p(G.cono(0.28, 0.45, 10), OSCURO, { pos: [s * 2.6, 2.75, 1.3], rot: [-50, 0, s * -30] });
    }
  } else if (tipo === "casita") {
    // Casita: paredes, techo de dos aguas, chimenea, puerta, ventanas, un corazón del color del juego y flores
    const c = op.color || "#9b8cff";
    p(G.caja(2.6, 2.2, 2.4), "#fff4e4", { pos: [0, 1.1, 0] });
    p(G.caja(3.0, 1.9, 1.9), c, { pos: [0, 2.2, 0], rot: [45, 0, 0], esc: [1, 0.78, 1] }); // techo (un rombo encajado)
    p(G.caja(0.45, 1.3, 0.45), "#d98b6a", { pos: [0.75, 3.1, -0.5] });
    p(G.caja(0.8, 1.35, 0.12), OSCURO, { pos: [0, 0.68, 1.22] });
    p(G.esfera(0.05, 6, 4), "#ffd166", { pos: [0.25, 0.7, 1.3] });
    for (const x of [-0.85, 0.85]) {
      p(G.caja(0.6, 0.6, 0.08), "#8fd3f4", { pos: [x, 1.35, 1.22] });
      p(G.caja(0.72, 0.1, 0.16), "#ffffff", { pos: [x, 1.0, 1.24] });
      p(G.caja(0.66, 0.18, 0.24), "#b07a52", { pos: [x, 0.88, 1.3] }); // maceta
      for (let i = 0; i < 3; i++) p(G.esfera(0.08, 6, 4), ["#ff6b8b", "#ffd166", "#c86bfa"][i], { pos: [x - 0.2 + i * 0.2, 1.04, 1.32] });
    }
    p(G.gema(0.22), "#ff6b8b", { pos: [0, 2.55, 1.0], esc: [1, 1, 0.4], op: { emisivo: 0.4 } });
  } else if (tipo === "tienda") {
    // Tiendita: mostrador con ventana, toldo de rayas del color del juego, letrero y cajas de frutas
    const c = op.color || "#ef8b2c";
    p(G.caja(3.0, 2.1, 2.2), "#fff4e4", { pos: [0, 1.05, 0] });
    p(G.caja(3.2, 0.25, 2.4), c, { pos: [0, 2.22, 0] });
    p(G.caja(2.2, 0.55, 0.12), c, { pos: [0, 2.7, 1.0] }); // letrero
    p(G.caja(1.8, 0.3, 0.06), "#ffffff", { pos: [0, 2.7, 1.07] });
    for (let i = 0; i < 6; i++) { // toldo
      p(G.caja(0.52, 0.06, 0.95), i % 2 ? "#ffffff" : c, { pos: [-1.3 + i * 0.52, 1.95, 1.45], rot: [24, 0, 0] });
      p(G.cil(0.13, 0.13, 0.52, 10), i % 2 ? "#ffffff" : c, { pos: [-1.3 + i * 0.52, 1.75, 1.86], rot: [0, 0, 90], esc: [1, 1, 0.6] });
    }
    p(G.caja(1.4, 0.8, 0.08), "#8fd3f4", { pos: [-0.55, 1.25, 1.12] });
    p(G.caja(1.6, 0.5, 0.35), "#e3b07a", { pos: [-0.55, 0.55, 1.25] }); // mostrador
    p(G.caja(0.7, 1.4, 0.1), OSCURO, { pos: [0.95, 0.7, 1.12] });
    for (const [x, col] of [[-1.05, "#ff6b4a"], [-0.55, "#ffd166"], [-0.05, "#3ccf8e"]]) {
      for (let i = 0; i < 3; i++) p(G.esfera(0.1, 8, 6), col, { pos: [x - 0.12 + i * 0.12, 0.88, 1.3] });
    }
  } else if (tipo === "fabrica") {
    // Fábrica: nave con techo de dientes, chimenea con humo, engrane del color del juego y portón de rayas
    const c = op.color || "#3ccf8e";
    p(G.caja(3.4, 2.3, 2.4), "#e9e4f7", { pos: [0, 1.15, 0] });
    // Techo de dientes de sierra: tres rampas con su ventana de vidrio
    for (let i = 0; i < 3; i++) {
      const z = -0.8 + i * 0.8;
      p(G.caja(3.5, 0.08, 0.92), i % 2 ? c : "#b9a8ff", { pos: [0, 2.53, z + 0.02], rot: [-30, 0, 0] });
      p(G.caja(3.4, 0.46, 0.05), "#bfeaff", { pos: [0, 2.53, z - 0.38] });
    }
    p(G.cil(0.3, 0.38, 2.0, 12), "#d98b6a", { pos: [-1.1, 3.3, -0.7] });
    p(G.cil(0.34, 0.34, 0.2, 12), "#b8705a", { pos: [-1.1, 4.3, -0.7] });
    for (let i = 0; i < 5; i++) p(G.caja(1.5, 0.12, 0.06), i % 2 ? "#ffd166" : OSCURO, { pos: [0.6, 0.2 + i * 0.27, 1.22] }); // portón
    p(G.toro(0.42, 0.12, 360, 16), c, { pos: [-0.95, 1.55, 1.24] });
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; p(G.caja(0.16, 0.16, 0.14), c, { pos: [-0.95 + Math.cos(a) * 0.56, 1.55 + Math.sin(a) * 0.56, 1.24], rot: [0, 0, a * 180 / Math.PI] }); }
    p(G.cil(0.12, 0.12, 0.2, 10), "#ffffff", { pos: [-0.95, 1.55, 1.26], rot: [90, 0, 0] });
    for (const x of [-1.25, -0.35]) p(G.caja(0.5, 0.4, 0.06), "#8fd3f4", { pos: [x + 0.3, 0.55, 1.22] });
    // Humo que sube de la chimenea
    const humo = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(G.bola(0.28, 0), material("#ffffff", { opacidad: 0.8 }));
      b.userData.f = i / 3; humo.add(b);
    }
    humo.position.set(-1.1, 4.5, -0.7);
    animados.push({ obj: humo, animar: (dt) => {
      for (const b of humo.children) {
        b.userData.f = (b.userData.f + dt * (op.reducir ? 0.08 : 0.3)) % 1;
        const f = b.userData.f;
        b.position.set(f * 0.5, f * 1.6, 0); b.scale.setScalar(0.6 + f * 0.9);
      }
    } });
  } else if (tipo === "huerto") {
    // Granero rojo con su huerto: surcos con lechugas y zanahorias a los lados (bajitos: se camina por encima)
    p(G.caja(2.8, 2.3, 2.4), "#ef6b5b", { pos: [0, 1.15, 0] });
    p(G.caja(3.0, 1.95, 1.95), "#c8473c", { pos: [0, 2.3, 0], rot: [45, 0, 0], esc: [1, 0.8, 1] });
    p(G.caja(3.12, 1.8, 1.8), "#ffffff", { pos: [0, 2.3, 0], rot: [45, 0, 0], esc: [1, 0.8, 1] }); // orillas blancas
    p(G.caja(1.2, 1.5, 0.1), "#ffffff", { pos: [0, 0.75, 1.22] });
    p(G.caja(1.0, 1.32, 0.12), "#b33a30", { pos: [0, 0.72, 1.24] });
    for (const r of [45, -45]) p(G.caja(1.5, 0.1, 0.06), "#ffffff", { pos: [0, 0.72, 1.31], rot: [0, 0, r] });
    p(G.disco(0.28, 14), "#ffd166", { pos: [0, 2.35, 1.22] });
    for (const s of [-1, 1]) for (let fila = 0; fila < 3; fila++) {
      const x = s * (2.1 + fila * 0.55);
      p(G.caja(0.36, 0.08, 2.2), "#a97852", { pos: [x, 0.04, 0.2] });
      for (let i = 0; i < 4; i++) {
        const z = -0.6 + i * 0.55;
        if (fila === 1) { p(G.cono(0.07, 0.3, 6), "#ff8a3d", { pos: [x, 0.12, z], rot: [180, 0, 0] }); p(G.cono(0.09, 0.18, 5), "#3ccf8e", { pos: [x, 0.3, z] }); }
        else p(G.bola(0.14, 0), fila ? "#58c79a" : "#8fe6bf", { pos: [x, 0.16, z], esc: [1, 0.75, 1] });
      }
    }
  } else if (tipo === "reloj") {
    // Torre del reloj con un dragoncito arriba. Las manecillas marcan la hora de verdad.
    const c = op.color || "#ffc43d";
    p(G.caja(1.8, 4.6, 1.8), "#fff0d6", { pos: [0, 2.3, 0] });
    p(G.caja(2.0, 0.3, 2.0), c, { pos: [0, 4.65, 0] });
    p(G.cono(1.5, 1.7, 4), "#7e4ad6", { pos: [0, 5.65, 0], rot: [0, 45, 0] });
    p(G.caja(0.8, 1.3, 0.1), OSCURO, { pos: [0, 0.65, 0.92] });
    p(G.cil(0.4, 0.4, 0.1, 14), OSCURO, { pos: [0, 1.3, 0.92], rot: [90, 0, 0] });
    p(G.cil(0.68, 0.68, 0.1, 28), c, { pos: [0, 3.4, 0.92], rot: [90, 0, 0] });
    p(G.cil(0.58, 0.58, 0.12, 28), "#ffffff", { pos: [0, 3.4, 0.94], rot: [90, 0, 0] });
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; p(G.caja(0.05, i % 3 ? 0.08 : 0.14, 0.03), OSCURO, { pos: [Math.sin(a) * 0.48, 3.4 + Math.cos(a) * 0.48, 1.0], rot: [0, 0, -a * 180 / Math.PI] }); }
    // Dragoncito en la orilla del techo
    const V = "#58c79a", V2 = "#3ea67c";
    p(G.esfera(0.32, 10, 8), V, { pos: [0.55, 5.05, 0.75], esc: [1, 0.85, 1.2] });
    p(G.esfera(0.24, 10, 8), V, { pos: [0.6, 5.45, 1.05] });
    p(G.esfera(0.13, 8, 6), V2, { pos: [0.6, 5.38, 1.27], esc: [1, 0.8, 1.1] });
    for (const s of [-1, 1]) {
      p(G.cono(0.06, 0.2, 6), "#ffd166", { pos: [0.6 + s * 0.11, 5.7, 1.0] });
      p(G.esfera(0.05, 6, 4), OSCURO, { pos: [0.6 + s * 0.1, 5.5, 1.24] });
      p(G.cono(0.22, 0.5, 4), V2, { pos: [0.55 + s * 0.32, 5.25, 0.6], rot: [0, 0, s * -70], esc: [1, 1, 0.25] });
    }
    p(G.cono(0.12, 0.6, 6), V, { pos: [0.5, 4.95, 0.25], rot: [-70, 0, 0] });
    // Manecillas (se mueven: van aparte del lote)
    const reloj = new THREE.Group();
    const mano = (largo, grueso) => { const g = new THREE.Group(); const m = new THREE.Mesh(G.caja(grueso, largo, 0.03), material(OSCURO)); m.position.y = largo / 2 - 0.04; g.add(m); reloj.add(g); return g; };
    const horas = mano(0.3, 0.07), minutos = mano(0.44, 0.05);
    reloj.position.set(0, 3.4, 1.03);
    let cuenta = 99;
    animados.push({ obj: reloj, animar: (dt) => {
      cuenta += dt;
      if (cuenta < 1) return; // una vez por segundo basta
      cuenta = 0;
      const d = new Date(), m = d.getMinutes() + d.getSeconds() / 60, h = (d.getHours() % 12) + m / 60;
      minutos.rotation.z = -m / 60 * Math.PI * 2; horas.rotation.z = -h / 12 * Math.PI * 2;
    } });
  } else if (tipo === "cabana") {
    // Cabaña del bosque: troncos, techo verde con musgo, porche y un puentecito de madera en la entrada
    const T = "#b07a52", T2 = "#9b6744";
    for (let i = 0; i < 6; i++) {
      p(G.cil(0.17, 0.17, 2.9, 8), i % 2 ? T : T2, { pos: [0, 0.17 + i * 0.32, -1.05], rot: [0, 0, 90] });
      p(G.cil(0.17, 0.17, 2.9, 8), i % 2 ? T2 : T, { pos: [0, 0.17 + i * 0.32, 1.05], rot: [0, 0, 90] });
      for (const s of [-1, 1]) p(G.cil(0.17, 0.17, 2.3, 8), i % 2 ? T : T2, { pos: [s * 1.3, 0.33 + i * 0.32, 0], rot: [90, 0, 0] });
    }
    p(G.caja(2.5, 1.9, 1.9), "#e8c79a", { pos: [0, 1.0, 0] }); // relleno
    p(G.caja(3.2, 1.9, 1.9), "#5ccf8a", { pos: [0, 2.05, 0], rot: [45, 0, 0], esc: [1, 0.85, 1.05] });
    p(G.caja(0.8, 1.3, 0.1), OSCURO, { pos: [0, 0.65, 1.2] });
    p(G.caja(0.5, 0.5, 0.08), "#ffd166", { pos: [0.85, 1.25, 1.22], op: { emisivo: 0.3 } });
    for (let i = 0; i < 5; i++) p(G.caja(1.2, 0.06, 0.22), i % 2 ? T : T2, { pos: [0, 0.05 + Math.sin(i / 4 * Math.PI) * 0.12, 1.5 + i * 0.24] }); // puentecito
  } else {
    // Portal mágico: dos columnas, un arco y un remolino del color del juego. Arriba, el ícono del juego.
    const c = op.color || "#c86bfa";
    for (const s of [-1, 1]) {
      p(G.cil(0.32, 0.4, 2.6, 12), PIEDRA, { pos: [s * 1.35, 1.3, 0] });
      p(G.caja(0.9, 0.3, 0.9), "#e1d3f7", { pos: [s * 1.35, 0.15, 0] });
    }
    p(G.toro(1.35, 0.3, 180, 20), PIEDRA, { pos: [0, 2.6, 0] });
    p(G.gema(0.25), c, { pos: [0, 4.15, 0], op: { emisivo: 0.5 } });
    // Remolino: un disco que brilla y unas gemitas girando (todas en una sola malla: 1 dibujo y no 8)
    const rem = new THREE.Group();
    const disco = new THREE.Mesh(G.disco(1.05, 28), material(c, { opacidad: 0.55, emisivo: 0.6, dobleCara: true }));
    disco.scale.y = 1.25; rem.add(disco);
    const gemas = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, r = 0.35 + (i % 3) * 0.22;
      gemas.push(G.gema(0.09).translate(Math.cos(a) * r, Math.sin(a) * r * 1.25, 0.05));
    }
    const giran = new THREE.Mesh(mergeGeometries(gemas), material("#ffffff", { emisivo: 0.8 }));
    for (const g of gemas) g.dispose();
    rem.add(giran);
    rem.position.set(0, 1.75, 0);
    animados.push({ obj: rem, animar: (dt) => { giran.rotation.z += dt * (op.reducir ? 0.4 : 1.6); } });
  }
  return { animados };
}
