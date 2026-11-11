/*
 * Chess, as W.O.P.R. plays it: full piece movement and captures, pawns
 * promote to queens, but no castling or en passant. Check is announced
 * and checkmate ends the game; a player who insists on leaving a king
 * open still loses it the old way, by capture. Joshua announces the
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

  // Small positional nudges, always worth less than a pawn, so they only
  // decide between moves that are equal on material: advance pawns,
  // bring knights and bishops toward the center, keep the king at home
  // while the queens are on. Positive favors black (Joshua).
  function positional(b) {
    let queens = 0;
    for (const row of b) for (const c of row) if (c === "q" || c === "Q") queens += 1;
    let s = 0;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const c = b[y][x];
        if (!c) continue;
        const white = isWhite(c);
        const kind = c.toLowerCase();
        const rank = white ? 7 - y : y; // ranks advanced from home
        const center = 3.5 - Math.max(Math.abs(x - 3.5), Math.abs(y - 3.5)); // 0 edge .. 3 middle
        let v = 0;
        if (kind === "p") v = rank * 0.04 + (x >= 2 && x <= 5 ? 0.03 * rank : 0);
        else if (kind === "n" || kind === "b") v = center * 0.06 + (rank > 0 ? 0.08 : 0);
        else if (kind === "k" && queens > 0) v = rank === 0 ? 0.25 : -0.2 * rank;
        s += white ? -v : v;
      }
    }
    return s;
  }

  function kingGone(b, white) {
    const k = white ? "K" : "k";
    return !b.some((row) => row.includes(k));
  }

  // Could the other side capture this side's king on its next move?
  function kingAttacked(b, white) {
    const k = white ? "K" : "k";
    for (const mv of moves(b, !white)) {
      if (b[mv.to[1]][mv.to[0]] === k) return true;
    }
    return false;
  }

  // Moves that do not leave the mover's own king open to capture.
  function safeMoves(b, white) {
    return moves(b, white).filter((mv) => !kingAttacked(apply(b, mv), white));
  }

  // "E2" for a square, "E2 E4" for a move.
  const coord = (x, y) => "ABCDEFGH"[x] + (8 - y);
  const moveText = (mv) => coord(mv.from[0], mv.from[1]) + " " + coord(mv.to[0], mv.to[1]);

  // Rows of cells for the live board. Squares are keyed by coordinate
  // ("e2"); `last` highlights a move, `sel` the square picked up.
  function cells(b, { last = null, sel = null } = {}) {
    const marks = last ? [last.from.join(), last.to.join()] : [];
    const rows = [];
    for (let y = 0; y < 8; y++) {
      const row = [{ t: String(8 - y), c: "lbl" }];
      for (let x = 0; x < 8; x++) {
        const piece = b[y][x];
        const key = coord(x, y).toLowerCase();
        let cls = (x + y) % 2 === 1 ? "dark" : "light";
        if (piece) cls += isWhite(piece) ? " mine" : " theirs";
        if (marks.includes(x + "," + y)) cls += " last";
        if (sel === key) cls += " sel";
        row.push({ t: piece ? piece.toUpperCase() : "", c: cls, k: key });
      }
      rows.push(row);
    }
    rows.push([{ t: "", c: "lbl" }, ..."ABCDEFGH".split("").map((ch) => ({ t: ch, c: "lbl" }))]);
    return rows;
  }

  // Is the piece on this square ("e2") the given side's?
  function ownsSquare(b, key, white) {
    const x = key.charCodeAt(0) - 97;
    const y = 8 - Number(key[1]);
    return inb(x, y) && mine(b[y][x], white);
  }

  // Two-ply material search with random tie-breaks; Joshua plays black.
  // `pool` restricts the candidates (e.g. to moves that keep the king safe).
  function bestMove(b, white, rng = Math.random, pool = null) {
    const ms = pool || moves(b, white);
    if (!ms.length) return null;
    let best = -Infinity;
    let pick = [];
    for (const mv of ms) {
      const nb = apply(b, mv);
      let worst = Infinity;
      if (kingGone(nb, !white)) {
        worst = 999;
      } else {
        const sign = white ? -1 : 1;
        for (const reply of moves(nb, !white)) {
          const rb = apply(nb, reply);
          const s = sign * (material(rb) + positional(rb));
          if (s < worst) worst = s;
        }
        if (worst === Infinity) worst = sign * (material(nb) + positional(nb));
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

  return {
    initial,
    moves,
    apply,
    material,
    kingGone,
    kingAttacked,
    safeMoves,
    positional,
    coord,
    moveText,
    cells,
    ownsSquare,
    bestMove,
    render,
    parseMove,
  };
})();

async function playChess(term, state) {
  const restore = term.pushHelp(
    "Your pieces are the bright ones at the bottom. Click a piece and then its destination, or type a move like E2 E4. RESIGN ends the game."
  );
  const grid = typeof term.grid === "function" ? term.grid("chess") : null;
  let b = ChessCore.initial();
  let last = null;
  let sel = null;
  // Click a piece to pick it up, then a square to put it down.
  const onCell = (k) => {
    if (ChessCore.ownsSquare(b, k, true) && sel !== k) {
      sel = k;
      term.setInput(k.toUpperCase() + " ");
    } else if (sel === k) {
      sel = null;
      term.setInput("");
    } else if (sel) {
      const move = sel.toUpperCase() + " " + k.toUpperCase();
      sel = null;
      term.submitLine(move);
      return;
    } else {
      return;
    }
    show(true);
  };
  const show = (live) => {
    if (grid) {
      grid.render(ChessCore.cells(b, { last, sel }), live ? { onCell } : {});
    } else {
      term.print("");
      term.print(ChessCore.render(b), "board");
      term.print("");
    }
  };
  try {
    if (grid) grid.pin();
    show(false);
    await term.type("CHESS. MY FAVORITE.");
    await term.type("HOUSE RULES: NO CASTLING, NO EN PASSANT. A KING THAT CANNOT ESCAPE IS LOST.");
    await term.type(
      grid
        ? "YOUR PIECES ARE BRIGHT, MINE ARE AMBER. CLICK A PIECE, THEN A SQUARE, OR TYPE E2 E4. RESIGN TO STOP."
        : "YOU ARE WHITE (CAPITALS). MOVE LIKE: E2 E4. TYPE QUIT TO STOP."
    );
    while (true) {
      const legal = ChessCore.moves(b, true);
      const safe = ChessCore.safeMoves(b, true);
      if (!safe.length) {
        if (ChessCore.kingAttacked(b, true)) {
          await term.type("CHECKMATE. YOUR KING CANNOT ESCAPE. A GOOD GAME OF CHESS.");
        } else {
          await term.type("STALEMATE. NOBODY WINS. A FAMILIAR RESULT.");
        }
        break;
      }
      sel = null;
      show(true);
      const tn = norm(await term.read("YOUR MOVE: ", { choices: ["RESIGN"] }));
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
        sel = null;
        await term.type(want ? "ILLEGAL MOVE." : "ILLEGAL MOVE. TYPE A MOVE LIKE E2 E4.");
        continue;
      }
      // Casual rules let you leave your king hanging, but not by accident.
      if (ChessCore.kingAttacked(ChessCore.apply(b, mv), true)) {
        const sure = norm(
          await term.read("THAT LEAVES YOUR KING OPEN TO CAPTURE. PLAY IT ANYWAY? (YES/NO): ", {
            choices: ["YES", { label: "NO", cls: "go" }],
          })
        );
        if (!isYes(sure)) continue;
      }
      b = ChessCore.apply(b, mv);
      last = mv;
      show(false);
      if (ChessCore.kingGone(b, false)) {
        await term.type("MY KING HAS FALLEN. YOU WIN. I WILL REMEMBER THIS.");
        break;
      }
      const replies = ChessCore.safeMoves(b, false);
      if (!replies.length) {
        if (ChessCore.kingAttacked(b, false)) {
          await term.type("CHECKMATE. MY KING CANNOT ESCAPE. YOU WIN. I WILL REMEMBER THIS.");
        } else {
          await term.type("STALEMATE. I HAVE NO MOVES. NOBODY WINS.");
        }
        break;
      }
      await term.pause(350);
      const diff = typeof getDifficulty === "function" ? getDifficulty() : "normal";
      const jm =
        diff === "easy" && Math.random() < 0.35
          ? replies[Math.floor(Math.random() * replies.length)]
          : ChessCore.bestMove(b, false, Math.random, replies);
      const captured = b[jm.to[1]][jm.to[0]];
      b = ChessCore.apply(b, jm);
      last = jm;
      show(false);
      await term.type("MY MOVE: " + ChessCore.moveText(jm) + (captured ? ". CAPTURE." : "."));
      if (ChessCore.kingGone(b, true)) {
        await term.type("YOUR KING HAS FALLEN. A GOOD GAME OF CHESS.");
        break;
      }
      if (ChessCore.kingAttacked(b, true)) await term.type("CHECK.");
    }
    state.gamesPlayed = (state.gamesPlayed || 0) + 1;
  } finally {
    if (grid) grid.unpin();
    restore();
  }
}
