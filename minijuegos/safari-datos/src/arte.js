// Todo el arte del juego en SVG (en la TV LG los emojis salen en blanco y negro, #5). Puro: solo texto.
// Los animales van en un cuadro de 40×40 para que se lean igual en el recinto, en la gráfica y en los botones.

const T = "#2b2236";
const ojo = (x, y, r = 1.9) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${T}"/><circle cx="${x + r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.35}" fill="#fff"/>`;
const caja = (cuerpo, etiqueta) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" role="img" aria-label="${etiqueta}">${cuerpo}</svg>`;

const DIBUJOS = {
  mono: () => `
    <circle cx="7" cy="19" r="6" fill="#7b4a24"/><circle cx="7" cy="19" r="3.4" fill="#f0c49a"/>
    <circle cx="33" cy="19" r="6" fill="#7b4a24"/><circle cx="33" cy="19" r="3.4" fill="#f0c49a"/>
    <circle cx="20" cy="20" r="14" fill="#8b5a2b"/>
    <circle cx="15.5" cy="17" r="5.5" fill="#f0c49a"/><circle cx="24.5" cy="17" r="5.5" fill="#f0c49a"/>
    <ellipse cx="20" cy="25.5" rx="9" ry="7" fill="#f0c49a"/>
    ${ojo(15.8, 17.2)}${ojo(24.2, 17.2)}
    <circle cx="18.3" cy="23.5" r=".9" fill="${T}"/><circle cx="21.7" cy="23.5" r=".9" fill="${T}"/>
    <path d="M16 27.5q4 3.2 8 0" fill="none" stroke="${T}" stroke-width="1.4" stroke-linecap="round"/>`,
  leon: () => `
    <g fill="#c8661f">${Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return `<circle cx="${(20 + Math.cos(a) * 13).toFixed(1)}" cy="${(20 + Math.sin(a) * 13).toFixed(1)}" r="6"/>`;
    }).join("")}</g>
    <circle cx="20" cy="20" r="13" fill="#d9822b"/>
    <circle cx="12" cy="11" r="3.4" fill="#f6c453"/><circle cx="28" cy="11" r="3.4" fill="#f6c453"/>
    <circle cx="20" cy="21" r="10.5" fill="#f6c453"/>
    <ellipse cx="20" cy="26" rx="6" ry="4.4" fill="#fde7a8"/>
    ${ojo(16, 19)}${ojo(24, 19)}
    <path d="M17.6 23h4.8l-2.4 2.6z" fill="#7a3d1b"/>
    <path d="M20 25.6v1.6M17.5 28q2.5 1.6 5 0" fill="none" stroke="${T}" stroke-width="1.2" stroke-linecap="round"/>`,
  jirafa: () => `
    <path d="M14 9V3M26 9V3" stroke="#b8722c" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="14" cy="3" r="2.3" fill="#8a4f1c"/><circle cx="26" cy="3" r="2.3" fill="#8a4f1c"/>
    <ellipse cx="8" cy="13" rx="5" ry="2.6" fill="#f4c542" transform="rotate(-20 8 13)"/>
    <ellipse cx="32" cy="13" rx="5" ry="2.6" fill="#f4c542" transform="rotate(20 32 13)"/>
    <ellipse cx="20" cy="19" rx="11" ry="12" fill="#f4c542"/>
    <circle cx="13" cy="12" r="2.4" fill="#c27a32"/><circle cx="27" cy="13" r="2" fill="#c27a32"/><circle cx="25" cy="8.6" r="1.6" fill="#c27a32"/>
    <ellipse cx="20" cy="29" rx="8.5" ry="7" fill="#f7dfa0"/>
    ${ojo(15.5, 18)}${ojo(24.5, 18)}
    <circle cx="17.5" cy="28" r="1" fill="${T}"/><circle cx="22.5" cy="28" r="1" fill="${T}"/>
    <path d="M17.5 32q2.5 1.5 5 0" fill="none" stroke="${T}" stroke-width="1.2" stroke-linecap="round"/>`,
  pinguino: () => `
    <ellipse cx="14" cy="37" rx="4" ry="2" fill="#f39c33"/><ellipse cx="26" cy="37" rx="4" ry="2" fill="#f39c33"/>
    <ellipse cx="20" cy="21" rx="13" ry="16" fill="#2f3542"/>
    <ellipse cx="8" cy="24" rx="3" ry="8" fill="#2f3542" transform="rotate(15 8 24)"/>
    <ellipse cx="32" cy="24" rx="3" ry="8" fill="#2f3542" transform="rotate(-15 32 24)"/>
    <ellipse cx="20" cy="25" rx="9" ry="11" fill="#fdfdfd"/>
    <ellipse cx="15.5" cy="13.5" rx="4" ry="4.4" fill="#fdfdfd"/><ellipse cx="24.5" cy="13.5" rx="4" ry="4.4" fill="#fdfdfd"/>
    ${ojo(16, 14, 1.7)}${ojo(24, 14, 1.7)}
    <path d="M17 18.5h6l-3 3.6z" fill="#f39c33"/>`,
  elefante: () => `
    <ellipse cx="7" cy="18" rx="7" ry="10" fill="#aab3c5"/><ellipse cx="7.5" cy="18" rx="4" ry="6.5" fill="#e7b9c4"/>
    <ellipse cx="33" cy="18" rx="7" ry="10" fill="#aab3c5"/><ellipse cx="32.5" cy="18" rx="4" ry="6.5" fill="#e7b9c4"/>
    <circle cx="20" cy="17" r="11" fill="#97a1b6"/>
    <path d="M16.5 22q-1 9 3.5 15q1.4 1.4 2.6 0q-1.4-2-1.2-5q.3-5 2.1-10z" fill="#97a1b6"/>
    <path d="M15 24q-2.5 2-1.6 4.4M25 24q2.5 2 1.6 4.4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
    ${ojo(15.5, 15.5)}${ojo(24.5, 15.5)}
    <path d="M18.5 28h3M18.8 31h2.6" stroke="#7f889d" stroke-width="1" stroke-linecap="round"/>`,
  cebra: () => `
    <path d="M14 4q6-4 12 0l-2 7h-8z" fill="${T}"/>
    <ellipse cx="11" cy="9" rx="2.6" ry="4.6" fill="#fff" stroke="${T}" stroke-width="1.2" transform="rotate(-25 11 9)"/>
    <ellipse cx="29" cy="9" rx="2.6" ry="4.6" fill="#fff" stroke="${T}" stroke-width="1.2" transform="rotate(25 29 9)"/>
    <path d="M10 18q0-11 10-11t10 11v8q0 11-10 11T10 26z" fill="#fff" stroke="${T}" stroke-width="1.2"/>
    <path d="M11 14h5M11 19h4M29 14h-5M29 19h-4M16 9l4 3l4-3M10.6 23.5h3.4M29.4 23.5h-3.4" stroke="${T}" stroke-width="2" stroke-linecap="round" fill="none"/>
    <ellipse cx="20" cy="31" rx="8" ry="6" fill="#4a4458"/>
    <circle cx="17" cy="31" r="1.2" fill="#fff"/><circle cx="23" cy="31" r="1.2" fill="#fff"/>
    ${ojo(15.5, 17)}${ojo(24.5, 17)}`,
  flamenco: () => `
    <path d="M22 28v11M26 28l-2 5l3 6" stroke="#e0607e" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <ellipse cx="25" cy="23" rx="10" ry="7" fill="#f58fb0"/>
    <path d="M31 21q4 1 5 5q-4-1-6-1z" fill="#e0607e"/>
    <path d="M18 22q-6-4-4-10q2-5 0-7" fill="none" stroke="#f58fb0" stroke-width="3.6" stroke-linecap="round"/>
    <circle cx="12.5" cy="6" r="4.4" fill="#f58fb0"/>
    <path d="M9 5q-5 0-5 5q2-2 4-2z" fill="#fff"/><path d="M4.4 9.4q.4 1.8 1.6 2.6l1-3z" fill="${T}"/>
    ${ojo(13.2, 5, 1.4)}`,
  tortuga: () => `
    <ellipse cx="10" cy="31" rx="3.4" ry="3" fill="#8bc34a"/><ellipse cx="30" cy="31" rx="3.4" ry="3" fill="#8bc34a"/>
    <path d="M35 26l4 1.6l-4 1.6z" fill="#8bc34a"/>
    <circle cx="6" cy="22" r="5.6" fill="#8bc34a"/>
    ${ojo(4.6, 20.6, 1.5)}
    <path d="M3.2 24.4q1.6 1.2 3.4.4" fill="none" stroke="${T}" stroke-width="1.1" stroke-linecap="round"/>
    <path d="M8 29q0-18 14-18t14 18z" fill="#3f8f45"/>
    <path d="M22 13.4l5 4v6l-5 4l-5-4v-6z" fill="#6cbf5f"/>
    <path d="M12.6 22l3 4.6M31.4 22l-3 4.6M17 17.4l-4-2.4M27 17.4l4-2.4" stroke="#6cbf5f" stroke-width="2" stroke-linecap="round"/>
    <path d="M8 29h28" stroke="#2f6e34" stroke-width="2" stroke-linecap="round"/>`,
  oso: () => `
    <circle cx="9" cy="9" r="6" fill="#6d4426"/><circle cx="9" cy="9" r="3.2" fill="#b98457"/>
    <circle cx="31" cy="9" r="6" fill="#6d4426"/><circle cx="31" cy="9" r="3.2" fill="#b98457"/>
    <circle cx="20" cy="21" r="15" fill="#7a4b2a"/>
    <ellipse cx="20" cy="27" rx="8" ry="6.5" fill="#c99d70"/>
    ${ojo(14, 18)}${ojo(26, 18)}
    <ellipse cx="20" cy="24.2" rx="3" ry="2.2" fill="${T}"/>
    <path d="M20 26.4v2M17 29.4q3 2 6 0" fill="none" stroke="${T}" stroke-width="1.2" stroke-linecap="round"/>`,
  hipopotamo: () => `
    <ellipse cx="11" cy="6.4" rx="2.6" ry="3" fill="#7d7fa8"/><ellipse cx="29" cy="6.4" rx="2.6" ry="3" fill="#7d7fa8"/>
    <ellipse cx="20" cy="15" rx="12" ry="10" fill="#8e8fb8"/>
    <circle cx="14" cy="10" r="4" fill="#8e8fb8"/><circle cx="26" cy="10" r="4" fill="#8e8fb8"/>
    ${ojo(14, 10.4)}${ojo(26, 10.4)}
    <ellipse cx="20" cy="27" rx="15" ry="10" fill="#a3a4cc"/>
    <ellipse cx="14" cy="23.4" rx="1.8" ry="1.3" fill="#5e5f86"/><ellipse cx="26" cy="23.4" rx="1.8" ry="1.3" fill="#5e5f86"/>
    <path d="M11 30q9 6 18 0" fill="none" stroke="#5e5f86" stroke-width="1.4" stroke-linecap="round"/>
    <rect x="14" y="30.4" width="3" height="3.4" rx="1" fill="#fff"/><rect x="23" y="30.4" width="3" height="3.4" rx="1" fill="#fff"/>`,
  rana: () => `
    <ellipse cx="8" cy="35" rx="6" ry="3" fill="#43a047"/><ellipse cx="32" cy="35" rx="6" ry="3" fill="#43a047"/>
    <ellipse cx="20" cy="25" rx="16" ry="12" fill="#5cbf60"/>
    <ellipse cx="20" cy="29" rx="9" ry="6.4" fill="#c5e8a5"/>
    <circle cx="11" cy="13" r="7" fill="#5cbf60"/><circle cx="29" cy="13" r="7" fill="#5cbf60"/>
    <circle cx="11" cy="13" r="4.6" fill="#fff"/><circle cx="29" cy="13" r="4.6" fill="#fff"/>
    ${ojo(12, 13.5, 2.4)}${ojo(28, 13.5, 2.4)}
    <path d="M9 22q11 8 22 0" fill="none" stroke="#2e7d32" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="7.6" cy="23.6" r="2" fill="#f48fb1" opacity=".7"/><circle cx="32.4" cy="23.6" r="2" fill="#f48fb1" opacity=".7"/>`,
  buho: () => `
    <path d="M7 5l6 7h-6zM33 5l-6 7h6z" fill="#6d4c41"/>
    <ellipse cx="20" cy="22" rx="14" ry="16" fill="#8d6e63"/>
    <ellipse cx="20" cy="28" rx="9" ry="9" fill="#d7b99a"/>
    <path d="M16 25l1.4 1.6l1.4-1.6M21.2 25l1.4 1.6l1.4-1.6M18.6 30l1.4 1.6l1.4-1.6" fill="none" stroke="#8d6e63" stroke-width="1.1" stroke-linecap="round"/>
    <circle cx="13.6" cy="15" r="6" fill="#ffcc66"/><circle cx="26.4" cy="15" r="6" fill="#ffcc66"/>
    <circle cx="13.6" cy="15" r="4.2" fill="#fff"/><circle cx="26.4" cy="15" r="4.2" fill="#fff"/>
    ${ojo(13.6, 15, 2.3)}${ojo(26.4, 15, 2.3)}
    <path d="M18.2 19.4h3.6l-1.8 3.4z" fill="#f39c33"/>`,
};

