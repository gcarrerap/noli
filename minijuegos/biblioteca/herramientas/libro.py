#!/usr/bin/env python3
"""Arma un libro de la Biblioteca: libro.json, la voz de cada página y las ilustraciones para la web.

Lee  libros/<id>/texto/cap-NN.md   (páginas separadas con ---, ilustraciones marcadas con <!-- ilustracion: … -->)
     libros/<id>/escenas.json      (id de cada ilustración: portada, c01-1, c01-2, …)
     libros/<id>/arte/escenas/*.jpg (las ilustraciones que ya existen; las que faltan se dejan en null)
Escribe libros/<id>/libro.json, libros/<id>/audio/cNN/pMM.mp3 y libros/<id>/arte/web/<ilustracion>-{g,c}.jpg

La voz es Piper en_US-ljspeech medium (dominio público), la misma de Spelling y Misión Luna. Cada página es un
MP3 con sus oraciones una tras otra, y libro.json guarda cuándo empieza y termina cada palabra (en segundos),
para iluminarla mientras suena. Los tiempos salen del propio modelo: la duración de cada fonema (salida /Ceil del
.onnx, igual que el Recortador de Misión Luna). Si una oración no cuadra palabra por palabra con los fonemas, sus
palabras se reparten por letras dentro de la oración.

Uso (una vez: pip install piper-tts onnx, y la voz de
https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-ljspeech-medium.tar.bz2):

    python3 minijuegos/biblioteca/herramientas/libro.py halloween --voz /ruta/en_US-ljspeech-medium.onnx [--todo]
    python3 minijuegos/biblioteca/herramientas/libro.py halloween           # solo texto e ilustraciones

Sin --todo solo graba las páginas cuyo texto cambió (libro.json guarda una huella del texto de cada página).
Necesita ffmpeg.
"""
import argparse, hashlib, io, json, re, subprocess, sys, wave
from pathlib import Path

AQUI = Path(__file__).resolve().parent
LIBROS = AQUI.parent / "libros"

# Silencio al principio de cada página: las TVs se comen el arranque del audio (igual que Misión Luna).
ANTES_S = 0.45
ENTRE_ORACIONES_S = 0.35
ENTRE_PARRAFOS_S = 0.6
HOP = 256
ESCALAS = (0.5, 1.12, 0.6)   # noise, length (>1 = más despacio), noise_w; las mismas de Misión Luna

# Cómo decir con la voz en inglés las palabras en español (una palabra por palabra, para no mover los tiempos).
PRONUNCIA = {
    "mija": "meeha", "abuela": "ahbwayla", "ríos": "reeohs", "gómez": "gohmez", "día": "deeah",
    "muertos": "mwairtohs", "calabaza": "kahlahbahsah", "tacha": "tahchah", "dulce": "doolseh",
    "pan": "pahn", "que": "keh", "vaya": "vahyah", "bonito": "bohneetoh", "nada": "nahdah", "de": "deh",
    "ay": "eye", "ms.": "miz", "mrs.": "missus", "mr.": "mister",
}
# Solo se cambia "pan", "que", "de", "en"… cuando van en una frase en español (para no tocar el inglés).
SOLO_EN_ESPANOL = {"pan", "que", "de", "vaya", "nada", "ay"}
FRASES_ES = [r"pan dulce", r"Que te vaya bonito", r"De nada", r"Ay, mija", r"Calabaza en tacha", r"Día de Muertos"]

ABREV = ("Mrs.", "Mr.", "Ms.", "Dr.")


def oraciones(parrafo):
    """Parte un párrafo en oraciones. No corta en Mrs./Mr./Ms. ni cuando sigue una minúscula ("*Snip!* went")."""
    out, ini = [], 0
    for m in re.finditer(r'[.!?]+[*"”’)]*(?=\s+)', parrafo):
        fin = m.end()
        antes = parrafo[ini:fin]
        if any(antes.endswith(a) for a in ABREV):
            continue
        sig = parrafo[fin:].lstrip()
        if sig and not (sig[0].isupper() or sig[0] in '"“*'):
            continue
        out.append(antes.strip()); ini = fin
    resto = parrafo[ini:].strip()
    if resto:
        out.append(resto)
    return out


