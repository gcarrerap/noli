# Licencias de Spelling

Nada de este juego entra al repo sin su renglón aquí.

| Qué | Archivo(s) | Autor | Origen | Licencia | Fecha |
|---|---|---|---|---|---|
| Voz en inglés (grabaciones) | `audio/p/*.mp3`, `audio/d/*.mp3`, `audio/f/*.mp3`, `audio/l/*.mp3`, `audio/prueba.mp3` | Piper `en_US-ljspeech` medium, un hablante, 22 050 Hz | Modelo: https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/ljspeech/medium/MODEL_CARD (el mismo archivo viene en https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-ljspeech-medium.tar.bz2) — datos: https://keithito.com/LJ-Speech-Dataset/ | LJ Speech es dominio público. El modelo se entrenó desde cero con ese conjunto (https://brycebeattie.com/files/tts/). | 2026-10-12 |
| Ícono | `icono.svg` | Hecho para Noli | Este repo | La del repo | — |
| Voz de respaldo | (la del navegador, `speechSynthesis`) | El sistema del aparato | — | No se distribuye nada | — |

Las grabaciones son mono, 22 050 Hz, MP3 a 48 kb/s, con 0,45 s de silencio al inicio (0,2 s en las letras), hechas con `herramientas/grabar.py`. Es la misma voz de Cuentos Revueltos. Sustituyen a Piper `en_US-lessac` (Blizzard 2013, solo investigación; #65).
