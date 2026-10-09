// Pasarela: el controlador. Carga los datos, escoge la vista (3D o 2D), lleva el estado de la partida
// (src/partida.js) y conecta todo: pantallas, panel de ropa, joystick, flechas de la TV, créditos y progreso.
// Mapa de módulos y flujo: docs/ARQUITECTURA.md.
import { Noli, moverFoco, focoInicial } from "../../../../kit/noli.js";
import { teclaAAccion } from "../../../../kit/teclas.js";
import { cargarDatos } from "./cargar.js";
import { hayWebGL } from "../../../../kit/3d/escena.js";
import { crearVista3d } from "./vista3d.js";
import { crearVista2d } from "./vista2d.js";
import { crearJoystick } from "../../../../kit/3d/joystick.js";
import { hayVoz, decir } from "./voz.js";
import * as P from "./pantallas.js";
import { atuendoVacio, atuendoInicial, poner, ponerPatron, colorPuesto, patronPuesto, fraseIngles, quitar } from "../atuendo.js";
import { nuevoDiseno, limpiarDiseno, prendaDeDiseno, registrarDisenos, espacios, ajustesDe, limpiarNombre, prendasDeDisenos } from "../taller.js";
import { calificar } from "../puntuacion.js";
import { leerProgreso, nivelDe, abiertos, coloresDe, registrarPasarela, marcarVistos, clavesIniciales, escogerTema, nivelDePrenda, esNuevo } from "../progreso.js";
import { siguiente, quedan, EN_ESTUDIO } from "../partida.js";
import { prendasDeZona } from "../datos.js";
import { direccionDeTeclas } from "../movimiento.js";

const $ = (id) => document.getElementById(id);
const FLECHAS = ["arriba", "abajo", "izquierda", "derecha"];
const parametros = new URLSearchParams(location.search);
const reducir = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// Preferencia de ESTE aparato (3D o modo sencillo). No es progreso: no se sincroniza, por eso no va en Noli.guardar.
const PREF_VISTA = "noli.pasarela.vista";
const leerPref = () => { try { return localStorage.getItem(PREF_VISTA); } catch { return null; } };
const ponerPref = (v) => { try { localStorage.setItem(PREF_VISTA, v); } catch {} };

/** Todo lo que el juego sabe en este momento */
const S = {
  idx: null, progreso: null, ab: null, nivel: null,
  estado: "inicio", saldo: null, tema: null, atuendo: null,
  inicioEstudio: 0, zona: null, sel: null, resultado: null, ganados: 0, nuevos: null,
  vista: null, joy: null, modal: null, tv: false, ultimoSegundo: -1,
  teclas: { hasta: {}, apretadas: {} }, joyDir: { x: 0, z: 0 },
  pose: null, posesTimer: null,
};

// ---------- Arranque ----------

async function arrancar() {
  let datos;
  try {
    const r = await cargarDatos("datos/");
    S.idx = r.idx;
    if (r.errores.length) console.warn("[pasarela] errores en los datos:\n" + r.errores.join("\n"));
    if (r.errores.length && parametros.has("revisar")) return mostrarCapa(P.error("Los datos tienen errores.", r.errores));
  } catch (e) {
    console.error(e);
    return mostrarCapa(P.error("No se pudieron leer los datos del juego. " + e.message));
  }
  const idx = S.idx;
  datos = await Noli.datos;
  S.tv = Noli.modo === "tv";
  S.progreso = leerProgreso(datos, idx);
  if (!S.progreso.vistos.length) S.progreso = marcarVistos(S.progreso, clavesIniciales(idx.niveles));
  actualizarAbiertos();
  S.saldo = await Noli.creditos;

  let a = S.progreso.ultimo;
  if (!a) a = atuendoInicial(idx);
  S.atuendo = a;

  crearVista(!hayWebGL() || parametros.has("modo2d") || leerPref() === "2d" ? "2d" : "3d");
  instalarEntrada();
  ir("inicio");
  if (parametros.has("fps")) setInterval(() => { $("fps").hidden = false; const i = S.vista.info; $("fps").textContent = `${Math.round(S.vista.fps)} fps · ${S.vista.calidad} · ${i.dibujos} dibujos · ${i.triangulos} triángulos`; }, 500);
}

function crearVista(tipo) {
  if (S.vista) S.vista.liberar();
  const piel = S.idx.config.tonosPiel[S.progreso.piel];
  const op = { tv: S.tv, piel, reducirMovimiento: reducir, alZona: alCambiarZona, alBajarMucho: () => { if (S.vista.tipo === "3d" && !S.preguntoLento && !parametros.has("sinaviso") && !window.__pasarelaSinAvisoLento) { S.preguntoLento = true; abrirModal(P.lento()); } } };
  try { S.vista = tipo === "3d" ? crearVista3d($("escena"), S.idx, op) : crearVista2d($("escena"), S.idx, op); }
  catch (e) { console.warn("[pasarela] el 3D falló; modo sencillo", e); S.vista = crearVista2d($("escena"), S.idx, op); }
  document.documentElement.dataset.vista = S.vista.tipo;
  S.vista.vestir(S.atuendo);
  S.vista.cadaCuadro(cadaCuadro);
  if (!S.vista.botones && !S.tv) {
    if (!S.joy) S.joy = crearJoystick($("joy"), (d) => { S.joyDir = d; });
  }
  dibujarLetreros();
}

