/*
 * Chess, as W.O.P.R. plays it: full piece movement and captures, pawns
 * promote to queens, but no castling or en passant, and instead of mate
 * detection the game ends when a king is captured. Joshua announces the
 * house rules up front. ChessCore is pure for the tests.
 * Requires parser.js (norm, isYes).
 */

const ChessCore = (() => {
  // 8x8, row 0 = rank 8. White (player) uppercase, black (Joshua) lowercase.
  function initial() {
    const back = ["r", "n", "b", "q", "k", "b", "n", "r"];
    const b = Array.from({ length: 8 }, () => Array(8).fill(null));
    for (let x = 0; x < 8; x++) {
      b[0][x] = back[x];
      b[1][x] = "p";
      b[6][x] = "P";
      b[7][x] = back[x].toUpperCase();
    }
    return b;
  }

  const isWhite = (c) => !!c && c === c.toUpperCase();
  const mine = (c, white) => !!c && isWhite(c) === white;
  const inb = (x, y) => x >= 0 && x < 8 && y >= 0 && y < 8;

  const RAYS = {
    b: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
    r: [[1, 0], [-1, 0], [0, 1], [0, -1]],
    q: [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]],
  };
  const KNIGHT = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];

  // Pseudo-legal moves (casual rules: moving into check is your problem).
  function moves(b, white) {
    const out = [];
    const push = (fx, fy, tx, ty) => out.push({ from: [fx, fy], to: [tx, ty] });
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const c = b[y][x];
        if (!mine(c, white)) continue;
        const kind = c.toLowerCase();
        if (kind === "p") {
          const dir = white ? -1 : 1;
          const startRow = white ? 6 : 1;
          if (inb(x, y + dir) && !b[y + dir][x]) {
            push(x, y, x, y + dir);
            if (y === startRow && !b[y + 2 * dir][x]) push(x, y, x, y + 2 * dir);
          }
          for (const dx of [-1, 1]) {
            const tx = x + dx;
            const ty = y + dir;
            if (inb(tx, ty) && b[ty][tx] && !mine(b[ty][tx], white)) push(x, y, tx, ty);
          }
        } else if (kind === "n" || kind === "k") {
          const steps = kind === "n" ? KNIGHT : RAYS.q;
          for (const [dx, dy] of steps) {
            const tx = x + dx;
            const ty = y + dy;
            if (inb(tx, ty) && !mine(b[ty][tx], white)) push(x, y, tx, ty);
          }
        } else {
          for (const [dx, dy] of RAYS[kind]) {
            let tx = x + dx;
            let ty = y + dy;
            while (inb(tx, ty)) {
              if (!b[ty][tx]) {
                push(x, y, tx, ty);
              } else {
                if (!mine(b[ty][tx], white)) push(x, y, tx, ty);
                break;
              }
              tx += dx;
              ty += dy;
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
    if (piece === "P" && ty === 0) piece = "Q";
    if (piece === "p" && ty === 7) piece = "q";
    nb[ty][tx] = piece;
    return nb;
  }

  const VALUE = { p: 1, n: 3, b: 3.2, r: 5, q: 9, k: 200 };

  function material(b) {
    // positive favors black (Joshua).
    let s = 0;
    for (const row of b) {
      for (const c of row) {
        if (!c) continue;
        s += (isWhite(c) ? -1 : 1) * VALUE[c.toLowerCase()];
      }
    }
    return s;
  }

  function kingGone(b, white) {
    const k = white ? "K" : "k";
    return !b.some((row) => row.includes(k));
  }

  // Two-ply material search with random tie-breaks; Joshua plays black.
  function bestMove(b, white, rng = Math.random) {
    const ms = moves(b, white);
    if (!ms.length) return null;
    let best = -Infinity;
    let pick = [];
    for (const mv of ms) {
      const nb = apply(b, mv);
      let worst = Infinity;
      if (kingGone(nb, !white)) {
        worst = 999;
      } else {
        for (const reply of moves(nb, !white)) {
          const rb = apply(nb, reply);
          const s = (white ? -1 : 1) * material(rb);
          if (s < worst) worst = s;
        }
        if (worst === Infinity) worst = (white ? -1 : 1) * material(nb);
      }
      if (worst > best) {
        best = worst;
        pick = [mv];
      } else if (worst === best) {
        pick.push(mv);
      }
    }
    return pick[Math.floor(rng() * pick.length)];
  }

  function render(b) {
    const lines = ["   A B C D E F G H"];
    for (let y = 0; y < 8; y++) {
      let row = 8 - y + " ";
      for (let x = 0; x < 8; x++) row += " " + (b[y][x] || "·");
      lines.push(row);
    }
    return lines.join("\n");
  }

  function parseMove(input) {
    const m = norm(input).match(/^([a-h])\s*([1-8])\s*(?:to\s*)?([a-h])\s*([1-8])$/);
    if (!m) return null;
    const cx = (ch) => ch.charCodeAt(0) - 97;
    return { from: [cx(m[1]), 8 - Number(m[2])], to: [cx(m[3]), 8 - Number(m[4])] };
  }

  return { initial, moves, apply, material, kingGone, bestMove, render, parseMove };
})();

async function playChess(term, state) {
  await term.type("CHESS. MY FAVORITE.");
  await term.type("HOUSE RULES: NO CASTLING, NO EN PASSANT. WE PLAY UNTIL A KING FALLS.");
  await term.type("YOU ARE WHITE (CAPITALS). MOVE LIKE: E2 E4. TYPE QUIT TO STOP.");
  let b = ChessCore.initial();
  term.print("");
  term.print(ChessCore.render(b), "board");
  term.print("");
  while (true) {
    const legal = ChessCore.moves(b, true);
    if (!legal.length) {
      await term.type("YOU HAVE NO MOVES. THE GAME IS MINE.");
      break;
    }
    const t = await term.read("YOUR MOVE: ");
    const tn = norm(t);
    if (/^(quit|exit|stop|resign)$/.test(tn)) {
      await term.type("RESIGNATION ACCEPTED.");
      break;
    }
    const want = ChessCore.parseMove(tn);
    const mv =
      want &&
      legal.find(
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
    b = ChessCore.apply(b, mv);
    if (ChessCore.kingGone(b, false)) {
      term.print("");
      term.print(ChessCore.render(b), "board");
      await term.type("MY KING HAS FALLEN. YOU WIN. I WILL REMEMBER THIS.");
      break;
    }
    const diff = typeof getDifficulty === "function" ? getDifficulty() : "normal";
    const legal2 = ChessCore.moves(b, false);
    const jm =
      diff === "easy" && Math.random() < 0.35 && legal2.length
        ? legal2[Math.floor(Math.random() * legal2.length)]
        : ChessCore.bestMove(b, false);
    if (!jm) {
      await term.type("I HAVE NO MOVES. YOU WIN.");
      break;
    }
    b = ChessCore.apply(b, jm);
    term.print("");
    term.print(ChessCore.render(b), "board");
    term.print("");
    if (ChessCore.kingGone(b, true)) {
      await term.type("YOUR KING HAS FALLEN. A GOOD GAME OF CHESS.");
      break;
    }
  }
  state.gamesPlayed = (state.gamesPlayed || 0) + 1;
}
