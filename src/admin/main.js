// Página de administrador (admin.html): entrar con Google, escoger una cuenta (perfil de la nube) en el menú, confirmar
// el acceso y ver todo lo guardado en categorías colapsables: la cuenta, créditos, el mundo (cristales) y una por cada
// juego (nivel, estrellas, monedas…). Todo se puede sobrescribir. Cada cambio se sube como el más nuevo (dispositivo
// "admin"), así que los dispositivos vinculados lo reciben solos; a uno que perdió el progreso se le da el link de
// recuperación. DESIGN.md §7, issue #160.
import { sesionAdmin, entrarAdmin, salirAdmin, listarPerfiles, nombrarPerfil, leerJuegos, subirJuego, crearPerfil,
  nuevoIdPerfil, linkRecuperacion } from "../services/index.js";
import { DISPOSITIVO_ADMIN, ponerSaldo, saldoDe, resumenPasarela, conPasarela, libroDe, conLibro, fecha, resumenPerfil,
  CAMPOS_JUEGO, valorCampo, conCampos, resumenJuego, estrellasDe, conEstrellas, cristalesEncontrados, conCristales,
  leerJson, conIslas, armarIslas, normalizarMundo, disponibles } from "../engine/index.js";

export const ADMIN = "carrera.perabeles@gmail.com"; // igual que esAdminNoli() en firestore.rules
const LIBROS = ["halloween"];                       // libros de la Biblioteca (minijuegos/biblioteca/libros/)
const CATALOGO = "_catalogo", MUNDO = "_mundo", CREDITOS = "_creditos";
const NOMBRES = { [CREDITOS]: "Créditos", [CATALOGO]: "Estrellas del catálogo", [MUNDO]: "Mundo (cristales, islas, estrellas del mundo)" };
const BASE = new URL("../../", import.meta.url);
const SITIO = new URL("./", BASE).href;

const S = {
  estado: "cargando", fs: null, usuario: null, perfiles: [], elegido: "", abierto: null, abiertas: new Set(["cuenta"]),
  aviso: "", error: "", ocupado: false,
  ctx: { desbloqueos: null, libros: [], juegos: [], cristales: [], islas: null },
};
const app = document.getElementById("app");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (s) => app.querySelector(s);

async function json(ruta) { const r = await fetch(new URL(ruta, BASE), { cache: "no-cache" }); if (!r.ok) throw new Error(ruta); return r.json(); }
async function cargarContexto() {
  try { S.ctx.desbloqueos = await json("minijuegos/pasarela/datos/desbloqueos.json"); } catch (e) { console.warn(e); }
  S.ctx.libros = [];
  for (const id of LIBROS) {
    try { const l = await json(`minijuegos/biblioteca/libros/${id}/libro.json`); S.ctx.libros.push({ id, titulo: l.titulo || id, capitulos: l.capitulos.length, caps: l.capitulos.map((c) => ({ n: c.n, titulo: c.titulo })) }); }
    catch (e) { console.warn(e); }
  }
  try {
    const { juegos } = await json("minijuegos/catalogo.json");
    S.ctx.juegos = await Promise.all(juegos.map(async (id) => {
      try { const j = await json(`minijuegos/${id}/juego.json`); return { id, titulo: j.titulo || id, icono: j.icono ? `minijuegos/${id}/${j.icono}` : "", estrellas: j.creditos === "gana" && !j.premios, gana: j.creditos === "gana" }; }
      catch { return { id, titulo: id, icono: "", estrellas: false, gana: false }; }
    }));
  } catch (e) { console.warn(e); }
  try { S.ctx.cristales = ((await json("mundo/mundo.json")).cristales || []).map((c) => ({ id: c.id, color: c.color, en: c.en })); }
  catch (e) { console.warn(e); }
  try { S.ctx.islas = armarIslas(await json("mundo/islas.json")); } catch (e) { console.warn(e); }
}

