// Pantallas de la Fábrica de Números. La lógica está en los otros módulos;
// aquí se dibuja y se responde al dedo o a las flechas.
import { Noli, moverFoco, focoInicial } from "../../../kit/noli.js";
import { entre, rngConSemilla } from "./rng.js";
import { decir, callar } from "./voz.js";
import { clic, maquina as sonidoMaquina, listo, desbloquear } from "./sonido.js";
import {
  vacio, desdeNumero, valor, subir, bajar, pegar, triturar, puedeEnviar, puedeTriturar,
  bandaParaPegar, informe, bandaEquivocada, lectura, FRASE, duracionCanje, estiloCanje,
} from "./valor.js";
import { nivel as datosNivel, NIVELES, esCorrecto, ejemploDe, estadoInicialDe, textoCamion, POR_TURNO } from "./niveles.js";
import {
  cargar, registrar, dominio, cerrarTurno, pedidoPara, planTurno, cumplirReto, racha, semana,
  fechaLocal, resumen, marcarIngles, piezasDe, VENTANA, PARA_SUBIR,
} from "./progreso.js";
import { RANURAS, PIEZAS, pieza, ciclarRanura, pisosFabrica } from "./deco.js";
import { retoDelDia } from "./reto.js";
import { enIngles } from "./palabras.js";
import {
  siguientePaso, puedeHablarDeCanje, pistaCorta, fasePista, cuentaParaDominio,
  textoRomper, canjeEsLargo, exigeCanje, textoEnPantalla, avisoDiez, repetirAvisoDiez,
  IDLE_FLECHA_MS, IDLE_COMPLETA_MS,
} from "./pista.js";
import { resolverAtras, accionAtras } from "./salida.js";
import {
  guiaEnviarActivo, guiaAvanzaConToque, guiaBandaLista, textoDeGuia, vozDeGuia, esperaVozGuia,
  relojDeGuia, toqueTrasSalir, resolverToqueGuia,
} from "./guia.js";

const $main = document.getElementById("juego");
const rnd = Math.random;
const hoy = () => fechaLocal();
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const reducido = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const CAMIONES = ["camion-rojo", "camion-azul", "camion-verde", "camion-amarillo", "camion-morado"];
const BANDA = {
  c: { nombre: "Centenas", art: "placa-100", una: "una placa", quitar: "Quitar una placa", poner: "Poner una placa" },
  d: { nombre: "Decenas", art: "barra-10", una: "una barra", quitar: "Quitar una barra", poner: "Poner una barra" },
  u: { nombre: "Unidades", art: "cubo-1", una: "un cubito", quitar: "Quitar un cubito", poner: "Poner un cubito" },
};
const cache = {};
let pr;
let pantalla = "inicio";
let partida = null;
let anim = null;
let primerCanje = true;
let repetirLargo = false;
let dijoDiez = false;
let token = 0;
let saliendo = false;
let esperaPendiente = false;
let focosGuardados = null;
let focoAntes = null;
let relojPista = 0;
let relojDiez = 0;
let relojGuia = 0;
let guiaVozToken = 0;
let cerroSalir = 0;

function luego(fn, ms) {
  const t = ++token;
  setTimeout(() => { if (t === token) fn(); }, ms);
}

try {
  if (new URLSearchParams(location.search).get("modo") === "tv") document.documentElement.dataset.modo = "tv";
} catch { /* abierto fuera del navegador */ }

function arte(nombre) {
  return new Promise((resolver) => {
    fetch(new URL(`../img/${nombre}.svg`, import.meta.url))
      .then((r) => r.text())
      .then((t) => { cache[nombre] = t; resolver(); })
      .catch(() => { cache[nombre] = ""; resolver(); });
  });
}
function cargarArte() {
  const nombres = [...CAMIONES, "maquina", "cartel-centenas", "cartel-decenas", "cartel-unidades",
    ...PIEZAS.filter((p) => p.arte).map((p) => p.arte)];
  return Promise.all(nombres.map(arte));
}

function mostrar(html, nombre, focoId) {
  pantalla = nombre;
  $main.className = "p-" + nombre;
  $main.innerHTML = html;
  aplicarArte($main);
  const el = focoId && $main.querySelector(`[data-foco-id="${focoId}"]`);
  if (el) el.focus({ preventScroll: true });
  else focoInicial($main);
}

function aplicarArte(raiz) {
  for (const n of raiz.querySelectorAll("[data-svg]")) {
    n.innerHTML = cache[n.dataset.svg] || "";
    const texto = n.dataset.numero;
    const t = n.querySelector("#numero");
    if (t && texto != null) {
      t.textContent = texto;
      const largo = texto.length;
      if (largo > 8) t.setAttribute("font-size", "18");
      else if (largo > 4) t.setAttribute("font-size", "26");
    }
    const valorTxt = n.dataset.lectura;
    const v = n.querySelector("#valor");
    if (v && valorTxt != null) {
      v.textContent = valorTxt;
      if (valorTxt.length >= 4) v.setAttribute("font-size", "26");
    }
    if (n.dataset.luz) {
      const luz = n.querySelector("#luz");
      if (luz) luz.setAttribute("fill", n.dataset.luz);
    }
  }
  if (!reducido()) animarDeco(raiz);
}

function animarDeco(raiz) {
  const svgNS = "http://www.w3.org/2000/svg";
  const ani = (el, attrs) => {
    const a = document.createElementNS(svgNS, attrs.etiqueta || "animate");
    for (const k of Object.keys(attrs)) if (k !== "etiqueta") a.setAttribute(k, attrs[k]);
    el.appendChild(a);
  };
  for (const el of raiz.querySelectorAll(".banderin")) {
    ani(el, { etiqueta: "animateTransform", attributeName: "transform", type: "rotate", values: "-6;6;-6", dur: "2.4s", repeatCount: "indefinite", additive: "sum" });
  }
  for (const el of raiz.querySelectorAll("#humo")) {
    ani(el, { etiqueta: "animateTransform", attributeName: "transform", type: "translate", values: "0 4;0 -6;0 4", dur: "2.8s", repeatCount: "indefinite", additive: "sum" });
  }
  for (const el of raiz.querySelectorAll(".nube")) ani(el, { attributeName: "opacity", values: "1;.4;1", dur: "2.8s", repeatCount: "indefinite" });
  for (const el of raiz.querySelectorAll(".foco")) ani(el, { attributeName: "opacity", values: "1;.25;1", dur: "1.5s", repeatCount: "indefinite" });
  const rayos = raiz.querySelector("#rayos");
  if (rayos) ani(rayos, { etiqueta: "animateTransform", attributeName: "transform", type: "rotate", values: "0 60 54;360 60 54", dur: "2.4s", repeatCount: "indefinite" });
}

const guardar = () => Noli.guardar(pr);
const elegido = () => Math.min(pr.elegido || pr.nivel, pr.nivel);

