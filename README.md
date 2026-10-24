# Noli

Juegos educativos para Noelia (7 años), en el navegador. Se juegan en el **teléfono o la tableta** con el dedo, o en la **smart TV** con el control de la tele o usando un **teléfono como control remoto**.

La página principal es un **mundo mágico en 3D** (#25): Noelia camina y brinca con su personaje por un bosque encantado y entra a cada juego por la puerta de su edificio (un castillo de números, el árbol de las letras, una tiendita, una fábrica…). Si el aparato no puede con el 3D, es un **catálogo** de tarjetas, el de siempre. Cada juego vive en su propia carpeta dentro de `minijuegos/`. Está hecho con HTML, CSS y JavaScript en módulos, sin dependencias ni paso de compilación, con la misma filosofía que [Dominó de la Familia](https://github.com/gcarrerap/myDomino) y [La Pata de la Familia](https://github.com/gcarrerap/myPata). El diseño completo está en [DESIGN.md](DESIGN.md).

## Juegos

| Juego | Materia | Edades | Issue |
|---|---|---|---|
| Sumas y restas (`sumas-restas`) | Matemáticas | 6–8 | #4: 12 niveles (de sumas hasta 10 a restas pidiendo prestado hasta 100), sube de nivel al dominar, reto del día con racha, progreso para Noelia y para papás |
| Fábrica de Números (`fabrica-numeros`) | Matemáticas | 7–9 | #28: arma pedidos hasta 1000 con placas, barras y cubitos; 8 niveles (ceros, palabras, comparar, contar de 10 en 10, sumar y restar reagrupando); sube con 8 de los últimos 10; reto del día con racha y adornos para la fábrica |
| Huerto en Filas (`huerto`) | Matemáticas | 6–9 | #32: planta con «Filas» y «En cada fila», cosecha en una recta (de 2, de 5 y de 10, y saltando desde cualquier número), pares y nones, y arreglos como sumas repetidas; sube con 8 de los últimos 10; reto del día «Huerto grande» |
| El Reloj del Dragón (`reloj-dragon`) | Matemáticas | 6–9 | #29: pone y lee la hora del día del dragón (en punto, y media, y cuarto, menos cuarto, de 5 en 5), mañana, tarde y noche, y cuánto falta eligiendo un cuarto, media hora o 1 hora; turnos de 6; sube con 8 de los últimos 10; reto Reloj misterioso |
| Pizzería Partida (`pizzeria`) | Matemáticas | 6–9 | #31: corta en partes iguales, elige la galleta por lados o esquinas, decora fracciones y llena la bandeja de brownies; 7 niveles; sube con 8 de los últimos 10; reto del día (pizza gigante: 8 pedidos, 5 bien) y adornos en orden fijo |
| Puentes para el Bosque (`puentes`) | Matemáticas | 6–9 | #30: mide huecos en centímetros y pulgadas, estima con una referencia a la vista y compara largos; 7 niveles; sube con 8 de los últimos 10; reto del día (Ojo de águila o Puente largo) sin reloj |
| Safari de Datos (`safari-datos`) | Matemáticas | 6–9 | #33: cuenta los animales de cada recinto (con «Quietos»), arma la gráfica de dibujos o de barras con + y − y contesta 3 preguntas del cuidador leyéndola (cuántos hay, quién necesita más comida, cuántos más o menos, el total); 6 niveles (dibujos, barras, comparar, total, de 2 en 2, Detective que arregla la gráfica); sube con 8 de las últimas 10 preguntas; cada visita con 2 o 3 estrellas abre un animal; reto del día Censo o Detective, sin reloj |
| La Tienda de Noli (`tienda`) | Matemáticas | 6–9 | #27: atiende la tienda, cuenta monedas y billetes, da el cambio y hace crecer el local. Dólares (por omisión) y pesos mexicanos, a elegir en el juego. 7 niveles, reto del día con racha |
| Spelling (`spelling`) | Inglés | 6–11 | #8, #13, #15: dictado: dice la palabra en inglés con grabaciones que suenan en cualquier navegador (nunca la enseña) y la usa en una frase si se le pide; prueba de nivel al empezar; 16 listas (de *cat* a *necessary*), se pasa con 18 de 20; práctica opcional (escoger la bien escrita, armarla con letras); reto del día (spelling bee, detective, contrarreloj) con racha; sección **Sonidos de CH** (los 3 sonidos de *ch*: *chips*, *school*, *chef*) con banco de 133 palabras en 5 niveles (empieza fácil y sube) |
| Robot de Palabras (`robot-palabras`) | Inglés | 7–10 | #36: clasifica palabras en inglés (pieza, moverse, cómo es), plurales y pasado; cada palabra se oye; la banda espera; 7 niveles (el 1 sube con 9 de 10); reto Puerta secreta (6 puertas, 4 a la primera) |
| Misión Luna (`mision-luna`) | Inglés | 7–10 | #35: astronauta que lee: 3 textos cortos en inglés llenan los tanques del cohete (idea principal y datos; Escuchar con voz grabada y botón Español), en el viaje empareja palabras espaciales con su dibujo (las que falla regresan) y en la Luna acomoda las fases en el calendario o adivina cómo se verá; 6 misiones (la Luna, cráteres, día y noche, fases, gravedad, astronautas), la siguiente se abre con 2 estrellas; museo espacial de rocas y fotos; reto del día con la fase real de la Luna o Palabra espacial |
| Biblioteca (`biblioteca`) | Inglés | 6–10 | #104: cuentos en inglés con voz grabada y la palabra que suena iluminada; Léemelo (narra y pasa de página sola) o Yo leo (tocar una palabra la dice); Despacio. Primer libro: *Mari and the Pumpkin Spaceship* (#96), 12 capítulos de Halloween, unas 3 horas de lectura |
| Pasarela (`pasarela`) | Inglés (premio) | 6–11 | #19: juego de vestir en 3D: camina por un estudio hasta los percheros, vístete según el tema en 2:30, desfila y tres jueces te califican con un consejo; cada prenda y color en inglés; cuesta 3 créditos; maquillaje y joyería; al final escoge poses y bailes; los puntos de estilo abren poco a poco ropa, colores, temas y poses (30 niveles, de 1 a 3 cosas cada uno); la cámara enfoca lo que se prueba y se puede girar al personaje; modo sencillo 2D si el aparato no puede con el 3D. Documentación en [minijuegos/pasarela/docs](minijuegos/pasarela/docs/README.md) |
| Mi Casita (`mi-casita`) | Matemáticas (premio) | 6–11 | #37: paga el mueble con las monedas exactas y lo acomoda en la cuadrícula. Cada visita cuesta 3 créditos y trae una bolsa fija (la de La Tienda: dólares o pesos). Si sale, ese día no se vuelve a cobrar. «Solo mirar» es gratis |
| Cajas Sorpresa (`cajas-sorpresa`) | Premio | 6–11 | #59: con 5 créditos abre una caja sorpresa que trae un Brumito de una colección de 24 (comunes, raras y ultra raras). Máximo 2 cajas al día; los repetidos se vuelven polvo de estrellas para escoger el que falta. Sin dinero real |
| Cuenta y toca (`ejemplo`) | Matemáticas | 4–7 | #1: ejemplo del contrato y plantilla para juegos nuevos |

Cada juego nuevo se agrega con su propio issue.

### Juegos y TV

**La TV no limita el diseño (#57).** Un juego puede usar lo que la TV no tiene (cámara, sensores de movimiento, arrastrar, multitouch, voz, mucho poder gráfico…): se diseña para teléfono, tableta o computadora y, si no se puede jugar con el control, **no aparece en modo TV**. Si solo una parte no sirve en la TV (un nivel con cámara, por ejemplo), esa parte se esconde en la TV y el resto se juega igual. Los créditos y el progreso son los mismos: jugar en el teléfono cuenta para todo.

Cada `juego.json` lo dice con `"tv"` (`true` = se juega completo con el control; pide `"remoto"` en `"controles"`) y `"ocultoEnTv"` (lo que se esconde en la TV). La prueba del catálogo falla si un juego no lo declara o si esta tabla no dice lo mismo.

| Juego | Apto para TV | Controles | Oculto en la TV |
|---|---|---|---|
| Sumas y restas (`sumas-restas`) | Sí | tactil, flechas, remoto | — |
| Fábrica de Números (`fabrica-numeros`) | Sí | tactil, flechas, remoto | — |
| Huerto en Filas (`huerto`) | Sí | tactil, flechas, remoto | — |
| El Reloj del Dragón (`reloj-dragon`) | Sí | tactil, flechas, remoto | — |
| Pizzería Partida (`pizzeria`) | Sí | tactil, flechas, remoto | — |
| Puentes para el Bosque (`puentes`) | Sí | tactil, flechas, remoto | — |
| Safari de Datos (`safari-datos`) | Sí | tactil, flechas, remoto | — |
| La Tienda de Noli (`tienda`) | Sí | tactil, flechas, remoto | — |
| Spelling (`spelling`) | Sí | tactil, flechas, remoto | — |
| Robot de Palabras (`robot-palabras`) | Sí | tactil, flechas, remoto | — |
| Misión Luna (`mision-luna`) | Sí | tactil, flechas, remoto | — |
| Biblioteca (`biblioteca`) | Sí | tactil, flechas, remoto | — |
| Pasarela (`pasarela`) | Sí | tactil, flechas, remoto | — |
| Mi Casita (`mi-casita`) | Sí | tactil, flechas, remoto | — |
| Cajas Sorpresa (`cajas-sorpresa`) | Sí | tactil, flechas, remoto | — |
| Cuenta y toca (`ejemplo`) | Sí | tactil, flechas, remoto | — |

## Cómo jugarlo

### En el teléfono o la tableta

Abre la página: es el mundo mágico. Camina con el **joystick** (pulgar izquierdo) o tocando el piso, **brinca** con el botón **Brincar** (pulgar derecho) y, al llegar a la puerta de un juego, toca **Entrar a…** (o toca el letrero del juego). El botón **Menú** abre «¿A dónde vamos?»: escoges un juego y el personaje camina solo hasta su puerta. Arriba de las plataformas (hongos gigantes, piedras flotantes, nubes…) hay **cristales mágicos** para encontrar. La casita 🏠 regresa al mundo, frente a la puerta del juego. Las estrellas de cada juego (la mejor partida) se guardan en el dispositivo.

**Menú sencillo:** el botón **Menú sencillo** (en «¿A dónde vamos?») cambia a la cuadrícula de tarjetas, y **Mundo mágico** (al principio de los filtros) regresa al mundo; el aparato se acuerda de lo que escogiste. Sin WebGL, o si el aparato va muy lento, es la cuadrícula. `?menu2d` y `?menu3d` lo fuerzan para probar. Todo del mundo en [docs/MUNDO.md](docs/MUNDO.md).

### En la TV

Pensado para LG (webOS) y Samsung (Tizen). Abre en el navegador de la TV la misma dirección; Noli reconoce el navegador de la TV y entra en modo TV solo (si no, agrega `?modo=tv` al final, por ejemplo `https://gcarrerap.github.io/noli/?modo=tv`; con `?modo=tactil` se fuerza el modo de teléfono). En modo TV solo salen los juegos aptos para TV ([Juegos y TV](#juegos-y-tv)). Todo se ve más grande y se juega con las **flechas y OK** del control de la tele. En el mundo: las flechas caminan, **OK** brinca (o entra, si estás en la puerta de un juego), el **botón rojo** siempre brinca y **Atrás** abre «¿A dónde vamos?». Dentro de un juego, **Atrás** regresa al mundo. **El mundo 3D ya no tiene soporte de TV (#174):** en la TV el menú es la cuadrícula de tarjetas; el mundo es para el teléfono, la tableta y la computadora.

**Teléfono como control remoto:** en la TV, sube con las flechas hasta **📱 Usar mi teléfono** y aprieta OK. Sale un código de 4 números y un QR: apunta la cámara del teléfono al QR (o abre `https://gcarrerap.github.io/noli/control.html` y escribe el código). El teléfono queda como control: cruceta, OK y Atrás, igual que el de la tele, y **Brincar** para el mundo. Si el teléfono se bloquea o la TV recarga la página, se vuelven a conectar solos con el mismo código. Va directo del teléfono a la TV por WebRTC; si eso no conecta en unos segundos, por Firestore (dice "por internet" en el teléfono).

**Diagnóstico de la TV:** `https://gcarrerap.github.io/noli/diagnostico.html` enseña qué manda cada botón del control y qué tiene el navegador de la TV (módulos, WebRTC, WebGL para la Pasarela…), con un bloque para pegar en el issue #3.

## Publicarlo

### GitHub Pages (recomendado)

1. En el repo, ve a **Settings → Pages**.
2. En *Source*, elige **Deploy from a branch**, rama `main`, carpeta `/ (root)`.
3. En uno o dos minutos estará en `https://gcarrerap.github.io/noli/`.

### Localmente

Sírvelo con cualquier servidor estático (abrirlo con doble clic no funciona: los módulos ES no cargan desde `file://`):

```bash
python3 -m http.server 8000
# abre http://localhost:8000  (o http://localhost:8000/?modo=tv)
```

### Publicar una versión nueva

En cada cambio que se publique (del catálogo o de cualquier juego), **cambia el número en `src/version.js`** (por ejemplo de `2026-10-08.1` a `2026-10-08.2`). Así, quien tenga Noli abierto verá "Hay juegos nuevos · Actualizar".

## Créditos

Los juegos educativos dan **créditos**: 1 por cada estrella y 2 más por el reto del día (hasta 15 por juego al día). Se gastan en juegos de premio, como la Pasarela. El saldo está arriba a la izquierda del catálogo; al tocarlo se ve cómo se ganan, lo ganado hoy y el historial. En **Para papás** (con una multiplicación de por medio) se pueden regalar o quitar créditos. Se sincronizan con la nube sin perder lo ganado o gastado en otro dispositivo sin conexión. Detalles en [DESIGN.md §12](DESIGN.md#12-créditos-20).

## Progreso en la nube

El progreso (niveles, rachas, estrellas) se puede compartir entre la TV y el teléfono. Toca la **nube** arriba a la derecha del catálogo:

1. **En el teléfono**: **Entrar con la cuenta de Google de Noelia**. Su progreso queda ligado a su cuenta: en un teléfono nuevo solo vuelve a entrar con ella. Es una cuenta de Family Link, así que la primera vez puede que haya que aprobar Noli desde Family Link. (Sin cuenta también se puede: **Es el primero: guardar en la nube sin cuenta**.)
2. **En cada dispositivo nuevo** (la TV): **Ya lo tengo en otro dispositivo: vincular con código**. La TV enseña un código de 6 números (escribir una cuenta de Google con el control de la TV es muy incómodo).
3. **En el teléfono**: nube → escribe ese código → **Vincular**. Listo: los dos tienen el mismo progreso y se actualizan solos.

Sin internet se sigue jugando; lo nuevo se sube al regresar la conexión.

### Firebase

Usa su propio proyecto, `gcarrerap-noli` (#112), con colecciones `noli_` (`src/config.js`). Hasta octubre de 2026 compartía `dominomx` con el dominó y la pata.

Para que funcione la nube, el control remoto y `admin.html`, el proyecto necesita:

1. **Authentication → Método de acceso:** activar **Anónimo** (todos) y **Google** (solo `admin.html`).
2. **Authentication → Configuración → Dominios autorizados:** agregar `gcarrerap.github.io`.
3. **Firestore → Reglas:** copiar [`firestore.rules`](firestore.rules) completo y publicarlas (y volver a publicarlas cada vez que cambien). Como el proyecto es solo de Noli, publicar reemplaza todo sin afectar otras apps.

#### Migrar el progreso desde `dominomx` (opcional)

No hace falta: si un dispositivo vinculado no encuentra su perfil en el proyecto nuevo, lo vuelve a crear con el mismo id y sube lo que tiene guardado (#114). La migración solo sirve para traer los nombres de `admin.html` o el progreso de un dispositivo que ya no se usa.

[`scripts/migrar-dominomx.mjs`](scripts/migrar-dominomx.mjs) copia `noli_perfiles` y sus `juegos` con los mismos ids, así cada dispositivo sigue vinculado sin hacer nada. No borra nada de `dominomx`. `noli_vinculos` y `noli_salas` no se copian (duran minutos).

1. En la consola de Firebase de **cada** proyecto: Configuración del proyecto → Cuentas de servicio → **Generar nueva clave privada**. Guarda las dos llaves fuera del repo (por ejemplo en Descargas). Son secretas: nunca las subas a GitHub.
2. En una carpeta con el repo, con Node 18 o más nuevo:
   ```sh
   npm install --no-save firebase-admin
   node scripts/migrar-dominomx.mjs --viejo ~/Downloads/dominomx-xxxx.json --nuevo ~/Downloads/gcarrerap-noli-xxxx.json
   ```
   Primero corre sin cambiar nada y enseña cuántos perfiles y juegos copiaría. Si se ve bien, repite con `--escribir` al final.
3. Borra las dos llaves. Si quieres, en la consola revoca también la clave (Cuentas de servicio → Administrar permisos).

Se puede correr más de una vez: si un juego ya existe en el proyecto nuevo, se queda el más reciente (campo `actualizado`).

## Agregar un juego

1. Abre un issue con la plantilla de juego (`.github/ISSUE_TEMPLATE/juego.md`).
2. Copia `minijuegos/ejemplo/` a `minijuegos/<id>/` y edita su `juego.json`:
   ```json
   { "id": "sumas", "titulo": "Sumas con manzanas", "icono": "🍎", "color": "#3ccf8e",
     "materia": "números", "edades": [5, 7], "controles": ["tactil", "flechas", "remoto"],
     "tv": true, "ocultoEnTv": [] }
   ```
   `"tv"` es obligatorio: `true` si se juega completo con el control (y entonces `"controles"` lleva `"remoto"`), `false` si necesita algo que la TV no tiene; así no sale en modo TV. Si solo una parte no sirve en la TV, va en `"ocultoEnTv"` y el juego la esconde cuando `Noli.modo === "tv"`. Agrega su renglón a la tabla [Juegos y TV](#juegos-y-tv).
3. En el código del juego usa el kit para jugar con flechas/OK y avisar cuando termina:
   ```js
   import { Noli } from "../../kit/noli.js";
   Noli.alEntrar((accion) => { /* arriba, abajo, izquierda, derecha, ok, atras */ });
   const datos = await Noli.datos;   // su progreso guardado (o null)
   Noli.guardar(datos);              // el catálogo lo guarda
   Noli.terminar({ estrellas: 3 });
   ```
   Nada de emojis para lo que importa visualmente: en la TV LG salen en blanco y negro (#5). Usa SVG.
4. Agrega el id a `minijuegos/catalogo.json` (el orden ahí es el orden del catálogo). En el mundo aparece solo, en el siguiente sitio libre, con un portal mágico de su color. Para darle un lugar fijo y un edificio (tiendita, casita, fábrica…), una línea en `mundo/lugares.json` ([docs/MUNDO.md § Cómo agregar…](docs/MUNDO.md#cómo-agregar)).
5. Corre `npm test`, cambia `src/version.js` y abre el PR.

Para juntar el PR hace falta, además:

- Capturas de un teléfono en vertical, angosto, a 360 px y a 412 px de ancho: sin scroll horizontal y con el botón de la acción principal a la vista.
- Si es apto para TV (`"tv": true`): probado en la TV, en horizontal (`?modo=tv`), jugado solo con el control (flechas, OK y Atrás), con captura. Si no (`"tv": false`): captura del catálogo en modo TV donde el juego no aparece.
- Guía la primera vez, o pistas claras en cada paso, para que una niña de 7 años entienda cómo jugar sin ayuda.
- Visto bueno de claridad de Ñoño (diseño del juego). La revisión no pide quitar una mecánica solo porque no funciona con el control: puede proponer un modo TV aparte, pero es opcional.

Cada juego es autocontenido (sus propios estilos, rutas relativas), así que más adelante puede vivir en su propio repo y montarse aquí como **submódulo de git** sin tocar el catálogo (ver [DESIGN.md §6](DESIGN.md#6-juegos-como-submódulos)).

## Arquitectura

```
ui/  →  app/  →  engine/          kit/  (protocolo, teclas, SDK de los juegos)
          ↘ services/ (archivos del sitio, localStorage)
```

- **`engine/`** valida manifiestos, filtra por materia y mueve el foco con flechas (funciones puras).
- **`services/`** lee `minijuegos/catalogo.json` y cada `juego.json`, guarda preferencias y habla con Firebase.
- **`app/`** guarda el estado y lo cambia con acciones; toda la entrada pasa por `actions.entrada(accion)`.
- **`ui/`** dibuja el menú (el mundo 3D o el catálogo 2D) y abre cada juego en un iframe, con un puente de mensajes.
- **`mundo/`** (datos), **`src/mundo/`** (la escena) y **`src/engine/mundo.js`** (lógica pura): el mundo mágico del menú principal ([docs/MUNDO.md](docs/MUNDO.md)).
- **`kit/`** lo comparten catálogo y juegos; **`kit/3d/`**, lo 3D que comparten el mundo y la Pasarela (Three.js, escena, personaje, física).

```
noli/
├── index.html          # catálogo (esqueleto: estilos y src/main.js)
├── control.html        # el teléfono como control remoto (src/control/main.js)
├── diagnostico.html    # qué manda el control de la TV y qué tiene su navegador
├── sw.js               # service worker: siempre la versión más reciente
├── firestore.rules     # reglas del proyecto gcarrerap-noli
├── kit/                # protocolo.js, teclas.js, foco.js (flechas entre botones), noli.js (SDK de los juegos)
│   └── 3d/             # Three.js (vendor/), escena, personaje, formas, materiales, lotes, física, joystick (mundo y Pasarela)
├── mundo/              # mundo.json (plataformas, cristales, decoración) y lugares.json (dónde va cada juego)
├── docs/MUNDO.md       # el mundo mágico del menú principal (#25)
├── minijuegos/
│   ├── catalogo.json   # registro de juegos, en orden
│   ├── spelling/       # juego.json, index.html, estilo.css, icono.svg, src/ (listas, faltas típicas, progreso, prueba de nivel, reto, banco de CH, voz), audio/ (grabaciones), herramientas/grabar.py, tests/
│   ├── sumas-restas/   # juego.json, index.html, estilo.css, icono.svg, src/ (lógica pura + pantallas), tests/
│   ├── tienda/         # juego.json, index.html, estilo.css, icono.svg, datos/ (dólares, pesos, productos, clientes), src/, tests/
│   └── ejemplo/        # un juego mínimo: juego.json, index.html, juego.js, estilo.css
├── src/
│   ├── main.js, version.js, config.js (Firebase)
│   ├── engine/         # manifiesto.js, catalogo.js, sala.js, qr.js, mundo.js (lógica del mundo)
│   ├── mundo/          # escena-mundo.js, edificios.js, vista.js (Three.js; se bajan solo si se usa el mundo)
│   ├── services/       # catalogo-repo.js, prefs.js, updates.js, firebase.js, salas.js
│   ├── app/            # store.js, actions.js, updates.js, enlace.js, remoto.js (TV), telefono.js
│   ├── control/        # main.js: la pantalla del teléfono
│   └── ui/             # render.js, entrada.js, labels.js, screens/ (mundo, catálogo, jugando), components/
├── styles/             # tokens (colores, tema, escala TV), base, catálogo, mundo, remoto, control
├── tests/              # node:test, sin dependencias (fakes/: Firebase y WebRTC de mentira)
├── scripts/            # migrar-dominomx.mjs: copia única del progreso desde dominomx (#112)
├── package.json        # solo para correr las pruebas
├── DESIGN.md
└── README.md
```

### Pruebas

Corren con Node 18 o más nuevo, sin instalar nada:

```bash
npm test
```

Cubren: validación de manifiestos (incluido que cada juego declare si es apto para TV y que cuadre con la tabla [Juegos y TV](#juegos-y-tv)), qué juegos se ven en modo TV y la detección de la TV, navegación con flechas en la cuadrícula, el protocolo y las teclas de las TVs, la carga del registro (un juego roto no tumba a los demás), las acciones de la app (abrir, reenviar la entrada al juego, guardar estrellas, regresar), el service worker, que **cada juego registrado tenga carpeta, manifiesto válido y página de entrada**, y el control remoto: códigos y salas, el QR (comparado con una librería de referencia), y una TV y un teléfono de mentira que se emparejan, mandan acciones, se pasan al respaldo por Firestore y se vuelven a conectar. Y el mundo (`tests/mundo.test.js`): que cada juego tenga lugar, que de la plaza se llegue caminando a todos, la física del brinco, que cada ruta de plataformas se suba brincando de verdad, los cristales, los letreros, la cámara y cuándo usar el menú 2D. Cada juego trae sus propias pruebas en su carpeta (`minijuegos/<id>/tests/`) y `npm test` las corre todas.

## Stack

- HTML, CSS y JavaScript (módulos ES nativos), sin frameworks ni compilación
- Tipografías: Fredoka y Nunito (Google Fonts)
- Firebase 10.12 (SDK compat del CDN, solo si la nube está activada): Authentication anónima y Cloud Firestore (proyecto `gcarrerap-noli`, colecciones `noli_`)
- Control remoto: WebRTC del navegador (`RTCDataChannel`), con señalización y respaldo en Firestore (proyecto `gcarrerap-noli`, colección `noli_salas`, SDK compat del CDN, cargado solo al usarlo); QR generado aquí mismo (`engine/qr.js`)
- 3D (el mundo del menú principal y la Pasarela): Three.js r160.1 copiado en `kit/3d/vendor/` (MIT, WebGL 1, sin CDN), cargado solo cuando se usa
