// Pistas del siguiente paso y cuándo se enseña el paso completo.
// El nivel 1 dice el paso entero desde el principio (ahí la habilidad es armar).
// Del 2 en adelante, la pista crece: una frase corta, luego una flecha, y al final el paso.
import { desdeNumero, puedeEnviar } from "./valor.js";
import { prestamos } from "./niveles.js";

export const IDLE_FLECHA_MS = 20000;
export const IDLE_COMPLETA_MS = 40000;

const NOMBRE = {
  c: ["placa", "placas"],
  d: ["barra", "barras"],
  u: ["cubito", "cubitos"],
};

// La primera banda que no coincide, de la más grande a la más chica.
// Si ya coincide, en el teléfono «Toca Enviar» y en la tele «Pulsa OK».
// Si hay una banda en 10, el paso es pegar.
export function siguientePaso(estado, objetivo, modo = "tactil") {
  const meta = desdeNumero(objetivo);
  for (const b of ["c", "d", "u"]) {
    if ((estado[b] || 0) === 10) {
      const que = NOMBRE[b][1];
      return { texto: fraseDiez(que, modo).voz, banda: b, listo: false, canje: "pegar" };
    }
  }
  if ((estado.mil || 0) !== (meta.mil || 0)) {
    return {
      texto: (estado.mil || 0) < (meta.mil || 0) ? "Pon el mil" : "Quita el mil",
      banda: "c", listo: false,
    };
  }
  for (const id of ["c", "d", "u"]) {
    const tiene = estado[id] || 0;
    const quiere = meta[id] || 0;
    if (tiene === quiere) continue;
    const n = Math.abs(quiere - tiene);
    const palabra = NOMBRE[id][n === 1 ? 0 : 1];
    return { texto: `${tiene < quiere ? "Pon" : "Quita"} ${n} ${palabra}`, banda: id, listo: false };
  }
  return { texto: modo === "tv" ? "Pulsa OK" : "Toca Enviar", banda: null, listo: true };
}

// El pedido, para llegar al número, obliga a pegar o a partir.
export function exigeCanje(pedido) {
  if (!pedido) return false;
  if (pedido.tipo === "sumar" && pedido.a != null && pedido.b != null) {
    const u = (pedido.a % 10) + (pedido.b % 10);
    const d = Math.floor(pedido.a / 10) % 10 + Math.floor(pedido.b / 10) % 10 + (u >= 10 ? 1 : 0);
    const c = Math.floor(pedido.a / 100) % 10 + Math.floor(pedido.b / 100) % 10 + (d >= 10 ? 1 : 0);
    return u >= 10 || d >= 10 || c >= 10;
  }
  if (pedido.tipo === "restar" && pedido.a != null && pedido.b != null) return prestamos(pedido.a, pedido.b).n > 0;
  if (pedido.tipo === "contar" && Array.isArray(pedido.secuencia) && pedido.secuencia.length) {
    const desde = pedido.secuencia[pedido.secuencia.length - 1];
    return Math.floor(desde / 10) !== Math.floor((pedido.objetivo || 0) / 10);
  }
  return pedido.objetivo === 1000;
}

// Hablar de pegar o partir solo si una banda está en 10 o el pedido de verdad reagrupa.
export function puedeHablarDeCanje(estado, pedido) {
  if (!puedeEnviar(estado)) return true;
  return exigeCanje(pedido);
}

export function glifoSubir(modo) {
  return modo === "tv" ? "▲" : "+";
}

// En el teléfono, «sube» es «toca +». En la tele es «pulsa ▲», y «Toca» no se dice.
// La voz de la tele dice «sube», sin el símbolo.
export function textoEnPantalla(texto, modo = "tactil") {
  const s = String(texto);
  if (modo === "tv") {
    return s
      .replaceAll("Toca Enviar", "Pulsa OK")
      .replaceAll("Toca la máquina", "Pulsa OK en la máquina")
      .replaceAll(" sube ", " pulsa ▲ ");
  }
  return s.replaceAll(" sube ", " toca + ");
}

function fraseDiez(que, modo) {
  const voz = modo === "tv"
    ? `¡10 ${que}! Pulsa OK en la máquina o sube otra vez.`
    : `¡10 ${que}! Toca la máquina o sube otra vez.`;
  return { voz, pantalla: textoEnPantalla(voz, modo) };
}

/** La frase del 10 ya está en la pista completa: el aviso de abajo no la repite. */
export function repetirAvisoDiez(info) {
  return !(info && info.fase === "completa" && info.paso && info.paso.canje === "pegar");
}

export function avisoDiez(banda, modo = "tactil") {
  const que = banda === "c" ? "placas" : banda === "d" ? "barras" : "cubitos";
  return fraseDiez(que, modo);
}

export function pistaCorta(nivel, modo = "tactil") {
  const n = nivel | 0;
  if (n <= 2) return `${glifoSubir(modo)} pon piezas`;
  if (n === 3) return "0 = banda vacía";
  if (n === 4) return "Escucha y arma";
  if (n === 5) return "Mira el número del camión";
  if (n === 6) return "Sigue el salto";
  if (n === 7) return "Junta piezas";
  return "Quita piezas";
}

// completa | flecha | corta | nada
export function fasePista({ nivel, primerDelNivel, ms, fallo }) {
  if ((nivel | 0) <= 1) return "completa";
  if (fallo || ms >= IDLE_COMPLETA_MS) return "completa";
  if (ms >= IDLE_FLECHA_MS) return "flecha";
  if (primerDelNivel) return "corta";
  return "nada";
}

// Ver el paso completo antes de enviar no cuenta como primer intento, salvo en el nivel 1,
// donde ese paso es la pista de siempre.
export function cuentaParaDominio({ nivel, vioPasoCompleto }) {
  if ((nivel | 0) <= 1) return true;
  return !vioPasoCompleto;
}

export function textoRomper(banda, estado) {
  if (banda === "u" && !(estado.d > 0) && (estado.c > 0 || estado.mil)) {
    return "Baja en las decenas: la máquina rompe una placa.";
  }
  if (banda === "d" && !(estado.c > 0) && estado.mil) {
    return "Baja en las centenas: la máquina rompe el mil.";
  }
  if (banda === "u" && !(estado.d > 0)) return "No hay piezas para quitar.";
  if (banda === "d" && !(estado.c > 0)) return "No hay piezas para quitar.";
  if (banda === "c" && !estado.mil) return "No hay piezas para quitar.";
  const pieza = banda === "u" ? "una barra" : banda === "d" ? "una placa" : "el mil";
  return `Baja otra vez: la máquina rompe ${pieza}.`;
}

// La primera vez de la sesión, o la siguiente después de fallar un pedido que reagrupa.
export function canjeEsLargo({ primeraVez, repetirPorFallo }) {
  return !!(primeraVez || repetirPorFallo);
}
