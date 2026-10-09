// Progreso de la casita. Se guarda con Noli.guardar. Las monedas de la visita
// no se ahorran: cada visita abierta trae su bolsa, y al cerrarla se tira lo que sobre.

import { copiaBolsa } from "./dinero.js";

export const COSTO = 3;

export function nuevo() {
  return { v: 1, guia: false, voz: true, visitas: 0, puestos: [], visita: null };
}

export function fechaLocal(d = new Date()) {
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

function puestoValido(p, idx) {
  if (!p || typeof p.id !== "string" || !idx.muebles.has(p.id)) return false;
  if (!idx.cuartos.has(p.cuarto)) return false;
  const c = idx.cuartos.get(p.cuarto);
  if (!Number.isInteger(p.x) || !Number.isInteger(p.y) || !Number.isInteger(p.w) || !Number.isInteger(p.h)) return false;
  if (p.w < 1 || p.h < 1) return false;
  if (p.x < 0 || p.y < 0 || p.x + p.w > c.cols || p.y + p.h > c.filas) return false;
  return true;
}

function visitaValida(v) {
  if (!v || typeof v !== "object") return null;
  if (typeof v.dia !== "string") return null;
  return {
    dia: v.dia,
    abierta: v.abierta === true,
    bolsa: copiaBolsa(v.bolsa),
    fase: ["tienda", "pagar", "acomodar", "fin"].includes(v.fase) ? v.fase : "tienda",
    mueble: typeof v.mueble === "string" ? v.mueble : null,
    orden: Array.isArray(v.orden) ? v.orden.filter((id) => typeof id === "string") : [],
    gastado: v.gastado && typeof v.gastado === "object" ? { ...v.gastado } : null,
    fallos: Math.max(0, v.fallos | 0),
    cuarto: typeof v.cuarto === "string" ? v.cuarto : "recamara",
    x: v.x | 0,
    y: v.y | 0,
    rot: v.rot | 0,
    barra: v.barra === true,
    movio: v.movio === true,
    ayuda: v.ayuda === true,
    ayudaDesde: v.ayudaDesde | 0,
  };
}

export function cargar(d, idx) {
  const p = nuevo();
  if (!d || typeof d !== "object") return p;
  p.guia = d.guia === true;
  if (d.voz === false) p.voz = false;
  p.visitas = Math.max(0, d.visitas | 0);
  const vistos = new Set();
  for (const puesto of Array.isArray(d.puestos) ? d.puestos : []) {
    if (!puestoValido(puesto, idx) || vistos.has(puesto.id)) continue;
    vistos.add(puesto.id);
    p.puestos.push({
      id: puesto.id, cuarto: puesto.cuarto, x: puesto.x, y: puesto.y,
      w: puesto.w, h: puesto.h, archivo: puesto.archivo, giro: puesto.giro | 0,
    });
  }
  p.visita = visitaValida(d.visita);
  return p;
}

/** La moneda que ella eligió en La Tienda. Dólares si todavía no elige. */
export function monedaDeTienda(leer) {
  const claves = [
    "noli.datos.tienda",
    "noli.solo./minijuegos/tienda/",
    "noli.solo./minijuegos/tienda/index.html",
  ];
  for (const k of claves) {
    let d = null;
    try { d = JSON.parse(leer(k) || "null"); } catch { d = null; }
    if (d && (d.moneda === "usd" || d.moneda === "mxn")) return d.moneda;
  }
  return "usd";
}
