// Curva fija de visitas, como la Pasarela. No hay racha ni reto.

export function abiertos(visitas, curva) {
  const muebles = [];
  const cuartos = [];
  let dinero = 1;
  let nombre = curva?.[0]?.nombre || "";
  for (const n of curva || []) {
    if ((visitas | 0) < n.visitas) break;
    for (const id of n.muebles || []) if (!muebles.includes(id)) muebles.push(id);
    for (const id of n.cuartos || []) if (!cuartos.includes(id)) cuartos.push(id);
    if (n.dinero) dinero = n.dinero;
    nombre = n.nombre || nombre;
  }
  return { muebles, cuartos, dinero, nombre };
}

export function recienAbiertos(visitasAntes, curva) {
  const antes = abiertos(visitasAntes, curva);
  const despues = abiertos(visitasAntes + 1, curva);
  return {
    cuartos: despues.cuartos.filter((id) => !antes.cuartos.includes(id)),
    muebles: despues.muebles.filter((id) => !antes.muebles.includes(id)),
    dinero: despues.dinero,
  };
}

export function bolsaDe(dinero, monedaId, bolsas) {
  const nivel = bolsas?.[String(dinero)] || bolsas?.[dinero] || bolsas?.["1"] || {};
  const src = nivel[monedaId] || nivel.usd || {};
  return { ...src };
}
