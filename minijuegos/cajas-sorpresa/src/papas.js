// La puerta de Para papás: una multiplicación de una cifra, 6–9 × 6–9, con tres opciones.
// No se guarda: al cerrar el juego hay que volver a acertar.

export function preguntaPapas(rng) {
  const dado = () => 6 + Math.floor(rng() * 4);
  const a = dado();
  const b = dado();
  const r = a * b;
  const opciones = [r, r + a, r - b];
  for (let i = opciones.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = opciones[i];
    opciones[i] = opciones[j];
    opciones[j] = t;
  }
  return { a, b, r, opciones };
}

export function aciertoPapas(pregunta, valor) {
  return !!pregunta && Number(valor) === pregunta.r;
}
