// Cajas Sorpresa (#59): pantallas. La lógica está en cajas.js y los dibujos en dibujos.js.
// Se juega con el dedo o con flechas, OK y Atrás. Sin await al nivel del módulo (algunas TVs no lo soportan).
import { Noli, moverFoco, focoInicial } from "../../../kit/noli.js";
import { rngConSemilla } from "./rng.js";
import {
  cargar, abrir, canjear, puedeAbrir, faltanRara, faltanUltra, quedanHoy, limiteDe, cambiarLimite,
  completa, cuantasTiene, tiene, deCada, precioPolvo, fechaLocal, RAREZAS,
} from "./cajas.js";
import { RAREZA, estrellasRareza, imagenPieza, huecoPieza, CAJA, cajita, CREDITO, POLVO, LUNA } from "./dibujos.js";

const $main = document.getElementById("juego");
try { if (/[?&]modo=tv\b/.test(location.search)) document.documentElement.dataset.modo = "tv"; } catch { /* sin location */ }

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const esTv = () => document.documentElement.dataset.modo === "tv" || Noli.modo === "tv";
const sinMovimiento = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
const hoy = () => fechaLocal();

let cfg = null;
let piezas = [];
let e = cargar(null);
let saldo = null;
let pantalla = "cargando";
let ultimo = null;       // { pieza, nueva, polvo, conPolvo }
let detalle = null;      // id de la pieza que se está viendo en la vitrina
let pasoGuia = 0;
let pregunta = null;     // multiplicación de Para papás
let papasAbierto = false;
let ocupado = false;

const PLURAL = { comun: "comunes", rara: "raras", ultra: "ultra raras" };
let nota = "";         // aviso de una sola vez en la tienda (no se pudo cobrar)
const porId = (id) => piezas.find((p) => p.id === id);
const guardar = () => Noli.guardar(e);

