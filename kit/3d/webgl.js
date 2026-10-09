// ¿Hay WebGL en este navegador? Archivo aparte (sin Three.js) para poder preguntarlo antes de bajar los 670 KB de
// Three.js: el catálogo lo usa para decidir entre el mundo 3D y el menú 2D (#25), y la Pasarela entre 3D y modo sencillo.
export function hayWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
  } catch (e) { return false; }
}
