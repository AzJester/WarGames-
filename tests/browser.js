/*
 * Real-browser test (the only check that exercises fonts, canvas, layout,
 * and the actual event loop). Run in CI; locally:
 *   npm i playwright && npx playwright install chromium && node tests/browser.js
 *
 * It plays the story on a laptop-sized and a phone-sized screen and
 * asserts the behaviors that only exist in a browser: the board staying
 * in view while it animates, skip and type-ahead rules, scroll-back,
 * settings commands at every prompt, the crisis checkpoint, the targeting
 * map, the live boards, and the end card.
 */
const { spawn } = require("child_process");
const path = require("path");

const PORT = 8077;
const URL = "http://127.0.0.1:" + PORT + "/";
const FINISHED = {
  metWopr: true,
  ending: "good",
  endingsSeen: ["good"],
  gtwRuns: 1,
  lastSide: "SOVIET UNION",
  crisisResolved: true,
  suspicion: 2,
};

let checks = 0;
function expect(cond, what, detail) {
  if (!cond) throw new Error("FAILED: " + what + (detail ? " (" + detail + ")" : ""));
  checks += 1;
  console.log("ok - " + what);
}

// One player: a fresh browser context with helpers bound to its page.
async function player(browser, options, { fast = true, save = null } = {}) {
  const context = await browser.newContext({ ...options, serviceWorkers: "block" });
  await context.addInitScript(
    ([fast, save]) => {
      try {
        if (sessionStorage.getItem("seeded")) return; // survive reloads untouched
        sessionStorage.setItem("seeded", "1");
        localStorage.setItem("wargames-sound", "off");
        if (fast) localStorage.setItem("wargames-fast", "1");
        if (save) localStorage.setItem("wargames-save-v1", JSON.stringify(save));
      } catch (e) {
        /* storage blocked */
      }
    },
    [fast, save]
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.stack || e)));
  const p = { page, errors };
  p.has = (text, timeout = 60000) =>
    page.waitForFunction(
      (needle) => document.getElementById("screen").textContent.includes(needle),
      text,
      { timeout }
    );
  p.ready = () =>
    page.waitForFunction(
      () => {
        const lines = document.querySelectorAll("#screen .line");
        const last = lines[lines.length - 1];
        return !!last && last.className.includes("input-line") && !!last.querySelector(".cursor");
      },
      { timeout: 60000 }
    );
  p.send = async (text) => {
    await p.ready();
    if (text) await page.keyboard.type(text, { delay: 2 });
    await page.keyboard.press("Enter");
  };
  p.chip = async (label) => {
    await p.ready();
    await page.locator("#choices .chip", { hasText: label }).first().click();
  };
  p.chips = () =>
    page.evaluate(() => [...document.querySelectorAll("#choices .chip")].map((c) => c.textContent));
  p.tail = (n = 6) =>
    page.evaluate(
      (n) =>
        [...document.querySelectorAll("#screen .line")]
          .slice(-n)
          .map((l) => l.textContent)
          .filter(Boolean)
          .join(" | "),
      n
    );
  p.status = () => page.evaluate(() => document.getElementById("status").textContent);
  p.boot = async () => {
    await page.goto(URL);
    await p.has("POWER ON");
    await p.send("");
  };
  p.toSession = async () => {
    await p.boot();
    await p.has("Type SCAN");
    await p.send("skip");
    await p.has("LOGON:");
    await p.send("joshua");
    await p.has("GREETINGS PROFESSOR FALKEN.");
  };
  p.toTargets = async () => {
    await p.toSession();
    await p.send("global thermonuclear war");
    await p.has("WOULDN'T YOU PREFER A GOOD GAME OF CHESS?");
    await p.send("later. lets play global thermonuclear war");
    await p.has("PLEASE CHOOSE ONE:");
    await p.chip("2. SOVIET UNION");
    await p.has("AWAITING FIRST STRIKE COMMAND");
    await p.ready();
  };
  p.launch = async () => {
    await p.chip("LAUNCH");
    await p.has("CONFIRM FIRST STRIKE COMMIT");
    await p.chip("YES");
    // the targeting map is canvas one; the volley is canvas two
    await page.waitForFunction(() => document.querySelectorAll("#screen canvas").length >= 2, {
      timeout: 20000,
    });
  };
  // Share of the newest canvas that is inside the visible screen area.
  p.boardInView = () =>
    page.evaluate(() => {
      const all = document.querySelectorAll("#screen canvas");
      const c = all[all.length - 1].getBoundingClientRect();
      const s = document.getElementById("screen").getBoundingClientRect();
      const visible = Math.max(0, Math.min(c.bottom, s.bottom) - Math.max(c.top, s.top));
      return Math.round((visible / c.height) * 100);
    });
  p.close = async () => {
    if (errors.length) throw new Error("page errors: " + errors.join(" | "));
    await context.close();
  };
  return p;
}

