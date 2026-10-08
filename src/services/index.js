// Lo único que habla con la red (archivos del sitio y Firebase) y con localStorage
export { cargarCatalogo, BASE } from "./catalogo-repo.js";
export { ls, leerJsonLs, leerDatosJuego, guardarDatosJuego } from "./prefs.js";
export { registerServiceWorker, fetchPublishedVersion } from "./updates.js";
export { loadFirebaseSdk, initFirebase } from "./firebase.js";
export { PERFILES, VINCULOS, VINCULO_DURA_MS, nuevoIdPerfil, nuevoCodigo, crearPerfil, existePerfil, subirJuego, leerJuegos,
  escucharJuegos, crearVinculo, escucharVinculo, borrarVinculo, completarVinculo } from "./nube.js";
