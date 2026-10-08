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

// Recibe un KeyboardEvent (o algo con key/keyCode) y devuelve la acción, o null si la tecla no es del control.
export function teclaAAccion(e) {
  if (!e || e.altKey || e.ctrlKey || e.metaKey) return null;
  return POR_NOMBRE[e.key] || POR_CODIGO[e.keyCode] || null;
}
