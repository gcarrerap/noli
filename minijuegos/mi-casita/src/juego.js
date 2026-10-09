// Mi Casita: pantallas. La lógica está en los otros módulos.
// Se juega con el dedo o con flechas, OK y Atrás. Sin await al nivel del módulo.
import { Noli, moverFoco, focoInicial } from "../../../kit/noli.js";
import { piezaSvg, textoLargo, cargarMoneda } from "./monedas.js";
import { sumaOrden, sumaBolsa, conteoDe } from "./dinero.js";
import { formaDe, cabe } from "./casa.js";
import { abiertos, recienAbiertos, bolsaDe } from "./desbloqueo.js";
import { pistaPagar, monedasQueSirven, pistaLugar } from "./pista.js";
import {
  guiaNueva, aplicarGuia, bolsaGuia, textoGuia, vozGuia, focoDeGuia,
  guiaAvanzaConToque, guiaPagarActivo, okDeGuia, demoraMuestra, relojConSalir, entradaTrasCierre,
  GUIA_TOQUE_MS, GUIA_PAUSA_MS, GUIA_PAUSA_MAX_MS, GUIA_COMPRA_MS,
} from "./guia.js";
import {
  visitaNueva, debeCobrar, alAgregar, alQuitar, alPagar, elegirMueble, moverPieza,
  tocarCuadro, girarPieza, abrirBarra, cerrarBarra, dejarPieza, devolverPieza, preciosAbiertos,
  algunoAlcanza, cerrarVisita, avisoDePago,
} from "./visita.js";
import { nuevo, cargar, monedaDeTienda, fechaLocal, COSTO } from "./progreso.js";
import { fraseMedida, fraseGiro, fraseTrasGiro, fraseFaltan, fraseBrilla, textoMover, rellenar } from "./frases.js";
import { decir, paraVoz, callar } from "./voz.js";
import { desbloquear, clic, brillo, dejar as sonidoDejar } from "./sonido.js";
import { resolverToque, teclaConDialogo, teclaConBarra, atrasEnPantalla, toqueEnVelo } from "./salida.js";

const $main = document.getElementById("juego");
try { if (/[?&]modo=tv\b/.test(location.search)) document.documentElement.dataset.modo = "tv"; } catch { /* sin location */ }

const ESTRELLA = `<svg class="estrella-credito" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#ffc43d" stroke="#2b2236" stroke-width="1.6"/><circle cx="12" cy="12" r="7.2" fill="none" stroke="#e0a100" stroke-width="1.2"/><path d="M12 6.8l1.5 3.1 3.4.4-2.5 2.3.7 3.4-3.1-1.7-3.1 1.7.7-3.4-2.5-2.3 3.4-.4z" fill="#fff4cc" stroke="#e0a100" stroke-width=".8" stroke-linejoin="round"/></svg>`;

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const esTv = () => document.documentElement.dataset.modo === "tv" || Noli.modo === "tv";
const modo = () => (esTv() ? "tv" : "tactil");
const hoy = () => fechaLocal();

let textos = {};
let muebles = [];
let cuartos = [];
let niveles = [];
let bolsas = {};
let monedas = { usd: null, mxn: null };
let etiquetaSvg = "";
let bolsaSvg = "";
let pr = nuevo();
let saldo = null;
let monedaId = "usd";
let pantalla = "inicio";
let guia = null;
let salir = false;
let cobrando = false;
let finNuevos = { cuartos: [], muebles: [] };
let dicho = "";
let sonoExacto = false;
let relojPista = 0;
let relojGuia = 0;
let guiaPausaHasta = 0;
let compraPausaHasta = 0;
let pasoConPausa = "";
let pausaToken = 0;
let dialogCerroEn = -1e15;

const porId = () => Object.fromEntries(muebles.map((m) => [m.id, m]));
const piezas = () => (monedas[monedaId] || monedas.usd)?.piezas || [];
const cuartoPor = (id) => cuartos.find((c) => c.id === id) || cuartos[0];
const guardar = () => Noli.guardar(pr);

function hablar(texto, alTerminar, alFallar) {
  if (!pr.voz || !texto || texto === dicho) {
    if (alFallar) alFallar();
    else if (alTerminar) alTerminar();
    return;
  }
  dicho = texto;
  decir(texto, "es-MX", alTerminar, { alFallar });
}

function pausaGuiaActiva() {
  return Date.now() < guiaPausaHasta;
}

function bloqueoTrasDialogo(tipo) {
  return entradaTrasCierre(Date.now() - dialogCerroEn, tipo) === "ignora";
}

function compraPausaActiva() {
  return Date.now() < compraPausaHasta;
}

function esFlecha(accion) {
  return accion === "arriba" || accion === "abajo" || accion === "izquierda" || accion === "derecha";
}

/** Al aparecer un paso, OK y toques esperan 1 s o a que acabe la voz (máximo 3 s). */
function empezarPausaPaso(linea) {
  const token = ++pausaToken;
  const t0 = Date.now();
  const habla = !!(pr.voz && paraVoz(linea));
  guiaPausaHasta = t0 + (habla ? GUIA_PAUSA_MAX_MS : GUIA_PAUSA_MS);
  dicho = "";
  const cerrar = (estado, ms) => {
    if (token !== pausaToken) return;
    const ahora = Date.now();
    if (estado === "ok") {
      guiaPausaHasta = Math.min(t0 + GUIA_PAUSA_MAX_MS, Math.max(t0 + GUIA_PAUSA_MS, ahora));
    } else {
      guiaPausaHasta = t0 + GUIA_PAUSA_MS;
    }
    if (pantalla !== "guia" || !guia || !guiaAvanzaConToque(guia.paso)) return;
    programarMuestra(t0 + demoraMuestra(estado, ms) - ahora);
  };
  hablar(linea, () => cerrar("ok", Date.now() - t0), () => cerrar("falla", 0));
}

