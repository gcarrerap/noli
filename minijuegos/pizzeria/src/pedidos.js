// Pedidos de la pizzería. Las frases salen de textos.json.
// Las fracciones se dicen con palabras: la mitad, un tercio, un cuarto.

import { entre, uno, revolver } from "./rng.js";
import { opcionesCorte, patron } from "./cortes.js";
import { opcionesForma } from "./figuras.js";
import { tamanoBandeja, totalBandeja, cuentaFilas } from "./bandeja.js";

export const POR_TURNO = 6;
export const NIVELES_MAX = 7;

function llenar(plantilla, vars) {
  return String(plantilla || "").replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? "" : String(vars[k])));
}

function acuerdoPartes(n) {
  return (n | 0) === 1 ? "parte" : "partes";
}

function fraseFraccion(n, d, textos) {
  if (n === 1 && d === 2) return textos.fraccion["2"];
  if (n === 2 && d === 4) return textos.fraccion["2"];
  if (n === 1 && d === 3) return textos.fraccion["3"];
  if (n === 1 && d === 4) return textos.fraccion["4"];
  if (n === 3 && d === 4) return textos.tresCuartos;
  if (n === 2 && d === 3) return textos.dosTercios;
  return llenar(textos.dePartes, { n, d, partes: acuerdoPartes(d) });
}

function pedidoBase(nivel, tipo, extra) {
  return { nivel, tipo, repaso: false, ...extra };
}

function ingrediente(rnd, textos) {
  const ids = Object.keys(textos.ingredientes);
  const id = uno(rnd, ids);
  return { id, nombre: textos.ingredientes[id] };
}

export function crearPedido(nivel, rnd, banco, textos, { bien = 0, facil = false } = {}) {
  const n = Math.max(1, Math.min(NIVELES_MAX, nivel | 0));
  if (n === 1) return pedidoForma(rnd, textos, facil);
  if (n === 2) return pedidoCorta(rnd, banco, textos, { partes: 2, facil });
  if (n === 3) return pedidoNivel3(rnd, banco, textos, facil);
  if (n === 4) return pedidoNivel4(rnd, banco, textos, facil);
  if (n === 5) return pedidoNivel5(rnd, banco, textos, facil);
  if (n === 6) return pedidoDecora(rnd, banco, textos, bien, facil);
  return pedidoBandeja(rnd, textos, facil);
}

function pedidoForma(rnd, textos, facil) {
  const pide = rnd() < 0.5 ? "lados" : "esquinas";
  const bolsa = pide === "esquinas" ? [3, 4, 5, 6] : [3, 4, 5, 6];
  const cantidad = uno(rnd, bolsa);
  const { opciones, correcta } = opcionesForma(cantidad, rnd, facil);
  const plantilla = pide === "esquinas" ? textos.esquinas : textos.lados;
  const texto = llenar(plantilla, { n: cantidad });
  return pedidoBase(1, "forma", {
    pide, cantidad, opciones, correcta, texto, leer: texto, pista: pide === "esquinas" ? textos.pistaEsquinas : textos.pistaLados,
  });
}

function pedidoCorta(rnd, banco, textos, { partes, facil, pregunta = null, preferirForma = null, forzarParalelos = false }) {
  const { opciones, correcta } = opcionesCorte(banco, rnd, { partes, facil, forzarParalelos, preferirForma });
  const palabra = textos.fraccion[String(partes)];
  const trozos = acuerdoPartes(partes);
  const texto = pregunta || (partes === 4
    ? llenar(textos.cortaPalabra, { palabra, n: partes, partes: trozos })
    : llenar(textos.cortaIguales, { n: partes, partes: trozos }));
  return pedidoBase(partes === 2 ? 2 : partes === 4 ? 3 : 4, "corta", {
    partes, opciones: opciones.map((p) => p.id), correcta, texto, leer: texto,
  });
}

function pedidoNivel3(rnd, banco, textos, facil) {
  const tiro = rnd();
  if (!facil && tiro < 0.18) return pedidoEntero(rnd, textos, 4);
  const partes = rnd() < 0.45 ? 2 : 4;
  const preferir = partes === 4 ? uno(rnd, [null, "tiras", "cuadros", "triangulos"]) : uno(rnd, [null, "triangulos"]);
  const p = pedidoCorta(rnd, banco, textos, { partes, facil, preferirForma: preferir });
  p.nivel = 3;
  if (partes === 4) p.nota = textos.reloj;
  return p;
}

function pedidoNivel4(rnd, banco, textos, facil) {
  if (!facil && rnd() < 0.18) return pedidoMayor(textos);
  const p = pedidoCorta(rnd, banco, textos, { partes: 3, facil, forzarParalelos: true });
  p.nivel = 4;
  return p;
}

