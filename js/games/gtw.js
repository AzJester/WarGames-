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

  function plotPath(from, to) {
    const [x0, y0] = from;
    const [x1, y1] = to;
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(6, Math.round(dist * 1.5));
    const lift = Math.min(3, dist / 8);
    const points = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(x0 + (x1 - x0) * t);
      const y = Math.round(y0 + (y1 - y0) * t - Math.sin(Math.PI * t) * lift);
      points.push([clamp(x, 0, MAP_W - 1), clamp(y, 0, MAP_H - 1)]);
    }
    return points;
  }

  function makeMissiles(sites, targets) {
    return targets.map((target, i) => ({
      target,
      start: i * 4,
      path: plotPath(sites[i % sites.length], [target.x, target.y]),
    }));
  }

  function buildFrame(headerLines, missiles, tick) {
    const grid = MAP.map((row) => row.split(""));
    let inbound = 0;
    let impacts = 0;
    for (const m of missiles) {
      const progress = tick - m.start;
      if (progress < 0) continue;
      const last = m.path.length - 1;
      const end = Math.min(progress, last);
      for (let i = 0; i < end; i++) {
        const [x, y] = m.path[i];
        grid[y][x] = "·";
      }
      const [x, y] = m.path[end];
      if (progress < last) {
        inbound += 1;
        grid[y][x] = "+";
      } else {
        impacts += 1;
        grid[y][x] = tick % 2 === 0 ? "*" : "#";
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
      state.refusedLaunch = true;
      await term.type("FIRST STRIKE CANCELLED.");
      await term.type("A CURIOUS CHOICE, PROFESSOR.");
      return { completed: false };
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
    state.refusedLaunch = true;
    await term.type("COMMIT ABORTED.");
    await term.type("A CURIOUS CHOICE, PROFESSOR.");
    return { completed: false };
  }

  term.print("");
  await term.type("LAUNCH CODES ACCEPTED. SIMULATION RUNNING.", { cps: 40 });
  term.print("");
  const strike = GTWCore.makeMissiles(attackSites, chosen);
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
  const counter = GTWCore.makeMissiles(retaliateSites, counterTargets);
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
    "(You shut off the modem and go to bed grinning. Best game yet. Under a mountain in Colorado, the screens are still lit, and nobody is grinning. Milestone 4 begins there.)",
    "aside"
  );
  term.print("");

  state.lastSide = side;
  state.gtwRuns += 1;
  state.defcon = 3;
  return { completed: true };
}
