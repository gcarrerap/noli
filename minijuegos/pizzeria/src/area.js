// Parte una figura por los cortes (segmentos) y mide el área de cada pedazo.
// Los cortes vienen de datos y se dibujan como <line> en el SVG.
// El círculo se aproxima con un polígono; el rectángulo es la masa de la pizza.

const EPS = 1e-7;

export function poligonoCirculo(r = 100, n = 128) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push(snap([r * Math.cos(a), r * Math.sin(a)]));
  }
  return pts;
}

// Masa de pizza-rectangular.svg: x 8–232, y 8–152.
export function poligonoRect() {
  return [[8, 8], [232, 8], [232, 152], [8, 152]];
}

export function snap(p) {
  return [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000];
}

export function areaFirmada(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

export function area(poly) {
  return Math.abs(areaFirmada(poly));
}

function cerca(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-4;
}

// Recorta un segmento contra un polígono convexo en sentido antihorario
// (en coordenadas matemáticas). Devuelve null si no queda nada dentro.
export function clipConvexo(poly, a, b) {
  let t0 = 0, t1 = 1;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const ex = q[0] - p[0], ey = q[1] - p[1];
    // Interior a la izquierda (polígono antihorario): normal hacia adentro.
    const nx = -ey, ny = ex;
    const wn = nx * (a[0] - p[0]) + ny * (a[1] - p[1]);
    const wd = nx * dx + ny * dy;
    if (Math.abs(wd) < 1e-12) {
      if (wn < -1e-6) return null;
      continue;
    }
    const t = -wn / wd;
    if (wd > 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1 + 1e-9) return null;
  }
  if (t1 - t0 < 1e-8) return null;
  return [snap([a[0] + t0 * dx, a[1] + t0 * dy]), snap([a[0] + t1 * dx, a[1] + t1 * dy])];
}

function intersec(a, b, c, d) {
  const rx = b[0] - a[0], ry = b[1] - a[1];
  const sx = d[0] - c[0], sy = d[1] - c[1];
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-12) return null;
  const qpx = c[0] - a[0], qpy = c[1] - a[1];
  const t = (qpx * sy - qpy * sx) / den;
  const u = (qpx * ry - qpy * rx) / den;
  if (t < -1e-4 || t > 1 + 1e-4 || u < -1e-4 || u > 1 + 1e-4) return null;
  return snap([a[0] + t * rx, a[1] + t * ry]);
}

function clave(p) {
  return p[0].toFixed(3) + "," + p[1].toFixed(3);
}

function puntoDentro(poly, p) {
  let dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    const cruza = (yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi + 0.0) + xi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

export function centroide(poly) {
  let x = 0, y = 0, a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const cruz = p[0] * q[1] - q[0] * p[1];
    a += cruz;
    x += (p[0] + q[0]) * cruz;
    y += (p[1] + q[1]) * cruz;
  }
  if (Math.abs(a) < 1e-9) {
    const s = poly.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]);
    return [s[0] / poly.length, s[1] / poly.length];
  }
  return [x / (3 * a), y / (3 * a)];
}

// Caras interiores que dejan los cortes. Cada cara es una lista de puntos.
export function partir(poly, cortes) {
  const segmentos = [];
  for (let i = 0; i < poly.length; i++) segmentos.push([poly[i], poly[(i + 1) % poly.length]]);
  for (const c of cortes || []) {
    const clip = clipConvexo(poly, [c.x1, c.y1], [c.x2, c.y2]);
    if (clip && !cerca(clip[0], clip[1])) segmentos.push(clip);
  }
  const cadenas = segmentos.map((seg) => {
    const pts = [seg[0], seg[1]];
    for (const otro of segmentos) {
      if (otro === seg) continue;
      const hit = intersec(seg[0], seg[1], otro[0], otro[1]);
      if (hit) pts.push(hit);
    }
    const dx = seg[1][0] - seg[0][0], dy = seg[1][1] - seg[0][1];
    pts.sort((p, q) => (p[0] - seg[0][0]) * dx + (p[1] - seg[0][1]) * dy - ((q[0] - seg[0][0]) * dx + (q[1] - seg[0][1]) * dy));
    const uniq = [];
    for (const p of pts) if (!uniq.length || !cerca(uniq[uniq.length - 1], p)) uniq.push(snap(p));
    return uniq;
  });

  const verts = new Map();
  const vecinos = new Map();
  const id = (p) => {
    const k = clave(snap(p));
    if (!verts.has(k)) verts.set(k, snap(p));
    if (!vecinos.has(k)) vecinos.set(k, new Set());
    return k;
  };
  const une = (a, b) => {
    const ia = id(a), ib = id(b);
    if (ia === ib) return;
    vecinos.get(ia).add(ib);
    vecinos.get(ib).add(ia);
  };
  for (const cadena of cadenas) {
    for (let i = 0; i < cadena.length - 1; i++) une(cadena[i], cadena[i + 1]);
  }

  const orden = new Map();
  for (const [k, set] of vecinos) {
    const p = verts.get(k);
    orden.set(k, [...set].sort((a, b) => {
      const pa = verts.get(a), pb = verts.get(b);
      return Math.atan2(pa[1] - p[1], pa[0] - p[0]) - Math.atan2(pb[1] - p[1], pb[0] - p[0]);
    }));
  }

  const usadas = new Set();
  const caras = [];
  for (const [k, lista] of orden) {
    for (const nb of lista) {
      if (usadas.has(k + ">" + nb)) continue;
      const cara = [];
      let a = k, b = nb;
      let guard = 0;
      let cerrada = false;
      while (guard++ < 8000) {
        const ar = a + ">" + b;
        if (usadas.has(ar)) break;
        usadas.add(ar);
        cara.push(verts.get(a));
        const listaB = orden.get(b);
        const idx = listaB.indexOf(a);
        if (idx < 0) break;
        const next = listaB[(idx - 1 + listaB.length) % listaB.length];
        a = b;
        b = next;
        if (a === k && b === nb) { cerrada = true; break; }
      }
      if (cerrada && cara.length >= 3) caras.push(cara);
    }
  }

  const total = Math.abs(areaFirmada(poly));
  return caras.filter((c) => {
    const a = Math.abs(areaFirmada(c));
    if (a < 1 || a > total * 0.985) return false;
    return puntoDentro(poly, centroide(c));
  });
}

export function baseDe(forma) {
  return forma === "rectangular" ? poligonoRect() : poligonoCirculo();
}

export function rebanadas(forma, cortes) {
  const base = baseDe(forma);
  const caras = partir(base, cortes).map((puntos) => ({
    puntos,
    area: Math.abs(areaFirmada(puntos)),
    centro: centroide(puntos),
  }));
  if (forma === "redonda") {
    caras.sort((a, b) => Math.atan2(a.centro[1], a.centro[0]) - Math.atan2(b.centro[1], b.centro[0]));
  } else {
    caras.sort((a, b) => a.centro[1] - b.centro[1] || a.centro[0] - b.centro[0]);
  }
  return caras;
}

export function analizar(forma, cortes) {
  const caras = rebanadas(forma, cortes);
  return { partes: caras.length, areas: caras.map((c) => c.area), rebanadas: caras };
}

export function pathDe(puntos) {
  if (!puntos || !puntos.length) return "";
  return puntos.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join("") + "Z";
}

export function sonIguales(areas, tol = 0.04) {
  if (!areas || areas.length < 2) return false;
  const m = areas.reduce((s, a) => s + a, 0) / areas.length;
  if (!(m > 0)) return false;
  return areas.every((a) => Math.abs(a - m) / m <= tol);
}
