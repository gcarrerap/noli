// Voz. El inglés suena con GRABACIONES (audio/…mp3, voz neuronal de Piper; herramientas/grabar.py): suenan
// igual en cualquier navegador, también en la TV LG. Si una no se puede sonar, la voz en inglés del navegador
// (speechSynthesis) la dice como respaldo. Las instrucciones en español van con la voz del navegador.
// Un solo <audio> para todo; el primer toque o tecla lo «desbloquea» (iPhone y Chrome no dejan sonar antes).
// Cada cosa nueva que se dice calla la anterior (turno).

const sintesis = () => (typeof window !== "undefined" ? window.speechSynthesis : null);
const Utterance = () => (typeof window !== "undefined" ? window.SpeechSynthesisUtterance : null);
const SILENCIO = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

let audioEl = null;
let turno = 0;
let desbloqueado = false;

export function limpiarHabla(texto) {
  return String(texto || "").replace(/[▲▼◀▶+×«»]/g, " ").replace(/\s+/g, " ").trim();
}

export const urlAudio = (archivo) => new URL(`../audio/${archivo}`, import.meta.url).href;

function elemento() {
  if (!audioEl && typeof Audio !== "undefined") audioEl = new Audio();
  return audioEl;
}

export function desbloquear() {
  if (desbloqueado) return;
  desbloqueado = true;
  const a = elemento();
  if (a) { try { a.src = SILENCIO; const p = a.play(); if (p && p.catch) p.catch(() => {}); } catch { /* sin audio */ } }
}

export function callar() {
  turno++;
  try { if (audioEl) audioEl.pause(); } catch { /* ya calló */ }
  const s = sintesis();
  try { if (s && (s.speaking || s.pending)) s.cancel(); } catch { /* sin voz */ }
}

function elegirVoz(lang) {
  const s = sintesis();
  let lista = [];
  try { lista = (s && s.getVoices()) || []; } catch { lista = []; }
  const base = lang.split("-")[0];
  return lista.find((v) => String(v.lang || "").replace("_", "-").toLowerCase() === lang.toLowerCase())
    || lista.find((v) => String(v.lang || "").toLowerCase().startsWith(base)) || null;
}

// Promesa que se cumple al terminar (o a los pocos segundos si la voz no avisa). Nunca falla.
function hablarSistema(texto, lang, mio) {
  return new Promise((resolver) => {
    const s = sintesis(), U = Utterance(), limpio = limpiarHabla(texto);
    if (!s || !U || !limpio || mio !== turno) { resolver(); return; }
    let listo = false;
    const fin = () => { if (!listo) { listo = true; resolver(); } };
    try {
      const u = new U(limpio);
      u.lang = lang;
      u.rate = lang.startsWith("es") ? 0.95 : 0.85;
      const v = elegirVoz(lang);
      if (v) u.voice = v;
      u.onend = fin;
      u.onerror = fin;
      if (s.speaking || s.pending) s.cancel();
      setTimeout(() => { if (mio === turno) { try { s.speak(u); } catch { fin(); } } else fin(); }, 60);
    } catch { fin(); }
    setTimeout(fin, 2500 + limpio.length * 90);
  });
}

function sonar(archivo, mio) {
  return new Promise((resolver, rechazar) => {
    const a = elemento();
    if (!a) { rechazar(new Error("sin audio")); return; }
    let listo = false;
    const fin = (ok) => { if (listo) return; listo = true; clearInterval(vigila); ok ? resolver() : rechazar(new Error("audio")); };
    a.onended = () => fin(true);
    a.onerror = () => fin(false);
    const vigila = setInterval(() => { if (mio !== turno) fin(true); }, 120);
    try {
      a.src = urlAudio(archivo);
      const p = a.play();
      if (p && p.catch) p.catch(() => fin(false));
    } catch { fin(false); }
    setTimeout(() => fin(true), 15000);
  });
}

// Dice en inglés una lista de { archivo, texto }, una tras otra. alCadaUna(i) avisa cuál empieza (para
// marcar la oración que suena). Promesa que se cumple al terminar todas o al callar.
export function decirIngles(partes, { alCadaUna } = {}) {
  const mio = ++turno;
  const lista = (partes || []).filter((p) => p && (p.archivo || p.texto));
  return lista.reduce((cadena, p, i) => cadena.then(() => {
    if (mio !== turno) return undefined;
    if (alCadaUna) alCadaUna(i);
    const respaldo = () => (mio === turno ? hablarSistema(p.texto, "en-US", mio) : undefined);
    return p.archivo ? sonar(p.archivo, mio).catch(respaldo) : respaldo();
  }), Promise.resolve()).then(() => { if (mio === turno && alCadaUna) alCadaUna(-1); });
}

export function decirEs(texto) {
  const mio = ++turno;
  return hablarSistema(texto, "es-MX", mio);
}
