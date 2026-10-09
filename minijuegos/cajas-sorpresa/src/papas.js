// La puerta de Para papás: una multiplicación de una cifra, 6–9 × 6–9, con tres opciones.
// El acierto no se guarda: al salir hay que volver a esperar y a acertar.
// El descanso sí se guarda, y crece: 30 s, luego 2 min, luego 5 min.
// La respuesta buena no es siempre el número del medio: a veces las dos malas
// son más altas, a veces más bajas, y el orden en pantalla se baraja.

export const PAPAS_QUIETO_MS = 1500;
export const PAPAS_CIERRE_MS = 30000;
export const PAPAS_DESCANSOS_MS = [30000, 120000, 300000];
export const PAPAS_ACIERTOS = 2;
export const PAPAS_FALLOS = 2;

/** 30 s la primera vez, 2 min la segunda, 5 min de ahí en adelante. */
export function plazoDescanso(nivel) {
  const i = Math.max(0, Math.floor(Number(nivel) || 0));
  const tope = PAPAS_DESCANSOS_MS.length - 1;
  return PAPAS_DESCANSOS_MS[Math.min(i, tope)];
}

function barajar(lista, rng) {
  const a = lista.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

function cercano(r, delta, usados) {
  const paso = delta >= 0 ? 1 : -1;
  let n = r + delta;
  let guard = 0;
  while ((n === r || n <= 0 || usados.has(n)) && guard < 40) {
    n += paso;
    if (n <= 0) n = r + guard + 2;
    guard += 1;
  }
  usados.add(n);
  return n;
}

export function preguntaPapas(rng) {
  const a = 6 + Math.floor(rng() * 4);
  const b = 6 + Math.floor(rng() * 4);
  const r = a * b;
  const modo = Math.floor(rng() * 3);
  const d1 = 2 + Math.floor(rng() * 7);
  const d2 = 2 + Math.floor(rng() * 7);
  const usados = new Set([r]);
  let malos;
  if (modo === 0) malos = [cercano(r, d1, usados), cercano(r, d1 + d2, usados)];
  else if (modo === 1) malos = [cercano(r, -d1, usados), cercano(r, -(d1 + d2), usados)];
  else malos = [cercano(r, d1, usados), cercano(r, -d2, usados)];
  return { a, b, r, opciones: barajar([r, malos[0], malos[1]], rng) };
}

export function aciertoPapas(pregunta, valor) {
  return !!pregunta && Number(valor) === pregunta.r;
}

/**
 * Cada vez que se entra a la puerta, la racha vuelve a cero y la espera
 * cuenta desde ahora, no desde la visita anterior. El tiempo en la tienda
 * no sirve de espera.
 */
export function entrarPuerta({ ahora, aceptaDesde = 0, abierta = false, seguidas = 0 } = {}) {
  const desde = Number(aceptaDesde) || 0;
  const racha = Number(seguidas) || 0;
  if (abierta) return { seguidas: racha, aceptaDesde: desde, aviso: "" };
  const t = Number(ahora) || 0;
  return { seguidas: 0, aceptaDesde: Math.max(desde, t + PAPAS_QUIETO_MS), aviso: "" };
}

/** Volver también borra la racha y la espera. El descanso no se borra. */
export function salirPuerta() {
  return { seguidas: 0, aceptaDesde: 0, aviso: "" };
}

/**
 * Una flecha, un OK o un toque fuera de una respuesta reinicia la espera.
 * Una respuesta solo cuenta si la espera ya se cumplió.
 */
export function pulsoPuerta({ ahora, aceptaDesde = 0, cuenta = false } = {}) {
  const t = Number(ahora) || 0;
  const desde = Number(aceptaDesde) || 0;
  if (cuenta && t >= desde) return { aceptaDesde: desde, cuenta: true };
  return { aceptaDesde: Math.max(desde, t + PAPAS_QUIETO_MS), cuenta: false };
}

/**
 * Un toque en una opción.
 * Durante 1,5 s después de que aparece la pregunta (y después de cada toque
 * que llega antes) la respuesta no cuenta: la espera vuelve a empezar, así
 * una ráfaga no alcanza a acertar.
 * Hacen falta 2 aciertos seguidos, cada uno con otra pregunta.
 * A los 2 fallos la puerta descansa, cada vez más, y el foco vuelve a Volver.
 * Entrar de verdad pone la escalada otra vez en cero.
 */
export function responderPapas({
  ahora,
  valor,
  pregunta,
  enOpcion = false,
  seguidas = 0,
  fallos = 0,
  aceptaDesde = 0,
  cerradoHasta = 0,
  escalada = 0,
} = {}) {
  const t = Number(ahora) || 0;
  const desde = Number(aceptaDesde) || 0;
  const cerrado = Number(cerradoHasta) || 0;
  const racha = Number(seguidas) || 0;
  const malas = Number(fallos) || 0;
  const nivel = Math.max(0, Math.floor(Number(escalada) || 0));
  const quieto = {
    abre: false,
    seguidas: racha,
    fallos: malas,
    aceptaDesde: desde,
    cerradoHasta: cerrado,
    escalada: nivel,
    nueva: false,
    foco: "volver",
    aviso: "",
  };
  if (cerrado && t < cerrado) return { ...quieto, aviso: "descanso" };
  if (!enOpcion) return quieto;
  if (t < desde) return { ...quieto, aceptaDesde: t + PAPAS_QUIETO_MS };
  if (!aciertoPapas(pregunta, valor)) {
    const f = malas + 1;
    if (f >= PAPAS_FALLOS) {
      const hasta = t + plazoDescanso(nivel);
      return {
        abre: false,
        seguidas: 0,
        fallos: 0,
        aceptaDesde: hasta,
        cerradoHasta: hasta,
        escalada: nivel + 1,
        nueva: false,
        foco: "volver",
        aviso: "descanso",
      };
    }
    return {
      abre: false,
      seguidas: 0,
      fallos: f,
      aceptaDesde: t + PAPAS_QUIETO_MS,
      cerradoHasta: 0,
      escalada: nivel,
      nueva: true,
      foco: "volver",
      aviso: "fallo",
    };
  }
  const s = racha + 1;
  if (s >= PAPAS_ACIERTOS) {
    return {
      abre: true,
      seguidas: s,
      fallos: 0,
      aceptaDesde: desde,
      cerradoHasta: 0,
      escalada: 0,
      nueva: false,
      foco: "menos",
      aviso: "",
    };
  }
  return {
    abre: false,
    seguidas: s,
    fallos: 0,
    aceptaDesde: t + PAPAS_QUIETO_MS,
    cerradoHasta: 0,
    escalada: nivel,
    nueva: true,
    foco: "volver",
    aviso: "otra",
  };
}

/**
 * Un OK en la pregunta. El foco inicial no está en una opción, así que el OK
 * repetido no elige. Si el foco sí está en una opción, valen las mismas reglas
 * que un toque: espera, dos aciertos y el descanso.
 */
export function pulsoPapas({
  ahora,
  foco = "",
  valor,
  pregunta,
  hasta = 0,
  seguidas = 0,
  fallos = 0,
  aceptaDesde = 0,
  cerradoHasta = 0,
} = {}) {
  const t = Number(ahora) || 0;
  const plazo = Number(hasta) || 0;
  const base = { seguidas, fallos, aceptaDesde, cerradoHasta, nueva: false, foco: "volver", aviso: "" };
  if (t < plazo || foco !== "opcion") return { abre: false, hasta: plazo, ...base };
  const r = responderPapas({
    ahora: t,
    valor,
    pregunta,
    enOpcion: true,
    seguidas,
    fallos,
    aceptaDesde,
    cerradoHasta,
  });
  return { ...r, hasta: plazo };
}
