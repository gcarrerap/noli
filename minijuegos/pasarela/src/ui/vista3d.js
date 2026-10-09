// La vista 3D: une la escena (src/escena/), el movimiento (src/movimiento.js) y la cámara. La interfaz
// (src/ui/juego.js) solo le pide cosas como "modo estudio", "camina hacia aquí" o "desfila", y le pregunta qué zona
// está cerca. La vista 2D (vista2d.js) tiene las mismas funciones, así el juego no sabe cuál está usando.
// Ver docs/ARQUITECTURA.md § Vistas y docs/ESCENA-3D.md § Cámara.
import * as THREE from "../../vendor/three.module.min.js";
import { crearEscena } from "../escena/escena.js";
import { crearAvatar } from "../escena/avatar.js";
import { crearEstudio } from "../escena/estudio.js";
import { crearPasarela, ESCENARIO } from "../escena/pasarela.js";
import { cargarModelo, modeloPara, modeloListo } from "../escena/modelos.js";
import { mapaDeChoques, paso, zonaCercana, rutaHacia, seguirRuta, difAngulo } from "../movimiento.js";

/**
 * Qué parte del cuerpo enseña la cámara al abrir el panel de una zona (zonas.json → enfoque): altura del centro (m) y
 * cuánto alto hay que ver (m). La cámara se aleja lo justo para que eso quepa en la parte de la pantalla que el panel
 * no tapa. Ver docs/ESCENA-3D.md § Cámara.
 */
export const ENFOQUES = {
  cara:    { y: 1.42, alto: 0.75 },
  cabeza:  { y: 1.47, alto: 0.8 },
  alto:    { y: 1.2, alto: 1.15 },
  torso:   { y: 1.05, alto: 1.15 },
  cuerpo:  { y: 0.88, alto: 1.95 },
  piernas: { y: 0.5, alto: 1.15 },
  pies:    { y: 0.2, alto: 0.9 },
};

/**
 * @param {HTMLElement} cont
 * @param {object} idx índices de datos.js
 * @param {{ tv: boolean, piel: string, alZona: (zona|null) => void, alBajarMucho?: () => void, reducirMovimiento?: boolean }} op
 */
