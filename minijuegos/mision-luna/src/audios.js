// Las grabaciones en inglés que necesita el juego (audio/…mp3). Las usa el juego para saber qué sonar, la
// prueba que revisa que estén todas, y herramientas/grabar.py para grabarlas.
//   t/<texto>-<k>.mp3  oración k de un texto       q/<texto>.mp3     la pregunta
//   o/<texto>-<k>.mp3  opción k (índice del JSON)   p/<palabra>.mp3   la palabra espacial
//   f/<n>.mp3          el nombre de la fase n
// `suelta`: es una palabra o un nombre corto; grabar.py la dice dentro de una frase y la recorta.

export const oracion = (texto, k) => `t/${texto}-${k}.mp3`;
export const pregunta = (texto) => `q/${texto}.mp3`;
export const opcion = (texto, k) => `o/${texto}-${k}.mp3`;
export const palabra = (id) => `p/${id}.mp3`;
export const fase = (n) => `f/${n}.mp3`;

export function audios(misiones, vocab) {
  const lista = [];
  for (const m of misiones.misiones) {
    for (const t of m.textos) {
      t.en.forEach((s, k) => lista.push({ archivo: oracion(t.id, k), texto: s }));
      lista.push({ archivo: pregunta(t.id), texto: t.pregunta.en });
      t.pregunta.opciones.forEach((o, k) => lista.push({ archivo: opcion(t.id, k), texto: o.en }));
    }
  }
  for (const p of vocab.palabras) lista.push({ archivo: palabra(p.id), texto: p.en, suelta: true });
  for (const f of vocab.fases) lista.push({ archivo: fase(f.n), texto: f.en, suelta: true });
  return lista;
}
