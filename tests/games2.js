/*
 * DOM-free tests for the M7 game cores: checkers, chess, cards, maze, and
 * the crisis additions. Run: node tests/games2.js
 */
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const src = [
  "js/parser.js",
  "js/crisis.js",
  "js/games/cards.js",
  "js/games/checkers.js",
  "js/games/chess.js",
  "js/games/maze.js",
]
  .map((f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8"))
  .join("\n");
const tmp = path.join(os.tmpdir(), `games2-under-test-${process.pid}.js`);
fs.writeFileSync(
  tmp,
  src + "\nmodule.exports = { CardsCore, CheckersCore, ChessCore, MazeCore, CrisisCore };\n"
);
const { CardsCore, CheckersCore, ChessCore, MazeCore, CrisisCore } = require(tmp);
fs.unlinkSync(tmp);

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

// ---- cards ----

check("a deck holds 52 unique cards", () => {
  const d = CardsCore.deck(makeRng(1));
  assert.strictEqual(d.length, 52);
  assert.strictEqual(new Set(d.map((c) => c.name)).size, 52);
});

check("blackjack values handle aces", () => {
  const c = (r, s = "♠") => ({ r, s });
  assert.strictEqual(CardsCore.bjValue([c(14), c(13)]), 21);
  assert.strictEqual(CardsCore.bjValue([c(14), c(14), c(9)]), 21);
  assert.strictEqual(CardsCore.bjValue([c(10), c(9), c(5)]), 24);
});

check("poker ranks order correctly", () => {
  const h = (spec) =>
    spec.split(" ").map((cs) => {
      const r = { J: 11, Q: 12, K: 13, A: 14 }[cs.slice(0, -1)] || Number(cs.slice(0, -1));
      return { r, s: cs.slice(-1) };
    });
  const straightFlush = h("9♠ 8♠ 7♠ 6♠ 5♠");
  const quads = h("9♠ 9♥ 9♦ 9♣ 2♠");
  const fullHouse = h("8♠ 8♥ 8♦ 3♣ 3♠");
  const flush = h("A♠ 9♠ 7♠ 5♠ 2♠");
  const wheel = h("A♠ 2♥ 3♦ 4♣ 5♠");
  const pair = h("K♠ K♥ 9♦ 5♣ 2♠");
  const high = h("A♠ J♥ 9♦ 5♣ 2♠");
  const ranks = [straightFlush, quads, fullHouse, flush, wheel, pair, high].map(
    CardsCore.pokerRank
  );
  for (let i = 0; i < ranks.length - 1; i++) {
    assert.ok(
      CardsCore.compareRanks(ranks[i], ranks[i + 1]) > 0,
      "rank " + i + " should beat rank " + (i + 1)
    );
  }
  assert.strictEqual(CardsCore.pokerRank(wheel)[0], 4);
  assert.strictEqual(CardsCore.pokerRank(wheel)[1], 5);
});

check("Joshua keeps made poker hands", () => {
  const made = [
    { r: 9, s: "♠" },
    { r: 8, s: "♠" },
    { r: 7, s: "♠" },
    { r: 6, s: "♠" },
    { r: 5, s: "♠" },
  ];
  assert.deepStrictEqual(CardsCore.pokerDiscards(made), []);
});

// ---- checkers ----

check("checkers opens with 7 moves per side and 12 pieces", () => {
  const b = CheckersCore.initial();
  assert.strictEqual(CheckersCore.count(b, "o"), 12);
  assert.strictEqual(CheckersCore.count(b, "x"), 12);
  assert.strictEqual(CheckersCore.moves(b, "o").length, 7);
  assert.strictEqual(CheckersCore.moves(b, "x").length, 7);
});

check("checkers jumps capture and men crown", () => {
  const b = Array.from({ length: 8 }, () => Array(8).fill(null));
  b[4][3] = "o";
  b[3][2] = "x";
  const jumps = CheckersCore.moves(b, "o").filter((m) => m.jump);
  assert.strictEqual(jumps.length, 1);
  let nb = CheckersCore.apply(b, jumps[0]);
  assert.strictEqual(CheckersCore.count(nb, "x"), 0);
  // crowning
  const c = Array.from({ length: 8 }, () => Array(8).fill(null));
  c[1][2] = "o";
  const mv = CheckersCore.moves(c, "o")[0];
  nb = CheckersCore.apply(c, mv);
  assert.strictEqual(nb[0][mv.to[0]], "O");
});

check("checkers AI plays a full random-vs-AI game without crashing", () => {
  const rng = makeRng(7);
  let b = CheckersCore.initial();
  let side = "o";
  for (let turn = 0; turn < 200; turn++) {
    const ms = CheckersCore.moves(b, side);
    if (!ms.length) break;
    const mv =
      side === "o" ? ms[Math.floor(rng() * ms.length)] : CheckersCore.bestMove(b, "x", rng);
    b = CheckersCore.apply(b, mv);
    side = side === "o" ? "x" : "o";
  }
  assert.ok(true);
});

check("checkers move parsing", () => {
  assert.deepStrictEqual(CheckersCore.parseMove("B3 A4"), { from: [1, 5], to: [0, 4] });
  assert.strictEqual(CheckersCore.parseMove("Z9 A1"), null);
});

// ---- chess ----

check("chess opens with 20 moves and parses algebraic squares", () => {
  const b = ChessCore.initial();
  assert.strictEqual(ChessCore.moves(b, true).length, 20);
  assert.strictEqual(ChessCore.moves(b, false).length, 20);
  assert.deepStrictEqual(ChessCore.parseMove("E2 E4"), { from: [4, 6], to: [4, 4] });
});

check("chess AI takes a hanging queen", () => {
  const b = Array.from({ length: 8 }, () => Array(8).fill(null));
  b[0][4] = "k";
  b[7][4] = "K";
  b[4][4] = "Q"; // white queen en prise
  b[4][7] = "r"; // black rook on the same rank
  const mv = ChessCore.bestMove(b, false, makeRng(3));
  assert.deepStrictEqual(mv.to, [4, 4]);
});

check("chess pawns promote and the king-capture rule ends play", () => {
  const b = Array.from({ length: 8 }, () => Array(8).fill(null));
  b[1][0] = "P";
  b[0][4] = "k";
  b[7][4] = "K";
  const mv = ChessCore.moves(b, true).find((m) => m.to[1] === 0 && m.from[0] === 0);
  const nb = ChessCore.apply(b, mv);
  assert.strictEqual(nb[0][0], "Q");
  assert.ok(!ChessCore.kingGone(nb, false));
  const cap = { from: [0, 0], to: [4, 0] };
  assert.ok(ChessCore.kingGone(ChessCore.apply(nb, cap), false));
});

// ---- maze ----

check("generated mazes are always solvable (50 seeds)", () => {
  for (let seed = 1; seed <= 50; seed++) {
    const maze = MazeCore.generate(21, 11, makeRng(seed));
    assert.ok(MazeCore.solvable(maze), "seed " + seed + " unsolvable");
    assert.strictEqual(maze.grid.length, 11);
    assert.strictEqual(maze.grid[0].length, 21);
    assert.strictEqual(maze.grid[maze.exit[1]][maze.exit[0]], " ");
  }
});

check("maze direction parsing", () => {
  assert.deepStrictEqual(MazeCore.step("n"), [0, -1]);
  assert.deepStrictEqual(MazeCore.step("WEST"), [-1, 0]);
  assert.strictEqual(MazeCore.step("up and away"), null);
});

// ---- crisis additions ----

check("suspicion shapes the DEFCON 1 budget", () => {
  assert.strictEqual(CrisisCore.budgetFor(0), 8);
  assert.strictEqual(CrisisCore.budgetFor(2), 6);
  assert.strictEqual(CrisisCore.budgetFor(4), 4);
  assert.strictEqual(CrisisCore.budgetFor(null), 6);
});

check("the launch code reveals with the clock and completes at zero", () => {
  assert.strictEqual(CrisisCore.revealedCode(0, 6), "••• •••• •••");
  assert.strictEqual(CrisisCore.revealedCode(6, 6), "CPE 1704 TKS");
  const half = CrisisCore.revealedCode(3, 6);
  assert.ok(half.startsWith("CPE"));
  assert.ok(half.includes("•"));
});

console.log(`\nALL TESTS PASSED (${passed})`);
