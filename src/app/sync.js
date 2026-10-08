// Sincronizar el progreso con la nube (#7). El catálogo es el único que guarda (los juegos mandan "guardar"),
// así que aquí se sincroniza todo sin que los juegos se enteren.
//
// Por juego (y "_catalogo" para las estrellas del catálogo) se lleva en este dispositivo:
//   noli.nube.meta = { [id]: { actualizado (ms), pendiente (falta subirlo) } }
// Regla: gana la versión con el `actualizado` más reciente. Se guarda primero aquí (funciona sin internet) y se
// sube después; lo pendiente se sube al reconectar.
import { ls, leerJsonLs, leerDatosJuego, guardarDatosJuego, initFirebase,
  crearPerfil, existePerfil, nuevoIdPerfil, subirJuego, leerJuegos, escucharJuegos,
  crearVinculo, escucharVinculo, borrarVinculo, completarVinculo, VINCULO_DURA_MS } from "../services/index.js";
import { state, notify } from "./store.js";

export const CATALOGO = "_catalogo";
const K = { perfil: "noli.nube.perfil", meta: "noli.nube.meta", dev: "noli.dev" };

const dispositivo = ls.get(K.dev) || ("d" + Math.random().toString(36).slice(2, 10));
ls.set(K.dev, dispositivo);

let cfg = { obtenerFs: () => initFirebase(), espera: 1500, ahora: () => Date.now() };
let fs = null, dejarDeEscuchar = null, dejarVinculo = null, timerSubir = null, timerVinculo = null;
let meta = leerJsonLs(K.meta, {});

// Solo para pruebas: otro Firestore, sin espera, otro reloj; y volver a leer lo guardado
export function _configurar(c) { cfg = { ...cfg, ...c }; }
export function _reiniciar() {
  if (dejarDeEscuchar) dejarDeEscuchar();
  if (dejarVinculo) dejarVinculo();
  clearTimeout(timerSubir); clearTimeout(timerVinculo);
  fs = dejarDeEscuchar = dejarVinculo = null;
  meta = leerJsonLs(K.meta, {});
  Object.assign(state.nube, inicial());
}

function inicial() {
  return { estado: ls.get(K.perfil) ? "conectando" : "apagada", perfil: ls.get(K.perfil) || null, codigo: null, expira: 0,
    error: "", aviso: "", ultima: 0 };
}
Object.assign(state.nube, inicial());

const guardarMeta = () => ls.set(K.meta, JSON.stringify(meta));
const poner = (cambios, what) => { Object.assign(state.nube, cambios); notify(what); };

// ---------- Lo local: datos de cada juego y las estrellas del catálogo ----------

function leerLocal(id) { return id === CATALOGO ? state.progreso : leerDatosJuego(id); }
function escribirLocal(id, datos) {
  if (id === CATALOGO) { state.progreso = datos || {}; ls.set("noli.progreso", JSON.stringify(state.progreso)); }
  else guardarDatosJuego(id, datos);
}
// Ids con algo guardado aquí
function idsLocales() {
  const ids = new Set(Object.keys(meta));
  for (const j of state.juegos) if (leerDatosJuego(j.id) != null) ids.add(j.id);
  if (Object.keys(state.progreso || {}).length) ids.add(CATALOGO);
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
    const m = meta[r.juego];
    if (m && m.actualizado >= r.actualizado) continue; // lo de aquí es igual o más nuevo
    escribirLocal(r.juego, r.datos);
    meta[r.juego] = { actualizado: r.actualizado, pendiente: false };
    cambio = true;
  }
  if (cambio) { guardarMeta(); notify(); }
  return cambio;
}

// Al conectar: tomar lo más nuevo de la nube y subir lo que aquí es más nuevo o no está allá
async function reconciliar() {
  const remotos = await leerJuegos(fs, state.nube.perfil);
  aplicarRemotos(remotos);
  const enNube = new Map(remotos.map((r) => [r.juego, r.actualizado]));
  for (const id of idsLocales()) {
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
    if (!(await existePerfil(fs, state.nube.perfil))) {
      return poner({ estado: "error", error: "Este dispositivo estaba vinculado a un perfil que ya no existe. Desvincúlalo y vuelve a vincularlo." }, "nube");
    }
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

// Este dispositivo deja de sincronizar (lo guardado aquí se queda)
export function desvincular() {
  if (dejarDeEscuchar) { dejarDeEscuchar(); dejarDeEscuchar = null; }
  ls.set(K.perfil, "");
  poner({ ...inicial(), perfil: null, estado: "apagada", aviso: "Este dispositivo ya no se sincroniza." }, "nube");
}
