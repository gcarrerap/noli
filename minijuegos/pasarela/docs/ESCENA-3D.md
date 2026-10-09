# La escena 3D

Lo 3D propio de la Pasarela está en `src/escena/` (estudio, pasarela, modelos .glb); la escena, el personaje, las formas y los materiales están en `kit/3d/` porque también los usa el mundo del menú principal (#25). Todo usa **Three.js r160.1** (`kit/3d/vendor/three.module.min.js`), sin compilación. No hay archivos de modelo para el personaje ni para la ropa: se arman con formas sencillas descritas en `datos/prendas.json`. Solo las prendas que lo piden usan un `.glb` hecho en Blender (`src/escena/modelos.js`).

## Renderer y calidad

| | Teléfono / tableta | TV |
|---|---|---|
| Antialias | sí | no (la TV dibuja a mucha resolución con una GPU modesta; se compensa con píxeles) |
| Calidad inicial | `alta` (`pixelRatio` hasta 2) | `media` (`pixelRatio` 1) |
| Bajar sola | 3 s seguidos a menos de 26 fps → baja un nivel (`alta` → `media` → `baja` = 0.7) | igual |
| Si en `baja` sigue a menos de 15 fps | ofrece el **modo sencillo** (2D) | igual |

`outputColorSpace = SRGB`. Sin sombras reales: el personaje lleva una **sombra redonda** (un círculo semitransparente) que se ve bien y no cuesta. Niebla del color del fondo para que el fondo lejano no se corte de golpe.

**Luces:** `HemisphereLight` (cielo blanco, suelo durazno, 2.1) + `DirectionalLight` (1.6) desde arriba a la derecha.

## Materiales

`materiales.js → material(hex, { brillo, opacidad, dobleCara, emisivo })`, **guardado por combinación**: dos prendas rosas comparten el mismo material (en la TV, cada material distinto es memoria y tiempo de compilar sombreadores).

- Normal: `MeshToonMaterial` con una textura de 3 tonos (sombra 110, medio 190, luz 255) → estilo caricatura.
- `brillo: true` (prendas con `"brillo": true` y las gemas `octaedro`): `MeshPhongMaterial` con reflejo blanco.
- `opacidad < 1`: transparente sin escribir profundidad (tutú, alas).
- `dobleCara`: tubos abiertos (faldas: se ve el interior), esferas cortadas (pelo), planos.

Los focos de la pasarela clonan su material para parpadear cada uno a su tiempo.

## El personaje (`avatar.js`)

Un muñeco **de partes**, como los de Roblox pero redondito: cada parte es un `Group` que gira en su articulación. La ropa se pega a esas partes (anclas) y se mueve con ellas. Mira hacia **+z**.

```
             cabeza ── esfera r 0.21, centro en y 0.19 (desde el ancla); ojos, cachetes, boca, orejas
               │
             cuello ── y 0.40 sobre la cadera
               │
 brazoD ◀── torso ──▶ brazoI         brazos en x ±0.205, y 0.36
   │        (0–0.40)     │           brazo 0.19 → antebrazo 0.17 → mano
 antebrazoD           antebrazoI
   │                     │
 manoD                 manoI
             cadera ── a 0.78 del piso
            ╱      ╲
       musloD      musloI            piernas en x ±0.085
         │            │              muslo 0.34 → pierna 0.30 → pie (caja hasta el piso)
       piernaD      piernaI
         │            │
       pieD         pieI
```

**I = izquierda del personaje = +x** (a la derecha de la pantalla cuando el personaje te mira).

Medidas que usa la ropa (`CUERPO` en `avatar.js`): torso de radio ≈ 0.15 (0.72 de fondo), muslo 0.068, pierna 0.055, brazo 0.045, antebrazo 0.04. Una prenda debe ser **un poco más ancha** que la parte que cubre (+0.012 a +0.02) para no traspasar.

**Ropa de base:** malla de color `config.colorBase` en torso y cadera, para que nunca esté sin ropa.

**Piel:** `ponerPiel(hex)` cambia el material de las mallas de piel (lista que se toma al crear el personaje); los tonos están en `config.tonosPiel`.

### Animaciones

Hechas con código (no hay esqueleto ni `AnimationMixer`): `posturas(modo)` da el ángulo de cada articulación y `animar(modo, dt)` acerca la postura actual a esa poco a poco (`1 − 0.0005^dt`, igual a cualquier FPS), así los cambios se ven suaves. En el ciclo de pasos (muslos, piernas, brazos, rebote) se pone el valor directo para que el paso no se vea lento.

| Modo | Qué hace |
|---|---|
| `quieto` | Brazos un poco abiertos, cabeza que se mueve apenas, respira (torso 1.2 %) |
| `caminar` | Muslos ±0.55 rad, rodillas que se doblan al levantar, brazos opuestos, rebote |
| `desfilar` | Pasos más cortos, cadera y torso que se balancean, cabeza arriba |
| `cintura` · `saludo` · `estrella` | Poses finales de la pasarela (una al azar) |
| `vuelta` | Brazos abiertos mientras gira frente al espejo |

## Las formas de la ropa (`formas.js`)

Cada prenda de `prendas.json` es una lista de **piezas**. Una pieza es una forma pegada a un **ancla** (`"a"`), con medidas en metros en el sistema de esa ancla (origen en la articulación; brazos y piernas bajan por −y).

| Forma (`"f"`) | Campos | Three.js |
|---|---|---|
| `tubo` | `y: [arriba, abajo]`, `r: [radio arriba, radio abajo]`, `z` (fondo ÷ ancho, opcional), `tapa: "arriba" \| "abajo" \| "ambas"` | `CylinderGeometry` abierto + `CircleGeometry` de tapa |
| `esfera` | `r`, `phi: [inicio, largo]` (alrededor, grados), `theta: [inicio, largo]` (desde arriba, grados) | `SphereGeometry` (parcial para pelo y gorros) |
| `caja` | `tam: [ancho, alto, fondo]` | `BoxGeometry` |
| `capsula` | `r`, `largo` | `CapsuleGeometry` |
| `toro` | `r`, `grosor`, `arco` (grados; 180 = medio aro) | `TorusGeometry` (en el plano x-y: usar `rot` `[90,0,0]` para acostarlo) |
| `cono` | `r`, `alto` | `ConeGeometry` |
| `disco` | `r`, `alto` | cilindro plano (alas de sombrero, lentes) |
| `plano` | `tam: [ancho, alto]` | elipse de doble cara (alas de hada) |
| `octaedro` | `r` | gema (siempre con brillo) |
| `anillo` | `radio`, `n`, `pieza` (otra forma sin ancla), `arco: [inicio, largo]`, `desfase` | `n` copias de `pieza` en un círculo horizontal; ángulo 0 = al frente |

Campos de cualquier pieza: `pos: [x, y, z]`, `rot: [x, y, z]` (grados, orden XYZ), `esc: [x, y, z]` (se multiplica), `col` (`"p"` = el color que escoge Noelia, `"s"` = el `secundario` de la prenda, un id de `colores.json` o `#hex`), `opacidad` (0–1), `espejo: true`.

**Espejo:** una pieza con `espejo: true` en un ancla `…I` se copia en la `…D` con x negativa y los giros en y y z al revés (`reflejar`). En un ancla del centro (torso, cabeza…) la copia queda en la misma ancla, del otro lado. Así una manga o un zapato se escribe una vez.

**Geometrías compartidas:** `geo(clave)` guarda cada geometría por sus medidas; las esferas chicas usan menos caras (8 segmentos si r < 0.04, 12 si r < 0.1, 18 si no).

**Orden de dibujo y transparencias:** las piezas transparentes no escriben profundidad; si una se ve "a través" de otra, subir un poco su radio o quitarle opacidad.

## El estudio (`estudio.js`)

Vista de arriba (metros), con la cámara mirando hacia el fondo (−z):

```
 z = −5  ┌─────────────── pared del fondo (estrellas) ───────────────┐
         │ Tocador        Espejo    planta    Puerta (escenario)  Accesorios │
         │ (peinados)                                                      │
 z ≈ −1.7│ planta                                                   planta │
         │ Ropa de                                                Zapatos  │
 z = 0   │ arriba                 ( tapete )                               │
         │                       inicio (0, 1.6)                           │
 z = 3.2 │ Ropa de abajo                                         Vestidos  │
 z = 5   └──────────────────────── (frente abierto) ──────────────────────┘
       x = −6                                                           x = 6
```

Todo sale de `datos/zonas.json`: cada zona tiene su `mueble.caja` (centro x, z, ancho, fondo, alto), el `punto` donde se para el personaje, a dónde `mira` y el `radio` para "acercarse". `movimiento.js` usa **las mismas cajas** para los choques, así lo que se ve y lo que choca nunca se separan. Tipos de mueble: `perchero`, `estante`, `tocador`, `vitrina`, `espejo`, `puerta`, `planta` (los obstáculos solo estorban). El piso es una textura de 64×64 px repetida (losetas). Los **letreros** no son 3D: son botones HTML que se colocan en cada cuadro sobre `marcas` (encima de cada mueble), y se esconden cerca del borde y bajo el hud.

**Moverse** (`movimiento.js`): velocidad 2.6 m/s, giro 150°/s, radio del personaje 0.35 m (`config.movimiento`). Si el paso completo choca prueba solo en x y luego solo en z (se desliza por la pared). "Ir a…" va primero al centro (que está libre) y luego al mueble, porque los muebles están en las orillas.

## Cámara

La cámara **nunca gira** (no marea): sigue al personaje con suavizado (`1 − 0.02^dt`).

| Modo | Dónde |
|---|---|
| Estudio, pantalla ancha | 3.6 m arriba y 5.4 m atrás; mira 0.6 m adelante del personaje |
| Estudio, teléfono parado | 5.2 m arriba, 6.6 m atrás y ángulo de 62° (más ancho), para ver muebles a los lados |
| Inicio y probador (panel abierto) | De frente; con pantalla ancha se corre 0.62 m para que el personaje quede a la izquierda del panel; en el teléfono mira más abajo para que el personaje quede arriba del panel |
| Pasarela | Al final de la pasarela, un poco a la derecha para ver a los jueces |

Al cambiar de lugar (estudio ↔ pasarela) la cámara salta sin viajar.

## La pasarela (`pasarela.js`)

Está en z = −30 (lejos del estudio): pasarela de 7 m con 14 focos que parpadean, telón morado con estrellas y la mesa de los jueces. Los **jueces son personajes** como el de Noelia (`crearAvatar`) con ropa fija del mismo `prendas.json`. El desfile dura 4.4 s (2.2 s con `prefers-reduced-motion`), luego una pose de 2.2 s y los jueces saludan. Fondo y niebla cambian a morado de noche; el estudio se oculta.

## Prendas de Blender (`modelos.js`)

Una prenda con `"modelo": "modelos/x.glb"` y `"ancla"` se carga con `GLTFLoader` (una vez), se copia para cada uso y se pinta: materiales llamados `principal…` toman el color escogido, `secundario…` el secundario; los demás se quedan como vienen. `pos`/`rot`/`esc` de la prenda acomodan el modelo. Si todavía no carga, el personaje se vuelve a vestir al terminar. Cómo hacer uno: [ASSETS.md](ASSETS.md#prendas-con-blender-glb).