// ---------- Datos ----------

async function cargarPerfiles() {
  S.ocupado = true; dibujar();
  try {
    const lista = await listarPerfiles(S.fs);
    S.perfiles = await Promise.all(lista.map(async (p) => {
      const juegos = await leerJuegos(S.fs, p.perfil);
      return { ...p, juegos, r: resumenPerfil(p, juegos, S.ctx) };
    }));
    S.perfiles.sort((a, b) => (b.r.ultima || b.creado) - (a.r.ultima || a.creado));
    if (!S.perfiles.some((p) => p.perfil === S.elegido)) S.elegido = S.perfiles[0] ? S.perfiles[0].perfil : "";
    if (S.abierto && !S.perfiles.some((p) => p.perfil === S.abierto)) S.abierto = null;
    S.error = "";
  } catch (e) {
    console.warn(e);
    S.error = e && e.code === "permission-denied"
      ? "Firestore no deja listar los perfiles. ¿Ya publicaste las reglas nuevas (firestore.rules) en Firebase?"
      : "No se pudieron leer los perfiles: " + (e.message || e);
  }
  S.ocupado = false; dibujar();
}

// Vuelve a leer un perfil (justo antes de escribir, para no pisar algo que llegó mientras tanto)
async function recargar(perfil) {
  const p = S.perfiles.find((x) => x.perfil === perfil);
  p.juegos = await leerJuegos(S.fs, perfil);
  p.r = resumenPerfil(p, p.juegos, S.ctx);
  return p;
}
const docDe = (p, juego) => p.juegos.find((x) => x.juego === juego) || null;
const datosDe = (p, juego) => { const j = docDe(p, juego); return j ? j.datos : null; };

/**
 * Sobrescribe uno o varios juegos del perfil. pasos: [[juego, armar(datosEnLaNube) → datos nuevos o null]].
 * Se vuelve a leer la nube antes de armar, para no pisar lo que llegó mientras tanto.
 */
async function guardar(perfil, pasos, mensaje) {
  if (S.ocupado) return;
  S.ocupado = true; S.aviso = ""; S.error = ""; dibujar();
  try {
    const p = await recargar(perfil);
    const listos = pasos.map(([juego, armar]) => [juego, armar(datosDe(p, juego))]).filter(([, d]) => d !== null);
    if (!listos.length) S.aviso = "No había nada que cambiar.";
    else {
      const ahora = Date.now();
      for (const [juego, datos] of listos) await subirJuego(S.fs, perfil, juego, datos, ahora, DISPOSITIVO_ADMIN);
      await recargar(perfil);
      S.aviso = mensaje;
    }
  } catch (e) {
    console.warn(e);
    S.error = "No se guardó: " + (e.message || e);
  }
  S.ocupado = false; dibujar();
}

// ---------- Pantallas ----------

function dibujar() {
  let html;
  if (S.estado === "cargando") html = `<p class="centro">Cargando…</p>`;
  else if (S.estado === "fuera") html = `
    <section class="tarjeta centro">
      <p>Entra con tu cuenta de Google de administrador para ver y cambiar el progreso guardado en la nube.</p>
      <button class="primario" id="entrar">Entrar con Google</button>
    </section>`;
  else if (S.estado === "noadmin") html = `
    <section class="tarjeta centro">
      <p>La cuenta <b>${esc(S.usuario.email)}</b> no es la de administrador.</p>
      <button class="boton" id="salir">Salir y entrar con otra</button>
    </section>`;
  else html = selector() + (S.abierto ? detalle(S.perfiles.find((p) => p.perfil === S.abierto)) : "");
  const sesion = S.usuario ? `<p class="sesion">${esc(S.usuario.email)} · <button class="link" id="salir">Salir</button></p>` : "";
  app.innerHTML = `
    <header class="cabeza"><h1>Noli · Administrador</h1>${sesion}</header>
    ${S.aviso ? `<p class="aviso ok" role="status">${esc(S.aviso)}</p>` : ""}
    ${S.error ? `<p class="aviso mal" role="alert">${esc(S.error)}</p>` : ""}
    ${html}`;
  conectar();
}

