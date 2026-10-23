// Las islas en 3D (#164): el mar, el suelo de cada isla (por ahora solo el suelo, con su orilla y un poquito de
// decoración barata de su tema), los puentes y caminos de plataformas construidos, los muelles de lo que falta
// construir y el teletransportador de cada isla. Todo sale de mundo/islas.json ya armado (engine/islas.js); aquí solo
// se dibuja. Isla Noli (el claro de siempre) la dibuja escena-mundo.js; aquí solo su teletransportador.
//
// Rendimiento (TV): cada isla es un grupo aparte y solo se arman la isla donde está el personaje y sus vecinas; las
// demás se liberan (`enfocar`). Así, cuando las islas tengan construcciones, la memoria no crece con el número de islas.
import * as THREE from "../../kit/3d/vendor/three.module.min.js";
import { material } from "../../kit/3d/materiales.js";
import { crearLote } from "../../kit/3d/lote.js";
import { azar } from "../engine/mundo.js";
import { vecinas, teletransportadorDe, posPlataforma, ANCHO_PUENTE, ENTRA, MUELLE, INICIO } from "../engine/islas.js";

const RAD = Math.PI / 180;
const MATERIAL = {
  cristal: { suelo: "#a8ecff", baranda: "#d9f7ff", op: { brillo: true, emisivo: 0.25 } },
  madera: { suelo: "#c9925f", baranda: "#a7744a", op: {} },
  piedra: { suelo: "#cbbfe0", baranda: "#9fdc8a", op: {} },
  hoja: { suelo: "#5ccf8a", baranda: "#ffb3d1", op: {} },
  nube: { suelo: "#ffffff", baranda: "#efeaff", op: { emisivo: 0.08 } },
};
const matDe = (m) => MATERIAL[m] || MATERIAL.madera;

// Decoración chiquita (no estorba: es muy bajita y no choca) según el tema de cada isla
const DECO = {
  cristal: (L, x, z, r) => L.poner(new THREE.OctahedronGeometry(0.22), r() < 0.5 ? "#ff9fd8" : "#c3a6ff", { pos: [x, 0.2, z], esc: [1, 1.6, 1], rot: [0, r() * 90, 0], op: { brillo: true, emisivo: 0.35 } }),
  dulce: (L, x, z, r) => L.poner(new THREE.SphereGeometry(0.18, 8, 6), ["#ff7eb6", "#ffd166", "#8fe0c0"][Math.floor(r() * 3)], { pos: [x, 0.12, z], esc: [1, 0.7, 1] }),
  bosque: (L, x, z, r) => { L.poner(new THREE.CylinderGeometry(0.06, 0.08, 0.22, 6), "#fff4e4", { pos: [x, 0.11, z] }); L.poner(new THREE.SphereGeometry(0.18, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), r() < 0.5 ? "#ff6b8b" : "#c86bfa", { pos: [x, 0.2, z] }); },
  pasarela: (L, x, z, r) => L.poner(new THREE.CircleGeometry(0.3, 5), r() < 0.5 ? "#ffb3d1" : "#ffd166", { pos: [x, 0.02, z], rot: [-90, r() * 70, 0], op: { emisivo: 0.2 } }),
  nieve: (L, x, z) => L.poner(new THREE.SphereGeometry(0.35, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), "#ffffff", { pos: [x, 0, z], esc: [1, 0.45, 1] }),
  sirena: (L, x, z, r) => L.poner(new THREE.ConeGeometry(0.16, 0.22, 7), r() < 0.5 ? "#ffb59a" : "#ffd8e8", { pos: [x, 0.08, z], rot: [80, r() * 360, 0] }),
  volcan: (L, x, z, r) => L.poner(new THREE.DodecahedronGeometry(0.22), "#8f6a5a", { pos: [x, 0.08, z], esc: [1, 0.55, 1], rot: [0, r() * 90, 0] }),
  numeros: (L, x, z, r) => L.poner(new THREE.BoxGeometry(0.5, 0.04, 0.5), ["#ff7eb6", "#4cb3ff", "#3ccf8e", "#ffc43d"][Math.floor(r() * 4)], { pos: [x, 0.02, z], rot: [0, r() * 90, 0] }),
  nubes: (L, x, z, r) => L.poner(new THREE.SphereGeometry(0.3, 8, 6), "#f4efff", { pos: [x, 0.1, z], esc: [1.3, 0.5, 1], rot: [0, r() * 90, 0] }),
};

