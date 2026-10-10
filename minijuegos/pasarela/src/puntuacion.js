// Calificación de una pasarela: qué tanto va el atuendo con el tema, los colores, si está completo y los
// detalles; cada juez pesa esas cuatro cosas a su manera y da de 1 a 5 estrellas con un comentario positivo y
// uno de mejora. Lógica pura, sin azar: el mismo atuendo con el mismo tema da siempre lo mismo.
// Las fórmulas, con ejemplos trabajados, están en docs/JUEGO.md.
import { puestas } from "./atuendo.js";
import { el, un, concuerda, es, queda, tu, mayuscula, conEl, conUn, lista } from "./espanol.js";

/**
 * Las piezas puestas con su prenda. Si la pieza trae patrón, la prenda lleva también las etiquetas del patrón
 * (una camiseta con estampado de cebra cuenta como "rock" para la jueza del tema).
 */
function conPrendas(atuendo, idx) {
  return puestas(atuendo).map((p) => {
    let prenda = idx.prendas.get(p.id);
    const pid = prenda && (p.patron || prenda.patronFijo); // patronFijo: diseños del Taller (#80)
    const pa = pid && idx.patrones ? idx.patrones.get(pid) : null;
    if (pa) prenda = { ...prenda, etiquetas: [...new Set([...prenda.etiquetas, ...(pa.etiquetas || [])])] };
    return { ...p, prenda };
  }).filter((p) => p.prenda);
}

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
 *  - detalles: accesorios y maquillaje que van con el tema (encaje ≥ 2): ninguno 0, uno 0.7, dos o más 1; −0.3 por cada uno que no va.
 * @param {object} atuendo
 * @param {object} tema
 * @param {{prendas: Map}} idx
 * @returns {{tema: number, color: number, completo: number, detalles: number, enTema: number, distintos: number}}
 */
