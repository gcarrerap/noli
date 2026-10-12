// La guía: una tarjeta la primera vez que llega a cada etapa, y la pista de cada paso (una línea).
// `tv`: con el control se dice «Pulsa OK» en vez de «Toca».

export const GUIAS = {
  combustible: { titulo: "1. Combustible", texto: "Lee el texto en inglés y contesta. Cada respuesta llena un tanque del cohete.", leer: "Lee el texto en inglés y contesta. Cada respuesta llena un tanque del cohete." },
  viaje: { titulo: "2. El viaje", texto: "En el camino hay palabras espaciales. Busca el dibujo de cada palabra.", leer: "En el camino hay palabras espaciales. Busca el dibujo de cada palabra." },
  calendario: { titulo: "3. En la Luna", texto: "La Luna cambia cada noche. Toma una luna de abajo y ponla en su día.", leer: "La Luna cambia cada noche. Toma una luna de abajo y ponla en su día." },
  noche: { titulo: "3. En la Luna", texto: "Mira cómo se ve la Luna hoy. ¿Cómo se verá después?", leer: "Mira cómo se ve la Luna hoy. ¿Cómo se verá después?" },
};

export function pista(paso, { tv = false, tomada = false } = {}) {
  const t = (tactil, control) => (tv ? control : tactil);
  switch (paso) {
    case "leer": return t("Lee el texto. Toca «Escuchar» si quieres oírlo. Luego, «Ya lo leí».", "Lee el texto. Luego pulsa OK en «Ya lo leí».");
    case "pregunta": return t("Toca la respuesta.", "Elige la respuesta y pulsa OK.");
    case "palabra": return t("Toca el dibujo de la palabra.", "Elige el dibujo de la palabra y pulsa OK.");
    case "calendario": return tomada
      ? t("Ahora toca el día donde va.", "Muévete al día con las flechas y pulsa OK.")
      : t("Toca una luna de abajo.", "Elige una luna de abajo y pulsa OK.");
    case "noche": return t("Toca la Luna que se verá.", "Elige la Luna que se verá y pulsa OK.");
    default: return "";
  }
}

// Cómo cambia la Luna: la ayuda del calendario y de «¿Cómo se verá?» (después del primer error).
export const AYUDA_FASES = "La Luna se ilumina por la derecha hasta estar llena; luego se apaga por la derecha hasta ser nueva.";
