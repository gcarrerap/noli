// Conexión con Firebase (SDK compat del CDN, como global `firebase`), igual que en myDomino y myPata.
// Es el único módulo que toca `firebase`. Se entra como invitado (anónimo); en el teléfono se puede entrar con la
// cuenta de Google de Noelia (#114) para que su perfil quede ligado a esa cuenta (ver services/nube.js).

// El SDK se carga aquí, después de dibujar la pantalla, y no en el <head> de index.html: así el catálogo y los
// juegos aparecen de inmediato aunque el CDN tarde o no responda, y solo se carga si la nube está activada.
const CDN = "https://www.gstatic.com/firebasejs/10.12.2/";
const SDK = ["firebase-app-compat.js", "firebase-auth-compat.js", "firebase-firestore-compat.js"];
let iniciado = null;
let loading = null;
let usuario = null; // el usuario (anónimo) actual
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
export function _resetInitForTests() { iniciado = null; usuario = null; }

// Para el control remoto (issue #3): Firestore y el id del usuario anónimo, que identifica a la TV y al teléfono
// en la sala. Comparte la misma conexión que la nube.
export async function conectarFirebase(config = window.FIREBASE_CONFIG) {
  const fs = await initFirebase(undefined, config);
  if (!usuario) throw new Error("sin usuario");
  return { fs, uid: usuario.uid };
}

// ---------- Cuenta de Google de Noelia (#114) ----------
// Popup primero; si el navegador no lo deja, redirección (la página se vuelve a abrir ya con la sesión: lo termina
// app/sync.js → terminarEntrada). Devuelve { uid, email }, o null si se fue por redirección.
const deGoogle = (u) => (u && !u.isAnonymous ? { uid: u.uid, email: u.email || "" } : null);
export function usuarioGoogle() { return deGoogle(usuario); }
export async function entrarGoogle(config = window.FIREBASE_CONFIG) {
  await initFirebase(undefined, config);
  const auth = firebase.auth();
  const prov = new firebase.auth.GoogleAuthProvider();
  prov.setCustomParameters({ prompt: "select_account" });
  try {
    const r = await auth.signInWithPopup(prov);
    usuario = (r && r.user) || auth.currentUser || usuario;
    return deGoogle(usuario);
  } catch (e) {
    if (e && ["auth/popup-blocked", "auth/operation-not-supported-in-this-environment", "auth/cancelled-popup-request"].includes(e.code)) {
      await auth.signInWithRedirect(prov);
      return null;
    }
    throw e;
  }
}
// Salir de la cuenta de Google: se vuelve a entrar como invitado solo (onAuthStateChanged de iniciar)
export async function salirGoogle() {
  if (deGoogle(usuario) && window.firebase) await firebase.auth().signOut(); // hay usuario: Firebase ya se inició
}

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
      usuario = u;
      onUser(u, wasFirst);
      if (first) { first = false; res(); }
    });
  });
  return firebase.firestore();
}

// ---------- Administrador (admin.html) ----------
// La página de administrador NO entra como invitado: pide la cuenta de Google (las reglas dejan listar perfiles solo a
// la del administrador). Popup primero; si el navegador lo bloquea (o en el teléfono no se puede), redirección.
// Devuelve { fs, usuario } con usuario null si todavía no entra (la redirección regresa a la página ya con sesión).
let adminApp = null;
async function appAdmin(config) {
  if (!config || !config.projectId) throw new Error("sin config");
  await loadFirebaseSdk();
  if (!adminApp) { adminApp = true; if (!(firebase.apps && firebase.apps.length)) firebase.initializeApp(config); }
  return firebase.auth();
}

/** Revisa si ya hay sesión de Google (sin pedirla). */
export async function sesionAdmin(config = window.FIREBASE_CONFIG) {
  const auth = await appAdmin(config);
  try { await auth.getRedirectResult(); } catch (e) { console.warn(e); }
  const u = await new Promise((res) => { const fin = auth.onAuthStateChanged((x) => { fin(); res(x); }); });
  return { fs: firebase.firestore(), usuario: u && !u.isAnonymous ? u : null };
}

/** Pide entrar con Google. */
export async function entrarAdmin(config = window.FIREBASE_CONFIG) {
  const auth = await appAdmin(config);
  const prov = new firebase.auth.GoogleAuthProvider();
  prov.setCustomParameters({ prompt: "select_account" });
  try {
    const r = await auth.signInWithPopup(prov);
    return { fs: firebase.firestore(), usuario: r.user };
  } catch (e) {
    if (e && ["auth/popup-blocked", "auth/operation-not-supported-in-this-environment", "auth/cancelled-popup-request"].includes(e.code)) {
      await auth.signInWithRedirect(prov);
      return { fs: firebase.firestore(), usuario: null };
    }
    throw e;
  }
}

export async function salirAdmin() { if (window.firebase && firebase.apps && firebase.apps.length) await firebase.auth().signOut(); }
