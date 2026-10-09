// Frases armadas a partir de textos.json (la redacción vive ahí).

export function rellenar(s, vars = {}) {
  return String(s ?? "").replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? "" : String(vars[k])));
}

export function listaY(nums) {
  const a = nums.map((n) => String(n));
  if (a.length <= 1) return a[0] || "";
  if (a.length === 2) return `${a[0]} y ${a[1]}`;
  return `${a.slice(0, -1).join(", ")} y ${a[a.length - 1]}`;
}

export function valoresDeConteo(conteo, piezas) {
  const nums = [];
  const orden = [...piezas].sort((a, b) => b.valor - a.valor);
  for (const p of orden) for (let i = 0; i < (conteo?.[p.id] || 0); i++) nums.push(p.valor);
  return nums;
}

export function fraseToca(conteo, piezas, textos) {
  const lista = listaY(valoresDeConteo(conteo, piezas));
  const total = valoresDeConteo(conteo, piezas).reduce((s, n) => s + n, 0);
  return {
    texto: `${rellenar(textos.toca, { lista })}. ${rellenar(textos.son, { n: total })}`.replace(/\.\s*\./g, ".").trim(),
    voz: rellenar(textos.vozToca, { lista, n: total }),
  };
}

/** «3 cuadros de largo, 2 de ancho». Nunca usa ×. */
export function fraseMedida(w, h, textos) {
  const largo = h === 1 ? textos.cuadroLargoUno : rellenar(textos.cuadroLargo, { n: h });
  return `${largo}, ${rellenar(textos.deAncho, { n: w })}`;
}

/** Al girar 2 por 3, se dice que es lo mismo que 3 por 2. */
export function fraseGiro(w0, h0, w1, h1, textos) {
  const par = (w, h) => [w, h].slice().sort((a, b) => a - b).join(",");
  if (par(w0, h0) === "2,3" && par(w1, h1) === "2,3" && (w0 !== w1 || h0 !== h1)) return textos.mismo;
  return "";
}

export function fraseFaltan(n, textos, voz = false) {
  if (n === 1) return voz ? textos.vozFalta : textos.falta;
  return rellenar(voz ? textos.vozFaltan : textos.faltan, { n });
}
