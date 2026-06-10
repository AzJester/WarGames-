/*
 * DOM-free tests for the Acts 1-2 core (war-dialer + research archive).
 * Run: node tests/intro.js
 */
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const src = ["js/parser.js", "js/intro.js"]
  .map((f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8"))
  .join("\n");
const tmp = path.join(os.tmpdir(), `intro-under-test-${process.pid}.js`);
fs.writeFileSync(tmp, src + "\nmodule.exports = { IntroCore, norm };\n");
const { IntroCore } = require(tmp);
fs.unlinkSync(tmp);

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log("ok - " + name);
}

check("the scan pool has exactly one unmarked target", () => {
  const targets = IntroCore.SCAN.filter((e) => e.target);
  assert.strictEqual(targets.length, 1);
  assert.strictEqual(targets[0].num, "399-2364");
  assert.ok(IntroCore.WOPR_NUMBER.endsWith("399-2364"));
});

check("every scan entry has a unique last-4", () => {
  const keys = IntroCore.SCAN.map((e) => IntroCore.last4(e.num));
  assert.strictEqual(new Set(keys).size, keys.length);
});

check("dialing the target connects", () => {
  for (const input of ["2364", "399-2364", "(311) 399-2364", "dial 311 399 2364"]) {
    const r = IntroCore.dialResult(input);
    assert.strictEqual(r.type, "target", input);
  }
});

check("dialing a flavor number returns its banner", () => {
  const r = IntroCore.dialResult("1972");
  assert.strictEqual(r.type, "flavor");
  assert.ok(r.entry.banner.includes("AIRLINES"));
});

check("dialing an unknown number gets no carrier; empty is empty", () => {
  assert.strictEqual(IntroCore.dialResult("0000").type, "nocarrier");
  assert.strictEqual(IntroCore.dialResult("   ").type, "empty");
});

check("Protovision is a dead line, not the target", () => {
  const r = IntroCore.dialResult("4002");
  assert.strictEqual(r.type, "flavor");
  assert.ok(/DISCONNECTED/.test(r.entry.banner));
});

check("research FALKEN points toward Joshua without revealing the password", () => {
  const art = IntroCore.research("falken");
  assert.strictEqual(art.id, "falken");
  assert.ok(!art.revealsPassword);
  assert.ok(/JOSHUA/.test(art.nudge.toUpperCase()));
});

check("research JOSHUA reveals the password", () => {
  for (const q of ["joshua", "Joshua Falken", "the obituary", "falken obituary", "1973"]) {
    const art = IntroCore.research(q);
    assert.strictEqual(art.id, "joshua", q);
    assert.strictEqual(art.revealsPassword, true, q);
  }
});

check("a falken query does not resolve to the obituary by accident", () => {
  assert.strictEqual(IntroCore.research("stephen falken").id, "falken");
  assert.strictEqual(IntroCore.research("dr falken").id, "falken");
});

check("research Protovision explains the dead end", () => {
  const art = IntroCore.research("protovision");
  assert.strictEqual(art.id, "protovision");
  assert.ok(!art.revealsPassword);
});

check("unknown research returns null", () => {
  assert.strictEqual(IntroCore.research("xyzzy"), null);
  assert.strictEqual(IntroCore.research(""), null);
});

check("the easy path resolves end to end", () => {
  // Player follows the obvious trail with no out-of-game knowledge.
  const a = IntroCore.research("falken"); // from the FALKEN'S MAZE clue
  assert.ok(a && a.id === "falken");
  const b = IntroCore.research("joshua"); // nudged from a.nudge
  assert.ok(b && b.revealsPassword);
});

console.log(`\nALL TESTS PASSED (${passed})`);
