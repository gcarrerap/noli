// Guía fija: 3 monos, la barra de los monos hasta 3, y la jirafa es la que hay más.
// Los pasos de mirar avanzan con un toque o OK al momento.
// Solos duran al menos 2 s y como mucho 3 s: solo si la voz termina de verdad
// (onend después de empezar). Un error, cero voces o una frase que no empieza
// no cuentan como fin: se queda el reloj de 3 s.
// Los de acción solo con la acción de verdad, y aguantan el bloqueo de 1 a 3 s.
// Con «¿Salir?» abierto se pausan el avance solo y la espera de la voz.
// Seguir los reinicia enteros para el paso en el que estaba.

import { IGNORAR_MS } from "./salida.js";

export const PASOS = ["cuidar", "contar", "grafica", "subir", "listo", "mas"];
export const GUIA_MONOS = 3;
export const GUIA_JIRAFAS = 5;
export const BLOQUEO_MIN_MS = 1000;
export const BLOQUEO_MAX_MS = 3000;
export const MIRAR_MIN_MS = 2000;
export const MIRAR_MAX_MS = 3000;
export const AUTO_MIRAR_MS = MIRAR_MAX_MS;
export const TRAS_GUIA_MS = 1000;

export const OPCIONES_GUIA_CONTEO = [2, 3, 4];
export const OPCIONES_GUIA_MAS = [
  { id: "mono", texto: "El mono" },
  { id: "jirafa", texto: "La jirafa" },
  { id: "ambos", texto: "Los dos" },
];

export function esMirar(paso) {
  return paso === "cuidar" || paso === "grafica";
}

export function esAccion(paso) {
  return !esMirar(paso);
}

// Saltar solo entra en las flechas de un paso de mirar, y nunca recibe el foco solo.
export function saltarAlcanzable(paso) {
  return esMirar(paso);
}

export function pausaDePaso(msVoz) {
  const v = Number(msVoz);
  if (!Number.isFinite(v) || v <= 0) return BLOQUEO_MIN_MS;
  return Math.min(BLOQUEO_MAX_MS, Math.max(BLOQUEO_MIN_MS, v));
}

// Con la voz bien terminada, el paso de mirar puede cerrarse entre 2 y 3 s.
// Si la voz falló o no empezó, el reloj es el tope de 3 s.
export function autoDeMirar(msVoz, vozEstado = "esperando") {
  if (vozEstado !== "termino") return MIRAR_MAX_MS;
  const v = Number(msVoz);
  if (!Number.isFinite(v) || v <= 0) return MIRAR_MAX_MS;
  return Math.min(MIRAR_MAX_MS, Math.max(MIRAR_MIN_MS, v));
}

export function tiemposDePaso(paso, ahora) {
  return {
    aparecio: ahora,
    bloqueoHasta: ahora + pausaDePaso(0),
    autoHasta: esMirar(paso) ? ahora + MIRAR_MAX_MS : null,
    vozHasta: ahora + MIRAR_MAX_MS,
    vozEstado: "esperando",
  };
}

// "termino" solo cuando la frase sonó y acabó. "fallo" no adelanta el reloj
// ni acorta el bloqueo: un onerror no es el fin de la voz.
export function anotarVoz(g, estado, ahora = 0) {
  if (!g) return g;
  if (estado === "hablando") {
    if (g.vozEstado === "termino" || g.vozEstado === "fallo") return g;
    return { ...g, vozEstado: "hablando" };
  }
  if (estado !== "termino") {
    if (g.vozEstado === "termino") return g;
    return { ...g, vozEstado: "fallo" };
  }
  const inicio = g.aparecio ?? ahora;
  const dur = Math.min(BLOQUEO_MAX_MS, Math.max(BLOQUEO_MIN_MS, Math.max(0, ahora - inicio)));
  return { ...g, vozEstado: "termino", bloqueoHasta: inicio + dur };
}

export function guiaNueva(ahora = 0) {
  return {
    paso: "cuidar",
    marcados: [false, false, false],
    elegido: null,
    barras: [0, GUIA_JIRAFAS],
    saliendo: false,
    fin: false,
    guardada: false,
    mal: false,
    ignorarHasta: 0,
    ...tiemposDePaso("cuidar", ahora),
  };
}

export function palitosGuia(g) {
  return (g.marcados || []).filter(Boolean).length;
}

export function numerosGuiaActivos(g) {
  return g.paso === "contar" && g.marcados.every(Boolean);
}

export function listoGuiaActivo(g) {
  return g.paso === "listo" && g.barras[0] === GUIA_MONOS && g.barras[1] === GUIA_JIRAFAS;
}

export function focoGuia(g) {
  if (!g) return "frase";
  if (g.paso === "cuidar" || g.paso === "grafica") return "frase";
  if (g.paso === "contar") {
    const i = g.marcados.findIndex((m) => !m);
    if (i >= 0) return "animal-" + i;
    return "op-0";
  }
  if (g.paso === "subir") return "barra-0";
  if (g.paso === "listo") return "listo";
  return "op-0";
}

