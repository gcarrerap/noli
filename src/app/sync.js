// Sincronizar el progreso con la nube (#7). El catálogo es el único que guarda (los juegos mandan "guardar"),
// así que aquí se sincroniza todo sin que los juegos se enteren.
//
// Por juego (y "_catalogo" para las estrellas del catálogo) se lleva en este dispositivo:
//   noli.nube.meta = { [id]: { actualizado (ms), pendiente (falta subirlo) } }
// Regla: gana la versión con el `actualizado` más reciente. Se guarda primero aquí (funciona sin internet) y se
// sube después; lo pendiente se sube al reconectar.
//
// Excepción: los créditos ("_creditos", #20) no se pisan, se JUNTAN (engine/creditos.js → unir): son un libro de
// movimientos y la unión de los dos lados nunca pierde lo que se ganó o gastó en otro dispositivo sin conexión.
// Si lo juntado tiene algo que la nube no, se vuelve a subir. Lo mismo el mundo ("_mundo", #164): cristales, islas
// visitadas y conexiones se unen y las estrellas del mundo toman el máximo (engine/islas.js → unirMundo); así un
// puente construido en dos aparatos se cobra una vez. Si el administrador lo sobrescribió (rev), gana su versión.
//
// Cuenta de Google (#114): en el teléfono se puede entrar con la cuenta de Noelia. La cuenta apunta a un perfil
// (noli_cuentas); la primera vez se liga al perfil de este dispositivo (o a uno nuevo). La TV sigue con el código.
// Si el perfil de un dispositivo no existe en la nube (p. ej. al cambiar de proyecto de Firebase, #112), se vuelve
// a crear con el mismo id y se sube lo de aquí.
import { ls, leerJsonLs, leerDatosJuego, guardarDatosJuego, initFirebase,
  crearPerfil, existePerfil, nuevoIdPerfil, subirJuego, leerJuegos, escucharJuegos,
  crearVinculo, escucharVinculo, borrarVinculo, completarVinculo, VINCULO_DURA_MS, linkRecuperacion,
  leerCuenta, ligarCuenta, entrarGoogle, salirGoogle, usuarioGoogle } from "../services/index.js";
import { leerLibro, unir, iguales, unirMundo, mismoMundo, normalizarMundo } from "../engine/index.js";
import { state, notify } from "./store.js";

export const CATALOGO = "_catalogo";
export const CREDITOS = "_creditos";
export const MUNDO = "_mundo";
// Lo que se junta en lugar de pisarse: cómo leerlo, juntarlo y compararlo
const JUNTAR = {
  [CREDITOS]: { leer: (d) => leerLibro(d), unir, iguales },
  [MUNDO]: { leer: (d) => normalizarMundo(d), unir: unirMundo, iguales: mismoMundo },
};
const K = { perfil: "noli.nube.perfil", meta: "noli.nube.meta", dev: "noli.dev", cuenta: "noli.nube.cuenta", entrando: "noli.nube.entrando" };

// Id de este dispositivo (se guarda la primera vez). Marca los movimientos de créditos que crea este aparato.
function idDispositivo() {
  const d = ls.get(K.dev) || ("d" + Math.random().toString(36).slice(2, 10));
  ls.set(K.dev, d);
  return d;
}
let dispositivo = idDispositivo();
export { dispositivo };

let cfg = { obtenerFs: () => initFirebase(), espera: 1500, ahora: () => Date.now(),
  entrarGoogle: () => entrarGoogle(), salirGoogle: () => salirGoogle(), usuarioGoogle: () => usuarioGoogle() };
let fs = null, dejarDeEscuchar = null, dejarVinculo = null, timerSubir = null, timerVinculo = null;
let meta = leerJsonLs(K.meta, {});

/** Hora actual (la de las pruebas si se configuró otro reloj) */
export const ahora = () => cfg.ahora();

// Solo para pruebas: otro Firestore, sin espera, otro reloj; y volver a leer lo guardado
export function _configurar(c) { cfg = { ...cfg, ...c }; }
export function _reiniciar() {
  if (dejarDeEscuchar) dejarDeEscuchar();
  if (dejarVinculo) dejarVinculo();
  clearTimeout(timerSubir); clearTimeout(timerVinculo);
  fs = dejarDeEscuchar = dejarVinculo = null;
  meta = leerJsonLs(K.meta, {});
  dispositivo = idDispositivo();
  Object.assign(state.nube, inicial());
}

function inicial() {
  return { estado: ls.get(K.perfil) ? "conectando" : "apagada", perfil: ls.get(K.perfil) || null, codigo: null, expira: 0,
    error: "", aviso: "", ultima: 0, cuenta: (ls.get(K.perfil) && ls.get(K.cuenta)) || null };
}
Object.assign(state.nube, inicial());

