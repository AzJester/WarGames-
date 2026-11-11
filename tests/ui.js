/*
 * DOM-free tests for the settings registry behind the toolbar, the
 * options panel, and the typed commands. Run: node tests/ui.js
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
  const src = ["js/sound.js", "js/modern.js", "js/engine.js", "js/ui.js"]
    .map((f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8"))
    .join("\n");
  const tmp = path.join(os.tmpdir(), `ui-under-test-${process.pid}-${Math.random()}.js`);
  fs.writeFileSync(tmp, src + "\nmodule.exports = { Settings, UI, COMMAND_HELP, DEFAULT_HELP };\n");
  const mod = require(tmp);
  fs.unlinkSync(tmp);
  return mod;
}

function reset() {
  for (const k of Object.keys(store)) delete store[k];
}

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log("ok - " + name);
}

check("defaults: sound and voice on, normal speed, buttons on, captions off", () => {
  reset();
  const { Settings } = load();
  assert.strictEqual(Settings.get("sound"), "on");
  assert.strictEqual(Settings.get("voice"), "on");
  assert.strictEqual(Settings.get("speed"), "normal");
  assert.strictEqual(Settings.get("captions"), "off");
  assert.strictEqual(Settings.get("buttons"), "on");
  assert.strictEqual(Settings.get("mode"), "modern");
  assert.strictEqual(Settings.get("view"), "flat");
  assert.strictEqual(Settings.get("difficulty"), "normal");
  assert.strictEqual(Settings.get("nonsense"), null);
});

check("every setting accepts each of its options and reports it back", () => {
  reset();
  const { Settings } = load();
  for (const d of Settings.defs) {
    assert.ok(d.label && d.note && d.options.length >= 2, d.key);
    for (const opt of d.options) {
      assert.strictEqual(Settings.set(d.key, opt), opt, d.key + "=" + opt);
      assert.strictEqual(Settings.get(d.key), opt);
    }
  }
});

check("an unknown value leaves the setting alone", () => {
  reset();
  const { Settings } = load();
  assert.strictEqual(Settings.set("difficulty", "impossible"), "normal");
  assert.strictEqual(Settings.set("speed", "ludicrous"), "normal");
  assert.strictEqual(Settings.set("nonsense", "on"), null);
});

check("settings persist across a reload", () => {
  reset();
  let { Settings } = load();
  Settings.set("sound", "off");
  Settings.set("speed", "fast");
  Settings.set("captions", "on");
  Settings.set("buttons", "off");
  Settings.set("mode", "classic");
  Settings.set("view", "polar");
  Settings.set("difficulty", "hard");
  ({ Settings } = load());
  assert.strictEqual(Settings.get("sound"), "off");
  assert.strictEqual(Settings.get("speed"), "fast");
  assert.strictEqual(Settings.get("captions"), "on");
  assert.strictEqual(Settings.get("buttons"), "off");
  assert.strictEqual(Settings.get("mode"), "classic");
  assert.strictEqual(Settings.get("view"), "polar");
  assert.strictEqual(Settings.get("difficulty"), "hard");
});

check("the keys match what earlier versions stored", () => {
  // Players who set these before the options panel existed keep them.
  reset();
  store["wargames-fast"] = "1";
  store["wargames-captions"] = "on";
  store["wargames-sound"] = "off";
  store["wargames-mode"] = "classic";
  const { Settings } = load();
  assert.strictEqual(Settings.get("speed"), "fast");
  assert.strictEqual(Settings.get("captions"), "on");
  assert.strictEqual(Settings.get("sound"), "off");
  assert.strictEqual(Settings.get("mode"), "classic");
});

check("listeners hear every change", () => {
  reset();
  const { Settings } = load();
  const heard = [];
  Settings.onChange((key, value) => heard.push(key + "=" + value));
  Settings.set("voice", "off");
  Settings.set("view", "polar");
  Settings.set("view", "sideways"); // rejected: no event
  assert.deepStrictEqual(heard, ["voice=off", "view=polar"]);
});

check("the UI is a safe no-op without a document", () => {
  reset();
  const { UI, COMMAND_HELP, DEFAULT_HELP } = load();
  UI.init({ fast: false });
  assert.strictEqual(UI.open(), false);
  assert.strictEqual(UI.isOpen(), false);
  UI.close();
  UI.sync();
  assert.ok(COMMAND_HELP.length >= 8 && COMMAND_HELP.every((row) => row.length === 2));
  assert.ok(DEFAULT_HELP.length > 10);
});

console.log(`\nALL TESTS PASSED (${passed})`);
