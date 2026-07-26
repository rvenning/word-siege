// Persistence: gamekit storage (lib/gk-storage.js) configured for Word Siege.
// ws_* localStorage keys, "wordsiege" Firestore collection.
//
// Coins are SPENT in the armoury, so a plain max() merge would resurrect spent
// coins the next time two devices sync. Both sides of the ledger are monotonic
// counters instead — coinsEarned and coinsSpent only ever grow — and the
// balance is derived, which makes max() always safe.

const PROGRESS = {
  blank: () => ({
    // A small float so a first-time player can afford a clue in their very
    // first siege — coins are otherwise only won by finishing words.
    coinsEarned: 30, coinsSpent: 0,
    levels: {},          // { [idx]: { score, stars } } best result per level
    upgrades: {},        // { [upgradeId]: level }
    endlessBest: 0,      // words defended in the longest Endless Siege
    endlessScore: 0,
    updated: 0,
  }),

  merge: (a, b) => {
    const levels = { ...(a.levels || {}) };
    for (const [idx, lv] of Object.entries(b.levels || {})) {
      const cur = levels[idx];
      levels[idx] = cur
        ? { score: Math.max(cur.score || 0, lv.score || 0), stars: Math.max(cur.stars || 0, lv.stars || 0) }
        : lv;
    }
    const upgrades = { ...(a.upgrades || {}) };
    for (const [id, lvl] of Object.entries(b.upgrades || {}))
      upgrades[id] = Math.max(upgrades[id] || 0, lvl);
    return {
      // Spread first so a field a newer build added survives an older client's merge.
      ...a, ...b,
      coinsEarned: Math.max(a.coinsEarned || 0, b.coinsEarned || 0),
      coinsSpent: Math.max(a.coinsSpent || 0, b.coinsSpent || 0),
      endlessBest: Math.max(a.endlessBest || 0, b.endlessBest || 0),
      endlessScore: Math.max(a.endlessScore || 0, b.endlessScore || 0),
      levels, upgrades,
    };
  },
};

const Storage = GK.createStorage({
  prefix: "ws",
  collection: "wordsiege",
  firebaseConfig: window.FIREBASE_CONFIG,
  blankProgress: PROGRESS.blank,
  mergeProgress: PROGRESS.merge,
});

/* ----- Word Siege-specific helpers on top of the kit storage ----- */
Object.assign(Storage, {
  coins(prog) { return Math.max(0, (prog.coinsEarned || 0) - (prog.coinsSpent || 0)); },

  totalScore(prog) {
    return Object.values(prog.levels || {}).reduce((s, l) => s + (l.score || 0), 0);
  },

  totalStars(prog) {
    return Object.values(prog.levels || {}).reduce((s, l) => s + (l.stars || 0), 0);
  },

  // Levels unlock in order: the one after the highest you've won.
  unlockedLevel(prog) {
    let max = -1;
    for (const k of Object.keys(prog.levels || {})) max = Math.max(max, Number(k));
    return Math.min(max + 1, LEVELS.length - 1);
  },

  levelsWon(prog) { return Object.keys(prog.levels || {}).length; },

  endlessUnlocked(prog) { return this.levelsWon(prog) >= ENDLESS_UNLOCK_LEVEL; },

  // Coins are banked the moment they're won, not at the end of the siege, so
  // the counter moves while you play and a hint can be bought with what the
  // last word paid. A run that ends badly keeps whatever it had already earned.
  addCoins(profileId, amount) {
    if (!amount) return this.getProgress(profileId);
    const prog = this.getProgress(profileId);
    prog.coinsEarned = (prog.coinsEarned || 0) + amount;
    this.saveProgress(profileId, prog);
    return prog;
  },

  // Record a finished siege. Only a WIN records the level, because recording a
  // loss would unlock the next one. Coins are already banked (see addCoins).
  recordSiege(profileId, result) {
    const prog = this.getProgress(profileId);

    if (result.mode === "endless") {
      prog.endlessBest = Math.max(prog.endlessBest || 0, result.wordsSolved || 0);
      prog.endlessScore = Math.max(prog.endlessScore || 0, result.score || 0);
    } else if (result.win) {
      const cur = prog.levels[result.levelIdx];
      prog.levels[result.levelIdx] = {
        score: Math.max((cur && cur.score) || 0, result.score || 0),
        stars: Math.max((cur && cur.stars) || 0, result.stars || 0),
      };
    }

    this.saveProgress(profileId, prog);
    return prog;
  },

  spendCoins(profileId, amount) {
    const prog = this.getProgress(profileId);
    if (this.coins(prog) < amount) return null;
    prog.coinsSpent = (prog.coinsSpent || 0) + amount;
    this.saveProgress(profileId, prog);
    return prog;
  },

  buyUpgrade(profileId, id) {
    const prog = this.getProgress(profileId);
    const def = UPGRADES.find((u) => u.id === id);
    const lvl = upgradeLevel(prog, id);
    if (!def || lvl >= def.costs.length) return { ok: false, reason: "maxed" };
    const cost = def.costs[lvl];
    if (this.coins(prog) < cost) return { ok: false, reason: "coins" };
    prog.coinsSpent = (prog.coinsSpent || 0) + cost;
    prog.upgrades = prog.upgrades || {};
    prog.upgrades[id] = lvl + 1;
    this.saveProgress(profileId, prog);
    return { ok: true, progress: prog, cost };
  },
});
