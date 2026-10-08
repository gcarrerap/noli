// Pantallas de "Spelling". El juego principal es el DICTADO: el juego dice la palabra en inglés (nunca la enseña
// antes) y Noelia la escribe. La primera vez hay una prueba de nivel corta para que empiece donde le toca.
// "Escoge" y "Arma" son práctica opcional. La lógica está en los otros módulos (puros); aquí solo se dibuja, se
// habla y se responde al dedo, al teclado o a las flechas.
import { Noli, moverFoco, focoInicial } from "../../../kit/noli.js";
import { LISTAS, ETAPAS, lista as datosLista, conHueco, partir } from "./palabras.js";
import { opciones, letrasParaArmar, diferencias, igual } from "./faltas.js";
import { cargar, registrar, cerrarRonda, armarRonda, colocar, dominio, cumplirReto, racha, semana, resumen, fechaLocal, elegida, estrellasRonda, POR_RONDA, VENTANA, NECESITA } from "./progreso.js";
import { empezarPrueba, responderPrueba, palabraActual } from "./nivelacion.js";
import { retoDelDia } from "./reto.js";
import { Voz } from "./voz.js";

const $main = document.getElementById("juego");
const rnd = Math.random;
let pr;                 // progreso
let pantalla = "inicio";
let juego = null;       // la ronda, la prueba o el reto en curso
let timer = null;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const hoy = () => fechaLocal();
const guardar = () => Noli.guardar(pr);
const uno = (l) => l[Math.floor(Math.random() * l.length)];
const NOMBRE_ETAPA = { escoge: "Escoge", arma: "Arma", escribe: "Dictado" };
const actual = () => (juego.modo === "prueba" ? palabraActual(juego.prueba) : juego.lista[juego.i % juego.lista.length]);

function mostrar(html, nombre) {
  clearInterval(timer); timer = null;
  Voz.callar();
  pantalla = nombre;
  $main.className = "p-" + nombre;
  $main.innerHTML = html;
  for (const b of $main.querySelectorAll("[data-ir]")) b.onclick = () => IR[b.dataset.ir](b.dataset);
  focoInicial($main);
}

const avisoSinVoz = () => `<p class="sin-voz">${ALTAVOZ_CHICO}<span>No se oye la voz. Sube el volumen${/iPhone|iPad/.test(navigator.userAgent) ? ", quita el modo silencio (el switch de un lado)" : ""} y toca el botón morado para escuchar.</span></p>`;

// ---------- Bienvenida y prueba de nivel ----------

function bienvenida() {
  mostrar(`
    <h1 class="titulo">${ABEJA}Spelling</h1>
    <div class="tarjeta-reto">
      <b>Prueba de nivel</b>
      <p>Te voy a decir unas palabras en inglés. Escúchalas y escríbelas. Así sabremos en qué lista empiezas.</p>
      <small>Son unas 10 palabras. Si no sabes una, no pasa nada: escribe como creas.</small>
    </div>
    ${Voz.hay ? "" : avisoSinVoz()}
    <div class="menu">
      <button class="boton grande primario" data-foco="inicial" data-ir="prueba">¡Empezar!</button>
      <button class="boton" data-foco data-ir="saltarPrueba">Empezar desde la lista 1</button>
    </div>`, "bienvenida");
}

function prueba() {
  juego = { modo: "prueba", etapa: "escribe", prueba: empezarPrueba(rnd), i: 0 };
  Voz.precargar(juego.prueba.palabras.map((x) => x.palabra));
  palabra();
}

function finPrueba(n) {
  pr = colocar(pr, n);
  guardar();
  const l = datosLista(n);
  mostrar(`
    <h1 class="titulo">¡Listo!</h1>
    <div class="subio"><b>Empiezas en la lista ${n}</b><span>${esc(l.nombre)}: ${esc(l.patron)}</span></div>
    <p class="sub">${n > 1 ? `Las listas 1 a ${n - 1} ya las sabes: saldrán de repaso.` : "Vamos paso a paso."}</p>
    <div class="menu fila">
      <button class="boton grande primario" data-foco="inicial" data-ir="ronda">¡A jugar!</button>
      <button class="boton grande" data-foco data-ir="inicio">Inicio</button>
    </div>`, "fin");
}

// ---------- Inicio ----------

