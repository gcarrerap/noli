# Decisiones (ADR)

Cada decisión: contexto, opciones, qué se decidió y qué consecuencias tiene. Si una cambia, se agrega una nueva que la reemplace (no se borra la vieja).

## ADR 1 — Three.js y no Babylon.js

**Contexto.** Primer juego 3D de Noli. Tiene que correr sin compilación (módulos ES servidos tal cual), en navegadores de TV y en teléfonos, y quedarse dentro de la carpeta del juego.

**Opciones.** *Three.js*: un archivo módulo de 670 KB, sin dependencias, la comunidad y los ejemplos más grandes; cargador glTF aparte. *Babylon.js*: más completo (física, editor), pero más pesado (varios MB) y pensado para usarse con empaquetador. *Canvas 2D o CSS 3D*: ligero, pero no da un estudio para caminar.

**Decisión.** Three.js **r160.1**, copiado en `vendor/` (desde #25 vive en `kit/3d/vendor/`, compartido con el mundo del menú principal; sin CDN en tiempo de ejecución, DESIGN §1). r160 porque: el `.min.js` usa JavaScript de 2018 (lo revisamos con un analizador: no usa `?.`, `??` ni campos de clase), y todavía funciona con **WebGL 1** (r163 lo quitó), que es lo que pueden tener las TVs más viejas.

**Consecuencias.** 167 KB comprimidos de descarga la primera vez (después, del service worker). Para actualizar: cambiar los tres archivos de `kit/3d/vendor/` y su renglón en LICENCIAS.md, y revisar que siga siendo ES2018 y WebGL 1.

## ADR 2 — Personaje de partes y ropa de formas, en lugar de un modelo con esqueleto (*skinned mesh*)

**Contexto.** El issue proponía un avatar glTF con esqueleto y cada prenda pesada al mismo esqueleto, con animaciones de Mixamo. Eso pide: modelar el cuerpo y cada prenda en Blender, pesar cada prenda (el paso más difícil para quien empieza), y licencias de terceros para el modelo y las animaciones.

**Opciones.** *Esqueleto + prendas pesadas* (lo del issue). *Personaje de partes* (cada parte del cuerpo es un grupo que gira; la ropa se pega a la parte) con ropa descrita como **formas en JSON**. *Mixto*: partes + `.glb` para lo que no sale con formas.

**Decisión.** Mixto, con formas como camino principal: el personaje se arma con código (`avatar.js`), la ropa son piezas (`tubo`, `esfera`, `caja`…) en `prendas.json`, y una prenda puede traer un `.glb` hecho en Blender pegado a un ancla (`modelos.js`; ejemplo: la tiara). Estilo "muñeco de partes" (como los avatares de Roblox), que a 7 años se reconoce y gusta.

**Por qué.** (1) Agregar ropa no pide ningún programa ni pesar vértices: se escribe en JSON y se ve en el probador; Noelia puede diseñar y el papá meterlo en minutos. (2) Todo es original: no hay licencias que revisar. (3) Pesa casi nada (todo el clóset son 40 KB de JSON) y las geometrías se comparten. (4) Se prueba en Node (cada prenda se arma en la prueba). (5) Blender sigue disponible para piezas especiales, sin esqueleto.

**Consecuencias.** La ropa no se "dobla" con el cuerpo: una falda es un cono que no sigue a las piernas, las mangas son tubos por segmento. Para el estilo caricatura se ve bien (es como funcionan los avatares de bloques). Las animaciones son código (`posturas()`), no `AnimationMixer`: menos realistas, pero suaves, baratas y fáciles de cambiar. Si algún día se quiere ropa que se doble, se puede agregar un avatar con esqueleto como otra vista sin tocar la lógica.

## ADR 3 — Origen del arte: todo original

**Contexto.** El repo es público; Mixamo no deja redistribuir sus archivos sueltos; VRoid trae piezas con sus propias condiciones.

**Decisión.** Todo hecho para Noli (formas, SVG, el script de la tiara). Fuentes externas solo CC0 (Kenney, Quaternius) y siempre con su renglón en LICENCIAS.md.

**Consecuencias.** Cero riesgo de licencias; el estilo es sencillo y consistente.

## ADR 4 — Calificación local de tres jueces, no votación de la familia (por ahora)

**Contexto.** En el juego original votan otros jugadores. Aquí se juega sola casi siempre.

**Opciones.** *Votación familiar* con varios teléfonos (necesita salas y señalización, como el control remoto #3). *Jueces del juego* con reglas claras.

**Decisión.** Tres jueces con fórmulas deterministas (`puntuacion.js`), cada uno con su personalidad (tema, colores, detalles), siempre con un comentario positivo y un consejo concreto. La votación familiar queda para un issue aparte (usaría la infraestructura de #3).

**Consecuencias.** Se puede jugar sin nadie más y sin internet; Noelia aprende qué funciona porque el mismo atuendo da lo mismo. Los consejos solo sugieren ropa que ya tiene.

## ADR 5 — Modo sencillo en 2D (SVG) y no imágenes pre-renderizadas

**Contexto.** El issue pedía un respaldo 2D "con imágenes de la muñeca renderizadas de antemano".

**Opciones.** *Pre-renderizar* cada prenda en cada color (54 prendas × hasta 10 colores = cientos de imágenes que hay que regenerar con cada cambio). *Dibujar en SVG* con una figura por prenda, coloreada en el momento.

**Decisión.** SVG (`dibujo2d.js`): una figura por prenda (`dibujo2d` en el JSON), coloreada al dibujar. Las mismas figuras sirven de miniaturas en el panel y de fotos en el clóset.

**Consecuencias.** Cero imágenes que regenerar; agregar una prenda pide también su figura 2D (lo revisa la prueba).

## ADR 6 — Controles: cámara fija, joystick y flechas relativas a la pantalla, "Ir a…"

**Contexto.** Tiene 7 años; la TV se juega con flechas a 3 m; el issue pide no marear.

**Opciones.** Cámara que gira detrás del personaje con controles "tanque" (arriba = avanzar hacia donde mira). Cámara fija con controles relativos a la pantalla.

**Decisión.** La cámara **nunca gira**; arriba en el joystick o en las flechas siempre es "hacia el fondo". En el teléfono: joystick que aparece donde se pone el pulgar **y** tocar el piso o un letrero (camina sola). En la TV: flechas (con impulso, para el teléfono-control que no manda `keyup`) **y** OK lejos de un mueble abre "¿A dónde vamos?" y camina sola. Los muebles están en las orillas y el centro está libre, así la ruta automática (centro → mueble) nunca se atora.

**Consecuencias.** Nada marea; ir a un mueble en la TV son 3 botones. A cambio, no se puede "ver alrededor" (no hace falta en un estudio).

## ADR 7 — Créditos en el catálogo; preferencia 3D/2D en el aparato

**Contexto.** Los créditos los ganan otros juegos. DESIGN dice que los juegos no escriben `localStorage`.

**Decisión.** Créditos: solo el catálogo (#20, DESIGN §12); el juego pide con `Noli.gastar` y nunca lleva la cuenta. Se cobra al empezar y no se devuelve al salir (más fácil de entender y de programar sin errores). La preferencia "modo sencillo" sí la guarda el juego en `localStorage["noli.pasarela.vista"]`, porque es **de ese aparato** (la TV puede ir lenta y el teléfono no) y no debe sincronizarse como el progreso.

**Consecuencias.** Única excepción a la regla de `localStorage`, documentada aquí y en ARQUITECTURA.md.

## ADR 8 — Cada pasarela empieza con la ropa de base

**Contexto.** Empezar con el último atuendo deja ir directo a la pasarela sin vestirse.

**Decisión.** Al empezar una pasarela con tema, la ropa vuelve a la de base (malla lila) y solo se queda el peinado. El probador libre sí empieza con el último atuendo.

**Consecuencias.** Hay que vestirse cada vez (es el juego); el peinado favorito no se pierde.

## ADR 9 — Curva de desbloqueo (reemplazada por ADR 10)

**Decisión.** 8 niveles (0, 8, 20, 35, 55, 80, 110, 145 puntos), con algo nuevo en la primera pasarela siempre y saltos que crecen. Revisada con `herramientas/simular-curva.mjs` ([JUEGO.md](JUEGO.md#la-curva)).

**Consecuencias.** Todo el clóset se abre en 11–18 pasarelas (≈ 40 créditos). Después los puntos siguen sumando ("¡Ya tienes todo el clóset!"); un issue futuro puede agregar más niveles y ropa.

## ADR 10 — Menos cosas por nivel y niveles más espaciados (#26)

**Contexto.** Al jugarla, Noelia ganaba demasiada ropa en cada pasarela: el ADR 9 abría hasta 11 prendas por nivel y todo el clóset en 11–18 pasarelas. La ropa nueva dejaba de sentirse como premio.

**Decisión.** 30 niveles que abren **de 1 a 3 cosas** cada uno (prendas, colores, temas o poses), con saltos que crecen: `round(14 + 1.5 × nivel)` puntos (16, 17, 18, 20…). El primer nivel llega en la segunda pasarela aun vistiéndose al azar. Todo se abre en ≈ 77 pasarelas con cuidado, ≈ 97 a medias y ≈ 131 al azar (`herramientas/simular-curva.mjs`).

**Consecuencias.** Abrir todo cuesta ≈ 290 créditos jugando "a medias": semanas de practicar. La prueba revisa que cada nivel abra de 1 a 3 cosas y que los saltos no se achiquen. Se ajusta moviendo los `puntos` en `desbloqueos.json`.

## ADR 11 — Maquillaje y joyería como "lugares", no como ranuras nuevas

**Contexto.** Se pidió maquillaje (rubor, labial, sombra, pestañas, pecas, brillitos, caritas pintadas) y más accesorios (aretes, collares, relojes, pulseras).

**Opciones.** Una ranura nueva por cosa en el atuendo (`atuendo.labios`, `atuendo.orejas`…), o el mecanismo de los accesorios: **uno por lugar**.

**Decisión.** Una categoría nueva, `maquillaje`. El maquillaje y los accesorios usan el mismo mecanismo de lugares (`config.lugares`: orejas, cuello, muñeca, mejillas, ojos, labios, pintura…) y se guardan juntos en `accesorios[lugar]`. Hay dos muebles nuevos en el estudio (tocador de maquillaje y joyería), y la propiedad `lugares` de una zona reparte los accesorios entre la vitrina y la joyería. Para los jueces cuentan como detalles.

**Consecuencias.** El formato guardado no cambió (`v: 1`): los atuendos viejos siguen sirviendo. Un lugar nuevo es una línea en `config.json` más un mueble que lo ofrezca.

## ADR 12 — La cámara enfoca lo que se prueba, con la imagen corrida

**Contexto.** Al probarse zapatos, el panel tapaba los pies; en el teléfono el panel ocupa la mitad de abajo.

**Opciones.** Achicar el panel (menos prendas a la vista), mover al personaje, o mover la cámara: acercarla a la parte del cuerpo que importa y **correr la imagen** para que esa parte quede en lo que se ve.

**Decisión.** Cada zona dice su `enfoque` (cara, cabeza, alto, torso, cuerpo, piernas, pies). La cámara calcula la distancia para que esa parte quepa en lo libre y usa `camera.setViewOffset` para correr la imagen sin girar la cámara (no se deforma). El personaje se puede girar a mano.

**Consecuencias.** Lo que se prueba siempre se ve, en el teléfono y en la TV, sin achicar el panel. Una zona nueva solo escoge su `enfoque`.

## ADR 13 — Poses escogidas por Noelia, varias seguidas

**Contexto.** Antes la pose final era una al azar. Se pidió poder escoger poses o bailes.

**Decisión.** Al llegar al final de la pasarela aparece "¡Escoge tu pose!" con las abiertas (`datos/poses.json`). Puede hacer varias seguidas; "¡Listo!" o 25 s sin escoger terminan. Las poses **no cambian la calificación**: son para lucirse, y no castigan a quien no sabe cuál escoger. Empieza con 3 y las demás se abren con los niveles.

**Consecuencias.** El desfile dura lo que ella quiera. En la TV se escoge con flechas y OK.
