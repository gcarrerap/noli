// Progreso. Sube con 8 de los últimos 10, solo si el primer intento contó.
// La racha no regaña: si no jugó, no se dice que se rompió.
import { NIVELES, POR_TURNO } from "./niveles.js";

export const VENTANA = 10;
export const PARA_SUBIR = 8;
export { POR_TURNO };

export function nuevo() {
  return {
    v: 1, nivel: 1, elegido: 1, guia: false, voz: true, ingles: false,
    niveles: {}, dias: {}, retos: {}, album: 0,
  };
}

export function cargar(d) {
  const base = nuevo();
  if (!d || typeof d !== "object" || d.v !== 1) return base;
  const p = { ...base, ...d, niveles: { ...base.niveles, ...(d.niveles || {}) } };
  p.nivel = Math.max(1, Math.min(NIVELES.length, p.nivel | 0));
  p.elegido = Math.max(1, Math.min(p.nivel, p.elegido | 0 || p.nivel));
  p.guia = !!d.guia;
  p.voz = d.voz !== false;
  p.ingles = d.ingles === true;
  p.album = Math.max(0, Math.min(3, p.album | 0));
  p.dias = d.dias && typeof d.dias === "object" ? d.dias : {};
  p.retos = d.retos && typeof d.retos === "object" ? d.retos : {};
  return p;
}

export function nivelDe(pr, n) {
  return pr.niveles[n] || { ultimos: [], total: 0, aciertos: 0, dominado: false, estrellas: 0, turnos: 0, seguidosMal: 0 };
}

export function dominio(pr, n) {
  const u = nivelDe(pr, n).ultimos;
  const aciertos = u.reduce((s, x) => s + (x ? 1 : 0), 0);
  return { intentos: u.length, aciertos, listo: u.length >= VENTANA && aciertos >= PARA_SUBIR };
}

// Solo el primer intento entra en la ventana.
export function registrar(pr, nivelN, { ok }, hoy, intento = 1) {
  if (intento > 1) return pr;
  const nv = nivelDe(pr, nivelN);
  const niveles = {
    ...pr.niveles,
    [nivelN]: {
      ...nv,
      ultimos: [...nv.ultimos, ok ? 1 : 0].slice(-VENTANA),
      total: nv.total + 1,
      aciertos: nv.aciertos + (ok ? 1 : 0),
      seguidosMal: ok ? 0 : nv.seguidosMal + 1,
    },
  };
  const dia = pr.dias[hoy] || { problemas: 0, aciertos: 0, reto: false };
  const dias = { ...pr.dias, [hoy]: { ...dia, problemas: dia.problemas + 1, aciertos: dia.aciertos + (ok ? 1 : 0) } };
  return { ...pr, niveles, dias };
}

export function estrellasTurno(aciertos, de = POR_TURNO) {
  if (aciertos >= de) return 3;
  if (aciertos >= de - 1) return 2;
  if (aciertos >= Math.ceil(de / 2)) return 1;
  return 0;
}

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
  const album = Math.min(3, (pr.album | 0) + 1);
  const elegido = subio || pr.elegido || nivelActual;
  return { pr: { ...pr, niveles, nivel: nivelActual, elegido, album }, subio, estrellas: est };
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
  let f = pr.retos[hoy]?.cumplido ? hoy : sumarDias(hoy, -1);
  let n = 0;
  while (pr.retos[f]?.cumplido) { n++; f = sumarDias(f, -1); }
  return n;
}

export function textoRacha(pr, hoy) {
  const r = racha(pr, hoy);
  if (!r) return "Cumple el reto de hoy para empezar una racha";
  return `Racha: ${r} ${r === 1 ? "día" : "días"}`;
}

export function semana(pr, hoy) {
  return Array.from({ length: 7 }, (_, i) => {
    const f = sumarDias(hoy, i - 6);
    return { fecha: f, jugo: !!pr.dias[f]?.problemas, reto: !!pr.retos[f]?.cumplido };
  });
}

export function resumen(pr) {
  return NIVELES.map((x) => {
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
