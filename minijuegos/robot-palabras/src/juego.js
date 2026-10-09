// Pantallas de Robot de Palabras. La lógica está en los otros módulos.
import { Noli, moverFoco, focoInicial } from "../../../kit/noli.js";
import { dibujosUsados } from "./banco.js";
import {
  MIN_MIRAR_MS, TOPE_VOZ_MS, esMirar, relojNuevo, focoDePaso, saltarEnCiclo,
  aplicarGuia, textoPaso, vozPaso,
} from "./guia.js";
import { aspecto } from "./piezas.js";
import { anulaPrimera, pasoPista, pista } from "./pista.js";
import {
  nuevo, cargar, registrar, dominio, cerrarTurno, anotarFallo,
  guardarGuia, ponerVoz, fechaLocal, cumplirReto, lineaRacha,
} from "./progreso.js";
import {
  efectoOracion, probarBrilla, generarTurno, fraseConPausa, fraseCompleta, focoSiguienteFicha, focoTrasFicha,
} from "./puertas.js";
import { RETO, retoDelDia } from "./reto.js";
import { responder, ignoraEntrada, toqueEnVelo, alTerminarPremio } from "./salida.js";
import { clic, listo, abrir, desbloquear as desbloquearSonido } from "./sonido.js";
import { SALIR, CAJAS, NIVELES, UI, FRASES, PIEZAS, hintDePuerta, hintDeTaller, seRevela, vozDePista } from "./textos.js";
import {
  callar, decirEs, decirIngles, decirPalabra, decirPalabraLuego, decirTrozos, desbloquear as desbloquearVoz,
} from "./voz.js";

const $main = document.getElementById("juego");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const esTv = () => document.documentElement.dataset.modo === "tv";
const ahora = () => performance.now();
const hoy = () => fechaLocal();

const CAJA_SVG = { noun: "caja-sustantivo", verb: "caja-verbo", adjective: "caja-adjetivo" };
const ARTES = [
  "robot-sombra", "robot-cara-normal", "robot-cara-feliz", "robot-cara-duda", "robot-cara-risa",
  "robot-efecto-brillante", "robot-ruedas-1", "robot-ruedas-2", "robot-piernas-1",
  "robot-brazos-1", "robot-brazos-2", "robot-brazos-3",
  "robot-cuerpo-1", "robot-cuerpo-2", "robot-cuerpo-3",
  "robot-cabeza-1", "robot-cabeza-2", "robot-cabeza-3",
  "robot-antena-1", "robot-antena-2", "robot-antena-3",
  "caja-sustantivo", "caja-verbo", "caja-adjetivo", "tarjeta-palabra", "banda-unidades",
  "puerta-mini-abierta", "puerta-mini-cerrada", "puerta-cerrada", "puerta-abierta", "puerta-secreta",
  "boton-probar", "boton-quitar", "boton-escuchar", "flecha-pista", "pieza-nueva",
];

const cache = {};
const dibujos = {};
let pr = nuevo();
let pantalla = "inicio";
let ctx = { dialogo: false, reloj: null, tragarHasta: 0 };
let partida = null;
let vozGuia = { epoch: 0, termino: false };
let vozGen = 0;
let guiaTimer = 0;
let pistaTimer = 0;
let esperaTimer = 0;
let esperaFn = null;
let esperaRestante = 0;
let esperaDesde = 0;
let focoAntes = "";
let trasGuia = "inicio";
let brilloYa = false;
let look = { pintura: "", escala: "", efecto: false, anim: "", cara: "normal" };
let pistaReloj = { t0: 0, base: 0, pausa: false };

try {
  if (new URLSearchParams(location.search).get("modo") === "tv") document.documentElement.dataset.modo = "tv";
} catch { /* abierto fuera del navegador */ }

function arte() {
  const traer = (url, guardar) => fetch(url).then((r) => r.text()).then(guardar).catch(() => guardar(""));
  return Promise.all([
    traer(new URL("../icono.svg", import.meta.url), (t) => { cache.icono = t; }),
    ...ARTES.map((n) => traer(new URL(`../img/${n}.svg`, import.meta.url), (t) => { cache[n] = t; })),
    ...dibujosUsados().map((n) => traer(new URL(`../dibujos/dibujo-${n}.svg`, import.meta.url), (t) => { dibujos[n] = t; })),
  ]);
}

const guardar = () => Noli.guardar(pr);

function interior(svg) {
  return String(svg || "")
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    .replace(/<title>[\s\S]*?<\/title>/, "");
}

function dibujoDe(id, copias) {
  const inn = interior(dibujos[id] || "");
  const n = Math.max(1, copias || 1);
  if (n === 1) return inn;
  let html = "";
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 26;
    html += `<g transform="translate(${x} 0) scale(${n > 2 ? 0.7 : 0.82})">${inn}</g>`;
  }
  return html;
}

function miniSvg(id, copias) {
  const inn = interior(dibujos[id] || "");
  if (!inn) return "";
  const n = Math.max(1, Math.min(3, copias || 1));
  if (n === 1) return `<svg viewBox="0 0 100 100" aria-hidden="true">${inn}</svg>`;
  const s = n > 2 ? 0.34 : 0.46;
  let g = "";
  for (let i = 0; i < n; i++) {
    const x = 50 + (i - (n - 1) / 2) * (n > 2 ? 30 : 42);
    g += `<g transform="translate(${x} 50) scale(${s}) translate(-50 -50)">${inn}</g>`;
  }
  return `<svg viewBox="0 0 100 100" aria-hidden="true">${g}</svg>`;
}

function tarjeta(palabra, dibujo, copias) {
  const pal = String(palabra || "");
  let svg = cache["tarjeta-palabra"] || "";
  if (!svg) return `<p class="marco">${esc(pal)}</p>`;
  svg = svg.replace(/(<g class="dibujo"[^>]*>)[\s\S]*?<\/g>/, (_, open) => `${open}${dibujoDe(dibujo, copias)}</g>`);
  svg = svg.replace(/(<text class="palabra"[^>]*)>([^<]*)<\/text>/, (_, attrs) => {
    const size = pal.length > 7 ? 22 : 32;
    return `${attrs.replace(/font-size="[^"]*"/, `font-size="${size}"`)}>${esc(pal)}</text>`;
  });
  return svg;
}