// ---------- Dibujo ----------

function estrellasHtml(n, grande) {
  const estrella = (on) => `<svg viewBox="0 0 24 24" class="${on ? "on" : "off"}" aria-hidden="true"><path d="M12 2.5l2.7 6.3 6.8.6-5.2 4.4 1.6 6.6L12 16.8 6.1 20.4l1.6-6.6L2.5 9.4l6.8-.6z"/></svg>`;
  return `<span class="estrellas${grande ? " grande" : ""}" aria-label="${n} de 3">${[0, 1, 2].map((i) => estrella(i < n)).join("")}</span>`;
}
const FLAMA = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1.5-4.5 3-6 0 2 1 3 2 3 0-3-1-6 1-9z" fill="#ff6b4a"/><path d="M12 13c.5 2 3 3 3 5.5a3 3 0 0 1-6 0c0-1.5 1-2.5 3-5.5z" fill="#ffc43d"/></svg>`;
const CHECK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>`;
const CANDADO = `<svg class="ico" viewBox="0 0 24 24" aria-label="Bloqueado"><rect x="5" y="10" width="14" height="11" rx="2.5" fill="currentColor" opacity=".5"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>`;
const FLECHA = `<svg class="flecha" viewBox="0 0 24 36" aria-hidden="true"><path d="M12 2v16M5 14l7 12 7-12" fill="none" stroke="#ff6b4a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const FLECHA_ENV = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const PREGUNTA = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M9.2 9.2a2.8 2.8 0 1 1 3.6 2.7c-.7.4-1 1-1 2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1.15" fill="currentColor"/></svg>`;
const ALTAVOZ = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9.5a3.5 3.5 0 0 1 0 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

function modoJuego() {
  return Noli.modo === "tv" || document.documentElement.dataset.modo === "tv" ? "tv" : "tactil";
}

function htmlMini(e, coral) {
  const suf = coral ? "-coral" : "";
  let s = e.mil ? `<img class="mini mil" alt="" src="img/cubo-1000${suf}.svg">` : "";
  for (const [banda, n] of [["c", e.c], ["d", e.d], ["u", e.u]]) {
    for (let i = 0; i < n; i++) s += `<img class="mini ${banda}" alt="" src="img/${BANDA[banda].art}${suf}.svg">`;
  }
  return `<span class="minis">${s}</span>`;
}

function htmlPiezas(e, banda) {
  let s = banda === "c" && e.mil ? `<img class="mil" alt="" src="img/cubo-1000.svg">` : "";
  for (let i = 0; i < e[banda]; i++) s += `<img alt="" src="img/${BANDA[banda].art}.svg">`;
  return s;
}

function edificio(pisos) {
  const vents = Array.from({ length: pisos }, (_, i) => {
    const x = 48 + (i % 4) * 42, y = 78 + Math.floor(i / 4) * 0;
    return `<rect x="${x}" y="${y}" width="26" height="22" rx="3" fill="#bfe6ff" stroke="#2b2236" stroke-width="3"/>`;
  }).join("");
  return `<svg viewBox="0 0 260 150" aria-hidden="true">
    <rect x="24" y="58" width="200" height="84" rx="8" fill="#fff7ec" stroke="#2b2236" stroke-width="5"/>
    <path d="M16 64 L124 18 L232 64" fill="#ffc43d" stroke="#2b2236" stroke-width="5" stroke-linejoin="round"/>
    <rect x="108" y="104" width="36" height="38" rx="4" fill="#c86bfa" stroke="#2b2236" stroke-width="4"/>
    ${vents}
  </svg>`;
}

function svgRanura(id) {
  if (!id) return `<span class="vacio-ranura">Vacío</span>`;
  const p = pieza(id);
  if (!p?.arte) return "";
  return `<span class="deco" data-svg="${p.arte}"></span>`;
}

const DIAS = ["D", "L", "M", "M", "J", "V", "S"];
function semanaHtml() {
  return `<div class="semana" aria-label="Últimos 7 días">${semana(pr, hoy()).map((d) => {
    const [y, m, dd] = d.fecha.split("-").map(Number);
    const dia = DIAS[new Date(y, m - 1, dd).getDay()];
    return `<span class="dia ${d.reto ? "reto" : d.jugo ? "jugo" : ""}"><span class="punto">${d.reto ? CHECK : ""}</span>${dia}</span>`;
  }).join("")}</div>`;
}
function textoRacha() {
  const r = racha(pr, hoy());
  return r ? `Racha: ${r} ${r === 1 ? "día" : "días"}` : "Cumple el reto de hoy para empezar una racha";
}

// ---------- Inicio: la fábrica ----------

function inicio(focoId) {
  partida = null;
  const n = elegido();
  const dn = datosNivel(n);
  const dm = dominio(pr, n);
  const reto = pr.retos[hoy()];
  const pisos = pisosFabrica(pr.nivel);
  mostrar(`
    <h1 class="titulo">Fábrica de Números</h1>
    <div class="inicio-layout">
      <div class="fabrica" aria-label="Tu fábrica">
        ${RANURAS.filter((r) => r.id === "banderines").map((r) => botonRanura(r)).join("")}
        ${botonRanura(RANURAS[1])}
        <div class="edificio">${edificio(pisos)}</div>
        ${botonRanura(RANURAS[2])}
        ${botonRanura(RANURAS[3])}
      </div>
      <div class="menu">
        <p class="sub">Nivel ${n}: ${esc(dn.nombre)}</p>
        ${dm.listo || pr.niveles[n]?.dominado ? `<p class="dominio ok">¡Ya dominas este nivel!</p>` : `<div class="dominio"><div class="barra"><i style="width:${Math.round((100 * dm.intentos) / VENTANA)}%"></i></div><small>${dm.intentos} de ${VENTANA} para ver si subes</small></div>`}
        <button class="boton grande primario" data-foco="inicial" data-foco-id="jugar" data-act="ir" data-ir="ronda">Jugar</button>
        <button class="boton grande ${reto?.cumplido ? "hecho" : "reto"}" data-foco data-foco-id="reto" data-act="ir" data-ir="retoIntro">Reto del día <small>${reto?.cumplido ? "Cumplido" : "Te espera"}</small></button>
        <button class="boton grande" data-foco data-foco-id="progreso" data-act="ir" data-ir="progreso">Mi progreso</button>
        <button class="boton grande" data-foco data-foco-id="como" data-act="ir" data-ir="guia"><span class="con-ico">${PREGUNTA} ¿Cómo se juega?</span></button>
        <button class="boton grande" data-foco data-foco-id="ingles" data-act="ir" data-ir="ingles">Sello en inglés <small>${pr.ingles ? "Ya es tuyo" : "No cuenta para subir"}</small></button>
      </div>
    </div>
    <p class="fabrica-ley">Elige un adorno y cámbialo con arriba y abajo.</p>
    <p class="racha">${FLAMA}<span>${esc(textoRacha())}</span></p>`, "inicio", focoId);
}

function botonRanura(r) {
  const id = pr.deco.slots[r.id] || 0;
  return `<button type="button" class="ranura ${r.id}" data-ranura="${r.id}" data-foco data-foco-id="ranura-${r.id}" aria-label="${esc(r.nombre)}">${svgRanura(id)}</button>`;
}

function ciclar(ranura, dir) {
  pr = { ...pr, deco: ciclarRanura(pr.deco, ranura, dir, pr.ingles) };
  guardar();
  inicio("ranura-" + ranura);
}

// ---------- Partida ----------

function nuevaRonda() {
  if (!pr.guia || !pr.guia.primera) return empezarGuia("ronda");
  const n = elegido();
  partida = { modo: "turno", n, lista: planTurno(pr, n, rnd), i: 0, aciertos: 0 };
  cargarPedido();
}

function empezarGuia(destino) {
  partida = {
    modo: "guia", destino, paso: 0, n: 1, lista: [{ nivel: 1 }], i: 0, aciertos: 0,
    pedido: { tipo: "armar", nivel: 1, objetivo: 23, texto: "Arma 23" },
    estado: vacio(), intento: 1, feedback: null, espera: false, revelado: false,
    ultima: "d", primerDelNivel: false, idleDesde: Date.now(), vioPasoCompleto: false, eraListo: false,
  };
  pintar("camion");
}

function marcarGuia() {
  pr = { ...pr, guia: { primera: true } };
  guardar();
}

function terminarGuia() {
  const destino = partida && partida.destino;
  marcarGuia();
  if (destino === "ronda") nuevaRonda();
  else inicio();
}

function focoDeGuia() {
  if (partida.paso === 0 || partida.paso === 3) return "camion";
  if (partida.paso === 1) return "banda-d";
  if (partida.paso === 2) return "banda-u";
  return "enviar";
}

function limpiarRelojGuia() {
  clearTimeout(relojGuia);
  relojGuia = 0;
  guiaVozToken++;
  if (partida) partida.relojPaso = null;
}

function programarGuia() {
  if (relojDeGuia(saliendo) === "pausa") {
    limpiarRelojGuia();
    if (esGuia() && guiaAvanzaConToque(partida.paso)) callar();
    return;
  }
  if (!esGuia() || !guiaAvanzaConToque(partida.paso)) {
    limpiarRelojGuia();
    return;
  }
  if (partida.relojPaso === partida.paso && relojGuia) return;
  clearTimeout(relojGuia);
  const paso = partida.paso;
  const token = ++guiaVozToken;
  partida.relojPaso = paso;
  const t0 = Date.now();
  const seguir = () => {
    if (token !== guiaVozToken) return;
    guiaVozToken++;
    clearTimeout(relojGuia);
    relojGuia = 0;
    if (saliendo || !esGuia() || !partida || partida.paso !== paso) return;
    avanzarGuia();
  };
  relojGuia = setTimeout(seguir, esperaVozGuia(0));
  decir(vozDeGuia(paso, modoJuego()), "es-ES", () => {
    if (token !== guiaVozToken) return;
    const pasoMs = Date.now() - t0;
    // Un cierre al instante es un aparato sin voz: se queda el tope de 3 s.
    if (pasoMs < 200) return;
    const falta = esperaVozGuia(pasoMs) - pasoMs;
    if (falta > 30) {
      clearTimeout(relojGuia);
      relojGuia = setTimeout(seguir, falta);
      return;
    }
    clearTimeout(relojGuia);
    seguir();
  });
}

function avanzarGuia() {
  if (!partida || partida.modo !== "guia") return;
  limpiarRelojGuia();
  if (partida.paso >= 4) return terminarGuia();
  partida.paso += 1;
  partida.eraListo = false;
  pintar(focoDeGuia());
  if (!guiaAvanzaConToque(partida.paso)) decir(vozDeGuia(partida.paso, modoJuego()));
}

function guiaAvanza() {
  if (!esGuia() || !guiaBandaLista(partida.paso, partida.estado)) return false;
  avanzarGuia();
  return true;
}

function esGuia() {
  return !!(partida && partida.modo === "guia");
}

function bandaGuiaActiva(b) {
  if (!esGuia()) return true;
  if (partida.paso === 1) return b === "d";
  if (partida.paso === 2) return b === "u";
  if (partida.paso === 4) return true;
  return false;
}

function cargarPedido() {
  const paso = partida.lista[partida.i];
  partida.pedido = partida.modo === "turno" ? pedidoPara(pr, paso.nivel, rnd, { repaso: paso.repaso }) : paso;
  partida.intento = 1;
  partida.feedback = null;
  partida.espera = false;
  partida.revelado = false;
  partida.ultima = "u";
  partida.idleDesde = Date.now();
  partida.vioPasoCompleto = false;
  partida.eraListo = false;
  const p = partida.pedido;
  const pasoPlan = partida.lista[partida.i];
  partida.primerDelNivel = partida.modo === "turno" && !(pasoPlan && pasoPlan.repaso) && !(pr.niveles[p.nivel] && pr.niveles[p.nivel].total > 0);
  if ((p.nivel | 0) <= 1 && p.tipo === "armar" && p.texto) decir(p.texto);
  if (p.tipo === "ordenar") {
    partida.orden = p.camiones.slice();
    partida.sel = null;
    partida.estado = vacio();
    pintarOrden();
  } else {
    partida.estado = desdeNumero(estadoInicialDe(p));
    partida.orden = null;
    pintar();
  }
}

function objetivoPista(p) {
  if (typeof p.objetivo === "number") return p.objetivo;
  const ej = ejemploDe(p);
  return typeof ej === "number" ? ej : null;
}

function calcularPista() {
  if (!partida || esGuia() || !partida.pedido || partida.pedido.tipo === "ordenar") return null;
  const p = partida.pedido;
  const nivel = p.nivel || partida.n || 1;
  const objetivo = objetivoPista(p);
  if (objetivo == null) return null;
  const paso = siguientePaso(partida.estado, objetivo, modoJuego());
  const ms = Date.now() - (partida.idleDesde || Date.now());
  const fase = fasePista({
    nivel, primerDelNivel: !!partida.primerDelNivel, ms, fallo: (partida.intento || 1) > 1,
  });
  if ((nivel | 0) > 1 && fase === "completa" && ((partida.intento || 1) > 1 || ms >= IDLE_COMPLETA_MS)) {
    partida.vioPasoCompleto = true;
  }
  return { paso, fase, nivel };
}

function htmlPista(info) {
  if (esGuia()) return `<p class="pista" aria-live="polite">${esc(textoDeGuia(partida.paso, modoJuego()))}</p>`;
  if (!info || info.fase === "nada" || info.fase === "flecha") return `<p class="pista" aria-live="polite"></p>`;
  if (info.fase === "corta") {
    const ico = (info.nivel | 0) === 4 ? ALTAVOZ : "";
    return `<p class="pista" aria-live="polite"><span class="con-ico">${ico}${esc(pistaCorta(info.nivel, modoJuego()))}</span></p>`;
  }
  return `<p class="pista" aria-live="polite">${esc(textoEnPantalla(info.paso.texto, modoJuego()))}</p>`;
}

function modoMaquina(e) {
  if (bandaParaPegar(e)) return "pegar";
  if (partida.ultima && puedeTriturar(e, partida.ultima)) return "romper";
  return "idle";
}

function pintar(focoId) {
  if (saliendo) return;
  if (!partida || partida.pedido.tipo === "ordenar") return pintarOrden(focoId);
  const p = partida.pedido;
  const e = partida.estado;
  const guia = esGuia();
  const foco = "data-foco";
  const info = calcularPista();
  const maq = modoMaquina(e);
  const luz = maq === "pegar" ? "#3ccf8e" : maq === "romper" ? "#ff6b4a" : "#e7dccb";
  const etiqMaq = maq === "pegar" ? "Pegar" : maq === "romper" ? "Romper" : "Máquina";
  const listoEnviar = guia ? guiaEnviarActivo(partida.paso) : (puedeEnviar(e) && esCorrecto(p, valor(e)));
  if (listoEnviar && !partida.eraListo) {
    partida.eraListo = true;
    listo();
    if (!guia && modoJuego() === "tv") focoId = "enviar";
  } else if (!listoEnviar) partida.eraListo = false;
  const num = textoCamion(p);
  const color = CAMIONES[partida.i % CAMIONES.length];
  const brillaCamion = guia && (partida.paso === 0 || partida.paso === 3);
  const brillaTotal = guia && partida.paso === 3;
  const focoCamion = brillaCamion ? 'tabindex="0" data-foco="inicial" data-foco-id="camion"' : "";
  const muestraPide = p.tipo === "armar" && typeof p.objetivo === "number";
  const puntos = guia ? "" : `<span class="puntos">${Array.from({ length: partida.lista.length }, (_, k) => `<i class="${k < partida.i ? "lleno" : ""}"></i>`).join("")}</span>`;
  const enviarOk = !guia || guiaEnviarActivo(partida.paso);
  const focoEnviar = enviarOk
    ? (guia ? 'data-foco="inicial"' : (foco && !p.leer ? 'data-foco="inicial"' : foco))
    : "disabled";
  const flechaMaq = info && (info.fase === "flecha" || info.fase === "completa") && info.paso.canje === "pegar" ? FLECHA : "";
  const defecto = guia ? focoDeGuia() : (p.pistaBanda ? "banda-" + p.pistaBanda : "banda-u");
  mostrar(`
    <header class="cab"><span>${esc(etiqueta())}</span>${guia ? `<button type="button" class="saltar" data-foco data-foco-id="saltar-guia" data-act="ir" data-ir="saltar-guia">Saltar</button>` : puntos}</header>
    <p class="pedido">${esc(p.texto)}</p>
    ${p.pistas ? `<ul class="pistas">${p.pistas.map((x) => `<li>${esc(x.texto)}</li>`).join("")}</ul>` : ""}
    ${p.leer ? `<button type="button" class="boton oir" ${foco} data-foco-id="oir" data-act="oir">Oír</button>` : ""}
    ${htmlOperandos(p)}
    <div class="camion-wrap${brillaCamion ? " brilla" : ""}" ${focoCamion}>
      <div class="carga">${htmlMini(e)}</div>
      <div class="camion-svg" data-svg="${color}" data-numero="${esc(num)}"></div>
    </div>
    <p class="total${brillaTotal ? " brilla" : ""}" aria-live="polite"><span>Son</span> <b>${valor(e)}</b>${muestraPide ? ` <span class="pide">/ Pide ${p.objetivo}</span>` : ""}</p>
    ${htmlPista(info)}
    <div class="mesa">
      ${["c", "d", "u"].map((b) => htmlBanda(b, e, p, foco, info)).join("")}
      <div class="barra-accion">
        <span class="maq-wrap">
          <button type="button" class="maquina-btn${maq === "pegar" ? " pide-pegar" : ""}${maq === "romper" ? " pide-romper" : ""}" ${guia ? "disabled" : foco} data-foco-id="maquina" data-act="maquina" aria-label="Máquina de pegar y partir">
            <span class="maquina-svg" data-svg="maquina" data-luz="${luz}"></span>
            <span class="maq-etiq">${etiqMaq}</span>
          </button>
          ${flechaMaq}
        </span>
        <button type="button" class="enviar${listoEnviar ? " listo" : ""}${!guia && !puedeEnviar(e) ? " bloqueado" : ""}" ${focoEnviar} data-foco-id="enviar"${enviarOk ? ' data-act="enviar"' : ""}>${listoEnviar ? `${FLECHA_ENV} ¡Enviar!` : "Enviar"}</button>
      </div>
    </div>
    <div class="canje" hidden></div>
    <p class="aviso" aria-live="polite"></p>
    ${htmlFeedback()}`, "problema", focoId || defecto);
  if (guia) $main.classList.add("guia");
  if (guia && guiaAvanzaConToque(partida.paso)) $main.classList.add("guia-mira");
  programarGuia();
  programarPista();
}

function htmlBanda(b, e, p, foco, info) {
  const meta = BANDA[b];
  const activa = bandaGuiaActiva(b);
  const sinUso = activa && (p.nivel | 0) <= 1 && p.tipo === "armar" && b === "c" && !esGuia();
  const clases = ["banda", b];
  if (p.pistaBanda === b) clases.push("marcada");
  if (!activa) clases.push("apagada");
  else if (sinUso) clases.push("sin-uso");
  const focoBanda = foco && activa ? foco : "";
  const dis = activa ? "" : "disabled";
  let flecha = "";
  if (esGuia() && ((partida.paso === 1 && b === "d") || (partida.paso === 2 && b === "u"))) flecha = FLECHA;
  else if (info && (info.fase === "flecha" || info.fase === "completa") && info.paso.banda === b && !info.paso.canje) flecha = FLECHA;
  const quita = info && info.paso && String(info.paso.texto).startsWith("Quita");
  const cartel = meta.nombre === "Centenas" ? "centenas" : meta.nombre === "Decenas" ? "decenas" : "unidades";
  return `<div class="${clases.join(" ")}" data-banda="${b}" ${focoBanda} data-foco-id="banda-${b}" tabindex="${activa ? 0 : -1}" role="group" aria-label="${meta.nombre}">
    <div class="cartel" data-svg="cartel-${cartel}" data-lectura="${lectura(e, b)}"></div>
    <div class="piezas ${b}">${htmlPiezas(e, b)}</div>
    <div class="riel ${b}${reducido() ? "" : " andando"}"></div>
    <div class="pm">
      <span class="mas-wrap">${quita && flecha ? flecha : ""}<button type="button" class="pm-btn" data-act="bajar" data-banda="${b}" aria-label="${meta.quitar}" ${dis}>−</button></span>
      <span class="mas-wrap">${!quita && flecha ? flecha : ""}<button type="button" class="pm-btn" data-act="subir" data-banda="${b}" aria-label="${meta.poner}" ${dis}>+</button></span>
    </div>
  </div>`;
}

function htmlOperandos(p) {
  if (p.tipo !== "sumar" && p.tipo !== "restar") return "";
  const signo = p.tipo === "sumar" ? "+" : "−";
  return `<div class="operandos">${htmlMini(desdeNumero(p.a))}<span class="signo">${signo}</span>${htmlMini(desdeNumero(p.b), true)}</div>`;
}

function etiqueta() {
  const p = partida.pedido;
  if (partida.modo === "guia") return "Así se juega";
  if (partida.modo === "reto") return partida.reto.nombre;
  if (partida.modo === "ingles") return "Sello en inglés";
  if (p.repaso) return `Nivel ${p.nivel} · repaso`;
  return `Nivel ${partida.n}`;
}

function htmlFeedback() {
  const f = partida.feedback;
  if (!f) return "";
  return `<div class="feedback">
    <div class="lados">
      <div><span>Armaste</span>${htmlMini(f.hecho)}</div>
      <div><span>${esc(f.otroTitulo)}</span>${htmlMini(desdeNumero(f.otro))}</div>
    </div>
    ${f.filas ? `<ul class="bandas-fb">${f.filas.map((r) => `<li class="${r.ok ? "ok" : "mal"}">${esc(nombreFila(r))}</li>`).join("")}</ul>` : `<p>${esc(f.mensaje)}</p>`}
    ${f.respuesta != null ? `<p class="respuesta">Así era.</p><div>${htmlMini(desdeNumero(f.respuesta))}</div><button type="button" class="boton primario" data-foco="inicial" data-foco-id="seguir-resp" data-act="ir" data-ir="avanzar">Seguir</button>` : ""}
  </div>`;
}
function nombreFila(r) {
  const nom = { c: "Centenas", d: "Decenas", u: "Unidades", mil: "Mil" }[r.banda] || r.banda;
  return `${nom}: ${r.texto}`;
}

function htmlDialogoSalir() {
  return `<div class="velo salir-velo"><div class="dialogo" role="dialog" aria-label="Salir">
    <p>¿Salir?</p>
    <button type="button" class="boton grande primario" data-foco="inicial" data-foco-id="seguir-juego" data-act="ir" data-ir="seguir-juego">Seguir</button>
    <button type="button" class="boton grande" data-foco data-foco-id="salir-juego" data-act="ir" data-ir="salir-juego">Salir</button>
  </div></div>`;
}

function pintarOrden(focoId) {
  if (saliendo) return;
  const p = partida.pedido;
  const foco = "data-foco";
  const bien = [...p.camiones].sort((a, b) => a - b);
  mostrar(`
    <header class="cab"><span>${esc(etiqueta())}</span></header>
    <p class="pedido">${esc(p.texto)}</p>
    <p class="sub">OK en un camión y OK en otro para cambiarlos.</p>
    <div class="camiones">
      ${partida.orden.map((n, i) => {
        const mal = partida.feedback && partida.orden[i] !== bien[i] ? " puesto-mal" : "";
        const marca = i === 0 && foco ? 'data-foco="inicial"' : foco;
        return `<button type="button" class="camion-btn${partida.sel === i ? " sel" : ""}${mal}" ${marca} data-foco-id="cam-${i}" data-act="camion" data-i="${i}" aria-label="Camión ${n}">
          <span class="camion-svg" data-svg="${CAMIONES[i]}" data-numero="${partida.revelado ? bien[i] : n}"></span>
        </button>`;
      }).join("")}
    </div>
    ${partida.revelado ? `<p class="respuesta">Así van, del menor al mayor.</p><button type="button" class="boton primario" data-foco data-foco-id="seguir-resp" data-act="ir" data-ir="avanzar">Seguir</button>` : `<button type="button" class="enviar" ${foco} data-foco-id="enviar" data-act="enviar">Enviar</button>`}
    <p class="aviso" aria-live="polite"></p>`, "ordenar", focoId || "cam-0");
  if (partida.revelado) {
    partida.orden = bien;
  }
}

function aviso(t) {
  const a = $main.querySelector(".aviso");
  if (a) a.textContent = t || "";
}

function metaComparar(p) {
  if (p.objetivo != null) return p.objetivo;
  return p.referencia;
}

function marcarToque() {
  if (!partida) return;
  partida.idleDesde = Date.now();
}

function limpiarDiez() {
  clearTimeout(relojDiez);
  relojDiez = 0;
}

function avisarDiez(banda) {
  const frase = avisoDiez(banda, modoJuego());
  if (repetirAvisoDiez(calcularPista())) aviso(frase.pantalla);
  if (!dijoDiez) {
    dijoDiez = true;
    decir(frase.voz);
  }
  limpiarDiez();
  relojDiez = setTimeout(() => {
    if (saliendo || !partida || anim) return;
    if ((partida.estado[banda] || 0) !== 10) return;
    decir(frase.voz);
    const m = $main.querySelector('[data-foco-id="maquina"]');
    if (m) m.focus();
  }, 8000);
}

function cambiar(banda, dir) {
  if (!partida || anim || partida.espera || partida.revelado || saliendo) return;
  if (!bandaGuiaActiva(banda)) return;
  partida.ultima = banda;
  marcarToque();
  if (dir > 0) {
    const r = subir(partida.estado, banda);
    if (r.accion === "suma") {
      partida.estado = r.estado;
      clic(r.estado[banda]);
      if (guiaAvanza()) return;
      pintar("banda-" + banda);
      if (r.estado[banda] === 10 && !esGuia()) avisarDiez(banda);
      return;
    }
    if (r.accion === "pegar") return iniciarCanje("pegar", banda);
    if (r.accion === "tope") aviso("Ya son 1000.");
    return;
  }
  const r = bajar(partida.estado, banda);
  if (r.accion === "resta") {
    partida.estado = r.estado;
    clic(r.estado[banda] + 1);
    limpiarDiez();
    if (guiaAvanza()) return;
    pintar("banda-" + banda);
    return;
  }
  if (r.accion === "triturar") return iniciarCanje("triturar", banda);
  aviso(textoRomper(banda, partida.estado));
}

function usarMaquina() {
  if (!partida || anim || saliendo || esGuia()) return;
  marcarToque();
  const b = bandaParaPegar(partida.estado, partida.ultima);
  if (b) return iniciarCanje("pegar", b);
  if (partida.ultima && puedeTriturar(partida.estado, partida.ultima)) return iniciarCanje("triturar", partida.ultima);
  const obj = objetivoPista(partida.pedido);
  const paso = obj == null ? null : siguientePaso(partida.estado, obj, modoJuego());
  const dicho = paso ? textoEnPantalla(paso.texto, modoJuego()) : "";
  if (paso && !puedeHablarDeCanje(partida.estado, partida.pedido)) aviso("Ahora no hace falta. " + dicho);
  else if (paso) aviso(dicho);
  else aviso("Ahora no hace falta.");
}

function iniciarCanje(sentido, banda) {
  if (anim) return;
  const fn = sentido === "pegar" ? pegar : triturar;
  const res = fn(partida.estado, banda);
  if (!res) { aviso("Primero pega la banda de arriba."); return; }
  const larga = canjeEsLargo({ primeraVez: primerCanje, repetirPorFallo: repetirLargo });
  primerCanje = false;
  repetirLargo = false;
  limpiarDiez();
  const total = duracionCanje(larga);
  const estilo = estiloCanje(reducido());
  if (larga) decir(res.frase, "es-ES");
  sonidoMaquina();
  const host = $main.querySelector(".canje");
  const maq = $main.querySelector(".maquina-svg");
  if (maq) maq.classList.add("gira");
  const luz = maq && maq.querySelector("#luz");
  if (luz) luz.setAttribute("fill", sentido === "pegar" ? "#3ccf8e" : "#ff6b4a");
  const totalEl = $main.querySelector(".total");
  if (totalEl) {
    totalEl.classList.add("quieto");
    const s = totalEl.querySelector("span");
    if (s) s.textContent = "Siguen siendo";
  }
  if (host) {
    host.hidden = false;
    const fichas = Array.from({ length: 10 }, () => `<img class="ficha${sentido === "triturar" ? " espera" : ""}" alt="" src="img/${BANDA[banda].art}.svg">`).join("");
    host.innerHTML = `<p class="cuenta" aria-live="polite">1</p><p class="frase">${esc(FRASE[sentido][banda])}</p><div class="fichas">${fichas}</div><p class="conserva">El total no cambia</p>`;
  }
  const pasoMs = total / 10;
  let paso = 1;
  let timer = null;
  let vivo = true;
  const terminar = () => {
    if (!vivo) return;
    vivo = false;
    clearTimeout(timer);
    anim = null;
    partida.estado = res.estado;
    pintar(sentido === "pegar" ? "maquina" : "banda-" + banda);
  };
  const marcar = () => {
    const c = host && host.querySelector(".cuenta");
    if (c) c.textContent = String(paso);
    const ficha = host && host.querySelectorAll(".ficha")[paso - 1];
    if (ficha) ficha.classList.add(estilo);
  };
  marcar();
  const loop = () => {
    if (!vivo) return;
    if (anim && anim.saltar) return terminar();
    if (paso >= 10) return terminar();
    paso++;
    marcar();
    timer = setTimeout(loop, pasoMs);
  };
  timer = setTimeout(loop, pasoMs);
  anim = { saltar: false, terminar };
}

function enviar() {
  if (!partida || anim || partida.espera || partida.revelado || saliendo) return;
  if (esGuia()) {
    if (guiaEnviarActivo(partida.paso)) terminarGuia();
    return;
  }
  if (partida.pedido.tipo === "ordenar") return enviarOrden();
  if (!puedeEnviar(partida.estado)) {
    aviso("Hay 10 piezas. Pégalas en la máquina.");
    const m = $main.querySelector('[data-foco-id="maquina"]');
    if (m) m.focus();
    return;
  }
  const p = partida.pedido;
  const v = valor(partida.estado);
  const ok = esCorrecto(p, v);
  if (!ok && exigeCanje(p)) repetirLargo = true;
  if (partida.intento === 1) {
    const objetivo = p.objetivo != null ? p.objetivo : ejemploDe(p);
    const banda = ok || typeof objetivo !== "number" ? null : bandaEquivocada(partida.estado, objetivo);
    if (partida.modo === "turno" && cuentaParaDominio({ nivel: p.nivel, vioPasoCompleto: !!partida.vioPasoCompleto })) {
      pr = registrar(pr, p.nivel, { ok, dificil: !!p.dificil, banda }, hoy(), 1);
      guardar();
    }
    if (ok) return celebrar();
    partida.intento = 2;
    partida.feedback = feedbackDe(p, false);
    pintar("banda-" + (banda || partida.ultima || "u"));
    return;
  }
  if (ok) {
    aviso("Ahora sí.");
    partida.espera = true;
    luego(avanzar, 700);
    return;
  }
  partida.feedback = feedbackDe(p, true);
  partida.revelado = true;
  pintar("seguir-resp");
}

function feedbackDe(p, conRespuesta) {
  const otro = p.objetivo != null ? p.objetivo : p.referencia;
  const filas = typeof otro === "number" && (p.tipo === "armar" || p.tipo === "desarrollada" || p.tipo === "palabras" || p.tipo === "mas" || p.tipo === "menos" || p.tipo === "igual" || p.tipo === "contar" || p.tipo === "sumar" || p.tipo === "restar" || p.tipo === "misterioso")
    ? informe(partida.estado, otro) : null;
  let mensaje = "";
  if (p.tipo === "mayor") mensaje = `El tuyo es ${valor(partida.estado)}. Hace falta un número mayor que ${p.referencia}.`;
  if (p.tipo === "menor") mensaje = `El tuyo es ${valor(partida.estado)}. Hace falta un número menor que ${p.referencia}.`;
  const respuesta = conRespuesta && typeof ejemploDe(p) === "number" ? ejemploDe(p) : null;
  return { hecho: { ...partida.estado }, otro, otroTitulo: p.tipo === "mayor" || p.tipo === "menor" ? "El pedido" : "Pedían", filas, mensaje, respuesta };
}

function celebrar() {
  partida.espera = true;
  partida.aciertos++;
  listo();
  const wrap = $main.querySelector(".camion-wrap");
  if (wrap) wrap.classList.add("sacude");
  aviso(["¡Bien!", "¡Eso es!", "¡Listo!"][Math.floor(rnd() * 3)]);
  luego(avanzar, 750);
}

function enviarOrden() {
  const p = partida.pedido;
  const ok = esCorrecto(p, 0, { orden: partida.orden });
  if (partida.intento === 1) {
    if (partida.modo === "turno" && cuentaParaDominio({ nivel: p.nivel, vioPasoCompleto: !!partida.vioPasoCompleto })) {
      pr = registrar(pr, p.nivel, { ok, dificil: false, banda: null }, hoy(), 1);
      guardar();
    }
    if (ok) return celebrar();
    partida.intento = 2;
    partida.feedback = { mensaje: "El menor va a la izquierda." };
    aviso("El menor va a la izquierda.");
    pintarOrden("cam-0");
    return;
  }
  if (ok) {
    aviso("Ahora sí.");
    partida.espera = true;
    luego(avanzar, 700);
    return;
  }
  partida.revelado = true;
  pintarOrden("seguir-resp");
}

function tocarCamion(i) {
  if (!partida || partida.revelado || partida.espera) return;
  if (partida.sel == null) { partida.sel = i; pintarOrden("cam-" + i); return; }
  if (partida.sel === i) { partida.sel = null; pintarOrden("cam-" + i); return; }
  const o = partida.orden;
  const a = partida.sel;
  [o[a], o[i]] = [o[i], o[a]];
  partida.sel = null;
  pintarOrden("cam-" + i);
}

function avanzar() {
  if (!partida) return;
  if (pantalla !== "problema" && pantalla !== "ordenar") return;
  partida.i++;
  partida.espera = false;
  if (partida.i >= partida.lista.length) {
    if (partida.modo === "turno") return finTurno();
    if (partida.modo === "reto") return finReto();
    return finIngles();
  }
  cargarPedido();
}

function programarPista() {
  clearTimeout(relojPista);
  relojPista = 0;
  if (saliendo || !partida || esGuia() || partida.espera || partida.revelado) return;
  if (!partida.pedido || partida.pedido.tipo === "ordenar") return;
  if ((partida.pedido.nivel | 0) <= 1) return;
  const ms = Date.now() - (partida.idleDesde || Date.now());
  let espera = 0;
  if (ms < IDLE_FLECHA_MS) espera = IDLE_FLECHA_MS - ms;
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
  limpiarDiez();
  if (relojDeGuia(true) === "pausa") {
    limpiarRelojGuia();
    if (esGuia() && guiaAvanzaConToque(partida.paso)) callar();
  }
  if (partida && partida.espera) {
    esperaPendiente = true;
    partida.espera = false;
  }
  focoAntes = document.activeElement;
  focosGuardados = [...$main.querySelectorAll("[data-foco]")].map((el) => ({
    el, valor: el.getAttribute("data-foco"),
  }));
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
  if (ySalir) {
    esperaPendiente = false;
    Noli.salir();
    return;
  }
  cerroSalir = Date.now();
  if (esperaPendiente && partida) {
    esperaPendiente = false;
    partida.espera = true;
    luego(avanzar, 400);
    return;
  }
  if (focoAntes && focoAntes.isConnected && $main.contains(focoAntes)) focoAntes.focus({ preventScroll: true });
  else focoInicial($main);
  if (relojDeGuia(false) === "reiniciar") programarGuia();
  programarPista();
}

// ---------- Fin, reto, inglés, progreso ----------

function finTurno() {
  const antes = piezasDe(pr).map((p) => p.id);
  const n = partida.n;
  const r = cerrarTurno(pr, n, partida.aciertos);
  pr = r.pr;
  guardar();
  Noli.terminar({ estrellas: r.estrellas });
  const nuevas = piezasDe(pr).filter((p) => !antes.includes(p.id));
  const especial = r.subio ? nuevas[nuevas.length - 1] : null;
  mostrar(`
    <h1 class="titulo">${["¡Buen intento!", "¡Bien hecho!", "¡Muy bien!", "¡Perfecto!"][r.estrellas]}</h1>
    ${estrellasHtml(r.estrellas, true)}
    <p class="sub">${partida.aciertos} de ${POR_TURNO} a la primera</p>
    ${r.subio ? `<div class="subio"><b>¡Subiste al nivel ${r.subio}!</b><span>${esc(datosNivel(r.subio).nombre)}</span></div>` : ""}
    ${nuevas.length ? `<p class="sub">Nueva pieza: ${esc(nuevas.map((p) => p.nombre).join(" y "))}${especial ? ". La última es especial." : ""}</p>` : ""}
    <div class="menu fila">
      <button class="boton grande primario" data-foco="inicial" data-act="ir" data-ir="ronda">${r.subio ? "Probar el nivel nuevo" : "Otro turno"}</button>
      <button class="boton grande" data-foco data-act="ir" data-ir="inicio">La fábrica</button>
    </div>`, "fin");
  partida = null;
}

function retoIntro() {
  const reto = retoDelDia(hoy(), pr.nivel);
  const hecho = pr.retos[hoy()];
  mostrar(`
    <h1 class="titulo">Reto del día</h1>
    <div class="tarjeta-reto">
      <b>${esc(reto.nombre)}</b>
      <p>${esc(reto.meta)}</p>
      ${hecho ? `<p>${hecho.cumplido ? "¡Ya lo cumpliste hoy! Puedes jugarlo otra vez." : "Hoy todavía no. ¡Inténtalo otra vez!"}</p>` : ""}
    </div>
    <div class="menu fila">
      <button class="boton grande primario" data-foco="inicial" data-act="ir" data-ir="retoJugar">¡Empezar!</button>
      <button class="boton grande" data-foco data-act="ir" data-ir="inicio">La fábrica</button>
    </div>
    <p class="racha">${FLAMA}<span>${esc(textoRacha())}</span></p>
    ${semanaHtml()}`, "retoIntro");
}

function retoJugar() {
  const reto = retoDelDia(hoy(), pr.nivel);
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
    <h1 class="titulo">${cumplido ? "¡Reto cumplido!" : "¡Casi!"}</h1>
    <p class="sub">${puntos} de ${r.cuantos}. Meta: ${r.necesita}.</p>
    ${cumplido && !antes ? `<p class="racha grande">${FLAMA}<span>${esc(textoRacha())}</span></p>` : ""}
    <div class="menu fila">
      <button class="boton grande primario" data-foco="inicial" data-act="ir" data-ir="${cumplido ? "inicio" : "retoJugar"}">${cumplido ? "La fábrica" : "Otra vez"}</button>
      ${cumplido ? "" : `<button class="boton grande" data-foco data-act="ir" data-ir="inicio">La fábrica</button>`}
    </div>
    ${semanaHtml()}`, "finReto");
  partida = null;
}

