import {assetUrl} from "./assets.js";
import {readingStore} from "./reading-store.js";
import {normalizeSouvenirs} from "./souvenir-state.js";
import { t } from "./i18n.js";
import { readPercent } from "./bookmark.js";
/* Souvenirs: the treasure hunt that runs through every book. Five enamel pins hide in the
   pop-up scenes of each story; finding one flies it up to the counter in the corner and adds
   points. The counter opens the souvenir board, a pinboard of every book with the pins found so
   far, the reading progress, the quiz stars and a few badges. Everything is kept in
   localStorage under one key so it survives reloads on the same device. */

export const PIN_POINTS = 10;
export const QUIZ_POINTS = 5;
export const FINISH_POINTS = 20;
export const PAGE_POINTS = 2;
const KEY = "storylight-souvenirs";

const BADGES = [
  { id: "first", key: "badgeFirst", get name() { return t(this.key); }, icon: "🔎", test: (s) => s.pinCount >= 1 },
  { id: "ten", key: "badgeTen", get name() { return t(this.key); }, icon: "🎒", test: (s) => s.pinCount >= 10 },
  { id: "half", key: "badgeHalf", get name() { return t(this.key); }, icon: "🧭", test: (s) => s.pinTotal > 0 && s.pinCount >= Math.ceil(s.pinTotal / 2) },
  { id: "collector", key: "badgeCollector", get name() { return t(this.key); }, icon: "🏆", test: (s) => s.pinTotal > 0 && s.pinCount >= s.pinTotal },
  { id: "reader", key: "badgeBookworm", get name() { return t(this.key); }, icon: "📚", test: (s) => s.finishedCount >= 3 },
  { id: "librarian", key: "badgeLibrarian", get name() { return t(this.key); }, icon: "🏛️", test: (s) => s.bookCount > 0 && s.finishedCount >= s.bookCount },
  { id: "quiz", key: "badgeQuiz", get name() { return t(this.key); }, icon: "⭐", test: (s) => s.perfectQuizzes >= 1 },
];

function load(key = KEY) {
  try { return normalizeSouvenirs(JSON.parse(readingStore.getItem(key) || "{}")); }
  catch (error) { return normalizeSouvenirs(null); }
}

export class Souvenirs {
  constructor({ mount, board, sound, onAction, key = KEY }) {
    this.key = key;
    this.data = load(key);
    this.sound = sound;
    this.onAction = onAction;
    this.library = [];
    this.progress = {};
    this.board = board;
    this.shown = 0;
    this.buildChip(mount);
  }

  save() {
    try { readingStore.setItem(this.key, JSON.stringify(this.data)); } catch (error) { /* private mode */ }
  }

  /** Another child is reading: their souvenirs come from their own key (src/profiles.js). */
  setKey(key) {
    this.key = key;
    this.data = load(key);
    this.shown = 0;
    this.refreshChip(false);
  }

  /** The shelf's index.json: every book's pins live there so the board can draw empty slots. */
  setLibrary(library, progress = {}) {
    this.library = (library && library.books) || [];
    this.progress = progress || {};
    this.refreshChip(false);
  }

  setProgress(progress) { this.progress = progress || {}; }

  /* ---------- the numbers ---------- */

  pinsOf(bookId) { return this.data.pins[bookId] || []; }
  /** Words of a language book the reader has tapped or looked up (the phrasebook stamps them). */
  heard(bookId) { return (this.data.heard && this.data.heard[bookId]) || []; }
  hear(bookId, key) {
    this.data.heard = this.data.heard || {};
    const list = (this.data.heard[bookId] = this.data.heard[bookId] || []);
    if (list.includes(key)) return false;
    list.push(key);
    this.save();
    return true;
  }
  has(bookId, pinId) { return this.pinsOf(bookId).includes(pinId); }
  /** A book's quiz so far: right answers in the best run, against every question it has. */
  quizOf(bookId) {
    const meta = this.library.find((b) => b.id === bookId);
    const q = this.data.quiz[bookId];
    const total = (meta && meta.quizCount) || (q && q.total) || 0;
    return { best: q ? Math.min(q.best || 0, total) : 0, total };
  }

