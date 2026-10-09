// Sección "Sonidos de CH": la letra pareja CH suena de tres maneras en inglés.
//   ch  como en chips      (el sonido normal)
//   k   como en school     (palabras que vienen del griego)
//   sh  como en chef       (palabras que vienen del francés)
// Aquí está el banco de palabras (con frase y dificultad), cómo se arma una ronda y el progreso de la sección.
// Todo es lógica pura; las pantallas están en juego.js.
//
// Dificultad (n): 1 = cortas y comunes, 2 = medias, 3 = largas o raras.
// Se evitan palabras que suenan igual a otra (chews/choose, chute/shoot, chord/cord, which/witch…), para que
// escucharlas no sea ambiguo, y las que llevan "tch" (watch, kitchen), que no son parte de esta lección.
import { revolver } from "./rng.js";
import { estrellasRonda } from "./progreso.js";

export const SONIDOS = [
  { id: "ch", como: "chips", ejemplos: ["chips", "chair", "lunch"], corto: "el normal",
    regla: "Es el sonido de siempre, como en chips." },
  { id: "k", como: "school", ejemplos: ["school", "Christmas", "mechanic"], corto: "como una K",
    regla: "Suena como una K. Casi siempre en palabras que vienen del griego." },
  { id: "sh", como: "chef", ejemplos: ["chef", "machine", "parachute"], corto: "como SH",
    regla: "Suena como SH. Casi siempre en palabras que vienen del francés." },
];
export const sonido = (id) => SONIDOS.find((s) => s.id === id);

const B = (sonido, n, filas) => filas.map(([palabra, frase]) => ({ palabra, frase, sonido, n }));

