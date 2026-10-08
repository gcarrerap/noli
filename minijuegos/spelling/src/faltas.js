// Faltas de ortografía típicas, para que las opciones incorrectas enseñen algo: la e mágica que falta, la
// consonante doble, "ee" escrito como "i" (el error clásico de quien habla español), letras mudas…
// Nunca se ofrece como incorrecta una palabra que existe (kit para kite) ni una que suena igual (see para sea):
// escuchando no habría forma de saber cuál es.
import { TODAS } from "./palabras.js";
import { revolver } from "./rng.js";

// Palabras reales que las reglas podrían fabricar; se descartan como opción incorrecta.
const REALES = new Set([...TODAS, ...`
a am an and ant any are art as at ate bad ban bat be bee beech beg bet bid bin bit bite bot bud but buy by
cab can cane cap cape cent chap chat chop chin chip cite clod cold con cop cope cot cub cud cure cut dab dad
dam date den dew did die dig dim dime din dine dip do doe don done dose dot dug ear eel end feat fed fee fin
fine fir fit for form fort four fun fur gait gal gap gas get got grin gum gut had hate he heat hem hen hid hide
him hip his hit hop hope hose hug hum hut if in is it its jam jet jog jug kid kin kit lap led let lice lick
lip lit log lot mad maid man mane mat mate me meat men met mid mix mob mope mud mug nap net new nit no nod
nor not now nut of on one or our pad pal pan pane pant pat pea peace peg perk pet pie pine pit plaid plane pod
pop pork pot pub pun pup rag ran rat rate red reed rein rid rim rip rite rob rod rot rub rug rune rut sad
sat saw see set sex shin shine shod shot side sin site so sob sod son spin step sum tab tag tan tap tar tea
teem ten tern the then tie tin tip to toe ton too top tot tub tug two up us van vane vat vest vet wag wan
war was wax we web wed weak wet who whom win wit won wood yam yes yet zip
abed amid bead beam bean bear beat beet bell belt bend bent bill bird boar bode bold bolt bond bonk booth
boot bore born both bout bow bowl bud burn bust cart chore cloth clot coal cod coil cold colt cone cord
core corn cot coy creek crow cube curb curd dame dare dart dear deed deep dent dew dial diner dock does dome
dorm dote dove drew due dune dusk fake fame far fare fat fear feed feel fern fill fist flap flat flea flee
flog fold folk fond foot fore fowl fume gale gel germ goal goat gore gown grim grit grub guy hail hair hale
harm hart haul hay heal heap heard heed heel herd here hire hoe hold hole hood hoof hook hoop hoot hoped hum
hurt jade jar jean jeep keen kin kind knot lack lad lain lake lame lane lard last late lead leak lean lied
lime limb link lint load loaf loan lock loin lone loom loop lore lose loud low lube lug lump lure lust main
male mall mane mare mark mart mash mast meal mean meek mere mesh mice mild mile mill mine mink mint mist moan
moat mold mole moo mood moose more moss most moth mow muse must neat neck need nod noon nor nun oak oar oat
odd ode oil old ore owe own pail pain pair pale palm pane park part pave paw peak peal pear peat peek peel
peep pest pick pile pill pint pity plaid play plea plod plot plow ploy plum pole poll pond pony pool poor
pose pour pout pray prey purr race rack raid raise rake ram rash raw ray reach ream rear rent rest rice rich
ripe rise road roam roar robe rode role roll roof rook room root rose row rude ruin rung rush rust sack sage
said sail sake sale salt same sane seal seam sear seen self sell send sent shed shim shoe shook shop shore
shun shut sigh silk sill sing sip sire siting slap sled slid slim slip slit slob slop slot slum snap snob
snot soap sock soil sold sole some song soon soot sore sort soul soup sour sow soy spa spat sped spot spun
stab stag star stem stew stir stun sub sue suit sung sunk sure swam swan tail take tale tall tame tape tart
teal tear teen tell tend tent than that them thin thud thug tick tide tile till tilt time tint tire toad tock
told toll tone tool toot tore torn tote tour town toy trap tray tree trim trip trod true tuba tuck tuna tune
turf twin type vain vary vat veal veer verb very vibe vile vine void vole vow wade wail wake wall wane ward
ware warm wart wave weed weep weld well went wept were west what when whim whip white whom wick wide wife
wild will wilt wind wine wing wink wipe wire wise wish woke wolf wont word wore work worn wove wrap yard yarn
yawn year yell yelp yoke your yule
backed baker bated beech bored cater chased coder diner dinner fated hated hoped hopped later liter lighter
mated miner nicer nite planed pined pocked rated ridded ridding riper rite rote ruled sated sited siting taped
tamed threw thru tiled timed toned waded wanted wiled wined calender
sheep jane mode bane rad bog dram clop rape
fete writ stare fiend payed mewl coot wold tarn wright
whir dawn caw bay norse setting waned lien vag tat dis frag sic sics hint seen deem peep
`.trim().split(/\s+/)]);

