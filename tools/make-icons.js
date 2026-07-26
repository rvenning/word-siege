// Generates Word Siege's PWA icons with the kit's PNG painter.
// A stone castle silhouette on a dusk-violet field, with a gold banner and a
// letter slot cut into the gatehouse — the word and the wall in one mark.
// Run: node tools/make-icons.js   (from the game folder)
const fs = require("fs");
const path = require("path");
const { makeCanvas, downsample, encodePNG } = require("../lib/tools/png.js");

const DUSK = "#2b2340";
const DUSK_DK = "#1a1429";
const STONE = "#e2dac9";
const STONE_SH = "#b3a894";
const DARK = "#4a4033";
const GOLD = "#ffc94d";

// `scale` shrinks the motif toward the centre (maskable keeps its art ~72%).
function drawIcon(size, scale) {
  const SS = 4, big = size * SS;
  const cv = makeCanvas(big);

  // Flat dusk field. No gradient band: a second rounded rect leaves visible
  // arcs where its corners curve away, which reads as a rendering fault.
  cv.fillRoundRect(0, 0, big, big, big * 0.22, DUSK);

  const cx = big / 2;
  const ground = big * 0.72;
  const u = big * 0.085 * scale;          // one "block" of the castle

  // A few stars, well clear of the corner radius.
  [[0.24, 0.20], [0.38, 0.13], [0.62, 0.17], [0.76, 0.26], [0.5, 0.08]]
    .forEach(([sx, sy], i) => cv.fillCircle(big * sx, big * sy, big * (i % 2 ? 0.011 : 0.016), GOLD, 0.75));

  // Soft shadow under the castle, kept inside the rounded field.
  cv.fillEllipse(cx, ground + u * 0.35, u * 4.4, u * 0.6, DUSK_DK, 0.8);

  // Merlons across the top of a box.
  const merlons = (x, w, top, h, n) => {
    const step = w / n;
    for (let i = 0; i < n; i++) cv.fillRect(x + i * step + step * 0.12, top, step * 0.76, h, STONE);
  };

  // Flanking towers.
  const towerW = u * 1.5;
  [cx - u * 3.4, cx + u * 1.9].forEach((tx) => {
    cv.fillRect(tx, ground - u * 3.2, towerW, u * 3.2, STONE);
    cv.fillRect(tx + towerW - u * 0.28, ground - u * 3.2, u * 0.28, u * 3.2, STONE_SH);
    merlons(tx, towerW, ground - u * 3.8, u * 0.6, 3);
    cv.fillRect(tx + towerW / 2 - u * 0.2, ground - u * 2.5, u * 0.4, u * 0.6, DARK);
  });

  // Gatehouse between them.
  const gx = cx - u * 1.6, gw = u * 3.2;
  cv.fillRect(gx, ground - u * 2.5, gw, u * 2.5, STONE);
  cv.fillRect(gx + gw - u * 0.28, ground - u * 2.5, u * 0.28, u * 2.5, STONE_SH);
  merlons(gx, gw, ground - u * 3.0, u * 0.55, 4);

  // The gate reads as a filled letter slot: dark arch with a gold underline.
  cv.fillRoundRect(gx + u * 0.75, ground - u * 1.8, gw - u * 1.5, u * 1.8, u * 0.65, DARK);
  cv.fillRect(gx + u * 0.75, ground - u * 0.3, gw - u * 1.5, u * 0.3, GOLD);

  // Banner on a pole above the gatehouse.
  const px = cx, ptop = ground - u * 4.9;
  cv.fillRect(px - u * 0.09, ptop, u * 0.18, u * 2.0, STONE_SH);
  cv.fillTriangle(px + u * 0.09, ptop + u * 0.1,
                  px + u * 1.5, ptop + u * 0.62,
                  px + u * 0.09, ptop + u * 1.15, GOLD);

  return encodePNG(size, size, downsample(cv.px, big, SS));
}

const out = path.join(__dirname, "..", "icons");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "icon-512.png"), drawIcon(512, 1.0));
fs.writeFileSync(path.join(out, "icon-192.png"), drawIcon(192, 1.0));
fs.writeFileSync(path.join(out, "maskable-512.png"), drawIcon(512, 0.76));
console.log("Word Siege icons written");