function empezarIngles() {
  const r = rngConSemilla("fabrica-ingles-" + Date.now());
  const nums = [];
  while (nums.length < 4) {
    const n = r() < 0.5 ? entre(r, 1, 30) : entre(r, 1, 9) * 100 + entre(r, 1, 9) * 10 + entre(r, 0, 9);
    if (!nums.includes(n)) nums.push(n);
  }
  partida = {
    modo: "ingles", n: 4, lista: nums.map((n) => ({
      nivel: 4, tipo: "palabras", objetivo: n, texto: enIngles(n), leer: enIngles(n), idioma: "en", dificil: false,
    })), i: 0, aciertos: 0,
  };
  cargarPedido();
}

function finIngles() {
  const gano = partida.aciertos >= 3;
  if (gano) { pr = marcarIngles(pr); guardar(); }
  mostrar(`
    <h1 class="titulo">${gano ? "¡Sello en inglés!" : "Casi el sello"}</h1>
    <p class="sub">${partida.aciertos} de 4. Esto no cuenta para subir de nivel.</p>
    ${gano ? `<div class="deco" data-svg="sello-en"></div>` : ""}
    <div class="menu fila">
      <button class="boton grande primario" data-foco="inicial" data-act="ir" data-ir="inicio">La fábrica</button>
      ${gano ? "" : `<button class="boton grande" data-foco data-act="ir" data-ir="ingles">Otra vez</button>`}
    </div>`, "finIngles");
  partida = null;
}

