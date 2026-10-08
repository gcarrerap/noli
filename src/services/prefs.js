// Preferencias y progreso de este dispositivo en localStorage. Nunca truena: si el navegador bloquea el
// almacenamiento (modo privado, permisos), get devuelve null y set no hace nada.
// Claves en uso: noli.progreso ({ id: { estrellas, veces, ultima } }), noli.materia (filtro elegido).
export const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

export function leerJsonLs(k, porOmision) {
  try { const v = JSON.parse(ls.get(k)); return v ?? porOmision; } catch { return porOmision; }
}
