// Reto del día. La semilla es la fecha. No hay contrarreloj.
// El único reto es Pizza gigante: 8 pedidos, 5 bien.

import { rngConSemilla, entre } from "./rng.js";
import { crearPedido } from "./pedidos.js";

export const META_GIGANTE = { cuantos: 8, necesita: 5 };

export function retoDelDia(fecha, nivelActual, banco, textos) {
  const n = Math.max(1, Math.min(7, nivelActual | 0));
  const rnd = rngConSemilla("noli-pizzeria-reto-" + fecha);
  const problemas = Array.from({ length: META_GIGANTE.cuantos }, () => {
    const usa = n === 1 ? 1 : entre(rnd, 1, n);
    return crearPedido(usa, rnd, banco, textos, { facil: false });
  });
  return {
    fecha, tipo: "gigante", n, nombre: textos.retoGigante, meta: textos.retoGiganteMeta,
    ...META_GIGANTE, problemas,
  };
}
