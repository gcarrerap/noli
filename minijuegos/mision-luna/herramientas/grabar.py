#!/usr/bin/env python3
"""Graba los audios de Misión Luna con una voz neuronal en inglés (Piper en_US-ljspeech medium, dominio público).

Es la misma voz de Spelling y Cuentos Revueltos (no usar en_US-lessac: sus datos son solo para investigación, #65).
Así la voz suena en cualquier navegador (DuckDuckGo, la LG webOS…), no solo en los que traen speechSynthesis.
Qué se graba lo dice src/audios.js (lo mismo que revisa la prueba): en minijuegos/mision-luna/audio/

    t/<texto>-<k>.mp3   oración k de un texto      q/<texto>.mp3     la pregunta
    o/<texto>-<k>.mp3   opción k (índice del JSON)  p/<palabra>.mp3   la palabra espacial
    f/<n>.mp3           el nombre de la fase n

Uso (una vez: pip install piper-tts onnx, y la voz en_US-ljspeech-medium.onnx con su .onnx.json de
https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/ljspeech/medium; el mismo modelo viene en
https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-ljspeech-medium.tar.bz2):

    python3 minijuegos/mision-luna/herramientas/grabar.py --voz /ruta/en_US-ljspeech-medium.onnx [--todo]

Sin --todo solo graba lo que falta (al agregar o cambiar textos en datos/, borrar antes los MP3 viejos de ese
texto). Necesita node y ffmpeg. Las palabras sueltas y los nombres de las fases se dicen dentro de
"The word ___." y se recortan (ver Recortador): sueltas, esta voz se come la primera consonante.
"""
import argparse, io, json, subprocess, sys, wave
from pathlib import Path

AQUI = Path(__file__).resolve().parent
JUEGO = AQUI.parent
AUDIO = JUEGO / "audio"


def contenido():
    """La lista de src/audios.js, con los datos de datos/*.json."""
    js = ("import { readFileSync } from 'node:fs'; import { audios } from './src/audios.js'; "
          "const l = (f) => JSON.parse(readFileSync('datos/' + f, 'utf8')); "
          "console.log(JSON.stringify(audios(l('misiones.json'), l('vocabulario.json'))));")
    out = subprocess.run(["node", "--input-type=module", "-e", js], cwd=JUEGO, capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


# Silencio al principio de cada grabación. Las TVs (y barras de sonido) tardan unas décimas en "despertar" el
# audio y se comen el principio: sin este colchón, de "six" solo se oía la "x".
ANTES_MS = 450
ANTES_SEGUIDA_MS = 200   # lo que suena justo después de otra grabación (oraciones 2 en adelante, opciones)


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


class Recortador:
    """Dice una palabra dentro de una frase ("The word cheese.") y recorta solo la palabra.

    La voz ljspeech dice mal las palabras sueltas: se come la primera consonante y la ch suena a sh. Dentro de una
    frase las dice bien. Para recortar se usan las duraciones de cada fonema que calcula el propio modelo (la salida
    del nodo /Ceil, que se agrega a las salidas del .onnx al cargarlo).
    """
    MUESTRA = "The word {}."
    HOP = 256            # muestras de audio por cuadro de duración (Piper medium)
    ANTES_S = 0.01       # se deja un poco antes de la palabra para no comerse la consonante

    def __init__(self, voz, ruta):
        import numpy as np, onnx, onnxruntime
        self.np, self.voz = np, voz
        m = onnx.load(ruta)
        m.graph.output.append(onnx.helper.make_tensor_value_info("/Ceil_output_0", onnx.TensorProto.FLOAT, None))
        self.ses = onnxruntime.InferenceSession(m.SerializeToString(), providers=["CPUExecutionProvider"])
        self.sr = voz.config.sample_rate
        self.fonema = {}
        for f, ids in voz.config.phoneme_id_map.items():
            for i in ids:
                self.fonema.setdefault(i, f)

    def wav(self, palabra, cfg):
        np = self.np
        fon = [p for s in self.voz.phonemize(self.MUESTRA.format(palabra)) for p in s]
        ids = self.voz.phonemes_to_ids(fon)
        audio, dur = self.ses.run(None, {
            "input": np.array([ids], np.int64), "input_lengths": np.array([len(ids)], np.int64),
            "scales": np.array([cfg.noise_scale, cfg.length_scale, cfg.noise_w_scale], np.float32)})
        audio = audio.squeeze()
        fin = np.cumsum(dur.squeeze().astype(int) * self.HOP)
        f = [self.fonema[i] for i in ids]
        espacio = [i for i, p in enumerate(f) if p == " "][1]   # el que va después de "The word"
        a = max(0, fin[espacio] - int(self.ANTES_S * self.sr))
        # La palabra es lo último de la frase: se deja hasta el final, para no cortar la explosión de la última
        # consonante (la p de chip); a_mp3 quita el silencio que sobra.
        pcm = (np.clip(audio[a:], -1, 1) * 32767).astype(np.int16)
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(self.sr)
            w.writeframes(pcm.tobytes())
        return buf.getvalue()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--voz", required=True, help="archivo .onnx de la voz de Piper (con su .onnx.json al lado)")
    ap.add_argument("--todo", action="store_true", help="volver a grabar todo, aunque ya exista")
    args = ap.parse_args()

    from piper import PiperVoice
    from piper.config import SynthesisConfig
    voz = PiperVoice.load(args.voz)
    recortador = Recortador(voz, args.voz)
    # length_scale > 1 = más despacio. Para una niña de 7 años que lee: un poco más lento que lo normal.
    suelta, frase = (SynthesisConfig(length_scale=s, noise_scale=0.5, noise_w_scale=0.6) for s in (1.15, 1.12))

    hechos = 0
    for a in contenido():
        destino = AUDIO / a["archivo"]
        if destino.exists() and not args.todo:
            continue
        seguida = a["archivo"].startswith("o/") or (a["archivo"].startswith("t/") and not a["archivo"].endswith("-0.mp3"))
        if a.get("suelta"):
            datos = recortador.wav(a["texto"], suelta)
        else:
            buf = io.BytesIO()
            with wave.open(buf, "wb") as w:
                voz.synthesize_wav(a["texto"], w, syn_config=frase)
            datos = buf.getvalue()
        a_mp3(datos, destino, ANTES_SEGUIDA_MS if seguida else ANTES_MS)
        hechos += 1
        if hechos % 20 == 0:
            print(f"{hechos}…", file=sys.stderr)
    archivos = list(AUDIO.rglob("*.mp3"))
    total = sum(f.stat().st_size for f in archivos)
    print(f"{hechos} audios nuevos; {len(archivos)} en total, {total / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
