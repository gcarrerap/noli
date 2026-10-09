import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rngConSemilla } from "../src/rng.js";
import { TEXTOS } from "../src/textos.js";
import {
  anguloMinutero, anguloHorario, digital, entreNumeros, misma, esDoceEnPunto,
  moverMinutos, moverHora, lecturaRayitas, lecturaCambiada, lecturaPasada,
  candidatosLectura, gradosTranscurridos, sectorPath, minutosDesdeAngulo, arrastre,
  cuentaPrimera, hora12, VUELTAS_MAX, GAG_MS, atrasEnEspera, toqueEnPantalla, alCerrarEspera,
} from "../src/reloj.js";
import {
  fraseMenosCuarto, horaMenosCuarto, decirHora, etiquetaIngles, frasePoner, vozPoner, fraseCuanto,
  fraseExito, lineaDeAcierto, EXITOS,
} from "../src/frases.js";
import { MOMENTOS, NIVELES, ALBUM, planDia, escenaDe, POR_TURNO } from "../src/niveles.js";
import { pista } from "../src/pista.js";
import {
  guiaNueva, aplicarGuia, textoPaso, vozPaso, PASOS, META_GUIA,
  esExplicacion, focoTrasExplicacion, ESPERA_EXPLICAR_MS,
} from "../src/guia.js";
import {
  nuevo, cargar, registrar, dominio, cerrarTurno, estrellasTurno, racha, textoRacha,
  cumplirReto, VENTANA, PARA_SUBIR,
} from "../src/progreso.js";
import { retoDelDia, RETO } from "../src/reto.js";

const SIN_SIMBOLO = /[▲▼+]/;
const QUINTOS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

test("manecillas y digital coinciden en todas las horas de 5 en 5", () => {
  for (let h = 0; h < 24; h++) {
    for (const m of QUINTOS) {
      assert.equal(anguloMinutero(m), m * 6);
      assert.equal(anguloHorario(h, m), (hora12(h) % 12) * 30 + m * 0.5);
      assert.match(digital(h, m), /^\d{1,2}:\d{2}$/);
      assert.equal(digital(h, m).split(":")[1].length, 2);
      if (m !== 0) {
        const e = entreNumeros(h, m);
        assert.ok(e);
        const ang = anguloHorario(h, m);
        const marca = (n) => (n % 12) * 30;
        if (e.desde === 12) assert.ok(ang > 0 && ang < 30, digital(h, m));
        else if (e.hasta === 12) assert.ok(ang > 330 && ang < 360, digital(h, m));
        else assert.ok(ang > marca(e.desde) && ang < marca(e.hasta), digital(h, m));
      } else {
        assert.equal(entreNumeros(h, m), null);
        assert.equal(anguloHorario(h, m) % 30, 0);
      }
    }
  }
});

test("a las 7:45 la corta está más cerca del 8 que del 7", () => {
  const ang = anguloHorario(7, 45);
  assert.ok(Math.abs(ang - 240) < Math.abs(ang - 210));
  assert.deepEqual(entreNumeros(7, 45), { desde: 7, hasta: 8 });
});

test("el horario va unido al minutero y de :55 pasa a la hora siguiente", () => {
  assert.deepEqual(moverMinutos({ h: 7, m: 55 }, 1), { h: 8, m: 0 });
  assert.deepEqual(moverMinutos({ h: 8, m: 0 }, -1), { h: 7, m: 55 });
  assert.deepEqual(moverMinutos({ h: 23, m: 55 }, 1), { h: 0, m: 0 });
  assert.deepEqual(moverHora({ h: 7, m: 45 }, 1), { h: 8, m: 45 });
  assert.equal(arrastre({ h: 7, m: 55 }, 0, 55).h, 8);
  assert.equal(arrastre({ h: 8, m: 0 }, 330, 0).h, 7);
  assert.equal(minutosDesdeAngulo(90), 15);
  assert.equal(minutosDesdeAngulo(0), 0);
});

