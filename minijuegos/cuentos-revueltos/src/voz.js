// Inglés: grabaciones (Piper, 0,45 s de silencio). Si faltan, la voz del sistema en inglés.
// Instrucciones y ayudas: voz del sistema en español. El texto sigue en pantalla.
// getVoices() vacío es «todavía no sé», no «no hay voz»: se habla igual, con el idioma
// y sin una voz concreta. Cuando llega voiceschanged, se elige. Un error o una voz
// que no arranca no es «ya terminó». Solo onstart y luego onend llama a alTerminar.

const VIGILIA_MS = 700;
const PREFIJO = { es: /^es([-_]|$)/i, en: /^en([-_]|$)/i };
const ETIQUETA = { es: "es-MX", en: "en-US" };
const memoria = new WeakMap();
const preparados = new WeakSet();

let turno = 0;
let audio = null;

function sintesisReal() {
  return typeof window !== "undefined" ? window.speechSynthesis : null;
}

function UtteranceReal() {
  return typeof window !== "undefined" ? window.SpeechSynthesisUtterance : null;
}

function elemento() {
  if (!audio && typeof Audio !== "undefined") audio = new Audio();
  return audio;
}

function callarAudio() {
  try { if (audio) { audio.pause(); audio.src = ""; } } catch { /* sigue el texto */ }
}

function callarHabla() {
  try {
    const s = sintesisReal();
    if (s && (s.speaking || s.pending)) s.cancel();
  } catch { /* nada */ }
}

export function callar() {
  turno += 1;
  callarAudio();
  callarHabla();
}

function vivoDe(mio) {
  return () => mio === turno;
}

function bolsa(s) {
  let m = memoria.get(s);
  if (!m) { m = { es: null, en: null }; memoria.set(s, m); }
  return m;
}

function anotarVoces(s) {
  let lista = [];
  try { lista = s.getVoices?.() || []; } catch { lista = []; }
  if (!lista.length) return;
  const m = bolsa(s);
  for (const idioma of ["es", "en"]) {
    const v = lista.find((x) => PREFIJO[idioma].test(x.lang || ""));
    if (v) m[idioma] = v;
  }
}

// Pide la lista al abrir la página. Si llega vacía, se espera a voiceschanged.
export function prepararVoces(s) {
  const motor = s || sintesisReal();
  if (!motor || preparados.has(motor)) return;
  preparados.add(motor);
  try { motor.getVoices?.(); } catch { /* calienta la lista */ }
  anotarVoces(motor);
  const tomar = () => anotarVoces(motor);
  if (typeof motor.addEventListener === "function") motor.addEventListener("voiceschanged", tomar);
  else {
    const prev = motor.onvoiceschanged;
    motor.onvoiceschanged = () => { tomar(); if (typeof prev === "function") prev(); };
  }
}

function vozElegida(s, idioma) {
  anotarVoces(s);
  return bolsa(s)[idioma] || null;
}

// Habla un texto. `sintesis` y `Utterance` se pueden sustituir en las pruebas.
// alTerminar solo si la voz arrancó y llegó al final. Si no, alFallar.
export function hablarTexto(texto, lang, opts = {}) {
  const alTerminar = opts.alTerminar;
  const alFallar = opts.alFallar;
  const s = opts.sintesis !== undefined ? opts.sintesis : sintesisReal();
  const U = opts.Utterance !== undefined ? opts.Utterance : UtteranceReal();
  const despues = opts.despues || ((fn, ms) => setTimeout(fn, ms));
  const cancelar = opts.cancelar || ((id) => clearTimeout(id));
  const vigilia = opts.vigiliaMs ?? VIGILIA_MS;
  const vivo = opts.vivo || (() => true);
  const fallo = (motivo) => { if (vivo()) alFallar?.(motivo); };

  if (!s || !U || !texto) { fallo("sin-sintesis"); return false; }

  try {
    try { if (s.speaking || s.pending) s.cancel(); } catch { /* nada */ }
    prepararVoces(s);
    const idioma = lang === "es" ? "es" : "en";
    const u = new U(texto);
    const voz = vozElegida(s, idioma);
    if (voz) { u.voice = voz; u.lang = String(voz.lang || ETIQUETA[idioma]).replace("_", "-"); }
    else u.lang = ETIQUETA[idioma];
    u.rate = lang === "es" ? 0.95 : 0.9;

    let arranco = false;
    let cerrado = false;
    let reloj = null;
    const cerrarReloj = () => {
      if (reloj != null) { cancelar(reloj); reloj = null; }
    };
    const terminar = () => {
      if (cerrado || !vivo()) return;
      cerrado = true;
      cerrarReloj();
      if (arranco) alTerminar?.();
      else fallo("no-arranco");
    };
    const error = (ev) => {
      if (!vivo() || cerrado) return;
      const err = ev?.error || "";
      if (err === "interrupted" || err === "canceled" || err === "cancelled") return;
      cerrado = true;
      cerrarReloj();
      fallo(err || "error");
    };
    u.onstart = () => { if (vivo()) arranco = true; };
    u.onend = terminar;
    u.onerror = error;
    try { s.resume?.(); } catch { /* nada */ }
    s.speak(u);
    reloj = despues(() => {
      if (cerrado || !vivo() || arranco) return;
      cerrado = true;
      try { s.cancel?.(); } catch { /* nada */ }
      fallo("no-arranco");
    }, vigilia);
    return true;
  } catch {
    fallo("error");
    return false;
  }
}

