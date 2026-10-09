// Progreso de la tienda: funciones puras. La moneda de cada partida vive en porMoneda.
//
// {
//   v: 1, moneda: "usd", voz: false,
//   porMoneda: { usd: { nivel, elegido, niveles: { "1": { ultimos, total, aciertos, dominado, estrellas, rondas } }, fallos } },
//   dias: { "2026-10-09": { clientes, aciertos, reto } },
//   retos: { "2026-10-09": { tipo, cumplido, puntos } },
//   tienda: { monedas, mejoras: ["letrero"] },
// }
import { claveVisita } from "./visita.js";

export const VENTANA = 10;          // clientes que cuentan para subir de nivel
export const PARA_SUBIR = 8;        // de esos 10, cuántos hay que atender bien
export const POR_DIA = 8;

export function nuevo() {
  return { v: 1, moneda: "usd", voz: false, porMoneda: {}, dias: {}, retos: {}, tienda: { monedas: 0, mejoras: [] } };
}

export function cargar(d) {
  if (!d || typeof d !== "object" || d.v !== 1) return nuevo();
  const base = nuevo();
  const tienda = d.tienda && typeof d.tienda === "object" ? d.tienda : {};
  return {
    ...base,
    moneda: typeof d.moneda === "string" && d.moneda ? d.moneda : base.moneda,
    voz: d.voz === true,
    porMoneda: d.porMoneda && typeof d.porMoneda === "object" ? d.porMoneda : {},
    dias: d.dias && typeof d.dias === "object" ? d.dias : {},
    retos: d.retos && typeof d.retos === "object" ? d.retos : {},
    tienda: {
      monedas: Math.max(0, tienda.monedas | 0),
      mejoras: Array.isArray(tienda.mejoras) ? tienda.mejoras.filter((x) => typeof x === "string") : [],
    },
  };
}

export function estado(pr, monedaId, tope = 7) {
  const e = pr.porMoneda?.[monedaId] || {};
  const nivel = Math.max(1, Math.min(tope, e.nivel | 0 || 1));
  const elegido = Math.max(1, Math.min(nivel, e.elegido | 0 || nivel));
  return {
    nivel, elegido,
    niveles: e.niveles && typeof e.niveles === "object" ? e.niveles : {},
    fallos: e.fallos && typeof e.fallos === "object" ? e.fallos : {},
  };
}

const nivelDe = (est, n) => est.niveles[n] || { ultimos: [], total: 0, aciertos: 0, dominado: false, estrellas: 0, rondas: 0 };

export function dominio(est, n) {
  const u = nivelDe(est, n).ultimos || [];
  const aciertos = u.reduce((s, ok) => s + (ok ? 1 : 0), 0);
  return { intentos: u.length, aciertos, listo: u.length >= VENTANA && aciertos >= PARA_SUBIR };
}

export const estrellasDia = (aciertos, de = POR_DIA) => (aciertos >= de ? 3 : aciertos >= Math.ceil(de * 0.75) ? 2 : aciertos >= Math.ceil(de * 0.5) ? 1 : 0);

// Anota a un cliente. ok: si se le atendió bien. Devuelve un progreso nuevo.
export function registrar(pr, monedaId, nivelN, ok, visita, hoy, tope = 7) {
  const est = estado(pr, monedaId, tope);
  const nv = nivelDe(est, nivelN);
  const niveles = { ...est.niveles, [nivelN]: {
    ...nv,
    ultimos: [...(nv.ultimos || []), ok ? 1 : 0].slice(-VENTANA),
    total: (nv.total || 0) + 1,
    aciertos: (nv.aciertos || 0) + (ok ? 1 : 0),
  } };
  const fallos = { ...est.fallos };
  const clave = claveVisita(visita);
  if (!ok) fallos[clave] = { visita, nivel: nivelN, veces: (fallos[clave]?.veces || 0) + 1, seguidos: 0 };
  else if (fallos[clave]) {
    const seguidos = fallos[clave].seguidos + 1;
    if (seguidos >= 2) delete fallos[clave];
    else fallos[clave] = { ...fallos[clave], seguidos };
  }
  const claves = Object.keys(fallos);
  if (claves.length > 12) delete fallos[claves[0]];
  const dia = pr.dias[hoy] || { clientes: 0, aciertos: 0, reto: false };
  return {
    ...pr,
    porMoneda: { ...pr.porMoneda, [monedaId]: { ...est, niveles, fallos } },
    dias: { ...pr.dias, [hoy]: { ...dia, clientes: dia.clientes + 1, aciertos: dia.aciertos + (ok ? 1 : 0) } },
  };
}

