# WarGames: Shall We Play A Game?

An interactive recreation of the 1983 film *WarGames*, played entirely in a retro green-phosphor CRT terminal in your browser. You are David Lightman: a bored teenager with a modem who dials into the wrong computer and nearly starts World War III. The only way out is to teach the machine the lesson it was never given.

**▶ Play: https://azjester.github.io/wargames-/**

<p align="center">
  <img src="assets/title.svg" alt="WarGames title screen" width="49%">
  <img src="assets/ending.svg" alt="The only winning move is not to play" width="49%">
</p>

## Run it yourself

No build, no install, no dependencies. Open `index.html` in any modern browser, or serve the folder:

```sh
git clone https://github.com/AzJester/WarGames-.git
cd WarGames-
python3 -m http.server 8000
# then visit http://localhost:8000
```

## How it plays

1. **War dialing.** `SCAN` the Sunnyvale exchange. Most numbers are banks, an airline, a dentist's machine; Protovision's line is dead. One answers with a carrier and no name. `DIAL` it.
2. **The backdoor.** The system is locked, and its games have odd names (FALKEN'S MAZE). `RESEARCH FALKEN`, follow the trail to his son, and log on as `JOSHUA`.
3. **The games.** Tic-tac-toe against a Joshua who plays perfectly. Global Thermonuclear War: pick a side, list targets by city and/or country, confirm, and watch the big board.
4. **The crisis.** Play the war to the end and the machine doesn't stop. The FBI, NORAD, a DEFCON tracker counting down from 5, and a flight to find Falken. At DEFCON 1, teach Joshua the only lesson he's missing: type `TIC-TAC-TOE` and make it play itself.

Three endings, including a quiet one for the player who refuses to launch and can say why. Impatient? `SKIP` the first two acts at the title screen; the logon hints still guide you in.

## Controls

- Type and press Enter. Any key or tap skips the typewriter (and the animations).
- Up/Down arrows recall input history. Escape clears the line.
- `SOUND OFF` / `SOUND ON` toggle audio (on by default). `FAST` / `SLOW` change text speed.
- `SKIP` at the title jumps to the system. `RESET` at the `LOGON:` prompt wipes saved progress.

Stuck? The system's designer had a son. Or type `RESEARCH FALKEN`.

## Accessibility

- All animation (flicker, scanlines, the cursor, the bad-ending flash) is reduced or disabled under `prefers-reduced-motion`.
- Sound is opt-out and persists. WebAudio only starts after your first keypress, per browser policy.
- The game is fully keyboard-driven; output is mirrored to an `aria-live` log region for screen readers.

## Development

Plain HTML/CSS/JS, classic scripts, no toolchain. The dialogue, game, intro, crisis, and sound logic are DOM-free and covered by node tests (also run in CI):

```sh
node tests/smoke.js    # Joshua dialogue engine
node tests/games.js    # tic-tac-toe minimax, GTW map and targeting
node tests/intro.js    # war-dialer and research archive
node tests/crisis.js   # DEFCON 1 decision logic and endings
node tests/sound.js    # sound module (no-op without WebAudio)
```

### Layout

```
index.html            boots the terminal
css/crt.css           phosphor theme, scanlines, DEFCON bar, whiteout
js/terminal.js        typewriter output, input, status bar, animation frames
js/sound.js           synthesized modem / klaxon / key clicks (WebAudio)
js/parser.js          shared parsing (game aliases, yes/no)
js/intro.js           Acts 1-2: war-dial pool + research archive
js/wopr.js            Joshua's dialogue engine
js/games/             tic-tac-toe and Global Thermonuclear War
js/crisis.js          Acts 4-5: climax intent + endings
js/engine.js          save/load and the scene runner
js/main.js            scene wiring
```

## Deployment

The site is static; `.github/workflows/pages.yml` publishes the repo root to GitHub Pages on every push to `main`. One-time setup: repo **Settings → Pages → Source: GitHub Actions**. The play link above goes live once that's enabled and this branch is merged.

## Credits

A tribute to *WarGames* (1983), directed by John Badham. Dialogue is adapted, not transcribed. The point stands: the only winning move is not to play.
