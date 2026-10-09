// Pantallas de El Reloj del Dragón. La lógica está en los otros módulos.
import { Noli, moverFoco, focoInicial } from "../../../kit/noli.js";
import { rngConSemilla } from "./rng.js";
import { decir, callar } from "./voz.js";
import { clic, listo as sonidoListo, campanada, desbloquear } from "./sonido.js";
import {
  anguloHorario, anguloMinutero, digital, sectorPath, moverMinutos, moverHora,
  misma, arrastre, cuentaPrimera, hora12, GAG_MS, atrasEnEspera,
  toqueEnPantalla, alCerrarEspera,
} from "./reloj.js";
import { NIVELES, ALBUM, MOMENTOS, planDia, POR_TURNO } from "./niveles.js";
import { pista } from "./pista.js";
import {
  guiaNueva, aplicarGuia, textoPaso, vozPaso, PASOS, META_GUIA, INICIO_GUIA,
  esExplicacion, focoTrasExplicacion, esperaExplicar, debeAvanzarExplicacion,
  efectoDialogoGuia, ignoraTrasCerrar, efectoAtrasGuia, seguirGuia,
} from "./guia.js";
import {
  nuevo, cargar, registrar, dominio, cerrarTurno, nivelDe, cumplirReto,
  textoRacha, semana, resumen, fechaLocal, VENTANA, PARA_SUBIR,
} from "./progreso.js";
import { retoDelDia } from "./reto.js";
import { lineaDeAcierto } from "./frases.js";

const $main = document.getElementById("juego");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const reducido = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const esTv = () => document.documentElement.dataset.modo === "tv";
const sube = () => (esTv() ? "▲" : "+");
const baja = () => (esTv() ? "▼" : "−");
const hoy = () => fechaLocal();

const cache = {};
let pr = nuevo();
let pantalla = "inicio";
let partida = null;
let guia = null;
let overlay = false;
let token = 0;
let animFrame = 0;
let tragar = false;
let drag = null;
let guiaBrillo = false;
let focoSalir = "";
let relojFocus = false;
let fondoToque = false;
let explicarGen = 0;
let cerradoEn = 0;

try {
  if (new URLSearchParams(location.search).get("modo") === "tv") document.documentElement.dataset.modo = "tv";
} catch { /* abierto fuera del navegador */ }

function luego(fn, ms) {
  const t = ++token;
  setTimeout(() => { if (t === token) fn(); }, ms);
}
function cortar() {
  token++;
  if (animFrame) cancelAnimationFrame(animFrame);
  animFrame = 0;
}

function arte() {
  return Promise.all(["reloj", "reloj-digital"].map((n) =>
    fetch(new URL(`../img/${n}.svg`, import.meta.url))
      .then((r) => r.text())
      .then((t) => { cache[n] = t; })
      .catch(() => { cache[n] = ""; })));
}

function hablar(texto, alTerminar) {
  if (!pr.voz || !texto) return false;
  return decir(texto, "es-MX", alTerminar);
}

// La explicación ya se dice en programarExplicacion, para enganchar el fin de la voz.
function hablarPasoGuia() {
  if (!guia || esExplicacion(guia.paso)) return;
  hablar(vozPaso(guia.paso, esTv()));
}

const guardar = () => Noli.guardar(pr);
const elegido = () => Math.min(pr.elegido || pr.nivel, pr.nivel);

function mostrar(html, nombre, focoId) {
  pantalla = nombre;
  $main.className = "p-" + nombre;
  $main.innerHTML = html;
  aplicarSvgs($main);
  const el = focoId && $main.querySelector(`[data-foco-id="${focoId}"]`);
  if (el) el.focus({ preventScroll: true });
  else focoInicial($main);
}

function aplicarSvgs(raiz) {
  const host = raiz.querySelector(".svg-reloj");
  if (host && !host.querySelector("svg")) host.innerHTML = cache.reloj || "";
  for (const n of raiz.querySelectorAll(".digital")) {
    if (!n.querySelector("svg")) n.innerHTML = cache["reloj-digital"] || "";
    const h = n.querySelector("#hora");
    const a = n.querySelector("#ampm");
    if (h) {
      h.textContent = n.dataset.hora || "";
      if (!n.dataset.ampm) h.setAttribute("x", "120");
    }
    if (a) a.textContent = n.dataset.ampm || "";
  }
  ponerManos(raiz);
}

function ponerManos(raiz, tiempo, bien) {
  const svg = raiz.querySelector(".svg-reloj svg");
  if (!svg) return;
  const t = tiempo || tiempoEnPantalla();
  if (!t) return;
  const hor = svg.querySelector("#horario");
  const min = svg.querySelector("#minutero");
  if (hor) hor.setAttribute("transform", `rotate(${anguloHorario(t.h, t.m)})`);
  if (min) min.setAttribute("transform", `rotate(${anguloMinutero(t.m)})`);
  const mins = svg.querySelector("#minutos");
  const mostrar = raiz.querySelector(".relojes")?.dataset.minutos === "1";
  if (mins) mins.style.display = mostrar ? "" : "none";
  const sector = svg.querySelector("#sector");
  const d = raiz.querySelector(".relojes")?.dataset.sector || "M0 0";
  if (sector) sector.setAttribute("d", d);
  svg.classList.toggle("manos-bien", bien ?? raiz.classList.contains("manos-bien"));
  const luz = raiz.dataset.luzMano || "";
  svg.classList.toggle("luz-horario", luz === "horario");
  svg.classList.toggle("luz-minutero", luz === "minutero");
  const marca = Number(raiz.querySelector(".relojes")?.dataset.marca || 0);
  for (let i = 1; i <= 12; i++) {
    const n = svg.querySelector("#n" + i);
    if (n) n.setAttribute("fill", i === marca ? "#ff6b4a" : "#2b2236");
  }
}

function tiempoEnPantalla() {
  if (guia) return guia.reloj;
  if (!partida) return null;
  return partida.vista || partida.actual;
}

// ---------- Dibujo compartido ----------

