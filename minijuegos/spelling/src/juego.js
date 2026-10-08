// Pantallas de "Spelling": inicio, palabra (escoge, arma, escribe), fin de ronda, reto del día (spelling bee,
// detective, contrarreloj), mi progreso y para papás. La lógica está en los otros módulos (puros); aquí solo se
// dibuja, se habla y se responde al dedo, al teclado o a las flechas.
import { Noli, moverFoco, focoInicial } from "../../../kit/noli.js";
import { LISTAS, ETAPAS, paso as datosPaso, lista as datosLista, conHueco, partir } from "./palabras.js";
import { opciones, letrasParaArmar, diferencias, igual } from "./faltas.js";
import { cargar, registrar, cerrarRonda, armarRonda, dominio, cumplirReto, racha, semana, resumen, fechaLocal, elegido, POR_RONDA } from "./progreso.js";
import { retoDelDia } from "./reto.js";
import { Voz, letraPorLetra } from "./voz.js";

const $main = document.getElementById("juego");
const rnd = Math.random;
let pr;                 // progreso
let pantalla = "inicio";
let juego = null;       // la ronda o el reto en curso
let timer = null, tapar = null;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const hoy = () => fechaLocal();
const guardar = () => Noli.guardar(pr);
const conVoz = () => Voz.hay && !pr.sinVoz;
const uno = (l) => l[Math.floor(Math.random() * l.length)];
const actual = () => juego.lista[juego.i % juego.lista.length];

function mostrar(html, nombre) {
  clearInterval(timer); timer = null; clearTimeout(tapar);
  Voz.callar();
  pantalla = nombre;
  $main.className = "p-" + nombre;
  $main.innerHTML = html;
  for (const b of $main.querySelectorAll("[data-ir]")) b.onclick = () => IR[b.dataset.ir](b.dataset);
  focoInicial($main);
}

// ---------- Inicio ----------

function inicio() {
  const i = elegido(pr), { lista, etapa } = datosPaso(i), reto = pr.retos[hoy()], r = racha(pr, hoy());
  mostrar(`
    <h1 class="titulo">${ABEJA}Spelling</h1>
    <p class="sub">Lista ${lista}: ${esc(datosLista(lista).nombre)} <span class="ej">(${esc(datosLista(lista).patron)})</span></p>
    <p class="etapa-chip">${ETAPAS.map((e) => `<span class="${e === etapa ? "on" : ""}">${e.nombre}</span>`).join(FLECHITA)}</p>
    ${barraDominio(i)}
    <div class="menu">
      <button class="boton grande primario" data-foco="inicial" data-ir="ronda">Jugar</button>
      <button class="boton grande ${reto?.cumplido ? "hecho" : "reto"}" data-foco data-ir="retoIntro">
        Reto del día <small>${reto?.cumplido ? "¡Cumplido!" : "Te espera"}</small></button>
      <button class="boton grande" data-foco data-ir="progreso">Mi progreso</button>
    </div>
    <p class="racha">${FLAMA}<span>${r ? `Racha: <b>${r}</b> ${r === 1 ? "día" : "días"}` : "Cumple el reto de hoy para empezar una racha"}</span></p>
    ${conVoz() ? "" : `<p class="nota">${Voz.hay ? "La voz está apagada" : "Este aparato no tiene voz en inglés"}: te enseñaré cada palabra un momento.</p>`}`, "inicio");
}

function barraDominio(i) {
  if (pr.pasos[i]?.dominado) return `<p class="dominio ok">¡Ya dominas esta etapa!</p>`;
  const dm = dominio(pr, i), pct = Math.round((100 * dm.intentos) / dm.ventana);
  return `<div class="dominio"><div class="barra"><i style="width:${pct}%"></i></div>
    <small>${dm.intentos < dm.ventana ? `Practica ${dm.ventana - dm.intentos} palabras más para ver si pasas` : `Contesta ${dm.necesita} de ${dm.ventana} bien para pasar`}</small></div>`;
}

// ---------- Una palabra ----------

