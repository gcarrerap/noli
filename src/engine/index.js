// API de la lógica pura del catálogo
export { validarManifiesto, jugableEn, CONTROLES } from "./manifiesto.js";
export { materias, filtrar, mover } from "./catalogo.js";
export { nuevoCodigo, esCodigo, leerCodigo, salaVigente, controlVivo, urlControl,
  SALA_VIDA_MS, LATIDO_TV_MS, LATIDO_CONTROL_MS, CONTROL_VIVO_MS, ESPERA_WEBRTC_MS } from "./sala.js";
export { qr, qrSvg } from "./qr.js";
