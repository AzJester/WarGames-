/*
 * Real-browser smoke test (the only check that exercises fonts, canvas,
 * and the actual event loop). Run in CI; locally:
 *   npm i playwright && npx playwright install chromium && node tests/browser.js
 */
const { spawn } = require("child_process");
const path = require("path");

async function main() {
  const { chromium } = require("playwright");
  const root = path.join(__dirname, "..");
  const server = spawn("python3", ["-m", "http.server", "8077"], { cwd: root });
  await new Promise((r) => setTimeout(r, 1500));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));

    const screenHas = (s) =>
      page.waitForFunction(
        (needle) => document.getElementById("screen").textContent.includes(needle),
        s,
        { timeout: 20000 }
      );
    const promptReady = () =>
      page.waitForFunction(
        () => {
          const lines = document.querySelectorAll("#screen .line");
          const last = lines[lines.length - 1];
          return !!last && last.className.includes("input-line") && !!last.querySelector(".cursor");
        },
        { timeout: 20000 }
      );
    const send = async (text) => {
      await promptReady();
      if (text) await page.keyboard.type(text, { delay: 5 });
      await page.keyboard.press("Enter");
    };

    await page.goto("http://127.0.0.1:8077/");
    await screenHas("PRESS ENTER TO POWER ON");
    await send("");
    await screenHas("Type SCAN");
    await send("skip");
    await screenHas("LOGON:");
    await send("joshua");
    await screenHas("GREETINGS PROFESSOR FALKEN.");

    // The film font must actually be applied to the screen.
    const font = await page.evaluate(
      () => getComputedStyle(document.getElementById("screen")).fontFamily
    );
    if (!/Glass TTY/i.test(font)) throw new Error("terminal font not applied: " + font);

    // A modern-mode volley must produce a canvas with drawn pixels.
    await send("global thermonuclear war");
    await screenHas("WOULDN'T YOU PREFER A GOOD GAME OF CHESS?");
    await send("later. lets play global thermonuclear war");
    await screenHas("PLEASE CHOOSE ONE:");
    await send("2");
    await screenHas("AWAITING FIRST STRIKE COMMAND");
    await send("seattle");
    await screenHas("TARGET SELECTED: SEATTLE");
    await send("launch");
    await screenHas("CONFIRM FIRST STRIKE COMMIT");
    await send("yes");
    await page.waitForFunction(
      () => document.querySelector("#screen canvas") !== null,
      { timeout: 20000 }
    );
    await page.keyboard.press("Escape"); // skip the animations
    await screenHas("WINNER PROJECTION: UNDETERMINED.");
    const painted = await page.evaluate(() => {
      const c = document.querySelector("#screen canvas");
      const ctx = c.getContext("2d");
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let lit = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i + 1] > 40) lit += 1;
      return lit;
    });
    if (painted < 500) throw new Error("modern board canvas looks unpainted: " + painted);

    if (errors.length) throw new Error("page errors: " + errors.join(" | "));
    console.log("BROWSER SMOKE OK (canvas pixels lit: " + painted + ")");
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
