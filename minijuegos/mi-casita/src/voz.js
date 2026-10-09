// Voz del navegador, copiada de Fábrica. El juego la prende por omisión
// y la apaga si el progreso tiene la voz en no.
// Nunca se le pasan símbolos como ▲ o +.

const SIMBOLOS = /[\u25B2\u25BC\u25C0\u25B6\u2191\u2193\u2190\u2192+\u00D7\u2715\u2716]/g;

export function paraVoz(texto) {
  return String(texto ?? "").replace(SIMBOLOS, " ").replace(/\s+/g, " ").trim();
}

export function callar() {
  const s = typeof window !== "undefined" ? window.speechSynthesis : null;
  try { if (s && (s.speaking || s.pending)) s.cancel(); } catch { /* sin voz */ }
}

export function decir(texto, lang, onend) {
  const limpio = paraVoz(texto);
  const fin = () => { if (typeof onend === "function") onend(); };
  const s = typeof window !== "undefined" ? window.speechSynthesis : null;
  const U = typeof window !== "undefined" ? window.SpeechSynthesisUtterance : null;
  if (!s || !U || !limpio) { fin(); return false; }
  try {
    if (s.speaking) s.cancel();
    const u = new U(limpio);
    u.lang = lang || "es-MX";
    u.rate = 0.92;
    u.onend = fin;
    u.onerror = fin;
    s.speak(u);
    return true;
  } catch {
    fin();
    return false;
  }
}
