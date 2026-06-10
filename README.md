# WarGames: Shall We Play A Game?

An interactive game based on the 1983 film *WarGames*, played entirely in a retro CRT terminal in your browser. You are David Lightman, and last night your war dialer found a number that answers with a carrier tone and no name.

## Play

No build, no install, no dependencies. Open `index.html` in any modern browser, or serve the folder:

```sh
git clone https://github.com/AzJester/WarGames-.git
cd WarGames-
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Controls

- Type and press Enter.
- Any key or tap skips the typewriter effect (including the missile animations).
- Up/Down arrows recall input history. Escape clears the line.
- `SKIP` at the title jumps straight to the system. `RESET` at the `LOGON:` prompt wipes saved progress.

Stuck? The system's designer had a son. Or type `RESEARCH FALKEN`.

## How it plays

1. **War dialing.** `SCAN` the Sunnyvale exchange. Most numbers are banks, an airline, a dentist's machine; Protovision's line is dead. One answers with a carrier and no name. `DIAL` it.
2. **The backdoor.** The system is locked, and its games have odd names (FALKEN'S MAZE). `RESEARCH FALKEN`, follow the trail to his son, and log on as `JOSHUA`.
3. **The games.** Tic-tac-toe against a Joshua who plays perfectly. Global Thermonuclear War: pick a side, list targets by city and/or country, confirm, and watch the big board. The machine remembers your side.

Impatient? `SKIP` the first two acts at the title screen. The logon hints still guide you in.

## Status

Milestone 3 of 5 (see [PLAN.md](PLAN.md)): the terminal, the opening exchange, save/load, the two playable games, and now the war-dialing and backdoor-research acts with a `SKIP` option. The DEFCON crisis and the endgame arrive in M4-M5.

## Development

Plain HTML/CSS/JS, classic scripts, no toolchain. The dialogue engine, game cores, and intro logic are DOM-free and covered by node tests:

```sh
node tests/smoke.js   # Joshua dialogue engine
node tests/games.js   # tic-tac-toe minimax, GTW map and targeting
node tests/intro.js   # war-dialer and research archive
```
