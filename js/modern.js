/*
 * Modern presentation mode: the big board rendered on canvas as a glowing
 * dot-matrix world map with smooth ballistic arcs, comet heads, and
 * expanding impact rings. Same missile model as the ASCII renderer, so
 * GTW logic is untouched. MODE CLASSIC switches back; anywhere canvas is
 * unavailable, callers fall back to the ASCII board automatically.
 *
 * The math helpers (mapDots, arcPoint) are pure for the node tests.
 */

const Modern = (() => {
  let mode = "modern";
  try {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem("wargames-mode");
      if (stored === "classic" || stored === "modern") mode = stored;
    }
  } catch (e) {
    /* storage blocked */
  }

  function isModern() {
    return mode === "modern";
  }

  function setMode(m) {
    mode = m === "classic" ? "classic" : "modern";
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem("wargames-mode", mode);
    } catch (e) {
      /* storage blocked */
    }
  }

  // Land cells of the ASCII map become glowing dots.
  function mapDots(MAP) {
    const dots = [];
    for (let y = 0; y < MAP.length; y++) {
      for (let x = 0; x < MAP[y].length; x++) {
        if (MAP[y][x] === "░") dots.push([x, y]);
      }
    }
    return dots;
  }

  // Quadratic bezier between grid points, arcing toward the top of the
  // board like a ballistic track. t in [0,1].
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

  const COLORS = {
    bg0: "#03140b",
    bg1: "#000503",
    dot: "rgba(58, 255, 110, 0.55)",
    trail: "rgba(120, 255, 160, 0.85)",
    head: "#eaffe9",
    impact: "#ffb000",
    text: "#3aff6e",
  };

  // Render one volley. Returns false (sync) when canvas is unavailable so
  // the caller can fall back to ASCII; otherwise resolves when finished.
  function renderVolley(term, headerLines, missiles) {
    if (typeof document === "undefined" || !term.canvasBlock) return false;
    const canvas = term.canvasBlock();
    if (!canvas) return false;

    const GRID_W = GTWCore.MAP_W;
    const GRID_H = GTWCore.MAP_H;
    const cssW = Math.min(900, Math.max(320, term.screen.clientWidth ? term.screen.clientWidth - 40 : 760));
    const cssH = Math.round(cssW * 0.52);
    const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    const padX = 26;
    const padTop = 16 + headerLines.length * 18;
    const padBot = 34;
    const sx = (gx) => padX + (gx / (GRID_W - 1)) * (cssW - padX * 2);
    const sy = (gy) => padTop + (gy / (GRID_H - 1)) * (cssH - padTop - padBot);

    const dots = mapDots(GTWCore.MAP);
    const TICK = 0.1; // seconds per ASCII tick, keeps pacing comparable
    const tracks = missiles.map((m) => ({
      from: m.path[0],
      to: [m.target ? m.target.x : m.path[m.path.length - 1][0], m.target ? m.target.y : m.path[m.path.length - 1][1]],
      t0: m.start * TICK,
      dur: Math.max(0.8, m.path.length * TICK * 0.9),
      launched: false,
      hit: false,
    }));
    const totalDur = Math.max(...tracks.map((k) => k.t0 + k.dur)) + 1.6;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function draw(now) {
      ctx.clearRect(0, 0, cssW, cssH);
      const bg = ctx.createLinearGradient(0, 0, 0, cssH);
      bg.addColorStop(0, COLORS.bg0);
      bg.addColorStop(1, COLORS.bg1);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cssW, cssH);

      // dot-matrix world
      ctx.save();
      ctx.fillStyle = COLORS.dot;
      ctx.shadowColor = COLORS.dot;
      ctx.shadowBlur = 6;
      const r = Math.max(1.4, cssW / 420);
      for (const [gx, gy] of dots) {
        ctx.beginPath();
        ctx.arc(sx(gx), sy(gy), r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      let inbound = 0;
      let impacts = 0;
      for (const k of tracks) {
        const p = (now - k.t0) / k.dur;
        if (p <= 0) continue;
        if (!k.launched) {
          k.launched = true;
          if (typeof Sound !== "undefined" && Sound.whoosh) Sound.whoosh();
        }
        const tEnd = Math.min(1, p);
        // trail
        ctx.save();
        ctx.strokeStyle = COLORS.trail;
        ctx.lineWidth = 1.4;
        ctx.shadowColor = COLORS.trail;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        const steps = 36;
        for (let i = 0; i <= steps; i++) {
          const [gx, gy] = arcPoint(k.from, k.to, (i / steps) * tEnd);
          const X = sx(gx);
          const Y = sy(gy);
          if (i === 0) ctx.moveTo(X, Y);
          else ctx.lineTo(X, Y);
        }
        ctx.stroke();
        ctx.restore();
        // launch site
        ctx.fillStyle = COLORS.trail;
        ctx.fillRect(sx(k.from[0]) - 2.5, sy(k.from[1]) - 2.5, 5, 5);
        if (p < 1) {
          inbound += 1;
          const [gx, gy] = arcPoint(k.from, k.to, tEnd);
          const X = sx(gx);
          const Y = sy(gy);
          ctx.save();
          ctx.fillStyle = COLORS.head;
          ctx.shadowColor = COLORS.head;
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(X, Y, 2.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          impacts += 1;
          if (!k.hit) {
            k.hit = true;
            k.hitAt = now;
            if (typeof Sound !== "undefined" && Sound.boom) Sound.boom();
          }
          const X = sx(k.to[0]);
          const Y = sy(k.to[1]);
          const age = now - (k.hitAt || now);
          ctx.save();
          ctx.strokeStyle = COLORS.impact;
          ctx.shadowColor = COLORS.impact;
          ctx.shadowBlur = 10;
          if (age < 1.1) {
            for (let ring = 0; ring < 2; ring++) {
              const rr = 3 + (age * 22 + ring * 7);
              ctx.globalAlpha = Math.max(0, 1 - age - ring * 0.25);
              ctx.beginPath();
              ctx.arc(X, Y, rr, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
          ctx.globalAlpha = 1;
          ctx.fillStyle = COLORS.impact;
          ctx.beginPath();
          ctx.arc(X, Y, 2.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // header + footer
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
      ctx.fillText(
        `TRACKS INBOUND: ${inbound}   IMPACTS CONFIRMED: ${impacts}   T-MINUS ${mm}:${ss}`,
        padX,
        cssH - 12
      );
    }

    return new Promise((resolve) => {
      if (reduced) {
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

  return { isModern, setMode, mapDots, arcPoint, renderVolley };
})();
