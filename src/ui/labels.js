// Textos que ve Noelia. Sin emojis: en la TV LG salen en blanco y negro (#5).
export const nombreMateria = (m) => (m ? m.charAt(0).toUpperCase() + m.slice(1) : "Todos");

export function estrellasHtml(n, max = 3) {
  let s = "";
  for (let i = 0; i < max; i++) s += `<span class="${i < n ? "on" : "off"}">★</span>`;
  return `<span class="estrellas" aria-label="${n} de ${max} estrellas">${s}</span>`;
}

export const FELICITACION = ["¡Buen intento!", "¡Bien hecho!", "¡Muy bien!", "¡Excelente!"];
