/*
 * Settings, and the controls around the terminal: the corner toolbar and
 * the HELP / OPTIONS panel. Every setting here can also be typed as a
 * command (SOUND OFF, VIEW POLAR...); both routes go through Settings so
 * the toolbar, the panel, and the typed commands never disagree.
 * Settings is DOM-free; UI is a no-op where there is no document.
 * Requires sound.js, modern.js, engine.js (getDifficulty/setDifficulty).
 */

const Settings = (() => {
  function load(k) {
    try {
      if (typeof localStorage !== "undefined") return localStorage.getItem(k);
    } catch (e) {
      /* storage blocked */
    }
    return null;
  }

  function store(k, v) {
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(k, v);
    } catch (e) {
      /* storage blocked */
    }
  }

  let captions = load("wargames-captions") === "on";
  let buttons = load("wargames-buttons") !== "off";
  let fast = load("wargames-fast") === "1";
  const listeners = [];
  const hasSound = () => typeof Sound !== "undefined";
  const hasModern = () => typeof Modern !== "undefined";

  const defs = [
    {
      key: "sound",
      label: "SOUND",
      options: ["on", "off"],
      note: "Effects, music and voice.",
      get: () => (hasSound() && Sound.isEnabled() ? "on" : "off"),
      set: (v) => {
        if (!hasSound()) return;
        Sound.setEnabled(v === "on");
        if (v !== "on") Sound.shutUp();
      },
    },
    {
      key: "voice",
      label: "VOICE",
      options: ["on", "off"],
      note: "Joshua speaks his lines aloud.",
      get: () => (hasSound() && Sound.isVoiceOn() ? "on" : "off"),
      set: (v) => {
        if (hasSound()) Sound.setVoice(v === "on");
      },
    },
    {
      key: "speed",
      label: "TEXT SPEED",
      options: ["normal", "fast"],
      note: "Fast prints text instantly.",
      get: () => (fast ? "fast" : "normal"),
      set: (v) => {
        fast = v === "fast";
        store("wargames-fast", fast ? "1" : "0");
      },
    },
    {
      key: "captions",
      label: "CAPTIONS",
      options: ["on", "off"],
      note: "Labels for non-speech sounds.",
      get: () => (captions ? "on" : "off"),
      set: (v) => {
        captions = v === "on";
        store("wargames-captions", captions ? "on" : "off");
      },
    },
    {
      key: "buttons",
      label: "BUTTONS",
      options: ["on", "off"],
      note: "Tappable answers under the screen.",
      get: () => (buttons ? "on" : "off"),
      set: (v) => {
        buttons = v === "on";
        store("wargames-buttons", buttons ? "on" : "off");
      },
    },
    {
      key: "mode",
      label: "DISPLAY",
      options: ["modern", "classic"],
      note: "Canvas big board, or the ASCII original.",
      get: () => (hasModern() && !Modern.isModern() ? "classic" : "modern"),
      set: (v) => {
        if (hasModern()) Modern.setMode(v);
      },
    },
    {
      key: "view",
      label: "BOARD VIEW",
      options: ["flat", "polar"],
      note: "Polar is the NORAD over-the-pole wall map.",
      get: () => (hasModern() ? Modern.getView() : "flat"),
      set: (v) => {
        if (hasModern()) Modern.setView(v);
      },
    },
    {
      key: "difficulty",
      label: "DIFFICULTY",
      options: ["easy", "normal", "hard"],
      note: "Game AIs and missile defenses.",
      get: () => (typeof getDifficulty === "function" ? getDifficulty() : "normal"),
      set: (v) => {
        if (typeof setDifficulty === "function") setDifficulty(v);
      },
    },
  ];

  const find = (key) => defs.find((d) => d.key === key);

  function get(key) {
    const d = find(key);
    return d ? d.get() : null;
  }

  // Returns the value now in effect (an unknown value leaves it alone).
  function set(key, value) {
    const d = find(key);
    if (!d) return null;
    if (d.options.includes(value)) {
      d.set(value);
      for (const fn of listeners) fn(key, d.get());
    }
    return d.get();
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  return { defs, get, set, onChange };
})();

// Things to type that are not settings. Shown in the help panel.
const COMMAND_HELP = [
  ["HELP", "What to do at the prompt in front of you"],
  ["OPTIONS", "This panel"],
  ["STORY", "A one-minute, spoiler-free briefing"],
  ["STATS", "Your record and the endings you have found"],
  ["SHARE", "Save a keepsake card, once you reach an ending"],
  ["MENU", "Jump to any act (title screen, after finishing)"],
  ["LISTEN ON", "Speak your commands (Chrome)"],
  ["RESET", "Wipe saved progress (at the LOGON prompt)"],
  ["ENTER, SPACE, TAP", "Skip ahead while text is printing"],
  ["PAGE UP / DOWN", "Scroll back through the session"],
  ["UP / DOWN", "Recall something you typed earlier"],
];

