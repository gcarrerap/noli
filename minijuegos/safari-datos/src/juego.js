// Safari de Datos: pantallas. La lógica está en los otros módulos.
// Se juega con el dedo o con flechas, OK y Atrás. Sin await al nivel del módulo.
import { Noli, moverFoco, focoInicial } from "../../../kit/noli.js";
import { ANIMALES, ORDEN, animal, colorDe, COLOR_HEX, nombreEs, fraseIngles, fraseLlego } from "./animales.js";
import { TEXTOS, textoAcierto, textoGuia, vozGuia, vozLeyenda } from "./textos.js";
import { hablar, callar, cuentaComoFin } from "./voz.js";
import { clic, listo as sonidoListo, bien, desbloquear } from "./sonido.js";
import { IGNORAR_MS, resolverToque, alCerrarDialogo } from "./salida.js";
import {
  guiaNueva, aplicarGuia, debeAvanzarSolo, abrirSalirGuia, seguirSalirGuia, anotarVoz,
  instanteAuto, esMirar, focoGuia, listoGuiaActivo, numerosGuiaActivos,
  palitosGuia, guardarAlTerminar, OPCIONES_GUIA_CONTEO, OPCIONES_GUIA_MAS,
  GUIA_MONOS, GUIA_JIRAFAS, TRAS_GUIA_MS,
} from "./guia.js";
import { crearVisita, respuestaEs, conteoCorrecto, metasDe, nivel } from "./niveles.js";
import {
  geometriaBarras, geometriaDiferencia, gruposPalitos, moverBarra, barrasCoinciden,
  indiceMasBajo, indiceMasAlto, UNIDAD,
} from "./grafica.js";
import { pista, marcaPasoCompleto, FLECHA_S, COMPLETA_S } from "./pista.js";
import {
  nuevo, cargar, anotarElemento, cerrarVisita, abrirAnimal, quiereFacil, marcarGuia,
  ponerVoz, fechaLocal, cumplirReto, racha, semana, resumen, dominio, VENTANA,
} from "./progreso.js";
import { retoDelDia } from "./reto.js";
import { rngConSemilla } from "./rng.js";

const $main = document.getElementById("juego");
try { if (/[?&]modo=tv\b/.test(location.search)) document.documentElement.dataset.modo = "tv"; } catch { /* sin location */ }

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const esTv = () => document.documentElement.dataset.modo === "tv" || Noli.modo === "tv";
const hoy = () => fechaLocal();
const esIdAnimal = (id) => ANIMALES.some((a) => a.id === id);

const COMIDA = {
  platanos: "plátanos", carne: "carne", hojas: "hojas", heno: "heno", sandia: "sandía", pescado: "pescado",
};

let pr = nuevo();
let pantalla = "inicio";
let guia = null;
let partida = null;
let ignorarGlobal = 0;
let relojGuia = 0;
let relojPista = 0;
let relojMuestra = 0;
let relojOpciones = 0;
let finVista = null;
const MUESTRA_MS = 1500;
const OPCIONES_LOCK_MS = 1000;
let vozToken = 0;
let cajaSvg = "";
let sonoListo = false;
let pistaDicha = "";
let focoQuiere = "";

const guardar = () => Noli.guardar(pr);

function cargarCaja() {
  return fetch("img/caja-pedido.svg").then((r) => r.text()).then((t) => { cajaSvg = t; }).catch(() => {});
}

function saliendoAhora() {
  return !!(guia && guia.saliendo) || !!(partida && partida.saliendo) || !!(finVista && finVista.saliendo);
}

function hastaIgnorar() {
  return Math.max(
    ignorarGlobal || 0,
    (guia && guia.ignorarHasta) || 0,
    (partida && partida.ignorarHasta) || 0,
    (finVista && finVista.ignorarHasta) || 0,
  );
}

function resolverAct(act) {
  return resolverToque({ saliendo: saliendoAhora(), ignorarHasta: hastaIgnorar(), ahora: Date.now(), act });
}

function foco(id) {
  if (saliendoAhora() && id !== "seguir" && id !== "salir") return "";
  const inicial = id === focoQuiere ? '="inicial"' : "";
  return ` data-foco${inicial} data-foco-id="${id}"`;
}

function pintar(html, quiere) {
  focoQuiere = quiere || focoQuiere || "";
  $main.innerHTML = html;
  const el = focoQuiere && $main.querySelector(`[data-foco-id="${focoQuiere}"]`);
  if (el && typeof el.focus === "function") el.focus();
  else focoInicial($main);
}

function idFoco() {
  const el = document.activeElement;
  return el && el.dataset ? el.dataset.focoId || "" : "";
}

function estrellasHtml(n, grande) {
  let s = "";
  for (let i = 0; i < 3; i++) {
    s += `<svg class="${i < n ? "on" : "off"}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.4l2.7 5.8 6.4.7-4.8 4.3 1.4 6.3L12 16.4 6.3 19.5l1.4-6.3L2.9 8.9l6.4-.7z"/></svg>`;
  }
  return `<span class="estrellas${grande ? " grande" : ""}">${s}</span>`;
}

function dialogo() {
  if (!saliendoAhora()) return "";
  return `<div class="velo salir-velo"><div class="dialogo" role="dialog" aria-label="Salir">
    <p>${esc(TEXTOS.preguntaSalir)}</p>
    <button type="button" class="boton grande primario" data-foco="inicial" data-foco-id="seguir" data-act="seguir">${esc(TEXTOS.seguir)}</button>
    <button type="button" class="boton grande" data-foco data-foco-id="salir" data-act="salir">${esc(TEXTOS.salir)}</button>
  </div></div>`;
}

function htmlPalitos(n) {
  return gruposPalitos(n).map((g) => `<img src="img/palitos-${g}.svg" alt="">`).join("");
}

function htmlCaja(n) {
  const v = String(n | 0);
  if (!cajaSvg) return `<b>${esc(v)}</b>`;
  return cajaSvg.replace(">0<", `>${esc(v)}<`);
}

function pedidoComida(categorias) {
  const map = new Map();
  for (const c of categorias || []) {
    const id = animal(c.id).comida;
    map.set(id, (map.get(id) || 0) + c.cantidad);
  }
  return [...map.entries()];
}

function burbuja(texto, pistaTexto, actMirar) {
  const extra = pistaTexto && pistaTexto !== texto ? `<p class="pista">${esc(pistaTexto)}</p>` : "";
  const dentro = `<p class="pedido">${esc(texto)}</p>${extra}`;
  if (actMirar) {
    return `<button type="button" class="burbuja pedido" data-act="mirar"${foco("frase")}>${dentro}</button>`;
  }
  return `<div class="burbuja">${dentro}</div>`;
}

function cabezasDe(id, n) {
  let s = "";
  for (let i = 0; i < n; i++) s += `<img src="img/cabeza-${id}.svg" alt="">`;
  return `<div class="cabezas">${s}</div>`;
}

function indicesMarcados(opts, cantidades, ids) {
  const f = opts.flecha;
  if (f === "barras") return cantidades.map((_, i) => i);
  if (f === "par" && opts.par && ids) {
    return opts.par.map((id) => ids.indexOf(id)).filter((i) => i >= 0);
  }
  if (f === "alta") {
    let m = 0;
    cantidades.forEach((c, i) => { if (c > cantidades[m]) m = i; });
    return cantidades.length ? [m] : [];
  }
  if (f === "baja" && opts.dif) return [opts.dif.bajo];
  if (f && String(f).startsWith("barra-")) return [+String(f).slice(6)];
  return [];
}

