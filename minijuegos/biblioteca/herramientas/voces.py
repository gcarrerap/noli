#!/usr/bin/env python3
"""Voces de personajes para un libro de la Biblioteca (Fish Audio).

El texto de cada página se parte en piezas: narración y diálogos, una oración (o un pedazo de oración) por pieza,
cada una con la voz de quien habla. Quién dice cada diálogo está en libros/<id>/voces.json (se puede corregir a mano).

    # 1. Archivos de trabajo para el workflow FishBatchTextToSpeech de gcarrerap/api-access (uno por capítulo):
    python3 minijuegos/biblioteca/herramientas/voces.py halloween trabajos DIR
    # (gh workflow run fish-batch-text-to-speech.yml --repo gcarrerap/api-access --ref main -f lines="$(cat DIR/job-c01.json)")
    # 2. Con las piezas ya generadas (carpeta con cNN/pMM-KKK.mp3, sacada de la rama audio-temp):
    python3 minijuegos/biblioteca/herramientas/voces.py halloween armar DIR

`armar` une las piezas de cada página en audio/cNN/pMM.mp3 y pone en libro.json los tiempos de cada palabra para
iluminarla mientras suena. Fish Audio no da tiempos por palabra, así que se reparten dentro de cada pieza (que es
corta) según las sílabas de cada palabra, anclando las comas y puntos a los silencios que se oyen en el audio.
"""
import json
import pathlib
import re
import subprocess
import sys

import numpy as np

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import libro as L  # noqa: E402

SR = 22050
ANTES_S = L.ANTES_S
HUECO = {"pieza": 0.18, "oracion": 0.35, "parrafo": 0.6}
DB_SILENCIO = -38      # dB respecto al pico de la pieza
PAUSA_MIN_S = 0.12
NIVEL_RMS = 0.075       # todas las piezas al mismo volumen


def leer_mp3(f):
    r = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(f), "-ac", "1", "-ar", str(SR), "-f", "f32le", "pipe:1"],
                       capture_output=True, check=True)
    return np.frombuffer(r.stdout, np.float32).copy()


def energia(a, paso=int(SR * 0.01)):
    n = len(a) // paso
    if n == 0:
        return np.zeros(0)
    e = np.sqrt((a[: n * paso].reshape(n, paso) ** 2).mean(1)) + 1e-9
    return 20 * np.log10(e / (np.abs(a).max() + 1e-9))


def recortar(a):
    """Quita el silencio de las orillas (deja 30 ms) y devuelve el audio y sus pausas internas [(ini, fin)] en s."""
    e = energia(a)
    voz = np.where(e > DB_SILENCIO)[0]
    if len(voz) == 0:
        return a, []
    i0, i1 = max(0, voz[0] - 3), min(len(e), voz[-1] + 4)
    a = a[i0 * int(SR * 0.01): i1 * int(SR * 0.01)]
    e = e[i0:i1]
    pausas, ini = [], None
    for k, v in enumerate(e > DB_SILENCIO):
        if not v and ini is None:
            ini = k
        if v and ini is not None:
            if (k - ini) * 0.01 >= PAUSA_MIN_S:
                pausas.append((ini * 0.01, k * 0.01))
            ini = None
    return a, pausas


def silabas(w):
    w = re.sub(r"[^a-záéíóúñ]", "", w.lower())
    return max(1, len(re.findall(r"[aeiouyáéíóú]+", w)))


def tiempos(palabras, dur, pausas, t0):
    """t0/t1 para cada palabra visible de la pieza (en tiempo de la página)."""
    vis = [p for p in palabras if L.es_palabra(p["w"])]
    if not vis:
        return
    pesos = [silabas(p["w"]) for p in vis]
    total = sum(pesos)
    # dónde terminaría cada palabra si se repartiera parejo (sin pausas)
    habla = dur - sum(b - a for a, b in pausas)
    acum, ideal = 0, []
    for w in pesos:
        acum += w
        ideal.append(habla * acum / total)
    # anclas: una palabra con coma o punto seguida de una pausa que se oye
    anclas, libres = {}, list(pausas)
    corrido = 0.0
    for k, p in enumerate(vis[:-1]):
        if re.search(r"[,.!?;:…—-]['\"”’)]*$", p["w"]) and libres:
            # la pausa más cercana a donde debería caer (contando las pausas ya pasadas)
            esperado = ideal[k] + corrido
            mejor = min(libres, key=lambda pa: abs(pa[0] - esperado))
            if abs(mejor[0] - esperado) < 0.8:
                anclas[k] = mejor
                corrido += mejor[1] - mejor[0]
                libres = [pa for pa in libres if pa[0] > mejor[0]]
    # tramos entre anclas: se reparten por sílabas
    cortes = [(-1, 0.0)] + [(k, anclas[k]) for k in sorted(anclas)] + [(len(vis) - 1, (dur, dur))]
    ini = 0.0
    for (ka, _), (kb, pausa) in zip(cortes, cortes[1:]):
        fin = pausa[0]
        grupo = list(range(ka + 1, kb + 1))
        sub = sum(pesos[i] for i in grupo) or 1
        t = ini
        for i in grupo:
            d = (fin - ini) * pesos[i] / sub
            vis[i]["t0"], vis[i]["t1"] = round(t0 + t, 2), round(t0 + t + d, 2)
            t += d
        ini = pausa[1]


