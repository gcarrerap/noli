// Pantallas del Huerto. La lógica está en los otros módulos.
import { Noli, moverFoco, focoInicial } from "../../../kit/noli.js";
import { decir } from "./voz.js";
import { clic, zumba, listo as sonidoListo, bien, desbloquear } from "./sonido.js";
import { TEXTOS, capital } from "./textos.js";
import { SEMILLAS, semillaNueva } from "./semillas.js";
import {
  NIVELES, POR_TEMPORADA, MAX_FILAS, MAX_POR_FILA, coincide, infoPar, limitar, opcionesSalto,
} from "./niveles.js";
import { pista, marcaPasoCompleto } from "./pista.js";
import {
  GUIA, GUIA_VOZ_MAX_MS, pasoGuia, textoGuia, guiaAvanzaConToque, listoGuiaActivo, focoGuia,
  topeGuia, efectoAtrasGuia, lineaGuia, esperaAutoGuia, cadenaFocoGuia, focoAlCerrarSalir,
} from "./guia.js";
import {
  cargar, anotarEncargo, dominio, cerrarTemporada, quiereFacil, planSlots, encargoDeSlot,
  marcarGuia, ponerVoz, fechaLocal, cumplirReto, racha, semana, resumen, nivelDe,
  VENTANA, PARA_SUBIR,
} from "./progreso.js";
import { retoDelDia } from "./reto.js";

const $main = document.getElementById("juego");
const rnd = Math.random;
const hoy = () => fechaLocal();
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const reducido = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

try {
  if (new URLSearchParams(location.search).get("modo") === "tv") document.documentElement.dataset.modo = "tv";
} catch { /* abierto fuera del navegador */ }

const esTv = () => document.documentElement.dataset.modo === "tv" || Noli.modo === "tv";
const vozOn = () => !pr || pr.voz !== false;

const INLINE = ["abeja", "boton-mas", "boton-menos", "salto", "salto-regreso", "recta-marca", "recta-marca-llena", "recta-marca-actual"];
const arte = {};
let pr;
let pantalla = "inicio";
let partida = null;
let avisoInicio = "";
let token = 0;
let pistaToken = 0;
let relojGuia = 0;

function hablar(texto, alTerminar) {
  if (!vozOn()) return false;
  return decir(texto, { activo: true, alTerminar });
}

function vozSigue() {
  const s = typeof window !== "undefined" ? window.speechSynthesis : null;
  return !!(s && (s.speaking || s.pending));
}

function cargarArte() {
  return Promise.all(INLINE.map((nombre) =>
    fetch(new URL(`../img/${nombre}.svg`, import.meta.url))
      .then((r) => (r.ok ? r.text() : ""))
      .then((t) => { arte[nombre] = t; })
      .catch(() => { arte[nombre] = ""; })));
}

function svg(nombre, cambios) {
  let t = arte[nombre] || "";
  if (!t) return "";
  t = t.replace(/ id="alas"/g, "");
  if (!cambios) return t;
  for (const [id, valor] of Object.entries(cambios)) {
    const seguro = String(valor).replace(/[&<>]/g, "");
    t = t.replace(new RegExp(`(id="${id}"[^>]*>)[^<]*`), `$1${seguro}`);
    if (id === "numero" && seguro.length >= 3) {
      const size = seguro.length >= 4 ? "16" : "20";
      t = t.replace(/(id="numero"[^>]*font-size=")[^"]+/, `$1${size}`);
    }
  }
  return t;
}

function mostrar(html, nombre, focoId) {
  pantalla = nombre;
  $main.className = "p-" + nombre;
  $main.innerHTML = html;
  if (esTv()) document.documentElement.classList.add("teclado");
  enfocar(focoId);
}

// Si el destino está apagado, el foco no cae solo en Saltar.
function enfocar(focoId) {
  const pedido = focoId && $main.querySelector(`[data-foco-id="${focoId}"]`);
  if (pedido && !pedido.disabled) {
    pedido.focus({ preventScroll: true });
    return;
  }
  const otro = [...$main.querySelectorAll("[data-foco]")].find((e) => !e.disabled && e.dataset.focoId !== "saltar");
  if (otro) otro.focus({ preventScroll: true });
  else focoInicial($main);
}

const guardar = () => Noli.guardar(pr);

function programarPista() {
  const t = ++pistaToken;
  for (const ms of [20000, 40000]) {
    setTimeout(() => {
      if (t !== pistaToken || pantalla !== "juego" || !partida || partida.saliendo) return;
      const foco = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.focoId;
      pintarJuego(foco || undefined);
    }, ms);
  }
}

function segundosPista() {
  return partida ? (Date.now() - partida.t0) / 1000 : 0;
}

function estadoGuia() {
  return { acepto: partida.acepto, filas: partida.filas, porFila: partida.porFila, fase: partida.fase };
}

function pistaAhora() {
  const e = partida.encargo;
  const fase = partida.fase === "giro2" ? "plantar" : partida.fase;
  const metaForma = fase === "plantar" || fase === "giro2"
    ? (partida.fase === "giro2" ? { filas: e.filas2, porFila: e.porFila2 } : { filas: e.filas, porFila: e.porFila })
    : { filas: e.filas, porFila: e.porFila };
  const segundos = segundosPista();
  const ayuda = pista({
    fase: partida.fase === "giro2" ? "plantar" : partida.fase,
    filas: partida.filas,
    porFila: partida.porFila,
    salto: partida.salto,
  }, {
    nivel: e.nivel,
    filas: metaForma.filas,
    porFila: metaForma.porFila,
    secuencia: e.secuencia,
    paso: e.paso || e.porFila,
    direccion: e.direccion || 1,
  }, { segundos, errores: partida.errores, tv: esTv() });
  if (marcaPasoCompleto(e.nivel, ayuda.paso, segundos)) partida.vioPasoCompleto = true;
  return ayuda;
}