function inicio() {
  if (!pr.nivelado) return bienvenida();
  const n = elegida(pr), l = datosLista(n), reto = pr.retos[hoy()], r = racha(pr, hoy());
  mostrar(`
    <h1 class="titulo">${ABEJA}Spelling</h1>
    <p class="sub">Lista ${n}: ${esc(l.nombre)} <span class="ej">(${esc(l.patron)})</span></p>
    ${barraDominio(n)}
    <div class="menu">
      <button class="boton grande primario" data-foco="inicial" data-ir="ronda">Jugar <small>Dictado</small></button>
      <button class="boton grande ${reto?.cumplido ? "hecho" : "reto"}" data-foco data-ir="retoIntro">
        Reto del día <small>${reto?.cumplido ? "¡Cumplido!" : "Te espera"}</small></button>
      <div class="menu fila">
        <button class="boton" data-foco data-ir="practicar">Practicar</button>
        <button class="boton" data-foco data-ir="progreso">Mi progreso</button>
      </div>
    </div>
    <p class="racha">${FLAMA}<span>${r ? `Racha: <b>${r}</b> ${r === 1 ? "día" : "días"}` : "Cumple el reto de hoy para empezar una racha"}</span></p>
    ${Voz.hay ? "" : avisoSinVoz()}`, "inicio");
}

function barraDominio(n) {
  if (pr.listas[n]?.dominada) return `<p class="dominio ok">¡Ya dominas esta lista!</p>`;
  const dm = dominio(pr, n), pct = Math.round((100 * dm.intentos) / dm.ventana);
  return `<div class="dominio"><div class="barra"><i style="width:${pct}%"></i></div>
    <small>${dm.intentos < dm.ventana ? `Escribe ${dm.ventana - dm.intentos} palabras más para ver si pasas` : `Escribe ${dm.necesita} de ${dm.ventana} bien para pasar a la siguiente lista`}</small></div>`;
}

function practicar() {
  const n = elegida(pr);
  mostrar(`
    <h1 class="titulo">Practicar</h1>
    <p class="sub">Lista ${n}: ${esc(datosLista(n).nombre)}</p>
    <div class="menu">
      <button class="boton grande" data-foco="inicial" data-ir="practica" data-etapa="escoge">Escoge <small>la palabra bien escrita</small></button>
      <button class="boton grande" data-foco data-ir="practica" data-etapa="arma">Arma <small>la palabra con letras</small></button>
      <button class="boton" data-foco data-ir="inicio">Inicio</button>
    </div>`, "practicar");
}

// ---------- Una palabra ----------

function nuevaRonda(etapa = "escribe") {
  const n = elegida(pr);
  juego = { modo: etapa === "escribe" ? "dictado" : "practica", n, etapa, lista: armarRonda(pr, n, rnd), i: 0, aciertos: 0, repetidas: 0 };
  Voz.precargar(juego.lista.map((x) => x.palabra));
  palabra();
}

const cuantasOpciones = (it) => (it.lista <= 4 ? 3 : 4);
const extrasArmar = (it) => (it.lista <= 4 ? 1 : 2);

function palabra() {
  const it = actual(), etapa = juego.etapa;
  juego.contestado = false;
  juego.escrito = [];
  let zona = "";
  if (etapa === "escoge") {
    juego.ops = opciones(it.palabra, rnd, cuantasOpciones(it));
    zona = `<div class="opciones n${juego.ops.length}">${juego.ops.map((o, k) => `<button class="op" data-foco${k === 0 ? '="inicial"' : ""} data-k="${k}">${esc(o.texto)}</button>`).join("")}</div>`;
  } else if (etapa === "arma") {
    juego.fichas = letrasParaArmar(it.palabra, rnd, extrasArmar(it));
    zona = `<div class="huecos">${[...it.palabra].map(() => `<span></span>`).join("")}</div>
      <div class="fichas">${juego.fichas.map((c, k) => `<button class="ficha" data-foco${k === 0 ? '="inicial"' : ""} data-k="${k}">${c}</button>`).join("")}</div>
      <div class="acciones"><button class="boton" data-foco data-ir="borrar">${BORRAR} Borrar</button></div>`;
  } else {
    zona = `<div class="escrito" aria-live="polite"><span class="letras"></span><i class="cursor"></i></div>
      <div class="teclado">${["qwertyuiop", "asdfghjkl", "zxcvbnm"].map((fila, f) => `<div class="fila">${[...fila].map((c) =>
        `<button class="tecla" data-foco${f === 1 && c === "a" ? '="inicial"' : ""} data-c="${c}">${c}</button>`).join("")}</div>`).join("")}</div>
      <div class="acciones"><button class="boton" data-foco data-ir="borrar">${BORRAR} Borrar</button><button class="boton primario" data-foco data-ir="listo">Listo</button></div>`;
  }
  // La palabra nunca se enseña: solo se oye. La frase (con hueco) aparece si la pide o si no hay voz.
  mostrar(`
    ${cabecera()}
    <p class="instr">${etapa === "escribe" ? "Escucha y escribe la palabra" : esc(ETAPAS.find((e) => e.id === etapa).que)}</p>
    <div class="oir">
      <button class="altavoz" data-foco data-ir="decir" aria-label="Escuchar otra vez">${ALTAVOZ}<span>Otra vez</span></button>
      <button class="boton chico" data-foco data-ir="despacio">${TORTUGA} Despacio</button>
      <button class="boton chico" data-foco data-ir="frase">${BURBUJA} Frase</button>
    </div>
    ${Voz.hay ? `<p class="frase" hidden></p>` : `${avisoSinVoz()}<p class="frase">${esc(conHueco(it.frase, it.palabra))}</p>`}
    <div class="zona z-${etapa}">${zona}</div>
    <p class="aviso" aria-live="polite"></p>
    <div class="abajo"></div>`, "palabra");
  for (const b of $main.querySelectorAll(".op")) b.onclick = () => escoger(+b.dataset.k);
  for (const b of $main.querySelectorAll(".ficha")) b.onclick = () => tocarFicha(+b.dataset.k);
  for (const b of $main.querySelectorAll(".tecla")) b.onclick = () => teclear(b.dataset.c);
  if (juego.modo === "contrarreloj") correrReloj();
  // Se dice al instante (dentro del toque que abrió la pantalla: iOS solo deja hablar así la primera vez)
  decir();
}