function progreso() {
  mostrar(`
    <h1 class="titulo">Mi progreso</h1>
    <p class="racha">${FLAMA}<span>${esc(textoRacha())}</span></p>
    ${semanaHtml()}
    <ol class="mapa">${NIVELES.map((x) => {
      const nv = pr.niveles[x.n];
      const abierto = x.n <= pr.nivel;
      const dm = dominio(pr, x.n);
      const estado = nv?.dominado ? estrellasHtml(nv.estrellas || 0) : abierto ? `<span>${dm.intentos} de ${VENTANA}</span>` : CANDADO;
      return `<li><button type="button" class="nivel ${nv?.dominado ? "dominado" : abierto ? "abierto" : "cerrado"}${x.n === elegido() ? " actual" : ""}" ${abierto ? `data-foco${x.n === elegido() ? '="inicial"' : ""} data-act="ir" data-ir="elegir" data-n="${x.n}"` : "disabled"}>
        <b class="num">${x.n}</b><span class="nom">${esc(x.nombre)}<small>${esc(x.ejemplo)}</small></span>${estado}</button></li>`;
    }).join("")}</ol>
    <div class="menu fila">
      <button type="button" class="boton" data-foco data-act="ir" data-ir="inicio">La fábrica</button>
      <button type="button" class="boton" data-foco data-foco-id="como" data-act="ir" data-ir="guia"><span class="con-ico">${PREGUNTA} ¿Cómo se juega?</span></button>
      <button type="button" class="boton" data-foco data-act="ir" data-ir="papas">Para papás</button>
    </div>`, "progreso");
}

