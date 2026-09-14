import { assetUrl } from "./assets.js";
/* Narration: fetches or synthesizes the voice for each page, works out when each word is
   spoken, and plays it back with word callbacks.

   Providers, in the order tried by "auto":
     openai  — POST /api/tts on the local server (server.py proxies the OpenAI speech API and
               whisper word timestamps). Expressive, any text, needs an API key on the server.
     bundled — books/<id>/voice/page-N.mp3 generated ahead of time. Word timings come from a
               syllable-weighted energy alignment done in the browser (or timings.json if present).
     browser — the Web Speech API. Word boundaries come from its `boundary` events. */

const STOP_PUNCT = /[.!?]["”']?$/;
const PHRASE_PUNCT = /[,.!?;:]["”']?$/;

export function cleanWord(word) {
  return String(word).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9']/g, "");
}

export function syllables(word) {
  const w = cleanWord(word);
  if (!w) return 1;
  const groups = w.replace(/e$/, "").match(/[aeiouy]+/g);
  return Math.max(1, groups ? groups.length : 1);
}

/* ---------- alignment helpers ---------- */

function envelope(buffer, hop = 0.01) {
  const rate = buffer.sampleRate;
  const hopSamples = Math.max(1, Math.round(rate * hop));
  const channels = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) channels.push(buffer.getChannelData(c));
  const frames = Math.floor(buffer.length / hopSamples);
  const rms = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    const start = f * hopSamples;
    for (let i = start; i < start + hopSamples; i++) {
      let v = 0;
      for (const ch of channels) v += ch[i];
      v /= channels.length;
      sum += v * v;
    }
    rms[f] = Math.sqrt(sum / hopSamples);
  }
  // light smoothing (5 frames)
  const out = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let s = 0, n = 0;
    for (let k = -2; k <= 2; k++) {
      const j = f + k;
      if (j >= 0 && j < frames) { s += rms[j]; n++; }
    }
    out[f] = s / n;
  }
  return { rms: out, hop };
}

function speechRegions(env, minGap = 0.11, minRegion = 0.05) {
  const { rms, hop } = env;
  const sorted = Array.from(rms).sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.1)] || 0;
  const peak = sorted[Math.floor(sorted.length * 0.98)] || 1;
  const threshold = floor + (peak - floor) * 0.14;
  const regions = [];
  let start = -1;
  for (let f = 0; f <= rms.length; f++) {
    const on = f < rms.length && rms[f] > threshold;
    if (on && start < 0) start = f;
    if (!on && start >= 0) {
      regions.push({ start: start * hop, end: f * hop });
      start = -1;
    }
  }
  // merge short gaps
  const merged = [];
  for (const r of regions) {
    const last = merged[merged.length - 1];
    if (last && r.start - last.end < minGap) last.end = r.end;
    else merged.push({ ...r });
  }
  return merged.filter((r) => r.end - r.start >= minRegion);
}

function mergeToCount(regions, count) {
  const out = regions.map((r) => ({ ...r }));
  while (out.length > count) {
    let best = 0, bestGap = Infinity;
    for (let i = 0; i < out.length - 1; i++) {
      const gap = out[i + 1].start - out[i].end;
      if (gap < bestGap) { bestGap = gap; best = i; }
    }
    out[best].end = out[best + 1].end;
    out.splice(best + 1, 1);
  }
  return out;
}

function spreadWords(words, start, end) {
  const weights = words.map((w) => syllables(w) + 0.55 + (STOP_PUNCT.test(w) ? 0.35 : 0));
  const total = weights.reduce((a, b) => a + b, 0);
  const span = end - start;
  const out = [];
  let t = start;
  words.forEach((w, i) => {
    const d = (weights[i] / total) * span;
    out.push({ start: t, end: t + d });
    t += d;
  });
  return out;
}

