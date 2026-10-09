// Reglas de la guía de la primera vez. Puras, para poder probarlas sin pantalla.
// Los pasos 0 y 3 se van con un toque, con OK, o solos cuando acaba la voz (nunca más de 3 s).
// Los pasos 1 y 2 solo cuando la banda llega a las piezas pedidas.
// Enviar no hace nada hasta el último paso.

/** Tope de un paso que solo se muestra: espera a la voz, y a los 3 s avanza igual. */
export const GUIA_VOZ_TOPE_MS = 3000;
/** Sin voz, si falla o si no llega a sonar: el temporizador de 2 s. Nunca antes. */
export const GUIA_VOZ_MIN_MS = 2000;
/** Tras cerrar «¿Salir?», toques y OK no llegan al juego. Así un segundo toque no cae debajo. */
export const GUIA_TRAS_SALIR_MS = 400;

const VOZ = ["Arma el 23", "Pon 2 barras", "Pon 3 cubitos", "¡Igual!", "Toca Enviar"];

/**
 * Cuánto duró una frase que sí sonó, para el avance solo.
 * Menos de 2 s se queda en 2 s. Más de 3 s se queda en el tope.
 * 0 significa que todavía no acabó: el tope, no el temporizador corto.
 */
export function esperaVozGuia(msVoz) {
  const v = Number(msVoz);
  if (!Number.isFinite(v) || v <= 0) return GUIA_VOZ_TOPE_MS;
  return Math.min(GUIA_VOZ_TOPE_MS, Math.max(GUIA_VOZ_MIN_MS, v));
}

/**
 * Espera del avance solo. Un error, sin onstart o si no arrancó: 2 s.
 * Mientras habla (onstart) y no avisa: el tope de 3 s. Al acabar de verdad: entre 2 y 3 s.
 * `empezo` significa que onstart ya llegó, no que speak() devolvió true.
 */
export function esperaTrasVoz({ empezo = false, error = false, termino = false, ms = 0 } = {}) {
  if (!empezo || error) return GUIA_VOZ_MIN_MS;
  if (!termino) return GUIA_VOZ_TOPE_MS;
  const v = Number(ms);
  if (!Number.isFinite(v) || v <= 0) return GUIA_VOZ_MIN_MS;
  return esperaVozGuia(v);
}

// Reloj del paso que solo se muestra, medido desde que el paso apareció.
// El orden de onerror, onstart y onend no cambia la meta: un error se queda en 2 s.
// Si el aviso llega antes, se devuelve lo que falta y el temporizador sigue.
export function relojPasoVoz(estado, evento, transcurrido) {
  const s = {
    arranco: !!estado?.arranco,
    error: !!estado?.error,
    termino: !!estado?.termino,
    ms: Number(estado?.ms) || 0,
  };
  if (evento === "error") s.error = true;
  else if (!s.error && evento === "start") s.arranco = true;
  else if (!s.error && evento === "end") {
    s.arranco = true;
    s.termino = true;
    const d = Number(transcurrido);
    s.ms = Number.isFinite(d) && d > 0 ? d : 0;
  }
  const meta = esperaTrasVoz({
    empezo: s.arranco && !s.error,
    error: s.error || !s.arranco,
    termino: s.termino && !s.error,
    ms: s.ms,
  });
  const t = Number(transcurrido);
  const pasado = Number.isFinite(t) && t > 0 ? t : 0;
  if (pasado >= meta) return { estado: s, avanzar: true, espera: 0 };
  return { estado: s, avanzar: false, espera: meta - pasado };
}

/** true cuando ya toca avanzar solo. Con el diálogo abierto, nunca. */
export function avanzaSoloGuia({ dialogo = false, empezo = false, error = false, termino = false, ms = 0, transcurrido = 0 } = {}) {
  if (dialogo) return false;
  return transcurrido >= esperaTrasVoz({ empezo, error, termino, ms });
}

/**
 * Con «¿Salir?» abierto el paso no avanza solo: el tiempo del diálogo no cuenta.
 * Al pulsar Seguir la espera de la voz empieza de nuevo, entera.
 */
export function relojDeGuia(dialogoAbierto) {
  return dialogoAbierto ? "pausa" : "reiniciar";
}

/** true mientras no hayan pasado unos 400 ms desde que se cerró el diálogo. */
export function toqueTrasSalir(ms) {
  const t = Number(ms);
  if (!Number.isFinite(t)) return false;
  return t >= 0 && t < GUIA_TRAS_SALIR_MS;
}

/**
 * El cierre del diálogo y el del paso comparten el mismo instante.
 * Vale el mayor de los dos, no la suma: 400 y 400 siguen siendo 400, y un toque a los 560 ms entra.
 */
export function entradaSolapada({ ms = 0, pasoMs = 0 } = {}) {
  if (toqueTrasSalir(ms)) return true;
  const t = Number(ms);
  const paso = Number(pasoMs);
  if (!Number.isFinite(t) || !(paso > 0)) return false;
  return t >= 0 && t < paso;
}

/**
 * Toque u OK. Con el diálogo abierto solo valen Seguir y Salir.
 * Justo después de cerrarlo, no llega nada al paso de debajo.
 */
export function resolverToqueGuia({ paso = 0, dialogo = false, callado = false, ir = "" } = {}) {
  if (dialogo) {
    if (ir === "seguir-juego") return "seguir";
    if (ir === "salir-juego") return "salir";
    return "nada";
  }
  if (callado) return "nada";
  if (ir === "saltar-guia") return "saltar";
  if (guiaAvanzaConToque(paso)) return "mostrar";
  return "juego";
}

export function guiaEnviarActivo(paso) {
  return paso === 4;
}

// Un toque o OK avanza, sin mirar cuántas piezas hay.
export function guiaAvanzaConToque(paso) {
  return paso === 0 || paso === 3;
}

// El paso de las barras o el de los cubitos, solo si ya están.
export function guiaBandaLista(paso, estado) {
  const e = estado || {};
  if (paso === 1) return (e.d || 0) === 2;
  if (paso === 2) return (e.u || 0) === 3;
  return false;
}

export function textoDeGuia(paso, modo = "tactil") {
  if (paso === 0) return "Arma este número";
  if (paso === 1) return modo === "tv" ? "▲ 2 veces" : "Pon 2 barras";
  if (paso === 2) return "Pon 3 cubitos";
  if (paso === 3) return "¡Igual!";
  if (paso === 4) return modo === "tv" ? "Pulsa OK" : "Toca Enviar";
  return "";
}

export function vozDeGuia(paso, modo = "tactil") {
  if (paso === 4 && modo === "tv") return "Pulsa OK";
  return VOZ[paso] || "";
}
