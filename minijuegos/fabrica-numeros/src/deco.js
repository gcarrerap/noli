// Decoración de la fábrica. Lista fija (nada al azar ni de compra): una pieza por turno
// y una especial al subir de nivel. El sello en inglés no entra en esa cola.
// Las 9 de Petra viven en img/. El resto son dibujos simples a la espera de su SVG.

export const RANURAS = [
  { id: "banderines", nombre: "Banderines" },
  { id: "chimenea", nombre: "Chimenea" },
  { id: "luces", nombre: "Luces" },
  { id: "entrada", nombre: "Entrada" },
];

export const PIEZAS = [
  { id: "banderines-1", nombre: "banderines de colores", ranura: "banderines", arte: "deco-banderines-1" },
  { id: "banderines-2", nombre: "banderas con cola", ranura: "banderines", arte: "deco-banderines-2" },
  { id: "banderines-3", nombre: "cinta de estrellas", ranura: "banderines", arte: "deco-banderines-3" },
  { id: "chimenea-1", nombre: "chimenea de ladrillos", ranura: "chimenea", arte: "deco-chimenea-1" },
  { id: "chimenea-2", nombre: "chimenea de rayas", ranura: "chimenea", arte: "deco-chimenea-2" },
  { id: "chimenea-3", nombre: "chimenea azul", ranura: "chimenea", arte: "deco-chimenea-3" },
  { id: "luces-1", nombre: "focos de colores", ranura: "luces", arte: "deco-luces-1" },
  { id: "luces-2", nombre: "marquesina", ranura: "luces", arte: "deco-luces-2" },
  { id: "luces-3", nombre: "faro de la fábrica", ranura: "luces", arte: "deco-luces-3" },
  { id: "banderines-puntos", nombre: "guirnalda de puntos", ranura: "banderines", simple: "puntos" },
  { id: "banderines-estrellas", nombre: "estrellas del techo", ranura: "banderines", simple: "estrellas" },
  { id: "chimenea-tubo", nombre: "tubo de la chimenea", ranura: "chimenea", simple: "tubo" },
  { id: "chimenea-nube", nombre: "nube de humo", ranura: "chimenea", simple: "nube" },
  { id: "luces-velas", nombre: "velas", ranura: "luces", simple: "velas" },
  { id: "luces-puntos", nombre: "luces redondas", ranura: "luces", simple: "puntos-luz" },
  { id: "entrada-estrella", nombre: "estrella de la puerta", ranura: "entrada", simple: "estrella" },
  { id: "entrada-sol", nombre: "sol de la puerta", ranura: "entrada", simple: "sol" },
  { id: "entrada-flor", nombre: "flor de la puerta", ranura: "entrada", simple: "flor" },
  { id: "entrada-corazon", nombre: "corazón de la puerta", ranura: "entrada", simple: "corazon" },
  { id: "sello-ingles", nombre: "sello en inglés", ranura: "entrada", simple: "sello", ingles: true },
];

export const pieza = (id) => PIEZAS.find((p) => p.id === id) || null;

export function decoNueva() {
  return { ganadas: 0, especiales: 0, slots: { banderines: 0, chimenea: 0, luces: 0, entrada: 0 } };
}

export function piezasDisponibles(deco, ingles) {
  const n = (deco?.ganadas || 0) + (deco?.especiales || 0);
  const out = PIEZAS.filter((p) => !p.ingles).slice(0, n);
  if (ingles) {
    const s = PIEZAS.find((p) => p.ingles);
    if (s) out.push(s);
  }
  return out;
}

export function ciclarRanura(deco, ranura, dir, ingles) {
  const opc = [0, ...piezasDisponibles(deco, ingles).filter((p) => p.ranura === ranura).map((p) => p.id)];
  const actual = deco.slots[ranura] || 0;
  let i = opc.indexOf(actual);
  if (i < 0) i = 0;
  const paso = dir >= 0 ? 1 : opc.length - 1;
  const sig = opc[(i + paso) % opc.length];
  return { ...deco, slots: { ...deco.slots, [ranura]: sig } };
}

export function pisosFabrica(nivel) {
  return Math.max(1, Math.min(4, nivel | 0));
}

const COLORES = ["#ff6b4a", "#ffc43d", "#3ccf8e", "#4cb3ff", "#c86bfa", "#ff7eb6"];