function papas() {
  const R = resumen(pr);
  mostrar(`
    <h1 class="titulo">Para papás</h1>
    <p class="nota">Sube con ${PARA_SUBIR} de los últimos ${VENTANA}, solo si el primer envío fue correcto. En los niveles 3, 7 y 8, al menos 4 de esos 10 son del tipo difícil (un cero o un reagrupamiento). Tres fallos seguidos no bajan de nivel: el siguiente pedido es más fácil y se marca la banda. El progreso se guarda en este dispositivo.</p>
    <table class="tabla"><thead><tr><th>Nivel</th><th>Pedidos</th><th>A la primera</th><th></th></tr></thead><tbody>
      ${R.niveles.filter((x) => x.desbloqueado || x.total).map((x) => `<tr><td>${x.n}. ${esc(x.nombre)}</td><td>${x.total}</td><td>${x.pct == null ? "–" : x.pct + " %"}</td><td>${x.dominado ? "Dominado" : esc(x.sub)}</td></tr>`).join("")}
    </tbody></table>
    <div class="menu fila"><button type="button" class="boton" data-foco="inicial" data-act="ir" data-ir="progreso">Regresar</button></div>`, "papas");
}

// ---------- Acciones ----------

const IR = {
  inicio: () => inicio(),
  ronda: nuevaRonda,
  retoIntro, retoJugar,
  progreso, papas,
  ingles: empezarIngles,
  guia: () => empezarGuia("inicio"),
  "saltar-guia": terminarGuia,
  "seguir-juego": () => cerrarSalir(false),
  "salir-juego": () => cerrarSalir(true),
  avanzar,
  elegir: (ds) => { pr = { ...pr, elegido: +ds.n }; guardar(); inicio(); },
};

