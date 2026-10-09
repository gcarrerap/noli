// Los 8 niveles del issue, con subetapas internas (ceros, palabras, reagrupar, ceros al restar).
// Cada generador es puro: gen(rnd) → pedido. El azar entra por el parámetro.
import { entre, uno } from "./rng.js";
import { desarrollada, enPalabras, esDecenaExactaRegular, esIrregular, tieneCero } from "./palabras.js";

export const POR_TURNO = 6;

export const NIVELES = [
  { n: 1, nombre: "Hasta 100", ejemplo: "47" },
  { n: 2, nombre: "Hasta 1000", ejemplo: "347" },
  { n: 3, nombre: "Con ceros", ejemplo: "305, 640" },
  { n: 4, nombre: "Palabras y desarrollada", ejemplo: "300 + 40 + 7" },
  { n: 5, nombre: "Comparar y ordenar", ejemplo: "1 más que 46" },
  { n: 6, nombre: "De 10 en 10 y de 100 en 100", ejemplo: "190, 200, 210" },
  { n: 7, nombre: "Sumar hasta 1000", ejemplo: "347 + 256" },
  { n: 8, nombre: "Restar hasta 1000", ejemplo: "400 − 128" },
];

export const nivel = (n) => NIVELES[Math.max(1, Math.min(NIVELES.length, n)) - 1];

// Subetapa según cuántos pedidos de ese nivel contestó bien a la primera.
// `facil` (tras 3 fallos seguidos) retrocede una subetapa, sin bajar de nivel.
export function subetapa(n, bien, facil = false) {
  let s = 0;
  if (n === 4) s = bien < 3 ? 0 : bien < 6 ? 1 : 2;
  else if (n === 7) s = bien < 3 ? 0 : bien < 6 ? 1 : 2;
  else if (n === 8) s = bien < 2 ? 0 : bien < 4 ? 1 : bien < 6 ? 2 : 3;
  if (facil) s = Math.max(0, s - 1);
  if (n === 4) return ["desarrollada", "decenas", "irregulares"][s];
  if (n === 7 || n === 8) return ["sin", "una", "dos", "ceros"][s];
  return "base";
}

const dig = (n) => ({ c: Math.floor(n / 100), d: Math.floor(n / 10) % 10, u: n % 10 });

function sinCeros(n) {
  const { c, d, u } = dig(n);
  return c >= 1 && d >= 1 && u >= 1 && c <= 9;
}

function llevarSuma(a, b) {
  const u = (a % 10) + (b % 10);
  const llevaU = u >= 10 ? 1 : 0;
  const d = Math.floor(a / 10) % 10 + Math.floor(b / 10) % 10 + llevaU;
  const llevaD = d >= 10 ? 1 : 0;
  const c = Math.floor(a / 100) + Math.floor(b / 100) + llevaD;
  const llevaC = c >= 10 ? 1 : 0;
  return { llevaU, llevaD, llevaC, total: llevaU + llevaD + llevaC, r: a + b };
}

// Dónde hay que pedir prestado. `medio`: la decena del minuendo es 0 y aun así
// hay que reagrupar (400 − 128, 503 − 247). `unos` / `decenas` separan el préstamo
// de las unidades del de las decenas, para las subetapas del nivel 8.
export function prestamos(a, b) {
  const u0 = a % 10, d0 = Math.floor(a / 10) % 10, c0 = Math.floor(a / 100) % 10;
  const ub = b % 10, db = Math.floor(b / 10) % 10, cb = Math.floor(b / 100);
  let d = d0, c = c0, mil = Math.floor(a / 1000);
  let unos = false, decenas = false, centenas = false, cascada = false;
  if (u0 < ub) {
    unos = true;
    if (d === 0) cascada = true;
    d -= 1;
    if (d < 0) {
      decenas = true; c -= 1; d += 10;
      if (c < 0) { centenas = true; mil -= 1; c += 10; }
    }
  }
  if (d < db) {
    decenas = true;
    c -= 1;
    if (c < 0) { centenas = true; mil -= 1; c += 10; }
  }
  if (c < cb) centenas = true;
  const n = (unos ? 1 : 0) + (decenas ? 1 : 0) + (centenas ? 1 : 0);
  return { n, unos, decenas, centenas, cascada, medio: d0 === 0 && (unos || decenas) };
}

function intentar(rnd, fn, fallback, veces = 200) {
  for (let i = 0; i < veces; i++) {
    const x = fn();
    if (x != null) return x;
  }
  return fallback;
}

