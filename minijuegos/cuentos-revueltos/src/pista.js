// La pista dice cómo se hace. La respuesta no aparece hasta un intento fallido.
// «En español» es el último escalón, y solo en las preguntas.
import { TEXTOS } from "./textos.js";

export const FLECHA_MS = 20000;
export const COMPLETA_MS = 40000;
export const ESPANOL_MS = 52000;

const PREGUNTA = new Set(["palabra", "quien", "porque", "cambio", "pagina"]);

export function esPregunta(tipo) {
  return PREGUNTA.has(tipo);
}

export function fasePista({ nivel, tipo, ms, errores }) {
  const pregunta = esPregunta(tipo);
  const n = Number(nivel) || 0;
  const e = Number(errores) || 0;
  const tiempo = Number(ms);
  const t = Number.isFinite(tiempo) ? tiempo : 0;
  if (n <= 1) {
    if (pregunta && e >= 1) return "espanol";
    return "completa";
  }
  if (pregunta && (e >= 2 || (e >= 1 && t >= COMPLETA_MS) || t >= ESPANOL_MS)) return "espanol";
  if (e >= 1 || t >= COMPLETA_MS) return "completa";
  if (t >= FLECHA_MS) return "flecha";
  return "corta";
}

// El paso completo por tiempo o por error no cuenta como primer intento, salvo en el nivel 1.
export function marcaPasoCompleto({ nivel, fase, ms, errores }) {
  if ((Number(nivel) || 0) <= 1) return false;
  if (fase !== "completa" && fase !== "espanol") return false;
  const t = Number(ms) || 0;
  return t >= COMPLETA_MS || (Number(errores) || 0) >= 1;
}

export function textoCorto(tipo) {
  if (tipo === "ordenar") return "¿Qué pasa primero?";
  if (tipo === "palabra") return "Mira la oración.";
  if (tipo === "quien") return "Mira quién.";
  if (tipo === "porque") return "Mira por qué.";
  if (tipo === "cambio") return "Mira qué cambió.";
  if (tipo === "pagina") return "Mira los dibujos.";
  if (tipo === "cruce") return "Elige un final.";
  return "";
}

export function fraseListo(tv) {
  return tv
    ? { texto: "Pulsa OK en Listo.", voz: "Pulsa OK en Listo." }
    : { texto: "Toca Listo.", voz: "Toca Listo." };
}

// Con Listo encendido solo se dice eso. No se le suma «¿Qué pasa primero?».
export function pistaConListo({ completo, nivel, tv, pista }) {
  if (!completo) return pista || "";
  if ((Number(nivel) || 0) <= 1) return tv ? TEXTOS.brillaTv : TEXTOS.brillaToca;
  return fraseListo(!!tv).texto;
}

export function cuentaPrimeraPregunta({ nivel, vioCompleta, acerto }) {
  if (!acerto) return false;
  if ((nivel | 0) > 1 && vioCompleta) return false;
  return true;
}

export function itemLimpio(ahora) {
  return {
    aviso: "",
    errores: 0,
    vioCompleta: false,
    reloj: { inicio: ahora, pausa: null },
    ayuda: null,
  };
}
