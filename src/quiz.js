import {assetUrl} from "./assets.js";
import { t } from "./i18n.js";
/* The end-of-story quiz: three picture questions ("Who is the main character?") for children
   who cannot read yet. The narrator reads each question aloud, the answers are big picture
   cards that bounce in, a right answer rains confetti, and a wrong answer is explained kindly
   before the right picture is shown. Questions live in story.json under `quiz`, the voice
   clips in books/<id>/quiz/ (q1, r1, w1 ...) and two shared lines in public/audio/quiz/. */

export class Quiz {
  constructor({ root, sound, onAction }) {
    this.root = root;
    this.sound = sound;
    this.onAction = onAction;
    this.story = null;
    this.base = "";
    this.audio = null;
    this.index = 0;
    this.locked = false;
    this.open = false;
    this.build();
  }

  build() {
    this.root.innerHTML = `
      <div class="quiz-inner">
        <div class="quiz-stars" aria-hidden="true"><i></i><i></i><i></i></div>
        <div class="quiz-card hud">
          <i class="corner tl" aria-hidden="true"></i><i class="corner br" aria-hidden="true"></i>
          <span class="quiz-eyebrow"></span>
          <h2 class="quiz-question"></h2>
          <span class="quiz-voice" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        </div>
        <div class="quiz-options"></div>
        <div class="quiz-done" hidden>
          <div class="quiz-trophy">★</div>
          <h2>${t("youDidIt")}</h2>
          <p class="quiz-score"></p>
          <p class="quiz-points" hidden></p>
          <div class="quiz-buttons">
            <button class="pill-button primary" data-quiz="again"><span>${t("readAgain")}</span></button>
            <button class="pill-button" data-quiz="shelf"><span>${t("backToShelf")}</span></button>
          </div>
        </div>
        <button class="quiz-close" aria-label="${t('closeQuiz')}">×</button>
        <div class="quiz-confetti" aria-hidden="true"></div>
      </div>`;
    this.el = {
      stars: this.root.querySelectorAll(".quiz-stars i"),
      card: this.root.querySelector(".quiz-card"),
      eyebrow: this.root.querySelector(".quiz-eyebrow"),
      question: this.root.querySelector(".quiz-question"),
      options: this.root.querySelector(".quiz-options"),
      done: this.root.querySelector(".quiz-done"),
      score: this.root.querySelector(".quiz-score"),
      points: this.root.querySelector(".quiz-points"),
      confetti: this.root.querySelector(".quiz-confetti"),
    };
    this.root.querySelector(".quiz-close").addEventListener("click", () => { this.hide(); this.onAction("quiz-close"); });
    for (const b of this.root.querySelectorAll("[data-quiz]")) b.addEventListener("click", () => { this.hide(); this.onAction(`quiz-${b.dataset.quiz}`); });
  }

  setStory(story, base, lang = "en") {
    this.story = story;
    this.base = base;
    this.lang = lang || "en";
  }

  /** The two shared lines ("Let's see what you remember", "You did it") in the story's language. */
  shared(name) {
    return this.lang && this.lang !== "en" ? `public/audio/quiz/${this.lang}/${name}.mp3` : `public/audio/quiz/${name}.mp3`;
  }

  get questions() { return (this.story && this.story.quiz && this.story.quiz.questions) || []; }
  get available() { return this.questions.length > 0; }

  imageFor(option) {
    if (option.image === "portrait") return `${this.base}/${this.story.portrait}`;
    if (option.image && option.image.startsWith("art:")) return `${this.base}/art/${option.image.slice(4)}`;
    return `${this.base}/words/cards/${option.word.toLowerCase()}.jpg`;
  }

  clip(name) {
    const folder = (this.story.quiz && this.story.quiz.folder) || "quiz";
    return `${this.base}/${folder}/${name}.mp3`;
  }

