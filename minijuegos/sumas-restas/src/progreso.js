// Progreso de Noelia: funciones puras sobre un objeto JSON que el juego guarda con Noli.guardar.
//
// {
//   v: 1,
//   nivel: 3,                          // el nivel más alto desbloqueado
//   niveles: { "1": { ultimos: [[ok, seg], …20], total, aciertos, dominado, estrellas, rondas } },
//   fallos: { "38+7": { p, veces, seguidos } },   // problemas que falló; salen 2 veces bien seguidas y se van
//   dias: { "2026-10-08": { problemas, aciertos, reto } },
//   retos: { "2026-10-08": { tipo, cumplido, puntos } },
// }
import { NIVELES, nivel as datosNivel, clave } from "./niveles.js";
import { revolver } from "./rng.js";

export const VENTANA = 20;          // problemas que cuentan para decidir si ya domina el nivel
export const ACIERTOS_PARA_SUBIR = 0.9;
export const TIEMPO_MAX = 60;       // un problema de más de 60 s (se distrajo) cuenta como 60
export const POR_RONDA = 10;

export function nuevo() {
  return { v: 1, nivel: 1, niveles: {}, fallos: {}, dias: {}, retos: {} };
}

// Datos guardados que pueden venir de una versión anterior o venir rotos: siempre devuelve un progreso válido
export function cargar(d) {
  if (!d || typeof d !== "object" || d.v !== 1) return nuevo();
  const p = { ...nuevo(), ...d };
  p.nivel = Math.max(1, Math.min(NIVELES.length, p.nivel | 0));
  return p;
}

const nivelDe = (pr, n) => pr.niveles[n] || { ultimos: [], total: 0, aciertos: 0, dominado: false, estrellas: 0, rondas: 0 };

// Registra una respuesta. nivelN: el nivel del que salió el problema. Devuelve un progreso nuevo.
export function registrar(pr, nivelN, problema, ok, segundos, hoy) {
  const t = Math.min(TIEMPO_MAX, Math.max(0, Math.round(segundos * 10) / 10));
  const nv = nivelDe(pr, nivelN);
  const niveles = { ...pr.niveles, [nivelN]: {
    ...nv,
    ultimos: [...nv.ultimos, [ok ? 1 : 0, t]].slice(-VENTANA),
    total: nv.total + 1, aciertos: nv.aciertos + (ok ? 1 : 0),
  } };
  const k = clave(problema);
  const fallos = { ...pr.fallos };
  if (!ok) fallos[k] = { p: problema, n: nivelN, veces: (fallos[k]?.veces || 0) + 1, seguidos: 0 };
  else if (fallos[k]) {
    const seguidos = fallos[k].seguidos + 1;
    if (seguidos >= 2) delete fallos[k]; else fallos[k] = { ...fallos[k], seguidos };
  }
  const dia = pr.dias[hoy] || { problemas: 0, aciertos: 0, reto: false };
  const dias = { ...pr.dias, [hoy]: { ...dia, problemas: dia.problemas + 1, aciertos: dia.aciertos + (ok ? 1 : 0) } };
  return { ...pr, niveles, fallos, dias };
}

