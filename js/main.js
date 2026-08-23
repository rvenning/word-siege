// App shell: screens, the campaign map, the armoury, the leaderboard, and all
// of the siege's DOM (word slots, keyboard, wall meter, results). Profiles,
// PINs, family sync and the install button come from gamekit; the engine lives
// in js/game.js and never touches anything here — it only fires the callbacks
// wired up in bindEngine().

const AVATARS = ["🛡️", "⚔️", "👑", "🐉", "🏹", "🦅", "🐺", "🦁", "🧙", "🐴", "🦉", "⭐"];
const ALPHA_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const SOLVE_PAUSE_MS = 1500;   // let the player read the finished word

const App = {
  profile: null,
  prog: null,
  busy: false,          // true while a word-solved animation is playing
  banked: 0,            // coins from this run already written to progress

  el(id) { return document.getElementById(id); },

  async init() {
    Sfx.enabled = Storage.getSettings().sound;
    GK.UI.bindSoundToggle(Storage);
    // Every menu button clicks; buttons that make their own sound keep it.
    GK.UI.bindMenuClicks();
    GK.UI.onScreenChange = (name) => {
      Render.active = name === "game";
      if (name === "splash") this.refreshSplash();
      if (name === "game") { Render.resize(); setTimeout(() => Render.resize(), 400); }
    };

    GK.Profiles.init({
      storage: Storage,
      avatars: AVATARS,
      meta: (p, prog) => `⭐ ${Storage.totalScore(prog).toLocaleString()} · 🏅 ${Storage.totalStars(prog)} · 🪙 ${Storage.coins(prog)}`,
      onEnter: (p) => { this.profile = p; this.showMap(); },
      addLabel: "New Defender",
    });

    GK.initPWA({ appName: "Word Siege" });
    this.buildKeyboard();
    Render.init();
    this.bindEngine();

    window.addEventListener("keydown", (e) => {
      if (GK.UI.screen !== "game" || e.metaKey || e.ctrlKey || e.altKey) return;
      const ch = e.key.toUpperCase();
      if (ch.length === 1 && ch >= "A" && ch <= "Z") { e.preventDefault(); this.guess(ch); }
    });
    // iOS hijacks two-finger pinch and never lets go — block it at the source.
    document.addEventListener("gesturestart", (e) => e.preventDefault());
    document.addEventListener("gesturechange", (e) => e.preventDefault());

    GK.Debug.init({ storage: Storage, title: "WORD SIEGE" })
      .action("solve this word", () => {
        while (Game.running && !Game.solved()) Game.revealLetter(true);
        this.syncWord(); if (Game.solved()) Game.winWord();
      })
      .action("smash a block", () => Game.guess(this.unusedMissLetter()))
      .jump("level", LEVELS.length, (n) => this.startLevel(n - 1));

    this.showScreen("splash");
    Storage.initFirebase().then((ok) => {
      this.el("sync-badge").textContent = ok ? "☁️ family sync on" : "📴 offline";
      if (!ok) return;
      if (GK.UI.screen === "profiles") GK.Profiles.renderList();
      if (GK.UI.screen === "splash") this.refreshSplash();
      if (GK.UI.screen === "map") this.showMap();
      if (GK.UI.screen === "leaderboard") this.showLeaderboard(true);
    });
  },

  showScreen(name) { GK.UI.showScreen(name); },

  refreshSplash() {
    const last = GK.Profiles.lastProfile();
    const cont = this.el("btn-continue-as"), start = this.el("btn-start");
    if (last) {
      cont.style.display = "";
      cont.textContent = `⚔️ Continue as ${last.avatar} ${last.name}`;
      cont.onclick = () => { Sfx.init(); GK.Profiles.select(last); };
      start.classList.add("ghost");
      start.textContent = "👥 Switch Player";
    } else {
      cont.style.display = "none";
      start.classList.remove("ghost");
      start.textContent = "⚔️ Defend the Castle";
    }
  },

  play() {
    Sfx.init(); Sfx.click();
    GK.Profiles.renderList();
    this.showScreen("profiles");
  },

  /* ---------- campaign map ---------- */

  showMap() {
    if (!this.profile) return this.play();
    this.prog = Storage.getProgress(this.profile.id);
    const prog = this.prog;
    const unlocked = Storage.unlockedLevel(prog);
    const won = Storage.levelsWon(prog);

    this.el("map-player").innerHTML = `${this.profile.avatar} <b>${GK.util.esc(this.profile.name)}</b>
      <span class="pmeta">⭐ ${Storage.totalScore(prog).toLocaleString()} · 🪙 ${Storage.coins(prog)}</span>`;

    const cont = this.el("btn-continue");
    if (won < LEVELS.length) {
      cont.innerHTML = `▶️ ${levelEmoji(unlocked)} ${GK.util.esc(levelTitle(unlocked))}`;
      cont.onclick = () => this.startLevel(unlocked);
    } else {
      cont.innerHTML = `👑 Every realm defended — replay any siege`;
      cont.onclick = () => Sfx.click();
    }

    const endless = this.el("btn-endless");
    const canEndless = Storage.endlessUnlocked(prog);
    endless.disabled = !canEndless;
    endless.textContent = canEndless
      ? `♾️ Endless Siege${prog.endlessBest ? ` · best ${prog.endlessBest}` : ""}`
      : `🔒 Endless (win ${ENDLESS_UNLOCK_LEVEL} sieges)`;

    const wrap = this.el("level-list");
    wrap.innerHTML = "";
    LEVELS.forEach((lv, i) => {
      const result = prog.levels[i];
      const state = result ? "done" : i <= unlocked ? "open" : "locked";
      const theme = levelTheme(i);
      const card = document.createElement("div");
      card.className = "lvl-card " + state;
      card.style.setProperty("--grad-a", theme[0]);
      card.style.setProperty("--grad-b", theme[1]);

      const stars = result
        ? [0, 1, 2].map((s) => `<span class="star ${s < result.stars ? "on" : ""}">★</span>`).join("")
        : "";
      const badge = state === "done" ? stars
        : state === "open" ? `<span class="lvl-go">▶</span>`
        : `<span class="lvl-lock">🔒</span>`;

      card.innerHTML = `
        <div class="lvl-num">${i + 1}</div>
        <div class="lvl-emoji">${levelEmoji(i)}</div>
        <div class="lvl-info">
          <div class="lvl-title">${GK.util.esc(levelTitle(i))}</div>
          <div class="lvl-ref">${state === "locked"
            ? "Win the siege before this one to unlock"
            : `${lv.words} words · masons rebuild ${lv.repair === 0 ? "nothing" : lv.repair + " a word"}`}</div>
        </div>
        <div class="lvl-badge">${badge}</div>`;

      if (state !== "locked") card.onclick = () => this.startLevel(i);
      wrap.appendChild(card);
    });

    this.showScreen("map");
  },

  showLeaderboard(silent) {
    if (!silent) Sfx.click();
    GK.Profiles.renderLeaderboard("lb-rows", {
      cols: (r) => `<span class="lb-levels">🏰 ${Storage.levelsWon(r.progress)}/${LEVELS.length}</span>
        <span class="lb-stars">🏅 ${Storage.totalStars(r.progress)}</span>
        <span class="lb-endless">♾️ ${r.progress.endlessBest || 0}</span>
        <span class="lb-score">⭐ ${Storage.totalScore(r.progress).toLocaleString()}</span>`,
      sort: (a, b) => Storage.totalScore(b.progress) - Storage.totalScore(a.progress),
      meId: this.profile?.id,
      empty: "No defenders yet — tap Play!",
    });
    this.showScreen("leaderboard");
  },

  showHelp() { Sfx.click(); GK.UI.openModal("modal-help"); },

  /* ---------- armoury ---------- */

  showArmoury() {
    Sfx.click();
    this.prog = Storage.getProgress(this.profile.id);
    this.renderArmoury();
    this.showScreen("armoury");
  },

  renderArmoury() {
    const prog = this.prog;
    const coins = Storage.coins(prog);
    this.el("shop-coins").textContent = coins;

    const wrap = this.el("shop-list");
    wrap.innerHTML = "";
    UPGRADES.forEach((up) => {
      const lvl = upgradeLevel(prog, up.id);
      const maxed = lvl >= up.costs.length;
      const cost = maxed ? null : up.costs[lvl];
      const row = document.createElement("div");
      row.className = "shop-row" + (maxed ? " maxed" : cost > coins ? " poor" : "");
      row.innerHTML = `
        <div class="shop-emoji">${up.emoji}</div>
        <div class="shop-info">
          <div class="shop-name">${up.name} ${
            up.costs.map((_, i) => `<span class="pip ${i < lvl ? "on" : ""}"></span>`).join("")}</div>
          <div class="shop-blurb">${GK.util.esc(up.blurb)}</div>
          <div class="shop-effect">${lvl ? "Now: " + up.effect(lvl) : "&nbsp;"}</div>
        </div>
        <button class="btn small ${maxed ? "grey" : "green"}" ${maxed || cost > coins ? "disabled" : ""}>
          ${maxed ? "MAX" : "🪙 " + cost}
        </button>`;
      const btn = row.querySelector("button");
      if (!maxed && cost <= coins) btn.onclick = () => this.buy(up.id);
      wrap.appendChild(row);
    });
  },

  buy(id) {
    const res = Storage.buyUpgrade(this.profile.id, id);
    if (!res.ok) return GK.UI.toast(res.reason === "coins" ? "Not enough coins yet!" : "Already maxed out");
    this.prog = res.progress;
    Sfx.coin();
    const up = UPGRADES.find((u) => u.id === id);
    GK.UI.toast(`${up.emoji} ${up.name} — ${up.effect(upgradeLevel(this.prog, id))}`);
    this.renderArmoury();
  },

  /* ---------- starting a siege ---------- */

  startLevel(idx) {
    Sfx.init(); Sfx.click();
    this.prog = Storage.getProgress(this.profile.id);
    Render.setTheme(levelTheme(idx));
    Render.reset();
    this.el("hud-level").textContent = `${levelEmoji(idx)} ${levelTitle(idx)}`;
    Game.start({ mode: "campaign", levelIdx: idx, loadout: upgradeLoadout(this.prog) });
    this.enterGame();
  },

  startEndless() {
    if (!Storage.endlessUnlocked(Storage.getProgress(this.profile.id)))
      return GK.UI.toast(`Win ${ENDLESS_UNLOCK_LEVEL} sieges to unlock Endless`);
    Sfx.init(); Sfx.click();
    this.prog = Storage.getProgress(this.profile.id);
    Render.setTheme(["#3a2350", "#8a5ca8"]);
    Render.reset();
    this.el("hud-level").textContent = "♾️ Endless Siege";
    Game.start({ mode: "endless", loadout: upgradeLoadout(this.prog) });
    this.enterGame();
  },

  enterGame() {
    this.busy = false;
    this.banked = 0;
    this.showScreen("game");
    this.syncAll();
  },

  // Write whatever the run has earned since the last time through. Called on
  // every solved word and once more when the siege ends, so the coin counter
  // on screen is always real, spendable money.
  bankCoins() {
    const owed = Game.coins - this.banked;
    if (owed > 0) { this.banked = Game.coins; this.prog = Storage.addCoins(this.profile.id, owed); }
    this.el("hud-coins").textContent = Storage.coins(this.prog);
    this.refreshHintButtons();
  },

  pause() { Sfx.click(); GK.UI.openModal("modal-pause"); },

  quit() {
    GK.UI.closeModal("modal-pause");
    Game.abandon();
    this.showMap();
  },

  /* ---------- engine -> UI ---------- */

  bindEngine() {
    Game.on = {
      wordStart: () => { this.renderKeyboard(); this.syncAll(); },

      hit: ({ letter, positions, hinted }) => {
        Sfx[hinted ? "sparkle" : "hit"](Game.flawless);
        this.syncWord();
        this.renderKeyboard();
        positions.forEach((i) => {
          const slot = this.el("word-slots").children[i];
          if (slot) { slot.classList.remove("pop"); void slot.offsetWidth; slot.classList.add("pop"); }
        });
        this.el("hud-score").textContent = Game.score.toLocaleString();
      },

      miss: ({ wall, wallMax }) => {
        Render.sync(wall, wallMax, { smash: true });
        this.renderKeyboard();
        this.renderWall();
      },

      wordSolved: ({ points, flawless, rebuilt, flawlessRun, wall, wallMax }) => {
        this.busy = true;
        Sfx.wordWin();
        this.syncWord();
        this.renderWall();
        if (rebuilt > 0) {
          setTimeout(() => { Sfx.repair(); Render.sync(wall, wallMax, { repaired: true }); }, 380);
        } else {
          Render.sync(wall, wallMax, { repaired: true });
        }
        this.el("hud-score").textContent = Game.score.toLocaleString();
        this.bankCoins();
        GK.UI.toast(flawless
          ? `🏅 Flawless! +${points}${flawlessRun > 1 ? ` · ${flawlessRun} in a row` : ""}`
          : `✅ Held the wall! +${points}`);
        setTimeout(() => { this.busy = false; Game.advance(); }, SOLVE_PAUSE_MS);
      },

      siegeEnd: (result) => {
        this.busy = true;
        // Reveal the word that broke the wall before the results screen.
        if (!result.win) { Game.word.split("").forEach((ch) => Game.found.add(ch)); this.syncWord(); }
        setTimeout(() => this.finish(result), result.win ? 700 : 1500);
      },
    };
  },

  finish(result) {
    this.busy = false;
    if (result.win) { Sfx.siegeWin(); this.confetti(); } else { Sfx.castleFall(); }
    this.bankCoins();                       // the clear + surviving-wall bonus
    this.prog = Storage.recordSiege(this.profile.id, result);
    this.showResults(result);
  },

  /* ---------- siege DOM ---------- */

  syncAll() {
    this.syncWord();
    this.renderWall();
    this.renderKeyboard();
    this.el("hud-score").textContent = Game.score.toLocaleString();
    this.el("hud-coins").textContent = Storage.coins(this.prog);
    this.el("hud-word").textContent = Game.mode === "endless"
      ? `Word ${Game.wordIdx + 1}`
      : `Word ${Math.min(Game.wordIdx + 1, Game.queue.length)}/${Game.queue.length}`;
    Render.sync(Game.wall, Game.wallMax);
  },

  syncWord() {
    const realmName = Game.mode === "endless" ? "♾️ Anything goes" : `${levelEmoji(Game.levelIdx)} ${REALMS[LEVELS[Game.levelIdx].realm].name}`;
    this.el("word-cat").textContent = realmName;

    const wrap = this.el("word-slots");
    const word = Game.word || "";
    if (wrap.children.length !== word.length) {
      wrap.innerHTML = word.split("").map(() => `<span class="slot"></span>`).join("");
    }
    word.split("").forEach((ch, i) => {
      const slot = wrap.children[i];
      const shown = Game.found.has(ch);
      if (slot.textContent !== (shown ? ch : "")) slot.textContent = shown ? ch : "";
      slot.classList.toggle("filled", shown);
    });
    wrap.classList.toggle("long", word.length >= 9);

    const clue = this.el("word-clue");
    clue.textContent = Game.clueShown ? `📜 ${Game.clue}` : "";
    clue.classList.toggle("shown", Game.clueShown);
    this.refreshHintButtons();
  },

  renderWall() {
    const wrap = this.el("wall-blocks");
    if (wrap.children.length !== Game.wallMax) {
      wrap.innerHTML = Array.from({ length: Game.wallMax }, () => `<span class="wblock"></span>`).join("");
    }
    Array.from(wrap.children).forEach((b, i) => b.classList.toggle("gone", i >= Game.wall));
    wrap.classList.toggle("danger", Game.wall <= 2);
  },

  buildKeyboard() {
    const wrap = this.el("keyboard");
    wrap.innerHTML = ALPHA_ROWS.map((row) =>
      `<div class="krow">${row.split("").map((ch) =>
        `<button class="key" data-ch="${ch}">${ch}</button>`).join("")}</div>`).join("");
    wrap.querySelectorAll(".key").forEach((btn) => {
      btn.onclick = () => this.guess(btn.dataset.ch);
    });
  },

  renderKeyboard() {
    this.el("keyboard").querySelectorAll(".key").forEach((btn) => {
      const state = Game.letterState(btn.dataset.ch);
      btn.classList.toggle("hit", state === "hit");
      btn.classList.toggle("miss", state === "miss");
      btn.disabled = state !== "unused" || !Game.running;
    });
  },

  guess(ch) {
    if (this.busy || !Game.running) return;
    Game.guess(ch);
  },

  /* ---------- hints ---------- */

  refreshHintButtons() {
    const coins = Storage.coins(this.prog);
    const clueBtn = this.el("btn-clue");
    const clueCost = Game.clueCost();
    clueBtn.disabled = Game.clueShown || !Game.running || coins < clueCost;
    clueBtn.textContent = Game.clueShown ? "📜 Clue shown"
      : clueCost === 0 ? "📜 Clue (free)" : `📜 Clue · 🪙 ${clueCost}`;

    const revBtn = this.el("btn-reveal");
    revBtn.disabled = !Game.running || coins < Game.revealCost() || Game.solved();
    revBtn.textContent = `🔍 Reveal a letter · 🪙 ${Game.revealCost()}`;
  },

  buyClue() {
    const cost = Game.clueCost();
    if (cost > 0) {
      const prog = Storage.spendCoins(this.profile.id, cost);
      if (!prog) return GK.UI.toast("Not enough coins for a clue");
      this.prog = prog;
    }
    Sfx.sparkle();
    Game.showClue();
    this.syncWord();
    this.el("hud-coins").textContent = Storage.coins(this.prog);
  },

  buyReveal() {
    const prog = Storage.spendCoins(this.profile.id, Game.revealCost());
    if (!prog) return GK.UI.toast("Not enough coins for a reveal");
    this.prog = prog;
    Game.revealLetter(false);
    this.el("hud-coins").textContent = Storage.coins(this.prog);
  },

  // A letter that is definitely not in the current word (debug panel only).
  unusedMissLetter() {
    return "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")
      .find((ch) => !Game.word.includes(ch) && !Game.guessed.has(ch)) || "Z";
  },

  /* ---------- results ---------- */

  showResults(result) {
    const endless = result.mode === "endless";
    const last = !endless && result.levelIdx >= LEVELS.length - 1;
    const allDone = result.win && last;

    this.el("res-emoji").textContent = result.win ? (result.stars === 3 ? "👑" : "🎉") : "💥";
    this.el("res-title").textContent = endless
      ? `The castle fell after ${result.wordsSolved} word${result.wordsSolved === 1 ? "" : "s"}`
      : result.win
      ? (result.stars === 3 ? "Siege broken — barely a scratch!" : "The castle holds!")
      : "The castle has fallen…";

    this.el("res-stars").innerHTML = endless ? "" :
      [0, 1, 2].map((i) => `<span class="star ${i < result.stars ? "on" : ""}">★</span>`).join("");

    const ans = this.el("res-answer");
    if (result.answer) {
      ans.style.display = "";
      ans.innerHTML = `The word was <b>${GK.util.esc(result.answer)}</b>`;
    } else ans.style.display = "none";

    this.el("res-score").textContent = `⭐ ${result.score.toLocaleString()} points`;
    this.el("res-words").textContent = `📜 ${result.wordsSolved} word${result.wordsSolved === 1 ? "" : "s"} defended`;
    this.el("res-coins").textContent = `🪙 ${result.coins} coins earned`;
    this.el("res-streak").textContent = `🏅 Best flawless run: ${result.bestFlawless}`;

    const next = this.el("res-next"), retry = this.el("res-retry"), fin = this.el("res-finished");
    fin.style.display = allDone ? "" : "none";
    next.style.display = "none"; retry.style.display = "none";

    if (endless) {
      retry.style.display = ""; retry.textContent = "♾️ Again";
      retry.onclick = () => this.startEndless();
    } else if (result.win && !last) {
      next.style.display = ""; next.textContent = "Next siege ➜";
      next.onclick = () => this.startLevel(result.levelIdx + 1);
      retry.style.display = ""; retry.textContent = "🔁 Replay";
      retry.onclick = () => this.startLevel(result.levelIdx);
    } else {
      retry.style.display = ""; retry.textContent = "🔁 Try again";
      retry.onclick = () => this.startLevel(result.levelIdx);
    }

    this.showScreen("results");
  },

  confetti() {
    const canvas = this.el("confetti");
    const ctx = canvas.getContext("2d");
    canvas.width = innerWidth; canvas.height = innerHeight;
    const colors = ["#ffd166", "#ef476f", "#06d6a0", "#118ab2", "#f7f4ea"];
    const parts = Array.from({ length: 150 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.5,
      w: 6 + Math.random() * 8, h: 8 + Math.random() * 10,
      vy: 2 + Math.random() * 3.5, vx: -1.5 + Math.random() * 3,
      rot: Math.random() * Math.PI, vr: -0.15 + Math.random() * 0.3,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    const t0 = performance.now();
    (function frame(t) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (t - t0 < 3000) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    })(t0);
  },
};

window.addEventListener("DOMContentLoaded", () => App.init());
