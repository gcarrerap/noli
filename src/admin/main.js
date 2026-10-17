// Página de administrador (admin.html): entrar con Google, ver los perfiles de la nube (las "cuentas") y sobrescribir
// créditos, Pasarela y libros. Cada cambio se sube como el más nuevo (dispositivo "admin"), así que los dispositivos
// vinculados lo reciben solos; a uno que perdió el progreso se le da el link de recuperación. DESIGN.md §7.
import { sesionAdmin, entrarAdmin, salirAdmin, listarPerfiles, nombrarPerfil, leerJuegos, subirJuego, crearPerfil,
  nuevoIdPerfil, linkRecuperacion } from "../services/index.js";
import { DISPOSITIVO_ADMIN, ponerSaldo, saldoDe, resumenPasarela, conPasarela, libroDe, conLibro, fecha, resumenPerfil } from "../engine/index.js";

export const ADMIN = "carrera.perabeles@gmail.com"; // igual que esAdminNoli() en firestore.rules
const LIBROS = ["halloween"];                       // libros de la Biblioteca (minijuegos/biblioteca/libros/)
const NOMBRES = { _creditos: "Créditos", _catalogo: "Estrellas del catálogo", _mundo: "Mundo (menú 3D)" };
const BASE = new URL("../../", import.meta.url);
const SITIO = new URL("./", BASE).href;

const S = { estado: "cargando", fs: null, usuario: null, perfiles: [], abierto: null, aviso: "", error: "", ctx: { desbloqueos: null, libros: [] }, ocupado: false };
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
const datosDe = (p, juego) => { const j = p.juegos.find((x) => x.juego === juego); return j ? j.datos : null; };

