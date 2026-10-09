// Un turno son 6 puertas. Taller, laberinto y oración son tipos de puerta.
// La banda espera: ninguna puerta trae reloj.
// Las oraciones no usan estructuras de niveles cerrados.
import { revolver } from "./rng.js";
import {
  AMBIGUAS, SUSTANTIVOS, VERBOS, ADJETIVOS,
  PLURALES_S, PLURALES_ES, PLURALES_IRR,
  PASADOS_ED, PASADOS_IRR, ORACIONES,
  TERCERA, tambienCorrecta, formasPasado, formasPasadoIrregular,
} from "./banco.js";

export const ESTRUCTURAS = {
  suelta: { min: 1 },
  "marco-a": { min: 1 },
  "marco-can": { min: 1 },
  "two-see": { min: 3 },
  "two-can": { min: 4 },
  ayer: { min: 5 },
  "ayer-irr": { min: 6 },
  "el-salta": { min: 7 },
  oracion: { min: 7 },
};

const PLAN = {
  1: ["taller", "taller", "taller", "taller", "taller", "taller"],
  2: ["taller", "taller", "taller", "taller", "taller", "taller"],
  3: ["laberinto", "laberinto", "laberinto", "laberinto", "taller", "taller"],
  4: ["laberinto", "laberinto", "laberinto", "laberinto", "laberinto", "taller"],
  5: ["laberinto", "laberinto", "laberinto", "laberinto", "laberinto", "taller"],
  6: ["laberinto", "laberinto", "laberinto", "laberinto", "laberinto", "taller"],
  7: ["oracion", "oracion", "oracion", "laberinto", "laberinto", "taller"],
};

const AMBIGUA = AMBIGUAS.map((id) => ({ id, dibujo: id }));

export function idDe(item) {
  return item.id || item.plural || item.pasado;
}

export function tomar(lista, rnd, usadas, fallos) {
  const libre = lista.filter((x) => !usadas.has(idDe(x)));
  const base = libre.length ? libre : lista;
  const pref = base.filter((x) => fallos.has(x.id || x.base || x.plural || x.pasado));
  const bolsa = pref.length ? pref : base;
  const item = bolsa[Math.floor(rnd() * bolsa.length)];
  usadas.add(idDe(item));
  return item;
}

function basePuerta(tipo, nivel, estructura, lectura) {
  return { tipo, nivel, estructura, lectura, espera: true };
}

export function crearTaller(nivel, rnd, usadas, fallos) {
  const cajas = nivel < 2 ? ["noun", "verb"] : ["noun", "verb", "adjective"];
  const roll = rnd();
  let categoria = "noun";
  if (nivel < 2) categoria = roll < 0.5 ? "noun" : "verb";
  else if (roll < 0.34) categoria = "noun";
  else if (roll < 0.67) categoria = "verb";
  else categoria = "adjective";

  let marco = null;
  let item;
  if (categoria === "adjective") {
    item = tomar(ADJETIVOS, rnd, usadas, fallos);
  } else {
    const amb = rnd();
    const quiere = categoria === "verb" ? amb < 0.5 : amb < 0.4;
    if (quiere) {
      item = tomar(AMBIGUA, rnd, usadas, fallos);
      marco = categoria === "verb" ? "can" : "a";
    } else if (categoria === "verb") item = tomar(VERBOS, rnd, usadas, fallos);
    else item = tomar(SUSTANTIVOS, rnd, usadas, fallos);
  }

  const estructura = marco === "a" ? "marco-a" : marco === "can" ? "marco-can" : "suelta";
  const lectura = marco === "a" ? ["a", item.id] : marco === "can" ? ["I", "can", item.id] : [item.id];
  return {
    ...basePuerta("taller", nivel, estructura, lectura),
    palabra: item.id,
    categoria,
    marco,
    dibujo: item.dibujo,
    copias: 1,
    cajas,
  };
}

function opcion(palabra, dibujo, copias) {
  return { palabra, dibujo, copias: copias || 1 };
}

function opciones(correcto, candidatos, rnd) {
  const malos = [];
  const vistos = new Set([correcto.palabra]);
  for (const c of revolver(rnd, candidatos)) {
    if (vistos.has(c.palabra)) continue;
    if (tambienCorrecta(correcto.palabra, c.palabra)) continue;
    vistos.add(c.palabra);
    malos.push(c);
    if (malos.length === 2) break;
  }
  return revolver(rnd, [correcto, ...malos]);
}

function poolPlural(items) {
  return items.map((p) => opcion(p.plural, p.dibujo, p.copias));
}