  summary() {
    const books = this.library.filter((b) => b.status === "ready");
    const pinTotal = books.reduce((n, b) => n + ((b.pins && b.pins.length) || 0), 0);
    const pinCount = books.reduce((n, b) => n + this.pinsOf(b.id).filter((id) => (b.pins || []).some((p) => p.id === id)).length, 0);
    const finishedCount = books.filter((b) => this.data.finished[b.id]).length;
    const perfectQuizzes = books.filter((b) => { const q = this.data.quiz[b.id]; return q && q.total && q.best >= q.total; }).length;
    // right quiz answers against every question on the shelf (a quiz can always be taken again)
    const quizTotal = books.reduce((n, b) => n + (b.quizCount || (this.data.quiz[b.id] ? this.data.quiz[b.id].total : 0) || 0), 0);
    const quizRight = books.reduce((n, b) => n + Math.min((this.data.quiz[b.id] || {}).best || 0, b.quizCount || Infinity), 0);
    // stars are the reading itself: one per page read to the end, out of every page on the shelf
    const starTotal = books.reduce((n, b) => n + (b.pages || 0), 0);
    const starCount = books.reduce((n, b) => { const p = this.progress && this.progress[b.id]; const read = p && Array.isArray(p.read) ? p.read.length : ((this.data.stars || {})[b.id] || []).length; return n + Math.min(read, b.pages || 0); }, 0);
    return { points: this.data.points, pinTotal, pinCount, finishedCount, bookCount: books.length, perfectQuizzes, quizTotal, quizRight, starCount, starTotal };
  }

  /** A pin was tapped in a scene: keep it, add the points, return what changed. */
  collect(bookId, pinId) {
    if (this.has(bookId, pinId)) return null;
    (this.data.pins[bookId] = this.data.pins[bookId] || []).push(pinId);
    this.data.points += PIN_POINTS;
    const before = new Set(Object.keys(this.data.badges));
    const badges = this.checkBadges();
    this.save();
    this.refreshChip(true);
    return { points: PIN_POINTS, badges: badges.filter((b) => !before.has(b.id)) };
  }

  /** The quiz was finished: the first time (or a better run) is worth points per right answer. */
  quizResult(bookId, right, total) {
    const q = this.data.quiz[bookId] || { best: 0, total };
    const gained = Math.max(0, right - q.best) * QUIZ_POINTS;
    this.data.quiz[bookId] = { best: Math.max(q.best, right), total };
    this.data.points += gained;
    const before = new Set(Object.keys(this.data.badges));
    const badges = this.checkBadges();
    this.save();
    this.refreshChip(gained > 0);
    return { points: gained, badges: badges.filter((b) => !before.has(b.id)) };
  }

  /** A page was read to the end for the first time: its star is worth a few points. With
      `quiet`, the counter waits for the star's flight to land (flyStar) before it counts it. */
  pageStar(bookId, index, { quiet = false } = {}) {
    this.data.stars = this.data.stars || {};
    const list = (this.data.stars[bookId] = this.data.stars[bookId] || []);
    if (list.includes(index)) return null;
    list.push(index);
    this.data.points += PAGE_POINTS;
    this.save();
    if (!quiet) this.refreshChip(true);
    return { points: PAGE_POINTS };
  }

  /** Every page of the book has been read (the last star was earned). */
  finish(bookId) {
    if (this.data.finished[bookId]) return null;
    this.data.finished[bookId] = true;
    this.data.points += FINISH_POINTS;
    const before = new Set(Object.keys(this.data.badges));
    const badges = this.checkBadges();
    this.save();
    this.refreshChip(true);
    return { points: FINISH_POINTS, badges: badges.filter((b) => !before.has(b.id)) };
  }

  checkBadges() {
    const s = this.summary();
    const earned = [];
    for (const b of BADGES) {
      if (b.test(s)) { if (!this.data.badges[b.id]) this.data.badges[b.id] = Date.now(); earned.push(b); }
    }
    return earned;
  }

  /* ---------- the counter in the corner ---------- */

