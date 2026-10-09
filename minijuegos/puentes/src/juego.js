// Pantallas de Puentes para el Bosque. La lógica está en los otros módulos.
import { Noli, moverFoco, focoInicial } from "../../../kit/noli.js";
import { decir, callar, prepararVoces } from "./voz.js";
import { clic, listo as sonidoListo, feliz as sonidoFeliz, splash as sonidoSplash, desbloquear } from "./sonido.js";
import {
  crearReloj, abrirDialogoGuia, seguirDialogoGuia, responderGuia, debeAvanzarSolo,
  msHastaAvance, alAvisoVoz, marcarVozEmpezada, guiaTerminada, textoDeGuia, vozDeGuia,
  focoDeGuia, saltarAlcanzable, esMirar, opcionesGuia, tablasGuia, HUECO_GUIA,
  DESPLAZA_GUIA, trasGuiaBloquea,
} from "./guia.js";
import { fasePista, textoPista, pistaVisible, blancoFlecha, glifoMas, glifoMenos, cuentaPrimera, IDLE_ENCIMA_MS, IDLE_COMPLETA_MS } from "./pista.js";
import {
  moverRegla, confirmarCero, reglaArchivo, uDe, marcaAlFinal, decirUnidad, valorInicial,
  ajustarValor, listoBrilla, cruzarBrilla, seMidioBien, brilloCeroVisible,
} from "./medida.js";
import { maxRegla } from "./niveles.js";
import { promptDe, vozDeFase, notaReferencia, nombreZona } from "./frases.js";
import { htmlComparar, htmlFalta, htmlBloques, conBrillo, posicionRegla, svgInline } from "./escena.js";
import {
  cargar, registrar, dominio, cerrarTurno, crucePara, planTurno, cumplirReto, racha,
  fechaLocal, semana, resumen, marcarGuia, textoRacha, cicloUnidad, textoUnidad,
  VENTANA, nuevo as progresoNuevo,
} from "./progreso.js";
import { retoDelDia, estimaBien } from "./reto.js";
import { accionAtras, resolverAtras, alCerrarSalir, marcarIgnorar, resolverEntrada } from "./salida.js";

const $main = document.getElementById("juego");
const rnd = Math.random;
const hoy = () => fechaLocal();
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const reducido = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const cache = {};
let pr = progresoNuevo();
let textos = null;
let pantalla = "inicio";
let partida = null;
let saliendo = false;
let token = 0;
let relojGuia = 0;
let relojPista = 0;
let relojFeedback = 0;
let ignorarHasta = 0;
let vozGen = 0;
let focoAntes = null;
let focosGuardados = null;
let ordenDesde = 0;
let ordenTrasGuia = false;

try {
  if (new URLSearchParams(location.search).get("modo") === "tv") document.documentElement.dataset.modo = "tv";
} catch { /* abierto fuera del navegador */ }

function modoJuego() {
  return Noli.modo === "tv" || document.documentElement.dataset.modo === "tv" ? "tv" : "tactil";
}

function luego(fn, ms) {
  const t = ++token;
  return setTimeout(() => { if (t === token && !saliendo) fn(); }, ms);
}

function arte(nombre) {
  return cache[nombre] || "";
}

function leerJson(ruta) {
  return fetch(new URL(ruta, import.meta.url)).then((r) => r.json());
}

function cargarSvg(nombre) {
  return fetch(new URL(`../img/${nombre}.svg`, import.meta.url))
    .then((r) => (r.ok ? r.text() : ""))
    .then((t) => { cache[nombre] = t; })
    .catch(() => { cache[nombre] = ""; });
}

function nombresArte() {
  const base = [
    "regla-cm-12", "regla-cm-20", "regla-in-6", "marca-resaltada",
    "cubito-1cm", "cubito-1cm-coral", "clip", "diferencia", "linea-punteada",
    "splash", "banderines",
    "orilla-bosque-izq", "orilla-bosque-der", "orilla-pantano-izq", "orilla-pantano-der",
    "orilla-nieve-izq", "orilla-nieve-der",
    "hueco-rio", "hueco-pantano", "hueco-nieve", "hueco-barranco",
    "animal-conejo", "animal-ardilla", "animal-zorro", "animal-tortuga", "animal-mapache",
    "animal-conejo-mojado",
    "deco-pino", "deco-pino-nevado", "deco-juncos", "deco-arbol-alto",
    "mapa-zona-bosque", "mapa-zona-pantano", "mapa-zona-nieve",
    "mapa-cruce-hecho", "mapa-cruce-siguiente", "mapa-cruce-pendiente",
    "boton-izquierda", "boton-derecha", "boton-poner-aqui", "boton-listo", "boton-cruzar", "boton-quitar",
    "flecha-pista",
  ];
  for (let n = 1; n <= 20; n++) {
    base.push(`tablas/tabla-${n}cm`, `troncos/tronco-${n}cm`);
  }
  for (let n = 1; n <= 8; n++) base.push(`tablas/tabla-${n}in`);
  return base;
}

function cargarTodo() {
  return Promise.all([leerJson("../datos/textos.json"), ...nombresArte().map(cargarSvg)]).then(([tx]) => {
    textos = tx;
  });
}

function mostrar(html, nombre, focoId) {
  pantalla = nombre;
  $main.className = "p-" + nombre;
  $main.dataset.pantalla = nombre;
  if (partida && partida.modo === "guia") $main.dataset.paso = String(partida.reloj.paso);
  else delete $main.dataset.paso;
  $main.innerHTML = html;
  const querido = focoId && $main.querySelector(`[data-foco-id="${focoId}"]`);
  if (querido && querido.dataset.foco != null) querido.focus({ preventScroll: true });
  else focoInicial($main);
  if (modoJuego() === "tv") document.documentElement.classList.add("teclado");
}

const ESTRELLA = (on) => `<svg viewBox="0 0 24 24" class="${on ? "on" : "off"}" aria-hidden="true"><path d="M12 2.5l2.7 6.3 6.8.6-5.2 4.4 1.6 6.6L12 16.8 6.1 20.4l1.6-6.6L2.5 9.4l6.8-.6z"/></svg>`;
function estrellasHtml(n, grande) {
  return `<span class="estrellas${grande ? " grande" : ""}" aria-label="${n} de 3">${[0, 1, 2].map((i) => ESTRELLA(i < n)).join("")}</span>`;
}
const FLAMA = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1.5-4.5 3-6 0 2 1 3 2 3 0-3-1-6 1-9z" fill="#e8505b"/><path d="M12 13c.5 2 3 3 3 5.5a3 3 0 0 1-6 0c0-1.5 1-2.5 3-5.5z" fill="#ffc43d"/></svg>`;
const CHECK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>`;
const CANDADO = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2.5" fill="currentColor" opacity=".5"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>`;
const PREGUNTA = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M9.2 9.2a2.8 2.8 0 1 1 3.6 2.7c-.7.4-1 1-1 2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1.15" fill="currentColor"/></svg>`;

