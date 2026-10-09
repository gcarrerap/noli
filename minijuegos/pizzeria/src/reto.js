// Reto del día. La semilla es la fecha. No hay contrarreloj.
// Pizza gigante: 8 pedidos, 5 bien. Cliente exigente: pedidos dobles.

import { rngConSemilla, entre } from "./rng.js";
import { crearPedido } from "./pedidos.js";

export const META_GIGANTE = { cuantos: 8, necesita: 5 };
export const META_EXIGENTE = { cuantos: 6, necesita: 4 };

const diaNumero = (fecha) => {
  const [y, m, d] = fecha.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};

function doble(nivel, rnd, banco, textos) {
  const a = crearPedido(nivel, rnd, banco, textos, { facil: true });
  const bNivel = nivel >= 6 ? 6 : nivel;
  const b = crearPedido(bNivel, rnd, banco, textos, { facil: true });
  return {
    tipo: "doble", nivel, texto: textos.doble, leer: textos.dobleVoz,
    pasos: [a, b],
  };
}

export function retoDelDia(fecha, nivelActual, banco, textos) {
  const tipo = diaNumero(fecha) % 2 === 0 ? "gigante" : "exigente";
  const n = Math.max(1, Math.min(7, nivelActual | 0));
  const rnd = rngConSemilla("noli-pizzeria-reto-" + fecha);
  if (tipo === "gigante") {
    const problemas = Array.from({ length: META_GIGANTE.cuantos }, () => {
      const usa = n === 1 ? 1 : entre(rnd, 1, n);
      return crearPedido(usa, rnd, banco, textos, { facil: false });
    });
    return {
      fecha, tipo, n, nombre: textos.retoGigante, meta: textos.retoGiganteMeta,
      ...META_GIGANTE, problemas,
    };
  }
  const problemas = Array.from({ length: META_EXIGENTE.cuantos }, () => doble(n, rnd, banco, textos));
  return {
    fecha, tipo, n, nombre: textos.retoExigente, meta: textos.retoExigenteMeta,
    ...META_EXIGENTE, problemas,
  };
}
