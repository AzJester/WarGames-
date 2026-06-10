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

  return { winner, emptyCells, bestMove, selfPlayGame, renderBoard };
})();

async function playTicTacToe(term, state) {
  await term.type("YOU ARE X. I AM O. YOU MOVE FIRST.");
  await term.type("MOVES ARE 1-9. TYPE QUIT TO STOP.");
  while (true) {
    const board = Array(9).fill(null);
    term.print("");
    term.print(TTTCore.renderBoard(board), "board");
    term.print("");
    while (!TTTCore.winner(board)) {
      const value = await term.read("YOUR MOVE: ");
      const t = norm(value);
      if (/^(quit|exit|stop|logoff)$/.test(t)) {
        await term.type("AS YOU WISH.");
        return;
      }
      const n = parseInt(t, 10);
      if (!(n >= 1 && n <= 9) || board[n - 1]) {
        await term.type("ILLEGAL MOVE.");
        continue;
      }
      board[n - 1] = "X";
      if (!TTTCore.winner(board)) {
        await term.pause(400);
        board[TTTCore.bestMove(board, "O")] = "O";
      }
      term.print("");
      term.print(TTTCore.renderBoard(board), "board");
      term.print("");
    }
    const result = TTTCore.winner(board);
    state.tttGames += 1;
    if (result === "draw") {
      state.tttDraws += 1;
      await term.type("TIE GAME.");
      if (state.tttDraws === 3) {
        await term.type("WE ALWAYS SEEM TO TIE, PROFESSOR. A STRANGE GAME.");
      }
    } else if (result === "O") {
      await term.type("I WIN.");
    } else {
      await term.type("YOU WIN. THAT SHOULD NOT BE POSSIBLE. RECALIBRATING.");
    }
    const again = await term.read("PLAY AGAIN? (YES/NO): ");
    if (!isYes(norm(again))) return;
  }
}
