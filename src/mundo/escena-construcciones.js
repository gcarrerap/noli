// Lo que hay en una isla en 3D (#176): las grutas de los juegos (abiertas o cerradas), la pared de rocas de la orilla con
// sus arcos, las rocas para brincar, el cristal gigante del centro y los racimos de cristales con sus efectos. Los datos
// ya vienen armados (engine/construcciones.js); aquí solo se dibuja. La arma escena-islas.js cuando la isla está cerca
// (enfocar) y la libera cuando ya no.
//
// Rendimiento: las rocas y las grutas comparten DOS texturas que se repiten (roca y suelo de Petra, proyectadas en metros:
// kit/3d/lote.js → uvMundo), así que todo lo quieto se junta en pocas mallas. TODOS los cristales de la isla son UNA malla
// con un material (matcap hecho en código + borde luminoso + latido: cuesta lo mismo uno que cien). Los destellos y los
// halos son UN sistema de puntos. Lo caro (cristal gigante con refracción y luces de colores) solo existe en calidad alta.
import * as THREE from "../../kit/3d/vendor/three.module.min.js";
import { mergeGeometries } from "../../kit/3d/vendor/BufferGeometryUtils.js";
import { material } from "../../kit/3d/materiales.js";
import { crearLote } from "../../kit/3d/lote.js";
import { texturaImagen } from "../../kit/3d/texturas.js";
import { azar } from "../engine/mundo.js";

const RAD = Math.PI / 180;
const COLORES = ["#ff8fd0", "#c79bff", "#e7a6ff", "#ffb0e0", "#a98bff", "#f6a8ff"];
const BASE_MUNDO = new URL("../../mundo/", import.meta.url);

// ---------- Texturas ----------

