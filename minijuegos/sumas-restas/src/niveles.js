// Los niveles, en el orden de segundo grado: sumas y restas hasta 20 de memoria, luego hasta 100 con estrategias.
// Cada nivel tiene un generador puro gen(rnd) → problema, y un límite de tiempo (mediana, en segundos) para
// considerar que ya lo domina con fluidez.
//
// Un problema: { a, op: "+" | "-", b, r, falta: "r" | "a" | "b" }   (a op b = r; falta = lo que se pregunta)
import { entre, uno } from "./rng.js";

const suma = (a, b) => ({ a, op: "+", b, r: a + b, falta: "r" });
const resta = (a, b) => ({ a, op: "-", b, r: a - b, falta: "r" });
const u = (n) => n % 10;
const d = (n) => Math.floor(n / 10);

// ---------- Generadores por tipo ----------
const G = {
  sumaHasta10: (rnd) => { const a = entre(rnd, 1, 9); return suma(a, entre(rnd, 1, 10 - a)); },
  restaHasta10: (rnd) => { const a = entre(rnd, 2, 10); return resta(a, entre(rnd, 1, a)); },
  // Hasta 20 pasando el 10 (8 + 5): la estrategia es "hacer 10"
  sumaPasa10: (rnd) => { const a = entre(rnd, 2, 9); return suma(a, entre(rnd, 11 - a, 9)); },
  // Hasta 20 sin pasar el 10 (12 + 5)
  sumaSinPasar20: (rnd) => { const a = entre(rnd, 11, 18); return suma(a, entre(rnd, 1, 19 - a)); },
  // 13 − 5: las unidades de arriba son menores que lo que se quita
  restaPasa10: (rnd) => { const un = entre(rnd, 1, 8); return resta(10 + un, entre(rnd, un + 1, 9)); },
  restaSinPasar20: (rnd) => { const un = entre(rnd, 1, 9); return resta(10 + un, entre(rnd, 1, un)); },
  // Hasta 100 sin llevar
  decenas: (rnd) => { const a = entre(rnd, 1, 8); return suma(a * 10, entre(rnd, 1, 9 - a) * 10); },
  dosMasUno: (rnd) => { const a = entre(rnd, 2, 9) * 10 + entre(rnd, 0, 8); return suma(a, entre(rnd, 1, 9 - u(a))); },
  dosMasDecenas: (rnd) => { const a = entre(rnd, 1, 8) * 10 + entre(rnd, 1, 9); return suma(a, entre(rnd, 1, 9 - d(a)) * 10); },
  dosMasDosSinLlevar: (rnd) => {
    const a = entre(rnd, 1, 8) * 10 + entre(rnd, 0, 8);
    return suma(a, entre(rnd, 1, 9 - d(a)) * 10 + entre(rnd, 1, 9 - u(a)));
  },
  // Restas hasta 100 sin pedir prestado
  dosMenosUno: (rnd) => { const a = entre(rnd, 2, 9) * 10 + entre(rnd, 1, 9); return resta(a, entre(rnd, 1, u(a))); },
  dosMenosDecenas: (rnd) => { const a = entre(rnd, 2, 9) * 10 + entre(rnd, 0, 9); return resta(a, entre(rnd, 1, d(a) - 1) * 10); },
  dosMenosDosSinPedir: (rnd) => {
    const a = entre(rnd, 2, 9) * 10 + entre(rnd, 1, 9);
    return resta(a, entre(rnd, 1, d(a) - 1) * 10 + entre(rnd, 1, u(a)));
  },
  // Sumas llevando (38 + 7, 27 + 15)
  dosMasUnoLlevando: (rnd) => { const a = entre(rnd, 1, 8) * 10 + entre(rnd, 2, 9); return suma(a, entre(rnd, 10 - u(a), 9)); },
  dosMasDosLlevando: (rnd) => {
    const a = entre(rnd, 1, 7) * 10 + entre(rnd, 2, 9);
    return suma(a, entre(rnd, 1, 8 - d(a)) * 10 + entre(rnd, 10 - u(a), 9));
  },
  // Restas pidiendo prestado (42 − 7, 53 − 18)
  dosMenosUnoPidiendo: (rnd) => { const a = entre(rnd, 2, 9) * 10 + entre(rnd, 0, 8); return resta(a, entre(rnd, u(a) + 1, 9)); },
  dosMenosDosPidiendo: (rnd) => {
    const a = entre(rnd, 3, 9) * 10 + entre(rnd, 0, 8);
    return resta(a, entre(rnd, 1, d(a) - 2) * 10 + entre(rnd, u(a) + 1, 9));
  },
};

