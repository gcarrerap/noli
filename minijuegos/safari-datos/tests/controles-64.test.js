// Mide en Chrome los controles de dos columnas del teléfono:
// − y + a 64×64, el nombre con alto de 64, la gráfica ≥ 200 en 360×740
// y sin scroll horizontal en 360 y 412.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("..", import.meta.url));

function chromeBin() {
  const lista = [
    process.env.CHROME_BIN,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/opt/google/chrome/chrome",
  ].filter(Boolean);
  return lista.find((p) => fs.existsSync(p)) || "";
}

function puertoLibre() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
    s.on("error", reject);
  });
}

function svgData(nombre) {
  const texto = fs.readFileSync(path.join(dir, "img", nombre), "utf8");
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(texto);
}

function fila(tono, nombre, en, n, menos, mas) {
  return `<div class="fila-barra tono-${tono}">
    <button type="button" class="pm" aria-label="Bajar"><img src="${menos}" alt=""></button>
    <div class="medio">
      <button type="button" class="nom">${nombre}<small>${en}</small></button>
      <div class="pista-num">${n}</div>
    </div>
    <button type="button" class="pm" aria-label="Subir"><img src="${mas}" alt=""></button>
  </div>`;
}

function pagina() {
  const css = fs.readFileSync(path.join(dir, "estilo.css"), "utf8");
  const menos = svgData("boton-menos.svg");
  const mas = svgData("boton-mas.svg");
  const cuidador = svgData("cuidador.svg");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${css}</style>
</head><body>
<main class="p-juego armando">
  <header class="cab"><span class="nivel-mini">Gráfica de barras</span><span class="puntos"><i class="lleno"></i><i class="ahora"></i><i></i><i></i></span></header>
  <div class="encargo"><img class="cuidador" src="${cuidador}" alt=""><div class="burbuja"><p class="pedido">Arma la gráfica.</p><p class="pista">¡Brilla! Toca Listo.</p></div></div>
  <div class="mesa"><div class="zona-grafica"><div class="grafica-svg"><svg class="eje" viewBox="0 0 400 500"></svg></div></div>
  <div class="controles dos">
    ${fila("coral", "Mono", "monkey", 3, menos, mas)}
    ${fila("azul", "León", "lion", 8, menos, mas)}
    ${fila("verde", "Jirafa", "giraffe", 6, menos, mas)}
    ${fila("morado", "Elefante", "elephant", 3, menos, mas)}
    <button type="button" class="listo">Listo</button>
  </div></div>
</main>
</body></html>`;
}

const MEDIR = `(() => {
  const r = (el) => {
    const b = el.getBoundingClientRect();
    return { w: b.width, h: b.height, x: b.x, y: b.y, bottom: b.bottom };
  };
  const filas = [...document.querySelectorAll(".controles.dos .fila-barra")];
  const de = document.documentElement;
  return {
    pms: [...document.querySelectorAll(".controles.dos .pm")].map(r),
    noms: [...document.querySelectorAll(".controles.dos .nom")].map(r),
    filas: filas.map(r),
    zona: r(document.querySelector(".zona-grafica")),
    scrollW: de.scrollWidth,
    clientW: de.clientWidth,
    bodyScroll: document.body.scrollWidth,
    sombra: getComputedStyle(filas[0]).boxShadow,
    inner: { w: window.innerWidth, h: window.innerHeight },
  };
})()`;

function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let n = 0;
  const pending = new Map();
  const oyentes = new Map();
  const abierto = new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve());
    ws.addEventListener("error", () => reject(new Error("websocket de Chrome")));
  });
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method) {
      for (const fn of oyentes.get(msg.method) || []) fn(msg.params || {});
      return;
    }
    if (!msg.id || !pending.has(msg.id)) return;
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
    else resolve(msg.result);
  });
  return {
    async send(method, params = {}) {
      await abierto;
      const id = ++n;
      const espera = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
      ws.send(JSON.stringify({ id, method, params }));
      return espera;
    },
    once(method, ms) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Chrome no avisó " + method)), ms);
        const fn = (params) => {
          clearTimeout(timer);
          oyentes.set(method, (oyentes.get(method) || []).filter((f) => f !== fn));
          resolve(params);
        };
        oyentes.set(method, [...(oyentes.get(method) || []), fn]);
      });
    },
    close() { try { ws.close(); } catch { /* ya cerrado */ } },
  };
}

async function esperarJson(url, ms) {
  const t0 = Date.now();
  let ultimo = "";
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
      ultimo = String(r.status);
    } catch (e) {
      ultimo = e.message;
    }
    await new Promise((r) => setTimeout(r, 40));
  }
  throw new Error("Chrome no abrió " + url + " (" + ultimo + ")");
}

test("en el teléfono − y + miden 64 y el nombre 64, sin scroll", { timeout: 60000 }, async () => {
  const bin = chromeBin();
  assert.ok(bin, "hace falta Chrome o Chromium para medir los controles");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "safari-controles-"));
  const htmlPath = path.join(tmp, "armando.html");
  fs.writeFileSync(htmlPath, pagina());
  const port = await puertoLibre();
  const chrome = spawn(bin, [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--force-device-scale-factor=1",
    "--no-first-run",
    "--disable-extensions",
    "--user-data-dir=" + path.join(tmp, "perfil"),
    "--remote-debugging-port=" + port,
    "about:blank",
  ], { stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  chrome.stderr.on("data", (d) => { log += d; });
  const matar = () => { try { chrome.kill("SIGKILL"); } catch { /* ya murió */ } };
  try {
    const lista = await esperarJson("http://127.0.0.1:" + port + "/json/list", 8000);
    const page = lista.find((t) => t.type === "page");
    assert.ok(page && page.webSocketDebuggerUrl, "sin página de Chrome");
    const c = cdp(page.webSocketDebuggerUrl);
    await c.send("Page.enable");
    const fileUrl = "file://" + htmlPath;
    const medir = async (w, h) => {
      await c.send("Emulation.setDeviceMetricsOverride", {
        width: w, height: h, deviceScaleFactor: 1, mobile: false,
      });
      const carga = c.once("Page.loadEventFired", 8000);
      await c.send("Page.navigate", { url: fileUrl });
      await carga;
      const out = await c.send("Runtime.evaluate", { expression: MEDIR, returnByValue: true });
      if (out.exceptionDetails) throw new Error(JSON.stringify(out.exceptionDetails));
      return out.result.value;
    };
    const a360 = await medir(360, 740);
    const a412 = await medir(412, 915);
    c.close();
    for (const [nombre, m] of [["360", a360], ["412", a412]]) {
      assert.ok(m.pms.length >= 8, nombre + " sin botones");
      for (const pm of m.pms) {
        assert.ok(pm.w >= 63.5 && pm.w <= 65.5, nombre + " −/+ ancho " + pm.w);
        assert.ok(pm.h >= 63.5 && pm.h <= 65.5, nombre + " −/+ alto " + pm.h);
      }
      assert.equal(m.noms.length, 4);
      for (const nom of m.noms) {
        assert.ok(nom.h >= 63.5, nombre + " .nom alto " + nom.h);
        assert.ok(nom.w >= 63.5, nombre + " .nom ancho " + nom.w);
      }
      assert.ok(m.scrollW <= m.clientW + 1, nombre + " scroll horizontal " + m.scrollW + " > " + m.clientW);
      assert.ok(m.bodyScroll <= m.clientW + 1, nombre + " el body se sale");
      assert.match(m.sombra, /rgb\(255,\s*107,\s*74\)/, nombre + " sin franja de color");
      assert.ok(Math.abs(m.filas[0].y - m.filas[1].y) < 1, nombre + " no quedan dos columnas");
      assert.ok(m.filas[2].y > m.filas[0].bottom - 1, nombre + " falta la segunda fila");
      assert.ok(m.noms[0].bottom <= m.pms[0].y + 1, nombre + " el nombre no queda encima de −/+");
      assert.equal(m.inner.w, nombre === "360" ? 360 : 412);
    }
    assert.ok(a360.zona.h >= 200, "la gráfica en 360×740 mide " + a360.zona.h);
    assert.equal(a360.inner.h, 740);
  } catch (e) {
    throw new Error(e.message + (log ? "\n" + log.slice(-1500) : ""));
  } finally {
    matar();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
