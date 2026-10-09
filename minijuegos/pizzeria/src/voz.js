// Voz del navegador. Español para los pedidos y para contar.
// Si el aparato no tiene voz, el texto sigue en pantalla.

function vocesDe(s) {
  if (!s || typeof s.getVoices !== "function") return null;
  try {
    const lista = s.getVoices();
    return Array.isArray(lista) ? lista : null;
  } catch {
    return null;
  }
}

// true: la frase terminó. false: error, o no llegó a sonar.
// Sin voces, o si hablar lanza, devuelve false y no avisa: el paso usa los 2 s.
export function decir(texto, lang, alTerminar) {
  const s = typeof window !== "undefined" ? window.speechSynthesis : null;
  const U = typeof window !== "undefined" ? window.SpeechSynthesisUtterance : null;
  if (!s || !U || !texto) return false;
  const voces = vocesDe(s);
  if (voces && voces.length === 0) return false;
  let aviso = false;
  const fin = (ok) => {
    if (aviso) return;
    aviso = true;
    if (typeof alTerminar === "function") alTerminar(ok);
  };
  try {
    if (s.speaking || s.pending) s.cancel();
    const u = new U(texto);
    u.lang = lang || "es-MX";
    u.rate = 0.92;
    u.onend = () => fin(true);
    u.onerror = () => fin(false);
    s.speak(u);
    return true;
  } catch {
    return false;
  }
}
