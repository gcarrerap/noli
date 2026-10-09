// Voz en español. Encendida por omisión.
// getVoices() vacío significa «aún no se sabe», no «no hay voz»: se habla igual,
// sin elegir una voz, con lang es-ES. Al cargar se pide la lista y, cuando
// llega voiceschanged, se guarda una voz en español para la siguiente frase.
// Un onerror, o una frase que no llega a empezar (speak no avisa onend),
// no es «ya terminó»: la guía se queda con su reloj (de 2 a 3 s).
// Nunca se dicen ▲, ▼, +, −, = ni ×: se limpian por si un texto de pantalla se cuela.

const SIMBOLOS = /[▲▼×+=−–]/g;
const suscritos = new WeakSet();

let vozElegida = null;

export function limpiarHabla(texto) {
  return String(texto || "")
    .replace(SIMBOLOS, " ")
    .replace(/[¡¿]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function cuentaComoFin(estado) {
  return estado === "termino";
}

function sintesisDe(opts) {
  if (opts && Object.prototype.hasOwnProperty.call(opts, "sintesis")) return opts.sintesis;
  return typeof window !== "undefined" ? window.speechSynthesis : null;
}

function ctorDe(opts) {
  if (opts && Object.prototype.hasOwnProperty.call(opts, "Utterance")) return opts.Utterance;
  return typeof window !== "undefined" ? window.SpeechSynthesisUtterance : null;
}

function vocesDe(s) {
  try {
    const lista = typeof s.getVoices === "function" ? s.getVoices() : null;
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

// null si la lista está vacía: todavía no hay de dónde escoger.
export function elegirVoz(lista) {
  if (!Array.isArray(lista) || !lista.length) return null;
  const es = lista.filter((v) => /^es([-_]|$)/i.test(String(v && v.lang || "")));
  return es.find((v) => /MX/i.test(v.lang || "")) || es[0] || null;
}

// Pide la lista al cargar (aunque venga vacía) y elige voz cuando el
// navegador avise voiceschanged. No retrasa el speak de ahora.
export function prepararVoces(sintesis) {
  const s = sintesis !== undefined ? sintesis : (typeof window !== "undefined" ? window.speechSynthesis : null);
  if (!s || typeof s.getVoices !== "function") return null;
  const aplicar = () => {
    vozElegida = elegirVoz(vocesDe(s));
    return vozElegida;
  };
  try { aplicar(); } catch { vozElegida = null; }
  if (typeof s.addEventListener === "function" && !suscritos.has(s)) {
    suscritos.add(s);
    try { s.addEventListener("voiceschanged", aplicar); } catch { /* sin evento */ }
  }
  return vozElegida;
}

// Habla `texto`. `onEstado` recibe "hablando", "termino" o "fallo".
// "fallo" es onerror o que speak no llega a onend. Una lista de voces vacía no lo es.
export function hablar(texto, opts = {}) {
  const onEstado = typeof opts.onEstado === "function" ? opts.onEstado : () => {};
  const resultado = { estado: "esperando", motivo: "" };
  const avisar = (estado, motivo = "") => {
    if (resultado.estado === "termino" || resultado.estado === "fallo") return;
    if (estado === "hablando") {
      if (resultado.estado === "esperando") resultado.estado = "hablando";
      onEstado("hablando", "");
      return;
    }
    resultado.estado = estado;
    resultado.motivo = motivo;
    onEstado(estado, motivo);
  };

  const limpio = limpiarHabla(texto);
  if (opts.activo === false || !limpio) {
    avisar("fallo", opts.activo === false ? "apagada" : "vacio");
    return resultado;
  }

  const s = sintesisDe(opts);
  const Ctor = ctorDe(opts);
  if (!s || typeof s.speak !== "function" || !Ctor) {
    avisar("fallo", "sin-voces");
    return resultado;
  }

  try {
    if (s.speaking || s.pending) s.cancel();
    const u = new Ctor(limpio);
    u.lang = "es-ES";
    u.rate = 0.92;
    // Lista vacía: no se fija una voz. Si voiceschanged ya eligió una, se usa esa.
    if (vozElegida) u.voice = vozElegida;
    u.onstart = () => avisar("hablando");
    u.onend = () => avisar("termino");
    u.onerror = () => avisar("fallo", "error");
    s.speak(u);
  } catch {
    avisar("fallo", "error");
  }
  return resultado;
}

export function decir(texto, opts) {
  return hablar(texto, opts);
}

export function callar() {
  const s = typeof window !== "undefined" ? window.speechSynthesis : null;
  if (!s) return;
  try { s.cancel(); } catch { /* sin voz */ }
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  try { prepararVoces(window.speechSynthesis); } catch { /* la tele a veces no tiene voces */ }
}
