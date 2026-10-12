// La gráfica es una lista de valores, uno por animal, en el orden de los recintos. Puro.
// Cada ▲ o + sube `escala` (1, o 2 en «De 2 en 2»); nunca baja de 0 ni pasa de `max`.

export function vacia(k) {
  return Array.from({ length: k }, () => 0);
}

export function limitar(v, escala, max) {
  const e = escala > 0 ? escala : 1;
  const r = Math.round(v / e) * e;
  return Math.max(0, Math.min(max, r));
}

// Sube (delta = 1) o baja (delta = -1) una columna un paso de la escala.
export function mover(valores, i, delta, escala, max) {
  if (i < 0 || i >= valores.length) return valores;
  const v = limitar(valores[i] + Math.sign(delta) * escala, escala, max);
  if (v === valores[i]) return valores;
  const out = [...valores];
  out[i] = v;
  return out;
}

// Índices de las columnas que no coinciden con lo contado.
export function errores(valores, cuentas) {
  const out = [];
  cuentas.forEach((c, i) => { if (valores[i] !== c) out.push(i); });
  return out;
}

export const coincide = (valores, cuentas) => valores.length === cuentas.length && errores(valores, cuentas).length === 0;

// Las rayas del eje: de 0 a max, de `escala` en `escala`. Con escala 2 son 0, 2, 4…
export function marcas(escala, max) {
  const e = escala > 0 ? escala : 1;
  const out = [];
  for (let v = 0; v <= max; v += e) out.push(v);
  return out;
}

// Para el detective: la gráfica ya hecha con `n` columnas equivocadas (0, 1 o 2).
// Cada error se corre 1 o 2 pasos de la escala, sin pasar de 0 ni de max, y sin quedar en 0.
export function conErrores(cuentas, n, rnd, escala, max) {
  const valores = [...cuentas];
  const idx = cuentas.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  const elegidos = idx.slice(0, Math.max(0, Math.min(n, cuentas.length)));
  for (const i of elegidos) {
    const c = cuentas[i];
    const pasos = 1 + Math.floor(rnd() * 2);
    const arriba = c + pasos * escala <= max;
    const abajo = c - pasos * escala >= escala;
    let v;
    if (arriba && abajo) v = rnd() < 0.5 ? c + pasos * escala : c - pasos * escala;
    else if (arriba) v = c + pasos * escala;
    else if (abajo) v = c - pasos * escala;
    else v = c + escala <= max ? c + escala : c - escala;
    valores[i] = v;
  }
  return valores;
}
