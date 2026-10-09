# Reglas de la Pasarela

## Una partida

1. En el inicio se ve el saldo y el costo. **"¡A la pasarela!"** cobra `config.costo` créditos (3) con `Noli.gastar`. Si no alcanzan: "Te faltan N créditos", con "Ir a jugar" (regresa al catálogo) y "Mientras, probarme ropa".
2. Sale un **tema** al azar entre los abiertos, sin repetir el anterior.
3. La ropa vuelve a la **de base** (solo se queda el peinado) y empieza el **estudio**: `config.tiempoEstudio` = 150 s. A los 30 s finales (`avisoTiempo`) el reloj se pone rojo. Al llegar a 0 se va sola a la pasarela; también se puede ir antes (botón dorado o la puerta roja).
4. **Pasarela:** desfila y hace una pose.
5. **Calificación:** tres jueces, de 1 a 5 estrellas cada uno, un comentario positivo cada uno y un **consejo**. Se ve el atuendo en inglés y los puntos de estilo ganados.
6. Si subió de nivel: lo que se abrió (ropa, colores, tema).

**Probador libre** (sin créditos): igual que el estudio, sin tema, sin reloj, sin pasarela y sin puntos. Se puede estar ahí todo lo que quiera.

## Temas

| Tema | Pide (peso) | Evita | Colores | Nivel |
|---|---|---|---|---|
| Día de playa | playa 3, verano 3, casual 1 | frío, pijama, elegante | amarillo, turquesa, celeste, naranja, rosa, blanco | Principiante |
| Fiesta de cumpleaños | fiesta 3, brillo 2, elegante 1, casual 1 | pijama, frío, deportivo | rosa, morado, amarillo, celeste, dorado, lila | Principiante |
| Primer día de escuela | escuela 3, casual 2 | pijama, elegante, playa | azul, rojo, blanco, verde, amarillo, café | Principiante |
| Día de deportes | deportivo 3, casual 1 | elegante, princesa, pijama | rojo, azul, blanco, negro, verde, naranja | Principiante |
| Pijamada | pijama 3, casual 1 | elegante, deportivo, playa | rosa, lila, celeste, blanco, morado | Principiante |
| Invierno en la nieve | frío 3, aventura 1 | playa, verano | blanco, celeste, azul, rojo, plateado | Con estilo |
| Princesa del castillo | princesa 3, elegante 2, brillo 2 | deportivo, pijama, playa | rosa, lila, dorado, celeste, morado | Creativa |
| Primavera en el jardín | flores 3, verano 1, casual 1 | frío, rock | verde, rosa, amarillo, lila, blanco | Diseñadora |
| Campamento en el bosque | aventura 3, casual 1, frío 1 | elegante, princesa, brillo | verde, café, naranja, azul, rojo | Modelo |
| Estrella de rock | rock 3, brillo 2, fiesta 1 | pijama, princesa, flores | negro, morado, rojo, plateado, rosa | Estrella |
| Noche de gala | elegante 3, brillo 2 | deportivo, pijama, playa, casual | negro, dorado, plateado, morado, rojo | Superestrella |
| Hada del bosque | magia 3, flores 2, brillo 1 | deportivo, rock | verde, lila, turquesa, rosa, dorado | Ícono de la moda |

(Datos en `datos/temas.json`; nivel en `datos/desbloqueos.json`.)

## Cómo califican los jueces

Todo está en `src/puntuacion.js` y es **determinista**: el mismo atuendo con el mismo tema da siempre lo mismo (así Noelia puede aprender qué funciona).

### 1. Encaje de una prenda con el tema (−2 a 3)

```
encaje = el peso más alto que el tema le da a alguna de sus etiquetas (0 si ninguna)
         − 2 si alguna de sus etiquetas está en "evitar"
```

Ejemplo, tema **Día de playa**: blusa de tirantes (verano, playa, deportivo) → 3. Tenis (deportivo, escuela, casual) → 1. Camisa de botones (escuela, elegante) → 0 − 2 = **−2**. Chamarra de invierno (frío, aventura) → −2.

### 2. Las cuatro cosas que miran (0 a 1 cada una)

