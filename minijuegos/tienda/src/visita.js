// Un cliente: qué pide, con qué paga y qué hay que contestar. La moneda llega como datos.
import { entre, uno, revolver } from "./rng.js";
import { sumarLista, formar, opcionesCobro, opcionesSuma, piezaPorId, describir, texto } from "./dinero.js";

const snapPieza = (p) => ({
  id: p.id, valor: p.valor, tipo: p.tipo, nombre: p.nombre, plural: p.plural || p.nombre,
  nombreEn: p.nombreEn || "", etiqueta: p.etiqueta, color: p.color, borde: p.borde || p.color,
  tinta: p.tinta || "#2b2236", tam: p.tam || 1, centro: p.centro || "", banda: p.banda || "",
});

const snapCliente = (c) => ({
  id: c.id, nombre: c.nombre, animal: c.animal, orejas: c.orejas, color: c.color, panza: c.panza, lineas: c.lineas,
});

const snapProducto = (p, precio) => ({ id: p.id, nombre: p.nombre, dibujo: p.dibujo, color: p.color, precio });

function piezasDe(moneda, ids) {
  return (ids || []).map((id) => piezaPorId(moneda, id)).filter(Boolean);
}

// Montón de piezas que suma entre min y max.
export function armarMonton(piezas, rnd, opts) {
  const min = opts.min ?? 1;
  const max = opts.max;
  const minPiezas = opts.minPiezas ?? 1;
  const maxPiezas = opts.maxPiezas ?? 8;
  const exigeBillete = !!opts.exigeBillete;
  const validas = piezas.filter((p) => p.valor > 0 && p.valor <= max);
  if (!validas.length || min > max) return null;

  for (let i = 0; i < 60; i++) {
    const out = [];
    if (exigeBillete) {
      const bills = validas.filter((p) => p.tipo === "billete");
      if (!bills.length) break;
      out.push(uno(rnd, bills));
    }
    let suma = sumarLista(out);
    let guard = 0;
    while (out.length < maxPiezas && guard++ < 20) {
      const caben = validas.filter((p) => suma + p.valor <= max);
      if (!caben.length) break;
      if (suma >= min && out.length >= minPiezas && rnd() < 0.42) break;
      const p = uno(rnd, caben);
      out.push(p);
      suma += p.valor;
    }
    if (suma >= min && suma <= max && out.length >= minPiezas && (!exigeBillete || out.some((p) => p.tipo === "billete")))
      return out.map(snapPieza);
  }
  return fallback(validas, rnd, { min, max, minPiezas, maxPiezas, exigeBillete });
}

function fallback(validas, rnd, { min, max, minPiezas, maxPiezas, exigeBillete }) {
  const asc = [...validas].sort((a, b) => a.valor - b.valor);
  const out = [];
  if (exigeBillete) {
    const bills = validas.filter((p) => p.tipo === "billete" && p.valor <= max).sort((a, b) => a.valor - b.valor);
    if (bills.length) out.push(uno(rnd, bills));
  }
  let suma = sumarLista(out);
  const filler = (exigeBillete ? asc.filter((p) => p.tipo === "moneda") : asc);
  const base = filler[0] || asc[0];
  while (suma < min && out.length < Math.max(maxPiezas, 12)) {
    const cabe = [...(filler.length ? filler : asc)].reverse().find((p) => suma + p.valor <= max);
    if (!cabe) break;
    out.push(cabe);
    suma += cabe.valor;
  }
  if (suma >= min && suma <= max && out.length) return out.map(snapPieza);
  const sola = validas.find((p) => p.valor >= min && p.valor <= max && (!exigeBillete || p.tipo === "billete"));
  return sola ? [snapPieza(sola)] : null;
}

function montonChicas(piezas, rnd, nivel) {
  const pequena = [...piezas].filter((p) => p.tipo === "moneda").sort((a, b) => a.valor - b.valor)[0];
  if (!pequena) return null;
  const minPiezas = Math.min(12, Math.max(6, Math.ceil(nivel.min / pequena.valor)));
  const maxPiezas = Math.min(12, Math.floor(nivel.max / pequena.valor));
  if (maxPiezas < minPiezas) return null;
  return armarMonton([pequena], rnd, { min: nivel.min, max: nivel.max, minPiezas, maxPiezas });
}

function base(moneda, nivel, cliente, productos, pago, extra) {
  const pagoSnap = pago.map(snapPieza);
  const pagoTotal = sumarLista(pagoSnap);
  return {
    modo: nivel.modo, nivel: nivel.n, cliente: snapCliente(cliente),
    productos, total: extra.total ?? pagoTotal, pago: pagoSnap, pagoTotal,
    cambio: extra.cambio ?? 0, alcanza: extra.alcanza ?? null,
    opciones: extra.opciones || null, pasos: extra.pasos,
  };
}

function visitaContar(moneda, nivel, productos, clientes, rnd, variante) {
  const permitidas = piezasDe(moneda, nivel.piezas);
  const exigeBillete = variante === "conBillete" || (!!nivel.conBillete && variante !== "chicas" && rnd() < 0.55);
  let pago = null;
  if (variante === "chicas") pago = montonChicas(permitidas, rnd, nivel);
  if (!pago) pago = armarMonton(permitidas, rnd, { ...nivel, exigeBillete });
  if (!pago) return null;
  const cliente = uno(rnd, clientes);
  const producto = uno(rnd, productos);
  const total = sumarLista(pago);
  return base(moneda, nivel, cliente, [snapProducto(producto, total)], pago, {
    opciones: opcionesCobro(pago, moneda, rnd), pasos: ["contar"],
  });
}

