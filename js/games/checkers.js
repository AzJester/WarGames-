/*
 * Checkers. You are 'o' moving up the board; Joshua is 'x' moving down.
 * Kings are O/X. Single jumps capture (chains play out one hop at a
 * time); captures are not forced. CheckersCore is pure for the tests.
 * Requires parser.js (norm, isYes).
 */

const CheckersCore = (() => {
  // 8x8 board, row 0 at the top. null = empty. Playable on dark squares.
  function initial() {
    const b = Array.from({ length: 8 }, () => Array(8).fill(null));
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 8; x++) if ((x + y) % 2 === 1) b[y][x] = "x";
    }
    for (let y = 5; y < 8; y++) {
      for (let x = 0; x < 8; x++) if ((x + y) % 2 === 1) b[y][x] = "o";
    }
    return b;
  }

  const isMine = (cell, side) => !!cell && cell.toLowerCase() === side;
  const dirsFor = (cell) => {
    if (cell === "O" || cell === "X") return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    return cell === "o" ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
  };
  const inb = (x, y) => x >= 0 && x < 8 && y >= 0 && y < 8;

  // All moves for a side: [{from:[x,y], to:[x,y], jump:[x,y]|null}]
  function moves(b, side) {
    const out = [];
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const cell = b[y][x];
        if (!isMine(cell, side)) continue;
        for (const [dy, dx] of dirsFor(cell)) {
          const nx = x + dx;
          const ny = y + dy;
          if (!inb(nx, ny)) continue;
          if (!b[ny][nx]) {
            out.push({ from: [x, y], to: [nx, ny], jump: null });
          } else if (!isMine(b[ny][nx], side)) {
            const jx = x + dx * 2;
            const jy = y + dy * 2;
            if (inb(jx, jy) && !b[jy][jx]) {
              out.push({ from: [x, y], to: [jx, jy], jump: [nx, ny] });
            }
          }
        }
      }
    }
    return out;
  }

  function apply(b, mv) {
    const nb = b.map((row) => row.slice());
    const [fx, fy] = mv.from;
    const [tx, ty] = mv.to;
    let piece = nb[fy][fx];
    nb[fy][fx] = null;
    if (mv.jump) nb[mv.jump[1]][mv.jump[0]] = null;
    if (piece === "o" && ty === 0) piece = "O";
    if (piece === "x" && ty === 7) piece = "X";
    nb[ty][tx] = piece;
    return nb;
  }

  function count(b, side) {
    let n = 0;
    for (const row of b) for (const c of row) if (isMine(c, side)) n += 1;
    return n;
  }

  function score(b) {
    // positive favors x (Joshua); kings are worth more.
    let s = 0;
    for (const row of b) {
      for (const c of row) {
        if (c === "x") s += 1;
        else if (c === "X") s += 1.6;
        else if (c === "o") s -= 1;
        else if (c === "O") s -= 1.6;
      }
    }
    return s;
  }

  function search(b, side, depth) {
    const ms = moves(b, side);
    if (!ms.length) return { score: side === "x" ? -99 : 99, move: null };
    if (depth === 0) return { score: score(b), move: null };
    let best = null;
    for (const mv of ms) {
      const nb = apply(b, mv);
      const r = search(nb, side === "x" ? "o" : "x", depth - 1);
      if (
        !best ||
        (side === "x" && r.score > best.score) ||
        (side === "o" && r.score < best.score)
      ) {
        best = { score: r.score, move: mv };
      }
    }
    return best;
  }

  function bestMove(b, side, rng = Math.random) {
    const ms = moves(b, side);
    if (!ms.length) return null;
    // prefer jumps, then search
    const jumps = ms.filter((m) => m.jump);
    if (jumps.length) return jumps[Math.floor(rng() * jumps.length)];
    return search(b, side, 3).move || ms[Math.floor(rng() * ms.length)];
  }

  function render(b) {
    const lines = ["   A B C D E F G H"];
    for (let y = 0; y < 8; y++) {
      let row = 8 - y + " ";
      for (let x = 0; x < 8; x++) {
        row += " " + (b[y][x] || ((x + y) % 2 === 1 ? "·" : " "));
      }
      lines.push(row);
    }
    return lines.join("\n");
  }

  // "B3 A4" -> {from:[x,y], to:[x,y]} or null.
  function parseMove(input) {
    const m = norm(input).match(/^([a-h])\s*([1-8])\s*(?:to\s*)?([a-h])\s*([1-8])$/);
    if (!m) return null;
    const cx = (ch) => ch.charCodeAt(0) - 97;
    return { from: [cx(m[1]), 8 - Number(m[2])], to: [cx(m[3]), 8 - Number(m[4])] };
  }

  return { initial, moves, apply, count, bestMove, render, parseMove, score };
})();

async function playCheckers(term, state) {
  await term.type("CHECKERS. YOU ARE o, MOVING UP. I AM x. KINGS ARE CAPITALS.");
  await term.type("MOVE LIKE: B3 A4. JUMPS CAPTURE. TYPE QUIT TO STOP.");
  const TALK = [
    "A CAUTIOUS MOVE, PROFESSOR.",
    "DR. FALKEN PREFERRED THE EDGES TOO.",
    "I HAVE SIMULATED THIS POSITION 1,204 TIMES.",
    "INTERESTING.",
  ];
  let b = CheckersCore.initial();
  term.print("");
  term.print(CheckersCore.render(b), "board");
  term.print("");
  while (true) {
    const myMoves = CheckersCore.moves(b, "o");
    if (!myMoves.length || CheckersCore.count(b, "o") === 0) {
      await term.type("YOU HAVE NO MOVES. I WIN.");
      break;
    }
    const t = await term.read("YOUR MOVE: ");
    const tn = norm(t);
    if (/^(quit|exit|stop)$/.test(tn)) {
      await term.type("AS YOU WISH.");
      break;
    }
    const want = CheckersCore.parseMove(tn);
    const mv =
      want &&
      myMoves.find(
        (m) =>
          m.from[0] === want.from[0] &&
          m.from[1] === want.from[1] &&
          m.to[0] === want.to[0] &&
          m.to[1] === want.to[1]
      );
    if (!mv) {
      await term.type("ILLEGAL MOVE.");
      continue;
    }
    b = CheckersCore.apply(b, mv);
    if (CheckersCore.count(b, "x") === 0) {
      term.print("");
      term.print(CheckersCore.render(b), "board");
      await term.type("YOU WIN. RECORDED.");
      break;
    }
    const jm = CheckersCore.bestMove(b, "x");
    if (!jm) {
      term.print("");
      term.print(CheckersCore.render(b), "board");
      await term.type("I HAVE NO MOVES. YOU WIN.");
      break;
    }
    b = CheckersCore.apply(b, jm);
    term.print("");
    term.print(CheckersCore.render(b), "board");
    term.print("");
    if (Math.random() < 0.22) await term.type(TALK[Math.floor(Math.random() * TALK.length)]);
    if (CheckersCore.count(b, "o") === 0) {
      await term.type("YOUR PIECES ARE GONE. I WIN.");
      break;
    }
  }
  state.gamesPlayed = (state.gamesPlayed || 0) + 1;
}
