// Se abren en orden fijo, por nivel. No hay mercado.
export const SEMILLAS = [
  { id: "zanahoria", nombre: "Zanahoria", plural: "zanahorias", nivel: 1 },
  { id: "lechuga", nombre: "Lechuga", plural: "lechugas", nivel: 2 },
  { id: "fresa", nombre: "Fresa", plural: "fresas", nivel: 3 },
  { id: "girasol", nombre: "Girasol", plural: "girasoles", nivel: 4 },
  { id: "calabaza", nombre: "Calabaza", plural: "calabazas", nivel: 5 },
];

export function semillaPorId(id) {
  return SEMILLAS.find((s) => s.id === id) || SEMILLAS[0];
}

export function semillaDeNivel(nivel) {
  const n = Math.max(1, Math.min(SEMILLAS.length, nivel | 0));
  return SEMILLAS[n - 1];
}

export function semillasAbiertas(nivel) {
  const n = Math.max(1, nivel | 0);
  return SEMILLAS.filter((s) => s.nivel <= n);
}

// La semilla que acaba de abrirse al llegar a `nivel`, o null si ese nivel no trae una nueva.
export function semillaNueva(nivel) {
  if (nivel <= 1) return null;
  return SEMILLAS.find((s) => s.nivel === nivel) || null;
}
