// Tienda de cajas sorpresa. La lógica vive en coleccion.js; aquí solo se pinta y se cobra.
// Sin await al nivel del módulo. Los créditos se piden con Noli.gastar, igual que los otros premios.
import { Noli, moverFoco } from "../../../kit/noli.js";
import { CONFIG, LIMITE_MIN, LIMITE_MAX } from "./reglas.js";
import { rngConSemilla } from "./rng.js";
import {
  cargar, puedeAbrir, abrirConCreditos, comprar, cambiarLimite, ponerCerrada, ponerVoz,
  marcarGuia, cuentaRara, cuentaUltra, fechaLocal,
} from "./coleccion.js";
import {
  guiaAvanzaConToque, focoDeGuia, cuandoAvanzaMuestra, finBloqueoPaso, bloqueoAlSeguir, muestraPuedeAvanzar,
  aplicarGuia, GUIA_MAX_MS, TRAS_GUIA_MS,
} from "./guia.js";
import { unirBloqueos, tapBloqueado, toqueConDialogo, toqueEnVelo, teclaConDialogo, atrasEnPantalla, TRAS_DIALOGO_MS } from "./salida.js";
import { decir, calentarVoces } from "./voz.js";
import { FAMILIAS, ordenarFamilia, familiaCompleta, familiaQueSeCompleto } from "./familias.js";
import { TEXTOS, textoGuia, vozGuia, fraseGarantia, fraseRepetida, frasePrecio, fraseNueva, fraseTuya, etiquetaRol, fraseFamilia } from "./textos.js";
import {
  MARCA, esc, estrellasSvg, claseMarco, frascoSvg, iconoPolvo, iconoCredito, iconoVoz,
  fichasProbabilidad, htmlFoto, rutaPieza, rutaFamilia,
} from "./dibujo.js";

const $main = document.getElementById("juego");
try { if (/[?&]modo=tv\b/.test(location.search)) document.documentElement.dataset.modo = "tv"; } catch { /* sin location */ }
try { calentarVoces(); } catch { /* sin voz en este aparato */ }

let piezas = [];
let pr = cargar(null);
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
let aperturaHasta = 0;
let pausaEn = 0;
const APERTURA_MS = 1600;
let recien = false;
let cobrando = false;
let esperandoCarta = false;

let aparecio = 0;
let vozTerminoEn = null;
let bloqueoPasoHasta = 0;
let bloqueoDialogoHasta = 0;
let pasoToken = 0;
let cartaToken = 0;
let relojMuestra = 0;
let relojCarta = 0;
let relojBloqueo = 0;

const modo = () => (document.documentElement.dataset.modo === "tv" || Noli.modo === "tv" ? "tv" : "tactil");
const esTv = () => modo() === "tv";
const guardar = () => Noli.guardar(pr);

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

function abrirHabilitado() {
  if (cobrando) return false;
  if (bloqueado("abrir")) return false;
  if (guia) return guia.paso === "abrir";
  return puedeAbrir(pr, { creditos: saldo, fecha: fechaLocal(), piezas }).ok;
}

