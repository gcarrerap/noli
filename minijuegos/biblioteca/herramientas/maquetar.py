#!/usr/bin/env python3
"""Exporta un libro de la Biblioteca a PDF para imprimir o compartir (#102).

    python3 minijuegos/biblioteca/herramientas/maquetar.py halloween [--fuentes DIR] [--salida archivo.pdf]

Lee libros/<id>/libro.json y las ilustraciones de arte/web (<id>-g.jpg). Arma un libro ilustrado apaisado (carta,
11×8.5 in): portada, y para cada capítulo una portadilla; luego cada página del libro ocupa dos hojas enfrentadas:
la ilustración a sangre y el texto en letra grande. Así el texto nunca tapa a los personajes.

--fuentes: carpeta con andika-latin-400-normal.woff2, andika-latin-700-normal.woff2, andika-latin-400-italic.woff2 y
fredoka-latin-600-normal.woff2 (por ejemplo los paquetes @fontsource/andika y @fontsource/fredoka). Sin ella usa las
fuentes del sistema. Necesita Playwright con Chromium.
"""
import argparse
import html
import json
import os
import pathlib
import sys
import tempfile

RAIZ = pathlib.Path(__file__).resolve().parent.parent


def fuentes_css(d):
    if not d:
        return ""
    d = pathlib.Path(d)
    caras = [("Andika", 400, "normal", "andika-latin-400-normal.woff2"), ("Andika", 700, "normal", "andika-latin-700-normal.woff2"),
             ("Andika", 400, "italic", "andika-latin-400-italic.woff2"), ("Fredoka", 600, "normal", "fredoka-latin-600-normal.woff2")]
    out = []
    for fam, peso, estilo, archivo in caras:
        f = next(iter(d.rglob(archivo)), None)
        if f:
            out.append(f"@font-face{{font-family:'{fam}';font-weight:{peso};font-style:{estilo};src:url('{f.as_uri()}')}}")
    return "\n".join(out)


def texto_html(parrafos):
    ps = []
    for par in parrafos:
        frases = []
        for o in par:
            ws = o["palabras"]
            if ws and " ".join(w["w"] for w in ws) == o["texto"]:
                frases.append(" ".join(f"<i>{html.escape(w['w'])}</i>" if w["em"] else html.escape(w["w"]) for w in ws))
            else:
                frases.append(html.escape(o["texto"]))
        ps.append("<p>" + " ".join(frases) + "</p>")
    return "\n".join(ps)


CSS = """
@page{size:11in 8.5in;margin:0}
*{box-sizing:border-box}
html,body{margin:0}
body{font-family:'Andika','Atkinson Hyperlegible',sans-serif;color:#2a2138}
.hoja{width:11in;height:8.5in;page-break-after:always;overflow:hidden;position:relative}
.ilus{background:#2a1f45;display:flex;align-items:center;justify-content:center}
.ilus img{width:100%;height:100%;object-fit:cover}
.lee{background:#fbf4e6;padding:.75in .95in;display:flex;flex-direction:column;justify-content:center}
.lee p{font-size:var(--t,19pt);line-height:1.55;margin:0 0 .55em}
.lee h2{font-family:'Fredoka',sans-serif;color:#c96a12;font-size:26pt;margin:0 0 .4em;line-height:1.1}
.lee h2 span{display:block;font-size:13pt;color:#6e6278;letter-spacing:.05em}
.num{position:absolute;bottom:.35in;right:.5in;font-size:11pt;color:#6e6278}
.portada .tapa{position:absolute;left:0;right:0;bottom:0;padding:1.6in .8in .55in;
  background:linear-gradient(transparent,rgba(42,31,69,.93) 45%);color:#f6ebd9}
.portada h1{font-family:'Fredoka',sans-serif;color:#f28c28;font-size:46pt;margin:0;line-height:1.05}
.portada p{font-size:18pt;margin:.25em 0 0}
.cap{background:radial-gradient(120% 90% at 80% 0%,#3b2a5c,#2a1f45 70%);color:#f6ebd9;display:flex;flex-direction:column;
  align-items:center;justify-content:center;text-align:center}
.cap span{font-family:'Fredoka',sans-serif;font-size:22pt;letter-spacing:.12em;opacity:.8}
.cap h2{font-family:'Fredoka',sans-serif;color:#f28c28;font-size:44pt;margin:.2em .8in 0;line-height:1.1}
.fin h2{font-size:54pt}
"""


def armar(libro, base, fuentes):
    img = lambda i: (base / "arte" / "web" / f"{i}-g.jpg").as_uri()
    h = [f"<!doctype html><html lang='{libro.get('idioma', 'en')}'><meta charset='utf-8'><style>{fuentes_css(fuentes)}{CSS}</style><body>"]
    h.append(f"<section class='hoja ilus portada'><img src='{img(libro['portada'])}'><div class='tapa'><h1>{html.escape(libro['titulo'])}</h1>"
             f"<p>{html.escape(libro.get('subtitulo', ''))}</p></div></section>")
    hoja = 1
    for c in libro["capitulos"]:
        h.append(f"<section class='hoja cap'><span>CHAPTER {c['n']}</span><h2>{html.escape(c['titulo'])}</h2></section>")
        hoja += 1
        for i, p in enumerate(c["paginas"]):
            if p.get("ilustracion"):
                h.append(f"<section class='hoja ilus'><img src='{img(p['ilustracion'])}'></section>")
                hoja += 1
            hoja += 1
            n = sum(len(o["palabras"]) for par in p["parrafos"] for o in par)
            t = "19pt" if n <= 120 else "17pt" if n <= 150 else "15.5pt"
            h.append(f"<section class='hoja lee' style='--t:{t}'>{texto_html(p['parrafos'])}<div class='num'>{hoja}</div></section>")
    h.append("<section class='hoja cap fin'><h2>The End</h2></section></body></html>")
    return "\n".join(h)


def main():
    a = argparse.ArgumentParser()
    a.add_argument("libro")
    a.add_argument("--fuentes")
    a.add_argument("--salida")
    o = a.parse_args()
    base = RAIZ / "libros" / o.libro
    libro = json.loads((base / "libro.json").read_text())
    salida = pathlib.Path(o.salida or f"{o.libro}.pdf").resolve()
    from playwright.sync_api import sync_playwright
    with tempfile.TemporaryDirectory() as tmp:
        f = pathlib.Path(tmp) / "libro.html"
        f.write_text(armar(libro, base, o.fuentes))
        with sync_playwright() as pw:
            exe = "/opt/pw-browsers/chromium" if os.path.exists("/opt/pw-browsers/chromium") else None
            b = pw.chromium.launch(executable_path=exe) if exe else pw.chromium.launch()
            pg = b.new_page()
            pg.goto(f.as_uri(), wait_until="networkidle")
            pg.evaluate("document.fonts.ready")
            # Si algún texto no cabe en su hoja, se achica la letra hasta que quepa
            pg.evaluate("""() => { for (const s of document.querySelectorAll('.lee')) {
                let t = parseFloat(getComputedStyle(s).getPropertyValue('--t'));
                while (s.scrollHeight > s.clientHeight + 1 && t > 11) { t -= .5; s.style.setProperty('--t', t + 'pt'); } } }""")
            pg.pdf(path=str(salida), width="11in", height="8.5in", print_background=True, prefer_css_page_size=True)
            b.close()
    print(salida)


if __name__ == "__main__":
    sys.exit(main())
