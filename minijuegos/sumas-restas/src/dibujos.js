// Pista dibujada en SVG (nunca emojis: en la TV LG salen en blanco y negro, #5).
//  - Hasta 20: cuadros de diez (dos filas de 5). Suma: dos colores. Resta: se tachan los que se quitan.
//  - Hasta 100: bloques de decenas (barras de 10) y unidades (cuadritos). En las restas que piden prestado,
//    una decena se ve ya "rota" en 10 unidades, que es justo lo que hay que entender.
const C1 = "#4cb3ff", C2 = "#ff6b4a", TACHE = "#2b2236", VACIO = "none";
const u = (n) => n % 10, d = (n) => Math.floor(n / 10);

export function pista(p, tipo) {
  if (p.falta !== "r") return faltante(p, tipo);
  return tipo === "cuadros" ? cuadros(p) : bloques(p);
}

// ---------- Cuadros de diez ----------

function cuadros(p) {
  // Lista de puntitos: { color, tache }
  const pts = [];
  if (p.op === "+") { for (let i = 0; i < p.a; i++) pts.push({ c: C1 }); for (let i = 0; i < p.b; i++) pts.push({ c: C2 }); }
  else { for (let i = 0; i < p.a; i++) pts.push({ c: C1, x: i >= p.a - p.b }); }
  return marcos(pts);
}