function idx() {
  return {
    muebles: new Map(muebles.map((m) => [m.id, m])),
    cuartos: new Map(cuartos.map((c) => [c.id, c])),
  };
}

function pobre() {
  return debeCobrar(pr, hoy()) && saldo !== null && saldo < COSTO;
}

function svgPrecio(n) {
  if (!etiquetaSvg) return `<b class="precio-num">${esc(n)}</b>`;
  return etiquetaSvg.replace(">$3<", `>${esc(n)}<`);
}
function svgBolsa(n) {
  if (!bolsaSvg) return `<b>${esc(n)}</b>`;
  return bolsaSvg.replace(">20<", `>${esc(n)}<`);
}

function focoAttr(id, inicial) {
  if (salir) return "";
  return `data-foco${inicial ? '="inicial"' : ""} data-foco-id="${esc(id)}"`;
}

function dialogo() {
  if (!salir) return "";
  return `<div class="velo salir-velo"><div class="dialogo" role="dialog" aria-label="Salir">
    <p>${esc(textos.salirPregunta)}</p>
    <button type="button" class="boton grande primario" data-foco="inicial" data-foco-id="seguir" data-act="seguir">${esc(textos.seguir)}</button>
    <button type="button" class="boton grande" data-foco data-foco-id="salir" data-act="salir">${esc(textos.salir)}</button>
  </div></div>`;
}

function cabecera(extra) {
  const total = pr.visita ? sumaBolsa(pr.visita.bolsa, piezas()) : 0;
  const derecha = guia
    ? `<button type="button" class="boton saltar" ${salir ? "" : 'data-foco data-foco-id="saltar"'} data-act="saltar">${esc(textos.saltar)}</button>`
    : extra || "";
  const bolsa = pr.visita && !guia ? `<span class="bolsa" aria-label="Bolsa">${svgBolsa(total)}</span>` : `<span></span>`;
  return `<header class="cab">${bolsa}${derecha}</header>`;
}

function htmlCuarto(c, tomando, focoId) {
  const puestos = pr.puestos.filter((p) => p.cuarto === c.id);
  let celdas = "";
  for (let y = 0; y < c.filas; y++) {
    for (let x = 0; x < c.cols; x++) {
      let marca = "";
      if (tomando) {
        const dentro = x >= tomando.x && x < tomando.x + tomando.w && y >= tomando.y && y < tomando.y + tomando.h;
        const ocupado = puestos.some((p) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h);
        if (dentro && ocupado) marca = `<img src="arte/cuadro-ocupado.svg" alt="">`;
        else if (dentro) marca = `<img src="arte/cuadro-libre.svg" alt="">`;
        if (x === tomando.x && y === tomando.y) marca += `<img src="arte/cuadro-foco.svg" alt="">`;
      }
      if (tomando) celdas += `<button type="button" class="celda" data-act="celda" data-x="${x}" data-y="${y}" aria-label="Cuadro">${marca}</button>`;
      else celdas += `<div class="celda"></div>`;
    }
  }
  const capas = puestos.map((p) => puestoHtml(p, false)).join("");
  const fantasma = tomando ? puestoHtml(tomando, true) : "";
  const marca = focoId ? ` tabindex="0" data-foco="inicial" data-foco-id="${esc(focoId)}"` : "";
  return `<div class="rejilla"${marca} style="--cols:${c.cols};--filas:${c.filas};--piso:url('arte/${esc(c.piso)}')">${celdas}${capas}${fantasma}</div>`;
}

function puestoHtml(p, fantasma) {
  const gira = p.giro && p.giro % 180 !== 0;
  return `<span class="puesto${fantasma ? " fantasma" : ""}${gira ? " gira" : ""}" style="--x:${p.x};--y:${p.y};--w:${p.w};--h:${p.h};--giro:${p.giro || 0}deg"><img src="arte/${esc(p.archivo)}" alt=""></span>`;
}

function idFocoMoneda(p) {
  if (guia && p.valor === 5) return "moneda-cinco";
  if (guia && p.valor === 1) return "moneda-uno";
  return "moneda-" + p.id;
}

function fichaHtml(p, bolsa, luz, flecha, inicial) {
  const quedan = (bolsa?.[p.id] || 0);
  const sirve = luz && luz[p.id];
  const cls = `ficha${p.tipo === "billete" ? " billete" : ""}${sirve ? " sirve" : ""}${flecha === p.id ? " flecha" : ""}`;
  const off = quedan <= 0 ? "disabled" : "";
  return `<button type="button" class="${cls}" ${off} ${quedan > 0 ? focoAttr(idFocoMoneda(p), inicial) : ""} data-act="moneda" data-id="${esc(p.id)}" aria-label="${esc(p.nombre)}">${piezaSvg(p)}</button>`;
}

function barraHtml(puede) {
  const abierta = !esTv() || !!(pr.visita && pr.visita.barra);
  const oculta = abierta ? "" : " oculta";
  const dis = puede ? "" : "disabled";
  const focoDejar = abierta && puede ? focoAttr("dejar", esTv()) : "";
  const focoGirar = abierta ? focoAttr("girar") : "";
  const focoDevolver = abierta ? focoAttr("devolver") : "";
  return `<div class="barra${oculta}">
    <button type="button" ${dis} ${focoDejar} data-act="dejar"><img src="arte/boton-dejar.svg" alt=""><span>${esc(textos.dejar)}</span></button>
    <button type="button" ${focoGirar} data-act="girar"><img src="arte/boton-girar.svg" alt=""><span>${esc(textos.girar)}</span></button>
    <button type="button" ${focoDevolver} data-act="devolver"><img src="arte/boton-devolver.svg" alt=""><span>${esc(textos.devolver)}</span></button>
  </div>`;
}