test("errores típicos: 7:15 como 7:03, manecillas cambiadas y 7:50 como 8:50", () => {
  assert.deepEqual(lecturaRayitas(7, 15), { h: 7, m: 3 });
  assert.deepEqual(lecturaCambiada(8, 15), { h: 3, m: 40 });
  assert.deepEqual(lecturaPasada(7, 50), { h: 8, m: 50 });
  assert.equal(lecturaPasada(7, 15), null);

  const rnd = rngConSemilla("opciones");
  const tiene = (h, m, eh, em) => candidatosLectura(h, m).slice(0, 2).some((c) => c.h === eh && c.m === em);
  assert.equal(tiene(7, 15, 7, 3), true);
  assert.equal(tiene(8, 15, 3, 40), true);
  assert.equal(tiene(7, 50, 8, 50), true);

  for (let h = 1; h <= 11; h++) {
    for (const m of QUINTOS) {
      const escena = escenaDe("leer", "desayuno", h, m, rnd);
      assert.equal(escena.opciones.length, 3);
      assert.equal(escena.opciones.filter((o) => o.buena).length, 1);
      const claves = new Set(escena.opciones.map((o) => `${o.h}:${o.m}`));
      assert.equal(claves.size, 3);
      assert.ok(escena.opciones.some((o) => o.buena && misma(o, { h, m })));
    }
  }
});

test("menos cuarto nombra la hora siguiente y vive en un solo lugar", () => {
  assert.equal(TEXTOS.menosCuarto, "menos cuarto");
  assert.equal(horaMenosCuarto(8), 9);
  assert.equal(fraseMenosCuarto(8), "Las 9 menos cuarto");
  assert.equal(horaMenosCuarto(12), 1);
  assert.equal(fraseMenosCuarto(12), "La 1 menos cuarto");
  assert.match(decirHora(8, 45), /menos cuarto/);
  assert.equal(decirHora(8, 45).includes("▲"), false);
  const escena = escenaDe("poner", "recreo", 10, 45, rngConSemilla(1));
  assert.equal(escena.digitalAlLado, true);
  assert.match(escena.frase, /Las 11 menos cuarto/);
  assert.match(escena.voz, /menos cuarto/);
  assert.equal(SIN_SIMBOLO.test(escena.voz), false);
  assert.equal(escena.frase.includes("cuarto para"), false);
});

test("el día no usa las 12:00 y va en orden", () => {
  const rnd = rngConSemilla("dia");
  for (let n = 1; n <= NIVELES.length; n++) {
    for (let k = 0; k < 30; k++) {
      const dia = planDia(n, rnd);
      assert.equal(dia.length, POR_TURNO);
      const ids = dia.map((e) => e.momento);
      const orden = ids.map((id) => MOMENTOS.findIndex((m) => m.id === id));
      assert.deepEqual(orden, [...orden].sort((a, b) => a - b));
      for (const e of dia) {
        assert.equal(esDoceEnPunto(e.h, e.m), false);
        assert.notEqual(hora12(e.h), 12);
        if (e.tipo === "poner") assert.equal(esDoceEnPunto(e.inicio.h, e.inicio.m), false, "no arranca en las 12");
        if (e.h2 != null) assert.equal(esDoceEnPunto(e.h2, e.m2), false);
        assert.equal(e.m % 5, 0);
      }
    }
  }
});

test("cada nivel enseña una sola cosa nueva", () => {
  const rnd = rngConSemilla("niveles");
  const dias = (n) => Array.from({ length: 20 }, () => planDia(n, rnd)).flat();
  assert.ok(dias(1).every((e) => e.tipo === "poner" && e.m === 0));
  assert.ok(dias(2).every((e) => e.m === 30));
  assert.ok(dias(3).every((e) => e.m === 15));
  assert.ok(dias(3).some((e) => e.tipo === "leer"));
  const n4 = dias(4);
  assert.ok(n4.every((e) => e.tipo === "poner" && e.m === 45 && e.digitalAlLado));
  assert.ok(dias(5).every((e) => [5, 10, 20, 25, 35, 40, 50, 55].includes(e.m)));
  assert.ok(dias(7).every((e) => e.tipo === "momento" && ["manana", "tarde", "noche"].includes(e.parte)));
  assert.ok(dias(7).every((e) => e.opciones.length === 3 && e.opciones.filter((o) => o.buena).length === 1));
  const n8 = dias(8);
  assert.ok(n8.every((e) => e.tipo === "cuanto"));
  for (const e of n8) {
    const mins = (e.h2 * 60 + e.m2) - (e.h * 60 + e.m);
    assert.ok([15, 30, 60].includes(mins), mins);
    assert.equal(e.opciones.filter((o) => o.buena).length, 1);
    assert.equal(e.opciones.find((o) => o.buena).id, e.salto);
    const grados = { cuarto: 90, media: 180, hora: 360 }[e.salto];
    assert.equal(gradosTranscurridos(e.h, e.m, e.h2, e.m2), grados);
    const path = sectorPath(e.h, e.m, e.h2, e.m2);
    assert.match(path, /^M /);
    if (e.salto === "hora") assert.match(path, /A 100 100 0 1 1/);
  }
});

