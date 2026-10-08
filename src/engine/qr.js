// Código QR sin dependencias, para que la TV enseñe la liga del control (issue #3). Función pura.
// Solo lo necesario aquí: modo byte (UTF-8), corrección de errores nivel M y versiones 1 a 10 (hasta 213 bytes;
// la liga del control ocupa ~55). Sigue la norma ISO/IEC 18004; la estructura es la del generador de Nayuki.
//
//   const m = qr("https://…/control.html?sala=4729");   // matriz de booleanos (true = cuadrito oscuro)
//   qrSvg(m)                                              // <svg> listo para meter en la página

// Por versión (1–10), nivel M: códigos de corrección por bloque y número de bloques (tabla 9 de la norma)
const ECC_POR_BLOQUE = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const BLOQUES = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const FORMATO_M = 0; // bits del nivel M en la información de formato (L=1, M=0, Q=3, H=2)
export const VERSION_MAX = 10;

const bit = (x, i) => ((x >>> i) & 1) !== 0;

function modulosDeDatos(ver) {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const n = Math.floor(ver / 7) + 2;
    r -= (25 * n - 10) * n - 55;
    if (ver >= 7) r -= 36;
  }
  return r;
}
const codigosDeDatos = (ver) => Math.floor(modulosDeDatos(ver) / 8) - ECC_POR_BLOQUE[ver] * BLOQUES[ver];

// ---------- Reed-Solomon en GF(256) con el polinomio 0x11D ----------
function multiplicar(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}
function divisor(grado) {
  const r = new Array(grado).fill(0);
  r[grado - 1] = 1;
  let raiz = 1;
  for (let i = 0; i < grado; i++) {
    for (let j = 0; j < r.length; j++) {
      r[j] = multiplicar(r[j], raiz);
      if (j + 1 < r.length) r[j] ^= r[j + 1];
    }
    raiz = multiplicar(raiz, 0x02);
  }
  return r;
}
function residuo(datos, div) {
  const r = div.map(() => 0);
  for (const b of datos) {
    const f = b ^ r.shift();
    r.push(0);
    div.forEach((c, i) => { r[i] ^= multiplicar(c, f); });
  }
  return r;
}

// ---------- Datos → palabras de código (con corrección y entrelazado) ----------
function utf8(texto) {
  if (typeof TextEncoder !== "undefined") return Array.from(new TextEncoder().encode(texto));
  return Array.from(unescape(encodeURIComponent(texto)), (c) => c.charCodeAt(0));
}

function palabras(bytes, ver) {
  const bits = [];
  const poner = (valor, n) => { for (let i = n - 1; i >= 0; i--) bits.push((valor >>> i) & 1); };
  poner(0b0100, 4);                         // modo byte
  poner(bytes.length, ver <= 9 ? 8 : 16);   // cuántos bytes
  for (const b of bytes) poner(b, 8);
  const capacidad = codigosDeDatos(ver) * 8;
  poner(0, Math.min(4, capacidad - bits.length)); // terminador
  poner(0, (8 - (bits.length % 8)) % 8);
  for (let relleno = 0xec; bits.length < capacidad; relleno ^= 0xec ^ 0x11) poner(relleno, 8);
  const datos = [];
  for (let i = 0; i < bits.length; i += 8) datos.push(parseInt(bits.slice(i, i + 8).join(""), 2));

  // Partir en bloques, agregar la corrección de cada uno y entrelazar
  const nb = BLOQUES[ver], ecc = ECC_POR_BLOQUE[ver];
  const total = Math.floor(modulosDeDatos(ver) / 8);
  const cortos = nb - (total % nb), largoCorto = Math.floor(total / nb);
  const div = divisor(ecc);
  const bloques = [];
  for (let i = 0, k = 0; i < nb; i++) {
    const d = datos.slice(k, k + largoCorto - ecc + (i < cortos ? 0 : 1));
    k += d.length;
    const e = residuo(d, div);
    if (i < cortos) d.push(0); // hueco para que todos midan igual (no se transmite)
    bloques.push(d.concat(e));
  }
  const out = [];
  for (let i = 0; i < bloques[0].length; i++)
    bloques.forEach((b, j) => { if (i !== largoCorto - ecc || j >= cortos) out.push(b[i]); });
  return out;
}

// ---------- La matriz ----------
function posicionesAlineacion(ver, tam) {
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2;
  const paso = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
  const r = [6];
  for (let p = tam - 7; r.length < n; p -= paso) r.splice(1, 0, p);
  return r;
}

