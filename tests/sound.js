/*
 * DOM-free tests for the sound module. WebAudio is absent under node, so
 * every method must be a safe no-op while the enabled flag and its
 * persistence still work. Run: node tests/sound.js
 */
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

// A minimal localStorage so persistence can be exercised.
const store = {};
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => (store[k] = String(v)),
  removeItem: (k) => delete store[k],
};

function load() {
  const src = fs.readFileSync(path.join(__dirname, "..", "js", "sound.js"), "utf8");
  const tmp = path.join(os.tmpdir(), `sound-under-test-${process.pid}-${Math.random()}.js`);
  fs.writeFileSync(tmp, src + "\nmodule.exports = { Sound };\n");
  delete require.cache[tmp];
  const mod = require(tmp);
  fs.unlinkSync(tmp);
  return mod.Sound;
}

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log("ok - " + name);
}

check("defaults to enabled with no stored preference", () => {
  for (const k of Object.keys(store)) delete store[k];
  const Sound = load();
  assert.strictEqual(Sound.isEnabled(), true);
});

check("every method is a safe no-op without WebAudio or speech", () => {
  const Sound = load();
  assert.doesNotThrow(() => {
    Sound.unlock();
    Sound.modem();
    Sound.klaxon();
    Sound.click();
    Sound.beep();
    Sound.powerOn();
    Sound.tick();
    Sound.speak("GREETINGS PROFESSOR FALKEN.");
    Sound.shutUp();
  });
});

check("voice defaults on and persists", () => {
  for (const k of Object.keys(store)) delete store[k];
  const Sound = load();
  assert.strictEqual(Sound.isVoiceOn(), true);
  Sound.setVoice(false);
  assert.strictEqual(Sound.isVoiceOn(), false);
  assert.strictEqual(store["wargames-voice"], "off");
  Sound.setVoice(true);
  assert.strictEqual(store["wargames-voice"], "on");
});

check("a stored 'voice off' preference is honored on load", () => {
  for (const k of Object.keys(store)) delete store[k];
  store["wargames-voice"] = "off";
  const Sound = load();
  assert.strictEqual(Sound.isVoiceOn(), false);
});

check("setEnabled toggles and persists", () => {
  for (const k of Object.keys(store)) delete store[k];
  const Sound = load();
  Sound.setEnabled(false);
  assert.strictEqual(Sound.isEnabled(), false);
  assert.strictEqual(store["wargames-sound"], "off");
  Sound.setEnabled(true);
  assert.strictEqual(store["wargames-sound"], "on");
});

check("a stored 'off' preference is honored on load", () => {
  for (const k of Object.keys(store)) delete store[k];
  store["wargames-sound"] = "off";
  const Sound = load();
  assert.strictEqual(Sound.isEnabled(), false);
});

// ---- Joshua's voice, against a fake speech engine ----

class FakeUtterance {
  constructor(text) {
    this.text = text;
    this.rate = 1;
    this.pitch = 1;
    this.volume = 1;
  }
}

function fakeEngine() {
  return {
    spoken: [],
    cancels: 0,
    queue: [],
    get speaking() {
      return this.queue.length > 0;
    },
    get pending() {
      return this.queue.length > 1;
    },
    getVoices: () => [],
    addEventListener() {},
    speak(u) {
      this.spoken.push(u);
      this.queue.push(u);
    },
    cancel() {
      this.cancels += 1;
      const q = this.queue;
      this.queue = [];
      for (const u of q) if (u.onerror) u.onerror({ error: "canceled" });
    },
    // the engine finishes the line it is on
    finish() {
      const u = this.queue.shift();
      if (u && u.onend) u.onend({});
    },
  };
}

