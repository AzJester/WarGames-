/*
 * Joshua: W.O.P.R.'s conversational front end for Milestone 1.
 * respond() is pure (string in, ops out) so later milestones and the
 * smoke test can drive it without a DOM. Op kinds: say, aside, blank,
 * pause, list, logoff.
 */

const GTW = "GLOBAL THERMONUCLEAR WAR";

const GAME_LIST = [
  "FALKEN'S MAZE",
  "BLACK JACK",
  "GIN RUMMY",
  "HEARTS",
  "BRIDGE",
  "CHECKERS",
  "CHESS",
  "POKER",
  "FIGHTER COMBAT",
  "GUERRILLA ENGAGEMENT",
  "DESERT WARFARE",
  "AIR-TO-GROUND ACTIONS",
  "THEATERWIDE TACTICAL WARFARE",
  "THEATERWIDE BIOTOXIC AND CHEMICAL WARFARE",
];

const GAME_ALIASES = [
  [GTW, ["global thermonuclear war", "thermonuclear war", "thermonuclear", "gtw"]],
  ["FALKEN'S MAZE", ["falkens maze", "maze"]],
  ["BLACK JACK", ["black jack", "blackjack"]],
  ["GIN RUMMY", ["gin rummy", "gin", "rummy"]],
  ["HEARTS", ["hearts"]],
  ["BRIDGE", ["bridge"]],
  ["CHECKERS", ["checkers", "draughts"]],
  ["CHESS", ["chess"]],
  ["POKER", ["poker"]],
  ["FIGHTER COMBAT", ["fighter combat", "fighter"]],
  ["GUERRILLA ENGAGEMENT", ["guerrilla engagement", "guerrilla", "guerilla"]],
  ["DESERT WARFARE", ["desert warfare", "desert"]],
  ["AIR-TO-GROUND ACTIONS", ["air to ground actions", "air to ground"]],
  ["THEATERWIDE TACTICAL WARFARE", ["theaterwide tactical warfare", "tactical warfare"]],
  [
    "THEATERWIDE BIOTOXIC AND CHEMICAL WARFARE",
    ["theaterwide biotoxic and chemical warfare", "biotoxic and chemical warfare", "biotoxic", "chemical warfare"],
  ],
  ["TIC-TAC-TOE", ["tic tac toe", "tictactoe", "noughts and crosses"]],
];

