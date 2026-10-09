// Tienda de cajas sorpresa. La lógica vive en coleccion.js; aquí solo se pinta y se cobra.
// Sin await al nivel del módulo. Los créditos se piden con Noli.gastar, igual que los otros premios.
import { Noli, moverFoco } from "../../../kit/noli.js";
import { normalizarReglas, LIMITE_MIN, LIMITE_MAX } from "./reglas.js";
import { usarReglas } from "./coleccion.js";
import { rngConSemilla } from "./rng.js";
import {
  cargar, puedeAbrir, abrirConCreditos, comprar, cambiarLimite, ponerCerrada, ponerVoz,
  marcarGuia, cuentaRara, cuentaUltra, fechaLocal, ponerMeta, alinearDia,
} from "./coleccion.js";
import {
  guiaAvanzaConToque, focoDeGuia, cuandoAvanzaMuestra, finBloqueoPaso, bloqueoAlSeguir, muestraPuedeAvanzar,
  aplicarGuia, GUIA_MIN_MS, GUIA_MAX_MS, TRAS_GUIA_MS,
} from "./guia.js";
import { unirBloqueos, tapBloqueado, toqueConDialogo, toqueEnVelo, teclaConDialogo, atrasEnPantalla, TRAS_DIALOGO_MS } from "./salida.js";
import { decir, calentarVoces } from "./voz.js";
import { FAMILIAS, ordenarFamilia, familiaCompleta, familiaQueSeCompleto } from "./familias.js";
import { TEXTOS, textoGuia, vozGuia, fraseGarantia, fraseVisita, frasePolvo, frasePrecio, fraseCosto, fraseGuardar, fraseNueva, fraseTuya, etiquetaRol, fraseFamilia } from "./textos.js";
import {
  MARCA, esc, estrellasSvg, claseMarco, frascoSvg, iconoPolvo, iconoCredito, iconoVoz,
  fichasProbabilidad, htmlFoto, rutaPieza, rutaFamilia,
} from "./dibujo.js";
import { etapaSiguiente, esperaDeEtapa, seDeshabilitaAbrir, pulsoAbrir, pulsoTrasCarta, entradaTienda, entradaDetalle, CARTA_MS, TRAS_ABRIR_MS, TRAS_COMPRA_MS } from "./apertura.js";
import { preguntaPapas, responderPapas, entrarPuerta, salirPuerta, pulsoPuerta, PAPAS_QUIETO_MS } from "./papas.js";
import { QUIEN_VISIBLE, opcionesQuien, candidatosMeta } from "./quien.js";
import { sonar } from "./sonido.js";

const $main = document.getElementById("juego");
try { if (/[?&]modo=tv\b/.test(location.search)) document.documentElement.dataset.modo = "tv"; } catch { /* sin location */ }
try { calentarVoces(); } catch { /* sin voz en este aparato */ }

let reglas = null;
let piezas = [];
let pr = null;
let saldo = null;
let pantalla = "tienda";
let guia = null;
let salir = false;
let carta = null;
let detalleId = null;
let fotoId = null;
let fotoDesde = "vitrina";
let familiaVista = "calabaza";
let fotoPendiente = null;
let etapa = "cerrado";
let recien = false;
let cobrando = false;
let papasOk = false;
let pregunta = null;
let papasAviso = "";
let papasSeguidas = 0;
let papasFallos = 0;
let papasAceptaDesde = 0;
let papasCerradoHasta = 0;
let papasNivel = 0;

let aparecio = 0;
let vozTerminoEn = null;
let vozSono = false;
let vozFallo = false;
let bloqueoPasoHasta = 0;
let bloqueoDialogoHasta = 0;
let cartaHasta = 0;
let autoHasta = 0;
let revelarHasta = 0;
let pausaEn = 0;
let pasoToken = 0;
let aperturaToken = 0;
let relojMuestra = 0;
let relojEtapa = 0;
let relojRevelar = 0;
let relojBloqueo = 0;
let relojPapas = 0;

const modo = () => (document.documentElement.dataset.modo === "tv" || Noli.modo === "tv" ? "tv" : "tactil");
const esTv = () => modo() === "tv";
const guardar = () => { if (pr) Noli.guardar(pr); };
const rngUi = () => Math.random();

function pocaAnimacion() {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  catch { return false; }
}

function idFoco() {
  const el = document.activeElement;
  return el && el.dataset ? el.dataset.focoId || "" : "";
}

function hastaAhora() {
  return unirBloqueos(bloqueoPasoHasta, bloqueoDialogoHasta);
}

function bloqueado(act, ahora = Date.now()) {
  return tapBloqueado({ act, ahora, hastaPaso: bloqueoPasoHasta, hastaDialogo: bloqueoDialogoHasta });
}

function programarFinBloqueo() {
  clearTimeout(relojBloqueo);
  const falta = hastaAhora() - Date.now();
  if (falta > 0) relojBloqueo = setTimeout(() => { if (!salir) pintar(idFoco()); }, falta + 30);
}

function rngDeCaja() {
  if (!Number.isInteger(pr.semilla)) pr = { ...pr, semilla: Math.floor(Math.random() * 0x7fffffff) };
  return rngConSemilla(String(pr.semilla) + ":" + pr.cajas);
}

function rarezaDeCaptura() {
  if (Noli.enCatalogo) return null;
  try {
    const v = sessionStorage.getItem("cajas.forzar");
    if (v === "comun" || v === "rara" || v === "ultra") {
      sessionStorage.removeItem("cajas.forzar");
      return v;
    }
  } catch { /* sin sessionStorage */ }
  return null;
}

function puedeAhora() {
  if (!reglas || !pr) return false;
  return puedeAbrir(pr, { creditos: saldo, fecha: fechaLocal(), config: reglas, piezas }).ok;
}

function abrirApagado() {
  return seDeshabilitaAbrir({
    enGuia: !!guia,
    paso: guia ? guia.paso : "",
    puede: puedeAhora(),
  });
}

function focoAttr(id, inicial) {
  if (salir) return "";
  if (inicial) return `data-foco="inicial" data-foco-id="${esc(id)}"`;
  return `data-foco data-foco-id="${esc(id)}"`;
}

function metaPieza() {
  if (!pr || !pr.meta) return null;
  const p = piezas.find((x) => x.id === pr.meta);
  if (!p || pr.tenidas.includes(p.id)) return null;
  return p;
}

function htmlBarra(p) {
  if (!p || !reglas) return "";
  const precio = reglas.polvoPrecio[p.rareza] || 1;
  const lleno = Math.max(0, Math.min(100, Math.round((pr.polvo / precio) * 100)));
  return `<div class="meta-linea"><p>${esc(TEXTOS.metaPara)} ${esc(p.nombre)}</p>
    <div class="barra-meta" style="--lleno:${lleno}%" role="img" aria-label="${esc(p.nombre)}, ${pr.polvo} de ${precio}"><span></span></div></div>`;
}

