/* =========================================================
   Seat Mobile List Toggle
   ---------------------------------------------------------
   手機版專用：
   1. 綁定 .map-help 按鈕
   2. 點擊後切換 .seat-sidebar 顯示 / 隱藏
   3. 只在 mobileQuery 符合時啟用；桌機版不介入版面

   注意：
   - 實際顯示 / 隱藏動畫交給 CSS 控制。
   - JS 只負責切換 .seat-page 上的狀態 class：
     .is-seat-list-open / .is-seat-list-closed
   ========================================================= */

function createNoopController() {
  return {
    init() {},
    open() {},
    close() {},
    toggle() {},
    isOpen() {
      return false;
    }
  };
}

export function createMobileSeatListToggle({
  pageRoot,
  sidebarRoot,
  buttonRoot,
  mobileQuery = "(max-width: 768px)",
  defaultOpen = false
}) {
  if (!pageRoot || !sidebarRoot || !buttonRoot) {
    console.warn("[SeatMobileListToggle] 缺少必要元素，略過手機座位列表切換功能。", {
      pageRoot,
      sidebarRoot,
      buttonRoot
    });

    return createNoopController();
  }

  const mediaQuery = window.matchMedia(mobileQuery);
  let opened = Boolean(defaultOpen);
  let initialized = false;

  function isMobile() {
    return mediaQuery.matches;
  }

  function syncA11y() {
    buttonRoot.setAttribute("aria-expanded", isMobile() && opened ? "true" : "false");
    buttonRoot.setAttribute("aria-controls", sidebarRoot.id || "seat-sidebar");
    buttonRoot.setAttribute("aria-label", opened ? "隱藏座位列表" : "顯示座位列表");

    if (!sidebarRoot.id) {
      sidebarRoot.id = "seat-sidebar";
    }

    if (isMobile()) {
      sidebarRoot.setAttribute("aria-hidden", opened ? "false" : "true");
    } else {
      sidebarRoot.removeAttribute("aria-hidden");
    }
  }

  function applyState() {
    if (!isMobile()) {
      pageRoot.classList.remove("is-seat-list-open", "is-seat-list-closed");
      syncA11y();
      return;
    }

    pageRoot.classList.toggle("is-seat-list-open", opened);
    pageRoot.classList.toggle("is-seat-list-closed", !opened);
    syncA11y();
  }

  function setOpen(nextOpen) {
    opened = Boolean(nextOpen);
    applyState();
  }

  function open() {
    setOpen(true);
  }

  function close() {
    setOpen(false);
  }

  function toggle() {
    setOpen(!opened);
  }

  function handleButtonClick(event) {
    if (!isMobile()) return;

    event.preventDefault();
    event.stopPropagation();
    toggle();
  }

  function handleKeydown(event) {
    if (!isMobile() || !opened) return;
    if (event.key !== "Escape") return;

    close();
    buttonRoot.focus({ preventScroll: true });
  }

  function handleMediaChange() {
    applyState();
  }

  function bindMediaChange() {
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleMediaChange);
      return;
    }

    // Safari 舊版 fallback
    mediaQuery.addListener(handleMediaChange);
  }

  function init() {
    if (initialized) return;
    initialized = true;

    buttonRoot.setAttribute("type", "button");
    buttonRoot.addEventListener("click", handleButtonClick);
    document.addEventListener("keydown", handleKeydown);
    bindMediaChange();
    applyState();
  }

  return {
    init,
    open,
    close,
    toggle,
    isOpen() {
      return opened;
    }
  };
}
