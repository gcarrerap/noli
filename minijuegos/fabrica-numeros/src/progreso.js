// Progreso de Noelia. Lo guarda el catálogo con Noli.guardar; aquí solo hay funciones puras.
//
// Dominio de un nivel: 8 de los últimos 10, con al menos 10 pedidos jugados.
// Solo cuenta lo bien contestado a la primera. En los niveles 3, 7 y 8, al menos
// 4 de esos 10 tienen que ser del tipo propio del nivel (un cero o un reagrupamiento).
// Tres fallos seguidos no bajan de nivel: el siguiente pedido es más fácil.
import { NIVELES, nivel as datosNivel, subetapa, crearPedido, POR_TURNO } from "./niveles.js";
import { decoNueva, piezasDisponibles } from "./deco.js";
import { revolver } from "./rng.js";

export const VENTANA = 10;
export const PARA_SUBIR = 8;
export const DIFICILES_MIN = 4;
export const FALLOS_PISTA = 3;
const NIVELES_DIFICILES = new Set([3, 7, 8]);

export function nuevo() {
  return { v: 1, nivel: 1, elegido: 1, niveles: {}, dias: {}, retos: {}, deco: decoNueva(), ingles: false };
}

export function cargar(d) {
  if (!d || typeof d !== "object" || d.v !== 1) return nuevo();
  const base = nuevo();
  const p = { ...base, ...d, deco: { ...base.deco, ...(d.deco || {}) } };
  p.deco.slots = { ...base.deco.slots, ...(d.deco && d.deco.slots) };
  p.nivel = Math.max(1, Math.min(NIVELES.length, p.nivel | 0));
  p.elegido = Math.max(1, Math.min(p.nivel, p.elegido | 0 || p.nivel));
  p.ingles = !!d.ingles;
  return p;
}

export function nivelDe(pr, n) {
  return pr.niveles[n] || {
    ultimos: [], total: 0, aciertos: 0, dominado: false, estrellas: 0, turnos: 0,
    seguidosMal: 0, bandaMal: null, bien: 0,
  };
}

export function dominio(pr, n) {
  const u = nivelDe(pr, n).ultimos;
  const aciertos = u.reduce((s, x) => s + x[0], 0);
  const dificiles = u.reduce((s, x) => s + (x[1] ? 1 : 0), 0);
  const pideDificil = NIVELES_DIFICILES.has(n);
  return {
    intentos: u.length, aciertos, dificiles, pideDificil,
    listo: u.length >= VENTANA && aciertos >= PARA_SUBIR && (!pideDificil || dificiles >= DIFICILES_MIN),
  };
}

// Intento 1 entra al dominio. Un segundo intento no cambia la ventana ni la racha de fallos.
export function registrar(pr, nivelN, { ok, dificil, banda }, hoy, intento = 1) {
  if (intento > 1) return pr;
  const nv = nivelDe(pr, nivelN);
  const niveles = {
    ...pr.niveles,
    [nivelN]: {
      ...nv,
      ultimos: [...nv.ultimos, [ok ? 1 : 0, dificil ? 1 : 0]].slice(-VENTANA),
      total: nv.total + 1,
      aciertos: nv.aciertos + (ok ? 1 : 0),
      seguidosMal: ok ? 0 : nv.seguidosMal + 1,
      bandaMal: ok ? null : (banda || nv.bandaMal),
      bien: nv.bien + (ok ? 1 : 0),
    },
  };
  const dia = pr.dias[hoy] || { problemas: 0, aciertos: 0, reto: false };
  const dias = { ...pr.dias, [hoy]: { ...dia, problemas: dia.problemas + 1, aciertos: dia.aciertos + (ok ? 1 : 0) } };
  return { ...pr, niveles, dias };
}

export const estrellasTurno = (aciertos, de = POR_TURNO) => (
  aciertos >= de ? 3 : aciertos >= de * 0.8 ? 2 : aciertos >= de * 0.5 ? 1 : 0
);

