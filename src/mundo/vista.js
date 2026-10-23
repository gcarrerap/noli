// La vista del mundo (#25): une la escena (kit/3d/escena.js), el mundo (escena-mundo.js), el personaje
// (kit/3d/avatar.js), la física con brincos (kit/3d/fisica.js) y la cámara. La pantalla (src/ui/screens/mundo.js)
// solo le dice "camina hacia aquí", "brinca" o "ve a tal juego", y le pregunta en qué puerta está.
// Este módulo baja Three.js: se carga con import() solo cuando se va a usar el mundo (el menú 2D no lo necesita).
import * as THREE from "../../kit/3d/vendor/three.module.min.js";
import { crearEscena } from "../../kit/3d/escena.js";
import { crearAvatar } from "../../kit/3d/avatar.js";
import { pasoFisico, crearCuerpo, alturaBajo, arrastre, hayPiso, chocaEn } from "../../kit/3d/fisica.js";
import { seguirRuta } from "../../kit/3d/movimiento.js";
import { crearMundo } from "./escena-mundo.js";
import { crearIslas } from "./escena-islas.js";
import { estadoRed, mapaIslas, limitesRed, islaEn, muelleEn, enTeletransportador, teletransportadorDe, aOrilla, posPlataforma,
  INICIO } from "../engine/islas.js";
import { lugarCercano, cristalTocado, rutaPorCaminos, puntoLibre, brazoCamara } from "../engine/mundo.js";
import { libroTocado, nivelPista } from "../engine/libros.js";
import { luzAhora } from "../engine/luz.js";

/**
 * @param {HTMLElement} cont
 * @param {object} m todo lo del mundo ya armado: { mundo, lugares, deco, mapa, caminos, cfg, cristales, red, islas }
 *   red: las islas (engine/islas.js → armarIslas); islas: mundo/islas.json
 * @param {{ tv: boolean, reducir: boolean, tiene: Set<string>, desde?: string, piel?: string, base?: string,
 *   alLugar: (l|null) => void, alCristal: (c) => void, alBajarMucho?: () => void,
 *   libro?: { n, x, y, z }|null, alLibro?: (l) => void, alPista?: (nivel) => void }} op
 *   libro: el libro escondido que toca buscar (#103); mundo.libros da los segundos de cada pista
 * Islas (#164): { datosIslas, alIsla(isla), alMuelle(muelle|null), alTele(isla|null), alCaida() }
 *   datosIslas: "_mundo" (islas visitadas, conexiones construidas); alIsla: pisó otra isla; alMuelle / alTele: está
 *   (o ya no) en un muelle o en un teletransportador; alCaida: cayó al agua y regresó al último punto firme
 *   tiene: cristales que ya encontró; desde: id del juego de cuya puerta sale (al regresar de un juego)
 */
