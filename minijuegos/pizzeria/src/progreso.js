// Progreso de Noelia. Lo guarda el catálogo con Noli.guardar.
// Dominio: 8 de los últimos 10. Tres fallos seguidos no bajan de nivel.

import { NIVELES_MAX, POR_TURNO, crearPedido } from "./pedidos.js";
import { sumarPropinas } from "./deco.js";
import { revolver } from "./rng.js";

export const VENTANA = 10;
export const PARA_SUBIR = 8;
export const FALLOS_PISTA = 3;

export function nuevo() {
  return {
    v: 1, nivel: 1, elegido: 1, niveles: {}, dias: {}, retos: {},
    propinas: 0, guiaHecha: false, voz: true, ingles: false,
  };
}

export function cargar(d) {
  if (!d || typeof d !== "object" || d.v !== 1) return nuevo();
  const base = nuevo();
  const p = { ...base, ...d, niveles: { ...(d.niveles || {}) }, dias: { ...(d.dias || {}) }, retos: { ...(d.retos || {}) } };
  p.nivel = Math.max(1, Math.min(NIVELES_MAX, p.nivel | 0));
  p.elegido = Math.max(1, Math.min(p.nivel, p.elegido | 0 || p.nivel));
  p.propinas = Math.max(0, p.propinas | 0);
  p.guiaHecha = !!d.guiaHecha;
  p.voz = d.voz !== false;
  p.ingles = !!d.ingles;
  return p;
}

export function nivelDe(pr, n) {
  return pr.niveles[n] || { ultimos: [], total: 0, aciertos: 0, dominado: false, estrellas: 0, turnos: 0, seguidosMal: 0, bien: 0 };
}

export function dominio(pr, n) {
  const u = nivelDe(pr, n).ultimos;
  const aciertos = u.reduce((s, x) => s + x, 0);
  return { intentos: u.length, aciertos, listo: u.length >= VENTANA && aciertos >= PARA_SUBIR };
}

export function registrar(pr, nivelN, ok, hoy) {
  const nv = nivelDe(pr, nivelN);
  const niveles = {
    ...pr.niveles,
    [nivelN]: {
      ...nv,
      ultimos: [...nv.ultimos, ok ? 1 : 0].slice(-VENTANA),
      total: nv.total + 1,
      aciertos: nv.aciertos + (ok ? 1 : 0),
      seguidosMal: ok ? 0 : nv.seguidosMal + 1,
      bien: nv.bien + (ok ? 1 : 0),
    },
  };
  const dia = pr.dias[hoy] || { problemas: 0, aciertos: 0, reto: false };
  const dias = { ...pr.dias, [hoy]: { ...dia, problemas: dia.problemas + 1, aciertos: dia.aciertos + (ok ? 1 : 0) } };
  return { ...pr, niveles, dias };
}

export function quiereFacil(pr, n) {
  return nivelDe(pr, n).seguidosMal >= FALLOS_PISTA;
}

export const estrellasTurno = (aciertos, de = POR_TURNO) => (
  aciertos >= de ? 3 : aciertos >= Math.ceil(de * 0.8) ? 2 : aciertos >= Math.ceil(de * 0.5) ? 1 : 0
);

export function cerrarTurno(pr, n, aciertos) {
  const nv = nivelDe(pr, n);
  const est = estrellasTurno(aciertos);
  const propinas = sumarPropinas(pr.propinas, aciertos);
  let niveles = { ...pr.niveles, [n]: { ...nv, estrellas: Math.max(nv.estrellas, est), turnos: nv.turnos + 1 } };
  let nivelActual = pr.nivel;
  let subio = null;
  const dm = dominio({ ...pr, niveles }, n);
  if (!nv.dominado && dm.listo) {
    niveles = { ...niveles, [n]: { ...niveles[n], dominado: true } };
    if (n === pr.nivel && n < NIVELES_MAX) { nivelActual = n + 1; subio = nivelActual; }
  }
  const elegido = subio || pr.elegido || nivelActual;
  return { pr: { ...pr, niveles, nivel: nivelActual, elegido, propinas }, subio, estrellas: est };
}

export function planTurno(pr, n, rnd) {
  const plan = Array.from({ length: POR_TURNO }, () => ({ nivel: n, repaso: false }));
  const dominados = [];
  for (let i = 1; i < n; i++) if (pr.niveles[i]?.dominado) dominados.push(i);
  if (dominados.length) {
    const x = dominados[Math.floor(rnd() * dominados.length)];
    const i = Math.floor(rnd() * plan.length);
    plan[i] = { nivel: x, repaso: true };
  }
  return revolver(rnd, plan);
}

export function pedidoPara(pr, n, rnd, banco, textos, { repaso = false } = {}) {
  const nv = nivelDe(pr, n);
  const facil = !repaso && nv.seguidosMal >= FALLOS_PISTA;
  const pedido = crearPedido(n, rnd, banco, textos, { bien: nv.bien, facil });
  pedido.repaso = !!repaso;
  return pedido;
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
  const dia = pr.dias[hoy] || { problemas: 0, aciertos: 0, reto: false };
  return { ...pr, retos: { ...pr.retos, [hoy]: reto }, dias: { ...pr.dias, [hoy]: { ...dia, reto: reto.cumplido } } };
}

export function racha(pr, hoy) {
  let f = pr.retos[hoy]?.cumplido ? hoy : sumarDias(hoy, -1), n = 0;
  while (pr.retos[f]?.cumplido) { n++; f = sumarDias(f, -1); }
  return n;
}

export function textoRacha(n, textos) {
  if (!n) return textos.rachaCero;
  return textos.racha.replace("{n}", String(n)).replace("{dias}", n === 1 ? textos.dia : textos.dias);
}

export function semana(pr, hoy) {
  return Array.from({ length: 7 }, (_, i) => {
    const f = sumarDias(hoy, i - 6);
    return { fecha: f, jugo: !!pr.dias[f]?.problemas, reto: !!pr.retos[f]?.cumplido };
  });
}

export function resumen(pr, niveles) {
  return (niveles || []).map((x) => {
    const nv = nivelDe(pr, x.n);
    const dm = dominio(pr, x.n);
    return {
      n: x.n, nombre: x.nombre, total: nv.total,
      pct: nv.total ? Math.round((100 * nv.aciertos) / nv.total) : null,
      dominado: !!nv.dominado, desbloqueado: x.n <= pr.nivel, estrellas: nv.estrellas,
      aciertosVentana: dm.aciertos,
    };
  });
}

export function marcarGuia(pr) {
  if (pr.guiaHecha) return pr;
  return { ...pr, guiaHecha: true };
}
