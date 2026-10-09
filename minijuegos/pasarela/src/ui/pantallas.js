// HTML de cada pantalla (texto que ve Noelia). Funciones que reciben lo que necesitan y devuelven HTML; no
// cambian nada. Los botones llevan data-foco (para las flechas de la TV, kit/foco.js) y data-accion (lo que hace
// el botón, lo atiende src/ui/juego.js). Sin emojis (#5): los íconos son SVG (iconos.js).
import { icono, estrellas, ICONOS } from "./iconos.js";
import { miniPrenda, dibujarMuneca } from "./dibujo2d.js";
import { colorPuesto, fraseIngles } from "../atuendo.js";
import { coloresDe, nivelDePrenda, esNuevo } from "../progreso.js";
import { reloj } from "../partida.js";

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
  const ico = (z) => (z.accion === "espejo" ? "espejo" : z.accion === "pasarela" ? "pasarela" : z.categorias[0]);
  const lista = zonas.filter((z) => !(libre && z.accion === "pasarela"));
  return `<div class="${comoMenu ? "menu-ira" : "zonas2d"}" role="${comoMenu ? "dialog" : "group"}" aria-label="Zonas del estudio">
    ${comoMenu ? `<h2>¿A dónde vamos?</h2>` : ""}
    <div class="zonas-grid">${lista.map((z, i) => `<button class="zona-btn" data-accion="zona" data-zona="${z.id}" data-foco${i === 0 ? '="inicial"' : ""}>${icono(ico(z))}<span>${esc(z.nombre)}</span></button>`).join("")}</div>
    ${comoMenu ? boton("cerrar-ira", "Cerrar", { clase: "chico" }) : ""}
  </div>`;
}

/** Letrero que flota sobre cada mueble */
export function letrero(z) {
  const ico = z.accion === "espejo" ? "espejo" : z.accion === "pasarela" ? "pasarela" : z.categorias[0];
  return `<button class="letrero" data-accion="zona" data-zona="${z.id}" tabindex="-1">${icono(ico)}<span>${esc(z.nombre)}</span></button>`;
}

/** Aviso abajo al acercarse a una zona */
export function aviso(z, { libre, tv }) {
  const txt = z.accion === "espejo" ? "Mirarme en el espejo" : z.accion === "pasarela" ? (libre ? "Salir del probador" : "¡A la pasarela!") : `Ver ${z.nombre.toLowerCase()}`;
  return `<button class="aviso-zona" data-accion="zona" data-zona="${z.id}">${icono(z.accion === "espejo" ? "espejo" : z.accion === "pasarela" ? "pasarela" : z.categorias[0])}<span>${esc(txt)}</span>${tv ? "<kbd>OK</kbd>" : ""}</button>`;
}

/** Panel con la ropa de una zona (un perchero) */
export function panel({ zona, idx, atuendo, ab, progreso, sel, voz }) {
  const prendas = zona.categorias.flatMap((c) => idx.porCategoria.get(c));
  const actual = sel && idx.prendas.get(sel);
  const colorSel = actual ? colorPuesto(atuendo, actual) || coloresDe(actual, ab)[0] : null;
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
    return `<button class="prenda${puesta ? " puesta" : ""}${p.id === sel ? " sel" : ""}" data-accion="prenda" data-prenda="${p.id}" data-foco${p.id === primera ? '="inicial"' : ""}
        aria-pressed="${!!puesta}" aria-label="${esc(p.es)}, en inglés ${esc(p.en)}">
      <span class="mini-caja">${miniPrenda(p, color, idx)}${puesta ? `<i class="check">${icono("palomita")}</i>` : ""}${esNuevo(progreso, p.id) ? '<i class="badge">¡Nuevo!</i>' : ""}</span>
      <span class="nombre">${esc(p.es)}</span><small lang="en">${esc(p.en)}</small></button>`;
  }).join("");
  let colores = "";
  if (actual && ab.prendas.has(actual.id)) {
    const cs = coloresDe(actual, ab);
    const c = idx.colores.get(colorSel);
    colores = `<div class="colores" role="group" aria-label="Colores">
      ${cs.map((cid) => { const cc = idx.colores.get(cid); return `<button class="color${cid === colorSel ? " sel" : ""}" data-accion="color" data-color="${cid}" data-foco style="--c:${cc.hex}" aria-label="${esc(cc.es)}, en inglés ${esc(cc.en)}" title="${esc(cc.es)} · ${esc(cc.en)}">${esNuevo(progreso, "c:" + cid) ? '<i class="punto-nuevo"></i>' : ""}</button>`; }).join("")}
    </div>
    <p class="ingles"><span lang="en"><b>${esc(c ? c.en : "")} ${esc(actual.en)}</b></span> = ${esc(actual.es)} ${esc(c ? c.es : "")}
      ${voz ? `<button class="redondo chico" data-accion="decir" data-foco aria-label="Escuchar en inglés">${icono("bocina")}</button>` : ""}</p>`;
  }
  return `<div class="panel-cab"><h2>${icono(zona.categorias[0])}${esc(zona.nombre)}</h2>
      <button class="redondo" data-accion="cerrar-panel" data-foco aria-label="Listo">${icono("palomita")}</button></div>
    <div class="prendas">${tarjetas}</div>
    ${colores}
    <p class="nota">Toca una prenda para ponértela; tócala otra vez para quitártela.</p>`;
}

/** Desfile: texto encima mientras camina */
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
