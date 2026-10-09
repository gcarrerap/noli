// Voz del navegador. Español para los pedidos y para contar.
// Una lista vacía no significa que no haya voz: Chrome la da vacía la primera
// vez, y algunas teles hablan igual. Si hablar falla de verdad, el texto sigue.

let vozEspanola = null;
const preparadas = new WeakSet();

export function esLangEs(lang) {
  const l = String(lang || "").toLowerCase().replace("_", "-");
  return l === "es" || l.startsWith("es-");
}

export function elegirVoz(voces) {
  const lista = Array.isArray(voces) ? voces : [];
  const mx = lista.find((v) => /^es-mx\b/i.test(String(v && v.lang || "").replace("_", "-")));
  if (mx) return mx;
  return lista.find((v) => esLangEs(v && v.lang)) || null;
}

function vocesDe(s) {
  if (!s || typeof s.getVoices !== "function") return null;
  try {
    const lista = s.getVoices();
    return Array.isArray(lista) ? lista : null;
  } catch {
    return null;
  }
}

function tomarVoces(s) {
  const lista = vocesDe(s);
  if (!lista || !lista.length) return;
  const elegida = elegirVoz(lista);
  if (elegida) vozEspanola = elegida;
}

// Llama a getVoices al cargar para que el navegador avise cuando lleguen.
export function prepararVoces(sintesis) {
  const s = sintesis || (typeof window !== "undefined" ? window.speechSynthesis : null);
  if (!s || typeof s.getVoices !== "function") return;
  try { tomarVoces(s); } catch { /* la lista puede llegar después */ }
  if (preparadas.has(s)) return;
  preparadas.add(s);
  if (typeof s.addEventListener === "function") s.addEventListener("voiceschanged", () => tomarVoces(s));
  else s.onvoiceschanged = () => tomarVoces(s);
}

// true: la frase terminó. false: error, o no llegó a sonar.
// Lista vacía: se habla igual, sin voz concreta, en es-MX. Si speak lanza, false.
export function decir(texto, lang, alTerminar) {
  const s = typeof window !== "undefined" ? window.speechSynthesis : null;
  const U = typeof window !== "undefined" ? window.SpeechSynthesisUtterance : null;
  if (!s || !U || !texto) return false;
  tomarVoces(s);
  let aviso = false;
  const fin = (ok) => {
    if (aviso) return;
    aviso = true;
    if (typeof alTerminar === "function") alTerminar(ok);
  };
  try {
    if (s.speaking || s.pending) s.cancel();
    const u = new U(texto);
    const pedido = esLangEs(lang) ? String(lang).replace("_", "-") : "es-MX";
    u.lang = vozEspanola && esLangEs(vozEspanola.lang) ? String(vozEspanola.lang).replace("_", "-") : pedido;
    if (!esLangEs(u.lang)) u.lang = "es-MX";
    if (vozEspanola) u.voice = vozEspanola;
    u.rate = 0.92;
    u.onend = () => fin(true);
    u.onerror = () => fin(false);
    s.speak(u);
    return true;
  } catch {
    return false;
  }
}

prepararVoces();
