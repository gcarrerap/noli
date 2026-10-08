// Textos e íconos que ve Noelia. Las materias vienen de los manifiestos; aquí solo se les pone cara.
const MATERIAS = {
  "números": "🔢", "matemáticas": "➕", "letras": "🔤", "lectura": "📖", "inglés": "🗣️",
  "colores": "🎨", "formas": "🔺", "memoria": "🧠", "música": "🎵", "ciencia": "🔬", "otros": "🎲",
};

export const iconoMateria = (m) => MATERIAS[m] || "🎲";
export const nombreMateria = (m) => (m ? m.charAt(0).toUpperCase() + m.slice(1) : "Todos");

export function estrellasHtml(n, max = 3) {
  let s = "";
  for (let i = 0; i < max; i++) s += `<span class="${i < n ? "on" : "off"}">★</span>`;
  return `<span class="estrellas" aria-label="${n} de ${max} estrellas">${s}</span>`;
}

export const FELICITACION = ["¡Buen intento!", "¡Bien hecho!", "¡Muy bien!", "¡Excelente!"];
