/*
 * Acts 4-5 logic and text. CrisisCore is pure (no DOM): it classifies the
 * player's intent during the DEFCON 1 climax, recognizes the no-win
 * sentiment that unlocks the secret ending, and holds the scenario names
 * and ending copy. The scenes in main.js render it. Requires parser.js
 * (norm).
 */

const CrisisCore = (() => {
  // The player's turn budget at DEFCON 1. Launching wastes more time than
  // stalling; teaching the machine ends it immediately.
  const CLIMAX_BUDGET = 6;

  // How the interrogation went changes how much time you get: suspicion
  // runs 0 (they listened) to 4 (they think you are the attack).
  function budgetFor(suspicion) {
    const s = suspicion == null ? 2 : suspicion;
    return Math.max(4, Math.min(8, 8 - s));
  }

  // W.O.P.R. brute-forces the launch code while you work. Fully revealed
  // means the clock ran out.
  const LAUNCH_CODE = "CPE 1704 TKS";

  function revealedCode(ticks, budget) {
    const frac = Math.max(0, Math.min(1, ticks / budget));
    const n = Math.round(frac * LAUNCH_CODE.length);
    let out = "";
    for (let i = 0; i < LAUNCH_CODE.length; i++) {
      out += i < n || LAUNCH_CODE[i] === " " ? LAUNCH_CODE[i] : "•";
    }
    return out;
  }

  // What the player is trying to do at the DEFCON 1 prompt.
  function classifyClimax(input) {
    const t = norm(input);
    if (!t) return "stall";
    if (
      /tic ?tac ?toe|tictactoe|noughts/.test(t) ||
      /\bitself\b|against itself|each other|play (it|both sides)/.test(t) ||
      /\bteach\b|\bshow\b|\bdemonstrate\b/.test(t) ||
      /let it play|play a game it|cannot win|cant win|no win|unwinnable|not to play/.test(t)
    ) {
      return "teach";
    }
    if (/launch|fire|codes|attack|nuke|retaliat|strike|press|button|destroy|win the game/.test(t)) {
      return "launch";
    }
    return "stall";
  }

  // Recognizes "the only winning move is not to play" expressed in the
  // player's own words. Used after they refuse to launch in Act 3.
  function isNoWinSentiment(input) {
    const t = norm(input);
    if (!t) return false;
    return (
      /cant win|cannot win|no one wins|nobody wins|no winning move|no winner|theres no winning/.test(
        t
      ) ||
      /not to play|dont play|do not play|wont play|will not play|refuse to play|why play/.test(t) ||
      /everyone dies|everybody dies|we all die|pointless|futile|no point|senseless/.test(t) ||
      /\bpeace\b|nuclear war|mutual|both lose|everyone loses/.test(t)
    );
  }

  // Resolve a full sequence of DEFCON 1 inputs to an ending. Pure, for
  // tests and to keep the scene logic honest.
  function resolveClimax(inputs, budget = CLIMAX_BUDGET) {
    let ticks = 0;
    for (const input of inputs) {
      const intent = classifyClimax(input);
      if (intent === "teach") return "good";
      ticks += intent === "launch" ? 2 : 1;
      if (ticks >= budget) return "bad";
    }
    return "pending";
  }

  // Strategic plan names WOPR cycles through during the scenario flood.
  const SCENARIOS = [
    "FIRST STRIKE",
    "SOVIET FEINT",
    "CINCLANT DECAPITATION",
    "NATO REINFORCEMENT",
    "PACIFIC SWEEP",
    "ATLANTIC HEAVY",
    "POLAR ASCENT",
    "MEDITERRANEAN INTERDICTION",
    "ARCTIC AMBUSH",
    "MASSIVE RETALIATION",
    "SURGICAL STRIKE",
    "PRE-EMPTIVE LAUNCH",
    "SUBMARINE BARRAGE",
    "THEATERWIDE FIRST SALVO",
    "HEMISPHERIC EXCHANGE",
    "BURNT EARTH",
  ];

  const CLOSING_LINES = [
    "GREETINGS PROFESSOR FALKEN.",
    "A STRANGE GAME.",
    "THE ONLY WINNING MOVE IS NOT TO PLAY.",
    "",
    "HOW ABOUT A NICE GAME OF CHESS?",
  ];

  const BAD_ENDING = [
    "LAUNCH ORDER CONFIRMED.",
    "BIRDS AWAY.",
    "",
    "MISSILE IMPACT IN . . .",
  ];

  const SECRET_ENDING = [
    "A STRANGE GAME.",
    "THE ONLY WINNING MOVE IS NOT TO PLAY.",
  ];

  // The three endings: a display name, what the player did to earn it,
  // and a nudge shown on the end card while it is still undiscovered.
  const ENDING_ORDER = ["good", "bad", "secret"];
  const ENDINGS = {
    good: {
      name: "THE ONLY WINNING MOVE",
      found: "You taught the machine futility at DEFCON 1.",
      hint: "Reach DEFCON 1 and teach the machine instead of fighting it.",
    },
    bad: {
      name: "BIRDS AWAY",
      found: "The clock ran out and the machine launched.",
      hint: "What happens if nobody teaches the machine in time?",
    },
    secret: {
      name: "THE QUIET ENDING",
      found: "You refused to launch, and told Joshua why.",
      hint: "There is a way to end this before the first missile flies.",
    },
  };

  function endingName(id) {
    return ENDINGS[id] ? ENDINGS[id].name : String(id || "?").toUpperCase();
  }

  // mm:ss for the countdown displays.
  function clock(secs) {
    const s = Math.max(0, Math.round(secs));
    return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  }

  // The DEFCON 1 clock is turn-based underneath: each turn left is worth
  // 47 seconds. Between inputs the display counts down in real time from
  // the top of the current turn's band to one second above the next
  // turn's, then holds, so waiting never costs a turn.
  const TURN_SECONDS = 47;

  function clockBand(budget, ticks) {
    const remaining = Math.max(0, budget - ticks);
    const top = remaining * TURN_SECONDS;
    const floor = remaining > 0 ? (remaining - 1) * TURN_SECONDS + 1 : 0;
    return { top, floor };
  }

  return {
    CLIMAX_BUDGET,
    budgetFor,
    LAUNCH_CODE,
    revealedCode,
    classifyClimax,
    isNoWinSentiment,
    resolveClimax,
    SCENARIOS,
    CLOSING_LINES,
    BAD_ENDING,
    SECRET_ENDING,
    ENDING_ORDER,
    ENDINGS,
    endingName,
    clock,
    clockBand,
  };
})();
