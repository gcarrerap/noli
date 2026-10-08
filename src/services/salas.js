// Salas del control remoto en Firestore (issue #3). Es lo único del control remoto que toca Firestore.
//
//   noli_salas/{código}                 la sala (forma en engine/sala.js)
//   noli_salas/{código}/senales/{id}    mensajes para conectar WebRTC: { de, deSid, para, paraSid, tipo: "desc" | "ice", desc | candidato, t }
//   noli_salas/{código}/acciones/{id}   respaldo cuando WebRTC no conecta: { accion, sesion, de, t }
//
// Igual que la señalización de las llamadas de myPata (services/call-signaling.js): los ids se ordenan por hora de
// creación (Firestore entrega los documentos ordenados por id), quien recibe un mensaje lo borra, y cada vez que
// alguien se conecta lleva un sid nuevo para descartar mensajes de una conexión anterior.
import { nuevoCodigo, salaVigente, esCodigo, SALA_VIDA_MS } from "../engine/sala.js";

export const SALAS = "noli_salas";
const sala = (fs, c) => fs.doc(`${SALAS}/${c}`);

let contador = 0;
export function nuevoId(now = Date.now()) {
  contador = (contador + 1) % 1296;
  return now.toString(36).padStart(9, "0") + contador.toString(36).padStart(2, "0") + Math.random().toString(36).slice(2, 7);
}

const error = (code, msg) => Object.assign(new Error(msg || code), { code });

// La TV abre una sala. Prueba primero `preferido` (el código que tenía antes de recargar, para que el teléfono
// siga conectado) y luego códigos al azar, hasta encontrar uno libre: que no exista, que ya se haya vencido o que
// sea de esta misma TV. Devuelve el código.
export async function abrirSala(fs, { tv, sesion, preferido = null, now = Date.now, rand = Math.random, intentos = 25 }) {
  const probar = [];
  if (esCodigo(preferido)) probar.push(preferido);
  while (probar.length < intentos) probar.push(nuevoCodigo(rand));
  for (const codigo of probar) {
    const ok = await fs.runTransaction(async (tx) => {
      const d = await tx.get(sala(fs, codigo));
      const actual = d.exists ? d.data() : null;
      if (actual && salaVigente(actual, now()) && actual.tv !== tv) return false; // ocupada por otra TV
      const t = now();
      // El teléfono que ya estaba (si la misma TV recargó) se conserva: él solo vuelve a conectarse
      const control = actual && actual.tv === tv && salaVigente(actual, t) ? actual.control || null : null;
      tx.set(sala(fs, codigo), { codigo, tv, sesion, creada: t, vence: t + SALA_VIDA_MS, tvVisto: t, control });
      return true;
    });
    if (ok) return codigo;
  }
  throw error("sin-codigo", "No hay códigos libres");
}

// La TV avisa que sigue ahí. Devuelve false si la sala ya no es suya (otra TV la tomó después de vencerse).
export function renovarSala(fs, codigo, sesion, now = Date.now()) {
  return fs.runTransaction(async (tx) => {
    const d = await tx.get(sala(fs, codigo));
    if (!d.exists || d.data().sesion !== sesion) return false;
    tx.set(sala(fs, codigo), { ...d.data(), vence: now + SALA_VIDA_MS, tvVisto: now });
    return true;
  });
}

// La TV cierra su sala (al apagar el control remoto). Solo si sigue siendo suya.
export function cerrarSala(fs, codigo, sesion) {
  return fs.runTransaction(async (tx) => {
    const d = await tx.get(sala(fs, codigo));
    if (d.exists && d.data().sesion === sesion) tx.delete(sala(fs, codigo));
  });
}

// El teléfono se une (o avisa que sigue ahí). Truena con code "no-existe" si la sala no existe o ya se venció.
// Devuelve la sala como quedó.
export function unirseSala(fs, codigo, { id, sid }, now = Date.now()) {
  return fs.runTransaction(async (tx) => {
    const d = await tx.get(sala(fs, codigo));
    const actual = d.exists ? d.data() : null;
    if (!salaVigente(actual, now)) throw error("no-existe", "No hay ninguna TV con ese código");
    const nueva = { ...actual, control: { id, sid, visto: now } };
    tx.set(sala(fs, codigo), nueva);
    return nueva;
  });
}

// Escuchar la sala (null si no existe). Devuelve cómo dejar de escuchar.
export function verSala(fs, codigo, alCambiar, alError = () => {}) {
  return sala(fs, codigo).onSnapshot((d) => alCambiar(d.exists ? d.data() : null), alError);
}

// ---------- Señales de WebRTC ----------
export function mandarSenal(fs, codigo, m) {
  return fs.doc(`${SALAS}/${codigo}/senales/${nuevoId()}`).set({ ...m, t: Date.now() });
}
// Las señales para `para`. Cada una se entrega una sola vez, en orden, y se borra.
export function verSenales(fs, codigo, para, alSenal, alError = () => {}) {
  return entregarUnaVez(fs.collection(`${SALAS}/${codigo}/senales`).where("para", "==", para), alSenal, alError);
}

// ---------- Acciones por Firestore (respaldo) ----------
export function mandarAccion(fs, codigo, m) {
  return fs.doc(`${SALAS}/${codigo}/acciones/${nuevoId()}`).set({ ...m, t: Date.now() });
}
// Las acciones de esta sesión de la sala, una vez cada una, en orden; se borran al recibirlas
export function verAcciones(fs, codigo, sesion, alAccion, alError = () => {}) {
  return entregarUnaVez(fs.collection(`${SALAS}/${codigo}/acciones`).where("sesion", "==", sesion), alAccion, alError);
}

function entregarUnaVez(consulta, fn, alError) {
  const vistas = new Set();
  return consulta.onSnapshot((snap) => {
    for (const d of snap.docs) {
      if (vistas.has(d.id)) continue;
      vistas.add(d.id);
      const m = d.data();
      Promise.resolve().then(() => d.ref.delete()).catch(() => {});
      if (m) fn(m);
    }
  }, alError);
}
