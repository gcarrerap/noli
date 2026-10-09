// Guía fija de 2 partes iguales.
// Los pasos 0, 1 y 2 solo muestran algo: avanzan con cualquier toque, con OK,
// o solos cuando acaba la frase (al menos 2 s, nunca más de 3 s).
// El paso 3 es servir: solo avanza al pulsar la pizza igual. OK repetido no lo salta.
// Con «¿Salir?» abierto solo valen Seguir y Salir. El foco nunca cae en Saltar solo.
// En el paso 3 el foco está en la pizza igual, para que OK la sirva.

export const GUIA_TOQUE_MS = 2000;
export const GUIA_CIERRE_MS = 1000;
export const GUIA_TOPE_MS = 3000;
export const TRAS_GUIA_MS = 1000;
export const PASOS_GUIA = 4;

const MIRAR = [
  "Corta en 2 partes iguales.",
  "Esta no: una es más grande.",
  "Esta sí: las 2 son iguales.",
  "Tócala para servir.",
];

export function guiaAvanzaConToque(paso) {
  return paso === 0 || paso === 1 || paso === 2;
}

export function guiaServirActivo(paso) {
  return paso === 3;
}

// En los pasos de mirar el foco se queda en la frase.
// En servir cae en la pizza igual. Saltar no recibe el foco solo.
export function focoDeGuia(paso) {
  if (paso === 3) return "buena";
  return "pedido-guia";
}

export function textoDeGuia(paso, textos, modo = "tactil") {
  const i = Math.max(0, Math.min(MIRAR.length - 1, paso | 0));
  if (i === 3) {
    if (modo === "tv") return (textos && textos.guiaServirTv) || "Pulsa OK para servir.";
    const lista = textos && textos.guia;
    return (lista && lista[3]) || MIRAR[3];
  }
  const lista = (textos && textos.guia) || MIRAR;
  return lista[i] || MIRAR[i];
}

export function vozDeGuia(paso, textos, modo = "tactil") {
  return String(textoDeGuia(paso, textos, modo)).replace(/[▲▼+−½¼⅓⅔]/g, " ").replace(/\s+/g, " ").trim();
}

// Tras pintar un paso no entran OK ni toques: al menos 1 s, o hasta que
// acabe la frase, lo que dure más. A los 3 s se abre aunque la voz siga.
export function guiaBloqueada({ ahora = 0, aparecio = 0, vozSigue = false } = {}) {
  const t = ahora - aparecio;
  if (t < GUIA_CIERRE_MS) return true;
  if (t >= GUIA_TOPE_MS) return false;
  return !!vozSigue;
}

// «¿Salir?» pausa el paso. Al pulsar Seguir, el reloj y la espera de la voz
// empiezan de cero: el tiempo con el diálogo abierto no adelanta el paso.
export function reanudarPasoGuia({ ahora = 0, vozSigue = false } = {}) {
  return {
    desde: ahora,
    auto: siguienteAutoGuia({ transcurrido: 0, vozSigue }),
    bloqueada: guiaBloqueada({ ahora, aparecio: ahora, vozSigue }),
  };
}

// Un paso que solo se mira no se va a los 2 s si la frase sigue.
// Espera a que termine, con el mismo tope de 3 s. Si no hay voz, se queda 2 s.
export function siguienteAutoGuia({ transcurrido = 0, vozSigue = false } = {}) {
  const t = Number(transcurrido) || 0;
  if (t >= GUIA_TOPE_MS) return { avanzar: true, espera: 0 };
  if (!vozSigue && t >= GUIA_TOQUE_MS) return { avanzar: true, espera: 0 };
  const meta = vozSigue ? GUIA_TOPE_MS : GUIA_TOQUE_MS;
  return { avanzar: false, espera: Math.max(0, meta - t) };
}

// El primer pedido, justo después de la guía, no acepta respuesta el primer segundo.
export function pedidoBloqueado({ ahora = 0, desde = 0, trasGuia = false } = {}) {
  if (!trasGuia) return false;
  return ahora - desde < TRAS_GUIA_MS;
}

// Saltar pasa aunque el paso esté cerrado. Lo demás espera.
export function entradaGuia(paso, evento, estado) {
  if (evento && (evento.ir === "saltar-guia" || evento.tipo === "saltar")) return { paso, accion: "saltar" };
  if (guiaBloqueada(estado)) return { paso, accion: "nada" };
  const siguiente = siguientePasoGuia(paso, evento);
  if (siguiente === paso) return { paso, accion: "nada" };
  return { paso: siguiente, accion: "avanzo" };
}

export function entradaPedido(respuesta, estado) {
  if (pedidoBloqueado(estado)) return null;
  return respuesta;
}

// Con el diálogo abierto, Seguir y Salir no cambian el paso.
// Fuera de él, un paso de mirar avanza; servir se queda en «jugar».
export function toqueDuranteGuia(paso, { dialogoAbierto = false, ir = "" } = {}) {
  if (dialogoAbierto) {
    if (ir === "seguir-juego") return { accion: "seguir", paso };
    if (ir === "salir-juego") return { accion: "salir", paso };
    return { accion: "nada", paso };
  }
  if (ir === "saltar-guia") return { accion: "saltar", paso };
  if (guiaAvanzaConToque(paso)) return { accion: "avanzar", paso: paso + 1 };
  return { accion: "jugar", paso };
}

// evento: { tipo: "toque" | "ok" | "tiempo" | "activar", opcion?, repetido? }
// 4 significa que la guía terminó.
export function siguientePasoGuia(paso, evento) {
  if (!evento || evento.repetido) return paso;
  const tipo = evento.tipo;
  const op = evento.opcion;
  if (guiaAvanzaConToque(paso) && (tipo === "toque" || tipo === "ok" || tipo === "tiempo" || tipo === "activar")) {
    return paso + 1;
  }
  if (paso === 3 && tipo === "activar" && op === "buena") return 4;
  return paso;
}

export function guiaTerminada(paso) {
  return paso >= PASOS_GUIA;
}
