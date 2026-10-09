// Física sencilla para caminar, brincar y pararse sobre plataformas. Lógica pura (no usa Three.js): la escena solo
// dibuja donde esto diga, y las pruebas la corren en Node. La usa el mundo del menú principal (#25).
//
// El mundo es un piso plano (y = 0) con sólidos encima. Un sólido es una caja o un cilindro con piso (y0) y techo (y1):
//   { tipo: "caja", x0, x1, z0, z1, y0, y1 }      { tipo: "cilindro", x, z, r, y0, y1 }
// El personaje es un cilindro de radio `radio` y alto `alto`, con los pies en y.
//
// Reglas (ver docs/MUNDO.md § Física):
//   - Choca de lado con un sólido si el techo del sólido está más alto que sus pies + `escalon` y el piso del sólido
//     más bajo que su cabeza. Lo que es más bajito que un escalón se sube caminando.
//   - Se para sobre el techo más alto que tenga debajo (con un margen, para poder pararse en la orilla).
//   - Brinco: velocidad hacia arriba para subir `brinco` metros. Un brinco por pulsación y solo con los pies en algo.
//     Tiempo de gracia: se puede brincar un ratito después de salir de una orilla (`coyote`) y apretar un poco antes
//     de caer cuenta (`memoria`), porque el control de la TV tiene retraso.
//   - En el aire se sigue mandando con el joystick; si se suelta, conserva la velocidad con la que brincó.
//   - Caer nunca castiga: no hay daño ni hoyos. Lo más bajo es el piso.

/** Ajustes por omisión (el mundo los cambia en mundo/mundo.json → movimiento) */
export const FISICA = Object.freeze({
  velocidad: 3.4,   // m/s caminando
  giro: 420,        // grados/s que gira el cuerpo hacia donde camina (solo se ve; el paso va a donde apunta la entrada)
  radio: 0.35,      // m
  alto: 1.3,        // m, de los pies a la cabeza
  escalon: 0.3,     // m que se suben sin brincar
  brinco: 1.25,     // m que sube un brinco
  gravedad: 20,     // m/s²
  coyote: 0.12,     // s que todavía se puede brincar después de salir de una orilla
  memoria: 0.15,    // s que se recuerda un brinco apretado antes de tocar el piso
  margen: 0.6,      // fracción del radio que puede quedar fuera de la orilla y seguir parado
});

const ajustes = (cfg) => Object.assign({}, FISICA, cfg || {});

/** Distancia horizontal de un punto a la huella de un sólido (0 si está adentro) */
export function distanciaHuella(s, x, z) {
  if (s.tipo === "cilindro") return Math.max(0, Math.hypot(x - s.x, z - s.z) - s.r);
  const dx = Math.max(s.x0 - x, 0, x - s.x1), dz = Math.max(s.z0 - z, 0, z - s.z1);
  return Math.hypot(dx, dz);
}

/** Distancia más corta entre las huellas de dos sólidos (0 si se enciman) */
export function separacion(a, b) {
  if (a.tipo === "cilindro" && b.tipo === "cilindro") return Math.max(0, Math.hypot(a.x - b.x, a.z - b.z) - a.r - b.r);
  if (a.tipo === "cilindro") return Math.max(0, distanciaHuella(b, a.x, a.z) - a.r);
  if (b.tipo === "cilindro") return Math.max(0, distanciaHuella(a, b.x, b.z) - b.r);
  const dx = Math.max(0, a.x0 - b.x1, b.x0 - a.x1), dz = Math.max(0, a.z0 - b.z1, b.z0 - a.z1);
  return Math.hypot(dx, dz);
}

/** Centro de la huella de un sólido */
export const centro = (s) => (s.tipo === "cilindro" ? { x: s.x, z: s.z } : { x: (s.x0 + s.x1) / 2, z: (s.z0 + s.z1) / 2 });

/**
 * ¿Choca de lado el personaje parado en (x, y, z)?
 * @param {{ solidos: object[], limites: {x0,x1,z0,z1} }} mapa
 */