function htmlVuelo() {
  return `<span class="polvo-vuela" aria-hidden="true">${iconoPolvo()}${iconoPolvo()}${iconoPolvo()}</span>`;
}

function cabecera() {
  const saltar = guia && !salir
    ? `<button type="button" class="boton saltar" tabindex="-1" data-act="saltar">${esc(TEXTOS.saltar)}</button>`
    : "";
  const cred = saldo == null ? "–" : String(saldo);
  return `<header class="cab">${saltar}
    <div class="marca-juego"><h1>${esc(TEXTOS.titulo)}</h1><p class="sub">${esc(TEXTOS.subtitulo)}</p></div>
    <div class="saldos">
      <span class="saldo">${iconoCredito()}<b>${esc(cred)}</b><span class="sr">${esc(TEXTOS.creditos)}</span></span>
      <span class="saldo">${iconoPolvo()}<b>${esc(pr.polvo)}</b><span class="sr">${esc(TEXTOS.polvo)}</span></span>
    </div>
  </header>`;
}

function htmlGarantias() {
  return `<p class="garantia">${esc(fraseGarantia(cuentaRara(pr, reglas), false))}</p>
    <p class="garantia">${esc(fraseGarantia(cuentaUltra(pr, reglas), true))}</p>`;
}

function bannerGuia() {
  if (!guia || salir) return "";
  const inicial = focoDeGuia(guia.paso) === "frase-guia";
  return `<button type="button" class="frase-guia" data-act="frase-guia" ${focoAttr("frase-guia", inicial)}>${esc(textoGuia(guia.paso, modo(), reglas))}</button>`;
}

function dialogo() {
  if (!salir) return "";
  return `<div class="velo" data-act="velo"><div class="dialogo" role="dialog" aria-modal="true" aria-label="${esc(TEXTOS.salirPregunta)}">
    <p>${esc(TEXTOS.salirPregunta)}</p>
    <button type="button" class="boton grande primario" data-act="seguir" data-foco="inicial" data-foco-id="seguir">${esc(TEXTOS.seguir)}</button>
    <button type="button" class="boton grande" data-act="salir" data-foco data-foco-id="salir">${esc(TEXTOS.salir)}</button>
  </div></div>`;
}

function htmlTienda() {
  const bloqueo = guia ? null : puedeAbrir(pr, { creditos: saldo, fecha: fechaLocal(), config: reglas, piezas });
  const on = !abrirApagado();
  const inicial = (!guia || guia.paso === "abrir") && on;
  const aviso = !bloqueo ? ""
    : bloqueo.razon === "cerrada" || bloqueo.razon === "limite" ? `<p class="aviso descanso">${esc(TEXTOS.descansando)}</p>`
    : bloqueo.razon === "creditos" ? `<p class="aviso amable">${esc(TEXTOS.sinCreditos)}</p>`
    : bloqueo.razon === "completa" ? `<p class="aviso amable">${esc(TEXTOS.completa)}</p>`
    : "";
  return `${cabecera()}${bannerGuia()}
    <div class="layout-tienda">
      <div class="col-caja">
        <div class="escena etapa-cerrado" aria-hidden="true">${frascoSvg()}</div>
        <button type="button" class="boton grande primario" data-act="abrir" ${focoAttr("abrir", inicial)} ${on ? "" : "disabled"}>${esc(TEXTOS.abrir)}<small>${iconoCredito()} ${esc(fraseCosto(reglas.costoCaja))}</small></button>
        ${aviso}
      </div>
      <div class="col-info">
        <p class="prob-intro">${esc(TEXTOS.probIntro)}</p>
        <ul class="prob">
          <li>${fichasProbabilidad("comun")}<span>${esc(TEXTOS.probComun)}</span></li>
          <li>${fichasProbabilidad("rara")}<span>${esc(TEXTOS.probRara)}</span></li>
          <li>${fichasProbabilidad("ultra")}<span>${esc(TEXTOS.probUltra)}</span></li>
        </ul>
        <p class="cuenta">${pr.tenidas.length} ${esc(TEXTOS.de)} ${piezas.length}</p>
        <div class="fila">
          <button type="button" class="boton" data-act="vitrina" ${focoAttr("vitrina", false)} ${guia ? "disabled" : ""}>${esc(TEXTOS.vitrina)}</button>
          <button type="button" class="boton" data-act="como" ${focoAttr("como", false)} ${guia ? "disabled" : ""}>${esc(TEXTOS.como)}</button>
        </div>
        <button type="button" class="boton" data-act="papas" ${focoAttr("papas", false)} ${guia ? "disabled" : ""}>${esc(TEXTOS.papas)}</button>
      </div>
    </div>
    ${dialogo()}`;
}

function htmlHueco(p, inicial) {
  const tiene = pr.tenidas.includes(p.id);
  const nombre = MARCA[p.rareza].nombre;
  const rol = etiquetaRol(p.rol);
  return `<button type="button" class="hueco ${claseMarco(p.rareza, tiene)}" data-act="hueco" data-id="${esc(p.id)}" ${focoAttr("hueco-" + p.id, inicial)} ${guia ? "disabled" : ""} aria-label="${esc(p.nombre)}, ${esc(rol)}, ${esc(nombre)}">
    ${htmlFoto(p, { tiene })}
    <b>${esc(p.nombre)}</b>
    <small>${esc(rol)}</small>
    ${estrellasSvg(MARCA[p.rareza].estrellas)}
  </button>`;
}

function htmlFotoMini(f) {
  if (!familiaCompleta(pr.tenidas, piezas, f.id)) return "";
  return `<button type="button" class="foto-familiar" data-act="ver-foto" data-familia="${esc(f.id)}" ${focoAttr("foto-" + f.id, false)} aria-label="${esc(TEXTOS.fotoFamiliar)} ${esc(f.nombre)}">
    <img class="foto" src="${esc(rutaFamilia(f.id))}" alt="" width="512" height="512" loading="lazy" decoding="async">
    <b>${esc(TEXTOS.fotoFamiliar)}</b>
  </button>`;
}

function familiasVisibles() {
  if (!esTv()) return FAMILIAS;
  const id = guia ? FAMILIAS[0].id : familiaVista;
  return FAMILIAS.filter((f) => f.id === id);
}

function htmlVitrina() {
  const bloques = familiasVisibles().map((f) => {
    const miembros = ordenarFamilia(piezas, f.id);
    const primero = esTv() && !guia && miembros[0] ? miembros[0].id : "";
    return `<section class="bloque-familia">
      <h2>${esc(f.nombre)}</h2>
      <div class="vitrina">${miembros.map((p) => htmlHueco(p, p.id === primero)).join("")}</div>
      ${htmlFotoMini(f)}
    </section>`;
  }).join("");
  const nav = esTv() && !guia ? `<div class="fila">
      <button type="button" class="boton" data-act="familia" data-delta="-1" ${focoAttr("familia-menos", false)}>${esc(TEXTOS.anterior)}</button>
      <button type="button" class="boton" data-act="familia" data-delta="1" ${focoAttr("familia-mas", false)}>${esc(TEXTOS.siguiente)}</button>
    </div>` : "";
  const meta = metaPieza();
  return `${cabecera()}${bannerGuia()}
    <button type="button" class="boton" data-act="volver" ${focoAttr("volver", !guia && !esTv())} ${guia ? "disabled" : ""}>${esc(TEXTOS.volver)}</button>
    ${htmlGarantias()}
    ${meta ? htmlBarra(meta) : ""}
    ${bloques}
    ${nav}
    ${dialogo()}`;
}

