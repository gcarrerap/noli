// La escena: renderer, cámara, luces, el ciclo de cuadros y la calidad según el aparato. La usan la Pasarela y el
// mundo del menú principal (#25). Ver minijuegos/pasarela/docs/ESCENA-3D.md (§ Renderer y calidad) y RENDIMIENTO.md.
import * as THREE from "./vendor/three.module.min.js";
import { liberarMateriales } from "./materiales.js";
import { liberarFormas } from "./formas.js";
import { liberarTexturas } from "./texturas.js";

/** ¿Hay WebGL en este navegador? (sin él, se usa la vista 2D) */
export { hayWebGL } from "./webgl.js";

/**
 * Niveles de calidad. Se empieza en "alta" en el teléfono y en "media" en la TV (pantallas grandes con GPU modestas)
 * y se baja sola si los cuadros por segundo no alcanzan (ver Calidad en docs/RENDIMIENTO.md).
 */
export const CALIDADES = {
  alta: { pixeles: 2, nombre: "alta" },
  media: { pixeles: 1, nombre: "media" },
  baja: { pixeles: 0.7, nombre: "baja" },
};
const ORDEN = ["alta", "media", "baja"];

/**
 * Crea la escena en un contenedor.
 * @param {HTMLElement} cont
 * @param {{ tv: boolean, calidad?: string, alBajarMucho?: () => void, fondo?: string, niebla?: [number, number], lejos?: number }} op
 *   fondo y niebla: color del cielo y desde/hasta dónde se desvanece (por omisión los del estudio de la Pasarela)
 */
