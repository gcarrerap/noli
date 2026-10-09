// Progreso. Lo guarda el catálogo con Noli.guardar.
// 8 de los últimos 10 elementos. Tres fallos seguidos no bajan de nivel:
// la siguiente visita es más fácil. Las estrellas salen de los aciertos a la primera.
import { NIVELES, animalNuevoDeNivel } from "./niveles.js";
import { ORDEN } from "./animales.js";

export const VENTANA = 10;
export const PARA_SUBIR = 8;
export const FALLOS_FACIL = 3;

export function nuevo() {
  return {
    v: 1, nivel: 1, elegido: 1, guiaHecha: false, voz: true,
    abiertos: 3, detective: 0, niveles: {}, dias: {}, retos: {},
  };
}

export function cargar(d) {
  if (!d || typeof d !== "object" || d.v !== 1) return nuevo();
  const base = nuevo();
  const p = { ...base, ...d, niveles: { ...base.niveles, ...(d.niveles || {}) }, dias: d.dias || {}, retos: d.retos || {} };
  p.nivel = Math.max(1, Math.min(NIVELES.length, p.nivel | 0));
  p.elegido = Math.max(1, Math.min(p.nivel, p.elegido | 0 || p.nivel));
  p.guiaHecha = !!d.guiaHecha;
  p.voz = d.voz !== false;
  p.abiertos = Math.max(3, Math.min(ORDEN.length, p.abiertos | 0 || 3));
  p.detective = Math.max(0, p.detective | 0);
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

export function anotarElemento(pr, nivelN, ok, hoy, vioPasoCompleto) {
  if (ok && (nivelN | 0) > 1 && vioPasoCompleto) return pr;
  return registrar(pr, nivelN, !!ok, hoy);
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

export function estrellasVisita(aciertos, de) {
  if (!de) return 0;
  if (aciertos >= de) return 3;
  if (aciertos >= de * 0.8) return 2;
  if (aciertos >= de * 0.5) return 1;
  return 0;
}

export function cerrarVisita(pr, n, aciertos, de) {
  const nv = nivelDe(pr, n);
  const est = estrellasVisita(aciertos, de);
  let niveles = { ...pr.niveles, [n]: { ...nv, estrellas: Math.max(nv.estrellas, est), turnos: nv.turnos + 1 } };
  let nivelActual = pr.nivel;
  let subio = null;
  const dm = dominio({ ...pr, niveles }, n);
  if (!nv.dominado && dm.listo) {
    niveles = { ...niveles, [n]: { ...niveles[n], dominado: true } };
    if (n === pr.nivel && n < NIVELES.length) { nivelActual = n + 1; subio = nivelActual; }
  }
  const elegido = subio || pr.elegido || nivelActual;
  let detective = pr.detective || 0;
  if (n === 6) detective += de;
  return { pr: { ...pr, niveles, nivel: nivelActual, elegido, detective }, subio, estrellas: est };
}

export function abrirAnimal(pr, estrellas) {
  if ((estrellas | 0) < 1 || pr.abiertos >= ORDEN.length) return { pr, nuevo: null };
  const id = ORDEN[pr.abiertos];
  return { pr: { ...pr, abiertos: pr.abiertos + 1 }, nuevo: id };
}

export function quiereFacil(pr, n) {
  return nivelDe(pr, n).seguidosMal >= FALLOS_FACIL;
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
  return {
    niveles: NIVELES.map((x) => {
      const nv = nivelDe(pr, x.n);
      const dm = dominio(pr, x.n);
      return {
        n: x.n, nombre: x.nombre, total: nv.total,
        pct: nv.total ? Math.round((100 * nv.aciertos) / nv.total) : null,
        dominado: !!nv.dominado, desbloqueado: x.n <= pr.nivel, estrellas: nv.estrellas,
        aciertosVentana: dm.aciertos, intentos: dm.intentos,
      };
    }),
  };
}

export { animalNuevoDeNivel };
