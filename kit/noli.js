// Kit para minijuegos de Noli. Un juego lo importa con una ruta relativa:
//
//   import { Noli } from "../../kit/noli.js";
//   Noli.alEntrar((accion) => { … });    // "arriba" | "abajo" | "izquierda" | "derecha" | "ok" | "atras"
//   const datos = await Noli.datos;      // lo que el juego guardó la última vez (o null)
//   Noli.guardar(datos);                 // guardar el progreso (objeto JSON)
//   Noli.terminar({ estrellas: 3 });     // al terminar una partida (reto: true si fue el reto del día completado)
//   const saldo = await Noli.creditos;   // créditos de Noelia (solo juegos con "creditos": "gasta"; si no, null)
//   const { ok, saldo } = await Noli.gastar(3, "pasarela");  // cobrar créditos (#20); ok=false si no alcanza
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

let resolverDatos, resolverCreditos;
const datos = new Promise((r) => (resolverDatos = r));
const creditos = new Promise((r) => (resolverCreditos = r));

// Abierto solo (sin catálogo) los créditos se simulan, para poder probar un juego que los gasta.
// Se pueden cambiar en la consola: localStorage.setItem("noli.solo.creditos", "20")
const CREDITOS_SOLO = "noli.solo.creditos", CREDITOS_SOLO_INICIAL = 10;
function creditosSolo() {
  try { const v = parseInt(localStorage.getItem(CREDITOS_SOLO), 10); return Number.isFinite(v) ? v : CREDITOS_SOLO_INICIAL; } catch { return CREDITOS_SOLO_INICIAL; }
}
if (!enCatalogo && typeof window !== "undefined") {
  try { resolverDatos(JSON.parse(localStorage.getItem(claveSola()))); } catch { resolverDatos(null); }
  resolverCreditos(creditosSolo());
}

// Gastos esperando respuesta del catálogo: id → resolver
const gastos = new Map();
let siguienteGasto = 0;
const ESPERA_GASTO_MS = 5000;

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
      resolverCreditos(typeof e.data.creditos === "number" ? e.data.creditos : null);
    }
    if (e.data.tipo === "gasto") {
      const r = gastos.get(e.data.id);
      if (r) { gastos.delete(e.data.id); r({ ok: e.data.ok, saldo: typeof e.data.saldo === "number" ? e.data.saldo : null }); }
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
  // reto: true cuando la partida fue el reto del día y se completó (el catálogo da el bono una vez al día)
  terminar({ estrellas = 0, reto = false } = {}) { aCatalogo(mensaje("terminar", { estrellas: aEstrellas(estrellas), reto: reto === true })); },
  // Promesa con el saldo de créditos (número), o null si el juego no declara "creditos": "gasta" en juego.json
  creditos,
  // Pide gastar `cantidad` créditos. Promesa con { ok, saldo }: ok=false si no alcanza o el catálogo no contestó
  // (en 5 s). El catálogo es el único que valida y descuenta; el juego nunca lleva la cuenta.
  gastar(cantidad, motivo = "") {
    if (!enCatalogo) {
      const s = creditosSolo();
      if (!(Number.isInteger(cantidad) && cantidad > 0) || s < cantidad) return Promise.resolve({ ok: false, saldo: s });
      try { localStorage.setItem(CREDITOS_SOLO, String(s - cantidad)); } catch {}
      return Promise.resolve({ ok: true, saldo: s - cantidad });
    }
    const id = "g" + (++siguienteGasto) + "-" + Date.now().toString(36);
    return new Promise((r) => {
      gastos.set(id, r);
      aCatalogo(mensaje("gastar", { id, cantidad, motivo: String(motivo).slice(0, 40) }));
      setTimeout(() => { if (gastos.has(id)) { gastos.delete(id); r({ ok: false, saldo: null }); } }, ESPERA_GASTO_MS);
    });
  },
  salir() { if (enCatalogo) aCatalogo(mensaje("salir")); else history.back(); },
  // "tactil" o "tv": en la TV conviene letra más grande y no depender del dedo
  get modo() { return modo; },
  get enCatalogo() { return enCatalogo; },
};

aCatalogo(mensaje("listo"));