function nuevaRonda() {
  const i = elegido(pr), { etapa } = datosPaso(i);
  juego = { modo: "ronda", paso: i, etapa: etapa.id, lista: armarRonda(pr, i, rnd), i: 0, aciertos: 0, repetidas: 0 };
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
  const oir = conVoz() ? `
    <div class="oir">
      <button class="altavoz" data-foco data-ir="decir" aria-label="Otra vez">${ALTAVOZ}<span>Otra vez</span></button>
      <button class="boton chico" data-foco data-ir="despacio">${TORTUGA} Despacio</button>
      <button class="boton chico" data-foco data-ir="frase">${BURBUJA} Frase</button>
    </div>
    <p class="frase" hidden></p>` : `
    <p class="frase">${esc(conHueco(it.frase, it.palabra))}</p>
    ${etapa === "escoge" ? "" : `<div class="mirar"><span class="mira">${esc(it.palabra)}</span><button class="boton chico" data-foco data-ir="mirar">${OJO} Ver otra vez</button></div>`}`;
  mostrar(`
    ${cabecera()}
    <p class="instr">${esc(ETAPAS.find((e) => e.id === etapa).que)}</p>
    ${oir}
    <div class="zona z-${etapa}">${zona}</div>
    <p class="aviso" aria-live="polite"></p>
    <div class="abajo"></div>`, "palabra");
  for (const b of $main.querySelectorAll(".op")) b.onclick = () => escoger(+b.dataset.k);
  for (const b of $main.querySelectorAll(".ficha")) b.onclick = () => tocarFicha(+b.dataset.k);
  for (const b of $main.querySelectorAll(".tecla")) b.onclick = () => teclear(b.dataset.c);
  if (juego.modo === "contrarreloj") correrReloj();
  // Se dice al instante (dentro del toque que abrió la pantalla: iOS solo deja hablar así la primera vez)
  if (conVoz()) decir(); else if (etapa !== "escoge") mirar();
}

function cabecera() {
  if (juego.modo === "ronda") {
    const puntos = Array.from({ length: POR_RONDA }, (_, k) => `<i class="${k < Math.min(juego.i, POR_RONDA) ? "lleno" : ""}"></i>`).join("");
    const { lista, etapa } = datosPaso(juego.paso), it = actual();
    return `<header class="cab"><span>Lista ${lista} · ${etapa.nombre}${it.tipo === "repaso" ? " · repaso" : ""}</span><span class="puntos">${puntos}</span></header>`;
  }
  if (juego.modo === "contrarreloj") return `<header class="cab"><span>Contrarreloj · ${juego.aciertos} bien</span><span class="reloj"><i style="width:${relojPct()}%"></i></span></header>`;
  return `<header class="cab"><span>${juego.modo === "abeja" ? "Spelling bee" : "Detective"}</span><span class="cuenta">${juego.i + 1} de ${juego.lista.length}</span></header>`;
}

// ---------- Voz y "mirar" ----------

function decir() { Voz.decir(actual().palabra); }
function despacio() { Voz.decir(actual().palabra, 0.5); }
function frase() {
  const it = actual(), p = $main.querySelector(".frase");
  p.textContent = conHueco(it.frase, it.palabra);
  p.hidden = false;
  Voz.decir(it.frase, 0.85);
}
// Sin voz: enseña la palabra 3 segundos y la tapa (mira, tapa, escribe, revisa)
function mirar() {
  const m = $main.querySelector(".mira");
  if (!m) return;
  m.classList.remove("tapada");
  clearTimeout(tapar);
  tapar = setTimeout(() => m.classList.add("tapada"), 3000);
}

// ---------- Contestar ----------

function escoger(k) {
  if (juego.contestado) return;
  const o = juego.ops[k];
  const botones = [...$main.querySelectorAll(".op")];
  botones[k].classList.add(o.correcta ? "bien" : "mal");
  if (!o.correcta) botones[juego.ops.findIndex((x) => x.correcta)].classList.add("bien");
  for (const b of botones) { b.disabled = true; }
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
  const sig = libres.find((x) => +x.dataset.k > +b.dataset.k) || libres[0];
  sig?.focus();
}