function htmlAbriendo() {
  return `${cabecera()}${bannerGuia()}
    <button type="button" class="escena etapa-${esc(etapa)}" data-act="etapa" ${focoAttr("etapa", true)} aria-label="${esc(TEXTOS.abriendo)}">${frascoSvg()}</button>
    <p class="aviso">${esc(TEXTOS.abriendo)}</p>
    ${dialogo()}`;
}

function htmlOir(p) {
  if (!p || !p.ingles) return "";
  return `<p class="linea-ingles">${esc(p.ingles)}</p>
    <button type="button" class="boton boton-oir" data-act="oir" data-id="${esc(p.id)}" ${focoAttr("oir", false)} aria-label="${esc(TEXTOS.oir)}">
      ${iconoVoz()}<span>${esc(TEXTOS.oir)}</span>
    </button>`;
}

function htmlQuiz(quiz) {
  const botones = quiz.map((o, i) =>
    `<button type="button" class="boton" data-act="quien" data-id="${esc(o.id)}" ${focoAttr("quien-" + i, i === 0)}>${esc(o.nombre)}</button>`
  ).join("");
  return `<p class="aviso">${esc(TEXTOS.quien)}</p><div class="fila quiz">${botones}</div>`;
}

function htmlMetaCarta() {
  const meta = metaPieza();
  if (meta) {
    const vuelo = carta.volar ? htmlVuelo() : "";
    return `<div class="zona-meta">${htmlBarra(meta)}${vuelo}<p class="nota">${esc(frasePolvo(carta.polvoGanado))}</p></div>`;
  }
  const opciones = candidatosMeta(pr.tenidas, piezas);
  if (!opciones.length) return `<p class="nota">${esc(frasePolvo(carta.polvoGanado))}</p>`;
  const botones = opciones.map((p, i) =>
    `<button type="button" class="boton" data-act="meta" data-id="${esc(p.id)}" ${focoAttr("meta-" + p.id, i === 0)}>${esc(fraseGuardar(p.nombre, p.genero))}</button>`
  ).join("");
  return `<p class="nota">${esc(frasePolvo(carta.polvoGanado))}</p><div class="fila">${botones}</div>`;
}

function htmlCarta() {
  const p = carta.pieza;
  const revelada = carta.fase === "revelada";
  const marco = revelada ? `festejo ${claseMarco(p.rareza, true)}` : "carta-plain";
  const esconderNombre = !revelada && carta.quiz;
  const nombre = esconderNombre ? "" : `<h2>${esc(p.nombre)}</h2>`;
  const rol = etiquetaRol(p.rol);
  const disfraz = p.disfraz ? ` · ${esc(p.disfraz)}` : "";
  const detalle = revelada ? `<p>${esc(rol)} · ${esc(MARCA[p.rareza].nombre)}${disfraz}</p>` : "";
  const estrellas = revelada ? estrellasSvg(MARCA[p.rareza].estrellas) : "";
  const oir = revelada ? htmlOir(p) : "";
  const linea = !revelada ? ""
    : carta.ejemplo ? TEXTOS.ejemplo
    : carta.duplicado ? fraseVisita(p.nombre)
    : fraseNueva(p.genero);
  const album = revelada && !carta.duplicado && !carta.ejemplo
    ? `<p class="album entra-album">${esc(TEXTOS.album)}</p>` : "";
  const visita = linea ? `<p class="aviso${carta.duplicado ? " visita" : ""}">${esc(linea)}</p>` : "";
  const quiz = !revelada && carta.quiz ? htmlQuiz(carta.quiz) : "";
  const meta = revelada && carta.duplicado && !carta.ejemplo ? htmlMetaCarta() : "";
  const garantias = revelada && !guia && !carta.ejemplo ? htmlGarantias() : "";
  const verFoto = revelada && carta.familiaNueva && !guia
    ? `<button type="button" class="boton grande" data-act="ver-foto" data-familia="${esc(carta.familiaNueva)}" ${focoAttr("ver-foto", false)}>${esc(TEXTOS.verFoto)}</button>`
    : "";
  const seguir = !revelada || guia ? ""
    : `<button type="button" class="boton grande primario" data-act="guardar-carta" ${focoAttr("guardar-carta", true)}>${esc(TEXTOS.aVitrina)}</button>`;
  const apurar = !revelada && !carta.quiz
    ? `<button type="button" class="carta-grande ${marco}" data-act="apurar" ${focoAttr("apurar", !guia)}>${htmlFoto(p, { grande: true, tiene: true })}${nombre}</button>`
    : `<article class="carta-grande ${marco}">
        ${htmlFoto(p, { grande: true, tiene: true })}
        ${estrellas}
        ${nombre}
        ${detalle}
        ${oir}
        ${visita}
        ${album}
      </article>`;
  const frasco = revelada ? "" : `<div class="escena etapa-figura" aria-hidden="true">${frascoSvg()}</div>`;
  return `${cabecera()}${bannerGuia()}
    ${frasco}
    ${apurar}
    ${quiz}
    ${meta}
    ${garantias}
    ${verFoto}
    ${seguir}
    ${dialogo()}`;
}

function htmlFotoFamiliar() {
  const f = FAMILIAS.find((x) => x.id === fotoId) || FAMILIAS[0];
  return `${cabecera()}
    <h2>${esc(TEXTOS.fotoFamiliar)}</h2>
    <p class="aviso">${esc(fraseFamilia(f.nombre))}</p>
    <img class="retrato" src="${esc(rutaFamilia(f.id))}" alt="" width="512" height="512">
    <button type="button" class="boton grande primario" data-act="cerrar-foto" ${focoAttr("cerrar-foto", true)}>${esc(TEXTOS.queBonita)}</button>
    ${dialogo()}`;
}

