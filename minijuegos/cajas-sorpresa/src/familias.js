// Las 24 piezas son 4 familias de 6. La foto familiar es un festejo
// cuando la familia está completa: no sale de un frasco.

export const FAMILIAS = [
  { id: "calabaza", nombre: "Calabaza" },
  { id: "bruma", nombre: "Bruma" },
  { id: "sabana", nombre: "Sábana" },
  { id: "dulce", nombre: "Dulce" },
];

const ORDEN_ROL = ["bebe", "nino", "nina", "adolescente", "mama", "papa", "abuelo", "abuela"];

export function ordenarFamilia(piezas, familia) {
  return (piezas || [])
    .filter((p) => p && p.familia === familia)
    .slice()
    .sort((a, b) => ORDEN_ROL.indexOf(a.rol) - ORDEN_ROL.indexOf(b.rol));
}

export function familiaCompleta(tenidas, piezas, familia) {
  const miembros = (piezas || []).filter((p) => p && p.familia === familia);
  if (miembros.length !== 6) return false;
  const tengo = new Set(tenidas || []);
  return miembros.every((p) => tengo.has(p.id));
}

/** Id de la familia que pasa de incompleta a completa, o null. */
export function familiaQueSeCompleto(antes, despues, piezas) {
  for (const f of FAMILIAS) {
    if (!familiaCompleta(antes, piezas, f.id) && familiaCompleta(despues, piezas, f.id)) return f.id;
  }
  return null;
}
