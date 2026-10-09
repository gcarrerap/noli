// Reto del día: Reloj misterioso. 6 horas, 4 bien. No es contrarreloj.
// La semilla es la fecha, así que sale igual en la tele y en el teléfono.
import { rngConSemilla } from "./rng.js";
import { planDia, POR_TURNO } from "./niveles.js";

export const RETO = {
  tipo: "misterioso",
  nombre: "Reloj misterioso",
  meta: "6 horas. Meta: 4.",
  cuantos: POR_TURNO,
  necesita: 4,
};

export function retoDelDia(fecha, nivel) {
  const n = Math.max(1, Math.min(6, nivel | 0));
  const rnd = rngConSemilla(`reloj-misterioso-${fecha}-n${n}`);
  const escenas = planDia(n, rnd, { cuantos: POR_TURNO, soloLeer: true, nivelReto: n });
  return { ...RETO, nivel: n, escenas };
}