export function cerrarTurno(pr, n, aciertos) {
  const nv = nivelDe(pr, n);
  const est = estrellasTurno(aciertos);
  let niveles = { ...pr.niveles, [n]: { ...nv, estrellas: Math.max(nv.estrellas, est), turnos: nv.turnos + 1 } };
  let nivelActual = pr.nivel;
  let subio = null;
  const dm = dominio({ ...pr, niveles }, n);
  if (!nv.dominado && dm.listo) {
    niveles = { ...niveles, [n]: { ...niveles[n], dominado: true } };
    if (n === pr.nivel && n < NIVELES.length) { nivelActual = n + 1; subio = nivelActual; }
  }
  const deco = {
    ...pr.deco,
    ganadas: pr.deco.ganadas + 1,
    especiales: pr.deco.especiales + (subio ? 1 : 0),
  };
  const elegido = subio || pr.elegido || nivelActual;
  return { pr: { ...pr, niveles, nivel: nivelActual, elegido, deco }, subio, estrellas: est };
}

export function quiereFacil(pr, n) {
  return nivelDe(pr, n).seguidosMal >= FALLOS_PISTA;
}

export function pedidoPara(pr, n, rnd, { repaso = false } = {}) {
  const nv = nivelDe(pr, n);
  const facil = !repaso && nv.seguidosMal >= FALLOS_PISTA;
  const sub = subetapa(n, nv.bien, facil);
  const pedido = crearPedido(n, rnd, { sub, facil });
  pedido.repaso = !!repaso;
  pedido.pistaBanda = facil ? nv.bandaMal : null;
  pedido.subetapa = sub;
  return pedido;
}

// Un turno: 6 pedidos. Si hay niveles ya dominados, uno es repaso.
export function planTurno(pr, n, rnd) {
  const plan = Array.from({ length: POR_TURNO }, () => ({ nivel: n, repaso: false }));
  const dominados = NIVELES.filter((x) => x.n < n && pr.niveles[x.n]?.dominado);
  if (dominados.length) {
    const x = dominados[Math.floor(rnd() * dominados.length)];
    const i = Math.floor(rnd() * plan.length);
    plan[i] = { nivel: x.n, repaso: true };
  }
  return revolver(rnd, plan);
}

export function marcarIngles(pr) {
  if (pr.ingles) return pr;
  return { ...pr, ingles: true };
}

export function piezasDe(pr) {
  return piezasDisponibles(pr.deco, pr.ingles);
}

// ---------- Días y racha (igual de suave que Sumas y restas: no se "pierde" en voz alta) ----------

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
  const dia = pr.dias[hoy] || { problemas: 0, aciertos: 0, reto: false };
  return { ...pr, retos: { ...pr.retos, [hoy]: reto }, dias: { ...pr.dias, [hoy]: { ...dia, reto: reto.cumplido } } };
}

export function racha(pr, hoy) {
  let f = pr.retos[hoy]?.cumplido ? hoy : sumarDias(hoy, -1), n = 0;
  while (pr.retos[f]?.cumplido) { n++; f = sumarDias(f, -1); }
  return n;
}

export function semana(pr, hoy) {
  return Array.from({ length: 7 }, (_, i) => {
    const f = sumarDias(hoy, i - 6);
    return { fecha: f, jugo: !!pr.dias[f]?.problemas, reto: !!pr.retos[f]?.cumplido };
  });
}

export function resumen(pr) {
  const niveles = NIVELES.map((x) => {
    const nv = nivelDe(pr, x.n), dm = dominio(pr, x.n);
    return {
      n: x.n, nombre: x.nombre, total: nv.total,
      pct: nv.total ? Math.round((100 * nv.aciertos) / nv.total) : null,
      dominado: !!nv.dominado, desbloqueado: x.n <= pr.nivel, estrellas: nv.estrellas,
      sub: subetapa(x.n, nv.bien, false),
      aciertosVentana: dm.aciertos, dificiles: dm.dificiles,
    };
  });
  const dias = Object.keys(pr.dias).sort().slice(-14).map((f) => ({ fecha: f, ...pr.dias[f] }));
  return { niveles, dias };
}

export { datosNivel };
