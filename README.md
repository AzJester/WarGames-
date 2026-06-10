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
- Any key or tap skips the typewriter effect.
- Up/Down arrows recall input history. Escape clears the line.

Stuck at `LOGON:`? The system's designer had a son.

## Status

Milestone 1 of 5 (see [PLAN.md](PLAN.md)): the terminal foundation and the opening exchange. Dial in, get past `LOGON:`, talk to Joshua, browse the game list. The playable games, the war-dialing act, and the DEFCON crisis arrive in later milestones.

## Development

Plain HTML/CSS/JS, classic scripts, no toolchain. The dialogue engine (`js/wopr.js`) is DOM-free and covered by a smoke test:

```sh
node tests/smoke.js
```
