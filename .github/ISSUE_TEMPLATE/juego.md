---
name: Juego nuevo
about: Proponer un juego para el catálogo de Noli
title: "Juego: "
---

## Objetivo

Qué hace Noelia en el juego: una situación, no un cuestionario.

Carpeta: `minijuegos/<id>/` (id `<id>`, materia `<materia>`, edades `<desde>–<hasta>`).

## Qué enseña

Qué practica, y la unidad o el estándar de donde sale.

## Cómo se juega

Una partida dura 1–3 minutos. Describe los pasos y el botón de la acción principal (el que hay que ver para seguir).

## Niveles y progreso

| # | Nivel |
|---|---|
| 1 |  |

Sube con 8 de los últimos 10. Los errores que comete regresan más adelante.

## Estrellas, reto del día y créditos

- 0–3 estrellas por partida.
- **Reto del día** (semilla = fecha, igual en todos los aparatos): cuál es. Racha de días.
- Juego educativo: `"creditos": "gana"`; al cumplir el reto, `Noli.terminar({ estrellas: 3, reto: true })` una vez al día.
- Juego de premio: `"creditos": "gasta"` con `"costo"` en `juego.json` y cobro con `Noli.gastar`. El juego no guarda ni calcula el saldo de Noli. Borra el renglón que no aplique.

## Controles (TV)

Se juega con las seis acciones del kit (`Noli.alEntrar`) y con el dedo; nada necesita teclear ni apuntar. En la TV todo legible a 3 m, foco grueso con `moverFoco` entre botones `[data-foco]`.

- Qué hace cada flecha, OK y Atrás.

## Arte y sonido

- Arte en SVG (en la TV LG los emojis salen en blanco y negro, #5).
- Sonido y voz, si hay.

## Por definir

- Lo que todavía no está decidido.

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
