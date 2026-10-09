// Pantallas de Cuentos Revueltos. La lógica está en los otros módulos.
import { Noli, moverFoco, focoInicial } from "../../../kit/noli.js";
import { TEXTOS } from "./textos.js";
import { decirEs, decirGrabacion, callar, desbloquear as desbloquearVoz } from "./voz.js";
import { clic, listo as tonoListo, bien, desbloquear as desbloquearSonido } from "./sonido.js";
import { slugFrase } from "./audios.js";
import {
  palabrasDe, clavePalabra, tiemposPalabra, indiceHablado, pasoLectura, duracionSiFalla,
} from "./lectura.js";
import {
  paginaDe, prepararTareas, conRepaso, bancoPalabras, acierto, respuestaDe, tareasCalificables,
} from "./cuentos.js";
import {
  ordenNuevo, tomar, soltar, poner, estaCompleto, siguienteTarjeta, cuentaPrimeraOrden,
} from "./orden.js";
import {
  fasePista, marcaPasoCompleto, textoCorto, esPregunta, cuentaPrimeraPregunta, itemLimpio, fraseListo,
} from "./pista.js";
import {
  cargar, cuentoDe, guardarCurso, anotarTarea, cerrarCapitulo, reiniciarCuento, marcarGuia,
  ponerVoz, leeSolo, desbloqueado, fechaLocal, textoRacha, semana, cumplirReto, dominio,
} from "./progreso.js";
import { retoDelDia } from "./reto.js";
import { rngConSemilla, revolver } from "./rng.js";
import {
  guiaNueva, reducirGuia, debeAutoAvanzar, vozPaso, listoGuiaActivo, focoGuia, saltarEnFlechas, esMirar,
  bloqueoTrasGuia,
} from "./guia.js";
import { zonaPermitida, debeIgnorar, hastaIgnorar, hastaLibre } from "./salida.js";
import { relojPausar, relojReanudar, relojMs } from "./reloj.js";

const $main = document.getElementById("juego");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

try {
  if (new URLSearchParams(location.search).get("modo") === "tv") document.documentElement.dataset.modo = "tv";
} catch { /* abierto como archivo */ }

const CARTAS_GUIA = {
  casas: { oraciones: ["The pigs build."], dibujo: "escena-casa-ladrillos.svg" },
  lobo: { oraciones: ["The wolf huffed."], dibujo: "personaje-lobo.svg" },
  cozy: { oraciones: ["The pigs felt cozy."], dibujo: "dibujos/dibujo-cozy.svg" },
};

let pr = null;
let cuentos = [];
let glosario = {};
const cache = {};
let cargado = false;
let pantalla = "carga";
let guia = null;
let sesion = null;
let dialogo = false;
let ayuda = null;
let ignorarHasta = 0;
let bloqueoGeneral = 0;
let aviso = "";
let faseVista = "";
let listoSono = false;
let lecToken = 0;
let nSvg = 0;
let pulso = 0;

const esTv = () => Noli.modo === "tv" || document.documentElement.dataset.modo === "tv";
const hoy = () => fechaLocal();
const cuentoActual = () => cuentos.find((c) => c.id === sesion?.cuentoId) || null;
const tareaActual = () => sesion?.tareas?.[sesion.i] || null;

function archivo(ruta) {
  return new URL(ruta, import.meta.url);
}

Noli.alEntrar((accion) => {
  if (!cargado) return true;
  if (esTv()) document.documentElement.classList.add("teclado");
  if (accion === "atras") { onAtras(); return true; }
  if (dialogo) {
    const raiz = $main.querySelector(".dialogo") || $main;
    if (moverFoco(accion, raiz)) return true;
    if (accion === "ok") document.activeElement?.click();
    return true;
  }
  if (ayuda) {
    const raiz = $main.querySelector(".ayuda") || $main;
    if (moverFoco(accion, raiz)) return true;
    if (accion === "ok" && !debeIgnorar(Date.now(), ignorarHasta)) document.activeElement?.click();
    return true;
  }
  if (moverFoco(accion, $main)) return true;
  if (accion === "ok") {
    if (Date.now() < hastaLibre(bloqueoGeneral, ignorarHasta)) return true;
    const el = document.activeElement;
    if (el && el !== document.body && $main.contains(el)) { el.click(); return true; }
    if (pantalla === "guia" && guia && esMirar(guia.paso)) {
      const antes = guia.paso;
      guia = reducirGuia(guia, { tipo: "toque", ahora: Date.now() });
      if (guia.paso !== antes || guia.fin) trasGuia(true);
    }
  }
  return true;
});

$main?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) {
    if (pantalla === "guia" && guia && esMirar(guia.paso) && !dialogo && !debeIgnorar(Date.now(), ignorarHasta)) {
      const antes = guia.paso;
      guia = reducirGuia(guia, { tipo: "toque", ahora: Date.now() });
      if (guia.paso !== antes || guia.fin) trasGuia(true);
    }
    return;
  }
  const zona = btn.closest(".dialogo") ? "dialogo" : "fondo";
  if (!zonaPermitida(dialogo, zona)) return;
  if (!dialogo && Date.now() < hastaLibre(bloqueoGeneral, ignorarHasta)) return;
  clic();
  const act = btn.dataset.act;
  if (act === "seguir-dialogo") { cerrarSalida(); return; }
  if (act === "salir") { salirDelJuego(); return; }
  if (act === "cerrar-ayuda") { ayuda = null; pintar(false); return; }
  if (act === "palabra") {
    e.stopPropagation();
    abrirAyuda(btn.dataset.clave);
    return;
  }
  if (pantalla === "guia") { actoGuia(act, btn); return; }
  actoJuego(act, btn);
});

document.addEventListener("pointerdown", () => {
  desbloquearVoz();
  desbloquearSonido();
}, { once: true });

function onAtras() {
  if (dialogo) { cerrarSalida(); return; }
  ayuda = null;
  abrirSalida();
}

function abrirSalida() {
  const ahora = Date.now();
  callar();
  lecToken += 1;
  if (pantalla === "guia" && guia && !guia.dialogo) guia = reducirGuia(guia, { tipo: "atras", ahora });
  if (sesion?.item?.reloj) sesion.item.reloj = relojPausar(sesion.item.reloj, ahora);
  dialogo = true;
  pintar(true);
}

