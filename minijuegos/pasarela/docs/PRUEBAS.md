# Pruebas

## Automáticas

```bash
npm test          # en la raíz del repo: todas las de Noli, incluida tests/pasarela.test.js
node --test minijuegos/pasarela/tests/pasarela.test.js     # solo las de la Pasarela
```

`tests/pasarela.test.js` (Node, sin navegador ni dependencias):

| Grupo | Qué revisa |
|---|---|
| Datos | Los JSON no tienen errores (`revisarDatos`); lo que pide el issue (5+ categorías, 40+ prendas, 10+ temas, 3 jueces, 4+ niveles, nombres en español e inglés); que `revisarDatos` sí atrape los errores típicos al editar a mano; que los temas iniciales se puedan vestir con el clóset inicial |
| Atuendo | Vestido ↔ arriba/abajo; tocar dos veces quita; otro color reemplaza; un accesorio por lugar; frase en inglés con *a/an* y plurales; `limpiar` con datos viejos |
| Puntuación | Encaje (−2 a 3); los dos ejemplos trabajados de JUEGO.md con sus números y comentarios exactos; nunca menos de 1 estrella; solo sugiere ropa abierta; determinista; concordancia el/la/los/las |
| Progreso | Niveles y lo abierto; registrar una pasarela (sube dos niveles de una vez, guarda la foto, clóset de máximo 12); leer basura; lo "nuevo"; tema sin repetir; curva |
| Movimiento | Camina, gira poco a poco, no atraviesa; se desliza en la pared; cada zona es alcanzable desde el inicio con la ruta automática; flechas con impulso y diagonal |
| Partida | Transiciones del diagrama; eventos que no aplican; reloj |
| 2D | Cada prenda tiene figura, miniatura y muñeca sin `undefined`/`NaN` |
| Patrones y estampados (#79) | El arte (64×64, fondo `{p}`, nada de fuera); `pintarSVG`; qué prendas aceptan patrón; poner/cambiar/quitar; frase en inglés; jueces; validación de `calca` y `patrones.json`; panel, pantalla de nivel y 2D |
| Taller (#80) | **Todas las combinaciones de todos los moldes**: ningún tubo más delgado que la ropa del catálogo en esa ancla, listones y calcomanías por fuera de la tela, una calcomanía por lugar, figura 2D, menos de 6 000 triángulos en 3D; diseño → prenda (nombre, temas → etiquetas, patrón fijo, frase en inglés, encaje 3); `limpiarDiseno` con basura; espacios; nombres sugeridos; progreso v1 → v2 y que el atuendo con un diseño sobreviva; **tamaño máximo guardado < 20 000 caracteres**; pantallas de cada paso; molde mal escrito; ruta hasta el Taller y Mis diseños; Don Detalle |
| 3D | El personaje tiene todas las anclas; **cada prenda se arma con Three.js** (en Node) y anima en las 6 posturas; ninguna pasa de 6 000 triángulos; el `.glb` existe, es glTF y pesa menos de 200 KB |

Además, las pruebas del repo revisan que `juego.json` sea válido (incluido `"creditos": "gasta"` y `"costo"`), que el juego esté en `catalogo.json`, y que cada módulo (también `kit/3d/vendor/`) se analice y sus imports existan (`tests/sintaxis.test.js`). `herramientas/simular-curva.mjs` es `.mjs` para que esa prueba no lo trate como parte del juego.

## En el navegador (Chromium, sin aparato)

Se usó Playwright con Chromium (SwiftShader, sin GPU) para recorrer todo: inicio → cobro → tema → caminar con el teclado → "Ir a…" → panel → ropa y colores → pasarela → calificación → desbloqueo → clóset; en teléfono (390×844), TV (1280×720, dentro del catálogo con `?modo=tv` y solo teclado) y el modo sencillo. Sin errores en la consola. Ahí la escena va a 5–10 fps (no hay GPU), así que sirve para revisar que todo funcione, no la velocidad. Con `?sinaviso` no se ofrece el modo sencillo por lento.

## A mano, en cada aparato (marcar en el PR)

Abrir `https://gcarrerap.github.io/noli/` (en la TV, `?modo=tv`). Para tener créditos: jugar un juego educativo, o *Créditos → Para papás → +10*.

### Teléfono (dedo)

- [ ] La tarjeta de la Pasarela dice "3" con la moneda.
- [ ] Inicio: se ve el personaje entero arriba de la tarjeta; saldo correcto.
- [ ] "¡A la pasarela!" descuenta 3 (revisar el saldo al salir al catálogo).
- [ ] Sin créditos: "Te faltan N créditos"; "Ir a jugar" regresa al catálogo; "Probarme ropa" entra al probador.
- [ ] Joystick: aparece donde pongo el pulgar; camina hacia donde lo empujo; a medias camina lento; no atraviesa muebles.
- [ ] Tocar el piso: camina hasta ahí. Tocar un letrero: camina y abre el panel.
- [ ] Panel: el personaje se ve arriba, de frente; tocar una prenda se la pone; otra vez se la quita; colores; la bocina dice el nombre en inglés.
- [ ] Prendas bloqueadas: candado y "Se abre en el nivel…".
- [ ] Espejo: da una vuelta y no hay ningún letrero, aviso ni joystick encima del personaje.
- [ ] Zapatos: la cámara enseña los pies arriba del panel. Maquillaje: la cara. Joyería: orejas, cuello y muñecas. Peinados: la cabeza.
- [ ] Girar: arrastrando el dedo sobre el personaje y con los botones curvos del panel; al cerrar el panel vuelve de frente.
- [ ] Maquillaje (rubor, labial…) y joyas (aretes, collares, reloj, pulsera) se ven en la cara y el cuerpo, y en el modo sencillo.
- [ ] Al final de la pasarela: "¡Escoge tu pose!"; cada pose o baile se ve, se pueden hacer varias, "¡Listo!" sigue a la calificación.
- [ ] Cada pasarela abre poco (de 1 a 3 cosas) y no en todas sube de nivel.
- [ ] El reloj llega a 0 y se va sola a la pasarela.
- [ ] Pasarela: desfile, pose, jueces; calificación con comentarios que tienen sentido; frase en inglés.
- [ ] Al subir de nivel: pantalla de desbloqueo; lo nuevo con "¡Nuevo!" hasta que lo veo.
- [ ] Clóset: fotos con tema y estrellas; "Ponérmelo".
- [ ] "Mi piel" cambia el tono.
- [ ] Bloquear el teléfono a la mitad y regresar: sigue donde iba.
- [ ] Teléfono acostado: el panel va a la derecha y el personaje a la izquierda.
- [ ] Patrones (#79): debajo de los colores; se ven en la prenda puesta (3D y modo sencillo) y en la miniatura; la frase en inglés los dice.
- [ ] Taller (#80): la primera vez sale la guía; los 5 pasos; el personaje trae el diseño y la cámara enfoca su parte; el reloj no corre; salir y volver conserva el borrador; escribir el nombre con el teclado del teléfono.
- [ ] Coser descuenta 5 (revisar en el catálogo); sin créditos: "Te faltan N" y el borrador sigue; con los espacios llenos no deja coser.
- [ ] Mis diseños: el diseño aparece, se pone, va a la pasarela (Don Detalle lo comenta), sale en el clóset y en el modo sencillo; "Descoser" pregunta.
- [ ] Recargar: los diseños siguen; en la TV aparecen los del teléfono (sincronización).

### LG webOS y Samsung Tizen (control de la tele)

- [ ] Correr `diagnostico.html`: WebGL sí/no, tarjeta gráfica, Chromium. Anotar en RENDIMIENTO.md.
- [ ] Abrir `minijuegos/pasarela/?fps` y llenar la fila de RENDIMIENTO.md (inicio, estudio, desfile).
- [ ] Del catálogo: flechas hasta la Pasarela, OK.
- [ ] Inicio: el foco empieza en "¡A la pasarela!"; flechas entre botones.
- [ ] Estudio: mantener una flecha camina; soltarla para. Se lee "Flechas: caminar · OK: abrir · Atrás: salir".
- [ ] OK lejos de un mueble: "¿A dónde vamos?"; escoger uno camina solo y abre el panel.
- [ ] Panel: el foco empieza en la primera prenda; flechas entre prendas y colores; Atrás cierra el panel.
- [ ] Atrás en el estudio: "¿Salir de esta pasarela?"; Atrás otra vez = seguir jugando.
- [ ] Atrás durante el desfile y escogiendo poses: no pasa nada. Las poses se escogen con flechas y OK.
- [ ] Panel: los botones curvos giran al personaje (OK sobre ellos).
- [ ] Atrás en el inicio: regresa al catálogo.
- [ ] Todo se lee desde el sillón (3 m).
- [ ] Magic Remote (LG): apuntar y hacer clic en letreros, prendas y botones.
- [ ] Si va lento: baja la calidad sola; si mucho, ofrece el modo sencillo; en modo sencillo se juega todo con flechas.

### Teléfono como control remoto de la TV

- [ ] Con el teléfono conectado (📱 en el catálogo de la TV): la cruceta camina (el personaje sigue caminando mientras se mantiene apretada), OK abre, Atrás cierra/sale igual que el control de la tele.

### Modo sencillo (cualquier aparato)

- [ ] `minijuegos/pasarela/?modo2d`: muñeca 2D, los muebles son botones, panel, pasarela animada, calificación.
