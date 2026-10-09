// Simula cuántas pasarelas toma llegar a cada nivel de estilo, con tres maneras de jugar, para revisar la curva de
// desbloqueo (datos/desbloqueos.json) después de cambiar niveles, prendas o la fórmula de los jueces.
//
//   node minijuegos/pasarela/herramientas/simular-curva.mjs            (tabla en la consola)
//   node minijuegos/pasarela/herramientas/simular-curva.mjs --md       (tabla en Markdown, para docs/JUEGO.md)
//
// Jugadoras simuladas (200 cada una, temas al azar entre los abiertos, como en el juego):
//   - "con cuidado": en cada parte escoge la prenda abierta que mejor va con el tema y un color del tema, y un accesorio;
//   - "a medias": la mejor prenda la mitad de las veces y una al azar la otra mitad; a veces sin accesorio;
//   - "al azar": prendas y colores al azar (lo peor que puede pasar).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { revisarDatos, indexar, ARCHIVOS } from "../src/datos.js";
import { atuendoVacio, poner } from "../src/atuendo.js";
import { calificar, encaje } from "../src/puntuacion.js";
import { progresoNuevo, abiertos, nivelDe, registrarPasarela, escogerTema, coloresDe } from "../src/progreso.js";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const d = Object.fromEntries(Object.entries(ARCHIVOS).map(([k, f]) => [k, JSON.parse(fs.readFileSync(path.join(raiz, "datos", f), "utf8"))]));
const errores = revisarDatos(d);
if (errores.length) { console.error(errores.join("\n")); process.exit(1); }
const idx = indexar(d);

// Generador de números al azar con semilla (para que la tabla salga igual cada vez)
function semilla(n) { return () => { n = (n * 1664525 + 1013904223) % 4294967296; return n / 4294967296; }; }

function vestir(tema, ab, estilo, rnd) {
  let a = atuendoVacio();
  const escoger = (lista) => {
    if (!lista.length) return null;
    const mejor = [...lista].sort((x, y) => encaje(y, tema) - encaje(x, tema))[0];
    if (estilo === "con cuidado") return mejor;
    if (estilo === "a medias") return rnd() < 0.5 ? mejor : lista[Math.floor(rnd() * lista.length)];
    return lista[Math.floor(rnd() * lista.length)];
  };
  const color = (p) => {
    const cs = coloresDe(p, ab);
    const delTema = cs.filter((c) => tema.colores.includes(c));
    if (estilo === "al azar" || !delTema.length || (estilo === "a medias" && rnd() < 0.5)) return cs[Math.floor(rnd() * cs.length)];
    return delTema[0];
  };
  const de = (cat) => idx.porCategoria.get(cat).filter((p) => ab.prendas.has(p.id));
  for (const cat of ["peinado", "zapatos"]) { const p = escoger(de(cat)); if (p) a = poner(a, p, color(p)); }
  const vestido = escoger(de("vestido")), arriba = escoger(de("arriba")), abajo = escoger(de("abajo"));
  const vVestido = vestido ? encaje(vestido, tema) : -9, vSeparado = ((arriba ? encaje(arriba, tema) : -9) + (abajo ? encaje(abajo, tema) : -9)) / 2;
  if (vestido && (vVestido > vSeparado || (estilo === "al azar" && rnd() < 0.3))) a = poner(a, vestido, color(vestido));
  else { if (arriba) a = poner(a, arriba, color(arriba)); if (abajo) a = poner(a, abajo, color(abajo)); }
  if (estilo !== "al azar" || rnd() < 0.5) { const acc = escoger(de("accesorio")); if (acc && (estilo === "con cuidado" || rnd() < 0.6)) a = poner(a, acc, color(acc)); }
  return a;
}

const ESTILOS = ["con cuidado", "a medias", "al azar"];
const VECES = 200, MAX = 80;
const resultados = {};
for (const estilo of ESTILOS) {
  const llegadas = idx.niveles.map(() => []);
  let puntosTotal = 0, pasarelas = 0;
  for (let v = 0; v < VECES; v++) {
    const rnd = semilla(1000 + v * 7 + estilo.length);
    let pr = progresoNuevo();
    for (let n = 1; n <= MAX; n++) {
      const ab = abiertos(pr.puntos, idx.niveles);
      const tema = idx.temas.get(escogerTema([...ab.temas], pr.ultimoTema, rnd));
      const atu = vestir(tema, ab, estilo, rnd);
      const r = calificar(atu, tema, idx, { prendas: ab.prendas, colores: ab.colores });
      const antes = nivelDe(pr.puntos, idx.niveles).i;
      pr = registrarPasarela(pr, { tema: tema.id, atuendo: atu, jueces: r.jueces, puntos: r.puntos }, 0, idx).progreso;
      puntosTotal += r.puntos; pasarelas++;
      const despues = nivelDe(pr.puntos, idx.niveles).i;
      for (let i = antes + 1; i <= despues; i++) llegadas[i].push(n);
    }
  }
  resultados[estilo] = { llegadas, promedio: puntosTotal / pasarelas };
}

const mediana = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const md = process.argv.includes("--md");
const filas = idx.niveles.map((n, i) => [n.nombre, n.puntos, ...ESTILOS.map((e) => (i === 0 ? 0 : mediana(resultados[e].llegadas[i]) ?? `> ${MAX}`))]);
if (md) {
  console.log(`| Nivel | Puntos | ${ESTILOS.map((e) => `Pasarelas (${e})`).join(" | ")} |`);
  console.log(`|---|---|${ESTILOS.map(() => "---").join("|")}|`);
  for (const f of filas) console.log(`| ${f.join(" | ")} |`);
  console.log(`\nPuntos por pasarela en promedio: ${ESTILOS.map((e) => `${e} ${resultados[e].promedio.toFixed(1)}`).join(" · ")}. Mediana de ${VECES} jugadoras simuladas por estilo.`);
} else {
  console.table(filas.map((f) => Object.fromEntries([["nivel", f[0]], ["puntos", f[1]], ...ESTILOS.map((e, i) => [e, f[2 + i]])])));
  for (const e of ESTILOS) console.log(`${e}: ${resultados[e].promedio.toFixed(1)} puntos por pasarela`);
}
