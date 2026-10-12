// Pantallas del Safari de Datos. La lógica está en los otros módulos (puros, con pruebas).
// Una visita: 1) Contar cada recinto, 2) Gráfica (armarla, o arreglarla en Detective), 3) Preguntas del cuidador.
// Atrás regresa a la fase anterior (solo para mirar); en la primera abre «¿Salir?».
import { Noli, moverFoco, focoInicial } from "../../../kit/noli.js";
import { decir, callar } from "./voz.js";
import { clic, zumba, listo as sonidoListo, bien, desbloquear } from "./sonido.js";
import { ANIMALES, abiertos, animal, siguiente, cuantosPara } from "./animales.js";
import { NIVELES, nivel, crearVisita, opcionesConteo } from "./niveles.js";
import { vacia, mover, errores, marcas } from "./grafica.js";
import { respuesta, explicacion } from "./preguntas.js";
import { acomodar } from "./recinto.js";
import { visitaGuia, textoPaso } from "./guia.js";
import { retoDelDia } from "./reto.js";
import {
  cargar, registrar, anotarDia, dominio, cerrarVisita, marcarGuia, ponerVoz, fechaLocal, cumplirReto, racha, semana,
  resumen, nivelDe, VENTANA, PARA_SUBIR,
} from "./progreso.js";
import {
  svgAnimal, svgCuidador, svgComida, PAUSA, PLAY, FLAMA, CHECK, CANDADO, MAS, MENOS, ARRIBA, ABAJO, LUPA, estrellasHtml,
} from "./arte.js";

const $main = document.getElementById("juego");
const rnd = Math.random;
const hoy = () => fechaLocal();
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const reducido = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

try {
  if (new URLSearchParams(location.search).get("modo") === "tv") document.documentElement.dataset.modo = "tv";
  if (window.parent && window.parent !== window) document.documentElement.classList.add("en-catalogo");
} catch { /* abierto fuera del navegador */ }

const esTv = () => document.documentElement.dataset.modo === "tv" || Noli.modo === "tv";

const FASES = ["contar", "grafica", "preguntas"];
const NOMBRE_FASE = { contar: "Contar", grafica: "Gráfica", preguntas: "Preguntas" };
const COLORES = ["#ff8a5b", "#4cb3ff", "#9b6bff", "#3ccf8e"];

let pr;
let pantalla = "inicio";
let partida = null;
let avisoInicio = "";
let token = 0;

const guardar = () => Noli.guardar(pr);
const hablar = (texto) => { if (pr && pr.voz) decir(texto); };

function mostrar(html, nombre, focoId) {
  pantalla = nombre;
  $main.className = "p-" + nombre;
  $main.innerHTML = html;
  if (esTv()) document.documentElement.classList.add("teclado");
  const pedido = focoId && $main.querySelector(`[data-foco-id="${focoId}"]`);
  if (pedido && !pedido.disabled) pedido.focus({ preventScroll: true });
  else focoInicial($main);
}

const poolAbierto = () => abiertos(pr.zoo).map((a) => a.id);
const nivelElegido = () => Math.min(pr.elegido || pr.nivel, pr.nivel);

// ---------- Pedazos de dibujo ----------

const DIAS = ["D", "L", "M", "M", "J", "V", "S"];
function semanaHtml() {
  return `<div class="semana" aria-label="Últimos 7 días">${semana(pr, hoy()).map((d) => {
    const [y, m, dd] = d.fecha.split("-").map(Number);
    return `<span class="dia ${d.reto ? "reto" : d.jugo ? "jugo" : ""}"><span class="punto">${d.reto ? CHECK : ""}</span>${DIAS[new Date(y, m - 1, dd).getDay()]}</span>`;
  }).join("")}</div>`;
}
function textoRacha() {
  const r = racha(pr, hoy());
  return r ? `Racha: ${r} ${r === 1 ? "día" : "días"}` : "Cumple el reto de hoy para empezar una racha";
}
const rachaHtml = (grande) => `<p class="racha${grande ? " grande" : ""}">${FLAMA}<span>${esc(textoRacha())}</span></p>`;

function tiraZoo() {
  return `<div class="tira-zoo" aria-label="Tus animales">${abiertos(pr.zoo).map((a) => `<span class="mini">${svgAnimal(a.id, a.nombre)}</span>`).join("")}</div>`;
}

function dialogoSalir() {
  return `<div class="velo"><div class="dialogo" role="dialog" aria-label="Salir">
    <p>¿Salir?</p>
    <button type="button" class="boton grande primario" data-foco="inicial" data-foco-id="seguir" data-act="seguir">Seguir</button>
    <button type="button" class="boton grande" data-foco data-foco-id="salir" data-act="salir-menu">Salir</button>
  </div></div>`;
}

// ---------- Menús ----------

