export class RaceCarousel {
  constructor(options = {}) {
    // ========================================
    // 預設設定
    // ========================================
    const defaults = {
      root: null,
      track: '.race-list-track',
      breakpoint: 768,
      visibleCount: { desktop: 4, mobile: 3 },
      gap: { desktop: 8, mobile: 5 },
      alignInset: 0,

      // 是否啟用無限循環
      loop: true,

      // 自訂 clone 數量
      // null = 依照內建規則決定
      loopCloneCount: null,

      // 是否啟用 snap 對齊
      snap: true,

      // 桌機滑輪滾動
      wheelEnabled: true,
      wheelDesktopOnly: true,

      // 桌機 pointer drag
      dragThreshold: 6,
      usePointerDrag: true,

      // 尺寸監測
      observeResize: true,
      useWindowResize: true,

      // 點擊行為
      clickSetsActive: true,
      clickScrollIntoView: true,
      fireCardClick: true,

      // 手機中央主卡模式
      // 開啟後，手機版不再平均分配寬度，而是採用「中央主卡 + 左右露半張」的布局
      mobileCenterMode: false,

      // 手機中央主卡寬度比例（相對於 root 寬度）
      mobileCardWidthRatio: 0.58,

      cardClassName: 'race-card simplified loop-card',
      cardRenderer: item => `
        <div class="race-card-bg" style="background-image: url('${item.trackMap || ''}')"></div>
        <div class="race-card-info">
          <div class="race-card-title">${item.title || ''}</div>
        </div>
      `,
      getItemId: item => String(item.id),
      onCardClick: null,
      onActiveChange: null,
    };

    this.config = {
      ...defaults,
      ...options,
      visibleCount: { ...defaults.visibleCount, ...(options.visibleCount || {}) },
      gap: { ...defaults.gap, ...(options.gap || {}) },
    };

    // ========================================
    // 主要 DOM
    // ========================================
    this.root = this.resolveElement(this.config.root);
    if (!this.root) {
      throw new Error('RaceCarousel 初始化失敗：找不到 root');
    }

    this.track = this.root.querySelector(this.config.track);
    if (!this.track) {
      throw new Error('RaceCarousel 初始化失敗：找不到 track');
    }

    // ========================================
    // 內部狀態
    // ========================================
    this.items = [];
    this.rendered = [];
    this.activeId = null;
    this.isOpen = false;
    this.cloneCount = 0;
    this.slideWidth = 0;
    this.step = 0;
    this.snapTimer = null;
    this.resizeObserver = null;
    this.resizeRafId = 0;
    this.openRafId = 0;
    this.openSequence = 0;
    this.lastObservedRootWidth = 0;
    this.lastAppliedLayoutSignature = '';
    this.lastAppliedRootWidth = 0;
    this.lastKnownScrollLeft = 0;
    this.programmaticScrollRafId = 0;
    this.programmaticScrollActive = false;
    this.programmaticTargetLeft = 0;
    this.inertiaRafId = 0;
    this.inertiaActive = false;
    this.inertiaMode = '';

    // 手機原生 touch loop 正規化 timer
    this.nativeLoopNormalizeTimer = 0;

    // 桌機拖曳狀態
    this.drag = {
      active: false,
      moved: false,
      startX: 0,
      startScrollLeft: 0,
      lastX: 0,
      lastTime: 0,
      velocity: 0,
    };

    // 滑輪慣性狀態
    this.wheel = {
      velocity: 0,
      lastTime: 0,
    };

    // 手機 touch 狀態
    this.touch = {
      active: false,
    };

    // ========================================
    // 綁定事件
    // ========================================
    this.boundResize = this.handleResize.bind(this);
    this.boundScroll = this.handleScroll.bind(this);
    this.boundWheel = this.handleWheel.bind(this);
    this.boundPointerDown = this.handlePointerDown.bind(this);
    this.boundPointerMove = this.handlePointerMove.bind(this);
    this.boundPointerUp = this.handlePointerUp.bind(this);
    this.boundTouchStart = this.handleTouchStart.bind(this);
    this.boundTouchEnd = this.handleTouchEnd.bind(this);

    this.root.addEventListener('scroll', this.boundScroll, { passive: true });
    this.root.addEventListener('wheel', this.boundWheel, { passive: false });
    this.root.addEventListener('touchstart', this.boundTouchStart, { passive: true });
    this.root.addEventListener('touchend', this.boundTouchEnd, { passive: true });
    this.root.addEventListener('touchcancel', this.boundTouchEnd, { passive: true });

    if (this.config.usePointerDrag) {
      this.root.addEventListener('pointerdown', this.boundPointerDown);
      window.addEventListener('pointermove', this.boundPointerMove);
      window.addEventListener('pointerup', this.boundPointerUp);
    }

    if (this.config.useWindowResize) {
      window.addEventListener('resize', this.boundResize);
    }
  }

