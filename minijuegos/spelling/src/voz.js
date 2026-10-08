// La voz en inglés: speechSynthesis del navegador, con los arreglos que necesita en la vida real:
//
// - Chrome y Safari a veces tiran un speak() que llega justo después de cancel(): solo se cancela si de verdad
//   está hablando, y entonces se espera un momento antes de hablar.
// - iPhone y Chrome solo dejan hablar después de un toque: en el primer toque o tecla se "desbloquea" con una
//   frase muda, y desde ahí se puede hablar cuando sea.
// - Chrome puede quedarse en pausa (resume() antes de hablar) y pierde la frase si nadie la guarda (se guarda).
// - Hay voces que existen pero no suenan (voces de red sin internet, TVs): si una frase no empieza en unos
//   segundos o da error, se prueba la siguiente voz en inglés; si ninguna suena, Voz.hay pasa a false y el juego
//   avisa (Voz.alFallar) para que el juego diga cómo arreglarlo. Nunca se enseña la palabra en su lugar.
// - Voz.estado() junta todo lo anterior para la pantalla "Para papás" (probar la voz en cada aparato).

const PREFERIDAS = /samantha|google us english|aria|jenny|allison|ava|zira|karen|serena|moira|daniel|english united states/i;
// Voces de broma de Apple: suenan raro para aprender
const DE_BROMA = /albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy|grandma|grandpa|rocko|shelley|eddy|flo|reed|sandy/i;

// Las voces en inglés, de la mejor a la peor. Pura (recibe la lista) para poder probarla.
export function ordenarVoces(voces) {
  const en = voces.filter((v) => /^en([-_]|$)/i.test(v.lang || ""));
  const peso = (v) => (/^en[-_]us/i.test(v.lang) ? 0 : /^en[-_](gb|au|ca|ie|nz)/i.test(v.lang) ? 100 : 200)
    + (DE_BROMA.test(v.name) ? 50 : 0) + (PREFERIDAS.test(v.name) ? 0 : 10) + (v.localService === false ? 5 : 0);
  return [...en].sort((a, b) => peso(a) - peso(b));
}
export const escogerVoz = (voces) => ordenarVoces(voces)[0] || null;

// Para que la diga letra por letra: "C. A. K. E."
export const letraPorLetra = (palabra) => palabra.toUpperCase().split("").join(". ") + ".";

// Errores que son nuestros (cancelamos para decir otra cosa), no del aparato
const NO_ES_FALLA = new Set(["interrupted", "canceled"]);

const sintesis = typeof window !== "undefined" && window.speechSynthesis ? window.speechSynthesis : null;
const Utterance = typeof window !== "undefined" ? window.SpeechSynthesisUtterance : null;

let candidatas = [];      // voces en inglés ordenadas
let k = 0;                // la que se está usando
let cargadas = false;     // el navegador ya dio su lista de voces (aunque sea vacía de inglés)
let rota = false;         // ya probamos y no suena
let desbloqueada = false;
let actual = null;        // la frase que está sonando (Chrome la pierde si nadie la guarda)
let fallasSeguidas = 0;
const bitacora = [];
const oyentesFalla = new Set();

function anotar(t) { bitacora.push(`${new Date().toLocaleTimeString()} ${t}`); if (bitacora.length > 12) bitacora.shift(); }

function revisar() {
  const vs = sintesis.getVoices() || [];
  if (vs.length) cargadas = true;
  const antes = candidatas[k];
  candidatas = ordenarVoces(vs);
  const i = antes ? candidatas.findIndex((v) => v.voiceURI === antes.voiceURI && v.name === antes.name) : -1;
  k = i >= 0 ? i : 0;
}

// Espera a que el navegador cargue sus voces (llegan tarde en Chrome y Android); a lo más 3 segundos.
// Si llegan después, se toman igual (voiceschanged).
const listo = new Promise((resolver) => {
  if (!sintesis || !Utterance) { anotar("Este navegador no tiene speechSynthesis"); return resolver(false); }
  revisar();
  sintesis.addEventListener?.("voiceschanged", () => { revisar(); if (candidatas.length) resolver(true); });
  if (candidatas.length) return resolver(true);
  setTimeout(() => { revisar(); resolver(Voz.hay); }, 3000);
});

