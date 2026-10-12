// Armar una misión: 3 textos (de los 4 de la misión), 3 palabras espaciales y la actividad de la Luna.
// Todo el azar llega en `rnd` (con semilla en las pruebas y en el reto).
import { revolver } from "./rng.js";
import { crearCalendario, crearNoche } from "./luna.js";

export const TEXTOS_POR_MISION = 3;
export const PALABRAS_POR_MISION = 3;
export const ITEMS = TEXTOS_POR_MISION + PALABRAS_POR_MISION + 1;   // + la actividad de la Luna

// Una pregunta con sus opciones revueltas. `buena` es el índice (ya revuelto) de la correcta; cada opción
// guarda `k`, su índice en el JSON (para su grabación).
export function armarPregunta(texto, rnd) {
  const p = texto.pregunta;
  const opciones = revolver(rnd, p.opciones.map((o, k) => ({ ...o, k })));
  return { ...p, opciones, buena: opciones.findIndex((o) => o.k === p.correcta) };
}

// Las palabras del viaje: las de la misión, pero una que falló antes (la más vieja del repaso que no esté ya)
// toma el lugar de la última. Así las que falla regresan.
export function palabrasDelViaje(def, repaso = []) {
  const base = [...def.palabras];
  const vuelve = repaso.find((w) => !base.includes(w));
  if (vuelve) base[base.length - 1] = vuelve;
  return base;
}

// ¿Se pueden confundir? (vocabulario.json → parecidas: no salen juntas como opciones)
export const parecidas = (vocab, a, b) => (vocab.parecidas || []).some(([x, y]) => (x === a && y === b) || (x === b && y === a));

// Una palabra para emparejar con su dibujo: ella y 2 dibujos de otras palabras que no se le parezcan.
export function crearPalabra(id, vocab, rnd) {
  const otras = revolver(rnd, vocab.palabras.map((p) => p.id).filter((x) => x !== id && !parecidas(vocab, id, x))).slice(0, 2);
  return { id, opciones: revolver(rnd, [id, ...otras]) };
}

export function crearMision(def, vocab, { repaso = [], rnd }) {
  const textos = revolver(rnd, def.textos).slice(0, TEXTOS_POR_MISION).map((t) => ({ ...t, pregunta: armarPregunta(t, rnd) }));
  const palabras = palabrasDelViaje(def, repaso).map((w) => crearPalabra(w, vocab, rnd));
  const luna = def.luna.tipo === "noche" ? crearNoche(def.luna, rnd) : crearCalendario(def.luna, rnd);
  return { n: def.n, nombre: def.nombre, textos, palabras, luna };
}

// 0–3 estrellas por los aciertos a la primera de los 7 pasos (3 textos, 3 palabras y la Luna).
export function estrellasMision(aciertos) {
  return aciertos >= 6 ? 3 : aciertos >= 4 ? 2 : aciertos >= 2 ? 1 : 0;
}
