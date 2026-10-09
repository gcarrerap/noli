// Números en palabras. El juego base es en español y cuenta para subir de nivel.
// El inglés es solo el sello opcional (no cuenta para el dominio).

const UNOS = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
const DIECIS = ["diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve"];
const VEINTIS = ["veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
const DECAS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CIENTOS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

const EN_ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const EN_TEENS = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

export function digitos(n) {
  if (n === 1000) return { c: 10, d: 0, u: 0 };
  return { c: Math.floor(n / 100), d: Math.floor(n / 10) % 10, u: n % 10 };
}

export function tieneCero(n) {
  return String(n).includes("0");
}

export function enPalabras(n) {
  if (n === 1000) return "mil";
  if (n === 0) return "cero";
  if (n === 100) return "cien";
  const c = Math.floor(n / 100), r = n % 100;
  const cien = c === 0 ? "" : CIENTOS[c];
  let resto = "";
  if (r < 10) resto = r === 0 ? "" : UNOS[r];
  else if (r < 20) resto = DIECIS[r - 10];
  else if (r < 30) resto = VEINTIS[r - 20];
  else {
    const d = Math.floor(r / 10), u = r % 10;
    resto = u === 0 ? DECAS[d] : `${DECAS[d]} y ${UNOS[u]}`;
  }
  return [cien, resto].filter(Boolean).join(" ");
}

// 300 + 40 + 7. Sin ceros: las partes de 0 no se escriben.
export function desarrollada(n) {
  const { c, d, u } = digitos(n === 1000 ? 1000 : n);
  if (n === 1000) return "1000";
  const partes = [c * 100, d * 10, u].filter((x) => x > 0);
  return partes.join(" + ") || "0";
}

// Centenas regulares (no quinientos / setecientos / novecientos) y decena exacta
// (doscientos treinta, ciento veinte). Sin unidades.
export function esDecenaExactaRegular(n) {
  if (n < 100 || n > 999) return false;
  const c = Math.floor(n / 100), d = Math.floor(n / 10) % 10, u = n % 10;
  if (c === 5 || c === 7 || c === 9) return false;
  return d >= 2 && d <= 9 && u === 0;
}

// Irregulares que se dejan para el final del nivel 4: quinientos, setecientos,
// novecientos, dieciséis y la familia de veintiuno.
export function esIrregular(n) {
  if (n < 0 || n > 1000) return false;
  const c = Math.floor(n / 100);
  const r = n % 100;
  if (c === 5 || c === 7 || c === 9) return true;
  if (r === 16) return true;
  if (r >= 21 && r <= 29) return true;
  return false;
}

export function enIngles(n) {
  if (n === 1000) return "one thousand";
  if (n === 0) return "zero";
  const c = Math.floor(n / 100), r = n % 100;
  const cien = c === 0 ? "" : `${EN_ONES[c]} hundred`;
  let resto = "";
  if (r === 0) resto = "";
  else if (r < 10) resto = EN_ONES[r];
  else if (r < 20) resto = EN_TEENS[r - 10];
  else {
    const d = Math.floor(r / 10), u = r % 10;
    resto = u === 0 ? EN_TENS[d] : `${EN_TENS[d]}-${EN_ONES[u]}`;
  }
  return [cien, resto].filter(Boolean).join(" ");
}
