// Animales del zoológico. Los 4 primeros están desde el principio; los demás se abren uno por visita bien hecha,
// siempre en este orden. `f` = femenino («¿Cuántas jirafas…?»). El inglés va debajo, como extra.

export const ANIMALES = [
  { id: "mono", nombre: "Mono", plural: "monos", en: "monkey", enPlural: "monkeys", f: false, fondo: "#bfe6a0" },
  { id: "leon", nombre: "León", plural: "leones", en: "lion", enPlural: "lions", f: false, fondo: "#f6dc9a" },
  { id: "jirafa", nombre: "Jirafa", plural: "jirafas", en: "giraffe", enPlural: "giraffes", f: true, fondo: "#f9e7b8" },
  { id: "pinguino", nombre: "Pingüino", plural: "pingüinos", en: "penguin", enPlural: "penguins", f: false, fondo: "#cdeaf7" },
  { id: "elefante", nombre: "Elefante", plural: "elefantes", en: "elephant", enPlural: "elephants", f: false, fondo: "#e9d9bf" },
  { id: "cebra", nombre: "Cebra", plural: "cebras", en: "zebra", enPlural: "zebras", f: true, fondo: "#e4efb5" },
  { id: "flamenco", nombre: "Flamenco", plural: "flamencos", en: "flamingo", enPlural: "flamingos", f: false, fondo: "#cfe9f2" },
  { id: "tortuga", nombre: "Tortuga", plural: "tortugas", en: "turtle", enPlural: "turtles", f: true, fondo: "#d6eec4" },
  { id: "oso", nombre: "Oso", plural: "osos", en: "bear", enPlural: "bears", f: false, fondo: "#d9e8c8" },
  { id: "hipopotamo", nombre: "Hipopótamo", plural: "hipopótamos", en: "hippo", enPlural: "hippos", f: false, fondo: "#c7e3ef" },
  { id: "rana", nombre: "Rana", plural: "ranas", en: "frog", enPlural: "frogs", f: true, fondo: "#cdeccf" },
  { id: "buho", nombre: "Búho", plural: "búhos", en: "owl", enPlural: "owls", f: false, fondo: "#e2dcf2" },
];

export const BASE = 4;
export const NUEVOS = ANIMALES.length - BASE;

export function animal(id) {
  return ANIMALES.find((a) => a.id === id) || ANIMALES[0];
}

const tope = (zoo) => Math.max(0, Math.min(NUEVOS, zoo | 0));

// Los animales abiertos: los 4 de base más `zoo` nuevos.
export function abiertos(zoo) {
  return ANIMALES.slice(0, BASE + tope(zoo));
}

// El que se abre en la próxima visita bien hecha, o null si ya están todos.
export function siguiente(zoo) {
  return ANIMALES[BASE + tope(zoo)] || null;
}

// «monos» / «jirafas»; con 1, el singular en minúscula.
export const nombreDe = (a, n) => (n === 1 ? a.nombre.toLowerCase() : a.plural);

// «Cuántos» o «Cuántas»: concuerda con el primer animal que se nombra («¿Cuántas jirafas y monos…?»).
export const cuantosPara = (lista) => (lista.length && lista[0].f ? "Cuántas" : "Cuántos");