test("las partes del día no se cruzan y evitan el mediodía", () => {
  for (const m of MOMENTOS) {
    assert.notEqual(m.hora, 12);
    if (m.parte === "manana") assert.ok(m.hora < 12);
    if (m.parte === "tarde") assert.ok(m.hora > 12 && m.hora < 18);
    if (m.parte === "noche") assert.ok(m.hora >= 18);
  }
  assert.deepEqual(ALBUM.map((a) => a.id), ["cumpleanos", "playa", "navidad"]);
});

test("la guía de las 3:00 solo avanza cuando ella hace el paso", () => {
  let g = guiaNueva();
  assert.equal(g.paso, 0);
  assert.deepEqual(g.reloj, { h: 1, m: 0 });
  g = aplicarGuia(g, { tipo: "mover", reloj: { h: 3, m: 0 } });
  assert.equal(g.paso, 0, "el primer paso no se salta con las manecillas");
  g = aplicarGuia(g, { tipo: "escena" });
  assert.equal(g.paso, 1);
  g = aplicarGuia(g, { tipo: "foco", control: "minutos" });
  assert.equal(g.paso, 1);
  g = aplicarGuia(g, { tipo: "foco", control: "hora" });
  assert.equal(g.paso, 2);
  g = aplicarGuia(g, { tipo: "mover", reloj: { h: 2, m: 0 } });
  assert.equal(g.paso, 2);
  g = aplicarGuia(g, { tipo: "mover", reloj: { h: 3, m: 0 } });
  assert.equal(g.paso, 3);
  g = aplicarGuia(g, { tipo: "listo", reloj: g.reloj });
  assert.equal(g.fin, false, "Listo antes de tiempo no cierra la guía");
  g = aplicarGuia(g, { tipo: "foco", control: "minutos", reloj: { h: 3, m: 0 } });
  assert.equal(g.paso, 4);
  g = aplicarGuia(g, { tipo: "listo", reloj: { h: 3, m: 5 } });
  assert.equal(g.fin, false);
  g = aplicarGuia(g, { tipo: "listo", reloj: { ...META_GUIA } });
  assert.equal(g.fin, true);
  assert.equal(aplicarGuia(guiaNueva(), { tipo: "saltar" }).fin, true);
  assert.equal(aplicarGuia(guiaNueva(), { tipo: "seguir" }).paso, 0, "el primer paso no se salta solo");
  let explica = aplicarGuia(guiaNueva(), { tipo: "escena" });
  assert.equal(esExplicacion(explica.paso), true);
  assert.equal(ESPERA_EXPLICAR_MS, 2000);
  explica = aplicarGuia(explica, { tipo: "seguir" });
  assert.equal(explica.paso, 2);
  assert.equal(focoTrasExplicacion(explica.paso), "hora");
  explica = aplicarGuia(explica, { tipo: "mover", reloj: { h: 3, m: 0 } });
  assert.equal(esExplicacion(explica.paso), true);
  assert.equal(aplicarGuia(explica, { tipo: "seguir" }).paso, 4);
  assert.equal(focoTrasExplicacion(4), "listo");
  assert.equal(PASOS.length, 5);
  assert.match(textoPaso(2, true), /▲/);
  assert.match(textoPaso(2, false), /\+/);
  assert.equal(SIN_SIMBOLO.test(vozPaso(2)), false);
  for (let i = 0; i < PASOS.length; i++) assert.equal(SIN_SIMBOLO.test(vozPaso(i)), false);
});

test("poner no arranca a las 12:00", () => {
  for (let seed = 0; seed < 50; seed++) {
    const rnd = rngConSemilla("doce-" + seed);
    for (const momento of MOMENTOS) {
      for (const m of [0, 15, 30, 45]) {
        const e = escenaDe("poner", momento.id, momento.hora, m, rnd);
        assert.equal(esDoceEnPunto(e.inicio.h, e.inicio.m), false, `${momento.id} ${m}`);
        assert.equal(hora12(e.inicio.h) === hora12(e.h) && e.inicio.m === e.m, false);
      }
    }
  }
});

