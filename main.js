import { RaceCarousel } from 'race-carousel-module.js';

(() => {
  'use strict';

  const CONFIG = {
    zoomLevel: 5,
    mapSvgPath: 'worldmap.svg',
    fogImagePath: './img/Smoke-Element.png',
    desktopBreakpoint: 768,
    desktopFocusOffsetX: 200,
    desktopFocusOffsetY: 15,
    desktopScale: 3,
    desktopRotateX: 50,
    mobileMapScale: 2.8,
    mobileFocusOffsetY: 10,
    listVisibleCount: {
      desktop: 4,
      mobile: 3,
    },
    listGap: {
      desktop: 8,
      mobile: 5,
    },
    scheduleLayoutMaxChecks: 24,
    scheduleLayoutStableFrames: 2,
    mobileScheduleDelayMs: 2000,
    mobileScrollSyncDelayMs: 180,
  };

  const state = {
    pins: [],
    activePin: null,
    carousel: null,
    carouselModeKey: '',
    scheduleRevealToken: 0,
    scheduleRevealRafId: 0,
    mobileScheduleTimer: 0,
    mobileScrollSyncTimer: 0,
    mobileActiveSyncRafId: 0,
    mobilePreviewId: '',
    mobileScheduleStarted: false,
    mapLoaded: false,
    mobileDetailBtn: null,
    modeKey: '',
  };

  const dom = {
    mapWrapper: document.getElementById('mapWrapper'),
    mapContainer: document.querySelector('.map-container'),
    baseCanvas: document.getElementById('baseMapCanvas'),
    partCanvas: document.getElementById('particleCanvas'),
    fogCanvas: document.getElementById('fogCanvas'),
    bottomExpandMenu: document.getElementById('bottomExpandMenu'),
    expandRaceList: document.getElementById('expandRaceList'),
    expandToggleBtn: document.getElementById('expandToggleBtn'),
    sidePanel: document.getElementById('sidePanel'),
    panelClose: document.getElementById('panelClose'),
    panelTitle: document.getElementById('panelTitle'),
    panelDate: document.getElementById('panelDate'),
    panelDesc: document.getElementById('panelDesc'),
    panelImg: document.getElementById('panelImg'),
    panelBtn: document.querySelector('.panel-btn'),
  };

  const ctx = {
    base: dom.baseCanvas?.getContext('2d') ?? null,
    particle: dom.partCanvas?.getContext('2d') ?? null,
    fog: dom.fogCanvas?.getContext('2d') ?? null,
  };

  const raceData = Array.isArray(window.f1Calendar2026)
    ? window.f1Calendar2026
    : (typeof f1Calendar2026 !== 'undefined' && Array.isArray(f1Calendar2026)
      ? f1Calendar2026
      : null);

  function isMobileView() {
    return window.innerWidth <= CONFIG.desktopBreakpoint;
  }

  function getModeKey() {
    return isMobileView() ? 'mobile' : 'desktop';
  }

  function getPinByRaceId(raceId) {
    return state.pins.find(item => item.dataset.id === String(raceId)) || null;
  }

  function init() {
    if (!validateRequiredDom()) return;

    state.modeKey = getModeKey();

    setupMapCanvas();
    buildRacePins();
    setupCarousel(state.modeKey);
    createMobileDetailButton();
    applyResponsiveMapInteraction();
    applyResponsiveSidePanelState();
    bindEvents();
    initFog();

    if (state.modeKey === 'mobile') {
      mobileController.prepareInitialView();
    } else {
      desktopController.prepareInitialView();
    }

    loadAndDrawMap().finally(() => {
      state.mapLoaded = true;

      if (state.modeKey === 'mobile') {
        mobileController.handleAfterMapLoad();
      } else {
        desktopController.handleAfterMapLoad();
      }
    });
  }

  function validateRequiredDom() {
    const required = [
      dom.mapWrapper,
      dom.mapContainer,
      dom.baseCanvas,
      dom.partCanvas,
      dom.fogCanvas,
      dom.bottomExpandMenu,
      dom.expandRaceList,
      dom.expandToggleBtn,
      dom.sidePanel,
      dom.panelClose,
      dom.panelTitle,
      dom.panelDate,
      dom.panelDesc,
      dom.panelImg,
      dom.panelBtn,
      ctx.base,
      ctx.particle,
      ctx.fog,
    ];

    if (!required.every(Boolean)) {
      console.error('初始化失敗：缺少必要 DOM 或 Canvas');
      return false;
    }

    if (!Array.isArray(raceData)) {
      console.error('初始化失敗：找不到賽事資料 f1Calendar2026');
      return false;
    }

    return true;
  }

  function setupMapCanvas() {
    const width = 1920 * CONFIG.zoomLevel;
    const height = 1080 * CONFIG.zoomLevel;
    dom.baseCanvas.width = width;
    dom.baseCanvas.height = height;
    dom.partCanvas.width = width;
    dom.partCanvas.height = height;
  }

  async function loadAndDrawMap() {
    try {
      const originalMap = await loadImage(CONFIG.mapSvgPath);
      drawBaseMap(originalMap, dom.baseCanvas.width, dom.baseCanvas.height);

      try {
        const maskMap = await loadWhiteMaskSvg(CONFIG.mapSvgPath);
        drawParticleMap(maskMap, dom.partCanvas.width, dom.partCanvas.height);
      } catch (maskError) {
        console.warn('粒子遮罩載入失敗，已略過粒子效果：', maskError);
      }
    } catch (error) {
      console.error('地圖載入失敗:', error);
    }
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  async function loadWhiteMaskSvg(src) {
    const response = await fetch(src);
    if (!response.ok) {
      throw new Error(`SVG 讀取失敗：${response.status} ${response.statusText}`);
    }

    const svgText = await response.text();
    const styleTag = '<style>path { fill: #ffffff !important; stroke: none !important; }</style>';
    const modifiedSvg = svgText.replace(/<svg[^>]*>/, match => `${match}${styleTag}`);

    const blob = new Blob([modifiedSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    try {
      return await loadImage(url);
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  function drawBaseMap(originalMap, width, height) {
    ctx.base.clearRect(0, 0, width, height);
    ctx.base.shadowColor = '#00ffff';
    ctx.base.shadowBlur = 5 * CONFIG.zoomLevel;
    ctx.base.drawImage(originalMap, 0, 0, width, height);
    ctx.base.shadowColor = 'rgba(0, 210, 255, 0.8)';
    ctx.base.shadowBlur = 15 * CONFIG.zoomLevel;
    ctx.base.drawImage(originalMap, 0, 0, width, height);
    ctx.base.shadowBlur = 0;
  }

  function drawParticleMap(maskMap, width, height) {
    ctx.particle.clearRect(0, 0, width, height);

    const edgeMaskCanvas = document.createElement('canvas');
    edgeMaskCanvas.width = width;
    edgeMaskCanvas.height = height;
    const edgeCtx = edgeMaskCanvas.getContext('2d');

    edgeCtx.drawImage(maskMap, 0, 0, width, height);
    edgeCtx.globalCompositeOperation = 'destination-out';
    edgeCtx.filter = `blur(${20 * CONFIG.zoomLevel}px)`;
    edgeCtx.globalAlpha = 0.88;
    edgeCtx.drawImage(maskMap, 0, 0, width, height);

    const patternCanvas = document.createElement('canvas');
    const dotSpacing = 8 * (CONFIG.zoomLevel / 2);
    patternCanvas.width = dotSpacing;
    patternCanvas.height = dotSpacing;

    const patternCtx = patternCanvas.getContext('2d');
    patternCtx.fillStyle = 'rgba(0, 210, 255, 0.6)';
    patternCtx.beginPath();
    patternCtx.arc(dotSpacing / 2, dotSpacing / 2, 3 * (CONFIG.zoomLevel / 3), 0, Math.PI * 2);
    patternCtx.fill();

    ctx.particle.fillStyle = ctx.particle.createPattern(patternCanvas, 'repeat');
    ctx.particle.fillRect(0, 0, width, height);

    ctx.particle.globalCompositeOperation = 'destination-in';
    ctx.particle.drawImage(edgeMaskCanvas, 0, 0, width, height);
    ctx.particle.globalCompositeOperation = 'source-over';
  }

  function buildRacePins() {
    raceData.forEach(race => {
      const pin = createRacePin(race);
      dom.mapWrapper.appendChild(pin);
      state.pins.push(pin);
    });
  }

  function createRacePin(race) {
    const pin = document.createElement('div');
    pin.className = 'race-pin';
    pin.dataset.id = String(race.id);
    pin.dataset.title = race.title || '';
    pin.dataset.date = race.date || '';
    pin.dataset.desc = race.desc || '';
    pin.dataset.img = race.img || '';
    pin.dataset.link = race.link || '#';
    pin.style.top = `${race.top}%`;
    pin.style.left = `${race.left}%`;

    pin.innerHTML = `
      <div class="pin-radar"></div>
      <div class="pin-core"></div>
      <div class="pin-label">${race.country || ''}</div>
    `;

    pin.addEventListener('click', event => {
      if (isMobileView()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      event.stopPropagation();
      desktopController.handlePinClick(pin);
    });

    return pin;
  }

  function getFocusConfig(modeKey) {
    if (modeKey === 'desktop') {
      return {
        offsetX: CONFIG.desktopFocusOffsetX,
        offsetY: CONFIG.desktopFocusOffsetY,
        scale: CONFIG.desktopScale,
        rotateX: CONFIG.desktopRotateX,
      };
    }

    return {
      offsetX: 0,
      offsetY: CONFIG.mobileFocusOffsetY,
      scale: CONFIG.mobileMapScale,
      rotateX: 0,
    };
  }

  function zoomToRace(pin, modeKey) {
    const top = parseFloat(pin.style.top);
    const left = parseFloat(pin.style.left);
    const moveX = 50 - left;
    const moveY = 50 - top + getFocusConfig(modeKey).offsetY;
    const focus = getFocusConfig(modeKey);

    dom.mapWrapper.style.transformOrigin = `${left}% ${top}%`;
    dom.mapWrapper.style.transform = `
      translate(calc(${moveX}% - ${focus.offsetX}px), ${moveY}%)
      scale(${focus.scale})
      rotateX(${focus.rotateX}deg)
    `;

    if (modeKey === 'mobile') {
      resetPinFacing();
    }
  }

  function createCarouselConfig(modeKey) {
    const isMobileMode = modeKey === 'mobile';

    return {
      root: dom.expandRaceList,
      track: '.race-list-track',
      visibleCount: CONFIG.listVisibleCount,
      gap: CONFIG.listGap,
      breakpoint: CONFIG.desktopBreakpoint,
      loop: !isMobileMode,
      snap: !isMobileMode,
      wheelEnabled: !isMobileMode,
      wheelDesktopOnly: !isMobileMode,
      usePointerDrag: !isMobileMode,
      observeResize: !isMobileMode,
      useWindowResize: !isMobileMode,
      clickSetsActive: !isMobileMode,
      clickScrollIntoView: !isMobileMode,
      fireCardClick: !isMobileMode,
      cardClassName: 'race-card simplified loop-card',
      cardRenderer: race => `
        <div class="race-card-bg" style="background-image: url('${race.trackMap || ''}')"></div>
        <div class="race-card-info">
          <div class="race-card-title">${race.title || ''}</div>
        </div>
      `,
      getItemId: race => String(race.id),
      onCardClick: isMobileMode
        ? null
        : race => {
            desktopController.handleCarouselCardClick(race);
          },
    };
  }

  function setupCarousel(modeKey = state.modeKey) {
    const activeId = state.activePin?.dataset?.id || '';

    if (state.carousel) {
      state.carousel.destroy();
      state.carousel = null;
    }

    state.carouselModeKey = modeKey;
    state.carousel = new RaceCarousel(createCarouselConfig(modeKey));
    state.carousel.build(raceData);

    if (activeId) {
      state.carousel.setActiveById(activeId, false);
    }

    applyResponsiveCarouselSnap();
    resetScheduleVisualState();
  }

  function setActivePin(pin) {
    state.activePin = pin;
    updatePinStates(pin);
    updateMobileDetailButton();
  }

  function clearActiveRace() {
    state.activePin = null;
    state.mobilePreviewId = '';
    state.pins.forEach(pin => pin.classList.remove('active', 'dimmed'));
    state.carousel?.clearActive(false);
    updateMobileDetailButton();
  }

  function updatePinStates(activePin) {
    state.pins.forEach(pin => {
      pin.classList.toggle('active', pin === activePin);
      pin.classList.toggle('dimmed', pin !== activePin);
    });
  }

  function resetMapTransform() {
    dom.mapWrapper.style.transform = 'translate(0,0) scale(1) rotateX(0deg)';
  }

  function populateSidePanel(pin) {
    dom.panelTitle.textContent = pin.dataset.title || '';
    dom.panelDate.textContent = pin.dataset.date || '';
    dom.panelDesc.textContent = pin.dataset.desc || '';
    dom.panelImg.style.backgroundImage = `url('${pin.dataset.img || ''}')`;

    if (pin.dataset.link && pin.dataset.link !== '#') {
      dom.panelBtn.style.display = 'flex';
      dom.panelBtn.onclick = () => window.open(pin.dataset.link, '_blank');
    } else {
      dom.panelBtn.style.display = 'none';
      dom.panelBtn.onclick = null;
    }
  }

  function openSidePanel() {
    dom.sidePanel.classList.add('active');
  }

  function closeSidePanel() {
    dom.sidePanel.classList.remove('active');
  }

  function closeDesktopPanelAndResetMap() {
    closeSidePanel();
    resetMapTransform();
    clearActiveRace();
  }

  function resetPinFacing() {
    state.pins.forEach(pin => {
      const core = pin.querySelector('.pin-core');
      const label = pin.querySelector('.pin-label');
      if (core) core.style.transform = 'rotateX(0deg)';
      if (label) label.style.transform = 'translate(-50%,0) rotateX(0deg)';
    });
  }

  function createMobileDetailButton() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Open race information');
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
        <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"></circle>
        <line x1="16" y1="16" x2="21" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>
      </svg>
    `;

    Object.assign(btn.style, {
      position: 'absolute',
      right: '18px',
      top: '50%',
      transform: 'translateY(-50%)',
      width: '54px',
      height: '54px',
      borderRadius: '999px',
      border: '1px solid rgba(255,255,255,0.15)',
      background: 'rgba(255,255,255,0.28)',
      color: '#111',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '60',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
      cursor: 'pointer',
      padding: '0',
    });

    btn.addEventListener('click', event => {
      event.stopPropagation();
      openActiveRaceSidePanel();
    });

    state.mobileDetailBtn = btn;
    dom.mapContainer.appendChild(btn);
    updateMobileDetailButton();
  }

  function updateMobileDetailButton() {
    if (!state.mobileDetailBtn) return;

    const shouldShow = isMobileView() && !!state.activePin;

    state.mobileDetailBtn.style.display = shouldShow ? 'flex' : 'none';
  }

  function applyResponsiveSidePanelState() {
    dom.sidePanel.style.pointerEvents = '';
    dom.sidePanel.style.visibility = '';
    dom.sidePanel.style.opacity = '';
  }

  function applyResponsiveMapInteraction() {
    const disableMapHit = isMobileView();

    dom.mapWrapper.style.pointerEvents = disableMapHit ? 'none' : '';

    state.pins.forEach(pin => {
      pin.style.pointerEvents = disableMapHit ? 'none' : '';
      pin.style.touchAction = disableMapHit ? 'none' : '';
    });
  }

  function openActiveRaceSidePanel() {
    if (!state.activePin) return;
    populateSidePanel(state.activePin);
    openSidePanel();
  }

  function openActiveRaceDetailPage() {
    if (!state.activePin) return;
    const link = state.activePin.dataset.link || '';
    if (!link || link === '#') return;
    window.location.href = link;
  }

  function applyScheduleHiddenStyles() {
    dom.expandRaceList.style.visibility = 'hidden';
    dom.expandRaceList.style.opacity = '0';
    dom.expandRaceList.style.pointerEvents = 'none';
  }

  function clearScheduleInlineStyles() {
    dom.expandRaceList.style.visibility = '';
    dom.expandRaceList.style.opacity = '';
    dom.expandRaceList.style.pointerEvents = '';
  }

  function resetScheduleVisualState() {
    dom.expandRaceList.classList.remove('is-ready', 'is-animate');
    applyScheduleHiddenStyles();
  }

  function primeCarouselOpenState() {
    if (state.activePin) {
      state.carousel?.setActiveById(state.activePin.dataset.id, false);
    } else {
      state.carousel?.clearActive(false);
    }
  }

  function beginScheduleRevealCycle() {
    state.scheduleRevealToken += 1;
    cancelAnimationFrame(state.scheduleRevealRafId);
    state.scheduleRevealRafId = 0;
    clearTimeout(state.mobileScheduleTimer);
    state.mobileScheduleTimer = 0;
    clearTimeout(state.mobileScrollSyncTimer);
    state.mobileScrollSyncTimer = 0;
    cancelAnimationFrame(state.mobileActiveSyncRafId);
    state.mobileActiveSyncRafId = 0;
    state.mobilePreviewId = '';
    return state.scheduleRevealToken;
  }

  function getScheduleMetrics() {
    const rootWidth = Math.round(dom.expandRaceList.getBoundingClientRect().width || 0);
    const clientWidth = Math.round(dom.expandRaceList.clientWidth || 0);
    const scrollWidth = Math.round(dom.expandRaceList.scrollWidth || 0);
    const firstCard = dom.expandRaceList.querySelector('.race-card');
    const cardWidth = Math.round(firstCard?.getBoundingClientRect().width || 0);

    return {
      rootWidth,
      clientWidth,
      scrollWidth,
      cardWidth,
    };
  }

  function revealSchedule() {
    clearScheduleInlineStyles();
    dom.expandRaceList.classList.add('is-ready');

    requestAnimationFrame(() => {
      if (!dom.bottomExpandMenu.classList.contains('open')) return;
      dom.expandRaceList.classList.add('is-animate');

      if (state.modeKey === 'mobile') {
        mobileController.afterScheduleReveal();
      } else {
        desktopController.afterScheduleReveal();
      }
    });
  }

  function waitForScheduleLayout(token, attempt = 0, lastSignature = '', stableCount = 0) {
    if (token !== state.scheduleRevealToken) return;
    if (!dom.bottomExpandMenu.classList.contains('open')) return;

    const { rootWidth, clientWidth, scrollWidth, cardWidth } = getScheduleMetrics();
    const ready = rootWidth > 0 && clientWidth > 0 && scrollWidth > 0 && cardWidth > 0;
    const signature = `${rootWidth}:${clientWidth}:${scrollWidth}:${cardWidth}`;

    let nextStableCount = 0;
    if (ready && signature === lastSignature) {
      nextStableCount = stableCount + 1;
    }

    if (ready && nextStableCount >= CONFIG.scheduleLayoutStableFrames) {
      state.scheduleRevealRafId = 0;
      revealSchedule();
      return;
    }

    if (attempt >= CONFIG.scheduleLayoutMaxChecks) {
      state.scheduleRevealRafId = 0;
      if (ready) revealSchedule();
      return;
    }

    state.scheduleRevealRafId = requestAnimationFrame(() => {
      waitForScheduleLayout(token, attempt + 1, signature, ready ? nextStableCount : 0);
    });
  }

  function queueScheduleReveal(token = state.scheduleRevealToken) {
    cancelAnimationFrame(state.scheduleRevealRafId);
    state.scheduleRevealRafId = requestAnimationFrame(() => {
      waitForScheduleLayout(token);
    });
  }

  function openScheduleInternal() {
    const token = beginScheduleRevealCycle();
    resetScheduleVisualState();
    dom.bottomExpandMenu.classList.add('open');
    primeCarouselOpenState();

    Promise.resolve(state.carousel?.open()).then(opened => {
      if (token !== state.scheduleRevealToken) return;
      if (!dom.bottomExpandMenu.classList.contains('open')) return;
      if (opened === false) return;
      queueScheduleReveal(token);
    });
  }

  function closeScheduleInternal() {
    beginScheduleRevealCycle();
    resetScheduleVisualState();
    dom.bottomExpandMenu.classList.remove('open');
    state.carousel?.close();
    clearScheduleInlineStyles();
  }

  function applyResponsiveCarouselSnap() {
    const cards = dom.expandRaceList.querySelectorAll('.race-card');

    if (isMobileView()) {
      dom.expandRaceList.style.scrollSnapType = 'x mandatory';
      dom.expandRaceList.style.scrollPaddingLeft = '0px';
      dom.expandRaceList.style.scrollPaddingRight = '0px';
      dom.expandRaceList.style.webkitOverflowScrolling = 'touch';

      cards.forEach(card => {
        card.style.scrollSnapAlign = 'start';
        card.style.scrollSnapStop = 'always';
      });
      return;
    }

    dom.expandRaceList.style.scrollSnapType = '';
    dom.expandRaceList.style.scrollPaddingLeft = '';
    dom.expandRaceList.style.scrollPaddingRight = '';
    dom.expandRaceList.style.webkitOverflowScrolling = '';

    cards.forEach(card => {
      card.style.scrollSnapAlign = '';
      card.style.scrollSnapStop = '';
    });
  }

  const desktopController = {
    prepareInitialView() {
      closeSidePanel();
      applyResponsiveMapInteraction();
      applyResponsiveSidePanelState();
      updateMobileDetailButton();
    },

    handleAfterMapLoad() {},

    handlePinClick(pin) {
      this.activateRace(pin, { openDetails: true, syncCarousel: true });
    },

    handleCarouselCardClick(race) {
      const pin = getPinByRaceId(race.id);
      if (pin) {
        this.activateRace(pin, { openDetails: true, syncCarousel: false });
      }
    },

    activateRace(pin, options = {}) {
      const {
        openDetails = true,
        syncCarousel = true,
      } = options;

      setActivePin(pin);
      populateSidePanel(pin);
      zoomToRace(pin, 'desktop');

      if (openDetails) {
        openSidePanel();
      }

      if (!syncCarousel) return;

      const isOpen = dom.bottomExpandMenu.classList.contains('open');
      if (!isOpen) {
        openScheduleInternal();
        return;
      }

      state.carousel?.syncActive(pin.dataset.id);
    },

    handleScheduleToggle() {
      if (dom.bottomExpandMenu.classList.contains('open')) {
        closeScheduleInternal();
        return;
      }

      openScheduleInternal();
    },

    handleResize() {
      applyResponsiveCarouselSnap();
      applyResponsiveMapInteraction();
      applyResponsiveSidePanelState();
      updateMobileDetailButton();

      if (state.activePin) {
        zoomToRace(state.activePin, 'desktop');
      } else {
        resetMapTransform();
      }
    },

    afterScheduleReveal() {},
  };

  const mobileController = {
    prepareInitialView() {
      closeSidePanel();
      applyResponsiveMapInteraction();
      applyResponsiveSidePanelState();
      beginScheduleRevealCycle();
      resetScheduleVisualState();
      dom.bottomExpandMenu.classList.remove('open');
      state.carousel?.close();
      updateMobileDetailButton();
    },

    handleAfterMapLoad() {
      this.startScheduleAfterDelay();
    },

    handleResize() {
      closeSidePanel();
      applyResponsiveCarouselSnap();
      applyResponsiveMapInteraction();
      applyResponsiveSidePanelState();
      updateMobileDetailButton();

      if (state.carousel?.isOpen) {
        state.carousel.handleResize();
      }

      if (state.activePin) {
        zoomToRace(state.activePin, 'mobile');
      } else {
        resetMapTransform();
      }
    },

    afterScheduleReveal() {
      requestAnimationFrame(() => {
        this.previewCenterCard();
        this.scheduleCommit();
      });
    },

    activateRace(pin) {
      closeSidePanel();
      setActivePin(pin);
      zoomToRace(pin, 'mobile');
      state.carousel?.setActiveById(pin.dataset.id, false);
    },

    getCenterCard() {
      const cards = Array.from(dom.expandRaceList.querySelectorAll('.race-card[data-item-id][data-clone="body"]'));
      if (!cards.length) return null;

      const rootRect = dom.expandRaceList.getBoundingClientRect();
      const anchorX = rootRect.left + (rootRect.width / 2);

      return cards.reduce((nearest, card) => {
        if (!nearest) return card;

        const cardRect = card.getBoundingClientRect();
        const nearestRect = nearest.getBoundingClientRect();
        const cardCenter = cardRect.left + (cardRect.width / 2);
        const nearestCenter = nearestRect.left + (nearestRect.width / 2);
        const cardDiff = Math.abs(cardCenter - anchorX);
        const nearestDiff = Math.abs(nearestCenter - anchorX);
        return cardDiff < nearestDiff ? card : nearest;
      }, null);
    },

    previewCenterCard() {
      if (!isMobileView()) return '';
      if (!dom.bottomExpandMenu.classList.contains('open')) return '';

      const centerCard = this.getCenterCard();
      const centerId = centerCard?.dataset?.itemId || '';
      if (!centerId) return '';

      if (state.mobilePreviewId !== centerId) {
        state.mobilePreviewId = centerId;
        state.carousel?.setActiveById(centerId, false);
      }

      return centerId;
    },

    commitCenterCard() {
      if (!isMobileView()) return;
      if (!dom.bottomExpandMenu.classList.contains('open')) return;

      const centerId = this.previewCenterCard();
      if (!centerId) return;
      if (state.activePin && state.activePin.dataset.id === centerId) return;

      const pin = getPinByRaceId(centerId);
      if (!pin) return;
      this.activateRace(pin);
    },

    scheduleCommit() {
      clearTimeout(state.mobileScrollSyncTimer);
      state.mobileScrollSyncTimer = 0;

      if (!isMobileView()) return;

      state.mobileScrollSyncTimer = window.setTimeout(() => {
        if (!isMobileView()) return;
        if (!dom.bottomExpandMenu.classList.contains('open')) return;
        this.commitCenterCard();
      }, CONFIG.mobileScrollSyncDelayMs);
    },

    startScheduleAfterDelay() {
      if (!isMobileView()) return;
      if (!state.mapLoaded) return;
      if (state.mobileScheduleStarted) return;
      if (state.carousel?.isOpen) return;

      state.mobileScheduleStarted = true;
      beginScheduleRevealCycle();
      state.mobileScheduleTimer = window.setTimeout(() => {
        if (!isMobileView()) return;
        openScheduleInternal();
      }, CONFIG.mobileScheduleDelayMs);
    },
  };

  function handleModeTransition() {
    const nextModeKey = getModeKey();
    if (nextModeKey === state.modeKey) {
      if (nextModeKey === 'mobile') {
        mobileController.handleResize();
      } else {
        desktopController.handleResize();
      }
      return;
    }

    state.modeKey = nextModeKey;
    state.mobileScheduleStarted = false;
    beginScheduleRevealCycle();
    clearActiveRace();
    resetMapTransform();
    setupCarousel(nextModeKey);

    if (nextModeKey === 'mobile') {
      mobileController.prepareInitialView();
      mobileController.handleResize();
      if (state.mapLoaded) {
        mobileController.startScheduleAfterDelay();
      }
      return;
    }

    closeScheduleInternal();
    desktopController.prepareInitialView();
    desktopController.handleResize();
  }

  function bindEvents() {
    dom.mapContainer.addEventListener('click', () => {
      if (isMobileView()) return;
      closeDesktopPanelAndResetMap();
    });

    dom.panelClose.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();

      if (isMobileView()) {
        closeSidePanel();
        return;
      }

      closeDesktopPanelAndResetMap();
    });

    dom.sidePanel.addEventListener('click', event => event.stopPropagation());

    dom.expandToggleBtn.addEventListener('click', event => {
      if (isMobileView()) return;
      event.stopPropagation();
      desktopController.handleScheduleToggle();
    });

    dom.expandRaceList.addEventListener('scroll', () => {
      if (!isMobileView()) return;
      if (!dom.bottomExpandMenu.classList.contains('open')) return;
      mobileController.previewCenterCard();
      mobileController.scheduleCommit();
    }, { passive: true });

    window.addEventListener('resize', () => {
      resizeFogCanvas();
      handleModeTransition();
    });
  }

  function initFog() {
    resizeFogCanvas();

    const img = new Image();
    img.src = CONFIG.fogImagePath;

    img.onload = () => {
      const tinted = createTintedSmoke(img);
      const clouds = createFogClouds();
      animateFog(tinted, clouds);
    };
  }

  function resizeFogCanvas() {
    dom.fogCanvas.width = window.innerWidth;
    dom.fogCanvas.height = window.innerHeight * 0.45;
  }

  function createTintedSmoke(img) {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;

    const cctx = canvas.getContext('2d');
    cctx.drawImage(img, 0, 0);
    cctx.globalCompositeOperation = 'source-in';
    cctx.fillStyle = '#465b6a';
    cctx.fillRect(0, 0, canvas.width, canvas.height);

    return canvas;
  }

  function createFogClouds() {
    const clouds = [];

    for (let i = 0; i < 45; i += 1) {
      const size = Math.random() * 600 + 300;

      clouds.push({
        x: Math.random() * dom.fogCanvas.width,
        y: dom.fogCanvas.height - size * 0.4,
        vx: (Math.random() - 0.5) * 0.5,
        size,
        alpha: 0.1,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.001,
      });
    }

    return clouds;
  }

  function animateFog(img, clouds) {
    function loop() {
      ctx.fog.clearRect(0, 0, dom.fogCanvas.width, dom.fogCanvas.height);

      clouds.forEach(cloud => {
        cloud.x += cloud.vx;
        cloud.rotation += cloud.rotSpeed;

        ctx.fog.save();
        ctx.fog.translate(cloud.x, cloud.y);
        ctx.fog.rotate(cloud.rotation);
        ctx.fog.globalAlpha = cloud.alpha;
        ctx.fog.drawImage(img, -cloud.size / 2, -cloud.size / 2, cloud.size, cloud.size);
        ctx.fog.restore();
      });

      requestAnimationFrame(loop);
    }

    loop();
  }

  init();
})();
