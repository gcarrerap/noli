// Voz en español. Encendida por omisión.
// Un error, cero voces o una frase que no llega a empezar NO es «ya terminó»:
// la guía se queda con su reloj (de 2 a 3 s en los pasos de mirar).
// Nunca se dicen ▲, ▼, +, −, = ni ×: se limpian por si un texto de pantalla se cuela.

const SIMBOLOS = /[▲▼×+=−–]/g;

let cancelarEspera = null;

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

// Habla `texto`. `onEstado` recibe "hablando", "termino" o "fallo".
// "fallo" cubre onerror, sin voces y la frase que no empieza: no es un fin.
export function hablar(texto, opts = {}) {
  const onEstado = typeof opts.onEstado === "function" ? opts.onEstado : () => {};
  const resultado = { estado: "esperando", motivo: "" };
  let empezo = false;
  const avisar = (estado, motivo = "") => {
    if (resultado.estado === "termino" || resultado.estado === "fallo") return;
    if (estado === "hablando") {
      empezo = true;
      if (resultado.estado === "esperando") resultado.estado = "hablando";
      onEstado("hablando", "");
      return;
    }
    if (estado === "termino" && !empezo) {
      resultado.estado = "fallo";
      resultado.motivo = "no-empieza";
      onEstado("fallo", "no-empieza");
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
  if (!s || !Ctor) {
    avisar("fallo", "sin-voces");
    return resultado;
  }

  const decirYa = () => {
    if (!vocesDe(s).length) {
      avisar("fallo", "sin-voces");
      return;
    }
    try {
      if (s.speaking || s.pending) s.cancel();
      const u = new Ctor(limpio);
      u.lang = "es-ES";
      u.rate = 0.92;
      u.onstart = () => avisar("hablando");
      u.onend = () => avisar("termino");
      u.onerror = () => avisar("fallo", "error");
      s.speak(u);
    } catch {
      avisar("fallo", "error");
    }
  };

  if (cancelarEspera) {
    cancelarEspera();
    cancelarEspera = null;
  }

  if (!vocesDe(s).length && typeof s.addEventListener === "function") {
    const fn = () => {
      try { s.removeEventListener("voiceschanged", fn); } catch { /* ya no está */ }
      cancelarEspera = null;
      if (resultado.estado === "termino" || resultado.estado === "fallo") return;
      decirYa();
    };
    cancelarEspera = () => {
      try { s.removeEventListener("voiceschanged", fn); } catch { /* ya no está */ }
    };
    try {
      s.addEventListener("voiceschanged", fn);
      return resultado;
    } catch { /* sin evento: se trata como sin voces */ }
  }

  if (!vocesDe(s).length) {
    avisar("fallo", "sin-voces");
    return resultado;
  }
  decirYa();
  return resultado;
}

export function decir(texto, opts) {
  return hablar(texto, opts);
}

export function callar() {
  if (cancelarEspera) {
    cancelarEspera();
    cancelarEspera = null;
  }
  const s = typeof window !== "undefined" ? window.speechSynthesis : null;
  if (!s) return;
  try { s.cancel(); } catch { /* sin voz */ }
}