function cabecera() {
  const m = juego.modo;
  if (m === "dictado" || m === "practica") {
    const puntos = Array.from({ length: POR_RONDA }, (_, k) => `<i class="${k < Math.min(juego.i, POR_RONDA) ? "lleno" : ""}"></i>`).join("");
    return `<header class="cab"><span>Lista ${juego.n} · ${NOMBRE_ETAPA[juego.etapa]}${actual().tipo === "repaso" ? " · repaso" : ""}</span><span class="puntos">${puntos}</span></header>`;
  }
  if (m === "prueba") return `<header class="cab"><span>Prueba de nivel</span><span class="cuenta">Palabra ${juego.prueba.total + 1}</span></header>`;
  if (m === "contrarreloj") return `<header class="cab"><span>Contrarreloj · ${juego.aciertos} bien</span><span class="reloj"><i style="width:${relojPct()}%"></i></span></header>`;
  return `<header class="cab"><span>${m === "abeja" ? "Spelling bee" : "Detective"}</span><span class="cuenta">${juego.i + 1} de ${juego.lista.length}</span></header>`;
}

// ---------- Voz ----------

// Si la voz se dio por perdida, un toque en "Otra vez" la vuelve a intentar (a veces solo faltaba el volumen)
const intentar = () => { if (!Voz.hay) Voz.reintentar(); };
function decir() { intentar(); Voz.palabra(actual().palabra); }
function despacio() { intentar(); Voz.palabra(actual().palabra, true); }
function frase() {
  const it = actual(), p = $main.querySelector(".frase");
  p.textContent = conHueco(it.frase, it.palabra);
  p.hidden = false;
  intentar();
  Voz.frase(it.palabra);
}

// ---------- Contestar ----------

function escoger(k) {
  if (juego.contestado) return;
  const o = juego.ops[k];
  const botones = [...$main.querySelectorAll(".op")];
  botones[k].classList.add(o.correcta ? "bien" : "mal");
  if (!o.correcta) botones[juego.ops.findIndex((x) => x.correcta)].classList.add("bien");
  for (const b of botones) b.disabled = true;
  contestar(o.correcta, o.texto, o.motivo);
}

function tocarFicha(k) {
  if (juego.contestado) return;
  const b = $main.querySelector(`.ficha[data-k="${k}"]`);
  if (!b || b.disabled) return;
  b.disabled = true;
  juego.escrito.push({ c: juego.fichas[k], k });
  pintarHuecos();
  if (juego.escrito.length === actual().palabra.length) contestar(igual(actual().palabra, juego.escrito.map((x) => x.c).join("")), juego.escrito.map((x) => x.c).join(""));
  else if (document.documentElement.classList.contains("teclado")) siguienteFoco(b);
}

// Con flechas, después de usar una ficha el foco pasa a la que sigue (la usada queda apagada)
function siguienteFoco(b) {
  const libres = [...$main.querySelectorAll(".ficha:not(:disabled)")];
  (libres.find((x) => +x.dataset.k > +b.dataset.k) || libres[0])?.focus();
}

function pintarHuecos() {
  $main.querySelectorAll(".huecos span").forEach((h, k) => { h.textContent = juego.escrito[k]?.c || ""; h.classList.toggle("lleno", !!juego.escrito[k]); });
}