function claseLuz(i, opts, marcados) {
  if (!opts.luces) return "";
  if (opts.flecha === "barras") return `g${i % 2}`;
  if (!marcados.has(i)) return "";
  const orden = [...marcados].sort((a, b) => a - b);
  return `g${orden.indexOf(i) % 2}`;
}

function svgVertical(ids, cantidades, eje, opts) {
  const ejeH = eje === 20 ? 624 : 324;
  const pie = 40;
  const vbH = ejeH + pie;
  const base = eje === 20 ? 600 : 300;
  const barras = geometriaBarras(cantidades, eje);
  const marcados = new Set(indicesMarcados(opts, cantidades, ids));
  let capas = "";
  barras.forEach((b, i) => {
    const id = ids[i];
    const n = Math.max(0, cantidades[i] | 0);
    const hex = COLOR_HEX[colorDe(i)];
    const luzClase = claseLuz(i, opts, marcados);
    const luz = luzClase ? ` class="${luzClase}"` : "";
    if ((opts.modo || "barras") === "dibujos") {
      for (let u = 0; u < n; u++) {
        capas += `<image${luz} href="img/cabeza-${id}.svg" x="${b.x}" y="${b.base - (u + 1) * UNIDAD}" width="${b.ancho}" height="${UNIDAD - 2}"/>`;
      }
    } else {
      for (let u = 0; u < n; u++) {
        const y = b.base - (u + 1) * UNIDAD;
        capas += `<rect${luz} x="${b.x}" y="${y + 1}" width="${b.ancho}" height="${UNIDAD - 3}" rx="4" fill="${hex}" stroke="#2b2236" stroke-width="2"/>`;
      }
    }
    if (marcados.has(i)) {
      capas += `<image href="img/flecha-pista.svg" x="${b.x + b.ancho / 2 - 14}" y="${Math.max(-8, b.y - 32)}" width="28" height="28"/>`;
    }
    const cx = b.x + b.ancho / 2;
    capas += `<text x="${cx}" y="${base + 28}" text-anchor="middle" font-family="Nunito, sans-serif" font-size="18" font-weight="800" fill="#2b2236">${esc(nombreEs(id))}</text>`;
  });
  if (opts.dif && opts.linea) {
    const g = geometriaDiferencia(cantidades, opts.dif.bajo, opts.dif.alto, eje);
    capas += `<image href="img/linea-punteada.svg" x="${g.linea.x}" y="${g.linea.y}" width="${Math.max(1, g.linea.w)}" height="${g.linea.h}" preserveAspectRatio="none"/>`;
    if (opts.sombra && g.sombra.h > 0) {
      capas += `<image href="img/diferencia.svg" x="${g.sombra.x}" y="${g.sombra.y}" width="${g.sombra.w}" height="${g.sombra.h}" preserveAspectRatio="none"/>`;
    }
  }
  const botones = ids.map((id, i) => `<button type="button" class="leer tapa" data-act="leer" data-que="ingles" data-id="${id}"${foco("nombre-" + i)}><span>${esc(nombreEs(id))}</span><small>${esc(animal(id).en)}</small></button>`).join("");
  return `<div class="grafica-svg${opts.luces ? " luces" : ""}"><svg class="eje eje-${eje}" viewBox="0 -14 410 ${vbH}" preserveAspectRatio="xMidYMid meet" role="img">
    <image href="img/eje-${eje === 20 ? 20 : 10}.svg" x="0" y="-14" width="410" height="${ejeH}"/>
    ${capas}
  </svg><div class="nombres-bajo" style="--n:${ids.length}"><span></span>${botones}</div></div>`;
}

function htmlHorizontal(ids, cantidades, opts) {
  const o = opts || {};
  const marcados = new Set(indicesMarcados(o, cantidades, ids));
  return `<div class="tabla${o.luces ? " luces" : ""}">${ids.map((id, i) => {
    const luz = claseLuz(i, o, marcados);
    const celdas = Array.from({ length: cantidades[i] }, () => `<i class="${luz}" style="background:${COLOR_HEX[colorDe(i)]}"></i>`).join("");
    const flecha = marcados.has(i) ? " con-flecha" : "";
    return `<div class="fila-h tono-${colorDe(i)}${flecha}"><img src="img/cabeza-${id}.svg" alt=""><div class="unidades">${celdas}</div></div>`;
  }).join("")}</div>`;
}

function lecturas(modo, ocultar) {
  if (ocultar) return "";
  const ley = vozLeyenda(modo === "dibujos" ? "dibujos" : modo === "palitos" ? "palitos" : "barras");
  return `<div class="lecturas">
    <button type="button" class="leer" data-act="leer" data-que="titulo"${foco("titulo")}>${esc(TEXTOS.tituloGrafica)}</button>
    <button type="button" class="leer" data-act="leer" data-que="ejey"${foco("eje-y")}>${esc(TEXTOS.ejeY)}</button>
    <button type="button" class="leer" data-act="leer" data-que="ejex"${foco("eje-x")}>${esc(TEXTOS.ejeX)}</button>
    <button type="button" class="leer" data-act="leer" data-que="leyenda"${foco("leyenda")}>${esc(ley)}</button>
  </div>`;
}

function nombresHtml(ids) {
  return `<div class="nombres">${ids.map((id, i) => `<button type="button" class="leer" data-act="leer" data-que="ingles" data-id="${id}"${foco("nombre-" + i)}>${esc(nombreEs(id))}<small>${esc(animal(id).en)}</small></button>`).join("")}</div>`;
}

function filaControl(id, i, valor, editable, flecha, extra) {
  const a = animal(id);
  const menos = editable
    ? `<button type="button" class="pm" data-act="barra" data-i="${i}" data-delta="-1" aria-label="Bajar"><img src="img/boton-menos.svg" alt=""><span class="signo-tv">−</span></button>`
    : `<span class="pm"></span>`;
  const mas = editable
    ? `<button type="button" class="pm" data-act="barra" data-i="${i}" data-delta="1" aria-label="Subir"><img src="img/boton-mas.svg" alt=""><span class="signo-tv">+</span></button>`
    : `<span class="pm"></span>`;
  const tab = editable ? ` tabindex="0"${foco("barra-" + i)}` : "";
  const marca = extra
    ? `<div class="marca-num">${extra}<div class="pista-num">${valor}</div></div>`
    : `<div class="pista-num">${valor}</div>`;
  return `<div class="fila-barra tono-${colorDe(i)}${flecha ? " con-flecha" : ""}${extra ? " con-marcas" : ""}"${tab}>${menos}<div class="medio">
    <button type="button" class="nom" data-act="leer" data-que="ingles" data-id="${id}"${foco("nombre-" + i)}>${esc(nombreEs(id))}<small>${esc(a.en)}</small></button>
    ${marca}
  </div>${mas}</div>`;
}

function opcionesHtml(opciones, frases, marcar) {
  return `<div class="opciones${frases ? " frases" : ""}${marcar ? " con-flecha" : ""}">${opciones.map((op, i) => {
    const obj = op && typeof op === "object";
    const valor = obj ? op.id : op;
    const texto = obj ? op.texto : (typeof op === "number" ? String(op) : nombreEs(op));
    const cabeza = !obj && typeof valor === "string" && esIdAnimal(valor) ? `<img src="img/cabeza-${valor}.svg" alt="">` : "";
    return `<button type="button" class="opcion" data-act="opcion" data-valor="${esc(valor)}"${foco("op-" + i)}>${cabeza}${esc(texto)}</button>`;
  }).join("")}</div>`;
}

