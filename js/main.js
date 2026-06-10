/* Scene wiring: dial, logon, and the WOPR session. */

const DIAL_NUMBER = "(311) 399-2364";

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

const scenes = {
  async dial(ctx) {
    const { term } = ctx;
    if (!ctx.dialed) {
      term.print("Sunnyvale, California. Summer, 1983.", "aside");
      term.print(
        "Your war dialer flagged this number on last night's sweep. No bank, no airline, no company name. Just a carrier tone and an open line.",
        "aside"
      );
      term.print("");
      await term.pause(1200);
    }
    ctx.dialed = true;
    await term.type("ATDT " + DIAL_NUMBER, { cps: 16, cls: "dim" });
    await term.type("RINGING . . .", { cps: 8, cls: "dim" });
    await term.pause(500);
    await term.type("CARRIER 1200", { cps: 40, cls: "dim" });
    await term.type("CONNECT", { cps: 40, cls: "dim" });
    term.print("");
    await term.pause(600);
    return "logon";
  },

  async logon(ctx) {
    const { term, state } = ctx;
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
        await term.type("HELP NOT AVAILABLE.");
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
      if (t === "reset") {
        resetState(state);
        await term.type("SYSTEM MEMORY CLEARED.", { cls: "dim" });
        continue;
      }
      if (/\bjoshua\b/.test(t)) {
        state.visits += 1;
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
      await scenes.dial(ctx);
    }
  },

  async session(ctx) {
    const { term, state } = ctx;
    const joshua = new Joshua(state);
    await term.pause(900);
    await term.type("GREETINGS PROFESSOR FALKEN.", { cps: 22 });
    if (joshua.returning) {
      await term.type("YOU CHOSE THE " + state.lastSide + " LAST TIME. THE SIMULATION REMAINS UNFINISHED.");
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
  console.log("Stuck at LOGON? Falken had a son.");
  await runScenes(scenes, "dial", { term, state, dialed: false });
})();
