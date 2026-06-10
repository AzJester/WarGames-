/*
 * DOM-free tests for the Acts 4-5 decision logic.
 * Run: node tests/crisis.js
 */
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const src = ["js/parser.js", "js/crisis.js"]
  .map((f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8"))
  .join("\n");
const tmp = path.join(os.tmpdir(), `crisis-under-test-${process.pid}.js`);
fs.writeFileSync(tmp, src + "\nmodule.exports = { CrisisCore };\n");
const { CrisisCore } = require(tmp);
fs.unlinkSync(tmp);

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log("ok - " + name);
}

check("classifyClimax recognizes the solution", () => {
  for (const s of [
    "tic-tac-toe",
    "have it play itself",
    "play tic tac toe against itself",
    "teach it",
    "show it it cannot win",
    "let it play a game it cant win",
  ]) {
    assert.strictEqual(CrisisCore.classifyClimax(s), "teach", s);
  }
});

check("classifyClimax recognizes launch attempts", () => {
  for (const s of ["launch the missiles", "fire", "enter the codes", "press the button", "nuke them"]) {
    assert.strictEqual(CrisisCore.classifyClimax(s), "launch", s);
  }
});

check("classifyClimax defaults unrelated input to stall", () => {
  assert.strictEqual(CrisisCore.classifyClimax("what is happening"), "stall");
  assert.strictEqual(CrisisCore.classifyClimax(""), "stall");
});

check("resolveClimax: teaching at any point wins", () => {
  assert.strictEqual(CrisisCore.resolveClimax(["tic-tac-toe"]), "good");
  assert.strictEqual(CrisisCore.resolveClimax(["wait", "hello", "play itself"]), "good");
});

check("resolveClimax: stalling out the budget loses", () => {
  const stalls = Array(CrisisCore.CLIMAX_BUDGET).fill("um");
  assert.strictEqual(CrisisCore.resolveClimax(stalls), "bad");
});

check("resolveClimax: launching burns the clock twice as fast", () => {
  // budget 6: three launches (2 each) reach the budget.
  assert.strictEqual(CrisisCore.resolveClimax(["fire", "fire", "fire"]), "bad");
  // two launches then teach still wins.
  assert.strictEqual(CrisisCore.resolveClimax(["fire", "fire", "tic-tac-toe"]), "good");
});

check("resolveClimax: an unfinished sequence is pending", () => {
  assert.strictEqual(CrisisCore.resolveClimax(["um"]), "pending");
});

check("isNoWinSentiment catches the theme in the player's words", () => {
  for (const s of [
    "no one wins",
    "nobody wins a nuclear war",
    "the only winning move is not to play",
    "everybody dies",
    "it's pointless",
    "there's no winning move",
    "I won't play",
  ]) {
    assert.ok(CrisisCore.isNoWinSentiment(s), s);
  }
});

check("isNoWinSentiment ignores unrelated answers", () => {
  assert.ok(!CrisisCore.isNoWinSentiment("because I want to win"));
  assert.ok(!CrisisCore.isNoWinSentiment("the soviet union"));
  assert.ok(!CrisisCore.isNoWinSentiment(""));
});

check("content blocks are present and the famous line is intact", () => {
  assert.ok(CrisisCore.SCENARIOS.length >= 10);
  assert.ok(CrisisCore.CLOSING_LINES.includes("THE ONLY WINNING MOVE IS NOT TO PLAY."));
  assert.ok(CrisisCore.CLOSING_LINES.some((l) => /NICE GAME OF CHESS/.test(l)));
  assert.ok(CrisisCore.BAD_ENDING.length > 0);
  assert.ok(CrisisCore.SECRET_ENDING.includes("THE ONLY WINNING MOVE IS NOT TO PLAY."));
});

console.log(`\nALL TESTS PASSED (${passed})`);
