/*
 * FALKEN'S MAZE: the first game on the list, finally playable. A small
 * generated labyrinth explored with N/S/E/W (or WASD). MazeCore is pure
 * (injectable rng, BFS-checkable) for the tests. Requires parser.js.
 */

const MazeCore = (() => {
  // Recursive-backtracker maze on an odd-sized grid. '#' wall, ' ' floor.
  function generate(w = 21, h = 11, rng = Math.random) {
    const g = Array.from({ length: h }, () => Array(w).fill("#"));
    const carve = (x, y) => {
      g[y][x] = " ";
      const dirs = [[2, 0], [-2, 0], [0, 2], [0, -2]].sort(() => rng() - 0.5);
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (ny > 0 && ny < h - 1 && nx > 0 && nx < w - 1 && g[ny][nx] === "#") {
          g[y + dy / 2][x + dx / 2] = " ";
          carve(nx, ny);
        }
      }
    };
    carve(1, 1);
    return { grid: g, start: [1, 1], exit: [w - 2, h - 2] };
  }

  function solvable(maze) {
    const { grid, start, exit } = maze;
    const seen = new Set([start.join()]);
    const q = [start];
    while (q.length) {
      const [x, y] = q.shift();
      if (x === exit[0] && y === exit[1]) return true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (
          grid[ny] &&
          grid[ny][nx] === " " &&
          !seen.has([nx, ny].join())
        ) {
          seen.add([nx, ny].join());
          q.push([nx, ny]);
        }
      }
    }
    return false;
  }

  function render(maze, px, py) {
    return maze.grid
      .map((row, y) =>
        row
          .map((c, x) => {
            if (x === px && y === py) return "@";
            if (x === maze.exit[0] && y === maze.exit[1]) return "X";
            return c === "#" ? "█" : " ";
          })
          .join("")
      )
      .join("\n");
  }

  function step(input) {
    const t = norm(input);
    if (/^(n|north|up|k)$/.test(t)) return [0, -1];
    if (/^(s|south|down|j)$/.test(t)) return [0, 1];
    if (/^(e|east|right|d|l)$/.test(t)) return [1, 0];
    if (/^(w|west|left|a|h)$/.test(t)) return [-1, 0];
    return null;
  }

  // Rows of cells for the live maze; `seen` holds "x,y" squares walked.
  function cells(maze, px, py, seen = null) {
    return maze.grid.map((row, y) =>
      row.map((c, x) => {
        if (x === px && y === py) return { t: "@", c: "me" };
        if (x === maze.exit[0] && y === maze.exit[1]) return { t: "X", c: "exit" };
        if (c === "#") return { t: "", c: "wall" };
        return seen && seen.has(x + "," + y) ? { t: "·", c: "trail" } : { t: "", c: "" };
      })
    );
  }

  return { generate, solvable, render, step, cells };
})();

async function playMaze(term, state) {
  const restore = term.pushHelp(
    "You are the bright square. Reach the amber X. Use the arrow keys or the N, S, E, W buttons, or type a direction. You keep walking until the corridor branches. QUIT stops."
  );
  const grid = typeof term.grid === "function" ? term.grid("maze") : null;
  const maze = MazeCore.generate();
  let [px, py] = maze.start;
  let steps = 0;
  const seen = new Set([px + "," + py]);
  const show = () => {
    if (grid) {
      grid.render(MazeCore.cells(maze, px, py, seen));
    } else {
      term.print("");
      term.print(MazeCore.render(maze, px, py), "board");
      term.print("");
    }
  };
  const keys = { ArrowUp: "N", ArrowDown: "S", ArrowLeft: "W", ArrowRight: "E" };
  const chips = ["W", "N", "S", "E", "QUIT"];
  try {
    if (grid) grid.pin();
    show();
    await term.type("FALKEN'S MAZE. THE FIRST GAME HE EVER WROTE FOR ME.");
    await term.type(
      grid
        ? "YOU ARE @. REACH X. USE THE ARROW KEYS, OR N, S, E, W. TYPE QUIT TO STOP."
        : "YOU ARE @. REACH X. MOVE WITH N, S, E, W. TYPE QUIT TO STOP."
    );
    while (true) {
      const tn = norm(await term.read("DIRECTION: ", { keys, choices: chips }));
      if (/^(quit|exit|stop)$/.test(tn)) {
        await term.type("THE MAZE WILL KEEP.");
        break;
      }
      const d = MazeCore.step(tn);
      if (!d) {
        await term.type("N, S, E OR W, PROFESSOR.");
        continue;
      }
      // walk in that direction until a wall or a junction, maze-runner style
      let moved = false;
      while (true) {
        const nx = px + d[0];
        const ny = py + d[1];
        if (!maze.grid[ny] || maze.grid[ny][nx] !== " ") break;
        px = nx;
        py = ny;
        seen.add(px + "," + py);
        steps += 1;
        moved = true;
        const exits = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(
          ([dx, dy]) =>
            !(dx === -d[0] && dy === -d[1]) &&
            maze.grid[py + dy] &&
            maze.grid[py + dy][px + dx] === " "
        );
        if (px === maze.exit[0] && py === maze.exit[1]) break;
        if (exits.length !== 1 || exits[0][0] !== d[0] || exits[0][1] !== d[1]) break;
        d[0] = exits[0][0];
        d[1] = exits[0][1];
      }
      if (!moved) {
        await term.type("A WALL.");
        continue;
      }
      show();
      if (px === maze.exit[0] && py === maze.exit[1]) {
        await term.type("YOU FOUND THE WAY OUT IN " + steps + " STEPS.");
        await term.type("JOSHUA ALWAYS FOUND THE CENTER. HIS FATHER NEVER KNEW HOW.");
        break;
      }
    }
    state.gamesPlayed = (state.gamesPlayed || 0) + 1;
  } finally {
    if (grid) grid.unpin();
    restore();
  }
}
