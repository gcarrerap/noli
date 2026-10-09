// Concordancia en español para los comentarios de los jueces: el/la/los/las, un/una, perfecto/perfecta…
// Cada prenda dice su género ("m" | "f") y si es plural (plural: true) en prendas.json. Lógica pura.

/** "el" | "la" | "los" | "las" */
export const el = (p) => (p.plural ? (p.genero === "f" ? "las" : "los") : p.genero === "f" ? "la" : "el");
/** "un" | "una" | "unos" | "unas" */
export const un = (p) => (p.plural ? (p.genero === "f" ? "unas" : "unos") : p.genero === "f" ? "una" : "un");
/** Adjetivo que termina en -o: perfecto → perfecta, perfectos, perfectas */
export const concuerda = (adj, p) => adj.replace(/o$/, "") + (p.genero === "f" ? "a" : "o") + (p.plural ? "s" : "");
/** "es" | "son" */
export const es = (p) => (p.plural ? "son" : "es");
/** "queda" | "quedan" */
export const queda = (p) => (p.plural ? "quedan" : "queda");
/** "tu" | "tus" */
export const tu = (p) => (p.plural ? "tus" : "tu");
/** Primera letra en mayúscula */
export const mayuscula = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
/** "el vestido de fiesta" */
export const conEl = (p) => el(p) + " " + p.es;
/** "un sombrero de playa" */
export const conUn = (p) => un(p) + " " + p.es;
/** Une con comas e "y": ["a", "b", "c"] → "a, b y c" */
export function lista(xs) {
  if (xs.length <= 1) return xs.join("");
  return xs.slice(0, -1).join(", ") + " y " + xs[xs.length - 1];
}
