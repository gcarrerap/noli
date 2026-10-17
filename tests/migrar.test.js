// Migración de dominomx a gcarrerap-noli (#112): mismos ids, no se pisa lo más nuevo, el ensayo no escribe.
import { test } from "node:test";
import assert from "node:assert/strict";
import { migrar } from "../scripts/migrar-dominomx.mjs";

// Firestore de mentira con la forma del SDK de administrador (collection/doc/get/set), sobre un Map de rutas.
function fakeAdmin(inicial = {}) {
  const docs = new Map(Object.entries(inicial));
  const doc = (ruta) => ({
    id: ruta.split("/").pop(),
    collection: (n) => col(`${ruta}/${n}`),
    get: async () => ({ exists: docs.has(ruta), data: () => docs.get(ruta) }),
    set: async (d, o) => docs.set(ruta, o && o.merge ? { ...(docs.get(ruta) || {}), ...d } : d),
  });
  const col = (ruta) => ({
    doc: (id) => doc(`${ruta}/${id}`),
    get: async () => ({
      docs: [...docs.keys()].filter((k) => k.startsWith(ruta + "/") && !k.slice(ruta.length + 1).includes("/"))
        .map((k) => ({ id: k.split("/").pop(), data: () => docs.get(k) })),
    }),
  });
  return { collection: col, docs };
}

const P = "a".repeat(24), Q = "b".repeat(24);
const viejo = () => fakeAdmin({
  [`noli_perfiles/${P}`]: { creado: 1, nombre: "Noelia" },
  [`noli_perfiles/${P}/juegos/pasarela`]: { json: "{\"v\":2}", actualizado: 200, dispositivo: "tv" },
  [`noli_perfiles/${P}/juegos/_creditos`]: { json: "{\"c\":5}", actualizado: 100, dispositivo: "tv" },
  [`noli_perfiles/${Q}`]: { creado: 2 },
  [`pata_mesas/x`]: { no: "se copia" },
});

test("copia perfiles y juegos con los mismos ids", async () => {
  const v = viejo(), n = fakeAdmin();
  const r = await migrar(v, n, { escribir: true });
  assert.deepEqual(r, { perfiles: 2, perfilesNuevos: 2, juegos: 2, juegosCopiados: 2, juegosSaltados: 0 });
  assert.deepEqual(n.docs.get(`noli_perfiles/${P}`), { creado: 1, nombre: "Noelia" });
  assert.equal(n.docs.get(`noli_perfiles/${P}/juegos/pasarela`).json, "{\"v\":2}");
  assert.ok(n.docs.has(`noli_perfiles/${Q}`));
  assert.ok(![...n.docs.keys()].some((k) => k.startsWith("pata_")), "solo noli_perfiles");
});

test("el ensayo no escribe nada", async () => {
  const n = fakeAdmin();
  const r = await migrar(viejo(), n);
  assert.equal(r.juegosCopiados, 2);
  assert.equal(n.docs.size, 0);
});

test("no pisa un juego más nuevo en el destino y se puede repetir", async () => {
  const n = fakeAdmin({
    [`noli_perfiles/${P}`]: { creado: 1 },
    [`noli_perfiles/${P}/juegos/pasarela`]: { json: "{\"v\":3}", actualizado: 300, dispositivo: "tel" },
  });
  const r = await migrar(viejo(), n, { escribir: true });
  assert.equal(r.juegosSaltados, 1);
  assert.equal(n.docs.get(`noli_perfiles/${P}/juegos/pasarela`).json, "{\"v\":3}");
  assert.equal(n.docs.get(`noli_perfiles/${P}`).nombre, "Noelia", "trae el nombre si faltaba");
  const otra = await migrar(viejo(), n, { escribir: true });
  assert.equal(otra.juegosCopiados, 0);
});
