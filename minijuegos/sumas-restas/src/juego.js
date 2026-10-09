// Pantallas de "Sumas y restas": inicio, ronda, fin de ronda, reto del día, mi progreso y para papás.
// Toda la lógica está en los otros módulos (puros); aquí solo se dibuja y se responde al dedo o a las flechas.
import { Noli, moverFoco, focoInicial } from "../../../kit/noli.js";
import { NIVELES, nivel as datosNivel, respuesta, SIGNO } from "./niveles.js";
import { opciones } from "./generar.js";
import { cargar, registrar, cerrarRonda, armarRonda, dominio, cumplirReto, racha, semana, resumen, fechaLocal, VENTANA } from "./progreso.js";
import { retoDelDia } from "./reto.js";
import { pista } from "./dibujos.js";

const $main = document.getElementById("juego");
const rnd = Math.random;
let pr;                 // progreso
let pantalla = "inicio";
let juego = null;       // la ronda o el reto en curso
let timer = null;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const hoy = () => fechaLocal();
const elegido = () => Math.min(pr.elegido || pr.nivel, pr.nivel);
const guardar = () => Noli.guardar(pr);
// El problema en curso (en "sin errores" la lista se recorre en círculo si hace falta)
const actual = () => juego.lista[juego.i % juego.lista.length];

function mostrar(html, nombre) {
  clearInterval(timer); timer = null;
  pantalla = nombre;
  $main.className = "p-" + nombre;
  $main.innerHTML = html;
  for (const b of $main.querySelectorAll("[data-ir]")) b.onclick = () => IR[b.dataset.ir](b.dataset);
  focoInicial($main);
}

// ---------- Inicio ----------

function inicio() {
  const n = elegido(), dn = datosNivel(n), reto = pr.retos[hoy()], r = racha(pr, hoy());
  const dm = dominio(pr, n);
  mostrar(`
    <h1 class="titulo">Sumas y restas</h1>
    <p class="sub">Nivel ${n}: ${esc(dn.nombre)} <span class="ej">(${esc(dn.ejemplo)})</span></p>
    ${barraDominio(dm, pr.niveles[n]?.dominado)}
    <div class="menu">
      <button class="boton grande primario" data-foco="inicial" data-ir="ronda">Jugar</button>
      <button class="boton grande ${reto?.cumplido ? "hecho" : "reto"}" data-foco data-ir="retoIntro">
        Reto del día <small>${reto?.cumplido ? "¡Cumplido!" : "Te espera"}</small></button>
      <button class="boton grande" data-foco data-ir="progreso">Mi progreso</button>
    </div>
    <p class="racha">${FLAMA}<span>${r ? `Racha: <b>${r}</b> ${r === 1 ? "día" : "días"}` : "Cumple el reto de hoy para empezar una racha"}</span></p>`, "inicio");
}

function barraDominio(dm, dominado) {
  if (dominado) return `<p class="dominio ok">¡Ya dominas este nivel!</p>`;
  const pct = Math.round((100 * dm.intentos) / VENTANA);
  return `<div class="dominio"><div class="barra"><i style="width:${pct}%"></i></div>
    <small>${dm.intentos < VENTANA ? `Practica ${VENTANA - dm.intentos} más para ver si subes de nivel` : "Contesta 18 de 20 bien y sin prisa para subir"}</small></div>`;
}

// ---------- Ronda ----------

function nuevaRonda() {
  const n = elegido();
  juego = { modo: "ronda", n, lista: armarRonda(pr, n, rnd), i: 0, aciertos: 0, repetidos: 0 };
  problema();
}

// Muestra el problema actual de la ronda o del reto
function problema() {
  const it = actual();
  juego.ops = opciones(it.p, rnd);
  juego.t0 = performance.now();
  juego.contestado = false;
  const cab = cabecera();
  mostrar(`
    ${cab}
    ${it.texto ? `<p class="historia">${esc(it.texto)}</p>` : ""}
    <div class="problema" aria-live="polite">${escribir(it.p)}</div>
    <div class="opciones">${juego.ops.map((o, k) => `<button class="op" data-foco${k === 0 ? '="inicial"' : ""} data-k="${k}">${o.valor}</button>`).join("")}</div>
    <div class="abajo">
      ${juego.modo === "contrarreloj" ? "" : `<button class="boton chico" data-foco data-ir="pista">Pista</button>`}
    </div>
    <div class="pista" hidden></div>
    <p class="aviso" aria-live="polite"></p>`, "problema");
  for (const b of $main.querySelectorAll(".op")) b.onclick = () => contestar(+b.dataset.k);
  if (juego.modo === "contrarreloj") correrReloj();
}