function actualizarAbiertos() {
  S.nivel = nivelDe(S.progreso.puntos, S.idx.niveles);
  S.ab = abiertos(S.progreso.puntos, S.idx.niveles);
  // Lo que cosió en el Taller (#80) siempre está abierto
  for (const p of prendasDeDisenos(S.idx)) S.ab.prendas.add(p.id);
}

let guardarTimer = null;
function guardar(ya = false) {
  clearTimeout(guardarTimer);
  const g = () => Noli.guardar(S.progreso);
  if (ya) g(); else guardarTimer = setTimeout(g, 800);
}

// ---------- Estados ----------

/** Pasa a un estado (por evento de partida.js o directo) y dibuja lo que toca */
function ir(estado) {
  S.estado = estado;
  cerrarPanel(false); cerrarModal();
  const enEstudio = EN_ESTUDIO.includes(estado);
  document.documentElement.dataset.estado = estado;
  $("hud").hidden = !enEstudio;
  $("letreros").hidden = !enEstudio || S.vista.botones;
  $("zonas2d").hidden = !enEstudio || !S.vista.botones;
  if (S.joy) S.joy.mostrar(enEstudio);
  $("aviso").innerHTML = "";
  $("desfile").innerHTML = "";
  const idx = S.idx;
  switch (estado) {
    case "inicio":
      S.vista.modo("inicio");
      mostrarCapa(P.inicio({ saldo: S.saldo, costo: idx.config.costo, nivel: S.nivel, progreso: S.progreso, niveles: idx.niveles, enCatalogo: Noli.enCatalogo }));
      break;
    case "faltan": {
      mostrarCapa(P.faltan({ saldo: S.saldo, costo: idx.config.costo, juegosQueDan: "Sumas y restas o Spelling" }));
      break;
    }
    case "tema":
      mostrarCapa(P.tema({ tema: S.tema, segundos: idx.config.tiempoEstudio, nuevo: esNuevo(S.progreso, "t:" + S.tema.id) }));
      S.progreso = marcarVistos(S.progreso, ["t:" + S.tema.id]);
      break;
    case "estudio":
    case "libre":
      ocultarCapa();
      S.vista.modo("estudio");
      if (S.vista.botones) $("zonas2d").innerHTML = P.zonasBotones(idx.zonas.zonas, { libre: estado === "libre", comoMenu: false });
      dibujarHud();
      if (S.tv && S.vista.botones) focoInicial($("zonas2d"));
      break;
    case "closet":
      mostrarCapa(P.closet({ progreso: S.progreso, idx, piel: idx.config.tonosPiel[S.progreso.piel] }));
      break;
    case "calificacion":
      mostrarCapa(P.calificacion({ resultado: S.resultado, idx, tema: S.tema, frase: fraseIngles(S.atuendo, idx), voz: hayVoz(), nivel: S.nivel, progreso: S.progreso, ganados: S.ganados, reducir }));
      break;
    case "desbloqueo":
      mostrarCapa(P.desbloqueo({ nivel: S.nivel, nuevos: S.nuevos, idx }));
      break;
  }
}

const evento = (e) => ir(siguiente(S.estado, e));

async function jugar() {
  const costo = S.idx.config.costo;
  if (S.saldo !== null && S.saldo < costo) return evento("jugar"), evento("sin-creditos");
  S.estado = "cobrando";
  const r = await Noli.gastar(costo, "pasarela");
  if (r.ok) {
    S.saldo = r.saldo;
    S.tema = S.idx.temas.get(escogerTema([...S.ab.temas], S.progreso.ultimoTema));
    // Cada pasarela empieza con la ropa de base (solo el peinado se queda), como en los juegos de vestir
    S.atuendo = { ...atuendoVacio(), peinado: S.atuendo.peinado };
    S.vista.vestir(S.atuendo);
    ir("tema");
  } else if (r.saldo !== null) { S.saldo = r.saldo; ir("faltan"); }
  else { ir("inicio"); toast("No se pudieron cobrar los créditos. Intenta otra vez."); }
}

function empezarEstudio() {
  S.inicioEstudio = performance.now();
  S.ultimoSegundo = -1;
  ir("estudio");
}