// ---------- Dibujo ----------

function estrellasHtml(n, grande) {
  const estrella = (on) => `<svg viewBox="0 0 24 24" class="${on ? "on" : "off"}" aria-hidden="true"><path d="M12 2.5l2.7 6.3 6.8.6-5.2 4.4 1.6 6.6L12 16.8 6.1 20.4l1.6-6.6L2.5 9.4l6.8-.6z"/></svg>`;
  return `<span class="estrellas${grande ? " grande" : ""}" aria-label="${n} de 3">${[0, 1, 2].map((i) => estrella(i < n)).join("")}</span>`;
}
const FLAMA = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1.5-4.5 3-6 0 2 1 3 2 3 0-3-1-6 1-9z" fill="#ff6b4a"/><path d="M12 13c.5 2 3 3 3 5.5a3 3 0 0 1-6 0c0-1.5 1-2.5 3-5.5z" fill="#ffc43d"/></svg>`;
const CHECK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>`;
const CANDADO = `<svg class="ico" viewBox="0 0 24 24" aria-label="Cerrada"><rect x="5" y="10" width="14" height="11" rx="2.5" fill="currentColor" opacity=".5"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>`;

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

function htmlSemillas() {
  return `<div class="semillas" aria-label="Semillas">${SEMILLAS.map((s) => {
    const abierta = s.nivel <= pr.nivel;
    const archivo = abierta ? `semillas-${s.id}` : "semillas-cerrado";
    return `<img src="img/${archivo}.svg" alt="${abierta ? esc(s.nombre) : "Cerrada"}">`;
  }).join("")}</div>`;
}

function htmlHuerto(filas, porFila, semilla, abeja) {
  let celdas = "";
  for (let r = 0; r < filas; r++) {
    for (let c = 0; c < porFila; c++) {
      const aqui = abeja && abeja.fila === r && abeja.col === c;
      celdas += `<div class="celda"><img class="tierra" alt="" src="img/tierra.svg"><img class="planta" alt="" src="img/planta-${semilla}.svg">${aqui ? `<span class="abeja${abeja.vuelta ? " vuelta" : ""}">${svg("abeja")}</span>` : ""}</div>`;
    }
  }
  return `<div class="huerto" style="--cols:${porFila}" role="img" aria-label="${filas} filas de ${porFila}">${celdas}</div>`;
}

function htmlMonton(cantidad, semilla) {
  const cols = Math.min(5, Math.max(1, cantidad));
  let celdas = "";
  for (let i = 0; i < cantidad; i++) {
    celdas += `<div class="celda"><img class="tierra" alt="" src="img/tierra.svg"><img class="planta" alt="" src="img/planta-${semilla}.svg"></div>`;
  }
  return `<div class="huerto" style="--cols:${cols}" role="img" aria-label="${cantidad} ${semilla}">${celdas}</div>`;
}

function htmlPares(cantidad, semilla) {
  const inf = infoPar(cantidad);
  let s = `<div class="resultado-par"><div class="parejas">`;
  for (let i = 0; i < inf.parejas; i++) {
    s += `<div class="par"><img class="lazo" alt="" src="img/pareja.svg"><img class="planta a" alt="" src="img/planta-${semilla}.svg"><img class="planta b" alt="" src="img/planta-${semilla}.svg"></div>`;
  }
  if (inf.sobra) {
    s += `<div class="par sola"><img class="lazo" alt="" src="img/sin-pareja.svg"><img class="planta a" alt="" src="img/planta-${semilla}.svg"></div>`;
  }
  s += `</div>`;
  if (inf.par) {
    s += `<p class="ecuacion">${esc(inf.doble)}</p>`;
    s += `<p class="frase">2 filas y ${inf.porFila} columnas. Son ${cantidad} cuadros.</p>`;
    s += htmlHuerto(2, inf.porFila, semilla, null);
  } else {
    s += `<p class="ecuacion">Sobra una. Es ${esc(TEXTOS.non)}.</p>`;
  }
  return s + `</div>`;
}

function htmlRecta() {
  const e = partida.encargo;
  const sec = e.secuencia || [];
  const hecho = partida.salto;
  const conInicio = e.tipo === "saltar";
  const nMarcas = sec.length + 1;
  const cols = [];
  for (let i = 0; i < nMarcas; i++) {
    cols.push("36px");
    if (i < nMarcas - 1) cols.push("minmax(8px,1fr)");
  }
  const paso = e.paso || e.porFila || 0;
  let arcos = "";
  let riel = "";
  for (let i = 0; i < nMarcas; i++) {
    const actual = i === hecho;
    const llena = i < hecho;
    const abeja = actual ? `<span class="abeja-mini">${svg("abeja")}</span>` : "";
    if (i === 0 && !conInicio) {
      riel += `<span class="marca colmena${actual ? " actual" : ""}"><img alt="" src="img/colmena.svg">${abeja}</span>`;
    } else {
      const num = i === 0 ? e.inicio : sec[i - 1];
      const mostrarNum = i <= hecho && (conInicio || i > 0);
      const nombre = actual ? "recta-marca-actual" : llena ? "recta-marca-llena" : "recta-marca";
      riel += `<span class="marca${actual ? " actual" : ""}">${svg(nombre, { numero: mostrarNum ? String(num) : "" })}${abeja}</span>`;
    }
    arcos += "<span></span>";
    if (i < nMarcas - 1) {
      const lleno = i < hecho;
      const esRegreso = partida.regreso && i === hecho;
      riel += `<span class="tramo"><img alt="" src="img/recta-tramo${lleno ? "-lleno" : ""}.svg"></span>`;
      if (lleno || esRegreso) {
        const etiqueta = (esRegreso ? "−" : "+") + paso;
        arcos += `<span class="arco">${svg(esRegreso ? "salto-regreso" : "salto", { paso: etiqueta })}</span>`;
      } else arcos += "<span></span>";
    }
  }
  return `<div class="recta" style="--cols:${cols.join(" ")}"><div class="rect-fila arcos">${arcos}</div><div class="rect-fila riel">${riel}</div></div>`;
}

function htmlStepper(campo, valor, max, etiqueta) {
  const guia = partida.modo === "guia";
  const bloqueado = guia && !partida.acepto;
  const tope = guia && (partida.fase === "plantar" || partida.fase === "giro2") ? topeGuia(campo, max) : max;
  const menosOff = bloqueado || valor <= 1;
  const masOff = bloqueado || valor >= tope;
  const pistaF = partida._flecha === campo ? " con-flecha" : "";
  const grupo = bloqueado || partida.saliendo
    ? ""
    : `tabindex="0" data-foco data-foco-id="contador-${campo}"`;
  return `<div class="stepper${pistaF}" data-flecha="${campo}" data-contador="${campo}" ${grupo}>
    <span class="etiq">${etiqueta}</span>
    <button type="button" class="pm menos" ${menosOff ? "disabled" : ""} data-act="step" data-campo="${campo}" data-delta="-1" aria-label="Quitar en ${etiqueta}">${svg("boton-menos")}<span class="signo-tv" aria-hidden="true">▼</span></button>
    <span class="valor">${valor}</span>
    <button type="button" class="pm mas" ${masOff ? "disabled" : ""} data-act="step" data-campo="${campo}" data-delta="1" aria-label="Poner en ${etiqueta}">${svg("boton-mas")}<span class="signo-tv" aria-hidden="true">▲</span></button>
  </div>`;
}

function dialogoSalir() {
  return `<div class="velo"><div class="dialogo" role="dialog" aria-label="Salir">
    <p>¿Salir?</p>
    <button type="button" class="boton grande primario" data-foco="inicial" data-foco-id="seguir" data-act="seguir">Seguir</button>
    <button type="button" class="boton grande" data-foco data-foco-id="salir" data-act="salir-menu">Salir</button>
  </div></div>`;
}

// ---------- Inicio y menús ----------

function inicio(focoId) {
  partida = null;
  pistaToken++;
  const n = Math.min(pr.elegido || pr.nivel, pr.nivel);
  const dn = NIVELES[n - 1];
  const dm = dominio(pr, n);
  const reto = pr.retos[hoy()];
  mostrar(`
    <h1 class="titulo">Huerto en Filas</h1>
    ${htmlSemillas()}
    <p class="sub">Nivel ${n}: ${esc(dn.nombre)}</p>
    ${avisoInicio ? `<p class="aviso">${esc(avisoInicio)}</p>` : ""}
    ${dm.listo || pr.niveles[n]?.dominado ? `<p class="dominio ok">¡Ya dominas este nivel!</p>` : `<div class="dominio"><div class="barra"><i style="width:${Math.min(100, Math.round((100 * dm.intentos) / VENTANA))}%"></i></div><small>${dm.intentos} de ${VENTANA} para ver si subes</small></div>`}
    <div class="menu menu-inicio">
      <button class="boton grande primario principal" data-foco="inicial" data-foco-id="jugar" data-act="jugar">Jugar</button>
      <button class="boton grande ${reto?.cumplido ? "hecho" : "reto"}" data-foco data-foco-id="reto" data-act="reto">Reto del día <small>${reto?.cumplido ? "Cumplido" : "Huerto grande"}</small></button>
      <button class="boton grande" data-foco data-act="progreso">Mi progreso</button>
      <button class="boton grande" data-foco data-act="como">¿Cómo se juega?</button>
      <button class="boton grande" data-foco data-act="voz">Voz: ${pr.voz ? "sí" : "no"}</button>
    </div>
    <p class="racha">${FLAMA}<span>${esc(textoRacha())}</span></p>`, "inicio", focoId || "jugar");
  avisoInicio = "";
}

function progreso() {
  mostrar(`
    <h1 class="titulo">Mi progreso</h1>
    <p class="racha">${FLAMA}<span>${esc(textoRacha())}</span></p>
    ${semanaHtml()}
    <ol class="mapa">${NIVELES.map((x) => {
      const abierto = x.n <= pr.nivel;
      const nv = nivelDe(pr, x.n);
      const dm = dominio(pr, x.n);
      const estado = nv.dominado ? estrellasHtml(nv.estrellas || 0) : abierto ? `<span>${dm.aciertos}/${PARA_SUBIR}</span>` : CANDADO;
      const actual = x.n === Math.min(pr.elegido || pr.nivel, pr.nivel);
      return `<li><button type="button" class="nivel ${nv.dominado ? "dominado" : abierto ? "abierto" : "cerrado"}${actual ? " actual" : ""}" ${abierto ? `data-foco${actual ? '="inicial"' : ""} data-act="elegir" data-n="${x.n}"` : "disabled"}>
        <b class="num">${x.n}</b><span class="nom">${esc(x.nombre)}<small>${esc(x.ejemplo)}</small></span>${estado}</button></li>`;
    }).join("")}</ol>
    <div class="menu fila">
      <button type="button" class="boton" data-foco data-act="a-inicio">El huerto</button>
      <button type="button" class="boton" data-foco data-act="papas">Para papás</button>
    </div>`, "progreso");
}

function papas() {
  const R = resumen(pr);
  mostrar(`
    <h1 class="titulo">Para papás</h1>
    <p class="nota">Sube con ${PARA_SUBIR} de los últimos ${VENTANA}, solo si el encargo salió bien a la primera. Tres fallos seguidos no bajan de nivel: el siguiente encargo es más fácil. Una temporada son ${POR_TEMPORADA} encargos. El reto del día es Huerto grande: 6 encargos, 4 bien. No hay contrarreloj. Fila es horizontal y columna es vertical. Los ${TEXTOS.nones} se pueden llamar impares cambiando una palabra del juego.</p>
    <table class="tabla"><thead><tr><th>Nivel</th><th>Encargos</th><th>A la primera</th><th></th></tr></thead><tbody>
      ${R.niveles.filter((x) => x.desbloqueado || x.total).map((x) => `<tr><td>${x.n}. ${esc(x.nombre)}</td><td>${x.total}</td><td>${x.pct == null ? "–" : x.pct + " %"}</td><td>${x.dominado ? "Dominado" : ""}</td></tr>`).join("")}
    </tbody></table>
    <div class="menu fila"><button type="button" class="boton" data-foco="inicial" data-act="progreso">Regresar</button></div>`, "papas");
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
      <button class="boton grande primario" data-foco="inicial" data-act="reto-jugar">¡Empezar!</button>
      <button class="boton grande" data-foco data-act="a-inicio">El huerto</button>
    </div>
    <p class="racha">${FLAMA}<span>${esc(textoRacha())}</span></p>
    ${semanaHtml()}`, "reto");
}

