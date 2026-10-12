// Preguntas del cuidador. Puro. La respuesta buena siempre se calcula de la gráfica (los valores), no se guarda.
// Tipos: cuantos, mas, menos, difMas, difMenos, juntos, total.
// `cats` son los animales de la visita (objetos de animales.js) en el orden de las columnas.
import { cuantosPara, nombreDe } from "./animales.js";

export const TIPOS = ["cuantos", "mas", "menos", "difMas", "difMenos", "juntos", "total"];

const suma = (xs) => xs.reduce((s, x) => s + x, 0);

// La respuesta de la pregunta leída en la gráfica: un número, o el índice de la columna en «mas» y «menos».
export function respuesta(p, valores) {
  const v = (i) => valores[i] | 0;
  switch (p.tipo) {
    case "cuantos": return v(p.ids[0]);
    case "mas": return valores.reduce((m, x, i) => (x > valores[m] ? i : m), 0);
    case "menos": return valores.reduce((m, x, i) => (x < valores[m] ? i : m), 0);
    case "difMas": return v(p.ids[0]) - v(p.ids[1]);
    case "difMenos": return v(p.ids[1]) - v(p.ids[0]);
    case "juntos": return suma(p.ids.map(v));
    case "total": return suma(valores.map((x) => x | 0));
    default: return null;
  }
}

export const esCorrecta = (p, valores, eleccion) => eleccion === respuesta(p, valores);

function textos(p, cats) {
  const a = cats[p.ids[0]], b = cats[p.ids[1]];
  switch (p.tipo) {
    case "cuantos": return { texto: `¿${cuantosPara([a])} ${a.plural} hay?`, pista: `Mira la columna de ${a.plural}.` };
    case "mas": return { texto: "¿Quién necesita más comida?", pista: "Los que son más. Busca la columna más alta." };
    case "menos": return { texto: "¿Quién necesita menos comida?", pista: "Los que son menos. Busca la columna más baja." };
    case "difMas": return {
      texto: `¿${cuantosPara([a])} ${a.plural} más que ${b.plural} hay?`,
      pista: `Compara: ¿cuánto más alta es la de ${a.plural}?`,
    };
    case "difMenos": return {
      texto: `¿${cuantosPara([a])} ${a.plural} menos que ${b.plural} hay?`,
      pista: `Compara: ¿cuánto le falta a la de ${a.plural}?`,
    };
    case "juntos": {
      const lista = p.ids.map((i) => cats[i]);
      const nombres = lista.map((x) => x.plural);
      const unidos = nombres.length === 2 ? `${nombres[0]} y ${nombres[1]}` : `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`;
      return { texto: `¿${cuantosPara(lista)} ${unidos} hay en total?`, pista: "Junta las columnas: suma." };
    }
    case "total": return { texto: "¿Cuántos animales hay en total?", pista: "Suma todas las columnas." };
    default: return { texto: "", pista: "" };
  }
}

// Opciones de número: la buena y dos errores típicos (la suma en vez de la resta, una sola columna, uno de más).
function opcionesNumero(p, valores, escala, rnd) {
  const r = respuesta(p, valores);
  const v = (i) => valores[i];
  const tipicos = [];
  if (p.tipo === "cuantos") tipicos.push(r + escala, r - escala, ...valores.filter((x, i) => i !== p.ids[0]));
  if (p.tipo === "difMas" || p.tipo === "difMenos") tipicos.push(v(p.ids[0]) + v(p.ids[1]), Math.max(v(p.ids[0]), v(p.ids[1])), r + escala, r - escala);
  if (p.tipo === "juntos" || p.tipo === "total") {
    tipicos.push(r + escala, r - escala);
    if (p.ids.length === 2) tipicos.push(Math.abs(v(p.ids[0]) - v(p.ids[1])), Math.max(v(p.ids[0]), v(p.ids[1])));
    else tipicos.push(r - valores[valores.length - 1], r + 10);
  }
  const ops = [r];
  const prueba = (x) => { if (ops.length < 3 && Number.isInteger(x) && x > 0 && !ops.includes(x)) ops.push(x); };
  const mezclados = tipicos.map((x) => [rnd(), x]).sort((m, n) => m[0] - n[0]).map((m) => m[1]);
  // Primero uno de más o de menos (el error más común), luego los demás.
  prueba(rnd() < 0.5 ? r + escala : r - escala);
  mezclados.forEach(prueba);
  for (let k = 1; ops.length < 3; k++) { prueba(r + k * escala); prueba(r - k * escala); }
  return ops.sort((m, n) => m - n);
}

// Crea la pregunta con sus opciones. `valores` son las cuentas de la visita (la gráfica bien hecha).
export function crearPregunta(tipo, ids, cats, valores, escala, rnd) {
  const p = { tipo, ids: [...ids] };
  const t = textos(p, cats);
  p.texto = t.texto;
  p.leer = t.texto;
  p.pista = t.pista;
  if (tipo === "mas" || tipo === "menos") {
    p.forma = "animal";
    p.opciones = cats.map((_, i) => i);
  } else {
    p.forma = "numero";
    p.opciones = opcionesNumero(p, valores, escala, rnd);
  }
  return p;
}

// Lo que se enseña cuando ya se equivocó dos veces: cómo se lee la gráfica.
export function explicacion(p, cats, valores) {
  const r = respuesta(p, valores);
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const de = (i) => `${cap(cats[i].plural)}: ${valores[i]}`;
  switch (p.tipo) {
    case "cuantos": {
      const a = cats[p.ids[0]];
      const t = `Hay ${valores[p.ids[0]]} ${nombreDe(a, valores[p.ids[0]])}.`;
      return { texto: t, leer: t };
    }
    case "mas":
    case "menos": {
      const a = cats[r];
      const t = `${de(r)}. Es la columna más ${p.tipo === "mas" ? "alta" : "baja"}.`;
      return { texto: t, leer: `Los ${a.plural}: ${valores[r]}. Es la columna más ${p.tipo === "mas" ? "alta" : "baja"}.` };
    }
    case "difMas":
    case "difMenos": {
      const [i, j] = p.ids;
      const mayor = valores[i] >= valores[j] ? i : j, menor = mayor === i ? j : i;
      return {
        texto: `${de(i)}, ${cats[j].plural}: ${valores[j]}. ${valores[mayor]} − ${valores[menor]} = ${r}.`,
        leer: `${valores[mayor]} menos ${valores[menor]} son ${r}.`,
      };
    }
    case "juntos":
    case "total": {
      const ids = p.tipo === "total" ? valores.map((_, i) => i) : p.ids;
      const nums = ids.map((i) => valores[i]);
      return { texto: `${nums.join(" + ")} = ${r}.`, leer: `${nums.join(" más ")} son ${r}.` };
    }
    default: return { texto: "", leer: "" };
  }
}
