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

  function makeCanvas(term, ratio) {
    if (typeof document === "undefined" || !term.canvasBlock) return null;
    const canvas = term.canvasBlock();
    if (!canvas) return null;
    const cssW = Math.min(900, Math.max(320, term.screen.clientWidth ? term.screen.clientWidth - 40 : 760));
    const cssH = Math.round(cssW * ratio);
    const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.scale(dpr, dpr);
    return { canvas, ctx, cssW, cssH };
  }

  function reducedMotion() {
    return (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  // Render one volley. Returns false (sync) when canvas is unavailable.
  function renderVolley(term, headerLines, missiles) {
    const polar = view === "polar";
    const cv = makeCanvas(term, polar ? 0.72 : 0.52);
    if (!cv) return false;
    const { ctx, cssW, cssH } = cv;

    const padX = 26;
    const padTop = 16 + headerLines.length * 18;
    const padBot = 34;
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
      ctx.font = "13px 'Glass TTY VT220', monospace";
      ctx.textAlign = "center";
      headerLines.forEach((h, i) => {
        if (h) ctx.fillText(h, cssW / 2, 18 + i * 18);
      });
      ctx.textAlign = "left";
      const secs = Math.max(0, Math.round((totalDur - 1.6 - now) * 4.7) * 10);
      const mm = String(Math.floor(secs / 60)).padStart(2, "0");
      const ss = String(secs % 60).padStart(2, "0");
      let footer = `TRACKS INBOUND: ${inbound}   IMPACTS: ${impacts}`;
      if (intercepted > 0) footer += `   INTERCEPTED: ${intercepted}`;
      footer += `   T-MINUS ${mm}:${ss}`;
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
        ctx.font = "14px 'Glass TTY VT220', monospace";
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
      "ENDING: " + String(state.ending || "?").toUpperCase(),
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
    renderVolley,
    renderTTTMontage,
    endingCard,
  };
})();
