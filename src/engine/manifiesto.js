// Manifiesto de un minijuego (minijuegos/<id>/juego.json): validarlo y completar valores por omisión.
// Función pura: no lee archivos (eso lo hace services/catalogo-repo.js).

import { TIPOS_CREDITOS } from "./creditos.js";

export const CONTROLES = ["tactil", "flechas", "remoto"];
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Devuelve { juego } con el manifiesto completo, o { errores: [..] } si no sirve.
// idCarpeta: el id con el que aparece en catalogo.json (debe coincidir con el del manifiesto y con la carpeta).
export function validarManifiesto(m, idCarpeta) {
  const errores = [];
  if (!m || typeof m !== "object" || Array.isArray(m)) return { errores: [`${idCarpeta}: juego.json no es un objeto`] };
  const txt = (v) => typeof v === "string" && v.trim() !== "";

  if (!txt(m.id) || !ID.test(m.id)) errores.push(`${idCarpeta}: "id" debe ser minúsculas, números y guiones`);
  else if (m.id !== idCarpeta) errores.push(`${idCarpeta}: "id" (${m.id}) no coincide con la carpeta`);
  if (!txt(m.titulo)) errores.push(`${idCarpeta}: falta "titulo"`);

  const entrada = m.entrada ?? "index.html";
  if (!txt(entrada) || /^([a-z]+:|\/|\.\.)/i.test(entrada)) errores.push(`${idCarpeta}: "entrada" debe ser una ruta relativa dentro de la carpeta`);

  const controles = m.controles ?? ["tactil", "flechas"];
  if (!Array.isArray(controles) || !controles.length || controles.some((c) => !CONTROLES.includes(c)))
    errores.push(`${idCarpeta}: "controles" debe ser una lista con ${CONTROLES.join(", ")}`);

  // Ícono: un archivo de la carpeta del juego (recomendado: .svg) o, para prototipos, un emoji/texto corto
  const icono = txt(m.icono) ? m.icono.trim() : "🎲";
  const iconoArchivo = /\.(svg|png|webp|jpe?g)$/i.test(icono);
  if (iconoArchivo && /^([a-z]+:|\/|\.\.)/i.test(icono)) errores.push(`${idCarpeta}: "icono" debe ser un archivo dentro de la carpeta`);

  let edades = m.edades ?? null;
  if (edades !== null && !(Array.isArray(edades) && edades.length === 2 && edades.every(Number.isInteger) && edades[0] <= edades[1]))
    errores.push(`${idCarpeta}: "edades" debe ser [mínima, máxima]`);

  // Créditos (#20): "gana" (juego educativo: da créditos por estrellas), "gasta" (los cobra, como la Pasarela) o nada
  const creditos = m.creditos ?? null;
  if (creditos !== null && !TIPOS_CREDITOS.includes(creditos)) errores.push(`${idCarpeta}: "creditos" debe ser "gana" o "gasta"`);
  const costo = m.costo ?? null;
  if (costo !== null && !(Number.isInteger(costo) && costo > 0 && costo <= 100)) errores.push(`${idCarpeta}: "costo" debe ser un entero de 1 a 100`);
  if (costo !== null && creditos !== "gasta") errores.push(`${idCarpeta}: "costo" solo va con "creditos": "gasta"`);
  // Premios (#96): monedas fijas por logros con nombre ({ "capitulo": 5, "libro": 50 }). Un juego con premios no da
  // créditos por estrellas: paga solo con premios.
  const premios = m.premios ?? null;
  if (premios !== null && !(premios && typeof premios === "object" && !Array.isArray(premios)
    && Object.entries(premios).every(([k, v]) => ID.test(k) && Number.isInteger(v) && v > 0 && v <= 100)))
    errores.push(`${idCarpeta}: "premios" debe ser { nombre: créditos de 1 a 100 }`);
  if (premios !== null && creditos !== "gana") errores.push(`${idCarpeta}: "premios" solo va con "creditos": "gana"`);

  // Mundo del menú principal (#25): qué edificio tiene el juego ("torre", "arbol", "escenario", "portal"…, ver
  // mundo/lugares.json → edificios). Si no se pone (o no existe), el mundo le pone un portal.
  const lugar = m.lugar ?? null;
  if (lugar !== null && !(txt(lugar) && ID.test(lugar))) errores.push(`${idCarpeta}: "lugar" debe ser el id de un edificio del mundo`);

  // TV (#57): la TV no limita el diseño. "tv": true dice que el juego se juega completo con el control remoto (y entonces
  // "controles" incluye "remoto"); "tv": false lo esconde en modo TV. Sin "tv", se deduce de "controles" (los juegos del
  // repo sí deben ponerlo: lo exige tests/catalogo.test.js). "ocultoEnTv": partes de un juego apto para TV que en la TV
  // se esconden (por ejemplo un nivel con cámara); el juego lo hace solo con Noli.modo === "tv".
  const conRemoto = Array.isArray(controles) && controles.includes("remoto");
  const tv = m.tv ?? conRemoto;
  if (typeof tv !== "boolean") errores.push(`${idCarpeta}: "tv" debe ser true o false`);
  else if (tv && !conRemoto) errores.push(`${idCarpeta}: "tv": true pide "remoto" en "controles"`);
  else if (!tv && conRemoto) errores.push(`${idCarpeta}: "tv": false no va con "remoto" en "controles"`);
  const ocultoEnTv = m.ocultoEnTv ?? [];
  if (!Array.isArray(ocultoEnTv) || ocultoEnTv.some((x) => !txt(x))) errores.push(`${idCarpeta}: "ocultoEnTv" debe ser una lista de textos`);
  else if (ocultoEnTv.length && tv === false) errores.push(`${idCarpeta}: "ocultoEnTv" solo va con "tv": true (con false se oculta todo el juego)`);

  if (errores.length) return { errores };
  return {
    juego: {
      id: m.id,
      titulo: m.titulo.trim(),
      descripcion: txt(m.descripcion) ? m.descripcion.trim() : "",
      icono, iconoArchivo,
      color: txt(m.color) ? m.color : null,
      materia: txt(m.materia) ? m.materia.trim().toLowerCase() : "otros",
      edades,
      controles,
      entrada,
      version: m.version != null ? String(m.version) : "1",
      creditos,
      costo,
      premios,
      lugar,
      tv,
      ocultoEnTv: ocultoEnTv.map((x) => x.trim()),
    },
  };
}

// ¿Se puede jugar aquí? En modo TV solo los juegos declarados aptos ("tv": true, #57); en el teléfono, la tableta o
// la computadora, todos.
export function jugableEn(juego, modo) {
  if (modo === "tv") return juego.tv === true;
  return true;
}

// Navegadores de smart TV (LG webOS, Samsung Tizen, Android/Google TV, Fire TV, Sony, HbbTV).
const UA_TV = /web0s|webos|tizen|smart-?tv|hbbtv|netcast|googletv|android tv|bravia|\baft[a-z]/i;

// Modo de la app: ?modo=tv o ?modo=tactil mandan; si no hay, una TV detectada por su navegador entra en modo TV.
export function modoDe(search = "", ua = "") {
  let p = null;
  try { p = new URLSearchParams(search).get("modo"); } catch { p = null; }
  if (p === "tv" || p === "tactil") return p;
  return UA_TV.test(String(ua || "")) ? "tv" : "tactil";
}