export function chocaEn(x, y, z, mapa, cfg) {
  const c = ajustes(cfg), l = mapa.limites, r = c.radio;
  if (l && (x - r < l.x0 || x + r > l.x1 || z - r < l.z0 || z + r > l.z1)) return true;
  for (const s of mapa.solidos) {
    if (s.y1 <= y + c.escalon || s.y0 >= y + c.alto) continue; // se sube caminando, o pasa por debajo
    if (distanciaHuella(s, x, z) < r) return true;
  }
  return false;
}

/** Altura de lo más alto que hay debajo de (x, z) sin pasar de `yMax` (el piso es 0) */
export function alturaBajo(x, z, yMax, mapa, cfg) {
  const c = ajustes(cfg), m = c.radio * c.margen;
  let h = 0;
  for (const s of mapa.solidos) if (s.y1 <= yMax + 1e-6 && s.y1 > h && distanciaHuella(s, x, z) <= m) h = s.y1;
  return h;
}

/** Un cuerpo nuevo parado en el piso */
export const crearCuerpo = (x, z, ang = 0, y = 0) => ({ x, y, z, ang, vy: 0, vx: 0, vz: 0, enSuelo: true, coyote: 0, memoria: 0 });

/**
 * Un cuadro de física.
 * @param {object} c cuerpo (de crearCuerpo); no se modifica
 * @param {{ quiere: {x: number, z: number}, brincar?: boolean }} entrada dirección en pantalla (largo 0 a 1) y si se
 *   apretó brincar en este cuadro
 * @param {number} dt segundos (quien llama lo limita; 50 ms máximo)
 * @param {object} cfg ajustes (FISICA)
 * @param {object} mapa { solidos, limites }
 * @returns {{ c: object, caminando: boolean, brinco: boolean, aterrizo: boolean }}
 */
export function pasoFisico(c0, entrada, dt, cfg, mapa) {
  const k = ajustes(cfg);
  const c = Object.assign({}, c0);
  let q = entrada.quiere || { x: 0, z: 0 };
  let largo = Math.hypot(q.x, q.z);
  if (largo > 1) { q = { x: q.x / largo, z: q.z / largo }; largo = 1; }
  const mueve = largo >= 0.08;
  let brinco = false, aterrizo = false;

  c.memoria = entrada.brincar ? k.memoria : Math.max(0, c.memoria - dt);

  // ---- Horizontal ----
  if (mueve) { c.vx = q.x * k.velocidad; c.vz = q.z * k.velocidad; }
  else if (c.enSuelo) { c.vx = 0; c.vz = 0; } // en el aire sin joystick: conserva la velocidad del brinco
  const dx = c.vx * dt, dz = c.vz * dt;
  if ((dx || dz) && chocaEn(c.x, c.y, c.z, mapa, k)) { c.x += dx; c.z += dz; } // quedó adentro de algo: que pueda salir
  else if (dx || dz) {
    if (!chocaEn(c.x + dx, c.y, c.z + dz, mapa, k)) { c.x += dx; c.z += dz; }
    else if (dx && !chocaEn(c.x + dx, c.y, c.z, mapa, k)) { c.x += dx; c.vz = 0; }
    else if (dz && !chocaEn(c.x, c.y, c.z + dz, mapa, k)) { c.z += dz; c.vx = 0; }
    else { c.vx = 0; c.vz = 0; }
  }
  if (mueve) {
    const objetivo = Math.atan2(-q.x, -q.z) * 180 / Math.PI;
    let d = (objetivo - c.ang) % 360;
    if (d > 180) d -= 360;
    if (d <= -180) d += 360;
    const max = k.giro * dt;
    c.ang += Math.max(-max, Math.min(max, d));
  }

  // ---- Vertical ----
  if (c.memoria > 0 && (c.enSuelo || c.coyote > 0)) {
    c.vy = Math.sqrt(2 * k.gravedad * k.brinco);
    c.enSuelo = false; c.coyote = 0; c.memoria = 0; brinco = true;
  }
  if (c.enSuelo) {
    const h = alturaBajo(c.x, c.z, c.y + k.escalon, mapa, k);
    if (h >= c.y - k.escalon) { c.y = h; c.vy = 0; } // sube o baja un escalón sin brincar
    else { c.enSuelo = false; c.coyote = k.coyote; c.vy = 0; } // se salió de la orilla
  }
  if (!c.enSuelo) {
    if (!brinco) c.coyote = Math.max(0, c.coyote - dt);
    c.vy -= k.gravedad * dt;
    let ny = c.y + c.vy * dt;
    if (c.vy > 0) { // ¿se pega en la cabeza con algo?
      for (const s of mapa.solidos) {
        if (s.y0 >= c.y + k.alto - 0.05 && s.y0 < ny + k.alto && distanciaHuella(s, c.x, c.z) < k.radio * 0.7) { ny = s.y0 - k.alto; c.vy = 0; }
      }
    }
    if (c.vy <= 0) {
      // Cae en lo más alto que tenga debajo; si lo que hay está apenas arriba de los pies (menos de un escalón), se
      // sube a la orilla en lugar de atravesarlo
      const h = alturaBajo(c.x, c.z, c.y + k.escalon, mapa, k);
      if (ny <= h) { ny = h; c.vy = 0; c.enSuelo = true; c.coyote = 0; aterrizo = true; }
    }
    c.y = ny;
  }
  return { c, caminando: mueve && c.enSuelo, brinco, aterrizo };
}

