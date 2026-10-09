// Lee los JSON de datos/. Las monedas salen de config.monedas, así que otra moneda es un archivo nuevo.
import { revisarDatos, indexar } from "./datos.js";

async function leer(url) {
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error(`No se pudo leer ${url} (${r.status})`);
  try { return await r.json(); }
  catch { throw new Error(`${url} no es JSON válido`); }
}

export async function cargarDatos(base = "datos/") {
  const config = await leer(base + "config.json");
  const pares = await Promise.all(config.monedas.map(async (id) => [id, await leer(base + id + ".json")]));
  const [productos, clientes, retos] = await Promise.all([
    leer(base + "productos.json"),
    leer(base + "clientes.json"),
    leer(base + "retos.json"),
  ]);
  const crudo = { config, monedas: Object.fromEntries(pares), productos, clientes, retos };
  return { datos: indexar(crudo), errores: revisarDatos(crudo) };
}
