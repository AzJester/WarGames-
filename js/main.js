/* Scene wiring: boot, war dialing (Act 1), the backdoor (Act 2), and WOPR. */

const DIAL_NUMBER = IntroCore.WOPR_NUMBER;

const TITLE = [
  "  __        ____  ____     ____    _    __  __ _____ ____",
  "  \\ \\      / /  _ \\|  _ \\  / ___|  / \\  |  \\/  | ____/ ___|",
  "   \\ \\ /\\ / /| |_) | |_) || |  _  / _ \\ | |\\/| |  _| \\___ \\",
  "    \\ V  V / |  _ <|  _ < | |_| |/ ___ \\| |  | | |___ ___) |",
  "     \\_/\\_/  |_| \\_\\_| \\_\\ \\____/_/   \\_\\_|  |_|_____|____/",
];

const LOGON_HINTS = [
  "Locked out. But a system this old had a designer, and designers leave doors.",
  "Your notes: the designer was Stephen Falken. Game theorist. He left the field after his son died.",
  "The boy's name was Joshua.",
  "Try the boy's name: JOSHUA.",
];

async function showGameList(term) {
  term.print("");
  for (const game of GAME_LIST) {
    await term.type(game, { cps: 90 });
  }
  term.print("");
  await term.pause(300);
  await term.type(GTW, { cps: 22 });
  term.print("");
}

async function connectTone(term) {
  await term.type("RINGING . . .", { cps: 8, cls: "dim" });
  await term.pause(500);
  await term.type("CARRIER 1200", { cps: 40, cls: "dim" });
  await term.type("CONNECT", { cps: 40, cls: "dim" });
  term.print("");
  await term.pause(600);
}