function robotHtml(estado) {
  const a = aspecto(pr.piezas);
  const cara = estado.cara === "duda" ? "robot-cara-duda"
    : estado.cara === "risa" ? "robot-cara-risa"
    : estado.cara === "feliz" ? "robot-cara-feliz"
    : "robot-cara-normal";
  const capas = [
    "robot-sombra", `robot-${a.base}`, `robot-${a.brazos}`, `robot-${a.cuerpo}`,
    `robot-${a.cabeza}`, `robot-${a.antena}`, cara,
  ];
  if (estado.efecto) capas.push("robot-efecto-brillante");
  const cls = ["robot-lienzo", estado.escala, estado.anim].filter(Boolean).join(" ");
  const style = estado.pintura ? ` style="--pintura:${estado.pintura}"` : "";
  return `<div class="${cls}"${style}><div class="pila">${capas.map((id) => `<div class="capa">${cache[id] || ""}</div>`).join("")}</div></div>`;
}

function estrellasHtml(n) {
  const una = (on) => `<svg viewBox="0 0 24 24" aria-hidden="true"><polygon class="${on ? "on" : "off"}" points="12,2 15,9 22,9 16.5,14 18.5,21 12,17 5.5,21 7.5,14 2,9 9,9"/></svg>`;
  return `<div class="estrellas" aria-label="${n} de 3">${[0, 1, 2].map((i) => una(i < n)).join("")}</div>`;
}

function flechaHtml(aqui) {
  if (!aqui) return "";
  return `<span class="flecha" aria-hidden="true">${cache["flecha-pista"] || ""}</span>`;
}

let pintando = false;

function mostrar(html, nombre, focoId) {
  pantalla = nombre;
  $main.className = "p-" + nombre;
  pintando = true;
  $main.innerHTML = html;
  const el = focoId && $main.querySelector(`[data-foco-id="${focoId}"]`);
  if (el) el.focus({ preventScroll: true });
  else focoInicial($main);
  pintando = false;
}

function limpiarAnim() {
  if (look.anim !== "anim-rapido" && look.anim !== "anim-lento") look.anim = "";
  if (look.cara === "risa" || look.cara === "duda") look.cara = "normal";
}

function animDe(palabra) {
  const s = String(palabra || "").toLowerCase();
  if (s.startsWith("jump")) return "anim-salta";
  if (s.startsWith("spin")) return "anim-gira";
  if (s === "run" || s === "runs" || s === "ran") return "anim-corre";
  return "anim-rebote";
}

function aplicarAdjetivo(palabra) {
  const w = String(palabra || "").toLowerCase();
  if (w === "big") look.escala = "grande";
  else if (w === "tiny") look.escala = "chico";
  else if (w === "red") look.pintura = "#e23d3d";
  else if (w === "shiny") look.efecto = true;
  else if (w === "fast") look.anim = "anim-rapido";
  else if (w === "slow") look.anim = "anim-lento";
}

function puertaActual() {
  return partida?.puertas?.[partida.i] || null;
}

// ---------- Inicio ----------

function inicio(focoId) {
  partida = null;
  ctx = { dialogo: false, reloj: null, tragarHasta: ctx.tragarHasta || 0 };
  callar();
  clearTimeout(guiaTimer);
  clearTimeout(pistaTimer);
  const nivel = Math.min(pr.elegido || pr.nivel, pr.nivel);
  const d = dominio(pr, nivel);
  const nombre = NIVELES[nivel - 1]?.nombre || "";
  const hecho = !!pr.retos[hoy()]?.cumplido;
  const chips = [];
  for (let n = 1; n <= pr.nivel; n++) {
    chips.push(`<button type="button" class="boton chip${n === nivel ? " primario" : ""}" data-foco${n === nivel ? "" : ""} data-foco-id="n${n}" data-act="nivel" data-n="${n}">${n}</button>`);
  }
  mostrar(`
    <div class="hero-ico">${cache.icono || ""}</div>
    <h1 class="titulo">${esc(UI.titulo)}</h1>
    <p class="sub">${esc(lineaRacha(pr, hoy()))}</p>
    <div class="menu">
      <button type="button" class="boton grande primario" data-foco="inicial" data-foco-id="jugar" data-act="jugar">${esc(UI.jugar)}</button>
      <button type="button" class="boton grande reto" data-foco data-foco-id="reto" data-act="reto"><span class="hero-mini">${cache["puerta-secreta"] || ""}</span> ${esc(UI.reto)}</button>
      <p class="sub">${esc(UI.retoMeta)}</p>
      ${hecho ? `<p class="sub">${esc(UI.yaReto)}</p>` : ""}
      <button type="button" class="boton grande" data-foco data-foco-id="como" data-act="como">${esc(UI.como)}</button>
      <button type="button" class="boton" data-foco data-foco-id="voz" data-act="voz">${esc(pr.voz ? UI.vozSi : UI.vozNo)}</button>
    </div>
    <div class="niveles">${chips.join("")}</div>
    <p class="sub">${esc(nombre)}</p>
    <div class="barra-prog" aria-hidden="true"><i style="width:${Math.min(100, d.aciertos * 10)}%"></i></div>
    <p class="sub">${d.aciertos} de 10</p>`, "inicio", focoId || "jugar");
}

// ---------- Guía ----------

function abrirGuia(destino) {
  trasGuia = destino;
  partida = null;
  look = { pintura: "", escala: "", efecto: false, anim: "", cara: "feliz" };
  clearTimeout(pistaTimer);
  clearTimeout(esperaTimer);
  esperaFn = null;
  ctx = { dialogo: false, reloj: relojNuevo(1, ahora()), tragarHasta: 0 };
  vozGuia = { epoch: ctx.reloj.vozEpoch, termino: false };
  pintarGuia();
  hablarPaso();
}