export const BANCO = [
  // ---- ch, el sonido normal ----
  ...B("ch", 1, [
    ["chips", "I love chips with salsa."],
    ["chip", "Can I have a chip?"],
    ["chin", "He has jam on his chin."],
    ["chat", "Mom and I chat after dinner."],
    ["chop", "Dad will chop the onion."],
    ["chick", "The little chick is yellow."],
    ["chest", "The pirate hid gold in a chest."],
    ["chair", "Please sit in the chair."],
    ["check", "Check your work again."],
    ["cheese", "I like cheese on my pizza."],
    ["cheek", "Grandma kissed my cheek."],
    ["cheer", "We cheer for our team."],
    ["child", "Each child gets a book."],
    ["chain", "My bike has a chain."],
    ["chalk", "I draw with chalk on the sidewalk."],
    ["much", "Thank you very much."],
    ["such", "It was such a fun day."],
    ["rich", "The king was very rich."],
    ["lunch", "We eat lunch at noon."],
    ["each", "Each kid has a pencil."],
    ["inch", "A worm is one inch long."],
    ["bench", "We sat on the bench in the park."],
    ["punch", "Mom made fruit punch."],
    ["munch", "I munch on crunchy carrots."],
    ["bunch", "I picked a bunch of flowers."],
    ["pinch", "Add a pinch of salt."],
    ["ouch", "Ouch! That hurt my toe."],
    ["couch", "The cat sleeps on the couch."],
    ["coach", "Our coach blows the whistle."],
    ["peach", "A peach is sweet and juicy."],
    ["reach", "I can reach the top shelf."],
    ["teach", "Please teach me to swim."],
  ]),
  ...B("ch", 2, [
    ["chicken", "The chicken lays an egg."],
    ["church", "The church bell rings at noon."],
    ["chocolate", "I love hot chocolate."],
    ["children", "The children play at recess."],
    ["change", "I have change in my pocket."],
    ["chance", "I will give it one more chance."],
    ["charge", "Charge the tablet tonight."],
    ["chase", "The dog will chase the ball."],
    ["cheap", "The toy was cheap."],
    ["cheat", "It is not fair to cheat."],
    ["cherry", "A cherry sits on top."],
    ["chess", "My dad plays chess."],
    ["chew", "Chew your food slowly."],
    ["chief", "The fire chief drives a big truck."],
    ["chill", "Put the juice in the fridge to chill."],
    ["chimney", "Smoke comes out of the chimney."],
    ["chimp", "The chimp swings on the vine."],
    ["chirp", "Birds chirp in the morning."],
    ["chunk", "I ate a chunk of bread."],
    ["chubby", "The baby has chubby cheeks."],
    ["chore", "My chore is to feed the dog."],
    ["chapter", "I read one chapter tonight."],
    ["champ", "My brother is the spelling champ."],
    ["channel", "Change the channel, please."],
    ["cheetah", "A cheetah is the fastest animal."],
    ["checkers", "We play checkers after dinner."],
    ["lunchbox", "I packed my lunchbox."],
    ["speech", "She gave a speech in class."],
    ["search", "Let us search for shells."],
    ["branch", "A bird sat on a branch."],
    ["crunch", "I like the crunch of apples."],
    ["ranch", "Horses live on the ranch."],
    ["sandwich", "I made a cheese sandwich."],
    ["teacher", "My teacher reads us a story."],
    ["perch", "The bird sits on its perch."],
    ["touch", "Do not touch the hot stove."],
    ["porch", "We sit on the porch at night."],
    ["torch", "The camper held a torch."],
    ["march", "The band will march in the parade."],
  ]),
  ...B("ch", 3, [
    ["chopsticks", "I eat noodles with chopsticks."],
    ["chestnut", "A chestnut fell from the tree."],
    ["chuckle", "Dad let out a chuckle."],
    ["champion", "She is the swimming champion."],
    ["challenge", "I accept your challenge."],
    ["chimpanzee", "A chimpanzee is very smart."],
    ["cheerful", "She has a cheerful smile."],
    ["cheddar", "Cheddar is my favorite cheese."],
    ["achieve", "I will achieve my goal."],
    ["purchase", "We will purchase a new tent."],
    ["research", "I did research about whales."],
    ["exchange", "Let us exchange our books."],
    ["approach", "The deer will approach slowly."],
    ["butcher", "The butcher sells meat."],
    ["orchard", "We pick apples in the orchard."],
  ]),
  // ---- ch como k (griego) ----
  ...B("k", 1, [
    ["school", "I ride the bus to school."],
    ["Christmas", "We open presents on Christmas morning."],
    ["ache", "My tummy has an ache."],
    ["echo", "I heard an echo in the cave."],
  ]),
  ...B("k", 2, [
    ["stomach", "My stomach is full."],
    ["chorus", "The chorus sings a happy song."],
    ["scheme", "Tom made a clever scheme."],
    ["chaos", "The room was in chaos."],
    ["mechanic", "The mechanic fixed our car."],
    ["character", "My favorite character is brave."],
    ["chemist", "The chemist mixes liquids in a lab."],
    ["chemical", "That chemical can be dangerous."],
    ["anchor", "The ship dropped its anchor."],
    ["orchid", "An orchid is a pretty flower."],
    ["headache", "Loud noise gives me a headache."],
    ["toothache", "A toothache hurts a lot."],
    ["schedule", "I check my schedule for class."],
    ["chrome", "The bike has shiny chrome."],
    ["monarch", "A monarch butterfly has orange wings."],
  ]),
  ...B("k", 3, [
    ["architect", "An architect draws plans for buildings."],
    ["orchestra", "The orchestra plays at the concert."],
    ["technology", "Tablets are a kind of technology."],
    ["technical", "The robot has a technical problem."],
    ["technique", "She learned a new swimming technique."],
    ["chameleon", "A chameleon can change its color."],
    ["chemistry", "We do experiments in chemistry."],
    ["scholar", "A scholar loves to study."],
    ["chlorine", "The pool has chlorine in it."],
    ["chasm", "A bridge crosses the deep chasm."],
    ["archive", "The library keeps an archive of old photos."],
  ]),
  // ---- ch como sh (francés) ----
  ...B("sh", 1, [
    ["chef", "The chef cooks a big dinner."],
    ["chic", "She wore a chic dress."],
    ["machine", "The washing machine is noisy."],
  ]),
  ...B("sh", 2, [
    ["parachute", "He jumped with a parachute."],
    ["brochure", "We got a brochure about the zoo."],
    ["mustache", "My grandpa has a mustache."],
    ["Chicago", "Chicago is a big city."],
    ["Michigan", "Michigan has many lakes."],
    ["Charlotte", "Charlotte is a spider in my book."],
    ["crochet", "Grandma likes to crochet scarves."],
    ["charade", "A charade is a guessing game."],
  ]),
  ...B("sh", 3, [
    ["chauffeur", "The chauffeur drives the long car."],
    ["champagne", "They toasted with champagne at the wedding."],
    ["chalet", "We stayed in a ski chalet."],
    ["chandelier", "A chandelier hangs from the ceiling."],
    ["chaperone", "A chaperone came on our trip."],
    ["pistachio", "I like pistachio ice cream."],
  ]),
];

const INDICE = new Map(BANCO.map((p) => [p.palabra.toLowerCase(), p]));
export const buscarCh = (w) => INDICE.get(String(w).toLowerCase()) || null;

// La palabra partida en trozos, marcando las "ch" (para pintarlas de color)  [{ texto, ch }]
export function resaltar(palabra) {
  return palabra.split(/(ch)/i).filter(Boolean).map((t) => ({ texto: t, ch: /^ch$/i.test(t) }));
}

// ---------- Progreso de la sección ----------
// pr.ch = { nivel: 1–3 (para escribir), rondas: {sonido, escribe}, estrellas: {sonido, escribe},
//           stats: { sonido: { ch: {t, a}, k, sh }, escribe: { … } } }
// Es opcional dentro del progreso del juego: si falta, se usan estos valores.

