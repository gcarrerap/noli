#!/usr/bin/env python3
"""Escribe libros/halloween/paginas.json: un prompt por página (99) + la portada + hojas de mamá y papá (#123).

Lo usa Petra para generar el arte (una ilustración por página). La escena de cada página está escrita a mano aquí a
partir del texto; el estilo y la descripción de cada personaje salen de personajes.json, así que si cambia un
personaje basta con volver a correr este script:

    python3 minijuegos/biblioteca/herramientas/paginas_halloween.py
"""
import json
from pathlib import Path

LIBRO = Path(__file__).resolve().parent.parent / "libros" / "halloween"

# Cómo va vestida Mari en cada escena (los demás siempre igual, salvo los disfraces de Halloween)
MARI = {
    "hoodie": "in her mustard-yellow hoodie with a small rocket patch, dark teal leggings and white sneakers",
    "hoodie_casco": "in her mustard-yellow hoodie, dark teal leggings and white sneakers, wearing her homemade cardboard-box space helmet",
    "mochila": "in her mustard-yellow hoodie, dark teal leggings and white sneakers, with a teal backpack",
    "pijama": "in blue-and-cream plaid pajamas",
    "pijama_botas": "in blue-and-cream plaid pajamas, red rain boots and her homemade cardboard-box space helmet",
    "astro": ("in her homemade astronaut costume: the silver cardboard-box helmet covered in uneven duct tape and a white "
              "hoodie (a hoodie, not a jumpsuit) with hand-drawn star and planet patches, dark teal leggings and white sneakers"),
    "mayor": "one year older, in her mustard-yellow hoodie and dark teal leggings",
}
EXTRA = {
    "mama": ("Mari's mom, a woman in her thirties with warm tan skin, dark brown hair in a messy bun, a red knit sweater "
             "and blue jeans"),
    "papa": ("Mari's dad, a friendly man in his thirties with warm brown skin, short dark hair, a short neat beard, "
             "a green flannel shirt and jeans"),
}
# ---------- Continuidad (#123: la primera entrega de Petra cambió la hora del día, el casco y puso brillos verdes) ----------
CASCO = ("Her space helmet is always the same homemade one: a plain cardboard box covered with uneven strips of silver duct "
         "tape, one big round hole for her face and two small air holes on the sides; it has no lights, no buttons, no "
         "screens, no stickers and it never glows.")
VERDE = ("Only alien things glow lime green: Zib's antenna bulbs, the pumpkin spaceship and the glow-seeds. Nothing else "
         "glows green or cyan: no green lanterns, no green fireflies, no green streaks or aurora in the sky, no gadgets.")
# Entrega 2 (#131): a Zib le salieron 2 antenas en 3 páginas y apareció una segunda "nave" de fondo
ZIB_ANTENAS = ("Zib has exactly THREE antennae on top of its head (one on the left, one in the middle, one on the right), "
               "each a thin spring with one glowing bulb; never two, never four. Zib's body is an upright jelly bean, "
               "taller than wide, never lying sideways.")
UNA_NAVE = ("There is only one spaceship in the whole story, the pumpkin spaceship: no other pods, vehicles, robots, "
            "machines or sci-fi gadgets anywhere in the scene (also not in the garage or the background).")
LUNA_ANTES = ("If the moon is visible it is a waxing gibbous moon, almost full with a small dark sliver missing on one side "
              "(never a crescent, never completely full), because Halloween has not arrived yet.")
LUNA_HALLOWEEN = "If the moon is visible it is a big, completely round full moon (it is Halloween night)."

# Hora del día de cada página (lo que más se le movió a Petra). Clave: id de página; si no está, se toma la del capítulo.
MOMENTO_CAP = {1: "evening", 2: "a bright sunny morning", 3: "a bright sunny day", 4: "late afternoon", 5: "a bright sunny day",
               6: "early morning", 7: "night", 8: "evening, indoors", 9: "a rainy afternoon", 10: "night", 11: "night", 12: "night"}
MOMENTO = {
    "c01-p01": "evening, indoors, dark blue sky in the window", "c01-p02": "evening, indoors", "c01-p03": "dusk, indoors",
    "c01-p04": "night", "c01-p05": "night", "c01-p06": "night", "c01-p07": "night",
    "c01-p08": "a bright sunny morning with a clear blue sky (daytime, not night)",
    "c01-p09": "a bright sunny morning with a clear blue sky (daytime, not night)",
    "c01-p10": "a bright sunny morning with a clear blue sky (daytime, not night)",
    "c03-p09": "late afternoon", "c03-p10": "late afternoon",
    "c04-p04": "sunset, pink and orange sky", "c04-p05": "dusk", "c04-p06": "dusk", "c04-p07": "evening, indoors",
    "c04-p08": "evening, indoors", "c04-p09": "evening, indoors", "c04-p10": "evening, indoors", "c04-p11": "twilight",
    "c04-p12": "night with the first stars",
    "c05-p07": "night",
    "c06-p01": "very early morning before sunrise, soft blue light", "c06-p07": "morning",
    "c07-p07": "night",
    "c08-p08": "rainy night",
    "c09-p04": "evening after the rain", "c09-p05": "night", "c09-p06": "night", "c09-p07": "night", "c09-p08": "night",
    "c10-p01": "sunset", "c10-p02": "sunset with the full moon rising",
    "c12-p06": "an autumn sunset one year later",
}
# Detalles de una página que el dibujo no debe adelantar
EXTRA_PAGINA = {
    "c01-p01": "Nothing in the kitchen glows except warm lamps.",
    "c01-p02": "She wears white sneakers (no boots).",
    "c01-p08": "The pumpkin spaceship is closed and its small round window is dark (it does not glow yet).",
    "c01-p09": "The small round window on the pumpkin is dark and does not glow yet.",
}

LEO_CABALLERO = " Leo is dressed as a knight: a silver foil helmet and a round cardboard shield painted with an orange pumpkin."
PEPPER_ALAS = " Pepper wears tiny purple felt bat wings on her back."

