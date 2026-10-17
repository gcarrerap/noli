// Cajas Sorpresa: lógica pura (sin DOM). Todo se prueba en Node con una semilla fija (tests/).
//
// estado (lo que se guarda con Noli.guardar):
//   tengo     { id: cuántas veces la ha sacado }  (≥ 1 = la tiene; canjear con polvo cuenta 1)
//   polvo     polvo de estrellas acumulado
//   abiertas  cajas abiertas en total
//   sinRara   cajas seguidas sin rara ni ultra rara (garantía de rara)
//   sinUltra  cajas seguidas sin ultra rara (garantía de ultra rara)
//   dia       { fecha: "AAAA-MM-DD", n }  cajas abiertas ese día (límite diario)
//   historial [{ f, id, r, nueva, polvo }]  más nueva al final; f = fecha y hora ISO
//   limite    límite diario puesto en Para papás (null = el de config)
//   cerrada   true si papás cerraron la tienda
//   guia      true cuando ya vio la guía de la primera vez

export const RAREZAS = ["comun", "rara", "ultra"];

export function estadoNuevo() {
  return { v: 1, tengo: {}, polvo: 0, abiertas: 0, sinRara: 0, sinUltra: 0, dia: { fecha: "", n: 0 },
    historial: [], limite: null, cerrada: false, guia: false };
}

const ent = (x, min = 0) => (Number.isInteger(x) && x >= min ? x : min);

// Lo guardado puede venir viejo, incompleto o de otro dispositivo: se normaliza sin perder lo bueno.
export function cargar(d) {
  const e = estadoNuevo();
  if (!d || typeof d !== "object") return e;
  if (d.tengo && typeof d.tengo === "object") {
    for (const [id, n] of Object.entries(d.tengo)) if (ent(n) > 0) e.tengo[id] = ent(n);
  }
  e.polvo = ent(d.polvo);
  e.abiertas = ent(d.abiertas);
  e.sinRara = ent(d.sinRara);
  e.sinUltra = ent(d.sinUltra);
  if (d.dia && typeof d.dia.fecha === "string") e.dia = { fecha: d.dia.fecha, n: ent(d.dia.n) };
  if (Array.isArray(d.historial)) e.historial = d.historial.filter((h) => h && typeof h.id === "string");
  e.limite = Number.isInteger(d.limite) && d.limite >= 0 ? d.limite : null;
  e.cerrada = d.cerrada === true;
  e.guia = d.guia === true;
  return e;
}

export const tiene = (e, id) => (e.tengo[id] || 0) > 0;
export const cuantasTiene = (e, piezas) => piezas.filter((p) => tiene(e, p.id)).length;
export const completa = (e, piezas) => cuantasTiene(e, piezas) === piezas.length;
export const limiteDe = (e, cfg) => (e.limite === null ? cfg.limiteDia : e.limite);
export const cajasHoy = (e, fecha) => (e.dia.fecha === fecha ? e.dia.n : 0);
export const quedanHoy = (e, cfg, fecha) => Math.max(0, limiteDe(e, cfg) - cajasHoy(e, fecha));

// Cuántas cajas faltan, como máximo, para la garantía ("tu rara llega en N cajas o menos")
export const faltanRara = (e, cfg) => Math.max(1, cfg.garantia.rara - e.sinRara);
export const faltanUltra = (e, cfg) => Math.max(1, cfg.garantia.ultra - e.sinUltra);

// ¿Se puede abrir una caja ahora? No cobra: el juego cobra con Noli.gastar después de esto.
// motivo: "cerrada" | "limite" | "creditos" | "completa"; faltan = créditos que faltan
export function puedeAbrir(e, cfg, piezas, fecha, saldo) {
  if (e.cerrada) return { ok: false, motivo: "cerrada" };
  if (completa(e, piezas)) return { ok: false, motivo: "completa" };
  if (quedanHoy(e, cfg, fecha) <= 0) return { ok: false, motivo: "limite" };
  if (typeof saldo === "number" && saldo < cfg.costo) return { ok: false, motivo: "creditos", faltan: cfg.costo - saldo };
  return { ok: true };
}