// ---------- Partida ----------

function empezarGuia() {
  pistaToken++;
  partida = {
    modo: "guia", n: 1, i: 0, total: 1, aciertos: 0,
    encargo: {
      nivel: 1, tipo: "plantar", filas: GUIA.filas, porFila: GUIA.porFila, total: 6,
      secuencia: [3, 6], paso: 3, direccion: 1, cosecha: true, semilla: "zanahoria",
      texto: "Planta 2 filas de 3.", leer: "Planta 2 filas de 3.",
      suma: "3 + 3 = 6", frase: "2 filas y 3 columnas. Son 6 cuadros.", fraseLeer: "2 filas y 3 columnas. Son 6 cuadros.",
    },
    fase: "plantar", filas: 1, porFila: 1, acepto: false, salto: 0, opciones: null,
    fallo: false, errores: 0, t0: Date.now(), saliendo: false, coincidia: false, regreso: false,
    espera: false, aviso: "", _flecha: null, vioPasoCompleto: false,
  };
  clearTimeout(relojGuia);
  relojGuia = 0;
  pintarJuego("aceptar");
  const hablo = hablar(partida.encargo.leer, avanzarPedidoSiSigue);
  if (hablo) programarToqueGuia(GUIA_VOZ_MAX_MS);
}

function avanzarPedidoSiSigue() {
  if (!partida || partida.modo !== "guia" || partida.saliendo) return;
  if (!guiaAvanzaConToque(pasoGuia(estadoGuia()))) return;
  aceptarPedido();
}

