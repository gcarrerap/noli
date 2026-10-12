// Todo el arte en SVG (sin emojis: en la TV LG salen en blanco y negro, #5). Strings puros, sin DOM.

const svg = (cuerpo, etiqueta = "", vb = "0 0 100 100") =>
  `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg"${etiqueta ? ` role="img" aria-label="${etiqueta}"` : ' aria-hidden="true"'}>${cuerpo}</svg>`;

const LUNA = "#ece8d6", LUNA_S = "#c9c3aa", OSCURA = "#3a3552", CIELO = "#141433";
const estrellitas = (pts) => pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity=".85"/>`).join("");
const crateres = `<circle cx="38" cy="38" r="8" fill="${LUNA_S}"/><circle cx="62" cy="56" r="11" fill="${LUNA_S}"/><circle cx="40" cy="66" r="5" fill="${LUNA_S}"/><circle cx="64" cy="31" r="4" fill="${LUNA_S}"/>`;
const tierra = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#3b8ee8"/>
  <path d="M${cx - r * .55} ${cy - r * .5}q${r * .35} -${r * .25} ${r * .6} 0t${r * .3} ${r * .45}q-${r * .3} ${r * .2} -${r * .55} ${r * .05}z" fill="#47c26b"/>
  <path d="M${cx + r * .1} ${cy + r * .25}q${r * .4} -${r * .1} ${r * .55} ${r * .2}q-${r * .1} ${r * .4} -${r * .45} ${r * .35}z" fill="#47c26b"/>
  <path d="M${cx - r * .7} ${cy + r * .1}q${r * .3} ${r * .05} ${r * .4} ${r * .35}" stroke="#fff" stroke-width="${r * .1}" fill="none" stroke-linecap="round" opacity=".8"/>`;
const astronautaCuerpo = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
  <rect x="-15" y="-2" width="30" height="34" rx="10" fill="#f5f5f5" stroke="#9aa0b5" stroke-width="2"/>
  <rect x="-22" y="0" width="9" height="24" rx="4.5" fill="#dcdfe9" stroke="#9aa0b5" stroke-width="2"/>
  <rect x="13" y="0" width="9" height="24" rx="4.5" fill="#dcdfe9" stroke="#9aa0b5" stroke-width="2"/>
  <rect x="-12" y="30" width="10" height="18" rx="4" fill="#f5f5f5" stroke="#9aa0b5" stroke-width="2"/>
  <rect x="2" y="30" width="10" height="18" rx="4" fill="#f5f5f5" stroke="#9aa0b5" stroke-width="2"/>
  <circle cx="0" cy="-16" r="15" fill="#f5f5f5" stroke="#9aa0b5" stroke-width="2"/>
  <rect x="-10" y="-23" width="20" height="13" rx="6" fill="#2a3a6e"/><rect x="-7" y="-21" width="6" height="4" rx="2" fill="#8fb4ff" opacity=".8"/>
  <rect x="-6" y="8" width="12" height="8" rx="2" fill="#4cb3ff"/><circle cx="3" cy="12" r="1.6" fill="#ff6b4a"/></g>`;

// Una fase de la Luna (0 nueva … 4 llena … 7), vista desde el hemisferio norte.
export function svgFase(n, etiqueta = "") {
  const f = ((n % 8) + 8) % 8, cx = 50, cy = 50, r = 40;
  const fondo = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${OSCURA}" stroke="#7d7898" stroke-width="2"${f === 0 ? ' stroke-dasharray="5 5"' : ""}/>`;
  if (f === 0) return svg(fondo, etiqueta);
  if (f === 4) return svg(fondo + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${LUNA}"/>${crateres}`, etiqueta);
  const theta = (f / 8) * 2 * Math.PI;
  const rx = Math.abs(Math.cos(theta)) * r;
  const creciente = f < 4, gibosa = f === 3 || f === 5;
  const lado = creciente ? 1 : 0;                       // semicírculo de la derecha (1) o de la izquierda (0)
  const vuelta = creciente ? (gibosa ? 1 : 0) : (gibosa ? 0 : 1);
  const d = `M${cx} ${cy - r}A${r} ${r} 0 0 ${lado} ${cx} ${cy + r}A${rx.toFixed(2)} ${r} 0 0 ${vuelta} ${cx} ${cy - r}Z`;
  return svg(fondo + `<path d="${d}" fill="${LUNA}"/>`, etiqueta);
}

