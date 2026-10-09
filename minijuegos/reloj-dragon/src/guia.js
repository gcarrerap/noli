// Guía de la primera vez. Ejemplo fijo: poner las 3:00.
// Cada paso avanza solo cuando ella hace esa acción.
// Saltar la marca como vista. Atrás abre «¿Salir?» y no la guarda.
import { fraseBrilla } from "./frases.js";

export const META_GUIA = { h: 3, m: 0 };
export const INICIO_GUIA = { h: 1, m: 0 };
// Los pasos que solo explican («la corta», «la larga») siguen con un toque, con OK
// o solos: sin voz a los 2 s; con voz, cuando termina, y nunca más de 3 s.
export const ESPERA_EXPLICAR_MS = 2000;
export const ESPERA_VOZ_MAX_MS = 3000;
// Tras cerrar «¿Salir?» (fondo o Seguir) no entran toques ni OK: el segundo toque caería debajo.
export const TRAS_CERRAR_MS = 400;

// Espera del avance solo. Un toque o OK no pasan por aquí.
// Sin onstart, si falla o si no arrancó: 2 s. Mientras habla: el tope de 3 s.
// Al terminar de verdad: lo que duró, nunca antes de 2 s y nunca más de 3 s.
// `voz` aquí significa que onstart ya llegó, no que speak() devolvió true.
export function esperaExplicar({ voz = false, termino = false, error = false, ms = 0 } = {}) {
  if (!voz || error) return ESPERA_EXPLICAR_MS;
  if (!termino) return ESPERA_VOZ_MAX_MS;
  const t = Number(ms);
  if (!Number.isFinite(t) || t <= 0) return ESPERA_EXPLICAR_MS;
  return Math.min(ESPERA_VOZ_MAX_MS, Math.max(ESPERA_EXPLICAR_MS, t));
}

export function estadoExplicacion() {
  return { arranco: false, error: false, termino: false, ms: 0 };
}

// Un evento de la voz y lo que falta para avanzar, medido desde el inicio del paso.
// Un error inmediato o tarde, o la falta de onstart, dejan los 2 s de ese inicio.
// Si el aviso llega antes de la meta, se devuelve lo que falta: el reloj no se suelta.
export function relojExplicacion(estado, evento, transcurrido) {
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
  const meta = esperaExplicar({
    voz: s.arranco && !s.error,
    termino: s.termino && !s.error,
    error: s.error || !s.arranco,
    ms: s.ms,
  });
  const t = Number(transcurrido);
  const pasado = Number.isFinite(t) && t > 0 ? t : 0;
  if (pasado >= meta) return { estado: s, avanzar: true, espera: 0 };
  return { estado: s, avanzar: false, espera: meta - pasado };
}

// Con el diálogo abierto el avance solo no corre, aunque hayan pasado más de 2 s.
export function debeAvanzarExplicacion({ dialog = false, transcurrido = 0, voz = false, termino = false, error = false, msVoz = 0 } = {}) {
  if (dialog) return false;
  return transcurrido >= esperaExplicar({ voz, termino, error, ms: msVoz });
}

// Listo en el último paso. Solo cierran los 400 ms tras «¿Salir?».
// El paso no añade otro cierre encima, así un toque a los 560 ms sí entra.
export function aceptaListoGuia(msTrasCerrar) {
  return !ignoraTrasCerrar(msTrasCerrar);
}

// Abrir «¿Salir?» pausa el paso. Seguir lo reinicia entero, sin cambiar de paso.
export function efectoDialogoGuia(abierto) {
  return abierto ? "pausar" : "reiniciar";
}

export function ignoraTrasCerrar(ms) {
  const t = Number(ms);
  return Number.isFinite(t) && t >= 0 && t < TRAS_CERRAR_MS;
}

export const PASOS = [
  { id: "come", luz: "escena", texto: "El dragón come a las 3. Pon las 3.", voz: "El dragón come a las 3. Pon las 3." },
  { id: "corta", luz: "horario", texto: "La corta dice la hora.", voz: "La corta dice la hora." },
  { id: "sube", luz: "hora", voz: "Sube la corta al 3." },
  { id: "larga", luz: "minutero", texto: "La larga, en el 12.", voz: "La larga, en el 12." },
  { id: "listo", luz: "listo" },
];

export function textoPaso(paso, tv) {
  const p = PASOS[paso];
  if (!p) return "";
  if (p.id === "sube") return `${tv ? "▲▼" : "+ −"} Sube la corta al 3.`;
  if (p.id === "listo") return fraseBrilla(!!tv).texto;
  return p.texto;
}

export function vozPaso(paso, tv) {
  const p = PASOS[paso];
  if (!p) return "";
  if (p.id === "listo") return fraseBrilla(!!tv).voz;
  return p.voz || "";
}

// Atrás abre «¿Salir?». El segundo Atrás lo cierra. No salta la guía ni la guarda.
export function efectoAtrasGuia(dialogoAbierto) {
  return dialogoAbierto ? "seguir" : "preguntar";
}

// Seguir vuelve al mismo paso, sin marcar la guía como vista.
export function seguirGuia(estado) {
  return {
    paso: estado.paso,
    reloj: { ...estado.reloj },
    fin: false,
    guardar: false,
  };
}

export function guiaNueva() {
  return { paso: 0, reloj: { ...INICIO_GUIA }, fin: false };
}

// Pasos 2 y 4 de la guía (índice 1 y 3): se miran, no hay que apretar un control apagado.
export function esExplicacion(paso) {
  const id = PASOS[paso]?.id;
  return id === "corta" || id === "larga";
}

// Al salir de una explicación, el control que toca usar queda marcado.
export function focoTrasExplicacion(paso) {
  if (paso === 2) return "hora";
  if (paso === 4) return "listo";
  return "escena";
}

function enMeta(reloj) {
  return (reloj.h % 12 || 12) === META_GUIA.h && reloj.m === 0;
}

// evento: { tipo: "escena" | "foco" | "mover" | "listo" | "saltar" | "seguir", control?, reloj? }
export function aplicarGuia(estado, evento) {
  if (estado.fin || evento.tipo === "saltar") return { ...estado, fin: true };
  const reloj = evento.reloj || estado.reloj;
  const paso = estado.paso;
  if (esExplicacion(paso) && evento.tipo === "seguir") return { paso: paso + 1, reloj, fin: false };
  if (paso === 0 && evento.tipo === "escena") return { paso: 1, reloj, fin: false };
  if (paso === 1 && evento.tipo === "foco" && evento.control === "hora") return { paso: 2, reloj, fin: false };
  if (paso === 2 && enMeta(reloj)) return { paso: 3, reloj, fin: false };
  if (paso === 3 && evento.tipo === "foco" && evento.control === "minutos" && reloj.m === 0 && enMeta(reloj)) {
    return { paso: 4, reloj, fin: false };
  }
  if (paso === 4 && evento.tipo === "listo" && enMeta(reloj)) return { paso: 5, reloj, fin: true };
  return { ...estado, reloj };
}
