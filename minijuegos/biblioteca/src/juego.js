// Biblioteca (#104): libros en inglés con voz, y la palabra que suena se ilumina.
// Pantallas: el estante (portada y capítulos) y el lector (una página a la vez).
// La voz son grabaciones (libros/<id>/audio/, Piper en_US-ljspeech; herramientas/libro.py) con el tiempo de
// cada palabra en libro.json. Con la pantalla en "Léemelo" narra y pasa de página sola; en "Yo leo" no habla
// hasta que se toca ▶ o una palabra (que dice solo esa palabra).
import { Noli, moverFoco } from "../../../kit/noli.js";
import {
  progresoDe, conProgreso, abierto, capitulo, mover, dondeSeguir, palabrasConTiempo, palabraEn, marcarLeido, premiosPendientes,
} from "./libro.js";

const LIBRO = "halloween";
const BASE = new URL(`../libros/${LIBRO}/`, import.meta.url);
const $ = (s, r = document) => r.querySelector(s);
const $juego = document.getElementById("juego");
const esTv = () => document.documentElement.dataset.modo === "tv" || Noli.modo === "tv";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Íconos en SVG (sin emojis: la TV LG los pinta en blanco y negro, #5)
const I = {
  play: '<path d="M8 5v14l11-7z"/>',
  pausa: '<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>',
  atras: '<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  adelante: '<path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  libros: '<path d="M4 4h4v16H4zM10 4h4v16h-4zM16.5 4.6l3.6-1 3.9 15.4-3.6 1z"/>',
  candado: '<path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/>',
  tortuga: '<path d="M3 15.5c0-4.4 3.6-8 8-8s8 3.6 8 8z"/><circle cx="20.6" cy="13.6" r="2.4"/><path d="M5 16.5h3.2v2.6H5zM13.8 16.5H17v2.6h-3.2z"/>',
  palomita: '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
};
const icono = (n, extra = "") => `<svg viewBox="0 0 24 24" aria-hidden="true" class="ico ${extra}" fill="currentColor">${I[n]}</svg>`;

let libro = null, datos = null, pr = null;
let pos = null;          // { c, p } en el lector; null en el estante
let audio = null, palabras = [], encendida = -1, raf = 0;
let soloPalabra = null;  // { fin } cuando suena una palabra tocada
let sonando = false, sinVoz = false;
let terminados = new Set();

const guardar = () => { datos = conProgreso(datos, LIBRO, pr); Noli.guardar(datos); };
const img = (id, chica) => new URL(`arte/web/${id}-${chica ? "c" : "g"}.jpg`, BASE).href;

// ---------- Estante ----------

function estante() {
  detener();
  pos = null;
  const sigue = dondeSeguir(libro, pr);
  const tarjetas = libro.capitulos.map((c) => {
    const ok = abierto(libro, pr, c.n);
    const leido = pr.leidos.includes(c.n);
    return `<button class="cap${ok ? "" : " cerrado"}${leido ? " leido" : ""}" data-foco data-cap="${c.n}" ${ok ? "" : 'aria-disabled="true"'}>
      <span class="num">${c.n}</span>
      <span class="tit">${ok ? esc(c.titulo) : "Find it in the world!"}</span>
      ${ok ? (leido ? icono("palomita", "marca") : "") : icono("candado", "marca")}
    </button>`;
  }).join("");
  const portada = libro.portada ? `<img class="portada-img" src="${img(libro.portada, !esTv())}" alt="">` : "";
  $juego.innerHTML = `
    <section class="estante">
      <div class="portada">${portada}
        <div class="portada-texto">
          <h1>${esc(libro.titulo)}</h1>
          <p>${esc(libro.subtitulo || "")}</p>
          ${sigue ? `<button class="grande principal" data-foco="inicial" id="seguir">${icono("play")}
            ${pr.pos ? `Seguir leyendo · cap. ${sigue.c}` : "Empezar a leer"}</button>` : '<p class="busca">Busca el Capítulo 1: está escondido en el mundo de Noli.</p>'}
        </div>
      </div>
      <h2>Capítulos <span class="cuenta">${pr.leidos.length} de ${libro.capitulos.length} leídos</span></h2>
      <div class="caps">${tarjetas}</div>
      ${libro.capitulos.some((c) => !abierto(libro, pr, c.n)) ? `<p class="papas"><button class="chico" data-foco id="todos">Papás: abrir todos los capítulos</button></p>` : ""}
    </section>`;
  const b = $("#seguir");
  if (b) b.onclick = () => abrir(sigue);
  const t = $("#todos");
  if (t) t.onclick = () => {
    if (!t.dataset.seguro) { t.dataset.seguro = "1"; t.textContent = "¿Seguro? Toca otra vez para abrirlos"; return; }
    pr.todos = true; guardar(); estante();
  };
  $juego.querySelectorAll(".cap").forEach((el) => {
    el.onclick = () => {
      const n = +el.dataset.cap;
      if (!abierto(libro, pr, n)) { aviso("Encuentra este capítulo escondido en el mundo de Noli."); return; }
      abrir({ c: n, p: pr.pos && pr.pos.c === n && !pr.leidos.includes(n) ? pr.pos.p : 0 });
    };
  });
  const f = $juego.querySelector('[data-foco="inicial"]') || $juego.querySelector("[data-foco]");
  if (f && esTv()) f.focus({ preventScroll: true });
}

function aviso(texto) {
  let a = $(".aviso");
  if (!a) { a = document.createElement("p"); a.className = "aviso"; a.setAttribute("role", "status"); document.body.appendChild(a); }
  a.textContent = texto; a.classList.add("ver");
  clearTimeout(aviso.t); aviso.t = setTimeout(() => a.classList.remove("ver"), 2600);
}

// ---------- Lector ----------

function abrir(p) {
  pos = p;
  pr.pos = p;
  const guia = !pr.guia;
  pr.guia = true; guardar();
  dibujarPagina();
  if (guia) aviso(esTv() ? "OK escucha · flechas para cambiar de página" : "Toca Escuchar, o toca una palabra para oírla");
  if (pr.modo === "leeme") reproducir();
}

function textoPagina(pag) {
  let o = 0;
  return pag.parrafos.map((par) => `<p>${par.map((or) => {
    const i = o++;
    return `<span class="o" data-o="${i}">${or.palabras.map((w, k) =>
      `<span class="w${w.em ? " em" : ""}" data-o="${i}" data-w="${k}">${esc(w.w)}</span>`).join(" ")}</span>`;
  }).join(" ")}</p>`).join("");
}

function dibujarPagina() {
  detener();
  const c = capitulo(libro, pos.c), pag = c.paginas[pos.p];
  palabras = palabrasConTiempo(pag); encendida = -1;
  const primera = pos.p === 0;
  const fig = pag.ilustracion
    ? `<figure class="ilus"><img src="${img(pag.ilustracion, !esTv())}" alt=""></figure>`
    : `<figure class="ilus vacia" aria-hidden="true">${adorno(pos.c * 31 + pos.p)}</figure>`;
  $juego.innerHTML = `
    <section class="lector${pag.ilustracion ? " con-ilus" : " sin-ilus"}">
      <header class="barra">
        <button class="redondo" data-foco id="volver" aria-label="Capítulos">${icono("libros")}</button>
        <div class="donde"><strong>Chapter ${c.n}</strong><span>${pos.p + 1} / ${c.paginas.length}</span></div>
        <div class="modos" role="group" aria-label="Cómo leer">
          <button data-foco data-modo="leeme" class="${pr.modo === "leeme" ? "activo" : ""}">Léemelo</button>
          <button data-foco data-modo="yo" class="${pr.modo === "yo" ? "activo" : ""}">Yo leo</button>
        </div>
      </header>
      <div class="hoja">
        ${fig}
        <div class="texto" lang="en">
          ${primera ? `<h1 class="titulo-cap"><span>Chapter ${c.n}</span>${esc(c.titulo)}</h1>` : ""}
          ${textoPagina(pag)}
        </div>
      </div>
      <nav class="controles">
        <button class="redondo" data-foco id="ant" aria-label="Página anterior" ${pos.p === 0 ? "disabled" : ""}>${icono("atras")}</button>
        <button class="grande principal" data-foco="inicial" id="escuchar">${icono(sonando ? "pausa" : "play")}<span>Escuchar</span></button>
        <button class="redondo${pr.despacio ? " activo" : ""}" data-foco id="despacio" aria-pressed="${pr.despacio}" aria-label="Despacio">${icono("tortuga")}</button>
        <button class="redondo" data-foco id="sig" aria-label="Página siguiente">${icono("adelante")}</button>
      </nav>
      ${sinVoz ? '<p class="nota">No se pudo oír la voz. Puedes leer sola y tocar las palabras.</p>' : ""}
    </section>`;
  $("#volver").onclick = estante;
  $("#ant").onclick = () => pagina(-1);
  $("#sig").onclick = () => pagina(1);
  $("#escuchar").onclick = alternar;
  $("#despacio").onclick = () => {
    pr.despacio = !pr.despacio; guardar();
    if (audio) audio.playbackRate = pr.despacio ? 0.8 : 1;
    $("#despacio").classList.toggle("activo", pr.despacio);
    $("#despacio").setAttribute("aria-pressed", pr.despacio);
  };
  $juego.querySelectorAll("[data-modo]").forEach((b) => (b.onclick = () => {
    pr.modo = b.dataset.modo; guardar();
    $juego.querySelectorAll("[data-modo]").forEach((x) => x.classList.toggle("activo", x === b));
    if (pr.modo === "leeme" && !sonando) reproducir();
  }));
  $juego.querySelector(".texto").addEventListener("click", (e) => {
    const w = e.target.closest(".w");
    if (w) decirPalabra(+w.dataset.o, +w.dataset.w);
  });
  // Precargar lo siguiente
  const sig = mover(libro, pos, 1);
  if (sig) {
    const ps = capitulo(libro, sig.c).paginas[sig.p];
    if (ps.ilustracion) new Image().src = img(ps.ilustracion, !esTv());
  }
  if (esTv()) $("#escuchar").focus({ preventScroll: true });
}

// Adorno de las páginas sin ilustración: estrellas y una calabacita, distinto en cada página.
function adorno(semilla) {
  let s = semilla || 1;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const estrellas = Array.from({ length: 22 }, () =>
    `<circle cx="${(r() * 640).toFixed(0)}" cy="${(8 + r() * 70).toFixed(0)}" r="${(1 + r() * 2).toFixed(1)}"/>`).join("");
  const x = 120 + r() * 400;
  return `<svg viewBox="0 0 640 110" preserveAspectRatio="xMidYMid meet">
    <g class="estrellas">${estrellas}</g>
    <circle class="luna" cx="${(x > 320 ? 110 : 530)}" cy="34" r="16"/>
    <g transform="translate(${x.toFixed(0)} 88)" class="calabaza">
      <ellipse rx="20" ry="15"/><ellipse rx="9" ry="15" class="gajo"/><rect x="-2.5" y="-22" width="5" height="9" rx="2" class="tallo"/>
    </g>
    <path class="piso" d="M0 104 Q160 94 320 102 T640 100 V110 H0z"/>
  </svg>`;
}

function pagina(paso) {
  const n = mover(libro, pos, paso);
  if (n) { pos = n; pr.pos = n; guardar(); dibujarPagina(); if (pr.modo === "leeme" && paso > 0) reproducir(); return; }
  if (paso > 0) finCapitulo();
}

function finCapitulo() {
  detener();
  const n = pos.c;
  pr.leidos = marcarLeido(pr, n);
  const sig = capitulo(libro, n + 1);
  pr.pos = sig && abierto(libro, pr, n + 1) ? { c: n + 1, p: 0 } : pr.pos;
  guardar();
  if (!terminados.has(n)) { terminados.add(n); Noli.terminar({ estrellas: 3 }); }
  cobrar();
  const ultimo = !sig;
  const siguienteAbierto = sig && abierto(libro, pr, n + 1);
  $juego.innerHTML = `
    <section class="fin">
      <p class="sello">${icono("palomita")}</p>
      <h1>${ultimo ? "The End" : `The End of Chapter ${n}`}</h1>
      <p>${ultimo ? "¡Leíste todo el libro!" : siguienteAbierto ? `Sigue: <em lang="en">${esc(sig.titulo)}</em>` :
        `<span lang="en">Find Chapter ${n + 1} in the world!</span><br>Búscalo escondido en el mundo de Noli.`}</p>
      <div class="botones">
        ${siguienteAbierto ? `<button class="grande principal" data-foco="inicial" id="siguiente">${icono("play")}Capítulo ${n + 1}</button>` : ""}
        <button class="grande" data-foco ${siguienteAbierto ? "" : 'data-foco="inicial"'} id="estante">${icono("libros")}Capítulos</button>
      </div>
    </section>`;
  const b = $("#siguiente");
  if (b) b.onclick = () => abrir({ c: n + 1, p: 0 });
  $("#estante").onclick = estante;
  const f = $juego.querySelector('[data-foco="inicial"]');
  if (f) f.focus({ preventScroll: true });
}

// ---------- Voz ----------

function el() {
  if (!audio) {
    audio = new Audio();
    audio.preload = "auto";
    audio.addEventListener("ended", alTerminar);
    audio.addEventListener("error", () => { if (sonando || soloPalabra) falloVoz(); });
  }
  return audio;
}

function cargar() {
  const pag = capitulo(libro, pos.c).paginas[pos.p];
  if (!pag.audio) return false;
  const a = el(), url = new URL(pag.audio, BASE).href;
  if (a.src !== url) a.src = url;
  a.playbackRate = pr.despacio ? 0.8 : 1;
  return true;
}

function reproducir(desde) {
  if (!pos || !cargar()) { falloVoz(); return; }
  soloPalabra = null;
  if (typeof desde === "number") audio.currentTime = desde;
  const p = audio.play();
  sonando = true; boton(); seguir();
  if (p && p.catch) p.catch(() => { sonando = false; boton(); });
}

function alternar() {
  if (sonando && !soloPalabra) { audio.pause(); sonando = false; boton(); return; }
  reproducir(audio && audio.ended ? 0 : undefined);
}

function decirPalabra(o, w) {
  const x = palabras.find((p) => p.o === o && p.w === w);
  if (!x || !cargar()) return;
  audio.pause();
  audio.currentTime = Math.max(0, x.t0 - 0.03);
  soloPalabra = { fin: x.t1 + 0.05 };
  sonando = false; boton();
  const p = audio.play();
  if (p && p.catch) p.catch(() => { soloPalabra = null; });
  seguir();
}

function alTerminar() {
  sonando = false; boton(); apagar();
  if (soloPalabra) { soloPalabra = null; return; }
  if (pr.modo === "leeme") setTimeout(() => { if (pos && !sonando && !soloPalabra) pagina(1); }, 900);
}

function falloVoz() {
  sonando = false; soloPalabra = null; sinVoz = true; boton();
  if (pos && !$(".nota")) {
    const n = document.createElement("p"); n.className = "nota";
    n.textContent = "No se pudo oír la voz. Puedes leer sola y tocar las palabras.";
    const l = $(".lector");
    if (l) l.appendChild(n);
  }
}

function boton() {
  const b = $("#escuchar");
  if (b) b.querySelector("svg").outerHTML = icono(sonando ? "pausa" : "play");
}

function seguir() {
  cancelAnimationFrame(raf);
  const paso = () => {
    if (!audio || !pos) return;
    const t = audio.currentTime;
    if (soloPalabra && t >= soloPalabra.fin) { audio.pause(); soloPalabra = null; apagar(); return; }
    encender(palabraEn(palabras, t));
    if (!audio.paused) raf = requestAnimationFrame(paso);
  };
  raf = requestAnimationFrame(paso);
}

function encender(i) {
  if (i === encendida) return;
  const t = $juego.querySelector(".texto");
  if (!t) return;
  t.querySelectorAll(".suena, .actual").forEach((e) => e.classList.remove("suena", "actual"));
  encendida = i;
  if (i < 0) return;
  const x = palabras[i];
  const w = t.querySelector(`.w[data-o="${x.o}"][data-w="${x.w}"]`);
  if (w) {
    w.classList.add("suena");
    const o = t.querySelector(`.o[data-o="${x.o}"]`);
    if (o && !soloPalabra) o.classList.add("actual");
    // Que la palabra que suena siempre se vea (en el teléfono el texto puede ser más alto que la pantalla)
    const caja = t.getBoundingClientRect(), r = w.getBoundingClientRect();
    if (r.bottom > caja.bottom - 8 || r.top < caja.top + 8) t.scrollTop += r.top - caja.top - caja.height / 3;
  }
}

function apagar() { encender(-1); }

function detener() {
  cancelAnimationFrame(raf);
  if (audio) audio.pause();
  sonando = false; soloPalabra = null;
}

// ---------- Control (flechas, OK, Atrás) ----------

Noli.alEntrar((accion) => {
  if (!libro) return;
  if (pos && $(".lector")) {
    const enfocado = document.activeElement && document.activeElement.closest(".lector");
    if (accion === "atras") { estante(); return true; }
    if (!enfocado || document.activeElement.id === "escuchar") {
      if (accion === "izquierda") { pagina(-1); return true; }
      if (accion === "derecha") { pagina(1); return true; }
    }
    if (moverFoco(accion, $juego)) return true;
    if (accion === "ok") { (document.activeElement && document.activeElement.closest("button") ? document.activeElement : $("#escuchar")).click(); return true; }
    return true;
  }
  if (accion === "atras" && $(".fin")) { estante(); return true; }
  if (moverFoco(accion, $juego)) return true;
  if (accion === "ok" && document.activeElement && document.activeElement.tagName === "BUTTON") { document.activeElement.click(); return true; }
  return false;
});

// Monedas (juego.json → premios): 5 por capítulo leído y 50 al terminar el libro, cada uno una sola vez.
// También cobra lo que se leyó antes de que hubiera premios.
function cobrar() {
  const pend = premiosPendientes(libro, pr, LIBRO);
  if (!pend.length) return;
  for (const x of pend) Noli.premiar(x.premio, x.clave);
  pr.pagados = [...pr.pagados, ...pend.map((x) => x.clave)];
  guardar();
}

// ---------- Arranque ----------

Promise.all([Noli.datos, fetch(new URL("libro.json", BASE)).then((r) => r.json())]).then(([d, l]) => {
  libro = l; datos = d; pr = progresoDe(d, LIBRO);
  cobrar();
  document.title = "Biblioteca";
  const m = /^#c(\d+)$/.exec(location.hash || "");
  const n = m ? +m[1] : 0;
  if (n && abierto(libro, pr, n)) abrir({ c: n, p: pr.pos && pr.pos.c === n ? pr.pos.p : 0 });
  else estante();
}).catch(() => {
  $juego.innerHTML = '<p class="cargando">No se pudo abrir el libro. Revisa el internet y vuelve a entrar.</p>';
});

