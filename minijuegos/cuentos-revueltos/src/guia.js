// Guía de la primera vez. Pasos 0 y 1 se miran; 2 y 3 son acción.
// Con «¿Salir?» abierto se pausan el avance solo y la espera de la voz.
// Seguir los reinicia para el paso actual. Tras cerrar, 400 ms sin toques ni OK.
import { relojNuevo, relojPausar, relojReiniciar, relojMs } from "./reloj.js";
import { TRAS_DIALOGO_MS, hastaIgnorar, hastaLibre } from "./salida.js";

export const BLOQUEO_PASO_MS = 1500;
/** Los pasos que solo se miran ignoran toques y OK durante 1 s. */
export const BLOQUEO_MIRAR_MS = 1000;
export const AUTO_MIRAR_MS = 2000;
export const TOPE_VOZ_MS = 3000;
export const TRAS_GUIA_MS = 1000;

export const ORDEN_GUIA = ["casas", "lobo", "cozy"];
export const MAZO_GUIA = ["lobo", "casas", "cozy"];
export const PRIMERA_GUIA = "casas";

export const FRASES_GUIA = [
  "The pigs build.",
  "The wolf huffed.",
  "The pigs felt cozy.",
];

const PASOS = [
  { id: "lobo", mirar: true },
  { id: "orden", mirar: true },
  { id: "tomar", mirar: false },
  { id: "poner", mirar: false },
];

export function esMirar(paso) {
  return !!PASOS[paso]?.mirar;
}

export function textoPaso(paso, tv, listoOn) {
  if (paso === 0) return "¡El lobo revolvió el cuento!";
  if (paso === 1) return "Ponlo en orden.";
  if (paso === 2) return tv ? "Pon esta primera. Pulsa OK." : "Pon esta primera.";
  if (paso === 3) {
    const base = "Ponla en el 1.";
    if (!listoOn) return base;
    return tv ? `${base} Pulsa OK en Listo.` : `${base} Toca Listo.`;
  }
  return "";
}

// La voz dice lo mismo que se lee, sin símbolos.
export function vozPaso(paso, tv, listoOn) {
  return textoPaso(paso, tv, listoOn);
}

export function focoGuia(paso, listoOn) {
  if (paso <= 1) return "coach";
  if (paso === 2) return "tarjeta-casas";
  if (listoOn) return "listo";
  return "hueco-0";
}

// Saltar no entra en las flechas en ningún paso. Sigue pudiéndose tocar.
export function saltarEnFlechas() {
  return false;
}

export function listoGuiaActivo(estado) {
  if (!estado || estado.paso !== 3) return false;
  return estado.huecos[0] === "casas" && estado.huecos[1] === "lobo" && estado.huecos[2] === "cozy";
}

export function bloqueoTrasGuia(ahora) {
  return ahora + TRAS_GUIA_MS;
}

function tablero(paso) {
  if (paso >= 3) return { mazo: [], huecos: [null, "lobo", "cozy"], tomada: "casas" };
  return { mazo: [...MAZO_GUIA], huecos: [null, null, null], tomada: null };
}

function bloqueoDe(paso, ahora) {
  const base = Number(ahora);
  const t = Number.isFinite(base) ? base : 0;
  return t + (esMirar(paso) ? BLOQUEO_MIRAR_MS : BLOQUEO_PASO_MS);
}

export function guiaNueva(ahora) {
  const tab = tablero(0);
  return {
    paso: 0,
    reloj: relojNuevo(ahora),
    voz: { activa: true, termino: false, fallo: false },
    bloqueoHasta: bloqueoDe(0, ahora),
    ignorarHasta: 0,
    dialogo: false,
    ...tab,
    fin: false,
    guardar: false,
    salir: false,
  };
}

function entrar(estado, paso, ahora, tab) {
  return {
    ...estado,
    paso,
    reloj: relojNuevo(ahora),
    voz: { activa: true, termino: false, fallo: false },
    bloqueoHasta: bloqueoDe(paso, ahora),
    dialogo: false,
    ...tab,
  };
}

function bloqueado(estado, ahora) {
  if (estado.fin || estado.dialogo) return true;
  return ahora < hastaLibre(estado.bloqueoHasta, estado.ignorarHasta);
}

// La frase sigue sonando: no se corta con OK ni con un toque.
// Se abre al cumplirse el segundo Y (la voz o el mp3 terminó, falló, o pasaron 3 s).
function vozYaCabe(estado, ahora) {
  if (relojMs(estado.reloj, ahora) >= TOPE_VOZ_MS) return true;
  const voz = estado.voz || {};
  return !!(voz.termino || voz.fallo || !voz.activa);
}

// Un paso para mirar espera 1 s como mínimo, y también a la voz.
// El diálogo y los 400 ms de después siguen cerrados. No se suman al candado.
function mirarCerrado(estado, ahora) {
  if (estado.fin || estado.dialogo) return true;
  if (ahora < hastaLibre(estado.bloqueoHasta, estado.ignorarHasta)) return true;
  return !vozYaCabe(estado, ahora);
}

