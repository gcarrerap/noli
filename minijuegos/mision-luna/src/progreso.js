// Progreso. Lo guarda el catálogo con Noli.guardar; aquí solo hay funciones puras.
// Las misiones se abren en orden: la siguiente se abre con 2 o 3 estrellas. Cada palabra emparejada a la
// primera trae su roca al museo (las que falla regresan en el viaje hasta que salen bien), y cada misión
// terminada trae su foto.

export const PARA_ABRIR = 2;
export const MAX_REPASO = 6;
export const MISIONES_CON_VOZ = 2;      // «lectura: auto»: en las primeras misiones la voz lee todo

export function nuevo() {
  return { v: 1, abierta: 1, elegida: 1, misiones: {}, rocas: {}, fotos: {}, repaso: [], vistos: {}, voz: true,
    lectura: "auto", dias: {}, retos: {} };
}

export function cargar(d, total = 99) {
  if (!d || typeof d !== "object" || d.v !== 1) return nuevo();
  const p = { ...nuevo(), ...d };
  for (const k of ["misiones", "rocas", "fotos", "vistos", "dias", "retos"]) p[k] = { ...(d[k] && typeof d[k] === "object" ? d[k] : {}) };
  p.repaso = Array.isArray(d.repaso) ? d.repaso.filter((x) => typeof x === "string").slice(0, MAX_REPASO) : [];
  p.abierta = Math.max(1, Math.min(total, d.abierta | 0 || 1));
  p.elegida = Math.max(1, Math.min(p.abierta, d.elegida | 0 || p.abierta));
  p.voz = d.voz !== false;
  p.lectura = ["auto", "siempre", "pedir"].includes(d.lectura) ? d.lectura : "auto";
  return p;
}

// ¿La voz lee sola el texto, la pregunta y las opciones? Si no, solo con «Escuchar».
export function leeTodo(pr, n) {
  if (!pr.voz) return false;
  if (pr.lectura === "siempre") return true;
  if (pr.lectura === "pedir") return false;
  return n <= MISIONES_CON_VOZ;
}

export const misionDe = (pr, n) => pr.misiones[n] || { estrellas: 0, jugadas: 0 };

// Una palabra del viaje: a la primera trae su roca (una vez) y sale del repaso; si no, entra al repaso.
export function anotarPalabra(pr, id, primera) {
  if (primera) {
    const roca = !pr.rocas[id];
    return { pr: { ...pr, rocas: { ...pr.rocas, [id]: true }, repaso: pr.repaso.filter((x) => x !== id) }, roca };
  }
  const repaso = pr.repaso.includes(id) ? pr.repaso : [...pr.repaso, id].slice(-MAX_REPASO);
  return { pr: { ...pr, repaso }, roca: false };
}

// Cierra una misión: mejores estrellas, la foto y si se abre la siguiente.
export function cerrarMision(pr, n, estrellas, total) {
  const m = misionDe(pr, n);
  const misiones = { ...pr.misiones, [n]: { estrellas: Math.max(m.estrellas, estrellas), jugadas: m.jugadas + 1 } };
  const foto = !pr.fotos[n];
  const fotos = { ...pr.fotos, [n]: true };
  let abierta = pr.abierta, abrio = null;
  if (estrellas >= PARA_ABRIR && n === pr.abierta && n < total) { abierta = n + 1; abrio = abierta; }
  return { pr: { ...pr, misiones, fotos, abierta, elegida: abrio || pr.elegida }, abrio, foto };
}

export function anotarDia(pr, hoy, mision = false) {
  const dia = pr.dias[hoy] || { misiones: 0, reto: false };
  return { ...pr, dias: { ...pr.dias, [hoy]: { ...dia, misiones: dia.misiones + (mision ? 1 : 0), jugo: true } } };
}

export const marcarVisto = (pr, clave) => (pr.vistos[clave] ? pr : { ...pr, vistos: { ...pr.vistos, [clave]: true } });

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
  const reto = { tipo, puntos: Math.max(puntos, (previo && previo.puntos) || 0), cumplido: cumplido || !!(previo && previo.cumplido) };
  const dia = pr.dias[hoy] || { misiones: 0, reto: false };
  return { ...pr, retos: { ...pr.retos, [hoy]: reto }, dias: { ...pr.dias, [hoy]: { ...dia, jugo: true, reto: reto.cumplido } } };
}

const cumplido = (pr, f) => !!(pr.retos[f] && pr.retos[f].cumplido);

export function racha(pr, hoy) {
  let f = cumplido(pr, hoy) ? hoy : sumarDias(hoy, -1);
  let n = 0;
  while (cumplido(pr, f)) { n++; f = sumarDias(f, -1); }
  return n;
}

export function semana(pr, hoy) {
  return Array.from({ length: 7 }, (_, i) => {
    const f = sumarDias(hoy, i - 6);
    return { fecha: f, jugo: !!(pr.dias[f] && pr.dias[f].jugo), reto: cumplido(pr, f) };
  });
}
