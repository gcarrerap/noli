// Pistas por escalera. Frase corta, flecha a los 20 s, paso completo a los 40 s o tras un error.
// En el nivel 1 la cosecha dice «de 2 en 2» y solo al final enseña los números.
// Primero se revisan las filas y después cuántas van en cada fila.

function escalon(nivel, segundos, errores) {
  if (nivel <= 1) return "completo";
  if (errores > 0 || segundos >= 40) return "completo";
  if (segundos >= 20) return "flecha";
  return "corto";
}

// El nivel 1 siempre pide el paso completo al plantar. Al contar, los números esperan.
function pasoConteo(meta, paso, opts) {
  if ((meta.nivel || 1) > 1) return paso;
  if ((opts.errores || 0) > 0 || (opts.segundos || 0) >= 40) return "completo";
  if ((opts.segundos || 0) >= 20) return "flecha";
  return "corto";
}

function destino(estado, meta) {
  if (estado.filas !== meta.filas) return "filas";
  if (estado.porFila !== meta.porFila) return "cada";
  return "listo";
}

function pistaPlantar(estado, meta, paso, tv) {
  const dest = destino(estado, meta);
  if (dest === "listo") {
    return {
      paso, flecha: paso === "flecha" ? "listo" : null,
      texto: tv ? "¡Brilla! Pulsa OK." : "¡Brilla! Toca Listo.",
      leer: tv ? "Brilla. Pulsa OK." : "Brilla. Toca Listo.",
    };
  }
  const objetivo = dest === "filas" ? meta.filas : meta.porFila;
  const actual = dest === "filas" ? estado.filas : estado.porFila;
  if (paso === "corto" || paso === "flecha") {
    let texto;
    if (meta.nivel === 6 && dest === "filas" && meta.filas === 2) texto = "Prueba con 2 filas.";
    else if (dest === "filas") texto = "Revisa las filas.";
    else texto = "Ahora, en cada fila.";
    return { paso, texto, leer: texto, flecha: paso === "flecha" ? dest : null };
  }
  if (dest === "filas") {
    let texto;
    let leer;
    if (meta.nivel === 6 && meta.filas === 2) {
      texto = "Prueba con 2 filas.";
      leer = texto;
    } else if (meta.nivel === 4 && meta.filas === 4) {
      texto = "Pon 4 filas.";
      leer = texto;
    } else if (objetivo > actual) {
      texto = tv ? `Pulsa ▲ hasta ${objetivo}.` : `Toca + hasta ${objetivo}.`;
      leer = tv ? `Pulsa arriba hasta ${objetivo}.` : `Toca más hasta ${objetivo}.`;
    } else {
      texto = tv ? `Pulsa ▼ hasta ${objetivo}.` : `Quita con − hasta ${objetivo}.`;
      leer = tv ? `Pulsa abajo hasta ${objetivo}.` : `Quita hasta ${objetivo}.`;
    }
    return { paso, texto, leer, flecha: null };
  }
  const texto = meta.nivel === 4 && meta.porFila === 5 ? "5 en cada fila." : `Pon ${objetivo}.`;
  return { paso, texto, leer: texto, flecha: null };
}

function pistaSalto(estado, meta, paso) {
  const sec = meta.secuencia || [];
  const siguiente = sec[estado.salto || 0];
  const delta = meta.paso || sec[0] || 0;
  const atras = meta.direccion === -1;
  if ((meta.nivel || 1) <= 1 && paso !== "completo") {
    const texto = `Cuenta de ${delta} en ${delta}.`;
    return { paso, texto, leer: texto, flecha: paso === "flecha" ? "opciones" : null };
  }
  if (paso === "completo" && (meta.nivel || 1) <= 1) {
    const texto = `Cuenta: ${sec.join(", ")}.`;
    return { paso, texto, leer: texto, flecha: null };
  }
  if (paso === "corto") {
    const texto = atras ? `Quita ${delta}.` : delta === 5 ? "Suma 5 más." : `Suma ${delta} más.`;
    return { paso, texto, leer: texto, flecha: null };
  }
  if (paso === "flecha") {
    const texto = atras ? "Mira la recta." : delta === 5 ? "Suma 5 más." : "Mira las opciones.";
    return { paso, texto, leer: texto, flecha: "opciones" };
  }
  const texto = siguiente != null ? `Sigue el ${siguiente}.` : "Cuenta los saltos.";
  return { paso, texto, leer: texto, flecha: null };
}

export function pista(estado, meta, opts = {}) {
  const paso = escalon(meta.nivel || 1, opts.segundos || 0, opts.errores || 0);
  const tv = !!opts.tv;
  if (estado.fase === "muestra") return { paso: "nada", texto: "", leer: "", flecha: null };
  if (estado.fase === "par") {
    return { paso, texto: "Haz parejas.", leer: "Haz parejas.", flecha: paso === "flecha" ? "par" : null };
  }
  if (estado.fase === "cosecha" || estado.fase === "saltar") {
    return pistaSalto(estado, meta, pasoConteo(meta, paso, opts));
  }
  return pistaPlantar(estado, meta, paso, tv);
}

// Ver los números a los 40 s no es un primer intento, salvo en el nivel 1.
export function marcaPasoCompleto(nivel, paso, segundos) {
  return (nivel | 0) > 1 && paso === "completo" && segundos >= 40;
}
