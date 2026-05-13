/* =========================================================
   Seat Map Mobile Zoom - Layout Safe Version
   ---------------------------------------------------------
   手機版地圖縮放 / 拖曳：
   1. 初始狀態完全維持原本地圖排版，不改寬高
   2. 小於 768px 時啟用雙指縮放
   3. 放大後可單指拖曳地圖
   4. 移動範圍限制在 .map-svg-wrap 內
   5. transform 套在 inline SVG，不改 layout 尺寸
   ========================================================= */

const DEFAULT_OPTIONS = {
  mobileQuery: "(max-width: 768px)",
  minScale: 1,
  maxScale: 3,
  dragThreshold: 4
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getDistance(a, b) {
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.hypot(dx, dy);
}

function getMidpoint(a, b) {
  return {
    clientX: (a.clientX + b.clientX) / 2,
    clientY: (a.clientY + b.clientY) / 2
  };
}

function normalizePointer(event) {
  return {
    pointerId: event.pointerId,
    clientX: event.clientX,
    clientY: event.clientY
  };
}

function createMobileMapZoom(wrapRoot, options = {}) {
  const config = {
    ...DEFAULT_OPTIONS,
    ...options
  };

  const mediaQuery = window.matchMedia(config.mobileQuery);
  const pointers = new Map();

  let svgRoot = null;
  let initialized = false;
  let enabled = false;

  let scale = 1;
  let translateX = 0;
  let translateY = 0;

  let dragStart = null;
  let pinchStart = null;
  let suppressNextClick = false;

  function isMobile() {
    return mediaQuery.matches;
  }

  function getSvgRoot() {
    if (svgRoot && wrapRoot.contains(svgRoot)) {
      return svgRoot;
    }

    svgRoot = wrapRoot.querySelector("svg.map-svg__inline") || wrapRoot.querySelector("svg");
    return svgRoot;
  }

  function applyTransform() {
    const target = getSvgRoot();

    if (!target) return;

    target.style.transformOrigin = "0 0";

    if (scale <= 1.0001) {
      target.style.transform = "";
      wrapRoot.classList.remove("is-map-zoomed");
      return;
    }

    target.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`;
    wrapRoot.classList.add("is-map-zoomed");
  }

  function getBaseSize() {
    const target = getSvgRoot();

    if (!target) {
      return {
        width: 0,
        height: 0
      };
    }

    return {
      width: target.clientWidth || target.getBoundingClientRect().width,
      height: target.clientHeight || target.getBoundingClientRect().height
    };
  }

  function getBounds(nextScale = scale) {
    const size = getBaseSize();
    const viewportWidth = wrapRoot.clientWidth;
    const viewportHeight = wrapRoot.clientHeight;

    const scaledWidth = size.width * nextScale;
    const scaledHeight = size.height * nextScale;

    return {
      minX: scaledWidth > viewportWidth ? viewportWidth - scaledWidth : 0,
      maxX: 0,
      minY: scaledHeight > viewportHeight ? viewportHeight - scaledHeight : 0,
      maxY: 0
    };
  }

  function clampTranslate() {
    if (scale <= 1.0001) {
      scale = 1;
      translateX = 0;
      translateY = 0;
      return;
    }

    const bounds = getBounds(scale);

    translateX = clamp(translateX, bounds.minX, bounds.maxX);
    translateY = clamp(translateY, bounds.minY, bounds.maxY);
  }

  function setTransform(nextScale, nextX, nextY) {
    scale = clamp(nextScale, config.minScale, config.maxScale);
    translateX = nextX;
    translateY = nextY;

    clampTranslate();
    applyTransform();
  }

  function reset() {
    pointers.clear();
    dragStart = null;
    pinchStart = null;
    suppressNextClick = false;

    scale = 1;
    translateX = 0;
    translateY = 0;

    applyTransform();
  }

  function startDrag(pointer) {
    dragStart = {
      pointerId: pointer.pointerId,
      clientX: pointer.clientX,
      clientY: pointer.clientY,
      translateX,
      translateY,
      moved: false
    };
  }

  function startPinch() {
    const activePointers = [...pointers.values()];

    if (activePointers.length < 2) return;

    const first = activePointers[0];
    const second = activePointers[1];
    const midpoint = getMidpoint(first, second);
    const wrapRect = wrapRoot.getBoundingClientRect();

    pinchStart = {
      distance: getDistance(first, second),
      scale,
      contentX: (midpoint.clientX - wrapRect.left - translateX) / scale,
      contentY: (midpoint.clientY - wrapRect.top - translateY) / scale
    };
  }

  function handlePointerDown(event) {
    if (!enabled) return;
    if (event.pointerType === "mouse") return;

    const pointer = normalizePointer(event);
    pointers.set(pointer.pointerId, pointer);

    if (pointers.size === 1) {
      startDrag(pointer);
    }

    if (pointers.size === 2) {
      event.preventDefault();
      suppressNextClick = true;
      startPinch();
    }
  }

  function handlePointerMove(event) {
    if (!enabled) return;
    if (!pointers.has(event.pointerId)) return;

    const pointer = normalizePointer(event);
    pointers.set(pointer.pointerId, pointer);

    if (pointers.size >= 2 && pinchStart) {
      event.preventDefault();

      const activePointers = [...pointers.values()];
      const first = activePointers[0];
      const second = activePointers[1];
      const distance = getDistance(first, second);

      if (!pinchStart.distance) return;

      const nextScale = clamp(
        pinchStart.scale * (distance / pinchStart.distance),
        config.minScale,
        config.maxScale
      );

      const midpoint = getMidpoint(first, second);
      const wrapRect = wrapRoot.getBoundingClientRect();

      const nextX = midpoint.clientX - wrapRect.left - pinchStart.contentX * nextScale;
      const nextY = midpoint.clientY - wrapRect.top - pinchStart.contentY * nextScale;

      suppressNextClick = true;
      setTransform(nextScale, nextX, nextY);
      return;
    }

    if (pointers.size === 1 && dragStart && scale > 1.0001) {
      const dx = pointer.clientX - dragStart.clientX;
      const dy = pointer.clientY - dragStart.clientY;
      const movedDistance = Math.hypot(dx, dy);

      if (movedDistance > config.dragThreshold) {
        dragStart.moved = true;
      }

      if (!dragStart.moved) return;

      event.preventDefault();
      suppressNextClick = true;
      setTransform(scale, dragStart.translateX + dx, dragStart.translateY + dy);
    }
  }

  function handlePointerUp(event) {
    if (!enabled) return;

    if (pointers.has(event.pointerId)) {
      pointers.delete(event.pointerId);
    }

    if (pointers.size < 2) {
      pinchStart = null;
    }

    if (pointers.size === 1) {
      startDrag([...pointers.values()][0]);
    } else {
      dragStart = null;
    }

    clampTranslate();
    applyTransform();
  }

  function handleClick(event) {
    if (!suppressNextClick) return;

    event.preventDefault();
    event.stopPropagation();
    suppressNextClick = false;
  }

  function enable() {
    if (enabled) return;

    enabled = true;
    wrapRoot.classList.add("is-mobile-map-zoom-enabled");
    reset();
  }

  function disable() {
    if (!enabled) return;

    enabled = false;
    wrapRoot.classList.remove("is-mobile-map-zoom-enabled", "is-map-zoomed");
    reset();
  }

  function syncEnabledState() {
    if (isMobile()) {
      enable();
    } else {
      disable();
    }
  }

  function bindMediaChange() {
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncEnabledState);
      return;
    }

    mediaQuery.addListener(syncEnabledState);
  }

  function bindEvents() {
    wrapRoot.addEventListener("pointerdown", handlePointerDown, { passive: false });
    wrapRoot.addEventListener("pointermove", handlePointerMove, { passive: false });
    wrapRoot.addEventListener("pointerup", handlePointerUp);
    wrapRoot.addEventListener("pointercancel", handlePointerUp);
    wrapRoot.addEventListener("lostpointercapture", handlePointerUp);
    wrapRoot.addEventListener("click", handleClick, true);

    window.addEventListener("resize", () => {
      clampTranslate();
      applyTransform();
    });
  }

  function init() {
    if (initialized) return;
    initialized = true;

    bindEvents();
    bindMediaChange();
    syncEnabledState();
  }

  return {
    init,
    reset,
    getScale() {
      return scale;
    }
  };
}

function boot() {
  const wrapRoot = document.querySelector(".map-svg-wrap");

  if (!wrapRoot) {
    console.warn("[SeatMapMobileZoom] 找不到 .map-svg-wrap。");
    return;
  }

  const controller = createMobileMapZoom(wrapRoot);
  controller.init();

  window.SeatMapMobileZoom = controller;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
