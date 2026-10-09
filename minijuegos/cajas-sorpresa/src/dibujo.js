// Dibujos de la tienda. La marca de rareza (marco y estrellas) sale de aquí,
// igual para las 24 piezas. Las fotos solo se nombran: 128 en la vitrina, 512 al abrir.

export const MARCA = {
  comun: { estrellas: 1, nombre: "Común" },
  rara: { estrellas: 2, nombre: "Rara" },
  ultra: { estrellas: 3, nombre: "Ultra rara" },
};

export function rutaPieza(archivo, tam) {
  if (tam === "silueta") return `assets/brumitos/${archivo}-silueta.svg`;
  return `assets/brumitos/${archivo}-${tam}.webp`;
}

export function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

const ESTRELLA = `<svg viewBox="0 0 20 20" class="estrella" aria-hidden="true"><path d="M10 1.8l2.2 4.6 5 .6-3.7 3.4.9 5-4.4-2.4L6 15.4l.9-5L3.2 7l5-.6z" fill="currentColor"/></svg>`;

export function estrellasSvg(n) {
  const total = n === 3 ? 3 : n === 2 ? 2 : 1;
  return `<span class="estrellas" aria-hidden="true">${ESTRELLA.repeat(total)}</span>`;
}

export function claseMarco(rareza, brillo) {
  const extra = brillo && rareza === "rara" ? " brillo-rara" : brillo && rareza === "ultra" ? " brillo-ultra" : "";
  return `marco marco-${rareza}${extra}`;
}

export function rutaFamilia(id) {
  return `assets/brumitos/familia-${id}-512.webp`;
}

/**
 * Frasco de bruma. Es el único dibujo del recipiente: cuando se confirme
 * el diseño, se cambia esta función y la animación de estilo.css.
 * No recibe la pieza ni la rareza. Siempre es el mismo frasco.
 */
export function frascoSvg() {
  return `<svg class="frasco-svg" viewBox="0 0 160 188" aria-hidden="true">
    <ellipse cx="80" cy="176" rx="46" ry="7" fill="rgba(0,0,0,.18)"/>
    <g class="brumito-sube">
      <ellipse cx="80" cy="40" rx="16" ry="20" fill="#d9d3e4" stroke="#2b2236" stroke-width="3"/>
      <circle cx="74" cy="36" r="2.2" fill="#2b2236"/>
      <circle cx="86" cy="36" r="2.2" fill="#2b2236"/>
    </g>
    <g class="bruma-derrame">
      <ellipse cx="80" cy="70" rx="30" ry="10" fill="#d7e4f2"/>
      <ellipse cx="54" cy="80" rx="16" ry="8" fill="#e7eef6"/>
      <ellipse cx="108" cy="82" rx="18" ry="8" fill="#efe3cc"/>
    </g>
    <path d="M50 86h60l10 64a18 18 0 0 1-18 16H58a18 18 0 0 1-18-16z" fill="#f7f1e8" stroke="#2b2236" stroke-width="3"/>
    <path d="M56 100h48l7 40a12 12 0 0 1-12 12H62a12 12 0 0 1-12-12z" fill="#c5d4e8"/>
    <path d="M64 112h16l2 18H66z" fill="#fff" opacity=".5"/>
    <path d="M60 70h40v18H60z" fill="#f7f1e8" stroke="#2b2236" stroke-width="3"/>
    <g class="tapa-frasco">
      <rect x="54" y="54" width="52" height="18" rx="4" fill="#efe3cc" stroke="#2b2236" stroke-width="3"/>
      <rect x="68" y="44" width="24" height="12" rx="3" fill="#c5d4e8" stroke="#2b2236" stroke-width="3"/>
    </g>
  </svg>`;
}

export function iconoVoz() {
  return `<svg class="icono-voz" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.2 9.2a3.6 3.6 0 0 1 0 5.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18.6 6.6a7 7 0 0 1 0 10.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
}

export function iconoPolvo() {
  return `<svg class="icono-polvo" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l1.2 4.2L17 7.2 13.2 8.4 12 13l-1.2-4.6L6 7.2l3.8-1z" fill="#fff4cc"/><path d="M18 12l.7 2.2 2.3.6-2.3.7L18 18l-.7-2.5-2.3-.7 2.3-.6z" fill="#f2b79a"/><path d="M6 14l.6 1.8 1.9.5-1.9.6L6 19l-.6-2.1L3.5 16.3l1.9-.5z" fill="#b8a2d6"/></svg>`;
}

export function iconoCredito() {
  return `<svg class="icono-credito" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#ffc43d" stroke="#2b2236" stroke-width="1.6"/><path d="M12 6.2l1.4 3 3.3.4-2.4 2.2.6 3.3L12 13.4 9.1 15.1l.6-3.3-2.4-2.2 3.3-.4z" fill="#fff4cc"/></svg>`;
}

function mini(on, rareza) {
  return `<i class="mini${on ? " mini-" + rareza : ""}" aria-hidden="true"></i>`;
}

/** Dibujitos de «3 de cada 4», «1 de cada 5» y «1 de cada 20». Sin números de porcentaje. */
export function fichasProbabilidad(tipo) {
  const plan = tipo === "comun" ? [4, 3, "comun"] : tipo === "rara" ? [5, 1, "rara"] : [20, 1, "ultra"];
  const [total, on, rareza] = plan;
  let html = "";
  for (let i = 0; i < total; i++) html += mini(i < on, rareza);
  return `<span class="fichas fichas-${tipo}">${html}</span>`;
}

export function htmlFoto(pieza, { grande = false, tiene = false } = {}) {
  const tam = grande ? 512 : 128;
  const src = tiene || grande ? rutaPieza(pieza.archivo, grande ? 512 : 128) : rutaPieza(pieza.archivo, "silueta");
  const lazy = grande ? "" : ' loading="lazy" decoding="async"';
  const cls = grande ? "foto foto-grande" : "foto";
  return `<img class="${cls}" src="${esc(src)}" alt="" width="${tam}" height="${tam}"${lazy}>`;
}
