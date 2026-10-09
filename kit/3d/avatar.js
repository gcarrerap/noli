// El personaje: un muñeco de partes (como los de Roblox, pero redondito), hecho con formas de Three.js.
// Cada parte del cuerpo es un grupo (un "ancla") que gira en su articulación; la ropa se pega a esas anclas y se
// mueve con ellas. No usa esqueleto ni archivos de modelo: ver docs/DECISIONES.md (ADR 2) y docs/ESCENA-3D.md.
//
// Medidas (metros) y anclas, con el personaje mirando hacia +z:
//   cadera (y 0.78 del piso) ─ torso (0 a 0.40) ─ cuello (0.40) ─ cabeza (0.07 sobre el cuello; esfera r 0.21 en y 0.19)
//                            ├ brazoI (x +0.205, y 0.36) ─ antebrazoI (−0.19) ─ manoI (−0.17)      I = izquierda del personaje (+x)
//                            ├ brazoD (x −0.205)  …                                                D = derecha (−x)
//                            ├ musloI (x +0.085) ─ piernaI (−0.34) ─ pieI (−0.30)
//                            └ musloD (x −0.085)  …
import * as THREE from "./vendor/three.module.min.js";
import { material } from "./materiales.js";
import { crearPieza, reflejar } from "./formas.js";
import { pintarSVG, texturaSVG, texturaImagen, texturaPixeles } from "./texturas.js";

const RAD = Math.PI / 180;

/** Medidas del cuerpo que usan la ropa y la documentación */
export const CUERPO = Object.freeze({
  cadera: 0.78, torso: 0.4, cuello: 0.07, cabezaR: 0.21, cabezaY: 0.19,
  hombroX: 0.205, hombroY: 0.36, brazo: 0.19, antebrazo: 0.17,
  piernaX: 0.085, muslo: 0.34, pierna: 0.3,
});

/**
 * Crea un personaje.
 * @param {{ piel: string, base: string, ojos?: string }} op colores de piel, de la ropa de base (malla) y de ojos
 * @returns {Avatar}
 */
