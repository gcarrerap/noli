// Pistas por escalera. En el nivel 1 el paso va completo.
// Desde el 2: frase, flecha a los 20 s y paso completo a los 40 s o tras un error.
// Ese paso completo (a los 40 s) ya no cuenta como a la primera.
import { animal } from "./animales.js";

export const FLECHA_S = 20;
export const COMPLETA_S = 40;
export const FLECHA_MS = FLECHA_S * 1000;
export const COMPLETA_MS = COMPLETA_S * 1000;

function escalon(nivel, segundos, errores) {
  if ((nivel | 0) <= 1) return "completo";
  if ((errores | 0) > 0 || segundos >= COMPLETA_S) return "completo";
  if (segundos >= FLECHA_S) return "flecha";
  return "corto";
}

function fraseBarra(id, meta, actual, tv) {
  const plural = animal(id).plural;
  if (meta > actual) {
    return tv
      ? { texto: `Pulsa arriba hasta ${meta}.`, leer: `Pulsa arriba hasta ${meta}.` }
      : { texto: `Sube los ${plural} hasta ${meta}.`, leer: `Sube los ${plural} hasta ${meta}.` };
  }
  return tv
    ? { texto: `Pulsa abajo hasta ${meta}.`, leer: `Pulsa abajo hasta ${meta}.` }
    : { texto: `Baja los ${plural} hasta ${meta}.`, leer: `Baja los ${plural} hasta ${meta}.` };
}

function pistaContar(elemento, estado, paso, tv) {
  const plural = animal(elemento.id).plural;
  if (paso === "corto") return { paso, texto: "Toca cada animal.", leer: "Toca cada animal.", flecha: null, linea: false };
  const i = (estado.marcados || []).findIndex((m) => !m);
  if (paso === "flecha") {
    return { paso, texto: "Toca cada animal.", leer: "Toca cada animal.", flecha: i >= 0 ? "animal-" + i : "opciones", linea: false };
  }
  const como = tv ? `Pulsa OK en cada ${animal(elemento.id).es}.` : `Toca cada ${animal(elemento.id).es}.`;
  return {
    paso,
    texto: `${como} Escoge el ${elemento.cantidad}.`,
    leer: `${como} Escoge el ${elemento.cantidad}.`,
    flecha: null,
    linea: false,
    plural,
  };
}

function pistaGrafica(elemento, estado, paso, tv) {
  const metas = elemento.categorias.map((c) => c.cantidad);
  const alturas = estado.alturas || metas.map(() => 0);
  let i = metas.findIndex((m, k) => alturas[k] !== m);
  if (i < 0) i = 0;
  if (paso === "corto") return { paso, texto: "Iguala cada animal.", leer: "Iguala cada animal.", flecha: null, linea: false };
  if (paso === "flecha") return { paso, texto: "Mira esta barra.", leer: "Mira esta barra.", flecha: "barra-" + i, linea: false };
  const frase = fraseBarra(elemento.categorias[i].id, metas[i], alturas[i] || 0, tv);
  return { paso, ...frase, flecha: "barra-" + i, linea: false };
}

function pistaPregunta(elemento, paso) {
  if (elemento.clase === "diferencia") {
    if (paso === "corto") return { paso, texto: "Compara las dos barras.", leer: "Compara las dos barras.", flecha: null, linea: false };
    if (paso === "flecha") return { paso, texto: "Mira la barra corta.", leer: "Mira la barra corta.", flecha: "baja", linea: true, sombra: false };
    return { paso, texto: `Son ${elemento.correcta} más.`, leer: `Son ${elemento.correcta} más.`, flecha: "baja", linea: true, sombra: true };
  }
  if (elemento.clase === "total" || elemento.clase === "total-todos") {
    if (paso === "corto") return { paso, texto: "Junta los números.", leer: "Junta los números.", flecha: null, linea: false, luces: false };
    if (paso === "flecha") return { paso, texto: "Suma una y luego la otra.", leer: "Suma una y luego la otra.", flecha: "barras", linea: false, luces: true };
    return { paso, texto: `Son ${elemento.correcta}.`, leer: `Son ${elemento.correcta}.`, flecha: "barras", linea: false, luces: true };
  }
  if (elemento.clase === "mas") {
    if (paso === "corto") return { paso, texto: "Busca la barra más alta.", leer: "Busca la barra más alta.", flecha: null, linea: false };
    if (paso === "flecha") return { paso, texto: "Mira la más alta.", leer: "Mira la más alta.", flecha: "alta", linea: false };
    const nombre = animal(elemento.correcta).plural;
    return { paso, texto: `Hay más ${nombre}.`, leer: `Hay más ${nombre}.`, flecha: "alta", linea: false };
  }
  if (paso !== "completo") return { paso, texto: "Mira la gráfica.", leer: "Mira la gráfica.", flecha: paso === "flecha" ? "opciones" : null, linea: false };
  return { paso, texto: `Es ${elemento.correcta}.`, leer: `Es ${elemento.correcta}.`, flecha: null, linea: false };
}

function pistaDetective(elemento, paso) {
  const id = elemento.error === "falta"
    ? elemento.falta
    : elemento.realIds[elemento.errorIndice] || elemento.realIds[0];
  const otra = `Cuenta otra vez los ${animal(id).plural}.`;
  if (paso === "corto") return { paso, texto: "Mira la gráfica.", leer: "Mira la gráfica.", flecha: null, linea: false };
  if (paso === "flecha") return { paso, texto: otra, leer: otra, flecha: elemento.error === "altura" ? "barra-" + elemento.errorIndice : "opciones", linea: false };
  if (elemento.error === "altura") {
    const frase = `Los ${animal(id).plural} son ${elemento.real[elemento.errorIndice]}.`;
    return { paso, texto: frase, leer: frase, flecha: "barra-" + elemento.errorIndice, linea: false };
  }
  if (elemento.error === "etiquetas") return { paso, texto: "Los nombres están cambiados.", leer: "Los nombres están cambiados.", flecha: null, linea: false };
  return { paso, texto: `Falta ${animal(elemento.falta).art} ${animal(elemento.falta).es}.`, leer: `Falta ${animal(elemento.falta).art} ${animal(elemento.falta).es}.`, flecha: null, linea: false };
}

export function pista(elemento, estado, opts = {}) {
  const paso = escalon(opts.nivel || 1, opts.segundos || 0, opts.errores || 0);
  const tv = !!opts.tv;
  const vacio = { paso: "nada", texto: "", leer: "", flecha: null, linea: false, sombra: false, luces: false };
  if (!elemento || (estado && estado.fase === "muestra")) return vacio;
  if (elemento.tipo === "contar") return { sombra: false, luces: false, ...pistaContar(elemento, estado || {}, paso, tv) };
  if (elemento.tipo === "grafica") return { sombra: false, luces: false, ...pistaGrafica(elemento, estado || {}, paso, tv) };
  if (elemento.tipo === "pregunta") return { sombra: false, luces: false, ...pistaPregunta(elemento, paso, tv) };
  if (elemento.tipo === "detective") return { sombra: false, luces: false, ...pistaDetective(elemento, paso, tv) };
  return vacio;
}

export function marcaPasoCompleto(nivel, paso, segundos) {
  return (nivel | 0) > 1 && paso === "completo" && segundos >= COMPLETA_S;
}
