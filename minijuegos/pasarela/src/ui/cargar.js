// Leer los JSON de datos/ en el navegador, revisarlos e indexarlos (src/datos.js). Si un archivo de datos está mal
// escrito, el juego enseña el error en lugar de quedarse en blanco (pasa al editar prendas.json a mano).
import { revisarDatos, indexar, ARCHIVOS } from "../datos.js";

/**
 * @param {string} [base] carpeta de los datos, relativa a la página
 * @returns {Promise<{ idx: object, errores: string[] }>}
 */
export async function cargarDatos(base = "datos/") {
  const d = {};
  await Promise.all(Object.entries(ARCHIVOS).map(async ([k, f]) => {
    const r = await fetch(base + f, { cache: "no-cache" });
    if (!r.ok) throw new Error(`No se pudo leer ${f} (${r.status})`);
    try { d[k] = await r.json(); } catch (e) { throw new Error(`${f} no es JSON válido: ${e.message}`); }
  }));
  const errores = revisarDatos(d);
  return { idx: indexar(d), errores };
}