$main.addEventListener("click", (ev) => {
  if (anim) { anim.saltar = true; anim.terminar(); return; }
  const t = ev.target.closest("[data-act]");
  const ir = (t && t.dataset.ir) || "";
  if (saliendo) {
    const efecto = resolverToqueGuia({ dialogo: true, ir });
    if (efecto === "seguir") cerrarSalir(false);
    else if (efecto === "salir") cerrarSalir(true);
    return;
  }
  if (toqueTrasSalir(Date.now() - cerroSalir)) return;
  if (esGuia() && resolverToqueGuia({ paso: partida.paso, ir }) === "mostrar") {
    avanzarGuia();
    return;
  }
  if (!t || !$main.contains(t)) return;
  const act = t.dataset.act;
  if (act === "subir") cambiar(t.dataset.banda, 1);
  else if (act === "bajar") cambiar(t.dataset.banda, -1);
  else if (act === "maquina") usarMaquina();
  else if (act === "enviar") enviar();
  else if (act === "oir") decir(partida && partida.pedido.leer, partida && partida.pedido.idioma === "en" ? "en-US" : "es-ES");
  else if (act === "camion") tocarCamion(+t.dataset.i);
  else if (act === "ir" && IR[t.dataset.ir]) IR[t.dataset.ir](t.dataset);
});