function htmlDetalle() {
  const p = piezas.find((x) => x.id === detalleId) || piezas[0];
  const tiene = pr.tenidas.includes(p.id);
  const precio = reglas.polvoPrecio[p.rareza];
  const puede = !tiene && pr.polvo >= precio;
  const disfraz = tiene && p.disfraz ? ` · ${esc(p.disfraz)}` : "";
  const rol = tiene ? `${esc(etiquetaRol(p.rol))} · ` : "";
  const oir = tiene ? htmlOir(p) : "";
  const foto = tiene && fotoPendiente && fotoPendiente === p.familia
    ? `<button type="button" class="boton grande" data-act="ver-foto" data-familia="${esc(p.familia)}" ${focoAttr("ver-foto", false)}>${esc(TEXTOS.verFoto)}</button>`
    : "";
  const guardarMeta = !tiene
    ? `<button type="button" class="boton" data-act="meta" data-id="${esc(p.id)}" ${focoAttr("meta-" + p.id, false)}>${esc(fraseGuardar(p.nombre, p.genero))}</button>`
    : "";
  const accion = tiene
    ? `<p class="aviso amable">${esc(recien ? fraseTuya(p.genero) : MARCA[p.rareza].nombre)}</p>`
    : `<p>${esc(frasePrecio(p.nombre, precio))}</p>
       <button type="button" class="boton grande primario" data-act="conseguir" ${focoAttr("conseguir", true)} ${puede ? "" : "disabled"}>${esc(puede ? TEXTOS.conseguir : TEXTOS.noAlcanza)}</button>
       ${guardarMeta}`;
  const barra = !tiene && pr.meta === p.id ? htmlBarra(p) : "";
  return `${cabecera()}
    <article class="carta-grande ${claseMarco(p.rareza, tiene)}">
      ${htmlFoto(p, { grande: tiene, tiene })}
      ${estrellasSvg(MARCA[p.rareza].estrellas)}
      <h2>${esc(p.nombre)}</h2>
      <p>${rol}${esc(MARCA[p.rareza].nombre)}${disfraz}</p>
      ${oir}
    </article>
    ${barra}
    ${foto}
    ${accion}
    <button type="button" class="boton" data-act="volver" ${focoAttr("volver", tiene)}>${esc(TEXTOS.volver)}</button>
    ${dialogo()}`;
}

function papasCerrada(ahora = Date.now()) {
  const hasta = Number(papasCerradoHasta) || 0;
  return hasta > 0 && (Number(ahora) || 0) < hasta;
}

function htmlPregunta() {
  if (papasCerrada()) {
    return `${cabecera()}
      <h2>${esc(TEXTOS.papas)}</h2>
      <p class="aviso">${esc(TEXTOS.papasDescanso)}</p>
      <button type="button" class="boton" data-act="volver" ${focoAttr("volver", true)}>${esc(TEXTOS.volver)}</button>
      ${dialogo()}`;
  }
  const aviso = papasAviso === "fallo" ? `<p class="aviso">${esc(TEXTOS.esaNo)}</p>`
    : papasAviso === "otra" ? `<p class="aviso">${esc(TEXTOS.papasOtra)}</p>`
    : "";
  const ops = (pregunta ? pregunta.opciones : []).map((n, i) =>
    `<button type="button" class="boton grande" data-act="respuesta" data-valor="${n}" ${focoAttr("op-" + i, false)}>${n}</button>`
  ).join("");
  return `${cabecera()}
    <h2>${esc(TEXTOS.papas)}</h2>
    ${aviso}
    <p class="aviso pregunta-papas">${esc(TEXTOS.cuantoEs)} ${pregunta ? pregunta.a : ""} × ${pregunta ? pregunta.b : ""}?</p>
    <div class="papas-opciones">${ops}</div>
    <button type="button" class="boton" data-act="volver" ${focoAttr("volver", true)}>${esc(TEXTOS.volver)}</button>
    ${dialogo()}`;
}

function htmlPapas() {
  if (!papasOk) return htmlPregunta();
  const items = [...pr.historial].reverse().slice(0, 12).map((m) => {
    const p = piezas.find((x) => x.id === m.id);
    const extra = m.nueva ? fraseNueva(p && p.genero) : (m.polvo === 1 ? "1 de polvo" : `${m.polvo} de polvo`);
    return `<li><span>${esc(m.dia)}</span> ${esc(p ? p.nombre : m.id)} · ${esc(MARCA[m.rareza].nombre)} · ${esc(extra)}</li>`;
  }).join("");
  return `${cabecera()}
    <h2>${esc(TEXTOS.papas)}</h2>
    <div class="papas-mandos">
      <button type="button" class="boton menos" data-act="limite" data-delta="-1" ${focoAttr("menos", true)} ${pr.limite <= LIMITE_MIN ? "disabled" : ""}>${esc(TEXTOS.menos)}</button>
      <button type="button" class="boton mas" data-act="limite" data-delta="1" ${focoAttr("mas", false)} ${pr.limite >= LIMITE_MAX ? "disabled" : ""}>${esc(TEXTOS.mas)}</button>
      <p class="cuenta-limite">${esc(TEXTOS.limite)} <b>${pr.limite}</b></p>
      <button type="button" class="boton cerrar-tienda" data-act="cerrar-tienda" ${focoAttr("cerrar-tienda", false)}>${esc(pr.cerrada ? TEXTOS.abrirTienda : TEXTOS.cerrarTienda)}</button>
    </div>
    <p class="nota">${esc(pr.cerrada ? TEXTOS.cerradaNota : TEXTOS.abiertaNota)}</p>
    <button type="button" class="boton" data-act="voz" ${focoAttr("voz", false)}>${esc(pr.voz ? TEXTOS.vozSi : TEXTOS.vozNo)}</button>
    <h3>${esc(TEXTOS.historial)}</h3>
    ${items ? `<ul class="historial">${items}</ul>` : `<p class="nota">${esc(TEXTOS.sinHistorial)}</p>`}
    <button type="button" class="boton" data-act="volver" ${focoAttr("volver", false)}>${esc(TEXTOS.volver)}</button>
    ${dialogo()}`;
}

function html() {
  if (!pr) return `<p class="aviso">${esc(TEXTOS.cargando)}</p>`;
  if (pantalla === "vitrina") return htmlVitrina();
  if (pantalla === "abriendo") return htmlAbriendo();
  if (pantalla === "carta" && carta) return htmlCarta();
  if (pantalla === "foto") return htmlFotoFamiliar();
  if (pantalla === "detalle" && detalleId) return htmlDetalle();
  if (pantalla === "papas") return htmlPapas();
  return htmlTienda();
}

function enfocar(id) {
  const lista = [...$main.querySelectorAll("[data-foco]")].filter((e) => !e.disabled && e.offsetParent !== null);
  const preferido = id && lista.find((e) => e.dataset.focoId === id);
  const inicial = lista.find((e) => e.getAttribute("data-foco") === "inicial");
  const el = preferido || inicial || lista[0] || null;
  if (el) el.focus({ preventScroll: true });
}

function pintar(foco) {
  $main.dataset.pantalla = guia ? "guia-" + guia.paso : pantalla;
  $main.dataset.etapa = pantalla === "abriendo" || pantalla === "carta" ? etapa : "";
  $main.dataset.fase = pantalla === "carta" && carta ? carta.fase || "" : "";
  $main.innerHTML = html();
  if (esTv()) document.documentElement.classList.add("teclado");
  enfocar(salir ? "seguir" : foco);
  animarBarras();
  programarFinBloqueo();
  if (pantalla === "papas" && !papasOk) programarFinPapas();
}

