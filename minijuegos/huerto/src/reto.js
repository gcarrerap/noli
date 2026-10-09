// Reto del día: Huerto grande. 6 encargos, 4 bien. La semilla es la fecha.
import { rngConSemilla } from "./rng.js";
import { crearTemporada, POR_TEMPORADA } from "./niveles.js";

export const RETO_GRANDE = {
  tipo: "grande",
  nombre: "Huerto grande",
  meta: "6 encargos. Necesitas 4.",
  cuantos: POR_TEMPORADA,
  necesita: 4,
};

export function retoDelDia(fecha, nivelActual) {
  const n = Math.max(1, Math.min(6, nivelActual | 0 || 1));
  const rnd = rngConSemilla("noli-huerto-reto-" + fecha);
  return { fecha, n, ...RETO_GRANDE, problemas: crearTemporada(n, rnd) };
}
