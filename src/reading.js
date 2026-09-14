import { t } from "./i18n.js";
/* The story text lives on a flat reading card (real HTML, no perspective) so it is big and
   crisp for early readers. Words are individual spans: they cascade in when a page arrives,
   light up as the narrator reads, can be tapped to hear them (and zoom), and nouns are
   linked to the objects in the pop-up scene. */
import { cleanWord } from "./narration.js";

/** The dictionary key of a word: no accents, no case, letters and digits only ("s'il_vous_plaît" -> "silvousplait"). */
export function vocabKey(text) {
  return String(text || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function tokenize(text) {
  if (!text) return [];
  const hasSpaces = /\s/.test(text.trim());
  if (hasSpaces && !/[\u4e00-\u9fa5]/.test(text)) {
    return text.split(/\s+/).filter(Boolean).map((raw, index) => {
      const m = raw.match(/^([^{]*)\{([^}:]+)(?::([^}]+))?\}(.*)$/);
      if (m) {
        const [target, action] = (m[3] || cleanWord(m[2])).split("/");
        return { index, text: (m[1] + m[2] + m[4]).replace(/_/g, " "), link: target, action: action || null, clean: cleanWord(m[2]), braced: true };
      }
      return { index, text: raw.replace(/_/g, " "), link: null, clean: cleanWord(raw) };
    });
  }
  const tokens = [];
  let index = 0;
  const re = /\{([^}:]+)(?::([^}]+))?\}/g;
  let lastIndex = 0;
  let match;
  while ((match = re.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index);
    if (before) {
      const parts = before.split(/([，。！？；、\s]+)/).filter(Boolean);
      for (const p of parts) {
        if (p.trim()) tokens.push({ index: index++, text: p.replace(/_/g, " "), link: null, clean: cleanWord(p) });
      }
    }
    const [target, action] = (match[2] || cleanWord(match[1])).split("/");
    tokens.push({
      index: index++,
      text: match[1].replace(/_/g, " "),
      link: target,
      action: action || null,
      clean: cleanWord(match[1]),
      braced: true
    });
    lastIndex = re.lastIndex;
  }
  const after = text.slice(lastIndex);
  if (after) {
    const parts = after.split(/([，。！？；、\s]+)/).filter(Boolean);
    for (const p of parts) {
      if (p.trim()) tokens.push({ index: index++, text: p.replace(/_/g, " "), link: null, clean: cleanWord(p) });
    }
  }
  return tokens;
}

export class Reading {
  constructor({ story, panel, settings, handlers }) {
    this.story = story;
    this.panel = panel;
    this.settings = settings;
    this.handlers = handlers; // { onWordTap(page, wordIndex, token, span), onLinkHover(name, on, span), onPanelTap() }
    this.el = {
      eyebrow: panel.querySelector("#page-eyebrow"),
      heading: panel.querySelector("#page-heading"),
      words: panel.querySelector("#page-words"),
      hint: panel.querySelector("#page-hint"),
      inner: panel.querySelector(".text-panel-inner"),
      done: panel.querySelector("#read-done"),
    };
    // self-read: the star button appears once the page has had time to be read, and says so
    if (this.el.done) this.el.done.addEventListener("click", (event) => { event.stopPropagation(); const page = this.current; this.hideDone(); if (this.handlers.onDone) this.handlers.onDone(page); });
    // a long page scrolls inside the card; the fade at the edges says there is more
    if (this.el.inner) this.el.inner.addEventListener("scroll", () => this.updateOverflow(), { passive: true });
    window.addEventListener("resize", () => this.updateOverflow());
    this.pages = new Map();
    this.current = null;
    this.mode = "listen";
    this.focused = false;
    if (settings.textSize === "large") panel.classList.add("size-large");
    panel.addEventListener("click", (event) => {
      if (event.target.closest(".word")) return;
      this.toggleFocus();
      if (this.handlers.onPanelTap) this.handlers.onPanelTap(this.focused);
    });
  }

  /** Swap to another book's text. */
  setStory(story) {
    this.story = story;
    this.pages = new Map();
    this.current = null;
    this.spans = null;
    this.panel.hidden = true;
  }

  /** The vocabulary entry behind a token (language books only; only braced tokens count). */
  vocabFor(token) {
    const vocab = this.story && this.story.vocab;
    if (!vocab || !token.braced) return null;
    const key = vocabKey(token.text);
    return vocab[key] ? { key, ...vocab[key] } : null;
  }

  tokensFor(pageIndex) {
    if (this.pages.has(pageIndex)) return this.pages.get(pageIndex);
    const page = pageIndex < this.story.pages.length ? this.story.pages[pageIndex] : null;
    const text = page ? page.text : `${this.story.end.text} ${this.story.end.prompt}`;
    const tokens = tokenize(text);
    this.pages.set(pageIndex, tokens);
    return tokens;
  }

  wordsFor(pageIndex) {
    return this.tokensFor(pageIndex);
  }