const guardarMeta = () => ls.set(K.meta, JSON.stringify(meta));
const poner = (cambios, what) => { Object.assign(state.nube, cambios); notify(what); };

// ---------- Lo local: datos de cada juego y las estrellas del catálogo ----------

function leerLocal(id) { return id === CATALOGO ? state.progreso : id === CREDITOS ? state.creditos : leerDatosJuego(id); }
function escribirLocal(id, datos) {
  if (id === CATALOGO) { state.progreso = datos || {}; ls.set("noli.progreso", JSON.stringify(state.progreso)); }
  else if (id === CREDITOS) { state.creditos = leerLibro(datos); ls.set("noli.creditos", JSON.stringify(state.creditos)); }
  else guardarDatosJuego(id, datos);
}
// Ids con algo guardado aquí
function idsLocales() {
  const ids = new Set(Object.keys(meta));
  for (const j of state.juegos) if (leerDatosJuego(j.id) != null) ids.add(j.id);
  if (Object.keys(state.progreso || {}).length) ids.add(CATALOGO);
  if (state.creditos.movs.length || Object.keys(state.creditos.cierres).length) ids.add(CREDITOS);
  return [...ids];
}

// ---------- Cambios en este dispositivo ----------

// Se llama cada vez que se guarda algo (haya nube o no): así, al activar la nube, se sabe qué es más nuevo.
export function marcarCambio(id) {
  meta[id] = { actualizado: cfg.ahora(), pendiente: true };
  guardarMeta();
  if (fs && state.nube.perfil) { clearTimeout(timerSubir); timerSubir = setTimeout(subirPendientes, cfg.espera); }
}

export async function subirPendientes() {
  if (!fs || !state.nube.perfil) return;
  const perfil = state.nube.perfil;
  try {
    for (const [id, m] of Object.entries(meta)) {
      if (!m.pendiente) continue;
      const datos = leerLocal(id);
      if (datos == null) { m.pendiente = false; continue; }
      await subirJuego(fs, perfil, id, datos, m.actualizado, dispositivo);
      if (meta[id] === m) m.pendiente = false; // si cambió mientras subía, sigue pendiente
    }
    guardarMeta();
    poner({ estado: "lista", error: "", ultima: cfg.ahora() }, "nube");
  } catch (e) {
    guardarMeta();
    poner({ estado: "sin-conexion", error: "" }, "nube");
  }
}

// ---------- Lo que llega de la nube ----------

// Aplica lo remoto que sea más nuevo que lo local. Devuelve true si cambió algo.
function aplicarRemotos(lista) {
  let cambio = false;
  for (const r of lista) {
    if (JUNTAR[r.juego]) { if (juntar(r)) cambio = true; continue; }
    const m = meta[r.juego];
    if (m && m.actualizado >= r.actualizado) continue; // lo de aquí es igual o más nuevo
    escribirLocal(r.juego, r.datos);
    meta[r.juego] = { actualizado: r.actualizado, pendiente: false };
    cambio = true;
  }
  if (cambio) { guardarMeta(); notify(); }
  return cambio;
}

// Créditos y mundo: juntar lo de la nube con lo de aquí. Si lo de aquí trae algo que la nube no tiene, queda pendiente
// de subir (así el otro dispositivo también lo recibe). Devuelve true si cambió lo local.
function juntar(r) {
  const J = JUNTAR[r.juego], id = r.juego;
  const remoto = J.leer(r.datos), local = J.leer(leerLocal(id));
  const junto = J.unir(local, remoto);
  const cambioLocal = !J.iguales(junto, local);
  if (cambioLocal) escribirLocal(id, junto);
  if (!J.iguales(junto, remoto)) {
    meta[id] = { actualizado: Math.max(cfg.ahora(), r.actualizado + 1), pendiente: true };
    if (fs && state.nube.perfil) { clearTimeout(timerSubir); timerSubir = setTimeout(subirPendientes, cfg.espera); }
  } else if (!meta[id] || !meta[id].pendiente) meta[id] = { actualizado: r.actualizado, pendiente: false };
  return cambioLocal;
}

// Al conectar: tomar lo más nuevo de la nube y subir lo que aquí es más nuevo o no está allá
async function reconciliar() {
  const remotos = await leerJuegos(fs, state.nube.perfil);
  aplicarRemotos(remotos);
  const enNube = new Map(remotos.map((r) => [r.juego, r.actualizado]));
  for (const id of idsLocales()) {
    if (JUNTAR[id]) { // si la nube ya los tenía, juntar decidió; si no, hay que subirlos
      if (!enNube.has(id)) meta[id] = { actualizado: cfg.ahora(), pendiente: true };
      continue;
    }
    const m = meta[id] || (meta[id] = { actualizado: 0, pendiente: true });
    if (!enNube.has(id) || m.actualizado > enNube.get(id)) m.pendiente = true;
  }
  guardarMeta();
  await subirPendientes();
}

