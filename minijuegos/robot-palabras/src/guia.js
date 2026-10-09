// Guía de la primera vez. Los pasos 1, 2 y 5 se miran.
// Los pasos 3 y 4 solo avanzan con la caja de verdad.
// Mientras «¿Salir?» está abierto el reloj y la voz se pausan;
// Seguir los reinicia para el mismo paso.
// El trago de 400 ms y el bloqueo del paso corren a la vez: no se suman.
import { textoGuia, vozGuia } from "./textos.js";

export const MIN_MIRAR_MS = 2000;
export const TOPE_VOZ_MS = 3000;
export const TRAGAR_MS = 400;
export const TRAS_GUIA_MS = 1000;
export const BLOQUEO_MS = { 1: 1000, 2: 1500, 3: 2000, 4: 2500, 5: 1200 };

export function esMirar(paso) {
  return paso === 1 || paso === 2 || paso === 5;
}

function finBloqueo(reloj) {
  if (reloj.bloqueoHasta != null) return reloj.bloqueoHasta;
  return reloj.inicio + (BLOQUEO_MS[reloj.paso] || 0);
}

export function relojNuevo(paso, ahora) {
  return {
    paso,
    inicio: ahora,
    pausa: false,
    vozEpoch: 1,
    tragarHasta: 0,
    bloqueoHasta: ahora + (BLOQUEO_MS[paso] || 0),
  };
}

export function pausarReloj(reloj, ahora) {
  if (!reloj || reloj.pausa) return reloj;
  return { ...reloj, pausa: true, pausadoEn: ahora };
}

// Seguir: la voz y el avance automático del paso empiezan de nuevo.
// Lo que quede del bloqueo se reanuda, y los 400 ms corren al mismo tiempo
// (cuenta el que dure más, nunca la suma).
export function seguirReloj(reloj, ahora) {
  const marca = reloj.pausa ? (reloj.pausadoEn ?? ahora) : ahora;
  const queda = Math.max(0, finBloqueo(reloj) - marca);
  return {
    paso: reloj.paso,
    inicio: ahora,
    pausa: false,
    vozEpoch: (reloj.vozEpoch || 0) + 1,
    tragarHasta: ahora + TRAGAR_MS,
    bloqueoHasta: ahora + queda,
  };
}

// Cada paso espera su bloqueo. El trago de 400 ms corre al mismo tiempo:
// cuenta el que dure más. Si el bloqueo ya había pasado, solo quedan los 400 ms.
export function sueltaEn(reloj) {
  if (!reloj) return 0;
  const tragar = reloj.tragarHasta || 0;
  return Math.max(tragar, finBloqueo(reloj));
}

export function vozCuenta(reloj, voz) {
  return !!(voz && voz.epoch === reloj.vozEpoch && voz.termino);
}

export function vozFallo(reloj, voz) {
  return !!(voz && voz.epoch === reloj.vozEpoch && voz.falla && !voz.termino);
}

// Un paso para mirar dura entre 2 s y 3 s si nadie toca.
// La voz solo lo adelanta si de verdad terminó (no un error ni una frase
// que no llegó a empezar). Si no, manda el temporizador.
export function avanzaSolo(reloj, ahora, voz) {
  if (!reloj || reloj.pausa || !esMirar(reloj.paso)) return false;
  if (ahora < reloj.inicio + MIN_MIRAR_MS) return false;
  if (vozCuenta(reloj, voz) || vozFallo(reloj, voz)) return true;
  return ahora >= reloj.inicio + TOPE_VOZ_MS;
}

export function accionCorrecta(paso, categoria) {
  if (paso === 3) return categoria === "noun";
  if (paso === 4) return categoria === "verb";
  return false;
}

export function focoDePaso(paso) {
  if (paso === 3) return "caja-noun";
  if (paso === 4) return "caja-verb";
  return "oir";
}

export function saltarEnCiclo(_paso) {
  return false;
}

function avanzar(reloj, ahora) {
  if (reloj.paso >= 5) return { reloj: null, hecho: "fin", tragarHasta: ahora + TRAS_GUIA_MS };
  return { reloj: relojNuevo(reloj.paso + 1, ahora), hecho: "avanzo" };
}

// entrada.tipo: auto | ok | toque | caja | saltar
export function aplicarGuia(reloj, entrada, ahora, voz) {
  if (!reloj) return { reloj: null, hecho: "no" };
  if (reloj.pausa) return { reloj, hecho: "ignorar" };
  if (entrada.tipo === "saltar") {
    if (ahora < (reloj.tragarHasta || 0)) return { reloj, hecho: "ignorar" };
    return { reloj: null, hecho: "saltar" };
  }
  if ((entrada.tipo === "ok" || entrada.tipo === "toque" || entrada.tipo === "caja") && ahora < (reloj.tragarHasta || 0)) {
    return { reloj, hecho: "ignorar" };
  }
  if (entrada.tipo === "auto") {
    if (avanzaSolo(reloj, ahora, voz)) return avanzar(reloj, ahora);
    return { reloj, hecho: "no" };
  }
  if (ahora < sueltaEn(reloj)) return { reloj, hecho: "bloqueo" };
  if (esMirar(reloj.paso) && (entrada.tipo === "ok" || entrada.tipo === "toque" || entrada.tipo === "caja")) {
    const vozLista = vozCuenta(reloj, voz) || vozFallo(reloj, voz) || ahora >= reloj.inicio + TOPE_VOZ_MS;
    if (!vozLista) return { reloj, hecho: "bloqueo" };
    return avanzar(reloj, ahora);
  }
  if (entrada.tipo === "caja" && accionCorrecta(reloj.paso, entrada.categoria)) return avanzar(reloj, ahora);
  if (entrada.tipo === "caja") return { reloj, hecho: "mal" };
  return { reloj, hecho: "no" };
}

export function textoPaso(paso, tv) {
  return textoGuia(paso, tv);
}

export function vozPaso(paso, tv) {
  return vozGuia(paso, tv);
}
