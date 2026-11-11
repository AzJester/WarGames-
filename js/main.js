/* Scene wiring: title, war dialing (Act 1), the backdoor (Act 2), WOPR
 * (Act 3), the crisis (Acts 4-5), and the epilogue. */

const DIAL_NUMBER = IntroCore.WOPR_NUMBER;

// The title logo: 5x5 block letters, each pixel two characters wide so it
// reads square in the 1:2 terminal face.
const LOGO_FONT = {
  W: ["█   █", "█   █", "█ █ █", "██ ██", "█   █"],
  A: [" ███ ", "█   █", "█████", "█   █", "█   █"],
  R: ["████ ", "█   █", "████ ", "█  █ ", "█   █"],
  G: [" ████", "█    ", "█  ██", "█   █", " ████"],
  M: ["█   █", "██ ██", "█ █ █", "█   █", "█   █"],
  E: ["█████", "█    ", "████ ", "█    ", "█████"],
  S: [" ████", "█    ", " ███ ", "    █", "████ "],
};

function logoRows(word) {
  const rows = [];
  for (let r = 0; r < 5; r++) {
    rows.push(
      word
        .split("")
        .map((ch) => LOGO_FONT[ch][r])
        .join(" ")
        .replace(/./g, (c) => c + c)
    );
  }
  return rows;
}

const LOGON_HINTS = [
  "Locked out. But a system this old had a designer, and designers leave doors.",
  "Your notes: the designer was Stephen Falken. Game theorist. He left the field after his son died.",
  "The boy's name was Joshua.",
  "Try the boy's name: JOSHUA.",
];

// Crisis scenes a reload can resume from.
const CHECKPOINTS = ["crisis", "interrogation", "escape", "falken", "defcon1"];

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

// Sound captions for deaf players: CAPTIONS ON prints a dim label when a
// non-speech cue fires. Off by default; persisted.
function caption(term, label) {
  if (Settings.get("captions") === "on") term.print("[ SOUND: " + label + " ]", "dim");
}

// The full handshake the first time; a short redial after that, so a
// wrong logon costs a second instead of nine.
async function connectTone(term, quick) {
  if (quick) {
    if (typeof Sound !== "undefined") Sound.beep();
    await term.type("REDIALING . . . CONNECT", { cps: 60, cls: "dim" });
    term.print("");
    await term.pause(250);
    return;
  }
  if (typeof Sound !== "undefined") Sound.modem();
  caption(term, "MODEM DIAL AND HANDSHAKE");
  await term.type("RINGING . . .", { cps: 8, cls: "dim" });
  await term.pause(500);
  await term.type("CARRIER 1200", { cps: 40, cls: "dim" });
  await term.type("CONNECT", { cps: 40, cls: "dim" });
  term.print("");
  await term.pause(600);
}

// Speak a WOPR line; cancel any backlog when the player acts.
function vox(text) {
  if (typeof Sound !== "undefined") Sound.speak(text);
}
function hush() {
  if (typeof Sound !== "undefined") Sound.shutUp();
}

// A spoiler-light briefing for players who never saw the film.
const STORY_LINES = [
  "THE YEAR IS 1983. THE COLD WAR IS ON.",
  "",
  "Two superpowers, the United States and the Soviet Union, point thousands of nuclear missiles at each other. Neither dares fire: destroying the enemy means being destroyed yourself. The military calls the alert scale DEFCON: 5 means peace, 1 means nuclear war is imminent.",
  "",
  "There is no internet yet. Computers talk over phone lines through modems, and a 'war dialer' is a program that calls thousands of numbers overnight, listening for another computer to answer.",
  "",
  "You are David Lightman: a Seattle teenager, sharp, bored, and very good with that modem. You want one thing: to play an unreleased video game from a company called Protovision before anyone else. So you start dialing every number in their town.",
  "",
  "What you find instead does not have a name on it. It plays games. It learns. And it does not always know the difference between a game and the real thing.",
  "",
  "USEFUL THINGS TO KNOW:",
  "- Type commands and press Enter, or use the buttons under the screen. When stuck, read the amber notes: they are your own thoughts, and they nudge you forward.",
  "- HELP works at every prompt and tells you what to do right there. OPTIONS has the settings.",
  "- RESEARCH <topic> digs into anything that looks like a name or a clue.",
  "- Nothing you type can break the game. Curiosity is the whole point.",
  "- Based on the 1983 film WarGames. No spoilers here: what the machine learns at the end, you will teach it.",
];

async function showStory(term) {
  term.print("");
  for (const line of STORY_LINES) {
    if (!line) {
      term.print("");
    } else if (line === line.toUpperCase()) {
      await term.type(line, { cps: 60 });
    } else {
      term.print(line, "aside");
      await term.pause(150);
    }
  }
  term.print("");
}

// Typed forms of the settings: [pattern, key, value, confirmation].
const SETTING_COMMANDS = [
  [/^(sound off|mute)$/, "sound", "off", "SOUND OFF."],
  [/^(sound on|unmute)$/, "sound", "on", "SOUND ON."],
  [/^voice off$/, "voice", "off", "VOICE OFF."],
  [/^voice on$/, "voice", "on", "VOICE ON."],
  [/^(fast|fast on|speed fast)$/, "speed", "fast", "FAST TEXT ON."],
  [/^(slow|fast off|speed normal)$/, "speed", "normal", "FAST TEXT OFF."],
  [/^captions on$/, "captions", "on", "CAPTIONS ON."],
  [/^captions off$/, "captions", "off", "CAPTIONS OFF."],
  [/^buttons on$/, "buttons", "on", "BUTTONS ON."],
  [/^buttons off$/, "buttons", "off", "BUTTONS OFF. TYPE BUTTONS ON TO BRING THEM BACK."],
  [/^(mode modern|modern)$/, "mode", "modern", "DISPLAY MODE: MODERN."],
  [/^(mode classic|classic)$/, "mode", "classic", "DISPLAY MODE: CLASSIC."],
  [/^(view polar|polar)$/, "view", "polar", "BOARD VIEW: POLAR. THE SHORTEST PATH CROSSES THE ARCTIC."],
  [/^view flat$/, "view", "flat", "BOARD VIEW: FLAT."],
  [/^difficulty easy$/, "difficulty", "easy", "DIFFICULTY: EASY."],
  [/^difficulty normal$/, "difficulty", "normal", "DIFFICULTY: NORMAL."],
  [/^difficulty hard$/, "difficulty", "hard", "DIFFICULTY: HARD."],
];