export function crearVista3d(cont, idx, op) {
  const esc = crearEscena(cont, { tv: op.tv, alBajarMucho: op.alBajarMucho });
  const zonas = idx.zonas;
  const estudio = crearEstudio(zonas, idx.config.estudio);
  esc.scene.add(estudio.grupo);
  const pasarela = crearPasarela(idx);
  esc.scene.add(pasarela.grupo);
  pasarela.grupo.visible = false;
  const av = crearAvatar({ piel: op.piel, base: idx.config.colorBase });
  esc.scene.add(av.raiz);
  const mapa = mapaDeChoques(zonas, idx.config.estudio);
  const mov = idx.config.movimiento;

  const pos = { x: zonas.inicio.x, z: zonas.inicio.z, ang: 180 };
  let modo = "inicio", quiere = { x: 0, z: 0 }, ruta = [], alLlegar = null, cerca = null, animacion = "quieto";
  let desfile = null; // { t, pose, llego, giro } — la pose la escoge Noelia al llegar (posar)
  let enfoque = "cuerpo", giro = 0, giroActual = 0; // en el probador: qué se ve y cuánto se ha girado el personaje
  const corr = { x: 0, y: 0, ox: 0, oy: 0 };          // corrimiento de la imagen (actual y objetivo)
  let espejo = 0;     // segundos que quedan de la vuelta en el espejo
  let atuendoActual = null;

  // Cámara: posición y punto al que mira, suavizados
  const cam = { p: new THREE.Vector3(0, 3, 8), m: new THREE.Vector3(0, 1, 0) };
  const objetivo = { p: new THREE.Vector3(), m: new THREE.Vector3() };
  let saltar = true; // la primera vez (o al cambiar de lugar) la cámara se pone directo, sin viajar

  /** Lo que tapa la interfaz: { dx, dy } corrimiento y { hv, wv } fracción de la pantalla que se ve */
  function tapado() {
    const W = cont.clientWidth || innerWidth, H = cont.clientHeight || innerHeight, ancho = W > H * 1.15;
    if (modo === "probador") {
      if (ancho) { const f = Math.min(0.44, 620 / W); return { dx: f / 2, dy: 0, hv: 0.86, wv: 1 - f }; }
      return { dx: 0, dy: 0.27, hv: 0.44, wv: 1 };
    }
    if (modo === "inicio") {
      if (ancho) { const f = Math.min(0.46 * W, 640) / W + 0.05; return { dx: f / 2, dy: 0, hv: 0.9, wv: 1 - f }; }
      return { dx: 0, dy: 0.3, hv: 0.38, wv: 1 };
    }
    if (modo === "pasarela" && desfile && !desfile.llego) {
      // Escogiendo poses: el menú tapa abajo (teléfono) o la derecha (pantalla ancha)
      if (ancho) { const f = Math.min(0.46 * W, 640) / W + 0.02; return { dx: f / 2, dy: 0, hv: 1, wv: 1 - f }; }
      return { dx: 0, dy: 0.2, hv: 0.6, wv: 1 };
    }
    return { dx: 0, dy: 0, hv: 0.8, wv: 1 };
  }

  function camaraObjetivo() {
    const ancho = cont.clientWidth > cont.clientHeight * 1.15;
    const t = tapado();
    corr.ox = t.dx; corr.oy = t.dy;
    if (modo === "inicio" || modo === "probador" || espejo > 0) {
      // De frente, a la distancia justa para que la parte enfocada quepa en lo que se ve
      const e = ENFOQUES[modo === "probador" ? enfoque : "cuerpo"];
      const tanV = Math.tan((esc.camara.fov * Math.PI) / 360), aspecto = (cont.clientWidth || 1) / (cont.clientHeight || 1);
      const dAlto = e.alto / (2 * t.hv * tanV);
      const dAncho = Math.max(0.55, e.alto * 0.55) / (2 * t.wv * tanV * aspecto);
      const d = Math.max(dAlto, dAncho, 0.9);
      const arriba = e.y < 0.4 ? 0.3 * d : 0.12 * d; // a los pies se les ve un poco desde arriba
      objetivo.m.set(pos.x, e.y, pos.z);
      objetivo.p.set(pos.x, e.y + arriba, pos.z + d);
    } else if (modo === "pasarela") {
      // Al final de la pasarela, un poco a la derecha para que se vean también los jueces
      objetivo.m.set(ancho ? 0.9 : 0.3, 1.0, Math.max(av.raiz.position.z, ESCENARIO.inicio + 1.5));
      objetivo.p.set(ancho ? 1.4 : 0.5, 1.7, ESCENARIO.z0 + (ancho ? 3.4 : 5.2));
    } else { // estudio: atrás y arriba, siempre con la misma orientación (no marea). En el teléfono parado, más lejos.
      const alto = ancho ? 3.6 : 5.2, atras = ancho ? 5.4 : 6.6;
      objetivo.m.set(pos.x * (ancho ? 1 : 0.7), 0.9, pos.z - (ancho ? 0.6 : 1.4));
      objetivo.p.set(pos.x * (ancho ? 0.85 : 0.6), alto, pos.z + atras);
    }
  }

  esc.cadaCuadro((dt) => {
    // ---- Mover al personaje ----
    let caminando = false, vel = 0;
    if (modo === "estudio" && espejo <= 0) {
      let q = quiere;
      if (ruta.length) { const r = seguirRuta(pos, ruta); ruta = r.ruta; q = r.quiere; if (!ruta.length && alLlegar) { const f = alLlegar; alLlegar = null; f(); } }
      const n = paso(pos, q, dt, mov, mapa);
      caminando = n.caminando; vel = Math.min(1, Math.hypot(q.x, q.z));
      pos.x = n.x; pos.z = n.z; pos.ang = n.ang;
      const z = zonaCercana(pos, zonas.zonas);
      if ((z && z.id) !== (cerca && cerca.id)) { cerca = z; op.alZona(z); }
    } else if (modo === "probador" || modo === "inicio" || espejo > 0) {
      // Girar hacia la cámara (180°, más lo que Noelia lo haya girado) poco a poco; en el espejo, dar una vuelta completa
      giroActual += (giro - giroActual) * (1 - Math.pow(0.001, dt));
      const destino = espejo > 0 ? pos.ang + 200 * dt : 180 + giroActual;
      if (espejo > 0) { espejo -= dt; pos.ang = destino; }
      else if (Math.abs(giro - giroActual) > 0.5) pos.ang = destino; // girando a mano: sigue al dedo
      else pos.ang += Math.max(-300 * dt, Math.min(300 * dt, difAngulo(pos.ang, destino)));
    }
    if (modo !== "pasarela") {
      av.raiz.position.set(pos.x, 0, pos.z);
      av.raiz.rotation.y = (pos.ang + 180) * Math.PI / 180;
      animacion = caminando ? "caminar" : espejo > 0 ? "vuelta" : "quieto";
    } else if (desfile) {
      desfile.t += dt;
      const dur = op.reducirMovimiento ? 2.2 : 4.4;
      const k = Math.min(1, desfile.t / dur);
      av.raiz.position.set(0, ESCENARIO.alto, ESCENARIO.inicio + (ESCENARIO.fin - ESCENARIO.inicio) * k);
      // Mira hacia la cámara (+z); la "vuelta" gira todo el personaje
      if (desfile.pose === "vuelta" && k >= 1) desfile.giro += dt * (op.reducirMovimiento ? 2 : 5);
      else desfile.giro += (Math.round(desfile.giro / (2 * Math.PI)) * 2 * Math.PI - desfile.giro) * Math.min(1, dt * 8);
      av.raiz.rotation.y = desfile.giro;
      animacion = k < 1 ? "desfilar" : desfile.pose;
      if (k >= 1 && desfile.llego) { const r = desfile.llego; desfile.llego = null; r(); }
    }
    av.animar(animacion, dt, vel);
    pasarela.animar(dt);

    // ---- Cámara ----
    camaraObjetivo();
    const k = saltar ? 1 : 1 - Math.pow(0.02, dt);
    cam.p.lerp(objetivo.p, k); cam.m.lerp(objetivo.m, k);
    const cx = corr.x + (corr.ox - corr.x) * k, cy = corr.y + (corr.oy - corr.y) * k;
    if (Math.abs(cx - corr.x) > 1e-4 || Math.abs(cy - corr.y) > 1e-4 || saltar) { corr.x = cx; corr.y = cy; esc.correr(cx, cy); }
    saltar = false;
    esc.camara.position.copy(cam.p);
    esc.camara.lookAt(cam.m);
  });

  /** Viste al personaje; si una prenda viene de un .glb que no se ha cargado, lo carga y vuelve a vestir */
  function vestir(atuendo) {
    atuendoActual = atuendo;
    av.vestir(atuendo, idx, modeloPara);
    const faltan = [];
    for (const p of [atuendo.peinado, atuendo.arriba, atuendo.abajo, atuendo.vestido, atuendo.zapatos, ...Object.values(atuendo.accesorios)]) {
      const pr = p && idx.prendas.get(p.id);
      if (pr && pr.modelo && !modeloListo(pr)) faltan.push(cargarModelo(pr));
    }
    if (faltan.length) Promise.all(faltan).then(() => { if (atuendoActual === atuendo) av.vestir(atuendo, idx, modeloPara); }).catch((e) => console.warn("[pasarela]", e));
  }

  return {
    tipo: "3d",
    vestir,
    ponerPiel: (hex) => av.ponerPiel(hex),
    /** "inicio" | "estudio" | "probador" | "pasarela" */
    modo(m) {
      if (m === modo) return;
      // La pasarela es de noche (fondo morado); el estudio, de día
      const noche = m === "pasarela";
      esc.scene.background.set(noche ? "#2b2140" : "#fde7f1");
      esc.scene.fog.color.set(noche ? "#2b2140" : "#fde7f1");
      // Solo se dibuja el lugar donde está la cámara (ahorra la mitad de los dibujos por cuadro en la TV)
      estudio.grupo.visible = !noche;
      pasarela.grupo.visible = noche;
      if (m === "pasarela" || modo === "pasarela") saltar = true;
      modo = m; quiere = { x: 0, z: 0 };
      if (m !== "estudio") { ruta = []; alLlegar = null; }
      if (m === "estudio" && pos.ang === 180) pos.ang = 0;
      if (m !== "probador") { giro = 0; giroActual = 0; }
    },
    /** Qué parte del cuerpo enfocar en el probador (ENFOQUES); se llama antes de modo("probador") */
    enfocar(e) { enfoque = ENFOQUES[e] ? e : "cuerpo"; },
    /** Gira al personaje en el probador (grados; positivo = hacia la derecha de la pantalla) */
    girar(grados) { giro += grados; },
    /** Dirección del joystick o de las flechas (en pantalla: x derecha, z abajo) */
    mover(q) { quiere = q; if (Math.hypot(q.x, q.z) > 0.1) { ruta = []; alLlegar = null; } },
    /** Camina sola hasta una zona; la promesa se cumple al llegar */
    irA(zonaId) {
      const z = zonas.zonas.find((x) => x.id === zonaId);
      if (!z) return Promise.resolve();
      ruta = rutaHacia(pos, z, mapa, mov.radio);
      return new Promise((r) => { alLlegar = () => { pos.ang = z.mira; r(); }; });
    },
    /** Camina sola hasta un punto del piso tocado */
    irAPunto(x, z) { ruta = [{ x, z }]; alLlegar = null; },
    /** Punto del piso bajo un toque en la pantalla (o null) */
    alPiso: (px, py) => esc.alPiso(px, py),
    /** Da una vuelta frente al espejo */
    espejo() { espejo = op.reducirMovimiento ? 0.8 : 1.8; },
    /** Desfila en la pasarela; la promesa se cumple al llegar al final (ahí Noelia escoge sus poses con posar) */
    desfilar() {
      return new Promise((r) => {
        for (const j of pasarela.jueces) j.modo = "quieto";
        desfile = { t: 0, pose: "quieto", llego: r, giro: 0 };
        saltar = true;
      });
    },
    /** Hace una pose o baile de datos/poses.json al final de la pasarela */
    posar(id) { if (desfile) desfile.pose = id; },
    /** Termina el desfile: los jueces aplauden (saludan); la promesa se cumple después de un momento */
    terminarDesfile() {
      for (const j of pasarela.jueces) j.modo = "saludo";
      return new Promise((r) => setTimeout(r, op.reducirMovimiento ? 300 : 1200));
    },
    /** Regresa al estudio (al punto de inicio) después de la pasarela */
    regresar() { desfile = null; pos.x = zonas.inicio.x; pos.z = zonas.inicio.z; pos.ang = 180; saltar = true; cerca = null; },
    /** Posición en pantalla del letrero de cada zona: Map(id → {x, y}) */
    letreros() {
      const r = new Map();
      for (const [id, v] of estudio.marcas) { const p = esc.aPantalla(v); if (p) r.set(id, p); }
      return r;
    },
    cadaCuadro: (fn) => esc.cadaCuadro(fn),
    get cercana() { return cerca; },
    get fps() { return esc.fps; },
    /** Dibujos por cuadro y triángulos (para docs/RENDIMIENTO.md y la medición con ?fps) */
    get info() { const r = esc.renderer.info.render; return { dibujos: r.calls, triangulos: r.triangles }; },
    get calidad() { return esc.calidad; },
    ponerCalidad: (c) => esc.ponerCalidad(c),
    liberar: () => esc.liberar(),
  };
}
