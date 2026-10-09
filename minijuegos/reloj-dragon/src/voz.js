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

let hablaToken = 0;

export function callar() {
  const s = typeof window !== "undefined" ? window.speechSynthesis : null;
  hablaToken++;
  try { if (s) s.cancel(); } catch { /* sin voz */ }
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
  const mio = ++hablaToken;
  const u = new U(texto);
  u.lang = lang || LANG;
  u.rate = 0.92;
  if (vozElegida) u.voice = vozElegida;
  u.onstart = () => {
    if (cerrado || mio !== hablaToken) return;
    if (typeof alEmpezar === "function") alEmpezar();
  };
  u.onend = () => { if (mio === hablaToken) acabar(); };
  u.onerror = () => { if (mio === hablaToken) fallar(); };
  const lanzar = () => {
    if (mio !== hablaToken) return;
    try { s.speak(u); } catch { fallar(); }
  };
  try {
    // cancel() y speak() en el mismo turno hacen que Chrome diga la frase varias veces.
    // Si cancel() no termina en el acto, se habla una sola vez en el turno siguiente.
    if (s.speaking || s.pending) s.cancel();
    if (mio !== hablaToken) return false;
    if (s.speaking || s.pending) {
      setTimeout(lanzar, 0);
      return true;
    }
    lanzar();
    return !fallo;
  } catch { /* la tele a veces no tiene voces */
    return false;
  }
}
