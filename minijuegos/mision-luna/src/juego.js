// Pantallas de Misión Luna. La lógica está en los otros módulos (puros, con pruebas).
// Una misión: 1) Combustible (3 textos en inglés con su pregunta; cada respuesta llena un tanque), 2) Despegue y
// viaje (3 palabras espaciales con su dibujo), 3) En la Luna (acomodar las fases en el calendario o «¿cómo se
// verá?»). Atrás regresa a la etapa anterior para mirar; en la primera abre «¿Salir?».
import { Noli, moverFoco } from "../../../kit/noli.js";
import { decirIngles, decirEs, callar, desbloquear as desbloquearVoz } from "./voz.js";
import { clic, listo as sonidoListo, bien, desbloquear as desbloquearSonido, despegue } from "./sonido.js";
import { cargarDatos } from "./datos.js";
import { crearMision, estrellasMision, ITEMS } from "./mision.js";
import { revisarCalendario, calendarioCompleto, mod8 } from "./luna.js";
import { retoDelDia, retoCumplido } from "./reto.js";
import { GUIAS, pista, AYUDA_FASES } from "./guia.js";
import { oracion, pregunta as audioPregunta, opcion as audioOpcion, palabra as audioPalabra, fase as audioFase } from "./audios.js";
import {
  cargar, leeTodo, misionDe, anotarPalabra, cerrarMision, anotarDia, marcarVisto, fechaLocal, cumplirReto, racha, semana, PARA_ABRIR,
} from "./progreso.js";
import {
  dibujo, svgFase, svgCohete, svgRoca, ALTAVOZ, CANDADO, CHECK, FLAMA, LIBRO, OJO, estrellasHtml,
} from "./arte.js";

const $main = document.getElementById("juego");
const rnd = Math.random;
const hoy = () => fechaLocal();
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const reducido = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

try {
  if (new URLSearchParams(location.search).get("modo") === "tv") document.documentElement.dataset.modo = "tv";
  if (window.parent && window.parent !== window) document.documentElement.classList.add("en-catalogo");
} catch { /* abierto fuera del navegador */ }

const esTv = () => document.documentElement.dataset.modo === "tv" || Noli.modo === "tv";

const ETAPAS = ["Combustible", "Viaje", "Luna"];

let pr = null;
let datos = null;
let pantalla = "cargando";
let partida = null;
let token = 0;

const guardar = () => Noli.guardar(pr);
const total = () => datos.misiones.misiones.length;
const defMision = (n) => datos.misiones.misiones[n - 1];
const palabraDe = (id) => datos.vocab.palabras.find((p) => p.id === id) || { id, en: id, es: id };
const faseDe = (n) => datos.vocab.fases[mod8(n)];
const hablarEs = (t) => { if (pr && pr.voz) decirEs(t); };

function mostrar(html, nombre, focoId) {
  pantalla = nombre;
  $main.className = "p-" + nombre;
  $main.innerHTML = html;
  if (esTv()) document.documentElement.classList.add("teclado");
  const raiz = zonaFoco();
  const pedido = focoId && raiz.querySelector(`[data-foco-id="${focoId}"]`);
  if (pedido && !pedido.disabled) pedido.focus({ preventScroll: true });
  else enfocarPrimero(raiz);
}

// Como focoInicial del kit, pero salta los botones apagados (una opción ya descartada)
function enfocarPrimero(raiz) {
  const ok = (e) => e && !e.disabled;
  const e = [...raiz.querySelectorAll('[data-foco="inicial"]')].find(ok) || [...raiz.querySelectorAll("[data-foco]")].find(ok);
  if (e) e.focus({ preventScroll: true });
}

// Con un diálogo abierto (¿Salir? o la guía), las flechas solo se mueven dentro de él
const zonaFoco = () => $main.querySelector(".velo") || $main;

// Marca lo que suena (oración, pregunta u opción) mientras la voz lo dice
function marcarSonando(i) {
  $main.querySelectorAll("[data-voz]").forEach((e) => e.classList.toggle("sonando", +e.dataset.voz === i));
}
const escuchar = (partes) => decirIngles(partes, { alCadaUna: marcarSonando });

// ---------- Pedazos ----------

const DIAS = ["D", "L", "M", "M", "J", "V", "S"];
function semanaHtml() {
  return `<div class="semana" aria-label="Últimos 7 días">${semana(pr, hoy()).map((d) => {
    const [y, m, dd] = d.fecha.split("-").map(Number);
    return `<span class="dia ${d.reto ? "reto" : d.jugo ? "jugo" : ""}"><span class="punto">${d.reto ? CHECK : ""}</span>${DIAS[new Date(y, m - 1, dd).getDay()]}</span>`;
  }).join("")}</div>`;
}
function rachaHtml() {
  const r = racha(pr, hoy());
  return `<p class="racha">${FLAMA}<span>${r ? `Racha: ${r} ${r === 1 ? "día" : "días"}` : "Cumple el reto de hoy para empezar una racha"}</span></p>`;
}
const tarjetaFase = (n, { nombre = false, clase = "" } = {}) =>
  `<span class="fase ${clase}">${svgFase(n, faseDe(n).es)}${nombre ? `<small lang="en">${esc(faseDe(n).en)}</small>` : ""}</span>`;
function tiraFases(total8) {
  const fs = total8 === 8 ? [0, 1, 2, 3, 4, 5, 6, 7] : [0, 2, 4, 6];
  return `<div class="modelo"><b>Así cambia la Luna:</b><div class="tira">${fs.map((f) => tarjetaFase(f)).join('<span class="flecha">›</span>')}</div></div>`;
}
const dialogoSalir = () => `<div class="velo"><div class="dialogo" role="dialog" aria-label="Salir">
    <p>¿Salir de la misión?</p>
    <button type="button" class="boton grande primario" data-foco="inicial" data-foco-id="seguir" data-act="seguir">Seguir</button>
    <button type="button" class="boton grande" data-foco data-foco-id="salir" data-act="salir-menu">Salir</button>
  </div></div>`;
