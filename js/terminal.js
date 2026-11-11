/*
 * Green-phosphor terminal: typewriter output and a single input line.
 * Keystrokes go through an <input> (hidden on desktop, a visible bar on
 * touch devices) so mobile keyboards and IME composition work.
 *
 * Skipping: Enter, Escape, Space (with nothing typed), or a click/tap
 * fast-forwards the output up to the next prompt or animation. Letters
 * typed while output is still printing are kept as type-ahead and appear
 * at the next prompt.
 *
 * Every prompt runs its answer past `onCommand` first, so settings
 * commands (SOUND OFF, FAST, HELP...) work everywhere and never reach the
 * scene that asked the question.
 */
class Terminal {
  constructor({ screen, input, live, status, flash, crt, choices, more }) {
    this.screen = screen;
    this.input = input;
    this.live = live;
    this.statusEl = status || null;
    this.flashEl = flash || null;
    this.crt = crt || null;
    this.choicesEl = choices || null;
    this.moreEl = more || null;
    this.cursor = document.createElement("span");
    this.cursor.className = "cursor";
    this.cursor.textContent = "█";
    this.history = [];
    this.histIdx = 0;
    this.histDraft = "";
    this.reading = false;
    this._skip = false;
    this.fast = false;
    this.held = false; // an overlay is open: output and input wait
    this.stick = true; // follow new output unless the player scrolled back
    this.help = null; // what to do at the current prompt
    this.helpOwn = false; // the scene answers a typed HELP itself
    this.onCommand = null;
    this.maxLines = 500;
    this._readState = null;
    this._links = [];
    this._chw = 0;
    this.coarse =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches;

    document.addEventListener("keydown", (e) => this._onKey(e));
    document.addEventListener("click", (e) => this._onClick(e));
    this.input.addEventListener("input", () => this._mirror());
    window.addEventListener("focus", () => this._focus());
    window.addEventListener("resize", () => {
      this._chw = 0;
      this.settle();
    });

    // Scroll-back: only the player's own gestures detach the view from
    // the newest output; reaching the bottom again re-attaches it.
    const nearBottom = () =>
      this.screen.scrollHeight - this.screen.scrollTop - this.screen.clientHeight < 40;
    this.screen.addEventListener(
      "wheel",
      (e) => {
        if (e.deltaY < 0) this._detach();
      },
      { passive: true }
    );
    this.screen.addEventListener("touchmove", () => this._detach(), { passive: true });
    this.screen.addEventListener(
      "touchend",
      () => {
        if (nearBottom()) this._attach();
      },
      { passive: true }
    );
    this.screen.addEventListener(
      "scroll",
      () => {
        if (!this.stick && nearBottom()) this._attach();
      },
      { passive: true }
    );
    if (this.moreEl) {
      this.moreEl.addEventListener("click", (e) => {
        e.stopPropagation();
        this._attach();
        this._focus();
      });
    }
    this._focus();
  }

  // Skipping also quiets Joshua: the voice must not trail behind text the
  // player has chosen not to wait for.
  get skip() {
    return this._skip;
  }

  set skip(on) {
    this._skip = !!on;
    if (typeof Sound !== "undefined" && typeof Sound.setHushed === "function") {
      Sound.setHushed(this._skip);
    }
  }

  // Type a line that Joshua also speaks.
  async say(text, opts) {
    if (typeof Sound !== "undefined") Sound.speak(text);
    await this.type(text, opts);
  }

  async type(text, { cps = 30, cls = "" } = {}) {
    const delay = 1000 / cps;
    for (const row of String(text).split("\n")) {
      const line = this._line(cls);
      const span = document.createElement("span");
      line.appendChild(span);
      line.appendChild(this.cursor);
      for (const ch of row) {
        if (this.held) await this._released();
        span.textContent += ch;
        this._scroll();
        if (!this.skip && !this.fast) await sleep(delay);
      }
      this._announce(row);
      if (!this.skip && !this.fast) await sleep(60);
    }
  }

  print(text = "", cls = "") {
    for (const row of String(text).split("\n")) {
      const line = this._line(cls);
      line.textContent = row;
      this._announce(row);
    }
    this._scroll();
  }

  async pause(ms) {
    if (this.fast) ms = Math.min(ms, 120);
    let waited = 0;
    while (waited < ms && !this.skip) {
      if (this.held) await this._released();
      await sleep(40);
      waited += 40;
    }
  }

  // An animation is starting: a skip issued during earlier text must not
  // swallow it. The player can still skip the animation itself.
  resetSkip() {
    this.skip = false;
  }

