// Voz del navegador, en español de México. Si no hay voz, el texto sigue en pantalla.
// Nunca hay que pasarle símbolos (▲, ▼, +): se leen mal en voz alta.

export function callar() {
  const s = typeof window !== "undefined" ? window.speechSynthesis : null;
  try { if (s?.speaking) s.cancel(); } catch { /* sin voz */ }
}

// Devuelve true si la frase empezó a decirse. alTerminar corre al acabar (no si no hay voz).
export function decir(texto, lang, alTerminar) {
  const s = typeof window !== "undefined" ? window.speechSynthesis : null;
  const U = typeof window !== "undefined" ? window.SpeechSynthesisUtterance : null;
  if (!s || !U || !texto) return false;
  try {
    const u = new U(texto);
    u.lang = lang || "es-MX";
    u.rate = 0.92;
    if (typeof alTerminar === "function") u.onend = () => alTerminar();
    s.speak(u);
    return true;
  } catch { /* la tele a veces no tiene voces */
    return false;
  }
}