function botonListo(brilla) {
  return `<button type="button" class="listo${brilla ? " brilla" : ""}" data-act="listo"${brilla ? "" : " disabled"}${foco("listo")}>${esc(TEXTOS.listo)}</button>`;
}

function indicesDe(elemento) {
  if (!elemento || !elemento.par || elemento.par.length < 2 || !elemento.categorias) return null;
  const ids = elemento.categorias.map((c) => c.id);
  const ia = ids.indexOf(elemento.par[0]);
  const ib = ids.indexOf(elemento.par[1]);
  if (ia < 0 || ib < 0) return null;
  const cs = elemento.categorias.map((c) => c.cantidad);
  return { bajo: indiceMasBajo(cs, ia, ib), alto: indiceMasAlto(cs, ia, ib) };
}

function graficaDe(ids, cantidades, eje, modo, horizontal, pistaAhora) {
  const opts = {
    modo: modo === "dibujos" ? "dibujos" : "barras",
    linea: !!(pistaAhora && pistaAhora.linea),
    sombra: !!(pistaAhora && pistaAhora.sombra),
    luces: !!(pistaAhora && pistaAhora.luces),
    dif: null,
  };
  if (opts.linea && pistaAhora && pistaAhora._dif) opts.dif = pistaAhora._dif;
  opts.flecha = pistaAhora && pistaAhora.flecha;
  opts.par = pistaAhora && pistaAhora.par;
  if (horizontal) return htmlHorizontal(ids, cantidades, opts) + nombresHtml(ids);
  return svgVertical(ids, cantidades, eje || 10, opts);
}

// ---------- Guía ----------

function pararRelojGuia() {
  vozToken++;
  clearTimeout(relojGuia);
  relojGuia = 0;
  callar();
}

function programarAutoGuia() {
  clearTimeout(relojGuia);
  relojGuia = 0;
  if (!guia || guia.saliendo || guia.fin || !esMirar(guia.paso)) return;
  const cuando = instanteAuto(guia);
  if (cuando == null) return;
  const espera = Math.max(0, cuando - Date.now());
  relojGuia = setTimeout(() => {
    if (!guia || guia.saliendo) return;
    if (!debeAvanzarSolo(guia, Date.now())) { programarAutoGuia(); return; }
    avanzarGuia("tiempo");
  }, espera);
}

function empezarPasoGuia() {
  if (!guia || guia.fin) return;
  const token = ++vozToken;
  const linea = vozGuia(guia.paso, esTv());
  programarAutoGuia();
  hablar(linea, {
    activo: pr.voz !== false,
    onEstado(estado) {
      if (token !== vozToken || !guia || guia.saliendo || guia.fin) return;
      if (estado === "hablando") {
        guia = anotarVoz(guia, "hablando", Date.now());
        programarAutoGuia();
        return;
      }
      // onerror o una frase que no llega a onend: no es el fin. El reloj queda en 2 s.
      if (!cuentaComoFin(estado)) {
        guia = anotarVoz(guia, estado, Date.now());
        programarAutoGuia();
        return;
      }
      guia = anotarVoz(guia, "termino", Date.now());
      if (!esMirar(guia.paso)) return;
      if (debeAvanzarSolo(guia, Date.now())) avanzarGuia("tiempo");
      else programarAutoGuia();
    },
  });
}

function cerrarGuia(motivo) {
  pararRelojGuia();
  if (guardarAlTerminar(motivo)) {
    pr = marcarGuia(pr);
    guardar();
  }
  guia = null;
  ignorarGlobal = Date.now() + (motivo === "fin" || motivo === "saltar" ? TRAS_GUIA_MS : IGNORAR_MS);
  inicio();
}

function avanzarGuia(tipo, extra) {
  if (!guia || guia.saliendo || guia.fin) return;
  const antes = guia.paso;
  const next = aplicarGuia(guia, { tipo, ...extra }, Date.now());
  if (next === guia) return;
  guia = next;
  if (guia.fin) { cerrarGuia("fin"); return; }
  const cambio = guia.paso !== antes;
  if (cambio) sonoListo = false;
  pintarGuia();
  if (cambio) empezarPasoGuia();
}

function programarOpcionesGuia() {
  clearTimeout(relojOpciones);
  if (!guia || !guia.opcionesDesde || guia.saliendo) return;
  const espera = guia.opcionesDesde - Date.now();
  if (espera <= 0) {
    guia = { ...guia, opcionesDesde: 0 };
    return;
  }
  relojOpciones = setTimeout(() => {
    if (!guia || guia.saliendo) return;
    guia = { ...guia, opcionesDesde: 0 };
    pintarGuia();
  }, espera);
}

function pintarGuia() {
  if (!guia) return;
  programarOpcionesGuia();
  pantalla = "guia";
  if (guia.paso === "listo" && listoGuiaActivo(guia) && !sonoListo) {
    sonoListo = true;
    sonidoListo();
  }
  const quiere = guia.saliendo ? "seguir" : focoGuia(guia);
  focoQuiere = quiere;
  const saltar = guia.saliendo
    ? "<span></span>"
    : `<button type="button" class="boton saltar" data-act="saltar">${esc(TEXTOS.saltar)}</button>`;
  const frase = guia.mal ? "Mira otra vez. " + textoGuia(guia.paso, esTv()) : textoGuia(guia.paso, esTv());
  const mirar = esMirar(guia.paso);
  const armaGuia = guia.paso === "grafica" || guia.paso === "subir" || guia.paso === "listo";
  const sinEjes = armaGuia && !esTv();
  let zona = "";
  let controles = "";
  if (guia.paso === "cuidar") {
    zona = `<img class="cuidador" src="img/cuidador.svg" alt="">`;
  } else if (guia.paso === "contar") {
    const cols = 3;
    const monos = [0, 1, 2].map((i) => {
      const on = guia.marcados[i];
      return `<button type="button" class="animal${on ? " apagado" : ""}" data-act="marcar" data-i="${i}"${foco("animal-" + i)}><img class="bicho" src="img/animal-mono.svg" alt=""><img class="palomita" src="img/palomita.svg" alt="" ${on ? "" : "hidden"}></button>`;
    }).join("");
    zona = `<div class="recinto sobre"><img class="fondo" src="img/recinto-selva.svg" alt=""><div class="manada" style="--cols:${cols}">${monos}</div></div>`;
    controles = `<div class="palitos-vivo">${htmlPalitos(palitosGuia(guia))}</div>`;
    if (numerosGuiaActivos(guia, Date.now())) controles += opcionesHtml(OPCIONES_GUIA_CONTEO, false);
  } else if (guia.paso === "grafica" || guia.paso === "subir" || guia.paso === "listo" || guia.paso === "mas") {
    const ids = ["mono", "jirafa"];
    const cs = guia.barras.slice();
    const eje = 10;
    zona = lecturas("barras", sinEjes) + svgVertical(ids, cs, eje, { modo: "barras" });
    if (guia.paso === "subir" || guia.paso === "listo") {
      controles = filaControl("mono", 0, cs[0], guia.paso === "subir", false, cabezasDe("mono", cs[0]))
        + filaControl("jirafa", 1, cs[1], false, false, cabezasDe("jirafa", cs[1]));
      controles += botonListo(guia.paso === "listo");
    } else if (guia.paso === "mas") {
      controles = opcionesHtml(OPCIONES_GUIA_MAS, true);
    }
  }
  const dosGuia = sinEjes && (guia.paso === "subir" || guia.paso === "listo");
  $main.className = "p-guia" + (armaGuia ? " armando" : "");
  pintar(`
    <header class="cab"><span class="nivel-mini">${esc(TEXTOS.guia)}</span>${saltar}</header>
    <div class="encargo">${burbuja(frase, "", mirar)}</div>
    <div class="mesa"><div class="zona-grafica">${zona}</div><div class="controles${dosGuia ? " dos" : ""}">${controles}</div></div>
    ${dialogo()}
  `, quiere);
}

