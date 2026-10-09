// La muñeca en 2D (SVG, de frente). Sirve para tres cosas:
//  1. el modo sencillo, cuando el aparato no tiene WebGL o va muy lento (docs/RENDIMIENTO.md § Respaldo 2D);
//  2. las miniaturas de cada prenda en el panel del perchero (se ve la prenda sobre una silueta clarita);
//  3. las fotos del clóset (los atuendos guardados).
// Cada prenda dice qué figura usa con "dibujo2d" en prendas.json; las figuras están en FIGURAS.
// Coordenadas: viewBox 0 0 200 360, la muñeca mirando al frente, pies en y ≈ 335.

const B = 'stroke="#2b2236" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"';

// Recuadros para las miniaturas: qué parte de la muñeca enseñar según la categoría (o el lugar del accesorio)
const RECORTES = {
  peinado: "40 0 120 130", arriba: "40 100 120 130", abajo: "40 180 120 150", vestido: "20 100 160 240", zapatos: "50 285 100 70",
  cabeza: "35 -10 130 120", cara: "50 40 100 70", cuello: "50 90 100 90", mano: "20 150 160 110", espalda: "10 90 180 160",
};

/**
 * Figuras de cada prenda: función (p, s) → SVG, con p = color principal y s = secundario.
 * capa: "atras" (detrás del cuerpo), "ropa" (encima del cuerpo), "pelo" (sobre la cabeza), "frente" (al final).
 */
