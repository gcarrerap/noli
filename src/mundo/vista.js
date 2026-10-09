// La vista del mundo (#25): une la escena (kit/3d/escena.js), el mundo (escena-mundo.js), el personaje
// (kit/3d/avatar.js), la física con brincos (kit/3d/fisica.js) y la cámara. La pantalla (src/ui/screens/mundo.js)
// solo le dice "camina hacia aquí", "brinca" o "ve a tal juego", y le pregunta en qué puerta está.
// Este módulo baja Three.js: se carga con import() solo cuando se va a usar el mundo (el menú 2D no lo necesita).
import * as THREE from "../../kit/3d/vendor/three.module.min.js";
import { crearEscena } from "../../kit/3d/escena.js";
import { crearAvatar } from "../../kit/3d/avatar.js";
import { pasoFisico, crearCuerpo, alturaBajo } from "../../kit/3d/fisica.js";
import { seguirRuta } from "../../kit/3d/movimiento.js";
import { crearMundo } from "./escena-mundo.js";
import { lugarCercano, cristalTocado, rutaPorCaminos, puntoLibre, brazoCamara } from "../engine/mundo.js";

/**
 * @param {HTMLElement} cont
 * @param {object} m todo lo del mundo ya armado: { mundo, lugares, deco, mapa, caminos, cfg, cristales }
 * @param {{ tv: boolean, reducir: boolean, tiene: Set<string>, desde?: string, piel?: string, base?: string,
 *   alLugar: (l|null) => void, alCristal: (c) => void, alBajarMucho?: () => void }} op
 *   tiene: cristales que ya encontró; desde: id del juego de cuya puerta sale (al regresar de un juego)
 */
