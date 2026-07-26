"use strict";
// Save-data tests. These cover the code that can permanently ruin a player's
// progress rather than merely annoy them: the cross-device merge (which runs
// unattended whenever two iPads sync) and the coin ledger (which has to make
// spending survive a max() merge).
//
//   cd word-siege && node --test

const { test } = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { loadScripts } = require("../lib/tools/test-harness.js");

const ROOT = path.join(__dirname, "..");

// Fresh sandbox per call: gk-storage keeps state, and localStorage is faked
// per sandbox, so tests can't leak into each other.
function load() {
  return loadScripts({
    baseDir: ROOT,
    files: ["lib/gk-util.js", "lib/gk-storage.js", "js/words.js", "js/levels.js",
            "js/upgrades.js", "js/storage.js"],
    exports: ["Storage", "PROGRESS", "UPGRADES", "upgradeLevel", "LEVELS"],
    browser: true,
  });
}

/* ---------- the merge ---------- */

test("merge keeps the best score and the best stars for every level", () => {
  const { PROGRESS } = load();
  const a = { ...PROGRESS.blank(), levels: { 0: { score: 900, stars: 3 }, 1: { score: 400, stars: 1 } } };
  const b = { ...PROGRESS.blank(), levels: { 1: { score: 700, stars: 2 }, 2: { score: 100, stars: 1 } } };
  const m = PROGRESS.merge(a, b);
  assert.deepEqual(m.levels[0], { score: 900, stars: 3 }, "a level only one device has must survive");
  assert.deepEqual(m.levels[1], { score: 700, stars: 2 }, "the better result must win");
  assert.deepEqual(m.levels[2], { score: 100, stars: 1 });
});

test("merge keeps the higher upgrade level, never the older one", () => {
  const { PROGRESS } = load();
  const a = { ...PROGRESS.blank(), upgrades: { mason: 3, scout: 1 } };
  const b = { ...PROGRESS.blank(), upgrades: { mason: 1, herald: 1 } };
  const m = PROGRESS.merge(a, b);
  assert.deepEqual(m.upgrades, { mason: 3, scout: 1, herald: 1 });
});

test("spent coins stay spent after a sync with a stale device", () => {
  const { PROGRESS } = load();
  // This device earned 500 and spent 300. The other one is a week behind and
  // has only seen 400 earned, nothing spent. A balance field would come back
  // as 400 here — free money on every sync. The two counters can't do that.
  const here = { ...PROGRESS.blank(), coinsEarned: 500, coinsSpent: 300 };
  const stale = { ...PROGRESS.blank(), coinsEarned: 400, coinsSpent: 0 };
  const m = PROGRESS.merge(here, stale);
  assert.equal(m.coinsEarned, 500);
  assert.equal(m.coinsSpent, 300);
  assert.equal(m.coinsEarned - m.coinsSpent, 200, "the balance must not grow by merging");
});

test("merge keeps the better Endless run and any field it doesn't know about", () => {
  const { PROGRESS } = load();
  const a = { ...PROGRESS.blank(), endlessBest: 12, endlessScore: 4000, futureField: "keep me" };
  const b = { ...PROGRESS.blank(), endlessBest: 9, endlessScore: 6000 };
  const m = PROGRESS.merge(a, b);
  assert.equal(m.endlessBest, 12);
  assert.equal(m.endlessScore, 6000);
  assert.equal(m.futureField, "keep me", "a field a newer build added was dropped by the merge");
});

/* ---------- the coin ledger ---------- */

test("an upgrade costs coins, raises its level, and stops at max", () => {
  const { Storage, UPGRADES, upgradeLevel } = load();
  const mason = UPGRADES.find((u) => u.id === "mason");
  const prog = Storage.getProgress("p1");
  prog.coinsEarned = 10000;
  Storage.saveProgress("p1", prog);

  let spent = 0;
  mason.costs.forEach((cost, i) => {
    const res = Storage.buyUpgrade("p1", "mason");
    assert.ok(res.ok, `buying mason level ${i + 1} failed: ${res.reason}`);
    spent += cost;
    assert.equal(upgradeLevel(res.progress, "mason"), i + 1);
    assert.equal(Storage.coins(res.progress), 10000 - spent);
  });
  assert.deepEqual(Storage.buyUpgrade("p1", "mason"), { ok: false, reason: "maxed" });
});

