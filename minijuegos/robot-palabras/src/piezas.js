// Piezas nuevas en orden fijo, una por turno terminado.

export const ORDEN = [
  "ruedas-2",
  "cabeza-2",
  "antena-2",
  "cuerpo-2",
  "brazos-2",
  "piernas-1",
  "cabeza-3",
  "antena-3",
  "cuerpo-3",
  "brazos-3",
];

export const INICIAL = {
  base: "ruedas-1",
  brazos: "brazos-1",
  cuerpo: "cuerpo-1",
  cabeza: "cabeza-1",
  antena: "antena-1",
};

export function capaDe(id) {
  if (id.startsWith("piernas") || id.startsWith("ruedas")) return "base";
  return id.replace(/-\d+$/, "");
}

export function aspecto(piezas) {
  const a = { ...INICIAL };
  for (const id of piezas || []) a[capaDe(id)] = id;
  return a;
}

export function sumarPieza(piezas) {
  const lista = piezas || [];
  if (lista.length >= ORDEN.length) return { piezas: lista, nueva: null };
  const nueva = ORDEN[lista.length];
  return { piezas: [...lista, nueva], nueva };
}