function cerrarSalida() {
  const ahora = Date.now();
  dialogo = false;
  if (pantalla === "guia" && guia?.dialogo) {
    guia = reducirGuia(guia, { tipo: "seguir", ahora });
    ignorarHasta = guia.ignorarHasta;
    pintarGuia(true);
    decirGuia();
    return;
  }
  if (sesion?.item?.reloj) sesion.item.reloj = relojReanudar(sesion.item.reloj, ahora);
  ignorarHasta = hastaIgnorar(ahora);
  pintar(false);
}

function salirDelJuego() {
  if (pantalla === "guia" && guia) {
    guia = reducirGuia(guia, { tipo: "salir", ahora: Date.now() });
    if (guia.fin) { terminarGuia(); return; }
  }
  Noli.guardar(pr);
  Noli.salir();
}

function mostrar(html, nombre, focoId, robar) {
  pantalla = nombre;
  if (!$main) return;
  $main.className = "p-" + nombre;
  $main.innerHTML = html;
  if (esTv()) document.documentElement.classList.add("teclado");
  aplicarArte($main);
  if (robar === false) return;
  const el = focoId && $main.querySelector(`[data-foco-id="${focoId}"]`);
  if (el) el.focus({ preventScroll: true });
  else focoInicial(dialogo ? ($main.querySelector(".dialogo") || $main) : $main);
}

