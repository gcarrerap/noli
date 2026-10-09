// Encargos del huerto. Puro: el azar entra por `rnd`.
// Fila = horizontal, columna = vertical. Nada de × y nada de cero.
import { entre, uno, revolver } from "./rng.js";
import { preguntaPar } from "./textos.js";
import { semillaDeNivel } from "./semillas.js";

export const POR_TEMPORADA = 6;
export const MAX_SALTOS = 5;
export const MAX_FILAS = 5;
export const MAX_POR_FILA = 10;

export const NIVELES = [
  { n: 1, nombre: "De 2 en 2 y de 10 en 10", ejemplo: "2, 4, 6" },
  { n: 2, nombre: "De 5 en 5", ejemplo: "5, 10, 15" },
  { n: 3, nombre: "Pares y nones", ejemplo: "8 = 4 + 4" },
  { n: 4, nombre: "Filas de plantas", ejemplo: "4 filas de 5" },
  { n: 5, nombre: "Saltar desde un número", ejemplo: "15, 20, 25" },
  { n: 6, nombre: "La misma cantidad", ejemplo: "3 filas de 4" },
];

export const nivel = (n) => NIVELES[Math.max(1, Math.min(NIVELES.length, n)) - 1];

export function sumaRepetida(filas, porFila) {
  const partes = Array.from({ length: filas }, () => String(porFila));
  return {
    escrito: `${partes.join(" + ")} = ${filas * porFila}`,
    leer: `${partes.join(", ")} son ${filas * porFila}`,
  };
}

export function fraseCuadros(filas, porFila) {
  const suma = sumaRepetida(filas, porFila);
  const f = filas === 1 ? "fila" : "filas";
  const c = porFila === 1 ? "columna" : "columnas";
  const cuadros = filas * porFila;
  return {
    escrito: `${filas} ${f} y ${porFila} ${c}. ${suma.escrito}. Son ${cuadros} cuadros.`,
    leer: `${filas} ${f} y ${porFila} ${c}. ${suma.leer}. Son ${cuadros} cuadros.`,
  };
}

export function saltosArreglo(filas, porFila) {
  return Array.from({ length: filas }, (_, i) => (i + 1) * porFila);
}

export function saltosDesde(inicio, paso, direccion, n) {
  return Array.from({ length: n }, (_, i) => inicio + (i + 1) * paso * direccion);
}

export function infoPar(n) {
  const par = n % 2 === 0;
  const mitad = par ? n / 2 : null;
  return {
    par,
    parejas: Math.floor(n / 2),
    sobra: n % 2,
    doble: par ? `${n} = ${mitad} + ${mitad}` : null,
    filas: par ? 2 : null,
    porFila: mitad,
  };
}

// Parejas por fila para que la última fila no se quede con una sola.
export function columnasParejas(n) {
  const k = Math.max(0, n | 0);
  if (k <= 1) return 1;
  if (k <= 5) return k;
  for (let cols = 5; cols >= 2; cols--) {
    if (k % cols !== 1) return cols;
  }
  return 5;
}

export function esPar(n) {
  return n % 2 === 0;
}

export function respuestaParEs(n, eleccion) {
  return eleccion === (esPar(n) ? "par" : "non");
}

const GIROS = [[2, 3], [2, 4], [2, 5], [3, 4], [3, 5], [4, 5]];
const FORMAS = [
  { filas: 2, porFila: 6, refF: 3, refP: 4 },
  { filas: 2, porFila: 8, refF: 4, refP: 4 },
  { filas: 2, porFila: 10, refF: 4, refP: 5 },
  { filas: 3, porFila: 6, refF: 2, refP: 9 },
  { filas: 4, porFila: 6, refF: 3, refP: 8 },
  { filas: 2, porFila: 6, refF: 4, refP: 3 },
];
const REPARTIR = [
  { total: 12, filas: 3 },
  { total: 12, filas: 2 },
  { total: 12, filas: 4 },
  { total: 10, filas: 2 },
  { total: 15, filas: 3 },
  { total: 20, filas: 4 },
  { total: 20, filas: 5 },
  { total: 8, filas: 2 },
  { total: 18, filas: 3 },
  { total: 16, filas: 4 },
];