Noli.alEntrar((accion) => {
  document.documentElement.classList.add("teclado");
  if (anim) { anim.saltar = true; anim.terminar(); return true; }
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
  if (accion === "ok" && toqueTrasSalir(Date.now() - cerroSalir)) return true;
  if (pantalla === "problema" && partida) {
    const banda = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.banda;
    if (banda && (accion === "arriba" || accion === "abajo")) {
      if (bandaGuiaActiva(banda)) cambiar(banda, accion === "arriba" ? 1 : -1);
      return true;
    }
  }
  if (esGuia() && accion === "ok") {
    const e = document.activeElement;
    const id = e && e.dataset && e.dataset.focoId;
    if (id === "saltar-guia" && e && !e.disabled) { e.click(); return true; }
    if (id === "enviar" && guiaEnviarActivo(partida.paso) && e && !e.disabled) { e.click(); return true; }
    if (guiaAvanzaConToque(partida.paso)) avanzarGuia();
    return true;
  }
  if (pantalla === "inicio") {
    const ranura = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.ranura;
    if (ranura && (accion === "arriba" || accion === "abajo")) {
      ciclar(ranura, accion === "arriba" ? 1 : -1);
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

document.addEventListener("pointerdown", () => {
  document.documentElement.classList.remove("teclado");
  desbloquear();
}, true);

Noli.datos.then((d) => { pr = cargar(d); return cargarArte(); }).then(() => inicio());