export function crearAvatar(op) {
  const C = CUERPO;
  const piel = () => material(op.piel);
  const base = () => material(op.base);
  const g = (nombre, padre, x = 0, y = 0, z = 0) => { const o = new THREE.Group(); o.name = nombre; o.position.set(x, y, z); if (padre) padre.add(o); return o; };
  const malla = (geom, mat, padre, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geom, mat); m.position.set(x, y, z); padre.add(m); return m; };

  const raiz = g("raiz");
  const cuerpo = g("cuerpo", raiz);
  const a = {};
  a.cadera = g("cadera", cuerpo, 0, C.cadera, 0);
  a.torso = g("torso", a.cadera);
  a.cuello = g("cuello", a.torso, 0, C.torso, 0);
  a.cabeza = g("cabeza", a.cuello, 0, C.cuello, 0);
  for (const [lado, s] of [["I", 1], ["D", -1]]) {
    a["brazo" + lado] = g("brazo" + lado, a.torso, s * C.hombroX, C.hombroY, 0);
    a["antebrazo" + lado] = g("antebrazo" + lado, a["brazo" + lado], 0, -C.brazo, 0);
    a["mano" + lado] = g("mano" + lado, a["antebrazo" + lado], 0, -C.antebrazo, 0);
    a["muslo" + lado] = g("muslo" + lado, a.cadera, s * C.piernaX, 0, 0);
    a["pierna" + lado] = g("pierna" + lado, a["muslo" + lado], 0, -C.muslo, 0);
    a["pie" + lado] = g("pie" + lado, a["pierna" + lado], 0, -C.pierna, 0);
  }

  // ---- El cuerpo (piel) y la malla de base (para que nunca esté sin ropa) ----
  const pelvis = malla(new THREE.SphereGeometry(0.155, 20, 14), base(), a.cadera, 0, -0.02, 0); pelvis.scale.set(1, 0.62, 0.76);
  const tronco = malla(new THREE.CylinderGeometry(0.155, 0.145, C.torso, 20), base(), a.torso, 0, C.torso / 2, 0); tronco.scale.z = 0.72;
  const hombros = malla(new THREE.SphereGeometry(0.155, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), base(), a.torso, 0, C.torso, 0); hombros.scale.set(1, 0.35, 0.72);
  malla(new THREE.CylinderGeometry(0.05, 0.055, 0.09, 12), piel(), a.cuello, 0, 0.03, 0);
  malla(new THREE.SphereGeometry(C.cabezaR, 24, 16), piel(), a.cabeza, 0, C.cabezaY, 0).scale.set(1, 0.96, 0.95);
  // Cara: ojos con brillo, cachetes y sonrisa
  for (const s of [1, -1]) {
    const ojo = malla(new THREE.SphereGeometry(0.03, 10, 8), material(op.ojos || "#2b2236"), a.cabeza, s * 0.075, 0.2, 0.183); ojo.scale.set(1, 1.25, 0.5);
    malla(new THREE.SphereGeometry(0.009, 8, 6), material("#ffffff", { emisivo: 0.6 }), a.cabeza, s * 0.075 + 0.01, 0.215, 0.198);
    const cachete = malla(new THREE.CircleGeometry(0.03, 14), material("#ff8fa3", { opacidad: 0.55 }), a.cabeza, s * 0.12, 0.13, 0.172);
    cachete.rotation.y = s * 0.55;
    malla(new THREE.SphereGeometry(0.04, 12, 8), piel(), a.cabeza, s * 0.205, 0.18, 0);
  }
  const boca = malla(new THREE.TorusGeometry(0.035, 0.008, 6, 14, Math.PI), material("#c4553f"), a.cabeza, 0, 0.12, 0.192);
  boca.rotation.z = Math.PI;
  for (const lado of ["I", "D"]) {
    malla(new THREE.CapsuleGeometry(0.045, 0.15, 4, 10), piel(), a["brazo" + lado], 0, -0.095, 0);
    malla(new THREE.CapsuleGeometry(0.04, 0.13, 4, 10), piel(), a["antebrazo" + lado], 0, -0.085, 0);
    malla(new THREE.SphereGeometry(0.05, 12, 10), piel(), a["mano" + lado], 0, -0.03, 0);
    malla(new THREE.CapsuleGeometry(0.068, 0.26, 4, 12), piel(), a["muslo" + lado], 0, -0.17, 0);
    malla(new THREE.CapsuleGeometry(0.055, 0.22, 4, 12), piel(), a["pierna" + lado], 0, -0.15, 0);
    malla(new THREE.BoxGeometry(0.11, 0.09, 0.2), piel(), a["pie" + lado], 0, -0.07, 0.04);
  }

  // Sombra redonda en el piso (más barata que las sombras de verdad, y se ve bien en la TV)
  const sombra = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), new THREE.MeshBasicMaterial({ color: 0x2b2236, transparent: true, opacity: 0.18, depthWrite: false }));
  sombra.rotation.x = -Math.PI / 2; sombra.position.y = 0.006; raiz.add(sombra);

  let puestas = []; // { obj, ancla } de la ropa puesta
  const pose = { t: 0, fase: 0, actual: {} };

  /**
   * Viste al personaje (quita lo que traía y pone el atuendo).
   * @param {object} atuendo (src/atuendo.js)
   * @param {{prendas: Map, colores: Map}} idx
   * @param {(prenda) => THREE.Object3D|null} [modelo] para prendas hechas en Blender (modelos/*.glb), ya cargadas
   */
  function vestir(atuendo, idx, modelo) {
    for (const { obj, ancla } of puestas) a[ancla].remove(obj);
    puestas = [];
    const lista = [];
    for (const k of ["peinado", "arriba", "abajo", "vestido", "zapatos"]) if (atuendo[k]) lista.push(atuendo[k]);
    for (const p of Object.values(atuendo.accesorios || {})) if (p) lista.push(p);
    for (const { id, color, patron } of lista) {
      const prenda = idx.prendas.get(id);
      if (!prenda) continue;
      const colorDe = (col) => {
        if (col === "p") return (idx.colores.get(color) || idx.colores.get(prenda.colores[0])).hex;
        if (col === "s") { const s = prenda.secundario || "#ffffff"; return s[0] === "#" ? s : idx.colores.get(s).hex; }
        if (col === "piel") return op.piel;
        return col[0] === "#" ? col : idx.colores.get(col).hex;
      };
      if (prenda.modelo) {
        const obj = modelo ? modelo(prenda, colorDe) : null;
        if (obj) { const an = prenda.ancla || "cabeza"; a[an].add(obj); puestas.push({ obj, ancla: an }); }
        continue;
      }
      const extras = texturasDe(prenda, patron, colorDe, idx);
      for (const pz of prenda.piezas) {
        for (const q of pz.espejo ? [pz, reflejar(pz)] : [pz]) {
          const obj = crearPieza(q, colorDe, prenda, extras);
          a[q.a].add(obj);
          puestas.push({ obj, ancla: q.a });
        }
      }
    }
  }

  // Las mallas de piel (para cambiar el tono sin rehacer el cuerpo)
  const mallasPiel = [];
  raiz.traverse((o) => { if (o.isMesh && o.material === material(op.piel)) mallasPiel.push(o); });
  /** Cambia el tono de piel */
  function ponerPiel(hex) {
    op.piel = hex;
    const m = material(hex);
    for (const o of mallasPiel) o.material = m;
  }

  /**
   * Mueve las articulaciones. Cada modo tiene una postura (o un ciclo); la postura actual se acerca poco a poco a la
   * nueva, así los cambios se ven suaves (no saltan).
   * @param {string} modo "quieto", "caminar", "desfilar", una pose de POSES_3D (la Pasarela) o "brinco" (en el aire, en el
   *   mundo del menú principal)
   * @param {number} dt segundos desde el cuadro anterior
   * @param {number} [velocidad] 0 a 1 (qué tan rápido camina), para el ciclo de pasos
   */
  function animar(modo, dt, velocidad = 1) {
    pose.t += dt;
    const camina = modo === "caminar" || modo === "desfilar";
    if (camina) pose.fase += dt * (modo === "desfilar" ? 7 : 9) * Math.max(0.4, velocidad);
    const f = pose.fase, t = pose.t;
    const obj = posturas(modo, f, t);
    const k = 1 - Math.pow(0.0005, dt); // suavizado independiente de los cuadros por segundo
    for (const [clave, valor] of Object.entries(obj)) {
      const [parte, eje] = clave.split(".");
      const destino = parte === "cuerpo" ? cuerpo : a[parte];
      const prop = parte === "cuerpo" ? "position" : "rotation"; // "cuerpo" se mueve (salta, se mece); lo demás gira
      const actual = destino[prop][eje];
      const directo = camina ? clave in CICLO : BAILES.has(modo); // ciclos y bailes, sin suavizar (si no, pierden ritmo)
      destino[prop][eje] = directo ? valor : actual + (valor - actual) * k;
    }
    // Respira
    a.torso.scale.y = 1 + Math.sin(t * 2.2) * 0.012;
  }

  return { raiz, anclas: a, sombra, vestir, ponerPiel, animar, CUERPO };
}

