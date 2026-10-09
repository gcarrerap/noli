// Joystick virtual para el pulgar (teléfono y tableta). Es HTML encima del lienzo, no parte de la escena.
// Aparece donde se pone el dedo dentro de su zona (abajo a la izquierda), así no hay que atinarle a un círculo.
// fn({x, z}) con x hacia la derecha y z hacia abajo de la pantalla, largo de 0 a 1.

/**
 * @param {HTMLElement} zona elemento donde se puede tocar (se le agrega el dibujo del joystick)
 * @param {(dir: {x: number, z: number}) => void} fn
 * @returns {{ quitar: () => void, mostrar: (si: boolean) => void }}
 */
export function crearJoystick(zona, fn) {
  zona.innerHTML = `<div class="joy-base"><div class="joy-palanca"></div></div>`;
  const base = zona.querySelector(".joy-base"), palanca = zona.querySelector(".joy-palanca");
  const R = 48; // radio en px que recorre la palanca
  let id = null, cx = 0, cy = 0;
  const poner = (dx, dy) => {
    const d = Math.hypot(dx, dy), k = d > R ? R / d : 1;
    palanca.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    fn({ x: (dx * k) / R, z: (dy * k) / R });
  };
  const abajo = (e) => {
    if (id !== null) return;
    id = e.pointerId; zona.setPointerCapture(id);
    const r = zona.getBoundingClientRect();
    cx = e.clientX; cy = e.clientY;
    base.style.left = cx - r.left + "px"; base.style.top = cy - r.top + "px";
    zona.classList.add("activo");
    poner(0, 0);
    e.preventDefault();
  };
  const mueve = (e) => { if (e.pointerId === id) { poner(e.clientX - cx, e.clientY - cy); e.preventDefault(); } };
  const arriba = (e) => {
    if (e.pointerId !== id) return;
    id = null; zona.classList.remove("activo");
    palanca.style.transform = ""; base.style.left = base.style.top = "";
    fn({ x: 0, z: 0 });
  };
  zona.addEventListener("pointerdown", abajo);
  zona.addEventListener("pointermove", mueve);
  zona.addEventListener("pointerup", arriba);
  zona.addEventListener("pointercancel", arriba);
  return {
    quitar() { zona.innerHTML = ""; zona.removeEventListener("pointerdown", abajo); },
    mostrar(si) { zona.hidden = !si; if (!si && id !== null) arriba({ pointerId: id }); },
  };
}