const MAX = 14;
function teclear(c) {
  if (juego.contestado || juego.escrito.length >= MAX) return;
  juego.escrito.push({ c });
  pintarEscrito();
}
function pintarEscrito() { $main.querySelector(".escrito .letras").textContent = juego.escrito.map((x) => x.c).join(""); }

function borrar() {
  if (juego.contestado || !juego.escrito.length) return false;
  const x = juego.escrito.pop();
  if (juego.etapa === "arma") {
    const b = $main.querySelector(`.ficha[data-k="${x.k}"]`);
    b.disabled = false;
    if (document.documentElement.classList.contains("teclado")) b.focus();
    pintarHuecos();
  } else pintarEscrito();
  return true;
}

function listo() {
  if (juego.contestado || !juego.escrito.length) return;
  const t = juego.escrito.map((x) => x.c).join("");
  contestar(igual(actual().palabra, t), t);
}

function contestar(ok, intento, motivo = null) {
  juego.contestado = true;
  const it = actual(), m = juego.modo;
  pr = registrar(pr, m === "dictado" ? juego.n : null, it.palabra, ok, hoy());
  guardar();
  // Al armar o escribir, las letras y el teclado se quitan y en su lugar queda la palabra bien escrita
  if (juego.etapa !== "escoge") $main.querySelector(".zona").innerHTML = correccion(it.palabra, intento, ok);

  if (m === "dictado" || m === "practica") {
    if (ok && it.tipo !== "otra") juego.aciertos++;
    // La que falló vuelve al final de la ronda (una vez, para practicarla)
    if (!ok && it.tipo !== "otra" && juego.repetidas < 3) { juego.lista.push({ ...it, tipo: "otra" }); juego.repetidas++; }
  } else if (m === "prueba") juego.prueba = responderPrueba(juego.prueba, ok, rnd);
  else if (ok) juego.aciertos++;

  if (m === "contrarreloj") { if (!ok) aviso(`Se escribe ${it.palabra}.`, "mal"); return setTimeout(siguiente, ok ? 350 : 1400); }
  if (ok) {
    aviso(uno(["¡Bien!", "¡Muy bien!", "¡Eso!", "¡Perfecto!", "¡Excelente!"]), "bien");
    setTimeout(siguiente, 1000);
    return;
  }
  // Error: enseñar cómo se escribe, deletrearla en voz alta y esperar a "Seguir"
  aviso(m === "prueba" ? "¡No pasa nada! Así se escribe." : motivo || (juego.etapa === "escoge" ? `Se escribe ${it.palabra}.` : "Fíjate en las letras marcadas."), "mal");
  Voz.deletrear(it.palabra);
  ponerSeguir();
}

// La palabra bien escrita con las letras que fallaron marcadas, y abajo lo que escribió tachado
function correccion(palabra, intento, ok) {
  if (ok) return `<p class="correcta bien">${esc(palabra)}</p>`;
  const marcas = diferencias(palabra, intento).map((x) => `<span class="${x.ok ? "" : "ojo"}">${esc(x.letra)}</span>`).join("");
  return `<div class="correccion"><p class="correcta">${marcas}</p>${intento ? `<p class="intento"><s>${esc(intento)}</s></p>` : ""}</div>`;
}

function ponerSeguir() {
  const abajo = $main.querySelector(".abajo");
  abajo.innerHTML = `<button class="boton grande primario" data-foco="inicial">Seguir</button>`;
  abajo.querySelector("button").onclick = siguiente;
  for (const b of $main.querySelectorAll(".op")) b.removeAttribute("data-foco");
  focoInicial(abajo);
}

function aviso(t, clase) { const a = $main.querySelector(".aviso"); a.textContent = t; a.className = "aviso " + clase; }

function siguiente() {
  if (pantalla !== "palabra" && pantalla !== "detective") return;
  const m = juego.modo;
  if (m === "prueba") return juego.prueba.fin ? finPrueba(juego.prueba.fin) : palabra();
  juego.i++;
  if (m === "dictado" || m === "practica") return juego.i < juego.lista.length ? palabra() : finRonda();
  if (m === "contrarreloj") return palabra();
  if (m === "abeja") return juego.i < juego.lista.length ? palabra() : finReto();
  if (m === "detective") return juego.i < juego.lista.length ? detective() : finReto();
}

