// Voz del navegador, copiada de Fábrica. El juego la prende por omisión
// y la apaga si el progreso tiene la voz en no.
// Nunca se le pasan símbolos como ▲ o +.

const SIMBOLOS = /[\u25B2\u25BC\u25C0\u25B6\u2191\u2193\u2190\u2192+\u00D7\u2715\u2716]/g;

export function paraVoz(texto) {
  return String(texto ?? "").replace(SIMBOLOS, " ").replace(/\s+/g, " ").trim();
}

export function decir(texto, lang) {
  const limpio = paraVoz(texto);
  const s = typeof window !== "undefined" ? window.speechSynthesis : null;
  const U = typeof window !== "undefined" ? window.SpeechSynthesisUtterance : null;
  if (!s || !U || !limpio) return;
  try {
    if (s.speaking) s.cancel();
    const u = new U(limpio);
    u.lang = lang || "es-MX";
    u.rate = 0.92;
    s.speak(u);
  } catch { /* la tele a veces no tiene voces */ }
}