function inicio(focoId) {
  partida = null;
  token++;
  callar();
  const n = nivelElegido();
  const dn = nivel(n);
  const dm = dominio(pr, n);
  const reto = pr.retos[hoy()];
  const tipoReto = retoDelDia(hoy(), poolAbierto()).nombre;
  mostrar(`
    <h1 class="titulo">Safari de Datos</h1>
    ${tiraZoo()}
    <p class="sub">Nivel ${n}: ${esc(dn.nombre)}</p>
    ${avisoInicio ? `<p class="aviso">${esc(avisoInicio)}</p>` : ""}
    ${dm.listo || nivelDe(pr, n).dominado ? `<p class="dominio ok">¡Ya dominas este nivel!</p>` : `<div class="dominio"><div class="barra"><i style="width:${Math.min(100, Math.round((100 * dm.intentos) / VENTANA))}%"></i></div><small>${dm.intentos} de ${VENTANA} preguntas para ver si subes</small></div>`}
    <div class="menu menu-inicio">
      <button class="boton grande primario principal" data-foco="inicial" data-foco-id="jugar" data-act="jugar">Visitar el zoológico</button>
      <button class="boton grande ${reto?.cumplido ? "hecho" : "reto"}" data-foco data-foco-id="reto" data-act="reto">Reto del día <small>${reto?.cumplido ? "Cumplido" : esc(tipoReto)}</small></button>
      <button class="boton grande" data-foco data-foco-id="zoo" data-act="zoo">Mi zoológico <small>${abiertos(pr.zoo).length} de ${ANIMALES.length} animales</small></button>
      <button class="boton grande" data-foco data-foco-id="progreso" data-act="progreso">Mi progreso</button>
      <button class="boton grande" data-foco data-foco-id="como" data-act="como">¿Cómo se juega?</button>
      <button class="boton grande" data-foco data-foco-id="voz" data-act="voz">Voz: ${pr.voz ? "sí" : "no"}</button>
    </div>
    ${rachaHtml()}`, "inicio", focoId || "jugar");
  avisoInicio = "";
}

function zoo() {
  const prox = siguiente(pr.zoo);
  const abiertosIds = new Set(abiertos(pr.zoo).map((a) => a.id));
  mostrar(`
    <h1 class="titulo">Mi zoológico</h1>
    <p class="sub">${abiertosIds.size} de ${ANIMALES.length} animales. ${prox ? "Cada visita con 2 o 3 estrellas trae uno nuevo." : "¡Ya tienes a todos!"}</p>
    <ul class="zoo">${ANIMALES.map((a) => {
      const tiene = abiertosIds.has(a.id);
      return `<li class="${tiene ? "" : "cerrado"}${prox && prox.id === a.id ? " proximo" : ""}">
        ${tiene ? svgAnimal(a.id, a.nombre) : `<span class="sombra">${svgAnimal(a.id, "?")}</span>`}
        <b>${tiene ? esc(a.nombre) : prox && prox.id === a.id ? "El próximo" : "?"}</b>
        <small lang="en">${tiene ? esc(a.en) : ""}</small></li>`;
    }).join("")}</ul>
    <div class="menu fila"><button type="button" class="boton grande" data-foco="inicial" data-act="a-inicio">Regresar</button></div>`, "zoo");
}

function progreso() {
  mostrar(`
    <h1 class="titulo">Mi progreso</h1>
    ${rachaHtml()}
    ${semanaHtml()}
    <ol class="mapa">${NIVELES.map((x) => {
      const abierto = x.n <= pr.nivel;
      const nv = nivelDe(pr, x.n);
      const dm = dominio(pr, x.n);
      const estado = nv.dominado ? estrellasHtml(nv.estrellas || 0) : abierto ? `<span>${dm.aciertos}/${PARA_SUBIR}</span>` : CANDADO;
      const actual = x.n === nivelElegido();
      return `<li><button type="button" class="nivel ${nv.dominado ? "dominado" : abierto ? "abierto" : "cerrado"}${actual ? " actual" : ""}" ${abierto ? `data-foco${actual ? '="inicial"' : ""} data-act="elegir" data-n="${x.n}"` : "disabled"}>
        <b class="num">${x.n}</b><span class="nom">${esc(x.nombre)}<small>${esc(x.ejemplo)}</small></span>${estado}</button></li>`;
    }).join("")}</ol>
    <div class="menu fila">
      <button type="button" class="boton" data-foco data-act="a-inicio">El zoológico</button>
      <button type="button" class="boton" data-foco data-act="papas">Para papás</button>
    </div>`, "progreso");
}

function papas() {
  mostrar(`
    <h1 class="titulo">Para papás</h1>
    <p class="nota">Unidad «Data» de 2.º grado (Khan Academy): juntar datos, gráficas de dibujos y de barras, y preguntas de juntar, separar y comparar. Una visita: contar los recintos, armar la gráfica y contestar 3 preguntas leyéndola. Sube con ${PARA_SUBIR} de las últimas ${VENTANA} preguntas bien a la primera (en Detective también cuenta arreglar la gráfica). Los errores no castigan: primero una pista, luego se enseña cómo se lee. Cada visita con 2 o 3 estrellas abre un animal, en orden fijo. Reto del día sin reloj: Censo (muchos animales) o Detective (2 errores en la gráfica).</p>
    <table class="tabla"><thead><tr><th>Nivel</th><th>Preguntas</th><th>A la primera</th><th></th></tr></thead><tbody>
      ${resumen(pr).filter((x) => x.abierto || x.total).map((x) => `<tr><td>${x.n}. ${esc(x.nombre)}</td><td>${x.total}</td><td>${x.pct == null ? "–" : x.pct + " %"}</td><td>${x.dominado ? "Dominado" : ""}</td></tr>`).join("")}
    </tbody></table>
    <div class="menu fila"><button type="button" class="boton" data-foco="inicial" data-act="progreso">Regresar</button></div>`, "papas");
}