const PALOMA = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10" fill="none" stroke="#143024" stroke-width="3" stroke-linecap="round"/></svg>`;
function estrella(on) {
  return `<svg viewBox="0 0 24 24" class="${on ? "on" : "off"}" aria-hidden="true"><path d="M12 2.5l2.7 6.3 6.8.6-5.2 4.4 1.6 6.6L12 16.8 6.1 20.4l1.6-6.6L2.5 9.4l6.8-.6z"/></svg>`;
}
function estrellasHtml(n) {
  return `<span class="estrellas" aria-label="${n} de 3">${[0, 1, 2].map((i) => estrella(i < n)).join("")}</span>`;
}
const FLAMA = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1.5-4.5 3-6 0 2 1 3 2 3 0-3-1-6 1-9z" fill="#ff6b4a"/><path d="M12 13c.5 2 3 3 3 5.5a3 3 0 0 1-6 0c0-1.5 1-2.5 3-5.5z" fill="#ffc43d"/></svg>`;
const CANDADO = `<svg class="ico" viewBox="0 0 24 24" aria-label="Bloqueado"><rect x="5" y="10" width="14" height="11" rx="2.5" fill="currentColor" opacity=".5"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>`;

const DIAS = ["D", "L", "M", "M", "J", "V", "S"];
function semanaHtml() {
  return `<div class="semana" aria-label="Últimos 7 días">${semana(pr, hoy()).map((d) => {
    const [y, m, dd] = d.fecha.split("-").map(Number);
    const dia = DIAS[new Date(y, m - 1, dd).getDay()];
    return `<span class="dia ${d.reto ? "reto" : d.jugo ? "jugo" : ""}"><span class="punto">${d.reto ? PALOMA : ""}</span>${dia}</span>`;
  }).join("")}</div>`;
}

function htmlControles(opts) {
  const up = sube();
  const down = baja();
  const par = (id, nombre) => `
    <div class="par${opts.luz === id ? " luz" : ""}" data-luz="${id}" data-foco${opts.foco === id ? '="inicial"' : ""} data-foco-id="${id}" data-ctrl="${id}" tabindex="0" role="group" aria-label="${nombre}">
      <button type="button" class="flecha" tabindex="-1" data-act="paso" data-ctrl="${id}" data-dir="1" aria-label="Subir ${nombre}">${up}</button>
      <span class="etiq">${nombre}</span>
      <button type="button" class="flecha" tabindex="-1" data-act="paso" data-ctrl="${id}" data-dir="-1" aria-label="Bajar ${nombre}">${down}</button>
    </div>`;
  const listoCls = `boton primario listo${opts.brilla ? " brilla" : ""}${opts.listoOn ? "" : " bloqueado"}${opts.luz === "listo" ? " luz" : ""}`;
  return `<div class="controles${opts.bloqueado ? " bloqueado" : ""}">
    ${par("hora", "Hora")}
    ${par("minutos", "Minutos")}
    <button type="button" class="boton" data-luz="borrar" data-foco data-foco-id="borrar" data-ctrl="borrar" data-act="borrar">Borrar</button>
    <button type="button" class="${listoCls}" data-luz="listo" data-foco data-foco-id="listo" data-ctrl="listo" data-act="listo" ${opts.listoOn ? "" : 'aria-disabled="true"'}>Listo</button>
  </div>`;
}

function htmlOpciones(escena, fase) {
  if (!escena?.opciones) return "";
  if (escena.tipo === "leer") {
    return `<div class="opciones">${escena.opciones.map((o, i) => `
      <button type="button" class="opcion${fase === "manos" && o.buena ? " asi" : ""}" data-foco${i === 0 ? "" : ""} data-foco-id="op${i}" data-act="elegir" data-i="${i}" aria-label="${digital(o.h, o.m)}">
        <span class="digital" data-hora="${digital(o.h, o.m)}" data-ampm=""></span>
      </button>`).join("")}</div>`;
  }
  if (escena.tipo === "momento") {
    return `<div class="opciones partes">${escena.opciones.map((o, i) => `
      <button type="button" class="opcion${fase === "manos" && o.buena ? " asi" : ""}" data-foco data-foco-id="op${i}" data-act="elegir" data-i="${i}" aria-label="${esc(o.texto)}">
        <img alt="" src="img/${o.arte}.svg">
      </button>`).join("")}</div>`;
  }
  return `<div class="opciones palabras">${escena.opciones.map((o, i) => `
    <button type="button" class="boton opcion-palabra${fase === "manos" && o.buena ? " asi" : ""}" data-foco data-foco-id="op${i}" data-act="elegir" data-i="${i}">${esc(o.texto)}</button>`).join("")}</div>`;
}

function htmlReloj(opts) {
  return `<div class="relojes" data-minutos="${opts.mostrarMinutos ? "1" : "0"}" data-sector="${esc(opts.sector || "M0 0")}" data-marca="${opts.marca || 0}">
    <div class="reloj-cara${opts.luzReloj ? " luz" : ""}" data-luz="reloj" data-foco${opts.focoReloj ? '="inicial"' : ""} data-foco-id="reloj" data-ctrl="reloj" tabindex="0" role="img" aria-label="Reloj">
      <span class="svg-reloj"></span>
    </div>
    ${opts.digital ? `<div class="digital-lado digital" data-hora="${esc(opts.digital)}" data-ampm=""></div>` : ""}
  </div>`;
}

// ---------- Inicio, progreso, reto ----------

