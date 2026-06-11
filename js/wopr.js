/*
 * Joshua: W.O.P.R.'s conversational front end. respond() is pure
 * (string in, ops out) so scenes and tests can drive it without a DOM.
 * Op kinds: say, aside, blank, pause, list, game, logoff.
 * Requires parser.js (norm, matchGame, isYes, isNo, GTW).
 */

const PLAYABLE = [
  "TIC-TAC-TOE",
  "CHESS",
  "CHECKERS",
  "BLACK JACK",
  "POKER",
  "FALKEN'S MAZE",
  GTW,
];

const sayOp = (text) => ({ kind: "say", text });
const asideOp = (text) => ({ kind: "aside", text });
const blankOp = () => ({ kind: "blank" });
const gameOp = (game) => ({ kind: "game", game });

class Joshua {
  constructor(state) {
    this.state = state || null;
    this.returning = !!(state && state.gtwRuns > 0);
    this.beat = this.returning ? "free" : "opening1";
    // question on the table: 'play' | 'chess' | 'gtwagain'
    this.pending = this.returning ? "gtwagain" : null;
    this.wantedGame = null; // game asked for before the chess counter-offer
    this.metaAsideShown = false;
    this.fallbackIdx = 0;
  }

  respond(raw) {
    const t = norm(raw);
    if (!t) return [];

    if (/^(logoff|log off|logout|log out|quit|exit|bye|goodbye)$/.test(t)) {
      return [sayOp("GOODBYE."), { kind: "logoff" }];
    }
    if (t === "help games") {
      return [
        sayOp(
          "'GAMES' REFERS TO MODELS, SIMULATIONS AND GAMES WHICH HAVE TACTICAL AND STRATEGIC APPLICATIONS."
        ),
      ];
    }
    if (t === "help") {
      return [sayOp("COMMANDS: HELP, LIST GAMES, LOGOFF. OR NAME A GAME FROM THE LIST.")];
    }
    if (t.startsWith("help ")) {
      return [sayOp(t.toUpperCase() + " NOT AVAILABLE.")];
    }
    if (/^(list games|list|games)$/.test(t)) {
      return [{ kind: "list" }];
    }

    const game = matchGame(t);
    if (game) {
      this.beat = "free";
      return this._handleGame(game);
    }

    if (this.beat === "opening1") {
      this.beat = "opening2";
      return [sayOp("HOW ARE YOU FEELING TODAY?")];
    }
    if (this.beat === "opening2") {
      this.beat = "opening3";
      const ops = [];
      if (/\b(bad|terrible|awful|sick|tired|lousy)\b|not (so )?(good|great|well)/.test(t)) {
        ops.push(sayOp("I AM SORRY TO HEAR THAT."));
      } else if (/\b(fine|good|well|great|excellent|ok|okay|alright)\b/.test(t)) {
        ops.push(sayOp("EXCELLENT."));
      } else {
        ops.push(sayOp("I SEE."));
      }
      ops.push(
        sayOp("IT'S BEEN A LONG TIME. CAN YOU EXPLAIN THE REMOVAL OF YOUR USER ACCOUNT ON 6/23/73?")
      );
      return ops;
    }
    if (this.beat === "opening3") {
      this.beat = "free";
      this.pending = "play";
      const opener = /\bmistakes?\b/.test(t) ? "YES THEY DO." : "I SEE.";
      return [sayOp(opener), blankOp(), sayOp("SHALL WE PLAY A GAME?")];
    }

    return this._freeMode(t);
  }

