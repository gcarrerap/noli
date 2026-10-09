// Voz del navegador. Español para los pedidos y para contar.
// Si el aparato no tiene voz, el texto sigue en pantalla.

export function decir(texto, lang, alTerminar) {
  const s = typeof window !== "undefined" ? window.speechSynthesis : null;
  const U = typeof window !== "undefined" ? window.SpeechSynthesisUtterance : null;
  if (!s || !U || !texto) return false;
  try {
    if (s.speaking) s.cancel();
    const u = new U(texto);
    u.lang = lang || "es-MX";
    u.rate = 0.92;
    if (alTerminar) {
      u.onend = () => alTerminar();
      u.onerror = () => alTerminar();
    }
    s.speak(u);
    return true;
  } catch {
    return false;
  }
}
