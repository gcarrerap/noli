// Pruebas de la puerta de papás de los créditos (#67): la correcta no siempre está en medio (ni en posición ni en
// tamaño), toques al azar y OK en ráfaga nunca abren, y un adulto sí entra.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PUERTA, nuevaPregunta, entrar, tocar, responder, cerrada, guardable, leerPuerta, faltaTexto } from "../src/engine/puerta.js";

// Azar reproducible
function semilla(s) { return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

test("pregunta: 6–9 × 6–9, 3 opciones distintas y positivas, la correcta entre ellas", () => {
  const rnd = semilla(1);
  for (let i = 0; i < 2000; i++) {
    const p = nuevaPregunta(rnd);
    assert.ok(p.a >= 6 && p.a <= 9 && p.b >= 6 && p.b <= 9);
    assert.equal(p.r, p.a * p.b);
    assert.equal(p.opciones.length, 3);
    assert.equal(new Set(p.opciones).size, 3);
    assert.ok(p.opciones.includes(p.r));
    assert.ok(p.opciones.every((o) => o > 0));
  }
});

test("pregunta: la correcta cae en cada botón y es la menor, la de en medio o la mayor, cada una ~1/3", () => {
  const rnd = semilla(7), N = 3000;
  const lugar = [0, 0, 0], tamano = [0, 0, 0];
  for (let i = 0; i < N; i++) {
    const p = nuevaPregunta(rnd);
    lugar[p.opciones.indexOf(p.r)]++;
    tamano[[...p.opciones].sort((x, y) => x - y).indexOf(p.r)]++;
  }
  for (const c of [...lugar, ...tamano]) assert.ok(c > N * 0.27 && c < N * 0.4, `${lugar} / ${tamano}`);
});

// Un adulto: espera, toca la correcta (pointerdown → click)
const tocarYResponder = (e, n, t, rnd) => responder(tocar(e, t), n, t, rnd);

test("adulto: dos correctas con calma abren la puerta; cada una con pregunta nueva", () => {
  const rnd = semilla(3);
  let e = entrar(null, 0, rnd);
  const p1 = e.pregunta;
  e = tocarYResponder(e, p1.r, 2000, rnd);
  assert.equal(e.abierta, false);
  assert.equal(e.racha, 1);
  assert.notEqual(e.pregunta, p1);
  e = tocarYResponder(e, e.pregunta.r, 4000, rnd);
  assert.equal(e.abierta, true);
});

test("espera: antes de 1.5 s no cuenta, y cada toque la reinicia", () => {
  const rnd = semilla(4);
  let e = entrar(null, 0, rnd);
  assert.equal(tocarYResponder(e, e.pregunta.r, 1000, rnd).racha, 0, "demasiado pronto");
  e = tocar(e, 1000); // un toque en la pantalla a 1 s
  assert.equal(tocarYResponder(e, e.pregunta.r, 2000, rnd).racha, 0, "el toque de 1 s reinició la espera");
  assert.equal(tocarYResponder(e, e.pregunta.r, 2600, rnd).racha, 1);
  // Un click sin toque previo (armada en falso) no cuenta
  assert.equal(responder(entrar(null, 0, rnd), 0, 5000, rnd).racha, 0);
});

test("error: mensaje, 2 s de espera y pregunta nueva; al volver a entrar se borra el mensaje y la racha", () => {
  const rnd = semilla(5);
  let e = entrar(null, 0, rnd);
  e = tocarYResponder(e, e.pregunta.r, 2000, rnd);
  const mala = e.pregunta.opciones.find((o) => o !== e.pregunta.r);
  e = tocarYResponder(e, mala, 4000, rnd);
  assert.equal(e.racha, 0);
  assert.equal(e.fallos, 1);
  assert.ok(e.error);
  assert.equal(tocarYResponder(e, e.pregunta.r, 5800, rnd).racha, 0, "dentro de los 2 s");
  const otra = entrar(guardable(e), 9000, rnd);
  assert.equal(otra.error, "");
  assert.equal(otra.racha, 0);
  assert.equal(otra.fallos, 1, "los fallos se guardan");
  assert.equal(tocarYResponder(otra, otra.pregunta.r, 9500, rnd).racha, 0, "el tiempo fuera de la puerta no cuenta");
});

test("descanso: 2 fallos cierran 30 s → 2 min → 5 min, sobrevive a recargar y se reinicia al entrar un adulto", () => {
  const rnd = semilla(6);
  const fallar = (e, t) => tocarYResponder(e, e.pregunta.opciones.find((o) => o !== e.pregunta.r), t, rnd);
  let t = 0, e = entrar(null, t, rnd);
  for (const descanso of [30000, 120000, 300000, 300000]) {
    e = fallar(e, t += 3000);
    e = fallar(e, t += 3000);
    assert.ok(cerrada(e, t));
    assert.equal(e.cerradaHasta, t + descanso);
    // Recargar (o salir y volver) no se salta el descanso
    const recargada = entrar(JSON.parse(JSON.stringify(guardable(e))), t + 1000, rnd);
    assert.ok(cerrada(recargada, t + 1000));
    assert.equal(tocarYResponder(recargada, recargada.pregunta.r, t + 5000, rnd).racha, 0, "cerrada no acepta");
    t = e.cerradaHasta;
    e = entrar(guardable(e), t, rnd);
    assert.ok(!cerrada(e, t));
  }
  assert.equal(faltaTexto({ cerradaHasta: 30000 }, 0), "30 segundos");
  assert.equal(faltaTexto({ cerradaHasta: 120000 }, 0), "2 minutos");
  // Entra un adulto: todo vuelve a empezar
  e = tocarYResponder(e, e.pregunta.r, t += 2000, rnd);
  e = tocarYResponder(e, e.pregunta.r, t += 2000, rnd);
  assert.equal(e.abierta, true);
  assert.deepEqual(guardable(e), { fallos: 0, cierres: 0, cerradaHasta: 0 });
  assert.deepEqual(leerPuerta("basura"), { fallos: 0, cierres: 0, cerradaHasta: 0 });
  assert.deepEqual(leerPuerta({ fallos: -1, cierres: NaN, cerradaHasta: "x" }), { fallos: 0, cierres: 0, cerradaHasta: 0 });
});

test("toques al azar cada 50–300 ms durante 60 s nunca abren la puerta", () => {
  for (let s = 1; s <= 200; s++) {
    const rnd = semilla(s);
    let e = entrar(null, 0, rnd);
    for (let t = 0; t < 60000; t += 50 + Math.floor(rnd() * 251)) {
      e = tocar(e, t);
      if (rnd() < 0.7) e = responder(e, e.pregunta.opciones[Math.floor(rnd() * 3)], t, rnd);
      assert.equal(e.abierta, false, `semilla ${s}, ${t} ms`);
    }
  }
});

test("TV: OK cada 50 ms (con flechas de por medio) nunca abre la puerta", () => {
  const rnd = semilla(9);
  let e = entrar(null, 0, rnd);
  for (let t = 0; t < 120000; t += 50) {
    e = tocar(e, t); // ui/entrada.js: cada flecha u OK toca la puerta antes de hacer click
    e = responder(e, e.pregunta.opciones[Math.floor(t / 50) % 3], t, rnd);
    assert.equal(e.abierta, false);
  }
});

test("la espera de la puerta es mayor que cualquier hueco de toques al azar", () => {
  assert.ok(PUERTA.espera >= 1500 && PUERTA.esperaError >= 2000 && PUERTA.aciertos >= 2);
});