function cabecera() {
  const it = actual();
  if (juego.modo === "ronda") {
    const puntos = Array.from({ length: 10 }, (_, k) => `<i class="${k < Math.min(juego.i, 10) ? "lleno" : ""}"></i>`).join("");
    return `<header class="cab"><span>Nivel ${it.n === juego.n ? juego.n : `${it.n} · repaso`}</span><span class="puntos">${puntos}</span></header>`;
  }
  if (juego.modo === "contrarreloj") return `<header class="cab"><span>Contrarreloj · ${juego.aciertos} bien</span><span class="reloj"><i style="width:${relojPct()}%"></i></span></header>`;
  if (juego.modo === "sinErrores") return `<header class="cab"><span>Sin errores</span><span class="cuenta">${juego.seguidas} de ${juego.reto.seguidas}</span></header>`;
  return `<header class="cab"><span>Problemas con palabras</span><span class="cuenta">${juego.i + 1} de ${juego.lista.length}</span></header>`;
}

function escribir(p) {
  const caja = `<span class="caja">?</span>`;
  const v = (x) => (p.falta === x ? caja : `<span>${p[x]}</span>`);
  return `${v("a")}<span class="signo">${SIGNO[p.op]}</span>${v("b")}<span class="signo">=</span>${v("r")}`;
}

function contestar(k) {
  if (juego.contestado) return;
  juego.contestado = true;
  const it = actual(), o = juego.ops[k], ok = o.correcta;
  const seg = (performance.now() - juego.t0) / 1000;
  pr = registrar(pr, it.n, it.p, ok, seg, hoy());
  guardar();

  const botones = [...$main.querySelectorAll(".op")];
  botones[k].classList.add(ok ? "bien" : "mal");
  if (!ok) botones[juego.ops.findIndex((x) => x.correcta)].classList.add("bien");
  $main.querySelector(".caja")?.replaceWith(Object.assign(document.createElement("span"), { className: ok ? "caja bien" : "caja", textContent: respuesta(it.p) }));

  if (juego.modo === "ronda") {
    if (ok && it.tipo !== "otra") juego.aciertos++;
    // El que falló vuelve al final de la ronda (una vez, como práctica)
    if (!ok && it.tipo !== "otra" && juego.repetidos < 3) { juego.lista.push({ ...it, tipo: "otra" }); juego.repetidos++; }
  }
  if (juego.modo === "contrarreloj") { if (ok) juego.aciertos++; return setTimeout(siguiente, ok ? 250 : 900); }
  if (juego.modo === "sinErrores") juego.seguidas = ok ? juego.seguidas + 1 : 0;
  if (juego.modo === "palabras" && ok) juego.aciertos++;

  if (ok) { aviso(uno(["¡Bien!", "¡Muy bien!", "¡Eso!", "¡Correcto!"]), "bien"); setTimeout(siguiente, 800); return; }
  // Error: explicar, enseñar la pista y esperar a que diga "Seguir"
  aviso(o.motivo || `Era ${respuesta(it.p)}.`, "mal");
  verPista(true);
  const abajo = $main.querySelector(".abajo");
  abajo.innerHTML = `<button class="boton primario" data-foco="inicial">Seguir</button>`;
  abajo.querySelector("button").onclick = siguiente;
  for (const b of botones) { b.disabled = true; b.removeAttribute("data-foco"); }
  focoInicial(abajo);
}

function siguiente() {
  if (pantalla !== "problema") return;
  juego.i++;
  if (juego.modo === "ronda") return juego.i < juego.lista.length ? problema() : finRonda();
  if (juego.modo === "sinErrores") return juego.seguidas >= juego.reto.seguidas ? finReto() : problema();
  if (juego.modo === "palabras") return juego.i < juego.lista.length ? problema() : finReto();
  if (juego.modo === "contrarreloj") return problema();
}

function aviso(t, clase) { const a = $main.querySelector(".aviso"); a.textContent = t; a.className = "aviso " + clase; }
const uno = (l) => l[Math.floor(Math.random() * l.length)];

function verPista(forzar) {
  const caja = $main.querySelector(".pista");
  if (!caja) return;
  if (!caja.hidden && !forzar) { caja.hidden = true; return; }
  const it = actual();
  caja.innerHTML = pista(it.p, datosNivel(it.n).ayuda);
  caja.hidden = false;
}