/**
 * ¿Se puede ir en línea recta por el piso de a a b sin chocar? (revisa cada 10 cm, con los pies en y)
 */
export function libre(a, b, mapa, cfg, y = 0) {
  const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(d / 0.1));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (chocaEn(a.x + (b.x - a.x) * t, y, a.z + (b.z - a.z) * t, mapa, cfg)) return false;
  }
  return true;
}

/**
 * Qué tan lejos (horizontal) llega un brinco que termina `dh` metros más arriba (o más abajo, si es negativo).
 * null si no se alcanza esa altura.
 */
export function alcanceBrinco(dh, cfg) {
  const k = ajustes(cfg), v0 = Math.sqrt(2 * k.gravedad * k.brinco);
  const disc = v0 * v0 - 2 * k.gravedad * dh;
  if (disc < 0) return null;
  const t = (v0 + Math.sqrt(disc)) / k.gravedad; // subir y bajar hasta dh
  return k.velocidad * t;
}

/**
 * Qué plataformas se pueden alcanzar brincando, desde el piso o desde otra plataforma alcanzable. Se pide holgura
 * (solo el 85 % de la altura y el 75 % del alcance) para que los brincos no sean de precisión: Noelia tiene 7 años y
 * la TV tiene retraso.
 * @param {object[]} plataformas sólidos (con id)
 * @returns {Set<string>} ids alcanzables
 */
export function alcanzables(plataformas, cfg, holgura = { alto: 0.85, lejos: 0.75 }) {
  const k = ajustes(cfg);
  const ok = new Set();
  const puede = (desde, hasta) => {
    const dh = hasta.y1 - desde;
    if (dh > k.brinco * holgura.alto) return false;
    return true;
  };
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const p of plataformas) {
      if (ok.has(p.id)) continue;
      // Desde el piso: alrededor hay piso (las plataformas que flotan sobre otra no cuentan como "desde el piso")
      let llega = puede(0, p);
      if (!llega) {
        for (const o of plataformas) {
          if (!ok.has(o.id) || !puede(o.y1, p)) continue;
          const alcance = alcanceBrinco(p.y1 - o.y1, k);
          // El centro del personaje puede salir desde la orilla y caer con un margen adentro de la otra
          if (alcance !== null && separacion(o, p) - 2 * k.radio * k.margen <= alcance * holgura.lejos) { llega = true; break; }
        }
      }
      if (llega) { ok.add(p.id); cambio = true; }
    }
  }
  return ok;
}
