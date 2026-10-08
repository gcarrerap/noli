// El control remoto del lado de la TV (issue #3): abrir la sala, enseñar el código y entregar las acciones del
// teléfono. Las acciones entran por el mismo camino que las teclas del control de la TV (la interfaz lo registra
// con alRemoto; si no, van directo a actions.entrada), así que ni el catálogo ni los juegos cambian.
//
// state.remoto: { estado, codigo, via, panel, error }
//   estado  "apagado" | "preparando" (cargando Firebase, abriendo la sala) | "esperando" (sin teléfono)
//           | "conectado" | "error"
//   via     "webrtc" | "firestore" | null
//   panel   si se ve el recuadro grande con el código y el QR
import { conectarFirebase, abrirSala, nuevoId, ls } from "../services/index.js";
import { crearTv } from "./enlace.js";
import { state, notify } from "./store.js";
import { actions } from "./actions.js";

let tv = null, entregar = null, intento = 0;

// La interfaz registra aquí cómo aplicar una acción (para que el foco se mueva igual que con las teclas)
export function alRemoto(fn) { entregar = fn; }

// Entorno real (navegador). Las pruebas pasan uno de mentira.
const entornoNavegador = () => ({
  conectar: conectarFirebase,
  env: { RTCPeerConnection: globalThis.RTCPeerConnection || globalThis.webkitRTCPeerConnection, iceServers: null },
});

function poner(cambios) {
  state.remoto = Object.assign({}, state.remoto, cambios);
  notify("remoto");
}

function actualizar() {
  if (!tv) return;
  const e = tv.estado();
  if (e.perdida) {
    // La sala se venció (la TV estuvo dormida, sin red) y otra TV tomó el código: abrir otra
    remoto.apagar({ olvidar: false }).then(() => remoto.encender());
    return;
  }
  const antes = state.remoto.estado;
  const estado = e.conectado ? "conectado" : "esperando";
  if (estado === antes && e.via === state.remoto.via) return;
  // Al conectarse el teléfono el recuadro se quita solo; si se desconecta, se queda la insignia
  poner({ estado, via: e.via, panel: estado === "conectado" ? false : state.remoto.panel });
}

export const remoto = {
  // Prender el control remoto: Firebase, sala y esperar al teléfono. entorno: solo para pruebas.
  async encender({ entorno = entornoNavegador(), mostrar = true } = {}) {
    if (tv || state.remoto.estado === "preparando") { poner({ panel: mostrar || state.remoto.panel }); return; }
    const mio = ++intento;
    poner({ estado: "preparando", panel: mostrar, error: "", codigo: null, via: null });
    try {
      const { fs, uid } = await entorno.conectar();
      const sesion = nuevoId();
      const codigo = await abrirSala(fs, { tv: uid, sesion, preferido: ls.get("noli.sala") });
      if (mio !== intento) return; // lo apagaron mientras tanto
      ls.set("noli.sala", codigo); ls.set("noli.remoto", "1");
      tv = crearTv({
        fs, codigo, sesion, env: entorno.env,
        alAccion: (accion) => (entregar ? entregar(accion) : actions.entrada(accion)),
        alCambiar: actualizar,
      });
      poner({ estado: "esperando", codigo });
      actualizar();
    } catch (e) {
      if (mio !== intento) return;
      console.warn("[control remoto]", e);
      const msg = e && e.code === "permission-denied" ? "Faltan las reglas de Firestore para Noli."
        : e && e.message === "sin config" ? "Falta la configuración de Firebase."
        : "No se pudo conectar. Revisa el internet de la TV.";
      poner({ estado: "error", error: msg, panel: true });
    }
  },

  async apagar({ olvidar = true } = {}) {
    intento++;
    const t = tv; tv = null;
    if (olvidar) ls.set("noli.remoto", "");
    poner({ estado: "apagado", codigo: null, via: null, panel: false, error: "" });
    if (t) await t.cerrar();
  },

  mostrarPanel(si = true) { if (state.remoto.panel !== si) poner({ panel: si }); },

  // Al arrancar en la TV: si el control remoto estaba prendido antes de recargar, prenderlo otra vez (con el
  // mismo código, así el teléfono se vuelve a conectar solo)
  retomar(opts) {
    if (state.modo === "tv" && ls.get("noli.remoto") === "1") return remoto.encender(Object.assign({ mostrar: false }, opts));
  },
};