export function crearEscena(cont, op) {
  // Antialias cuesta mucho en la TV (4K con GPU de tele); en la TV se suaviza con más pixeles en su lugar.
  const renderer = new THREE.WebGLRenderer({ antialias: !op.tv, powerPreference: "high-performance", alpha: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  cont.appendChild(renderer.domElement);
  renderer.domElement.className = "lienzo";

  const scene = new THREE.Scene();
  const fondo = op.fondo || "#fde7f1", niebla = op.niebla || [16, 34];
  scene.background = new THREE.Color(fondo);
  scene.fog = new THREE.Fog(fondo, niebla[0], niebla[1]);
  const camara = new THREE.PerspectiveCamera(48, 1, 0.1, op.lejos || 80);

  const cielo = new THREE.HemisphereLight("#ffffff", "#f6d6c8", 2.1);
  scene.add(cielo);
  const sol = new THREE.DirectionalLight("#ffffff", 1.6);
  sol.position.set(3, 8, 6);
  scene.add(sol);

  // Corrimiento de la imagen (fracción del ancho y del alto): cuando un panel tapa una parte de la pantalla, el centro
  // de la cámara se dibuja en el centro de lo que sí se ve (setViewOffset), así lo que la cámara mira no queda tapado.
  const corrimiento = { x: 0, y: 0 };
  function aplicarCorrimiento() {
    const w = cont.clientWidth || window.innerWidth, h = cont.clientHeight || window.innerHeight;
    if (Math.abs(corrimiento.x) < 1e-4 && Math.abs(corrimiento.y) < 1e-4) camara.clearViewOffset();
    else camara.setViewOffset(w, h, corrimiento.x * w, corrimiento.y * h, w, h);
  }

  let calidad = op.calidad && CALIDADES[op.calidad] ? op.calidad : op.tv ? "media" : "alta";
  function tamano() {
    const w = cont.clientWidth || window.innerWidth, h = cont.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CALIDADES[calidad].pixeles));
    renderer.setSize(w, h, false);
    camara.aspect = w / h;
    // En el teléfono parado (pantalla angosta) se abre el ángulo para que quepa el estudio a lo ancho
    camara.fov = w / h < 0.8 ? 62 : 48;
    aplicarCorrimiento();
    camara.updateProjectionMatrix();
  }
  tamano();
  window.addEventListener("resize", tamano);

  // ---- Medir cuadros por segundo y bajar la calidad si no alcanza ----
  const fps = { cuadros: 0, desde: 0, valor: 0, historial: [] };
  function medir(ahora) {
    if (!fps.desde) fps.desde = ahora;
    fps.cuadros++;
    if (ahora - fps.desde >= 1000) {
      fps.valor = (fps.cuadros * 1000) / (ahora - fps.desde);
      fps.historial = [...fps.historial.slice(-9), fps.valor];
      fps.cuadros = 0; fps.desde = ahora;
      // 3 segundos seguidos por debajo de 26 → bajar un nivel. En "baja" y por debajo de 15 → avisar.
      const ult = fps.historial.slice(-3);
      if (ult.length === 3 && ult.every((v) => v < 26)) {
        const i = ORDEN.indexOf(calidad);
        if (i < ORDEN.length - 1) { calidad = ORDEN[i + 1]; tamano(); fps.historial = []; }
        else if (ult.every((v) => v < 15) && op.alBajarMucho) { op.alBajarMucho(); fps.historial = []; }
      }
    }
  }

  const alCuadro = new Set();
  let anterior = 0, vivo = true, pausado = false, detenido = false;
  function ciclo(ahora) {
    if (!vivo) return;
    requestAnimationFrame(ciclo);
    if (pausado || detenido) { anterior = ahora; return; }
    const dt = Math.min(0.05, anterior ? (ahora - anterior) / 1000 : 0.016); // máximo 50 ms: si la TV se traba no "salta"
    anterior = ahora;
    for (const fn of alCuadro) fn(dt, ahora);
    renderer.render(scene, camara);
    medir(ahora);
  }
  requestAnimationFrame(ciclo);
  // Si la pestaña o la TV no se ve, no dibujar (ahorra batería y no calienta la TV)
  const alVer = () => { pausado = document.hidden; };
  document.addEventListener("visibilitychange", alVer);

  return {
    THREE, scene, camara, renderer,
    /** fn(dt segundos, ahora ms) en cada cuadro; devuelve la función para quitarla */
    cadaCuadro(fn) { alCuadro.add(fn); return () => alCuadro.delete(fn); },
    /** Posición en pantalla (px, relativo al contenedor) de un punto 3D, o null si está detrás de la cámara */
    aPantalla(v) {
      const p = v.clone().project(camara);
      if (p.z > 1) return null;
      return { x: (p.x * 0.5 + 0.5) * cont.clientWidth, y: (-p.y * 0.5 + 0.5) * cont.clientHeight };
    },
    /** Rayo desde un punto de la pantalla (px) contra el piso (y = 0) → { x, z } o null */
    alPiso(px, py) {
      const r = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((px - r.left) / r.width) * 2 - 1, -((py - r.top) / r.height) * 2 + 1);
      const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, camara);
      const plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p = new THREE.Vector3();
      return ray.ray.intersectPlane(plano, p) ? { x: p.x, z: p.z } : null;
    },
    /**
     * Corre la imagen: dx > 0 mueve lo que mira la cámara a la izquierda, dy > 0 hacia arriba (fracciones de la pantalla).
     * Ej.: panel a la derecha que tapa 44 % → dx = 0.22; panel abajo que tapa 54 % → dy = 0.27.
     */
    correr(dx, dy) { corrimiento.x = dx; corrimiento.y = dy; aplicarCorrimiento(); camara.updateProjectionMatrix(); },
    get fps() { return fps.valor; },
    get calidad() { return calidad; },
    ponerCalidad(c) { if (CALIDADES[c]) { calidad = c; tamano(); } },
    tamano,
    /** Deja de dibujar (por ejemplo, mientras hay un juego abierto encima) o vuelve a dibujar */
    pausar(si) { detenido = !!si; if (!si) { fps.historial = []; fps.desde = 0; fps.cuadros = 0; } },
    /** Libera todo (al salir del juego): la memoria de la TV es poca */
    liberar() {
      vivo = false;
      window.removeEventListener("resize", tamano);
      document.removeEventListener("visibilitychange", alVer);
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      liberarFormas(); liberarMateriales(); liberarTexturas();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
