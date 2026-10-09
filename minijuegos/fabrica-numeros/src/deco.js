// Decoración de la fábrica. Lista fija (nada al azar ni de compra): una pieza por turno
// y una especial al subir de nivel. El sello en inglés no entra en esa cola.
// Cada pieza es un SVG de Petra en img/ (campo arte).

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
  { id: "banderines-puntos", nombre: "guirnalda de puntos", ranura: "banderines", arte: "deco-guirnalda-puntos" },
  { id: "banderines-estrellas", nombre: "estrellas del techo", ranura: "banderines", arte: "deco-estrellas-techo" },
  { id: "chimenea-tubo", nombre: "tubo de la chimenea", ranura: "chimenea", arte: "deco-tubo-chimenea" },
  { id: "chimenea-nube", nombre: "nube de humo", ranura: "chimenea", arte: "deco-nube-humo" },
  { id: "luces-velas", nombre: "velas", ranura: "luces", arte: "deco-velas" },
  { id: "luces-puntos", nombre: "luces redondas", ranura: "luces", arte: "deco-luces-redondas" },
  { id: "entrada-estrella", nombre: "estrella de la puerta", ranura: "entrada", arte: "puerta-estrella" },
  { id: "entrada-sol", nombre: "sol de la puerta", ranura: "entrada", arte: "puerta-sol" },
  { id: "entrada-flor", nombre: "flor de la puerta", ranura: "entrada", arte: "puerta-flor" },
  { id: "entrada-corazon", nombre: "corazón de la puerta", ranura: "entrada", arte: "puerta-corazon" },
  { id: "sello-ingles", nombre: "sello en inglés", ranura: "entrada", arte: "sello-en", ingles: true },
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
