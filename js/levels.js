// Word Siege — the campaign.
//
// 18 sieges: three per realm, one per word tier, so the vocabulary and the
// tuning ramp together. Every level is one entry — a new siege is a new row.
//
//   realm  — index into REALMS (js/words.js)
//   tier   — which block of 8 words the siege draws from
//   words  — how many words you have to defend against
//   repair — wall blocks the masons put back after each word you solve
//
// The wall itself is the same size everywhere (RULES.WALL_BASE, plus whatever
// the Master Mason upgrade adds): difficulty comes from longer words, more of
// them, and the repairs drying up. tests/bot.test.js plays the whole campaign
// and asserts each level is winnable by a decent guesser but not by a careless
// one, so change these numbers and let the bot tell you what it did.

const LEVELS = [
  // Beast Wood — learning the ropes, generous repairs.
  { realm: 0, tier: 0, words: 4, repair: 2 },
  { realm: 0, tier: 1, words: 4, repair: 2 },
  { realm: 0, tier: 2, words: 5, repair: 2 },
  // Royal Kitchen
  { realm: 1, tier: 0, words: 4, repair: 2 },
  { realm: 1, tier: 1, words: 5, repair: 1 },
  { realm: 1, tier: 2, words: 5, repair: 1 },
  // Castle Keep
  { realm: 2, tier: 0, words: 5, repair: 1 },
  { realm: 2, tier: 1, words: 5, repair: 1 },
  { realm: 2, tier: 2, words: 5, repair: 1 },
  // Wild Lands
  { realm: 3, tier: 0, words: 5, repair: 1 },
  { realm: 3, tier: 1, words: 6, repair: 1 },
  { realm: 3, tier: 2, words: 6, repair: 1 },
  // Star Reach
  { realm: 4, tier: 0, words: 6, repair: 1 },
  { realm: 4, tier: 1, words: 6, repair: 1 },
  { realm: 4, tier: 2, words: 6, repair: 0 },
  // Dragon Peak — no masons left. Every mistake is permanent.
  { realm: 5, tier: 0, words: 6, repair: 0 },
  { realm: 5, tier: 1, words: 6, repair: 0 },
  { realm: 5, tier: 2, words: 7, repair: 0 },
];

// Display name for a level: "🏰 Castle Keep I".
const TIER_NUMERAL = ["I", "II", "III"];
function levelTitle(idx) {
  const lv = LEVELS[idx];
  return `${REALMS[lv.realm].name} ${TIER_NUMERAL[lv.tier]}`;
}
function levelEmoji(idx) { return REALMS[LEVELS[idx].realm].emoji; }
function levelTheme(idx) { return REALMS[LEVELS[idx].realm].theme; }

// Endless Siege unlocks once the third realm is cleared — by then a player has
// met every mechanic and has a few upgrades to spend coins on.
const ENDLESS_UNLOCK_LEVEL = 9;
