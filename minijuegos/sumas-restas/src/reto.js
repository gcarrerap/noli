// Reto del día: el mismo en cualquier dispositivo (la semilla es la fecha) y rota entre tres tipos.
import { rngConSemilla, uno } from "./rng.js";
import { nivel as datosNivel } from "./niveles.js";

export const TIPOS_RETO = {
  contrarreloj: { nombre: "Contrarreloj", meta: "¿Cuántas resuelves en 60 segundos?", segundos: 60 },
  sinErrores: { nombre: "Sin errores", meta: "Resuelve 10 seguidas sin fallar.", seguidas: 10 },
  palabras: { nombre: "Problemas con palabras", meta: "Lee y resuelve 5 problemas. Necesitas 4 bien.", cuantos: 5, necesita: 4 },
};
const ORDEN = ["contrarreloj", "sinErrores", "palabras"];

const diaNumero = (fecha) => { const [y, m, d] = fecha.split("-").map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };

// nivelActual: el nivel más alto desbloqueado. El reto usa el último que ya practicó (un nivel abajo si el
// actual es nuevo), para que sea un reto de velocidad y lectura, no de algo que todavía no sabe.
export function retoDelDia(fecha, nivelActual) {
  const tipo = ORDEN[diaNumero(fecha) % ORDEN.length];
  const n = Math.max(1, nivelActual - (nivelActual > 1 ? 1 : 0));
  const rnd = rngConSemilla("noli-reto-" + fecha);
  const reto = { fecha, tipo, n, ...TIPOS_RETO[tipo] };
  // Contrarreloj y sin errores: una lista larga de problemas (se juegan los que alcancen)
  if (tipo === "palabras") reto.problemas = Array.from({ length: reto.cuantos }, () => problemaConPalabras(rnd, n));
  else reto.problemas = Array.from({ length: 80 }, () => ({ p: datosNivel(n).gen(rnd), n }));
  // La meta del contrarreloj depende del nivel: lo que alcanzaría con calma (60 s / límite del nivel)
  if (tipo === "contrarreloj") reto.objetivo = Math.max(5, Math.round(60 / datosNivel(n).limite));
  return reto;
}

// ---------- Problemas con palabras ----------

const NOMBRES = ["Noelia", "Sofía", "Mateo", "Lucía", "Diego", "Valentina", "Emilio", "Camila"];
const COSAS = [
  { sg: "canica", pl: "canicas", f: true }, { sg: "galleta", pl: "galletas", f: true }, { sg: "estampa", pl: "estampas", f: true },
  { sg: "flor", pl: "flores", f: true }, { sg: "globo", pl: "globos", f: false }, { sg: "lápiz", pl: "lápices", f: false },
  { sg: "dulce", pl: "dulces", f: false }, { sg: "libro", pl: "libros", f: false },
];
const cuantos = (c) => (c.f ? "¿Cuántas" : "¿Cuántos");
const de = (n, c) => `${n} ${n === 1 ? c.sg : c.pl}`;

// Toma un problema del nivel (solo los que piden el resultado) y lo cuenta como historia
export function problemaConPalabras(rnd, n) {
  // Los niveles de "número que falta" se cuentan con el nivel anterior (la historia ya es el reto)
  if (datosNivel(n).faltante) n -= 1;
  const p = datosNivel(n).gen(rnd);
  const quien = uno(rnd, NOMBRES), otro = uno(rnd, NOMBRES.filter((x) => x !== quien)), c = uno(rnd, COSAS);
  const plantillas = p.op === "+" ? [
    `${quien} tiene ${de(p.a, c)}. ${otro} le da ${p.b} más. ${cuantos(c)} ${c.pl} tiene ${quien} ahora?`,
    `En una caja hay ${de(p.a, c)} y en otra hay ${p.b}. ${cuantos(c)} ${c.pl} hay en total?`,
    `${quien} juntó ${de(p.a, c)} en la mañana y ${p.b} en la tarde. ${cuantos(c)} juntó en todo el día?`,
  ] : [
    `${quien} tiene ${de(p.a, c)} y le regala ${p.b} a ${otro}. ${cuantos(c)} ${c.pl} le quedan?`,
    `Había ${de(p.a, c)} en la mesa. ${quien} se llevó ${p.b}. ${cuantos(c)} quedaron en la mesa?`,
    `${quien} tiene ${de(p.a, c)} y ${otro} tiene ${p.b}. ${cuantos(c)} ${c.pl} más tiene ${quien}?`,
  ];
  return { p, n, texto: uno(rnd, plantillas) };
}