// A bare setting name reports its value and how to change it.
const SETTING_QUERIES = {
  sound: ["sound", "SOUND IS", "TYPE SOUND OFF OR SOUND ON."],
  voice: ["voice", "VOICE IS", "TYPE VOICE OFF OR VOICE ON."],
  captions: ["captions", "CAPTIONS ARE", "TYPE CAPTIONS ON OR CAPTIONS OFF."],
  buttons: ["buttons", "BUTTONS ARE", "TYPE BUTTONS ON OR BUTTONS OFF."],
  mode: ["mode", "DISPLAY MODE IS", "TYPE MODE MODERN OR MODE CLASSIC."],
  view: ["view", "BOARD VIEW IS", "TYPE VIEW FLAT OR VIEW POLAR."],
  difficulty: ["difficulty", "DIFFICULTY IS", "TYPE DIFFICULTY EASY, NORMAL OR HARD."],
};

// Settings, HELP, STORY, STATS and SHARE work at every prompt: the
// terminal runs each answer through here before the scene sees it, so
// none of them can cost a turn or be mistaken for a move. Returns true if
// it handled the input.
async function handleGlobalCommand(term, raw, state) {
  const t = norm(raw);
  if (String(raw).trim() === "?" || /^(options|settings|commands|controls)$/.test(t)) {
    if (!UI.open()) await showOptionsText(term);
    return true;
  }
  if (!t) return false;
  if (t === "help" && !term.helpOwn) {
    term.print(term.help || DEFAULT_HELP, "aside");
    term.print("OPTIONS shows settings and every other command.", "aside");
    return true;
  }
  if (t === "story" || t === "about" || t === "briefing" || t === "intro") {
    await showStory(term);
    return true;
  }
  for (const [pattern, key, value, message] of SETTING_COMMANDS) {
    if (!pattern.test(t)) continue;
    Settings.set(key, value);
    await term.type(message);
    if (key === "voice" && value === "on") vox("VOICE ENABLED, PROFESSOR.");
    return true;
  }
  if (Object.prototype.hasOwnProperty.call(SETTING_QUERIES, t)) {
    const [key, lead, how] = SETTING_QUERIES[t];
    await term.type(lead + " " + Settings.get(key).toUpperCase() + ". " + how);
    return true;
  }
  if ((t === "stats" || t === "score") && state) {
    const seen = state.endingsSeen || [];
    const lines = [
      "GAMES PLAYED: " + ((state.gamesPlayed || 0) + (state.tttGames || 0)) + ".",
      "TIC-TAC-TOE: " + (state.tttGames || 0) + " GAMES, " + (state.tttDraws || 0) + " TIES.",
      "WARS STARTED: " + (state.gtwRuns || 0) + ". LAUNCHES REFUSED: " + (state.refusedLaunch ? "YES" : "NO") + ".",
      "ENDINGS WITNESSED: " +
        seen.length +
        " OF 3" +
        (seen.length ? " (" + seen.map(CrisisCore.endingName).join(", ") + ")" : "") +
        ".",
    ];
    for (const line of lines) {
      vox(line);
      await term.type(line);
    }
    return true;
  }
  if (t === "listen on" || t === "listen") {
    if (startListening(term)) {
      await term.type("LISTENING. SPEAK, PROFESSOR.");
    } else {
      await term.type("SPEECH RECOGNITION IS NOT AVAILABLE IN THIS BROWSER.");
    }
    return true;
  }
  if (t === "listen off") {
    stopListening();
    await term.type("LISTENING STOPPED.");
    return true;
  }
  if (t === "share" && state) {
    if (!state.ending) {
      await term.type("FINISH THE GAME FIRST, PROFESSOR.");
      return true;
    }
    const url = typeof Modern !== "undefined" ? Modern.endingCard(state) : null;
    if (url && typeof document !== "undefined") {
      const a = document.createElement("a");
      a.href = url;
      a.download = "wargames-ending.png";
      a.click();
      await term.type("KEEPSAKE CARD SAVED.");
    } else {
      await term.type("CARD GENERATION IS NOT AVAILABLE HERE.");
    }
    return true;
  }
  return false;
}

// Text fallback for OPTIONS where the panel cannot open.
async function showOptionsText(term) {
  term.print("");
  for (const d of Settings.defs) {
    term.print(
      "  " + d.label.padEnd(12) + d.get().toUpperCase().padEnd(9) + d.options.join(" | ").toUpperCase(),
      "dim"
    );
  }
  term.print("ALSO: HELP, STORY, STATS, SHARE.", "dim");
  term.print("");
}

// Optional speech input via the Web Speech API: finals land as typed lines.
let recognizer = null;

function startListening(term) {
  if (recognizer) return true;
  const SR =
    typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
  if (!SR) return false;
  try {
    recognizer = new SR();
    recognizer.lang = "en-US";
    recognizer.continuous = true;
    recognizer.interimResults = false;
    recognizer.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      if (last && last.isFinal) term.submitLine(last[0].transcript.trim());
    };
    recognizer.onend = () => {
      if (recognizer) recognizer.start(); // keep listening until LISTEN OFF
    };
    recognizer.start();
    return true;
  } catch (e) {
    recognizer = null;
    return false;
  }
}

function stopListening() {
  if (!recognizer) return;
  const r = recognizer;
  recognizer = null;
  try {
    r.onend = null;
    r.stop();
  } catch (e) {
    /* already stopped */
  }
}

