// Voz del navegador. Una lista vacía de getVoices() no significa que no haya voz:
// es que todavía no se sabe. Se habla igual, sin elegir voz, con el idioma bien puesto.
// El error (onerror) y el habla que no llega a empezar no cuentan como «ya terminó».

const SIMBOLOS = /[\u25B2\u25BC\u25C0\u25B6\u2191\u2193\u2190\u2192+\u00D7\u2715\u2716]/g;
const calentados = new WeakSet();
let vozElegida = null;

export function paraVoz(texto) {
  return String(texto ?? "").replace(SIMBOLOS, " ").replace(/\s+/g, " ").trim();
}

export function escogerVoz(voces) {
  if (!Array.isArray(voces) || voces.length === 0) return null;
  const lang = (v) => String((v && v.lang) || "");
  return voces.find((v) => /^es[-_]MX\b/i.test(lang(v)))
    || voces.find((v) => /^es([-_]|$)/i.test(lang(v)))
    || null;
}

export function olvidarVoz() {
  vozElegida = null;
}

export function vozActual() {
  return vozElegida;
}

/** Llama a getVoices() al cargar y, cuando el navegador avise, se queda con una voz en español. */
export function calentarVoces(synth) {
  const s = synth || (typeof window !== "undefined" ? window.speechSynthesis : null);
  if (!s || typeof s.getVoices !== "function") return;
  if (calentados.has(s)) return;
  try { calentados.add(s); } catch { return; }
  const tomar = () => {
    try { vozElegida = escogerVoz(s.getVoices()); }
    catch { vozElegida = null; }
  };
  try { s.getVoices(); } catch { /* todavía no hay lista */ }
  tomar();
  if (typeof s.addEventListener === "function") s.addEventListener("voiceschanged", tomar);
  else s.onvoiceschanged = tomar;
}

/**
 * Habla `texto`. Devuelve { sono }.
 * onend solo corre si el habla termina de verdad. onerror no lo dispara,
 * aunque después llegue onend. getVoices() vacío no impide speak().
 */
export function decir(texto, opciones = {}) {
  const opt = opciones || {};
  const onend = opt.onend;
  const limpio = paraVoz(opt.textoLimpio != null ? opt.textoLimpio : texto);
  const s = opt.speechSynthesis || (typeof window !== "undefined" ? window.speechSynthesis : null);
  const Utter = opt.SpeechSynthesisUtterance || (typeof window !== "undefined" ? window.SpeechSynthesisUtterance : null);
  if (!s || !Utter || !limpio) return { sono: false };
  try { if (typeof s.getVoices === "function") s.getVoices(); } catch { /* lista desconocida */ }
  try {
    if (s.speaking || s.pending) s.cancel();
    const u = new Utter(limpio);
    u.lang = opt.lang || "es-MX";
    u.rate = 0.92;
    if (vozElegida) u.voice = vozElegida;
    let fallo = false;
    u.onerror = () => { fallo = true; };
    u.onend = () => { if (!fallo && typeof onend === "function") onend(); };
    s.speak(u);
    return { sono: true };
  } catch {
    return { sono: false };
  }
}