// Por si alguna regla fabrica algo feo: nunca se enseña
for (const w of "ass butt crap cum damn dick die fart fuc fuck fuk hell hoe kill nazi pee piss poop porn rape sex shit slut tit tits vag".split(" ")) REALES.add(w);

// Palabras que suenan igual a otra: la otra no puede ser opción
const HOMOFONOS = {
  sea: ["see"], week: ["weak"], mail: ["male"], made: ["maid"], road: ["rode", "rowed"], know: ["no"], night: ["knight"],
  write: ["right", "rite"], piece: ["peace"], would: ["wood"], through: ["threw"], wait: ["weight"], rain: ["rein", "reign"],
  eat: [], seat: [], team: ["teem"], her: [], nose: ["knows"], red: ["read"], sun: ["son"], four: ["for"], one: ["won"],
  tail: ["tale"], plane: ["plain"], knee: ["nee"], coat: ["cote"], cow: [], hour: ["our"],
};
for (const ws of Object.values(HOMOFONOS)) for (const w of ws) REALES.add(w);

export const esReal = (w) => REALES.has(w.toLowerCase());

// Las faltas famosas de las palabras difíciles (lo que de verdad escriben los niños)
const CLASICAS = {
  because: ["becuase", "becaus", "becuz"], friend: ["freind", "frend", "frien"], people: ["peeple", "pepole", "peopel"],
  said: ["sed", "sayd", "siad"], does: ["dus", "duz", "doez"], were: ["wer", "wher", "wure"], what: ["wat", "whut", "wath"],
  could: ["coud", "culd", "cowld"], would: ["woud", "wuld", "whould"], again: ["agen", "agin", "agian"],
  many: ["meny", "mani", "menny"], very: ["verry", "veri", "bery"], beautiful: ["beutiful", "beautifull", "butiful"],
  different: ["diffrent", "diferent", "differant"], important: ["importent", "inportant", "importand"],
  together: ["togather", "togeter", "toghether"], answer: ["anser", "answr", "ansewr"], believe: ["beleive", "belive", "beleave"],
  piece: ["peice", "pece", "peace"], enough: ["enuf", "enouf", "enogh"], laugh: ["laf", "laff", "lauf"],
  through: ["thru", "throo", "throgh"], animal: ["animul", "aminal", "animle"], family: ["famly", "familly", "fammily"],
  wednesday: ["wensday", "wendsday", "wednsday"], february: ["febuary", "feburary", "februrary"], library: ["libary", "liberry", "librery"],
  science: ["sience", "sciense", "scince"], question: ["questoin", "kwestion", "qestion"], island: ["iland", "ailand", "islend"],
  tomorrow: ["tommorow", "tomorow", "tommorrow"], necessary: ["neccessary", "necesary", "nessesary"],
  separate: ["seperate", "seprate", "separete"], calendar: ["calander", "calandar", "calendur"],
  made: ["maed", "maide"], turn: ["turne", "tirne"], ride: ["ried", "ryed"], feet: ["fiit", "feete"], farm: ["farme", "fharm"],
  restaurant: ["resturant", "restaraunt", "restrant"], favorite: ["favrite", "faverite", "favorit"],
};