function selector() {
  if (S.ocupado && !S.perfiles.length) return `<p class="centro">Leyendo perfiles…</p>`;
  const dis = S.ocupado ? " disabled" : "";
  const opciones = S.perfiles.map(({ r }) => `<option value="${esc(r.perfil)}"${r.perfil === S.elegido ? " selected" : ""}>${esc(r.nombre || "Sin nombre")} · ${esc(r.perfil.slice(0, 6))} · 🪙 ${r.creditos} · ${esc(fecha(r.ultima || r.creado))}</option>`).join("");
  return `
    <section class="tarjeta">
      ${S.perfiles.length ? `
        <label>Usuario <select id="cuenta"${dis}>${opciones}</select></label>
        <p class="fila"><button class="primario" id="confirmar"${dis}>Confirmar acceso</button>
          <button class="boton" id="recargar"${dis}>Actualizar</button>
          <button class="boton" id="nuevo"${dis}>Cuenta nueva</button></p>
        <p class="nota">Cada usuario es un perfil de la nube (los dispositivos vinculados entre sí comparten uno). El más reciente va primero.</p>`
      : `<p class="nota">No hay perfiles en la nube todavía.</p>
        <p class="fila"><button class="boton" id="recargar"${dis}>Actualizar</button> <button class="boton" id="nuevo"${dis}>Cuenta nueva</button></p>`}
    </section>`;
}

/** Una categoría colapsable. Se acuerda de cuáles están abiertas al volver a dibujar. */
function categoria(clave, titulo, resumen, cuerpo, icono = "") {
  return `
    <details class="cat tarjeta" data-cat="${esc(clave)}"${S.abiertas.has(clave) ? " open" : ""}>
      <summary>${icono ? `<img class="cat-icono" src="${esc(new URL(icono, BASE).href)}" alt="">` : ""}<span class="cat-titulo">${titulo}</span>
        <span class="cat-resumen">${esc(resumen)}</span></summary>
      <div class="cat-cuerpo">${cuerpo}</div>
    </details>`;
}

const numero = (name, nombre, valor, min, max) => `<label>${esc(nombre)}${max != null ? ` <span class="nota">(${min} a ${max})</span>` : ""}
  <input name="${esc(name)}" type="number" min="${min}"${max != null ? ` max="${max}"` : ""} step="1" inputmode="numeric" value="${valor}"></label>`;

/** Los datos completos de un juego, para verlos y sobrescribirlos a mano */
function crudo(p, juego) {
  const doc = docDe(p, juego), dis = S.ocupado ? " disabled" : "";
  return `
    <details class="crudo"><summary>Datos completos (JSON)${doc ? ` · ${esc(fecha(doc.actualizado))}${doc.dispositivo ? ` · ${esc(doc.dispositivo)}` : ""}` : ""}</summary>
      <form class="fJson" data-juego="${esc(juego)}">
        <textarea name="json" rows="10" spellcheck="false" aria-label="JSON de ${esc(juego)}">${esc(doc ? JSON.stringify(doc.datos, null, 2) : "")}</textarea>
        <p class="nota">Reemplaza todo lo guardado de este juego. Úsalo solo para lo que no tiene campo arriba.</p>
        <button class="boton"${dis}>Sobrescribir con este JSON</button>
      </form>
    </details>`;
}