function finRonda() {
  const { pr: nuevo, subio, estrellas } = cerrarRonda(pr, juego.n, juego.aciertos);
  pr = subio ? { ...nuevo, elegido: subio } : nuevo;
  guardar();
  Noli.terminar({ estrellas });
  mostrar(`
    <h1 class="titulo">${["¡Buen intento!", "¡Bien hecho!", "¡Muy bien!", "¡Perfecto!"][estrellas]}</h1>
    <p class="estrellas grande">${estrellasHtml(estrellas)}</p>
    <p class="sub">${juego.aciertos} de 10 a la primera</p>
    ${subio ? `<div class="subio"><b>¡Subiste al nivel ${subio}!</b><span>${esc(datosNivel(subio).nombre)}: ${esc(datosNivel(subio).ejemplo)}</span></div>` : ""}
    <div class="menu fila">
      <button class="boton grande primario" data-foco="inicial" data-ir="ronda">${subio ? "Probar el nivel nuevo" : "Otra ronda"}</button>
      <button class="boton grande" data-foco data-ir="inicio">Inicio</button>
    </div>`, "fin");
}

const estrellasHtml = (n) => Array.from({ length: 3 }, (_, i) => `<span class="${i < n ? "on" : "off"}">★</span>`).join("");

// ---------- Reto del día ----------

function retoIntro() {
  const reto = retoDelDia(hoy(), pr.nivel), hecho = pr.retos[hoy()];
  mostrar(`
    <h1 class="titulo">Reto del día</h1>
    <div class="tarjeta-reto">
      <b>${esc(reto.nombre)}</b>
      <p>${esc(reto.meta)}${reto.objetivo ? ` Meta: <b>${reto.objetivo}</b>.` : ""}</p>
      <small>Nivel ${reto.n}: ${esc(datosNivel(reto.n).nombre)}</small>
      ${hecho ? `<p class="hecho-txt">${hecho.cumplido ? "¡Ya lo cumpliste hoy! Puedes jugarlo otra vez." : `Hoy llevas ${hecho.puntos}. ¡Inténtalo otra vez!`}</p>` : ""}
    </div>
    <div class="menu fila">
      <button class="boton grande primario" data-foco="inicial" data-ir="retoJugar">¡Empezar!</button>
      <button class="boton grande" data-foco data-ir="inicio">Inicio</button>
    </div>
    ${semanaHtml()}`, "retoIntro");
}

function retoJugar() {
  const reto = retoDelDia(hoy(), pr.nivel);
  juego = { modo: reto.tipo, reto, lista: reto.problemas, i: 0, aciertos: 0, seguidas: 0, fin: performance.now() + (reto.segundos || 0) * 1000 };
  problema();
}

const relojPct = () => Math.max(0, Math.min(100, ((juego.fin - performance.now()) / (juego.reto.segundos * 1000)) * 100));
function correrReloj() {
  const barra = $main.querySelector(".reloj i");
  timer = setInterval(() => {
    if (barra) barra.style.width = relojPct() + "%";
    if (performance.now() >= juego.fin) finReto();
  }, 200);
}

function finReto() {
  const r = juego.reto;
  const puntos = r.tipo === "contrarreloj" ? juego.aciertos : r.tipo === "sinErrores" ? juego.seguidas : juego.aciertos;
  const cumplido = r.tipo === "contrarreloj" ? puntos >= r.objetivo : r.tipo === "sinErrores" ? puntos >= r.seguidas : puntos >= r.necesita;
  const antes = !!pr.retos[hoy()]?.cumplido;
  pr = cumplirReto(pr, hoy(), r.tipo, puntos, cumplido);
  guardar();
  // Reto cumplido por primera vez hoy: cuenta como partida de 3 estrellas y da el bono de créditos del reto (#20)
  if (cumplido && !antes) Noli.terminar({ estrellas: 3, reto: true });
  const detalle = r.tipo === "contrarreloj" ? `${puntos} bien en 60 segundos (meta: ${r.objetivo})`
    : r.tipo === "palabras" ? `${puntos} de ${r.cuantos} bien` : `${puntos} seguidas sin fallar`;
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
  const r = racha(pr, hoy());
  mostrar(`
    <h1 class="titulo">Mi progreso</h1>
    <p class="racha">${FLAMA}<span>Racha: <b>${r}</b> ${r === 1 ? "día" : "días"}</span></p>
    ${semanaHtml()}
    <ol class="mapa">${NIVELES.map((x) => {
      const nv = pr.niveles[x.n], abierto = x.n <= pr.nivel, dm = dominio(pr, x.n);
      const estado = nv?.dominado ? `<span class="estrellas">${estrellasHtml(nv.estrellas)}</span>`
        : abierto ? `<span class="en-curso">${dm.intentos} de ${VENTANA}</span>` : `<span class="candado">${CANDADO}</span>`;
      return `<li><button class="nivel ${nv?.dominado ? "dominado" : abierto ? "abierto" : "cerrado"}${x.n === elegido() ? " actual" : ""}"
        ${abierto ? `data-foco${x.n === elegido() ? '="inicial"' : ""} data-ir="elegir" data-n="${x.n}"` : "disabled"}>
        <b>${x.n}</b><span class="nom">${esc(x.nombre)}<small>${esc(x.ejemplo)}</small></span>${estado}</button></li>`;
    }).join("")}</ol>
    <div class="menu fila">
      <button class="boton" data-foco data-ir="inicio">Inicio</button>
      <button class="boton" data-foco data-ir="papas">Para papás</button>
    </div>`, "progreso");
}