function guiaHtml(clave) {
  const g = GUIAS[clave];
  const arte = clave === "combustible" ? svgCohete(1) : clave === "viaje" ? dibujo("rocket") : clave === "calendario" ? dibujo("foto-fases") : svgFase(2);
  return `<div class="velo"><div class="dialogo guia" role="dialog" aria-label="${esc(g.titulo)}">
    <span class="guia-arte">${arte}</span><b>${esc(g.titulo)}</b><p>${esc(g.texto)}</p>
    <button type="button" class="boton grande primario" data-foco="inicial" data-act="guia-ok">¡Entendido!</button></div></div>`;
}

// ---------- Menús ----------

function inicio(focoId) {
  partida = null;
  token++;
  callar();
  const n = Math.min(pr.elegida || pr.abierta, pr.abierta);
  const def = defMision(n);
  const reto = pr.retos[hoy()];
  const tipoReto = retoDelDia(hoy(), datos.vocab).nombre;
  const rocas = Object.keys(pr.rocas).length;
  mostrar(`
    <div class="portada">${dibujo("foto-llena")}<span class="cohete-portada">${dibujo("rocket")}</span></div>
    <h1 class="titulo">Misión Luna</h1>
    <p class="sub">Misión ${n}: ${esc(def.nombre)} ${estrellasHtml(misionDe(pr, n).estrellas)}</p>
    <div class="menu">
      <button class="boton grande primario principal" data-foco="inicial" data-foco-id="jugar" data-act="jugar">¡Despegar!<small>Misión ${n}</small></button>
      <button class="boton grande ${reto && reto.cumplido ? "hecho" : "reto"}" data-foco data-foco-id="reto" data-act="reto">Reto del día <small>${reto && reto.cumplido ? "Cumplido" : esc(tipoReto)}</small></button>
      <button class="boton grande" data-foco data-foco-id="museo" data-act="museo">Museo espacial <small>${rocas} de ${datos.vocab.palabras.length} rocas</small></button>
      <button class="boton grande" data-foco data-foco-id="misiones" data-act="misiones">Misiones</button>
      <button class="boton grande" data-foco data-foco-id="como" data-act="como">¿Cómo se juega?</button>
      <button class="boton grande" data-foco data-foco-id="voz" data-act="voz">Voz: ${pr.voz ? "sí" : "no"}</button>
    </div>
    ${rachaHtml()}`, "inicio", focoId || "jugar");
}

function misiones() {
  mostrar(`
    <h1 class="titulo">Misiones</h1>
    <p class="sub">Con ${PARA_ABRIR} o 3 estrellas se abre la siguiente.</p>
    <ol class="mapa">${datos.misiones.misiones.map((m) => {
      const abierta = m.n <= pr.abierta, actual = m.n === (pr.elegida || pr.abierta);
      return `<li><button type="button" class="nivel ${abierta ? "abierto" : "cerrado"}${actual ? " actual" : ""}" ${abierta ? `data-foco${actual ? '="inicial"' : ""} data-act="elegir" data-n="${m.n}"` : "disabled"}>
        <b class="num">${m.n}</b><span class="nom">${esc(m.nombre)}<small lang="en">${esc(m.en)}</small></span>${abierta ? estrellasHtml(misionDe(pr, m.n).estrellas) : CANDADO}</button></li>`;
    }).join("")}
    ${datos.misiones.proximamente.map((p) => `<li><span class="nivel cerrado proximo"><span class="mini">${dibujo(p.dibujo)}</span><span class="nom">${esc(p.nombre)}<small>Muy pronto</small></span>${CANDADO}</span></li>`).join("")}</ol>
    <div class="menu fila">
      <button type="button" class="boton" data-foco data-act="a-inicio">Regresar</button>
      <button type="button" class="boton" data-foco data-act="papas">Para papás</button>
    </div>`, "misiones");
}

function museo(focoId) {
  const fotos = datos.misiones.misiones.filter((m) => pr.fotos[m.n]);
  mostrar(`
    <h1 class="titulo">Museo espacial</h1>
    <p class="sub">Cada palabra espacial que emparejas a la primera trae su roca.</p>
    <ul class="rocas">${datos.vocab.palabras.map((p) => {
      const tiene = !!pr.rocas[p.id];
      return `<li><button type="button" class="roca ${tiene ? "" : "falta"}" ${tiene ? `data-foco data-foco-id="roca-${p.id}" data-act="oir-roca" data-id="${p.id}"` : "disabled"}>
        ${tiene ? `<span class="roca-dib">${dibujo(p.id)}</span>` : svgRoca(false)}
        <b lang="en">${tiene ? esc(p.en) : "?"}</b><small>${tiene ? esc(p.es) : ""}</small></button></li>`;
    }).join("")}</ul>
    <h2 class="sub2">Fotos</h2>
    <ul class="fotos">${datos.misiones.misiones.map((m) => pr.fotos[m.n]
      ? `<li class="foto">${dibujo(m.foto.dibujo, m.foto.titulo)}<small>${esc(m.foto.titulo)}</small></li>`
      : `<li class="foto falta"><span class="hueco">${CANDADO}</span><small>Misión ${m.n}</small></li>`).join("")}
      ${datos.misiones.proximamente.map((p) => `<li class="foto falta"><span class="hueco mini">${dibujo(p.dibujo)}</span><small>${esc(p.nombre)}: muy pronto</small></li>`).join("")}</ul>
    <p class="sub">${fotos.length} de ${total()} fotos</p>
    <div class="menu fila"><button type="button" class="boton grande" data-foco${focoId ? "" : '="inicial"'} data-act="a-inicio">Regresar</button></div>`, "museo", focoId);
}

function como() {
  mostrar(`
    <h1 class="titulo">¿Cómo se juega?</h1>
    <ol class="pasos-como">
      <li>${svgCohete(2)}<span><b>Combustible.</b> Lee 3 textos cortos en inglés y contesta. Cada respuesta llena un tanque.</span></li>
      <li>${dibujo("rocket")}<span><b>Viaje.</b> Despega y empareja 3 palabras espaciales con su dibujo.</span></li>
      <li>${dibujo("foto-fases")}<span><b>En la Luna.</b> Acomoda las fases en el calendario o adivina cómo se verá la Luna.</span></li>
    </ol>
    <p class="nota">Toca ${ALTAVOZ} Escuchar para oír el inglés, y ${LIBRO} Español para ver qué dice.</p>
    <div class="menu fila">
      <button type="button" class="boton" data-foco="inicial" data-act="a-inicio">Regresar</button>
      <button type="button" class="boton" data-foco data-act="guia-otra">Ver la guía otra vez</button>
    </div>`, "como");
}