test("el acierto varía y el chiste no dice a destiempo", () => {
  assert.ok(EXITOS.length >= 3);
  assert.equal(new Set(EXITOS).size, EXITOS.length);
  assert.equal(fraseExito(0), EXITOS[0]);
  assert.equal(fraseExito(EXITOS.length), EXITOS[0]);
  assert.equal(lineaDeAcierto(0, 0), EXITOS[0]);
  assert.notEqual(lineaDeAcierto(0, 1), lineaDeAcierto(0, 0));
  assert.equal(lineaDeAcierto(0, 1), EXITOS[1]);
  assert.equal(EXITOS.some((t) => /destiempo/.test(t)), false);
  assert.equal(MOMENTOS.some((m) => /destiempo/.test(m.chiste)), false);
  assert.equal(atrasEnEspera("gag"), "salir");
  assert.equal(atrasEnEspera("bien"), "salir");
  assert.equal(atrasEnEspera("manos"), "seguir");
  assert.equal(GAG_MS <= 1500, true);
});

test("Seguir y Salir responden durante el chiste y durante el acierto", () => {
  for (const fase of ["gag", "bien"]) {
    assert.equal(toqueEnPantalla({ fase, act: "seguir", dialog: true }), "seguir");
    assert.equal(toqueEnPantalla({ fase, act: "salir-si", dialog: true }), "salir");
    assert.equal(toqueEnPantalla({ fase, act: "listo", dialog: false }), "nada");
    assert.equal(toqueEnPantalla({ fase, act: "seguir", dialog: false }), "nada");
  }
  assert.equal(toqueEnPantalla({ fase: "", act: "listo", dialog: false }), "listo");
  assert.equal(alCerrarEspera("gag", 0).hacer, "manos");
  assert.equal(alCerrarEspera("bien", 0).hacer, "siguiente");
  assert.deepEqual(alCerrarEspera("gag", 400), { hacer: "esperar", ms: 400 });
  assert.equal(alCerrarEspera("gag", GAG_MS).ms <= 1500, true);
});

test("tocar el reloj no usa relojFocus sin declararla", () => {
  const src = readFileSync(new URL("../src/juego.js", import.meta.url), "utf8");
  const decl = src.search(/\blet relojFocus\b/);
  const uso = src.search(/\brelojFocus\s*=/);
  assert.ok(decl >= 0, "falta let relojFocus");
  assert.ok(uso > decl, "la asignación va antes de la declaración");
});

test("pistas: el nivel 1 es el paso completo y menos cuarto sube hacia el 9", () => {
  const n1 = pista({ nivel: 1, tipo: "poner", objetivo: { h: 3, m: 0 }, actual: { h: 1, m: 0 }, tv: true });
  assert.match(n1.texto, /▲ Sube la corta al 3/);
  assert.equal(SIN_SIMBOLO.test(n1.voz), false);
  const n1t = pista({ nivel: 1, tipo: "poner", objetivo: { h: 3, m: 0 }, actual: { h: 1, m: 0 }, tv: false });
  assert.match(n1t.texto, /\+ Sube la corta al 3/);

  const corta = pista({ nivel: 4, tipo: "poner", objetivo: { h: 8, m: 45 }, actual: { h: 8, m: 0 }, segundos: 0 });
  assert.match(corta.texto, /al 9/);
  const full = pista({ nivel: 4, tipo: "poner", objetivo: { h: 8, m: 45 }, actual: { h: 8, m: 0 }, segundos: 40, tv: false });
  assert.match(full.texto, /\+ Sube la larga al 9/);
  assert.match(full.voz, /^Sube la larga al nueve\.$/);

  const media = pista({ nivel: 2, tipo: "poner", objetivo: { h: 8, m: 30 }, actual: { h: 8, m: 0 }, segundos: 0 });
  assert.match(media.texto, /al 6/);
  const flecha = pista({ nivel: 2, tipo: "poner", objetivo: { h: 8, m: 30 }, actual: { h: 8, m: 0 }, segundos: 20 });
  assert.equal(flecha.luz, "minutos");
  assert.equal(pista({ nivel: 5, tipo: "poner", objetivo: { h: 7, m: 20 }, actual: { h: 7, m: 0 }, segundos: 0, dominado: false }).mostrarMinutos, true);
  assert.equal(pista({ nivel: 5, tipo: "poner", objetivo: { h: 7, m: 20 }, actual: { h: 7, m: 0 }, segundos: 0, dominado: true }).mostrarMinutos, false);
  assert.match(pista({ nivel: 6, tipo: "leer", objetivo: { h: 7, m: 15 }, segundos: 0 }).texto, /corta/);
  assert.match(pista({ nivel: 7, tipo: "momento", objetivo: { parte: "noche" }, segundos: 0 }).texto, /cielo/);
  assert.match(pista({ nivel: 8, tipo: "cuanto", objetivo: { salto: "hora" }, segundos: 0 }).texto, /arco/);
  assert.equal(GAG_MS <= 1500, true);
});

