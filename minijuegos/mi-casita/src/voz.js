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

function vocesDe(s) {
  try {
    if (!s || typeof s.getVoices !== "function") return null;
    const v = s.getVoices();
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * Intenta decir el texto. `alTerminar` solo corre si la frase sonó.
 * `opciones.alFallar` corre si hay error, si no hay voces o si no empieza:
 * eso no cuenta como frase dicha. Se puede pasar un `sintesis` de prueba.
 * Devuelve true si quedó hablando.
 */
export function decir(texto, lang, alTerminar, opciones = {}) {
  const limpio = paraVoz(texto);
  const alFallar = typeof opciones.alFallar === "function" ? opciones.alFallar : null;
  const terminar = () => { if (typeof alTerminar === "function") alTerminar(); };
  const fallar = () => { if (alFallar) alFallar(); else terminar(); };
  const s = opciones.sintesis || (typeof window !== "undefined" ? window.speechSynthesis : null);
  const U = opciones.Utterance || (typeof window !== "undefined" ? window.SpeechSynthesisUtterance : null);
  if (!limpio || !s || !U) { fallar(); return false; }
  const voces = vocesDe(s);
  if (voces && voces.length === 0) { fallar(); return false; }
  let cerrado = false;
  let empezo = false;
  const unaVez = (fn) => {
    if (cerrado) return;
    cerrado = true;
    fn();
  };
  try {
    if (s.speaking || s.pending) s.cancel();
    const u = new U(limpio);
    u.lang = lang || "es-MX";
    u.rate = 0.92;
    u.onstart = () => { empezo = true; };
    u.onend = () => { if (empezo) unaVez(terminar); else unaVez(fallar); };
    u.onerror = () => unaVez(fallar);
    s.speak(u);
  } catch {
    unaVez(fallar);
    return false;
  }
  if (!cerrado && !empezo && !s.speaking && !s.pending) {
    unaVez(fallar);
    return false;
  }
  return !cerrado;
}
