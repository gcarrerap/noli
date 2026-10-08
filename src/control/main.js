// Pantalla del teléfono como control remoto (control.html, issue #3): pedir el código si hace falta, la cruceta
// con OK y Atrás, y el indicador de "conectado a la TV". La lógica está en app/telefono.js y app/enlace.js.
import { telefono } from "../app/telefono.js";
import { teclaAAccion } from "../../kit/teclas.js";

const $ = (s) => document.querySelector(s);
const REPETIR_DESPUES_MS = 400, REPETIR_CADA_MS = 140; // flechas: dejar el dedo apretado repite

const TEXTO = {
  apagado: ["", ""],
  conectando: ["⏳ Conectando con la TV…", "espera"],
  conectado: ["🟢 Conectado a la TV", "ok"],
  "sin-tv": ["⏸️ La TV no responde. ¿Está prendido Noli?", "mal"],
  "no-existe": ["", ""],
  otro: ["Otro teléfono está usando la TV", "mal"],
  error: ["⚠️ Sin conexión. Reintentando…", "mal"],
};

function dibujar() {
  const { estado, via } = telefono.estado();
  const pedir = estado === "apagado" || estado === "no-existe";
  $("#pedir").hidden = !pedir;
  $("#mando").hidden = pedir;
  $("#cambiar").hidden = pedir;
  $("#codigo-actual").textContent = pedir || !telefono.codigo ? "" : `TV ${telefono.codigo}`;
  $("#codigo-error").textContent = estado === "no-existe" ? "No encontré ninguna TV con ese código. Revísalo en la tele." : "";

  let [txt, clase] = TEXTO[estado] || TEXTO.conectando;
  if (estado === "conectado" && !via) { txt = "⏳ Conectando con la TV…"; clase = "espera"; }
  if (estado === "conectado" && via === "firestore") txt = "🟢 Conectado a la TV (por internet)";
  const el = $("#estado");
  el.textContent = pedir ? "" : txt;
  el.className = "control-estado " + clase;
  document.documentElement.classList.toggle("activo", estado === "conectado");

  const aviso = $("#aviso");
  if (estado === "otro") {
    aviso.hidden = false;
    aviso.innerHTML = `<p>Otro teléfono tomó el control de la TV.</p><button class="primario" id="tomar">Usar este teléfono</button>`;
    $("#tomar").onclick = () => telefono.reconectar({ forzar: true });
  } else aviso.hidden = true;

  if (estado === "conectado") pedirPantallaPrendida();
}

// ---------- Botones ----------
function mandar(accion, boton) {
  const via = telefono.enviar(accion);
  if (!via) { telefono.reconectar(); return; }
  try { if (navigator.vibrate) navigator.vibrate(12); } catch (x) {}
  if (boton) { boton.classList.remove("toque"); void boton.offsetWidth; boton.classList.add("toque"); }
}

function instalarBotones() {
  for (const b of document.querySelectorAll("[data-accion]")) {
    const accion = b.dataset.accion;
    const repite = accion !== "ok" && accion !== "atras";
    let t1 = null, t2 = null;
    const parar = () => { clearTimeout(t1); clearInterval(t2); t1 = t2 = null; b.classList.remove("apretado"); };
    // pointerdown en lugar de click: responde al instante (sin esperar a soltar el dedo)
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      try { b.setPointerCapture(e.pointerId); } catch (x) {}
      b.classList.add("apretado");
      mandar(accion, b);
      if (repite) t1 = setTimeout(() => { t2 = setInterval(() => mandar(accion, null), REPETIR_CADA_MS); }, REPETIR_DESPUES_MS);
    });
    for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) b.addEventListener(ev, parar);
    b.addEventListener("contextmenu", (e) => e.preventDefault());
    // Teclado o lector de pantalla (Enter/Espacio sobre el botón) sin dedo
    b.addEventListener("click", (e) => { if (e.detail === 0) mandar(accion, b); });
  }
  // En una computadora (para probar): las flechas del teclado también mandan
  document.addEventListener("keydown", (e) => {
    if (e.target && e.target.tagName === "INPUT") return;
    if (e.target && e.target.tagName === "BUTTON" && (e.key === "Enter" || e.key === " ")) return; // lo hace el click
    const accion = teclaAAccion(e);
    if (!accion || $("#mando").hidden) return;
    e.preventDefault();
    mandar(accion, document.querySelector(`[data-accion="${accion}"]`));
  });
}

// ---------- Código ----------
function instalarCodigo() {
  const input = $("#codigo");
  input.addEventListener("input", () => {
    input.value = input.value.replace(/[^0-9]/g, "").slice(0, 4);
    if (input.value.length === 4) $("#pedir").requestSubmit ? $("#pedir").requestSubmit() : conectar(input.value);
  });
  $("#pedir").addEventListener("submit", (e) => { e.preventDefault(); conectar(input.value); });
  $("#cambiar").onclick = () => {
    telefono.soltar({ olvidar: true });
    history.replaceState(null, "", location.pathname);
    input.value = "";
    input.focus();
  };
}

async function conectar(codigo) {
  if (!codigo || codigo.length !== 4) { $("#codigo-error").textContent = "El código tiene 4 números."; return; }
  $("#codigo").blur();
  history.replaceState(null, "", `${location.pathname}?sala=${codigo}`); // al recargar, sigue con esta TV
  await telefono.conectar(codigo);
}

// ---------- Pantalla prendida y reconexión ----------
let candado = null;
async function pedirPantallaPrendida() {
  if (candado || !navigator.wakeLock || document.visibilityState !== "visible") return;
  try {
    candado = await navigator.wakeLock.request("screen");
    candado.addEventListener("release", () => { candado = null; });
  } catch (x) { candado = null; }
}

function instalarReconexion() {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") { telefono.reconectar(); pedirPantallaPrendida(); }
  });
  window.addEventListener("online", () => telefono.reconectar());
  window.addEventListener("pageshow", (e) => { if (e.persisted) telefono.reconectar(); });
}

// ---------- Arranque ----------
telefono.alCambiar(dibujar);
instalarBotones();
instalarCodigo();
instalarReconexion();
const inicial = telefono.codigoInicial();
if (inicial) conectar(inicial);
dibujar();
if (!inicial) $("#codigo").focus();
