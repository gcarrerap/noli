// Escalera de pistas. En el nivel 1 el paso completo sale enseguida
// y sí cuenta como a la primera. Desde el 2: frase, flecha a los 20 s
// y el paso completo a los 40 s o tras un error (eso ya no es a la primera).

import { decirUnidad, hablaSegura } from "./medida.js";

export const IDLE_ENCIMA_MS = 20000;
export const IDLE_COMPLETA_MS = 40000;

export function fasePista({ nivel = 1, ms = 0, fallo = false } = {}) {
  if ((nivel | 0) <= 1) return "completa";
  if (fallo || ms >= IDLE_COMPLETA_MS) return "completa";
  if (ms >= IDLE_ENCIMA_MS) return "encima";
  return "frase";
}

export function anulaPrimera({ nivel = 1, vioCompleta = false, fallo = false, ceroMal = false, ensucio = false } = {}) {
  if (ceroMal || ensucio) return true;
  if ((nivel | 0) <= 1) return false;
  return !!(vioCompleta || fallo);
}

export function cuentaPrimera(opts) {
  return !!opts.ok && !anulaPrimera(opts);
}

export function glifoMas(modo) {
  return modo === "tv" ? "▲" : "+";
}

export function glifoMenos(modo) {
  return modo === "tv" ? "▼" : "−";
}

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

function rellenar(texto, mapa) {
  return Object.entries(mapa).reduce((s, [k, v]) => s.split(k).join(String(v)), String(texto || ""));
}

export function textoPista(cruce, fase, textos, faseJuego = "") {
  const t = textos || {};
  if (!cruce) return "";
  const n = cruce.nivel | 0;
  const ceroYaPuesto = n === 2 && faseJuego && faseJuego !== "poner";
  if (n <= 1) return t.pistaBloques || "";
  if (fase === "frase") {
    if (n === 2) return ceroYaPuesto ? "" : (t.pistaCero || "");
    if (n === 7 || cruce.tipo === "desfase") return t.pistaEspacios || "";
    if (n === 5 || n === 6 || cruce.tipo === "juntar" || cruce.tipo === "comparar") return t.pistaBarras || "";
    if (cruce.tipo === "estima" || cruce.tipo === "arbol") return t.pistaEstima || "";
    return t.pistaMira || "";
  }
  if (fase === "encima") return t.pistaMiraAqui || "";
  if (n === 2) {
    if (ceroYaPuesto) return rellenar(t.pistaMedida, { "{medida}": decirUnidad(cruce.longitud, cruce.unidad) });
    return t.pistaCeroLarga || "";
  }
  if (n === 7 || cruce.tipo === "desfase") {
    const a = cruce.desplazaInicial | 0;
    const b = a + (cruce.longitud | 0);
    return rellenar(t.pistaEspaciosLarga, { "{a}": a, "{b}": b, "{n}": cruce.longitud | 0 });
  }
  if (n === 5 || cruce.tipo === "juntar") {
    const partes = (cruce.solucion || []).join(" y ");
    return String(t.pistaSuma || "").replace("{partes}", partes);
  }
  if (n === 6 || cruce.tipo === "comparar") {
    return String(t.pistaResta || "").replace("{n}", decirUnidad(cruce.longitud, cruce.unidad === "in" ? "in" : "cm"));
  }
  return String(t.pistaMedida || "").replace("{medida}", decirUnidad(cruce.longitud, cruce.unidad));
}

export function vozPista(texto) {
  return hablaSegura(texto);
}

// A quién señala la flecha cuando la pista ya está encima.
export function blancoFlecha(cruce, fase) {
  if (!cruce || fase === "frase") return "";
  const n = cruce.nivel | 0;
  if (n === 2) return "cero";
  if (cruce.tipo === "desfase" || n === 7) return "marca";
  if (cruce.tipo === "juntar" || n === 5) return "tablas";
  if (cruce.tipo === "comparar" || n === 6) return "diferencia";
  if (cruce.tipo === "estima" || cruce.tipo === "arbol") return "referencia";
  return "marca";
}
