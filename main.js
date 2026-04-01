import { RaceCarousel } from './race-carousel-module.js';
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
    listVisibleCount: {
      desktop: 4,
      mobile: 3,
    },
    listGap: {
      desktop: 8,
      mobile: 5,
    },
  };

  const state = {
    pins: [],
    activePin: null,
    carousel: null,
    scheduleRevealPending: false,
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

  function init() {
    if (!validateRequiredDom()) return;

    setupMapCanvas();
    buildRacePins();
    setupCarousel();
    bindEvents();
    loadAndDrawMap();
    initFog();
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
      event.stopPropagation();
      activateRace(pin);
    });

    return pin;
  }

  function setupCarousel() {
    state.carousel = new RaceCarousel({
      root: dom.expandRaceList,
      track: '.race-list-track',
      visibleCount: CONFIG.listVisibleCount,
      gap: CONFIG.listGap,
      breakpoint: CONFIG.desktopBreakpoint,
      loop: true,
      snap: true,
      wheelEnabled: true,
      wheelDesktopOnly: true,
      cardClassName: 'race-card simplified loop-card',
      cardRenderer: race => `
        <div class="race-card-bg" style="background-image: url('${race.trackMap || ''}')"></div>
        <div class="race-card-info">
          <div class="race-card-title">${race.title || ''}</div>
        </div>
      `,
      getItemId: race => String(race.id),
      onCardClick: race => {
        const pin = state.pins.find(item => item.dataset.id === String(race.id));
        if (pin) pin.click();
      },
    });

    state.carousel.build(raceData);
    dom.expandRaceList.classList.remove('is-ready', 'is-animate');
  }

  function activateRace(pin) {
    state.activePin = pin;
    updatePinStates(pin);
    focusMapOnPin(pin);
    populateSidePanel(pin);
    openSidePanel();

    const wasOpen = dom.bottomExpandMenu.classList.contains('open');
    openScheduleIfNeeded();

    if (wasOpen) {
      state.carousel?.syncActive(pin.dataset.id);
    }
  }

  function updatePinStates(activePin) {
    state.pins.forEach(pin => {
      pin.classList.toggle('active', pin === activePin);
      pin.classList.toggle('dimmed', pin !== activePin);
    });
  }

  function focusMapOnPin(pin) {
    if (window.innerWidth <= CONFIG.desktopBreakpoint) {
      resetPinFacing();
      return;
    }

    const top = parseFloat(pin.style.top);
    const left = parseFloat(pin.style.left);
    const moveX = 50 - left;
    const moveY = 50 - top + CONFIG.desktopFocusOffsetY;

    dom.mapWrapper.style.transformOrigin = `${left}% ${top}%`;
    dom.mapWrapper.style.transform = `
      translate(calc(${moveX}% - ${CONFIG.desktopFocusOffsetX}px), ${moveY}%)
      scale(${CONFIG.desktopScale})
      rotateX(${CONFIG.desktopRotateX}deg)
    `;
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

  function closePanelAndResetMap() {
    dom.sidePanel.classList.remove('active');
    dom.mapWrapper.style.transform = 'translate(0,0) scale(1) rotateX(0deg)';
    state.pins.forEach(pin => pin.classList.remove('active', 'dimmed'));
    state.activePin = null;
    state.carousel?.syncActive(null);
  }

  function resetPinFacing() {
    state.pins.forEach(pin => {
      const core = pin.querySelector('.pin-core');
      const label = pin.querySelector('.pin-label');
      if (core) core.style.transform = 'rotateX(0deg)';
      if (label) label.style.transform = 'translate(-50%,0) rotateX(0deg)';
    });
  }

  function resetScheduleVisualState() {
    dom.expandRaceList.classList.remove('is-ready', 'is-animate');
  }

  function finalizeScheduleOpen() {
    if (!dom.bottomExpandMenu.classList.contains('open')) return;
    if (!state.scheduleRevealPending) return;

    state.scheduleRevealPending = false;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        state.carousel?.refreshAfterOpen();

        if (state.activePin) {
          state.carousel?.syncActive(state.activePin.dataset.id);
        } else {
          state.carousel?.resetPosition(false);
        }

        dom.expandRaceList.classList.add('is-ready');

        requestAnimationFrame(() => {
          dom.expandRaceList.classList.add('is-animate');
        });
      });
    });
  }

  function openScheduleIfNeeded() {
    const wasOpen = dom.bottomExpandMenu.classList.contains('open');
    if (wasOpen) return;

    resetScheduleVisualState();
    state.scheduleRevealPending = true;
    dom.bottomExpandMenu.classList.add('open');
    state.carousel?.open();
  }

  function toggleSchedule() {
    const willOpen = !dom.bottomExpandMenu.classList.contains('open');
    dom.bottomExpandMenu.classList.toggle('open', willOpen);

    if (willOpen) {
      resetScheduleVisualState();
      state.scheduleRevealPending = true;
      state.carousel?.open();
    } else {
      state.scheduleRevealPending = false;
      resetScheduleVisualState();
      state.carousel?.close();
    }
  }

  function bindEvents() {
    dom.mapContainer.addEventListener('click', closePanelAndResetMap);
    dom.panelClose.addEventListener('click', closePanelAndResetMap);
    dom.sidePanel.addEventListener('click', event => event.stopPropagation());
    dom.expandToggleBtn.addEventListener('click', event => {
      event.stopPropagation();
      toggleSchedule();
    });

    dom.expandToggleBtn.addEventListener('transitionend', () => {
      finalizeScheduleOpen();
    });

    window.addEventListener('resize', () => {
      resizeFogCanvas();

      if (!state.activePin) return;

      if (window.innerWidth > CONFIG.desktopBreakpoint) {
        focusMapOnPin(state.activePin);
      } else {
        dom.mapWrapper.style.transform = 'none';
      }
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