function empezarGuia() {
  pararRelojGuia();
  clearTimeout(relojPista);
  partida = null;
  sonoListo = false;
  guia = guiaNueva(Date.now());
  pintarGuia();
  empezarPasoGuia();
}

// ---------- Partida ----------

function elemActual() {
  return partida && partida.visita.elementos[partida.i];
}

function segundosElem() {
  if (!partida || !partida.elem) return 0;
  let pausa = partida.elem.pausedMs;
  if (partida.elem.pausaDesde) pausa += Date.now() - partida.elem.pausaDesde;
  return (Date.now() - partida.elem.t0 - pausa) / 1000;
}

function estadoPista() {
  const e = elemActual();
  return { marcados: partida.elem.marcados, alturas: partida.elem.alturas, fase: "" };
}

function pistaDe() {
  const e = elemActual();
  if (!e || !partida.elem) return { paso: "nada", texto: "", leer: "", flecha: null, linea: false, sombra: false, luces: false };
  const p = pista(e, estadoPista(), {
    nivel: partida.visita.nivel, segundos: segundosElem(), errores: partida.elem.errores, tv: esTv(),
  });
  if (partida.elem.fase === "muestra" && e.clase === "diferencia") {
    return { ...p, linea: true, sombra: true, flecha: "baja", _dif: indicesDe(e) };
  }
  if (e.clase === "diferencia") p._dif = indicesDe(e);
  return p;
}

function pararPista() {
  clearTimeout(relojPista);
  relojPista = 0;
}

function programarPista() {
  pararPista();
  if (!partida || partida.saliendo || !partida.elem) return;
  const seg = segundosElem();
  const nivelN = partida.visita.nivel;
  let espera = null;
  if (nivelN > 1 && seg < FLECHA_S) espera = (FLECHA_S - seg) * 1000;
  else if (nivelN > 1 && seg < COMPLETA_S) espera = (COMPLETA_S - seg) * 1000;
  if (espera == null) return;
  relojPista = setTimeout(() => {
    if (!partida || partida.saliendo) return;
    const p = pistaDe();
    if (p.leer && p.paso !== "corto" && p.leer !== pistaDicha) {
      pistaDicha = p.leer;
      hablar(p.leer, { activo: pr.voz !== false, onEstado() {} });
    }
    pintarJuego(idFoco());
    programarPista();
  }, Math.max(250, espera));
}

function coincidenAhora() {
  const e = elemActual();
  if (!e || !partida.elem) return false;
  const metas = e.tipo === "detective" && e.error === "altura" ? e.real : metasDe(e);
  if (!metas.length) return false;
  return barrasCoinciden(partida.elem.alturas, metas);
}

function prepararElem() {
  const e = elemActual();
  let alturas = [];
  if (e.tipo === "grafica") alturas = e.alturasIniciales.slice();
  else if (e.tipo === "detective" && e.error === "altura") alturas = e.mostrado.slice();
  partida.elem = {
    t0: Date.now(),
    pausedMs: 0,
    pausaDesde: 0,
    errores: 0,
    marcados: e.tipo === "contar" ? Array(e.cantidad).fill(false) : [],
    alturas,
    listoEra: false,
  };
  sonoListo = false;
  pistaDicha = "";
  hablar(e.leer || e.texto || "", { activo: pr.voz !== false, onEstado() {} });
  programarPista();
}

function enMuestra() {
  return !!(partida && partida.elem && partida.elem.fase === "muestra");
}

function programarMuestra() {
  clearTimeout(relojMuestra);
  if (!partida || !partida.elem || partida.elem.fase !== "muestra" || partida.saliendo) return;
  const espera = Math.max(0, (partida.elem.muestraHasta || 0) - Date.now());
  relojMuestra = setTimeout(() => {
    if (!partida || !partida.elem || partida.elem.fase !== "muestra" || partida.saliendo) return;
    if (Date.now() < partida.elem.muestraHasta) { programarMuestra(); return; }
    partida.elem.fase = "";
    partida.i++;
    if (partida.i >= partida.visita.elementos.length) terminarPartida();
    else { prepararElem(); pintarJuego(); }
  }, espera);
}

function programarOpcionesJuego() {
  clearTimeout(relojOpciones);
  if (guia || !partida || !partida.elem || !partida.elem.opcionesDesde || partida.saliendo) return;
  const espera = partida.elem.opcionesDesde - Date.now();
  if (espera <= 0) {
    partida.elem.opcionesDesde = 0;
    return;
  }
  relojOpciones = setTimeout(() => {
    if (!partida || !partida.elem || partida.saliendo) return;
    partida.elem.opcionesDesde = 0;
    pintarJuego("op-0");
  }, espera);
}

function acertar(ok) {
  const e = elemActual();
  if (enMuestra()) return;
  const seg = segundosElem();
  const p = pistaDe();
  const vio = marcaPasoCompleto(partida.visita.nivel, p.paso, seg);
  const primera = ok && partida.elem.errores === 0 && !vio;
  if (ok) {
    if (primera) partida.aciertos++;
    if (partida.modo === "visita") {
      // Un acierto con la pista de los 40 s no entra en la ventana. Un fallo, sí, una sola vez.
      pr = anotarElemento(pr, partida.visita.nivel, partida.elem.errores === 0, hoy(), vio);
      guardar();
    }
    bien();
    partida.elem.fase = "muestra";
    partida.elem.muestraHasta = Date.now() + MUESTRA_MS;
    partida.elem.feedback = textoAcierto(e);
    pintarJuego();
    programarMuestra();
    return;
  }
  partida.elem.errores++;
  const ayuda = pistaDe();
  if (ayuda.leer && ayuda.paso === "completo" && ayuda.leer !== pistaDicha) {
    pistaDicha = ayuda.leer;
    hablar(ayuda.leer, { activo: pr.voz !== false, onEstado() {} });
  }
  pintarJuego(idFoco());
  programarPista();
}

function manadaHtml(e) {
  const piezas = [];
  if (e.orden && e.orden.length) {
    for (const id of e.orden) piezas.push(id);
  } else if (e.mixto) {
    for (const c of e.categorias) {
      for (let k = 0; k < c.cantidad; k++) piezas.push(c.id);
    }
  } else {
    for (let k = 0; k < e.cantidad; k++) piezas.push(e.id);
  }
  let marca = 0;
  const cols = Math.min(5, Math.max(1, piezas.length));
  const celdas = piezas.map((id) => {
    if (id !== e.id) return `<span class="animal"><img class="bicho" src="img/animal-${id}.svg" alt=""></span>`;
    const i = marca++;
    const on = partida.elem.marcados[i];
    const flecha = pistaDe().flecha === "animal-" + i ? " con-flecha" : "";
    return `<button type="button" class="animal${on ? " apagado" : ""}${flecha}" data-act="marcar" data-i="${i}"${foco("animal-" + i)}><img class="bicho" src="img/animal-${id}.svg" alt="">${on ? `<img class="palomita" src="img/palomita.svg" alt="">` : ""}</button>`;
  }).join("");
  const fondo = `img/recinto-${animal(e.id).recinto}.svg`;
  return `<div class="recinto sobre"><img class="fondo" src="${fondo}" alt=""><div class="manada" style="--cols:${cols}">${celdas}</div></div>`;
}

