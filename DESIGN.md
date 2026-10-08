# Diseño de Noli

Noli es un catálogo de minijuegos educativos para Noelia (7 años). Usa la misma filosofía que [myDomino](https://github.com/gcarrerap/myDomino/blob/main/DESIGN.md) y [myPata](https://github.com/gcarrerap/myPata/blob/main/DESIGN.md): módulos ES nativos sin compilación, publicados tal cual en GitHub Pages, lógica pura separada de la interfaz y pruebas con `node:test` sin dependencias. Lo nuevo aquí es que la plataforma no es un juego sino un **catálogo de juegos independientes**, y que se juega en el teléfono **o en la TV con el teléfono de control**.

Issue: #1

## 1. Principios

1. **Sin compilación.** Módulos ES nativos servidos como archivos estáticos (igual que el dominó y la pata).
2. **El catálogo no conoce a los juegos por código.** Los lee de un registro (`minijuegos/catalogo.json`) y de un manifiesto por juego (`juego.json`). Agregar un juego no toca `src/`.
3. **Cada juego es una isla.** Vive en su carpeta, con su HTML, su JS y su CSS, y corre en un `<iframe>`. No importa nada del catálogo salvo el kit (`kit/`). Así cada carpeta puede volverse un submódulo de git sin cambiar nada (§6).
4. **Una sola forma de entrada.** Dedo, teclado, control de la TV y teléfono remoto se convierten en seis acciones: `arriba`, `abajo`, `izquierda`, `derecha`, `ok`, `atras`. Los juegos solo conocen esas seis (además del dedo dentro de su propia página).
5. **Dependencias en una sola dirección:** `ui → app → engine`, con `services` aparte y `kit` como hoja que cualquiera puede usar.
6. **Un solo dueño para el estado** (`app/store.js`); la interfaz lee y pide acciones.

## 2. Capas

| Capa | Puede importar | Responsabilidad |
|---|---|---|
| `kit/` | nada | Lo que comparten catálogo y juegos: protocolo de mensajes, teclas → acciones, y el SDK de los juegos (`noli.js`). |
| `src/engine/` | nada | Lógica pura: validar manifiestos, materias y filtros, moverse en la cuadrícula con flechas. |
| `src/services/` | `engine/` | Lo único que lee la red (registro y manifiestos) y `localStorage`. Service worker y versión publicada. |
| `src/app/` | `engine/`, `services/`, `kit/` | Store y acciones. `actions.entrada(accion)` es el punto único por donde entra el control. |
| `src/ui/` | `app/`, `engine/`, `kit/` | Dibujar el catálogo, el reproductor (iframe) y el puente de mensajes con el juego. |

```
noli/
├── index.html                 # esqueleto: estilos y src/main.js
├── sw.js                      # service worker: siempre la versión más reciente; copia para sin conexión
├── kit/
│   ├── protocolo.js           # mensajes catálogo ↔ juego (§4)
│   ├── teclas.js              # teclas y botones de TV → acciones
│   └── noli.js                # SDK para los juegos: alEntrar, terminar, salir
├── minijuegos/
│   ├── catalogo.json          # registro: { "juegos": ["id1", "id2", …] } en el orden del catálogo
│   └── <id>/                  # un juego (posible submódulo)
│       ├── juego.json         # manifiesto (§3)
│       ├── index.html         # entrada (o la que diga "entrada")
│       └── …
├── src/
│   ├── main.js                # arranque
│   ├── version.js             # versión publicada (cámbiala en cada publicación)
│   ├── engine/                # manifiesto.js, catalogo.js
│   ├── services/              # catalogo-repo.js, prefs.js, updates.js
│   ├── app/                   # store.js, actions.js, updates.js
│   └── ui/                    # render.js, entrada.js, labels.js, screens/{catalogo,jugando}.js, components/
├── styles/                    # tokens.css (colores, tema, escala TV), base.css, catalogo.css
└── tests/                     # node:test, sin dependencias
```

## 3. Manifiesto de un juego (`juego.json`)

```json
{
  "id": "ejemplo",
  "titulo": "Cuenta y toca",
  "descripcion": "¿Cuántos hay? Escoge el número.",
  "icono": "🍓",
  "color": "#ff6b4a",
  "materia": "números",
  "edades": [4, 7],
  "controles": ["tactil", "flechas", "remoto"],
  "entrada": "index.html",
  "version": "1"
}
```

| Campo | Obligatorio | Notas |
|---|---|---|
| `id` | sí | Minúsculas, números y guiones. **Igual al nombre de la carpeta** y al que está en `catalogo.json`. |
| `titulo` | sí | Lo que lee Noelia en la tarjeta. |
| `descripcion`, `icono`, `color` | no | Tarjeta: una línea, un emoji (o texto corto) y el color de fondo. |
| `materia` | no | Agrupa los filtros (`números`, `letras`, `inglés`, `colores`…). Por omisión `otros`. |
| `edades` | no | `[mínima, máxima]`. Por ahora informativo; servirá para filtrar cuando haya muchos juegos. |
| `controles` | no | Con qué se puede jugar: `tactil`, `flechas` (teclado/control de la TV), `remoto` (teléfono como control). Por omisión `["tactil", "flechas"]`. En modo TV solo tienen sentido los que aceptan `flechas` o `remoto`. |
| `entrada` | no | Página del juego, **relativa a su carpeta** (no se aceptan `..`, `/` ni URLs). Por omisión `index.html`. |
| `version` | no | Versión propia del juego (útil cuando sea submódulo). |

Un manifiesto roto no tumba el catálogo: ese juego se omite y el error sale en la consola. La prueba `tests/catalogo.test.js` revisa que todos los juegos del registro tengan carpeta, manifiesto válido y página de entrada, así que un PR con un juego mal registrado no pasa.

**¿Por qué un registro y no descubrir carpetas?** Un sitio estático (GitHub Pages) no puede listar carpetas. El registro además decide el orden y permite tener un juego en el repo sin publicarlo todavía.

## 4. Catálogo ↔ juego: el reproductor y el protocolo

El juego abierto corre en un `<iframe>` a pantalla completa (`ui/screens/jugando.js`). El iframe se crea una vez por juego abierto y se destruye al regresar. Se comunican con `postMessage`, siempre con `noli: 1` (versión del protocolo) y `tipo`, y solo se aceptan mensajes del mismo sitio y del iframe abierto (`kit/protocolo.js`):

| Dirección | Mensaje | Cuándo |
|---|---|---|
| catálogo → juego | `{ tipo: "hola", modo }` | Al cargar. `modo` es `"tactil"` o `"tv"` (el kit lo pone en `<html data-modo>` para que el juego ajuste tamaños). |
| catálogo → juego | `{ tipo: "entrada", accion }` | Una acción que llegó al catálogo (hoy: teclas con el foco fuera del iframe; en la fase 2: el teléfono remoto). |
| juego → catálogo | `{ tipo: "listo" }` | El kit ya escucha. |
| juego → catálogo | `{ tipo: "terminar", estrellas }` | Terminó una partida (0 a 3 estrellas). El catálogo guarda la mejor y cuántas veces se ha jugado. |
| juego → catálogo | `{ tipo: "salir" }` | Regresar al catálogo. |

**El kit (`kit/noli.js`)** es lo único que un juego necesita:

```js
import { Noli } from "../../kit/noli.js";
Noli.alEntrar((accion) => { /* "arriba" | "abajo" | "izquierda" | "derecha" | "ok" | "atras" */ });
Noli.terminar({ estrellas: 2 });
Noli.salir();
```

- Junta en `alEntrar` las acciones que llegan del catálogo **y** las teclas pulsadas con el foco dentro del juego (en la TV el foco queda en el iframe).
- `atras` que ningún oyente atiende (no devuelve `true`) = salir. Un juego puede usar `atras` para cerrar algo propio devolviendo `true`.
- El dedo no pasa por el kit: dentro de su página el juego usa eventos normales (`click`, `pointerdown`).
- Abierto solo (sin catálogo) el juego funciona igual: el kit escucha el teclado y `salir` regresa a la página anterior. Sirve para probar un juego por separado.

**Por qué iframe:** aísla los estilos, los globales y los errores de cada juego (un juego que truena no rompe el catálogo), permite que cada juego use lo que quiera (canvas, SVG, otra librería) y es lo que hace posible el submódulo. El costo es el protocolo de mensajes, que es chico.

## 5. Entrada: teléfono, TV y control remoto

**En el teléfono** se toca la tarjeta y se juega con el dedo. La casita 🏠 regresa al catálogo.

**En la TV (`?modo=tv`)** todo crece (`styles/tokens.css` escala con el ancho), la cuadrícula es de 4 columnas, el foco se ve desde el sillón (contorno grueso y halo amarillo) y la casita se oculta: se regresa con "atrás". Las flechas y OK del **control de la propia TV** ya funcionan, porque los navegadores de TV los mandan como teclas. El botón "atrás" cambia por marca (`kit/teclas.js`): Samsung Tizen `10009`, LG webOS `461`, Android TV `GoBack`/`Backspace`.

**TVs objetivo:** una **LG con webOS** y una **Samsung OLED de 77" (Tizen)**. En la LG, el Magic Remote además funciona como puntero: sus clics llegan como toques normales (`pointerdown`/`click`), así que las tarjetas y los juegos responden igual que al dedo. Lo que falta confirmar en cada TV (depende del año del modelo y de la versión de su navegador): que cargue módulos ES, que tenga WebRTC (`RTCDataChannel`) y qué códigos manda cada botón. Por eso el primer paso del control remoto es una página de diagnóstico (§5, fase 2).

En el catálogo, las flechas se mueven en la cuadrícula (`engine/catalogo.js → mover`, sin dar la vuelta; "abajo" en una fila incompleta va a la última tarjeta), "arriba" desde la primera fila pasa a los filtros, y OK abre. Con el dedo no se ve el contorno de foco; con la primera tecla sí (`html.teclado`).

### Fase 2: el teléfono como control remoto (issue aparte)

```
 TV (index.html?modo=tv)                     teléfono (control.html)
 ┌───────────────────────────┐               ┌──────────────┐
 │ catálogo / juego (iframe) │ ← entrada ──  │   ▲          │
 │ código de sala: 4 7 2 9   │   (WebRTC)    │ ◀ OK ▶  Atrás│
 │ [QR]                      │               │   ▼          │
 └───────────────────────────┘               └──────────────┘
           └──────── señalización (Firestore) ────────┘
```

0. **Diagnóstico en las TVs** (`diagnostico.html`): enseña qué tecla y código manda cada botón del control, y si el navegador tiene módulos ES, WebRTC y `localStorage`. Se abre una vez en la LG y otra en la Samsung, y con eso se confirma `kit/teclas.js` y se decide si hace falta el respaldo por Firestore.
1. La TV muestra un **código de sala** de 4 dígitos y un QR a `control.html?sala=4729`.
2. El teléfono abre `control.html` (o lee el QR) y se empareja.
3. El teléfono manda acciones; en la TV entran por **`actions.entrada(accion)`**, el mismo punto que el teclado, así que ni el catálogo ni los juegos cambian.

**Canal propuesto:** `RTCDataChannel` de WebRTC directo entre teléfono y TV (latencia de decenas de ms, sin servidor de por medio), con la **señalización por Firestore** que ya funciona en las llamadas de myPata (`services/call-signaling.js`: un solo lado ofrece, el otro responde). Si WebRTC no conecta (algunas redes con CGNAT), respaldo: las acciones van como documentos en Firestore (unos 100–300 ms, suficiente para juegos por turnos). **Firebase:** el proyecto `dominomx`, el mismo del dominó y la pata, con colecciones con prefijo `noli_` (`noli_salas`) y preferencias con prefijo `noli.`; sus reglas se agregan al `firestore.rules` compartido sin tocar las del dominó ni las de la pata. Al conectarse, se reutiliza `services/firebase.js` del dominó (SDK compat del CDN, cargado después de dibujar, entrada anónima).

**Más adelante:** el juego podrá mandar al teléfono **botones propios** (`{ tipo: "botones", botones: ["1", "4", "5"] }`) para que Noelia conteste tocando su teléfono en lugar de moverse con flechas; y dos teléfonos podrán ser dos jugadores. Por eso `controles` distingue `flechas` de `remoto`.

## 6. Juegos como submódulos

Hoy cada juego vive en este repo. Cuando un juego crezca o se quiera reusar, se mueve a su propio repo y se monta en el mismo lugar:

```bash
git rm -r minijuegos/sumas
git submodule add https://github.com/gcarrerap/noli-sumas minijuegos/sumas
```

Nada más cambia: el catálogo lo sigue encontrando por `catalogo.json` y su `juego.json`. Para que esto funcione, cada juego:

- usa **solo rutas relativas** dentro de su carpeta (y `../../kit/` para el kit);
- no importa nada de `src/` ni de `styles/` del catálogo (trae sus propios estilos);
- trae su `juego.json` en la raíz de su carpeta.

GitHub Pages publica submódulos si son públicos y usan URL `https://`. Un juego que viva aparte y quiera probarse solo puede traer una copia de `kit/` (los tres archivos no importan nada); si el protocolo cambia, `noli: 1` sube de versión y el catálogo puede seguir aceptando la anterior.

## 7. Estado y progreso

- `state.juegos`, `state.materia` (filtro), `state.foco`, `state.cols` (columnas reales de la cuadrícula, para que "abajo" baje una fila), `state.jugando`.
- **Progreso por dispositivo** en `localStorage` (`noli.progreso`): por juego, la mejor cantidad de estrellas, cuántas veces se jugó y cuándo. La tarjeta muestra las estrellas. No hay cuentas ni nube por ahora.
- `noli.materia` recuerda el último filtro.

## 8. Versiones y sin conexión

Igual que en el dominó: `src/version.js` se cambia en cada publicación; si cambia mientras Noli está abierto aparece "Hay juegos nuevos · Actualizar" (nunca durante un juego). `sw.js` pide siempre primero al servidor y guarda copia de lo ya abierto para usarlo sin internet.

## 9. Cómo agregar un juego

1. Abrir un issue para el juego (qué enseña, edad, cómo se juega con el dedo y con flechas).
2. Crear `minijuegos/<id>/` con `juego.json`, `index.html` y su código. Usar `minijuegos/ejemplo/` como plantilla.
3. Importar el kit, atender `alEntrar` (flechas + OK) para que se pueda jugar en la TV, y llamar `Noli.terminar({ estrellas })` al acabar.
4. Agregar el id a `minijuegos/catalogo.json`.
5. `npm test`, cambiar `src/version.js` y abrir el PR que cierra el issue.

**Guía para los juegos:** pensados para 7 años: ya lee frases cortas, así que las instrucciones pueden ir en texto breve (una línea, letra grande) con un ícono de apoyo; voz opcional. Botones grandes (mínimo ~64 px en teléfono; en la TV, legibles a 3 m), respuesta inmediata al tocar, errores suaves (se enseña la respuesta correcta, no se castiga), partidas cortas (1–3 minutos) y respeto a `prefers-reduced-motion`.

## 10. Fuera de alcance (por ahora)

- Cuentas, varios niños o progreso en la nube.
- Sonido y voz compartidos en el kit (cada juego trae los suyos; si se repiten, se suben al kit).
- Un juego de varios jugadores en la misma TV (posible con dos teléfonos remotos, fase 2+).