const D = {
  moon: `<circle cx="50" cy="50" r="40" fill="${LUNA}" stroke="${LUNA_S}" stroke-width="2"/>${crateres}`,
  earth: tierra(50, 50, 40),
  sun: `<g stroke="#ffb400" stroke-width="7" stroke-linecap="round">${Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4, x1 = 50 + 32 * Math.cos(a), y1 = 50 + 32 * Math.sin(a), x2 = 50 + 45 * Math.cos(a), y2 = 50 + 45 * Math.sin(a);
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`; }).join("")}</g>
    <circle cx="50" cy="50" r="25" fill="#ffd23d" stroke="#ffb400" stroke-width="3"/>`,
  star: `<path d="M50 8l12.9 27.5 30.1 3.6-22.2 20.6 5.8 29.8L50 74.6 23.4 89.5l5.8-29.8L7 39.1l30.1-3.6z" fill="#ffd23d" stroke="#ffb400" stroke-width="4" stroke-linejoin="round"/>`,
  orbit: `<ellipse cx="50" cy="52" rx="42" ry="26" fill="none" stroke="#9fb3ff" stroke-width="3" stroke-dasharray="6 6"/>
    ${tierra(50, 52, 17)}<circle cx="88" cy="44" r="8" fill="${LUNA}" stroke="${LUNA_S}" stroke-width="2"/>
    <path d="M78 26l9 4-7 7" fill="none" stroke="#9fb3ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
  crater: `<path d="M4 60q46-14 92 0v34H4z" fill="#b9b39d"/><ellipse cx="50" cy="66" rx="32" ry="13" fill="#8c8670"/>
    <ellipse cx="50" cy="69" rx="25" ry="9" fill="#6f6a57"/><path d="M18 64q32-14 64 0" fill="none" stroke="${LUNA}" stroke-width="4" stroke-linecap="round"/>
    <circle cx="16" cy="82" r="4" fill="#8c8670"/><circle cx="84" cy="84" r="3" fill="#8c8670"/>`,
  rock: `<path d="M14 70l10-30 24-14 26 8 14 28-8 16-34 6z" fill="#9b968a" stroke="#6f6a5f" stroke-width="3" stroke-linejoin="round"/>
    <path d="M48 26l-6 26 32 8" fill="none" stroke="#6f6a5f" stroke-width="2" opacity=".6"/>
    <circle cx="30" cy="58" r="3" fill="#6f6a5f"/><circle cx="62" cy="72" r="2.5" fill="#6f6a5f"/><circle cx="70" cy="46" r="2" fill="#6f6a5f"/>`,
  dust: `<path d="M6 78q44-30 88 0v14H6z" fill="#b9b39d"/>
    ${[[30, 52, 4], [44, 40, 3], [58, 48, 5], [70, 36, 3], [40, 60, 2.5], [62, 62, 3], [52, 30, 2], [76, 54, 2.5], [24, 66, 2]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#c9c3aa"/>`).join("")}
    <path d="M36 82q4-8 10-2" fill="none" stroke="#8c8670" stroke-width="3" stroke-linecap="round"/>`,
  telescope: `<g transform="rotate(-25 50 40)"><rect x="18" y="30" width="58" height="18" rx="5" fill="#4cb3ff" stroke="#2a6fb0" stroke-width="3"/>
    <rect x="72" y="26" width="12" height="26" rx="4" fill="#2a6fb0"/><rect x="10" y="34" width="10" height="10" rx="3" fill="#2a6fb0"/></g>
    <g stroke="#6c6a80" stroke-width="5" stroke-linecap="round"><line x1="50" y1="52" x2="30" y2="92"/><line x1="50" y1="52" x2="70" y2="92"/><line x1="50" y1="52" x2="50" y2="92"/></g>`,
  gravity: `<path d="M8 86h84" stroke="#47c26b" stroke-width="8" stroke-linecap="round"/>
    <circle cx="50" cy="24" r="14" fill="#ff6b4a"/><path d="M50 10q2-6 8-6" stroke="#5a3a1a" stroke-width="3" fill="none"/><path d="M52 9q8-4 12 2q-8 3-12-2z" fill="#47c26b"/>
    <g stroke="#ffd23d" stroke-width="5" stroke-linecap="round" fill="none"><line x1="50" y1="44" x2="50" y2="72"/><path d="M40 62l10 11 10-11"/></g>`,
  rocket: `<path d="M50 6c16 12 22 34 18 58H32C28 40 34 18 50 6z" fill="#f5f5f5" stroke="#9aa0b5" stroke-width="3"/>
    <path d="M50 6c7 5 12 12 15 20H35c3-8 8-15 15-20z" fill="#ff6b4a"/>
    <circle cx="50" cy="38" r="9" fill="#4cb3ff" stroke="#2a6fb0" stroke-width="3"/>
    <path d="M32 50L18 70l15-2zM68 50l14 20-15-2z" fill="#ff6b4a"/>
    <path d="M38 66q12 34 24 0z" fill="#ffb400"/><path d="M43 66q7 20 14 0z" fill="#ffe28a"/>`,
  spacesuit: `<path d="M50 6v8M38 18l12-6 12 6" fill="none" stroke="#9aa0b5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="34" y="18" width="32" height="38" rx="10" fill="#f5f5f5" stroke="#9aa0b5" stroke-width="2.5"/>
    <rect x="22" y="20" width="11" height="30" rx="5.5" fill="#dcdfe9" stroke="#9aa0b5" stroke-width="2.5"/><rect x="67" y="20" width="11" height="30" rx="5.5" fill="#dcdfe9" stroke="#9aa0b5" stroke-width="2.5"/>
    <rect x="36" y="54" width="12" height="30" rx="5" fill="#f5f5f5" stroke="#9aa0b5" stroke-width="2.5"/><rect x="52" y="54" width="12" height="30" rx="5" fill="#f5f5f5" stroke="#9aa0b5" stroke-width="2.5"/>
    <rect x="34" y="82" width="15" height="8" rx="3" fill="#6c6a80"/><rect x="51" y="82" width="15" height="8" rx="3" fill="#6c6a80"/>
    <rect x="43" y="28" width="14" height="9" rx="2" fill="#4cb3ff"/><circle cx="53" cy="32.5" r="1.8" fill="#ff6b4a"/>
    <path d="M42 18q8 6 16 0" fill="none" stroke="#9aa0b5" stroke-width="2.5"/>`,
  astronaut: `${astronautaCuerpo(44, 44, 1.05)}
    <rect x="70" y="4" width="3" height="56" fill="#9aa0b5"/><path d="M73 6h20v12H73z" fill="#ff6b4a"/><path d="M73 10h20M73 14h20" stroke="#fff" stroke-width="1.5"/>`,
  footprint: `<rect x="4" y="4" width="92" height="92" rx="14" fill="#b9b39d"/>
    <path d="M38 14c14-4 26 6 24 24-2 14-4 18-2 26 3 14-6 24-18 22-12-2-14-14-12-24 2-8 0-14-2-22-2-12 0-24 10-26z" fill="#8c8670"/>
    <g stroke="#b9b39d" stroke-width="4" stroke-linecap="round"><line x1="36" y1="26" x2="56" y2="24"/><line x1="36" y1="36" x2="58" y2="34"/><line x1="38" y1="46" x2="58" y2="44"/><line x1="40" y1="68" x2="56" y2="66"/><line x1="40" y1="78" x2="54" y2="77"/></g>`,
  "dia-noche": `<rect width="100" height="100" rx="14" fill="${CIELO}"/>${estrellitas([[80, 14, 1.5], [90, 40, 1.2], [70, 88, 1.4]])}
    <circle cx="10" cy="50" r="20" fill="#ffd23d"/><g stroke="#ffd23d" stroke-width="3" opacity=".7"><line x1="32" y1="40" x2="44" y2="42"/><line x1="32" y1="50" x2="44" y2="50"/><line x1="32" y1="60" x2="44" y2="58"/></g>
    ${tierra(68, 50, 22)}<path d="M68 28a22 22 0 0 1 0 44z" fill="#000" opacity=".5"/>`,
  fases: [0, 2, 4, 6].map((f, i) => `<g transform="translate(${2 + i * 24.5} 38) scale(.23)">${svgFase(f).replace(/^<svg[^>]*>|<\/svg>$/g, "")}</g>`).join(""),
  mar: `<circle cx="72" cy="22" r="13" fill="${LUNA}"/><path d="M0 56q12-8 25 0t25 0 25 0 25 0v44H0z" fill="#3b8ee8"/>
    <path d="M0 70q12-8 25 0t25 0 25 0 25 0" fill="none" stroke="#8fd0ff" stroke-width="3"/><path d="M0 92h100v8H0z" fill="#f2d48a"/>
    <g stroke="#ffd23d" stroke-width="3" stroke-linecap="round" fill="none"><line x1="72" y1="38" x2="72" y2="50"/><path d="M66 44l6-7 6 7"/></g>`,
  "foto-llena": `<rect width="100" height="100" rx="14" fill="${CIELO}"/>${estrellitas([[12, 14, 1.4], [86, 18, 1.8], [18, 82, 1.2], [88, 76, 1.5], [50, 8, 1]])}
    <g transform="translate(18 18) scale(.64)">${'<circle cx="50" cy="50" r="40" fill="' + LUNA + '"/>' + crateres}</g>`,
  "foto-crater": `<rect width="100" height="100" rx="14" fill="${CIELO}"/>${estrellitas([[14, 14, 1.4], [80, 10, 1.6], [56, 24, 1.1]])}
    <path d="M0 50q50-12 100 0v36a14 14 0 0 1-14 14H14A14 14 0 0 1 0 86z" fill="#b9b39d"/>
    <ellipse cx="50" cy="70" rx="38" ry="15" fill="#8c8670"/><ellipse cx="50" cy="73" rx="30" ry="10" fill="#6f6a57"/>
    <path d="M12 68q38-18 76 0" fill="none" stroke="${LUNA}" stroke-width="4" stroke-linecap="round"/>`,
  "foto-tierra": `<rect width="100" height="100" rx="14" fill="${CIELO}"/>${estrellitas([[12, 12, 1.4], [86, 22, 1.6], [70, 8, 1.1], [20, 40, 1]])}
    ${tierra(50, 42, 22)}<path d="M50 20a22 22 0 0 0 0 44z" fill="#000" opacity=".45"/>
    <path d="M0 74q50-16 100 0v12a14 14 0 0 1-14 14H14A14 14 0 0 1 0 86z" fill="#b9b39d"/>`,
  "foto-fases": `<rect width="100" height="100" rx="14" fill="${CIELO}"/>${Array.from({ length: 8 }, (_, f) => {
    const a = (f / 8) * 2 * Math.PI - Math.PI / 2, x = 50 + 33 * Math.cos(a) - 9, y = 50 + 33 * Math.sin(a) - 9;
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(.18)">${svgFase(f).replace(/^<svg[^>]*>|<\/svg>$/g, "")}</g>`; }).join("")}
    ${tierra(50, 50, 9)}`,
  "foto-salto": `<rect width="100" height="100" rx="14" fill="${CIELO}"/>${estrellitas([[14, 12, 1.4], [86, 16, 1.6], [60, 8, 1]])}
    <path d="M0 80q50-10 100 0v6a14 14 0 0 1-14 14H14A14 14 0 0 1 0 86z" fill="#b9b39d"/>
    <path d="M16 80q20-70 50-34" fill="none" stroke="#9fb3ff" stroke-width="2.5" stroke-dasharray="4 5"/>${astronautaCuerpo(70, 36, .6)}`,
  "foto-huella": `<rect width="100" height="100" rx="14" fill="${CIELO}"/>${estrellitas([[14, 10, 1.4], [84, 12, 1.6]])}
    <path d="M0 34q50-10 100 0v52a14 14 0 0 1-14 14H14A14 14 0 0 1 0 86z" fill="#b9b39d"/>
    <g transform="translate(30 38) scale(.42)"><path d="M38 14c14-4 26 6 24 24-2 14-4 18-2 26 3 14-6 24-18 22-12-2-14-14-12-24 2-8 0-14-2-22-2-12 0-24 10-26z" fill="#8c8670"/>
    <g stroke="#b9b39d" stroke-width="5" stroke-linecap="round"><line x1="36" y1="26" x2="56" y2="24"/><line x1="36" y1="40" x2="58" y2="38"/><line x1="40" y1="70" x2="56" y2="68"/></g></g>`,
  marte: `<circle cx="50" cy="50" r="40" fill="#d9603b"/><circle cx="36" cy="38" r="8" fill="#b84a2b"/><circle cx="62" cy="62" r="10" fill="#b84a2b"/><path d="M30 18q20-8 40 0" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".8"/>`,
};

export const DIBUJOS = new Set(Object.keys(D));
export const dibujo = (id, etiqueta = "") => (D[id] ? svg(D[id], etiqueta) : svg(`<circle cx="50" cy="50" r="30" fill="${OSCURA}"/>`, etiqueta));

// Íconos (stroke con currentColor: toman el color del texto)
const ico = (cuerpo, clase = "ico") => `<svg class="${clase}" viewBox="0 0 24 24" aria-hidden="true">${cuerpo}</svg>`;
export const ALTAVOZ = ico('<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>');
export const CANDADO = ico('<rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.5"/>');
export const CHECK = ico('<path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>');
export const FLAMA = ico('<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3-1-6 1-9z" fill="#ff8a3d"/><path d="M12 13c1 2 3 3 3 5a3 3 0 0 1-6 0c0-2 2-3 3-5z" fill="#ffd23d"/>');
export const LIBRO = ico('<path d="M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>');
export const OJO = ico('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="currentColor"/>');
export const ESTRELLA = (llena) => ico(`<path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" fill="${llena ? "#ffc43d" : "none"}" stroke="${llena ? "#ffb400" : "currentColor"}" stroke-width="1.6" stroke-linejoin="round"/>`, "ico estrella");
export const estrellasHtml = (n) => `<span class="estrellas" aria-label="${n} de 3 estrellas">${[0, 1, 2].map((i) => ESTRELLA(i < n)).join("")}</span>`;

// El cohete con sus tanques: lleno = cuántos tanques tienen combustible (0–3)
export function svgCohete(lleno = 0, total = 3) {
  const tanques = Array.from({ length: total }, (_, i) => {
    const y = 74 - i * 16, on = i < lleno;
    return `<rect x="40" y="${y}" width="20" height="12" rx="3" fill="${on ? "#3ccf8e" : "#2a2850"}" stroke="${on ? "#1f9a65" : "#6c6a90"}" stroke-width="2"/>`;
  }).join("");
  return svg(`<path d="M50 4c18 14 24 40 20 84H30C26 44 32 18 50 4z" fill="#f5f5f5" stroke="#9aa0b5" stroke-width="3"/>
    <path d="M50 4c8 6 13 14 16 22H34c3-8 8-16 16-22z" fill="#ff6b4a"/>
    <circle cx="50" cy="34" r="7" fill="#4cb3ff" stroke="#2a6fb0" stroke-width="2.5"/>
    <path d="M30 66L14 92l17-3zM70 66l16 26-17-3z" fill="#ff6b4a"/>${tanques}`, `Cohete con ${lleno} de ${total} tanques llenos`, "0 0 100 100");
}

// La roca del museo: una roca con la palabra (o con un signo de pregunta si aún no la tiene)
export function svgRoca(tiene) {
  return svg(`<path d="M10 70l10-34 26-18 30 8 16 30-10 20-38 8z" fill="${tiene ? "#a8a294" : "#3a3552"}" stroke="${tiene ? "#6f6a5f" : "#5a5578"}" stroke-width="3" stroke-linejoin="round"/>
    ${tiene ? '<circle cx="34" cy="60" r="3" fill="#6f6a5f"/><circle cx="70" cy="70" r="2.5" fill="#6f6a5f"/>' : '<text x="52" y="66" text-anchor="middle" font-size="30" font-weight="700" fill="#8a85a8" font-family="Fredoka,Arial,sans-serif">?</text>'}`);
}