function finRonda() {
  let subio = null, estrellas;
  if (juego.modo === "dictado") ({ pr, subio, estrellas } = cerrarRonda(pr, juego.n, juego.aciertos));
  else estrellas = estrellasRonda(juego.aciertos);   // práctica: solo las estrellas de la ronda
  guardar();
  Noli.terminar({ estrellas });
  const s = subio ? datosLista(subio) : null;
  mostrar(`
    <h1 class="titulo">${["¡Buen intento!", "¡Bien hecho!", "¡Muy bien!", "¡Perfecto!"][estrellas]}</h1>
    <p class="estrellas grande">${estrellasHtml(estrellas)}</p>
    <p class="sub">${juego.aciertos} de ${POR_RONDA} a la primera</p>
    ${s ? `<div class="subio"><b>¡Pasaste a la lista ${subio}!</b><span>${esc(s.nombre)}: ${esc(s.patron)}</span></div>` : ""}
    ${juego.modo === "dictado" && !s ? barraDominio(juego.n) : ""}
    <div class="menu fila">
      <button class="boton grande primario" data-foco="inicial" data-ir="ronda">${s ? "¡Vamos!" : "Otra ronda"}</button>
      ${juego.modo === "dictado" && juego.aciertos < 5 && !s ? `<button class="boton grande" data-foco data-ir="practicar">Practicar</button>` : ""}
      <button class="boton grande" data-foco data-ir="inicio">Inicio</button>
    </div>`, "fin");
  if (juego.modo === "practica") $main.querySelector('[data-ir="ronda"]').dataset.etapa = juego.etapa;
}

const estrellasHtml = (n) => Array.from({ length: 3 }, (_, i) => `<span class="${i < n ? "on" : "off"}">★</span>`).join("");

// ---------- Reto del día ----------

function retoIntro() {
  const reto = retoDelDia(hoy(), pr.lista), hecho = pr.retos[hoy()];
  mostrar(`
    <h1 class="titulo">Reto del día</h1>
    <div class="tarjeta-reto">
      <b>${esc(reto.nombre)}</b>
      <p>${esc(reto.meta)}${reto.objetivo ? ` Meta: <b>${reto.objetivo}</b>.` : ""}</p>
      ${hecho ? `<p class="hecho-txt">${hecho.cumplido ? "¡Ya lo cumpliste hoy! Puedes jugarlo otra vez." : `Hoy llevas ${hecho.puntos}. ¡Inténtalo otra vez!`}</p>` : ""}
    </div>
    <div class="menu fila">
      <button class="boton grande primario" data-foco="inicial" data-ir="retoJugar">¡Empezar!</button>
      <button class="boton grande" data-foco data-ir="inicio">Inicio</button>
    </div>
    ${semanaHtml()}`, "retoIntro");
}

function retoJugar() {
  const reto = retoDelDia(hoy(), pr.lista);
  juego = { modo: reto.tipo, reto, etapa: reto.modo || null, lista: reto.palabras || reto.frases, i: 0, aciertos: 0, fin: performance.now() + (reto.segundos || 0) * 1000 };
  Voz.precargar(juego.lista.slice(0, 20).map((x) => x.palabra));
  if (reto.tipo === "detective") detective(); else palabra();
}

const relojPct = () => Math.max(0, Math.min(100, ((juego.fin - performance.now()) / (juego.reto.segundos * 1000)) * 100));
function correrReloj() {
  const barra = $main.querySelector(".reloj i");
  timer = setInterval(() => {
    if (barra) barra.style.width = relojPct() + "%";
    if (performance.now() >= juego.fin) finReto();
  }, 200);
}

// Detective: la frase con una palabra mal escrita; hay que tocarla
function detective() {
  const it = actual();
  juego.contestado = false;
  const partes = partir(it.frase, it.palabra);
  mostrar(`
    ${cabecera()}
    <p class="instr">Toca la palabra que está mal escrita</p>
    <div class="detective">${partes.map((p, k) => `${esc(p.antes)}<button class="pal" data-foco${k === 0 ? '="inicial"' : ""} data-k="${k}">${esc(p.es ? it.falta : p.texto)}</button>${esc(p.despues)}`).join(" ")}</div>
    <button class="boton chico" data-foco data-ir="oirFrase">${ALTAVOZ_CHICO} Escuchar la frase</button>
    <p class="aviso" aria-live="polite"></p>
    <div class="zona"></div>
    <div class="abajo"></div>`, "detective");
  for (const b of $main.querySelectorAll(".pal")) b.onclick = () => senalar(+b.dataset.k, partes);
}

