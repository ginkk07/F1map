export class RaceCarousel {
  constructor(options = {}) {
    const defaults = {
      root: null,
      track: '.race-list-track',
      breakpoint: 768,
      visibleCount: { desktop: 4, mobile: 3 },
      gap: { desktop: 8, mobile: 5 },
      alignInset: 0,
      loop: true,
      snap: true,
      wheelEnabled: true,
      wheelDesktopOnly: true,
      dragThreshold: 6,
      usePointerDrag: true,
      observeResize: true,
      useWindowResize: true,
      clickSetsActive: true,
      clickScrollIntoView: true,
      fireCardClick: true,
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

    this.root = this.resolveElement(this.config.root);
    if (!this.root) {
      throw new Error('RaceCarousel 初始化失敗：找不到 root');
    }

    this.track = this.root.querySelector(this.config.track);
    if (!this.track) {
      throw new Error('RaceCarousel 初始化失敗：找不到 track');
    }

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

    this.drag = {
      active: false,
      moved: false,
      startX: 0,
      startScrollLeft: 0,
      lastX: 0,
      lastTime: 0,
      velocity: 0,
    };

    this.wheel = {
      velocity: 0,
      lastTime: 0,
    };

    this.boundResize = this.handleResize.bind(this);
    this.boundScroll = this.handleScroll.bind(this);
    this.boundWheel = this.handleWheel.bind(this);
    this.boundPointerDown = this.handlePointerDown.bind(this);
    this.boundPointerMove = this.handlePointerMove.bind(this);
    this.boundPointerUp = this.handlePointerUp.bind(this);

    this.root.addEventListener('scroll', this.boundScroll, { passive: true });
    this.root.addEventListener('wheel', this.boundWheel, { passive: false });

    if (this.config.usePointerDrag) {
      this.root.addEventListener('pointerdown', this.boundPointerDown);
      window.addEventListener('pointermove', this.boundPointerMove);
      window.addEventListener('pointerup', this.boundPointerUp);
    }

    if (this.config.useWindowResize) {
      window.addEventListener('resize', this.boundResize);
    }
  }

  resolveElement(target) {
    if (!target) return null;
    if (target instanceof Element) return target;
    return document.querySelector(target);
  }

  isMobile() {
    return window.innerWidth <= this.config.breakpoint;
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

  getAlignInset() {
    return Math.max(0, Number(this.config.alignInset) || 0);
  }

  usesNativeScrollerMode() {
    return !this.config.loop && !this.config.snap && !this.config.usePointerDrag;
  }

  getSlides() {
    return Array.from(this.track.querySelectorAll('[data-carousel-slide="1"]'));
  }

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

  getLoopCloneCount() {
    if (!this.config.loop || this.items.length <= 1) return 0;
    return Math.min(this.getVisibleCount() + 1, this.items.length);
  }

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
    const totalGapWidth = gap * (visibleCount - 1);
    const availableWidth = Math.max(0, layoutWidth - totalGapWidth);

    this.slideWidth = Math.max(1, Math.floor(availableWidth / visibleCount));
    this.step = this.slideWidth + gap;
    this.lastAppliedLayoutSignature = layoutSignature;
    this.lastAppliedRootWidth = rootWidth;

    this.track.style.display = 'flex';
    this.track.style.gap = `${gap}px`;
    this.track.style.width = 'max-content';
    this.track.style.minWidth = 'max-content';
    this.track.style.boxSizing = 'border-box';
    this.track.style.paddingLeft = '0px';
    this.track.style.paddingRight = '0px';

    this.getSlides().forEach(slide => {
      slide.style.flex = `0 0 ${this.slideWidth}px`;
      slide.style.width = `${this.slideWidth}px`;
      slide.style.minWidth = `${this.slideWidth}px`;
      slide.style.maxWidth = `${this.slideWidth}px`;
      slide.style.boxSizing = 'border-box';
    });

    return true;
  }

  setScrollPosition(nextLeft, syncDragAnchor = false) {
    if (!Number.isFinite(nextLeft)) return 0;

    this.root.scrollLeft = nextLeft;
    this.lastKnownScrollLeft = this.root.scrollLeft;
    return this.normalizeLoopPosition(syncDragAnchor);
  }

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

      const friction = Math.pow(0.92, dt / 16.667);
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

      const friction = Math.pow(0.94, dt / 16.667);
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
    this.openSequence += 1;
    this.clearSnapTimer();
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

  handleScroll() {
    if (!this.isOpen) return;
    this.lastKnownScrollLeft = this.root.scrollLeft;
    if (this.drag.active) return;
    if (this.programmaticScrollActive) return;
    if (this.inertiaActive) return;
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
    const immediateDelta = event.deltaY * 0.35;
    const wheelVelocity = event.deltaY / dt;

    this.setScrollPosition(this.root.scrollLeft + immediateDelta);

    if (this.inertiaActive && this.inertiaMode === 'wheel') {
      this.wheel.velocity = this.wheel.velocity * 0.75 + wheelVelocity * 0.45;
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
    this.drag.velocity = this.drag.velocity * 0.75 + scrollVelocity * 0.25;
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
    this.stopProgrammaticScroll();
    this.stopInertiaScroll();
    cancelAnimationFrame(this.openRafId);
    this.openRafId = 0;
    this.stopObserveRoot();
    this.root.removeEventListener('scroll', this.boundScroll);
    this.root.removeEventListener('wheel', this.boundWheel);

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
