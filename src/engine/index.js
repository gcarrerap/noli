// API de la lógica pura del catálogo
export { validarManifiesto, jugableEn, modoDe, CONTROLES } from "./manifiesto.js";
export { materias, filtrar, mover } from "./catalogo.js";
export { nuevoCodigo, esCodigo, leerCodigo, salaVigente, controlVivo, urlControl,
  SALA_VIDA_MS, LATIDO_TV_MS, LATIDO_CONTROL_MS, CONTROL_VIVO_MS, ESPERA_WEBRTC_MS } from "./sala.js";
export { qr, qrSvg } from "./qr.js";
export { REGLAS, MOTIVOS, TIPOS_CREDITOS, libroVacio, leerLibro, saldo, saldoVisible, dia, ganadoHoy, ganancia, idMov, agregar,
  gastar, premio, unir, iguales, compactar, historial } from "./creditos.js";
export { revisarMundo, colocarLugares, centroSitio, solidoDe, mapaMundo, fisicaDe, azar, decorar, todosLosSitios, lugarCercano,
  cristalesDe, cristalTocado, crearCaminos, rutaPorCaminos, puntoLibre, plataformasAlcanzables, elegirVista, acomodarLetreros, brazoCamara } from "./mundo.js";
export { revisarLibros, librosDe, estadoLibros, conHallazgo, nivelPista, libroTocado } from "./libros.js";
export { conIslas } from "./admin.js";
export { DISPOSITIVO_ADMIN, ponerSaldo, saldoDe, CAMPOS_PASARELA, resumenPasarela, nivelPorPuntos, conPasarela, libroDe, conLibro, fecha,
  resumenPerfil, CAMPOS_JUEGO, leerRuta, ponerRuta, valorCampo, conCampos, resumenJuego, estrellasDe, conEstrellas, cristalesEncontrados,
  conCristales, leerJson } from "./admin.js";
export { formaDe, centroIsla, dentro, aOrilla, orillaHacia, armarIslas, plataformasDe, posPlataforma, vecinas, alcanzablesDesde,
  variosCaminos, revisarIslas, revisarSaltos, normalizar as normalizarMundo, unirMundo, mismoMundo, sumarEstrellas, estrellasDeJuego,
  disponibles, puedeConstruir, construir, conVisita, estrellasPosibles, estadoRed, solidoPlataforma, mapaIslas, limitesRed, islaEn,
  muelleEn, teletransportadorDe, enTeletransportador, vistaMapa, TOPE_ESTRELLAS, INICIO as ISLA_INICIO, salidasNoli, libresNoli,
  ANCHO_PUENTE, puntoMapa } from "./islas.js";
