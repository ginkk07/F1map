/* =========================================================
   Seat Category Toggle
   ---------------------------------------------------------
   負責看臺類型切換：
   1. 預設 Grandstand
   2. 點擊後切換 Hospitality
   3. 單一 category 模式，不做多選
   4. 若頁面沒有 .seat-category-toggle，回傳 noop，不阻斷主程式
   ========================================================= */

const CATEGORY_GRANDSTAND = "grandstand";
const CATEGORY_HOSPITALITY = "hospitality";

function normalizeCategory(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function createNoopController(initialCategory) {
  let activeCategory = normalizeCategory(initialCategory) || CATEGORY_GRANDSTAND;

  return {
    init() {},
    getActiveCategory() {
      return activeCategory;
    },
    setActiveCategory(category) {
      const normalizedCategory = normalizeCategory(category);

      if (normalizedCategory === CATEGORY_GRANDSTAND || normalizedCategory === CATEGORY_HOSPITALITY) {
        activeCategory = normalizedCategory;
      }
    }
  };
}

export function createSeatCategoryToggle({
  root,
  initialCategory = CATEGORY_GRANDSTAND,
  onChange
}) {
  if (!root) {
    console.warn("[SeatCategoryToggle] 找不到 .seat-category-toggle，略過看臺類型切換功能。");
    return createNoopController(initialCategory);
  }

  let activeCategory = normalizeCategory(root.dataset.category || initialCategory);

  if (activeCategory !== CATEGORY_GRANDSTAND && activeCategory !== CATEGORY_HOSPITALITY) {
    activeCategory = CATEGORY_GRANDSTAND;
  }

  let initialized = false;

  function hasFlipFaces() {
    return Boolean(root.querySelector(".category-face--front") && root.querySelector(".category-face--back"));
  }

  function getLabel() {
    return activeCategory === CATEGORY_HOSPITALITY ? "Hospitality" : "Grandstand";
  }

  function applyState() {
    const isHospitality = activeCategory === CATEGORY_HOSPITALITY;

    root.dataset.category = activeCategory;
    root.classList.toggle("is-grandstand", !isHospitality);
    root.classList.toggle("is-hospitality", isHospitality);
    root.setAttribute("aria-pressed", isHospitality ? "true" : "false");
    root.setAttribute(
      "aria-label",
      isHospitality
        ? "目前顯示 Hospitality，點擊切換 Grandstand"
        : "目前顯示 Grandstand，點擊切換 Hospitality"
    );

    // 若 HTML 沒有提供翻轉用的兩面結構，退回純文字按鈕，避免畫面空白。
    if (!hasFlipFaces()) {
      root.textContent = getLabel();
    }
  }

  function emitChange(source) {
    if (typeof onChange !== "function") return;

    onChange(activeCategory, {
      source
    });
  }

  function setActiveCategory(category, options = {}) {
    const normalizedCategory = normalizeCategory(category);

    if (normalizedCategory !== CATEGORY_GRANDSTAND && normalizedCategory !== CATEGORY_HOSPITALITY) {
      return;
    }

    if (activeCategory === normalizedCategory && !options.force) {
      return;
    }

    activeCategory = normalizedCategory;
    applyState();
    emitChange(options.source || "set-category");
  }

  function toggle() {
    setActiveCategory(
      activeCategory === CATEGORY_GRANDSTAND ? CATEGORY_HOSPITALITY : CATEGORY_GRANDSTAND,
      {
        source: "category-toggle"
      }
    );
  }

  function init() {
    if (initialized) return;
    initialized = true;

    root.setAttribute("type", "button");
    root.addEventListener("click", toggle);
    applyState();
  }

  return {
    init,
    getActiveCategory() {
      return activeCategory;
    },
    setActiveCategory
  };
}