function armaBarras(e) {
  return !!(e && (e.tipo === "grafica" || (e.tipo === "detective" && e.error === "altura")));
}

function zonaGraficaElem(e, p) {
  const ocultar = !esTv() && armaBarras(e);
  if (e.tipo === "contar") return manadaHtml(e);
  if (e.modo === "palitos" && e.tipo !== "grafica") {
    const ids = e.categorias.map((c) => c.id);
    const filas = ids.map((id, i) => `<div class="fila-tabla"><img class="cabeza" src="img/cabeza-${id}.svg" alt=""><div class="palitos-vivo">${htmlPalitos(e.categorias[i].cantidad)}</div><button type="button" class="nom" data-act="leer" data-que="ingles" data-id="${id}"${foco("nombre-" + i)}>${esc(nombreEs(id))}<small>${esc(animal(id).en)}</small></button></div>`).join("");
    return lecturas("palitos") + `<div class="tabla">${filas}</div>`;
  }
  if (e.tipo === "grafica" && e.modo === "palitos") return lecturas("palitos", ocultar);
  const ids = (e.categorias || []).map((c) => c.id);
  const cs = e.tipo === "grafica" || (e.tipo === "detective" && e.error === "altura")
    ? partida.elem.alturas
    : (e.categorias || []).map((c) => c.cantidad);
  const eje = e.eje || (e.tipo === "grafica" ? e.eje : 10) || 10;
  const modo = e.modo || (e.tipo === "detective" ? "barras" : "barras");
  const horizontal = !!(e.horizontal);
  if (e.tipo === "detective" && e.error === "falta") {
    return lecturas("barras", ocultar) + graficaDe(e.visibles, e.mostrado, e.eje || 10, "barras", false, p);
  }
  if (e.tipo === "detective" && e.error === "etiquetas") {
    return lecturas("barras", ocultar) + graficaDe(e.etiquetas, e.mostrado, e.eje || 10, "barras", false, p);
  }
  return lecturas(modo, ocultar) + graficaDe(ids, cs, eje, modo, horizontal, p);
}

function controlesElem(e, p) {
  const flecha = p.flecha || "";
  if (e.tipo === "contar") {
    const n = partida.elem.marcados.filter(Boolean).length;
    let html = `<div class="palitos-vivo">${htmlPalitos(n)}</div>`;
    const esperaNum = partida.elem.opcionesDesde && Date.now() < partida.elem.opcionesDesde;
    if (partida.elem.marcados.every(Boolean) && !esperaNum) html += opcionesHtml(e.opciones, false, p.flecha === "opciones");
    return html;
  }
  if (e.tipo === "grafica" || (e.tipo === "detective" && e.error === "altura")) {
    const ids = e.tipo === "detective" ? e.realIds : e.categorias.map((c) => c.id);
    const metasPal = e.tipo === "grafica" && e.modo === "palitos" ? e.categorias.map((c) => c.cantidad) : null;
    let html = ids.map((id, i) => {
      const extra = metasPal ? `<div class="palitos-vivo">${htmlPalitos(metasPal[i])}</div>` : "";
      return filaControl(id, i, partida.elem.alturas[i] || 0, true, flecha === "barra-" + i, extra);
    }).join("");
    const brilla = coincidenAhora();
    if (brilla && !partida.elem.listoEra) {
      partida.elem.listoEra = true;
      sonoListo = true;
      sonidoListo();
      focoQuiere = "listo";
    }
    if (!brilla) partida.elem.listoEra = false;
    html += botonListo(brilla);
    return html;
  }
  if (e.opciones) return opcionesHtml(e.opciones, e.opciones.some((o) => o && typeof o === "object"), flecha === "opciones");
  return "";
}

function focoDeJuego(e) {
  if (partida && partida.saliendo) return "seguir";
  if (!e) return "frase";
  if (e.tipo === "contar") {
    const i = partida.elem.marcados.findIndex((m) => !m);
    if (i >= 0) return "animal-" + i;
    if (partida.elem.opcionesDesde && Date.now() < partida.elem.opcionesDesde) {
      return "animal-" + (partida.elem.marcados.length - 1);
    }
    return "op-0";
  }
  if (e.tipo === "grafica" || (e.tipo === "detective" && e.error === "altura")) {
    if (coincidenAhora()) return "listo";
    return "barra-0";
  }
  return "op-0";
}

function pintarJuego(conservar) {
  const e = elemActual();
  if (!e) return;
  pantalla = "juego";
  const armando = armaBarras(e);
  const nFilas = (e.tipo === "detective" ? e.realIds : e.categorias) || [];
  const dos = armando && !esTv() && e.modo !== "palitos" && nFilas.length >= 2;
  $main.className = "p-juego" + (armando ? " armando" : "");
  const p = pistaDe();
  const quiere = conservar || focoDeJuego(e);
  focoQuiere = quiere;
  const titulo = partida.modo === "reto" ? partida.reto.nombre : nivel(partida.visita.nivel).nombre;
  const puntos = partida.visita.elementos.map((_, i) => `<i class="${i < partida.i ? "lleno" : ""} ${i === partida.i ? "ahora" : ""}"></i>`).join("");
  const enFeed = enMuestra() && partida.elem.feedback;
  const frase = enFeed ? partida.elem.feedback : (e.texto || "");
  const ayuda = enFeed ? "" : (p.texto && p.texto !== frase ? p.texto : "");
  pintar(`
    <header class="cab"><span class="nivel-mini">${esc(titulo)}</span><span class="puntos">${puntos}</span></header>
    <div class="encargo"><img class="cuidador" src="img/cuidador.svg" alt="">${burbuja(frase, ayuda, false)}</div>
    <div class="mesa"><div class="zona-grafica">${zonaGraficaElem(e, p)}</div><div class="controles${dos ? " dos" : ""}">${controlesElem(e, p)}</div></div>
    ${dialogo()}
  `, quiere);
  programarOpcionesJuego();
}

function empezarVisita(n) {
  pararRelojGuia();
  guia = null;
  const facil = quiereFacil(pr, n);
  const rnd = rngConSemilla("safari-visita-" + Date.now() + "-" + n);
  const visita = crearVisita(n, rnd, { facil, hechosDetective: pr.detective || 0 });
  partida = { modo: "visita", visita, i: 0, saliendo: false, ignorarHasta: 0, aciertos: 0, facil, elem: null };
  prepararElem();
  pintarJuego();
}

function empezarReto() {
  pararRelojGuia();
  guia = null;
  const reto = retoDelDia(hoy(), pr.nivel);
  partida = {
    modo: "reto", visita: reto.visita, i: 0, saliendo: false, ignorarHasta: 0,
    aciertos: 0, reto, elem: null,
  };
  prepararElem();
  pintarJuego();
}

