// Todo lo que se lee o se dice, en un solo sitio.
// En pantalla no hay porcentajes: se dice «3 de cada 4».
// El número de la garantía entra por argumento: vive en datos/reglas.json.

export const TEXTOS = {
  titulo: "Cajas sorpresa",
  subtitulo: "Colección de Brumitos",
  abrir: "Abrir frasco",
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
  abriendo: "Abriendo el frasco…",
  oir: "Oír",
  fotoFamiliar: "Foto familiar",
  verFoto: "Ver la foto familiar",
  queBonita: "Qué bonita",
  anterior: "Anterior",
  siguiente: "Siguiente",
  nueva: "Nueva",
  ejemplo: "Así se ve una carta",
  aVitrina: "A la vitrina",
  conseguir: "Conseguir",
  ahoraNo: "Ahora no",
  noAlcanza: "Todavía no alcanza el polvo",
  ahoraEsTuya: "Ahora es tuya",
  historial: "Frascos abiertos",
  sinHistorial: "Todavía no abre ningún frasco",
  limite: "Frascos al día",
  menos: "Menos",
  mas: "Más",
  cerrarTienda: "Cerrar la tienda",
  abrirTienda: "Abrir la tienda",
  cerradaNota: "Cerrada. Ella ve que la tienda descansa.",
  abiertaNota: "Abierta. Puede comprar sus frascos del día.",
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
  quien: "¿Quién crees que es?",
  esaNo: "Esa no es. Intenta otra vez.",
  album: "Ya está en el álbum",
  cuantoEs: "¿Cuánto es",
  metaPara: "Guardas polvo para",
};

export function fraseGarantia(n, ultra = false) {
  const quien = ultra ? "ultra rara" : "rara";
  const cajas = n === 1 ? "1 caja" : `${n} cajas`;
  return `Tu ${quien} llega en ${cajas} o menos`;
}

export function fraseNueva(genero) {
  return genero === "f" ? "Nueva" : "Nuevo";
}

export function fraseTuya(genero) {
  return genero === "f" ? "Ahora es tuya" : "Ahora es tuyo";
}

export function fraseVisita(nombre) {
  return `¡${nombre} vino de visita otra vez!`;
}

export function frasePolvo(n) {
  return n === 1 ? "1 de polvo de estrellas" : `${n} de polvo de estrellas`;
}

export function frasePrecio(nombre, precio) {
  return `${nombre} cuesta ${precio} de polvo de estrellas`;
}

export function fraseCosto(n) {
  const k = Number(n) || 0;
  return k === 1 ? "1 crédito" : `${k} créditos`;
}

export function fraseGuardar(nombre, genero) {
  const este = genero === "f" ? "esta" : "este";
  return `Guardar para ${este} ${nombre}`;
}

const ROLES = {
  bebe: "Bebé",
  nino: "Niño",
  nina: "Niña",
  adolescente: "Adolescente",
  mama: "Mamá",
  papa: "Papá",
  abuelo: "Abuelo",
  abuela: "Abuela",
};

export function etiquetaRol(rol) {
  return ROLES[rol] || "";
}

export function fraseFamilia(nombre) {
  return `La familia ${nombre} está completa`;
}

export function textoGuia(paso, modo, reglas) {
  const tv = modo === "tv";
  if (paso === "tienda") return "Cada frasco trae un Brumito.";
  if (paso === "probabilidades") return TEXTOS.probComun + ".";
  if (paso === "abrir") return tv ? "Pulsa OK." : "Toca Abrir frasco.";
  if (paso === "carta") return "Las estrellas dicen si es rara.";
  if (paso === "vitrina") return "Con polvo escoges la que te falta.";
  return "Cuando quieras, abre un frasco.";
}

export function vozGuia(paso, modo) {
  return textoGuia(paso, modo);
}
