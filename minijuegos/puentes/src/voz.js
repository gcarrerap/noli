// Voz del navegador, en español. Si no hay voz, el texto sigue en pantalla.
// Una lista vacía de getVoices() es «aún no sé», no «no hay voz»: se habla igual,
// sin elegir una voz y con el idioma bien puesto. Al cargar se pide la lista
// y, cuando llega voiceschanged, se escoge una en español para la siguiente.
// Un error o una frase que no llega a empezar NO es «la voz terminó».

export function interpretarVoz(tipo, empezo) {
  if (tipo === "start") return { empezo: true, termino: false };
  if (tipo === "error" || tipo === "no-empieza") {
    return { empezo: !!empezo, termino: false };
  }
  if (tipo === "end") {
    if (!empezo) return { empezo: false, termino: false };
    return { empezo: true, termino: true };
  }
  return { empezo: !!empezo, termino: false };
}

let vozPreferida = null;
let sintesisLista = null;

function langDe(voz) {
  return String((voz && voz.lang) || "").replace("_", "-");
}

// null si la lista está vacía o todavía no llegó. Prefiere es-MX.
export function elegirVoz(lista) {
  if (!Array.isArray(lista) || lista.length === 0) return null;
  const es = lista.filter((v) => /^es([-_]|$)/i.test(langDe(v)));
  return es.find((v) => /^es-MX$/i.test(langDe(v))) || es[0] || null;
}

function leerVoces(sintesis) {
  if (!sintesis || typeof sintesis.getVoices !== "function") return null;
  try {
    const lista = sintesis.getVoices();
    return Array.isArray(lista) ? lista : null;
  } catch {
    return null;
  }
}

// Pide la lista al cargar (en Chrome llega vacía y se llena después).
// voiceschanged elige la voz; una lista vacía no borra la que ya se eligió.
export function prepararVoces(sintesis) {
  const s = sintesis || (typeof window !== "undefined" ? window.speechSynthesis : null);
  if (!s) return vozPreferida;
  const tomar = () => {
    const lista = leerVoces(s);
    const elegida = elegirVoz(lista);
    if (elegida) vozPreferida = elegida;
  };
  tomar();
  if (s !== sintesisLista) {
    sintesisLista = s;
    if (typeof s.addEventListener === "function") s.addEventListener("voiceschanged", tomar);
    else {
      const previo = s.onvoiceschanged;
      s.onvoiceschanged = (...args) => {
        tomar();
        if (typeof previo === "function") previo.apply(s, args);
      };
    }
  }
  return vozPreferida;
}

export function decir(texto, lang, alTerminar, alNoTermino, alEmpezar) {
  const s = typeof window !== "undefined" ? window.speechSynthesis : null;
  const U = typeof window !== "undefined" ? window.SpeechSynthesisUtterance : null;
  const no = (motivo) => { if (alNoTermino) alNoTermino(motivo); };
  if (!s || !U || !texto) { no("no-empieza"); return false; }
  let empezo = false;
  let cerrado = false;
  try {
    if (s.speaking && s.cancel) s.cancel();
    const u = new U(texto);
    const idioma = lang || "es-MX";
    u.lang = idioma;
    u.rate = 0.92;
    const voces = leerVoces(s);
    // [] o null: no se sabe todavía. Se habla sin fijar una voz.
    if (voces && voces.length > 0) {
      const voz = (vozPreferida && voces.includes(vozPreferida)) ? vozPreferida : elegirVoz(voces);
      if (voz) {
        vozPreferida = voz;
        u.voice = voz;
        if (langDe(voz)) u.lang = langDe(voz);
      }
    }
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

if (typeof window !== "undefined" && window.speechSynthesis) prepararVoces(window.speechSynthesis);
