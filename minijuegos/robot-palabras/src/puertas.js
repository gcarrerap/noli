// Un turno son 6 puertas. Taller, laberinto y oración son tipos de puerta.
// La banda espera: ninguna puerta trae reloj.
// Las oraciones no usan estructuras de niveles cerrados.
import { revolver } from "./rng.js";
import {
  AMBIGUAS, SUSTANTIVOS, VERBOS, ADJETIVOS,
  PLURALES_S, PLURALES_ES, PLURALES_IRR,
  PASADOS_ED, PASADOS_IRR, ORACIONES,
  TERCERA, tambienCorrecta, formasPasado, formasPasadoIrregular,
  conArticulo, terceraDe, pasadoDe, gerundioDe,
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
    }     else if (categoria === "verb") item = tomar(VERBOS, rnd, usadas, fallos);
    else item = tomar(SUSTANTIVOS, rnd, usadas, fallos);
  }
  if (categoria === "noun" && item.id === "fish") marco = "a";

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

export function crearLaberinto(nivel, rnd, usadas, fallos) {
  if (nivel >= 7) return laberintoEse(rnd, usadas, fallos);
  if (nivel === 6) return laberintoPasado(PASADOS_IRR, "ayer-irr", rnd, usadas, fallos, nivel);
  if (nivel === 5) return laberintoPasado(PASADOS_ED, "ayer", rnd, usadas, fallos, nivel);
  if (nivel === 4) return laberintoPlural4(rnd, usadas, fallos);
  return laberintoRegular(rnd, usadas, fallos, nivel);
}

function formasPlural(item) {
  const formas = [
    opcion(item.plural, item.dibujo, item.copias),
    opcion(conArticulo(item.base), item.dibujo, 1),
  ];
  if (item.base !== item.plural) formas.push(opcion(item.base, item.dibujo, 1));
  else formas.push(opcion(`the ${item.base}`, item.dibujo, 1));
  return formas;
}

function formasVerbo(base, buena, dibujo) {
  const tercera = terceraDe(base);
  const pasado = pasadoDe(base);
  return [
    opcion(buena, dibujo, 1),
    opcion(base, dibujo, 1),
    opcion(buena === pasado ? tercera : pasado, dibujo, 1),
  ];
}

function armarLaberinto(nivel, estructura, item, lectura, hueco, formas, rnd, extra) {
  const respuesta = item.plural || item.pasado || item.verbo;
  const correcto = formas.find((f) => f.palabra === respuesta) || formas[0];
  const otros = formas.filter((f) => f.palabra !== respuesta);
  return {
    ...basePuerta("laberinto", nivel, estructura, lectura),
    hueco,
    respuesta,
    base: item.base,
    clase: item.clase || "",
    glosa: item.glosa || "",
    opciones: opciones(correcto, otros, rnd),
    familia: formas.map((f) => f.palabra),
    dibujo: item.dibujo,
    copias: item.copias || 1,
    premio: extra.premio ?? null,
    sonido: extra.sonido ?? null,
  };
}

const SE_VEN = new Set(["tooth", "foot", "fish"]);

export function puertaPlural(item, nivel, rnd = Math.random) {
  const corre = item.clase === "irregular" && nivel >= 4 && !SE_VEN.has(item.base);
  const estructura = corre ? "two-can" : "two-see";
  const lectura = estructura === "two-can"
    ? ["Two", item.plural, "can", "run"]
    : ["I", "see", "two", item.plural];
  return armarLaberinto(nivel, estructura, item, lectura, estructura === "two-can" ? 1 : 3, formasPlural(item), rnd, {
    premio: item.premio,
    sonido: item.clase === "es" ? "es" : null,
  });
}

export function puertaPasado(item, nivel, rnd = Math.random) {
  const estructura = item.sonido ? "ayer" : "ayer-irr";
  return armarLaberinto(nivel, estructura, item, ["Yesterday", "I", item.pasado], 2, formasVerbo(item.base, item.pasado, item.dibujo), rnd, {
    premio: null,
    sonido: item.sonido,
  });
}

export function puertaRobot(item, rnd = Math.random) {
  const formas = [
    opcion(item.verbo, item.dibujo, 1),
    opcion(item.base, item.dibujo, 1),
    opcion(gerundioDe(item.base), item.dibujo, 1),
  ];
  return armarLaberinto(7, "el-salta", { ...item, pasado: item.verbo, clase: "s" }, ["The", "robot", item.verbo], 2, formas, rnd, {
    premio: null,
    sonido: null,
  });
}