// Número que falta: se toma un problema y se pregunta por uno de los de la izquierda
function conFaltante(gen) {
  return (rnd) => { const p = gen(rnd); return { ...p, falta: rnd() < 0.5 ? "a" : "b" }; };
}
const mezcla = (...gens) => (rnd) => uno(rnd, gens)(rnd);

export const NIVELES = [
  { n: 1, nombre: "Sumas hasta 10", ejemplo: "3 + 4", limite: 5, gen: G.sumaHasta10, ayuda: "cuadros" },
  { n: 2, nombre: "Restas hasta 10", ejemplo: "9 − 3", limite: 6, gen: G.restaHasta10, ayuda: "cuadros" },
  { n: 3, nombre: "Sumas hasta 20", ejemplo: "8 + 5", limite: 7, gen: mezcla(G.sumaPasa10, G.sumaPasa10, G.sumaSinPasar20), ayuda: "cuadros" },
  { n: 4, nombre: "Restas hasta 20", ejemplo: "13 − 5", limite: 8, gen: mezcla(G.restaPasa10, G.restaPasa10, G.restaSinPasar20), ayuda: "cuadros" },
  { n: 5, nombre: "Sumas y restas hasta 20", ejemplo: "9 + 7, 15 − 8", limite: 8, gen: mezcla(G.sumaPasa10, G.restaPasa10, G.sumaSinPasar20, G.restaSinPasar20), ayuda: "cuadros" },
  { n: 6, nombre: "El número que falta", ejemplo: "□ + 6 = 14", limite: 10, faltante: true, gen: conFaltante(mezcla(G.sumaHasta10, G.sumaPasa10, G.restaPasa10)), ayuda: "cuadros" },
  { n: 7, nombre: "Decenas y unidades", ejemplo: "30 + 40, 23 + 5", limite: 10, gen: mezcla(G.decenas, G.dosMasUno, G.dosMasDecenas, G.dosMasDosSinLlevar), ayuda: "bloques" },
  { n: 8, nombre: "Restas hasta 100", ejemplo: "47 − 5, 68 − 30", limite: 10, gen: mezcla(G.dosMenosUno, G.dosMenosDecenas, G.dosMenosDosSinPedir), ayuda: "bloques" },
  { n: 9, nombre: "Sumas llevando", ejemplo: "38 + 7, 27 + 15", limite: 15, gen: mezcla(G.dosMasUnoLlevando, G.dosMasDosLlevando), ayuda: "bloques" },
  { n: 10, nombre: "Restas pidiendo prestado", ejemplo: "42 − 7, 53 − 18", limite: 15, gen: mezcla(G.dosMenosUnoPidiendo, G.dosMenosDosPidiendo), ayuda: "bloques" },
  { n: 11, nombre: "Sumas y restas hasta 100", ejemplo: "46 + 38, 71 − 26", limite: 15, gen: mezcla(G.dosMasDosLlevando, G.dosMenosDosPidiendo, G.dosMasDosSinLlevar, G.dosMenosDosSinPedir), ayuda: "bloques" },
  { n: 12, nombre: "El número que falta hasta 100", ejemplo: "□ + 25 = 60", limite: 18, faltante: true, gen: conFaltante(mezcla(G.dosMasDosSinLlevar, G.dosMasDosLlevando, G.dosMenosDosPidiendo)), ayuda: "bloques" },
];

export const nivel = (n) => NIVELES[Math.max(1, Math.min(NIVELES.length, n)) - 1];
export const TIPOS = G; // para las pruebas

// La respuesta que se pide y cómo se escribe el problema
export const respuesta = (p) => p[p.falta];
export const clave = (p) => `${p.a}${p.op}${p.b}${p.falta === "r" ? "" : ":" + p.falta}`;
export const SIGNO = { "+": "+", "-": "−" };
