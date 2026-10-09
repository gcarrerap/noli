// Todo lo que se lee o se dice, en un solo sitio.
// En pantalla no hay porcentajes: se dice «3 de cada 4».
import { CONFIG } from "./reglas.js";

export const TEXTOS = {
  titulo: "Cajas sorpresa",
  subtitulo: "Colección de Brumitos",
  abrir: "Abrir caja",
  costo: "5 créditos",
  vitrina: "Vitrina",
  como: "¿Cómo se juega?",
  papas: "Para papás",
  volver: "Volver",
  saltar: "Saltar",
  seguir: "Seguir",
  salir: "Salir",
  salirPregunta: "¿Salir?",
  descansando: "La tienda está descansando hoy, vuelve mañana",
  sinCreditos: "Todavía no te alcanzan los créditos",
  completa: "Ya tienes todos los Brumitos",
  abriendo: "Abriendo la caja…",
  nueva: "Nueva",
  ejemplo: "Así se ve una carta",
  aVitrina: "A la vitrina",
  conseguir: "Conseguir",
  ahoraNo: "Ahora no",
  noAlcanza: "Todavía no alcanza el polvo",
  ahoraEsTuya: "Ahora es tuya",
  historial: "Cajas abiertas",
  sinHistorial: "Todavía no abre ninguna caja",
  limite: "Cajas al día",
  menos: "Menos",
  mas: "Más",
  cerrarTienda: "Cerrar la tienda",
  abrirTienda: "Abrir la tienda",
  cerradaNota: "Cerrada. Ella ve que la tienda descansa.",
  abiertaNota: "Abierta. Puede comprar sus cajas del día.",
  voz: "Voz",
  vozSi: "La voz está encendida",
  vozNo: "La voz está apagada",
  probIntro: "Más o menos",
  probComun: "3 de cada 4 son comunes",
  probRara: "1 de cada 5 es rara",
  probUltra: "1 de cada 20 es ultra rara",
  comun: "Común",
  rara: "Rara",
  ultra: "Ultra rara",
  de: "de",
  polvo: "polvo de estrellas",
  creditos: "créditos",
  cargando: "Cargando…",
  noAbrio: "No se pudo abrir la tienda.",
};

export function fraseGarantia(n, ultra = false) {
  const quien = ultra ? "ultra rara" : "rara";
  const cajas = n === 1 ? "1 caja" : `${n} cajas`;
  return `Tu ${quien} llega en ${cajas} o menos`;
}

export function fraseRepetida(n) {
  const cuanto = n === 1 ? "1 de polvo de estrellas" : `${n} de polvo de estrellas`;
  return `Ya la tenías. Se volvió en ${cuanto}`;
}

export function frasePrecio(nombre, precio) {
  return `${nombre} cuesta ${precio} de polvo de estrellas`;
}

export function textoGuia(paso, modo) {
  const tv = modo === "tv";
  if (paso === "tienda") return "Cada caja trae un Brumito.";
  if (paso === "probabilidades") return TEXTOS.probComun + ".";
  if (paso === "garantia") return `Tu rara llega en ${CONFIG.garantiaRara} cajas o menos.`;
  if (paso === "abrir") return tv ? "Pulsa OK." : "Toca Abrir caja.";
  if (paso === "carta") return "Las estrellas dicen si es rara.";
  if (paso === "vitrina") return "Con polvo escoges la que te falta.";
  return "Cuando quieras, abre una caja.";
}

export function vozGuia(paso, modo) {
  return textoGuia(paso, modo);
}
