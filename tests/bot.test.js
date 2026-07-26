"use strict";
// Headless balance bots. These drive the REAL engine (js/game.js has no DOM,
// canvas or audio) through every siege in the campaign, so the numbers below
// are what a player actually meets.
//
// Four bots, because one is never enough:
//
//   realm  — reads the banner ("Beast Wood"), so it eliminates candidates from
//            that realm's 24 words as letters appear. This is the model of a
//            thoughtful player and the campaign has to be winnable by it.
//   bank   — same elimination, but over all 144 words: knows it's a word in
//            this game, not which realm. A capable player who isn't paying
//            attention to the banner.
//   freq   — guesses E, T, A, O, I... and never thinks about meaning at all.
//            The floor: whatever this bot manages, anyone manages.
//   alpha  — guesses A, B, C, D... in order. The control. If this bot can win
//            a siege, missing letters cost nothing and the wall is decoration.
//
//   cd word-siege && node --test
//   node tests/bot.test.js --report     # per-siege table

const path = require("node:path");
const { loadScripts } = require("../lib/tools/test-harness.js");

const ROOT = path.join(__dirname, "..");
const S = loadScripts({
  baseDir: ROOT,
  files: ["tests/seed.js", "js/words.js", "js/levels.js", "js/upgrades.js", "js/game.js"],
  exports: ["Game", "RULES", "LEVELS", "REALMS", "tierWords", "allWordsByDifficulty",
            "upgradeLoadout", "ALPHABET", "__reseed", "__rand"],
});
const { Game, RULES, LEVELS, tierWords, allWordsByDifficulty, upgradeLoadout, ALPHABET } = S;

const NO_UPGRADES = upgradeLoadout({});
const FULL_UPGRADES = upgradeLoadout({ upgrades: { mason: 3, scout: 2, herald: 1, crew: 2 } });

/* ---------- the bots ---------- */

const FREQ = "ETAOINSHRDLUCMFWYGPBVKXQJZ".split("");
const freqBot = () => (G) => FREQ.find((ch) => !G.guessed.has(ch));
const alphaBot = () => (G) => ALPHABET.find((ch) => !G.guessed.has(ch));

// Knows the pool the word was drawn from and narrows it as letters land.
function solverBot(pool) {
  return (G) => {
    const missed = [...G.guessed].filter((ch) => !G.found.has(ch));
    const candidates = pool.filter(({ w }) => {
      if (w.length !== G.word.length) return false;
      if (missed.some((ch) => w.includes(ch))) return false;
      // Revealed letters must sit in exactly the positions the board shows.
      for (const ch of G.found) {
        for (let i = 0; i < w.length; i++) {
          if ((G.word[i] === ch) !== (w[i] === ch)) return false;
        }
      }
      return true;
    });
    if (!candidates.length) return FREQ.find((ch) => !G.guessed.has(ch));

    const score = {};
    candidates.forEach(({ w }) => {
      new Set(w.split("")).forEach((ch) => {
        if (!G.guessed.has(ch)) score[ch] = (score[ch] || 0) + 1;
      });
    });
    const best = Object.keys(score).sort((a, b) => score[b] - score[a])[0];
    return best || FREQ.find((ch) => !G.guessed.has(ch));
  };
}

// The one that actually matters: a realm-solver that loses the thread three
// guesses in ten and picks something at random instead. An eight-year-old
// knows the words but not the whole list, and doesn't always follow the
// pattern through. The campaign is tuned so THIS bot mostly wins.
function kidBot(pool) {
  const clever = solverBot(pool);
  return (G) => {
    if (S.__rand() < 0.3) {
      const left = ALPHABET.filter((ch) => !G.guessed.has(ch));
      return left[Math.floor(S.__rand() * left.length)];
    }
    return clever(G);
  };
}

/* ---------- driving a siege ---------- */

