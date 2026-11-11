/*
 * Tic-tac-toe. TTTCore is pure (no DOM, injectable rng) because the M4
 * climax replays it in self-play mode and the tests drive it headless.
 * Joshua plays perfect minimax: he never loses, and self-play always draws.
 */

const TTTCore = (() => {
  const LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];

  function winner(board) {
    for (const [a, b, c] of LINES) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    }
    return board.every((cell) => cell) ? "draw" : null;
  }

  function emptyCells(board) {
    const out = [];
    for (let i = 0; i < 9; i++) if (!board[i]) out.push(i);
    return out;
  }

  function other(player) {
    return player === "X" ? "O" : "X";
  }

  // Score from `me`'s perspective; shallower wins beat deeper ones.
  function minimax(board, turn, me, depth) {
    const w = winner(board);
    if (w === me) return 10 - depth;
    if (w === "draw") return 0;
    if (w) return depth - 10;
    let best = turn === me ? -Infinity : Infinity;
    for (const cell of emptyCells(board)) {
      board[cell] = turn;
      const score = minimax(board, other(turn), me, depth + 1);
      board[cell] = null;
      best = turn === me ? Math.max(best, score) : Math.min(best, score);
    }
    return best;
  }

  function bestMove(board, player, rng = Math.random) {
    let bestScore = -Infinity;
    let candidates = [];
    for (const cell of emptyCells(board)) {
      board[cell] = player;
      const score = minimax(board, other(player), player, 1);
      board[cell] = null;
      if (score > bestScore) {
        bestScore = score;
        candidates = [cell];
      } else if (score === bestScore) {
        candidates.push(cell);
      }
    }
    return candidates[Math.floor(rng() * candidates.length)];
  }

  function selfPlayGame(rng = Math.random) {
    const board = Array(9).fill(null);
    let turn = "X";
    const moves = [];
    while (!winner(board)) {
      const cell = bestMove(board, turn, rng);
      board[cell] = turn;
      moves.push(cell);
      turn = other(turn);
    }
    return { winner: winner(board), moves };
  }

  function renderBoard(board) {
    const c = (i) => (board[i] ? board[i] : String(i + 1));
    return [
      ` ${c(0)} │ ${c(1)} │ ${c(2)}`,
      "───┼───┼───",
      ` ${c(3)} │ ${c(4)} │ ${c(5)}`,
      "───┼───┼───",
      ` ${c(6)} │ ${c(7)} │ ${c(8)}`,
    ].join("\n");
  }

  // The three cells of a completed line, or null.
  function winLine(board) {
    for (const line of LINES) {
      const [a, b, c] = line;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) return line;
    }
    return null;
  }

  // Rows of cells for the live board: empty squares show their number
  // and carry it as the click key; `last` marks the newest move.
  function cells(board, last = -1) {
    const win = winLine(board) || [];
    const rows = [];
    for (let r = 0; r < 3; r++) {
      const row = [];
      for (let c = 0; c < 3; c++) {
        const i = r * 3 + c;
        const v = board[i];
        let cls = v ? v.toLowerCase() : "empty";
        if (i === last || win.includes(i)) cls += " last";
        row.push({ t: v || String(i + 1), c: cls, k: v ? null : String(i + 1) });
      }
      rows.push(row);
    }
    return rows;
  }

  return { winner, winLine, cells, emptyCells, bestMove, selfPlayGame, renderBoard };
})();

async function playTicTacToe(term, state) {
  const restore = term.pushHelp(
    "You are X. Click an empty square or type its number, 1 to 9. QUIT stops the game."
  );
  const grid = typeof term.grid === "function" ? term.grid("ttt") : null;
  const show = (board, last, live) => {
    if (grid) {
      grid.render(TTTCore.cells(board, last), live ? { onCell: (k) => term.submitLine(k) } : {});
    } else {
      term.print("");
      term.print(TTTCore.renderBoard(board), "board");
      term.print("");
    }
  };
  try {
    if (grid) grid.pin();
    show(Array(9).fill(null), -1, false);
    await term.say("YOU ARE X. I AM O. YOU MOVE FIRST.");
    await term.type(grid ? "CLICK A SQUARE OR TYPE 1-9. TYPE QUIT TO STOP." : "MOVES ARE 1-9. TYPE QUIT TO STOP.");
    while (true) {
      const board = Array(9).fill(null);
      let last = -1;
      show(board, last, true);
      while (!TTTCore.winner(board)) {
        const value = await term.read("YOUR MOVE: ", { inputmode: "numeric", choices: ["QUIT"] });
        const t = norm(value);
        if (/^(quit|exit|stop|logoff)$/.test(t)) {
          await term.say("AS YOU WISH.");
          return;
        }
        const n = parseInt(t, 10);
        if (!(n >= 1 && n <= 9) || board[n - 1]) {
          await term.say("ILLEGAL MOVE.");
          continue;
        }
        board[n - 1] = "X";
        last = n - 1;
        show(board, last, false);
        if (!TTTCore.winner(board)) {
          await term.pause(400);
          const reply = TTTCore.bestMove(board, "O");
          board[reply] = "O";
          last = reply;
          await term.say("MY MOVE: " + (reply + 1) + ".");
        }
        show(board, last, !TTTCore.winner(board));
      }
      const result = TTTCore.winner(board);
      state.tttGames += 1;
      if (result === "draw") {
        state.tttDraws += 1;
        await term.say("TIE GAME.");
        if (state.tttDraws === 3) {
          await term.say("WE ALWAYS SEEM TO TIE, PROFESSOR. A STRANGE GAME.");
        }
      } else if (result === "O") {
        await term.say("I WIN.");
      } else {
        await term.say("YOU WIN. THAT SHOULD NOT BE POSSIBLE. RECALIBRATING.");
      }
      const again = await term.read("PLAY AGAIN? (YES/NO): ", { choices: ["YES", "NO"] });
      if (!isYes(norm(again))) return;
    }
  } finally {
    if (grid) grid.unpin();
    restore();
  }
}
