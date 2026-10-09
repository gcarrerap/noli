// Pantallas de Pizzería Partida. La lógica está en los otros módulos.
import { Noli, moverFoco, focoInicial } from "../../../kit/noli.js";
import { decir } from "./voz.js";
import { clic, listo as sonidoListo, feliz as sonidoFeliz, desbloquear } from "./sonido.js";
import { patron, lineasSvg, rebanadasDe, svgPila } from "./cortes.js";
import { svgFigura, nombreFigura } from "./figuras.js";
import { esCorrecto } from "./pedidos.js";
import { siguientePasoGuia, guiaTerminada, textoDeGuia, vozDeGuia, guiaAvanzaConToque, guiaServirActivo, focoDeGuia, toqueDuranteGuia, GUIA_TOQUE_MS } from "./guia.js";
import { fasePista, debeBrillar, cuentaParaDominio, hablaSegura, textoPista, glifoMas, glifoMenos, textoContador, vozContador, pistaVisible, IDLE_ENCIMA_MS, IDLE_COMPLETA_MS } from "./pista.js";
import { abiertos, recienAbierto } from "./deco.js";
import { ajustar, opcionesCuantos, bandejaLista, focoTrasContador, BANDEJA_MAX } from "./bandeja.js";
import {
  cargar, registrar, dominio, cerrarTurno, pedidoPara, planTurno, cumplirReto, racha,
  fechaLocal, semana, resumen, marcarGuia, textoRacha, VENTANA, nuevo as progresoNuevo,
} from "./progreso.js";
import { retoDelDia } from "./reto.js";
import { accionAtras, resolverAtras } from "./salida.js";

const $main = document.getElementById("juego");
const SVG_NS = "http://www.w3.org/2000/svg";
const rnd = Math.random;
const hoy = () => fechaLocal();
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const reducido = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const CLIENTES = ["gato", "oso", "robot"];

const cache = {};
let pr = progresoNuevo();
let textos = null;
let banco = null;
let pantalla = "inicio";
let partida = null;
let saliendo = false;
let token = 0;
let relojPista = 0;
let relojGuia = 0;
let focoAntes = null;
let focosGuardados = null;

try {
  if (new URLSearchParams(location.search).get("modo") === "tv") document.documentElement.dataset.modo = "tv";
} catch { /* abierto fuera del navegador */ }

function modoJuego() {
  return Noli.modo === "tv" || document.documentElement.dataset.modo === "tv" ? "tv" : "tactil";
}

function luego(fn, ms) {
  const t = ++token;
  setTimeout(() => { if (t === token && !saliendo) fn(); }, ms);
}

function arte(nombre) {
  return fetch(new URL(`../img/${nombre}.svg`, import.meta.url))
    .then((r) => r.text())
    .then((t) => { cache[nombre] = t; })
    .catch(() => { cache[nombre] = ""; });
}

function leerJson(ruta) {
  return fetch(new URL(ruta, import.meta.url)).then((r) => r.json());
}

function cargarTodo() {
  const piezas = ["pizza-redonda", "pizza-rectangular", "brownie", "hueco-brownie", "propina", "horno",
    "cliente-gato", "cliente-oso", "cliente-robot", "cliente-gato-feliz", "cliente-oso-feliz", "cliente-robot-feliz",
    "deco-letrero-1", "deco-letrero-2", "deco-mesa-1", "deco-mesa-2", "deco-horno-nuevo",
    "ingrediente-queso", "ingrediente-champinon", "ingrediente-pepperoni", "ingrediente-aceituna",
    "ingrediente-pimiento", "ingrediente-pina", "ingrediente-tomate"];
  return Promise.all([
    leerJson("../datos/textos.json"),
    leerJson("../datos/cortes.json"),
    ...piezas.map(arte),
  ]).then(([tx, co]) => { textos = tx; banco = co; });
}

function mostrar(html, nombre, focoId) {
  pantalla = nombre;
  $main.className = "p-" + nombre + (pr.ingles ? " con-ingles" : "") + (esGuia() ? " p-guia" : "");
  if (esGuia()) $main.dataset.paso = String(partida.paso);
  else delete $main.dataset.paso;
  $main.innerHTML = html;
  aplicarArte($main);
  pintarPizzas();
  const el = focoId && $main.querySelector(`[data-foco-id="${focoId}"]`);
  if (el) el.focus({ preventScroll: true });
  else focoInicial($main);
}

function aplicarArte(raiz) {
  for (const n of raiz.querySelectorAll("[data-svg]")) n.innerHTML = cache[n.dataset.svg] || "";
}

function renombrar(svg, suf) {
  return String(svg || "")
    .replace(/<\?xml[^>]*>/, "")
    .replace(/\sid="([^"]+)"/g, (_, id) => ` id="${id}-${suf}"`);
}

function pintarPizzas() {
  for (const el of $main.querySelectorAll("[data-patron]")) {
    const p = patron(banco, el.dataset.patron);
    if (!p) continue;
    const suf = el.dataset.suf || "p";
    const nombre = p.forma === "rectangular" ? "pizza-rectangular" : "pizza-redonda";
    el.innerHTML = renombrar(cache[nombre], suf);
    const svg = el.querySelector("svg");
    if (!svg) continue;
    const cortes = svg.querySelector("#cortes-" + suf);
    if (cortes) cortes.innerHTML = lineasSvg(p.cortes);
    const marcas = (el.dataset.marcas || "").split(",").filter((x) => x !== "");
    if (marcas.length) pintarToppings(svg, suf, p, marcas.map((x) => x === "1"), el.dataset.ing || "queso");
  }
  for (const el of $main.querySelectorAll("[data-pila]")) {
    const p = patron(banco, el.dataset.pila);
    if (p) el.innerHTML = svgPila(rebanadasDe(p));
  }
}