  // 解析 root / selector
  resolveElement(target) {
    if (!target) return null;
    if (target instanceof Element) return target;
    return document.querySelector(target);
  }

  // 是否為手機版
  isMobile() {
    return window.innerWidth <= this.config.breakpoint;
  }

  // 是否為「手機 + loop + 原生 touch scroll」模式
  // 這個模式下不能像桌機一樣每次 scroll 都立刻 normalize，否則會卡住
  isNativeMobileLoopMode() {
    return this.isMobile() && this.config.loop && !this.config.usePointerDrag;
  }

  getVisibleCount() {
    return this.isMobile()
      ? this.config.visibleCount.mobile
      : this.config.visibleCount.desktop;
  }

  getGap() {
    return this.isMobile()
      ? this.config.gap.mobile
      : this.config.gap.desktop;
  }

  // 取得對齊內縮量
  // 手機中央主卡模式下，會自動把 active 卡置中
  getAlignInset() {
    if (this.isMobile() && this.config.mobileCenterMode && this.slideWidth > 0) {
      return Math.max(0, (this.getLayoutWidth() - this.slideWidth) / 2);
    }

    return Math.max(0, Number(this.config.alignInset) || 0);
  }

  // 純原生 scroller 模式：不 loop、不 snap、不 drag
  usesNativeScrollerMode() {
    return !this.config.loop && !this.config.snap && !this.config.usePointerDrag;
  }

  getSlides() {
    return Array.from(this.track.querySelectorAll('[data-carousel-slide="1"]'));
  }

  // 只取真正 body 區塊的 slide，不含 head / tail clone
  getBodySlides() {
    const slides = this.getSlides();
    if (!this.config.loop || !this.items.length || !this.cloneCount) return slides;
    return slides.slice(this.cloneCount, this.cloneCount + this.items.length);
  }

  getBodySlide(realIndex) {
    const slides = this.getBodySlides();
    return slides[realIndex] || null;
  }

  getLayoutWidth() {
    const rectWidth = this.root.getBoundingClientRect().width || 0;
    return rectWidth || this.root.clientWidth || 0;
  }

  getLayoutSignature(rootWidth = this.getLayoutWidth()) {
    const normalizedWidth = Math.round(rootWidth * 100) / 100;
    return [normalizedWidth, this.getVisibleCount(), this.getGap(), this.items.length].join(':');
  }

  // 取得 loop clone 數量
  // 手機 coverflow / native loop 模式下，clone 數量拉滿比較穩，不容易出現撞邊界後跳卡
  getLoopCloneCount() {
    if (!this.config.loop || this.items.length <= 1) return 0;

    const configured = Number(this.config.loopCloneCount);
    if (Number.isFinite(configured) && configured > 0) {
      return Math.min(Math.floor(configured), this.items.length);
    }

    if (this.isNativeMobileLoopMode()) {
      return this.items.length;
    }

    return Math.min(this.getVisibleCount() + 1, this.items.length);
  }

  // 取得 slide 左側位置
  // 有 renderIndex 時直接用 step 推算，避免反覆量測 DOM
  getSlideLeft(slide) {
    if (!slide) return 0;

    const renderIndex = Number(slide.dataset.renderIndex);
    if (Number.isFinite(renderIndex) && this.step > 0) {
      return renderIndex * this.step;
    }

    const slideRect = slide.getBoundingClientRect();
    const rootRect = this.root.getBoundingClientRect();
    return (slideRect.left - rootRect.left) + this.root.scrollLeft;
  }