function terminarPartida() {
  pararPista();
  callar();
  const hecha = partida;
  if (hecha.modo === "reto") {
    const puntos = hecha.aciertos;
    const cumplido = puntos >= hecha.reto.necesita;
    const antes = !!(pr.retos[hoy()] && pr.retos[hoy()].cumplido);
    pr = cumplirReto(pr, hoy(), hecha.reto.tipo, puntos, cumplido);
    guardar();
    if (cumplido && !antes) Noli.terminar({ estrellas: 3, reto: true });
    partida = null;
    finVista = { tipo: "reto", hecha, puntos, cumplido, saliendo: false, ignorarHasta: 0 };
    pintarFinReto(hecha, puntos, cumplido);
    return;
  }
  const de = hecha.visita.elementos.length;
  const r = cerrarVisita(pr, hecha.visita.nivel, hecha.aciertos, de);
  pr = r.pr;
  const abierto = abrirAnimal(pr, r.estrellas);
  pr = abierto.pr;
  guardar();
  Noli.terminar({ estrellas: r.estrellas });
  const comidas = pedidoComida(hecha.visita.categorias);
  partida = null;
  finVista = { tipo: "visita", r, nuevoId: abierto.nuevo, comidas, nivel: hecha.visita.nivel, saliendo: false, ignorarHasta: 0 };
  pintarFin(r, abierto.nuevo, comidas, hecha.visita.nivel);
}

function repintarFin() {
  if (!finVista) return;
  if (finVista.tipo === "reto") pintarFinReto(finVista.hecha, finVista.puntos, finVista.cumplido);
  else pintarFin(finVista.r, finVista.nuevoId, finVista.comidas, finVista.nivel);
}

function pintarFin(r, nuevoId, comidas, nivelN) {
  pantalla = "fin";
  $main.className = "p-fin";
  const dm = dominio(pr, nivelN || pr.nivel);
  const subio = r.subio ? `<div class="subio"><b>Subiste al nivel ${r.subio}</b><span>${esc(nivel(r.subio).nombre)}</span></div>` : "";
  const animalNuevo = nuevoId ? `<img class="nuevo" src="img/animal-${nuevoId}.svg" alt=""><p class="pedido">${esc(fraseLlego(nuevoId))}</p>` : "";
  const cajas = comidas.map(([id, n]) => `<div class="comida"><img src="img/comida-${id}.svg" alt=""><div class="caja">${htmlCaja(n)}</div><span>${esc(COMIDA[id] || id)}</span></div>`).join("");
  focoQuiere = finVista && finVista.saliendo ? "seguir" : "otra";
  pintar(`
    <h1 class="titulo">${esc(TEXTOS.pedido)}</h1>
    ${estrellasHtml(r.estrellas, true)}
    <p class="dominio${dm.aciertos >= 8 ? " ok" : ""}">${dm.aciertos} de ${VENTANA}</p>
    <div class="barra marca8" style="width:min(420px,100%)"><i style="width:${Math.min(100, Math.round(100 * dm.aciertos / VENTANA))}%"></i><b></b></div>
    ${subio}
    ${animalNuevo}
    <div class="comidas">${cajas}</div>
    <div class="menu">
      <button type="button" class="boton grande primario" data-act="otra"${foco("otra")}>${esc(TEXTOS.otra)}</button>
      <button type="button" class="boton grande" data-act="a-inicio"${foco("a-inicio")}>${esc(TEXTOS.regresar)}</button>
    </div>
    ${dialogo()}
  `, focoQuiere);
}

function pintarFinReto(hecha, puntos, cumplido) {
  pantalla = "fin";
  $main.className = "p-fin";
  focoQuiere = cumplido ? "a-inicio" : "reto-jugar";
  pintar(`
    <h1 class="titulo">${cumplido ? "¡Reto cumplido!" : "¡Casi!"}</h1>
    <p class="sub">${puntos} de ${hecha.reto.cuantos}. ${esc(hecha.reto.meta)}</p>
    ${estrellasHtml(cumplido ? 3 : puntos >= 2 ? 1 : 0, true)}
    <p class="racha">${racha(pr, hoy()) ? "Racha: " + racha(pr, hoy()) : esc(TEXTOS.rachaVacia)}</p>
    <div class="menu">
      ${cumplido ? "" : `<button type="button" class="boton grande primario" data-act="reto-jugar"${foco("reto-jugar")}>${esc(TEXTOS.otraVez)}</button>`}
      <button type="button" class="boton grande${cumplido ? " primario" : ""}" data-act="a-inicio"${foco("a-inicio")}>${esc(TEXTOS.regresar)}</button>
    </div>
    ${dialogo()}
  `, finVista && finVista.saliendo ? "seguir" : focoQuiere);
}

function introReto() {
  pantalla = "reto";
  $main.className = "p-reto";
  const reto = retoDelDia(hoy(), pr.nivel);
  const hecho = !!(pr.retos[hoy()] && pr.retos[hoy()].cumplido);
  focoQuiere = "reto-jugar";
  pintar(`
    <h1 class="titulo">${esc(TEXTOS.reto)}</h1>
    <div class="tarjeta-reto"><b>${esc(reto.nombre)}</b><p>${esc(reto.meta)}</p></div>
    <p class="racha">${racha(pr, hoy()) ? "Racha: " + racha(pr, hoy()) : esc(TEXTOS.rachaVacia)}</p>
    <div class="menu">
      <button type="button" class="boton grande primario" data-act="reto-jugar"${foco("reto-jugar")}>${hecho ? esc(TEXTOS.otraVez) : esc(TEXTOS.jugar)}</button>
      <button type="button" class="boton grande" data-act="a-inicio"${foco("a-inicio")}>${esc(TEXTOS.regresar)}</button>
    </div>
  `, "reto-jugar");
}

// ---------- Menús ----------

function zoo() {
  return `<div class="zoo">${ORDEN.slice(0, pr.abiertos).map((id) => `<img src="img/animal-${id}.svg" alt="${esc(nombreEs(id))}">`).join("")}</div>`;
}

function inicio(quiere) {
  pantalla = "inicio";
  partida = null;
  guia = null;
  finVista = null;
  $main.className = "p-inicio";
  const nv = nivel(pr.elegido || pr.nivel);
  const dm = dominio(pr, pr.elegido || pr.nivel);
  const retoHecho = !!(pr.retos[hoy()] && pr.retos[hoy()].cumplido);
  focoQuiere = quiere || "jugar";
  pintar(`
    <h1 class="titulo">${esc(TEXTOS.titulo)}</h1>
    ${zoo()}
    <p class="dominio${dm.listo ? " ok" : ""}">${esc(nv.nombre)} · ${dm.aciertos} de ${VENTANA}</p>
    <div class="barra marca8" style="width:min(420px,100%)"><i style="width:${Math.min(100, Math.round(100 * dm.aciertos / VENTANA))}%"></i><b></b></div>
    <p class="racha">${racha(pr, hoy()) ? "Racha: " + racha(pr, hoy()) : esc(TEXTOS.rachaVacia)}</p>
    <div class="menu menu-inicio">
      <button type="button" class="boton grande primario principal" data-act="jugar"${foco("jugar")}>${esc(TEXTOS.jugar)}<small>${esc(nv.nombre)}</small></button>
      <button type="button" class="boton grande reto" data-act="reto"${foco("reto")}>${esc(TEXTOS.reto)}${retoHecho ? "<small>hecho</small>" : ""}</button>
      <button type="button" class="boton grande" data-act="progreso"${foco("progreso")}>${esc(TEXTOS.progreso)}</button>
      <button type="button" class="boton grande" data-act="como"${foco("como")}>${esc(TEXTOS.como)}</button>
      <button type="button" class="boton grande" data-act="papas"${foco("papas")}>${esc(TEXTOS.papas)}</button>
      <button type="button" class="boton grande" data-act="voz"${foco("voz")}>${pr.voz ? esc(TEXTOS.vozSi) : esc(TEXTOS.vozNo)}</button>
    </div>
  `, focoQuiere);
}

