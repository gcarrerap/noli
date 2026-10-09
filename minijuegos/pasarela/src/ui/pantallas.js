// HTML de cada pantalla (texto que ve Noelia). Funciones que reciben lo que necesitan y devuelven HTML; no
// cambian nada. Los botones llevan data-foco (para las flechas de la TV, kit/foco.js) y data-accion (lo que hace
// el botón, lo atiende src/ui/juego.js). Sin emojis (#5): los íconos son SVG (iconos.js).
import { icono, estrellas, ICONOS } from "./iconos.js";
import { miniPrenda, dibujarMuneca } from "./dibujo2d.js";
import { colorPuesto, patronPuesto, fraseIngles } from "../atuendo.js";
import { coloresDe, nivelDePrenda, esNuevo } from "../progreso.js";
import { reloj } from "../partida.js";
import { concuerda } from "../espanol.js";
import { prendasDeZona, aceptaPatron } from "../datos.js";
import { pintarSVG, pintarPixeles } from "../../../../kit/3d/pintar.js";
import { prendaDeDiseno, ajustesDe, variante, nombresSugeridos } from "../taller.js";

/** Ícono de una zona: el suyo (zonas.json → icono), el de su acción o el de su categoría */
export const iconoZona = (z) => z.icono || (z.accion === "espejo" ? "espejo" : z.accion === "pasarela" ? "pasarela" : z.categorias[0]);

/** Escapa texto para meterlo en HTML */
export const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const boton = (accion, texto, { clase = "", ico = "", inicial = false, extra = "" } = {}) =>
  `<button class="boton ${clase}" data-accion="${accion}" data-foco${inicial ? '="inicial"' : ""} ${extra}>${ico ? `<i class="ico">${icono(ico)}</i>` : ""}<span>${texto}</span></button>`;

/** Barra de nivel: "Creativa · 24 puntos · faltan 11 para Diseñadora" */
function barraNivel(nivel, puntos, niveles) {
  const actual = niveles[nivel.i].puntos, sig = nivel.siguiente;
  const pct = sig ? Math.round(((puntos - actual) / (sig.puntos - actual)) * 100) : 100;
  return `<div class="nivel"><div class="nivel-txt"><b>${esc(nivel.nombre)}</b><span>${puntos} ${puntos === 1 ? "punto" : "puntos"} de estilo</span></div>
    <div class="barra" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
    <small>${sig ? `Faltan ${sig.faltan} para <b>${esc(sig.nombre)}</b>` : "¡Ya tienes todo el clóset!"}</small></div>`;
}

/** Pantalla de inicio */
export function inicio({ saldo, costo, nivel, progreso, niveles, enCatalogo }) {
  const alcanza = saldo !== null && saldo >= costo;
  return `<section class="pantalla inicio" aria-labelledby="tInicio">
    <h1 id="tInicio" class="logo">Pasarela</h1>
    <p class="sub">Vístete según el tema y desfila frente a los jueces.</p>
    <div class="saldo-linea">${icono("moneda")}<b>${saldo === null ? "—" : saldo}</b><span>${saldo === 1 ? "crédito" : "créditos"}</span></div>
    <div class="menu">
      ${boton("jugar", `¡A la pasarela! <small class="costo">${icono("moneda")}${costo}</small>`, { clase: "grande primario" + (alcanza ? "" : " apagado"), ico: "pasarela", inicial: true })}
      ${boton("libre", "Probarme ropa", { clase: "grande", ico: "arriba" })}
      <div class="fila">${boton("closet", "Mi clóset", { ico: "closet" })}${boton("piel", "Mi piel", { ico: "piel" })}</div>
    </div>
    ${barraNivel(nivel, progreso.puntos, niveles)}
    ${!enCatalogo ? `<p class="nota">Abierto sin el catálogo: los créditos son de prueba.</p>` : ""}
  </section>`;
}

/** No alcanzan los créditos */
export function faltan({ saldo, costo, juegosQueDan }) {
  const f = costo - (saldo || 0);
  return `<section class="pantalla faltan" aria-labelledby="tFaltan">
    <div class="grande-ico">${icono("moneda")}</div>
    <h1 id="tFaltan">Te ${f === 1 ? "falta" : "faltan"} ${f} ${f === 1 ? "crédito" : "créditos"}</h1>
    <p>Gana créditos jugando ${esc(juegosQueDan)}: uno por cada estrella, y más con el reto del día.</p>
    <div class="menu">${boton("ir-a-jugar", "Ir a jugar", { clase: "grande primario", inicial: true })}${boton("libre", "Mientras, probarme ropa", { clase: "grande", ico: "arriba" })}</div>
  </section>`;
}

/** El tema de esta pasarela */
export function tema({ tema, segundos, nuevo }) {
  return `<section class="pantalla tema" aria-labelledby="tTema">
    <p class="antes">El tema es…</p>
    <div class="tema-ico">${icono(tema.icono)}</div>
    <h1 id="tTema">${esc(tema.nombre)}${nuevo ? ' <span class="nuevo">¡Nuevo!</span>' : ""}</h1>
    <p class="frase">${esc(tema.frase)}</p>
    <p class="tiempo">${icono("reloj")}Tienes <b>${reloj(segundos)}</b> para vestirte</p>
    <div class="menu">${boton("listo", "¡A vestirme!", { clase: "grande primario", inicial: true })}</div>
  </section>`;
}