test("you cannot buy what you cannot afford", () => {
  const { Storage } = load();
  const prog = Storage.getProgress("p2");
  prog.coinsEarned = 5;
  Storage.saveProgress("p2", prog);
  assert.deepEqual(Storage.buyUpgrade("p2", "mason"), { ok: false, reason: "coins" });
  assert.equal(Storage.coins(Storage.getProgress("p2")), 5, "a failed purchase still took coins");
});

test("spending on a hint never drives the balance below zero", () => {
  const { Storage } = load();
  const prog = Storage.getProgress("p3");
  prog.coinsEarned = 20;
  Storage.saveProgress("p3", prog);
  assert.ok(Storage.spendCoins("p3", 15));
  assert.equal(Storage.spendCoins("p3", 15), null, "overspending was allowed");
  assert.equal(Storage.coins(Storage.getProgress("p3")), 5);
});

/* ---------- recording a siege ---------- */

test("coins are banked as they are won, so a lost siege still pays", () => {
  const { Storage } = load();
  const start = Storage.coins(Storage.getProgress("p4"));
  Storage.addCoins("p4", 12);
  Storage.addCoins("p4", 6);
  const prog = Storage.recordSiege("p4", {
    mode: "campaign", win: false, levelIdx: 0, score: 400, stars: 0, coins: 18, wordsSolved: 2,
  });
  assert.equal(Storage.coins(prog), start + 18, "coins won during the run were lost");
  assert.deepEqual(prog.levels, {}, "a loss recorded a level result");
  assert.equal(Storage.unlockedLevel(prog), 0, "a loss unlocked the next siege");
});

test("recording a siege never double-pays the coins already banked", () => {
  const { Storage } = load();
  const start = Storage.coins(Storage.getProgress("p4b"));
  Storage.addCoins("p4b", 40);
  const prog = Storage.recordSiege("p4b", { mode: "campaign", win: true, levelIdx: 0, score: 900, stars: 2, coins: 40 });
  assert.equal(Storage.coins(prog), start + 40, "the run's coins were counted twice");
});

test("winning records the level, and a worse replay never overwrites a better one", () => {
  const { Storage } = load();
  Storage.recordSiege("p5", { mode: "campaign", win: true, levelIdx: 0, score: 1200, stars: 3, coins: 40 });
  const prog = Storage.recordSiege("p5", { mode: "campaign", win: true, levelIdx: 0, score: 300, stars: 1, coins: 10 });
  assert.deepEqual(prog.levels[0], { score: 1200, stars: 3 }, "a weaker replay overwrote the best result");
  assert.equal(Storage.unlockedLevel(prog), 1);
});

test("Endless keeps the longest run, and never touches the campaign", () => {
  const { Storage } = load();
  Storage.recordSiege("p6", { mode: "endless", win: false, score: 5000, wordsSolved: 14, coins: 60 });
  const prog = Storage.recordSiege("p6", { mode: "endless", win: false, score: 2000, wordsSolved: 9, coins: 20 });
  assert.equal(prog.endlessBest, 14);
  assert.equal(prog.endlessScore, 5000);
  assert.deepEqual(prog.levels, {}, "an endless run recorded a campaign level");
});

test("Endless unlocks only after the campaign requirement is met", () => {
  const { Storage, LEVELS } = load();
  const prog = Storage.getProgress("p7");
  assert.equal(Storage.endlessUnlocked(prog), false);
  for (let i = 0; i < 9; i++) prog.levels[i] = { score: 100, stars: 1 };
  assert.equal(Storage.endlessUnlocked(prog), true);
  assert.ok(LEVELS.length >= 9, "the unlock needs at least that many sieges to exist");
});
