// Los cuentos viven en JSON. Esta lógica no conoce los cuatro de la v1 por nombre
// más que para el orden fijo del librero: agregar un archivo y una fila en el índice alcanza.
import { palabrasDe, clavePalabra, cuentaPalabras } from "./lectura.js";
import { revolver } from "./rng.js";

export const ORDEN_V1 = ["cerditos", "caperucita", "ricitos", "jack"];
export const MAX_POR_PAGINA = 3;
export const MAX_PALABRAS_CORTO = 8;
export const MAX_PALABRAS_LARGO = 12;

export function paginaDe(cuento, id) {
  return cuento?.paginas?.find((p) => p.id === id) || null;
}

export function califica(tarea) {
  return !!tarea && tarea.tipo !== "cruce";
}

export function tareasCalificables(tareas) {
  return (tareas || []).filter(califica);
}

export function respuestaDe(tarea, come) {
  if (!tarea) return null;
  if (tarea.tipo === "cambio") return come || null;
  if (tarea.tipo === "palabra") return tarea.palabra;
  return tarea.correcta ?? null;
}

export function acierto(tarea, eleccion, come) {
  const buena = respuestaDe(tarea, come);
  return buena != null && eleccion === buena;
}

export function bancoPalabras(cuentos) {
  const vistos = new Set();
  const banco = [];
  for (const c of cuentos || []) {
    for (const cap of c.capitulos || []) {
      for (const t of cap.tareas || []) {
        if (t.tipo === "palabra" && t.palabra && !vistos.has(t.palabra)) {
          vistos.add(t.palabra);
          banco.push(t);
        }
      }
    }
  }
  return banco;
}

// Si falló una palabra, ocupa el último hueco de palabra del capítulo.
export function barajarTarea(tarea, rnd) {
  if (!tarea?.opciones) return { ...tarea };
  return { ...tarea, opciones: revolver(rnd, tarea.opciones.map((op) => ({ ...op }))) };
}

export function prepararTareas(tareas, rnd) {
  return (tareas || []).map((t) => (t.opciones ? barajarTarea(t, rnd) : { ...t }));
}

export function conRepaso(tareas, palabrasMal, banco) {
  const lista = (tareas || []).map((t) => ({ ...t }));
  const mal = (palabrasMal || []).filter(Boolean);
  if (!mal.length) return lista;
  let hueco = -1;
  for (let i = 0; i < lista.length; i++) if (lista[i].tipo === "palabra") hueco = i;
  if (hueco < 0) return lista;
  const ya = new Set(lista.filter((t) => t.tipo === "palabra").map((t) => t.palabra));
  const fallo = mal.find((p) => !ya.has(p));
  if (!fallo) return lista;
  const original = (banco || []).find((t) => t.palabra === fallo);
  if (!original) return lista;
  lista[hueco] = { ...original, repaso: true };
  return lista;
}

export function textosDeTarea(tarea) {
  const out = [];
  if (!tarea) return out;
  if (tarea.pregunta) out.push(tarea.pregunta);
  if (tarea.oracion) out.push(tarea.oracion);
  for (const op of tarea.opciones || []) {
    if (op.texto) out.push(op.texto);
    if (op.titulo) out.push(op.titulo);
  }
  return out;
}

export function frasesDeCuento(cuento) {
  const out = [];
  for (const p of cuento.paginas || []) for (const o of p.oraciones || []) out.push(o);
  for (const cap of cuento.capitulos || []) {
    for (const t of cap.tareas || []) out.push(...textosDeTarea(t));
  }
  return out;
}

export function palabrasUsadas(cuento) {
  const set = new Set();
  for (const frase of frasesDeCuento(cuento)) {
    for (const p of palabrasDe(frase)) set.add(clavePalabra(p));
  }
  return [...set];
}

function unaCorrecta(opciones, id) {
  return (opciones || []).filter((op) => op.id === id).length === 1;
}