function retoIntro() {
  const reto = retoDelDia(hoy(), poolAbierto());
  const hecho = pr.retos[hoy()];
  mostrar(`
    <h1 class="titulo">Reto del día</h1>
    <div class="tarjeta-reto">
      <b>${reto.tipo === "detective" ? LUPA : ""}${esc(reto.nombre)}</b>
      <p>${esc(reto.meta)}</p>
      ${hecho ? `<p>${hecho.cumplido ? "¡Ya lo cumpliste hoy! Puedes jugarlo otra vez." : "Hoy todavía no. ¡Inténtalo otra vez!"}</p>` : ""}
    </div>
    <div class="menu fila">
      <button class="boton grande primario" data-foco="inicial" data-act="reto-jugar">¡Empezar!</button>
      <button class="boton grande" data-foco data-act="a-inicio">Regresar</button>
    </div>
    ${rachaHtml()}
    ${semanaHtml()}`, "reto");
}

// ---------- La visita ----------

function nuevaPartida(modo, visita, extra = {}) {
  token++;
  partida = {
    modo, visita, cats: visita.animales.map(animal), ...extra,
    fase: "contar", vista: "contar",
    recinto: 0, acomodos: visita.cuentas.map((c) => acomodar(c, rnd, visita.escala === 2)),
    quietos: reducido(), opciones: null, fallosConteo: 0, verNumeros: false, conteoBien: false, conteosPrimera: 0,
    valores: visita.detective ? [...visita.detective.inicial] : vacia(visita.cuentas.length),
    fallosGrafica: 0, marcadas: [], graficaPrimera: null,
    pregunta: 0, fallosPregunta: 0, descartadas: [], explicando: false, acerto: null, aciertos: 0,
    aviso: "", espera: false, saliendo: false,
  };
  prepararConteo();
  pintar();
  decirPedido();
}

function empezarVisita() {
  const n = nivelElegido();
  nuevaPartida("visita", crearVisita(n, rnd, { pool: poolAbierto() }));
}

function empezarReto() {
  const reto = retoDelDia(hoy(), poolAbierto());
  nuevaPartida("reto", reto.visita, { reto });
}

function empezarGuia() {
  nuevaPartida("guia", visitaGuia());
}

const guia = () => partida && partida.modo === "guia";

function prepararConteo() {
  const p = partida;
  p.opciones = opcionesConteo(p.visita.cuentas[p.recinto], p.visita.escala, rnd);
  p.fallosConteo = 0;
  p.verNumeros = false;
  p.conteoBien = false;
  p.descartadas = [];
  p.aviso = "";
}

function preguntaActual() {
  return partida.visita.preguntas[partida.pregunta];
}

function decirPedido() {
  const p = partida;
  if (!p) return;
  if (p.fase === "contar") {
    const a = p.cats[p.recinto];
    hablar(`¿${cuantosPara([a])} ${a.plural} hay?`);
  } else if (p.fase === "grafica") {
    hablar(p.visita.detective ? "Detective: revisa la gráfica." : "Ahora haz la gráfica con lo que contaste.");
  } else if (p.fase === "preguntas") {
    hablar(preguntaActual().leer);
  }
}

// ---------- Dibujar la visita ----------

function cabecera() {
  const p = partida;
  const titulo = guia() ? "Guía" : p.modo === "reto" ? p.reto.nombre : nivel(p.visita.nivel).corto;
  const iFase = FASES.indexOf(p.fase);
  // Solo la fase que se ve dice su nombre; las otras son su número (cabe junto a la casita del catálogo).
  const pasos = FASES.map((f, i) => `<li class="${i < iFase ? "hecha" : ""}${f === p.vista ? " ahora" : ""}" aria-label="${NOMBRE_FASE[f]}"><b>${i + 1}</b><span>${NOMBRE_FASE[f]}</span></li>`).join("");
  const saltar = guia() ? `<button type="button" class="boton saltar" tabindex="-1" data-act="saltar-guia">Saltar</button>` : "";
  return `<div class="cab">${saltar}<span class="nivel-mini">${esc(titulo)}</span><ol class="fases" aria-label="Fases">${pasos}</ol></div>`;
}

function burbuja(pedido, linea, feliz) {
  return `<div class="encargo">
    <span class="cuidador">${svgCuidador(feliz)}</span>
    <div class="burbuja"><p class="pedido">${pedido}</p>${linea ? `<p class="pista">${esc(linea)}</p>` : ""}</div>
  </div>`;
}

function htmlRecinto(i, numeros, chico) {
  const p = partida;
  const a = p.cats[i];
  const ac = p.acomodos[i];
  const pares = p.visita.escala === 2;
  let k = 0;
  const grupos = ac.grupos.map((g) => {
    let dentro = "";
    for (let j = 0; j < g.animales; j++) {
      k++;
      dentro += `<span class="ani">${svgAnimal(a.id, a.nombre)}${numeros && !pares ? `<b class="num">${k}</b>` : ""}</span>`;
    }
    const num = numeros && pares ? `<b class="num">${k}</b>` : "";
    const cuerpo = g.animales > 1 ? `<span class="pareja">${dentro}${num}</span>` : dentro;
    return `<span class="grupo${g.espejo ? " espejo" : ""}" style="grid-column:${g.col + 1};grid-row:${g.fila + 1};--dx:${g.dx};--dy:${g.dy};--dur:${g.dur}s;--retraso:${g.retraso}s">${cuerpo}</span>`;
  }).join("");
  return `<div class="recinto${p.quietos || numeros ? " quietos" : ""}${chico ? " chico" : ""}" style="--fondo:${a.fondo};--cols:${ac.cols};--filas:${ac.filas}" role="img" aria-label="Recinto de ${esc(a.plural)}">
    <span class="letrero">${esc(cap(a.plural))} <small lang="en">${esc(a.enPlural)}</small></span>
    <div class="campo">${grupos}</div>
    ${p.conteoBien && !chico ? `<span class="cuenta-ok">${p.visita.cuentas[i]}</span>` : ""}
  </div>`;
}

