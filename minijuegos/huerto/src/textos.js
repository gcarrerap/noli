// Palabras que guillermo puede cambiar en un solo lugar.
// Nones: alternativa «impar» / «impares».
export const TEXTOS = {
  non: "non",
  nones: "nones",
  par: "par",
  pares: "pares",
};

export const capital = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

export function preguntaPar(n) {
  return `¿${n} es ${TEXTOS.par} o ${TEXTOS.non}?`;
}
