// Calificación de una pasarela: qué tanto va el atuendo con el tema, los colores, si está completo y los
// detalles; cada juez pesa esas cuatro cosas a su manera y da de 1 a 5 estrellas con un comentario positivo y
// uno de mejora. Lógica pura, sin azar: el mismo atuendo con el mismo tema da siempre lo mismo.
// Las fórmulas, con ejemplos trabajados, están en docs/JUEGO.md.
import { puestas } from "./atuendo.js";
import { el, un, concuerda, es, queda, tu, mayuscula, conEl, conUn } from "./espanol.js";

/**
 * Qué tanto va una prenda con un tema: el peso más alto de sus etiquetas en el tema (0 a 3), menos 2 si alguna de
 * sus etiquetas está en "evitar". Va de -2 a 3.
 * @param {{etiquetas: string[]}} prenda
 * @param {{etiquetas: Object<string, number>, evitar?: string[]}} tema
 * @returns {number}
 */
export function encaje(prenda, tema) {
  let c = 0;
  for (const t of prenda.etiquetas) c = Math.max(c, tema.etiquetas[t] || 0);
  if (prenda.etiquetas.some((t) => (tema.evitar || []).includes(t))) c -= 2;
  return c;
}

const lim = (x) => Math.max(0, Math.min(1, x));

/**
 * Las cuatro cosas que miran los jueces, cada una de 0 a 1:
 *  - tema: promedio del encaje de la ropa (vestido pesa 2, accesorios 0.5) dividido entre 3;
 *  - color: 70 % que los colores de la ropa (sin el pelo) sean del tema + 30 % que combinen (≤ 3 colores distintos = 1;
 *    4 = 0.6; 5 o más = 0.3);
 *  - completo: un tercio cada uno: cuerpo (arriba y abajo, o vestido; con solo uno de los dos, la mitad), zapatos, peinado;
 *  - detalles: accesorios que van con el tema (encaje ≥ 2): ninguno 0, uno 0.7, dos o más 1; −0.3 por cada uno que no va.
 * @param {object} atuendo
 * @param {object} tema
 * @param {{prendas: Map}} idx
 * @returns {{tema: number, color: number, completo: number, detalles: number, enTema: number, distintos: number}}
 */
export function componentes(atuendo, tema, idx) {
  const items = puestas(atuendo).map((p) => ({ ...p, prenda: idx.prendas.get(p.id) })).filter((p) => p.prenda);
  let suma = 0, pesos = 0;
  for (const it of items) {
    const w = it.prenda.categoria === "vestido" ? 2 : it.prenda.categoria === "accesorio" ? 0.5 : 1;
    suma += w * encaje(it.prenda, tema); pesos += w;
  }
  const vTema = pesos ? lim(suma / (3 * pesos)) : 0;

  const ropa = items.filter((it) => it.prenda.categoria !== "peinado");
  const enTema = ropa.length ? ropa.filter((it) => (tema.colores || []).includes(it.color)).length / ropa.length : 0;
  const distintos = new Set(ropa.map((it) => it.color)).size;
  const combina = distintos <= 3 ? 1 : distintos === 4 ? 0.6 : 0.3;
  const vColor = ropa.length ? 0.7 * enTema + 0.3 * combina : 0;

  const cuerpo = atuendo.vestido || (atuendo.arriba && atuendo.abajo) ? 1 : atuendo.arriba || atuendo.abajo ? 0.5 : 0;
  const vCompleto = (cuerpo + (atuendo.zapatos ? 1 : 0) + (atuendo.peinado ? 1 : 0)) / 3;

  const acc = items.filter((it) => it.prenda.categoria === "accesorio");
  const buenos = acc.filter((it) => encaje(it.prenda, tema) >= 2).length;
  const malos = acc.filter((it) => encaje(it.prenda, tema) < 0).length;
  const vDetalles = lim((buenos === 0 ? 0 : buenos === 1 ? 0.7 : 1) - 0.3 * malos);

  return { tema: vTema, color: vColor, completo: vCompleto, detalles: vDetalles, enTema, distintos };
}