export function crearVistaMundo(cont, m, op) {
  const { mundo, lugares, deco, mapa, caminos, cfg, cristales } = m;
  const esc = crearEscena(cont, { tv: op.tv, alBajarMucho: op.alBajarMucho, fondo: mundo.cielo || "#eee3ff", niebla: mundo.niebla || [22, 52], lejos: 58 });
  const mun = crearMundo(mundo, lugares, deco, cristales, { reducir: op.reducir });
  esc.scene.add(mun.grupo);
  for (const id of op.tiene) mun.quitarCristal(id, false);

  const av = crearAvatar({ piel: op.piel || "#ffd9c0", base: op.base || "#cbbfe6" });
  esc.scene.add(av.raiz);
  // La sombra se queda en el piso (o en la plataforma) aunque el personaje brinque: así se ve dónde va a caer
  av.raiz.remove(av.sombra);
  esc.scene.add(av.sombra);

  // ---- Dónde empieza: en la plaza, o frente a la puerta del juego del que regresa ----
  let c = crearCuerpo(mundo.inicio.x, mundo.inicio.z, 0);
  const salirDe = (id) => {
    const l = lugares.find((x) => x.id === id);
    if (l) c = crearCuerpo(l.punto.x, l.punto.z, l.mira + 180); // de espaldas al edificio, viendo a la plaza
  };
  if (op.desde) salirDe(op.desde);

  let quiere = { x: 0, z: 0 }, brincar = false, ruta = [], alLlegar = null, cerca = null, animacion = "quieto";
  let atorado = { t: 0, d: Infinity };

  // ---- Cámara: atrás y arriba, siempre con la misma orientación (no marea); sube y baja suave con el personaje ----
  const cam = { p: new THREE.Vector3(), m: new THREE.Vector3() }, obj = { p: new THREE.Vector3(), m: new THREE.Vector3() };
  let saltar = true, camY = 0, brazo = 1;
  const altos = mapa.solidos.filter((s) => s.tipo === "cilindro" && String(s.id).startsWith("edificio:"));
  function camaraObjetivo(dt) {
    const ancho = cont.clientWidth > cont.clientHeight * 1.15;
    // Pantalla ancha (TV, tableta acostada) o teléfono parado (más arriba y más atrás, para ver lo de los lados).
    // Mira adelante del personaje y no muy hacia abajo: así se ven los edificios lejanos y sus letreros.
    const alto = ancho ? 4.2 : 5.6, atras = ancho ? 7.2 : 8.8;
    // La altura de la cámara sigue a los pies con retraso (al brincar no rebota; al subir a una plataforma, sí sube)
    const suelo = c.enSuelo ? c.y : Math.min(camY, c.y);
    camY = saltar ? c.y : camY + (suelo - camY) * (1 - Math.pow(0.05, dt));
    obj.m.set(c.x, camY + 1.3, c.z - (ancho ? 3.2 : 3.8));
    // Si un edificio queda entre la cámara y el personaje, la cámara se acerca (los árboles se encogen: despejar)
    const ojo = { x: c.x, y: camY + 1.2, z: c.z };
    const k = brazoCamara(ojo, { x: c.x, y: camY + alto, z: c.z + atras }, altos);
    brazo = saltar || k < brazo ? k : brazo + (k - brazo) * (1 - Math.pow(0.1, dt)); // se acerca rápido, se aleja suave
    obj.p.set(c.x, camY + 1.2 + (alto - 1.2) * brazo, c.z + atras * brazo);
  }

  const reloj = { t: 0 };
  esc.cadaCuadro((dt) => {
    reloj.t += dt;
    // ---- Moverse ----
    let q = quiere;
    if (ruta.length) {
      const r = seguirRuta(c, ruta); ruta = r.ruta; q = r.quiere;
      // Si no avanza (algo estorba), aparece por magia en la puerta (nunca se queda atorada en la TV)
      const d = ruta.length ? Math.hypot(ruta[0].x - c.x, ruta[0].z - c.z) + ruta.length * 1000 : 0; // al punto que sigue
      if (d < atorado.d - 0.15) atorado = { t: 0, d }; else atorado.t += dt;
      if (atorado.t > 1.4 && ruta.length) { const fin = ruta[ruta.length - 1]; c = crearCuerpo(fin.x, fin.z, c.ang); ruta = []; }
      if (!ruta.length && alLlegar) { const f = alLlegar; alLlegar = null; f(); }
    }
    const r = pasoFisico(c, { quiere: q, brincar }, dt, cfg, mapa);
    brincar = false;
    c = r.c;
    if (c.y < -5 || !isFinite(c.x + c.z + c.y)) c = crearCuerpo(mundo.inicio.x, mundo.inicio.z, 0); // por si acaso
    animacion = !c.enSuelo ? "brinco" : r.caminando ? "caminar" : "quieto";

    av.raiz.position.set(c.x, c.y, c.z);
    av.raiz.rotation.y = (c.ang + 180) * Math.PI / 180;
    av.animar(animacion, dt, Math.min(1, Math.hypot(q.x, q.z)));
    const h = alturaBajo(c.x, c.z, c.y + 0.01, mapa, cfg);
    av.sombra.position.set(c.x, h + 0.02, c.z);
    av.sombra.scale.setScalar(Math.max(0.45, 1 - (c.y - h) * 0.22));

    // ---- Puertas y cristales ----
    const l = lugarCercano(c, lugares);
    if ((l && l.id) !== (cerca && cerca.id)) { cerca = l; op.alLugar(l); }
    const cr = cristalTocado(c, cristales, op.tiene);
    if (cr) { op.tiene.add(cr.id); mun.quitarCristal(cr.id); op.alCristal(cr); }

    mun.animar(dt, reloj.t);

    // ---- Cámara ----
    camaraObjetivo(dt);
    const k = saltar ? 1 : 1 - Math.pow(0.02, dt);
    cam.p.lerp(obj.p, k); cam.m.lerp(obj.m, k);
    saltar = false;
    esc.camara.position.copy(cam.p);
    esc.camara.lookAt(cam.m);
    mun.despejar({ x: cam.p.x, z: cam.p.z }, c, dt, k === 1);
  });

  const caminarA = (destino, alFin) => {
    const r = rutaPorCaminos(caminos, c, destino);
    ruta = r || [destino];
    atorado = { t: 0, d: Infinity };
    alLlegar = alFin || null;
  };

  return {
    /** Dirección del joystick o de las flechas (en pantalla: x derecha, z abajo); cancela "Ir a…" */
    mover(dir) { quiere = dir; if (Math.hypot(dir.x, dir.z) > 0.1) { ruta = []; alLlegar = null; } },
    /** Brincar (una vez) */
    brincar() { brincar = true; ruta = []; alLlegar = null; },
    /** Camina sola hasta la puerta de un juego; la promesa se cumple al llegar */
    irA(id) {
      const l = lugares.find((x) => x.id === id);
      if (!l) return Promise.resolve();
      return new Promise((res) => caminarA(l.punto, () => { c = Object.assign({}, c, { ang: l.mira }); res(); }));
    },
    /** Camina sola hasta un punto del piso tocado */
    irAPunto(x, z) { if (puntoLibre({ x, z }, mapa, cfg)) caminarA({ x, z }); },
    /** Punto del piso bajo un toque en la pantalla (o null) */
    alPiso: (px, py) => esc.alPiso(px, py),
    /** Posición en pantalla del letrero de cada juego, con su distancia a la cámara: Map(id → {x, y, d}) */
    letreros() {
      const r = new Map();
      for (const [id, v] of mun.marcas) { const p = esc.aPantalla(v); if (p) r.set(id, { ...p, d: v.distanceTo(esc.camara.position) }); }
      return r;
    },
    resaltar: (ids) => mun.resaltar(ids),
    /** Un cristal que se encontró en otro aparato (llegó de la nube): se quita sin animación */
    quitarCristal: (id) => mun.quitarCristal(id, false),
    /** Viste al personaje (atuendo e índices de la Pasarela) */
    vestir(atuendo, idx, piel) { av.vestir(atuendo, idx); if (piel) av.ponerPiel(piel); },
    /** Regresar de un juego: aparece frente a su puerta, viendo a la plaza */
    volverDe(id) { salirDe(id); ruta = []; alLlegar = null; saltar = true; cerca = null; },
    pausar: (si) => esc.pausar(si),
    cadaCuadro: (fn) => esc.cadaCuadro(fn),
    get cercano() { return cerca; },
    get pos() { return c; },
    get fps() { return esc.fps; },
    get info() { const i = esc.renderer.info.render; return { dibujos: i.calls, triangulos: i.triangles }; },
    get calidad() { return esc.calidad; },
    liberar: () => esc.liberar(),
  };
}