function flechasHtml() {
  const b = (dir, cls, archivo) => `<button type="button" class="${cls}" data-act="mov" data-dir="${dir}" aria-label="${dir}"><img src="arte/${archivo}" alt=""></button>`;
  return `<div class="flechas">
    ${b("arriba", "up", "boton-flecha-arriba.svg")}
    ${b("izquierda", "left", "boton-flecha-izquierda.svg")}
    ${b("abajo", "down", "boton-flecha-abajo.svg")}
    ${b("derecha", "right", "boton-flecha-derecha.svg")}
  </div>`;
}

function pistaMovimiento(barraAbierta) {
  const linea = textoMover(esTv() ? "tv" : "tactil", !!barraAbierta, textos);
  return linea ? `<p class="medida">${esc(linea)}</p>` : "";
}

function htmlInicio() {
  const abierta = pr.visita && pr.visita.abierta && pr.visita.dia === hoy();
  const falta = pobre();
  const n = Math.max(1, COSTO - (saldo || 0));
  return `
    ${cabecera(`<button type="button" class="boton" ${focoAttr("voz")} data-act="voz">${esc(pr.voz ? textos.vozSi : textos.vozNo)}</button>`)}
    <img class="casa-icono" src="icono.svg" alt="">
    <h1 class="titulo">${esc(textos.titulo)}</h1>
    <p class="saldo">${ESTRELLA}<b>${saldo === null ? "—" : saldo}</b> ${esc(saldo === 1 ? textos.creditoUno : textos.creditos)}</p>
    ${falta ? `<p class="aviso mal">${ESTRELLA} ${esc(fraseFaltan(n, textos))}</p>` : ""}
    <div class="menu">
      <button type="button" class="boton grande primario${falta ? " apagado" : ""}" ${falta ? "disabled" : focoAttr("entrar", true)} data-act="entrar">
        ${esc(abierta ? textos.seguirVisita : textos.entrar)}
        <small>${abierta ? esc(textos.yaPagada) : `${ESTRELLA} ${COSTO}`}</small>
      </button>
      <button type="button" class="boton grande" ${focoAttr("mirar", falta)} data-act="mirar">${esc(textos.soloMirar)}</button>
      <button type="button" class="boton grande" ${focoAttr("como")} data-act="como">${esc(textos.como)}</button>
    </div>
    ${dialogo()}`;
}

function htmlFaltan() {
  const n = Math.max(1, COSTO - (saldo || 0));
  return `
    <div class="faltan-ico">${ESTRELLA}</div>
    <h1 class="titulo">${esc(fraseFaltan(n, textos))}</h1>
    <div class="menu">
      <button type="button" class="boton grande primario" ${focoAttr("mirar", true)} data-act="mirar">${esc(textos.soloMirar)}</button>
    </div>
    ${dialogo()}`;
}

function listaCompra() {
  const ab = abiertos(pr.visitas, niveles);
  return preciosAbiertos(ab, muebles, pr.puestos);
}

function htmlTienda() {
  const ab = abiertos(pr.visitas, niveles);
  const cuartoId = ab.cuartos.includes(pr.visita.cuarto) ? pr.visita.cuarto : ab.cuartos[0];
  const lista = listaCompra().filter((m) => m.cuarto === cuartoId);
  const pedido = listaCompra().some((m) => m.id === "alfombra6");
  const tabs = ab.cuartos.length < 2 ? "" : ab.cuartos.map((id) => {
    const c = cuartoPor(id);
    const sel = cuartoId === id;
    return `<button type="button" class="${sel ? "sel" : ""}" ${focoAttr("cuarto-" + id)} data-act="cuarto" data-id="${esc(id)}"><img src="arte/${esc(c.tarjeta)}" alt=""><span>${esc(c.es)}</span></button>`;
  }).join("");
  const cards = lista.map((m, i) => `
    <button type="button" class="mueble-btn" ${focoAttr("mueble-" + m.id, i === 0)} data-act="escoger" data-id="${esc(m.id)}">
      <img src="arte/${esc(m.archivo)}" alt="">
      <b>${esc(m.es)}</b>
      <small class="en">${esc(m.en)}</small>
      <span class="precio-tag">${svgPrecio(m.precio)}</span>
    </button>`).join("");
  return `
    ${cabecera(`<button type="button" class="boton" ${focoAttr("terminar")} data-act="terminar">${esc(textos.terminar)}</button>`)}
    ${pedido ? `<div class="mascota"><img src="arte/mascota.svg" alt=""><p>${esc(textos.pedido)}</p></div>` : ""}
    ${tabs ? `<div class="cuartos">${tabs}</div>` : ""}
    <div class="catalogo">${cards || `<p class="sub">${esc(textos.nadaMas)}</p>`}</div>
    ${dialogo()}`;
}

