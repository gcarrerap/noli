// Partir oraciones y calcular el resaltado palabra por palabra.
// El silencio inicial (0,45 s) es el colchón de las TVs: la primera palabra empieza después.

export const SILENCIO_MS = 450;

export function palabrasDe(oracion) {
  return String(oracion ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, ""))
    .filter(Boolean);
}

export function clavePalabra(w) {
  return String(w ?? "").toLowerCase().replace(/[^a-z']/g, "");
}

export function cuentaPalabras(oracion) {
  return palabrasDe(oracion).length;
}

// Inicios (ms) de cada palabra, repartidos por largo después del silencio.
export function tiemposPalabra(palabras, duracionMs, silencioMs = SILENCIO_MS) {
  const lista = [...palabras];
  const pesos = lista.map((p) => Math.max(1, String(p).length));
  const total = pesos.reduce((s, n) => s + n, 0) || 1;
  const usable = Math.max(0, duracionMs - silencioMs);
  let t = Math.min(silencioMs, Math.max(0, duracionMs));
  return pesos.map((p) => {
    const inicio = t;
    t += (usable * p) / total;
    return inicio;
  });
}

// Si la voz falla, la frase se queda este tiempo (entre 2 y 3 s) en vez de saltar a la siguiente.
export function duracionSiFalla(oracion) {
  const n = Math.max(1, palabrasDe(oracion).length);
  return Math.min(3000, Math.max(2000, 450 + n * 280));
}

// "fin" pasa a la frase siguiente. Un fallo se queda en la misma y espera el reloj.
export function pasoLectura(frases, indice, evento) {
  const lista = frases || [];
  if (evento === "fin") {
    const i = indice + 1;
    return { indice: i, seguir: i < lista.length, saltar: false };
  }
  const frase = lista[indice] || "";
  const esperarMs = duracionSiFalla(frase);
  return {
    indice,
    seguir: false,
    saltar: false,
    esperarMs,
    tiempos: tiemposPalabra(palabrasDe(frase), esperarMs),
  };
}

// Índice de la palabra que suena en `ms` (−1 si todavía es el silencio).
export function indiceHablado(tiempos, ms) {
  let i = -1;
  for (let k = 0; k < tiempos.length; k++) if (ms >= tiempos[k]) i = k;
  return i;
}