export function crearVistaMundo(cont, m, op) {
  const { mundo, lugares, deco, mapa, caminos, cfg, cristales, red } = m;
  const esc = crearEscena(cont, { tv: op.tv, alBajarMucho: op.alBajarMucho, fondo: mundo.cielo || "#eee3ff", niebla: mundo.niebla || [22, 52], lejos: 58 });
  const mun = crearMundo(mundo, lugares, deco, cristales, { reducir: op.reducir });
  esc.scene.add(mun.grupo);
  for (const id of op.tiene) mun.quitarCristal(id, false);

  // ---- Las islas (#164): mar, islas, puentes, plataformas, muelles y teletransportadores ----
  const isl = crearIslas(red, m.islas, { reducir: op.reducir });
  esc.scene.add(isl.grupo);
  let datosIslas = op.datosIslas, estado = null, fisMapa = null, moviles = [], tRed = 0;
  let islaActual = INICIO, muelle = null, tele = null;
  function rearmar(nueva) {
    estado = estadoRed(red, datosIslas);
    const mi = mapaIslas(red, estado);
    // La física: lo de Isla Noli (plataformas, edificios, árboles) + barandales y plataformas de las islas; el piso solo
    // en las zonas (islas, puentes, muelles) y los límites, los de todo el archipiélago
    fisMapa = { solidos: [...mapa.solidos, ...mi.solidos], zonas: mi.zonas, limites: limitesRed(red) };
    moviles = fisMapa.solidos.filter((x) => x.plataforma && x.plataforma.mueve);
    isl.dibujarConexiones(estado, nueva);
    muelle = null;
  }
  rearmar();
  isl.enfocar(INICIO);
  // ---- El libro escondido (#103) ----
  let libro = null, buscando = 0, pista = 0;
  const ponerLibro = (l) => { libro = l || null; buscando = 0; pista = 0; mun.ponerLibro(libro); };
  ponerLibro(op.libro);

  const av = crearAvatar({ piel: op.piel || "#ffd9c0", base: op.base || "#cbbfe6" });
  esc.scene.add(av.raiz);
  // La sombra se queda en el piso (o en la plataforma) aunque el personaje brinque: así se ve dónde va a caer
  av.raiz.remove(av.sombra);
  esc.scene.add(av.sombra);

  // ---- Dónde empieza: en la plaza, o frente a la puerta del juego del que regresa ----
  let c = crearCuerpo(mundo.inicio.x, mundo.inicio.z, 0);
  let firme = { x: c.x, z: c.z, ang: 0 }; // último punto firme de una isla (al caer al agua regresa aquí)
  const irAIsla = (id) => { if (islaActual !== id) { islaActual = id; isl.enfocar(id); } };
  const salirDe = (id) => {
    const l = lugares.find((x) => x.id === id);
    if (l) { c = crearCuerpo(l.punto.x, l.punto.z, l.mira + 180); firme = { x: c.x, z: c.z, ang: c.ang }; irAIsla(INICIO); } // de espaldas al edificio, viendo a la plaza
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

  // ---- La luz sigue la hora real del aparato (src/engine/luz.js): el sol, el cielo, la niebla y las estrellas ----
  const luzCfg = mundo.luz;
  const { cielo: luzCielo, sol: luzSol } = esc.luces;
  function aplicarLuz() {
    if (!luzCfg) return;
    const L = luzAhora(new Date(), luzCfg);
    esc.scene.background.set(L.cielo);
    esc.scene.fog.color.set(L.niebla);
    luzCielo.color.set(L.luzCielo); luzCielo.groundColor.set(L.luzSuelo); luzCielo.intensity = L.luzCieloI;
    luzSol.color.set(L.sol); luzSol.intensity = L.solI;
    luzSol.position.set(L.direccion.x * 10, L.direccion.y * 10, L.direccion.z * 10);
    mun.ajustarEstrellas(L.estrellas);
  }
  aplicarLuz();
  const reloj = { t: 0, luz: 0 };
  esc.cadaCuadro((dt) => {
    reloj.t += dt;
    reloj.luz += dt;
    if (reloj.luz > 2) { reloj.luz = 0; aplicarLuz(); } // el sol se mueve despacio: cada 2 s basta
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
    // Las plataformas que se mueven (#164): su sólido y su malla; y si está parado en una, se lo lleva
    tRed += dt;
    for (const s of moviles) { const p = posPlataforma(s.plataforma, tRed); s.mov = { dx: p.x - s.x, dz: p.z - s.z }; s.x = p.x; s.z = p.z; }
    isl.moverPlataformas(tRed);
    const ar = arrastre(c, fisMapa, cfg);
    if ((ar.dx || ar.dz) && !chocaEn(c.x + ar.dx, c.y, c.z + ar.dz, fisMapa, cfg)) c = Object.assign({}, c, { x: c.x + ar.dx, z: c.z + ar.dz });
    const r = pasoFisico(c, { quiere: q, brincar }, dt, cfg, fisMapa);
    brincar = false;
    c = r.c;
    // Último punto firme: en el suelo de una isla, a más de 1 m de la orilla
    if (c.enSuelo && Math.abs(c.y) < 1e-6) {
      const i = islaEn(red, c.x, c.z);
      if (i) {
        if (aOrilla(i.f, c.x, c.z) > 1) firme = { x: c.x, z: c.z, ang: c.ang };
        if (i.id !== islaActual) { irAIsla(i.id); if (op.alIsla) op.alIsla(i); }
      }
    }
    // Cayó al agua: regresa al último punto firme de la isla (sin castigo)
    if (c.y < -0.9 || !isFinite(c.x + c.z + c.y)) {
      c = crearCuerpo(firme.x, firme.z, firme.ang); ruta = []; alLlegar = null; saltar = true;
      if (op.alCaida) op.alCaida();
    }
    animacion = !c.enSuelo ? "brinco" : r.caminando ? "caminar" : "quieto";

    av.raiz.position.set(c.x, c.y, c.z);
    av.raiz.rotation.y = (c.ang + 180) * Math.PI / 180;
    av.animar(animacion, dt, Math.min(cfg.turbo || 1, Math.hypot(q.x, q.z))); // corriendo, los pasos van más rápido
    const h = alturaBajo(c.x, c.z, c.y + 0.01, fisMapa, cfg);
    av.sombra.visible = h > -1;
    av.sombra.position.set(c.x, h + 0.02, c.z);
    av.sombra.scale.setScalar(Math.max(0.45, 1 - (c.y - h) * 0.22));

    // ---- Puertas y cristales ----
    const l = lugarCercano(c, lugares);
    if ((l && l.id) !== (cerca && cerca.id)) { cerca = l; op.alLugar(l); }
    // Muelles (para construir) y teletransportadores (#164)
    const mu = c.y < 0.05 && c.enSuelo ? muelleEn(estado, c.x, c.z) : null;
    if ((mu && mu.id + mu.isla) !== (muelle && muelle.id + muelle.isla)) { muelle = mu; if (op.alMuelle) op.alMuelle(mu); }
    const te = c.enSuelo ? enTeletransportador(red, c) : null;
    if ((te && te.id) !== (tele && tele.id)) { tele = te; if (op.alTele) op.alTele(te); }
    const cr = cristalTocado(c, cristales, op.tiene);
    if (cr) { op.tiene.add(cr.id); mun.quitarCristal(cr.id); op.alCristal(cr); }
    if (libro) {
      if (libroTocado(c, libro)) { const l = libro; libro = null; mun.tomarLibro(); if (op.alLibro) op.alLibro(l); }
      else {
        buscando += dt;
        const n = nivelPista(buscando, mundo.libros || {});
        if (n !== pista) { pista = n; mun.pistaLibro(n); if (op.alPista) op.alPista(n); }
      }
    }

    mun.animar(dt, reloj.t);
    isl.animar(dt, reloj.t);

    // ---- Cámara ----
    camaraObjetivo(dt);
    const k = saltar ? 1 : 1 - Math.pow(0.02, dt);
    cam.p.lerp(obj.p, k); cam.m.lerp(obj.m, k);
    saltar = false;
    esc.camara.position.copy(cam.p);
    esc.camara.lookAt(cam.m);
    mun.despejar({ x: cam.p.x, z: cam.p.z }, c, dt, k === 1);
  });

  /** Aparece en el teletransportador de una isla */
  function teletransportar(id) {
    const i = red.por.get(id);
    if (!i) return;
    const t = teletransportadorDe(i);
    c = crearCuerpo(t.x, t.z + 2.2, 0); // junto al círculo, del lado de la cámara: se ve llegar
    firme = { x: c.x, z: c.z, ang: 0 };
    ruta = []; alLlegar = null; saltar = true; cerca = null; tele = null; muelle = null;
    irAIsla(id);
  }

  /** ¿Hay piso en toda la línea de a a b? (tocar el piso de otra isla no camina por el agua) */
  const conPiso = (a, b) => {
    const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(d / 0.5));
    for (let i = 0; i <= n; i++) if (!hayPiso(a.x + (b.x - a.x) * i / n, a.z + (b.z - a.z) * i / n, fisMapa, cfg)) return false;
    return true;
  };

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
      // Los juegos están en Isla Noli: desde otra isla (o un puente) se llega por el teletransportador
      if (islaActual !== INICIO || !islaEn(red, c.x, c.z)) teletransportar(INICIO);
      return new Promise((res) => caminarA(l.punto, () => { c = Object.assign({}, c, { ang: l.mira }); res(); }));
    },
    /** Camina sola hasta un punto del piso tocado (en Isla Noli por los caminos; en las demás islas, en línea recta) */
    irAPunto(x, z) {
      const p = { x, z };
      if (!hayPiso(x, z, fisMapa, cfg) || chocaEn(x, 0, z, fisMapa, cfg) || c.y > 0.05) return;
      if (islaActual === INICIO && islaEn(red, x, z) === red.por.get(INICIO) && puntoLibre(p, mapa, cfg)) caminarA(p);
      else if (conPiso(c, p)) { ruta = [p]; atorado = { t: 0, d: Infinity }; alLlegar = null; }
    },
    /** Viajar con el teletransportador a una isla */
    teletransportar,
    /** Cambió lo guardado del mundo (se construyó algo, llegó de la nube, se visitó una isla). nueva: la recién construida */
    actualizarIslas(datos, nueva) { datosIslas = datos; rearmar(nueva); },
    get isla() { return islaActual; },
    get muelle() { return muelle; },
    get tele() { return tele; },
    /** Punto del piso bajo un toque en la pantalla (o null) */
    alPiso: (px, py) => esc.alPiso(px, py),
    /** Posición en pantalla del letrero de cada juego, con su distancia a la cámara: Map(id → {x, y, d}) */
    letreros() {
      const r = new Map();
      for (const [id, v] of mun.marcas) { const p = esc.aPantalla(v); if (p) r.set(id, { ...p, d: v.distanceTo(esc.camara.position) }); }
      return r;
    },
    resaltar: (ids) => mun.resaltar(ids),
    /** Pone el siguiente libro escondido (o ninguno con null), sin pista */
    ponerLibro,
    get libro() { return libro; },
    /** Un cristal que se encontró en otro aparato (llegó de la nube): se quita sin animación */
    quitarCristal: (id) => mun.quitarCristal(id, false),
    /** Viste al personaje (atuendo e índices de la Pasarela) */
    vestir(atuendo, idx, piel) { av.vestir(atuendo, idx); if (piel) av.ponerPiel(piel); },
    /** Regresar de un juego: aparece frente a su puerta, viendo a la plaza */
    volverDe(id) { salirDe(id); ruta = []; alLlegar = null; saltar = true; cerca = null; tele = null; muelle = null; },
    /** Para diagnosticar (y las pruebas en el navegador): qué islas están armadas */
    get islasArmadas() { return isl.armadas; },
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
