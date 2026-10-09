// API de la lógica pura del catálogo
export { validarManifiesto, jugableEn, CONTROLES } from "./manifiesto.js";
export { materias, filtrar, mover } from "./catalogo.js";
export { nuevoCodigo, esCodigo, leerCodigo, salaVigente, controlVivo, urlControl,
  SALA_VIDA_MS, LATIDO_TV_MS, LATIDO_CONTROL_MS, CONTROL_VIVO_MS, ESPERA_WEBRTC_MS } from "./sala.js";
export { qr, qrSvg } from "./qr.js";
export { REGLAS, MOTIVOS, TIPOS_CREDITOS, libroVacio, leerLibro, saldo, saldoVisible, dia, ganadoHoy, ganancia, idMov, agregar,
  gastar, unir, iguales, compactar, historial } from "./creditos.js";
export { revisarMundo, colocarLugares, centroSitio, solidoDe, mapaMundo, fisicaDe, azar, decorar, todosLosSitios, lugarCercano,
  cristalesDe, cristalTocado, crearCaminos, rutaPorCaminos, puntoLibre, plataformasAlcanzables, elegirVista, acomodarLetreros, brazoCamara } from "./mundo.js";