function htmlPagar(opts) {
  const m = porId()[opts.muebleId];
  const bolsa = opts.bolsa;
  const orden = opts.orden || [];
  const suma = sumaOrden(orden, piezas());
  const exacto = suma === m.precio;
  const luz = monedasQueSirven(m.precio, bolsa, piezas(), opts.fallos || 0);
  const pista = opts.pista || { texto: "", flecha: null };
  const mostrarSuma = opts.mostrarSuma;
  const tipos = opts.soloPrecio ? [] : piezas().filter((p) => (bolsa[p.id] || 0) > 0 || orden.includes(p.id)).sort((a, b) => b.valor - a.valor);
  const mano = orden.map((id) => {
    const p = piezas().find((x) => x.id === id);
    return p ? `<span class="mini${p.tipo === "billete" ? " billete" : ""}">${piezaSvg(p)}</span>` : "";
  }).join("");
  const tipoAviso = avisoDePago({ suma, precio: m.precio, corto: !!opts.corto });
  let aviso = "";
  if (tipoAviso === "pasaste") aviso = textos.tePasaste;
  else if (!opts.linea && tipoAviso === "brilla") aviso = fraseBrilla(modo(), textos);
  else if (!opts.linea && tipoAviso === "corto") aviso = textos.todaviaNo;
  const lineaPista = opts.linea || (exacto || suma > m.precio ? "" : (pista.texto || ""));
  const pagarActivo = opts.pagarActivo !== false;
  const pagarCls = `boton grande${pagarActivo && exacto ? " primario brilla" : " apagado"}`;
  const precio = opts.muestraPrecio
    ? `<span class="precio-tag" tabindex="0" ${focoAttr("precio", true)}>${svgPrecio(m.precio)}</span>`
    : `<span class="precio-tag">${svgPrecio(m.precio)}</span>`;
  const focoMoneda = guia && guia.paso === "monedas" ? focoDeGuia("monedas", orden, piezas()) : "";
  return `
    ${cabecera(guia ? "" : `<button type="button" class="boton" ${focoAttr("terminar")} data-act="terminar">${esc(textos.terminar)}</button>`)}
    <p class="pista">${esc(lineaPista)}</p>
    <div class="compra">
      <img class="dibujo" src="arte/${esc(m.archivo)}" alt="">
      <b>${esc(m.es)} <span class="en">${esc(m.en)}</span></b>
      ${precio}
    </div>
    <div class="fichas">${tipos.map((p, i) => fichaHtml(p, bolsa, luz, pista.flecha, focoMoneda ? idFocoMoneda(p) === focoMoneda : i === 0 && !exacto)).join("")}</div>
    <div class="puestos-mano">${mano}</div>
    ${mostrarSuma ? `<p class="llevas">${esc(rellenar(textos.llevas, { n: suma }))}</p>` : ""}
    <p class="aviso${suma > m.precio ? " mal" : ""}">${esc(aviso)}</p>
    <div class="abajo">
      <button type="button" class="boton${orden.length ? "" : " apagado"}" ${orden.length ? "" : "disabled"} ${orden.length ? focoAttr("quitar") : ""} ${orden.length ? 'data-act="quitar"' : ""}>${esc(textos.quitar)}</button>
      ${opts.ayuda ? `<button type="button" class="boton" ${focoAttr("ayuda")} data-act="ayuda">${esc(textos.ayuda)}</button>` : ""}
      <button type="button" class="${pagarCls}" ${pagarActivo ? focoAttr("pagar", guia ? guia.paso === "pagar" : exacto) : ""} ${pagarActivo ? 'data-act="pagar"' : "disabled"}>${esc(textos.pagar)}</button>
    </div>
    ${dialogo()}`;
}

function tomandoDe(v, m) {
  const f = formaDe(m, v.rot);
  return { x: v.x, y: v.y, w: f.w, h: f.h, archivo: f.archivo, giro: f.giro || 0 };
}

function htmlAcomodar(linea) {
  const v = pr.visita;
  const m = porId()[guia ? "lampara" : v.mueble];
  const c = cuartoPor(guia ? "recamara" : (m.cuarto || v.cuarto));
  const toma = tomandoDe(guia ? { x: guia.x || 0, y: guia.y || 0, rot: guia.rot || 0 } : v, m);
  const puede = cabe(c, guia ? [] : pr.puestos, toma.x, toma.y, toma.w, toma.h);
  const lugar = guia ? { texto: "" } : pistaLugar({
    cuarto: c, puestos: pr.puestos, x: toma.x, y: toma.y, mueble: m, rot: v.rot, textos, catalogo: porId(),
  });
  const rot = guia ? 0 : (v.rot || 0);
  const giroTxt = guia ? "" : fraseTrasGiro(
    rot, formaDe(m, rot - 1).w, formaDe(m, rot - 1).h, toma.w, toma.h, textos,
  );
  const barraAbierta = !guia && esTv() && !!(v && v.barra);
  const focoRejilla = guia ? "cuadro" : (esTv() && !barraAbierta ? "cuadricula" : "");
  return `
    ${cabecera(guia ? "" : `<button type="button" class="boton" ${focoAttr("terminar")} data-act="terminar">${esc(textos.terminar)}</button>`)}
    <p class="pista">${esc(linea || lugar.texto || "")}</p>
    ${giroTxt ? `<p class="medida giro">${esc(giroTxt)}</p>` : ""}
    <div class="lado">
      ${htmlCuarto(c, toma, focoRejilla)}
      <div class="controles">
        ${flechasHtml()}
        <p class="medida">${esc(fraseMedida(toma.w, toma.h, textos))}</p>
        ${pistaMovimiento(barraAbierta)}
        ${guia ? "" : barraHtml(puede)}
      </div>
    </div>
    ${dialogo()}`;
}

function htmlMirar() {
  const ab = abiertos(pr.visitas, niveles);
  const id = pr.visita?.cuarto && ab.cuartos.includes(pr.visita.cuarto) ? pr.visita.cuarto : ab.cuartos[0];
  const tabs = ab.cuartos.map((cid, i) => {
    const c = cuartoPor(cid);
    return `<button type="button" class="${cid === id ? "sel" : ""}" ${focoAttr("cuarto-" + cid, i === 0)} data-act="cuarto-mirar" data-id="${esc(cid)}"><img src="arte/${esc(c.tarjeta)}" alt=""><span>${esc(c.es)} <small class="en">${esc(c.en)}</small></span></button>`;
  }).join("");
  return `
    <h1 class="titulo">${esc(textos.titulo)}</h1>
    <p class="sub">${esc(textos.mirarNota)}</p>
    <div class="cuartos">${tabs}</div>
    ${htmlCuarto(cuartoPor(id), null)}
    ${dialogo()}`;
}

function htmlFin() {
  const nombres = finNuevos.cuartos.map((id) => cuartoPor(id).es).join(", ");
  return `
    <img class="casa-icono" src="icono.svg" alt="">
    <h1 class="titulo">${esc(finNuevos.vacio ? textos.finSinDinero : textos.finListo)}</h1>
    ${nombres ? `<p class="pista">${esc(rellenar(textos.nuevoCuarto, { nombre: nombres }))}</p>` : ""}
    <div class="menu">
      <button type="button" class="boton grande primario" ${focoAttr("inicio", true)} data-act="inicio">${esc(textos.aCasa)}</button>
      <button type="button" class="boton grande" ${focoAttr("mirar")} data-act="mirar">${esc(textos.soloMirar)}</button>
    </div>
    ${dialogo()}`;
}

