// Reloj de manecillas. El horario va unido al minutero, como uno de verdad:
// de :55 se pasa a :00 de la hora siguiente. Ángulos con el 12 arriba y el sentido del reloj.
// El centro del SVG es (0, 0); rotar un grupo con rotate(G) lo gira en ese sentido.

export const PASO = 5;
export const VUELTAS_MAX = 12; // más de una vuelta del minutero no cuenta como a la primera
export const GAG_MS = 1500;

// Atrás en el chiste o en el acierto pregunta si salir. Otra tecla salta la espera.
export function atrasEnEspera(fase) {
  if (fase === "gag" || fase === "bien") return "salir";
  if (fase) return "seguir";
  return "";
}

// Con «¿Salir?» abierto, Seguir y Salir funcionan aunque el chiste o el acierto sigan.
// En el teléfono, un toque en lo oscuro detrás del diálogo es Seguir.
export function toqueEnPantalla({ fase = "", act = "", dialog = false, fondo = false } = {}) {
  if (dialog && act === "salir-si") return "salir";
  if (dialog && (act === "seguir" || fondo)) return "seguir";
  if (dialog || fase) return "nada";
  return act || "otro";
}

// Al cerrar el diálogo no se vuelve a contar el chiste entero: sigue lo que quedaba,
// y si ya se acabó pasa a las manecillas o a la escena siguiente.
export function alCerrarEspera(fase, queda) {
  const ms = Math.max(0, Number(queda) || 0);
  if (ms > 0) return { hacer: "esperar", ms };
  if (fase === "gag") return { hacer: "manos", ms: 0 };
  if (fase === "bien") return { hacer: "siguiente", ms: 0 };
  return { hacer: "", ms: 0 };
}

export function hora12(h) {
  return ((h % 12) + 12) % 12 || 12;
}

export function digital(h, m) {
  const min = ((Math.round(m) % 60) + 60) % 60;
  return `${hora12(h)}:${String(min).padStart(2, "0")}`;
}

export function anguloMinutero(m) {
  return ((m % 60) + 60) % 60 * 6;
}

export function anguloHorario(h, m) {
  return (hora12(h) % 12) * 30 + (((m % 60) + 60) % 60) * 0.5;
}

// La corta queda entre dos números cuando no es en punto.
export function entreNumeros(h, m) {
  const min = ((m % 60) + 60) % 60;
  if (min === 0) return null;
  const a = hora12(h);
  const b = a === 12 ? 1 : a + 1;
  return { desde: a, hasta: b };
}

export function misma(a, b) {
  return hora12(a.h) === hora12(b.h) && ((a.m % 60) + 60) % 60 === ((b.m % 60) + 60) % 60;
}

export function esDoceEnPunto(h, m) {
  return hora12(h) === 12 && ((m % 60) + 60) % 60 === 0;
}

export function moverMinutos(t, pasos) {
  const total = t.h * 60 + t.m + pasos * PASO;
  const dia = ((total % 1440) + 1440) % 1440;
  return { h: Math.floor(dia / 60), m: dia % 60 };
}

export function moverHora(t, delta) {
  return { h: (t.h + delta + 240) % 24, m: t.m };
}

// 7:15 leída como 7:03: cada rayita de 5 minutos contada como un minuto.
export function lecturaRayitas(h, m) {
  return { h: hora12(h), m: Math.round(m / PASO) % 12 };
}

// Manecillas cambiadas: la larga se lee como hora y la corta como minutos.
// 8:15 (larga en el 3, corta casi en el 8) se lee 3:40.
export function lecturaCambiada(h, m) {
  const marca = Math.round(m / PASO) % 12;
  const horaLeida = marca === 0 ? 12 : marca;
  const ang = anguloHorario(h, m);
  let minLeidos = Math.round(ang / 6);
  minLeidos = Math.round(minLeidos / PASO) * PASO;
  minLeidos = ((minLeidos % 60) + 60) % 60;
  return { h: horaLeida, m: minLeidos };
}

// Pasando la media, la corta ya casi toca la hora siguiente: 7:50 leída como 8:50.
export function lecturaPasada(h, m) {
  if (m < 35) return null;
  return { h: hora12(h) + 1 === 13 ? 1 : hora12(h) + 1, m };
}

export function clave(t) {
  return `${hora12(t.h)}:${String(((t.m % 60) + 60) % 60).padStart(2, "0")}`;
}

// Candidatos de error, en el orden en que se prefieren. Siempre distintos de la hora buena.
export function candidatosLectura(h, m) {
  const buena = { h: hora12(h), m };
  const lista = [];
  const pasada = lecturaPasada(h, m);
  if (pasada) lista.push(pasada);
  lista.push(lecturaCambiada(h, m));
  if (m !== 0) lista.push(lecturaRayitas(h, m));
  lista.push({ h: hora12(h), m: (m + PASO) % 60 });
  lista.push({ h: hora12(h) === 1 ? 12 : hora12(h) - 1, m });
  const vistos = new Set([clave(buena)]);
  const out = [];
  for (const c of lista) {
    const k = clave(c);
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push({ h: hora12(c.h), m: c.m });
  }
  return out;
}

// Grados que recorre el minutero entre dos horas (el arco de «¿cuánto falta?»).
export function gradosTranscurridos(h0, m0, h1, m1) {
  let d = (h1 * 60 + m1) - (h0 * 60 + m0);
  d = ((d % 1440) + 1440) % 1440;
  return d * 6;
}

function punto(grados, r) {
  const t = (grados * Math.PI) / 180;
  return [Math.sin(t) * r, -Math.cos(t) * r];
}
function n(x) {
  return Math.round(x * 100) / 100;
}

// Rebanada desde la hora de ahora hasta la hora que viene. 60 minutos = el círculo entero.
export function sectorPath(h0, m0, h1, m1, r = 100) {
  const span = gradosTranscurridos(h0, m0, h1, m1);
  if (span <= 0) return "M0 0";
  if (span >= 359.9) {
    return `M ${n(-r)} 0 A ${r} ${r} 0 1 1 ${n(r)} 0 A ${r} ${r} 0 1 1 ${n(-r)} 0 Z`;
  }
  const a0 = anguloMinutero(m0);
  const a1 = a0 + span;
  const [x0, y0] = punto(a0, r);
  const [x1, y1] = punto(a1, r);
  const large = span > 180 ? 1 : 0;
  return `M 0 0 L ${n(x0)} ${n(y0)} A ${r} ${r} 0 ${large} 1 ${n(x1)} ${n(y1)} Z`;
}

// El dedo alrededor del centro: 0 arriba, sentido del reloj. Se ajusta a 5 minutos.
export function minutosDesdeAngulo(grados) {
  let g = ((grados % 360) + 360) % 360;
  let m = Math.round(g / 6) % 60;
  m = Math.round(m / PASO) * PASO;
  return m % 60;
}

// Al cruzar el 12, la hora cambia. `previoM` es el minuto anterior del arrastre.
export function arrastre(actual, grados, previoM) {
  const m = minutosDesdeAngulo(grados);
  let h = actual.h;
  let pasos = 0;
  if (previoM != null && previoM !== m) {
    if (previoM >= 50 && m <= 10) h = (h + 1) % 24;
    else if (previoM <= 10 && m >= 50) h = (h + 23) % 24;
    let d = Math.abs(m - previoM);
    if (d > 30) d = 60 - d;
    pasos = d / PASO;
  }
  return { h, m, pasos };
}

export function cuentaPrimera(intento, pasosMinuto) {
  return intento === 1 && pasosMinuto <= VUELTAS_MAX;
}
