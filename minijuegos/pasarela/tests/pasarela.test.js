// Pruebas de la Pasarela (#19): datos, atuendo, puntuación y comentarios, progreso y desbloqueos, movimiento y
// choques, máquina de estados, dibujos 2D, y que cada prenda se pueda armar en 3D (Three.js corre en Node sin WebGL
// para crear geometrías). Se corren con `npm test` desde la raíz del repo.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { revisarDatos, indexar, ARCHIVOS, ANCLAS, prendasDeZona, ENFOQUES: ENFOQUES_DATOS, arteDe, aceptaPatron } = await import("../src/datos.js");
const A = await import("../src/atuendo.js");
const { calificar, componentes, encaje, estrellasNoli, estrellasJuez, comentar } = await import("../src/puntuacion.js");
const PR = await import("../src/progreso.js");
const M = await import("../src/movimiento.js");
const { siguiente, quedan, reloj, TRANSICIONES } = await import("../src/partida.js");
const { FIGURAS_2D, dibujarMuneca, miniPrenda } = await import("../src/ui/dibujo2d.js");
const E = await import("../src/espanol.js");

const leer = () => Object.fromEntries(Object.entries(ARCHIVOS).map(([k, f]) => [k, JSON.parse(fs.readFileSync(path.join(raiz, "datos", f), "utf8"))]));
const D = leer();
// El arte de patrones y estampados, como lo hace cargar.js en el navegador
for (const { archivo, x } of arteDe(D)) x.svg = fs.readFileSync(path.join(raiz, archivo), "utf8");
const idx = indexar(D);
const vestir = (lista) => lista.reduce((a, [id, c]) => A.poner(a, idx.prendas.get(id), c), A.atuendoVacio());

// ---------- Datos ----------

test("datos: los JSON del juego no tienen errores", () => {
  assert.deepEqual(revisarDatos(D), []);
});

test("datos: lo que pide el issue (5 categorías, 40+ prendas, 10+ temas, 3 jueces, 4+ niveles)", () => {
  assert.ok(D.config.categorias.length >= 5);
  assert.ok(D.prendas.prendas.length >= 40, `${D.prendas.prendas.length} prendas`);
  assert.ok(D.temas.temas.length >= 10);
  assert.equal(D.jueces.jueces.length, 3);
  assert.ok(D.desbloqueos.niveles.length >= 4);
  for (const p of D.prendas.prendas) assert.ok(p.es && p.en, `${p.id} con nombre en español e inglés`);
  for (const c of D.colores.colores) assert.ok(c.es && c.en, `${c.id} con nombre en español e inglés`);
});

test("datos: revisarDatos encuentra los errores típicos al editar a mano", () => {
  const d = leer();
  d.prendas.prendas[0].categoria = "sombreros";
  d.prendas.prendas[1].colores.push("fucsia");
  d.prendas.prendas[2].piezas[0].a = "rodilla";
  d.prendas.prendas[3].piezas[0].f = "estrella";
  d.prendas.prendas.push({ ...d.prendas.prendas[4], id: "a-nueva" }); // nueva sin nivel
  d.temas.temas[0].etiquetas.surf = 3;
  d.jueces.jueces[0].pesos.tema = 0.9;
  const e = revisarDatos(d).join("\n");
  for (const pista of ["categoría \"sombreros\"", "color \"fucsia\"", "ancla \"rodilla\"", "forma \"estrella\"", "a-nueva: no se abre", "etiqueta \"surf\"", "deben sumar 1"])
    assert.ok(e.includes(pista), pista);
});

test("datos: el tema inicial siempre se puede vestir con el clóset inicial", () => {
  const ab = PR.abiertosHasta(0, idx.niveles);
  for (const t of ab.temas) {
    const tema = idx.temas.get(t);
    const buenas = [...ab.prendas].filter((id) => encaje(idx.prendas.get(id), tema) >= 2);
    assert.ok(buenas.length >= 2, `${t}: hay ropa que le queda`);
  }
});

// ---------- Atuendo ----------

test("atuendo: el vestido quita arriba y abajo, y al revés", () => {
  let a = vestir([["a-camiseta", "rosa"], ["b-shorts", "azul"]]);
  a = A.poner(a, idx.prendas.get("v-verano"), "amarillo");
  assert.equal(a.arriba, null); assert.equal(a.abajo, null); assert.equal(a.vestido.id, "v-verano");
  a = A.poner(a, idx.prendas.get("b-falda"), "rosa");
  assert.equal(a.vestido, null); assert.equal(a.abajo.id, "b-falda");
});

test("atuendo: tocar dos veces quita; otro color reemplaza; un accesorio por lugar", () => {
  let a = A.poner(A.atuendoVacio(), idx.prendas.get("a-camiseta"), "rosa");
  a = A.poner(a, idx.prendas.get("a-camiseta"), "azul");
  assert.equal(a.arriba.color, "azul");
  a = A.poner(a, idx.prendas.get("a-camiseta"), "azul");
  assert.equal(a.arriba, null);
  a = A.poner(a, idx.prendas.get("x-sombrero"), "amarillo");
  a = A.poner(a, idx.prendas.get("x-corona"), "dorado"); // misma cabeza: reemplaza
  a = A.poner(a, idx.prendas.get("x-lentes"), "rosa");   // cara: se suma
  assert.deepEqual(Object.keys(a.accesorios).sort(), ["cabeza", "cara"]);
  assert.equal(a.accesorios.cabeza.id, "x-corona");
  assert.equal(A.quitar(a, "cara").accesorios.cara, undefined);
});

test("atuendo: frase en inglés con artículos y plurales", () => {
  const a = vestir([["p-cola", "cafe"], ["a-camiseta", "rosa"], ["b-shorts", "azul"], ["z-tenis", "blanco"], ["x-mochila", "naranja"]]);
  assert.equal(A.fraseIngles(a, idx), "a brown ponytail, a pink T-shirt, blue shorts, white sneakers and an orange backpack");
  assert.equal(A.fraseIngles(A.atuendoVacio(), idx), "");
});

test("atuendo: limpiar quita lo que ya no existe o está en otro lugar", () => {
  const a = A.limpiar({ arriba: { id: "a-camiseta", color: "rosa" }, abajo: { id: "a-camiseta", color: "rosa" }, zapatos: { id: "z-patines", color: "rosa" },
    accesorios: { cara: { id: "x-lentes", color: "negro" }, mano: { id: "x-lentes", color: "negro" } } }, idx);
  assert.equal(a.arriba.id, "a-camiseta"); assert.equal(a.abajo, null); assert.equal(a.zapatos, null);
  assert.deepEqual(Object.keys(a.accesorios), ["cara"]);
});

