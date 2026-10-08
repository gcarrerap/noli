// Lógica pura del catálogo: materias para los filtros, filtrar y moverse entre tarjetas con flechas.

// Materias presentes, en el orden en que aparecen los juegos
export function materias(juegos) {
  return [...new Set(juegos.map((j) => j.materia))];
}

// materia null = todos
export function filtrar(juegos, materia) {
  return materia ? juegos.filter((j) => j.materia === materia) : juegos;
}

// Mueve el foco en una cuadrícula de `cols` columnas con `total` tarjetas. No da la vuelta: en la orilla se queda.
// Devuelve el índice nuevo (igual al de antes si la acción no mueve).
export function mover(i, accion, cols, total) {
  if (total <= 0) return 0;
  cols = Math.max(1, cols | 0);
  i = Math.max(0, Math.min(total - 1, i | 0));
  const col = i % cols;
  switch (accion) {
    case "izquierda": return col > 0 ? i - 1 : i;
    case "derecha": return col < cols - 1 && i + 1 < total ? i + 1 : i;
    case "arriba": return i - cols >= 0 ? i - cols : i;
    // Abajo: si en la fila de abajo no hay tarjeta en esa columna, a la última
    case "abajo": {
      if (Math.floor(i / cols) === Math.floor((total - 1) / cols)) return i;
      return Math.min(i + cols, total - 1);
    }
    default: return i;
  }
}