/** Estimate word timings from the audio energy envelope. Returns [{start,end}] per word. */
export function alignByEnergy(buffer, words) {
  if (!words.length) return [];
  const env = envelope(buffer);
  let regions = speechRegions(env);
  if (!regions.length) return spreadWords(words, 0, buffer.duration);
  // phrases split at punctuation
  const phrases = [];
  let current = [];
  words.forEach((w, i) => {
    current.push(i);
    if (PHRASE_PUNCT.test(w) || i === words.length - 1) { phrases.push(current); current = []; }
  });
  const sentences = [];
  current = [];
  words.forEach((w, i) => {
    current.push(i);
    if (STOP_PUNCT.test(w) || i === words.length - 1) { sentences.push(current); current = []; }
  });
  const timings = new Array(words.length);
  const assign = (groups, regs) => {
    groups.forEach((group, gi) => {
      const r = regs[gi];
      const spread = spreadWords(group.map((i) => words[i]), r.start, r.end);
      group.forEach((wi, k) => { timings[wi] = spread[k]; });
    });
  };
  if (regions.length === phrases.length) assign(phrases, regions);
  else if (regions.length > phrases.length) assign(phrases, mergeToCount(regions, phrases.length));
  else if (regions.length === sentences.length) assign(sentences, regions);
  else if (regions.length > sentences.length) assign(sentences, mergeToCount(regions, sentences.length));
  else {
    // fewer regions than sentences: distribute over the speech span proportionally
    const span = spreadWords(words, regions[0].start, regions[regions.length - 1].end);
    span.forEach((t, i) => { timings[i] = t; });
  }
  return timings;
}

/** Match whisper word timestamps to the script words (sequential fuzzy match + interpolation). */
export function alignByTranscript(transcript, words, duration) {
  const t = transcript.map((w) => ({ ...w, clean: cleanWord(w.word) }));
  const timings = new Array(words.length).fill(null);
  let j = 0;
  words.forEach((word, i) => {
    const clean = cleanWord(word);
    for (let k = j; k < Math.min(t.length, j + 4); k++) {
      if (t[k].clean === clean || (clean.length > 3 && t[k].clean.startsWith(clean.slice(0, 4)))) {
        timings[i] = { start: t[k].start, end: t[k].end };
        j = k + 1;
        break;
      }
    }
  });
  // fill gaps by interpolation between known neighbours
  let lastKnown = -1;
  for (let i = 0; i <= words.length; i++) {
    if (i === words.length || timings[i]) {
      const from = lastKnown < 0 ? 0 : timings[lastKnown].end;
      const to = i === words.length ? duration || (lastKnown >= 0 ? timings[lastKnown].end + 1 : 1) : timings[i].start;
      const gapWords = [];
      for (let k = lastKnown + 1; k < i; k++) gapWords.push(k);
      if (gapWords.length) {
        const spread = spreadWords(gapWords.map((k) => words[k]), from, Math.max(from + 0.05, to));
        gapWords.forEach((k, idx) => { timings[k] = spread[idx]; });
      }
      lastKnown = i;
    }
  }
  return timings;
}

/* ---------- narrator ---------- */

import { t } from "./i18n.js";

export class Narrator {
  constructor({ context, story, bookBase, settings, onStatus }) {
    this.ctx = context;
    this.story = story;
    this.bookBase = bookBase;
    this.settings = settings;
    this.onStatus = onStatus || (() => {});
    this.cache = new Map();
    this.server = { checked: false, openai: false, voices: [] };
    this.current = null; // { page, source, startedAt, offset, timings, buffer, duration, provider, utterance }
    this.gain = context.createGain();
    this.gain.gain.value = 1;
    this.gain.connect(context.destination);
    this.callbacks = {};
    this.wordIndex = -1;
    this.paused = false;
  }

  async checkServer() {
    if (this.server.checked) return this.server;
    this.server.checked = true;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const res = await fetch("/api/status", { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        this.server.openai = !!data.openai;
        this.server.voices = data.voices || [];
      }
    } catch (error) {
      this.server.openai = false;
    }
    return this.server;
  }

