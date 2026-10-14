// Libros escondidos en el mundo (#103): cada capítulo de un libro de la Biblioteca es un libro mágico escondido.
// Lógica pura (sin DOM ni Three.js). Los datos viven en mundo/mundo.json → libros; lo encontrado se guarda en los datos
// de la Biblioteca (datos.libros.<id>.encontrados), que es quien lo usa para abrir capítulos. El catálogo es el dueño
// del almacenamiento (DESIGN §4), así que el mundo puede escribir ahí con actions.guardarDatos("biblioteca", …).
//
// Reglas: aparecen en orden (solo está en el mundo el siguiente capítulo que falta), a lo más `porDia` por día, y nunca
// se atora: a los `pistaSeg` segundos buscando se ve una columna de luz tenue, y a los `faroSeg` una brillante.

/** Revisa mundo.libros. Devuelve una lista de errores (vacía si está bien). */
export function revisarLibros(mundo) {
  const L = mundo.libros;
  if (!L) return [];
  const e = [];
  const plats = new Set((mundo.plataformas || []).map((p) => p.id));
  if (!L.libro || !L.juego) e.push("libros: falta libro o juego");
  if (!(L.porDia >= 1)) e.push("libros: porDia debe ser 1 o más");
  const caps = (L.lugares || []).map((l) => l.capitulo);
  caps.forEach((n, i) => { if (n !== i + 1) e.push(`libros: el lugar ${i + 1} debe ser el capítulo ${i + 1} (dice ${n})`); });
  for (const l of L.lugares || []) {
    if (l.en ? !plats.has(l.en) : !(Number.isFinite(l.x) && Number.isFinite(l.z))) e.push(`libros: capítulo ${l.capitulo} sin lugar válido`);
  }
  return e;
}

/** Posición de cada libro: [{ n, x, z, y }] (sobre su plataforma o en el piso) */
export function librosDe(mundo) {
  const L = mundo.libros;
  if (!L) return [];
  const plats = new Map((mundo.plataformas || []).map((p) => [p.id, p]));
  return (L.lugares || []).map((l) => {
    const p = l.en && plats.get(l.en);
    return p ? { n: l.capitulo, x: p.x, z: p.z, y: p.alto } : { n: l.capitulo, x: l.x, z: l.z, y: 0 };
  });
}

const enteros = (a) => (Array.isArray(a) ? a.filter(Number.isInteger) : []);

/**
 * Qué toca buscar hoy. datos: los de la Biblioteca. Un capítulo cuenta como encontrado si se encontró en el mundo, si ya
 * se leyó o si está leyéndolo (para que activar la búsqueda nunca cierre lo que ya tenía abierto).
 * @returns {{ tiene: Set<number>, siguiente: number|null, hoy: number, lleno: boolean, completo: boolean }}
 */
export function estadoLibros(datos, idLibro, total, dia, porDia) {
  const pr = (datos && datos.libros && datos.libros[idLibro]) || {};
  const tiene = new Set([...enteros(pr.encontrados), ...enteros(pr.leidos)]);
  if (pr.pos && Number.isInteger(pr.pos.c)) tiene.add(pr.pos.c);
  const hoy = pr.hoy && pr.hoy.dia === dia && Number.isInteger(pr.hoy.n) ? pr.hoy.n : 0;
  let falta = null;
  for (let n = 1; n <= total; n++) if (!tiene.has(n)) { falta = n; break; }
  const lleno = falta !== null && hoy >= porDia;
  return { tiene, siguiente: lleno ? null : falta, hoy, lleno, completo: falta === null };
}

/** Los datos de la Biblioteca con el capítulo n encontrado hoy (sin perder lo demás). */
export function conHallazgo(datos, idLibro, n, dia) {
  const d = datos && typeof datos === "object" ? datos : { v: 1, libros: {} };
  const pr = (d.libros && d.libros[idLibro]) || {};
  const enc = enteros(pr.encontrados);
  const hoy = pr.hoy && pr.hoy.dia === dia && Number.isInteger(pr.hoy.n) ? pr.hoy.n : 0;
  const nuevo = {
    ...pr,
    encontrados: enc.includes(n) ? enc : [...enc, n].sort((a, b) => a - b),
    hoy: { dia, n: enc.includes(n) ? hoy : hoy + 1 },
  };
  return { ...d, v: 1, libros: { ...(d.libros || {}), [idLibro]: nuevo } };
}

/** 0: sin pista · 1: luz tenue · 2: faro brillante, según cuántos segundos lleva buscando ese libro */
export function nivelPista(segundos, L) {
  if (segundos >= (L.faroSeg || 360)) return 2;
  if (segundos >= (L.pistaSeg || 180)) return 1;
  return 0;
}

/** ¿El personaje está tocando el libro? (igual que un cristal: cerca y a su altura) */
export function libroTocado(pos, libro) {
  return !!libro && Math.hypot(pos.x - libro.x, pos.z - libro.z) < 0.8 && pos.y > libro.y - 0.4 && pos.y < libro.y + 1.2;
}
