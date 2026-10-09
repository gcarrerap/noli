// Todos los textos que ve o oye Noelia, en un solo lugar.
// Las instrucciones van en español. El contenido (las palabras) va en inglés.

export const SALIR = { titulo: "¿Salir?", seguir: "Seguir", salir: "Salir" };

export const CAJAS = {
  noun: { nombre: "Pieza", ingles: "noun", pista: "cosa", tecla: "izquierda", simbolo: "◀" },
  verb: { nombre: "Moverse", ingles: "verb", pista: "acción", tecla: "abajo", simbolo: "▼" },
  adjective: { nombre: "Cómo es", ingles: "adjective", pista: "cómo es", tecla: "derecha", simbolo: "▶" },
};

export const NIVELES = [
  { n: 1, nombre: "Pieza o moverse" },
  { n: 2, nombre: "Cómo es" },
  { n: 3, nombre: "Más de uno" },
  { n: 4, nombre: "Especiales" },
  { n: 5, nombre: "Ayer" },
  { n: 6, nombre: "Ayer especial" },
  { n: 7, nombre: "Oraciones" },
];

export const GUIA = {
  1: { texto: "Arma tu robot.", voz: "Arma tu robot." },
  2: { texto: "Pieza, moverse, cómo es.", voz: "Pieza, moverse, cómo es." },
  3: {
    texto: "Head es una pieza.",
    textoTv: "Head es una pieza. Pulsa ◀.",
    voz: "Head es una pieza.",
    vozTv: "Head es una pieza. Pulsa izquierda.",
  },
  4: {
    texto: "Jump es moverse.",
    textoTv: "Jump es moverse. Pulsa ▼.",
    voz: "Jump es moverse.",
    vozTv: "Jump es moverse. Pulsa abajo.",
  },
  5: { texto: "¡Tu robot salta!", voz: "Tu robot salta." },
};

export const PISTAS = {
  corta: "Escucha otra vez.",
  pieza: (palabra) => `${capital(palabra)} es una pieza.`,
  moverse: (palabra) => `${capital(palabra)} es moverse.`,
  como: (palabra) => `${capital(palabra)} es cómo es.`,
};

export const UI = {
  titulo: "Robot de Palabras",
  jugar: "Jugar",
  como: "¿Cómo se juega?",
  saltar: "Saltar",
  reto: "Puerta secreta",
  retoMeta: "6 puertas. Meta: 4.",
  vozSi: "Voz: sí",
  vozNo: "Voz: no",
  quitar: "Quitar",
  probar: "Probar",
  escuchar: "Escuchar",
  seguir: "Seguir",
  otro: "Otro turno",
  inicio: "El taller",
  otraVez: "Otra vez",
  brillaTactil: "¡Brilla! Toca Probar.",
  brillaTv: "¡Brilla! Pulsa OK.",
  brillaVozTactil: "Brilla. Toca Probar.",
  brillaVozTv: "Brilla. Pulsa OK.",
  miraEse: "Mira la s.",
  duda: "Falta moverse.",
  risa: "El robot se ríe: va al revés.",
  piezaNueva: "Ganaste una pieza.",
  rachaCero: "Cumple el reto de hoy para empezar una racha",
  yaReto: "¡Ya lo cumpliste hoy! Puedes jugarlo otra vez.",
  aunNo: "Hoy todavía no. ¡Inténtalo otra vez!",
  retoHecho: "¡Reto cumplido!",
  retoCasi: "¡Casi!",
  subiste: "¡Subiste de nivel!",
};

export const FRASES = ["¡Buen intento!", "¡Bien hecho!", "¡Muy bien!", "¡Perfecto!"];

export const PIEZAS = {
  "ruedas-2": "orugas",
  "cabeza-2": "cabeza de cúpula",
  "antena-2": "hélice",
  "cuerpo-2": "cuerpo redondo",
  "brazos-2": "pinzas",
  "piernas-1": "piernas",
  "cabeza-3": "cabeza de tele",
  "antena-3": "corona",
  "cuerpo-3": "cuerpo de botones",
  "brazos-3": "brazos de acordeón",
};

function capital(palabra) {
  const s = String(palabra || "");
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function textoGuia(paso, tv) {
  const g = GUIA[paso] || GUIA[1];
  if (tv && g.textoTv) return g.textoTv;
  return g.texto;
}

export function vozGuia(paso, tv) {
  const g = GUIA[paso] || GUIA[1];
  if (tv && g.vozTv) return g.vozTv;
  return g.voz;
}

export function pistaCompleta(palabra, categoria) {
  if (categoria === "verb") return PISTAS.moverse(palabra);
  if (categoria === "adjective") return PISTAS.como(palabra);
  return PISTAS.pieza(palabra);
}

export function textoRacha(dias) {
  const n = dias | 0;
  if (!n) return UI.rachaCero;
  return `Racha: ${n} ${n === 1 ? "día" : "días"}`;
}
