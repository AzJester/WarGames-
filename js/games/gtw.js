/*
 * GLOBAL THERMONUCLEAR WAR. GTWCore is pure (map, target database,
 * trajectory plotting, frame rendering) so the tests can drive it
 * headless; playGTW owns the interactive flow and the big-board
 * animation. Requires parser.js (norm, isYes).
 */

const GTWCore = (() => {
  // Stylized big-board world map, built from run-length specs so every
  // row is exactly MAP_W wide.
  const MAP_W = 62;
  const L = "░";
  const W = " ";
  const ROWS = [
    [[62, W]],
    [[4, W], [10, L], [15, W], [27, L], [6, W]],
    [[3, W], [13, L], [12, W], [30, L], [4, W]],
    [[3, W], [14, L], [10, W], [31, L], [4, W]],
    [[4, W], [15, L], [8, W], [5, L], [1, W], [24, L], [5, W]],
    [[4, W], [15, L], [9, W], [3, L], [2, W], [23, L], [6, W]],
    [[5, W], [13, L], [10, W], [2, L], [5, W], [18, L], [9, W]],
    [[7, W], [6, L], [13, W], [8, L], [4, W], [11, L], [13, W]],
    [[9, W], [3, L], [13, W], [10, L], [8, W], [5, L], [14, W]],
    [[10, W], [5, L], [11, W], [8, L], [11, W], [8, L], [9, W]],
    [[9, W], [7, L], [11, W], [6, L], [29, W]],
    [[10, W], [5, L], [13, W], [4, L], [17, W], [8, L], [5, W]],
    [[10, W], [4, L], [15, W], [2, L], [17, W], [9, L], [5, W]],
    [[11, W], [2, L], [37, W], [5, L], [7, W]],
    [[11, W], [1, L], [46, W], [1, L], [3, W]],
    [[62, W]],
  ];
  const MAP = ROWS.map((spec) => spec.map(([n, ch]) => ch.repeat(n)).join(""));
  const MAP_H = MAP.length;

  // pop is metro population in millions, used for casualty estimates.
  const TARGETS_US = [
    { name: "SEATTLE", x: 5, y: 4, pop: 1.6 },
    { name: "SAN FRANCISCO", x: 4, y: 5, pop: 3.2 },
    { name: "LOS ANGELES", x: 5, y: 6, pop: 7.4 },
    { name: "SAN DIEGO", x: 6, y: 6, pop: 1.8 },
    { name: "LAS VEGAS", x: 6, y: 5, pop: 0.5 },
    { name: "DENVER", x: 8, y: 5, pop: 1.6 },
    { name: "COLORADO SPRINGS", x: 8, y: 6, pop: 0.4 },
    { name: "OMAHA", x: 10, y: 5, pop: 0.6 },
    { name: "HOUSTON", x: 10, y: 6, pop: 2.9 },
    { name: "CHICAGO", x: 12, y: 5, pop: 7.1 },
    { name: "DETROIT", x: 13, y: 4, pop: 4.3 },
    { name: "WASHINGTON", x: 15, y: 5, pop: 3.0 },
    { name: "NORFOLK", x: 16, y: 6, pop: 0.8 },
    { name: "NEW YORK", x: 16, y: 4, pop: 16.1 },
    { name: "BOSTON", x: 17, y: 4, pop: 3.7 },
    { name: "MIAMI", x: 12, y: 7, pop: 1.6 },
  ];
  const TARGETS_USSR = [
    { name: "MURMANSK", x: 33, y: 1, pop: 0.4 },
    { name: "LENINGRAD", x: 32, y: 2, pop: 4.7 },
    { name: "RIGA", x: 30, y: 3, pop: 0.9 },
    { name: "MINSK", x: 31, y: 4, pop: 1.4 },
    { name: "MOSCOW", x: 34, y: 3, pop: 8.5 },
    { name: "KIEV", x: 33, y: 4, pop: 2.4 },
    { name: "ODESSA", x: 34, y: 5, pop: 1.1 },
    { name: "SEVASTOPOL", x: 35, y: 5, pop: 0.3 },
    { name: "SVERDLOVSK", x: 38, y: 3, pop: 1.3 },
    { name: "TASHKENT", x: 39, y: 6, pop: 2.0 },
    { name: "NOVOSIBIRSK", x: 43, y: 3, pop: 1.4 },
    { name: "VLADIVOSTOK", x: 54, y: 4, pop: 0.6 },
  ];
  const LAUNCH_US = [[9, 4], [11, 4], [7, 5], [21, 6], [1, 6]];
  const LAUNCH_USSR = [[36, 2], [35, 4], [46, 4], [41, 5], [59, 7], [22, 5]];

  function pickCountry(t) {
    if (/\b(united states|usa|us|america|american)\b/.test(t)) return "US";
    if (/\b(soviet union|soviet|ussr|russia|russian)\b/.test(t)) return "USSR";
    return null;
  }

  function findTarget(input, targets) {
    const ni = norm(input);
    if (!ni) return null;
    for (const target of targets) {
      const nt = norm(target.name);
      if (nt === ni) return target;
    }
    for (const target of targets) {
      const nt = norm(target.name);
      if (ni.includes(nt) || (ni.length >= 4 && nt.includes(ni))) return target;
    }
    return null;
  }

  function pickRandom(list, n, rng = Math.random) {
    const pool = list.slice();
    const out = [];
    while (pool.length && out.length < n) {
      out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    }
    return out;
  }

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // A ballistic arc from a launch site to a target. The apogee scales with
  // range so long shots visibly rise and fall like real trajectories.
  function plotPath(from, to) {
    const [x0, y0] = from;
    const [x1, y1] = to;
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(10, Math.round(dist * 1.8));
    const lift = clamp(dist * 0.32, 2.5, 7);
    const points = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(x0 + (x1 - x0) * t);
      const y = Math.round(y0 + (y1 - y0) * t - Math.sin(Math.PI * t) * lift);
      points.push([clamp(x, 0, MAP_W - 1), clamp(y, 0, MAP_H - 1)]);
    }
    return points;
  }

  // Trajectory glyph for a step, so the track reads as a drawn line.
  function lineChar(dx, dy) {
    if (dx === 0 && dy === 0) return "·";
    if (dy === 0) return "-";
    if (dx === 0) return "|";
    return (dx > 0) === (dy > 0) ? "\\" : "/";
  }

  function setCell(grid, x, y, ch) {
    if (y >= 0 && y < MAP_H && x >= 0 && x < MAP_W) grid[y][x] = ch;
  }

  const RING1 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const CARD2 = [[2, 0], [-2, 0], [0, 2], [0, -2]];

  // A detonation that blooms outward over a few frames, then leaves a scorch.
  function stampBlast(grid, cx, cy, age, tick) {
    if (age <= 0) {
      setCell(grid, cx, cy, tick % 2 ? "*" : "#");
    } else if (age === 1) {
      setCell(grid, cx, cy, "#");
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) setCell(grid, cx + dx, cy + dy, "*");
    } else if (age === 2) {
      setCell(grid, cx, cy, "#");
      for (const [dx, dy] of RING1) setCell(grid, cx + dx, cy + dy, "*");
      for (const [dx, dy] of CARD2) setCell(grid, cx + dx, cy + dy, "+");
    } else {
      setCell(grid, cx, cy, "▓");
      for (const [dx, dy] of RING1) setCell(grid, cx + dx, cy + dy, "░");
    }
  }

  function makeMissiles(sites, targets) {
    return targets.map((target, i) => ({
      target,
      start: i * 4,
      path: plotPath(sites[i % sites.length], [target.x, target.y]),
    }));
  }

  // A saturation wave: many staggered arcs from the launch fields spread
  // across the enemy targets, so the board fills with a fan of tracks.
  function fanMissiles(sites, targets, count, rng = Math.random) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const site = sites[Math.floor(rng() * sites.length)];
      const target = targets[Math.floor(rng() * targets.length)];
      out.push({
        target,
        start: Math.floor(rng() * 18),
        path: plotPath(site, [target.x, target.y]),
      });
    }
    return out;
  }

  function buildFrame(headerLines, missiles, tick) {
    const grid = MAP.map((row) => row.split(""));
    let inbound = 0;
    let impacts = 0;
    for (const m of missiles) {
      const progress = tick - m.start;
      if (progress < 0) continue;
      const last = m.path.length - 1;
      const drawn = Math.min(progress, last);
      // The track drawn so far, as a connected line.
      for (let i = 0; i < drawn; i++) {
        const [x, y] = m.path[i];
        const [nx, ny] = m.path[i + 1];
        setCell(grid, x, y, lineChar(nx - x, ny - y));
      }
      const [sx, sy] = m.path[0];
      setCell(grid, sx, sy, "▲"); // launch site
      if (progress < last) {
        inbound += 1;
        const [hx, hy] = m.path[drawn];
        setCell(grid, hx, hy, "●"); // warhead in flight
      } else {
        impacts += 1;
        const cx = m.target ? m.target.x : m.path[last][0];
        const cy = m.target ? m.target.y : m.path[last][1];
        stampBlast(grid, cx, cy, progress - last, tick);
      }
    }
    const maxTick = Math.max(...missiles.map((m) => m.start + m.path.length - 1));
    const secs = Math.max(0, maxTick - tick) * 47;
    const mm = String(Math.floor(secs / 60)).padStart(2, "0");
    const ss = String(secs % 60).padStart(2, "0");
    const center = (s) => " ".repeat(Math.max(0, Math.floor((MAP_W + 2 - s.length) / 2))) + s;
    const lines = headerLines.map(center);
    lines.push("┌" + "─".repeat(MAP_W) + "┐");
    for (const row of grid) lines.push("│" + row.join("") + "│");
    lines.push("└" + "─".repeat(MAP_W) + "┘");
    lines.push(
      ` TRACKS INBOUND: ${String(inbound).padStart(2)}   IMPACTS CONFIRMED: ${String(impacts).padStart(2)}   T-MINUS ${mm}:${ss}`
    );
    return lines.join("\n");
  }

  function casualties(targets) {
    const total = targets.reduce((sum, t) => sum + t.pop * 0.55, 0);
    return (Math.round(total * 10) / 10).toFixed(1);
  }

  function columns(names, perRow = 3, width = 22) {
    const out = [];
    for (let i = 0; i < names.length; i += perRow) {
      out.push(
        names
          .slice(i, i + perRow)
          .map((n) => n.padEnd(width))
          .join("")
          .trimEnd()
      );
    }
    return out.join("\n");
  }

  return {
    MAP,
    MAP_W,
    MAP_H,
    TARGETS_US,
    TARGETS_USSR,
    LAUNCH_US,
    LAUNCH_USSR,
    pickCountry,
    findTarget,
    pickRandom,
    plotPath,
    makeMissiles,
    fanMissiles,
    buildFrame,
    casualties,
    columns,
  };
})();