  /** Play one voice clip; resolves when it ends (or right away if it cannot play). */
  play(url) {
    this.stopVoice();
    this.root.classList.add("speaking");
    return new Promise((resolve) => {
      const a = new Audio(assetUrl(url));
      this.audio = a;
      a.volume = this.sound && this.sound.muted ? 0 : 1;
      let done = false;
      const finish = () => { if (done) return; done = true; if (this.audio === a) { this.audio = null; this.root.classList.remove("speaking"); } resolve(); };
      a.addEventListener("ended", finish);
      a.addEventListener("error", finish);
      a.play().catch(finish);
      // a safety net if the browser never fires "ended"
      a.addEventListener("loadedmetadata", () => setTimeout(finish, (a.duration || 6) * 1000 + 800));
    });
  }

  stopVoice() {
    if (this.audio) { try { this.audio.pause(); } catch (error) { /* ignore */ } this.audio = null; }
  }

  async start() {
    if (!this.available) return;
    this.open = true;
    document.body.classList.add("quiz-open");
    this.index = 0;
    this.right = 0;
    this.root.hidden = false;
    this.el.done.hidden = true;
    // one star per question (the language books ask four)
    const starRow = this.root.querySelector(".quiz-stars");
    starRow.innerHTML = "<i></i>".repeat(this.questions.length);
    this.el.stars = starRow.querySelectorAll("i");
    this.el.stars.forEach((s) => s.classList.remove("on", "half"));
    this.root.classList.remove("finished");
    this.ask(0, true);
    await this.play(this.shared("intro"));
    if (this.open && this.index === 0) this.play(this.clip("q1"));
  }

  hide() {
    this.open = false;
    document.body.classList.remove("quiz-open");
    this.stopVoice();
    this.root.hidden = true;
    this.el.confetti.innerHTML = "";
  }

  ask(i, silent = false) {
    const q = this.questions[i];
    if (!q) { this.finish(); return; }
    this.index = i;
    this.locked = false;
    this.el.eyebrow.textContent = t("questionOf", { n: i + 1, total: this.questions.length });
    // the question comes in one word at a time, like the story text
    this.el.question.innerHTML = q.q.split(" ").map((w, k) => `<span class="quiz-word" style="--k: ${k}">${w}</span>`).join(" ");
    retrigger(this.el.card, "arriving");
    this.el.options.innerHTML = "";
    // the answers come in a fresh order every time so the right one is not always first
    const order = q.options.map((o, k) => k).sort(() => Math.random() - 0.5);
    order.forEach((k, slot) => {
      const o = q.options[k];
      const b = document.createElement("button");
      b.className = "quiz-option";
      b.style.setProperty("--i", slot);
      b.dataset.index = k;
      const lang = (this.story.language && this.story.language.code) || "";
      b.innerHTML = `<span class="quiz-pic"><img alt="" src="${assetUrl(`${this.imageFor(o)}`)}"></span><b>${o.label || o.word}</b>${o.sub ? `<small class="quiz-sub" lang="${lang}">${o.sub}</small>` : ""}<span class="quiz-stamp" aria-hidden="true">★</span><span class="quiz-ripple" aria-hidden="true"></span>`;
      b.addEventListener("pointerdown", () => { if (!this.locked) { b.classList.add("pressed"); if (this.sound) this.sound.click(); } });
      b.addEventListener("pointerup", () => b.classList.remove("pressed"));
      b.addEventListener("pointerleave", () => b.classList.remove("pressed"));
      b.addEventListener("click", () => this.answer(k, b));
      b.addEventListener("pointerenter", () => { if (!this.locked && this.sound) this.sound.chime(3, 0.12); });
      this.el.options.appendChild(b);
    });
    if (!silent) this.play(this.clip(`q${i + 1}`));
  }

