// Opciones para contestar: la correcta y tres incorrectas. Las incorrectas son primero los errores típicos de
// ese tipo de problema (para poder explicarle qué pasó si escoge una), y luego las cercanas (±1, ±2, ±10).
import { respuesta } from "./niveles.js";
import { revolver } from "./rng.js";

const u = (n) => n % 10;
const d = (n) => Math.floor(n / 10);

// Errores típicos: [{ valor, motivo }]
export function erroresTipicos(p) {
  const e = [];
  const add = (valor, motivo) => e.push({ valor, motivo });
  if (p.falta === "r") {
    if (p.op === "+") {
      add(p.a - p.b, "Restaste en lugar de sumar.");
      if (u(p.a) + u(p.b) >= 10 && (p.a >= 10 || p.b >= 10)) {
        add(p.r - 10, "Olvidaste llevar 1 a las decenas.");
        add(p.r + 10, "Llevaste de más a las decenas.");
      }
      if (p.a >= 10 && p.b < 10 && u(p.a) + p.b < 10) add(p.a + p.b * 10, "Sumaste las unidades a las decenas.");
    } else {
      add(p.a + p.b, "Sumaste en lugar de restar.");
      if (u(p.a) < u(p.b) && p.a >= 20) {
        add((d(p.a) - d(p.b)) * 10 + (u(p.b) - u(p.a)), "En las unidades restaste el chico del grande; hay que pedir prestado.");
        add(p.r + 10, "Pediste prestado pero no le quitaste 1 a las decenas.");
      }
      if (p.a >= 10 && p.b < 10 && u(p.a) >= p.b) add(p.a - p.b * 10, "Le quitaste a las decenas en lugar de a las unidades.");
    }
  } else {
    // Número que falta: el error más común es contestar el total, o hacer la operación al revés
    if (p.op === "+") { add(p.r, "Ese es el total; busca cuánto falta para llegar."); add(p.r + (p.falta === "a" ? p.b : p.a), "Sumaste los dos números; hay que ver cuánto falta."); }
    else if (p.falta === "b") { add(p.a + p.r, "Sumaste; hay que ver cuánto se quitó."); add(p.r, "Ese es lo que queda; busca cuánto se quitó."); }
    else { add(Math.abs(p.r - p.b), "Restaste; piensa: ¿de cuánto quitas " + p.b + " para que queden " + p.r + "?"); add(p.r, "Ese es lo que queda; busca con cuánto empezamos."); }
  }
  return e;
}

// Devuelve [{ valor, correcta, motivo }] revueltas: 4 distintas, ninguna negativa
export function opciones(p, rnd, cuantas = 4) {
  const ok = respuesta(p);
  const usadas = new Set([ok]);
  const malas = [];
  const tomar = (valor, motivo = null) => {
    if (malas.length >= cuantas - 1 || valor < 0 || !Number.isInteger(valor) || usadas.has(valor)) return;
    usadas.add(valor); malas.push({ valor, correcta: false, motivo });
  };
  // Hasta 2 errores típicos (los más informativos), al azar entre los que haya
  for (const e of revolver(rnd, erroresTipicos(p)).slice(0, 2)) tomar(e.valor, e.motivo);
  const cerca = ok >= 20 ? [1, -1, 10, -10, 2, -2] : [1, -1, 2, -2, 3, -3];
  for (const c of revolver(rnd, cerca)) tomar(ok + c);
  for (let k = 4; malas.length < cuantas - 1; k++) { tomar(ok + k); tomar(ok - k); } // por si acaso (ok pequeño)
  return revolver(rnd, [{ valor: ok, correcta: true, motivo: null }, ...malas]);
}