// Start the story over without losing the record (endings, stats).
function restartStory(state) {
  state.scene = null;
  state.crisisResolved = false;
  state.defcon = 5;
  state.suspicion = 2;
  saveState(state);
}

// Suggested replies while talking to Joshua. They follow the film's
// exchange through the opening, then turn into the game menu.
function sessionChips(joshua) {
  if (joshua.beat === "opening1") return ["HELLO"];
  if (joshua.beat === "opening2") return ["I'M FINE. HOW ARE YOU?", "NOT SO GOOD"];
  if (joshua.beat === "opening3") return ["PEOPLE SOMETIMES MAKE MISTAKES"];
  if (joshua.pending === "chess") {
    const chips = ["YES", "NO"];
    if (joshua.wantedGame === GTW) chips.push("LATER. LET'S PLAY GLOBAL THERMONUCLEAR WAR");
    return chips;
  }
  if (joshua.pending === "gtwagain") return ["YES", "NO", "LIST GAMES"];
  return [...PLAYABLE, "LIST GAMES", "LOGOFF"];
}

const GAME_TABLE = {
  "TIC-TAC-TOE": (term, state) => playTicTacToe(term, state),
  CHESS: (term, state) => playChess(term, state),
  CHECKERS: (term, state) => playCheckers(term, state),
  "BLACK JACK": (term, state) => playBlackjack(term, state),
  POKER: (term, state) => playPoker(term, state),
  "FALKEN'S MAZE": (term, state) => playMaze(term, state),
};

