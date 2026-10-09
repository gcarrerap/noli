// Instrucciones en español (voz del sistema). Palabras en inglés: la grabación
// de Spelling si existe, y si no la voz en inglés del sistema. El texto sigue en pantalla.
import { tieneGrabacion } from "./banco.js";

export function limpiarHabla(texto) {
  return String(texto || "")
    .replace(/[▲▼◀▶+×]/g, " ")
    .replace(/[−–]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function urlGrabacion(palabra) {
  const w = String(palabra || "").toLowerCase();
  return new URL(`../../spelling/audio/p/${w}.mp3`, import.meta.url).href;
}

const sintesis = () => (typeof window !== "undefined" ? window.speechSynthesis : null);
const Utterance = () => (typeof window !== "undefined" ? window.SpeechSynthesisUtterance : null);

let audioEl = null;
let turno = 0;
let cacheVoces = [];

// getVoices() vacío significa «aún no llegaron», no «no hay voz».
export function usarVoces(lista) {
  cacheVoces = Array.isArray(lista) ? lista : [];
}

export function elegirVoz(voces, lang) {
  const lista = Array.isArray(voces) ? voces : [];
  const want = String(lang || "").toLowerCase();
  if (!want || !lista.length) return null;
  const exacta = lista.find((v) => String(v?.lang || "").toLowerCase() === want);
  if (exacta) return exacta;
  const base = want.split("-")[0];
  return lista.find((v) => String(v?.lang || "").toLowerCase().startsWith(base)) || null;
}

function leerVoces(s) {
  try {
    const lista = s && typeof s.getVoices === "function" ? s.getVoices() : null;
    if (lista && lista.length) cacheVoces = lista;
    return lista || [];
  } catch {
    return [];
  }
}

// Al cargar se pide la lista (en Chrome llega vacía) y voiceschanged elige la voz.
export function calentarVoces(s) {
  if (!s) return;
  leerVoces(s);
  const tomar = () => { leerVoces(s); };
  if (typeof s.addEventListener === "function") s.addEventListener("voiceschanged", tomar);
  else {
    const previo = s.onvoiceschanged;
    s.onvoiceschanged = () => {
      tomar();
      if (typeof previo === "function") previo();
    };
  }
}

function elemento() {
  if (!audioEl && typeof Audio !== "undefined") audioEl = new Audio();
  return audioEl;
}

export function desbloquear() {
  const a = elemento();
  if (!a) return;
  const ctx = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
  if (ctx) {
    try {
      const c = new ctx();
      if (c.state === "suspended") c.resume().catch(() => {});
    } catch { /* sin audio */ }
  }
}

export function callar() {
  turno++;
  try { if (audioEl) { audioEl.pause(); } } catch { /* ya calló */ }
  const s = sintesis();
  try { if (s && (s.speaking || s.pending)) s.cancel(); } catch { /* sin voz */ }
}

// acabo es true solo si la frase empezó y terminó bien.
// Un onerror o una frase que no arranca no cuentan como el final:
// la guía se queda con su temporizador (de 2 s a 3 s).
// getVoices() vacío no es «no hay voz»: se habla igual, sin voz concreta, con el lang.
export function hablarSistema(texto, lang, deps = {}) {
  const s = deps.sintesis || sintesis();
  const U = deps.Utterance || Utterance();
  const topeMs = deps.topeMs ?? 3000;
  const mio = deps.mio;
  return new Promise((resolver) => {
    let cerrado = false;
    let reloj = 0;
    let vigilar = 0;
    const cerrar = (acabo) => {
      if (cerrado) return;
      cerrado = true;
      if (reloj) clearTimeout(reloj);
      if (vigilar) clearInterval(vigilar);
      resolver({ acabo: acabo === true });
    };
    const limpio = limpiarHabla(texto);
    if (!limpio || !s || !U) { cerrar(false); return; }
    const pedidas = Array.isArray(deps.voces) ? deps.voces : null;
    const vivas = pedidas || leerVoces(s);
    const conocidas = vivas.length ? vivas : cacheVoces;
    let empezo = false;
    reloj = setTimeout(() => cerrar(false), topeMs);
    vigilar = setInterval(() => {
      if (mio != null && mio !== turno) cerrar(false);
    }, 80);
    try {
      if (s.speaking || s.pending) s.cancel();
      const u = new U(limpio);
      const lengua = lang || "es-MX";
      u.lang = lengua;
      u.rate = String(lengua).startsWith("es") ? 0.92 : 0.85;
      const voz = elegirVoz(conocidas, lengua);
      if (voz) u.voice = voz;
      u.onstart = () => { empezo = true; };
      u.onend = () => cerrar(empezo);
      u.onerror = () => cerrar(false);
      s.speak(u);
    } catch { cerrar(false); }
  });
}

if (typeof window !== "undefined") calentarVoces(sintesis());

function sistema(texto, lang, mio) {
  return hablarSistema(texto, lang, { mio });
}

function sonar(url, mio) {
  return new Promise((resolver, rechazar) => {
    const a = elemento();
    if (!a) { rechazar(new Error("sin audio")); return; }
    let listo = false;
    const fin = (ok) => {
      if (listo) return;
      listo = true;
      if (ok) resolver();
      else rechazar(new Error("audio"));
    };
    a.onended = () => fin(true);
    a.onerror = () => fin(false);
    a.src = url;
    const p = a.play();
    if (p && p.catch) p.catch(() => fin(false));
    setTimeout(() => fin(true), 8000);
    const vigilar = setInterval(() => {
      if (mio !== turno) { clearInterval(vigilar); fin(true); }
    }, 120);
  });
}

function decirUna(palabra, mio) {
  const w = String(palabra || "").toLowerCase();
  if (!w) return Promise.resolve();
  if (!tieneGrabacion(w)) return sistema(w, "en-US", mio);
  return sonar(urlGrabacion(w), mio).catch(() => (mio === turno ? sistema(w, "en-US", mio) : undefined));
}

export function decirEs(texto, { activo = true } = {}) {
  if (!activo) return Promise.resolve();
  const mio = ++turno;
  return sistema(texto, "es-MX", mio);
}

export function decirIngles(texto, { activo = true } = {}) {
  if (!activo) return Promise.resolve();
  const mio = ++turno;
  return sistema(texto, "en-US", mio);
}

export function decirPalabra(palabra, opts) {
  return decirLista([palabra], opts);
}

export function decirLista(palabras, { activo = true } = {}) {
  if (!activo) return Promise.resolve();
  const lista = (palabras || []).filter(Boolean);
  if (!lista.length) return Promise.resolve();
  const mio = ++turno;
  return lista.reduce((p, w) => p.then(() => (mio === turno ? decirUna(w, mio) : undefined)), Promise.resolve());
}

// La palabra en inglés y, al terminar, la frase en español. Una sola tanda.
export function decirPalabraLuego(palabra, espanol, { activo = true } = {}) {
  if (!activo) return Promise.resolve();
  const mio = ++turno;
  return decirUna(palabra, mio).then(() => (mio === turno ? sistema(espanol, "es-MX", mio) : undefined));
}
