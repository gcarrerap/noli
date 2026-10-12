// Reto del día. La semilla es la fecha: el mismo día da el mismo reto. Sin reloj.
// Censo: muchos animales (de 5 a 12 por recinto); cuenta los 4 y contesta 3 preguntas: 5 de 7 a la primera.
// Detective: la gráfica trae 2 errores; arréglala a la primera y contesta 3 preguntas: 3 de 4.
import { rngConSemilla, hash } from "./rng.js";
import { crearVisita } from "./niveles.js";

export const RETOS = {
  censo: { tipo: "censo", nombre: "Censo", meta: "Muchos animales. Cuenta 4 recintos y contesta 3 preguntas. Necesitas 5 de 7.", items: 7, necesita: 5 },
  detective: { tipo: "detective", nombre: "Detective", meta: "La gráfica trae 2 errores. Arréglala y contesta 3 preguntas. Necesitas 3 de 4.", items: 4, necesita: 3 },
};

export const tipoDelDia = (fecha) => (hash("safari-" + fecha) % 2 ? "detective" : "censo");

// pool: ids de los animales abiertos.
export function retoDelDia(fecha, pool) {
  const tipo = tipoDelDia(fecha);
  const rnd = rngConSemilla("noli-safari-reto-" + fecha);
  const visita = tipo === "censo"
    ? crearVisita(2, rnd, { pool, min: 5, max: 12, plan: [["cuantos"], ["difMas", "difMenos"], ["juntos2"]] })
    : crearVisita(6, rnd, { pool, errores: 2, plan: [["difMas", "difMenos"], ["juntos2"], ["mas", "menos"]] });
  return { fecha, ...RETOS[tipo], visita: { ...visita, reto: tipo } };
}