function papas() {
  const LECTURA = { auto: "En las misiones 1 y 2", siempre: "Siempre", pedir: "Solo con «Escuchar»" };
  mostrar(`
    <h1 class="titulo">Para papás</h1>
    <p class="nota">Basado en la unidad «The Moon» de lectura y vocabulario de 2.º grado de Khan Academy (no se pudo revisar su contenido) y en ciencia básica: fases de la Luna, día y noche, gravedad. Cada misión: 3 textos informativos en inglés con una pregunta de idea principal o de dato (primer error: se marca la oración donde está la respuesta; segundo: se enseña), 3 palabras de vocabulario (las que falla regresan en misiones siguientes) y una actividad de fases. Estrellas por aciertos a la primera de 7 (6 = 3 estrellas, 4 = 2, 2 = 1); con 2 se abre la siguiente misión. Reto del día con la fase real de la Luna (calculada en el aparato) o 6 palabras.</p>
    <div class="ajuste"><b>La voz lee todo:</b>
      ${["auto", "siempre", "pedir"].map((k) => `<button type="button" class="boton chico ${pr.lectura === k ? "activo" : ""}" data-foco${pr.lectura === k ? '="inicial"' : ""} data-act="lectura" data-k="${k}">${LECTURA[k]}</button>`).join("")}</div>
    <table class="tabla"><thead><tr><th>Misión</th><th>Veces</th><th>Mejor</th></tr></thead><tbody>
      ${datos.misiones.misiones.filter((m) => m.n <= pr.abierta).map((m) => `<tr><td>${m.n}. ${esc(m.nombre)}</td><td>${misionDe(pr, m.n).jugadas}</td><td>${estrellasHtml(misionDe(pr, m.n).estrellas)}</td></tr>`).join("")}
    </tbody></table>
    <p class="nota">Palabras por repasar: ${pr.repaso.length ? pr.repaso.map((w) => `<span lang="en">${esc(palabraDe(w).en)}</span>`).join(", ") : "ninguna"}.</p>
    <div class="menu fila"><button type="button" class="boton" data-foco data-act="misiones">Regresar</button></div>`, "papas");
}

// ---------- Reto del día ----------

function retoIntro() {
  const reto = retoDelDia(hoy(), datos.vocab);
  const hecho = pr.retos[hoy()];
  mostrar(`
    <h1 class="titulo">Reto del día</h1>
    <div class="tarjeta-reto">
      <span class="mini">${reto.tipo === "fase" ? svgFase(2) : dibujo("star")}</span>
      <b>${esc(reto.nombre)}</b>
      <p>${esc(reto.meta)}</p>
      ${hecho ? `<p>${hecho.cumplido ? "¡Ya lo cumpliste hoy! Puedes jugarlo otra vez." : "Hoy todavía no. ¡Inténtalo otra vez!"}</p>` : ""}
    </div>
    <div class="menu fila">
      <button class="boton grande primario" data-foco="inicial" data-act="reto-jugar">¡Empezar!</button>
      <button class="boton grande" data-foco data-act="a-inicio">Regresar</button>
    </div>
    ${rachaHtml()}${semanaHtml()}`, "reto");
}

function empezarReto() {
  token++;
  const reto = retoDelDia(hoy(), datos.vocab);
  partida = { modo: "reto", reto, i: 0, elegida: null, aciertos: 0, saliendo: false };
  pintarReto();
}

function pintarReto(focoId) {
  const { reto, i } = partida;
  const it = reto.items[i];
  const respondida = partida.elegida != null;
  const punto = (k) => `<span class="${k < i ? "hecho" : k === i ? "ahora" : ""}"></span>`;
  let cuerpo;
  if (reto.tipo === "fase") {
    const op = (f, k) => {
      const cls = respondida ? (k === it.buena ? " bien" : k === partida.elegida ? " mal" : " apagada") : "";
      const contenido = it.modo === "nombre" ? `<b lang="en" data-voz="${k}">${esc(faseDe(f).en)}</b>` : svgFase(f, faseDe(f).es);
      return `<button type="button" class="op ${it.modo === "nombre" ? "op-texto" : "op-fase"}${cls}" data-foco data-foco-id="op-${k}" data-act="reto-op" data-k="${k}" ${respondida ? "disabled" : ""}>${contenido}</button>`;
    };
    cuerpo = `<p class="pedido">${esc(it.texto)}</p>
      <div class="muestra">${tarjetaFase(it.muestra, { clase: "grande" })}</div>
      ${it.modo === "nombre" ? `<button type="button" class="boton chico" data-foco data-act="reto-oir">${ALTAVOZ}Escuchar</button>` : ""}
      <div class="opciones tres">${it.opciones.map(op).join("")}</div>`;
  } else {
    cuerpo = palabraHtml(it, partida.elegida, respondida, "reto-op");
  }
  const fin = respondida ? `<p class="aviso ${partida.elegida === (it.buena != null ? it.buena : it.opciones.indexOf(it.id)) ? "ok" : ""}">${esc(partida.aviso || "")}</p>
    <button type="button" class="boton grande primario" data-foco="inicial" data-foco-id="seguir" data-act="reto-seguir">Seguir</button>` : "";
  mostrar(`
    <div class="cab"><span class="nivel-mini">${esc(reto.nombre)}</span><span class="puntos">${reto.items.map((_, k) => punto(k)).join("")}</span></div>
    ${cuerpo}${fin}${partida.saliendo ? dialogoSalir() : ""}`, "juego", partida.saliendo ? "seguir" : focoId || (respondida ? "seguir" : null));
}