export function crearLaberinto(nivel, rnd, usadas, fallos) {
  if (nivel >= 7) return laberintoEse(rnd, usadas, fallos);
  if (nivel === 6) return laberintoPasado(PASADOS_IRR, "ayer-irr", rnd, usadas, fallos, nivel);
  if (nivel === 5) return laberintoPasado(PASADOS_ED, "ayer", rnd, usadas, fallos, nivel);
  if (nivel === 4) return laberintoPlural4(rnd, usadas, fallos);
  return laberintoRegular(rnd, usadas, fallos, nivel);
}

function laberintoRegular(rnd, usadas, fallos, nivel) {
  const lista = rnd() < 0.5 ? PLURALES_ES : PLURALES_S;
  const item = tomar(lista, rnd, usadas, fallos);
  const correcto = opcion(item.plural, item.dibujo, item.copias);
  const otros = poolPlural([...PLURALES_S, ...PLURALES_ES]).concat([
    opcion(item.base, item.dibujo, 1),
  ]);
  const lectura = ["I", "see", "two", item.plural];
  return {
    ...basePuerta("laberinto", nivel, "two-see", lectura),
    hueco: 3,
    respuesta: item.plural,
    opciones: opciones(correcto, otros, rnd),
    dibujo: item.dibujo,
    copias: item.copias,
    premio: item.premio,
    sonido: item.clase === "es" ? "es" : null,
  };
}

function laberintoPlural4(rnd, usadas, fallos) {
  const irregular = rnd() < 0.65;
  if (irregular) {
    const item = tomar(PLURALES_IRR, rnd, usadas, fallos);
    const correcto = opcion(item.plural, item.dibujo, item.copias);
    const otros = poolPlural(PLURALES_IRR).concat(poolPlural(PLURALES_S));
    const lectura = ["Two", item.plural, "can", "run"];
    return {
      ...basePuerta("laberinto", 4, "two-can", lectura),
      hueco: 1,
      respuesta: item.plural,
      opciones: opciones(correcto, otros, rnd),
      dibujo: item.dibujo,
      copias: item.copias,
      premio: item.premio,
    };
  }
  const item = tomar([...PLURALES_S, ...PLURALES_ES], rnd, usadas, fallos);
  const correcto = opcion(item.plural, item.dibujo, item.copias);
  const otros = poolPlural([...PLURALES_S, ...PLURALES_ES]).concat([opcion(item.base, item.dibujo, 1)]);
  return {
    ...basePuerta("laberinto", 4, "two-see", ["I", "see", "two", item.plural]),
    hueco: 3,
    respuesta: item.plural,
    opciones: opciones(correcto, otros, rnd),
    dibujo: item.dibujo,
    copias: item.copias,
    premio: item.premio,
    sonido: item.clase === "es" ? "es" : null,
  };
}

function laberintoPasado(lista, estructura, rnd, usadas, fallos, nivel) {
  const item = tomar(lista, rnd, usadas, fallos);
  const correcto = opcion(item.pasado, item.dibujo, 1);
  const otros = lista.map((p) => opcion(p.pasado, p.dibujo, 1));
  return {
    ...basePuerta("laberinto", nivel, estructura, ["Yesterday", "I", item.pasado]),
    hueco: 2,
    respuesta: item.pasado,
    opciones: opciones(correcto, otros, rnd),
    dibujo: item.dibujo,
    copias: 1,
    sonido: item.sonido,
    premio: null,
  };
}

function conId(lista, id) {
  return lista.map((o) => ({ ...o, id: id(o) }));
}

function laberintoEse(rnd, usadas, fallos) {
  const item = tomar(conId(ORACIONES, (o) => o.verbo), rnd, usadas, fallos);
  const correcto = opcion(item.verbo, item.dibujo, 1);
  const otros = ORACIONES.map((o) => opcion(o.verbo, o.dibujo, 1)).concat([
    opcion(item.base, item.dibujo, 1),
  ]);
  return {
    ...basePuerta("laberinto", 7, "el-salta", ["The", "robot", item.verbo]),
    hueco: 2,
    respuesta: item.verbo,
    opciones: opciones(correcto, otros, rnd),
    dibujo: item.dibujo,
    copias: 1,
    ensenar: `The robot ${item.verbo}`,
    premio: null,
  };
}

