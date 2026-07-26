// Word Siege — the word bank.
//
// Six realms, each with 24 words split into three tiers of eight (easy ->
// hard). A campaign level takes one tier and deals a few of its words at
// random, so replaying a level is never the same siege twice while the
// difficulty ramp stays where it was authored.
//
// Every word is A-Z only (no spaces or hyphens — the keyboard has 26 keys) and
// every clue must NOT contain its own answer. tests/words.test.js enforces
// both, plus the tier sizes and the length band. Vocabulary is aimed at a
// confident 8-year-old reader.

const REALMS = [
  {
    id: "beasts",
    name: "Beast Wood",
    emoji: "🐾",
    theme: ["#2f6f4a", "#7ec87f"],
    words: [
      // tier 0
      { w: "HORSE", c: "A knight rides one into battle" },
      { w: "SHEEP", c: "Woolly farm animal that says baa" },
      { w: "TIGER", c: "Big orange cat with black stripes" },
      { w: "MOUSE", c: "Tiny grey nibbler with a long tail" },
      { w: "SNAKE", c: "Long legless slitherer that hisses" },
      { w: "GOOSE", c: "Honking bird that flies in a V" },
      { w: "ZEBRA", c: "Stripy black-and-white African runner" },
      { w: "OTTER", c: "Playful river swimmer that floats on its back" },
      // tier 1
      { w: "RABBIT", c: "Hoppy digger with very long ears" },
      { w: "MONKEY", c: "Swings through trees and loves bananas" },
      { w: "PARROT", c: "Colourful bird that copies what you say" },
      { w: "BADGER", c: "Stripy-faced night digger who lives in a sett" },
      { w: "WALRUS", c: "Sea giant with tusks and whiskers" },
      { w: "TURTLE", c: "Slow swimmer wearing its own shell" },
      { w: "FALCON", c: "The fastest diving hunting bird" },
      { w: "DONKEY", c: "Long-eared cousin of the horse" },
      // tier 2
      { w: "PENGUIN", c: "Black-and-white bird that swims but cannot fly" },
      { w: "GIRAFFE", c: "Tallest animal, with a very long neck" },
      { w: "DOLPHIN", c: "Clever sea swimmer that clicks and leaps" },
      { w: "LEOPARD", c: "Spotty big cat that naps in trees" },
      { w: "HEDGEHOG", c: "Small spiky ball that snuffles about at night" },
      { w: "SQUIRREL", c: "Bushy tail, buries nuts for winter" },
      { w: "ELEPHANT", c: "Biggest land animal, and it has a trunk" },
      { w: "KANGAROO", c: "Hops on huge feet and carries a joey in a pouch" },
    ],
  },
  {
    id: "kitchen",
    name: "Royal Kitchen",
    emoji: "🍎",
    theme: ["#b8452f", "#ffb35c"],
    words: [
      // tier 0
      { w: "BREAD", c: "Baked from flour and sliced for toast" },
      { w: "HONEY", c: "Sweet golden syrup made by bees" },
      { w: "APPLE", c: "Crunchy red or green fruit with a core" },
      { w: "SUGAR", c: "Sweet white grains stirred into tea" },
      { w: "CREAM", c: "Thick white topping for a scone" },
      { w: "GRAPE", c: "Small round fruit that grows in bunches" },
      { w: "ONION", c: "Layered vegetable that makes you cry" },
      { w: "LEMON", c: "Sour yellow fruit squeezed for a cool drink" },
      // tier 1
      { w: "CHEESE", c: "Made from milk, and mice would steal it" },
      { w: "BUTTER", c: "Yellow spread churned from cream" },
      { w: "CARROT", c: "Orange root a rabbit would pinch" },
      { w: "POTATO", c: "Dug from the ground, then mashed or chipped" },
      { w: "MUFFIN", c: "Little cake baked in a paper cup" },
      { w: "WALNUT", c: "Wrinkly nut inside a hard round shell" },
      { w: "TOMATO", c: "Round red fruit squashed into ketchup" },
      { w: "PEPPER", c: "Shaken beside the salt and makes you sneeze" },
      // tier 2
      { w: "PUDDING", c: "The sweet course at the end of dinner" },
      { w: "PANCAKE", c: "Flat, round and flipped in a pan" },
      { w: "SAUSAGE", c: "Long banger sizzling on the barbecue" },
      { w: "CABBAGE", c: "Big leafy green ball of a vegetable" },
      { w: "CUSTARD", c: "Warm yellow sauce poured over apple crumble" },
      { w: "PORRIDGE", c: "Warm oaty breakfast the three bears ate" },
      { w: "BROCCOLI", c: "Green vegetable shaped like little trees" },
      { w: "STRAWBERRY", c: "Red summer fruit with its seeds on the outside" },
    ],
  },
  {
    id: "keep",
    name: "Castle Keep",
    emoji: "🏰",
    theme: ["#4a4b8f", "#9aa0e8"],
    words: [
      // tier 0
      { w: "CROWN", c: "Golden hat a king wears" },
      { w: "SWORD", c: "Sharp blade a knight swings" },
      { w: "TOWER", c: "Tall round part of a castle" },
      { w: "QUEEN", c: "The king's wife, and a chess piece" },
      { w: "LANCE", c: "Long pole carried in a joust" },
      { w: "SHIELD", c: "Held on the arm to block a blow" },
      { w: "THRONE", c: "The grand chair a ruler sits on" },
      { w: "HELMET", c: "Metal hat that guards your head" },
      // tier 1
      { w: "KNIGHT", c: "Armoured warrior on horseback" },
      { w: "ARCHER", c: "Fires arrows from a bow" },
      { w: "BANNER", c: "Cloth flag flown from the walls" },
      { w: "TURRET", c: "Little tower sticking out from a wall" },
      { w: "JESTER", c: "Bell-hatted fool who makes the court laugh" },
      { w: "DUNGEON", c: "Dark prison down under the keep" },
      { w: "CATAPULT", c: "Machine that hurls rocks at walls" },
      { w: "CROSSBOW", c: "Held sideways and fires a short bolt" },
      // tier 2
      { w: "MINSTREL", c: "Wandering singer of the royal court" },
      { w: "TREASURE", c: "Chest of gold and jewels, hidden away" },
      { w: "FORTRESS", c: "Stronghold built to be defended" },
      { w: "CHAINMAIL", c: "Shirt woven out of thousands of metal rings" },
      { w: "DRAWBRIDGE", c: "Lowered across the moat to let you in" },
      { w: "BLACKSMITH", c: "Hammers red-hot iron into horseshoes" },
      { w: "BATTLEMENT", c: "The toothy top edge of a castle wall" },
      { w: "PORTCULLIS", c: "Heavy spiked grille that drops over the gateway" },
    ],
  },
  {
    id: "wild",
    name: "Wild Lands",
    emoji: "🏔️",
    theme: ["#1f6f8b", "#79d3c4"],
    words: [
      // tier 0
      { w: "RIVER", c: "Water running all the way down to the sea" },
      { w: "CLOUD", c: "Fluffy white shape drifting in the sky" },
      { w: "STORM", c: "Wild weather with wind and rain" },
      { w: "BEACH", c: "Sandy edge where the waves land" },
      { w: "FOREST", c: "Thick woods full of trees" },
      { w: "ISLAND", c: "Land with sea all the way around it" },
      { w: "DESERT", c: "Dry sandy place where it hardly ever rains" },
      { w: "VALLEY", c: "Low ground between two hills" },
      // tier 1
      { w: "THUNDER", c: "The bang that follows the flash" },
      { w: "RAINBOW", c: "Seven colours arching over after a shower" },
      { w: "VOLCANO", c: "Mountain that spits out fire and ash" },
      { w: "GLACIER", c: "River of ice creeping down a mountain" },
      { w: "MEADOW", c: "Grassy field full of wildflowers" },
      { w: "CANYON", c: "Deep rocky gorge cut by a river" },
      { w: "JUNGLE", c: "Steamy forest tangled with vines" },
      { w: "SUNSET", c: "When the sky goes orange at the end of the day" },
      // tier 2
      { w: "MOUNTAIN", c: "Huge rocky peak you climb" },
      { w: "SEASHELL", c: "Curly case left behind on the sand" },
      { w: "BLIZZARD", c: "Snowstorm you cannot see through" },
      { w: "WATERFALL", c: "Where a river drops off a cliff" },
      { w: "LIGHTNING", c: "White flash that splits the sky open" },
      { w: "HURRICANE", c: "Giant spinning windstorm out at sea" },
      { w: "AVALANCHE", c: "Snow sliding fast down a steep slope" },
      { w: "EARTHQUAKE", c: "When the ground shakes and rumbles" },
    ],
  },
  {
    id: "stars",
    name: "Star Reach",
    emoji: "🚀",
    theme: ["#2b2a6b", "#7a5cc8"],
    words: [
      // tier 0
      { w: "ROBOT", c: "Metal helper that follows instructions" },
      { w: "COMET", c: "Icy visitor with a long glowing tail" },
      { w: "ORBIT", c: "The loop a moon travels round a planet" },
      { w: "LASER", c: "Thin beam of very bright light" },
      { w: "ROCKET", c: "Blasts off on a pillar of flame" },
      { w: "PLANET", c: "A world going round a star" },
      { w: "GALAXY", c: "Billions of stars swirling together" },
      { w: "SATURN", c: "The planet wearing rings" },
      // tier 1
      { w: "ENGINE", c: "The part that makes a machine go" },
      { w: "MAGNET", c: "Sticks to the fridge and grabs iron" },
      { w: "METEOR", c: "Shooting star streaking overhead" },
      { w: "ECLIPSE", c: "When the moon hides the sun" },
      { w: "GRAVITY", c: "The pull that keeps your feet on the ground" },
      { w: "JUPITER", c: "Biggest planet, with a giant red spot" },
      { w: "CIRCUIT", c: "Loop of wire carrying electricity" },
      { w: "ANTENNA", c: "Sticks up to catch a signal" },
      // tier 2
      { w: "ASTEROID", c: "Lump of space rock between the planets" },
      { w: "UNIVERSE", c: "Everything there is, all together" },
      { w: "TELESCOPE", c: "Tube you look through to see far away" },
      { w: "ASTRONAUT", c: "Person whose job is up in space" },
      { w: "SPACESUIT", c: "Sealed outfit worn outside the ship" },
      { w: "SATELLITE", c: "Machine circling Earth, beaming signals down" },
      { w: "PROPELLER", c: "Spinning blades that pull a plane along" },
      { w: "SUBMARINE", c: "Boat that travels under the sea" },
    ],
  },
  {
    id: "dragon",
    name: "Dragon Peak",
    emoji: "🐉",
    theme: ["#6b1f3a", "#e0653f"],
    words: [
      // tier 0
      { w: "MAGIC", c: "What makes a wand work" },
      { w: "GIANT", c: "Enormous person at the top of a beanstalk" },
      { w: "FAIRY", c: "Tiny winged sprite with a wand" },
      { w: "TROLL", c: "Grumpy lump who lives under a bridge" },
      { w: "GHOST", c: "See-through spook that says boo" },
      { w: "WITCH", c: "Flies a broom and stirs a cauldron" },
      { w: "DRAGON", c: "Scaly beast that breathes fire" },
      { w: "WIZARD", c: "Pointy-hatted caster of spells" },
      // tier 1
      { w: "GOBLIN", c: "Small, sneaky and green-faced" },
      { w: "POTION", c: "Bubbling drink brewed in a cauldron" },
      { w: "GRIFFIN", c: "Half eagle, half lion" },
      { w: "MERMAID", c: "Half girl, half fish" },
      { w: "PHOENIX", c: "Fiery bird reborn from its own ashes" },
      { w: "UNICORN", c: "White horse with a single horn" },
      { w: "VAMPIRE", c: "Sleeps in a coffin and hates garlic" },
      { w: "CENTAUR", c: "Half man, half horse" },
      // tier 2
      { w: "PEGASUS", c: "The winged horse of Greek stories" },
      { w: "MINOTAUR", c: "Bull-headed monster kept in a maze" },
      { w: "GARGOYLE", c: "Stone monster perched up on a roof" },
      { w: "SORCERER", c: "Master of powerful magic" },
      { w: "WEREWOLF", c: "Turns furry when the moon is full" },
      { w: "SPELLBOOK", c: "Where a wizard keeps his magic written down" },
      { w: "ENCHANTED", c: "Under a magic charm" },
      { w: "LABYRINTH", c: "Twisting maze you can get lost inside" },
    ],
  },
];

const TIER_SIZE = 8; // words per tier; 3 tiers per realm

// The words a level draws from: one realm, one tier, in authored order.
function tierWords(realmIdx, tier) {
  return REALMS[realmIdx].words.slice(tier * TIER_SIZE, (tier + 1) * TIER_SIZE);
}

// Every word in the game, ordered easiest realm/tier first. Endless Siege
// walks this list, so its difficulty ramp comes free from the authoring order.
function allWordsByDifficulty() {
  const out = [];
  REALMS.forEach((realm, ri) => {
    for (let tier = 0; tier < 3; tier++) {
      tierWords(ri, tier).forEach((entry) => out.push({ ...entry, realm: ri, tier }));
    }
  });
  // Sort by tier first so Endless crosses every realm at each difficulty step
  // instead of finishing one realm before starting the next.
  return out.sort((a, b) => a.tier - b.tier || a.realm - b.realm);
}
