// Ordenar tarjetas sin arrastrar: se toma una y se pone en un hueco.
// Se califica por id, así dos tarjetas con el mismo texto no se confunden.

export function ordenNuevo(ids, mazo) {
  return {
    meta: [...ids],
    mazo: [...(mazo || ids)],
    huecos: ids.map(() => null),
    tomada: null,
    origen: null,
    cambios: 0,
    errores: 0,
  };
}

export function tomar(estado, id) {
  if (!estado || estado.tomada) return estado;
  const enMazo = estado.mazo.indexOf(id);
  if (enMazo >= 0) {
    const mazo = estado.mazo.slice();
    mazo.splice(enMazo, 1);
    return { ...estado, mazo, tomada: id, origen: { tipo: "mazo" } };
  }
  const i = estado.huecos.indexOf(id);
  if (i >= 0) {
    const huecos = estado.huecos.slice();
    huecos[i] = null;
    return { ...estado, huecos, tomada: id, origen: { tipo: "hueco", i } };
  }
  return estado;
}

// Soltar siempre devuelve la tarjeta al montón, también si salió de un hueco.
export function soltar(estado) {
  if (!estado?.tomada) return estado;
  return { ...estado, mazo: [...estado.mazo, estado.tomada], tomada: null, origen: null };
}

// Huecos llenos primero y después el montón: el mismo orden que el resaltado.
export function idsEnLectura(estado) {
  if (!estado) return [];
  return [...(estado.huecos || []).filter(Boolean), ...(estado.mazo || [])];
}

export function poner(estado, slot) {
  if (!estado?.tomada) return estado;
  if (slot < 0 || slot >= estado.huecos.length) return estado;
  const huecos = estado.huecos.slice();
  const ocupante = huecos[slot];
  huecos[slot] = estado.tomada;
  const mazo = ocupante ? [...estado.mazo, ocupante] : estado.mazo;
  const correcto = estado.meta[slot] === estado.tomada;
  return {
    ...estado,
    huecos,
    mazo,
    tomada: null,
    origen: null,
    cambios: estado.cambios + 1,
    errores: estado.errores + (correcto ? 0 : 1),
  };
}

// Al tomar, el foco va al primer hueco vacío. Si no hay, a Soltar.
// No usa el hueco de la pista: ese puede estar ocupado y el foco se cae a Escuchar.
export function focoTrasTomar(estado) {
  if (!estado) return "soltar";
  if (estado.tomada) {
    const vacio = (estado.huecos || []).findIndex((h) => !h);
    return vacio >= 0 ? `hueco-${vacio}` : "soltar";
  }
  const id = (estado.mazo || [])[0];
  return id ? `tarjeta-${id}` : "soltar";
}

export function estaCompleto(estado) {
  if (!estado) return false;
  return estado.huecos.every((id, i) => id === estado.meta[i]);
}

// La siguiente tarjeta que todavía no está en su hueco.
export function siguienteTarjeta(estado) {
  if (!estado) return null;
  const slot = estado.huecos.findIndex((id, i) => id !== estado.meta[i]);
  if (slot < 0) return null;
  return { slot, id: estado.meta[slot] };
}

// Si reacomoda de más, o vio el paso completo (desde el nivel 2), no es a la primera.
export function cuentaPrimeraOrden({ nivel, vioCompleta, cambios, errores, tarjetas, acerto }) {
  if (!acerto) return false;
  if ((nivel | 0) > 1 && vioCompleta) return false;
  if ((errores | 0) > 0) return false;
  if ((cambios | 0) > (tarjetas | 0)) return false;
  return true;
}
