// Sonidos cortos con el sintetizador del navegador. No hay sonido de error:
// el que se equivoca es el dragón, y el chiste no debe sonar más divertido que acertar.

let ctx = null;

function audio() {
  if (ctx) return ctx;
  const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try { ctx = new AC(); } catch { ctx = null; }
  return ctx;
}

export function desbloquear() {
  const c = audio();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}

function tono(frecuencia, dur, tipo, vol) {
  const c = audio();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = tipo;
  o.frequency.value = frecuencia;
  g.gain.value = vol;
  o.connect(g);
  g.connect(c.destination);
  const t = c.currentTime;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.start(t);
  o.stop(t + dur);
}

export function clic() {
  tono(520, 0.06, "triangle", 0.05);
}

// Listo brilla: un tintineo corto, distinto de la campanada.
export function listo() {
  tono(660, 0.08, "triangle", 0.05);
  setTimeout(() => tono(880, 0.1, "triangle", 0.05), 80);
}

// Campanada al dar la hora buena.
export function campanada() {
  tono(784, 0.35, "sine", 0.07);
  setTimeout(() => tono(523, 0.55, "sine", 0.06), 160);
}
