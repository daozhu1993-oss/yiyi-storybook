/**
 * CinemaMode · 剧场全屏高清纯享模式
 * 方案 C：双模自由切换的核心实现
 * 零透视畸变 · 2K大开本平面跨页 · 沉浸影院暗调 · 物理书卷光影 · 伴读完全同步
 */

export class CinemaMode {
  constructor() {
    this.container = null;
    this.story = null;
    this.bookId = null;
    this.bookBase = null;
    this.currentSpread = 0;
    this.totalSpreads = 0;
    this.isOpen = false;
    this.readingState = "idle"; // "idle" | "playing" | "paused"
    this.currentlySpeakingSide = null; // "left" | "right" | null
    this.callbacks = {};
    this.autoAdvanceTimer = null;
  }

  /**
   * 初始化挂载容器与 DOM 骨架
   */
  init(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks; // { onExit, onPageChange, onPlay, onPause, onResume, onEarnStar }

    this.container.innerHTML = `
      <header class="cinema-header">
        <div class="cinema-header-left">
          <button class="cinema-btn-back" id="cinema-btn-back" aria-label="返回书架">
            <span>‹</span> 返回书架
          </button>
          <div class="cinema-title-box">
            <span class="cinema-book-title" id="cinema-book-title">绘本</span>
            <span class="cinema-book-sub" id="cinema-book-sub">一一成长系列</span>
          </div>
        </div>

        <div class="cinema-mode-pill" role="group" aria-label="阅读视图切换">
          <button type="button" id="cinema-to-3d" title="切换到3D书房书桌视角">
            <span>🧸</span><span>3D书桌模式</span>
          </button>
          <button type="button" id="cinema-to-cinema" class="active" title="当前：剧场全屏高清纯享画卷">
            <span>🎬</span><span>剧场纯享画卷 (当前)</span>
          </button>
        </div>
      </header>

      <main class="cinema-body">
        <div class="cinema-spread-wrapper" id="cinema-spread-wrapper">
          <section class="cinema-page left" id="cinema-page-left" aria-label="左侧页面"></section>
          <div class="cinema-spine-shadow" aria-hidden="true"></div>
          <section class="cinema-page right" id="cinema-page-right" aria-label="右侧页面"></section>
        </div>
      </main>

      <footer class="cinema-footer">
        <button class="cinema-nav-btn" id="cinema-prev" aria-label="上一页">◀</button>
        <button class="cinema-play-btn" id="cinema-play" aria-label="读给我听">
          <span class="cinema-play-icon">▶</span>
          <span class="cinema-play-text">读给我听</span>
        </button>
        <button class="cinema-nav-btn" id="cinema-next" aria-label="下一页">▶</button>
        <div class="cinema-divider"></div>
        <span class="cinema-indicator" id="cinema-indicator">第 1-2 页 / 共 11 页</span>
      </footer>
    `;

    // 绑定核心控制事件
    this.el = {
      title: this.container.querySelector("#cinema-book-title"),
      sub: this.container.querySelector("#cinema-book-sub"),
      btnBack: this.container.querySelector("#cinema-btn-back"),
      btnTo3D: this.container.querySelector("#cinema-to-3d"),
      wrapper: this.container.querySelector("#cinema-spread-wrapper"),
      pageLeft: this.container.querySelector("#cinema-page-left"),
      pageRight: this.container.querySelector("#cinema-page-right"),
      btnPrev: this.container.querySelector("#cinema-prev"),
      btnPlay: this.container.querySelector("#cinema-play"),
      btnNext: this.container.querySelector("#cinema-next"),
      indicator: this.container.querySelector("#cinema-indicator"),
    };

    this.el.btnBack.addEventListener("click", () => {
      this.close();
      if (this.callbacks.onBackToShelf) this.callbacks.onBackToShelf();
    });

    this.el.btnTo3D.addEventListener("click", () => {
      this.close();
    });

    this.el.btnPrev.addEventListener("click", () => this.prevSpread());
    this.el.btnNext.addEventListener("click", () => this.nextSpread());

    this.el.btnPlay.addEventListener("click", () => {
      if (this.readingState === "playing") {
        this.pauseReading();
      } else if (this.readingState === "paused") {
        this.resumeReading();
      } else {
        this.startReadingSpread();
      }
    });

    // 键盘支持
    window.addEventListener("keydown", (e) => {
      if (!this.isOpen) return;
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        this.prevSpread();
      } else if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        this.nextSpread();
      } else if (e.key === " " || e.key === "r" || e.key === "R") {
        e.preventDefault();
        this.el.btnPlay.click();
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.close();
      }
    });
  }

  /**
   * 打开并进入剧场纯享模式
   */
  open({ story, bookId, pageIndex = 0, bookBase = "" }) {
    this.story = story;
    this.bookId = bookId;
    this.bookBase = bookBase;
    this.isOpen = true;

    const pages = story.pages || [];
    // 计算跨页总数：扉页 (Spread 0) + 每两页一跨 + 尾页
    this.totalSpreads = Math.ceil(pages.length / 2) + 1;

    // 根据当前 3D 书房的 pageIndex 定位对应的跨页
    if (pageIndex < 0) {
      this.currentSpread = 0;
    } else {
      this.currentSpread = Math.min(this.totalSpreads - 1, Math.floor(pageIndex / 2) + 1);
    }

    this.el.title.textContent = story.title || "儿童绘本";
    this.el.sub.textContent = story.subtitle || "成长伴读系列";

    this.renderSpread(this.currentSpread);

    this.container.hidden = false;
    // 双 rAF 触发平滑淡入动效
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.container.classList.add("active");
      });
    });

    // 更新 3D 顶部的模式胶囊
    const mainPillCinemaBtn = document.getElementById("btn-mode-cinema");
    const mainPill3DBtn = document.getElementById("btn-mode-3d");
    if (mainPillCinemaBtn) mainPillCinemaBtn.classList.add("active");
    if (mainPill3DBtn) mainPill3DBtn.classList.remove("active");
  }

  /**
   * 退出剧场模式，返回 3D 书房书桌
   */
  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    clearTimeout(this.autoAdvanceTimer);

    this.container.classList.remove("active");
    setTimeout(() => {
      if (!this.isOpen) this.container.hidden = true;
    }, 380);

    // 计算对应的 3D 单页 pageIndex
    let targetPage = 0;
    if (this.currentSpread === 0) {
      targetPage = 0;
    } else {
      targetPage = (this.currentSpread - 1) * 2;
    }

    const mainPillCinemaBtn = document.getElementById("btn-mode-cinema");
    const mainPill3DBtn = document.getElementById("btn-mode-3d");
    if (mainPillCinemaBtn) mainPillCinemaBtn.classList.remove("active");
    if (mainPill3DBtn) mainPill3DBtn.classList.add("active");

    if (this.callbacks.onExit) {
      this.callbacks.onExit(targetPage);
    }
  }

  /**
   * 渲染指定的跨页 (Spread)
   */
  renderSpread(spreadIdx) {
    this.currentSpread = THREE_clamp(spreadIdx, 0, this.totalSpreads - 1);
    const pages = this.story.pages || [];
    const spreadData = this.getSpreadData(this.currentSpread, pages, this.story);

    this.el.pageLeft.innerHTML = this.renderPageHTML(spreadData.left, "left");
    this.el.pageRight.innerHTML = this.renderPageHTML(spreadData.right, "right");

    this.attachPageEvents(this.el.pageLeft, spreadData.left);
    this.attachPageEvents(this.el.pageRight, spreadData.right);

    // 更新底部指示器
    this.updateIndicator(spreadData, pages.length);

    // 更新翻页按钮可用状态
    this.el.btnPrev.disabled = this.currentSpread === 0;
    this.el.btnNext.disabled = this.currentSpread >= this.totalSpreads - 1;

    // 清空朗读高亮状态
    this.clearSpeakingHighlight();

    // 通知外部当前页面变更
    if (this.callbacks.onSpreadChange) {
      const activeIdx = spreadData.left && spreadData.left.pageIndex != null
        ? spreadData.left.pageIndex
        : (spreadData.right && spreadData.right.pageIndex != null ? spreadData.right.pageIndex : 0);
      this.callbacks.onSpreadChange(activeIdx);
    }
  }

  /**
   * 解析跨页数据
   */
  getSpreadData(spreadIdx, pages, story) {
    if (spreadIdx === 0) {
      return {
        type: "dedication",
        label: "扉页 · 寄语",
        left: { type: "dedication-left" },
        right: { type: "dedication-right", cover: story.cover }
      };
    }

    const leftIdx = (spreadIdx - 1) * 2;
    const rightIdx = leftIdx + 1;
    const left = leftIdx < pages.length ? pages[leftIdx] : null;
    const right = rightIdx < pages.length ? pages[rightIdx] : null;

    if (!left && !right) {
      return {
        type: "end",
        label: "全书完",
        left: { type: "end-summary" },
        right: { type: "end-congrats" }
      };
    }

    if (left && !right) {
      return {
        type: "last-pair",
        label: `第 ${leftIdx + 1} 页 · 尾声`,
        left: { ...left, pageIndex: leftIdx },
        right: { type: "end-congrats" }
      };
    }

    return {
      type: "standard",
      label: `第 ${leftIdx + 1}-${rightIdx + 1} 页`,
      left: { ...left, pageIndex: leftIdx },
      right: { ...right, pageIndex: rightIdx }
    };
  }

  /**
   * 生成单页的真实 HTML 节点
   */
  renderPageHTML(page, side) {
    if (!page) return "";

    // 1. 扉页与题词
    if (page.type === "dedication-left") {
      return `
        <div class="cinema-dedication-card">
          <div class="cinema-ornament-border"></div>
          <div class="cinema-dedication-emblem">🌱</div>
          <h2 class="cinema-dedication-title">${escapeHTML(this.story.title)}</h2>
          <p class="cinema-dedication-sub">${escapeHTML(this.story.subtitle || "一一与芽芽兽成长绘本")}</p>
          <div class="cinema-dedication-stars">✦ · ✧ · ✦</div>
          <p class="cinema-dedication-verse">献给最珍贵的一一与爸爸妈妈<br>愿每一个成长的瞬间，都被温暖珍藏。</p>
          <div class="cinema-dedication-author">—— 岛主 敬作</div>
        </div>
        <div class="cinema-page-footer">
          <span class="cinema-page-num">· 扉页 ·</span>
          <span></span>
          <span></span>
        </div>
      `;
    }

    if (page.type === "dedication-right") {
      const coverPath = page.cover ? `${this.bookBase}/${page.cover}` : `${this.bookBase}/art/cover.jpg`;
      return `
        <div class="cinema-art-box">
          <img src="${coverPath}" class="cinema-art-img" alt="${escapeHTML(this.story.title)}" />
        </div>
        <div class="cinema-page-footer">
          <span></span>
          <span class="cinema-page-caption">《${escapeHTML(this.story.title)}》</span>
          <span class="cinema-page-num">· 封面 ·</span>
        </div>
      `;
    }

    // 2. 长文散文信件 (给爸爸妈妈的话)
    if (page.parentNote || page.type === "prose") {
      const title = page.heading || (this.story.parentNote && this.story.parentNote.title) || "给爸爸妈妈的话";
      const paragraphs = page.paragraphs || (page.text ? page.text.split("\n") : []);
      const pTags = paragraphs.filter(p => p.trim()).map(p => `<p>${escapeHTML(p.trim())}</p>`).join("");
      return `
        <div class="cinema-parent-card">
          <div class="cinema-ornament-border"></div>
          <h3 class="cinema-parent-title">${escapeHTML(title)}</h3>
          <div class="cinema-parent-rule"></div>
          <div class="cinema-parent-content">${pTags}</div>
          <div class="cinema-parent-sign">—— 一一成长故事馆</div>
        </div>
        <div class="cinema-page-footer">
          <span class="cinema-page-num">${side === 'left' ? '· 寄语 ·' : ''}</span>
          <span class="cinema-page-caption">《${escapeHTML(title)}》</span>
          <span class="cinema-page-num">${side === 'right' ? '· 寄语 ·' : ''}</span>
        </div>
      `;
    }

    // 3. 全书完祝贺页
    if (page.type === "end-congrats" || page.type === "end-summary") {
      return `
        <div class="cinema-end-card">
          <div class="cinema-ornament-border"></div>
          <h2 class="cinema-end-title">全 书 完</h2>
          <div class="cinema-end-stars">★ ★ ★ ★ ★</div>
          <p class="cinema-end-desc">恭喜读完《${escapeHTML(this.story.title)}》！<br>宝宝又收获了新的一天成长 ✨</p>
          <div class="cinema-end-actions">
            <button class="cinema-btn-action" data-action="reread">🔄 重新翻阅</button>
            <button class="cinema-btn-action" data-action="back-desk">🧸 回到书房</button>
          </div>
        </div>
        <div class="cinema-page-footer">
          <span></span>
          <span></span>
          <span class="cinema-page-num">· 完 ·</span>
        </div>
      `;
    }

    // 4. 标准绘本图文页
    const imgUrl = page.image ? `${this.bookBase}/${page.image}` : "";
    const pageNum = page.pageIndex != null ? page.pageIndex + 1 : "";
    const pageNumLabel = pageNum ? `· 第 ${pageNum} 页 ·` : "";
    const storyText = page.text || page.heading || "";
    const captionLabel = storyText ? escapeHTML(storyText) : "";

    if (!imgUrl) {
      const cleanText = storyText.replace(/\{([^:}]+)(?::[^}]+)?\}/g, "$1");
      return `
        <div class="cinema-pop-up-notice">
          <div class="cinema-pop-up-badge">✨ 3D 立体剧场绘本</div>
          <h3 class="cinema-pop-up-title">${escapeHTML(page.heading || '')}</h3>
          <p class="cinema-pop-up-text">${escapeHTML(cleanText)}</p>
          <p class="cinema-pop-up-hint">💡 本绘本包含 3D 交互机关与立体模型，推荐在「🧸 3D书桌模式」下游玩</p>
          <button class="cinema-btn-action" data-action="back-desk">切换到 3D 书桌</button>
        </div>
        <div class="cinema-page-footer">
          <span class="cinema-page-num">${side === 'left' ? pageNumLabel : ''}</span>
          <span class="cinema-page-caption" data-side="${side}" data-page-index="${page.pageIndex != null ? page.pageIndex : ''}" title="点击朗读本页">${captionLabel}</span>
          <span class="cinema-page-num">${side === 'right' ? pageNumLabel : ''}</span>
        </div>
      `;
    }

    return `
      <div class="cinema-art-box">
        <img src="${imgUrl}" class="cinema-art-img" alt="${escapeHTML(page.heading || '')}" loading="eager" />
      </div>
      <div class="cinema-page-footer">
        <span class="cinema-page-num">${side === 'left' ? pageNumLabel : ''}</span>
        <span class="cinema-page-caption" data-side="${side}" data-page-index="${page.pageIndex != null ? page.pageIndex : ''}" title="点击朗读本页">${captionLabel}</span>
        <span class="cinema-page-num">${side === 'right' ? pageNumLabel : ''}</span>
      </div>
    `;
  }

  /**
   * 绑定页面内部交互 (重新翻阅、点击单句朗读等)
   */
  attachPageEvents(pageContainer, pageData) {
    if (!pageData) return;

    // 尾页按钮事件
    const rereadBtn = pageContainer.querySelector('[data-action="reread"]');
    if (rereadBtn) {
      rereadBtn.addEventListener("click", () => this.renderSpread(1));
    }
    const backDeskBtn = pageContainer.querySelector('[data-action="back-desk"]');
    if (backDeskBtn) {
      backDeskBtn.addEventListener("click", () => this.close());
    }

    // 点击文字朗读单页
    const caption = pageContainer.querySelector(".cinema-page-caption");
    if (caption && pageData.pageIndex != null) {
      caption.addEventListener("click", () => {
        this.speakSinglePage(pageData.pageIndex, caption.dataset.side);
      });
    }
  }

  /**
   * 更新底部跨页进度指示器
   */
  updateIndicator(spreadData, totalPages) {
    if (this.currentSpread === 0) {
      this.el.indicator.textContent = `扉页 / 共 ${totalPages} 页`;
    } else if (spreadData.type === "last-pair") {
      this.el.indicator.textContent = `第 ${totalPages} 页 · 尾声 / 共 ${totalPages} 页`;
    } else if (spreadData.type === "end") {
      this.el.indicator.textContent = `全书完 / 共 ${totalPages} 页`;
    } else {
      const leftNum = (this.currentSpread - 1) * 2 + 1;
      const rightNum = Math.min(totalPages, leftNum + 1);
      this.el.indicator.textContent = `第 ${leftNum}-${rightNum} 页 / 共 ${totalPages} 页`;
    }
  }

  /**
   * 翻向上一跨页
   */
  prevSpread() {
    if (this.currentSpread <= 0) return;
    this.animateTurn(() => {
      this.renderSpread(this.currentSpread - 1);
    });
  }

  /**
   * 翻向下一跨页
   */
  nextSpread() {
    if (this.currentSpread >= this.totalSpreads - 1) return;
    this.animateTurn(() => {
      this.renderSpread(this.currentSpread + 1);
    });
  }

  animateTurn(callback) {
    clearTimeout(this.autoAdvanceTimer);
    this.el.wrapper.classList.add("turning");
    setTimeout(() => {
      callback();
      requestAnimationFrame(() => {
        this.el.wrapper.classList.remove("turning");
      });
    }, 180);
  }

  /**
   * 伴读联动：朗读当前跨页 (先左后右)
   */
  async startReadingSpread() {
    const pages = this.story.pages || [];
    const spreadData = this.getSpreadData(this.currentSpread, pages, this.story);

    const leftIdx = spreadData.left && spreadData.left.pageIndex != null ? spreadData.left.pageIndex : null;
    const rightIdx = spreadData.right && spreadData.right.pageIndex != null ? spreadData.right.pageIndex : null;

    if (leftIdx == null && rightIdx == null) {
      // 扉页或尾页无朗读，翻到第一页
      if (this.currentSpread === 0) this.renderSpread(1);
      return;
    }

    this.setReadingState("playing");

    // 1. 先读左页
    if (leftIdx != null) {
      await this.speakSinglePage(leftIdx, "left");
    }

    // 检查是否在朗读过程中被用户手动暂停或切页
    if (this.readingState !== "playing") return;

    // 2. 接着读右页
    if (rightIdx != null) {
      await this.speakSinglePage(rightIdx, "right");
    }

    if (this.readingState !== "playing") return;

    // 3. 本跨页读完，检查自动翻页
    this.setReadingState("idle");
    if (this.callbacks.onSpreadCompleted) {
      this.callbacks.onSpreadCompleted(this.currentSpread);
    }

    if (this.currentSpread < this.totalSpreads - 1) {
      this.autoAdvanceTimer = setTimeout(() => {
        if (!this.isOpen || this.readingState !== "idle") return;
        this.nextSpread();
        this.startReadingSpread();
      }, 2400);
    }
  }

  /**
   * 朗读单页并高亮字幕
   */
  speakSinglePage(pageIndex, side) {
    return new Promise((resolve) => {
      this.clearSpeakingHighlight();
      this.highlightSide(side, true);

      if (this.callbacks.onSpeakPage) {
        this.callbacks.onSpeakPage(pageIndex, {
          onEnd: () => {
            this.highlightSide(side, false);
            if (this.callbacks.onEarnStar) {
              this.callbacks.onEarnStar(pageIndex);
            }
            resolve();
          }
        });
      } else {
        // 若无外部朗读器，模拟 3 秒自动结束
        setTimeout(() => {
          this.highlightSide(side, false);
          resolve();
        }, 3000);
      }
    });
  }

  pauseReading() {
    this.setReadingState("paused");
    clearTimeout(this.autoAdvanceTimer);
    if (this.callbacks.onPause) this.callbacks.onPause();
  }

  resumeReading() {
    this.setReadingState("playing");
    if (this.callbacks.onResume) this.callbacks.onResume();
    else this.startReadingSpread();
  }

  setReadingState(state) {
    this.readingState = state;
    const playText = this.el.btnPlay.querySelector(".cinema-play-text");
    const playIcon = this.el.btnPlay.querySelector(".cinema-play-icon");

    if (state === "playing") {
      this.el.btnPlay.classList.add("speaking");
      if (playIcon) playIcon.textContent = "⏸";
      if (playText) playText.textContent = "暂停伴读";
    } else if (state === "paused") {
      this.el.btnPlay.classList.remove("speaking");
      if (playIcon) playIcon.textContent = "▶";
      if (playText) playText.textContent = "继续播放";
    } else {
      this.el.btnPlay.classList.remove("speaking");
      if (playIcon) playIcon.textContent = "▶";
      if (playText) playText.textContent = "读给我听";
    }
  }

  highlightSide(side, isSpeaking) {
    const target = side === "left" ? this.el.pageLeft : this.el.pageRight;
    const caption = target.querySelector(".cinema-page-caption");
    if (caption) {
      caption.classList.toggle("speaking", isSpeaking);
    }
  }

  clearSpeakingHighlight() {
    const captions = this.container.querySelectorAll(".cinema-page-caption");
    captions.forEach(c => c.classList.remove("speaking"));
  }
}

function THREE_clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function escapeHTML(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
