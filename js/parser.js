/*
 * Parsing helpers shared by the dialogue engine, the scenes, and the
 * games. Pure string functions, no DOM.
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
  "TIC-TAC-TOE",
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

function isYes(t) {
  if (/\b(why not|love to|lets do it|go ahead)\b/.test(t)) return true;
  if (isNo(t)) return false;
  return /\b(yes|yeah|yep|yup|sure|ok|okay|fine|affirmative|absolutely|certainly|please|y)\b/.test(t);
}

function isNo(t) {
  if (/\b(why not|love to)\b/.test(t)) return false;
  return /\b(no|nope|nah|negative|later|never|not now|rather not|dont|do not|n)\b/.test(t);
}
