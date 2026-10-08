// Progreso de Noelia en spelling: funciones puras sobre un objeto JSON que el juego guarda con Noli.guardar.
//
// {
//   v: 1,
//   paso: 4,                         // el paso más alto abierto (paso = lista × etapa; ver palabras.js)
//   elegido: 3,                      // el paso que escogió jugar (si volvió a uno anterior)
//   pasos: { "0": { ultimos: [1, 0, …], total, aciertos, dominado, estrellas, rondas } },
//   palabras: { "cake": { total, aciertos } },
//   fallos: { "cake": { lista, veces, seguidos } },   // palabras que falló; salen con 2 bien seguidas
//   dias: { "2026-10-08": { palabras, aciertos, reto } },
//   retos: { "2026-10-08": { tipo, cumplido, puntos } },
//   sinVoz: false,                   // papás: enseñar la palabra en lugar de decirla
// }
import { LISTAS, ETAPAS, PASOS, paso as datosPaso, lista as datosLista, buscar } from "./palabras.js";
import { revolver } from "./rng.js";

export const POR_RONDA = 10;

export function nuevo() {
  return { v: 1, paso: 0, elegido: null, pasos: {}, palabras: {}, fallos: {}, dias: {}, retos: {}, sinVoz: false };
}

// Datos guardados que pueden venir rotos o de otra versión: siempre devuelve un progreso válido
export function cargar(d) {
  if (!d || typeof d !== "object" || d.v !== 1) return nuevo();
  const p = { ...nuevo(), ...d };
  p.paso = Math.max(0, Math.min(PASOS - 1, p.paso | 0));
  if (p.elegido != null) p.elegido = Math.max(0, Math.min(p.paso, p.elegido | 0));
  return p;
}

// El paso que se juega: el que escogió (si sigue abierto) o el más alto
export const elegido = (pr) => (pr.elegido == null ? pr.paso : Math.min(pr.elegido, pr.paso));

const pasoDe = (pr, i) => pr.pasos[i] || { ultimos: [], total: 0, aciertos: 0, dominado: false, estrellas: 0, rondas: 0 };
const clave = (w) => w.toLowerCase();

// Registra una respuesta. i: el paso en el que se contestó (cuenta para su dominio); null en los retos, que
// cuentan para las palabras, los fallos y el día, pero no para subir. Devuelve un progreso nuevo.
export function registrar(pr, i, palabra, ok, hoy) {
  let pasos = pr.pasos;
  if (i != null) {
    const ventana = datosPaso(i).etapa.ventana, ps = pasoDe(pr, i);
    pasos = { ...pasos, [i]: { ...ps, ultimos: [...ps.ultimos, ok ? 1 : 0].slice(-ventana), total: ps.total + 1, aciertos: ps.aciertos + (ok ? 1 : 0) } };
  }
  const k = clave(palabra), pw = pr.palabras[k] || { total: 0, aciertos: 0 };
  const palabras = { ...pr.palabras, [k]: { total: pw.total + 1, aciertos: pw.aciertos + (ok ? 1 : 0) } };
  const fallos = { ...pr.fallos };
  if (!ok) fallos[k] = { lista: buscar(k)?.lista || 1, veces: (fallos[k]?.veces || 0) + 1, seguidos: 0 };
  else if (fallos[k]) {
    const seguidos = fallos[k].seguidos + 1;
    if (seguidos >= 2) delete fallos[k]; else fallos[k] = { ...fallos[k], seguidos };
  }
  const dia = pr.dias[hoy] || { palabras: 0, aciertos: 0, reto: false };
  const dias = { ...pr.dias, [hoy]: { ...dia, palabras: dia.palabras + 1, aciertos: dia.aciertos + (ok ? 1 : 0) } };
  return { ...pr, pasos, palabras, fallos, dias };
}

// ¿Ya domina el paso? Con las últimas respuestas de su ventana (10 o 20), al menos las que pide la etapa.
export function dominio(pr, i) {
  const { etapa } = datosPaso(i);
  const u = pasoDe(pr, i).ultimos;
  const aciertos = u.reduce((s, x) => s + x, 0);
  return { intentos: u.length, aciertos, ventana: etapa.ventana, necesita: etapa.necesita, listo: u.length >= etapa.ventana && aciertos >= etapa.necesita };
}

