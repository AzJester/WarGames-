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


check("the checkers example move in the instructions is legal", () => {
  // The old instructions suggested B3 A4, which starts on an empty square.
  const b = CheckersCore.initial();
  const want = CheckersCore.parseMove("A3 B4");
  const found = CheckersCore.moves(b, "o").some(
    (m) => m.from.join() === want.from.join() && m.to.join() === want.to.join()
  );
  assert.ok(found);
  assert.strictEqual(CheckersCore.moveText({ from: want.from, to: want.to }), "A3 B4");
});

check("the live checkers board keys only dark squares and marks kings", () => {
  const b = CheckersCore.initial();
  b[4][1] = "O";
  const rows = CheckersCore.cells(b, { last: { from: [0, 5], to: [1, 4] }, sel: "c3" });
  assert.strictEqual(rows.length, 9);
  assert.strictEqual(rows[0][0].t, "8");
  const sq = (key) => rows[8 - Number(key[1])][key.charCodeAt(0) - 96];
  assert.strictEqual(sq("a1").k, "a1");
  assert.strictEqual(sq("b1").k, null);
  assert.ok(sq("b4").c.includes("man mine") && sq("b4").t === "K");
  assert.ok(sq("b4").c.includes("last") && sq("a3").c.includes("last"));
  assert.ok(sq("c3").c.includes("sel"));
  assert.ok(sq("b8").c.includes("theirs"));
  assert.ok(CheckersCore.ownsSquare(b, "c3", "o"));
  assert.ok(!CheckersCore.ownsSquare(b, "b8", "o"));
});

check("chess reports check and filters moves that hang the king", () => {
  const empty = () => Array.from({ length: 8 }, () => Array(8).fill(null));
  const b = empty();
  b[7][4] = "K"; // e1
  b[0][4] = "r"; // e8 rook on the open file
  b[0][0] = "k";
  assert.ok(ChessCore.kingAttacked(b, true));
  assert.ok(!ChessCore.kingAttacked(b, false));
  const safe = ChessCore.safeMoves(b, true);
  assert.ok(safe.length > 0);
  for (const mv of safe) assert.notStrictEqual(mv.to[0], 4, "stepping along the file stays in check");
  assert.ok(ChessCore.moves(b, true).length > safe.length);
});

check("chess recognizes checkmate and stalemate positions", () => {
  const empty = () => Array.from({ length: 8 }, () => Array(8).fill(null));
  // back-rank mate: king h1 boxed in by its own pawns, rook on the first rank
  const mate = empty();
  mate[7][7] = "K";
  mate[6][5] = "P";
  mate[6][6] = "P";
  mate[6][7] = "P";
  mate[7][0] = "r";
  mate[0][0] = "k";
  assert.ok(ChessCore.kingAttacked(mate, true));
  assert.strictEqual(ChessCore.safeMoves(mate, true).length, 0);
  // stalemate: king a1, enemy queen b3, nothing else can move
  const stale = empty();
  stale[7][0] = "K";
  stale[5][1] = "q";
  stale[0][7] = "k";
  assert.ok(!ChessCore.kingAttacked(stale, true));
  assert.strictEqual(ChessCore.safeMoves(stale, true).length, 0);
});

check("chess names moves and builds the live board", () => {
  const b = ChessCore.initial();
  const e4 = ChessCore.parseMove("e2 e4");
  assert.strictEqual(ChessCore.moveText(e4), "E2 E4");
  assert.strictEqual(ChessCore.coord(0, 7), "A1");
  const rows = ChessCore.cells(ChessCore.apply(b, e4), { last: e4, sel: "g1" });
  assert.strictEqual(rows.length, 9);
  assert.deepStrictEqual(rows[8].map((c) => c.t).join(""), "ABCDEFGH");
  const sq = (key) => rows[8 - Number(key[1])][key.charCodeAt(0) - 96];
  assert.ok(sq("a1").c.includes("dark"), "a1 is a dark square");
  assert.ok(sq("h1").c.includes("light"));
  assert.ok(sq("e4").c.includes("mine") && sq("e4").c.includes("last") && sq("e4").t === "P");
  assert.ok(sq("e2").c.includes("last") && sq("e2").t === "");
  assert.ok(sq("e8").c.includes("theirs") && sq("e8").t === "K");
  assert.ok(sq("g1").c.includes("sel"));
  assert.ok(ChessCore.ownsSquare(b, "e2", true));
  assert.ok(!ChessCore.ownsSquare(b, "e7", true));
  assert.ok(!ChessCore.ownsSquare(b, "e4", true));
});

check("Joshua develops a piece instead of wandering with his king", () => {
  // After 1. e4 every reply is equal on material; the positional
  // tie-break must keep the king at home across many random seeds.
  const b = ChessCore.apply(ChessCore.initial(), ChessCore.parseMove("e2 e4"));
  for (let seed = 1; seed <= 25; seed++) {
    const mv = ChessCore.bestMove(b, false, makeRng(seed));
    const piece = b[mv.from[1]][mv.from[0]];
    assert.notStrictEqual(piece, "k", "seed " + seed);
  }
  // and the nudges never outweigh material: every piece's bonus is under a pawn
  assert.ok(Math.abs(ChessCore.positional(ChessCore.initial())) < 1e-9);
});

check("chess bestMove honors a restricted pool", () => {
  const b = ChessCore.initial();
  const pool = ChessCore.moves(b, false).filter((m) => m.from[0] === 0 && m.from[1] === 1);
  for (let seed = 1; seed <= 5; seed++) {
    const mv = ChessCore.bestMove(b, false, makeRng(seed), pool);
    assert.ok(pool.includes(mv));
  }
});

check("the live maze marks the player, the exit, walls, and the trail", () => {
  const maze = MazeCore.generate(21, 11, makeRng(7));
  const seen = new Set(["1,1"]);
  const rows = MazeCore.cells(maze, 1, 1, seen);
  assert.strictEqual(rows.length, 11);
  assert.strictEqual(rows[0].length, 21);
  assert.deepStrictEqual(rows[1][1], { t: "@", c: "me" });
  assert.deepStrictEqual(rows[9][19], { t: "X", c: "exit" });
  assert.ok(rows[0].every((c) => c.c === "wall"));
  const moved = MazeCore.cells(maze, 1, 3, seen);
  assert.strictEqual(moved[1][1].c, "trail");
});

check("poker cards are keyed 1-5 and show discards", () => {
  const hand = [
    { r: 14, s: "♥", name: "A♥" },
    { r: 10, s: "♠", name: "10♠" },
    { r: 2, s: "♦", name: "2♦" },
    { r: 9, s: "♣", name: "9♣" },
    { r: 5, s: "♠", name: "5♠" },
  ];
  const cells = CardsCore.cells(hand, new Set([3]));
  assert.deepStrictEqual(cells.map((c) => c.k), ["1", "2", "3", "4", "5"]);
  assert.strictEqual(cells[0].c, "red");
  assert.strictEqual(cells[1].c, "");
  assert.strictEqual(cells[2].c, "red drop");
});

console.log(`\nALL TESTS PASSED (${passed})`);