// Momento en que un paso de mirar avanza solo.
// Voz terminada de verdad: a los 2 s (o al tope de 3 si la frase sigue).
// Error, sin voces o sin empezar: solo el tope de 3 s.
export function instanteAuto(g) {
  if (!g || g.fin || g.saliendo || !esMirar(g.paso) || g.autoHasta == null) return null;
  const inicio = g.aparecio ?? (g.autoHasta - MIRAR_MAX_MS);
  if (g.vozEstado === "termino") return inicio + MIRAR_MIN_MS;
  return g.autoHasta;
}

export function debeAvanzarSolo(g, ahora) {
  const cuando = instanteAuto(g);
  if (cuando == null) return false;
  return ahora >= cuando;
}

export function bloqueada(g, ahora) {
  if (!g || g.saliendo) return true;
  if (ahora < (g.ignorarHasta || 0)) return true;
  if (ahora < (g.bloqueoHasta || 0)) return true;
  return false;
}

export function abrirSalirGuia(g, ahora) {
  if (!g || g.saliendo) return g;
  return { ...g, saliendo: true, pausadoEn: ahora };
}

// Reinicia la espera de la voz y el avance solo del paso actual.
// No continúa lo que faltaba: vuelve a contar desde cero.
export function seguirSalirGuia(g, ahora) {
  return {
    ...g,
    saliendo: false,
    pausadoEn: null,
    ignorarHasta: ahora + IGNORAR_MS,
    ...tiemposDePaso(g.paso, ahora),
  };
}

export function trasGuiaBloquea(ahora, hasta) {
  return ahora < (hasta || 0);
}

function conTiempos(g, paso, ahora) {
  return { ...g, paso, mal: false, ...tiemposDePaso(paso, ahora) };
}

function avanzarMirar(g, ahora) {
  if (g.paso === "cuidar") return conTiempos(g, "contar", ahora);
  if (g.paso === "grafica") return conTiempos(g, "subir", ahora);
  return g;
}

function aplicarContar(g, evento, ahora) {
  if (evento.tipo === "marcar") {
    const i = evento.i;
    if (i < 0 || i > 2 || g.marcados[i]) return g;
    const marcados = g.marcados.slice();
    marcados[i] = true;
    return { ...g, marcados, mal: false };
  }
  if (evento.tipo === "numero") {
    if (!g.marcados.every(Boolean)) return g;
    if (evento.n !== GUIA_MONOS) return { ...g, elegido: evento.n, mal: true };
    return conTiempos({ ...g, elegido: GUIA_MONOS }, "grafica", ahora);
  }
  return g;
}

function aplicarSubir(g, evento, ahora) {
  if (evento.tipo !== "barra" || evento.indice !== 0) return g;
  const delta = evento.delta > 0 ? 1 : -1;
  const mono = Math.max(0, Math.min(10, g.barras[0] + delta));
  const barras = [mono, GUIA_JIRAFAS];
  if (mono === GUIA_MONOS) return conTiempos({ ...g, barras }, "listo", ahora);
  return { ...g, barras, mal: false };
}

function aplicarListo(g, evento, ahora) {
  if (evento.tipo !== "listo") return g;
  if (!listoGuiaActivo(g)) return g;
  return conTiempos(g, "mas", ahora);
}

function aplicarMas(g, evento) {
  if (evento.tipo !== "opcion") return g;
  if (evento.id !== "jirafa") return { ...g, mal: true };
  return { ...g, fin: true, guardada: false, mal: false };
}

// Salir del diálogo no guarda la guía. Saltar sí. Terminar los pasos también:
// ya los hizo, y no hace falta volver a preguntar si sale.
export function guardarAlTerminar(motivo) {
  return motivo === "saltar" || motivo === "fin";
}

export function aplicarGuia(g, evento, ahora) {
  if (!g || g.fin) return g;
  if (g.saliendo) return g;
  if (evento.tipo === "saltar") {
    if (ahora < (g.ignorarHasta || 0)) return g;
    return { ...g, fin: true, guardada: true };
  }
  if (evento.tipo === "tiempo") {
    if (!debeAvanzarSolo(g, ahora)) return g;
    return avanzarMirar(g, ahora);
  }
  // En mirar, el toque y OK avanzan al momento: no esperan los 2–3 s del reloj.
  // Sí se ignoran justo después de cerrar «¿Salir?».
  if (esMirar(g.paso) && (evento.tipo === "toque" || evento.tipo === "ok")) {
    if (ahora < (g.ignorarHasta || 0)) return g;
    return avanzarMirar(g, ahora);
  }
  if (bloqueada(g, ahora)) return g;
  if (g.paso === "contar") return aplicarContar(g, evento, ahora);
  if (g.paso === "subir") return aplicarSubir(g, evento, ahora);
  if (g.paso === "listo") return aplicarListo(g, evento, ahora);
  if (g.paso === "mas") return aplicarMas(g, evento, ahora);
  return g;
}