/**
 * Poses y bailes de la pasarela que sabe hacer el personaje (los mismos ids que datos/poses.json; lo revisa la prueba).
 * "vuelta" además gira todo el personaje: eso lo hace la vista (src/ui/vista3d.js).
 */
export const POSES_3D = ["cintura", "saludo", "estrella", "vuelta", "corazon", "baile-brazos", "baile-lado", "reverencia",
  "baile-salto", "beso", "robot", "pensar"];
// Bailes: se mueven con ritmo, así que su postura se pone directo en cada cuadro
const BAILES = new Set(["baile-brazos", "baile-lado", "baile-salto", "robot"]);

/**
 * Las texturas de una prenda puesta: su patrón (si escogió uno) y sus estampados. idx.patrones / idx.estampados traen
 * el SVG (o la url de un PNG, o los pixeles de un dibujo) de cada uno; ver kit/3d/texturas.js.
 * @returns {{ patron: object|null, baldosa: number, estampado: (id: string) => object|null }}
 */
function texturasDe(prenda, patronId, colorDe, idx) {
  const col = { p: colorDe("p"), s: colorDe("s") };
  const pat = patronId && idx.patrones && idx.patrones.get(patronId);
  return {
    patron: pat && pat.svg ? texturaSVG(pintarSVG(pat.svg, col), { repetir: true, tam: 128, fondo: col.p }) : null,
    baldosa: 0.12 * ((pat && pat.escala) || 1),
    estampado: (eid) => {
      const e = idx.estampados && idx.estampados.get(eid);
      if (!e) return null;
      if (e.svg) return texturaSVG(pintarSVG(e.svg, col));
      if (e.url) return texturaImagen(e.url);
      if (e.pixeles) return texturaPixeles(e.id + "|" + e.pixeles.clave, e.pixeles.lado, e.pixeles.colores);
      return null;
    },
  };
}

