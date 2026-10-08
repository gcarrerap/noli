// Acciones: lo único que cambia el estado. La interfaz y (en la fase 2) el control remoto solo llaman aquí.
import { cargarCatalogo, ls, leerDatosJuego, guardarDatosJuego } from "../services/index.js";
import { mover, materias } from "../engine/index.js";
import { estrellas as aEstrellas } from "../../kit/protocolo.js";
import { state, notify, visibles } from "./store.js";
import * as sync from "./sync.js";

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

  // El juego avisó que terminó una partida
  terminar(id, estrellas) {
    const e = aEstrellas(estrellas);
    const p = state.progreso[id] || { estrellas: 0, veces: 0, ultima: 0 };
    state.progreso = { ...state.progreso, [id]: { estrellas: Math.max(p.estrellas, e), veces: p.veces + 1, ultima: Date.now() } };
    ls.set("noli.progreso", JSON.stringify(state.progreso));
    sync.marcarCambio(sync.CATALOGO);
    state.celebrar = { id, estrellas: e };
    notify();
  },

  // Datos propios de un juego (su progreso). El catálogo es el dueño del almacenamiento.
  datosDe(id) { return leerDatosJuego(id); },
  guardarDatos(id, datos) { guardarDatosJuego(id, datos); sync.marcarCambio(id); },

  // Punto único de entrada para el control: dedo, teclado, control de la TV o teléfono remoto (fase 2)
  entrada(accion) {
    if (state.jugando) { if (alJuego) alJuego(accion); return; }
    const lista = visibles();
    if (accion === "ok") { if (lista[state.foco]) actions.abrir(lista[state.foco].id); return; }
    if (accion === "atras") return;
    // Arriba desde la primera fila pasa a los filtros (los maneja la interfaz); aquí solo la cuadrícula
    actions.enfocar(mover(state.foco, accion, state.cols, lista.length));
  },
};