async function laptopStory(browser) {
  const p = await player(browser, { viewport: { width: 1366, height: 768 } });
  const { page } = p;

  await page.goto(URL);
  await p.has("PRESS ENTER TO POWER ON");
  const title = await page.evaluate(() => {
    const logo = document.querySelector(".logo").getBoundingClientRect();
    const screen = document.getElementById("screen").getBoundingClientRect();
    return {
      blocks: document.querySelector(".logo").textContent.includes("██"),
      centered: Math.abs((logo.left + logo.right) / 2 - (screen.left + screen.right) / 2) < 4,
      wide: logo.width / screen.width,
    };
  });
  expect(title.blocks && title.centered && title.wide > 0.6, "title logo is solid, centered and large");

  // The film font must actually be applied.
  const font = await page.evaluate(() => getComputedStyle(document.getElementById("screen")).fontFamily);
  expect(/Glass TTY/i.test(font), "terminal font applied", font);

  await p.send("");
  await p.has("Type SCAN");
  await p.ready();
  expect((await p.chips()).join() === "SCAN,SKIP,STORY", "intro offers SCAN, SKIP and STORY as buttons");

  // The monitor is a centered column, not a full-bleed left-aligned page.
  const col = await page.evaluate(() => {
    const c = document.getElementById("crt").getBoundingClientRect();
    return { left: Math.round(c.left), right: Math.round(innerWidth - c.right), width: Math.round(c.width) };
  });
  expect(col.left > 100 && Math.abs(col.left - col.right) < 3, "monitor is centered on a wide screen", JSON.stringify(col));

  // Settings commands and HELP work at the DIAL prompt (they used to be ignored).
  await p.chip("SCAN");
  await p.has("SCAN COMPLETE");
  await p.send("help");
  await p.ready();
  expect(/Type one of the numbers/.test(await p.tail(3)), "HELP answers at the DIAL prompt");
  await p.send("captions on");
  await p.has("CAPTIONS ON.");
  await p.send("captions off");
  await p.chip("399-2364");
  await p.has("LOGON:");

  // Clue-following buttons at the logon.
  await p.ready();
  expect((await p.chips()).includes("RESEARCH FALKEN"), "logon offers the first clue");
  await p.chip("RESEARCH FALKEN");
  await p.ready();
  expect((await p.chips()).includes("RESEARCH JOSHUA"), "the clue advances after reading the profile");
  await p.chip("RESEARCH JOSHUA");
  await p.chip("JOSHUA");
  await p.has("GREETINGS PROFESSOR FALKEN.");
  await p.ready();

  // Toolbar and the options panel.
  await page.locator('#toolbar [data-ctl="help"]').click();
  await page.waitForSelector("#overlay .panel");
  const panel = await page.evaluate(() => ({
    now: document.querySelector("#overlay .now").textContent,
    rows: document.querySelectorAll("#overlay .setting").length,
  }));
  expect(panel.rows === 8 && /talking to the machine/.test(panel.now), "options panel lists settings and context help");
  await page.locator('#overlay [data-set="difficulty=easy"]').click();
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => document.getElementById("overlay").hidden), "Escape closes the panel");
  await p.send("difficulty");
  await p.has("DIFFICULTY IS EASY");
  await p.send("difficulty normal");

  // Type-ahead and skip rules, at normal text speed.
  await page.locator('#toolbar [data-ctl="fast"]').click();
  await p.send("list games");
  await page.waitForTimeout(250);
  await page.keyboard.press("Shift"); // a modifier alone must not skip
  await page.mouse.move(683, 300);
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(150);
  const held1 = await page.evaluate(() => document.getElementById("screen").scrollTop);
  await page.waitForTimeout(500);
  const held2 = await page.evaluate(() => ({
    top: document.getElementById("screen").scrollTop,
    typing: !document.querySelector("#screen .line:last-child").className.includes("input-line"),
    more: !document.getElementById("more").hidden,
  }));
  expect(held2.typing, "Shift alone does not skip the typewriter");
  expect(Math.abs(held2.top - held1) < 4 && held2.more, "scrolling back holds while text prints");
  await page.locator("#more").click();
  await page.keyboard.type("chess", { delay: 15 }); // typed while output is still printing
  await p.ready();
  const ahead = await page.evaluate(() => {
    const l = document.querySelectorAll("#screen .line.input-line");
    return l[l.length - 1].textContent;
  });
  expect(/^> chess/i.test(ahead), "type-ahead arrives intact", ahead);
  for (let i = 0; i < 5; i++) await page.keyboard.press("Backspace");
  await page.locator('#toolbar [data-ctl="fast"]').click();

  // Live boards: click to move, Joshua names his move.
  await p.send("tic-tac-toe");
  await p.has("YOUR MOVE:");
  await p.ready();
  await page.locator('.grid.ttt [data-k="5"]').click();
  await p.ready();
  expect(/MY MOVE: \d\./.test(await p.tail(3)), "tic-tac-toe: a click moves and Joshua announces his reply");
  expect((await page.locator(".grid.ttt").count()) === 1, "the board updates in place instead of reprinting");
  await p.chip("QUIT");
  await p.send("chess");
  await p.has("YOUR MOVE:");
  await p.ready();
  await page.locator('.grid.chess [data-k="e2"]').click();
  await page.locator('.grid.chess [data-k="e4"]').click();
  await p.ready();
  expect(/YOUR MOVE: E2 E4 \| MY MOVE: [A-H][1-8] [A-H][1-8]/.test(await p.tail(3)), "chess: two clicks make a move", await p.tail(3));
  expect((await page.locator(".grid.chess .cell.last").count()) === 2, "chess highlights Joshua's last move");
  await p.chip("RESIGN");
  await p.send("maze");
  await p.has("DIRECTION:");
  await p.ready();
  await page.keyboard.press("ArrowDown");
  await p.ready();
  expect(/DIRECTION: S/.test(await p.tail(3)), "maze: arrow keys move without Enter");
  await p.chip("QUIT");
  await p.close();
}

