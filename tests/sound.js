/*
 * DOM-free tests for the sound module. WebAudio is absent under node, so
 * every method must be a safe no-op while the enabled flag and its
 * persistence still work. Run: node tests/sound.js
 */
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

// A minimal localStorage so persistence can be exercised.
const store = {};
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => (store[k] = String(v)),
  removeItem: (k) => delete store[k],
};

function load() {
  const src = fs.readFileSync(path.join(__dirname, "..", "js", "sound.js"), "utf8");
  const tmp = path.join(os.tmpdir(), `sound-under-test-${process.pid}-${Math.random()}.js`);
  fs.writeFileSync(tmp, src + "\nmodule.exports = { Sound };\n");
  delete require.cache[tmp];
  const mod = require(tmp);
  fs.unlinkSync(tmp);
  return mod.Sound;
}

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log("ok - " + name);
}

check("defaults to enabled with no stored preference", () => {
  for (const k of Object.keys(store)) delete store[k];
  const Sound = load();
  assert.strictEqual(Sound.isEnabled(), true);
});

check("every method is a safe no-op without WebAudio", () => {
  const Sound = load();
  assert.doesNotThrow(() => {
    Sound.unlock();
    Sound.modem();
    Sound.klaxon();
    Sound.click();
    Sound.beep();
  });
});

check("setEnabled toggles and persists", () => {
  for (const k of Object.keys(store)) delete store[k];
  const Sound = load();
  Sound.setEnabled(false);
  assert.strictEqual(Sound.isEnabled(), false);
  assert.strictEqual(store["wargames-sound"], "off");
  Sound.setEnabled(true);
  assert.strictEqual(store["wargames-sound"], "on");
});

check("a stored 'off' preference is honored on load", () => {
  for (const k of Object.keys(store)) delete store[k];
  store["wargames-sound"] = "off";
  const Sound = load();
  assert.strictEqual(Sound.isEnabled(), false);
});

console.log(`\nALL TESTS PASSED (${passed})`);
