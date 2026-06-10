/* Milestone 1 flow: dial, logon, and the opening conversation with Joshua. */

const DIAL_NUMBER = "(311) 399-2364";

const LOGON_HINTS = [
  "Locked out. But a system this old had a designer, and designers leave doors.",
  "Your notes: the designer was Stephen Falken. Game theorist. He left the field after his son died.",
  "The boy's name was Joshua.",
  "Try the boy's name: JOSHUA.",
];

async function dial(term, redial) {
  if (!redial) {
    term.print("Sunnyvale, California. Summer, 1983.", "aside");
    term.print(
      "Your war dialer flagged this number on last night's sweep. No bank, no airline, no company name. Just a carrier tone and an open line.",
      "aside"
    );
    term.print("");
    await term.pause(1200);
  }
  await term.type("ATDT " + DIAL_NUMBER, { cps: 16, cls: "dim" });
  await term.type("RINGING . . .", { cps: 8, cls: "dim" });
  await term.pause(500);
  await term.type("CARRIER 1200", { cps: 40, cls: "dim" });
  await term.type("CONNECT", { cps: 40, cls: "dim" });
  term.print("");
  await term.pause(600);
}

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

async function logon(term) {
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
    if (/\bjoshua\b/.test(t)) return;
    failures += 1;
    await term.pause(400);
    await term.type("IDENTIFICATION NOT RECOGNIZED BY SYSTEM");
    await term.type("--CONNECTION TERMINATED--");
    term.print("");
    await term.pause(900);
    term.print(LOGON_HINTS[Math.min(failures, LOGON_HINTS.length) - 1], "aside");
    term.print("");
    await term.pause(700);
    await dial(term, true);
  }
}

async function session(term) {
  const joshua = new Joshua();
  await term.pause(900);
  await term.type("GREETINGS PROFESSOR FALKEN.", { cps: 22 });
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
      } else if (op.kind === "logoff") {
        term.print("");
        await term.pause(400);
        await term.type("--CONNECTION CLOSED--", { cps: 40, cls: "dim" });
        term.print("");
        term.print("(Press ENTER to redial.)", "aside");
        await term.read("");
        term.print("");
        return;
      }
    }
  }
}

(async function main() {
  const term = new Terminal({
    screen: document.getElementById("screen"),
    input: document.getElementById("kbd"),
    live: document.getElementById("sr-live"),
  });
  console.log(
    "%cGREETINGS.",
    "color:#3aff6e;background:#000;font-size:14px;font-family:monospace;padding:4px 8px;"
  );
  console.log("Stuck at LOGON? Falken had a son.");
  let redial = false;
  while (true) {
    await dial(term, redial);
    await logon(term);
    await session(term);
    redial = true;
  }
})();
