// Guía con ejemplo fijo: una lámpara que cuesta 6.
// Cada paso avanza solo cuando ella hace ese paso. Saltar la cierra.

export const PASOS = ["escoger", "precio", "monedas", "pagar", "cuadro", "fin"];

export function guiaNueva() {
  return { paso: "escoger", orden: [], movio: false, lista: false };
}

export function bolsaGuia(monedaId) {
  if (monedaId === "mxn") return { p10: 1, p5: 1, p1: 1 };
  return { dime: 1, nickel: 1, penny: 1 };
}

export function textoGuia(paso, modo, textos) {
  if (paso === "escoger") return textos.guiaEscoger;
  if (paso === "precio") return textos.guiaPrecio;
  if (paso === "monedas") return textos.guiaMonedas;
  if (paso === "pagar") return textos.guiaPagar;
  if (paso === "cuadro") return modo === "tv" ? textos.guiaCuadroTv : textos.guiaCuadro;
  return textos.guiaFin;
}

export function vozGuia(paso, modo, textos) {
  if (paso === "escoger") return textos.vozEscoger;
  if (paso === "precio") return textos.vozPrecio;
  if (paso === "monedas") return textos.vozMonedas;
  if (paso === "pagar") return textos.vozPagar;
  if (paso === "cuadro") return modo === "tv" ? textos.vozCuadroTv : textos.vozCuadro;
  return textos.guiaFin;
}

function lista(g) {
  return { ...g, paso: "fin", lista: true, orden: [] };
}

/** Las monedas del ejemplo son una de 5 y una de 1, nada más. */
export function monedasDeGuia(orden, piezas) {
  const vals = [];
  for (const id of orden || []) {
    const p = (piezas || []).find((x) => x.id === id);
    if (p) vals.push(p.valor);
  }
  vals.sort((a, b) => a - b);
  return vals.length === 2 && vals[0] === 1 && vals[1] === 5;
}

/**
 * accion.tipo: saltar | escoger | verPrecio | monedas | pagar | mover | cuadro | ok
 * El modo ("tv" o "tactil") decide cómo se cumple el cuarto.
 */
export function aplicarGuia(g, accion, piezas) {
  if (!g || g.lista) return g;
  if (accion?.tipo === "saltar") return lista(g);
  const paso = g.paso;
  if (paso === "escoger" && accion?.tipo === "escoger" && accion.id === "lampara") {
    return { ...g, paso: "precio" };
  }
  if (paso === "precio" && accion?.tipo === "verPrecio") return { ...g, paso: "monedas", orden: [] };
  if (paso === "monedas" && accion?.tipo === "monedas") {
    const orden = accion.orden || [];
    if (monedasDeGuia(orden, piezas)) return { ...g, paso: "pagar", orden };
    return { ...g, orden };
  }
  if (paso === "pagar" && accion?.tipo === "pagar" && monedasDeGuia(g.orden, piezas)) {
    return { ...g, paso: "cuadro", orden: [], movio: false };
  }
  if (paso === "cuadro") {
    if (accion?.tipo === "mover") return { ...g, movio: true };
    if (accion?.tipo === "cuadro" && accion.modo !== "tv") return lista(g);
    if (accion?.tipo === "ok" && accion.modo === "tv" && g.movio) return lista(g);
  }
  return g;
}