export function componentes(atuendo, tema, idx) {
  const items = conPrendas(atuendo, idx);
  let suma = 0, pesos = 0;
  for (const it of items) {
    const w = it.prenda.categoria === "vestido" ? 2 : it.prenda.lugar ? 0.5 : 1;
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

  const acc = items.filter((it) => it.prenda.lugar); // accesorios y maquillaje
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

// Lo que habla cada juez primero (su especialidad); después, lo que más le bajó estrellas.
const ESPECIALIDAD = { estrella: ["tema"], colorina: ["color"], detalle: ["completo", "detalles"] };

/** Un número fijo por atuendo + tema + juez (para variar los comentarios sin azar: lo mismo da lo mismo) */
function semilla(txt) {
  let h = 7;
  for (let i = 0; i < txt.length; i++) h = (h * 31 + txt.charCodeAt(i)) >>> 0;
  return h;
}

/** En qué mueble del estudio está una prenda ("en la joyería"), para que sepa dónde buscarla */
function dondeEsta(prenda, idx) {
  const z = ((idx.zonas && idx.zonas.zonas) || []).find((x) => (x.categorias || []).includes(prenda.categoria) && (!x.lugares || x.lugares.includes(prenda.lugar)));
  return z ? ` (en ${z.nombre.toLowerCase()})` : "";
}

/** El mejor accesorio o maquillaje que ya tiene para el tema, en un lugar que no trae ocupado (encaje ≥ 2), o null */
function mejorDetalle(tema, idx, abiertas, ocupados) {
  let mejor = null, mc = 1;
  for (const cat of ["accesorio", "maquillaje"]) for (const p of idx.porCategoria.get(cat) || []) {
    if ((abiertas && !abiertas.has(p.id)) || ocupados.has(p.lugar)) continue;
    const c = encaje(p, tema);
    if (c > mc) { mc = c; mejor = p; }
  }
  return mejor;
}

/** Qué le faltó (ropa de arriba, zapatos…) */
function faltantes(atuendo) {
  const falta = [];
  if (!(atuendo.vestido || atuendo.arriba)) falta.push("ropa de arriba");
  if (!(atuendo.vestido || atuendo.abajo)) falta.push("ropa de abajo");
  if (!atuendo.zapatos) falta.push("zapatos");
  if (!atuendo.peinado) falta.push("peinado");
  return falta;
}

/**
 * Lo que un juez esperaba, hablando de una de las cuatro cosas (o null si en eso no hay nada que decir).
 * @param {"tema"|"color"|"completo"|"detalles"} cosa
 */
function queEsperaba(cosa, c) {
  const { atuendo, tema, idx, abiertas, coloresAbiertos, items, ropa, k } = c;
  if (cosa === "tema") {
    // La peor prenda para el tema (en empate, primero la ropa) y una mejor que ya tenga
    const PRIORIDAD = ["arriba", "vestido", "abajo", "zapatos", "accesorio", "maquillaje", "peinado"];
    const orden = items.map((it) => ({ ...it, c: encaje(it.prenda, tema), pr: PRIORIDAD.indexOf(it.prenda.categoria) })).sort((a, b) => a.c - b.c || a.pr - b.pr);
    const peor = orden[0];
    if (!peor || peor.c >= 3) return null;
    const otra = mejorDe(peor.prenda.categoria, tema, idx, abiertas, peor.prenda.id);
    if (otra && encaje(otra, tema) > peor.c) {
      const iria = otra.plural ? "irían" : "iría";
      return peor.c <= 0 ? `${mayuscula(conUn(otra))} ${iria} mejor que ${conEl(peor.prenda)}.`
        : `${mayuscula(conEl(peor.prenda))} ${es(peor.prenda)} ${concuerda("bonito", peor.prenda)}, pero ${conUn(otra)} ${iria} mejor para ${tema.para}.`;
    }
    return peor.c <= 0 ? `${mayuscula(conEl(peor.prenda))} no ${peor.prenda.plural ? "van" : "va"} mucho con ${tema.para}.` : null;
  }
  if (cosa === "color") {
    const delTema = tema.colores || [];
    if (k.enTema < 0.6) {
      const abiertos = delTema.filter((x) => !coloresAbiertos || coloresAbiertos.has(x));
      // Una prenda concreta que puede ir de un color del tema
      for (const it of ropa) {
        if (delTema.includes(it.color)) continue;
        const otro = (it.prenda.colores || []).find((x) => abiertos.includes(x));
        if (otro) return `Para ${tema.para} prueba ${tu(it.prenda)} ${it.prenda.es} en ${nombreColor(idx, otro)}; los colores del tema son ${lista(abiertos.slice(0, 3).map((x) => nombreColor(idx, x)))}.`;
      }
      const sugeridos = abiertos.slice(0, 2).map((x) => nombreColor(idx, x));
      if (sugeridos.length) return `Para ${tema.para} prueba colores como ${sugeridos.join(" o ")}.`;
    }
    if (k.distintos >= 4) return "Son muchos colores juntos: prueba con dos o tres que combinen.";
    // Una prenda que no es de los colores del tema y que sí puede serlo
    for (const it of ropa) {
      if (delTema.includes(it.color)) continue;
      const otro = (it.prenda.colores || []).find((x) => delTema.includes(x) && (!coloresAbiertos || coloresAbiertos.has(x)));
      if (otro) return `${mayuscula(tu(it.prenda))} ${it.prenda.es} en ${nombreColor(idx, otro)} se ${it.prenda.plural ? "verían" : "vería"} más de ${tema.nombre.toLowerCase()}.`;
    }
    return null;
  }
  if (cosa === "completo") {
    const falta = faltantes(atuendo);
    return falta.length ? `Te faltó: ${falta.join(", ")}.` : null;
  }
  // detalles: accesorios y maquillaje
  const acc = items.filter((it) => it.prenda.lugar);
  const ocupados = new Set(acc.map((it) => it.prenda.lugar));
  const malo = acc.find((it) => encaje(it.prenda, tema) < 0);
  const sug = mejorDetalle(tema, idx, abiertas, malo ? new Set([...ocupados].filter((l) => l !== malo.prenda.lugar)) : ocupados);
  if (malo) {
    return `${mayuscula(conEl(malo.prenda))} no ${malo.prenda.plural ? "van" : "va"} con ${tema.para}` + (sug ? `; mejor ${conUn(sug)}${dondeEsta(sug, idx)}.` : ".");
  }
  const buenos = acc.filter((it) => encaje(it.prenda, tema) >= 2).length;
  if (buenos === 0) {
    return sug ? `Me hubiera gustado un detalle: ${conUn(sug)}${dondeEsta(sug, idx)} ${sug.plural ? "quedarían increíbles" : "quedaría increíble"} para ${tema.para}.`
      : `Me hubiera gustado un detalle para ${tema.para}: busca en los accesorios, la joyería o el maquillaje.`;
  }
  if (buenos === 1) return sug ? `Un detalle más, como ${conUn(sug)}${dondeEsta(sug, idx)}, y sería perfecto.` : "Un detalle más y sería perfecto.";
  return null;
}

/** Lo bueno que dice cada juez (el primero es el más importante) */
function positivos(juez, c) {
  const { atuendo, tema, idx, items, ropa, k } = c;
  const r = [];
  if (juez === "colorina") {
    const delTema = ropa.filter((it) => (tema.colores || []).includes(it.color));
    if (delTema.length) r.push(`¡Me encanta el ${nombreColor(idx, delTema[0].color)} de ${tu(delTema[0].prenda)} ${delTema[0].prenda.es}!`);
    else if (ropa.length) r.push(`¡Qué bonito se ve el ${nombreColor(idx, ropa[0].color)}!`);
    else r.push("¡Qué bonito color de pelo!");
    const otro = delTema.find((it) => it.color !== (delTema[0] || {}).color);
    if (otro) r.push(`Y el ${nombreColor(idx, otro.color)} de ${tu(otro.prenda)} ${otro.prenda.es} va perfecto con ${tema.para}.`);
    const conPatron = items.find((it) => it.patron || it.prenda.patronFijo);
    if (conPatron) { const pa = idx.patrones.get(conPatron.patron || conPatron.prenda.patronFijo); if (pa) r.push(`¡Qué divertido el estampado de ${pa.es}!`); }
    if (ropa.length >= 2 && k.distintos <= 3) r.push("Tus colores combinan muy bien.");
    return r;
  }
  if (juez === "detalle") {
    const propio = items.find((it) => it.prenda.diseno);
    const pron = (p) => (p.genero === "f" ? "la" : "lo") + (p.plural ? "s" : "");
    if (propio) r.push(`¿${mayuscula(tu(propio.prenda))} ${propio.prenda.es} «${propio.prenda.nombre}» ${pron(propio.prenda)} hiciste tú? ¡Qué original!`);
    const buenos = items.filter((it) => it.prenda.lugar && encaje(it.prenda, tema) >= 2);
    for (const b of buenos.slice(0, 2)) r.push(r.length ? `Y ${conEl(b.prenda)} ${b.prenda.plural ? "quedan" : "queda"} muy bien.` : `¡${mayuscula(conEl(b.prenda))} ${es(b.prenda)} el toque perfecto!`);
    if (k.completo === 1) r.push("¡No te faltó nada, de la cabeza a los pies!");
    const maqui = items.find((it) => it.prenda.categoria === "maquillaje" && !buenos.includes(it));
    if (maqui) r.push(`¡Qué ${concuerda("lindo", maqui.prenda)} ${maqui.prenda.es}!`);
    if (atuendo.peinado) { const pe = idx.prendas.get(atuendo.peinado.id); if (pe) r.push(`¡Qué ${concuerda("bonito", pe)} ${pe.es}!`); }
    if (!r.length) r.push("¡Me gusta cómo caminas en la pasarela!");
    return r;
  }
  // "estrella": el tema. En empate, primero la ropa y al final el peinado (es lo que menos se nota).
  const PRIORIDAD = ["arriba", "vestido", "abajo", "zapatos", "accesorio", "maquillaje", "peinado"];
  const orden = items.map((it) => ({ ...it, c: encaje(it.prenda, tema), pr: PRIORIDAD.indexOf(it.prenda.categoria) })).sort((a, b) => b.c - a.c || a.pr - b.pr);
  const mejor = orden[0];
  if (mejor.c >= 2) r.push(`¡${mayuscula(conEl(mejor.prenda))} ${es(mejor.prenda)} ${concuerda("perfecto", mejor.prenda)} para ${tema.para}!`);
  else r.push(`¡Me gusta cómo ${queda(mejor.prenda)} ${conEl(mejor.prenda)}!`);
  const otra = orden.slice(1).find((it) => it.c >= 2);
  if (otra) r.push(`Y ${conEl(otra.prenda)} también ${otra.prenda.plural ? "van" : "va"} muy bien con el tema.`);
  if (k.tema >= 0.9) r.push(`¡Se nota que pensaste en ${tema.para}!`);
  return r;
}

/**
 * Comentarios de un juez: lo bueno (uno o dos) y, si no dio 5 estrellas, lo que esperaba (siempre dice qué le faltó
 * para dar más: Noelia se quejó de jueces que daban 3 estrellas sin decir por qué).
 * Primero habla de su especialidad (Estela: el tema; Colorina: los colores; Don Detalle: que no falte nada y los
 * accesorios); si ahí no hay nada, de lo que más estrellas le quitó.
 * @param {string} juez id del juez ("estrella", "colorina", "detalle")
 * @param {object} atuendo
 * @param {object} tema
 * @param {object} idx
 * @param {Set<string>} [abiertas] prendas que Noelia ya tiene (para sugerir solo esas)
 * @param {Set<string>} [coloresAbiertos]
 * @param {Map<string, string>|"propia"} [yaDicho] "propia": solo de su especialidad; un Map (lo que ya se dijo → quién lo dijo): no repetirlo
 * @returns {{ positivo: string, positivos: string[], mejora: string | null }}
 */
export function comentar(juez, atuendo, tema, idx, abiertas, coloresAbiertos, yaDicho = null) {
  const items = conPrendas(atuendo, idx);
  if (!items.length) return { positivo: "¡Qué valiente, salir a la pasarela así!", positivos: ["¡Qué valiente, salir a la pasarela así!"], mejora: "La próxima vez escoge ropa en los percheros." };
  const ropa = items.filter((it) => it.prenda.categoria !== "peinado");
  const k = componentes(atuendo, tema, idx);
  const c = { atuendo, tema, idx, abiertas, coloresAbiertos, items, ropa, k };
  const j = (idx.jueces || []).find((x) => x.id === juez);
  const pesos = j ? j.pesos : { tema: 0.25, color: 0.25, completo: 0.25, detalles: 0.25 };
  const valor = pesos.tema * k.tema + pesos.color * k.color + pesos.completo * k.completo + pesos.detalles * k.detalles;

  const pos = positivos(juez, c);
  // Un segundo comentario bueno, que varía con el atuendo (sin azar)
  const lista = pos.length > 1 ? [pos[0], pos[1 + (semilla(juez + tema.id + items.map((it) => it.id + it.color).join()) % (pos.length - 1))]] : pos;

  let mejora = null;
  if (estrellasJuez(valor) < 5) {
    const perdida = (x) => pesos[x] * (1 - k[x]);
    const propia = (ESPECIALIDAD[juez] || []).filter((x) => perdida(x) > 0.001);
    // yaDicho (desde calificar): primero cada juez habla solo de lo suyo; después, los que no tuvieron nada que decir
    // hablan de lo que más les quitó, sin repetir lo que ya dijo otro juez
    const orden = yaDicho === "propia" ? propia : [...propia, ...["tema", "color", "completo", "detalles"].sort((a, b) => perdida(b) - perdida(a))];
    const evitar = yaDicho instanceof Map ? yaDicho : new Map();
    let repetida = null;
    for (const cosa of orden) {
      const m = queEsperaba(cosa, c);
      if (m && !evitar.has(m)) { mejora = m; break; }
      if (m && !repetida) repetida = m;
    }
    // Si lo que esperaba ya lo dijo otro juez, lo apoya (así nadie se queda sin decir por qué no dio 5)
    if (!mejora && repetida) mejora = `Opino como ${evitar.get(repetida)}: ${repetida.charAt(0).toLowerCase() + repetida.slice(1)}`;
    if (!mejora && j && yaDicho !== "propia") mejora = `¡Ya casi! ${j.dice}`;
  }
  return { positivo: lista[0], positivos: lista, mejora };
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
  // Lo que esperaba cada juez: primero cada uno de lo suyo; los que no tuvieron nada, de otra cosa sin repetir
  const primero = idx.jueces.map((j) => comentar(j.id, atuendo, tema, idx, abiertos.prendas, abiertos.colores, "propia"));
  const dicho = new Map(primero.map((c, i) => [c.mejora, idx.jueces[i].nombre]).filter(([m]) => m));
  const jueces = idx.jueces.map((j, i) => {
    const s = j.pesos.tema * k.tema + j.pesos.color * k.color + j.pesos.completo * k.completo + j.pesos.detalles * k.detalles;
    let c = primero[i];
    if (!c.mejora) { c = comentar(j.id, atuendo, tema, idx, abiertos.prendas, abiertos.colores, dicho); if (c.mejora && !dicho.has(c.mejora)) dicho.set(c.mejora, j.nombre); }
    return { id: j.id, nombre: j.nombre, estrellas: estrellasJuez(s), valor: s, positivo: c.positivo, positivos: c.positivos, mejora: c.mejora };
  });
  const puntos = jueces.reduce((a, j) => a + j.estrellas, 0);
  const algo = puestas(atuendo).length > 0;
  // El consejo: la mejora del juez que dio menos estrellas (si no tiene, la del siguiente)
  const orden = [...jueces].sort((a, b) => a.valor - b.valor);
  const conMejora = orden.find((j) => j.mejora);
  return { componentes: k, jueces, puntos, estrellas: estrellasNoli(puntos, algo), consejo: conMejora ? conMejora.mejora : "¡No le cambiaría nada!" };
}
