// Teclas → acciones. Los navegadores de smart TV mandan las flechas y el OK del control como teclas normales;
// el botón de "atrás" cambia según la marca, por eso se revisa también keyCode.
// No importa nada: lo usan el catálogo y kit/noli.js.

const POR_NOMBRE = {
  ArrowUp: "arriba", ArrowDown: "abajo", ArrowLeft: "izquierda", ArrowRight: "derecha",
  Up: "arriba", Down: "abajo", Left: "izquierda", Right: "derecha", // navegadores viejos de TV
  Enter: "ok", " ": "ok", Spacebar: "ok", Select: "ok",
  Escape: "atras", Backspace: "atras", GoBack: "atras", BrowserBack: "atras", Back: "atras",
};

const POR_CODIGO = {
  10009: "atras", // Samsung (Tizen)
  461: "atras",   // LG (webOS)
  8: "atras", 27: "atras",
  13: "ok", 32: "ok",
  37: "izquierda", 38: "arriba", 39: "derecha", 40: "abajo",
};

// Brincar (#25, solo en el mundo del menú principal): barra espaciadora y el botón rojo del control (LG y Samsung: 403)
const BRINCAR_NOMBRE = { " ": 1, Spacebar: 1, ColorF0Red: 1 };
const BRINCAR_CODIGO = { 32: 1, 403: 1 };

// Recibe un KeyboardEvent (o algo con key/keyCode) y devuelve la acción, o null si la tecla no es del control.
// Con { brincar: true } (el mundo 3D), la barra espaciadora y el botón rojo dan "brincar"; sin eso, la barra
// espaciadora sigue siendo OK, como siempre (catálogo 2D y juegos).
export function teclaAAccion(e, op) {
  if (!e || e.altKey || e.ctrlKey || e.metaKey) return null;
  if (op && op.brincar) {
    const sinNombre = !e.key || e.key === "Unidentified"; // navegadores viejos de TV: solo traen keyCode
    if (BRINCAR_NOMBRE[e.key] || e.keyCode === 403 || (sinNombre && BRINCAR_CODIGO[e.keyCode])) return "brincar";
  }
  return POR_NOMBRE[e.key] || POR_CODIGO[e.keyCode] || null;
}
