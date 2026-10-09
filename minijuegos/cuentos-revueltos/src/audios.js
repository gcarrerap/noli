// Lista de grabaciones que tiene que haber: una por frase y una por palabra.
// Sale de los JSON, así que un cuento nuevo no cambia este archivo.
import { frasesDeCuento } from "./cuentos.js";
import { palabrasDe, clavePalabra } from "./lectura.js";
import { FRASES_GUIA } from "./guia.js";
import { PREGUNTA_PERDIDA } from "./reto.js";

export function slugFrase(texto) {
  return String(texto).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function archivosDe(cuentos) {
  const frases = new Map();
  const palabras = new Set();
  const add = (texto) => {
    const limpio = String(texto ?? "").trim();
    if (!limpio) return;
    const slug = slugFrase(limpio);
    if (slug && !frases.has(slug)) frases.set(slug, limpio);
    for (const p of palabrasDe(limpio)) {
      const c = clavePalabra(p);
      if (c) palabras.add(c);
    }
  };
  for (const c of cuentos || []) for (const f of frasesDeCuento(c)) add(f);
  for (const f of FRASES_GUIA) add(f);
  add(PREGUNTA_PERDIDA);
  return {
    frases: [...frases].map(([slug, texto]) => ({ slug, texto, archivo: `f/${slug}.mp3` })),
    palabras: [...palabras].sort().map((slug) => ({ slug, texto: slug, archivo: `w/${slug}.mp3` })),
  };
}