  // body 區起始偏移
  getBodyStartOffset() {
    if (!this.config.loop) {
      return 0;
    }

    if (this.step > 0) {
      return this.cloneCount * this.step;
    }

    const firstBodySlide = this.getBodySlide(0);
    return firstBodySlide ? this.getSlideLeft(firstBodySlide) : 0;
  }

  getBodyAlignOffset() {
    return this.getBodyStartOffset();
  }

  // 真正 body 區總寬
  getSegmentWidth() {
    if (!this.config.loop || !this.items.length || !this.step) return 0;
    return this.items.length * this.step;
  }

  getBodyEndOffset() {
    return this.getBodyStartOffset() + this.getSegmentWidth();
  }

  getPositionForRealIndex(realIndex) {
    const safeIndex = Math.max(0, Math.min(this.items.length - 1, realIndex));
    return this.getBodyStartOffset() + (safeIndex * this.step);
  }

  // ========================================
  // 建立 carousel
  // ========================================
  build(items = []) {
    this.items = Array.isArray(items) ? [...items] : [];
    this.track.innerHTML = '';
    this.rendered = [];
    this.lastAppliedLayoutSignature = '';
    this.lastAppliedRootWidth = 0;

    if (!this.items.length) return;

    this.cloneCount = this.getLoopCloneCount();

    const headClones = this.cloneCount
      ? this.items.slice(-this.cloneCount).map((item, cloneSourceIndex) => ({
          item,
          realIndex: this.items.length - this.cloneCount + cloneSourceIndex,
          clone: 'head',
        }))
      : [];

    const body = this.items.map((item, realIndex) => ({
      item,
      realIndex,
      clone: 'body',
    }));

    const tailClones = this.cloneCount
      ? this.items.slice(0, this.cloneCount).map((item, realIndex) => ({
          item,
          realIndex,
          clone: 'tail',
        }))
      : [];

    this.rendered = [...headClones, ...body, ...tailClones];

    this.rendered.forEach((entry, renderIndex) => {
      const slide = document.createElement('div');
      slide.className = this.config.cardClassName;
      slide.dataset.carouselSlide = '1';
      slide.dataset.itemId = this.config.getItemId(entry.item);
      slide.dataset.realIndex = String(entry.realIndex);
      slide.dataset.renderIndex = String(renderIndex);
      slide.dataset.clone = entry.clone;
      slide.style.setProperty('--card-order', String(entry.realIndex));
      slide.innerHTML = this.config.cardRenderer(entry.item);

      slide.addEventListener('click', event => {
        if (this.drag.moved) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        if (this.config.clickSetsActive) {
          this.setActiveById(
            slide.dataset.itemId,
            this.config.clickScrollIntoView,
            false
          );
        }

        if (this.config.fireCardClick && typeof this.config.onCardClick === 'function') {
          this.config.onCardClick(entry.item, slide, entry.realIndex, event);
        }
      });

      this.track.appendChild(slide);
    });

    this.applyLayout(true);
    this.resetPosition(false);
  }