// Reglas por patrón: [expresión, reemplazos, motivo]. Cada coincidencia da una variante por reemplazo.
const V = "aeiou";
const REGLAS = [
  [/ee/g, ["i", "ea", "e"], "El sonido largo de la e aquí se escribe ee."],
  [/ea/g, ["ee", "i", "e"], "El sonido largo de la e aquí se escribe ea."],
  [/ai/g, ["ay", "ei", "a"], "Aquí la a larga se escribe ai."],
  [/ay$/g, ["ai", "ey", "ei"], "Al final de la palabra la a larga se escribe ay."],
  [/oa/g, ["ow", "o", "ou"], "Aquí la o larga se escribe oa."],
  [/ow/g, ["oa", "ou", "o"], "Este sonido aquí se escribe ow."],
  [/ou/g, ["ow", "u", "o"], "Este sonido aquí se escribe ou."],
  [/oo/g, ["u", "ou", "o"], "Este sonido se escribe con dos o: oo."],
  [/ai(?=[^aeiou]$)/g, ["a$e"], "Aquí la a larga se escribe ai."],
  [/oa(?=[^aeiou]$)/g, ["o$e"], "Aquí la o larga se escribe oa."],
  [/ee(?=[^aeiou]$)/g, ["e$e"], "Aquí la e larga se escribe ee."],
  [/(?<=[rln])k$/g, ["ck"], "Después de una consonante no se escribe ck, solo k."],
  [/oi/g, ["oy"], "En medio de la palabra se escribe oi."],
  [/oy$/g, ["oi"], "Al final de la palabra se escribe oy."],
  [/igh/g, ["i", "ie", "ig"], "La i larga aquí se escribe igh (la gh no suena)."],
  [/sh/g, ["ch", "s"], "Este sonido es sh, como cuando pides silencio: shhh."],
  [/ch/g, ["sh", "c"], "Este sonido es ch, como en chocolate."],
  [/th/g, ["d", "t", "f"], "Este sonido es th: la lengua entre los dientes."],
  [/wh/g, ["w", "hw"], "Empieza con wh: la h no suena pero se escribe."],
  [/ck/g, ["k", "c", "kc"], "Después de una vocal corta se escribe ck."],
  [/^kn/g, ["n"], "La k del principio no suena, pero se escribe: kn."],
  [/^wr/g, ["r"], "La w del principio no suena, pero se escribe: wr."],
  [/le$/g, ["el", "ul"], "Al final se escribe le."],
  [/er/g, ["ur", "ir"], "Aquí se escribe er."],
  [/ir/g, ["er", "ur"], "Aquí se escribe ir."],
  [/ur/g, ["er", "ir"], "Aquí se escribe ur."],
  [/ar/g, ["or", "er"], "Aquí se escribe ar."],
  [/or/g, ["ar", "er"], "Aquí se escribe or."],
  [/c(?=[eiy])/g, ["s"], "Aquí la c suena como s porque le sigue una e, i o y."],
  [/c(?![eiyhk])/g, ["k"], "Aquí se escribe con c."],
  [/k(?!n)/g, ["c"], "Aquí se escribe con k."],
  [/g(?=[ei])/g, ["j"], "Aquí la g suena como j porque le sigue una e o i."],
  [/s(?=[ei])/g, ["c"], "Aquí es con s."],
  [/^s(?=[ctpkwlmn])/g, ["es"], "En inglés no hay e antes de la s: empieza directo con s."],
  [/b/g, ["v"], "Es con b (de burro)."],
  [/v/g, ["b"], "Es con v (de vaca)."],
  [/y$/g, ["i", "ey", "ie"], "Al final de la palabra el sonido de i se escribe y."],
  [/ie/g, ["ei", "ee"], "Aquí va primero la i y luego la e."],
  [/(?<=\w{3})ed$/g, ["t", "d"], "El pasado se escribe con -ed aunque suene como t o d."],
  [/x/g, ["ks", "cs"], "Este sonido se escribe con x."],
  [/qu/g, ["kw", "cu"], "Este sonido se escribe qu."],
];

const MOTIVO_E_MAGICA = "La e mágica del final no suena, pero hace que la vocal diga su nombre.";
const MOTIVO_SIN_E = "Esta palabra no lleva e al final.";
const MOTIVO_DOBLE = "Esta palabra lleva la consonante doble.";
const MOTIVO_SENCILLA = "Esta palabra lleva solo una de esas letras.";
const MOTIVO_VOCAL = "Escucha bien la vocal de en medio.";