function laberintoRegular(rnd, usadas, fallos, nivel) {
  const lista = rnd() < 0.5 ? PLURALES_ES : PLURALES_S;
  return puertaPlural(tomar(lista, rnd, usadas, fallos), nivel, rnd);
}

function laberintoPlural4(rnd, usadas, fallos) {
  const irregular = rnd() < 0.65;
  const lista = irregular ? PLURALES_IRR : [...PLURALES_S, ...PLURALES_ES];
  return puertaPlural(tomar(lista, rnd, usadas, fallos), 4, rnd);
}

function laberintoPasado(lista, _estructura, rnd, usadas, fallos, nivel) {
  return puertaPasado(tomar(lista, rnd, usadas, fallos), nivel, rnd);
}

function conId(lista, id) {
  return lista.map((o) => ({ ...o, id: id(o) }));
}

function laberintoEse(rnd, usadas, fallos) {
  const item = tomar(conId(ORACIONES, (o) => o.verbo), rnd, usadas, fallos);
  const puerta = puertaRobot(item, rnd);
  return { ...puerta, ensenar: `The robot ${item.verbo}` };
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
    base: item.base,
    dibujo: item.dibujo,
    copias: 1,
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
    } else if (puerta.palabra === "fish") {
      if (puerta.marco !== "a" || puerta.categoria !== "noun") errs.push("fish-suelto");
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
    if (!puerta.dibujo) errs.push("dibujo");
    const familia = new Set(puerta.familia || []);
    if (familia.size && ops.some((o) => !familia.has(o))) errs.push("familia");
    if (buenasDe(puerta).length !== 1) errs.push("unica");
    const pausa = fraseConPausa(puerta).split(/\s+/);
    if (!pausa.includes("mm")) errs.push("pausa");
    if (pausa.includes(puerta.respuesta)) errs.push("dice-respuesta");
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

export function fraseConPausa(puerta) {
  const pals = puerta.lectura || [];
  if (puerta.hueco == null || puerta.hueco < 0) return pals.join(" ");
  const antes = pals.slice(0, puerta.hueco).join(" ");
  const despues = pals.slice(puerta.hueco + 1).join(" ");
  return [antes, "mm", despues].filter(Boolean).join(" ");
}

export function fraseCompleta(puerta) {
  return (puerta.lectura || []).join(" ");
}

export function buenasDe(puerta) {
  if (!puerta || puerta.tipo !== "laberinto") return [];
  const buena = puerta.respuesta;
  const pasado = puerta.estructura === "el-salta" ? pasadoDe(puerta.base) : "";
  return (puerta.opciones || [])
    .filter((o) => o.palabra === buena || tambienCorrecta(buena, o.palabra) || (pasado && o.palabra === pasado))
    .map((o) => o.palabra);
}

export function focoTrasFicha(fichas, puestas) {
  const usadas = new Set((puestas || []).map((f) => (f && typeof f === "object" ? f.i : -1)));
  const any = (fichas || []).findIndex((_, i) => !usadas.has(i));
  if (any >= 0) return `ficha-${any}`;
  return "probar";
}

export function focoSiguienteFicha(fichas, puestas, meta) {
  const usadas = new Set((puestas || []).map((f) => (f && typeof f === "object" ? f.i : -1)));
  const sig = (meta || [])[(puestas || []).length];
  const idx = (fichas || []).findIndex((f, i) => !usadas.has(i) && f.palabra === sig);
  if (idx >= 0) return `ficha-${idx}`;
  const any = (fichas || []).findIndex((_, i) => !usadas.has(i));
  if (any >= 0) return `ficha-${any}`;
  return "probar";
}

export function efectoOracion(puestas, puerta) {
  const palabras = puestas.map((f) => (typeof f === "string" ? f : f.palabra));
  if (igual(palabras, puerta.meta)) return "actua";
  const base = puerta.base || String(puerta.verbo || "").replace(/s$/, "");
  const metaBase = (puerta.meta || []).map((w, i) => (i === puerta.meta.length - 1 ? base : w));
  const revesBase = (puerta.alReves || []).map((w, i) => (i === puerta.alReves.length - 1 ? base : w));
  if (igual(palabras, puerta.alReves) || igual(palabras, revesBase)) return "risa";
  if (igual(palabras, metaBase)) return "falta-s";
  const verbos = new Set([puerta.verbo, base]);
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