function numeroNivel(n, rnd, facil) {
  if (n <= 1) {
    const d = entre(rnd, 1, facil ? 3 : 9), u = entre(rnd, 1, 9);
    return d * 10 + u;
  }
  if (n === 2) {
    return entre(rnd, 1, facil ? 3 : 9) * 100 + entre(rnd, 1, 9) * 10 + entre(rnd, 1, 9);
  }
  return entre(rnd, 1, 9) * 100 + entre(rnd, 1, 9) * 10 + entre(rnd, 1, 9);
}

function numeroConCero(rnd, facil) {
  if (facil) return entre(rnd, 1, 9) * 10;
  const tipo = entre(rnd, 0, 4);
  if (tipo === 0) return 1000;
  const c = entre(rnd, 1, 9);
  if (tipo === 1) return c * 100 + entre(rnd, 1, 9);
  if (tipo === 2) return c * 100 + entre(rnd, 1, 9) * 10;
  if (tipo === 3) return c * 100;
  return c * 100 + entre(rnd, 1, 9);
}

function pedidoArmar(n, texto, objetivo, extra = {}) {
  return {
    nivel: n, tipo: extra.tipo || "armar", objetivo, texto,
    leer: extra.leer || null,
    dificil: !!extra.dificil,
    subetapa: extra.subetapa || "base",
    a: extra.a, b: extra.b, op: extra.op,
    secuencia: extra.secuencia || null,
    paso: extra.paso || null,
    camiones: extra.camiones || null,
    referencia: extra.referencia ?? null,
    pistas: extra.pistas || null,
  };
}

function cruzaCien(a, b) {
  return Math.floor(Math.max(0, a) / 100) !== Math.floor(Math.max(0, b) / 100);
}

export function secuenciaCruza(nums) {
  return nums.some((x, i) => i > 0 && cruzaCien(nums[i - 1], x));
}

function pedidoContar(rnd, facil) {
  const deDiez = rnd() < 0.7;
  const signo = rnd() < 0.5 ? -1 : 1;
  const paso = (deDiez ? 10 : 100) * signo;
  if (!deDiez) {
    const tope = signo > 0 ? (facil ? 2 : 7) : (facil ? 4 : 10);
    const piso = signo > 0 ? 0 : 3;
    const start = entre(rnd, piso, tope) * 100;
    const seq = [0, 1, 2, 3].map((k) => start + paso * k);
    if (seq.some((x) => x < 0 || x > 1000)) return null;
    return pedidoArmar(6, `De ${Math.abs(paso)} en ${Math.abs(paso)}: ${seq.slice(0, 3).join(", ")}, ¿?`, seq[3], {
      tipo: "contar", secuencia: seq.slice(0, 3), paso, subetapa: "base",
    });
  }
  const H = (facil ? entre(rnd, 1, 2) : entre(rnd, 1, 10)) * 100;
  const i = entre(rnd, 0, 2);
  const antes = signo > 0 ? H - 10 : H;
  const seq = [0, 1, 2, 3].map((k) => antes + signo * 10 * (k - i));
  if (seq.some((x) => x < 0 || x > 1000)) return null;
  if (!secuenciaCruza(seq)) return null;
  return pedidoArmar(6, `De 10 en 10: ${seq.slice(0, 3).join(", ")}, ¿?`, seq[3], {
    tipo: "contar", secuencia: seq.slice(0, 3), paso, subetapa: "base",
  });
}

const SUMAS_SEGURAS = { sin: [231, 123], una: [347, 125], dos: [347, 256] };

function pedidoSuma(sub, rnd) {
  const clave = sub === "sin" || sub === "una" || sub === "dos" ? sub : "sin";
  const hallado = intentar(rnd, () => {
    const x = entre(rnd, 1, 899), y = entre(rnd, 1, 1000 - x);
    const L = llevarSuma(x, y);
    if (L.r > 1000 || L.r < 1) return null;
    if (clave === "sin" && L.total === 0) return [x, y];
    if (clave === "una" && L.llevaU === 1 && L.llevaD === 0 && L.llevaC === 0) return [x, y];
    if (clave === "dos" && L.llevaU === 1 && L.llevaD === 1 && L.r <= 1000) return [x, y];
    return null;
  }, SUMAS_SEGURAS[clave]);
  const [x, y] = hallado;
  return pedidoArmar(7, `${x} + ${y}`, x + y, {
    tipo: "sumar", a: x, b: y, op: "+", dificil: sub !== "sin", subetapa: sub,
  });
}

