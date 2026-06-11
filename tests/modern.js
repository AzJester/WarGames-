/*
 * DOM-free tests for the modern-mode core (dot map, arc math, mode
 * persistence, ASCII fallback). Run: node tests/modern.js
 */
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const store = {};
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => (store[k] = String(v)),
  removeItem: (k) => delete store[k],
};

function load() {
  const src = ["js/parser.js", "js/geo.js", "js/games/gtw.js", "js/modern.js"]
    .map((f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8"))
    .join("\n");
  const tmp = path.join(os.tmpdir(), `modern-under-test-${process.pid}-${Math.random()}.js`);
  fs.writeFileSync(tmp, src + "\nmodule.exports = { Modern, GTWCore };\n");
  const mod = require(tmp);
  fs.unlinkSync(tmp);
  return mod;
}

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log("ok - " + name);
}

check("defaults to modern with no stored preference", () => {
  for (const k of Object.keys(store)) delete store[k];
  const { Modern } = load();
  assert.strictEqual(Modern.isModern(), true);
});

check("setMode toggles and persists; bad values normalize to modern", () => {
  for (const k of Object.keys(store)) delete store[k];
  const { Modern } = load();
  Modern.setMode("classic");
  assert.strictEqual(Modern.isModern(), false);
  assert.strictEqual(store["wargames-mode"], "classic");
  Modern.setMode("nonsense");
  assert.strictEqual(Modern.isModern(), true);
});

check("a stored classic preference is honored on load", () => {
  for (const k of Object.keys(store)) delete store[k];
  store["wargames-mode"] = "classic";
  const { Modern } = load();
  assert.strictEqual(Modern.isModern(), false);
});

check("mapDots extracts only land cells, inside the grid", () => {
  const { Modern, GTWCore } = load();
  const dots = Modern.mapDots(GTWCore.MAP);
  assert.ok(dots.length > 200, "expected a populated world, got " + dots.length);
  for (const [x, y] of dots) {
    assert.ok(x >= 0 && x < GTWCore.MAP_W && y >= 0 && y < GTWCore.MAP_H);
    assert.strictEqual(GTWCore.MAP[y][x], "░");
  }
  const landCells = GTWCore.MAP.join("").split("░").length - 1;
  assert.strictEqual(dots.length, landCells);
});

check("arcPoint starts at the site, ends on target, and rises between", () => {
  const { Modern } = load();
  const from = [9, 4];
  const to = [40, 5];
  const [x0, y0] = Modern.arcPoint(from, to, 0);
  const [x1, y1] = Modern.arcPoint(from, to, 1);
  assert.strictEqual(Math.round(x0), from[0]);
  assert.strictEqual(Math.round(y0), from[1]);
  assert.strictEqual(Math.round(x1), to[0]);
  assert.strictEqual(Math.round(y1), to[1]);
  const [, ym] = Modern.arcPoint(from, to, 0.5);
  assert.ok(ym < Math.min(from[1], to[1]), "midpoint should arc above both endpoints");
});

check("renderVolley reports unsupported without a DOM", () => {
  const { Modern } = load();
  assert.strictEqual(Modern.renderVolley({}, ["X"], []), false);
});

console.log(`\nALL TESTS PASSED (${passed})`);