function pintarGuia() {
  const paso = ctx.reloj?.paso || 1;
  const mirar = esMirar(paso);
  const estado = {
    pintura: "",
    escala: "",
    efecto: false,
    anim: paso === 5 ? "anim-salta" : "",
    cara: "feliz",
  };
  const saltarFoco = saltarEnCiclo(paso) ? " data-foco" : "";
  mostrar(`
    <p class="coach">${esc(textoPaso(paso, esTv()))}</p>
    <div class="barra">
      <button type="button" class="ico-btn" data-foco data-foco-id="oir" data-act="oir" aria-label="${esc(UI.escuchar)}">${cache["boton-escuchar"] || ""}</button>
      <span class="sub">${paso} / 5</span>
      <button type="button" class="boton"${saltarFoco} data-foco-id="saltar" data-act="saltar">${esc(UI.saltar)}</button>
    </div>
    <div class="escenario">
      ${robotHtml(estado)}
      <div class="zona">
        ${paso >= 3 && paso <= 4 ? cartaGuia(paso) : ""}
        ${paso >= 2 ? cajasHtml(paso, mirar) : ""}
      </div>
    </div>
    <p class="nota"></p>`, "guia", focoDePaso(paso));
}

function cartaGuia(paso) {
  const pal = paso === 4 ? "jump" : "head";
  const marco = paso === 4 ? "I can <b>jump</b>" : "";
  return `${marco ? `<p class="marco">${marco}</p>` : ""}
    <div class="banda"><div class="riel">${cache["banda-unidades"] || ""}</div></div>
    <div class="carta">${tarjeta(pal, pal, 1)}</div>`;
}

function cajasHtml(paso, mirar) {
  const cats = ["noun", "verb", "adjective"];
  const luz = paso === 3 ? "noun" : paso === 4 ? "verb" : "";
  return `<div class="cajas">${cats.map((cat) => {
    const info = CAJAS[cat];
    const activa = mirar || !luz || cat === luz;
    const flecha = !mirar && cat === luz;
    return `<button type="button" class="caja${cat === luz && !mirar ? " luz" : ""}" data-foco data-foco-id="caja-${cat}" data-act="caja" data-cat="${cat}"${activa ? "" : " disabled"}>
      ${cache[CAJA_SVG[cat]] || ""}
      <span class="caja-leyenda">${esc(info.pista)}</span>
      <span class="tecla">${esc(info.simbolo)}</span>
      ${flechaHtml(flecha)}
    </button>`;
  }).join("")}</div>`;
}

function hablarPaso() {
  if (!ctx.reloj || ctx.dialogo) return;
  const gen = ++vozGen;
  const epoch = ctx.reloj.vozEpoch;
  const paso = ctx.reloj.paso;
  vozGuia = { epoch, termino: false };
  const frase = vozPaso(paso, esTv());
  const activo = pr.voz !== false;
  let cadena;
  if (paso === 3) cadena = decirPalabraLuego("head", frase, { activo });
  else if (paso === 4) cadena = decirPalabraLuego("jump", frase, { activo });
  else cadena = decirEs(frase, { activo });
  programarGuia();
  cadena.then((r) => {
    if (gen !== vozGen || ctx.dialogo || !ctx.reloj || ctx.reloj.vozEpoch !== epoch) return;
    const bien = !!(r && r.acabo === true);
    vozGuia = { epoch, termino: bien, falla: !bien };
    programarGuia();
  });
}

// Si la voz acaba bien, el paso se va a los 2 s. Si falla, también a los 2 s.
// Si sigue sonando, el tope es 3 s.
function programarGuia() {
  clearTimeout(guiaTimer);
  if (!ctx.reloj || ctx.reloj.pausa || ctx.dialogo || !esMirar(ctx.reloj.paso)) return;
  const misma = vozGuia.epoch === ctx.reloj.vozEpoch;
  const lista = misma && (vozGuia.termino || vozGuia.falla);
  const meta = ctx.reloj.inicio + (lista ? MIN_MIRAR_MS : TOPE_VOZ_MS);
  guiaTimer = setTimeout(revisarAuto, Math.max(0, meta - ahora()));
}

function revisarAuto() {
  if (!ctx.reloj || ctx.dialogo || ctx.reloj.pausa) return;
  const r = aplicarGuia(ctx.reloj, { tipo: "auto" }, ahora(), vozGuia);
  if (r.hecho === "avanzo" || r.hecho === "fin") aplicarResultadoGuia(r);
  else programarGuia();
}

function aplicarResultadoGuia(r) {
  clearTimeout(guiaTimer);
  if (r.hecho === "saltar") {
    pr = guardarGuia(pr, "saltar");
    guardar();
    callar();
    ctx = { dialogo: false, reloj: null, tragarHasta: 0 };
    inicio();
    return;
  }
  if (r.hecho === "fin") {
    callar();
    ctx = { dialogo: false, reloj: null, tragarHasta: r.tragarHasta || ahora() + 1000 };
    if (trasGuia === "jugar") empezarTurno(false);
    else if (trasGuia === "reto") empezarTurno(true);
    else inicio();
    return;
  }
  if (r.hecho === "avanzo") {
    ctx.reloj = r.reloj;
    callar();
    pintarGuia();
    hablarPaso();
  }
}

function alTocarGuia(tipo, categoria) {
  if (!ctx.reloj) return;
  const r = aplicarGuia(ctx.reloj, { tipo, categoria }, ahora(), vozGuia);
  if (r.hecho === "mal") {
    const nota = $main.querySelector(".nota");
    if (nota) nota.textContent = UI.esaNo;
    if (pr.voz !== false) decirEs(UI.esaNo, { activo: true });
    return;
  }
  if (r.hecho === "avanzo" || r.hecho === "fin" || r.hecho === "saltar") aplicarResultadoGuia(r);
}

// ---------- Juego ----------

