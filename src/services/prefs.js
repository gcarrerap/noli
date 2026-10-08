// Preferencias y progreso de este dispositivo en localStorage. Nunca truena: si el navegador bloquea el
// almacenamiento (modo privado, permisos), get devuelve null y set no hace nada.
// Claves en uso: noli.progreso ({ id: { estrellas, veces, ultima } }), noli.materia (filtro elegido) y
// noli.datos.<id> (lo que cada juego guarda con Noli.guardar).
export const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

export function leerJsonLs(k, porOmision) {
  try { const v = JSON.parse(ls.get(k)); return v ?? porOmision; } catch { return porOmision; }
}

// Datos propios de cada juego (Noli.guardar). Hoy en este dispositivo; aquí se enchufará la nube.
export const leerDatosJuego = (id) => leerJsonLs("noli.datos." + id, null);
export const guardarDatosJuego = (id, datos) => ls.set("noli.datos." + id, JSON.stringify(datos));