function detalle(p) {
  if (!p) { S.abierto = null; return ""; }
  const r = p.r, link = linkRecuperacion(SITIO, p.perfil), dis = S.ocupado ? " disabled" : "";
  const catalogo = datosDe(p, CATALOGO);
  const cats = [];

  cats.push(categoria("cuenta", "👤 Cuenta", r.nombre || "Sin nombre", `
    <form id="fNombre" class="fila"><input name="nombre" maxlength="60" placeholder="Nombre (p. ej. Noelia)" value="${esc(r.nombre)}">
      <button class="boton"${dis}>Guardar nombre</button></form>
    <p class="nota">Perfil <code>${esc(p.perfil)}</code> · creado ${esc(fecha(r.creado))} · último cambio ${esc(fecha(r.ultima))} · ${r.dispositivos.length} dispositivo(s)</p>
    <p><b>Link de recuperación</b>: ábrelo en el dispositivo que perdió el progreso (o que no está vinculado) y trae todo lo de esta cuenta.</p>
    <p class="linkbox" id="link">${esc(link)}</p>
    <p><button class="boton" id="copiar">Copiar link</button></p>`));

  const saldo = saldoDe(datosDe(p, CREDITOS));
  cats.push(categoria("creditos", "🪙 Créditos", `${saldo} créditos`, `
    <form id="fCreditos">
      <p>Saldo en la nube: <b>${saldo}</b></p>
      ${numero("saldo", "Nuevo saldo", saldo, 0)}
      <p class="nota">Se agrega un movimiento "Regalo/Ajuste de papás" con la diferencia (el historial no se borra). Si un dispositivo ganó o gastó sin internet, eso se suma encima.</p>
      <button class="primario"${dis}>Guardar créditos</button>
    </form>`));

  const tiene = new Set(cristalesEncontrados(datosDe(p, MUNDO)));
  const nombreCristal = (c) => c.id.replace(/^c-/, "").replace(/-/g, " ");
  const red = S.ctx.islas, mundo = normalizarMundo(datosDe(p, MUNDO));
  const disp = red ? disponibles(mundo, red, S.ctx.cristales.map((c) => c.id)) : null;
  const tope = red ? red.cfg.topeEstrellas : 5;
  const islasHtml = !red ? "" : `
    <form id="fIslas">
      <p>Para construir tiene <b>${disp.cristales}</b> cristales y <b>${disp.estrellas}</b> estrellas del mundo (lo encontrado y ganado, menos lo gastado en lo construido).</p>
      <p class="nota">Islas que ya visitó (en el mapa se ven completas; Isla Noli siempre).</p>
      <div class="cristales">${red.islas.map((i) => `<label class="check"><input type="checkbox" name="isla" value="${esc(i.id)}"${mundo.visitadas.includes(i.id) ? " checked" : ""}${i.id === "noli" ? " disabled" : ""}>
        <span class="gema" style="background:${esc(i.colores.suelo)}"></span> ${esc(i.nombre)}</label>`).join("")}</div>
      <p class="nota">Puentes y caminos de plataformas construidos (quitar uno devuelve lo que costó).</p>
      <div class="cristales">${red.conexiones.map((k) => `<label class="check"><input type="checkbox" name="conexion" value="${esc(k.id)}"${mundo.conexiones.includes(k.id) ? " checked" : ""}>
        ${esc(red.por.get(k.de).nombre)} → ${esc(red.por.get(k.a).nombre)} <span class="nota">(${k.tipo === "puente" ? "puente" : "plataformas"}${k.costo ? `: ${k.costo.cristales} 💎 + ${k.costo.estrellas} ⭐` : ", muy pronto"})</span></label>`).join("")}</div>
      <p class="nota">Estrellas del mundo que ya dio cada juego en Isla Noli (de 0 a ${tope}).</p>
      <div class="campos">${S.ctx.juegos.filter((j) => j.gana).map((j) => numero(`em:${j.id}`, j.titulo, (mundo.estrellas.dadas.noli || {})[j.id] || 0, 0, tope)).join("")}</div>
      <button class="primario"${dis}>Guardar islas y estrellas del mundo</button>
    </form>`;
  cats.push(categoria("mundo", "💎 Mundo", `${S.ctx.cristales.filter((c) => tiene.has(c.id)).length}/${S.ctx.cristales.length} cristales${red ? ` · ${mundo.visitadas.length}/${red.islas.length} islas · ${disp.estrellas} ⭐` : ""}`, `
    <form id="fCristales">
      <p class="nota">Cristales mágicos que ya encontró arriba de las plataformas del mundo.</p>
      <div class="cristales">${S.ctx.cristales.map((c) => `<label class="check"><input type="checkbox" name="cristal" value="${esc(c.id)}"${tiene.has(c.id) ? " checked" : ""}>
        <span class="gema" style="background:${esc(c.color)}"></span> ${esc(nombreCristal(c))}</label>`).join("")}</div>
      <button class="primario"${dis}>Guardar cristales</button>
    </form>
    ${islasHtml}
    ${crudo(p, MUNDO)}`));

  for (const j of S.ctx.juegos) {
    const datos = datosDe(p, j.id), est = j.estrellas ? estrellasDe(catalogo, j.id) : 0;
    let resumen = resumenJuego(j.id, datos, est), cuerpo = "";
    const def = CAMPOS_JUEGO[j.id];
    if (def || j.estrellas) cuerpo += `
      <form class="fJuego" data-juego="${esc(j.id)}">
        ${def ? def.campos.map((c) => numero(c.ruta, c.nombre, valorCampo(datos, c), c.min, c.max)).join("") : ""}
        ${j.estrellas ? numero("_estrellas", "Estrellas de la mejor partida", est, 0, 3) : ""}
        ${def && def.campos.some((c) => c.sigue) ? `<p class="nota">Al cambiar el nivel, también se escoge ese nivel para jugar.</p>` : ""}
        <button class="primario"${dis}>Guardar</button>
      </form>`;
    if (j.id === "pasarela") {
      const pas = resumenPasarela(datos, S.ctx.desbloqueos);
      resumen = datos ? `${pas.nivel} · ${pas.pasarelas} pasarelas · ${pas.premios}/${pas.totalPremios} premios` : "Sin jugar";
      cuerpo += `
        <form id="fPasarela">
          <p>Nivel: <b>${esc(pas.nivel)}</b></p>
          ${numero("puntos", "Puntos de estilo", pas.puntos, 0)}
          ${numero("pasarelas", "Pasarelas hechas", pas.pasarelas, 0)}
          ${numero("premios", `Premios abiertos`, pas.premios, 0, pas.totalPremios)}
          <p class="nota">Cada pasarela abre 1 o 2 premios (ropa, colores, temas, poses…). Lo que diseñó, dibujó y sus fotos no se tocan.</p>
          <button class="primario"${dis}>Guardar Pasarela</button>
        </form>`;
    }
    if (j.id === "biblioteca") {
      resumen = S.ctx.libros.map((l) => `${l.titulo}: ${libroDe(datos, l.id).leidos.length}/${l.capitulos} leídos`).join(" · ") || resumen;
      cuerpo += S.ctx.libros.map((l) => {
        const pr = libroDe(datos, l.id);
        const filas = l.caps.map((c) => `
          <tr><td>${c.n}. ${esc(c.titulo)}</td>
            <td><input type="checkbox" name="enc" value="${c.n}" aria-label="Encontrado ${c.n}"${pr.encontrados.includes(c.n) ? " checked" : ""}></td>
            <td><input type="checkbox" name="lei" value="${c.n}" aria-label="Leído ${c.n}"${pr.leidos.includes(c.n) ? " checked" : ""}></td></tr>`).join("");
        return `
          <form data-libro="${esc(l.id)}">
            <h3>📚 ${esc(l.titulo)}</h3>
            <p class="nota">Encontrado = el capítulo ya apareció en el mundo (se puede leer). Leído = ya lo terminó.</p>
            <table><thead><tr><th>Capítulo</th><th>Encontrado</th><th>Leído</th></tr></thead><tbody>${filas}</tbody></table>
            <p class="fila"><button type="button" class="boton chico" data-todos="enc">Todos encontrados</button>
              <button type="button" class="boton chico" data-todos="lei">Todos leídos</button>
              <button type="button" class="boton chico" data-todos="nada">Ninguno</button></p>
            <label class="check"><input type="checkbox" name="todos"${pr.todos ? " checked" : ""}> Abrir todos los capítulos (sin buscarlos)</label>
            <button class="primario"${dis}>Guardar libro</button>
          </form>`;
      }).join("");
    }
    cuerpo += crudo(p, j.id);
    cats.push(categoria(`j:${j.id}`, esc(j.titulo), resumen, cuerpo, j.icono));
  }

  const conocidos = new Set([CREDITOS, MUNDO, ...S.ctx.juegos.map((j) => j.id)]);
  const otros = p.juegos.filter((j) => !conocidos.has(j.juego));
  cats.push(categoria("otros", "🗂️ Otros datos", `${otros.length}`, otros.length
    ? otros.map((j) => `<h3>${esc(NOMBRES[j.juego] || j.juego)}</h3>${crudo(p, j.juego)}`).join("")
    : `<p class="nota">Nada más.</p>`));

  return `
    <section class="barra"><h2>${esc(r.nombre || "Sin nombre")}</h2>
      <span><button class="boton chico" id="abrirTodas">Abrir todo</button> <button class="boton chico" id="cerrarTodas">Cerrar todo</button></span></section>
    ${cats.join("")}`;
}

