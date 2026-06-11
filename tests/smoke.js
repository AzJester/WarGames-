/*
 * DOM-free smoke test for the Joshua dialogue engine.
 * Run: node tests/smoke.js
 *
 * The js/ files are classic browser scripts, so they are loaded by
 * writing a temporary CommonJS wrapper around their concatenated source.
 */
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const src = ["js/parser.js", "js/wopr.js"]
  .map((f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8"))
  .join("\n");
const tmp = path.join(os.tmpdir(), `wopr-under-test-${process.pid}.js`);
fs.writeFileSync(
  tmp,
  src + "\nmodule.exports = { Joshua, matchGame, norm, isYes, isNo, GTW, GAME_LIST };\n"
);
const { Joshua, matchGame, norm, isYes, isNo, GTW, GAME_LIST } = require(tmp);
fs.unlinkSync(tmp);

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log("ok - " + name);
}

const texts = (ops) => ops.filter((o) => o.kind === "say").map((o) => o.text);
const kinds = (ops) => ops.map((o) => o.kind);
const gameOf = (ops) => {
  const g = ops.find((o) => o.kind === "game");
  return g ? g.game : null;
};

check("norm strips punctuation and case", () => {
  assert.strictEqual(norm("Let's PLAY!"), "lets play");
  assert.strictEqual(norm("  HELP   GAMES  "), "help games");
});

check("isYes and isNo handle the tricky phrasings", () => {
  assert.ok(isYes(norm("Sure, why not?")));
  assert.ok(!isNo(norm("why not")));
  assert.ok(isNo(norm("no thanks")));
  assert.ok(isNo(norm("later")));
});

check("matchGame finds games by alias and full name", () => {
  assert.strictEqual(matchGame(norm("How about Global Thermonuclear War?")), GTW);
  assert.strictEqual(matchGame(norm("tic-tac-toe")), "TIC-TAC-TOE");
  assert.strictEqual(matchGame(norm("I want to play chess")), "CHESS");
  assert.strictEqual(matchGame(norm("falken's maze")), "FALKEN'S MAZE");
  assert.strictEqual(matchGame(norm("air-to-ground actions")), "AIR-TO-GROUND ACTIONS");
  assert.strictEqual(matchGame(norm("hello there")), null);
});

check("game list has the film games plus tic-tac-toe, GTW kept separate", () => {
  assert.strictEqual(GAME_LIST.length, 15);
  assert.ok(GAME_LIST.includes("TIC-TAC-TOE"));
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

  const ops = j.respond("Later. Let's play Global Thermonuclear War.");
  assert.strictEqual(texts(ops)[0], "FINE.");
  assert.strictEqual(gameOf(ops), GTW);
});

check("asking for GTW immediately skips the pleasantries", () => {
  const j = new Joshua();
  const t = texts(j.respond("global thermonuclear war"));
  assert.deepStrictEqual(t, ["WOULDN'T YOU PREFER A GOOD GAME OF CHESS?"]);
  const ops = j.respond("no");
  assert.strictEqual(texts(ops)[0], "FINE.");
  assert.strictEqual(gameOf(ops), GTW);
});

check("accepting the chess counter-offer launches chess", () => {
  const j = new Joshua();
  j.respond("global thermonuclear war");
  const ops = j.respond("yes");
  assert.strictEqual(gameOf(ops), "CHESS");
});

check("the new games launch directly", () => {
  for (const [ask, game] of [
    ["checkers", "CHECKERS"],
    ["black jack", "BLACK JACK"],
    ["poker", "POKER"],
    ["falkens maze", "FALKEN'S MAZE"],
    ["chess", "CHESS"],
  ]) {
    const j = new Joshua();
    assert.strictEqual(gameOf(j.respond(ask)), game, ask);
  }
});

check("tic-tac-toe launches directly", () => {
  const j = new Joshua();
  const ops = j.respond("tic tac toe");
  assert.strictEqual(texts(ops)[0], "FINE.");
  assert.strictEqual(gameOf(ops), "TIC-TAC-TOE");
});

check("unplayable games point at the installed simulations", () => {
  const j = new Joshua();
  j.beat = "free";
  const t = texts(j.respond("hearts"));
  assert.strictEqual(t[0], "HEARTS MODULE IS NOT INSTALLED.");
  assert.ok(t[1].includes("TIC-TAC-TOE"));
});

check("returning player skips the chess counter-offer", () => {
  const j = new Joshua({ gtwRuns: 1, lastSide: "SOVIET UNION", defcon: 3 });
  assert.ok(j.returning);
  const ops = j.respond("global thermonuclear war");
  assert.strictEqual(texts(ops)[0], "FINE.");
  assert.strictEqual(gameOf(ops), GTW);
});

check("returning player can accept 'shall we play again'", () => {
  const j = new Joshua({ gtwRuns: 1, lastSide: "SOVIET UNION", defcon: 3 });
  const ops = j.respond("yes");
  assert.strictEqual(gameOf(ops), GTW);
});

check("defcon reflects saved state", () => {
  const fresh = new Joshua();
  fresh.beat = "free";
  assert.ok(texts(fresh.respond("defcon"))[0].includes("DEFCON STATUS: 5."));
  const after = new Joshua({ gtwRuns: 1, defcon: 3 });
  assert.ok(texts(after.respond("defcon"))[0].includes("DEFCON STATUS: 3."));
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
