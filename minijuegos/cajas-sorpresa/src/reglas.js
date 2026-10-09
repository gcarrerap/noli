// Los números de la economía viven en datos/reglas.json.
// Aquí solo están los topes fijos y el normalizador. Sin await al cargar el módulo.

export const RAREZAS = ["comun", "rara", "ultra"];
export const LIMITE_MIN = 0;
export const LIMITE_MAX = 4;
export const HISTORIAL_MAX = 60;

function numero(v, nombre) {
  const x = Number(v);
  if (!Number.isFinite(x)) throw new Error("regla " + nombre);
  return x;
}

function grupo(raw, claves, nombre) {
  const o = raw && typeof raw === "object" ? raw : {};
  const out = {};
  for (const c of claves) out[c] = numero(o[c], nombre + "." + c);
  return out;
}

/** Comprueba el JSON de la economía y devuelve un objeto plano. */
export function normalizarReglas(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    costoCaja: numero(r.costoCaja, "costoCaja"),
    limiteDiario: numero(r.limiteDiario, "limiteDiario"),
    piezas: grupo(r.piezas, RAREZAS, "piezas"),
    pesos: grupo(r.pesos, RAREZAS, "pesos"),
    garantiaRara: numero(r.garantiaRara, "garantiaRara"),
    garantiaUltra: numero(r.garantiaUltra, "garantiaUltra"),
    sinRepetir: numero(r.sinRepetir, "sinRepetir"),
    polvoDuplicado: grupo(r.polvoDuplicado, RAREZAS, "polvoDuplicado"),
    polvoPrecio: grupo(r.polvoPrecio, RAREZAS, "polvoPrecio"),
  };
}