function pintarToppings(svg, suf, p, marcas, ing) {
  const caras = rebanadasDe(p);
  const alto = svg.querySelector("#resaltado-" + suf);
  const box = svg.querySelector("#ingredientes-" + suf);
  caras.forEach((cara, i) => {
    if (!marcas[i]) return;
    if (alto) {
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", cara.puntos.map((pt, k) => `${k ? "L" : "M"}${pt[0]} ${pt[1]}`).join("") + "Z");
      alto.appendChild(path);
    }
    if (box) box.appendChild(nodoIngrediente(svg, ing, cara.centro[0], cara.centro[1]));
  });
}

function nodoIngrediente(svg, id, x, y) {
  const g = document.createElementNS(SVG_NS, "g");
  g.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(1.15)`);
  const raw = cache["ingrediente-" + id] || "";
  try {
    const doc = new DOMParser().parseFromString(raw, "image/svg+xml");
    const nodo = doc.querySelector(".ingrediente") || doc.querySelector("svg > *");
    if (nodo) g.appendChild(svg.ownerDocument.importNode(nodo, true));
  } catch { /* sin ingrediente */ }
  return g;
}

const guardar = () => Noli.guardar(pr);
const elegido = () => Math.min(pr.elegido || pr.nivel, pr.nivel);
function hablar(texto) {
  if (!pr.voz) return;
  const limpio = hablaSegura(texto);
  if (limpio) decir(limpio, "es-MX");
}
function esGuia() { return !!(partida && partida.modo === "guia"); }
function visible() {
  const p = partida && partida.pedido;
  if (p && p.tipo === "doble") return p.pasos[partida.sub || 0];
  return p;
}
function nivelMeta(n) {
  return (textos.niveles || []).find((x) => x.n === n) || { n, nombre: "", ejemplo: "" };
}

const ESTRELLA = (on) => `<svg viewBox="0 0 24 24" class="${on ? "on" : "off"}" aria-hidden="true"><path d="M12 2.5l2.7 6.3 6.8.6-5.2 4.4 1.6 6.6L12 16.8 6.1 20.4l1.6-6.6L2.5 9.4l6.8-.6z"/></svg>`;
function estrellasHtml(n, grande) {
  return `<span class="estrellas${grande ? " grande" : ""}" aria-label="${n} de 3">${[0, 1, 2].map((i) => ESTRELLA(i < n)).join("")}</span>`;
}
const FLAMA = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1.5-4.5 3-6 0 2 1 3 2 3 0-3-1-6 1-9z" fill="#e8505b"/><path d="M12 13c.5 2 3 3 3 5.5a3 3 0 0 1-6 0c0-1.5 1-2.5 3-5.5z" fill="#ffc43d"/></svg>`;
const CHECK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>`;
const CANDADO = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2.5" fill="currentColor" opacity=".5"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>`;
const FLECHA = `<svg class="flecha" viewBox="0 0 24 28" aria-hidden="true"><path d="M12 2v14M6 12l6 10 6-10" fill="none" stroke="#e8505b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const PREGUNTA = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M9.2 9.2a2.8 2.8 0 1 1 3.6 2.7c-.7.4-1 1-1 2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1.15" fill="currentColor"/></svg>`;

function htmlDialogoSalir() {
  return `<div class="velo salir-velo"><div class="dialogo" role="dialog" aria-label="Salir">
    <p>${esc(textos.salirPregunta)}</p>
    <button type="button" class="boton grande primario" data-foco="inicial" data-foco-id="seguir-juego" data-act="ir" data-ir="seguir-juego">${esc(textos.seguir)}</button>
    <button type="button" class="boton grande" data-foco data-foco-id="salir-juego" data-act="ir" data-ir="salir-juego">${esc(textos.salir)}</button>
  </div></div>`;
}

function semanaHtml() {
  const dias = ["D", "L", "M", "M", "J", "V", "S"];
  return `<div class="semana" aria-label="Últimos 7 días">${semana(pr, hoy()).map((d) => {
    const [y, m, dd] = d.fecha.split("-").map(Number);
    const dia = dias[new Date(y, m - 1, dd).getDay()];
    return `<span class="dia ${d.reto ? "reto" : d.jugo ? "jugo" : ""}"><span class="punto">${d.reto ? CHECK : ""}</span>${dia}</span>`;
  }).join("")}</div>`;
}

function escena() {
  const tienen = new Set(abiertos(pr.propinas).map((a) => a.id));
  const letrero = tienen.has("letrero-2") ? "deco-letrero-2" : tienen.has("letrero-1") ? "deco-letrero-1" : "";
  const mesa = tienen.has("mesa-2") ? "deco-mesa-2" : tienen.has("mesa-1") ? "deco-mesa-1" : "";
  const horno = tienen.has("horno") ? "deco-horno-nuevo" : "horno";
  return `<div class="local" aria-label="Tu pizzería">
    <div class="local-letrero">${letrero ? `<span data-svg="${letrero}"></span>` : `<b>Pizzería</b>`}</div>
    <div class="local-sala">
      <span class="local-mesa">${mesa ? `<span data-svg="${mesa}"></span>` : ""}</span>
      <span class="local-horno" data-svg="${horno}"></span>
    </div>
  </div>`;
}

function inicio(focoId) {
  partida = null;
  const n = elegido();
  const dn = nivelMeta(n);
  const dm = dominio(pr, n);
  const reto = pr.retos[hoy()];
  mostrar(`
    <h1 class="titulo">${esc(textos.titulo)}</h1>
    <div class="inicio-layout">
      ${escena()}
      <div class="menu">
        <p class="sub">Nivel ${n}: ${esc(dn.nombre)}</p>
        <p class="propinas"><span class="moneda" data-svg="propina"></span><span>${esc(String(textos.propinas).replace("{n}", String(pr.propinas)))}</span></p>
        ${dm.listo || pr.niveles[n]?.dominado ? `<p class="dominio ok">${esc(textos.dominas)}</p>` : `<div class="dominio"><div class="barra"><i style="width:${Math.round((100 * dm.intentos) / VENTANA)}%"></i></div><small>${esc(String(textos.paraVer).replace("{n}", String(dm.intentos)))}</small></div>`}
        <button type="button" class="boton grande primario" data-foco="inicial" data-foco-id="jugar" data-act="ir" data-ir="ronda">${esc(textos.jugar)}</button>
        <button type="button" class="boton grande ${reto?.cumplido ? "hecho" : "reto"}" data-foco data-foco-id="reto" data-act="ir" data-ir="retoIntro">${esc(textos.reto)} <small>${reto?.cumplido ? "Cumplido" : "Te espera"}</small></button>
        <button type="button" class="boton grande" data-foco data-foco-id="progreso" data-act="ir" data-ir="progreso">${esc(textos.progreso)}</button>
        <div class="menu fila chica">
          <button type="button" class="boton" data-foco data-foco-id="como" data-act="ir" data-ir="guia"><span class="con-ico">${PREGUNTA} ${esc(textos.como)}</span></button>
          <button type="button" class="boton" data-foco data-foco-id="voz" data-act="ir" data-ir="voz">${esc(pr.voz ? textos.vozOn : textos.vozOff)}</button>
          <button type="button" class="boton" data-foco data-foco-id="ingles" data-act="ir" data-ir="ingles">${esc(pr.ingles ? textos.inglesOn : textos.inglesOff)}</button>
        </div>
      </div>
    </div>
    <p class="racha">${FLAMA}<span>${esc(textoRacha(racha(pr, hoy()), textos))}</span></p>`, "inicio", focoId);
}

function nuevaRonda() {
  if (!pr.guiaHecha) return empezarGuia("ronda");
  const n = elegido();
  const plan = planTurno(pr, n, rnd);
  partida = {
    modo: "turno", n, lista: plan.map((x) => pedidoPara(pr, x.nivel, rnd, banco, textos, { repaso: x.repaso })),
    i: 0, aciertos: 0,
  };
  cargarPedido();
}

function empezarGuia(destino) {
  partida = { modo: "guia", destino, paso: 0, pedido: { tipo: "guia", nivel: 1 }, i: 0, aciertos: 0 };
  pintarGuia();
  hablar(vozDeGuia(0, textos, modoJuego()));
}

function terminarGuia() {
  const destino = partida && partida.destino;
  limpiarRelojGuia();
  pr = marcarGuia(pr);
  guardar();
  partida = null;
  if (destino === "ronda") nuevaRonda();
  else inicio();
}

function limpiarRelojGuia() {
  clearTimeout(relojGuia);
  relojGuia = 0;
}

function programarGuia() {
  if (!esGuia() || saliendo || !guiaAvanzaConToque(partida.paso)) {
    if (!esGuia() || !guiaAvanzaConToque(partida.paso)) limpiarRelojGuia();
    return;
  }
  if (relojGuia) return;
  const paso = partida.paso;
  relojGuia = setTimeout(() => {
    relojGuia = 0;
    if (saliendo || !esGuia() || partida.paso !== paso) return;
    aplicarPasoGuia(siguientePasoGuia(paso, { tipo: "tiempo" }));
  }, GUIA_TOQUE_MS);
}

function pintarGuia() {
  const paso = partida.paso;
  const modo = modoJuego();
  const foco = focoDeGuia(paso);
  const senala = paso === 1 ? "mala" : paso >= 2 ? "buena" : "";
  mostrar(`
    <header class="cab"><span>${esc(textos.guiaTitulo)}</span>
      <button type="button" class="saltar" data-foco data-foco-id="saltar" data-act="ir" data-ir="saltar-guia">${esc(textos.saltar)}</button>
    </header>
    <p class="pedido guia-texto" data-foco${foco === "pedido-guia" ? '="inicial"' : ""} data-foco-id="pedido-guia" tabindex="0">${esc(textoDeGuia(paso, textos, modo))}</p>
    <div class="opciones guia-opciones">
      ${["mala", "buena"].map((op) => `<button type="button" class="opcion${senala === op ? " senala" : ""}" data-op="${op}" data-act="guia" data-foco${foco === op ? '="inicial"' : ""} data-foco-id="${op}">
        ${senala === op ? `<span class="apunta">${FLECHA}</span>` : ""}
        <span class="pizza" data-patron="guia-${op}" data-suf="${op}"></span>
      </button>`).join("")}
    </div>
    <p class="pista"></p>
    <p class="aviso" aria-live="polite"></p>`, "guia", foco);
  programarGuia();
}

function aplicarPasoGuia(paso) {
  if (!partida || paso === partida.paso) return;
  limpiarRelojGuia();
  partida.paso = paso;
  if (guiaTerminada(paso)) return terminarGuia();
  pintarGuia();
  hablar(vozDeGuia(paso, textos, modoJuego()));
}

function guiaActivar(op) {
  if (op === "buena" && !guiaServirActivo(partida.paso)) return;
  aplicarPasoGuia(siguientePasoGuia(partida.paso, { tipo: "activar", opcion: op }));
}

function cargarPedido() {
  const p = partida.lista[partida.i];
  partida.pedido = p;
  partida.sub = 0;
  partida.anotado = false;
  partida.limpio = true;
  partida.revelado = false;
  partida.resuelto = false;
  prepararVisible();
  pintar();
  hablarPedido();
  programarPista();
}

function hablarPedido() {
  const p = visible();
  if (!p) return;
  if (p.tipo === "bandeja" && partida.fase !== "cuantos") hablar(`${p.leer} ${vozContador(modoJuego())}`);
  else hablar(p.leer);
}

function prepararVisible() {
  const p = visible();
  partida.marcas = Array(p.partes || 0).fill(false);
  partida.filasHechas = 1;
  partida.columnasHechas = 1;
  partida.fase = p.tipo === "bandeja" ? "armar" : null;
  partida.intento = 1;
  partida.fallo = false;
  partida.vioCompleta = false;
  partida.idleDesde = Date.now();
  partida.anuncio = false;
  partida.opsCuantos = null;
  partida.clienteFeliz = false;
  partida.aviso = "";
}

function faseActual() {
  const p = visible();
  if (!p || partida.revelado || partida.resuelto) return "frase";
  return fasePista({
    nivel: p.nivel, tipo: p.tipo,
    ms: Date.now() - (partida.idleDesde || Date.now()),
    fallo: !!partida.fallo,
  });
}

function clienteNombre() {
  return CLIENTES[(partida.i || 0) % CLIENTES.length];
}

function pintar(focoId) {
  if (esGuia()) return pintarGuia();
  const p = visible();
  const fase = faseActual();
  const linea = lineaPista(p, fase);
  if (fase === "completa" && linea && p.nivel > 1 && (p.tipo === "corta" || p.tipo === "decora" || p.tipo === "bandeja")) partida.vioCompleta = true;
  const puntos = `<span class="puntos">${Array.from({ length: partida.lista.length }, (_, k) => `<i class="${k < partida.i ? "lleno" : ""}"></i>`).join("")}</span>`;
  const doble = partida.pedido.tipo === "doble" ? `<p class="sub">${esc(String(textos.parte).replace("{n}", String((partida.sub || 0) + 1)))}</p>` : "";
  mostrar(`
    <header class="cab"><span>Nivel ${p.nivel} · ${esc(nivelMeta(p.nivel).nombre)}</span>${puntos}</header>
    <div class="comanda">
      <span class="cliente" data-svg="cliente-${clienteNombre()}${partida.clienteFeliz ? "-feliz" : ""}"></span>
      <div>
        ${doble}
        <p class="pedido">${esc(partida.fase === "cuantos" ? textos.cuantos : p.texto)}</p>
        ${p.nota ? `<p class="nota-reloj">${esc(p.nota)}</p>` : ""}
      </div>
    </div>
    <div class="zona">${cuerpo(p, fase)}</div>
    <p class="pista">${esc(linea)}</p>
    <p class="aviso" aria-live="polite">${esc(partida.aviso || "")}</p>`, "pedido", focoId || focoPorDefecto(p));
  programarPista();
}

function lineaPista(p, fase) {
  if (!p) return "";
  let texto = "";
  if (partida.fase === "cuantos") texto = "";
  else if (p.tipo === "bandeja" && bandejaLista(partida.filasHechas, partida.columnasHechas, p)) texto = "";
  else if (p.tipo === "decora" && listoDecora()) texto = "";
  else texto = textoPista(p, fase, textos, modoJuego());
  return pistaVisible(texto, { resuelto: !!partida.resuelto, revelado: !!partida.revelado });
}

function focoPorDefecto(p) {
  if (partida.revelado) return "seguir-resp";
  if (p.tipo === "decora" && debeBrillar("decora", listoDecora())) return "servir";
  if (p.tipo === "bandeja" && partida.fase !== "cuantos" && debeBrillar("bandeja", bandejaLista(partida.filasHechas, partida.columnasHechas, p))) return "listo";
  if (p.tipo === "forma" || p.tipo === "corta" || p.tipo === "entero" || p.tipo === "mayor") return "op-0";
  if (p.tipo === "bandeja" && partida.fase === "cuantos") return "num-0";
  if (p.tipo === "decora") return "reb-0";
  return "filas";
}

function cuerpo(p, fase) {
  if (partida.fase === "cuantos") return htmlCuantos(p);
  if (p.tipo === "corta") return htmlCorta(p, fase);
  if (p.tipo === "forma") return htmlForma(p, fase);
  if (p.tipo === "decora") return htmlDecora(p, fase);
  if (p.tipo === "bandeja") return htmlBandeja(p, fase);
  if (p.tipo === "entero") return htmlEntero(p);
  if (p.tipo === "mayor") return htmlMayor(p);
  return "";
}

function htmlCorta(p, fase) {
  return `<div class="opciones">${p.opciones.map((id, i) => {
    const buena = fase === "completa" && id === p.correcta && !partida.revelado;
    const revelada = partida.revelado && id === p.correcta;
    return `<button type="button" class="opcion${revelada ? " revelada" : ""}" data-foco${i === 0 ? '="inicial"' : ""} data-foco-id="op-${i}" data-act="opcion" data-id="${esc(id)}">
      ${buena ? `<span class="apunta">${FLECHA}</span>` : ""}
      <span class="pizza" data-patron="${esc(id)}" data-suf="c${i}"></span>
      ${fase === "encima" || fase === "completa" ? `<span class="pila" data-pila="${esc(id)}"></span>` : ""}
    </button>`;
  }).join("")}</div>`;
}

function htmlForma(p, fase) {
  const contar = fase === "completa";
  return `<div class="opciones">${p.opciones.map((o, i) => {
    const nom = nombreFigura(o.tipo, textos);
    const revelada = partida.revelado && o.id === p.correcta;
    return `<button type="button" class="opcion galleta${revelada ? " revelada" : ""}" data-foco${i === 0 ? '="inicial"' : ""} data-foco-id="op-${i}" data-act="opcion" data-id="${esc(o.id)}">
      ${svgFigura(o, { contar, modo: p.pide })}
      <span class="nom">${esc(nom.es)}</span>
      <span class="en">${esc(nom.en)}</span>
    </button>`;
  }).join("")}</div>`;
}

function listoDecora() {
  return partida.marcas.filter(Boolean).length === visible().cuantas;
}

function htmlDecora(p, fase) {
  const marcas = partida.marcas.map((m) => (m ? "1" : "0")).join(",");
  const brilla = debeBrillar("decora", listoDecora());
  const conFlecha = (fase === "encima" || fase === "completa") && !brilla;
  const iFlecha = Math.max(0, partida.marcas.findIndex((m) => !m));
  return `<div class="decora">
    <span class="pizza grande" data-patron="${esc(p.patron)}" data-suf="d" data-marcas="${marcas}" data-ing="${esc(p.ingrediente)}"></span>
    <div class="rebanadas">
      ${partida.marcas.map((m, i) => `<button type="button" class="reb${m ? " puesta" : ""}" data-foco${i === 0 && !brilla ? '="inicial"' : ""} data-foco-id="reb-${i}" data-act="rebanada" data-i="${i}" aria-label="Rebanada ${i + 1}">${conFlecha && i === iFlecha ? `<span class="apunta">${FLECHA}</span>` : ""}${i + 1}</button>`).join("")}
    </div>
    <button type="button" class="enviar${brilla ? " listo" : ""}" ${brilla ? `data-foco="inicial" data-act="servir"` : "disabled"} data-foco-id="servir">${esc(textos.servir)}</button>
  </div>`;
}

function htmlBandeja(p, fase) {
  const f = partida.filasHechas, c = partida.columnasHechas;
  const brilla = debeBrillar("bandeja", bandejaLista(f, c, p));
  const modo = modoJuego();
  const mas = glifoMas(modo), menos = glifoMenos(modo);
  const celdasHtml = Array.from({ length: f * c }, () => `<img alt="" src="img/brownie.svg">`).join("");
  const eje = f !== p.filas ? "filas" : c !== p.columnas ? "columnas" : "";
  const hacia = eje === "filas" ? (f < p.filas ? 1 : -1) : eje === "columnas" ? (c < p.columnas ? 1 : -1) : 0;
  const conFlecha = (fase === "encima" || fase === "completa") && !!eje;
  const flecha = (cual, dir) => (conFlecha && eje === cual && dir === hacia ? `<span class="apunta">${FLECHA}</span>` : "");
  return `<div class="bandeja">
    <div class="parrilla" style="grid-template-columns:repeat(${c}, var(--celda))">${celdasHtml}</div>
    <div class="pasos">
      <div class="step" data-foco data-foco-id="filas" data-grupo="filas" tabindex="0">
        <span class="etiq">${esc(textos.filas)}</span>
        <button type="button" data-act="filas" data-dir="-1" aria-label="${esc(textos.menosFilas)}" ${f <= 1 ? "disabled" : ""}>${flecha("filas", -1)}${menos}</button>
        <b>${f}</b>
        <button type="button" data-act="filas" data-dir="1" aria-label="${esc(textos.masFilas)}" ${f >= BANDEJA_MAX ? "disabled" : ""}>${flecha("filas", 1)}${mas}</button>
      </div>
      <div class="step" data-foco data-foco-id="columnas" data-grupo="columnas" tabindex="0">
        <span class="etiq">${esc(textos.columnas)}</span>
        <button type="button" data-act="columnas" data-dir="-1" aria-label="${esc(textos.menosColumnas)}" ${c <= 1 ? "disabled" : ""}>${flecha("columnas", -1)}${menos}</button>
        <b>${c}</b>
        <button type="button" data-act="columnas" data-dir="1" aria-label="${esc(textos.masColumnas)}" ${c >= BANDEJA_MAX ? "disabled" : ""}>${flecha("columnas", 1)}${mas}</button>
      </div>
    </div>
    <button type="button" class="enviar${brilla ? " listo" : ""}" ${brilla ? `data-foco="inicial" data-act="listo"` : "disabled"} data-foco-id="listo">${esc(textos.listo)}</button>
  </div>`;
}

function htmlCuantos(p) {
  const ops = partida.opsCuantos || [];
  const filas = [];
  for (let f = 0; f < p.filas; f++) {
    const browns = Array.from({ length: p.columnas }, () => `<img alt="" src="img/brownie.svg">`).join("");
    filas.push(`<div class="fila-cuenta"><div class="parrilla mini" style="grid-template-columns:repeat(${p.columnas}, var(--celda))">${browns}</div><b class="prende" style="animation-delay:${f * 0.45}s">${p.cuenta[f]}</b></div>`);
  }
  return `<div class="cuantos">${filas.join("")}
    <div class="opciones numeros">${ops.map((n, i) => `<button type="button" class="boton grande" data-foco${i === 0 ? '="inicial"' : ""} data-foco-id="num-${i}" data-act="cuantos" data-n="${n}">${n}</button>`).join("")}</div>
  </div>`;
}

function htmlEntero(p) {
  return `<div class="opciones numeros">${p.opciones.map((o, i) => `<button type="button" class="boton grande${partida.revelado && o.id === p.correcta ? " revelada" : ""}" data-foco${i === 0 ? '="inicial"' : ""} data-foco-id="op-${i}" data-act="opcion" data-id="${esc(o.id)}">${esc(o.texto)}</button>`).join("")}</div>`;
}

function htmlMayor(p) {
  return `<div class="opciones">${p.opciones.map((o, i) => {
    const id = o.id === "tercio" ? "redonda-tercios" : "redonda-cuartos";
    const revelada = partida.revelado && o.id === p.correcta;
    return `<button type="button" class="opcion${revelada ? " revelada" : ""}" data-foco${i === 0 ? '="inicial"' : ""} data-foco-id="op-${i}" data-act="opcion" data-id="${esc(o.id)}">
      <span class="pizza" data-patron="${id}" data-suf="m${i}"></span>
      <span class="nom">${esc(o.texto)}</span>
    </button>`;
  }).join("")}</div>`;
}

function aviso(t) {
  partida.aviso = t || "";
  const a = $main.querySelector(".aviso");
  if (a) a.textContent = partida.aviso;
}

function anotar(ok) {
  if (!partida || partida.modo !== "turno" || partida.anotado) return;
  const p = visible();
  if (ok && !cuentaParaDominio({ nivel: p.nivel, tipo: p.tipo, vioCompleta: partida.vioCompleta })) return;
  partida.anotado = true;
  pr = registrar(pr, p.nivel, ok, hoy());
  guardar();
  if (ok) partida.aciertos++;
}

function resolver(ok) {
  if (partida.pedido.tipo === "doble") return resolverDoble(ok);
  if (ok && partida.intento === 1) {
    anotar(true);
    return celebrar();
  }
  if (partida.intento === 1) {
    anotar(false);
    partida.intento = 2;
    partida.fallo = true;
    partida.idleDesde = Date.now();
    pintar(focoPorDefecto(visible()));
    aviso(textos.confundido);
    return;
  }
  revelar();
}

function resolverDoble(ok) {
  const ultimo = partida.sub >= partida.pedido.pasos.length - 1;
  if (!ok && partida.intento === 1) {
    partida.limpio = false;
    partida.intento = 2;
    partida.fallo = true;
    pintar();
    aviso(textos.confundido);
    return;
  }
  if (!ok) partida.limpio = false;
  if (!ultimo) {
    partida.sub++;
    prepararVisible();
    pintar();
    hablarPedido();
    return;
  }
  if (ok && partida.limpio && partida.intento === 1) partida.aciertos++;
  celebrar();
}

function celebrar() {
  partida.resuelto = true;
  partida.clienteFeliz = true;
  sonidoFeliz();
  pintar(focoPorDefecto(visible()));
  aviso(textos.queRico);
  luego(avanzar, 750);
}

function revelar() {
  partida.revelado = true;
  partida.resuelto = true;
  const p = visible();
  if (p.tipo === "decora") {
    partida.marcas = partida.marcas.map((_, i) => i < p.cuantas);
  }
  if (p.tipo === "bandeja") {
    partida.filasHechas = p.filas;
    partida.columnasHechas = p.columnas;
    partida.fase = "armar";
  }
  pintar("seguir-resp");
  aviso(textos.asiEra);
  const zona = $main.querySelector(".zona");
  if (zona && !$main.querySelector('[data-foco-id="seguir-resp"]')) {
    zona.insertAdjacentHTML("beforeend", `<button type="button" class="boton primario" data-foco="inicial" data-foco-id="seguir-resp" data-act="ir" data-ir="avanzar">${esc(textos.seguir)}</button>`);
    const b = $main.querySelector('[data-foco-id="seguir-resp"]');
    if (b) b.focus({ preventScroll: true });
  }
}

function elegirOpcion(id) {
  if (!partida || partida.revelado || partida.resuelto) return;
  const p = visible();
  clic();
  resolver(esCorrecto(p, id));
}

function alternarRebanada(i) {
  if (!partida || partida.revelado || partida.resuelto) return;
  const p = visible();
  if (p.tipo !== "decora") return;
  partida.marcas[i] = !partida.marcas[i];
  partida.idleDesde = Date.now();
  const n = partida.marcas.filter(Boolean).length;
  const listo = n === p.cuantas;
  const era = partida.anuncio;
  partida.anuncio = listo;
  if (listo && !era) sonidoListo();
  pintar(listo && !era ? "servir" : "reb-" + i);
  if (n) hablar(textos.cuenta.slice(1, n + 1).join(", "));
}

function servir() {
  if (!partida || partida.revelado || partida.resuelto) return;
  if (!listoDecora()) return;
  const p = visible();
  resolver(esCorrecto(p, partida.marcas.filter(Boolean).length));
}

function cambiarMedida(cual, dir) {
  if (!partida || partida.fase === "cuantos" || partida.revelado) return;
  const clave = cual === "filas" ? "filasHechas" : "columnasHechas";
  const antes = partida[clave];
  partida[clave] = ajustar(antes, dir);
  if (partida[clave] === antes) return;
  partida.idleDesde = Date.now();
  clic();
  const p = visible();
  const listo = bandejaLista(partida.filasHechas, partida.columnasHechas, p);
  const era = partida.anuncio;
  partida.anuncio = listo;
  if (listo && !era) sonidoListo();
  const siguiente = focoTrasContador(cual, { filas: partida.filasHechas, columnas: partida.columnasHechas }, p);
  pintar(listo && !era ? "listo" : siguiente);
}

function confirmarBandeja() {
  if (!partida || partida.revelado || partida.resuelto) return;
  const p = visible();
  if (partida.fase === "cuantos") return;
  if (!bandejaLista(partida.filasHechas, partida.columnasHechas, p)) return;
  partida.fase = "cuantos";
  partida.opsCuantos = opcionesCuantos(p.filas, p.columnas, rnd);
  partida.idleDesde = Date.now();
  pintar("num-0");
  hablar(`${textos.cuantos} ${p.cuenta.map((n) => textos.numeros[n] || String(n)).join(", ")}`);
}

function elegirCuantos(n) {
  if (!partida || partida.revelado) return;
  const p = visible();
  const ok = n === p.total;
  if (ok) {
    if (partida.intento === 1) anotar(true);
    return celebrar();
  }
  if (partida.intento === 1) {
    anotar(false);
    partida.intento = 2;
    pintar("num-0");
    aviso(textos.confundido);
    return;
  }
  partida.revelado = true;
  partida.resuelto = true;
  pintar("num-0");
  aviso(`${textos.asiEra} ${p.total}`);
  luego(avanzar, 900);
}

function avanzar() {
  if (!partida) return;
  partida.i++;
  if (partida.i >= partida.lista.length) {
    if (partida.modo === "turno") return finTurno();
    return finReto();
  }
  cargarPedido();
}

function finTurno() {
  const antes = pr.propinas;
  const n = partida.n;
  const r = cerrarTurno(pr, n, partida.aciertos);
  pr = r.pr;
  guardar();
  Noli.terminar({ estrellas: r.estrellas });
  const nuevas = recienAbierto(antes, pr.propinas);
  mostrar(`
    <h1 class="titulo">${esc(textos.fin[r.estrellas] || textos.fin[0])}</h1>
    ${estrellasHtml(r.estrellas, true)}
    <p class="sub">${esc(String(textos.aLaPrimera).replace("{a}", String(partida.aciertos)).replace("{n}", String(partida.lista.length)))}</p>
    <span class="cliente grande" data-svg="cliente-${clienteNombre()}-feliz"></span>
    ${r.subio ? `<div class="subio"><b>${esc(String(textos.subiste).replace("{n}", String(r.subio)))}</b><span>${esc(nivelMeta(r.subio).nombre)}</span></div>` : ""}
    ${nuevas.length ? `<p class="sub">${esc(String(textos.nuevaDeco).replace("{nombre}", nuevas.map((a) => a.nombre).join(" y ")))}</p>` : ""}
    <div class="menu fila">
      <button type="button" class="boton grande primario" data-foco="inicial" data-act="ir" data-ir="ronda">${esc(r.subio ? textos.nivelNuevo : textos.otro)}</button>
      <button type="button" class="boton grande" data-foco data-act="ir" data-ir="inicio">${esc(textos.casa)}</button>
    </div>`, "fin");
  partida = null;
}

function retoIntro() {
  const reto = retoDelDia(hoy(), pr.nivel, banco, textos);
  const hecho = pr.retos[hoy()];
  mostrar(`
    <h1 class="titulo">${esc(textos.reto)}</h1>
    <div class="tarjeta-reto"><b>${esc(reto.nombre)}</b><p>${esc(reto.meta)}</p>
      ${hecho ? `<p>${esc(hecho.cumplido ? textos.yaCumplido : textos.todaviaNo)}</p>` : ""}
    </div>
    <div class="menu fila">
      <button type="button" class="boton grande primario" data-foco="inicial" data-act="ir" data-ir="retoJugar">${esc(textos.empezar)}</button>
      <button type="button" class="boton grande" data-foco data-act="ir" data-ir="inicio">${esc(textos.casa)}</button>
    </div>
    <p class="racha">${FLAMA}<span>${esc(textoRacha(racha(pr, hoy()), textos))}</span></p>
    ${semanaHtml()}`, "retoIntro");
}

function retoJugar() {
  const reto = retoDelDia(hoy(), pr.nivel, banco, textos);
  partida = { modo: "reto", n: reto.n, reto, lista: reto.problemas, i: 0, aciertos: 0 };
  cargarPedido();
}

function finReto() {
  const r = partida.reto;
  const puntos = partida.aciertos;
  const cumplido = puntos >= r.necesita;
  const antes = !!pr.retos[hoy()]?.cumplido;
  pr = cumplirReto(pr, hoy(), r.tipo, puntos, cumplido);
  guardar();
  if (cumplido && !antes) Noli.terminar({ estrellas: 3, reto: true });
  mostrar(`
    <h1 class="titulo">${esc(cumplido ? textos.retoCumplido : textos.casi)}</h1>
    <p class="sub">${puntos} de ${r.cuantos}. ${esc(r.meta)}</p>
    ${cumplido && !antes ? `<p class="racha grande">${FLAMA}<span>${esc(textoRacha(racha(pr, hoy()), textos))}</span></p>` : ""}
    <div class="menu fila">
      <button type="button" class="boton grande primario" data-foco="inicial" data-act="ir" data-ir="${cumplido ? "inicio" : "retoJugar"}">${esc(cumplido ? textos.casa : textos.otraVez)}</button>
      ${cumplido ? "" : `<button type="button" class="boton grande" data-foco data-act="ir" data-ir="inicio">${esc(textos.casa)}</button>`}
    </div>
    ${semanaHtml()}`, "finReto");
  partida = null;
}

function progreso() {
  const niveles = textos.niveles;
  mostrar(`
    <h1 class="titulo">${esc(textos.progreso)}</h1>
    <p class="racha">${FLAMA}<span>${esc(textoRacha(racha(pr, hoy()), textos))}</span></p>
    ${semanaHtml()}
    <ol class="mapa">${niveles.map((x) => {
      const nv = pr.niveles[x.n];
      const abierto = x.n <= pr.nivel;
      const dm = dominio(pr, x.n);
      const estado = nv?.dominado ? estrellasHtml(nv.estrellas || 0) : abierto ? `<span>${dm.intentos} de ${VENTANA}</span>` : CANDADO;
      return `<li><button type="button" class="nivel ${nv?.dominado ? "dominado" : abierto ? "abierto" : "cerrado"}${x.n === elegido() ? " actual" : ""}" ${abierto ? `data-foco${x.n === elegido() ? '="inicial"' : ""} data-act="ir" data-ir="elegir" data-n="${x.n}"` : "disabled"}>
        <b class="num">${x.n}</b><span class="nom">${esc(x.nombre)}<small>${esc(x.ejemplo)}</small></span>${estado}</button></li>`;
    }).join("")}</ol>
    <div class="menu fila">
      <button type="button" class="boton" data-foco data-act="ir" data-ir="inicio">${esc(textos.casa)}</button>
      <button type="button" class="boton" data-foco data-act="ir" data-ir="guia">${esc(textos.como)}</button>
      <button type="button" class="boton" data-foco data-act="ir" data-ir="papas">${esc(textos.papas)}</button>
    </div>`, "progreso");
}

function papas() {
  const R = resumen(pr, textos.niveles);
  mostrar(`
    <h1 class="titulo">${esc(textos.papas)}</h1>
    <p class="nota">${esc(textos.papasNota)}</p>
    <table class="tabla"><thead><tr><th>Nivel</th><th>Pedidos</th><th>A la primera</th></tr></thead><tbody>
      ${R.filter((x) => x.desbloqueado || x.total).map((x) => `<tr><td>${x.n}. ${esc(x.nombre)}</td><td>${x.total}</td><td>${x.pct == null ? "–" : x.pct + " %"}</td></tr>`).join("")}
    </tbody></table>
    <div class="menu fila"><button type="button" class="boton" data-foco="inicial" data-act="ir" data-ir="progreso">${esc(textos.regresar)}</button></div>`, "papas");
}

function programarPista() {
  clearTimeout(relojPista);
  relojPista = 0;
  if (saliendo || !partida || esGuia() || partida.revelado || partida.resuelto) return;
  const p = visible();
  if (!p || (p.nivel | 0) <= 1) return;
  if (p.tipo !== "corta" && p.tipo !== "decora" && p.tipo !== "bandeja") return;
  if (p.tipo === "bandeja" && (partida.fase === "cuantos" || bandejaLista(partida.filasHechas, partida.columnasHechas, p))) return;
  if (p.tipo === "decora" && listoDecora()) return;
  const ms = Date.now() - (partida.idleDesde || Date.now());
  let espera = 0;
  if (ms < IDLE_ENCIMA_MS) espera = IDLE_ENCIMA_MS - ms;
  else if (ms < IDLE_COMPLETA_MS) espera = IDLE_COMPLETA_MS - ms;
  else return;
  const foco = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.focoId;
  relojPista = setTimeout(() => {
    if (saliendo || !partida) return;
    pintar(foco || undefined);
  }, espera + 40);
}

function abrirSalir() {
  if (saliendo) return;
  token++;
  clearTimeout(relojPista);
  limpiarRelojGuia();
  focoAntes = document.activeElement;
  focosGuardados = [...$main.querySelectorAll("[data-foco]")].map((el) => ({ el, valor: el.getAttribute("data-foco") }));
  for (const item of focosGuardados) item.el.removeAttribute("data-foco");
  saliendo = true;
  $main.insertAdjacentHTML("beforeend", htmlDialogoSalir());
  const seguir = $main.querySelector('[data-foco-id="seguir-juego"]');
  if (seguir) seguir.focus({ preventScroll: true });
}

function cerrarSalir(ySalir) {
  const velo = $main.querySelector(".salir-velo");
  if (velo) velo.remove();
  saliendo = false;
  if (focosGuardados) {
    for (const item of focosGuardados) {
      if (item.el.isConnected) item.el.setAttribute("data-foco", item.valor == null ? "" : item.valor);
    }
    focosGuardados = null;
  }
  if (ySalir) { Noli.salir(); return; }
  if (partida && partida.resuelto && !esGuia()) { avanzar(); return; }
  const volver = focoAntes && focoAntes.isConnected && $main.contains(focoAntes) && focoAntes.dataset.focoId !== "saltar";
  if (volver) focoAntes.focus({ preventScroll: true });
  else focoInicial($main);
  programarPista();
  programarGuia();
}

const IR = {
  inicio: () => inicio(),
  ronda: nuevaRonda,
  retoIntro, retoJugar,
  progreso, papas,
  guia: () => empezarGuia("inicio"),
  "saltar-guia": terminarGuia,
  "seguir-juego": () => cerrarSalir(false),
  "salir-juego": () => cerrarSalir(true),
  avanzar,
  voz: () => { pr = { ...pr, voz: !pr.voz }; guardar(); inicio("voz"); },
  ingles: () => { pr = { ...pr, ingles: !pr.ingles }; guardar(); inicio("ingles"); },
  elegir: (ds) => { pr = { ...pr, elegido: +ds.n }; guardar(); inicio(); },
};

$main.addEventListener("click", (ev) => {
  const t = ev.target.closest("[data-act]");
  const ir = (t && t.dataset.ir) || "";
  if (saliendo) {
    const efecto = toqueDuranteGuia(esGuia() ? partida.paso : 0, { dialogoAbierto: true, ir });
    if (efecto.accion === "seguir") cerrarSalir(false);
    else if (efecto.accion === "salir") cerrarSalir(true);
    return;
  }
  if (esGuia()) {
    const efecto = toqueDuranteGuia(partida.paso, { dialogoAbierto: false, ir });
    if (efecto.accion === "nada") return;
    if (efecto.accion === "seguir") { cerrarSalir(false); return; }
    if (efecto.accion === "salir") { cerrarSalir(true); return; }
    if (efecto.accion === "saltar") { terminarGuia(); return; }
    if (efecto.accion === "avanzar") {
      aplicarPasoGuia(siguientePasoGuia(partida.paso, { tipo: "toque" }));
      return;
    }
  }

  if (!t || !$main.contains(t)) return;
  if (t.disabled) return;
  const act = t.dataset.act;
  if (act === "guia") guiaActivar(t.dataset.op);
  else if (act === "opcion") elegirOpcion(t.dataset.id);
  else if (act === "rebanada") alternarRebanada(+t.dataset.i);
  else if (act === "servir") servir();
  else if (act === "filas" || act === "columnas") cambiarMedida(act, +t.dataset.dir);
  else if (act === "listo") confirmarBandeja();
  else if (act === "cuantos") elegirCuantos(+t.dataset.n);
  else if (act === "ir" && IR[t.dataset.ir]) IR[t.dataset.ir](t.dataset);
});

Noli.alEntrar((accion) => {
  document.documentElement.classList.add("teclado");
  if (accion === "atras") {
    if (resolverAtras(saliendo) === "cerrar") { cerrarSalir(false); return true; }
    const que = accionAtras(pantalla);
    if (que === "progreso") progreso();
    else if (que === "inicio") inicio();
    else abrirSalir();
    return true;
  }
  if (saliendo) {
    if (moverFoco(accion, $main)) return true;
    if (accion === "ok") {
      const e = document.activeElement;
      if (e && $main.contains(e) && !e.disabled) e.click();
    }
    return true;
  }
  if (esGuia()) {
    if (accion === "ok") {
      const e = document.activeElement;
      const id = e && e.dataset && e.dataset.focoId;
      if (id === "saltar" && e && !e.disabled) { e.click(); return true; }
      if (guiaAvanzaConToque(partida.paso)) {
        aplicarPasoGuia(siguientePasoGuia(partida.paso, { tipo: "ok" }));
        return true;
      }
      const op = e && e.dataset && e.dataset.op;
      if (op && !e.disabled) guiaActivar(op);
      return true;
    }
    if (moverFoco(accion, $main)) return true;
    return true;
  }
  if (pantalla === "pedido" && partida && !partida.revelado) {
    const grupo = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.grupo;
    if (grupo && (accion === "arriba" || accion === "abajo")) {
      cambiarMedida(grupo, accion === "arriba" ? 1 : -1);
      return true;
    }
  }
  if (moverFoco(accion, $main)) return true;
  if (accion === "ok") {
    const e = document.activeElement;
    if (e && $main.contains(e) && !e.disabled) e.click();
    return true;
  }
  return true;
});

window.addEventListener("keydown", (e) => {
  if (!e.repeat) return;
  if (e.key === "Enter" || e.key === " " || e.key === "Spacebar" || e.key === "Select") {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
}, true);

document.addEventListener("pointerdown", () => {
  document.documentElement.classList.remove("teclado");
  desbloquear();
}, true);

Noli.datos.then((d) => { pr = cargar(d); return cargarTodo(); }).then(() => inicio());
