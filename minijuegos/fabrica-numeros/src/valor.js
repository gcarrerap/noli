// Valor posicional y reagrupamiento. El estado puede tener una banda en 10
// (todavía no canjeada) o el mil ya pegado. Ningún canje cambia el valor.

export const BANDAS = ["c", "d", "u"];
export const ARRIBA = { u: "d", d: "c", c: "mil" };
export const VALOR_BANDA = { c: 100, d: 10, u: 1 };
export const NOMBRE = {
  c: ["placa", "placas"],
  d: ["barra", "barras"],
  u: ["cubito", "cubitos"],
};

export const FRASE = {
  pegar: {
    u: "10 cubitos son 1 barra",
    d: "10 barras son 1 placa",
    c: "10 placas son 1 mil",
  },
  triturar: {
    u: "1 barra son 10 cubitos",
    d: "1 placa son 10 barras",
    c: "1 mil son 10 placas",
  },
};

export const DURACION_LARGA = 2000;
export const DURACION_CORTA = 600;

export const vacio = () => ({ mil: 0, c: 0, d: 0, u: 0 });

export function desdeNumero(n) {
  const x = Math.max(0, Math.min(1000, n | 0));
  if (x === 1000) return { mil: 1, c: 0, d: 0, u: 0 };
  return { mil: 0, c: Math.floor(x / 100), d: Math.floor(x / 10) % 10, u: x % 10 };
}

export function valor(e) {
  return e.mil * 1000 + e.c * 100 + e.d * 10 + e.u;
}

export function puedeEnviar(e) {
  return e.c < 10 && e.d < 10 && e.u < 10;
}

export function puedePegar(e, banda) {
  if (e[banda] !== 10) return false;
  if (banda === "u") return e.d < 10;
  if (banda === "d") return e.c < 10;
  return e.mil === 0;
}

export function puedeTriturar(e, banda) {
  if (e[banda] !== 0) return false;
  if (banda === "u") return e.d >= 1;
  if (banda === "d") return e.c >= 1;
  return e.mil >= 1;
}

// Sube una pieza. En 9 pasa a 10 (no da la vuelta). En 10 no suma: hay que pegar.
export function subir(e, banda) {
  if (e.mil && e[banda] < 10) return { estado: e, accion: "tope" };
  if (e[banda] >= 10) return { estado: e, accion: "pegar" };
  return { estado: { ...e, [banda]: e[banda] + 1 }, accion: "suma" };
}

// Baja una pieza. En 0 no da la vuelta: si arriba hay una pieza, toca triturar.
export function bajar(e, banda) {
  if (e[banda] > 0) return { estado: { ...e, [banda]: e[banda] - 1 }, accion: "resta" };
  if (puedeTriturar(e, banda)) return { estado: e, accion: "triturar" };
  return { estado: e, accion: "nada" };
}

export function pegar(e, banda) {
  if (!puedePegar(e, banda)) return null;
  const antes = valor(e);
  const sig = { ...e };
  if (banda === "u") { sig.u = 0; sig.d += 1; }
  else if (banda === "d") { sig.d = 0; sig.c += 1; }
  else { sig.c = 0; sig.mil = 1; }
  return { estado: sig, valor: antes, frase: FRASE.pegar[banda] };
}

export function triturar(e, banda) {
  if (!puedeTriturar(e, banda)) return null;
  const antes = valor(e);
  const sig = { ...e, [banda]: 10 };
  if (banda === "u") sig.d -= 1;
  else if (banda === "d") sig.c -= 1;
  else sig.mil = 0;
  return { estado: sig, valor: antes, frase: FRASE.triturar[banda] };
}

export function bandaParaPegar(e, preferida) {
  if (preferida && puedePegar(e, preferida)) return preferida;
  return BANDAS.find((b) => puedePegar(e, b)) || null;
}

export function duracionCanje(primero) {
  return primero ? DURACION_LARGA : DURACION_CORTA;
}

export function guionCanje(sentido, banda) {
  return { frase: FRASE[sentido][banda], cuenta: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] };
}

export function estiloCanje(reducido) {
  return reducido ? "desvanece" : "cae";
}

const pieza = (n, banda) => `${n} ${NOMBRE[banda][n === 1 ? 0 : 1]}`;

// Qué le falta o le sobra en cada banda, comparado con el número pedido.
export function informe(hecho, objetivo) {
  const meta = typeof objetivo === "number" ? desdeNumero(objetivo) : objetivo;
  const filas = [];
  if ((hecho.mil || 0) !== (meta.mil || 0)) {
    filas.push({ banda: "mil", ok: false, texto: hecho.mil ? "sobra el mil" : "falta el mil" });
  }
  for (const b of BANDAS) {
    const diff = (hecho[b] || 0) - (meta[b] || 0);
    if (diff === 0) filas.push({ banda: b, ok: true, texto: "bien" });
    else if (diff < 0) filas.push({ banda: b, ok: false, texto: `faltan ${pieza(-diff, b)}` });
    else filas.push({ banda: b, ok: false, texto: `sobran ${pieza(diff, b)}` });
  }
  return filas;
}

// La banda más chica que no coincide: es la que se ilumina tras varios fallos.
export function bandaEquivocada(hecho, objetivo) {
  const filas = informe(hecho, objetivo);
  const mal = filas.filter((f) => !f.ok && f.banda !== "mil");
  if (!mal.length) return filas.some((f) => !f.ok) ? "c" : null;
  return mal[mal.length - 1].banda;
}

export function lectura(e, banda) {
  if (banda === "c" && e.mil) return String(1000 + e.c * 100);
  return String(e[banda] * VALOR_BANDA[banda]);
}
