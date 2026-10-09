// Pistas por nivel. Desde el 2 salen en escalera: frase, flecha a los 20 s,
// paso completo a los 40 s o después de un error. La voz no lleva símbolos.
import { misma, hora12 } from "./reloj.js";
import { marcaLarga, vozNumero, PARTES, OPCIONES_CUANTO } from "./frases.js";

function escalera(t, a, b, c) {
  const base = { mostrarMinutos: false };
  if (t >= 40) return { ...base, ...c };
  if (t >= 20) return { ...base, ...b };
  return { ...base, ...a };
}

function destinoLarga(m) {
  const marca = marcaLarga(m);
  const num = marca.texto.replace(/^el /, "");
  const voz = marca.voz.replace(/^el /, "");
  return { texto: `al ${num}`, voz: `al ${voz}` };
}

function deltaHora(actual, objetivo) {
  let d = (hora12(objetivo.h) - hora12(actual.h) + 12) % 12;
  if (d === 0) return 0;
  if (d > 6) d -= 12;
  return d;
}

// Dirección que no cruza el 12: así la hora no se va a la anterior.
// De :00 a :45 se sube (la corta avanza hacia la hora siguiente).
function direccionMinutos(actual, objetivo) {
  if (actual.m === objetivo.m) return 0;
  return objetivo.m > actual.m ? 1 : -1;
}

function pasoCompleto(objetivo, actual, tv) {
  const sube = tv ? "▲" : "+";
  const baja = tv ? "▼" : "−";
  const dh = deltaHora(actual, objetivo);
  if (dh !== 0) {
    const n = hora12(objetivo.h);
    const palabra = dh > 0 ? "Sube" : "Baja";
    const sim = dh > 0 ? sube : baja;
    return {
      texto: `${sim} ${palabra} la corta al ${n}.`,
      voz: `${palabra} la corta al ${vozNumero(n)}.`,
      luz: "hora",
    };
  }
  const dm = direccionMinutos(actual, objetivo);
  if (dm !== 0) {
    const dest = destinoLarga(objetivo.m);
    const palabra = dm > 0 ? "Sube" : "Baja";
    const sim = dm > 0 ? sube : baja;
    return {
      texto: `${sim} ${palabra} la larga ${dest.texto}.`,
      voz: `${palabra} la larga ${dest.voz}.`,
      luz: "minutos",
    };
  }
  return { texto: "¡Brilla! Toca Listo.", voz: "Brilla. Toca Listo.", luz: "listo" };
}

function fraseCorta(objetivo) {
  const m = objetivo.m;
  if (m === 30) return { texto: "La larga va al 6.", voz: "La larga va al seis." };
  if (m === 15) return { texto: "La larga, al 3.", voz: "La larga, al tres." };
  if (m === 45) return { texto: "La larga, al 9.", voz: "La larga, al nueve." };
  if (m === 0) {
    const n = hora12(objetivo.h);
    return { texto: `La corta va al ${n}.`, voz: `La corta va al ${vozNumero(n)}.` };
  }
  return { texto: "Cuenta de 5 en 5.", voz: "Cuenta de cinco en cinco." };
}

function luzFalta(objetivo, actual) {
  if (deltaHora(actual, objetivo) !== 0) return "hora";
  if (direccionMinutos(actual, objetivo) !== 0) return "minutos";
  return "listo";
}

export function pista(estado) {
  const {
    nivel = 1, tipo = "poner", objetivo, actual, segundos = 0, trasError = false, tv = false, dominado = false,
  } = estado;
  const t = trasError ? 40 : segundos;

  if (tipo === "leer") {
    return escalera(t,
      { texto: "Primero mira la corta.", voz: "Primero mira la corta.", luz: null },
      { texto: "Primero mira la corta.", voz: "Primero mira la corta.", luz: "horario" },
      { texto: "La corta es la hora. La larga, los minutos.", voz: "La corta es la hora. La larga, los minutos.", luz: "horario" });
  }
  if (tipo === "momento") {
    const nombre = PARTES.find((p) => p.id === objetivo.parte)?.texto || "";
    return escalera(t,
      { texto: "Mira el cielo.", voz: "Mira el cielo.", luz: "cielo" },
      { texto: "Mira el cielo.", voz: "Mira el cielo.", luz: "cielo" },
      { texto: `Es de ${nombre}.`, voz: `Es de ${nombre}.`, luz: objetivo.parte });
  }
  if (tipo === "cuanto") {
    const op = OPCIONES_CUANTO.find((o) => o.id === objetivo.salto);
    return escalera(t,
      { texto: "Mira el arco.", voz: "Mira el arco amarillo.", luz: "arco" },
      { texto: "Mira el arco.", voz: "Mira el arco amarillo.", luz: "arco" },
      { texto: `Es ${op.texto}.`, voz: `Es ${op.texto}.`, luz: "arco" });
  }

  const mostrar = nivel >= 5 && (!dominado || t >= 20);
  if (actual && misma(actual, objetivo)) {
    return { texto: "¡Brilla! Toca Listo.", voz: "Brilla. Toca Listo.", luz: "listo", mostrarMinutos: mostrar };
  }
  const completo = pasoCompleto(objetivo, actual || objetivo, tv);
  if (nivel <= 1) return { ...completo, mostrarMinutos: false };
  const corta = fraseCorta(objetivo);
  const flecha = { ...corta, luz: luzFalta(objetivo, actual || objetivo) };
  const full = { ...completo, mostrarMinutos: nivel >= 5 };
  const paso = escalera(t, { ...corta, luz: null }, flecha, full);
  if (mostrar) paso.mostrarMinutos = true;
  return paso;
}
