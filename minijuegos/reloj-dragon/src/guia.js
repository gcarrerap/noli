// Guía de la primera vez. Ejemplo fijo: poner las 3:00.
// Cada paso avanza solo cuando ella hace esa acción. Saltar o Atrás la cierra.

export const META_GUIA = { h: 3, m: 0 };
export const INICIO_GUIA = { h: 1, m: 0 };
// Los pasos que solo explican («la corta», «la larga») siguen solos si nadie toca.
export const ESPERA_EXPLICAR_MS = 2000;

export const PASOS = [
  { id: "come", luz: "escena", texto: "El dragón come a las 3. Pon las 3.", voz: "El dragón come a las 3. Pon las 3." },
  { id: "corta", luz: "horario", texto: "La corta dice la hora.", voz: "La corta dice la hora." },
  { id: "sube", luz: "hora", voz: "Sube la corta al 3." },
  { id: "larga", luz: "minutero", texto: "La larga, en el 12.", voz: "La larga, en el 12." },
  { id: "listo", luz: "listo", texto: "¡Brilla! Toca Listo.", voz: "Brilla. Toca Listo." },
];

export function textoPaso(paso, tv) {
  const p = PASOS[paso];
  if (!p) return "";
  if (p.id === "sube") return `${tv ? "▲▼" : "+ −"} Sube la corta al 3.`;
  return p.texto;
}

export function vozPaso(paso) {
  return PASOS[paso]?.voz || "";
}

export function guiaNueva() {
  return { paso: 0, reloj: { ...INICIO_GUIA }, fin: false };
}

// Pasos 2 y 4 de la guía (índice 1 y 3): se miran, no hay que apretar un control apagado.
export function esExplicacion(paso) {
  const id = PASOS[paso]?.id;
  return id === "corta" || id === "larga";
}

// Al salir de una explicación, el control que toca usar queda marcado.
export function focoTrasExplicacion(paso) {
  if (paso === 2) return "hora";
  if (paso === 4) return "listo";
  return "escena";
}

function enMeta(reloj) {
  return (reloj.h % 12 || 12) === META_GUIA.h && reloj.m === 0;
}

// evento: { tipo: "escena" | "foco" | "mover" | "listo" | "saltar" | "seguir", control?, reloj? }
export function aplicarGuia(estado, evento) {
  if (estado.fin || evento.tipo === "saltar") return { ...estado, fin: true };
  const reloj = evento.reloj || estado.reloj;
  const paso = estado.paso;
  if (esExplicacion(paso) && evento.tipo === "seguir") return { paso: paso + 1, reloj, fin: false };
  if (paso === 0 && evento.tipo === "escena") return { paso: 1, reloj, fin: false };
  if (paso === 1 && evento.tipo === "foco" && evento.control === "hora") return { paso: 2, reloj, fin: false };
  if (paso === 2 && enMeta(reloj)) return { paso: 3, reloj, fin: false };
  if (paso === 3 && evento.tipo === "foco" && evento.control === "minutos" && reloj.m === 0 && enMeta(reloj)) {
    return { paso: 4, reloj, fin: false };
  }
  if (paso === 4 && evento.tipo === "listo" && enMeta(reloj)) return { paso: 5, reloj, fin: true };
  return { ...estado, reloj };
}
