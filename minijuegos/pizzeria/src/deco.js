// Propinas fijas y adornos en orden fijo. No se elige ni se compra.

export const PROPINA = 1;

export const ADORNOS = [
  { id: "letrero-1", en: 3, arte: "deco-letrero-1", nombre: "Letrero" },
  { id: "mesa-1", en: 6, arte: "deco-mesa-1", nombre: "Mesa" },
  { id: "letrero-2", en: 12, arte: "deco-letrero-2", nombre: "Letrero de luces" },
  { id: "mesa-2", en: 18, arte: "deco-mesa-2", nombre: "Terraza" },
  { id: "horno", en: 24, arte: "deco-horno-nuevo", nombre: "Horno nuevo" },
];

export function abiertos(propinas) {
  const n = propinas | 0;
  return ADORNOS.filter((a) => n >= a.en);
}

export function recienAbierto(antes, despues) {
  const ya = new Set(abiertos(antes).map((a) => a.id));
  return abiertos(despues).filter((a) => !ya.has(a.id));
}

export function sumarPropinas(propinas, clientes) {
  return (propinas | 0) + PROPINA * Math.max(0, clientes | 0);
}