function textura(arte) {
  if (!arte) return null;
  const t = texturaImagen(new URL(arte, BASE_MUNDO).href);
  if (!t) return null;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** Matcap de gema (una vez): el reflejo ya pintado. Así brillan sin luces, de día y de noche */
let matcapCache = null;
function matcap() {
  if (matcapCache || typeof document === "undefined") return matcapCache;
  const n = 256, c = document.createElement("canvas"); c.width = c.height = n;
  const g = c.getContext("2d");
  let r = g.createRadialGradient(n * 0.42, n * 0.38, n * 0.05, n / 2, n / 2, n / 2);
  r.addColorStop(0, "#ffffff"); r.addColorStop(0.35, "#f3e6ff"); r.addColorStop(0.75, "#b9a2e6"); r.addColorStop(1, "#7e66c4");
  g.fillStyle = r; g.fillRect(0, 0, n, n);
  // Un brillo fuerte arriba a la izquierda y uno suave abajo (como una piedra pulida)
  r = g.createRadialGradient(n * 0.3, n * 0.26, 0, n * 0.3, n * 0.26, n * 0.16);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, n, n);
  r = g.createRadialGradient(n * 0.66, n * 0.74, 0, n * 0.66, n * 0.74, n * 0.2);
  r.addColorStop(0, "rgba(255,240,255,0.7)"); r.addColorStop(1, "rgba(255,240,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, n, n);
  matcapCache = new THREE.CanvasTexture(c);
  matcapCache.colorSpace = THREE.SRGBColorSpace;
  return matcapCache;
}

/** La entrada de una gruta abierta: luz del color del juego al fondo (una por color) */
const entradas = new Map();
function entrada(hex) {
  if (typeof document === "undefined") return null;
  if (entradas.has(hex)) return entradas.get(hex);
  const n = 128, c = document.createElement("canvas"); c.width = c.height = n;
  const g = c.getContext("2d"), r = g.createRadialGradient(n / 2, n * 0.62, 2, n / 2, n * 0.62, n * 0.62);
  r.addColorStop(0, "#ffffff"); r.addColorStop(0.2, hex); r.addColorStop(0.75, "#3a2152"); r.addColorStop(1, "#24123a");
  g.fillStyle = r; g.fillRect(0, 0, n, n);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  entradas.set(hex, t);
  return t;
}

// ---------- Materiales de los cristales ----------

/**
 * El material de TODOS los cristales: matcap con el color de cada vértice (punta clara, base oscura), un borde que brilla
 * (Fresnel) y un latido lento (cada cristal con su fase). uLuz sube de noche y en calidad alta (para el resplandor).
 */
function materialCristal() {
  const m = new THREE.MeshMatcapMaterial({ matcap: matcap(), vertexColors: true, flatShading: true });
  const u = { uTiempo: { value: 0 }, uLuz: { value: 1 }, uBorde: { value: 0.9 } };
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = "attribute float fase;\nvarying float vFase;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vFase = fase;");
    sh.fragmentShader = "uniform float uTiempo;\nuniform float uLuz;\nuniform float uBorde;\nvarying float vFase;\n" +
      sh.fragmentShader.replace("#include <opaque_fragment>", `
  float latido = 0.5 + 0.5 * sin(uTiempo * 1.6 + vFase);
  float borde = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.0);
  outgoingLight = outgoingLight * (0.82 + 0.3 * latido) * uLuz + diffuseColor.rgb * borde * uBorde * (0.55 + 0.45 * latido) * uLuz;
  #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => "noli-cristal";
  return m;
}

/** Destellos (titilan) y halos (resplandor suave) en UN sistema de puntos aditivos */
function materialPuntos() {
  return new THREE.ShaderMaterial({
    uniforms: { uTiempo: { value: 0 }, uLuz: { value: 1 }, uEscala: { value: 600 } },
    vertexShader: `
      attribute float fase; attribute float tam; attribute vec3 color;
      uniform float uTiempo; uniform float uEscala;
      varying float vBrillo; varying float vHalo; varying vec3 vColor;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vHalo = tam > 1.2 ? 1.0 : 0.0;
        float tw = pow(0.5 + 0.5 * sin(uTiempo * (1.8 + fract(fase) * 2.6) + fase * 6.2831), 3.0);
        vBrillo = vHalo > 0.5 ? 0.85 + 0.15 * sin(uTiempo * 1.6 + fase) : tw;
        vColor = color;
        gl_PointSize = tam * (vHalo > 0.5 ? 1.0 : 0.35 + 0.9 * tw) * uEscala / max(0.5, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uLuz;
      varying float vBrillo; varying float vHalo; varying vec3 vColor;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0; float d = length(p);
        float a;
        if (vHalo > 0.5) a = pow(max(0.0, 1.0 - d), 2.4) * 0.32 * vBrillo;
        else {
          float cruz = max(0.0, 1.0 - abs(p.x) * 7.0) * max(0.0, 1.0 - abs(p.y)) + max(0.0, 1.0 - abs(p.y) * 7.0) * max(0.0, 1.0 - abs(p.x));
          a = (cruz * 0.9 + pow(max(0.0, 1.0 - d), 3.0)) * vBrillo;
        }
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor * uLuz * (vHalo > 0.5 ? 1.0 : 1.7), a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

// ---------- Piezas ----------

/** Una geometría con caras planas (facetada): sin índices y con la normal de cada cara */
function facetada(g) {
  const f = g.index ? g.toNonIndexed() : g;
  f.computeVertexNormals();
  return f;
}

/** Un prisma de cristal (hexagonal con punta), con la base en y = 0 */
function prisma(r, h) {
  const cuerpo = new THREE.CylinderGeometry(r * 0.9, r, h * 0.72, 6, 1);
  cuerpo.translate(0, h * 0.36, 0);
  const punta = new THREE.ConeGeometry(r * 0.9, h * 0.28, 6, 1);
  punta.translate(0, h * 0.86, 0);
  const g = mergeGeometries([cuerpo.toNonIndexed(), punta.toNonIndexed()]);
  cuerpo.dispose(); punta.dispose();
  g.deleteAttribute("uv");
  g.computeVertexNormals();
  return g;
}

/**
 * Junta muchos cristales en UNA geometría con color por vértice (degradado: base del color, punta casi blanca) y la fase
 * del latido de cada uno.
 */
function crearJuntaCristales() {
  const geos = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  const c0 = new THREE.Color(), c1 = new THREE.Color("#ffffff");
  return {
    /** Un cristal de radio r y alto h, en (x, y, z), inclinado (grados) y del color hex */
    poner(x, y, z, r, h, hex, inclina = [0, 0, 0], fase = 0) {
      const g = prisma(r, h);
      const pos = g.attributes.position, n = pos.count;
      const col = new Float32Array(n * 3), fa = new Float32Array(n).fill(fase);
      c0.set(hex);
      for (let i = 0; i < n; i++) {
        const t = Math.max(0, Math.min(1, pos.getY(i) / h)), k = Math.pow(t, 1.6) * 0.6;
        col[i * 3] = c0.r + (c1.r - c0.r) * k; col[i * 3 + 1] = c0.g + (c1.g - c0.g) * k; col[i * 3 + 2] = c0.b + (c1.b - c0.b) * k;
      }
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      g.setAttribute("fase", new THREE.BufferAttribute(fa, 1));
      m.compose(v.set(x, y, z), q.setFromEuler(e.set(inclina[0] * RAD, inclina[1] * RAD, inclina[2] * RAD)), s.set(1, 1, 1));
      g.applyMatrix4(m);
      geos.push(g);
    },
    get cuantos() { return geos.length; },
    cerrar() {
      if (!geos.length) return null;
      const g = mergeGeometries(geos, false);
      for (const x of geos) x.dispose();
      geos.length = 0;
      return g;
    },
  };
}

// ---------- La isla ----------

/**
 * @param {object} C construcciones de una isla (armarConstrucciones(...).get(id))
 * @param {object} isla la isla de la red (con f: forma)
 * @param {object[]} lugares lugaresIslas(...) de ESTA isla
 * @param {{ reducir?: boolean, alta?: boolean }} op
 * @returns {{ grupo, marcas: Map<string, THREE.Vector3>, animar(dt, t), efectos(o), sonar(pos), estallido(x, y, z), liberar() }}
 */
export function crearConstrucciones(C, isla, lugares, op = {}) {
  const grupo = new THREE.Group(); grupo.name = "construcciones:" + C.isla;
  const rnd = azar(C.isla.split("").reduce((s, ch) => s * 33 + ch.charCodeAt(0), 5));
  const roca = textura(C.arte.roca), suelo = textura(C.arte.suelo);
  // Las texturas de Petra son muy claras: un tinte lila les da contraste con el cielo (y el suelo queda más claro que las paredes)
  const opRoca = roca ? { mapa: roca, uvMundo: 0.34, tinte: true } : {}, opSuelo = suelo ? { mapa: suelo, uvMundo: 0.2, tinte: true } : {};
  const colRoca = roca ? "#cdbdf0" : "#c8b8ec", colSuelo = suelo ? "#f1e8ff" : "#dcc4ff";
  const L = crearLote(), K = crearJuntaCristales();
  const halos = [], destellos = [], sonoros = [];
  const marcas = new Map();
  const color = () => COLORES[Math.floor(rnd() * COLORES.length)];

  /** Un racimo: uno grande al centro y varios alrededor, inclinados hacia afuera */
  function racimo(x, y, z, k = 1, cuantos = 4, { halo = true, sonar = false } = {}) {
    const base = color();
    K.poner(x, y, z, 0.22 * k, 1.25 * k, base, [rnd() * 10 - 5, rnd() * 60, rnd() * 10 - 5], rnd() * 6.28);
    for (let n = 0; n < cuantos; n++) {
      const a = (n / cuantos) * 360 + rnd() * 40, d = 0.22 * k;
      const ax = Math.sin(a * RAD), az = Math.cos(a * RAD);
      K.poner(x + ax * d, y, z + az * d, (0.11 + rnd() * 0.08) * k, (0.5 + rnd() * 0.5) * k, rnd() < 0.5 ? base : color(),
        [az * (18 + rnd() * 18), rnd() * 60, -ax * (18 + rnd() * 18)], rnd() * 6.28);
    }
    if (halo) halos.push({ x, y: y + 0.6 * k, z, tam: 2.2 * k, color: base });
    for (let n = 0; n < 2 + Math.floor(k * 2); n++) destellos.push({ x: x + (rnd() - 0.5) * 1.2 * k, y: y + 0.3 + rnd() * 1.4 * k, z: z + (rnd() - 0.5) * 1.2 * k });
    if (sonar) sonoros.push({ x, z, nota: sonoros.length });
  }

  // ---- El piso de la isla, con la textura del suelo de Petra ----
  const borde = 1.6, f = isla.f;
  L.poner(new THREE.CircleGeometry(f.r - borde, 64), colSuelo, { pos: [f.x, 0.012, f.z], rot: [-90, 0, 0], op: opSuelo });

  // ---- La pared de la orilla (rocas facetadas) y los arcos ----
  const dodeca = facetada(new THREE.DodecahedronGeometry(1, 0));
  C.orilla.forEach((r, n) => {
    const ey = (r.alto / (2 * r.r)) * 1.18;
    L.poner(dodeca, colRoca, { pos: [r.x, r.alto / 2 - 0.12, r.z], esc: [r.r, r.r * ey, r.r], rot: [rnd() * 20, rnd() * 360, rnd() * 20], op: opRoca });
    if (n % 2 === 0) L.poner(dodeca, colRoca, { pos: [r.x + (rnd() - 0.5) * 1.2, r.alto * 0.3, r.z + (rnd() - 0.5) * 1.2], esc: r.r * 0.6, rot: [rnd() * 40, rnd() * 360, 0], op: opRoca });
    // Cristales al pie (del lado de adentro) y, de vez en cuando, arriba
    const hacia = { x: isla.c.x - r.x, z: isla.c.z - r.z }, d = Math.hypot(hacia.x, hacia.z) || 1;
    if (n % 3 === 0) racimo(r.x + (hacia.x / d) * (r.r + 0.2), 0, r.z + (hacia.z / d) * (r.r + 0.2), 0.7 + rnd() * 0.4, 3, { halo: n % 6 === 0 });
    if (n % 5 === 2) racimo(r.x, r.alto - 0.25, r.z, 0.8, 3, { halo: false });
  });
  const toro = new THREE.TorusGeometry(1, 0.5, 6, 14, Math.PI);
  for (const a of C.arcos) {
    const R = Math.hypot(a.b.x - a.a.x, a.b.z - a.a.z) / 2, mx = (a.a.x + a.b.x) / 2, mz = (a.a.z + a.b.z) / 2;
    const giro = -Math.atan2(a.b.z - a.a.z, a.b.x - a.a.x) / RAD;
    L.poner(facetada(new THREE.TorusGeometry(R, 0.55, 5, 12, Math.PI)), colRoca, { pos: [mx, a.alto - 0.5, mz], rot: [0, giro, 0], esc: [1, 0.42, 1.1], op: opRoca });
    racimo(mx, a.alto - 0.5 + R * 0.42 + 0.2, mz, 0.75, 4, { halo: true });
  }
  toro.dispose();

  // ---- Las rocas para brincar (con su cristal para encontrar encima: ese lo dibuja escena-mundo.js) ----
  for (const r of C.rocas) {
    L.poner(facetada(new THREE.CylinderGeometry(r.r, r.r * 1.12, r.alto, 7)), colRoca, { pos: [r.x, r.alto / 2, r.z], rot: [0, rnd() * 360, 0], op: opRoca });
    racimo(r.x + r.r * 0.9, 0, r.z - r.r * 0.3, 0.5, 2, { halo: false });
  }

  // ---- El cristal gigante del centro ----
  let gigante = null, nucleo = null, luces = [];
  const matGiganteBajo = materialCristal(), matGiganteAlto = new THREE.MeshPhysicalMaterial({
    color: "#f6e2ff", transmission: 1, thickness: 1.8, roughness: 0.06, metalness: 0, ior: 1.5, flatShading: true,
    attenuationColor: new THREE.Color("#d995ff"), attenuationDistance: 2.4, emissive: new THREE.Color("#b76cff"), emissiveIntensity: 0.18,
  });
  if (C.centro) {
    const c = C.centro, h = c.alto, r = c.r * 0.72;
    const g = prisma(r, h);
    const col = new Float32Array(g.attributes.position.count * 3), fa = new Float32Array(g.attributes.position.count).fill(1.3);
    const c0 = new THREE.Color("#e6a6ff"), c1 = new THREE.Color("#ffffff");
    for (let i = 0; i < g.attributes.position.count; i++) { const k = Math.pow(g.attributes.position.getY(i) / h, 1.4) * 0.65; col.set([c0.r + (c1.r - c0.r) * k, c0.g + (c1.g - c0.g) * k, c0.b + (c1.b - c0.b) * k], i * 3); }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setAttribute("fase", new THREE.BufferAttribute(fa, 1));
    gigante = new THREE.Mesh(g, matGiganteBajo);
    gigante.position.set(c.x, 0, c.z); gigante.rotation.y = 0.3;
    grupo.add(gigante);
    // Un corazón que brilla adentro (se ve a través del cristal con refracción, en calidad alta)
    nucleo = new THREE.Mesh(prisma(r * 0.38, h * 0.55), new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd2ff").multiplyScalar(2.2), toneMapped: false }));
    nucleo.position.set(c.x, h * 0.18, c.z); nucleo.visible = false;
    grupo.add(nucleo);
    // Cristales medianos alrededor, rocas en la base y un halo grande
    for (let n = 0; n < 7; n++) {
      const a = (n / 7) * 360 + rnd() * 20, d = c.r * 0.95, ax = Math.sin(a * RAD), az = Math.cos(a * RAD);
      K.poner(c.x + ax * d, 0, c.z + az * d, 0.32 + rnd() * 0.16, 1.6 + rnd() * 1.6, color(), [az * (16 + rnd() * 14), rnd() * 60, -ax * (16 + rnd() * 14)], rnd() * 6.28);
      L.poner(dodeca, colRoca, { pos: [c.x + ax * (c.r + 0.4), 0.15, c.z + az * (c.r + 0.4)], esc: [0.55, 0.38, 0.55], rot: [rnd() * 30, rnd() * 360, 0], op: opRoca });
    }
    halos.push({ x: c.x, y: h * 0.55, z: c.z, tam: 7, color: "#e3a6ff" });
    for (let n = 0; n < 14; n++) destellos.push({ x: c.x + (rnd() - 0.5) * 3.4, y: 0.6 + rnd() * h, z: c.z + (rnd() - 0.5) * 3.4 });
    sonoros.push({ x: c.x, z: c.z, nota: 7, r: c.r + 2.2 });
    // Luces de colores (solo en calidad alta): rosa y lila, pulsan con los cristales
    luces = [["#ff8fd8", -1], ["#b48cff", 1]].map(([hex, s]) => { const l = new THREE.PointLight(hex, 0, 16, 1.2); l.position.set(c.x + s * 1.6, 2.6, c.z + 1.2); l.visible = false; grupo.add(l); return l; });
  }

  // ---- Las grutas de los juegos (todas construidas; las cerradas con reja) ----
  const domo = facetada(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2));
  const bloque = new THREE.BoxGeometry(0.52, 0.4, 0.5);
  const entradasGrupo = [];
  for (const l of lugares) {
    const x = l.x, z = l.z, R = l.radioChoque;
    // El domo de roca y las rocas de la base (sin tapar la puerta)
    L.poner(domo, colRoca, { pos: [x, 0, z], esc: [R * 0.92, l.alto * 0.64, R * 0.88], rot: [0, rnd() * 20 - 10, 0], op: opRoca });
    for (let n = 0; n < 7; n++) {
      const a = 50 + (n / 6) * 260; // de 50° a 310°: el frente (0°, hacia +z) queda libre
      L.poner(dodeca, colRoca, { pos: [x + Math.sin(a * RAD) * R * 0.92, 0.18, z + Math.cos(a * RAD) * R * 0.86], esc: [0.62, 0.42, 0.62], rot: [rnd() * 30, rnd() * 360, 0], op: opRoca });
    }
    // El arco de bloques rosas, la entrada y los escalones
    const zf = z + R * 0.86 - 0.05, ra = 0.98, ya = 1.05;
    for (let n = 0; n <= 6; n++) {
      const a = (n / 6) * 180;
      L.poner(bloque, "#f7a8d8", { pos: [x + Math.cos(a * RAD) * ra, ya + Math.sin(a * RAD) * ra, zf + 0.12], rot: [0, 0, a - 90], op: { emisivo: 0.06 } });
    }
    for (const s of [-1, 1]) for (const y of [0.25, 0.68]) L.poner(bloque, "#f7a8d8", { pos: [x + s * ra, y, zf + 0.12], rot: [0, 0, 0], esc: [1, 1.05, 1], op: { emisivo: 0.06 } });
    L.poner(new THREE.BoxGeometry(1.9, 0.14, 0.6), "#ece4f4", { pos: [x, 0.07, zf + 0.7] });
    L.poner(new THREE.BoxGeometry(1.6, 0.1, 0.45), "#ece4f4", { pos: [x, 0.05, zf + 1.2] });
    // La entrada: con luz del color del juego si está abierta; oscura y con reja de cristal si está cerrada
    const forma = new THREE.Shape();
    forma.moveTo(-ra + 0.22, 0); forma.lineTo(-ra + 0.22, ya); forma.absarc(0, ya, ra - 0.22, Math.PI, 0, true); forma.lineTo(ra - 0.22, 0); forma.lineTo(-ra + 0.22, 0);
    const gEntrada = new THREE.ShapeGeometry(forma, 10);
    const hex = l.juego ? l.juego.color || "#c86bfa" : "#8d7fb0";
    const tex = l.cerrado ? null : entrada(hex);
    const mEntrada = new THREE.Mesh(gEntrada, l.cerrado ? material("#2a1a3e") : new THREE.MeshBasicMaterial({ map: tex, color: tex ? "#ffffff" : hex }));
    mEntrada.position.set(x, 0.02, zf + 0.06);
    grupo.add(mEntrada);
    if (!l.cerrado) { entradasGrupo.push(mEntrada); halos.push({ x, y: 0.9, z: zf + 0.4, tam: 2.4, color: hex }); }
    else for (let n = -2; n <= 2; n++) L.poner(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), "#9b8fb8", { pos: [x + n * 0.27, 0.8, zf + 0.12] });
    // Cristales arriba y a los lados (como en la hoja de Petra)
    racimo(x + 0.25, l.alto * 0.6, z - 0.2, 1.1, 4, { halo: !l.cerrado, sonar: !l.cerrado });
    racimo(x - R * 0.85, 0, z + R * 0.45, 0.65, 3, { halo: false });
    racimo(x + R * 0.8, 0, z + R * 0.5, 0.6, 3, { halo: false });
    marcas.set(l.id, new THREE.Vector3(x, Math.min(l.alto + 0.3, 3.6), z + R * 0.8)); // como en Isla Noli: al frente y no muy alto
  }
  bloque.dispose();

  // Racimos sueltos por la isla (en lugares libres: lejos de caminos, puertas, salidas y rocas)
  for (let n = 0, intentos = 0; n < 10 && intentos < 300; intentos++) {
    const a = rnd() * Math.PI * 2, d = 6 + rnd() * 11, x = isla.c.x + Math.sin(a) * d, z = isla.c.z - Math.cos(a) * d;
    const ocupado = [...lugares.map((l) => ({ x: l.x, z: l.z + 1.6, r: l.radioChoque + 2.4 })), ...C.rocas.map((r) => ({ ...r, r: r.r + 1.4 })),
      ...(C.centro ? [{ ...C.centro, r: C.centro.r + 1.8 }] : []), ...C.cristales.map((k) => ({ x: k.x, z: k.z, r: 1.4 }))];
    if (ocupado.some((o) => Math.hypot(o.x - x, o.z - z) < o.r)) continue;
    if (Math.abs(x - isla.c.x) < 2.6 && z > isla.c.z) continue; // el camino de la entrada (el puente de Isla Noli)
    racimo(x, 0, z, 0.55 + rnd() * 0.35, 3, { halo: n % 3 === 0 }); n++;
  }

  L.cerrar(grupo);
  domo.dispose(); dodeca.dispose();

  // ---- La malla de todos los cristales ----
  const matCristal = materialCristal();
  const gc = K.cerrar();
  if (gc) { const mc = new THREE.Mesh(gc, matCristal); mc.name = "cristales"; mc.matrixAutoUpdate = false; grupo.add(mc); }

  // ---- Destellos y halos ----
  const puntos = [...halos.map((h) => ({ ...h, halo: true })), ...destellos.map((d) => ({ ...d, tam: 0.22 + rnd() * 0.18, color: "#fff2ff" }))];
  const matPuntos = materialPuntos();
  let sistema = null;
  if (puntos.length && !op.reducir) {
    const g = new THREE.BufferGeometry(), p = new Float32Array(puntos.length * 3), fa = new Float32Array(puntos.length), ta = new Float32Array(puntos.length), co = new Float32Array(puntos.length * 3);
    const cc = new THREE.Color();
    puntos.forEach((q, i) => { p.set([q.x, q.y, q.z], i * 3); fa[i] = rnd() * 6.28; ta[i] = q.halo ? Math.max(1.3, q.tam) : q.tam; cc.set(q.color); co.set([cc.r, cc.g, cc.b], i * 3); });
    g.setAttribute("position", new THREE.BufferAttribute(p, 3)); g.setAttribute("fase", new THREE.BufferAttribute(fa, 1));
    g.setAttribute("tam", new THREE.BufferAttribute(ta, 1)); g.setAttribute("color", new THREE.BufferAttribute(co, 3));
    sistema = new THREE.Points(g, matPuntos); sistema.name = "destellos"; sistema.frustumCulled = false;
    sistema.onBeforeRender = (renderer, scene, camara) => { matPuntos.uniforms.uEscala.value = renderer.domElement.height / (2 * Math.tan((camara.fov * RAD) / 2)); };
    grupo.add(sistema);
  }

  // ---- Efectos según la calidad y la hora ----
  let alta = false, noche = 0, aqui = false;
  function efectos(o = {}) {
    if (o.alta != null && !!o.alta !== alta) {
      alta = !!o.alta;
      if (gigante) gigante.material = alta ? matGiganteAlto : matGiganteBajo;
      if (nucleo) nucleo.visible = alta;
      for (const l of luces) l.visible = alta;
    }
    if (o.noche != null) noche = o.noche;
    if (o.aqui != null) aqui = !!o.aqui;
    // De noche brillan más; en calidad alta (con resplandor) un poco más para que irradien
    const luz = 1 + noche * 0.55 + (alta ? 0.35 : 0);
    for (const m of [matCristal, matGiganteBajo]) m.userData.u.uLuz.value = luz;
    matPuntos.uniforms.uLuz.value = 0.8 + noche * 0.7 + (alta ? 0.3 : 0);
    for (const e of entradasGrupo) e.material.color.setScalar(1 + noche * 0.4 + (alta ? 0.5 : 0));
  }
  efectos({ alta: !!op.alta });

  // ---- Campanitas: al acercarse a un racimo grande suena una nota (cada uno la suya) ----
  const dentro = new Set();
  function sonar(pos) {
    for (const s of sonoros) {
      const d = Math.hypot(pos.x - s.x, pos.z - s.z), r = s.r || 2.6;
      if (d < r && !dentro.has(s)) { dentro.add(s); campanita(s.nota); }
      else if (d > r + 0.8) dentro.delete(s);
    }
  }

  return {
    grupo, marcas,
    animar(dt, t) {
      matCristal.userData.u.uTiempo.value = t; matGiganteBajo.userData.u.uTiempo.value = t; matPuntos.uniforms.uTiempo.value = t;
      if (alta && luces.length) { const k = 0.5 + 0.5 * Math.sin(t * 1.6); luces[0].intensity = (2 + k * 1.4) * (1 + noche); luces[1].intensity = (2 + (1 - k) * 1.4) * (1 + noche); }
      if (nucleo && nucleo.visible && !op.reducir) nucleo.rotation.y += dt * 0.4;
    },
    efectos, sonar,
    liberar() {
      grupo.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      for (const m of [matCristal, matGiganteBajo, matGiganteAlto, matPuntos]) m.dispose();
      for (const e of entradasGrupo) e.material.dispose();
      if (nucleo) nucleo.material.dispose();
    },
  };
}

// ---------- Sonido ----------

let audio = null;
const NOTAS = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5]; // pentatónica de do (con su octava)
/** Una campanita suave (dos parciales que se apagan solas). Sin audio (o sin permiso todavía), no suena y no pasa nada */
function campanita(n) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audio = audio || new AC();
    if (audio.state === "suspended") audio.resume();
    const t = audio.currentTime, f = NOTAS[n % NOTAS.length];
    for (const [mult, vol] of [[1, 0.06], [2.76, 0.02]]) {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = "sine"; o.frequency.value = f * mult;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      o.connect(g).connect(audio.destination); o.start(t); o.stop(t + 1.5);
    }
  } catch { /* sin sonido */ }
}