const FIGURAS = {
  // ---- Peinados: "atras" es el pelo de atrás de la cabeza; "pelo" el de arriba ----
  melena: { atras: (p) => `<path d="M52 72c0-34 20-50 48-50s48 16 48 50v24c-6 6-14 8-22 8V70H74v34c-8 0-16-2-22-8z" fill="${p}" ${B}/>`,
    pelo: (p) => `<path d="M56 66c0-28 18-42 44-42s44 14 44 42c-14-8-30-12-44-12-8 0-16 2-22 6-8-4-16 0-22 6z" fill="${p}" ${B}/>` },
  cola: { atras: (p) => `<path d="M138 50c18 4 26 30 18 66-4 14-12 20-18 16 8-20 8-42 0-60z" fill="${p}" ${B}/>`,
    pelo: (p, s) => `<path d="M56 70c0-30 18-46 44-46s44 16 44 46c-14-10-30-14-44-14s-30 4-44 14z" fill="${p}" ${B}/><circle cx="140" cy="48" r="6" fill="${s}" ${B}/>` },
  coletas: { atras: (p) => `<path d="M50 60c-18 6-22 40-14 66 10-4 16-20 18-40zM150 60c18 6 22 40 14 66-10-4-16-20-18-40z" fill="${p}" ${B}/>`,
    pelo: (p, s) => `<path d="M56 70c0-30 18-46 44-46s44 16 44 46c-12-8-26-14-44-14s-32 6-44 14z" fill="${p}" ${B}/><circle cx="54" cy="58" r="6" fill="${s}" ${B}/><circle cx="146" cy="58" r="6" fill="${s}" ${B}/>` },
  chongos: { atras: () => "", pelo: (p) => `<circle cx="62" cy="30" r="17" fill="${p}" ${B}/><circle cx="138" cy="30" r="17" fill="${p}" ${B}/><path d="M56 70c0-30 18-46 44-46s44 16 44 46c-12-8-26-14-44-14s-32 6-44 14z" fill="${p}" ${B}/>` },
  trenza: { atras: (p, s) => `<g fill="${p}" ${B}><ellipse cx="146" cy="100" rx="10" ry="13"/><ellipse cx="148" cy="124" rx="9" ry="12"/><ellipse cx="149" cy="146" rx="8" ry="11"/></g><circle cx="149" cy="160" r="5" fill="${s}" ${B}/>`,
    pelo: (p) => `<path d="M56 74c0-32 18-50 44-50s44 18 44 50c0 10-2 18-6 24-2-24-18-40-38-40s-34 10-44 16z" fill="${p}" ${B}/>` },
  rizos: { atras: (p) => `<g fill="${p}" ${B}>${[[50, 60], [46, 86], [52, 110], [150, 60], [154, 86], [148, 110]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="16"/>`).join("")}</g>`,
    pelo: (p) => `<g fill="${p}" ${B}>${[[62, 40], [82, 26], [100, 22], [118, 26], [138, 40], [148, 58], [52, 58]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="16"/>`).join("")}</g>` },
  bailarina: { atras: () => "", pelo: (p, s) => `<circle cx="100" cy="22" r="17" fill="${p}" ${B}/><path d="M84 26h32" stroke="${s}" stroke-width="4"/><path d="M56 74c0-32 18-48 44-48s44 16 44 48c-12-12-28-18-44-18s-32 6-44 18z" fill="${p}" ${B}/>` },
  suelto: { atras: (p) => `<path d="M50 70c0-34 22-50 50-50s50 16 50 50v90c-10 6-22 6-30 2V80H80v82c-8 4-20 4-30-2z" fill="${p}" ${B}/>`,
    pelo: (p) => `<path d="M56 70c0-30 18-46 44-46s44 16 44 46c-12-8-26-14-44-14s-32 6-44 14z" fill="${p}" ${B}/>` },

  // ---- Ropa de arriba (torso: x 70–130, y 118–205; brazos bajan por x 58 y 142) ----
  camiseta: { ropa: (p) => `<path d="M70 120h60l18 14-8 14-10-6v61H70v-61l-10 6-8-14z" fill="${p}" ${B}/>` },
  tirantes: { ropa: (p) => `<path d="M72 132h56v75H72z" fill="${p}" ${B}/><path d="M78 132v-12M122 132v-12" stroke="${p}" stroke-width="6"/>` },
  sueter: { ropa: (p, s) => `<path d="M68 118h64l14 10 4 82h-14l-6-64v62H70v-62l-6 64H50l4-82z" fill="${p}" ${B}/><path d="M70 160h60" stroke="${s}" stroke-width="5"/><path d="M88 118a12 7 0 0 0 24 0" fill="none" ${B}/>` },
  chamarra: { ropa: (p, s) => `<path d="M64 118h72l14 10 6 84h-18l-4-62v62H66v-62l-4 62H44l6-84z" fill="${p}" ${B}/><path d="M80 116h40l-4 10H84z" fill="${s}" ${B}/><path d="M100 126v84" stroke="${s}" stroke-width="3"/>` },
  sudadera: { ropa: (p, s) => `<path d="M76 108c6-8 42-8 48 0" fill="${p}" ${B}/><path d="M68 118h64l14 10 4 82h-14l-6-64v62H70v-62l-6 64H50l4-82z" fill="${p}" ${B}/><path d="M82 184h36v16H82z" fill="none" ${B}/><path d="M94 124v14M106 124v14" stroke="${s}" stroke-width="3"/>` },
  camisa: { ropa: (p, s) => `<path d="M68 118h64l14 10 4 82h-14l-6-64v62H70v-62l-6 64H50l4-82z" fill="${p}" ${B}/><path d="M86 116l14 12 14-12" fill="${p}" ${B}/><g fill="${s}" ${B}><circle cx="100" cy="146" r="2.6"/><circle cx="100" cy="166" r="2.6"/><circle cx="100" cy="186" r="2.6"/></g>` },
  abombada: { ropa: (p, s) => `<circle cx="64" cy="130" r="14" fill="${p}" ${B}/><circle cx="136" cy="130" r="14" fill="${p}" ${B}/><path d="M72 120h56v86H72z" fill="${p}" ${B}/><path d="M80 120c6 10 34 10 40 0" fill="none" stroke="${s}" stroke-width="4"/>` },
  chaqueta: { ropa: (p, s) => `<path d="M68 118h64l14 10 4 82h-14l-6-64v62H70v-62l-6 64H50l4-82z" fill="${p}" ${B}/><path d="M84 118l10 30-10 4zM116 118l-10 30 10 4z" fill="${p}" ${B}/><path d="M102 150v56" stroke="${s}" stroke-width="3"/>` },
  "pijama-arriba": { ropa: (p, s) => `<path d="M68 118h64l14 10 4 82h-14l-6-64v62H70v-62l-6 64H50l4-82z" fill="${p}" ${B}/><g fill="${s}"><circle cx="86" cy="150" r="5"/><circle cx="112" cy="172" r="5"/><circle cx="96" cy="192" r="4"/></g>` },
  brillos: { ropa: (p, s) => `<path d="M72 132h56v44H72z" fill="${p}" ${B}/><path d="M78 132v-12M122 132v-12" stroke="${p}" stroke-width="6"/><g fill="${s}"><path d="M88 146l3 5-3 5-3-5zM110 156l3 5-3 5-3-5zM98 140l2 4-2 4-2-4z"/></g>` },

  // ---- Ropa de abajo (cadera y 200–226; piernas x 82 y 118 bajan hasta y 320) ----
  shorts: { ropa: (p) => `<path d="M70 200h60l4 46h-30l-4-18-4 18H66z" fill="${p}" ${B}/>` },
  falda: { ropa: (p) => `<path d="M72 200h56l14 52H58z" fill="${p}" ${B}/>` },
  "falda-larga": { ropa: (p, s) => `<path d="M72 200h56l24 116H48z" fill="${p}" ${B}/><path d="M51 302h98" stroke="${s}" stroke-width="5"/>` },
  pantalon: { ropa: (p, s) => `<path d="M70 200h60l2 120h-24l-8-90-8 90H68z" fill="${p}" ${B}/><circle cx="100" cy="206" r="2.6" fill="${s}"/>` },
  leggings: { ropa: (p, s) => `<path d="M72 200h56l-2 114h-18l-8-84-8 84H74z" fill="${p}" ${B}/><path d="M76 214l2 98M124 214l-2 98" stroke="${s}" stroke-width="3"/>` },
  nieve: { ropa: (p) => `<path d="M66 196h68l4 116h-32l-6-80-6 80H62z" fill="${p}" ${B}/>` },
  tutu: { ropa: (p, s) => `<path d="M72 200h56v12H72z" fill="${p}" ${B}/><path d="M64 210h72l22 32H42z" fill="${p}" opacity=".9" ${B}/><path d="M60 214h80l16 22H44z" fill="${s}" opacity=".55"/>` },
  "pijama-abajo": { ropa: (p, s) => `<path d="M70 200h60l4 118h-28l-6-86-6 86H66z" fill="${p}" ${B}/><path d="M68 310h28M104 310h28" stroke="${s}" stroke-width="5"/>` },

  // ---- Vestidos ----
  "v-verano": { ropa: (p, s) => `<path d="M74 130h52v74l24 52H50l24-52z" fill="${p}" ${B}/><path d="M80 130v-10M120 130v-10" stroke="${p}" stroke-width="6"/><g fill="${s}">${[66, 84, 100, 116, 134].map((x) => `<circle cx="${x}" cy="244" r="3"/>`).join("")}</g>` },
  banio: { ropa: (p, s) => `<path d="M74 132h52v94H74z" fill="${p}" ${B}/><path d="M80 132v-12M120 132v-12" stroke="${p}" stroke-width="6"/><path d="M70 222h60l6 8H64z" fill="${s}" ${B}/>` },
  "v-fiesta": { ropa: (p, s) => `<circle cx="66" cy="128" r="10" fill="${p}" ${B}/><circle cx="134" cy="128" r="10" fill="${p}" ${B}/><path d="M72 122h56v78l28 58H44l28-58z" fill="${p}" ${B}/><path d="M72 200h56" stroke="${s}" stroke-width="6"/><path d="M110 196l8 4-8 4z" fill="${s}"/>` },
  "v-princesa": { ropa: (p, s) => `<circle cx="64" cy="130" r="14" fill="${p}" ${B}/><circle cx="136" cy="130" r="14" fill="${p}" ${B}/><path d="M72 122h56v80l44 120H28l44-120z" fill="${p}" ${B}/><path d="M34 304h132" stroke="${s}" stroke-width="7"/><path d="M80 124c6 8 34 8 40 0" fill="none" stroke="${s}" stroke-width="4"/>` },
  "v-gala": { ropa: (p, s) => `<path d="M74 128h52v80l16 114H58l16-114z" fill="${p}" ${B}/><path d="M80 128v-10" stroke="${p}" stroke-width="7"/><g fill="${s}">${[80, 90, 100, 110, 120].map((x) => `<circle cx="${x}" cy="134" r="2"/>`).join("")}</g>` },
  mameluco: { ropa: (p, s) => `<path d="M76 110c6-10 42-10 48 0" fill="${p}" ${B}/><path d="M68 118h64l14 10 4 82h-14l-6-64v176h-26l-4-110-4 110H70V146l-6 64H50l4-82z" fill="${p}" ${B}/><path d="M86 150h28v34H86z" fill="${s}" ${B}/>` },
  "v-hada": { ropa: (p, s) => `<path d="M74 130h52v74l10 18H64l10-18z" fill="${p}" ${B}/><path d="M80 130v-10M120 130v-10" stroke="${p}" stroke-width="6"/><path d="M58 216l10 40 10-34 10 40 12-40 12 40 10-40 10 34 10-40z" fill="${p}" ${B}/><path d="M64 216l8 26 10-22 10 26 8-24 10 24 10-24 8 20z" fill="${s}" opacity=".8"/>` },

  // ---- Zapatos (pies en x 82 y 118, y ≈ 322–336) ----
  tenis: { ropa: (p, s) => `<g ${B}><path d="M66 320h28v14H62z" fill="${p}"/><path d="M106 320h28l4 14h-32z" fill="${p}"/><path d="M60 334h36v5H60zM104 334h36v5h-36z" fill="${s}"/></g>` },
  sandalias: { ropa: (p) => `<g ${B} fill="${p}"><path d="M64 334h32v5H64zM104 334h32v5h-32z"/><path d="M70 322h22v5H70zM108 322h22v5h-22z"/></g>` },
  "botas-nieve": { ropa: (p, s) => `<g ${B}><path d="M66 292h30v46H58v-14h8z" fill="${p}"/><path d="M104 292h30v32h8v14h-38z" fill="${p}"/><path d="M64 288h34v8H64zM102 288h34v8h-34z" fill="${s}"/></g>` },
  pantuflas: { ropa: (p, s) => `<g ${B}><ellipse cx="80" cy="330" rx="20" ry="11" fill="${p}"/><ellipse cx="120" cy="330" rx="20" ry="11" fill="${p}"/><path d="M72 322l-4-16 6 2 2 14M88 322l4-16-6 2-2 14M112 322l-4-16 6 2 2 14M128 322l4-16-6 2-2 14" fill="${p}"/></g><circle cx="80" cy="328" r="3" fill="${s}"/><circle cx="120" cy="328" r="3" fill="${s}"/>` },
  zapatillas: { ropa: (p, s) => `<g ${B} fill="${p}"><path d="M64 322h30l2 14H62zM106 322h30l2 14h-34z"/></g><g fill="${s}"><path d="M76 324l4 4-4 4-4-4zM120 324l4 4-4 4-4-4z"/></g>` },
  botas: { ropa: (p, s) => `<g ${B}><path d="M70 270h24v68H60v-12h10zM106 270h24v56h10v12h-34z" fill="${p}"/></g><circle cx="90" cy="290" r="2.5" fill="${s}"/><circle cx="126" cy="290" r="2.5" fill="${s}"/>` },
  ballet: { ropa: (p, s) => `<g ${B} fill="${p}"><path d="M66 326h28l2 10H64zM106 326h28l2 10h-32z"/></g><path d="M72 308l18 10M90 308l-18 10M110 308l18 10M128 308l-18 10" stroke="${s}" stroke-width="2"/>` },

  // ---- Accesorios ----
  lentes: { frente: (p, s) => `<g ${B}><circle cx="82" cy="74" r="12" fill="${s}" stroke="${p}" stroke-width="4"/><circle cx="118" cy="74" r="12" fill="${s}" stroke="${p}" stroke-width="4"/><path d="M94 72h12" stroke="${p}" stroke-width="4"/></g>` },
  diadema: { frente: (p) => `<path d="M56 60c6-30 82-30 88 0" fill="none" stroke="${p}" stroke-width="8" stroke-linecap="round"/>` },
  mochila: { atras: (p, s) => `<rect x="62" y="130" width="76" height="78" rx="12" fill="${p}" ${B}/>`, frente: (p) => `<path d="M76 120v70M124 120v70" stroke="${p}" stroke-width="6" stroke-linecap="round"/>` },
  sombrero: { frente: (p, s) => `<ellipse cx="100" cy="40" rx="76" ry="14" fill="${p}" ${B}/><path d="M66 40c0-26 68-26 68 0z" fill="${p}" ${B}/><path d="M68 34h64" stroke="${s}" stroke-width="7"/>` },
  gorra: { frente: (p, s) => `<path d="M58 54c0-30 84-30 84 0z" fill="${p}" ${B}/><path d="M64 54h80c4 4 2 8-2 8H64z" fill="${p}" ${B}/><circle cx="100" cy="24" r="4" fill="${s}"/>` },
  gorro: { frente: (p, s) => `<path d="M56 58c0-38 88-38 88 0z" fill="${p}" ${B}/><rect x="54" y="50" width="92" height="14" rx="6" fill="${s}" ${B}/><circle cx="100" cy="18" r="10" fill="${s}" ${B}/>` },
  corona: { frente: (p, s) => `<path d="M72 34l6-22 10 14 12-18 12 18 10-14 6 22z" fill="${p}" ${B}/><circle cx="100" cy="28" r="4" fill="${s}" ${B}/>` },
  bufanda: { frente: (p, s) => `<path d="M76 110h48v14H76z" fill="${p}" ${B}/><path d="M110 120h14v46h-14z" fill="${p}" ${B}/><path d="M110 160h14" stroke="${s}" stroke-width="4"/>` },
  collar: { frente: (p, s) => `<path d="M80 122c6 18 34 18 40 0" fill="none" stroke="${p}" stroke-width="5" stroke-dasharray="1 7" stroke-linecap="round"/><circle cx="100" cy="138" r="5" fill="${s}" ${B}/>` },
  bolsa: { frente: (p, s) => `<path d="M140 222c0-14 20-14 20 0" fill="none" stroke="${s}" stroke-width="3"/><rect x="134" y="220" width="32" height="24" rx="5" fill="${p}" ${B}/>` },
  alas: { atras: (p) => `<g fill="${p}" opacity=".7" ${B}><ellipse cx="54" cy="140" rx="36" ry="26" transform="rotate(-30 54 140)"/><ellipse cx="146" cy="140" rx="36" ry="26" transform="rotate(30 146 140)"/><ellipse cx="62" cy="186" rx="22" ry="15" transform="rotate(25 62 186)"/><ellipse cx="138" cy="186" rx="22" ry="15" transform="rotate(-25 138 186)"/></g>` },
  varita: { frente: (p, s) => `<path d="M48 214L30 172" stroke="${s}" stroke-width="5" stroke-linecap="round"/><path d="M28 154l4 9 10 1-8 6 3 10-9-5-9 5 3-10-8-6 10-1z" fill="${p}" ${B}/>` },
  tiara: { frente: (p, s) => `<path d="M58 52c6-30 78-30 84 0" fill="none" stroke="${p}" stroke-width="6" stroke-linecap="round"/><g fill="${s}" ${B}><path d="M100 4l4 9 10 1-7.5 6.5 2 10L100 25l-8.5 5.5 2-10L86 14l10-1z"/><path d="M76 16l2.5 5 5.5.6-4 3.6 1.2 5.4L76 28l-5 2.6 1-5.4-4-3.6 5.6-.6zM124 16l2.5 5 5.5.6-4 3.6 1.2 5.4-5.2-2.6-5 2.6 1-5.4-4-3.6 5.6-.6z"/></g>` },
  mono: { frente: (p) => `<path d="M100 26l-22-12v24zM100 26l22-12v24z" fill="${p}" ${B}/><circle cx="100" cy="26" r="6" fill="${p}" ${B}/>` },
  flor: { frente: (p, s) => `<g fill="${p}" ${B}>${[0, 72, 144, 216, 288].map((a) => `<circle cx="${140 + Math.cos((a * Math.PI) / 180) * 8}" cy="${34 + Math.sin((a * Math.PI) / 180) * 8}" r="7"/>`).join("")}</g><circle cx="140" cy="34" r="5" fill="${s}" ${B}/>` },
};