async function aPasarela(porTiempo = false) {
  if (S.estado !== "estudio") return;
  cerrarPanel(false); cerrarModal();
  S.progreso = { ...S.progreso, ultimo: S.atuendo };
  ir("pasarela");
  ocultarCapa();
  if (porTiempo) toast("¡Se acabó el tiempo!");
  S.vista.modo("pasarela");
  $("desfile").innerHTML = P.desfile({ tema: S.tema });
  await S.vista.desfilar();
  // Al final de la pasarela escoge poses y bailes (varios si quiere); "¡Listo!" o 25 s sin escoger → calificación
  S.estado = siguiente("pasarela", "llego");
  S.pose = null;
  $("desfile").innerHTML = P.desfile({ tema: S.tema }) + P.poses({ idx: S.idx, ab: S.ab, progreso: S.progreso, actual: null });
  if (S.tv || document.documentElement.classList.contains("teclado")) focoInicial($("desfile"));
  await new Promise((r) => { S.finPoses = r; reiniciarPosesTimer(); });
  clearTimeout(S.posesTimer);
  await S.vista.terminarDesfile();
  const idx = S.idx;
  S.resultado = calificar(S.atuendo, S.tema, idx, { prendas: S.ab.prendas, colores: S.ab.colores });
  const reg = registrarPasarela(S.progreso, { tema: S.tema.id, atuendo: S.atuendo, jueces: S.resultado.jueces, puntos: S.resultado.puntos }, Date.now(), idx);
  S.progreso = reg.progreso;
  S.ganados = S.resultado.puntos;
  S.nuevos = reg.subio ? reg.nuevos : null;
  actualizarAbiertos();
  guardar(true);
  Noli.terminar({ estrellas: S.resultado.estrellas });
  $("desfile").innerHTML = "";
  S.estado = "pasarela";
  ir("calificacion");
}

function reiniciarPosesTimer() {
  clearTimeout(S.posesTimer);
  S.posesTimer = setTimeout(() => terminarPoses(), 25000);
}
function terminarPoses() {
  if (S.estado !== "posando" || !S.finPoses) return;
  const f = S.finPoses; S.finPoses = null;
  S.progreso = marcarVistos(S.progreso, [...S.ab.poses].map((o) => "o:" + o));
  f();
}
function escogerPose(id) {
  if (S.estado !== "posando" || !S.ab.poses.has(id)) return;
  S.pose = id;
  S.vista.posar(id);
  for (const b of $("desfile").querySelectorAll(".pose")) b.classList.toggle("sel", b.dataset.pose === id);
  reiniciarPosesTimer();
}

function despuesDeCalificar() {
  S.vista.regresar();
  if (S.estado === "calificacion" && S.nuevos) return ir("desbloqueo");
  ir("inicio");
}

// ---------- Zonas y panel de ropa ----------

function alCambiarZona(z) {
  if (S.zona || !EN_ESTUDIO.includes(S.estado)) { $("aviso").innerHTML = ""; return; }
  $("aviso").innerHTML = z ? P.aviso(z, { libre: S.estado === "libre", tv: S.tv }) : "";
}

function zonaPorId(id) { return S.idx.zonas.zonas.find((z) => z.id === id); }

async function tocarZona(id) {
  const z = zonaPorId(id);
  if (!z || !EN_ESTUDIO.includes(S.estado)) return;
  cerrarModal();
  const cerca = S.vista.cercana && S.vista.cercana.id === id;
  if (!S.vista.botones && !cerca) await S.vista.irA(id);
  if (!EN_ESTUDIO.includes(S.estado)) return;
  abrirZona(z);
}

function abrirZona(z) {
  if (z.accion === "espejo") {
    // Sin avisos ni letreros mientras se da la vuelta: taparían al personaje
    S.vista.espejo();
    $("aviso").innerHTML = ""; $("letreros").hidden = true;
    if (S.joy) S.joy.mostrar(false);
    clearTimeout(S.espejoTimer);
    S.espejoTimer = setTimeout(() => {
      if (!EN_ESTUDIO.includes(S.estado) || S.zona) return;
      $("letreros").hidden = !!S.vista.botones; if (S.joy) S.joy.mostrar(true); alCambiarZona(S.vista.cercana);
    }, reducir ? 900 : 1900);
    return;
  }
  if (z.accion === "pasarela") { if (S.estado === "libre") return salirDelEstudio(); return aPasarela(); }
  if (z.accion === "taller") return abrirTaller(z);
  S.zona = z;
  // La prenda escogida al abrir: la que trae puesta de esta zona (si hay)
  const deZona = new Set(prendasDeZona(z, S.idx).map((p) => p.id));
  const puesta = [...Object.values(S.atuendo.accesorios), S.atuendo.peinado, S.atuendo.arriba, S.atuendo.abajo, S.atuendo.vestido, S.atuendo.zapatos]
    .find((p) => p && deZona.has(p.id));
  S.sel = puesta ? puesta.id : null;
  $("aviso").innerHTML = "";
  $("letreros").hidden = true;
  $("zonas2d").hidden = true;
  if (S.joy) S.joy.mostrar(false);
  S.vista.enfocar(z.enfoque || "cuerpo");
  S.vista.modo("probador");
  dibujarPanel(true);
}