/** Estrellas de un juez (1 a 5) a partir de su promedio ponderado (0 a 1). */
export const estrellasJuez = (s) => 1 + Math.round(lim(s) * 4);

/**
 * Estrellas de Noli (0 a 3, las del catálogo) a partir de los puntos de la pasarela (suma de las estrellas de los tres
 * jueces, 3 a 15): 13 o más = 3, 10 o más = 2, si no 1. Sin nada puesto, 0.
 */
export function estrellasNoli(puntos, algoPuesto = true) {
  if (!algoPuesto) return 0;
  return puntos >= 13 ? 3 : puntos >= 10 ? 2 : 1;
}

// ---------- Comentarios ----------

/** La mejor prenda de una categoría (de las abiertas) para el tema, o null. */
function mejorDe(categoria, tema, idx, abiertas, salvo) {
  let mejor = null, mc = 0;
  for (const p of idx.porCategoria.get(categoria) || []) {
    if (p.id === salvo || (abiertas && !abiertas.has(p.id))) continue;
    const c = encaje(p, tema);
    if (c > mc) { mc = c; mejor = p; }
  }
  return mejor;
}

const nombreColor = (idx, id) => (idx.colores.get(id) || { es: id }).es;

/**
 * Comentarios de un juez: siempre uno positivo, y uno de mejora (o null si no hay nada que mejorar en lo suyo).
 * @param {string} juez id del juez ("estrella" tema, "colorina" colores, "detalle" completo y accesorios)
 * @param {object} atuendo
 * @param {object} tema
 * @param {object} idx
 * @param {Set<string>} [abiertas] prendas que Noelia ya tiene (para sugerir solo esas)
 * @param {Set<string>} [coloresAbiertos]
 * @returns {{ positivo: string, mejora: string | null }}
 */
