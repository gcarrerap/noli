// Voz del navegador. Español para los pedidos en palabras y para el canje largo;
// inglés solo en el sello opcional. Si el aparato no tiene voz, el texto sigue en pantalla.

export function decir(texto, lang) {
  const s = typeof window !== "undefined" ? window.speechSynthesis : null;
  const U = typeof window !== "undefined" ? window.SpeechSynthesisUtterance : null;
  if (!s || !U || !texto) return;
  try {
    if (s.speaking) s.cancel();
    const u = new U(texto);
    u.lang = lang || "es-ES";
    u.rate = 0.92;
    s.speak(u);
  } catch { /* la tele a veces no tiene voces */ }
}
