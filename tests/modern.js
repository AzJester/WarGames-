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


check("the board footer always has a form that keeps T-MINUS", () => {
  const { Modern } = load();
  const forms = Modern.footerForms({ inbound: 14, impacts: 3, intercepted: 3, clock: "03:30" });
  assert.ok(forms.length >= 3);
  for (const f of forms) assert.ok(/T-(MINUS )?03:30$/.test(f), f);
  assert.ok(forms[0].includes("INTERCEPTED: 3"));
  for (let i = 1; i < forms.length; i++) assert.ok(forms[i].length < forms[i - 1].length);
  const none = Modern.footerForms({ inbound: 1, impacts: 0, intercepted: 0, clock: "00:10" });
  assert.ok(!none[0].includes("INTERCEPTED"));
});

check("the targeting map frames every city inside its box", () => {
  const { Modern, GTWCore } = load();
  for (const targets of [GTWCore.TARGETS_US, GTWCore.TARGETS_USSR]) {
    const region = Modern.regionFor(targets);
    const box = { x: 8, y: 30, w: 338, h: 120 };
    const project = Modern.regionProjector(region, box);
    for (const t of targets) {
      const [x, y] = project(t.lon, t.lat);
      assert.ok(x > box.x && x < box.x + box.w, t.name + " x " + x);
      assert.ok(y > box.y && y < box.y + box.h, t.name + " y " + y);
    }
    // north is up and east is right
    const [, yN] = project(region.lon0, region.lat1);
    const [, yS] = project(region.lon0, region.lat0);
    assert.ok(yN < yS);
    const [xW] = project(region.lon0, region.lat0);
    const [xE] = project(region.lon1, region.lat0);
    assert.ok(xW < xE);
  }
});

check("clicks resolve to the nearest city within reach", () => {
  const { Modern } = load();
  const pts = [[10, 10], [50, 10], [52, 14]];
  assert.strictEqual(Modern.nearestPoint(pts, 11, 12, 24), 0);
  assert.strictEqual(Modern.nearestPoint(pts, 53, 15, 24), 2);
  assert.strictEqual(Modern.nearestPoint(pts, 200, 200, 24), -1);
  assert.strictEqual(Modern.nearestPoint([], 0, 0, 24), -1);
});

check("map labels never overlap each other or leave the box", () => {
  const { Modern, GTWCore } = load();
  const box = { x: 8, y: 30, w: 338, h: 120 }; // a phone-sized map
  const project = Modern.regionProjector(Modern.regionFor(GTWCore.TARGETS_US), box);
  const pts = GTWCore.TARGETS_US.map((t) => project(t.lon, t.lat));
  const widths = GTWCore.TARGETS_US.map((t) => t.name.length * 5 + 4);
  const rects = Modern.placeLabels(pts, widths, 11, box);
  const placed = rects.filter(Boolean);
  assert.ok(placed.length >= 8, "most cities get a label: " + placed.length);
  for (const r of placed) {
    assert.ok(r.x >= box.x && r.y >= box.y && r.x + r.w <= box.x + box.w && r.y + r.h <= box.y + box.h);
  }
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i];
      const b = placed[j];
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      assert.ok(!overlap, "labels " + i + " and " + j + " overlap");
    }
  }
});

console.log(`\nALL TESTS PASSED (${passed})`);