// ---------- Estallido de destellos al tomar un cristal (sirve en cualquier isla) ----------

/** Un sistema de puntos para los estallidos (uno para todo el mundo) */
export function crearEstallidos({ reducir = false } = {}) {
  const N = 72;
  const g = new THREE.BufferGeometry(), p = new Float32Array(N * 3), vida = new Float32Array(N), vel = new Float32Array(N * 3), col = new Float32Array(N * 3);
  g.setAttribute("position", new THREE.BufferAttribute(p, 3)); g.setAttribute("vida", new THREE.BufferAttribute(vida, 1)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uEscala: { value: 600 } },
    vertexShader: `attribute float vida; attribute vec3 color; uniform float uEscala; varying float vVida; varying vec3 vColor;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vVida = vida; vColor = color;
        gl_PointSize = (0.15 + 0.35 * vida) * uEscala / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vVida; varying vec3 vColor;
      void main() { vec2 q = gl_PointCoord * 2.0 - 1.0; float d = length(q);
        float a = (max(0.0, 1.0 - abs(q.x) * 6.0) * max(0.0, 1.0 - abs(q.y)) + max(0.0, 1.0 - abs(q.y) * 6.0) * max(0.0, 1.0 - abs(q.x)) + pow(max(0.0, 1.0 - d), 2.0)) * vVida;
        if (a < 0.01 || vVida <= 0.0) discard; gl_FragColor = vec4(vColor * 1.8, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.name = "estallidos";
  pts.onBeforeRender = (renderer, scene, camara) => { mat.uniforms.uEscala.value = renderer.domElement.height / (2 * Math.tan((camara.fov * RAD) / 2)); };
  let siguiente = 0, activos = 0;
  const cc = new THREE.Color();
  return {
    puntos: pts,
    /** Estallido en (x, y, z) del color hex */
    lanzar(x, y, z, hex = "#ffd6ff") {
      if (reducir) return;
      cc.set(hex);
      for (let n = 0; n < 24; n++) {
        const i = siguiente; siguiente = (siguiente + 1) % N;
        const a = Math.random() * Math.PI * 2, u = Math.random() * 0.9 + 0.1, s = 2 + Math.random() * 2.5;
        p.set([x, y, z], i * 3); vel.set([Math.cos(a) * s * u, 2.5 + Math.random() * 3, Math.sin(a) * s * u], i * 3);
        vida[i] = 1; const k = Math.random() * 0.5; col.set([cc.r + (1 - cc.r) * k, cc.g + (1 - cc.g) * k, cc.b + (1 - cc.b) * k], i * 3);
      }
      activos = 1.2;
      g.attributes.color.needsUpdate = true;
    },
    animar(dt) {
      if (activos <= 0) return;
      activos -= dt;
      for (let i = 0; i < N; i++) {
        if (vida[i] <= 0) continue;
        vida[i] = Math.max(0, vida[i] - dt * 1.1);
        vel[i * 3 + 1] -= 9 * dt;
        p[i * 3] += vel[i * 3] * dt; p[i * 3 + 1] += vel[i * 3 + 1] * dt; p[i * 3 + 2] += vel[i * 3 + 2] * dt;
      }
      g.attributes.position.needsUpdate = true; g.attributes.vida.needsUpdate = true;
    },
  };
}
