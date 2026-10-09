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

// En la TV el contador enfocado sube con ▲. En el teléfono, con +.
// La voz dice la misma idea sin símbolos.
export function textoContador(modo) {
  return modo === "tv" ? "Pulsa ▲" : "Pulsa +";
}

export function vozContador(modo) {
  return modo === "tv" ? "Pulsa arriba" : "Pulsa más";
}

export function pistaVisible(texto, { resuelto = false, revelado = false } = {}) {
  if (resuelto || revelado) return "";
  return texto || "";
}

// Quita símbolos que no se deben oír.
export function hablaSegura(texto) {
  return String(texto || "").replace(/[▲▼+−½¼⅓⅔]/g, " ").replace(/\s+/g, " ").trim();
}

export function fasePista({ nivel, tipo, ms = 0, fallo = false }) {
  if (tipo === "forma" || (nivel | 0) <= 1) return "completa";
  if (tipo === "cuantos") return "completa";
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
  if (tipo === "cuantos" || tipo === "entero" || tipo === "mayor") return true;
  return !vioCompleta;
}

export function textoPista(pedido, fase, textos, modo = "tactil") {
  const t = textos || {};
  if (!pedido) return "";
  if (pedido.tipo === "forma") return pedido.pide === "esquinas" ? t.pistaEsquinas : t.pistaLados;
  if (pedido.tipo === "decora") {
    if (fase === "completa") return pedido.pista || "";
    return modo === "tv" ? (t.pistaDecoraTv || "Pulsa OK en una rebanada") : (t.pistaDecora || "Toca una rebanada");
  }
  if (pedido.tipo === "bandeja") {
    if (fase === "completa") return pedido.pista || "";
    return textoContador(modo);
  }
  if (pedido.tipo === "cuantos") return t.cuantos || "";
  if (pedido.tipo === "entero") return t.pistaEntero || "";
  if (pedido.tipo === "mayor") return t.pistaMayor || "";
  if (fase === "encima") return t.pistaEncima || "";
  if (fase === "completa") return t.pistaIguales || "";
  return t.pistaMismo || "";
}
