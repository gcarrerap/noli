// La puerta de Para papás: una multiplicación de una cifra, 6–9 × 6–9, con tres opciones.
// No se guarda: al cerrar el juego hay que volver a acertar.
// La respuesta buena no es siempre el número del medio: a veces las dos malas
// son más altas, a veces más bajas, y el orden en pantalla se baraja.

export const PAPAS_QUIETO_MS = 1500;
export const PAPAS_CIERRE_MS = 30000;
export const PAPAS_ACIERTOS = 2;
export const PAPAS_FALLOS = 2;

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
 * Un toque en una opción.
 * Durante 1,5 s después de que aparece la pregunta (y después de cada toque
 * que llega antes) la respuesta no cuenta: la espera vuelve a empezar, así
 * una ráfaga no alcanza a acertar.
 * Hacen falta 2 aciertos seguidos, cada uno con otra pregunta.
 * A los 2 fallos la puerta descansa 30 s y el foco vuelve a Volver.
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
} = {}) {
  const t = Number(ahora) || 0;
  const desde = Number(aceptaDesde) || 0;
  const cerrado = Number(cerradoHasta) || 0;
  const racha = Number(seguidas) || 0;
  const malas = Number(fallos) || 0;
  const quieto = {
    abre: false,
    seguidas: racha,
    fallos: malas,
    aceptaDesde: desde,
    cerradoHasta: cerrado,
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
      const hasta = t + PAPAS_CIERRE_MS;
      return {
        abre: false,
        seguidas: 0,
        fallos: 0,
        aceptaDesde: hasta,
        cerradoHasta: hasta,
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