function inicio(focoId) {
  cortar();
  callar();
  overlay = false;
  partida = null;
  guia = null;
  const n = elegido();
  const dn = NIVELES[n - 1];
  const dm = dominio(pr, n);
  const reto = pr.retos[hoy()];
  const dragon = pr.album ? "dragon-feliz" : "dragon-dormido";
  mostrar(`
    <h1 class="titulo">El Reloj del Dragón</h1>
    <div class="hero">
      <img class="dragon-home" alt="" src="img/${dragon}.svg">
      <div class="album" aria-label="Álbum">${ALBUM.map((a, i) => `
        <span class="estampa">${i < pr.album ? `<img alt="${esc(a.nombre)}" src="img/${a.arte}.svg">` : `<img alt="Cerrado" src="img/album-cerrado.svg">`}</span>`).join("")}</div>
    </div>
    <div class="menu">
      <p class="sub">Nivel ${n}: ${esc(dn.nombre)}</p>
      ${dm.listo || pr.niveles[n]?.dominado ? `<p class="dominio ok">¡Ya dominas este nivel!</p>` : `<div class="dominio"><div class="barra"><i style="width:${Math.round((100 * dm.intentos) / VENTANA)}%"></i></div><small>${dm.aciertos} de ${VENTANA} para subir</small></div>`}
      <button type="button" class="boton grande primario" data-foco="inicial" data-foco-id="jugar" data-act="ir" data-ir="ronda">Jugar</button>
      <button type="button" class="boton grande ${reto?.cumplido ? "hecho" : "reto"}" data-foco data-foco-id="reto" data-act="ir" data-ir="retoIntro">Reto del día <small>${reto?.cumplido ? "Cumplido" : "Te espera"}</small></button>
      <button type="button" class="boton grande" data-foco data-foco-id="guia" data-act="ir" data-ir="guia">¿Cómo se juega?</button>
      <button type="button" class="boton grande" data-foco data-foco-id="progreso" data-act="ir" data-ir="progreso">Mi progreso</button>
      <div class="fila-chica">
        <button type="button" class="boton" data-foco data-foco-id="voz" data-act="ir" data-ir="voz">Voz: ${pr.voz ? "sí" : "no"}</button>
        <button type="button" class="boton" data-foco data-foco-id="ingles" data-act="ir" data-ir="ingles">Inglés: ${pr.ingles ? "sí" : "no"}</button>
      </div>
    </div>`, "inicio", focoId || "jugar");
}

function progreso() {
  overlay = false;
  mostrar(`
    <h1 class="titulo">Mi progreso</h1>
    <p class="racha">${FLAMA}<span>${esc(textoRacha(pr, hoy()))}</span></p>
    ${semanaHtml()}
    <ol class="mapa">${NIVELES.map((x) => {
      const nv = pr.niveles[x.n];
      const abierto = x.n <= pr.nivel;
      const dm = dominio(pr, x.n);
      const estado = nv?.dominado ? estrellasHtml(nv.estrellas || 0) : abierto ? `<span>${dm.aciertos} de ${VENTANA}</span>` : CANDADO;
      return `<li><button type="button" class="nivel ${nv?.dominado ? "dominado" : abierto ? "abierto" : "cerrado"}${x.n === elegido() ? " actual" : ""}" ${abierto ? `data-foco${x.n === elegido() ? '="inicial"' : ""} data-foco-id="n${x.n}" data-act="ir" data-ir="elegir" data-n="${x.n}"` : "disabled"}>
        <b class="num">${x.n}</b><span class="nom">${esc(x.nombre)}<small>${esc(x.ejemplo)}</small></span>${estado}</button></li>`;
    }).join("")}</ol>
    <div class="menu fila">
      <button type="button" class="boton" data-foco data-foco-id="volver" data-act="ir" data-ir="inicio">El reloj</button>
      <button type="button" class="boton" data-foco data-act="ir" data-ir="papas">Para papás</button>
    </div>`, "progreso", "n" + elegido());
}

function papas() {
  const R = resumen(pr);
  mostrar(`
    <h1 class="titulo">Para papás</h1>
    <p class="nota">Sube con ${PARA_SUBIR} de los últimos ${VENTANA}, solo si el primer intento fue a la primera. Dar más de una vuelta al minutero no cuenta como a la primera. «Menos cuarto» es su nivel, siempre con el reloj digital al lado, y la frase está en un solo lugar del juego. Mañana, tarde y noche evitan las 12. ¿Cuánto falta? es una elección: un cuarto, media hora o 1 hora, con un arco en la carátula. La racha no se rompe en voz alta. El progreso se guarda en este dispositivo.</p>
    <table class="tabla"><thead><tr><th>Nivel</th><th>Veces</th><th>A la primera</th></tr></thead><tbody>
      ${R.filter((x) => x.desbloqueado || x.total).map((x) => `<tr><td>${x.n}. ${esc(x.nombre)}</td><td>${x.total}</td><td>${x.pct == null ? "–" : x.pct + " %"}</td></tr>`).join("")}
    </tbody></table>
    <div class="menu fila"><button type="button" class="boton" data-foco="inicial" data-act="ir" data-ir="progreso">Regresar</button></div>`, "papas", "volver");
}

function retoIntro() {
  const reto = retoDelDia(hoy(), pr.nivel);
  const hecho = pr.retos[hoy()];
  mostrar(`
    <h1 class="titulo">Reto del día</h1>
    <div class="tarjeta-reto">
      <b>${esc(reto.nombre)}</b>
      <p>${esc(reto.meta)}</p>
      ${hecho?.cumplido ? `<p>¡Ya lo cumpliste hoy! Puedes jugarlo otra vez.</p>` : ""}
    </div>
    <div class="menu fila">
      <button type="button" class="boton grande primario" data-foco="inicial" data-foco-id="empezar" data-act="ir" data-ir="retoJugar">¡Empezar!</button>
      <button type="button" class="boton grande" data-foco data-act="ir" data-ir="inicio">El reloj</button>
    </div>
    <p class="racha">${FLAMA}<span>${esc(textoRacha(pr, hoy()))}</span></p>
    ${semanaHtml()}`, "retoIntro", "empezar");
}