export function svgAnimal(id, etiqueta = "") {
  const d = DIBUJOS[id] || DIBUJOS.mono;
  return caja(d(), etiqueta || id);
}

// El cuidador del zoológico, con sombrero de safari. `feliz` levanta la mano.
export function svgCuidador(feliz = false) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 72" aria-hidden="true">
    <path d="M14 72q0-22 16-22t16 22z" fill="#5b8c3a"/>
    <path d="M24 50l6 8l6-8" fill="#eadbb8"/>
    <rect x="27" y="58" width="6" height="14" fill="#4a7530"/>
    ${feliz
      ? `<path d="M44 58q8-6 9-18" stroke="#f1c27d" stroke-width="5" stroke-linecap="round" fill="none"/><circle cx="53" cy="38" r="4" fill="#f1c27d"/>`
      : `<path d="M44 58q6 5 4 13" stroke="#5b8c3a" stroke-width="6" stroke-linecap="round" fill="none"/>`}
    <circle cx="30" cy="34" r="13" fill="#f1c27d"/>
    <circle cx="25.4" cy="34" r="1.8" fill="${T}"/><circle cx="34.6" cy="34" r="1.8" fill="${T}"/>
    <path d="M25 39.6q5 4.4 10 0" fill="none" stroke="${T}" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="21.6" cy="38" r="2.2" fill="#f48fb1" opacity=".55"/><circle cx="38.4" cy="38" r="2.2" fill="#f48fb1" opacity=".55"/>
    <ellipse cx="30" cy="24" rx="21" ry="5" fill="#c9a96b"/>
    <path d="M17 24q0-14 13-14t13 14z" fill="#d8bb7e"/>
    <path d="M17.6 21h24.8" stroke="#8b6b3d" stroke-width="2.4"/>
  </svg>`;
}

// La canasta de comida del pedido.
export function svgComida() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" aria-hidden="true">
    <path d="M10 16q0-10 10-10t10 10" fill="none" stroke="#8b5a2b" stroke-width="2.4"/>
    <path d="M14 11q4-6 9-3q-5 0-7 6z" fill="#ffd43b"/>
    <circle cx="13" cy="15" r="4.4" fill="#ff5a4a"/><circle cx="21" cy="14" r="4.6" fill="#7bc950"/>
    <ellipse cx="28" cy="15" rx="5" ry="3" fill="#5fb3e6"/><path d="M32 15l4-3v6z" fill="#5fb3e6"/>
    <path d="M5 17h30l-4 18H9z" fill="#c8893f"/>
    <path d="M7 23h26M8.6 29h22.8M14 17l1 18M20 17v18M26 17l-1 18" stroke="#a46a2c" stroke-width="1.4"/>
  </svg>`;
}

