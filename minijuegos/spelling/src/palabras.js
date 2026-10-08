// Las listas de palabras, de primero a quinto grado. Cada lista practica un patrón de spelling y cada palabra
// trae una frase corta que la usa (el juego la dice cuando Noelia toca "Frase").
//
// Las primeras listas repasan primer grado (vocales cortas), así Noelia empieza con éxitos y el dominio la sube
// rápido hasta su nivel; las últimas son de tercero a quinto para que siempre tenga a dónde seguir.
// Se evitan palabras que suenan igual a otra (read/red, wind) para que escucharla no sea ambiguo.

const L = (n, nombre, patron, palabras) => ({
  n, nombre, patron,
  palabras: palabras.map(([palabra, frase]) => ({ palabra, frase })),
});

export const LISTAS = [
  L(1, "Short a, short i", "cat, map, pig", [
    ["cat", "The cat is asleep on my bed."],
    ["hat", "I wear a hat when it is sunny."],
    ["map", "We used a map to find the park."],
    ["bag", "Put your lunch in your bag."],
    ["van", "Our van has seven seats."],
    ["ham", "I had a ham sandwich for lunch."],
    ["pig", "The pig rolls in the mud."],
    ["sit", "Please sit next to me."],
    ["big", "An elephant is very big."],
    ["pin", "Mom used a pin to fix my shirt."],
    ["lid", "Put the lid on the box."],
    ["six", "I have six crayons."],
  ]),
  L(2, "Short o, u, e", "dog, sun, bed", [
    ["dog", "My dog likes to run."],
    ["hot", "The soup is too hot."],
    ["box", "The toys are in the box."],
    ["mop", "Dad cleans the floor with a mop."],
    ["sun", "The sun is bright today."],
    ["bus", "We ride the bus to school."],
    ["cup", "I drink milk from a cup."],
    ["run", "I can run very fast."],
    ["bed", "I go to bed at eight."],
    ["red", "A strawberry is red."],
    ["pen", "Write your name with a pen."],
    ["ten", "I have ten fingers."],
  ]),
  L(3, "sh, ch, th, wh, ck", "ship, lunch, duck", [
    ["ship", "The ship sails on the sea."],
    ["fish", "A fish swims in the pond."],
    ["shop", "We went to the shop for bread."],
    ["chin", "He has jam on his chin."],
    ["chip", "Can I have a chip?"],
    ["lunch", "We eat lunch at noon."],
    ["that", "I want that one, please."],
    ["this", "This is my best friend."],
    ["bath", "The baby takes a bath."],
    ["when", "When is your birthday?"],
    ["duck", "The duck says quack."],
    ["back", "I will be right back."],
  ]),
  L(4, "Blends", "frog, stop, jump", [
    ["frog", "The frog jumps into the pond."],
    ["stop", "Stop at the red light."],
    ["flag", "The flag waves in the wind."],
    ["clap", "Clap your hands to the music."],
    ["crab", "A crab walks sideways."],
    ["drum", "He plays the drum in the band."],
    ["swim", "I can swim in the pool."],
    ["plan", "We have a plan for the weekend."],
    ["best", "You are my best friend."],
    ["jump", "Can you jump over the rope?"],
    ["hand", "Raise your hand to ask."],
    ["milk", "I drink milk every morning."],
  ]),
  L(5, "Magic e: a_e, i_e", "cake, bike, five", [
    ["cake", "We ate cake at the party."],
    ["game", "Let's play a game."],
    ["name", "What is your name?"],
    ["gate", "Close the gate behind you."],
    ["made", "I made a card for Mom."],
    ["bike", "I ride my bike to the park."],
    ["kite", "My kite flies high in the sky."],
    ["time", "What time is it?"],
    ["five", "A hand has five fingers."],
    ["ride", "Can I ride the pony?"],
    ["like", "I like apples."],
    ["line", "Please stand in a line."],
  ]),
  L(6, "Magic e: o_e, u_e", "home, rope, cute", [
    ["home", "We go home after school."],
    ["bone", "The dog hid a bone."],
    ["rope", "We jump rope at recess."],
    ["nose", "A clown has a red nose."],
    ["note", "I wrote a note to my teacher."],
    ["cute", "The puppy is so cute."],
    ["mule", "The mule carries the bags."],
    ["tube", "Squeeze the paint out of the tube."],
    ["June", "School ends in June."],
    ["use", "Use a pencil for the test."],
    ["rule", "Our class has a rule: be kind."],
    ["huge", "A whale is huge."],
  ]),
  L(7, "ee, ea", "tree, green, beach", [
    ["tree", "A bird sits in the tree."],
    ["feet", "I have two feet."],
    ["green", "Grass is green."],
    ["sleep", "I sleep in my bed."],
    ["week", "There are seven days in a week."],
    ["seed", "Plant the seed in the dirt."],
    ["eat", "We eat dinner at six."],
    ["seat", "Please take a seat."],
    ["team", "Our team won the game."],
    ["beach", "We play in the sand at the beach."],
    ["sea", "Fish live in the sea."],
    ["leaf", "A leaf fell from the tree."],
  ]),
  L(8, "ai, ay, oa, ow", "rain, play, boat, snow", [
    ["rain", "Take an umbrella for the rain."],
    ["mail", "The mail came today."],
    ["wait", "Please wait for me."],
    ["paint", "I like to paint flowers."],
    ["day", "Have a nice day."],
    ["play", "Can you come out to play?"],
    ["stay", "Stay with me, please."],
    ["boat", "We rode in a boat on the lake."],
    ["road", "Look both ways before you cross the road."],
    ["coat", "Wear your coat, it is cold."],
    ["snow", "The snow is white and cold."],
    ["grow", "Plants grow in the sun."],
  ]),
  L(9, "ar, or, er, ir, ur", "star, horse, bird", [
    ["car", "Dad washes the car."],
    ["star", "I see a star in the sky."],
    ["park", "We play at the park."],
    ["farm", "Cows live on a farm."],
    ["corn", "We ate corn for dinner."],
    ["fork", "Eat your salad with a fork."],
    ["horse", "The horse runs in the field."],
    ["bird", "The bird sings a song."],
    ["girl", "The girl reads a book."],
    ["her", "I gave her a hug."],
    ["turn", "It is your turn."],
    ["nurse", "The nurse helps sick people."],
  ]),
  L(10, "Sight words", "said, because, friend", [
    ["said", "She said hello to me."],
    ["does", "Does your dog like to swim?"],
    ["were", "We were at the zoo."],
    ["what", "What is your favorite color?"],
    ["because", "I am happy because it is Friday."],
    ["friend", "My friend lives next door."],
    ["could", "Could you help me, please?"],
    ["would", "Would you like some juice?"],
    ["people", "Many people came to the show."],
    ["again", "Let's play that game again."],
    ["many", "How many cookies are left?"],
    ["very", "I am very hungry."],
  ]),
  L(11, "oo, ou, ow, oi, oy", "moon, house, coin, boy", [
    ["moon", "The moon is full tonight."],
    ["food", "Pizza is my favorite food."],
    ["book", "I read a book before bed."],
    ["look", "Look at the rainbow!"],
    ["out", "Let's go out and play."],
    ["house", "My house has a red door."],
    ["cloud", "That cloud looks like a bunny."],
    ["cow", "The cow eats grass."],
    ["down", "Sit down, please."],
    ["coin", "I found a coin on the floor."],
    ["boy", "The boy kicks the ball."],
    ["toy", "My favorite toy is a robot."],
  ]),
  L(12, "-ing, -ed", "running, jumped, making", [
    ["running", "The dog is running in the yard."],
    ["swimming", "We went swimming in the lake."],
    ["jumped", "The cat jumped on the table."],
    ["played", "We played tag at recess."],
    ["hopped", "The bunny hopped away."],
    ["making", "Grandma is making soup."],
    ["riding", "I am riding my scooter."],
    ["stopped", "The rain stopped."],
    ["sitting", "The bird is sitting on the fence."],
    ["looked", "I looked under the bed."],
    ["baked", "We baked cookies today."],
    ["wanted", "I wanted a puppy."],
  ]),
  L(13, "Two syllables", "birthday, rabbit, happy", [
    ["birthday", "Today is my birthday!"],
    ["sunshine", "The sunshine feels warm."],
    ["rainbow", "A rainbow has many colors."],
    ["pancake", "I want a pancake with syrup."],
    ["basket", "Put the apples in the basket."],
    ["rabbit", "The rabbit has long ears."],
    ["kitten", "The kitten plays with yarn."],
    ["dinner", "Dinner is ready."],
    ["happy", "I feel happy today."],
    ["funny", "That joke is funny."],
    ["yellow", "A banana is yellow."],
    ["window", "Open the window, please."],
  ]),
  L(14, "Soft c and g, kn, wr, igh, -le", "city, knee, light, apple", [
    ["city", "We live in a big city."],
    ["nice", "It is nice to meet you."],
    ["giant", "The giant lives in a castle."],
    ["page", "Turn the page."],
    ["knee", "I hurt my knee."],
    ["know", "I know the answer."],
    ["write", "I can write my name."],
    ["light", "Turn on the light."],
    ["night", "Owls are awake at night."],
    ["little", "The mouse is little."],
    ["apple", "An apple a day is good for you."],
    ["table", "Set the table for dinner."],
  ]),
  L(15, "Third and fourth grade", "beautiful, believe, enough", [
    ["animal", "My favorite animal is the panda."],
    ["family", "My family eats dinner together."],
    ["beautiful", "The flowers are beautiful."],
    ["different", "Every snowflake is different."],
    ["important", "It is important to be kind."],
    ["together", "Let's work together."],
    ["answer", "Raise your hand to answer."],
    ["believe", "I believe you can do it."],
    ["piece", "Can I have a piece of cake?"],
    ["enough", "Do we have enough chairs?"],
    ["laugh", "Jokes make me laugh."],
    ["through", "The train goes through the tunnel."],
  ]),
  L(16, "Champion words", "Wednesday, library, necessary", [
    ["Wednesday", "We have art class on Wednesday."],
    ["February", "February is the shortest month."],
    ["library", "We borrow books from the library."],
    ["science", "We grow plants in science class."],
    ["question", "Can I ask a question?"],
    ["island", "The island is in the middle of the sea."],
    ["tomorrow", "Tomorrow we go to the zoo."],
    ["necessary", "Sleep is necessary to grow."],
    ["separate", "Separate the red and blue blocks."],
    ["calendar", "Mark the date on the calendar."],
    ["restaurant", "We ate tacos at a restaurant."],
    ["favorite", "Blue is my favorite color."],
  ]),
];

