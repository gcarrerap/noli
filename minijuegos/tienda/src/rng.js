// Azar con semilla (mulberry32): el reto del día sale igual en cualquier dispositivo y las pruebas son repetibles.

export function rngConSemilla(semilla) {
  let a = typeof semilla === "string" ? hash(semilla) : semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export const entre = (rnd, min, max) => min + Math.floor(rnd() * (max - min + 1));
export const uno = (rnd, lista) => lista[Math.floor(rnd() * lista.length)];

export function revolver(rnd, lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
