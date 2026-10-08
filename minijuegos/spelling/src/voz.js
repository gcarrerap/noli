// La voz en inglés: speechSynthesis del navegador. Escoge la mejor voz en inglés que haya (en-US de preferencia)
// y habla un poco más despacio para niños. Algunos navegadores de TV no tienen voz en inglés: entonces
// Voz.hay es false y el juego enseña la palabra en lugar de decirla.

const PREFERIDAS = /samantha|google us english|aria|jenny|allison|ava|zira|karen|serena|moira/i;

// Escoge la voz: inglés de EE. UU. primero, luego cualquier inglés; dentro de ellas las conocidas por sonar bien.
// Pura (recibe la lista) para poder probarla.
export function escogerVoz(voces) {
  const en = voces.filter((v) => /^en([-_]|$)/i.test(v.lang || ""));
  if (!en.length) return null;
  const peso = (v) => (/^en[-_]us/i.test(v.lang) ? 0 : /^en[-_](gb|au|ca)/i.test(v.lang) ? 1 : 2) * 10 + (PREFERIDAS.test(v.name) ? 0 : 5) + (v.localService ? 0 : 1);
  return [...en].sort((a, b) => peso(a) - peso(b))[0];
}

// Para que la diga letra por letra: "C. A. K. E."
export const letraPorLetra = (palabra) => palabra.toUpperCase().split("").join(". ") + ".";

const sintesis = typeof window !== "undefined" && window.speechSynthesis ? window.speechSynthesis : null;
let voz = null;

// Espera a que el navegador cargue sus voces (llegan tarde en Chrome y Android); a lo más 2 segundos
const listo = new Promise((resolver) => {
  if (!sintesis) return resolver(false);
  const revisar = () => { voz = escogerVoz(sintesis.getVoices()); return !!voz; };
  if (revisar()) return resolver(true);
  let hecho = false;
  const fin = (ok) => { if (!hecho) { hecho = true; resolver(ok); } };
  sintesis.addEventListener?.("voiceschanged", () => { if (revisar()) fin(true); });
  setTimeout(() => fin(revisar()), 2000);
});

export const Voz = {
  listo,
  get hay() { return !!voz; },
  get nombre() { return voz ? `${voz.name} (${voz.lang})` : null; },
  // Dice el texto en inglés. velocidad: 1 normal; para niños 0.85; "despacio" 0.55. Devuelve una promesa que se
  // cumple al terminar (o a los pocos segundos, por si el navegador nunca avisa).
  decir(texto, velocidad = 0.85) {
    if (!sintesis || !voz) return Promise.resolve();
    sintesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.voice = voz; u.lang = voz.lang; u.rate = velocidad; u.pitch = 1.05;
    return new Promise((r) => {
      u.onend = u.onerror = () => r();
      setTimeout(r, 1500 + texto.length * 150 / velocidad);
      sintesis.speak(u);
    });
  },
  callar() { sintesis?.cancel(); },
};
