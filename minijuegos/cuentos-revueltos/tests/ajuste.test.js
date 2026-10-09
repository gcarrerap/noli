// Mide de verdad, a 360×740, cada baraja de cada cuento.
// El centro de cada palabra y de cada tarjeta tiene que caer en su propio elemento.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const leer = (p) => JSON.parse(fs.readFileSync(path.join(raiz, p), "utf8"));

function chromeBin() {
  const rutas = ["/usr/bin/google-chrome-stable", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  return rutas.find((p) => fs.existsSync(p)) || "";
}

function perms(lista) {
  if (lista.length <= 1) return [lista.slice()];
  const out = [];
  lista.forEach((item, i) => {
    for (const resto of perms(lista.filter((_, j) => j !== i))) out.push([item, ...resto]);
  });
  return out;
}

test("cada baraja cabe a 360 y el centro de cada palabra y tarjeta es suyo", { skip: chromeBin() ? false : "sin Chrome" }, async () => {
  const bin = chromeBin();
  const indice = leer("datos/indice.json");
  const cuentos = indice.orden.map((id) => leer(`datos/cuentos/${id}.json`));
  const css = fs.readFileSync(path.join(raiz, "estilo.css"), "utf8");
  const tareas = [];
  for (const cuento of cuentos) {
    const paginas = Object.fromEntries(cuento.paginas.map((p) => [p.id, p]));
    for (const cap of cuento.capitulos) {
      for (const tarea of cap.tareas) {
        if (tarea.tipo !== "ordenar") continue;
        tareas.push({
          cuento: cuento.id,
          soloTexto: !!tarea.soloTexto,
          tarjetas: tarea.tarjetas.map((id) => ({
            id,
            oraciones: paginas[id].oraciones,
          })),
        });
      }
    }
  }

  const puerto = 9334;
  const perfil = "/tmp/chrome-ajuste-cuentos";
  fs.rmSync(perfil, { recursive: true, force: true });
  const proc = spawn(bin, [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage",
    `--remote-debugging-port=${puerto}`, `--user-data-dir=${perfil}`, "about:blank",
  ], { stdio: "ignore" });
  try {
    const wsUrl = await esperarWs(puerto);
    const pagina = await nuevaPagina(puerto);
    const cdp = conectar(pagina.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    const html = `<!doctype html><html><head><style>${css}</style></head><body><main id="juego" class="p-jugar"></main></body></html>`;
    await cdp.send("Page.navigate", { url: "about:blank" });
    const frameId = (await cdp.send("Page.getFrameTree")).frameTree.frame.id;
    await cdp.send("Page.setDocumentContent", { frameId, html });
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 360, height: 740, deviceScaleFactor: 1, mobile: true,
    });
    const informe = await evaluar(cdp, `(() => {
      const tareas = ${JSON.stringify(tareas)};
      function perms(lista) {
        if (lista.length <= 1) return [lista.slice()];
        const out = [];
        lista.forEach((item, i) => {
          for (const resto of perms(lista.filter((_, j) => j !== i))) out.push([item, ...resto]);
        });
        return out;
      }
      function palabras(oracion) {
        return String(oracion).split(/(\\s+)/).map((parte) => {
          if (!parte || !parte.trim()) return parte;
          return '<span class="palabra">' + parte.replace(/&/g,"&amp;").replace(/</g,"&lt;") + '</span>';
        }).join("");
      }
      function carta(t) {
        const lineas = t.oraciones.map((o) => '<p class="linea">' + palabras(o) + '</p>').join("");
        const dibujo = t.solo ? "" : '<span class="dibujo"></span>';
        return '<div class="tarjeta' + (t.solo ? " sin-dibujo" : "") + '"><button type="button" class="cuerpo" data-act="tomar" data-id="' + t.id + '">' + dibujo + '<span class="zona-texto">' + lineas + '</span></button></div>';
      }
      function armar(lista, mano) {
        const n = lista.length + (mano ? 1 : 0);
        const enMano = mano || null;
        const mazo = lista.filter((t) => !enMano || t.id !== enMano.id);
        const huecos = Array.from({ length: n }, () => '<button type="button" class="hueco" data-act="poner"><span class="svg"></span></button>').join("");
        const fila = mazo.map((t) => '<button type="button" class="boton palabras" data-act="palabras"><span>Palabras</span><span class="cual">' + t.oraciones[0].split(/\\s+/)[0] + '</span></button>').join("");
        const manoHtml = enMano ? '<div class="mano"><span>En la mano: ' + enMano.oraciones.join(" ") + '</span><button type="button" class="boton palabras" data-act="palabras"><span>Palabras</span></button></div>' : "";
        return '<header class="cab"><button type="button" class="icono" data-foco-id="escuchar">o</button><h1 class="titulo">Cuentos</h1><span></span></header>'
          + '<p class="avance">Capítulo 1 · 1 de 6</p><p class="pista">¿Qué pasa primero?</p>'
          + '<div class="rejilla n' + n + '">' + mazo.map(carta).join("") + '</div>'
          + '<div class="palabras-fila">' + fila + '</div>'
          + manoHtml
          + '<div class="rejilla huecos n' + n + '">' + huecos + '</div>'
          + '<div class="acciones"><button type="button" class="boton listo" data-act="listo" disabled>Listo</button></div>';
      }
      function centro(el) {
        const r = el.getBoundingClientRect();
        return [r.left + r.width / 2, r.top + r.height / 2, r.bottom];
      }
      const fallos = [];
      let medidos = 0;
      let peor = 0;
      const main = document.getElementById("juego");
      for (const tarea of tareas) {
        const cartas = tarea.tarjetas.map((t) => ({ ...t, solo: tarea.soloTexto }));
        const ordenes = perms(cartas);
        for (const orden of ordenes) {
          for (const mano of [null, orden[0]]) {
            main.innerHTML = armar(orden, mano);
            medidos += 1;
            const listo = main.querySelector("[data-act=listo]");
            const bottom = Math.round(listo.getBoundingClientRect().bottom);
            const alto = document.documentElement.scrollHeight;
            const ancho = document.documentElement.scrollWidth;
            const vista = window.innerWidth + "x" + window.innerHeight;
            if (bottom > peor) peor = bottom;
            if (bottom > 740 || alto > window.innerHeight || ancho > window.innerWidth) {
              fallos.push(tarea.cuento + (mano ? " mano" : "") + " bottom " + bottom + " alto " + alto + " ancho " + ancho + " vista " + vista + " " + orden.map((t) => t.id).join(","));
              if (fallos.length > 12) return { fallos, medidos, peor };
            }
            for (const w of main.querySelectorAll(".zona-texto .palabra")) {
              const [x, y] = centro(w);
              const hit = document.elementFromPoint(x, y);
              if (hit !== w) {
                fallos.push("palabra " + w.textContent + " cae en " + (hit && hit.className));
                return { fallos, medidos, peor };
              }
            }
            for (const card of main.querySelectorAll("button.cuerpo")) {
              const [x, y] = centro(card);
              const hit = document.elementFromPoint(x, y);
              const propia = hit === card || card.contains(hit);
              if (!propia || (hit && hit.closest && hit.closest("[data-act=palabras]"))) {
                fallos.push("tarjeta " + card.dataset.id + " cae en " + (hit && (hit.className || hit.tagName)));
                return { fallos, medidos, peor };
              }
            }
            for (const b of main.querySelectorAll(".boton.palabras")) {
              const [x, y] = centro(b);
              const hit = document.elementFromPoint(x, y);
              if (hit !== b && !(b.contains(hit))) {
                fallos.push("Palabras cae en " + (hit && hit.className));
                return { fallos, medidos, peor };
              }
            }
          }
        }
      }
      return { fallos, medidos, peor };
    })()`);
    assert.equal(informe.fallos.length, 0, JSON.stringify(informe, null, 2));
    assert.ok(informe.medidos > 100, "se midieron " + informe.medidos);
    assert.ok(informe.peor <= 740, "peor " + informe.peor);
    cdp.ws.close();
  } finally {
    proc.kill("SIGKILL");
  }
});

function esperarWs(puerto) {
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${puerto}/json/version`);
        if (res.ok) { resolve(await res.json()); return; }
      } catch { /* arrancando */ }
      if (Date.now() - t0 > 8000) reject(new Error("chrome no arrancó"));
      else setTimeout(tick, 100);
    };
    tick();
  });
}

async function nuevaPagina(puerto) {
  let res = await fetch(`http://127.0.0.1:${puerto}/json/new?about:blank`, { method: "PUT" });
  if (!res.ok) res = await fetch(`http://127.0.0.1:${puerto}/json/new?about:blank`);
  if (!res.ok) throw new Error("json/new " + res.status);
  return res.json();
}

function conectar(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const abierto = new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", () => reject(new Error("ws")));
  });
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (!msg.id || !pending.has(msg.id)) return;
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  });
  return {
    ws,
    async send(method, params = {}) {
      await abierto;
      const my = ++id;
      return new Promise((resolve, reject) => {
        pending.set(my, { resolve, reject });
        ws.send(JSON.stringify({ id: my, method, params }));
      });
    },
  };
}

async function evaluar(cdp, expression) {
  const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 800));
  return r.result?.value;
}
