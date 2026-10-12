# Licencias de Misión Luna

Nada de este juego entra al repo sin su renglón aquí.

| Qué | Archivo(s) | Autor | Origen | Licencia | Fecha |
|---|---|---|---|---|---|
| Voz en inglés (grabaciones) | `audio/t/*.mp3`, `audio/q/*.mp3`, `audio/o/*.mp3`, `audio/p/*.mp3`, `audio/f/*.mp3` | Piper `en_US-ljspeech` medium, un hablante, 22 050 Hz | Modelo: https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/ljspeech/medium/MODEL_CARD (el mismo archivo viene en https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-ljspeech-medium.tar.bz2) — datos: https://keithito.com/LJ-Speech-Dataset/ | LJ Speech es dominio público. El modelo se entrenó desde cero con ese conjunto (https://brycebeattie.com/files/tts/). | 2026-10-12 |
| Textos, preguntas y vocabulario | `datos/*.json` | Escritos para Noli | Este repo (inspirados en el tema de la unidad «The Moon» de 2.º grado de Khan Academy, sin copiar su contenido) | La del repo | 2026-10-12 |
| Arte (cohete, Luna, fases, museo, íconos) | `icono.svg`, `src/arte.js` | Hecho para Noli | Este repo | La del repo | 2026-10-12 |
| Voz de respaldo | (la del navegador, `speechSynthesis`) | El sistema del aparato | — | No se distribuye nada | — |

Las grabaciones son mono, 22 050 Hz, MP3 a 48 kb/s, con 0,45 s de silencio al inicio (0,2 s en lo que suena justo después de otra grabación: las oraciones 2 en adelante y las opciones), hechas con `herramientas/grabar.py`. Es la misma voz de Spelling y Cuentos Revueltos.