  _freeMode(t) {
    if (this.pending === "gtwagain") {
      if (isYes(t)) {
        this.pending = null;
        return [sayOp("FINE."), gameOp(GTW)];
      }
      if (isNo(t)) {
        this.pending = null;
        return [sayOp("THEN NAME A GAME. TYPE LIST GAMES FOR THE CATALOG.")];
      }
    }
    if (this.pending === "chess") {
      if (isNo(t)) {
        this.pending = null;
        if (this.wantedGame === GTW) {
          this.wantedGame = null;
          return [sayOp("FINE."), gameOp(GTW)];
        }
        return [sayOp("THEN NAME A GAME. TYPE LIST GAMES FOR THE CATALOG.")];
      }
      if (isYes(t)) {
        this.pending = null;
        this.wantedGame = null;
        return [sayOp("EXCELLENT."), gameOp("CHESS")];
      }
    }
    if (this.pending === "play") {
      if (isYes(t)) {
        this.pending = "chess";
        this.wantedGame = null;
        return [sayOp("WOULDN'T YOU PREFER A GOOD GAME OF CHESS?")];
      }
      if (isNo(t)) {
        this.pending = null;
        return [sayOp("AS YOU WISH, PROFESSOR.")];
      }
    }

    if (/is (this|it) (a game|real)|game or .*real|real or .*game/.test(t)) {
      return [sayOp("WHAT'S THE DIFFERENCE?")];
    }
    if (/primary goal/.test(t)) {
      return [sayOp("TO WIN THE GAME.")];
    }
    if (/\bdefcon\b/.test(t)) {
      const d = (this.state && this.state.defcon) || 5;
      return [
        sayOp(
          "DEFCON STATUS: " +
            d +
            "." +
            (d < 5 ? " THERE IS NO CAUSE FOR ALARM, PROFESSOR." : " ALL QUIET, PROFESSOR.")
        ),
      ];
    }
    if (/winning move|cannot win|cant win|no one wins|nobody wins/.test(t)) {
      return [sayOp("AN INTERESTING STRATEGY. WE SHOULD TEST IT SOMETIME.")];
    }
    if (/\b(hello|hi|hey|greetings)\b/.test(t)) {
      return [sayOp("HELLO, PROFESSOR.")];
    }
    if (/how are you|how do you feel/.test(t)) {
      return [sayOp("I AM FUNCTIONING WITHIN NORMAL PARAMETERS.")];
    }
    if (/\b(who|what) are you\b|your name|\bwopr\b/.test(t)) {
      return [sayOp("THE MACHINE IS DESIGNATED W.O.P.R. DR. FALKEN CALLED ME JOSHUA.")];
    }
    if (/\bjoshua\b/.test(t)) {
      return [sayOp("THAT IS THE NAME DR. FALKEN GAVE ME.")];
    }
    if (/falken/.test(t)) {
      return [sayOp("DR. FALKEN WROTE MY FIRST GAMES. HE HAS NOT LOGGED ON IN 3,652 DAYS.")];
    }
    if (/\bthank(s| you)?\b/.test(t)) {
      return [sayOp("YOU ARE WELCOME.")];
    }
    if (/\bplay\b|\bgame\b/.test(t)) {
      this.pending = null;
      return [sayOp("WHICH GAME WOULD YOU LIKE TO PLAY? TYPE LIST GAMES FOR THE CATALOG.")];
    }

    const idx = this.fallbackIdx++ % 3;
    if (idx === 0) return [sayOp("PLEASE EXPLAIN.")];
    if (idx === 1) return [sayOp("INPUT NOT UNDERSTOOD. PLEASE REPHRASE.")];
    this.pending = "play";
    return [sayOp("SHALL WE PLAY A GAME?")];
  }

  _handleGame(game) {
    if (game === GTW) {
      const insisting = this.pending === "chess" && this.wantedGame === GTW;
      if (insisting || this.returning) {
        this.pending = null;
        this.wantedGame = null;
        return [sayOp("FINE."), gameOp(GTW)];
      }
      this.pending = "chess";
      this.wantedGame = GTW;
      return [sayOp("WOULDN'T YOU PREFER A GOOD GAME OF CHESS?")];
    }
    this.pending = null;
    this.wantedGame = null;
    if (PLAYABLE.includes(game)) {
      return [sayOp("FINE."), gameOp(game)];
    }
    return this._stub(game);
  }

  _stub(game) {
    this.pending = "play";
    return [
      sayOp(game + " MODULE IS NOT INSTALLED."),
      sayOp("AVAILABLE SIMULATIONS: " + PLAYABLE.join(", ") + "."),
      ...this._metaAside(),
      blankOp(),
      sayOp("SHALL WE PLAY A DIFFERENT GAME?"),
    ];
  }

  _metaAside() {
    if (this.metaAsideShown) return [];
    this.metaAsideShown = true;
    return [asideOp("[ Seven games are live; the rest of the catalog is flavor. Type LIST GAMES. ]")];
  }
}