const esV = (c) => !!c && c.length === 1 && V.includes(c);
const esC = (c) => c && /[a-z]/.test(c) && !esV(c);

// Todas las variantes de una palabra (en minúsculas), por niveles: 0 = faltas famosas, 1 = reglas de patrón,
// 2 = e mágica, dobles y vocales, 3 = letra que falta o letras al revés. [{ texto, nivel, motivo }]
export function variantes(palabra) {
  const w = palabra.toLowerCase();
  const out = [];
  const add = (texto, nivel, motivo = null) => out.push({ texto, nivel, motivo });

  for (const t of CLASICAS[w] || []) add(t, 0);

  for (const [re, reemplazos, motivo] of REGLAS) {
    for (const m of w.matchAll(re)) for (const r of reemplazos) {
      const resto = w.slice(m.index + m[0].length);
      // "a$e": la vocal, la consonante que sigue y una e al final (rain → rane)
      add(r.includes("$") ? w.slice(0, m.index) + r.replace("$", resto[0]) + resto.slice(1) : w.slice(0, m.index) + r + resto, 1, motivo);
    }
  }

  // e mágica: consonante + vocal + consonante + e al final
  if (w.length >= 3 && w.endsWith("e") && esC(w.at(-2)) && esV(w.at(-3))) add(w.slice(0, -1), 2, MOTIVO_E_MAGICA);
  // La vocal larga con otro patrón en lugar de la e mágica (cake → caik, kite → kyte, home → hoam, rule → rool)
  const LARGA = { a: ["ai", "ay"], i: w.at(-2) === "t" ? ["y", "igh"] : ["y"], o: ["oa", "ow"], u: ["oo", "ew"], e: ["ee"] };
  if (w.length >= 4 && w.endsWith("e") && esC(w.at(-2)) && esV(w.at(-3)) && !esV(w.at(-4)))
    for (const r of LARGA[w.at(-3)]) add(w.slice(0, -3) + r + w.at(-2) + (r === "y" ? "e" : ""), 1, MOTIVO_E_MAGICA);
  // e de más: palabra corta con vocal corta (cat → cate)
  if (w.length <= 5 && esC(w.at(-1)) && esV(w.at(-2)) && !esV(w.at(-3) || "")) add(w + "e", 2, MOTIVO_SIN_E);
  for (let i = 1; i < w.length; i++) {
    // Doble → sencilla (rabbit → rabit)
    if (w[i] === w[i - 1] && esC(w[i])) add(w.slice(0, i) + w.slice(i + 1), 2, MOTIVO_DOBLE);
    // Sencilla → doble entre vocales (making → makking); no al final (cat → catt no enseña nada)
    if (esC(w[i]) && esV(w[i - 1]) && esV(w[i + 1] || "") && !(i + 1 === w.length - 1 && w[i + 1] === "e") && w[i] !== w[i + 1] && !"wxyh".includes(w[i])) add(w.slice(0, i + 1) + w.slice(i), 2, MOTIVO_SENCILLA);
  }
  // Vocales que se confunden en español (cortas: a/e, e/i, i/e, o/a, u/o)
  const CAMBIO = { a: ["e", "o"], e: ["i", "a"], i: ["e"], o: ["a", "u"], u: ["o", "a"] };
  for (let i = 0; i < w.length; i++) {
    if (esV(w[i]) && !esV(w[i - 1] || "") && !esV(w[i + 1] || "") && !(i === w.length - 1 && w[i] === "e")) for (const c of CAMBIO[w[i]]) add(w.slice(0, i) + c + w.slice(i + 1), 2, MOTIVO_VOCAL);
  }
  // La i corta escrita como "ee" (sit → seet): en español la i siempre suena larga
  for (let i = 1; i < w.length - 1; i++) if (w[i] === "i" && esC(w[i - 1]) && esC(w[i + 1]) && !(w[i + 1] === "g" && w[i + 2] === "h") && !(i + 2 === w.length - 1 && w.at(-1) === "e")) add(w.slice(0, i) + "ee" + w.slice(i + 1), 2, "Esta i es corta; no se escribe ee.");
  // Letra que falta (solo en palabras largas) y dos letras al revés (no en las cortas: ahí no es una falta real)
  if (w.length >= 6) for (let i = 1; i < w.length - 1; i++) add(w.slice(0, i) + w.slice(i + 1), 3);
  if (w.length >= 5) for (let i = 1; i < w.length - 1; i++) if (w[i] !== w[i + 1]) add(w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2), 3);
  // Último recurso en palabras cortas: la consonante final doble (pin → pinn)
  if (w.length <= 4 && esC(w.at(-1)) && w.at(-1) !== w.at(-2) && !"xyw".includes(w.at(-1))) add(w + w.at(-1), 3, "Esta palabra termina con una sola " + w.at(-1) + ".");
  return out;
}