test("muchas vueltas no cuentan como a la primera", () => {
  assert.equal(cuentaPrimera(1, VUELTAS_MAX), true);
  assert.equal(cuentaPrimera(1, VUELTAS_MAX + 1), false);
  assert.equal(cuentaPrimera(2, 0), false);
});

test("sube con 8 de los últimos 10 y el segundo intento no mueve la ventana", () => {
  let pr = nuevo();
  assert.equal(pr.voz, true);
  const hoy = "2026-10-09";
  for (let i = 0; i < VENTANA - PARA_SUBIR; i++) pr = registrar(pr, 1, { ok: false }, hoy);
  for (let i = 0; i < PARA_SUBIR - 1; i++) pr = registrar(pr, 1, { ok: true }, hoy);
  assert.equal(dominio(pr, 1).listo, false);
  pr = registrar(pr, 1, { ok: true }, hoy);
  assert.equal(dominio(pr, 1).aciertos, PARA_SUBIR);
  assert.equal(dominio(pr, 1).listo, true);
  const antes = dominio(pr, 1).intentos;
  pr = registrar(pr, 1, { ok: true }, hoy, 2);
  assert.equal(dominio(pr, 1).intentos, antes);
  const fin = cerrarTurno(pr, 1, 6);
  assert.equal(fin.subio, 2);
  assert.equal(fin.pr.album, 1);
  assert.equal(cerrarTurno(fin.pr, 2, 6).pr.album, 2);
  assert.equal(estrellasTurno(6), 3);
  assert.equal(estrellasTurno(5), 2);
  assert.equal(estrellasTurno(3), 1);
  assert.equal(estrellasTurno(2), 0);
  const otra = cargar({ v: 1, voz: false, nivel: 9, album: 9, guia: 1 });
  assert.equal(otra.voz, false);
  assert.equal(otra.nivel, NIVELES.length);
  assert.equal(otra.album, 3);
  assert.equal(otra.guia, true);
  assert.deepEqual(cargar(null), nuevo());
});

test("el reto misterioso es el mismo con la misma fecha y no es de tiempo", () => {
  const a = retoDelDia("2026-10-09", 4);
  const b = retoDelDia("2026-10-09", 4);
  assert.equal(a.nombre, "Reloj misterioso");
  assert.equal(a.cuantos, 6);
  assert.equal(a.necesita, 4);
  assert.equal(RETO.meta.includes("segundo"), false);
  assert.deepEqual(a.escenas.map((e) => [e.h, e.m, e.momento]), b.escenas.map((e) => [e.h, e.m, e.momento]));
  assert.notDeepEqual(retoDelDia("2026-10-10", 4).escenas.map((e) => e.m), a.escenas.map((e) => e.m));
  assert.ok(a.escenas.every((e) => e.tipo === "leer" && !esDoceEnPunto(e.h, e.m)));
  let pr = cumplirReto(nuevo(), "2026-10-09", a.tipo, 4, true);
  pr = cumplirReto(pr, "2026-10-08", a.tipo, 4, true);
  assert.equal(racha(pr, "2026-10-09"), 2);
  assert.match(textoRacha(nuevo(), "2026-10-09"), /empezar una racha/);
  assert.equal(/perd|romp|mal/i.test(textoRacha(nuevo(), "2026-10-09")), false);
});

test("el inglés de y media no se evalúa y la frase de poner no lo usa", () => {
  assert.equal(etiquetaIngles(7, 30), "half past seven");
  assert.equal(etiquetaIngles(7, 15), "");
  const e = escenaDe("poner", "desayuno", 7, 30, rngConSemilla(2));
  assert.match(frasePoner(MOMENTOS[0], 7, 30), /y media/);
  assert.equal(e.frase.includes("half"), false);
  assert.match(vozPoner(MOMENTOS[0], 7, 0), /Pon las siete/);
  assert.match(fraseCuanto(7, 0, 8, 0), /7:00/);
  assert.match(fraseCuanto(7, 0, 8, 0), /8:00/);
});