function finTurno() {
  const antesAlbum = pr.album;
  const n = partida.n;
  const aciertos = partida.aciertos;
  const r = cerrarTurno(pr, n, aciertos);
  pr = r.pr;
  guardar();
  Noli.terminar({ estrellas: r.estrellas });
  const estampa = r.pr.album > antesAlbum ? ALBUM[antesAlbum] : null;
  const titulos = ["¡Buen intento!", "¡Bien hecho!", "¡Muy bien!", "¡Perfecto!"];
  mostrar(`
    <h1 class="titulo">${titulos[r.estrellas]}</h1>
    ${estrellasHtml(r.estrellas)}
    <p class="sub">${aciertos} de ${POR_TURNO} a la primera</p>
    ${r.subio ? `<div class="subio"><b>¡Subiste al nivel ${r.subio}!</b><span>${esc(NIVELES[r.subio - 1].nombre)}</span></div>` : ""}
    ${estampa ? `<p class="sub">Nueva estampa: ${esc(estampa.nombre)}</p><img class="estampa-grande" alt="" src="img/${estampa.arte}.svg">` : ""}
    <div class="menu fila">
      <button type="button" class="boton grande primario" data-foco="inicial" data-act="ir" data-ir="ronda">${r.subio ? "Probar el nivel nuevo" : "Otro día"}</button>
      <button type="button" class="boton grande" data-foco data-act="ir" data-ir="inicio">El reloj</button>
    </div>`, "fin");
  partida = null;
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
    <h1 class="titulo">${cumplido ? "¡Reto cumplido!" : "Sigue practicando"}</h1>
    <p class="sub">${puntos} de ${r.cuantos}. Meta: ${r.necesita}.</p>
    ${cumplido && !antes ? `<p class="racha">${FLAMA}<span>${esc(textoRacha(pr, hoy()))}</span></p>` : ""}
    <div class="menu fila">
      <button type="button" class="boton grande primario" data-foco="inicial" data-act="ir" data-ir="${cumplido ? "inicio" : "retoJugar"}">${cumplido ? "El reloj" : "Otra vez"}</button>
      ${cumplido ? "" : `<button type="button" class="boton grande" data-foco data-act="ir" data-ir="inicio">El reloj</button>`}
    </div>
    ${semanaHtml()}`, "finReto");
  partida = null;
}

// ---------- Guía ----------

function abrirGuia() {
  cortar();
  callar();
  overlay = false;
  partida = null;
  guia = guiaNueva();
  guiaBrillo = false;
  pintarGuia("escena");
  hablarPasoGuia();
}

function terminarGuia() {
  cortar();
  callar();
  guia = null;
  pr = { ...pr, guia: true };
  guardar();
  inicio("jugar");
}

function luzGuia() {
  const id = PASOS[guia.paso]?.luz;
  if (id === "horario" || id === "minutero") return "reloj";
  return id || "";
}

function pintarGuia(focoId) {
  const paso = guia.paso;
  const luz = luzGuia();
  const listoOn = paso === 4 && misma(guia.reloj, META_GUIA);
  const marca = luz === "hora" ? META_GUIA.h : 0;
  $main.dataset.luzMano = PASOS[paso]?.luz || "";
  $main.className = "p-guia guia cielo-tarde";
  pantalla = "guia";
  $main.innerHTML = `
    <div class="tira guia-top">
      <button type="button" class="boton saltar" data-foco data-foco-id="saltar" data-ctrl="saltar" data-act="saltar">Saltar</button>
      <button type="button" class="escena-guia${luz === "escena" ? " luz" : ""}" data-luz="escena" data-foco${focoId === "escena" ? '="inicial"' : ""} data-foco-id="escena" data-ctrl="escena" data-act="escena" aria-label="El dragón come">
        <img alt="" src="img/escena-comida.svg">
      </button>
      <button type="button" class="boton oir" data-foco data-foco-id="oir" data-ctrl="oir" data-act="oir">Oír</button>
    </div>
    <div class="coach">
      <img class="dragon" alt="" src="img/dragon.svg">
      <p class="frase">${esc(textoPaso(paso, esTv()))}</p>
    </div>
    ${htmlReloj({ mostrarMinutos: false, focoReloj: false, luzReloj: luz === "reloj", marca, digital: "" })}
    ${htmlControles({ luz, brilla: listoOn, listoOn, foco: focoId })}`;
  aplicarSvgs($main);
  const el = $main.querySelector(`[data-foco-id="${focoId || "escena"}"]`);
  if (el) el.focus({ preventScroll: true });
  programarExplicacion();
  if (listoOn && !guiaBrillo) {
    guiaBrillo = true;
    sonidoListo();
    $main.querySelector('[data-foco-id="listo"]')?.focus({ preventScroll: true });
  }
  if (!listoOn) guiaBrillo = false;
}

function moverRelojGuia(ctrl, dir) {
  if (ctrl === "hora") guia.reloj = moverHora(guia.reloj, dir);
  else guia.reloj = moverMinutos(guia.reloj, dir);
  clic();
  const antes = guia.paso;
  guia = aplicarGuia(guia, { tipo: "mover", reloj: guia.reloj });
  if (guia.fin) return terminarGuia();
  if (guia.paso !== antes) {
    pintarGuia(ctrl);
    hablarPasoGuia();
  } else refrescarGuia();
}

function refrescarGuia() {
  $main.dataset.luzMano = PASOS[guia.paso]?.luz || "";
  ponerManos($main, guia.reloj, false);
  const listoOn = guia.paso === 4 && misma(guia.reloj, META_GUIA);
  const b = $main.querySelector('[data-ctrl="listo"]');
  if (b) {
    b.classList.toggle("brilla", listoOn);
    b.classList.toggle("bloqueado", !listoOn);
    if (listoOn) b.removeAttribute("aria-disabled");
    else b.setAttribute("aria-disabled", "true");
  }
  if (listoOn && !guiaBrillo) {
    guiaBrillo = true;
    sonidoListo();
    b?.focus({ preventScroll: true });
  }
  if (!listoOn) guiaBrillo = false;
}

function alFocoGuia(ctrl) {
  const antes = guia.paso;
  guia = aplicarGuia(guia, { tipo: "foco", control: ctrl, reloj: guia.reloj });
  if (guia.fin) return terminarGuia();
  if (guia.paso !== antes) {
    pintarGuia(ctrl === "minutos" && guia.paso === 4 ? "listo" : ctrl);
    hablarPasoGuia();
  }
}

function pasoGuia(ctrl, dir) {
  if (!guia) return;
  if (ctrl === "hora" && guia.paso < 2) {
    alFocoGuia("hora");
    if (guia && guia.paso === 2) moverRelojGuia("hora", dir);
    return;
  }
  if (ctrl === "minutos" && guia.paso <= 3 && misma(guia.reloj, META_GUIA)) {
    alFocoGuia("minutos");
    return;
  }
  if (guia.paso < 2) {
    alFocoGuia(ctrl);
    return;
  }
  moverRelojGuia(ctrl, dir);
}

function programarExplicacion() {
  cortar();
  if (!guia || !esExplicacion(guia.paso)) return;
  const paso = guia.paso;
  const linea = vozPaso(paso, esTv());
  const gen = ++explicarGen;
  const t0 = performance.now();
  let acortada = false;
  let vozLista = false;
  let msVoz = 0;
  const avanzar = () => {
    if (gen !== explicarGen || !guia || guia.paso !== paso) return;
    const transcurrido = performance.now() - t0;
    if (!debeAvanzarExplicacion({ dialog: overlay, transcurrido, voz: hablada, termino: vozLista, msVoz })) return;
    explicarGen++;
    seguirExplicacion();
  };
  const alAcabar = () => {
    if (gen !== explicarGen || overlay) return;
    acortada = true;
    vozLista = true;
    msVoz = performance.now() - t0;
    const falta = esperaExplicar({ voz: true, termino: true, ms: msVoz }) - msVoz;
    luego(avanzar, falta > 40 ? falta : 0);
  };
  callar();
  const hablada = hablar(linea, alAcabar);
  if (!acortada) luego(avanzar, esperaExplicar({ voz: hablada }));
}

function seguirExplicacion() {
  if (!guia || !esExplicacion(guia.paso)) return;
  guia = aplicarGuia(guia, { tipo: "seguir", reloj: guia.reloj });
  pintarGuia(focoTrasExplicacion(guia.paso));
  hablarPasoGuia();
}

function listoGuia() {
  if (!guia) return;
  if (!(guia.paso === 4 && misma(guia.reloj, META_GUIA))) return;
  guia = aplicarGuia(guia, { tipo: "listo", reloj: guia.reloj });
  if (guia.fin) {
    campanada();
    terminarGuia();
  }
}

// ---------- Partida ----------

function infoPista() {
  const e = partida.escena;
  const seg = partida.trasError ? 40 : (Date.now() - partida.t0) / 1000;
  return pista({
    nivel: partida.n,
    tipo: e.tipo,
    objetivo: e,
    actual: partida.actual,
    segundos: seg,
    trasError: partida.trasError,
    tv: esTv(),
    dominado: !!nivelDe(pr, partida.n).dominado,
  });
}

function nuevaRonda() {
  const n = elegido();
  const rnd = rngConSemilla("reloj-turno-" + Date.now());
  partida = { modo: "turno", n, lista: planDia(n, rnd), i: 0, aciertos: 0 };
  cargarEscena();
}

function empezarReto() {
  const reto = retoDelDia(hoy(), pr.nivel);
  partida = { modo: "reto", n: reto.nivel, reto, lista: reto.escenas, i: 0, aciertos: 0 };
  cargarEscena();
}

function cargarEscena() {
  cortar();
  const e = partida.lista[partida.i];
  partida.escena = e;
  partida.actual = { ...e.inicio };
  partida.vista = null;
  partida.fase = null;
  partida.intento = 1;
  partida.pasosMinuto = 0;
  partida.yaBrillo = false;
  partida.t0 = Date.now();
  partida.trasError = partida.modo === "turno" && nivelDe(pr, partida.n).seguidosMal >= 3;
  partida.vozDicha = "";
  overlay = false;
  const foco = e.tipo === "poner" ? "hora" : "op0";
  pintarJuego(foco);
  anunciar();
}

function anunciar() {
  callar();
  if (!pr.voz || !partida) return;
  const e = partida.escena;
  decir(e.voz);
  const p = infoPista();
  if ((partida.n === 1 || partida.trasError) && e.tipo === "poner" && p.voz && p.voz !== e.voz) decir(p.voz);
  partida.vozDicha = p.voz;
}

function sectorDe(e, fase) {
  if (e.tipo !== "cuanto") return "M0 0";
  return sectorPath(e.h, e.m, e.h2, e.m2);
}

function pintarJuego(focoId) {
  const e = partida.escena;
  const fase = partida.fase;
  const p = infoPista();
  const t = partida.vista || partida.actual;
  const poner = e.tipo === "poner";
  const coincide = poner && !fase && misma(t, e);
  const dragon = fase === "gag" ? "dragon-pijama" : fase === "bien" ? "dragon-feliz" : "dragon";
  const frase = fase === "gag" ? e.chiste : fase === "manos" ? "Así era." : fase === "bien" ? (partida.linea || lineaDeAcierto(partida.i, 0)) : e.frase;
  const ingles = pr.ingles && e.ingles && !fase ? e.ingles : "";
  const momento = MOMENTOS.find((m) => m.id === e.momento);
  $main.dataset.luzMano = fase === "manos" || fase === "bien" ? "horario" : (p.luz === "horario" ? "horario" : p.luz === "minutero" ? "minutero" : "");
  $main.className = `p-jugar ${e.cielo || "cielo-dia"}${fase ? " fase-" + fase : ""}`;
  pantalla = "jugar";
  const marca = poner && p.luz === "hora" ? hora12(e.h) : 0;
  $main.innerHTML = `
    <div class="tira" aria-label="Día del dragón">${partida.lista.map((escena, i) => `
      <span class="mini${i === partida.i ? " ahora" : ""}${i < partida.i ? " hecha" : ""}"><img alt="" src="img/${escena.escena}.svg">${i < partida.i ? `<i class="palo">${PALOMA}</i>` : ""}</span>`).join("")}</div>
    <div class="lado">
      <img class="dragon" alt="" src="img/${dragon}.svg">
      <div class="frase-caja">
        <p class="frase${fase === "gag" ? " chiste" : ""}" aria-live="polite">${esc(frase)}</p>
        ${ingles ? `<p class="ingles">${esc(ingles)}</p>` : ""}
      </div>
      <img class="escena-mini" alt="" src="img/${momento.escena}.svg">
      <button type="button" class="boton oir" data-foco data-foco-id="oir" data-ctrl="oir" data-act="oir">Oír</button>
    </div>
    ${htmlReloj({
      mostrarMinutos: !!p.mostrarMinutos,
      focoReloj: !poner && focoId === "reloj",
      luzReloj: false,
      marca,
      digital: e.digitalAlLado ? digital(e.h, e.m) : "",
      sector: sectorDe(e, fase),
    })}
    <p class="pista" data-v="${esc(p.texto)}" aria-live="polite">${fase ? "" : esc(p.texto)}</p>
    ${poner ? htmlControles({
      luz: p.luz, brilla: coincide, listoOn: true, bloqueado: !!fase, foco: focoId,
    }) : `<div class="controles${fase ? " bloqueado" : ""}">${htmlOpciones(e, fase)}</div>`}`;
  $main.classList.toggle("manos-bien", fase === "manos" || fase === "bien");
  aplicarSvgs($main);
  const id = focoId || (poner ? "hora" : "reloj");
  const el = $main.querySelector(`[data-foco-id="${id}"]`);
  if (el) el.focus({ preventScroll: true });
  if (coincide && !partida.yaBrillo && !fase) {
    partida.yaBrillo = true;
    sonidoListo();
    $main.querySelector('[data-foco-id="listo"]')?.focus({ preventScroll: true });
  }
}

function refrescarJuego() {
  if (pantalla !== "jugar" || !partida || partida.fase) return;
  const e = partida.escena;
  const p = infoPista();
  const t = partida.actual;
  const relojes = $main.querySelector(".relojes");
  if (relojes) {
    relojes.dataset.minutos = p.mostrarMinutos ? "1" : "0";
    relojes.dataset.marca = e.tipo === "poner" && p.luz === "hora" ? String(hora12(e.h)) : "0";
    relojes.dataset.sector = sectorDe(e);
  }
  $main.dataset.luzMano = p.luz === "horario" ? "horario" : p.luz === "minutero" ? "minutero" : "";
  ponerManos($main, t, false);
  const pistaEl = $main.querySelector(".pista");
  if (pistaEl && pistaEl.dataset.v !== p.texto) {
    pistaEl.textContent = p.texto;
    pistaEl.dataset.v = p.texto;
  }
  if (p.voz && p.voz !== partida.vozDicha && (partida.trasError || (Date.now() - partida.t0) >= 20000)) {
    partida.vozDicha = p.voz;
    hablar(p.voz);
  }
  if (e.tipo !== "poner") return;
  const coincide = misma(t, e);
  const b = $main.querySelector('[data-ctrl="listo"]');
  if (b) b.classList.toggle("brilla", coincide);
  if (coincide && !partida.yaBrillo) {
    partida.yaBrillo = true;
    sonidoListo();
    b?.focus({ preventScroll: true });
  }
  if (!coincide) partida.yaBrillo = false;
  for (const id of ["hora", "minutos"]) {
    $main.querySelector(`.par[data-ctrl="${id}"]`)?.classList.toggle("luz", p.luz === id);
  }
}

function moverPoner(ctrl, dir) {
  if (!partida || partida.fase || partida.escena.tipo !== "poner") return;
  if (ctrl === "hora") partida.actual = moverHora(partida.actual, dir);
  else {
    partida.actual = moverMinutos(partida.actual, dir);
    partida.pasosMinuto += 1;
  }
  partida.vista = null;
  clic();
  refrescarJuego();
}

function borrarPoner() {
  if (!partida || partida.fase || partida.escena.tipo !== "poner") return;
  partida.actual = { ...partida.escena.inicio };
  partida.vista = null;
  partida.yaBrillo = false;
  clic();
  refrescarJuego();
  $main.querySelector('[data-foco-id="hora"]')?.focus({ preventScroll: true });
}

function anotar(ok) {
  if (partida.intento !== 1) return;
  const primera = ok && (partida.escena.tipo !== "poner" || cuentaPrimera(1, partida.pasosMinuto));
  if (partida.modo === "turno") {
    pr = registrar(pr, partida.n, { ok: primera }, hoy());
    guardar();
  }
  if (primera) partida.aciertos++;
}

function confirmarPoner() {
  if (!partida || partida.fase || partida.escena.tipo !== "poner") return;
  const ok = misma(partida.actual, partida.escena);
  anotar(ok);
  if (ok) exito();
  else empezarGag();
}

function elegirOpcion(i) {
  if (!partida || partida.fase || partida.escena.tipo === "poner") return;
  const op = partida.escena.opciones[i];
  if (!op) return;
  clic();
  const ok = !!op.buena;
  anotar(ok);
  if (ok) exito();
  else empezarGag();
}

function empezarGag() {
  partida.fase = "gag";
  partida.intento = 2;
  partida.trasError = true;
  partida.faseHasta = performance.now() + GAG_MS;
  pintarJuego(partida.escena.tipo === "poner" ? "hora" : "reloj");
  programarEspera();
}

function programarEspera() {
  if (!partida || overlay) return;
  const queda = Math.max(0, (partida.faseHasta || 0) - performance.now());
  if (partida.fase === "gag") luego(() => { if (partida?.fase === "gag" && !overlay) ensenarManos(); }, queda);
  else if (partida.fase === "bien") luego(() => { if (partida?.fase === "bien" && !overlay) avanzar(); }, queda);
}

function ensenarManos() {
  if (!partida) return;
  partida.fase = "manos";
  const destino = { h: partida.escena.h, m: partida.escena.m };
  const desde = { ...partida.actual };
  partida.vista = { ...desde };
  pintarJuego("reloj");
  const seguir = () => luego(() => { if (partida?.fase === "manos") reintentar(); }, reducido() ? 200 : 400);
  if (partida.escena.tipo !== "poner" || reducido() || misma(desde, destino)) {
    partida.vista = destino;
    ponerManos($main, destino, true);
    seguir();
    return;
  }
  animar(desde, destino, 700, seguir);
}

function animar(desde, hasta, ms, alFin) {
  const a = desde.h * 60 + desde.m;
  const b = hasta.h * 60 + hasta.m;
  let d = ((b - a) % 1440 + 1440) % 1440;
  if (d > 720) d -= 1440;
  const t0 = performance.now();
  const paso = (ahora) => {
    if (!partida || partida.fase !== "manos") return;
    const k = Math.min(1, (ahora - t0) / ms);
    const cur = a + d * k;
    const dia = ((cur % 1440) + 1440) % 1440;
    partida.vista = { h: Math.floor(dia / 60), m: dia % 60 };
    ponerManos($main, partida.vista, k > 0.85);
    if (k < 1) animFrame = requestAnimationFrame(paso);
    else alFin();
  };
  animFrame = requestAnimationFrame(paso);
}

function reintentar() {
  if (!partida) return;
  cortar();
  partida.fase = null;
  partida.vista = null;
  partida.actual = { ...partida.escena.inicio };
  partida.pasosMinuto = 0;
  partida.yaBrillo = false;
  partida.t0 = Date.now();
  partida.vozDicha = "";
  pintarJuego(partida.escena.tipo === "poner" ? "hora" : "op0");
  const p = infoPista();
  partida.vozDicha = p.voz;
  hablar(p.voz);
}

function exito() {
  partida.fase = "bien";
  partida.linea = lineaDeAcierto(partida.i, nivelDe(pr, partida.n).turnos || 0);
  partida.vista = { h: partida.escena.h, m: partida.escena.m };
  partida.faseHasta = performance.now() + (reducido() ? 350 : 800);
  campanada();
  pintarJuego("reloj");
  programarEspera();
}

function avanzar() {
  if (!partida) return;
  cortar();
  partida.i++;
  if (partida.i >= partida.lista.length) {
    if (partida.modo === "reto") return finReto();
    return finTurno();
  }
  cargarEscena();
}

function saltarFase() {
  if (!partida?.fase) return false;
  cortar();
  if (partida.fase === "gag") { ensenarManos(); return true; }
  if (partida.fase === "manos") { reintentar(); return true; }
  if (partida.fase === "bien") { avanzar(); return true; }
  return false;
}

// ---------- Salir ----------

function preguntarSalir() {
  if (overlay) return;
  if (guia && efectoDialogoGuia(true) === "pausar") {
    explicarGen++;
    cortar();
    callar();
  }
  if (partida && atrasEnEspera(partida.fase) === "salir") {
    partida.queda = Math.max(0, (partida.faseHasta || 0) - performance.now());
    cortar();
  }
  focoSalir = document.activeElement?.dataset?.focoId || "";
  overlay = true;
  const velo = document.createElement("div");
  velo.className = "velo";
  velo.innerHTML = `<div class="dialogo" role="dialog" aria-label="¿Salir?">
      <p>¿Salir?</p>
      <button type="button" class="boton grande primario" data-foco="inicial" data-foco-id="seguir" data-act="seguir">Seguir</button>
      <button type="button" class="boton grande" data-foco data-foco-id="salir" data-act="salir-si">Salir</button>
    </div>`;
  $main.appendChild(velo);
  velo.querySelector("[data-foco-id='seguir']")?.focus({ preventScroll: true });
}

function cerrarSalir() {
  overlay = false;
  cerradoEn = performance.now();
  $main.querySelector(".velo")?.remove();
  const el = (focoSalir && $main.querySelector(`[data-foco-id="${focoSalir}"]`)) || $main.querySelector("[data-foco]");
  el?.focus({ preventScroll: true });
  focoSalir = "";
  if (guia) {
    const quieta = seguirGuia(guia);
    guia.paso = quieta.paso;
    guia.fin = quieta.fin;
    if (esExplicacion(guia.paso) && efectoDialogoGuia(false) === "reiniciar") programarExplicacion();
    return;
  }
  const plan = alCerrarEspera(partida?.fase, partida?.queda);
  if (plan.hacer === "manos") ensenarManos();
  else if (plan.hacer === "siguiente") avanzar();
  else if (plan.hacer === "esperar" && partida) {
    partida.faseHasta = performance.now() + plan.ms;
    programarEspera();
  }
}

// ---------- Teclas ----------

const CICLO = ["saltar", "escena", "hora", "minutos", "listo", "borrar", "oir"];

function controlEl(id) {
  return $main.querySelector(`[data-foco][data-ctrl="${id}"]`);
}

function moverCiclo(dir) {
  const ids = CICLO.filter((id) => controlEl(id));
  if (!ids.length) return false;
  let i = ids.indexOf(document.activeElement?.dataset?.ctrl);
  if (i < 0) i = dir > 0 ? 0 : ids.length - 1;
  else i = (i + dir + ids.length) % ids.length;
  const el = controlEl(ids[i]);
  el?.focus({ preventScroll: true });
  if (guia) alFocoGuia(ids[i]);
  return true;
}

function teclaPoner(accion) {
  if (guia && esExplicacion(guia.paso) && accion === "ok") {
    const act = document.activeElement?.dataset?.act;
    if (act !== "saltar" && act !== "oir") {
      seguirExplicacion();
      return true;
    }
  }
  const ctrl = document.activeElement?.dataset?.ctrl;
  if ((accion === "arriba" || accion === "abajo") && (ctrl === "hora" || ctrl === "minutos")) {
    if (guia) pasoGuia(ctrl, accion === "arriba" ? 1 : -1);
    else moverPoner(ctrl, accion === "arriba" ? 1 : -1);
    return true;
  }
  if (accion === "izquierda" || accion === "derecha") return moverCiclo(accion === "derecha" ? 1 : -1);
  if (accion === "ok") {
    const e = document.activeElement;
    if (e?.dataset?.act === "listo" || e?.dataset?.ctrl === "listo") {
      if (guia) listoGuia();
      else confirmarPoner();
      return true;
    }
    if (e && $main.contains(e) && e.dataset.act) e.click();
    return true;
  }
  if (accion === "atras") {
    if (!guia || efectoAtrasGuia(false) === "preguntar") preguntarSalir();
    return true;
  }
  return true;
}

const IR = {
  inicio: () => inicio(),
  ronda: nuevaRonda,
  retoIntro,
  retoJugar: empezarReto,
  guia: abrirGuia,
  progreso,
  papas,
  voz: () => { pr = { ...pr, voz: !pr.voz }; if (!pr.voz) callar(); guardar(); inicio("voz"); },
  ingles: () => { pr = { ...pr, ingles: !pr.ingles }; guardar(); inicio("ingles"); },
  elegir: (ds) => { pr = { ...pr, elegido: +ds.n }; guardar(); inicio(); },
};

$main.addEventListener("click", (ev) => {
  if (tragar) { tragar = false; return; }
  const fondo = fondoToque;
  fondoToque = false;
  if (!overlay && ignoraTrasCerrar(performance.now() - cerradoEn)) return;
  const t = ev.target.closest("[data-act], [data-ctrl]");
  const act = t?.dataset?.act || "";
  const decision = toqueEnPantalla({ fase: partida?.fase || "", act, dialog: overlay, fondo });
  if (decision === "seguir") { cerrarSalir(); return; }
  if (decision === "salir") { callar(); Noli.salir(); return; }
  if (decision === "nada") return;
  if (guia && esExplicacion(guia.paso)) {
    if (act !== "saltar" && act !== "oir") {
      seguirExplicacion();
      return;
    }
  }
  if (!t || !$main.contains(t)) return;
  if (act === "paso") {
    const dir = +t.dataset.dir;
    t.closest("[data-foco]")?.focus({ preventScroll: true });
    if (guia) pasoGuia(t.dataset.ctrl, dir);
    else moverPoner(t.dataset.ctrl, dir);
    return;
  }
  if (act === "listo") { if (guia) listoGuia(); else confirmarPoner(); return; }
  if (act === "borrar") {
    if (guia) {
      guia.reloj = { ...INICIO_GUIA };
      guia.paso = Math.min(guia.paso, 2);
      guiaBrillo = false;
      pintarGuia("hora");
      return;
    }
    borrarPoner();
    return;
  }
  if (act === "oir") {
    if (guia) {
      if (esExplicacion(guia.paso)) programarExplicacion();
      else hablar(vozPaso(guia.paso, esTv()));
    }
    else if (partida) hablar(partida.fase ? "" : partida.escena.voz);
    return;
  }
  if (act === "escena") {
    if (!guia) return;
    const antes = guia.paso;
    guia = aplicarGuia(guia, { tipo: "escena", reloj: guia.reloj });
    if (guia.paso !== antes) { pintarGuia("escena"); hablarPasoGuia(); }
    return;
  }
  if (act === "saltar") { terminarGuia(); return; }
  if (act === "elegir") { elegirOpcion(+t.dataset.i); return; }
  if (act === "ir" && IR[t.dataset.ir]) IR[t.dataset.ir](t.dataset);
  else if (!act && t.dataset.ctrl && guia) {
    t.focus({ preventScroll: true });
    alFocoGuia(t.dataset.ctrl);
  }
});

$main.addEventListener("pointerdown", (ev) => {
  document.documentElement.classList.remove("teclado");
  desbloquear();
  if (overlay) {
    const fondo = ev.target.classList?.contains("velo");
    fondoToque = !esTv() && fondo;
    if (fondo) ev.preventDefault();
    return;
  }
  fondoToque = false;
  if (ignoraTrasCerrar(performance.now() - cerradoEn)) {
    tragar = true;
    ev.preventDefault();
    return;
  }
  if (partida?.fase) {
    tragar = true;
    saltarFase();
    return;
  }
  if (guia || !partida || partida.escena.tipo !== "poner" || overlay) return;
  const cara = ev.target.closest(".reloj-cara");
  if (!cara || ev.target.closest("button")) return;
  drag = { m: partida.actual.m };
  relojFocus = true;
  cara.focus({ preventScroll: true });
}, true);

$main.addEventListener("pointermove", (ev) => {
  if (!drag || !partida || partida.fase) return;
  const cara = $main.querySelector(".reloj-cara");
  if (!cara) return;
  const r = cara.getBoundingClientRect();
  const x = ev.clientX - (r.left + r.width / 2);
  const y = ev.clientY - (r.top + r.height / 2);
  let deg = Math.atan2(x, -y) * 180 / Math.PI;
  if (deg < 0) deg += 360;
  const sig = arrastre(partida.actual, deg, drag.m);
  if (sig.m === partida.actual.m && sig.h === partida.actual.h) return;
  partida.pasosMinuto += sig.pasos;
  partida.actual = { h: sig.h, m: sig.m };
  drag.m = sig.m;
  refrescarJuego();
});

function soltar() {
  if (relojFocus) relojFocus = false;
  drag = null;
}
$main.addEventListener("pointerup", soltar);
$main.addEventListener("pointercancel", soltar);

Noli.alEntrar((accion) => {
  fondoToque = false;
  document.documentElement.classList.add("teclado");
  if (!overlay && accion === "ok" && ignoraTrasCerrar(performance.now() - cerradoEn)) return true;
  if (overlay) {
    const dlg = $main.querySelector(".dialogo") || $main;
    if (accion === "atras") {
      if (efectoAtrasGuia(true) === "seguir") cerrarSalir();
      return true;
    }
    if (moverFoco(accion, dlg)) return true;
    if (accion === "ok") {
      const e = document.activeElement;
      if (e && dlg.contains(e)) e.click();
      return true;
    }
    return true;
  }
  if (partida?.fase) {
    if (accion === "atras" && atrasEnEspera(partida.fase) === "salir") {
      preguntarSalir();
      return true;
    }
    saltarFase();
    return true;
  }
  if (guia || (partida && partida.escena.tipo === "poner")) return teclaPoner(accion);
  if (moverFoco(accion, $main)) return true;
  if (accion === "ok") {
    const e = document.activeElement;
    if (e && $main.contains(e) && !e.disabled) e.click();
    return true;
  }
  if (accion === "atras") { preguntarSalir(); return true; }
  return true;
});

setInterval(() => {
  if (pantalla === "jugar" && partida && !partida.fase && !overlay) refrescarJuego();
}, 1000);

Noli.datos.then((d) => { pr = cargar(d); return arte(); }).then(() => {
  if (!pr.guia) abrirGuia();
  else inicio();
});
