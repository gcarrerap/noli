// Salas del control remoto (issue #3): la TV abre una sala con un código de 4 dígitos y el teléfono se une con
// ese código. Funciones puras: generar y leer códigos, saber si una sala sigue viva y armar la liga del control.
// Lo que toca Firestore está en services/salas.js.
//
// Una sala (documento noli_salas/{código}):
//   { codigo, tv, sesion, creada, vence, tvVisto, control: { id, sid, visto } | null }
//   tv       usuario (anónimo) de Firebase de la TV que la abrió
//   sesion   id de esta vez que la TV abrió la sala (si la TV recarga, la vuelve a abrir con otra sesión)
//   vence    ms; la TV lo empuja hacia adelante cada minuto mientras está prendida. Si la TV se apaga, la sala
//            se vence sola en unos minutos y su código queda libre (como la limpieza de mesas del dominó).
//   control  el teléfono que la está usando (el último que se unió) y cuándo avisó por última vez

export const SALA_VIDA_MS = 3 * 60 * 1000;        // sin latido de la TV en este tiempo, la sala ya no sirve
export const LATIDO_TV_MS = 60 * 1000;            // cada cuánto la TV renueva la sala
export const LATIDO_CONTROL_MS = 20 * 1000;       // cada cuánto el teléfono avisa que sigue ahí
export const CONTROL_VIVO_MS = 60 * 1000;         // sin aviso del teléfono en este tiempo, la TV lo da por ido
export const ESPERA_WEBRTC_MS = 5 * 1000;         // si WebRTC no conecta en este tiempo, las acciones van por Firestore

const CODIGO = /^[0-9]{4}$/;

// Código nuevo de 4 dígitos, sin cero al principio (se lee y se dicta mejor): 1000–9999
export function nuevoCodigo(rand = Math.random) {
  return String(1000 + Math.floor(rand() * 9000));
}

export const esCodigo = (c) => typeof c === "string" && CODIGO.test(c);

// Lo que escribió la persona → código, o null. Acepta espacios y guiones ("47 29", "4-7-2-9").
export function leerCodigo(texto) {
  const c = String(texto == null ? "" : texto).replace(/[\s-]/g, "");
  return esCodigo(c) ? c : null;
}

// ¿La sala existe y la TV la sigue renovando?
export function salaVigente(sala, now = Date.now()) {
  return !!sala && esCodigo(sala.codigo) && typeof sala.vence === "number" && sala.vence > now;
}

// ¿El teléfono de la sala avisó hace poco?
export function controlVivo(sala, now = Date.now()) {
  const c = sala && sala.control;
  return !!c && typeof c.visto === "number" && now - c.visto < CONTROL_VIVO_MS;
}

// Liga que abre el control en el teléfono, junto a la página del catálogo (sirve igual en GitHub Pages y en local)
export function urlControl(paginaActual, codigo) {
  const u = new URL("control.html", paginaActual);
  u.search = "?sala=" + codigo;
  u.hash = "";
  return u.href;
}