export function planBase(nivel) {
  const n = Math.max(1, Math.min(6, nivel | 0));
  if (n === 1) return [2, 2, 2, 2, 10, 10].map((paso) => ({ tipo: "plantar", paso, nivel: n }));
  if (n === 2) return Array.from({ length: 6 }, () => ({ tipo: "plantar", paso: 5, nivel: n }));
  if (n === 3) return [0, 1, 2, 3, 4, 5].map((i) => ({ tipo: "par", paridad: i % 2 === 0 ? "par" : "non", nivel: n }));
  if (n === 4) return Array.from({ length: 6 }, () => ({ tipo: "plantar", nivel: n }));
  if (n === 5) return Array.from({ length: 6 }, () => ({ tipo: "saltar", nivel: n }));
  return [
    { tipo: "giro", nivel: 6 },
    { tipo: "giro", nivel: 6 },
    { tipo: "giro", nivel: 6 },
    { tipo: "forma", nivel: 6 },
    { tipo: "forma", nivel: 6 },
    { tipo: "repartir", nivel: 6 },
  ];
}

function base(nivel, tipo, extra) {
  const sem = semillaDeNivel(nivel);
  return {
    nivel, tipo, semilla: sem.id, planta: sem.plural,
    filas: null, porFila: null, filas2: null, porFila2: null,
    total: null, cantidad: null, inicio: null, paso: null, direccion: 1,
    secuencia: null, cosecha: false, texto: "", leer: "", texto2: "", leer2: "",
    suma: "", sumaLeer: "", suma2: "", suma2Leer: "", frase: "", fraseLeer: "",
    repaso: false,
    ...extra,
  };
}

function conArreglo(e, filas, porFila, { cosecha = false } = {}) {
  const suma = sumaRepetida(filas, porFila);
  const frase = fraseCuadros(filas, porFila);
  e.filas = filas;
  e.porFila = porFila;
  e.total = filas * porFila;
  e.paso = porFila;
  e.direccion = 1;
  e.secuencia = saltosArreglo(filas, porFila);
  e.cosecha = cosecha && e.secuencia.length <= MAX_SALTOS;
  e.suma = suma.escrito;
  e.sumaLeer = suma.leer;
  e.frase = frase.escrito;
  e.fraseLeer = frase.leer;
  return e;
}

function plantarDe(nivel, rnd, { paso, facil }) {
  let filas;
  let por;
  if (nivel === 1) {
    por = paso === 10 ? 10 : 2;
    filas = facil ? 2 : por === 10 ? entre(rnd, 2, 4) : entre(rnd, 2, 5);
  } else if (nivel === 2) {
    por = 5;
    filas = facil ? 2 : entre(rnd, 2, 5);
  } else {
    filas = facil ? 2 : entre(rnd, 2, 5);
    por = facil ? uno(rnd, [2, 3]) : entre(rnd, 2, 5);
  }
  const e = base(nivel, "plantar");
  conArreglo(e, filas, por, { cosecha: true });
  e.texto = `Planta ${filas} filas de ${por}.`;
  e.leer = e.texto;
  return e;
}

