// Frases en español. La voz no lleva símbolos. «menos cuarto» sale solo de textos.js.
import { TEXTOS } from "./textos.js";
import { hora12, digital } from "./reloj.js";

const NOMBRES = ["", "una", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce"];
const MINUTOS = {
  5: "cinco", 10: "diez", 15: "quince", 20: "veinte", 25: "veinticinco", 30: "treinta",
  35: "treinta y cinco", 40: "cuarenta", 45: "cuarenta y cinco", 50: "cincuenta", 55: "cincuenta y cinco",
};

export function nombreHora(h) {
  const n = hora12(h);
  return n === 1 ? "la 1" : `las ${n}`;
}

function nombreVoz(h) {
  const n = hora12(h);
  return n === 1 ? "la una" : `las ${NOMBRES[n]}`;
}

// La hora que nombra «menos cuarto»: la siguiente, no la que marca la corta.
export function horaMenosCuarto(h) {
  const n = hora12(h) + 1;
  return n === 13 ? 1 : n;
}

export function fraseMenosCuarto(h) {
  const n = horaMenosCuarto(h);
  const art = n === 1 ? "La" : "Las";
  return `${art} ${n} ${TEXTOS.menosCuarto}`;
}

export function decirHora(h, m) {
  const base = nombreVoz(h);
  if (m === 0) return base;
  if (m === 15) return `${base} y cuarto`;
  if (m === 30) return `${base} y media`;
  if (m === 45) {
    const n = horaMenosCuarto(h);
    const art = n === 1 ? "la" : "las";
    return `${art} ${NOMBRES[n]} ${TEXTOS.menosCuarto}`;
  }
  return `${base} y ${MINUTOS[m] || String(m)}`;
}

const EN = ["twelve", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

// Etiqueta opcional, no se evalúa. Solo «y media».
export function etiquetaIngles(h, m) {
  if (m !== 30) return "";
  return `half past ${EN[hora12(h)]}`;
}

export function frasePoner(momento, h, m) {
  if (m === 45) return `${momento.que}. ${fraseMenosCuarto(h)}.`;
  if (m === 0) return `${momento.que} a ${nombreHora(h)}. Pon ${nombreHora(h)}.`;
  if (m === 30) return `${momento.que} a ${nombreHora(h)} y media.`;
  if (m === 15) return `${momento.que} a ${nombreHora(h)} y cuarto.`;
  return `${momento.que} a las ${digital(h, m)}.`;
}

export function vozPoner(momento, h, m) {
  if (m === 45) return `${momento.voz}. ${decirHora(h, m)}.`;
  if (m === 0) return `${momento.voz} a ${nombreVoz(h)}. Pon ${nombreVoz(h)}.`;
  return `${momento.voz} a ${decirHora(h, m)}.`;
}

export function fraseLeer() {
  return "¿Qué hora es?";
}
export function vozLeer() {
  return "¿Qué hora es?";
}

export function fraseMomento(momento, h, m) {
  return `${momento.que} a ${m === 45 ? fraseMenosCuarto(h).toLowerCase() : m === 0 ? nombreHora(h) : m === 30 ? `${nombreHora(h)} y media` : m === 15 ? `${nombreHora(h)} y cuarto` : `las ${digital(h, m)}`}. ¿Cuándo es?`;
}

export function vozMomento(momento, h, m) {
  return `${momento.voz} a ${decirHora(h, m)}. ¿Es de mañana, de tarde o de noche?`;
}

export function fraseCuanto(h0, m0, h1, m1) {
  return `Son las ${digital(h0, m0)}. ¿Cuánto falta para las ${digital(h1, m1)}?`;
}

export function vozCuanto(h0, m0, h1, m1) {
  return `Son ${decirHora(h0, m0)}. ¿Cuánto falta para ${decirHora(h1, m1)}?`;
}

export const EXITOS = ["¡A tiempo!", "¡Eso es!", "¡Muy bien!", "¡Justo así!"];

export function fraseExito(i) {
  const n = EXITOS.length;
  const k = ((i % n) + n) % n;
  return EXITOS[k];
}

export const OPCIONES_CUANTO = [
  { id: "cuarto", texto: "un cuarto" },
  { id: "media", texto: "media hora" },
  { id: "hora", texto: "1 hora" },
];

export const PARTES = [
  { id: "manana", texto: "mañana", arte: "opcion-manana" },
  { id: "tarde", texto: "tarde", arte: "opcion-tarde" },
  { id: "noche", texto: "noche", arte: "opcion-noche" },
];

const NUMEROS_VOZ = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce"];

export function vozNumero(n) {
  return NUMEROS_VOZ[n] || String(n);
}

// A dónde va la larga: el 12, el 6, el 3, el 9, o el número de minutos.
export function marcaLarga(m) {
  if (m === 0) return { texto: "el 12", voz: "el doce" };
  if (m === 30) return { texto: "el 6", voz: "el seis" };
  if (m === 15) return { texto: "el 3", voz: "el tres" };
  if (m === 45) return { texto: "el 9", voz: "el nueve" };
  return { texto: `el ${m}`, voz: `el ${MINUTOS[m] || m}` };
}
