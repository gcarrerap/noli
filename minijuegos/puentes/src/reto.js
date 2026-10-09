// Reto del día. La semilla es la fecha. No hay reloj.
// Ojo de águila: 6 estimaciones, 4 dentro de ±2, siempre con una referencia.
// Puente largo: 6 cruces de varias tablas, 4 bien, sin contrarreloj.

import { rngConSemilla } from "./rng.js";
import { cerca } from "./medida.js";
import { cruceArbol, cruceEstimaLibre, cruceLargo, sumaValida } from "./niveles.js";

export const META = { cuantos: 6, necesita: 4, margen: 2 };

export function tipoDeFecha(fecha) {
  const rnd = rngConSemilla("noli-puentes-reto-tipo-" + fecha);
  return rnd() < 0.5 ? "aguila" : "largo";
}

export function retoDelDia(fecha, ajuste, textos, tv = false) {
  const tipo = tipoDeFecha(fecha);
  const rnd = rngConSemilla("noli-puentes-reto-" + fecha + "-" + (ajuste || "ambas"));
  if (tipo === "largo") return retoLargo(fecha, rnd, ajuste, textos, tv);
  return retoAguila(fecha, rnd, ajuste, textos);
}

function retoAguila(fecha, rnd, ajuste, textos) {
  const unidad = ajuste === "in" ? "in" : "cm";
  const problemas = [];
  for (let i = 0; i < 5; i++) problemas.push(cruceEstimaLibre(rnd, i, unidad));
  problemas.push(cruceArbol(rnd));
  return {
    fecha, tipo: "aguila",
    nombre: textos.retoAguila, meta: textos.retoAguilaMeta,
    ...META, problemas,
  };
}

function retoLargo(fecha, rnd, ajuste, textos, tv) {
  const unidad = ajuste === "in" ? "in" : "cm";
  const problemas = Array.from({ length: META.cuantos }, (_, i) => cruceLargo(rnd, i, unidad, tv));
  return {
    fecha, tipo: "largo",
    nombre: textos.retoLargo, meta: textos.retoLargoMeta,
    cuantos: META.cuantos, necesita: META.necesita, margen: 0, problemas,
  };
}

export function estimaBien(dicho, real, margen = META.margen) {
  return cerca(dicho, real, margen);
}

export function retosCoherentes(reto) {
  if (!reto || reto.problemas.length !== META.cuantos) return false;
  if (reto.limiteMs || reto.reloj || reto.segundos) return false;
  if (reto.tipo === "aguila") {
    return reto.problemas.every((p) => p.referencia && (p.tipo === "estima" || p.tipo === "arbol"));
  }
  return reto.problemas.every((p) => p.tipo === "juntar" && sumaValida(p) && p.piezas >= 2);
}