function responderReto(k) {
  const it = partida.reto.items[partida.i];
  if (partida.elegida != null) return;
  const buena = partida.reto.tipo === "fase" ? it.buena : it.opciones.indexOf(it.id);
  partida.elegida = k;
  const ok = k === buena;
  if (ok) { partida.aciertos++; bien(); } else clic();
  if (partida.reto.tipo === "fase") partida.aviso = ok ? "¡Bien!" : `Era ${faseDe(it.opciones[buena]).es} (${faseDe(it.opciones[buena]).en}).`;
  else partida.aviso = ok ? `¡Bien! ${palabraDe(it.id).en} = ${palabraDe(it.id).es}` : `${palabraDe(it.id).en} = ${palabraDe(it.id).es}`;
  pintarReto();
}

function seguirReto() {
  partida.i++;
  partida.elegida = null;
  partida.aviso = "";
  if (partida.i < partida.reto.items.length) { pintarReto(); return; }
  const { reto, aciertos } = partida;
  const cumplido = retoCumplido(reto, aciertos);
  const antes = !!(pr.retos[hoy()] && pr.retos[hoy()].cumplido);
  pr = cumplirReto(pr, hoy(), reto.tipo, aciertos, cumplido);
  guardar();
  if (cumplido && !antes) Noli.terminar({ estrellas: 3, reto: true });
  if (cumplido) sonidoListo();
  partida = null;
  const f = reto.fase;
  mostrar(`
    <h1 class="titulo">${cumplido ? "¡Reto cumplido!" : "¡Buen intento!"}</h1>
    <p class="sub">${aciertos} de ${reto.items.length} · necesitabas ${reto.necesita}</p>
    ${reto.tipo === "fase" ? `<div class="tarjeta-reto">${tarjetaFase(f, { nombre: true, clase: "grande" })}
      <p>${f === 0 ? "Hoy es luna nueva: casi no se ve. ¡Búscala en unos días!" : `Esta noche busca la Luna en el cielo: se ve así (${esc(faseDe(f).es)}).`}</p></div>` : ""}
    ${rachaHtml()}${semanaHtml()}
    <div class="menu fila">
      <button class="boton grande primario" data-foco="inicial" data-act="a-inicio">Al inicio</button>
      ${cumplido ? "" : '<button class="boton grande" data-foco data-act="reto-jugar">Otra vez</button>'}
    </div>`, "reto-fin");
}

// ---------- La misión ----------

function empezarMision(n) {
  token++;
  callar();
  pr = { ...pr, elegida: n };
  const def = defMision(n);
  const m = crearMision(def, datos.vocab, { repaso: pr.repaso, rnd });
  partida = {
    modo: "mision", n, def, m, fase: 0, vista: 0,
    texto: 0, paso: "leer", espanol: false, verTexto: false, fallos: 0, descartadas: [], resuelta: false, llenos: 0,
    palabra: 0, despegando: true, fallosP: 0, descartadasP: [], resueltaP: false,
    colocadas: {}, bandeja: [...(m.luna.bandeja || [])], tomada: null, fallosL: 0, marcadas: [], resueltaL: false, elegidaL: null, modelo: false,
    aciertos: 0, rocas: [], aviso: "", saliendo: false, guia: null,
  };
  abrirGuia("combustible");
  pintar();
  if (!partida.guia) leerSolo();
}

function abrirGuia(clave) {
  if (pr.vistos[clave] || partida.modo !== "mision") return;
  partida.guia = clave;
  hablarEs(GUIAS[clave].leer);
}

function cerrarGuia() {
  pr = marcarVisto(pr, partida.guia);
  guardar();
  partida.guia = null;
  callar();
  pintar();
  if (partida.fase === 1 && partida.despegando) arrancarDespegue();
  else leerSolo();
}

// Con «la voz lee todo»: el texto, la pregunta con sus opciones, o la palabra, al llegar a cada paso.
function leerSolo() {
  if (!partida || partida.guia || partida.saliendo || !leeTodo(pr, partida.n) || partida.vista !== partida.fase) return;
  if (partida.fase === 0 && !partida.resuelta) partida.paso === "leer" ? oirTexto() : oirPregunta();
  else if (partida.fase === 1 && !partida.despegando && !partida.resueltaP) oirPalabra();
}

const textoActual = () => partida.m.textos[partida.texto];
const oirTexto = () => { const t = textoActual(); escuchar(t.en.map((s, k) => ({ archivo: oracion(t.id, k), texto: s }))); };
function oirPregunta() {
  const t = textoActual(), p = t.pregunta;
  escuchar([{ archivo: audioPregunta(t.id), texto: p.en }, ...p.opciones.map((o) => ({ archivo: audioOpcion(t.id, o.k), texto: o.en }))]);
}
function oirPalabra(id) {
  const w = palabraDe(id || partida.m.palabras[partida.palabra].id);
  escuchar([{ archivo: audioPalabra(w.id), texto: w.en }]);
}

function cabecera() {
  const p = partida;
  return `<div class="cab"><span class="nivel-mini">Misión ${p.n}: ${esc(p.def.nombre)}</span>
    <ol class="fases">${ETAPAS.map((e, i) => `<li class="${i < p.fase ? "hecha" : ""}${i === p.vista ? " ahora" : ""}">${i < p.fase ? CHECK : i + 1}<span>${e}</span></li>`).join("")}</ol></div>`;
}

function pintar(focoId) {
  if (!partida || partida.modo !== "mision") return;
  const p = partida;
  const previo = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.focoId : null;
  let cuerpo;
  if (p.vista < p.fase) cuerpo = resumenEtapa(p.vista);
  else if (p.fase === 0) cuerpo = combustibleHtml();
  else if (p.fase === 1) cuerpo = viajeHtml();
  else if (p.fase === 2) cuerpo = lunaHtml();
  else cuerpo = "";
  const capa = p.guia ? guiaHtml(p.guia) : p.saliendo ? dialogoSalir() : "";
  mostrar(cabecera() + cuerpo + capa, "juego", p.saliendo ? "seguir" : p.guia ? null : focoId || previo);
}