function papas() {
  const R = resumen(pr);
  const seg = (x) => (x == null ? "–" : x.toFixed(1).replace(".0", "") + " s");
  mostrar(`
    <h1 class="titulo chico">Para papás</h1>
    <p class="nota">Sube de nivel con ${Math.round(VENTANA * 0.9)} de los últimos ${VENTANA} bien y la mediana del tiempo dentro del límite. El progreso se guarda en este dispositivo.</p>
    <table class="tabla"><thead><tr><th>Nivel</th><th>Problemas</th><th>Aciertos</th><th>Tiempo (mediana / límite)</th><th></th></tr></thead><tbody>
    ${R.niveles.filter((x) => x.desbloqueado || x.total).map((x) => `<tr><td>${x.n}. ${esc(x.nombre)}</td><td>${x.total}</td><td>${x.pct == null ? "–" : x.pct + " %"}</td>
      <td>${seg(x.mediana)} / ${x.limite} s</td><td>${x.dominado ? "Dominado" : ""}</td></tr>`).join("")}
    </tbody></table>
    <h2>Los que más falla</h2>
    ${R.fallos.length ? `<p class="fallos">${R.fallos.map((f) => `<span>${f.p.falta === "a" ? "□" : f.p.a} ${SIGNO[f.p.op]} ${f.p.falta === "b" ? "□" : f.p.b} = ${f.p.falta === "r" ? respuesta(f.p) : f.p.r} <small>×${f.veces}</small></span>`).join("")}</p>` : `<p class="nota">Ninguno pendiente.</p>`}
    <h2>Últimos días</h2>
    ${R.dias.length ? `<table class="tabla"><thead><tr><th>Día</th><th>Problemas</th><th>Aciertos</th><th>Reto</th></tr></thead><tbody>
      ${R.dias.reverse().map((d) => `<tr><td>${d.fecha}</td><td>${d.problemas}</td><td>${d.problemas ? Math.round((100 * d.aciertos) / d.problemas) + " %" : "–"}</td><td>${d.reto ? "✓" : ""}</td></tr>`).join("")}
    </tbody></table>` : `<p class="nota">Todavía no hay días jugados.</p>`}
    <div class="menu fila"><button class="boton" data-foco="inicial" data-ir="progreso">Regresar</button></div>`, "papas");
}

// ---------- Navegación ----------

const IR = {
  inicio, progreso, papas, retoIntro, retoJugar,
  ronda: nuevaRonda,
  pista: () => verPista(false),
  elegir: ({ n }) => { pr = { ...pr, elegido: +n }; guardar(); inicio(); },
};

Noli.alEntrar((accion) => {
  if (moverFoco(accion, $main)) return true;
  if (accion === "ok") { const e = document.activeElement; if (e && $main.contains(e) && !e.disabled) e.click(); return true; }
  if (accion === "atras") {
    if (pantalla === "inicio") return false;            // el kit regresa al catálogo
    if (pantalla === "papas") { progreso(); return true; }
    inicio(); return true;
  }
});
document.addEventListener("pointerdown", () => document.documentElement.classList.remove("teclado"), true);

// ---------- Íconos (SVG, no emoji) ----------
const FLAMA = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1.5-4.5 3-6 0 2 1 3 2 3 0-3-1-6 1-9z" fill="#ff6b4a"/><path d="M12 13c.5 2 3 3 3 5.5a3 3 0 0 1-6 0c0-1.5 1-2.5 3-5.5z" fill="#ffc43d"/></svg>`;
const CANDADO = `<svg class="ico" viewBox="0 0 24 24" aria-label="Bloqueado"><rect x="5" y="10" width="14" height="11" rx="2.5" fill="currentColor" opacity=".5"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.4" opacity=".5"/></svg>`;

// ---------- Arranque ----------
// Sin "await" al nivel del módulo: algunos navegadores de TV todavía no lo soportan
Noli.datos.then((d) => { pr = cargar(d); inicio(); });