async function guardar(perfil, juego, armar, mensaje) {
  if (S.ocupado) return;
  S.ocupado = true; S.aviso = ""; S.error = ""; dibujar();
  try {
    const p = await recargar(perfil);
    const datos = armar(datosDe(p, juego));
    if (datos === null) { S.aviso = "No había nada que cambiar."; }
    else {
      await subirJuego(S.fs, perfil, juego, datos, Date.now(), DISPOSITIVO_ADMIN);
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
  else html = S.abierto ? detalle(S.perfiles.find((p) => p.perfil === S.abierto)) : lista();
  const sesion = S.usuario ? `<p class="sesion">${esc(S.usuario.email)} · <button class="link" id="salir">Salir</button></p>` : "";
  app.innerHTML = `
    <header class="cabeza"><h1>Noli · Administrador</h1>${sesion}</header>
    ${S.aviso ? `<p class="aviso ok" role="status">${esc(S.aviso)}</p>` : ""}
    ${S.error ? `<p class="aviso mal" role="alert">${esc(S.error)}</p>` : ""}
    ${html}`;
  conectar();
}

function lista() {
  if (S.ocupado && !S.perfiles.length) return `<p class="centro">Leyendo perfiles…</p>`;
  const tarjetas = S.perfiles.map(({ r }) => `
    <button class="tarjeta perfil" data-perfil="${esc(r.perfil)}">
      <span class="nombre">${esc(r.nombre || "Sin nombre")} <code>${esc(r.perfil.slice(0, 6))}…</code></span>
      <span class="datos">🪙 ${r.creditos} · 👗 ${r.pasarela ? `${r.pasarela.pasarelas} pasarelas, ${esc(r.pasarela.nivel)}` : "—"}
        · 📚 ${r.libros.map((l) => `${l.leidos}/${l.capitulos}`).join(", ") || "—"}</span>
      <span class="nota">Último cambio: ${esc(fecha(r.ultima))} · ${r.dispositivos.length} dispositivo(s) · creado ${esc(fecha(r.creado))}</span>
    </button>`).join("");
  return `
    <section class="barra">
      <h2>Cuentas (${S.perfiles.length})</h2>
      <span><button class="boton" id="recargar"${S.ocupado ? " disabled" : ""}>Actualizar</button>
        <button class="boton" id="nuevo"${S.ocupado ? " disabled" : ""}>Cuenta nueva</button></span>
    </section>
    <p class="nota">Cada cuenta es un perfil de la nube (los dispositivos vinculados entre sí comparten uno). La más reciente va primero.</p>
    ${tarjetas || `<p class="centro nota">No hay perfiles en la nube todavía.</p>`}`;
}

function detalle(p) {
  if (!p) { S.abierto = null; return lista(); }
  const r = p.r, link = linkRecuperacion(SITIO, p.perfil), dis = S.ocupado ? " disabled" : "";
  const pas = resumenPasarela(datosDe(p, "pasarela"), S.ctx.desbloqueos);
  const otros = p.juegos.filter((j) => !["_creditos", "pasarela", "biblioteca"].includes(j.juego));
  const libros = S.ctx.libros.map((l) => {
    const pr = libroDe(datosDe(p, "biblioteca"), l.id);
    const filas = l.caps.map((c) => `
      <tr><td>${c.n}. ${esc(c.titulo)}</td>
        <td><input type="checkbox" name="enc" value="${c.n}" aria-label="Encontrado ${c.n}"${pr.encontrados.includes(c.n) ? " checked" : ""}></td>
        <td><input type="checkbox" name="lei" value="${c.n}" aria-label="Leído ${c.n}"${pr.leidos.includes(c.n) ? " checked" : ""}></td></tr>`).join("");
    return `
      <form class="tarjeta" data-libro="${esc(l.id)}">
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
  return `
    <p><button class="link" id="volver">← Todas las cuentas</button></p>
    <section class="tarjeta">
      <form id="fNombre" class="fila"><input name="nombre" maxlength="60" placeholder="Nombre (p. ej. Noelia)" value="${esc(r.nombre)}">
        <button class="boton"${dis}>Guardar nombre</button></form>
      <p class="nota">Perfil <code>${esc(p.perfil)}</code> · creado ${esc(fecha(r.creado))} · último cambio ${esc(fecha(r.ultima))}</p>
      <p><b>Link de recuperación</b>: ábrelo en el dispositivo que perdió el progreso (o que no está vinculado) y trae todo lo de esta cuenta.</p>
      <p class="linkbox" id="link">${esc(link)}</p>
      <p><button class="boton" id="copiar">Copiar link</button></p>
    </section>

    <form class="tarjeta" id="fCreditos">
      <h3>🪙 Créditos</h3>
      <p>Saldo en la nube: <b>${saldoDe(datosDe(p, "_creditos"))}</b></p>
      <label>Nuevo saldo <input name="saldo" type="number" min="0" step="1" inputmode="numeric" value="${saldoDe(datosDe(p, "_creditos"))}"></label>
      <p class="nota">Se agrega un movimiento "Regalo/Ajuste de papás" con la diferencia (el historial no se borra). Si un dispositivo ganó o gastó sin internet, eso se suma encima.</p>
      <button class="primario"${dis}>Guardar créditos</button>
    </form>

    <form class="tarjeta" id="fPasarela">
      <h3>👗 Pasarela</h3>
      <p>Nivel: <b>${esc(pas.nivel)}</b></p>
      <label>Puntos de estilo <input name="puntos" type="number" min="0" step="1" inputmode="numeric" value="${pas.puntos}"></label>
      <label>Pasarelas hechas <input name="pasarelas" type="number" min="0" step="1" inputmode="numeric" value="${pas.pasarelas}"></label>
      <label>Premios abiertos (de ${pas.totalPremios}) <input name="premios" type="number" min="0" max="${pas.totalPremios}" step="1" inputmode="numeric" value="${pas.premios}"></label>
      <p class="nota">Cada pasarela abre 1 o 2 premios (ropa, colores, temas, poses…). Lo que diseñó, dibujó y sus fotos no se tocan.</p>
      <button class="primario"${dis}>Guardar Pasarela</button>
    </form>

    ${libros}

    <section class="tarjeta">
      <h3>Otros datos</h3>
      ${otros.length ? otros.map((j) => `<details><summary>${esc(NOMBRES[j.juego] || j.juego)} · ${esc(fecha(j.actualizado))}${j.dispositivo ? ` · ${esc(j.dispositivo)}` : ""}</summary>
        <pre>${esc(JSON.stringify(j.datos, null, 1))}</pre></details>`).join("") : `<p class="nota">Nada más.</p>`}
    </section>`;
}

// ---------- Eventos ----------

const entero = (v) => (String(v).trim() === "" ? NaN : Number(v));

function conectar() {
  const on = (s, ev, fn) => { const e = $(s); if (e) e[ev] = fn; };
  on("#entrar", "onclick", async () => {
    S.error = "";
    try { const r = await entrarAdmin(); if (r.usuario) await conSesion(r); } catch (e) { S.error = "No se pudo entrar: " + (e.message || e); dibujar(); }
  });
  for (const b of app.querySelectorAll("#salir")) b.onclick = async () => { await salirAdmin(); Object.assign(S, { estado: "fuera", usuario: null, perfiles: [], abierto: null, aviso: "" }); dibujar(); };
  on("#recargar", "onclick", () => { S.aviso = ""; cargarPerfiles(); });
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
      S.abierto = perfil;
      S.aviso = "Cuenta creada. Pon el progreso y abre el link de recuperación en el dispositivo de Noelia.";
    } catch (e) { S.error = "No se pudo crear: " + (e.message || e); }
    S.ocupado = false; dibujar();
  });
  for (const b of app.querySelectorAll(".perfil")) b.onclick = () => { S.abierto = b.dataset.perfil; S.aviso = ""; S.error = ""; dibujar(); scrollTo(0, 0); };
  on("#volver", "onclick", () => { S.abierto = null; S.aviso = ""; S.error = ""; dibujar(); });
  on("#copiar", "onclick", async () => {
    const link = $("#link").textContent;
    try { await navigator.clipboard.writeText(link); $("#copiar").textContent = "¡Copiado!"; }
    catch { const r = document.createRange(); r.selectNodeContents($("#link")); getSelection().removeAllRanges(); getSelection().addRange(r); $("#copiar").textContent = "Cópialo del recuadro"; }
  });
  const perfil = S.abierto;
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
    if (!Number.isInteger(objetivo) || objetivo < 0) { S.error = "El saldo debe ser un número entero, 0 o más."; return dibujar(); }
    if (!confirm(`¿Dejar los créditos en ${objetivo}?`)) return;
    guardar(perfil, "_creditos", (d) => { const r = ponerSaldo(d, objetivo, Date.now()); return r.n === 0 ? null : r.libro; }, `Créditos: ${objetivo}.`);
  });
  on("#fPasarela", "onsubmit", (e) => {
    e.preventDefault();
    const f = e.target, c = { puntos: entero(f.puntos.value), pasarelas: entero(f.pasarelas.value), premios: entero(f.premios.value) };
    if (Object.values(c).some((v) => !Number.isInteger(v) || v < 0)) { S.error = "Pon números enteros, 0 o más."; return dibujar(); }
    if (!confirm(`¿Sobrescribir la Pasarela con ${c.puntos} puntos, ${c.pasarelas} pasarelas y ${c.premios} premios?`)) return;
    const total = (S.ctx.desbloqueos && S.ctx.desbloqueos.premios || []).length;
    guardar(perfil, "pasarela", (d) => conPasarela(d, c, total), "Pasarela guardada.");
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
      guardar(perfil, "biblioteca", (d) => conLibro(d, f.dataset.libro, c), "Libro guardado.");
    };
  }
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
