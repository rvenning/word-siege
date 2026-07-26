// Word Siege — the castle canvas.
//
// A fixed 400x220 logical stage, scaled to whatever space the layout gives it
// and centred, with the sky painted right out to the canvas edges so there are
// never letterbox bars. The wall's 13 pieces come down in a fixed order from
// the flag at the top to the gatehouse at the bottom, and the engine's block
// count is mapped onto them by ratio — so the castle looks the same at the
// start of a siege whether the wall is 10 blocks or 13 with the Master Mason.
//
// Everything here is presentation. The engine (js/game.js) never calls into it.

const STAGE_W = 400, STAGE_H = 220;
const GROUND = 182;

// Castle geometry (logical px).
const KEEP = { x: 232, w: 56, top: 62, mer: 12 };
const TOWER_L = { x: 168, w: 44, top: 104, mer: 11 };
const TOWER_R = { x: 308, w: 44, top: 104, mer: 11 };
const WALL_L = { x: 212, w: 32, top: 132, mer: 9 };
const WALL_R = { x: 276, w: 32, top: 132, mer: 9 };
const GATE = { x: 244, w: 32, top: 118, mer: 9 };
const PIECES = 13;   // destroyed in the order listed in drawCastle()

const Render = {
  cv: null, ctx: null, dpr: 1,
  cssW: 0, cssH: 0, scale: 1, ox: 0, oy: 0,
  active: false,
  last: 0,

  destroyed: 0,        // pieces currently gone (animated toward `target`)
  target: 0,           // what the art is heading for right now
  pending: 0,          // what the engine says it should be — the truth
  boulders: [],
  banner: ["#4a4b8f", "#9aa0e8"],
  flagWave: 0,
  catapultRecoil: 0,
  cheer: 0,

  init() {
    this.cv = document.getElementById("cv");
    if (!this.cv) return;
    this.ctx = this.cv.getContext("2d");
    window.addEventListener("resize", () => this.resize());
    window.addEventListener("orientationchange", () => setTimeout(() => this.resize(), 350));
    if (window.visualViewport) window.visualViewport.addEventListener("resize", () => this.resize());
    this.resize();
    requestAnimationFrame((t) => this.loop(t));
  },

  // Backing store at device pixels, CSS size pinned to the stage box, drawing
  // in logical px. Without the explicit CSS size a retina canvas renders 2-3x
  // too large and overflows the screen (invisible on a desktop preview).
  resize() {
    if (!this.cv) return;
    const box = this.cv.parentElement;
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;               // screen hidden — keep the last good layout
    this.dpr = window.devicePixelRatio || 1;
    this.cssW = w; this.cssH = h;
    this.cv.style.width = w + "px";
    this.cv.style.height = h + "px";
    this.cv.width = Math.round(w * this.dpr);
    this.cv.height = Math.round(h * this.dpr);
    this.scale = Math.min(w / STAGE_W, h / STAGE_H);
    this.ox = (w - STAGE_W * this.scale) / 2;
    this.oy = (h - STAGE_H * this.scale) / 2;
  },

  setTheme(theme) { this.banner = theme || this.banner; },

  // Full castle, no boulders in flight.
  reset() {
    this.destroyed = 0; this.target = 0; this.pending = 0;
    this.boulders.length = 0; this.cheer = 0;
    Fx.reset();
  },

  // Point the engine's block count at the wall art. `smash` throws a boulder
  // and lets the impact land the damage; `pending` records the truth either
  // way, and update() snaps to it once nothing is in flight — so the art can
  // never get permanently stuck behind the engine (a paused tab, a flurry of
  // fast guesses) the way it would if only the impact ever moved it.
  sync(wall, wallMax, { smash = false, repaired = false } = {}) {
    const gone = Math.floor(PIECES * (wallMax - wall) / wallMax);
    this.pending = gone;
    if (smash && gone > this.target) {
      this.launch(gone);
    } else {
      this.target = gone;
      if (repaired) this.cheer = 0.9;
    }
  },

  launch(gone) {
    const aim = this.aimPoint(gone);
    this.boulders.push({ t: 0, dur: 0.62, x0: 44, y0: 150, x1: aim.x, y1: aim.y, gone, spin: 0 });
    this.catapultRecoil = 1;
    Sfx.launch();
  },

  // Where the next boulder should land: roughly at the piece about to go.
  aimPoint(gone) {
    const frac = Math.min(1, gone / PIECES);
    return { x: 210 + frac * 60 + Math.random() * 40, y: 80 + frac * 70 + Math.random() * 14 };
  },

  loop(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000 || 0);
    this.last = t;
    if (this.active) { this.update(dt); this.draw(); }
    requestAnimationFrame((t2) => this.loop(t2));
  },

  update(dt) {
    this.flagWave += dt * 3;
    this.catapultRecoil = Math.max(0, this.catapultRecoil - dt * 3);
    this.cheer = Math.max(0, this.cheer - dt);

    for (let i = this.boulders.length - 1; i >= 0; i--) {
      const b = this.boulders[i];
      b.t += dt; b.spin += dt * 9;
      if (b.t >= b.dur) {
        this.impact(b);
        this.boulders.splice(i, 1);
      }
    }
    if (!this.boulders.length) this.target = this.pending;

    // The wall settles into its new state rather than popping.
    if (this.destroyed < this.target) this.destroyed = Math.min(this.target, this.destroyed + dt * 12);
    else if (this.destroyed > this.target) this.destroyed = Math.max(this.target, this.destroyed - dt * 6);

    Fx.update(dt);
  },

  impact(b) {
    this.target = Math.max(this.target, b.gone);
    Fx.addShake(b.gone >= PIECES ? 9 : 5.5);
    Fx.dust(b.x1, b.y1, 14, "rgba(214,203,180,0.9)");
    Fx.burst(b.x1, b.y1, "#8d8172", 12, 150, 0.6, 2.4);
    Sfx.smash();
  },

  /* ---------- painting ---------- */

  draw() {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.paintSky(ctx);

    // shakeOffset() returns a [x, y] TUPLE. Reading it as {x, y} gives NaN, and
    // a translate() with a NaN argument is silently ignored — the scene then
    // renders un-centred with no shake and nothing in the console.
    const [shx, shy] = Fx.shakeOffset();
    ctx.save();
    ctx.translate(this.ox + shx * this.scale, this.oy + shy * this.scale);
    ctx.scale(this.scale, this.scale);

    this.paintHills(ctx);
    this.paintGround(ctx);
    this.drawCastle(ctx);
    this.drawCatapult(ctx);
    this.drawBoulders(ctx);
    Fx.render(ctx);
    ctx.restore();
  },

  // Sky is painted over the WHOLE canvas, past the stage, so a tall or wide
  // container never shows bars around the scene.
  paintSky(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, this.cssH || 1);
    g.addColorStop(0, this.banner[0]);
    g.addColorStop(1, GK.util.shade(this.banner[1], 20));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.cssW, this.cssH);
  },

  paintHills(ctx) {
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    ctx.beginPath();
    ctx.moveTo(-80, GROUND);
    for (let x = -80; x <= STAGE_W + 80; x += 20) {
      ctx.lineTo(x, GROUND - 26 - Math.sin(x * 0.021) * 16 - Math.cos(x * 0.013) * 9);
    }
    ctx.lineTo(STAGE_W + 80, GROUND);
    ctx.closePath();
    ctx.fill();
  },

  paintGround(ctx) {
    ctx.fillStyle = "#4e6b3a";
    ctx.fillRect(-80, GROUND, STAGE_W + 160, STAGE_H);
    ctx.fillStyle = "#3d5730";
    ctx.fillRect(-80, GROUND, STAGE_W + 160, 4);
    // Scrub tufts, stable per position so they don't crawl between frames.
    ctx.fillStyle = "rgba(120,158,86,0.75)";
    for (let x = -60; x < STAGE_W + 60; x += 13) {
      const h = 2 + Math.floor(GK.util.hash2(x, 7) * 997) % 4;
      ctx.fillRect(x, GROUND + 6 + (x % 3), 3, h);
    }
    // Rubble piles up as the wall comes down.
    const rub = this.destroyed / PIECES;
    if (rub > 0.02) {
      ctx.fillStyle = "rgba(150,140,124,0.9)";
      for (let i = 0; i < Math.floor(rub * 26); i++) {
        const x = 176 + (Math.floor(GK.util.hash2(i, 3) * 997) % 170);
        const s = 3 + (i % 4);
        ctx.fillRect(x, GROUND - s + 2, s + 2, s);
      }
    }
  },

  alive(i) { return i >= this.destroyed; },

  // Merlons — the square teeth along the top of a wall or tower.
  merlons(ctx, box, colour) {
    const n = Math.max(2, Math.round(box.w / 11));
    const step = box.w / n;
    ctx.fillStyle = colour;
    for (let i = 0; i < n; i++) {
      ctx.fillRect(box.x + i * step + 1, box.top, step - 2, box.mer);
    }
  },

  block(ctx, x, y, w, h, colour, shadeColour) {
    ctx.fillStyle = colour;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = shadeColour;
    ctx.fillRect(x + w - 5, y, 5, h);          // shaded right edge
    ctx.fillStyle = "rgba(0,0,0,0.10)";
    for (let yy = y + 8; yy < y + h; yy += 9) ctx.fillRect(x, yy, w, 1);  // courses
  },

  drawCastle(ctx) {
    const STONE = "#d7cfc0", STONE_SH = "#ab9d8c", DARK = "#6f6657";
    const alive = (i) => this.alive(i);

    // --- keep (behind everything) ---
    if (alive(9)) this.block(ctx, KEEP.x, KEEP.top + KEEP.mer, KEEP.w, 48, STONE, STONE_SH);
    if (alive(12)) this.block(ctx, KEEP.x, KEEP.top + KEEP.mer + 48, KEEP.w, GROUND - (KEEP.top + KEEP.mer + 48), STONE, STONE_SH);
    if (alive(1)) this.merlons(ctx, KEEP, STONE);
    if (alive(9)) {   // keep window
      ctx.fillStyle = DARK;
      ctx.fillRect(KEEP.x + KEEP.w / 2 - 4, KEEP.top + KEEP.mer + 14, 8, 13);
    }

    // --- flag ---
    if (alive(0)) {
      const px = KEEP.x + KEEP.w / 2, py = KEEP.top - 30;
      ctx.strokeStyle = "#8a7a5c"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, KEEP.top + 2); ctx.stroke();
      ctx.fillStyle = this.banner[1];
      ctx.beginPath();
      ctx.moveTo(px + 1, py + 1);
      ctx.lineTo(px + 24 + Math.sin(this.flagWave) * 3, py + 7 + Math.sin(this.flagWave * 1.3) * 2);
      ctx.lineTo(px + 1, py + 15);
      ctx.closePath(); ctx.fill();
    }

    // --- towers ---
    const tower = (t, merIdx, upIdx) => {
      const bodyTop = t.top + t.mer;
      if (alive(upIdx)) this.block(ctx, t.x, bodyTop, t.w, 34, STONE, STONE_SH);
      this.block(ctx, t.x, bodyTop + 34, t.w, GROUND - bodyTop - 34, STONE, STONE_SH); // stump survives
      if (alive(merIdx)) this.merlons(ctx, t, STONE);
      if (alive(upIdx)) {
        ctx.fillStyle = DARK;
        ctx.fillRect(t.x + t.w / 2 - 3, bodyTop + 10, 6, 11);
      }
    };
    tower(TOWER_L, 2, 7);
    tower(TOWER_R, 3, 8);

    // --- curtain walls ---
    const curtain = (wl, merIdx, bodyIdx) => {
      if (alive(bodyIdx)) this.block(ctx, wl.x, wl.top + wl.mer, wl.w, GROUND - wl.top - wl.mer, STONE, STONE_SH);
      if (alive(merIdx)) this.merlons(ctx, wl, STONE);
    };
    curtain(WALL_L, 4, 10);
    curtain(WALL_R, 5, 11);

    // --- gatehouse ---
    if (alive(12)) {
      this.block(ctx, GATE.x, GATE.top + GATE.mer, GATE.w, GROUND - GATE.top - GATE.mer, STONE, STONE_SH);
      // arched gate
      ctx.fillStyle = DARK;
      ctx.beginPath();
      ctx.moveTo(GATE.x + 7, GROUND);
      ctx.lineTo(GATE.x + 7, GROUND - 20);
      ctx.arc(GATE.x + GATE.w / 2, GROUND - 20, GATE.w / 2 - 7, Math.PI, 0);
      ctx.lineTo(GATE.x + GATE.w - 7, GROUND);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#5b4b33"; ctx.lineWidth = 1.4;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(GATE.x + 7 + i * ((GATE.w - 14) / 4), GROUND);
        ctx.lineTo(GATE.x + 7 + i * ((GATE.w - 14) / 4), GROUND - 26);
        ctx.stroke();
      }
    }
    if (alive(6)) this.merlons(ctx, GATE, STONE);

    // Cheering defenders after a word is won.
    if (this.cheer > 0) {
      ctx.globalAlpha = Math.min(1, this.cheer * 1.6);
      ctx.font = "12px 'Baloo 2', sans-serif";
      ctx.textAlign = "center";
      const bob = Math.sin(this.cheer * 18) * 2;
      ctx.fillText("🎉", WALL_L.x + 16, WALL_L.top - 4 + bob);
      ctx.fillText("🎉", WALL_R.x + 16, WALL_R.top - 6 - bob);
      ctx.globalAlpha = 1;
    }
  },

  drawCatapult(ctx) {
    const x = 44, y = GROUND;
    const r = this.catapultRecoil;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#6b4a2c";
    ctx.fillRect(-22, -14, 44, 8);                       // frame
    ctx.fillStyle = "#513620";
    ctx.fillRect(-18, -6, 6, 6); ctx.fillRect(12, -6, 6, 6);
    ctx.strokeStyle = "#7a5533"; ctx.lineWidth = 4;
    ctx.beginPath();                                      // throwing arm
    ctx.moveTo(-4, -12);
    const ang = -1.15 + r * 1.1;
    ctx.lineTo(-4 + Math.cos(ang) * 26, -12 + Math.sin(ang) * 26);
    ctx.stroke();
    ctx.fillStyle = "#3f3a33";
    ctx.beginPath(); ctx.arc(-20, -2, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(16, -2, 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  },

  drawBoulders(ctx) {
    for (const b of this.boulders) {
      const t = b.t / b.dur;
      const x = GK.util.lerp(b.x0, b.x1, t);
      const y = GK.util.lerp(b.y0, b.y1, t) - Math.sin(Math.PI * t) * 72;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(b.spin);
      ctx.fillStyle = "#5f574c";
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#7b7264";
      ctx.beginPath(); ctx.arc(-2, -2, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  },
};