function dibujarPanel(enfocar) {
  const el = $("panel");
  if (!S.zona) { el.hidden = true; el.innerHTML = ""; el.classList.remove("taller"); return; }
  if (S.taller) return dibujarTaller(enfocar);
  const enfocado = el.contains(document.activeElement) ? document.activeElement : null;
  const clave = enfocado && (enfocado.dataset.prenda || enfocado.dataset.color || (enfocado.dataset.patron !== undefined ? "pt:" + enfocado.dataset.patron : "") || enfocado.dataset.accion);
  el.innerHTML = P.panel({ zona: S.zona, idx: S.idx, atuendo: S.atuendo, ab: S.ab, progreso: S.progreso, sel: S.sel, voz: hayVoz(), girar: S.vista.tipo === "3d",
    colorElegido: S._colorSel, patronElegido: S._patronSel, espaciosTotal: espacios(S.nivel.i, S.idx.config) });
  el.hidden = false;
  if (clave) {
    const otro = clave.startsWith("pt:") ? el.querySelector(`[data-patron="${clave.slice(3)}"]`)
      : el.querySelector(`[data-prenda="${clave}"],[data-color="${clave}"],[data-accion="${clave}"]`);
    if (otro) otro.focus({ preventScroll: false });
  } else if (enfocar && (S.tv || document.documentElement.classList.contains("teclado"))) focoInicial(el);
}

function cerrarPanel(volver = true) {
  if (!S.zona) return;
  if (S.taller) salirDelTaller();
  const z = S.zona;
  // Lo que ya vio en este perchero deja de brillar como nuevo
  const claves = [];
  for (const p of prendasDeZona(z, S.idx)) if (S.ab.prendas.has(p.id)) { claves.push(p.id); for (const col of coloresDe(p, S.ab)) claves.push("c:" + col); }
  if (S.sel || S._vioPatrones) for (const x of S.ab.patrones) claves.push("pt:" + x);
  S._vioPatrones = false;
  S.progreso = marcarVistos(S.progreso, claves);
  guardar();
  S.zona = null; S.sel = null; S._colorSel = null; S._patronSel = null;
  dibujarPanel();
  if (volver && EN_ESTUDIO.includes(S.estado)) {
    S.vista.modo("estudio");
    $("letreros").hidden = !!S.vista.botones;
    $("zonas2d").hidden = !S.vista.botones;
    if (S.joy) S.joy.mostrar(true);
    alCambiarZona(S.vista.cercana);
    if (S.vista.botones && S.tv) focoInicial($("zonas2d"));
  }
}

function tocarPrenda(id) {
  const p = S.idx.prendas.get(id);
  if (!p || !S.ab.prendas.has(id)) return;
  const puesta = colorPuesto(S.atuendo, p);
  const color = puesta || (S.sel === id && S._colorSel && coloresDe(p, S.ab).includes(S._colorSel) && S._colorSel) || coloresDe(p, S.ab)[0];
  const patron = puesta ? patronPuesto(S.atuendo, p) : (S.sel === id && S._patronSel) || null;
  S.atuendo = poner(S.atuendo, p, color, patron);
  if (S.sel !== id) { S._colorSel = null; S._patronSel = null; }
  S.sel = id;
  S.vista.vestir(S.atuendo);
  dibujarPanel();
}

function tocarColor(c) {
  const p = S.sel && S.idx.prendas.get(S.sel);
  if (!p) return;
  const puesta = colorPuesto(S.atuendo, p);
  if (puesta !== c) S.atuendo = poner(S.atuendo, p, c, puesta ? patronPuesto(S.atuendo, p) : S._patronSel || null);
  S._colorSel = c;
  S.vista.vestir(S.atuendo);
  dibujarPanel();
}

/** Un patrón para la prenda escogida ("" = lisa). Si no la trae puesta, se la pone con ese patrón. */
function tocarPatron(id) {
  const p = S.sel && S.idx.prendas.get(S.sel);
  if (!p) return;
  const patron = id && S.ab.patrones.has(id) ? id : null;
  const puesta = colorPuesto(S.atuendo, p);
  if (puesta) {
    if ((patronPuesto(S.atuendo, p) || null) !== patron) S.atuendo = ponerPatron(S.atuendo, p, patron);
  } else {
    const color = (S._colorSel && coloresDe(p, S.ab).includes(S._colorSel) && S._colorSel) || coloresDe(p, S.ab)[0];
    S.atuendo = poner(S.atuendo, p, color, patron);
  }
  S._patronSel = patron;
  S._vioPatrones = true;
  S.vista.vestir(S.atuendo);
  dibujarPanel();
}

// ---------- Taller de diseño (#80; src/taller.js) ----------
// El diseño que se está haciendo es el "borrador" del progreso: se guarda en cada cambio (salir no lo pierde).
// Mientras está abierto, el personaje lo trae puesto (encima de lo que traía), y el reloj de la pasarela se para.

const ENFOQUE_MOLDE = { arriba: "torso", abajo: "piernas", vestido: "cuerpo", zapatos: "pies", accesorio: "cabeza" };
const BORRADOR = "d-borrador";