def tokens(oracion):
    """Palabras tal como se ven (con su puntuación). em: si va en cursiva (*así*)."""
    out, cursiva = [], False
    for t in oracion.split():
        empieza = t.startswith("*")
        if empieza:
            cursiva = True
        limpio = t.replace("*", "")
        out.append({"w": limpio, "em": cursiva})
        if t.rstrip('.,!?"”’)').endswith("*"):
            cursiva = False
    return out


def para_voz(oracion):
    texto = oracion.replace("*", "")
    es = set()
    for f in FRASES_ES:
        for m in re.finditer(f, texto, flags=re.I):
            es.update(range(m.start(), m.end()))
    partes = []
    for m in re.finditer(r"\S+", texto):
        t = m.group(0)
        nucleo = re.sub(r'^["“(]+|[,!?"”’):;]+$', "", t)
        clave = nucleo.lower()
        if clave in PRONUNCIA and (clave not in SOLO_EN_ESPANOL or m.start() in es):
            t = t.replace(nucleo, PRONUNCIA[clave])
        partes.append(t)
    return " ".join(partes)


def es_palabra(w):
    return re.search(r"[A-Za-zÁÉÍÓÚáéíóúñÑ0-9]", w) is not None


def leer_capitulos(dir_libro):
    caps = []
    for f in sorted((dir_libro / "texto").glob("cap-*.md")):
        n = int(f.stem.split("-")[1])
        texto = f.read_text(encoding="utf-8")
        titulo = re.search(r"^# Chapter \d+: (.+)$", texto, flags=re.M).group(1).strip()
        texto = re.sub(r"^# .*$", "", texto, count=1, flags=re.M)
        paginas, k = [], 0
        for crudo in texto.split("\n---\n"):
            ilus = None
            for _ in re.findall(r"<!-- ilustracion:.*?-->", crudo, flags=re.S):
                k += 1; ilus = f"c{n:02d}-{k}"
            limpio = re.sub(r"<!--.*?-->", "", crudo, flags=re.S).strip()
            parrafos = [p.strip() for p in re.split(r"\n\s*\n", limpio) if p.strip()]
            if not parrafos:
                continue
            paginas.append({"ilustracion": ilus, "parrafos": [[{"texto": o.replace("*", ""), "palabras": tokens(o), "voz": para_voz(o)}
                                                                 for o in oraciones(" ".join(p.split()))] for p in parrafos]})
        caps.append({"n": n, "titulo": titulo, "paginas": paginas})
    return caps


class Voz:
    def __init__(self, ruta):
        import numpy as np, onnx, onnxruntime
        from piper import PiperVoice
        self.np = np
        self.voz = PiperVoice.load(ruta)
        m = onnx.load(ruta)
        m.graph.output.append(onnx.helper.make_tensor_value_info("/Ceil_output_0", onnx.TensorProto.FLOAT, None))
        self.ses = onnxruntime.InferenceSession(m.SerializeToString(), providers=["CPUExecutionProvider"])
        self.sr = self.voz.config.sample_rate
        self._cache = {}

    def pedazo(self, fon):
        """Audio de una lista de fonemas y el (inicio, fin, nueva) de cada fonema que suena, en segundos;
        nueva=True si empieza una palabra (va después de un " ")."""
        np = self.np
        ids = self.voz.phonemes_to_ids(fon)
        audio, dur = self.ses.run(None, {
            "input": np.array([ids], np.int64), "input_lengths": np.array([len(ids)], np.int64),
            "scales": np.array(ESCALAS, np.float32)})
        audio = audio.squeeze()
        fin = np.cumsum(dur.squeeze().astype(int) * HOP) / self.sr
        ini = np.concatenate([[0.0], fin[:-1]])
        # ids = ^ _ f0 _ f1 _ … fN _ $  →  el fonema k está en 2 + 2k (y su relleno en 3 + 2k)
        fonemas, nueva = [], True
        for k, f in enumerate(fon):
            pos = 2 + 2 * k
            if f == " ":
                nueva = True; continue
            if not suena(f):
                continue   # acentos, alargamientos y puntuación
            fonemas.append((float(ini[pos]), float(fin[pos + 1]), nueva)); nueva = False
        return audio, fonemas

    def oracion(self, texto):
        np = self.np
        trozos, fonemas, t = [], [], 0.0
        for fon in self.voz.phonemize(texto):
            a, f = self.pedazo(fon)
            fonemas += [(x + t, y + t, n) for x, y, n in f]
            trozos.append(a); t += len(a) / self.sr
        return (np.concatenate(trozos) if trozos else np.zeros(0, np.float32)), fonemas

    def cuantos(self, palabra):
        """Cuántos fonemas tiene una palabra dicha sola (para repartir los fonemas de la oración)."""
        if palabra not in self._cache:
            self._cache[palabra] = max(1, sum(1 for s in self.voz.phonemize(palabra) for f in s if suena(f)))
        return self._cache[palabra]