# (id, personajes, ropa de Mari, escena)
P = [
 # ---------- Capítulo 1 ----------
 ("c01-p01", ["mari", "pepper"], "hoodie",
  "Evening in a cozy family kitchen decorated for Halloween (paper bats on the window, a garland of paper pumpkins). Mari "
  "sits at the wooden table with a cardboard box, a roll of silver duct tape and scissors, happily taping her space "
  "helmet. Pepper has just jumped off a chair at the snip of the scissors and is diving under the table, fur puffed, comic."),
 ("c01-p02", ["mari", "pepper"], "hoodie_casco",
  "By the front door: Mari wears her finished cardboard helmet, a little too big and tilted, and admires herself in a tall "
  "mirror, posing like an astronaut with one hand raised. Pepper peeks out grumpily from under the table. An empty candy "
  "bowl waits by the door and orange lights glow through the window."),
 ("c01-p03", ["mari", "abuela"], "hoodie_casco",
  "The warm kitchen at dusk. Abuela pours cinnamon tea from a clay pot and smiles at Mari, who holds her cardboard helmet "
  "under her arm. Through the back window you can see the garden full of pumpkins, small ones and one as big as a chair, "
  "on brown autumn vines."),
 ("c01-p04", ["mari", "abuela"], "hoodie_casco",
  "Night. Mari and Abuela sit together on the wooden back steps, Abuela with a warm cup of tea and her turquoise rebozo, "
  "pointing up at a deep-blue sky full of stars. Mari looks up in wonder. The pumpkin patch rests in the dark garden below; "
  "warm porch light."),
 ("c01-p05", ["mari", "abuela"], "hoodie_casco",
  "Same back steps at night, closer view. A big almost-full moon (a waxing gibbous with a thin sliver missing, like a "
  "cookie with a little bite gone) rises over the trees. Abuela holds a small flashlight up to explain how the sun lights "
  "the moon; Mari smiles, fascinated."),
 ("c01-p06", ["mari", "abuela"], "hoodie_casco",
  "Wide night view of the backyard: a bright lime-green streak of light curves down across the starry sky and dives into "
  "the pumpkin patch behind the fence. Mari points up in surprise, her helmet tipping. Abuela, on the steps, is looking "
  "down at her tea and has not seen it."),
 ("c01-p07", ["mari"], "pijama",
  "Night in Mari's small bedroom: she kneels on her bed in plaid pajamas, hands and nose against the window, looking out at "
  "the dark garden and the quiet pumpkins under the moon. Her cardboard helmet sits on the nightstand next to a little lamp."),
 ("c01-p08", ["mari", "pepper"], "pijama_botas",
  "Bright morning in the pumpkin patch. Mari walks between the pumpkins listening carefully, one hand behind her ear. By "
  "the fence stands one especially round, smooth, shiny orange pumpkin. Pepper follows far behind, slowly and suspiciously."),
 ("c01-p09", ["mari", "pepper", "nave"], "pijama_botas",
  "Close-up: Mari kneels with her ear pressed against the big round pumpkin by the fence (the pumpkin spaceship, still "
  "closed). A thin seam runs around its middle and its stem is silver metal. Pepper hides behind a green watering can, only "
  "her yellow eyes showing."),
 ("c01-p10", ["mari", "nave"], "pijama_botas",
  "Mari has turned to walk back to the house, but behind her a small round window on the side of the pumpkin glows bright "
  "lime green, blinking at her. Mari looks back over her shoulder with wide eyes. Morning light, cozy, a little magical."),
 # ---------- Capítulo 2 ----------
 ("c02-p01", ["mari", "pepper", "nave"], "pijama_botas",
  "The top half of the pumpkin spaceship lifts slowly like a lid on a pot; soft white mist and green light puff out. Mari "
  "stands bravely in front of it with her fists clenched and knees a little wobbly. In the background Pepper races into the "
  "open garage door, comic."),
 ("c02-p02", ["mari", "zib", "nave"], "pijama_botas",
  "Zib peeks over the edge of the open pumpkin spaceship, then floats up out of it like a balloon, its three springy "
  "antennae glowing. Green light and mist pour out. Mari leans forward, amazed, mouth open."),
 ("c02-p03", ["mari", "zib"], "pijama_botas",
  "Zib floats close to Mari's face, staring at her shiny cardboard helmet with delighted eyes, its antenna bulbs glowing "
  "bright blue. Mari stands frozen with her mouth open in surprise. Pumpkin patch, morning."),
 ("c02-p04", ["mari", "zib"], "pijama_botas",
  "Zib floats upside down in the air doing a bow, antennae glowing pink. Mari laughs and pushes her cardboard helmet up "
  "off her forehead so she can see better. Pumpkin patch, morning."),
 ("c02-p05", ["mari", "zib", "pepper"], "pijama_botas",
  "Zib floats around Mari tapping the silver tape of her helmet with one tiny hand; Mari's cheeks are pink and proud. By "
  "the garage, Pepper has jumped into one of Dad's big rain boots and only her tail sticks out."),
 ("c02-p06", ["mari", "zib", "nave"], "pijama_botas",
  "Mari and Zib look down into the open pumpkin spaceship. Zib's antennae are gray and drooping, sad. Inside the ship: a "
  "tiny cushioned seat, round buttons and a clear glass jar in the middle with eight empty round holes, like an egg carton."),
 ("c02-p07", ["mari", "zib", "nave"], "pijama_botas",
  "Zib points up at the morning sky where a pale white moon is barely visible, while explaining; above Zib, a dreamy "
  "little thought bubble shows eight glowing lime-green seeds flying out over a small town. Mari listens, worried. The "
  "open pumpkin spaceship beside them."),
 ("c02-p08", ["mari", "zib"], "pijama_botas",
  "Quiet tender moment in the garden: Zib's antennae droop gray as it thinks of its family far away; Mari stands up "
  "straight and fixes her cardboard helmet with a determined face. Soft morning light, a few falling leaves."),
 ("c02-p09", ["mari", "zib", "nave"], "pijama_botas",
  "Mari raises one hand like a promise with a determined smile; Zib does a happy flip in the air, its antennae glowing every "
  "color of the rainbow at once. The open pumpkin spaceship behind them in the morning garden."),
 ("c02-p10", ["mari", "zib", "mama"], "pijama_botas",
  "Zib's three antennae stand straight up glowing yellow, all pointing over the fence toward the street (an oak tree, a "
  "stop sign in the distance). Mari follows the direction with her eyes. In the background, Mom calls from the kitchen "
  "door with a spatula in her hand."),
 # ---------- Capítulo 3 ----------
 ("c03-p01", ["mari", "zib", "mama"], "mochila",
  "Sunny autumn sidewalk with orange and red leaves. Mari walks to school beside Mom, holding her silver cardboard helmet. "
  "Zib peeks out of the half-open zipper of Mari's backpack holding a banana and grinning. Mom is busy talking and does "
  "not notice."),
 ("c03-p02", ["mari", "zib"], "mochila",
  "A bright, colorful second-grade classroom decorated for fall. Mari hangs her backpack on a coat hook and whispers into "
  "it; three glowing yellow antenna tips poke out of the top of the backpack. A big pumpkin sits on the teacher's desk."),
 ("c03-p03", ["mari", "leo", "patel"], "hoodie",
  "Classroom lesson: Ms. Patel holds up a green leaf and an orange leaf in front of a chalkboard with drawings of leaves and "
  "a tree. Leo raises his hand, amazed. Mari sits at her desk but glances back at her coat hook, where her backpack hangs "
  "open and empty."),
 ("c03-p04", ["mari", "zib"], "hoodie",
  "Back of the classroom: an open dress-up chest overflowing with capes, masks and hats. Zib sits on top wearing a "
  "too-big black pirate hat, giggling with its arms up. Mari, in the foreground, turns around with wide surprised eyes."),
 ("c03-p05", ["mari", "zib", "leo", "patel"], "astro",
  "Kids in costumes lining up at the classroom door. Mari stands with her cardboard helmet in one hand and Zib held in the "
  "other arm. Ms. Patel claps her hands, delighted. Leo, wearing a superhero cape and mask over his striped shirt, stares "
  "at Zib saying whoa while Zib waves, antennae pink."),
 ("c03-p06", ["mari", "zib", "leo"], "astro",
  "The fall costume parade on the school playground under a blue sky with orange trees. Kids dressed as a dinosaur, a "
  "fairy, a pirate, a robot, a hot dog and a girl dressed as a bunch of grapes (purple balloons). Zib floats over Mari's "
  "shoulder waving, antennae flashing colors. Families clap behind the fence."),
 ("c03-p07", ["mari", "zib", "patel"], "astro",
  "Inside the classroom: Ms. Patel holds up a shiny blue prize ribbon next to the big pumpkin on her desk; the class claps. "
  "Mari walks to the front with Zib floating beside her, and Zib's antennae suddenly glow bright yellow, all pointing at "
  "the pumpkin."),
 ("c03-p08", ["mari", "zib", "patel"], "astro",
  "Close-up at Ms. Patel's desk: the top of the class pumpkin is lifted off; among the regular pale pumpkin seeds glows one "
  "marble-sized lime-green seed. Mari, holding the blue ribbon, reaches in. Zib peeks over the edge with yellow antennae. "
  "Ms. Patel smiles in the background."),
 ("c03-p09", ["mari", "zib", "nave"], "astro",
  "Afternoon in the backyard pumpkin patch: Mari places the glowing seed into the first hole of the glass jar inside the "
  "open pumpkin spaceship; one round button lights up green. Zib does a happy flip in the air. The blue ribbon now hangs "
  "from the ship's silver stem."),
 ("c03-p10", ["mari", "zib"], "astro",
  "Mari and Zib at the backyard gate looking down Maple Street in late afternoon: Zib's yellow antennae point past a yellow "
  "house and a blue house to the very end of the street, where an old tall house with red vines, tall grass, stone "
  "statues and a brass telescope dome on its roof stands. Mari looks a little nervous."),
 # ---------- Capítulo 4 ----------
 ("c04-p01", ["mari", "zib", "pepper"], "hoodie",
  "Golden afternoon on the back steps of Mari's house. Mari sits with her chin in her hands, wiggling her boots, explaining; "
  "Zib floats beside her with a curious tilt. Pepper sits far away on top of the wooden fence, staring at Zib with huge "
  "round eyes."),
 ("c04-p02", ["mari", "zib"], "hoodie",
  "Zib floats right in front of Mari's face, explaining with its tiny hands; above Zib, a little dreamy thought bubble shows "
  "Pepper hiding from a cute question-mark shadow. Mari smiles as she understands. Back steps, golden light."),
 ("c04-p03", ["mari", "zib", "abuela"], "mochila",
  "The kitchen: Abuela places six pieces of colorful Mexican pan dulce (conchas) into a wicker basket and covers it with an "
  "embroidered cloth. Mari zips her backpack while Zib peeks out of it with an innocent look."),
 ("c04-p04", ["mari", "zib", "abuela"], "mochila",
  "Late afternoon on Maple Street, pink-orange sky. Mari holds Abuela's hand as they walk up to the last house: old and "
  "tall, covered in red vines, with stone rabbit and owl statues in tall grass and a round brass telescope dome on the roof; "
  "warm glowing windows. Zib's antennae poke out of Mari's backpack. Neighbors' houses show a scarecrow and a sheet ghost. "
  "Mrs. Crump is not visible yet."),
 ("c04-p05", ["mari", "zib", "abuela", "crump"], "mochila",
  "The old front door creaks open: tall Mrs. Crump stands in the doorway frowning, with her huge floppy round-topped black "
  "hat, long silver braid and small round glasses. Abuela smiles warmly holding up the basket of pan dulce. Mari half "
  "hides behind Abuela."),
 ("c04-p06", ["mari", "abuela", "crump"], "mochila",
  "The same doorway: Mrs. Crump's frown has turned into a huge smile, her glasses pushed up by her cheeks, as she accepts "
  "the basket of pan dulce and waves them inside. Abuela laughs. Mari blinks, surprised and relieved."),
 ("c04-p07", ["mari", "abuela", "crump"], "mochila",
  "Inside Mrs. Crump's warm, messy, wonderful house: books everywhere on shelves, chairs and stairs; star maps and big "
  "pictures of the cratered gray moon on the walls. Mrs. Crump points at a moon picture explaining craters; Mari and Abuela "
  "look around in awe."),
 ("c04-p08", ["mari", "abuela", "crump"], "mochila",
  "A round attic room at the top of the house with a domed roof opening to the evening sky; a huge brass telescope stands in "
  "the middle. Mari points at the telescope excitedly; Mrs. Crump stands proudly beside it with one hand on the brass."),
 ("c04-p09", ["mari", "abuela", "crump"], "mochila",
  "In the telescope room: in the background Abuela looks at a framed picture of Saturn with its rings. In the foreground "
  "Mrs. Crump leans down close to Mari and whispers a secret. The zipper of Mari's backpack is just starting to open with a "
  "glow coming out."),
 ("c04-p10", ["mari", "zib", "abuela", "crump"], "mochila",
  "Zib floats out of the backpack right in front of Mrs. Crump's round glasses; Mrs. Crump, calm and amazed, is cleaning "
  "her glasses on her cardigan. Mari presses a finger to her lips: a secret. Far across the room, Abuela has her back turned, "
  "reading a book about the moon."),
 ("c04-p11", ["mari", "zib", "abuela", "crump"], "mochila",
  "Twilight in Mrs. Crump's yard: a stone bird bath shaped like a big flower, its water glowing green with a lime-green "
  "glow-seed at the bottom. Mari reaches in to take it. Mrs. Crump holds up a lantern and winks. Zib hides behind Mari's "
  "back with yellow antennae. Abuela watches, smiling, holding the empty basket."),
 ("c04-p12", ["mari", "zib", "abuela", "crump"], "mochila",
  "At Mrs. Crump's iron garden gate under the first evening stars. Mrs. Crump leans down laughing, her big hat tipping, and "
  "points far away toward the horizon where tall cornfields are. Mari and Zib (peeking out of the backpack) look at each "
  "other. Abuela waves goodbye."),
 # ---------- Capítulo 5 ----------
 ("c05-p01", ["mari", "zib", "mama", "papa", "abuela"], "mochila",
  "Sunny Saturday at Harvest Hill Farm: a red barn, hay bales, a pile of pumpkins as tall as a car and a green tractor "
  "pulling a wagon of hay with laughing kids. Mari sits on the hay wagon with her backpack on her lap, Zib's antennae "
  "peeking out. Mom, Dad and Abuela (with a bag of oranges) sit beside her. Cows in a pen, a huge cornfield in the back."),
 ("c05-p02", ["mari", "zib", "papa"], "hoodie",
  "Entrance of the corn maze: a wooden sign with a big map drawing of a bat-shaped maze (no letters). Mari and Dad walk in "
  "between corn stalks taller than Dad; Zib floats low near the ground between them, hidden by corn leaves. They face a "
  "dead end."),
 ("c05-p03", ["mari", "zib", "papa"], "hoodie",
  "Inside the tall golden corn maze under a blue sky: Mari walks with her right hand touching the corn wall, looking "
  "determined. Dad follows, smiling and scratching his head. Zib floats low with yellow antennae pointing ahead."),
 ("c05-p04", ["mari", "zib", "papa"], "hoodie",
  "A turn in the corn maze: a scarecrow sits on a hay bale with a straw hat, a plaid shirt, a big silly pumpkin head and a "
  "basket of apples. Zib zooms up to it waving hello. The scarecrow has just shouted back: Mari and Dad jump in surprise "
  "and Zib flips upside down. Funny, not scary."),
 ("c05-p05", ["mari", "zib", "papa"], "hoodie",
  "Farmer Joe, a friendly man with a gray beard, sits on the hay bale laughing as he lifts off his silly pumpkin mask. In "
  "his lap a basket of red apples with one marble-sized lime-green glow-seed shining among them. Mari laughs sitting on the "
  "hay; Dad laughs too; Zib floats upside down."),
 ("c05-p06", ["mari", "zib", "mama", "papa", "abuela"], "hoodie",
  "Mari, Dad and Zib come out of the corn maze next to the red barn. Mari holds the glowing seed in her palm and Zib's "
  "antennae glow pink. Mom and Abuela wait by the barn holding cups of apple cider. Late afternoon sun."),
 ("c05-p07", ["mari", "zib", "nave"], "hoodie",
  "Night in the backyard: the open pumpkin spaceship glows softly with three lit green buttons; thin musical notes drift "
  "up from it like a quiet song. Zib floats very still beside it with gray drooping antennae. Mari rests her hand on the "
  "warm pumpkin. In the background, a warm light turns on in the kitchen window."),
 # ---------- Capítulo 6 ----------
 ("c06-p01", ["zib", "abuela", "pepper"], "pijama",
  "Very early morning, soft blue light at the kitchen window: Zib sits on the counter with its face covered in sugar next "
  "to a big open glass sugar jar. Abuela, in a robe and slippers, stands in the doorway with one hand on her cheek, "
  "surprised but smiling. Pepper watches from on top of the refrigerator."),
 ("c06-p02", ["mari", "zib", "abuela"], "pijama",
  "Mari runs down the last step into the kitchen in her pajamas, arms up, worried. Abuela is not scared at all: she is "
  "laughing, pulling out a chair. Zib, with sugar on its cheeks, waves with pink antennae."),
 ("c06-p03", ["mari", "zib", "abuela"], "pijama",
  "At the kitchen table, Mari tells Abuela the whole story with big gestures while Abuela listens and nods. Zib points one "
  "tiny finger at the sugar jar with a cheeky look."),
 ("c06-p04", ["mari", "zib", "abuela", "pepper"], "pijama",
  "Close-up: Mari digs with a big spoon into the glass sugar jar; at the very bottom a lime-green glow-seed shines through "
  "the white sugar. Abuela and Zib lean in to watch; Zib does flips and sugar flies everywhere. Pepper stays on top of the "
  "refrigerator, unimpressed."),
 ("c06-p05", ["mari", "zib", "abuela"], "pijama",
  "Abuela cooks candied pumpkin (calabaza en tacha) in a big clay pot on the stove with cinnamon sticks; sweet steam swirls. "
  "Mari stands on a stool stirring with a wooden spoon. Zib floats over the pot sniffing happily."),
 ("c06-p06", ["mari", "zib", "abuela"], "pijama",
  "Zib takes a bite of candied pumpkin from a small plate and glows like a rainbow from head to belly, antennae sparkling. "
  "Mari laughs. Abuela beams in her turquoise rebozo; a soft dreamy bubble above her shows her story: a little star lost "
  "in a forest helped by an owl and a rabbit."),
 ("c06-p07", ["mari", "zib", "abuela", "nave"], "pijama",
  "Split moment: in front, Zib gives Abuela a small sticky hug around her neck in the kitchen doorway. Behind, through the "
  "open door, the morning garden with the pumpkin spaceship, where a little glowing screen on the glass jar shows a full "
  "moon symbol and five dots (no numbers or letters)."),
 # ---------- Capítulo 7 ----------
 ("c07-p01", ["mari", "zib", "abuela"], "hoodie_casco",
  "Night at the small-town library decorated for Halloween: paper pumpkins on the shelves and orange string lights. Kids in "
  "pajamas and costumes arrive. Mari, wearing her cardboard helmet, holds Abuela's hand at the door; Zib's antennae poke "
  "out of her backpack. Abuela covers a laugh with her hand."),
 ("c07-p02", ["mari", "zib", "abuela"], "hoodie_casco",
  "Kids sitting on colorful cushions while the librarian Mr. Gómez, wearing a cape and a top hat, reads aloud a picture "
  "book about a shy cartoon ghost. Mari sits next to Abuela with her backpack on her lap; Zib peeks out with sparkly eyes."),
 ("c07-p03", ["mari", "zib"], "hoodie_casco",
  "A quiet corner table: a big open picture book shows the planets of our solar system in a row around a bright sun. Zib "
  "sits right on the page looking for its planet, antennae drooping. Mari, helmet pushed up, reads to it."),
 ("c07-p04", ["mari", "zib"], "hoodie_casco",
  "Zib floats at a tall library window looking out at a night sky full of stars, antennae turning soft pink. Mari stands "
  "beside it pointing up at the stars. The open planet book lies on the table behind them."),
 ("c07-p05", ["mari", "zib"], "hoodie_casco",
  "Zib spins in the air with very yellow antennae pointing at the bottom shelf of the space books; Mari kneels and pulls "
  "out a thin blue book with a moon on the cover, surprised by how heavy it is."),
 ("c07-p06", ["mari", "zib"], "hoodie_casco",
  "Mari kneels by the bottom shelf holding the thin blue moon book open; a lime-green glow-seed lies pressed in the middle, "
  "lighting a picture of the moon's phases from crescent to full. Zib cheers above her shoulder. In the background a girl "
  "in a cat costume waves at them."),
 ("c07-p07", ["mari", "zib", "nave"], "hoodie",
  "Night in the backyard: Mari places a seed in the glowing jar of the pumpkin spaceship; five green buttons are lit and "
  "the jar's little screen shows a full-moon symbol and four dots. Zib floats up with tall yellow antennae pointing over "
  "the fence toward the school building in the distance."),
 # ---------- Capítulo 8 ----------
 ("c08-p01", ["mari", "zib", "mama"], "astro",
  "Evening school Halloween fair in the hallway outside the gym: kids getting their faces painted, a ring toss on pumpkins, "
  "a cake walk. Mari in her astronaut costume stands with Mom in front of the gym doors, which have a sign with drippy "
  "green paint (no readable letters) and a purple glow inside. Mari looks nervous; her backpack glows."),
 ("c08-p02", ["mari", "leo", "mama", "pepper"], "astro",
  "Leo in his knight costume taps Mari on the shoulder, excited. Mari and Leo hold hands and walk through the gym doors. "
  "Behind them, unnoticed, Pepper's head pops out of Mom's big tote bag as Mom waves." + LEO_CABALLERO),
 ("c08-p03", ["mari", "leo", "pepper"], "astro",
  "Inside the cardboard haunted house in the gym: painted cardboard walls, soft purple and green lights, paper bats on "
  "strings, cotton cobwebs and a little fog. A friendly bedsheet ghost with marker-drawn eyes swings down; a plastic "
  "skeleton sits in a chair singing. Mari and Leo hold hands and giggle. Pepper sneaks behind them. Funny, not scary."
  + LEO_CABALLERO),
 ("c08-p04", ["mari", "leo", "pepper"], "astro",
  "Comic moment in the haunted house: Pepper, fur puffed up like a dandelion and tail like a bottle brush, hisses at a "
  "floppy gray mop leaning on the cardboard wall, then leaps toward Mari's open backpack. Mari and Leo turn around in "
  "surprise." + LEO_CABALLERO),
 ("c08-p05", ["mari", "zib", "leo", "pepper"], "astro",
  "Pepper's tail sticks out of Mari's backpack while Zib floats out of it. Leo stares, mouth wide open in a big 'whoa', "
  "then holds up his cardboard shield like a knight making a promise. Zib's antennae glow pink." + LEO_CABALLERO),
 ("c08-p06", ["mari", "zib", "leo"], "astro",
  "The last room of the haunted house: thick white fog rolls out from under a door. A pretend cauldron made from a black "
  "trash can; behind it a small fog machine puffs fog that glows a little green. Zib's antennae point at it, bright yellow; "
  "Mari and Leo peek in, curious." + LEO_CABALLERO),
 ("c08-p07", ["mari", "zib", "leo"], "astro",
  "Jada, a friendly fifth-grade girl dressed as a cute vampire with a cape, turns off the fog machine and hands Mari a "
  "lime-green glow-seed. Mari smiles and says thank you; Leo points at the machine; Zib peeks from behind Leo's shield."
  + LEO_CABALLERO),
 ("c08-p08", ["mari", "zib", "leo", "mama", "pepper"], "astro",
  "Outside the school at night as it starts to rain: Mom, holding an empty tote bag, looks confused at Pepper sitting in "
  "Mari's backpack. Leo waves goodbye. Then inside the car: Zib sits on Mari's lap looking out the rainy window with gray "
  "drooping antennae. Show the car scene as the main image with the school in the rainy background." + LEO_CABALLERO),
 # ---------- Capítulo 9 ----------
 ("c09-p01", ["mari", "zib"], "hoodie",
  "A rainy afternoon in the cozy living room: rain streaks down the big window, the street outside looks like a little "
  "river. A pillow fort of blankets and cushions and a paper airplane on the rug. Mari shows Zib a paper airplane with a "
  "hopeful smile; Zib floats by the window with gray drooping antennae."),
 ("c09-p02", ["mari", "zib"], "hoodie",
  "Mari sits next to Zib on the window seat as rain taps on the glass. Zib looks down, sad; a soft dreamy bubble shows its "
  "family on a purple planet with green rings: a mama making soup, a papa laughing and a tiny brother splashing in puddles. "
  "Mari looks at Zib with gentle, teary eyes."),
 ("c09-p03", ["mari", "zib", "pepper"], "hoodie",
  "Mari and Zib snuggle under one blanket on the window seat; Pepper is curled up on Mari's feet. One of Zib's antennae "
  "glows a tiny bit pink. Rain on the window, warm lamp light, very cozy."),
 ("c09-p04", ["mari", "zib", "abuela", "crump"], "hoodie",
  "Evening after the rain: the clouds break apart showing stars. Mari, Abuela (with her rebozo) and Zib walk down shiny wet "
  "Maple Street with yellow street-light puddles. At the end of the street Mrs. Crump waits at her door holding a lantern "
  "and waving."),
 ("c09-p05", ["mari", "zib", "abuela", "crump"], "hoodie",
  "Night in Mrs. Crump's round attic room with the domed roof open to a clearing sky full of stars. Zib floats at the "
  "opening pointing at three stars in a row (like a belt) and up to a small orange star. Mrs. Crump turns the brass "
  "telescope; Mari and Abuela watch, holding hands, lantern light on their faces."),
 ("c09-p06", ["zib", "crump"], "hoodie",
  "View through the telescope eyepiece shown as a big round circle: a small bright orange star sparkling in deep blue "
  "space. At the edge of the frame, Zib's happy face pressed to the eyepiece, antennae changing from gray to soft pink. "
  "Mrs. Crump smiles gently beside it."),
 ("c09-p07", ["mari", "zib", "abuela"], "hoodie",
  "Walking home on Maple Street under bright stars: Mari carefully hugs Zib; Abuela walks beside them smiling. Zib hums a "
  "little song (tiny glowing musical notes float from it). Warm porch lights along the street."),
 ("c09-p08", ["mari", "zib", "abuela"], "hoodie",
  "At their front gate at night: Zib's three antennae shoot straight up, blinking bright yellow twice. Mari looks along "
  "Maple Street at all the houses decorated with pumpkins, sheet ghosts and a big plastic spider wearing a party hat on a "
  "roof, with a big idea on her face. Abuela opens the gate."),
 # ---------- Capítulo 10 ----------
 ("c10-p01", ["mari", "zib", "leo", "abuela", "pepper"], "astro",
  "Halloween evening on the front porch decorated with carved friendly jack-o'-lanterns and orange lights. Mari in her "
  "astronaut costume, Leo as a knight, Pepper wearing purple felt bat wings (not loving them), and Zib floating proudly "
  "while Abuela hands it a tiny orange candy bucket." + LEO_CABALLERO + PEPPER_ALAS),
 ("c10-p02", ["mari", "zib", "leo", "papa", "pepper"], "astro",
  "Sunset on Maple Street: a huge round orange full moon rises over the trees like a giant pumpkin. Dad with a flashlight "
  "leads the group. All porch lights are on; kids in costumes everywhere (witches, pirates, dinosaurs and one very tall "
  "banana). Zib's antennae glow yellow." + LEO_CABALLERO + PEPPER_ALAS),
 ("c10-p03", ["mari", "zib", "leo"], "astro",
  "At the first house: a smiling lady holds a bowl of candy at her door. Mari and Leo hold up their buckets; Zib bows "
  "upside down in the air holding its tiny orange bucket. Warm porch light, jack-o'-lanterns." + LEO_CABALLERO),
 ("c10-p04", ["mari", "zib", "leo", "papa"], "astro",
  "Trick-or-treating along Maple Street, house to house (a scarecrow, a sheet ghost). Leo points down the sidewalk at a "
  "tiny three-year-old boy in a round pumpkin costume walking with his dad, holding a glowing lime-green ball. Zib's "
  "antennae glow so bright yellow they look almost white." + LEO_CABALLERO),
 ("c10-p05", ["mari", "zib", "leo"], "astro",
  "On the sidewalk with glowing porch lights: Mari kneels to trade a big chocolate bar with the tiny boy in the pumpkin "
  "costume, who proudly holds up the lime-green glow-seed with a big grin. His dad smiles behind him. Leo and Zib watch "
  "hopefully." + LEO_CABALLERO),
 ("c10-p06", ["mari", "zib", "leo"], "astro",
  "A house with a big friendly plastic spider wearing a party hat on its roof. Mr. Lee, a cheerful older man in a cozy "
  "sweater, sits on the porch beside a giant candy bowl with a lime-green glow-seed on top, laughing as he hands it to "
  "Mari. Leo and Zib cheer." + LEO_CABALLERO),
 ("c10-p07", ["mari", "zib", "leo", "papa", "pepper", "nave"], "astro",
  "Night in the backyard pumpkin patch under a huge bright full moon: the pumpkin spaceship glows with lime-green light "
  "pouring through its seam and porthole, all eight buttons lit, the whole garden glowing green like under the sea. A thin "
  "silver beam of moonlight comes down from the moon to the ship. Dad's mouth hangs open; Mari, Leo, Pepper and Zib look "
  "amazed." + LEO_CABALLERO + PEPPER_ALAS),
 # ---------- Capítulo 11 ----------
 ("c11-p01", ["mari", "zib", "leo", "abuela", "crump", "mama", "papa", "nave"], "astro",
  "Halloween night in the pumpkin patch: a circle of people around the glowing pumpkin spaceship under the silver moon "
  "beam: Mari, Leo, Abuela with a pot of cocoa, Mom in slippers, Dad with a flashlight and Mrs. Crump hurrying in with "
  "her lantern and floppy hat. Zib floats in the middle greeting Mom, who laughs." + LEO_CABALLERO),
 ("c11-p02", ["zib", "crump", "nave"], "astro",
  "Mrs. Crump writes numbers in a little notebook, looking up at the full moon. Zib sits in the tiny seat inside the open "
  "pumpkin spaceship pushing glowing buttons; the ship gives a big shake with comic motion lines."),
 ("c11-p03", ["mari", "zib", "leo", "mama", "papa", "nave"], "astro",
  "One glow-seed has bounced out of the ship and rolls away into the dark back corner of the pumpkin patch under big brown "
  "leaves and tangled vines. Everyone searches: Dad points his flashlight, Mom lifts leaves, Leo crawls on the ground, Zib "
  "looks worried. Mrs. Crump checks her watch in the background." + LEO_CABALLERO),
 ("c11-p04", ["mari", "pepper"], "astro",
  "The dark back corner of the pumpkin patch, thick with tangled vines and old pumpkins, a faint lime-green glow peeking "
  "from deep underneath. Pepper crouches bravely at the edge, ears forward, eyes shining, looking back at Mari, who "
  "whispers encouragement. Flashlight beam behind." + PEPPER_ALAS),
 ("c11-p05", ["mari", "zib", "pepper", "nave"], "astro",
  "Pepper walks out of the vines very proudly, tail straight up, carrying a glowing lime-green seed gently in her mouth "
  "like a mother cat with a kitten, heading straight for the glowing pumpkin spaceship where Zib waits. Everyone in the "
  "background holds their breath." + PEPPER_ALAS),
 ("c11-p06", ["mari", "zib", "leo", "abuela", "crump", "papa", "pepper", "nave"], "astro",
  "Joy in the pumpkin patch: Mari scoops up Pepper and hugs her; Zib closes the jar lid with all eight buttons green. "
  "Everyone cheers: Abuela the loudest, Leo raises his shield, Mrs. Crump throws her big floppy hat in the air and Dad "
  "catches it." + LEO_CABALLERO + PEPPER_ALAS),
 ("c11-p07", ["mari", "zib", "nave"], "astro",
  "The pumpkin spaceship floats a few inches off the ground, its light turning from green to gold. Zib floats back out "
  "toward Mari, antennae glowing a soft pink-gold color, holding out one tiny hand with something glowing inside. Mari "
  "looks at it with a lump in her throat."),
 # ---------- Capítulo 12 ----------
 ("c12-p01", ["mari", "zib"], "astro",
  "Close-up of Mari's open hand receiving a small purple teardrop-shaped seed with a soft glow from Zib's tiny "
  "three-fingered hand. Warm golden light from the floating spaceship around them. Mari's face in her cardboard helmet "
  "with happy, teary eyes."),
 ("c12-p02", ["zib", "leo", "abuela", "crump", "pepper"], "astro",
  "Goodbyes in the pumpkin patch: Zib hugs Abuela around her neck while she wipes her eyes with her rebozo; Zib bows "
  "upside down to Mrs. Crump; Zib high-fives Leo's shield; Pepper touches her nose to Zib's nose. Golden ship light and "
  "moonlight." + LEO_CABALLERO + PEPPER_ALAS),
 ("c12-p03", ["mari", "zib"], "astro",
  "Mari and Zib face each other alone in the moonlight in front of the golden floating spaceship. Mari laughs and cries "
  "at the same time; Zib's antennae glow pink and gold. The full moon is huge behind them."),
 ("c12-p04", ["mari", "zib", "leo", "abuela", "crump", "mama", "papa", "pepper", "nave"], "astro",
  "The glowing golden pumpkin spaceship rises along a silver beam of moonlight toward a huge full moon, and in front of the "
  "moon it draws a bright green curved line shaped like a smile. Far below, the group in the backyard waves goodbye; Dad "
  "blinks his flashlight; a tiny purple hand waves from the porthole." + LEO_CABALLERO),
 ("c12-p05", ["mari", "leo", "abuela", "crump", "mama", "papa", "pepper"], "astro",
  "Quiet after the goodbye: everyone in the garden looking up at the starry sky with cups of hot cocoa. Mrs. Crump talks "
  "about telescopes with Leo's mom; Pepper sits on Mari's feet purring. Mari holds the softly glowing purple friend-seed "
  "in her hand, smiling up at one small orange star." + LEO_CABALLERO),
 ("c12-p06", ["mari", "abuela", "pepper"], "mayor",
  "The next October: Abuela's pumpkin patch in warm autumn sunset light; in the middle grows one small round purple "
  "pumpkin with soft green stripes and a gentle glow, on a vine with star-shaped leaves. Mari, one year older, kneels "
  "beside it wearing a homemade purple alien hat with three springy pipe-cleaner antennae with ping-pong balls. Abuela and "
  "Pepper beside her; a rising moon and a tiny green streak of light in the sky."),
]