function pedidoNivel5(rnd, banco, textos, facil) {
  const tiro = rnd();
  if (tiro < 0.18) return pedidoEntero(rnd, textos, uno(rnd, [2, 3, 4]));
  if (tiro < 0.36) return pedidoMayor(textos);
  if (tiro < 0.5) {
    const p = pedidoForma(rnd, textos, facil);
    p.nivel = 5;
    p.repaso = true;
    return p;
  }
  const partes = uno(rnd, [2, 3, 4]);
  const preferir = partes === 4 ? uno(rnd, ["tiras", "cuadros", "triangulos"]) : (partes === 2 ? "triangulos" : null);
  const p = pedidoCorta(rnd, banco, textos, {
    partes, facil, preferirForma: preferir, forzarParalelos: partes === 3,
    pregunta: textos.cualesIguales,
  });
  p.nivel = 5;
  return p;
}

function pedidoEntero(rnd, textos, partes) {
  const clave = partes === 2 ? "enteroMitades" : partes === 3 ? "enteroTercios" : "enteroCuartos";
  const unidad = textos.unidad[String(partes)];
  const opciones = revolver(rnd, [2, 3, 4]).map((n) => ({
    id: String(n),
    n,
    texto: llenar(textos.opcionPartes, { n, unidad }),
  }));
  return pedidoBase(partes === 4 ? 3 : partes === 3 ? 4 : 5, "entero", {
    partes, correcta: String(partes), opciones,
    texto: textos[clave], leer: textos[clave],
    nota: partes === 4 ? textos.reloj : "",
  });
}

function pedidoMayor(textos) {
  return pedidoBase(5, "mayor", {
    correcta: "tercio",
    opciones: [
      { id: "tercio", texto: textos.unTercio, partes: 3 },
      { id: "cuarto", texto: textos.unCuarto, partes: 4 },
    ],
    texto: textos.mayor, leer: textos.mayor, pista: textos.pistaMayor,
  });
}

const TAREAS_DECORA = [[4, 2], [3, 1], [4, 1], [4, 3], [2, 1], [3, 2]];

function pedidoDecora(rnd, banco, textos, bien, facil) {
  const temprano = bien < 4;
  const bolsa = temprano && bien === 0 ? [[4, 2], [3, 1], [4, 1]] : TAREAS_DECORA;
  const [d, n] = uno(rnd, bolsa);
  const cuanto = temprano ? llenar(textos.dePartes, { n, d, partes: acuerdoPartes(d) }) : fraseFraccion(n, d, textos);
  const ing = ingrediente(rnd, textos);
  const iguales = (banco.patrones || []).filter((p) => !p.guia && p.iguales && p.partes === d);
  const base = iguales[Math.floor(rnd() * iguales.length)] || patron(banco, d === 3 ? "redonda-tercios" : d === 2 ? "redonda-mitad" : "redonda-cuartos");
  const texto = llenar(textos.pon, { ing: ing.nombre, cuanto });
  const pista = llenar(textos.ponPartes, { ing: ing.nombre, n, partes: acuerdoPartes(n) });
  return pedidoBase(6, "decora", {
    partes: d, cuantas: n, ingrediente: ing.id, ingNombre: ing.nombre,
    patron: base.id, forma: base.forma, texto, leer: texto, pista,
    nota: !temprano && n === 1 && d === 4 ? textos.reloj : "",
    palabra: !temprano,
  });
}

function pedidoBandeja(rnd, textos, facil) {
  const { filas, columnas } = tamanoBandeja(rnd, facil);
  const texto = `${textos.llena}: ${llenar(textos.filasDe, { f: filas, c: columnas })}`;
  const leer = `${textos.llena}. ${llenar(textos.filasDe, { f: filas, c: columnas })}.`;
  const pista = llenar(textos.filasDe, { f: filas, c: columnas });
  return pedidoBase(7, "bandeja", {
    filas, columnas, total: totalBandeja(filas, columnas),
    cuenta: cuentaFilas(filas, columnas),
    texto, leer, pista,
  });
}

export function esCorrecto(pedido, respuesta) {
  if (!pedido) return false;
  if (pedido.tipo === "decora") return respuesta === pedido.cuantas;
  if (pedido.tipo === "bandeja") return !!respuesta && respuesta.filas === pedido.filas && respuesta.columnas === pedido.columnas;
  if (pedido.tipo === "cuantos") return respuesta === pedido.total;
  return respuesta === pedido.correcta;
}

export function nivelDePedido(n) {
  return Math.max(1, Math.min(NIVELES_MAX, n | 0));
}

export { entre };