function htmlDialogo() {
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

function mapaZonas() {
  return `<div class="mapa-zonas">${["bosque", "pantano", "nieve"].map((z) => `<div class="zona-card"><span class="dibujo">${svgInline(arte("mapa-zona-" + z))}</span><span>${esc(nombreZona(z, textos))}</span></div>`).join("")}</div>`;
}

function nivelMeta(n) {
  return (textos.niveles || []).find((x) => x.n === n) || { n, nombre: "", ejemplo: "" };
}

function elegido() {
  return Math.max(1, Math.min(pr.nivel, pr.elegido || pr.nivel));
}

const guardar = () => Noli.guardar(pr);

function esGuia() {
  return !!(partida && partida.modo === "guia");
}

function cruceActual() {
  return partida && partida.lista ? partida.lista[partida.i] : null;
}

function faseActual() {
  const c = cruceActual();
  if (!c) return "";
  return c.fases[partida.faseI] || c.fases[0];
}

function entradaLibre(tipo) {
  return resolverEntrada({ dialogo: saliendo, ignorarHasta, ahora: Date.now(), tipo });
}

function anchoLienzo() {
  const w = (typeof window !== "undefined" && window.innerWidth) || 360;
  const pad = modoJuego() === "tv" ? 80 : 28;
  return Math.max(220, Math.min(w - pad, 980));
}

function archivoTabla(n, unidad) {
  const u = unidad === "in" ? "in" : "cm";
  const max = u === "in" ? 8 : 20;
  const k = Math.max(1, Math.min(max, n | 0));
  return `tablas/tabla-${k}${u}`;
}

function archivoTronco(n) {
  const k = Math.max(1, Math.min(20, n | 0));
  return `troncos/tronco-${k}cm`;
}

function orillasDe(zona) {
  const z = zona === "nieve" ? "nieve" : zona === "pantano" ? "pantano" : "bosque";
  return [`orilla-${z}-izq`, `orilla-${z}-der`];
}

function htmlReferencia(c) {
  if (!c || !c.referencia) return "";
  const archivo = c.referencia === "clip" ? "clip" : c.referencia === "tabla10" ? "tablas/tabla-10cm" : "cubito-1cm";
  return `<div class="referencia"><span class="dibujo">${svgInline(arte(archivo))}</span><p>${esc(notaReferencia(c, textos, false))}</p></div>`;
}

function htmlReglaEscena({ unidad, longitud, desplaza, brillo, marca, zona, hueco, animal, tv, sinRegla = false }) {
  const reg = reglaArchivo(unidad === "in" ? "in" : "cm", tv && unidad !== "in");
  const ancho = anchoLienzo();
  const tope = tv ? 168 : 128;
  const u = Math.min(ancho / reg.ancho, tope / 160);
  const w = reg.ancho * u;
  const unit = uDe(unidad === "in" ? "in" : "cm");
  const gapU = Math.max(unit, longitud * unit);
  const pos = posicionRegla({ anchoVb: reg.ancho, cero: reg.cero, gapU, desplaza, unidadU: unit });
  const [izq, der] = orillasDe(zona);
  const alto = Math.max(64, 160 * u);
  const bancoI = Math.max(0, pos.left * u);
  const gapPx = gapU * u;
  const bancoD = Math.max(0, w - bancoI - gapPx);
  const regla = conBrillo(arte(reg.archivo), { brillo, marca });
  return `<div class="medidor" style="width:${w}px">
    <div class="escena" style="width:${w}px;height:${alto}px">
      <div class="banco" style="width:${bancoI}px">${svgInline(arte(izq))}</div>
      <div class="hueco" style="width:${gapPx}px">${svgInline(arte("hueco-" + (hueco || "rio")))}</div>
      <div class="banco" style="width:${bancoD}px">${svgInline(arte(der))}</div>
      <div class="bicho" style="left:${Math.max(0, bancoI - 28)}px">${svgInline(arte("animal-" + (animal || "conejo")))}</div>
      ${marca != null ? `<div class="marca-fin" style="left:${bancoI + gapPx}px">${svgInline(arte("marca-resaltada"))}</div>` : ""}
    </div>
    ${sinRegla ? "" : `<div class="riel" style="width:${w}px;height:${Math.max(48, 78 * u)}px"><div class="regla-mov" style="width:${w}px;transform:translateX(${pos.x * u}px)">${regla}</div></div>`}
  </div>`;
}

function hablar(texto) {
  if (!pr.voz || !texto) return;
  decir(texto, "es-MX");
}

function inicio(focoId) {
  limpiarRelojes();
  partida = null;
  const reto = retoDelDia(hoy(), pr.unidad, textos, modoJuego() === "tv");
  const hecho = pr.retos[hoy()];
  const nv = dominio(pr, elegido());
  mostrar(`
    <h1 class="titulo">${esc(textos.titulo)}</h1>
    ${mapaZonas()}
    <p class="sub zona-nombre">${esc(nivelMeta(elegido()).nombre)}</p>
    <div class="menu">
      <button type="button" class="boton grande primario" data-foco="inicial" data-foco-id="jugar" data-act="ir" data-ir="ronda">${esc(textos.jugar)}</button>
      <button type="button" class="boton grande ${hecho?.cumplido ? "hecho" : "reto"}" data-foco data-foco-id="reto" data-act="ir" data-ir="retoIntro">${esc(textos.reto)} <small>${hecho?.cumplido ? esc(textos.yaCumplido) : esc(reto.nombre)}</small></button>
      <button type="button" class="boton grande" data-foco data-foco-id="progreso" data-act="ir" data-ir="progreso">${esc(textos.progreso)}</button>
      <div class="menu fila chica">
        <button type="button" class="boton" data-foco data-foco-id="como" data-act="ir" data-ir="guia"><span class="con-ico">${PREGUNTA} ${esc(textos.como)}</span></button>
        <button type="button" class="boton" data-foco data-foco-id="voz" data-act="ir" data-ir="voz">${esc(pr.voz ? textos.vozOn : textos.vozOff)}</button>
      </div>
    </div>
    <p class="sub">${nv.aciertos} de ${Math.min(VENTANA, Math.max(nv.intentos, 0))} · ${esc(nivelMeta(elegido()).ejemplo)}</p>
    <p class="racha">${FLAMA}<span>${esc(textoRacha(racha(pr, hoy()), textos))}</span></p>`, "inicio", focoId);
}

function nuevaRonda() {
  if (!pr.guiaHecha) return empezarGuia("ronda");
  const n = elegido();
  const plan = planTurno(pr, n, rnd);
  const tv = modoJuego() === "tv";
  partida = {
    modo: "turno", n,
    lista: plan.map((x, i) => crucePara(pr, x.nivel, rnd, { repaso: x.repaso, indice: i, tv })),
    i: 0, aciertos: 0,
  };
  cargarCruce();
}

function empezarGuia(destino) {
  limpiarRelojes();
  partida = { modo: "guia", destino, reloj: crearReloj(Date.now(), 0), desplaza: DESPLAZA_GUIA, brillo: false };
  pintarGuia();
}

function terminarGuia(guardarVista) {
  const destino = partida && partida.destino;
  limpiarRelojes();
  callar();
  vozGen++;
  if (guardarVista) { pr = marcarGuia(pr); guardar(); }
  const seguirJuego = guardarVista && destino === "ronda";
  partida = null;
  if (seguirJuego) {
    ordenDesde = Date.now();
    ordenTrasGuia = true;
    nuevaRonda();
  } else {
    ordenTrasGuia = false;
    inicio();
  }
}

function limpiarRelojes() {
  clearTimeout(relojGuia); relojGuia = 0;
  clearTimeout(relojPista); relojPista = 0;
  clearTimeout(relojFeedback); relojFeedback = 0;
}

function programarGuia() {
  clearTimeout(relojGuia); relojGuia = 0;
  if (saliendo || !esGuia()) return;
  const espera = msHastaAvance(partida.reloj, Date.now());
  if (espera == null) return;
  const paso = partida.reloj.paso;
  relojGuia = setTimeout(() => {
    relojGuia = 0;
    if (saliendo || !esGuia() || partida.reloj.paso !== paso || partida.reloj.pausado) return;
    const r = responderGuia(partida.reloj, Date.now(), { tipo: "tiempo" });
    if (r.accion === "avanzo") aplicarReloj(r.reloj);
    else programarGuia();
  }, Math.max(30, espera));
}

function hablarGuia() {
  const paso = partida.reloj.paso;
  const mio = ++vozGen;
  const linea = vozDeGuia(paso, textos, modoJuego());
  const vigente = () => mio === vozGen && !saliendo && esGuia() && partida.reloj.paso === paso && !partida.reloj.pausado;
  const aplicar = (aviso) => {
    if (!vigente()) return;
    const r = alAvisoVoz(partida.reloj, Date.now(), aviso);
    partida.reloj = r.reloj;
    if (r.avanza) {
      const resp = responderGuia(partida.reloj, Date.now(), { tipo: "tiempo" });
      if (resp.accion === "avanzo") aplicarReloj(resp.reloj);
      return;
    }
    programarGuia();
  };
  partida.reloj = { ...partida.reloj, reiniciarVoz: false, vozSigue: false };
  if (!pr.voz || !linea || !esMirar(paso)) { programarGuia(); return; }
  let avisoYa = false;
  const acepto = decir(linea, "es-MX", () => { avisoYa = true; aplicar("fin"); }, (motivo) => { avisoYa = true; aplicar(motivo || "error"); }, () => {
    if (!vigente()) return;
    partida.reloj = marcarVozEmpezada(partida.reloj);
    programarGuia();
  });
  if (!avisoYa && acepto !== true && vigente()) {
    partida.reloj = { ...partida.reloj, vozSigue: false, vozFallo: true, vozTermino: false };
  }
  if (!avisoYa && vigente()) programarGuia();
}

function aplicarReloj(reloj) {
  if (guiaTerminada(reloj.paso)) return terminarGuia(true);
  partida.reloj = reloj;
  partida.brillo = false;
  pintarGuia();
}

function pintarGuia() {
  const paso = partida.reloj.paso;
  const modo = modoJuego();
  const foco = focoDeGuia(paso);
  const saltar = saltarAlcanzable(paso);
  const muestraRegla = paso >= 1;
  const marca = paso >= 3 ? HUECO_GUIA : null;
  const brillo = !!partida.brillo || (paso === 2 && partida.desplaza !== 0 && partida.brillo);
  const escena = htmlReglaEscena({
    unidad: "cm", longitud: HUECO_GUIA, desplaza: muestraRegla ? partida.desplaza : 0,
    brillo: paso === 2 && partida.brillo, marca, zona: "bosque", hueco: "rio", animal: "conejo",
    tv: modo === "tv", sinRegla: !muestraRegla,
  });
  const flecha = `<span class="flecha-pista">${svgInline(arte("flecha-pista"))}</span>`;
  let controles = "";
  if (paso === 2) {
    controles = `<div class="controles">
      <button type="button" class="ico-btn" data-foco data-foco-id="izq" data-act="mover" data-dir="-1" aria-label="Izquierda">${svgInline(arte("boton-izquierda"))}</button>
      <button type="button" class="enviar${brillo ? "" : ""}" data-foco="inicial" data-foco-id="poner" data-act="poner">${svgInline(arte("boton-poner-aqui"))}<span>${esc(textos.poner)}</span></button>
      <button type="button" class="ico-btn" data-foco data-foco-id="der" data-act="mover" data-dir="1" aria-label="Derecha">${svgInline(arte("boton-derecha"))}</button>
    </div>`;
  } else if (paso === 4) {
    controles = `<div class="opciones">${opcionesGuia().map((n, i) => `<button type="button" class="opcion" data-foco${i === 0 ? '="inicial"' : ""} data-foco-id="op-${i}" data-act="guia-op" data-valor="${n}"><span class="num-grande">${n}</span></button>`).join("")}</div>`;
  } else if (paso === 5) {
    controles = `<div class="opciones">${tablasGuia().map((n, i) => `<button type="button" class="opcion" data-foco${i === 0 ? '="inicial"' : ""} data-foco-id="tabla-${i}" data-act="guia-tabla" data-valor="${n}"><span class="recorte">${svgInline(arte(archivoTabla(n, "cm")))}</span><span class="num-grande">${n}</span></button>`).join("")}</div>`;
  }
  mostrar(`
    <header class="cab"><span>${esc(textos.guiaTitulo)}</span>
      <button type="button" class="saltar" ${saltar ? "data-foco" : ""} data-foco-id="saltar" data-act="ir" data-ir="saltar-guia">${esc(textos.saltar)}</button>
    </header>
    <p class="pedido guia-texto" data-foco${foco === "guia-texto" ? '="inicial"' : ""} data-foco-id="guia-texto" tabindex="0">${paso === 2 && partida.brillo ? flecha : ""}${esc(textoDeGuia(paso, textos, modo))}</p>
    ${paso === 0 ? escena.replace("animal-conejo", "animal-conejo") : escena}
    ${controles}
    <p class="pista">${paso === 2 && partida.brillo ? esc(textos.pistaCero) : ""}</p>
    <p class="aviso"></p>`, "guia", foco);
  if (partida.reloj.reiniciarVoz) hablarGuia();
  else programarGuia();
}

function moverGuia(delta) {
  if (!esGuia() || partida.reloj.paso !== 2) return;
  if (resolverEntrada({ dialogo: saliendo, ignorarHasta, ahora: Date.now(), tipo: "flecha" }) !== "seguir") return;
  const t = Date.now() - partida.reloj.inicio;
  if (t < 1000) return;
  partida.desplaza = moverRegla(partida.desplaza, delta);
  partida.brillo = false;
  const hablarAhora = partida.reloj.reiniciarVoz;
  pintarGuia();
  if (!hablarAhora) partida.reloj.reiniciarVoz = false;
}

function cargarCruce() {
  const c = cruceActual();
  partida.faseI = 0;
  partida.desplaza = c.desplazaInicial || 0;
  partida.valor = valorInicial(c.longitud, maxValor(c));
  partida.elegidas = [];
  partida.ceroMal = false;
  partida.ensucio = false;
  partida.fallo = false;
  partida.vioCompleta = false;
  partida.revelado = false;
  partida.resuelto = false;
  partida.aviso = "";
  partida.feedback = null;
  partida.brillo = false;
  partida.idleDesde = Date.now();
  partida.anuncioId = "";
  pintarCruce();
  hablar(vozDeFase(c, faseActual(), textos, modoJuego()));
  programarPista();
}

function maxValor(c) {
  if (!c) return 12;
  if (c.tipo === "comparar") return 20;
  if (c.tipo === "arbol") return 24;
  if (c.unidad === "in") return 8;
  return Math.max(12, (c.longitud || 1) + 6);
}

function sincronizarPista() {
  const c = cruceActual();
  if (!c || partida.revelado) return "frase";
  const fase = fasePista({ nivel: c.nivel, ms: Date.now() - (partida.idleDesde || Date.now()), fallo: !!partida.fallo });
  if (fase === "completa" && (c.nivel | 0) > 1) partida.vioCompleta = true;
  return fase;
}

function programarPista() {
  clearTimeout(relojPista); relojPista = 0;
  if (saliendo || !partida || esGuia() || partida.revelado || pantalla !== "cruce") return;
  const c = cruceActual();
  if (!c || (c.nivel | 0) <= 1) return;
  const ms = Date.now() - (partida.idleDesde || Date.now());
  let espera = 0;
  if (ms < IDLE_ENCIMA_MS) espera = IDLE_ENCIMA_MS - ms;
  else if (ms < IDLE_COMPLETA_MS) espera = IDLE_COMPLETA_MS - ms;
  else return;
  relojPista = setTimeout(() => {
    if (saliendo || !partida || partida.revelado) return;
    sincronizarPista();
    pintarCruce(document.activeElement && document.activeElement.dataset && document.activeElement.dataset.focoId);
  }, espera + 40);
}

function bloqueadoTrasGuia() {
  if (!trasGuiaBloquea(Date.now(), ordenDesde, ordenTrasGuia)) {
    if (ordenTrasGuia) ordenTrasGuia = false;
    return false;
  }
  return true;
}

function pintarCruce(focoId) {
  const c = cruceActual();
  if (!c) return;
  if (partida.feedback) return pintarFeedback();
  const fase = faseActual();
  const pistaFase = sincronizarPista();
  const modo = modoJuego();
  const puntos = `<span class="puntos">${partida.lista.map((_, k) => `<i class="${k < partida.i ? "lleno" : ""}"></i>`).join("")}</span>`;
  const linea = pistaVisible(textoPista(c, pistaFase, textos), partida);
  const blanco = blancoFlecha(c, pistaFase);
  mostrar(`
    <header class="cab"><span>${esc(nombreZona(c.zona, textos))} · ${esc(nivelMeta(c.nivel).nombre)}</span>${puntos}</header>
    <p class="pedido">${esc(promptDe(c, fase, textos, modo))}</p>
    ${htmlReferencia(c)}
    <div class="zona-juego">${cuerpoCruce(c, fase, blanco)}</div>
    <p class="pista">${esc(linea)}</p>
    <p class="aviso" aria-live="polite">${esc(partida.aviso || "")}</p>`, "cruce", focoId || focoDeCruce(c, fase));
  anunciarBrillo(c, fase);
  programarPista();
}

function focoDeCruce(c, fase) {
  if (fase === "poner") return "poner";
  if (fase === "leer" || fase === "comparar" || fase === "estimaLibre") return listoBrilla(partida.valor, c.longitud) && fase !== "estimaLibre" ? "listo" : "mas";
  if (fase === "juntar" && cruzarBrilla(partida.elegidas, c.longitud, c.piezas)) return "cruzar";
  if (fase === "juntar") return "suma-0";
  return "op-0";
}

function anunciarBrillo(c, fase) {
  const id = fase === "juntar" && cruzarBrilla(partida.elegidas, c.longitud, c.piezas) ? "cruzar"
    : (fase === "leer" || fase === "comparar") && listoBrilla(partida.valor, c.longitud) ? "listo" : "";
  if (id && partida.anuncioId !== id) {
    partida.anuncioId = id;
    sonidoListo();
    const el = $main.querySelector(`[data-foco-id="${id}"]`);
    if (el) el.focus({ preventScroll: true });
  } else if (!id) partida.anuncioId = "";
}

function cuerpoCruce(c, fase, blanco) {
  if (c.tipo === "bloques" && (fase === "bien" || fase === "cuantos")) return htmlBloquesFase(c, fase);
  if (c.tipo === "comparar" || fase === "comparar") return htmlCompararFase(c) + htmlContador(c, fase !== "comparar");
  if (c.tipo === "arbol" || (fase === "estima" && c.tipo === "arbol")) return htmlArbol(c);
  if (fase === "estima" || fase === "estimaLibre") return htmlEstima(c, fase, blanco);
  if (fase === "poner" || fase === "tabla" || fase === "leer" || fase === "juntar") return htmlMedir(c, fase, blanco);
  return "";
}

function htmlBloquesFase(c, fase) {
  const bloques = htmlBloques(c.cubos, arte("cubito-1cm"), arte("cubito-1cm-coral"));
  if (fase === "bien") {
    return `${bloques}<div class="opciones">${[["si", textos.si], ["no", textos.no]].map(([id, nom], i) => `<button type="button" class="opcion" data-foco${i === 0 ? '="inicial"' : ""} data-foco-id="op-${i}" data-act="sino" data-valor="${id}"><span class="num-grande">${esc(nom)}</span></button>`).join("")}</div>`;
  }
  return `${bloques}<div class="opciones">${(c.opciones || []).map((n, i) => `<button type="button" class="opcion" data-foco${i === 0 ? '="inicial"' : ""} data-foco-id="op-${i}" data-act="opcion" data-valor="${n}"><span class="num-grande">${n}</span></button>`).join("")}</div>`;
}

function htmlCompararFase(c) {
  const unidad = c.unidad === "in" ? "in" : "cm";
  const svgCorto = unidad === "in" ? arte(archivoTabla(c.corto, "in")) : arte(archivoTronco(c.corto));
  const svgLargo = unidad === "in" ? arte(archivoTabla(c.largo, "in")) : arte(archivoTronco(c.largo));
  return htmlComparar({
    corto: c.corto, largo: c.largo, svgCorto, svgLargo,
    svgDif: arte("diferencia"), svgLinea: arte("linea-punteada"),
  });
}

function htmlArbol(c) {
  const ops = (c.opciones || []).map((n, i) => `<button type="button" class="opcion" data-foco${i === 0 ? '="inicial"' : ""} data-foco-id="op-${i}" data-act="opcion" data-valor="${n}"><span class="num-grande">${n}</span></button>`).join("");
  return `<div class="arbol">${svgInline(arte("deco-arbol-alto"))}</div><div class="opciones">${ops}</div>`;
}

function htmlEstima(c, fase) {
  if (fase === "estimaLibre") return htmlContador(c, false);
  const ops = (c.opciones || []).map((n, i) => `<button type="button" class="opcion" data-foco${i === 0 ? '="inicial"' : ""} data-foco-id="op-${i}" data-act="opcion" data-valor="${n}"><span class="num-grande">${n}</span></button>`).join("");
  return `<div class="opciones">${ops}</div>`;
}

function htmlMedir(c, fase, blanco) {
  const tv = modoJuego() === "tv";
  const unidad = c.unidad === "in" ? "in" : "cm";
  const verRegla = fase === "poner" || fase === "tabla" || fase === "leer" || (fase === "juntar" && c.longitud <= maxRegla(unidad, tv));
  const marca = fase === "poner" ? null : marcaAlFinal(Math.min(c.longitud, maxRegla(unidad, tv)), fase === "poner" ? partida.desplaza : (c.yaPuesta ? partida.desplaza : 0));
  const brillo = brilloCeroVisible({
    desplaza: partida.desplaza, fasePista: sincronizarPista(), forzar: !!partida.brillo, nivel: c.nivel,
  }) || (c.tipo === "desfase" && (sincronizarPista() !== "frase"));
  let escena = "";
  if (verRegla && fase !== "juntar") {
    escena = htmlReglaEscena({
      unidad, longitud: Math.min(c.longitud, maxRegla(unidad, tv)),
      desplaza: partida.desplaza, brillo, marca: fase === "poner" ? null : marca,
      zona: c.zona, hueco: c.hueco, animal: c.animal, tv,
    });
  } else if (fase === "juntar" && verRegla) {
    escena = htmlReglaEscena({
      unidad, longitud: c.longitud, desplaza: 0, brillo: false, marca: c.longitud,
      zona: c.zona, hueco: c.hueco, animal: c.animal, tv,
    });
  }
  if (fase === "poner") {
    return `${escena}<div class="controles ${blanco === "cero" ? "apunta" : ""}">
      <button type="button" class="ico-btn" data-foco data-foco-id="izq" data-act="mover" data-dir="-1" aria-label="Izquierda">${svgInline(arte("boton-izquierda"))}</button>
      <button type="button" class="enviar" data-foco="inicial" data-foco-id="poner" data-act="poner">${svgInline(arte("boton-poner-aqui"))}<span>${esc(textos.poner)}</span></button>
      <button type="button" class="ico-btn" data-foco data-foco-id="der" data-act="mover" data-dir="1" aria-label="Derecha">${svgInline(arte("boton-derecha"))}</button>
    </div>`;
  }
  if (fase === "tabla") {
    return `${escena}<div class="opciones">${(c.ofrecidas || []).map((n, i) => `<button type="button" class="opcion" data-foco${i === 0 ? '="inicial"' : ""} data-foco-id="op-${i}" data-act="opcion" data-valor="${n}"><span class="recorte">${svgInline(arte(archivoTabla(n, unidad)))}</span><span class="num-grande">${n}</span></button>`).join("")}</div>`;
  }
  if (fase === "leer") return `${escena}${htmlContador(c, true)}`;
  if (fase === "juntar") return `${escena}${htmlJuntar(c, unidad, blanco)}`;
  return escena;
}

function htmlContador(c, brillaAlCoincidir) {
  const modo = modoJuego();
  const brilla = brillaAlCoincidir && listoBrilla(partida.valor, c.longitud);
  return `<div class="controles">
    <button type="button" class="ico-btn" data-foco data-foco-id="menos" data-act="valor" data-dir="-1" aria-label="Menos"><span class="glifo">${glifoMenos(modo)}</span></button>
    <span class="valor" aria-live="polite">${partida.valor}</span>
    <button type="button" class="ico-btn" data-foco data-foco-id="mas" data-act="valor" data-dir="1" aria-label="Más"><span class="glifo">${glifoMas(modo)}</span></button>
    <button type="button" class="enviar${brilla ? " listo" : ""}" data-foco${brilla ? '="inicial"' : ""} data-foco-id="listo" data-act="listo" ${brilla || !brillaAlCoincidir ? "" : "disabled"}>${svgInline(arte("boton-listo"))}<span>${esc(textos.listo)}</span></button>
  </div>`;
}

function htmlJuntar(c, unidad, blanco) {
  const brilla = cruzarBrilla(partida.elegidas, c.longitud, c.piezas);
  const puestos = partida.elegidas.length ? `<div class="opciones">${partida.elegidas.map((n) => `<span class="opcion elegida"><span class="num-grande">${n}</span></span>`).join("")}</div>` : "";
  return `${puestos}<div class="opciones ${blanco === "tablas" ? "apunta" : ""}">${(c.ofrecidas || []).map((n, i) => `<button type="button" class="opcion" data-foco${i === 0 ? '="inicial"' : ""} data-foco-id="suma-${i}" data-act="sumar" data-valor="${n}"><span class="recorte">${svgInline(arte(archivoTabla(n, unidad)))}</span><span class="num-grande">${n}</span></button>`).join("")}</div>
    <div class="controles">
      <button type="button" class="ico-btn" data-foco data-foco-id="quitar" data-act="quitar" ${partida.elegidas.length ? "" : "disabled"}>${svgInline(arte("boton-quitar"))}<span>${esc(textos.quitar)}</span></button>
      <button type="button" class="enviar${brilla ? " listo" : ""}" data-foco${brilla ? '="inicial"' : ""} data-foco-id="cruzar" data-act="cruzar" ${brilla ? "" : "disabled"}>${svgInline(arte("boton-cruzar"))}<span>${esc(textos.cruzar)}</span></button>
    </div>`;
}

function cambiarValor(delta) {
  const c = cruceActual();
  if (!c || partida.revelado) return;
  partida.valor = ajustarValor(partida.valor, delta, maxValor(c));
  pintarCruce(delta > 0 ? "mas" : "menos");
}

function confirmarPoner() {
  const c = cruceActual();
  const r = confirmarCero(partida.desplaza);
  if (!r.puesta) {
    partida.brillo = true;
    partida.ceroMal = true;
    partida.aviso = "";
    pintarCruce("poner");
    return;
  }
  partida.brillo = false;
  partida.faseI++;
  partida.aviso = "";
  partida.idleDesde = Date.now();
  if (partida.faseI >= c.fases.length) return cerrarCruce(true);
  pintarCruce();
  hablar(vozDeFase(c, faseActual(), textos, modoJuego()));
}

function elegirOpcion(valor) {
  const c = cruceActual();
  const fase = faseActual();
  const n = Number(valor);
  if (fase === "cuantos" || fase === "tabla" || fase === "estima" || c.tipo === "arbol") {
    const ok = n === c.longitud;
    if (!ok) partida.fallo = true;
    if (partida.faseI < c.fases.length - 1) {
      partida.faseI++;
      partida.aviso = "";
      partida.idleDesde = Date.now();
      pintarCruce();
      hablar(vozDeFase(c, faseActual(), textos, modoJuego()));
      return;
    }
    if (ok) return cerrarCruce(true);
    const corto = fase === "tabla" && n < c.longitud;
    const largo = fase === "tabla" && n > c.longitud;
    return mostrarResultado(corto ? "splash" : largo ? "sobra" : "asi", n);
  }
  if (fase === "bien") {
    const bien = seMidioBien(c.modoBloques);
    const dijoSi = valor === "si";
    if (dijoSi === bien) {
      if (c.fases.length > 1 && partida.faseI === 0) {
        partida.faseI = 1;
        partida.aviso = "";
        partida.idleDesde = Date.now();
        pintarCruce();
        hablar(vozDeFase(c, faseActual(), textos, modoJuego()));
        return;
      }
      return cerrarCruce(true);
    }
    partida.fallo = true;
    return mostrarResultado("asi");
  }
}

function confirmarListo() {
  const c = cruceActual();
  const fase = faseActual();
  if (fase === "estimaLibre") {
    const ok = estimaBien(partida.valor, c.longitud, c.margen || 2);
    if (!ok) partida.fallo = true;
    return mostrarResultado(ok ? "desfile" : "asi");
  }
  if (!listoBrilla(partida.valor, c.longitud)) return;
  if (partida.faseI < c.fases.length - 1) {
    partida.faseI++;
    partida.aviso = "";
    partida.idleDesde = Date.now();
    partida.anuncioId = "";
    pintarCruce();
    hablar(vozDeFase(c, faseActual(), textos, modoJuego()));
    return;
  }
  cerrarCruce(true);
}

function sumarTabla(valor) {
  const c = cruceActual();
  if (partida.elegidas.length >= (c.piezas || 2)) return;
  partida.elegidas = [...partida.elegidas, Number(valor)];
  pintarCruce();
}

function quitarTabla() {
  if (!partida.elegidas.length) return;
  partida.elegidas = partida.elegidas.slice(0, -1);
  partida.ensucio = true;
  pintarCruce("quitar");
}

function confirmarCruzar() {
  const c = cruceActual();
  if (!cruzarBrilla(partida.elegidas, c.longitud, c.piezas)) return;
  cerrarCruce(true);
}

function primeraDe(ok) {
  const c = cruceActual();
  return cuentaPrimera({
    ok, nivel: c.nivel, vioCompleta: partida.vioCompleta, fallo: partida.fallo,
    ceroMal: partida.ceroMal, ensucio: partida.ensucio,
  });
}

function cerrarCruce(okVisible) {
  const c = cruceActual();
  sincronizarPista();
  const ok = primeraDe(okVisible && !partida.fallo);
  anotar(ok);
  mostrarResultado(okVisible && !partida.fallo ? "desfile" : "asi");
  return c;
}

function anotar(ok) {
  if (!partida || partida.anotado) return;
  partida.anotado = true;
  const c = cruceActual();
  if (partida.modo === "turno") pr = registrar(pr, c.nivel, ok, hoy());
  if (ok) partida.aciertos++;
  guardar();
}

function mostrarResultado(tipo, elegidoMal) {
  const c = cruceActual();
  if (!partida.anotado) {
    const ok = tipo === "desfile" && primeraDe(true);
    if (tipo !== "desfile") anotar(false);
    else anotar(ok);
  }
  partida.feedback = tipo;
  partida.elegidoMal = elegidoMal;
  partida.revelado = true;
  partida.resuelto = true;
  if (tipo === "splash") sonidoSplash();
  else if (tipo === "desfile") sonidoFeliz();
  pintarFeedback();
}

function pintarFeedback() {
  const c = cruceActual();
  const tipo = partida.feedback;
  let arteHtml = "";
  let frase = textos.bienHecho;
  if (tipo === "splash") {
    frase = `${textos.splash} ${textos.corto}`;
    arteHtml = `<div class="splash-art">${svgInline(arte("splash"))}</div><div class="bicho" style="position:relative;left:auto">${svgInline(arte("animal-conejo-mojado"))}</div>`;
    if (c && partida.elegidoMal) arteHtml += htmlFalta({ puesto: partida.elegidoMal, hueco: c.longitud, svgPuesto: arte(archivoTabla(partida.elegidoMal, c.unidad)), svgDif: arte("diferencia") });
  } else if (tipo === "sobra") {
    frase = textos.sobra;
    arteHtml = htmlFalta({ puesto: c.longitud, hueco: partida.elegidoMal, svgPuesto: arte(archivoTabla(c.longitud, c.unidad)), svgDif: arte("diferencia") });
  } else if (tipo === "asi") {
    frase = `${textos.asiEra} ${decirUnidad(c.longitud, c.unidad)}`;
    arteHtml = `<div class="bicho" style="position:relative;left:auto">${svgInline(arte("animal-" + (c.animal || "conejo")))}</div>`;
  } else {
    arteHtml = `<div class="desfile">${svgInline(arte("banderines"))}${["conejo", "ardilla", "zorro"].map((a) => `<span class="animal">${svgInline(arte("animal-" + a))}</span>`).join("")}</div>`;
  }
  mostrar(`
    <p class="pedido">${esc(frase)}</p>
    ${arteHtml}
    <button type="button" class="boton grande primario" data-foco="inicial" data-foco-id="seguir-cruce" data-act="ir" data-ir="seguir-cruce">${esc(textos.seguir)}</button>
    <p class="pista"></p><p class="aviso"></p>`, "feedback");
  clearTimeout(relojFeedback);
  relojFeedback = luego(() => seguirCruce(), reducido() ? 600 : 1700);
}

function seguirCruce() {
  if (!partida) return;
  clearTimeout(relojFeedback); relojFeedback = 0;
  partida.i++;
  partida.anotado = false;
  if (partida.i >= partida.lista.length) {
    if (partida.modo === "reto") return finReto();
    return finTurno();
  }
  cargarCruce();
}

function finTurno() {
  const n = partida.n;
  const aciertos = partida.aciertos;
  const r = cerrarTurno(pr, n, aciertos);
  pr = r.pr;
  guardar();
  Noli.terminar({ estrellas: r.estrellas });
  mostrar(`
    <h1 class="titulo">${esc(textos.fin[r.estrellas] || textos.fin[0])}</h1>
    ${estrellasHtml(r.estrellas, true)}
    <p class="sub">${esc(String(textos.aLaPrimera).replace("{a}", String(aciertos)).replace("{n}", String(partida.lista.length)))}</p>
    <div class="desfile">${svgInline(arte("banderines"))}<span class="animal">${svgInline(arte("animal-conejo"))}</span></div>
    ${r.subio ? `<div class="subio"><b>${esc(String(textos.subiste).replace("{n}", String(r.subio)))}</b><span>${esc(nivelMeta(r.subio).nombre)}</span></div>` : ""}
    <div class="menu fila">
      <button type="button" class="boton grande primario" data-foco="inicial" data-act="ir" data-ir="ronda">${esc(r.subio ? textos.nivelNuevo : textos.otro)}</button>
      <button type="button" class="boton grande" data-foco data-act="ir" data-ir="inicio">${esc(textos.casa)}</button>
    </div>`, "fin");
  partida = null;
}

function retoIntro() {
  const reto = retoDelDia(hoy(), pr.unidad, textos, modoJuego() === "tv");
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
  const reto = retoDelDia(hoy(), pr.unidad, textos, modoJuego() === "tv");
  partida = { modo: "reto", n: pr.nivel, reto, lista: reto.problemas, i: 0, aciertos: 0 };
  cargarCruce();
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
  mostrar(`
    <h1 class="titulo">${esc(textos.progreso)}</h1>
    <p class="racha">${FLAMA}<span>${esc(textoRacha(racha(pr, hoy()), textos))}</span></p>
    ${semanaHtml()}
    <ol class="mapa">${(textos.niveles || []).map((x) => {
      const nv = pr.niveles[x.n];
      const abierto = x.n <= pr.nivel;
      const dm = dominio(pr, x.n);
      const estado = nv?.dominado ? estrellasHtml(nv.estrellas || 0) : abierto ? `<span>${dm.aciertos} de ${VENTANA}</span>` : CANDADO;
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
    <button type="button" class="boton grande" data-foco="inicial" data-foco-id="unidad" data-act="ir" data-ir="unidad">${esc(textos.unidadBoton)}: ${esc(textoUnidad(pr.unidad, textos))}</button>
    <table class="tabla"><thead><tr><th>Nivel</th><th>Cruces</th><th>A la primera</th></tr></thead><tbody>
      ${R.filter((x) => x.desbloqueado || x.total).map((x) => `<tr><td>${x.n}. ${esc(x.nombre)}</td><td>${x.total}</td><td>${x.pct == null ? "–" : x.pct + " %"}</td></tr>`).join("")}
    </tbody></table>
    <div class="menu fila"><button type="button" class="boton" data-foco data-act="ir" data-ir="progreso">${esc(textos.regresar)}</button></div>`, "papas");
}

function abrirSalir() {
  if (saliendo) return;
  token++;
  clearTimeout(relojPista); relojPista = 0;
  clearTimeout(relojGuia); relojGuia = 0;
  clearTimeout(relojFeedback); relojFeedback = 0;
  callar();
  vozGen++;
  if (esGuia()) partida.reloj = abrirDialogoGuia(partida.reloj, Date.now());
  focoAntes = document.activeElement;
  focosGuardados = [...$main.querySelectorAll("[data-foco]")].map((el) => ({ el, valor: el.getAttribute("data-foco") }));
  for (const item of focosGuardados) item.el.removeAttribute("data-foco");
  saliendo = true;
  $main.insertAdjacentHTML("beforeend", htmlDialogo());
  const seguir = $main.querySelector('[data-foco-id="seguir-juego"]');
  if (seguir) seguir.focus({ preventScroll: true });
}

function cerrarSalir(ySalir) {
  const velo = $main.querySelector(".salir-velo");
  if (velo) velo.remove();
  saliendo = false;
  const ahora = Date.now();
  ignorarHasta = marcarIgnorar(ahora);
  if (focosGuardados) {
    for (const item of focosGuardados) {
      if (item.el.isConnected) item.el.setAttribute("data-foco", item.valor == null ? "" : item.valor);
    }
    focosGuardados = null;
  }
  const que = alCerrarSalir({
    salir: !!ySalir,
    resuelto: !!(partida && partida.resuelto && pantalla !== "feedback"),
    revelado: pantalla === "feedback",
    guia: esGuia(),
  });
  if (que === "salir") { Noli.salir(); return; }
  if (esGuia()) {
    partida.reloj = seguirDialogoGuia(partida.reloj, ahora);
    pintarGuia();
    return;
  }
  if (que === "avanzar") { seguirCruce(); return; }
  const volver = focoAntes && focoAntes.isConnected && $main.contains(focoAntes) && focoAntes.dataset.focoId !== "saltar";
  if (volver) focoAntes.focus({ preventScroll: true });
  else focoInicial($main);
  if (pantalla === "feedback") relojFeedback = luego(() => seguirCruce(), 1200);
  if (pantalla === "cruce") programarPista();
}

const IR = {
  inicio: () => inicio(),
  ronda: nuevaRonda,
  retoIntro, retoJugar,
  progreso, papas,
  guia: () => empezarGuia("inicio"),
  "saltar-guia": () => terminarGuia(true),
  "seguir-juego": () => cerrarSalir(false),
  "salir-juego": () => cerrarSalir(true),
  "seguir-cruce": seguirCruce,
  voz: () => { pr = { ...pr, voz: !pr.voz }; guardar(); inicio("voz"); },
  unidad: () => { pr = { ...pr, unidad: cicloUnidad(pr.unidad) }; guardar(); papas(); },
  elegir: (ds) => { pr = { ...pr, elegido: +ds.n }; guardar(); inicio(); },
};

function actuar(t) {
  if (!t || t.disabled) return;
  const act = t.dataset.act;
  if (act === "ir" && IR[t.dataset.ir]) { clic(); IR[t.dataset.ir](t.dataset); return; }
  if (esGuia()) return actuarGuia(t);
  if (bloqueadoTrasGuia()) return;
  if (act === "mover") { moverReglaJuego(+t.dataset.dir); return; }
  if (act === "poner") { confirmarPoner(); return; }
  if (act === "opcion") { elegirOpcion(t.dataset.valor); return; }
  if (act === "sino") { elegirOpcion(t.dataset.valor); return; }
  if (act === "valor") { cambiarValor(+t.dataset.dir); return; }
  if (act === "listo") { confirmarListo(); return; }
  if (act === "sumar") { sumarTabla(t.dataset.valor); return; }
  if (act === "quitar") { quitarTabla(); return; }
  if (act === "cruzar") { confirmarCruzar(); return; }
}

function actuarGuia(t) {
  const paso = partida.reloj.paso;
  if (t.dataset.act === "mover") { moverGuia(+t.dataset.dir); return; }
  let evento = null;
  if (t.dataset.act === "poner") evento = { tipo: "poner", desplaza: partida.desplaza };
  else if (t.dataset.act === "guia-op") evento = { tipo: "elegir", valor: +t.dataset.valor };
  else if (t.dataset.act === "guia-tabla") evento = { tipo: "tabla", valor: +t.dataset.valor };
  else if (esMirar(paso)) evento = { tipo: "toque" };
  if (!evento) return;
  const r = responderGuia(partida.reloj, Date.now(), evento);
  if (r.accion === "avanzo") aplicarReloj(r.reloj);
  else if (evento.tipo === "poner") {
    partida.brillo = true;
    const voz = partida.reloj.reiniciarVoz;
    pintarGuia();
    partida.reloj.reiniciarVoz = voz;
  }
}

function moverReglaJuego(delta) {
  const c = cruceActual();
  if (!c || faseActual() !== "poner" || !c.puedeMover) return;
  partida.desplaza = moverRegla(partida.desplaza, delta);
  partida.brillo = false;
  pintarCruce(delta < 0 ? "izq" : "der");
}

$main.addEventListener("click", (ev) => {
  const t = ev.target.closest("[data-act]");
  const via = entradaLibre("toque");
  if (via === "ignorar") return;
  if (via === "dialogo") {
    const ir = t && t.dataset.ir;
    if (ir === "seguir-juego") cerrarSalir(false);
    else if (ir === "salir-juego") cerrarSalir(true);
    return;
  }
  if (!t || !$main.contains(t)) {
    if (esGuia() && esMirar(partida.reloj.paso)) {
      const r = responderGuia(partida.reloj, Date.now(), { tipo: "toque" });
      if (r.accion === "avanzo") aplicarReloj(r.reloj);
    }
    return;
  }
  actuar(t);
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
  if (entradaLibre(accion === "ok" ? "ok" : "flecha") === "dialogo") {
    if (moverFoco(accion, $main)) return true;
    if (accion === "ok") {
      const e = document.activeElement;
      if (e && $main.contains(e) && !e.disabled) e.click();
    }
    return true;
  }
  if (entradaLibre(accion === "ok" ? "ok" : "flecha") === "ignorar") return true;
  if (esGuia()) {
    if (partida.reloj.paso === 2 && (accion === "izquierda" || accion === "derecha")) {
      moverGuia(accion === "izquierda" ? -1 : 1);
      return true;
    }
    if (accion === "ok") {
      const e = document.activeElement;
      const id = e && e.dataset && e.dataset.focoId;
      if (id === "saltar") { terminarGuia(true); return true; }
      if (esMirar(partida.reloj.paso)) {
        const r = responderGuia(partida.reloj, Date.now(), { tipo: "ok" });
        if (r.accion === "avanzo") aplicarReloj(r.reloj);
        return true;
      }
      if (e && $main.contains(e) && !e.disabled) e.click();
      return true;
    }
    if (moverFoco(accion, $main)) return true;
    return true;
  }
  if (pantalla === "cruce" && partida && !partida.revelado && !bloqueadoTrasGuia()) {
    const fase = faseActual();
    if (fase === "poner" && (accion === "izquierda" || accion === "derecha")) {
      moverReglaJuego(accion === "izquierda" ? -1 : 1);
      return true;
    }
    if ((fase === "leer" || fase === "comparar" || fase === "estimaLibre") && (accion === "arriba" || accion === "abajo")) {
      cambiarValor(accion === "arriba" ? 1 : -1);
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

prepararVoces();
Noli.datos.then((d) => { pr = cargar(d); return cargarTodo(); }).then(() => inicio());