/** Figuras disponibles (las pruebas revisan que cada prenda use una que exista) */
export const FIGURAS_2D = Object.keys(FIGURAS);

function colores(prenda, color, idx) {
  const hex = (id) => (id && id[0] === "#" ? id : (idx.colores.get(id) || { hex: "#cccccc" }).hex);
  return [hex(color), hex(prenda.secundario || "#ffffff")];
}

/** El cuerpo: piel, malla de base y cara. fantasma = silueta clarita para las miniaturas. */
function cuerpo(piel, base, fantasma) {
  const pi = fantasma ? "#ece6f5" : piel, ba = fantasma ? "#f4f0f8" : base, b = fantasma ? 'stroke="#d8d0e6" stroke-width="2"' : B;
  return {
    abajo: `<g ${b}><path d="M82 222v98M118 222v98" stroke="${pi}" stroke-width="20" stroke-linecap="round"/>
      <ellipse cx="80" cy="330" rx="13" ry="8" fill="${pi}"/><ellipse cx="120" cy="330" rx="13" ry="8" fill="${pi}"/>
      <path d="M62 134l-6 82M138 134l6 82" stroke="${pi}" stroke-width="15" stroke-linecap="round"/>
      <circle cx="55" cy="220" r="9" fill="${pi}"/><circle cx="145" cy="220" r="9" fill="${pi}"/>
      <path d="M70 120h60v86c0 14-60 14-60 0z" fill="${ba}"/></g>`,
    cabeza: `<g ${b}><rect x="92" y="100" width="16" height="20" fill="${pi}"/><circle cx="56" cy="74" r="8" fill="${pi}"/><circle cx="144" cy="74" r="8" fill="${pi}"/>
      <circle cx="100" cy="68" r="44" fill="${pi}"/></g>
      ${fantasma ? "" : `<ellipse cx="83" cy="72" rx="5" ry="7" fill="#2b2236"/><ellipse cx="117" cy="72" rx="5" ry="7" fill="#2b2236"/>
      <circle cx="85" cy="69" r="1.8" fill="#fff"/><circle cx="119" cy="69" r="1.8" fill="#fff"/>
      <circle cx="72" cy="88" r="6" fill="#ff8fa3" opacity=".55"/><circle cx="128" cy="88" r="6" fill="#ff8fa3" opacity=".55"/>
      <path d="M92 92q8 8 16 0" fill="none" stroke="#c4553f" stroke-width="2.6" stroke-linecap="round"/>`}`,
  };
}

