// Acciones: lo único que cambia el estado. La interfaz y el control remoto (app/remoto.js) solo llaman aquí.
import { cargarCatalogo, ls, leerDatosJuego, guardarDatosJuego } from "../services/index.js";
import { mover, materias, ganancia, agregar, gastar, compactar, saldoVisible } from "../engine/index.js";
import { estrellas as aEstrellas } from "../../kit/protocolo.js";
import { state, notify, visibles } from "./store.js";
import * as sync from "./sync.js";

// Id con el que se guardan (y sincronizan) los datos del mundo del menú principal (#25)
export const MUNDO = "_mundo";

// El reproductor (ui/screens/jugando.js) se registra aquí para recibir las acciones mientras hay un juego abierto
let alJuego = null;
export function conectarJuego(fn) { alJuego = fn; return () => { if (alJuego === fn) alJuego = null; }; }

export const actions = {
  async iniciar(opts) {
    state.cargando = true; notify();
    try {
      const { juegos, errores } = await cargarCatalogo(opts);
      state.juegos = juegos; state.errores = errores;
      for (const e of errores) console.warn("[catálogo]", e);
    } catch (e) {
      state.juegos = []; state.errores = [String(e.message || e)];
      console.error("[catálogo]", e);
    }
    if (state.materia && !materias(state.juegos).includes(state.materia)) state.materia = null;
    state.foco = 0; state.cargando = false; notify();
    if (state.nube.perfil) sync.conectar(); // la nube después del catálogo: nunca lo retrasa
  },

  // ---------- Nube (#7) ----------
  abrirNube() { state.nubeAbierta = true; state.nube.aviso = ""; if (state.nube.estado !== "error") state.nube.error = ""; notify(); },
  cerrarNube() { if (state.nube.codigo) sync.cancelarVinculo(); state.nubeAbierta = false; notify(); },
  activarNube: () => sync.activar(),
  empezarVinculo: () => sync.empezarVinculo(),
  cancelarVinculo: () => sync.cancelarVinculo(),
  vincularOtro: (codigo) => sync.vincularOtro(codigo),
  desvincular: () => sync.desvincular(),
  reintentarNube: () => sync.conectar(),

  elegirMateria(m) {
    state.materia = m || null; state.foco = 0;
    ls.set("noli.materia", state.materia || "");
    notify();
  },

  // Menú principal: el mundo 3D o el menú 2D (#25). recordar: guardarlo en este aparato (la persona lo eligió, o dijo
  // que sí al menú sencillo porque iba lento); si no, solo por esta vez (por ejemplo, la escena 3D falló al crearse).
  ponerVista(v, { recordar = false } = {}) {
    const vista = v === "mundo" ? "mundo" : "2d";
    if (recordar) ls.set("noli.vista", vista === "2d" ? "2d" : "3d");
    if (state.vista === vista) return;
    state.vista = vista; state.foco = 0; notify();
  },
  // Lo que se guarda del mundo (los cristales encontrados). Se guarda y sincroniza como los datos de un juego.
  datosMundo() { return leerDatosJuego(MUNDO); },
  guardarMundo(datos) { guardarDatosJuego(MUNDO, datos); sync.marcarCambio(MUNDO); },

  enfocar(i) { if (i !== state.foco) { state.foco = i; notify("foco"); } },

  abrir(id) {
    const j = state.juegos.find((x) => x.id === id);
    if (!j) return;
    state.jugando = j; state.celebrar = null; notify();
  },

  cerrar() {
    if (!state.jugando) return;
    const i = visibles().findIndex((x) => x.id === state.jugando.id);
    state.jugando = null; if (i >= 0) state.foco = i;
    notify();
  },

  // El juego avisó que terminó una partida. Si el juego da créditos ("creditos": "gana"), se suman (#20).
  terminar(id, estrellas, reto = false) {
    const e = aEstrellas(estrellas);
    const juego = state.juegos.find((x) => x.id === id);
    let ganados = 0, topado = false;
    if (juego && juego.creditos === "gana") {
      const ahora = sync.ahora(), d = sync.dispositivo;
      const g = ganancia(state.creditos, { juego: id, estrellas: e, reto: reto === true, ahora });
      let libro = state.creditos;
      libro = agregar(libro, { n: g.estrellas, j: id, m: "estrellas", d, f: ahora });
      libro = agregar(libro, { n: g.reto, j: id, m: "reto", d, f: ahora });
      if (libro !== state.creditos) guardarCreditos(libro);
      ganados = g.total; topado = g.topado;
    }
    const p = state.progreso[id] || { estrellas: 0, veces: 0, ultima: 0 };
    state.progreso = { ...state.progreso, [id]: { estrellas: Math.max(p.estrellas, e), veces: p.veces + 1, ultima: Date.now() } };
    ls.set("noli.progreso", JSON.stringify(state.progreso));
    sync.marcarCambio(sync.CATALOGO);
    state.celebrar = { id, estrellas: e, creditos: ganados, topado };
    notify();
  },

  // ---------- Créditos (#20) ----------
  // Un juego con "creditos": "gasta" pide créditos. Devuelve { ok, saldo }. Solo el catálogo descuenta.
  gastar(id, cantidad) {
    const juego = state.juegos.find((x) => x.id === id);
    if (!juego || juego.creditos !== "gasta") return { ok: false, saldo: saldoVisible(state.creditos) };
    const r = gastar(state.creditos, { cantidad, juego: id, d: sync.dispositivo, f: sync.ahora() });
    if (r.ok) { guardarCreditos(r.libro); notify("creditos"); }
    return { ok: r.ok, saldo: r.saldo };
  },
  // Papá o mamá regalan (n > 0) o quitan (n < 0) créditos desde la ventana de créditos
  regalarCreditos(n) {
    n = Math.trunc(n);
    if (!n) return;
    guardarCreditos(agregar(state.creditos, { n, m: n > 0 ? "regalo" : "ajuste", d: sync.dispositivo, f: sync.ahora() }));
    notify();
  },
  abrirCreditos() { state.creditosAbierto = true; notify(); },
  cerrarCreditos() { state.creditosAbierto = false; notify(); },

  // Datos propios de un juego (su progreso). El catálogo es el dueño del almacenamiento.
  datosDe(id) { return leerDatosJuego(id); },
  guardarDatos(id, datos) { guardarDatosJuego(id, datos); sync.marcarCambio(id); },

  // Punto único de entrada para el control: dedo, teclado, control de la TV o teléfono remoto
  entrada(accion) {
    if (accion === "brincar" && (state.jugando || state.vista !== "mundo")) return; // solo el mundo 3D brinca (#25)
    if (state.jugando) { if (alJuego) alJuego(accion); return; }
    const lista = visibles();
    if (accion === "ok") { if (lista[state.foco]) actions.abrir(lista[state.foco].id); return; }
    if (accion === "atras") return;
    // Arriba desde la primera fila pasa a los filtros (los maneja la interfaz); aquí solo la cuadrícula
    actions.enfocar(mover(state.foco, accion, state.cols, lista.length));
  },
};

// Guarda el libro de créditos en este dispositivo (compactando lo viejo propio) y lo marca para subir a la nube
function guardarCreditos(libro) {
  state.creditos = compactar(libro, sync.dispositivo, sync.ahora());
  ls.set("noli.creditos", JSON.stringify(state.creditos));
  sync.marcarCambio(sync.CREDITOS);
}