// ---------- Puntuación ----------

const PLAYA = vestir([["p-cola", "cafe"], ["a-tirantes", "amarillo"], ["b-shorts", "blanco"], ["z-sandalias", "rosa"], ["x-lentes", "rosa"]]);

test("puntuación: encaje con el tema (−2 a 3)", () => {
  const playa = idx.temas.get("playa");
  assert.equal(encaje(idx.prendas.get("a-tirantes"), playa), 3);
  assert.equal(encaje(idx.prendas.get("a-chamarra"), playa), -2);
  assert.equal(encaje(idx.prendas.get("a-camisa"), playa), -2, "elegante se evita en la playa");
  assert.equal(encaje(idx.prendas.get("z-tenis"), playa), 1, "casual: un poco");
});

test("puntuación: ejemplo trabajado de docs/JUEGO.md (playa perfecta = 15 puntos)", () => {
  const playa = idx.temas.get("playa");
  const k = componentes(PLAYA, playa, idx);
  assert.deepEqual({ ...k, color: +k.color.toFixed(3) }, { tema: 1, color: 1, completo: 1, detalles: 0.7, enTema: 1, distintos: 3 });
  const r = calificar(PLAYA, playa, idx);
  assert.deepEqual(r.jueces.map((j) => j.estrellas), [5, 5, 5]);
  assert.equal(r.puntos, 15); assert.equal(r.estrellas, 3);
  assert.equal(r.consejo, "¡No le cambiaría nada!");
});

test("puntuación: el mismo atuendo en un tema que no va saca poco y da consejos útiles", () => {
  const r = calificar(PLAYA, idx.temas.get("invierno"), idx);
  assert.ok(r.puntos <= 7, String(r.puntos));
  // Ejemplo trabajado 2 de docs/JUEGO.md
  assert.equal(r.puntos, 6);
  assert.equal(+r.componentes.color.toFixed(3), 0.475);
  assert.deepEqual(r.jueces.map((j) => j.positivo), ["¡Me gusta cómo queda la blusa de tirantes!", "¡Me encanta el blanco de tus shorts!", "¡No te faltó nada, de la cabeza a los pies!"]);
  assert.equal(r.consejo, "Un suéter iría mejor que la blusa de tirantes.");
  assert.equal(r.estrellas, 1);
  assert.match(r.jueces[0].mejora, /iría mejor que la blusa de tirantes/);
  assert.match(r.jueces[1].mejora, /prueba colores como blanco o celeste/);
});

test("puntuación: nunca menos de 1 estrella por juez; sin ropa, 0 estrellas de Noli", () => {
  const r = calificar(A.atuendoVacio(), idx.temas.get("gala"), idx);
  assert.deepEqual(r.jueces.map((j) => j.estrellas), [1, 1, 1]);
  assert.equal(r.estrellas, 0);
  assert.equal(estrellasJuez(-1), 1); assert.equal(estrellasJuez(2), 5);
  assert.equal(estrellasNoli(13), 3); assert.equal(estrellasNoli(10), 2); assert.equal(estrellasNoli(9), 1);
});

test("puntuación: sugiere solo ropa que ya tiene, y es determinista", () => {
  const a = vestir([["p-cola", "cafe"], ["a-tirantes", "amarillo"], ["b-shorts", "blanco"], ["z-sandalias", "rosa"]]);
  const ab = PR.abiertosHasta(0, idx.niveles);
  const tema = idx.temas.get("escuela");
  const c = comentar("estrella", a, tema, idx, ab.prendas, ab.colores);
  const sugerida = c.mejora && D.prendas.prendas.find((p) => c.mejora.toLowerCase().includes(p.es));
  if (sugerida) assert.ok(ab.prendas.has(sugerida.id), `sugirió ${sugerida.id}, que no tiene`);
  assert.deepEqual(calificar(a, tema, idx), calificar(a, tema, idx));
});