  async answer(k, button) {
    if (this.locked) return;
    this.locked = true;
    const q = this.questions[this.index];
    const buttons = Array.from(this.el.options.children);
    const correct = k === q.answer;
    if (correct) {
      this.right++;
      button.classList.add("correct");
      { const r = button.getBoundingClientRect(); this.onAction("quiz-right", { x: r.left + r.width / 2, y: r.top + r.height / 2 }); }
      this.root.classList.add("celebrate");
      setTimeout(() => this.root.classList.remove("celebrate"), 1600);
      buttons.filter((b) => b !== button).forEach((b) => b.classList.add("dim"));
      this.confetti(button);
      if (this.sound) { this.sound.sparkle(); setTimeout(() => this.sound.cheer && this.sound.cheer(0, 0.45), 150); }
      this.el.stars[this.index].classList.add("on");
      [0, 2, 4].forEach((n, i) => setTimeout(() => this.sound && this.sound.chime(n + 4, 0.3), 120 + i * 110));
      await this.play(this.clip(`r${this.index + 1}`));
    } else {
      button.classList.add("wrong");
      if (this.sound) { this.sound.pop(0.55); setTimeout(() => this.sound.boing && this.sound.boing(1, 0.35), 180); }
      const rightButton = buttons.find((b) => Number(b.dataset.index) === q.answer);
      setTimeout(() => { if (rightButton) { rightButton.classList.add("reveal"); if (this.sound) this.sound.chime(6, 0.35); } buttons.filter((b) => b !== rightButton && b !== button).forEach((b) => b.classList.add("dim")); }, 1400);
      this.el.stars[this.index].classList.add("half");
      await this.play(this.clip(`w${this.index + 1}`));
    }
    if (!this.open) return;
    await new Promise((r) => setTimeout(r, 500));
    if (!this.open) return;
    if (this.index + 1 < this.questions.length) this.ask(this.index + 1); else this.finish();
  }

  async finish() {
    this.el.options.innerHTML = "";
    this.el.card.hidden = true;
    this.el.done.hidden = false;
    this.root.classList.add("finished");
    const n = this.questions.length;
    this.el.score.textContent = `${this.right === n ? t("everyStar") : t("starsOf", { right: this.right, total: n })} ${t("retake")}`;
    this.el.points.hidden = true;
    this.onAction("quiz-result", { right: this.right, total: n });
    retrigger(this.el.done, "arriving");
    this.confetti(this.el.done, 60);
    if (this.sound) { this.sound.sparkle(); setTimeout(() => this.sound.cheer && this.sound.cheer(0, 0.5), 200); }
    await this.play(this.shared("done"));
    this.el.card.hidden = false;
  }

  /** Points earned by this run (from the souvenir counter), shown under the score. */
  showPoints(points) {
    if (!points) return;
    this.el.points.textContent = t("quizPoints", { points });
    this.el.points.hidden = false;
    retrigger(this.el.points, "arriving");
  }

  /** A shower of paper bits from an element. */
  confetti(from, count = 36) {
    const box = from.getBoundingClientRect();
    const root = this.el.confetti.getBoundingClientRect();
    const colors = ["#ffd97a", "#e2493d", "#4f8fd6", "#8fd47a", "#f6a3c0", "#fff3d6"];
    for (let i = 0; i < count; i++) {
      const p = document.createElement("i");
      const x = box.left + box.width / 2 - root.left + (Math.random() - 0.5) * box.width * 0.6;
      const y = box.top + box.height / 2 - root.top;
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      p.style.background = colors[i % colors.length];
      p.style.setProperty("--dx", `${(Math.random() - 0.5) * 420}px`);
      p.style.setProperty("--dy", `${-120 - Math.random() * 260}px`);
      p.style.setProperty("--r", `${(Math.random() - 0.5) * 900}deg`);
      p.style.animationDelay = `${Math.random() * 120}ms`;
      p.style.width = `${8 + Math.random() * 8}px`;
      p.style.height = `${10 + Math.random() * 8}px`;
      this.el.confetti.appendChild(p);
      setTimeout(() => p.remove(), 2200);
    }
  }
}

function retrigger(el, className) {
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
}