function senalar(k, partes) {
  if (juego.contestado) return;
  juego.contestado = true;
  const it = actual(), ok = partes[k].es, botones = [...$main.querySelectorAll(".pal")];
  pr = registrar(pr, null, it.palabra, ok, hoy());
  guardar();
  if (ok) juego.aciertos++;
  botones[k].classList.add(ok ? "bien" : "mal");
  botones[partes.findIndex((p) => p.es)].classList.add("era");
  for (const b of botones) { b.disabled = true; b.removeAttribute("data-foco"); }
  aviso(ok ? `¡La encontraste! Se escribe ${it.palabra}.` : `La mal escrita era "${it.falta}". Se escribe ${it.palabra}.`, ok ? "bien" : "mal");
  $main.querySelector(".zona").innerHTML = correccion(it.palabra, it.falta, false);
  Voz.deletrear(it.palabra);
  ponerSeguir();
}

function finReto() {
  const r = juego.reto, puntos = juego.aciertos;
  const cumplido = r.tipo === "contrarreloj" ? puntos >= r.objetivo : puntos >= r.necesita;
  const antes = !!pr.retos[hoy()]?.cumplido;
  pr = cumplirReto(pr, hoy(), r.tipo, puntos, cumplido);
  guardar();
  const detalle = r.tipo === "contrarreloj" ? `${puntos} bien en 60 segundos (meta: ${r.objetivo})` : `${puntos} de ${r.cuantas} bien (necesitabas ${r.necesita})`;
  mostrar(`
    <h1 class="titulo">${cumplido ? "¡Reto cumplido!" : "¡Casi!"}</h1>
    <p class="sub">${detalle}</p>
    ${cumplido && !antes ? `<p class="racha grande">${FLAMA}<span>Racha: <b>${racha(pr, hoy())}</b></span></p>` : ""}
    <div class="menu fila">
      <button class="boton grande primario" data-foco="inicial" data-ir="${cumplido ? "inicio" : "retoJugar"}">${cumplido ? "Inicio" : "Otra vez"}</button>
      ${cumplido ? "" : `<button class="boton grande" data-foco data-ir="inicio">Inicio</button>`}
    </div>
    ${semanaHtml()}`, "finReto");
}

const DIAS = ["D", "L", "M", "M", "J", "V", "S"];
function semanaHtml() {
  return `<div class="semana" aria-label="Últimos 7 días">${semana(pr, hoy()).map((d) => {
    const [y, m, dd] = d.fecha.split("-").map(Number), dia = DIAS[new Date(y, m - 1, dd).getDay()];
    return `<span class="dia ${d.reto ? "reto" : d.jugo ? "jugo" : ""}"><i>${d.reto ? "✓" : ""}</i>${dia}</span>`;
  }).join("")}</div>`;
}

// ---------- Mi progreso y para papás ----------

function progreso() {
  const r = racha(pr, hoy()), sel = elegida(pr);
  mostrar(`
    <h1 class="titulo">Mi progreso</h1>
    <p class="racha">${FLAMA}<span>Racha: <b>${r}</b> ${r === 1 ? "día" : "días"}</span></p>
    ${semanaHtml()}
    <ol class="mapa">${LISTAS.map((l) => {
      const ls = pr.listas[l.n], abierta = l.n <= pr.lista, dm = dominio(pr, l.n);
      const estado = ls?.dominada ? (ls.porPrueba && !ls.rondas ? `<span class="hecha">${PALOMITA}</span>` : `<span class="estrellas">${estrellasHtml(ls.estrellas)}</span>`)
        : abierta ? `<span class="en-curso">${dm.aciertos} de ${VENTANA}</span>` : `<span class="candado">${CANDADO}</span>`;
      return `<li><button class="lista ${ls?.dominada ? "dominada" : abierta ? "abierta" : "cerrada"}${l.n === sel ? " actual" : ""}"
        ${abierta ? `data-foco${l.n === sel ? '="inicial"' : ""} data-ir="elegir" data-n="${l.n}"` : "disabled"}>
        <b class="num">${l.n}</b><span class="nom">${esc(l.nombre)}<small>${esc(l.patron)}</small></span>${estado}</button></li>`;
    }).join("")}</ol>
    <div class="menu fila">
      <button class="boton" data-foco data-ir="inicio">Inicio</button>
      <button class="boton" data-foco data-ir="papas">Para papás</button>
    </div>`, "progreso");
  $main.querySelector(".lista.actual")?.scrollIntoView({ block: "center" });
}

