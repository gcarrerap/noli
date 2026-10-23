// El modo secreto del búho (#166), la parte pura: normalizar lo que se escribe, el SHA-256 (en JS puro: crypto.subtle
// puede no estar en todas las TVs y así se prueba en Node) y el reloj de los minutos que dura. En el repo solo está el
// hash de la frase (mundo/buho.json), nunca la frase. Ver docs/MUNDO.md § Modo secreto.

/** Minúsculas, sin acentos y sin nada que no sea letra o número (espacios, ¡!, comas…) */
export function normalizarFrase(texto) {
  return String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ]/g, "").replace(/ñ/g, "n");
}

/** SHA-256 (hex) de un texto en UTF-8 */
export function sha256(texto) {
  const bytes = new TextEncoder().encode(String(texto));
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
    0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
    0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const largo = bytes.length, n = Math.ceil((largo + 9) / 64) * 64;
  const m = new Uint8Array(n);
  m.set(bytes); m[largo] = 0x80;
  const bits = largo * 8;
  const dv = new DataView(m.buffer);
  dv.setUint32(n - 8, Math.floor(bits / 0x100000000)); dv.setUint32(n - 4, bits >>> 0);
  const w = new Uint32Array(64);
  const rotr = (x, k) => (x >>> k) | (x << (32 - k));
  for (let o = 0; o < n; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  return [...H].map((x) => x.toString(16).padStart(8, "0")).join("");
}

/** ¿Lo que escribió es la frase secreta? (compara el hash de lo normalizado; vacío nunca) */
export const esFraseSecreta = (texto, hash) => { const t = normalizarFrase(texto); return !!t && !!hash && sha256(t) === String(hash).toLowerCase(); };

/** Lo que falta del modo secreto: "9:59" (o "0:00") */
export function relojSecreto(hasta, ahora) {
  const s = Math.max(0, Math.ceil((hasta - ahora) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Una pregunta al azar, distinta de la anterior si se puede */
export function otraPregunta(preguntas, anterior, rnd = Math.random) {
  if (!preguntas.length) return "";
  const opciones = preguntas.length > 1 ? preguntas.filter((p) => p !== anterior) : preguntas;
  return opciones[Math.floor(rnd() * opciones.length)];
}

/** Errores en mundo/buho.json (lista vacía si todo está bien) */
export function revisarBuho(b) {
  const e = [], num = (v) => typeof v === "number" && isFinite(v);
  if (!b || typeof b !== "object") return ["buho.json no es un objeto"];
  if (!num(b.x) || !num(b.z) || !num(b.radio) || !num(b.acercarse)) e.push("buho: faltan x, z, radio o acercarse");
  if (!num(b.minutos) || b.minutos <= 0) e.push("buho: minutos debe ser un número");
  if (!/^[0-9a-f]{64}$/.test(String(b.hash))) e.push("buho: hash debe ser un SHA-256 (64 letras hex)");
  if (!Array.isArray(b.preguntas) || b.preguntas.length < 5) e.push("buho: hacen falta al menos 5 preguntas");
  if (!Array.isArray(b.respuestas) || b.respuestas.length < 3) e.push("buho: hacen falta al menos 3 respuestas");
  return e;
}

/** El búho como sólido para la física (no se le atraviesa) */
export const solidoBuho = (b) => ({ id: "buho", tipo: "cilindro", x: b.x, z: b.z, r: b.radio, y0: 0, y1: 1.7 });

/** ¿El personaje está junto al búho? (con los pies en el piso) */
export const juntoAlBuho = (c, b) => c.y < 0.3 && Math.hypot(c.x - b.x, c.z - b.z) < b.radio + b.acercarse;
