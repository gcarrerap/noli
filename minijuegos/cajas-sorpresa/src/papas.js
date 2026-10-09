// La puerta de Para papás: una multiplicación de una cifra, 6–9 × 6–9, con tres opciones.
// No se guarda: al cerrar el juego hay que volver a acertar.
// La respuesta buena no es siempre el número del medio: a veces las dos malas
// son más altas, a veces más bajas, y el orden en pantalla se baraja.

export const PAPAS_FALLO_MS = 2000;

function barajar(lista, rng) {
  const a = lista.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

function cercano(r, delta, usados) {
  const paso = delta >= 0 ? 1 : -1;
  let n = r + delta;
  let guard = 0;
  while ((n === r || n <= 0 || usados.has(n)) && guard < 40) {
    n += paso;
    if (n <= 0) n = r + guard + 2;
    guard += 1;
  }
  usados.add(n);
  return n;
}

export function preguntaPapas(rng) {
  const a = 6 + Math.floor(rng() * 4);
  const b = 6 + Math.floor(rng() * 4);
  const r = a * b;
  const modo = Math.floor(rng() * 3);
  const d1 = 2 + Math.floor(rng() * 7);
  const d2 = 2 + Math.floor(rng() * 7);
  const usados = new Set([r]);
  let malos;
  if (modo === 0) malos = [cercano(r, d1, usados), cercano(r, d1 + d2, usados)];
  else if (modo === 1) malos = [cercano(r, -d1, usados), cercano(r, -(d1 + d2), usados)];
  else malos = [cercano(r, d1, usados), cercano(r, -d2, usados)];
  return { a, b, r, opciones: barajar([r, malos[0], malos[1]], rng) };
}

export function aciertoPapas(pregunta, valor) {
  return !!pregunta && Number(valor) === pregunta.r;
}

/**
 * Un OK en la pregunta. El foco inicial no está en una opción, así que el OK
 * repetido no elige. Tras un fallo nadie acepta otra respuesta hasta 2 s.
 * Solo un acierto, con el foco en una opción y el plazo cumplido, abre Para papás.
 */
export function pulsoPapas({ ahora, foco = "", valor, pregunta, hasta = 0 } = {}) {
  const t = Number(ahora) || 0;
  const plazo = Number(hasta) || 0;
  if (t < plazo) return { abre: false, hasta: plazo };
  if (foco !== "opcion") return { abre: false, hasta: plazo };
  if (aciertoPapas(pregunta, valor)) return { abre: true, hasta: plazo };
  return { abre: false, hasta: t + PAPAS_FALLO_MS };
}
