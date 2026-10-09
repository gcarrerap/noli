// Progreso de Noelia. Lo guarda el catálogo con Noli.guardar.
// Dominio de un cuento: 8 de los últimos 10, a la primera.
// Tres estrellas en un cuento apagan la lectura automática (Escuchar sigue).

export const VENTANA = 10;
export const PARA_SUBIR = 8;

export function nuevo() {
  return { v: 1, guia: false, voz: true, cuentos: {}, dias: {}, retos: {} };
}

const VACIO = () => ({
  cap: 0,
  i: 0,
  tareas: null,
  completo: false,
  estrellas: 0,
  ultimos: [],
  palabrasMal: [],
  come: null,
  enCurso: false,
  aciertosCap: 0,
});

export function cargar(d) {
  if (!d || typeof d !== "object" || d.v !== 1) return nuevo();
  const cuentos = {};
  for (const [id, c] of Object.entries(d.cuentos || {})) {
    if (!c || typeof c !== "object") continue;
    cuentos[id] = {
      ...VACIO(),
      ...c,
      ultimos: Array.isArray(c.ultimos) ? c.ultimos.filter((n) => n === 0 || n === 1).slice(-VENTANA) : [],
      palabrasMal: Array.isArray(c.palabrasMal) ? c.palabrasMal.map(String) : [],
      cap: Math.max(0, c.cap | 0),
      i: Math.max(0, c.i | 0),
      estrellas: Math.max(0, Math.min(3, c.estrellas | 0)),
      completo: !!c.completo,
      enCurso: !!c.enCurso,
      tareas: Array.isArray(c.tareas) ? c.tareas : null,
      come: c.come || null,
      aciertosCap: Math.max(0, c.aciertosCap | 0),
    };
  }
  return {
    v: 1,
    guia: !!d.guia,
    voz: d.voz !== false,
    cuentos,
    dias: { ...(d.dias || {}) },
    retos: { ...(d.retos || {}) },
  };
}

export function cuentoDe(pr, id) {
  return pr?.cuentos?.[id] ? { ...VACIO(), ...pr.cuentos[id] } : VACIO();
}

export function ponerCuento(pr, id, c) {
  return { ...pr, cuentos: { ...pr.cuentos, [id]: c } };
}

export function dominio(pr, id) {
  const u = cuentoDe(pr, id).ultimos;
  const aciertos = u.reduce((s, x) => s + x, 0);
  return {
    intentos: u.length,
    aciertos,
    listo: u.length >= VENTANA && aciertos >= PARA_SUBIR,
  };
}

export function anotarTarea(pr, id, { ok, palabra }, hoy) {
  const c = cuentoDe(pr, id);
  const ultimos = [...c.ultimos, ok ? 1 : 0].slice(-VENTANA);
  let palabrasMal = c.palabrasMal.filter((p) => p !== palabra);
  if (palabra && !ok) palabrasMal = [...palabrasMal, palabra];
  const dia = pr.dias[hoy] || { tareas: 0, aciertos: 0, reto: false };
  return {
    ...ponerCuento(pr, id, { ...c, ultimos, palabrasMal }),
    dias: {
      ...pr.dias,
      [hoy]: { ...dia, tareas: dia.tareas + 1, aciertos: dia.aciertos + (ok ? 1 : 0) },
    },
  };
}

export const estrellasTurno = (aciertos, de) => {
  const n = de | 0;
  if (n <= 0) return 0;
  if (aciertos >= n) return 3;
  if (aciertos >= n * 0.8) return 2;
  if (aciertos >= n * 0.5) return 1;
  return 0;
};

export function cerrarCapitulo(pr, id, aciertos, graded, esUltimo) {
  const c = cuentoDe(pr, id);
  const est = estrellasTurno(aciertos, graded);
  const siguiente = {
    ...c,
    estrellas: Math.max(c.estrellas, est),
    completo: c.completo || !!esUltimo,
    cap: esUltimo ? c.cap : c.cap + 1,
    i: 0,
    tareas: null,
    enCurso: false,
    come: null,
    aciertosCap: 0,
  };
  return { pr: ponerCuento(pr, id, siguiente), estrellas: est };
}

export function guardarCurso(pr, id, curso) {
  const c = { ...cuentoDe(pr, id), ...curso, enCurso: true };
  return ponerCuento(pr, id, c);
}

export function reiniciarCuento(pr, id) {
  const c = cuentoDe(pr, id);
  return ponerCuento(pr, id, { ...c, cap: 0, i: 0, tareas: null, enCurso: false, come: null, aciertosCap: 0 });
}

export function marcarGuia(pr) {
  return pr.guia ? pr : { ...pr, guia: true };
}

export function ponerVoz(pr, voz) {
  return { ...pr, voz: !!voz };
}

export function leeSolo(pr, id) {
  return cuentoDe(pr, id).estrellas >= 3;
}

export function desbloqueado(cuentos, pr, id) {
  const i = (cuentos || []).findIndex((c) => c.id === id);
  if (i <= 0) return true;
  return !!cuentoDe(pr, cuentos[i - 1].id).completo;
}

export function fechaLocal(d = new Date()) {
  const z = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function sumarDias(fecha, n) {
  const [y, m, d] = fecha.split("-").map(Number);
  return fechaLocal(new Date(y, m - 1, d + n));
}

export function cumplirReto(pr, hoy, tipo, puntos, cumplido) {
  const previo = pr.retos[hoy];
  const reto = {
    tipo,
    puntos: Math.max(puntos, previo?.puntos || 0),
    cumplido: cumplido || !!previo?.cumplido,
  };
  const dia = pr.dias[hoy] || { tareas: 0, aciertos: 0, reto: false };
  return {
    ...pr,
    retos: { ...pr.retos, [hoy]: reto },
    dias: { ...pr.dias, [hoy]: { ...dia, reto: reto.cumplido } },
  };
}

export function racha(pr, hoy) {
  let f = pr.retos[hoy]?.cumplido ? hoy : sumarDias(hoy, -1);
  let n = 0;
  while (pr.retos[f]?.cumplido) { n += 1; f = sumarDias(f, -1); }
  return n;
}

export function semana(pr, hoy) {
  return Array.from({ length: 7 }, (_, i) => {
    const f = sumarDias(hoy, i - 6);
    return { fecha: f, jugo: !!pr.dias[f]?.tareas, reto: !!pr.retos[f]?.cumplido };
  });
}

export function textoRacha(pr, hoy) {
  const r = racha(pr, hoy);
  if (!r) return "Cumple el reto de hoy para empezar una racha";
  return `Racha: ${r} ${r === 1 ? "día" : "días"}`;
}