const scenes = {
  // The title card, then routing: resume a crisis, reconnect a returning
  // player, or start the story.
  async boot(ctx) {
    const { term, state } = ctx;
    term.clear();
    term.clearStatus();
    term.pushHelp("Press Enter, or tap the screen, to switch the terminal on.");
    const card = term.block("titlecard");
    const logo = document.createElement("pre");
    logo.className = "logo";
    logo.textContent = logoRows("WARGAMES").join("\n");
    const add = (cls, text) => {
      const d = document.createElement("div");
      d.className = cls;
      d.textContent = text;
      card.appendChild(d);
    };
    card.appendChild(logo);
    add("tagline", "WAR OPERATION PLAN RESPONSE");
    add("quote", "SHALL WE PLAY A GAME?");
    add("poweron", term.coarse ? "[ TAP TO POWER ON ]" : "[ PRESS ENTER TO POWER ON ]");
    add(
      "fineprint",
      "A TERMINAL GAME OF THE 1983 FILM." + (Settings.get("sound") === "on" ? " IT TALKS: SOUND IS ON." : "")
    );
    term._announce("WARGAMES. SHALL WE PLAY A GAME? PRESS ENTER TO POWER ON.");
    term.makeLive(card, "");
    // Browsers keep audio muted until the first interaction, so the
    // power-on keypress doubles as the audio unlock.
    await term.read("", { ghost: true, placeholder: "TAP ABOVE TO POWER ON" });
    ctx.poweredOn = true;
    if (typeof Sound !== "undefined") {
      Sound.unlock();
      Sound.powerOn();
    }
    term.clear();
    if (term.crt) {
      term.crt.classList.add("power-on");
      setTimeout(() => term.crt.classList.remove("power-on"), 950);
    }
    await term.pause(700);

    // A crisis left unfinished picks up where the tab was closed.
    if (state.scene && CHECKPOINTS.includes(state.scene) && !state.crisisResolved) {
      term.pushHelp("ENTER returns you to the crisis where you left it. RESTART begins the story again.");
      term.print(
        "(You left in the middle of the crisis. Press ENTER to pick up where you left off, or type RESTART to begin the story again.)",
        "aside"
      );
      term.print("");
      const t = norm(await term.read("> ", { choices: [{ label: "CONTINUE", value: "", cls: "go" }, "RESTART"] }));
      if (t !== "restart") {
        term.print("");
        return state.scene;
      }
      restartStory(state);
      ctx.fresh = true;
      term.print("");
      return "intro";
    }

    // A returning player who already found WOPR skips the search; one who
    // has finished the story also unlocks the MENU jump.
    if (state.metWopr && !ctx.fresh) {
      term.print("(Welcome back. Reconnecting to the last system.)", "aside");
      if (state.crisisResolved) {
        term.pushHelp("ENTER reconnects to the machine. MENU jumps to any act of the story.");
        term.print("(You have finished the story. Type MENU to jump anywhere, or press ENTER to reconnect.)", "aside");
        term.print("");
        const t = norm(
          await term.read("> ", { choices: [{ label: "RECONNECT", value: "", cls: "go" }, "MENU", "STATS"] })
        );
        if (t === "menu") return "menu";
      }
      term.print("");
      await term.pause(600);
      ctx.skipFraming = true;
      return "dial";
    }
    return "intro";
  },

  async intro(ctx) {
    const { term } = ctx;
    term.clearStatus();
    term.pushHelp(
      "SCAN starts war dialing. SKIP jumps straight to the system you eventually find. STORY is a one-minute briefing if you never saw the film."
    );
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
    term.print("Never seen the film? Type STORY for a one-minute briefing. No spoilers.", "aside");
    term.print(
      "HELP works at every prompt. Sound, voice and text speed are the buttons at the top right.",
      "aside"
    );
    term.print("");

    while (true) {
      const t = norm(await term.read("> ", { choices: [{ label: "SCAN", cls: "go" }, "SKIP", "STORY"] }));
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
    term.pushHelp(
      "Type one of the numbers from the scan to call it back. The one you want answered with a carrier and no name. SCAN runs the dialer again."
    );
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
      if (typeof Sound !== "undefined") Sound.tick();
      await term.type(row, { cps: 120, cls });
      await term.pause(connected ? 220 : 90);
    }
    term.print("");
    const carriers = IntroCore.carriers();
    await term.type("SCAN COMPLETE. " + carriers.length + " CARRIERS FOUND.", { cps: 40 });
    term.print("");
    term.print(
      "Banks, an airline, a dentist's machine. Protovision's line is dead. But one number answered with a carrier and no name at all.",
      "aside"
    );
    term.print("Type a number to call it back. (Try the one with no banner.)", "aside");
    term.print("");

    const chips = [...carriers.map((e) => e.num), { label: "SCAN AGAIN", value: "SCAN" }];
    while (true) {
      const raw = await term.read("DIAL: ", { choices: chips, inputmode: "tel" });
      const t = norm(raw);
      if (!t) continue;
      if (t === "skip") {
        ctx.skipFraming = true;
        return "dial";
      }
      if (t === "scan" || t === "scan again" || t === "list") {
        return "wardial";
      }
      const res = IntroCore.dialResult(t);
      if (res.type === "empty") {
        term.print("Type a number from the scan, like 399-1972.", "aside");
        continue;
      }
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
    term.clearStatus();
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
    term.pushHelp(
      "The system wants a logon name, and you do not have one yet. RESEARCH <topic> looks things up: start with RESEARCH FALKEN. LIST GAMES shows what it plays.",
      { own: true }
    );
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
    // The buttons follow the clues the player has actually been given.
    const chips = () => {
      const out = [];
      if (state.metWopr || state.knowsJoshua || failures >= 3) out.push({ label: "JOSHUA", cls: "go" });
      if (ctx.readFalken && !state.knowsJoshua) out.push("RESEARCH JOSHUA");
      if ((ctx.fromWardial || failures >= 2) && !ctx.readFalken) out.push("RESEARCH FALKEN");
      out.push("LIST GAMES", "HELP");
      return out;
    };
    while (true) {
      const value = await term.read("LOGON: ", { choices: chips });
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
        term.print("[ OPTIONS shows settings and every other command. ]", "aside");
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
        await doResearch(term, state, topic, ctx);
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
      if (failures === 1) {
        await term.type("ATDT " + DIAL_NUMBER, { cps: 16, cls: "dim" });
        await connectTone(term);
      } else {
        await connectTone(term, true);
      }
    }
  },

  async session(ctx) {
    const { term, state } = ctx;
    term.clearStatus();
    term.pushHelp(
      "You are talking to the machine. Answer its questions, or name a game from LIST GAMES. LOGOFF hangs up.",
      { own: true }
    );
    const joshua = new Joshua(state, { fresh: !!ctx.fresh });

    // Run one game and report whether the story moves on.
    const runGame = async (game) => {
      if (game === GTW) {
        const result = await playGTW(term, state);
        saveState(state);
        if (result.secret) {
          await secretEnding(term, state);
          return "epilogue";
        }
        if (result.completed) {
          return state.crisisResolved ? "dial" : "crisis";
        }
      } else {
        await GAME_TABLE[game](term, state);
        saveState(state);
      }
      term.print("");
      vox("SHALL WE PLAY A DIFFERENT GAME?");
      await term.type("SHALL WE PLAY A DIFFERENT GAME?");
      joshua.pending = "play";
      joshua.beat = "free";
      return null;
    };

    if (ctx.autoGame && ctx.autoGame !== GTW) {
      // Taking Joshua up on his closing offer: the line is still open.
      const game = ctx.autoGame;
      ctx.autoGame = null;
      term.print("");
      vox("EXCELLENT.");
      await term.type("EXCELLENT.");
      const next = await runGame(game);
      if (next) return next;
    } else {
      await term.pause(900);
      vox("GREETINGS PROFESSOR FALKEN.");
      await term.type("GREETINGS PROFESSOR FALKEN.", { cps: 22 });
      if (ctx.autoGame === GTW) {
        ctx.autoGame = null;
        vox("RESUMING: GLOBAL THERMONUCLEAR WAR.");
        await term.type("RESUMING: GLOBAL THERMONUCLEAR WAR.");
        const next = await runGame(GTW);
        if (next) return next;
      } else if (joshua.returning) {
        const back = "YOU CHOSE THE " + state.lastSide + " LAST TIME. THE SIMULATION REMAINS UNFINISHED.";
        vox(back);
        await term.type(back);
        term.print("");
        vox("SHALL WE PLAY AGAIN?");
        await term.type("SHALL WE PLAY AGAIN?");
      }
    }
    while (true) {
      const value = await term.read("> ", { choices: () => sessionChips(joshua) });
      hush();
      const ops = joshua.respond(value);
      for (const op of ops) {
        if (op.kind === "say") {
          vox(op.text);
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
          const next = await runGame(op.game);
          if (next) return next;
        } else if (op.kind === "logoff") {
          term.print("");
          await term.pause(400);
          await term.type("--CONNECTION CLOSED--", { cps: 40, cls: "dim" });
          term.print("");
          term.print("(Press ENTER to redial.)", "aside");
          await term.read("", { choices: [{ label: "REDIAL", value: "", cls: "go" }] });
          term.print("");
          return "dial";
        }
      }
    }
  },

  // Act 4: the morning after. WOPR never stopped running David's game.
  async crisis(ctx) {
    const { term, state } = ctx;
    ctx.fresh = false; // the replay has caught up with the story
    state.defcon = 4;
    saveState(state);
    term.pushHelp("The story is moving. Enter, Space or a tap skips ahead.");
    term.print("");
    await term.pause(500);
    term.print("You shut off the modem and sleep well. You have no idea.", "aside");
    term.print("");
    await term.pause(700);
    await term.type("CHEYENNE MOUNTAIN COMPLEX — NORAD", { cps: 30 });
    term.print("");
    term.print(
      "Two thousand feet under granite, the big board lights up: a Soviet first strike. The one you ordered last night. Except the machine never stopped running it.",
      "aside"
    );
    await term.pause(800);
    term.setStatus({ defcon: 3, right: "NORAD WAR ROOM" });
    state.defcon = 3;
    term.print(
      "(The bar above is the DEFCON scale: America's alert level. 5 is peacetime. 1 is nuclear war. It is not supposed to move.)",
      "aside"
    );
    await term.type("DEFCON 3. BOMBERS TO POSITIVE CONTROL.", { cps: 26 });
    await term.pause(700);
    term.print(
      "Then, just as fast: no warheads on radar. A false alarm. The room exhales. The machine does not.",
      "aside"
    );
    term.print("");
    await term.pause(800);
    term.print(
      "It takes the FBI thirty hours to trace the back door to a bedroom in Seattle. They come for you at school.",
      "aside"
    );
    term.print("");
    await term.pause(900);
    return "interrogation";
  },

  async interrogation(ctx) {
    const { term, state } = ctx;
    term.setStatus({ defcon: 3, right: "NORAD WAR ROOM" });
    state.defcon = 3;
    term.pushHelp(
      "Choose how to answer: click a line or type its number. How this goes decides how much time they give you later."
    );
    term.print("");
    await term.type("NORAD — SUBLEVEL INTERROGATION", { cps: 30 });
    term.print("");
    term.print('MCKITTRICK: "He got in through a back door. A kid. He thinks it was a game."');
    term.print('BERINGER: "Son, you are in a world of trouble. Start talking."');
    term.print("");
    const c1 = await choose(term, [
      "Tell them the truth: you were looking for video games.",
      "Warn them the computer is still running the war.",
      "Say nothing.",
    ]);
    term.print("");
    if (c1 === 1) {
      term.print('"It\'s still playing," you say. "It won\'t stop until it thinks it\'s won."', "aside");
      state.suspicion = 1; // they half-believe you
    } else if (c1 === 0) {
      term.print("You explain about Protovision and the games. Nobody in the room laughs.", "aside");
      state.suspicion = 2;
    } else {
      term.print("You stare at the table. The silence does not help you.", "aside");
      state.suspicion = 3;
    }
    await term.pause(500);
    term.print(
      'MCKITTRICK: "The WOPR is a machine. It does what it is told. It is not playing anything."'
    );
    term.print("");
    await term.type(
      "Behind the glass, a counter is climbing. SIMULATIONS RUN: 1,214 . . . 1,215 . . . 1,216.",
      { cps: 45 }
    );
    term.print("It is still playing. And it is keeping score.", "aside");
    term.print("");
    await term.pause(700);
    term.setStatus({ defcon: 2, right: "NORAD WAR ROOM" });
    state.defcon = 2;
    saveState(state);
    if (typeof Sound !== "undefined") Sound.klaxon();
    caption(term, "KLAXON");
    await term.type("DEFCON 2.", { cps: 22 });
    term.print('BERINGER: "We didn\'t move it. Who moved it?"');
    term.print("It moved itself.", "aside");
    term.print("");
    const c2 = await choose(term, ["Demand to speak to whoever built it.", "Tell them about Falken."]);
    state.suspicion = Math.max(0, Math.min(4, state.suspicion + (c2 === 0 ? 1 : -1)));
    saveState(state);
    term.print("");
    term.print(
      'You say the name. McKittrick goes pale. "Falken is dead. Seven years."',
      "aside"
    );
    term.print(
      "But you read the obituary. It was his son. And the dead don't hide back doors named after their boys.",
      "aside"
    );
    term.print("");
    term.print(
      "They are not letting you go. McKittrick orders you held in the infirmary until the FBI arrives.",
      "aside"
    );
    term.print("");
    await term.pause(800);
    return "escape";
  },

  // The film's trick: the infirmary's electronic lock, and a door code
  // hiding in something you already know.
  async escape(ctx) {
    const { term, state } = ctx;
    term.setStatus({ defcon: 2, right: "NORAD INFIRMARY" });
    state.defcon = 2;
    term.pushHelp(
      "The keypad wants four digits: a month and a day. Joshua asked you about that date when you first logged on. Three wrong tries and you get out the hard way."
    );
    term.print("");
    await term.type("NORAD — INFIRMARY, ELECTRONIC LOCK", { cps: 30 });
    term.print("");
    term.print(
      "A keypad guards the door. Taped beside it, a maintenance card: 'CODE = THE OLD MAN'S LAST LOGIN, MMDD.'",
      "aside"
    );
    term.print(
      "The old man. Joshua asked you about an account removed on a date you've seen twice now.",
      "aside"
    );
    term.print("");
    let tries = 0;
    while (true) {
      const t = norm(await term.read("KEYPAD: ", { inputmode: "numeric" }));
      if (!t) continue;
      const digits = t.replace(/\D/g, "");
      if (digits === "0623" || digits === "623" || /june 23/.test(t)) {
        if (typeof Sound !== "undefined") Sound.beep();
        await term.type("LOCK RELEASED.", { cps: 40, cls: "dim" });
        term.print("");
        term.print(
          "The door clicks open. You fall in behind a tour group in matching windbreakers and walk out of the most secure facility on Earth.",
          "aside"
        );
        break;
      }
      tries += 1;
      if (typeof Sound !== "undefined") Sound.klaxon();
      caption(term, "ERROR BUZZER");
      await term.type("INCORRECT CODE.", { cps: 40, cls: "dim" });
      if (tries === 1) {
        term.print("Month and day. Four digits.", "aside");
      } else if (tries === 2) {
        term.print("6/23/73. The account Joshua asked you about. MMDD.", "aside");
      } else {
        term.print(
          "A medic badges the door open from the other side, and you slip out behind him. Less elegant. The guards will remember your face.",
          "aside"
        );
        state.suspicion = Math.min(4, state.suspicion + 1);
        saveState(state);
        break;
      }
    }
    term.print("");
    await term.pause(800);
    return "falken";
  },

  // Post-completion jump menu.
  async menu(ctx) {
    const { term, state } = ctx;
    term.clearStatus();
    term.pushHelp("Pick where to jump: click a line or type its number.");
    term.print("");
    await term.type("MENU — JUMP TO:");
    const pick = await choose(term, [
      "Full game from the beginning",
      "Connect to WOPR",
      "Global Thermonuclear War",
      "DEFCON 1 (the climax)",
    ]);
    term.print("");
    if (pick === 0) {
      restartStory(state);
      ctx.fresh = true;
      ctx.dialed = false;
      ctx.backdoorShown = false;
      return "intro";
    }
    if (pick === 1) {
      ctx.skipFraming = true;
      return "dial";
    }
    if (pick === 2) {
      ctx.skipFraming = true;
      ctx.autoGame = GTW;
      return "dial";
    }
    state.suspicion = state.suspicion == null ? 2 : state.suspicion;
    return "defcon1";
  },

  async falken(ctx) {
    const { term, state } = ctx;
    term.setStatus({ defcon: 2, right: "ANDERSON ISLAND" });
    state.defcon = 2;
    term.pushHelp("Pick the line you think will reach him: click it or type its number.");
    term.print("");
    await term.type("ANDERSON ISLAND, OFF THE OREGON COAST", { cps: 30 });
    term.print("");
    term.print(
      "You get out of the mountain. That's a story for another time. And you find him: Stephen Falken, very much alive, watching pelicans and waiting for the end of the world.",
      "aside"
    );
    term.print("");
    term.print(
      'FALKEN: "You came a long way to meet a man who quit. The dinosaurs didn\'t see it coming either. Nature knows when to start over."'
    );
    term.print("");
    await choose(term, [
      '"This isn\'t nature. It\'s a machine you built, and it\'s about to kill everyone."',
      '"Joshua is still playing your game. He just can\'t tell that this time it\'s real."',
      '"You named it after your son. Don\'t let this be the last thing he\'s remembered for."',
    ]);
    term.print("");
    term.print(
      "Falken watches the news: NORAD at DEFCON 2 and falling. A long silence.",
      "aside"
    );
    term.print(
      'FALKEN: "...He learned everything I taught him. Everything except futility." He grabs his coat. "Get me to that mountain."'
    );
    term.print("");
    await term.pause(800);
    return "defcon1";
  },

  // Act 5: the climax. The only winning move is not to play.
  async defcon1(ctx) {
    const { term, state } = ctx;
    term.clear();
    state.defcon = 1;
    saveState(state);
    term.setStatus({ defcon: 1, right: "CHEYENNE MOUNTAIN" });
    term.pushHelp(
      "The machine wants launch codes. Do not give it any. Tell it to play a game that nobody can win. Asking for help or changing a setting never costs time; anything else you type does."
    );
    if (typeof Sound !== "undefined") {
      Sound.klaxon();
      Sound.startMusic();
    }
    caption(term, "KLAXON. LOW PULSING MUSIC.");
    await term.type("CHEYENNE MOUNTAIN — DEFCON 1", { cps: 30 });
    term.print("");
    term.print(
      "The big board is a wall of fire. The WOPR is running every launch plan ever devised, hunting for the one that wins. The generals are reaching for their keys.",
      "aside"
    );
    term.print("");
    await blizzard(term);
    term.print("");
    vox("TIME TO PRIMARY GOAL: MINIMAL. LAUNCH CODES REQUIRED.");
    await term.type("W.O.P.R: TIME TO PRIMARY GOAL: MINIMAL. LAUNCH CODES REQUIRED.");
    term.print("");
    term.print('FALKEN: "You can\'t out-shoot it. Make it play a game that can\'t be won."', "aside");
    term.print('DAVID: "Have it play tic-tac-toe. Against itself."', "aside");
    term.print("Type what you want the machine to do.", "aside");
    term.print("");

    // How the interrogation went decides how much rope you get, and the
    // machine cracks the launch code on the status bar while you work.
    const budget = CrisisCore.budgetFor(state.suspicion);
    if (budget <= 5) {
      term.print(
        "(They don't trust you. The machine is further along than it should be.)",
        "aside"
      );
      term.print("");
    }
    const nudges = [
      'FALKEN: "Don\'t feed it codes. Teach it."',
      'DAVID: "Tic-tac-toe. Tell it to play ITSELF."',
      'FALKEN: "Type it: TIC-TAC-TOE. Now."',
      'DAVID: "TIC-TAC-TOE. Please, before they turn the keys."',
    ];

    while (true) {
      let ticks = 0;
      let outcome = null;
      while (outcome === null) {
        startClock(term, budget, ticks);
        // Once Falken has said it outright, the answer becomes a button.
        const input = await term.read("> ", { choices: ticks >= 3 ? [{ label: "TIC-TAC-TOE", cls: "go" }] : null });
        hush();
        const intent = CrisisCore.classifyClimax(input);
        if (intent === "teach") {
          outcome = "good";
          break;
        }
        if (intent === "launch") {
          ticks += 2;
          startClock(term, budget, ticks);
          vox("LAUNCH SEQUENCE ACCEPTED. THE GAME CONTINUES.");
          await term.type("W.O.P.R: LAUNCH SEQUENCE ACCEPTED. THE GAME CONTINUES.");
        } else {
          ticks += 1;
          startClock(term, budget, ticks);
          vox("THAT INPUT DOES NOT ADVANCE THE GAME.");
          await term.type("W.O.P.R: THAT INPUT DOES NOT ADVANCE THE GAME.");
        }
        if (ticks >= budget) {
          outcome = "bad";
          break;
        }
        term.print(nudges[Math.min(ticks, nudges.length) - 1], "aside");
      }
      stopClock();
      if (outcome === "good") {
        await goodEnding(term, state);
        return "epilogue";
      }
      await badEnding(term, state);
      term.clearFlash();
      term.print("");
      const seen = (state.endingsSeen || []).length;
      term.print(
        "(ENDING FOUND: " + CrisisCore.endingName("bad") + ". " + seen + " OF 3. This one does not have to stand.)",
        "aside"
      );
      term.print("");
      if (typeof Sound !== "undefined") Sound.startMusic();
      await term.type("SIMULATION RESET. THE MACHINE BEGINS AGAIN.", { cps: 30 });
      term.print('FALKEN: "Again. And this time, listen to the boy. Tic-tac-toe."', "aside");
      term.print("");
    }
  },

  // After the good or the quiet ending: hold on the last line, show what
  // was found and what is left, and let the player choose what is next.
  async epilogue(ctx) {
    const { term, state } = ctx;
    ctx.fresh = false;
    term.clearStatus();
    term.pushHelp(
      "The story is over. CHESS takes Joshua up on his offer, PLAY AGAIN starts the story over, MENU jumps to any act, SHARE saves a keepsake card. ENTER reconnects to the machine."
    );
    await term.pause(1600);
    showEndCard(term, state);
    term.print("");
    const chips = [
      { label: "A NICE GAME OF CHESS", value: "CHESS", cls: "go" },
      "PLAY AGAIN",
      "MENU",
      "SHARE",
      "STATS",
    ];
    while (true) {
      const t = norm(await term.read("> ", { choices: chips }));
      if (!t || t === "reconnect" || t === "logon" || t === "dial" || t === "redial") {
        term.print("");
        return "dial";
      }
      if (/\bchess\b|^(yes|sure|ok|okay|love to|why not)$/.test(t)) {
        ctx.autoGame = "CHESS";
        return "session";
      }
      if (/^(play again|again|restart|new game|start over)$/.test(t)) {
        restartStory(state);
        ctx.fresh = true;
        ctx.dialed = false;
        ctx.backdoorShown = false;
        term.clear();
        return "intro";
      }
      if (t === "menu") return "menu";
      term.print("CHESS, PLAY AGAIN, MENU, SHARE or STATS. ENTER reconnects to the machine.", "aside");
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

async function doResearch(term, state, topic, ctx) {
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
  if (ctx && art.id === "falken") ctx.readFalken = true;
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

// Present numbered options and return the chosen zero-based index. The
// lines themselves are clickable; typing the number works too.
async function choose(term, options) {
  for (let i = 0; i < options.length; i++) {
    term.link("  " + (i + 1) + ". " + options[i], String(i + 1));
  }
  term.print("");
  while (true) {
    const t = norm(await term.read("CHOOSE: ", { inputmode: "numeric" }));
    const n = parseInt(t, 10);
    if (n >= 1 && n <= options.length) return n - 1;
    await term.type("PLEASE CHOOSE 1-" + options.length + ".");
    for (let i = 0; i < options.length; i++) {
      term.link("  " + (i + 1) + ". " + options[i], String(i + 1));
    }
  }
}

// The DEFCON 1 clock. Turns decide the outcome; between inputs the
// display counts down in real time through the current turn's band and
// then holds, so the pressure is on screen but waiting costs nothing.
let clockTimer = null;

function stopClock() {
  if (clockTimer) {
    clearInterval(clockTimer);
    clockTimer = null;
  }
}

function startClock(term, budget, ticks) {
  stopClock();
  const band = CrisisCore.clockBand(budget, ticks);
  let secs = band.top;
  const show = () =>
    term.setStatus({
      defcon: 1,
      right: "CODE " + CrisisCore.revealedCode(ticks, budget) + "   T-MINUS " + CrisisCore.clock(secs),
    });
  show();
  if (band.top <= band.floor) return;
  clockTimer = setInterval(() => {
    if (term.held || secs <= band.floor) return;
    secs -= 1;
    show();
  }, 1000);
}

// The big board saturates as WOPR runs every plan at once.
async function blizzard(term) {
  const all = [...GTWCore.TARGETS_US, ...GTWCore.TARGETS_USSR];
  const sites = [...GTWCore.SITES_US, ...GTWCore.SITES_USSR];
  // Every plan at once: a dense fan of tracks crossing the whole board.
  const missiles = GTWCore.fanMissiles(sites, all, 40);
  await runVolley(term, ["SIMULATION RUNNING — ALL SCENARIOS"], missiles);
}

// WOPR plays itself at tic-tac-toe, faster and faster, always a draw.
async function selfPlaySpectacle(term) {
  term.print("");
  vox("LEARNING. TIC TAC TOE. PLAYER VERSUS PLAYER.");
  await term.type("W.O.P.R: LEARNING. TIC-TAC-TOE. PLAYER VS. PLAYER.", { cps: 36 });
  term.resetSkip();
  if (typeof Modern !== "undefined" && Modern.isModern()) {
    const games = Array.from({ length: 14 }, () => TTTCore.selfPlayGame());
    const montage = Modern.renderTTTMontage(term, games);
    if (montage) {
      await montage;
      term.print("");
      await term.pause(500);
      return;
    }
  }
  const boardFrame = term.frame("board");
  const tally = term.frame("");
  let delay = 360;
  for (let i = 1; i <= 12; i++) {
    const game = TTTCore.selfPlayGame();
    const board = Array(9).fill(null);
    let turn = "X";
    for (const m of game.moves) {
      board[m] = turn;
      turn = turn === "X" ? "O" : "X";
    }
    boardFrame.set(TTTCore.renderBoard(board));
    tally.set("GAME " + i + "    WINNER: NONE");
    if (term.skip) break;
    await term.pause(delay);
    delay = Math.max(70, delay - 26);
  }
  tally.set("GAMES PLAYED: 247,309    WINNER: NONE");
  await term.pause(500);
}

// It extrapolates the same lesson to every nuclear war plan.
async function scenarioFlood(term) {
  term.print("");
  vox("EXTRAPOLATING TO GLOBAL THERMONUCLEAR WAR");
  await term.type("W.O.P.R: EXTRAPOLATING TO: GLOBAL THERMONUCLEAR WAR", { cps: 36 });
  term.resetSkip();
  const line = term.frame("");
  let delay = 220;
  for (const s of CrisisCore.SCENARIOS) {
    line.set(("SIMULATING: " + s).padEnd(42) + "WINNER: NONE");
    if (term.skip) break;
    await term.pause(delay);
    delay = Math.max(45, delay - 12);
  }
  line.set("SCENARIOS RUN: 1,048,576    WINNERS: 0");
  await term.pause(600);
}

function recordEnding(state, id) {
  state.ending = id;
  if (!(state.endingsSeen || []).includes(id)) {
    state.endingsSeen = [...(state.endingsSeen || []), id];
  }
}

async function goodEnding(term, state) {
  if (typeof Sound !== "undefined") Sound.stopMusic();
  await selfPlaySpectacle(term);
  await scenarioFlood(term);
  term.print("");
  await term.pause(500);
  for (let d = 2; d <= 5; d++) {
    state.defcon = d;
    term.setStatus({ defcon: d, right: "STAND DOWN" });
    await term.pause(450);
  }
  term.print("");
  // The payoff types out at its own pace even if the player skipped the
  // spectacle before it.
  term.resetSkip();
  for (const line of CrisisCore.CLOSING_LINES) {
    if (line === "") {
      term.print("");
    } else {
      vox(line);
      await term.type(line, { cps: 13 });
    }
    await term.pause(550);
  }
  recordEnding(state, "good");
  state.crisisResolved = true;
  state.scene = null;
  state.defcon = 5;
  saveState(state);
  // Let the last line sit before anything else arrives.
  await term.pause(2600);
  term.print("");
  term.clearStatus();
  term.print(
    "(The keys go back in the generals' pockets. Falken offers you a ride home. You think you'll stick to checkers.)",
    "aside"
  );
}

async function badEnding(term, state) {
  if (typeof Sound !== "undefined") Sound.stopMusic();
  term.print("");
  for (const line of CrisisCore.BAD_ENDING) {
    if (line === "") {
      term.print("");
    } else {
      vox(line);
      await term.type(line, { cps: 18 });
    }
    await term.pause(320);
  }
  await term.pause(300);
  await term.whiteout();
  await term.pause(2600);
  recordEnding(state, "bad");
  saveState(state);
}

// Reached by refusing to launch in Act 3 and saying why. The crisis
// never ignites; the lesson is learned the short way.
async function secretEnding(term, state) {
  term.print("");
  term.print("(Joshua is quiet for a long moment.)", "aside");
  term.print("");
  term.resetSkip();
  for (const line of CrisisCore.SECRET_ENDING) {
    vox(line);
    await term.type(line, { cps: 15 });
    await term.pause(550);
  }
  term.print("");
  vox("HOW ABOUT A NICE GAME OF CHESS?");
  await term.type("HOW ABOUT A NICE GAME OF CHESS?", { cps: 16 });
  recordEnding(state, "secret");
  state.crisisResolved = true;
  state.scene = null;
  saveState(state);
  await term.pause(2600);
  term.print("");
  term.print(
    "(You never start the war. The screens under the mountain stay dark, and nobody ever learns how close the box came to deciding it liked the game.)",
    "aside"
  );
}

// The end card: which ending this was, which are still out there, and
// the record so far.
function showEndCard(term, state) {
  const seen = state.endingsSeen || [];
  const card = term.block("endcard");
  const add = (cls, text) => {
    const d = document.createElement("div");
    d.className = cls;
    d.textContent = text;
    card.appendChild(d);
    return d;
  };
  add("ec-head", "ENDING " + seen.length + " OF 3");
  add("ec-name", CrisisCore.endingName(state.ending));
  for (const id of CrisisCore.ENDING_ORDER) {
    const meta = CrisisCore.ENDINGS[id];
    const found = seen.includes(id);
    const row = add("ec-row " + (found ? "found" : "locked"), "");
    const box = document.createElement("span");
    box.className = "box";
    box.textContent = found ? "[X]" : "[ ]";
    const text = document.createElement("span");
    text.textContent = found ? meta.name + ". " + meta.found : "? ? ?  " + meta.hint;
    row.appendChild(box);
    row.appendChild(text);
  }
  const stats = add("ec-stats", "");
  for (const text of [
    "WARS STARTED: " + (state.gtwRuns || 0),
    "GAMES PLAYED: " + ((state.gamesPlayed || 0) + (state.tttGames || 0)),
    "LAUNCHES REFUSED: " + (state.refusedLaunch ? "YES" : "NO"),
  ]) {
    const span = document.createElement("span");
    span.textContent = text;
    stats.appendChild(span);
  }
  term._announce(
    "ENDING " + seen.length + " OF 3: " + CrisisCore.endingName(state.ending) + "."
  );
  term.settle();
}

// Keep the monitor inside the visible area when a touch keyboard opens
// on browsers that overlay it instead of resizing the page.
function fitViewport(term) {
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  if (!vv || !term.coarse || !term.crt) return;
  const apply = () => {
    document.documentElement.style.setProperty("--app-h", Math.round(vv.height) + "px");
    term.crt.style.transform = vv.offsetTop ? "translateY(" + Math.round(vv.offsetTop) + "px)" : "";
    term.settle();
  };
  vv.addEventListener("resize", apply);
  vv.addEventListener("scroll", apply);
  apply();
}

(async function main() {
  const term = new Terminal({
    screen: document.getElementById("screen"),
    input: document.getElementById("kbd"),
    live: document.getElementById("sr-live"),
    status: document.getElementById("status"),
    flash: document.getElementById("flash"),
    crt: document.getElementById("crt"),
    choices: document.getElementById("choices"),
    more: document.getElementById("more"),
  });
  const state = loadState();
  UI.init(term);
  fitViewport(term);
  term.onCommand = (raw) => handleGlobalCommand(term, raw, state);
  const ctx = {
    term,
    state,
    dialed: false,
    // Crisis scenes are checkpoints: a reload returns to the latest one.
    onScene(name) {
      if (CHECKPOINTS.includes(name) && !state.crisisResolved) {
        state.scene = name;
        saveState(state);
      }
    },
  };
  console.log(
    "%cGREETINGS.",
    "color:#3aff6e;background:#000;font-size:14px;font-family:monospace;padding:4px 8px;"
  );
  console.log("Stuck at LOGON? Falken had a son. Or just type SKIP at the start.");
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    // When a new version takes over while the title is still up, reload
    // once so this visit runs the new build rather than the next one.
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (hadController && !ctx.poweredOn) window.location.reload();
    });
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  await runScenes(scenes, "boot", ctx);
})();
