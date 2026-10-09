// Filas van horizontales (misma y). Columnas van verticales (misma x).
// El tope es 5×5. No se arrastra: se suma o se quita.

export const BANDEJA_MAX = 5;
export const BANDEJA_MIN = 1;

export function ajustar(valor, dir, max = BANDEJA_MAX) {
  const n = (valor | 0) + (dir | 0);
  return Math.max(BANDEJA_MIN, Math.min(max, n));
}

export function celdas(filas, columnas) {
  const out = [];
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < columnas; c++) out.push({ f, c, x: c, y: f });
  }
  return out;
}

export function totalBandeja(filas, columnas) {
  return (filas | 0) * (columnas | 0);
}

// Conteo fila por fila: 3 filas de 4 → 4, 8, 12. 3 de 3 → 3, 6, 9.
export function cuentaFilas(filas, columnas) {
  return Array.from({ length: filas | 0 }, (_, i) => (i + 1) * (columnas | 0));
}

export function tamanoBandeja(rnd, facil) {
  const max = facil ? 3 : BANDEJA_MAX;
  const filas = 2 + Math.floor(rnd() * (max - 1));
  const columnas = 2 + Math.floor(rnd() * (max - 1));
  return { filas, columnas };
}

export function opcionesCuantos(filas, columnas, rnd) {
  const bien = totalBandeja(filas, columnas);
  const suma = filas + columnas;
  const candidatos = [suma, bien + filas, Math.max(1, bien - columnas), bien + 1, bien - 1];
  const malos = [];
  for (const n of candidatos) {
    if (n > 0 && n !== bien && n <= 30 && !malos.includes(n)) malos.push(n);
    if (malos.length === 2) break;
  }
  while (malos.length < 2) malos.push(bien + malos.length + 3);
  const lista = [bien, malos[0], malos[1]];
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}

// Cuando un contador llega a su meta, el foco pasa al siguiente control.
// Nunca a Saltar. Listo solo cuando filas y columnas ya coinciden.
export function focoTrasContador(cual, hecho, pedido) {
  const filas = hecho && hecho.filas | 0;
  const columnas = hecho && hecho.columnas | 0;
  const filasOk = filas === (pedido && pedido.filas | 0);
  const colOk = columnas === (pedido && pedido.columnas | 0);
  if (filasOk && colOk) return "listo";
  if (cual === "filas" && filasOk) return "columnas";
  if (cual === "columnas" && colOk) return "filas";
  return cual === "columnas" ? "columnas" : "filas";
}

export function bandejaLista(filas, columnas, pedido) {
  return filas === pedido.filas && columnas === pedido.columnas;
}