function abrirTaller(z) {
  const d = S.progreso.borrador || nuevoDiseno([...S.idx.moldes.keys()][0], S.idx, Date.now());
  S.zona = z;
  S.taller = { diseno: d, paso: "molde", lugar: null, antes: S.atuendo, desde: performance.now(), faltan: null };
  $("aviso").innerHTML = ""; $("letreros").hidden = true; $("zonas2d").hidden = true;
  if (S.joy) S.joy.mostrar(false);
  S.vista.modo("probador");
  probarDiseno();
  dibujarPanel(true);
  if (!S.progreso.vistos.includes("g:taller")) {
    S.progreso = marcarVistos(S.progreso, ["g:taller"]); guardar();
    abrirModal(P.guiaTaller({ costo: S.idx.config.taller.costo }));
  }
}

/** Viste al personaje con el diseño (como prenda de prueba) y enfoca su parte del cuerpo */
function probarDiseno() {
  const t = S.taller, idx = S.idx;
  registrarDisenos(idx, [...S.progreso.disenos, { ...t.diseno, id: BORRADOR }]);
  const p = idx.prendas.get(BORRADOR);
  S.atuendo = poner(t.antes, p, t.diseno.color);
  // poner() quita la prenda si ya estaba igual; aquí siempre debe quedar puesta
  if (!puestaEn(S.atuendo, p)) S.atuendo = poner(S.atuendo, p, t.diseno.color);
  S.vista.vestir(S.atuendo);
  S.vista.enfocar(ENFOQUE_MOLDE[p.categoria] || "cuerpo");
}

const puestaEn = (a, p) => { const x = p.lugar ? a.accesorios[p.lugar] : a[p.categoria]; return x && x.id === p.id; };

function cambiarDiseno(cambio) {
  const t = S.taller;
  t.diseno = limpiarDiseno({ ...t.diseno, ...cambio }, S.idx) || t.diseno;
  if (cambio.molde) t.lugar = null;
  S.progreso = { ...S.progreso, borrador: t.diseno };
  guardar();
  probarDiseno();
  dibujarTaller();
}

function ponerCalca(estampado) {
  const t = S.taller, molde = S.idx.moldes.get(t.diseno.molde);
  const lugar = t.lugar || ((molde.lugares || [])[0] || {}).id;
  if (!lugar) return;
  const calcas = t.diseno.calcas.filter((c) => c.lugar !== lugar);
  if (estampado) calcas.push({ estampado, lugar });
  t.lugar = lugar;
  cambiarDiseno({ calcas });
}

function tocarTemaTaller(id) {
  const t = S.taller, max = S.idx.config.taller.maxTemas;
  let temas = t.diseno.temas.includes(id) ? t.diseno.temas.filter((x) => x !== id) : [...t.diseno.temas, id];
  if (temas.length > max) { temas = temas.slice(-max); toast(`Como mucho ${max} temas`); }
  cambiarDiseno({ temas });
}

function leerNombreTaller() {
  const i = document.getElementById("t-nombre");
  if (!i || !S.taller) return;
  const n = limpiarNombre(i.value, S.idx.config.taller.maxNombre);
  if (n !== S.taller.diseno.nombre) { S.taller.diseno = { ...S.taller.diseno, nombre: n }; S.progreso = { ...S.progreso, borrador: S.taller.diseno }; guardar(); }
}

function irPasoTaller(paso) {
  leerNombreTaller();
  S.taller.paso = paso;
  dibujarTaller(true);
}

function dibujarTaller(enfocar) {
  const el = $("panel"), t = S.taller;
  const enfocado = el.contains(document.activeElement) ? document.activeElement : null;
  const clave = enfocado && ["accion", "paso", "molde", "control", "opcion", "color", "patron", "lugar", "estampado", "tema"].map((k) => enfocado.dataset[k] || "").join("|");
  const total = espacios(S.nivel.i, S.idx.config);
  el.classList.add("taller");
  el.innerHTML = P.taller({ idx: S.idx, diseno: t.diseno, paso: t.paso, ab: S.ab, saldo: S.saldo, costo: S.idx.config.taller.costo,
    libres: total - S.progreso.disenos.length, total, lugar: t.lugar, girar: S.vista.tipo === "3d", faltan: t.faltan });
  el.hidden = false;
  const nombre = document.getElementById("t-nombre");
  if (nombre) nombre.addEventListener("input", () => { clearTimeout(S._nombreTimer); S._nombreTimer = setTimeout(leerNombreTaller, 400); });
  if (clave) {
    const otro = [...el.querySelectorAll("[data-accion]")].find((b) => ["accion", "paso", "molde", "control", "opcion", "color", "patron", "lugar", "estampado", "tema"].map((k) => b.dataset[k] || "").join("|") === clave);
    if (otro) return otro.focus({ preventScroll: false });
  }
  if (enfocar && (S.tv || document.documentElement.classList.contains("teclado"))) focoInicial(el);
}