function programarToqueGuia(msVoz) {
  const activo = partida && partida.modo === "guia" && !partida.saliendo && guiaAvanzaConToque(pasoGuia(estadoGuia()));
  if (!activo) {
    clearTimeout(relojGuia);
    relojGuia = 0;
    return;
  }
  if (relojGuia && msVoz == null) return;
  clearTimeout(relojGuia);
  const ms = esperaAutoGuia(msVoz == null ? (vozSigue() ? GUIA_VOZ_MAX_MS : 0) : msVoz);
  relojGuia = setTimeout(() => {
    relojGuia = 0;
    avanzarPedidoSiSigue();
  }, ms);
}

function empezarTemporada() {
  const n = Math.min(pr.elegido || pr.nivel, pr.nivel);
  partida = {
    modo: "turno", n, slots: planSlots(pr, n, rnd), problemas: null,
    i: 0, total: POR_TEMPORADA, aciertos: 0,
  };
  cargarEncargo();
}

function empezarReto() {
  const reto = retoDelDia(hoy(), Math.min(pr.elegido || pr.nivel, pr.nivel));
  partida = {
    modo: "reto", n: reto.n, slots: null, problemas: reto.problemas, reto,
    i: 0, total: reto.cuantos, aciertos: 0,
  };
  cargarEncargo();
}

function cargarEncargo() {
  const slot = partida.problemas ? null : partida.slots[partida.i];
  const encargo = partida.problemas
    ? partida.problemas[partida.i]
    : encargoDeSlot(slot, rnd, !slot.repaso && quiereFacil(pr, slot.nivel));
  const fase = encargo.tipo === "par" ? "par" : encargo.tipo === "saltar" ? "saltar" : "plantar";
  Object.assign(partida, {
    encargo, fase, filas: 1, porFila: 1, acepto: true, salto: 0, opciones: null,
    fallo: false, errores: 0, t0: Date.now(), saliendo: false, coincidia: false,
    regreso: false, espera: false, aviso: "", _flecha: null, vioPasoCompleto: false,
  });
  if (fase === "saltar") prepararOpciones();
  programarPista();
  pintarJuego(fase === "par" ? "par-par" : fase === "saltar" ? "op-0" : "contador-filas");
  hablar(encargo.leer);
}