function empezarTurno(esReto) {
  const nivel = Math.min(pr.elegido || pr.nivel, pr.nivel);
  look = { pintura: "", escala: "", efecto: false, anim: "", cara: "normal" };
  const puertas = esReto
    ? retoDelDia(hoy(), nivel, pr.fallos).puertas
    : generarTurno(nivel, Math.random, pr.fallos);
  partida = {
    modo: esReto ? "reto" : "juego",
    nivel,
    puertas,
    i: 0,
    aciertos: 0,
    errores: 0,
    puestas: [],
    resuelto: false,
    aviso: "",
  };
  mostrarPuerta();
}

function mostrarPuerta() {
  const p = puertaActual();
  if (!p) return;
  partida.errores = 0;
  partida.puestas = [];
  partida.resuelto = false;
  partida.aviso = "";
  partida.faltaS = false;
  brilloYa = false;
  limpiarAnim();
  pistaReloj = { t0: ahora(), base: 0, pausa: false };
  pintarJuego();
  programarPista();
  hablarPuerta();
}

function infoPista() {
  const p = puertaActual();
  if (!p) return { texto: "", flecha: null, paso: "corto", voz: [] };
  const segundos = segundosPista();
  const paso = pasoPista(p.nivel, segundos, partida.errores);
  const anula = anulaPrimera(p.nivel, segundos, partida.errores);
  if (p.tipo === "laberinto" || p.tipo === "oracion") {
    const revelar = (partida.errores || 0) >= 2;
    const h = paso === "completo" ? hintDePuerta(p, revelar) : { texto: UI.elige, voz: [{ lang: "es", texto: UI.elige }] };
    return { paso, texto: h.texto, voz: h.voz, flecha: paso === "corto" ? null : destinoDe(p), anula };
  }
  const cat = vozDePista(p.palabra, p.categoria);
  const info = pista({
    nivel: p.nivel,
    segundos,
    errores: partida.errores,
    palabra: p.palabra,
    categoria: p.categoria,
    completo: cat.texto,
    destino: destinoDe(p),
  });
  const voz = info.paso === "completo" ? cat.voz : [{ lang: "es", texto: info.texto }];
  return { ...info, voz };
}

function destinoDe(p) {
  if (p.tipo === "taller") return `caja-${p.categoria}`;
  if (p.tipo === "laberinto") return `op-${p.respuesta}`;
  return focoSiguienteFicha(p.fichas, partida.puestas, p.meta);
}

function segundosPista() {
  if (!pistaReloj.t0 || pistaReloj.pausa) return pistaReloj.base;
  return pistaReloj.base + (ahora() - pistaReloj.t0) / 1000;
}

function programarPista() {
  clearTimeout(pistaTimer);
  const p = puertaActual();
  if (!p || pantalla !== "jugar" || ctx.dialogo || partida?.resuelto) return;
  if ((p.nivel | 0) <= 1) return;
  const s = segundosPista();
  const marca = s < 20 ? 20 : s < 40 ? 40 : 0;
  if (!marca) return;
  pistaTimer = setTimeout(() => {
    if (ctx.dialogo || pantalla !== "jugar" || partida?.resuelto) return;
    pintarJuego();
    programarPista();
  }, (marca - s) * 1000 + 40);
}

function pausarPista() {
  if (!pistaReloj.t0 || pistaReloj.pausa) return;
  pistaReloj.base += (ahora() - pistaReloj.t0) / 1000;
  pistaReloj.pausa = true;
  clearTimeout(pistaTimer);
}

function reanudarPista() {
  if (pantalla !== "jugar" || !partida || ctx.dialogo || partida.resuelto) return;
  pistaReloj.pausa = false;
  pistaReloj.t0 = ahora();
  programarPista();
}

function hablarPuerta() {
  const p = puertaActual();
  if (!p || !pr.voz || ctx.dialogo) return;
  let cadena;
  if (p.tipo === "laberinto") cadena = decirIngles(fraseConPausa(p), { activo: true });
  else if (p.tipo === "oracion") cadena = decirEs(UI.elige, { activo: true });
  else cadena = decirIngles((p.lectura || [p.palabra]).join(" "), { activo: true });
  cadena.then(() => {
    if (pantalla !== "jugar" || ctx.dialogo || puertaActual() !== p) return;
    if ((p.nivel | 0) <= 1 && p.tipo === "taller") decirTrozos(vozDePista(p.palabra, p.categoria).voz, { activo: true });
  });
}

function minisHtml() {
  const n = partida.puertas.length;
  let html = "";
  for (let i = 0; i < n; i++) {
    const id = i < partida.i ? "puerta-mini-abierta" : "puerta-mini-cerrada";
    html += cache[id] || "";
  }
  return `<div class="minis" aria-hidden="true">${html}</div>`;
}

function elegirFoco(p, previo) {
  const brilla = p.tipo === "oracion" && probarBrilla(partida.puestas, p);
  if (brilla) return "probar";
  if (p.tipo === "oracion") {
    const sig = focoTrasFicha(p.fichas, partida.puestas);
    if (previo && previo.startsWith("ficha-")) {
      const i = Number(previo.slice(6));
      if (!partida.puestas.some((f) => f.i === i)) return previo;
    }
    if (previo === "quitar" || (previo && previo.startsWith("oir-ficha"))) return previo;
    if (partida.puestas.length || !previo || previo === "oir") return sig;
    return sig;
  }
  if (p.tipo === "laberinto") {
    const ids = new Set((p.opciones || []).flatMap((o) => [`op-${o.palabra}`, `oir-${o.palabra}`]));
    ids.add("oir");
    if (previo && ids.has(previo)) return previo;
    return p.opciones?.[0] ? `op-${p.opciones[0].palabra}` : "oir";
  }
  if (previo === "oir" || (previo && previo.startsWith("caja-"))) return previo;
  return "oir";
}

