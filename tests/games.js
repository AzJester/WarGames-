/*
 * DOM-free tests for the game cores (tic-tac-toe minimax, GTW map and
 * targeting). Run: node tests/games.js
 */
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const src = ["js/parser.js", "js/games/tictactoe.js", "js/games/gtw.js"]
  .map((f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8"))
  .join("\n");
const tmp = path.join(os.tmpdir(), `games-under-test-${process.pid}.js`);
fs.writeFileSync(tmp, src + "\nmodule.exports = { TTTCore, GTWCore, norm };\n");
const { TTTCore, GTWCore } = require(tmp);
fs.unlinkSync(tmp);

// Deterministic rng for reproducible runs.
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log("ok - " + name);
}

check("winner detects rows, columns, diagonals, and draws", () => {
  assert.strictEqual(TTTCore.winner(["X", "X", "X", null, "O", null, "O", null, null]), "X");
  assert.strictEqual(TTTCore.winner(["O", "X", null, "O", "X", null, "O", null, null]), "O");
  assert.strictEqual(TTTCore.winner(["X", "O", null, "O", "X", null, null, null, "X"]), "X");
  assert.strictEqual(
    TTTCore.winner(["X", "O", "X", "X", "O", "O", "O", "X", "X"]),
    "draw"
  );
  assert.strictEqual(TTTCore.winner(Array(9).fill(null)), null);
});

check("bestMove takes a winning move", () => {
  // O can win at cell 2
  const board = ["O", "O", null, "X", "X", null, null, null, "X"];
  assert.strictEqual(TTTCore.bestMove(board, "O"), 2);
});

check("bestMove blocks an imminent loss", () => {
  // X threatens 0-1-2; O must block at 2
  const board = ["X", "X", null, null, "O", null, null, null, null];
  assert.strictEqual(TTTCore.bestMove(board, "O"), 2);
});

check("perfect self-play always draws (300 randomized games)", () => {
  const rng = makeRng(42);
  for (let i = 0; i < 300; i++) {
    assert.strictEqual(TTTCore.selfPlayGame(rng).winner, "draw");
  }
});

check("Joshua (O) never loses to a random player (300 games)", () => {
  const rng = makeRng(1983);
  for (let i = 0; i < 300; i++) {
    const board = Array(9).fill(null);
    let turn = "X";
    while (!TTTCore.winner(board)) {
      let cell;
      if (turn === "X") {
        const open = TTTCore.emptyCells(board);
        cell = open[Math.floor(rng() * open.length)];
      } else {
        cell = TTTCore.bestMove(board, "O", rng);
      }
      board[cell] = turn;
      turn = turn === "X" ? "O" : "X";
    }
    assert.notStrictEqual(TTTCore.winner(board), "X");
  }
});

check("board renders marks and cell numbers", () => {
  const text = TTTCore.renderBoard(["X", null, null, null, "O", null, null, null, null]);
  assert.ok(text.includes("X"));
  assert.ok(text.includes("O"));
  assert.ok(text.includes("9"));
});

check("map rows are uniform width", () => {
  assert.strictEqual(GTWCore.MAP.length, GTWCore.MAP_H);
  for (const row of GTWCore.MAP) {
    assert.strictEqual(row.length, GTWCore.MAP_W);
  }
});

check("every target and launch site is inside the map", () => {
  for (const t of [...GTWCore.TARGETS_US, ...GTWCore.TARGETS_USSR]) {
    assert.ok(t.x >= 0 && t.x < GTWCore.MAP_W, t.name + " x");
    assert.ok(t.y >= 0 && t.y < GTWCore.MAP_H, t.name + " y");
    assert.ok(t.pop > 0, t.name + " pop");
  }
  for (const [x, y] of [...GTWCore.LAUNCH_US, ...GTWCore.LAUNCH_USSR]) {
    assert.ok(x >= 0 && x < GTWCore.MAP_W && y >= 0 && y < GTWCore.MAP_H);
  }
});

check("every target sits on land", () => {
  for (const t of [...GTWCore.TARGETS_US, ...GTWCore.TARGETS_USSR]) {
    assert.strictEqual(GTWCore.MAP[t.y][t.x], "░", t.name + " is in the ocean");
  }
});

check("findTarget matches exact, partial, and embedded names", () => {
  const us = GTWCore.TARGETS_US;
  assert.strictEqual(GTWCore.findTarget("las vegas", us).name, "LAS VEGAS");
  assert.strictEqual(GTWCore.findTarget("vegas", us).name, "LAS VEGAS");
  assert.strictEqual(GTWCore.findTarget("hit seattle please", us).name, "SEATTLE");
  assert.strictEqual(GTWCore.findTarget("atlantis", us), null);
});

check("pickCountry recognizes both sides", () => {
  assert.strictEqual(GTWCore.pickCountry("the united states"), "US");
  assert.strictEqual(GTWCore.pickCountry("usa"), "US");
  assert.strictEqual(GTWCore.pickCountry("soviet union"), "USSR");
  assert.strictEqual(GTWCore.pickCountry("russia"), "USSR");
  assert.strictEqual(GTWCore.pickCountry("belgium"), null);
});

check("plotPath starts at the site and ends at the target", () => {
  const from = [9, 4];
  const to = [34, 3];
  const pts = GTWCore.plotPath(from, to);
  assert.deepStrictEqual(pts[0], from);
  assert.deepStrictEqual(pts[pts.length - 1], to);
  for (const [x, y] of pts) {
    assert.ok(x >= 0 && x < GTWCore.MAP_W && y >= 0 && y < GTWCore.MAP_H);
  }
});

check("buildFrame keeps dimensions stable and lands impacts", () => {
  const targets = [GTWCore.TARGETS_US[0], GTWCore.TARGETS_US[4]];
  const missiles = GTWCore.makeMissiles(GTWCore.LAUNCH_USSR, targets);
  const maxTick = Math.max(...missiles.map((m) => m.start + m.path.length - 1));
  const early = GTWCore.buildFrame(["TEST"], missiles, 0).split("\n");
  const late = GTWCore.buildFrame(["TEST"], missiles, maxTick + 2).split("\n");
  assert.strictEqual(early.length, late.length);
  for (const line of early.slice(1, -1)) {
    assert.strictEqual(line.length, GTWCore.MAP_W + 2);
  }
  const lateText = late.join("\n");
  assert.ok(/[*#]/.test(lateText), "no impact marker rendered");
  assert.ok(lateText.includes("IMPACTS CONFIRMED:  2"));
  assert.ok(lateText.includes("T-MINUS 00:00"));
});

check("casualties sum to one decimal", () => {
  const total = GTWCore.casualties([{ pop: 2.0 }, { pop: 1.0 }]);
  assert.strictEqual(total, "1.7"); // 3.0 * 0.55 = 1.65, rounded
});

check("pickRandom returns unique entries", () => {
  const rng = makeRng(7);
  const picked = GTWCore.pickRandom(GTWCore.TARGETS_USSR, 5, rng);
  assert.strictEqual(picked.length, 5);
  assert.strictEqual(new Set(picked).size, 5);
});

console.log(`\nALL TESTS PASSED (${passed})`);
