// Lógica pura de la Biblioteca (sin DOM): qué capítulos se pueden leer, dónde va la lectura, qué palabra
// suena en cada instante y cómo se guarda el progreso. Se prueba en Node (tests/biblioteca.test.js).

// Mientras no existan los libros escondidos en el mundo (#103) todos los capítulos están abiertos.
// Con la búsqueda activa, solo los que Noelia encontró (datos.encontrados).
export const BUSQUEDA = false;

export const MODOS = ["leeme", "yo"];  // Léemelo (narra y pasa de página sola) · Yo leo (sin voz; tocar una palabra la dice)

export function datosNuevos() {
  return { v: 1, libros: {} };
}

// Progreso de un libro: { pos: { c, p }, leidos: [n…], encontrados: [n…], modo, despacio }
export function progresoDe(datos, idLibro) {
  const d = datos && typeof datos === "object" ? datos : datosNuevos();
  const pr = (d.libros && d.libros[idLibro]) || {};
  return {
    pos: pr.pos && Number.isInteger(pr.pos.c) && Number.isInteger(pr.pos.p) ? { c: pr.pos.c, p: pr.pos.p } : null,
    leidos: Array.isArray(pr.leidos) ? pr.leidos.filter(Number.isInteger) : [],
    encontrados: Array.isArray(pr.encontrados) ? pr.encontrados.filter(Number.isInteger) : [],
    modo: MODOS.includes(pr.modo) ? pr.modo : "leeme",
    despacio: pr.despacio === true,
    guia: pr.guia === true,   // ya vio la guía de la primera vez
  };
}

// Guarda el progreso de un libro sin perder lo demás que haya en los datos (otros libros, lo que el mundo anotó).
export function conProgreso(datos, idLibro, pr) {
  const d = datos && typeof datos === "object" ? datos : datosNuevos();
  const antes = (d.libros && d.libros[idLibro]) || {};
  return { ...d, v: 1, libros: { ...(d.libros || {}), [idLibro]: { ...antes, ...pr } } };
}

export function abierto(libro, pr, n, busqueda = BUSQUEDA) {
  if (!libro.capitulos.some((c) => c.n === n)) return false;
  return !busqueda || pr.encontrados.includes(n);
}

export function capitulo(libro, n) {
  return libro.capitulos.find((c) => c.n === n) || null;
}

// Página siguiente/anterior dentro del capítulo. null si se sale del capítulo.
export function mover(libro, pos, paso) {
  const c = capitulo(libro, pos.c);
  if (!c) return null;
  const p = pos.p + paso;
  return p >= 0 && p < c.paginas.length ? { c: pos.c, p } : null;
}

// Dónde seguir leyendo: la última página guardada si su capítulo está abierto; si no, el primer capítulo abierto
// que no ha terminado (o el primero abierto).
export function dondeSeguir(libro, pr, busqueda = BUSQUEDA) {
  if (pr.pos && abierto(libro, pr, pr.pos.c, busqueda) && capitulo(libro, pr.pos.c).paginas[pr.pos.p]) return pr.pos;
  const abiertos = libro.capitulos.filter((c) => abierto(libro, pr, c.n, busqueda));
  const c = abiertos.find((x) => !pr.leidos.includes(x.n)) || abiertos[0];
  return c ? { c: c.n, p: 0 } : null;
}

// Todas las palabras con tiempo de una página, en orden: { o: índice de oración, w: índice de palabra, t0, t1 }
export function palabrasConTiempo(pagina) {
  const out = [];
  let o = 0;
  for (const par of pagina.parrafos) {
    for (const or of par) {
      or.palabras.forEach((p, w) => { if (typeof p.t0 === "number") out.push({ o, w, t0: p.t0, t1: p.t1 }); });
      o++;
    }
  }
  return out;
}

// Índice (en la lista de palabrasConTiempo) de la palabra que suena en el instante t, o -1.
// Entre dos palabras se queda la anterior encendida, para que la luz no parpadee.
export function palabraEn(lista, t) {
  let a = 0, b = lista.length - 1, r = -1;
  while (a <= b) {
    const m = (a + b) >> 1;
    if (lista[m].t0 <= t) { r = m; a = m + 1; } else b = m - 1;
  }
  if (r < 0) return -1;
  const sig = lista[r + 1];
  if (t > lista[r].t1 + 0.6 && (!sig || t < sig.t0)) return -1;  // pausa larga entre oraciones: nada encendido
  return r;
}

// Un capítulo se termina al llegar a su última página. Devuelve los leídos nuevos (o los mismos).
export function marcarLeido(pr, n) {
  return pr.leidos.includes(n) ? pr.leidos : [...pr.leidos, n].sort((a, b) => a - b);
}

export function contarPalabras(libro) {
  let n = 0;
  for (const c of libro.capitulos) for (const p of c.paginas) for (const par of p.parrafos) for (const o of par) n += o.palabras.length;
  return n;
}