function prepararOpciones() {
  const e = partida.encargo;
  const correcto = e.secuencia[partida.salto];
  const actual = partida.salto === 0 ? (e.tipo === "saltar" ? e.inicio : 0) : e.secuencia[partida.salto - 1];
  partida.opciones = opcionesSalto(correcto, actual, e.paso || e.porFila, e.direccion || 1, rnd);
}

function abejaEnHuerto() {
  if (!partida || partida.fase !== "cosecha") return null;
  const filas = partida.encargo.filas || 1;
  const por = partida.encargo.porFila || 1;
  if (partida.salto <= 0 || partida.regreso) return { fila: Math.min(partida.salto, filas - 1), col: 0 };
  return { fila: Math.min(partida.salto - 1, filas - 1), col: por - 1 };
}

function coachGuia() {
  const paso = pasoGuia(estadoGuia());
  const tv = esTv();
  if (paso === "filas" && partida.filas > GUIA.filas) {
    return tv
      ? { texto: "Pulsa ▼ hasta 2.", leer: "Pulsa abajo hasta 2." }
      : { texto: "Quita con − hasta 2.", leer: "Quita hasta 2." };
  }
  if (paso === "cada" && partida.porFila > GUIA.porFila) {
    return tv
      ? { texto: "Pulsa ▼ hasta 3.", leer: "Pulsa abajo hasta 3." }
      : { texto: "Quita con − hasta 3.", leer: "Quita hasta 3." };
  }
  return textoGuia(paso, tv);
}

function pintarJuego(focoId) {
  if (!partida) return;
  const e = partida.encargo;
  const guia = partida.modo === "guia";
  const paso = guia ? pasoGuia(estadoGuia()) : null;
  const coach = guia ? coachGuia() : null;
  const ayuda = guia ? null : pistaAhora();
  partida._flecha = ayuda && ayuda.flecha;
  const focoAttr = (id, inicial) => {
    if (partida.saliendo) return "";
    const ini = inicial ? 'data-foco="inicial"' : "data-foco";
    return `${ini} data-foco-id="${id}"`;
  };
  const puntos = guia ? "" : `<span class="puntos" aria-label="Encargo ${partida.i + 1} de ${partida.total}">${Array.from({ length: partida.total }, (_, i) => `<i class="${i < partida.i ? "lleno" : ""} ${i === partida.i ? "ahora" : ""}"></i>`).join("")}</span>`;
  const pedido = guia
    ? (paso === "pedido"
      ? `<button type="button" class="pedido boton" data-foco="inicial" data-foco-id="aceptar" data-act="aceptar">Planta 2 filas de 3.</button>`
      : `<p class="pedido">Planta 2 filas de 3.</p>`)
    : `<p class="pedido">${esc(partida.fase === "giro2" ? e.texto2 : e.texto)}</p>`;
  const textoAyuda = guia
    ? lineaGuia(paso === "pedido" ? "" : coach.texto, partida.aviso)
    : (partida.fase === "muestra" ? "" : (partida.aviso || (ayuda && ayuda.texto) || ""));
  const lineaPista = textoAyuda ? `<p class="pista">${esc(textoAyuda)}</p>` : "";

  let zonaHuerto = "";
  let zonaControles = "";
  if (partida.fase === "par") {
    zonaHuerto = htmlMonton(e.cantidad, e.semilla);
    zonaControles = `<div class="opciones${partida._flecha === "par" ? " con-flecha" : ""}" data-flecha="par">
        <button type="button" class="opcion" ${focoAttr("par-par", true)} data-act="par" data-n="par">${esc(capital(TEXTOS.par))}</button>
        <button type="button" class="opcion" ${focoAttr("par-non", false)} data-act="par" data-n="non">${esc(capital(TEXTOS.non))}</button>
      </div>`;
  } else if (partida.fase === "muestra") {
    zonaHuerto = htmlMuestra(false);
    zonaControles = htmlMuestra(true);
  } else if (partida.fase === "saltar") {
    zonaHuerto = htmlRecta();
    zonaControles = htmlOpciones();
  } else if (partida.fase === "cosecha") {
    const suma = e.nivel >= 4 && e.suma ? `<p class="ecuacion">${esc(e.suma)}</p>` : "";
    zonaHuerto = `${htmlHuerto(e.filas, e.porFila, e.semilla, abejaEnHuerto())}${suma}${htmlRecta()}`;
    zonaControles = htmlOpciones();
  } else {
    const brilla = coincide(partida.filas, partida.porFila, e, partida.fase);
    const listoOff = guia && !listoGuiaActivo(estadoGuia());
    zonaHuerto = htmlHuerto(partida.filas, partida.porFila, e.semilla, null);
    zonaControles = `<div class="steppers">
        ${htmlStepper("filas", partida.filas, MAX_FILAS, "Filas")}
        ${htmlStepper("cada", partida.porFila, MAX_POR_FILA, "En cada fila")}
      </div>
      <button type="button" class="boton listo${brilla ? " brilla" : ""}${partida._flecha === "listo" ? " con-flecha" : ""}" ${listoOff ? "disabled" : focoAttr("listo", !!brilla)} data-act="listo" data-flecha="listo">Listo</button>`;
  }

  const saltar = guia ? `<button type="button" class="boton saltar" tabindex="-1" data-act="saltar-guia">Saltar</button>` : "";
  mostrar(`
    <div class="cab">${saltar}<span class="nivel-mini">${guia ? "Guía" : esc(NIVELES[(e.nivel || partida.n) - 1].nombre)}</span>${puntos}</div>
    <div class="encargo">
      <img class="granjero" alt="" src="img/${partida.fase === "muestra" && !partida.fallo ? "granjero-feliz" : "granjero"}.svg">
      <div class="burbuja">${pedido}${lineaPista}</div>
    </div>
    <div class="mesa"><div class="zona-huerto">${zonaHuerto}</div><div class="zona-controles">${zonaControles}</div></div>
    ${partida.saliendo ? dialogoSalir() : ""}`, "juego", partida.saliendo ? "seguir" : focoId);
  programarToqueGuia();
}