/**
 * La muñeca vestida en SVG.
 * @param {object} atuendo
 * @param {object} idx índices de datos.js
 * @param {{ piel: string, base: string, titulo?: string, clase?: string }} op
 * @returns {string} <svg>…</svg>
 */
export function dibujarMuneca(atuendo, idx, op) {
  const capas = { atras: [], ropa: [], pelo: [], frente: [], peloAtras: [] };
  const lista = [];
  for (const k of ["abajo", "arriba", "vestido", "zapatos"]) if (atuendo[k]) lista.push(atuendo[k]);
  for (const p of Object.values(atuendo.accesorios || {})) if (p) lista.push(p);
  for (const { id, color } of lista) {
    const prenda = idx.prendas.get(id), f = prenda && FIGURAS[prenda.dibujo2d];
    if (!f) continue;
    const [p, s] = colores(prenda, color, idx);
    for (const capa of ["atras", "ropa", "frente"]) if (f[capa]) capas[capa].push(f[capa](p, s));
  }
  if (atuendo.peinado) {
    const prenda = idx.prendas.get(atuendo.peinado.id), f = prenda && FIGURAS[prenda.dibujo2d];
    if (f) { const [p, s] = colores(prenda, atuendo.peinado.color, idx); capas.peloAtras.push(f.atras(p, s)); capas.pelo.push(f.pelo(p, s)); }
  }
  const c = cuerpo(op.piel, op.base, false);
  return `<svg class="${op.clase || "muneca"}" viewBox="0 0 200 360" role="img" aria-label="${op.titulo || "Muñeca"}">
    ${capas.atras.join("")}${capas.peloAtras.join("")}${c.abajo}${capas.ropa.join("")}${c.cabeza}${capas.pelo.join("")}${capas.frente.join("")}</svg>`;
}

/**
 * Miniatura de una prenda: la prenda en su color sobre una silueta clarita, recortada a la parte del cuerpo.
 * @param {object} prenda
 * @param {string} color id del color
 * @param {object} idx
 */
export function miniPrenda(prenda, color, idx) {
  const f = FIGURAS[prenda.dibujo2d];
  const [p, s] = colores(prenda, color, idx);
  const c = cuerpo("#ece6f5", "#f4f0f8", true);
  const recorte = RECORTES[prenda.categoria === "accesorio" ? prenda.lugar : prenda.categoria] || "0 0 200 360";
  let dentro = "";
  if (f) {
    if (prenda.categoria === "peinado") dentro = f.atras(p, s) + c.cabeza + f.pelo(p, s);
    else dentro = (f.atras ? f.atras(p, s) : "") + c.abajo + c.cabeza + (f.ropa ? f.ropa(p, s) : "") + (f.frente ? f.frente(p, s) : "");
  }
  return `<svg class="mini" viewBox="${recorte}" aria-hidden="true">${dentro}</svg>`;
}