const capitalizar = (palabra, t) => (palabra[0] === palabra[0].toUpperCase() && palabra[0] !== palabra[0].toLowerCase() ? t[0].toUpperCase() + t.slice(1) : t);

// Las faltas que sí sirven como opción: distintas a la palabra, solo letras, que no existan ni suenen igual
export function faltas(palabra) {
  const w = palabra.toLowerCase(), vistas = new Set([w]);
  const prohibidas = new Set(HOMOFONOS[w] || []);
  const buenas = [];
  for (const v of variantes(w)) {
    if (vistas.has(v.texto) || !/^[a-z]{2,}$/.test(v.texto) || esReal(v.texto) || prohibidas.has(v.texto)) continue;
    vistas.add(v.texto);
    buenas.push({ ...v, texto: capitalizar(palabra, v.texto) });
  }
  return buenas;
}

// Opciones para "Escoge": la correcta y (cuantas − 1) faltas, prefiriendo las más instructivas, revueltas.
// [{ texto, correcta, motivo }]
export function opciones(palabra, rnd, cuantas = 4) {
  const porNivel = [0, 1, 2, 3].map((n) => revolver(rnd, faltas(palabra).filter((f) => f.nivel === n)));
  const malas = [];
  // Primero una de cada nivel útil (variedad), luego lo que falte en orden
  for (const grupo of porNivel) if (grupo.length && malas.length < cuantas - 1) malas.push(grupo.shift());
  for (const grupo of porNivel) while (grupo.length && malas.length < cuantas - 1) malas.push(grupo.shift());
  return revolver(rnd, [{ texto: palabra, correcta: true, motivo: null }, ...malas.map((m) => ({ texto: m.texto, correcta: false, motivo: m.motivo }))]);
}

// Letras para "Arma": las de la palabra más `extras` que no están en ella (sacadas de sus faltas típicas,
// para que la trampa sea la de verdad: la i de "grin", la k de "kake"). Revueltas y nunca en el orden correcto.
export function letrasParaArmar(palabra, rnd, extras = 1) {
  const w = palabra.toLowerCase();
  const tiene = new Set(w);
  const candidatas = [];
  for (const f of faltas(w)) for (const c of f.texto.toLowerCase()) if (!tiene.has(c) && !candidatas.includes(c)) candidatas.push(c);
  for (const c of "eaiouslt") if (!tiene.has(c) && !candidatas.includes(c)) candidatas.push(c);
  const letras = [...w, ...revolver(rnd, candidatas.slice(0, 4)).slice(0, extras)];
  let r = revolver(rnd, letras);
  for (let k = 0; k < 10 && r.slice(0, w.length).join("") === w; k++) r = revolver(rnd, letras);
  return r;
}

// Compara lo que escribió con la palabra: cada letra de la palabra con ok = estaba en su lugar.
// Usa la subsecuencia común más larga, así "runing" marca solo la n que faltó.
export function diferencias(palabra, intento) {
  const a = palabra.toLowerCase(), b = String(intento).toLowerCase();
  const T = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--)
    T[i][j] = a[i] === b[j] ? T[i + 1][j + 1] + 1 : Math.max(T[i + 1][j], T[i][j + 1]);
  const marcas = [];
  let i = 0, j = 0;
  while (i < a.length) {
    if (j < b.length && a[i] === b[j]) { marcas.push({ letra: palabra[i], ok: true }); i++; j++; }
    else if (j < b.length && T[i][j + 1] >= T[i + 1][j]) j++;
    else { marcas.push({ letra: palabra[i], ok: false }); i++; }
  }
  return marcas;
}

export const igual = (palabra, intento) => palabra.toLowerCase() === String(intento).trim().toLowerCase();