// Semilla: ?semilla=N la fija (para probar); si no, una nueva por caja
function nuevoRng() {
  try {
    const m = /[?&]semilla=(\d+)/.exec(location.search);
    if (m) return rngConSemilla(Number(m[1]) + e.abiertas);
  } catch { /* sin location */ }
  let s = (Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0;
  try { s = crypto.getRandomValues(new Uint32Array(1))[0]; } catch { /* sin crypto */ }
  return rngConSemilla(s);
}

// ——— Piezas de interfaz ———

const contador = (icono, n, texto) => `<span class="pastilla" role="img" aria-label="${n} ${texto}">${icono}<b>${n}</b></span>`;
const cabecera = () => `<header class="cabecera">
  ${saldo === null ? "" : contador(CREDITO, saldo, saldo === 1 ? "crédito" : "créditos")}
  ${contador(POLVO, e.polvo, "de polvo de estrellas")}
</header>`;

function marco(p, contenido, extra = "") {
  return `<div class="marco marco-${p.rareza} ${extra}" style="--rareza:${RAREZA[p.rareza].color}">${contenido}</div>`;
}

function textoCajasHoy() {
  const l = limiteDe(e, cfg), q = quedanHoy(e, cfg, hoy());
  if (l === 0) return "";
  const puntos = Array.from({ length: l }, (_, i) => `<i class="${i < l - q ? "usada" : ""}"></i>`).join("");
  return `<p class="hoy"><span class="puntos" aria-hidden="true">${puntos}</span>${q === 1 ? "Te queda 1 caja hoy" : q > 1 ? `Te quedan ${q} cajas hoy` : "Ya abriste tus cajas de hoy"}</p>`;
}

function garantias() {
  const fila = (r, n) => `<div class="garantia">${estrellasRareza(r)}<span>Tu ${RAREZA[r].nombre} llega en <b>${n}</b> ${n === 1 ? "caja" : "cajas"} o menos</span></div>`;
  return `<section class="garantias" aria-label="Garantías">${fila("rara", faltanRara(e, cfg))}${fila("ultra", faltanUltra(e, cfg))}</section>`;
}

// Por qué no se puede abrir, en palabras amables (nunca como castigo)
function aviso(motivo, faltan) {
  switch (motivo) {
    case "limite": return `<div class="aviso">${LUNA}<p>La tienda está descansando hoy. <b>¡Vuelve mañana</b> por más cajas!</p></div>`;
    case "cerrada": return `<div class="aviso">${LUNA}<p>La tienda está descansando. Pronto vuelve a abrir.</p></div>`;
    case "completa": return `<div class="aviso feliz">${POLVO}<p><b>¡Tienes los ${piezas.length} Brumitos!</b> Tu colección está completa.</p></div>`;
    case "creditos": return `<div class="aviso">${CREDITO}<p>Te ${faltan === 1 ? "falta 1 crédito" : `faltan ${faltan} créditos`}. Gánalos jugando en Noli.</p></div>`;
    default: return "";
  }
}

// ——— Pantallas ———

function pintar(html, nombre) {
  pantalla = nombre;
  $main.innerHTML = html;
  $main.scrollTop = 0;
  try { window.scrollTo(0, 0); } catch { /* sin window */ }
  if (esTv() || document.documentElement.classList.contains("teclado")) focoInicial($main);
}

function tienda() {
  const puede = puedeAbrir(e, cfg, piezas, hoy(), saldo);
  const accion = puede.ok
    ? `<button type="button" class="boton principal" data-foco="inicial" data-act="abrir">Abrir caja <span class="precio">${CREDITO}${cfg.costo}</span></button>`
    : aviso(puede.motivo, puede.faltan);
  const n1 = nota; nota = "";
  pintar(`${cabecera()}
<div class="tienda">
  <div class="escaparate">
    <h1 class="titulo">Cajas Sorpresa</h1>
    <button type="button" class="caja-boton" data-act="${puede.ok ? "abrir" : "vitrina"}" aria-label="${puede.ok ? "Abrir caja" : "Ver la vitrina"}" tabindex="-1">${CAJA}</button>
    ${accion}
    ${n1 ? `<p class="faltan" role="status">${n1}</p>` : ""}
    ${puede.motivo === "cerrada" || puede.motivo === "completa" ? "" : textoCajasHoy()}
  </div>
  <div class="lado">
    ${puede.motivo === "completa" ? "" : garantias()}
    <div class="menu">
      <button type="button" class="boton" data-foco${puede.ok ? "" : '="inicial"'} data-act="vitrina">Vitrina <span class="cuenta">${cuantasTiene(e, piezas)} de ${piezas.length}</span></button>
      <button type="button" class="boton" data-foco data-act="que">¿Qué trae?</button>
    </div>
    <button type="button" class="enlace" data-foco data-act="papas">Para papás</button>
  </div>
</div>`, "tienda");
}

function queTrae() {
  const fila = (r, p) => {
    const { n, de } = deCada(p);
    const cajitas = Array.from({ length: de }, (_, i) => cajita(RAREZA[r].color, i < n)).join("");
    return `<div class="fila-prob" style="--rareza:${RAREZA[r].color}">
      <div class="cajitas cajitas-${de}" aria-hidden="true">${cajitas}</div>
      <p>Más o menos <b>${n} de cada ${de}</b> ${n === 1 ? `es ${RAREZA[r].nombre}` : `son ${PLURAL[r]}`} ${estrellasRareza(r, "estrellas chica")}</p>
    </div>`;
  };
  pintar(`${cabecera()}
<h1 class="titulo">¿Qué trae una caja?</h1>
<p class="sub">Cada caja trae un Brumito.</p>
<section class="probs">${RAREZAS.map((r) => fila(r, cfg.probabilidad[r])).join("")}</section>
<ul class="reglas">
  <li>${CAJA.replace('class="caja"', 'class="mini"')}<span>En tus primeras <b>${cfg.sinRepetir} cajas</b> no se repite ninguno.</span></li>
  <li>${POLVO}<span>Si te sale uno repetido, se vuelve <b>polvo de estrellas</b>. Con polvo escoges en la vitrina el que te falta.</span></li>
  <li>${estrellasRareza("rara", "estrellas chica")}<span>Tu rara llega en ${cfg.garantia.rara} cajas o menos, y tu ultra rara en ${cfg.garantia.ultra} o menos.</span></li>
</ul>
<div class="menu fila"><button type="button" class="boton principal" data-foco="inicial" data-act="tienda">Entendido</button></div>`, "que");
}

function tarjeta(p) {
  const la = tiene(e, p.id);
  const img = la ? imagenPieza(p, false, "mini-pieza") : huecoPieza(p, "mini-pieza");
  return `<button type="button" class="tarjeta ${la ? "tiene" : "falta"} brillo-${p.rareza}" data-foco data-act="ver" data-id="${p.id}" style="--rareza:${RAREZA[p.rareza].color}">
    <span class="foto">${img}</span>
    <span class="nombre">${esc(p.nombre)}</span>
    ${estrellasRareza(p.rareza, "estrellas chica")}
  </button>`;
}

function vitrina() {
  const n = cuantasTiene(e, piezas);
  pintar(`${cabecera()}
<h1 class="titulo">Vitrina <span class="cuenta">${n} de ${piezas.length}</span></h1>
<p class="sub">${n === piezas.length ? "¡Los tienes todos!" : "Toca uno que te falte para escogerlo con polvo de estrellas."}</p>
<section class="rejilla">${piezas.map(tarjeta).join("")}</section>
<div class="menu fila"><button type="button" class="boton" data-foco data-act="tienda">Regresar a la tienda</button></div>`, "vitrina");
  if (detalle) {
    const b = $main.querySelector(`[data-id="${detalle}"]`);
    if (b) { b.focus({ preventScroll: false }); b.scrollIntoView({ block: "center" }); }
  }
}

function verPieza(id) {
  const p = porId(id);
  if (!p) return vitrina();
  detalle = id;
  const la = tiene(e, p.id);
  let pie;
  if (la) {
    const n = e.tengo[p.id];
    pie = `<p class="sub">${n > 1 ? `Te ha salido ${n} veces.` : "¡Es tuya!"}</p>`;
  } else {
    const precio = precioPolvo(cfg, p);
    const alcanza = e.polvo >= precio && !e.cerrada;
    pie = `<p class="sub">Escógela con polvo de estrellas: cuesta ${POLVO}<b>${precio}</b>. Tienes ${POLVO}<b>${e.polvo}</b>.</p>
      ${e.cerrada ? aviso("cerrada")
        : alcanza ? `<button type="button" class="boton principal" data-foco="inicial" data-act="canjear" data-id="${p.id}">Escoger con ${precio} de polvo</button>`
        : `<p class="faltan">Te faltan ${precio - e.polvo} de polvo. Los repetidos te dan polvo.</p>`}`;
  }
  pintar(`${cabecera()}
<section class="detalle">
  ${marco(p, la ? imagenPieza(p, true, "grande") : huecoPieza(p, "grande"), la ? "brilla" : "vacio")}
  <h1 class="titulo">${esc(p.nombre)}</h1>
  <p class="rareza">${estrellasRareza(p.rareza)} <span>${RAREZA[p.rareza].nombre}</span></p>
  ${pie}
  <div class="menu fila"><button type="button" class="boton" data-foco${la ? '="inicial"' : ""} data-act="vitrina">Regresar a la vitrina</button></div>
</section>`, "ver");
}

// ——— Abrir una caja ———

function precargar(p) {
  if (!p.imagen) return Promise.resolve();
  return new Promise((ok) => {
    const img = new Image();
    img.onload = img.onerror = () => ok();
    img.src = `arte/${p.id}-512.webp`;
    setTimeout(ok, 4000);
  });
}

function abriendo() {
  pintar(`${cabecera()}
<section class="abriendo" aria-live="polite">
  <div class="escena">${CAJA}</div>
  <p class="sub">Abriendo…</p>
</section>`, "abriendo");
}

function pedirCaja() {
  if (ocupado) return;
  const puede = puedeAbrir(e, cfg, piezas, hoy(), saldo);
  if (!puede.ok) return tienda();
  ocupado = true;
  abriendo();
  const espera = sinMovimiento() ? 0 : 900;
  const inicio = Date.now();
  Noli.gastar(cfg.costo, "cajas").then((r) => {
    if (typeof r.saldo === "number") saldo = r.saldo;
    if (!r.ok) {
      ocupado = false;
      nota = r.saldo === null ? "No se pudo cobrar la caja. Intenta otra vez." : "";
      tienda();
      return;
    }
    const { estado, resultado } = abrir(e, cfg, piezas, nuevoRng(), hoy(), new Date().toISOString());
    e = estado;
    guardar();
    ultimo = { ...resultado, conPolvo: false };
    // La imagen se carga mientras dura la animación de abrir
    precargar(resultado.pieza).then(() => {
      const falta = Math.max(0, espera - (Date.now() - inicio));
      setTimeout(() => {
        const $esc = $main.querySelector(".escena");
        if ($esc && !sinMovimiento()) $esc.classList.add("abre");
        setTimeout(() => { ocupado = false; revelar(); }, sinMovimiento() ? 0 : 650);
      }, falta);
    });
  });
}

function revelar() {
  const { pieza: p, nueva, polvo, conPolvo } = ultimo;
  const n = cuantasTiene(e, piezas);
  let msg;
  if (conPolvo) msg = `<p class="grande">¡La escogiste con polvo de estrellas!</p>`;
  else if (nueva) msg = `<p class="grande nueva">¡Nuevo Brumito!</p>`;
  else msg = `<p class="grande">Ya lo tenías: se volvió polvo de estrellas</p><p class="polvo-ganado">${POLVO}<b>+${polvo}</b></p>`;
  const puede = puedeAbrir(e, cfg, piezas, hoy(), saldo);
  const llena = completa(e, piezas);
  pintar(`${cabecera()}
<section class="revelar ${nueva || conPolvo ? "es-nueva" : ""}" aria-live="polite">
  ${marco(p, imagenPieza(p, true, "grande"), "brilla aparece")}
  <h1 class="titulo">${esc(p.nombre)}</h1>
  <p class="rareza">${estrellasRareza(p.rareza)} <span>${RAREZA[p.rareza].nombre}</span></p>
  ${msg}
  ${llena ? `<p class="grande nueva">¡Completaste la colección de ${piezas.length} Brumitos!</p>` : `<p class="sub">Vitrina: ${n} de ${piezas.length}</p>`}
  <div class="menu fila">
  ${!conPolvo && puede.ok ? `<button type="button" class="boton principal" data-foco="inicial" data-act="abrir">Otra caja <span class="precio">${CREDITO}${cfg.costo}</span></button>` : ""}
  <button type="button" class="boton${!conPolvo && puede.ok ? "" : " principal"}" data-foco${!conPolvo && puede.ok ? "" : '="inicial"'} data-act="vitrina">Ver la vitrina</button>
  <button type="button" class="boton" data-foco data-act="tienda">Listo</button>
  </div>
</section>`, "revelar");
  detalle = p.id;
}

function escoger(id) {
  const p = porId(id);
  if (!p) return;
  const r = canjear(e, cfg, p);
  if (!r.ok) return verPieza(id);
  e = r.estado;
  guardar();
  ultimo = { pieza: p, nueva: true, polvo: 0, conPolvo: true };
  revelar();
}

// ——— Guía de la primera vez ———

const GUIA = [
  { dibujo: () => CAJA, texto: () => `Con <b>${cfg.costo} créditos</b> abres una caja sorpresa.` },
  { dibujo: () => imagenPieza(piezas[0], false, "guia-pieza"), texto: () => `Adentro viene un <b>Brumito</b>. ¡Hay ${piezas.length} para juntar!` },
  { dibujo: () => POLVO, texto: () => `Si te sale uno repetido, se vuelve <b>polvo de estrellas</b>. Con polvo escoges el que te falta.` },
];

function guia() {
  const g = GUIA[pasoGuia];
  const ultimoPaso = pasoGuia === GUIA.length - 1;
  pintar(`<section class="guia" aria-live="polite">
  <div class="guia-dibujo">${g.dibujo()}</div>
  <p class="grande">${g.texto()}</p>
  <p class="pasos" aria-label="Paso ${pasoGuia + 1} de ${GUIA.length}">${GUIA.map((_, i) => `<i class="${i === pasoGuia ? "activo" : ""}"></i>`).join("")}</p>
  <div class="menu fila"><button type="button" class="boton principal" data-foco="inicial" data-act="guia">${ultimoPaso ? "¡A abrir cajas!" : "Siguiente"}</button></div>
</section>`, "guia");
}

function seguirGuia() {
  if (pasoGuia < GUIA.length - 1) { pasoGuia++; guia(); return; }
  e = { ...e, guia: true };
  guardar();
  tienda();
}

// ——— Para papás ———

function nuevaPregunta() {
  const a = 6 + Math.floor(Math.random() * 4), b = 6 + Math.floor(Math.random() * 4);
  const r = a * b;
  const ops = new Set([r]);
  while (ops.size < 3) {
    const o = r + [-a, a, -b, b, -1, 1, 10, -10][Math.floor(Math.random() * 8)];
    if (o > 0) ops.add(o);
  }
  return { a, b, r, ops: [...ops].sort(() => Math.random() - 0.5) };
}

function papasPuerta() {
  if (papasAbierto) return papas();
  pregunta = nuevaPregunta();
  pintar(`<h1 class="titulo">Para papás</h1>
<p class="sub">Contesta para entrar: ¿cuánto es <b>${pregunta.a} × ${pregunta.b}</b>?</p>
<div class="menu fila">${pregunta.ops.map((o, i) => `<button type="button" class="boton" data-foco${i === 0 ? '="inicial"' : ""} data-act="respuesta" data-n="${o}">${o}</button>`).join("")}</div>
<div class="menu fila"><button type="button" class="enlace" data-foco data-act="tienda">Regresar</button></div>`, "puerta");
}

function fechaCorta(iso) {
  const d = new Date(iso);
  if (!iso || isNaN(d)) return "—";
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getDate()}/${d.getMonth() + 1} ${z(d.getHours())}:${z(d.getMinutes())}`;
}

function papas() {
  papasAbierto = true;
  const l = limiteDe(e, cfg);
  const filas = [...e.historial].reverse().slice(0, 40).map((h) => {
    const p = porId(h.id);
    return `<tr><td>${fechaCorta(h.f)}</td><td>${esc(p ? p.nombre : h.id)}</td><td>${RAREZA[h.r] ? RAREZA[h.r].nombre : "—"}</td><td>${h.nueva ? "Nueva" : `Repetida (+${h.polvo} polvo)`}</td></tr>`;
  }).join("");
  pintar(`<h1 class="titulo">Para papás</h1>
<section class="papas">
  <div class="ajuste">
    <span>Cajas por día</span>
    <div class="numero">
      <button type="button" class="boton redondo" data-foco data-act="limite" data-d="-1" aria-label="Menos" ${l <= 0 ? "disabled" : ""}>−</button>
      <b>${l}</b>
      <button type="button" class="boton redondo" data-foco data-act="limite" data-d="1" aria-label="Más" ${l >= cfg.limiteMax ? "disabled" : ""}>+</button>
    </div>
  </div>
  <div class="ajuste">
    <span>La tienda está <b>${e.cerrada ? "cerrada" : "abierta"}</b></span>
    <button type="button" class="boton" data-foco="inicial" data-act="cerrar">${e.cerrada ? "Abrir la tienda" : "Cerrar la tienda"}</button>
  </div>
  <p class="datos">Cajas abiertas: <b>${e.abiertas}</b> · Colección: <b>${cuantasTiene(e, piezas)} de ${piezas.length}</b> · Polvo: <b>${e.polvo}</b> · Cuestan ${cfg.costo} créditos; nunca se usa dinero real.</p>
  <h2>Historial de cajas</h2>
  ${filas ? `<div class="tabla"><table><thead><tr><th>Cuándo</th><th>Brumito</th><th>Rareza</th><th>Resultado</th></tr></thead><tbody>${filas}</tbody></table></div>` : `<p class="sub">Todavía no abre ninguna caja.</p>`}
</section>
<div class="menu fila"><button type="button" class="boton" data-foco data-act="tienda">Regresar a la tienda</button></div>`, "papas");
}

// ——— Entrada ———

$main.addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-act]");
  if (!b || b.disabled || ocupado) return;
  switch (b.dataset.act) {
    case "abrir": pedirCaja(); break;
    case "tienda": detalle = null; tienda(); break;
    case "vitrina": vitrina(); break;
    case "que": queTrae(); break;
    case "ver": verPieza(b.dataset.id); break;
    case "canjear": escoger(b.dataset.id); break;
    case "guia": seguirGuia(); break;
    case "papas": papasPuerta(); break;
    case "respuesta": if (Number(b.dataset.n) === pregunta.r) papas(); else tienda(); break;
    case "limite": e = cambiarLimite(e, cfg, Number(b.dataset.d)); guardar(); papas(); focoEn(`[data-act="limite"][data-d="${b.dataset.d}"]`); break;
    case "cerrar": e = { ...e, cerrada: !e.cerrada }; guardar(); papas(); break;
  }
});

function focoEn(sel) {
  const el = $main.querySelector(sel);
  if (el && !el.disabled) el.focus();
}

Noli.alEntrar((a) => {
  if (ocupado) return a === "atras";
  if (moverFoco(a, $main)) return true;
  if (a === "ok") {
    const el = document.activeElement;
    if (el && $main.contains(el) && el.dataset.act) el.click();
    else focoInicial($main);
    return true;
  }
  if (a === "atras") {
    switch (pantalla) {
      case "ver": vitrina(); return true;
      case "vitrina": case "que": case "revelar": case "papas": case "puerta": detalle = null; tienda(); return true;
      case "guia": if (pasoGuia > 0) { pasoGuia--; guia(); return true; } return false;
      default: return false; // en la tienda, "atrás" regresa a Noli
    }
  }
  return false;
});

// ——— Arranque ———

const leer = (url) => fetch(url).then((r) => r.json());
Promise.all([leer("datos/config.json"), leer("datos/coleccion.json"), Noli.datos, Noli.creditos]).then(([c, col, datos, cr]) => {
  cfg = c;
  piezas = col.piezas;
  e = cargar(datos);
  saldo = typeof cr === "number" ? cr : null;
  if (e.guia) tienda(); else guia();
}).catch(() => {
  $main.innerHTML = `<p class="cargando">No se pudo abrir la tienda. Revisa el internet y vuelve a intentar.</p>`;
});