function animarBarras() {
  const barras = [...$main.querySelectorAll(".barra-meta")];
  const reducir = pocaAnimacion();
  for (const b of barras) {
    const s = b.querySelector("span");
    if (!s) continue;
    const meta = b.style.getPropertyValue("--lleno") || "0%";
    if (reducir) { s.style.width = meta; continue; }
    s.style.width = "0%";
    requestAnimationFrame(() => { if (s.isConnected) s.style.width = meta; });
  }
}

function cancelarVoz() {
  try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch { /* sin voz */ }
}

function limpiarApertura() {
  clearTimeout(relojEtapa);
  clearTimeout(relojRevelar);
  aperturaToken += 1;
  etapa = "cerrado";
  autoHasta = 0;
  revelarHasta = 0;
}

function programarAvance(token, evento) {
  if (!guia || !guiaAvanzaConToque(guia.paso)) return;
  clearTimeout(relojMuestra);
  const base = Number(aparecio) || 0;
  let cuando = base + GUIA_MAX_MS;
  if (evento === "voz") cuando = cuandoAvanzaMuestra(aparecio, vozTerminoEn);
  else if (evento === "silencio") cuando = base + GUIA_MIN_MS;
  relojMuestra = setTimeout(() => {
    if (token !== pasoToken || salir || !guia) return;
    avanzarMuestra(evento);
  }, Math.max(0, cuando - Date.now()));
}

function eventoDeVoz() {
  if (vozTerminoEn != null) return "voz";
  if (vozFallo || !vozSono) return "silencio";
  return "tiempo";
}

function programarPaso() {
  const token = ++pasoToken;
  clearTimeout(relojMuestra);
  const paso = guia.paso;
  aparecio = Date.now();
  vozTerminoEn = null;
  vozFallo = false;
  const linea = pr.voz ? vozGuia(paso, modo(), reglas) : "";
  const r = linea ? decir(linea, {
    onend: () => {
      if (token !== pasoToken || salir || vozFallo) return;
      vozTerminoEn = Date.now();
      bloqueoPasoHasta = finBloqueoPaso({ aparecio, sono: true, vozTerminoEn });
      programarAvance(token, "voz");
      programarFinBloqueo();
    },
    onerror: () => {
      if (token !== pasoToken || salir) return;
      vozFallo = true;
      vozTerminoEn = null;
      bloqueoPasoHasta = finBloqueoPaso({ aparecio, sono: true, fallo: true });
      programarAvance(token, "silencio");
      programarFinBloqueo();
    },
  }) : { sono: false };
  vozSono = !!r.sono && !vozFallo;
  if (!vozFallo) bloqueoPasoHasta = finBloqueoPaso({ aparecio, sono: vozSono, vozTerminoEn: null });
  const evento = !vozSono ? "silencio" : vozTerminoEn != null ? "voz" : "tiempo";
  programarAvance(token, evento);
}

function empezarGuia() {
  guia = { paso: "tienda" };
  pantalla = "tienda";
  carta = null;
  detalleId = null;
  limpiarApertura();
  programarPaso();
  pintar(focoDeGuia("tienda"));
}

function terminarGuia() {
  pasoToken += 1;
  esperandoNada();
  clearTimeout(relojMuestra);
  cancelarVoz();
  limpiarApertura();
  guia = null;
  pantalla = "tienda";
  carta = null;
  pr = marcarGuia(pr);
  guardar();
  bloqueoPasoHasta = Date.now() + TRAS_GUIA_MS;
  pintar("abrir");
}

function esperandoNada() {
  cartaHasta = 0;
}

function saltarGuia() {
  if (bloqueado("saltar")) return;
  terminarGuia();
}

function avanzarMuestra(evento) {
  if (!guia || salir) return;
  const ahora = Date.now();
  if (!muestraPuedeAvanzar({ aparecio, ahora, evento, vozTerminoEn, hasta: hastaAhora(), sono: vozSono, fallo: vozFallo })) return;
  const sig = aplicarGuia(guia.paso, evento);
  if (sig.fin) { terminarGuia(); return; }
  guia = { paso: sig.paso };
  if (sig.paso === "vitrina") pantalla = "vitrina";
  else if (sig.paso === "carta") pantalla = "carta";
  else pantalla = "tienda";
  programarPaso();
  pintar(focoDeGuia(sig.paso));
}

function programarEtapa(espera) {
  clearTimeout(relojEtapa);
  if (!espera) return;
  autoHasta = Date.now() + espera;
  const token = aperturaToken;
  relojEtapa = setTimeout(() => {
    if (token !== aperturaToken || salir) return;
    avanzarEtapa();
  }, espera);
}

function programarRevelar(espera) {
  clearTimeout(relojRevelar);
  revelarHasta = Date.now() + espera;
  const token = aperturaToken;
  relojRevelar = setTimeout(() => {
    if (token !== aperturaToken || salir) return;
    entrarRareza();
  }, espera);
}

function predecir(info) {
  try {
    const img = new Image();
    img.src = rutaPieza(info.pieza.archivo, 512);
  } catch { /* la carta se pinta igual */ }
}

function empezarApertura(info) {
  carta = { ...info, fase: "plain", quiz: null, volar: false };
  etapa = "bruma1";
  pantalla = "abriendo";
  aperturaToken += 1;
  bloqueoPasoHasta = 0;
  predecir(info);
  sonar("bruma1");
  programarEtapa(esperaDeEtapa("bruma1", { reducida: pocaAnimacion() }));
  pintar("etapa");
}

function entrarFigura() {
  if (!carta) return;
  etapa = "figura";
  pantalla = "carta";
  const quiz = QUIEN_VISIBLE && !carta.ejemplo ? opcionesQuien(carta.pieza, pr.tenidas, piezas, rngUi) : null;
  carta = { ...carta, fase: "plain", quiz, volar: false };
  cartaHasta = Date.now() + CARTA_MS;
  aperturaToken += 1;
  clearTimeout(relojEtapa);
  sonar("figura");
  if (guia && guia.paso === "abrir") {
    const sig = aplicarGuia("abrir", "abrir");
    if (sig.fin) { terminarGuia(); return; }
    guia = { paso: sig.paso };
    programarPaso();
  }
  const espera = esperaDeEtapa("figura", { reducida: pocaAnimacion() });
  if (espera === 0) { entrarRareza(); return; }
  programarRevelar(espera);
  const foco = guia ? focoDeGuia(guia.paso) : (carta.quiz ? "quien-0" : "apurar");
  pintar(foco);
}

function entrarRareza() {
  if (!carta || carta.fase === "revelada") return;
  clearTimeout(relojRevelar);
  etapa = "rareza";
  const conMeta = !!(carta.duplicado && metaPieza());
  carta = { ...carta, fase: "revelada", volar: conMeta };
  sonar("rareza");
  const foco = guia ? focoDeGuia(guia.paso) : "guardar-carta";
  pintar(foco);
  if (!guia && pr.voz && carta.pieza && carta.pieza.ingles) decir(carta.pieza.ingles, { lang: "en-US" });
}

