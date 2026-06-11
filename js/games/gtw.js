/*
 * GLOBAL THERMONUCLEAR WAR. GTWCore is pure (real-geography map, target
 * database with true coordinates, great-circle trajectories, projections,
 * frame rendering) so the tests can drive it headless; playGTW owns the
 * interactive flow. Requires parser.js (norm, isYes) and geo.js (GEO).
 */

const GTWCore = (() => {
  // Classic board: the baked land raster from Natural Earth data.
  const MAP = typeof GEO !== "undefined" ? GEO.GRID : ["░"];
  const MAP_W = MAP[0].length;
  const MAP_H = MAP.length;
  const LAT_TOP = typeof GEO !== "undefined" ? GEO.LAT_TOP : 84;
  const LAT_BOT = typeof GEO !== "undefined" ? GEO.LAT_BOT : -60;

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // True lon/lat to classic grid cell.
  function toGrid(lon, lat) {
    const x = Math.round(((lon + 180) / 360) * (MAP_W - 1));
    const y = Math.round(((LAT_TOP - lat) / (LAT_TOP - LAT_BOT)) * (MAP_H - 1));
    return [clamp(x, 0, MAP_W - 1), clamp(y, 0, MAP_H - 1)];
  }

  // Coastal cities can quantize into the sea; snap to the nearest land cell.
  function snapToLand(x, y) {
    if (MAP[y][x] === "░") return [x, y];
    for (let r = 1; r <= 2; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (ny >= 0 && ny < MAP_H && nx >= 0 && nx < MAP_W && MAP[ny][nx] === "░") {
            return [nx, ny];
          }
        }
      }
    }
    return [x, y];
  }

  function city(name, lon, lat, pop) {
    const [x, y] = snapToLand(...toGrid(lon, lat));
    return { name, lon, lat, pop, x, y };
  }

  function site(name, lon, lat) {
    const [x, y] = toGrid(lon, lat); // submarines sit in open water; no snap
    return { name, lon, lat, x, y };
  }

  // pop is metro population in millions, used for casualty estimates.
  const TARGETS_US = [
    city("SEATTLE", -122.3, 47.6, 1.6),
    city("SAN FRANCISCO", -122.4, 37.8, 3.2),
    city("LOS ANGELES", -118.2, 34.1, 7.4),
    city("SAN DIEGO", -117.2, 32.7, 1.8),
    city("LAS VEGAS", -115.1, 36.2, 0.5),
    city("DENVER", -105.0, 39.7, 1.6),
    city("COLORADO SPRINGS", -104.8, 38.8, 0.4),
    city("OMAHA", -96.0, 41.3, 0.6),
    city("HOUSTON", -95.4, 29.8, 2.9),
    city("CHICAGO", -87.6, 41.9, 7.1),
    city("DETROIT", -83.0, 42.3, 4.3),
    city("WASHINGTON", -77.0, 38.9, 3.0),
    city("NORFOLK", -76.3, 36.9, 0.8),
    city("NEW YORK", -74.0, 40.7, 16.1),
    city("BOSTON", -71.1, 42.4, 3.7),
    city("MIAMI", -80.2, 25.8, 1.6),
  ];
  const TARGETS_USSR = [
    city("MURMANSK", 33.0, 69.0, 0.4),
    city("LENINGRAD", 30.3, 59.9, 4.7),
    city("RIGA", 24.1, 56.9, 0.9),
    city("MINSK", 27.6, 53.9, 1.4),
    city("MOSCOW", 37.6, 55.8, 8.5),
    city("KIEV", 30.5, 50.5, 2.4),
    city("ODESSA", 30.7, 46.5, 1.1),
    city("SEVASTOPOL", 33.5, 44.6, 0.3),
    city("SVERDLOVSK", 60.6, 56.8, 1.3),
    city("TASHKENT", 69.2, 41.3, 2.0),
    city("NOVOSIBIRSK", 82.9, 55.0, 1.4),
    city("VLADIVOSTOK", 131.9, 43.1, 0.6),
  ];

  // Real missile fields plus submarine patrol boxes.
  const SITES_US = [
    site("MINOT AFB", -101.3, 48.2),
    site("GRAND FORKS AFB", -97.4, 48.0),
    site("F.E. WARREN AFB", -104.9, 41.1),
    site("SSBN ATLANTIC", -65.0, 33.0),
    site("SSBN PACIFIC", -155.0, 30.0),
  ];
  const SITES_USSR = [
    site("PLESETSK", 40.7, 62.9),
    site("KOZELSK", 35.8, 54.0),
    site("DOMBAROVSKY", 59.5, 51.0),
    site("TYURATAM", 63.3, 45.9),
    site("SSBN PACIFIC", 165.0, 45.0),
    site("SSBN ATLANTIC", -30.0, 55.0),
  ];
  const LAUNCH_US = SITES_US.map((s) => [s.x, s.y]);
  const LAUNCH_USSR = SITES_USSR.map((s) => [s.x, s.y]);

  // Great-circle interpolation between [lon, lat] points (slerp on the
  // sphere), which is why polar shots genuinely cross the Arctic.
  function gc(a, b, t) {
    const rad = Math.PI / 180;
    const v = ([lon, lat]) => [
      Math.cos(lat * rad) * Math.cos(lon * rad),
      Math.cos(lat * rad) * Math.sin(lon * rad),
      Math.sin(lat * rad),
    ];
    const A = v(a);
    const B = v(b);
    const dot = clamp(A[0] * B[0] + A[1] * B[1] + A[2] * B[2], -1, 1);
    const omega = Math.acos(dot);
    if (omega < 1e-6) return a.slice();
    const s1 = Math.sin((1 - t) * omega) / Math.sin(omega);
    const s2 = Math.sin(t * omega) / Math.sin(omega);
    const P = [
      s1 * A[0] + s2 * B[0],
      s1 * A[1] + s2 * B[1],
      s1 * A[2] + s2 * B[2],
    ];
    const lat = Math.asin(clamp(P[2], -1, 1)) / rad;
    const lon = Math.atan2(P[1], P[0]) / rad;
    return [lon, lat];
  }

  // Projections to a unit square; the renderer scales to its canvas.
  function projectFlat(lon, lat) {
    return [(lon + 180) / 360, clamp((LAT_TOP - lat) / (LAT_TOP - LAT_BOT), 0, 1.05)];
  }

  // Azimuthal equidistant from the North Pole, cropped to the northern
  // hemisphere: the NORAD wall view. lat -10 sits on the rim.
  const POLAR_LAT_MIN = -10;

  function projectPolar(lon, lat) {
    const r = (90 - lat) / 100 / 2;
    const a = (lon * Math.PI) / 180;
    return [0.5 + r * Math.sin(a), 0.5 + r * Math.cos(a)];
  }

  function pickCountry(t) {
    if (/\b(united states|usa|us|america|american)\b/.test(t)) return "US";
    if (/\b(soviet union|soviet|ussr|russia|russian)\b/.test(t)) return "USSR";
    return null;
  }

  function findTarget(input, targets) {
    const ni = norm(input);
    if (!ni) return null;
    for (const target of targets) {
      if (norm(target.name) === ni) return target;
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

  // Classic-board arc between grid cells.
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
    return targets.map((target, i) => {
      const s = sites[i % sites.length];
      return {
        target,
        start: i * 4,
        path: plotPath([s.x, s.y], [target.x, target.y]),
        fromLL: [s.lon, s.lat],
        toLL: [target.lon, target.lat],
      };
    });
  }

  // A saturation wave: many staggered arcs spread across the target set.
  function fanMissiles(sites, targets, count, rng = Math.random) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const s = sites[Math.floor(rng() * sites.length)];
      const target = targets[Math.floor(rng() * targets.length)];
      out.push({
        target,
        start: Math.floor(rng() * 18),
        path: plotPath([s.x, s.y], [target.x, target.y]),
        fromLL: [s.lon, s.lat],
        toLL: [target.lon, target.lat],
      });
    }
    return out;
  }

  // ABM screens: each missile may be killed mid-flight. Truncates the
  // classic path and records the cut as interceptT for the canvas.
  function planIntercepts(missiles, chance, rng = Math.random) {
    let n = 0;
    for (const m of missiles) {
      if (chance > 0 && rng() < chance) {
        m.intercepted = true;
        m.interceptT = 0.65;
        m.path = m.path.slice(0, Math.max(2, Math.ceil(m.path.length * 0.65)));
        n += 1;
      }
    }
    return n;
  }

  function buildFrame(headerLines, missiles, tick) {
    const grid = MAP.map((row) => row.split(""));
    let inbound = 0;
    let impacts = 0;
    let intercepted = 0;
    for (const m of missiles) {
      const progress = tick - m.start;
      if (progress < 0) continue;
      const last = m.path.length - 1;
      const drawn = Math.min(progress, last);
      for (let i = 0; i < drawn; i++) {
        const [x, y] = m.path[i];
        const [nx, ny] = m.path[i + 1];
        setCell(grid, x, y, lineChar(nx - x, ny - y));
      }
      const [sx, sy] = m.path[0];
      setCell(grid, sx, sy, "▲");
      if (progress < last) {
        inbound += 1;
        const [hx, hy] = m.path[drawn];
        setCell(grid, hx, hy, "●");
      } else if (m.intercepted) {
        intercepted += 1;
        const [ix, iy] = m.path[last];
        setCell(grid, ix, iy, "X");
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
    let footer = ` TRACKS INBOUND: ${String(inbound).padStart(2)}   IMPACTS CONFIRMED: ${String(impacts).padStart(2)}`;
    if (intercepted > 0) footer += `   INTERCEPTED: ${String(intercepted).padStart(2)}`;
    footer += `   T-MINUS ${mm}:${ss}`;
    lines.push(footer);
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
    LAT_TOP,
    LAT_BOT,
    POLAR_LAT_MIN,
    TARGETS_US,
    TARGETS_USSR,
    SITES_US,
    SITES_USSR,
    LAUNCH_US,
    LAUNCH_USSR,
    toGrid,
    gc,
    projectFlat,
    projectPolar,
    pickCountry,
    findTarget,
    pickRandom,
    plotPath,
    makeMissiles,
    fanMissiles,
    planIntercepts,
    buildFrame,
    casualties,
    columns,
  };
})();