function focoAttr(id, inicial) {
  if (salir) return "";
  if (inicial) return `data-foco="inicial" data-foco-id="${esc(id)}"`;
  return `data-foco data-foco-id="${esc(id)}"`;
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

function bannerGuia() {
  if (!guia || salir) return "";
  const inicial = focoDeGuia(guia.paso) === "frase-guia";
  return `<button type="button" class="frase-guia" data-act="frase-guia" ${focoAttr("frase-guia", inicial)}>${esc(textoGuia(guia.paso, modo()))}</button>`;
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
  const bloqueo = guia ? null : puedeAbrir(pr, { creditos: saldo, fecha: fechaLocal(), piezas });
  const on = abrirHabilitado();
  const inicial = (!guia || guia.paso === "abrir") && on;
  const aviso = !bloqueo ? ""
    : bloqueo.razon === "cerrada" || bloqueo.razon === "limite" ? `<p class="aviso descanso">${esc(TEXTOS.descansando)}</p>`
    : bloqueo.razon === "creditos" ? `<p class="aviso amable">${esc(TEXTOS.sinCreditos)}</p>`
    : bloqueo.razon === "completa" ? `<p class="aviso amable">${esc(TEXTOS.completa)}</p>`
    : "";
  return `${cabecera()}${bannerGuia()}
    <div class="layout-tienda">
      <div class="col-caja">
        <div class="escena" aria-hidden="true">${frascoSvg()}</div>
        <button type="button" class="boton grande primario" data-act="abrir" ${focoAttr("abrir", inicial)} ${on ? "" : "disabled"}>${esc(TEXTOS.abrir)}<small>${iconoCredito()} ${esc(TEXTOS.costo)}</small></button>
        ${aviso}
      </div>
      <div class="col-info">
        <p class="prob-intro">${esc(TEXTOS.probIntro)}</p>
        <ul class="prob">
          <li>${fichasProbabilidad("comun")}<span>${esc(TEXTOS.probComun)}</span></li>
          <li>${fichasProbabilidad("rara")}<span>${esc(TEXTOS.probRara)}</span></li>
          <li>${fichasProbabilidad("ultra")}<span>${esc(TEXTOS.probUltra)}</span></li>
        </ul>
        <p class="garantia">${esc(fraseGarantia(cuentaRara(pr), false))}</p>
        <p class="garantia">${esc(fraseGarantia(cuentaUltra(pr), true))}</p>
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
  return `${cabecera()}${bannerGuia()}
    <button type="button" class="boton" data-act="volver" ${focoAttr("volver", !guia && !esTv())} ${guia ? "disabled" : ""}>${esc(TEXTOS.volver)}</button>
    ${bloques}
    ${nav}
    ${dialogo()}`;
}

function htmlAbriendo() {
  return `${cabecera()}${bannerGuia()}
    <div class="escena abriendo" aria-hidden="true">${frascoSvg()}</div>
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

function htmlCarta() {
  const p = carta.pieza;
  const linea = carta.ejemplo ? TEXTOS.ejemplo : carta.duplicado ? fraseRepetida(carta.polvoGanado, p.genero) : fraseNueva(p.genero);
  const disfraz = p.disfraz ? ` · ${esc(p.disfraz)}` : "";
  const rol = etiquetaRol(p.rol);
  const verFoto = carta.familiaNueva && !guia;
  const seguir = guia ? "" : `<button type="button" class="boton grande primario" data-act="guardar-carta" ${focoAttr("guardar-carta", !verFoto)}>${esc(TEXTOS.aVitrina)}</button>`;
  const foto = verFoto ? `<button type="button" class="boton grande" data-act="ver-foto" data-familia="${esc(carta.familiaNueva)}" ${focoAttr("ver-foto", true)}>${esc(TEXTOS.verFoto)}</button>` : "";
  return `${cabecera()}${bannerGuia()}
    <article class="carta-grande festejo ${claseMarco(p.rareza, true)}">
      ${htmlFoto(p, { grande: true, tiene: true })}
      ${estrellasSvg(MARCA[p.rareza].estrellas)}
      <h2>${esc(p.nombre)}</h2>
      <p>${esc(rol)} · ${esc(MARCA[p.rareza].nombre)}${disfraz}</p>
      ${htmlOir(p)}
      <p class="aviso">${esc(linea)}</p>
    </article>
    ${foto}
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
  const precio = CONFIG.polvoPrecio[p.rareza];
  const puede = !tiene && pr.polvo >= precio;
  const disfraz = tiene && p.disfraz ? ` · ${esc(p.disfraz)}` : "";
  const rol = tiene ? `${esc(etiquetaRol(p.rol))} · ` : "";
  const oir = tiene ? htmlOir(p) : "";
  const foto = tiene && fotoPendiente && fotoPendiente === p.familia
    ? `<button type="button" class="boton grande" data-act="ver-foto" data-familia="${esc(p.familia)}" ${focoAttr("ver-foto", false)}>${esc(TEXTOS.verFoto)}</button>`
    : "";
  const accion = tiene
    ? `<p class="aviso amable">${esc(recien ? fraseTuya(p.genero) : MARCA[p.rareza].nombre)}</p>`
    : `<p>${esc(frasePrecio(p.nombre, precio))}</p>
       <button type="button" class="boton grande primario" data-act="conseguir" ${focoAttr("conseguir", true)} ${puede ? "" : "disabled"}>${esc(puede ? TEXTOS.conseguir : TEXTOS.noAlcanza)}</button>`;
  return `${cabecera()}
    <article class="carta-grande ${claseMarco(p.rareza, tiene)}">
      ${htmlFoto(p, { grande: tiene, tiene })}
      ${estrellasSvg(MARCA[p.rareza].estrellas)}
      <h2>${esc(p.nombre)}</h2>
      <p>${rol}${esc(MARCA[p.rareza].nombre)}${disfraz}</p>
      ${oir}
    </article>
    ${foto}
    ${accion}
    <button type="button" class="boton" data-act="volver" ${focoAttr("volver", tiene)}>${esc(TEXTOS.volver)}</button>
    ${dialogo()}`;
}

function htmlPapas() {
  const items = [...pr.historial].reverse().slice(0, 12).map((m) => {
    const p = piezas.find((x) => x.id === m.id);
    const extra = m.nueva ? fraseNueva(p && p.genero) : (m.polvo === 1 ? "1 de polvo" : `${m.polvo} de polvo`);
    return `<li><span>${esc(m.dia)}</span> ${esc(p ? p.nombre : m.id)} · ${esc(MARCA[m.rareza].nombre)} · ${esc(extra)}</li>`;
  }).join("");
  return `${cabecera()}
    <h2>${esc(TEXTOS.papas)}</h2>
    <div class="fila limite">
      <button type="button" class="boton" data-act="limite" data-delta="-1" ${focoAttr("menos", true)} ${pr.limite <= LIMITE_MIN ? "disabled" : ""}>${esc(TEXTOS.menos)}</button>
      <p>${esc(TEXTOS.limite)}<br><b>${pr.limite}</b></p>
      <button type="button" class="boton" data-act="limite" data-delta="1" ${focoAttr("mas", false)} ${pr.limite >= LIMITE_MAX ? "disabled" : ""}>${esc(TEXTOS.mas)}</button>
    </div>
    <button type="button" class="boton" data-act="cerrar-tienda" ${focoAttr("cerrar-tienda", false)}>${esc(pr.cerrada ? TEXTOS.abrirTienda : TEXTOS.cerrarTienda)}</button>
    <p class="nota">${esc(pr.cerrada ? TEXTOS.cerradaNota : TEXTOS.abiertaNota)}</p>
    <button type="button" class="boton" data-act="voz" ${focoAttr("voz", false)}>${esc(pr.voz ? TEXTOS.vozSi : TEXTOS.vozNo)}</button>
    <h3>${esc(TEXTOS.historial)}</h3>
    ${items ? `<ul class="historial">${items}</ul>` : `<p class="nota">${esc(TEXTOS.sinHistorial)}</p>`}
    <button type="button" class="boton" data-act="volver" ${focoAttr("volver", false)}>${esc(TEXTOS.volver)}</button>
    ${dialogo()}`;
}

function html() {
  if (pantalla === "vitrina") return htmlVitrina();
  if (pantalla === "abriendo") return htmlAbriendo();
  if (pantalla === "carta" && carta) return htmlCarta();
  if (pantalla === "foto") return htmlFotoFamiliar();
  if (pantalla === "detalle" && detalleId) return htmlDetalle();
  if (pantalla === "papas") return htmlPapas();
  return htmlTienda();
}

function enfocar(id) {
  const lista = [...$main.querySelectorAll("[data-foco]")].filter((e) => !e.disabled);
  const preferido = id && lista.find((e) => e.dataset.focoId === id && e.dataset.focoId !== "saltar");
  const inicial = lista.find((e) => e.getAttribute("data-foco") === "inicial" && e.dataset.focoId !== "saltar");
  const otro = lista.find((e) => e.dataset.focoId !== "saltar");
  const el = preferido || inicial || otro || null;
  if (el) el.focus({ preventScroll: true });
}

function pintar(foco) {
  $main.dataset.pantalla = guia ? "guia-" + guia.paso : pantalla;
  $main.innerHTML = html();
  if (esTv()) document.documentElement.classList.add("teclado");
  enfocar(salir ? "seguir" : foco);
  programarFinBloqueo();
}

function cancelarVoz() {
  try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch { /* sin voz */ }
}

function programarAvance(token, evento) {
  if (!guia || !guiaAvanzaConToque(guia.paso)) return;
  clearTimeout(relojMuestra);
  const cuando = evento === "voz" ? cuandoAvanzaMuestra(aparecio, vozTerminoEn) : aparecio + GUIA_MAX_MS;
  relojMuestra = setTimeout(() => {
    if (token !== pasoToken || salir || !guia) return;
    avanzarMuestra(evento);
  }, Math.max(0, cuando - Date.now()));
}

function programarPaso() {
  const token = ++pasoToken;
  clearTimeout(relojMuestra);
  const paso = guia.paso;
  aparecio = Date.now();
  vozTerminoEn = null;
  const linea = pr.voz ? vozGuia(paso, modo()) : "";
  const r = linea ? decir(linea, { onend: () => {
    if (token !== pasoToken || salir) return;
    vozTerminoEn = Date.now();
    bloqueoPasoHasta = finBloqueoPaso({ aparecio, sono: true, vozTerminoEn });
    programarAvance(token, "voz");
    programarFinBloqueo();
  } }) : { sono: false };
  bloqueoPasoHasta = finBloqueoPaso({ aparecio, sono: !!r.sono, vozTerminoEn: null });
  programarAvance(token, "tiempo");
}

function empezarGuia() {
  guia = { paso: "tienda" };
  pantalla = "tienda";
  carta = null;
  detalleId = null;
  programarPaso();
  pintar(focoDeGuia("tienda"));
}

function terminarGuia() {
  pasoToken += 1;
  cartaToken += 1;
  esperandoCarta = false;
  clearTimeout(relojMuestra);
  clearTimeout(relojCarta);
  cancelarVoz();
  guia = null;
  pantalla = "tienda";
  carta = null;
  pr = marcarGuia(pr);
  guardar();
  bloqueoPasoHasta = Date.now() + TRAS_GUIA_MS;
  pintar("abrir");
}

function saltarGuia() {
  if (bloqueado("saltar")) return;
  terminarGuia();
}

function avanzarMuestra(evento) {
  if (!guia || salir) return;
  const ahora = Date.now();
  if (!muestraPuedeAvanzar({ aparecio, ahora, evento, vozTerminoEn, hasta: hastaAhora() })) return;
  const sig = aplicarGuia(guia.paso, evento);
  if (sig.fin) { terminarGuia(); return; }
  guia = { paso: sig.paso };
  if (sig.paso === "vitrina") pantalla = "vitrina";
  else if (sig.paso === "carta") pantalla = "carta";
  else pantalla = "tienda";
  programarPaso();
  pintar(focoDeGuia(sig.paso));
}

function mostrarCarta(token) {
  if (token !== cartaToken || salir) return;
  esperandoCarta = false;
  pantalla = "carta";
  if (guia && guia.paso === "abrir") {
    const sig = aplicarGuia("abrir", "abrir");
    if (sig.fin) { terminarGuia(); return; }
    guia = { paso: sig.paso };
    programarPaso();
    pintar(focoDeGuia(sig.paso));
    return;
  }
  const foco = carta && carta.familiaNueva ? "ver-foto" : "guardar-carta";
  pintar(foco);
  if (pr.voz && carta && carta.pieza && carta.pieza.ingles) decir(carta.pieza.ingles, { lang: "en-US" });
}

function empezarApertura(info) {
  carta = info;
  pantalla = "abriendo";
  esperandoCarta = true;
  try {
    const img = new Image();
    img.src = rutaPieza(info.pieza.archivo, 512);
  } catch { /* la carta se pinta igual */ }
  pintar();
  const token = ++cartaToken;
  clearTimeout(relojCarta);
  const espera = pocaAnimacion() ? 0 : APERTURA_MS;
  aperturaHasta = Date.now() + espera;
  if (espera === 0) mostrarCarta(token);
  else relojCarta = setTimeout(() => mostrarCarta(token), espera);
}

function abrirDemo() {
  const pieza = piezas.find((p) => p.rareza === "comun") || piezas[0];
  empezarApertura({ pieza, duplicado: false, polvoGanado: 0, ejemplo: true, familiaNueva: null });
}

async function abrirDeVerdad() {
  if (cobrando || guia) return;
  const fecha = fechaLocal();
  if (!puedeAbrir(pr, { creditos: saldo, fecha, piezas }).ok) { pintar("abrir"); return; }
  cobrando = true;
  pintar("abrir");
  const r = await abrirConCreditos(pr, {
    creditos: saldo,
    fecha,
    piezas,
    rng: rngDeCaja(),
    rarezaForzada: rarezaDeCaptura(),
    gastar: (n) => Noli.gastar(n, "cajas-sorpresa"),
  });
  cobrando = false;
  if (!r.ok) {
    if (typeof r.creditos === "number") saldo = r.creditos;
    pintar("abrir");
    return;
  }
  const antes = pr.tenidas.slice();
  saldo = r.creditos;
  pr = r.estado;
  guardar();
  const familiaNueva = r.duplicado ? null : familiaQueSeCompleto(antes, pr.tenidas, piezas);
  empezarApertura({ pieza: r.pieza, duplicado: r.duplicado, polvoGanado: r.polvoGanado, ejemplo: false, familiaNueva });
}

function pulsarAbrir() {
  if (!abrirHabilitado()) return;
  if (guia && guia.paso === "abrir") { abrirDemo(); return; }
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
  if (p && tiene) {
    try { const img = new Image(); img.src = rutaPieza(p.archivo, 512); } catch { /* sigue la miniatura */ }
    if (pr.voz) hablarIngles(p);
  }
  pintar(tiene ? "volver" : "conseguir");
}

function comprarPieza() {
  const antes = pr.tenidas.slice();
  const r = comprar(pr, detalleId, piezas);
  if (!r.ok) return;
  pr = r.estado;
  recien = true;
  fotoPendiente = familiaQueSeCompleto(antes, pr.tenidas, piezas);
  guardar();
  const p = piezas.find((x) => x.id === detalleId);
  if (p) { try { const img = new Image(); img.src = rutaPieza(p.archivo, 512); } catch { /* ya es tuya */ } }
  pintar(fotoPendiente ? "ver-foto" : "volver");
  if (pr.voz) hablarIngles(p);
}

function actuar(act, data) {
  if (act === "saltar") return saltarGuia();
  if (act === "frase-guia") {
    if (guia && guiaAvanzaConToque(guia.paso)) avanzarMuestra("toque");
    return;
  }
  if (act === "abrir") return pulsarAbrir();
  if (act === "vitrina") { pantalla = "vitrina"; pintar("volver"); return; }
  if (act === "como") return empezarGuia();
  if (act === "papas") { pantalla = "papas"; pintar("menos"); return; }
  if (act === "volver") {
    pantalla = "tienda";
    detalleId = null;
    recien = false;
    carta = null;
    fotoPendiente = null;
    pintar("abrir");
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
    fotoId = data.familia || (carta && carta.familiaNueva) || familiaVista;
    fotoDesde = pantalla;
    pantalla = "foto";
    pintar("cerrar-foto");
    return;
  }
  if (act === "cerrar-foto") {
    pantalla = fotoDesde === "carta" ? "carta" : fotoDesde === "detalle" ? "detalle" : "vitrina";
    pintar(pantalla === "carta" ? "guardar-carta" : pantalla === "detalle" ? "volver" : "volver");
    return;
  }
  if (act === "hueco") return abrirDetalle(data.id);
  if (act === "conseguir") return comprarPieza();
  if (act === "guardar-carta") {
    pantalla = "tienda";
    carta = null;
    pintar("abrir");
    return;
  }
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
  clearTimeout(relojCarta);
  pasoToken += 1;
  cancelarVoz();
  pintar("seguir");
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
    programarAvance(token, vozTerminoEn != null ? "voz" : "tiempo");
  } else {
    bloqueoDialogoHasta = ahora + TRAS_DIALOGO_MS;
  }
  if (esperandoCarta && pantalla === "abriendo") {
    aperturaHasta = (Number(aperturaHasta) || 0) + pausa;
    const token = cartaToken;
    clearTimeout(relojCarta);
    relojCarta = setTimeout(() => mostrarCarta(token), Math.max(0, aperturaHasta - ahora));
  }
  pintar(guia ? focoDeGuia(guia.paso) : undefined);
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
  if (bloqueado(act)) return;
  if (!t || t.disabled) return;
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
  if (accion === "ok" && bloqueado(idFoco() === "saltar" ? "saltar" : "ok")) return true;
  if (guia && accion === "ok") {
    const enfocado = document.activeElement;
    if (enfocado && $main.contains(enfocado) && enfocado.dataset.act === "oir") {
      enfocado.click();
      return true;
    }
    if (guiaAvanzaConToque(guia.paso) && muestraPuedeAvanzar({ aparecio, ahora: Date.now(), evento: "ok", vozTerminoEn, hasta: hastaAhora() })) {
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

function leerPiezas() {
  return fetch(new URL("../datos/piezas.json", import.meta.url)).then((r) => r.json());
}

Promise.all([Noli.datos, Noli.creditos, leerPiezas()]).then(([datos, creditos, lista]) => {
  piezas = Array.isArray(lista) ? lista : [];
  pr = cargar(datos);
  saldo = typeof creditos === "number" ? creditos : null;
  if (!pr.guiaHecha) empezarGuia();
  else pintar("abrir");
}).catch(() => {
  $main.innerHTML = `<p class="aviso">${esc(TEXTOS.noAbrio)}</p>`;
});
