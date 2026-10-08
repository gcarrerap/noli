// Manifiesto de un minijuego (minijuegos/<id>/juego.json): validarlo y completar valores por omisión.
// Función pura: no lee archivos (eso lo hace services/catalogo-repo.js).

export const CONTROLES = ["tactil", "flechas", "remoto"];
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Devuelve { juego } con el manifiesto completo, o { errores: [..] } si no sirve.
// idCarpeta: el id con el que aparece en catalogo.json (debe coincidir con el del manifiesto y con la carpeta).
export function validarManifiesto(m, idCarpeta) {
  const errores = [];
  if (!m || typeof m !== "object" || Array.isArray(m)) return { errores: [`${idCarpeta}: juego.json no es un objeto`] };
  const txt = (v) => typeof v === "string" && v.trim() !== "";

  if (!txt(m.id) || !ID.test(m.id)) errores.push(`${idCarpeta}: "id" debe ser minúsculas, números y guiones`);
  else if (m.id !== idCarpeta) errores.push(`${idCarpeta}: "id" (${m.id}) no coincide con la carpeta`);
  if (!txt(m.titulo)) errores.push(`${idCarpeta}: falta "titulo"`);

  const entrada = m.entrada ?? "index.html";
  if (!txt(entrada) || /^([a-z]+:|\/|\.\.)/i.test(entrada)) errores.push(`${idCarpeta}: "entrada" debe ser una ruta relativa dentro de la carpeta`);

  const controles = m.controles ?? ["tactil", "flechas"];
  if (!Array.isArray(controles) || !controles.length || controles.some((c) => !CONTROLES.includes(c)))
    errores.push(`${idCarpeta}: "controles" debe ser una lista con ${CONTROLES.join(", ")}`);

  // Ícono: un archivo de la carpeta del juego (recomendado: .svg) o, para prototipos, un emoji/texto corto
  const icono = txt(m.icono) ? m.icono.trim() : "🎲";
  const iconoArchivo = /\.(svg|png|webp|jpe?g)$/i.test(icono);
  if (iconoArchivo && /^([a-z]+:|\/|\.\.)/i.test(icono)) errores.push(`${idCarpeta}: "icono" debe ser un archivo dentro de la carpeta`);

  let edades = m.edades ?? null;
  if (edades !== null && !(Array.isArray(edades) && edades.length === 2 && edades.every(Number.isInteger) && edades[0] <= edades[1]))
    errores.push(`${idCarpeta}: "edades" debe ser [mínima, máxima]`);

  if (errores.length) return { errores };
  return {
    juego: {
      id: m.id,
      titulo: m.titulo.trim(),
      descripcion: txt(m.descripcion) ? m.descripcion.trim() : "",
      icono, iconoArchivo,
      color: txt(m.color) ? m.color : null,
      materia: txt(m.materia) ? m.materia.trim().toLowerCase() : "otros",
      edades,
      controles,
      entrada,
      version: m.version != null ? String(m.version) : "1",
    },
  };
}

// ¿Se puede jugar con lo que hay? En la TV (sin dedo) el juego tiene que aceptar flechas o el teléfono remoto.
export function jugableEn(juego, modo) {
  if (modo === "tv") return juego.controles.includes("flechas") || juego.controles.includes("remoto");
  return true;
}
