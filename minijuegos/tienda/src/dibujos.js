// Dibujos en SVG. Nada de emojis: en la TV LG salen en blanco y negro.
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function piezaSvg(p) {
  if (!p) return "";
  if (p.tipo === "billete") return billete(p);
  const tinta = p.tinta || "#2b2236";
  const borde = p.borde || "rgba(0,0,0,.28)";
  const centro = p.centro ? `<circle cx="50" cy="50" r="24" fill="${esc(p.centro)}"/>` : "";
  const tam = String(p.etiqueta || "").length > 3 ? 22 : 28;
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="47" fill="${esc(p.color)}" stroke="${esc(borde)}" stroke-width="5"/><circle cx="50" cy="50" r="38" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="3"/>${centro}<ellipse cx="36" cy="32" rx="14" ry="8" fill="#fff" opacity=".28"/><text x="50" y="58" text-anchor="middle" font-family="Fredoka,Nunito,sans-serif" font-size="${tam}" font-weight="700" fill="${esc(tinta)}">${esc(p.etiqueta)}</text></svg>`;
}

function billete(p) {
  const tinta = p.tinta || "#1c2414";
  const tam = String(p.etiqueta || "").length > 3 ? 28 : 36;
  return `<svg viewBox="0 0 220 104" aria-hidden="true"><rect x="3" y="3" width="214" height="98" rx="12" fill="${esc(p.color)}" stroke="${esc(p.borde || "#333")}" stroke-width="5"/><rect x="14" y="12" width="192" height="80" rx="8" fill="none" stroke="${esc(tinta)}" stroke-opacity=".35" stroke-width="2"/><circle cx="42" cy="52" r="16" fill="none" stroke="${esc(tinta)}" stroke-opacity=".45" stroke-width="3"/><text x="118" y="62" text-anchor="middle" font-family="Fredoka,Nunito,sans-serif" font-size="${tam}" font-weight="700" fill="${esc(tinta)}">${esc(p.etiqueta)}</text>${p.banda ? `<text x="118" y="82" text-anchor="middle" font-family="Nunito,sans-serif" font-size="11" font-weight="800" letter-spacing="1.5" fill="${esc(tinta)}" opacity=".75">${esc(p.banda)}</text>` : ""}</svg>`;
}

const boca = (exp) => exp === "sorpresa"
  ? `<circle cx="60" cy="86" r="7" fill="#2b2236"/>`
  : exp === "pensativo"
    ? `<path d="M46 88c8-6 20-6 28 0" fill="none" stroke="#2b2236" stroke-width="3" stroke-linecap="round"/>`
    : `<path d="M44 82c6 12 26 12 32 0" fill="none" stroke="#2b2236" stroke-width="3.2" stroke-linecap="round"/>`;

const ojos = (exp, y = 70) => {
  const r = exp === "sorpresa" ? 6.2 : 4.6;
  return `<circle cx="46" cy="${y}" r="${r}" fill="#2b2236"/><circle cx="74" cy="${y}" r="${r}" fill="#2b2236"/><circle cx="${46 + 1.4}" cy="${y - 1.6}" r="1.5" fill="#fff"/><circle cx="${74 + 1.4}" cy="${y - 1.6}" r="1.5" fill="#fff"/>`;
};

function orejas(tipo, color) {
  if (tipo === "largas") return `<ellipse cx="38" cy="38" rx="10" ry="28" fill="${esc(color)}" stroke="#2b2236" stroke-opacity=".2" stroke-width="3"/><ellipse cx="82" cy="38" rx="10" ry="28" fill="${esc(color)}" stroke="#2b2236" stroke-opacity=".2" stroke-width="3"/><ellipse cx="38" cy="40" rx="5" ry="16" fill="#f7b6c8"/><ellipse cx="82" cy="40" rx="5" ry="16" fill="#f7b6c8"/>`;
  if (tipo === "puntiagudas") return `<path d="M28 62 L40 18 L54 58 Z" fill="${esc(color)}" stroke="#2b2236" stroke-opacity=".25" stroke-width="3"/><path d="M92 62 L80 18 L66 58 Z" fill="${esc(color)}" stroke="#2b2236" stroke-opacity=".25" stroke-width="3"/>`;
  if (tipo === "plumas") return `<path d="M34 48 L44 16 L54 50 Z" fill="${esc(color)}"/><path d="M86 48 L76 16 L66 50 Z" fill="${esc(color)}"/>`;
  if (tipo === "pico" || tipo === "chicas") return "";
  return `<circle cx="36" cy="40" r="14" fill="${esc(color)}" stroke="#2b2236" stroke-opacity=".2" stroke-width="3"/><circle cx="84" cy="40" r="14" fill="${esc(color)}" stroke="#2b2236" stroke-opacity=".2" stroke-width="3"/>`;
}

