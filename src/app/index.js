// API de la app para la interfaz
export { state, subscribe, notify, visibles } from "./store.js";
export { actions, conectarJuego } from "./actions.js";
export { checkForUpdate, startUpdateChecks, applyUpdate } from "./updates.js";
export { remoto, alRemoto } from "./remoto.js";
export { crearTv, crearControl } from "./enlace.js";