let escuchandoRed = false;
export async function conectar() {
  if (!state.nube.perfil) return;
  poner({ estado: "conectando", error: "" }, "nube");
  try {
    fs = await cfg.obtenerFs();
    // Perfil que no está en la nube (se cambió de proyecto, #112): se vuelve a crear con el mismo id y se sube lo de aquí
    if (!(await existePerfil(fs, state.nube.perfil))) await crearPerfil(fs, state.nube.perfil, cfg.ahora());
    await reconciliar();
    if (dejarDeEscuchar) dejarDeEscuchar();
    dejarDeEscuchar = escucharJuegos(fs, state.nube.perfil, (lista) => { if (aplicarRemotos(lista)) poner({ ultima: cfg.ahora() }, "nube"); },
      () => poner({ estado: "sin-conexion" }, "nube"));
    if (!escuchandoRed && typeof window !== "undefined" && window.addEventListener) {
      escuchandoRed = true;
      window.addEventListener("online", () => subirPendientes());
    }
  } catch (e) {
    console.warn("[nube]", e);
    poner({ estado: "sin-conexion", error: "" }, "nube");
  }
}

// ---------- Activar, vincular, desvincular ----------

// Primer dispositivo: crea el perfil y sube lo que ya tenía
export async function activar() {
  poner({ estado: "conectando", error: "", aviso: "" }, "nube");
  try {
    fs = await cfg.obtenerFs();
    const perfil = nuevoIdPerfil();
    await crearPerfil(fs, perfil, cfg.ahora());
    ls.set(K.perfil, perfil);
    state.nube.perfil = perfil;
    await conectar();
    poner({ aviso: "¡Listo! El progreso ya se guarda en la nube." }, "nube");
  } catch (e) {
    poner({ estado: "error", error: "No se pudo conectar con la nube. Revisa el internet e intenta otra vez." }, "nube");
  }
}

// ---------- Cuenta de Google de Noelia (#114) ----------

const mensajeGoogle = (e) => "No se pudo entrar con Google" + (e && e.code ? ` (${e.code})` : "") +
  ". Si es una cuenta de Family Link, puede que papá o mamá tengan que aprobar Noli desde Family Link.";

export async function entrarConGoogle() {
  poner({ estado: "conectando", error: "", aviso: "" }, "nube");
  try {
    fs = await cfg.obtenerFs();
    ls.set(K.entrando, "1"); // por si se va por redirección: al regresar, terminarEntrada() sigue
    const u = await cfg.entrarGoogle();
    if (!u) return; // redirección
    await usarCuenta(u);
  } catch (e) {
    ls.set(K.entrando, "");
    const cancelo = e && ["auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/user-cancelled"].includes(e.code);
    poner({ estado: state.nube.perfil ? "lista" : "apagada", error: cancelo ? "" : mensajeGoogle(e) }, "nube");
    if (state.nube.perfil) conectar();
  }
}

// Al abrir la página después de una redirección de Google
export async function terminarEntrada() {
  ls.set(K.entrando, "");
  try {
    fs = await cfg.obtenerFs();
    const u = cfg.usuarioGoogle();
    if (u) return await usarCuenta(u);
  } catch (e) {
    console.warn("[nube]", e);
  }
  if (state.nube.perfil) return conectar();
  poner({ estado: "apagada" }, "nube");
}

// La cuenta ya tiene perfil: este dispositivo se cambia a ése (gana lo más nuevo, como al vincular). Si no tiene,
// se le liga el de este dispositivo, o uno nuevo.
async function usarCuenta(u) {
  ls.set(K.entrando, "");
  let perfil = await leerCuenta(fs, u.uid);
  if (!perfil) {
    perfil = state.nube.perfil || nuevoIdPerfil();
    if (!(await existePerfil(fs, perfil))) await crearPerfil(fs, perfil, cfg.ahora());
    await ligarCuenta(fs, u.uid, perfil, cfg.ahora());
  }
  if (dejarDeEscuchar) { dejarDeEscuchar(); dejarDeEscuchar = null; }
  const cuenta = u.email || "Google";
  ls.set(K.perfil, perfil); ls.set(K.cuenta, cuenta);
  Object.assign(state.nube, { perfil, cuenta });
  await conectar();
  if (state.nube.estado === "lista") poner({ aviso: "¡Listo! El progreso de Noelia queda guardado en su cuenta de Google." }, "nube");
}