export function clienteSvg(c, expresion = "feliz") {
  const color = esc(c.color || "#f6d7c3");
  const panza = esc(c.panza || "#fff8f2");
  const extra = c.animal === "gato" ? `<path d="M22 78h18M80 78h18M26 86h12M82 86h12" stroke="#2b2236" stroke-width="2" stroke-linecap="round" opacity=".7"/>`
    : c.animal === "zorro" ? `<ellipse cx="60" cy="92" rx="10" ry="7" fill="#fff"/>`
    : c.animal === "pato" ? `<ellipse cx="78" cy="86" rx="16" ry="8" fill="#f0a020" stroke="#c47a10" stroke-width="2"/>`
    : c.animal === "rana" ? `<circle cx="40" cy="48" r="12" fill="${color}" stroke="#2b2236" stroke-opacity=".25" stroke-width="3"/><circle cx="80" cy="48" r="12" fill="${color}" stroke="#2b2236" stroke-opacity=".25" stroke-width="3"/>${ojos(expresion, 48)}`
    : c.animal === "buho" ? `<circle cx="46" cy="72" r="14" fill="#fff6e8"/><circle cx="74" cy="72" r="14" fill="#fff6e8"/>`
    : "";
  const ojosDibujo = c.animal === "rana" ? "" : c.animal === "buho"
    ? `<circle cx="46" cy="72" r="${expresion === "sorpresa" ? 7 : 5.5}" fill="#2b2236"/><circle cx="74" cy="72" r="${expresion === "sorpresa" ? 7 : 5.5}" fill="#2b2236"/><circle cx="48" cy="70" r="1.6" fill="#fff"/><circle cx="76" cy="70" r="1.6" fill="#fff"/>`
    : ojos(expresion, 74);
  const bocaDibujo = c.animal === "pato" ? "" : boca(expresion);
  return `<svg viewBox="0 0 120 150" data-expresion="${esc(expresion)}" aria-hidden="true">${orejas(c.orejas, c.color)}<ellipse cx="60" cy="124" rx="36" ry="22" fill="${color}"/><ellipse cx="60" cy="128" rx="22" ry="14" fill="${panza}"/><circle cx="60" cy="74" r="34" fill="${color}" stroke="#2b2236" stroke-opacity=".15" stroke-width="3"/>${extra}${ojosDibujo}${bocaDibujo}<ellipse cx="38" cy="84" rx="6" ry="3.5" fill="#f4a3b5" opacity=".55"/><ellipse cx="82" cy="84" rx="6" ry="3.5" fill="#f4a3b5" opacity=".55"/></svg>`;
}

