// Pago exacto con la bolsa de la visita. No hay cambio.
// Las piezas y el dibujo salen de La Tienda; aquí solo se decide si alcanza.

export function conteoDe(orden) {
  const c = {};
  for (const id of orden || []) c[id] = (c[id] || 0) + 1;
  return c;
}

export function sumaOrden(orden, piezas) {
  const porId = new Map(piezas.map((p) => [p.id, p.valor]));
  return (orden || []).reduce((s, id) => s + (porId.get(id) || 0), 0);
}

export function sumaBolsa(bolsa, piezas) {
  const porId = new Map(piezas.map((p) => [p.id, p.valor]));
  return Object.entries(bolsa || {}).reduce((s, [id, n]) => s + (porId.get(id) || 0) * (n | 0), 0);
}

/**
 * Una forma de pagar `precio` exacto con las piezas limitadas de la bolsa.
 * Prefiere monedas grandes. Devuelve { id: cuántas } o null.
 */
export function pagarExacto(precio, bolsa, piezas) {
  if (!Number.isInteger(precio) || precio < 0) return null;
  if (precio === 0) return {};
  const dens = [...(piezas || [])]
    .filter((p) => p && p.valor > 0 && (bolsa?.[p.id] || 0) > 0)
    .sort((a, b) => b.valor - a.valor || (a.id < b.id ? -1 : 1));
  const uso = {};
  function bt(i, resta) {
    if (resta === 0) return true;
    if (i >= dens.length || resta < 0) return false;
    const p = dens[i];
    const max = Math.min(bolsa[p.id] | 0, Math.floor(resta / p.valor));
    for (let k = max; k >= 0; k--) {
      if (k) uso[p.id] = k;
      else delete uso[p.id];
      if (bt(i + 1, resta - k * p.valor)) return true;
    }
    delete uso[p.id];
    return false;
  }
  return bt(0, precio) ? { ...uso } : null;
}

export function puedePagar(precio, bolsa, piezas) {
  return pagarExacto(precio, bolsa, piezas) != null;
}

/** Resta las monedas usadas. No deja números negativos. */
export function restarBolsa(bolsa, conteo) {
  const out = { ...bolsa };
  for (const [id, n] of Object.entries(conteo || {})) {
    out[id] = Math.max(0, (out[id] | 0) - (n | 0));
    if (!out[id]) delete out[id];
  }
  return out;
}

export function sumarBolsa(bolsa, conteo) {
  const out = { ...bolsa };
  for (const [id, n] of Object.entries(conteo || {})) out[id] = (out[id] | 0) + (n | 0);
  return out;
}

export function agregarMoneda(orden, bolsa, id) {
  const usados = (orden || []).filter((x) => x === id).length;
  if (usados >= (bolsa?.[id] || 0)) return orden || [];
  return [...(orden || []), id];
}

export function quitarUltima(orden) {
  return (orden || []).slice(0, -1);
}

/** La moneda de mayor valor que forma parte de la solución, para la flecha de la pista. */
export function monedaMayor(conteo, piezas) {
  let mejor = null;
  for (const p of piezas || []) {
    if ((conteo?.[p.id] || 0) > 0 && (!mejor || p.valor > mejor.valor)) mejor = p;
  }
  return mejor;
}

export function copiaBolsa(bolsa) {
  return { ...(bolsa || {}) };
}
