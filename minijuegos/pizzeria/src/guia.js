// Guía fija de 2 partes iguales. Cada paso avanza solo con su acción.
// 0: mirar una pizza. 1: señalar la desigual. 2: mirar la igual. 3: tocarla.

export const PASOS_GUIA = 4;

export function textoDeGuia(paso, textos) {
  const lista = (textos && textos.guia) || [
    "Corta en 2 partes iguales.",
    "Esta no: una es más grande.",
    "Esta sí: las 2 son iguales.",
    "Tócala para servir.",
  ];
  return lista[Math.max(0, Math.min(lista.length - 1, paso | 0))] || "";
}

export function vozDeGuia(paso, textos) {
  return textoDeGuia(paso, textos);
}

// evento: { tipo: "foco" | "activar", opcion: "mala" | "buena" | null }
// Devuelve el paso nuevo. 4 significa que la guía terminó.
export function siguientePasoGuia(paso, evento) {
  const tipo = evento && evento.tipo;
  const op = evento && evento.opcion;
  if (paso === 0 && tipo === "foco" && (op === "mala" || op === "buena")) return 1;
  if (paso === 1 && tipo === "activar" && op === "mala") return 2;
  if (paso === 2 && tipo === "foco" && op === "buena") return 3;
  if (paso === 3 && tipo === "activar" && op === "buena") return 4;
  return paso;
}

export function guiaTerminada(paso) {
  return paso >= PASOS_GUIA;
}