function avanzarEtapa() {
  if (salir || !carta) return;
  if (pantalla === "carta" && carta.fase === "plain") { entrarRareza(); return; }
  if (pantalla !== "abriendo") return;
  const sig = etapaSiguiente(etapa);
  if (sig === "figura") { entrarFigura(); return; }
  etapa = sig;
  aperturaToken += 1;
  sonar(sig);
  programarEtapa(esperaDeEtapa(sig, { reducida: pocaAnimacion() }));
  pintar("etapa");
}

function abrirDemo() {
  const pieza = piezas.find((p) => p.rareza === "comun") || piezas[0];
  empezarApertura({ pieza, duplicado: false, polvoGanado: 0, ejemplo: true, familiaNueva: null });
}

async function abrirDeVerdad() {
  if (cobrando || guia) return;
  const fecha = fechaLocal();
  if (!puedeAbrir(pr, { creditos: saldo, fecha, config: reglas, piezas }).ok) { pintar("abrir"); return; }
  cobrando = true;
  pintar("abrir");
  const r = await abrirConCreditos(pr, {
    creditos: saldo,
    fecha,
    piezas,
    config: reglas,
    rng: rngDeCaja(),
    rarezaForzada: rarezaDeCaptura(),
    gastar: (n) => Noli.gastar(n, "cajas-sorpresa"),
    alCobrar(resultado) {
      const antes = pr.tenidas.slice();
      const familiaNueva = resultado.duplicado ? null : familiaQueSeCompleto(antes, resultado.estado.tenidas, piezas);
      const siguiente = {
        ...resultado.estado,
        pendiente: {
          id: resultado.pieza.id,
          duplicado: !!resultado.duplicado,
          polvoGanado: resultado.polvoGanado || 0,
          familiaNueva: familiaNueva || null,
        },
      };
      pr = siguiente;
      guardar();
      return pr;
    },
    alFallar(anterior) {
      pr = anterior;
      guardar();
    },
  });
  cobrando = false;
  if (!r.ok) {
    if (typeof r.creditos === "number") saldo = r.creditos;
    pintar("abrir");
    return;
  }
  saldo = r.creditos;
  pr = r.estado;
  const pen = pr.pendiente || {};
  const pieza = piezas.find((p) => p.id === pen.id) || r.pieza;
  empezarApertura({
    pieza,
    duplicado: !!pen.duplicado,
    polvoGanado: pen.polvoGanado || 0,
    ejemplo: false,
    familiaNueva: pen.familiaNueva || null,
  });
}

function dialogoVigente(ahora = Date.now()) {
  const t = Number(ahora) || 0;
  const d = Number(bloqueoDialogoHasta) || 0;
  return d > 0 && t < d;
}

function alargarBloqueo() {
  const ahora = Number(Date.now()) || 0;
  const pulso = pulsoTrasCarta({ ahora, hasta: bloqueoPasoHasta, carta: false });
  if (!pulso.abre) {
    bloqueoPasoHasta = pulso.hasta;
    programarFinBloqueo();
  }
}

function pulsarAbrir() {
  if (cobrando || abrirApagado()) return;
  if (pantalla === "abriendo" || pantalla === "carta") return;
  if (guia && guia.paso === "abrir") { abrirDemo(); return; }
  if (guia) return;
  const ahora = Number(Date.now()) || 0;
  const pulso = pulsoAbrir({ ahora, hastaPaso: bloqueoPasoHasta, hastaDialogo: bloqueoDialogoHasta, carta: false });
  if (!pulso.abre) {
    bloqueoPasoHasta = pulso.hastaPaso;
    programarFinBloqueo();
    return;
  }
  abrirDeVerdad();
}

function hablarIngles(pieza) {
  if (!pieza || !pieza.ingles) return;
  decir(pieza.ingles, { lang: "en-US" });
}

function abrirDetalle(id) {
  if (guia) return;
  detalleId = id;
  recien = false;
  fotoPendiente = null;
  pantalla = "detalle";
  const p = piezas.find((x) => x.id === id);
  const tiene = pr.tenidas.includes(id);
  const entrada = entradaDetalle({ ahora: Date.now(), hasta: bloqueoPasoHasta, tv: esTv(), tiene });
  bloqueoPasoHasta = entrada.hasta;
  if (p && tiene) {
    try { const img = new Image(); img.src = rutaPieza(p.archivo, 512); } catch { /* sigue la miniatura */ }
    if (pr.voz) hablarIngles(p);
  }
  pintar(entrada.foco);
}

function comprarPieza() {
  if (bloqueado("conseguir")) return;
  const antes = pr.tenidas.slice();
  const r = comprar(pr, detalleId, piezas, reglas);
  if (!r.ok) return;
  pr = r.estado;
  recien = true;
  fotoPendiente = familiaQueSeCompleto(antes, pr.tenidas, piezas);
  bloqueoPasoHasta = Date.now() + TRAS_COMPRA_MS;
  guardar();
  const p = piezas.find((x) => x.id === detalleId);
  if (p) { try { const img = new Image(); img.src = rutaPieza(p.archivo, 512); } catch { /* ya es tuya */ } }
  pintar(fotoPendiente ? "ver-foto" : "volver");
  if (pr.voz) hablarIngles(p);
}

function cartaQuieta() {
  return pantalla === "carta" && carta && Date.now() < cartaHasta;
}

function terminarCarta() {
  if (cartaQuieta()) return;
  if (pr.pendiente) pr = { ...pr, pendiente: null };
  carta = null;
  limpiarApertura();
  cartaHasta = 0;
  pantalla = "tienda";
  bloqueoPasoHasta = Date.now() + TRAS_ABRIR_MS;
  guardar();
  pintar("abrir");
}

function elegirMeta(id) {
  const antes = pr.meta;
  pr = ponerMeta(pr, id);
  if (pr.meta === antes) return;
  if (carta && carta.duplicado) carta = { ...carta, volar: true };
  guardar();
  pintar(pantalla === "carta" ? "guardar-carta" : "meta-" + id);
}

