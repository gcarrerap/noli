// Protocolo entre el catálogo y un minijuego (ver DESIGN.md §4). No importa nada: lo usan el catálogo
// (src/) y los juegos (a través de kit/noli.js), y se puede copiar tal cual a un juego que viva aparte.
//
// Todos los mensajes van por postMessage y llevan `noli: 1` (versión del protocolo) y `tipo`.
//   catálogo → juego:  { tipo: "hola", modo, datos, creditos }  al cargar el juego ("tactil" | "tv"); datos: lo que
//                                                        el juego guardó la última vez (o null); creditos: el saldo,
//                                                        solo para juegos con "creditos": "gasta" (si no, null)
//                      { tipo: "entrada", accion }       una acción del control (ver ACCIONES)
//                      { tipo: "gasto", id, ok, saldo }  respuesta a "gastar" (#20): ok = se cobró; saldo después
//   juego → catálogo:  { tipo: "listo" }                 el juego ya escucha
//                      { tipo: "terminar", estrellas, reto }  terminó una partida (0 a 3 estrellas); reto: true si
//                                                        fue el reto del día completado (da créditos extra, #20)
//                      { tipo: "gastar", id, cantidad, motivo }  pedir créditos (#20); el catálogo valida y descuenta
//                      { tipo: "guardar", datos }        guardar el progreso del juego (objeto JSON); el catálogo
//                                                        es el dueño del almacenamiento (hoy localStorage, luego nube)
//                      { tipo: "salir" }                 regresar al catálogo

export const PROTOCOLO = 1;

// Las únicas acciones que un juego recibe, sin importar si vienen del dedo, del teclado, del control de la TV
// o del teléfono usado como control remoto.
export const ACCIONES = ["arriba", "abajo", "izquierda", "derecha", "ok", "atras"];

export const TIPOS = ["hola", "entrada", "listo", "terminar", "guardar", "salir", "gastar", "gasto"];

export function mensaje(tipo, datos = {}) {
  return { noli: PROTOCOLO, tipo, ...datos };
}

// ¿Es un mensaje válido del protocolo? Ignora todo lo demás que pueda llegar por postMessage.
export function esMensaje(m) {
  if (!m || typeof m !== "object" || m.noli !== PROTOCOLO || !TIPOS.includes(m.tipo)) return false;
  if (m.tipo === "entrada") return ACCIONES.includes(m.accion);
  if (m.tipo === "guardar") return !!m.datos && typeof m.datos === "object";
  if (m.tipo === "gastar") return typeof m.id === "string" && m.id.length > 0 && m.id.length <= 64 && Number.isInteger(m.cantidad) && m.cantidad > 0;
  if (m.tipo === "gasto") return typeof m.id === "string" && typeof m.ok === "boolean";
  return true;
}

// Estrellas siempre enteras de 0 a 3
export const estrellas = (n) => Math.max(0, Math.min(3, Math.round(Number(n) || 0)));
