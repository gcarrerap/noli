// Guía fija del hueco de 6. Los pasos de mirar avanzan con un toque, con OK
// o solos: al menos 2 s y como mucho 3 s. Si la voz de verdad termina
// en ese hueco, también se avanza. Un error de voz, cero voces o una
// frase que no empieza NO cuentan como el final: se usa el reloj.
// El primer segundo no entra: ni un toque ni OK, tampoco en los de mirar.
// Tras «¿Salir?», los 400 ms y el candado del paso empiezan juntos y no se suman.
// Los de acción solo avanzan con la acción.
// Con «¿Salir?» abierto el reloj y la espera de la voz se pausan.
// Seguir los reinicia para el paso en curso.
// Saltar se puede tocar, pero las flechas no llegan a él en ningún paso.

import { TRAS_DIALOGO_MS } from "./salida.js";
import { hablaSegura } from "./medida.js";

export const GUIA_TOQUE_MS = 2000;
export const GUIA_CIERRE_MS = 1000;
export const GUIA_TOPE_MS = 3000;
export const TRAS_GUIA_MS = 1000;
export const PASOS_GUIA = 6;
export const HUECO_GUIA = 6;
export const DESPLAZA_GUIA = 2;

const MIRAR = new Set([0, 1, 3]);

export function esMirar(paso) {
  return MIRAR.has(paso | 0);
}

export function crearReloj(ahora = 0, paso = 0) {
  return {
    paso: paso | 0,
    inicio: ahora,
    vozSigue: false,
    vozTermino: false,
    vozFallo: false,
    pausado: false,
    ignorarHasta: 0,
    reiniciarVoz: true,
  };
}

export function abrirDialogoGuia(reloj, ahora) {
  return {
    ...reloj,
    pausado: true,
    vozSigue: false,
    vozTermino: false,
    pausadoEn: ahora,
    reiniciarVoz: false,
  };
}

export function seguirDialogoGuia(reloj, ahora) {
  return {
    ...reloj,
    pausado: false,
    inicio: ahora,
    vozSigue: false,
    vozTermino: false,
    vozFallo: false,
    ignorarHasta: ahora + TRAS_DIALOGO_MS,
    reiniciarVoz: true,
  };
}

// La voz empezó de verdad (onstart). Hasta entonces manda el reloj de 2 s.
export function marcarVozEmpezada(reloj) {
  if (!reloj || reloj.pausado || reloj.vozFallo) return reloj;
  return { ...reloj, vozSigue: true, vozTermino: false };
}

// "fin" solo si onend llegó después de onstart. error, sin-voces y
// no-empieza no adelantan el paso: el reloj sigue en 2–3 s.
export function alAvisoVoz(reloj, ahora, aviso) {
  if (!reloj || reloj.pausado) return { reloj, avanza: false };
  if (aviso !== "fin") {
    const siguiente = { ...reloj, vozSigue: false, vozTermino: false, vozFallo: true };
    return { reloj: siguiente, avanza: false };
  }
  const siguiente = { ...reloj, vozSigue: false, vozTermino: true, vozFallo: false };
  return { reloj: siguiente, avanza: debeAvanzarSolo(siguiente, ahora) };
}

export function debeAvanzarSolo(reloj, ahora) {
  if (!reloj || reloj.pausado || !esMirar(reloj.paso)) return false;
  const t = ahora - reloj.inicio;
  if (t >= GUIA_TOPE_MS) return true;
  if (t >= GUIA_TOQUE_MS && !reloj.vozSigue) return true;
  return false;
}

export function msHastaAvance(reloj, ahora) {
  if (!reloj || reloj.pausado || !esMirar(reloj.paso)) return null;
  const t = ahora - reloj.inicio;
  if (reloj.vozSigue) return Math.max(0, GUIA_TOPE_MS - t);
  if (t >= GUIA_TOQUE_MS) return 0;
  return GUIA_TOQUE_MS - t;
}

// El candado de ~400 ms tras «¿Salir?» y el del paso (1 s en todos)
// comparten el origen. No se suman: se abre cuando acaba el más largo.
// Date.now() no cabe en 32 bits: `| 0` lo dejaría en el pasado.
export function enteroReloj(x) {
  const n = Number(x);
  return n || 0;
}

export function limiteEntrada(reloj, tipo) {
  if (!reloj) return 0;
  const dialogo = enteroReloj(reloj.ignorarHasta);
  const paso = enteroReloj(reloj.inicio) + GUIA_CIERRE_MS;
  return Math.max(dialogo, paso);
}

export function guiaBloqueada(reloj, ahora, tipo) {
  if (!reloj || reloj.pausado) return true;
  return ahora < limiteEntrada(reloj, tipo);
}

export function pasoSiguiente(paso, evento) {
  if (!evento) return paso;
  if (esMirar(paso) && (evento.tipo === "toque" || evento.tipo === "ok" || evento.tipo === "tiempo")) return paso + 1;
  if (paso === 2 && evento.tipo === "poner" && (evento.desplaza | 0) === 0) return 3;
  if (paso === 4 && evento.tipo === "elegir" && Number(evento.valor) === HUECO_GUIA) return 5;
  if (paso === 5 && evento.tipo === "tabla" && Number(evento.valor) === HUECO_GUIA) return 6;
  return paso;
}

export function responderGuia(reloj, ahora, evento) {
  if (!evento) return { accion: "nada", reloj };
  if (!reloj || reloj.pausado) return { accion: "nada", reloj };
  if (evento.tipo === "saltar" || evento.ir === "saltar-guia") return { accion: "saltar", reloj };
  if (evento.tipo === "tiempo") {
    if (!debeAvanzarSolo(reloj, ahora)) return { accion: "nada", reloj };
  } else if (guiaBloqueada(reloj, ahora, evento.tipo)) {
    if (ahora < enteroReloj(reloj.ignorarHasta) && (evento.tipo === "toque" || evento.tipo === "ok" || evento.tipo === "poner" || evento.tipo === "elegir" || evento.tipo === "tabla")) {
      return { accion: "ignorar", reloj };
    }
    return { accion: "nada", reloj };
  }
  const siguiente = pasoSiguiente(reloj.paso, evento);
  if (siguiente === reloj.paso) return { accion: "nada", reloj };
  return {
    accion: "avanzo",
    reloj: crearReloj(ahora, siguiente),
  };
}

export function guiaTerminada(paso) {
  return (paso | 0) >= PASOS_GUIA;
}

export function focoDeGuia(paso) {
  if (paso === 2) return "poner";
  if (paso === 4) return "op-0";
  if (paso === 5) return "tabla-0";
  return "guia-texto";
}

// En toda la guía las flechas no llegan a Saltar. Se puede tocar igual.
export function saltarAlcanzable() {
  return false;
}

export function textoDeGuia(paso, textos, modo = "tactil") {
  const t = textos || {};
  if ((paso | 0) === 2 && modo === "tv") return t.guiaPonTv || "Pulsa OK.";
  const lista = t.guia || [];
  return lista[paso] || "";
}

export function vozDeGuia(paso, textos, modo = "tactil") {
  const t = textos || {};
  if ((paso | 0) === 2 && modo === "tv") return t.guiaPonVozTv || "Pulsa OK.";
  const lista = t.guiaVoz || t.guia || [];
  return hablaSegura(lista[paso] || "");
}

export function trasGuiaBloquea(ahora, desde, activo) {
  return !!activo && ahora - desde < TRAS_GUIA_MS;
}

export function opcionesGuia() {
  return [4, HUECO_GUIA, 8];
}

export function tablasGuia() {
  return [4, HUECO_GUIA, 9];
}
