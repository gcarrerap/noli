// El único reto es Puerta secreta: 6 puertas, 4 a la primera. Sin reloj.
import { rngConSemilla } from "./rng.js";
import { generarTurno } from "./puertas.js";
import { POR_TURNO } from "./progreso.js";

export const RETO = {
  id: "puerta-secreta",
  tipo: "puerta-secreta",
  nombre: "Puerta secreta",
  meta: "6 puertas. Meta: 4.",
  cuantos: POR_TURNO,
  necesita: 4,
  contrarreloj: false,
};

export function retoDelDia(fecha, nivel, fallos) {
  const n = Math.max(1, Math.min(7, nivel | 0));
  const rnd = rngConSemilla(`robot-puerta-secreta-${fecha}-n${n}`);
  return { ...RETO, nivel: n, puertas: generarTurno(n, rnd, fallos || []) };
}
