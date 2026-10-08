// La voz en inglés. Primero las GRABACIONES (audio/…mp3, hechas con herramientas/grabar.py): suenan igual en
// cualquier navegador, también en DuckDuckGo (WebView sin voces) y en la TV LG webOS. Si falta un archivo o no se
// puede reproducir, se usa la voz del navegador (speechSynthesis) como respaldo, con los arreglos que necesita:
//
// - Chrome y Safari a veces tiran un speak() que llega justo después de cancel(): solo se cancela si de verdad
//   está hablando, y entonces se espera un momento antes de hablar.
// - Chrome puede quedarse en pausa (resume() antes de hablar) y pierde la frase si nadie la guarda (se guarda).
// - Hay voces que existen pero no suenan: si una frase no empieza en unos segundos o da error, se prueba la
//   siguiente voz en inglés.
//
// iPhone y Chrome solo dejan sonar audio después de un toque: con el primer toque o tecla se "desbloquea" un solo
// elemento <audio> (que se usa para todo) con un sonido mudo. Si aun así nada suena, el juego avisa
// (Voz.alFallar) para que diga cómo arreglarlo. Nunca se enseña la palabra en su lugar.
// Voz.estado() junta todo para la pantalla "Para papás" (probar la voz en cada aparato).
import { buscar } from "./palabras.js";

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
const listoSintesis = new Promise((resolver) => {
  if (!sintesis || !Utterance) { anotar("Este navegador no tiene speechSynthesis"); return resolver(false); }
  revisar();
  sintesis.addEventListener?.("voiceschanged", () => { revisar(); if (candidatas.length) resolver(true); });
  if (candidatas.length) return resolver(true);
  setTimeout(() => { revisar(); resolver(Sintesis.hay); }, 3000);
});

// Con el primer toque o tecla: una frase muda para que iPhone y Chrome dejen hablar después
function desbloquearSintesis() {
  if (desbloqueada || !sintesis || !Utterance) return;
  desbloqueada = true;
  try { const u = new Utterance(" "); u.volume = 0; u.lang = "en-US"; sintesis.speak(u); } catch {}
}