function pintar(focoId) {
  if (!partida) return;
  const p = partida;
  let html;
  if (p.vista !== p.fase) html = p.vista === "contar" ? vistaConteos() : vistaGrafica();
  else if (p.fase === "contar") html = pantallaContar();
  else if (p.fase === "grafica") html = pantallaGrafica();
  else html = pantallaPreguntas();
  mostrar(`${cabecera()}${html.cuerpo}${p.saliendo ? dialogoSalir() : ""}`, "juego", p.saliendo ? "seguir" : focoId || html.foco);
}

function pantallaContar() {
  const p = partida;
  const a = p.cats[p.recinto];
  const k = p.cats.length;
  const tv = esTv();
  const pares = p.visita.escala === 2;
  let linea = p.aviso;
  if (!linea) {
    if (guia() && !p.quietos && p.recinto === 0) linea = textoPaso("contar", { tv, animal: a }).texto + " " + textoPaso("quietos").texto;
    else if (pares) linea = "Van de 2 en 2: cuenta 2, 4, 6…";
    else if (!p.quietos && !reducido()) linea = textoPaso("quietos").texto;
    else linea = textoPaso("contar", { tv, animal: a }).texto;
  }
  const pedido = `<small>Recinto ${p.recinto + 1} de ${k}</small> ¿${cuantosPara([a])} ${esc(a.plural)} hay?`;
  let controles;
  if (p.verNumeros) {
    controles = `<button type="button" class="boton listo brilla" data-foco="inicial" data-foco-id="seguir-conteo" data-act="seguir-conteo">Seguir</button>`;
  } else {
    const quietos = reducido() ? "" : `<button type="button" class="boton quietos${guia() && !p.quietos ? " con-flecha" : ""}" data-foco data-foco-id="quietos" data-act="quietos" ${p.conteoBien ? "disabled" : ""}>${p.quietos ? `${PLAY}<span>A moverse</span>` : `${PAUSA}<span>Quietos</span>`}</button>`;
    controles = `${quietos}<div class="opciones${guia() && p.quietos ? " con-flecha" : ""}">${p.opciones.map((n, i) => {
      const no = p.descartadas.includes(n);
      const ok = p.conteoBien && n === p.visita.cuentas[p.recinto];
      return `<button type="button" class="opcion${no ? " no" : ""}${ok ? " bien" : ""}" data-foco${i === 0 ? '="inicial"' : ""} data-foco-id="op-${i}" data-act="contar" data-n="${n}" ${no || p.conteoBien ? "disabled" : ""}>${n}</button>`;
    }).join("")}</div>`;
  }
  return {
    cuerpo: `${burbuja(pedido, linea, p.conteoBien)}
      <div class="mesa"><div class="zona-principal">${htmlRecinto(p.recinto, p.verNumeros)}</div><div class="zona-controles">${controles}</div></div>`,
    foco: p.verNumeros ? "seguir-conteo" : guia() && !p.quietos && !reducido() ? "quietos" : "op-0",
  };
}

