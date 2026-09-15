import {assetUrl} from "./assets.js";
import { t, applyStatic, currentLanguage } from "./i18n.js";
import { readPercent } from "./bookmark.js";
import { ageOf } from "./profiles.js";
import { readingSession } from "./reading-session.js";
/** What the profiles folio says about the parent's membership: the pin, and one line under the e-mail. */
function membership() {
  const m = readingSession.membership;
  if (!m || !m.active) return { pro: false, line: "" };
  if (m.plan === "lifetime") return { pro: true, line: t("proLifetime") };
  const date = new Date(m.expiresAt).toLocaleDateString(currentLanguage(), { year: "numeric", month: "long", day: "numeric" });
  return { pro: true, line: t("proYearly", { date }) };
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
/* HUD wiring: the wooden buttons, the reading bar, hints, word tips, the word zoom, toasts,
   the loading card and the settings folio. Presentation only; main.js owns the logic. */

const $ = (id) => document.getElementById(id);

export const DEFAULT_SETTINGS = {
  voice: "auto",
  openaiVoice: "fable",
  browserVoice: "",
  music: 0.6,
  sfx: 0.8,
  autoTurn: true,
  textSize: "normal",
  reducedMotion: false,
  muted: false,
  language: typeof navigator !== "undefined" && navigator.language?.startsWith("en") ? "en" : "zh",
};

/** The languages a book can be read in (books/<id>/lang/<code>.json + lang/<code>/voice). */
export const LANGUAGES = [
  { code: "en", name: "English", native: "English" },
  { code: "fr", name: "French", native: "Français" },
  { code: "es", name: "Spanish", native: "Español" },
  { code: "ja", name: "Japanese", native: "日本語" },
  { code: "zh", name: "Chinese", native: "中文" },
];

export function loadSettings() {
  try {
    const raw = localStorage.getItem("storylight-settings");
    return { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
  } catch (error) {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try { localStorage.setItem("storylight-settings", JSON.stringify(settings)); } catch (error) { /* private mode */ }
}

function retrigger(el, className) {
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
}

export class UI {
  constructor({ story, settings, onAction }) {
    this.story = story || null;
    this.bookBase = "";
    this.settings = settings;
    this.onAction = onAction;
    this.el = {
      interface: $("interface"),
      loading: $("loading"),
      loadingCard: $("loading-card"),
      loadingLogo: $("loading-logo"),
      loadingBlurb: $("loading-blurb"),
      loadingCopy: $("loading-copy"),
      progress: document.querySelector(".loading-progress i"),
      open: $("btn-open"),
      back: $("btn-back"),
      shelfStrip: $("shelf-strip"),
      quiz: $("btn-quiz"),
      phrasebook: $("btn-phrasebook"),
      vocabCard: $("vocab-card"),
      shelfBooks: document.querySelector("#shelf-strip .shelf-books"),
      shelfRow: document.querySelector("#shelf-strip .shelf-row"),
      shelfPrev: $("shelf-prev"),
      shelfNext: $("shelf-next"),
      shelfDots: document.querySelector("#shelf-strip .shelf-dots"),
      read: $("btn-read"),
      prev: $("btn-prev"),
      next: $("btn-next"),
      closeBook: $("btn-close-book"),
      modeListen: $("mode-listen"),
      modeSelf: $("mode-self"),
      sound: $("btn-sound"),
      look: $("btn-look"),
      settings: $("btn-settings"),
      tribute: $("btn-tribute"),
      language: $("btn-language"),
      languageMenu: $("language-menu"),
      hint: $("hint"),
      hintText: $("hint-text"),
      dots: $("dots"),
      wordTip: $("word-tip"),
      magicWord: $("magic-word"),
      wordZoom: $("word-zoom"),
      toast: $("toast"),
      tooltip: $("tooltip"),
      panel: $("panel"),
      account: $("btn-account"),
    };
    this.toastTimer = null;
    this.bind();
    if (this.story) this.buildDots();
  }

  bind() {
    const e = this.el;
    const press = (button, action, payload) => {
      button.addEventListener("click", () => {
        if (button.classList.contains("round-button")) retrigger(button, "bump");
        this.onAction(action, payload);
      });
    };
    press(e.open, "open");
    if (e.back) press(e.back, "back");
    if (e.quiz) press(e.quiz, "quiz");
    if (e.phrasebook) press(e.phrasebook, "phrasebook");
    if (e.vocabCard) e.vocabCard.addEventListener("click", () => { if (this.vocabKey) this.onAction("vocab-play", this.vocabKey); });
    if (e.shelfPrev) e.shelfPrev.addEventListener("click", () => this.onAction("shelf-page", -1));
    if (e.shelfNext) e.shelfNext.addEventListener("click", () => this.onAction("shelf-page", 1));
    press(e.read, "read");
    press(e.prev, "prev");
    press(e.next, "next");
    if (e.closeBook) press(e.closeBook, "back");
    press(e.modeListen, "mode", "listen");
    press(e.modeSelf, "mode", "self");
    press(e.sound, "sound");
    press(e.look, "look");
    press(e.settings, "settings");
    if (e.tribute) press(e.tribute, "tribute");
    if (e.account) press(e.account, "account");
    if (e.language) {
      press(e.language, "language-menu");
      for (const b of e.languageMenu.querySelectorAll("[data-lang]")) b.addEventListener("click", () => { this.closeLanguageMenu(); this.onAction("setting", { key: "language", value: b.dataset.lang }); this.settings.language = b.dataset.lang; saveSettings(this.settings); this.markLanguage(); });
      this.markLanguage();
    }
    document.querySelectorAll("[data-tip]").forEach((button) => {
      button.addEventListener("pointerenter", () => this.tooltip(button));
      button.addEventListener("pointerleave", () => { e.tooltip.hidden = true; });
    });
    document.querySelector(".brand").addEventListener("click", (event) => { event.preventDefault(); this.onAction("home"); });
  }

  /** The flag menu under the language button (flags drawn by tools/make_flags.py). */
  toggleLanguageMenu() {
    const m = this.el.languageMenu;
    if (!m) return;
    m.hidden = !m.hidden;
    if (!m.hidden) { retrigger(m, "arriving"); this.markLanguage(); }
  }

  closeLanguageMenu() { if (this.el.languageMenu) this.el.languageMenu.hidden = true; }

  markLanguage() {
    if (!this.el.languageMenu) return;
    for (const b of this.el.languageMenu.querySelectorAll("[data-lang]")) b.setAttribute("aria-pressed", String(b.dataset.lang === (this.settings.language || "en")));
    const current = LANGUAGES.find((l) => l.code === (this.settings.language || "en")) || LANGUAGES[0];
    if (this.el.language) {
      this.el.language.dataset.tip = t("languageIs", { name: current.native });
      const flag = this.el.language.querySelector("img.flag");
      if (flag) { flag.src = assetUrl(`public/ui/flags/${current.code}.png`); flag.alt = current.name; }
    }
  }

  tooltip(button) {
    const r = button.getBoundingClientRect();
    const t = this.el.tooltip;
    t.textContent = button.dataset.tip;
    t.hidden = false;
    t.style.left = `${r.left + r.width / 2}px`;
    t.style.top = `${r.bottom + 4}px`;
  }

  buildDots() {
    const total = this.story.pages.length + 1;
    this.el.dots.innerHTML = "";
    for (let i = 0; i < total; i++) {
      const dot = document.createElement("i");
      dot.setAttribute("role","button");dot.tabIndex=0;
      dot.setAttribute("aria-label", `Reading progress: ${i < this.story.pages.length ? `page ${i+1}` : "the end"}`);
      dot.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();this.onAction("goto",i);}});
      dot.title = i < this.story.pages.length ? this.story.pages[i].heading : this.story.end.heading;
      dot.addEventListener("click", () => this.onAction("goto", i));
      dot.style.pointerEvents = "auto";
      dot.style.cursor = "pointer";
      this.el.dots.appendChild(dot);
    }
  }

  /* ---------- views ---------- */

  setView(view) {
    const el = this.el.interface;
    el.classList.toggle("view-shelf", view === "shelf");
    el.classList.toggle("view-book", view === "book");
    if (view === "book") this.setOpened(false);
  }

  /** The strip of titles under the 3D shelf (also the accessible way to pick a book). */
  showShelf(library, progress = {}, paging = { page: 0, pages: 1 }, pinsOf = null, quizOf = null) {
    const strip = this.el.shelfStrip;
    if (!strip) return;
    this.shelfData = { library, progress, pinsOf, quizOf };
    this.setShelfPage(paging.page, paging.pages);
    strip.hidden = false;
    retrigger(strip, "arriving");
  }

  /** The titles of the three books in view, with the arrows that slide the shelf. */
  setShelfPage(page, pages) {
    if (!this.el.shelfBooks || !this.shelfData) return;
    this.shelfPaging = { page, pages };
    const { library, progress, pinsOf, quizOf } = this.shelfData;
    this.el.shelfBooks.innerHTML = "";
    const per = 3;
    for (const meta of library.books.slice(page * per, page * per + per)) {
      const b = document.createElement("button");
      b.className = "shelf-book" + (meta.status === "ready" ? "" : " soon");
      b.dataset.book = meta.id;
      b.setAttribute("aria-label", meta.title);
      const p = progress[meta.id];
      // a page counts once it has been read to the end (its star), so the bar is stars over pages
      const stars = p && Array.isArray(p.read) ? p.read.length : 0;
      const status = meta.status !== "ready" ? t("comingSoon") : p && p.finished ? t("finishedAgain") : stars > 0 ? t("pageStarsOf", { n: stars, total: meta.pages }) : t("pagesCount", { n: meta.pages });
      // the card: the book's logo (books/<id>/art/logo.png, the title when there is none), a
      // reading bar, and its five pins, found ones in colour and the rest as shadows
      const percent = meta.status !== "ready" ? 0 : readPercent(p, meta.pages);
      const found = pinsOf ? pinsOf(meta.id) : [];
      // the pins at strip size (a few KB each); the full pin stands in if a small one is missing
      const pins = (meta.pins || []).map((pin) => { const got = found.includes(pin.id); return `<img class="${got ? "found" : "missing"}" src="${assetUrl(`books/${meta.id}/pins/${pin.id}-strip.webp`)}" data-full="${assetUrl(`books/${meta.id}/pins/${pin.id}.png`)}" onerror="if(this.dataset.full){this.src=this.dataset.full;delete this.dataset.full;}" alt="${got ? pin.name : ""}" title="${got ? pin.name : t("stillHiding")}" />`; }).join("");
      const code = currentLanguage();
      const title = (meta.titles && meta.titles[code]) || meta.title;
      const localLogo = code !== "en" && meta.art && meta.art[code] && meta.art[code].logo;
      b.setAttribute("aria-label", title);
      // the quiz: one small star per question, lit for every right answer in the best run
      const quiz = quizOf ? quizOf(meta.id) : { best: 0, total: meta.quizCount || 0 };
      const quizStars = quiz.total ? `<span class="shelf-quiz" role="img" aria-label="${t("quizScore", { best: quiz.best, total: quiz.total })}" title="${t("quizScore", { best: quiz.best, total: quiz.total })}">${Array.from({ length: quiz.total }, (_, i) => `<i class="${i < quiz.best ? "on" : ""}"></i>`).join("")}</span>` : "";
      b.innerHTML = `<span class="shelf-logo"><img alt="" /><b>${title}</b></span><span class="shelf-bar-row"><span class="shelf-progress" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"><i style="width: ${percent}%"></i></span>${quizStars}</span><span class="shelf-meta"><small>${meta.access==='pro'?'Pro · ':''}${status}</small><span class="shelf-pins">${pins}</span></span>`;
      const logo = b.querySelector(".shelf-logo img");
      // the logo at strip size (art/logo-strip.webp, the language's when the book has one), then the
      // full logo, then the English one, then the title when nothing loads
      const stripOf = (file) => file.replace(/logo(\.[a-z]{2})?\.png$/, "logo-strip$1.webp");
      const chain = [stripOf(localLogo || "art/logo.png"), localLogo || "art/logo.png", localLogo ? "art/logo-strip.webp" : null, localLogo ? "art/logo.png" : null].filter(Boolean);
      logo.addEventListener("error", () => { const next = chain[++chain.at]; if (next) logo.src = assetUrl(`books/${meta.id}/${next}`); else logo.parentNode.classList.add("missing"); });
      chain.at = 0;
      logo.src = assetUrl(`books/${meta.id}/${chain[0]}`);
      b.addEventListener("click", event => { if(event.target.closest(".shelf-bar-row,.shelf-pins")){this.onAction("souvenirs");return;}this.onAction("select", meta.id); });
      b.addEventListener("pointerenter", () => this.onAction("shelf-hover", meta.id));
      b.addEventListener("pointerleave", () => this.onAction("shelf-hover", null));
      this.el.shelfBooks.appendChild(b);
    }
    if (this.el.shelfPrev) this.el.shelfPrev.disabled = page <= 0;
    if (this.el.shelfNext) this.el.shelfNext.disabled = page >= pages - 1;
    if (this.el.shelfDots) this.el.shelfDots.innerHTML = Array.from({ length: pages }, (_, i) => `<i class="${i === page ? "on" : ""}"></i>`).join("");
    if (this.el.shelfRow) { this.el.shelfRow.classList.toggle("single", pages <= 1); }
  }

  hideShelf() { if (this.el.shelfStrip) this.el.shelfStrip.hidden = true; }

  /** The interface follows the language switch: named strings, the reading button, the language
      tip and the shelf strip; panels rebuild themselves the next time they open. */
  refreshLanguage() {
    applyStatic();
    this.markLanguage();
    this.setReading(this.el.read.dataset.state || "idle");
    if (this.shelfData && this.shelfPaging && this.el.shelfStrip && !this.el.shelfStrip.hidden) this.setShelfPage(this.shelfPaging.page, this.shelfPaging.pages);
  }

  setShelfHover(id) {
    if (!this.el.shelfBooks) return;
    for (const b of this.el.shelfBooks.children) b.classList.toggle("hover", b.dataset.book === id);
  }

  /** The title card of a chosen book, beside the book on the table (no sky behind it). */
  showBookCard(meta) {
    const L = this.el.loading;
    L.hidden = false;
    L.classList.remove("fade");
    L.classList.add("book");
    const pickedTitle = (meta.titles && meta.titles[currentLanguage()]) || meta.title;
    if (this.el.loadingCard) this.el.loadingCard.setAttribute("aria-label", t("opening", { title: pickedTitle }));
    if (this.el.loadingLogo) { this.el.loadingLogo.hidden = true; }
    // the blurb waits, unseen, until the logo has been drawn in; then the quill draws it too
    if (this.el.loadingCard) { this.el.loadingCard.classList.remove("draw"); this.el.loadingCard.classList.add("predraw"); }
    if (this.el.loadingBlurb) this.el.loadingBlurb.textContent = (meta.blurbs && meta.blurbs[currentLanguage()]) || meta.blurb || meta.subtitle || "";
    this.el.progress.parentElement.hidden = false;
    this.el.progress.style.width = "4%";
    this.el.loadingCopy.hidden = false;
    this.el.loadingCopy.textContent = t("opening", { title: pickedTitle });
    this.el.open.hidden = true;
    if (this.el.back) this.el.back.hidden = false;
  }

  hideBookCard() {
    const L = this.el.loading;
    L.classList.add("fade");
    setTimeout(() => { if (L.classList.contains("fade")) L.hidden = true; }, 700);
  }

  /* ---------- loading ---------- */

  /** Point the HUD at a book: page dots, hint texts, the title card's logo and blurb. */
  setStory(story, bookBase = "") {
    this.story = story;
    this.bookBase = bookBase;
    this.buildDots();
    if (this.el.loadingCard) this.el.loadingCard.setAttribute("aria-label", t("opening", { title: story.title }));
    if (this.el.loadingLogo) {
      if (story.logo) { this.el.loadingLogo.src = assetUrl(`${bookBase}/${story.logo}`); this.el.loadingLogo.alt = story.title; this.el.loadingLogo.hidden = false; }
      // a quill draws the logo in, then the blurb (held back until now)
      if (this.el.loadingCard) { this.el.loadingCard.classList.remove("predraw"); retrigger(this.el.loadingCard, "draw"); }
      else this.el.loadingLogo.hidden = true;
    }
    if (this.el.loadingBlurb) this.el.loadingBlurb.textContent = story.blurb || story.subtitle || "";
    // language books carry a phrasebook of their souvenir words
    if (this.el.phrasebook) {
      const lang = story.language && story.vocab;
      this.el.phrasebook.hidden = !lang;
      if (lang) this.el.phrasebook.querySelector("span").textContent = t("words");
    }
  }

  /** A tapped souvenir word: the native script, its reading and its meaning on a stamp. */
  vocabCard(entry, image, language) {
    const c = this.el.vocabCard;
    if (!c) return;
    this.vocabKey = entry.key;
    const lang = (language && language.code) || "";
    c.querySelector(".vocab-script").textContent = entry.script;
    c.querySelector(".vocab-script").setAttribute("lang", lang);
    c.querySelector(".vocab-roman").textContent = entry.roman || "";
    c.querySelector(".vocab-roman").hidden = !entry.roman;
    c.querySelector(".vocab-meaning").textContent = entry.meaning;
    c.querySelector(".vocab-note").textContent = entry.note || "";
    c.querySelector(".vocab-lang").textContent = `${(language && language.name) || t("souvenirWord")} · ${t("tapToHearAgain")}`;
    const img = c.querySelector("img");
    if (image) { if (img.getAttribute("src") !== image) img.src = assetUrl(image); img.hidden = false; c.classList.add("has-picture"); }
    else { img.hidden = true; c.classList.remove("has-picture"); }
    this.el.wordZoom.hidden = true;
    c.hidden = false;
    retrigger(c, "arriving");
    clearTimeout(this.vocabTimer);
    this.vocabTimer = setTimeout(() => { c.hidden = true; }, 4200);
  }

  /** The phrasebook: every souvenir word of the book, page by page, with its native voice. */
  openPhrasebook(story, base, heard = [], onPlay = null) {
    const panel = this.el.panel;
    const vocab = story.vocab || {};
    const lang = story.language || {};
    const code = lang.code || "";
    const heardSet = new Set(heard);
    const cards = this.cardsAvailable || new Set();
    const rowFor = (key) => {
      const v = vocab[key];
      if (!v) return "";
      const pic = `${base}/words/cards/${key}.jpg`;
      return `
        <button class="phrase-row ${heardSet.has(key) ? "heard" : ""}" data-key="${key}">
          <span class="phrase-pic"><img src="${assetUrl(`${pic}`)}" alt="" onerror="this.parentElement.classList.add('none')"></span>
          <span class="phrase-text">
            <b lang="${code}">${v.script}</b>
            ${v.roman ? `<i>${v.roman}</i>` : ""}
            <span>${v.meaning}</span>
            ${v.note ? `<small>${v.note}</small>` : ""}
          </span>
          <span class="phrase-play" aria-hidden="true"><i class="icon icon-play"></i></span>
          <span class="phrase-stamp" aria-hidden="true">✓</span>
        </button>`;
    };
    const seen = new Set();
    const sections = story.pages.map((page, i) => {
      const keys = (page.words || []).filter((k) => vocab[k] && !seen.has(k));
      keys.forEach((k) => seen.add(k));
      if (!keys.length) return "";
      return `<h3 class="folio-section phrase-page"><span>Page ${i + 1}</span> ${page.heading}</h3><div class="phrase-list">${keys.map(rowFor).join("")}</div>`;
    }).join("");
    const rest = Object.keys(vocab).filter((k) => !seen.has(k));
    const extra = rest.length ? `<h3 class="folio-section phrase-page"><span>${t("more")}</span> ${t("extraWords")}</h3><div class="phrase-list">${rest.map(rowFor).join("")}</div>` : "";
    const total = Object.keys(vocab).length;
    const count = Object.keys(vocab).filter((k) => heardSet.has(k)).length;
    const langName = (lang.code && t(`langName_${lang.code}`) !== `langName_${lang.code}`) ? t(`langName_${lang.code}`) : (lang.name || t("native"));
    panel.innerHTML = `
      <div class="panel-shell phrasebook" role="dialog" aria-label="${t("phrasebook")}">
        <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
        <header class="folio-head">
          <div class="portrait">${story.portrait ? `<img src="${assetUrl(`${base}/${story.portrait}`)}" alt="" />` : ""}</div>
          <div>
            <span class="eyebrow">STORYCOMET · ${t("wordsOf", { language: langName }).toUpperCase()}</span>
            <h2>${t("phrasebook")}</h2>
            <p class="panel-description">${t("phrasebookBlurb", { title: story.title, language: langName })}</p>
            <p class="phrase-count">${t("wordsHeard", { count: `<b>${count}</b>`, total })}</p>
          </div>
        </header>
        <div class="folio-rule"><i class="icon icon-star"></i></div>
        ${sections}${extra}
        <div class="panel-actions">
          <button class="pill-button small primary" id="phrase-close"><i class="icon icon-book"></i><span>${t("backToStory")}</span></button>
        </div>
      </div>`;
    panel.hidden = false;
    panel.querySelector("#phrase-close").addEventListener("click", () => this.closeSettings());
    panel.addEventListener("click", (event) => { if (event.target === panel) this.closeSettings(); });
    for (const row of panel.querySelectorAll(".phrase-row")) {
      row.addEventListener("click", () => {
        const key = row.dataset.key;
        if (onPlay) onPlay(key);
        if (!row.classList.contains("heard")) {
          row.classList.add("heard");
          heardSet.add(key);
          const n = Object.keys(vocab).filter((k) => heardSet.has(k)).length;
          panel.querySelector(".phrase-count b").textContent = String(n);
        }
        retrigger(row, "said");
      });
    }
  }

  setLoading(progress, copy) {
    this.el.progress.style.width = `${Math.round(progress * 100)}%`;
    if (copy) this.el.loadingCopy.textContent = copy;
  }

  /** "1.2 MB / 2.0 MB · 84 files": what has arrived of what the boot has asked for so far. */
  setLoadingBytes({ loaded = 0, expected = 0, arrived = 0, files = 0 } = {}) {
    const el = document.getElementById("loading-bytes");
    if (!el) return;
    const mb = (b) => (b / 1048576).toFixed(b < 1048576 * 10 ? 1 : 0);
    el.textContent = expected ? `${mb(Math.min(loaded, expected))} MB / ${mb(expected)} MB · ${arrived}/${files}` : "";
  }

  showOpen() {
    this.el.loadingCopy.textContent = "";
    this.el.loadingCopy.hidden = true;
    this.el.progress.parentElement.hidden = true;
    this.el.open.hidden = false;
    this.el.open.focus();
  }

  hideLoading() {
    const L = this.el.loading;
    L.classList.add("fade");
    this.el.interface.hidden = false;
    // a book card shown in the meantime clears the fade and must not be hidden by this timer
    setTimeout(() => { if (L.classList.contains("fade")) L.hidden = true; }, 950);
  }

  /** Reader controls only make sense once the book is open. */
  setOpened(opened) {
    this.el.interface.classList.toggle("book-closed", !opened);
  }

  /* ---------- page state ---------- */

  setPage(index, progress = null) {
    const pages = this.story.pages;
    const isEnd = index >= pages.length;
    const page = isEnd ? null : pages[index];
    // the hint waits until the page has been read (showHint), then pops in at the bottom right
    this.pendingHint = page && page.hint ? page.hint : (!page ? this.story.end.prompt : null);
    this.el.hint.hidden = true;
    this.refreshDots(index, progress);
    this.el.prev.disabled = index === 0;
    this.el.prev.style.opacity = index === 0 ? 0.55 : 1;
    this.el.next.style.opacity = isEnd ? 0.55 : 1;
    if (this.el.quiz) { this.el.quiz.hidden = !(isEnd && this.story.quiz && this.story.quiz.questions && this.story.quiz.questions.length); if (!this.el.quiz.hidden) retrigger(this.el.quiz, "arriving"); }
    if (isEnd) {
      this.swapLabel(this.el.read, t("readAgain"), "icon-book");
      this.el.read.dataset.state = "again";
    }
  }

  /** The row of stars: one per page, lit once that page was read to the end; the last one is the book. */
  refreshDots(index, progress = null) {
    const read = (progress && Array.isArray(progress.read)) ? progress.read : [];
    const total = this.story.pages.length;
    Array.from(this.el.dots.children).forEach((dot, i) => {
      dot.classList.toggle("current", i === index);
      dot.classList.toggle("read", i < total ? read.includes(i) : !!(progress && progress.finished));
    });
  }

  /** A page's star lights up in the row with a bounce. */
  lightStar(index) {
    const dot = this.el.dots.children[index];
    if (!dot) return;
    dot.classList.add("read");
    retrigger(dot, "earned");
    setTimeout(() => dot.classList.remove("earned"), 1000);
  }

  /** A star is born at (x, y) on the text card and flies up into its place in the row. */
  flyStar(x, y, index, { points = 0, onArrive = null } = {}) {
    const dot = this.el.dots.children[index];
    const rect = dot ? dot.getBoundingClientRect() : { left: window.innerWidth / 2, top: 40, width: 0, height: 0 };
    const tx = rect.left + rect.width / 2, ty = rect.top + rect.height / 2;
    const star = document.createElement("i");
    star.className = "star-flight";
    if (points) star.innerHTML = `<b>+${points}</b>`;
    document.body.appendChild(star);
    const t0 = performance.now();
    const dur = 1150;
    const step = () => {
      const p = Math.min(1, (performance.now() - t0) / dur);
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      // pops out of the card, arcs up and over, shrinks into the row
      const cx = x + (tx - x) * e;
      const cy = y + (ty - y) * e - Math.sin(p * Math.PI) * 120;
      const s = p < 0.2 ? 0.6 + p * 4 : 1.4 - (p - 0.2) / 0.8 * 0.9;
      star.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%) scale(${s}) rotate(${p * 420}deg)`;
      star.style.opacity = p > 0.92 ? String(1 - (p - 0.92) * 12.5) : "1";
      if (p < 1) requestAnimationFrame(step);
      else { star.remove(); this.lightStar(index); if (onArrive) onArrive(tx, ty); }
    };
    star.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(0.6)`;
    requestAnimationFrame(step);
  }

  swapLabel(button, text, iconClass) {
    const span = button.querySelector("span");
    const icon = button.querySelector(".icon");
    if (span.textContent !== text) {
      span.innerHTML = `<span class="label-swap">${text}</span>`;
    }
    if (iconClass) {
      icon.className = `icon ${iconClass}`;
      retrigger(icon, "swap-icon");
    }
  }

  setReading(state) {
    this.el.read.dataset.state = state;
    if (state === "playing") this.swapLabel(this.el.read, t("pause"), "icon-pause");
    else if (state === "paused") this.swapLabel(this.el.read, t("keepReading"), "icon-play");
    else this.swapLabel(this.el.read, t("readToMe"), "icon-play");
  }

  setMode(mode) {
    this.el.modeListen.setAttribute("aria-pressed", String(mode === "listen"));
    this.el.modeSelf.setAttribute("aria-pressed", String(mode === "self"));
  }

  setMuted(muted) {
    this.el.sound.classList.toggle("muted", muted);
  }

  setLook(on) {
    this.el.look.style.filter = on ? "brightness(1.25) drop-shadow(0 4px 6px #05081a80)" : "";
  }

  /* ---------- floating labels ---------- */

  showWordTip(x, y, text) {
    const tip = this.el.wordTip;
    if (tip.firstElementChild.textContent !== text) tip.firstElementChild.textContent = text;
    tip.hidden = false;
    tip.style.left = `${x}px`;
    tip.style.top = `${y - 14}px`;
  }

  hideWordTip() {
    this.el.wordTip.hidden = true;
  }

  magic(x, y, text) {
    const m = this.el.magicWord;
    m.firstElementChild.textContent = text;
    m.hidden = false;
    // the label is centred on the tapped spot: keep the whole of it on screen (a toy near the edge)
    const half = m.offsetWidth / 2 + 12;
    const width = window.innerWidth || half * 2;
    m.style.left = `${Math.min(Math.max(x, half), Math.max(half, width - half))}px`;
    m.style.top = `${y}px`;
    m.style.animation = "none";
    void m.offsetWidth;
    m.style.animation = "";
    clearTimeout(this.magicTimer);
    this.magicTimer = setTimeout(() => { m.hidden = true; }, 1400);
  }

  /** The tapped word jumps out of the page, big, with its picture card when it has one. */
  wordZoom(text, image = null) {
    const z = this.el.wordZoom;
    const label = z.querySelector(".zoom-label");
    const img = z.querySelector("img");
    label.textContent = text.replace(/^["“”']+|["“”'.,!?;:]+$/g, "");
    if (image) {
      if (img.getAttribute("src") !== image) img.src = assetUrl(image);
      img.hidden = false;
      z.classList.add("has-picture");
    } else {
      img.hidden = true;
      z.classList.remove("has-picture");
    }
    z.hidden = false;
    z.style.animation = "none";
    void z.offsetWidth;
    z.style.animation = "";
    clearTimeout(this.zoomTimer);
    this.zoomTimer = setTimeout(() => { z.hidden = true; }, image ? 2700 : 1400);
  }

  /** Reveal the page's hint (called once the narrator has finished the page). */
  showHint() {
    if (!this.pendingHint || !this.el.hint.hidden) return;
    this.el.hintText.textContent = this.pendingHint;
    this.el.hint.hidden = false;
    retrigger(this.el.hint, "swap");
  }

  /** Warm the browser cache with the picture cards a page will need. */
  preloadCards(urls) {
    for (const url of urls) { const i = new Image(); i.src = assetUrl(url); }
  }

  toast(message, ms = 2600) {
    const t = this.el.toast;
    t.textContent = message;
    t.classList.add("show");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove("show"), ms);
  }

  /* ---------- settings folio ---------- */

  openSettings({ openai, browserVoices, openaiVoices }) {
    const s = this.settings;
    const panel = this.el.panel;
    const option = (value, label, current) => `<option value="${value}" ${value === current ? "selected" : ""}>${label}</option>`;
    const row = (icon, title, sub, control) => `
      <div class="settings-row">
        <span class="row-icon"><i class="icon icon-${icon}"></i></span>
        <label>${title}${sub ? `<small>${sub}</small>` : ""}</label>
        <div class="row-control">${control}</div>
      </div>`;
    const sw = (id, on) => `<button class="switch" id="${id}" role="switch" aria-checked="${on}"><i></i></button>`;
    panel.innerHTML = `
      <div class="panel-shell" role="dialog" aria-label="${t("settings")}">
        <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
        <header class="folio-head">
          <div class="portrait${this.story && this.story.portrait ? "" : " medallion"}">${this.story && this.story.portrait ? `<img src="${assetUrl(`${this.bookBase}/${this.story.portrait}`)}" alt="" />` : `<i class="icon icon-gear"></i>`}</div>
          <div>
            <span class="eyebrow">STORYCOMET${this.story && this.story.title ? ` · ${this.story.title.toUpperCase()}` : ""}</span>
            <h2>${t("settings")}</h2>
            <p class="panel-description">${t("settingsBlurb")}</p>
          </div>
        </header>
        <div class="folio-rule"><i class="icon icon-star"></i></div>
        <h3 class="folio-section"><i class="icon icon-listen"></i> ${t("theVoice")}</h3>
        ${row("abc", t("language"), "", `
          <select id="set-language">
            ${LANGUAGES.map((l) => option(l.code, `${l.native} · ${l.name}`, s.language || "en")).join("")}
          </select>`)}
        ${row("listen", t("narrator"), openai ? t("openaiConnected") : t("openaiMissing"), `
          <select id="set-voice">
            ${option("auto", t("automatic"), s.voice)}
            ${option("openai", t("openaiLive"), s.voice)}
            ${option("bundled", t("bundledNarrator"), s.voice)}
            ${option("browser", t("browserVoice"), s.voice)}
          </select>`)}
        ${row("moon", t("openaiVoice"), "gpt-4o-mini-tts", `
          <select id="set-openai-voice" ${openai ? "" : "disabled"}>
            ${(openaiVoices.length ? openaiVoices : ["fable", "coral", "sage", "nova", "shimmer"]).map((v) => option(v, v, s.openaiVoice)).join("")}
          </select>`)}
        ${row("hand", t("browserVoiceShort"), "", `
          <select id="set-browser-voice">
            ${option("", t("automatic"), s.browserVoice)}
            ${browserVoices.map((v) => option(v.name, `${v.name} (${v.lang})`, s.browserVoice)).join("")}
          </select>`)}
        <div class="folio-rule"><i class="icon icon-star"></i></div>
        <h3 class="folio-section"><i class="icon icon-music"></i> ${t("theSounds")}</h3>
        ${row("music", t("musicBox"), "", `<input id="set-music" type="range" min="0" max="1" step="0.05" value="${s.music}" />`)}
        ${row("sound", t("soundEffects"), "", `<input id="set-sfx" type="range" min="0" max="1" step="0.05" value="${s.sfx}" />`)}
        <div class="folio-rule"><i class="icon icon-star"></i></div>
        <h3 class="folio-section"><i class="icon icon-book"></i> ${t("thePages")}</h3>
        ${row("book", t("autoTurn"), "", sw("set-auto", s.autoTurn))}
        ${row("abc", t("textSize"), "", `
          <select id="set-text">
            ${option("normal", t("normal"), s.textSize)}
            ${option("large", t("large"), s.textSize)}
          </select>`)}
        ${row("magic", t("calmMotion"), "", sw("set-motion", s.reducedMotion))}
        <div class="panel-actions">
          <button class="pill-button small" id="set-restart"><i class="icon icon-home"></i><span>${t("startOver")}</span></button>
          <button class="pill-button small primary" id="set-close"><i class="icon icon-book"></i><span>${t("backToStory")}</span></button>
        </div>
        <p class="status-line">${this.story ? this.story.credits || "" : ""}</p>
      </div>`;
    panel.hidden = false;
    const change = (key, value) => { this.settings[key] = value; saveSettings(this.settings); this.onAction("setting", { key, value }); };
    panel.querySelector("#set-voice").addEventListener("change", (e) => change("voice", e.target.value));
    panel.querySelector("#set-language").addEventListener("change", (e) => { change("language", e.target.value); this.markLanguage(); });
    panel.querySelector("#set-openai-voice").addEventListener("change", (e) => change("openaiVoice", e.target.value));
    panel.querySelector("#set-browser-voice").addEventListener("change", (e) => change("browserVoice", e.target.value));
    panel.querySelector("#set-music").addEventListener("input", (e) => change("music", parseFloat(e.target.value)));
    panel.querySelector("#set-sfx").addEventListener("input", (e) => change("sfx", parseFloat(e.target.value)));
    panel.querySelector("#set-text").addEventListener("change", (e) => change("textSize", e.target.value));
    for (const [id, key] of [["set-auto", "autoTurn"], ["set-motion", "reducedMotion"]]) {
      const el = panel.querySelector(`#${id}`);
      el.addEventListener("click", () => {
        const next = el.getAttribute("aria-checked") !== "true";
        el.setAttribute("aria-checked", String(next));
        change(key, next);
      });
    }
    panel.querySelector("#set-close").addEventListener("click", () => this.closeSettings());
    panel.querySelector("#set-restart").addEventListener("click", () => { this.closeSettings(); this.onAction("restart"); });
    panel.addEventListener("click", (event) => { if (event.target === panel) this.closeSettings(); });
  }

  closeSettings() {
    this.el.panel.hidden = true;
    this.el.panel.innerHTML = "";
    this.accountOptions = null;
    this.onAction("settings-closed");
  }

  /** A Pro membership hangs its pin on the corner button. */
  setPro(active) {
    const b = this.el.account;
    if (!b) return;
    const was = b.classList.contains("pro");
    b.classList.toggle("pro", !!active);
    if (active && !was) { const pin = b.querySelector(".pro-pin"); if (pin) { pin.classList.remove("pop"); void pin.offsetWidth; pin.classList.add("pop"); } }
  }

  /** The corner button shows who is reading: their avatar, their name in the tip. */
  setProfile(profile, avatarUrl) {
    const b = this.el.account;
    if (!b) return;
    const img = b.querySelector(".avatar");
    if (img) {
      if (avatarUrl) { img.src = assetUrl(avatarUrl); img.hidden = false; } else { img.hidden = true; img.removeAttribute("src"); }
    }
    b.classList.toggle("has-avatar", !!avatarUrl);
    const name = profile && profile.name ? profile.name : t("profiles");
    b.dataset.tip = name;
    b.setAttribute("aria-label", name);
  }

  /** The profiles folio: who is reading, up to three children, each with their own progress;
      `editing` is a profile id, "new", or null for the list. */
  openAccount(options) {
    this.accountOptions = options;
    const { profiles, activeId, avatars, summaries, max, editing = null } = options;
    const panel = this.el.panel;
    const active = profiles.find((p) => p.id === activeId) || profiles[0];
    const avatarUrl = (p) => ((avatars.find((a) => a.id === (p && p.avatar)) || avatars[0] || {}).url || "");
    const ageLine = (p) => { const a = ageOf(p.birthday); return !a ? t("noBirthday") : a.years >= 1 ? t("yearsOld", { n: a.years }) : t("monthsOld", { n: a.months }); };
    const row = (icon, title, control) => `
      <div class="settings-row">
        <span class="row-icon"><i class="icon icon-${icon}"></i></span>
        <label>${title}</label>
        <div class="row-control">${control}</div>
      </div>`;
    const card = (p) => {
      const s = summaries[p.id] || {};
      const pct = s.pagesTotal ? Math.round(100 * (s.stars || 0) / s.pagesTotal) : 0;
      return `
      <div class="profile-card ${p.id === activeId ? "active" : ""}" data-id="${esc(p.id)}">
        <span class="profile-avatar"><img src="${assetUrl(`${avatarUrl(p)}`)}" alt="" /></span>
        <div class="profile-info">
          <b>${esc(p.name) || t("unnamed")}</b>
          <small>${ageLine(p)}</small>
          <div class="board-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
          <span class="profile-stats">
            <span><i class="chip-star">★</i>${t("statStars", { n: s.starCount || 0, total: s.starTotal || 0 })}</span>
            <span><i class="icon icon-book"></i>${t("statBooks", { n: s.finished || 0, total: s.books || 0 })}</span>
            <span><i class="icon icon-star"></i>${t("statStars", { n: s.stars || 0, total: s.pagesTotal || 0 })}</span>
            <span><i class="icon icon-hand"></i>${t("statPins", { n: s.pins || 0, total: s.pinsTotal || 0 })}</span>
            <span><i class="chip-check">✓</i>${t("statQuiz", { n: s.quizRight || 0, total: s.quizTotal || 0 })}</span>
          </span>
        </div>
        <div class="profile-actions">
          ${p.id === activeId ? `<span class="profile-now">${t("readingNow")}</span>` : `<button class="pill-button small" data-switch="${esc(p.id)}"><i class="icon icon-play"></i><span>${t("switchProfile")}</span></button>`}
          <button class="pill-button small" data-edit="${esc(p.id)}"><i class="icon icon-settings"></i><span>${t("editProfile")}</span></button>
        </div>
      </div>`;
    };
    const today = new Date().toISOString().slice(0, 10);
    const form = (p) => `
      <div class="profile-form" data-id="${esc(p ? p.id : "")}">
        ${row("abc", t("childName"), `<input id="pf-name" type="text" maxlength="24" value="${esc(p ? p.name : "")}" placeholder="${esc(t("namePlaceholder"))}" autocomplete="off" />`)}
        ${row("moon", t("birthday"), `<input id="pf-birthday" type="date" value="${p && p.birthday ? esc(p.birthday) : ""}" max="${today}" />`)}
        <h3 class="folio-section"><i class="icon icon-magic"></i> ${t("favouriteHero")}</h3>
        <div class="avatar-picker" role="radiogroup" aria-label="${esc(t("favouriteHero"))}">
          ${avatars.map((a) => `<button type="button" role="radio" aria-checked="${(p ? p.avatar : (avatars[0] || {}).id) === a.id}" data-avatar="${a.id}" title="${esc(a.name)}"><img src="${assetUrl(`${a.url}`)}" alt="${esc(a.name)}" /></button>`).join("")}
        </div>
        <div class="panel-actions">
          ${p && profiles.length > 1 ? `<button class="pill-button small danger" id="pf-delete"><span>${t("removeProfile")}</span></button>` : ""}
          <button class="pill-button small" id="pf-cancel"><span>${t("cancel")}</span></button>
          <button class="pill-button small" id="pf-save"><i class="icon icon-star"></i><span>${t("save")}</span></button>
        </div>
      </div>`;
    panel.innerHTML = `
      <div class="panel-shell account" role="dialog" aria-label="${t("profiles")}">
        <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
        <header class="folio-head">
          <div class="portrait">${active ? `<img src="${assetUrl(`${avatarUrl(active)}`)}" alt="" />` : ""}</div>
          <div>
            <span class="eyebrow">STORYCOMET · ${t("profilesEyebrow")}</span>
            <h2>${t("profiles")}</h2>
            <p class="panel-description">${t("profilesBlurb")}</p>
          </div>
        </header>
        <div class="folio-rule"><i class="icon icon-star"></i></div>
        ${editing !== null ? form(editing === "new" ? null : profiles.find((p) => p.id === editing) || null) : `
        <div class="profile-list">${profiles.map(card).join("")}</div>
        <div class="panel-actions">
          ${profiles.length < max ? `<button class="pill-button small" id="pf-add"><i class="icon icon-magic"></i><span>${t("addChild")}</span></button>` : `<span class="status-line">${t("maxProfiles")}</span>`}
          <button class="pill-button small" id="pf-close"><i class="icon icon-book"></i><span>${t("backToStory")}</span></button>
        </div>
        ${document.getElementById("account-open") ? `
        <div class="folio-rule"><i class="icon icon-star"></i></div>
        <div class="settings-row${membership().pro ? " pro" : ""}">
          <span class="row-icon"><i class="icon icon-account"></i>${membership().pro ? `<i class="pro-pin" aria-hidden="true"></i>` : ""}</span>
          <label>${t("parentAccount")}${membership().pro ? ` <span class="pro-tag">${t("proMember")}</span>` : ""}<small>${esc(document.getElementById("account-identity")?.textContent || t("parentAccountBlurb"))}${membership().line ? ` ${esc(membership().line)}` : ""}</small></label>
          <div class="row-control"><button class="pill-button small" id="pf-parent"><i class="icon icon-star"></i><span>${t("openAccount")}</span></button></div>
        </div>` : ""}`}
      </div>`;
    panel.hidden = false;
    const again = (patch) => this.openAccount({ ...options, ...patch });
    panel.querySelectorAll("[data-switch]").forEach((b) => b.addEventListener("click", () => this.onAction("profile-switch", b.dataset.switch)));
    panel.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => again({ editing: b.dataset.edit })));
    const add = panel.querySelector("#pf-add");
    if (add) add.addEventListener("click", () => again({ editing: "new" }));
    const close = panel.querySelector("#pf-close");
    if (close) close.addEventListener("click", () => this.closeSettings());
    const parent = panel.querySelector("#pf-parent");
    if (parent) parent.addEventListener("click", () => { this.closeSettings(); const open = document.getElementById("account-open"); if (open) open.click(); });
    const formEl = panel.querySelector(".profile-form");
    if (formEl) {
      formEl.querySelectorAll("[data-avatar]").forEach((b) => b.addEventListener("click", () => formEl.querySelectorAll("[data-avatar]").forEach((o) => o.setAttribute("aria-checked", String(o === b)))));
      formEl.querySelector("#pf-cancel").addEventListener("click", () => again({ editing: null }));
      formEl.querySelector("#pf-save").addEventListener("click", () => {
        const name = formEl.querySelector("#pf-name").value.trim();
        if (!name) { this.toast(t("needName")); formEl.querySelector("#pf-name").focus(); return; }
        const picked = formEl.querySelector("[data-avatar][aria-checked=\"true\"]");
        this.onAction("profile-save", { id: formEl.dataset.id || null, name, birthday: formEl.querySelector("#pf-birthday").value || "", avatar: picked ? picked.dataset.avatar : (avatars[0] || {}).id });
      });
      const del = formEl.querySelector("#pf-delete");
      if (del) del.addEventListener("click", () => {
        const p = profiles.find((x) => x.id === formEl.dataset.id);
        if (p && window.confirm(t("confirmDelete", { name: p.name || t("unnamed") }))) this.onAction("profile-delete", p.id);
      });
      const nameEl = formEl.querySelector("#pf-name");
      setTimeout(() => nameEl.focus(), 350);
    }
    panel.addEventListener("click", (event) => { if (event.target === panel) this.closeSettings(); });
  }

  get settingsOpen() {
    return !this.el.panel.hidden;
  }
}
