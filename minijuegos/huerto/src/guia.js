// Guía fija: 2 filas de 3. Cada paso espera a que ella lo haga.
import { saltosArreglo } from "./niveles.js";

export const GUIA = {
  filas: 2,
  porFila: 3,
};

export const PASOS = ["pedido", "filas", "cada", "listo", "abejas"];

const COPIA = {
  pedido: { tactil: "Planta 2 filas de 3.", tv: "Planta 2 filas de 3.", leer: "Planta 2 filas de 3." },
  filas: { tactil: "Toca + hasta 2.", tv: "Pulsa ▲ hasta 2.", leer: "Toca más hasta 2." },
  cada: { tactil: "Pon 3.", tv: "Pon 3.", leer: "Pon 3." },
  listo: { tactil: "¡Brilla! Toca Listo.", tv: "¡Brilla! Toca Listo.", leer: "Brilla. Toca Listo." },
  abejas: { tactil: "Cuenta: 3, 6.", tv: "Cuenta: 3, 6.", leer: "Cuenta: 3, 6." },
};

export function saltosGuia() {
  return saltosArreglo(GUIA.filas, GUIA.porFila);
}

export function textoGuia(paso, tv) {
  const c = COPIA[paso] || COPIA.pedido;
  return { texto: tv ? c.tv : c.tactil, leer: c.leer };
}

// El paso visible sale de lo que ya hizo, no de un temporizador.
export function pasoGuia(estado) {
  if (estado.fase === "cosecha" || estado.fase === "saltar") return "abejas";
  if (!estado.acepto) return "pedido";
  if (estado.filas === GUIA.filas && estado.porFila === GUIA.porFila) return "listo";
  if (estado.filas === GUIA.filas) return "cada";
  return "filas";
}
