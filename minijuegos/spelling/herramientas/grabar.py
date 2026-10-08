#!/usr/bin/env python3
"""Graba los audios de Spelling con una voz neuronal en inglés (Piper, voz "lessac", en-US).

Así la voz suena en cualquier navegador (DuckDuckGo, la LG webOS…), no solo en los que traen speechSynthesis.
Genera en minijuegos/spelling/audio/:

    p/<palabra>.mp3    la palabra                 l/<letra>.mp3   el nombre de cada letra (para deletrear)
    d/<palabra>.mp3    la palabra, despacio       prueba.mp3      la frase de "Probar la voz"
    f/<palabra>.mp3    la frase de la palabra

Uso (una vez: pip install piper-tts, y la voz de https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-en-us-lessac-medium.tar.gz):

    python3 minijuegos/spelling/herramientas/grabar.py --voz /ruta/en-us-lessac-medium.onnx [--todo]

Sin --todo solo graba lo que falta (al agregar palabras a src/palabras.js). Necesita node y ffmpeg.
"""
import argparse, io, json, os, subprocess, sys, wave
from pathlib import Path

AQUI = Path(__file__).resolve().parent
JUEGO = AQUI.parent
AUDIO = JUEGO / "audio"

# Nombres de las letras escritos como suenan (una letra sola la voz a veces la lee como palabra: "a" → "uh")
LETRAS = {
    "a": "ay", "b": "bee", "c": "see", "d": "dee", "e": "ee", "f": "eff", "g": "gee", "h": "aitch", "i": "eye",
    "j": "jay", "k": "kay", "l": "ell", "m": "em", "n": "en", "o": "oh", "p": "pee", "q": "cue", "r": "ar",
    "s": "ess", "t": "tee", "u": "you", "v": "vee", "w": "double you", "x": "ex", "y": "why", "z": "zee",
}
PRUEBA = "Hello Noli! Can you spell cat? C, A, T. Cat."


def listas():
    js = "import { LISTAS } from './src/palabras.js'; console.log(JSON.stringify(LISTAS));"
    out = subprocess.run(["node", "--input-type=module", "-e", js], cwd=JUEGO, capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


# Silencio al principio de cada grabación. Las TVs (y barras de sonido) tardan unas décimas en "despertar" el
# audio y se comen el principio: sin este colchón, de "six" solo se oía la "x".
ANTES_MS = 450
ANTES_LETRA_MS = 200   # las letras van seguidas al deletrear: el audio ya está despierto


def a_mp3(wav_bytes, destino, antes_ms=ANTES_MS):
    destino.parent.mkdir(parents=True, exist_ok=True)
    # No se recorta el principio (la voz empieza justo en el primer instante y un recorte se come las consonantes
    # suaves como la s); se quita el silencio del final, se agrega el colchón del principio y un respiro al final,
    # y se comprime para voz (mono, 48 kb/s).
    filtro = ("afade=t=in:d=0.008,"
              "areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.1,areverse,"
              f"adelay={antes_ms}|{antes_ms},apad=pad_dur=0.12")
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "wav", "-i", "pipe:0", "-af", filtro,
                    "-ac", "1", "-ar", "22050", "-codec:a", "libmp3lame", "-b:a", "48k", str(destino)],
                   input=wav_bytes, check=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--voz", required=True, help="archivo .onnx de la voz de Piper (con su .onnx.json al lado)")
    ap.add_argument("--todo", action="store_true", help="volver a grabar todo, aunque ya exista")
    args = ap.parse_args()

    from piper import PiperVoice
    from piper.config import SynthesisConfig
    voz = PiperVoice.load(args.voz)
    # length_scale > 1 = más despacio. Para niños, un poco más lento que lo normal.
    normal, lenta, frase = (SynthesisConfig(length_scale=s, noise_scale=0.5, noise_w_scale=0.6) for s in (1.15, 2.4, 1.1))

    def grabar(texto, destino, cfg, antes_ms=ANTES_MS):
        if destino.exists() and not args.todo:
            return False
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            voz.synthesize_wav(texto, w, syn_config=cfg)
        a_mp3(buf.getvalue(), destino, antes_ms)
        return True

    hechos = 0
    for l in listas():
        for p in l["palabras"]:
            w, slug = p["palabra"], p["palabra"].lower()
            hechos += grabar(f"{w}.", AUDIO / "p" / f"{slug}.mp3", normal)
            hechos += grabar(f"{w}.", AUDIO / "d" / f"{slug}.mp3", lenta)
            hechos += grabar(p["frase"], AUDIO / "f" / f"{slug}.mp3", frase)
        print(f"lista {l['n']} lista", file=sys.stderr)
    for letra, nombre in LETRAS.items():
        hechos += grabar(f"{nombre}.", AUDIO / "l" / f"{letra}.mp3", normal, ANTES_LETRA_MS)
    hechos += grabar(PRUEBA, AUDIO / "prueba.mp3", frase)
    total = sum(f.stat().st_size for f in AUDIO.rglob("*.mp3"))
    print(f"{hechos} audios nuevos; {len(list(AUDIO.rglob('*.mp3')))} en total, {total / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
