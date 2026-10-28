// Puerta de papás (#67): la multiplicación que pide la ventana de créditos antes de regalar o quitar créditos.
// Lógica pura: recibe la hora (`ahora`) y el azar (`rnd`), y no lee localStorage (eso lo hace ui/components/creditos.js).
//
// Contra toques al azar y OK en ráfaga en la TV:
// - La correcta cae en cualquier botón y puede ser la menor, la de en medio o la mayor de las tres.
// - Se ignoran las respuestas hasta 1.5 s después de que aparece cada pregunta, y cualquier toque (o flecha u OK
//   en la TV) reinicia esa espera. Un toque solo cuenta si llegó con la espera ya cumplida (`armada`).
// - Después de un error, 2 s de espera y otra pregunta.
// - Hay que acertar 2 seguidas (1 de cada 9 por azar), cada una con pregunta y posiciones nuevas.
// - Con 2 fallos la puerta se cierra un rato que crece (30 s → 2 min → 5 min) y se reinicia cuando entra un adulto.
// Lo que debe sobrevivir a recargar (fallos, cierres y hasta cuándo está cerrada) es `guardable(estado)`.

export const PUERTA = {
  espera: 1500,          // ms sin tocar antes de aceptar una respuesta
  esperaError: 2000,     // ms después de un error
  aciertos: 2,           // correctas seguidas para abrir
  fallos: 2,             // fallos para cerrar
  descansos: [30000, 120000, 300000],
};

/** Una multiplicación 6–9 × 6–9 con 3 opciones; la correcta en cualquier lugar y de cualquier tamaño relativo. */
export function nuevaPregunta(rnd = Math.random) {
  const n = (k) => Math.floor(rnd() * k);
  const a = 6 + n(4), b = 6 + n(4), r = a * b;
  const tomar = (lista, k) => {
    const l = [...new Set(lista)];
    for (let i = l.length - 1; i > 0; i--) { const j = n(i + 1); [l[i], l[j]] = [l[j], l[i]]; }
    return l.slice(0, k);
  };
  const debajo = n(3); // cuántas opciones quedan por debajo de la correcta: 0, 1 o 2
  const opciones = [r, ...tomar([r - a, r - b, r - 10, r - 1], debajo), ...tomar([r + a, r + b, r + 10, r + 1], 2 - debajo)];
  return { a, b, r, opciones: tomar(opciones, 3) };
}

/** Normaliza lo guardado en localStorage. */
export function leerPuerta(g) {
  const num = (v) => (Number.isFinite(v) && v >= 0 ? v : 0);
  return { fallos: num(g && g.fallos), cierres: num(g && g.cierres), cerradaHasta: num(g && g.cerradaHasta) };
}

export const guardable = (e) => ({ fallos: e.fallos, cierres: e.cierres, cerradaHasta: e.cerradaHasta });

export const cerrada = (e, ahora) => e.cerradaHasta > ahora;

/** Entrar a la puerta (cada vez que se abre): racha en cero, espera completa, pregunta nueva y sin mensaje anterior. */
export function entrar(guardado, ahora, rnd = Math.random) {
  return { ...leerPuerta(guardado), racha: 0, abierta: false, armada: false, listaDesde: ahora + PUERTA.espera,
    pregunta: nuevaPregunta(rnd), error: "" };
}

/** Un toque en la puerta (o una flecha u OK en la TV): ¿llegó con la espera cumplida? Y la espera vuelve a empezar. */
export function tocar(e, ahora) {
  return { ...e, armada: ahora >= e.listaDesde, listaDesde: Math.max(e.listaDesde, ahora + PUERTA.espera) };
}

/** Responder con `n`. Solo cuenta si el toque que la trajo estaba armado y la puerta no está cerrada. */
export function responder(e, n, ahora, rnd = Math.random) {
  if (e.abierta || cerrada(e, ahora) || !e.armada) return { ...e, armada: false };
  if (n === e.pregunta.r) {
    const racha = e.racha + 1;
    if (racha >= PUERTA.aciertos) return { ...e, racha, abierta: true, armada: false, fallos: 0, cierres: 0, cerradaHasta: 0, error: "" };
    return { ...e, racha, armada: false, listaDesde: ahora + PUERTA.espera, pregunta: nuevaPregunta(rnd), error: "" };
  }
  const fallos = e.fallos + 1;
  if (fallos >= PUERTA.fallos) {
    const espera = PUERTA.descansos[Math.min(e.cierres, PUERTA.descansos.length - 1)];
    return { ...e, racha: 0, armada: false, fallos: 0, cierres: e.cierres + 1, cerradaHasta: ahora + espera,
      listaDesde: ahora + espera + PUERTA.espera, pregunta: nuevaPregunta(rnd), error: "" };
  }
  return { ...e, racha: 0, fallos, armada: false, listaDesde: ahora + PUERTA.esperaError, pregunta: nuevaPregunta(rnd),
    error: "Esa no es. Intenta otra vez." };
}

/** "30 segundos", "2 minutos": cuánto falta para que abra. */
export function faltaTexto(e, ahora) {
  const s = Math.max(1, Math.ceil((e.cerradaHasta - ahora) / 1000));
  if (s < 60) return s === 1 ? "1 segundo" : `${s} segundos`;
  const m = Math.ceil(s / 60);
  return m === 1 ? "1 minuto" : `${m} minutos`;
}
