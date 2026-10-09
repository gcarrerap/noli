// Reto del día, sin reloj. La semilla es la fecha: misma fecha, mismo reto.
import { rngConSemilla, revolver } from "./rng.js";
import { bancoPalabras, paginaDe } from "./cuentos.js";
import { cuentoDe } from "./progreso.js";

export const PREGUNTA_PERDIDA = "What happened on the lost page?";
export const NECESITA = 3;
export const CUANTOS = 4;

function cuentosLeidos(cuentos, pr) {
  const leidos = (cuentos || []).filter((c) => {
    const e = cuentoDe(pr, c.id);
    return e.completo || e.enCurso || e.cap > 0 || e.i > 0 || e.ultimos.length > 0;
  });
  return leidos.length ? leidos : (cuentos || []).slice(0, 1);
}

function itemPagina(cuento, indice, rnd) {
  const pags = cuento.paginas || [];
  if (pags.length < 3) return null;
  const correcta = pags[indice % pags.length];
  const otras = revolver(rnd, pags.filter((p) => p.id !== correcta.id && p.escena !== correcta.escena));
  if (otras.length < 2) return null;
  const opciones = revolver(rnd, [correcta, otras[0], otras[1]]).map((p) => ({
    id: p.id,
    dibujo: p.escena,
  }));
  const antes = indice > 0 ? pags[(indice - 1) % pags.length] : null;
  return {
    tipo: "pagina",
    pregunta: PREGUNTA_PERDIDA,
    preguntaEs: "¿Qué pasó en la página perdida?",
    pista: correcta.pista,
    antes: antes ? antes.oraciones[0] : "",
    opciones,
    correcta: correcta.id,
    cuento: cuento.id,
  };
}

function itemsPagina(cuentos, pr, rnd) {
  const fuente = cuentosLeidos(cuentos, pr);
  const items = [];
  let guard = 0;
  while (items.length < CUANTOS && guard < 40) {
    guard += 1;
    const cuento = fuente[Math.floor(rnd() * fuente.length)];
    const item = itemPagina(cuento, Math.floor(rnd() * cuento.paginas.length), rnd);
    if (item && !items.some((x) => x.correcta === item.correcta && x.cuento === item.cuento)) items.push(item);
  }
  return items;
}

function itemsPalabra(cuentos, pr, rnd) {
  const banco = bancoPalabras(cuentos);
  const mal = [];
  for (const c of cuentos || []) mal.push(...cuentoDe(pr, c.id).palabrasMal);
  const preferidas = banco.filter((t) => mal.includes(t.palabra));
  const resto = revolver(rnd, banco.filter((t) => !mal.includes(t.palabra)));
  const cola = [...preferidas, ...resto];
  const items = [];
  for (const t of cola) {
    if (items.length >= CUANTOS) break;
    if (items.some((x) => x.palabra === t.palabra)) continue;
    items.push({
      ...t,
      opciones: revolver(rnd, t.opciones.map((op) => ({ ...op }))),
      repaso: mal.includes(t.palabra),
    });
  }
  return items;
}

export function retoDelDia(fecha, cuentos, pr) {
  const rnd = rngConSemilla(`cuentos-revueltos:${fecha}`);
  const tipo = rnd() < 0.5 ? "pagina" : "palabra";
  const items = tipo === "pagina" ? itemsPagina(cuentos, pr, rnd) : itemsPalabra(cuentos, pr, rnd);
  return {
    tipo,
    fecha: String(fecha),
    items,
    necesita: NECESITA,
    cuantos: items.length,
    reloj: false,
  };
}

export function escenaDe(cuentos, cuentoId, paginaId) {
  const c = (cuentos || []).find((x) => x.id === cuentoId);
  return paginaDe(c, paginaId)?.escena || "";
}
