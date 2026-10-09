// Pistas por escalera. En el nivel 1 el paso va completo.
// Desde el 2: frase, flecha a los 20 s y paso completo a los 40 s o tras un error.
// Ese paso completo (a los 40 s) ya no cuenta como a la primera.
import { animal, los } from "./animales.js";

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
  const grupo = `${los(id)} ${animal(id).plural}`;
  if (meta > actual) {
    return tv
      ? { texto: `Pulsa arriba hasta ${meta}.`, leer: `Pulsa arriba hasta ${meta}.` }
      : { texto: `Sube ${grupo} hasta ${meta}.`, leer: `Sube ${grupo} hasta ${meta}.` };
  }
  return tv
    ? { texto: `Pulsa abajo hasta ${meta}.`, leer: `Pulsa abajo hasta ${meta}.` }
    : { texto: `Baja ${grupo} hasta ${meta}.`, leer: `Baja ${grupo} hasta ${meta}.` };
}

function frase(texto) {
  return { texto, leer: texto };
}

function pistaContar(elemento, estado, paso, tv, errores) {
  const corto = tv ? "Pulsa OK en cada animal." : "Toca cada animal.";
  const i = (estado.marcados || []).findIndex((m) => !m);
  if (paso === "corto") return { paso, ...frase(corto), flecha: null, linea: false };
  if (paso === "flecha") {
    return { paso, ...frase(corto), flecha: i >= 0 ? "animal-" + i : "opciones", linea: false };
  }
  const como = tv ? `Pulsa OK en cada ${animal(elemento.id).es}` : `Toca cada ${animal(elemento.id).es}`;
  const proc = `${como} y cuenta las rayitas.`;
  if ((errores | 0) > 0) return { paso, ...frase(`${proc} Escoge el ${elemento.cantidad}.`), flecha: "opciones", linea: false };
  return { paso, ...frase(proc), flecha: null, linea: false };
}

function pistaGrafica(elemento, estado, paso, tv, errores) {
  const metas = elemento.categorias.map((c) => c.cantidad);
  const alturas = estado.alturas || metas.map(() => 0);
  if (metas.every((m, k) => alturas[k] === m)) {
    const listo = tv ? "¡Brilla! Pulsa OK." : "¡Brilla! Toca Listo.";
    return { paso, ...frase(listo), flecha: "listo", linea: false };
  }
  let i = metas.findIndex((m, k) => alturas[k] !== m);
  if (i < 0) i = 0;
  if ((errores | 0) > 0) {
    const dicha = fraseBarra(elemento.categorias[i].id, metas[i], alturas[i] || 0, tv);
    return { paso: "completo", ...dicha, flecha: "barra-" + i, linea: false };
  }
  if (paso === "corto") return { paso, ...frase("Iguala cada animal."), flecha: null, linea: false };
  if (paso === "flecha") return { paso, ...frase("Mira esta barra."), flecha: "barra-" + i, linea: false };
  const proc = tv ? "Pulsa arriba o abajo hasta que coincida." : "Sube o baja hasta que coincida.";
  return { paso, ...frase(proc), flecha: "barra-" + i, linea: false };
}

function pistaPregunta(elemento, paso, errores) {
  const dio = (errores | 0) > 0;
  if (elemento.clase === "diferencia") {
    if (!dio && paso === "corto") return { paso, ...frase("Compara las dos barras."), flecha: null, linea: false };
    if (!dio && paso === "flecha") return { paso, ...frase("Mira la barra corta."), flecha: "baja", linea: true, sombra: false };
    if (!dio) return { paso, ...frase("Compara las dos barras."), flecha: "baja", linea: true, sombra: false };
    return { paso, ...frase(`Son ${elemento.correcta} más.`), flecha: "baja", linea: true, sombra: true };
  }
  if (elemento.clase === "total" || elemento.clase === "total-todos") {
    if (!dio && paso === "corto") return { paso, ...frase("Junta los números."), flecha: null, linea: false, luces: false };
    if (!dio) return { paso, ...frase("Suma una y luego la otra."), flecha: "barras", linea: false, luces: true };
    return { paso, ...frase(`Son ${elemento.correcta}.`), flecha: "barras", linea: false, luces: true };
  }
  if (elemento.clase === "mas") {
    if (!dio && paso === "flecha") return { paso, ...frase("Mira la más alta."), flecha: "alta", linea: false };
    if (!dio) return { paso, ...frase("Busca la barra más alta."), flecha: paso === "completo" ? "alta" : null, linea: false };
    const nombre = animal(elemento.correcta).plural;
    return { paso, ...frase(`Hay más ${nombre}.`), flecha: "alta", linea: false };
  }
  if (!dio) {
    return { paso, ...frase("Mira la gráfica y cuenta."), flecha: paso === "flecha" || paso === "completo" ? "opciones" : null, linea: false };
  }
  return { paso, ...frase(`Es ${elemento.correcta}.`), flecha: "opciones", linea: false };
}

function pistaDetective(elemento, paso, errores) {
  const id = elemento.error === "falta"
    ? elemento.falta
    : elemento.realIds[elemento.errorIndice] || elemento.realIds[0];
  const otra = `Cuenta otra vez ${los(id)} ${animal(id).plural}.`;
  if (paso === "corto") return { paso, ...frase("Mira la gráfica."), flecha: null, linea: false };
  if (paso === "flecha") return { paso, ...frase(otra), flecha: elemento.error === "altura" ? "barra-" + elemento.errorIndice : "opciones", linea: false };
  if (elemento.error === "altura" && (errores | 0) > 0) {
    const dicha = `${los(id).charAt(0).toUpperCase()}${los(id).slice(1)} ${animal(id).plural} son ${elemento.real[elemento.errorIndice]}.`;
    return { paso, ...frase(dicha), flecha: "barra-" + elemento.errorIndice, linea: false };
  }
  if (elemento.error === "altura") return { paso, ...frase(otra), flecha: "barra-" + elemento.errorIndice, linea: false };
  if (elemento.error === "etiquetas") return { paso, ...frase("Los nombres están cambiados."), flecha: null, linea: false };
  return { paso, ...frase(`Falta ${animal(elemento.falta).art} ${animal(elemento.falta).es}.`), flecha: null, linea: false };
}

export function pista(elemento, estado, opts = {}) {
  const paso = escalon(opts.nivel || 1, opts.segundos || 0, opts.errores || 0);
  const tv = !!opts.tv;
  const errores = opts.errores || 0;
  const vacio = { paso: "nada", texto: "", leer: "", flecha: null, linea: false, sombra: false, luces: false };
  if (!elemento) return vacio;
  if (elemento.tipo === "contar") return { sombra: false, luces: false, ...pistaContar(elemento, estado || {}, paso, tv, errores) };
  if (elemento.tipo === "grafica") return { sombra: false, luces: false, ...pistaGrafica(elemento, estado || {}, paso, tv, errores) };
  if (elemento.tipo === "pregunta") return { sombra: false, luces: false, ...pistaPregunta(elemento, paso, errores) };
  if (elemento.tipo === "detective") return { sombra: false, luces: false, ...pistaDetective(elemento, paso, errores) };
  return vacio;
}

export function marcaPasoCompleto(nivel, paso, segundos) {
  return (nivel | 0) > 1 && paso === "completo" && segundos >= COMPLETA_S;
}