function parDe(nivel, rnd, { paridad, facil }) {
  const quierePar = paridad ? paridad === "par" : rnd() < 0.5;
  const tope = facil ? 8 : 20;
  let n = quierePar ? entre(rnd, 1, Math.floor(tope / 2)) * 2 : entre(rnd, 0, Math.floor((tope - 1) / 2)) * 2 + 1;
  if (n < 1) n = quierePar ? 2 : 1;
  if (n > tope) n = quierePar ? tope - (tope % 2) : tope - ((tope % 2) === 0 ? 1 : 0);
  const e = base(nivel, "par", { cantidad: n });
  const info = infoPar(n);
  e.filas = info.filas;
  e.porFila = info.porFila;
  e.total = n;
  e.texto = preguntaPar(n);
  e.leer = e.texto;
  if (info.doble) {
    e.suma = info.doble;
    e.sumaLeer = `${n} son ${info.porFila} y ${info.porFila}`;
    e.frase = `2 filas y ${info.porFila} columnas. ${info.doble}. Son ${n} cuadros.`;
    e.fraseLeer = `2 filas y ${info.porFila} columnas. ${e.sumaLeer}. Son ${n} cuadros.`;
  }
  return e;
}

function saltarDe(nivel, rnd, { facil }) {
  const paso = uno(rnd, facil ? [2, 5] : [2, 5, 10]);
  const direccion = !facil && rnd() < 0.5 ? -1 : 1;
  const n = facil ? 3 : entre(rnd, 3, MAX_SALTOS);
  let inicio;
  if (direccion === 1) {
    const kMax = Math.max(1, Math.floor((100 - n * paso) / paso));
    inicio = entre(rnd, 1, kMax) * paso;
  } else {
    inicio = (n + 1 + entre(rnd, 0, 4)) * paso;
  }
  const secuencia = saltosDesde(inicio, paso, direccion, n);
  const sentido = direccion === -1 ? "hacia atrás, de" : "de";
  const texto = `Empieza en ${inicio}. Cuenta ${sentido} ${paso} en ${paso}.`;
  return base(nivel, "saltar", {
    inicio, paso, direccion, secuencia, cosecha: true, total: secuencia[secuencia.length - 1],
    texto, leer: texto,
  });
}

function giroDe(nivel, rnd, { facil }) {
  const [a, b] = facil ? [2, 3] : uno(rnd, GIROS);
  const e = base(nivel, "giro");
  conArreglo(e, a, b, { cosecha: false });
  e.filas2 = b;
  e.porFila2 = a;
  const s2 = sumaRepetida(b, a);
  e.suma2 = s2.escrito;
  e.suma2Leer = s2.leer;
  e.texto = `Planta ${a} filas de ${b}.`;
  e.leer = e.texto;
  e.texto2 = `Ahora gíralo: ${b} filas de ${a}.`;
  e.leer2 = e.texto2;
  return e;
}

function formaDe(nivel, rnd, { facil }) {
  const f = facil ? FORMAS[0] : uno(rnd, FORMAS);
  const e = base(nivel, "forma");
  conArreglo(e, f.filas, f.porFila, { cosecha: false });
  e.texto = `${f.refF * f.refP} también puede ser ${f.filas} filas de ${f.porFila}.`;
  e.leer = e.texto;
  e.texto2 = `${f.refF} filas de ${f.refP}`;
  e.leer2 = e.texto2;
  return e;
}

function repartirDe(nivel, rnd, { facil }) {
  const bolsa = facil ? REPARTIR.filter((r) => r.total <= 12 && r.filas <= 3) : REPARTIR;
  const r = uno(rnd, bolsa);
  const por = r.total / r.filas;
  const e = base(nivel, "repartir");
  conArreglo(e, r.filas, por, { cosecha: false });
  e.texto = `Pon ${r.total} ${e.planta} en ${r.filas} filas iguales.`;
  e.leer = e.texto;
  return e;
}

export function crearEncargo(nivelN, rnd, opts = {}) {
  const nivelOk = Math.max(1, Math.min(6, nivelN | 0));
  const tipo = opts.tipo || planBase(nivelOk)[0].tipo;
  const facil = !!opts.facil;
  let e;
  if (tipo === "par") e = parDe(nivelOk, rnd, { paridad: opts.paridad, facil });
  else if (tipo === "saltar") e = saltarDe(nivelOk, rnd, { facil });
  else if (tipo === "giro") e = giroDe(nivelOk, rnd, { facil });
  else if (tipo === "forma") e = formaDe(nivelOk, rnd, { facil });
  else if (tipo === "repartir") e = repartirDe(nivelOk, rnd, { facil });
  else e = plantarDe(nivelOk, rnd, { paso: opts.paso, facil });
  e.repaso = !!opts.repaso;
  e.nivel = nivelOk;
  return e;
}