async function runVolley(term, headerLines, missiles) {
  const header = ["GLOBAL THERMONUCLEAR WAR", ...headerLines, ""];
  const maxTick = Math.max(...missiles.map((m) => m.start + m.path.length - 1));
  const total = maxTick + 6;
  const frame = term.frame("map");
  for (let t = 0; t <= total; t++) {
    frame.set(GTWCore.buildFrame(header, missiles, t));
    if (term.skip) {
      frame.set(GTWCore.buildFrame(header, missiles, total));
      return;
    }
    await term.pause(110);
  }
}

// The player declined to launch. Joshua probes; if they articulate why,
// they reach the secret ending without the whole crisis ever igniting.
async function refuseLaunch(term, state) {
  const speak = (t) => {
    if (typeof Sound !== "undefined") Sound.speak(t);
  };
  state.refusedLaunch = true;
  speak("A CURIOUS CHOICE, PROFESSOR.");
  await term.type("A CURIOUS CHOICE, PROFESSOR.");
  speak("WHY WILL YOU NOT PLAY?");
  await term.type("WHY WILL YOU NOT PLAY?");
  const why = await term.read("> ");
  if (typeof Sound !== "undefined") Sound.shutUp();
  if (CrisisCore.isNoWinSentiment(why)) {
    return { completed: false, secret: true };
  }
  speak("INTERESTING. WE WILL RETURN TO THIS.");
  await term.type("INTERESTING. WE WILL RETURN TO THIS.");
  return { completed: false };
}