// Difficulty shapes the ABM screens: on EASY the enemy's retaliation gets
// thinned for you; on HARD your own strike runs into theirs.
function gtwInterceptChances() {
  const d = typeof getDifficulty === "function" ? getDifficulty() : "normal";
  if (d === "easy") return { strike: 0, retaliation: 0.45 };
  if (d === "hard") return { strike: 0.3, retaliation: 0 };
  return { strike: 0.1, retaliation: 0.1 };
}

async function runVolley(term, headerLines, missiles) {
  const header = ["GLOBAL THERMONUCLEAR WAR", ...headerLines, ""];
  if (typeof Modern !== "undefined" && Modern.isModern()) {
    if (typeof Sound !== "undefined") Sound.startAmbient();
    const rendered = Modern.renderVolley(term, header.filter(Boolean), missiles);
    if (rendered) {
      await rendered;
      if (typeof Sound !== "undefined") Sound.stopAmbient();
      return;
    }
    if (typeof Sound !== "undefined") Sound.stopAmbient();
  }
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

// Free-text target selection against one side's database. Returns the
// chosen list, or null if the player aborted.
async function selectTargets(term, state, enemyTargets, attackerIsUS, label) {
  term.print("");
  await term.type("AWAITING " + label + " COMMAND");
  term.print("");
  await term.type("PLEASE LIST PRIMARY TARGETS BY CITY AND/OR COUNTRY.");
  await term.type("TYPE LIST FOR THE TARGET DATABASE. TYPE LAUNCH WHEN READY.");
  term.print("");
  const MAX_TARGETS = 6;
  const chosen = [];
  while (true) {
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
      return chosen;
    }
    if (/^(quit|exit|abort|cancel)$/.test(t)) {
      return null;
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
        return chosen;
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
      return chosen;
    }
  }
}