PORTADA = ("portada", ["mari", "zib", "pepper", "nave"], "astro",
  "Book cover. Halloween night in Abuela's backyard pumpkin patch under a huge full moon and stars. Mari stands proudly "
  "next to the glowing pumpkin spaceship, which has its lid slightly open with lime-green light spilling out; Zib floats "
  "beside her waving, antennae glowing rainbow colors; Pepper peeks out from behind a pumpkin. Warm porch light on one "
  "side, magical and cozy, not scary. Leave the top quarter as simple night sky (the title is added later by code).")


def main():
    D = json.loads((LIBRO / "personajes.json").read_text(encoding="utf-8"))
    estilo = D["estilo_base"]
    base = {p["id"]: p["base"] for p in D["personajes"]}
    nunca = {p["id"]: p["negativos"] for p in D["personajes"]}
    base.update(EXTRA)
    hojas = {"mari": "mari.jpg", "zib": "zib.jpg", "pepper": "pepper.jpg", "abuela": "abuela.jpg", "crump": "crump.jpg",
             "leo": "leo.jpg", "patel": "patel.jpg", "nave": "nave.jpg", "mama": "mama.png", "papa": "papa.png"}
    sin_ropa = base["mari"].replace(", wearing a mustard-yellow hoodie with a small rocket patch and dark teal leggings", "")

    def prompt(pid, quien, ropa, escena):
        partes = []
        for q in quien:
            if q == "mari":
                partes.append(f"{sin_ropa}, {MARI[ropa]}.")
            elif q == "nave":
                n = base["nave"][0].upper() + base["nave"][1:]
                if pid in ("c01-p08", "c01-p09"):
                    n = n.replace("a small round porthole glowing lime green", "a small round porthole that is still dark")
                partes.append(n + ".")
            else:
                partes.append(base[q] + ".")
        prohibido = []
        for q in quien:
            prohibido += [f"{q}: {n}" for n in nunca.get(q, [])]
        cap = 0 if pid == "portada" else int(pid[1:3])
        momento = "night" if pid == "portada" else MOMENTO.get(pid, MOMENTO_CAP[cap])
        reglas = [VERDE, UNA_NAVE]
        if "zib" in quien:
            reglas.append(ZIB_ANTENAS)
        if "mari" in quien and ropa in ("hoodie_casco", "pijama_botas", "astro"):
            reglas.append(CASCO)
        de_dia = any(w in momento for w in ("morning", "day", "afternoon")) and "evening" not in momento
        if pid == "c02-p07":
            reglas.append("It is daytime: blue sky and sunlight; the only thing in the sky is a pale, faint white daytime moon.")
        elif "rain" in momento:
            reglas.append("It is daytime but rainy: soft gray sky and rain outside, no moon and no stars.")
        elif "before sunrise" in momento:
            reglas.append("It is just before sunrise: soft pale blue light at the window, no moon.")
        elif de_dia:
            reglas.append("It is daytime: blue sky and sunlight, no stars and no moon in the sky.")
        elif pid != "c12-p06":
            reglas.append(LUNA_HALLOWEEN if cap >= 10 or pid == "portada" else LUNA_ANTES)
        if pid in EXTRA_PAGINA:
            reglas.append(EXTRA_PAGINA[pid])
        return (f"{estilo} Use the attached reference sheets for the exact look of each character and keep them identical "
                f"(same face, hair, colors, clothes and proportions). Time of day: {momento}. Scene: {escena} "
                f"Characters: {' '.join(partes)} Continuity rules: {' '.join(reglas)} "
                + (f"Never: {'; '.join(prohibido)}. " if prohibido else "")
                + "Wide 16:9 storybook illustration that fills the whole frame: no empty bands, no borders, no text.")

    paginas = []
    for pid, quien, ropa, escena in [PORTADA] + P:
        cap = 0 if pid == "portada" else int(pid[1:3])
        pag = 0 if pid == "portada" else int(pid[5:7])
        paginas.append({"id": pid, "capitulo": cap, "pagina": pag, "archivo": f"arte/paginas/{pid}.png",
                        "referencias": [f"arte/personajes/{hojas[q]}" for q in quien],
                        "prompt": prompt(pid, quien, ropa, escena)})

    def hoja(q, quien):
        return {"id": q, "archivo": f"arte/personajes/{q}.png", "referencias": ["arte/personajes/mari.jpg", "arte/personajes/grupo.jpg"],
                "prompt": (f"{estilo} Character reference sheet on a plain cream background of {quien}. Full body front view, "
                           "side view and back view, plus four small head expressions: happy, surprised, thinking, laughing. "
                           "Same proportions and colors in every view. Draw in exactly the same style as the attached sheets; "
                           "this person is a parent of the girl in the attached sheet.")}
    salida = {
        "_ayuda": ("Un prompt por página del libro (#123): 'archivo' es dónde va la imagen y 'referencias' las hojas de "
                   "personaje que se adjuntan antes de pegar el prompt. Lo escribe herramientas/paginas_halloween.py."),
        "formato": "PNG 16:9, al menos 1344 x 768 px",
        "hojas": [hoja("mama", EXTRA["mama"]), hoja("papa", EXTRA["papa"])],
        "paginas": paginas,
    }
    (LIBRO / "paginas.json").write_text(json.dumps(salida, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(len(paginas), "prompts;", max(len(p["prompt"]) for p in paginas), "caracteres el más largo")


if __name__ == "__main__":
    main()
