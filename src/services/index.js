// Lo único que habla con la red (archivos del sitio y Firebase) y con localStorage
export { cargarCatalogo, BASE } from "./catalogo-repo.js";
export { ls, leerJsonLs, leerDatosJuego, guardarDatosJuego } from "./prefs.js";
export { registerServiceWorker, fetchPublishedVersion } from "./updates.js";
export { loadFirebaseSdk, initFirebase, conectarFirebase } from "./firebase.js";
export { PERFILES, VINCULOS, VINCULO_DURA_MS, nuevoIdPerfil, nuevoCodigo, crearPerfil, existePerfil, subirJuego, leerJuegos,
  escucharJuegos, crearVinculo, escucharVinculo, borrarVinculo, completarVinculo } from "./nube.js";
// Control remoto (issue #3): las salas en Firestore
export { SALAS, abrirSala, renovarSala, cerrarSala, unirseSala, verSala, mandarSenal, verSenales, mandarAccion, verAcciones, nuevoId } from "./salas.js";