// Lo que ya hizo en una etapa: solo para mirar. «Seguir» regresa a la etapa en la que va.
function resumenEtapa(e) {
  const p = partida;
  let html;
  if (e === 0) html = `<div class="resumen"><span class="cohete">${svgCohete(3)}</span><p>¡Los 3 tanques están llenos!</p>
    <ul class="lista-textos">${p.m.textos.map((t) => `<li lang="en">${esc(t.en[0])}</li>`).join("")}</ul></div>`;
  else html = `<div class="resumen"><p>Palabras del viaje:</p><ul class="lista-palabras">${p.m.palabras.map((w) => `<li><span class="mini">${dibujo(w.id)}</span><b lang="en">${esc(palabraDe(w.id).en)}</b><small>${esc(palabraDe(w.id).es)}</small></li>`).join("")}</ul></div>`;
  return html + `<div class="menu fila"><button type="button" class="boton grande primario" data-foco="inicial" data-act="volver-etapa">Seguir</button></div>`;
}

// --- 1. Combustible ---

function textoHtml(t, { pistas = [], conVoz = true } = {}) {
  return `<div class="texto" lang="en">${t.en.map((s, k) => `<p class="or${pistas.includes(k) ? " pista-or" : ""}" ${conVoz ? `data-voz="${k}"` : ""}>${esc(s)}${partida.espanol ? `<small lang="es">${esc(t.es[k])}</small>` : ""}</p>`).join("")}</div>`;
}

function combustibleHtml() {
  const p = partida, t = textoActual(), q = t.pregunta, tv = esTv();
  const tanques = `<div class="tanques">${svgCohete(p.llenos)}<small>${p.llenos} de 3</small></div>`;
  const botonesVoz = (oir) => `<div class="fila-botones">
      <button type="button" class="boton chico" data-foco data-foco-id="oir" data-act="${oir}">${ALTAVOZ}Escuchar</button>
      <button type="button" class="boton chico ${p.espanol ? "activo" : ""}" data-foco data-foco-id="espanol" data-act="espanol">${LIBRO}Español</button></div>`;
  if (p.paso === "leer") {
    return `<div class="etapa combustible">${tanques}<div class="tarjeta">
      <p class="pista">${esc(pista("leer", { tv }))}</p>
      <div class="lectura"><span class="dib">${dibujo(t.dibujo)}</span>${textoHtml(t)}</div>
      ${botonesVoz("oir-texto")}
      <button type="button" class="boton grande primario principal" data-foco="inicial" data-foco-id="leido" data-act="leido">Ya lo leí</button>
    </div></div>`;
  }
  const marcar = p.fallos > 0 || p.verTexto;
  const ops = q.opciones.map((o, k) => {
    const cls = p.resuelta ? (k === q.buena ? " bien" : " apagada") : p.descartadas.includes(k) ? " mal" : "";
    return `<button type="button" class="op op-texto${cls}" lang="en" data-voz="${k + 1}" data-foco${k === 0 ? '="inicial"' : ""} data-foco-id="op-${k}" data-act="op" data-k="${k}" ${p.resuelta || p.descartadas.includes(k) ? "disabled" : ""}>${esc(o.en)}</button>`;
  }).join("");
  const ayuda = p.fallos === 1 && !p.resuelta
    ? (q.tipo === "dato" ? "Pista: la respuesta está en la oración marcada." : "Pista: ¿de qué hablan casi todas las oraciones?")
    : p.resuelta && p.fallos >= 2 ? `La respuesta es: ${q.opciones[q.buena].en}` : p.resuelta ? "¡Bien! Tanque lleno." : pista("pregunta", { tv });
  return `<div class="etapa combustible">${tanques}<div class="tarjeta">
    <p class="pregunta" lang="en" data-voz="0">${esc(q.en)}${p.espanol ? `<small lang="es">${esc(q.es)}</small>` : ""}</p>
    <div class="opciones lista">${ops}</div>
    <p class="aviso ${p.resuelta && p.fallos === 0 ? "ok" : ""}">${esc(ayuda)}</p>
    ${p.resuelta && p.fallos > 0 ? `<button type="button" class="boton grande primario" data-foco="inicial" data-foco-id="seguir-texto" data-act="seguir-texto">Seguir</button>` : ""}
    ${botonesVoz("oir-pregunta")}
    ${marcar ? textoHtml(t, { pistas: p.fallos ? q.pista : [], conVoz: false }) : `<button type="button" class="boton chico" data-foco data-foco-id="ver-texto" data-act="ver-texto">${OJO}Ver el texto</button>`}
  </div></div>`;
}

function responderTexto(k) {
  const p = partida, q = textoActual().pregunta;
  if (p.resuelta || p.descartadas.includes(k)) return;
  callar();
  if (k === q.buena) {
    p.resuelta = true;
    p.llenos++;
    if (p.fallos === 0) p.aciertos++;
    bien();
    pintar();
    if (p.fallos === 0) { const t = ++token; setTimeout(() => { if (t === token) siguienteTexto(); }, 1300); }
    return;
  }
  clic();
  p.fallos++;
  p.descartadas.push(k);
  if (p.fallos >= 2) { p.resuelta = true; p.llenos++; }
  pintar(p.resuelta ? "seguir-texto" : null);
}

function siguienteTexto() {
  const p = partida;
  if (!p || p.fase !== 0) return;
  if (p.texto < p.m.textos.length - 1) {
    Object.assign(p, { texto: p.texto + 1, paso: "leer", fallos: 0, descartadas: [], resuelta: false, verTexto: false, espanol: false });
    pintar("leido");
    leerSolo();
    return;
  }
  p.fase = 1; p.vista = 1; p.despegando = true;
  abrirGuia("viaje");
  pintar();
  if (!p.guia) arrancarDespegue();
}

// --- 2. Despegue y viaje ---

function arrancarDespegue() {
  const t = ++token;
  despegue();
  setTimeout(() => { if (t === token && partida && partida.despegando) terminarDespegue(); }, reducido() ? 900 : 2600);
}

function terminarDespegue() {
  partida.despegando = false;
  pintar();
  leerSolo();
}

