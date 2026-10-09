// Tonos cortos, iguales para todas las rarezas. Si no hay audio, no pasa nada.

const NOTAS = { bruma1: 220, bruma2: 277, figura: 330, rareza: 392 };
let ctx = null;

function audio() {
  const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") {
    try { ctx.resume(); } catch { /* el navegador lo deja en silencio */ }
  }
  return ctx;
}

export function sonar(etapa) {
  const nota = NOTAS[etapa];
  const a = audio();
  if (!a || !nota) return;
  try {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = "sine";
    o.frequency.value = nota;
    const t = a.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(g);
    g.connect(a.destination);
    o.start(t);
    o.stop(t + 0.3);
  } catch { /* sin sonido */ }
}
