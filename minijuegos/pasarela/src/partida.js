// La partida como máquina de estados. Lógica pura: dice a qué pantalla se pasa con cada evento; la interfaz
// (src/ui/juego.js) dibuja la pantalla y hace lo que cada estado pide (cobrar, caminar, desfilar…).
// Diagrama y explicación: docs/ARQUITECTURA.md.
//
//   inicio ──jugar──▶ cobrando ──cobrado──▶ tema ──listo──▶ estudio ──pasarela | tiempo──▶ pasarela ──fin──▶ calificacion
//     │  ▲                │                                    │                                             │
//     │  │           sin-creditos ──▶ faltan ──libre──▶ libre  │                                          continuar
//     │  │                              │                │      │                                             ▼
//     │  └──────────────salir────────── ┴ ───────salir── ┘ ◀─salir (pregunta)            (desbloqueo) ──▶ inicio
//     └──libre──▶ libre       └──closet──▶ closet ──salir──▶ inicio

/** Estados y a dónde lleva cada evento */
export const TRANSICIONES = {
  inicio:       { jugar: "cobrando", libre: "libre", closet: "closet" },
  cobrando:     { cobrado: "tema", "sin-creditos": "faltan", error: "inicio" },
  faltan:       { libre: "libre", salir: "inicio" },
  tema:         { listo: "estudio" },
  estudio:      { pasarela: "pasarela", tiempo: "pasarela", salir: "inicio" },
  libre:        { salir: "inicio" },
  pasarela:     { fin: "calificacion" },
  calificacion: { continuar: "desbloqueo", "sin-desbloqueo": "inicio" },
  desbloqueo:   { continuar: "inicio" },
  closet:       { salir: "inicio" },
};

/** Estados en los que el personaje está en el estudio (se mueve y se viste) */
export const EN_ESTUDIO = ["estudio", "libre"];

/**
 * El estado que sigue. Un evento que no aplica deja el estado igual (así un doble toque no rompe nada).
 * @param {string} estado
 * @param {string} evento
 * @returns {string}
 */
export function siguiente(estado, evento) {
  const t = TRANSICIONES[estado];
  return (t && t[evento]) || estado;
}

/**
 * Segundos que quedan del estudio, nunca menos de 0.
 * @param {number} inicio ms en que empezó el estudio
 * @param {number} ahora ms
 * @param {number} duracion segundos (config.tiempoEstudio)
 */
export const quedan = (inicio, ahora, duracion) => Math.max(0, duracion - (ahora - inicio) / 1000);

/** "2:05" */
export function reloj(segundos) {
  const s = Math.ceil(segundos);
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}