const RESTAS_SEGURAS = { sin: [456, 123], una: [456, 128], dos: [456, 167], ceros: [400, 128] };

function pedidoResta(sub, rnd) {
  const clave = RESTAS_SEGURAS[sub] ? sub : "sin";
  const hallado = intentar(rnd, () => {
    const x = entre(rnd, 2, 1000), y = entre(rnd, 1, x);
    const P = prestamos(x, y);
    if (sub === "sin" && P.n === 0) return [x, y];
    if (sub === "una" && P.unos && !P.decenas && !P.centenas && !P.cascada) return [x, y];
    if (sub === "dos" && P.unos && P.decenas && !P.centenas && !P.cascada) return [x, y];
    if (sub === "ceros" && P.medio && x >= 100) return [x, y];
    return null;
  }, RESTAS_SEGURAS[clave]);
  const [x, y] = hallado;
  return pedidoArmar(8, `${x} − ${y}`, x - y, {
    tipo: "restar", a: x, b: y, op: "-", dificil: sub !== "sin", subetapa: sub,
  });
}

function pedidoPalabras(sub, rnd, facil) {
  if (sub === "desarrollada") {
    const n = numeroNivel(2, rnd, facil);
    return pedidoArmar(4, desarrollada(n), n, { tipo: "desarrollada", leer: desarrollada(n).replaceAll(" + ", " más "), subetapa: sub });
  }
  if (sub === "decenas") {
    const n = intentar(rnd, () => {
      const c = uno(rnd, [1, 2, 3, 4, 6, 8]);
      const d = entre(rnd, 2, 9);
      const x = c * 100 + d * 10;
      return esDecenaExactaRegular(x) ? x : null;
    }, 230);
    const palabras = enPalabras(n);
    return pedidoArmar(4, palabras, n, { tipo: "palabras", leer: palabras, subetapa: sub });
  }
  const n = intentar(rnd, () => {
    const tipo = entre(rnd, 0, 3);
    if (tipo === 0) return uno(rnd, [16, 116, 216, 316, 416, 516, 616, 716, 816, 916]);
    if (tipo === 1) return uno(rnd, [21, 22, 25, 29, 121, 221, 321, 421, 621]);
    if (tipo === 2) return uno(rnd, [500, 516, 530, 547, 700, 716, 721, 748, 900, 916, 921, 935]);
    const x = entre(rnd, 16, 999);
    return esIrregular(x) ? x : null;
  }, 516);
  const palabras = enPalabras(n);
  return pedidoArmar(4, palabras, n, { tipo: "palabras", leer: palabras, subetapa: sub });
}

function pedidoComparar(rnd) {
  const tipo = uno(rnd, ["mas", "menos", "mayor", "menor", "igual", "ordenar"]);
  if (tipo === "ordenar") {
    const usados = new Set();
    const cams = [];
    while (cams.length < 3) {
      const n = entre(rnd, 11, 999);
      if (usados.has(n)) continue;
      usados.add(n);
      cams.push(n);
    }
    if (cams[0] < cams[1] && cams[1] < cams[2]) [cams[0], cams[1]] = [cams[1], cams[0]];
    return pedidoArmar(5, "Ordénalos del menor al mayor.", null, { tipo: "ordenar", camiones: cams, subetapa: "base" });
  }
  if (tipo === "mas") {
    const ref = entre(rnd, 10, 999);
    return pedidoArmar(5, `1 más que ${ref}`, ref + 1, { tipo: "mas", referencia: ref });
  }
  if (tipo === "menos") {
    const ref = entre(rnd, 11, 1000);
    return pedidoArmar(5, `1 menos que ${ref}`, ref - 1, { tipo: "menos", referencia: ref });
  }
  if (tipo === "mayor") {
    const ref = entre(rnd, 10, 900);
    return pedidoArmar(5, `Un número mayor que ${ref}`, null, { tipo: "mayor", referencia: ref });
  }
  if (tipo === "menor") {
    const ref = entre(rnd, 20, 1000);
    return pedidoArmar(5, `Un número menor que ${ref}`, null, { tipo: "menor", referencia: ref });
  }
  const ref = entre(rnd, 11, 999);
  return pedidoArmar(5, `Un número igual a ${ref}`, ref, { tipo: "igual", referencia: ref });
}