// La gráfica. editable: con + y − (o ▲ ▼ en la tele). resaltar: columnas que miran las preguntas.
function htmlGrafica({ editable = false, resaltar = [], meta = false } = {}) {
  const p = partida;
  const v = p.visita;
  const k = p.cats.length;
  const pasos = v.max / v.escala;
  const dibujos = v.grafica === "dibujos";
  const tv = esTv();
  const fila = (r, c, extra = "") => `grid-row:${r};grid-column:${c};${extra}`;
  const eje = dibujos ? "" : `<div class="eje" style="${fila(1, 1)}">${marcas(v.escala, v.max).map((m) => `<span style="bottom:${(100 * m) / v.max}%">${m}</span>`).join("")}</div>`;
  let s = `${eje}<div class="lineas" style="${fila(1, "2 / -1")}"></div>`;
  p.cats.forEach((a, i) => {
    const valor = p.valores[i];
    const clases = ["col"];
    if (resaltar.includes(i)) clases.push("resalta");
    if (editable && p.marcadas.includes(i)) clases.push("revisa");
    const attrs = editable ? `tabindex="0" data-foco data-foco-id="col-${i}" data-col="${i}" aria-label="${esc(cap(a.plural))}: ${valor}"` : "";
    const contenido = dibujos
      ? `<div class="pila">${Array.from({ length: valor / v.escala }, () => `<span class="pic">${svgAnimal(a.id, a.nombre)}</span>`).join("")}</div>`
      : `<div class="barra" style="height:${(100 * valor) / v.max}%;background:${COLORES[i % COLORES.length]}"></div>`;
    const objetivo = meta && editable && p.marcadas.includes(i) ? `<div class="objetivo" style="bottom:${(100 * v.cuentas[i]) / v.max}%"><span>${v.cuentas[i]}</span></div>` : "";
    const flechas = editable && tv ? `<span class="flechas-tv" aria-hidden="true"><i>${ARRIBA}</i><i>${ABAJO}</i></span>` : "";
    s += `<div class="${clases.join(" ")}" style="${fila(1, i + 2)}" ${attrs}>${contenido}${objetivo}${flechas}</div>`;
    s += `<div class="pie${resaltar.includes(i) ? " resalta" : ""}" style="${fila(2, i + 2)}">${svgAnimal(a.id, a.nombre)}<span>${esc(cap(a.plural))}</span></div>`;
    if (editable) {
      s += `<div class="conte" style="${fila(3, i + 2)}"><small>contaste</small><b>${v.cuentas[i]}</b></div>`;
      if (!tv) {
        const flecha = guia() && primeraMal() === i ? " con-flecha" : "";
        s += `<div class="pm-par${flecha}" style="${fila(4, i + 2)}">
          <button type="button" class="pm" data-act="subir" data-i="${i}" aria-label="Poner en ${esc(a.plural)}" ${valor >= v.max ? "disabled" : ""}>${MAS}</button>
          <button type="button" class="pm" data-act="bajar" data-i="${i}" aria-label="Quitar en ${esc(a.plural)}" ${valor <= 0 ? "disabled" : ""}>${MENOS}</button>
        </div>`;
      }
    }
  });
  return `<div class="grafica ${dibujos ? "dibujos" : "barras"}${editable ? " editable" : ""}" style="--k:${k};--pasos:${pasos}">${s}</div>`;
}

function primeraMal() {
  const e = errores(partida.valores, partida.visita.cuentas);
  return e.length ? e[0] : -1;
}

function pantallaGrafica() {
  const p = partida;
  const v = p.visita;
  const tv = esTv();
  const mal = primeraMal();
  let linea = p.aviso;
  if (!linea && guia()) {
    linea = mal >= 0 ? textoPaso("grafica", { tv, cuenta: v.cuentas[mal], animal: p.cats[mal] }).texto : textoPaso("listo", { tv }).texto;
  }
  if (!linea) {
    if (v.detective) linea = textoPaso("detective").texto;
    else if (v.escala === 2) linea = tv ? "Cada ▲ sube 2. Llega hasta lo que contaste." : "Cada + sube 2. Llega hasta lo que contaste.";
    else if (v.grafica === "dibujos") linea = tv ? "Con ▲ pon un dibujo por cada animal que contaste." : "Pon un dibujo por cada animal que contaste.";
    else linea = tv ? "Sube cada barra con ▲ hasta lo que contaste." : "Sube cada barra con + hasta lo que contaste.";
  }
  const pedido = v.detective
    ? `${LUPA} ¡Detective! Mi ayudante hizo la gráfica. ¿Está bien?`
    : "Haz la gráfica con lo que contaste.";
  const listoFlecha = guia() && mal < 0 ? " con-flecha" : "";
  const foco = guia() && mal >= 0 && tv ? `col-${mal}` : guia() && mal < 0 ? "listo" : "col-0";
  return {
    cuerpo: `${burbuja(pedido, linea)}
      <div class="mesa"><div class="zona-principal">${htmlGrafica({ editable: true, meta: p.fallosGrafica >= 2 })}</div>
      <div class="zona-controles"><button type="button" class="boton listo${listoFlecha}" data-foco data-foco-id="listo" data-act="listo">${v.detective ? "Ya está bien" : "Listo"}</button></div></div>`,
    foco,
  };
}

function resaltarDe(pq) {
  if (!pq) return [];
  if (pq.tipo === "mas" || pq.tipo === "menos" || pq.tipo === "total") return partida.cats.map((_, i) => i);
  return pq.ids;
}

function pantallaPreguntas() {
  const p = partida;
  const pq = preguntaActual();
  const total = p.visita.preguntas.length;
  const r = respuesta(pq, p.valores);
  let linea = p.aviso;
  if (!linea && guia()) linea = `${textoPaso("preguntas").texto} ${pq.pista}`;
  if (!linea && !p.acerto) linea = textoPaso("preguntas").texto;
  const pedido = `<small>Pregunta ${p.pregunta + 1} de ${total}</small> ${esc(pq.texto)}`;
  const pista = p.fallosPregunta > 0 || guia();
  const ops = pq.opciones.map((o, i) => {
    const no = p.descartadas.includes(o);
    const ok = (p.explicando || p.acerto) && o === r;
    const dis = no || p.explicando || p.acerto;
    const cara = pq.forma === "animal"
      ? `${svgAnimal(p.cats[o].id, p.cats[o].nombre)}<span>${esc(cap(p.cats[o].plural))}</span>`
      : `${o}`;
    return `<button type="button" class="opcion${pq.forma === "animal" ? " animal" : ""}${no ? " no" : ""}${ok ? " bien" : ""}" data-foco${i === 0 ? '="inicial"' : ""} data-foco-id="op-${i}" data-act="responder" data-n="${o}" ${dis ? "disabled" : ""}>${cara}</button>`;
  }).join("");
  const seguir = p.explicando ? `<button type="button" class="boton listo brilla" data-foco-id="seguir-pregunta" data-foco data-act="seguir-pregunta">Seguir</button>` : "";
  return {
    cuerpo: `${burbuja(pedido, linea, p.acerto)}
      <div class="mesa"><div class="zona-principal">${htmlGrafica({ resaltar: pista ? resaltarDe(pq) : [] })}</div>
      <div class="zona-controles"><div class="opciones${pq.forma === "animal" ? ` animales n${pq.opciones.length}` : ""}${guia() && !p.acerto ? " con-flecha" : ""}">${ops}</div>${seguir}</div></div>`,
    foco: p.explicando ? "seguir-pregunta" : "op-0",
  };
}