/** Arriba de la pantalla mientras se viste */
export function hud({ tema, quedan, avisoTiempo, libre, tv, botones }) {
  return `${tema ? `<div class="chip-tema">${icono(tema.icono)}<span>${esc(tema.nombre)}</span></div>` : `<div class="chip-tema">${icono("arriba")}<span>Probador libre</span></div>`}
    ${quedan !== null ? `<div class="chip-reloj${quedan <= avisoTiempo ? " poco" : ""}" role="timer">${icono("reloj")}<b>${reloj(quedan)}</b></div>` : ""}
    <div class="hud-botones">
      ${!botones ? `<button class="redondo" data-accion="ir-a" aria-label="Ir a…" title="Ir a…">${icono("mapa")}</button>` : ""}
      ${libre ? `<button class="redondo" data-accion="salir-estudio" aria-label="Salir" title="Salir">${icono("cerrar")}</button>`
        : `<button class="redondo dorado" data-accion="a-pasarela" aria-label="A la pasarela" title="A la pasarela">${icono("pasarela")}</button>`}
    </div>
    ${tv && !botones ? `<p class="ayuda-tv">Flechas: caminar · OK: abrir · Atrás: salir</p>` : ""}`;
}

/** Botones de las zonas (modo sencillo 2D, o el menú "Ir a…") */
export function zonasBotones(zonas, { libre, comoMenu }) {
  const ico = iconoZona;
  const lista = zonas.filter((z) => !(libre && z.accion === "pasarela"));
  return `<div class="${comoMenu ? "menu-ira" : "zonas2d"}" role="${comoMenu ? "dialog" : "group"}" aria-label="Zonas del estudio">
    ${comoMenu ? `<h2>¿A dónde vamos?</h2>` : ""}
    <div class="zonas-grid">${lista.map((z, i) => `<button class="zona-btn" data-accion="zona" data-zona="${z.id}" data-foco${i === 0 ? '="inicial"' : ""}>${icono(ico(z))}<span>${esc(z.nombre)}</span></button>`).join("")}</div>
    ${comoMenu ? boton("cerrar-ira", "Cerrar", { clase: "chico" }) : ""}
  </div>`;
}

/** Letrero que flota sobre cada mueble */
export function letrero(z) {
  const ico = iconoZona(z);
  return `<button class="letrero" data-accion="zona" data-zona="${z.id}" tabindex="-1">${icono(ico)}<span>${esc(z.nombre)}</span></button>`;
}

/** Aviso abajo al acercarse a una zona */
export function aviso(z, { libre, tv }) {
  const txt = z.accion === "espejo" ? "Mirarme en el espejo" : z.accion === "taller" ? "Diseñar ropa" : z.accion === "pasarela" ? (libre ? "Salir del probador" : "¡A la pasarela!") : `Ver ${z.nombre.toLowerCase()}`;
  return `<button class="aviso-zona" data-accion="zona" data-zona="${z.id}">${icono(iconoZona(z))}<span>${esc(txt)}</span>${tv ? "<kbd>OK</kbd>" : ""}</button>`;
}

/** Panel con la ropa de una zona (un perchero) */
export function panel({ zona, idx, atuendo, ab, progreso, sel, voz, girar, colorElegido = null, patronElegido = null, espaciosTotal = 0 }) {
  const prendas = prendasDeZona(zona, idx);
  const actual = sel && idx.prendas.get(sel);
  const colorSel = actual ? colorPuesto(atuendo, actual) || (colorElegido && coloresDe(actual, ab).includes(colorElegido) && colorElegido) || coloresDe(actual, ab)[0] : null;
  const puestaSel = actual && colorPuesto(atuendo, actual);
  const patronSel = actual ? (puestaSel ? patronPuesto(atuendo, actual) : patronElegido) : null;
  // Con las flechas, el foco empieza en la prenda escogida (o en la primera abierta)
  const primera = sel || (prendas.find((p) => ab.prendas.has(p.id)) || {}).id;
  const tarjetas = prendas.map((p) => {
    const abierta = ab.prendas.has(p.id), puesta = colorPuesto(atuendo, p);
    if (!abierta) {
      const n = nivelDePrenda(p.id, idx.niveles);
      return `<button class="prenda bloqueada" data-accion="bloqueada" data-prenda="${p.id}" data-foco aria-label="${esc(p.es)}: se abre en el nivel ${esc(n ? n.nombre : "")}">
        <span class="mini-caja">${miniPrenda(p, "plateado", idx)}<i class="candado">${icono("candado")}</i></span>
        <span class="nombre">${esc(p.es)}</span><small>Nivel ${esc(n ? n.nombre : "")} · ${n ? n.puntos : 0} pts</small></button>`;
    }
    const color = puesta || (p.id === sel && colorSel) || coloresDe(p, ab)[0];
    const patron = puesta ? patronPuesto(atuendo, p) : p.id === sel ? patronSel : null;
    return `<button class="prenda${puesta ? " puesta" : ""}${p.id === sel ? " sel" : ""}" data-accion="prenda" data-prenda="${p.id}" data-foco${p.id === primera ? '="inicial"' : ""}
        aria-pressed="${!!puesta}" aria-label="${esc(p.es)}, en inglés ${esc(p.en)}">
      <span class="mini-caja">${miniPrenda(p, color, idx, patron)}${puesta ? `<i class="check">${icono("palomita")}</i>` : ""}${esNuevo(progreso, p.id) ? '<i class="badge">¡Nuevo!</i>' : ""}</span>
      <span class="nombre">${esc(p.nombre || p.es)}</span><small lang="en">${esc(p.en)}</small></button>`;
  }).join("");
  let colores = "";
  if (actual && ab.prendas.has(actual.id)) {
    const cs = coloresDe(actual, ab);
    const c = idx.colores.get(colorSel);
    const pid = patronSel || actual.patronFijo, pa = pid && idx.patrones.get(pid); // patronFijo: diseños del Taller
    colores = `<div class="colores" role="group" aria-label="Colores">
      ${cs.map((cid) => { const cc = idx.colores.get(cid); return `<button class="color${cid === colorSel ? " sel" : ""}" data-accion="color" data-color="${cid}" data-foco style="--c:${cc.hex}" aria-label="${esc(cc.es)}, en inglés ${esc(cc.en)}" title="${esc(cc.es)} · ${esc(cc.en)}">${esNuevo(progreso, "c:" + cid) ? '<i class="punto-nuevo"></i>' : ""}</button>`; }).join("")}
    </div>
    ${patrones({ prenda: actual, idx, ab, progreso, hex: c ? c.hex : "#cccccc", sel: patronSel })}
    <p class="ingles"><span lang="en"><b>${esc(c ? c.en : "")} ${pa ? esc(pa.en) + " " : ""}${esc(actual.en)}</b></span> = ${esc(actual.es)} ${esc(c ? colorConcuerda(c.es, actual) : "")}${pa ? " de " + esc(pa.es) : ""}
      ${voz ? `<button class="redondo chico" data-accion="decir" data-foco aria-label="Escuchar en inglés">${icono("bocina")}</button>` : ""}</p>`;
  }
  // Mis diseños (#80): cuántos espacios lleva, y descoser el escogido
  let disenos = "";
  if (zona.disenos) {
    const n = prendas.length;
    disenos = n ? `<p class="nota chica centro">${n} de ${espaciosTotal || n} espacios usados.${actual ? "" : " Toca un diseño para ponértelo."}</p>
      ${actual ? `<div class="fila centro">${boton("t-descoser", "Descoser", { clase: "chico", ico: "tijeras", extra: `data-prenda="${actual.id}"` })}</div>` : ""}`
      : "";
  }
  const vacio = zona.disenos && !prendas.length ? `<p class="vacio">Aún no tienes diseños. Ve al <b>Taller de diseño</b> (la mesa con la máquina de coser) y crea tu propia ropa.</p>` : "";
  return `<div class="panel-cab"><h2>${icono(iconoZona(zona))}${esc(zona.nombre)}</h2>
      <span class="panel-botones">${girar ? `<button class="redondo" data-accion="girar" data-grados="-45" data-foco aria-label="Girar a la izquierda" title="Girar">${icono("girarIzq")}</button>
      <button class="redondo" data-accion="girar" data-grados="45" data-foco aria-label="Girar a la derecha" title="Girar">${icono("girarDer")}</button>` : ""}
      <button class="redondo" data-accion="cerrar-panel" data-foco aria-label="Listo">${icono("palomita")}</button></span></div>
    <div class="prendas">${tarjetas}${vacio}</div>
    ${colores}${disenos}
    <p class="nota">Toca una prenda para ponértela; tócala otra vez para quitártela.${girar ? " Arrastra al personaje para girarlo." : ""}</p>`;
}