// Cierra el día: estrellas, monedas de tienda y, si ya van 8 de 10, el nivel siguiente.
export function cerrarDia(pr, monedaId, nivelN, aciertos, hoy, de = POR_DIA, tope = 7) {
  const est = estado(pr, monedaId, tope);
  const nv = nivelDe(est, nivelN);
  const estrellas = estrellasDia(aciertos, de);
  const listo = !nv.dominado && dominio(est, nivelN).listo;
  const niveles = { ...est.niveles, [nivelN]: { ...nv, estrellas: Math.max(nv.estrellas || 0, estrellas), rondas: (nv.rondas || 0) + 1, dominado: nv.dominado || listo } };
  let nivel = est.nivel;
  let subio = null;
  if (listo && nivelN === est.nivel && nivelN < tope) { nivel = nivelN + 1; subio = nivel; }
  const elegido = subio || est.elegido;
  return {
    pr: {
      ...pr,
      porMoneda: { ...pr.porMoneda, [monedaId]: { ...est, nivel, elegido, niveles } },
      tienda: { ...pr.tienda, monedas: pr.tienda.monedas + aciertos },
    },
    subio, estrellas,
  };
}

export function elegirNivel(pr, monedaId, n, tope = 7) {
  const est = estado(pr, monedaId, tope);
  if (n < 1 || n > est.nivel) return pr;
  return { ...pr, porMoneda: { ...pr.porMoneda, [monedaId]: { ...est, elegido: n } } };
}

export function comprar(pr, id, mejoras) {
  const m = (mejoras || []).find((x) => x.id === id);
  if (!m || pr.tienda.mejoras.includes(id) || pr.tienda.monedas < m.costo) return pr;
  return { ...pr, tienda: { monedas: pr.tienda.monedas - m.costo, mejoras: [...pr.tienda.mejoras, id] } };
}

export function fechaLocal(d = new Date()) {
  const z = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function sumarDias(fecha, n) {
  const [y, m, d] = fecha.split("-").map(Number);
  return fechaLocal(new Date(y, m - 1, d + n));
}

export function cumplirReto(pr, hoy, tipo, puntos, cumplido) {
  const previo = pr.retos[hoy];
  const reto = { tipo, puntos: Math.max(puntos, previo?.puntos || 0), cumplido: cumplido || !!previo?.cumplido };
  const dia = pr.dias[hoy] || { clientes: 0, aciertos: 0, reto: false };
  return { ...pr, retos: { ...pr.retos, [hoy]: reto }, dias: { ...pr.dias, [hoy]: { ...dia, reto: reto.cumplido } } };
}

// Días seguidos con el reto cumplido. Si hoy todavía no, la racha de ayer sigue viva.
export function racha(pr, hoy) {
  let f = pr.retos[hoy]?.cumplido ? hoy : sumarDias(hoy, -1), n = 0;
  while (pr.retos[f]?.cumplido) { n++; f = sumarDias(f, -1); }
  return n;
}

export function semana(pr, hoy) {
  return Array.from({ length: 7 }, (_, i) => {
    const f = sumarDias(hoy, i - 6);
    return { fecha: f, jugo: !!pr.dias[f]?.clientes, reto: !!pr.retos[f]?.cumplido };
  });
}

export function resumen(pr, moneda, monedaId) {
  const est = estado(pr, monedaId, moneda.niveles.length);
  const niveles = moneda.niveles.map((x) => {
    const nv = nivelDe(est, x.n);
    const dm = dominio(est, x.n);
    return {
      n: x.n, nombre: x.nombre, total: nv.total || 0,
      pct: nv.total ? Math.round((100 * nv.aciertos) / nv.total) : null,
      dominado: !!nv.dominado, desbloqueado: x.n <= est.nivel, estrellas: nv.estrellas || 0,
      intentos: dm.intentos, aciertosRecientes: dm.aciertos,
    };
  });
  const fallos = Object.values(est.fallos).sort((a, b) => b.veces - a.veces).slice(0, 8);
  const dias = Object.keys(pr.dias).sort().slice(-14).map((f) => ({ fecha: f, ...pr.dias[f] }));
  return { niveles, fallos, dias };
}
