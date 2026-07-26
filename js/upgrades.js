// Word Siege — the armoury. Permanent upgrades bought with coins, one entry
// each. `costs` is per level bought, so its length is the maximum level.
//
// Everything here makes a siege easier, never faster-scoring: the leaderboard
// stays honest because points come from letters and surviving walls, and a
// fully-kitted player has spent thousands of coins to get there.

const UPGRADES = [
  {
    id: "mason",
    name: "Master Mason",
    emoji: "🧱",
    blurb: "Build the wall a block thicker. One more mistake you can survive.",
    costs: [40, 110, 240],
    effect: (lvl) => `+${lvl} wall block${lvl === 1 ? "" : "s"}`,
  },
  {
    id: "scout",
    name: "Scout",
    emoji: "🔭",
    blurb: "Your scout peeks at the enemy word and gives you a letter for free.",
    costs: [70, 220],
    effect: (lvl) => `${lvl} letter${lvl === 1 ? "" : "s"} revealed at the start of every word`,
  },
  {
    id: "herald",
    name: "Herald",
    emoji: "📜",
    blurb: "The herald shouts the clue from the wall — no coins needed.",
    costs: [90],
    effect: () => "Clues are free",
  },
  {
    id: "crew",
    name: "Repair Crew",
    emoji: "⚒️",
    blurb: "Extra masons rebuild the wall after every word you win.",
    costs: [140, 320],
    effect: (lvl) => `+${lvl} block${lvl === 1 ? "" : "s"} repaired per word`,
  },
];

// Level of an upgrade a player owns (0 = not bought).
function upgradeLevel(progress, id) {
  return (progress && progress.upgrades && progress.upgrades[id]) || 0;
}

// The tuning an owned set of upgrades applies to a siege.
function upgradeLoadout(progress) {
  return {
    wallBonus: upgradeLevel(progress, "mason"),
    scout: upgradeLevel(progress, "scout"),
    freeClues: upgradeLevel(progress, "herald") > 0,
    repairBonus: upgradeLevel(progress, "crew"),
  };
}
