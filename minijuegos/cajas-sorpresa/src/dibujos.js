// Dibujos en SVG (sin emojis: en la TV LG salen en blanco y negro, #5). Funciones puras que regresan texto,
// para poder probarlas en Node. Las imágenes provisionales de los Brumitos salen de aquí hasta que llegue el
// arte de Petra (coleccion.json → "imagen": true).

export const RAREZA = {
  comun: { nombre: "común", estrellas: 1, color: "#6fd6c4" },
  rara: { nombre: "rara", estrellas: 2, color: "#b48cff" },
  ultra: { nombre: "ultra rara", estrellas: 3, color: "#ffc43d" },
};

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Oscurece o aclara un color #rrggbb (f < 0 oscurece, f > 0 aclara)
export function tono(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}

const CUERPO = "M100 52C76 52 66 74 69 96C44 112 38 160 62 178C70 184 82 186 100 186C118 186 130 184 138 178C162 160 156 112 131 96C134 74 124 52 100 52Z";

// Estrellas de rareza (1, 2 o 3)
export function estrellasRareza(rareza, clase = "estrellas") {
  const r = RAREZA[rareza];
  const una = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5-4.9-4.5 6.6-.8z" fill="${r.color}" stroke="#2a1f3d" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
  return `<span class="${clase}" role="img" aria-label="${r.estrellas} ${r.estrellas === 1 ? "estrella" : "estrellas"}: ${r.nombre}">${una.repeat(r.estrellas)}</span>`;
}

// Brumito provisional: la especie (una sola pera de fieltro, antenitas de caracol, ojos con destello y dos
// dientes de conejo) pintada con el color de su cuerpo y el de su disfraz.
export function brumitoSvg(p, clase = "brumito") {
  const c = p.cuerpo, d = p.disfraz, borde = tono(c, -0.35), dBorde = tono(d, -0.35);
  const id = "b-" + p.id;
  return `<svg class="${clase}" viewBox="0 0 200 200" role="img" aria-label="${esc(p.nombre)}">
<defs><radialGradient id="${id}-t" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="${tono(c, 0.45)}"/><stop offset=".6" stop-color="${c}"/><stop offset="1" stop-color="${tono(c, -0.12)}"/></radialGradient>
<clipPath id="${id}-c"><path d="${CUERPO}"/></clipPath></defs>
<ellipse cx="100" cy="190" rx="52" ry="7" fill="rgba(0,0,0,.18)"/>
<g stroke="${borde}" stroke-width="5" stroke-linecap="round" fill="none"><path d="M84 60Q78 46 72 40"/><path d="M116 60Q122 46 128 40"/></g>
<circle cx="71" cy="38" r="7" fill="${tono(c, 0.2)}" stroke="${borde}" stroke-width="2.5"/><circle cx="129" cy="38" r="7" fill="${tono(c, 0.2)}" stroke="${borde}" stroke-width="2.5"/>
<path d="${CUERPO}" fill="url(#${id}-t)" stroke="${borde}" stroke-width="3"/>
<g clip-path="url(#${id}-c)"><path d="M30 140Q100 122 170 140V200H30Z" fill="${d}" stroke="${dBorde}" stroke-width="3"/>
<path d="M40 150Q100 134 160 150" fill="none" stroke="${tono(d, 0.35)}" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round"/></g>
<path d="M86 64L100 36L114 64Z" fill="${d}" stroke="${dBorde}" stroke-width="3" stroke-linejoin="round"/>
<circle cx="100" cy="35" r="5" fill="${tono(d, 0.4)}" stroke="${dBorde}" stroke-width="2"/>
<g><ellipse cx="82" cy="98" rx="12" ry="13" fill="#231a2e"/><ellipse cx="118" cy="98" rx="12" ry="13" fill="#231a2e"/>
<path d="M86 91l1.4 2.9 3.1.4-2.3 2.1.6 3.1-2.8-1.6-2.8 1.6.6-3.1-2.3-2.1 3.1-.4z" fill="#fff"/><path d="M122 91l1.4 2.9 3.1.4-2.3 2.1.6 3.1-2.8-1.6-2.8 1.6.6-3.1-2.3-2.1 3.1-.4z" fill="#fff"/>
<circle cx="78" cy="104" r="2.2" fill="#fff" opacity=".7"/><circle cx="114" cy="104" r="2.2" fill="#fff" opacity=".7"/></g>
<ellipse cx="68" cy="116" rx="7" ry="4.5" fill="#ff8fb1" opacity=".45"/><ellipse cx="132" cy="116" rx="7" ry="4.5" fill="#ff8fb1" opacity=".45"/>
<path d="M88 116Q100 126 112 116" fill="#5a2a3d" stroke="${borde}" stroke-width="2.5" stroke-linejoin="round"/>
<rect x="94" y="116.5" width="5.5" height="7" rx="1.6" fill="#fff" stroke="${borde}" stroke-width="1.2"/><rect x="100.5" y="116.5" width="5.5" height="7" rx="1.6" fill="#fff" stroke="${borde}" stroke-width="1.2"/>
<ellipse cx="60" cy="132" rx="9" ry="12" fill="${tono(c, -0.05)}" stroke="${borde}" stroke-width="2.5" transform="rotate(25 60 132)"/>
<ellipse cx="140" cy="132" rx="9" ry="12" fill="${tono(c, -0.05)}" stroke="${borde}" stroke-width="2.5" transform="rotate(-25 140 132)"/>
<ellipse cx="82" cy="184" rx="15" ry="7" fill="${tono(c, -0.08)}" stroke="${borde}" stroke-width="2.5"/><ellipse cx="118" cy="184" rx="15" ry="7" fill="${tono(c, -0.08)}" stroke="${borde}" stroke-width="2.5"/>
</svg>`;
}

