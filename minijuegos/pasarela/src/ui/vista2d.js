// La vista 2D (modo sencillo): para aparatos sin WebGL o que van muy lentos con el 3D. Misma interfaz que vista3d.js,
// pero sin caminar: las zonas del estudio se vuelven botones (la interfaz los dibuja porque `botones` es true) y la
// pasarela es una animación de la muñeca en SVG. Ver docs/RENDIMIENTO.md § Respaldo 2D.
import { dibujarMuneca } from "./dibujo2d.js";

/**
 * @param {HTMLElement} cont
 * @param {object} idx
 * @param {{ piel: string, alZona: Function, reducirMovimiento?: boolean }} op
 */
export function crearVista2d(cont, idx, op) {
  const raiz = document.createElement("div");
  raiz.className = "vista2d";
  raiz.innerHTML = `<div class="escenario2d"><div class="muneca2d" id="muneca2d"></div></div>`;
  cont.appendChild(raiz);
  const caja = raiz.querySelector("#muneca2d");
  let atuendo = null, piel = op.piel, modo = "inicio";
  const dibujar = () => { if (atuendo) caja.innerHTML = dibujarMuneca(atuendo, idx, { piel, base: idx.config.colorBase, titulo: "Tu personaje" }); };
  const fns = new Set();
  let vivo = true;
  (function ciclo(t) { if (!vivo) return; requestAnimationFrame(ciclo); for (const f of fns) f(0.016, t); })(0);

  return {
    tipo: "2d",
    botones: true, // la interfaz enseña las zonas como botones (no hay que caminar)
    vestir(a) { atuendo = a; dibujar(); },
    ponerPiel(hex) { piel = hex; dibujar(); },
    modo(m) { modo = m; raiz.dataset.modo = m; raiz.classList.remove("desfilando"); },
    mover() {},
    irA() { return Promise.resolve(); },
    irAPunto() {},
    alPiso: () => null,
    espejo() { caja.classList.remove("vuelta"); void caja.offsetWidth; caja.classList.add("vuelta"); },
    desfilar() {
      caja.className = "muneca2d";
      raiz.classList.remove("desfilando"); void raiz.offsetWidth; raiz.classList.add("desfilando");
      return new Promise((r) => setTimeout(r, op.reducirMovimiento ? 1200 : 3000));
    },
    /** Las otras modelos (#90): en el modo sencillo no desfilan (salen en el podio de la calificación) */
    rivales() { return Promise.resolve(); },
    saltarRivales() {},
    /** Pose o baile: una animación CSS por id (estilo.css → .pose-<id>) */
    posar(id) { caja.className = "muneca2d pose-" + id; },
    terminarDesfile() { return new Promise((r) => setTimeout(r, op.reducirMovimiento ? 300 : 900)); },
    regresar() { raiz.classList.remove("desfilando"); caja.className = "muneca2d"; },
    enfocar() {},
    girar() {},
    letreros: () => new Map(),
    cadaCuadro(fn) { fns.add(fn); return () => fns.delete(fn); },
    get cercana() { return null; },
    get fps() { return 60; },
    get info() { return { dibujos: 0, triangulos: 0 }; },
    get calidad() { return "2d"; },
    ponerCalidad() {},
    liberar() { vivo = false; raiz.remove(); },
  };
}