/** El color concuerda con la prenda si termina en "o": "camiseta blanca", "shorts blancos"; "rosa" y "azul" no cambian */
const colorConcuerda = (color, p) => (/o$/.test(color) ? concuerda(color, p) : color);

/**
 * Los patrones para la prenda escogida (si los acepta): "lisa" y los abiertos, cada uno pintado con el color
 * escogido. Los que faltan se cuentan abajo (sin candados uno por uno: el panel ya es largo en el teléfono).
 */
function patrones({ prenda, idx, ab, progreso, hex, sel }) {
  if (!idx.patrones || !idx.patrones.size || !aceptaPatron(prenda, idx.config)) return "";
  const lista = [...idx.patrones.values()].filter((x) => ab.patrones.has(x.id) && x.svg);
  const faltan = idx.patrones.size - lista.length;
  const muestra = (x) => (x ? pintarSVG(x.svg, { p: hex }) : `<svg viewBox="0 0 64 64"><rect width="64" height="64" fill="${hex}"/></svg>`);
  const b = (x) => {
    const id = x ? x.id : "", es = x ? x.es : "lisa", en = x ? x.en : "plain", on = (sel || "") === id;
    return `<button class="patron${on ? " sel" : ""}" data-accion="patron" data-patron="${id}" data-foco aria-pressed="${on}" aria-label="${esc(es)}, en inglés ${esc(en)}" title="${esc(es)} · ${esc(en)}">${muestra(x)}${x && esNuevo(progreso, "pt:" + x.id) ? '<i class="punto-nuevo"></i>' : ""}</button>`;
  };
  return `<div class="patrones" role="group" aria-label="Patrones">${b(null)}${lista.map(b).join("")}</div>
    ${faltan ? `<p class="nota chica">${faltan} ${faltan === 1 ? "patrón más se abre" : "patrones más se abren"} subiendo de nivel.</p>` : ""}`;
}

/** Desfile: texto encima mientras camina */
/** Al final de la pasarela: escoger poses y bailes (las abiertas; se pueden hacer varias) */
export function poses({ idx, ab, progreso, actual }) {
  const lista = [...idx.poses.values()].filter((o) => ab.poses.has(o.id));
  const faltan = idx.poses.size - lista.length;
  return `<div class="poses" role="group" aria-label="Poses y bailes">
    <h2>¡Escoge tu pose!</h2>
    <div class="poses-grid">${lista.map((o, i) => `<button class="pose${o.id === actual ? " sel" : ""}" data-accion="pose" data-pose="${o.id}" data-foco${i === 0 ? '="inicial"' : ""}>
      ${o.baile ? `<i class="ico">${icono("musica")}</i>` : `<i class="ico">${icono("estrella")}</i>`}<span>${esc(o.es)}<small lang="en">${esc(o.en)}</small></span>${esNuevo(progreso, "o:" + o.id) ? '<i class="badge">¡Nueva!</i>' : ""}</button>`).join("")}</div>
    ${faltan ? `<p class="nota">${faltan} ${faltan === 1 ? "pose más se abre" : "poses más se abren"} subiendo de nivel.</p>` : ""}
    ${boton("fin-poses", "¡Listo!", { clase: "grande primario" })}
  </div>`;
}

