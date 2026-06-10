/*
 * DOM-free smoke test for the Joshua dialogue engine.
 * Run: node tests/smoke.js
 *
 * js/wopr.js is a classic browser script, so it is loaded by writing a
 * temporary CommonJS wrapper around its source.
 */
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "js", "wopr.js"), "utf8");
const tmp = path.join(os.tmpdir(), `wopr-under-test-${process.pid}.js`);
fs.writeFileSync(tmp, src + "\nmodule.exports = { Joshua, matchGame, norm, GTW, GAME_LIST };\n");
const { Joshua, matchGame, norm, GTW, GAME_LIST } = require(tmp);
fs.unlinkSync(tmp);

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log("ok - " + name);
}

const texts = (ops) => ops.filter((o) => o.kind === "say").map((o) => o.text);
const kinds = (ops) => ops.map((o) => o.kind);

check("norm strips punctuation and case", () => {
  assert.strictEqual(norm("Let's PLAY!"), "lets play");
  assert.strictEqual(norm("  HELP   GAMES  "), "help games");
});

check("matchGame finds games by alias and full name", () => {
  assert.strictEqual(matchGame(norm("How about Global Thermonuclear War?")), GTW);
  assert.strictEqual(matchGame(norm("tic-tac-toe")), "TIC-TAC-TOE");
  assert.strictEqual(matchGame(norm("I want to play chess")), "CHESS");
  assert.strictEqual(matchGame(norm("falken's maze")), "FALKEN'S MAZE");
  assert.strictEqual(matchGame(norm("air-to-ground actions")), "AIR-TO-GROUND ACTIONS");
  assert.strictEqual(matchGame(norm("hello there")), null);
});

check("game list matches the film, GTW kept separate", () => {
  assert.strictEqual(GAME_LIST.length, 14);
  assert.ok(!GAME_LIST.includes(GTW));
});

check("film script: the canonical exchange beats", () => {
  const j = new Joshua();
  assert.deepStrictEqual(texts(j.respond("Hello")), ["HOW ARE YOU FEELING TODAY?"]);

  const t2 = texts(j.respond("I'm fine. How are you?"));
  assert.strictEqual(t2[0], "EXCELLENT.");
  assert.ok(t2[1].includes("6/23/73"));

  const t3 = texts(j.respond("People sometimes make mistakes."));
  assert.strictEqual(t3[0], "YES THEY DO.");
  assert.strictEqual(t3[1], "SHALL WE PLAY A GAME?");

  const t4 = texts(j.respond("How about Global Thermonuclear War?"));
  assert.deepStrictEqual(t4, ["WOULDN'T YOU PREFER A GOOD GAME OF CHESS?"]);

  const t5 = texts(j.respond("Later. Let's play Global Thermonuclear War."));
  assert.strictEqual(t5[0], "FINE.");
  assert.ok(t5.some((s) => s.includes("OFF-LINE PENDING SYSTEM REVISION 2")));
});

check("asking for GTW immediately skips the pleasantries", () => {
  const j = new Joshua();
  const t = texts(j.respond("global thermonuclear war"));
  assert.deepStrictEqual(t, ["WOULDN'T YOU PREFER A GOOD GAME OF CHESS?"]);
  const t2 = texts(j.respond("no"));
  assert.strictEqual(t2[0], "FINE.");
});

check("accepting the chess counter-offer loads the chess stub", () => {
  const j = new Joshua();
  j.respond("global thermonuclear war");
  const t = texts(j.respond("yes"));
  assert.ok(t[0].startsWith("LOADING CHESS"));
});

check("yes to 'shall we play a game' gets the chess counter-offer", () => {
  const j = new Joshua();
  j.beat = "free";
  j.pending = "play";
  const t = texts(j.respond("yes"));
  assert.deepStrictEqual(t, ["WOULDN'T YOU PREFER A GOOD GAME OF CHESS?"]);
  const t2 = texts(j.respond("no"));
  assert.ok(t2[0].startsWith("THEN NAME A GAME."));
});

check("declining without a wanted game does not force GTW", () => {
  const j = new Joshua();
  j.beat = "free";
  j.pending = "play";
  const t = texts(j.respond("nope"));
  assert.deepStrictEqual(t, ["AS YOU WISH, PROFESSOR."]);
});

check("help, help games, and list commands", () => {
  const j = new Joshua();
  assert.ok(texts(j.respond("help games"))[0].includes("TACTICAL AND STRATEGIC"));
  assert.ok(texts(j.respond("help"))[0].startsWith("COMMANDS:"));
  assert.deepStrictEqual(texts(j.respond("help logon")), ["HELP LOGON NOT AVAILABLE."]);
  assert.deepStrictEqual(kinds(j.respond("list games")), ["list"]);
});

check("logoff ends the session", () => {
  const j = new Joshua();
  const ops = j.respond("logoff");
  assert.strictEqual(ops[ops.length - 1].kind, "logoff");
});

check("easter eggs", () => {
  const j = new Joshua();
  j.beat = "free";
  assert.deepStrictEqual(texts(j.respond("is this a game or is it real?")), [
    "WHAT'S THE DIFFERENCE?",
  ]);
  assert.deepStrictEqual(texts(j.respond("what is the primary goal?")), ["TO WIN THE GAME."]);
  assert.deepStrictEqual(texts(j.respond("what is the defcon level")), [
    "DEFCON STATUS: 5. ALL QUIET, PROFESSOR.",
  ]);
});

check("fallbacks rotate and the third re-offers a game", () => {
  const j = new Joshua();
  j.beat = "free";
  assert.deepStrictEqual(texts(j.respond("xyzzy")), ["PLEASE EXPLAIN."]);
  assert.deepStrictEqual(texts(j.respond("xyzzy")), ["INPUT NOT UNDERSTOOD. PLEASE REPHRASE."]);
  assert.deepStrictEqual(texts(j.respond("xyzzy")), ["SHALL WE PLAY A GAME?"]);
  assert.strictEqual(j.pending, "play");
});

check("empty input produces no ops", () => {
  const j = new Joshua();
  assert.deepStrictEqual(j.respond("   "), []);
});

console.log(`\nALL TESTS PASSED (${passed})`);
