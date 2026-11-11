/*
 * Modern presentation mode: the big board on canvas with real coastline
 * outlines (Natural Earth via geo.js), great-circle missile tracks, comet
 * heads, impact rings, and interception pops. Two views: FLAT
 * (equirectangular) and POLAR (the NORAD wall's over-the-pole look).
 * MODE CLASSIC restores ASCII; anywhere canvas is unavailable, callers
 * fall back automatically. Math helpers stay pure for the node tests.
 */

const Modern = (() => {
  let mode = "modern";
  let view = "flat";
  try {
    if (typeof localStorage !== "undefined") {
      const m = localStorage.getItem("wargames-mode");
      if (m === "classic" || m === "modern") mode = m;
      const v = localStorage.getItem("wargames-view");
      if (v === "polar" || v === "flat") view = v;
    }
  } catch (e) {
    /* storage blocked */
  }

  const isModern = () => mode === "modern";
  const getView = () => view;

  function setMode(m) {
    mode = m === "classic" ? "classic" : "modern";
    persist("wargames-mode", mode);
  }

  function setView(v) {
    view = v === "polar" ? "polar" : "flat";
    persist("wargames-view", view);
  }

  function persist(k, v) {
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(k, v);
    } catch (e) {
      /* storage blocked */
    }
  }

  // Land cells of the ASCII map as dots (kept for tests and subtle fill).
  function mapDots(MAP) {
    const dots = [];
    for (let y = 0; y < MAP.length; y++) {
      for (let x = 0; x < MAP[y].length; x++) {
        if (MAP[y][x] === "░") dots.push([x, y]);
      }
    }
    return dots;
  }

  // Screen-space arc (legacy helper, still used by tests).
  function arcPoint(from, to, t) {
    const [x0, y0] = from;
    const [x1, y1] = to;
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const cx = (x0 + x1) / 2;
    const cy = Math.min(y0, y1) - Math.max(2.5, dist * 0.38);
    const u = 1 - t;
    return [
      u * u * x0 + 2 * u * t * cx + t * t * x1,
      u * u * y0 + 2 * u * t * cy + t * t * y1,
    ];
  }

  // Split a projected polyline where it wraps the antimeridian (flat view).
  function splitSegments(points) {
    const runs = [];
    let run = [points[0]];
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(points[i][0] - points[i - 1][0]) > 0.5) {
        runs.push(run);
        run = [];
      }
      run.push(points[i]);
    }
    runs.push(run);
    return runs.filter((r) => r.length > 1);
  }

  const COLORS = {
    bg0: "#03140b",
    bg1: "#000503",
    coast: "rgba(58, 255, 110, 0.8)",
    fill: "rgba(58, 255, 110, 0.18)",
    trail: "rgba(140, 255, 175, 0.9)",
    head: "#eaffe9",
    impact: "#ffb000",
    intercept: "#9adfff",
    text: "#3aff6e",
  };

  // A canvas sized to the text column and never taller than the screen
  // can show, so the whole board is in view while it animates. `share`
  // caps the height as a fraction of the screen (pinned maps leave room
  // for the log under them).
  function makeCanvas(term, ratio, { pinned = false, share = 1 } = {}) {
    if (typeof document === "undefined" || !term.canvasBlock) return null;
    const canvas = term.canvasBlock({ pinned });
    if (!canvas) return null;
    const screen = term.screen;
    let inner = 760;
    let roomH = 560;
    if (screen && screen.clientWidth) {
      const cs = window.getComputedStyle(screen);
      inner = screen.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
      roomH = Math.max(pinned ? 110 : 150, screen.clientHeight * share - 28);
    }
    let cssW = Math.min(900, Math.max(240, Math.floor(inner)));
    let cssH = Math.round(cssW * ratio);
    if (cssH > roomH) {
      cssH = Math.round(roomH);
      cssW = Math.round(cssH / ratio);
    }
    const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.scale(dpr, dpr);
    if (typeof term.settle === "function") term.settle();
    return { canvas, ctx, cssW, cssH };
  }

  // Canvas text size that tracks the board's width.
  const fontPx = (cssW) => Math.max(10, Math.min(16, Math.round(cssW / 56)));
  const FACE = "'Glass TTY VT220', 'IBM VGA 8x16', monospace";

  function reducedMotion() {
    return (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  // The board's counters, longest wording first. The renderer uses the
  // first form that fits, so a phone-width board never clips T-MINUS.
  function footerForms({ inbound, impacts, intercepted, clock }) {
    const kills = intercepted > 0;
    return [
      `TRACKS INBOUND: ${inbound}   IMPACTS: ${impacts}` +
        (kills ? `   INTERCEPTED: ${intercepted}` : "") +
        `   T-MINUS ${clock}`,
      `INBOUND: ${inbound}  IMPACTS: ${impacts}` + (kills ? `  KILLS: ${intercepted}` : "") + `  T-${clock}`,
      `IN ${inbound}  HIT ${impacts}` + (kills ? `  KILL ${intercepted}` : "") + `  T-${clock}`,
    ];
  }

  function fitFooter(ctx, forms, maxWidth) {
    for (const f of forms) {
      if (ctx.measureText(f).width <= maxWidth) return f;
    }
    return forms[forms.length - 1];
  }

  // Render one volley. Returns false (sync) when canvas is unavailable.
  function renderVolley(term, headerLines, missiles) {
    const polar = view === "polar";
    const cv = makeCanvas(term, polar ? 0.72 : 0.52);
    if (!cv) return false;
    const { ctx, cssW, cssH } = cv;

    const fs = fontPx(cssW);
    const lineH = Math.round(fs * 1.4);
    const padX = Math.max(10, Math.round(cssW * 0.03));
    const padTop = 12 + headerLines.length * lineH;
    const padBot = lineH + 16;
    // Polar view keeps a square scale so the hemisphere stays a circle.
    const polarScale = Math.min(cssW - padX * 2, cssH - padTop - padBot);
    const polarOx = (cssW - polarScale) / 2;
    const polarOy = padTop + (cssH - padTop - padBot - polarScale) / 2;
    const project = (lon, lat) => {
      if (polar) {
        const [u, v] = GTWCore.projectPolar(lon, lat);
        return [polarOx + u * polarScale, polarOy + v * polarScale];
      }
      const [u, v] = GTWCore.projectFlat(lon, lat);
      return [padX + u * (cssW - padX * 2), padTop + v * (cssH - padTop - padBot)];
    };
    const culled = (lat) =>
      polar ? lat < GTWCore.POLAR_LAT_MIN : lat > GTWCore.LAT_TOP || lat < GTWCore.LAT_BOT;

    // Precompute projected coastlines. In flat view, points outside the
    // latitude window are culled (not clamped) so polar rings and
    // Antarctica don't smear along the map edges; runs also split at the
    // antimeridian.
    const coast = (typeof GEO !== "undefined" ? GEO.COAST : []).map((ring) => {
      const unit = ring.map(([lon, lat]) => (culled(lat) ? null : [lon, lat]));
      const runs = [];
      let run = [];
      for (let i = 0; i < unit.length; i++) {
        const ll = unit[i];
        const prev = i > 0 ? unit[i - 1] : null;
        if (!ll || (prev && ll && !polar && Math.abs(ll[0] - prev[0]) > 144)) {
          if (run.length > 1) runs.push(run);
          run = ll ? [project(ll[0], ll[1])] : [];
          continue;
        }
        run.push(project(ll[0], ll[1]));
      }
      if (run.length > 1) runs.push(run);
      return runs;
    });

    const TICK = 0.1;
    const SAMPLES = 48;
    const tracks = missiles.map((m) => ({
      fromLL: m.fromLL,
      toLL: m.toLL,
      t0: m.start * TICK,
      dur: Math.max(0.8, m.path.length * TICK * 0.9),
      cut: m.intercepted ? m.interceptT || 0.65 : 1,
      intercepted: !!m.intercepted,
      launched: false,
      done: false,
    }));
    const totalDur = Math.max(...tracks.map((k) => k.t0 + k.dur)) + 1.6;

    // Great-circle sample, projected; cached per track. In flat view,
    // samples beyond the latitude window are culled (null) so polar
    // arcs exit the top edge and re-enter, rather than smearing along it.
    for (const k of tracks) {
      k.pts = [];
      for (let i = 0; i <= SAMPLES; i++) {
        const [lon, lat] = GTWCore.gc(k.fromLL, k.toLL, i / SAMPLES);
        if (culled(lat)) {
          k.pts.push(null);
        } else {
          k.pts.push(project(lon, lat));
        }
      }
    }

    function strokeRun(pts, upTo) {
      // break at culled samples and at the antimeridian jump
      ctx.beginPath();
      let started = false;
      for (let i = 0; i <= upTo; i++) {
        if (!pts[i]) {
          started = false;
          continue;
        }
        const jump =
          started && pts[i - 1] && Math.abs(pts[i][0] - pts[i - 1][0]) > cssW * 0.35;
        if (!started || jump) {
          ctx.moveTo(pts[i][0], pts[i][1]);
          started = true;
        } else {
          ctx.lineTo(pts[i][0], pts[i][1]);
        }
      }
      ctx.stroke();
    }

    function draw(now) {
      ctx.clearRect(0, 0, cssW, cssH);
      const bg = ctx.createLinearGradient(0, 0, 0, cssH);
      bg.addColorStop(0, COLORS.bg0);
      bg.addColorStop(1, COLORS.bg1);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cssW, cssH);

      if (polar) {
        // graticule rim
        ctx.save();
        ctx.strokeStyle = "rgba(58,255,110,0.25)";
        const [cx0, cy0] = project(0, 90);
        for (const lat of [60, 30, 0, -30]) {
          const [, ry] = project(0, lat);
          ctx.beginPath();
          ctx.arc(cx0, cy0, Math.abs(ry - cy0), 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // coastlines
      ctx.save();
      ctx.strokeStyle = COLORS.coast;
      ctx.lineWidth = 1.1;
      ctx.shadowColor = COLORS.coast;
      ctx.shadowBlur = 5;
      for (const ring of coast) {
        for (const run of ring) {
          ctx.beginPath();
          for (let i = 0; i < run.length; i++) {
            if (i === 0) ctx.moveTo(run[i][0], run[i][1]);
            else if (Math.abs(run[i][0] - run[i - 1][0]) > cssW * 0.5) ctx.moveTo(run[i][0], run[i][1]);
            else ctx.lineTo(run[i][0], run[i][1]);
          }
          ctx.stroke();
        }
      }
      ctx.restore();

      let inbound = 0;
      let impacts = 0;
      let intercepted = 0;
      for (const k of tracks) {
        const p = (now - k.t0) / k.dur;
        if (p <= 0) continue;
        if (!k.launched) {
          k.launched = true;
          if (typeof Sound !== "undefined" && Sound.whoosh) Sound.whoosh();
        }
        const t = Math.min(p, k.cut);
        const upTo = Math.max(1, Math.round(t * SAMPLES));
        ctx.save();
        ctx.strokeStyle = COLORS.trail;
        ctx.lineWidth = 1.4;
        ctx.shadowColor = COLORS.trail;
        ctx.shadowBlur = 7;
        strokeRun(k.pts, upTo);
        ctx.restore();
        const [sx, sy] = k.pts[0];
        ctx.fillStyle = COLORS.trail;
        ctx.fillRect(sx - 2.5, sy - 2.5, 5, 5);
        const hp = k.pts[upTo]; // null while the warhead is over the pole
        const hx = hp ? hp[0] : 0;
        const hy = hp ? hp[1] : 0;
        if (p < k.cut) {
          inbound += 1;
          if (hp) {
            ctx.save();
            ctx.fillStyle = COLORS.head;
            ctx.shadowColor = COLORS.head;
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(hx, hy, 2.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        } else if (k.intercepted) {
          intercepted += 1;
          if (!k.done) {
            k.done = true;
            k.doneAt = now;
            if (typeof Sound !== "undefined" && Sound.boom) Sound.boom();
          }
          if (!hp) continue;
          const age = now - (k.doneAt || now);
          ctx.save();
          ctx.strokeStyle = COLORS.intercept;
          ctx.shadowColor = COLORS.intercept;
          ctx.shadowBlur = 9;
          if (age < 0.6) {
            ctx.globalAlpha = 1 - age / 0.6;
            for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
              ctx.beginPath();
              ctx.moveTo(hx, hy);
              ctx.lineTo(hx + dx * (4 + age * 14), hy + dy * (4 + age * 14));
              ctx.stroke();
            }
          }
          ctx.globalAlpha = 1;
          ctx.fillStyle = COLORS.intercept;
          ctx.fillRect(hx - 1.6, hy - 1.6, 3.2, 3.2);
          ctx.restore();
        } else {
          impacts += 1;
          if (!k.done) {
            k.done = true;
            k.doneAt = now;
            if (typeof Sound !== "undefined" && Sound.boom) Sound.boom();
          }
          const [tx, ty] = k.pts[SAMPLES];
          const age = now - (k.doneAt || now);
          ctx.save();
          ctx.strokeStyle = COLORS.impact;
          ctx.shadowColor = COLORS.impact;
          ctx.shadowBlur = 10;
          if (age < 1.1) {
            for (let ring = 0; ring < 2; ring++) {
              const rr = 3 + (age * 22 + ring * 7);
              ctx.globalAlpha = Math.max(0, 1 - age - ring * 0.25);
              ctx.beginPath();
              ctx.arc(tx, ty, rr, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
          ctx.globalAlpha = 1;
          ctx.fillStyle = COLORS.impact;
          ctx.beginPath();
          ctx.arc(tx, ty, 2.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      ctx.fillStyle = COLORS.text;
      ctx.font = fs + "px " + FACE;
      ctx.textAlign = "center";
      headerLines.forEach((h, i) => {
        if (h) ctx.fillText(h, cssW / 2, fs + 6 + i * lineH);
      });
      ctx.textAlign = "left";
      const secs = Math.max(0, Math.round((totalDur - 1.6 - now) * 4.7) * 10);
      const mm = String(Math.floor(secs / 60)).padStart(2, "0");
      const ss = String(secs % 60).padStart(2, "0");
      const footer = fitFooter(
        ctx,
        footerForms({ inbound, impacts, intercepted, clock: mm + ":" + ss }),
        cssW - padX * 2
      );
      ctx.fillText(footer, padX, cssH - 12);
    }

    return new Promise((resolve) => {
      if (reducedMotion()) {
        draw(totalDur);
        setTimeout(resolve, 400);
        return;
      }
      const startMs = performance.now();
      function frame(ms) {
        const now = (ms - startMs) / 1000;
        if (term.skip || now >= totalDur) {
          draw(totalDur);
          resolve();
          return;
        }
        draw(now);
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  }

  // The climax montage: tic-tac-toe games flashing past, every one a draw.
  function renderTTTMontage(term, games) {
    const cv = makeCanvas(term, 0.5);
    if (!cv) return false;
    const { ctx, cssW, cssH } = cv;
    const cols = 4;
    const rows = 2;
    const cellW = cssW / cols;
    const cellH = (cssH - 30) / rows;
    const boardSize = Math.min(cellW, cellH) * 0.62;

    function drawBoard(cx, cy, board, alpha) {
      const s = boardSize / 3;
      const left = cx - boardSize / 2;
      const top = cy - boardSize / 2;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = COLORS.coast;
      ctx.lineWidth = 1.2;
      ctx.shadowColor = COLORS.coast;
      ctx.shadowBlur = 6;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(left + i * s, top);
        ctx.lineTo(left + i * s, top + boardSize);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(left, top + i * s);
        ctx.lineTo(left + boardSize, top + i * s);
        ctx.stroke();
      }
      for (let i = 0; i < 9; i++) {
        const px = left + (i % 3) * s + s / 2;
        const py = top + Math.floor(i / 3) * s + s / 2;
        const r = s * 0.28;
        if (board[i] === "X") {
          ctx.strokeStyle = COLORS.head;
          ctx.beginPath();
          ctx.moveTo(px - r, py - r);
          ctx.lineTo(px + r, py + r);
          ctx.moveTo(px + r, py - r);
          ctx.lineTo(px - r, py + r);
          ctx.stroke();
        } else if (board[i] === "O") {
          ctx.strokeStyle = COLORS.impact;
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    return new Promise((resolve) => {
      const finals = games.map((g) => {
        const b = Array(9).fill(null);
        let turn = "X";
        for (const mv of g.moves) {
          b[mv] = turn;
          turn = turn === "X" ? "O" : "X";
        }
        return b;
      });
      let shown = 0;
      let delay = reducedMotion() ? 0 : 300;
      function step() {
        ctx.clearRect(0, 0, cssW, cssH);
        ctx.fillStyle = COLORS.bg0;
        ctx.fillRect(0, 0, cssW, cssH);
        const visible = Math.min(finals.length, shown + 1);
        for (let i = 0; i < visible; i++) {
          const slot = i % (cols * rows);
          const cx = (slot % cols) * cellW + cellW / 2;
          const cy = 10 + Math.floor(slot / cols) * cellH + cellH / 2;
          drawBoard(cx, cy, finals[i], i === visible - 1 ? 1 : 0.45);
        }
        ctx.fillStyle = COLORS.text;
        ctx.font = fontPx(cssW) + 1 + "px " + FACE;
        ctx.textAlign = "center";
        ctx.fillText(
          "GAME " + (shown + 1) + "    WINNER: NONE",
          cssW / 2,
          cssH - 10
        );
        shown += 1;
        if (term.skip || shown >= finals.length || delay === 0) {
          ctx.fillText("GAMES PLAYED: 247,309    WINNER: NONE", cssW / 2, 22);
          resolve();
          return;
        }
        delay = Math.max(60, delay - 24);
        setTimeout(step, delay);
      }
      step();
    });
  }

  // ---- targeting map: pick first-strike targets on the board itself ----

  // The lon/lat window that frames a set of targets, with a margin.
  function regionFor(targets) {
    let lon0 = Infinity;
    let lon1 = -Infinity;
    let lat0 = Infinity;
    let lat1 = -Infinity;
    for (const t of targets) {
      lon0 = Math.min(lon0, t.lon);
      lon1 = Math.max(lon1, t.lon);
      lat0 = Math.min(lat0, t.lat);
      lat1 = Math.max(lat1, t.lat);
    }
    const padLon = (lon1 - lon0) * 0.1 + 5;
    const padLat = (lat1 - lat0) * 0.18 + 4;
    return { lon0: lon0 - padLon, lon1: lon1 + padLon, lat0: lat0 - padLat, lat1: lat1 + padLat };
  }

  // Equirectangular projection of a region into a box, corrected for the
  // region's mid-latitude so shapes are not stretched, and centered.
  function regionProjector(region, box) {
    const k = Math.cos((((region.lat0 + region.lat1) / 2) * Math.PI) / 180);
    const spanX = (region.lon1 - region.lon0) * k;
    const spanY = region.lat1 - region.lat0;
    const scale = Math.min(box.w / spanX, box.h / spanY);
    const ox = box.x + (box.w - spanX * scale) / 2;
    const oy = box.y + (box.h - spanY * scale) / 2;
    return (lon, lat) => [ox + (lon - region.lon0) * k * scale, oy + (region.lat1 - lat) * scale];
  }

  // Closest point to (x, y) within maxDist, or -1.
  function nearestPoint(points, x, y, maxDist) {
    let best = -1;
    let bestD = maxDist;
    for (let i = 0; i < points.length; i++) {
      const d = Math.hypot(points[i][0] - x, points[i][1] - y);
      if (d <= bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  // Greedy label placement: try right, left, above, below each dot and
  // keep the first spot that clears the labels and dots already placed.
  // Returns one rect per point, or null where no label fits.
  function placeLabels(points, widths, h, bounds) {
    const placed = [];
    const hits = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const dots = points.map(([x, y]) => ({ x: x - 4, y: y - 4, w: 8, h: 8 }));
    return points.map(([x, y], i) => {
      const w = widths[i];
      const g = 14; // clear of the selection crosshair
      const spots = [
        { x: x + g, y: y - h / 2 },
        { x: x - g - w, y: y - h / 2 },
        { x: x - w / 2, y: y - g - h },
        { x: x - w / 2, y: y + g },
        { x: x + g * 0.7, y: y - g * 0.7 - h },
        { x: x + g * 0.7, y: y + g * 0.7 },
        { x: x - g * 0.7 - w, y: y - g * 0.7 - h },
        { x: x - g * 0.7 - w, y: y + g * 0.7 },
      ];
      for (const s of spots) {
        const r = { x: s.x, y: s.y, w, h };
        if (r.x < bounds.x || r.y < bounds.y || r.x + w > bounds.x + bounds.w || r.y + h > bounds.y + bounds.h) {
          continue;
        }
        if (placed.some((p) => hits(p, r))) continue;
        if (dots.some((d, j) => j !== i && hits(d, r))) continue;
        placed.push(r);
        return r;
      }
      return null;
    });
  }

  // An interactive map of one side's target database. Clicking a city
  // calls onPick(target). Returns { update(chosen), close() }, or null
  // where canvas is unavailable (callers fall back to the typed list).
  function targetMap(term, { targets, title, max, onPick }) {
    const cv = makeCanvas(term, 0.5, { pinned: true, share: 0.5 });
    if (!cv) return null;
    const { canvas, ctx, cssW, cssH } = cv;
    canvas.classList.add("live");
    const fs = fontPx(cssW);
    const lineH = Math.round(fs * 1.4);
    const box = { x: 8, y: lineH + 10, w: cssW - 16, h: cssH - lineH * 2 - 22 };
    const region = regionFor(targets);
    const project = regionProjector(region, box);
    const pts = targets.map((t) => project(t.lon, t.lat));
    const coast = (typeof GEO !== "undefined" ? GEO.COAST : []).map((ring) =>
      ring.map(([lon, lat]) => (lon < region.lon0 - 40 || lon > region.lon1 + 40 ? null : project(lon, lat)))
    );
    const labelFs = cssW < 520 ? 9 : fs;
    ctx.font = labelFs + "px " + FACE;
    const labels = placeLabels(
      pts,
      targets.map((t) => ctx.measureText(t.name).width + 4),
      labelFs + 2,
      box
    );
    let chosen = [];
    let hover = -1;
    let open = true;
    const coarse = !!term.coarse;

    function draw() {
      ctx.clearRect(0, 0, cssW, cssH);
      const bg = ctx.createLinearGradient(0, 0, 0, cssH);
      bg.addColorStop(0, COLORS.bg0);
      bg.addColorStop(1, COLORS.bg1);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cssW, cssH);

      ctx.save();
      ctx.beginPath();
      ctx.rect(box.x, box.y, box.w, box.h);
      ctx.clip();
      ctx.strokeStyle = "rgba(58, 255, 110, 0.55)";
      ctx.lineWidth = 1;
      for (const ring of coast) {
        ctx.beginPath();
        let pen = false;
        for (let i = 0; i < ring.length; i++) {
          const p = ring[i];
          if (!p || (pen && ring[i - 1] && Math.abs(p[0] - ring[i - 1][0]) > box.w * 0.6)) {
            pen = false;
            if (!p) continue;
          }
          if (pen) ctx.lineTo(p[0], p[1]);
          else ctx.moveTo(p[0], p[1]);
          pen = true;
        }
        ctx.stroke();
      }
      ctx.restore();

      ctx.font = labelFs + "px " + FACE;
      ctx.textBaseline = "middle";
      let callout = null;
      targets.forEach((t, i) => {
        const [x, y] = pts[i];
        const on = chosen.includes(t);
        const hot = open && i === hover;
        const color = on ? COLORS.impact : hot ? COLORS.head : COLORS.text;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = on || hot ? 10 : 4;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(x, y, on ? 3.4 : 2.6, 0, Math.PI * 2);
        if (on || hot) ctx.fill();
        else ctx.stroke();
        if (on) {
          ctx.beginPath();
          ctx.arc(x, y, 7.5, 0, Math.PI * 2);
          ctx.stroke();
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            ctx.beginPath();
            ctx.moveTo(x + dx * 7.5, y + dy * 7.5);
            ctx.lineTo(x + dx * 12, y + dy * 12);
            ctx.stroke();
          }
        }
        ctx.restore();
        const r = labels[i];
        if (r) {
          ctx.fillStyle = color;
          ctx.fillText(t.name, r.x + 2, r.y + r.h / 2);
        } else if (hot) {
          callout = { t, x, y, color };
        }
      });
      // A city with no room for a label names itself under the pointer.
      if (callout) {
        const w = ctx.measureText(callout.t.name).width;
        const lx = Math.min(Math.max(box.x + 2, callout.x - w / 2), box.x + box.w - w - 2);
        const ly = callout.y - 16 < box.y + labelFs ? callout.y + 18 : callout.y - 16;
        ctx.fillStyle = "rgba(0, 10, 5, 0.92)";
        ctx.fillRect(lx - 3, ly - labelFs / 2 - 3, w + 6, labelFs + 6);
        ctx.fillStyle = callout.color;
        ctx.fillText(callout.t.name, lx, ly);
      }
      ctx.font = fs + "px " + FACE;

      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = COLORS.text;
      ctx.textAlign = "left";
      ctx.fillText(title, box.x + 2, fs + 4);
      ctx.textAlign = "right";
      ctx.fillStyle = chosen.length ? COLORS.impact : COLORS.text;
      ctx.fillText(chosen.length + "/" + max + " SELECTED", cssW - 10, fs + 4);
      ctx.textAlign = "center";
      ctx.fillStyle = COLORS.text;
      const hint = !open
        ? "TARGETING CLOSED"
        : fitFooter(
            ctx,
            [
              (coarse ? "TAP" : "CLICK") + " A CITY OR TYPE ITS NAME. AGAIN TO REMOVE. LAUNCH WHEN READY.",
              (coarse ? "TAP" : "CLICK") + " A CITY OR TYPE ITS NAME. LAUNCH WHEN READY.",
              (coarse ? "TAP" : "CLICK") + " CITIES, THEN LAUNCH",
            ],
            cssW - 20
          );
      ctx.fillText(hint, cssW / 2, cssH - 9);
      ctx.textAlign = "left";
    }

    const at = (e) => {
      const rect = canvas.getBoundingClientRect();
      const sx = cssW / (rect.width || cssW);
      const sy = cssH / (rect.height || cssH);
      return [(e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy];
    };
    const onClick = (e) => {
      if (!open) return;
      e.stopPropagation();
      const [x, y] = at(e);
      const i = nearestPoint(pts, x, y, coarse ? 36 : 24);
      if (i >= 0) onPick(targets[i]);
    };
    const onMove = (e) => {
      if (!open) return;
      const [x, y] = at(e);
      const i = nearestPoint(pts, x, y, 24);
      if (i !== hover) {
        hover = i;
        canvas.style.cursor = i >= 0 ? "pointer" : "";
        draw();
      }
    };
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", () => {
      if (hover !== -1) {
        hover = -1;
        draw();
      }
    });
    draw();
    // The face may still be loading on a cold start; redraw when it lands.
    if (typeof document !== "undefined" && document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => draw()).catch(() => {});
    }

    return {
      update(list) {
        chosen = list.slice();
        draw();
      },
      close() {
        open = false;
        hover = -1;
        canvas.classList.remove("live");
        canvas.style.cursor = "";
        if (canvas.parentElement) canvas.parentElement.classList.remove("pinned", "loose");
        draw();
      },
    };
  }

  // A keepsake card for finishing the story. Returns a data URL or null.
  function endingCard(state) {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    if (typeof canvas.getContext !== "function") return null;
    canvas.width = 840;
    canvas.height = 440;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#021008";
    ctx.fillRect(0, 0, 840, 440);
    ctx.strokeStyle = "#3aff6e";
    ctx.strokeRect(14, 14, 812, 412);
    ctx.fillStyle = "#3aff6e";
    ctx.font = "28px 'Glass TTY VT220', monospace";
    ctx.fillText("WARGAMES", 40, 64);
    ctx.font = "16px 'Glass TTY VT220', monospace";
    const endings = (state.endingsSeen || []).length;
    const lines = [
      "A STRANGE GAME.",
      "THE ONLY WINNING MOVE IS NOT TO PLAY.",
      "",
      "ENDING: " +
        (typeof CrisisCore !== "undefined"
          ? CrisisCore.endingName(state.ending)
          : String(state.ending || "?").toUpperCase()),
      "ENDINGS WITNESSED: " + endings + " OF 3",
      "WARS STARTED: " + (state.gtwRuns || 0) + "    LAUNCHES REFUSED: " + (state.refusedLaunch ? "YES" : "NO"),
      "TIC-TAC-TOE TIES: " + (state.tttDraws || 0),
      "",
      new Date().toISOString().slice(0, 10) + "    azjester.github.io/WarGames-",
    ];
    lines.forEach((l, i) => ctx.fillText(l, 40, 120 + i * 30));
    ctx.font = "60px 'Glass TTY VT220', monospace";
    ctx.fillStyle = "rgba(58,255,110,0.25)";
    ctx.fillText("WOPR", 600, 400);
    try {
      return canvas.toDataURL("image/png");
    } catch (e) {
      return null;
    }
  }

  return {
    isModern,
    setMode,
    getView,
    setView,
    mapDots,
    arcPoint,
    splitSegments,
    footerForms,
    regionFor,
    regionProjector,
    nearestPoint,
    placeLabels,
    renderVolley,
    renderTTTMontage,
    targetMap,
    endingCard,
  };
})();