export function crearOracion(nivel, rnd, usadas, fallos) {
  const item = tomar(conId(ORACIONES, (o) => o.verbo), rnd, usadas, fallos);
  const meta = ["The", item.adj, "robot", item.verbo];
  const alReves = ["The", "robot", item.adj, item.verbo];
  const fichas = revolver(rnd, [
    { palabra: "The", dibujo: null },
    { palabra: item.adj, dibujo: item.dibujoAdj },
    { palabra: "robot", dibujo: null },
    { palabra: item.verbo, dibujo: item.dibujo },
    { palabra: item.base, dibujo: item.dibujo },
  ]);
  return {
    ...basePuerta("oracion", nivel, "oracion", meta),
    meta,
    alReves,
    fichas,
    adjetivo: item.adj,
    verbo: item.verbo,
    dibujo: item.dibujo,
    ensenar: "The robot jumps",
  };
}

export function crearPuerta(nivel, tipo, rnd, usadas, fallos) {
  if (tipo === "oracion") return crearOracion(nivel, rnd, usadas, fallos);
  if (tipo === "laberinto") return crearLaberinto(nivel, rnd, usadas, fallos);
  return crearTaller(nivel, rnd, usadas, fallos);
}

export function generarTurno(nivel, rnd, fallos) {
  const n = Math.max(1, Math.min(7, nivel | 0));
  const usados = new Set();
  const vistos = fallos instanceof Set ? fallos : new Set(fallos || []);
  return revolver(rnd, PLAN[n]).map((tipo) => crearPuerta(n, tipo, rnd, usados, vistos));
}

export function palabrasVisibles(puerta) {
  return (puerta.lectura || []).filter(Boolean);
}

export function problemas(puerta) {
  const nivel = puerta.nivel;
  const errs = [];
  const palabras = palabrasVisibles(puerta);
  if (!palabras.length || palabras.length > 6) errs.push("larga");
  const pasados = formasPasado();
  const irregulares = formasPasadoIrregular();
  if (nivel < 5 && palabras.some((w) => pasados.has(w))) errs.push("pasado");
  if (nivel < 6 && palabras.some((w) => irregulares.has(w))) errs.push("pasado-irr");
  if (nivel < 7 && palabras.some((w) => TERCERA.has(w))) errs.push("tercera");
  const est = ESTRUCTURAS[puerta.estructura];
  if (!est || est.min > nivel) errs.push("estructura");
  if (puerta.espera !== true || puerta.limiteMs != null) errs.push("banda");
  if (puerta.tipo === "taller") {
    if (AMBIGUAS.includes(puerta.palabra)) {
      if (puerta.marco !== "a" && puerta.marco !== "can") errs.push("ambigua");
      if (puerta.marco === "a" && puerta.categoria !== "noun") errs.push("marco");
      if (puerta.marco === "can" && puerta.categoria !== "verb") errs.push("marco");
    } else if (puerta.marco) errs.push("marco-de-mas");
    if (nivel < 2 && puerta.categoria === "adjective") errs.push("adjetivo");
    if (puerta.cajas.length !== (nivel < 2 ? 2 : 3)) errs.push("cajas");
  }
  if (puerta.tipo === "laberinto") {
    if (AMBIGUAS.includes(puerta.respuesta)) errs.push("ambigua");
    const ops = puerta.opciones.map((o) => o.palabra);
    if (new Set(ops).size !== ops.length || !ops.includes(puerta.respuesta)) errs.push("opciones");
    if (ops.some((o) => o !== puerta.respuesta && tambienCorrecta(puerta.respuesta, o))) errs.push("trampa");
    if (ops.includes("fishes") || ops.includes("sheeps")) errs.push("fish");
  }
  if (puerta.tipo === "oracion") {
    if (puerta.meta.join(" ") !== `The ${puerta.adjetivo} robot ${puerta.verbo}`) errs.push("meta");
    if (puerta.alReves.join(" ") !== `The robot ${puerta.adjetivo} ${puerta.verbo}`) errs.push("reves");
    if (!TERCERA.has(puerta.verbo)) errs.push("ese");
  }
  if (nivel === 4 && puerta.tipo === "laberinto") {
    const s = palabras.join(" ");
    if (!/^Two \S+ can run$/.test(s) && !/^I see two \S+$/.test(s)) errs.push("molde");
  }
  return errs;
}

export function efectoOracion(puestas, puerta) {
  const palabras = puestas.map((f) => (typeof f === "string" ? f : f.palabra));
  if (igual(palabras, puerta.meta)) return "actua";
  if (igual(palabras, puerta.alReves)) return "risa";
  const verbos = new Set([puerta.verbo, puerta.verbo.replace(/s$/, "")]);
  if (!palabras.some((w) => verbos.has(w))) return "duda";
  return "mal";
}

export function probarBrilla(puestas, puerta) {
  return efectoOracion(puestas, puerta) === "actua";
}

export function quitarUltima(puestas) {
  return puestas.slice(0, -1);
}

function igual(a, b) {
  return a.length === b.length && a.every((w, i) => w === b[i]);
}