// Articulaciones que en el ciclo de caminar se ponen directo (sin suavizar), para que el paso no se vea "lento"
const CICLO = { "musloI.x": 1, "musloD.x": 1, "piernaI.x": 1, "piernaD.x": 1, "brazoI.x": 1, "brazoD.x": 1, "cuerpo.y": 1 };

/** Postura de cada modo: { "parte.eje": radianes } (cuerpo.y es altura). f = fase del paso, t = tiempo. */
function posturas(modo, f, t) {
  const s = Math.sin(f), c = Math.cos(f);
  const quieto = {
    "brazoI.x": 0, "brazoD.x": 0, "brazoI.z": 0.12, "brazoD.z": -0.12, "antebrazoI.x": -0.1, "antebrazoD.x": -0.1,
    "antebrazoI.z": 0, "antebrazoD.z": 0, "musloI.x": 0, "musloD.x": 0, "musloI.z": 0, "musloD.z": 0, "piernaI.x": 0, "piernaD.x": 0,
    "cadera.z": 0, "torso.y": 0, "torso.x": 0, "cabeza.x": 0, "cabeza.y": 0, "cabeza.z": Math.sin(t * 0.9) * 0.03, "cuerpo.y": 0, "cuerpo.x": 0,
    "brazoI.y": 0, "brazoD.y": 0,
  };
  const b = Math.sin(t * 6), rb = Math.abs(b); // ritmo de los bailes (≈ 1 tiempo por segundo)
  switch (modo) {
    case "caminar": return { ...quieto,
      "musloI.x": s * 0.55, "musloD.x": -s * 0.55, "piernaI.x": Math.max(0, -c) * 0.7, "piernaD.x": Math.max(0, c) * 0.7,
      "brazoI.x": -s * 0.45, "brazoD.x": s * 0.45, "cuerpo.y": Math.abs(c) * 0.035, "cabeza.z": 0 };
    case "desfilar": return { ...quieto,
      "musloI.x": s * 0.42, "musloD.x": -s * 0.42, "piernaI.x": Math.max(0, -c) * 0.55, "piernaD.x": Math.max(0, c) * 0.55,
      "brazoI.x": -s * 0.25, "brazoD.x": s * 0.25, "cadera.z": s * 0.07, "torso.y": s * 0.12, "cuerpo.y": Math.abs(c) * 0.025,
      "cabeza.x": -0.05, "cabeza.z": 0 };
    case "cintura": return { ...quieto, "brazoI.z": 0.75, "antebrazoI.z": -1.9, "brazoD.z": -0.75, "antebrazoD.z": 1.9,
      "cadera.z": 0.06, "cabeza.z": -0.12, "musloI.z": 0.05 };
    case "saludo": return { ...quieto, "brazoD.z": -2.5, "antebrazoD.z": -0.3 + Math.sin(t * 9) * 0.45, "cabeza.z": 0.1, "brazoI.z": 0.2 };
    case "estrella": return { ...quieto, "brazoI.z": 2.4, "brazoD.z": -2.4, "musloI.z": 0.22, "musloD.z": -0.22, "cabeza.x": -0.12 };
    case "vuelta": return { ...quieto, "brazoI.z": 1.2, "brazoD.z": -1.2 };
    // ---- Poses y bailes de la pasarela (datos/poses.json) ----
    // Corazón con las manos frente al pecho (los brazos son cortos para llegar arriba de la cabeza)
    case "corazon": return { ...quieto, "brazoI.x": -1.0, "brazoD.x": -1.0, "brazoI.z": 0.35, "brazoD.z": -0.35, "antebrazoI.z": -1.6, "antebrazoD.z": 1.6,
      "antebrazoI.x": -0.5, "antebrazoD.x": -0.5, "cabeza.z": 0.12 };
    case "baile-brazos": return { ...quieto, "brazoI.z": 1.3 + b * 1.1, "brazoD.z": -1.3 + b * 1.1, "antebrazoI.z": 0.4, "antebrazoD.z": -0.4,
      "cuerpo.y": rb * 0.03, "cabeza.z": b * 0.12, "cadera.z": b * 0.05 };
    case "baile-lado": return { ...quieto, "cuerpo.x": Math.sin(t * 3) * 0.12, "cadera.z": Math.sin(t * 3) * 0.12, "torso.y": Math.sin(t * 3) * 0.2,
      "brazoI.z": 0.8 + Math.sin(t * 3) * 0.5, "brazoD.z": -0.8 + Math.sin(t * 3) * 0.5, "antebrazoI.z": 0.9, "antebrazoD.z": -0.9,
      "musloI.z": Math.max(0, Math.sin(t * 3)) * 0.15, "musloD.z": Math.min(0, Math.sin(t * 3)) * 0.15, "cabeza.z": -Math.sin(t * 3) * 0.1 };
    case "reverencia": return { ...quieto, "torso.x": 0.45, "cabeza.x": 0.2, "brazoI.z": 0.55, "brazoD.z": -0.55, "brazoI.x": -0.3, "brazoD.x": -0.3,
      "piernaD.x": 0.6, "musloD.x": -0.15, "cuerpo.y": -0.05 };
    case "baile-salto": return { ...quieto, "cuerpo.y": Math.abs(Math.sin(t * 5)) * 0.18, "brazoI.z": 2.5 - Math.abs(Math.sin(t * 5)) * 0.7,
      "brazoD.z": -2.5 + Math.abs(Math.sin(t * 5)) * 0.7, "musloI.x": -Math.abs(Math.cos(t * 5)) * 0.3, "musloD.x": -Math.abs(Math.cos(t * 5)) * 0.3,
      "piernaI.x": Math.abs(Math.cos(t * 5)) * 0.55, "piernaD.x": Math.abs(Math.cos(t * 5)) * 0.55 };
    case "beso": { const k = Math.max(0, Math.sin(t * 2.4)); return { ...quieto, "brazoD.x": -1.25 - k * 0.3, "antebrazoD.x": -1.5 + k * 1.2, "brazoD.z": -0.15,
      "cabeza.z": 0.08, "cabeza.x": -0.05 }; }
    case "robot": { const k = Math.floor(t * 2.5) % 2; return { ...quieto, "brazoI.x": k ? -1.57 : 0, "antebrazoI.x": k ? 0 : -1.57, "brazoD.x": k ? 0 : -1.57,
      "antebrazoD.x": k ? -1.57 : 0, "torso.y": k ? 0.3 : -0.3, "cabeza.y": k ? -0.3 : 0.3, "brazoI.z": 0.15, "brazoD.z": -0.15 }; }
    case "pensar": return { ...quieto, "brazoD.x": -0.7, "brazoD.z": -0.15, "antebrazoD.x": -2.3, "antebrazoD.z": 0.35, "brazoI.x": -0.35,
      "antebrazoI.x": -1.35, "antebrazoI.z": -0.5, "cabeza.z": 0.15, "cabeza.x": 0.1 };
    // En el aire: brazos arriba, rodillas dobladas hacia el frente (el cuerpo lo sube la física, no la postura)
    case "brinco": return { ...quieto, "brazoI.z": 2.2, "brazoD.z": -2.2, "antebrazoI.z": 0.3, "antebrazoD.z": -0.3,
      "musloI.x": -0.75, "musloD.x": -0.35, "piernaI.x": 1.1, "piernaD.x": 0.6, "cabeza.x": -0.1, "cabeza.z": 0 };
    default: return quieto;
  }
}
