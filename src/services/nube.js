// Progreso en la nube (Firestore, proyecto dominomx, colecciones "noli_"). Recibe la instancia de Firestore
// (fs) para poder probarse con el Firebase de mentira. Ver DESIGN.md §7 y el issue #7.
//
//   noli_perfiles/{perfil}                     { creado }            perfil: id aleatorio y largo (la llave)
//   noli_perfiles/{perfil}/juegos/{juego}      { json, actualizado, dispositivo }
//   noli_vinculos/{código de 6 dígitos}        { creado, expira, perfil: null | id }

export const PERFILES = "noli_perfiles";
export const VINCULOS = "noli_vinculos";
export const VINCULO_DURA_MS = 10 * 60 * 1000;

// Id de perfil: 24 caracteres aleatorios (≈ 124 bits). Quien no lo conoce no puede leer el perfil.
export function nuevoIdPerfil(azar = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  const A = "abcdefghijkmnpqrstuvwxyz23456789";
  return [...azar(24)].map((b) => A[b % A.length]).join("");
}

export function nuevoCodigo(rnd = Math.random) {
  return String(Math.floor(rnd() * 1e6)).padStart(6, "0");
}

// ---------- Perfil y juegos ----------

export async function crearPerfil(fs, perfil, ahora = Date.now()) {
  await fs.doc(`${PERFILES}/${perfil}`).set({ creado: ahora });
}

export async function existePerfil(fs, perfil) {
  return (await fs.doc(`${PERFILES}/${perfil}`).get()).exists;
}

const juegos = (perfil) => `${PERFILES}/${perfil}/juegos`;
const leerDoc = (snap) => {
  const d = snap.data();
  try { return { juego: snap.id, datos: JSON.parse(d.json), actualizado: d.actualizado || 0, dispositivo: d.dispositivo || "" }; }
  catch { return null; }
};

export async function subirJuego(fs, perfil, juego, datos, actualizado, dispositivo) {
  await fs.doc(`${juegos(perfil)}/${juego}`).set({ json: JSON.stringify(datos), actualizado, dispositivo });
}

export async function leerJuegos(fs, perfil) {
  return (await fs.collection(juegos(perfil)).get()).docs.map(leerDoc).filter(Boolean);
}

// fn([{ juego, datos, actualizado, dispositivo }]) cada vez que cambia algo; devuelve la función para dejar de escuchar
export function escucharJuegos(fs, perfil, fn, alFallar) {
  return fs.collection(juegos(perfil)).onSnapshot((snap) => fn(snap.docs.map(leerDoc).filter(Boolean)), alFallar);
}

// ---------- Vincular un dispositivo nuevo ----------
// El dispositivo nuevo (la TV) crea el código y lo enseña; el que ya tiene el perfil (el teléfono) lo escribe.

export async function crearVinculo(fs, { rnd = Math.random, ahora = Date.now() } = {}) {
  for (let i = 0; i < 5; i++) {
    const codigo = nuevoCodigo(rnd), ref = fs.doc(`${VINCULOS}/${codigo}`);
    const s = await ref.get();
    if (s.exists && s.data().expira > ahora) continue; // ocupado: otro código
    await ref.set({ creado: ahora, expira: ahora + VINCULO_DURA_MS, perfil: null });
    return codigo;
  }
  throw new Error("No se pudo crear un código. Intenta otra vez.");
}

// fn(perfil) cuando el otro dispositivo escriba el perfil
export function escucharVinculo(fs, codigo, fn, alFallar) {
  return fs.doc(`${VINCULOS}/${codigo}`).onSnapshot((s) => { if (s.exists && s.data().perfil) fn(s.data().perfil); }, alFallar);
}

export async function borrarVinculo(fs, codigo) {
  try { await fs.doc(`${VINCULOS}/${codigo}`).delete(); } catch {}
}

// Desde el dispositivo que ya tiene el perfil. Truena con un mensaje para Noelia o sus papás si no sirve.
export async function completarVinculo(fs, codigo, perfil, ahora = Date.now()) {
  if (!/^\d{6}$/.test(codigo)) throw new Error("El código tiene 6 números.");
  const ref = fs.doc(`${VINCULOS}/${codigo}`);
  const s = await ref.get();
  if (!s.exists) throw new Error("Ese código no existe. Revisa los números en la otra pantalla.");
  const v = s.data();
  if (v.expira <= ahora) throw new Error("Ese código ya venció. Pide uno nuevo en la otra pantalla.");
  if (v.perfil) throw new Error("Ese código ya se usó.");
  await ref.update({ perfil });
}
