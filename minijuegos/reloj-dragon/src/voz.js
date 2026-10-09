// Voz del navegador, en español de México. Si no hay voz, el texto sigue en pantalla.
// Nunca hay que pasarle símbolos (▲, ▼, +): se leen mal en voz alta.

export function callar() {
  const s = typeof window !== "undefined" ? window.speechSynthesis : null;
  try { if (s?.speaking) s.cancel(); } catch { /* sin voz */ }
}

// Lista vacía: este aparato no tiene voces. No se intenta hablar.
export function hayVoces(sintesis) {
  if (!sintesis || typeof sintesis.getVoices !== "function") return true;
  try {
    const lista = sintesis.getVoices();
    return Array.isArray(lista) && lista.length > 0;
  } catch {
    return true;
  }
}

// true si la frase empezó. alTerminar corre solo si de verdad acabó.
// onerror no es «acabó»: llama a alFallar. Sin voces o si no arranca, false y sin aviso.
export function decir(texto, lang, alTerminar, alFallar) {
  const s = typeof window !== "undefined" ? window.speechSynthesis : null;
  const U = typeof window !== "undefined" ? window.SpeechSynthesisUtterance : null;
  if (!s || !U || !texto || !hayVoces(s)) return false;
  let cerrado = false;
  const acabar = () => {
    if (cerrado) return;
    cerrado = true;
    if (typeof alTerminar === "function") alTerminar();
  };
  const fallar = () => {
    if (cerrado) return;
    cerrado = true;
    if (typeof alFallar === "function") alFallar();
  };
  try {
    const u = new U(texto);
    u.lang = lang || "es-MX";
    u.rate = 0.92;
    u.onend = acabar;
    u.onerror = fallar;
    s.speak(u);
    return true;
  } catch { /* la tele a veces no tiene voces */
    return false;
  }
}