  buildChip(mount) {
    const chip = document.createElement("button");
    chip.className = "souvenir-chip hud";
    chip.style.setProperty("--i", "1");
    chip.setAttribute("aria-label", t("mySouvenirs"));
    chip.innerHTML = `<span class="chip-points"><i class="chip-star">★</i><b>0</b><small>/0</small></span><span class="chip-quiz"><i class="chip-check">✓</i><b>0</b><small>/0</small></span><span class="chip-pins"><i class="chip-pin"></i><b>0</b><small>/0</small></span>`;
    chip.addEventListener("click", () => { if (this.sound) this.sound.click(); this.onAction("souvenirs"); });
    mount.appendChild(chip);
    this.chip = chip;
    this.el = { points: chip.querySelector(".chip-points b"), starTotal: chip.querySelector(".chip-points small"), pins: chip.querySelector(".chip-pins b"), total: chip.querySelector(".chip-pins small"), quiz: chip.querySelector(".chip-quiz b"), quizTotal: chip.querySelector(".chip-quiz small") };
  }

  refreshChip(animate) {
    const s = this.summary();
    this.el.pins.textContent = String(s.pinCount);
    this.el.total.textContent = `/${s.pinTotal}`;
    if (this.el.quiz) { this.el.quiz.textContent = String(s.quizRight); this.el.quizTotal.textContent = `/${s.quizTotal}`; }
    if (this.el.starTotal) this.el.starTotal.textContent = `/${s.starTotal}`;
    // the first number is the stars (a page read to the end, a book finished), not the points
    if (animate) {
      this.chip.classList.remove("bump");
      void this.chip.offsetWidth;
      this.chip.classList.add("bump");
      this.rollPoints(s.starCount);
    } else {
      this.shown = s.starCount;
      this.el.points.textContent = String(s.starCount);
    }
  }