function aplicarArte(raiz) {
  for (const n of raiz.querySelectorAll("[data-svg]")) {
    const txt = cache[n.dataset.svg];
    if (!txt) continue;
    nSvg += 1;
    const suf = "-" + nSvg;
    n.innerHTML = txt
      .replace(/\bid="([^"]+)"/g, (_, id) => `id="${id}${suf}"`)
      .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${id}${suf})`);
    if (n.dataset.numero != null) {
      const t = n.querySelector(".numero");
      if (t) t.textContent = n.dataset.numero;
    }
  }
}

function svg(nombre, extra = "") {
  return `<span class="svg" data-svg="${esc(nombre)}" ${extra}></span>`;
}

function estrellasHtml(n) {
  const una = (on) => `<svg viewBox="0 0 24 24" class="${on ? "on" : "off"}" aria-hidden="true"><path d="M12 2.5l2.7 6.3 6.8.6-5.2 4.4 1.6 6.6L12 16.8 6.1 20.4l1.6-6.6L2.5 9.4l6.8-.6z"/></svg>`;
  return `<span class="estrellas" aria-label="${n} de 3">${[0, 1, 2].map((i) => una(i < n)).join("")}</span>`;
}

function palabrasHtml(oracion, { foco, frase }) {
  const partes = String(oracion ?? "").split(/(\s+)/);
  let i = 0;
  return partes.map((parte) => {
    if (!parte) return "";
    if (!parte.trim()) return esc(parte);
    const clave = clavePalabra(parte);
    const idx = i;
    i += 1;
    const focoAttr = foco ? ` tabindex="0" data-foco data-foco-id="w-${frase}-${idx}"` : "";
    return `<button type="button" class="palabra" data-act="palabra" data-clave="${esc(clave)}" data-frase="${frase}" data-i="${idx}"${focoAttr}>${esc(parte)}</button>`;
  }).join("");
}

function htmlCab(titulo, { saltar = false } = {}) {
  const enFlechas = saltar && guia && saltarEnFlechas(guia.paso);
  const salto = saltar
    ? `<button type="button" class="boton saltar" data-act="saltar" ${enFlechas ? 'tabindex="0" data-foco data-foco-id="saltar"' : 'tabindex="-1"'}>${esc(TEXTOS.saltar)}</button>`
    : "<span></span>";
  return `<header class="cab">
    <button type="button" class="icono" data-act="escuchar" tabindex="0" data-foco data-foco-id="escuchar" aria-label="${esc(TEXTOS.escuchar)}">${svg("boton-escuchar.svg")}</button>
    <h1 class="titulo">${esc(titulo)}</h1>
    ${salto}
  </header>`;
}

function htmlDialogo() {
  if (!dialogo) return "";
  return `<div class="velo"><div class="dialogo" role="dialog" aria-label="${esc(TEXTOS.preguntaSalir)}">
    <p class="pregunta">${esc(TEXTOS.preguntaSalir)}</p>
    <button type="button" class="boton grande primario" data-foco="inicial" data-foco-id="seguir" data-act="seguir-dialogo">${esc(TEXTOS.seguir)}</button>
    <button type="button" class="boton grande" data-foco data-foco-id="salir" data-act="salir">${esc(TEXTOS.salir)}</button>
  </div></div>`;
}

function htmlAyuda() {
  if (!ayuda) return "";
  const dato = glosario[ayuda] || { es: ayuda, dibujo: "libro-abierto.svg" };
  return `<div class="velo ayuda"><div class="dialogo" role="dialog" aria-label="${esc(dato.es)}">
    <div class="dibujo grande">${svg(dato.dibujo)}</div>
    <p class="coach">${esc(dato.es)}</p>
    <button type="button" class="boton grande primario" data-foco="inicial" data-foco-id="cerrar-ayuda" data-act="cerrar-ayuda">${svg("boton-listo.svg")}<span>${esc(TEXTOS.listo)}</span></button>
  </div></div>`;
}

function capas(html, nombre, focoId, robar) {
  const foco = dialogo ? "seguir" : (ayuda ? "cerrar-ayuda" : focoId);
  mostrar(html + htmlAyuda() + htmlDialogo(), nombre, foco, robar);
}

function pintar(robar) {
  if (pantalla === "guia") return pintarGuia(robar);
  if (pantalla === "librero") return pintarLibrero();
  if (pantalla === "jugar") return pintarJugar(robar);
  if (pantalla === "feedback") return pintarFeedback();
  if (pantalla === "fin") return pintarFin();
  if (pantalla === "releer") return pintarReleer(robar);
  if (pantalla === "finreto") return pintarFinReto();
}

// ---------- Librero ----------

function libroParaOir() {
  const enMarcha = cuentos.find((c) => {
    const e = cuentoDe(pr, c.id);
    return desbloqueado(cuentos, pr, c.id) && (e.enCurso || e.cap > 0 || e.completo || e.ultimos.length);
  });
  return enMarcha || cuentos[0];
}

function pintarLibrero() {
  sesion = null;
  guia = null;
  const libros = cuentos.map((c) => {
    const abierto = desbloqueado(cuentos, pr, c.id);
    const e = cuentoDe(pr, c.id);
    const dom = dominio(pr, c.id);
    const portada = abierto ? c.portada : "libro-siguiente.svg";
    const nombre = abierto ? c.titulo : TEXTOS.bloqueado;
    const foco = abierto ? ` tabindex="0" data-foco data-foco-id="libro-${c.id}"` : "disabled";
    return `<button type="button" class="libro${abierto ? "" : " cerrado"}" data-act="libro" data-id="${esc(c.id)}" ${foco} aria-label="${esc(nombre)}">
      ${svg(portada)}
      <span class="nombre">${esc(nombre)}</span>
      ${abierto ? estrellasHtml(e.estrellas) : ""}
      ${dom.listo ? `<span class="domina">${esc(TEXTOS.domina)}</span>` : ""}
    </button>`;
  }).join("");
  const reto = pr.retos[hoy()];
  capas(`
    <h1 class="titulo pagina">${esc(TEXTOS.titulo)}</h1>
    ${aviso ? `<p class="aviso">${esc(aviso)}</p>` : ""}
    <div class="estante">${svg("librero.svg")}<div class="libros">${libros}</div></div>
    <p class="racha">${esc(textoRacha(pr, hoy()))}</p>
    <div class="semana" aria-hidden="true">${semana(pr, hoy()).map((d) => `<i class="${d.reto ? "reto" : d.jugo ? "jugo" : ""}"></i>`).join("")}</div>
    <div class="menu">
      <button type="button" class="boton grande reto" data-act="reto" tabindex="0" data-foco data-foco-id="reto">${esc(TEXTOS.reto)}${reto?.cumplido ? estrellasHtml(3) : ""}</button>
      <button type="button" class="boton grande" data-act="oir" tabindex="0" data-foco data-foco-id="oir">${esc(TEXTOS.oirCuento)}</button>
      <button type="button" class="boton grande" data-act="como" tabindex="0" data-foco data-foco-id="como">${esc(TEXTOS.como)}</button>
      <button type="button" class="boton grande" data-act="voz" tabindex="0" data-foco data-foco-id="voz">${esc(pr.voz ? TEXTOS.vozSi : TEXTOS.vozNo)}</button>
    </div>
  `, "librero", cuentos[0] ? `libro-${cuentos[0].id}` : "reto", true);
}

function abrirCuento(id) {
  if (!desbloqueado(cuentos, pr, id)) return;
  aviso = "";
  const e = cuentoDe(pr, id);
  if (e.enCurso && Array.isArray(e.tareas) && e.i < e.tareas.length) {
    sesion = {
      modo: "cuento", cuentoId: id, cap: e.cap, tareas: e.tareas, i: e.i,
      come: e.come, aciertos: e.aciertosCap, orden: null, item: null, feedback: null,
    };
    entrarTarea(true);
    return;
  }
  let cap = e.cap;
  if (e.completo && !e.enCurso) {
    pr = reiniciarCuento(pr, id);
    Noli.guardar(pr);
    cap = 0;
  }
  empezarCapitulo(id, cap);
}

function empezarCapitulo(id, cap) {
  const cuento = cuentos.find((c) => c.id === id);
  const caps = cuento?.capitulos || [];
  if (cap >= caps.length) cap = 0;
  const rnd = rngConSemilla(`${id}:${caps[cap]?.id || cap}:${Date.now()}`);
  let tareas = conRepaso(caps[cap].tareas, cuentoDe(pr, id).palabrasMal, bancoPalabras(cuentos));
  tareas = prepararTareas(tareas, rnd).map((t) => (
    t.tipo === "ordenar" ? { ...t, mazo: revolver(rnd, [...(t.tarjetas || [])]) } : t
  ));
  sesion = {
    modo: "cuento", cuentoId: id, cap, tareas, i: 0, come: null, aciertos: 0,
    orden: null, item: null, feedback: null,
  };
  pr = guardarCurso(pr, id, { cap, i: 0, tareas, come: null, aciertosCap: 0 });
  Noli.guardar(pr);
  entrarTarea(true);
}

function abrirReto() {
  aviso = "";
  const reto = retoDelDia(hoy(), cuentos, pr);
  sesion = {
    modo: "reto", reto, cuentoId: null, cap: 0, tareas: reto.items, i: 0, come: null,
    aciertos: 0, orden: null, item: null, feedback: null,
  };
  entrarTarea(true);
}

// ---------- Guía ----------

function abrirGuia() {
  guia = guiaNueva(Date.now());
  dialogo = false;
  ayuda = null;
  listoSono = false;
  sesion = null;
  pintarGuia(true);
  decirGuia();
}

function decirGuia() {
  if (!guia || guia.fin || guia.dialogo || dialogo) return;
  if (!pr.voz) {
    guia = reducirGuia(guia, { tipo: "voz", resultado: "fallo", ahora: Date.now() });
    return;
  }
  const texto = vozPaso(guia.paso, esTv(), listoGuiaActivo(guia));
  decirEs(
    texto,
    () => { if (guia && !guia.dialogo) guia = reducirGuia(guia, { tipo: "voz", resultado: "termino", ahora: Date.now() }); },
    () => { if (guia && !guia.dialogo) guia = reducirGuia(guia, { tipo: "voz", resultado: "fallo", ahora: Date.now() }); },
  );
}

function actoGuia(act, btn) {
  if (act === "escuchar") {
    decirEs(vozPaso(guia.paso, esTv(), listoGuiaActivo(guia)));
    return;
  }
  const antes = guia.paso;
  const listoAntes = listoGuiaActivo(guia);
  const ahora = Date.now();
  if (act === "mirar") guia = reducirGuia(guia, { tipo: "toque", ahora });
  else if (act === "saltar") guia = reducirGuia(guia, { tipo: "saltar", ahora });
  else if (act === "tomar") guia = reducirGuia(guia, { tipo: "tomar", id: btn.dataset.id, ahora });
  else if (act === "poner") guia = reducirGuia(guia, { tipo: "poner", slot: Number(btn.dataset.slot), ahora });
  else if (act === "soltar") guia = reducirGuia(guia, { tipo: "soltar", ahora });
  else if (act === "listo") guia = reducirGuia(guia, { tipo: "listo", ahora });
  const cambio = guia.fin || guia.paso !== antes || listoGuiaActivo(guia) !== listoAntes;
  if (cambio) trasGuia(guia.paso !== antes || listoGuiaActivo(guia) !== listoAntes);
  else pintarGuia(false);
}

function trasGuia(hablar) {
  if (guia.fin) { terminarGuia(); return; }
  if (guia.paso !== 3) listoSono = false;
  pintarGuia(true);
  if (hablar) decirGuia();
}

function terminarGuia() {
  callar();
  lecToken += 1;
  if (guia.guardar) pr = marcarGuia(pr);
  Noli.guardar(pr);
  const sale = guia.salir;
  guia = null;
  dialogo = false;
  if (sale) { Noli.salir(); return; }
  bloqueoGeneral = bloqueoTrasGuia(Date.now());
  aviso = TEXTOS.vamos;
  pintarLibrero();
}

function flechaGuiaCarta(id) {
  if (!guia) return false;
  if (guia.paso === 2) return id === "casas";
  if (guia.paso === 3 && !guia.tomada) return id === "casas";
  return false;
}

function pintarGuia(robar) {
  if (!guia) return;
  const listoOn = listoGuiaActivo(guia);
  if (listoOn && !listoSono) { listoSono = true; tonoListo(); }
  if (!listoOn) listoSono = false;
  const texto = vozPaso(guia.paso, esTv(), listoOn);
  let cuerpo = "";
  if (esMirar(guia.paso)) {
    cuerpo = `<div class="guia-mira">
      <div class="lobo">${svg("personaje-lobo-travieso.svg")}</div>
      <div class="paginas">${svg("paginas-revueltas.svg")}</div>
    </div>
    <button type="button" class="boton coach" data-act="mirar" tabindex="0" data-foco="inicial" data-foco-id="coach">${esc(texto)}</button>`;
  } else {
    const cartas = guia.mazo.map((id) => htmlCartaGuia(id)).join("");
    const huecos = guia.huecos.map((id, slot) => htmlHuecoGuia(id, slot)).join("");
    const mano = guia.tomada ? `<p class="mano">${esc(TEXTOS.mano)}: ${esc(CARTAS_GUIA[guia.tomada].oraciones[0])}</p>` : "";
    cuerpo = `<p class="pista">${esc(texto)}</p>
      <div class="rejilla n3">${cartas}</div>
      <div class="rejilla huecos n3">${huecos}</div>
      ${mano}
      <div class="acciones">
        ${guia.tomada ? `<button type="button" class="boton" data-act="soltar" tabindex="0" data-foco data-foco-id="soltar">${svg("boton-soltar.svg")}<span>${esc(TEXTOS.soltar)}</span></button>` : ""}
        <button type="button" class="boton listo${listoOn ? " brilla" : ""}" data-act="listo" ${listoOn ? 'tabindex="0" data-foco data-foco-id="listo"' : "disabled"}>${svg("boton-listo.svg")}<span>${esc(TEXTOS.listo)}</span></button>
      </div>`;
  }
  const foco = focoGuia(guia.paso, listoOn);
  capas(`${htmlCab(TEXTOS.titulo, { saltar: true })}${cuerpo}`, "guia", foco, robar);
}

function htmlCartaGuia(id) {
  const c = CARTAS_GUIA[id];
  const flecha = flechaGuiaCarta(id);
  return `<div class="tarjeta${flecha ? " con-flecha" : ""}">
    <button type="button" class="cuerpo" data-act="tomar" data-id="${id}" tabindex="0" data-foco data-foco-id="tarjeta-${id}" aria-label="${esc(c.oraciones[0])}">
      <span class="dibujo">${svg(c.dibujo)}</span>
      ${flecha ? `<span class="flecha">${svg("flecha-pista.svg")}</span>` : ""}
    </button>
    <div class="zona-texto"><p class="linea">${palabrasHtml(c.oraciones[0], { foco: false, frase: id })}</p></div>
  </div>`;
}

function htmlHuecoGuia(id, slot) {
  const flecha = guia.paso === 3 && guia.tomada && slot === 0;
  if (!id) {
    return `<button type="button" class="hueco${flecha ? " con-flecha" : ""}" data-act="poner" data-slot="${slot}" tabindex="0" data-foco data-foco-id="hueco-${slot}" aria-label="${slot + 1}">
      ${svg("tarjeta-hueco.svg", `data-numero="${slot + 1}"`)}
      ${flecha ? `<span class="flecha">${svg("flecha-pista.svg")}</span>` : ""}
    </button>`;
  }
  const c = CARTAS_GUIA[id];
  return `<div class="hueco lleno">
    <button type="button" class="cuerpo mini" data-act="tomar" data-id="${id}" tabindex="0" data-foco data-foco-id="tarjeta-${id}">
      <span class="dibujo">${svg(c.dibujo)}</span>
      <span class="num">${slot + 1}</span>
    </button>
  </div>`;
}

// ---------- Juego ----------

function nivelActual() {
  if (sesion?.modo === "reto") {
    const t = tareaActual();
    const id = t?.cuento || dueno(t?.palabra);
    return cuentos.find((c) => c.id === id)?.nivel || 2;
  }
  return cuentoActual()?.nivel || 1;
}

function dueno(palabra) {
  if (!palabra) return null;
  const c = cuentos.find((cuento) => (cuento.capitulos || []).some((cap) => (
    (cap.tareas || []).some((t) => t.palabra === palabra)
  )));
  return c?.id || null;
}

function faseDeAhora() {
  const t = tareaActual();
  if (!sesion?.item || !t) return "corta";
  return fasePista({
    nivel: nivelActual(),
    tipo: t.tipo,
    ms: relojMs(sesion.item.reloj, Date.now()),
    errores: sesion.item.errores,
  });
}

function marcarCompleta() {
  const t = tareaActual();
  if (!sesion?.item || !t) return;
  const ms = relojMs(sesion.item.reloj, Date.now());
  const fase = fasePista({ nivel: nivelActual(), tipo: t.tipo, ms, errores: sesion.item.errores });
  if (marcaPasoCompleto({ nivel: nivelActual(), fase, ms, errores: sesion.item.errores })) sesion.item.vioCompleta = true;
  return fase;
}

function entrarTarea(hablar) {
  const t = tareaActual();
  if (!t) {
    if (sesion?.modo === "reto") pintarFinReto();
    else pintarFin();
    return;
  }
  sesion.feedback = null;
  sesion.item = itemLimpio(Date.now());
  listoSono = false;
  if (t.tipo === "ordenar") sesion.orden = ordenNuevo(t.tarjetas, t.mazo || t.tarjetas);
  else sesion.orden = null;
  faseVista = faseDeAhora();
  if (sesion.modo === "cuento") {
    pr = guardarCurso(pr, sesion.cuentoId, {
      cap: sesion.cap, i: sesion.i, tareas: sesion.tareas, come: sesion.come, aciertosCap: sesion.aciertos,
    });
    Noli.guardar(pr);
  }
  pintarJugar(true);
  if (hablar) narrarTarea();
}

function textoPista(t, fase) {
  if (!t) return "";
  if (t.tipo === "ordenar") {
    if (fase === "completa" || fase === "espanol") {
      const sig = siguienteTarjeta(sesion.orden);
      const p = sig && paginaDe(cuentoActual(), sig.id);
      return p?.pista || textoCorto("ordenar");
    }
    return textoCorto("ordenar");
  }
  if (fase === "espanol" && t.preguntaEs) return t.preguntaEs;
  if (fase === "completa" || fase === "espanol") return t.pista || t.preguntaEs || textoCorto(t.tipo);
  return textoCorto(t.tipo);
}

function frasesTarea(t) {
  if (!t) return [];
  if (t.tipo === "ordenar") {
    const ids = sesion.orden?.mazo || [];
    const c = cuentoActual();
    const out = [];
    for (const id of ids) {
      const p = paginaDe(c, id);
      if (p) out.push(...(p.oraciones || []));
    }
    return out;
  }
  if (t.tipo === "palabra" && t.oracion) return [t.oracion];
  if (t.pregunta) return [t.pregunta];
  return [];
}

function narrarTarea() {
  const t = tareaActual();
  if (!t || dialogo) return;
  const frases = frasesTarea(t);
  const token = ++lecToken;
  const ingles = () => {
    if (token !== lecToken) return;
    if (sesion?.modo === "cuento" && leeSolo(pr, sesion.cuentoId)) return;
    if (frases.length) leerFrases(frases, 0);
  };
  if (!pr.voz) { ingles(); return; }
  const texto = textoPista(t, faseDeAhora());
  decirEs(texto, ingles, () => {
    setTimeout(() => { if (token === lecToken) ingles(); }, duracionSiFalla(texto));
  });
}

function oirIngles() {
  if (pantalla === "releer" && sesion) {
    const p = cuentoActual()?.paginas?.[sesion.releer];
    if (p) leerFrases(p.oraciones || [], 0);
    return;
  }
  if (pantalla === "feedback" && sesion?.feedback?.frases?.length) {
    leerFrases(sesion.feedback.frases, 0);
    return;
  }
  const frases = frasesTarea(tareaActual());
  if (frases.length) leerFrases(frases, 0);
}

function leerFrases(frases, desde) {
  const token = ++lecToken;
  const correr = (i) => {
    if (token !== lecToken) return;
    if (!frases || i >= frases.length) return;
    const frase = frases[i];
    const palabras = palabrasDe(frase);
    let tiempos = tiemposPalabra(palabras, duracionSiFalla(frase));
    const marcar = (ms, lista) => {
      if (token !== lecToken) return;
      const idx = indiceHablado(lista, ms);
      $main?.querySelectorAll(`.palabra[data-frase="${i}"]`).forEach((b) => {
        b.classList.toggle("habla", Number(b.dataset.i) === idx);
      });
    };
    const seguir = () => {
      if (token !== lecToken) return;
      const n = pasoLectura(frases, i, "fin");
      if (n.seguir) correr(n.indice);
    };
    const fallar = () => {
      if (token !== lecToken) return;
      const f = pasoLectura(frases, i, "fallo");
      const t0 = Date.now();
      const id = setInterval(() => {
        if (token !== lecToken) { clearInterval(id); return; }
        const ms = Date.now() - t0;
        marcar(ms, f.tiempos);
        if (ms >= f.esperarMs) { clearInterval(id); seguir(); }
      }, 90);
    };
    decirGrabacion(`audio/f/${slugFrase(frase)}.mp3`, {
      respaldo: frase,
      alDuracion(ms) { tiempos = tiemposPalabra(palabras, ms || duracionSiFalla(frase)); },
      alTiempo(ms) { marcar(ms, tiempos); },
      alTerminar: seguir,
      alFallar: fallar,
    });
  };
  correr(desde || 0);
}

function tituloJuego() {
  if (sesion?.modo === "reto") return sesion.reto?.tipo === "pagina" ? TEXTOS.paginaDia : TEXTOS.palabraDia;
  const c = cuentoActual();
  return c ? `${c.titulo}` : TEXTOS.titulo;
}

function senal() {
  const t = tareaActual();
  const fase = faseDeAhora();
  if (!t || t.tipo !== "ordenar" || fase === "corta") return null;
  return siguienteTarjeta(sesion.orden);
}

function pintarJugar(robar) {
  const t = tareaActual();
  if (!t) return;
  const fase = faseDeAhora();
  faseVista = fase;
  const completo = t.tipo === "ordenar" && estaCompleto(sesion.orden);
  if (completo && !listoSono) { listoSono = true; tonoListo(); }
  if (!completo) listoSono = false;
  const pista = textoPista(t, fase);
  const extra = completo ? ` ${fraseListo(esTv()).texto}` : "";
  let cuerpo = "";
  if (t.tipo === "ordenar") cuerpo = htmlOrden(t, fase);
  else if (t.tipo === "cruce") cuerpo = htmlCruce(t);
  else cuerpo = htmlPregunta(t, fase);
  const foco = completo ? "listo" : (t.tipo === "ordenar" ? `tarjeta-${(sesion.orden?.mazo || [])[0] || "0"}` : `op-${t.opciones?.[0]?.id || "0"}`);
  capas(`
    ${htmlCab(tituloJuego())}
    <p class="avance">${esc(TEXTOS.capitulo)} ${sesion.modo === "reto" ? "" : sesion.cap + 1} ${esc(TEXTOS.de)} ${sesion.tareas.length}</p>
    <p class="pista">${esc(pista + extra)}</p>
    ${cuerpo}
  `, "jugar", foco, robar);
}

function htmlOrden(t, fase) {
  const c = cuentoActual();
  const mostrarDibujo = !(t.soloTexto && fase !== "completa" && fase !== "espanol");
  const sig = senal();
  let frase = 0;
  const carta = (id, enHueco, slot) => {
    const p = paginaDe(c, id);
    const oraciones = p?.oraciones || [];
    const flecha = sig && sig.id === id && !enHueco && sesion.orden.tomada !== id;
    const lineas = oraciones.map((o) => {
      const html = `<p class="linea">${palabrasHtml(o, { foco: false, frase })}</p>`;
      frase += 1;
      return html;
    }).join("");
    const dibujo = mostrarDibujo ? (p?.escena || "tarjeta-sin-dibujo.svg") : "tarjeta-sin-dibujo.svg";
    return `<div class="tarjeta${flecha ? " con-flecha" : ""}">
      <button type="button" class="cuerpo" data-act="tomar" data-id="${esc(id)}" tabindex="0" data-foco data-foco-id="tarjeta-${esc(id)}" aria-label="${esc(id)}">
        <span class="dibujo">${svg(dibujo)}</span>
        ${enHueco ? `<span class="num">${slot + 1}</span>` : ""}
        ${flecha ? `<span class="flecha">${svg("flecha-pista.svg")}</span>` : ""}
      </button>
      <div class="zona-texto">${lineas}</div>
    </div>`;
  };
  const n = sesion.orden.huecos.length;
  const huecos = sesion.orden.huecos.map((id, slot) => {
    const flecha = sig && sesion.orden.tomada === sig.id && sig.slot === slot;
    if (!id) {
      return `<button type="button" class="hueco${flecha ? " con-flecha" : ""}" data-act="poner" data-slot="${slot}" tabindex="0" data-foco data-foco-id="hueco-${slot}" aria-label="${slot + 1}">
        ${svg("tarjeta-hueco.svg", `data-numero="${slot + 1}"`)}
        ${flecha ? `<span class="flecha">${svg("flecha-pista.svg")}</span>` : ""}
      </button>`;
    }
    return `<div class="hueco lleno">${carta(id, true, slot)}</div>`;
  }).join("");
  const mazo = sesion.orden.mazo.map((id) => carta(id, false, -1)).join("");
  const mano = sesion.orden.tomada
    ? `<button type="button" class="boton" data-act="soltar" tabindex="0" data-foco data-foco-id="soltar">${svg("boton-soltar.svg")}<span>${esc(TEXTOS.soltar)}</span></button>`
    : "";
  return `<div class="rejilla n${n}">${mazo}</div>
    <div class="rejilla huecos n${n}">${huecos}</div>
    <div class="acciones">
      ${mano}
      <button type="button" class="boton listo${estaCompleto(sesion.orden) ? " brilla" : ""}" data-act="listo" ${estaCompleto(sesion.orden) ? 'tabindex="0" data-foco data-foco-id="listo"' : "disabled"}>${svg("boton-listo.svg")}<span>${esc(TEXTOS.listo)}</span></button>
    </div>`;
}

function htmlPregunta(t, fase) {
  const focoPalabra = true;
  const frase = t.tipo === "palabra" ? t.oracion : t.pregunta;
  const espanol = fase === "espanol"
    ? `<button type="button" class="boton" data-act="espanol" tabindex="0" data-foco data-foco-id="espanol">${svg("boton-en-espanol.svg")}<span>${esc(TEXTOS.enEspanol)}</span></button>`
    : "";
  const ops = (t.opciones || []).map((op) => {
    const etiq = op.texto || op.titulo || "";
    return `<button type="button" class="opcion" data-act="elegir" data-id="${esc(op.id)}" tabindex="0" data-foco data-foco-id="op-${esc(op.id)}" aria-label="${esc(etiq || op.id)}">
      <span class="dibujo">${svg(op.dibujo)}</span>
      ${etiq ? `<span class="etiq">${esc(etiq)}</span>` : ""}
    </button>`;
  }).join("");
  return `<div class="oracion">${palabrasHtml(frase || "", { foco: focoPalabra, frase: 0 })}</div>
    <div class="rejilla n${(t.opciones || []).length}">${ops}</div>
    ${espanol ? `<div class="acciones">${espanol}</div>` : ""}`;
}

function htmlCruce(t) {
  const ops = (t.opciones || []).map((op) => `<button type="button" class="opcion" data-act="cruce" data-id="${esc(op.id)}" tabindex="0" data-foco data-foco-id="op-${esc(op.id)}">
      <span class="dibujo">${svg(op.dibujo || "cruce.svg")}</span>
      <span class="etiq">${esc(op.titulo || "")}</span>
    </button>`).join("");
  return `<div class="oracion">${palabrasHtml(t.pregunta || "", { foco: true, frase: 0 })}</div>
    <div class="rejilla n2">${ops}</div>`;
}

function actoJuego(act, btn) {
  if (act === "libro") return abrirCuento(btn.dataset.id);
  if (act === "reto") return abrirReto();
  if (act === "como") return abrirGuia();
  if (act === "voz") {
    pr = ponerVoz(pr, !pr.voz);
    Noli.guardar(pr);
    pintarLibrero();
    return;
  }
  if (act === "oir") return abrirReleer(libroParaOir()?.id);
  if (act === "escuchar") {
    if (pantalla === "guia") return;
    oirIngles();
    return;
  }
  if (act === "seguir") return seguirPantalla();
  if (act === "anterior") return paginaAnterior();
  if (act === "releer") return abrirReleer(btn.dataset.id || cuentoActual()?.id);
  if (act === "espanol") return decirEs(tareaActual()?.preguntaEs || sesion?.feedback?.espanol || "");
  if (!sesion) return;
  if (act === "tomar") return alTomar(btn.dataset.id);
  if (act === "poner") return alPoner(Number(btn.dataset.slot));
  if (act === "soltar") {
    if (sesion.orden) { sesion.orden = soltar(sesion.orden); pintarJugar(false); }
    return;
  }
  if (act === "listo") return alListo();
  if (act === "elegir") return alElegir(btn.dataset.id);
  if (act === "cruce") return alCruce(btn.dataset.id);
}

function alTomar(id) {
  if (!sesion?.orden || pantalla !== "jugar") return;
  sesion.orden = tomar(sesion.orden, id);
  pintarJugar(false);
}

function alPoner(slot) {
  if (!sesion?.orden) return;
  const antes = sesion.orden.errores;
  sesion.orden = poner(sesion.orden, slot);
  if (sesion.orden.errores > antes) sesion.item.errores += 1;
  marcarCompleta();
  faseVista = faseDeAhora();
  pintarJugar(true);
}

function alListo() {
  if (!sesion?.orden || !estaCompleto(sesion.orden)) return;
  const t = tareaActual();
  marcarCompleta();
  const primera = cuentaPrimeraOrden({
    nivel: nivelActual(),
    vioCompleta: sesion.item.vioCompleta,
    cambios: sesion.orden.cambios,
    errores: sesion.orden.errores,
    tarjetas: t.tarjetas.length,
    acerto: true,
  });
  const p = paginaDe(cuentoActual(), t.tarjetas[0]);
  cerrarItem({
    ok: true,
    primera,
    dibujo: p?.escena || "",
    texto: TEXTOS.bien,
    frases: t.tarjetas.flatMap((id) => paginaDe(cuentoActual(), id)?.oraciones || []),
  });
}

function alElegir(id) {
  const t = tareaActual();
  if (!t) return;
  marcarCompleta();
  const ok = acierto(t, id, sesion.come);
  const primera = cuentaPrimeraPregunta({ nivel: nivelActual(), vioCompleta: sesion.item.vioCompleta, acerto: ok });
  const buena = respuestaDe(t, sesion.come);
  const op = (t.opciones || []).find((o) => o.id === buena) || (t.opciones || [])[0];
  if (!ok && t.palabra && sesion.modo === "reto") {
    const idCuento = dueno(t.palabra);
    if (idCuento) pr = anotarTarea(pr, idCuento, { ok: false, palabra: t.palabra }, hoy());
  }
  cerrarItem({
    ok,
    primera,
    dibujo: op?.dibujo || "",
    texto: ok ? TEXTOS.bien : TEXTOS.era,
    espanol: !ok && esPregunta(t.tipo) ? (t.preguntaEs || "") : "",
    frases: frasesTarea(t),
    anotar: sesion.modo === "cuento",
  });
}

function alCruce(id) {
  const t = tareaActual();
  const op = (t?.opciones || []).find((o) => o.id === id);
  if (!op) return;
  sesion.come = op.come;
  cerrarItem({
    ok: true,
    primera: false,
    cruce: true,
    dibujo: op.dibujo || "cruce.svg",
    texto: op.titulo || TEXTOS.cruce,
    frases: [op.titulo].filter(Boolean),
    anotar: false,
  });
}

function cerrarItem(info) {
  const t = tareaActual();
  sesion.feedback = info;
  if (sesion.modo === "cuento" && info.anotar !== false && !info.cruce) {
    sesion.aciertos += info.primera ? 1 : 0;
    pr = anotarTarea(pr, sesion.cuentoId, {
      ok: !!info.primera,
      palabra: t?.tipo === "palabra" ? t.palabra : null,
    }, hoy());
  } else if (sesion.modo === "reto" && info.ok && !info.cruce) {
    sesion.aciertos += 1;
  }
  sesion.i += 1;
  if (sesion.modo === "cuento") {
    const cuento = cuentoActual();
    if (sesion.i >= sesion.tareas.length) {
      const graded = tareasCalificables(sesion.tareas).length;
      const esUltimo = sesion.cap >= (cuento?.capitulos?.length || 1) - 1;
      const r = cerrarCapitulo(pr, sesion.cuentoId, sesion.aciertos, graded, esUltimo);
      pr = r.pr;
      sesion.estrellas = r.estrellas;
      sesion.cerrado = true;
      Noli.terminar({ estrellas: r.estrellas });
    } else {
      pr = guardarCurso(pr, sesion.cuentoId, {
        cap: sesion.cap, i: sesion.i, tareas: sesion.tareas, come: sesion.come, aciertosCap: sesion.aciertos,
      });
    }
  }
  Noli.guardar(pr);
  if (info.ok && !info.cruce) bien();
  callar();
  lecToken += 1;
  pintarFeedback();
}

function pintarFeedback() {
  const f = sesion?.feedback || {};
  const espanol = f.espanol
    ? `<button type="button" class="boton" data-act="espanol" tabindex="0" data-foco data-foco-id="espanol">${svg("boton-en-espanol.svg")}<span>${esc(TEXTOS.enEspanol)}</span></button>`
    : "";
  capas(`
    ${htmlCab(tituloJuego())}
    <p class="pista">${esc(f.texto || "")}</p>
    <div class="dibujo grande">${f.dibujo ? svg(f.dibujo) : ""}</div>
    <div class="acciones">
      ${espanol}
      <button type="button" class="boton grande primario" data-act="seguir" tabindex="0" data-foco="inicial" data-foco-id="seguir">${esc(TEXTOS.seguir)}</button>
    </div>
  `, "feedback", "seguir", true);
}

function seguirPantalla() {
  if (pantalla === "feedback") {
    if (sesion?.modo === "reto" && sesion.i >= sesion.tareas.length) return pintarFinReto();
    if (sesion?.cerrado) return pintarFin();
    return entrarTarea(true);
  }
  if (pantalla === "fin" || pantalla === "finreto") return pintarLibrero();
  if (pantalla === "releer") return avanzarReleer();
}

function pintarFin() {
  const c = cuentoActual();
  const e = c ? cuentoDe(pr, c.id) : null;
  capas(`
    ${htmlCab(c?.titulo || TEXTOS.titulo)}
    <p class="pista">${esc(TEXTOS.finCap)}</p>
    ${estrellasHtml(sesion?.estrellas || 0)}
    ${e && dominio(pr, c.id).listo ? `<p class="aviso">${esc(TEXTOS.domina)}</p>` : ""}
    <div class="acciones columna">
      <button type="button" class="boton grande primario" data-act="seguir" tabindex="0" data-foco="inicial" data-foco-id="seguir">${esc(TEXTOS.seguir)}</button>
      <button type="button" class="boton grande" data-act="releer" data-id="${esc(c?.id || "")}" tabindex="0" data-foco data-foco-id="releer">${esc(TEXTOS.oirCuento)}</button>
    </div>
  `, "fin", "seguir", true);
}

function pintarFinReto() {
  if (!sesion.retoCerrado) {
    const ok = (sesion?.aciertos || 0) >= (sesion?.reto?.necesita || 3);
    const ya = !!pr.retos[hoy()]?.cumplido;
    const nuevo = ok && !ya;
    pr = cumplirReto(pr, hoy(), sesion?.reto?.tipo || "palabra", sesion?.aciertos || 0, ok);
    Noli.guardar(pr);
    if (nuevo) Noli.terminar({ estrellas: 3, reto: true });
    else Noli.terminar({ estrellas: estrellasTurnoDesde(sesion?.aciertos || 0, sesion?.tareas?.length || 4) });
    sesion.retoCerrado = true;
  }
  const ok = (sesion?.aciertos || 0) >= (sesion?.reto?.necesita || 3);
  capas(`
    ${htmlCab(TEXTOS.reto)}
    <p class="pista">${esc(ok ? TEXTOS.retoOk : TEXTOS.retoNo)}</p>
    ${estrellasHtml(ok ? 3 : 1)}
    <p class="avance">${sesion.aciertos} ${esc(TEXTOS.de)} ${sesion.reto?.necesita || 3}</p>
    <div class="acciones">
      <button type="button" class="boton grande primario" data-act="seguir" tabindex="0" data-foco="inicial" data-foco-id="seguir">${esc(TEXTOS.seguir)}</button>
    </div>
  `, "finreto", "seguir", true);
}

function estrellasTurnoDesde(aciertos, de) {
  if (de <= 0) return 0;
  if (aciertos >= de) return 3;
  if (aciertos >= de * 0.8) return 2;
  if (aciertos >= de * 0.5) return 1;
  return 0;
}

function abrirReleer(id) {
  if (!id || !desbloqueado(cuentos, pr, id)) return;
  sesion = { modo: "leer", cuentoId: id, releer: 0, tareas: [], i: 0 };
  pintarReleer(true);
}

function pintarReleer(hablar) {
  const c = cuentoActual();
  const p = c?.paginas?.[sesion.releer];
  if (!p) return pintarLibrero();
  const lineas = (p.oraciones || []).map((o, i) => `<p class="linea">${palabrasHtml(o, { foco: true, frase: i })}</p>`).join("");
  const anterior = sesion.releer > 0
    ? `<button type="button" class="boton" data-act="anterior" tabindex="0" data-foco data-foco-id="anterior">${svg("boton-pagina-anterior.svg")}<span>${esc(TEXTOS.anterior)}</span></button>`
    : "";
  capas(`
    ${htmlCab(c.titulo)}
    <div class="pagina-leer">
      <div class="dibujo grande">${svg(p.escena)}</div>
      <div class="zona-texto">${lineas}</div>
    </div>
    <div class="acciones">
      ${anterior}
      <button type="button" class="boton grande primario" data-act="seguir" tabindex="0" data-foco="inicial" data-foco-id="seguir">${esc(TEXTOS.seguir)}</button>
    </div>
  `, "releer", "seguir", true);
  if (hablar && !leeSolo(pr, c.id)) leerFrases(p.oraciones || [], 0);
}

function paginaAnterior() {
  if (pantalla !== "releer" || !sesion || sesion.releer <= 0) return;
  sesion.releer -= 1;
  pintarReleer(true);
}

function avanzarReleer() {
  const c = cuentoActual();
  if (!c) return pintarLibrero();
  if (sesion.releer + 1 < c.paginas.length) {
    sesion.releer += 1;
    pintarReleer(true);
    return;
  }
  pintarLibrero();
}

function abrirAyuda(clave) {
  if (!clave) return;
  ayuda = clave;
  callar();
  lecToken += 1;
  const dato = glosario[clave] || { es: clave };
  decirGrabacion(`audio/w/${clave}.mp3`, { respaldo: clave });
  decirEs(dato.es);
  pintar(true);
}

// ---------- Arranque ----------

function pulsar() {
  if (!cargado || dialogo) return;
  const ahora = Date.now();
  if (pantalla === "guia" && guia && debeAutoAvanzar(guia, ahora)) {
    const antes = guia.paso;
    guia = reducirGuia(guia, { tipo: "toque", ahora });
    if (guia.paso !== antes || guia.fin) trasGuia(true);
  }
  if (pantalla === "jugar" && sesion?.item && !sesion.feedback) {
    const fase = faseDeAhora();
    if (fase !== faseVista) {
      faseVista = fase;
      marcarCompleta();
      pintarJugar(false);
    }
  }
}

Noli.datos.then((datos) => {
  pr = cargar(datos);
  const json = (ruta) => fetch(archivo(ruta)).then((r) => {
    if (!r.ok) throw new Error(ruta);
    return r.json();
  });
  return json("../datos/indice.json").then((indice) => Promise.all([
    json("../datos/glosario.json"),
    Promise.all((indice.orden || []).map((id) => json(`../datos/cuentos/${id}.json`))),
    json("../datos/arte.json"),
  ])).then(([glo, lista, artes]) => {
    glosario = glo || {};
    cuentos = lista || [];
    return Promise.all((artes || []).map((ruta) => fetch(archivo(`../arte/${ruta}`))
      .then((r) => r.text())
      .then((t) => { cache[ruta] = t; })
      .catch(() => { cache[ruta] = ""; })));
  });
}).then(() => {
  cargado = true;
  if (!pr.guia) abrirGuia();
  else pintarLibrero();
  pulso = setInterval(pulsar, 100);
}).catch(() => {
  if ($main) $main.textContent = TEXTOS.titulo;
});
