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

const POSES_FINALES = ["cintura", "saludo", "estrella"];

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
  let desfile = null; // { t, fin, pose, resolver }
  let espejo = 0;     // segundos que quedan de la vuelta en el espejo
  let atuendoActual = null;

  // Cámara: posición y punto al que mira, suavizados
  const cam = { p: new THREE.Vector3(0, 3, 8), m: new THREE.Vector3(0, 1, 0) };
  const objetivo = { p: new THREE.Vector3(), m: new THREE.Vector3() };
  let saltar = true; // la primera vez (o al cambiar de lugar) la cámara se pone directo, sin viajar

  function camaraObjetivo() {
    const ancho = cont.clientWidth > cont.clientHeight * 1.15; // pantalla ancha: panel a la derecha; si no, abajo
    if (modo === "inicio" || modo === "probador" || espejo > 0) {
      // De frente. La tarjeta o el panel tapan la derecha (pantalla ancha) o la mitad de abajo (teléfono):
      // la cámara mira a un punto corrido para que el personaje quede en la parte que se ve.
      const lejos = modo === "inicio" ? 3.2 : 2.6;
      if (ancho) {
        objetivo.m.set(pos.x + 0.62, 0.85, pos.z);
        objetivo.p.set(pos.x + 0.62, 1.2, pos.z + lejos);
      } else {
        objetivo.m.set(pos.x, 0.05, pos.z);
        objetivo.p.set(pos.x, 1.05, pos.z + lejos + 1.6);
      }
    } else if (modo === "pasarela") {
      // Al final de la pasarela, un poco a la derecha para que se vean también los jueces
      const ancho2 = cont.clientWidth > cont.clientHeight * 1.15;
      objetivo.m.set(ancho2 ? 0.9 : 0.3, 1.0, Math.max(av.raiz.position.z, ESCENARIO.inicio + 1.5));
      objetivo.p.set(ancho2 ? 1.4 : 0.5, 1.7, ESCENARIO.z0 + (ancho2 ? 3.4 : 5.2));
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
      // Girar hacia la cámara (180°) poco a poco; en el espejo, dar una vuelta completa
      const destino = espejo > 0 ? pos.ang + 200 * dt : 180;
      if (espejo > 0) { espejo -= dt; pos.ang = destino; }
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
      av.raiz.rotation.y = 0; // mira hacia la cámara (+z)
      animacion = k < 1 ? "desfilar" : desfile.pose;
      if (k >= 1 && desfile.t > dur + 2.2 && desfile.resolver) { const r = desfile.resolver; desfile.resolver = null; for (const j of pasarela.jueces) j.modo = "saludo"; r(); }
    }
    av.animar(animacion, dt, vel);
    pasarela.animar(dt);

    // ---- Cámara ----
    camaraObjetivo();
    const k = saltar ? 1 : 1 - Math.pow(0.02, dt);
    cam.p.lerp(objetivo.p, k); cam.m.lerp(objetivo.m, k);
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
    },
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
    /** Desfila en la pasarela; la promesa se cumple al terminar la pose final */
    desfilar() {
      return new Promise((r) => {
        for (const j of pasarela.jueces) j.modo = "quieto";
        desfile = { t: 0, pose: POSES_FINALES[Math.floor(Math.random() * POSES_FINALES.length)], resolver: r };
        saltar = true;
      });
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
