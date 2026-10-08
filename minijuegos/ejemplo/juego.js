// "Cuenta y toca": el juego de ejemplo. Muestra cómo un minijuego usa el kit:
//  - Noli.alEntrar(fn) para flechas/OK/atrás (vengan del teclado, del control de la TV o del teléfono remoto)
//  - el dedo funciona con eventos normales de la página
//  - Noli.terminar({ estrellas }) al acabar, y Noli.salir() para regresar al catálogo
import { Noli } from "../../kit/noli.js";

const RONDAS = 5;
// Figuras en SVG (no emojis: en la TV LG salen en blanco y negro, #5)
const FORMAS = {
  circulo: '<circle cx="50" cy="50" r="40"/>',
  estrella: '<path d="M50 6l12.9 27.5 30.1 3.6-22.2 20.6 5.8 29.8L50 72.6 23.4 87.5l5.8-29.8L7 37.1l30.1-3.6z"/>',
  corazon: '<path d="M50 88S8 62 8 34a21 21 0 0 1 42-4 21 21 0 0 1 42 4c0 28-42 54-42 54z"/>',
  cuadro: '<rect x="12" y="12" width="76" height="76" rx="16"/>',
  triangulo: '<path d="M50 8l44 80H6z" stroke-linejoin="round"/>',
};
const COLORES = ["#ff6b4a", "#ffb400", "#3ccf8e", "#4cb3ff", "#c86bfa"];
const COSAS = Object.keys(FORMAS).flatMap((f) => COLORES.map((c) => ({ f, c })));
const figura = ({ f, c }) => `<svg viewBox="0 0 100 100" aria-hidden="true"><g fill="${c}" stroke="rgba(0,0,0,.18)" stroke-width="4">${FORMAS[f]}</g></svg>`;
const $juego = document.getElementById("juego");

let ronda, aciertos, pregunta, sel, fin, bloqueado;

function nuevaPartida() { ronda = 0; aciertos = 0; fin = false; siguiente(); }

function siguiente() {
  if (ronda >= RONDAS) return terminar();
  ronda++;
  const n = 1 + Math.floor(Math.random() * 5);
  const opciones = new Set([n]);
  while (opciones.size < 3) { const o = 1 + Math.floor(Math.random() * 6); if (o !== n) opciones.add(o); }
  pregunta = { n, cosa: COSAS[Math.floor(Math.random() * COSAS.length)], opciones: [...opciones].sort((a, b) => a - b) };
  sel = 1; bloqueado = false;
  dibujar();
}

function dibujar() {
  const { n, cosa, opciones } = pregunta;
  $juego.innerHTML = `
    <p class="ronda">${"●".repeat(ronda)}${"○".repeat(RONDAS - ronda)}</p>
    <h1>¿Cuántos hay?</h1>
    <div class="cosas" aria-label="${n}">${Array.from({ length: n }, (_, i) => `<span style="--i:${i}">${figura(cosa)}</span>`).join("")}</div>
    <div class="opciones">${opciones.map((o, i) => `<button class="op${i === sel ? " sel" : ""}" data-i="${i}">${o}</button>`).join("")}</div>`;
  $juego.querySelectorAll(".op").forEach((b) => (b.onclick = () => { sel = +b.dataset.i; elegir(); }));
}

function marcar() { $juego.querySelectorAll(".op").forEach((b, i) => b.classList.toggle("sel", i === sel)); }

function elegir() {
  if (bloqueado) return;
  bloqueado = true;
  const ok = pregunta.opciones[sel] === pregunta.n;
  if (ok) aciertos++;
  const b = $juego.querySelectorAll(".op")[sel];
  b.classList.add(ok ? "bien" : "mal");
  if (!ok) $juego.querySelectorAll(".op")[pregunta.opciones.indexOf(pregunta.n)].classList.add("bien");
  setTimeout(siguiente, ok ? 700 : 1400);
}

function terminar() {
  fin = true;
  const estrellas = aciertos === RONDAS ? 3 : aciertos >= 4 ? 2 : aciertos >= 2 ? 1 : 0;
  Noli.terminar({ estrellas });
  $juego.innerHTML = `
    <h1>¡Terminaste!</h1>
    <p class="grande">${"★".repeat(estrellas)}<span class="apagada">${"★".repeat(3 - estrellas)}</span></p>
    <p>${aciertos} de ${RONDAS}</p>
    <div class="opciones"><button class="op ancho sel" id="otra">Otra vez</button></div>`;
  document.getElementById("otra").onclick = nuevaPartida;
}

Noli.alEntrar((accion) => {
  if (fin) { if (accion === "ok") nuevaPartida(); return; }
  if (accion === "izquierda" && sel > 0) { sel--; marcar(); }
  else if (accion === "derecha" && sel < 2) { sel++; marcar(); }
  else if (accion === "ok") elegir();
  // "atras" no se atiende (no devuelve true): el kit regresa al catálogo
});

nuevaPartida();
