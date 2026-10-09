// Leer el catálogo: minijuegos/catalogo.json (la lista de ids, en orden) y el juego.json de cada uno.
// Un sitio estático no puede listar carpetas, por eso el registro es explícito.
// Un juego con un manifiesto roto no tumba el catálogo: se omite y se reporta en `errores`.
import { validarManifiesto } from "../engine/index.js";

export const BASE = new URL("../../minijuegos/", import.meta.url);

async function leerJson(url, fetchFn) {
  const res = await fetchFn(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${res.status} al leer ${url}`);
  return res.json();
}

// Devuelve { juegos: [..], errores: [..] }. Cada juego trae `url`: la dirección de su página de entrada.
export async function cargarCatalogo({ base = BASE, fetchFn = fetch } = {}) {
  const reg = await leerJson(new URL("catalogo.json", base), fetchFn);
  const ids = Array.isArray(reg && reg.juegos) ? reg.juegos : [];
  const errores = [];
  const leidos = await Promise.all(ids.map(async (id) => {
    if (typeof id !== "string" || !/^[a-z0-9-]+$/.test(id)) { errores.push(`id inválido en catalogo.json: ${JSON.stringify(id)}`); return null; }
    const carpeta = new URL(id + "/", base);
    try {
      const { juego, errores: e } = validarManifiesto(await leerJson(new URL("juego.json", carpeta), fetchFn), id);
      if (e) { errores.push(...e); return null; }
      return { ...juego, url: new URL(juego.entrada, carpeta).href, iconoUrl: juego.iconoArchivo ? new URL(juego.icono, carpeta).href : null };
    } catch (err) { errores.push(`${id}: ${err.message}`); return null; }
  }));
  return { juegos: leidos.filter(Boolean), errores };
}

// El mundo del menú principal (#25): mundo/mundo.json y mundo/lugares.json
export const BASE_MUNDO = new URL("../../mundo/", import.meta.url);
export async function cargarMundo({ base = BASE_MUNDO, fetchFn = fetch } = {}) {
  const [mundo, lugares] = await Promise.all([leerJson(new URL("mundo.json", base), fetchFn), leerJson(new URL("lugares.json", base), fetchFn)]);
  return { mundo, lugares };
}
