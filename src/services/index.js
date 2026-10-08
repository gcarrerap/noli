// Lo único que habla con la red (archivos del sitio) y con localStorage
export { cargarCatalogo, BASE } from "./catalogo-repo.js";
export { ls, leerJsonLs } from "./prefs.js";
export { registerServiceWorker, fetchPublishedVersion } from "./updates.js";