function palabraHtml(it, elegida, respondida, act, descartadas = []) {
  const w = palabraDe(it.id);
  return `<div class="palabra-tarjeta"><b lang="en" class="palabra" data-voz="0">${esc(w.en)}</b>
      <button type="button" class="boton chico" data-foco data-foco-id="oir" data-act="oir-palabra" data-id="${it.id}">${ALTAVOZ}Escuchar</button></div>
    <div class="opciones tres dibujos">${it.opciones.map((id, k) => {
      const buena = id === it.id;
      const cls = respondida ? (buena ? " bien" : k === elegida ? " mal" : " apagada") : descartadas.includes(k) ? " mal" : "";
      return `<button type="button" class="op op-dibujo${cls}" data-foco${k === 0 ? '="inicial"' : ""} data-foco-id="op-${k}" data-act="${act}" data-k="${k}" aria-label="Dibujo ${k + 1}" ${respondida || descartadas.includes(k) ? "disabled" : ""}>${dibujo(id)}</button>`;
    }).join("")}</div>`;
}

function viajeHtml() {
  const p = partida;
  if (p.despegando) {
    return `<div class="etapa despegue ${reducido() ? "quieto" : ""}">
      <div class="cielo">${dibujo("rocket")}</div>
      <p class="cuenta">3, 2, 1… ¡Despegue!</p>
      <button type="button" class="boton grande primario" data-foco="inicial" data-act="saltar-despegue">Seguir</button></div>`;
  }
  const it = p.m.palabras[p.palabra];
  const w = palabraDe(it.id);
  const avance = `<div class="ruta">${dibujo("earth")}<span class="camino">${p.m.palabras.map((_, k) => `<i class="${k < p.palabra || (k === p.palabra && p.resueltaP) ? "hecho" : k === p.palabra ? "ahora" : ""}"></i>`).join("")}</span>${dibujo("moon")}</div>`;
  const aviso = p.resueltaP ? (p.fallosP === 0 ? `¡Bien! ${w.en} = ${w.es}` : `${w.en} = ${w.es}`) : p.fallosP ? "Casi. Prueba otro dibujo." : pista("palabra", { tv: esTv() });
  return `<div class="etapa viaje">${avance}
    <p class="sub">Palabra espacial ${p.palabra + 1} de ${p.m.palabras.length}</p>
    ${palabraHtml(it, null, p.resueltaP, "palabra-op", p.descartadasP)}
    <p class="aviso ${p.resueltaP && p.fallosP === 0 ? "ok" : ""}">${esc(aviso)}</p>
    ${p.resueltaP && p.fallosP > 0 ? '<button type="button" class="boton grande primario" data-foco="inicial" data-foco-id="seguir-palabra" data-act="seguir-palabra">Seguir</button>' : ""}
  </div>`;
}

function responderPalabra(k) {
  const p = partida, it = p.m.palabras[p.palabra];
  if (p.resueltaP || p.descartadasP.includes(k)) return;
  callar();
  if (it.opciones[k] === it.id) {
    p.resueltaP = true;
    const primera = p.fallosP === 0;
    if (primera) p.aciertos++;
    const r = anotarPalabra(pr, it.id, primera);
    pr = r.pr;
    if (r.roca) p.rocas.push(it.id);
    guardar();
    bien();
    pintar();
    oirPalabra(it.id);
    if (primera) { const t = ++token; setTimeout(() => { if (t === token) siguientePalabra(); }, 1500); }
    return;
  }
  clic();
  p.fallosP++;
  p.descartadasP.push(k);
  if (p.fallosP >= 2) {
    p.resueltaP = true;
    pr = anotarPalabra(pr, it.id, false).pr;
    guardar();
  }
  pintar(p.resueltaP ? "seguir-palabra" : null);
}

function siguientePalabra() {
  const p = partida;
  if (!p || p.fase !== 1) return;
  if (p.palabra < p.m.palabras.length - 1) {
    Object.assign(p, { palabra: p.palabra + 1, fallosP: 0, descartadasP: [], resueltaP: false });
    pintar("op-0");
    leerSolo();
    return;
  }
  p.fase = 2; p.vista = 2;
  abrirGuia(p.m.luna.tipo);
  pintar();
}

// --- 3. En la Luna ---

function lunaHtml() {
  const p = partida, L = p.m.luna, tv = esTv();
  const ayuda = p.modelo ? tiraFases(L.total) : "";
  const fin = p.resueltaL ? `<button type="button" class="boton grande primario" data-foco="inicial" data-foco-id="terminar" data-act="terminar-mision">¡Juntar las rocas!</button>` : "";
  if (L.tipo === "noche") {
    const salto = L.semanas === 2 ? "en dos semanas" : "en una semana";
    const ops = L.opciones.map((f, k) => {
      const cls = p.resueltaL ? (f === L.correcta ? " bien" : k === p.elegidaL ? " mal" : " apagada") : p.marcadas.includes(k) ? " mal" : "";
      return `<button type="button" class="op op-fase${cls}" data-foco${k === 0 ? '="inicial"' : ""} data-foco-id="op-${k}" data-act="noche-op" data-k="${k}" ${p.resueltaL || p.marcadas.includes(k) ? "disabled" : ""}>${svgFase(f, faseDe(f).es)}${p.resueltaL ? `<small lang="en">${esc(faseDe(f).en)}</small>` : ""}</button>`;
    }).join("");
    const aviso = p.resueltaL ? (p.fallosL === 0 ? "¡Bien!" : `Se verá así: ${faseDe(L.correcta).es}.`) : p.fallosL ? AYUDA_FASES : pista("noche", { tv });
    return `<div class="etapa luna">
      <p class="pedido">Hoy la Luna se ve así:</p>
      <div class="muestra">${tarjetaFase(L.hoy, { nombre: true, clase: "grande" })}</div>
      <p class="pedido">¿Cómo se verá ${salto}?</p>
      <div class="opciones tres">${ops}</div>
      <p class="aviso ${p.resueltaL && p.fallosL === 0 ? "ok" : ""}">${esc(aviso)}</p>${fin}${ayuda}</div>`;
  }
  const dias = L.dias.map((d, i) => {
    const puesta = p.colocadas[i];
    const marcada = p.marcadas.includes(i);
    const contenido = d.fijo ? svgFase(d.fase, faseDe(d.fase).es) : puesta != null ? svgFase(puesta, faseDe(puesta).es) : '<span class="vacio"></span>';
    const attrs = d.fijo || p.resueltaL ? "disabled" : `data-foco data-foco-id="dia-${i}" data-act="dia" data-i="${i}"`;
    return `<button type="button" class="dia-cal ${d.fijo ? "fijo" : "hueco"}${marcada ? " marcada" : ""}${puesta != null && !d.fijo ? " puesta" : ""}" ${attrs}><small>Día ${d.dia}</small>${contenido}</button>`;
  }).join("");
  const bandeja = p.bandeja.map((f, k) => `<button type="button" class="carta${p.tomada === k ? " tomada" : ""}" data-foco${k === 0 && !p.resueltaL ? '="inicial"' : ""} data-foco-id="carta-${k}" data-act="carta" data-k="${k}" ${p.resueltaL ? "disabled" : ""}>${svgFase(f, faseDe(f).es)}</button>`).join("");
  const aviso = p.resueltaL ? (p.fallosL === 0 ? "¡Bien! El calendario está completo." : "Así va el calendario.") : p.aviso || (p.fallosL ? AYUDA_FASES : pista("calendario", { tv, tomada: p.tomada != null }));
  return `<div class="etapa luna">
    <p class="pedido">Calendario de la Luna</p>
    <div class="calendario c${L.total}">${dias}</div>
    ${p.resueltaL ? "" : `<div class="bandeja" aria-label="Lunas para acomodar">${bandeja || '<span class="sub">Ya pusiste todas.</span>'}</div>`}
    <p class="aviso ${p.resueltaL && p.fallosL === 0 ? "ok" : ""}">${esc(aviso)}</p>
    ${p.resueltaL ? fin : '<button type="button" class="boton grande primario principal" data-foco data-foco-id="listo" data-act="listo-cal">Listo</button>'}
    ${ayuda}</div>`;
}

