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
- Typing `RESET` at the `LOGON:` prompt wipes your saved progress.

Stuck at `LOGON:`? The system's designer had a son.

## What's playable

- **Tic-tac-toe** against Joshua. He plays perfectly. Draw your conclusions.
- **Global Thermonuclear War**: pick a side, list primary targets by city and/or country, confirm the commit, and watch the big board. The machine remembers which side you chose.

## Status

Milestone 2 of 5 (see [PLAN.md](PLAN.md)): the terminal, the opening exchange, save/load, and the first two playable games. The war-dialing act, the Falken research puzzle, and the DEFCON crisis arrive in later milestones.

## Development

Plain HTML/CSS/JS, classic scripts, no toolchain. The dialogue engine and game cores are DOM-free and covered by node tests:

```sh
node tests/smoke.js   # Joshua dialogue engine
node tests/games.js   # tic-tac-toe minimax, GTW map and targeting
```