// Con el primer toque o tecla: una frase muda para que iPhone y Chrome dejen hablar después
function desbloquear() {
  if (desbloqueada || !sintesis || !Utterance) return;
  desbloqueada = true;
  try { const u = new Utterance(" "); u.volume = 0; u.lang = "en-US"; sintesis.speak(u); } catch {}
}
if (typeof document !== "undefined") {
  for (const ev of ["pointerdown", "keydown", "touchend"]) document.addEventListener(ev, desbloquear, { capture: true, passive: true });
}

function fallo(motivo) {
  anotar("Falla: " + motivo);
  fallasSeguidas++;
  // Primero otra voz en inglés; si ya no hay más y falló dos veces seguidas, nos rendimos
  if (k < candidatas.length - 1) { k++; anotar("Probando otra voz: " + (candidatas[k]?.name || "?")); return; }
  if (fallasSeguidas >= 2 || /not-allowed|synthesis-unavailable|audio-hardware|language-unavailable|voice-unavailable/.test(motivo)) {
    if (!rota) { rota = true; anotar("La voz no suena en este aparato"); for (const fn of oyentesFalla) fn(); }
  }
}

function hablar(texto, velocidad, resolver) {
  const u = new Utterance(texto), voz = candidatas[k];
  if (voz) { u.voice = voz; u.lang = voz.lang.replace("_", "-"); } else u.lang = "en-US";
  u.rate = velocidad; u.pitch = 1.05; u.volume = 1;
  actual = u;
  let empezo = false, termino = false;
  const fin = () => { if (!termino) { termino = true; resolver(); } };
  u.onstart = () => { empezo = true; fallasSeguidas = 0; anotar(`Habló con ${voz ? voz.name : "en-US"}`); };
  // Terminar sin haber empezado = no sonó (pasa con voces que el aparato anuncia pero no tiene)
  u.onend = () => { if (!empezo && !termino && actual === u) fallo("terminó sin sonar"); fin(); };
  u.onerror = (e) => { const err = e?.error || "error"; if (!NO_ES_FALLA.has(err)) fallo(err); fin(); };
  // Algunas voces no avisan nunca: si en 4 s no empezó (y nadie la interrumpió), cuenta como falla
  setTimeout(() => { if (!empezo && !termino && actual === u) { fallo("no empezó en 4 s"); fin(); } }, 4000);
  setTimeout(fin, 4000 + (texto.length * 160) / velocidad);
  try { sintesis.resume?.(); sintesis.speak(u); } catch (e) { fallo(String(e?.message || e)); fin(); }
}

export const Voz = {
  listo,
  // ¿Se intenta hablar? Mientras el navegador no haya dado su lista, se intenta en en-US.
  get hay() { return !!sintesis && !!Utterance && !rota && (candidatas.length > 0 || !cargadas); },
  get nombre() { const v = candidatas[k]; return v ? `${v.name} (${v.lang})` : "la voz en inglés del navegador"; },
  // Dice el texto en inglés. velocidad: 0.85 para niños; "despacio" 0.55. Promesa que se cumple al terminar.
  decir(texto, velocidad = 0.85) {
    if (!Voz.hay) return Promise.resolve();
    desbloquear();
    return new Promise((resolver) => {
      if (sintesis.speaking || sintesis.pending) {
        actual = null;
        sintesis.cancel();
        setTimeout(() => hablar(texto, velocidad, resolver), 120);   // speak() justo después de cancel() se pierde
      } else hablar(texto, velocidad, resolver);
    });
  },
  callar() { actual = null; if (sintesis && (sintesis.speaking || sintesis.pending)) sintesis.cancel(); },
  // fn() cuando la voz deja de funcionar en este aparato (el juego enseña un aviso)
  alFallar(fn) { oyentesFalla.add(fn); },
  // Volver a intentar desde la primera voz (botón "Probar la voz" de papás)
  reintentar() { rota = false; k = 0; fallasSeguidas = 0; anotar("Reintentando"); },
  estado() {
    const todas = sintesis ? sintesis.getVoices() || [] : [];
    return {
      soporte: !!sintesis && !!Utterance,
      voces: todas.length,
      ingles: candidatas.map((v) => `${v.name} (${v.lang}${v.localService === false ? ", red" : ""})`),
      usando: candidatas[k] ? candidatas[k].name : null,
      rota, bitacora: [...bitacora],
    };
  },
};