// Mirar una fase anterior (Atrás): solo se ve; «Seguir» regresa.
function vistaConteos() {
  const p = partida;
  const lista = p.cats.map((a, i) => i < p.recinto || p.fase !== "contar"
    ? `<li>${svgAnimal(a.id, a.nombre)}<span>${esc(cap(a.plural))}</span><b>${p.visita.cuentas[i]}</b></li>` : "").join("");
  return {
    cuerpo: `${burbuja("Esto contaste.", "Atrás otra vez para salir.")}
      <ul class="conteos">${lista}</ul>
      <div class="zona-controles"><button type="button" class="boton listo brilla" data-foco-id="seguir-vista" data-foco data-act="seguir-vista">Seguir</button></div>`,
    foco: "seguir-vista",
  };
}

function vistaGrafica() {
  return {
    cuerpo: `${burbuja("Esta es tu gráfica.", "Atrás para ver lo que contaste.")}
      <div class="mesa"><div class="zona-principal">${htmlGrafica()}</div>
      <div class="zona-controles"><button type="button" class="boton listo brilla" data-foco-id="seguir-vista" data-foco data-act="seguir-vista">Seguir</button></div></div>`,
    foco: "seguir-vista",
  };
}

// ---------- Acciones de la visita ----------

function libre() {
  return partida && !partida.saliendo && !partida.espera && partida.vista === partida.fase;
}

function toggleQuietos() {
  if (!libre() || partida.fase !== "contar") return;
  clic();
  partida.quietos = !partida.quietos;
  pintar(partida.quietos ? "op-0" : "quietos");
}

function contar(n) {
  if (!libre() || partida.fase !== "contar" || partida.conteoBien) return;
  const p = partida;
  const c = p.visita.cuentas[p.recinto];
  if (n === c) {
    if (p.fallosConteo === 0) p.conteosPrimera++;
    p.conteoBien = true;
    p.aviso = `¡Sí! ${c} ${p.cats[p.recinto].plural}.`;
    p.espera = true;
    bien();
    hablar(`${c}`);
    pintar();
    const t = ++token;
    setTimeout(() => { if (t === token && partida === p) siguienteRecinto(); }, reducido() ? 600 : 1100);
    return;
  }
  p.fallosConteo++;
  p.descartadas.push(n);
  if (p.fallosConteo >= 2) {
    p.verNumeros = true;
    p.quietos = true;
    p.aviso = `Mira: son ${c}. Contamos juntos.`;
    hablar(`Son ${c}.`);
  } else {
    p.quietos = true;
    p.aviso = p.visita.escala === 2 ? "Casi. Ya están quietos: cuenta de 2 en 2, pareja por pareja." : "Casi. Ya están quietos: cuenta otra vez, uno por uno.";
  }
  pintar();
}

function siguienteRecinto() {
  const p = partida;
  p.espera = false;
  if (p.recinto + 1 < p.cats.length) {
    p.recinto++;
    prepararConteo();
    pintar();
    decirPedido();
    return;
  }
  p.fase = p.vista = "grafica";
  p.aviso = "";
  pintar();
  decirPedido();
}

function cambiar(i, delta) {
  if (!libre() || partida.fase !== "grafica") return;
  const v = partida.visita;
  const antes = partida.valores;
  partida.valores = mover(antes, i, delta, v.escala, v.max);
  if (partida.valores === antes) return;
  clic();
  // La marca de «revisa» se va cuando la columna se mueve: ella decide si ya está.
  partida.marcadas = partida.marcadas.filter((x) => x !== i);
  if (!partida.marcadas.length) partida.aviso = "";
  if (guia() && primeraMal() < 0) sonidoListo();
  pintar(`col-${i}`);
}

function pulsarListo() {
  if (!libre() || partida.fase !== "grafica") return;
  const p = partida;
  const errs = errores(p.valores, p.visita.cuentas);
  if (!errs.length) {
    if (p.graficaPrimera === null) p.graficaPrimera = true;
    if (p.visita.detective && p.modo === "visita") { pr = registrar(pr, p.visita.nivel, p.graficaPrimera, hoy()); guardar(); }
    bien();
    p.fase = p.vista = "preguntas";
    p.aviso = p.visita.detective ? (p.visita.detective.errores ? "¡Bien, detective! Ya quedó." : "¡Bien visto! No tenía errores.") : "¡Qué buena gráfica!";
    p.pregunta = 0;
    prepararPregunta(p.aviso);
    pintar();
    decirPedido();
    return;
  }
  if (p.graficaPrimera === null) p.graficaPrimera = false;
  p.fallosGrafica++;
  p.marcadas = errs;
  const nombres = errs.map((i) => p.cats[i].plural);
  const lista = nombres.length > 1 ? `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}` : nombres[0];
  p.aviso = errs.length === 1
    ? `Revisa la columna de ${lista}: contaste ${p.visita.cuentas[errs[0]]}.`
    : `Revisa las columnas marcadas: ${lista}.`;
  if (p.fallosGrafica >= 2) p.aviso += " La raya dice hasta dónde.";
  hablar(p.aviso);
  pintar(esTv() ? `col-${errs[0]}` : "listo");
}