  provider() {
    const pref = this.settings.voice || "auto";
    if (pref === "openai") return this.server.openai ? "openai" : "bundled";
    if (pref === "bundled") return "bundled";
    if (pref === "browser") return "browser";
    return this.server.openai ? "openai" : "bundled";
  }

  /** Swap to another book: drop every prepared page of the old one. */
  setStory(story, bookBase) {
    this.stop();
    this.story = story;
    this.bookBase = bookBase;
    this.cache.clear();
  }

  pageText(pageIndex) {
    const pages = this.story.pages;
    if (pageIndex < pages.length) return pages[pageIndex].text.replace(/\{([^}:]+)(?::[^}]+)?\}/g, "$1");
    const end = this.story.end;
    return `${end.heading}. ${end.text} ${end.prompt}`;
  }

  /** The words of the reading card, in its index space (the spoken end page also says the
      heading "The End." first, but the card and timings.json count only the story tokens). */
  words(pageIndex) {
    const pages = this.story.pages;
    const text = pageIndex < pages.length ? pages[pageIndex].text : `${this.story.end.text} ${this.story.end.prompt}`;
    return text.replace(/\{([^}:]+)(?::[^}]+)?\}/g, "$1").split(/\s+/).filter(Boolean);
  }

  /** Resolve audio + timings for a page with the active provider (falls back down the chain). */
  async prepare(pageIndex) {
    await this.checkServer();
    const provider = this.provider();
    const key = `${provider}:${pageIndex}:${this.settings.openaiVoice || ""}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const words = this.words(pageIndex);
    const task = (async () => {
      if (provider === "openai") {
        try {
          return await this.prepareOpenAI(pageIndex, words);
        } catch (error) {
          console.warn("OpenAI narration failed, using bundled voice", error);
          this.onStatus(t("openaiUnavailable"));
        }
      }
      if (provider !== "browser") {
        try {
          return await this.prepareBundled(pageIndex, words);
        } catch (error) {
          console.warn("Bundled narration missing, using the browser voice", error);
        }
      }
      return { provider: "browser", buffer: null, timings: null, words, duration: 0 };
    })();
    this.cache.set(key, task);
    return task;
  }

  async prepareOpenAI(pageIndex, words) {
    const n = this.story.narrator?.openai || {};
    const body = {
      text: this.pageText(pageIndex),
      voice: this.settings.openaiVoice || n.voice || "fable",
      instructions: n.instructions,
      speed: n.speed || 0.92,
      model: n.model || "gpt-4o-mini-tts",
      align: true,
    };
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`tts ${res.status}`);
    const data = await res.json();
    const bytes = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0));
    const buffer = await this.ctx.decodeAudioData(bytes.buffer);
    const timings = data.words && data.words.length >= words.length * 0.5
      ? alignByTranscript(data.words, words, buffer.duration)
      : alignByEnergy(buffer, words);
    return { provider: "openai", buffer, timings, words, duration: buffer.duration };
  }

  async prepareBundled(pageIndex, words) {
    const folder = this.story.narrator?.bundled?.folder || "voice";
    const format = this.story.narrator?.bundled?.format || "mp3";
    const url = `${this.bookBase}/${folder}/page-${pageIndex + 1}.${format}`;
    const res = await fetch(assetUrl(url));
    if (!res.ok) throw new Error(`missing ${url}`);
    const buffer = await this.ctx.decodeAudioData(await res.arrayBuffer());
    let timings = null;
    if (this.story.narrator?.bundled?.timings !== false) try {
      const t = await fetch(assetUrl(`${this.bookBase}/${folder}/timings.json`));
      if (t.ok) {
        const all = await t.json();
        const page = all[`page-${pageIndex + 1}`];
        if (page && page.length === words.length) timings = page;
      }
    } catch (error) { /* optional */ }
    if (!timings) timings = alignByEnergy(buffer, words);
    return { provider: "bundled", buffer, timings, words, duration: buffer.duration };
  }

  /* ---------- playback ---------- */

  async play(pageIndex, callbacks = {}) {
    this.stop();
    this.callbacks = callbacks;
    const prepared = await this.prepare(pageIndex);
    if (this.callbacks !== callbacks) return; // superseded
    if (prepared.provider === "browser") return this.playBrowser(pageIndex, prepared);
    this.current = { page: pageIndex, ...prepared, offset: 0 };
    this.startSource(0);
  }

  startSource(offset) {
    const cur = this.current;
    if (!cur || !cur.buffer) return;
    if (this.ctx.state === "suspended") this.ctx.resume();
    const source = this.ctx.createBufferSource();
    source.buffer = cur.buffer;
    source.connect(this.gain);
    source.onended = () => {
      if (this.current !== cur || cur.source !== source || this.paused) return;
      this.finish();
    };
    cur.source = source;
    cur.offset = offset;
    cur.startedAt = this.ctx.currentTime;
    source.start(0, offset);
    this.paused = false;
    this.wordIndex = -1;
  }

  /** The page was spoken to its last word (a stop or a skip never comes through here). */
  finish(complete = true) {
    const cb = this.callbacks;
    this.current = null;
    this.wordIndex = -1;
    if (cb.onEnd) cb.onEnd(complete);
  }

  position() {
    const cur = this.current;
    if (!cur) return 0;
    if (cur.utterance) return cur.position || 0;
    if (this.paused) return cur.offset;
    return cur.offset + (this.ctx.currentTime - cur.startedAt);
  }

  /** Call every frame: fires onWord when the spoken word changes. */
  update() {
    const cur = this.current;
    if (!cur || cur.utterance || this.paused || !cur.timings) return;
    const t = this.position();
    let idx = this.wordIndex;
    while (idx + 1 < cur.timings.length && cur.timings[idx + 1].start <= t + 0.02) idx++;
    if (idx !== this.wordIndex) {
      this.wordIndex = idx;
      if (this.callbacks.onWord) this.callbacks.onWord(idx, cur.words[idx]);
    }
  }

  pause() {
    const cur = this.current;
    if (!cur || this.paused) return;
    if (cur.utterance) { speechSynthesis.pause(); this.paused = true; return; }
    cur.offset = this.position();
    this.paused = true;
    try { cur.source.stop(); } catch (error) { /* already stopped */ }
  }

  resume() {
    const cur = this.current;
    if (!cur || !this.paused) return;
    if (cur.utterance) { speechSynthesis.resume(); this.paused = false; return; }
    this.startSource(cur.offset);
  }

  stop() {
    const cur = this.current;
    this.current = null;
    this.paused = false;
    this.wordIndex = -1;
    if (!cur) return;
    if (cur.utterance) { speechSynthesis.cancel(); return; }
    try { cur.source.stop(); } catch (error) { /* ignore */ }
  }

  get playing() {
    return !!this.current && !this.paused;
  }

  /* ---------- browser speech ---------- */

  playBrowser(pageIndex, prepared) {
    if (!("speechSynthesis" in window)) {
      this.onStatus(t("noVoices"));
      if (this.callbacks.onEnd) this.callbacks.onEnd(false);
      return;
    }
    const text = this.pageText(pageIndex);
    const words = prepared.words;
    // char offset of each word
    const offsets = [];
    let pos = 0;
    for (const w of words) {
      const at = text.indexOf(w, pos);
      offsets.push(at);
      pos = at + w.length;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.86;
    utterance.pitch = 1.05;
    const voice = this.browserVoice(text);
    if (voice) utterance.voice = voice;
    const cur = { page: pageIndex, utterance, words, provider: "browser", position: 0 };
    this.current = cur;
    utterance.onboundary = (event) => {
      if (this.current !== cur) return;
      if (event.name && event.name !== "word") return;
      let idx = 0;
      for (let i = 0; i < offsets.length; i++) if (offsets[i] <= event.charIndex) idx = i;
      cur.position = event.elapsedTime ? event.elapsedTime / 1000 : cur.position;
      if (idx !== this.wordIndex) {
        this.wordIndex = idx;
        if (this.callbacks.onWord) this.callbacks.onWord(idx, words[idx]);
      }
    };
    // a voice that fails, or "ends" before it could have said the words, did not read the page
    const startedAt = performance.now();
    const plausible = () => performance.now() - startedAt >= words.length * 140;
    utterance.onend = () => { if (this.current === cur) this.finish(plausible()); };
    utterance.onerror = () => { if (this.current === cur) this.finish(false); };
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  }

  browserVoice(text = "") {
    const voices = speechSynthesis.getVoices();
    if (!voices.length) return null;
    const isChinese = (this.settings && this.settings.language === "zh") || /[\u4e00-\u9fa5]/.test(text);
    if (isChinese) {
      const zhVoices = voices.filter((v) => v.lang && v.lang.startsWith("zh"));
      if (zhVoices.length) {
        const preferredZh = ["Ting-Ting", "Tingting", "Meijia", "Sinji", "Google 普通话", "Google 國語", "Xiaoxiao", "Yunxi"];
        for (const name of preferredZh) {
          const v = zhVoices.find((x) => x.name.includes(name));
          if (v) return v;
        }
        return zhVoices[0];
      }
    }
    const wanted = this.settings.browserVoice;
    if (wanted) {
      const v = voices.find((x) => x.name === wanted);
      if (v) return v;
    }
    const preferred = ["Samantha", "Karen", "Moira", "Google UK English Female", "Google US English", "Daniel"];
    for (const name of preferred) {
      const v = voices.find((x) => x.name === name);
      if (v) return v;
    }
    return voices.find((v) => v.lang && v.lang.startsWith("en")) || voices[0];
  }

  /* ---------- single words ---------- */

  /** Slice for one word: the timings are ~50 ms coarse, so snap each edge to the quiet dip
      next to it (the stop consonant before the word, the pause or next onset after it) when
      there is a real one; otherwise keep whisper's edge with a short tail that never runs into
      the next word. A slice that starts inside the previous word or stops before the last
      consonant sounds like a cut word. */
  wordSlice(prepared, wordIndex) {
    const t = prepared.timings[wordIndex];
    const prev = prepared.timings[wordIndex - 1], next = prepared.timings[wordIndex + 1];
    const total = prepared.duration || prepared.buffer.duration;
    if (!prepared.env) {
      const env = envelope(prepared.buffer, 0.01);
      const sorted = Array.from(env.rms).sort((a, b) => a - b);
      env.floor = sorted[Math.floor(sorted.length * 0.1)] || 0;
      prepared.env = env;
    }
    const { rms, hop, floor } = prepared.env;
    const at = (x) => rms[Math.min(rms.length - 1, Math.max(0, Math.round(x / hop)))] || 0;
    const level = (x) => (at(x) + at(x + hop) + at(x + 2 * hop)) / 3; // 30 ms window
    const quietest = (from, to) => {
      let best = from, bestV = Infinity;
      for (let x = from; x + 0.03 <= to + 1e-6; x += hop) { const v = level(x); if (v < bestV) { bestV = v; best = x; } }
      return { at: best, v: bestV };
    };
    let peak = 0;
    for (let x = t.start; x < t.end; x += hop) peak = Math.max(peak, at(x));
    const isDip = (v) => v < floor + (peak - floor) * 0.35;
    const loud = (from, to) => { let m = 0; for (let x = from; x < to; x += hop) m = Math.max(m, at(x)); return m; };
    // start: a dip just before the word counts only if speech follows it (a short word's own
    // silence must not win), otherwise the timing's edge
    const lo = Math.max(0, prev ? prev.start + 0.05 : 0, t.start - 0.08);
    const s = quietest(lo, Math.max(lo + 0.03, Math.min(t.start + 0.06, t.end - 0.06)));
    const start = isDip(s.v) && !isDip(loud(s.at + 0.03, s.at + 0.15)) ? s.at : Math.max(lo, t.start - 0.01);
    const hi = Math.min(total, next ? next.start + 0.08 : total, t.end + 0.22); // never swallow the next word
    const from = Math.min(hi - 0.03, Math.max(start + 0.1, t.end - 0.06));
    const e = quietest(from, hi);
    const stop = isDip(e.v) ? e.at + 0.03 : Math.min(hi, t.end + 0.03, next ? next.start + 0.02 : total);
    return { start, stop: Math.min(total, Math.max(stop, start + 0.14)) };
  }

  async speakWord(pageIndex, wordIndex, word) {
    const prepared = await this.prepare(pageIndex).catch(() => null);
    if (prepared && prepared.buffer && prepared.timings && prepared.timings[wordIndex]) {
      const { start, stop } = this.wordSlice(prepared, wordIndex);
      const length = stop - start;
      const source = this.ctx.createBufferSource();
      source.buffer = prepared.buffer;
      const g = this.ctx.createGain();
      source.connect(g).connect(this.gain);
      if (this.ctx.state === "suspended") this.ctx.resume();
      const now = this.ctx.currentTime;
      // short fades: no clicks at the cut points
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(1, now + 0.012);
      g.gain.setValueAtTime(1, now + length - 0.025);
      g.gain.linearRampToValueAtTime(0, now + length);
      source.start(now, start, length);
      this.lastSlice = { pageIndex, wordIndex, start, stop };
      return;
    }
    this.speakText(word);
  }

  /** Say a short line (a toy's name, a book's title) in the storyteller's voice: the OpenAI voice
      through the server when it has a key (one call per line, cached here and on disk), the
      browser's own voice otherwise. */
  async say(text, { instructions = "Say this warmly and clearly, like a storyteller introducing a friend to a child. Just the words, no extras.", clip = null } = {}) {
    text = String(text || "").trim();
    if (!text) return;
    // a clip made ahead of time (tools/voice_lines.py) plays first; a missing one costs one 404
    if (clip && await this.playClip(clip)) return;
    await this.checkServer().catch(() => null);
    if (this.server.openai) {
      const voice = this.settings.openaiVoice || this.story?.narrator?.openai?.voice || "fable";
      const key = `say:${voice}:${text}`;
      try {
        let task = this.cache.get(key);
        if (!task) {
          task = (async () => {
            const res = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, voice, instructions, speed: 0.95, model: "gpt-4o-mini-tts", align: false }) });
            if (!res.ok) throw new Error(`tts ${res.status}`);
            return await this.ctx.decodeAudioData(await res.arrayBuffer());
          })();
          this.cache.set(key, task);
        }
        const buffer = await task;
        if (this.ctx.state === "suspended") this.ctx.resume();
        if (this.saying) { try { this.saying.stop(); } catch (error) { /* already ended */ } }
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.gain);
        source.start();
        this.saying = source;
        return;
      } catch (error) {
        this.cache.delete(key);
      }
    }
    this.speakText(text);
  }

  /** Play a bundled line (an mp3 under public/audio); false when it is not there. */
  async playClip(url) {
    const key = `clip:${url}`;
    try {
      let task = this.cache.get(key);
      if (!task) {
        task = (async () => {
          const res = await fetch(assetUrl(url));
          if (!res.ok) return null;
          return await this.ctx.decodeAudioData(await res.arrayBuffer());
        })();
        this.cache.set(key, task);
      }
      const buffer = await task;
      if (!buffer) return false;
      if (this.ctx.state === "suspended") this.ctx.resume();
      if (this.saying) { try { this.saying.stop(); } catch (error) { /* already ended */ } }
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.gain);
      source.start();
      this.saying = source;
      return true;
    } catch (error) {
      this.cache.delete(key);
      return false;
    }
  }

  speakText(text) {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.8;
    u.pitch = 1.08;
    const voice = this.browserVoice(text);
    if (voice) u.voice = voice;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  setVolume(v) {
    this.gain.gain.value = v;
  }
}
