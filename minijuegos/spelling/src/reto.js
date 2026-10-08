// Reto del día: sale igual en cualquier dispositivo con el mismo progreso (la semilla es la fecha) y rota entre
// tres tipos. Usa palabras de las listas que ya practicó, para que sea un reto y no algo nuevo.
import { rngConSemilla, revolver, uno } from "./rng.js";
import { LISTAS, ETAPAS, paso as datosPaso } from "./palabras.js";
import { faltas } from "./faltas.js";

export const TIPOS_RETO = {
  abeja: { nombre: "Spelling bee", meta: "Escucha 8 palabras y deletréalas. Necesitas 6 bien.", cuantas: 8, necesita: 6 },
  detective: { nombre: "Detective", meta: "En cada frase hay una palabra mal escrita. ¡Encuéntrala! Necesitas 4 de 5.", cuantas: 5, necesita: 4 },
  contrarreloj: { nombre: "Contrarreloj", meta: "¿Cuántas palabras escoges bien en 60 segundos?", segundos: 60, objetivo: 7 },
};
const ORDEN = ["abeja", "detective", "contrarreloj"];

const diaNumero = (fecha) => { const [y, m, d] = fecha.split("-").map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };

// Hasta qué lista llega el reto y en qué etapa se juega el spelling bee.
// Con el paso actual i: las listas que ya vio (la actual cuenta si ya pasó de "Escoge"); el bee se juega en la
// etapa más alta que ya abrió en alguna lista (escribir, en cuanto llegó a "Escribe" de la lista 1).
export function alcance(i) {
  const { lista, etapa } = datosPaso(i);
  const k = ETAPAS.indexOf(etapa);
  const hasta = k > 0 || lista === 1 ? lista : lista - 1;
  const modo = i >= 2 ? "escribe" : etapa.id;
  // Para escribir, solo listas en las que ya llegó a "Escribe"
  const hastaBee = modo === "escribe" ? (k === 2 ? lista : Math.max(1, lista - 1)) : hasta;
  return { hasta, hastaBee, modo };
}

const palabrasHasta = (n, desde = 1) => LISTAS.filter((l) => l.n >= desde && l.n <= n).flatMap((l) => l.palabras.map((p) => ({ ...p, lista: l.n })));

export function retoDelDia(fecha, i) {
  const tipo = ORDEN[diaNumero(fecha) % ORDEN.length];
  const rnd = rngConSemilla("noli-spelling-" + fecha);
  const { hasta, hastaBee, modo } = alcance(i);
  const reto = { fecha, tipo, ...TIPOS_RETO[tipo] };
  if (tipo === "abeja") {
    // Las listas más recientes pesan más: hasta 3 listas hacia atrás
    reto.modo = modo;
    reto.palabras = revolver(rnd, palabrasHasta(hastaBee, hastaBee - 2)).slice(0, reto.cuantas);
  } else if (tipo === "detective") {
    // La palabra mal escrita es una falta típica (no letras al revés: eso no se nota leyendo)
    reto.frases = revolver(rnd, palabrasHasta(hasta)).slice(0, reto.cuantas).map((p) => {
      const fs = faltas(p.palabra), buenas = fs.filter((f) => f.nivel <= 2);
      return { ...p, falta: uno(rnd, buenas.length ? buenas : fs).texto };
    });
  } else {
    // Una lista larga (se juegan las que alcancen en 60 s), sin repetir seguido
    reto.modo = "escoge";
    const base = palabrasHasta(hasta, hasta - 3);
    reto.palabras = [0, 1, 2, 3, 4].flatMap(() => revolver(rnd, base));
  }
  return reto;
}