  /** Swap the card to a page: the old text turns away, the new words cascade in. */
  show(pageIndex, { direction = 1 } = {}) {
    const page = pageIndex < this.story.pages.length ? this.story.pages[pageIndex] : null;
    const tokens = this.tokensFor(pageIndex);
    const render = () => {
      this.panel.classList.remove("turning", "hud");
      this.el.eyebrow.textContent = page ? t("pageOf", { n: pageIndex + 1, total: this.story.pages.length }) : t("lastPage");
      this.el.heading.textContent = page ? page.heading : this.story.end.heading;
      this.el.heading.style.animation = "none";
      void this.el.heading.offsetWidth;
      this.el.heading.style.animation = "";
      this.el.hint.textContent = page ? page.hint || "" : this.story.end.prompt;
      const p = this.el.words;
      p.innerHTML = "";
      this.spans = [];
      tokens.forEach((token, i) => {
        const span = document.createElement("span");
        span.className = "word" + (token.link ? " link" : "");
        const vocab = this.vocabFor(token);
        if (vocab) {
          // a souvenir word: the sentence keeps the romanised spelling, the native script floats above it
          const lang = (this.story.language && this.story.language.code) || "";
          const rt = vocab.roman ? vocab.script : vocab.meaning;
          span.classList.add("foreign");
          span.dataset.vocab = vocab.key;
          span.innerHTML = `<ruby>${escapeHtml(token.text)}<rt lang="${lang}">${escapeHtml(rt)}</rt></ruby>`;
          span.title = `${vocab.script}${vocab.roman ? ` · ${vocab.roman}` : ""} · ${vocab.meaning}`;
        } else span.textContent = token.text;
        span.style.setProperty("--i", String(i));
        span.dataset.index = String(i);
        if (token.link) span.dataset.object = token.link;
        span.addEventListener("pointerenter", () => { if (token.link && this.handlers.onLinkHover) this.handlers.onLinkHover(token.link, true, span); });
        span.addEventListener("pointerleave", () => { if (token.link && this.handlers.onLinkHover) this.handlers.onLinkHover(token.link, false, span); });
        span.addEventListener("click", (event) => {
          event.stopPropagation();
          span.classList.remove("said");
          void span.offsetWidth;
          span.classList.add("said");
          if (this.handlers.onWordTap) this.handlers.onWordTap(pageIndex, i, token, span);
        });
        p.appendChild(span);
        const nextToken = tokens[i + 1];
        const isChineseChar = /[\u4e00-\u9fa5，。！？；、：“”‘’（）《》]/.test(token.text) || (nextToken && /[\u4e00-\u9fa5，。！？；、：“”‘’（）《》]/.test(nextToken.text));
        if (i < tokens.length - 1 && !isChineseChar) p.appendChild(document.createTextNode(" "));
        this.spans.push(span);
      });
      this.panel.classList.add("arriving");
      this.panel.classList.toggle("self-read", this.mode === "self");
      setTimeout(() => this.panel.classList.remove("arriving"), 750);
    };
    this.hideDone();
    this.current = pageIndex;
    render();
    this.panel.hidden = false;
    if (this.el.inner) this.el.inner.scrollTop = 0;
    this.updateOverflow();
    requestAnimationFrame(() => this.updateOverflow());
  }

  /** Mark the card when its text is taller than the card, and which edges still hide some. */
  updateOverflow() {
    const s = this.el.inner;
    if (!s || this.panel.hidden) return;
    const over = s.scrollHeight > s.clientHeight + 2;
    this.panel.classList.toggle("overflowing", over);
    this.panel.classList.toggle("scrolled", over && s.scrollTop > 4);
    this.panel.classList.toggle("at-end", !over || s.scrollTop + s.clientHeight >= s.scrollHeight - 2);
  }

  /** Start turning the card away (called when the page starts to flip). */
  leave() {
    this.clearActive();
    this.panel.classList.remove("arriving", "hud");
    this.panel.classList.add("turning");
  }

  hide() {
    this.clearActive();
  }

  toggleFocus(force) {
    this.focused = force != null ? force : !this.focused;
    this.panel.classList.toggle("focus", this.focused);
    const veil = document.getElementById("focus-veil");
    if (veil) veil.hidden = !this.focused;
    return this.focused;
  }

  setMode(mode) {
    this.mode = mode;
    this.panel.classList.toggle("self-read", mode === "self");
    if (mode !== "self") this.hideDone();
  }

  /** Self-read: offer the "I read it" star after `delay` ms, if the reader is still on this page. */
  offerDone(pageIndex, delay) {
    this.hideDone();
    if (!this.el.done) return;
    this.doneTimer = setTimeout(() => {
      if (this.current !== pageIndex || this.mode !== "self" || this.panel.hidden) return;
      this.el.done.hidden = false;
      this.updateOverflow();
    }, delay);
  }

  hideDone() {
    clearTimeout(this.doneTimer);
    if (this.el.done) this.el.done.hidden = true;
  }

  /** Screen point where a page's star appears: the last word of the text, or the card's foot. */
  starOrigin() {
    const last = this.spans && this.spans.length ? this.spans[this.spans.length - 1] : null;
    const r = last ? last.getBoundingClientRect() : this.panel.getBoundingClientRect();
    if (last && r.width) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    return { x: r.left + r.width / 2, y: r.bottom - 30 };
  }

  setTextSize(size) {
    this.settings.textSize = size;
    this.panel.classList.toggle("size-large", size === "large");
  }

  setActiveWord(index) {
    if (!this.spans) return;
    this.spans.forEach((el, i) => {
      el.classList.toggle("active", i === index);
      if (i < index) el.classList.add("spoken");
    });
    // keep the active word in view when the card scrolls on small screens
    const el = this.spans[index];
    if (el && this.panel.scrollHeight > this.panel.clientHeight) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  clearActive() {
    if (!this.spans) return;
    this.spans.forEach((el) => el.classList.remove("active"));
  }

  highlightObject(name, on) {
    if (!this.spans) return;
    const tokens = this.tokensFor(this.current);
    this.spans.forEach((el, i) => {
      if (tokens[i].link === name) el.classList.toggle("lit", on);
    });
  }

  spanFor(index) {
    return this.spans ? this.spans[index] : null;
  }
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