// The pool a bot gets to reason over. `realm` sees the 24 words of the realm
// named on the banner; everyone else sees the whole bank (or nothing at all).
function poolFor(levelIdx, scope) {
  if (scope === "realm") return S.REALMS[LEVELS[levelIdx].realm].words;
  return allWordsByDifficulty();
}

function playCampaign(levelIdx, makeStrategy, loadout = NO_UPGRADES, scope = "bank") {
  Game.start({ mode: "campaign", levelIdx, loadout });
  return drive(makeStrategy(poolFor(levelIdx, scope)));
}

function playEndless(makeStrategy, loadout = NO_UPGRADES) {
  Game.start({ mode: "endless", loadout });
  return drive(makeStrategy(allWordsByDifficulty()), 4000);
}

function drive(strategy, cap = 600) {
  let guesses = 0;
  while (Game.running && guesses < cap) {
    const ch = strategy(Game);
    if (!ch) break;                 // exhausted the alphabet on one word
    Game.guess(ch);
    guesses++;
    if (Game.running && Game.solved()) Game.advance();
  }
  return Game.result || { win: false, stars: 0, score: 0, wordsSolved: Game.wordsSolved, wrongTotal: Game.wrongTotal, wall: Game.wall, wallMax: Game.wallMax };
}

// Same seed for every bot on every run, so a changed number is a changed
// design and never a lucky deal.
function runAll(makeStrategy, loadout, scope) {
  S.__reseed(20260726);
  return LEVELS.map((_, i) => playCampaign(i, makeStrategy, loadout, scope));
}

/* ---------- report mode ---------- */

if (process.argv.includes("--report")) {
  const rows = [
    ["realm", runAll(solverBot, NO_UPGRADES, "realm")],
    ["kid", runAll(kidBot, NO_UPGRADES, "realm")],
    ["kid+kit", runAll(kidBot, FULL_UPGRADES, "realm")],
    ["freq", runAll(freqBot, NO_UPGRADES)],
    ["alpha", runAll(alphaBot, NO_UPGRADES)],
  ];
  console.log("\nsiege                    " + rows.map(([n]) => n.padStart(11)).join(""));
  LEVELS.forEach((lv, i) => {
    const label = `${String(i + 1).padStart(2)} ${levelName(i)}`.padEnd(25);
    console.log(label + rows.map(([, res]) => {
      const r = res[i];
      return `${r.win ? r.stars + "*" : "LOSS"}/${r.wrongTotal}w`.padStart(11);
    }).join(""));
  });
  rows.forEach(([name, res]) => {
    const wins = res.filter((r) => r.win).length;
    const stars = res.reduce((s, r) => s + (r.stars || 0), 0);
    const coins = res.reduce((s, r) => s + (r.coins || 0), 0);
    console.log(`${name.padEnd(12)} wins ${wins}/${LEVELS.length}  stars ${stars}/${LEVELS.length * 3}  coins ${coins}`);
  });
  [["bank", solverBot, NO_UPGRADES], ["bank+kit", solverBot, FULL_UPGRADES], ["freq", freqBot, NO_UPGRADES]]
    .forEach(([name, bot, kit]) => {
      S.__reseed(7);
      const r = playEndless(bot, kit);
      console.log(`endless (${name}): ${r.wordsSolved} words, ${r.score} points, ${r.wrongTotal} misses`);
    });
  return;
}

function levelName(i) {
  const lv = LEVELS[i];
  return `${S.REALMS[lv.realm].name} ${["I", "II", "III"][lv.tier]}`;
}

/* ---------- the assertions ---------- */

const { test } = require("node:test");
const assert = require("node:assert");

const realm = runAll(solverBot, NO_UPGRADES, "realm");
const kid = runAll(kidBot, NO_UPGRADES, "realm");
const kidKit = runAll(kidBot, FULL_UPGRADES, "realm");
const freq = runAll(freqBot, NO_UPGRADES);
const alpha = runAll(alphaBot, NO_UPGRADES);