function pintarJuego() {
  const p = puertaActual();
  if (!p) return;
  const info = infoPista();
  const brilla = p.tipo === "oracion" && probarBrilla(partida.puestas, p);
  const coach = brilla
    ? (esTv() ? UI.brillaTv : UI.brillaTactil)
    : (partida.aviso || info.texto);
  const previo = document.activeElement?.dataset?.focoId || "";
  mostrar(`
    <p class="coach">${esc(coach)}</p>
    <div class="barra">
      <button type="button" class="ico-btn" data-foco data-foco-id="oir" data-act="oir" aria-label="${esc(UI.escuchar)}">${cache["boton-escuchar"] || ""}</button>
      ${minisHtml()}
    </div>
    <div class="escenario">
      ${robotHtml(look)}
      <div class="zona">${zonaHtml(p, info)}</div>
    </div>
    ${partida.aviso && partida.aviso !== coach ? `<p class="pista-caja">${esc(info.texto)}</p>` : ""}`, "jugar", elegirFoco(p, previo));
  if (brilla) sincronizarBrillo();
}

function zonaHtml(p, info) {
  if (p.tipo === "laberinto") return laberintoHtml(p, info);
  if (p.tipo === "oracion") return oracionHtml(p, info);
  return tallerHtml(p, info);
}

function tallerHtml(p, info) {
  const marco = p.marco === "a" ? `a <b>${esc(p.palabra)}</b>`
    : p.marco === "can" ? `I can <b>${esc(p.palabra)}</b>` : "";
  const cats = p.cajas || ["noun", "verb"];
  return `${marco ? `<p class="marco">${marco}</p>` : `<p class="marco">${esc(p.palabra)}</p>`}
    <div class="banda"><div class="riel">${cache["banda-unidades"] || ""}</div></div>
    <div class="carta">${tarjeta(p.palabra, p.dibujo, p.copias)}</div>
    <div class="cajas">${cats.map((cat) => {
      const infoC = CAJAS[cat];
      const marca = info.flecha === `caja-${cat}`;
      return `<button type="button" class="caja" data-foco data-foco-id="caja-${cat}" data-act="caja" data-cat="${cat}">
        ${cache[CAJA_SVG[cat]] || esc(infoC.nombre)}
        <span class="caja-leyenda">${esc(infoC.pista)}</span>
        <span class="tecla">${esc(infoC.simbolo)}</span>
        ${flechaHtml(marca)}
      </button>`;
    }).join("")}</div>`;
}

function fraseHtml(p) {
  return (p.lectura || []).map((w, i) => (
    i === p.hueco
      ? `<span class="hueco">${partida.resuelto ? esc(p.respuesta) : ""}</span>`
      : `<span class="pal">${esc(w)}</span>`
  )).join("");
}

function laberintoHtml(p, info) {
  const puerta = cache[partida.resuelto ? "puerta-abierta" : "puerta-cerrada"] || "";
  const ops = (p.opciones || []).map((o) => {
    const id = `op-${o.palabra}`;
    const marca = info.flecha === id;
    return `<div class="op-fila">
      <button type="button" class="opcion" data-foco data-foco-id="${esc(id)}" data-act="opcion" data-pal="${esc(o.palabra)}">
        <span class="mini-dib">${miniSvg(o.dibujo, o.copias)}</span>
        <span>${esc(o.palabra)}</span>
        ${flechaHtml(marca)}
      </button>
      <button type="button" class="ico-btn" data-foco data-foco-id="oir-${esc(o.palabra)}" data-act="oir-pal" data-pal="${esc(o.palabra)}" aria-label="${esc(UI.escuchar)}">${cache["boton-escuchar"] || ""}</button>
    </div>`;
  }).join("");
  return `<div class="pista-visual"><div class="puerta-svg">${puerta}</div><div class="blanco">${miniSvg(p.dibujo, p.copias)}</div></div><p class="oracion">${fraseHtml(p)}</p><div class="opciones">${ops}</div>`;
}

function oracionHtml(p, info) {
  const usadas = new Set(partida.puestas.map((f) => f.i));
  const slots = (partida.puestas || []).map((f) => `<span class="slot">${esc(f.palabra)}</span>`).join("");
  const hueco = partida.puestas.length < (p.meta || []).length ? `<span class="hueco"></span>` : "";
  const fichas = (p.fichas || []).map((f, i) => {
    if (usadas.has(i)) return "";
    const id = `ficha-${i}`;
    const marca = info.flecha === id && !usadas.has(i);
    const encender = partida.faltaS && f.palabra === p.verbo;
    const letras = encender && String(f.palabra).endsWith("s")
      ? `${esc(String(f.palabra).slice(0, -1))}<span class="ese encendida">s</span>`
      : esc(f.palabra);
    return `<div class="op-fila">
      <button type="button" class="ficha" data-foco data-foco-id="${esc(id)}" data-act="ficha" data-i="${i}">
        ${f.dibujo ? `<span class="mini-dib">${miniSvg(f.dibujo, 1)}</span>` : ""}
        <span>${letras}</span>
        ${flechaHtml(marca)}
      </button>
      <button type="button" class="ico-btn" data-foco data-foco-id="oir-ficha-${i}" data-act="oir-ficha" data-pal="${esc(f.palabra)}" aria-label="${esc(UI.escuchar)}">${cache["boton-escuchar"] || ""}</button>
    </div>`;
  }).join("");
  const brilla = probarBrilla(partida.puestas, p);
  return `<div class="slots">${slots}${hueco}</div>
    <div class="fichas">${fichas}</div>
    <div class="pie">
      <button type="button" class="boton probar${brilla ? " brilla" : ""}" data-foco data-foco-id="probar" data-act="probar">
        <span class="ico">${cache["boton-probar"] || ""}</span>${esc(UI.probar)}
        ${flechaHtml(info.flecha === "probar")}
      </button>
      <button type="button" class="ico-btn" data-foco data-foco-id="quitar" data-act="quitar" aria-label="${esc(UI.quitar)}"${partida.puestas.length ? "" : " disabled"}>${cache["boton-quitar"] || ""}</button>
    </div>`;
}

function sincronizarBrillo() {
  const p = puertaActual();
  if (!p || p.tipo !== "oracion") return;
  const brilla = probarBrilla(partida.puestas, p);
  const btn = $main.querySelector('[data-act="probar"]');
  if (btn) btn.classList.toggle("brilla", brilla);
  if (brilla && !brilloYa) {
    brilloYa = true;
    listo();
    btn?.focus({ preventScroll: true });
  }
  if (!brilla) brilloYa = false;
}

