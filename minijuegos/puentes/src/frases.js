// Frases en un solo lugar: los textos viven en datos/textos.json.
import { decirUnidad, hablaSegura } from "./medida.js";

export function promptDe(cruce, fase, textos, modo = "tactil") {
  const t = textos || {};
  if (!cruce) return "";
  if (fase === "bien") return t.pregBien;
  if (fase === "cuantos") return t.pregCuantos;
  if (fase === "poner") return modo === "tv" ? t.ponReglaTv : t.ponRegla;
  if (fase === "tabla") return t.buscaTabla;
  if (fase === "estima" || fase === "estimaLibre") return cruce.tipo === "arbol" ? t.pregArbol : t.pregEstima;
  if (fase === "leer") return t.leeMedida;
  if (fase === "juntar") return String(t.junta || "").replace("{medida}", decirUnidad(cruce.longitud, cruce.unidad));
  if (fase === "comparar") return t.pregLargo;
  return "";
}

export function vozDeFase(cruce, fase, textos, modo = "tactil") {
  const base = hablaSegura(promptDe(cruce, fase, textos, modo));
  if (!cruce) return base;
  if (fase === "estima" || fase === "estimaLibre" || fase === "leer" || fase === "comparar" || fase === "juntar") {
    return hablaSegura(`${base} ${notaReferencia(cruce, textos, true)}`);
  }
  return base;
}

export function notaReferencia(cruce, textos, voz = false) {
  const t = textos || {};
  if (!cruce || !cruce.referencia) return "";
  if (cruce.referencia === "clip") return voz ? t.refClipVoz : t.refClip;
  if (cruce.referencia === "tabla10") return voz ? t.refTablaVoz : t.refTabla;
  if (cruce.referencia === "cubito") return voz ? t.refCuboVoz : t.refCubo;
  if (cruce.referencia === "tabla1in") return voz ? t.refTablaInVoz : t.refTablaIn;
  if (cruce.referencia === "clipin") return voz ? t.refClipInVoz : t.refClipIn;
  return "";
}

export function explicaBloques(modo, textos) {
  const t = textos || {};
  if (modo === "hueco") return t.explicaHueco || "";
  if (modo === "encimado") return t.explicaEncima || "";
  return t.explicaBien || "";
}

// Qué pasó con los bloques, dicho justo después de contestar mal (#76).
export function avisoBloques(modo, textos) {
  const t = textos || {};
  if (modo === "hueco") return t.avisoHueco || "";
  if (modo === "encimado") return t.avisoEncima || "";
  return t.avisoBienEra || "";
}

export function nombreZona(zona, textos) {
  const t = textos || {};
  if (zona === "pantano") return t.zonaPantano;
  if (zona === "nieve") return t.zonaNieve;
  return t.zonaBosque;
}

export function medidaDicha(n, unidad) {
  return decirUnidad(n, unidad);
}