test("puntuación: los comentarios concuerdan en género y número", () => {
  const corona = idx.prendas.get("x-corona"), lentes = idx.prendas.get("x-lentes"), tenis = idx.prendas.get("z-tenis");
  assert.equal(E.conEl(corona), "la corona"); assert.equal(E.conEl(lentes), "los lentes de sol");
  assert.equal(E.concuerda("perfecto", corona), "perfecta"); assert.equal(E.concuerda("perfecto", tenis), "perfectos");
  assert.equal(E.conUn(idx.prendas.get("z-sandalias")), "unas sandalias");
  const r = calificar(vestir([["x-corona", "dorado"], ["v-princesa", "rosa"]]), idx.temas.get("princesa"), idx);
  for (const j of r.jueces) assert.doesNotMatch(j.positivo + " " + (j.mejora || ""), /undefined|null|\$\{/);
});

// ---------- Progreso y desbloqueos ----------

test("progreso: niveles, lo abierto y lo que falta", () => {
  assert.equal(PR.nivelDe(0, idx.niveles).nombre, "Principiante");
  assert.deepEqual(PR.nivelDe(15, idx.niveles).siguiente, { nombre: "Aprendiz", puntos: 16, faltan: 1 });
  assert.equal(PR.nivelDe(16, idx.niveles).i, 1);
  assert.equal(PR.nivelDe(99999, idx.niveles).siguiente, null);
  const ab = PR.abiertos(51, idx.niveles); // Curiosa
  assert.ok(ab.prendas.has("x-gorro") && ab.temas.has("invierno") && ab.colores.has("verde") && ab.poses.has("vuelta"));
  assert.ok(!ab.prendas.has("v-gala") && !ab.poses.has("robot"));
  assert.deepEqual([...PR.abiertosHasta(0, idx.niveles).poses], ["cintura", "saludo", "estrella"]);
  assert.deepEqual(PR.coloresDe(idx.prendas.get("a-camiseta"), PR.abiertosHasta(0, idx.niveles)), ["blanco", "rosa", "azul", "amarillo", "rojo", "negro"]);
});

test("progreso: registrar una pasarela suma puntos, guarda la foto y dice qué se abrió", () => {
  const pr = { ...PR.progresoNuevo(), puntos: 20 };
  const r = calificar(PLAYA, idx.temas.get("playa"), idx);
  const reg = PR.registrarPasarela(pr, { tema: "playa", atuendo: PLAYA, jueces: r.jueces, puntos: r.puntos }, 123, idx);
  assert.equal(reg.progreso.puntos, 35); assert.equal(reg.progreso.pasarelas, 1);
  assert.equal(reg.subio, true); assert.equal(reg.nivel.nombre, "Con estilo");
  assert.deepEqual(reg.nuevos, { prendas: ["b-pantalon"], colores: [], temas: [], poses: ["vuelta"], patrones: ["corazones"], estampados: [] });
  assert.deepEqual(reg.progreso.atuendos[0], { fecha: 123, tema: "playa", atuendo: PLAYA, estrellas: [5, 5, 5], puntos: 15 });
  const sin = PR.registrarPasarela({ ...PR.progresoNuevo(), puntos: 35 }, { tema: "playa", atuendo: PLAYA, jueces: r.jueces, puntos: 3 }, 1, idx);
  assert.equal(sin.subio, false);
  // El clóset guarda solo los últimos
  let p = PR.progresoNuevo();
  for (let i = 0; i < 20; i++) p = PR.registrarPasarela(p, { tema: "playa", atuendo: PLAYA, jueces: r.jueces, puntos: 3 }, i, idx).progreso;
  assert.equal(p.atuendos.length, D.config.maxAtuendosGuardados);
  assert.equal(p.atuendos[0].fecha, 19);
});

test("progreso: leer lo guardado tolera basura y versiones viejas", () => {
  assert.deepEqual(PR.leerProgreso(null, idx), PR.progresoNuevo());
  const p = PR.leerProgreso({ puntos: -3, pasarelas: "x", vistos: [1, "a-camiseta"], piel: 99, atuendos: [{ tema: "marte" }, { tema: "playa", atuendo: PLAYA }], ultimoTema: "marte" }, idx);
  assert.equal(p.puntos, 0); assert.equal(p.pasarelas, 0); assert.deepEqual(p.vistos, ["a-camiseta"]); assert.equal(p.piel, 0);
  assert.equal(p.atuendos.length, 1); assert.equal(p.ultimoTema, null);
});

test("progreso: lo nuevo brilla hasta que se ve; el clóset inicial ya cuenta como visto", () => {
  let p = PR.marcarVistos(PR.progresoNuevo(), PR.clavesIniciales(idx.niveles));
  assert.equal(PR.esNuevo(p, "a-camiseta"), false);
  assert.equal(PR.esNuevo(p, "a-sueter"), true);
  const p2 = PR.marcarVistos(p, ["a-sueter"]);
  assert.equal(PR.esNuevo(p2, "a-sueter"), false);
  assert.equal(PR.marcarVistos(p2, ["a-sueter"]), p2, "sin cambios, el mismo objeto");
});

test("progreso: escoger tema no repite el último", () => {
  for (let i = 0; i < 50; i++) assert.notEqual(PR.escogerTema(["playa", "cumple"], "playa", () => i / 50), "playa");
  assert.equal(PR.escogerTema(["playa"], "playa", Math.random), "playa");
});

test("progreso: cada nivel abre poco (1 a 3 cosas) y los niveles se espacian cada vez más (#26)", () => {
  let antes = 0;
  for (const [i, n] of idx.niveles.entries()) {
    if (i === 0) continue;
    const cuantas = PR.QUE_ABRE.reduce((s, k) => s + (n[k] || []).length, 0);
    assert.ok(cuantas >= 1 && cuantas <= 3, `${n.nombre} abre ${cuantas}`);
    const salto = n.puntos - idx.niveles[i - 1].puntos;
    assert.ok(salto >= antes, `${n.nombre}: el salto no se achica`);
    assert.ok(salto >= 15, `${n.nombre}: más de una pasarela perfecta`);
    antes = salto;
  }
  // El primer nivel sí llega pronto (2 pasarelas regulares, herramientas/simular-curva.mjs)
  assert.ok(idx.niveles[1].puntos <= 22);
});

// ---------- Movimiento ----------

const mapa = M.mapaDeChoques(D.zonas, D.config.estudio);
const CFG = D.config.movimiento;

test("movimiento: camina, gira poco a poco y no atraviesa paredes ni muebles", () => {
  let pos = { x: 0, z: 1.6, ang: 0 };
  for (let i = 0; i < 100; i++) pos = M.paso(pos, { x: -1, z: 0 }, 0.05, CFG, mapa); // 5 s a la izquierda
  assert.ok(pos.x > -6 + CFG.radio - 1e-9, "no sale del estudio");
  assert.ok(!M.choca(pos.x, pos.z, CFG.radio, mapa));
  assert.ok(Math.abs(M.difAngulo(pos.ang, 90)) < 1, "mira a la izquierda");
  const quieto = M.paso(pos, { x: 0.01, z: 0 }, 0.05, CFG, mapa);
  assert.equal(quieto.caminando, false);
  const un = M.paso({ x: 0, z: 0, ang: 0 }, { x: 0, z: -1 }, 0.1, CFG, mapa);
  assert.ok(Math.abs(un.z - -CFG.velocidad * 0.1) < 1e-9);
});

test("movimiento: se desliza junto a la pared en diagonal", () => {
  let pos = { x: 3.4, z: -4.4, ang: 0 };
  const antes = pos.x;
  for (let i = 0; i < 10; i++) pos = M.paso(pos, { x: 0.7, z: -0.7 }, 0.05, CFG, mapa);
  assert.ok(pos.x > antes, "avanza de lado aunque choque al fondo");
});

test("movimiento: zona cercana, ruta y cada zona es alcanzable desde el inicio", () => {
  const inicio = { x: D.zonas.inicio.x, z: D.zonas.inicio.z, ang: 0 };
  assert.equal(M.zonaCercana(inicio, D.zonas.zonas), null);
  for (const z of D.zonas.zonas) {
    assert.ok(!M.choca(z.punto[0], z.punto[1], CFG.radio, mapa), `${z.id}: su punto no choca`);
    let pos = { ...inicio }, ruta = M.rutaHacia(pos, z, mapa, CFG.radio);
    for (let i = 0; i < 400 && ruta.length; i++) { const r = M.seguirRuta(pos, ruta); ruta = r.ruta; pos = M.paso(pos, r.quiere, 0.05, CFG, mapa); }
    assert.equal(ruta.length, 0, `${z.id}: llega`);
    assert.equal(M.zonaCercana(pos, D.zonas.zonas).id, z.id);
  }
});

test("movimiento: flechas con impulso (control remoto) y dos a la vez", () => {
  assert.deepEqual(M.direccionDeTeclas({ arriba: 1000 }, 900), { x: 0, z: -1 });
  assert.deepEqual(M.direccionDeTeclas({ arriba: 1000, derecha: 1000 }, 900), { x: 1, z: -1 });
  assert.deepEqual(M.direccionDeTeclas({ arriba: 1000 }, 1100), { x: 0, z: 0 });
});

// ---------- Partida ----------

test("partida: transiciones del diagrama y eventos que no aplican", () => {
  assert.equal(siguiente("inicio", "jugar"), "cobrando");
  assert.equal(siguiente("cobrando", "cobrado"), "tema");
  assert.equal(siguiente("cobrando", "sin-creditos"), "faltan");
  assert.equal(siguiente("faltan", "libre"), "libre");
  assert.equal(siguiente("estudio", "tiempo"), "pasarela");
  assert.equal(siguiente("calificacion", "continuar"), "desbloqueo");
  assert.equal(siguiente("pasarela", "jugar"), "pasarela");
  for (const [, t] of Object.entries(TRANSICIONES)) for (const destino of Object.values(t)) assert.ok(TRANSICIONES[destino], destino);
  assert.equal(quedan(0, 30000, 150), 120); assert.equal(quedan(0, 999999, 150), 0);
  assert.equal(reloj(125), "2:05"); assert.equal(reloj(0.2), "0:01");
});

// ---------- Dibujos 2D ----------

test("2D: cada prenda tiene su figura y la muñeca se dibuja sin errores", () => {
  for (const p of D.prendas.prendas) {
    assert.ok(FIGURAS_2D.includes(p.dibujo2d), `${p.id}: figura "${p.dibujo2d}"`);
    const svg = miniPrenda(p, p.colores[0], idx);
    assert.match(svg, /^<svg/); assert.doesNotMatch(svg, /undefined|NaN/, p.id);
  }
  const svg = dibujarMuneca(vestir([["p-trenza", "cafe"], ["v-princesa", "rosa"], ["z-zapatillas", "dorado"], ["x-corona", "dorado"], ["x-alas", "lila"]]), idx, { piel: "#ffd9c0", base: "#cbbfe6" });
  assert.doesNotMatch(svg, /undefined|NaN/);
});

// ---------- 3D: cada prenda se arma ----------

test("3D: el personaje y cada prenda (con espejo y anillos) se arman con Three.js", async () => {
  const { crearAvatar, CUERPO } = await import("../../../kit/3d/avatar.js");
  const av = crearAvatar({ piel: "#ffd9c0", base: D.config.colorBase });
  for (const n of ANCLAS) assert.ok(av.anclas[n], `ancla ${n}`);
  assert.ok(CUERPO.cadera > 0.5);
  let maxTris = 0, peor = "";
  for (const p of D.prendas.prendas) {
    if (p.modelo) continue; // las de Blender se prueban en el navegador (herramientas/probador.html)
    const a = A.poner(A.atuendoVacio(), p, p.colores[0]);
    av.vestir(a, idx);
    let tris = 0;
    av.raiz.traverse((o) => { if (o.isMesh && o.userData.prenda) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
    assert.ok(tris > 0, `${p.id} dibuja algo`);
    if (tris > maxTris) { maxTris = tris; peor = p.id; }
    for (const m of ["quieto", "caminar", "desfilar", "cintura", "saludo", "estrella"]) av.animar(m, 0.016);
  }
  assert.ok(maxTris < 6000, `la prenda más pesada (${peor}) tiene ${maxTris} triángulos`);
});

test("3D: el modelo de Blender (modelos/tiara.glb) existe y es un GLB", () => {
  for (const p of D.prendas.prendas.filter((x) => x.modelo)) {
    const b = fs.readFileSync(path.join(raiz, p.modelo));
    assert.equal(b.toString("ascii", 0, 4), "glTF", p.modelo);
    assert.ok(b.length < 200000, `${p.modelo}: ${b.length} bytes`);
  }
});

// ---------- #26: maquillaje, joyería, zonas, poses ----------

test("#26: maquillaje y joyería: uno por lugar, conviven con los demás accesorios", () => {
  let a = vestir([["x-lentes", "rosa"], ["m-labial", "rojo"], ["m-rubor", "rosa"], ["x-aretes-perla", "blanco"], ["x-reloj", "cafe"]]);
  assert.deepEqual(Object.keys(a.accesorios).sort(), ["cara", "labios", "mejillas", "muneca", "orejas"]);
  a = A.poner(a, idx.prendas.get("x-pulsera"), "rosa"); // misma muñeca: reemplaza al reloj
  assert.equal(a.accesorios.muneca.id, "x-pulsera");
  a = A.poner(a, idx.prendas.get("m-pecas"), "cafe");
  a = A.poner(a, idx.prendas.get("m-brillitos"), "dorado"); // misma "pintura": reemplaza
  assert.equal(a.accesorios.pintura.id, "m-brillitos");
  assert.match(A.fraseIngles(a, idx), /red lipstick/);
  // El maquillaje cuenta como detalle para los jueces
  const fiesta = idx.temas.get("cumple");
  const k = componentes(vestir([["m-brillitos", "dorado"], ["m-labial", "rosa"]]), fiesta, idx);
  assert.equal(k.detalles, 1);
});

test("#26: cada zona enseña solo lo suyo y todo tiene una zona", () => {
  const z = (id) => D.zonas.zonas.find((x) => x.id === id);
  const joyeria = prendasDeZona(z("joyeria"), idx).map((p) => p.lugar);
  assert.ok(joyeria.length >= 6 && joyeria.every((l) => ["orejas", "cuello", "muneca"].includes(l)));
  assert.ok(prendasDeZona(z("accesorios"), idx).every((p) => !["orejas", "cuello", "muneca"].includes(p.lugar)));
  assert.ok(prendasDeZona(z("maquillaje"), idx).length >= 6);
  const vistas = new Set(D.zonas.zonas.flatMap((zn) => prendasDeZona(zn, idx).map((p) => p.id)));
  for (const p of D.prendas.prendas) assert.ok(vistas.has(p.id), `${p.id} aparece en alguna zona`);
  for (const zn of D.zonas.zonas.filter((x) => x.categorias)) assert.ok(zn.enfoque, `${zn.id} tiene enfoque`);
  assert.equal(z("zapatos").enfoque, "pies");
});

test("#26: las poses existen en el personaje 3D y en el modo sencillo", async () => {
  const { POSES_3D } = await import("../../../kit/3d/avatar.js");
  const css = fs.readFileSync(path.join(raiz, "estilo.css"), "utf8");
  for (const o of D.poses.poses) {
    assert.ok(POSES_3D.includes(o.id), `${o.id} en avatar.js`);
    assert.ok(css.includes(".pose-" + o.id), `${o.id} en estilo.css (modo sencillo)`);
    assert.ok(o.es && o.en);
  }
  assert.equal(siguiente("pasarela", "llego"), "posando");
  assert.equal(siguiente("posando", "fin"), "calificacion");
});

test("#26: la cámara tiene un enfoque para cada zona", async () => {
  const { ENFOQUES } = await import("../src/ui/vista3d.js");
  for (const e of ENFOQUES_DATOS) assert.ok(ENFOQUES[e], e);
});

// ---------- Patrones y estampados (#79) ----------

test("patrones: cada SVG existe, es de 64×64, se rellena con {p} y no carga nada de fuera", () => {
  for (const { tipo, id, x } of arteDe(D)) {
    assert.ok(x.svg && x.svg.includes("<svg"), `${id}: hay SVG`);
    assert.match(x.svg, /viewBox="0 0 64 64"/, `${id}: viewBox 0 0 64 64`);
    assert.doesNotMatch(x.svg, /<script|href="http|xlink:href="http|<image|<text/i, `${id}: sin scripts, imágenes ni texto`);
    if (tipo === "patrones") assert.match(x.svg, /<rect[^>]*fill="\{p\}"/, `${id}: el fondo es el color de la prenda`);
    else assert.doesNotMatch(x.svg, /<rect width="64" height="64"/, `${id}: el estampado no tapa todo (fondo transparente)`);
  }
});

test("patrones: pintarSVG cambia los marcadores y la tinta contrasta", async () => {
  const T = await import("../../../kit/3d/texturas.js");
  assert.equal(T.tinta("#ffffff"), "#2b2236"); assert.equal(T.tinta("#2b2236"), "#ffffff");
  assert.equal(T.mezcla("#000000", "#ffffff", 0.5), "#808080");
  const svg = T.pintarSVG('<svg viewBox="0 0 64 64"><rect fill="{p}"/><path fill="{t}"/><path fill="{m}"/><path fill="{s}"/><path fill="{c}"/></svg>', { p: "#ff7eb6", s: "#4cb3ff" });
  assert.doesNotMatch(svg, /\{[pstmc]\}/);
  assert.match(svg, /#ff7eb6/); assert.match(svg, /#4cb3ff/);
  assert.equal(T.interiorSVG('<svg viewBox="0 0 1 1"><g/></svg>'), "<g/>");
  // Sin navegador no hay texturas (la ropa sale lisa) y nada truena
  assert.equal(T.texturaSVG(svg, { repetir: true }), null);
  assert.equal(T.texturaPixeles("x", 2, ["#000000", null, null, "#ffffff"]), null);
});

test("patrones: qué prendas aceptan patrón", () => {
  const P = (id) => aceptaPatron(idx.prendas.get(id), D.config);
  assert.ok(P("a-camiseta")); assert.ok(P("b-falda")); assert.ok(P("v-verano")); assert.ok(P("z-tenis"));
  assert.ok(P("x-gorra")); assert.ok(P("x-bolsa"));          // accesorios de tela: "patrones": true
  assert.ok(!P("p-cola")); assert.ok(!P("x-lentes")); assert.ok(!P("m-rubor")); assert.ok(!P("x-aretes-perla"));
});

test("patrones: ponerse, cambiar y quitar un patrón; la frase en inglés lo dice", () => {
  const cam = idx.prendas.get("a-camiseta");
  let a = A.poner(A.atuendoVacio(), cam, "rosa", "cebra");
  assert.deepEqual(a.arriba, { id: "a-camiseta", color: "rosa", patron: "cebra" });
  assert.equal(A.patronPuesto(a, cam), "cebra");
  assert.equal(A.fraseIngles(a, idx), "a pink zebra print T-shirt");
  a = A.ponerPatron(a, cam, "puntos");
  assert.deepEqual(a.arriba, { id: "a-camiseta", color: "rosa", patron: "puntos" });
  a = A.ponerPatron(a, cam, "puntos"); // tocar el mismo: vuelve a lisa
  assert.deepEqual(a.arriba, { id: "a-camiseta", color: "rosa" });
  assert.equal(A.patronPuesto(a, cam), null);
  assert.equal(A.ponerPatron(A.atuendoVacio(), cam, "rayas").arriba, null); // sin camiseta puesta no hace nada
  // Con otro patrón, tocar la prenda no la quita: la cambia
  a = A.poner(A.poner(A.atuendoVacio(), cam, "rosa", "rayas"), cam, "rosa", "cebra");
  assert.equal(a.arriba.patron, "cebra");
  assert.equal(A.poner(a, cam, "rosa", "cebra").arriba, null);
  assert.equal(A.fraseIngles(A.poner(A.atuendoVacio(), idx.prendas.get("a-tirantes"), "azul", "rayas"), idx), "a blue striped tank top");
});

test("patrones: limpiar quita patrones que no existen o en prendas que no los aceptan", () => {
  const a = A.limpiar({ arriba: { id: "a-camiseta", color: "rosa", patron: "cebra" }, abajo: { id: "b-falda", color: "azul", patron: "dinosaurios" },
    peinado: { id: "p-cola", color: "cafe", patron: "rayas" }, accesorios: { cabeza: { id: "x-gorra", color: "rojo", patron: "puntos" } } }, idx);
  assert.equal(a.arriba.patron, "cebra"); assert.equal(a.abajo.patron, undefined); assert.equal(a.peinado.patron, undefined);
  assert.equal(a.accesorios.cabeza.patron, "puntos");
});

test("patrones: las etiquetas del patrón cuentan para la jueza del tema", () => {
  const rock = idx.temas.get("rock");
  const lisa = componentes(vestir([["a-camiseta", "negro"]]), rock, idx).tema;
  const cebra = componentes(A.poner(A.atuendoVacio(), idx.prendas.get("a-camiseta"), "negro", "cebra"), rock, idx).tema;
  assert.ok(cebra > lisa, `cebra ${cebra} > lisa ${lisa}`);
});

test("patrones: prendas estampadas con calca; datos mal escritos se avisan", () => {
  for (const id of ["a-camiseta-osito", "a-tirantes-corazon", "a-sudadera-estrella", "v-arcoiris"]) {
    const p = idx.prendas.get(id);
    assert.ok(p.piezas.some((z) => z.f === "calca" && idx.estampados.has(z.estampado)), `${id}: tiene calca`);
    assert.ok(idx.estampados.has(p.estampado2d.estampado), `${id}: estampado2d`);
  }
  const malo = leer();
  for (const { archivo, x } of arteDe(malo)) x.svg = "<svg/>";
  malo.prendas.prendas[1].piezas.push({ f: "calca", y: [0.1, 0.2], r: [0.1, 0.1], ancho: 0.1, estampado: "dinosaurio" });
  malo.patrones.patrones.push({ id: "Mal", es: "mal", archivo: "otro/mal.png" });
  malo.desbloqueos.niveles[0].patrones.push("no-existe");
  const e = revisarDatos(malo).join("\n");
  assert.match(e, /calca pide y \[arriba, abajo\]/);
  assert.match(e, /estampado "dinosaurio" no está/);
  assert.match(e, /patrón Mal: id en minúsculas/);
  assert.match(e, /patrón Mal: falta es o en/);
  assert.match(e, /patrón Mal: archivo en patrones\//);
  assert.match(e, /no-existe/);
});

test("patrones: el avatar se viste con patrón y estampado sin navegador (sale liso)", async () => {
  const { crearAvatar } = await import("../../../kit/3d/avatar.js");
  const av = crearAvatar({ piel: "#ffd9c0", base: D.config.colorBase });
  const a = A.poner(A.poner(A.atuendoVacio(), idx.prendas.get("a-camiseta-osito"), "rosa", "cebra"), idx.prendas.get("b-falda"), "azul", "cuadros");
  av.vestir(a, idx, "#ffd9c0");
});

test("patrones: el panel enseña los patrones abiertos y la pantalla de nivel los nuevos", async () => {
  const P = await import("../src/ui/pantallas.js");
  const ab = PR.abiertosHasta(0, idx.niveles);
  const zona = D.zonas.zonas.find((z) => z.id === "arriba");
  const html = P.panel({ zona, idx, atuendo: A.poner(A.atuendoVacio(), idx.prendas.get("a-camiseta"), "rosa", "rayas"), ab, progreso: PR.progresoNuevo(), sel: "a-camiseta", voz: false, girar: true });
  assert.match(html, /data-patron="rayas"/); assert.match(html, /data-patron="puntos"/); assert.match(html, /data-patron=""/);
  assert.doesNotMatch(html, /data-patron="cebra"/);
  assert.match(html, /pink striped T-shirt/); assert.match(html, /camiseta rosa de rayas/);
  assert.match(html, /6 patrones más se abren/);
  // El peinado no acepta patrón: no hay botones
  const zp = D.zonas.zonas.find((z) => z.id === "peinados");
  assert.doesNotMatch(P.panel({ zona: zp, idx, atuendo: A.atuendoVacio(), ab, progreso: PR.progresoNuevo(), sel: "p-cola", voz: false }), /data-patron/);
  const des = P.desbloqueo({ nivel: idx.niveles[30], nuevos: { prendas: ["v-arcoiris"], colores: [], temas: [], poses: [], patrones: ["cebra"], estampados: ["arcoiris"] }, idx });
  assert.match(des, /Patrón nuevo/); assert.match(des, /zebra print/); assert.match(des, /Estampado nuevo/);
  assert.doesNotMatch(des, /undefined|\{[pstmc]\}/);
  // La muñeca 2D con patrón y estampado
  const svg = dibujarMuneca(A.poner(A.atuendoVacio(), idx.prendas.get("a-camiseta-osito"), "rosa", "cebra"), idx, { piel: "#ffd9c0", base: "#cbbfe6" });
  assert.match(svg, /<pattern id="pt-cebra/); assert.match(svg, /url\(#pt-cebra/); assert.doesNotMatch(svg, /undefined|NaN|\{[pstmc]\}/);
});

// ---------- Taller de diseño (#80) ----------

const T = await import("../src/taller.js");
const combos = (m) => m.controles.reduce((acc, c) => acc.flatMap((a) => c.opciones.map((o) => ({ ...a, [c.id]: o.id }))), [{}]);

test("taller: ningún ajuste de ningún molde queda más delgado que la ropa que ya existe (no traspasa el cuerpo)", () => {
  // Lo más delgado que ya usa la ropa del catálogo en cada ancla (tubos del color principal): eso ya se probó a ojo
  const minimo = {};
  for (const p of D.prendas.prendas) for (const pz of p.piezas || []) {
    if (pz.f !== "tubo" || pz.col !== "p" || !pz.a) continue;
    minimo[pz.a] = Math.min(minimo[pz.a] ?? Infinity, ...pz.r);
  }
  let revisadas = 0;
  for (const m of idx.moldes.values()) {
    const lugares = (m.lugares || []).map((l) => ({ estampado: "osito", lugar: l.id }));
    for (const aj of combos(m)) {
      const piezas = T.piezasDe(m, aj, lugares);
      const donde = `${m.id} ${JSON.stringify(aj)}`;
      for (const pz of piezas) {
        if (pz.f === "tubo" && pz.col === "p") {
          assert.ok(pz.a in minimo, `${donde}: ancla ${pz.a} sin referencia`);
          assert.ok(Math.min(...pz.r) >= minimo[pz.a] - 1e-9, `${donde}: tubo en ${pz.a} de radio ${pz.r} (lo más delgado que existe: ${minimo[pz.a]})`);
          assert.ok(pz.y[0] > pz.y[1], `${donde}: y de arriba a abajo`);
        }
        for (const k of ["y", "r", "pos", "tam"]) if (pz[k]) for (const x of [].concat(pz[k])) assert.ok(Number.isFinite(x), `${donde}: ${k} sin variable resuelta`);
        revisadas++;
      }
      // Lo que va encima (listones y calcomanías) siempre queda por fuera de la tela de abajo
      const tubos = piezas.filter((pz) => pz.f === "tubo" && pz.col === "p");
      for (const q of piezas.filter((pz) => pz.f === "calca" || (pz.f === "tubo" && pz.col === "s"))) {
        const base = tubos.find((t) => t.a === q.a && t.y[0] >= q.y[0] - 1e-9 && t.y[1] <= q.y[1] + 1e-9);
        if (!base) continue;
        for (const [y, r] of [[q.y[0], q.r[0]], [q.y[1], q.r[1]]]) {
          const t = (base.y[0] - y) / (base.y[0] - base.y[1]);
          const rb = base.r[0] + (base.r[1] - base.r[0]) * t;
          assert.ok(r > rb, `${donde}: ${q.f} a y ${y} (r ${r}) se hunde en la tela (r ${rb})`);
        }
      }
      assert.equal(piezas.filter((pz) => pz.f === "calca").length, lugares.length, `${donde}: una calcomanía por lugar`);
    }
  }
  assert.ok(revisadas > 100);
});

test("taller: cada combinación se arma en 3D con menos de 6000 triángulos y tiene dibujo 2D", async () => {
  const { crearAvatar } = await import("../../../kit/3d/avatar.js");
  const av = crearAvatar({ piel: "#ffd9c0", base: D.config.colorBase });
  for (const m of idx.moldes.values()) for (const aj of combos(m)) {
    const d = T.limpiarDiseno({ id: "d-prueba", molde: m.id, ajustes: aj, color: "rosa", patron: "cebra", calcas: (m.lugares || []).map((l) => ({ estampado: "osito", lugar: l.id })), nombre: "Prueba", temas: ["playa"] }, idx);
    const p = T.prendaDeDiseno(d, idx);
    assert.ok(FIGURAS_2D.includes(p.dibujo2d), `${m.id} ${JSON.stringify(aj)}: figura 2D ${p.dibujo2d}`);
    T.registrarDisenos(idx, [d]);
    av.vestir(A.poner(A.atuendoVacio(), p, "rosa"), idx);
    let tris = 0;
    av.raiz.traverse((o) => { if (o.isMesh && o.userData.prenda) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
    assert.ok(tris > 0 && tris < 6000, `${m.id}: ${tris} triángulos`);
    assert.doesNotMatch(miniPrenda(p, "rosa", idx), /undefined|NaN/);
  }
  T.registrarDisenos(idx, []);
});

test("taller: un diseño se vuelve prenda (nombre, temas → etiquetas, patrón fijo, estampados 2D)", () => {
  const d = T.limpiarDiseno({ id: "d-abc", molde: "vestido", ajustes: { largo: "largo", vuelo: "princesa" }, color: "lila", secundario: "dorado", patron: "estrellas",
    calcas: [{ estampado: "estrella", lugar: "falda" }, { estampado: "osito", lugar: "falda" }, { estampado: "corazon", lugar: "pecho" }], nombre: "  Estrellita\n<b> ", temas: ["princesa", "gala", "playa"] }, idx);
  assert.equal(d.nombre, "Estrellita b");
  assert.deepEqual(d.temas, ["princesa", "gala"]);
  assert.equal(d.calcas.length, 2, "una calcomanía por lugar");
  const p = T.prendaDeDiseno(d, idx);
  assert.equal(p.categoria, "vestido"); assert.equal(p.es, "vestido largo"); assert.equal(p.en, "long dress"); assert.equal(p.nombre, "Estrellita b");
  assert.equal(p.patronFijo, "estrellas"); assert.equal(aceptaPatron(p, D.config), false);
  assert.ok(p.etiquetas.includes("princesa") && p.etiquetas.includes("elegante"), p.etiquetas.join());
  assert.equal(p.estampado2d.length, 2);
  T.registrarDisenos(idx, [d]);
  const a = A.poner(A.atuendoVacio(), p, "lila");
  assert.equal(A.fraseIngles(a, idx), 'a lilac star print long dress called "Estrellita b"');
  // La jueza del tema: va perfecto con los temas que escogió
  assert.equal(encaje(T.prendaDeDiseno(d, idx), idx.temas.get("princesa")), 3);
  const svg = dibujarMuneca(a, idx, { piel: "#ffd9c0", base: "#cbbfe6" });
  assert.match(svg, /pt-estrellas/); assert.doesNotMatch(svg, /undefined|NaN/);
  // Registrar de nuevo quita los de antes
  T.registrarDisenos(idx, []);
  assert.equal(idx.prendas.has("d-abc"), false);
  assert.equal(T.limpiarDiseno({ molde: "no-existe" }, idx), null);
  assert.equal(T.limpiarDiseno(null, idx), null);
  const raro = T.limpiarDiseno({ molde: "falda", ajustes: { largo: "kilométrica" }, color: "fosforescente", calcas: [{ estampado: "x", lugar: "frente" }, "basura"], temas: "playa" }, idx);
  assert.deepEqual(raro.ajustes, { largo: "corta", vuelo: "amplia" }); assert.equal(raro.calcas.length, 0); assert.deepEqual(raro.temas, []);
  assert.ok(idx.colores.has(raro.color)); assert.match(raro.id, /^d-/);
});

test("taller: espacios por nivel y nombres sugeridos", () => {
  assert.equal(T.espacios(0, D.config), D.config.taller.espacios);
  assert.equal(T.espacios(D.config.taller.espacioCadaNiveles, D.config), D.config.taller.espacios + 1);
  assert.equal(T.espacios(1000, D.config), D.config.taller.maxEspacios);
  const d = T.limpiarDiseno({ molde: "playera", color: "blanco", patron: "cebra", calcas: [{ estampado: "osito", lugar: "pecho" }], temas: ["playa"] }, idx);
  const s = T.nombresSugeridos(d, idx);
  assert.ok(s.length >= 3 && s.length <= 4);
  assert.ok(s.includes("Mi playera")); assert.ok(s.includes("Playera de cebra")); assert.ok(s.includes("Playera del osito"));
  for (const n of s) assert.ok(n.length <= D.config.taller.maxNombre);
  assert.ok(T.nombresSugeridos({ ...d, temas: [], patron: null, calcas: [] }, idx).includes("Playera blanca"));
});

test("taller: progreso v1 → v2, los diseños sobreviven y lo guardado cabe en la nube", () => {
  const v1 = { v: 1, puntos: 40, pasarelas: 3, vistos: ["a-camiseta"], atuendos: [], piel: 1, ultimo: { arriba: { id: "a-camiseta", color: "rosa" }, accesorios: {} }, ultimoTema: "playa" };
  const p1 = PR.leerProgreso(v1, idx);
  assert.equal(p1.v, 2); assert.deepEqual(p1.disenos, []); assert.equal(p1.borrador, null); assert.equal(p1.puntos, 40);
  // Con un diseño puesto
  const d = T.limpiarDiseno({ id: "d-uno", molde: "falda", color: "rosa", nombre: "Mi falda" }, idx);
  const guardado = JSON.parse(JSON.stringify({ ...p1, disenos: [d, d, { molde: "borrado" }], borrador: { molde: "gorra" },
    ultimo: { abajo: { id: "d-uno", color: "rosa" }, arriba: { id: "d-otro", color: "rosa" }, accesorios: {} } }));
  const p2 = PR.leerProgreso(guardado, idx);
  assert.equal(p2.disenos.length, 1, "sin repetidos ni moldes que ya no existen");
  assert.equal(p2.borrador.molde, "gorra");
  assert.equal(p2.ultimo.abajo.id, "d-uno"); assert.equal(p2.ultimo.arriba, null);
  assert.ok(idx.prendas.has("d-uno"));
  // Lo más grande que se puede guardar: todos los espacios con nombres largos y todas las calcomanías, y el clóset lleno de diseños
  const max = D.config.taller.maxEspacios, cal = (m) => (m.lugares || []).map((l) => ({ estampado: "arcoiris", lugar: l.id }));
  const disenos = Array.from({ length: max }, (_, i) => T.limpiarDiseno({ id: "d-" + "x".repeat(20) + i, molde: "vestido", ajustes: {}, color: "turquesa", patron: "leopardo",
    calcas: cal(idx.moldes.get("vestido")), nombre: "W".repeat(40), temas: ["campamento", "pijamada"], fecha: 1760000000000 }, idx));
  const lleno = { ...PR.progresoNuevo(), disenos, borrador: disenos[0], vistos: [...idx.prendas.keys()].map((k) => k), atuendos: Array.from({ length: D.config.maxAtuendosGuardados }, () => ({ fecha: 1, tema: "playa", estrellas: [5, 5, 5], puntos: 15, atuendo: { vestido: { id: disenos[0].id, color: "turquesa" }, accesorios: {} } })) };
  const txt = JSON.stringify(lleno);
  assert.ok(txt.length < 20000, `${txt.length} caracteres (la nube acepta 200 000)`);
  T.registrarDisenos(idx, []);
});

test("taller: la pantalla de cada paso y Mis diseños se arman sin huecos", async () => {
  const P = await import("../src/ui/pantallas.js");
  const ab = PR.abiertosHasta(5, idx.niveles);
  const d = T.limpiarDiseno({ molde: "playera", color: "rosa", patron: "rayas", calcas: [{ estampado: "osito", lugar: "pecho" }], nombre: "", temas: ["playa"] }, idx);
  for (const paso of P.PASOS_TALLER.map((x) => x.id)) {
    const html = P.taller({ idx, diseno: d, paso, ab, saldo: 3, costo: 5, libres: 2, total: 4, lugar: "pecho", girar: true });
    assert.doesNotMatch(html, /undefined|NaN|\[object/, paso);
    assert.match(html, /data-accion="t-paso"/);
  }
  const coser = P.taller({ idx, diseno: d, paso: "coser", ab, saldo: 3, costo: 5, libres: 2, total: 4, lugar: null, girar: false });
  assert.match(coser, /Te faltan <b>2<\/b> créditos/); assert.match(coser, /disabled/);
  assert.match(P.taller({ idx, diseno: d, paso: "coser", ab, saldo: 30, costo: 5, libres: 0, total: 4, lugar: null, girar: false }), /Ya llenaste tus 4 espacios/);
  assert.match(P.taller({ idx, diseno: d, paso: "decorar", ab, saldo: 30, costo: 5, libres: 1, total: 4, lugar: "pecho", girar: false }), /data-estampado="osito"/);
  const zona = D.zonas.zonas.find((z) => z.disenos);
  assert.match(P.panel({ zona, idx, atuendo: A.atuendoVacio(), ab, progreso: PR.progresoNuevo(), sel: null, voz: false }), /Aún no tienes diseños/);
  const g = { ...d, id: "d-mio", nombre: "Rayitas" };
  T.registrarDisenos(idx, [g]);
  ab.prendas.add("d-mio");
  const html = P.panel({ zona, idx, atuendo: A.atuendoVacio(), ab, progreso: PR.progresoNuevo(), sel: "d-mio", voz: false, espaciosTotal: 4 });
  assert.match(html, /Rayitas/); assert.match(html, /1 de 4 espacios/); assert.match(html, /t-descoser/);
  assert.doesNotMatch(html, /data-patron=/, "un diseño ya trae su patrón");
  assert.match(P.guiaTaller({ costo: 5 }), /5 créditos/);
  assert.match(P.confirmarDescoser(idx.prendas.get("d-mio")), /no regresan los créditos/);
  T.registrarDisenos(idx, []);
});

test("taller: datos de un molde mal escrito se avisan", () => {
  const malo = leer();
  for (const { x } of arteDe(malo)) x.svg = "<svg/>";
  const m = malo.moldes.moldes[0];
  m.controles[0].opciones[0].valores = {}; // sin "alto": la pieza queda sin y
  m.lugares.push({ id: "x", es: "x", en: "x", pieza: "no-existe", desde: 0.8, hasta: 0.2, ancho: 0.1 });
  malo.moldes.moldes.push({ id: "Malo", categoria: "peinado", es: "x", en: "x", genero: "x", controles: [] });
  const e = revisarDatos(malo).join("\n");
  assert.match(e, /molde playera sin\/.* pieza 1/);
  assert.match(e, /lugar x: "pieza" debe ser/); assert.match(e, /lugar x: desde < hasta/);
  assert.match(e, /molde Malo: id en minúsculas/); assert.match(e, /molde Malo: de 1 a 3 controles/);
});

test("taller: el estudio tiene el Taller y Mis diseños, y se llega caminando", () => {
  const taller = D.zonas.zonas.find((z) => z.accion === "taller"), mis = D.zonas.zonas.find((z) => z.disenos);
  assert.ok(taller && mis);
  for (const z of [taller, mis]) {
    const ruta = M.rutaHacia({ x: -4, z: -2 }, z, mapa);
    let a = { x: -4, z: -2 };
    for (const b of ruta) { assert.ok(M.libre(a, b, mapa, CFG.radio), `${z.id}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`); a = b; }
  }
});

test("taller: Don Detalle nota un diseño propio (sin cambiar la calificación)", () => {
  const d = T.limpiarDiseno({ id: "d-don", molde: "falda", color: "rosa", nombre: "Girasol", temas: ["playa"] }, idx);
  T.registrarDisenos(idx, [d]);
  const a = vestir([["p-cola", "cafe"], ["a-tirantes", "amarillo"], ["z-sandalias", "rosa"]]);
  const con = A.poner(a, idx.prendas.get("d-don"), "rosa");
  assert.match(comentar("detalle", con, idx.temas.get("playa"), idx).positivo, /¿Tu falda corta «Girasol» la hiciste tú\? ¡Qué original!/);
  T.registrarDisenos(idx, []);
});
