// Progreso de Noelia en spelling: funciones puras sobre un objeto JSON que el juego guarda con Noli.guardar.
//
// El juego principal es el DICTADO: el juego dice la palabra y ella la escribe. Cada lista se pasa con 18 de
// las últimas 20 bien en dictado, y entonces se abre la siguiente. "Escoge" y "Arma" son práctica opcional.
//
// {
//   v: 2,
//   lista: 5,                        // la lista más alta abierta
//   elegida: 4,                      // la que escogió jugar (si volvió a una anterior)
//   nivelado: true,                  // ya hizo la prueba de nivel (o la saltó)
//   listas: { "5": { ultimos: [1, 0, …20], total, aciertos, dominada, estrellas, rondas, porPrueba } },
//   palabras: { "cake": { total, aciertos } },
//   fallos: { "cake": { lista, veces, seguidos } },   // palabras que falló; salen con 2 bien seguidas
//   dias: { "2026-10-08": { palabras, aciertos, reto } },
//   retos: { "2026-10-08": { tipo, cumplido, puntos } },
// }
import { LISTAS, lista as datosLista, buscar } from "./palabras.js";
import { revolver } from "./rng.js";

export const POR_RONDA = 10;
export const VENTANA = 20;       // respuestas de dictado que cuentan para pasar la lista
export const NECESITA = 18;      // cuántas de ellas bien

export function nuevo() {
  return { v: 2, lista: 1, elegida: null, nivelado: false, listas: {}, palabras: {}, fallos: {}, dias: {}, retos: {} };
}

// Datos guardados que pueden venir rotos o de la versión anterior: siempre devuelve un progreso válido.
// La v1 tenía "pasos" (lista × etapa): se conserva la lista en la que iba y lo que jugó, y se le ofrece la prueba.
export function cargar(d) {
  if (!d || typeof d !== "object") return nuevo();
  if (d.v === 1) {
    const lista = Math.floor((d.paso | 0) / 3) + 1;
    return cargar({ ...nuevo(), lista, palabras: d.palabras || {}, fallos: d.fallos || {}, dias: d.dias || {}, retos: d.retos || {} });
  }
  if (d.v !== 2) return nuevo();
  const p = { ...nuevo(), ...d };
  p.lista = Math.max(1, Math.min(LISTAS.length, p.lista | 0));
  if (p.elegida != null) p.elegida = Math.max(1, Math.min(p.lista, p.elegida | 0));
  return p;
}

// La lista que se juega: la que escogió (si sigue abierta) o la más alta
export const elegida = (pr) => (pr.elegida == null ? pr.lista : Math.min(pr.elegida, pr.lista));

const listaDe = (pr, n) => pr.listas[n] || { ultimos: [], total: 0, aciertos: 0, dominada: false, estrellas: 0, rondas: 0 };
const clave = (w) => w.toLowerCase();

// Registra una respuesta. n: la lista del dictado en curso (cuenta para pasarla); null en la práctica y los
// retos, que cuentan para las palabras, los fallos y el día, pero no para pasar. Devuelve un progreso nuevo.
export function registrar(pr, n, palabra, ok, hoy) {
  let listas = pr.listas;
  if (n != null) {
    const ls = listaDe(pr, n);
    listas = { ...listas, [n]: { ...ls, ultimos: [...ls.ultimos, ok ? 1 : 0].slice(-VENTANA), total: ls.total + 1, aciertos: ls.aciertos + (ok ? 1 : 0) } };
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
  return { ...pr, listas, palabras, fallos, dias };
}

// ¿Ya domina la lista en dictado? 18 de las últimas 20.
export function dominio(pr, n) {
  const u = listaDe(pr, n).ultimos, aciertos = u.reduce((s, x) => s + x, 0);
  return { intentos: u.length, aciertos, ventana: VENTANA, necesita: NECESITA, listo: u.length >= VENTANA && aciertos >= NECESITA };
}

export const estrellasRonda = (aciertos, de = POR_RONDA) => (aciertos >= de ? 3 : aciertos >= de * 0.8 ? 2 : aciertos >= de * 0.5 ? 1 : 0);

// Al terminar una ronda de dictado de la lista n: guarda las estrellas y, si ya la domina, abre la siguiente.
// Devuelve { pr, subio, estrellas }  (subio: la lista nueva, o null)
export function cerrarRonda(pr, n, aciertos, de = POR_RONDA) {
  const ls = listaDe(pr, n), est = estrellasRonda(aciertos, de);
  const listas = { ...pr.listas, [n]: { ...ls, estrellas: Math.max(ls.estrellas, est), rondas: ls.rondas + 1 } };
  let lista = pr.lista, subio = null;
  if (!ls.dominada && dominio(pr, n).listo) {
    listas[n] = { ...listas[n], dominada: true };
    if (n === pr.lista && n < LISTAS.length) { lista = n + 1; subio = lista; }
  }
  return { pr: { ...pr, listas, lista, elegida: subio ?? pr.elegida }, subio, estrellas: est };
}

// Después de la prueba de nivel: empieza en la lista `n`; las de abajo quedan dominadas (para el repaso)
export function colocar(pr, n) {
  const listas = { ...pr.listas };
  for (let i = 1; i < n; i++) if (!listas[i]?.dominada) listas[i] = { ...listaDe(pr, i), dominada: true, porPrueba: true };
  return { ...pr, lista: n, elegida: null, nivelado: true, listas };
}

// Las palabras de una ronda de la lista n: hasta 2 que falló antes (de esta lista o anteriores), 2 de repaso de
// listas anteriores (las más recientes primero) y el resto de la lista. Sin repetir. [{ palabra, frase, lista, tipo }]
export function armarRonda(pr, n, rnd, cuantas = POR_RONDA) {
  const ronda = [], vistas = new Set();
  const meter = (w, tipo) => {
    const p = buscar(w);
    if (!p || vistas.has(clave(w))) return false;
    vistas.add(clave(w)); ronda.push({ ...p, tipo }); return true;
  };
  const fallos = revolver(rnd, Object.entries(pr.fallos).filter(([, f]) => f.lista <= n).map(([w]) => w));
  for (const w of fallos.slice(0, 2)) meter(w, "fallo");
  const anteriores = LISTAS.filter((l) => l.n < n && l.n >= n - 3).flatMap((l) => l.palabras.map((p) => p.palabra));
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

// Para papás: dictado por lista, las palabras que más falla y los últimos días
export function resumen(pr) {
  const listas = LISTAS.map((l) => {
    const ls = listaDe(pr, l.n), dm = dominio(pr, l.n);
    return { n: l.n, nombre: l.nombre, total: ls.total, pct: ls.total ? Math.round((100 * ls.aciertos) / ls.total) : null,
      recientes: dm.intentos ? `${dm.aciertos}/${dm.intentos}` : null, dominada: ls.dominada, porPrueba: !!ls.porPrueba, abierta: l.n <= pr.lista };
  });
  const fallos = Object.entries(pr.fallos).map(([w, f]) => ({ palabra: buscar(w)?.palabra || w, veces: f.veces })).sort((a, b) => b.veces - a.veces).slice(0, 10);
  const dias = Object.keys(pr.dias).sort().slice(-14).map((f) => ({ fecha: f, ...pr.dias[f] }));
  return { listas, fallos, dias };
}
