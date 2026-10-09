// Dinero, sin saber si son dólares o pesos: suma, texto, cambio y opciones de cobro.
// Toda denominación llega en el JSON de la moneda.
import { revolver } from "./rng.js";

export const piezaPorId = (moneda, id) => moneda.porId?.[id] || moneda.piezas.find((p) => p.id === id);

export function sumarLista(piezas) {
  return piezas.reduce((s, p) => s + p.valor * (p.n || 1), 0);
}

export function sumaConteo(conteo, piezas) {
  return Object.entries(conteo || {}).reduce((s, [id, n]) => s + (piezaPorId({ piezas }, id)?.valor || 0) * n, 0);
}

// Arma `cantidad` con la caja (conteo id → cuántas hay). Avaro: estas denominaciones lo permiten.
// Devuelve { id: n } o null si no alcanza.
export function formar(cantidad, piezas, caja) {
  if (!Number.isInteger(cantidad) || cantidad < 0) return null;
  const orden = [...piezas].sort((a, b) => b.valor - a.valor);
  const usado = {};
  let resta = cantidad;
  for (const p of orden) {
    if (p.valor <= 0) continue;
    const n = Math.min(caja[p.id] | 0, Math.floor(resta / p.valor));
    if (n > 0) { usado[p.id] = n; resta -= n * p.valor; }
  }
  return resta === 0 ? usado : null;
}

export function listaDesdeConteo(conteo, moneda) {
  const lista = [];
  for (const [id, n] of Object.entries(conteo || {})) {
    const p = piezaPorId(moneda, id);
    for (let i = 0; i < n; i++) lista.push(p);
  }
  return lista;
}

const nTexto = (k, par) => `${k} ${k === 1 ? par.uno : par.muchos}`;

// "$1.25", "40¢", "$20" según la moneda
export function texto(moneda, cantidad) {
  const menor = moneda.menorPorMayor || 0;
  if (menor > 1) {
    if (cantidad < menor && moneda.simboloMenor) return `${cantidad}${moneda.simboloMenor}`;
    const d = Math.floor(cantidad / menor);
    const c = cantidad % menor;
    const digitos = String(menor).length - 1;
    if (c === 0) return `${moneda.simbolo}${d}`;
    return `${moneda.simbolo}${d}.${String(c).padStart(digitos, "0")}`;
  }
  return `${moneda.simbolo}${cantidad}`;
}

export function textoLargo(moneda, cantidad) {
  if (moneda.menorPorMayor > 1 && moneda.menor) {
    const may = Math.floor(cantidad / moneda.menorPorMayor);
    const men = cantidad % moneda.menorPorMayor;
    if (may && men) return `${nTexto(may, moneda.mayor)} y ${nTexto(men, moneda.menor)}`;
    if (may) return nTexto(may, moneda.mayor);
    return nTexto(men, moneda.menor);
  }
  return nTexto(cantidad, moneda.mayor);
}

export function describir(piezas) {
  const grupos = [];
  for (const p of piezas) {
    const g = grupos.find((x) => x.id === p.id);
    if (g) g.n += 1;
    else grupos.push({ id: p.id, nombre: p.nombre, plural: p.plural || p.nombre, n: 1 });
  }
  const partes = grupos.map((g) => `${g.n} ${g.n === 1 ? g.nombre : g.plural}`);
  if (partes.length <= 1) return partes[0] || "nada";
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

// Cómo se cuenta el montón, de la pieza más grande a la más chica, con subtotal.
export function desglose(piezas) {
  const grupos = [];
  for (const p of [...piezas].sort((a, b) => b.valor - a.valor)) {
    const g = grupos.find((x) => x.id === p.id);
    if (g) g.n += 1;
    else grupos.push({ id: p.id, nombre: p.nombre, nombreEn: p.nombreEn || "", etiqueta: p.etiqueta, valor: p.valor, n: 1 });
  }
  let subtotal = 0;
  return grupos.map((g) => {
    const parcial = g.n * g.valor;
    subtotal += parcial;
    return { ...g, parcial, subtotal };
  });
}

function meter(mapa, orden, valor, motivo) {
  if (!Number.isInteger(valor) || valor < 0 || mapa.has(valor)) return;
  mapa.set(valor, motivo);
  orden.push(valor);
}

// 4 cantidades distintas: la correcta y errores típicos (contar 25 como 10, olvidar un billete…).
export function opcionesCobro(piezas, moneda, rnd, cuantas = 4) {
  const correcto = sumarLista(piezas);
  const motivos = new Map();
  const alta = [];
  const baja = [];
  for (const c of moneda.confusiones || []) {
    if (piezas.some((p) => p.valor === c.de)) meter(motivos, alta, correcto - c.de + c.como, c.motivo);
  }
  if (piezas.length) {
    const mayor = piezas.reduce((a, p) => (p.valor > a.valor ? p : a));
    meter(motivos, alta, correcto - mayor.valor, mayor.tipo === "billete" ? "Faltó contar el billete." : "Faltó una moneda.");
  }
  const menor = piezas.reduce((m, p) => Math.min(m, p.valor), Infinity);
  if (Number.isFinite(menor)) meter(motivos, baja, correcto + menor, "Contaste una moneda de más.");
  let k = 1;
  while (motivos.size < cuantas - 1 && k < 15) {
    const paso = Number.isFinite(menor) ? menor : 1;
    meter(motivos, baja, correcto + paso * (k + 1), "Cuenta otra vez, despacio.");
    meter(motivos, baja, correcto - paso * k, "Cuenta otra vez, despacio.");
    k++;
  }
  const elegidos = [...alta, ...revolver(rnd, baja)].filter((v) => v !== correcto).slice(0, cuantas - 1);
  return revolver(rnd, [correcto, ...elegidos].map((valor) => ({
    valor, correcta: valor === correcto, motivo: valor === correcto ? "" : (motivos.get(valor) || "Cuenta otra vez."),
  })));
}

// Opciones para la suma de dos precios.
export function opcionesSuma(a, b, rnd, cuantas = 4) {
  const correcto = a + b;
  const motivos = new Map();
  const orden = [];
  meter(motivos, orden, a, "Ese es solo el primer precio.");
  meter(motivos, orden, b, "Ese es solo el segundo precio.");
  meter(motivos, orden, Math.abs(a - b), "Restaste. Hay que sumar los dos precios.");
  meter(motivos, orden, correcto + 10, "Te pasaste por 10.");
  meter(motivos, orden, correcto - 10, "Te faltaron 10.");
  meter(motivos, orden, correcto + 1, "Te pasaste por 1.");
  let k = 2;
  while (motivos.size < cuantas - 1 && k < 20) {
    meter(motivos, orden, correcto + k, "Suma otra vez.");
    meter(motivos, orden, correcto - k, "Suma otra vez.");
    k++;
  }
  const elegidos = orden.filter((v) => v !== correcto).slice(0, cuantas - 1);
  return revolver(rnd, [correcto, ...elegidos].map((valor) => ({
    valor, correcta: valor === correcto, motivo: valor === correcto ? "" : motivos.get(valor),
  })));
}