function tocarCarta(k) {
  const p = partida;
  p.tomada = p.tomada === k ? null : k;
  p.aviso = "";
  clic();
  // En la TV, con la luna tomada, el foco va al primer día vacío
  const vacio = p.m.luna.dias.findIndex((d, i) => !d.fijo && p.colocadas[i] == null);
  pintar(p.tomada != null && vacio >= 0 ? `dia-${vacio}` : `carta-${Math.min(k, p.bandeja.length - 1)}`);
}

function tocarDia(i) {
  const p = partida;
  p.aviso = "";
  p.marcadas = p.marcadas.filter((x) => x !== i);
  if (p.tomada != null) {
    const f = p.bandeja[p.tomada];
    p.bandeja.splice(p.tomada, 1);
    if (p.colocadas[i] != null) p.bandeja.push(p.colocadas[i]);
    p.colocadas[i] = f;
    p.tomada = null;
    clic();
    const vacio = p.m.luna.dias.findIndex((d, j) => !d.fijo && p.colocadas[j] == null);
    pintar(p.bandeja.length ? "carta-0" : vacio < 0 ? "listo" : `dia-${i}`);
    return;
  }
  if (p.colocadas[i] != null) {          // sin luna en la mano: la regresa a la bandeja y la toma
    p.bandeja.push(p.colocadas[i]);
    delete p.colocadas[i];
    p.tomada = p.bandeja.length - 1;
    clic();
    pintar(`dia-${i}`);
    return;
  }
  p.aviso = esTv() ? "Primero elige una luna de abajo." : "Primero toca una luna de abajo.";
  pintar(`dia-${i}`);
}

function listoCalendario() {
  const p = partida, L = p.m.luna;
  if (!calendarioCompleto(L, p.colocadas)) {
    p.aviso = "Todavía hay días vacíos.";
    pintar("listo");
    return;
  }
  const mal = revisarCalendario(L, p.colocadas);
  if (!mal.length) {
    p.resueltaL = true;
    if (p.fallosL === 0) p.aciertos++;
    sonidoListo();
    pintar("terminar");
    return;
  }
  clic();
  p.fallosL++;
  p.modelo = true;
  if (p.fallosL >= 2) {
    L.dias.forEach((d, i) => { if (!d.fijo) p.colocadas[i] = d.fase; });
    p.bandeja = [];
    p.marcadas = mal;
    p.resueltaL = true;
    pintar("terminar");
    return;
  }
  // Las que están mal regresan a la bandeja y su día queda marcado
  for (const i of mal) { p.bandeja.push(p.colocadas[i]); delete p.colocadas[i]; }
  p.marcadas = mal;
  p.tomada = null;
  pintar("carta-0");
}

function responderNoche(k) {
  const p = partida, L = p.m.luna;
  if (p.resueltaL || p.marcadas.includes(k)) return;
  if (L.opciones[k] === L.correcta) {
    p.resueltaL = true;
    p.elegidaL = k;
    if (p.fallosL === 0) p.aciertos++;
    sonidoListo();
    pintar("terminar");
    return;
  }
  clic();
  p.fallosL++;
  p.marcadas.push(k);
  p.modelo = true;
  if (p.fallosL >= 2) { p.resueltaL = true; p.elegidaL = k; }
  pintar(p.resueltaL ? "terminar" : null);
}

// --- Fin de la misión ---