export function desfile({ tema }) {
  return `<div class="desfile-txt"><span>${icono(tema.icono)}${esc(tema.nombre)}</span><b>¡Noelia en la pasarela!</b></div>`;
}

/** Calificación de los jueces */
export function calificacion({ resultado, idx, tema, frase, voz, nivel, progreso, ganados, reducir }) {
  const juez = (j, i) => {
    const d = idx.jueces.find((x) => x.id === j.id);
    return `<article class="juez" style="--c:${d.color};--d:${reducir ? 0 : 0.4 + i * 0.9}s">
      <div class="cara" style="background:${d.color}">${ICONOS.persona}</div>
      <div><h3>${esc(j.nombre)}</h3>${estrellas(j.estrellas)}<p>${esc(j.positivo)}</p></div></article>`;
  };
  return `<section class="pantalla calificacion" aria-labelledby="tCal">
    <h1 id="tCal">${icono(tema.icono)} ${esc(tema.nombre)}</h1>
    <div class="jueces">${resultado.jueces.map(juez).join("")}</div>
    <div class="consejo"><b>Consejo:</b> ${esc(resultado.consejo)}</div>
    ${frase ? `<p class="ingles grande-txt"><span>Hoy traes puesto:</span> <b lang="en">${esc(frase)}</b>
      ${voz ? `<button class="redondo chico" data-accion="decir-frase" data-foco aria-label="Escuchar en inglés">${icono("bocina")}</button>` : ""}</p>` : ""}
    <p class="ganaste">+${ganados} puntos de estilo</p>
    ${barraNivel(nivel, progreso.puntos, idx.niveles)}
    <div class="menu">${boton("continuar", "Continuar", { clase: "grande primario", inicial: true })}</div>
  </section>`;
}

/** Subió de nivel: lo que se abrió */
export function desbloqueo({ nivel, nuevos, idx }) {
  const prendas = nuevos.prendas.map((id) => idx.prendas.get(id)).filter(Boolean);
  return `<section class="pantalla desbloqueo" aria-labelledby="tDes">
    <p class="antes">¡Subiste de nivel!</p>
    <h1 id="tDes">${esc(nivel.nombre)}</h1>
    ${prendas.length ? `<h2>Ropa nueva</h2><div class="nuevas">${prendas.map((p) => `<figure>${miniPrenda(p, p.colores[0], idx)}<figcaption>${esc(p.es)}<small lang="en">${esc(p.en)}</small></figcaption></figure>`).join("")}</div>` : ""}
    ${nuevos.colores.length ? `<h2>Colores nuevos</h2><div class="nuevos-colores">${nuevos.colores.map((c) => { const cc = idx.colores.get(c); return `<span><i style="--c:${cc.hex}"></i>${esc(cc.es)} <small lang="en">${esc(cc.en)}</small></span>`; }).join("")}</div>` : ""}
    ${(nuevos.poses || []).length ? `<h2>${nuevos.poses.length === 1 ? "Pose nueva" : "Poses nuevas"}</h2><div class="nuevos-temas">${nuevos.poses.map((o) => { const oo = idx.poses.get(o); return `<span>${icono(oo.baile ? "musica" : "estrella")}${esc(oo.es)} <small lang="en">${esc(oo.en)}</small></span>`; }).join("")}</div>` : ""}
    ${(nuevos.patrones || []).length ? `<h2>${nuevos.patrones.length === 1 ? "Patrón nuevo" : "Patrones nuevos"}</h2><div class="nuevos-patrones">${nuevos.patrones.map((x) => { const pa = idx.patrones.get(x); return pa ? `<span>${pa.svg ? pintarSVG(pa.svg, { p: "#ff7eb6" }) : ""}${esc(pa.es)} <small lang="en">${esc(pa.en)}</small></span>` : ""; }).join("")}</div>` : ""}
    ${(nuevos.estampados || []).length ? `<h2>${nuevos.estampados.length === 1 ? "Estampado nuevo" : "Estampados nuevos"}</h2><div class="nuevos-patrones">${nuevos.estampados.map((x) => { const e = idx.estampados.get(x); return e ? `<span class="estampado">${e.svg ? pintarSVG(e.svg, { p: "#ffffff" }) : e.url ? `<img src="${e.url}" alt="">` : ""}${esc(e.es)} <small lang="en">${esc(e.en)}</small></span>` : ""; }).join("")}</div><p class="nota">Para ponerlos en tu ropa: el Taller de diseño.</p>` : ""}
    ${nuevos.temas.length ? `<h2>Tema nuevo</h2><div class="nuevos-temas">${nuevos.temas.map((t) => { const tt = idx.temas.get(t); return `<span>${icono(tt.icono)}${esc(tt.nombre)}</span>`; }).join("")}</div>` : ""}
    <div class="menu">${boton("continuar", "¡Genial!", { clase: "grande primario", inicial: true })}</div>
  </section>`;
}