// La rareza de la siguiente caja: primero las garantías, si no, al azar con las probabilidades.
export function rarezaDeCaja(e, cfg, rng) {
  const p = cfg.probabilidad;
  if (e.sinUltra + 1 >= cfg.garantia.ultra) return "ultra";
  if (e.sinRara + 1 >= cfg.garantia.rara) return rng() < p.ultra / (p.ultra + p.rara) ? "ultra" : "rara";
  const x = rng();
  if (x < p.ultra) return "ultra";
  if (x < p.ultra + p.rara) return "rara";
  return "comun";
}

// Qué pieza trae la caja. En las primeras `sinRepetir` cajas no se repite nada: si ya tiene todas las de la
// rareza que salió, se da una que le falte de otra rareza (primero la más común).
export function sacar(e, cfg, piezas, rng) {
  let rareza = rarezaDeCaja(e, cfg, rng);
  let opciones = piezas.filter((p) => p.rareza === rareza);
  if (e.abiertas < cfg.sinRepetir) {
    const faltan = (r) => piezas.filter((p) => p.rareza === r && !tiene(e, p.id));
    if (!faltan(rareza).length) rareza = RAREZAS.find((r) => faltan(r).length) || rareza;
    const f = faltan(rareza);
    if (f.length) opciones = f;
  }
  const pieza = opciones[Math.floor(rng() * opciones.length) % opciones.length];
  return pieza;
}

// Abre una caja (ya cobrada). Regresa el estado nuevo (no cambia el de entrada) y lo que salió.
export function abrir(e, cfg, piezas, rng, fecha, ahora = "") {
  const pieza = sacar(e, cfg, piezas, rng);
  const nueva = !tiene(e, pieza.id);
  const polvo = nueva ? 0 : cfg.polvoPorRepetida[pieza.rareza];
  const r = pieza.rareza;
  const historial = [...e.historial, { f: ahora, id: pieza.id, r, nueva, polvo }].slice(-cfg.historialMax);
  const estado = {
    ...e,
    tengo: { ...e.tengo, [pieza.id]: (e.tengo[pieza.id] || 0) + 1 },
    polvo: e.polvo + polvo,
    abiertas: e.abiertas + 1,
    sinRara: r === "comun" ? e.sinRara + 1 : 0,
    sinUltra: r === "ultra" ? 0 : e.sinUltra + 1,
    dia: { fecha, n: cajasHoy(e, fecha) + 1 },
    historial,
  };
  return { estado, resultado: { pieza, nueva, polvo } };
}

export const precioPolvo = (cfg, pieza) => cfg.precioPolvo[pieza.rareza];

// Escoger con polvo de estrellas una pieza que le falta
export function canjear(e, cfg, pieza) {
  if (e.cerrada) return { ok: false, motivo: "cerrada", estado: e };
  if (tiene(e, pieza.id)) return { ok: false, motivo: "ya", estado: e };
  const precio = precioPolvo(cfg, pieza);
  if (e.polvo < precio) return { ok: false, motivo: "polvo", faltan: precio - e.polvo, estado: e };
  return { ok: true, estado: { ...e, polvo: e.polvo - precio, tengo: { ...e.tengo, [pieza.id]: 1 } } };
}

// "más o menos 3 de cada 4": la fracción sencilla más cercana a la probabilidad, para enseñarla sin porcentajes
export function deCada(p) {
  let mejor = [1, 1], err = Infinity;
  for (let d = 1; d <= 20; d++) {
    const n = Math.max(1, Math.round(p * d));
    const x = Math.abs(n / d - p);
    if (x < err - 1e-9) { err = x; mejor = [n, d]; }
  }
  return { n: mejor[0], de: mejor[1] };
}

// Para papás: el límite diario se mueve entre 0 y limiteMax
export function cambiarLimite(e, cfg, delta) {
  const l = Math.min(cfg.limiteMax, Math.max(0, limiteDe(e, cfg) + delta));
  return { ...e, limite: l };
}

// Fecha local AAAA-MM-DD (el límite es por día de la casa, no UTC)
export function fechaLocal(d = new Date()) {
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
