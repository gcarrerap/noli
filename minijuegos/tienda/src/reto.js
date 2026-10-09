// Reto del día: la semilla es la fecha (y la moneda), así que sale igual en la TV y en el teléfono.
import { rngConSemilla, uno } from "./rng.js";
import { describir, texto, formar, opcionesCobro, piezaPorId } from "./dinero.js";
import { generarVisita, armarMonton } from "./visita.js";

const diaNumero = (fecha) => {
  const [y, m, d] = fecha.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};

function llenar(plantilla, datos) {
  return plantilla.replace(/\{(\w+)\}/g, (_, k) => (datos[k] == null ? "" : String(datos[k])));
}

function opcionesNumero(correcto, candidatos, rnd) {
  const vals = [];
  const meter = (v) => { if (Number.isInteger(v) && v >= 0 && !vals.includes(v)) vals.push(v); };
  meter(correcto);
  for (const v of candidatos) meter(v);
  let k = 1;
  while (vals.length < 4 && k < 30) { meter(correcto + k); meter(correcto - k); k++; }
  const lista = vals.slice(0, 4).map((valor) => ({ valor, correcta: valor === correcto, motivo: "" }));
  for (let i = lista.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [lista[i], lista[j]] = [lista[j], lista[i]]; }
  return lista;
}

function problemaContar(moneda, nivelN, productos, clientes, rnd, plantillas) {
  const n = Math.min(Math.max(nivelN, 1), 3);
  const nivel = moneda.niveles.find((x) => x.n === n);
  const piezas = (nivel.piezas || []).map((id) => piezaPorId(moneda, id)).filter((p) => p && p.valor <= Math.min(nivel.max, 80));
  let pago = null;
  for (let i = 0; i < 8 && !pago; i++) pago = armarMonton(piezas, rnd, { min: Math.min(nivel.min, 40), max: Math.min(nivel.max, 80), minPiezas: 2, maxPiezas: 6 });
  const total = pago.reduce((s, p) => s + p.valor, 0);
  const cliente = uno(rnd, clientes);
  const producto = uno(rnd, productos);
  const textoHistoria = llenar(uno(rnd, plantillas), { nombre: cliente.nombre, descripcion: describir(pago), producto: producto.nombre });
  return { texto: textoHistoria, opciones: opcionesCobro(pago, moneda, rnd), respuesta: total };
}

function problemaCambio(moneda, nivelN, productos, clientes, rnd, plantillas) {
  const def = [...moneda.niveles].reverse().find((x) => x.modo === "cambio" && x.n <= Math.max(nivelN, 4)) || moneda.niveles.find((x) => x.modo === "cambio");
  const bills = (def.billetes || []).map((id) => piezaPorId(moneda, id)).filter((b) => b && b.valor - 1 <= moneda.cambioMax && b.valor <= (def.billeteMax || b.valor));
  const bill = uno(rnd, bills);
  const piso = Math.min(def.precioMin || 1, bill.valor - 1);
  let precio = piso;
  for (let i = 0; i < 15; i++) {
    const p = piso + Math.floor(rnd() * (bill.valor - piso));
    if (formar(bill.valor - p, moneda.piezas, moneda.caja)) { precio = p; break; }
  }
  const cambio = bill.valor - precio;
  const cliente = uno(rnd, clientes);
  const producto = uno(rnd, productos);
  const textoHistoria = llenar(uno(rnd, plantillas), {
    nombre: cliente.nombre, producto: producto.nombre, precio: texto(moneda, precio), pago: bill.nombre,
  });
  const opciones = opcionesNumero(cambio, [precio, bill.valor, cambio + 1, Math.max(0, cambio - 1), cambio + 10], rnd)
    .map((o) => ({
      ...o,
      motivo: o.correcta ? "" : o.valor === precio ? "Ese es el precio, no el cambio." : o.valor === bill.valor ? "Eso es lo que pagó, no el cambio." : "Resta el precio de lo que te dio.",
    }));
  return { texto: textoHistoria, opciones, respuesta: cambio };
}

function problemasMisteriosos(moneda, nivelN, datos, rnd, cuantos) {
  const tipo = nivelN >= 4 ? "cambio" : "contar";
  const plantillas = datos.retos.plantillas[tipo];
  return Array.from({ length: cuantos }, () => (tipo === "cambio"
    ? problemaCambio(moneda, nivelN, datos.productos, datos.clientes, rnd, plantillas)
    : problemaContar(moneda, nivelN, datos.productos, datos.clientes, rnd, plantillas)));
}

// nivelActual: el nivel desbloqueado en esa moneda. El tipo depende solo de la fecha.
export function retoDelDia(fecha, nivelActual, moneda, datos) {
  const retos = datos.retos;
  const tipo = retos.orden[diaNumero(fecha) % retos.orden.length];
  const info = retos[tipo];
  const nivel = Math.max(1, Math.min(moneda.niveles.length, nivelActual | 0 || 1));
  const rnd = rngConSemilla(`noli-tienda-${fecha}-${moneda.id}`);
  const reto = {
    fecha, tipo, nivel, moneda: moneda.id,
    nombre: tipo === "cambioPerfecto" && nivel < 4 && info.nombreAntes ? info.nombreAntes : info.nombre,
    meta: info.meta, segundos: info.segundos || 0, objetivo: info.objetivo || 0,
    cuantos: info.cuantos || 0, necesita: info.necesita || 0,
  };
  const varias = (cuantos, n) => {
    const out = [];
    let guard = 0;
    while (out.length < cuantos && guard++ < cuantos * 6) {
      const v = generarVisita(moneda, n, datos.productos, datos.clientes, rnd);
      if (v) out.push(v);
    }
    return out;
  };
  if (tipo === "horaPico") reto.visitas = varias(40, Math.min(nivel, 3));
  else if (tipo === "cambioPerfecto") reto.visitas = varias(info.cuantos, nivel < 4 ? nivel : nivel >= 6 ? 6 : 4);
  else reto.problemas = problemasMisteriosos(moneda, nivel, datos, rnd, info.cuantos);
  return reto;
}

export function cumplioReto(reto, puntos) {
  if (reto.tipo === "horaPico") return puntos >= reto.objetivo;
  if (reto.tipo === "cambioPerfecto") return puntos >= reto.cuantos;
  return puntos >= reto.necesita;
}
