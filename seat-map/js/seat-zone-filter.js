/* =========================================================
   Seat Zone Filter
   ---------------------------------------------------------
   負責上方 Zone 篩選按鈕：
   1. 讀取 .zone-nav 內的 .zone-chip
   2. 使用固定 zones 清單，不依 seat-data 是否有座位決定是否顯示
   3. 點擊 Zone chip 時切換篩選狀態
   4. 允許 0 個 Zone 被選取
   5. 可由 setAvailableZones() 控制目前 category 下哪些 Zone 要顯示
   6. 預設允許全部未選取，並將目前啟用中的 zones 回傳給 seat-map-app.js

   注意：
   - 這支檔案不直接處理卡片、不直接處理 SVG。
   - ZONE 3 即使存在於 ZONE_OPTIONS，也可在特定 category 沒有座位時被隱藏。
   ========================================================= */

function normalizeZoneText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function getButtonZone(button) {
  const zone = button.dataset.zone || button.textContent;
  return normalizeZoneText(zone);
}

export function createSeatZoneFilter({ root, zones, onChange, initialActiveZones = [] }) {
  if (!root) {
    throw new Error("createSeatZoneFilter: 找不到 .zone-nav");
  }

  const zoneOptions = zones.map(normalizeZoneText).filter(Boolean);
  let availableZoneSet = new Set(zoneOptions);

  const initialZones = initialActiveZones instanceof Set ? [...initialActiveZones] : initialActiveZones;
  const activeZones = new Set(
    initialZones
      .map(normalizeZoneText)
      .filter((zone) => zoneOptions.includes(zone))
  );
  let buttons = [];

  function isZoneAvailable(zone) {
    return availableZoneSet.has(zone);
  }

  function setupButtons() {
    buttons = Array.from(root.querySelectorAll(".zone-chip"));

    buttons.forEach((button) => {
      const zone = getButtonZone(button);
      const isKnownZone = zoneOptions.includes(zone);
      const isAvailable = isKnownZone && isZoneAvailable(zone);

      button.dataset.zone = zone;
      button.hidden = !isAvailable;
      button.disabled = !isAvailable;
      button.classList.toggle("is-active", isAvailable && activeZones.has(zone));
      button.setAttribute("aria-pressed", isAvailable && activeZones.has(zone) ? "true" : "false");
    });
  }

  function syncButtonState() {
    buttons.forEach((button) => {
      const zone = getButtonZone(button);
      const isKnownZone = zoneOptions.includes(zone);
      const isAvailable = isKnownZone && isZoneAvailable(zone);
      const isActive = activeZones.has(zone);

      button.hidden = !isAvailable;
      button.disabled = !isAvailable;
      button.classList.toggle("is-active", isAvailable && isActive);
      button.setAttribute("aria-pressed", isAvailable && isActive ? "true" : "false");
    });
  }

  function emitChange(source = "zone") {
    if (typeof onChange !== "function") return;

    onChange([...activeZones], {
      source
    });
  }

  function toggleZone(zone) {
    if (!zoneOptions.includes(zone)) return;
    if (!isZoneAvailable(zone)) return;

    if (activeZones.has(zone)) {
      activeZones.delete(zone);
    } else {
      activeZones.add(zone);
    }

    syncButtonState();
    emitChange("zone-click");
  }

  function bindEvents() {
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        toggleZone(getButtonZone(button));
      });
    });
  }

  function init() {
    setupButtons();
    bindEvents();
    syncButtonState();
  }

  function getActiveZones() {
    return [...activeZones];
  }

  function setActiveZones(zones) {
    const nextZones = zones
      .map(normalizeZoneText)
      .filter((zone) => zoneOptions.includes(zone) && isZoneAvailable(zone));

    activeZones.clear();
    nextZones.forEach((zone) => activeZones.add(zone));

    syncButtonState();
    emitChange("set-active-zones");
  }

  function setAvailableZones(zones, options = {}) {
    const nextAvailableZones = new Set(
      zones
        .map(normalizeZoneText)
        .filter((zone) => zoneOptions.includes(zone))
    );

    availableZoneSet = nextAvailableZones;

    let changedActiveZones = false;

    Array.from(activeZones).forEach((zone) => {
      if (!availableZoneSet.has(zone)) {
        activeZones.delete(zone);
        changedActiveZones = true;
      }
    });

    syncButtonState();

    if (changedActiveZones && options.emit !== false) {
      emitChange(options.source || "available-zones-change");
    }
  }

  function clear() {
    activeZones.clear();
    syncButtonState();
    emitChange("clear-zones");
  }

  return {
    init,
    getActiveZones,
    setActiveZones,
    setAvailableZones,
    clear
  };
}