def piezas_de(voces, c, p):
    return voces["paginas"].get(f"c{c:02d}-p{p:02d}", [])


def trabajos(dir_libro, voces, salida):
    salida.mkdir(parents=True, exist_ok=True)
    caps = {}
    for clave, piezas in voces["paginas"].items():
        c, p = int(clave[1:3]), int(clave[5:7])
        for i, x in enumerate(piezas):
            caps.setdefault(c, []).append({"f": f"{voces['carpeta']}/c{c:02d}/p{p:02d}-{i:03d}.mp3", "t": x["t"],
                                           "v": voces["voces"][x["sp"]]["fish"],
                                           "s": voces["voces"][x["sp"]].get("velocidad", 1.0)})
    for c, lineas in sorted(caps.items()):
        (salida / f"job-c{c:02d}.json").write_text(json.dumps(lineas, ensure_ascii=False, separators=(",", ":")))
        print(f"capítulo {c}: {len(lineas)} piezas")


def a_mp3(pcm, destino):
    destino.parent.mkdir(parents=True, exist_ok=True)
    ms = int(ANTES_S * 1000)
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "pipe:0",
                    "-af", f"afade=t=in:d=0.008,adelay={ms}|{ms}", "-codec:a", "libmp3lame", "-b:a", "48k", str(destino)],
                   input=np.clip(pcm, -1, 1).astype(np.float32).tobytes(), check=True)


def armar(dir_libro, voces, origen):
    salida = dir_libro / "libro.json"
    libro = json.loads(salida.read_text(encoding="utf-8"))
    hechas = 0
    for c in libro["capitulos"]:
        for k, pag in enumerate(c["paginas"], 1):
            piezas = piezas_de(voces, c["n"], k)
            if not piezas:
                continue
            archivos = [origen / f"c{c['n']:02d}" / f"p{k:02d}-{i:03d}.mp3" for i in range(len(piezas))]
            if not all(f.exists() for f in archivos):
                continue
            trozos, t, antes = [], ANTES_S, None
            for x, f in zip(piezas, archivos):
                a, pausas = recortar(leer_mp3(f))
                rms = np.sqrt((a ** 2).mean()) + 1e-9
                a = a * min(NIVEL_RMS / rms, 4.0)
                if antes is not None:
                    h = HUECO["parrafo"] if x["par"] != antes[0] else HUECO["oracion"] if x["or"] != antes[1] else HUECO["pieza"]
                    trozos.append(np.zeros(int(h * SR), np.float32)); t += h
                o = pag["parrafos"][x["par"]][x["or"]]
                dur = len(a) / SR
                tiempos(o["palabras"][x["w0"]:x["w1"]], dur, pausas, t)
                if x["w0"] == 0:
                    o["t0"] = round(t, 2)
                o["t1"] = round(t + dur, 2)
                trozos.append(a); t += dur
                antes = (x["par"], x["or"])
            a_mp3(np.concatenate(trozos), dir_libro / pag["audio"])
            pag["duracion"] = round(t, 2)
            pag["voces"] = voces["nombre"]
            hechas += 1
    salida.write_text(json.dumps(libro, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{hechas} páginas con voces")


def main():
    libro, accion, carpeta = sys.argv[1], sys.argv[2], pathlib.Path(sys.argv[3])
    dir_libro = L.LIBROS / libro
    voces = json.loads((dir_libro / "voces.json").read_text(encoding="utf-8"))
    {"trabajos": trabajos, "armar": armar}[accion](dir_libro, voces, carpeta)


if __name__ == "__main__":
    main()
