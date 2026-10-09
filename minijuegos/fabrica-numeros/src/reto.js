// Reto del día. La semilla es la fecha, así que sale igual en la TV y en el teléfono.
// Línea de producción es por cantidad (no por tiempo): en la tele el reloj aprieta
// y el control es lento. Camión misterioso: a lo más 3 pistas, una de centenas, y se puede resolver.
import { rngConSemilla, entre, uno } from "./rng.js";
import { crearPedido, POR_TURNO } from "./niveles.js";
import { tieneCero } from "./palabras.js";

export const TIPOS_RETO = {
  gigante: { nombre: "Pedido gigante", meta: "Cuatro pedidos grandes. Necesitas 3." },
  linea: { nombre: "Línea de producción", meta: "Completa 6 pedidos. Meta: 5." },
  misterioso: { nombre: "Camión misterioso", meta: "Adivina 5 camiones con las pistas. Meta: 4." },
};
const ORDEN = ["gigante", "linea", "misterioso"];

const diaNumero = (fecha) => {
  const [y, m, d] = fecha.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};

const GIGANTES_CERO = [305, 640, 408, 507, 1000, 702, 430, 806, 109, 250, 970, 101];
const GIGANTES_CHICOS = [97, 86, 79, 68, 59, 48, 39, 98];

export function cumplePista(n, pista) {
  const c = Math.floor(n / 100);
  const d = Math.floor(n / 10) % 10;
  const u = n % 10;
  if (pista.tipo === "centenas") return c === pista.valor;
  if (pista.tipo === "decenas") return d === pista.valor;
  if (pista.tipo === "unidades") return u === pista.valor;
  if (pista.tipo === "mas-decenas") return d > u;
  if (pista.tipo === "mas-unidades") return u > d;
  if (pista.tipo === "iguales") return d === u;
  if (pista.tipo === "decena-mas") return d === u + 1;
  if (pista.tipo === "unidad-mas") return u === d + 1;
  return false;
}

export function soluciones(pistas, max = 1000) {
  const out = [];
  for (let n = 0; n <= max; n++) if (pistas.every((p) => cumplePista(n, p))) out.push(n);
  return out;
}

function pistaCentenas(c) {
  return {
    tipo: "centenas", valor: c,
    texto: c === 0 ? "No tiene centenas." : c === 1 ? "Tiene 1 centena." : `Tiene ${c} centenas.`,
  };
}
function pistaDecenas(d) {
  return {
    tipo: "decenas", valor: d,
    texto: d === 0 ? "No tiene decenas." : d === 1 ? "Tiene 1 decena." : `Tiene ${d} decenas.`,
  };
}
function pistaUnidades(u) {
  return {
    tipo: "unidades", valor: u,
    texto: u === 0 ? "No tiene unidades." : u === 1 ? "Tiene 1 unidad." : `Tiene ${u} unidades.`,
  };
}

// A lo más 3 pistas. La primera siempre habla de las centenas. El conjunto deja un solo número.
export function pistasDe(n) {
  const c = Math.floor(n / 100), d = Math.floor(n / 10) % 10, u = n % 10;
  const cent = pistaCentenas(c), dec = pistaDecenas(d), uni = pistaUnidades(u);
  const intentos = [];
  if (d === u) intentos.push([cent, { tipo: "iguales", texto: "Tiene las mismas decenas que unidades." }, dec]);
  if (d === u + 1) intentos.push([cent, { tipo: "decena-mas", texto: "Tiene una decena más que unidades." }, uni]);
  if (u === d + 1) intentos.push([cent, { tipo: "unidad-mas", texto: "Tiene una unidad más que decenas." }, dec]);
  if (d === 0) intentos.push([cent, pistaDecenas(0), uni]);
  if (u === 0 && d !== 0) intentos.push([cent, pistaUnidades(0), dec]);
  if (d > u) intentos.push([cent, { tipo: "mas-decenas", texto: "Tiene más decenas que unidades." }, uni]);
  if (u > d) intentos.push([cent, { tipo: "mas-unidades", texto: "Tiene más unidades que decenas." }, dec]);
  intentos.push([cent, dec, uni]);
  for (const ps of intentos) {
    if (ps.length <= 3 && ps.some((p) => p.tipo === "centenas") && soluciones(ps).length === 1) return ps;
  }
  return [cent, dec, uni];
}

function pedidoMisterioso(n) {
  const pistas = pistasDe(n);
  return {
    nivel: 5, tipo: "misterioso", objetivo: n, texto: "¿Qué número trae el camión?",
    pistas, dificil: tieneCero(n), subetapa: "base", referencia: null,
    a: null, b: null, op: null, secuencia: null, paso: null, camiones: null, leer: pistas.map((p) => p.texto).join(" "),
  };
}

function numeroMisterio(rnd, nivelActual) {
  if (nivelActual <= 1) return entre(rnd, 11, 99);
  if (nivelActual === 2) return entre(rnd, 1, 9) * 100 + entre(rnd, 1, 9) * 10 + entre(rnd, 1, 9);
  return entre(rnd, 100, 999);
}

export function retoDelDia(fecha, nivelActual) {
  const tipo = ORDEN[diaNumero(fecha) % ORDEN.length];
  const n = Math.max(1, Math.min(8, nivelActual | 0));
  const rnd = rngConSemilla("noli-fabrica-reto-" + fecha);
  const reto = { fecha, tipo, n, ...TIPOS_RETO[tipo], problemas: [] };
  if (tipo === "gigante") {
    const bolsa = n >= 3 ? GIGANTES_CERO : GIGANTES_CHICOS;
    reto.cuantos = 4;
    reto.necesita = 3;
    const elegidos = [];
    const copia = [...bolsa];
    while (elegidos.length < reto.cuantos && copia.length) {
      const i = Math.floor(rnd() * copia.length);
      elegidos.push(copia.splice(i, 1)[0]);
    }
    reto.problemas = elegidos.map((objetivo) => ({
      nivel: Math.max(n, objetivo >= 100 ? 3 : 1),
      tipo: "armar", objetivo, texto: String(objetivo),
      dificil: tieneCero(objetivo), subetapa: "gigante",
      pistas: null, secuencia: null, camiones: null, referencia: null, a: null, b: null, op: null, paso: null, leer: null,
    }));
  } else if (tipo === "linea") {
    const usa = Math.max(1, n > 1 ? n - 1 : n);
    reto.cuantos = POR_TURNO;
    reto.necesita = 5;
    reto.problemas = Array.from({ length: reto.cuantos }, () => crearPedido(usa, rnd, { sub: "base" }));
  } else {
    reto.cuantos = 5;
    reto.necesita = 4;
    const vistos = new Set();
    while (reto.problemas.length < reto.cuantos) {
      const num = numeroMisterio(rnd, n);
      if (vistos.has(num)) continue;
      vistos.add(num);
      reto.problemas.push(pedidoMisterioso(num));
    }
  }
  return reto;
}

export { uno };