def suena(f):
    return f != " " and f not in "ˈˌːʲ" and re.search(r"\w", f) is not None


def repartir(palabras, voz_palabras, fonemas, cuantos):
    """Pone t0/t1 a cada palabra visible. La voz junta palabras chicas ("in the" → un solo grupo), así que los
    fonemas de la oración se reparten según cuántos tiene cada palabra dicha sola, y cada corte se pega al inicio
    de palabra de la voz más cercano. Devuelve True si todos los cortes cayeron en un inicio de palabra."""
    vis = [p for p in palabras if es_palabra(p["w"])]
    if not vis or not fonemas:
        return False
    n = len(fonemas)
    if len(voz_palabras) == len(vis):
        pesos = [cuantos(re.sub(r"[^\w'-]", "", w)) for w in voz_palabras]
    else:
        pesos = [len(p["w"]) for p in vis]
    total = sum(pesos)
    inicios = [i for i, f in enumerate(fonemas) if f[2] and i > 0]
    cortes, acum, exacto = [0], 0, True
    for k, w in enumerate(pesos[:-1]):
        acum += w
        ideal = n * acum / total
        cerca = min(inicios, key=lambda i: abs(i - ideal)) if inicios else round(ideal)
        if abs(cerca - ideal) > 1.5:
            cerca, exacto = round(ideal), False
        quedan = len(pesos) - 1 - k          # palabras que faltan después de este corte
        cerca = min(max(cerca, cortes[-1] + 1), n - quedan)
        cortes.append(cerca)
    cortes.append(n)
    for p, a, b in zip(vis, cortes, cortes[1:]):
        b = max(b, a + 1)
        p["t0"], p["t1"] = round(fonemas[min(a, n - 1)][0], 2), round(fonemas[min(b, n) - 1][1], 2)
    return exacto


def a_mp3(pcm, sr, destino):
    destino.parent.mkdir(parents=True, exist_ok=True)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(pcm.tobytes())
    ms = int(ANTES_S * 1000)
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "wav", "-i", "pipe:0",
                    "-af", f"afade=t=in:d=0.008,adelay={ms}|{ms}", "-ac", "1", "-ar", "22050",
                    "-codec:a", "libmp3lame", "-b:a", "32k", str(destino)], input=buf.getvalue(), check=True)


def grabar_pagina(voz, pag, destino):
    np = voz.np
    trozos, t, exactas, total = [], ANTES_S, 0, 0
    for i, parrafo in enumerate(pag["parrafos"]):
        for j, o in enumerate(parrafo):
            if trozos:
                hueco = ENTRE_PARRAFOS_S if j == 0 else ENTRE_ORACIONES_S
                trozos.append(np.zeros(int(hueco * voz.sr), np.float32)); t += hueco
            audio, fonemas = voz.oracion(o["voz"])
            dur = len(audio) / voz.sr
            o["t0"], o["t1"] = round(t, 2), round(t + dur, 2)
            dichas = [w for w in o["voz"].split() if es_palabra(w)]
            exactas += repartir(o["palabras"], dichas, [(a + t, b + t, n) for a, b, n in fonemas], voz.cuantos)
            total += 1
            trozos.append(audio); t += dur
    pcm = (np.clip(np.concatenate(trozos), -1, 1) * 32767).astype(np.int16)
    a_mp3(pcm, voz.sr, destino)
    pag["duracion"] = round(t, 2)
    return exactas, total


