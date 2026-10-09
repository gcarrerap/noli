#!/usr/bin/env python3
"""Graba los audios de Cuentos Revueltos con Piper (en_US-ljspeech, dominio público).

Cada archivo lleva 0,45 s de silencio al inicio: las TVs se comen el arranque.
Uso:
    python3 minijuegos/cuentos-revueltos/herramientas/grabar.py --voz /ruta/en_US-ljspeech-medium.onnx --todo
"""
import argparse, io, json, subprocess, sys, wave
from pathlib import Path

AQUI = Path(__file__).resolve().parent
JUEGO = AQUI.parent
AUDIO = JUEGO / "audio"
ANTES_MS = 450


def lista():
    js = (
        "import { readFileSync } from 'fs';"
        "import { archivosDe } from './src/audios.js';"
        "const indice = JSON.parse(readFileSync('./datos/indice.json','utf8'));"
        "const cuentos = indice.orden.map((id) => JSON.parse(readFileSync('./datos/cuentos/' + id + '.json','utf8')));"
        "console.log(JSON.stringify(archivosDe(cuentos)));"
    )
    out = subprocess.run(["node", "--input-type=module", "-e", js], cwd=JUEGO, capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def a_mp3(wav_bytes, destino):
    destino.parent.mkdir(parents=True, exist_ok=True)
    filtro = (
        "afade=t=in:d=0.008,"
        "areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.1,areverse,"
        f"adelay={ANTES_MS}|{ANTES_MS},apad=pad_dur=0.12"
    )
    subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-y", "-f", "wav", "-i", "pipe:0", "-af", filtro,
         "-ac", "1", "-ar", "22050", "-codec:a", "libmp3lame", "-b:a", "48k", str(destino)],
        input=wav_bytes, check=True,
    )


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--voz", required=True)
    ap.add_argument("--todo", action="store_true")
    args = ap.parse_args()
    from piper import PiperVoice
    from piper.config import SynthesisConfig
    voz = PiperVoice.load(args.voz)
    frase = SynthesisConfig(length_scale=1.12, noise_scale=0.5, noise_w_scale=0.6)
    palabra = SynthesisConfig(length_scale=1.15, noise_scale=0.5, noise_w_scale=0.6)
    datos = lista()
    hechos = 0

    def grabar(texto, destino, cfg):
        nonlocal hechos
        if destino.exists() and not args.todo:
            return
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            voz.synthesize_wav(texto, w, syn_config=cfg)
        a_mp3(buf.getvalue(), destino)
        hechos += 1
        if hechos % 20 == 0:
            print(f"{hechos}…", file=sys.stderr)

    for item in datos["frases"]:
        grabar(item["texto"], AUDIO / item["archivo"], frase)
    for item in datos["palabras"]:
        grabar(f"{item['texto']}.", AUDIO / item["archivo"], palabra)
    total = sum(f.stat().st_size for f in AUDIO.rglob("*.mp3"))
    print(f"{hechos} audios nuevos; {len(list(AUDIO.rglob('*.mp3')))} en total, {total / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