function htmlGuiaFin() {
  return `
    ${cabecera()}
    <img class="casa-icono" src="icono.svg" alt="">
    <h1 class="titulo">${esc(textos.guiaFin)}</h1>
    <div class="menu">
      <button type="button" class="boton grande primario" ${focoAttr("fin-guia", true)} data-act="fin-guia">${esc(textos.aCasa)}</button>
    </div>
    ${dialogo()}`;
}

function vista() {
  if (pantalla === "inicio") return htmlInicio();
  if (pantalla === "faltan") return htmlFaltan();
  if (pantalla === "mirar") return htmlMirar();
  if (pantalla === "fin") return htmlFin();
  if (pantalla === "guia") return vistaGuia();
  if (pantalla === "pagar") return vistaPagar();
  if (pantalla === "acomodar") return vistaAcomodar();
  return htmlTienda();
}

function vistaGuia() {
  const paso = guia.paso;
  const linea = textoGuia(paso, modo(), textos);
  if (paso === "fin") return htmlGuiaFin();
  if (paso === "escoger") {
    const m = porId().lampara;
    return `
      ${cabecera()}
      <p class="pista">${esc(linea)}</p>
      <button type="button" class="mueble-btn sel" ${focoAttr("mueble-lampara", true)} data-act="escoger" data-id="lampara">
        <img src="arte/${esc(m.archivo)}" alt="">
        <b>${esc(m.es)}</b>
        <small class="en">${esc(m.en)}</small>
      </button>
      ${dialogo()}`;
  }
  if (paso === "precio" || paso === "monedas" || paso === "pagar") {
    const bolsa = bolsaGuia(monedaId);
    return htmlPagar({
      muebleId: "lampara",
      bolsa,
      orden: guia.orden || [],
      fallos: guia.fallos || 0,
      pista: { texto: linea, flecha: null },
      linea,
      mostrarSuma: paso !== "precio",
      muestraPrecio: paso === "precio",
      soloPrecio: paso === "precio",
      pagarActivo: guiaPagarActivo(paso),
      ayuda: false,
      corto: false,
    });
  }
  return htmlAcomodar(linea);
}

function vistaPagar() {
  const v = pr.visita;
  const m = porId()[v.mueble];
  const ab = abiertos(pr.visitas, niveles);
  const ms = v.ayudaDesde ? Date.now() - v.ayudaDesde : 0;
  const pista = pistaPagar({
    nivelDinero: ab.dinero, precio: m.precio, bolsa: v.bolsa, piezas: piezas(), textos,
    errores: v.fallos, ms, modo: modo(),
  });
  return htmlPagar({
    muebleId: v.mueble,
    bolsa: v.bolsa,
    orden: v.orden,
    fallos: v.fallos,
    pista,
    mostrarSuma: ab.dinero <= 1 || v.ayuda,
    ayuda: ab.dinero > 1,
    corto: v.corto === true,
  });
}

function vistaAcomodar() {
  return htmlAcomodar("");
}

function limpiarRelojGuia() {
  clearTimeout(relojGuia);
  relojGuia = 0;
}

function pintarGuia() {
  pintar(guia ? focoDeGuia(guia.paso, guia.orden, piezas()) : "");
}

function avanzarMuestra(tipo) {
  if (!guia || !guiaAvanzaConToque(guia.paso)) return;
  limpiarRelojGuia();
  guia = aplicarGuia(guia, { tipo }, piezas());
  dicho = "";
  if (guia.lista) { terminarGuia(); return; }
  pintarGuia();
}

function programarMuestra(ms) {
  limpiarRelojGuia();
  if (pantalla !== "guia" || !guia || salir || !guiaAvanzaConToque(guia.paso)) return;
  const paso = guia.paso;
  let espera = ms;
  if (espera == null) {
    const linea = vozGuia(paso, modo(), textos);
    espera = pr.voz && paraVoz(linea) ? GUIA_PAUSA_MAX_MS : GUIA_TOQUE_MS;
  }
  relojGuia = setTimeout(() => {
    relojGuia = 0;
    if (salir || pantalla !== "guia" || !guia || guia.paso !== paso) return;
    avanzarMuestra("tiempo");
  }, Math.max(0, espera));
}

function pintar(forzar) {
  clearTimeout(relojPista);
  $main.innerHTML = vista();
  $main.className = "p-" + pantalla + (esTv() ? " tv" : "");
  const exacto = pagarExactoAhora();
  if (exacto && !sonoExacto) { sonoExacto = true; brillo(); }
  if (!exacto) sonoExacto = false;
  let id = "";
  if (salir) id = "seguir";
  else if (forzar) id = forzar;
  else if (pantalla === "guia" && guia) id = focoDeGuia(guia.paso, guia.orden, piezas());
  else if (exacto) id = "pagar";
  const el = (id && $main.querySelector(`[data-foco-id="${id}"]`))
    || $main.querySelector('[data-foco="inicial"]:not([data-foco-id="saltar"])')
    || [...$main.querySelectorAll("[data-foco]")].find((n) => n.dataset.focoId !== "saltar");
  if (el) el.focus({ preventScroll: true });
  else focoInicial($main);
  programarPista();
  programarMuestra();
  decirPantalla();
}

function pagarExactoAhora() {
  if (pantalla === "guia" && guia && (guia.paso === "monedas" || guia.paso === "pagar")) {
    return sumaOrden(guia.orden, piezas()) === 6 && guia.paso === "pagar";
  }
  if (pantalla !== "pagar" || !pr.visita) return false;
  const m = porId()[pr.visita.mueble];
  return !!m && sumaOrden(pr.visita.orden, piezas()) === m.precio;
}