async function warAndCrisis(browser) {
  const p = await player(browser, { viewport: { width: 1366, height: 768 } });
  const { page } = p;
  await p.toTargets();

  // The targeting map: click a city to select it, again to remove it.
  const map = page.locator("#screen canvas.live");
  expect((await map.count()) === 1, "targeting map is shown during target selection");
  const hit = await page.evaluate(() => {
    const targets = GTWCore.TARGETS_US;
    const c = document.querySelector("#screen canvas.live");
    const w = parseFloat(c.style.width);
    const h = parseFloat(c.style.height);
    const fs = Math.max(10, Math.min(16, Math.round(w / 56)));
    const lineH = Math.round(fs * 1.4);
    const box = { x: 8, y: lineH + 10, w: w - 16, h: h - lineH * 2 - 22 };
    const project = Modern.regionProjector(Modern.regionFor(targets), box);
    const miami = targets.find((t) => t.name === "MIAMI");
    return project(miami.lon, miami.lat);
  });
  await map.click({ position: { x: hit[0], y: hit[1] } });
  await p.has("TARGET SELECTED: MIAMI (1/6)");
  await p.ready();
  await map.click({ position: { x: hit[0], y: hit[1] } });
  await p.has("TARGET REMOVED: MIAMI (0/6)");
  await p.chip("SEATTLE");
  await p.has("TARGET SELECTED: SEATTLE (1/6)");
  await p.send("help");
  await p.ready();
  expect(/Pick up to six cities/.test(await p.tail(3)), "HELP at the TARGET prompt is not treated as a city");

  await p.launch();
  await page.waitForTimeout(1500);
  expect((await p.boardInView()) === 100, "the big board is fully in view while it animates");
  await page.keyboard.press("Escape"); // skip the volley
  await p.has("WINNER PROJECTION: UNDETERMINED.", 90000);
  const painted = await page.evaluate(() => {
    const all = document.querySelectorAll("#screen canvas");
    const c = all[all.length - 1];
    const data = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let lit = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i + 1] > 40) lit += 1;
    return lit;
  });
  expect(painted > 500, "the modern board canvas is painted", String(painted));

  // The crisis: status bar in its own row, checkpoint survives a reload.
  await p.has("CHOOSE:", 60000);
  await p.ready();
  const bar = await page.evaluate(() => {
    const b = document.getElementById("topbar").getBoundingClientRect();
    const s = document.getElementById("screen").getBoundingClientRect();
    return { bg: getComputedStyle(document.getElementById("topbar")).backgroundColor, gap: s.top - b.bottom };
  });
  expect(bar.bg === "rgb(0, 0, 0)" && bar.gap >= 0, "status bar is opaque and nothing scrolls under it", JSON.stringify(bar));
  await page.locator(".line.option.live", { hasText: "Warn them" }).click();
  await p.has("DEFCON 2.");
  await p.send("2");
  await p.has("KEYPAD:");
  await p.ready();
  await page.reload();
  await p.has("POWER ON");
  await p.send("");
  await p.has("You left in the middle of the crisis");
  await p.chip("CONTINUE");
  await p.has("KEYPAD:");
  expect(/DEFCON 2/.test(await p.status()), "a reload mid-crisis resumes at the checkpoint", await p.status());
  await p.send("0623");
  await p.has("ANDERSON ISLAND");
  await p.send("2");
  await p.has("Type what you want the machine to do.", 90000);
  await p.ready();

  // DEFCON 1: settings and help are free; the clock ticks; teaching ends it.
  const code = (s) => (s.match(/CODE ([^T]+)/) || [])[1].replace(/\s/g, "");
  const before = code(await p.status());
  await p.send("sound off");
  await p.send("help");
  await p.send("stats");
  await p.ready();
  expect(code(await p.status()) === before && !/[A-Z0-9]/.test(before), "SOUND OFF, HELP and STATS cost no turns at DEFCON 1");
  const t1 = (await p.status()).match(/T-MINUS (\d\d:\d\d)/)[1];
  await page.waitForTimeout(2300);
  const t2 = (await p.status()).match(/T-MINUS (\d\d:\d\d)/)[1];
  expect(t1 !== t2, "the DEFCON 1 clock ticks in real time", t1 + " -> " + t2);
  await p.send("tic-tac-toe");
  await page.waitForFunction(() => document.querySelector(".endcard") !== null, { timeout: 120000 });
  await p.ready();
  const card = await page.evaluate(() => document.querySelector(".endcard").textContent);
  expect(/ENDING 1 OF 3/.test(card) && /THE ONLY WINNING MOVE/.test(card) && /\? \? \?/.test(card), "the end card names the ending and hints at the others");
  expect((await p.chips()).includes("PLAY AGAIN"), "the epilogue offers what to do next");
  await p.close();
}