export const PAUSA = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4.4" height="14" rx="1.4" fill="currentColor"/><rect x="13.6" y="5" width="4.4" height="14" rx="1.4" fill="currentColor"/></svg>`;
export const PLAY = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.6l12 7.4l-12 7.4z" fill="currentColor"/></svg>`;
export const FLAMA = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1.5-4.5 3-6 0 2 1 3 2 3 0-3-1-6 1-9z" fill="#ff6b4a"/><path d="M12 13c.5 2 3 3 3 5.5a3 3 0 0 1-6 0c0-1.5 1-2.5 3-5.5z" fill="#ffc43d"/></svg>`;
export const CHECK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>`;
export const CANDADO = `<svg class="ico" viewBox="0 0 24 24" aria-label="Cerrado"><rect x="5" y="10" width="14" height="11" rx="2.5" fill="currentColor" opacity=".5"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>`;
export const MAS = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/></svg>`;
export const MENOS = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/></svg>`;
export const ARRIBA = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 15l7-7l7 7" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const ABAJO = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9l7 7l7-7" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const LUPA = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M14.5 14.5l5 5" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`;

export function estrellasHtml(n, grande) {
  const estrella = (on) => `<svg viewBox="0 0 24 24" class="${on ? "on" : "off"}" aria-hidden="true"><path d="M12 2.5l2.7 6.3 6.8.6-5.2 4.4 1.6 6.6L12 16.8 6.1 20.4l1.6-6.6L2.5 9.4l6.8-.6z"/></svg>`;
  return `<span class="estrellas${grande ? " grande" : ""}" aria-label="${n} de 3">${[0, 1, 2].map((i) => estrella(i < n)).join("")}</span>`;
}