function salirDelTaller() {
  const t = S.taller;
  leerNombreTaller();
  S.taller = null;
  // Se quita la prenda de prueba; vuelve a lo que traía
  registrarDisenos(S.idx, S.progreso.disenos);
  S.atuendo = t.antes;
  S.vista.vestir(S.atuendo);
  // El reloj no corrió mientras diseñaba
  if (S.estado === "estudio") S.inicioEstudio += performance.now() - t.desde;
  guardar();
}

async function coser() {
  const t = S.taller, idx = S.idx, costo = idx.config.taller.costo;
  leerNombreTaller();
  if (S.progreso.disenos.length >= espacios(S.nivel.i, idx.config)) return toast("Ya no hay espacio en Mis diseños");
  if (S.saldo !== null && S.saldo < costo) { t.faltan = costo - S.saldo; return dibujarTaller(); }
  const r = await Noli.gastar(costo, "taller");
  if (r.saldo !== null && r.saldo !== undefined) S.saldo = r.saldo;
  if (!r.ok) { t.faltan = S.saldo !== null ? Math.max(1, costo - S.saldo) : null; if (t.faltan === null) toast("No se pudieron cobrar los créditos. Intenta otra vez."); return dibujarTaller(); }
  const ahora = Date.now();
  const d = limpiarDiseno({ ...t.diseno, id: "d-" + ahora.toString(36) + Math.random().toString(36).slice(2, 5), fecha: ahora, nombre: t.diseno.nombre || prendaDeDiseno(t.diseno, idx).es }, idx);
  S.progreso = { ...S.progreso, disenos: [...S.progreso.disenos, d], borrador: null };
  registrarDisenos(idx, S.progreso.disenos);
  const p = idx.prendas.get(d.id);
  S.ab.prendas.add(d.id);
  S.progreso = marcarVistos(S.progreso, [d.id]);
  // Sale del taller con su diseño puesto
  t.antes = poner(t.antes, p, d.color);
  if (!puestaEn(t.antes, p)) t.antes = poner(t.antes, p, d.color);
  guardar(true);
  cerrarPanel();
  toast(`¡Cosiste «${d.nombre}»! Está en Mis diseños`);
}

function descoser(id) {
  cerrarModal();
  const p = S.idx.prendas.get(id);
  if (!p || !p.diseno) return;
  S.progreso = { ...S.progreso, disenos: S.progreso.disenos.filter((d) => d.id !== id) };
  if (puestaEn(S.atuendo, p)) S.atuendo = quitar(S.atuendo, p.lugar || p.categoria);
  registrarDisenos(S.idx, S.progreso.disenos);
  S.ab.prendas.delete(id);
  S.sel = null;
  S.vista.vestir(S.atuendo);
  guardar(true);
  dibujarPanel();
  toast(`Descosiste «${p.nombre || p.es}»`);
}

function salirDelEstudio() {
  S.progreso = { ...S.progreso, ultimo: S.atuendo };
  guardar();
  ir("inicio");
}

// ---------- Pantallas, modales, avisos ----------

function mostrarCapa(html) {
  const c = $("capa");
  c.innerHTML = html; c.hidden = false;
  if (S.tv || document.documentElement.classList.contains("teclado")) focoInicial(c);
  else { const b = c.querySelector('[data-foco="inicial"]'); if (b && S.tv) b.focus(); }
}
function ocultarCapa() { $("capa").hidden = true; $("capa").innerHTML = ""; }

function abrirModal(html) { S.modal = true; $("modal").innerHTML = html; $("modal").hidden = false; focoInicial($("modal")); }
function cerrarModal() { S.modal = null; $("modal").hidden = true; $("modal").innerHTML = ""; }

let toastTimer = null;
function toast(txt) {
  const t = $("toast");
  t.textContent = txt; t.classList.remove("ver"); void t.offsetWidth; t.classList.add("ver");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("ver"), 2600);
}

function dibujarHud() {
  const enJuego = S.estado === "estudio";
  const q = enJuego ? quedan(S.inicioEstudio, performance.now(), S.idx.config.tiempoEstudio) : null;
  $("hud").innerHTML = P.hud({ tema: enJuego ? S.tema : null, quedan: q, avisoTiempo: S.idx.config.avisoTiempo, libre: S.estado === "libre", tv: S.tv, botones: S.vista.botones });
}

function dibujarLetreros() {
  if (S.vista.botones) { $("letreros").innerHTML = ""; return; }
  $("letreros").innerHTML = S.idx.zonas.zonas.map((z) => P.letrero(z).replace("<button", `<button data-letrero="${z.id}"`)).join("");
}

// ---------- Cada cuadro ----------

