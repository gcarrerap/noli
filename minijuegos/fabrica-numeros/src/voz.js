// Voz del navegador. Español para los pedidos en palabras y para el canje largo;
// inglés solo en el sello opcional. Si el aparato no tiene voz, el texto sigue en pantalla.
// Una lista vacía no es «no hay voz»: Chrome la devuelve vacía la primera vez,
// y algunas teles dicen que no hay voces y aun así hablan. Se llama a speak igual.

const LANG = "es-ES";
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
  try { if (s && (s.speaking || s.pending)) s.cancel(); } catch { /* sin voz */ }
}

// true si speak no falló en el acto. alTerminar solo corre si de verdad acabó.
// onerror no es «acabó»: llama a alFallar. onstart avisa que la frase sí arrancó.
// Sin API o si speak lanza, devuelve false y no avisa.
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
    if (s.speaking || s.pending) s.cancel();
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
  } catch {
    return false;
  }
}