  // ========================================
  // 套用寬度 / gap / 位置計算
  // ========================================
  applyLayout(force = false) {
    const visibleCount = this.getVisibleCount();
    const gap = this.getGap();
    const rootWidth = this.getLayoutWidth();
    const layoutSignature = this.getLayoutSignature(rootWidth);

    this.root.style.setProperty('--visible-count', String(visibleCount));
    this.root.style.setProperty('--race-card-gap', `${gap}px`);

    if (!rootWidth || !visibleCount) return false;

    if (!force && layoutSignature === this.lastAppliedLayoutSignature) {
      return true;
    }

    const layoutWidth = Math.max(0, rootWidth);
    let nextSlideWidth = 0;

    // 手機中央主卡模式
    // 這裡不再用 visibleCount 平均分配，而是直接用比例寬度，
    // 讓中央卡可以較大，左右只露出部分區域
    if (this.isMobile() && this.config.mobileCenterMode) {
      const ratio = Math.min(0.8, Math.max(0.42, Number(this.config.mobileCardWidthRatio) || 0.58));
      nextSlideWidth = Math.max(1, Math.floor(layoutWidth * ratio));
    } else {
      const totalGapWidth = gap * (visibleCount - 1);
      const availableWidth = Math.max(0, layoutWidth - totalGapWidth);
      nextSlideWidth = Math.max(1, Math.floor(availableWidth / visibleCount));
    }

    this.slideWidth = nextSlideWidth;
    this.step = this.slideWidth + gap;
    this.lastAppliedLayoutSignature = layoutSignature;
    this.lastAppliedRootWidth = rootWidth;

    this.track.style.display = 'flex';
    this.track.style.width = 'max-content';

    this.getSlides().forEach(slide => {
      slide.style.width = `${this.slideWidth}px`;
    });

    return true;
  }

  // 設定 scrollLeft，並在 loop 模式下進行位置正規化
  setScrollPosition(nextLeft, syncDragAnchor = false) {
    if (!Number.isFinite(nextLeft)) return 0;

    this.root.scrollLeft = nextLeft;
    this.lastKnownScrollLeft = this.root.scrollLeft;
    return this.normalizeLoopPosition(syncDragAnchor);
  }

  // 當滑進 head / tail clone 區時，立即把位置換回 body 區對應位置
  // 視覺上看起來就像無限循環
  normalizeLoopPosition(syncDragAnchor = false) {
    if (!this.config.loop || !this.items.length || !this.cloneCount || !this.step) return 0;

    const segmentWidth = this.getSegmentWidth();
    const bodyStart = this.getBodyStartOffset();
    const bodyEnd = this.getBodyEndOffset();
    if (!segmentWidth || bodyEnd <= bodyStart) return 0;

    let current = this.root.scrollLeft;
    let offset = 0;

    while (current < bodyStart) {
      current += segmentWidth;
      offset += segmentWidth;
    }

    while (current >= bodyEnd) {
      current -= segmentWidth;
      offset -= segmentWidth;
    }

    if (!offset) return 0;

    this.root.scrollLeft = current;
    this.lastKnownScrollLeft = current;

    if (syncDragAnchor && this.drag.active) {
      this.drag.startScrollLeft += offset;
    }

    if (this.programmaticScrollActive) {
      this.programmaticTargetLeft += offset;
    }

    return offset;
  }

  // 重設起始位置
  resetPosition(keepActive = true) {
    if (!this.items.length || !this.step) return;

    if (keepActive && this.activeId) {
      this.scrollToId(this.activeId, false);
      return;
    }

    this.stopProgrammaticScroll();
    this.stopInertiaScroll();

    if (this.usesNativeScrollerMode() && this.lastKnownScrollLeft > 0) {
      this.scrollToLeft(this.lastKnownScrollLeft, false);
      return;
    }

    this.scrollToLeft(this.getBodyAlignOffset(), false);
  }

  stopProgrammaticScroll() {
    this.programmaticScrollActive = false;
    this.programmaticTargetLeft = 0;
    cancelAnimationFrame(this.programmaticScrollRafId);
    this.programmaticScrollRafId = 0;
  }

  stopInertiaScroll() {
    this.inertiaActive = false;
    this.inertiaMode = '';
    cancelAnimationFrame(this.inertiaRafId);
    this.inertiaRafId = 0;
  }

  clearNativeLoopNormalizeTimer() {
    if (!this.nativeLoopNormalizeTimer) return;
    clearTimeout(this.nativeLoopNormalizeTimer);
    this.nativeLoopNormalizeTimer = 0;
  }

  // 手機原生滑動時，不要每幀強制 normalize
  // 改成延後一點再修正，避免觸控滑動過程卡住
  scheduleNativeLoopNormalize(delay = 50) {
    if (!this.isNativeMobileLoopMode()) return;

    this.clearNativeLoopNormalizeTimer();
    this.nativeLoopNormalizeTimer = window.setTimeout(() => {
      this.nativeLoopNormalizeTimer = 0;
      this.normalizeLoopPosition();
    }, delay);
  }