function cadaCuadro() {
  if (!EN_ESTUDIO.includes(S.estado)) return;
  // Dirección: joystick si se está usando; si no, flechas
  const dTeclas = direccionDeTeclas(S.teclas.hasta, performance.now());
  for (const k of FLECHAS) if (S.teclas.apretadas[k]) { const d = direccionDeTeclas({ [k]: Infinity }, 0); dTeclas.x += d.x; dTeclas.z += d.z; }
  const dir = Math.hypot(S.joyDir.x, S.joyDir.z) > 0.05 ? S.joyDir : { x: Math.sign(dTeclas.x), z: Math.sign(dTeclas.z) };
  if (!S.zona && !S.modal) S.vista.mover(dir);
  // Letreros sobre los muebles
  if (!S.vista.botones && !S.zona) {
    const pos = S.vista.letreros();
    for (const el of $("letreros").children) {
      const p = pos.get(el.dataset.letrero);
      if (!p) { el.style.visibility = "hidden"; continue; }
      // Sin letreros pegados arriba (los tapa el hud) ni en la orilla
      if (p.y < 90 || p.x < 20 || p.x > innerWidth - 20) { el.style.visibility = "hidden"; continue; }
      el.style.visibility = ""; el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
    }
  }
  // Reloj
  if (S.estado === "estudio" && !S.taller) {
    const q = quedan(S.inicioEstudio, performance.now(), S.idx.config.tiempoEstudio);
    const s = Math.ceil(q);
    if (s !== S.ultimoSegundo) { S.ultimoSegundo = s; const r = $("hud").querySelector(".chip-reloj b"); if (r) { dibujarHud(); } }
    if (q <= 0) aPasarela(true);
  }
}

// ---------- Entrada: dedo, teclado, control de la TV, teléfono remoto ----------

function instalarEntrada() {
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-accion]");
    if (b) accion(b.dataset.accion, b);
  });
  // En el probador: arrastrar el dedo (o el ratón) sobre la escena gira al personaje
  let arrastre = null;
  $("escena").addEventListener("pointerdown", (e) => { if (S.zona && S.vista.tipo === "3d") arrastre = { x: e.clientX, id: e.pointerId }; });
  window.addEventListener("pointermove", (e) => {
    if (!arrastre || e.pointerId !== arrastre.id) return;
    S.vista.girar((e.clientX - arrastre.x) * 0.6); arrastre.x = e.clientX;
  });
  window.addEventListener("pointerup", () => { arrastre = null; });
  window.addEventListener("pointercancel", () => { arrastre = null; });
  // Tocar el piso: caminar hasta ahí (3D)
  $("escena").addEventListener("pointerup", (e) => {
    if (!EN_ESTUDIO.includes(S.estado) || S.zona || S.vista.botones || e.target.closest("[data-accion]")) return;
    const p = S.vista.alPiso(e.clientX, e.clientY);
    if (p) S.vista.irAPunto(p.x, p.z);
  });
  // Teclas apretadas (para caminar mientras se mantiene la flecha; el kit da el keydown, aquí falta el keyup)
  window.addEventListener("keydown", (e) => { const a = teclaAAccion(e); if (FLECHAS.includes(a)) S.teclas.apretadas[a] = true; });
  window.addEventListener("keyup", (e) => { const a = teclaAAccion(e); if (FLECHAS.includes(a)) { S.teclas.apretadas[a] = false; S.teclas.hasta[a] = 0; } });
  window.addEventListener("blur", () => { S.teclas.apretadas = {}; S.teclas.hasta = {}; });
  Noli.alEntrar(manejar);
}

/** Una acción del control (flechas, OK, Atrás). Devuelve true si "atrás" se usó aquí (si no, el kit sale del juego). */
function manejar(a) {
  const enfocar = (cont) => { if (moverFoco(a, cont)) return true; if (a === "ok" && cont.contains(document.activeElement)) { document.activeElement.click(); return true; } return false; };
  if (S.modal) {
    if (a === "atras") { accion($("modal").querySelector('[data-accion="salir-no"],[data-accion="seguir-3d"],[data-accion="cerrar-ira"]') ? "cerrar-modal" : "cerrar-modal"); return true; }
    enfocar($("modal")); return true;
  }
  if (S.zona) {
    if (a === "atras") { cerrarPanel(); return true; }
    enfocar($("panel")); return true;
  }
  if (!$("capa").hidden) {
    if (a === "atras") {
      if (S.estado === "inicio") return false;
      if (["closet", "faltan"].includes(S.estado)) { ir("inicio"); return true; }
      return true;
    }
    enfocar($("capa")); return true;
  }
  if (S.estado === "posando") { if (a !== "atras") enfocar($("desfile")); return true; }
  if (S.estado === "pasarela" || S.estado === "cobrando") return true;
  if (EN_ESTUDIO.includes(S.estado)) {
    if (a === "atras") { if (S.estado === "libre") salirDelEstudio(); else abrirModal(P.confirmarSalir()); return true; }
    if (S.vista.botones) {
      if (enfocar($("estudio-ui"))) return true;
      if (a !== "ok") { focoInicial($("zonas2d")); return true; }
      return true;
    }
    if (FLECHAS.includes(a)) {
      // Cada flecha empuja un ratito; si llega repetida (control o teléfono remoto) sigue caminando
      const ahora = performance.now(), antes = S.teclas.hasta[a] || 0;
      S.teclas.hasta[a] = Math.max(antes, ahora + (antes > ahora ? S.idx.config.movimiento.impulsoTeclaMs : 450));
      return true;
    }
    if (a === "ok") {
      const z = S.vista.cercana;
      if (z) abrirZona(z); else abrirModal(P.zonasBotones(S.idx.zonas.zonas, { libre: S.estado === "libre", comoMenu: true }));
      return true;
    }
  }
  return false;
}