function construir(ver, cw, mascara) {
  const tam = ver * 4 + 17;
  const m = Array.from({ length: tam }, () => new Array(tam).fill(false));
  const fija = Array.from({ length: tam }, () => new Array(tam).fill(false));
  const poner = (x, y, v) => { m[y][x] = v; fija[y][x] = true; };

  // Patrones de tiempo
  for (let i = 0; i < tam; i++) { poner(6, i, i % 2 === 0); poner(i, 6, i % 2 === 0); }
  // Patrones de búsqueda (las tres esquinas) con su separador
  for (const [cx, cy] of [[3, 3], [tam - 4, 3], [3, tam - 4]])
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
      if (x >= 0 && x < tam && y >= 0 && y < tam) poner(x, y, d !== 2 && d !== 4);
    }
  // Patrones de alineación
  const al = posicionesAlineacion(ver, tam);
  for (let i = 0; i < al.length; i++) for (let j = 0; j < al.length; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) poner(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  formato(m, fija, tam, mascara, poner);
  // Información de versión (7 en adelante)
  if (ver >= 7) {
    let r = ver;
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const bits = (ver << 12) | r;
    for (let i = 0; i < 18; i++) {
      const a = tam - 11 + (i % 3), b = Math.floor(i / 3);
      poner(a, b, bit(bits, i)); poner(b, a, bit(bits, i));
    }
  }
  // Datos en zigzag, de dos en dos columnas, de derecha a izquierda
  let i = 0;
  for (let der = tam - 1; der >= 1; der -= 2) {
    if (der === 6) der = 5;
    for (let v = 0; v < tam; v++) for (let j = 0; j < 2; j++) {
      const x = der - j, sube = ((der + 1) & 2) === 0, y = sube ? tam - 1 - v : v;
      if (!fija[y][x] && i < cw.length * 8) { m[y][x] = bit(cw[i >>> 3], 7 - (i & 7)); i++; }
    }
  }
  // Máscara
  for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++)
    if (!fija[y][x] && enMascara(mascara, x, y)) m[y][x] = !m[y][x];
  return m;
}

function formato(m, fija, tam, mascara, poner) {
  const datos = (FORMATO_M << 3) | mascara;
  let r = datos;
  for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
  const bits = ((datos << 10) | r) ^ 0x5412;
  for (let i = 0; i <= 5; i++) poner(8, i, bit(bits, i));
  poner(8, 7, bit(bits, 6)); poner(8, 8, bit(bits, 7)); poner(7, 8, bit(bits, 8));
  for (let i = 9; i < 15; i++) poner(14 - i, 8, bit(bits, i));
  for (let i = 0; i < 8; i++) poner(tam - 1 - i, 8, bit(bits, i));
  for (let i = 8; i < 15; i++) poner(8, tam - 15 + i, bit(bits, i));
  poner(8, tam - 8, true); // siempre oscuro
}

function enMascara(k, x, y) {
  switch (k) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

// Castigo de la norma para escoger la máscara que se lee mejor (rachas, bloques 2×2, falsos patrones, balance)
export function castigo(m) {
  const tam = m.length;
  let p = 0;
  const linea = (get) => {
    let racha = 1;
    for (let i = 1; i <= tam; i++) {
      if (i < tam && get(i) === get(i - 1)) racha++;
      else { if (racha >= 5) p += racha - 2; racha = 1; }
    }
    for (let i = 0; i + 11 <= tam; i++) {
      const s = Array.from({ length: 11 }, (_, k) => (get(i + k) ? 1 : 0)).join("");
      if (s === "10111010000" || s === "00001011101") p += 40;
    }
  };
  for (let y = 0; y < tam; y++) linea((x) => m[y][x]);
  for (let x = 0; x < tam; x++) linea((y) => m[y][x]);
  let oscuros = 0;
  for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) {
    if (m[y][x]) oscuros++;
    if (x < tam - 1 && y < tam - 1 && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
  }
  p += 10 * Math.floor(Math.abs(oscuros * 100 / (tam * tam) - 50) / 5);
  return p;
}

// Texto → matriz cuadrada de booleanos (sin margen). opts.mascara (0–7) fuerza una máscara (para pruebas).
export function qr(texto, opts = {}) {
  const bytes = utf8(String(texto));
  let ver = 1;
  while (ver <= VERSION_MAX && codigosDeDatos(ver) * 8 < 4 + (ver <= 9 ? 8 : 16) + bytes.length * 8) ver++;
  if (ver > VERSION_MAX) throw new Error("Texto demasiado largo para el QR");
  const cw = palabras(bytes, ver);
  if (opts.mascara !== undefined) return construir(ver, cw, opts.mascara);
  let mejor = null, menor = Infinity;
  for (let k = 0; k < 8; k++) {
    const m = construir(ver, cw, k), c = castigo(m);
    if (c < menor) { menor = c; mejor = m; }
  }
  return mejor;
}

// Matriz → <svg> (un solo <path>, con margen de 4 cuadritos como pide la norma). Fondo claro siempre:
// en tema oscuro un QR invertido no lo leen todas las cámaras.
export function qrSvg(m, { margen = 4, oscuro = "#2b2236", claro = "#ffffff", titulo = "Código QR" } = {}) {
  const t = m.length + margen * 2;
  let d = "";
  for (let y = 0; y < m.length; y++) for (let x = 0; x < m.length; x++) if (m[y][x]) d += `M${x + margen},${y + margen}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" shape-rendering="crispEdges" role="img" aria-label="${titulo}">` +
    `<rect width="${t}" height="${t}" fill="${claro}"/><path d="${d}" fill="${oscuro}"/></svg>`;
}