const wins = (res) => res.filter((r) => r.win).length;
const stars = (res) => res.reduce((s, r) => s + (r.stars || 0), 0);

test("every siege is winnable: a player who reads the banner clears the campaign", () => {
  const lost = realm.map((r, i) => (r.win ? null : `${i + 1} ${levelName(i)}`)).filter(Boolean);
  assert.deepEqual(lost, [], `unwinnable sieges: ${lost.join(", ")}`);
});

test("the on-ramp is gentle: an ordinary player clears the first two realms", () => {
  const early = wins(kid.slice(0, 6));
  assert.ok(early >= 5, `the kid bot only won ${early}/6 opening sieges — realm 1-2 are too hard`);
});

test("the campaign is a real challenge for an ordinary player, not a wall", () => {
  const w = wins(kid);
  assert.ok(w >= 9, `the kid bot won only ${w}/${LEVELS.length} — too punishing`);
  assert.ok(w <= 16, `the kid bot won ${w}/${LEVELS.length} — nothing to come back for`);
  const perfect = kid.filter((r) => r.stars === 3).length;
  assert.ok(perfect < LEVELS.length, "an ordinary player 3-starred every siege — no headroom");
  assert.ok(stars(kid) >= 15, `only ${stars(kid)} stars for an ordinary player — the cutoffs are too mean`);
});

test("guessing the alphabet in order is not a strategy", () => {
  const w = wins(alpha);
  assert.ok(w <= 2, `the A-B-C bot won ${w}/${LEVELS.length} sieges — missing letters costs too little`);
  assert.equal(alpha[LEVELS.length - 1].win, false, "the last siege must beat a careless player");
});

test("guessing common letters without thinking is not a strategy either", () => {
  const w = wins(freq);
  assert.ok(w <= 4, `the E-T-A-O bot won ${w}/${LEVELS.length} sieges — the words don't have to be read`);
});

test("the armoury pays for itself without erasing the game", () => {
  assert.ok(wins(kidKit) > wins(kid),
    `a fully-kitted ordinary player won ${wins(kidKit)} vs ${wins(kid)} unaided — the armoury does nothing`);
  assert.ok(stars(kidKit) > stars(kid), "upgrades bought no extra stars");
  assert.ok(kidKit.some((r) => r.stars < 3 || !r.win),
    "full upgrades 3-star the entire campaign — the armoury erases the game");
});

test("every siege costs the player something", () => {
  const free = realm.map((r, i) => (r.wrongTotal === 0 ? levelName(i) : null)).filter(Boolean);
  assert.ok(free.length <= 3,
    `${free.length} sieges cost a good player nothing at all: ${free.join(", ")}`);
});

test("an Endless run is long enough to feel like a run, short enough to retry", () => {
  S.__reseed(7);
  const plain = playEndless(solverBot);
  assert.ok(plain.wordsSolved >= 6, `endless ended after ${plain.wordsSolved} words — too abrupt`);
  assert.ok(plain.wordsSolved <= 60, `endless ran to ${plain.wordsSolved} words — it never gets hard enough`);
  assert.equal(plain.win, false, "endless must always end with the castle falling");

  // The siege rate has to beat a flawless player too, upgrades and all.
  S.__reseed(7);
  const kitted = playEndless(solverBot, FULL_UPGRADES);
  assert.equal(kitted.win, false, "a fully-kitted perfect player never lost — endless has no clock");
  assert.ok(kitted.wordsSolved <= 80, `kitted endless reached ${kitted.wordsSolved} words`);
});

test("scoring rewards the better siege", () => {
  S.__reseed(101);
  const good = playCampaign(5, solverBot, NO_UPGRADES, "realm");
  S.__reseed(101);
  const sloppy = playCampaign(5, kidBot, NO_UPGRADES, "realm");
  assert.ok(good.wall >= sloppy.wall, "the better bot finished with a weaker wall");
  if (sloppy.win) assert.ok(good.score > sloppy.score, "a cleaner win scored no better");
});
