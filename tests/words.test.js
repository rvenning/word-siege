"use strict";
// Word-bank linter. js/words.js is a plain browser script (top-level `const
// REALMS`), so it is loaded through the kit's test harness and its data pulled
// out. Every rule here is one that would otherwise reach a kid: a word with a
// space in it that can never be typed on a 26-key keyboard, a clue that gives
// its own answer away, a tier with too few words to deal a siege from.
//
//   cd word-siege && node --test

const { test } = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { loadScripts } = require("../lib/tools/test-harness.js");

const ROOT = path.join(__dirname, "..");
const { REALMS, TIER_SIZE, tierWords, allWordsByDifficulty, LEVELS } = loadScripts({
  baseDir: ROOT,
  files: ["js/words.js", "js/levels.js"],
  exports: ["REALMS", "TIER_SIZE", "tierWords", "allWordsByDifficulty", "LEVELS"],
});

const MIN_LEN = 5, MAX_LEN = 10;

test("six realms, each with three full tiers", () => {
  assert.equal(REALMS.length, 6);
  REALMS.forEach((r) => {
    assert.equal(r.words.length, TIER_SIZE * 3, `${r.name} should have ${TIER_SIZE * 3} words`);
  });
});

test("every realm has the metadata the map card needs", () => {
  REALMS.forEach((r) => {
    assert.ok(r.id && r.name && r.emoji, `realm ${r.name} missing id/name/emoji`);
    assert.ok(Array.isArray(r.theme) && r.theme.length === 2, `${r.name} needs a 2-colour theme`);
  });
});

test("every word is A-Z only and inside the length band", () => {
  const bad = [];
  REALMS.forEach((r) => r.words.forEach(({ w }) => {
    if (!/^[A-Z]+$/.test(w)) bad.push(`${r.name}: "${w}" is not plain A-Z capitals`);
    if (w.length < MIN_LEN || w.length > MAX_LEN) bad.push(`${r.name}: "${w}" is ${w.length} letters`);
  }));
  assert.deepEqual(bad, [], "\n  - " + bad.join("\n  - "));
});

test("no word appears twice anywhere in the bank", () => {
  const seen = new Map();
  const dupes = [];
  REALMS.forEach((r) => r.words.forEach(({ w }) => {
    if (seen.has(w)) dupes.push(`"${w}" in both ${seen.get(w)} and ${r.name}`);
    else seen.set(w, r.name);
  }));
  assert.deepEqual(dupes, [], "\n  - " + dupes.join("\n  - "));
});

test("every word has a clue, and no clue contains its own answer", () => {
  const bad = [];
  REALMS.forEach((r) => r.words.forEach(({ w, c }) => {
    if (!c || !c.trim()) return bad.push(`${r.name}: "${w}" has no clue`);
    if (c.length > 60) bad.push(`${r.name}: clue for "${w}" is ${c.length} chars — too long for one line`);
    if (c.toUpperCase().includes(w)) bad.push(`${r.name}: clue for "${w}" gives the answer away`);
  }));
  assert.deepEqual(bad, [], "\n  - " + bad.join("\n  - "));
});

test("tiers get harder: average word length climbs within every realm", () => {
  const bad = [];
  REALMS.forEach((r, ri) => {
    const avg = [0, 1, 2].map((t) =>
      tierWords(ri, t).reduce((s, e) => s + e.w.length, 0) / TIER_SIZE);
    if (!(avg[0] <= avg[1] && avg[1] <= avg[2]))
      bad.push(`${r.name}: tier lengths ${avg.map((a) => a.toFixed(1)).join(" -> ")}`);
  });
  assert.deepEqual(bad, [], "\n  - " + bad.join("\n  - "));
});

test("every level can deal the words it asks for", () => {
  const bad = [];
  LEVELS.forEach((lv, i) => {
    const pool = tierWords(lv.realm, lv.tier);
    if (pool.length < lv.words) bad.push(`level ${i + 1} wants ${lv.words} words from a pool of ${pool.length}`);
    if (lv.realm < 0 || lv.realm >= REALMS.length) bad.push(`level ${i + 1} points at realm ${lv.realm}`);
    if (lv.tier < 0 || lv.tier > 2) bad.push(`level ${i + 1} points at tier ${lv.tier}`);
  });
  assert.deepEqual(bad, [], "\n  - " + bad.join("\n  - "));
});

test("every level in the campaign is reachable and every realm is used", () => {
  assert.equal(LEVELS.length, 18, "18 sieges expected");
  const realmsUsed = new Set(LEVELS.map((lv) => lv.realm));
  assert.equal(realmsUsed.size, REALMS.length, "every realm should appear in the campaign");
});

test("the Endless pool holds the whole bank, easiest tier first", () => {
  const pool = allWordsByDifficulty();
  assert.equal(pool.length, REALMS.length * TIER_SIZE * 3);
  const tiers = pool.map((e) => e.tier);
  assert.deepEqual(tiers, tiers.slice().sort((a, b) => a - b), "pool must be ordered by tier");
});