// ---------- Eventos ----------

const entero = (v) => (String(v).trim() === "" ? NaN : Number(v));

function conectar() {
  const on = (s, ev, fn) => { const e = $(s); if (e) e[ev] = fn; };
  on("#entrar", "onclick", async () => {
    S.error = "";
    try { const r = await entrarAdmin(); if (r.usuario) await conSesion(r); } catch (e) { S.error = "No se pudo entrar: " + (e.message || e); dibujar(); }
  });
  for (const b of app.querySelectorAll("#salir")) b.onclick = async () => { await salirAdmin(); Object.assign(S, { estado: "fuera", usuario: null, perfiles: [], abierto: null, elegido: "", aviso: "" }); dibujar(); };
  on("#recargar", "onclick", () => { S.aviso = ""; cargarPerfiles(); });
  on("#cuenta", "onchange", (e) => { S.elegido = e.target.value; });
  on("#confirmar", "onclick", () => {
    const sel = $("#cuenta"); if (sel) S.elegido = sel.value;
    if (!S.elegido) return;
    if (S.abierto !== S.elegido) S.abiertas = new Set(["cuenta"]);
    S.abierto = S.elegido; S.aviso = ""; S.error = ""; dibujar();
  });
  on("#nuevo", "onclick", async () => {
    const nombre = prompt("Nombre de la cuenta nueva (p. ej. Noelia):");
    if (nombre === null) return;
    S.ocupado = true; dibujar();
    try {
      const perfil = nuevoIdPerfil();
      await crearPerfil(S.fs, perfil, Date.now());
      if (nombre.trim()) await nombrarPerfil(S.fs, perfil, nombre);
      S.ocupado = false;
      await cargarPerfiles();
      S.elegido = S.abierto = perfil; S.abiertas = new Set(["cuenta"]);
      S.aviso = "Cuenta creada. Pon el progreso y abre el link de recuperación en el dispositivo de Noelia.";
    } catch (e) { S.error = "No se pudo crear: " + (e.message || e); }
    S.ocupado = false; dibujar();
  });
  for (const d of app.querySelectorAll("details.cat")) d.ontoggle = () => { if (d.open) S.abiertas.add(d.dataset.cat); else S.abiertas.delete(d.dataset.cat); };
  on("#abrirTodas", "onclick", () => { for (const d of app.querySelectorAll("details.cat")) d.open = true; });
  on("#cerrarTodas", "onclick", () => { for (const d of app.querySelectorAll("details.cat")) d.open = false; });
  on("#copiar", "onclick", async () => {
    const link = $("#link").textContent;
    try { await navigator.clipboard.writeText(link); $("#copiar").textContent = "¡Copiado!"; }
    catch { const r = document.createRange(); r.selectNodeContents($("#link")); getSelection().removeAllRanges(); getSelection().addRange(r); $("#copiar").textContent = "Cópialo del recuadro"; }
  });

  const perfil = S.abierto;
  const mal = (msg) => { S.error = msg; S.aviso = ""; dibujar(); };
  on("#fNombre", "onsubmit", async (e) => {
    e.preventDefault();
    const nombre = e.target.nombre.value;
    S.ocupado = true; dibujar();
    try { await nombrarPerfil(S.fs, perfil, nombre); const p = S.perfiles.find((x) => x.perfil === perfil); p.nombre = nombre.trim(); p.r = resumenPerfil(p, p.juegos, S.ctx); S.aviso = "Nombre guardado."; }
    catch (err) { S.error = "No se guardó el nombre: " + (err.message || err); }
    S.ocupado = false; dibujar();
  });
  on("#fCreditos", "onsubmit", (e) => {
    e.preventDefault();
    const objetivo = entero(e.target.saldo.value);
    if (!Number.isInteger(objetivo) || objetivo < 0) return mal("El saldo debe ser un número entero, 0 o más.");
    if (!confirm(`¿Dejar los créditos en ${objetivo}?`)) return;
    guardar(perfil, [[CREDITOS, (d) => { const r = ponerSaldo(d, objetivo, Date.now()); return r.n === 0 ? null : r.libro; }]], `Créditos: ${objetivo}.`);
  });
  on("#fCristales", "onsubmit", (e) => {
    e.preventDefault();
    const ids = [...e.target.querySelectorAll('input[name="cristal"]:checked')].map((x) => x.value);
    if (!confirm(`¿Dejar ${ids.length} cristales encontrados?`)) return;
    guardar(perfil, [[MUNDO, (d) => conCristales(d, ids, S.ctx.cristales.map((c) => c.id))]], "Cristales guardados.");
  });
  on("#fIslas", "onsubmit", (e) => {
    e.preventDefault();
    const red = S.ctx.islas;
    const visitadas = [...e.target.querySelectorAll('input[name="isla"]:checked')].map((x) => x.value);
    const conexiones = [...e.target.querySelectorAll('input[name="conexion"]:checked')].map((x) => x.value);
    const noli = {};
    for (const el of e.target.querySelectorAll('input[name^="em:"]')) noli[el.name.slice(3)] = entero(el.value);
    const op = { islas: red.islas.map((i) => i.id), conexiones: red.conexiones.map((k) => k.id), tope: red.cfg.topeEstrellas };
    try { conIslas(null, { estrellas: { noli } }, op); } catch (err) { return mal(err.message); }
    if (!confirm(`¿Sobrescribir el mundo?\nIslas visitadas: ${visitadas.length + (visitadas.includes("noli") ? 0 : 1)}\nConstruidas: ${conexiones.length}`)) return;
    guardar(perfil, [[MUNDO, (d) => conIslas(d, { visitadas, conexiones, estrellas: { noli } }, op)]], "Islas y estrellas del mundo guardadas.");
  });
  for (const f of app.querySelectorAll("form.fJuego")) f.onsubmit = (e) => {
    e.preventDefault();
    const id = f.dataset.juego, def = CAMPOS_JUEGO[id], j = S.ctx.juegos.find((x) => x.id === id);
    const cambios = {};
    for (const c of def ? def.campos : []) cambios[c.ruta] = entero(f.elements[c.ruta].value);
    const est = f.elements._estrellas ? entero(f.elements._estrellas.value) : null;
    const pasos = [];
    try {
      if (def) { conCampos(id, null, cambios); pasos.push([id, (d) => conCampos(id, d, cambios)]); } // valida antes de preguntar
      if (est !== null) { conEstrellas(null, id, est); pasos.push([CATALOGO, (d) => conEstrellas(d, id, est)]); }
    } catch (err) { return mal(err.message); }
    const lista = [...(def ? def.campos.map((c) => `${c.nombre}: ${cambios[c.ruta]}`) : []), ...(est !== null ? [`estrellas: ${est}`] : [])];
    if (!confirm(`¿Sobrescribir ${j ? j.titulo : id}?\n${lista.join("\n")}`)) return;
    guardar(perfil, pasos, `${j ? j.titulo : id} guardado.`);
  };
  on("#fPasarela", "onsubmit", (e) => {
    e.preventDefault();
    const f = e.target, c = { puntos: entero(f.puntos.value), pasarelas: entero(f.pasarelas.value), premios: entero(f.premios.value) };
    if (Object.values(c).some((v) => !Number.isInteger(v) || v < 0)) return mal("Pon números enteros, 0 o más.");
    if (!confirm(`¿Sobrescribir la Pasarela con ${c.puntos} puntos, ${c.pasarelas} pasarelas y ${c.premios} premios?`)) return;
    const total = (S.ctx.desbloqueos && S.ctx.desbloqueos.premios || []).length;
    guardar(perfil, [["pasarela", (d) => conPasarela(d, c, total)]], "Pasarela guardada.");
  });
  for (const f of app.querySelectorAll("form[data-libro]")) {
    for (const b of f.querySelectorAll("[data-todos]")) b.onclick = () => {
      const t = b.dataset.todos;
      for (const x of f.querySelectorAll('input[name="enc"]')) x.checked = t === "enc" || t === "lei" ? true : t === "nada" ? false : x.checked;
      for (const x of f.querySelectorAll('input[name="lei"]')) x.checked = t === "lei" ? true : t === "nada" ? false : x.checked;
    };
    f.onsubmit = (e) => {
      e.preventDefault();
      const marcados = (n) => [...f.querySelectorAll(`input[name="${n}"]:checked`)].map((x) => Number(x.value));
      const c = { leidos: marcados("lei"), encontrados: marcados("enc"), todos: f.todos.checked };
      if (!confirm(`¿Sobrescribir el libro: ${c.encontrados.length} encontrados, ${c.leidos.length} leídos${c.todos ? ", todos abiertos" : ""}?`)) return;
      guardar(perfil, [["biblioteca", (d) => conLibro(d, f.dataset.libro, c)]], "Libro guardado.");
    };
  }
  for (const f of app.querySelectorAll("form.fJson")) f.onsubmit = (e) => {
    e.preventDefault();
    const id = f.dataset.juego;
    let datos;
    try { datos = leerJson(f.json.value); } catch (err) { return mal(err.message); }
    if (!confirm(`¿Reemplazar TODO lo guardado de ${NOMBRES[id] || id} con este JSON?`)) return;
    guardar(perfil, [[id, () => datos]], `${NOMBRES[id] || id}: datos reemplazados.`);
  };
}

async function conSesion({ fs, usuario }) {
  S.fs = fs; S.usuario = usuario;
  if (!usuario) { S.estado = "fuera"; return dibujar(); }
  if ((usuario.email || "").toLowerCase() !== ADMIN) { S.estado = "noadmin"; return dibujar(); }
  S.estado = "lista"; dibujar();
  await cargarPerfiles();
}

(async () => {
  dibujar();
  await cargarContexto();
  try { await conSesion(await sesionAdmin()); }
  catch (e) { S.estado = "fuera"; S.error = "No se pudo cargar Firebase: " + (e.message || e); dibujar(); }
})();