function acertar() {
  if (!partida || partida.resuelto || ctx.dialogo) return;
  const p = puertaActual();
  partida.resuelto = true;
  const primera = !anulaPrimera(p.nivel, segundosPista(), partida.errores);
  pr = registrar(pr, p.nivel, primera, hoy());
  if (primera) partida.aciertos++;
  guardar();
  if (p.tipo === "oracion") {
    aplicarAdjetivo(p.adjetivo);
    look.anim = animDe(p.verbo);
    look.cara = "feliz";
  } else if (p.categoria === "adjective") aplicarAdjetivo(p.palabra);
  else {
    look.anim = animDe(p.palabra || p.respuesta);
    if (p.categoria === "noun") look.cara = "feliz";
    else look.cara = "feliz";
  }
  abrir();
  pintarJuego();
  const cerrar = () => { if (partida && pantalla === "jugar" && !ctx.dialogo) siguiente(); };
  const correr = (ms) => {
    const plan = alTerminarPremio({ dialogo: ctx.dialogo, ms });
    if (plan.accion === "guardar") {
      esperaFn = cerrar;
      esperaRestante = plan.ms;
      return;
    }
    esperar(plan.ms, cerrar);
  };
  let frase = "";
  if (p.tipo === "laberinto" || p.tipo === "oracion") frase = fraseCompleta(p);
  if (p.premio) frase = frase ? `${frase}. ${p.premio}` : p.premio;
  if (frase && pr.voz) decirIngles(frase, { activo: true }).then(() => correr(400));
  else correr(900);
}

function fallar(palabra, aviso, cara, voz) {
  if (!partida || partida.resuelto || ctx.dialogo) return;
  partida.errores++;
  if (aviso) partida.aviso = aviso;
  if (cara) look.cara = cara;
  pr = anotarFallo(pr, palabra);
  guardar();
  pintarJuego();
  const trozos = voz || [{ lang: "es", texto: aviso || "" }];
  if (pr.voz) decirTrozos(trozos, { activo: true });
}

function responderCaja(cat) {
  const p = puertaActual();
  if (!p || p.tipo !== "taller" || partida.resuelto) return;
  if (!(p.cajas || []).includes(cat)) return;
  clic();
  if (cat === p.categoria) acertar();
  else {
    const h = hintDeTaller(p.palabra, p.categoria, seRevela(partida.errores));
    fallar(p.palabra, h.texto, null, h.voz);
  }
}

function responderOpcion(pal) {
  const p = puertaActual();
  if (!p || p.tipo !== "laberinto" || partida.resuelto) return;
  clic();
  if (pal === p.respuesta) acertar();
  else {
    const h = hintDePuerta(p, seRevela(partida.errores));
    fallar(p.respuesta, h.texto, null, h.voz);
  }
}

function ponerFicha(i) {
  const p = puertaActual();
  if (!p || partida.resuelto) return;
  const f = p.fichas[i];
  if (!f || partida.puestas.some((x) => x.i === i)) return;
  clic();
  partida.puestas = [...partida.puestas, { ...f, i }];
  partida.aviso = "";
  partida.faltaS = false;
  if (look.cara === "risa" || look.cara === "duda") look.cara = "normal";
  pintarJuego();
}

function quitarFicha() {
  if (!partida?.puestas.length || partida.resuelto) return;
  clic();
  partida.puestas = partida.puestas.slice(0, -1);
  partida.aviso = "";
  partida.faltaS = false;
  look.cara = "normal";
  pintarJuego();
}

function probarFrase() {
  const p = puertaActual();
  if (!p || p.tipo !== "oracion" || partida.resuelto) return;
  const efecto = efectoOracion(partida.puestas, p);
  partida.faltaS = efecto === "falta-s";
  if (efecto === "actua") acertar();
  else if (efecto === "risa") fallar(p.verbo, UI.orden, "risa", [{ lang: "es", texto: UI.orden }]);
  else if (efecto === "falta-s") fallar(p.verbo, UI.miraEse, null, [{ lang: "es", texto: UI.miraEse }]);
  else if (efecto === "duda") fallar(p.verbo, UI.duda, "duda", [{ lang: "es", texto: UI.duda }]);
  else fallar(p.verbo, UI.orden, null, [{ lang: "es", texto: UI.orden }]);
}

function siguiente() {
  clearTimeout(esperaTimer);
  esperaFn = null;
  if (!partida) return;
  if (partida.i + 1 >= partida.puertas.length) {
    if (partida.modo === "reto") finReto();
    else finTurno();
    return;
  }
  partida.i++;
  mostrarPuerta();
}

function esperar(ms, fn) {
  esperaFn = fn;
  esperaDesde = ahora();
  esperaRestante = ms;
  clearTimeout(esperaTimer);
  esperaTimer = setTimeout(() => {
    const listoFn = esperaFn;
    esperaFn = null;
    if (listoFn) listoFn();
  }, ms);
}

function pausarEspera() {
  if (!esperaFn) return;
  esperaRestante = Math.max(0, esperaRestante - (ahora() - esperaDesde));
  clearTimeout(esperaTimer);
}

function reanudarEspera() {
  if (!esperaFn || ctx.dialogo) return;
  esperar(esperaRestante, esperaFn);
}

