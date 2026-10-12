// La guía de la primera vez: una visita fija y corta. Monos 3, leones 2, jirafas 4; gráfica de dibujos;
// una sola pregunta («¿Quién necesita más comida?»). No cuenta para subir de nivel.
import { crearVisita } from "./niveles.js";
import { rngConSemilla } from "./rng.js";

export const GUIA = { animales: ["mono", "leon", "jirafa"], cuentas: [3, 2, 4] };

export function visitaGuia() {
  const v = crearVisita(1, rngConSemilla("noli-safari-guia"), { animales: GUIA.animales, cuentas: GUIA.cuentas, plan: [["mas"]] });
  return { ...v, guia: true };
}

// La línea de ayuda de cada paso. `tv`: con el control se dice «Pulsa ▲» en vez de «Toca +».
// `animal` es el objeto de animales.js (para decir «los monos» o «las jirafas»).
export function textoPaso(paso, { tv = false, animal = null, cuenta = 0 } = {}) {
  switch (paso) {
    case "contar": {
      const quien = animal ? `${animal.f ? "las" : "los"} ${animal.plural}` : "los animales";
      const t = `Cuenta ${quien}. ${tv ? "Elige" : "Toca"} el número.`;
      return { texto: t, leer: t };
    }
    case "quietos": return { texto: "¿Se mueven mucho? Pide «Quietos».", leer: "Si se mueven mucho, pide quietos." };
    case "grafica": {
      const de = animal ? ` de ${animal.plural}` : "";
      return tv
        ? { texto: `Sube la columna${de} con ▲ hasta ${cuenta}. OK pasa a la otra.`, leer: `Sube la columna${de} con arriba hasta ${cuenta}. OK pasa a la otra.` }
        : { texto: `Columna${de}: toca + hasta ${cuenta}.`, leer: `Columna${de}: toca más hasta ${cuenta}.` };
    }
    case "listo": return { texto: tv ? "¿Ya está? Pulsa Listo." : "¿Ya está? Toca Listo.", leer: "¿Ya está? Listo." };
    case "detective": return { texto: "Compara cada columna con lo que contaste. Arregla la que esté mal.", leer: "Compara cada columna con lo que contaste. Arregla la que esté mal." };
    case "preguntas": return { texto: "Mira la gráfica para contestar.", leer: "Mira la gráfica para contestar." };
    default: return { texto: "", leer: "" };
  }
}