  // 桌機拖曳慣性
  startInertiaScroll() {
    if (!this.config.usePointerDrag) return;

    const minVelocity = 0.02;

    if (Math.abs(this.drag.velocity) < minVelocity) {
      this.drag.velocity = 0;
      this.normalizeLoopPosition();
      this.queueSnap(40);
      return;
    }

    this.stopInertiaScroll();
    this.inertiaActive = true;
    this.inertiaMode = 'drag';

    let lastTime = performance.now();

    const tick = now => {
      if (!this.inertiaActive || this.inertiaMode !== 'drag') {
        this.inertiaRafId = 0;
        return;
      }

      const dt = Math.min(34, Math.max(1, now - lastTime));
      lastTime = now;

      this.setScrollPosition(this.root.scrollLeft + this.drag.velocity * dt);

      const friction = Math.pow(0.76, dt / 16.667); //慣性速度
      this.drag.velocity *= friction;

      if (Math.abs(this.drag.velocity) < minVelocity) {
        this.drag.velocity = 0;
        this.stopInertiaScroll();
        this.normalizeLoopPosition();
        this.queueSnap(40);
        return;
      }

      this.inertiaRafId = requestAnimationFrame(tick);
    };

    this.inertiaRafId = requestAnimationFrame(tick);
  }

  // 桌機滑輪慣性
  startWheelInertiaScroll() {
    const minVelocity = 0.02;

    if (Math.abs(this.wheel.velocity) < minVelocity) {
      this.wheel.velocity = 0;
      this.normalizeLoopPosition();
      this.queueSnap(120);
      return;
    }

    if (this.inertiaActive && this.inertiaMode === 'wheel') {
      return;
    }

    this.stopInertiaScroll();
    this.inertiaActive = true;
    this.inertiaMode = 'wheel';

    let lastTime = performance.now();

    const tick = now => {
      if (!this.inertiaActive || this.inertiaMode !== 'wheel') {
        this.inertiaRafId = 0;
        return;
      }

      const dt = Math.min(34, Math.max(1, now - lastTime));
      lastTime = now;

      this.setScrollPosition(this.root.scrollLeft + this.wheel.velocity * dt);

      const friction = Math.pow(0.92, dt / 16.667);
      this.wheel.velocity *= friction;

      if (Math.abs(this.wheel.velocity) < minVelocity) {
        this.wheel.velocity = 0;
        this.stopInertiaScroll();
        this.normalizeLoopPosition();
        this.queueSnap(120);
        return;
      }

      this.inertiaRafId = requestAnimationFrame(tick);
    };

    this.inertiaRafId = requestAnimationFrame(tick);
  }

  watchProgrammaticScroll() {
    cancelAnimationFrame(this.programmaticScrollRafId);

    const tick = () => {
      if (!this.programmaticScrollActive) {
        this.programmaticScrollRafId = 0;
        return;
      }

      const diff = Math.abs(this.root.scrollLeft - this.programmaticTargetLeft);
      if (diff <= 1) {
        this.setScrollPosition(this.programmaticTargetLeft);
        this.stopProgrammaticScroll();
        return;
      }

      this.programmaticScrollRafId = requestAnimationFrame(tick);
    };

    this.programmaticScrollRafId = requestAnimationFrame(tick);
  }