function decirPantalla() {
  if (pantalla === "guia" && guia) {
    const linea = vozGuia(guia.paso, modo(), textos);
    if (guia.paso !== pasoConPausa) {
      pasoConPausa = guia.paso;
      empezarPausaPaso(linea);
    }
    return;
  }
  if (pantalla === "faltan") hablar(fraseFaltan(Math.max(1, COSTO - (saldo || 0)), textos, true));
  else if (pantalla === "inicio" && pobre()) hablar(fraseFaltan(Math.max(1, COSTO - (saldo || 0)), textos, true));
  else if (pantalla === "tienda" && listaCompra().some((m) => m.id === "alfombra6")) hablar(textos.vozPedido);
  else if (pantalla === "pagar" && pr.visita) {
    const suma = sumaOrden(pr.visita.orden, piezas());
    const m = porId()[pr.visita.mueble];
    const ab = abiertos(pr.visitas, niveles);
    const pista = pistaPagar({
      nivelDinero: ab.dinero, precio: m.precio, bolsa: pr.visita.bolsa, piezas: piezas(), textos,
      errores: pr.visita.fallos, ms: pr.visita.ayudaDesde ? Date.now() - pr.visita.ayudaDesde : 0,
      modo: modo(),
    });
    if (suma > m.precio) hablar(textos.vozPasaste);
    else if (suma === m.precio) hablar(fraseBrilla(modo(), textos, true));
    else if (ab.dinero <= 1 && suma > 0) hablar(textoLargo(monedas[monedaId], suma));
    else hablar(pista.voz);
  }
}

function programarPista() {
  if (pantalla !== "pagar" || !pr.visita || salir) return;
  if (abiertos(pr.visitas, niveles).dinero <= 1) return;
  const ms = Date.now() - (pr.visita.ayudaDesde || Date.now());
  let espera = 0;
  if (ms < 20000) espera = 20000 - ms;
  else if (ms < 40000) espera = 40000 - ms;
  else return;
  relojPista = setTimeout(() => { if (pantalla === "pagar" && !salir) pintar(); }, espera + 30);
}

function asegurarGuiaLugar() {
  if (guia.x == null) { guia.x = 0; guia.y = 0; guia.rot = 0; }
}

function actuar(act, ds) {
  const via = resolverToque(act, cobrando ? "cobrando" : pantalla, salir);
  if (via === "seguir") { cerrarDialogo(); return; }
  if (via === "salir") { salir = false; guardar(); Noli.salir(); return; }
  if (via === "nada") return;
  if (act === "saltar" || act === "fin-guia") { terminarGuia(); return; }
  if (act === "voz") { pr = { ...pr, voz: !pr.voz }; guardar(); dicho = ""; pintar(); return; }
  if (act === "como") { empezarGuia(); return; }
  if (act === "inicio") { pantalla = "inicio"; pintar(); return; }
  if (act === "mirar") { pantalla = "mirar"; pintar(); return; }
  if (act === "entrar") { entrar(); return; }
  if (act === "terminar") { terminar(false); return; }
  if (act === "cuarto-mirar") {
    pr = { ...pr, visita: { ...(pr.visita || {}), cuarto: ds.id, abierta: pr.visita?.abierta, dia: pr.visita?.dia } };
    pintar();
    return;
  }
  if (pantalla === "guia") return actuarGuia(act, ds);
  if (!pr.visita) return;
  if (act === "cuarto") { pr.visita = { ...pr.visita, cuarto: ds.id }; pintar(); return; }
  if (act === "escoger") {
    const m = porId()[ds.id];
    if (!m) return;
    pr.visita = elegirMueble(pr.visita, m.id);
    pr.visita.cuarto = m.cuarto;
    pr.visita.ayudaDesde = Date.now();
    pantalla = "pagar";
    guardar();
    pintar();
    return;
  }
  if (act === "moneda" && pantalla === "pagar") {
    const m = porId()[pr.visita.mueble];
    const antes = sumaOrden(pr.visita.orden, piezas());
    pr.visita = alAgregar(pr.visita, ds.id, m.precio, piezas());
    const suma = sumaOrden(pr.visita.orden, piezas());
    if (suma !== antes) clic();
    pr.visita.corto = false;
    guardar();
    pintar(suma === m.precio ? "pagar" : "moneda-" + ds.id);
    return;
  }
  if (act === "quitar" && pantalla === "pagar") {
    pr.visita = alQuitar(pr.visita);
    pr.visita.corto = false;
    guardar();
    pintar();
    return;
  }
  if (act === "ayuda" && pantalla === "pagar") {
    pr.visita = { ...pr.visita, ayuda: true };
    pintar();
    return;
  }
  if (act === "pagar" && pantalla === "pagar") {
    const m = porId()[pr.visita.mueble];
    const r = alPagar(pr.visita, m.precio, piezas());
    pr.visita = r.visita;
    if (!r.ok) { pr.visita.corto = sumaOrden(pr.visita.orden, piezas()) < m.precio; guardar(); pintar(); return; }
    pantalla = "acomodar";
    guardar();
    pintar();
    return;
  }
  if (pantalla === "acomodar") actuarLugar(act, ds);
}

function actuarGuia(act, ds) {
  const paso = guia.paso;
  if (paso === "escoger" && act === "escoger") {
    guia = aplicarGuia(guia, { tipo: "escoger", id: ds.id }, piezas());
    dicho = "";
    pintarGuia();
    return;
  }
  if (paso === "monedas" && act === "moneda") {
    const bolsa = bolsaGuia(monedaId);
    const usados = (guia.orden || []).filter((id) => id === ds.id).length;
    if (usados >= (bolsa[ds.id] || 0)) return;
    const orden = [...(guia.orden || []), ds.id];
    const suma = sumaOrden(orden, piezas());
    if (suma > 6 && sumaOrden(guia.orden, piezas()) <= 6) guia.fallos = (guia.fallos || 0) + 1;
    clic();
    guia = aplicarGuia({ ...guia, orden }, { tipo: "monedas", orden }, piezas());
    dicho = "";
    pintarGuia();
    return;
  }
  if (paso === "monedas" && act === "quitar") {
    guia = { ...guia, orden: (guia.orden || []).slice(0, -1) };
    pintarGuia();
    return;
  }
  if (act === "pagar") {
    if (!guiaPagarActivo(paso)) return;
    guia = aplicarGuia(guia, { tipo: "pagar" }, piezas());
    if (guia.paso === "cuadro") asegurarGuiaLugar();
    dicho = "";
    pintarGuia();
    return;
  }
  if (paso === "cuadro") actuarLugar(act, ds);
}

