// Conexión con Firebase (SDK compat del CDN, como global `firebase`), igual que en myDomino y myPata.
// Es el único módulo que toca `firebase`. Noli solo usa la entrada anónima: el progreso se liga a un perfil
// (ver services/nube.js), no a una cuenta.

// El SDK se carga aquí, después de dibujar la pantalla, y no en el <head> de index.html: así el catálogo y los
// juegos aparecen de inmediato aunque el CDN tarde o no responda, y solo se carga si la nube está activada.
const CDN = "https://www.gstatic.com/firebasejs/10.12.2/";
const SDK = ["firebase-app-compat.js", "firebase-auth-compat.js", "firebase-firestore-compat.js"];
let iniciado = null;
let loading = null;
export function loadFirebaseSdk() {
  if (window.firebase) return Promise.resolve();
  if (!loading) {
    // Se descargan en paralelo y se ejecutan en orden (auth y firestore necesitan app)
    loading = Promise.all(SDK.map((f) => new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = CDN + f; s.async = false;
      s.onload = resolve; s.onerror = () => reject(new Error("No se pudo cargar " + f));
      document.head.appendChild(s);
    }))).catch((e) => { loading = null; throw e; });
  }
  return loading;
}
// Solo para pruebas: olvidar la carga en curso o hecha
export function _resetLoaderForTests() { loading = null; }

// Carga el SDK, inicia Firebase y espera al primer usuario. Si no hay sesión, entra como invitado (anónimo).
// onUser(u, first) se llama cada vez que cambia el usuario; first es true solo la primera vez.
// Devuelve la instancia de Firestore. Truena si no hay configuración o si Firebase no se pudo cargar.
export function initFirebase(onUser = () => {}, config = window.FIREBASE_CONFIG) {
  if (!iniciado) iniciado = iniciar(onUser, config).catch((e) => { iniciado = null; throw e; });
  return iniciado;
}
export function _resetInitForTests() { iniciado = null; }

async function iniciar(onUser, config) {
  if (!config || !config.projectId) throw new Error("sin config");
  await loadFirebaseSdk();
  if (!window.firebase) throw new Error("sin config");
  firebase.initializeApp(config);
  const auth = firebase.auth();
  try { await auth.getRedirectResult(); } catch {}
  await new Promise((res) => {
    let first = true;
    auth.onAuthStateChanged(async (u) => {
      if (!u) { try { await auth.signInAnonymously(); } catch (e) { console.warn(e); if (first) { first = false; res(); } } return; }
      const wasFirst = first;
      onUser(u, wasFirst);
      if (first) { first = false; res(); }
    });
  });
  return firebase.firestore();
}