function actuar(act, data) {
  if (act === "saltar") return saltarGuia();
  if (act === "frase-guia") {
    if (guia && guiaAvanzaConToque(guia.paso)) avanzarMuestra("toque");
    return;
  }
  if (act === "etapa" || act === "apurar") return avanzarEtapa();
  if (act === "quien") return avanzarEtapa();
  if (act === "abrir") return pulsarAbrir();
  if (act === "vitrina") { pantalla = "vitrina"; pintar(esTv() ? "hueco-" + (ordenarFamilia(piezas, familiaVista)[0] || {}).id : "volver"); return; }
  if (act === "como") return empezarGuia();
  if (act === "papas") {
    pantalla = "papas";
    if (!papasOk) asegurarPregunta();
    pintar(papasOk ? "menos" : "volver");
    return;
  }
  if (act === "respuesta") {
    if (bloqueado("respuesta")) return;
    const ahora = Number(Date.now()) || 0;
    const r = responderPapas({
      ahora,
      valor: data.valor,
      pregunta,
      enOpcion: true,
      seguidas: papasSeguidas,
      fallos: papasFallos,
      aceptaDesde: papasAceptaDesde,
      cerradoHasta: papasCerradoHasta,
      escalada: papasNivel,
    });
    papasSeguidas = r.seguidas;
    papasFallos = r.fallos;
    papasAceptaDesde = r.aceptaDesde;
    papasCerradoHasta = r.cerradoHasta;
    papasNivel = r.escalada;
    papasAviso = r.aviso;
    guardarPuerta();
    if (r.abre) {
      papasOk = true;
      papasAviso = "";
      pintar("menos");
      return;
    }
    if (r.nueva) pregunta = preguntaPapas(rngUi);
    if (r.aviso === "descanso") pregunta = null;
    pintar("volver");
    return;
  }
  if (act === "volver") {
    const salida = salirPuerta();
    papasSeguidas = salida.seguidas;
    papasAceptaDesde = salida.aceptaDesde;
    if (papasAviso === "fallo" || papasAviso === "otra") papasAviso = salida.aviso;
    const entrada = entradaTienda({ ahora: Date.now(), hasta: bloqueoPasoHasta });
    pantalla = "tienda";
    detalleId = null;
    recien = false;
    carta = null;
    fotoPendiente = null;
    bloqueoPasoHasta = entrada.hasta;
    pintar(entrada.foco);
    return;
  }
  if (act === "familia") {
    const i = FAMILIAS.findIndex((f) => f.id === familiaVista);
    const d = Number(data.delta) || 1;
    familiaVista = FAMILIAS[(i + d + FAMILIAS.length) % FAMILIAS.length].id;
    pintar(d > 0 ? "familia-mas" : "familia-menos");
    return;
  }
  if (act === "oir") {
    const p = piezas.find((x) => x.id === data.id) || (carta && carta.pieza);
    hablarIngles(p);
    return;
  }
  if (act === "ver-foto") {
    if (cartaQuieta()) return;
    fotoId = data.familia || (carta && carta.familiaNueva) || familiaVista;
    fotoDesde = pantalla;
    pantalla = "foto";
    pintar("cerrar-foto");
    return;
  }
  if (act === "cerrar-foto") {
    pantalla = fotoDesde === "carta" ? "carta" : fotoDesde === "detalle" ? "detalle" : "vitrina";
    pintar(pantalla === "carta" ? "guardar-carta" : "volver");
    return;
  }
  if (act === "hueco") return abrirDetalle(data.id);
  if (act === "conseguir") return comprarPieza();
  if (act === "meta") return elegirMeta(data.id);
  if (act === "guardar-carta") return terminarCarta();
  if (act === "limite") {
    pr = cambiarLimite(pr, Number(data.delta));
    guardar();
    pintar(data.delta === "1" ? "mas" : "menos");
    return;
  }
  if (act === "cerrar-tienda") {
    pr = ponerCerrada(pr, !pr.cerrada);
    guardar();
    pintar("cerrar-tienda");
    return;
  }
  if (act === "voz") {
    pr = ponerVoz(pr, !pr.voz);
    guardar();
    if (!pr.voz) cancelarVoz();
    pintar("voz");
  }
}

function abrirSalir() {
  if (salir) return;
  salir = true;
  pausaEn = Number(Date.now()) || 0;
  clearTimeout(relojMuestra);
  clearTimeout(relojEtapa);
  clearTimeout(relojRevelar);
  pasoToken += 1;
  cancelarVoz();
  pintar("seguir");
}

function reanudarRelojes(pausa, ahora) {
  if (pantalla === "abriendo" && autoHasta) {
    autoHasta = (Number(autoHasta) || 0) + pausa;
    const falta = Math.max(0, autoHasta - ahora);
    const token = aperturaToken;
    relojEtapa = setTimeout(() => {
      if (token !== aperturaToken || salir) return;
      avanzarEtapa();
    }, falta);
  }
  if (pantalla === "carta" && carta && carta.fase === "plain" && revelarHasta) {
    revelarHasta = (Number(revelarHasta) || 0) + pausa;
    cartaHasta = (Number(cartaHasta) || 0) + pausa;
    const falta = Math.max(0, revelarHasta - ahora);
    const token = aperturaToken;
    relojRevelar = setTimeout(() => {
      if (token !== aperturaToken || salir) return;
      entrarRareza();
    }, falta);
  } else if (cartaHasta) {
    cartaHasta = (Number(cartaHasta) || 0) + pausa;
  }
}

function cerrarDialogo() {
  const ahora = Number(Date.now()) || 0;
  const pausa = pausaEn ? Math.max(0, ahora - (Number(pausaEn) || 0)) : 0;
  pausaEn = 0;
  salir = false;
  if (guia) {
    aparecio = (Number(aparecio) || 0) + pausa;
    if (vozTerminoEn != null) vozTerminoEn = (Number(vozTerminoEn) || 0) + pausa;
    const previo = (Number(bloqueoPasoHasta) || 0) + pausa;
    const b = bloqueoAlSeguir({ ahora, hastaPaso: previo });
    bloqueoPasoHasta = b.hastaPaso;
    bloqueoDialogoHasta = b.hastaDialogo;
    const token = ++pasoToken;
    programarAvance(token, eventoDeVoz());
  } else {
    bloqueoDialogoHasta = ahora + TRAS_DIALOGO_MS;
  }
  reanudarRelojes(pausa, ahora);
  pintar(guia ? focoDeGuia(guia.paso) : undefined);
}

function guardarPuerta() {
  if (!pr) return;
  const hasta = Number(papasCerradoHasta) || 0;
  const fallos = Number(papasFallos) || 0;
  const nivel = Number(papasNivel) || 0;
  if ((Number(pr.puertaHasta) || 0) === hasta && (Number(pr.puertaFallos) || 0) === fallos && (Number(pr.puertaNivel) || 0) === nivel) return;
  pr = { ...pr, puertaHasta: hasta, puertaFallos: fallos, puertaNivel: nivel };
  guardar();
}

function leerPuerta() {
  papasCerradoHasta = Number(pr && pr.puertaHasta) || 0;
  papasFallos = Number(pr && pr.puertaFallos) || 0;
  papasNivel = Number(pr && pr.puertaNivel) || 0;
}

function asegurarPregunta() {
  const ahora = Number(Date.now()) || 0;
  if (papasOk) return;
  const entrada = entrarPuerta({ ahora, aceptaDesde: papasAceptaDesde, seguidas: papasSeguidas, abierta: false });
  papasSeguidas = entrada.seguidas;
  papasAceptaDesde = entrada.aceptaDesde;
  papasAviso = papasCerrada(ahora) ? "descanso" : entrada.aviso;
  if (papasCerrada(ahora)) return;
  if ((Number(papasCerradoHasta) || 0) > 0 && ahora >= (Number(papasCerradoHasta) || 0)) {
    papasCerradoHasta = 0;
    papasFallos = 0;
    papasAviso = "";
    pregunta = null;
    guardarPuerta();
  }
  if (!pregunta) pregunta = preguntaPapas(rngUi);
}