export function claveEncargo(e) {
  return [e.tipo, e.filas, e.porFila, e.filas2, e.porFila2, e.cantidad, e.inicio, e.paso, e.direccion, e.secuencia && e.secuencia.length].join(":");
}

export function crearTemporada(nivelN, rnd, { facil = false } = {}) {
  const nivelOk = Math.max(1, Math.min(6, nivelN | 0));
  let plan = planBase(nivelOk);
  if (nivelOk !== 6) plan = revolver(rnd, plan);
  const usados = new Set();
  return plan.map((slot) => {
    let e = null;
    for (let i = 0; i < 24; i++) {
      e = crearEncargo(nivelOk, rnd, { ...slot, facil });
      const k = claveEncargo(e);
      if (!usados.has(k)) { usados.add(k); break; }
    }
    return e;
  });
}

export function metaForma(encargo, fase) {
  if (encargo.tipo === "giro" && fase === "giro2") return { filas: encargo.filas2, porFila: encargo.porFila2 };
  return { filas: encargo.filas, porFila: encargo.porFila };
}

export function coincide(filas, porFila, encargo, fase) {
  const m = metaForma(encargo, fase);
  return filas >= 1 && porFila >= 1 && filas === m.filas && porFila === m.porFila;
}

export function cabeEnCuadricula(e) {
  if (e.tipo === "saltar") {
    return Array.isArray(e.secuencia) && e.secuencia.length >= 1 && e.secuencia.length <= MAX_SALTOS
      && e.secuencia.every((n, i) => n >= 1 && (i === 0 || n - e.secuencia[i - 1] === e.paso * e.direccion));
  }
  if (e.tipo === "par") return e.cantidad >= 1 && e.cantidad <= 20;
  const formas = [[e.filas, e.porFila]];
  if (e.tipo === "giro") formas.push([e.filas2, e.porFila2]);
  return formas.every(([f, p]) => f >= 1 && f <= MAX_FILAS && p >= 1 && p <= MAX_POR_FILA);
}

export function saltosCoinciden(e) {
  if (!e.secuencia || e.filas == null || e.porFila == null) return e.tipo === "saltar" || e.tipo === "par";
  if (e.secuencia.length !== e.filas) return false;
  if (e.secuencia.length > MAX_SALTOS) return false;
  return e.secuencia.every((n, i) => n === (i + 1) * e.porFila) && e.secuencia[e.secuencia.length - 1] === e.total;
}

// Tres opciones. Tocar una ya es la respuesta. Ninguna es cero.
export function opcionesSalto(correcto, actual, paso, direccion, rnd) {
  const vistos = new Set([correcto]);
  const bolsa = [];
  const sumar = (n) => {
    if (!Number.isInteger(n) || n < 1 || vistos.has(n)) return;
    vistos.add(n);
    bolsa.push(n);
  };
  const otro = paso === 5 ? 10 : paso === 10 ? 5 : 5;
  sumar(actual + direccion);
  sumar(correcto + 1);
  sumar(correcto - 1);
  sumar(actual + paso * direccion * 2);
  sumar(actual + otro * direccion);
  sumar(actual - paso * direccion);
  sumar(correcto + paso * direccion);
  let k = 2;
  while (bolsa.length < 2 && k < 40) {
    sumar(correcto + k);
    sumar(correcto - k);
    k++;
  }
  const a = bolsa.splice(Math.floor(rnd() * bolsa.length), 1)[0];
  const b = bolsa.splice(Math.floor(rnd() * bolsa.length), 1)[0];
  return revolver(rnd, [correcto, a, b]);
}

export function limitar(valor, max) {
  return Math.max(1, Math.min(max, valor));
}