  startObserveRoot() {
    if (!this.config.observeResize) return;
    if (this.resizeObserver || typeof ResizeObserver === 'undefined') return;

    this.lastObservedRootWidth = this.getLayoutWidth();

    this.resizeObserver = new ResizeObserver(entries => {
      if (!this.isOpen) return;
      if (!entries.length) return;
      if (this.drag.active) return;

      const width = this.getLayoutWidth();
      if (!width) return;
      if (Math.abs(width - this.lastObservedRootWidth) < 0.5) return;

      this.lastObservedRootWidth = width;

      cancelAnimationFrame(this.resizeRafId);
      this.resizeRafId = requestAnimationFrame(() => {
        const currentActiveId = this.activeId;
        const currentScrollLeft = this.root.scrollLeft;
        this.applyLayout();

        if (this.usesNativeScrollerMode()) {
          this.root.scrollLeft = Math.max(0, currentScrollLeft);
          this.lastKnownScrollLeft = this.root.scrollLeft;
          return;
        }

        if (currentActiveId) {
          this.scrollToId(currentActiveId, false);
        } else {
          this.resetPosition(false);
        }
      });
    });

    this.resizeObserver.observe(this.root);
  }

  stopObserveRoot() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    cancelAnimationFrame(this.resizeRafId);
    this.resizeRafId = 0;
  }

  // 打開 carousel 後等待 layout 穩定，再做寬度與定位
  open() {
    this.isOpen = true;
    this.startObserveRoot();
    this.openSequence += 1;
    const openSequence = this.openSequence;

    cancelAnimationFrame(this.openRafId);

    return new Promise(resolve => {
      let lastSignature = '';
      let stableCount = 0;

      const finish = opened => {
        if (openSequence !== this.openSequence) {
          resolve(false);
          return;
        }

        this.openRafId = 0;
        requestAnimationFrame(() => {
          if (opened) {
            this.applyLayout(true);
            this.resetPosition(true);
            this.updateActiveClasses();
          }
          resolve(opened);
        });
      };

      const syncOpenLayout = (attempt = 0) => {
        if (!this.isOpen || openSequence !== this.openSequence) {
          finish(false);
          return;
        }

        const rootWidth = this.getLayoutWidth();
        const layoutSignature = this.getLayoutSignature(rootWidth);

        if (!rootWidth && attempt < 36) {
          this.openRafId = requestAnimationFrame(() => syncOpenLayout(attempt + 1));
          return;
        }

        if (layoutSignature === lastSignature) {
          stableCount += 1;
        } else {
          stableCount = 0;
          lastSignature = layoutSignature;
        }

        const layoutReady = this.applyLayout(true);
        if ((!layoutReady || stableCount < 3) && attempt < 36) {
          this.openRafId = requestAnimationFrame(() => syncOpenLayout(attempt + 1));
          return;
        }

        this.lastObservedRootWidth = rootWidth;
        this.resetPosition(true);
        this.updateActiveClasses();
        finish(true);
      };

      this.openRafId = requestAnimationFrame(() => syncOpenLayout());
    });
  }

  close() {
    this.isOpen = false;
    this.touch.active = false;
    this.openSequence += 1;
    this.clearSnapTimer();
    this.clearNativeLoopNormalizeTimer();
    this.stopProgrammaticScroll();
    this.stopInertiaScroll();
    cancelAnimationFrame(this.openRafId);
    this.openRafId = 0;
    this.stopObserveRoot();
  }

  refreshAfterOpen() {
    return this.open();
  }

  clearSnapTimer() {
    if (!this.snapTimer) return;
    clearTimeout(this.snapTimer);
    this.snapTimer = null;
  }

  queueSnap(delay = 90) {
    if (!this.config.snap) return;
    this.clearSnapTimer();
    this.snapTimer = setTimeout(() => {
      this.snapToNearest();
    }, delay);
  }

  getNearestSnapSlide() {
    if (!this.items.length || !this.step) return null;

    const relative = this.root.scrollLeft - this.getBodyStartOffset();
    const nearestIndex = Math.max(
      0,
      Math.min(this.items.length - 1, Math.round(relative / this.step))
    );

    return this.getBodySlide(nearestIndex);
  }

  // 捲動到指定 left
  // 手機中央主卡模式下，會透過 alignInset 讓卡片置中
  scrollToLeft(targetLeft, smooth = false) {
    if (!Number.isFinite(targetLeft)) return;

    const alignedLeft = Math.max(0, targetLeft - this.getAlignInset());

    if (!smooth) {
      this.stopProgrammaticScroll();
      this.setScrollPosition(alignedLeft);
      return;
    }

    this.programmaticScrollActive = true;
    this.programmaticTargetLeft = alignedLeft;
    this.watchProgrammaticScroll();

    this.root.scrollTo({
      left: alignedLeft,
      behavior: 'smooth',
    });
  }

  snapToNearest() {
    if (!this.config.snap || !this.items.length) return;

    const targetSlide = this.getNearestSnapSlide();
    if (!targetSlide) return;

    this.scrollToLeft(this.getSlideLeft(targetSlide), true);
  }

  scrollToIndex(index, smooth = false) {
    if (!this.items.length || !this.step) return;

    const safeIndex = Math.max(0, Math.min(this.items.length - 1, index));
    const targetLeft = this.getPositionForRealIndex(safeIndex);
    this.scrollToLeft(targetLeft, smooth);
  }

  scrollToId(id, smooth = false) {
    const index = this.items.findIndex(item => this.config.getItemId(item) === String(id));
    if (index < 0) return;
    this.scrollToIndex(index, smooth);
  }

  updateActiveClasses() {
    this.getSlides().forEach(slide => {
      slide.classList.toggle('active', this.activeId !== null && slide.dataset.itemId === this.activeId);
    });
  }

  clearActive(notify = true) {
    this.activeId = null;
    this.updateActiveClasses();

    if (notify && typeof this.config.onActiveChange === 'function') {
      this.config.onActiveChange(null);
    }
  }

  setActiveById(id, scrollIntoView = true) {
    if (id === null || typeof id === 'undefined' || id === '') {
      this.clearActive(true);
      return;
    }

    this.activeId = String(id);
    this.updateActiveClasses();

    if (scrollIntoView) {
      this.scrollToId(this.activeId, true);
    }

    if (typeof this.config.onActiveChange === 'function') {
      const activeItem = this.items.find(
        item => this.config.getItemId(item) === this.activeId
      ) || null;
      this.config.onActiveChange(activeItem);
    }
  }

  syncActive(id) {
    if (id === null || typeof id === 'undefined' || id === '') {
      this.clearActive(false);
      return;
    }

    this.setActiveById(id, false);
  }

  // scroll 事件主處理
  handleScroll() {
    if (!this.isOpen) return;

    this.lastKnownScrollLeft = this.root.scrollLeft;

    if (this.drag.active) return;
    if (this.programmaticScrollActive) return;
    if (this.inertiaActive) return;

    // 手機原生 loop 模式：
    // - 觸控滑動進行中，不要每次都立刻 normalize
    // - 靠近硬邊界時才立即修正
    // - 手指放開後再立刻修正一次
    if (this.isNativeMobileLoopMode()) {
      const maxScrollLeft = Math.max(0, this.root.scrollWidth - this.root.clientWidth);
      const edgeThreshold = Math.max(this.step, 1);
      const nearHardStart = this.root.scrollLeft <= edgeThreshold;
      const nearHardEnd = this.root.scrollLeft >= (maxScrollLeft - edgeThreshold);

      if (nearHardStart || nearHardEnd || !this.touch.active) {
        this.clearNativeLoopNormalizeTimer();
        this.normalizeLoopPosition();
      } else {
        this.scheduleNativeLoopNormalize(40);
      }
      return;
    }

    this.normalizeLoopPosition();
  }

  handleWheel(event) {
    if (!this.config.wheelEnabled) return;
    if (this.config.wheelDesktopOnly && this.isMobile()) return;
    if (this.root.scrollWidth <= this.root.clientWidth) return;

    this.stopProgrammaticScroll();
    this.clearSnapTimer();

    if (this.inertiaActive && this.inertiaMode !== 'wheel') {
      this.stopInertiaScroll();
    }

    event.preventDefault();

    const now = event.timeStamp || performance.now();
    const dt = this.wheel.lastTime ? Math.max(1, now - this.wheel.lastTime) : 16;
    const immediateDelta = event.deltaY * 0.22;
    const wheelVelocity = event.deltaY / dt;

    this.setScrollPosition(this.root.scrollLeft + immediateDelta);

    if (this.inertiaActive && this.inertiaMode === 'wheel') {
      this.wheel.velocity = this.wheel.velocity * 0.82 + wheelVelocity * 0.22;
    } else {
      this.wheel.velocity = wheelVelocity;
    }

    this.wheel.lastTime = now;
    this.startWheelInertiaScroll();
  }

  handlePointerDown(event) {
    if (!this.config.usePointerDrag) return;
    if (event.button !== 0) return;

    this.stopProgrammaticScroll();
    this.stopInertiaScroll();
    this.clearSnapTimer();
    this.drag.active = true;
    this.drag.moved = false;
    this.drag.startX = event.clientX;
    this.drag.startScrollLeft = this.root.scrollLeft;
    this.drag.lastX = event.clientX;
    this.drag.lastTime = event.timeStamp || performance.now();
    this.drag.velocity = 0;
    this.root.classList.add('is-dragging');
  }

  handlePointerMove(event) {
    if (!this.config.usePointerDrag) return;
    if (!this.drag.active) return;

    const dx = event.clientX - this.drag.startX;
    if (Math.abs(dx) > this.config.dragThreshold) {
      this.drag.moved = true;
    }

    const dt = Math.max(1, (event.timeStamp || performance.now()) - this.drag.lastTime);
    const pointerDelta = event.clientX - this.drag.lastX;
    const scrollVelocity = (-pointerDelta) / dt;
    this.drag.velocity = this.drag.velocity * 0.82 + scrollVelocity * 0.18; //累積速度
    this.drag.lastX = event.clientX;
    this.drag.lastTime = event.timeStamp || performance.now();

    this.setScrollPosition(this.drag.startScrollLeft - dx, true);
  }

  handlePointerUp() {
    if (!this.config.usePointerDrag) return;
    if (!this.drag.active) return;

    this.drag.active = false;
    this.root.classList.remove('is-dragging');

    if (this.drag.moved) {
      this.startInertiaScroll();
    } else {
      this.drag.velocity = 0;
      this.normalizeLoopPosition();
      this.queueSnap(40);
    }

    requestAnimationFrame(() => {
      this.drag.moved = false;
    });
  }

  handleTouchStart() {
    if (!this.isNativeMobileLoopMode()) return;
    this.touch.active = true;
    this.clearNativeLoopNormalizeTimer();
  }

  handleTouchEnd() {
    if (!this.isNativeMobileLoopMode()) return;
    this.touch.active = false;
    this.scheduleNativeLoopNormalize(0);
  }

  handleResize() {
    if (!this.isOpen) return;

    const currentActiveId = this.activeId;
    const currentScrollLeft = this.root.scrollLeft;
    this.lastObservedRootWidth = this.getLayoutWidth();
    this.applyLayout(true);

    if (this.usesNativeScrollerMode()) {
      this.root.scrollLeft = Math.max(0, currentScrollLeft);
      this.lastKnownScrollLeft = this.root.scrollLeft;
      return;
    }

    if (currentActiveId) {
      this.scrollToId(currentActiveId, false);
    } else {
      this.resetPosition(false);
    }
  }

  destroy() {
    this.clearSnapTimer();
    this.clearNativeLoopNormalizeTimer();
    this.stopProgrammaticScroll();
    this.stopInertiaScroll();
    cancelAnimationFrame(this.openRafId);
    this.openRafId = 0;
    this.stopObserveRoot();

    this.root.removeEventListener('scroll', this.boundScroll);
    this.root.removeEventListener('wheel', this.boundWheel);
    this.root.removeEventListener('touchstart', this.boundTouchStart);
    this.root.removeEventListener('touchend', this.boundTouchEnd);
    this.root.removeEventListener('touchcancel', this.boundTouchEnd);

    if (this.config.usePointerDrag) {
      this.root.removeEventListener('pointerdown', this.boundPointerDown);
      window.removeEventListener('pointermove', this.boundPointerMove);
      window.removeEventListener('pointerup', this.boundPointerUp);
    }

    if (this.config.useWindowResize) {
      window.removeEventListener('resize', this.boundResize);
    }
  }
}