const scenes = {
  async boot(ctx) {
    const { term, state } = ctx;
    for (const row of TITLE) term.print(row, "title");
    term.print("");
    await term.pause(300);

    // A returning player who already found WOPR skips the search.
    if (state.metWopr) {
      term.print("(Welcome back. Reconnecting to the last system.)", "aside");
      term.print("");
      await term.pause(600);
      ctx.skipFraming = true;
      return "dial";
    }

    await term.type("SEATTLE. 1983.", { cps: 26 });
    term.print("");
    await term.type(
      "You are David Lightman. Sixteen, a C-minus average you have privately corrected, and a modem that dials all night.",
      { cps: 60 }
    );
    await term.type(
      "Word is a company called PROTOVISION is about to ship next year's games. You intend to play them early. All you need is their number.",
      { cps: 60 }
    );
    term.print("");
    await term.type(
      "So you point the autodialer at the Sunnyvale exchange and let it work through every number, one by one.",
      { cps: 60 }
    );
    term.print("");
    term.print("Type SCAN to start war dialing. Type SKIP to jump straight to the system you eventually find.", "aside");
    term.print("");

    while (true) {
      const t = norm(await term.read("> "));
      if (t === "skip") {
        ctx.skipFraming = true;
        return "dial";
      }
      if (!t || t === "scan" || t === "start" || t === "begin" || t === "dial" || t === "go") {
        return "wardial";
      }
      term.print("Type SCAN to begin, or SKIP to jump ahead.", "aside");
    }
  },

  async wardial(ctx) {
    const { term } = ctx;
    term.print("");
    await term.type("AUTODIALER ENGAGED — SCANNING " + IntroCore.AREA + " 399-XXXX", {
      cps: 30,
      cls: "dim",
    });
    term.print("");
    for (const entry of IntroCore.SCAN) {
      const connected = /^CONNECT/.test(entry.result);
      const cls = connected ? "" : "dim";
      let row = entry.num.padEnd(11) + entry.result;
      if (entry.banner) row += "   " + entry.banner;
      await term.type(row, { cps: 120, cls });
      await term.pause(connected ? 220 : 90);
    }
    term.print("");
    const found = IntroCore.carriers().length;
    await term.type("SCAN COMPLETE. " + found + " CARRIERS FOUND.", { cps: 40 });
    term.print("");
    term.print(
      "Banks, an airline, a dentist's machine. Protovision's line is dead. But one number answered with a carrier and no name at all.",
      "aside"
    );
    term.print("Type DIAL followed by a number to call it back. (Try the one with no banner.)", "aside");
    term.print("");

    while (true) {
      const raw = await term.read("DIAL: ");
      const t = norm(raw);
      if (!t) continue;
      if (t === "skip") {
        ctx.skipFraming = true;
        return "dial";
      }
      if (t === "scan" || t === "list") {
        return "wardial";
      }
      if (t === "help") {
        term.print("Type DIAL <number> to connect. The unmarked carrier is the one you want.", "aside");
        continue;
      }
      const res = IntroCore.dialResult(t);
      if (res.type === "empty") continue;
      if (res.type === "target") {
        term.print("");
        await term.type("ATDT " + DIAL_NUMBER, { cps: 16, cls: "dim" });
        await connectTone(term);
        ctx.dialed = true;
        ctx.fromWardial = true;
        return "logon";
      }
      if (res.type === "flavor") {
        await term.type("ATDT (311) " + res.entry.num, { cps: 16, cls: "dim" });
        await term.pause(300);
        await term.type(res.entry.result + (res.entry.banner ? "   " + res.entry.banner : ""), {
          cps: 60,
          cls: "dim",
        });
        term.print("Not it. Try the carrier with no banner.", "aside");
        continue;
      }
      await term.type("ATDT (311) 399-" + IntroCore.last4(t).padStart(4, "0"), {
        cps: 16,
        cls: "dim",
      });
      await term.type("NO CARRIER", { cps: 40, cls: "dim" });
      continue;
    }
  },

  async dial(ctx) {
    const { term } = ctx;
    if (ctx.skipFraming) {
      term.print("Skipping ahead. The autodialer already has the number.", "aside");
      term.print("");
      ctx.skipFraming = false;
      await term.pause(400);
    }
    await term.type("ATDT " + DIAL_NUMBER, { cps: 16, cls: "dim" });
    await connectTone(term);
    ctx.dialed = true;
    return "logon";
  },

  async logon(ctx) {
    const { term, state } = ctx;
    if (ctx.fromWardial && !ctx.backdoorShown) {
      ctx.backdoorShown = true;
      await term.type("THIS SYSTEM ANSWERED WITH NO IDENTIFYING BANNER.");
      await showGameList(term);
      term.print(
        "A game server, you figure. But it wants a logon, and the games have strange names — FALKEN'S MAZE. Someone built this. Type RESEARCH FALKEN to find out who.",
        "aside"
      );
      term.print("");
    }
    let failures = 0;
    while (true) {
      const value = await term.read("LOGON: ");
      const t = norm(value);
      if (!t) continue;
      if (t === "help games") {
        await term.type(
          "'GAMES' REFERS TO MODELS, SIMULATIONS AND GAMES WHICH HAVE TACTICAL AND STRATEGIC APPLICATIONS."
        );
        continue;
      }
      if (t === "help") {
        await term.type("COMMANDS: LIST GAMES, RESEARCH <TOPIC>, INDEX, OR A LOGON NAME.");
        continue;
      }
      if (t.startsWith("help ")) {
        await term.type(t.toUpperCase() + " NOT AVAILABLE.");
        continue;
      }
      if (/^(list games|list|games)$/.test(t)) {
        await showGameList(term);
        continue;
      }
      if (t === "index" || t === "research" || t === "search" || t === "lookup") {
        await showResearchIndex(term);
        continue;
      }
      if (/^(research|search|lookup|look up|find) /.test(t)) {
        const topic = t.replace(/^(research|search|lookup|look up|find) /, "");
        await doResearch(term, state, topic);
        continue;
      }
      if (t === "reset") {
        resetState(state);
        await term.type("SYSTEM MEMORY CLEARED.", { cls: "dim" });
        continue;
      }
      if (/\bjoshua\b/.test(t)) {
        state.visits += 1;
        state.metWopr = true;
        saveState(state);
        return "session";
      }
      failures += 1;
      await term.pause(400);
      await term.type("IDENTIFICATION NOT RECOGNIZED BY SYSTEM");
      await term.type("--CONNECTION TERMINATED--");
      term.print("");
      await term.pause(900);
      term.print(LOGON_HINTS[Math.min(failures, LOGON_HINTS.length) - 1], "aside");
      term.print("");
      await term.pause(700);
      await term.type("ATDT " + DIAL_NUMBER, { cps: 16, cls: "dim" });
      await connectTone(term);
    }
  },

  async session(ctx) {
    const { term, state } = ctx;
    const joshua = new Joshua(state);
    await term.pause(900);
    await term.type("GREETINGS PROFESSOR FALKEN.", { cps: 22 });
    if (joshua.returning) {
      await term.type(
        "YOU CHOSE THE " + state.lastSide + " LAST TIME. THE SIMULATION REMAINS UNFINISHED."
      );
      term.print("");
      await term.type("SHALL WE PLAY AGAIN?");
    }
    while (true) {
      const value = await term.read("> ");
      const ops = joshua.respond(value);
      for (const op of ops) {
        if (op.kind === "say") {
          await term.type(op.text);
        } else if (op.kind === "aside") {
          term.print(op.text, "aside");
        } else if (op.kind === "blank") {
          term.print("");
        } else if (op.kind === "pause") {
          await term.pause(op.ms);
        } else if (op.kind === "list") {
          await showGameList(term);
        } else if (op.kind === "game") {
          if (op.game === "TIC-TAC-TOE") {
            await playTicTacToe(term, state);
            saveState(state);
            term.print("");
            await term.type("SHALL WE PLAY A DIFFERENT GAME?");
            joshua.pending = "play";
          } else {
            const result = await playGTW(term, state);
            saveState(state);
            if (result.completed) return "dial";
            term.print("");
            await term.type("SHALL WE PLAY A DIFFERENT GAME?");
            joshua.pending = "play";
          }
        } else if (op.kind === "logoff") {
          term.print("");
          await term.pause(400);
          await term.type("--CONNECTION CLOSED--", { cps: 40, cls: "dim" });
          term.print("");
          term.print("(Press ENTER to redial.)", "aside");
          await term.read("");
          term.print("");
          return "dial";
        }
      }
    }
  },
};

