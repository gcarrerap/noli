// Guía con ejemplo fijo: una lámpara que cuesta 6.
// Los pasos que solo muestran algo se van con un toque, con OK o solos a los 2 s.
// Los de acción solo avanzan cuando ella hace ese paso. OK repetido no los salta.
// Pagar no responde hasta su paso. El foco nunca cae en Saltar solo.

export const PASOS = ["escoger", "precio", "monedas", "pagar", "cuadro", "fin"];
export const GUIA_TOQUE_MS = 2000;

export function guiaNueva() {
  return { paso: "escoger", orden: [], movio: false, lista: false };
}

export function bolsaGuia(monedaId) {
  if (monedaId === "mxn") return { p10: 1, p5: 1, p1: 1 };
  return { dime: 1, nickel: 1, penny: 1 };
}

/** Precio y el cierre solo se miran. El resto pide una acción. */
export function guiaAvanzaConToque(paso) {
  return paso === "precio" || paso === "fin";
}

/** El botón Pagar sigue apagado hasta el paso de pagar. */
export function guiaPagarActivo(paso) {
  return paso === "pagar";
}

export function textoGuia(paso, modo, textos) {
  const tv = modo === "tv";
  if (paso === "escoger") return textos.guiaEscoger;
  if (paso === "precio") return textos.guiaPrecio;
  if (paso === "monedas") return tv ? textos.guiaMonedasTv : textos.guiaMonedas;
  if (paso === "pagar") return tv ? textos.guiaPagarTv : textos.guiaPagar;
  if (paso === "cuadro") return tv ? textos.guiaCuadroTv : textos.guiaCuadro;
  return textos.guiaFin;
}

export function vozGuia(paso, modo, textos) {
  const tv = modo === "tv";
  if (paso === "escoger") return textos.vozEscoger;
  if (paso === "precio") return textos.vozPrecio;
  if (paso === "monedas") return tv ? textos.vozMonedasTv : textos.vozMonedas;
  if (paso === "pagar") return tv ? textos.vozPagarTv : textos.vozPagar;
  if (paso === "cuadro") return tv ? textos.vozCuadroTv : textos.vozCuadro;
  return textos.guiaFin;
}

function valores(orden, piezas) {
  const vals = [];
  for (const id of orden || []) {
    const p = (piezas || []).find((x) => x.id === id);
    if (p) vals.push(p.valor);
  }
  return vals;
}

/** Las monedas del ejemplo son una de 5 y una de 1, nada más. */
export function monedasDeGuia(orden, piezas) {
  const vals = valores(orden, piezas).slice().sort((a, b) => a - b);
  return vals.length === 2 && vals[0] === 1 && vals[1] === 5;
}

/**
 * A dónde va el foco al entrar en el paso. Nunca es Saltar:
 * después de cada paso se mueve al control que sigue.
 */
export function focoDeGuia(paso, orden, piezas) {
  if (paso === "monedas") {
    const vals = valores(orden, piezas);
    if (!vals.includes(5)) return "moneda-cinco";
    if (!vals.includes(1)) return "moneda-uno";
    return "moneda-cinco";
  }
  if (paso === "precio") return "precio";
  if (paso === "pagar") return "pagar";
  if (paso === "cuadro") return "cuadro";
  if (paso === "fin") return "fin-guia";
  return "mueble-lampara";
}

function lista(g) {
  return { ...g, paso: "fin", lista: true, orden: [] };
}

function aFin(g) {
  return { ...g, paso: "fin", movio: false, orden: [] };
}

/**
 * accion.tipo: saltar | toque | ok | tiempo | escoger | monedas | pagar | mover | cuadro
 * toque, ok y tiempo solo cambian un paso de mostrar.
 * El modo ("tv" o "tactil") decide cómo se cumple el cuarto.
 */
export function aplicarGuia(g, accion, piezas) {
  if (!g || g.lista) return g;
  if (accion?.tipo === "saltar") return lista(g);
  const paso = g.paso;
  const tipo = accion?.tipo;
  if (guiaAvanzaConToque(paso) && (tipo === "toque" || tipo === "ok" || tipo === "tiempo")) {
    if (paso === "precio") return { ...g, paso: "monedas", orden: [] };
    if (paso === "fin") return lista(g);
  }
  if (paso === "escoger" && tipo === "escoger" && accion.id === "lampara") {
    return { ...g, paso: "precio" };
  }
  if (paso === "monedas" && tipo === "monedas") {
    const orden = accion.orden || [];
    if (monedasDeGuia(orden, piezas)) return { ...g, paso: "pagar", orden };
    return { ...g, orden };
  }
  if (tipo === "pagar") {
    if (paso === "pagar" && monedasDeGuia(g.orden, piezas)) {
      return { ...g, paso: "cuadro", orden: [], movio: false };
    }
    return g;
  }
  if (paso === "cuadro") {
    if (tipo === "mover") return { ...g, movio: true };
    if (tipo === "cuadro" && accion.modo !== "tv") return aFin(g);
    if (tipo === "ok" && accion.modo === "tv" && g.movio) return aFin(g);
  }
  return g;
}
