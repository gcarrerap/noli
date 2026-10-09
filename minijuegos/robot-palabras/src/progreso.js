// Dominio: 8 de los últimos 10, y en el nivel 1 son 9 de los últimos 10.
// Solo cuenta lo contestado a la primera. La racha no regaña.
import { NIVELES, textoRacha } from "./textos.js";
import { sumarPieza } from "./piezas.js";

export const VENTANA = 10;
export const POR_TURNO = 6;

export function paraSubir(nivel) {
  return (nivel | 0) === 1 ? 9 : 8;
}

export function nuevo() {
  return {
    v: 1, nivel: 1, elegido: 1, niveles: {}, dias: {}, retos: {},
    piezas: [], fallos: [], guiaHecha: false, voz: true,
  };
}

export function cargar(d) {
  if (!d || typeof d !== "object" || d.v !== 1) return nuevo();
  const base = nuevo();
  const p = { ...base, ...d };
  p.nivel = Math.max(1, Math.min(NIVELES.length, p.nivel | 0));
  p.elegido = Math.max(1, Math.min(p.nivel, p.elegido | 0 || p.nivel));
  p.voz = d.voz !== false;
  p.guiaHecha = !!d.guiaHecha;
  p.piezas = Array.isArray(d.piezas) ? d.piezas.filter((id) => typeof id === "string") : [];
  p.fallos = Array.isArray(d.fallos) ? d.fallos.filter((id) => typeof id === "string").slice(-24) : [];
  p.niveles = d.niveles && typeof d.niveles === "object" ? d.niveles : {};
  p.dias = d.dias && typeof d.dias === "object" ? d.dias : {};
  p.retos = d.retos && typeof d.retos === "object" ? d.retos : {};
  return p;
}

export function nivelDe(pr, n) {
  return pr.niveles[n] || { ultimos: [], total: 0, aciertos: 0, dominado: false, estrellas: 0, turnos: 0 };
}

export function dominio(pr, n) {
  const u = nivelDe(pr, n).ultimos;
  const aciertos = u.reduce((s, x) => s + x, 0);
  return {
    intentos: u.length,
    aciertos,
    necesita: paraSubir(n),
    listo: u.length >= VENTANA && aciertos >= paraSubir(n),
  };
}

export function registrar(pr, nivelN, primera, hoy) {
  const nv = nivelDe(pr, nivelN);
  const niveles = {
    ...pr.niveles,
    [nivelN]: {
      ...nv,
      ultimos: [...nv.ultimos, primera ? 1 : 0].slice(-VENTANA),
      total: nv.total + 1,
      aciertos: nv.aciertos + (primera ? 1 : 0),
    },
  };
  const dia = pr.dias[hoy] || { problemas: 0, aciertos: 0, reto: false };
  const dias = {
    ...pr.dias,
    [hoy]: { ...dia, problemas: dia.problemas + 1, aciertos: dia.aciertos + (primera ? 1 : 0) },
  };
  return { ...pr, niveles, dias };
}

export function anotarFallo(pr, palabra) {
  if (!palabra) return pr;
  return { ...pr, fallos: [...pr.fallos, palabra].slice(-24) };
}

export function estrellasTurno(primeras, de = POR_TURNO) {
  if (primeras >= de) return 3;
  if (primeras >= de - 1) return 2;
  if (primeras >= Math.ceil(de / 2)) return 1;
  return 0;
}

export function cerrarTurno(pr, n, primeras) {
  const nv = nivelDe(pr, n);
  const est = estrellasTurno(primeras);
  let niveles = { ...pr.niveles, [n]: { ...nv, estrellas: Math.max(nv.estrellas, est), turnos: nv.turnos + 1 } };
  let nivelActual = pr.nivel;
  let subio = null;
  const dm = dominio({ ...pr, niveles }, n);
  if (!nv.dominado && dm.listo) {
    niveles = { ...niveles, [n]: { ...niveles[n], dominado: true } };
    if (n === pr.nivel && n < NIVELES.length) { nivelActual = n + 1; subio = nivelActual; }
  }
  const sumada = sumarPieza(pr.piezas);
  const elegido = subio || pr.elegido || nivelActual;
  return {
    pr: { ...pr, niveles, nivel: nivelActual, elegido, piezas: sumada.piezas },
    subio,
    estrellas: est,
    pieza: sumada.nueva,
  };
}

// Solo Saltar marca la guía como vista.
export function guardarGuia(pr, motivo) {
  if (motivo !== "saltar") return pr;
  return pr.guiaHecha ? pr : { ...pr, guiaHecha: true };
}

export function ponerVoz(pr, voz) {
  return { ...pr, voz: !!voz };
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

export function lineaRacha(pr, hoy) {
  return textoRacha(racha(pr, hoy));
}

export function semana(pr, hoy) {
  return Array.from({ length: 7 }, (_, i) => {
    const f = sumarDias(hoy, i - 6);
    return { fecha: f, jugo: !!pr.dias[f]?.problemas, reto: !!pr.retos[f]?.cumplido };
  });
}
