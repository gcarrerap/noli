// Kit para minijuegos de Noli. Un juego lo importa con una ruta relativa:
//
//   import { Noli } from "../../kit/noli.js";
//   Noli.alEntrar((accion) => { … });    // "arriba" | "abajo" | "izquierda" | "derecha" | "ok" | "atras"
//   Noli.terminar({ estrellas: 3 });     // al terminar una partida
//   Noli.salir();                        // regresar al catálogo
//
// Dentro del catálogo (en un iframe) las acciones llegan del catálogo, que ya juntó dedo, teclado, control de
// la TV y teléfono remoto. Abierto solo (sin catálogo) el juego funciona igual: el kit escucha el teclado y
// "salir" regresa a la página anterior. Así cada juego se puede probar por separado o vivir en su propio repo.
import { mensaje, esMensaje, estrellas as aEstrellas } from "./protocolo.js";
import { teclaAAccion } from "./teclas.js";

const enCatalogo = typeof window !== "undefined" && window.parent && window.parent !== window;
const oyentes = new Set();
let modo = "tactil";

function emitir(accion) {
  let atendida = false;
  for (const fn of oyentes) if (fn(accion) === true) atendida = true;
  // "atras" sin atender (ningún oyente devolvió true) = salir del juego
  if (accion === "atras" && !atendida) Noli.salir();
}

function aCatalogo(m) {
  if (enCatalogo) window.parent.postMessage(m, location.origin);
}

if (typeof window !== "undefined") {
  window.addEventListener("message", (e) => {
    if (e.source !== window.parent || e.origin !== location.origin || !esMensaje(e.data)) return;
    if (e.data.tipo === "hola") { modo = e.data.modo || "tactil"; document.documentElement.dataset.modo = modo; }
    if (e.data.tipo === "entrada") emitir(e.data.accion);
  });
  // Con el foco dentro del juego, las teclas llegan aquí y no al catálogo
  window.addEventListener("keydown", (e) => {
    const accion = teclaAAccion(e);
    if (!accion) return;
    e.preventDefault();
    emitir(accion);
  });
}

export const Noli = {
  // fn(accion) → devuelve true si el juego usó "atras" para algo propio (cerrar una ventana, por ejemplo)
  alEntrar(fn) { oyentes.add(fn); return () => oyentes.delete(fn); },
  terminar({ estrellas = 0 } = {}) { aCatalogo(mensaje("terminar", { estrellas: aEstrellas(estrellas) })); },
  salir() { if (enCatalogo) aCatalogo(mensaje("salir")); else history.back(); },
  // "tactil" o "tv": en la TV conviene letra más grande y no depender del dedo
  get modo() { return modo; },
  get enCatalogo() { return enCatalogo; },
};

aCatalogo(mensaje("listo"));
