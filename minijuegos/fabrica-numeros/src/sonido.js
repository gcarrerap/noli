// Sonidos cortos con el sintetizador del navegador (sin archivos).
// El clic sube de tono con cada pieza. No hay sonido de error.

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
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.start(t);
  o.stop(t + dur);
}

// paso: cuántas piezas quedan en la banda (el tono sube con el número)
export function clic(paso) {
  tono(260 + Math.max(0, paso) * 32, 0.07, "triangle", 0.06);
}

export function maquina() {
  tono(180, 0.12, "sawtooth", 0.03);
  tono(90, 0.16, "square", 0.02);
}

export function listo() {
  tono(523, 0.1, "triangle", 0.05);
  setTimeout(() => tono(659, 0.12, "triangle", 0.05), 90);
}