| Componente | Fórmula |
|---|---|
| **tema** | Promedio del encaje de todo lo puesto ÷ 3, con pesos: vestido 2 (cuenta como arriba + abajo), accesorios 0.5, lo demás 1. Recortado a 0–1. |
| **color** | 0.7 × (fracción de la ropa —sin el pelo— cuyo color es de los del tema) + 0.3 × combinación. Combinación: 1 con 3 colores distintos o menos, 0.6 con 4, 0.3 con 5 o más. Sin ropa: 0. |
| **completo** | (cuerpo + zapatos + peinado) ÷ 3. Cuerpo = 1 con vestido o con arriba y abajo; 0.5 con solo uno de los dos. |
| **detalles** | Accesorios que van (encaje ≥ 2): ninguno 0, uno 0.7, dos o más 1; −0.3 por cada accesorio que no va (encaje < 0). Recortado a 0–1. |

### 3. Cada juez

| Juez | tema | color | completo | detalles | Habla de… |
|---|---|---|---|---|---|
| **Estela** (rosa) | 0.6 | 0.1 | 0.2 | 0.1 | la mejor y la peor prenda para el tema |
| **Colorina** (amarilla) | 0.3 | 0.5 | 0.1 | 0.1 | los colores |
| **Don Detalle** (azul) | 0.3 | 0.1 | 0.3 | 0.3 | si falta algo y los accesorios |

```
valor del juez = Σ peso × componente           (0 a 1)
estrellas del juez = 1 + redondear(valor × 4)  (1 a 5: nunca 0)
puntos de la pasarela = suma de las 3 estrellas (3 a 15)  → puntos de estilo
estrellas de Noli (catálogo) = 3 con 13 o más, 2 con 10 o más, si no 1; 0 solo si no trae nada puesto
```

### Ejemplo trabajado 1: playa perfecta

Tema **Día de playa**. Atuendo: cola de caballo café, blusa de tirantes amarilla, shorts blancos, sandalias rosas, lentes de sol rosas.

| Prenda | Etiquetas | Encaje | Peso |
|---|---|---|---|
| cola de caballo | deportivo, escuela, casual, **playa** | 3 | 1 |
| blusa de tirantes | **verano**, **playa**, deportivo | 3 | 1 |
| shorts | **verano**, **playa**, deportivo, casual | 3 | 1 |
| sandalias | **playa**, **verano**, flores | 3 | 1 |
| lentes de sol | **playa**, **verano**, rock | 3 | 0.5 |

- tema = (3·4 + 3·0.5) ÷ (3 · 4.5) = 13.5 ÷ 13.5 = **1**
- color: la ropa sin pelo es amarillo, blanco, rosa, rosa → los 4 son del tema (fracción 1); 3 colores distintos (combinación 1) → 0.7 + 0.3 = **1**
- completo: cuerpo 1 + zapatos 1 + peinado 1 → **1**
- detalles: un accesorio que va → **0.7**
- Estela: 0.6 + 0.1 + 0.2 + 0.07 = 0.97 → 1 + round(3.88) = **5**. Colorina: 0.3 + 0.5 + 0.1 + 0.07 = 0.97 → **5**. Don Detalle: 0.3 + 0.1 + 0.3 + 0.21 = 0.91 → 1 + round(3.64) = **5**.
- **15 puntos de estilo**, 3 estrellas en el catálogo. Consejo: "¡No le cambiaría nada!" (ningún juez tiene mejora).

### Ejemplo trabajado 2: el mismo atuendo en la nieve

Tema **Invierno en la nieve** (pide frío 3, aventura 1; evita playa y verano).

