// Azar con semilla (mulberry32). Copiado en el juego (cada juego es una isla).
// La bolsa de Mi Casita no lo usa: es fija. Queda por si un pedido futuro lo necesita.

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
