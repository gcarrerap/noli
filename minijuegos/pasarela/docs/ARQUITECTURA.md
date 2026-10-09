# Arquitectura de la Pasarela

> **Código 3D compartido (#25).** Lo 3D que no es propio de la Pasarela (Three.js, la escena, el personaje, las formas, los materiales, el joystick y el movimiento básico) vive en `kit/3d/`, porque también lo usa el mundo mágico del menú principal (`src/mundo/`, ver `docs/MUNDO.md` en la raíz). La Pasarela lo importa de ahí; sus propios archivos 3D (`src/escena/estudio.js`, `pasarela.js`, `modelos.js`) siguen aquí.

La Pasarela sigue las reglas de Noli (DESIGN.md §1): módulos ES sin compilación, una isla dentro de su carpeta que solo importa `kit/`, lógica pura separada y probada en Node. Lo nuevo es que es el primer juego en 3D (Three.js) y el primero que **gasta créditos** (#20).

## Capas

```
                  ┌──────────────────────────── src/ui/ (navegador) ─────────────────────────────┐
  kit/noli.js ◀── │ juego.js (controlador) ── pantallas.js · iconos.js · dibujo2d.js · voz.js      │
  (catálogo)      │      │                     joystick.js · cargar.js                             │
                  │      ├── vista3d.js ──▶ src/escena/ (Three.js): estudio · pasarela · modelos    │
                  │      │                  └─▶ kit/3d/: escena · avatar · formas · materiales ·    │
                  │      │                      joystick · movimiento ──▶ kit/3d/vendor/ (Three.js) │
                  │      └── vista2d.js ──▶ dibujo2d.js                                             │
                  └──────┬───────────────────────────────────────────────────────────────────────┘
                         ▼
        src/ (lógica pura, sin DOM ni Three.js): datos · atuendo · puntuacion · espanol · progreso · movimiento · partida
                         ▲
                  datos/*.json (lo lee cargar.js en el navegador; las pruebas lo leen con fs)
```

| Capa | Puede importar | No puede |
|---|---|---|
| `src/*.js` (lógica pura) | otros `src/*.js` | DOM, Three.js, `kit/`, `fetch` |
| `src/escena/` | `kit/3d/` (y su `vendor/`), `src/*.js` | DOM fuera de un `<canvas>` o `document.createElement` para texturas; nada de la interfaz |
| `src/ui/` | todo lo anterior y `../../../../kit/` | — |

Así la lógica (puntuación, desbloqueos, choques) se prueba sin navegador, y la escena se puede cambiar (o quitar, en el modo sencillo) sin tocar las reglas.

## Módulos

| Archivo | Responsabilidad |
|---|---|
| `src/datos.js` | `prendasDeZona` (las prendas de un mueble: sus categorías y, si dice `lugares`, solo esas), `revisarDatos` (encuentra errores al editar los JSON a mano: formas, anclas, colores, etiquetas, niveles…) e `indexar` (mapas por id y por categoría, patrones y estampados), `aceptaPatron` y `arteDe` (el arte SVG/PNG que hay que leer aparte). |
| `src/atuendo.js` | El atuendo puesto: `poner` (vestido ↔ arriba/abajo, un accesorio por lugar, tocar dos veces quita), `ponerPatron`/`patronPuesto` (#79), `quitar`, `puestas`, `fraseIngles` (*a pink zebra print T-shirt*), `limpiar` (lo guardado de versiones viejas). |
| `src/puntuacion.js` | `encaje`, `componentes`, `comentar`, `calificar`. Fórmulas en [JUEGO.md](JUEGO.md). |
| `src/espanol.js` | Concordancia: el/la/los/las, un/una, perfecto/perfecta/perfectos. |
| `src/progreso.js` | Puntos de estilo, `nivelDe`, `abiertos`, `registrarPasarela`, lo "nuevo", `escogerTema`, `leerProgreso`. |
| `src/movimiento.js` | `paso` (caminar con deslizamiento en paredes), `choca`, `zonaCercana`, `rutaHacia`/`seguirRuta`, `direccionDeTeclas`. |
| `src/partida.js` | La máquina de estados (`TRANSICIONES`, `siguiente`) y el reloj. |
| `kit/3d/escena.js` | Renderer, cámara, luces, el ciclo de cuadros, medir FPS y bajar la calidad, pausar, liberar memoria. **Compartido** con el mundo del menú principal (#25). |
| `kit/3d/avatar.js` | El personaje de partes, sus anclas, vestir, posturas y animaciones (incluida `brinco`, que usa el mundo). Compartido. |
| `kit/3d/formas.js` | Pieza de `prendas.json` → malla de Three.js (con geometrías compartidas, UV escaladas para los patrones y la forma `calca`) y `reflejar` (espejo). Compartido. |
| `kit/3d/materiales.js` | Materiales caricatura por color (y con textura), compartidos. Compartido. |
| `kit/3d/texturas.js`, `pintar.js` | Patrones y estampados: SVG con marcadores de color → `CanvasTexture` cacheada; `pintar.js` (sin Three.js) cambia los colores y lo usa también el 2D. Ver [ESCENA-3D.md](ESCENA-3D.md#texturas-patrones-y-estampados-texturasjs-79). Compartido. |
| `kit/3d/movimiento.js` | Ángulos, `seguirRuta`, `direccionDeTeclas` (las flechas). `src/movimiento.js` los vuelve a exportar. Compartido. |
| `kit/3d/webgl.js` | `hayWebGL()` sin bajar Three.js. Compartido. |
| `src/escena/estudio.js`, `pasarela.js` | Los dos lugares. |
| `src/escena/modelos.js` | Prendas hechas en Blender (`.glb`): cargar, copiar y pintar. |
| `src/ui/vista3d.js`, `vista2d.js` | Las dos vistas con la misma interfaz (abajo). |
| `src/ui/juego.js` | El controlador: estado, eventos, entrada, guardar, créditos. |
| `src/ui/pantallas.js` | HTML de cada pantalla. No cambia nada. |
| `src/ui/dibujo2d.js` | La muñeca en SVG (modo sencillo, miniaturas, clóset). |
| `kit/3d/joystick.js`, `src/ui/voz.js`, `iconos.js`, `cargar.js` | Joystick táctil (compartido), voz en inglés, íconos SVG, leer los JSON y el arte de `patrones/` y `estampados/`. |

## La partida (máquina de estados)

```
 inicio ──jugar──▶ cobrando ──cobrado──▶ tema ──listo──▶ estudio ──pasarela / tiempo──▶ pasarela ──llego──▶ posando ──fin──▶ calificacion
   │ ▲                 │                                    │                                                │
   │ │           sin-creditos                             salir (pregunta)                                continuar
   │ │                 ▼                                    │                                     ┌──────────┴─────────┐
   │ │              faltan ──libre──▶ libre ──salir──┐      │                              sin-desbloqueo         subió de nivel
   │ └───────────────────────────────────────────────┴──────┘                                     │                    ▼
   │                                                                                               └──────▶ inicio ◀── desbloqueo
   ├──libre──▶ libre
   └──closet──▶ closet ──salir──▶ inicio
```

`partida.js` solo dice el siguiente estado; un evento que no aplica deja el estado igual (un doble toque no rompe nada). `juego.js → ir(estado)` dibuja lo que toca y llama a la vista:

| Estado | Pantalla (capa) | Vista | Qué pasa |
|---|---|---|---|
| `inicio` | tarjeta de inicio (saldo, costo, nivel) | `modo("inicio")`: el personaje de frente | |
| `cobrando` | (la misma) | | `Noli.gastar(costo)`. `ok` → tema al azar (sin repetir el último) y la ropa vuelve a la de base (se queda el peinado). No alcanza → `faltan`. El catálogo no contestó → aviso e `inicio`. |
| `faltan` | cuántos faltan y cómo ganarlos | | "Ir a jugar" = `Noli.salir()`; "Probarme ropa" → `libre`. |
| `tema` | el tema, su frase y el tiempo | | Marca el tema como visto. |
| `estudio` | hud (tema, reloj, mapa, pasarela) | `modo("estudio")`: caminar | Reloj de `config.tiempoEstudio` (150 s); al llegar a 0 → pasarela sola ("¡Se acabó el tiempo!"). |
| `libre` | hud (sin reloj, con salir) | `modo("estudio")` | Igual, sin tema, sin reloj y sin cobrar; la puerta del escenario sale al inicio. |
| `pasarela` | texto "¡Noelia en la pasarela!" | `desfilar()` | Al llegar al final → `posando`. |
| `posando` | "¡Escoge tu pose!" (abajo o a la derecha) | `posar(id)` con cada toque | Varias seguidas; "¡Listo!" o 25 s sin escoger → `terminarDesfile()`, calificar, guardar. Atrás no sale. Las poses abiertas dejan de ser "nuevas". |
| `calificacion` | jueces, consejo, frase en inglés, puntos | | |
| `desbloqueo` | lo que se abrió | | Solo si subió de nivel. |
| `closet` | los últimos atuendos | | "Ponérmelo" → `libre` con ese atuendo. |

**Cobro:** se cobra al empezar (antes del tema). Si sale a la mitad de una pasarela, **no se devuelve** (la pantalla lo pregunta: "Los créditos que usaste no se regresan"). Es lo más sencillo de explicar y evita cobrar y devolver en cada salida accidental.

## Las vistas (3D y 2D)

`juego.js` no sabe cuál vista está usando. Las dos tienen:

| Función | 3D (`vista3d.js`) | 2D (`vista2d.js`) |
|---|---|---|
| `vestir(atuendo)`, `ponerPiel(hex)` | Viste el personaje (carga los `.glb` que falten y vuelve a vestir) | Redibuja la muñeca SVG |
| `modo("inicio" \| "estudio" \| "probador" \| "pasarela")` | Cámara y lugar (estudio de día / pasarela de noche) | Acomodo con CSS |
| `mover({x, z})` | Dirección del joystick o flechas | — |
| `irA(zona)` → promesa | Camina sola (ruta por el centro) y voltea al mueble | Inmediato |
| `irAPunto(x, z)`, `alPiso(px, py)` | Tocar el piso para caminar | — |
| `espejo()` | Da una vuelta frente a la cámara | Gira la muñeca |
| `enfocar(parte)` | Qué parte del cuerpo enseña el probador (`ENFOQUES`, ESCENA-3D.md § Enfocar) | — |
| `girar(grados)` | Gira al personaje en el probador | — |
| `desfilar()` → promesa | Camina la pasarela; se cumple al llegar al final | Animación CSS |
| `posar(id)` | Hace una pose o baile de `datos/poses.json` | Animación CSS de esa pose |
| `terminarDesfile()` → promesa | Los jueces aplauden | Una pausa |
| `letreros()` | Posición en pantalla de cada mueble | vacío |
| `cercana`, `fps`, `info`, `calidad`, `liberar()` | | |
| `botones` | — | `true`: la interfaz pone las zonas como botones |

## Pantalla (capas)

De abajo hacia arriba (`index.html`): `#escena` (lienzo 3D o muñeca 2D) · `#letreros` (íconos que siguen a cada mueble, se recolocan en cada cuadro con `transform`) · `#estudio-ui` (`#hud`, `#zonas2d`, `#aviso`, `#joy`) · `#panel` (ropa) · `#desfile` · `#capa` (pantallas) · `#modal` (preguntas y "Ir a…") · `#toast` · `#fps`.

En pantalla **ancha** (TV, tableta acostada) las tarjetas y el panel van a la derecha y la cámara corre al personaje a la izquierda; en pantalla **alta** (teléfono) van abajo y el personaje sube. La cámara lo calcula en `vista3d.js → camaraObjetivo` con la misma regla que el CSS (`min-aspect-ratio: 23/20`).

## Entrada

Todo pasa por `juego.js → manejar(accion)` (lo que manda el kit) y por clics en `[data-accion]`:

1. **Modal abierto** (pregunta, "Ir a…", modo lento): flechas entre sus botones (`moverFoco`), OK los aprieta, Atrás lo cierra.
2. **Panel de ropa abierto:** flechas entre prendas y colores, OK escoge, Atrás cierra el panel.
3. **Una pantalla** (inicio, tema, calificación…): flechas y OK; Atrás sale del juego solo desde el inicio (devuelve `false` y el kit sale); en el clóset y en "faltan" regresa al inicio.
4. **Desfilando o cobrando:** se ignora (Atrás no sale a la mitad del desfile).
5. **Posando:** flechas y OK entre las poses y "¡Listo!"; Atrás no hace nada.
6. **En el estudio (3D):** flechas = caminar; OK = abrir el mueble cercano o el menú "¿A dónde vamos?"; Atrás = salir (con pregunta si es una pasarela).
7. **En el estudio (2D):** flechas entre los botones de las zonas y del hud.

**Caminar con flechas.** El kit da un `keydown` por cada repetición de la tecla. Cada flecha "empuja" un ratito: 450 ms la primera vez (cubre la espera antes de que el control empiece a repetir) y 200 ms más con cada repetición (`config.movimiento.impulsoTeclaMs`). Con el teclado o el control de la TV además se escucha `keyup` para parar justo al soltar. El teléfono usado como control remoto no manda `keyup`, pero sí repite, así que funciona con el impulso. Dos flechas a la vez = diagonal. La cámara nunca gira: arriba siempre es "hacia el fondo".

**Dedo:** joystick que aparece donde se pone el pulgar (mitad izquierda de abajo), tocar el piso (camina hasta ahí), tocar un letrero (camina y abre). En la TV no hay joystick.

## Guardar

- **Progreso** (puntos, pasarelas, vistos, clóset, piel, último atuendo, último tema): con `Noli.guardar(progreso)` (el catálogo lo guarda en `noli.datos.pasarela` y lo sincroniza). Esquema y versión en [JUEGO.md](JUEGO.md#qué-se-guarda).
- **Créditos:** nunca los guarda el juego. Lee el saldo con `Noli.creditos` al abrir y cobra con `Noli.gastar`; usa el saldo que regresa.
- **Preferencia del aparato** (3D o modo sencillo): `localStorage["noli.pasarela.vista"]`. Es lo único que el juego escribe directo, porque es de ese aparato (la TV puede ir lenta y el teléfono no) y no debe sincronizarse. Ver [DECISIONES.md](DECISIONES.md) (ADR 7).

## Ciclo de vida de la escena

1. `crearEscena`: renderer (antialias solo fuera de la TV), cámara, luces; ciclo con `requestAnimationFrame`.
2. Cada cuadro: `dt` (máximo 50 ms, para que una TV trabada no haga "saltar" al personaje) → mover → animar → cámara → dibujar → medir FPS.
3. **Pausa:** si la página se oculta (`visibilitychange`), no se dibuja. El catálogo destruye el iframe al regresar, así que salir del juego libera todo.
4. **Liberar** (`liberar()`, al cambiar al modo sencillo): `dispose()` de geometrías, materiales y renderer, y se quita el lienzo. Importa en la TV, que tiene poca memoria de video.
5. Solo se dibuja el lugar donde está la cámara: el estudio se oculta durante la pasarela y al revés.