export const MODOS = ["sonido", "escribe"];
const ID = SONIDOS.map((s) => s.id);
const entero = (x, d = 0) => (Number.isFinite(x) && x >= 0 ? Math.floor(x) : d);

export function chDe(pr) {
  const c = (pr && pr.ch) || {};
  const out = { nivel: Math.max(1, Math.min(3, entero(c.nivel, 2) || 2)), rondas: {}, estrellas: {}, stats: {} };
  for (const m of MODOS) {
    out.rondas[m] = entero(c.rondas?.[m]);
    out.estrellas[m] = Math.min(3, entero(c.estrellas?.[m]));
    out.stats[m] = {};
    for (const s of ID) out.stats[m][s] = { t: entero(c.stats?.[m]?.[s]?.t), a: entero(c.stats?.[m]?.[s]?.a) };
  }
  return out;
}

// Una respuesta: modo "sonido" (¿cuál suena?) o "escribe" (dictado) de una palabra con el sonido `s`
export function registrarCh(pr, modo, s, ok) {
  const c = chDe(pr), st = c.stats[modo][s];
  c.stats[modo][s] = { t: st.t + 1, a: st.a + (ok ? 1 : 0) };
  return { ...pr, ch: c };
}

// Porcentaje (o null si aún no hay respuestas)
export const pctCh = (pr, modo, s) => {
  const { t, a } = chDe(pr).stats[modo][s];
  return t ? Math.round((100 * a) / t) : null;
};

// Al terminar una ronda: estrellas y, en "escribe", el nivel sube con 8 de 10 y baja con 4 o menos.
// Devuelve { pr, estrellas, nivel, cambio: 1 | -1 | 0 }
export function cerrarRondaCh(pr, modo, aciertos, de = 10) {
  const c = chDe(pr), est = estrellasRonda(aciertos, de);
  c.rondas[modo]++;
  c.estrellas[modo] = Math.max(c.estrellas[modo], est);
  let cambio = 0;
  if (modo === "escribe") {
    if (aciertos >= de * 0.8 && c.nivel < 3) { c.nivel++; cambio = 1; }
    else if (aciertos <= de * 0.4 && c.nivel > 1) { c.nivel--; cambio = -1; }
  }
  return { pr: { ...pr, ch: c }, estrellas: est, nivel: c.nivel, cambio };
}

// ---------- Armar una ronda ----------

// Sorteo con pesos y sin repetir (Efraimidis–Spirakis): los de más peso salen más seguido
function sortear(rnd, lista, k, peso) {
  return lista.map((x) => ({ x, clave: Math.pow(rnd() || 1e-9, 1 / peso(x)) }))
    .sort((a, b) => b.clave - a.clave).slice(0, k).map((e) => e.x);
}

// 10 palabras con los tres sonidos mezclados (4 del que más le cuesta, 3 de cada uno de los otros).
// "escribe" usa palabras hasta su nivel; "sonido" se anima un nivel más (oír el sonido es más fácil que escribirlo).
// Las que falló antes y las de su nivel salen más.
export function armarRondaCh(pr, modo, rnd, cuantas = 10) {
  const c = chDe(pr), tope = Math.min(3, c.nivel + (modo === "sonido" ? 1 : 0));
  // En "sonido" los botones muestran chips / school / chef: esas tres no salen, para no enseñar cómo se escribe la palabra
  const pool = BANCO.filter((p) => p.n <= tope && !(modo === "sonido" && SONIDOS.some((s) => s.como.toLowerCase() === p.palabra.toLowerCase())));
  const fallo = (p) => !!pr?.fallos?.[p.palabra.toLowerCase()];
  const peso = (p) => 1 + (p.n === tope ? 2 : 0) + (fallo(p) ? 4 : 0);
  // el sonido más flojo recibe una palabra de más (con empate, el azar decide)
  const flojo = revolver(rnd, ID).map((s) => ({ s, v: (c.stats[modo][s].a + 1) / (c.stats[modo][s].t + 2) })).sort((a, b) => a.v - b.v)[0].s;
  const base = Math.floor(cuantas / 3), extra = cuantas - base * 3;
  const elegidas = [];
  for (const s of ID) {
    const deste = pool.filter((p) => p.sonido === s);
    elegidas.push(...sortear(rnd, deste, base + (s === flojo ? extra : 0), peso));
  }
  if (elegidas.length < cuantas) {   // faltaron (poco banco en ese nivel): se completa con cualquiera
    const ya = new Set(elegidas.map((p) => p.palabra));
    elegidas.push(...sortear(rnd, pool.filter((p) => !ya.has(p.palabra)), cuantas - elegidas.length, peso));
  }
  return revolver(rnd, elegidas);
}