function htmlOpciones() {
  const ops = partida.opciones || [];
  const focoAttr = (id, inicial) => partida.saliendo ? "" : `${inicial ? 'data-foco="inicial"' : "data-foco"} data-foco-id="${id}"`;
  return `<div class="opciones${partida._flecha === "opciones" ? " con-flecha" : ""}" data-flecha="opciones">${ops.map((n, i) =>
    `<button type="button" class="opcion" ${focoAttr("op-" + i, i === 0)} data-act="opcion" data-n="${n}">${n}</button>`).join("")}</div>`;
}

function htmlMuestra(controles) {
  const e = partida.encargo;
  if (controles) {
    const foco = partida.saliendo ? "" : 'data-foco="inicial" data-foco-id="seguir-muestra"';
    return `<button type="button" class="boton listo brilla seguir-muestra" ${foco} data-act="seguir-muestra">Seguir</button>`;
  }
  if (e.tipo === "par") return htmlPares(e.cantidad, e.semilla);
  if (e.tipo === "giro") {
    return `${htmlHuerto(e.filas2, e.porFila2, e.semilla, null)}
      <p class="ecuacion">${esc(e.suma)}</p><p class="ecuacion">${esc(e.suma2)}</p>
      <p class="frase">${esc(e.filas)} filas de ${esc(e.porFila)} y ${esc(e.filas2)} filas de ${esc(e.porFila2)}. Son ${e.total} cuadros.</p>`;
  }
  return `${htmlHuerto(e.filas, e.porFila, e.semilla, null)}
    <p class="ecuacion">${esc(e.suma)}</p>
    <p class="frase">${esc(e.frase)}</p>`;
}

function aceptarPedido() {
  if (!partida || partida.acepto || partida.saliendo) return;
  partida.acepto = true;
  partida.aviso = "";
  partida.t0 = Date.now();
  clearTimeout(relojGuia);
  relojGuia = 0;
  clic();
  pintarJuego(focoGuia(estadoGuia()));
  hablar(textoGuia("filas", esTv()).leer);
}

function step(campo, delta) {
  if (!partida || partida.saliendo || partida.espera) return;
  if (partida.fase !== "plantar" && partida.fase !== "giro2") return;
  if (partida.modo === "guia" && !partida.acepto) return;
  const max = campo === "filas" ? MAX_FILAS : MAX_POR_FILA;
  const tope = partida.modo === "guia" ? topeGuia(campo, max) : max;
  const clave = campo === "cada" ? "porFila" : "filas";
  const antes = partida[clave];
  const pasoAntes = partida.modo === "guia" ? pasoGuia(estadoGuia()) : "";
  const ahora = limitar(antes + delta, tope);
  if (ahora === antes) {
    if (partida.modo === "guia") pintarJuego(focoGuia(estadoGuia()));
    return;
  }
  clic();
  partida[clave] = ahora;
  partida.aviso = "";
  const ok = coincide(partida.filas, partida.porFila, partida.encargo, partida.fase);
  const recien = ok && !partida.coincidia;
  partida.coincidia = ok;
  let foco = recien ? "listo" : "contador-" + campo;
  if (partida.modo === "guia") {
    const paso = pasoGuia(estadoGuia());
    foco = paso !== pasoAntes ? focoGuia(estadoGuia()) : "contador-" + campo;
    if (paso === "listo") foco = "listo";
  }
  pintarJuego(foco);
  if (recien) sonidoListo();
  if (partida.modo === "guia") {
    const paso = pasoGuia(estadoGuia());
    if (paso === "cada" && partida._dicho !== "cada") { partida._dicho = "cada"; hablar(textoGuia("cada", esTv()).leer); }
    if (paso === "listo" && partida._dicho !== "listo") { partida._dicho = "listo"; hablar(textoGuia("listo", esTv()).leer); }
  }
}