async function badAndQuietEndings(browser) {
  // Bad ending, from the MENU jump.
  const p = await player(browser, { viewport: { width: 1366, height: 768 } }, { save: FINISHED });
  await p.boot();
  await p.chip("MENU");
  await p.has("JUMP TO");
  await p.page.locator(".line.option.live", { hasText: "DEFCON 1" }).click();
  await p.has("Type what you want the machine to do.", 90000);
  await p.send("launch");
  await p.send("launch");
  await p.send("launch");
  await p.has("SIMULATION RESET", 60000);
  expect(/BIRDS AWAY/.test(await p.tail(6)), "the bad ending is recorded by name and the scene restarts");
  await p.close();

  // The quiet ending, then PLAY AGAIN replays the full opening.
  const q = await player(browser, { viewport: { width: 1366, height: 768 } });
  await q.toSession();
  await q.send("global thermonuclear war");
  await q.has("WOULDN'T YOU PREFER");
  await q.send("no");
  await q.has("PLEASE CHOOSE ONE:");
  await q.send("1");
  await q.has("AWAITING FIRST STRIKE COMMAND");
  await q.chip("ABORT");
  await q.has("WHY WILL YOU NOT PLAY?");
  await q.send("because nobody wins a nuclear war");
  await q.page.waitForFunction(() => document.querySelector(".endcard") !== null, { timeout: 60000 });
  expect(/THE QUIET ENDING/.test(await q.page.evaluate(() => document.querySelector(".endcard").textContent)), "refusing to launch reaches the quiet ending's end card");
  await q.chip("PLAY AGAIN");
  await q.has("SEATTLE. 1983.");
  await q.send("skip");
  await q.has("LOGON:");
  await q.send("joshua");
  await q.has("GREETINGS PROFESSOR FALKEN.");
  await q.ready();
  expect((await q.chips()).join() === "HELLO", "PLAY AGAIN replays the full opening");
  await q.close();
}

