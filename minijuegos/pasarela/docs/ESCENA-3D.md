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
| `vuelta` | Brazos abiertos mientras gira (espejo y la pose "dar una vuelta") |
| Poses de la pasarela | `cintura`, `saludo`, `estrella`, `corazon`, `reverencia`, `beso`, `pensar` (posturas quietas o con un gesto que se repite) |
| Bailes de la pasarela | `baile-brazos`, `baile-lado`, `baile-salto`, `robot`: se mueven con ritmo, así que su postura se pone directo en cada cuadro (sin suavizar, si no pierden el ritmo). `baile-lado` y `baile-salto` también mueven el cuerpo (`cuerpo.x`, `cuerpo.y`) |
| `brinco` | En el aire (el mundo del menú principal) |

`POSES_3D` (en `kit/3d/avatar.js`) lista las poses que sabe hacer el personaje; la prueba revisa que sean las mismas que `datos/poses.json`.

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
| `calca` | `y: [arriba, abajo]`, `r: [arriba, abajo]` (un poco más que la tela), `ancho` (m), `estampado` (id de `estampados.json`), `lado: "frente" \| "espalda"`, `z` | pedazo de `CylinderGeometry` con el estampado (§ Texturas) |

Campos de cualquier pieza: `pos: [x, y, z]`, `rot: [x, y, z]` (grados, orden XYZ), `esc: [x, y, z]` (se multiplica), `col` (`"p"` = el color que escoge Noelia, `"s"` = el `secundario` de la prenda, un id de `colores.json` o `#hex`), `opacidad` (0–1), `espejo: true`.

**Espejo:** una pieza con `espejo: true` en un ancla `…I` se copia en la `…D` con x negativa y los giros en y y z al revés (`reflejar`). En un ancla del centro (torso, cabeza…) la copia queda en la misma ancla, del otro lado. Así una manga o un zapato se escribe una vez.

**Geometrías compartidas:** `geo(clave)` guarda cada geometría por sus medidas; las esferas chicas usan menos caras (8 segmentos si r < 0.04, 12 si r < 0.1, 18 si no).

**Orden de dibujo y transparencias:** las piezas transparentes no escriben profundidad; si una se ve "a través" de otra, subir un poco su radio o quitarle opacidad.

## Texturas: patrones y estampados (`texturas.js`, #79)

La ropa era de un solo color por pieza. Desde #79 una prenda puede llevar un **patrón** (cebra, puntos, cuadros… se repite por toda la tela) y una **calcomanía** (un osito en el pecho).

**De dónde salen.** Cada patrón es un SVG de 64×64 en `patrones/` que empalma por las cuatro orillas; cada estampado, un SVG de 64×64 con fondo transparente en `estampados/` (o un PNG). Los SVG llevan **marcadores de color** que `pintarSVG` (`kit/3d/pintar.js`, sin Three.js para que lo use también el dibujo 2D) cambia antes de dibujar:

| Marcador | Color |
|---|---|
| `{p}` | el que escogió Noelia para la prenda |
| `{s}` | el `secundario` de la prenda |
| `{t}` | tinta: casi negro sobre colores claros, blanco sobre oscuros (`tinta()`, luminosidad > 0.55) |
| `{m}` | la mitad entre `{p}` y `{t}` (sombras, centros de las manchas de leopardo) |
| `{c}` | el color de la calcomanía (si no hay, `{t}`) |

Así una cebra rosa sale rosa con rayas oscuras, y una cebra negra, negra con rayas blancas, con el mismo archivo.

