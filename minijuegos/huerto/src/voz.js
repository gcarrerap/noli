// Voz en español para los encargos y para contar. Encendida por omisión.
// Nunca se dicen ▲, ▼, + ni ×: se limpian por si un texto de pantalla se cuela.

export function limpiarHabla(texto) {
  return String(texto || "")
    .replace(/[▲▼×+]/g, " ")
    .replace(/[−–]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function decir(texto, { activo = true } = {}) {
  const limpio = limpiarHabla(texto);
  if (!activo || !limpio) return;
  const s = typeof window !== "undefined" ? window.speechSynthesis : null;
  const U = typeof window !== "undefined" ? window.SpeechSynthesisUtterance : null;
  if (!s || !U) return;
  try {
    if (s.speaking || s.pending) s.cancel();
    const u = new U(limpio);
    u.lang = "es-ES";
    u.rate = 0.92;
    s.speak(u);
  } catch { /* la tele a veces no tiene voces */ }
}