// Un error o una voz que no arranca no es «ya terminó».
// El paso sigue en pantalla al menos 2 s y como mucho 3 s.
export function notaVoz(estado, resultado) {
  if (!estado || estado.dialogo) return estado;
  if (resultado === "termino") return { ...estado, voz: { activa: true, termino: true, fallo: false } };
  return { ...estado, voz: { activa: false, termino: false, fallo: true } };
}

export function debeAutoAvanzar(estado, ahora) {
  if (!estado || estado.fin || estado.dialogo || !esMirar(estado.paso)) return false;
  if (ahora < estado.ignorarHasta) return false;
  const ms = relojMs(estado.reloj, ahora);
  if (ms < AUTO_MIRAR_MS) return false;
  if (ms >= TOPE_VOZ_MS) return true;
  if (estado.voz.termino || estado.voz.fallo || !estado.voz.activa) return true;
  return false;
}

function abrirDialogo(estado, ahora) {
  return { ...estado, dialogo: true, reloj: relojPausar(estado.reloj, ahora) };
}

// Seguir (o el segundo Atrás): el paso actual empieza de nuevo la espera de la voz.
// bloqueoHasta no se mueve: los 400 ms caben dentro del candado del paso, o al revés.
function seguirDialogo(estado, ahora) {
  return {
    ...estado,
    dialogo: false,
    reloj: relojReiniciar(ahora),
    voz: { activa: true, termino: false, fallo: false },
    ignorarHasta: hastaIgnorar(ahora, TRAS_DIALOGO_MS),
  };
}

// Al encenderse Listo hay 1 s de candado, para que un OK sostenido no lo pulse al momento.
function alEncenderListo(estado, ahora) {
  const puesto = { ...estado, huecos: ["casas", "lobo", "cozy"], tomada: null };
  if (!listoGuiaActivo(puesto)) return puesto;
  const hasta = ahora + 1000;
  const previo = Number.isFinite(puesto.bloqueoHasta) ? puesto.bloqueoHasta : 0;
  return { ...puesto, bloqueoHasta: Math.max(previo, hasta) };
}

export function reducirGuia(estado, evento) {
  if (!estado || estado.fin) return estado;
  const ahora = evento.ahora ?? 0;
  const tipo = evento.tipo;

  if (tipo === "atras") {
    return estado.dialogo ? seguirDialogo(estado, ahora) : abrirDialogo(estado, ahora);
  }
  if (tipo === "seguir") {
    return estado.dialogo ? seguirDialogo(estado, ahora) : estado;
  }
  if (tipo === "salir") {
    if (!estado.dialogo) return estado;
    return { ...estado, dialogo: false, fin: true, guardar: false, salir: true };
  }

  // Con el diálogo abierto no pasa nada más.
  if (estado.dialogo) return estado;

  if (tipo === "voz") return notaVoz(estado, evento.resultado === "fallo" ? "fallo" : "termino");

  if (tipo === "saltar") {
    if (ahora < hastaLibre(estado.bloqueoHasta, estado.ignorarHasta)) return estado;
    return { ...estado, fin: true, guardar: true };
  }

  if (tipo === "toque" || (tipo === "ok" && esMirar(estado.paso))) {
    if (mirarCerrado(estado, ahora) || !esMirar(estado.paso)) return estado;
    return entrar(estado, estado.paso + 1, ahora, tablero(estado.paso + 1));
  }

  if (tipo === "ok" && !esMirar(estado.paso)) {
    if (bloqueado(estado, ahora)) return estado;
    if (estado.paso === 2 && evento.foco === "tarjeta-casas") {
      return entrar(estado, 3, ahora, tablero(3));
    }
    if (estado.paso === 3 && evento.foco === "listo" && listoGuiaActivo(estado)) {
      return { ...estado, fin: true, guardar: true, paso: 4 };
    }
    if (estado.paso === 3 && evento.foco === "hueco-0" && estado.tomada === PRIMERA_GUIA) {
      return alEncenderListo(estado, ahora);
    }
    return estado;
  }

  if (tipo === "tomar") {
    if (bloqueado(estado, ahora)) return estado;
    if (estado.paso === 2 && evento.id === PRIMERA_GUIA) return entrar(estado, 3, ahora, tablero(3));
    if (estado.paso === 3 && !estado.tomada && evento.id === PRIMERA_GUIA && estado.mazo.includes(PRIMERA_GUIA)) {
      return { ...estado, tomada: PRIMERA_GUIA, mazo: [] };
    }
    return estado;
  }

  if (tipo === "poner") {
    if (bloqueado(estado, ahora) || estado.paso !== 3) return estado;
    if (evento.slot !== 0 || estado.tomada !== PRIMERA_GUIA) return estado;
    return alEncenderListo(estado, ahora);
  }

  if (tipo === "soltar") {
    if (bloqueado(estado, ahora) || estado.paso !== 3 || !estado.tomada) return estado;
    return { ...estado, tomada: null, mazo: [PRIMERA_GUIA], huecos: [null, "lobo", "cozy"] };
  }

  if (tipo === "listo") {
    if (bloqueado(estado, ahora) || !listoGuiaActivo(estado)) return estado;
    return { ...estado, fin: true, guardar: true, paso: 4 };
  }

  return estado;
}