function actuarLugar(act, ds) {
  const enGuia = pantalla === "guia";
  const m = porId()[enGuia ? "lampara" : pr.visita.mueble];
  const c = cuartoPor(enGuia ? "recamara" : m.cuarto);
  if (act === "mov") {
    if (enGuia) {
      asegurarGuiaLugar();
      const f = formaDe(m, guia.rot || 0);
      const p = moverPieza({ x: guia.x, y: guia.y, rot: guia.rot || 0 }, c, ds.dir, m);
      guia = aplicarGuia({ ...guia, x: p.x, y: p.y, rot: guia.rot || 0 }, { tipo: "mover" }, piezas());
      guia.x = p.x; guia.y = p.y;
      if (guia.lista) return terminarGuia();
      pintarGuia();
      return;
    }
    pr.visita = moverPieza(pr.visita, c, ds.dir, m);
    guardar();
    pintar();
    return;
  }
  if (act === "celda") {
    if (enGuia) {
      asegurarGuiaLugar();
      const p = tocarCuadro({ x: guia.x, y: guia.y, rot: guia.rot || 0 }, c, +ds.x, +ds.y, m);
      guia.x = p.x; guia.y = p.y;
      guia = aplicarGuia(guia, { tipo: "cuadro", modo: modo() }, piezas());
      if (guia.lista) return terminarGuia();
      dicho = "";
      pintarGuia();
      return;
    }
    pr.visita = tocarCuadro(pr.visita, c, +ds.x, +ds.y, m);
    guardar();
    pintar();
    return;
  }
  if (act === "girar" && !enGuia) {
    pr.visita = girarPieza(pr.visita);
    const f = formaDe(m, pr.visita.rot);
    const frase = fraseGiro(formaDe(m, pr.visita.rot - 1).w, formaDe(m, pr.visita.rot - 1).h, f.w, f.h, textos);
    if (frase) { dicho = ""; hablar(frase); }
    guardar();
    pintar(esTv() ? "cuadricula" : "");
    return;
  }
  if (act === "dejar" && !enGuia) {
    const r = dejarPieza(pr, c, m);
    if (!r.ok) { pintar(); return; }
    pr = r.pr;
    sonidoDejar();
    pantalla = "tienda";
    guardar();
    if (!algunoAlcanza(pr.visita.bolsa, listaCompra(), piezas())) terminar(true);
    else pintar();
    return;
  }
  if (act === "devolver" && !enGuia) {
    pr = devolverPieza(pr);
    pantalla = "tienda";
    guardar();
    pintar();
    return;
  }
}

function empezarGuia() {
  guia = guiaNueva();
  pantalla = "guia";
  dicho = "";
  salir = false;
  pintar();
}

function terminarGuia() {
  limpiarRelojGuia();
  guia = null;
  pasoConPausa = "";
  pausaToken += 1;
  guiaPausaHasta = 0;
  compraPausaHasta = Date.now() + GUIA_COMPRA_MS;
  pr = { ...pr, guia: true };
  guardar();
  pantalla = "inicio";
  dicho = "";
  pintar();
}

async function entrar() {
  if (cobrando) return;
  if (!debeCobrar(pr, hoy())) {
    pantalla = pr.visita.fase === "pagar" ? "pagar" : pr.visita.fase === "acomodar" ? "acomodar" : "tienda";
    if (pantalla === "pagar" && !pr.visita.ayudaDesde) pr.visita.ayudaDesde = Date.now();
    pintar();
    return;
  }
  if (saldo !== null && saldo < COSTO) { pantalla = "faltan"; dicho = ""; pintar(); return; }
  cobrando = true;
  const r = await Noli.gastar(COSTO, "mi-casita");
  cobrando = false;
  if (r.ok) {
    saldo = r.saldo;
    const ab = abiertos(pr.visitas, niveles);
    pr = { ...pr, visita: visitaNueva(hoy(), bolsaDe(ab.dinero, monedaId, bolsas), ab.cuartos[0]) };
    guardar();
    pantalla = "tienda";
    dicho = "";
    pintar();
    return;
  }
  if (typeof r.saldo === "number") saldo = r.saldo;
  pantalla = "faltan";
  dicho = "";
  pintar();
}

function terminar(vacio) {
  finNuevos = recienAbiertos(pr.visitas, niveles);
  finNuevos.vacio = vacio === true;
  pr = cerrarVisita(pr);
  guardar();
  pantalla = "fin";
  dicho = "";
  pintar();
}

function abrirSalir() {
  if (salir) return;
  salir = true;
  clearTimeout(relojPista);
  if (pantalla === "guia" && guia && relojConSalir(true) === "pausa") {
    pausaToken += 1;
    limpiarRelojGuia();
    callar();
  }
  pintar("seguir");
}

function cerrarDialogo() {
  salir = false;
  dialogCerroEn = Date.now();
  if (pantalla === "guia" && guia && relojConSalir(false, true) === "reinicio") pasoConPausa = "";
  pintar();
}

