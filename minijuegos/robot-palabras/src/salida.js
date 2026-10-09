// Atrás abre «¿Salir?» con Seguir marcado. El segundo Atrás lo cierra.
// Al cerrar, los toques y OK de unos 400 ms no llegan al juego.
import { TRAGAR_MS, pausarReloj, seguirReloj } from "./guia.js";

export { TRAGAR_MS };

export function ignoraEntrada(tragarHasta, ahora, tipo) {
  if (!(ahora < tragarHasta)) return false;
  return tipo === "ok" || tipo === "toque" || tipo === "caja";
}

export function rutaAtras(dialogoAbierto) {
  return dialogoAbierto ? "cerrar" : "abrir";
}

export function toqueEnVelo({ tv = false, enDialogo = false } = {}) {
  if (tv || enDialogo) return "nada";
  return "seguir";
}

// La voz del premio puede acabar con «¿Salir?» abierto.
// En ese caso se guarda el paso para que Seguir lo corra; no se pierde el temporizador.
export function alTerminarPremio({ dialogo = false, ms = 400 } = {}) {
  const espera = Number(ms);
  const cuanto = Number.isFinite(espera) && espera >= 0 ? espera : 400;
  if (dialogo) return { accion: "guardar", ms: cuanto };
  return { accion: "correr", ms: cuanto };
}

// Solo el botón Salir sale. Atrás nunca sale del catálogo.
export function responder(ctx, entrada) {
  const ahora = entrada.ahora;
  if (ctx.dialogo) {
    if (entrada.tipo === "atras" || entrada.tipo === "seguir") {
      const reloj = ctx.reloj ? seguirReloj(ctx.reloj, ahora) : null;
      return {
        dialogo: false,
        reloj,
        tragarHasta: ahora + TRAGAR_MS,
        hecho: "seguir",
        repetirVoz: !!reloj,
      };
    }
    if (entrada.tipo === "salir-si") return { ...ctx, hecho: "salir" };
    if (entrada.tipo === "flecha" || entrada.tipo === "ok") return { ...ctx, hecho: "dialogo" };
    return { ...ctx, hecho: "ignorar" };
  }
  if (ignoraEntrada(ctx.tragarHasta || 0, ahora, entrada.tipo)) {
    return { ...ctx, hecho: "ignorar" };
  }
  if (entrada.tipo === "atras") {
    return {
      ...ctx,
      dialogo: true,
      reloj: ctx.reloj ? pausarReloj(ctx.reloj, ahora) : ctx.reloj,
      hecho: "abrir",
    };
  }
  return { ...ctx, hecho: "juego" };
}