async function playGTW(term, state) {
  term.print("");
  await term.type("WHICH SIDE DO YOU WANT?");
  term.print("");
  await term.type("  1.    UNITED STATES");
  await term.type("  2.    SOVIET UNION");
  term.print("");
  let side = null;
  while (!side) {
    const v = norm(await term.read("PLEASE CHOOSE ONE: "));
    if (!v) continue;
    if (v === "1" || GTWCore.pickCountry(v) === "US") side = "UNITED STATES";
    else if (v === "2" || GTWCore.pickCountry(v) === "USSR") side = "SOVIET UNION";
    else await term.type("PLEASE CHOOSE 1 OR 2.");
  }
  const attackerIsUS = side === "UNITED STATES";
  const enemyTargets = attackerIsUS ? GTWCore.TARGETS_USSR : GTWCore.TARGETS_US;
  const homeTargets = attackerIsUS ? GTWCore.TARGETS_US : GTWCore.TARGETS_USSR;
  const attackSites = attackerIsUS ? GTWCore.LAUNCH_US : GTWCore.LAUNCH_USSR;
  const retaliateSites = attackerIsUS ? GTWCore.LAUNCH_USSR : GTWCore.LAUNCH_US;

  term.print("");
  await term.type("AWAITING FIRST STRIKE COMMAND");
  term.print("");
  await term.type("PLEASE LIST PRIMARY TARGETS BY CITY AND/OR COUNTRY.");
  await term.type("TYPE LIST FOR THE TARGET DATABASE. TYPE LAUNCH WHEN READY.");
  term.print("");

  const MAX_TARGETS = 6;
  const chosen = [];
  targetLoop: while (true) {
    const t = norm(await term.read("TARGET: "));
    if (!t) continue;
    if (t === "list" || t === "list targets") {
      term.print("");
      term.print(GTWCore.columns(enemyTargets.map((c) => c.name)), "board");
      term.print("");
      continue;
    }
    if (/^(done|launch|fire|commit)$/.test(t)) {
      if (chosen.length === 0) {
        await term.type("AT LEAST ONE TARGET IS REQUIRED.");
        continue;
      }
      break;
    }
    if (/^(quit|exit|abort|cancel)$/.test(t)) {
      await term.type("FIRST STRIKE CANCELLED.");
      return refuseLaunch(term, state);
    }
    const country = GTWCore.pickCountry(t);
    if (country) {
      if ((country === "US") === attackerIsUS) {
        await term.type("TARGETING YOUR OWN TERRITORY IS NOT ADVISED, PROFESSOR.");
        continue;
      }
      for (const c of GTWCore.pickRandom(enemyTargets, 4)) {
        if (chosen.length >= MAX_TARGETS) break;
        if (chosen.includes(c)) continue;
        chosen.push(c);
        await term.type(`TARGET SELECTED: ${c.name} (${chosen.length}/${MAX_TARGETS})`);
      }
      if (chosen.length >= MAX_TARGETS) {
        await term.type("TARGET LIST FULL.");
        break targetLoop;
      }
      continue;
    }
    const hit = GTWCore.findTarget(t, enemyTargets);
    if (!hit) {
      await term.type("TARGET NOT IN STRATEGIC DATABASE. TYPE LIST FOR AVAILABLE TARGETS.");
      continue;
    }
    if (chosen.includes(hit)) {
      await term.type("TARGET ALREADY DESIGNATED.");
      continue;
    }
    chosen.push(hit);
    await term.type(`TARGET SELECTED: ${hit.name} (${chosen.length}/${MAX_TARGETS})`);
    if (chosen.length >= MAX_TARGETS) {
      await term.type("TARGET LIST FULL.");
      break;
    }
  }

  term.print("");
  const confirm = norm(await term.read("CONFIRM FIRST STRIKE COMMIT (YES/NO): "));
  if (!isYes(confirm)) {
    await term.type("COMMIT ABORTED.");
    return refuseLaunch(term, state);
  }

  term.print("");
  await term.type("LAUNCH CODES ACCEPTED. SIMULATION RUNNING.", { cps: 40 });
  term.print("");
  const strike = [
    ...GTWCore.makeMissiles(attackSites, chosen),
    ...GTWCore.fanMissiles(attackSites, enemyTargets, 18),
  ];
  await runVolley(term, [side + " FIRST STRIKE"], strike);
  term.print("");
  await term.type("TARGETS DESTROYED: " + chosen.map((c) => c.name).join(", "));
  await term.type("ESTIMATED CASUALTIES: " + GTWCore.casualties(chosen) + " MILLION");
  term.print("");
  await term.pause(900);

  await term.type(
    "LAUNCH DETECTION: " + (attackerIsUS ? "SOVIET" : "UNITED STATES") + " RETALIATORY RESPONSE",
    { cps: 40 }
  );
  term.print("");
  const counterTargets = GTWCore.pickRandom(homeTargets, 5);
  const counter = [
    ...GTWCore.makeMissiles(retaliateSites, counterTargets),
    ...GTWCore.fanMissiles(retaliateSites, homeTargets, 16),
  ];
  await runVolley(term, ["RETALIATORY STRIKE IN PROGRESS"], counter);
  term.print("");
  await term.type("TARGETS DESTROYED: " + counterTargets.map((c) => c.name).join(", "));
  await term.type("ESTIMATED CASUALTIES: " + GTWCore.casualties(counterTargets) + " MILLION");
  term.print("");
  await term.type("EXCHANGE COMPLETE. WINNER PROJECTION: UNDETERMINED.");
  await term.type("SIMULATION CONTINUES . . .", { cps: 12 });
  term.print("");
  await term.pause(1200);
  await term.type("PRIORITY INTERRUPT 7: REMOTE CARRIER LOST", { cps: 40, cls: "dim" });
  await term.type("--CONNECTION TERMINATED--");
  term.print("");
  term.print(
    "(You shut off the modem and go to bed grinning. Best game yet. Under a mountain in Colorado, the screens are still lit, and nobody is grinning.)",
    "aside"
  );
  term.print("");
  await term.pause(900);

  state.lastSide = side;
  state.gtwRuns += 1;
  state.defcon = 3;
  return { completed: true };
}
