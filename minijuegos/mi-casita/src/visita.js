// Una visita: bolsa fija, pago exacto y acomodar. Si sale, la de ese día sigue abierta.

import {
  agregarMoneda, conteoDe, quitarUltima, restarBolsa, sumaOrden, sumarBolsa, puedePagar, copiaBolsa,
} from "./dinero.js";
import { cabe, formaDe, mover, ponerEn } from "./casa.js";

export function visitaNueva(dia, bolsa, cuarto) {
  return {
    dia,
    abierta: true,
    bolsa: copiaBolsa(bolsa),
    fase: "tienda",
    mueble: null,
    orden: [],
    gastado: null,
    fallos: 0,
    cuarto: cuarto || "recamara",
    x: 0,
    y: 0,
    rot: 0,
    barra: false,
    movio: false,
    ayuda: false,
    ayudaDesde: 0,
  };
}

export function debeCobrar(pr, dia) {
  return !(pr?.visita && pr.visita.abierta && pr.visita.dia === dia);
}

export function alAgregar(visita, id, precio, piezas) {
  const orden = agregarMoneda(visita.orden, visita.bolsa, id);
  if (orden.length === (visita.orden || []).length) return visita;
  const antes = sumaOrden(visita.orden, piezas);
  const suma = sumaOrden(orden, piezas);
  const fallos = suma > precio && antes <= precio ? visita.fallos + 1 : visita.fallos;
  return { ...visita, orden, fallos };
}

export function alQuitar(visita) {
  if (!visita.orden?.length) return visita;
  return { ...visita, orden: quitarUltima(visita.orden) };
}

export function alPagar(visita, precio, piezas) {
  const suma = sumaOrden(visita.orden, piezas);
  if (suma !== precio) return { ok: false, visita: { ...visita, fallos: visita.fallos + 1 } };
  const gastado = conteoDe(visita.orden);
  return {
    ok: true,
    visita: {
      ...visita,
      bolsa: restarBolsa(visita.bolsa, gastado),
      gastado,
      orden: [],
      fallos: 0,
      fase: "acomodar",
      x: 0,
      y: 0,
      rot: 0,
      barra: false,
      movio: false,
      ayuda: false,
    },
  };
}

export function elegirMueble(visita, id) {
  return { ...visita, fase: "pagar", mueble: id, orden: [], fallos: 0, gastado: null, ayuda: false, ayudaDesde: 0 };
}

export function moverPieza(visita, cuarto, dir, mueble) {
  const f = formaDe(mueble, visita.rot);
  const p = mover(cuarto, visita.x, visita.y, f.w, f.h, dir);
  return { ...visita, x: p.x, y: p.y, movio: true };
}

export function tocarCuadro(visita, cuarto, cx, cy, mueble) {
  const f = formaDe(mueble, visita.rot);
  const p = ponerEn(cuarto, cx, cy, f.w, f.h);
  return { ...visita, x: p.x, y: p.y, movio: true };
}

export function girarPieza(visita) {
  return { ...visita, rot: (visita.rot | 0) + 1 };
}

export function abrirBarra(visita) {
  return { ...visita, barra: true };
}

export function dejarPieza(pr, cuarto, mueble) {
  const v = pr.visita;
  const f = formaDe(mueble, v.rot);
  if (!cabe(cuarto, pr.puestos, v.x, v.y, f.w, f.h)) return { ok: false, pr };
  const puesto = {
    id: v.mueble, cuarto: cuarto.id, x: v.x, y: v.y, w: f.w, h: f.h, archivo: f.archivo, giro: f.giro,
  };
  return {
    ok: true,
    pr: {
      ...pr,
      puestos: [...pr.puestos, puesto],
      visita: { ...v, fase: "tienda", mueble: null, gastado: null, orden: [], barra: false, fallos: 0 },
    },
  };
}

export function devolverPieza(pr) {
  const v = pr.visita;
  if (!v?.gastado) return { ...pr, visita: { ...v, fase: "tienda", mueble: null, barra: false } };
  return {
    ...pr,
    visita: {
      ...v,
      bolsa: sumarBolsa(v.bolsa, v.gastado),
      gastado: null,
      fase: "tienda",
      mueble: null,
      orden: [],
      barra: false,
      fallos: 0,
    },
  };
}

export function preciosAbiertos(ab, muebles, puestos) {
  const puestosIds = new Set((puestos || []).map((p) => p.id));
  return (ab.muebles || [])
    .filter((id) => !puestosIds.has(id))
    .map((id) => muebles.find((m) => m.id === id))
    .filter(Boolean);
}

export function algunoAlcanza(bolsa, lista, piezas) {
  return (lista || []).some((m) => puedePagar(m.precio, bolsa, piezas));
}

export function cerrarVisita(pr) {
  if (!pr.visita?.abierta) return pr;
  return { ...pr, visitas: (pr.visitas | 0) + 1, visita: { ...pr.visita, abierta: false, fase: "fin" } };
}
