// Voz del navegador. Español para los pedidos en palabras y para el canje largo;
// inglés solo en el sello opcional. Si el aparato no tiene voz, el texto sigue en pantalla.

export function callar() {
  const s = typeof window !== "undefined" ? window.speechSynthesis : null;
  try { if (s && (s.speaking || s.pending)) s.cancel(); } catch { /* sin voz */ }
}

export function decir(texto, lang, alTerminar) {
  const s = typeof window !== "undefined" ? window.speechSynthesis : null;
  const U = typeof window !== "undefined" ? window.SpeechSynthesisUtterance : null;
  if (!s || !U || !texto) return false;
  let aviso = false;
  const fin = () => {
    if (aviso) return;
    aviso = true;
    if (typeof alTerminar === "function") alTerminar();
  };
  try {
    if (s.speaking) s.cancel();
    const u = new U(texto);
    u.lang = lang || "es-ES";
    u.rate = 0.92;
    u.onend = fin;
    s.speak(u);
    return true;
  } catch {
    return false;
  }
}