function pintarHuecos() {
  const hs = $main.querySelectorAll(".huecos span");
  hs.forEach((h, k) => { h.textContent = juego.escrito[k]?.c || ""; h.classList.toggle("lleno", !!juego.escrito[k]); });
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
  clearTimeout(tapar);
  const it = actual();
  pr = registrar(pr, juego.modo === "ronda" ? juego.paso : null, it.palabra, ok, hoy());
  guardar();
  $main.querySelector(".mira")?.classList.remove("tapada");
  // Al armar o escribir, las letras y el teclado se quitan y en su lugar queda la palabra bien escrita
  if (juego.etapa !== "escoge") $main.querySelector(".zona").innerHTML = correccion(it.palabra, intento, ok);

  if (juego.modo === "ronda") {
    if (ok && it.tipo !== "otra") juego.aciertos++;
    // La que falló vuelve al final de la ronda (una vez, para practicarla)
    if (!ok && it.tipo !== "otra" && juego.repetidas < 3) { juego.lista.push({ ...it, tipo: "otra" }); juego.repetidas++; }
  } else if (ok) juego.aciertos++;

  if (juego.modo === "contrarreloj") { if (!ok) aviso(`Se escribe ${it.palabra}.`, "mal"); return setTimeout(siguiente, ok ? 350 : 1400); }
  if (ok) {
    aviso(uno(["¡Bien!", "¡Muy bien!", "¡Eso!", "¡Perfecto!", "¡Excelente!"]), "bien");
    setTimeout(siguiente, 1000);
    return;
  }
  // Error: enseñar cómo se escribe, deletrearla en voz alta y esperar a "Seguir"
  aviso(motivo || (juego.etapa === "escoge" ? `Se escribe ${it.palabra}.` : "Fíjate en las letras marcadas."), "mal");
  if (conVoz()) Voz.decir(`${it.palabra}. ${letraPorLetra(it.palabra)} ${it.palabra}.`, 0.75);
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
  juego.i++;
  if (juego.modo === "ronda") return juego.i < juego.lista.length ? palabra() : finRonda();
  if (juego.modo === "contrarreloj") return palabra();
  if (juego.modo === "abeja") return juego.i < juego.lista.length ? palabra() : finReto();
  if (juego.modo === "detective") return juego.i < juego.lista.length ? detective() : finReto();
}

function finRonda() {
  const { pr: nuevo, subio, estrellas } = cerrarRonda(pr, juego.paso, juego.aciertos);
  pr = nuevo;
  guardar();
  Noli.terminar({ estrellas });
  const s = subio != null ? datosPaso(subio) : null;
  mostrar(`
    <h1 class="titulo">${["¡Buen intento!", "¡Bien hecho!", "¡Muy bien!", "¡Perfecto!"][estrellas]}</h1>
    <p class="estrellas grande">${estrellasHtml(estrellas)}</p>
    <p class="sub">${juego.aciertos} de ${POR_RONDA} a la primera</p>
    ${s ? `<div class="subio"><b>${s.etapa.id === "escoge" ? `¡Abriste la lista ${s.lista}!` : `¡Pasaste a ${s.etapa.nombre}!`}</b>
      <span>${s.etapa.id === "escoge" ? esc(datosLista(s.lista).nombre) + ": " + esc(datosLista(s.lista).patron) : esc(s.etapa.que) + "."}</span></div>` : ""}
    <div class="menu fila">
      <button class="boton grande primario" data-foco="inicial" data-ir="ronda">${s ? "¡Vamos!" : "Otra ronda"}</button>
      <button class="boton grande" data-foco data-ir="inicio">Inicio</button>
    </div>`, "fin");
}

const estrellasHtml = (n) => Array.from({ length: 3 }, (_, i) => `<span class="${i < n ? "on" : "off"}">★</span>`).join("");

// ---------- Reto del día ----------