async function showResearchIndex(term) {
  term.print("");
  await term.type("RESEARCH TERMINAL — SUGGESTED TOPICS:");
  for (const [topic, gloss] of IntroCore.TOPICS) {
    await term.type("  " + topic.padEnd(14) + gloss, { cps: 120 });
  }
  term.print("USAGE: RESEARCH FALKEN", "aside");
  term.print("");
}

async function doResearch(term, state, topic) {
  const art = IntroCore.research(topic);
  if (!art) {
    await term.type("NO RECORDS FOUND FOR THAT TERM.");
    term.print("Try: RESEARCH FALKEN", "aside");
    return;
  }
  term.print("");
  await term.type("► " + art.title, { cps: 60 });
  for (const line of art.body) {
    await term.type("  " + line, { cps: 80 });
  }
  if (art.revealsPassword) {
    state.knowsJoshua = true;
    saveState(state);
  }
  if (art.nudge) {
    term.print("");
    term.print(art.nudge, "aside");
  }
  term.print("");
}

(async function main() {
  const term = new Terminal({
    screen: document.getElementById("screen"),
    input: document.getElementById("kbd"),
    live: document.getElementById("sr-live"),
  });
  const state = loadState();
  console.log(
    "%cGREETINGS.",
    "color:#3aff6e;background:#000;font-size:14px;font-family:monospace;padding:4px 8px;"
  );
  console.log("Stuck at LOGON? Falken had a son. Or just type SKIP at the start.");
  await runScenes(scenes, "boot", { term, state, dialed: false });
})();
