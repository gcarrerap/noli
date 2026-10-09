// El día del dragón, en orden. Nunca las 12:00. «Menos cuarto» es su propio nivel.
import { revolver, uno } from "./rng.js";
import { hora12, candidatosLectura } from "./reloj.js";
import {
  frasePoner, vozPoner, fraseLeer, vozLeer, fraseMomento, vozMomento,
  fraseCuanto, vozCuanto, OPCIONES_CUANTO, PARTES, etiquetaIngles,
} from "./frases.js";

export const POR_TURNO = 6;

export const MOMENTOS = [
  { id: "desayuno", que: "El desayuno", voz: "El desayuno", hora: 7, parte: "manana", cielo: "cielo-manana", escena: "escena-desayuno", chiste: "¡El dragón llegó en pijama!" },
  { id: "autobus", que: "El autobús", voz: "El autobús", hora: 8, parte: "manana", cielo: "cielo-manana", escena: "escena-autobus", chiste: "¡El dragón perdió el autobús!" },
  { id: "escuela", que: "La escuela", voz: "La escuela", hora: 9, parte: "manana", cielo: "cielo-dia", escena: "escena-escuela", chiste: "¡El dragón llegó en pijama a la escuela!" },
  { id: "recreo", que: "El recreo", voz: "El recreo", hora: 10, parte: "manana", cielo: "cielo-dia", escena: "escena-recreo", chiste: "¡El dragón salió en pijama!" },
  { id: "comida", que: "La comida", voz: "La comida", hora: 14, parte: "tarde", cielo: "cielo-tarde", escena: "escena-comida", chiste: "¡El dragón llegó a comer en pijama!" },
  { id: "parque", que: "El parque", voz: "El parque", hora: 16, parte: "tarde", cielo: "cielo-tarde", escena: "escena-parque", chiste: "¡El dragón fue al parque en pijama!" },
  { id: "cena", que: "La cena", voz: "La cena", hora: 19, parte: "noche", cielo: "cielo-noche", escena: "escena-cena", chiste: "¡El dragón cenó en pijama!" },
  { id: "dormir", que: "A dormir", voz: "A dormir", hora: 20, parte: "noche", cielo: "cielo-noche", escena: "escena-dormir", chiste: "¡El dragón se acostó a destiempo!" },
];

export const ALBUM = [
  { id: "cumpleanos", nombre: "Cumpleaños", arte: "album-cumpleanos" },
  { id: "playa", nombre: "Playa", arte: "album-playa" },
  { id: "navidad", nombre: "Navidad", arte: "album-navidad" },
];

export const NIVELES = [
  { n: 1, nombre: "En punto", ejemplo: "las 3" },
  { n: 2, nombre: "Y media", ejemplo: "las 8 y media" },
  { n: 3, nombre: "Y cuarto", ejemplo: "las 10 y cuarto" },
  { n: 4, nombre: "Menos cuarto", ejemplo: "las 9 menos cuarto" },
  { n: 5, nombre: "De 5 en 5", ejemplo: "7:20" },
  { n: 6, nombre: "Leer y poner", ejemplo: "4:10" },
  { n: 7, nombre: "Mañana, tarde y noche", ejemplo: "el desayuno" },
  { n: 8, nombre: "¿Cuánto falta?", ejemplo: "1 hora, media hora o un cuarto" },
];

const MEZCLA = {
  1: ["poner", "poner", "poner", "poner", "poner", "poner"],
  2: ["poner", "poner", "poner", "poner", "leer", "leer"],
  3: ["poner", "poner", "poner", "poner", "leer", "leer"],
  4: ["poner", "poner", "poner", "poner", "poner", "poner"],
  5: ["poner", "poner", "poner", "leer", "leer", "poner"],
  6: ["poner", "leer", "poner", "leer", "poner", "leer"],
  7: ["momento", "momento", "momento", "momento", "momento", "momento"],
  8: ["cuanto", "cuanto", "cuanto", "cuanto", "cuanto", "cuanto"],
};

const QUINTOS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const SALTOS = [
  { min: 15, id: "cuarto" },
  { min: 30, id: "media" },
  { min: 60, id: "hora" },
];

export function nivel(n) {
  return NIVELES[n - 1];
}