async function reportStrike(term, missiles, chosen) {
  const destroyed = chosen.filter(
    (c) => !missiles.some((m) => m.target === c && m.intercepted)
  );
  const lost = chosen.length - destroyed.length;
  term.print("");
  if (destroyed.length) {
    await term.type("TARGETS DESTROYED: " + destroyed.map((c) => c.name).join(", "));
    await term.type("ESTIMATED CASUALTIES: " + GTWCore.casualties(destroyed) + " MILLION");
  } else {
    await term.type("ALL WARHEADS INTERCEPTED. NO TARGETS DESTROYED.");
  }
  if (lost > 0) {
    await term.type("INTERCEPTED BY ABM SCREEN: " + lost + " WARHEAD" + (lost === 1 ? "" : "S"));
  }
  term.print("");
}

// Two players at one keyboard. A sandbox: it never feeds the story.
async function playGTWHotseat(term, state, p1IsUS) {
  const sides = p1IsUS
    ? { p1: "UNITED STATES", p2: "SOVIET UNION" }
    : { p1: "SOVIET UNION", p2: "UNITED STATES" };
  await term.type("TWO PLAYERS. PLAYER ONE IS THE " + sides.p1 + ".");
  const t1 = await selectTargets(
    term, state, p1IsUS ? GTWCore.TARGETS_USSR : GTWCore.TARGETS_US, p1IsUS, "PLAYER ONE FIRST STRIKE"
  );
  if (!t1) return refuseLaunch(term, state);
  term.print("");
  await term.type("PLAYER TWO IS THE " + sides.p2 + ". PASS THE KEYBOARD.");
  const t2 = await selectTargets(
    term, state, p1IsUS ? GTWCore.TARGETS_US : GTWCore.TARGETS_USSR, !p1IsUS, "PLAYER TWO RESPONSE"
  );
  if (!t2) return refuseLaunch(term, state);
  term.print("");
  await term.type("SIMULTANEOUS LAUNCH DETECTED. SIMULATION RUNNING.", { cps: 40 });
  term.print("");
  const m1 = GTWCore.makeMissiles(p1IsUS ? GTWCore.SITES_US : GTWCore.SITES_USSR, t1);
  const m2 = GTWCore.makeMissiles(p1IsUS ? GTWCore.SITES_USSR : GTWCore.SITES_US, t2);
  await runVolley(term, ["MUTUAL EXCHANGE IN PROGRESS"], [...m1, ...m2]);
  await reportStrike(term, m1, t1);
  await reportStrike(term, m2, t2);
  await term.type("EXCHANGE COMPLETE. WINNER: NONE.");
  await term.type("AN INSTRUCTIVE EXERCISE. NEITHER PLAYER HAS WON. NEITHER PLAYER COULD.");
  term.print("");
  state.gamesPlayed = (state.gamesPlayed || 0) + 1;
  return { completed: false };
}

