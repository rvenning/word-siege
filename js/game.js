// Word Siege — the siege engine.
//
// Hangman with a castle instead of a gallows: one shared wall stands in for the
// six body parts, and it lasts the WHOLE level rather than resetting each word,
// so a bad guess early is still costing you three words later. Solving a word
// sends the masons out to rebuild a block or two (levels.js `repair`).
//
// This file touches no DOM, no canvas and no audio — it is driven identically
// by main.js and by tests/bot.test.js, which is what lets the headless bot play
// the real campaign. Everything the UI needs to react to comes out through the
// `on` callbacks at the bottom.

const RULES = {
  WALL_BASE: 10,          // blocks a castle starts with, before the Master Mason
  POINTS_LETTER: 10,      // per letter position revealed
  POINTS_WORD: 100,       // per word defended
  POINTS_PER_CHAR: 15,    // extra per letter of a defended word (long words pay)
  POINTS_FLAWLESS: 150,   // word defended without a single wrong guess
  POINTS_STREAK: 50,      // per flawless word in a row, beyond the first
  STREAK_CAP: 5,          // streak bonus stops growing here
  POINTS_WALL: 40,        // per block still standing when the siege is won
  COINS_WORD: 6,
  COINS_FLAWLESS: 4,
  COINS_WALL: 3,
  COINS_CLEAR: 20,
  CLUE_COST: 8,           // coins — free with the Herald upgrade
  REVEAL_COST: 15,        // coins to have a letter revealed mid-word
  STAR_CUTOFFS: [0.01, 0.4, 0.7], // fraction of the wall left -> 1, 2, 3 stars
};

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const Game = {
  running: false,
  mode: "campaign",       // "campaign" | "endless"
  levelIdx: 0,

  queue: [],              // [{ w, c }] words this siege must survive
  endlessPool: null,      // endless mode walks this instead of `queue`
  wordIdx: -1,
  word: "",
  clue: "",
  found: null,            // Set of letters revealed in the current word
  guessed: null,          // Set of every letter tried in the current word
  wrongThisWord: 0,
  clueShown: false,

  wall: 0,
  wallMax: 0,
  repair: 0,
  loadout: null,          // from upgradeLoadout(progress)

  score: 0,
  coins: 0,               // coins EARNED this run (never a balance — see storage.js)
  wordsSolved: 0,
  flawless: 0,            // current run of words solved with no wrong guesses
  bestFlawless: 0,
  wrongTotal: 0,
  hintsUsed: 0,

  result: null,           // { win, stars, ... } once the siege ends
  on: {},                 // { wordStart, hit, miss, wordSolved, siegeEnd, repair }

  emit(name, data) { const fn = this.on[name]; if (fn) fn(data || {}); },

  /* ---------- setup ---------- */

  // cfg: { mode, levelIdx, loadout }. `loadout` comes from upgradeLoadout().
  start(cfg = {}) {
    this.mode = cfg.mode || "campaign";
    this.levelIdx = cfg.levelIdx || 0;
    this.loadout = cfg.loadout || { wallBonus: 0, scout: 0, freeClues: false, repairBonus: 0 };

    const lv = this.mode === "endless" ? null : LEVELS[this.levelIdx];
    this.queue = this.mode === "endless" ? [] : this.dealWords(lv);
    this.endlessPool = this.mode === "endless" ? this.shuffleTiers(allWordsByDifficulty()) : null;
    this.repair = (this.mode === "endless" ? 1 : lv.repair) + this.loadout.repairBonus;

    this.wallMax = RULES.WALL_BASE + this.loadout.wallBonus;
    this.wall = this.wallMax;

    this.wordIdx = -1;
    this.score = 0;
    this.coins = 0;
    this.wordsSolved = 0;
    this.flawless = 0;
    this.bestFlawless = 0;
    this.wrongTotal = 0;
    this.hintsUsed = 0;
    this.result = null;
    this.running = true;

    this.nextWord();
  },

  // A campaign level deals `words` at random from its tier, shortest first, so
  // the siege warms up even though the set changes on every replay.
  dealWords(lv) {
    const pool = tierWords(lv.realm, lv.tier).slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, lv.words).sort((a, b) => a.w.length - b.w.length);
  },

  // Endless keeps the authored tier order (so it gets harder) but shuffles
  // within each tier, so two runs never present the same sequence.
  shuffleTiers(list) {
    const byTier = [[], [], []];
    list.forEach((entry) => byTier[entry.tier].push(entry));
    byTier.forEach((group) => {
      for (let i = group.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [group[i], group[j]] = [group[j], group[i]];
      }
    });
    return byTier.flat();
  },

  /* ---------- the current word ---------- */

  nextWord() {
    this.wordIdx++;
    const entry = this.mode === "endless"
      ? this.endlessPool[this.wordIdx % this.endlessPool.length]
      : this.queue[this.wordIdx];

    if (!entry) return this.endSiege(true);

    this.word = entry.w;
    this.clue = entry.c;
    this.found = new Set();
    this.guessed = new Set();
    this.wrongThisWord = 0;
    this.clueShown = false;

    // The Scout reveals letters up front — pick the rarest ones so it actually
    // helps (revealing E in a word full of Es gives away almost nothing).
    for (let i = 0; i < this.loadout.scout; i++) this.revealLetter(true);

    this.emit("wordStart", { word: this.word, index: this.wordIdx, total: this.total() });
    // A short word with few distinct letters can arrive already solved once the
    // Scout has had its look. Both drivers reach the win through winWord().
    if (this.solved()) this.winWord();
  },

  total() { return this.mode === "endless" ? Infinity : this.queue.length; },

  // Blocks the masons put back after a word. A campaign siege pays a flat rate;
  // Endless pays less every six words and eventually starts TAKING blocks, so
  // even a player who never misses a letter is on a clock.
  repairFor() {
    if (this.mode !== "endless") return this.repair;
    return 1 - Math.floor(this.wordsSolved / 6) + this.loadout.repairBonus;
  },

  // "C _ S T _ E" — the player's view of the word.
  masked() {
    return this.word.split("").map((ch) => (this.found.has(ch) ? ch : "")).join("");
  },

  solved() {
    return this.word.length > 0 && this.word.split("").every((ch) => this.found.has(ch));
  },

  // "unused" | "hit" | "miss" — drives the keyboard colours.
  letterState(ch) {
    if (!this.guessed.has(ch)) return "unused";
    return this.found.has(ch) ? "hit" : "miss";
  },

  /* ---------- guessing ---------- */

  guess(ch) {
    if (!this.running) return { status: "ignored" };
    ch = String(ch || "").toUpperCase();
    if (!ALPHABET.includes(ch) || this.guessed.has(ch)) return { status: "ignored" };

    this.guessed.add(ch);
    const positions = [];
    this.word.split("").forEach((c, i) => { if (c === ch) positions.push(i); });

    if (positions.length) {
      this.found.add(ch);
      this.score += positions.length * RULES.POINTS_LETTER;
      this.emit("hit", { letter: ch, positions });
      if (this.solved()) this.winWord();
      return { status: "hit", positions };
    }

    this.wrongThisWord++;
    this.wrongTotal++;
    this.wall = Math.max(0, this.wall - 1);
    this.flawless = 0;
    this.emit("miss", { letter: ch, wall: this.wall, wallMax: this.wallMax });

    if (this.wall === 0) this.endSiege(false);
    return { status: "miss", wall: this.wall };
  },

  winWord() {
    this.wordsSolved++;
    const flawless = this.wrongThisWord === 0;
    if (flawless) {
      this.flawless++;
      this.bestFlawless = Math.max(this.bestFlawless, this.flawless);
    }

    let points = RULES.POINTS_WORD + this.word.length * RULES.POINTS_PER_CHAR;
    if (flawless) {
      points += RULES.POINTS_FLAWLESS
        + Math.min(this.flawless - 1, RULES.STREAK_CAP) * RULES.POINTS_STREAK;
    }
    this.score += points;
    this.coins += RULES.COINS_WORD + (flawless ? RULES.COINS_FLAWLESS : 0);

    // Masons rebuild — never past the original wall. In Endless the rate goes
    // negative eventually, so this can also take the last block.
    const before = this.wall;
    this.wall = Math.max(0, Math.min(this.wallMax, this.wall + this.repairFor()));
    const rebuilt = this.wall - before;

    this.emit("wordSolved", {
      word: this.word, points, flawless, rebuilt,
      flawlessRun: this.flawless, wall: this.wall, wallMax: this.wallMax,
    });
    if (this.wall === 0) this.endSiege(false);
  },

  // Called by the UI once its word-solved animation has played out.
  advance() {
    if (!this.running) return;
    if (this.mode !== "endless" && this.wordIdx >= this.queue.length - 1) return this.endSiege(true);
    this.nextWord();
  },

  /* ---------- hints ---------- */

  // Reveal one letter of the current word. `quiet` is the Scout doing it at the
  // start of a word (no coin cost, no event). Prefers the letter that appears
  // least often, so a hint is always worth having.
  revealLetter(quiet) {
    const candidates = {};
    this.word.split("").forEach((ch) => {
      if (!this.found.has(ch)) candidates[ch] = (candidates[ch] || 0) + 1;
    });
    const letters = Object.keys(candidates);
    if (!letters.length) return null;
    letters.sort((a, b) => candidates[a] - candidates[b]);
    const rarest = letters.filter((ch) => candidates[ch] === candidates[letters[0]]);
    const ch = rarest[Math.floor(Math.random() * rarest.length)];

    this.found.add(ch);
    this.guessed.add(ch);
    if (!quiet) {
      this.hintsUsed++;
      this.emit("hit", { letter: ch, positions: this.positionsOf(ch), hinted: true });
      if (this.solved()) this.winWord();
    }
    return ch;
  },

  positionsOf(ch) {
    const out = [];
    this.word.split("").forEach((c, i) => { if (c === ch) out.push(i); });
    return out;
  },

  clueCost() { return this.loadout.freeClues ? 0 : RULES.CLUE_COST; },
  revealCost() { return RULES.REVEAL_COST; },

  showClue() { this.clueShown = true; return this.clue; },

  /* ---------- the end ---------- */

  endSiege(win) {
    if (!this.running) return;
    this.running = false;

    if (win) {
      this.score += this.wall * RULES.POINTS_WALL;
      this.coins += this.wall * RULES.COINS_WALL + RULES.COINS_CLEAR;
    }

    const frac = this.wallMax ? this.wall / this.wallMax : 0;
    let stars = 0;
    if (win) {
      stars = 1;
      if (frac >= RULES.STAR_CUTOFFS[1]) stars = 2;
      if (frac >= RULES.STAR_CUTOFFS[2]) stars = 3;
    }

    this.result = {
      win, stars,
      score: this.score,
      coins: this.coins,
      wordsSolved: this.wordsSolved,
      wrongTotal: this.wrongTotal,
      bestFlawless: this.bestFlawless,
      wall: this.wall,
      wallMax: this.wallMax,
      // The word that broke the wall — but not if the wall fell to the siege
      // rate in Endless, where the last word was actually solved.
      answer: win || this.solved() ? null : this.word,
      levelIdx: this.levelIdx,
      mode: this.mode,
    };
    this.emit("siegeEnd", this.result);
    return this.result;
  },

  // Give up on a run without recording a win (the quit button).
  abandon() { this.running = false; this.result = null; },
};