  // Persistent DEFCON status bar above the screen. No-op when the status
  // element is absent (e.g. the node test stub). `right` may hold several
  // items separated by three or more spaces; each wraps as a unit.
  setStatus({ defcon, right = "" }) {
    if (!this.statusEl) return;
    const el = this.statusEl;
    el.className = "defcon-" + defcon;
    el.textContent = "";
    const label = document.createElement("span");
    label.className = "dc-label";
    label.textContent = "DEFCON " + defcon;
    const gauge = document.createElement("span");
    gauge.className = "dc-gauge";
    gauge.setAttribute("aria-hidden", "true");
    for (let i = 5; i >= 1; i--) {
      const seg = document.createElement("i");
      if (i >= defcon) seg.className = "lit";
      gauge.appendChild(seg);
    }
    el.appendChild(label);
    el.appendChild(gauge);
    for (const part of String(right).split(/\s{3,}/)) {
      if (!part) continue;
      const s = document.createElement("span");
      s.className = "dc-item";
      s.textContent = part;
      el.appendChild(s);
    }
    el.style.display = "flex";
    if (this.crt) {
      this.crt.classList.add("has-status");
      this.crt.setAttribute("data-defcon", String(defcon));
    }
    this._scroll();
  }

  clearStatus() {
    if (!this.statusEl) return;
    this.statusEl.style.display = "none";
    if (this.crt) {
      this.crt.classList.remove("has-status");
      this.crt.removeAttribute("data-defcon");
    }
  }

  // Programmatic input (chips, board clicks, speech). Only lands while a
  // prompt is open.
  submitLine(text) {
    if (!this.reading) return false;
    this.input.value = text;
    this._mirror();
    this._submit();
    return true;
  }

  // Fill the input without submitting (board clicks building a move).
  setInput(text) {
    if (!this.reading) return false;
    this.input.value = text;
    this._mirror();
    return true;
  }

  clear() {
    while (this.screen.firstElementChild) this.screen.firstElementChild.remove();
    this._links = [];
  }

  async whiteout() {
    if (!this.flashEl) return;
    this.flashEl.classList.add("on");
    await sleep(60);
  }

  clearFlash() {
    if (this.flashEl) this.flashEl.classList.remove("on");
  }

  // A canvas in the scrollback flow, or null where canvas is unsupported
  // (test stubs); callers fall back to the ASCII board. Call settle()
  // once the canvas has its size so the whole of it scrolls into view.
  canvasBlock({ pinned = false } = {}) {
    const line = this._line(pinned ? "canvas-line pinned" : "canvas-line");
    const canvas = document.createElement("canvas");
    if (typeof canvas.getContext !== "function") {
      line.remove();
      return null;
    }
    line.appendChild(canvas);
    return canvas;
  }

  settle() {
    this._fitPinned();
    this._scroll();
  }

  // A pinned block must leave room for the prompt under it. Where the
  // screen is too short for that, it is let go and scrolls normally.
  _fitPinned() {
    const pinned = this.screen.querySelectorAll(".line.pinned");
    if (!pinned.length) return;
    const fontPx = parseFloat(window.getComputedStyle(this.screen).fontSize) || 16;
    const room = this.screen.clientHeight - fontPx * 1.5 * 3;
    for (const el of pinned) el.classList.toggle("loose", el.offsetHeight > room);
  }

  // A block whose content is replaced per animation frame.
  frame(cls) {
    const line = this._line(cls);
    const self = this;
    return {
      set(text) {
        line.textContent = text;
        self._scroll();
      },
    };
  }

  // A bare block for custom content (the title card, the end card).
  block(cls) {
    return this._line(cls);
  }

  // A line that submits `value` when clicked, live only for the next
  // prompt (numbered choices). Typing the answer still works.
  link(text, value, cls = "") {
    const line = this._line(cls ? "option " + cls : "option");
    line.textContent = text;
    this._announce(text);
    this.makeLive(line, value);
    return line;
  }

  makeLive(el, value) {
    el.setAttribute("data-link", "");
    el.classList.add("live");
    const entry = { el, value };
    this._links.push(entry);
    el.addEventListener("click", (e) => {
      if (!this._links.includes(entry) || !this.reading) return;
      e.stopPropagation();
      this._sound("unlock"); // a tap here may be the first gesture
      this._sound("click");
      this.submitLine(typeof value === "function" ? value() : value);
    });
  }

