// La Tienda de Noli: pantallas. La lógica está en los otros módulos; aquí se dibuja y se juega
// con el dedo o con flechas, OK y Atrás.
import { Noli, moverFoco, focoInicial } from "../../../kit/noli.js";
import { cargarDatos } from "./cargar.js";
import { texto, textoLargo, desglose, formar, listaDesdeConteo } from "./dinero.js";
import { armarDia } from "./visita.js";
import { nuevo, cargar, estado, dominio, registrar, cerrarDia, elegirNivel, comprar, fechaLocal, cumplirReto, racha, semana, resumen, VENTANA, PARA_SUBIR } from "./progreso.js";
import { retoDelDia, cumplioReto } from "./reto.js";
import { piezaSvg, clienteSvg, productoSvg, tiendaSvg, estrellaSvg, FLAMA, CANDADO, PALOMA } from "./dibujos.js";

const $main = document.getElementById("juego");
try { if (/[?&]modo=tv\b/.test(location.search)) document.documentElement.dataset.modo = "tv"; } catch { /* sin location */ }

let DATA = null;
let pr = nuevo();
let pantalla = "inicio";
let juego = null;
let timer = null;
let espera = null;
let audioCtx = null;

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const hoy = () => fechaLocal();
const moneda = () => DATA.monedas[pr.moneda] || DATA.monedas[DATA.config.monedaInicial];
const est = () => estado(pr, moneda().id, moneda().niveles.length);
const guardar = () => Noli.guardar(pr);
const nivelDef = (n) => moneda().niveles.find((x) => x.n === n) || moneda().niveles[0];

function mostrar(html, nombre) {
  clearTimeout(espera); espera = null;
  pantalla = nombre;
  $main.className = "p-" + nombre;
  $main.innerHTML = html;
  for (const b of $main.querySelectorAll("[data-ir]")) b.onclick = () => IR[b.dataset.ir]?.(b.dataset);
  for (const b of $main.querySelectorAll("[data-k]")) b.onclick = () => contestar(+b.dataset.k);
  for (const b of $main.querySelectorAll("[data-pieza]")) b.onclick = () => poner(b.dataset.pieza);
  focoInicial($main);
  engancharReloj();
}

function luego(fn, ms) { clearTimeout(espera); espera = setTimeout(fn, ms); }

function tono(frec, t, tipo = "sine", gan = 0.06) {
  try {
    audioCtx = audioCtx || new AudioContext();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = tipo; o.frequency.value = frec;
    g.gain.setValueAtTime(gan, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + t);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + t);
  } catch { /* sin audio */ }
}
const sonidoBien = () => { tono(880, 0.08); luegoSonido(1320, 90); };
const sonidoMal = () => tono(196, 0.18, "triangle", 0.05);
const sonidoMoneda = () => tono(1200, 0.04, "square", 0.03);
let sonidoEspera = null;
function luegoSonido(f, ms) { clearTimeout(sonidoEspera); sonidoEspera = setTimeout(() => tono(f, 0.12), ms); }