- Encajes: todas las prendas tienen "playa" o "verano" → la cola 0 − 2 = −2, la blusa −2, los shorts −2, las sandalias −2, los lentes −2. tema = (−2·4.5) ÷ 13.5 < 0 → **0**.
- color: blanco es del tema; amarillo y rosa no → 1/4 = 0.25; 3 colores → 0.7·0.25 + 0.3 = **0.475**.
- completo **1**; detalles: los lentes no van (−0.3) → **0**.
- Estela: 0.0475 + 0.2 = 0.2475 → 1 + round(0.99) = **2**. Colorina: 0.2375 + 0.1 = 0.3375 → 1 + round(1.35) = **2**. Don Detalle: 0.0475 + 0.3 = 0.3475 → **2**.
- **6 puntos**, 1 estrella. Comentarios: "¡Me gusta cómo queda la blusa de tirantes!" · "¡Me encanta el blanco de tus shorts!" · "¡No te faltó nada, de la cabeza a los pies!". Consejo (el del juez con el valor más bajo, Estela): "Un suéter iría mejor que la blusa de tirantes."

(Los dos ejemplos son pruebas en `tests/pasarela.test.js`.)

### Los comentarios

Siempre hay uno **positivo** por juez (nunca se regaña) y, si hay algo que mejorar en lo suyo, una **mejora**:

| Juez | Positivo | Mejora |
|---|---|---|
| Estela | La prenda con mejor encaje: "¡El vestido de fiesta es perfecto para una fiesta de cumpleaños!" (si ninguna pasa de 1: "¡Me gusta cómo queda…!") | Si la peor tiene encaje ≤ 0: la mejor prenda **que ya tiene** de esa categoría: "Unas sandalias irían mejor que las botas de nieve." Si no tiene una mejor: "Las botas no van mucho con…". En empate se habla primero de la ropa y al final del peinado. |
| Colorina | "¡Me encanta el amarillo de tu blusa de tirantes!" (una prenda con color del tema) | Menos de 60 % de colores del tema: "Para jugar en la nieve prueba colores como blanco o celeste" (solo colores ya abiertos). 4 o más colores: "Son muchos colores juntos…" |
| Don Detalle | Un accesorio que va, o "¡No te faltó nada…!", o el peinado | Lo que falta ("Te faltó: zapatos, peinado."), o el mejor accesorio que ya tiene para el tema. |

**Consejo** = la mejora del juez con el valor más bajo (si no tiene, la del siguiente); si nadie tiene mejora: "¡No le cambiaría nada!". Los textos concuerdan en género y número con `genero` y `plural` de cada prenda (`src/espanol.js`).

## Créditos

