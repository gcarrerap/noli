// Guía fija de 2 partes iguales.
// Los pasos 0 y 2 solo muestran algo: avanzan con cualquier toque, con OK o solos a los 2 s.
// Los pasos 1 y 3 son acciones: solo avanzan si ella hace ese paso. OK repetido no los salta.
// Servir (la pizza igual) no responde hasta el paso 3. El foco nunca cae en Saltar solo.

export const GUIA_TOQUE_MS = 2000;
export const PASOS_GUIA = 4;

const MIRAR = [
  "Corta en 2 partes iguales.",
  "Esta no: una es más grande.",
  "Esta sí: las 2 son iguales.",
  "Tócala para servir.",
];

export function guiaAvanzaConToque(paso) {
  return paso === 0 || paso === 2;
}

export function guiaServirActivo(paso) {
  return paso === 3;
}

// El foco de la guía se queda en la frase. Así, pulsar OK otra vez no
// elige una pizza ni salta el paso de acción. Saltar no recibe el foco solo.
export function focoDeGuia() {
  return "pedido-guia";
}

export function textoDeGuia(paso, textos, modo = "tactil") {
  const i = Math.max(0, Math.min(MIRAR.length - 1, paso | 0));
  if (i === 3) {
    if (modo === "tv") return (textos && textos.guiaServirTv) || "Pulsa OK para servir.";
    const lista = textos && textos.guia;
    return (lista && lista[3]) || MIRAR[3];
  }
  const lista = (textos && textos.guia) || MIRAR;
  return lista[i] || MIRAR[i];
}

export function vozDeGuia(paso, textos, modo = "tactil") {
  return String(textoDeGuia(paso, textos, modo)).replace(/[▲▼+−½¼⅓⅔]/g, " ").replace(/\s+/g, " ").trim();
}

// evento: { tipo: "toque" | "ok" | "tiempo" | "activar", opcion?, repetido? }
// 4 significa que la guía terminó.
export function siguientePasoGuia(paso, evento) {
  if (!evento || evento.repetido) return paso;
  const tipo = evento.tipo;
  const op = evento.opcion;
  if (guiaAvanzaConToque(paso) && (tipo === "toque" || tipo === "ok" || tipo === "tiempo" || tipo === "activar")) {
    return paso + 1;
  }
  if (paso === 1 && tipo === "activar" && op === "mala") return 2;
  if (paso === 3 && tipo === "activar" && op === "buena") return 4;
  return paso;
}

export function guiaTerminada(paso) {
  return paso >= PASOS_GUIA;
}