**Cómo se dibujan.** `texturaSVG(svg, { repetir, tam, fondo })` crea un `<canvas>` (128 px para patrones, 256 para estampados), lo llena con el color de fondo (para que no se vea blanco mientras carga), carga el SVG como `data:image/svg+xml` en un `Image` y lo pinta cuando carga (`needsUpdate`). Es una `CanvasTexture` en sRGB; los patrones usan `RepeatWrapping`. **Caché:** por (repetir, tamaño, SVG ya pintado): la misma cebra rosa se dibuja una sola vez aunque la traigan las 4 modelos de la pasarela. `liberarTexturas()` las suelta al salir (`escena.liberar`). `texturaPixeles` es para los dibujos de Noelia (#81): `NearestFilter` y sin *mipmaps*, para que se vean pixelados. Sin `document` (pruebas con Node) todo devuelve `null` y la ropa sale lisa.

**Que la baldosa mida lo mismo en todas las formas.** Cada geometría de Three.js trae coordenadas UV de 0 a 1, pero estiradas a lo que mida la forma: en una manga delgada una baldosa sería chiquita y en una falda, enorme. `formas.js → geoUV` clona la geometría y escala sus UV para que **1 unidad = una baldosa de 12 cm × `escala`** del patrón: un tubo mide π(r₀+r₁) de vuelta por su alto, una esfera parcial 2πr·(φ/360) por πr·(θ/180), una caja max(ancho, fondo) por alto, etc. El patrón solo va en las piezas de color `"p"` (las que escoge Noelia); los detalles de color `"s"` o fijo (botones, suelas) siguen lisos, y una pieza puede decir `"sinPatron": true`. Los octaedros (gemas) nunca.

**Calcomanías.** La forma `calca` es un pedazo de cilindro abierto (10 segmentos) centrado al frente (o atrás con `lado: "espalda"`), del `ancho` pedido (máximo 0.9π de vuelta), un poco por fuera de la tela. Su material lleva la textura con `alphaTest` 0.5 (sin transparencias que ordenar) y `polygonOffset` para que no parpadee contra la tela. Sin textura, la pieza es un grupo vacío.

**Materiales.** `material(hex, { mapa, recorte })`: con `mapa`, el color del material es blanco (la textura ya trae los colores); la caché de materiales incluye el `uuid` de la textura.

**Memoria.** Una textura de 128×128 son 64 KB de video; un atuendo con 4 prendas con patrón distinto, ~260 KB más los estampados (256 KB cada uno). En la pasarela hay 4 modelos, pero se repiten patrones y colores. Ver RENDIMIENTO.md.

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
| Inicio | De frente, el cuerpo entero, en la parte de la pantalla que la tarjeta no tapa |
| Probador (panel abierto) | De frente, **enfocando la parte del cuerpo de la zona** (`zonas.json → enfoque`), en la parte que el panel no tapa (ver abajo). Se puede **girar** al personaje |
| Escogiendo poses | Al final de la pasarela, corrida para que el menú de poses no tape al personaje |
| Pasarela | Al final de la pasarela, un poco a la derecha para ver a los jueces |

Al cambiar de lugar (estudio ↔ pasarela) la cámara salta sin viajar.

### Enfocar lo que se prueba (#26)

Cada zona dice qué parte del cuerpo enseñar (`enfoque` en `zonas.json`). `vista3d.js → ENFOQUES` da, para cada una, la altura del centro y cuánto alto hay que ver (metros):

| Enfoque | Centro (y) | Alto que se ve | Zonas |
|---|---|---|---|
| `cara` | 1.42 | 0.75 | Maquillaje |
| `cabeza` | 1.47 | 0.8 | Peinados |
| `alto` | 1.2 | 1.15 | Joyería (orejas, cuello y muñecas) |
| `torso` | 1.05 | 1.15 | Ropa de arriba |
| `cuerpo` | 0.88 | 1.95 | Vestidos, Accesorios, Espejo |
| `piernas` | 0.5 | 1.15 | Ropa de abajo |
| `pies` | 0.2 | 0.9 | Zapatos |

`tapado()` calcula qué parte de la pantalla queda libre: en el teléfono el panel tapa la mitad de abajo (se ve el 44 % de arriba); en pantalla ancha tapa la derecha (hasta 620 px). La cámara se aleja lo justo para que el alto (y el ancho) de la parte enfocada quepa en lo libre, y la imagen se **corre** con `camara.setViewOffset` (`escena.correr(dx, dy)` en `kit/3d/escena.js`) para que lo enfocado quede en el centro de lo libre, no en el centro de la pantalla. A los pies se les mira un poco desde arriba. El corrimiento se suaviza igual que la cámara.

**Girar:** en el probador el personaje mira a la cámara más el giro que Noelia le dé: arrastrando el dedo o el ratón sobre la escena (0.6° por píxel, sigue al dedo) o con los dos botones curvos del panel (±45°, suavizado; los que sirven en la TV). Al cerrar el panel el giro vuelve a 0.

**Espejo:** la vuelta frente a la cámara dura 1.8 s (0.8 s con `prefers-reduced-motion`); mientras gira se esconden el aviso de abajo, los letreros y el joystick, para que nada tape al personaje.

## La pasarela (`pasarela.js`)

Está en z = −30 (lejos del estudio): pasarela de 7 m con 14 focos que parpadean, telón morado con estrellas y la mesa de los jueces. Los **jueces son personajes** como el de Noelia (`crearAvatar`) con ropa fija del mismo `prendas.json`. El desfile dura 4.4 s (2.2 s con `prefers-reduced-motion`). Al llegar al final, Noelia escoge poses y bailes (`posar(id)`); "dar una vuelta" gira todo el personaje. Al terminar (`terminarDesfile()`), los jueces saludan. Fondo y niebla cambian a morado de noche; el estudio se oculta.

**Las otras modelos (#90).** Dos personajes más (`rivales` en `pasarela.js`, ocultos fuera de la pasarela). `ponerRivales([{ atuendo, piel }])` las viste y las pone atrás, a los lados. `vista3d.rivales(lista)` las hace desfilar una por una: caminan al centro (2.6 s), posan (1.1 s) y se van a su lugar al frente, a los lados (0.7 s); la cámara sigue a la que camina (`sigueZ`). `saltarRivales()` las pone directo en su lugar. Mientras Noelia desfila se quedan quietas; al terminar aplauden con los jueces.

**La malla de base** (`avatar.js`): tronco y hombros son piel si trae algo arriba o vestido; la pelvis, si trae algo abajo o vestido (`ajustarMalla`, también al cambiar la piel). Así la malla morada no se asoma en el cuello de una blusa.

## Prendas de Blender (`modelos.js`)

Una prenda con `"modelo": "modelos/x.glb"` y `"ancla"` se carga con `GLTFLoader` (una vez), se copia para cada uso y se pinta: materiales llamados `principal…` toman el color escogido, `secundario…` el secundario; los demás se quedan como vienen. `pos`/`rot`/`esc` de la prenda acomodan el modelo. Si todavía no carga, el personaje se vuelve a vestir al terminar. Cómo hacer uno: [ASSETS.md](ASSETS.md#prendas-con-blender-glb).