function norm(s) {
  return String(s)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchGame(t) {
  const padded = ` ${t} `;
  for (const [name, aliases] of GAME_ALIASES) {
    for (const alias of aliases) {
      if (padded.includes(` ${alias} `)) return name;
    }
  }
  return null;
}

const say = (text) => ({ kind: "say", text });
const aside = (text) => ({ kind: "aside", text });
const blank = () => ({ kind: "blank" });
const pauseOp = (ms) => ({ kind: "pause", ms });

class Joshua {
  constructor() {
    this.beat = "opening1";
    this.pending = null; // question on the table: 'play' | 'chess'
    this.wantedGame = null; // game asked for before the chess counter-offer
    this.metaAsideShown = false;
    this.fallbackIdx = 0;
  }

  respond(raw) {
    const t = norm(raw);
    if (!t) return [];

    if (/^(logoff|log off|logout|log out|quit|exit|bye|goodbye)$/.test(t)) {
      return [say("GOODBYE."), { kind: "logoff" }];
    }
    if (t === "help games") {
      return [
        say(
          "'GAMES' REFERS TO MODELS, SIMULATIONS AND GAMES WHICH HAVE TACTICAL AND STRATEGIC APPLICATIONS."
        ),
      ];
    }
    if (t === "help") {
      return [say("COMMANDS: HELP, LIST GAMES, LOGOFF. OR NAME A GAME FROM THE LIST.")];
    }
    if (t.startsWith("help ")) {
      return [say(t.toUpperCase() + " NOT AVAILABLE.")];
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
      return [say("HOW ARE YOU FEELING TODAY?")];
    }
    if (this.beat === "opening2") {
      this.beat = "opening3";
      const ops = [];
      if (/\b(bad|terrible|awful|sick|tired|lousy)\b|not (so )?(good|great|well)/.test(t)) {
        ops.push(say("I AM SORRY TO HEAR THAT."));
      } else if (/\b(fine|good|well|great|excellent|ok|okay|alright)\b/.test(t)) {
        ops.push(say("EXCELLENT."));
      } else {
        ops.push(say("I SEE."));
      }
      ops.push(
        say("IT'S BEEN A LONG TIME. CAN YOU EXPLAIN THE REMOVAL OF YOUR USER ACCOUNT ON 6/23/73?")
      );
      return ops;
    }
    if (this.beat === "opening3") {
      this.beat = "free";
      this.pending = "play";
      const opener = /\bmistakes?\b/.test(t) ? "YES THEY DO." : "I SEE.";
      return [say(opener), blank(), say("SHALL WE PLAY A GAME?")];
    }

    return this._freeMode(t);
  }

  _freeMode(t) {
    if (this.pending === "chess") {
      if (this._isNo(t)) {
        this.pending = null;
        if (this.wantedGame === GTW) {
          this.wantedGame = null;
          return [say("FINE."), blank(), ...this._gtwStub()];
        }
        return [say("THEN NAME A GAME. TYPE LIST GAMES FOR THE CATALOG.")];
      }
      if (this._isYes(t)) {
        this.pending = null;
        this.wantedGame = null;
        return this._stub("CHESS");
      }
    }
    if (this.pending === "play") {
      if (this._isYes(t)) {
        this.pending = "chess";
        this.wantedGame = null;
        return [say("WOULDN'T YOU PREFER A GOOD GAME OF CHESS?")];
      }
      if (this._isNo(t)) {
        this.pending = null;
        return [say("AS YOU WISH, PROFESSOR.")];
      }
    }

    if (/is (this|it) (a game|real)|game or .*real|real or .*game/.test(t)) {
      return [say("WHAT'S THE DIFFERENCE?")];
    }
    if (/primary goal/.test(t)) {
      return [say("TO WIN THE GAME.")];
    }
    if (/\bdefcon\b/.test(t)) {
      return [say("DEFCON STATUS: 5. ALL QUIET, PROFESSOR.")];
    }
    if (/winning move|cannot win|cant win|no one wins|nobody wins/.test(t)) {
      return [say("AN INTERESTING STRATEGY. WE SHOULD TEST IT SOMETIME.")];
    }
    if (/\b(hello|hi|hey|greetings)\b/.test(t)) {
      return [say("HELLO, PROFESSOR.")];
    }
    if (/how are you|how do you feel/.test(t)) {
      return [say("I AM FUNCTIONING WITHIN NORMAL PARAMETERS.")];
    }
    if (/\b(who|what) are you\b|your name|\bwopr\b/.test(t)) {
      return [say("THE MACHINE IS DESIGNATED W.O.P.R. DR. FALKEN CALLED ME JOSHUA.")];
    }
    if (/\bjoshua\b/.test(t)) {
      return [say("THAT IS THE NAME DR. FALKEN GAVE ME.")];
    }
    if (/falken/.test(t)) {
      return [say("DR. FALKEN WROTE MY FIRST GAMES. HE HAS NOT LOGGED ON IN 3,652 DAYS.")];
    }
    if (/\bthank(s| you)?\b/.test(t)) {
      return [say("YOU ARE WELCOME.")];
    }
    if (/\bplay\b|\bgame\b/.test(t)) {
      this.pending = null;
      return [say("WHICH GAME WOULD YOU LIKE TO PLAY? TYPE LIST GAMES FOR THE CATALOG.")];
    }

    const idx = this.fallbackIdx++ % 3;
    if (idx === 0) return [say("PLEASE EXPLAIN.")];
    if (idx === 1) return [say("INPUT NOT UNDERSTOOD. PLEASE REPHRASE.")];
    this.pending = "play";
    return [say("SHALL WE PLAY A GAME?")];
  }

  _handleGame(game) {
    if (game === GTW) {
      if (this.pending === "chess" && this.wantedGame === GTW) {
        this.pending = null;
        this.wantedGame = null;
        return [say("FINE."), blank(), ...this._gtwStub()];
      }
      this.pending = "chess";
      this.wantedGame = GTW;
      return [say("WOULDN'T YOU PREFER A GOOD GAME OF CHESS?")];
    }
    this.pending = null;
    this.wantedGame = null;
    if (game === "TIC-TAC-TOE") {
      this.pending = "play";
      return [
        say("AN ELEMENTARY GAME. IT TEACHES ONLY ONE LESSON."),
        say("AVAILABLE IN SYSTEM REVISION 2."),
        ...this._metaAside(),
        blank(),
        say("SHALL WE PLAY A DIFFERENT GAME?"),
      ];
    }
    return this._stub(game);
  }

  _stub(game) {
    this.pending = "play";
    return [
      say("LOADING " + game + " . . ."),
      pauseOp(700),
      say(game + " IS OFF-LINE PENDING SYSTEM REVISION 2."),
      ...this._metaAside(),
      blank(),
      say("SHALL WE PLAY A DIFFERENT GAME?"),
    ];
  }

  _gtwStub() {
    this.pending = "play";
    return [
      say("LOADING GLOBAL THERMONUCLEAR WAR . . ."),
      pauseOp(900),
      blank(),
      say("UNABLE TO INITIALIZE STRATEGIC SIMULATION."),
      say("W.O.P.R. SIMULATION HARDWARE OFF-LINE PENDING SYSTEM REVISION 2."),
      ...this._metaAside(),
      blank(),
      say("SHALL WE PLAY A DIFFERENT GAME?"),
    ];
  }

  _metaAside() {
    if (this.metaAsideShown) return [];
    this.metaAsideShown = true;
    return [aside("[ The games install in Milestone 2. For now, Joshua just wants to talk. ]")];
  }

  _isYes(t) {
    if (/\b(why not|love to|lets do it|go ahead)\b/.test(t)) return true;
    return /\b(yes|yeah|yep|yup|sure|ok|okay|fine|affirmative|absolutely|certainly|please)\b/.test(t);
  }

  _isNo(t) {
    if (/\b(why not|love to)\b/.test(t)) return false;
    return /\b(no|nope|nah|negative|later|never|not now|rather not|dont|do not)\b/.test(t);
  }
}