function marcos(pts) {
  const n = Math.max(1, Math.ceil(pts.length / 10)), R = 9, S = 24, W = 5 * S + 8, H = 2 * S + 8, G = 14;
  let s = "";
  for (let m = 0; m < n; m++) {
    const ox = m * (W + G);
    s += `<rect x="${ox + 1}" y="1" width="${W - 2}" height="${H - 2}" rx="8" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="2"/>`;
    for (let k = 0; k < 10; k++) {
      const cx = ox + 4 + (k % 5) * S + S / 2, cy = 4 + Math.floor(k / 5) * S + S / 2, pt = pts[m * 10 + k];
      if (!pt) { s += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="currentColor" stroke-opacity=".15" stroke-width="2"/>`; continue; }
      s += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${pt.vacio ? VACIO : pt.c}" stroke="${pt.vacio ? pt.c : "rgba(0,0,0,.2)"}" stroke-width="${pt.vacio ? 2.5 : 1.5}" ${pt.vacio ? 'stroke-dasharray="4 3"' : ""}/>`;
      if (pt.x) s += `<path d="M${cx - 8} ${cy - 8}l16 16M${cx + 8} ${cy - 8}l-16 16" stroke="${TACHE}" stroke-width="3" stroke-linecap="round"/>`;
    }
  }
  return svg(n * W + (n - 1) * G, H, s);
}

// ---------- Bloques de decenas y unidades ----------

// Dibuja `decenas` barras y `unidades` cuadritos a partir de x; tacheD/tacheU: cuántos se tachan (de los últimos)
function grupo(x, decenas, unidades, color, tacheD = 0, tacheU = 0, rotas = 0) {
  const Q = 9, s0 = [];
  let cx = x;
  for (let i = 0; i < decenas; i++) {
    s0.push(`<rect x="${cx}" y="2" width="${Q + 2}" height="${10 * Q + 2}" rx="2" fill="${color}" stroke="rgba(0,0,0,.25)"/>`);
    for (let k = 1; k < 10; k++) s0.push(`<line x1="${cx}" x2="${cx + Q + 2}" y1="${2 + k * Q + 1}" y2="${2 + k * Q + 1}" stroke="rgba(0,0,0,.18)"/>`);
    if (i >= decenas - tacheD) s0.push(tache(cx + (Q + 2) / 2, 2 + 5 * Q, 10, 46));
    cx += Q + 7;
  }
  // Unidades en columnas de 5 (las que vienen de una decena rota van primero y con borde punteado)
  for (let i = 0; i < unidades; i++) {
    const col = Math.floor(i / 5), fila = i % 5, ux = cx + col * (Q + 4), uy = 2 + 10 * Q - (fila + 1) * (Q + 4) + 4;
    const rota = i < rotas;
    s0.push(`<rect x="${ux}" y="${uy}" width="${Q + 1}" height="${Q + 1}" rx="2" fill="${color}" stroke="${rota ? TACHE : "rgba(0,0,0,.25)"}" ${rota ? 'stroke-dasharray="2 2"' : ""}/>`);
    if (i >= unidades - tacheU) s0.push(tache(ux + (Q + 1) / 2, uy + (Q + 1) / 2, 6, 6));
  }
  const ancho = cx - x + Math.ceil(unidades / 5) * (Q + 4);
  return { s: s0.join(""), ancho: Math.max(ancho, 1) };
}

const tache = (cx, cy, w, h) => `<path d="M${cx - w} ${cy - h}L${cx + w} ${cy + h}M${cx + w} ${cy - h}L${cx - w} ${cy + h}" stroke="${TACHE}" stroke-width="2.5" stroke-linecap="round"/>`;
const signo = (x, t) => `<text x="${x}" y="58" font-size="34" font-weight="700" text-anchor="middle" fill="currentColor">${t}</text>`;

function bloques(p) {
  if (p.op === "+") {
    const g1 = grupo(0, d(p.a), u(p.a), C1);
    const g2 = grupo(g1.ancho + 40, d(p.b), u(p.b), C2);
    return svg(g1.ancho + 40 + g2.ancho, 96, g1.s + signo(g1.ancho + 20, "+") + g2.s);
  }
  // Resta: si las unidades no alcanzan, una decena se rompe en 10 unidades
  const pide = u(p.a) < u(p.b);
  const g = grupo(0, d(p.a) - (pide ? 1 : 0), u(p.a) + (pide ? 10 : 0), C1, d(p.b), u(p.b), pide ? 10 : 0);
  return svg(g.ancho, 96, g.s);
}

// ---------- Número que falta ----------

function faltante(p, tipo) {
  if (tipo === "cuadros") {
    // Suma: lo que ya hay en color y lo que falta para llegar al total, vacío. Resta: el total y lo que quedó.
    const pts = [];
    if (p.op === "+") {
      const conocido = p.falta === "a" ? p.b : p.a;
      for (let i = 0; i < p.r; i++) pts.push(i < conocido ? { c: C1 } : { c: C2, vacio: true });
    } else if (p.falta === "b") {
      for (let i = 0; i < p.a; i++) pts.push(i < p.r ? { c: C1 } : { c: C2, vacio: true });
    } else {
      for (let i = 0; i < p.r + p.b; i++) pts.push(i < p.r ? { c: C1 } : { c: C2, vacio: true });
      if (!pts.length) pts.push({ c: C2, vacio: true });
    }
    return marcos(pts);
  }
  // Hasta 100: dibuja lo que se conoce y un cuadro con "?" para lo que falta
  const partes = [p.falta === "a" ? null : p.a, p.op === "+" ? "+" : "−", p.falta === "b" ? null : p.b, "=", p.r];
  let x = 0, s = "";
  for (const q of partes) {
    if (q === "+" || q === "−" || q === "=") { s += signo(x + 16, q); x += 32; continue; }
    if (q === null) { s += `<rect x="${x}" y="22" width="52" height="52" rx="10" fill="none" stroke="${C2}" stroke-width="3" stroke-dasharray="6 4"/><text x="${x + 26}" y="60" font-size="30" font-weight="700" text-anchor="middle" fill="${C2}">?</text>`; x += 60; continue; }
    const g = grupo(x, d(q), u(q), C1); s += g.s; x += g.ancho + 8;
  }
  return svg(x, 96, s);
}

const svg = (w, h, s) => `<svg class="pista-svg" viewBox="-4 -4 ${w + 8} ${h + 8}" role="img" aria-label="Pista">${s}</svg>`;
