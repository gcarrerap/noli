// Pistas. El brillo (con sonido y foco) solo existe en Decora y Bandeja.
// En Corta y Forma, tocar la opción ya es la respuesta.

export const IDLE_ENCIMA_MS = 20000;
export const IDLE_COMPLETA_MS = 40000;

export function glifoMas(modo) {
  return modo === "tv" ? "▲" : "+";
}

export function glifoMenos(modo) {
  return modo === "tv" ? "▼" : "−";
}

// Quita símbolos que no se deben oír.
export function hablaSegura(texto) {
  return String(texto || "").replace(/[▲▼+−½¼⅓⅔]/g, " ").replace(/\s+/g, " ").trim();
}

export function fasePista({ nivel, tipo, ms = 0, fallo = false }) {
  if (tipo === "forma" || (nivel | 0) <= 1) return "completa";
  if (tipo === "decora" || tipo === "bandeja" || tipo === "cuantos") return "completa";
  if (tipo === "entero" || tipo === "mayor") return "frase";
  if (fallo || ms >= IDLE_COMPLETA_MS) return "completa";
  if (ms >= IDLE_ENCIMA_MS) return "encima";
  return "frase";
}

export function debeBrillar(tipo, coincide) {
  return (tipo === "decora" || tipo === "bandeja") && !!coincide;
}

export function cuentaParaDominio({ nivel, tipo, vioCompleta }) {
  if (tipo === "forma" || (nivel | 0) <= 1) return true;
  if (tipo === "decora" || tipo === "bandeja" || tipo === "cuantos" || tipo === "entero" || tipo === "mayor") return true;
  return !vioCompleta;
}

export function textoPista(pedido, fase, textos) {
  const t = textos || {};
  if (!pedido) return "";
  if (pedido.tipo === "forma") return pedido.pide === "esquinas" ? t.pistaEsquinas : t.pistaLados;
  if (pedido.tipo === "decora") return pedido.pista || "";
  if (pedido.tipo === "bandeja") return pedido.pista || "";
  if (pedido.tipo === "cuantos") return t.cuantos || "";
  if (pedido.tipo === "entero") return t.pistaEntero || "";
  if (pedido.tipo === "mayor") return t.pistaMayor || "";
  if (fase === "encima") return t.pistaEncima || "";
  if (fase === "completa") return t.pistaIguales || "";
  return t.pistaMismo || "";
}
