## Juego

Cierra #

Para juntar un PR de juego, marca todo. Si el PR no es de un juego, borra esta lista.

## Criterios de aceptación

- [ ] Carpeta `minijuegos/<id>/` con `juego.json` válido (`id: "<id>"`, `titulo`, `icono: "icono.svg"`, `color`, `materia`, `edades`, `controles: ["tactil", "flechas", "remoto"]`, `creditos`), `index.html` y su código, partiendo de `minijuegos/ejemplo/`.
- [ ] Registrado en `minijuegos/catalogo.json`.
- [ ] Lógica pura en `src/` (azar inyectado con semilla) con pruebas `node:test` en `minijuegos/<id>/tests/`; `npm test` pasa (incluida la prueba del catálogo).
- [ ] Se juega completo con el dedo en el teléfono y con flechas/OK/Atrás en la TV y con el teléfono como control (#3); Atrás sin nada abierto regresa al catálogo.
- [ ] Sin emojis para nada que importe (#5): todo el arte en SVG. Sin `await` al nivel del módulo.
- [ ] Progreso con `Noli.datos.then(…)` / `Noli.guardar`, nunca directo en `localStorage`.
- [ ] Pruebas de lo propio del juego (reto del día determinista con la misma fecha).
- [ ] Renglón en la tabla de juegos del `README.md` y en DESIGN §10.
- [ ] `src/version.js` cambiado.
- [ ] Capturas de un teléfono en vertical, angosto, a 360 px y a 412 px de ancho: sin scroll horizontal y con el botón de la acción principal a la vista.
- [ ] Probado en la TV, en horizontal (`?modo=tv`), jugado solo con el control (flechas, OK y Atrás), con captura.
- [ ] Guía la primera vez, o pistas claras en cada paso, para que una niña de 7 años entienda cómo jugar sin ayuda.
- [ ] Visto bueno de claridad de Ñoño (diseño del juego).
