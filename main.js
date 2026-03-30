(() => {
    'use strict';

    /* =========================
    * 全域設定（可調參數集中）
    * ========================= */
    const CONFIG = {
      zoomLevel: 5,                 // 地圖放大倍率（影響 canvas 繪製解析度）
      mapSvgPath: 'worldmap.svg',   // 世界地圖 SVG 路徑
      fogImagePath: './img/Smoke-Element.png', // 煙霧貼圖

      // Desktop 視角控制
      desktopBreakpoint: 768,       // 小於此寬度視為手機
      desktopFocusOffsetX: 200,     // 聚焦時 X 偏移（避免被 panel 擋住）
      desktopFocusOffsetY: 15,      // 聚焦時 Y 偏移
      desktopScale: 3,              // 放大倍率
      desktopRotateX: 50,           // 3D 旋轉角度

      listVisibleCount: {
        desktop: 4,
        mobile: 3,
      },  //顯示數量
      listGap: {
        desktop: 8,
        mobile: 5,
      },  //間格

      dragResistance: 0.75, // 拖曳阻力 1 = 無阻力，越小越重
      wheelResistance: 0.75, // 滾輪阻力
    };

    /* =========================
    * 狀態管理（所有動態資料）
    * ========================= */
    const state = {
      pins: [],        // 所有地圖 pin
      activePin: null, // 目前選中的 pin

      slider: {
        cardWidth: 0,
        isAdjusting: false,
        isPointerDown: false,
        isDragging: false,
        dragStartX: 0,
        suppressClick: false,
        hasInitialPositioned: false,

        /**慣性**/
        velocity: 0,
        lastX: 0,
        lastTime: 0,
        inertiaId: null,

        wheelVelocity: 0,
        wheelInertiaId: null,
      },
    };

    /* =========================
    * DOM 快取（避免重複 query）
    * ========================= */
    const dom = {
      mapWrapper: document.getElementById('mapWrapper'),
      mapContainer: document.querySelector('.map-container'),

      baseCanvas: document.getElementById('baseMapCanvas'),
      partCanvas: document.getElementById('particleCanvas'),
      fogCanvas: document.getElementById('fogCanvas'),

      expandRaceList: document.getElementById('expandRaceList'),
      bottomExpandMenu: document.getElementById('bottomExpandMenu'),
      expandToggleBtn: document.getElementById('expandToggleBtn'),

      sidePanel: document.getElementById('sidePanel'),
      panelClose: document.getElementById('panelClose'),
      panelTitle: document.getElementById('panelTitle'),
      panelDate: document.getElementById('panelDate'),
      panelDesc: document.getElementById('panelDesc'),
      panelImg: document.getElementById('panelImg'),
      panelBtn: document.querySelector('.panel-btn'),
    };

    /* =========================
    * Canvas context
    * ========================= */
    const ctx = {
      base: dom.baseCanvas?.getContext('2d') ?? null,
      particle: dom.partCanvas?.getContext('2d') ?? null,
      fog: dom.fogCanvas?.getContext('2d') ?? null,
    };

    /*螢幕寬度抓取*/
    function handleInfiniteRaceScroll() {
      if (state.slider.isAdjusting) return;
      if (!state.slider.cardWidth) return;

      const segmentWidth = state.slider.cardWidth * raceData.length;
      const current = dom.expandRaceList.scrollLeft;

      const middleStart = segmentWidth;
      const middleEnd = segmentWidth * 2;

      // 滑到中段左邊，立刻搬回中段
      if (current < middleStart) {
        state.slider.isAdjusting = true;
        dom.expandRaceList.scrollLeft = current + segmentWidth;
        requestAnimationFrame(() => {
          state.slider.isAdjusting = false;
        });
        return;
      }

      // 滑到中段右邊，立刻搬回中段
      if (current >= middleEnd) {
        state.slider.isAdjusting = true;
        dom.expandRaceList.scrollLeft = current - segmentWidth;
        requestAnimationFrame(() => {
          state.slider.isAdjusting = false;
        });
      }
    }


    const raceData =
    Array.isArray(window.f1Calendar2026) ? window.f1Calendar2026 :
    (typeof f1Calendar2026 !== 'undefined' && Array.isArray(f1Calendar2026) ? f1Calendar2026 : null);

    /* =========================
    * 主初始化流程
    * ========================= */
    function init() {
      if (!validateRequiredDom()) return;

      setupMapCanvas();     // 設定 canvas 尺寸
      loadAndDrawMap();     // 載入並繪製地圖
      buildRacePinsAndCards(); // 建立所有賽事 pin + 卡片
      bindEvents();         // 綁定事件
      initFog();            // 初始化煙霧動畫
    }

    

    /* =========================
    * 檢查必要元素
    * ========================= */
    function validateRequiredDom() {
      const required = [
        dom.mapWrapper,
        dom.mapContainer,
        dom.baseCanvas,
        dom.partCanvas,
        dom.fogCanvas,
        dom.expandRaceList,
        dom.bottomExpandMenu,
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

      const isValid = required.every(Boolean);

      if (!isValid) {
        console.error('初始化失敗：缺少必要 DOM 或 Canvas');
      }

      if (!Array.isArray(raceData)) {
        console.error('初始化失敗：找不到賽事資料 f1Calendar2026');
        return false;
      }

      return isValid;
    }

    /* =========================
    * Canvas 設定
    * ========================= */
    function setupMapCanvas() {
      const width = 1920 * CONFIG.zoomLevel;
      const height = 1080 * CONFIG.zoomLevel;

      dom.baseCanvas.width = width;
      dom.baseCanvas.height = height;
      dom.partCanvas.width = width;
      dom.partCanvas.height = height;
    }

    /* =========================
    * 地圖載入
    * ========================= */
    async function loadAndDrawMap() {
      try {
        // 先畫基礎地圖
        const originalMap = await loadImage(CONFIG.mapSvgPath);
        drawBaseMap(originalMap, dom.baseCanvas.width, dom.baseCanvas.height);

        // 粒子遮罩失敗也不要讓整張圖掛掉
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

    /* 載入圖片 */
    function loadImage(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
    }

    /* 建立「白色遮罩 SVG」用於粒子效果 */
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

    /* 發光底圖 */
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

    /* 粒子地圖（點陣效果） */
    function drawParticleMap(maskMap, width, height) {
      ctx.particle.clearRect(0, 0, width, height);

      const edgeMaskCanvas = document.createElement('canvas');
      edgeMaskCanvas.width = width;
      edgeMaskCanvas.height = height;
      const edgeCtx = edgeMaskCanvas.getContext('2d');

      // 畫遮罩
      edgeCtx.drawImage(maskMap, 0, 0, width, height);

      // 製造邊緣 fade
      edgeCtx.globalCompositeOperation = 'destination-out';
      edgeCtx.filter = `blur(${20 * CONFIG.zoomLevel}px)`;
      edgeCtx.globalAlpha = 0.88;
      edgeCtx.drawImage(maskMap, 0, 0, width, height);

      // 建立點 pattern
      const patternCanvas = document.createElement('canvas');
      const dotSpacing = 8 * (CONFIG.zoomLevel / 2);
      patternCanvas.width = dotSpacing;
      patternCanvas.height = dotSpacing;

      const patternCtx = patternCanvas.getContext('2d');
      patternCtx.fillStyle = 'rgba(0, 210, 255, 0.6)';
      patternCtx.beginPath();
      patternCtx.arc(dotSpacing / 2, dotSpacing / 2, 3 * (CONFIG.zoomLevel / 3), 0, Math.PI * 2);
      patternCtx.fill();

      // 填滿
      ctx.particle.fillStyle = ctx.particle.createPattern(patternCanvas, 'repeat');
      ctx.particle.fillRect(0, 0, width, height);

      // 套遮罩
      ctx.particle.globalCompositeOperation = 'destination-in';
      ctx.particle.drawImage(edgeMaskCanvas, 0, 0, width, height);

      ctx.particle.globalCompositeOperation = 'source-over';
    }

    /* =========================
    * 建立 Pin / 卡片
    * ========================= */
    function buildRacePinsAndCards() {
      raceData.forEach(race => {
        const pin = createRacePin(race);
        dom.mapWrapper.appendChild(pin);
        state.pins.push(pin);
      });

      buildInfiniteRaceList();
    }

    function createRacePin(race) {
      const pin = document.createElement('div');
      pin.className = 'race-pin';

      // dataset 用來存資料（給 panel 用）
      pin.dataset.id = race.id;
      pin.dataset.title = race.title;
      pin.dataset.date = race.date;
      pin.dataset.desc = race.desc;
      pin.dataset.img = race.img;
      pin.dataset.link = race.link;

      pin.style.top = `${race.top}%`;
      pin.style.left = `${race.left}%`;

      pin.innerHTML = `
        <div class="pin-radar"></div>
        <div class="pin-core"></div>
        <div class="pin-label">${race.country}</div>
      `;

      // 點擊 pin
      pin.addEventListener('click', event => {
        event.stopPropagation();
        activateRace(pin);
      });

      return pin;
    }

    function createRaceCard(race, pin) {
      const card = document.createElement('div');
      card.className = 'race-card simplified';
      card.id = `card-${race.id}`;

      card.innerHTML = `
        <div class="race-card-bg" style="background-image: url('${race.trackMap}')"></div>
        <div class="race-card-info">
          <div class="race-card-title">${race.title}</div>
        </div>
      `;

      // 點卡片 = 點 pin
      card.addEventListener('click', () => pin.click());

      return card;
    }

    //左右滑動
    function bindRaceListWheelScroll() {
      dom.expandRaceList.addEventListener('wheel', event => {
        if (window.innerWidth <= CONFIG.desktopBreakpoint) return;

        const hasHorizontalRoom =
        dom.expandRaceList.scrollWidth > dom.expandRaceList.clientWidth;

        if (!hasHorizontalRoom) return;

        event.preventDefault();

        // 先把本次滾輪力量加進速度
        state.slider.wheelVelocity += event.deltaY * CONFIG.wheelResistance;

        // 限制最大速度，避免太暴衝
        const maxWheelSpeed = 40;
        if (state.slider.wheelVelocity > maxWheelSpeed) {
        state.slider.wheelVelocity = maxWheelSpeed;
        }
        if (state.slider.wheelVelocity < -maxWheelSpeed) {
        state.slider.wheelVelocity = -maxWheelSpeed;
        }

        startWheelInertiaScroll();
      }, { passive: false });
    }

    //綁定
    function bindRaceListDragScroll() {
      let startScrollLeft = 0;

      dom.expandRaceList.addEventListener('mousedown', event => {
        if (window.innerWidth <= CONFIG.desktopBreakpoint) return;

        cancelAnimationFrame(state.slider.inertiaId);
        state.slider.inertiaId = null;
        state.slider.velocity = 0;
        state.slider.lastX = event.pageX;
        state.slider.lastTime = performance.now();

        state.slider.isPointerDown = true;
        state.slider.isDragging = false;
        state.slider.dragStartX = event.pageX;
        state.slider.suppressClick = false;

        startScrollLeft = dom.expandRaceList.scrollLeft;
        dom.expandRaceList.classList.add('is-dragging');
      });

      window.addEventListener('mousemove', event => {
        if (!state.slider.isPointerDown) return;

        const rawDx = event.pageX - state.slider.dragStartX;
        const resistedDx = rawDx * CONFIG.dragResistance;

        // 超過閾值才算真的在拖曳
        if (Math.abs(rawDx) > 6) {
            state.slider.isDragging = true;
            state.slider.suppressClick = true;
        }

        const now = performance.now();
        const dt = now - state.slider.lastTime;

        if (dt > 0) {
            const moveDx = event.pageX - state.slider.lastX;
            state.slider.velocity = moveDx / dt;
        }

        state.slider.lastX = event.pageX;
        state.slider.lastTime = now;

        if (!state.slider.isDragging) return;

        dom.expandRaceList.scrollLeft = startScrollLeft - resistedDx;
        handleInfiniteRaceScroll();
      });

      window.addEventListener('mouseup', () => {
        if (!state.slider.isPointerDown) return;

        state.slider.isPointerDown = false;
        dom.expandRaceList.classList.remove('is-dragging');

        if (state.slider.isDragging) {
            startInertiaScroll();

            setTimeout(() => {
            state.slider.suppressClick = false;
            state.slider.isDragging = false;
            }, 0);
        } else {
            state.slider.suppressClick = false;
            state.slider.isDragging = false;
        }
      });

      dom.expandRaceList.addEventListener('mouseleave', () => {
        if (!state.slider.isPointerDown) return;

        state.slider.isPointerDown = false;
        dom.expandRaceList.classList.remove('is-dragging');

        setTimeout(() => {
          state.slider.suppressClick = false;
          state.slider.isDragging = false;
        }, 0);
      });
    }

    //滑鼠滑動慣性
    function startInertiaScroll() {
        cancelAnimationFrame(state.slider.inertiaId);

        let velocity = state.slider.velocity * 16;

        function step() {
            velocity *= 0.92;

            if (Math.abs(velocity) < 0.1) {
            state.slider.inertiaId = null;
            return;
            }

            dom.expandRaceList.scrollLeft -= velocity;
            handleInfiniteRaceScroll();

            state.slider.inertiaId = requestAnimationFrame(step);
        }

        state.slider.inertiaId = requestAnimationFrame(step);
    }

    //滾輪滑動慣性
    function startWheelInertiaScroll() {
      cancelAnimationFrame(state.slider.wheelInertiaId);
      function step() {
        state.slider.wheelVelocity *= 0.90;

        if (Math.abs(state.slider.wheelVelocity) < 0.1) {
        state.slider.wheelVelocity = 0;
        state.slider.wheelInertiaId = null;
        return;
        }

        dom.expandRaceList.scrollLeft += state.slider.wheelVelocity;
        handleInfiniteRaceScroll();

        state.slider.wheelInertiaId = requestAnimationFrame(step);
      }
      state.slider.wheelInertiaId = requestAnimationFrame(step);
    }
    /* =========================
    * 互動邏輯
    * ========================= */
    function activateRace(pin) {
      state.activePin = pin;

      updatePinStates(pin);
      focusMapOnPin(pin);
      populateSidePanel(pin);

      openSidePanel();
      openScheduleIfNeeded();
    }

    function updatePinStates(activePin) {
      state.pins.forEach(pin => {
        pin.classList.toggle('active', pin === activePin);
        pin.classList.toggle('dimmed', pin !== activePin);
      });

      document.querySelectorAll('.race-card.simplified').forEach(card => {
        const isActive = card.dataset.raceId === activePin.dataset.id;
        card.classList.toggle('active', isActive);
      });
    }

    /* 地圖聚焦 */
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

    /* Panel 填資料 */
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

      resetPinStates();
      state.activePin = null;
    }

    function resetPinStates() {
      state.pins.forEach(pin => pin.classList.remove('active', 'dimmed'));
      document.querySelectorAll('.race-card').forEach(card => card.classList.remove('active'));
    }

    function resetPinFacing() {
      state.pins.forEach(pin => {
        const core = pin.querySelector('.pin-core');
        const label = pin.querySelector('.pin-label');

        if (core) core.style.transform = 'rotateX(0deg)';
        if (label) label.style.transform = 'translate(-50%,0) rotateX(0deg)';
      });
    }

    function openScheduleIfNeeded() {
      const wasOpen = dom.bottomExpandMenu.classList.contains('open');
      dom.bottomExpandMenu.classList.add('open');

      if (!wasOpen) {
        requestAnimationFrame(() => {
          updateRaceListCardWidth();

          if (!state.slider.hasInitialPositioned) {
            resetInfiniteRacePosition();
            state.slider.hasInitialPositioned = true;
          }
        });
      }
    }

    function scheduleRaceListLayoutReset() {
      requestAnimationFrame(() => {
        const prevRatio = state.slider.cardWidth
          ? dom.expandRaceList.scrollLeft / state.slider.cardWidth
          : 0;

        updateRaceListCardWidth();

        if (state.slider.cardWidth) {
          dom.expandRaceList.scrollLeft = prevRatio * state.slider.cardWidth;
        }
      });
    }

    /* =========================
    * 事件
    * ========================= */
    function bindEvents() {
      dom.mapContainer.addEventListener('click', closePanelAndResetMap);
      dom.panelClose.addEventListener('click', closePanelAndResetMap);

      dom.sidePanel.addEventListener('click', e => e.stopPropagation());

      dom.expandToggleBtn.addEventListener('click', e => {
        e.stopPropagation();

        const willOpen = !dom.bottomExpandMenu.classList.contains('open');

        if (willOpen) {
          dom.bottomExpandMenu.classList.add('open');

          requestAnimationFrame(() => {
            updateRaceListCardWidth();

            if (!state.slider.hasInitialPositioned) {
              resetInfiniteRacePosition();
              state.slider.hasInitialPositioned = true;
            }
          });

          return;
        }

        dom.bottomExpandMenu.classList.remove('open');
      });

      window.addEventListener('resize', handleResize);
      bindRaceListWheelScroll();
      bindRaceListDragScroll();
    }

    function handleResize() {
      resizeFogCanvas();

      if (dom.bottomExpandMenu.classList.contains('open')) {
        scheduleRaceListLayoutReset();
      }

      if (!state.activePin) return;

      if (window.innerWidth > CONFIG.desktopBreakpoint) {
        focusMapOnPin(state.activePin);
      } else {
        dom.mapWrapper.style.transform = 'none';
      }
    }

    /* =========================
    * 煙霧效果
    * ========================= */
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
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;

      const cctx = c.getContext('2d');
      cctx.drawImage(img, 0, 0);
      cctx.globalCompositeOperation = 'source-in';
      cctx.fillStyle = '#465b6a';
      cctx.fillRect(0, 0, c.width, c.height);

      return c;
    }

    function createFogClouds() {
      const clouds = [];

      for (let i = 0; i < 45; i++) {
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

        clouds.forEach(c => {
          c.x += c.vx;
          c.rotation += c.rotSpeed;

          ctx.fog.save();
          ctx.fog.translate(c.x, c.y);
          ctx.fog.rotate(c.rotation);
          ctx.fog.globalAlpha = c.alpha;
          ctx.fog.drawImage(img, -c.size / 2, -c.size / 2, c.size, c.size);
          ctx.fog.restore();
        });

        requestAnimationFrame(loop);
      }

      loop();
    }

    /**無限滾動版本的 list builder**/
    function buildInfiniteRaceList() {
      if (!dom.expandRaceList || !Array.isArray(raceData) || raceData.length === 0) return;

      dom.expandRaceList.innerHTML = '';

      // 外層軌道
      const track = document.createElement('div');
      track.className = 'race-list-track';
      dom.expandRaceList.appendChild(track);

      const loopData = [...raceData, ...raceData, ...raceData];

      loopData.forEach((race, index) => {
        const realIndex = index % raceData.length;
        const card = createInfiniteRaceCard(race, realIndex, index);
        track.appendChild(card);
      });

      updateRaceListCardWidth();

      dom.expandRaceList.addEventListener('scroll', handleInfiniteRaceScroll, { passive: true });
      window.addEventListener('resize', updateRaceListCardWidth);
    }

    /*卡片建立函式*/
    function createInfiniteRaceCard(race, realIndex, displayIndex = 0) {
      const card = document.createElement('div');
      card.className = 'race-card simplified loop-card';
      card.dataset.realIndex = String(realIndex);
      card.dataset.raceId = raceData[realIndex].id;

      /* 讓每張卡片有自己的延遲順序 */
      card.style.setProperty('--card-order', displayIndex);

      card.innerHTML = `
        <div class="race-card-bg" style="background-image: url('${race.trackMap}')"></div>
        <div class="race-card-info">
          <div class="race-card-title">${race.title}</div>
        </div>
      `;

      card.addEventListener('click', event => {
        if (state.slider.suppressClick) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        const targetRace = raceData[realIndex];
        const pin = state.pins.find(item => item.dataset.id === String(targetRace.id));
        if (pin) pin.click();
      });

      return card;
    }

    /*寬度計算與無限跳轉邏輯*/
    function updateRaceListCardWidth() {
      const isMobile = window.innerWidth <= CONFIG.desktopBreakpoint;

      const visibleCount = isMobile
        ? CONFIG.listVisibleCount.mobile
        : CONFIG.listVisibleCount.desktop;

      const gap = isMobile
        ? CONFIG.listGap.mobile
        : CONFIG.listGap.desktop;

      let containerWidth;

      if (dom.bottomExpandMenu.classList.contains('open')) {
        containerWidth = dom.expandRaceList.clientWidth;
      } else {
        const reserveWidth = window.innerWidth <= CONFIG.desktopBreakpoint ? 120 : 200;
        containerWidth = window.innerWidth - reserveWidth;
      }

      if (containerWidth <= 0) return;

      const cardWidth = (containerWidth - gap * (visibleCount - 1)) / visibleCount;
      state.slider.cardWidth = cardWidth + gap;

      const track = dom.expandRaceList.querySelector('.race-list-track');
      if (!track) return;

      track.style.setProperty('--race-card-width', `${cardWidth}px`);
      track.style.setProperty('--race-card-gap', `${gap}px`);
    }

    function resetInfiniteRacePosition() {
      if (!state.slider.cardWidth) return;

      const middleStartIndex = raceData.length;
      dom.expandRaceList.scrollLeft = state.slider.cardWidth * middleStartIndex;
    }


    /****/
    init();
  })();