// Load the module with a speech engine present. Lines Joshua actually
// says (volume above zero) are in said(); the silent primer is not.
function loadWithVoice() {
  for (const k of Object.keys(store)) delete store[k];
  const engine = fakeEngine();
  global.window = { speechSynthesis: engine, SpeechSynthesisUtterance: FakeUtterance };
  const Sound = load();
  delete global.window;
  const said = () => engine.spoken.filter((u) => u.volume > 0).map((u) => u.text);
  return { Sound, engine, said };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

check("lines are rewritten so an engine reads them properly", () => {
  const { Sound } = loadWithVoice();
  const say = Sound.sayable;
  assert.strictEqual(say("GREETINGS PROFESSOR FALKEN."), "Greetings professor Falken.");
  // a real engine read 6/23/73 as "six slash twenty-three slash seventy-three"
  assert.strictEqual(
    say("IT'S BEEN A LONG TIME. CAN YOU EXPLAIN THE REMOVAL OF YOUR USER ACCOUNT ON 6/23/73?"),
    "It's been a long time. Can you explain the removal of your user account on June 23rd, 1973?"
  );
  // ...and "DR." as "D R"
  assert.strictEqual(
    say("THE MACHINE IS DESIGNATED W.O.P.R. DR. FALKEN CALLED ME JOSHUA."),
    "The machine is designated W.O.P.R. Doctor Falken called me Joshua."
  );
  assert.strictEqual(say("W.O.P.R: TIME TO PRIMARY GOAL: MINIMAL."), "Time to primary goal: Minimal.");
  assert.strictEqual(say("LEARNING. TIC-TAC-TOE. PLAYER VS. PLAYER."), "Learning. Tic-tac-toe. Player versus player.");
  // squares stay joined: "A 3" is read as the article "a"
  assert.strictEqual(say("MY MOVE: A3 B4."), "My move: A3 to B4.");
  assert.strictEqual(say("MY MOVE: E7 E5. CAPTURE."), "My move: E7 to E5. Capture.");
  assert.strictEqual(say("MY MOVE: 5."), "My move: 5.");
  // the name is only a prefix when a colon follows it
  assert.strictEqual(
    say("JOSHUA ALWAYS FOUND THE CENTER. HIS FATHER NEVER KNEW HOW."),
    "Joshua always found the center. His father never knew how."
  );
  assert.strictEqual(say("I AM FUNCTIONING. I SEE."), "I am functioning. I see.");
  assert.strictEqual(say("██ ▲ ●"), "");
  assert.strictEqual(say(""), "");
});

check("a line reaches the engine in Joshua's voice", () => {
  const { Sound, engine, said } = loadWithVoice();
  Sound.speak("SHALL WE PLAY A GAME?");
  assert.deepStrictEqual(said(), ["Shall we play a game?"]);
  const u = engine.spoken[engine.spoken.length - 1];
  assert.strictEqual(u.rate, 0.86);
  assert.strictEqual(u.pitch, 0.4);
  assert.strictEqual(u.volume, 0.9);
});

check("lines spoken while he is talking queue in order", () => {
  const { Sound, said } = loadWithVoice();
  Sound.speak("EXCELLENT.");
  Sound.speak("IT'S BEEN A LONG TIME.");
  Sound.speak("SHALL WE PLAY A GAME?");
  assert.deepStrictEqual(said(), ["Excellent.", "It's been a long time.", "Shall we play a game?"]);
});

check("an idle engine is never cancelled", () => {
  const { Sound, engine } = loadWithVoice();
  Sound.shutUp();
  Sound.shutUp();
  assert.strictEqual(engine.cancels, 0);
  Sound.speak("HELLO, PROFESSOR.");
  engine.finish();
  Sound.shutUp(); // he has finished: nothing to stop
  assert.strictEqual(engine.cancels, 0);
});

check("voice off and sound off say nothing", () => {
  const a = loadWithVoice();
  a.Sound.setVoice(false);
  a.Sound.speak("GREETINGS PROFESSOR FALKEN.");
  assert.deepStrictEqual(a.said(), []);
  const b = loadWithVoice();
  b.Sound.setEnabled(false);
  b.Sound.speak("GREETINGS PROFESSOR FALKEN.");
  assert.deepStrictEqual(b.said(), []);
});

check("turning the voice off stops him mid-sentence", () => {
  const { Sound, engine } = loadWithVoice();
  Sound.speak("THE MACHINE IS DESIGNATED W.O.P.R.");
  Sound.setVoice(false);
  assert.strictEqual(engine.cancels, 1);
  assert.strictEqual(engine.speaking, false);
});

check("skipping silences him until the skip ends", () => {
  const { Sound, engine, said } = loadWithVoice();
  Sound.speak("GAMES PLAYED: 0.");
  Sound.speak("TIC-TAC-TOE: 0 GAMES, 0 TIES.");
  Sound.setHushed(true); // the player pressed Enter to skip
  assert.strictEqual(engine.cancels, 1);
  Sound.speak("WARS STARTED: 0."); // text still printing: not spoken
  Sound.speak("ENDINGS WITNESSED: 0 OF 3.");
  assert.strictEqual(said().length, 2);
  Sound.setHushed(false);
});

check("the first gesture primes speech once, silently", () => {
  const { Sound, engine, said } = loadWithVoice();
  Sound.unlock();
  Sound.unlock();
  Sound.unlock();
  assert.strictEqual(engine.spoken.length, 1);
  assert.strictEqual(engine.spoken[0].volume, 0);
  assert.deepStrictEqual(said(), []);
});

(async () => {
  // Timing: what happens around an interruption.
  {
    const { Sound, engine, said } = loadWithVoice();
    Sound.speak("THE MACHINE IS DESIGNATED W.O.P.R.");
    Sound.shutUp(); // the player typed over him
    assert.strictEqual(engine.cancels, 1);
    Sound.speak("TO WIN THE GAME."); // his reply follows at once
    Sound.speak("AS YOU WISH, PROFESSOR.");
    assert.strictEqual(said().length, 1, "the reply waits for the engine to settle");
    await wait(400);
    assert.deepStrictEqual(said().slice(1), ["To win the game.", "As you wish, professor."]);
    passed += 1;
    console.log("ok - a reply straight after an interruption is held briefly, then spoken in order");
  }
  {
    const { Sound, engine, said } = loadWithVoice();
    Sound.speak("HELLO, PROFESSOR.");
    engine.finish(); // he finishes on his own
    Sound.speak("SHALL WE PLAY A GAME?"); // the next line lands right behind it
    assert.strictEqual(said().length, 1);
    await wait(400);
    assert.deepStrictEqual(said(), ["Hello, professor.", "Shall we play a game?"]);
    await wait(100);
    engine.finish();
    await wait(400);
    Sound.speak("FINE."); // long after he went quiet: no wait at all
    assert.strictEqual(said().length, 3);
    passed += 1;
    console.log("ok - a line right after he goes quiet waits a beat; a later one does not");
  }
  {
    const { Sound, engine, said } = loadWithVoice();
    Sound.speak("GREETINGS PROFESSOR FALKEN.");
    Sound.shutUp();
    Sound.speak("HOW ARE YOU FEELING TODAY?"); // held
    Sound.shutUp(); // the player acts again before it is released
    await wait(400);
    assert.deepStrictEqual(said(), ["Greetings professor Falken."], "a held line is dropped, not spoken late");
    assert.strictEqual(engine.cancels, 1, "nothing was speaking the second time");
    passed += 1;
    console.log("ok - a held line is dropped if the player acts again first");
  }
  console.log(`\nALL TESTS PASSED (${passed})`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