export function decirEs(texto, alTerminar, alFallar) {
  const mio = ++turno;
  callarAudio();
  return hablarTexto(texto, "es", {
    alTerminar: () => { if (mio === turno) alTerminar?.(); },
    alFallar: (m) => { if (mio === turno) alFallar?.(m); },
    vivo: vivoDe(mio),
  });
}

export function decirEn(texto, alTerminar, alFallar) {
  const mio = ++turno;
  callarAudio();
  return hablarTexto(texto, "en", {
    alTerminar: () => { if (mio === turno) alTerminar?.(); },
    alFallar: (m) => { if (mio === turno) alFallar?.(m); },
    vivo: vivoDe(mio),
  });
}

// Suena un mp3. Si el archivo falla, prueba la voz del sistema.
// Si esa también falla, alFallar: no se llama alTerminar y la frase no se salta.
export function decirGrabacion(url, opts = {}) {
  const mio = ++turno;
  callarHabla();
  const { respaldo, alDuracion, alTiempo, alTerminar, alFallar } = opts;
  const fin = () => { if (mio === turno) alTerminar?.(); };
  const fallar = (m) => { if (mio === turno) alFallar?.(m); };
  let usoVoz = false;
  const porVoz = () => {
    if (mio !== turno || usoVoz) return;
    usoVoz = true;
    if (!respaldo) { fallar("sin-audio"); return false; }
    const t0 = Date.now();
    const despues = opts.despues || ((fn, ms) => setTimeout(fn, ms));
    const cancelar = opts.cancelar || ((id) => clearTimeout(id));
    let reloj = null;
    const parar = () => { if (reloj != null) { cancelar(reloj); reloj = null; } };
    const tick = () => {
      if (mio !== turno) { parar(); return; }
      alTiempo?.(Date.now() - t0);
      reloj = despues(tick, 90);
    };
    reloj = despues(tick, 90);
    return hablarTexto(respaldo, "en", {
      alTerminar: () => { parar(); fin(); },
      alFallar: (m) => { parar(); fallar(m); },
      vivo: vivoDe(mio),
      sintesis: opts.sintesis,
      Utterance: opts.Utterance,
      despues,
      cancelar,
      vigiliaMs: opts.vigiliaMs,
    });
  };
  const a = elemento();
  if (!a) return porVoz();
  a.onloadedmetadata = () => {
    if (mio !== turno) return;
    const ms = Number.isFinite(a.duration) ? a.duration * 1000 : 0;
    alDuracion?.(ms);
  };
  a.ontimeupdate = () => { if (mio === turno && !usoVoz) alTiempo?.(a.currentTime * 1000); };
  a.onended = () => { if (!usoVoz) fin(); };
  a.onerror = porVoz;
  try {
    a.src = url;
    const p = a.play();
    if (p && p.catch) p.catch(() => porVoz());
  } catch {
    porVoz();
  }
  return true;
}

prepararVoces();

let suelto = false;
export function desbloquear() {
  if (suelto || typeof Audio === "undefined") return;
  suelto = true;
  try {
    const a = elemento();
    a.muted = true;
    const p = a.play();
    if (p && p.then) p.then(() => { a.pause(); a.muted = false; }, () => { a.muted = false; suelto = false; });
  } catch { suelto = false; }
}
