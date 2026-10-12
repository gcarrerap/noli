// Reto del día. La semilla es la fecha: el mismo día da el mismo reto. Sin reloj.
// «Fase de hoy»: la fase REAL de la Luna esa noche (calculada, sin internet). 3 preguntas; necesita 2.
// «Palabra espacial»: 6 palabras para emparejar con su dibujo; necesita 5 a la primera.
import { rngConSemilla, hash, revolver } from "./rng.js";
import { faseDe, mod8 } from "./luna.js";
import { crearPalabra } from "./mision.js";
import { sumarDias } from "./progreso.js";

export const RETOS = {
  fase: { tipo: "fase", nombre: "Fase de hoy", meta: "3 preguntas sobre la Luna de esta noche. Necesitas 2.", items: 3, necesita: 2 },
  palabra: { tipo: "palabra", nombre: "Palabra espacial", meta: "Empareja 6 palabras con su dibujo. Necesitas 5 a la primera.", items: 6, necesita: 5 },
};

export const tipoDelDia = (fecha) => (hash("luna-" + fecha) % 2 ? "palabra" : "fase");

// Cuántos días antes (o después, con signo) la fase fue `quiero`; se prueban primero los de `orden`.
function diasHasta(fecha, quiero, orden) {
  for (const n of orden) if (faseDe(sumarDias(fecha, n)) === quiero) return n;
  return orden[0];
}

// Opciones: la buena primero y luego las malas, sin repetir; se revuelven al final.
function opciones(rnd, buena, malas) {
  const lista = [buena, ...[...new Set(malas.map(mod8))].filter((f) => f !== buena).slice(0, 2)];
  const rev = revolver(rnd, lista);
  return { opciones: rev, buena: rev.indexOf(buena) };
}

export function retoFase(fecha, rnd) {
  const hoy = faseDe(fecha);
  const atras = diasHasta(fecha, mod8(hoy - 2), [-7, -6, -8, -5, -9]);
  const antes = faseDe(sumarDias(fecha, atras));
  const adelante = diasHasta(fecha, mod8(hoy + 4), [14, 15, 13, 16]);
  const despues = faseDe(sumarDias(fecha, adelante));
  return [
    { modo: "dibujo", muestra: antes, dias: -atras, texto: `Hace ${-atras} días la Luna se veía así. ¿Cómo se ve hoy?`,
      ...opciones(rnd, hoy, [antes, hoy + 4, hoy - 4, hoy + 2]) },
    { modo: "dibujo", muestra: hoy, dias: adelante, texto: `Hoy se ve así. ¿Cómo se verá en ${adelante} días?`,
      ...opciones(rnd, despues, [hoy, despues + 2, despues - 2]) },
    { modo: "nombre", muestra: hoy, texto: "¿Cómo se llama la fase de hoy en inglés?",
      ...opciones(rnd, hoy, [hoy + 4, hoy + 2, hoy - 2]) },
  ];
}

export function retoPalabra(fecha, vocab, rnd) {
  return revolver(rnd, vocab.palabras.map((p) => p.id)).slice(0, RETOS.palabra.items).map((id) => crearPalabra(id, vocab, rnd));
}

export function retoDelDia(fecha, vocab) {
  const tipo = tipoDelDia(fecha);
  const rnd = rngConSemilla("noli-luna-reto-" + fecha);
  const items = tipo === "fase" ? retoFase(fecha, rnd) : retoPalabra(fecha, vocab, rnd);
  return { fecha, ...RETOS[tipo], fase: faseDe(fecha), items };
}

export const retoCumplido = (reto, aciertos) => aciertos >= reto.necesita;
