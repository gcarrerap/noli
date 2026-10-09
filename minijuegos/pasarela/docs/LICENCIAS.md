# Licencias de la Pasarela

Regla: **nada entra al repo sin su renglón aquí.** El repo es público, así que cada modelo, animación, textura, fuente, sonido y librería necesita una licencia que permita redistribuirlo. Si no se sabe la licencia, no se usa.

## Lo que usa hoy

| Qué | Archivo(s) | Autor | Origen | Licencia | Fecha |
|---|---|---|---|---|---|
| Three.js r160.1 (motor 3D) | `kit/3d/vendor/three.module.min.js` | Three.js Authors | npm `three@0.160.1` (`build/three.module.min.js`) | MIT, texto en `kit/3d/vendor/LICENSE-three.txt` | 2026-10-08 |
| GLTFLoader (cargar .glb) | `kit/3d/vendor/GLTFLoader.js` | Three.js Authors | npm `three@0.160.1` (`examples/jsm/loaders/GLTFLoader.js`), con la línea `import … from 'three'` cambiada a `./three.module.min.js` | MIT (`kit/3d/vendor/LICENSE-three.txt`) | 2026-10-08 |
| BufferGeometryUtils (lo pide GLTFLoader) | `kit/3d/vendor/BufferGeometryUtils.js` | Three.js Authors | npm `three@0.160.1` (`examples/jsm/utils/`), mismo cambio de import | MIT (`kit/3d/vendor/LICENSE-three.txt`) | 2026-10-08 |
| Personaje, ropa, joyería y maquillaje (70 prendas), poses, estudio, pasarela y jueces | `datos/prendas.json`, `src/escena/*.js`, `kit/3d/*.js` | Hechos para Noli (formas de Three.js descritas en JSON) | Este repo | La del repo | 2026-10-08 |
| Tiara de estrellas | `modelos/tiara.glb` | Hecha para Noli con `herramientas/blender/tiara.py` (Blender 5.2.2) | Este repo | La del repo. Lo que se modela con Blender es de quien lo hace (la licencia GPL de Blender no aplica a los archivos que exporta) | 2026-10-08 |
| Íconos (temas, categorías, moneda, estrellas…) | `src/ui/iconos.js`, `icono.svg` | Hechos para Noli (SVG) | Este repo | La del repo | 2026-10-08 |
| Muñeca 2D y miniaturas | `src/ui/dibujo2d.js` | Hechos para Noli (SVG) | Este repo | La del repo | 2026-10-08 |
| Fuentes Fredoka y Nunito | (se cargan de Google Fonts, no están en el repo) | Milena Brandão / Hafontia (Fredoka), Vernon Adams y otros (Nunito) | fonts.google.com | SIL Open Font License 1.1 | 2026-10-08 |
| Voz en inglés | (la del navegador, `speechSynthesis`) | El sistema del aparato | — | No se distribuye nada | — |

No se usa nada de Roblox ni de *Dress to Impress*: ni nombre, ni logos, ni personajes, ni arte. Los jueces (Estela, Colorina y Don Detalle) son personajes originales.

## Antes de agregar algo de fuera

| Fuente | ¿Se puede? | Por qué |
|---|---|---|
| [Kenney](https://kenney.nl/assets) | Sí | CC0 (dominio público). Anotar el paquete y la fecha aquí. |
| [Quaternius](https://quaternius.com) | Sí | CC0. Igual: anotar paquete y fecha. |
| [Poly Pizza](https://poly.pizza) | Revisar cada modelo | Hay CC0 y CC-BY; con CC-BY hay que poner el crédito aquí **y** en el juego. |
| Mixamo (animaciones) | **No** en este repo | Sus términos dejan usarlas dentro de un juego, pero no redistribuir los archivos sueltos, y un repo público los deja descargables. |
| VRoid Studio | Revisar | Los modelos que haces son tuyos, pero las texturas y piezas que trae el programa tienen sus propias condiciones; leerlas antes de exportar. |
| Cualquier cosa de Roblox | **No** | Marca y arte de otros. |
| Un modelo "gratis" sin licencia escrita | **No** | Sin licencia no hay permiso. |

Cómo agregar el renglón: qué es, la ruta del archivo, quién lo hizo, de dónde salió (URL exacta), la licencia y la fecha en que se descargó. Si la licencia pide crédito (CC-BY), agregarlo también en la pantalla de inicio del juego.
