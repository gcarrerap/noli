// Pistas. En el nivel 1 de dinero, el paso completo desde el principio.
// Después: «Empieza por la más grande», flecha a los 20 s, paso completo a los 40 s o tras un error.

import { pagarExacto, monedaMayor } from "./dinero.js";
import { fraseToca, rellenar } from "./frases.js";
import { cabe, formaDe, choques, girarAyuda } from "./casa.js";

export const FLECHA_MS = 20000;
export const COMPLETA_MS = 40000;
export const FALLOS_LUZ = 2;

export function pistaPagar({ nivelDinero, precio, bolsa, piezas, textos, errores = 0, ms = 0 }) {
  const sol = pagarExacto(precio, bolsa, piezas) || {};
  const completo = fraseToca(sol, piezas, textos);
  const mayor = monedaMayor(sol, piezas);
  if ((nivelDinero | 0) <= 1) {
    return { texto: completo.texto, voz: completo.voz, flecha: null, paso: "completo" };
  }
  if (errores > 0 || ms >= COMPLETA_MS) {
    return { texto: completo.texto, voz: completo.voz, flecha: mayor?.id || null, paso: "completo" };
  }
  if (ms >= FLECHA_MS) {
    return { texto: textos.empiezaGrande, voz: textos.vozGrande, flecha: mayor?.id || null, paso: "flecha" };
  }
  return { texto: textos.empiezaGrande, voz: textos.vozGrande, flecha: null, paso: "grande" };
}

/** Tras 2 intentos fallidos, las monedas que sirven. Null antes de eso. */
export function monedasQueSirven(precio, bolsa, piezas, fallos) {
  if ((fallos | 0) < FALLOS_LUZ) return null;
  return pagarExacto(precio, bolsa, piezas);
}

export function pistaLugar({ cuarto, puestos, x, y, mueble, rot, textos, catalogo }) {
  const f = formaDe(mueble, rot);
  const ahora = cabe(cuarto, puestos, x, y, f.w, f.h);
  const ayuda = girarAyuda(cuarto, puestos, x, y, mueble, rot);
  const lista = choques(puestos, cuarto?.id, x, y, f.w, f.h);
  const otro = lista[0];
  const nombre = otro ? (catalogo?.[otro.id]?.nombre || "un mueble") : "";
  if (otro) {
    return {
      texto: rellenar(textos.ahiHay, { nombre }),
      voz: rellenar(textos.vozAhi, { nombre }),
      tipo: "choque",
    };
  }
  if (!ahora && ayuda) return { texto: textos.giralos, voz: textos.vozGira, tipo: "girar" };
  if (!ahora) return { texto: textos.noCabe, voz: textos.noCabe, tipo: "no" };
  return { texto: "", voz: "", tipo: "ok" };
}