$main.addEventListener("click", (ev) => {
  const t = ev.target.closest("[data-act]");
  if (salir) {
    const enDialogo = !!ev.target.closest(".dialogo");
    if (!enDialogo && toqueEnVelo({ modo: modo(), enDialogo }) === "seguir") {
      cerrarDialogo();
      return;
    }
    if (t && $main.contains(t) && !t.disabled && (t.dataset.act === "seguir" || t.dataset.act === "salir")) {
      actuar(t.dataset.act, t.dataset);
    }
    return;
  }
  if (bloqueoTrasDialogo("toque")) return;
  if (pantalla === "guia" && guia && pausaGuiaActiva()) {
    if (t && t.dataset.act === "saltar") actuar("saltar", t.dataset);
    return;
  }
  if (compraPausaActiva()) return;
  if (pantalla === "guia" && guia && guiaAvanzaConToque(guia.paso)) {
    if (t && t.dataset.act === "saltar") { actuar("saltar", t.dataset); return; }
    avanzarMuestra("toque");
    return;
  }
  if (!t || t.disabled || !$main.contains(t)) return;
  if (t.dataset.act === "pagar" && pantalla === "guia" && !guiaPagarActivo(guia?.paso)) return;
  actuar(t.dataset.act, t.dataset);
});

Noli.alEntrar((accion) => {
  document.documentElement.classList.add("teclado");
  if (accion === "atras") {
    if (!salir && pantalla === "acomodar" && esTv() && pr.visita?.barra && teclaConBarra("atras") === "cerrar") {
      pr.visita = cerrarBarra(pr.visita);
      guardar();
      pintar("cuadricula");
      return true;
    }
    const donde = pantalla === "fin" || (pantalla === "guia" && guia && guia.paso === "fin") ? "fin" : pantalla;
    if (atrasEnPantalla(donde, salir) === "cerrar") { cerrarDialogo(); return true; }
    abrirSalir();
    return true;
  }
  if (salir) {
    const e = document.activeElement;
    const act = e && $main.contains(e) ? e.dataset.act : "";
    const que = teclaConDialogo(accion, act);
    if (que === "foco" && moverFoco(accion, $main)) return true;
    if ((que === "seguir" || que === "salir") && e && !e.disabled) e.click();
    return true;
  }
  if (accion === "ok" && bloqueoTrasDialogo("ok")) return true;
  const enLugar = pantalla === "acomodar" || (pantalla === "guia" && guia && guia.paso === "cuadro");
  const barraAbierta = !!(pr.visita && pr.visita.barra && pantalla === "acomodar" && esTv());
  if (barraAbierta && esFlecha(accion)) {
    const barra = $main.querySelector(".barra");
    const antes = document.activeElement;
    const estaba = !!(barra && barra.contains(antes));
    moverFoco(accion, barra || $main);
    const ahora = document.activeElement;
    const movio = estaba && !!(barra && barra.contains(ahora)) && ahora !== antes;
    if (teclaConBarra(accion, movio) === "foco") return true;
    pr.visita = cerrarBarra(pr.visita);
    actuar("mov", { dir: accion });
    return true;
  }
  if (enLugar && !barraAbierta && esFlecha(accion)) {
    actuar("mov", { dir: accion });
    return true;
  }
  if (pantalla === "acomodar" && esTv() && accion === "ok" && pr.visita && !pr.visita.barra) {
    pr.visita = abrirBarra(pr.visita);
    const m = porId()[pr.visita.mueble];
    const c = cuartoPor(m.cuarto);
    const f = formaDe(m, pr.visita.rot);
    const puede = cabe(c, pr.puestos, pr.visita.x, pr.visita.y, f.w, f.h);
    pintar(puede ? "dejar" : "girar");
    return true;
  }
  if (compraPausaActiva() && accion === "ok") return true;
  if (pantalla === "guia" && guia && accion === "ok") {
    if (pausaGuiaActiva()) return true;
    const e = document.activeElement;
    const act = e && $main.contains(e) ? e.dataset.act : "";
    const focoId = e && $main.contains(e) ? (e.dataset.focoId || "") : "";
    if (act === "saltar" && e && !e.disabled) { e.click(); return true; }
    const que = okDeGuia({ paso: guia.paso, focoId });
    if (que === "mostrar") { avanzarMuestra("ok"); return true; }
    if (que === "cuadro") {
      guia = aplicarGuia(guia, { tipo: "ok", modo: modo() }, piezas());
      if (guia.lista) { terminarGuia(); return true; }
      dicho = "";
      pintarGuia();
      return true;
    }
    if ((que === "escoger" || que === "moneda" || que === "pagar") && e && !e.disabled) {
      e.click();
      return true;
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
  document.documentElement.classList.remove("teclado");
  desbloquear();
}, true);

function leerJson(rel) {
  return fetch(new URL(rel, import.meta.url)).then((r) => r.json());
}

Promise.all([
  Noli.datos,
  Noli.creditos,
  leerJson("../datos/textos.json"),
  leerJson("../datos/muebles.json"),
  leerJson("../datos/cuartos.json"),
  leerJson("../datos/desbloqueos.json"),
  leerJson("../datos/bolsas.json"),
  cargarMoneda("usd"),
  cargarMoneda("mxn"),
  fetch(new URL("../arte/etiqueta-precio.svg", import.meta.url)).then((r) => r.text()),
  fetch(new URL("../arte/bolsa-monedas.svg", import.meta.url)).then((r) => r.text()),
]).then(([datos, creditos, tx, mj, cr, de, bo, usd, mxn, et, bol]) => {
  textos = tx;
  muebles = mj.muebles;
  cuartos = cr.cuartos;
  niveles = de.niveles;
  bolsas = bo;
  monedas = { usd, mxn };
  etiquetaSvg = et;
  bolsaSvg = bol;
  try { monedaId = monedaDeTienda((k) => localStorage.getItem(k)); } catch { monedaId = "usd"; }
  if (!monedas[monedaId]) monedaId = "usd";
  pr = cargar(datos, idx());
  saldo = typeof creditos === "number" ? creditos : null;
  if (!pr.guia) empezarGuia();
  else { pantalla = "inicio"; pintar(); }
}).catch(() => {
  $main.innerHTML = `<p class="aviso mal">No se pudo abrir la casita.</p>`;
});
