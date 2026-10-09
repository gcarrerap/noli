// Pruebas de la Pasarela (#19): datos, atuendo, puntuación y comentarios, progreso y desbloqueos, movimiento y
// choques, máquina de estados, dibujos 2D, y que cada prenda se pueda armar en 3D (Three.js corre en Node sin WebGL
// para crear geometrías). Se corren con `npm test` desde la raíz del repo.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { revisarDatos, indexar, ARCHIVOS, ANCLAS, prendasDeZona, ENFOQUES: ENFOQUES_DATOS } = await import("../src/datos.js");
const A = await import("../src/atuendo.js");
const { calificar, componentes, encaje, estrellasNoli, estrellasJuez, comentar } = await import("../src/puntuacion.js");
const PR = await import("../src/progreso.js");
const M = await import("../src/movimiento.js");
const { siguiente, quedan, reloj, TRANSICIONES } = await import("../src/partida.js");
const { FIGURAS_2D, dibujarMuneca, miniPrenda } = await import("../src/ui/dibujo2d.js");
const E = await import("../src/espanol.js");

const leer = () => Object.fromEntries(Object.entries(ARCHIVOS).map(([k, f]) => [k, JSON.parse(fs.readFileSync(path.join(raiz, "datos", f), "utf8"))]));
const D = leer();
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
  assert.deepEqual(reg.nuevos, { prendas: ["b-pantalon"], colores: [], temas: [], poses: ["vuelta"] });
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
    const cuantas = ["prendas", "colores", "temas", "poses"].reduce((s, k) => s + (n[k] || []).length, 0);
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
