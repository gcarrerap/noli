// Todas las frases que ve o oye Noelia, en un solo lugar.
import { animal, conArticulo, cuantosDe, los, nombreEs } from "./animales.js";

export const TEXTOS = {
  titulo: "Safari de Datos",
  mas: "¿De qué animal hay más?",
  leyenda: "Cada dibujo es 1 animal",
  leyendaBarra: "Cada cuadro es 1 animal",
  leyendaPalito: "Cada palito es 1 animal",
  tituloGrafica: "Animales del zoológico",
  ejeY: "Cuántos",
  ejeYVoz: "Cuántos animales",
  ejeX: "Animal",
  ejeXVoz: "Animal",
  listo: "Listo",
  saltar: "Saltar",
  seguir: "Seguir",
  salir: "Salir",
  preguntaSalir: "¿Salir?",
  jugar: "Jugar",
  reto: "Reto del día",
  progreso: "Mi progreso",
  como: "¿Cómo se juega?",
  papas: "Para papás",
  regresar: "El safari",
  censo: "Censo grande",
  censoMeta: "Hasta 20 animales. Necesitas 4 de 6.",
  detective: "Detective",
  detectiveMeta: "6 gráficas, 4 bien. Cada una tiene un error.",
  etiquetas: "Los nombres están cambiados.",
  faltaUno: "Falta un animal.",
  arregla: "Arregla la gráfica.",
  queMal: "¿Qué está mal?",
  pedido: "El pedido de comida",
  guia: "Guía",
  vozSi: "Voz: sí",
  vozNo: "Voz: no",
  rachaVacia: "Cumple el reto de hoy para empezar una racha",
  otra: "Otra visita",
  otraVez: "Otra vez",
};

export function textoContar(id) {
  return `Cuenta ${los(id)} ${animal(id).plural}.`;
}

export function textoCuantos(id) {
  return `¿${cuantosDe(id)} ${animal(id).plural} hay?`;
}

export function textoDiferencia(idMayor, idMenor) {
  return `¿${cuantosDe(idMayor)} ${animal(idMayor).plural} más que ${los(idMenor)} ${animal(idMenor).plural}?`;
}

export function textoTotalDos(idA, idB) {
  const a = animal(idA);
  const b = animal(idB);
  return `¿Cuántos animales hay entre ${a.plural} y ${b.plural}?`;
}

export function textoAcierto(elemento) {
  if (!elemento) return "¡Sí!";
  if (elemento.clase === "diferencia") return `¡Sí! Son ${elemento.correcta} más.`;
  if (elemento.clase === "mas") return `¡Sí! Hay más ${animal(elemento.correcta).plural}.`;
  if (elemento.tipo === "contar") return `¡Sí! Son ${elemento.cantidad}.`;
  if (elemento.tipo === "detective") return "¡Sí!";
  if (elemento.correcta != null && typeof elemento.correcta !== "object") return `¡Sí! Son ${elemento.correcta}.`;
  return "¡Sí!";
}

export function textoTotalTodos() {
  return "¿Cuántos animales hay en total?";
}

export function textoFalta(id) {
  return `Falta ${conArticulo(id)}.`;
}

export function textoBarraMal(id) {
  return `La barra de ${los(id)} ${animal(id).plural} está mal.`;
}

export function textoGuia(paso, tv) {
  const t = tv === true || tv === "tv";
  if (paso === "cuidar") return "Ayuda al cuidador.";
  if (paso === "contar") return "Cuenta los monos. Escoge el 3.";
  if (paso === "grafica") return "Ahora la gráfica.";
  if (paso === "subir") return t ? "Pulsa arriba hasta 3." : "Sube los monos hasta 3.";
  if (paso === "listo") return t ? "¡Brilla! Pulsa OK." : "¡Brilla! Toca Listo.";
  return "¿De cuál hay más? Escoge la jirafa.";
}

export function vozGuia(paso, tv) {
  const t = tv === true || tv === "tv";
  if (paso === "listo") return t ? "Brilla. Pulsa OK." : "Brilla. Toca Listo.";
  if (paso === "subir") return t ? "Pulsa arriba hasta 3." : "Sube los monos hasta 3.";
  return textoGuia(paso, false);
}

export function vozLeyenda(modo) {
  if (modo === "dibujos") return TEXTOS.leyenda;
  if (modo === "palitos") return TEXTOS.leyendaPalito;
  return TEXTOS.leyendaBarra;
}

export function opcionAnimal(id) {
  return nombreEs(id);
}