function visitaCambio(moneda, nivel, productos, clientes, rnd) {
  const bills = piezasDe(moneda, nivel.billetes).filter((b) => b.valor <= (nivel.billeteMax || b.valor) && b.valor - 1 <= moneda.cambioMax);
  if (!bills.length) return null;
  const bill = uno(rnd, bills);
  const piso = Math.min(nivel.precioMin ?? 1, bill.valor - 1);
  let precio = piso;
  for (let i = 0; i < 20; i++) {
    const p = entre(rnd, piso, bill.valor - 1);
    if (formar(bill.valor - p, moneda.piezas, moneda.caja)) { precio = p; break; }
  }
  const cambio = bill.valor - precio;
  if (!formar(cambio, moneda.piezas, moneda.caja)) return null;
  const cliente = uno(rnd, clientes);
  const producto = uno(rnd, productos);
  return base(moneda, nivel, cliente, [snapProducto(producto, precio)], [bill], {
    total: precio, cambio, pasos: ["cambio"],
  });
}

function visitaDos(moneda, nivel, productos, clientes, rnd) {
  const bills = piezasDe(moneda, nivel.billetes).filter((b) => b.valor - 1 <= moneda.cambioMax);
  const a = entre(rnd, nivel.precioMin, nivel.precioMax);
  const b = entre(rnd, nivel.precioMin, nivel.precioMax);
  const total = a + b;
  const bill = bills.filter((x) => x.valor > total).sort((x, y) => x.valor - y.valor)[0];
  if (!bill) return null;
  const cambio = bill.valor - total;
  if (cambio <= 0 || !formar(cambio, moneda.piezas, moneda.caja)) return null;
  const cliente = uno(rnd, clientes);
  const [p1, p2] = revolver(rnd, productos).slice(0, 2);
  return base(moneda, nivel, cliente, [snapProducto(p1, a), snapProducto(p2, b)], [bill], {
    total, cambio, opciones: opcionesSuma(a, b, rnd), pasos: ["suma", "cambio"],
  });
}

function visitaAlcanza(moneda, nivel, productos, clientes, rnd) {
  const permitidas = piezasDe(moneda, nivel.piezas);
  const pago = armarMonton(permitidas, rnd, nivel);
  if (!pago) return null;
  const pagoTotal = sumarLista(pago);
  let alcanza = rnd() < 0.5;
  let precio;
  if (alcanza) {
    const piso = Math.max(1, pagoTotal - Math.max(8, Math.floor(pagoTotal * 0.45)));
    precio = entre(rnd, Math.min(piso, pagoTotal), pagoTotal);
  } else if (pagoTotal < (nivel.max || pagoTotal + 1)) {
    const techo = Math.min(nivel.max || pagoTotal + 30, pagoTotal + Math.max(8, Math.floor(pagoTotal * 0.45)));
    precio = techo > pagoTotal ? entre(rnd, pagoTotal + 1, techo) : pagoTotal;
    if (precio <= pagoTotal) alcanza = true;
  } else {
    alcanza = true;
    precio = pagoTotal;
  }
  const cliente = uno(rnd, clientes);
  const producto = uno(rnd, productos);
  const si = alcanza;
  const motivoSi = `Sí le alcanza: trae ${texto(moneda, pagoTotal)} y cuesta ${texto(moneda, precio)}.`;
  const motivoNo = `No le alcanza: trae ${texto(moneda, pagoTotal)} y cuesta ${texto(moneda, precio)}.`;
  const opciones = [
    { texto: "Sí", valor: 1, correcta: si, motivo: si ? "" : motivoNo },
    { texto: "No", valor: 0, correcta: !si, motivo: si ? motivoSi : "" },
  ];
  if (rnd() < 0.5) opciones.reverse();
  return base(moneda, nivel, cliente, [snapProducto(producto, precio)], pago, {
    total: precio, alcanza: si, opciones, pasos: ["alcanza"],
  });
}

export function generarVisita(moneda, nivelN, productos, clientes, rnd, variante = null) {
  const nivel = moneda.niveles.find((n) => n.n === nivelN) || moneda.niveles[0];
  for (let i = 0; i < 8; i++) {
    const v = nivel.modo === "cambio" ? visitaCambio(moneda, nivel, productos, clientes, rnd)
      : nivel.modo === "dos" ? visitaDos(moneda, nivel, productos, clientes, rnd)
      : nivel.modo === "alcanza" ? visitaAlcanza(moneda, nivel, productos, clientes, rnd)
      : visitaContar(moneda, nivel, productos, clientes, rnd, variante);
    if (v) return v;
  }
  return null;
}

// Día de tienda: hasta 2 clientes que salieron mal antes, y el resto nuevos.
export function armarDia(nivelN, fallos, moneda, productos, clientes, rnd, cuantos = 8) {
  const visitas = [];
  const previos = revolver(rnd, (fallos || []).filter((f) => f && f.nivel <= nivelN && f.visita));
  for (const f of previos) {
    if (visitas.length >= 2) break;
    visitas.push({ ...f.visita, tipo: "fallo" });
  }
  let i = 0;
  while (visitas.length < cuantos && i < 40) {
    const nivel = moneda.niveles.find((n) => n.n === nivelN);
    let variante = null;
    if (nivel?.modo === "contar" && nivelN <= 2 && visitas.length % 4 === 3) variante = "chicas";
    if (nivel?.conBillete && visitas.length % 3 === 0) variante = "conBillete";
    const v = generarVisita(moneda, nivelN, productos, clientes, rnd, variante);
    if (v) visitas.push({ ...v, tipo: "nuevo" });
    i++;
  }
  return visitas;
}

export function claveVisita(v) {
  const ids = (v.pago || []).map((p) => p.id).join(",");
  const precios = (v.productos || []).map((p) => p.precio).join(",");
  return [v.modo, v.total, v.pagoTotal, precios, ids].join("|");
}

export { describir };