const DEFAULT_HELP = "Type a command and press Enter, or pick one of the buttons under the screen.";

const UI = (() => {
  let term = null;
  let overlay = null;
  let toolbar = null;
  let opener = null;
  const hasDom = () => typeof document !== "undefined";

  function init(t) {
    term = t;
    if (!hasDom()) return;
    overlay = document.getElementById("overlay");
    toolbar = document.getElementById("toolbar");
    if (toolbar) {
      toolbar.addEventListener("click", (e) => {
        const btn = e.target.closest ? e.target.closest("button[data-ctl]") : null;
        if (!btn) return;
        if (typeof Sound !== "undefined") Sound.unlock();
        const ctl = btn.getAttribute("data-ctl");
        if (ctl === "help") {
          open(btn);
          return;
        }
        if (ctl === "fast") {
          Settings.set("speed", Settings.get("speed") === "fast" ? "normal" : "fast");
        } else {
          Settings.set(ctl, Settings.get(ctl) === "on" ? "off" : "on");
        }
        // A mouse click should not leave Enter bound to the button.
        if (e.detail > 0) {
          btn.blur();
          if (term) term._focus();
        }
      });
    }
    if (overlay) {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) close();
      });
      overlay.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          close();
          return;
        }
        if (e.key !== "Tab") return;
        const items = overlay.querySelectorAll("button");
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      });
    }
    Settings.onChange(sync);
    sync();
  }

  // Push the current settings into the toolbar, the monitor, and the
  // panel if it is open.
  function sync() {
    if (term) term.fast = Settings.get("speed") === "fast";
    if (!hasDom()) return;
    const crt = document.getElementById("crt");
    if (crt) crt.classList.toggle("no-buttons", Settings.get("buttons") === "off");
    if (toolbar) {
      const pressed = {
        sound: Settings.get("sound") === "on",
        voice: Settings.get("voice") === "on" && Settings.get("sound") === "on",
        fast: Settings.get("speed") === "fast",
      };
      for (const btn of toolbar.querySelectorAll("button[data-ctl]")) {
        const ctl = btn.getAttribute("data-ctl");
        if (ctl in pressed) btn.setAttribute("aria-pressed", pressed[ctl] ? "true" : "false");
      }
    }
    if (overlay && !overlay.hidden) {
      for (const btn of overlay.querySelectorAll("button[data-set]")) {
        const [key, value] = btn.getAttribute("data-set").split("=");
        btn.setAttribute("aria-pressed", Settings.get(key) === value ? "true" : "false");
      }
    }
  }

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function open(from) {
    if (!hasDom() || !overlay) return false;
    opener = from || null;
    overlay.textContent = "";
    const panel = el("div", "panel");

    const head = el("h2");
    const title = el("span", "", "HELP AND OPTIONS");
    title.id = "overlay-title";
    const closeBtn = el("button", "", "CLOSE");
    closeBtn.type = "button";
    closeBtn.addEventListener("click", close);
    head.appendChild(title);
    head.appendChild(closeBtn);
    panel.appendChild(head);

    panel.appendChild(el("h3", "", "RIGHT NOW"));
    panel.appendChild(el("p", "now", (term && term.help) || DEFAULT_HELP));

    panel.appendChild(el("h3", "", "SETTINGS"));
    for (const d of Settings.defs) {
      const row = el("div", "setting");
      row.appendChild(el("span", "name", d.label));
      const seg = el("span", "seg");
      for (const opt of d.options) {
        const b = el("button", "", opt.toUpperCase());
        b.type = "button";
        b.setAttribute("data-set", d.key + "=" + opt);
        b.setAttribute("aria-label", d.label + " " + opt);
        b.addEventListener("click", () => Settings.set(d.key, opt));
        seg.appendChild(b);
      }
      row.appendChild(seg);
      row.appendChild(el("span", "note", d.note));
      panel.appendChild(row);
    }

    panel.appendChild(el("h3", "", "ANY PROMPT ALSO TAKES"));
    const dl = el("dl", "cmds");
    for (const [cmd, what] of COMMAND_HELP) {
      dl.appendChild(el("dt", "", cmd));
      dl.appendChild(el("dd", "", what));
    }
    panel.appendChild(dl);
    panel.appendChild(
      el("p", "note", "Every setting can be typed too: SOUND OFF, FAST, VIEW POLAR, DIFFICULTY HARD.")
    );

    overlay.appendChild(panel);
    overlay.hidden = false;
    if (term) term.hold(true);
    sync();
    closeBtn.focus();
    return true;
  }

  function close() {
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    overlay.textContent = "";
    if (opener && typeof opener.blur === "function") opener.blur();
    opener = null;
    if (term) term.hold(false);
  }

  const isOpen = () => !!overlay && !overlay.hidden;

  return { init, sync, open, close, isOpen };
})();