/** Lo que hace cada botón (data-accion) */
function accion(nombre, el) {
  switch (nombre) {
    case "jugar": return jugar();
    case "libre": S.atuendo = S.progreso.ultimo || S.atuendo; S.vista.vestir(S.atuendo); return ir("libre");
    case "closet": return evento("closet");
    case "piel": {
      S.progreso = { ...S.progreso, piel: (S.progreso.piel + 1) % S.idx.config.tonosPiel.length };
      S.vista.ponerPiel(S.idx.config.tonosPiel[S.progreso.piel]); guardar(); return;
    }
    case "listo": return empezarEstudio();
    case "zona": return tocarZona(el.dataset.zona);
    case "prenda": return tocarPrenda(el.dataset.prenda);
    case "bloqueada": { const n = nivelDePrenda(el.dataset.prenda, S.idx.niveles); return toast(n ? `Se abre en el nivel ${n.nombre} (${n.puntos} puntos de estilo)` : "Todavía no está abierta"); }
    case "color": return tocarColor(el.dataset.color);
    case "patron": return tocarPatron(el.dataset.patron);
    case "decir": {
      const p = S.idx.prendas.get(S.sel), c = S.idx.colores.get(colorPuesto(S.atuendo, p) || S._colorSel);
      const pa = S.idx.patrones.get((colorPuesto(S.atuendo, p) ? patronPuesto(S.atuendo, p) : S._patronSel) || "");
      return decir([c && c.en, pa && pa.en, p.en].filter(Boolean).join(" "));
    }
    case "decir-frase": return decir(fraseIngles(S.atuendo, S.idx));
    case "cerrar-panel": return cerrarPanel();
    case "girar": return S.vista.girar(+el.dataset.grados);
    case "pose": return escogerPose(el.dataset.pose);
    case "fin-poses": return terminarPoses();
    case "ir-a": return abrirModal(P.zonasBotones(S.idx.zonas.zonas, { libre: S.estado === "libre", comoMenu: true }));
    case "cerrar-ira": case "cerrar-modal": case "salir-no": cerrarModal(); return;
    case "a-pasarela": return aPasarela();
    case "salir-estudio": return salirDelEstudio();
    case "salir-si": S.progreso = { ...S.progreso, ultimo: S.atuendo }; guardar(); return ir("inicio");
    case "continuar": return despuesDeCalificar();
    case "ponerme": {
      const f = S.progreso.atuendos[+el.dataset.i];
      if (f) { S.atuendo = f.atuendo; S.progreso = { ...S.progreso, ultimo: f.atuendo }; S.vista.vestir(S.atuendo); guardar(); ir("libre"); }
      return;
    }
    case "salir-closet": return ir("inicio");
    case "ir-a-jugar": return Noli.salir();
    case "modo-2d": cerrarModal(); ponerPref("2d"); crearVista("2d"); return ir(S.estado);
    case "seguir-3d": return cerrarModal();
    // Taller de diseño (#80)
    case "t-paso": return irPasoTaller(el.dataset.paso);
    case "t-molde": return cambiarDiseno({ molde: el.dataset.molde, ajustes: {}, calcas: [] });
    case "t-opcion": return cambiarDiseno({ ajustes: { ...S.taller.diseno.ajustes, [el.dataset.control]: el.dataset.opcion } });
    case "t-color": return cambiarDiseno({ color: el.dataset.color });
    case "t-secundario": return cambiarDiseno({ secundario: el.dataset.color });
    case "t-patron": return cambiarDiseno({ patron: el.dataset.patron || null });
    case "t-lugar": S.taller.lugar = el.dataset.lugar; return dibujarTaller();
    case "t-estampado": return ponerCalca(el.dataset.estampado);
    case "t-nombre-sug": return cambiarDiseno({ nombre: el.dataset.nombre });
    case "t-tema": return tocarTemaTaller(el.dataset.tema);
    case "t-coser": return coser();
    case "t-cerrar": return cerrarPanel();
    case "t-guia-ok": cerrarModal(); return focoInicial($("panel"));
    case "t-descoser": { const p = S.idx.prendas.get(el.dataset.prenda); if (p && p.diseno) abrirModal(P.confirmarDescoser(p)); return; }
    case "t-descoser-no": return cerrarModal();
    case "t-descoser-si": return descoser(el.dataset.prenda);
  }
}

arrancar();
