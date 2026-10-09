// «¿Quién crees que es?»: la respuesta y dos Brumitos que ella ya tiene.
// Si no hay dos señuelos distintos, no se pregunta.

export function opcionesQuien(pieza, tenidas, piezas, rng) {
  if (!pieza) return null;
  const propias = (piezas || []).filter((p) => p.id !== pieza.id && (tenidas || []).includes(p.id));
  if (propias.length < 2) return null;
  const baraja = propias.slice();
  for (let i = baraja.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = baraja[i];
    baraja[i] = baraja[j];
    baraja[j] = t;
  }
  const opciones = [pieza, baraja[0], baraja[1]];
  for (let i = opciones.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = opciones[i];
    opciones[i] = opciones[j];
    opciones[j] = t;
  }
  return opciones.map((p) => ({ id: p.id, nombre: p.nombre }));
}

const ORDEN = { ultra: 3, rara: 2, comun: 1 };

/** Hasta tres piezas que le faltan, primero la de mayor rareza, para elegir la meta. */
export function candidatosMeta(tenidas, piezas) {
  return (piezas || [])
    .filter((p) => !(tenidas || []).includes(p.id))
    .sort((a, b) => (ORDEN[b.rareza] - ORDEN[a.rareza]) || (a.nombre < b.nombre ? -1 : a.nombre > b.nombre ? 1 : 0))
    .slice(0, 3);
}
