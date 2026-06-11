/*
 * Game state and the scene runner. State persists to localStorage when
 * available; the guards keep node tests and storage-blocking browsers
 * working.
 */

const SAVE_KEY = "wargames-save-v1";

function defaultState() {
  return {
    visits: 0,
    lastSide: null,
    gtwRuns: 0,
    refusedLaunch: false,
    tttGames: 0,
    tttDraws: 0,
    defcon: 5,
    metWopr: false,
    knowsJoshua: false,
    crisisResolved: false,
    ending: null,
    endingsSeen: [],
    gamesPlayed: 0,
    suspicion: 2,
  };
}

function loadState() {
  const state = defaultState();
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) Object.assign(state, JSON.parse(raw));
    }
  } catch (e) {
    /* corrupted or blocked storage: start fresh */
  }
  return state;
}

function saveState(state) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    }
  } catch (e) {
    /* storage blocked: play on without persistence */
  }
}

function resetState(state) {
  Object.assign(state, defaultState());
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(SAVE_KEY);
    }
  } catch (e) {
    /* storage blocked */
  }
}

async function runScenes(scenes, start, ctx) {
  let name = start;
  while (name) {
    name = await scenes[name](ctx);
  }
}