function pulsarListo() {
  if (!partida || partida.saliendo || partida.espera) return;
  if (partida.fase !== "plantar" && partida.fase !== "giro2") return;
  if (partida.modo === "guia" && !listoGuiaActivo(estadoGuia())) return;
  const ok = coincide(partida.filas, partida.porFila, partida.encargo, partida.fase);
  if (!ok) {
    if (partida.modo !== "guia") partida.fallo = true;
    partida.errores++;
    partida.aviso = "Todavía no.";
    pintarJuego("listo");
    return;
  }
  partida.aviso = "";
  partida.coincidia = false;
  const e = partida.encargo;
  if (e.tipo === "giro" && partida.fase === "plantar") {
    partida.fase = "giro2";
    partida.t0 = Date.now();
    programarPista();
    pintarJuego(coincide(partida.filas, partida.porFila, e, "giro2") ? "listo" : "contador-filas");
    hablar(e.leer2);
    return;
  }
  if (e.cosecha) {
    partida.fase = "cosecha";
    partida.salto = 0;
    partida.t0 = Date.now();
    prepararOpciones();
    programarPista();
    pintarJuego("op-0");
    if (partida.modo === "guia") hablar(textoGuia("abejas", esTv()).leer);
    else hablar(e.sumaLeer || "Cuenta con la abeja.");
    return;
  }
  partida.fase = "muestra";
  pintarJuego("seguir-muestra");
  hablar(e.fraseLeer || e.sumaLeer);
}

function elegirOpcion(n) {
  if (!partida || partida.saliendo || partida.espera) return;
  if (partida.fase !== "cosecha" && partida.fase !== "saltar") return;
  const e = partida.encargo;
  const correcto = e.secuencia[partida.salto];
  if (n !== correcto) {
    if (partida.modo !== "guia") partida.fallo = true;
    partida.errores++;
    partida.regreso = true;
    partida.espera = true;
    partida.aviso = "Otra vez.";
    pintarJuego();
    const t = ++token;
    setTimeout(() => {
      if (t !== token || !partida) return;
      partida.regreso = false;
      partida.espera = false;
      pintarJuego("op-0");
    }, reducido() ? 0 : 700);
    return;
  }
  zumba();
  hablar(String(correcto));
  partida.salto++;
  partida.regreso = false;
  partida.aviso = "";
  if (partida.salto >= e.secuencia.length) {
    bien();
    cerrarEncargo();
    return;
  }
  prepararOpciones();
  pintarJuego("op-0");
}

function elegirPar(eleccion) {
  if (!partida || partida.fase !== "par" || partida.espera) return;
  const inf = infoPar(partida.encargo.cantidad);
  const bienElegido = (eleccion === "par") === inf.par;
  if (!bienElegido) {
    partida.fallo = true;
    partida.errores++;
  }
  partida.fase = "muestra";
  pintarJuego("seguir-muestra");
  const inf2 = infoPar(partida.encargo.cantidad);
  hablar(inf2.par ? partida.encargo.sumaLeer : `Sobra una. Es ${TEXTOS.non}.`);
}

function seguirMuestra() {
  if (!partida || partida.fase !== "muestra") return;
  cerrarEncargo();
}

function cerrarEncargo() {
  if (partida.modo === "guia") {
    pr = marcarGuia(pr);
    guardar();
    avisoInicio = "Ya puedes jugar.";
    inicio("jugar");
    return;
  }
  const ok = !partida.fallo;
  const antes = pr;
  pr = anotarEncargo(pr, partida.encargo.nivel, ok, hoy(), !!partida.vioPasoCompleto);
  if (ok && pr !== antes) partida.aciertos++;
  guardar();
  partida.i++;
  if (partida.i >= partida.total) {
    if (partida.modo === "reto") finReto();
    else finTemporada();
    return;
  }
  cargarEncargo();
}

function finTemporada() {
  const n = partida.n;
  const aciertos = partida.aciertos;
  const r = cerrarTemporada(pr, n, aciertos);
  pr = r.pr;
  guardar();
  Noli.terminar({ estrellas: r.estrellas });
  const sem = r.subio ? semillaNueva(r.subio) : null;
  const frases = ["¡Buen intento!", "¡Bien hecho!", "¡Muy bien!", "¡Perfecto!"];
  mostrar(`
    <h1 class="titulo">${frases[r.estrellas]}</h1>
    ${estrellasHtml(r.estrellas, true)}
    <p class="sub">${aciertos} de ${POR_TEMPORADA} a la primera</p>
    <img class="granjero grande" alt="" src="img/granjero-feliz.svg">
    ${r.subio ? `<div class="subio"><b>¡Subiste al nivel ${r.subio}!</b><span>${esc(NIVELES[r.subio - 1].nombre)}</span></div>` : ""}
    ${sem ? `<p class="sub">¡Semilla nueva!</p><img class="paquete" alt="${esc(sem.nombre)}" src="img/semillas-${sem.id}.svg">` : ""}
    <div class="menu fila">
      <button class="boton grande primario" data-foco="inicial" data-act="jugar">${r.subio ? "Probar el nivel nuevo" : "Otra temporada"}</button>
      <button class="boton grande" data-foco data-act="a-inicio">El huerto</button>
    </div>`, "fin");
  partida = null;
}

function finReto() {
  const reto = partida.reto;
  const puntos = partida.aciertos;
  const cumplido = puntos >= reto.necesita;
  const antes = !!pr.retos[hoy()]?.cumplido;
  pr = cumplirReto(pr, hoy(), reto.tipo, puntos, cumplido);
  guardar();
  if (cumplido && !antes) Noli.terminar({ estrellas: 3, reto: true });
  mostrar(`
    <h1 class="titulo">${cumplido ? "¡Reto cumplido!" : "¡Casi!"}</h1>
    <p class="sub">${puntos} de ${reto.cuantos}. Meta: ${reto.necesita}.</p>
    <img class="granjero grande" alt="" src="img/${cumplido ? "granjero-feliz" : "granjero"}.svg">
    ${cumplido && !antes ? `<p class="racha grande">${FLAMA}<span>${esc(textoRacha())}</span></p>` : ""}
    <div class="menu fila">
      <button class="boton grande primario" data-foco="inicial" data-act="${cumplido ? "a-inicio" : "reto-jugar"}">${cumplido ? "El huerto" : "Otra vez"}</button>
      ${cumplido ? "" : `<button class="boton grande" data-foco data-act="a-inicio">El huerto</button>`}
    </div>`, "finReto");
  partida = null;
}

