// Reto del día, sin reloj. La semilla es la fecha, así que sale igual en todos los aparatos.
// Un día es Censo grande (hasta 20 animales). El otro, Detective (6 gráficas, 4 bien).
import { hash, rngConSemilla } from "./rng.js";
import { crearCenso, crearVisita } from "./niveles.js";

export const META_RETO = 4;
export const LARGO_RETO = 6;

export function tipoReto(fecha) {
  return hash("safari-" + fecha) % 2 === 0 ? "censo" : "detective";
}

export function retoDelDia(fecha, nivelActual) {
  const tipo = tipoReto(fecha);
  const n = Math.max(1, Math.min(6, nivelActual | 0 || 1));
  const rnd = rngConSemilla("noli-safari-datos-" + fecha);
  if (tipo === "censo") {
    const visita = crearCenso(rnd, n);
    return {
      fecha,
      tipo,
      nombre: "Censo grande",
      meta: "Hasta 20 animales. Necesitas 4 de 6.",
      cuantos: visita.elementos.length,
      necesita: META_RETO,
      visita,
    };
  }
  const visita = crearVisita(6, rnd, { hechosDetective: n >= 6 ? 4 : 0, forzarAltura: n < 6 });
  return {
    fecha,
    tipo,
    nombre: "Detective",
    meta: "6 gráficas, 4 bien. Cada una tiene un error.",
    cuantos: visita.elementos.length,
    necesita: META_RETO,
    visita,
  };
}
