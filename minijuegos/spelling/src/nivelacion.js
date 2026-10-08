// Prueba de nivel: un dictado corto para saber en qué lista empieza Noelia, sin aburrirla con lo que ya sabe.
//
// Dicta 2 palabras de una lista y sube de 2 en 2 (1, 3, 5, …) mientras las escriba bien las dos. Cuando falla
// una lista, prueba la anterior (si no la probó ya): si la pasa, empieza en la que falló; si no, en la anterior.
// Si pasa todas, empieza en la última. Son unas 8 a 14 palabras.
//
// Estado (puro): { lista, palabras: [{ palabra, frase, lista }], i, bien, probadas: { n: true|false }, fin: n|null }
import { LISTAS, lista as datosLista } from "./palabras.js";
import { revolver } from "./rng.js";

const POR_LISTA = 2;
const ULTIMA = LISTAS.length;

function probar(estado, n, rnd) {
  const palabras = revolver(rnd, datosLista(n).palabras).slice(0, POR_LISTA).map((p) => ({ ...p, lista: n }));
  return { ...estado, lista: n, palabras, i: 0, bien: 0 };
}

export function empezarPrueba(rnd, desde = 1) {
  return probar({ probadas: {}, fin: null, total: 0 }, desde, rnd);
}

export const palabraActual = (e) => e.palabras[e.i];

// Registra una respuesta y devuelve el estado siguiente (con fin = lista donde empieza, al terminar)
export function responderPrueba(e, ok, rnd) {
  e = { ...e, i: e.i + 1, bien: e.bien + (ok ? 1 : 0), total: e.total + 1 };
  if (e.i < e.palabras.length) return e;
  const n = e.lista, paso = e.bien === POR_LISTA;
  const probadas = { ...e.probadas, [n]: paso };
  e = { ...e, probadas };
  if (paso) {
    // ¿Ya había fallado la de arriba? (venimos bajando) → empieza en esa
    if (probadas[n + 1] === false) return { ...e, fin: n + 1 };
    if (n >= ULTIMA) return { ...e, fin: ULTIMA };
    return probar(e, Math.min(ULTIMA, n + 2), rnd);
  }
  if (n === 1) return { ...e, fin: 1 };
  if (probadas[n - 1] === true) return { ...e, fin: n };      // la de abajo ya la pasó
  return probar(e, n - 1, rnd);                               // probar la de abajo
}