/** El clóset: los últimos atuendos */
export function closet({ progreso, idx, piel }) {
  const fotos = progreso.atuendos;
  return `<section class="pantalla closet" aria-labelledby="tCloset">
    <h1 id="tCloset">${icono("closet")} Mi clóset</h1>
    ${fotos.length ? `<div class="fotos">${fotos.map((f, i) => { const t = idx.temas.get(f.tema); return `<figure class="foto">
      ${dibujarMuneca(f.atuendo, idx, { piel, base: idx.config.colorBase, titulo: t.nombre, clase: "muneca chica" })}
      <figcaption><b>${esc(t.nombre)}</b>${estrellas(Math.round(f.puntos / 3))}<small lang="en">${esc(fraseIngles(f.atuendo, idx))}</small>
      <button class="boton chico" data-accion="ponerme" data-i="${i}" data-foco${i === 0 ? '="inicial"' : ""}>Ponérmelo</button></figcaption></figure>`; }).join("")}</div>`
      : `<p class="vacio">Aquí se guardan tus atuendos después de cada pasarela.</p>`}
    <div class="menu">${boton("salir-closet", "Regresar", { clase: "grande", inicial: !fotos.length })}</div>
  </section>`;
}

/** Preguntar antes de salir a la mitad de una pasarela */
export function confirmarSalir() {
  return `<div class="confirmar" role="alertdialog" aria-labelledby="tConf"><h2 id="tConf">¿Salir de esta pasarela?</h2>
    <p>Los créditos que usaste no se regresan.</p>
    <div class="menu fila">${boton("salir-si", "Sí, salir", { clase: "" })}${boton("salir-no", "Seguir jugando", { clase: "primario", inicial: true })}</div></div>`;
}

/** Aviso cuando el aparato va muy lento */
export function lento() {
  return `<div class="confirmar" role="alertdialog" aria-labelledby="tLento"><h2 id="tLento">Este aparato va un poco lento</h2>
    <p>¿Quieres cambiar al modo sencillo? Se ve en 2D, pero se juega igual.</p>
    <div class="menu fila">${boton("modo-2d", "Modo sencillo", { clase: "primario", inicial: true })}${boton("seguir-3d", "Seguir en 3D")}</div></div>`;
}

