// Decir en voz alta el nombre de una prenda o un color en inglés ("pink T-shirt") con la voz del navegador.
// Es un extra: si el aparato no tiene voz (algunas TVs, DuckDuckGo), el texto en inglés siempre se ve escrito y
// el botón de la bocina no aparece. (Spelling usa grabaciones porque ahí la voz es indispensable; aquí no.)

/** ¿Este navegador puede hablar? */
export const hayVoz = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance === "function";

let vozEn = null;
function buscarVoz() {
  if (!hayVoz()) return null;
  const voces = speechSynthesis.getVoices();
  return voces.find((v) => /^en[-_]US/i.test(v.lang)) || voces.find((v) => /^en/i.test(v.lang)) || null;
}

/**
 * Dice un texto en inglés (corta lo que estuviera diciendo).
 * @param {string} texto
 */
export function decir(texto) {
  if (!hayVoz()) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    vozEn = vozEn || buscarVoz();
    if (vozEn) u.voice = vozEn;
    u.lang = "en-US"; u.rate = 0.85;
    speechSynthesis.speak(u);
  } catch (e) { /* sin voz: no pasa nada, el texto se ve escrito */ }
}
