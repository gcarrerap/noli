// Niveles y visitas. Puro: el azar entra por `rnd`.
// Una visita: contar los recintos, armar la gráfica (o arreglarla, en Detective) y contestar 3 preguntas.
import { animal } from "./animales.js";
import { crearPregunta } from "./preguntas.js";
import { conErrores } from "./grafica.js";

export const PREGUNTAS_POR_VISITA = 3;

export const NIVELES = [
  { n: 1, nombre: "Gráfica de dibujos", corto: "Dibujos", ejemplo: "3 animales, hasta 10", grafica: "dibujos", k: 3, escala: 1, min: 2, max: 10, plan: [["cuantos"], ["mas", "menos"], ["cuantos"]] },
  { n: 2, nombre: "Gráfica de barras", corto: "Barras", ejemplo: "4 animales", grafica: "barras", k: 4, escala: 1, min: 2, max: 10, plan: [["cuantos"], ["mas", "menos"], ["cuantos", "mas", "menos"]] },
  { n: 3, nombre: "¿Cuántos más? ¿Cuántos menos?", corto: "¿Cuántos más?", ejemplo: "7 monos y 3 leones: 4 más", grafica: "barras", k: 4, escala: 1, min: 2, max: 10, plan: [["difMas"], ["difMenos"], ["difMas", "difMenos", "mas", "menos"]] },
  { n: 4, nombre: "Total", corto: "Total", ejemplo: "5 monos y 4 leones: 9", grafica: "barras", k: 4, escala: 1, min: 2, max: 10, plan: [["juntos2"], ["juntos3", "total"], ["difMas", "difMenos"]] },
  { n: 5, nombre: "De 2 en 2", corto: "De 2 en 2", ejemplo: "La barra sube 2", grafica: "barras", k: 4, escala: 2, min: 2, max: 20, plan: [["cuantos"], ["difMas", "difMenos"], ["juntos2"]] },
  { n: 6, nombre: "Detective", corto: "Detective", ejemplo: "Encuentra el error", grafica: "barras", k: 4, escala: 1, min: 2, max: 10, detective: true, plan: [["cuantos", "difMas", "difMenos"], ["difMas", "difMenos"], ["juntos2", "total"]] },
];

export const nivel = (n) => NIVELES[Math.max(1, Math.min(NIVELES.length, n | 0)) - 1];

function revolver(rnd, lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// k números distintos, múltiplos de `escala`, entre min y max.
export function cuentasDistintas(rnd, k, escala, min, max) {
  const posibles = [];
  for (let v = Math.ceil(min / escala) * escala; v <= max; v += escala) posibles.push(v);
  return revolver(rnd, posibles).slice(0, k);
}

// Elige a quién pregunta cada tipo, sin repetir el mismo animal ni el mismo par si se puede.
function idsPara(tipo, cuentas, rnd, usados) {
  const k = cuentas.length;
  const todos = revolver(rnd, cuentas.map((_, i) => i));
  const libres = todos.filter((i) => !usados.has(i));
  const orden = [...libres, ...todos.filter((i) => usados.has(i))];
  if (tipo === "cuantos") return [orden[0]];
  if (tipo === "mas" || tipo === "menos" || tipo === "total") return [];
  if (tipo === "juntos2" || tipo === "juntos3") return orden.slice(0, Math.min(k, tipo === "juntos3" ? 3 : 2));
  // difMas: el primero tiene más; difMenos: el primero tiene menos.
  const [a, b] = orden;
  const mayor = cuentas[a] > cuentas[b] ? a : b, menor = mayor === a ? b : a;
  return tipo === "difMas" ? [mayor, menor] : [menor, mayor];
}

export function crearPreguntas(plan, cats, cuentas, escala, rnd) {
  const usados = new Set();
  const vistos = new Set();
  const hechos = new Set();
  return plan.map((opciones) => {
    // Primero un tema que no salió; si ya salieron todos, nunca la misma pregunta de «más» o «menos» otra vez.
    const libres = opciones.filter((t) => !vistos.has(t));
    const noIguales = opciones.filter((t) => !((t === "mas" || t === "menos" || t === "total") && hechos.has(t)));
    const lista = libres.length ? libres : noIguales.length ? noIguales : opciones;
    let tipo = lista[Math.floor(rnd() * lista.length)];
    vistos.add(tipo);
    hechos.add(tipo);
    if (tipo === "mas") vistos.add("menos");
    if (tipo === "menos") vistos.add("mas");
    const ids = idsPara(tipo, cuentas, rnd, usados);
    ids.forEach((i) => usados.add(i));
    if (tipo === "juntos2" || tipo === "juntos3") tipo = "juntos";
    return crearPregunta(tipo, ids, cats, cuentas, escala, rnd);
  });
}

// pool: ids de los animales abiertos. opts.errores: cuántos errores trae la gráfica del detective.
export function crearVisita(n, rnd, { pool, errores, cuentas: fijas, animales: fijos, plan, min, max: maxOpt } = {}) {
  const nv = nivel(n);
  const lista = pool && pool.length >= nv.k ? pool : ["mono", "leon", "jirafa", "pinguino"];
  const ids = fijos || revolver(rnd, lista).slice(0, nv.k);
  const max = maxOpt || nv.max;
  const cuentas = fijas || cuentasDistintas(rnd, ids.length, nv.escala, min || nv.min, max);
  const cats = ids.map(animal);
  const detective = nv.detective || errores != null;
  const nErrores = errores != null ? errores : nv.detective ? (rnd() < 0.75 ? 1 : 0) : 0;
  return {
    nivel: nv.n,
    grafica: nv.grafica,
    escala: nv.escala,
    max,
    animales: ids,
    cuentas,
    detective: detective ? { errores: nErrores, inicial: conErrores(cuentas, nErrores, rnd, nv.escala, max) } : null,
    preguntas: crearPreguntas(plan || nv.plan, cats, cuentas, nv.escala, rnd),
  };
}

// Opciones al contar un recinto: la buena, una de más o de menos y otra cerca. De `escala` en `escala`.
export function opcionesConteo(cuenta, escala, rnd) {
  const ops = [cuenta];
  const prueba = (x) => { if (ops.length < 3 && x >= escala && !ops.includes(x)) ops.push(x); };
  prueba(rnd() < 0.5 ? cuenta + escala : cuenta - escala);
  prueba(rnd() < 0.5 ? cuenta + 2 * escala : cuenta - 2 * escala);
  for (let k = 1; ops.length < 3; k++) { prueba(cuenta + k * escala); prueba(cuenta - k * escala); }
  return ops.sort((a, b) => a - b);
}