// Al abrir el catálogo: terminar una entrada con Google pendiente, o conectar si hay perfil
export function iniciarNube() {
  if (ls.get(K.entrando)) return terminarEntrada();
  if (state.nube.perfil) return conectar();
}

// Dispositivo nuevo (la TV): enseña un código y espera a que el otro lo escriba
export async function empezarVinculo() {
  poner({ estado: "conectando", error: "", aviso: "" }, "nube");
  try {
    fs = await cfg.obtenerFs();
    const codigo = await crearVinculo(fs, { ahora: cfg.ahora() });
    poner({ estado: "esperando", codigo, expira: cfg.ahora() + VINCULO_DURA_MS }, "nube");
    dejarVinculo = escucharVinculo(fs, codigo, async (perfil) => {
      cancelarVinculo(false);
      await borrarVinculo(fs, codigo);
      ls.set(K.perfil, perfil);
      state.nube.perfil = perfil;
      await conectar();
      poner({ aviso: "¡Vinculado! Este dispositivo ya tiene el mismo progreso." }, "nube");
    });
    timerVinculo = setTimeout(() => { cancelarVinculo(true); poner({ error: "El código venció. Pide otro." }, "nube"); }, VINCULO_DURA_MS);
  } catch (e) {
    poner({ estado: "error", error: "No se pudo conectar con la nube. Revisa el internet e intenta otra vez." }, "nube");
  }
}

export function cancelarVinculo(borrar = true) {
  if (dejarVinculo) { dejarVinculo(); dejarVinculo = null; }
  clearTimeout(timerVinculo);
  const codigo = state.nube.codigo;
  if (borrar && fs && codigo) borrarVinculo(fs, codigo);
  poner({ codigo: null, expira: 0, estado: state.nube.perfil ? state.nube.estado : "apagada" }, "nube");
}

// Dispositivo que ya tiene el perfil: escribe el código que enseña el otro
export async function vincularOtro(codigo) {
  poner({ error: "", aviso: "" }, "nube");
  try {
    fs = fs || (await cfg.obtenerFs());
    await completarVinculo(fs, String(codigo).replace(/\D/g, ""), state.nube.perfil, cfg.ahora());
    poner({ aviso: "¡Listo! El otro dispositivo ya está vinculado." }, "nube");
    return true;
  } catch (e) {
    poner({ error: e.message || "No se pudo vincular." }, "nube");
    return false;
  }
}

// Recuperar con el link de recuperación (perfilDelLink): vincula este dispositivo a ese perfil y trae TODO lo de la
// nube aunque lo de aquí sea más nuevo (por ejemplo, si el navegador borró el progreso y la niña volvió a empezar).
// Se olvidan las fechas de aquí, así que en cada juego gana la nube; lo que la nube no tiene se queda y se sube.
// Los créditos y el mundo se juntan como siempre. Si el perfil no existe, no se toca nada.
export async function recuperar(perfil) {
  poner({ estado: "conectando", error: "", aviso: "" }, "nube");
  try {
    fs = await cfg.obtenerFs();
    if (!(await existePerfil(fs, perfil))) {
      poner({ estado: state.nube.perfil ? "lista" : "apagada", error: "Ese link de recuperación no corresponde a ningún progreso guardado." }, "nube");
      return false;
    }
  } catch (e) {
    poner({ estado: state.nube.perfil ? "sin-conexion" : "apagada", error: "No se pudo conectar con la nube. Revisa el internet y vuelve a abrir el link." }, "nube");
    return false;
  }
  if (dejarDeEscuchar) { dejarDeEscuchar(); dejarDeEscuchar = null; }
  for (const id of Object.keys(meta)) if (!JUNTAR[id]) delete meta[id];
  guardarMeta();
  ls.set(K.perfil, perfil);
  state.nube.perfil = perfil;
  await conectar();
  if (state.nube.estado !== "lista") return false;
  poner({ aviso: "¡Progreso recuperado! Este dispositivo ya tiene lo que estaba en la nube." }, "nube");
  return true;
}

// El link para guardar y abrir en un dispositivo que perdió el progreso (solo si hay perfil)
export function miLinkRecuperacion(base) { return state.nube.perfil ? linkRecuperacion(base, state.nube.perfil) : null; }

// Este dispositivo deja de sincronizar (lo guardado aquí se queda)
export function desvincular() {
  if (dejarDeEscuchar) { dejarDeEscuchar(); dejarDeEscuchar = null; }
  ls.set(K.perfil, ""); ls.set(K.cuenta, "");
  if (state.nube.cuenta) Promise.resolve().then(() => cfg.salirGoogle()).catch((e) => console.warn("[nube]", e));
  poner({ ...inicial(), perfil: null, cuenta: null, estado: "apagada", aviso: "Este dispositivo ya no se sincroniza." }, "nube");
}
