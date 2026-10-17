// Copia única del progreso de Noli del proyecto viejo (dominomx) al propio (gcarrerap-noli), #112.
// Copia noli_perfiles/{perfil} y noli_perfiles/{perfil}/juegos/{juego} con los MISMOS ids, así los dispositivos ya
// vinculados siguen funcionando sin hacer nada. No borra ni cambia nada en el proyecto viejo.
// Se puede correr varias veces: un juego que ya está en el nuevo solo se reemplaza si el viejo es más reciente
// (campo "actualizado"). noli_vinculos y noli_salas no se copian: duran minutos.
//
// Uso (Node 18+, desde la raíz del repo):
//   npm install --no-save firebase-admin
//   node scripts/migrar-dominomx.mjs --viejo llave-dominomx.json --nuevo llave-gcarrerap-noli.json            # ensayo
//   node scripts/migrar-dominomx.mjs --viejo llave-dominomx.json --nuevo llave-gcarrerap-noli.json --escribir # de verdad
// Las llaves son de "Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada". Son secretas:
// guárdalas fuera del repo y bórralas al terminar.
import fs from "node:fs";
import { pathToFileURL } from "node:url";

export const PERFILES = "noli_perfiles";

// viejo y nuevo: instancias de Firestore del SDK de administrador (o de mentira con la misma forma, en las pruebas).
// Devuelve un resumen; solo escribe si escribir es true.
export async function migrar(viejo, nuevo, { escribir = false, log = () => {} } = {}) {
  const r = { perfiles: 0, perfilesNuevos: 0, juegos: 0, juegosCopiados: 0, juegosSaltados: 0 };
  const perfiles = await viejo.collection(PERFILES).get();
  for (const p of perfiles.docs) {
    r.perfiles++;
    const datos = p.data();
    const destino = nuevo.collection(PERFILES).doc(p.id);
    const ya = await destino.get();
    if (!ya.exists) {
      r.perfilesNuevos++;
      if (escribir) await destino.set(datos);
    } else if (datos.nombre && !(ya.data() || {}).nombre) {
      if (escribir) await destino.set({ nombre: datos.nombre }, { merge: true });
    }
    const juegos = await viejo.collection(PERFILES).doc(p.id).collection("juegos").get();
    const copiados = [];
    for (const j of juegos.docs) {
      r.juegos++;
      const dj = j.data();
      const dest = destino.collection("juegos").doc(j.id);
      const actual = await dest.get();
      const nuevoT = actual.exists ? Number((actual.data() || {}).actualizado) || 0 : -1;
      if (nuevoT >= (Number(dj.actualizado) || 0)) { r.juegosSaltados++; continue; }
      r.juegosCopiados++;
      copiados.push(j.id);
      if (escribir) await dest.set(dj);
    }
    log(`${p.id}${datos.nombre ? ` (${datos.nombre})` : ""}: ${ya.exists ? "ya existía" : "nuevo"}; juegos: ${copiados.join(", ") || "ninguno por copiar"}`);
  }
  return r;
}

function argumentos(argv) {
  const a = { escribir: argv.includes("--escribir") };
  for (const k of ["viejo", "nuevo"]) {
    const i = argv.indexOf(`--${k}`);
    if (i >= 0 && argv[i + 1]) a[k] = argv[i + 1];
  }
  return a;
}

async function main() {
  const a = argumentos(process.argv.slice(2));
  if (!a.viejo || !a.nuevo) {
    console.error("Uso: node scripts/migrar-dominomx.mjs --viejo <llave dominomx.json> --nuevo <llave gcarrerap-noli.json> [--escribir]");
    process.exit(1);
  }
  let app, firestore;
  try { app = await import("firebase-admin/app"); firestore = await import("firebase-admin/firestore"); }
  catch { console.error("Falta firebase-admin: corre primero  npm install --no-save firebase-admin"); process.exit(1); }
  const llaveV = JSON.parse(fs.readFileSync(a.viejo, "utf8"));
  const llaveN = JSON.parse(fs.readFileSync(a.nuevo, "utf8"));
  if (llaveV.project_id !== "dominomx") console.warn(`Ojo: la llave --viejo es del proyecto "${llaveV.project_id}", no de dominomx.`);
  if (llaveN.project_id !== "gcarrerap-noli") console.warn(`Ojo: la llave --nuevo es del proyecto "${llaveN.project_id}", no de gcarrerap-noli.`);
  if (llaveV.project_id === llaveN.project_id) { console.error("Las dos llaves son del mismo proyecto."); process.exit(1); }
  const appV = app.initializeApp({ credential: app.cert(llaveV) }, "viejo");
  const appN = app.initializeApp({ credential: app.cert(llaveN) }, "nuevo");
  console.log(`${a.escribir ? "COPIANDO" : "ENSAYO (no se escribe nada)"}: ${llaveV.project_id} → ${llaveN.project_id}\n`);
  const r = await migrar(firestore.getFirestore(appV), firestore.getFirestore(appN), { escribir: a.escribir, log: (m) => console.log("  " + m) });
  console.log(`\nPerfiles: ${r.perfiles} (${r.perfilesNuevos} nuevos). Juegos: ${r.juegos} (${r.juegosCopiados} por copiar, ${r.juegosSaltados} ya al día).`);
  if (!a.escribir) console.log("Si se ve bien, repite el comando con --escribir al final.");
  await Promise.all([app.deleteApp(appV), app.deleteApp(appN)]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
