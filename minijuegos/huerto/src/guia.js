// Guía fija: 2 filas de 3. Cada paso espera a que ella lo haga.
// Las reglas son puras para poder probarlas sin pantalla.
import { saltosArreglo } from "./niveles.js";

export const GUIA = {
  filas: 2,
  porFila: 3,
};

export const GUIA_TOQUE_MS = 2000;
/** Tope de la espera cuando la voz del paso sigue sonando. */
export const GUIA_VOZ_MAX_MS = 3000;
/** Tras cerrar «¿Salir?», toques y OK no caen en lo de debajo. */
export const GUARDIA_SALIR_MS = 400;

export const PASOS = ["pedido", "filas", "cada", "listo", "abejas"];

const COPIA = {
  pedido: {
    tactil: "Planta 2 filas de 3.", tv: "Planta 2 filas de 3.",
    leerTactil: "Planta 2 filas de 3.", leerTv: "Planta 2 filas de 3.",
  },
  filas: {
    tactil: "Toca + hasta 2.", tv: "Pulsa ▲ hasta 2.",
    leerTactil: "Toca más hasta 2.", leerTv: "Pulsa arriba hasta 2.",
  },
  cada: {
    tactil: "Pon 3.", tv: "Pon 3.",
    leerTactil: "Pon 3.", leerTv: "Pon 3.",
  },
  listo: {
    tactil: "¡Brilla! Toca Listo.", tv: "¡Brilla! Pulsa OK.",
    leerTactil: "Brilla. Toca Listo.", leerTv: "Brilla. Pulsa OK.",
  },
  abejas: {
    tactil: "Cuenta: 3, 6.", tv: "Cuenta: 3, 6.",
    leerTactil: "Cuenta: 3, 6.", leerTv: "Cuenta: 3, 6.",
  },
};

export function saltosGuia() {
  return saltosArreglo(GUIA.filas, GUIA.porFila);
}

export function textoGuia(paso, tv) {
  const c = COPIA[paso] || COPIA.pedido;
  const modoTv = tv === true || tv === "tv";
  return { texto: modoTv ? c.tv : c.tactil, leer: modoTv ? c.leerTv : c.leerTactil };
}

// El paso 1 se va con un toque, con OK, o solo cuando termina la voz.
// Sin voz sigue a los 2 s. Con voz espera a que acabe, y nunca más de 3 s.
// Los de contar solo cuando el número ya es el del ejemplo.
export function guiaAvanzaConToque(paso) {
  return paso === "pedido";
}

/** Milisegundos del avance solo. 0 o un dato inválido: los 2 s de siempre. */
export function esperaAutoGuia(msVoz) {
  const v = Number(msVoz);
  if (!Number.isFinite(v) || v <= 0) return GUIA_TOQUE_MS;
  return Math.min(GUIA_VOZ_MAX_MS, v);
}

/**
 * Reloj del paso que solo se muestra.
 * Con el diálogo abierto no corre: el tiempo ahí metido no salta el paso.
 * Al seguir, se llama con transcurrido 0 para empezar la espera de nuevo.
 */
export function relojPasoMostrar({ dialog = false, transcurrido = 0, vozSigue = false } = {}) {
  if (dialog) return { avanzar: false, espera: 0, correr: false };
  const t = Number(transcurrido);
  const pasado = Number.isFinite(t) && t > 0 ? t : 0;
  const meta = esperaAutoGuia(vozSigue ? GUIA_VOZ_MAX_MS : 0);
  if (pasado >= meta) return { avanzar: true, espera: 0, correr: false };
  return { avanzar: false, espera: meta - pasado, correr: true };
}

/** Toque u OK justo después de Seguir. Atrás y las flechas siguen. */
export function entradaTrasCerrar({ ms = 0, tipo = "toque" } = {}) {
  if (tipo !== "toque" && tipo !== "ok") return "pasar";
  const t = Number(ms);
  if (!Number.isFinite(t) || t < GUARDIA_SALIR_MS) return "ignorar";
  return "pasar";
}

// El paso visible sale de lo que ya hizo, no de un temporizador.
export function pasoGuia(estado) {
  if (estado.fase === "cosecha" || estado.fase === "saltar") return "abejas";
  if (!estado.acepto) return "pedido";
  if (estado.filas === GUIA.filas && estado.porFila === GUIA.porFila) return "listo";
  if (estado.filas === GUIA.filas) return "cada";
  return "filas";
}

// Listo no hace nada hasta que el huerto coincide y la pista dice que brilla.
export function listoGuiaActivo(estado) {
  return pasoGuia(estado) === "listo";
}

// A dónde va el foco solo. Nunca es Saltar: no entra en el orden de las flechas.
export function focoGuia(estado) {
  const paso = pasoGuia(estado);
  if (paso === "pedido") return "aceptar";
  if (paso === "filas") return estado.filas >= GUIA.filas ? "contador-cada" : "contador-filas";
  if (paso === "cada") return estado.porFila >= GUIA.porFila ? "listo" : "contador-cada";
  if (paso === "listo") return "listo";
  return "op-0";
}

// En la guía el contador no pasa del ejemplo: si no, el paso deja de coincidir.
export function topeGuia(campo, max) {
  if (campo === "filas") return Math.min(max, GUIA.filas);
  if (campo === "cada") return Math.min(max, GUIA.porFila);
  return max;
}

// Izquierda y derecha entre los contadores y Listo. Saltar no está.
export function cadenaFocoGuia() {
  return ["contador-filas", "contador-cada", "listo"];
}

// Al cerrar «¿Salir?», el foco vuelve al control que lo tenía.
export function focoAlCerrarSalir(guardado, esGuia, estado) {
  if (guardado) return guardado;
  return esGuia ? focoGuia(estado) : "";
}

// Atrás abre «¿Salir?» y el segundo lo cierra. No salta la guía ni sale del juego.
export function efectoAtrasGuia(saliendo) {
  return saliendo ? "seguir" : "preguntar";
}

export function lineaGuia(coach, aviso) {
  return aviso || coach || "";
}
