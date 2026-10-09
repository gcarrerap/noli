// Guía fija de 2 partes iguales.
// Los pasos 0, 1 y 2 solo muestran algo: avanzan con cualquier toque, con OK o solos a los 2 s.
// El paso 3 es servir: solo avanza al pulsar la pizza igual. OK repetido no lo salta.
// Con «¿Salir?» abierto solo valen Seguir y Salir. El foco nunca cae en Saltar solo.
// En el paso 3 el foco está en la pizza igual, para que OK la sirva.

export const GUIA_TOQUE_MS = 2000;
export const PASOS_GUIA = 4;

const MIRAR = [
  "Corta en 2 partes iguales.",
  "Esta no: una es más grande.",
  "Esta sí: las 2 son iguales.",
  "Tócala para servir.",
];

export function guiaAvanzaConToque(paso) {
  return paso === 0 || paso === 1 || paso === 2;
}

export function guiaServirActivo(paso) {
  return paso === 3;
}

// En los pasos de mirar el foco se queda en la frase.
// En servir cae en la pizza igual. Saltar no recibe el foco solo.
export function focoDeGuia(paso) {
  if (paso === 3) return "buena";
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

// Con el diálogo abierto, Seguir y Salir no cambian el paso.
// Fuera de él, un paso de mirar avanza; servir se queda en «jugar».
export function toqueDuranteGuia(paso, { dialogoAbierto = false, ir = "" } = {}) {
  if (dialogoAbierto) {
    if (ir === "seguir-juego") return { accion: "seguir", paso };
    if (ir === "salir-juego") return { accion: "salir", paso };
    return { accion: "nada", paso };
  }
  if (ir === "saltar-guia") return { accion: "saltar", paso };
  if (guiaAvanzaConToque(paso)) return { accion: "avanzar", paso: paso + 1 };
  return { accion: "jugar", paso };
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
  if (paso === 3 && tipo === "activar" && op === "buena") return 4;
  return paso;
}

export function guiaTerminada(paso) {
  return paso >= PASOS_GUIA;
}