- Costo: `config.costo` = **3** por pasarela (el catálogo lo enseña en la tarjeta con `juego.json → costo`; si se cambia uno, cambiar el otro).
- Se cobra **al empezar**, antes de ver el tema. Si se sale a la mitad (Atrás → "Sí, salir"), no se devuelve: la pantalla lo avisa.
- El juego nunca guarda ni calcula el saldo: lo lee al abrir (`Noli.creditos`) y usa el que regresa `Noli.gastar`. Si el catálogo no contesta en 5 s, no se cobra ("No se pudieron cobrar los créditos").
- La Pasarela **no da créditos** (`"creditos": "gasta"`); solo puntos de estilo. Los créditos salen de los juegos educativos (#20, DESIGN.md §12).
- Abierto solo (sin catálogo), el kit simula 10 créditos.

## Puntos de estilo, niveles y desbloqueos

Los puntos de cada pasarela (3 a 15) se **suman** y **nunca se pierden ni se gastan**. Cada nivel de `datos/desbloqueos.json` abre prendas, colores (para todas las prendas que los acepten) y temas:

| Nivel | Puntos | Abre |
|---|---|---|
| Principiante | 0 | El clóset inicial: 2 peinados, 3 de arriba (con la pijama), 3 de abajo, 1 vestido, 2 zapatos, 3 accesorios; 7 colores; 5 temas |
| Con estilo | 8 | Ropa de frío y de playa (11 prendas), verde y celeste, Invierno |
| Creativa | 20 | Chongos, trenza, sudadera, blusa de princesa, vestido de fiesta, zapatillas, corona, bufanda; morado; Princesa |
| Diseñadora | 35 | Rizos, camisa, tutú, leggings, vestido de princesa, collar, bolsa, flor; lila; Jardín |
| Modelo | 55 | Chongo de bailarina, top de brillos, falda larga, mameluco, botas, moño; naranja; Campamento |
| Estrella | 80 | Pelo suelto, chaqueta de cuero, zapatos de ballet; turquesa; Rock |
| Superestrella | 110 | Vestido de gala, varita; plateado; Gala |
| Ícono de la moda | 145 | Vestido de hada, alas, tiara de estrellas (Blender); dorado; Hada |

Al subir de nivel sale la pantalla de desbloqueo. Lo nuevo se marca **"¡Nuevo!"** en el panel (y un punto en los colores) hasta que se ve: al cerrar el panel de ese mueble queda como visto. Lo del clóset inicial nunca sale como nuevo. Las prendas bloqueadas se ven en gris con candado y dicen en qué nivel se abren y con cuántos puntos.

### La curva

Meta del issue: **algo nuevo cada 1–3 pasarelas al principio, más espaciado después.** `herramientas/simular-curva.mjs` simula 200 jugadoras de cada estilo, con temas al azar como en el juego (`node minijuegos/pasarela/herramientas/simular-curva.mjs --md`). Pasarelas (mediana) para llegar a cada nivel:

| Nivel | Puntos | Pasarelas (con cuidado) | Pasarelas (a medias) | Pasarelas (al azar) |
|---|---|---|---|---|
| Principiante | 0 | 0 | 0 | 0 |
| Con estilo | 8 | 1 | 1 | 1 |
| Creativa | 20 | 2 | 2 | 3 |
| Diseñadora | 35 | 3 | 4 | 5 |
| Modelo | 55 | 4 | 6 | 7 |
| Estrella | 80 | 6 | 8 | 10 |
| Superestrella | 110 | 8 | 10 | 14 |
| Ícono de la moda | 145 | 11 | 14 | 18 |

Puntos por pasarela en promedio: con cuidado 14.6 · a medias 11.0 · al azar 7.9.

**Por qué así:** la primera pasarela siempre abre algo (8 puntos se alcanzan hasta vistiéndose al azar), para que entienda de inmediato que desfilar abre ropa. Los saltos crecen poco a poco (de 1 a 3–4 pasarelas). Vestirse "con cuidado" se nota (casi el doble de rápido que al azar), así que poner atención al tema sí paga, pero quien juega al azar también avanza. A 3 créditos por pasarela, todo el clóset cuesta unos 40 créditos (unas 14 partidas buenas de los juegos educativos) para quien juega "a medias". Si se siente muy rápido, subir los últimos niveles en `desbloqueos.json` y volver a correr el simulador.

## Qué se guarda

Con `Noli.guardar(progreso)` (el catálogo lo guarda en `noli.datos.pasarela` y lo sincroniza en la nube):

```js
{
  v: 1,                    // versión del formato; leerProgreso() convierte o descarta lo que no entienda
  puntos: 41,              // puntos de estilo acumulados
  pasarelas: 4,            // pasarelas con tema
  vistos: ["a-camiseta", "c:rosa", "t:playa", …],   // lo que ya no brilla como nuevo (prendas, "c:" colores, "t:" temas)
  atuendos: [              // el clóset: los últimos config.maxAtuendosGuardados (12), el más nuevo primero
    { fecha: 1760000000000, tema: "playa", estrellas: [5, 5, 5], puntos: 15,
      atuendo: { peinado: { id: "p-cola", color: "cafe" }, arriba: {…}, abajo: {…}, vestido: null, zapatos: {…},
                 accesorios: { cara: { id: "x-lentes", color: "rosa" } } } }
  ],
  piel: 0,                 // índice en config.tonosPiel
  ultimo: { … },           // el último atuendo (para el probador libre y el peinado de la siguiente pasarela)
  ultimoTema: "playa"      // para no repetirlo
}
```

**Lo que NO se guarda aquí:** créditos (el catálogo), la preferencia 3D/2D (`localStorage["noli.pasarela.vista"]`, solo de ese aparato), el nivel (sale de los puntos), lo abierto (sale del nivel).

Si se cambian los datos (se borra una prenda, se renombra un tema), `leerProgreso` y `limpiar` quitan del clóset lo que ya no existe sin tronar. Si se cambia el formato, subir `v` y convertir en `leerProgreso`.
