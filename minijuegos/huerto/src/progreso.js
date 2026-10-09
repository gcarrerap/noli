// Progreso. Lo guarda el catálogo con Noli.guardar; aquí solo hay funciones puras.
// Dominio: 8 de los últimos 10. Tres fallos seguidos no bajan de nivel: el siguiente encargo es más fácil.
import { NIVELES, nivel as datosNivel, POR_TEMPORADA, planBase, crearEncargo } from "./niveles.js";
import { revolver } from "./rng.js";

export const VENTANA = 10;
export const PARA_SUBIR = 8;
export const FALLOS_FACIL = 3;

export function nuevo() {
  return { v: 1, nivel: 1, elegido: 1, guiaHecha: false, voz: true, niveles: {}, dias: {}, retos: {} };
}

export function cargar(d) {
  if (!d || typeof d !== "object" || d.v !== 1) return nuevo();
  const base = nuevo();
  const p = { ...base, ...d, niveles: { ...base.niveles, ...(d.niveles || {}) }, dias: d.dias || {}, retos: d.retos || {} };
  p.nivel = Math.max(1, Math.min(NIVELES.length, p.nivel | 0));
  p.elegido = Math.max(1, Math.min(p.nivel, p.elegido | 0 || p.nivel));
  p.guiaHecha = !!d.guiaHecha;
  p.voz = d.voz !== false;
  return p;
}

export function nivelDe(pr, n) {
  return pr.niveles[n] || { ultimos: [], total: 0, aciertos: 0, dominado: false, estrellas: 0, turnos: 0, seguidosMal: 0 };
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
    },
  };
  const dia = pr.dias[hoy] || { problemas: 0, aciertos: 0, reto: false };
  const dias = { ...pr.dias, [hoy]: { ...dia, problemas: dia.problemas + 1, aciertos: dia.aciertos + (ok ? 1 : 0) } };
  return { ...pr, niveles, dias };
}

export const estrellasTemporada = (aciertos, de = POR_TEMPORADA) => (
  aciertos >= de ? 3 : aciertos >= de * 0.8 ? 2 : aciertos >= de * 0.5 ? 1 : 0
);

export function cerrarTemporada(pr, n, aciertos) {
  const nv = nivelDe(pr, n);
  const est = estrellasTemporada(aciertos);
  let niveles = { ...pr.niveles, [n]: { ...nv, estrellas: Math.max(nv.estrellas, est), turnos: nv.turnos + 1 } };
  let nivelActual = pr.nivel;
  let subio = null;
  const dm = dominio({ ...pr, niveles }, n);
  if (!nv.dominado && dm.listo) {
    niveles = { ...niveles, [n]: { ...niveles[n], dominado: true } };
    if (n === pr.nivel && n < NIVELES.length) { nivelActual = n + 1; subio = nivelActual; }
  }
  const elegido = subio || pr.elegido || nivelActual;
  return { pr: { ...pr, niveles, nivel: nivelActual, elegido }, subio, estrellas: est };
}

export function quiereFacil(pr, n) {
  return nivelDe(pr, n).seguidosMal >= FALLOS_FACIL;
}

// 6 encargos. En el nivel 6 el giro va antes que las otras formas.
// Si hay niveles dominados, uno es repaso (en el 6, sin adelantar una forma al giro).
export function planSlots(pr, n, rnd) {
  let plan = planBase(n).map((s) => ({ ...s, repaso: false }));
  if (n !== 6) plan = revolver(rnd, plan);
  const dominados = NIVELES.filter((x) => x.n < n && pr.niveles[x.n]?.dominado).map((x) => x.n);
  if (dominados.length) {
    const i = n === 6 ? 4 : Math.floor(rnd() * plan.length);
    const nv = dominados[Math.floor(rnd() * dominados.length)];
    const base = planBase(nv);
    const slot = base[Math.floor(rnd() * base.length)];
    plan[i] = { ...slot, nivel: nv, repaso: true };
  }
  return plan;
}

export function encargoDeSlot(slot, rnd, facil) {
  return crearEncargo(slot.nivel, rnd, {
    tipo: slot.tipo, paso: slot.paso, paridad: slot.paridad, facil: !!facil, repaso: !!slot.repaso,
  });
}

export function marcarGuia(pr) {
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

export function semana(pr, hoy) {
  return Array.from({ length: 7 }, (_, i) => {
    const f = sumarDias(hoy, i - 6);
    return { fecha: f, jugo: !!pr.dias[f]?.problemas, reto: !!pr.retos[f]?.cumplido };
  });
}

export function resumen(pr) {
  const niveles = NIVELES.map((x) => {
    const nv = nivelDe(pr, x.n);
    const dm = dominio(pr, x.n);
    return {
      n: x.n, nombre: x.nombre, total: nv.total,
      pct: nv.total ? Math.round((100 * nv.aciertos) / nv.total) : null,
      dominado: !!nv.dominado, desbloqueado: x.n <= pr.nivel, estrellas: nv.estrellas,
      aciertosVentana: dm.aciertos, intentos: dm.intentos,
    };
  });
  return { niveles };
}

export { datosNivel };
