// Que todos los módulos se puedan cargar: revisa la sintaxis y que cada import exista en el módulo de donde se
// importa (un import duplicado o un nombre mal escrito tumba la página entera en el navegador).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const raiz = new URL("..", import.meta.url).pathname;
function archivos(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" || e.name.startsWith(".") || e.name === "tests" ? [] : archivos(p);
    return e.name.endsWith(".js") && !["sw.js", "config.js"].includes(e.name) ? [p] : [];
  });
}

test("cada módulo de src/, kit/ y minijuegos/ se analiza y sus imports existen", async () => {
  const lista = ["src", "kit", "minijuegos"].flatMap((d) => archivos(path.join(raiz, d)));
  assert.ok(lista.length > 20);
  const mods = new Map();
  for (const f of lista) {
    try { mods.set(f, new vm.SourceTextModule(fs.readFileSync(f, "utf8"), { identifier: f })); }
    catch (e) { assert.fail(`${path.relative(raiz, f)}: ${e.message}`); }
  }
  // Ligar sin ejecutar: falla si un import pide un nombre que el otro módulo no exporta
  for (const [f, m] of mods) {
    if (m.status !== "unlinked") continue; // ya quedó ligado como dependencia de otro
    try {
      await m.link((esp, ref) => {
        const destino = path.resolve(path.dirname(ref.identifier), esp);
        const d = mods.get(destino);
        if (!d) throw new Error(`no existe ${esp}`);
        return d;
      });
    } catch (e) { assert.fail(`${path.relative(raiz, f)}: ${e.message}`); }
  }
});