function terminarMision() {
  const p = partida;
  callar();
  const est = estrellasMision(p.aciertos);
  const r = cerrarMision(pr, p.n, est, total());
  pr = anotarDia(r.pr, hoy(), true);
  guardar();
  Noli.terminar({ estrellas: est });
  if (est >= 2) sonidoListo();
  const foto = p.def.foto;
  const siguiente = p.n < total() && p.n + 1 <= pr.abierta ? p.n + 1 : null;
  const n = p.n;
  const rocas = p.rocas;
  partida = null;
  mostrar(`
    <h1 class="titulo">¡Misión cumplida!</h1>
    <p class="grande-estrellas">${estrellasHtml(est)}</p>
    <p class="sub">${p.aciertos} de ${ITEMS} a la primera</p>
    ${r.abrio ? `<p class="aviso ok">¡Se abrió la misión ${r.abrio}: ${esc(defMision(r.abrio).nombre)}!</p>` : n === pr.abierta && n < total() ? `<p class="aviso">Con ${PARA_ABRIR} estrellas se abre la misión ${n + 1}.</p>` : ""}
    <div class="premios">
      ${rocas.map((id) => `<div class="premio"><span class="roca-dib">${dibujo(id)}</span><b lang="en">${esc(palabraDe(id).en)}</b><small>Roca nueva</small></div>`).join("")}
      ${r.foto ? `<div class="premio foto">${dibujo(foto.dibujo, foto.titulo)}<b>${esc(foto.titulo)}</b><small>Foto nueva</small></div>` : ""}
    </div>
    ${!rocas.length && !r.foto ? '<p class="sub">Las palabras que fallaste regresan en la próxima misión. ¡A la primera traen su roca!</p>' : ""}
    <div class="menu fila">
      ${siguiente ? `<button class="boton grande primario" data-foco="inicial" data-act="mision" data-n="${siguiente}">Misión ${siguiente}</button>` : ""}
      <button class="boton grande ${siguiente ? "" : "primario"}" data-foco${siguiente ? "" : '="inicial"'} data-act="mision" data-n="${n}">Otra vez</button>
      <button class="boton grande" data-foco data-act="museo">Museo</button>
      <button class="boton grande" data-foco data-act="a-inicio">Al inicio</button>
    </div>`, "fin");
}

// ---------- Atrás ----------

function atrasEnMision() {
  const p = partida;
  callar();
  if (p.guia) { cerrarGuia(); return; }
  if (p.saliendo) { p.saliendo = false; pintar(); return; }
  if (p.espanol && p.fase === 0 && p.vista === 0) { p.espanol = false; pintar("espanol"); return; }
  if (p.tomada != null) { p.tomada = null; pintar(); return; }
  if (p.vista > 0) { token++; p.vista--; pintar(); return; }
  p.saliendo = true;
  pintar();
}

// ---------- Toques ----------

$main.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (!b || b.disabled || !pr) return;
  const act = b.dataset.act;
  const k = +b.dataset.k;
  switch (act) {
    case "jugar": empezarMision(Math.min(pr.elegida || pr.abierta, pr.abierta)); break;
    case "mision": empezarMision(+b.dataset.n); break;
    case "reto": retoIntro(); break;
    case "reto-jugar": empezarReto(); break;
    case "museo": museo(); break;
    case "misiones": misiones(); break;
    case "como": como(); break;
    case "papas": papas(); break;
    case "a-inicio": inicio(); break;
    case "voz": pr = { ...pr, voz: !pr.voz }; guardar(); if (!pr.voz) callar(); inicio("voz"); break;
    case "lectura": pr = { ...pr, lectura: b.dataset.k }; guardar(); papas(); break;
    case "guia-otra": pr = { ...pr, vistos: {} }; guardar(); inicio(); break;
    case "elegir": pr = { ...pr, elegida: +b.dataset.n }; guardar(); inicio(); break;
    case "oir-roca": oirPalabra(b.dataset.id); break;
    case "guia-ok": cerrarGuia(); break;
    case "seguir": partida.saliendo = false; partida.modo === "reto" ? pintarReto() : (pintar(), leerSolo()); break;
    case "salir-menu": callar(); inicio(); break;
    case "volver-etapa": partida.vista = partida.fase; pintar(); break;
    case "oir-texto": oirTexto(); break;
    case "oir-pregunta": oirPregunta(); break;
    case "oir-palabra": oirPalabra(b.dataset.id); break;
    case "espanol": partida.espanol = !partida.espanol; pintar("espanol"); break;
    case "ver-texto": partida.verTexto = true; pintar("op-0"); break;
    case "leido": callar(); partida.paso = "pregunta"; pintar("op-0"); leerSolo(); break;
    case "op": responderTexto(k); break;
    case "seguir-texto": siguienteTexto(); break;
    case "saltar-despegue": token++; terminarDespegue(); break;
    case "palabra-op": responderPalabra(k); break;
    case "seguir-palabra": siguientePalabra(); break;
    case "carta": tocarCarta(k); break;
    case "dia": tocarDia(+b.dataset.i); break;
    case "listo-cal": listoCalendario(); break;
    case "noche-op": responderNoche(k); break;
    case "terminar-mision": terminarMision(); break;
    case "reto-op": responderReto(k); break;
    case "reto-oir": {
      const it = partida.reto.items[partida.i];
      escuchar(it.opciones.map((f) => ({ archivo: audioFase(f), texto: faseDe(f).en })));
      break;
    }
    case "reto-seguir": seguirReto(); break;
    default: break;
  }
});

Noli.alEntrar((accion) => {
  document.documentElement.classList.add("teclado");
  desbloquearVoz();
  desbloquearSonido();
  if (pantalla === "juego" && partida && accion === "atras") {
    if (partida.modo === "mision") atrasEnMision();
    else { partida.saliendo = !partida.saliendo; pintarReto(); }
    return true;
  }
  if (moverFoco(accion, zonaFoco())) return true;
  if (accion === "ok") {
    const e = document.activeElement;
    if (e && zonaFoco().contains(e) && !e.disabled) e.click();
    else enfocarPrimero(zonaFoco());
    return true;
  }
  if (accion === "atras") {
    if (pantalla === "inicio" || pantalla === "cargando") return false;
    if (pantalla === "papas") { misiones(); return true; }
    inicio();
    return true;
  }
  return true;
});

document.addEventListener("pointerdown", () => {
  if (!esTv()) document.documentElement.classList.remove("teclado");
  desbloquearVoz();
  desbloquearSonido();
}, true);

Promise.all([Noli.datos, cargarDatos()]).then(([d, ds]) => {
  datos = ds;
  pr = cargar(d, ds.misiones.misiones.length);
  if (esTv()) document.documentElement.classList.add("teclado");
  inicio();
}).catch((e) => {
  $main.innerHTML = `<p class="cargando">No se pudo abrir Misión Luna. ${esc(e && e.message)}</p>`;
});
