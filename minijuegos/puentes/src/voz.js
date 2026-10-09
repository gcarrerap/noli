// Voz del navegador, en español. Si no hay voz, el texto sigue en pantalla.
// Un error, cero voces o una frase que no llega a empezar NO es «la voz terminó»:
// la guía sigue con su reloj (al menos 2 s, como mucho 3 s).

export function interpretarVoz(tipo, empezo) {
  if (tipo === "start") return { empezo: true, termino: false };
  if (tipo === "error" || tipo === "sin-voces" || tipo === "no-empieza") {
    return { empezo: !!empezo, termino: false };
  }
  if (tipo === "end") {
    if (!empezo) return { empezo: false, termino: false };
    return { empezo: true, termino: true };
  }
  return { empezo: !!empezo, termino: false };
}

function listaVoces(sintesis) {
  if (!sintesis || typeof sintesis.getVoices !== "function") return null;
  try {
    const lista = sintesis.getVoices();
    return Array.isArray(lista) ? lista : null;
  } catch {
    return [];
  }
}

export function decir(texto, lang, alTerminar, alNoTermino, alEmpezar) {
  const s = typeof window !== "undefined" ? window.speechSynthesis : null;
  const U = typeof window !== "undefined" ? window.SpeechSynthesisUtterance : null;
  const no = (motivo) => { if (alNoTermino) alNoTermino(motivo); };
  if (!s || !U || !texto) { no("no-empieza"); return false; }
  const voces = listaVoces(s);
  if (voces && voces.length === 0) { no("sin-voces"); return false; }
  let empezo = false;
  let cerrado = false;
  try {
    if (s.speaking && s.cancel) s.cancel();
    const u = new U(texto);
    u.lang = lang || "es-MX";
    u.rate = 0.92;
    u.onstart = () => {
      empezo = true;
      interpretarVoz("start", true);
      if (alEmpezar) alEmpezar();
    };
    u.onend = () => {
      if (cerrado) return;
      cerrado = true;
      const r = interpretarVoz("end", empezo);
      if (r.termino) { if (alTerminar) alTerminar(); }
      else no("no-empieza");
    };
    u.onerror = () => {
      if (cerrado) return;
      cerrado = true;
      interpretarVoz("error", empezo);
      no("error");
    };
    s.speak(u);
    return !cerrado;
  } catch {
    no("no-empieza");
    return false;
  }
}

export function callar() {
  const s = typeof window !== "undefined" ? window.speechSynthesis : null;
  if (!s) return;
  try { s.cancel(); } catch { /* el aparato no tiene voz */ }
}
