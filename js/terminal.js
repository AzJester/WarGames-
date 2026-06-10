/*
 * Green-phosphor terminal: typewriter output and a single input line.
 * Keystrokes go through a hidden <input> so mobile keyboards and IME
 * composition work. Any key or tap during output skips the typewriter;
 * the skip flag clears when the next read() begins.
 */
class Terminal {
  constructor({ screen, input, live }) {
    this.screen = screen;
    this.input = input;
    this.live = live;
    this.cursor = document.createElement("span");
    this.cursor.className = "cursor";
    this.cursor.textContent = "█";
    this.history = [];
    this.histIdx = 0;
    this.histDraft = "";
    this.reading = false;
    this.skip = false;
    this.maxLines = 500;
    this._readState = null;

    document.addEventListener("keydown", (e) => this._onKey(e));
    document.addEventListener("pointerdown", () => {
      if (!this.reading) this.skip = true;
      this._focus();
    });
    this.input.addEventListener("input", () => this._mirror());
    window.addEventListener("focus", () => this._focus());
    this._focus();
  }

  async type(text, { cps = 30, cls = "" } = {}) {
    const delay = 1000 / cps;
    for (const row of String(text).split("\n")) {
      const line = this._line(cls);
      const span = document.createElement("span");
      line.appendChild(span);
      line.appendChild(this.cursor);
      for (const ch of row) {
        span.textContent += ch;
        this._scroll();
        if (!this.skip) await sleep(delay);
      }
      this._announce(row);
      if (!this.skip) await sleep(60);
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
    let waited = 0;
    while (waited < ms && !this.skip) {
      await sleep(40);
      waited += 40;
    }
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

  read(prompt = "> ") {
    return new Promise((resolve) => {
      this.skip = false;
      this.input.value = "";
      const line = this._line("input-line");
      const promptSpan = document.createElement("span");
      promptSpan.textContent = prompt;
      const mirror = document.createElement("span");
      mirror.className = "mirror";
      line.appendChild(promptSpan);
      line.appendChild(mirror);
      line.appendChild(this.cursor);
      this._readState = { resolve, mirror, prompt };
      this.reading = true;
      this._focus();
      this._scroll();
    });
  }

  _onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (!this.reading) {
      this.skip = true;
      return;
    }
    this._focus();
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

  _submit() {
    const rs = this._readState;
    if (!rs) return;
    const value = this.input.value.trim();
    rs.mirror.textContent = this.input.value;
    this.cursor.remove();
    this._readState = null;
    this.reading = false;
    this.input.value = "";
    if (value && this.history[this.history.length - 1] !== value) {
      this.history.push(value);
    }
    this.histIdx = this.history.length;
    this.histDraft = "";
    this._announce(rs.prompt + value);
    this._scroll();
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
    this.screen.scrollTop = this.screen.scrollHeight;
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

  _focus() {
    this.input.focus({ preventScroll: true });
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