export function comentar(juez, atuendo, tema, idx, abiertas, coloresAbiertos) {
  const items = puestas(atuendo).map((p) => ({ ...p, prenda: idx.prendas.get(p.id) })).filter((p) => p.prenda);
  const ropa = items.filter((it) => it.prenda.categoria !== "peinado");
  const k = componentes(atuendo, tema, idx);
  if (!items.length) return { positivo: "¡Qué valiente, salir a la pasarela así!", mejora: "La próxima vez escoge ropa en los percheros." };

  if (juez === "colorina") {
    const delTema = ropa.filter((it) => (tema.colores || []).includes(it.color));
    const pos = delTema.length
      ? `¡Me encanta el ${nombreColor(idx, delTema[0].color)} de ${tu(delTema[0].prenda)} ${delTema[0].prenda.es}!`
      : ropa.length ? `¡Qué bonito se ve el ${nombreColor(idx, ropa[0].color)}!` : "¡Qué bonito color de pelo!";
    let mejora = null;
    if (k.enTema < 0.6) {
      const sugeridos = (tema.colores || []).filter((c) => !coloresAbiertos || coloresAbiertos.has(c)).slice(0, 2).map((c) => nombreColor(idx, c));
      if (sugeridos.length) mejora = `Para ${tema.para} prueba colores como ${sugeridos.join(" o ")}.`;
    } else if (k.distintos >= 4) mejora = "Son muchos colores juntos: prueba con dos o tres que combinen.";
    return { positivo: pos, mejora };
  }

  if (juez === "detalle") {
    const accBuenos = items.filter((it) => it.prenda.categoria === "accesorio" && encaje(it.prenda, tema) >= 2);
    const pos = accBuenos.length ? `¡${mayuscula(conEl(accBuenos[0].prenda))} ${es(accBuenos[0].prenda)} el toque perfecto!`
      : k.completo === 1 ? "¡No te faltó nada, de la cabeza a los pies!"
      : atuendo.peinado ? `¡Qué ${concuerda("bonito", idx.prendas.get(atuendo.peinado.id))} ${idx.prendas.get(atuendo.peinado.id).es}!` : "¡Me gusta cómo caminas en la pasarela!";
    let mejora = null;
    const falta = [];
    if (!(atuendo.vestido || atuendo.arriba)) falta.push("ropa de arriba");
    if (!(atuendo.vestido || atuendo.abajo)) falta.push("ropa de abajo");
    if (!atuendo.zapatos) falta.push("zapatos");
    if (!atuendo.peinado) falta.push("peinado");
    if (falta.length) mejora = `Te faltó: ${falta.join(", ")}.`;
    else if (!accBuenos.length) {
      const acc = mejorDe("accesorio", tema, idx, abiertas);
      mejora = acc ? `${mayuscula(conUn(acc))} ${acc.plural ? "quedarían increíbles" : "quedaría increíble"} para ${tema.para}.` : "Un accesorio le daría el toque final.";
    }
    return { positivo: pos, mejora };
  }

  // "estrella": el tema
  // La mejor y la peor prenda para el tema. En empate, primero la ropa y al final el peinado (es lo que menos se nota).
  const PRIORIDAD = ["arriba", "vestido", "abajo", "zapatos", "accesorio", "peinado"];
  const orden = items.map((it) => ({ ...it, c: encaje(it.prenda, tema), pr: PRIORIDAD.indexOf(it.prenda.categoria) }));
  const mejor = [...orden].sort((a, b) => b.c - a.c || a.pr - b.pr)[0];
  const peor = [...orden].sort((a, b) => a.c - b.c || a.pr - b.pr)[0];
  const pos = mejor.c >= 2
    ? `¡${mayuscula(conEl(mejor.prenda))} ${es(mejor.prenda)} ${concuerda("perfecto", mejor.prenda)} para ${tema.para}!`
    : `¡Me gusta cómo ${queda(mejor.prenda)} ${conEl(mejor.prenda)}!`;
  let mejora = null;
  if (peor.c <= 0) {
    const otra = mejorDe(peor.prenda.categoria, tema, idx, abiertas, peor.prenda.id);
    mejora = otra && encaje(otra, tema) > peor.c
      ? `${mayuscula(conUn(otra))} ${otra.plural ? "irían" : "iría"} mejor que ${conEl(peor.prenda)}.`
      : `${mayuscula(conEl(peor.prenda))} no ${peor.prenda.plural ? "van" : "va"} mucho con ${tema.para}.`;
  }
  return { positivo: pos, mejora };
}

/**
 * La calificación completa de una pasarela.
 * @param {object} atuendo
 * @param {object} tema
 * @param {object} idx índices (datos.js → indexar)
 * @param {{ prendas?: Set<string>, colores?: Set<string> }} [abiertos] lo que Noelia ya tiene, para sugerir solo eso
 * @returns {{ componentes, jueces: {id, nombre, estrellas, positivo, mejora}[], puntos: number, estrellas: number, consejo: string }}
 */
export function calificar(atuendo, tema, idx, abiertos = {}) {
  const k = componentes(atuendo, tema, idx);
  const jueces = idx.jueces.map((j) => {
    const s = j.pesos.tema * k.tema + j.pesos.color * k.color + j.pesos.completo * k.completo + j.pesos.detalles * k.detalles;
    const c = comentar(j.id, atuendo, tema, idx, abiertos.prendas, abiertos.colores);
    return { id: j.id, nombre: j.nombre, estrellas: estrellasJuez(s), valor: s, positivo: c.positivo, mejora: c.mejora };
  });
  const puntos = jueces.reduce((a, j) => a + j.estrellas, 0);
  const algo = puestas(atuendo).length > 0;
  // El consejo: la mejora del juez que dio menos estrellas (si no tiene, la del siguiente)
  const orden = [...jueces].sort((a, b) => a.valor - b.valor);
  const conMejora = orden.find((j) => j.mejora);
  return { componentes: k, jueces, puntos, estrellas: estrellasNoli(puntos, algo), consejo: conMejora ? conMejora.mejora : "¡No le cambiaría nada!" };
}
