// Voz en español para los encargos y para contar. Encendida por omisión.
// Nunca se dicen ▲, ▼, + ni ×: se limpian por si un texto de pantalla se cuela.
// Una lista vacía no es «no hay voz»: Chrome la devuelve vacía la primera vez,
// y algunas teles dicen que no hay voces y aun así hablan. Se llama a speak igual.

const LANG = "es-ES";
let vozElegida = null;
let sintesisCalentada = null;

export function limpiarHabla(texto) {
  return String(texto || "")
    .replace(/[▲▼×+]/g, " ")
    .replace(/[−–]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function esEspanol(lang) {
  return /^es([-_]|$)/i.test(String(lang || "").replace("_", "-"));
}

function elegirVoz(s) {
  let lista = [];
  try { lista = s.getVoices() || []; } catch { lista = []; }
  vozElegida = lista.find((v) => String(v.lang || "").replace("_", "-").toLowerCase() === LANG.toLowerCase())
    || lista.find((v) => esEspanol(v.lang))
    || null;
}

// Al cargar se pide la lista. Cuando el navegador la manda, se elige una voz en español.
export function calentarVoces(sintesis) {
  const s = sintesis || (typeof window !== "undefined" ? window.speechSynthesis : null);
  if (!s || sintesisCalentada === s) return;
  sintesisCalentada = s;
  try { s.getVoices(); } catch { /* aún no hay lista */ }
  const alCambiar = () => elegirVoz(s);
  if (typeof s.addEventListener === "function") s.addEventListener("voiceschanged", alCambiar);
  else s.onvoiceschanged = alCambiar;
  elegirVoz(s);
}

if (typeof window !== "undefined") calentarVoces();

// true solo si speak no falló en el acto. Un error o un speak que no arranca
// no llaman alTerminar: eso cerraba el paso en 1 ms. El juego espera entonces 2 s.
// getVoices() vacío no es un fallo: se habla igual, sin elegir una voz.
// onstart avisa que la frase sí arrancó. Sin ese aviso, el paso no espera 3 s.
export function decir(texto, { activo = true, alTerminar, alFallar, alEmpezar } = {}) {
  const limpio = limpiarHabla(texto);
  if (!activo || !limpio) return false;
  const s = typeof window !== "undefined" ? window.speechSynthesis : null;
  const U = typeof window !== "undefined" ? window.SpeechSynthesisUtterance : null;
  if (!s || !U) return false;
  calentarVoces(s);
  let cerrado = false;
  let fallo = false;
  const terminar = () => {
    if (cerrado) return;
    cerrado = true;
    if (typeof alTerminar === "function") alTerminar();
  };
  const fallar = () => {
    if (cerrado) return;
    cerrado = true;
    fallo = true;
    if (typeof alFallar === "function") alFallar();
  };
  try {
    if (s.speaking || s.pending) s.cancel();
    const u = new U(limpio);
    u.lang = LANG;
    u.rate = 0.92;
    if (vozElegida) u.voice = vozElegida;
    u.onstart = () => {
      if (cerrado) return;
      if (typeof alEmpezar === "function") alEmpezar();
    };
    u.onend = terminar;
    u.onerror = fallar;
    s.speak(u);
    return !fallo;
  } catch {
    fallar();
    return false;
  }
}