function progreso() {
  pantalla = "progreso";
  $main.className = "p-progreso";
  const filas = resumen(pr).niveles.map((n) => {
    const cls = n.dominado ? "dominado" : n.desbloqueado ? "abierto" : "cerrado";
    const actual = n.n === (pr.elegido || pr.nivel) ? " actual" : "";
    const pct = n.pct == null ? "" : `<small>${n.pct}%</small>`;
    return `<button type="button" class="nivel ${cls}${actual}" data-act="elegir" data-n="${n.n}"${n.desbloqueado ? foco("nivel-" + n.n) : " disabled"}><b class="num">${n.n}</b><span class="nom">${esc(n.nombre)}${pct}</span>${estrellasHtml(n.estrellas, false)}</button>`;
  }).join("");
  focoQuiere = "nivel-" + (pr.elegido || pr.nivel);
  pintar(`
    <h1 class="titulo">${esc(TEXTOS.progreso)}</h1>
    ${htmlSemana()}
    <p class="racha">${racha(pr, hoy()) ? "Racha: " + racha(pr, hoy()) : esc(TEXTOS.rachaVacia)}</p>
    <ul class="mapa">${filas}</ul>
    <button type="button" class="boton grande" data-act="a-inicio"${foco("a-inicio")}>${esc(TEXTOS.regresar)}</button>
  `, focoQuiere);
}

