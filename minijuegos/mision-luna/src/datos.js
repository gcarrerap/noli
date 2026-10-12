// Los datos del juego (datos/*.json): revisarlos (puro, con pruebas) y cargarlos en el navegador.

const ID = /^[a-z0-9-]+$/;

// Regresa la lista de problemas (vacía si todo está bien). dibujos: ids que sabe dibujar src/arte.js.
export function validarDatos(misiones, vocab, dibujos = null) {
  const errs = [];
  const palabras = new Set();
  for (const p of (vocab && vocab.palabras) || []) {
    if (!ID.test(p.id) || !p.en || !p.es) errs.push(`palabra mal escrita: ${JSON.stringify(p)}`);
    if (palabras.has(p.id)) errs.push(`palabra repetida: ${p.id}`);
    palabras.add(p.id);
    if (dibujos && !dibujos.has(p.id)) errs.push(`falta el dibujo de la palabra ${p.id}`);
  }
  if (palabras.size < 6) errs.push("hacen falta al menos 6 palabras");
  const fases = (vocab && vocab.fases) || [];
  if (fases.length !== 8 || fases.some((f, i) => f.n !== i || !f.en || !f.es)) errs.push("las fases tienen que ser 8, de la 0 a la 7");

  const ms = (misiones && misiones.misiones) || [];
  if (!ms.length) errs.push("no hay misiones");
  const ids = new Set();
  ms.forEach((m, i) => {
    const q = `misión ${m.n}`;
    if (m.n !== i + 1) errs.push(`${q}: van en orden desde 1`);
    if (!m.nombre) errs.push(`${q}: falta el nombre`);
    if (!Array.isArray(m.palabras) || m.palabras.length !== 3) errs.push(`${q}: lleva 3 palabras`);
    else for (const w of m.palabras) if (!palabras.has(w)) errs.push(`${q}: no existe la palabra ${w}`);
    const l = m.luna || {};
    if (!["calendario", "noche"].includes(l.tipo) || ![4, 8].includes(l.fases)) errs.push(`${q}: luna mal descrita`);
    if (l.tipo === "calendario" && !(l.huecos >= 1 && l.huecos <= l.fases - (l.fases === 8 ? 2 : 1))) errs.push(`${q}: huecos fuera de rango`);
    if (!m.foto || !m.foto.titulo || (dibujos && !dibujos.has(m.foto.dibujo))) errs.push(`${q}: falta la foto o su dibujo`);
    if (!Array.isArray(m.textos) || m.textos.length < 3) errs.push(`${q}: lleva al menos 3 textos`);
    for (const t of m.textos || []) {
      const qt = `${q}, texto ${t.id}`;
      if (!ID.test(t.id || "") || ids.has(t.id)) errs.push(`${qt}: id vacío o repetido`);
      ids.add(t.id);
      if (dibujos && !dibujos.has(t.dibujo)) errs.push(`${qt}: no hay dibujo ${t.dibujo}`);
      if (!Array.isArray(t.en) || t.en.length < 3 || t.en.length > 5) errs.push(`${qt}: de 3 a 5 oraciones`);
      if (!Array.isArray(t.es) || t.es.length !== (t.en || []).length) errs.push(`${qt}: la traducción va oración por oración`);
      const p = t.pregunta || {};
      if (!p.en || !p.es || !["idea", "dato"].includes(p.tipo)) errs.push(`${qt}: pregunta mal descrita`);
      if (!Array.isArray(p.opciones) || p.opciones.length !== 3 || p.opciones.some((o) => !o.en || !o.es)) errs.push(`${qt}: 3 opciones con inglés y español`);
      else if (new Set(p.opciones.map((o) => o.en.toLowerCase())).size !== 3) errs.push(`${qt}: opciones repetidas`);
      if (!(Number.isInteger(p.correcta) && p.correcta >= 0 && p.correcta < 3)) errs.push(`${qt}: correcta fuera de rango`);
      if (!Array.isArray(p.pista) || p.pista.some((k) => !(k >= 0 && k < (t.en || []).length))) errs.push(`${qt}: pista fuera de rango`);
      if (p.tipo === "dato" && !(p.pista || []).length) errs.push(`${qt}: una pregunta de dato dice dónde está la respuesta`);
    }
  });
  return errs;
}

// En el navegador: los dos JSON junto al juego. Promesa con { misiones, vocab }.
export function cargarDatos() {
  const url = (f) => new URL(`../datos/${f}`, import.meta.url).href;
  const leer = (f) => fetch(url(f)).then((r) => { if (!r.ok) throw new Error(`${f}: ${r.status}`); return r.json(); });
  return Promise.all([leer("misiones.json"), leer("vocabulario.json")]).then(([misiones, vocab]) => ({ misiones, vocab }));
}
