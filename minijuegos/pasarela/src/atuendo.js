// El atuendo: qué trae puesto el personaje. Lógica pura. Ver docs/JUEGO.md.
//
//   atuendo = { peinado, arriba, abajo, vestido, zapatos: { id, color } | null,  accesorios: { [lugar]: { id, color } } }
//
// Reglas: un vestido ocupa arriba y abajo (ponerse un vestido quita lo de arriba y lo de abajo, y al revés); de
// accesorios, uno por lugar (cabeza, cara, cuello, mano, espalda).

/** @returns {object} un atuendo vacío */
export const atuendoVacio = () => ({ peinado: null, arriba: null, abajo: null, vestido: null, zapatos: null, accesorios: {} });

/**
 * Pone una prenda (devuelve un atuendo nuevo). Si ya la traía con el mismo color, se la quita (tocar dos veces = quitar).
 * @param {object} atuendo
 * @param {{id, categoria, lugar?}} prenda
 * @param {string} color id del color
 * @returns {object}
 */
export function poner(atuendo, prenda, color) {
  const a = { ...atuendo, accesorios: { ...atuendo.accesorios } };
  const pieza = { id: prenda.id, color };
  if (prenda.categoria === "accesorio") {
    const actual = a.accesorios[prenda.lugar];
    if (actual && actual.id === prenda.id && actual.color === color) delete a.accesorios[prenda.lugar];
    else a.accesorios[prenda.lugar] = pieza;
    return a;
  }
  const actual = a[prenda.categoria];
  if (actual && actual.id === prenda.id && actual.color === color) { a[prenda.categoria] = null; return a; }
  a[prenda.categoria] = pieza;
  if (prenda.categoria === "vestido") { a.arriba = null; a.abajo = null; }
  if (prenda.categoria === "arriba" || prenda.categoria === "abajo") a.vestido = null;
  return a;
}

/**
 * Quita lo que haya en una ranura ("arriba", "zapatos"…) o en un lugar de accesorio ("cabeza"…).
 */
export function quitar(atuendo, donde) {
  const a = { ...atuendo, accesorios: { ...atuendo.accesorios } };
  if (donde in a.accesorios) delete a.accesorios[donde];
  else if (donde in a && donde !== "accesorios") a[donde] = null;
  return a;
}

/**
 * Todas las piezas puestas, en orden de la cabeza a los pies y luego accesorios.
 * @returns {{id, color, ranura}[]}
 */
export function puestas(atuendo) {
  const r = [];
  for (const k of ["peinado", "arriba", "vestido", "abajo", "zapatos"]) if (atuendo[k]) r.push({ ...atuendo[k], ranura: k });
  for (const [lugar, p] of Object.entries(atuendo.accesorios)) if (p) r.push({ ...p, ranura: lugar });
  return r;
}

/** ¿Trae puesta esta prenda (con cualquier color)? Devuelve su color o null. */
export function colorPuesto(atuendo, prenda) {
  const p = prenda.categoria === "accesorio" ? atuendo.accesorios[prenda.lugar] : atuendo[prenda.categoria];
  return p && p.id === prenda.id ? p.color : null;
}

/**
 * El atuendo en inglés, para aprender palabras: "a pink T-shirt, blue shorts and white sneakers".
 * Color antes del nombre (como en inglés); sin "a" en los plurales (shorts, sneakers, sunglasses) y en "hair".
 * @param {object} atuendo
 * @param {{prendas: Map, colores: Map}} idx índices de datos.js
 * @returns {string}
 */
export function fraseIngles(atuendo, idx) {
  const partes = puestas(atuendo).map((p) => {
    const pr = idx.prendas.get(p.id), c = idx.colores.get(p.color);
    if (!pr) return null;
    const txt = (c ? c.en + " " : "") + pr.en;
    if (pr.enPlural) return txt;
    return (/^[aeiou]/i.test(txt) ? "an " : "a ") + txt;
  }).filter(Boolean);
  if (!partes.length) return "";
  if (partes.length === 1) return partes[0];
  return partes.slice(0, -1).join(", ") + " and " + partes[partes.length - 1];
}

/** Revisa un atuendo guardado (de una versión vieja o roto): quita lo que ya no existe. */
export function limpiar(atuendo, idx) {
  const a = atuendoVacio();
  if (!atuendo || typeof atuendo !== "object") return a;
  const ok = (p) => p && idx.prendas.has(p.id) && idx.colores.has(p.color);
  for (const k of ["peinado", "arriba", "abajo", "vestido", "zapatos"]) if (ok(atuendo[k]) && idx.prendas.get(atuendo[k].id).categoria === k) a[k] = { id: atuendo[k].id, color: atuendo[k].color };
  for (const [lugar, p] of Object.entries(atuendo.accesorios || {})) if (ok(p) && idx.prendas.get(p.id).lugar === lugar) a.accesorios[lugar] = { id: p.id, color: p.color };
  if (a.vestido) { a.arriba = null; a.abajo = null; }
  return a;
}
