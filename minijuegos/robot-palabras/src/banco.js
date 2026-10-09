// Etiquetas del banco de Spelling. Se lee el banco; no se modifica.
// Si la forma no está grabada, la voz del sistema en inglés la dice.
import { buscar } from "../../spelling/src/palabras.js";

export const AMBIGUAS = ["jump", "spin", "run", "kick", "drink", "watch"];

export const SUSTANTIVOS = [
  { id: "cat", dibujo: "cat" },
  { id: "dog", dibujo: "dog" },
  { id: "ball", dibujo: "ball" },
  { id: "head", dibujo: "head" },
  { id: "wheel", dibujo: "wheel" },
  { id: "arm", dibujo: "arm" },
  { id: "bus", dibujo: "bus" },
  { id: "box", dibujo: "box" },
  { id: "dish", dibujo: "dish" },
  { id: "fish", dibujo: "fish" },
  { id: "mouse", dibujo: "mouse" },
  { id: "sheep", dibujo: "sheep" },
];

export const VERBOS = [
  { id: "eat", dibujo: "eat" },
  { id: "sit", dibujo: "sit" },
  { id: "swim", dibujo: "swim" },
  { id: "sing", dibujo: "sing" },
];

export const ADJETIVOS = [
  { id: "big", dibujo: "big" },
  { id: "tiny", dibujo: "tiny" },
  { id: "red", dibujo: "red" },
  { id: "shiny", dibujo: "shiny" },
  { id: "fast", dibujo: "fast" },
  { id: "slow", dibujo: "slow" },
];

export const PLURALES_S = [
  par("cat", "cats", "cat", "s", 2, "gatos"),
  par("dog", "dogs", "dog", "s", 2, "perros"),
  par("ball", "balls", "ball", "s", 2, "pelotas"),
  par("head", "heads", "head", "s", 2, "cabezas"),
  par("wheel", "wheels", "wheel", "s", 2, "ruedas"),
  par("arm", "arms", "arm", "s", 2, "brazos"),
];

export const PLURALES_ES = [
  par("bus", "buses", "bus", "es", 2, "buses"),
  par("dish", "dishes", "dish", "es", 2, "platos"),
  par("box", "boxes", "box", "es", 2, "cajas"),
  par("watch", "watches", "watch", "es", 2, "relojes"),
];

export const PLURALES_IRR = [
  par("mouse", "mice", "mouse", "irregular", 2, "ratones"),
  par("foot", "feet", "foot", "irregular", 2, "pies"),
  par("tooth", "teeth", "tooth", "irregular", 2, "dientes"),
  par("child", "children", "child", "irregular", 2, "niños"),
  par("man", "men", "man", "irregular", 2, "hombres"),
  par("woman", "women", "woman", "irregular", 2, "mujeres"),
  par("person", "people", "child", "irregular", 3, "personas"),
  par("goose", "geese", "goose", "irregular", 2, "gansos"),
  par("fish", "fish", "fish", "irregular", 2, "peces"),
  par("sheep", "sheep", "sheep", "irregular", 2, "ovejas"),
];

export const PASADOS_ED = [
  pasado("jump", "jumped", "jump", "t"),
  pasado("kick", "kicked", "kick", "t"),
  pasado("play", "played", "play", "d"),
  pasado("paint", "painted", "paint", "id"),
  pasado("want", "wanted", "want", "id"),
];

export const PASADOS_IRR = [
  pasado("run", "ran", "run"),
  pasado("eat", "ate", "eat"),
  pasado("see", "saw", "see"),
  pasado("go", "went", "go"),
  pasado("come", "came", "come"),
  pasado("sit", "sat", "sit"),
  pasado("get", "got", "get"),
  pasado("have", "had", "have"),
  pasado("make", "made", "make"),
  pasado("say", "said", "say"),
  pasado("take", "took", "take"),
  pasado("sing", "sang", "sing"),
];

export const ORACIONES = [
  { adj: "tiny", verbo: "jumps", base: "jump", dibujo: "jump", dibujoAdj: "tiny" },
  { adj: "red", verbo: "runs", base: "run", dibujo: "run", dibujoAdj: "red" },
  { adj: "big", verbo: "eats", base: "eat", dibujo: "eat", dibujoAdj: "big" },
  { adj: "shiny", verbo: "sits", base: "sit", dibujo: "sit", dibujoAdj: "shiny" },
  { adj: "fast", verbo: "swims", base: "swim", dibujo: "swim", dibujoAdj: "fast" },
  { adj: "slow", verbo: "sings", base: "sing", dibujo: "sing", dibujoAdj: "slow" },
];

export const TERCERA = new Set(ORACIONES.map((o) => o.verbo).concat(["spins", "kicks", "drinks", "plays", "paints"]));

const TAMBIEN = {
  fish: ["fishes"],
  fishes: ["fish"],
  sheep: ["sheeps"],
  sheeps: ["sheep"],
};

function par(base, plural, dibujo, clase, copias, glosa) {
  return {
    id: plural,
    base,
    plural,
    dibujo,
    clase,
    copias: copias || 2,
    glosa: glosa || "",
    premio: `one ${base}, two ${plural}`,
  };
}

const PASADO_DE = {
  jump: "jumped", kick: "kicked", play: "played", paint: "painted", want: "wanted",
  run: "ran", eat: "ate", see: "saw", go: "went", come: "came", sit: "sat",
  get: "got", have: "had", make: "made", say: "said", take: "took", sing: "sang",
  swim: "swam", spin: "spun", drink: "drank",
};

const TERCERA_ESP = { have: "has", go: "goes" };

export function articulo(base) {
  return /^[aeiou]/i.test(String(base || "")) ? "an" : "a";
}

export function conArticulo(base) {
  return `${articulo(base)} ${base}`;
}

export function terceraDe(base) {
  const b = String(base || "");
  if (TERCERA_ESP[b]) return TERCERA_ESP[b];
  if (/(?:ch|sh|s|x|o)$/i.test(b)) return `${b}es`;
  if (/[^aeiou]y$/i.test(b)) return `${b.slice(0, -1)}ies`;
  return `${b}s`;
}

export function pasadoDe(base) {
  return PASADO_DE[base] || "";
}

function pasado(base, forma, dibujo, sonido) {
  return { id: forma, base, pasado: forma, dibujo, sonido: sonido || null, clase: sonido ? "ed" : "irregular" };
}

export function tieneGrabacion(palabra) {
  return !!buscar(String(palabra || "").toLowerCase());
}

export function formasPasado() {
  return new Set([
    ...PASADOS_ED.map((p) => p.pasado),
    ...PASADOS_IRR.map((p) => p.pasado),
  ]);
}

export function formasPasadoIrregular() {
  return new Set(PASADOS_IRR.map((p) => p.pasado));
}

export function tambienCorrecta(buena, otra) {
  if (!buena || !otra) return false;
  if (buena === otra) return true;
  return (TAMBIEN[buena] || []).includes(otra);
}

export function pideEs(base) {
  return /(?:sh|ch|s|x)$/i.test(base);
}

export function dibujosUsados() {
  const ids = new Set();
  for (const lista of [SUSTANTIVOS, VERBOS, ADJETIVOS, PLURALES_S, PLURALES_ES, PLURALES_IRR, PASADOS_ED, PASADOS_IRR]) {
    for (const item of lista) ids.add(item.dibujo);
  }
  for (const o of ORACIONES) { ids.add(o.dibujo); ids.add(o.dibujoAdj); }
  for (const id of AMBIGUAS) ids.add(id);
  return [...ids];
}
