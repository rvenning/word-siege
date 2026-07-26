// WebAudio sound effects — gamekit's synth core (lib/gk-audio.js) plus Word
// Siege's own noises. Everything is synthesized; there are no audio files.
// click/coin/win/lose/wrong come from the kit defaults.
const Sfx = GK.Sfx;

Object.assign(Sfx, {
  // A struck letter: a bright ping that climbs with the flawless streak.
  hit(streak = 0) {
    const step = Math.min(streak, 7);
    this.tone({ freq: 640 * Math.pow(2, step / 12), type: "triangle", dur: 0.09, vol: 0.2 });
    this.tone({ freq: 960 * Math.pow(2, step / 12), type: "sine", dur: 0.12, vol: 0.14, when: 0.06 });
  },

  // Catapult release — a low whump and the rope singing.
  launch() {
    this.noise({ dur: 0.09, vol: 0.16 });
    this.tone({ freq: 180, type: "sawtooth", dur: 0.16, vol: 0.12, slide: -90 });
  },

  // The boulder landing: crunch of stone plus a thud you feel.
  smash() {
    this.noise({ dur: 0.24, vol: 0.3 });
    this.tone({ freq: 110, type: "square", dur: 0.22, vol: 0.2, slide: -60 });
    this.tone({ freq: 70, type: "sine", dur: 0.3, vol: 0.18, slide: -30, when: 0.03 });
  },

  // Masons at work — three quick chisel taps.
  repair() {
    [0, 0.07, 0.14].forEach((t, i) =>
      this.tone({ freq: 900 + i * 160, type: "square", dur: 0.05, vol: 0.11, when: t }));
  },

  // A word defended: short trumpet fanfare.
  wordWin() {
    [523, 659, 784].forEach((f, i) =>
      this.tone({ freq: f, type: "triangle", dur: 0.16, vol: 0.2, when: i * 0.08 }));
  },

  // Siege survived — the full fanfare.
  siegeWin() {
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      this.tone({ freq: f, type: "triangle", dur: 0.24, vol: 0.22, when: i * 0.11 }));
  },

  // The castle coming down: a long collapsing rumble.
  castleFall() {
    this.noise({ dur: 0.9, vol: 0.3 });
    [220, 165, 110].forEach((f, i) =>
      this.tone({ freq: f, type: "sawtooth", dur: 0.5, vol: 0.16, slide: -80, when: i * 0.16 }));
  },

  // Scout's spyglass / a bought reveal.
  sparkle() {
    [1200, 1600, 2000].forEach((f, i) =>
      this.tone({ freq: f, type: "sine", dur: 0.09, vol: 0.13, when: i * 0.05 }));
  },
});