  // A live board: rows of cells re-rendered in place. Cells with a key
  // `k` are clickable while a prompt is open. Pinned boards stay in view
  // while the move log scrolls beneath them.
  grid(cls = "") {
    const line = this._line("gridwrap");
    const el = document.createElement("div");
    el.className = cls ? "grid " + cls : "grid";
    line.appendChild(el);
    let handler = null;
    el.addEventListener("click", (e) => {
      const cell = e.target.closest ? e.target.closest("[data-k]") : null;
      if (!cell || !handler || !this.reading) return;
      e.stopPropagation();
      this._sound("unlock");
      this._sound("click");
      handler(cell.getAttribute("data-k"));
    });
    const self = this;
    return {
      el,
      render(rows, { onCell = null } = {}) {
        handler = onCell;
        el.textContent = "";
        for (const row of rows) {
          const r = document.createElement("div");
          r.className = "grow";
          for (const cell of row) {
            const c = document.createElement("span");
            c.className = cell.c ? "cell " + cell.c : "cell";
            c.textContent = cell.t == null ? "" : cell.t;
            if (cell.k != null && onCell) c.setAttribute("data-k", cell.k);
            r.appendChild(c);
          }
          el.appendChild(r);
        }
        self.settle();
      },
      pin() {
        line.classList.add("pinned");
        self.settle();
      },
      unpin() {
        line.classList.remove("pinned", "loose");
        handler = null;
        for (const c of el.querySelectorAll("[data-k]")) c.removeAttribute("data-k");
      },
    };
  }

  // Approximate characters per line, for laying out columns.
  cols() {
    if (!this._chw) {
      const probe = document.createElement("span");
      probe.textContent = "0000000000";
      probe.style.visibility = "hidden";
      probe.style.position = "absolute";
      this.screen.appendChild(probe);
      this._chw = probe.getBoundingClientRect().width / 10 || 8;
      probe.remove();
    }
    const cs = window.getComputedStyle(this.screen);
    const inner =
      this.screen.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
    return Math.max(20, Math.floor(inner / this._chw));
  }

  // Set the context help for the prompts that follow; returns a restore
  // function so a minigame can hand the previous context back. `own`
  // means the scene answers a typed HELP itself (LOGON, Joshua); the text
  // is then only shown in the help panel.
  pushHelp(text, { own = false } = {}) {
    const prev = [this.help, this.helpOwn];
    this.help = text;
    this.helpOwn = own;
    return () => {
      [this.help, this.helpOwn] = prev;
    };
  }

  hold(on) {
    this.held = !!on;
    if (!this.held) this._focus();
  }

  // Ask a question. opts: choices (chips), inputmode, keys (instant key
  // bindings while the line is empty), ghost (no visible prompt line).
  async read(prompt = "> ", opts = {}) {
    while (true) {
      const value = await this._readOnce(prompt, opts);
      if (this.onCommand && (await this.onCommand(value))) continue;
      return value;
    }
  }

  _readOnce(prompt, opts) {
    return new Promise((resolve) => {
      this.skip = false;
      const line = this._line(opts.ghost ? "input-line ghost" : "input-line");
      const promptSpan = document.createElement("span");
      promptSpan.textContent = prompt;
      const mirror = document.createElement("span");
      mirror.className = "mirror";
      mirror.textContent = this.input.value; // type-ahead survives
      line.appendChild(promptSpan);
      line.appendChild(mirror);
      line.appendChild(this.cursor);
      this._readState = { resolve, mirror, prompt, keys: opts.keys || null };
      this.reading = true;
      try {
        this.input.setAttribute("inputmode", opts.inputmode || "text");
        this.input.placeholder =
          opts.placeholder || prompt.replace(/[:>]/g, "").trim() || "TYPE A COMMAND";
      } catch (e) {
        /* attribute unsupported */
      }
      const choices = typeof opts.choices === "function" ? opts.choices() : opts.choices;
      this._setChoices(choices);
      this._attach();
      this._focus();
    });
  }

