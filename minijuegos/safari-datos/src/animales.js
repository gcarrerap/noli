// Ocho animales, en el orden fijo en el que se abren.
// La comida y el recinto vienen del arte de Petra.

export const ANIMALES = [
  { id: "mono", es: "mono", en: "monkey", plural: "monos", art: "el", comida: "platanos", recinto: "selva" },
  { id: "leon", es: "león", en: "lion", plural: "leones", art: "el", comida: "carne", recinto: "sabana" },
  { id: "jirafa", es: "jirafa", en: "giraffe", plural: "jirafas", art: "la", comida: "hojas", recinto: "sabana" },
  { id: "elefante", es: "elefante", en: "elephant", plural: "elefantes", art: "el", comida: "heno", recinto: "sabana" },
  { id: "cebra", es: "cebra", en: "zebra", plural: "cebras", art: "la", comida: "heno", recinto: "sabana" },
  { id: "hipopotamo", es: "hipopótamo", en: "hippo", plural: "hipopótamos", art: "el", comida: "sandia", recinto: "agua" },
  { id: "pinguino", es: "pingüino", en: "penguin", plural: "pingüinos", art: "el", comida: "pescado", recinto: "hielo" },
  { id: "flamenco", es: "flamenco", en: "flamingo", plural: "flamencos", art: "el", comida: "pescado", recinto: "agua" },
];

export const ORDEN = ANIMALES.map((a) => a.id);

export const COLORES = ["coral", "azul", "verde", "morado"];
export const COLOR_HEX = {
  coral: "#ff6b4a",
  azul: "#4cb3ff",
  verde: "#3ccf8e",
  morado: "#c86bfa",
};

export function animal(id) {
  return ANIMALES.find((a) => a.id === id) || ANIMALES[0];
}

export function colorDe(i) {
  return COLORES[i % COLORES.length];
}

export function nombreEs(id) {
  const a = animal(id);
  return a.es.charAt(0).toUpperCase() + a.es.slice(1);
}

// Lo que se lee al tocar el nombre en inglés (el texto en pantalla sigue en HTML).
export function fraseIngles(id) {
  const a = animal(id);
  return `${nombreEs(id)}. ${a.en}.`;
}

export function conArticulo(id) {
  const a = animal(id);
  return `${a.art} ${a.es}`;
}
