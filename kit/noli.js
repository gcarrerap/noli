// Kit para minijuegos de Noli. Un juego lo importa con una ruta relativa:
//
//   import { Noli } from "../../kit/noli.js";
//   Noli.alEntrar((accion) => { … });    // "arriba" | "abajo" | "izquierda" | "derecha" | "ok" | "atras"
//   const datos = await Noli.datos;      // lo que el juego guardó la última vez (o null)
//   Noli.guardar(datos);                 // guardar el progreso (objeto JSON)
//   Noli.terminar({ estrellas: 3 });     // al terminar una partida
//   Noli.salir();                        // regresar al catálogo
//
// Dentro del catálogo (en un iframe) las acciones llegan del catálogo, que ya juntó dedo, teclado, control de
// la TV y teléfono remoto, y el catálogo guarda los datos (así después se pueden sincronizar entre dispositivos
// sin cambiar los juegos). Abierto solo (sin catálogo) el juego funciona igual: el kit escucha el teclado,
// guarda en localStorage y "salir" regresa a la página anterior.
import { mensaje, esMensaje, estrellas as aEstrellas } from "./protocolo.js";
import { teclaAAccion } from "./teclas.js";
export { moverFoco, focoInicial } from "./foco.js";

const enCatalogo = typeof window !== "undefined" && window.parent && window.parent !== window;
const oyentes = new Set();
let modo = "tactil";

// Clave para guardar cuando el juego está abierto solo: la carpeta del juego
const claveSola = () => "noli.solo." + location.pathname.replace(/[^/]*$/, "");

let resolverDatos;
const datos = new Promise((r) => (resolverDatos = r));
if (!enCatalogo && typeof window !== "undefined") {
  try { resolverDatos(JSON.parse(localStorage.getItem(claveSola()))); } catch { resolverDatos(null); }
}

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
    if (e.data.tipo === "hola") {
      modo = e.data.modo || "tactil"; document.documentElement.dataset.modo = modo;
      resolverDatos(e.data.datos ?? null);
    }
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
  // fn(accion) → devuelve true si el juego usó "atras" para algo propio (regresar a su menú, por ejemplo)
  alEntrar(fn) { oyentes.add(fn); return () => oyentes.delete(fn); },
  // Promesa con los datos guardados (null la primera vez)
  datos,
  guardar(d) {
    if (enCatalogo) aCatalogo(mensaje("guardar", { datos: d }));
    else try { localStorage.setItem(claveSola(), JSON.stringify(d)); } catch {}
  },
  terminar({ estrellas = 0 } = {}) { aCatalogo(mensaje("terminar", { estrellas: aEstrellas(estrellas) })); },
  salir() { if (enCatalogo) aCatalogo(mensaje("salir")); else history.back(); },
  // "tactil" o "tv": en la TV conviene letra más grande y no depender del dedo
  get modo() { return modo; },
  get enCatalogo() { return enCatalogo; },
};

aCatalogo(mensaje("listo"));
