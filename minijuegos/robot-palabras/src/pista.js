// Nivel 1: el paso completo desde el principio, y sí cuenta.
// Desde el 2: «Elige la palabra.», flecha a los 20 s,
// paso completo a los 40 s o tras un error. Eso ya no es a la primera.
import { UI, pistaCompleta } from "./textos.js";

export const FLECHA_S = 20;
export const COMPLETA_S = 40;

export function anulaPrimera(nivel, segundos, errores) {
  if ((errores || 0) > 0) return true;
  if ((nivel | 0) <= 1) return false;
  return (segundos || 0) >= COMPLETA_S;
}

export function pasoPista(nivel, segundos, errores) {
  if ((nivel | 0) <= 1 || (errores || 0) > 0 || (segundos || 0) >= COMPLETA_S) return "completo";
  if ((segundos || 0) >= FLECHA_S) return "flecha";
  return "corto";
}

export function pista(opts) {
  const nivel = opts.nivel || 1;
  const paso = pasoPista(nivel, opts.segundos || 0, opts.errores || 0);
  const anula = anulaPrimera(nivel, opts.segundos || 0, opts.errores || 0);
  if (paso === "corto") return { paso, texto: UI.elige, flecha: null, anula };
  if (paso === "flecha") return { paso, texto: UI.elige, flecha: opts.destino || null, anula };
  const texto = opts.completo || pistaCompleta(opts.palabra || "", opts.categoria || "noun");
  return { paso, texto, flecha: opts.destino || null, anula };
}