def huella(pag):
    return hashlib.sha1(json.dumps([[o["voz"] for o in p] for p in pag["parrafos"]], ensure_ascii=False).encode()).hexdigest()[:12]


def ilustraciones_web(dir_libro):
    """arte/escenas/<id>.jpg → arte/web/<id>-g.jpg (1600 px, TV) y <id>-c.jpg (800 px, teléfono)."""
    hay = {}
    for f in sorted((dir_libro / "arte" / "escenas").glob("*.jpg")):
        for sufijo, ancho, q in (("g", 1600, 4), ("c", 800, 5)):
            d = dir_libro / "arte" / "web" / f"{f.stem}-{sufijo}.jpg"
            if not d.exists() or d.stat().st_mtime < f.stat().st_mtime:
                d.parent.mkdir(parents=True, exist_ok=True)
                subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(f), "-vf", f"scale='min({ancho},iw)':-2",
                                "-q:v", str(q), str(d)], check=True)
        hay[f.stem] = True
    return hay


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("libro")
    ap.add_argument("--voz", help="archivo .onnx de Piper en_US-ljspeech medium (con su .onnx.json al lado)")
    ap.add_argument("--todo", action="store_true", help="volver a grabar todas las páginas")
    args = ap.parse_args()
    dir_libro = LIBROS / args.libro
    salida = dir_libro / "libro.json"
    viejo = json.loads(salida.read_text(encoding="utf-8")) if salida.exists() else None
    previas = {}
    if viejo:
        for c in viejo["capitulos"]:
            for k, p in enumerate(c["paginas"], 1):
                previas[(c["n"], k)] = p

    meta = json.loads((dir_libro / "meta.json").read_text(encoding="utf-8"))
    caps = leer_capitulos(dir_libro)
    hay = ilustraciones_web(dir_libro)
    voz = Voz(args.voz) if args.voz else None
    grabadas = exactas = oraciones_total = 0
    for c in caps:
        for k, p in enumerate(c["paginas"], 1):
            p["huella"] = huella(p)
            p["audio"] = f"audio/c{c['n']:02d}/p{k:02d}.mp3"
            destino = dir_libro / p["audio"]
            ant = previas.get((c["n"], k))
            if voz and (args.todo or not destino.exists() or not ant or ant.get("huella") != p["huella"]):
                e, t = grabar_pagina(voz, p, destino)
                grabadas += 1; exactas += e; oraciones_total += t
                print(f"cap {c['n']} pág {k}: {e}/{t} oraciones palabra por palabra", file=sys.stderr)
            elif ant and ant.get("huella") == p["huella"] and destino.exists():
                p["parrafos"], p["duracion"] = ant["parrafos"], ant.get("duracion")
            else:
                p["audio"] = None
            # La ilustración que le toca a la página: "ilustracion" si ya existe; "espera" si todavía no.
            p["espera"] = p["ilustracion"] if p["ilustracion"] and p["ilustracion"] not in hay else None
            p["ilustracion"] = p["ilustracion"] if p["ilustracion"] in hay else None
            for par in p["parrafos"]:
                for o in par:
                    o.pop("voz", None)
    libro = {**meta, "portada": "portada" if "portada" in hay else None, "capitulos": caps}
    salida.write_text(json.dumps(libro, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    paginas = sum(len(c["paginas"]) for c in caps)
    palabras = sum(len(o["palabras"]) for c in caps for p in c["paginas"] for par in p["parrafos"] for o in par)
    print(f"{len(caps)} capítulos, {paginas} páginas, {palabras} palabras; {grabadas} páginas grabadas"
          + (f" ({exactas}/{oraciones_total} oraciones palabra por palabra)" if grabadas else ""))


if __name__ == "__main__":
    main()
