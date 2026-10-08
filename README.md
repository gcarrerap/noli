# Noli

Juegos educativos para Noelia (7 años), en el navegador. Se juegan en el **teléfono o la tableta** con el dedo, o en la **smart TV** con el control de la tele (y, en la siguiente fase, usando un teléfono como control remoto).

La página principal es un **catálogo**: cada juego es una tarjeta, y cada juego vive en su propia carpeta dentro de `minijuegos/`. Está hecho con HTML, CSS y JavaScript en módulos, sin dependencias ni paso de compilación, con la misma filosofía que [Dominó de la Familia](https://github.com/gcarrerap/myDomino) y [La Pata de la Familia](https://github.com/gcarrerap/myPata). El diseño completo está en [DESIGN.md](DESIGN.md).

## Juegos

| Juego | Materia | Edades | Issue |
|---|---|---|---|
| Sumas y restas (`sumas-restas`) | Matemáticas | 6–8 | #4: 12 niveles (de sumas hasta 10 a restas pidiendo prestado hasta 100), sube de nivel al dominar, reto del día con racha, progreso para Noelia y para papás |
| Spelling (`spelling`) | Inglés | 6–11 | #8: dice la palabra en inglés y la usa en una frase si se le pide; 16 listas (de *cat* a *necessary*), cada una en tres etapas: escoger la bien escrita, armarla con letras y escribirla; reto del día (spelling bee, detective, contrarreloj) con racha; funciona sin voz en las TVs |
| Cuenta y toca (`ejemplo`) | Matemáticas | 4–7 | #1: ejemplo del contrato y plantilla para juegos nuevos |

Cada juego nuevo se agrega con su propio issue.

## Cómo jugarlo

### En el teléfono o la tableta

Abre la página y toca un juego. La casita 🏠 regresa al catálogo. Las estrellas de cada juego (la mejor partida) se guardan en el dispositivo.

### En la TV

Pensado para LG (webOS) y Samsung (Tizen). Abre en el navegador de la TV la misma dirección con `?modo=tv` al final (por ejemplo `https://gcarrerap.github.io/noli/?modo=tv`). Todo se ve más grande y se juega con las **flechas y OK** del control de la tele; **Atrás** regresa al catálogo.

**Teléfono como control remoto:** en camino (ver [DESIGN.md §5](DESIGN.md#fase-2-el-teléfono-como-control-remoto-issue-aparte)). La TV mostrará un código y un QR; el teléfono lo abre y queda como control.

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

## Progreso en la nube

El progreso (niveles, rachas, estrellas) se puede compartir entre la TV y el teléfono. Toca la **nube** arriba a la derecha del catálogo:

1. **En el primer dispositivo** (el que ya tiene el progreso, por ejemplo el teléfono): **Es el primero: guardar en la nube**.
2. **En cada dispositivo nuevo** (la TV): **Ya lo tengo en otro dispositivo: vincular**. La TV enseña un código de 6 números.
3. **En el teléfono**: nube → escribe ese código → **Vincular**. Listo: los dos tienen el mismo progreso y se actualizan solos.

Sin internet se sigue jugando; lo nuevo se sube al regresar la conexión.

### Firebase

Usa el proyecto `dominomx`, el mismo del dominó y la pata, con colecciones `noli_` (`src/config.js`). **Antes de usar la nube hay que publicar las reglas:** copia [`firestore.rules`](firestore.rules) completo en **Firebase → Firestore → Reglas** y publícalas. Trae también los bloques de La Pata y el dominó (Firestore tiene un solo archivo de reglas por proyecto y publicar reemplaza todo), así que esas apps siguen funcionando igual. **Ojo:** si después se publican las reglas de myPata o myDomino, se borran las de Noli; hay que mantener los tres bloques juntos. El dominio `gcarrerap.github.io` ya está autorizado por el dominó.

## Agregar un juego

1. Abre un issue para el juego.
2. Copia `minijuegos/ejemplo/` a `minijuegos/<id>/` y edita su `juego.json`:
   ```json
   { "id": "sumas", "titulo": "Sumas con manzanas", "icono": "🍎", "color": "#3ccf8e",
     "materia": "números", "edades": [5, 7], "controles": ["tactil", "flechas"] }
   ```
3. En el código del juego usa el kit para jugar con flechas/OK y avisar cuando termina:
   ```js
   import { Noli } from "../../kit/noli.js";
   Noli.alEntrar((accion) => { /* arriba, abajo, izquierda, derecha, ok, atras */ });
   const datos = await Noli.datos;   // su progreso guardado (o null)
   Noli.guardar(datos);              // el catálogo lo guarda
   Noli.terminar({ estrellas: 3 });
   ```
   Nada de emojis para lo que importa visualmente: en la TV LG salen en blanco y negro (#5). Usa SVG.
4. Agrega el id a `minijuegos/catalogo.json` (el orden ahí es el orden del catálogo).
5. Corre `npm test`, cambia `src/version.js` y abre el PR.

Cada juego es autocontenido (sus propios estilos, rutas relativas), así que más adelante puede vivir en su propio repo y montarse aquí como **submódulo de git** sin tocar el catálogo (ver [DESIGN.md §6](DESIGN.md#6-juegos-como-submódulos)).

## Arquitectura

```
ui/  →  app/  →  engine/          kit/  (protocolo, teclas, SDK de los juegos)
          ↘ services/ (archivos del sitio, localStorage)
```

- **`engine/`** valida manifiestos, filtra por materia y mueve el foco con flechas (funciones puras).
- **`services/`** lee `minijuegos/catalogo.json` y cada `juego.json`, guarda preferencias y habla con Firebase.
- **`app/`** guarda el estado y lo cambia con acciones; toda la entrada pasa por `actions.entrada(accion)`.
- **`ui/`** dibuja el catálogo y abre cada juego en un iframe, con un puente de mensajes.
- **`kit/`** lo comparten catálogo y juegos.

```
noli/
├── index.html          # catálogo (esqueleto: estilos y src/main.js)
├── sw.js               # service worker: siempre la versión más reciente
├── firestore.rules     # reglas del proyecto dominomx (Noli, La Pata y el dominó)
├── kit/                # protocolo.js, teclas.js, foco.js (flechas entre botones), noli.js (SDK de los juegos)
├── minijuegos/
│   ├── catalogo.json   # registro de juegos, en orden
│   ├── spelling/       # juego.json, index.html, estilo.css, icono.svg, src/ (listas, faltas típicas, progreso, reto, voz), tests/
│   ├── sumas-restas/   # juego.json, index.html, estilo.css, icono.svg, src/ (lógica pura + pantallas), tests/
│   └── ejemplo/        # un juego mínimo: juego.json, index.html, juego.js, estilo.css
├── src/
│   ├── main.js, version.js
│   ├── engine/         # manifiesto.js, catalogo.js
│   ├── services/       # catalogo-repo.js, prefs.js, updates.js
│   ├── app/            # store.js, actions.js, updates.js
│   └── ui/             # render.js, entrada.js, labels.js, screens/, components/
├── styles/             # tokens (colores, tema, escala TV), base, catálogo
├── tests/              # node:test, sin dependencias
├── package.json        # solo para correr las pruebas
├── DESIGN.md
└── README.md
```

### Pruebas

Corren con Node 18 o más nuevo, sin instalar nada:

```bash
npm test
```

Cubren: validación de manifiestos, navegación con flechas en la cuadrícula, el protocolo y las teclas de las TVs, la carga del registro (un juego roto no tumba a los demás), las acciones de la app (abrir, reenviar la entrada al juego, guardar estrellas, regresar), el service worker, y que **cada juego registrado tenga carpeta, manifiesto válido y página de entrada**. Cada juego trae sus propias pruebas en su carpeta (`minijuegos/<id>/tests/`) y `npm test` las corre todas.

## Stack

- HTML, CSS y JavaScript (módulos ES nativos), sin frameworks ni compilación
- Tipografías: Fredoka y Nunito (Google Fonts)
- Firebase 10.12 (SDK compat del CDN, solo si la nube está activada): Authentication anónima y Cloud Firestore (proyecto `dominomx`, colecciones `noli_`)
- Fase 2: WebRTC del navegador para el control remoto, con señalización en Firebase