const mediana = (xs) => {
  if (!xs.length) return Infinity;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// ¿Ya domina el nivel? Con los últimos 20: 90 % bien y la mediana del tiempo dentro del límite del nivel.
export function dominio(pr, n) {
  const nv = nivelDe(pr, n);
  const u = nv.ultimos;
  const aciertos = u.reduce((s, [ok]) => s + ok, 0);
  const med = mediana(u.map(([, t]) => t));
  const limite = datosNivel(n).limite;
  return {
    intentos: u.length, aciertos, mediana: med, limite,
    listo: u.length >= VENTANA && aciertos / u.length >= ACIERTOS_PARA_SUBIR && med <= limite,
  };
}

export const estrellasRonda = (aciertos, de = POR_RONDA) => (aciertos >= de ? 3 : aciertos >= de * 0.8 ? 2 : aciertos >= de * 0.5 ? 1 : 0);

// Al terminar una ronda del nivel n: guarda las estrellas y, si ya lo domina, desbloquea el siguiente.
// Devuelve { pr, subio }  (subio: el nivel nuevo, o null)
export function cerrarRonda(pr, n, aciertos, de = POR_RONDA) {
  const nv = nivelDe(pr, n);
  const est = estrellasRonda(aciertos, de);
  let niveles = { ...pr.niveles, [n]: { ...nv, estrellas: Math.max(nv.estrellas, est), rondas: nv.rondas + 1 } };
  let nivel = pr.nivel, subio = null;
  if (!nv.dominado && dominio(pr, n).listo) {
    niveles[n] = { ...niveles[n], dominado: true };
    if (n === pr.nivel && n < NIVELES.length) { nivel = n + 1; subio = nivel; }
  }
  return { pr: { ...pr, niveles, nivel }, subio, estrellas: est };
}

// Los 10 problemas de una ronda del nivel n: primero hasta 2 que falló antes (de este nivel o de los anteriores),
// 2 de repaso de niveles ya dominados, y el resto del nivel. Sin repetir el mismo problema.
export function armarRonda(pr, n, rnd, cuantos = POR_RONDA) {
  const ronda = [], vistos = new Set();
  const meter = (p, deNivel, tipo) => { const k = clave(p); if (vistos.has(k)) return false; vistos.add(k); ronda.push({ p, n: deNivel, tipo }); return true; };

  const fallos = revolver(rnd, Object.values(pr.fallos).filter((f) => f.n <= n));
  for (const f of fallos.slice(0, 2)) meter(f.p, f.n, "fallo");

  const dominados = NIVELES.filter((x) => x.n < n && pr.niveles[x.n]?.dominado);
  for (let i = 0, k = 0; i < 2 && dominados.length && k < 20; k++) {
    const x = dominados[Math.floor(rnd() * dominados.length)];
    if (meter(x.gen(rnd), x.n, "repaso")) i++;
  }
  const gen = datosNivel(n).gen;
  for (let k = 0; ronda.length < cuantos && k < 200; k++) meter(gen(rnd), n, "nuevo");
  return revolver(rnd, ronda);
}

// ---------- Días y racha ----------

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

// Días seguidos con el reto cumplido. Si hoy todavía no lo cumple, la racha de ayer sigue viva.
export function racha(pr, hoy) {
  let f = pr.retos[hoy]?.cumplido ? hoy : sumarDias(hoy, -1), n = 0;
  while (pr.retos[f]?.cumplido) { n++; f = sumarDias(f, -1); }
  return n;
}

// Los últimos 7 días (para el calendario): [{ fecha, jugo, reto }]
export function semana(pr, hoy) {
  return Array.from({ length: 7 }, (_, i) => {
    const f = sumarDias(hoy, i - 6);
    return { fecha: f, jugo: !!pr.dias[f]?.problemas, reto: !!pr.retos[f]?.cumplido };
  });
}

// Para papás: por nivel, y los problemas que más falla
export function resumen(pr) {
  const niveles = NIVELES.map((x) => {
    const nv = nivelDe(pr, x.n), dm = dominio(pr, x.n);
    return { n: x.n, nombre: x.nombre, total: nv.total, pct: nv.total ? Math.round((100 * nv.aciertos) / nv.total) : null,
      mediana: dm.intentos ? dm.mediana : null, limite: x.limite, dominado: nv.dominado, desbloqueado: x.n <= pr.nivel, estrellas: nv.estrellas };
  });
  const fallos = Object.values(pr.fallos).sort((a, b) => b.veces - a.veces).slice(0, 8);
  const dias = Object.keys(pr.dias).sort().slice(-14).map((f) => ({ fecha: f, ...pr.dias[f] }));
  return { niveles, fallos, dias };
}