function papas() {
  const R = resumen(pr);
  mostrar(`
    <h1 class="titulo chico">Para papás</h1>
    <p class="nota">El juego dicta la palabra (no la enseña) y Noelia la escribe. Pasa a la siguiente lista con ${NECESITA} de las últimas ${VENTANA} bien.
      "Practicar" (escoger la bien escrita o armarla con letras) es opcional. El progreso se guarda en este dispositivo.</p>
    <table class="tabla"><thead><tr><th>Lista</th><th>Dictado</th><th>Últimas</th><th></th></tr></thead><tbody>
    ${R.listas.filter((l) => l.abierta || l.total).map((l) => `<tr><td>${l.n}. ${esc(l.nombre)}</td>
      <td>${l.total ? `${l.pct} % <small>(${l.total})</small>` : "–"}</td><td>${l.recientes || "–"}</td>
      <td>${l.dominada ? (l.porPrueba && !l.total ? "Por la prueba" : "Dominada") : ""}</td></tr>`).join("")}
    </tbody></table>
    <h2>Las que más falla</h2>
    ${R.fallos.length ? `<p class="fallos">${R.fallos.map((f) => `<span>${esc(f.palabra)} <small>×${f.veces}</small></span>`).join("")}</p>` : `<p class="nota">Ninguna pendiente.</p>`}
    <h2>Últimos días</h2>
    ${R.dias.length ? `<table class="tabla"><thead><tr><th>Día</th><th>Palabras</th><th>Aciertos</th><th>Reto</th></tr></thead><tbody>
      ${R.dias.reverse().map((d) => `<tr><td>${d.fecha}</td><td>${d.palabras}</td><td>${d.palabras ? Math.round((100 * d.aciertos) / d.palabras) + " %" : "–"}</td><td>${d.reto ? "✓" : ""}</td></tr>`).join("")}
    </tbody></table>` : `<p class="nota">Todavía no hay días jugados.</p>`}
    <h2>Nivel</h2>
    <p class="nota">Va en la lista ${pr.lista}. La prueba de nivel la vuelve a colocar (sube o baja) con un dictado corto.</p>
    <h2>Voz</h2>
    <p class="nota">${Voz.hay ? `Voz en inglés: ${esc(Voz.nombre)}.` : "La voz en inglés no está sonando en este aparato."}
      Si no se oye: sube el volumen y, en iPhone, quita el modo silencio (el switch de un lado).</p>
    <div class="menu fila">
      <button class="boton" data-foco data-ir="probarVoz">${ALTAVOZ_CHICO} Probar la voz</button>
      <button class="boton" data-foco data-ir="repetirPrueba">Repetir la prueba de nivel</button>
      <button class="boton" data-foco="inicial" data-ir="progreso">Regresar</button>
    </div>
    <pre class="diagnostico" aria-live="polite">${esc(diagnostico())}</pre>`, "papas");
}

// Lo que sabe el juego de la voz de este aparato (para saber qué pasa en cada teléfono o TV)
function diagnostico() {
  const e = Voz.estado();
  return [
    `Grabaciones: ${e.grabaciones}`,
    ...e.detalles.map((d) => "  " + d),
    `Respaldo (voz del navegador): speechSynthesis ${e.soporte ? "sí" : "no"} · voces: ${e.voces} · en inglés: ${e.ingles.length}${e.usando ? " · usando " + e.usando : ""}`,
    ...e.ingles.slice(0, 6).map((v) => "  · " + v),
    ...(e.bitacora.length ? ["", ...e.bitacora] : []),
    "", e.navegador,
  ].join("\n");
}

function probarVoz() {
  Voz.reintentar();
  const pintar = () => { if (pantalla === "papas") $main.querySelector(".diagnostico").textContent = diagnostico(); };
  Voz.prueba().then(pintar);
  setTimeout(pintar, 1500);
}

// Si la voz deja de sonar a media partida: aviso y la frase con hueco (nunca la palabra)
Voz.alFallar(() => {
  if (pantalla === "palabra" && !$main.querySelector(".sin-voz")) {
    $main.querySelector(".oir").insertAdjacentHTML("afterend", avisoSinVoz());
    const p = $main.querySelector(".frase");
    if (p) { p.textContent = conHueco(actual().frase, actual().palabra); p.hidden = false; }
  } else if (pantalla === "inicio") inicio();
});

// ---------- Navegación ----------

const IR = {
  inicio, progreso, papas, practicar, retoIntro, retoJugar, decir, despacio, frase, listo, probarVoz, prueba,
  ronda: ({ etapa }) => nuevaRonda(etapa || "escribe"),
  practica: ({ etapa }) => nuevaRonda(etapa),
  borrar: () => borrar(),
  oirFrase: () => { intentar(); Voz.frase(actual().palabra); },
  elegir: ({ n }) => { pr = { ...pr, elegida: +n }; guardar(); inicio(); },
  saltarPrueba: () => { pr = colocar(pr, 1); guardar(); inicio(); },
  repetirPrueba: () => { pr = { ...pr, nivelado: false }; guardar(); bienvenida(); },
};