function finTurno() {
  const primeras = partida.aciertos;
  const n = partida.nivel;
  const r = cerrarTurno(pr, n, primeras);
  pr = r.pr;
  guardar();
  Noli.terminar({ estrellas: r.estrellas });
  const pieza = r.pieza ? (PIEZAS[r.pieza] || r.pieza) : "";
  mostrar(`
    <h1 class="titulo">${esc(FRASES[r.estrellas] || FRASES[0])}</h1>
    ${estrellasHtml(r.estrellas)}
    <p class="sub">${primeras} de 6 a la primera</p>
    ${r.subio ? `<p class="coach">${esc(UI.subiste)}</p>` : ""}
    ${pieza ? `<div class="regalo">${cache["pieza-nueva"] || ""}</div><p class="sub">${esc(UI.piezaNueva)} ${esc(pieza)}</p>` : ""}
    <div class="menu">
      <button type="button" class="boton grande primario" data-foco="inicial" data-foco-id="otro" data-act="otro">${esc(UI.otro)}</button>
      <button type="button" class="boton grande" data-foco data-foco-id="inicio" data-act="inicio">${esc(UI.inicio)}</button>
    </div>
    <p class="sub">${esc(lineaRacha(pr, hoy()))}</p>`, "fin", "otro");
  partida = null;
  ctx.reloj = null;
}

function finReto() {
  const primeras = partida.aciertos;
  const cumplido = primeras >= RETO.necesita;
  const antes = !!pr.retos[hoy()]?.cumplido;
  const cerrado = cerrarTurno(pr, partida.nivel, primeras);
  pr = cumplirReto(cerrado.pr, hoy(), RETO.tipo, primeras, cumplido);
  guardar();
  if (cumplido && !antes) Noli.terminar({ estrellas: 3, reto: true });
  const titulo = cumplido ? UI.retoHecho : UI.retoCasi;
  const pieza = cerrado.pieza ? (PIEZAS[cerrado.pieza] || cerrado.pieza) : "";
  mostrar(`
    <div class="hero-ico">${cache["puerta-secreta"] || ""}</div>
    <h1 class="titulo">${esc(titulo)}</h1>
    ${estrellasHtml(cumplido ? 3 : 0)}
    <p class="sub">${primeras} de 6. ${esc(UI.retoMeta)}</p>
    ${!cumplido ? `<p class="sub">${esc(UI.aunNo)}</p>` : ""}
    ${pieza ? `<div class="regalo">${cache["pieza-nueva"] || ""}</div><p class="sub">${esc(UI.piezaNueva)} ${esc(pieza)}</p>` : ""}
    <p class="sub">${esc(lineaRacha(pr, hoy()))}</p>
    <div class="menu">
      ${cumplido ? "" : `<button type="button" class="boton grande primario" data-foco="inicial" data-foco-id="otra" data-act="reto">${esc(UI.otraVez)}</button>`}
      <button type="button" class="boton grande${cumplido ? " primario" : ""}" data-foco${cumplido ? '="inicial"' : ""} data-foco-id="inicio" data-act="inicio">${esc(UI.inicio)}</button>
    </div>`, "fin", cumplido ? "inicio" : "otra");
  partida = null;
  ctx.reloj = null;
}

// ---------- Salir ----------

function aplicarSalida(r) {
  if (!r || r.hecho === "ignorar" || r.hecho === "dialogo" || r.hecho === "juego") return r?.hecho || "juego";
  if (r.hecho === "salir") {
    callar();
    clearTimeout(guiaTimer);
    clearTimeout(pistaTimer);
    clearTimeout(esperaTimer);
    Noli.salir();
    return "salir";
  }
  if (r.hecho === "abrir") {
    focoAntes = document.activeElement?.dataset?.focoId || "";
    ctx = { dialogo: true, reloj: r.reloj, tragarHasta: ctx.tragarHasta || 0 };
    clearTimeout(guiaTimer);
    callar();
    pausarPista();
    pausarEspera();
    const velo = document.createElement("div");
    velo.className = "velo";
    velo.innerHTML = `<div class="dialogo" role="dialog" aria-modal="true" aria-label="${esc(SALIR.titulo)}">
      <p>${esc(SALIR.titulo)}</p>
      <button type="button" class="boton grande primario" data-foco="inicial" data-foco-id="seguir" data-act="seguir">${esc(SALIR.seguir)}</button>
      <button type="button" class="boton grande" data-foco data-foco-id="salir" data-act="salir-si">${esc(SALIR.salir)}</button>
    </div>`;
    $main.appendChild(velo);
    velo.querySelector("[data-foco-id='seguir']")?.focus({ preventScroll: true });
    return "abrir";
  }
  if (r.hecho === "seguir") {
    ctx = { dialogo: false, reloj: r.reloj, tragarHasta: r.tragarHasta };
    $main.querySelector(".velo")?.remove();
    const el = (focoAntes && $main.querySelector(`[data-foco-id="${focoAntes}"]`)) || $main.querySelector("[data-foco]");
    el?.focus({ preventScroll: true });
    if (r.repetirVoz) hablarPaso();
    reanudarPista();
    reanudarEspera();
    return "seguir";
  }
  return r.hecho;
}

function teclaGuia(accion) {
  if (!ctx.reloj) return true;
  const a = ahora();
  if (accion === "ok") {
    if (ignoraEntrada(ctx.reloj.tragarHasta || ctx.tragarHasta || 0, a, "ok")) return true;
    if (esMirar(ctx.reloj.paso)) { alTocarGuia("ok"); return true; }
    const e = document.activeElement;
    if (e?.dataset?.act === "oir") { e.click(); return true; }
    return true;
  }
  if (!esMirar(ctx.reloj.paso)) {
    if (ignoraEntrada(ctx.reloj.tragarHasta || 0, a, "caja") && accion !== "arriba") return true;
    const mapa = { izquierda: "noun", abajo: "verb", derecha: "adjective" };
    if (mapa[accion]) { alTocarGuia("caja", mapa[accion]); return true; }
    if (accion === "arriba") {
      $main.querySelector('[data-foco-id="oir"]')?.focus({ preventScroll: true });
      return true;
    }
    return true;
  }
  moverFoco(accion, $main);
  return true;
}

