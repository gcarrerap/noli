// Pistas por escalera. Nivel 1: el paso completo desde el principio.
// Desde el nivel 2: frase corta, flecha a los 20 s, paso completo a los 40 s o tras un error.
// Primero se revisan las filas y después cuántas van en cada fila.

function escalon(nivel, segundos, errores) {
  if (nivel <= 1) return "completo";
  if (errores > 0 || segundos >= 40) return "completo";
  if (segundos >= 20) return "flecha";
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
      texto: "¡Brilla! Toca Listo.",
      leer: "Brilla. Toca Listo.",
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
      leer = `Toca más hasta ${objetivo}.`;
    } else {
      texto = tv ? `Pulsa ▼ hasta ${objetivo}.` : `Quita con − hasta ${objetivo}.`;
      leer = `Quita hasta ${objetivo}.`;
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
  if (paso === "completo" && meta.nivel === 1) {
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
  if (estado.fase === "par") {
    return { paso, texto: "Haz parejas.", leer: "Haz parejas.", flecha: paso === "flecha" ? "par" : null };
  }
  if (estado.fase === "cosecha" || estado.fase === "saltar") return pistaSalto(estado, meta, paso);
  return pistaPlantar(estado, meta, paso, tv);
}
