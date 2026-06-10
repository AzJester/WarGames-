/*
 * Synthesized period sound via WebAudio: a dial-up handshake, a war-room
 * klaxon, and key clicks. No audio files, so it stays dependency-free.
 *
 * On by default; SOUND OFF persists the choice. Browsers block audio until
 * a user gesture, so unlock() runs on the first keypress or tap. Every
 * method is a harmless no-op where WebAudio is absent (e.g. node tests).
 */

const Sound = (() => {
  const AC =
    (typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext)) || null;
  const SS = (typeof window !== "undefined" && window.speechSynthesis) || null;
  const SU = (typeof window !== "undefined" && window.SpeechSynthesisUtterance) || null;
  let ctx = null;
  let enabled = true;
  let voiceOn = true;
  let chosenVoice = null;

  try {
    if (typeof localStorage !== "undefined") {
      if (localStorage.getItem("wargames-sound") === "off") enabled = false;
      if (localStorage.getItem("wargames-voice") === "off") voiceOn = false;
    }
  } catch (e) {
    /* storage blocked */
  }

  // Pick a low, machine-like English voice when the list is ready.
  function pickVoice() {
    if (!SS) return;
    const vs = SS.getVoices ? SS.getVoices() : [];
    if (!vs || !vs.length) return;
    chosenVoice =
      vs.find((v) => /en[-_]?US/i.test(v.lang) && /(david|mark|daniel|zarvox|google us)/i.test(v.name)) ||
      vs.find((v) => /^en/i.test(v.lang)) ||
      vs[0];
  }
  if (SS) {
    pickVoice();
    if (typeof SS.addEventListener === "function") SS.addEventListener("voiceschanged", pickVoice);
  }

  function unlock() {
    if (!AC || !enabled) return;
    if (!ctx) {
      try {
        ctx = new AC();
      } catch (e) {
        ctx = null;
      }
    }
    if (ctx && ctx.state === "suspended") ctx.resume();
  }

  function setEnabled(on) {
    enabled = !!on;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("wargames-sound", enabled ? "on" : "off");
      }
    } catch (e) {
      /* storage blocked */
    }
    if (enabled) unlock();
  }

  function isEnabled() {
    return enabled;
  }

  function tone(freq, start, dur, opts = {}) {
    if (!ctx) return;
    const { type = "sine", gain = 0.08, glideTo = null } = opts;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(gain, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  function hiss(start, dur, gain = 0.05) {
    if (!ctx) return;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1800;
    filter.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filter).connect(g).connect(ctx.destination);
    src.start(start);
    src.stop(start + dur);
  }

  // The classic dial-up sequence: dial tone, touch-tones, ring, handshake.
  function modem() {
    unlock();
    if (!ctx || !enabled) return;
    const t = ctx.currentTime;
    tone(350, t, 0.45, { gain: 0.05 });
    tone(440, t, 0.45, { gain: 0.05 });
    let x = t + 0.55;
    const lows = [697, 770, 852, 941];
    for (let i = 0; i < 7; i++) {
      tone(lows[i % lows.length], x, 0.08, { type: "square", gain: 0.05 });
      tone(1336, x, 0.08, { type: "square", gain: 0.04 });
      x += 0.12;
    }
    tone(440, x + 0.1, 0.4, { gain: 0.05 });
    tone(480, x + 0.1, 0.4, { gain: 0.05 });
    const h = x + 0.65;
    tone(1200, h, 0.5, { type: "sawtooth", gain: 0.04, glideTo: 2200 });
    tone(2400, h + 0.2, 0.6, { type: "square", gain: 0.03, glideTo: 1100 });
    hiss(h + 0.1, 0.9, 0.05);
  }

  // Two-tone war-room alarm.
  function klaxon() {
    unlock();
    if (!ctx || !enabled) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const s = t + i * 0.5;
      tone(620, s, 0.25, { type: "square", gain: 0.06 });
      tone(440, s + 0.25, 0.25, { type: "square", gain: 0.06 });
    }
  }

  function click() {
    if (!ctx || !enabled) return;
    tone(1400 + Math.random() * 220, ctx.currentTime, 0.012, { type: "square", gain: 0.014 });
  }

  function beep() {
    unlock();
    if (!ctx || !enabled) return;
    tone(880, ctx.currentTime, 0.08, { type: "square", gain: 0.04 });
  }

  // WOPR's synthesized voice. Lines are queued; new player input cancels
  // any backlog via shutUp(). Speaker prefixes and glyphs are stripped.
  function speak(text) {
    if (!SS || !SU || !enabled || !voiceOn) return;
    const clean = String(text)
      .replace(/^\s*(W\.?O\.?P\.?R\.?|JOSHUA)\s*:?\s*/i, "")
      .replace(/[█▲●▓▒░·]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!clean) return;
    if (!chosenVoice) pickVoice();
    const u = new SU(clean);
    u.rate = 0.86;
    u.pitch = 0.4;
    u.volume = 0.9;
    if (chosenVoice) u.voice = chosenVoice;
    try {
      SS.speak(u);
    } catch (e) {
      /* speech unavailable */
    }
  }

  function shutUp() {
    if (SS && typeof SS.cancel === "function") SS.cancel();
  }

  function setVoice(on) {
    voiceOn = !!on;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("wargames-voice", voiceOn ? "on" : "off");
      }
    } catch (e) {
      /* storage blocked */
    }
    if (!voiceOn) shutUp();
  }

  function isVoiceOn() {
    return voiceOn;
  }

  return {
    unlock,
    setEnabled,
    isEnabled,
    setVoice,
    isVoiceOn,
    modem,
    klaxon,
    click,
    beep,
    speak,
    shutUp,
  };
})();
