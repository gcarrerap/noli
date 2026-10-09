// Voz del navegador, en español de México. Si no hay voz, el texto sigue en pantalla.
// Nunca hay que pasarle símbolos (▲, ▼, +): se leen mal en voz alta.
// Una lista vacía no es «no hay voz»: Chrome la devuelve vacía la primera vez,
// y algunas teles dicen que no hay voces y aun así hablan. Se llama a speak igual.

const LANG = "es-MX";
let vozElegida = null;
let sintesisCalentada = null;

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

export function callar() {
  const s = typeof window !== "undefined" ? window.speechSynthesis : null;
  try { if (s?.speaking) s.cancel(); } catch { /* sin voz */ }
}

// true si speak no falló en el acto. alTerminar corre solo si de verdad acabó.
// onerror no es «acabó»: llama a alFallar. onstart avisa que la frase sí arrancó.
// Sin API o si speak lanza, false y sin aviso.
export function decir(texto, lang, alTerminar, alFallar, alEmpezar) {
  const s = typeof window !== "undefined" ? window.speechSynthesis : null;
  const U = typeof window !== "undefined" ? window.SpeechSynthesisUtterance : null;
  if (!s || !U || !texto) return false;
  calentarVoces(s);
  let cerrado = false;
  let fallo = false;
  const acabar = () => {
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
    const u = new U(texto);
    u.lang = lang || LANG;
    u.rate = 0.92;
    if (vozElegida) u.voice = vozElegida;
    u.onstart = () => {
      if (cerrado) return;
      if (typeof alEmpezar === "function") alEmpezar();
    };
    u.onend = acabar;
    u.onerror = fallar;
    s.speak(u);
    return !fallo;
  } catch { /* la tele a veces no tiene voces */
    return false;
  }
}
