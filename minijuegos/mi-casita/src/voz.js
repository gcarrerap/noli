// Voz del navegador, copiada de Fábrica. El juego la prende por omisión
// y la apaga si el progreso tiene la voz en no.
// Nunca se le pasan símbolos como ▲ o +.
// Una lista vacía no significa que no haya voz: Chrome la da vacía la primera
// vez, y algunas teles hablan igual. Si hablar falla de verdad, el texto sigue.

const SIMBOLOS = /[\u25B2\u25BC\u25C0\u25B6\u2191\u2193\u2190\u2192+\u00D7\u2715\u2716]/g;

let vozEspanola = null;
const preparadas = new WeakSet();

export function esLangEs(lang) {
  const l = String(lang || "").toLowerCase().replace("_", "-");
  return l === "es" || l.startsWith("es-");
}

export function elegirVoz(voces) {
  const lista = Array.isArray(voces) ? voces : [];
  const mx = lista.find((v) => /^es-mx\b/i.test(String(v && v.lang || "").replace("_", "-")));
  if (mx) return mx;
  return lista.find((v) => esLangEs(v && v.lang)) || null;
}

export function paraVoz(texto) {
  return String(texto ?? "").replace(SIMBOLOS, " ").replace(/\s+/g, " ").trim();
}

export function callar() {
  const s = typeof window !== "undefined" ? window.speechSynthesis : null;
  try { if (s && (s.speaking || s.pending)) s.cancel(); } catch { /* sin voz */ }
}

function vocesDe(s) {
  try {
    if (!s || typeof s.getVoices !== "function") return null;
    const v = s.getVoices();
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

function tomarVoces(s) {
  const lista = vocesDe(s);
  if (!lista || !lista.length) return;
  const elegida = elegirVoz(lista);
  if (elegida) vozEspanola = elegida;
}

/** Llama a getVoices al cargar para que el navegador avise cuando lleguen. */
export function prepararVoces(sintesis) {
  const s = sintesis || (typeof window !== "undefined" ? window.speechSynthesis : null);
  if (!s || typeof s.getVoices !== "function") return;
  try { tomarVoces(s); } catch { /* la lista puede llegar después */ }
  if (preparadas.has(s)) return;
  preparadas.add(s);
  if (typeof s.addEventListener === "function") s.addEventListener("voiceschanged", () => tomarVoces(s));
  else s.onvoiceschanged = () => tomarVoces(s);
}

/**
 * Intenta decir el texto. `alTerminar` solo corre si la frase sonó.
 * `opciones.alFallar` corre si hay error o si no empieza: eso no cuenta
 * como frase dicha. Una lista vacía es desconocida: se habla igual, sin
 * voz concreta y en español. Se puede pasar un `sintesis` de prueba.
 * Devuelve true si quedó hablando.
 */
export function decir(texto, lang, alTerminar, opciones = {}) {
  const limpio = paraVoz(texto);
  const alFallar = typeof opciones.alFallar === "function" ? opciones.alFallar : null;
  const terminar = () => { if (typeof alTerminar === "function") alTerminar(); };
  const fallar = () => { if (alFallar) alFallar(); else terminar(); };
  const s = opciones.sintesis || (typeof window !== "undefined" ? window.speechSynthesis : null);
  const U = opciones.Utterance || (typeof window !== "undefined" ? window.SpeechSynthesisUtterance : null);
  if (!limpio || !s || !U) { fallar(); return false; }
  const voces = vocesDe(s);
  const listaVacia = Array.isArray(voces) && voces.length === 0;
  if (!listaVacia) tomarVoces(s);
  let cerrado = false;
  let empezo = false;
  const unaVez = (fn) => {
    if (cerrado) return;
    cerrado = true;
    fn();
  };
  try {
    if (s.speaking || s.pending) s.cancel();
    const u = new U(limpio);
    if (listaVacia) {
      u.lang = "es";
    } else {
      const elegida = Array.isArray(voces) ? elegirVoz(voces) : vozEspanola;
      if (elegida && esLangEs(elegida.lang)) {
        u.voice = elegida;
        u.lang = String(elegida.lang).replace("_", "-");
      } else {
        u.lang = esLangEs(lang) ? String(lang).replace("_", "-") : "es";
      }
    }
    u.rate = 0.92;
    u.onstart = () => { empezo = true; };
    u.onend = () => { if (empezo) unaVez(terminar); else unaVez(fallar); };
    u.onerror = () => unaVez(fallar);
    s.speak(u);
  } catch {
    unaVez(fallar);
    return false;
  }
  if (!cerrado && !empezo && !s.speaking && !s.pending) {
    unaVez(fallar);
    return false;
  }
  return !cerrado;
}

prepararVoces();