function prepararPregunta(aviso = "") {
  partida.fallosPregunta = 0;
  partida.descartadas = [];
  partida.explicando = false;
  partida.acerto = null;
  partida.aviso = aviso;
}

function responder(o) {
  if (!libre() || partida.fase !== "preguntas" || partida.explicando || partida.acerto) return;
  const p = partida;
  const pq = preguntaActual();
  const r = respuesta(pq, p.valores);
  if (o === r) {
    const primera = p.fallosPregunta === 0;
    if (primera) p.aciertos++;
    anotarPregunta(primera);
    p.acerto = true;
    p.espera = true;
    p.aviso = primera ? "¡Sí! Eso dice la gráfica." : "¡Eso es!";
    bien();
    hablar(primera ? "Sí." : "Eso es.");
    pintar();
    const t = ++token;
    setTimeout(() => { if (t === token && partida === p) siguientePregunta(); }, reducido() ? 700 : 1300);
    return;
  }
  p.fallosPregunta++;
  p.descartadas.push(o);
  if (p.fallosPregunta >= 2) {
    anotarPregunta(false);
    p.explicando = true;
    const ex = explicacion(pq, p.cats, p.valores);
    p.aviso = `Así se lee: ${ex.texto}`;
    hablar(ex.leer);
  } else {
    zumba();
    p.aviso = `Casi. ${pq.pista}`;
    hablar(pq.pista);
  }
  pintar();
}

function anotarPregunta(ok) {
  const p = partida;
  if (p.modo === "visita") pr = registrar(pr, p.visita.nivel, ok, hoy());
  else if (p.modo === "reto") pr = anotarDia(pr, hoy(), ok);
  else return;
  guardar();
}

function siguientePregunta() {
  const p = partida;
  p.espera = false;
  if (p.pregunta + 1 < p.visita.preguntas.length) {
    p.pregunta++;
    prepararPregunta();
    pintar();
    decirPedido();
    return;
  }
  terminarVisita();
}

function terminarVisita() {
  const p = partida;
  if (p.modo === "guia") {
    pr = marcarGuia(pr);
    guardar();
    avisoInicio = "¡Ya sabes jugar! Visita el zoológico.";
    inicio("jugar");
    return;
  }
  if (p.modo === "reto") { finReto(); return; }
  finVisita();
}

function pedidoHtml() {
  const p = partida;
  return `<div class="pedido-comida">
    <span class="canasta">${svgComida()}</span>
    <ul class="fiesta">${p.cats.map((a, i) => `<li style="--i:${i}">${svgAnimal(a.id, a.nombre)}<b>${p.valores[i]}</b></li>`).join("")}</ul>
  </div>`;
}

function finVisita() {
  const p = partida;
  const r = cerrarVisita(pr, p.visita.nivel, p.aciertos);
  pr = r.pr;
  guardar();
  Noli.terminar({ estrellas: r.estrellas });
  const frases = ["¡Buen intento!", "¡Bien hecho!", "¡Muy bien!", "¡Perfecto!"];
  hablar(r.nuevoAnimal ? `${frases[r.estrellas]} Llegó un animal nuevo: ${r.nuevoAnimal.nombre}.` : frases[r.estrellas]);
  mostrar(`
    <h1 class="titulo">¡Pedido listo!</h1>
    ${burbuja("Con tu gráfica pedí la comida. ¡Gracias!", "", true)}
    ${pedidoHtml()}
    <p class="sub">${frases[r.estrellas]} ${p.aciertos} de ${p.visita.preguntas.length} preguntas a la primera</p>
    ${estrellasHtml(r.estrellas, true)}
    ${r.subio ? `<div class="subio"><b>¡Subiste al nivel ${r.subio}!</b><span>${esc(nivel(r.subio).nombre)}</span></div>` : ""}
    ${r.nuevoAnimal ? `<div class="nuevo-animal">${svgAnimal(r.nuevoAnimal.id, r.nuevoAnimal.nombre)}<span><b>¡Animal nuevo!</b> ${esc(r.nuevoAnimal.nombre)} <small lang="en">${esc(r.nuevoAnimal.en)}</small></span></div>` : ""}
    <div class="menu fila">
      <button class="boton grande primario" data-foco="inicial" data-act="jugar">${r.subio ? "Probar el nivel nuevo" : "Otra visita"}</button>
      <button class="boton grande" data-foco data-act="a-inicio">El zoológico</button>
    </div>`, "fin");
  partida = null;
}

