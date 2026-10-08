// Pruebas de "cargar siempre la versión más reciente": el service worker (mismo que en myDomino).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

globalThis.localStorage = { getItem: () => null, setItem: () => {} };
globalThis.window = globalThis;

// ---------- Service worker (sw.js se carga como en el navegador, con self, caches y fetch de mentira) ----------

function loadSW({ network }) {
  const store = new Map(), listeners = {};
  const cache = {
    put: async (req, res) => store.set(req.url, res),
    match: async (req, opts) => { const u = opts && opts.ignoreSearch ? req.url.split("?")[0] : req.url; for (const [k, v] of store) if ((opts && opts.ignoreSearch ? k.split("?")[0] : k) === u) return v; return undefined; },
  };
  const fetchCalls = [];
  const ctx = {
    self: { location: { origin: "https://gcarrerap.github.io" }, addEventListener: (t, f) => (listeners[t] = f), skipWaiting() {}, clients: { claim: async () => {} } },
    caches: { open: async () => cache, keys: async () => [], delete: async () => true },
    fetch: async (req, opts) => { fetchCalls.push([req.url, opts && opts.cache]); return network(req); },
    URL, Response, module: { exports: {} },
  };
  vm.runInNewContext(fs.readFileSync(new URL("../sw.js", import.meta.url), "utf8"), ctx);
  return { sw: ctx.module.exports, store, fetchCalls, listeners };
}
const req = (url, method = "GET") => ({ url, method });
const SITE = "https://gcarrerap.github.io/noli/";
test("sw: los archivos del juego se piden al servidor confirmando que siguen iguales, y se guarda copia", async () => {
  const { sw, store, fetchCalls } = loadSW({ network: async () => new Response("nuevo", { status: 200 }) });
  const res = await sw.handle(req(SITE + "src/main.js"), "https://gcarrerap.github.io");
  assert.equal(await res.text(), "nuevo");
  assert.deepEqual(fetchCalls[0], [SITE + "src/main.js", "no-cache"]);
  assert.ok(store.has(SITE + "src/main.js"));
});
test("sw: sin conexión usa la copia guardada", async () => {
  let online = true;
  const { sw } = loadSW({ network: async () => { if (!online) throw new TypeError("Failed to fetch"); return new Response("v1", { status: 200 }); } });
  await sw.handle(req(SITE + "index.html"), "https://gcarrerap.github.io");
  online = false;
  const res = await sw.handle(req(SITE + "index.html"), "https://gcarrerap.github.io");
  assert.equal(await res.text(), "v1");
});
test("sw: sin conexión y sin copia, falla como sin service worker", async () => {
  const { sw } = loadSW({ network: async () => { throw new TypeError("Failed to fetch"); } });
  await assert.rejects(sw.handle(req(SITE + "src/x.js"), "https://gcarrerap.github.io"), /Failed to fetch/);
});

test("sw: no se mete con peticiones de pedazos (audio con Range) y no falla si no puede guardar", async () => {
  const { sw, store } = loadSW({ network: async () => new Response("parte", { status: 206 }) });
  const conRange = { url: SITE + "minijuegos/spelling/audio/p/cat.mp3", method: "GET", headers: new Headers({ range: "bytes=0-" }) };
  assert.equal(sw.handle(conRange, "https://gcarrerap.github.io"), null);
  const res = await sw.handle(req(SITE + "minijuegos/spelling/audio/p/cat.mp3"), "https://gcarrerap.github.io");
  assert.equal(res.status, 206);
  assert.equal(store.size, 0, "un 206 no se guarda");
});
