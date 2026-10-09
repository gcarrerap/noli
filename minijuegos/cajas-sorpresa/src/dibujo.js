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

export function cajaSvg() {
  return `<svg class="caja-svg" viewBox="0 0 160 150" aria-hidden="true">
    <ellipse cx="80" cy="136" rx="52" ry="8" fill="rgba(0,0,0,.18)"/>
    <g class="tapa">
      <path d="M28 58h104l-8-22H36z" fill="#f2b79a"/>
      <path d="M28 58h104l-8-22H36z" fill="none" stroke="#2b2236" stroke-width="3" stroke-linejoin="round"/>
      <path d="M70 36h20v22H70z" fill="#b8a2d6" stroke="#2b2236" stroke-width="3"/>
    </g>
    <path d="M32 58h96v62a8 8 0 0 1-8 8H40a8 8 0 0 1-8-8z" fill="#efe3cc" stroke="#2b2236" stroke-width="3" stroke-linejoin="round"/>
    <path d="M70 58h20v70H70z" fill="#b8a2d6" stroke="#2b2236" stroke-width="3"/>
    <circle cx="80" cy="96" r="6" fill="#f1dd9a" stroke="#2b2236" stroke-width="2"/>
  </svg>`;
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
