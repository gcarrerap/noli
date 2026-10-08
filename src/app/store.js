// Estado de la app: un solo objeto, dueño de todo lo que la interfaz necesita saber.
// Las acciones (actions.js) lo cambian y llaman a notify(); la interfaz se suscribe con subscribe() y redibuja.
import { ls, leerJsonLs } from "../services/index.js";
import { filtrar, jugableEn } from "../engine/index.js";

function modoInicial() {
  try { return new URLSearchParams(location.search).get("modo") === "tv" ? "tv" : "tactil"; } catch { return "tactil"; }
}

export const state = {
  modo: modoInicial(),       // "tactil" (teléfono/tableta) o "tv" (pantalla grande, se juega con control)
  cargando: true,
  juegos: [],                // manifiestos válidos, en el orden de catalogo.json
  errores: [],               // manifiestos que no se pudieron leer (se ven en la consola, no se le enseñan a Noelia)
  materia: ls.get("noli.materia") || null, // filtro; null = todos
  foco: 0,                   // tarjeta con el foco (índice dentro de los juegos filtrados)
  cols: 1,                   // columnas de la cuadrícula; la interfaz lo actualiza al dibujar
  jugando: null,             // el juego abierto (manifiesto) o null en el catálogo
  progreso: leerJsonLs("noli.progreso", {}), // por id: { estrellas (la mejor), veces, ultima (ms) }
  celebrar: null,            // { id, estrellas } recién terminado, para el aviso
  updateAvailable: false,
  nube: {},                  // sincronización (ver app/sync.js): estado, perfil, código para vincular, avisos
  nubeAbierta: false,        // la ventana de la nube
};

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function notify(what) { for (const fn of listeners) fn(what); }

// ---------- Derivados ----------
// Los juegos de la materia elegida que se pueden jugar en este modo (en la TV, solo los que aceptan flechas o remoto)
export const visibles = () => filtrar(state.juegos.filter((j) => jugableEn(j, state.modo)), state.materia);
