// Galletas generadas: variadas, giradas, con pentágonos irregulares
// y cuadriláteros que no son cuadrados. Los lados se cuentan con los puntos.

import { revolver } from "./rng.js";
import { pathDe } from "./area.js";

const POR_LADOS = {
  0: ["circulo"],
  3: ["triangulo", "triangulo-irregular"],
  4: ["cuadrado", "rectangulo", "rombo", "trapecio", "cuad-irregular"],
  5: ["pentagono", "pent-irregular"],
  6: ["hexagono", "hex-irregular"],
};

const NO_CUADRADO = ["rectangulo", "rombo", "trapecio", "cuad-irregular"];

function rotar(pts, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return pts.map(([x, y]) => [+(x * c - y * s).toFixed(2), +(x * s + y * c).toFixed(2)]);
}

function regular(n, radio, ang) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = ang + (i / n) * Math.PI * 2 - Math.PI / 2;
    pts.push([+(radio * Math.cos(a)).toFixed(2), +(radio * Math.sin(a)).toFixed(2)]);
  }
  return pts;
}

function irregular(n, rnd, ang) {
  const paso = (Math.PI * 2) / n;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = ang + i * paso + (rnd() - 0.5) * paso * 0.35 - Math.PI / 2;
    const radio = 34 + rnd() * 14;
    pts.push([+(radio * Math.cos(a)).toFixed(2), +(radio * Math.sin(a)).toFixed(2)]);
  }
  return pts;
}

function preset(tipo) {
  if (tipo === "rectangulo") return [[-28, -18], [28, -18], [28, 18], [-28, 18]];
  if (tipo === "rombo") return [[0, -46], [26, 0], [0, 46], [-26, 0]];
  if (tipo === "trapecio") return [[-40, 22], [40, 22], [22, -28], [-22, -28]];
  return null;
}

let seq = 1;

export function ladosDe(fig) {
  return fig && fig.circulo ? 0 : (fig && fig.puntos ? fig.puntos.length : 0);
}

export function esquinasDe(fig) {
  return ladosDe(fig);
}

export function crearFigura(tipo, rnd) {
  const ang = rnd() * Math.PI * 2;
  const esCirculo = tipo === "circulo";
  let puntos = [];
  if (!esCirculo) {
    const base = preset(tipo);
    if (base) puntos = rotar(base, ang);
    else if (tipo.endsWith("irregular")) {
      const n = tipo.startsWith("triangulo") ? 3 : tipo.startsWith("cuad") ? 4 : tipo.startsWith("pent") ? 5 : 6;
      puntos = irregular(n, rnd, ang);
    } else {
      const n = tipo === "triangulo" ? 3 : tipo === "cuadrado" ? 4 : tipo === "pentagono" ? 5 : 6;
      puntos = regular(n, 46, ang);
    }
  }
  return { id: "g" + (seq++), tipo, circulo: esCirculo, puntos, rotacion: ang };
}

export function reiniciarIds() {
  seq = 1;
}

function tipoDe(lados, rnd, { evitarCuadrado = false } = {}) {
  let bolsa = POR_LADOS[lados] || POR_LADOS[3];
  if (lados === 4 && evitarCuadrado) bolsa = NO_CUADRADO;
  if (lados === 5 && rnd() < 0.8) return "pent-irregular";
  return bolsa[Math.floor(rnd() * bolsa.length)];
}

// Exactamente una opción tiene la cantidad pedida.
export function opcionesForma(cantidad, rnd, facil = false) {
  const otras = [0, 3, 4, 5, 6].filter((n) => n !== cantidad);
  const dist = revolver(rnd, otras).slice(0, facil ? 1 : 2);
  const tipos = [tipoDe(cantidad, rnd, { evitarCuadrado: cantidad === 4 && rnd() < 0.85 }), ...dist.map((n) => tipoDe(n, rnd))];
  const opciones = revolver(rnd, tipos).map((tipo) => crearFigura(tipo, rnd));
  const buenas = opciones.filter((o) => ladosDe(o) === cantidad);
  return { opciones, correcta: buenas[0].id };
}

export { pathDe };

export function nombreFigura(tipo, textos) {
  const par = textos && textos.figuras && textos.figuras[tipo];
  if (par) return { es: par[0], en: par[1] };
  return { es: "", en: "" };
}

export function svgFigura(fig, { contar = false, modo = "lados" } = {}) {
  const chips = [[-12, -6, 18], [10, -14, -24], [2, 12, 40], [-8, 16, 8], [16, 6, 30]];
  const chispas = chips.map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="3.4" ry="2.6" fill="#6b3f23" transform="rotate(${r} ${x} ${y})"/>`).join("");
  let cuerpo;
  if (fig.circulo) {
    cuerpo = `<circle cx="0" cy="0" r="46" fill="#f6c58a" stroke="#2b2236" stroke-width="6"/><circle cx="0" cy="0" r="38" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="3"/>${chispas}`;
  } else {
    const d = pathDe(fig.puntos);
    cuerpo = `<path d="${d}" fill="#f6c58a" stroke="#2b2236" stroke-width="6" stroke-linejoin="miter"/>
      <path d="${d}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="3" stroke-linejoin="miter" transform="scale(.82)"/>${chispas}`;
  }
  let marcas = "";
  if (contar && !fig.circulo && modo === "lados") {
    marcas = fig.puntos.map((p, i) => {
      const q = fig.puntos[(i + 1) % fig.puntos.length];
      const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
      return `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="#ff6b4a" stroke-width="5" stroke-linecap="round" class="prende" style="animation-delay:${i * 0.28}s"/>
        <text x="${mx}" y="${my}" class="num prende" style="animation-delay:${i * 0.28}s">${i + 1}</text>`;
    }).join("");
  } else if (contar && !fig.circulo) {
    marcas = fig.puntos.map((p, i) => `<g class="prende" style="animation-delay:${i * 0.28}s"><circle cx="${p[0]}" cy="${p[1]}" r="7" fill="#ff6b4a" stroke="#2b2236" stroke-width="2"/><text x="${p[0]}" y="${p[1]}" class="num">${i + 1}</text></g>`).join("");
  }
  return `<svg viewBox="-60 -60 120 120" aria-hidden="true">${cuerpo}<g class="marcas">${marcas}</g></svg>`;
}