  _onKey(e) {
    if (this.held) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      const dir = e.key === "PageUp" ? -1 : 1;
      if (dir < 0) this._detach();
      this.screen.scrollTop += dir * this.screen.clientHeight * 0.8;
      return;
    }
    const printable = e.key.length === 1;
    const control = ["Enter", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Backspace", "Delete"];
    if (!printable && !control.includes(e.key)) return; // Shift, Tab, F-keys...
    this._sound("unlock");
    const active = document.activeElement;
    if (active && active.tagName === "BUTTON" && (e.key === "Enter" || e.key === " ")) return;
    if (printable || e.key === "Enter" || e.key === "Backspace") this._sound("click");
    this._focus(true);
    if (!this.reading) {
      const idle = !this.input.value;
      if (e.key === "Enter" || e.key === "Escape" || (e.key === " " && idle)) {
        e.preventDefault();
        this.skip = true;
      }
      return; // anything else is type-ahead for the next prompt
    }
    this._attach();
    const keys = this._readState.keys;
    if (keys && !this.input.value && Object.prototype.hasOwnProperty.call(keys, e.key)) {
      e.preventDefault();
      this.submitLine(keys[e.key]);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      this._submit();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this._histMove(-1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      this._histMove(1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      this.input.value = "";
      this._mirror();
    }
  }

  // Clicks and taps. A scroll gesture never produces a click, so dragging
  // the page to read back does not skip anything.
  _onClick(e) {
    this._sound("unlock");
    if (this.held) return;
    const t = e.target;
    if (t && t.closest && t.closest("button, a, input, canvas.live, [data-k], [data-link], #overlay")) {
      return;
    }
    if (!this.reading) this.skip = true;
    const sel = typeof window.getSelection === "function" ? String(window.getSelection()) : "";
    if (!sel) this._focus();
  }

  _submit() {
    const rs = this._readState;
    if (!rs) return;
    const value = this.input.value.trim();
    rs.mirror.textContent = this.input.value;
    this.cursor.remove();
    this._readState = null;
    this.reading = false;
    this.input.value = "";
    this._setChoices(null);
    this._expireLinks();
    // The player has spoken: Joshua stops mid-sentence, as in conversation.
    if (typeof Sound !== "undefined") Sound.shutUp();
    if (value && this.history[this.history.length - 1] !== value) {
      this.history.push(value);
    }
    this.histIdx = this.history.length;
    this.histDraft = "";
    this._announce(rs.prompt + value);
    this._attach();
    rs.resolve(value);
  }

  _histMove(dir) {
    if (!this.history.length) return;
    if (this.histIdx === this.history.length && dir === -1) {
      this.histDraft = this.input.value;
    }
    const next = Math.min(this.history.length, Math.max(0, this.histIdx + dir));
    if (next === this.histIdx) return;
    this.histIdx = next;
    this.input.value =
      next === this.history.length ? this.histDraft : this.history[next];
    this._mirror();
  }

  _mirror() {
    if (!this._readState) return;
    this._readState.mirror.textContent = this.input.value;
    this._scroll();
  }

  // Chips under the screen: tappable answers for the open prompt. Items
  // are strings or { label, value, on, cls }; value may be a function.
  _setChoices(list) {
    const box = this.choicesEl;
    if (!box) return;
    box.textContent = "";
    for (const item of list || []) {
      if (!item) continue;
      const label = typeof item === "string" ? item : item.label;
      const value = typeof item === "string" ? item : item.value == null ? item.label : item.value;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (item.on ? " on" : "") + (item.cls ? " " + item.cls : "");
      b.textContent = label;
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        this._sound("unlock");
        this._sound("click");
        this.submitLine(typeof value === "function" ? value() : value);
      });
      box.appendChild(b);
    }
    this._scroll();
  }

  _expireLinks() {
    for (const { el } of this._links) el.classList.remove("live");
    this._links = [];
  }

  _line(cls) {
    const div = document.createElement("div");
    div.className = cls ? "line " + cls : "line";
    this.screen.appendChild(div);
    while (this.screen.childElementCount > this.maxLines) {
      this.screen.firstElementChild.remove();
    }
    this._scroll();
    return div;
  }

  _scroll() {
    if (this.stick) {
      this.screen.scrollTop = this.screen.scrollHeight;
    } else if (this.moreEl) {
      this.moreEl.hidden = false;
    }
  }

  _detach() {
    this.stick = false;
  }

  _attach() {
    this.stick = true;
    if (this.moreEl) this.moreEl.hidden = true;
    this._scroll();
  }

  _released() {
    return new Promise((resolve) => {
      const tick = () => (this.held ? setTimeout(tick, 80) : resolve());
      tick();
    });
  }

  _sound(what) {
    if (typeof Sound === "undefined") return;
    if (what === "unlock") Sound.unlock();
    else if (what === "click") Sound.click();
  }

  _announce(text) {
    if (!text) return;
    const div = document.createElement("div");
    div.textContent = text;
    this.live.appendChild(div);
    while (this.live.childElementCount > 40) {
      this.live.firstElementChild.remove();
    }
  }

  // On touch devices the input is a visible bar the player taps; forcing
  // focus there would pop the keyboard open on every touch. `force` is
  // for real key presses, which only arrive from a hardware keyboard.
  _focus(force) {
    if (this.held) return;
    if (this.coarse && !force) return;
    if (document.activeElement === this.input) return;
    this.input.focus({ preventScroll: true });
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