function fallo(motivo) {
  anotar("Falla: " + motivo);
  fallasSeguidas++;
  // Primero otra voz en inglés; si ya no hay más y falló dos veces seguidas, nos rendimos
  if (k < candidatas.length - 1) { k++; anotar("Probando otra voz: " + (candidatas[k]?.name || "?")); return; }
  if (fallasSeguidas >= 2 || /not-allowed|synthesis-unavailable|audio-hardware|language-unavailable|voice-unavailable/.test(motivo)) {
    if (!rota) { rota = true; anotar("La voz del navegador no suena"); avisarSiNadaSuena(); }
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

const Sintesis = {
  // ¿Se intenta hablar? Mientras el navegador no haya dado su lista, se intenta en en-US.
  get hay() { return !!sintesis && !!Utterance && !rota && (candidatas.length > 0 || !cargadas); },
  get nombre() { const v = candidatas[k]; return v ? `${v.name} (${v.lang})` : "la voz en inglés del navegador"; },
  // Dice el texto en inglés. velocidad: 0.85 para niños; "despacio" 0.55. Promesa que se cumple al terminar.
  decir(texto, velocidad = 0.85) {
    if (!Sintesis.hay) return Promise.resolve();
    desbloquearSintesis();
    return new Promise((resolver) => {
      if (sintesis.speaking || sintesis.pending) {
        actual = null;
        sintesis.cancel();
        setTimeout(() => hablar(texto, velocidad, resolver), 120);   // speak() justo después de cancel() se pierde
      } else hablar(texto, velocidad, resolver);
    });
  },
  callar() { actual = null; if (sintesis && (sintesis.speaking || sintesis.pending)) sintesis.cancel(); },
  // Volver a intentar desde la primera voz (botón "Probar la voz" de papás)
  reintentar() { rota = false; k = 0; fallasSeguidas = 0; },
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

// ---------- Grabaciones ----------

const BASE = typeof window !== "undefined" ? new URL("../audio/", import.meta.url).href : "";
const ARCHIVO = {
  palabra: (w) => `${BASE}p/${w.toLowerCase()}.mp3`,
  despacio: (w) => `${BASE}d/${w.toLowerCase()}.mp3`,
  frase: (w) => `${BASE}f/${w.toLowerCase()}.mp3`,
  letra: (c) => `${BASE}l/${c.toLowerCase()}.mp3`,
  prueba: () => `${BASE}prueba.mp3`,
};
export const archivos = ARCHIVO;   // para las pruebas

let el = null;               // el único <audio>: el que se desbloquea con el primer toque
let turno = 0;               // cada cosa nueva que se dice cancela la anterior
let audioRoto = false;       // las grabaciones no suenan en este aparato
let bloqueado = false;       // el navegador no dejó reproducir (falta un toque)
let ultimoAudio = null;      // "sonó", o el error
const blobs = new Map();     // url → promesa de objectURL (precargado)

const elemento = () => { if (!el) { el = new Audio(); el.preload = "auto"; } return el; };

// Un WAV mudo de 50 ms, para desbloquear el <audio> dentro del primer toque
function silencio() {
  const n = 400, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const txt = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  txt(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); txt(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 16000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  txt(36, "data"); v.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

let desbloqueado = false;
function desbloquear() {
  if (desbloqueado || typeof Audio === "undefined") return;
  desbloqueado = true;
  if (el && !el.paused) return desbloquearSintesis();   // ya está sonando algo: ya quedó desbloqueado
  try { const a = elemento(); a.src = silencio(); const p = a.play(); p?.catch?.(() => { desbloqueado = false; }); } catch { desbloqueado = false; }
  desbloquearSintesis();
}
if (typeof document !== "undefined") {
  for (const ev of ["pointerdown", "keydown", "touchend"]) document.addEventListener(ev, desbloquear, { capture: true, passive: true });
}

// Baja el archivo una vez (queda en memoria y en la caché del service worker para jugar sin internet)
function cargar(url) {
  if (!blobs.has(url)) {
    blobs.set(url, fetch(url).then((r) => (r.ok ? r.blob() : Promise.reject(new Error("HTTP " + r.status))))
      .then((b) => URL.createObjectURL(b))
      .catch((e) => { anotar(`No se pudo bajar ${url.slice(BASE.length)}: ${e.message}`); blobs.delete(url); return null; }));
  }
  return blobs.get(url);
}

// Suena un archivo; true si sonó hasta el final, "bloqueado" si el navegador no dejó, false si falló
function sonar(src, mio) {
  return new Promise((res) => {
    const a = elemento();
    let listo = false;
    const fin = (r) => { if (!listo) { listo = true; res(r); } };
    a.onended = () => fin(true);
    a.onerror = () => fin(false);
    a.src = src;
    try {
      const p = a.play();
      p?.then?.(() => { bloqueado = false; ultimoAudio = "sonó"; }, (e) => fin(e?.name === "NotAllowedError" ? "bloqueado" : false));
    } catch { fin(false); }
    // Por si el navegador nunca avisa que terminó
    setTimeout(() => fin(true), 9000);
    const vigilar = setInterval(() => { if (mio !== turno) { clearInterval(vigilar); fin(true); } else if (listo) clearInterval(vigilar); }, 200);
  });
}

// Dice una serie de grabaciones una tras otra; si una no está o no suena, dice `respaldo` con la voz del navegador
async function reproducir(urls, respaldo, velocidad = 0.85) {
  const mio = ++turno;
  if (audioRoto) return Sintesis.decir(respaldo, velocidad);
  for (const u of urls) {
    const src = await cargar(u);
    if (mio !== turno) return;
    if (!src) return Sintesis.decir(respaldo, velocidad);
    const r = await sonar(src, mio);
    if (mio !== turno) return;
    if (r === "bloqueado") { bloqueado = true; ultimoAudio = "el navegador pidió un toque antes de sonar"; anotar("Audio bloqueado: falta un toque"); avisarSiNadaSuena(); return; }
    if (r === false) {
      ultimoAudio = "error al reproducir"; anotar("Error al reproducir " + u.slice(BASE.length));
      audioRoto = true; avisarSiNadaSuena();
      return Sintesis.decir(respaldo, velocidad);
    }
  }
}

const oyentesFalla = new Set();
function avisarSiNadaSuena() { if (!Voz.hay || bloqueado) for (const fn of oyentesFalla) fn(); }

export const Voz = {
  // Con grabaciones no hay que esperar a las voces del navegador (a lo más un momento, por el respaldo)
  listo: Promise.race([listoSintesis, new Promise((r) => setTimeout(r, 400))]),
  get hay() { return !audioRoto || Sintesis.hay; },
  get nombre() { return audioRoto ? Sintesis.nombre : "grabaciones (voz en inglés de EE. UU.)"; },
  palabra(w, lento = false) { return reproducir([lento ? ARCHIVO.despacio(w) : ARCHIVO.palabra(w)], w, lento ? 0.5 : 0.85); },
  frase(w) { const p = buscar(w); return reproducir([ARCHIVO.frase(w)], p ? p.frase : w, 0.85); },
  // "cake. C. A. K. E. cake."
  deletrear(w) {
    const letras = [...w.toLowerCase()].map(ARCHIVO.letra);
    return reproducir([ARCHIVO.palabra(w), ...letras, ARCHIVO.palabra(w)], `${w}. ${letraPorLetra(w)} ${w}.`, 0.75);
  },
  prueba() { return reproducir([ARCHIVO.prueba()], "Hello Noli! Can you spell cat? C. A. T. Cat."); },
  // Baja de una vez las grabaciones de una ronda (y las letras), para que suenen al instante
  precargar(palabras) {
    for (const w of palabras) { cargar(ARCHIVO.palabra(w)); cargar(ARCHIVO.frase(w)); }
    for (const c of "abcdefghijklmnopqrstuvwxyz") cargar(ARCHIVO.letra(c));
  },
  callar() { turno++; try { el?.pause(); } catch {} Sintesis.callar(); },
  alFallar(fn) { oyentesFalla.add(fn); },
  reintentar() { audioRoto = false; bloqueado = false; Sintesis.reintentar(); anotar("Reintentando"); },
  estado() {
    const s = Sintesis.estado();
    return { ...s, grabaciones: audioRoto ? "no suenan" : bloqueado ? "esperan un toque" : ultimoAudio || "sin probar todavía", rota: audioRoto && s.rota };
  },
};