function retoIntro() {
  const reto = retoDelDia(hoy(), pr.paso), hecho = pr.retos[hoy()];
  const modo = reto.modo ? ETAPAS.find((e) => e.id === reto.modo).nombre : null;
  mostrar(`
    <h1 class="titulo">Reto del día</h1>
    <div class="tarjeta-reto">
      <b>${esc(reto.nombre)}</b>
      <p>${esc(reto.meta)}${reto.objetivo ? ` Meta: <b>${reto.objetivo}</b>.` : ""}</p>
      ${modo && reto.tipo === "abeja" ? `<small>Modo: ${modo}</small>` : ""}
      ${hecho ? `<p class="hecho-txt">${hecho.cumplido ? "¡Ya lo cumpliste hoy! Puedes jugarlo otra vez." : `Hoy llevas ${hecho.puntos}. ¡Inténtalo otra vez!`}</p>` : ""}
    </div>
    <div class="menu fila">
      <button class="boton grande primario" data-foco="inicial" data-ir="retoJugar">¡Empezar!</button>
      <button class="boton grande" data-foco data-ir="inicio">Inicio</button>
    </div>
    ${semanaHtml()}`, "retoIntro");
}

function retoJugar() {
  const reto = retoDelDia(hoy(), pr.paso);
  juego = { modo: reto.tipo, reto, etapa: reto.modo || null, lista: reto.palabras || reto.frases, i: 0, aciertos: 0, fin: performance.now() + (reto.segundos || 0) * 1000 };
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
    ${conVoz() ? `<button class="boton chico" data-foco data-ir="oirFrase">${ALTAVOZ_CHICO} Escuchar la frase</button>` : ""}
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
  const kFalta = partes.findIndex((p) => p.es);
  botones[kFalta].classList.add("era");
  for (const b of botones) { b.disabled = true; b.removeAttribute("data-foco"); }
  aviso(ok ? `¡La encontraste! Se escribe ${it.palabra}.` : `La mal escrita era "${it.falta}". Se escribe ${it.palabra}.`, ok ? "bien" : "mal");
  $main.querySelector(".zona").innerHTML = correccion(it.palabra, it.falta, false);
  if (conVoz()) Voz.decir(`${it.palabra}. ${letraPorLetra(it.palabra)}`, 0.75);
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
  const r = racha(pr, hoy()), sel = elegido(pr);
  mostrar(`
    <h1 class="titulo">Mi progreso</h1>
    <p class="racha">${FLAMA}<span>Racha: <b>${r}</b> ${r === 1 ? "día" : "días"}</span></p>
    ${semanaHtml()}
    <ol class="mapa">${LISTAS.map((l) => {
      const abierta = (l.n - 1) * ETAPAS.length <= pr.paso;
      return `<li class="${abierta ? "" : "cerrada"}"><b class="num">${l.n}</b><span class="nom">${esc(l.nombre)}<small>${esc(l.patron)}</small></span>
        <span class="etapas">${ETAPAS.map((e, k) => {
          const i = (l.n - 1) * ETAPAS.length + k, ps = pr.pasos[i], abierto = i <= pr.paso;
          const cls = ps?.dominado ? "dominado" : abierto ? "abierto" : "cerrado";
          return `<button class="et ${cls}${i === sel ? " actual" : ""}" ${abierto ? `data-foco${i === sel ? '="inicial"' : ""} data-ir="elegir" data-i="${i}"` : "disabled"}
            aria-label="${esc(e.nombre)}${ps?.dominado ? ", dominada" : abierto ? "" : ", bloqueada"}">${abierto ? esc(e.nombre) : CANDADO}${ps?.dominado ? `<i class="estrellas">${estrellasHtml(ps.estrellas)}</i>` : ""}</button>`;
        }).join("")}</span></li>`;
    }).join("")}</ol>
    <div class="menu fila">
      <button class="boton" data-foco data-ir="inicio">Inicio</button>
      <button class="boton" data-foco data-ir="papas">Para papás</button>
    </div>`, "progreso");
}