function teclaJuego(accion) {
  const p = puertaActual();
  if (!p) return true;
  const a = ahora();
  if (partida.resuelto) return true;
  if (p.tipo === "taller") {
    if (accion === "ok") {
      if (ignoraEntrada(ctx.tragarHasta || 0, a, "ok")) return true;
      const e = document.activeElement;
      if (e && $main.contains(e) && !e.disabled) e.click();
      return true;
    }
    if (ignoraEntrada(ctx.tragarHasta || 0, a, "caja") && accion !== "arriba") return true;
    const mapa = { izquierda: "noun", abajo: "verb", derecha: "adjective" };
    if (mapa[accion]) { responderCaja(mapa[accion]); return true; }
    if (accion === "arriba") {
      $main.querySelector('[data-foco-id="oir"]')?.focus({ preventScroll: true });
      return true;
    }
    return true;
  }
  if (accion === "ok") {
    if (ignoraEntrada(ctx.tragarHasta || 0, a, "ok")) return true;
    const e = document.activeElement;
    if (e && $main.contains(e) && !e.disabled) e.click();
    return true;
  }
  moverFoco(accion, $main);
  return true;
}

function tocar(act, el) {
  if (act === "jugar") {
    if (!pr.guiaHecha) abrirGuia("jugar");
    else empezarTurno(false);
    return;
  }
  if (act === "reto") {
    if (!pr.guiaHecha) abrirGuia("reto");
    else empezarTurno(true);
    return;
  }
  if (act === "como") { abrirGuia("inicio"); return; }
  if (act === "voz") {
    pr = ponerVoz(pr, !pr.voz);
    if (!pr.voz) callar();
    guardar();
    inicio("voz");
    return;
  }
  if (act === "nivel") {
    pr = { ...pr, elegido: +el.dataset.n || pr.elegido };
    guardar();
    inicio("n" + pr.elegido);
    return;
  }
  if (act === "inicio") { inicio(); return; }
  if (act === "otro") { empezarTurno(false); return; }
  if (act === "saltar") { alTocarGuia("saltar"); return; }
  if (act === "oir") {
    if (pantalla === "guia") hablarPaso();
    else hablarPuerta();
    return;
  }
  if (act === "oir-pal" || act === "oir-ficha") {
    const pal = el.dataset.pal || "";
    if (pr.voz && pal.includes(" ")) decirIngles(pal, { activo: true });
    else if (pr.voz) decirPalabra(pal, { activo: true });
    return;
  }
  if (act === "caja") {
    if (pantalla === "guia") alTocarGuia("caja", el.dataset.cat);
    else responderCaja(el.dataset.cat);
    return;
  }
  if (act === "opcion") { responderOpcion(el.dataset.pal); return; }
  if (act === "ficha") { ponerFicha(+el.dataset.i); return; }
  if (act === "quitar") { quitarFicha(); return; }
  if (act === "probar") { probarFrase(); return; }
}

$main.addEventListener("focusin", (ev) => {
  const caja = ev.target.closest?.("[data-act='caja']");
  if (!caja || pintando || ctx.dialogo || caja.disabled) return;
  const teclado = document.documentElement.classList.contains("teclado") || esTv();
  if (!teclado || pr.voz === false) return;
  const pista = CAJAS[caja.dataset.cat]?.pista;
  if (pista) decirEs(pista, { activo: true });
});

$main.addEventListener("pointerdown", () => {
  document.documentElement.classList.remove("teclado");
  desbloquearVoz();
  desbloquearSonido();
}, true);

$main.addEventListener("click", (ev) => {
  const t = ev.target.closest("[data-act]");
  const act = t?.dataset?.act || "";
  if (ctx.dialogo) {
    const enDialogo = !!ev.target.closest(".dialogo");
    const enVelo = !!ev.target.closest(".velo");
    if (act === "seguir" || act === "salir-si") {
      aplicarSalida(responder(ctx, { tipo: act === "seguir" ? "seguir" : "salir-si", ahora: ahora() }));
    } else if (enVelo && !enDialogo && toqueEnVelo({ tv: esTv(), enDialogo }) === "seguir") {
      aplicarSalida(responder(ctx, { tipo: "seguir", ahora: ahora() }));
    }
    return;
  }
  if (pantalla === "jugar" && partida?.resuelto) return;
  if (act === "saltar" || act === "oir" || act === "oir-pal" || act === "voz" || act === "como" || act === "jugar" || act === "reto" || act === "nivel" || act === "inicio" || act === "otro" || act === "quitar") {
    if (ignoraEntrada(ctx.tragarHasta || 0, ahora(), "toque") && pantalla !== "inicio") return;
    tocar(act, t);
    return;
  }
  if (!t) {
    if (pantalla === "guia" && ctx.reloj && esMirar(ctx.reloj.paso)) alTocarGuia("toque");
    else if (pantalla === "jugar" && partida?.resuelto && !ignoraEntrada(ctx.tragarHasta || 0, ahora(), "toque")) siguiente();
    return;
  }
  if (ignoraEntrada(ctx.tragarHasta || 0, ahora(), act === "caja" || act === "opcion" || act === "ficha" || act === "probar" ? "caja" : "toque")) return;
  if (pantalla === "guia" && ctx.reloj && esMirar(ctx.reloj.paso) && act !== "caja") {
    alTocarGuia("toque");
    return;
  }
  tocar(act, t);
});

Noli.alEntrar((accion) => {
  document.documentElement.classList.add("teclado");
  const a = ahora();
  if (ctx.dialogo) {
    const dlg = $main.querySelector(".dialogo") || $main;
    if (accion === "atras") {
      aplicarSalida(responder(ctx, { tipo: "atras", ahora: a }));
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
  if (accion === "atras") {
    aplicarSalida(responder(ctx, { tipo: "atras", ahora: a }));
    return true;
  }
  if (pantalla === "guia") return teclaGuia(accion);
  if (pantalla === "jugar" && partida) return teclaJuego(accion);
  if (accion === "ok" && ignoraEntrada(ctx.tragarHasta || 0, a, "ok")) return true;
  if (moverFoco(accion, $main)) return true;
  if (accion === "ok") {
    const e = document.activeElement;
    if (e && $main.contains(e) && !e.disabled) e.click();
    return true;
  }
  return true;
});

Noli.datos.then((d) => { pr = cargar(d); return arte(); }).then(() => {
  if (!pr.guiaHecha) abrirGuia("jugar");
  else inicio();
}).catch(() => inicio());