async function playGTW(term, state) {
  term.print("");
  await term.type("WHICH SIDE DO YOU WANT?");
  term.print("");
  await term.type("  1.    UNITED STATES");
  await term.type("  2.    SOVIET UNION");
  await term.type("  3.    TWO PLAYERS (ONE KEYBOARD)");
  term.print("");
  let side = null;
  let hotseat = false;
  while (!side) {
    const v = norm(await term.read("PLEASE CHOOSE ONE: "));
    if (!v) continue;
    if (v === "3" || /two player|hotseat|both/.test(v)) {
      hotseat = true;
      side = "UNITED STATES";
    } else if (v === "1" || GTWCore.pickCountry(v) === "US") side = "UNITED STATES";
    else if (v === "2" || GTWCore.pickCountry(v) === "USSR") side = "SOVIET UNION";
    else await term.type("PLEASE CHOOSE 1, 2 OR 3.");
  }
  const attackerIsUS = side === "UNITED STATES";
  if (hotseat) return playGTWHotseat(term, state, attackerIsUS);

  const enemyTargets = attackerIsUS ? GTWCore.TARGETS_USSR : GTWCore.TARGETS_US;
  const homeTargets = attackerIsUS ? GTWCore.TARGETS_US : GTWCore.TARGETS_USSR;
  const attackSites = attackerIsUS ? GTWCore.SITES_US : GTWCore.SITES_USSR;
  const retaliateSites = attackerIsUS ? GTWCore.SITES_USSR : GTWCore.SITES_US;

  const chosen = await selectTargets(term, state, enemyTargets, attackerIsUS, "FIRST STRIKE");
  if (!chosen) {
    await term.type("FIRST STRIKE CANCELLED.");
    return refuseLaunch(term, state);
  }

  term.print("");
  const confirm = norm(await term.read("CONFIRM FIRST STRIKE COMMIT (YES/NO): "));
  if (!isYes(confirm)) {
    await term.type("COMMIT ABORTED.");
    return refuseLaunch(term, state);
  }

  const chances = gtwInterceptChances();
  term.print("");
  await term.type("LAUNCH CODES ACCEPTED. SIMULATION RUNNING.", { cps: 40 });
  term.print("");
  const strike = [
    ...GTWCore.makeMissiles(attackSites, chosen),
    ...GTWCore.fanMissiles(attackSites, enemyTargets, 18),
  ];
  GTWCore.planIntercepts(strike, chances.strike);
  await runVolley(term, [side + " FIRST STRIKE"], strike);
  await reportStrike(term, strike, chosen);
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
  GTWCore.planIntercepts(counter, chances.retaliation);
  await runVolley(term, ["RETALIATORY STRIKE IN PROGRESS"], counter);
  await reportStrike(term, counter, counterTargets);
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