const FORMAS = {
  manzana: (c) => `<circle cx="50" cy="58" r="30" fill="${c}"/><rect x="46" y="22" width="6" height="14" rx="2" fill="#6b3a22"/><path d="M52 28c12-14 22-6 16 2" fill="#3cbf6e"/>`,
  pan: (c) => `<path d="M16 62c0-20 14-32 34-32s34 12 34 32v10H16z" fill="${c}"/><path d="M28 48h8M46 44h8M64 48h8" stroke="#b07a32" stroke-width="3" stroke-linecap="round"/>`,
  leche: (c) => `<path d="M30 28h28l8 14v40a8 8 0 0 1-8 8H34a8 8 0 0 1-8-8V42z" fill="${c}" stroke="#c5d0dc" stroke-width="3"/><rect x="38" y="48" width="22" height="16" rx="3" fill="#dceafa"/>`,
  galleta: (c) => `<circle cx="50" cy="54" r="30" fill="${c}"/><circle cx="38" cy="46" r="4" fill="#8a5a32"/><circle cx="58" cy="42" r="4" fill="#8a5a32"/><circle cx="62" cy="62" r="4" fill="#8a5a32"/><circle cx="42" cy="66" r="3.5" fill="#8a5a32"/>`,
  jugo: (c) => `<path d="M34 36h32l-4 48a8 8 0 0 1-8 6H46a8 8 0 0 1-8-6z" fill="${c}"/><rect x="40" y="22" width="20" height="10" rx="3" fill="#f7f4ee" stroke="#ddd" stroke-width="2"/>`,
  flor: (c) => `<circle cx="50" cy="40" r="10" fill="${c}"/><circle cx="32" cy="52" r="10" fill="${c}"/><circle cx="68" cy="52" r="10" fill="${c}"/><circle cx="40" cy="70" r="10" fill="${c}"/><circle cx="60" cy="70" r="10" fill="${c}"/><circle cx="50" cy="56" r="9" fill="#ffd15c"/>`,
  lapiz: (c) => `<path d="M28 78 L62 20 L74 28 L40 86 Z" fill="${c}" stroke="#333" stroke-opacity=".3" stroke-width="3"/><path d="M28 78 L34 90 L46 84 Z" fill="#f2a3b5"/><path d="M34 90 L38 96 L46 84 Z" fill="#2b2236"/>`,
  cuaderno: (c) => `<rect x="26" y="22" width="48" height="60" rx="4" fill="${c}" stroke="#333" stroke-opacity=".2" stroke-width="3"/><path d="M38 22v60" stroke="#fff" stroke-width="4"/><path d="M46 38h18M46 48h18M46 58h12" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
};

export function productoSvg(p) {
  const c = esc(p.color || "#f0a020");
  const forma = (FORMAS[p.dibujo] || FORMAS.galleta)(c);
  return `<svg viewBox="0 0 100 100" aria-hidden="true">${forma}</svg>`;
}

export function tiendaSvg(mejoras = []) {
  const tiene = (id) => mejoras.includes(id);
  const toldo = tiene("toldo")
    ? `<path d="M10 48 h80 l-6 16 H16 Z" fill="#ef8b2c"/><path d="M18 48 v16 M34 48 v16 M50 48 v16 M66 48 v16 M82 48 v16" stroke="#fff6ea" stroke-width="6"/>`
    : `<path d="M14 46 h72 v10 H14 Z" fill="#ef8b2c"/>`;
  const letrero = tiene("letrero")
    ? `<rect x="28" y="18" width="44" height="20" rx="5" fill="#fff6ea" stroke="#2b2236" stroke-width="2"/><text x="50" y="33" text-anchor="middle" font-family="Fredoka,Nunito,sans-serif" font-size="12" font-weight="700" fill="#2b2236">NOLI</text>`
    : `<rect x="36" y="24" width="28" height="8" rx="3" fill="#fff6ea" opacity=".8"/>`;
  const maceta = tiene("maceta")
    ? `<rect x="78" y="78" width="16" height="14" rx="3" fill="#e07a4a"/><path d="M86 78c-8-14 2-18 0-28 6 8 12 6 10 18" fill="#3cbf6e"/>`
    : "";
  const alfombra = tiene("alfombra") ? `<ellipse cx="50" cy="102" rx="22" ry="6" fill="#e45b8a"/>` : "";
  const estante = tiene("estante")
    ? `<rect x="18" y="62" width="28" height="3" fill="#8a5a32"/><circle cx="24" cy="58" r="4" fill="#e23d3d"/><circle cx="34" cy="58" r="4" fill="#f2c14e"/><circle cx="42" cy="58" r="4" fill="#6db3e8"/>`
    : "";
  return `<svg viewBox="0 0 100 110" aria-hidden="true"><rect x="8" y="40" width="84" height="62" rx="6" fill="#fff6ea" stroke="#e6d3b8" stroke-width="2"/>${toldo}${letrero}<rect x="40" y="68" width="20" height="28" rx="3" fill="#c4894f"/><circle cx="56" cy="82" r="1.6" fill="#ffd15c"/><rect x="16" y="58" width="20" height="16" rx="2" fill="#c5e4f7"/>${estante}${maceta}${alfombra}</svg>`;
}

export function estrellaSvg(on) {
  return `<svg class="estrella ${on ? "on" : "off"}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.6 6.1 6.6.6-5 4.3 1.5 6.4L12 16.9 6.3 20l1.5-6.4-5-4.3 6.6-.6z"/></svg>`;
}

export const FLAMA = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1.5-4.5 3-6 0 2 1 3 2 3 0-3-1-6 1-9z" fill="#ff6b4a"/><path d="M12 13c.5 2 3 3 3 5.5a3 3 0 0 1-6 0c0-1.5 1-2.5 3-5.5z" fill="#ffc43d"/></svg>`;
export const CANDADO = `<svg class="ico" viewBox="0 0 24 24" aria-label="Bloqueado"><rect x="5" y="10" width="14" height="11" rx="2.5" fill="currentColor" opacity=".5"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.4" opacity=".5"/></svg>`;
export const PALOMA = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