function htmlSemana() {
  return `<div class="semana">${semana(pr, hoy()).map((d) => {
    const cls = d.reto ? "reto" : d.jugo ? "jugo" : "";
    const marca = d.reto ? `<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6l3 3 5-5" fill="none" stroke="#143024" stroke-width="2" stroke-linecap="round"/></svg>` : "";
    return `<div class="dia ${cls}"><span class="punto">${marca}</span></div>`;
  }).join("")}</div>`;
}

function papas() {
  pantalla = "papas";
  $main.className = "p-papas";
  const filas = resumen(pr).niveles.map((n) => `<tr><td>${n.n}. ${esc(n.nombre)}</td><td>${n.total ? n.aciertosVentana + " de " + n.intentos : "—"}</td><td>${n.dominado ? "sí" : n.desbloqueado ? "no" : "cerrado"}</td></tr>`).join("");
  focoQuiere = "a-inicio";
  pintar(`
    <h1 class="titulo">${esc(TEXTOS.papas)}</h1>
    <p class="nota">Cuenta animales, arma la gráfica y contesta. Sube con 8 de los últimos 10 a la primera. Tres fallos seguidos no bajan: la siguiente visita es más fácil. El reto del día no tiene reloj: un día es el censo (hasta 20) y otro, el detective (6 gráficas, 4 bien).</p>
    <table class="tabla-papas"><thead><tr><th>Nivel</th><th>Últimos</th><th>Domina</th></tr></thead><tbody>${filas}</tbody></table>
    <button type="button" class="boton grande" data-act="voz"${foco("voz")}>${pr.voz ? esc(TEXTOS.vozSi) : esc(TEXTOS.vozNo)}</button>
    <button type="button" class="boton grande" data-act="a-inicio"${foco("a-inicio")}>${esc(TEXTOS.regresar)}</button>
  `, "voz");
}

// ---------- Acciones ----------

function abrirDialogo() {
  if (pantalla === "fin" && finVista) {
    if (finVista.saliendo) return;
    finVista.saliendo = true;
    repintarFin();
    return;
  }
  if (guia) {
    if (guia.saliendo) return;
    pararRelojGuia();
    clearTimeout(relojOpciones);
    guia = abrirSalirGuia(guia, Date.now());
    pintarGuia();
    return;
  }
  if (!partida || partida.saliendo) return;
  pararPista();
  callar();
  clearTimeout(relojMuestra);
  clearTimeout(relojOpciones);
  if (partida.elem && !partida.elem.pausaDesde) partida.elem.pausaDesde = Date.now();
  if (partida.elem && partida.elem.fase === "muestra") {
    partida.elem.muestraRestante = Math.max(0, (partida.elem.muestraHasta || 0) - Date.now());
  }
  if (partida.elem && partida.elem.opcionesDesde) {
    partida.elem.opcionesRestante = Math.max(0, partida.elem.opcionesDesde - Date.now());
  }
  partida.saliendo = true;
  pintarJuego("seguir");
}

function seguir() {
  const ahora = Date.now();
  if (finVista && finVista.saliendo) {
    finVista.saliendo = false;
    finVista.ignorarHasta = ahora + IGNORAR_MS;
    repintarFin();
    return;
  }
  if (guia && guia.saliendo) {
    guia = seguirSalirGuia(guia, ahora);
    pintarGuia();
    empezarPasoGuia();
    return;
  }
  if (partida && partida.saliendo) {
    const cerrado = alCerrarDialogo(ahora);
    partida.saliendo = false;
    partida.ignorarHasta = cerrado.ignorarHasta;
    if (partida.elem && partida.elem.pausaDesde) {
      partida.elem.pausedMs += ahora - partida.elem.pausaDesde;
      partida.elem.pausaDesde = 0;
    }
    if (partida.elem && partida.elem.fase === "muestra") {
      const rest = partida.elem.muestraRestante || 0;
      partida.elem.muestraHasta = ahora + Math.max(rest, IGNORAR_MS);
      programarMuestra();
    }
    if (partida.elem && partida.elem.opcionesRestante != null) {
      partida.elem.opcionesDesde = ahora + partida.elem.opcionesRestante;
      partida.elem.opcionesRestante = null;
    }
    pintarJuego();
    programarPista();
  }
}

function salirMenu() {
  pararRelojGuia();
  pararPista();
  callar();
  const eraGuia = !!guia;
  guia = null;
  partida = null;
  finVista = null;
  clearTimeout(relojMuestra);
  clearTimeout(relojOpciones);
  if (eraGuia) ignorarGlobal = Date.now() + IGNORAR_MS;
  inicio();
}

function leer(que, id) {
  let texto = "";
  if (que === "titulo") texto = TEXTOS.tituloGrafica;
  else if (que === "ejey") texto = TEXTOS.ejeYVoz;
  else if (que === "ejex") texto = TEXTOS.ejeXVoz;
  else if (que === "leyenda") {
    const e = elemActual();
    let modo = "barras";
    if (e && e.modo === "palitos") modo = "palitos";
    else if (e && (e.modo === "dibujos" || (partida && partida.visita.modo === "dibujos"))) modo = "dibujos";
    texto = vozLeyenda(guia && guia.paso ? "barras" : modo);
  } else if (que === "ingles") texto = fraseIngles(id);
  if (!texto) return;
  hablar(texto, { activo: pr.voz !== false, onEstado() {} });
}

function alBarra(i, delta) {
  if (enMuestra()) return;
  if (guia) {
    avanzarGuia("barra", { indice: i, delta });
    return;
  }
  const e = elemActual();
  if (!e || !partida.elem) return;
  const antes = coincidenAhora();
  const tope = e.eje === 20 || (e.tipo === "detective") ? 20 : (e.eje || 10);
  partida.elem.alturas = moverBarra(partida.elem.alturas, i, delta, Math.max(tope, 10));
  clic();
  const ahoraOk = coincidenAhora();
  pintarJuego(ahoraOk && !antes ? "listo" : "barra-" + i);
}

function alMarcar(i) {
  if (guia) { avanzarGuia("marcar", { i }); return; }
  const e = elemActual();
  if (!e || e.tipo !== "contar" || partida.elem.marcados[i]) return;
  partida.elem.marcados[i] = true;
  clic();
  const falta = partida.elem.marcados.findIndex((m) => !m);
  if (falta < 0) partida.elem.opcionesDesde = Date.now() + OPCIONES_LOCK_MS;
  pintarJuego(falta >= 0 ? "animal-" + falta : "animal-" + i);
}

function alOpcion(valor) {
  if (guia) {
    if (guia.paso === "contar") avanzarGuia("numero", { n: valor });
    else avanzarGuia("opcion", { id: valor });
    return;
  }
  const e = elemActual();
  if (!e || enMuestra()) return;
  if (partida.elem && partida.elem.opcionesDesde && Date.now() < partida.elem.opcionesDesde) return;
  if (e.tipo === "contar") {
    if (!partida.elem.marcados.every(Boolean)) return;
    acertar(conteoCorrecto(e, valor));
    return;
  }
  acertar(respuestaEs(e, valor));
}

function alListo() {
  if (enMuestra()) return;
  if (guia) { avanzarGuia("listo"); return; }
  if (!coincidenAhora()) return;
  acertar(true);
}

function barraEnfocada() {
  const el = document.activeElement;
  if (!el || !$main.contains(el)) return -1;
  const propio = /^barra-(\d+)$/.exec(el.dataset.focoId || "");
  if (propio) return +propio[1];
  const fila = el.closest && el.closest(".fila-barra");
  if (!fila) return -1;
  const m = /^barra-(\d+)$/.exec(fila.dataset.focoId || "");
  return m ? +m[1] : -1;
}

function irFoco(id) {
  const el = $main.querySelector(`[data-foco-id="${id}"]`);
  if (!el || el.disabled) return false;
  el.focus();
  focoQuiere = id;
  return true;
}

// En la tele, izquierda y derecha cambian de fila. Abajo en la última fila
// llega a Listo, y arriba en Listo vuelve a la última fila.
function navegarBarras(accion) {
  const e = elemActual();
  const construye = guia
    ? guia.paso === "subir" || guia.paso === "listo"
    : !!(e && (e.tipo === "grafica" || (e.tipo === "detective" && e.error === "altura")));
  if (!construye) return false;
  if (accion !== "arriba" && accion !== "abajo" && accion !== "izquierda" && accion !== "derecha") return false;
  const filas = [...$main.querySelectorAll(".fila-barra[data-foco-id]")];
  if (!filas.length) return false;
  const via = resolverAct(accion);
  if (via !== "juego") return true;
  const i = barraEnfocada();
  if (idFoco() === "listo") {
    if (accion === "arriba") return irFoco(filas[filas.length - 1].dataset.focoId) || true;
    return false;
  }
  if (i < 0) return false;
  if (accion === "izquierda") return irFoco(filas[Math.max(0, i - 1)].dataset.focoId) || true;
  if (accion === "derecha") return irFoco(filas[Math.min(filas.length - 1, i + 1)].dataset.focoId) || true;
  if (accion === "abajo" && i === filas.length - 1 && irFoco("listo")) return true;
  if (accion === "arriba" || accion === "abajo") {
    alBarra(i, accion === "arriba" ? 1 : -1);
    return true;
  }
  return true;
}

$main.addEventListener("pointerup", (ev) => {
  if (!guia || guia.saliendo || !esMirar(guia.paso)) return;
  if (ev.target.closest("[data-act], .dialogo")) return;
  if (resolverAct("toque") !== "juego") return;
  avanzarGuia("toque");
}, true);

$main.addEventListener("click", (ev) => {
  if (ev.target.classList && ev.target.classList.contains("salir-velo")) {
    if (!esTv()) seguir();
    return;
  }
  const t = ev.target.closest("[data-act]");
  if (!t || !$main.contains(t) || t.disabled) return;
  const act = t.dataset.act;
  const via = resolverAct(act);
  if (via === "nada") return;
  if (via === "seguir") { seguir(); return; }
  if (via === "salir") { salirMenu(); return; }
  if (act === "jugar") {
    if (!pr.guiaHecha) empezarGuia();
    else empezarVisita(pr.elegido || pr.nivel);
  } else if (act === "reto") introReto();
  else if (act === "reto-jugar") empezarReto();
  else if (act === "progreso") progreso();
  else if (act === "papas") papas();
  else if (act === "como") empezarGuia();
  else if (act === "a-inicio") inicio();
  else if (act === "otra") empezarVisita(pr.elegido || pr.nivel);
  else if (act === "voz") {
    pr = ponerVoz(pr, !pr.voz);
    guardar();
    if (pantalla === "papas") papas();
    else inicio("voz");
  } else if (act === "elegir") {
    const n = +t.dataset.n;
    if (n >= 1 && n <= pr.nivel) { pr = { ...pr, elegido: n }; guardar(); inicio(); }
  } else if (act === "saltar") {
    if (guia) avanzarGuia("saltar");
  } else if (act === "mirar") avanzarGuia("toque");
  else if (act === "seguir") seguir();
  else if (act === "salir") salirMenu();
  else if (act === "leer") leer(t.dataset.que, t.dataset.id);
  else if (act === "barra") alBarra(+t.dataset.i, +t.dataset.delta);
  else if (act === "marcar") alMarcar(+t.dataset.i);
  else if (act === "opcion") {
    const crudo = t.dataset.valor;
    alOpcion(/^\d+$/.test(crudo) ? +crudo : crudo);
  } else if (act === "listo") alListo();
});

Noli.alEntrar((accion) => {
  document.documentElement.classList.add("teclado");
  if ((pantalla === "juego" || pantalla === "guia" || pantalla === "fin") && accion === "atras") {
    if (saliendoAhora()) seguir();
    else abrirDialogo();
    return true;
  }
  if (accion === "ok" && saliendoAhora()) {
    if (idFoco() === "salir") salirMenu();
    else seguir();
    return true;
  }
  if (accion === "ok") {
    const via = resolverAct("ok");
    if (via === "nada") return true;
    if (via === "seguir") { seguir(); return true; }
    if (via === "salir") { salirMenu(); return true; }
    if (guia && !guia.saliendo && esMirar(guia.paso)) {
      const id = idFoco();
      const lee = id === "titulo" || id === "eje-y" || id === "eje-x" || id === "leyenda" || id.startsWith("nombre-");
      if (!lee) { avanzarGuia("ok"); return true; }
    }
  }
  if (navegarBarras(accion)) return true;
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

Noli.datos.then((d) => { pr = cargar(d); return cargarCaja(); }).then(() => {
  if (esTv()) document.documentElement.classList.add("teclado");
  if (!pr.guiaHecha) empezarGuia();
  else inicio();
});
