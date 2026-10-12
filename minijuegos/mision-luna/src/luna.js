// Las fases de la Luna: cálculo sin internet y las preguntas de la etapa «En la Luna».
// Fases 0–7 vistas desde el hemisferio norte (en Kentucky): 0 nueva, 2 cuarto creciente (iluminada a la
// derecha), 4 llena, 6 cuarto menguante (iluminada a la izquierda).
import { revolver } from "./rng.js";

export const SINODICO = 29.530588853;                        // días de una luna nueva a la siguiente
const LUNA_NUEVA = Date.UTC(2000, 0, 6, 18, 14);            // una luna nueva conocida (6 ene 2000, 18:14 UTC)
const DIA_MS = 86400000;

// Edad de la Luna (días desde la última luna nueva) en un instante. Es el ciclo medio: se equivoca a lo más
// por unas horas, mucho menos que lo que dura una fase (unos 3.7 días).
export function edadLuna(ms) {
  const d = (ms - LUNA_NUEVA) / DIA_MS;
  return ((d % SINODICO) + SINODICO) % SINODICO;
}

export const faseDeEdad = (edad) => Math.floor((edad / SINODICO) * 8 + 0.5) % 8;

// La fase de la noche de una fecha "AAAA-MM-DD": a las 9 de la noche en el centro de EE. UU. (2:00 UTC del
// día siguiente). Un error de unas horas no cambia la fase salvo justo en el cambio.
export function faseDe(fecha) {
  const [y, m, d] = String(fecha).split("-").map(Number);
  return faseDeEdad(edadLuna(Date.UTC(y, m - 1, d + 1, 2)));
}

export const mod8 = (n) => ((n % 8) + 8) % 8;
export const principal = (f) => f % 2 === 0;

// Días que se muestran en el calendario: las 4 fases principales salen cada semana; las 8, cada 3 o 4 días.
export const DIAS_CALENDARIO = { 4: [1, 8, 15, 22], 8: [1, 5, 8, 12, 15, 19, 22, 26] };

// Calendario: la secuencia de fases desde una inicial y algunos días vacíos para acomodar.
// El primer día siempre trae su fase (la pista de dónde empieza); con 8 fases también otro más adelante.
// def: { fases: 4 | 8, huecos }
export function crearCalendario(def, rnd) {
  const total = def.fases === 8 ? 8 : 4;
  const paso = total === 8 ? 1 : 2;
  const inicio = total === 8 ? Math.floor(rnd() * 8) : 2 * Math.floor(rnd() * 4);
  const etiquetas = DIAS_CALENDARIO[total];
  const huecos = Math.max(1, Math.min(total - (total === 8 ? 2 : 1), def.huecos | 0));
  const posibles = revolver(rnd, Array.from({ length: total - 1 }, (_, i) => i + 1));
  const vacios = new Set(posibles.slice(0, huecos));
  const dias = etiquetas.map((dia, i) => ({ dia, fase: mod8(inicio + i * paso), fijo: !vacios.has(i) }));
  const bandeja = revolver(rnd, dias.filter((d) => !d.fijo).map((d) => d.fase));
  return { tipo: "calendario", total, paso, dias, bandeja };
}

// colocadas: { [índice del día]: fase }. Regresa los índices de días vacíos que faltan o están mal.
export function revisarCalendario(cal, colocadas) {
  return cal.dias.map((d, i) => (d.fijo || colocadas[i] === d.fase ? -1 : i)).filter((i) => i >= 0);
}

export const calendarioCompleto = (cal, colocadas) => cal.dias.every((d, i) => d.fijo || colocadas[i] != null);

// «¿Cómo se verá?»: hoy se ve una fase; ¿cómo se verá en una semana (2 fases después) o en dos (4)?
// Con 4 fases solo salen las principales y siempre «en una semana». Las opciones: la buena, la de hoy (no
// cambia) y la de ir hacia atrás (o otra, si ir hacia atrás da la misma que la buena).
export function crearNoche(def, rnd) {
  const total = def.fases === 8 ? 8 : 4;
  const hoy = total === 8 ? Math.floor(rnd() * 8) : 2 * Math.floor(rnd() * 4);
  const semanas = total === 8 && rnd() < 0.5 ? 2 : 1;
  const salto = semanas * 2;
  const correcta = mod8(hoy + salto);
  const candidatos = [hoy, mod8(hoy - salto), mod8(hoy + 2 * salto), mod8(hoy + salto + 2), mod8(hoy + salto - 2)]
    .filter((f) => f !== correcta && (total === 8 || principal(f)));
  const malas = [...new Set(candidatos)].slice(0, 2);
  return { tipo: "noche", total, hoy, semanas, correcta, opciones: revolver(rnd, [correcta, ...malas]) };
}