// Silueta del hueco vacío (la misma para todos mientras Petra no entregue las suyas)
export function siluetaSvg(p, clase = "silueta") {
  return `<svg class="${clase}" viewBox="0 0 200 200" role="img" aria-label="${esc(p.nombre)}, todavía no la tienes">
<g fill="currentColor"><path d="M84 60Q78 46 72 40M116 60Q122 46 128 40" stroke="currentColor" stroke-width="6" stroke-linecap="round" fill="none"/>
<circle cx="71" cy="38" r="8"/><circle cx="129" cy="38" r="8"/><path d="${CUERPO}"/><ellipse cx="82" cy="184" rx="16" ry="8"/><ellipse cx="118" cy="184" rx="16" ry="8"/></g>
<text x="100" y="138" text-anchor="middle" font-family="Fredoka, sans-serif" font-size="58" font-weight="700" fill="rgba(255,255,255,.55)">?</text></svg>`;
}

// La imagen de una pieza: el arte de Petra si ya está, si no la provisional
export function imagenPieza(p, grande = false, clase = "brumito") {
  if (p.imagen) {
    const t = grande ? 512 : 128;
    return `<img class="${clase}" src="arte/${p.id}-${t}.webp" width="${t}" height="${t}" alt="${esc(p.nombre)}" ${grande ? "" : 'loading="lazy"'} decoding="async">`;
  }
  return brumitoSvg(p, clase);
}

export function huecoPieza(p, clase = "silueta") {
  if (p.silueta) return `<img class="${clase}" src="arte/${p.id}-silueta.svg" alt="${esc(p.nombre)}, todavía no la tienes">`;
  return siluetaSvg(p, clase);
}