function minutosDe(n, rnd) {
  if (n === 1) return 0;
  if (n === 2) return 30;
  if (n === 3) return 15;
  if (n === 4) return 45;
  if (n === 5) return uno(rnd, [5, 10, 20, 25, 35, 40, 50, 55]);
  if (n === 7) return uno(rnd, [0, 15, 30]);
  return uno(rnd, QUINTOS);
}

function minutosReto(nivelN, rnd) {
  if (nivelN <= 1) return 0;
  if (nivelN === 2) return uno(rnd, [0, 30]);
  if (nivelN === 3) return uno(rnd, [0, 15, 30]);
  if (nivelN === 4) return uno(rnd, [0, 15, 30, 45]);
  return uno(rnd, QUINTOS);
}

function inicioPoner(h, m, rnd) {
  if (m !== 0) return { h, m: 0 };
  const dh = 1 + Math.floor(rnd() * 4);
  return { h: (h + dh) % 24, m: 0 };
}

function opcionesLectura(h, m, rnd) {
  const buenas = { h: hora12(h), m, buena: true };
  const malas = candidatosLectura(h, m).slice(0, 2).map((c) => ({ ...c, buena: false }));
  return revolver(rnd, [buenas, ...malas]);
}

function finCuanto(h, salto) {
  const total = h * 60 + salto;
  return { h: Math.floor(total / 60) % 24, m: total % 60 };
}

function armar(tipo, momento, h, m, rnd, extra = {}) {
  const base = {
    tipo, momento: momento.id, parte: momento.parte, cielo: momento.cielo,
    escena: momento.escena, chiste: momento.chiste, h, m,
    ingles: etiquetaIngles(h, m),
  };
  if (tipo === "poner") {
    let inicio = inicioPoner(h, m, rnd);
    if (hora12(inicio.h) === hora12(h) && inicio.m === m) inicio = { h: (h + 2) % 24, m: 0 };
    return {
      ...base, inicio, opciones: null,
      frase: frasePoner(momento, h, m), voz: vozPoner(momento, h, m),
      digitalAlLado: m === 45,
    };
  }
  if (tipo === "leer") {
    return {
      ...base, inicio: { h, m }, opciones: opcionesLectura(h, m, rnd),
      frase: fraseLeer(), voz: vozLeer(), digitalAlLado: false,
    };
  }
  if (tipo === "momento") {
    return {
      ...base, inicio: { h, m },
      opciones: PARTES.map((p) => ({ ...p, buena: p.id === momento.parte })),
      frase: fraseMomento(momento, h, m), voz: vozMomento(momento, h, m),
      digitalAlLado: false,
    };
  }
  const salto = extra.salto || uno(rnd, SALTOS);
  const fin = finCuanto(h, salto.min);
  return {
    ...base, h, m, h2: fin.h, m2: fin.m, salto: salto.id, inicio: { h, m },
    opciones: OPCIONES_CUANTO.map((o) => ({ ...o, buena: o.id === salto.id })),
    frase: fraseCuanto(h, 0, fin.h, fin.m),
    voz: vozCuanto(h, 0, fin.h, fin.m),
    digitalAlLado: false,
  };
}

function elegirMomentos(rnd, cuantos) {
  const idx = revolver(rnd, MOMENTOS.map((_, i) => i)).slice(0, cuantos).sort((a, b) => a - b);
  return idx.map((i) => MOMENTOS[i]);
}

export function planDia(n, rnd, { cuantos = POR_TURNO, soloLeer = false, nivelReto = n } = {}) {
  const momentos = elegirMomentos(rnd, cuantos);
  const tipos = soloLeer
    ? momentos.map(() => "leer")
    : revolver(rnd, (MEZCLA[n] || MEZCLA[6]).slice(0, cuantos));
  const saltos = n === 8 ? revolver(rnd, [...SALTOS, ...SALTOS]) : null;
  return momentos.map((momento, i) => {
    const tipo = tipos[i];
    const h = momento.hora;
    const m = soloLeer ? minutosReto(nivelReto, rnd) : tipo === "cuanto" ? 0 : minutosDe(n, rnd);
    return armar(tipo, momento, h, m, rnd, { salto: saltos ? saltos[i] : null });
  });
}

// Para las pruebas: una escena concreta.
export function escenaDe(tipo, momentoId, h, m, rnd = Math.random) {
  const momento = MOMENTOS.find((x) => x.id === momentoId);
  return armar(tipo, momento, h ?? momento.hora, m ?? 0, rnd);
}