  /** The points count up rather than jump. */
  rollPoints(to) {
    const from = this.shown;
    const t0 = performance.now();
    const step = () => {
      const p = Math.min(1, (performance.now() - t0) / 900);
      const e = 1 - Math.pow(1 - p, 3);
      this.shown = Math.round(from + (to - from) * e);
      this.el.points.textContent = String(this.shown);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /** A found pin flies from the scene to the counter's pin slot. */
  flyPin(image, x, y) {
    const img = document.createElement("img");
    img.className = "pin-flight";
    img.src = assetUrl(image);
    img.alt = "";
    this.fly(img, x, y, ".chip-pins");
  }
  /** An earned star flies to the counter's star slot, and the count ticks up as it lands. */
  flyStar(x, y) {
    const star = document.createElement("i");
    star.className = "pin-flight glyph-flight star-flight";
    star.textContent = "★";
    this.fly(star, x, y, ".chip-points", () => this.refreshChip(true));
  }
  /** A right quiz answer sends a check to the counter's quiz slot. */
  flyCheck(x, y) {
    const check = document.createElement("i");
    check.className = "pin-flight glyph-flight check-flight";
    check.textContent = "✓";
    this.fly(check, x, y, ".chip-quiz", () => { this.chip.classList.remove("bump"); void this.chip.offsetWidth; this.chip.classList.add("bump"); });
  }
  /** The flight itself: a lifted arc from (x, y) to a slot of the counter, spinning and shrinking. */
  fly(el, x, y, slot, onArrive = null) {
    document.body.appendChild(el);
    const target = (this.chip.querySelector(slot) || this.chip).getBoundingClientRect();
    const tx = target.left + target.width / 2;
    const ty = target.top + target.height / 2;
    const img = el;
    const t0 = performance.now();
    const dur = 1100;
    const step = () => {
      const p = Math.min(1, (performance.now() - t0) / dur);
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      // a lifted arc: up first, then over to the corner
      const cx = x + (tx - x) * e;
      const cy = y + (ty - y) * e - Math.sin(p * Math.PI) * 160;
      const s = p < 0.25 ? 1 + p * 2.4 : 1.6 - (p - 0.25) / 0.75 * 1.25;
      img.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%) scale(${s}) rotate(${p * 540}deg)`;
      img.style.opacity = p > 0.9 ? String(1 - (p - 0.9) * 10) : "1";
      if (p < 1) requestAnimationFrame(step); else { img.remove(); if (onArrive) onArrive(tx, ty); }
    };
    img.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    requestAnimationFrame(step);
  }

  /* ---------- the souvenir board ---------- */

  open() {
    const s = this.summary();
    const books = this.library.filter((b) => b.status === "ready");
    const row = (b) => {
      const found = this.pinsOf(b.id);
      const pins = b.pins || [];
      const p = this.progress[b.id];
      const percent = !p ? 0 : (p.finished || this.data.finished[b.id]) ? 100 : readPercent(p, b.pages);
      const q = this.data.quiz[b.id];
      const quiz = this.quizOf(b.id);
      const complete = pins.length && pins.every((pin) => found.includes(pin.id));
      const status = [
        percent >= 100 ? t("finished") : percent > 0 ? t("percentRead", { percent }) : t("notStarted"),
        t("pinsOf", { found: found.filter((id) => pins.some((pin) => pin.id === id)).length, total: pins.length }),
        q ? t("quizScore", { best: quiz.best, total: quiz.total }) : "",
      ].filter(Boolean).join(" · ");
      return `
        <div class="board-row ${complete ? "complete" : ""}" data-book="${b.id}">
          <button class="board-cover" data-open="${b.id}" aria-label="${t("openTitle", { title: b.title })}"><img src="${assetUrl(`books/${b.id}/${b.cover}`)}" alt="" /></button>
          <div class="board-info">
            <b>${b.title}</b>
            <div class="board-bar" role="progressbar" aria-valuenow="${percent}"><i style="width:${percent}%"></i></div>
            <small>${status}</small>
            ${quiz.total ? `<span class="quiz-marks" role="img" aria-label="${t("quizScore", { best: quiz.best, total: quiz.total })}">${Array.from({ length: quiz.total }, (_, i) => `<i class="${i < quiz.best ? "on" : ""}"></i>`).join("")}</span>` : ""}
          </div>
          <div class="pin-slots">
            ${pins.map((pin) => {
              const got = found.includes(pin.id);
              return `<span class="pin-slot ${got ? "found" : "missing"}" title="${got ? pin.name : t("stillHiding")}"><img src="${assetUrl(`books/${b.id}/pins/${pin.id}-strip.webp`)}" data-full="${assetUrl(`books/${b.id}/pins/${pin.id}.png`)}" onerror="if(this.dataset.full){this.src=this.dataset.full;delete this.dataset.full;}" alt="${got ? pin.name : ""}" />${got ? "" : "<i>?</i>"}</span>`;
            }).join("")}
            ${complete ? `<span class="board-rosette" title="${t("everyPinFound")}">★</span>` : ""}
          </div>
        </div>`;
    };
    this.board.innerHTML = `
      <div class="board-shell" role="dialog" aria-label="${t("mySouvenirs")}">
        <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
        <header class="board-head">
          <div>
            <span class="eyebrow">${t("treasureHunt")}</span>
            <h2>${t("mySouvenirs")}</h2>
            <p class="panel-description">${t("boardBlurb")}</p>
          </div>
          <div class="board-totals">
            <div class="total"><b>${s.starCount}<small>/${s.starTotal}</small></b><span>${t("stars")}</span></div>
            <div class="total"><b>${s.quizRight}<small>/${s.quizTotal}</small></b><span>${t("quizAnswers")}</span></div>
            <div class="total"><b>${s.pinCount}<small>/${s.pinTotal}</small></b><span>${t("pinsFound")}</span></div>
          </div>
        </header>
        <div class="board-badges">
          ${BADGES.map((b) => `<span class="badge ${this.data.badges[b.id] ? "earned" : ""}" title="${b.name}"><i>${b.icon}</i><span>${b.name}</span></span>`).join("")}
        </div>
        <div class="board-rows">${books.map(row).join("")}</div>
        <div class="board-foot">
          <small>${t("starsRule")} ${t("retake")}</small>
          <button class="pill-button small primary" id="board-close"><i class="icon icon-book"></i><span>${t("backToStory")}</span></button>
        </div>
      </div>`;
    this.board.hidden = false;
    this.board.querySelector("#board-close").addEventListener("click", () => this.close());
    this.board.addEventListener("click", (event) => { if (event.target === this.board) this.close(); });
    for (const b of this.board.querySelectorAll("[data-open]")) b.addEventListener("click", () => { this.close(); this.onAction("board-open-book", b.dataset.open); });
    if (this.sound) this.sound.chime(4, 0.3);
    this.onAction("board-opened");
  }

  close() {
    this.board.hidden = true;
    this.board.innerHTML = "";
    this.onAction("board-closed");
  }

  get isOpen() { return !this.board.hidden; }
}
