// Voz del navegador. Español para los pedidos en palabras y para el canje largo;
// inglés solo en el sello opcional. Si el aparato no tiene voz, el texto sigue en pantalla.

export function callar() {
  const s = typeof window !== "undefined" ? window.speechSynthesis : null;
  try { if (s && (s.speaking || s.pending)) s.cancel(); } catch { /* sin voz */ }
}

// Lista vacía: este aparato no tiene voces (o el navegador aún no las dio).
// No se intenta hablar: el paso usa el temporizador.
export function hayVoces(sintesis) {
  if (!sintesis || typeof sintesis.getVoices !== "function") return true;
  try {
    const lista = sintesis.getVoices();
    return Array.isArray(lista) && lista.length > 0;
  } catch {
    return true;
  }
}

// true si la frase empezó. alTerminar solo corre si de verdad acabó.
// Un error (onerror) no cuenta como acabada: llama a alFallar, si viene.
// Sin voces, sin API o si speak lanza, devuelve false y no avisa.
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
    if (s.speaking || s.pending) s.cancel();
    const u = new U(texto);
    u.lang = lang || "es-ES";
    u.rate = 0.92;
    u.onend = acabar;
    u.onerror = fallar;
    s.speak(u);
    return true;
  } catch {
    return false;
  }
}