/** Error al cargar los datos (para quien está editando los JSON) */
export function error(msg, lista = []) {
  return `<section class="pantalla error"><h1>Algo salió mal</h1><p>${esc(msg)}</p>
    ${lista.length ? `<ul>${lista.slice(0, 12).map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}
    <div class="menu">${boton("ir-a-jugar", "Regresar", { clase: "grande", inicial: true })}</div></section>`;
}

// ---------- Taller de diseño (#80) ----------

/** Los pasos del taller, en orden */
export const PASOS_TALLER = [
  { id: "molde", es: "Molde" }, { id: "forma", es: "Forma" }, { id: "decorar", es: "Decorar" }, { id: "nombre", es: "Nombre" }, { id: "coser", es: "Coser" },
];

const opcionTxt = (o) => `${esc(o.es)}<small lang="en">${esc(o.en)}</small>`;

/** Un renglón de colores para el taller */
function filaColores(lista, sel, accion, idx, etiqueta) {
  return `<div class="colores" role="group" aria-label="${etiqueta}">${lista.map((cid) => {
    const cc = idx.colores.get(cid);
    return cc ? `<button class="color${cid === sel ? " sel" : ""}" data-accion="${accion}" data-color="${cid}" data-foco style="--c:${cc.hex}" aria-pressed="${cid === sel}" aria-label="${esc(cc.es)}, en inglés ${esc(cc.en)}" title="${esc(cc.es)} · ${esc(cc.en)}"></button>` : "";
  }).join("")}</div>`;
}

/** Muestra de un estampado (SVG pintado, PNG o pixeles) para los botones */
function muestraEstampado(e, hex = "#ff7eb6") {
  if (!e) return `<svg viewBox="0 0 64 64"><path d="M14 14l36 36M50 14L14 50" stroke="#c9bba5" stroke-width="5" stroke-linecap="round"/></svg>`;
  if (e.svg) return pintarSVG(e.svg, { p: "#ffffff" });
  if (e.url) return `<img src="${esc(e.url)}" alt="">`;
  if (e.pixeles) return `<svg viewBox="0 0 64 64">${miniPixeles(e.pixeles, hex)}</svg>`;
  return "";
}

function miniPixeles(px, hex) {
  const k = 64 / px.lado;
  let r = "";
  pintarPixeles(px, { p: hex, s: "#ffffff" }).forEach((c, i) => { if (c) r += `<rect x="${(i % px.lado) * k}" y="${Math.floor(i / px.lado) * k}" width="${k + 0.1}" height="${k + 0.1}" fill="${c}"/>`; });
  return `<g shape-rendering="crispEdges">${r}</g>`;
}

/**
 * El panel del taller.
 * @param {{ idx, diseno, paso: string, ab, saldo: number|null, costo: number, libres: number, total: number, lugar: string|null, girar: boolean, faltan?: number|null }} o
 */
export function taller({ idx, diseno, paso, ab, saldo, costo, libres, total, lugar, girar, faltan = null, dibujo = null, dibujos = 0 }) {
  if (paso === "dibujo" && dibujo) return editorDibujo({ idx, ab, d: dibujo, hexP: (idx.colores.get(diseno.color) || {}).hex || "#ff7eb6", hexS: (idx.colores.get(diseno.secundario) || {}).hex || "#ffffff" });
  const molde = idx.moldes.get(diseno.molde);
  const prenda = prendaDeDiseno(diseno, idx);
  const iPaso = PASOS_TALLER.findIndex((x) => x.id === paso);
  const tabs = PASOS_TALLER.map((x, i) => `<button class="paso${x.id === paso ? " sel" : ""}" data-accion="t-paso" data-paso="${x.id}" data-foco aria-current="${x.id === paso ? "step" : "false"}"><b>${i + 1}</b><span>${x.es}</span></button>`).join("");
  let cuerpo = "";
  if (paso === "molde") {
    cuerpo = `<p class="indicacion">¿Qué vas a coser?</p><div class="prendas moldes">${[...idx.moldes.values()].map((m) => {
      const d2 = { ...diseno, molde: m.id, ajustes: ajustesDe(m, m.id === diseno.molde ? diseno.ajustes : {}), calcas: m.id === diseno.molde ? diseno.calcas : [] };
      const pr = prendaDeDiseno(d2, idx);
      return `<button class="prenda${m.id === diseno.molde ? " sel" : ""}" data-accion="t-molde" data-molde="${m.id}" data-foco${m.id === diseno.molde ? '="inicial"' : ""} aria-pressed="${m.id === diseno.molde}">
        <span class="mini-caja">${miniPrenda(pr, diseno.color, idx)}</span><span class="nombre">${esc(m.es)}</span><small lang="en">${esc(m.en)}</small></button>`;
    }).join("")}</div>`;
  } else if (paso === "forma") {
    const aj = ajustesDe(molde, diseno.ajustes);
    cuerpo = molde.controles.map((c, ci) => `<div class="control"><h3>${esc(c.es)} <small lang="en">${esc(c.en)}</small></h3><div class="opciones">${c.opciones.map((o) => {
      const pr = prendaDeDiseno({ ...diseno, ajustes: { ...aj, [c.id]: o.id } }, idx);
      const on = aj[c.id] === o.id;
      return `<button class="opcion${on ? " sel" : ""}" data-accion="t-opcion" data-control="${c.id}" data-opcion="${o.id}" data-foco${on && ci === 0 ? '="inicial"' : ""} aria-pressed="${on}">
        <span class="mini-caja">${miniPrenda(pr, diseno.color, idx)}</span><span class="nombre">${opcionTxt(o)}</span></button>`;
    }).join("")}</div></div>`).join("");
  } else if (paso === "decorar") {
    const colores = [...ab.colores];
    const conS = molde.piezas.some((pz) => pz.col === "s");
    const pats = [...idx.patrones.values()].filter((x) => ab.patrones.has(x.id) && x.svg);
    const hex = (idx.colores.get(diseno.color) || {}).hex || "#cccccc";
    const pat = (x) => {
      const id = x ? x.id : "", on = (diseno.patron || "") === id;
      return `<button class="patron${on ? " sel" : ""}" data-accion="t-patron" data-patron="${id}" data-foco aria-pressed="${on}" aria-label="${esc(x ? x.es : "lisa")}" title="${esc(x ? x.es + " · " + x.en : "lisa · plain")}">${x ? pintarSVG(x.svg, { p: hex }) : `<svg viewBox="0 0 64 64"><rect width="64" height="64" fill="${hex}"/></svg>`}</button>`;
    };
    const lugares = molde.lugares || [];
    const lsel = lugares.find((l) => l.id === lugar) || lugares[0];
    const puesta = lsel && (diseno.calcas.find((c) => c.lugar === lsel.id) || {}).estampado;
    const ests = [...idx.estampados.values()].filter((e) => (ab.estampados.has(e.id) || e.propio) && (e.svg || e.url || e.pixeles));
    cuerpo = `<h3>Color <small lang="en">color</small></h3>${filaColores(colores, diseno.color, "t-color", idx, "Color")}
      ${conS ? `<h3>Detalles <small lang="en">trim</small></h3>${filaColores(colores, diseno.secundario, "t-secundario", idx, "Color de los detalles")}` : ""}
      <h3>Patrón <small lang="en">pattern</small></h3><div class="patrones" role="group" aria-label="Patrones">${pat(null)}${pats.map(pat).join("")}</div>
      ${lugares.length ? `<h3>Calcomanías <small lang="en">stickers</small></h3>
        <div class="lugares" role="group" aria-label="Dónde va la calcomanía">${lugares.map((l) => {
          const c = diseno.calcas.find((x) => x.lugar === l.id);
          return `<button class="lugar${l === lsel ? " sel" : ""}" data-accion="t-lugar" data-lugar="${l.id}" data-foco aria-pressed="${l === lsel}">${c ? `<i class="ico">${muestraEstampado(idx.estampados.get(c.estampado))}</i>` : ""}<span>${opcionTxt(l)}</span></button>`;
        }).join("")}</div>
        <div class="estampados" role="group" aria-label="Calcomanías">${[null, ...ests].map((e) => {
          const id = e ? e.id : "", on = (puesta || "") === id;
          return `<button class="estampado${on ? " sel" : ""}${e && e.propio ? " propio" : ""}" data-accion="t-estampado" data-estampado="${id}" data-foco aria-pressed="${on}" aria-label="${esc(e ? e.es : "sin calcomanía")}" title="${esc(e ? e.es + " · " + e.en : "ninguna")}">${muestraEstampado(e, hex)}</button>`;
        }).join("")}<button class="estampado nuevo" data-accion="t-dibujar" data-foco aria-label="Dibujar mi estampado" title="Dibujar mi estampado">${icono("lapiz")}</button></div>
        ${puesta && idx.estampados.get(puesta) && idx.estampados.get(puesta).propio ? `<div class="fila centro">${boton("t-editar-dibujo", "Cambiar mi dibujo", { clase: "chico", ico: "lapiz", extra: `data-estampado="${puesta}"` })}${boton("t-borrar-dibujo", "Borrar", { clase: "chico", ico: "borrador", extra: `data-estampado="${puesta}"` })}</div>` : ""}
        <p class="nota chica centro">Tus dibujos: ${dibujos} de ${(idx.config.taller || {}).maxDibujos || 6}.</p>` : `<p class="nota">A este molde no se le ponen calcomanías.</p>`}`;
  } else if (paso === "nombre") {
    const max = (idx.config.taller || {}).maxTemas || 2;
    cuerpo = `<h3>¿Cómo se llama?</h3>
      <input id="t-nombre" class="campo" type="text" maxlength="${(idx.config.taller || {}).maxNombre || 18}" value="${esc(diseno.nombre)}" placeholder="${esc(variante(molde, diseno.ajustes).es)}" data-foco autocomplete="off" enterkeyhint="done">
      <div class="sugeridos">${nombresSugeridos(diseno, idx).map((n) => `<button class="chip" data-accion="t-nombre-sug" data-nombre="${esc(n)}" data-foco>${esc(n)}</button>`).join("")}</div>
      <h3>¿Para qué temas es? <small>(${max} como mucho)</small></h3>
      <div class="temas-taller">${[...idx.temas.values()].filter((t) => ab.temas.has(t.id)).map((t) => {
        const on = diseno.temas.includes(t.id);
        return `<button class="tema-btn${on ? " sel" : ""}" data-accion="t-tema" data-tema="${t.id}" data-foco aria-pressed="${on}">${icono(t.icono)}<span>${esc(t.nombre)}</span></button>`;
      }).join("")}</div>
      <p class="nota">Los jueces se fijan en esto: tu diseño va perfecto con los temas que escojas.</p>`;
  } else {
    const v = variante(molde, diseno.ajustes), c = idx.colores.get(diseno.color), pa = diseno.patron && idx.patrones.get(diseno.patron);
    const en = [c && c.en, pa && pa.en, v.en].filter(Boolean).join(" ");
    const lleno = libres <= 0;
    const corto = saldo !== null && saldo < costo;
    cuerpo = `<div class="coser">
      <div class="coser-mini">${miniPrenda(prenda, diseno.color, idx)}</div>
      <div><h3>${esc(diseno.nombre || v.es)}</h3>
        <p class="ingles"><b lang="en">${esc(en)}</b></p>
        <p>${diseno.temas.length ? diseno.temas.map((t) => { const tt = idx.temas.get(t); return tt ? `<span class="chip-mini">${icono(tt.icono)}${esc(tt.nombre)}</span>` : ""; }).join(" ") : `<span class="nota">Sin temas: escoge uno en el paso 4 para que les guste a los jueces.</span>`}</p>
        <p class="costo">${icono("moneda")} Coser cuesta <b>${costo}</b> créditos${saldo !== null ? ` · tienes <b>${saldo}</b>` : ""}</p>
        <p class="nota">Espacios en Mis diseños: ${total - libres} de ${total}.</p></div></div>
      ${lleno ? `<p class="aviso-taller">Ya llenaste tus ${total} espacios. Descose un diseño en <b>Mis diseños</b> para hacer otro. Al subir de nivel tendrás más espacios.</p>`
        : corto || faltan ? `<p class="aviso-taller">Te faltan <b>${faltan || costo - saldo}</b> créditos. Tu diseño se queda guardado: gana créditos en los otros juegos y regresa a coserlo.</p>` : ""}
      <div class="menu">${boton("t-coser", `Coser · ${costo}`, { clase: "grande primario", ico: "hilo", inicial: true, extra: lleno || corto ? "disabled" : "" })}</div>`;
  }
  const anterior = PASOS_TALLER[iPaso - 1], siguiente = PASOS_TALLER[iPaso + 1];
  return `<div class="panel-cab"><h2>${icono("taller")}Taller de diseño</h2>
      <span class="panel-botones">${girar ? `<button class="redondo" data-accion="girar" data-grados="-45" data-foco aria-label="Girar a la izquierda" title="Girar">${icono("girarIzq")}</button>
      <button class="redondo" data-accion="girar" data-grados="45" data-foco aria-label="Girar a la derecha" title="Girar">${icono("girarDer")}</button>` : ""}
      <button class="redondo" data-accion="t-cerrar" data-foco aria-label="Salir del taller" title="Salir (tu diseño se guarda)">${icono("cerrar")}</button></span></div>
    <nav class="pasos" aria-label="Pasos">${tabs}</nav>
    <div class="taller-cuerpo">${cuerpo}</div>
    <div class="taller-pie">${anterior ? boton("t-paso", "Atrás", { clase: "chico", extra: `data-paso="${anterior.id}"` }) : "<span></span>"}
      ${siguiente ? boton("t-paso", "Siguiente", { clase: "chico primario", extra: `data-paso="${siguiente.id}"` }) : "<span></span>"}</div>`;
}

/** La primera vez en el taller: cómo se juega */
export function guiaTaller({ costo }) {
  const paso = (ico, txt) => `<li><i class="ico">${icono(ico)}</i><span>${txt}</span></li>`;
  return `<div class="confirmar guia" role="dialog" aria-labelledby="tGuia">
    <h2 id="tGuia">${icono("taller")} ¡Tu taller de diseño!</h2>
    <ol class="guia-pasos">
      ${paso("arriba", "Escoge un <b>molde</b>: playera, vestido, falda…")}
      ${paso("girarDer", "Cambia su <b>forma</b>: corta o larga, con o sin mangas.")}
      ${paso("estrella", "<b>Decórala</b> con colores, patrones y calcomanías.")}
      ${paso("lapiz", "Ponle <b>nombre</b> y escoge para qué temas es.")}
      ${paso("hilo", `<b>Cósela</b> por ${costo} créditos. ¡Queda en <b>Mis diseños</b> para siempre!`)}
    </ol>
    <p class="nota">Probar es gratis: lo que hagas se guarda aunque salgas.</p>
    ${boton("t-guia-ok", "¡A diseñar!", { clase: "grande primario", inicial: true })}
  </div>`;
}

/** ¿Descoser un diseño? */
export function confirmarDescoser(p) {
  return `<div class="confirmar" role="dialog" aria-labelledby="tDesc">
    <h2 id="tDesc">¿Descoser «${esc(p.nombre || p.es)}»?</h2>
    <p>Se libera su espacio, pero <b>no regresan los créditos</b> y ya no la vas a tener.</p>
    <div class="fila">${boton("t-descoser-no", "No, me la quedo", { clase: "primario", inicial: true })}${boton("t-descoser-si", "Sí, descoser", { ico: "tijeras", extra: `data-prenda="${p.id}"` })}</div>
  </div>`;
}

// ---------- Dibujar estampados (#81; src/pixeles.js) ----------

const HERRAMIENTAS = [
  { id: "lapiz", es: "Lápiz", ico: "lapiz" }, { id: "borrador", es: "Borrador", ico: "borrador" }, { id: "cubeta", es: "Rellenar", ico: "cubeta" },
];

/**
 * El editor de pixeles: la cuadrícula, las herramientas, los colores (los de la prenda y los abiertos) y guardar.
 * Cada celda es un botón (en la TV se pinta con flechas y OK); con el dedo se pinta arrastrando (juego.js).
 */
export function editorDibujo({ idx, ab, d, hexP, hexS }) {
  const hexDe = (f) => (!f ? "" : f === "P" ? hexP : f === "S" ? hexS : (idx.colores.get(f) || {}).hex || "#2b2236");
  const celdas = d.celdas.map((f, i) => `<button class="px" data-accion="d-px" data-i="${i}" data-foco${i === 0 ? '="inicial"' : ""} tabindex="-1" style="${f ? `--c:${hexDe(f)}` : ""}" aria-label="cuadro ${i + 1}"></button>`).join("");
  const colorBtn = (f, etiqueta, hex) => `<button class="color${d.ficha === f ? " sel" : ""}${f === "P" || f === "S" ? " de-prenda" : ""}" data-accion="d-color" data-ficha="${f}" data-foco style="--c:${hex}" aria-pressed="${d.ficha === f}" aria-label="${esc(etiqueta)}" title="${esc(etiqueta)}">${f === "P" || f === "S" ? `<b>${f === "P" ? "1" : "2"}</b>` : ""}</button>`;
  const colores = [colorBtn("P", "el color de la prenda (cambia con la prenda)", hexP), colorBtn("S", "el color de los detalles (cambia con la prenda)", hexS),
    ...[...ab.colores].map((c) => { const cc = idx.colores.get(c); return cc ? colorBtn(c, `${cc.es} · ${cc.en}`, cc.hex) : ""; })].join("");
  const herr = HERRAMIENTAS.map((h) => `<button class="herramienta${d.herramienta === h.id ? " sel" : ""}" data-accion="d-herramienta" data-herramienta="${h.id}" data-foco aria-pressed="${d.herramienta === h.id}" title="${h.es}"><i class="ico">${icono(h.ico)}</i><span>${h.es}</span></button>`).join("");
  return `<div class="panel-cab"><h2>${icono("lapiz")}${d.id ? "Cambiar mi dibujo" : "Dibujar mi estampado"}</h2>
      <span class="panel-botones"><button class="redondo" data-accion="d-cancelar" data-foco aria-label="Cancelar" title="Cancelar">${icono("cerrar")}</button></span></div>
    <div class="taller-cuerpo editor">
      <div class="herramientas" role="toolbar" aria-label="Herramientas">${herr}
        <button class="herramienta${d.espejo ? " sel" : ""}" data-accion="d-espejo" data-foco aria-pressed="${!!d.espejo}" title="Espejo: pinta igual de los dos lados"><i class="ico">${icono("simetria")}</i><span>Espejo</span></button>
        <button class="herramienta" data-accion="d-deshacer" data-foco ${d.historial.length ? "" : "disabled"} title="Deshacer"><i class="ico">${icono("girarIzq")}</i><span>Deshacer</span></button></div>
      <div class="cuadricula-caja"><div class="cuadricula${d.espejo ? " con-espejo" : ""}" style="--n:${d.lado}" role="grid" aria-label="Cuadrícula para dibujar">${celdas}</div></div>
      <div class="colores paleta" role="group" aria-label="Colores">${colores}</div>
      <p class="nota chica centro">Los colores <b>1</b> y <b>2</b> cambian con la prenda.</p>
      <div class="fila-nombre"><input id="d-nombre" class="campo" type="text" maxlength="${(idx.config.taller || {}).maxNombre || 18}" value="${esc(d.nombre)}" placeholder="Nombre de tu dibujo" data-foco autocomplete="off" enterkeyhint="done">
        ${boton("d-guardar", "Guardar", { clase: "primario", ico: "palomita" })}</div>
    </div>`;
}

/** ¿Borrar un dibujo? */
export function confirmarBorrarDibujo(e, enUso) {
  return `<div class="confirmar" role="dialog" aria-labelledby="tBorrar">
    <h2 id="tBorrar">¿Borrar «${esc(e.es)}»?</h2>
    <p>${enUso ? `Lo tienen <b>${enUso}</b> ${enUso === 1 ? "diseño" : "diseños"}: se quedarán sin esa calcomanía.` : "Ya no lo vas a poder usar."}</p>
    <div class="fila">${boton("d-borrar-no", "No, me lo quedo", { clase: "primario", inicial: true })}${boton("d-borrar-si", "Sí, borrar", { ico: "borrador", extra: `data-estampado="${e.id}"` })}</div>
  </div>`;
}

