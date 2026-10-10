// Las otras modelos de la pasarela (#90): compiten con Noelia. Se visten solas para el tema, desfilan antes que ella,
// los mismos jueces las califican, comentan el atuendo de Noelia y al final sale el podio. Lógica pura (el azar se
// pasa como función, así las pruebas son repetibles). Ver docs/JUEGO.md § Las otras modelos.
import { atuendoVacio, poner } from "./atuendo.js";
import { calificar, encaje } from "./puntuacion.js";
import { tu } from "./espanol.js";

const escoger = (lista, rnd) => lista[Math.floor(rnd() * lista.length) % lista.length];

/** Escoge n rivales al azar (sin repetir) */
export function escogerRivales(idx, rnd = Math.random, n = (idx.config.rivales || {}).cuantas || 2) {
  const todas = [...(idx.rivales || [])];
  const r = [];
  while (r.length < n && todas.length) r.push(todas.splice(Math.floor(rnd() * todas.length) % todas.length, 1)[0]);
  return r;
}

/**
 * Viste a una rival para el tema. Con probabilidad `habilidad` escoge la prenda abierta que mejor va con el tema (y un
 * color del tema); si no, una al azar. Siempre su peinado.
 * @param {{ peinado: [string, string], habilidad: number }} rival
 * @param {object} tema
 * @param {{ prendas: Set<string>, colores: Set<string> }} ab lo que puede usar
 * @param {object} idx
 * @param {() => number} rnd
 */
export function vestirRival(rival, tema, ab, idx, rnd = Math.random) {
  const h = Math.max(0, Math.min(1, rival.habilidad ?? 0.5));
  const de = (cat, lugar) => (idx.porCategoria.get(cat) || []).filter((p) => ab.prendas.has(p.id) && (!lugar || p.lugar === lugar));
  const mejor = (lista) => {
    if (!lista.length) return null;
    if (rnd() < h) { const m = Math.max(...lista.map((p) => encaje(p, tema))); return escoger(lista.filter((p) => encaje(p, tema) === m), rnd); }
    return escoger(lista, rnd);
  };
  const color = (p) => {
    const abiertos = p.colores.filter((c) => ab.colores.has(c));
    const delTema = abiertos.filter((c) => (tema.colores || []).includes(c));
    return (rnd() < h && delTema.length ? escoger(delTema, rnd) : escoger(abiertos.length ? abiertos : p.colores, rnd));
  };
  let a = atuendoVacio();
  const [pid, pcol] = rival.peinado || [];
  const pe = idx.prendas.get(pid);
  if (pe) a = poner(a, pe, pcol);
  // Vestido o arriba + abajo (la mitad de las veces vestido, si hay alguno que vaya)
  const vestidos = de("vestido");
  const v = vestidos.length && rnd() < 0.4 ? mejor(vestidos) : null;
  if (v) a = poner(a, v, color(v));
  else for (const cat of ["arriba", "abajo"]) { const p = mejor(de(cat)); if (p) a = poner(a, p, color(p)); }
  const z = mejor(de("zapatos")); if (z) a = poner(a, z, color(z));
  // Uno o dos detalles
  const acc = mejor(de("accesorio")); if (acc) a = poner(a, acc, color(acc));
  if (rnd() < 0.5) { const m = mejor(de("maquillaje")); if (m) a = poner(a, m, color(m)); }
  return a;
}

/**
 * Prepara la competencia de una pasarela: escoge rivales, las viste y las califica.
 * @returns {{ rival: object, atuendo: object, puntos: number, jueces: object[] }[]}
 */
export function prepararRivales(tema, ab, idx, rnd = Math.random, n = undefined) {
  return escogerRivales(idx, rnd, n).map((rival) => {
    const atuendo = vestirRival(rival, tema, ab, idx, rnd);
    const r = calificar(atuendo, tema, idx, ab);
    return { rival, atuendo, puntos: r.puntos, jueces: r.jueces.map((j) => ({ id: j.id, estrellas: j.estrellas })) };
  });
}

/**
 * El podio: Noelia y las rivales ordenadas por puntos (en empate, Noelia primero: es su juego).
 * @returns {{ quien: "noelia" | string, nombre: string, puntos: number, lugar: number, atuendo?: object }[]}
 */
export function podio(puntosNoelia, rivales) {
  const todos = [{ quien: "noelia", nombre: "Noelia", puntos: puntosNoelia }, ...rivales.map((r) => ({ quien: r.rival.id, nombre: r.rival.nombre, puntos: r.puntos, atuendo: r.atuendo, piel: r.rival.piel }))];
  todos.sort((a, b) => b.puntos - a.puntos || (a.quien === "noelia" ? -1 : b.quien === "noelia" ? 1 : 0));
  let lugar = 0, antes = null;
  return todos.map((x, i) => { if (x.puntos !== antes) { lugar = i + 1; antes = x.puntos; } return { ...x, lugar }; });
}

/** Lo que dice una rival del atuendo de Noelia mientras desfila (algo bonito de su mejor prenda para el tema) */
export function piropo(rival, atuendoNoelia, tema, idx, rnd = Math.random, i = 0) {
  const items = [atuendoNoelia.peinado, atuendoNoelia.arriba, atuendoNoelia.abajo, atuendoNoelia.vestido, atuendoNoelia.zapatos, ...Object.values(atuendoNoelia.accesorios || {})]
    .filter(Boolean).map((p) => idx.prendas.get(p.id)).filter(Boolean);
  if (!items.length) return `${rival.nombre}: ¡Qué valiente!`;
  // Cada rival habla de una prenda distinta (la mejor, la segunda mejor…)
  const orden = [...items].sort((a, b) => encaje(b, tema) - encaje(a, tema));
  const mejor = orden[i % orden.length];
  const frases = [
    () => `¡Me encanta ${tu(mejor)} ${mejor.es}!`,
    () => `¡${tu(mejor).replace(/^t/, "T")} ${mejor.es} ${mejor.plural ? "están" : "está"} increíble!`,
    () => "¡Qué bien te ves!",
    () => `¡Wow, qué estilo para ${tema.para}!`,
  ];
  return `${rival.nombre}: ${frases[(Math.floor(rnd() * frases.length) + i) % frases.length]()}`;
}

/** Lo que dice una rival al final, según quién ganó */
export function alFinal(rival, lugarRival, lugarNoelia) {
  if (lugarNoelia === 1 && lugarRival === 1) return "¡Empatamos! ¡Las dos fuimos estrellas!";
  if (lugarNoelia === 1) return "¡Felicidades, ganaste! Te lo merecías.";
  if (lugarRival === 1) return "¡Gané esta vez! La próxima te toca a ti.";
  return lugarRival < lugarNoelia ? "¡Qué divertido! Me encantó desfilar contigo." : "¡Lo hiciste muy bien! Me ganaste.";
}
