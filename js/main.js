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

// Sound captions for deaf players: CAPTIONS ON prints a dim label when a
// non-speech cue fires. Off by default; persisted.
let captionsOn = false;
try {
  if (typeof localStorage !== "undefined") {
    captionsOn = localStorage.getItem("wargames-captions") === "on";
  }
} catch (e) {
  /* storage blocked */
}

function caption(term, label) {
  if (captionsOn) term.print("[ SOUND: " + label + " ]", "dim");
}

function setCaptions(on) {
  captionsOn = !!on;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("wargames-captions", captionsOn ? "on" : "off");
    }
  } catch (e) {
    /* storage blocked */
  }
}

async function connectTone(term) {
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
  "- Type commands and press Enter. When stuck, read the amber notes: they are your own thoughts, and they nudge you forward.",
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

// SOUND, VOICE, MODE, FAST, CAPTIONS, and STATS work at any prompt.
// Returns true if it handled the input. `state` is optional (STATS only).
async function handleGlobalCommand(term, t, state) {
  if (t === "story" || t === "about" || t === "briefing" || t === "intro") {
    await showStory(term);
    return true;
  }
  if (t === "captions on") {
    setCaptions(true);
    await term.type("CAPTIONS ON.");
    return true;
  }
  if (t === "captions off") {
    setCaptions(false);
    await term.type("CAPTIONS OFF.");
    return true;
  }
  if (t === "captions") {
    await term.type("CAPTIONS ARE " + (captionsOn ? "ON" : "OFF") + ". TYPE CAPTIONS ON OR CAPTIONS OFF.");
    return true;
  }
  if ((t === "stats" || t === "score") && state) {
    const endings = (state.endingsSeen || []).length;
    const lines = [
      "GAMES PLAYED: " + ((state.gamesPlayed || 0) + (state.tttGames || 0)) + ".",
      "TIC-TAC-TOE: " + (state.tttGames || 0) + " GAMES, " + (state.tttDraws || 0) + " TIES.",
      "WARS STARTED: " + (state.gtwRuns || 0) + ". LAUNCHES REFUSED: " + (state.refusedLaunch ? "YES" : "NO") + ".",
      "ENDINGS WITNESSED: " + endings + " OF 3" + (endings ? " (" + state.endingsSeen.join(", ").toUpperCase() + ")" : "") + ".",
    ];
    for (const line of lines) {
      vox(line);
      await term.type(line);
    }
    return true;
  }
  if (t === "sound off" || t === "mute") {
    if (typeof Sound !== "undefined") Sound.setEnabled(false);
    await term.type("SOUND OFF.");
    return true;
  }
  if (t === "sound on" || t === "unmute") {
    if (typeof Sound !== "undefined") Sound.setEnabled(true);
    await term.type("SOUND ON.");
    return true;
  }
  if (t === "sound") {
    const on = typeof Sound !== "undefined" && Sound.isEnabled();
    await term.type("SOUND IS " + (on ? "ON" : "OFF") + ". TYPE SOUND OFF OR SOUND ON.");
    return true;
  }
  if (t === "voice off") {
    if (typeof Sound !== "undefined") Sound.setVoice(false);
    await term.type("VOICE OFF.");
    return true;
  }
  if (t === "voice on") {
    if (typeof Sound !== "undefined") Sound.setVoice(true);
    await term.type("VOICE ON.");
    vox("VOICE ENABLED, PROFESSOR.");
    return true;
  }
  if (t === "voice") {
    const on = typeof Sound !== "undefined" && Sound.isVoiceOn();
    await term.type("VOICE IS " + (on ? "ON" : "OFF") + ". TYPE VOICE OFF OR VOICE ON.");
    return true;
  }
  if (t === "mode modern" || t === "modern") {
    if (typeof Modern !== "undefined") Modern.setMode("modern");
    await term.type("DISPLAY MODE: MODERN.");
    return true;
  }
  if (t === "mode classic" || t === "classic") {
    if (typeof Modern !== "undefined") Modern.setMode("classic");
    await term.type("DISPLAY MODE: CLASSIC.");
    return true;
  }
  if (t === "mode") {
    const m = typeof Modern !== "undefined" && Modern.isModern() ? "MODERN" : "CLASSIC";
    await term.type("DISPLAY MODE IS " + m + ". TYPE MODE MODERN OR MODE CLASSIC.");
    return true;
  }
  if (t === "view polar" || t === "polar") {
    if (typeof Modern !== "undefined") Modern.setView("polar");
    await term.type("BOARD VIEW: POLAR. THE SHORTEST PATH CROSSES THE ARCTIC.");
    return true;
  }
  if (t === "view flat") {
    if (typeof Modern !== "undefined") Modern.setView("flat");
    await term.type("BOARD VIEW: FLAT.");
    return true;
  }
  if (t === "view") {
    const v = typeof Modern !== "undefined" ? Modern.getView().toUpperCase() : "FLAT";
    await term.type("BOARD VIEW IS " + v + ". TYPE VIEW FLAT OR VIEW POLAR.");
    return true;
  }
  if (/^difficulty (easy|normal|hard)$/.test(t)) {
    const d = setDifficulty(t.split(" ")[1]);
    await term.type("DIFFICULTY: " + d.toUpperCase() + ".");
    return true;
  }
  if (t === "difficulty") {
    await term.type(
      "DIFFICULTY IS " + getDifficulty().toUpperCase() + ". TYPE DIFFICULTY EASY, NORMAL OR HARD."
    );
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
  if (t === "fast") {
    term.fast = true;
    saveFast(true);
    await term.type("FAST TEXT ON.");
    return true;
  }
  if (t === "slow") {
    term.fast = false;
    saveFast(false);
    await term.type("FAST TEXT OFF.");
    return true;
  }
  return false;
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

function saveFast(on) {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem("wargames-fast", on ? "1" : "0");
  } catch (e) {
    /* storage blocked */
  }
}

function loadFast() {
  try {
    if (typeof localStorage !== "undefined") return localStorage.getItem("wargames-fast") === "1";
  } catch (e) {
    /* storage blocked */
  }
  return false;
}

const scenes = {
  async boot(ctx) {
    const { term, state } = ctx;
    for (const row of TITLE) term.print(row, "title");
    term.print("");
    // Browsers keep audio muted until the first interaction, so gate the
    // boot behind a keypress and use it to unlock and confirm sound.
    term.print("[ PRESS ENTER TO POWER ON ]", "aside");
    await term.read("");
    if (typeof Sound !== "undefined") {
      Sound.unlock();
      Sound.powerOn();
    }
    term.print("");
    await term.pause(900);

    // A returning player who already found WOPR skips the search; one who
    // has finished the story also unlocks the MENU jump.
    if (state.metWopr) {
      term.print("(Welcome back. Reconnecting to the last system.)", "aside");
      if (state.ending) {
        term.print("(You have finished the story. Type MENU to jump anywhere, or press ENTER to reconnect.)", "aside");
        term.print("");
        while (true) {
          const t = norm(await term.read("> "));
          if (await handleGlobalCommand(term, t, state)) continue;
          if (t === "menu") return "menu";
          break;
        }
      }
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
    term.print("Never seen the film? Type STORY for a one-minute briefing. No spoilers.", "aside");
    term.print("Sound and Joshua's voice are on (SOUND OFF / VOICE OFF to silence). Type FAST to speed up text.", "aside");
    term.print("");

    while (true) {
      const t = norm(await term.read("> "));
      if (await handleGlobalCommand(term, t, ctx.state)) continue;
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
      if (typeof Sound !== "undefined") Sound.tick();
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
      if (await handleGlobalCommand(term, t, state)) continue;
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
    vox("GREETINGS PROFESSOR FALKEN.");
    await term.type("GREETINGS PROFESSOR FALKEN.", { cps: 22 });
    if (ctx.autoGTW) {
      ctx.autoGTW = false;
      vox("RESUMING: GLOBAL THERMONUCLEAR WAR.");
      await term.type("RESUMING: GLOBAL THERMONUCLEAR WAR.");
      const result = await playGTW(term, state);
      saveState(state);
      if (result.secret) {
        await secretEnding(term, state);
        return "dial";
      }
      if (result.completed) {
        return state.crisisResolved ? "dial" : "crisis";
      }
      term.print("");
      vox("SHALL WE PLAY A DIFFERENT GAME?");
      await term.type("SHALL WE PLAY A DIFFERENT GAME?");
      joshua.pending = "play";
    } else if (joshua.returning) {
      const back = "YOU CHOSE THE " + state.lastSide + " LAST TIME. THE SIMULATION REMAINS UNFINISHED.";
      vox(back);
      await term.type(back);
      term.print("");
      vox("SHALL WE PLAY AGAIN?");
      await term.type("SHALL WE PLAY AGAIN?");
    }
    while (true) {
      const value = await term.read("> ");
      hush();
      if (await handleGlobalCommand(term, norm(value), state)) continue;
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
          if (op.game === GTW) {
            const result = await playGTW(term, state);
            saveState(state);
            if (result.secret) {
              await secretEnding(term, state);
              return "dial";
            }
            if (result.completed) {
              return state.crisisResolved ? "dial" : "crisis";
            }
          } else {
            const table = {
              "TIC-TAC-TOE": playTicTacToe,
              CHESS: playChess,
              CHECKERS: playCheckers,
              "BLACK JACK": playBlackjack,
              POKER: playPoker,
              "FALKEN'S MAZE": playMaze,
            };
            await table[op.game](term, state);
            saveState(state);
          }
          term.print("");
          await term.type("SHALL WE PLAY A DIFFERENT GAME?");
          joshua.pending = "play";
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

  // Act 4: the morning after. WOPR never stopped running David's game.
  async crisis(ctx) {
    const { term, state } = ctx;
    state.defcon = 4;
    saveState(state);
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
      const t = norm(await term.read("KEYPAD: "));
      if (await handleGlobalCommand(term, t, state)) continue;
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
    term.print("");
    await term.type("MENU — JUMP TO:");
    const pick = await choose(term, [
      "Full game from the title",
      "Connect to WOPR",
      "Global Thermonuclear War",
      "DEFCON 1 (the climax)",
    ]);
    term.print("");
    if (pick === 0) {
      ctx.dialed = false;
      return "wardial";
    }
    if (pick === 1) {
      ctx.skipFraming = true;
      return "dial";
    }
    if (pick === 2) {
      ctx.skipFraming = true;
      ctx.autoGTW = true;
      return "dial";
    }
    state.suspicion = state.suspicion == null ? 2 : state.suspicion;
    return "defcon1";
  },

  async falken(ctx) {
    const { term } = ctx;
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
      setTimer(term, budget, ticks);
      let outcome = null;
      while (outcome === null) {
        const input = await term.read("> ");
        const intent = CrisisCore.classifyClimax(input);
        if (intent === "teach") {
          outcome = "good";
          break;
        }
        if (intent === "launch") {
          ticks += 2;
          vox("LAUNCH SEQUENCE ACCEPTED. THE GAME CONTINUES.");
          await term.type("W.O.P.R: LAUNCH SEQUENCE ACCEPTED. THE GAME CONTINUES.");
        } else {
          ticks += 1;
          vox("THAT INPUT DOES NOT ADVANCE THE GAME.");
          await term.type("W.O.P.R: THAT INPUT DOES NOT ADVANCE THE GAME.");
        }
        setTimer(term, budget, ticks);
        if (ticks >= budget) {
          outcome = "bad";
          break;
        }
        term.print(nudges[Math.min(ticks, nudges.length) - 1], "aside");
      }
      if (outcome === "good") {
        await goodEnding(term, state);
        return "dial";
      }
      await badEnding(term, state);
      term.clearFlash();
      term.print("");
      if (typeof Sound !== "undefined") Sound.startMusic();
      await term.type("SIMULATION RESET. THE MACHINE BEGINS AGAIN.", { cps: 30 });
      term.print('FALKEN: "Again. And this time, listen to the boy. Tic-tac-toe."', "aside");
      term.print("");
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

// Present numbered options and return the chosen zero-based index.
async function choose(term, options) {
  for (let i = 0; i < options.length; i++) {
    await term.type("  " + (i + 1) + ". " + options[i], { cps: 150 });
  }
  term.print("");
  while (true) {
    const t = norm(await term.read("CHOOSE: "));
    const n = parseInt(t, 10);
    if (n >= 1 && n <= options.length) return n - 1;
    await term.type("PLEASE CHOOSE 1-" + options.length + ".");
  }
}

function setTimer(term, budget, ticks) {
  const remaining = Math.max(0, budget - ticks);
  const secs = remaining * 47;
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  term.setStatus({
    defcon: 1,
    right: "CODE " + CrisisCore.revealedCode(ticks, budget) + "   T-MINUS " + mm + ":" + ss,
  });
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
  for (const line of CrisisCore.CLOSING_LINES) {
    if (line === "") {
      term.print("");
    } else {
      vox(line);
      await term.type(line, { cps: 13 });
    }
    await term.pause(550);
  }
  term.print("");
  term.clearStatus();
  state.ending = "good";
  if (!(state.endingsSeen || []).includes("good")) {
    state.endingsSeen = [...(state.endingsSeen || []), "good"];
  }
  state.crisisResolved = true;
  state.defcon = 5;
  saveState(state);
  term.print(
    "(The keys go back in the generals' pockets. Falken offers you a ride home. You think you'll stick to checkers.)",
    "aside"
  );
  term.print("(Type SHARE for a keepsake card. STATS for your record.)", "aside");
  term.print("");
  await term.pause(900);
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
  state.ending = "bad";
  if (!(state.endingsSeen || []).includes("bad")) {
    state.endingsSeen = [...(state.endingsSeen || []), "bad"];
  }
  saveState(state);
}

// Reached by refusing to launch in Act 3 and saying why. The crisis
// never ignites; the lesson is learned the short way.
async function secretEnding(term, state) {
  term.print("");
  term.print("(Joshua is quiet for a long moment.)", "aside");
  term.print("");
  for (const line of CrisisCore.SECRET_ENDING) {
    vox(line);
    await term.type(line, { cps: 15 });
    await term.pause(550);
  }
  term.print("");
  vox("HOW ABOUT A NICE GAME OF CHESS?");
  await term.type("HOW ABOUT A NICE GAME OF CHESS?", { cps: 16 });
  term.print("");
  term.print(
    "(You never start the war. The screens under the mountain stay dark, and nobody ever learns how close the box came to deciding it liked the game.)",
    "aside"
  );
  state.ending = "secret";
  if (!(state.endingsSeen || []).includes("secret")) {
    state.endingsSeen = [...(state.endingsSeen || []), "secret"];
  }
  state.crisisResolved = true;
  saveState(state);
  await term.pause(900);
  term.print("");
}

(async function main() {
  const term = new Terminal({
    screen: document.getElementById("screen"),
    input: document.getElementById("kbd"),
    live: document.getElementById("sr-live"),
    status: document.getElementById("status"),
    flash: document.getElementById("flash"),
    crt: document.getElementById("crt"),
  });
  term.fast = loadFast();
  const state = loadState();
  console.log(
    "%cGREETINGS.",
    "color:#3aff6e;background:#000;font-size:14px;font-family:monospace;padding:4px 8px;"
  );
  console.log("Stuck at LOGON? Falken had a son. Or just type SKIP at the start.");
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  await runScenes(scenes, "boot", { term, state, dialed: false });
})();
