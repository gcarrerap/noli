// El control remoto del lado del teléfono (control.html, issue #3): recordar el código, conectarse a la sala y
// mandar las acciones. La interfaz (src/control/main.js) solo dibuja y llama aquí.
import { conectarFirebase, ls } from "../services/index.js";
import { leerCodigo } from "../engine/index.js";
import { crearControl } from "./enlace.js";

const oyentes = new Set();
const avisar = () => { for (const fn of oyentes) fn(); };
let enlace = null, codigo = null, intento = 0;

const entornoNavegador = () => ({
  conectar: conectarFirebase,
  env: { RTCPeerConnection: globalThis.RTCPeerConnection || globalThis.webkitRTCPeerConnection },
});

export const telefono = {
  alCambiar(fn) { oyentes.add(fn); return () => oyentes.delete(fn); },

  // El código con el que arrancar: el de la liga (?sala=…, del QR) o el último que se usó en este teléfono
  codigoInicial(search = location.search) {
    let deLiga = null;
    try { deLiga = leerCodigo(new URLSearchParams(search).get("sala")); } catch (x) {}
    return deLiga || leerCodigo(ls.get("noli.control"));
  },

  get codigo() { return codigo; },

  // { estado: "apagado" | "conectando" | "conectado" | "sin-tv" | "no-existe" | "otro" | "error", via }
  estado() {
    if (!codigo) return { estado: "apagado", via: null };
    return enlace ? enlace.estado() : { estado: "conectando", via: null };
  },

  // Conectarse a la TV con ese código. entorno: solo para pruebas.
  async conectar(texto, { entorno = entornoNavegador() } = {}) {
    const c = leerCodigo(texto);
    if (!c) return false;
    telefono.soltar();
    const mio = ++intento;
    codigo = c; avisar();
    try {
      const { fs, uid } = await entorno.conectar();
      if (mio !== intento) return false;
      enlace = crearControl({ fs, codigo: c, yo: uid, env: entorno.env, alCambiar: avisar });
      const ok = await enlace.conectar();
      if (mio !== intento) return false;
      if (ok) ls.set("noli.control", c);
      else if (enlace.estado().estado === "no-existe" && ls.get("noli.control") === c) ls.set("noli.control", "");
      avisar();
      return ok;
    } catch (e) {
      if (mio !== intento) return false;
      console.warn("[control]", e);
      enlace = { estado: () => ({ estado: "error", via: null }), enviar: () => null, reconectar: async () => false, cerrar() {} };
      avisar();
      return false;
    }
  },

  // Al regresar a la pantalla, al volver la red o al tocar "Usar este teléfono" (forzar)
  reconectar(opts) {
    if (!codigo) return Promise.resolve(false);
    if (enlace && enlace.estado().estado === "error") return telefono.conectar(codigo);
    return enlace ? enlace.reconectar(opts) : Promise.resolve(false);
  },

  enviar(accion) { return enlace ? enlace.enviar(accion) : null; },

  // Dejar esta TV (para escribir otro código)
  soltar({ olvidar = false } = {}) {
    intento++;
    if (enlace) enlace.cerrar();
    enlace = null; codigo = null;
    if (olvidar) ls.set("noli.control", "");
    avisar();
  },
};