const FALLBACK = {
  1: () => pedidoArmar(1, "Arma 47", 47),
  2: () => pedidoArmar(2, "347", 347),
  3: () => pedidoArmar(3, "305", 305, { dificil: true, subetapa: "base" }),
  4: () => pedidoArmar(4, "300 + 40 + 7", 347, { tipo: "desarrollada", subetapa: "desarrollada" }),
  5: () => pedidoArmar(5, "1 más que 46", 47, { tipo: "mas", referencia: 46 }),
  6: () => pedidoArmar(6, "De 10 en 10: 180, 190, 200, ¿?", 210, { tipo: "contar", secuencia: [180, 190, 200], paso: 10 }),
  7: () => pedidoArmar(7, "231 + 123", 354, { tipo: "sumar", a: 231, b: 123, op: "+", dificil: false, subetapa: "sin" }),
  8: () => pedidoArmar(8, "456 − 123", 333, { tipo: "restar", a: 456, b: 123, op: "-", dificil: false, subetapa: "sin" }),
};

export function crearPedido(n, rnd, { sub = "base", facil = false } = {}) {
  const hecho = intentar(rnd, () => {
    if (n <= 1) {
      const objetivo = numeroNivel(1, rnd, facil);
      return pedidoArmar(1, `Arma ${objetivo}`, objetivo, { subetapa: "base" });
    }
    if (n === 2) {
      const objetivo = numeroNivel(2, rnd, facil);
      if (!sinCeros(objetivo)) return null;
      return pedidoArmar(2, String(objetivo), objetivo, { subetapa: "base" });
    }
    if (n === 3) {
      const objetivo = numeroConCero(rnd, facil);
      if (!tieneCero(objetivo)) return null;
      return pedidoArmar(3, String(objetivo), objetivo, { dificil: true, subetapa: "base" });
    }
    if (n === 4) return pedidoPalabras(sub === "base" ? "desarrollada" : sub, rnd, facil);
    if (n === 5) return pedidoComparar(rnd);
    if (n === 6) return pedidoContar(rnd, facil);
    if (n === 7) return pedidoSuma(sub === "base" ? "sin" : sub, rnd);
    if (n === 8) return pedidoResta(sub === "base" ? "sin" : sub, rnd);
    return null;
  }, null);
  const pedido = hecho || FALLBACK[n]();
  pedido.facil = !!facil;
  return pedido;
}

export function esCorrecto(pedido, valorHecho, extra) {
  if (pedido.tipo === "mayor") return valorHecho > pedido.referencia && valorHecho <= 1000;
  if (pedido.tipo === "menor") return valorHecho >= 1 && valorHecho < pedido.referencia;
  if (pedido.tipo === "ordenar") {
    const o = extra && extra.orden;
    if (!o || o.length !== (pedido.camiones || []).length) return false;
    return o.every((x, i) => i === 0 || o[i - 1] <= x);
  }
  return valorHecho === pedido.objetivo;
}

// Ejemplo para mostrar en el segundo intento cuando el pedido no tiene un solo número
// (mayor / menor). En el resto, el objetivo.
export function ejemploDe(pedido) {
  if (pedido.tipo === "mayor") return Math.min(1000, pedido.referencia + 1);
  if (pedido.tipo === "menor") return Math.max(1, pedido.referencia - 1);
  if (pedido.tipo === "ordenar") return [...pedido.camiones].sort((a, b) => a - b);
  return pedido.objetivo;
}

export function estadoInicialDe(pedido) {
  if (pedido.tipo === "sumar" || pedido.tipo === "restar") return pedido.a;
  if (pedido.tipo === "contar") return pedido.secuencia[pedido.secuencia.length - 1];
  return 0;
}

export function textoCamion(pedido) {
  if (pedido.tipo === "desarrollada") return pedido.texto;
  if (pedido.tipo === "palabras" || pedido.tipo === "mayor" || pedido.tipo === "menor") return "?";
  if (pedido.tipo === "mas" || pedido.tipo === "menos" || pedido.tipo === "igual") return String(pedido.referencia);
  if (pedido.tipo === "contar") return `${pedido.secuencia[pedido.secuencia.length - 1]}`;
  if (pedido.tipo === "sumar") return `${pedido.a}+${pedido.b}`;
  if (pedido.tipo === "restar") return `${pedido.a}−${pedido.b}`;
  if (pedido.objetivo == null) return "?";
  return String(pedido.objetivo);
}
