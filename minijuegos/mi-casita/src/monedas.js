// Monedas de La Tienda, solo lectura: el dibujo y los JSON no se copian.

export { piezaSvg } from "../../tienda/src/dibujos.js";
export { texto, textoLargo } from "../../tienda/src/dinero.js";

const cache = new Map();

function traer(id) {
  if (id === "mxn") return import("../../tienda/datos/mxn.json", { with: { type: "json" } });
  return import("../../tienda/datos/usd.json", { with: { type: "json" } });
}

export function cargarMoneda(id) {
  const cual = id === "mxn" ? "mxn" : "usd";
  if (cache.has(cual)) return Promise.resolve(cache.get(cual));
  const ruta = cual === "mxn" ? "../../tienda/datos/mxn.json" : "../../tienda/datos/usd.json";
  return traer(cual)
    .then((m) => m.default || m)
    .catch(() => fetch(new URL(ruta, import.meta.url)).then((r) => {
      if (!r.ok) throw new Error(ruta);
      return r.json();
    }))
    .then((d) => { cache.set(cual, d); return d; });
}
