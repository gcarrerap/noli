// Voz en español para los encargos y para contar. Encendida por omisión.
// Nunca se dicen ▲, ▼, + ni ×: se limpian por si un texto de pantalla se cuela.

export function limpiarHabla(texto) {
  return String(texto || "")
    .replace(/[▲▼×+]/g, " ")
    .replace(/[−–]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hayVoces(s) {
  if (typeof s.getVoices !== "function") return true;
  try {
    const lista = s.getVoices();
    return !Array.isArray(lista) || lista.length > 0;
  } catch {
    return true;
  }
}

// true solo si la frase llegó a empezar. Un error, cero voces o un speak que no arranca
// no llaman alTerminar: eso cerraba el paso en 1 ms. El juego espera entonces 2 s.
export function decir(texto, { activo = true, alTerminar, alFallar } = {}) {
  const limpio = limpiarHabla(texto);
  if (!activo || !limpio) return false;
  const s = typeof window !== "undefined" ? window.speechSynthesis : null;
  const U = typeof window !== "undefined" ? window.SpeechSynthesisUtterance : null;
  if (!s || !U) return false;
  let cerrado = false;
  const terminar = () => {
    if (cerrado) return;
    cerrado = true;
    if (typeof alTerminar === "function") alTerminar();
  };
  const fallar = () => {
    if (cerrado) return;
    cerrado = true;
    if (typeof alFallar === "function") alFallar();
  };
  if (!hayVoces(s)) {
    fallar();
    return false;
  }
  try {
    if (s.speaking || s.pending) s.cancel();
    const u = new U(limpio);
    u.lang = "es-ES";
    u.rate = 0.92;
    u.onend = terminar;
    u.onerror = fallar;
    s.speak(u);
    if (cerrado) return false;
    return true;
  } catch {
    fallar();
    return false;
  }
}