// La caja sorpresa. La tapa va en su propio grupo para animarla.
export const CAJA = `<svg class="caja" viewBox="0 0 220 200" aria-hidden="true">
<ellipse cx="110" cy="188" rx="80" ry="9" fill="rgba(0,0,0,.25)"/>
<g class="caja-cuerpo"><rect x="36" y="86" width="148" height="100" rx="14" fill="#8f5bff" stroke="#2a1f3d" stroke-width="5"/>
<rect x="36" y="86" width="148" height="22" rx="8" fill="#7a46ee"/>
<rect x="98" y="86" width="24" height="100" fill="#ff9a3c" stroke="#2a1f3d" stroke-width="4"/>
<g fill="#ffe28a"><circle cx="62" cy="130" r="4"/><circle cx="160" cy="150" r="3.5"/><circle cx="70" cy="166" r="3"/><circle cx="150" cy="118" r="3"/></g>
<path d="M58 148l3 6 6 .8-4.5 4.2 1.2 6-5.7-3.1-5.6 3.1 1.1-6-4.4-4.2 6-.8z" fill="#ffe28a"/></g>
<g class="caja-tapa"><rect x="26" y="62" width="168" height="30" rx="10" fill="#a777ff" stroke="#2a1f3d" stroke-width="5"/>
<rect x="96" y="62" width="28" height="30" fill="#ffb15c" stroke="#2a1f3d" stroke-width="4"/>
<path d="M110 62C92 40 66 40 70 54C73 64 96 64 110 62ZM110 62C128 40 154 40 150 54C147 64 124 64 110 62Z" fill="#ff9a3c" stroke="#2a1f3d" stroke-width="4" stroke-linejoin="round"/>
<circle cx="110" cy="61" r="8" fill="#ffb15c" stroke="#2a1f3d" stroke-width="4"/></g>
</svg>`;

// Caja chiquita para los dibujitos de "3 de cada 4"
export function cajita(color, llena) {
  return `<svg class="cajita" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="18" height="14" rx="3" fill="${llena ? color : "transparent"}" stroke="${llena ? "#2a1f3d" : "rgba(255,255,255,.45)"}" stroke-width="1.8"/><path d="M2 6h20v4H2z" fill="${llena ? color : "transparent"}" stroke="${llena ? "#2a1f3d" : "rgba(255,255,255,.45)"}" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
}

export const CREDITO = `<svg class="icono-credito" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#ffc43d" stroke="#2b2236" stroke-width="1.6"/><circle cx="12" cy="12" r="7.2" fill="none" stroke="#e0a100" stroke-width="1.2"/><path d="M12 6.8l1.5 3.1 3.4.4-2.5 2.3.7 3.4-3.1-1.7-3.1 1.7.7-3.4-2.5-2.3 3.4-.4z" fill="#fff4cc" stroke="#e0a100" stroke-width=".8" stroke-linejoin="round"/></svg>`;

export const POLVO = `<svg class="icono-polvo" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 2.5c.6 4.4 2.1 5.9 6.5 6.5-4.4.6-5.9 2.1-6.5 6.5-.6-4.4-2.1-5.9-6.5-6.5 4.4-.6 5.9-2.1 6.5-6.5z" fill="#e6d7ff" stroke="#8f5bff" stroke-width="1.4" stroke-linejoin="round"/><path d="M18 13c.3 2.3 1.1 3.1 3.4 3.4-2.3.3-3.1 1.1-3.4 3.4-.3-2.3-1.1-3.1-3.4-3.4 2.3-.3 3.1-1.1 3.4-3.4z" fill="#fff1a8" stroke="#d9a400" stroke-width="1.2" stroke-linejoin="round"/></svg>`;

export const LUNA = `<svg class="icono-luna" viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 3.5a8.5 8.5 0 1 0 5 13.4A7 7 0 0 1 15.5 3.5z" fill="#ffe28a" stroke="#2a1f3d" stroke-width="1.6" stroke-linejoin="round"/><circle cx="9" cy="10" r="1.2" fill="#2a1f3d"/><circle cx="12.5" cy="12.5" r="1.2" fill="#2a1f3d"/><path d="M8.5 15q2 1.6 4 0" stroke="#2a1f3d" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>`;
