# Licencias de la Biblioteca

Nada de este juego entra al repo sin su renglón aquí.

| Qué | Archivo(s) | Autor | Origen | Licencia | Fecha |
|---|---|---|---|---|---|
| Texto del libro *Mari and the Pumpkin Spaceship* | `libros/halloween/texto/*.md`, `biblia.md`, `personajes.*` | Escrito para Noli (#97) | Este repo | La del repo | 2026-10-14 |
| Ilustraciones | `libros/halloween/arte/personajes/*.jpg`, `libros/halloween/arte/escenas/*.jpg` (y sus copias reducidas en `arte/web/`) | Generadas por Guillermo con Gemini (Nano Banana Pro) a partir de los prompts de `prompts-personajes.json` y `escenas.json` | Este repo (#99, #101) | Uso personal de la familia; revisar los términos de Gemini antes de publicar el libro fuera de Noli | 2026-10-14 |
| Voces de los personajes (narración) | `libros/halloween/audio/**/*.mp3` | Voces propias de la cuenta de Fish Audio de la familia (Narrator, Mari-Rios, Zib, Abuela-lupe, Mrs. Hazel Crump, Leo, Ms. Patel, Mari's mom, Mari's Dad), generadas con el workflow FishBatchTextToSpeech de `gcarrerap/api-access`, modelo `s2.1-pro` | https://fish.audio | Uso familiar con voces creadas por la familia en su cuenta. | 2026-10-22 |
| Voz anterior (ya no se usa en Halloween) | — | Piper `en_US-ljspeech` medium, un hablante, 22 050 Hz | Modelo: https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/ljspeech/medium/MODEL_CARD (el mismo archivo viene en https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-ljspeech-medium.tar.bz2) — datos: https://keithito.com/LJ-Speech-Dataset/ | LJ Speech es dominio público. El modelo se entrenó desde cero con ese conjunto. | 2026-10-14 |
| Tipografías | Fredoka, Andika (Google Fonts, se cargan de fonts.googleapis.com) | Milena Brandão; SIL International | Google Fonts | SIL Open Font License 1.1 | 2026-10-14 |
| Ícono y adornos | `icono.svg`, adornos en `src/juego.js` | Hecho para Noli | Este repo | La del repo | 2026-10-14 |

La narración es un MP3 por página (mono, 22 050 Hz, 48 kb/s, con 0,45 s de silencio al inicio). Cada personaje tiene su voz: `herramientas/voces.py` arma los trabajos para Fish Audio a partir de `libros/halloween/voces.json` (quién dice cada pieza) y une las piezas de cada página guardando en `libro.json` cuándo suena cada palabra. Antes era la voz Piper de Spelling y Misión Luna (`herramientas/libro.py --voz`).