export function svgSimple(tipo) {
  if (tipo === "puntos") {
    const pts = [40, 90, 140, 190, 240].map((x, i) => `<circle cx="${x}" cy="48" r="16" fill="${COLORES[i]}" stroke="#2b2236" stroke-width="4"/>`).join("");
    return `<svg viewBox="0 0 300 96">${pts}</svg>`;
  }
  if (tipo === "estrellas") {
    const est = (x, c) => `<path transform="translate(${x} 48)" d="M0-18l4.4 10.2 11 .9-8.4 7.2 2.6 10.7L0 5.2l-9.6 5.8 2.6-10.7-8.4-7.2 11-.9z" fill="${c}" stroke="#2b2236" stroke-width="3"/>`;
    return `<svg viewBox="0 0 300 96">${[50, 110, 170, 230].map((x, i) => est(x, COLORES[i])).join("")}</svg>`;
  }
  if (tipo === "tubo") {
    return `<svg viewBox="0 0 140 220"><rect x="48" y="40" width="44" height="160" rx="8" fill="#4a4060" stroke="#2b2236" stroke-width="5"/><rect x="36" y="28" width="68" height="22" rx="6" fill="#ffc43d" stroke="#2b2236" stroke-width="5"/></svg>`;
  }
  if (tipo === "nube") {
    return `<svg viewBox="0 0 140 220"><circle class="nube" cx="70" cy="36" r="22" fill="#f3eefa" stroke="#2b2236" stroke-width="4"/><rect x="52" y="70" width="36" height="130" rx="8" fill="#c86bfa" stroke="#2b2236" stroke-width="5"/></svg>`;
  }
  if (tipo === "velas") {
    const v = (x, c) => `<rect x="${x}" y="40" width="14" height="36" rx="3" fill="${c}" stroke="#2b2236" stroke-width="3"/><circle cx="${x + 7}" cy="32" r="6" fill="#ffc43d" stroke="#2b2236" stroke-width="3"/>`;
    return `<svg viewBox="0 0 300 96">${[40, 90, 140, 190, 240].map((x, i) => v(x, COLORES[i])).join("")}</svg>`;
  }
  if (tipo === "puntos-luz") {
    const p = (x, c) => `<circle class="foco" cx="${x}" cy="48" r="14" fill="${c}" stroke="#2b2236" stroke-width="4"/>`;
    return `<svg viewBox="0 0 300 96"><path d="M16 48h268" stroke="#2b2236" stroke-width="4"/>${[40, 90, 140, 190, 240].map((x, i) => p(x, COLORES[i])).join("")}</svg>`;
  }
  if (tipo === "estrella") return `<svg viewBox="0 0 80 80"><path d="M40 8l8 18 20 2-15 13 5 19-18-10-18 10 5-19L12 28l20-2z" fill="#ffc43d" stroke="#2b2236" stroke-width="4"/></svg>`;
  if (tipo === "sol") return `<svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="16" fill="#ffc43d" stroke="#2b2236" stroke-width="4"/><g stroke="#ff6b4a" stroke-width="4" stroke-linecap="round"><path d="M40 8v10M40 62v10M8 40h10M62 40h10M16 16l8 8M56 56l8 8M16 64l8-8M56 24l8-8"/></g></svg>`;
  if (tipo === "flor") return `<svg viewBox="0 0 80 80"><circle cx="40" cy="28" r="10" fill="#ff7eb6" stroke="#2b2236" stroke-width="3"/><circle cx="28" cy="40" r="10" fill="#ffc43d" stroke="#2b2236" stroke-width="3"/><circle cx="52" cy="40" r="10" fill="#4cb3ff" stroke="#2b2236" stroke-width="3"/><circle cx="40" cy="36" r="7" fill="#ff6b4a" stroke="#2b2236" stroke-width="3"/><path d="M40 48v24" stroke="#3ccf8e" stroke-width="5" stroke-linecap="round"/></svg>`;
  if (tipo === "corazon") return `<svg viewBox="0 0 80 80"><path d="M40 68S12 50 12 32a14 14 0 0 1 28-3 14 14 0 0 1 28 3c0 18-28 36-28 36z" fill="#ff6b4a" stroke="#2b2236" stroke-width="4"/></svg>`;
  if (tipo === "sello") return `<svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="30" fill="#4cb3ff" stroke="#2b2236" stroke-width="5"/><text x="40" y="48" text-anchor="middle" font-family="Fredoka,sans-serif" font-size="22" font-weight="700" fill="#fff">EN</text></svg>`;
  return "";
}