const escribiendo = () => pantalla === "palabra" && !juego.contestado && (juego.etapa === "arma" || juego.etapa === "escribe");

Noli.alEntrar((accion) => {
  if (moverFoco(accion, $main)) return true;
  if (accion === "ok") {
    const e = document.activeElement;
    if (e && $main.contains(e) && e.tagName === "BUTTON" && !e.disabled) e.click();
    else if (escribiendo() && juego.etapa === "escribe") listo();   // Enter del teclado de verdad
    return true;
  }
  if (accion === "atras") {
    if (escribiendo() && borrar()) return true;                   // "atrás" borra la última letra
    if (pantalla === "inicio" || pantalla === "bienvenida") return false;   // el kit regresa al catálogo
    if (pantalla === "papas") { progreso(); return true; }
    inicio(); return true;
  }
});

// Teclado de verdad (computadora o tableta con teclado): las letras escriben o tocan la ficha
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || !/^[a-z]$/i.test(e.key) || !escribiendo()) return;
  e.preventDefault();
  const c = e.key.toLowerCase();
  if (juego.etapa === "escribe") { document.activeElement?.blur?.(); teclear(c); return; }
  const k = juego.fichas.findIndex((x, j) => x === c && !$main.querySelector(`.ficha[data-k="${j}"]`).disabled);
  if (k >= 0) tocarFicha(k);
});
document.addEventListener("pointerdown", () => document.documentElement.classList.remove("teclado"), true);

// ---------- Íconos (SVG, no emoji: en la TV LG salen en blanco y negro) ----------
const FLAMA = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1.5-4.5 3-6 0 2 1 3 2 3 0-3-1-6 1-9z" fill="#ff6b4a"/><path d="M12 13c.5 2 3 3 3 5.5a3 3 0 0 1-6 0c0-1.5 1-2.5 3-5.5z" fill="#ffc43d"/></svg>`;
const CANDADO = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2.5" fill="currentColor" opacity=".5"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.4" opacity=".5"/></svg>`;
const ALTAVOZ = `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 18h8l11-9v30l-11-9H8z" fill="currentColor"/><path d="M33 17a10 10 0 0 1 0 14M38 12a17 17 0 0 1 0 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>`;
const ALTAVOZ_CHICO = `<svg class="ico" viewBox="0 0 48 48" aria-hidden="true"><path d="M8 18h8l11-9v30l-11-9H8z" fill="currentColor"/><path d="M33 17a10 10 0 0 1 0 14" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>`;
const TORTUGA = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18v2M15 18v2" stroke="#2fbf7f" stroke-width="2.6" stroke-linecap="round"/><circle cx="20" cy="14.5" r="2.4" fill="#2fbf7f"/><path d="M2.5 18a8.5 8 0 0 1 17 0z" fill="#3ccf8e"/><path d="M7 17.5l2.5-5h4l2.5 5M9.5 12.5L11 10h1l1.5 2.5" fill="none" stroke="#fff" stroke-width="1.3" stroke-linejoin="round"/></svg>`;
const BURBUJA = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="#4cb3ff"/><path d="M6 9h12M6 12.5h8" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const BORRAR = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-6-7z" fill="currentColor" opacity=".25"/><path d="M11 9l6 6M17 9l-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`;
const PALOMITA = `<svg class="ico" viewBox="0 0 24 24" aria-label="Dominada"><circle cx="12" cy="12" r="10" fill="#3ccf8e"/><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const OJO = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg>`;
const FLECHITA = `<svg class="ico flechita" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ABEJA = `<svg class="abeja" viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="24" cy="18" rx="10" ry="13" fill="#d8efff" stroke="#9fd2f7" stroke-width="2" transform="rotate(-25 24 18)"/><ellipse cx="38" cy="16" rx="9" ry="12" fill="#d8efff" stroke="#9fd2f7" stroke-width="2" transform="rotate(20 38 16)"/><ellipse cx="32" cy="38" rx="20" ry="15" fill="#ffc43d"/><path d="M24 25c-3 8-3 18 0 26M34 23.5c-3 9-3 20 0 29" stroke="#2b2236" stroke-width="5" fill="none"/><circle cx="46" cy="35" r="3" fill="#2b2236"/><path d="M12 38l-6 2 6 2" fill="#2b2236"/></svg>`;

// ---------- Arranque ----------
// Sin "await" al nivel del módulo: algunos navegadores de TV todavía no lo soportan
Promise.all([Noli.datos, Voz.listo]).then(([d]) => { pr = cargar(d); inicio(); });
