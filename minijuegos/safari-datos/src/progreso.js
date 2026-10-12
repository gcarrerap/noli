// Progreso. Lo guarda el catálogo con Noli.guardar; aquí solo hay funciones puras.
// Sube con 8 de las últimas 10 preguntas bien a la primera. Cada visita bien hecha (2 o 3 estrellas) abre un animal.
import { NIVELES, PREGUNTAS_POR_VISITA } from "./niveles.js";
import { siguiente, NUEVOS } from "./animales.js";

export const VENTANA = 10;
export const PARA_SUBIR = 8;
export const ESTRELLAS_ANIMAL = 2;

export function nuevo() {
  return { v: 1, nivel: 1, elegido: 1, guiaHecha: false, voz: true, zoo: 0, niveles: {}, dias: {}, retos: {} };
}

export function cargar(d) {
  if (!d || typeof d !== "object" || d.v !== 1) return nuevo();
  const base = nuevo();
  const p = { ...base, ...d, niveles: { ...(d.niveles || {}) }, dias: { ...(d.dias || {}) }, retos: { ...(d.retos || {}) } };
  p.nivel = Math.max(1, Math.min(NIVELES.length, p.nivel | 0));
  p.elegido = Math.max(1, Math.min(p.nivel, p.elegido | 0 || p.nivel));
  p.zoo = Math.max(0, Math.min(NUEVOS, p.zoo | 0));
  p.guiaHecha = !!d.guiaHecha;
  p.voz = d.voz !== false;
  return p;
}

export function nivelDe(pr, n) {
  return pr.niveles[n] || { ultimos: [], total: 0, aciertos: 0, dominado: false, estrellas: 0, visitas: 0 };
}

export function dominio(pr, n) {
  const u = nivelDe(pr, n).ultimos;
  const aciertos = u.reduce((s, x) => s + x, 0);
  return { intentos: u.length, aciertos, listo: u.length >= VENTANA && aciertos >= PARA_SUBIR };
}

// Una pregunta contestada: ok = bien a la primera.
export function registrar(pr, nivelN, ok, hoy) {
  const nv = nivelDe(pr, nivelN);
  const niveles = {
    ...pr.niveles,
    [nivelN]: {
      ...nv,
      ultimos: [...nv.ultimos, ok ? 1 : 0].slice(-VENTANA),
      total: nv.total + 1,
      aciertos: nv.aciertos + (ok ? 1 : 0),
    },
  };
  const dia = pr.dias[hoy] || { preguntas: 0, aciertos: 0, reto: false };
  const dias = { ...pr.dias, [hoy]: { ...dia, preguntas: dia.preguntas + 1, aciertos: dia.aciertos + (ok ? 1 : 0) } };
  return { ...pr, niveles, dias };
}

// En el reto solo se anota que jugó ese día; no mueve los niveles.
export function anotarDia(pr, hoy, ok) {
  const dia = pr.dias[hoy] || { preguntas: 0, aciertos: 0, reto: false };
  return { ...pr, dias: { ...pr.dias, [hoy]: { ...dia, preguntas: dia.preguntas + 1, aciertos: dia.aciertos + (ok ? 1 : 0) } } };
}

export const estrellasVisita = (aciertos) => Math.max(0, Math.min(3, Math.round((3 * aciertos) / PREGUNTAS_POR_VISITA)));

// Cierra una visita: estrellas del nivel, si sube y si se abre un animal.
export function cerrarVisita(pr, n, aciertos) {
  const nv = nivelDe(pr, n);
  const est = estrellasVisita(aciertos);
  let niveles = { ...pr.niveles, [n]: { ...nv, estrellas: Math.max(nv.estrellas, est), visitas: nv.visitas + 1 } };
  let nivelActual = pr.nivel;
  let subio = null;
  if (!nv.dominado && dominio({ ...pr, niveles }, n).listo) {
    niveles = { ...niveles, [n]: { ...niveles[n], dominado: true } };
    if (n === pr.nivel && n < NIVELES.length) { nivelActual = n + 1; subio = nivelActual; }
  }
  const nuevoAnimal = est >= ESTRELLAS_ANIMAL ? siguiente(pr.zoo) : null;
  const zoo = nuevoAnimal ? pr.zoo + 1 : pr.zoo;
  const elegido = subio || pr.elegido || nivelActual;
  return { pr: { ...pr, niveles, nivel: nivelActual, elegido, zoo }, subio, estrellas: est, nuevoAnimal };
}

export const marcarGuia = (pr) => (pr.guiaHecha ? pr : { ...pr, guiaHecha: true });
export const ponerVoz = (pr, voz) => ({ ...pr, voz: !!voz });

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
  const dia = pr.dias[hoy] || { preguntas: 0, aciertos: 0, reto: false };
  return { ...pr, retos: { ...pr.retos, [hoy]: reto }, dias: { ...pr.dias, [hoy]: { ...dia, reto: reto.cumplido } } };
}

export function racha(pr, hoy) {
  let f = pr.retos[hoy]?.cumplido ? hoy : sumarDias(hoy, -1);
  let n = 0;
  while (pr.retos[f]?.cumplido) { n++; f = sumarDias(f, -1); }
  return n;
}

export function semana(pr, hoy) {
  return Array.from({ length: 7 }, (_, i) => {
    const f = sumarDias(hoy, i - 6);
    return { fecha: f, jugo: !!pr.dias[f]?.preguntas, reto: !!pr.retos[f]?.cumplido };
  });
}

export function resumen(pr) {
  return NIVELES.map((x) => {
    const nv = nivelDe(pr, x.n);
    const dm = dominio(pr, x.n);
    return {
      n: x.n, nombre: x.nombre, total: nv.total, visitas: nv.visitas,
      pct: nv.total ? Math.round((100 * nv.aciertos) / nv.total) : null,
      dominado: !!nv.dominado, abierto: x.n <= pr.nivel, estrellas: nv.estrellas,
      aciertosVentana: dm.aciertos, intentos: dm.intentos,
    };
  });
}