function programarFinPapas() {
  clearTimeout(relojPapas);
  const falta = (Number(papasCerradoHasta) || 0) - (Number(Date.now()) || 0);
  if (falta <= 0) return;
  relojPapas = setTimeout(() => {
    if (salir || pantalla !== "papas" || papasOk) return;
    papasCerradoHasta = 0;
    papasFallos = 0;
    papasSeguidas = 0;
    papasAviso = "";
    pregunta = preguntaPapas(rngUi);
    papasAceptaDesde = (Number(Date.now()) || 0) + PAPAS_QUIETO_MS;
    guardarPuerta();
    pintar("volver");
  }, falta + 20);
}

$main.addEventListener("click", (ev) => {
  const t = ev.target.closest("[data-act]");
  const act = t && $main.contains(t) ? t.dataset.act : "";
  if (salir) {
    const enDialogo = !!ev.target.closest(".dialogo");
    const enVelo = !!ev.target.closest(".velo");
    if (enVelo && toqueEnVelo({ tv: esTv(), enDialogo }) === "seguir") {
      cerrarDialogo();
      return;
    }
    const boton = ev.target.closest(".dialogo [data-act]");
    if (boton) {
      const que = toqueConDialogo(boton.dataset.act);
      if (que === "seguir") cerrarDialogo();
      else if (que === "salir") Noli.salir();
    }
    return;
  }
  if (pantalla === "papas" && !papasOk && act !== "respuesta") {
    const p = pulsoPuerta({ ahora: Date.now(), aceptaDesde: papasAceptaDesde, cuenta: false });
    papasAceptaDesde = p.aceptaDesde;
  }
  if (bloqueado(act)) {
    if (act === "abrir" && !dialogoVigente()) pulsarAbrir();
    else if (act === "conseguir") alargarBloqueo();
    return;
  }
  if (!t || t.disabled) return;
  if ((act === "guardar-carta" || act === "ver-foto") && cartaQuieta()) return;
  actuar(act, t.dataset);
});

Noli.alEntrar((accion) => {
  document.documentElement.classList.add("teclado");
  if (accion === "atras") {
    if (atrasEnPantalla(pantalla, salir) === "cerrar") cerrarDialogo();
    else abrirSalir();
    return true;
  }
  if (salir) {
    const que = teclaConDialogo(accion, idFoco());
    if (que === "cerrar") { cerrarDialogo(); return true; }
    if (que === "foco") { moverFoco(accion, $main.querySelector(".dialogo") || $main); return true; }
    const el = $main.querySelector(`.dialogo [data-act="${que}"]`);
    if (el && !el.disabled) el.click();
    return true;
  }
  if (!salir && pantalla === "papas" && !papasOk && accion !== "atras") {
    const ahora = Number(Date.now()) || 0;
    const enOpcion = idFoco().startsWith("op-");
    const cuenta = accion === "ok" && enOpcion && !papasCerrada(ahora) && ahora >= (Number(papasAceptaDesde) || 0);
    if (!cuenta && (accion === "ok" || accion === "arriba" || accion === "abajo" || accion === "izquierda" || accion === "derecha")) {
      const p = pulsoPuerta({ ahora, aceptaDesde: papasAceptaDesde, cuenta: false });
      papasAceptaDesde = p.aceptaDesde;
    }
    if (accion === "ok" && enOpcion && !cuenta) return true;
  }
  if (accion === "ok" && bloqueado(idFoco() === "saltar" ? "saltar" : "ok")) {
    if (!guia && pantalla === "tienda" && idFoco() === "abrir" && !dialogoVigente()) pulsarAbrir();
    else if (!guia && idFoco() === "conseguir") alargarBloqueo();
    return true;
  }
  if (accion === "ok" && pantalla === "abriendo") {
    const e = document.activeElement;
    if (e && $main.contains(e) && !e.disabled) e.click();
    else avanzarEtapa();
    return true;
  }
  if (accion === "ok" && pantalla === "carta" && carta && carta.fase === "plain") {
    const e = document.activeElement;
    if (e && $main.contains(e) && (e.dataset.act === "quien" || e.dataset.act === "oir" || e.dataset.act === "apurar")) e.click();
    else avanzarEtapa();
    return true;
  }
  if (accion === "ok" && cartaQuieta()) {
    const e = document.activeElement;
    if (e && $main.contains(e) && e.dataset.act === "oir") e.click();
    return true;
  }
  if (guia && accion === "ok") {
    const enfocado = document.activeElement;
    if (enfocado && $main.contains(enfocado) && enfocado.dataset.act === "oir") {
      enfocado.click();
      return true;
    }
    if (guiaAvanzaConToque(guia.paso) && muestraPuedeAvanzar({ aparecio, ahora: Date.now(), evento: "ok", vozTerminoEn, hasta: hastaAhora(), sono: vozSono, fallo: vozFallo })) {
      avanzarMuestra("ok");
      return true;
    }
    if (guia.paso === "abrir") {
      const e = document.activeElement;
      if (e && $main.contains(e) && !e.disabled && e.dataset.act === "abrir") e.click();
    }
    return true;
  }
  if (moverFoco(accion, $main)) return true;
  if (accion === "ok") {
    const e = document.activeElement;
    if (e && $main.contains(e) && !e.disabled) e.click();
    return true;
  }
  return true;
});

document.addEventListener("pointerdown", () => {
  if (!esTv()) document.documentElement.classList.remove("teclado");
}, true);

function leerJson(nombre) {
  return fetch(new URL("../datos/" + nombre, import.meta.url)).then((r) => {
    if (!r.ok) throw new Error(nombre);
    return r.json();
  });
}

function reanudarPendiente() {
  const pen = pr.pendiente;
  const pieza = piezas.find((p) => p.id === pen.id);
  if (!pieza) {
    pr = { ...pr, pendiente: null };
    guardar();
    pintar("abrir");
    return;
  }
  empezarApertura({
    pieza,
    duplicado: !!pen.duplicado,
    polvoGanado: pen.polvoGanado || 0,
    ejemplo: false,
    familiaNueva: pen.familiaNueva || null,
  });
}

Promise.all([Noli.datos, Noli.creditos, leerJson("piezas.json"), leerJson("reglas.json")]).then(([datos, creditos, lista, reglasJson]) => {
  reglas = normalizarReglas(reglasJson);
  usarReglas(reglas);
  piezas = Array.isArray(lista) ? lista : [];
  pr = alinearDia(cargar(datos, reglas), fechaLocal());
  if (datos && datos.dia && pr.dia !== datos.dia) guardar();
  saldo = typeof creditos === "number" ? creditos : null;
  leerPuerta();
  if (pr.pendiente) reanudarPendiente();
  else if (!pr.guiaHecha) empezarGuia();
  else pintar("abrir");
}).catch(() => {
  $main.innerHTML = `<p class="aviso">${esc(TEXTOS.noAbrio)}</p>`;
});