export function validarCuento(cuento, indice) {
  const errores = [];
  const mal = (m) => errores.push(`${cuento?.id || "?"}: ${m}`);
  if (!cuento?.id) mal("falta id");
  if (!cuento?.titulo) mal("falta título");
  const nivel = cuento?.nivel | 0;
  if (nivel < 1) mal("nivel");
  const tope = nivel >= 4 ? MAX_PALABRAS_LARGO : MAX_PALABRAS_CORTO;
  const pags = cuento?.paginas || [];
  if (!pags.length) mal("sin páginas");
  const ids = new Set();
  for (const p of pags) {
    if (ids.has(p.id)) mal(`página repetida ${p.id}`);
    ids.add(p.id);
    const n = (p.oraciones || []).length;
    if (n < 2 || n > MAX_POR_PAGINA) mal(`${p.id} tiene ${n} oraciones`);
    for (const o of p.oraciones || []) {
      const c = cuentaPalabras(o);
      if (c < 1 || c > tope) mal(`«${o}» tiene ${c} palabras (tope ${tope})`);
    }
    if (!p.escena) mal(`${p.id} sin escena`);
    if (!p.pista) mal(`${p.id} sin pista`);
  }
  const caps = cuento?.capitulos || [];
  if (!caps.length) mal("sin capítulos");
  let porque = 0;
  let primerOrden = null;
  caps.forEach((cap, ci) => {
    const tareas = cap.tareas || [];
    if (tareas.length < 5 || tareas.length > 7) mal(`${cap.id} tiene ${tareas.length} tareas`);
    tareas.forEach((t, ti) => {
      if (t.tipo === "porque") porque += 1;
      if (t.tipo === "ordenar") {
        const nt = (t.tarjetas || []).length;
        if (primerOrden == null) primerOrden = nt;
        if (nt < 3 || nt > 6) mal(`ordenar con ${nt} tarjetas`);
        for (const id of t.tarjetas || []) if (!ids.has(id)) mal(`tarjeta ${id} no existe`);
        if (nivel >= 4 && !t.soloTexto) mal("en el nivel 4 las tarjetas llegan sin dibujo");
      }
      if (t.tipo === "palabra") {
        if ((t.opciones || []).length !== 3) mal("palabra mágica sin 3 dibujos");
        if (!unaCorrecta(t.opciones, t.palabra)) mal(`palabra ${t.palabra} sin una sola correcta`);
        if (!t.oracion) mal("palabra sin oración");
      }
      if (t.tipo === "quien" || t.tipo === "porque" || t.tipo === "cambio" || t.tipo === "pagina") {
        if ((t.opciones || []).length !== 3) mal(`${t.tipo} sin 3 opciones`);
        if (t.tipo !== "cambio" && !unaCorrecta(t.opciones, t.correcta)) mal(`${t.tipo} sin una sola correcta`);
        if (t.tipo === "quien" && (t.opciones || []).some((op) => !String(op.dibujo || "").startsWith("cara-"))) {
          mal("¿quién? se contesta con caras");
        }
      }
      if (t.tipo === "cambio") {
        if (t.segun !== "come") mal("el cambio no sigue al final elegido");
        const prev = tareas.slice(0, ti).some((x) => x.tipo === "cruce");
        if (!prev) mal("el cambio va después del cruce");
      }
      if (t.tipo === "cruce" && (t.opciones || []).length !== 2) mal("el cruce tiene dos finales");
    });
  });
  const hayCruce = caps.some((cap) => (cap.tareas || []).some((t) => t.tipo === "cruce"));
  if (!hayCruce) mal("falta el cruce");
  if (porque > 1) mal("más de un ¿por qué?");
  if (primerOrden != null && indice != null && primerOrden !== Math.min(6, 3 + indice)) {
    mal(`el primer ordenar tiene ${primerOrden} tarjetas`);
  }
  return errores;
}

export function validarIndice(orden) {
  if (!Array.isArray(orden) || !orden.length) return ["índice vacío"];
  if (orden[0] !== "cerditos" || orden[1] !== "caperucita") return ["el librero no empieza por cerditos y caperucita"];
  return [];
}
