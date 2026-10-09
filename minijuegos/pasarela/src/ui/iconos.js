// Íconos en SVG. Nada de emojis: en la TV LG salen en blanco y negro (#5). Cada uno es un texto SVG con
// viewBox 0 0 48 48 que se mete tal cual en el HTML. Los íconos de los temas se llaman como "icono" en temas.json.
const s = (cuerpo, extra = "") => `<svg viewBox="0 0 48 48" aria-hidden="true" ${extra}>${cuerpo}</svg>`;
const L = 'stroke="#2b2236" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"';

/** Íconos por nombre: { nombre: "<svg …>" }. Los de los temas empiezan con "t-". */
export const ICONOS = {
  moneda: s(`<circle cx="24" cy="24" r="19" fill="#ffc43d" ${L}/><circle cx="24" cy="24" r="13.5" fill="none" stroke="#e0a100" stroke-width="2"/><path d="M24 13.5l3 6.2 6.8.8-5 4.7 1.3 6.7L24 28.5l-6.1 3.4 1.3-6.7-5-4.7 6.8-.8z" fill="#fff4cc" stroke="#e0a100" stroke-width="1.6" stroke-linejoin="round"/>`),
  estrella: s(`<path d="M24 5l5.6 11.6 12.6 1.6-9.2 8.8 2.4 12.6L24 33.4l-11.4 6.2 2.4-12.6-9.2-8.8 12.6-1.6z" fill="#ffb400" ${L}/>`),
  estrellaVacia: s(`<path d="M24 5l5.6 11.6 12.6 1.6-9.2 8.8 2.4 12.6L24 33.4l-11.4 6.2 2.4-12.6-9.2-8.8 12.6-1.6z" fill="#e7dccb" stroke="#c9bba5" stroke-width="2.4" stroke-linejoin="round"/>`),
  candado: s(`<rect x="11" y="21" width="26" height="20" rx="5" fill="#ffd23f" ${L}/><path d="M16 21v-5a8 8 0 0 1 16 0v5" fill="none" ${L}/><circle cx="24" cy="30" r="3" fill="#2b2236"/>`),
  bocina: s(`<path d="M8 19h8l10-8v26l-10-8H8z" fill="#4cb3ff" ${L}/><path d="M32 17a9 9 0 0 1 0 14M36 12a15 15 0 0 1 0 24" fill="none" ${L}/>`),
  reloj: s(`<circle cx="24" cy="26" r="16" fill="#fff" ${L}/><path d="M24 17v9l6 4" fill="none" ${L}/><path d="M19 6h10" ${L}/>`),
  mapa: s(`<path d="M6 12l11-5 14 5 11-5v29l-11 5-14-5-11 5z" fill="#8fd3ff" ${L}/><path d="M17 7v29M31 12v29" ${L}/><circle cx="24" cy="22" r="4" fill="#ff6b4a" ${L}/>`),
  cerrar: s(`<path d="M14 14l20 20M34 14L14 34" fill="none" stroke="#2b2236" stroke-width="4" stroke-linecap="round"/>`),
  palomita: s(`<path d="M11 25l9 9 17-19" fill="none" stroke="#2b2236" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`),
  persona: s(`<circle cx="24" cy="15" r="8" fill="#ffd9c0" ${L}/><path d="M10 42c1-10 7-15 14-15s13 5 14 15z" fill="#ff7eb6" ${L}/>`),
  closet: s(`<rect x="8" y="6" width="32" height="36" rx="3" fill="#d3a6ff" ${L}/><path d="M24 6v36" ${L}/><circle cx="20" cy="24" r="1.8" fill="#2b2236"/><circle cx="28" cy="24" r="1.8" fill="#2b2236"/>`),
  espejo: s(`<ellipse cx="24" cy="21" rx="13" ry="16" fill="#e8f6ff" ${L}/><path d="M17 16l6-6M17 23l11-11" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M19 37l-3 6h16l-3-6" fill="#ffd23f" ${L}/>`),
  pasarela: s(`<path d="M6 42l8-30h20l8 30z" fill="#ff7eb6" ${L}/><path d="M24 4l2.4 4.8 5.3.7-3.9 3.7 1 5.2L24 16l-4.8 2.4 1-5.2-3.9-3.7 5.3-.7z" fill="#ffd23f" ${L}/>`),
  piel: s(`<circle cx="16" cy="18" r="8" fill="#ffd9c0" ${L}/><circle cx="32" cy="18" r="8" fill="#d79b6e" ${L}/><circle cx="24" cy="32" r="8" fill="#7a4b2e" ${L}/>`),
  // Categorías
  peinado: s(`<path d="M10 30c0-14 6-22 14-22s14 8 14 22c-3-6-6-9-14-9s-11 3-14 9z" fill="#9c6b45" ${L}/><path d="M38 26c4 3 4 10 0 14" fill="none" ${L}/><circle cx="24" cy="28" r="9" fill="#ffd9c0" ${L}/>`),
  arriba: s(`<path d="M17 7l-11 7 4 9 5-3v21h18V20l5 3 4-9-11-7c-1 4-4 6-7 6s-6-2-7-6z" fill="#8fd3ff" ${L}/>`),
  abajo: s(`<path d="M15 8h18l7 32H8z" fill="#ffd23f" ${L}/><path d="M15 13h18" ${L}/>`),
  vestido: s(`<path d="M19 5v8l-3 7 -8 20h32l-8-20-3-7V5" fill="#d3a6ff" ${L}/><path d="M16 20h16" ${L}/>`),
  zapatos: s(`<path d="M6 34V21c5 0 7-3 9-7l8 4c3 4 9 6 15 7 4 1 5 4 5 9z" fill="#3cbf7e" ${L}/><path d="M6 34h37v5H6z" fill="#fff" ${L}/>`),
  accesorio: s(`<path d="M8 36l-2-22 10 9 8-14 8 14 10-9-2 22z" fill="#ffc43d" ${L}/><circle cx="24" cy="29" r="3.5" fill="#ff6b4a"/>`),
  // Temas
  "t-playa": s(`<circle cx="33" cy="15" r="8" fill="#ffd23f" ${L}/><path d="M4 32c5-4 9-4 14 0s9 4 14 0 9-4 14 0v12H4z" fill="#4cb3ff" ${L}/>`),
  "t-cumple": s(`<rect x="9" y="24" width="30" height="16" rx="3" fill="#ff7eb6" ${L}/><path d="M9 31c5 3 10-3 15 0s10 3 15 0" fill="none" stroke="#fff" stroke-width="3"/><path d="M24 24v-9" ${L}/><path d="M24 7c3 3 3 6 0 7-3-1-3-4 0-7z" fill="#ff9a3c" ${L}/>`),
  "t-escuela": s(`<path d="M8 40V18L24 8l16 10v22z" fill="#ff6b4a" ${L}/><rect x="19" y="26" width="10" height="14" fill="#fff" ${L}/><circle cx="24" cy="18" r="4" fill="#ffd23f" ${L}/>`),
  "t-deportes": s(`<circle cx="24" cy="24" r="17" fill="#fff" ${L}/><path d="M24 15l7 5-3 8h-8l-3-8z" fill="#2b2236"/><path d="M24 7v8M31 20l9-3M28 28l5 8M20 28l-5 8M17 20l-9-3" ${L}/>`),
  "t-pijamada": s(`<path d="M31 8a16 16 0 1 0 9 26A14 14 0 0 1 31 8z" fill="#ffd23f" ${L}/><circle cx="14" cy="14" r="2" fill="#2b2236"/><circle cx="38" cy="12" r="2" fill="#2b2236"/>`),
  "t-invierno": s(`<path d="M24 5v38M8 14l32 20M40 14L8 34" stroke="#4cb3ff" stroke-width="4" stroke-linecap="round"/><path d="M19 9l5 5 5-5M19 39l5-5 5 5" fill="none" stroke="#4cb3ff" stroke-width="3" stroke-linecap="round"/>`),
  "t-princesa": s(`<path d="M8 40V20l6 4V12l5 6 5-10 5 10 5-6v12l6-4v20z" fill="#d3a6ff" ${L}/><path d="M20 40v-8a4 4 0 0 1 8 0v8" fill="#fff" ${L}/>`),
  "t-jardin": s(`<circle cx="24" cy="17" r="5" fill="#ffd23f" ${L}/><g fill="#ff7eb6" ${L}><circle cx="24" cy="8" r="5"/><circle cx="33" cy="15" r="5"/><circle cx="29" cy="25" r="5"/><circle cx="19" cy="25" r="5"/><circle cx="15" cy="15" r="5"/></g><circle cx="24" cy="17" r="4.5" fill="#ffd23f" ${L}/><path d="M24 30v12M24 38c-4-6-9-6-11-4M24 36c4-5 8-5 11-3" fill="none" stroke="#3cbf7e" stroke-width="3" stroke-linecap="round"/>`),
  "t-campamento": s(`<path d="M4 40L24 8l20 32z" fill="#3cbf7e" ${L}/><path d="M24 22l-7 18h14z" fill="#2b2236"/>`),
  "t-rock": s(`<path d="M27 4L11 27h11l-4 17 18-25H25z" fill="#ffd23f" ${L}/>`),
  "t-gala": s(`<path d="M6 16l14 8-14 8zM42 16l-14 8 14 8z" fill="#2b2236"/><rect x="19" y="20" width="10" height="8" rx="2" fill="#ef4343" ${L}/>`),
  "t-hada": s(`<path d="M10 40L32 18" stroke="#c9a227" stroke-width="4" stroke-linecap="round"/><path d="M34 6l2.6 6.8 7.2.6-5.5 4.6 1.8 7-6.1-3.8-6.1 3.8 1.8-7-5.5-4.6 7.2-.6z" fill="#ffd23f" ${L}/><circle cx="14" cy="14" r="2" fill="#d3a6ff"/><circle cx="40" cy="34" r="2.5" fill="#d3a6ff"/>`),
};

/** Ícono por nombre (o un círculo si no existe, para que nunca truene) */
export const icono = (nombre) => ICONOS[nombre] || s(`<circle cx="24" cy="24" r="16" fill="#e7dccb" ${L}/>`);

/** n de 5 estrellas llenas */
export function estrellas(n, max = 5) {
  let r = "";
  for (let i = 0; i < max; i++) r += `<i class="est ${i < n ? "on" : "off"}">${i < n ? ICONOS.estrella : ICONOS.estrellaVacia}</i>`;
  return `<span class="estrellas" aria-label="${n} de ${max} estrellas">${r}</span>`;
}