function papas() {
  const R = resumen(pr), pct = (x) => (x == null ? "–" : x + " %");
  mostrar(`
    <h1 class="titulo chico">Para papás</h1>
    <p class="nota">Cada lista se juega en tres etapas: escoger la palabra bien escrita, armarla con letras y escribirla.
      Se pasa con 9 de las últimas 10 bien (18 de 20 en Escribe). El progreso se guarda en este dispositivo.</p>
    <table class="tabla"><thead><tr><th>Lista</th>${ETAPAS.map((e) => `<th>${e.nombre}</th>`).join("")}</tr></thead><tbody>
    ${R.listas.filter((l) => l.etapas.some((e) => e.abierto || e.total)).map((l) => `<tr><td>${l.n}. ${esc(l.nombre)}</td>${l.etapas.map((e) =>
      `<td>${e.total ? `${pct(e.pct)} <small>(${e.total})</small>` : e.abierto ? "–" : ""}${e.dominado ? " ✓" : ""}</td>`).join("")}</tr>`).join("")}
    </tbody></table>
    <h2>Las que más falla</h2>
    ${R.fallos.length ? `<p class="fallos">${R.fallos.map((f) => `<span>${esc(f.palabra)} <small>×${f.veces}</small></span>`).join("")}</p>` : `<p class="nota">Ninguna pendiente.</p>`}
    <h2>Últimos días</h2>
    ${R.dias.length ? `<table class="tabla"><thead><tr><th>Día</th><th>Palabras</th><th>Aciertos</th><th>Reto</th></tr></thead><tbody>
      ${R.dias.reverse().map((d) => `<tr><td>${d.fecha}</td><td>${d.palabras}</td><td>${d.palabras ? Math.round((100 * d.aciertos) / d.palabras) + " %" : "–"}</td><td>${d.reto ? "✓" : ""}</td></tr>`).join("")}
    </tbody></table>` : `<p class="nota">Todavía no hay días jugados.</p>`}
    <h2>Voz</h2>
    <p class="nota">${Voz.hay ? `Voz en inglés: ${esc(Voz.nombre)}.` : "Este navegador no tiene voz en inglés, así que el juego enseña cada palabra 3 segundos y la tapa."}</p>
    <div class="menu fila">
      ${Voz.hay ? `<button class="boton" data-foco data-ir="cambiarVoz">${pr.sinVoz ? "Encender la voz" : "Apagar la voz (enseñar la palabra)"}</button>` : ""}
      <button class="boton" data-foco="inicial" data-ir="progreso">Regresar</button>
    </div>`, "papas");
}

// ---------- Navegación ----------

const IR = {
  inicio, progreso, papas, retoIntro, retoJugar, decir, despacio, frase, mirar, listo,
  ronda: nuevaRonda,
  borrar: () => borrar(),
  oirFrase: () => Voz.decir(actual().frase, 0.85),
  elegir: ({ i }) => { pr = { ...pr, elegido: +i }; guardar(); inicio(); },
  cambiarVoz: () => { pr = { ...pr, sinVoz: !pr.sinVoz }; guardar(); papas(); },
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
    if (pantalla === "inicio") return false;                       // el kit regresa al catálogo
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
const OJO = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg>`;
const FLECHITA = `<svg class="ico flechita" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ABEJA = `<svg class="abeja" viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="24" cy="18" rx="10" ry="13" fill="#d8efff" stroke="#9fd2f7" stroke-width="2" transform="rotate(-25 24 18)"/><ellipse cx="38" cy="16" rx="9" ry="12" fill="#d8efff" stroke="#9fd2f7" stroke-width="2" transform="rotate(20 38 16)"/><ellipse cx="32" cy="38" rx="20" ry="15" fill="#ffc43d"/><path d="M24 25c-3 8-3 18 0 26M34 23.5c-3 9-3 20 0 29" stroke="#2b2236" stroke-width="5" fill="none"/><circle cx="46" cy="35" r="3" fill="#2b2236"/><path d="M12 38l-6 2 6 2" fill="#2b2236"/></svg>`;

// ---------- Arranque ----------
// Sin "await" al nivel del módulo: algunos navegadores de TV todavía no lo soportan
Promise.all([Noli.datos, Voz.listo]).then(([d]) => { pr = cargar(d); inicio(); });
