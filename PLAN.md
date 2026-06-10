# WarGames: The Interactive Game (Build Plan)

An interactive recreation of the 1983 film *WarGames*. The player takes the role of David Lightman, stumbles into WOPR, accidentally starts Global Thermonuclear War, and must teach the machine that the only winning move is not to play.

---

## 1. Game Concept

A narrative terminal simulation. The entire game is played through a retro green-phosphor CRT terminal, exactly like David's IMSAI 8080 setup in the film. The player types commands, dials phone numbers, guesses passwords, and plays games against WOPR (who calls itself "Joshua").

The game follows the film's arc in five acts:

| Act | Title | Player experience |
|-----|-------|-------------------|
| 1 | War Dialing | Scan phone numbers in Sunnyvale looking for Protovision. Most numbers are flavor (airlines, banks, a dentist's answering machine). One connects to an unmarked system. |
| 2 | The Backdoor | The system refuses entry. The player researches Stephen Falken through an in-game library/archive interface, learns about his son, and discovers the password: `joshua`. |
| 3 | Shall We Play A Game? | Full access to WOPR's game list. Chess, checkers, tic-tac-toe, poker, and the playable minigames actually work. Then the player selects GLOBAL THERMONUCLEAR WAR, picks a side, and chooses first-strike targets. |
| 4 | DEFCON | The simulation turns real. News tickers, NORAD alerts, and a DEFCON tracker escalate from 5 toward 1. The player is traced, confronted, and must get back into the system. Timed pressure, branching dialogue with McKittrick and General Beringer, and the trip to find Falken. |
| 5 | The Only Winning Move | At DEFCON 1, the player must get Joshua to play tic-tac-toe against itself. The screen floods with auto-played games, every one a draw. Joshua extrapolates to nuclear war, cycles through launch scenarios, and concludes: "WINNER: NONE." Ends with the famous line and an offer of a nice game of chess. |

### Failure states and endings
- **Bad ending**: time runs out at DEFCON 1 before Joshua learns futility. Screen whites out.
- **Good ending**: the canonical film ending.
- **Secret ending**: the player refuses to ever launch in Act 3 ("the only winning move is not to play" achieved early). Short alternate epilogue.

---

## 2. Technology Choice

**Recommended: browser-based, vanilla HTML/CSS/JavaScript, zero dependencies, zero build step.**

Reasons:
- Anyone can play it from a link. GitHub Pages hosts it for free straight from this repo.
- A CRT terminal is trivially achievable with CSS (scanlines, phosphor glow, flicker) and a monospace font.
- Typewriter text output and keyboard input are native browser capabilities.
- No toolchain to maintain. `index.html` + a handful of JS modules.

Alternative considered: a Python CLI with `curses`. Rejected as primary because it requires an install and a real terminal, which kills shareability. The architecture below would port to it cleanly if wanted later.

---

## 3. Architecture

```
/
├── index.html              Single page, boots the terminal
├── css/
│   └── crt.css             Phosphor green theme, scanlines, glow, cursor blink
├── js/
│   ├── terminal.js         Output queue, typewriter effect, input line, command history
│   ├── engine.js           Scene/state machine, save-load (localStorage)
│   ├── parser.js           Command parsing (DIAL, CONNECT, LIST GAMES, HELP, etc.)
│   ├── scenes/
│   │   ├── act1_wardial.js
│   │   ├── act2_backdoor.js
│   │   ├── act3_games.js
│   │   ├── act4_defcon.js
│   │   └── act5_endgame.js
│   ├── games/
│   │   ├── tictactoe.js    Playable + self-play mode (minimax, always draws)
│   │   ├── checkers.js     Simple playable AI
│   │   ├── chess.js        Stretch goal; stub with "LATER, PERHAPS" otherwise
│   │   └── gtw.js          Global Thermonuclear War: side select, target select, sim
│   ├── wopr.js             Joshua's dialogue engine and personality
│   └── sound.js            Optional: modem handshake, keyclicks, alert klaxon (WebAudio)
└── assets/
    └── (fonts, audio)
```

### Core systems

**Terminal (`terminal.js`)**
- Character-by-character typewriter output with adjustable speed (and a skip key).
- Blocking input prompt; uppercase echo like the film.
- Scrollback buffer capped for performance.

**Engine (`engine.js`)**
- A scene stack: each scene registers the commands it understands and a `narrate()` entry point.
- Global state object: `{ act, defcon, suspicion, knowsJoshua, side, targets[], timers }`.
- Autosave to `localStorage` on scene transitions.

**Parser (`parser.js`)**
- Verb-first commands, forgiving matching (`DIAL 311-399-0001`, `HELP GAMES`, `LIST`).
- Context-sensitive: the same input means different things on the school computer vs. inside WOPR.

**Joshua (`wopr.js`)**
- Scripted dialogue trees keyed to game state, written in the machine's flat affect.
- A small set of dynamic responses (greets the player by name once learned, references prior choices: "YOU CHOSE THE SOVIET UNION LAST TIME").

**Tic-tac-toe self-play (the climax, `tictactoe.js`)**
- Minimax engine that can play both sides.
- Climax sequence: render games at accelerating speed, board after board, with a running tally `GAMES PLAYED: n / WINNER: NONE`, then dissolve into launch-scenario names from the film (FIRST STRIKE, SUDDEN COUNTERATTACK, SEATO DECAPITATING...) each stamped WINNER: NONE.

**DEFCON tracker (Act 4-5)**
- Persistent status line at the top of the screen once the crisis starts.
- Escalation driven by elapsed time and player missteps; de-escalation only via the Act 5 solution.

---

## 4. Milestones

### M1: Terminal foundation (the toy that proves the feel) [SHIPPED]
- `index.html`, CRT styling, typewriter output, input handling.
- Boot sequence: `LOGON:` prompt, the iconic `SHALL WE PLAY A GAME?` exchange hardcoded.
- **Done when**: typing `HELLO` gets a Joshua response and it *feels* like the movie.

### M2: Engine + Act 3 core loop [SHIPPED]
- Scene machine, parser, save/load.
- Game list, playable tic-tac-toe vs. Joshua, GTW side/target selection, NORAD big-board ASCII map reacting to launches.
- **Done when**: a player can log in, start GTW as the USSR, and watch missile tracks render.

### M3: Acts 1-2 (the setup) [SHIPPED]
- War-dial minigame with a generated number pool and flavor responses.
- Falken research puzzle (in-game archive articles, obituary, the `joshua` discovery), tuned easy: two or three steps, clues clearly surfaced, no red herrings that block progress.
- `SKIP` command offered at boot, jumping straight to the WOPR connection (Acts 1-2 are optional even on a first play; the logon hint ladder covers skippers).
- **Done when**: a new player can reach WOPR with no out-of-game knowledge.

### M4: Acts 4-5 (the crisis and climax) [SHIPPED]
- DEFCON tracker, FBI trace events, McKittrick/Beringer dialogue, Falken island scene (rendered as narrative interludes between terminal sessions).
- Tic-tac-toe self-play spectacle, scenario flood, ending sequence with all three endings.
- **Done when**: the game is completable start to finish.

### M5: Polish and ship [SHIPPED]
- Sound on by default (modem handshake on connect, klaxon at DEFCON 2) with a `SOUND OFF` opt-out persisted in localStorage.
- Skip/fast-forward for replays, accessibility pass (reduced-motion mode disables flicker, full keyboard play, screen-reader-friendly output region).
- GitHub Pages deployment, README rewrite with screenshots and a play link.
- **Done when**: the link is public and a stranger can finish the game.

---

### M6: Modern mode (post-ship, by request)
- A modern presentation layer over the same game logic. Canvas-rendered big board: glowing dot-matrix world map, smooth bezier missile arcs with comet heads, expanding impact rings, live track counters.
- Sound v2: launch whoosh, impact boom, war-room ambience during volleys.
- `MODE MODERN` (default) / `MODE CLASSIC` toggle, persisted. ASCII board remains the fallback wherever canvas is unavailable and under reduced motion the final frame renders without animation.
- **Done when**: a volley renders as animated vector arcs with audio, and CLASSIC still gives the original board.

## 5. Stretch Goals
- Playable chess and checkers with real (weak) AIs.
- Speech synthesis for Joshua's lines (WebSpeech API, heavily filtered).
- A `MENU` cheat after first completion: jump to any act, play any minigame directly.
- Two-player hotseat Global Thermonuclear War (both sides human, nobody wins anyway).

---

## 6. Out of Scope
- Frameworks, bundlers, or a backend. Everything runs client-side.
- Graphics beyond ASCII/Unicode art and CSS. The terminal is the aesthetic.
- Verbatim film dialogue beyond short iconic lines; scenes are adapted, not transcribed.

---

## 7. Decisions

Resolved 2026-06-10:

1. **Acts 1-2 are skippable, including on a first play.** A `SKIP` command at boot jumps straight to the WOPR connection. The escalating logon hints already shipped in M1 stay, so skippers can still find the password without out-of-game knowledge.
2. **Sound is on by default, with an opt-out.** `SOUND OFF` / `SOUND ON` commands, preference persisted in localStorage. Browsers block audio until the first user gesture, so the modem handshake starts on the first keypress or tap rather than at page load.
3. **The Falken research puzzle is easy.** Two or three steps with clues clearly surfaced: search the archive, the Falken article points to the obituary, the obituary names Joshua. The aside hints remain as a safety net.