function decir(frase) {
  if (!pr.voz || typeof speechSynthesis === "undefined") return;
  try {
    const u = new SpeechSynthesisUtterance(frase);
    u.lang = "es-MX";
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch { /* la voz es opcional */ }
}

const estrellasHtml = (n) => Array.from({ length: 3 }, (_, i) => estrellaSvg(i < n)).join("");
const DIAS = ["D", "L", "M", "M", "J", "V", "S"];
function semanaHtml() {
  return `<div class="semana" aria-label="Últimos 7 días">${semana(pr, hoy()).map((d) => {
    const [y, m, dd] = d.fecha.split("-").map(Number);
    const letra = DIAS[new Date(y, m - 1, dd).getDay()];
    return `<span class="dia ${d.reto ? "reto" : d.jugo ? "jugo" : ""}"><i>${d.reto ? PALOMA : ""}</i>${letra}</span>`;
  }).join("")}</div>`;
}

function htmlProducto(p) {
  return `<article class="producto">${productoSvg(p)}<b>${esc(p.nombre)}</b><span class="precio">${esc(texto(moneda(), p.precio))}</span></article>`;
}
function htmlPiezas(piezas, clase = "mostrador") {
  return `<div class="${clase}">${piezas.map((p) => `<span class="pieza ${p.tipo}" style="--tam:${p.tam || 1}">${piezaSvg(p)}${p.nombreEn ? `<small>${esc(p.nombreEn)}</small>` : ""}</span>`).join("")}</div>`;
}
function burbuja(c, clave) {
  const frase = c.lineas?.[clave] || "";
  return `<div class="persona">${clienteSvg(c, "feliz")}<p class="burbuja">${esc(frase)}</p></div>`;
}

// ---------- Inicio ----------

function inicio() {
  juego = null;
  clearInterval(timer); timer = null;
  const e = est(), def = nivelDef(e.elegido), reto = pr.retos[hoy()], r = racha(pr, hoy());
  const dm = dominio(e, e.elegido);
  mostrar(`
    <div class="fachada">${tiendaSvg(pr.tienda.mejoras)}</div>
    <h1 class="titulo">La Tienda de Noli</h1>
    <p class="sub">Nivel ${e.elegido}: ${esc(def.nombre)}</p>
    <p class="moneda-activa">${esc(moneda().nombre)}</p>
    ${dm.listo && e.elegido === e.nivel && e.nivel < moneda().niveles.length
      ? `<p class="dominio ok">¡Listo para subir! Termina el día y pasa de nivel.</p>`
      : `<div class="dominio"><div class="barra"><i style="width:${Math.round((100 * dm.intentos) / VENTANA)}%"></i></div>
        <small>${dm.aciertos} bien en ${dm.intentos} de ${VENTANA}. Con ${PARA_SUBIR} subes de nivel.</small></div>`}
    <div class="menu">
      <button class="boton grande primario" data-foco="inicial" data-ir="dia">Abrir la tienda</button>
      <button class="boton grande ${reto?.cumplido ? "hecho" : "reto"}" data-foco data-ir="retoIntro">
        Reto del día <small>${reto?.cumplido ? "¡Cumplido!" : "Te espera"}</small></button>
      <button class="boton grande" data-foco data-ir="progreso">Mi progreso</button>
      <button class="boton grande" data-foco data-ir="decorar">La tienda <small>${pr.tienda.monedas} monedas</small></button>
    </div>
    <div class="monedas-sel" role="group" aria-label="Moneda">
      ${DATA.config.monedas.map((id) => `<button class="boton ${pr.moneda === id ? "primario" : ""}" data-foco data-ir="moneda" data-id="${esc(id)}">${esc(DATA.monedas[id].nombre)}</button>`).join("")}
      <button class="boton" data-foco data-ir="voz">Voz: ${pr.voz ? "sí" : "no"}</button>
    </div>
    <p class="racha">${FLAMA}<span>${r ? `Racha: <b>${r}</b> ${r === 1 ? "día" : "días"}` : "Cumple el reto de hoy para empezar una racha"}</span></p>`, "inicio");
}

// ---------- Día y cliente ----------

function nuevaDia() {
  const e = est();
  const visitas = armarDia(e.elegido, Object.values(e.fallos), moneda(), DATA.productos, DATA.clientes, Math.random, DATA.config.clientesPorDia);
  juego = { modo: "dia", nivelN: e.elegido, visitas, i: 0, aciertos: 0, pasoI: 0, puesto: [], contestado: false, anotado: false };
  pintar();
}

function pintar() {
  if (!juego) return inicio();
  if (juego.modo === "misterioso") return pintarMisterio();
  const v = juego.visitas[juego.i];
  if (!v) return avanzar();
  const paso = v.pasos[juego.pasoI] || v.pasos[0];
  juego.contestado = false;
  if (paso === "cambio") pintarCambio(v);
  else pintarPregunta(v, paso);
  const clave = paso === "suma" ? "suma" : paso === "alcanza" ? "alcanza" : paso === "cambio" ? "cambio" : "cuenta";
  decir(v.cliente.lineas?.[clave] || "");
}

function cabecera() {
  if (juego.modo === "horaPico") {
    const pct = Math.max(0, Math.min(100, ((juego.fin - performance.now()) / (juego.reto.segundos * 1000)) * 100));
    return `<header class="cab"><span>Hora pico · ${juego.aciertos} bien</span><span class="reloj"><i style="width:${pct}%"></i></span></header>`;
  }
  if (juego.modo === "cambioPerfecto") return `<header class="cab"><span>${esc(juego.reto.nombre)}</span><span class="cuenta">${juego.i + 1} de ${juego.visitas.length}</span></header>`;
  if (juego.modo === "misterioso") return `<header class="cab"><span>Cliente misterioso</span><span class="cuenta">${juego.i + 1} de ${juego.problemas.length}</span></header>`;
  const n = juego.visitas.length;
  const puntos = Array.from({ length: n }, (_, k) => `<i class="${k < juego.i ? "lleno" : ""}"></i>`).join("");
  return `<header class="cab"><span>Nivel ${juego.nivelN}</span><span class="puntos">${puntos}</span></header>`;
}

function pintarPregunta(v, paso) {
  const pregunta = paso === "suma" ? "¿Cuánto es en total?" : paso === "alcanza" ? "¿Me alcanza?" : "¿Cuánto te dio?";
  const dinero = paso === "suma" ? "" : htmlPiezas(v.pago);
  mostrar(`
    ${cabecera()}
    ${burbuja(v.cliente, paso === "suma" ? "suma" : paso === "alcanza" ? "alcanza" : "cuenta")}
    <div class="pedido">${v.productos.map(htmlProducto).join("")}</div>
    ${dinero}
    <p class="pregunta">${pregunta}</p>
    <div class="opciones ${v.opciones.length === 2 ? "dos" : ""}">${v.opciones.map((o, k) => `<button class="op" data-foco${k === 0 ? '="inicial"' : ""} data-k="${k}">${esc(o.texto || texto(moneda(), o.valor))}</button>`).join("")}</div>`, paso === "alcanza" ? "pregunta" : "pregunta");
}

function piezasGaveta(pagoTotal) {
  return moneda().piezas
    .filter((p) => (moneda().caja[p.id] || 0) > 0 && p.valor < pagoTotal)
    .sort((a, b) => (a.tipo === b.tipo ? a.valor - b.valor : a.tipo === "moneda" ? -1 : 1));
}

function pintarCambio(v) {
  const llevas = juego.puesto.reduce((s, p) => s + p.valor, 0);
  const gaveta = piezasGaveta(v.pagoTotal);
  let primera = true;
  const fichas = gaveta.map((p) => {
    const quedan = (moneda().caja[p.id] || 0) - juego.puesto.filter((x) => x.id === p.id).length;
    const activa = quedan > 0;
    const inicial = activa && primera;
    if (activa) primera = false;
    return `<button class="ficha ${p.tipo}" data-pieza="${esc(p.id)}" ${activa ? `data-foco${inicial ? '="inicial"' : ""}` : "disabled"} style="--tam:${p.tam || 1}">${piezaSvg(p)}<small>${esc(p.nombreEn || p.etiqueta)}</small></button>`;
  }).join("");
  mostrar(`
    ${cabecera()}
    ${burbuja(v.cliente, "cambio")}
    <div class="pedido">${v.productos.map(htmlProducto).join("")}</div>
    <p class="sub">Te dio ${esc(texto(moneda(), v.pagoTotal))}</p>
    ${htmlPiezas(v.pago)}
    <p class="pregunta">¿Cuánto de cambio?</p>
    <div class="mostrador puesto" aria-label="Cambio que vas a dar">${juego.puesto.length ? juego.puesto.map((p) => `<span class="pieza ${p.tipo}" style="--tam:${p.tam || 1}">${piezaSvg(p)}</span>`).join("") : `<span class="vacio">El mostrador está vacío</span>`}</div>
    <p class="llevas">Llevas <b>${esc(texto(moneda(), llevas))}</b></p>
    <div class="zona-caja">
      <div class="gaveta">${fichas}</div>
      <p class="pista-control">OK pone una. Atrás quita la última.</p>
      <div class="abajo">
        <button class="boton" data-foco data-ir="quitar">Quitar</button>
        <button class="boton primario" data-foco data-ir="listo">Listo</button>
      </div>
    </div>`, "cambio");
}

function contestar(k) {
  if (!juego || juego.contestado) return;
  if (juego.modo === "misterioso") return contestarMisterio(k);
  const v = juego.visitas[juego.i];
  const op = v.opciones[k];
  if (!op) return;
  const ultimo = juego.pasoI >= v.pasos.length - 1;
  if (op.correcta && !ultimo) {
    juego.pasoI++;
    juego.puesto = [];
    sonidoBien();
    pintar();
    return;
  }
  if (op.correcta) return bien(v);
  juego.contestado = true;
  anotar(false);
  sonidoMal();
  explicarPregunta(v, op);
}

function poner(id) {
  if (!juego || juego.contestado || pantalla !== "cambio") return;
  const p = moneda().piezas.find((x) => x.id === id);
  const usados = juego.puesto.filter((x) => x.id === id).length;
  if (!p || usados >= (moneda().caja[id] || 0)) return;
  juego.puesto.push(p);
  sonidoMoneda();
  pintarCambio(juego.visitas[juego.i]);
  $main.querySelector(`[data-pieza="${id}"]`)?.focus();
}

function quitar() {
  if (!juego?.puesto?.length) return false;
  const id = juego.puesto[juego.puesto.length - 1].id;
  juego.puesto.pop();
  if (pantalla === "cambio") {
    pintarCambio(juego.visitas[juego.i]);
    $main.querySelector(`[data-pieza="${id}"]`)?.focus();
  }
  return true;
}

function listo() {
  if (!juego || juego.contestado || pantalla !== "cambio") return;
  const v = juego.visitas[juego.i];
  const suma = juego.puesto.reduce((s, p) => s + p.valor, 0);
  if (suma === v.cambio) return bien(v);
  juego.contestado = true;
  anotar(false);
  sonidoMal();
  explicarCambio(v, suma);
}

function bien(v) {
  if (!juego || juego.contestado) return;
  juego.contestado = true;
  anotar(true);
  sonidoBien();
  const linea = v.cliente.lineas.bien;
  mostrar(`
    ${cabecera()}
    <div class="persona">${clienteSvg(v.cliente, "feliz")}<p class="burbuja">${esc(linea)}</p></div>
    <p class="aviso bien">¡Bien!</p>`, "bien");
  decir(linea);
  luego(avanzar, juego.modo === "horaPico" ? 380 : 750);
}

function anotar(ok) {
  if (!juego || juego.anotado) return;
  juego.anotado = true;
  if (ok) juego.aciertos++;
  if (juego.modo !== "dia") return;
  const v = juego.visitas[juego.i];
  pr = registrar(pr, moneda().id, juego.nivelN, ok, v, hoy(), moneda().niveles.length);
  guardar();
}

function explicarPregunta(v, op) {
  const paso = v.pasos[juego.pasoI];
  const expr = "pensativo";
  let cuerpo = "";
  if (paso === "alcanza") {
    cuerpo = `<p class="aviso mal">${esc(op.motivo)}</p>${htmlPiezas(v.pago)}<p class="sub">Precio: ${esc(texto(moneda(), v.total))}. Trae: ${esc(texto(moneda(), v.pagoTotal))}.</p>`;
  } else if (paso === "suma") {
    const [a, b] = v.productos;
    cuerpo = `<p class="aviso mal">${esc(op.motivo || "Suma los dos precios.")}</p><p class="cuenta-larga">${esc(texto(moneda(), a.precio))} + ${esc(texto(moneda(), b.precio))} = <b>${esc(texto(moneda(), v.total))}</b></p>`;
  } else {
    const lineas = desglose(v.pago).map((g) => `<span>${g.n} × ${esc(g.etiqueta)} = ${esc(texto(moneda(), g.parcial))}</span>`).join("");
    cuerpo = `<p class="aviso mal">${esc(v.cliente.lineas.mal)} ${esc(op.motivo || "")}</p><div class="desglose">${lineas}</div><p class="cuenta-larga">Son <b>${esc(texto(moneda(), v.pagoTotal))}</b>, ${esc(textoLargo(moneda(), v.pagoTotal))}.</p>${htmlPiezas(v.pago)}`;
  }
  pintarExplicacion(v, expr, cuerpo);
}

function explicarCambio(v, suma) {
  const deMas = suma > v.cambio;
  const linea = deMas ? v.cliente.lineas.deMas : v.cliente.lineas.falta;
  const armado = formar(v.cambio, moneda().piezas, moneda().caja);
  const piezas = armado ? listaDesdeConteo(armado, moneda()) : [];
  const cuerpo = `
    <p class="aviso mal">${esc(linea)}</p>
    <p class="cuenta-larga">Te dio ${esc(texto(moneda(), v.pagoTotal))}. Cuesta ${esc(texto(moneda(), v.total))}. El cambio es <b>${esc(texto(moneda(), v.cambio))}</b>.</p>
    ${piezas.length ? htmlPiezas(piezas) : ""}
    <p class="sub">${esc(textoLargo(moneda(), v.cambio))}.</p>`;
  pintarExplicacion(v, deMas ? "sorpresa" : "pensativo", cuerpo);
}

function pintarExplicacion(v, expr, cuerpo) {
  const seguir = `<button class="boton primario" data-foco="inicial" data-ir="seguirCliente">Seguir</button>`;
  mostrar(`
    ${cabecera()}
    <div class="persona">${clienteSvg(v.cliente, expr)}<p class="burbuja">${esc(v.cliente.lineas.mal)}</p></div>
    ${cuerpo}
    <div class="abajo">${juego.modo === "horaPico" ? "" : seguir}</div>`, "explicar");
  if (juego.modo === "horaPico") luego(avanzar, 1200);
}

function avanzar() {
  if (!juego || juego.terminado) return;
  if (juego.modo === "misterioso") {
    juego.i++;
    juego.contestado = false;
    if (juego.i >= juego.problemas.length) return finReto();
    return pintarMisterio();
  }
  juego.i++;
  juego.pasoI = 0;
  juego.puesto = [];
  juego.contestado = false;
  juego.anotado = false;
  if (juego.modo === "horaPico" && performance.now() >= juego.fin) return finReto();
  if (juego.i >= juego.visitas.length) return juego.modo === "dia" ? finDia() : finReto();
  pintar();
}

function finDia() {
  if (!juego || juego.terminado) return;
  if (!juego.visitas.length) { juego = null; inicio(); return; }
  juego.terminado = true;
  clearInterval(timer); timer = null;
  const { pr: nuevoPr, subio, estrellas } = cerrarDia(pr, moneda().id, juego.nivelN, juego.aciertos, hoy(), juego.visitas.length, moneda().niveles.length);
  pr = nuevoPr;
  guardar();
  Noli.terminar({ estrellas });
  const def = subio ? nivelDef(subio) : null;
  mostrar(`
    <h1 class="titulo">${["¡Buen intento!", "¡Bien hecho!", "¡Muy bien!", "¡Día redondo!"][estrellas]}</h1>
    <p class="estrellas grande">${estrellasHtml(estrellas)}</p>
    <p class="sub">${juego.aciertos} de ${juego.visitas.length} clientes bien atendidos</p>
    <p class="sub">La caja del día: <b>${juego.aciertos}</b> ${juego.aciertos === 1 ? "moneda" : "monedas"} de tienda.</p>
    ${subio ? `<div class="subio"><b>¡Subiste al nivel ${subio}!</b><span>${esc(def.nombre)}</span></div>` : ""}
    <div class="menu fila">
      <button class="boton grande primario" data-foco="inicial" data-ir="dia">${subio ? "Probar el nivel nuevo" : "Otro día"}</button>
      <button class="boton grande" data-foco data-ir="decorar">Decorar</button>
      <button class="boton grande" data-foco data-ir="inicio">Inicio</button>
    </div>`, "fin");
}

// ---------- Reto ----------

function retoIntro() {
  const reto = retoDelDia(hoy(), est().nivel, moneda(), DATA);
  const hecho = pr.retos[hoy()];
  mostrar(`
    <h1 class="titulo">Reto del día</h1>
    <div class="tarjeta-reto">
      <b>${esc(reto.nombre)}</b>
      <p>${esc(reto.meta)}</p>
      <small>${esc(moneda().nombre)} · nivel ${reto.nivel}</small>
      ${hecho ? `<p class="hecho-txt">${hecho.cumplido ? "¡Ya lo cumpliste hoy! Puedes jugarlo otra vez." : "Hoy todavía no. ¡Inténtalo otra vez!"}</p>` : ""}
    </div>
    <div class="menu fila">
      <button class="boton grande primario" data-foco="inicial" data-ir="retoJugar">¡Empezar!</button>
      <button class="boton grande" data-foco data-ir="inicio">Inicio</button>
    </div>
    ${semanaHtml()}`, "retoIntro");
}

function retoJugar() {
  const reto = retoDelDia(hoy(), est().nivel, moneda(), DATA);
  juego = {
    modo: reto.tipo, reto, visitas: reto.visitas || [], problemas: reto.problemas || [],
    i: 0, aciertos: 0, pasoI: 0, puesto: [], contestado: false, anotado: false,
    fin: performance.now() + (reto.segundos || 0) * 1000,
  };
  pintar();
}

function engancharReloj() {
  clearInterval(timer); timer = null;
  if (juego?.modo !== "horaPico" || juego.terminado) return;
  timer = setInterval(() => {
    if (!juego || juego.terminado) return;
    const barra = $main.querySelector(".reloj i");
    if (barra) barra.style.width = Math.max(0, Math.min(100, ((juego.fin - performance.now()) / (juego.reto.segundos * 1000)) * 100)) + "%";
    if (performance.now() >= juego.fin) finReto();
  }, 200);
}

function pintarMisterio() {
  const p = juego.problemas[juego.i];
  juego.contestado = false;
  mostrar(`
    ${cabecera()}
    <h1 class="titulo chico">Cliente misterioso</h1>
    <p class="historia">${esc(p.texto)}</p>
    <div class="opciones">${p.opciones.map((o, k) => `<button class="op" data-foco${k === 0 ? '="inicial"' : ""} data-k="${k}">${esc(texto(moneda(), o.valor))}</button>`).join("")}</div>`, "misterio");
}

function contestarMisterio(k) {
  const p = juego.problemas[juego.i];
  const op = p.opciones[k];
  juego.contestado = true;
  if (op.correcta) { juego.aciertos++; sonidoBien(); }
  else sonidoMal();
  const botones = [...$main.querySelectorAll(".op")];
  botones[k]?.classList.add(op.correcta ? "bien" : "mal");
  if (!op.correcta) botones[p.opciones.findIndex((x) => x.correcta)]?.classList.add("bien");
  const aviso = $main.querySelector(".historia");
  if (!op.correcta && aviso) aviso.insertAdjacentHTML("afterend", `<p class="aviso mal">${esc(op.motivo || "La respuesta es " + texto(moneda(), p.respuesta) + ".")}</p>`);
  luego(avanzar, op.correcta ? 600 : 1300);
}

function finReto() {
  if (!juego || juego.terminado) return;
  juego.terminado = true;
  clearInterval(timer); timer = null;
  clearTimeout(espera);
  const r = juego.reto;
  const puntos = juego.aciertos;
  const cumplido = cumplioReto(r, puntos);
  const antes = !!pr.retos[hoy()]?.cumplido;
  pr = cumplirReto(pr, hoy(), r.tipo, puntos, cumplido);
  guardar();
  if (cumplido && !antes) Noli.terminar({ estrellas: 3, reto: true });
  const detalle = r.tipo === "horaPico" ? `${puntos} bien en ${r.segundos} segundos (meta: ${r.objetivo})`
    : r.tipo === "misterioso" ? `${puntos} de ${r.cuantos} bien` : `${puntos} de ${r.cuantos} sin equivocarte`;
  mostrar(`
    <h1 class="titulo">${cumplido ? "¡Reto cumplido!" : "¡Casi!"}</h1>
    <p class="sub">${esc(detalle)}</p>
    ${cumplido && !antes ? `<p class="racha grande">${FLAMA}<span>Racha: <b>${racha(pr, hoy())}</b></span></p>` : ""}
    <div class="menu fila">
      <button class="boton grande primario" data-foco="inicial" data-ir="${cumplido ? "inicio" : "retoJugar"}">${cumplido ? "Inicio" : "Otra vez"}</button>
      ${cumplido ? "" : `<button class="boton grande" data-foco data-ir="inicio">Inicio</button>`}
    </div>
    ${semanaHtml()}`, "finReto");
}

// ---------- Progreso, tienda, papás ----------

function progreso() {
  const e = est();
  const r = racha(pr, hoy());
  mostrar(`
    <h1 class="titulo">Mi progreso</h1>
    <p class="racha">${FLAMA}<span>Racha: <b>${r}</b> ${r === 1 ? "día" : "días"}</span></p>
    <p class="sub">${esc(moneda().nombre)}</p>
    ${semanaHtml()}
    <ol class="mapa">${moneda().niveles.map((x) => {
      const nv = e.niveles[x.n], abierto = x.n <= e.nivel, dm = dominio(e, x.n);
      const marca = nv?.dominado ? `<span class="estrellas">${estrellasHtml(nv.estrellas || 0)}</span>`
        : abierto ? `<span class="en-curso">${dm.aciertos} de ${PARA_SUBIR}</span>` : `<span class="candado">${CANDADO}</span>`;
      return `<li><button class="nivel ${nv?.dominado ? "dominado" : abierto ? "abierto" : "cerrado"}${x.n === e.elegido ? " actual" : ""}"
        ${abierto ? `data-foco${x.n === e.elegido ? '="inicial"' : ""} data-ir="elegir" data-n="${x.n}"` : "disabled"}>
        <b>${x.n}</b><span class="nom">${esc(x.nombre)}</span>${marca}</button></li>`;
    }).join("")}</ol>
    <div class="menu fila">
      <button class="boton" data-foco data-ir="inicio">Inicio</button>
      <button class="boton" data-foco data-ir="papas">Para papás</button>
    </div>`, "progreso");
}

function papas() {
  const R = resumen(pr, moneda(), moneda().id);
  mostrar(`
    <h1 class="titulo chico">Para papás</h1>
    <p class="nota">Sube de nivel con ${PARA_SUBIR} de los últimos ${VENTANA} clientes bien atendidos. La moneda se elige en el inicio y se guarda en este aparato. Ahora: <b>${esc(moneda().nombre)}</b>. Dólares y pesos están en datos/usd.json y datos/mxn.json.</p>
    <table class="tabla"><thead><tr><th>Nivel</th><th>Clientes</th><th>Aciertos</th><th></th></tr></thead><tbody>
    ${R.niveles.filter((x) => x.desbloqueado || x.total).map((x) => `<tr><td>${x.n}. ${esc(x.nombre)}</td><td>${x.total}</td><td>${x.pct == null ? "–" : x.pct + " %"}</td><td>${x.dominado ? "Dominado" : ""}</td></tr>`).join("")}
    </tbody></table>
    <p class="nota">Las monedas de tienda solo decoran. Los créditos de Noli los da el catálogo al terminar el día o el reto.</p>
    <div class="menu fila"><button class="boton" data-foco="inicial" data-ir="progreso">Regresar</button></div>`, "papas");
}

function decorar() {
  mostrar(`
    <h1 class="titulo">La tienda</h1>
    <div class="fachada grande">${tiendaSvg(pr.tienda.mejoras)}</div>
    <p class="sub"><b>${pr.tienda.monedas}</b> ${pr.tienda.monedas === 1 ? "moneda" : "monedas"} de tienda</p>
    <p class="nota">Se ganan atendiendo clientes. No son los créditos de Noli.</p>
    <ul class="mejoras">${DATA.config.mejoras.map((m) => {
      const tiene = pr.tienda.mejoras.includes(m.id);
      const puede = !tiene && pr.tienda.monedas >= m.costo;
      return `<li><button class="nivel ${tiene ? "dominado" : ""}" ${puede ? `data-foco data-ir="comprar" data-id="${esc(m.id)}"` : (!tiene ? "disabled" : "")}>
        <span class="nom">${esc(m.nombre)}<small>${esc(m.texto)}</small></span>
        <b>${tiene ? "Lista" : m.costo}</b></button></li>`;
    }).join("")}</ul>
    <div class="menu fila"><button class="boton primario" data-foco="inicial" data-ir="inicio">Inicio</button></div>`, "decorar");
}

function preguntarSalir() {
  mostrar(`
    <h1 class="titulo chico">¿Salir de la tienda?</h1>
    <p class="sub">Atrás, o Seguir, se queda en el cliente.</p>
    <div class="menu fila">
      <button class="boton grande primario" data-foco="inicial" data-ir="seguirJuego">Seguir</button>
      <button class="boton grande" data-foco data-ir="salirJuego">Salir</button>
    </div>`, "salir");
}

// ---------- Navegación ----------

const IR = {
  inicio, progreso, papas, decorar, retoIntro, retoJugar,
  dia: nuevaDia,
  moneda: ({ id }) => { if (!DATA.monedas[id] || id === pr.moneda) return; pr = { ...pr, moneda: id }; guardar(); inicio(); },
  voz: () => { pr = { ...pr, voz: !pr.voz }; guardar(); inicio(); },
  elegir: ({ n }) => { pr = elegirNivel(pr, moneda().id, +n, moneda().niveles.length); guardar(); inicio(); },
  comprar: ({ id }) => { pr = comprar(pr, id, DATA.config.mejoras); guardar(); decorar(); },
  quitar: () => { if (!quitar()) preguntarSalir(); },
  listo,
  seguirCliente: () => avanzar(),
  seguirJuego: () => { if (juego && !juego.terminado) pintar(); else inicio(); },
  salirJuego: () => { juego = null; clearInterval(timer); Noli.salir(); },
};

Noli.alEntrar((accion) => {
  if (pantalla === "cambio" && accion === "atras") {
    if (quitar()) return true;
    preguntarSalir();
    return true;
  }
  if (moverFoco(accion, $main)) return true;
  if (accion === "ok") {
    const e = document.activeElement;
    if (e && $main.contains(e) && !e.disabled) e.click();
    return true;
  }
  if (accion === "atras") {
    if (pantalla === "salir") { if (juego && !juego.terminado) pintar(); else inicio(); return true; }
    if (pantalla === "inicio") return false;
    if (pantalla === "papas") { progreso(); return true; }
    if (pantalla === "pregunta" || pantalla === "cambio" || pantalla === "bien" || pantalla === "explicar" || pantalla === "misterio") {
      preguntarSalir(); return true;
    }
    inicio(); return true;
  }
});

document.addEventListener("pointerdown", () => document.documentElement.classList.remove("teclado"), true);
$main.addEventListener("focusin", (e) => { if (e.target?.scrollIntoView) e.target.scrollIntoView({ block: "nearest", inline: "nearest" }); });

Noli.datos.then((d) => {
  pr = cargar(d);
  cargarDatos().then(({ datos, errores }) => {
    if (errores.length) {
      $main.innerHTML = `<p class="aviso mal">${errores.map(esc).join("<br>")}</p>`;
      return;
    }
    DATA = datos;
    if (!DATA.monedas[pr.moneda]) pr = { ...pr, moneda: DATA.config.monedaInicial };
    inicio();
  }).catch((e) => { $main.innerHTML = `<p class="aviso mal">No se pudieron leer los datos. ${esc(e.message)}</p>`; });
});