async function phone(browser, devices) {
  const p = await player(browser, { ...devices["iPhone 13"] });
  const { page } = p;
  await page.goto(URL);
  await p.has("TAP TO POWER ON");
  const fits = await page.evaluate(() => {
    const logo = document.querySelector(".logo").getBoundingClientRect();
    return logo.left >= 0 && logo.right <= innerWidth;
  });
  expect(fits, "phone: the title logo fits the screen");
  await page.locator(".titlecard").tap();
  await p.has("Type SCAN");
  await p.chip("SKIP");
  await p.has("LOGON:");
  await p.chip("JOSHUA").catch(() => p.send("joshua"));
  await p.has("GREETINGS PROFESSOR FALKEN.");
  await p.send("global thermonuclear war");
  await p.has("WOULDN'T YOU PREFER");
  await p.chip("NO");
  await p.has("PLEASE CHOOSE ONE:");
  await p.chip("2. SOVIET UNION");
  await p.has("AWAITING FIRST STRIKE COMMAND");
  await p.send("list");
  await p.ready();
  const overflow = await page.evaluate(() => {
    const s = document.getElementById("screen");
    return [...s.querySelectorAll(".line.cols")].some((l) => l.scrollWidth > s.clientWidth);
  });
  expect(!overflow, "phone: the typed target list fits the screen");
  await p.chip("SEATTLE");
  // Normal text speed from here, so there is text to tap through.
  await page.locator('#toolbar [data-ctl="fast"]').tap();
  expect(
    (await page.locator('#toolbar [data-ctl="fast"]').getAttribute("aria-pressed")) === "false",
    "phone: the toolbar toggles text speed"
  );
  await p.launch();
  await page.waitForTimeout(800);
  expect((await p.boardInView()) === 100, "phone: the big board is fully in view");

  // A scroll drag must not skip the animation (it does move the view,
  // which is the point of dragging).
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 195, y: 300 }] });
  for (let y = 300; y <= 380; y += 20) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 195, y }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(1500);
  const skipped = await page.evaluate(() =>
    document.getElementById("screen").textContent.includes("TARGETS DESTROYED")
  );
  expect(!skipped, "phone: dragging to scroll does not skip the missile animation");
  await page.locator("#more").tap().catch(() => {}); // back to the newest output

  // A tap during the report skips the text, but not the retaliation volley.
  await p.has("TARGETS DESTROYED", 60000);
  await page.touchscreen.tap(195, 200);
  await page.waitForFunction(() => document.querySelectorAll("#screen canvas").length >= 3, { timeout: 30000 });
  const started = Date.now();
  await p.has("WINNER PROJECTION: UNDETERMINED.", 90000);
  expect(Date.now() - started > 4000, "phone: a tap during text does not swallow the next animation");

  // The crisis status bar on a narrow screen.
  await p.has("CHOOSE:", 60000);
  await p.ready();
  const bar = await page.evaluate(() => {
    const b = document.getElementById("topbar").getBoundingClientRect();
    const s = document.getElementById("screen").getBoundingClientRect();
    return { gap: s.top - b.bottom, over: document.getElementById("status").scrollWidth > innerWidth };
  });
  expect(bar.gap >= 0 && !bar.over, "phone: the status bar wraps cleanly above the screen", JSON.stringify(bar));
  await page.locator(".line.option.live").first().tap();
  await p.has("DEFCON 2.");
  await p.close();
}

async function main() {
  const { chromium, devices } = require("playwright");
  const root = path.join(__dirname, "..");
  const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: root, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 1500));
  const browser = await chromium.launch();
  try {
    await laptopStory(browser);
    await warAndCrisis(browser);
    await badAndQuietEndings(browser);
    await phone(browser, devices);
    console.log("\nBROWSER TESTS PASSED (" + checks + ")");
  } finally {
    await browser.close();
    server.kill();
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