export const estrellasRonda = (aciertos, de = POR_RONDA) => (aciertos >= de ? 3 : aciertos >= de * 0.8 ? 2 : aciertos >= de * 0.5 ? 1 : 0);

// Al terminar una ronda del paso i: guarda las estrellas y, si ya lo domina, abre el siguiente.
// Devuelve { pr, subio, estrellas }  (subio: el paso nuevo, o null)
export function cerrarRonda(pr, i, aciertos, de = POR_RONDA) {
  const ps = pasoDe(pr, i), est = estrellasRonda(aciertos, de);
  const pasos = { ...pr.pasos, [i]: { ...ps, estrellas: Math.max(ps.estrellas, est), rondas: ps.rondas + 1 } };
  let paso = pr.paso, subio = null;
  if (!ps.dominado && dominio(pr, i).listo) {
    pasos[i] = { ...pasos[i], dominado: true };
    if (i === pr.paso && i < PASOS - 1) { paso = i + 1; subio = paso; }
  }
  return { pr: { ...pr, pasos, paso, elegido: subio ?? pr.elegido }, subio, estrellas: est };
}

// Las palabras de una ronda del paso i: hasta 2 que falló antes (de esta lista o anteriores), 2 de repaso de
// listas anteriores y el resto de la lista. Sin repetir. [{ palabra, frase, lista, tipo }]
export function armarRonda(pr, i, rnd, cuantas = POR_RONDA) {
  const { lista: n } = datosPaso(i);
  const ronda = [], vistas = new Set();
  const meter = (w, tipo) => {
    const p = buscar(w);
    if (!p || vistas.has(clave(w))) return false;
    vistas.add(clave(w)); ronda.push({ ...p, tipo }); return true;
  };
  const fallos = revolver(rnd, Object.entries(pr.fallos).filter(([, f]) => f.lista <= n).map(([w]) => w));
  for (const w of fallos.slice(0, 2)) meter(w, "fallo");
  const anteriores = LISTAS.filter((l) => l.n < n).flatMap((l) => l.palabras.map((p) => p.palabra));
  for (const w of revolver(rnd, anteriores)) { if (ronda.length >= 4 || ronda.filter((r) => r.tipo === "repaso").length >= 2) break; meter(w, "repaso"); }
  for (const p of revolver(rnd, datosLista(n).palabras)) { if (ronda.length >= cuantas) break; meter(p.palabra, "nueva"); }
  return revolver(rnd, ronda);
}

// ---------- Días y racha (igual que en sumas-restas) ----------

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
  const dia = pr.dias[hoy] || { palabras: 0, aciertos: 0, reto: false };
  return { ...pr, retos: { ...pr.retos, [hoy]: reto }, dias: { ...pr.dias, [hoy]: { ...dia, reto: reto.cumplido } } };
}

// Días seguidos con el reto cumplido. Si hoy todavía no lo cumple, la racha de ayer sigue viva.
export function racha(pr, hoy) {
  let f = pr.retos[hoy]?.cumplido ? hoy : sumarDias(hoy, -1), n = 0;
  while (pr.retos[f]?.cumplido) { n++; f = sumarDias(f, -1); }
  return n;
}

export function semana(pr, hoy) {
  return Array.from({ length: 7 }, (_, i) => {
    const f = sumarDias(hoy, i - 6);
    return { fecha: f, jugo: !!pr.dias[f]?.palabras, reto: !!pr.retos[f]?.cumplido };
  });
}

// Para papás: por lista y etapa, las palabras que más falla y los últimos días
export function resumen(pr) {
  const listas = LISTAS.map((l) => ({
    n: l.n, nombre: l.nombre,
    etapas: ETAPAS.map((e, k) => {
      const i = (l.n - 1) * ETAPAS.length + k, ps = pasoDe(pr, i);
      return { id: e.id, nombre: e.nombre, total: ps.total, pct: ps.total ? Math.round((100 * ps.aciertos) / ps.total) : null, dominado: ps.dominado, abierto: i <= pr.paso };
    }),
  }));
  const fallos = Object.entries(pr.fallos).map(([w, f]) => ({ palabra: buscar(w)?.palabra || w, veces: f.veces })).sort((a, b) => b.veces - a.veces).slice(0, 10);
  const dias = Object.keys(pr.dias).sort().slice(-14).map((f) => ({ fecha: f, ...pr.dias[f] }));
  return { listas, fallos, dias };
}