/**
 * @param {object} red armarIslas(...)
 * @param {object} cfg mundo/islas.json (mar, colores)
 * @param {{ reducir?: boolean }} op
 */
export function crearIslas(red, cfg, op = {}) {
  const grupo = new THREE.Group(); grupo.name = "islas";
  const mar = cfg.mar || {};
  const animados = [];

  // ---- El mar: un plano grande debajo de todo (la niebla lo funde con el cielo a lo lejos) ----
  {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const i of red.islas) {
      const f = i.f, r = f.tipo === "caja" ? 0 : f.r;
      x0 = Math.min(x0, (f.tipo === "caja" ? f.x0 : f.x) - r); x1 = Math.max(x1, (f.tipo === "caja" ? f.x1 : f.x) + r);
      z0 = Math.min(z0, (f.tipo === "caja" ? f.z0 : f.z) - r); z1 = Math.max(z1, (f.tipo === "caja" ? f.z1 : f.z) + r);
    }
    const m = 140, w = x1 - x0 + 2 * m, d = z1 - z0 + 2 * m;
    const agua = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material(mar.color || "#7cc8ee"));
    agua.rotation.x = -Math.PI / 2; agua.position.set((x0 + x1) / 2, mar.nivel ?? -0.35, (z0 + z1) / 2); agua.name = "mar";
    grupo.add(agua);
  }

  // ---- Cada isla (menos Noli): su grupo, armado solo cuando hace falta ----
  const grupos = new Map(); // id → THREE.Group
  function armarIsla(i) {
    const g = new THREE.Group(); g.name = "isla:" + i.id;
    const L = crearLote(), f = i.f, C = i.colores || {};
    const borde = (cfg.mar && cfg.mar.orilla) || 1.6;
    // Arena (u orilla del tema) en el borde, el suelo adentro, y un cuerpo debajo que baja hasta el agua
    L.poner(new THREE.CylinderGeometry(f.r, f.r * 0.86, 3, 48), C.orilla || "#e9d9b4", { pos: [f.x, -1.5, f.z] });
    L.poner(new THREE.CylinderGeometry(f.r - borde, f.r - borde, 0.02, 48), C.suelo || "#bfe6a4", { pos: [f.x, 0.005, f.z] });
    // Decoración barata: lejos del centro (ahí van las construcciones y el teletransportador) y de donde llegan los puentes
    const r = azar(i.id.split("").reduce((s, c) => s * 31 + c.charCodeAt(0), 7));
    const llegadas = red.conexiones.filter((k) => k.de === i.id || k.a === i.id).map((k) => (k.de === i.id ? k.p0 : k.p1));
    const poner = DECO[i.id] || DECO.nubes;
    for (let n = 0, intentos = 0; n < 26 && intentos < 400; intentos++) {
      const a = r() * Math.PI * 2, d = f.r * (0.55 + r() * 0.3);
      const x = f.x + Math.cos(a) * d, z = f.z + Math.sin(a) * d;
      if (llegadas.some((p) => Math.hypot(p.x - x, p.z - z) < 5)) continue;
      poner(L, x, z, r); n++;
    }
    teletransportador(L, g, teletransportadorDe(i), i.id);
    L.cerrar(g);
    grupo.add(g);
    return g;
  }
  function liberarIsla(id) {
    const g = grupos.get(id);
    if (!g) return;
    g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); // los materiales son compartidos (materiales.js)
    grupo.remove(g); grupos.delete(id);
    for (let n = animados.length - 1; n >= 0; n--) if (animados[n].isla === id) animados.splice(n, 1);
  }
  // El teletransportador: un círculo de piedras mágicas con un disco que brilla
  function teletransportador(L, g, t, isla) {
    L.poner(new THREE.CircleGeometry(1.25, 32), "#d9c8ff", { pos: [t.x, 0.02, t.z], rot: [-90, 0, 0], op: { emisivo: 0.3 } });
    for (let n = 0; n < 8; n++) {
      const a = n * 45 * RAD;
      L.poner(new THREE.DodecahedronGeometry(0.22), n % 2 ? "#b9a8ff" : "#ffd166", { pos: [t.x + Math.cos(a) * 1.45, 0.12, t.z + Math.sin(a) * 1.45], esc: [1, 0.7, 1], op: { emisivo: 0.35 } });
    }
    const brillo = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.6, 24, 1, true), material("#c9a6ff", { opacidad: 0.18, emisivo: 1, dobleCara: true }));
    brillo.position.set(t.x, 0.8, t.z);
    g.add(brillo);
    if (!op.reducir) animados.push({ isla, animar(dt, tt) { brillo.scale.set(1, 0.85 + Math.sin(tt * 2.2) * 0.15, 1); brillo.rotation.y += dt * 0.6; } });
  }
  // El de Isla Noli (Noli la dibuja escena-mundo.js, pero el teletransportador es de aquí)
  {
    const g = new THREE.Group(), L = crearLote();
    teletransportador(L, g, teletransportadorDe(red.por.get(INICIO)));
    L.cerrar(g); grupo.add(g);
  }

  /** Arma la isla donde está y sus vecinas; libera las demás */
  function enfocar(id) {
    const quiere = new Set([id, ...vecinas(red, id)]);
    for (const i of red.islas) {
      if (i.id === INICIO) continue;
      if (quiere.has(i.id) && !grupos.has(i.id)) grupos.set(i.id, armarIsla(i));
      else if (!quiere.has(i.id) && grupos.has(i.id)) liberarIsla(i.id);
    }
  }

  // ---- Conexiones: puentes, caminos de plataformas y muelles ----
  const conGrupo = new THREE.Group(); conGrupo.name = "conexiones"; grupo.add(conGrupo);
  let movibles = [];   // { p, malla } plataformas que se mueven
  let creciendo = [];  // animación al construir: { obj, t, dur, eje }

  /** Un tramo de puente en coordenadas locales: z de 0 a `largo` hacia adelante, x a los lados */
  function tramo(L, largo, mat, { punta = false, magico = false } = {}) {
    const M = matDe(mat), o = magico ? { opacidad: 0.55, emisivo: 0.7 } : M.op;
    const w = ANCHO_PUENTE;
    for (let z = 0.3; z < largo; z += 0.62) L.poner(new THREE.BoxGeometry(w + 0.2, 0.14, 0.52), M.suelo, { pos: [0, -0.05, z], op: o });
    const lado = w / 2 + 0.12;
    for (const s of [-1, 1]) {
      for (let z = 0; z <= largo + 0.01; z += Math.max(1.2, largo / Math.ceil(largo / 1.6))) L.poner(new THREE.CylinderGeometry(0.07, 0.08, 1.05, 6), M.baranda, { pos: [s * lado, 0.5, z], op: o });
      L.poner(new THREE.BoxGeometry(0.12, 0.1, largo), M.baranda, { pos: [s * lado, 1.05, largo / 2], op: o });
    }
    if (punta) {
      L.poner(new THREE.BoxGeometry(w + 0.36, 0.1, 0.12), M.baranda, { pos: [0, 1.05, largo], op: o });
      L.poner(new THREE.BoxGeometry(w + 0.36, 0.1, 0.12), M.baranda, { pos: [0, 0.55, largo], op: o });
    }
  }

  /** Grupo colocado en `p`, mirando hacia `dir` (su +z local apunta a dir) */
  function colocado(p, dir) {
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z);
    g.rotation.y = Math.atan2(dir.x, dir.z);
    return g;
  }

  /** Un letrero en la punta del muelle: un poste con el material que hace falta (cristal, madera…) */
  function poste(L, mat, largo) {
    L.poner(new THREE.CylinderGeometry(0.08, 0.1, 1.9, 6), "#a7744a", { pos: [ANCHO_PUENTE / 2 - 0.25, 0.95, largo - 0.4] });
    L.poner(new THREE.BoxGeometry(0.9, 0.55, 0.08), "#fff4dc", { pos: [ANCHO_PUENTE / 2 - 0.25, 1.75, largo - 0.4] });
    const m = matDe(mat);
    L.poner(mat === "cristal" ? new THREE.OctahedronGeometry(0.2) : new THREE.BoxGeometry(0.34, 0.12, 0.08), m.suelo,
      { pos: [ANCHO_PUENTE / 2 - 0.25, 1.75, largo - 0.45], esc: mat === "cristal" ? [1, 1.4, 0.5] : 1, op: { emisivo: 0.4, brillo: mat === "cristal" } });
  }

  /**
   * Vuelve a armar las conexiones: las construidas (todas, con `magicas` en el modo secreto) y los muelles.
   * @param {{ hechas: Set<string>, muelles: object[] }} estado estadoRed(...)
   * @param {string} [nueva] la que se acaba de construir (sale con animación)
   */
  function dibujarConexiones(estado, nueva, magicas = new Set()) {
    conGrupo.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    conGrupo.clear();
    movibles = []; creciendo = [];
    for (const k of red.conexiones) {
      if (!estado.hechas.has(k.id)) continue;
      const magico = magicas.has(k.id);
      if (k.tipo === "puente") {
        const g = colocado({ x: k.p0.x - k.dir.x * ENTRA, z: k.p0.z - k.dir.z * ENTRA }, k.dir), L = crearLote();
        tramo(L, k.largo + 2 * ENTRA, k.material, { magico });
        L.cerrar(g); conGrupo.add(g);
        if (k.id === nueva && !op.reducir) { g.scale.z = 0.001; creciendo.push({ obj: g, t: 0, dur: 1.6, eje: "z" }); }
      } else {
        k.plataformas.forEach((p, n) => {
          const M = matDe(p.material), o = magico ? { opacidad: 0.55, emisivo: 0.7 } : M.op;
          const pieza = (lote) => {
            lote.poner(new THREE.CylinderGeometry(p.r, p.r * 0.82, p.grosor, 18), M.suelo, { pos: [0, -p.grosor / 2, 0], op: o });
            lote.poner(new THREE.CylinderGeometry(p.r * 0.92, p.r * 0.92, 0.04, 18), M.baranda, { pos: [0, 0.005, 0], op: o });
            lote.poner(new THREE.OctahedronGeometry(0.12), "#e8c4ff", { pos: [0, -p.grosor - 0.25, 0], op: { emisivo: 0.9 } });
          };
          const g = new THREE.Group(); g.position.set(p.x, p.alto, p.z);
          const Lp = crearLote(); pieza(Lp); Lp.cerrar(g);
          if (p.mueve) movibles.push({ p, malla: g });
          conGrupo.add(g);
          if (k.id === nueva && !op.reducir) { g.scale.setScalar(0.001); creciendo.push({ obj: g, t: -n * 0.12, dur: 0.45, eje: "todo" }); }
        });
      }
    }
    for (const m of estado.muelles) {
      const k = red.porCon.get(m.id);
      const g = colocado({ x: m.punto.x - m.dir.x * ENTRA, z: m.punto.z - m.dir.z * ENTRA }, m.dir), L = crearLote();
      tramo(L, MUELLE + ENTRA, "madera", { punta: true });
      poste(L, k.material, MUELLE + ENTRA);
      L.cerrar(g); conGrupo.add(g);
    }
  }

  return {
    grupo,
    enfocar,
    dibujarConexiones,
    /** Mueve las plataformas que se mueven al tiempo t (las mallas; la física la mueve la vista con posPlataforma) */
    moverPlataformas(t) { for (const m of movibles) { const q = posPlataforma(m.p, t); m.malla.position.x = q.x; m.malla.position.z = q.z; } },
    animar(dt, t) {
      for (const a of animados) a.animar(dt, t);
      for (const c of creciendo) {
        c.t += dt;
        const k = Math.max(0.001, Math.min(1, c.t / c.dur)), e = 1 - Math.pow(1 - k, 3);
        if (c.eje === "z") c.obj.scale.z = Math.max(0.001, e); else c.obj.scale.setScalar(Math.max(0.001, e));
      }
      creciendo = creciendo.filter((c) => c.t < c.dur);
    },
    /** ¿Qué islas están armadas? (para diagnosticar y para las pruebas en el navegador) */
    get armadas() { return [...grupos.keys()]; },
  };
}