function preguntarSalir() {
  if (!partida) return;
  token++;
  clearTimeout(relojGuia);
  relojGuia = 0;
  partida.espera = false;
  partida.focoAntes = idFoco();
  partida.saliendo = true;
  pintarJuego("seguir");
}

function seguirJugando() {
  if (!partida) return;
  const guardado = partida.focoAntes || "";
  partida.focoAntes = "";
  partida.saliendo = false;
  const foco = focoAlCerrarSalir(guardado, partida.modo === "guia", estadoGuia());
  pintarJuego(foco || undefined);
}

function saltarGuia() {
  clearTimeout(relojGuia);
  relojGuia = 0;
  pr = marcarGuia(pr);
  guardar();
  partida = null;
  inicio();
}

function campoFoco() {
  const el = document.activeElement;
  if (!el || !$main.contains(el)) return "";
  if (el.dataset && el.dataset.contador) return el.dataset.contador;
  const padre = el.closest && el.closest("[data-contador]");
  return padre ? padre.dataset.contador : "";
}

function idFoco() {
  const el = document.activeElement;
  return el && el.dataset ? el.dataset.focoId || "" : "";
}

// ▲ y ▼ cambian el contador enfocado. Izquierda y derecha pasan al otro.
function moverContador(accion) {
  if (!partida || partida.saliendo) return false;
  if (partida.fase !== "plantar" && partida.fase !== "giro2") return false;
  const campo = campoFoco();
  if (campo && (accion === "arriba" || accion === "ok")) {
    step(campo, 1);
    return true;
  }
  if (campo && accion === "abajo") {
    step(campo, -1);
    return true;
  }
  if (accion !== "izquierda" && accion !== "derecha") return false;
  const id = idFoco();
  const cadena = cadenaFocoGuia();
  if (!cadena.includes(id)) return false;
  const ids = cadena.filter((x) => {
    const el = $main.querySelector(`[data-foco-id="${x}"]`);
    return el && !el.disabled;
  });
  const i = ids.indexOf(id);
  if (i < 0) return false;
  const j = i + (accion === "derecha" ? 1 : -1);
  if (j >= 0 && j < ids.length) $main.querySelector(`[data-foco-id="${ids[j]}"]`).focus();
  return true;
}

// ---------- Acciones ----------

$main.addEventListener("pointerup", (ev) => {
  if (!partida || partida.modo !== "guia" || partida.saliendo) return;
  if (!guiaAvanzaConToque(pasoGuia(estadoGuia()))) return;
  if (ev.target.closest("[data-act=saltar-guia]")) return;
  aceptarPedido();
}, true);

$main.addEventListener("click", (ev) => {
  const t = ev.target.closest("[data-act]");
  if (!t || !$main.contains(t) || t.disabled) return;
  const act = t.dataset.act;
  if (act === "jugar") empezarTemporada();
  else if (act === "reto") retoIntro();
  else if (act === "reto-jugar") empezarReto();
  else if (act === "progreso") progreso();
  else if (act === "papas") papas();
  else if (act === "como") empezarGuia();
  else if (act === "a-inicio") inicio();
  else if (act === "voz") { pr = ponerVoz(pr, !pr.voz); guardar(); inicio("jugar"); }
  else if (act === "elegir") { pr = { ...pr, elegido: +t.dataset.n }; guardar(); inicio(); }
  else if (act === "aceptar") aceptarPedido();
  else if (act === "step") step(t.dataset.campo, +t.dataset.delta);
  else if (act === "listo") pulsarListo();
  else if (act === "opcion") elegirOpcion(+t.dataset.n);
  else if (act === "par") elegirPar(t.dataset.n);
  else if (act === "seguir-muestra") seguirMuestra();
  else if (act === "seguir") seguirJugando();
  else if (act === "salir-menu") inicio();
  else if (act === "saltar-guia") saltarGuia();
});

Noli.alEntrar((accion) => {
  document.documentElement.classList.add("teclado");
  if (pantalla === "juego" && partida && accion === "atras") {
    if (efectoAtrasGuia(partida.saliendo) === "seguir") seguirJugando();
    else preguntarSalir();
    return true;
  }
  if (partida && partida.modo === "guia" && !partida.saliendo && accion === "ok" && guiaAvanzaConToque(pasoGuia(estadoGuia()))) {
    aceptarPedido();
    return true;
  }
  if (moverContador(accion)) return true;
  if (moverFoco(accion, $main)) return true;
  if (accion === "ok") {
    const e = document.activeElement;
    if (e && $main.contains(e) && !e.disabled) e.click();
    return true;
  }
  if (accion === "atras") {
    if (pantalla === "inicio") return false;
    if (pantalla === "papas") { progreso(); return true; }
    inicio();
    return true;
  }
  return true;
});

document.addEventListener("pointerdown", () => {
  if (!esTv()) document.documentElement.classList.remove("teclado");
  desbloquear();
}, true);

Noli.datos.then((d) => { pr = cargar(d); return cargarArte(); }).then(() => {
  if (esTv()) document.documentElement.classList.add("teclado");
  if (!pr.guiaHecha) empezarGuia();
  else inicio();
});
