// Niveles de un juego abierto desde una isla del mundo (#176). El catálogo abre el juego con `?isla=cristal&nivel=7`
// (actions.abrir(id, { isla, nivelInicial })); el kit lo lee (Noli.isla, Noli.nivelInicial) y estas funciones puras
// deciden en qué nivel se juega. Sirven para los juegos que guardan `{ nivel, elegido }`: `nivel` es el más alto
// desbloqueado y `elegido` el que se escogió en el mapa de niveles. Ver DESIGN.md § Juegos en otras islas.
//
// Reglas:
//   - El piso de la isla (nivelInicial) desbloquea hasta ahí: `nivel` nunca queda abajo del piso. Lo ganado no baja.
//   - En la isla se juega en el nivel más alto desbloqueado, o en el que escoja ahí (nunca abajo del piso).
//   - Lo que se escoge en la isla vive solo mientras está abierto (no se guarda): en Isla Noli el juego sigue en el
//     nivel que tenía escogido antes. Por eso, al subir el piso, `elegido` se queda con el nivel que se jugaba.

/** El piso (1 = sin piso), acotado a los niveles que tiene el juego */
export const pisoDe = (nivelInicial, total) => Math.max(1, Math.min(total, Math.trunc(nivelInicial) || 1));

/** El nivel que se jugaba fuera de las islas */
export const nivelNormal = (pr) => Math.min(pr.elegido || pr.nivel, pr.nivel);

/** El progreso con el piso de la isla desbloqueado (el mismo objeto si no cambia nada) */
export function conPiso(pr, piso) {
  if (piso <= 1 || pr.nivel >= piso) return pr;
  return { ...pr, elegido: nivelNormal(pr), nivel: piso };
}

/**
 * En qué nivel se juega.
 * @param {{ nivel: number, elegido?: number }} pr
 * @param {number} piso pisoDe(...)
 * @param {number} [enIsla] el que escogió en esta visita a la isla (0 = ninguno)
 */
export function nivelActual(pr, piso, enIsla = 0) {
  if (piso <= 1) return nivelNormal(pr);
  return Math.max(piso, Math.min(enIsla || pr.nivel, pr.nivel));
}

/** ¿Se puede escoger el nivel n en el mapa de niveles? (desbloqueado y, en una isla, no abajo del piso) */
export const escogible = (pr, piso, n) => n <= pr.nivel && n >= piso;

/** Después de cerrar una ronda en una isla: `elegido` se queda como estaba (lo de la isla no se guarda) */
export const trasRonda = (antes, despues, piso) => (piso > 1 ? { ...despues, elegido: antes.elegido } : despues);

/** Lee `?isla=` y `?nivel=` de una URL (o de location.search) */
export function deUrl(search) {
  const p = new URLSearchParams(search || "");
  const n = parseInt(p.get("nivel"), 10);
  const isla = /^[a-z0-9-]{1,30}$/.test(p.get("isla") || "") ? p.get("isla") : "noli";
  return { isla, nivelInicial: Number.isFinite(n) && n > 1 ? n : 1 };
}