function finReto() {
  const p = partida;
  const reto = p.reto;
  const puntos = (reto.tipo === "censo" ? p.conteosPrimera : p.graficaPrimera ? 1 : 0) + p.aciertos;
  const cumplido = puntos >= reto.necesita;
  const antes = !!pr.retos[hoy()]?.cumplido;
  pr = cumplirReto(pr, hoy(), reto.tipo, puntos, cumplido);
  guardar();
  if (cumplido && !antes) Noli.terminar({ estrellas: 3, reto: true });
  hablar(cumplido ? "¡Reto cumplido!" : "¡Casi!");
  mostrar(`
    <h1 class="titulo">${cumplido ? "¡Reto cumplido!" : "¡Casi!"}</h1>
    ${pedidoHtml()}
    <p class="sub">${puntos} de ${reto.items} a la primera. Meta: ${reto.necesita}.</p>
    ${cumplido && !antes ? rachaHtml(true) : ""}
    <div class="menu fila">
      <button class="boton grande primario" data-foco="inicial" data-act="${cumplido ? "a-inicio" : "reto-jugar"}">${cumplido ? "El zoológico" : "Otra vez"}</button>
      ${cumplido ? "" : `<button class="boton grande" data-foco data-act="a-inicio">El zoológico</button>`}
    </div>`, "finReto");
  partida = null;
}

function preguntarSalir() {
  if (!partida) return;
  token++;
  callar();
  partida.espera = false;
  partida.saliendo = true;
  pintar("seguir");
}

function seguirJugando() {
  if (!partida) return;
  partida.saliendo = false;
  // Si estaba esperando un «¡Sí!», sigue adelante en vez de quedarse trabado.
  if (partida.fase === "contar" && partida.conteoBien) { siguienteRecinto(); return; }
  if (partida.fase === "preguntas" && partida.acerto) { siguientePregunta(); return; }
  pintar();
}

function atrasEnJuego() {
  const p = partida;
  const i = FASES.indexOf(p.vista);
  if (i > 0) {
    callar();
    p.vista = FASES[i - 1];
    pintar();
    return;
  }
  preguntarSalir();
}

function seguirVista() {
  const p = partida;
  const i = FASES.indexOf(p.vista);
  p.vista = FASES[Math.min(FASES.indexOf(p.fase), i + 1)];
  pintar();
}

function saltarGuia() {
  pr = marcarGuia(pr);
  guardar();
  inicio();
}

// ---------- Entrada ----------

$main.addEventListener("click", (ev) => {
  const t = ev.target.closest("[data-act]");
  if (!t || !$main.contains(t) || t.disabled) return;
  if (partida && partida.saliendo && !t.closest(".dialogo")) return;
  const act = t.dataset.act;
  if (act === "jugar") empezarVisita();
  else if (act === "reto") retoIntro();
  else if (act === "reto-jugar") empezarReto();
  else if (act === "zoo") zoo();
  else if (act === "progreso") progreso();
  else if (act === "papas") papas();
  else if (act === "como") empezarGuia();
  else if (act === "a-inicio") inicio();
  else if (act === "voz") { pr = ponerVoz(pr, !pr.voz); guardar(); if (!pr.voz) callar(); inicio("voz"); }
  else if (act === "elegir") { pr = { ...pr, elegido: +t.dataset.n }; guardar(); inicio(); }
  else if (act === "quietos") toggleQuietos();
  else if (act === "contar") contar(+t.dataset.n);
  else if (act === "seguir-conteo") { if (partida) { partida.verNumeros = false; siguienteRecinto(); } }
  else if (act === "subir") cambiar(+t.dataset.i, 1);
  else if (act === "bajar") cambiar(+t.dataset.i, -1);
  else if (act === "listo") pulsarListo();
  else if (act === "responder") responder(+t.dataset.n);
  else if (act === "seguir-pregunta") { if (partida && partida.explicando) { partida.explicando = false; siguientePregunta(); } }
  else if (act === "seguir-vista") seguirVista();
  else if (act === "seguir") seguirJugando();
  else if (act === "salir-menu") inicio();
  else if (act === "saltar-guia") saltarGuia();
});

// En la gráfica (tele o teclado): ▲ ▼ suben y bajan la columna con foco; ◀ ▶ y OK pasan a la otra y llegan a Listo.
function teclaGrafica(accion) {
  if (!partida || !libre() || partida.fase !== "grafica") return false;
  const el = document.activeElement;
  const k = partida.cats.length;
  const cadena = [...Array.from({ length: k }, (_, i) => `col-${i}`), "listo"];
  const id = el && el.dataset ? el.dataset.focoId : "";
  const pos = cadena.indexOf(id);
  if (pos < 0) return false;
  const enCol = pos < k;
  if (enCol && accion === "arriba") { cambiar(pos, 1); return true; }
  if (enCol && accion === "abajo") { cambiar(pos, -1); return true; }
  if (accion === "izquierda" || accion === "derecha" || (enCol && accion === "ok")) {
    const j = pos + (accion === "izquierda" ? -1 : 1);
    if (j >= 0 && j < cadena.length) $main.querySelector(`[data-foco-id="${cadena[j]}"]`).focus();
    return true;
  }
  if (!enCol && accion === "arriba") { $main.querySelector(`[data-foco-id="col-${k - 1}"]`).focus(); return true; }
  return false;
}

Noli.alEntrar((accion) => {
  document.documentElement.classList.add("teclado");
  if (pantalla === "juego" && partida && accion === "atras") {
    if (partida.saliendo) seguirJugando();
    else atrasEnJuego();
    return true;
  }
  if (teclaGrafica(accion)) return true;
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

Noli.datos.then((d) => {
  pr = cargar(d);
  if (esTv()) document.documentElement.classList.add("teclado");
  if (!pr.guiaHecha) empezarGuia();
  else inicio();
});