export const lista = (n) => LISTAS[Math.max(1, Math.min(LISTAS.length, n)) - 1];

// Las tres etapas de cada lista, de la más fácil a la más difícil.
// ventana: cuántas respuestas recientes cuentan; necesita: cuántas de ellas bien para dominarla.
export const ETAPAS = [
  { id: "escoge", nombre: "Escoge", que: "Escoge la palabra bien escrita", ventana: 10, necesita: 9 },
  { id: "arma", nombre: "Arma", que: "Arma la palabra con las letras", ventana: 10, necesita: 9 },
  { id: "escribe", nombre: "Escribe", que: "Escribe la palabra", ventana: 20, necesita: 18 },
];

// Un "paso" es una etapa de una lista: 0 = lista 1 escoge, 1 = lista 1 arma, 2 = lista 1 escribe, 3 = lista 2 escoge…
export const PASOS = LISTAS.length * ETAPAS.length;
export const paso = (i) => {
  const k = Math.max(0, Math.min(PASOS - 1, i | 0));
  return { i: k, lista: Math.floor(k / ETAPAS.length) + 1, etapa: ETAPAS[k % ETAPAS.length] };
};
export const pasoDe = (n, etapaId) => (n - 1) * ETAPAS.length + ETAPAS.findIndex((e) => e.id === etapaId);

// Buscar una palabra por su texto (para fallos y estadísticas)
const INDICE = new Map(LISTAS.flatMap((l) => l.palabras.map((p) => [p.palabra.toLowerCase(), { ...p, lista: l.n }])));
export const buscar = (w) => INDICE.get(String(w).toLowerCase()) || null;
export const TODAS = [...INDICE.keys()];

// La frase con un hueco donde va la palabra (para leerla sin ver cómo se escribe)
export function conHueco(frase, palabra, hueco = "_____") {
  return frase.replace(new RegExp(`\\b${palabra}\\b`, "i"), hueco);
}

// La frase partida en palabras, marcando cuál es la de spelling (para el detective)
export function partir(frase, palabra) {
  const re = new RegExp(`^(\\W*)(${palabra})(\\W*)$`, "i");
  let ya = false;
  return frase.split(" ").map((t) => {
    const m = !ya && t.match(re);
    if (m) { ya = true; return { antes: m[1], texto: m[2], despues: m[3], es: true }; }
    return { antes: "", texto: t, despues: "", es: false };
  });
}
