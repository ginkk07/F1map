/* =========================================================
   Seat Category Filter
   ---------------------------------------------------------
   負責看臺類型篩選：
   1. grandstand 一般看臺
   2. hospitality 包廂 / 招待
   3. 可允許 0 個 category 被選取
   ========================================================= */

function normalizeCategoryText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function getButtonCategory(button) {
  const category = button.dataset.category || button.textContent;
  return normalizeCategoryText(category);
}

export function createSeatCategoryFilter({
  root,
  categories,
  initialActiveCategories = categories,
  onChange
}) {
  if (!root) {
    throw new Error("createSeatCategoryFilter: 找不到 .category-nav");
  }

  const categoryOptions = categories.map(normalizeCategoryText).filter(Boolean);
  const initialCategories =
    initialActiveCategories instanceof Set ? [...initialActiveCategories] : initialActiveCategories;

  const activeCategories = new Set(
    initialCategories
      .map(normalizeCategoryText)
      .filter((category) => categoryOptions.includes(category))
  );

  let buttons = [];

  function setupButtons() {
    buttons = Array.from(root.querySelectorAll(".category-chip"));

    buttons.forEach((button) => {
      const category = getButtonCategory(button);
      const isKnownCategory = categoryOptions.includes(category);

      button.dataset.category = category;
      button.hidden = !isKnownCategory;
      button.disabled = !isKnownCategory;
      button.classList.toggle("is-active", isKnownCategory && activeCategories.has(category));
      button.setAttribute("aria-pressed", isKnownCategory && activeCategories.has(category) ? "true" : "false");
    });
  }

  function syncButtonState() {
    buttons.forEach((button) => {
      const category = getButtonCategory(button);
      const isActive = activeCategories.has(category);

      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  function emitChange(source = "category") {
    if (typeof onChange !== "function") return;

    onChange([...activeCategories], {
      source
    });
  }

  function toggleCategory(category) {
    if (!categoryOptions.includes(category)) return;

    if (activeCategories.has(category)) {
      activeCategories.delete(category);
    } else {
      activeCategories.add(category);
    }

    syncButtonState();
    emitChange("category-click");
  }

  function bindEvents() {
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        toggleCategory(getButtonCategory(button));
      });
    });
  }

  function init() {
    setupButtons();
    bindEvents();
    syncButtonState();
  }

  function getActiveCategories() {
    return [...activeCategories];
  }

  function setActiveCategories(categories) {
    const nextCategories = categories
      .map(normalizeCategoryText)
      .filter((category) => categoryOptions.includes(category));

    activeCategories.clear();
    nextCategories.forEach((category) => activeCategories.add(category));

    syncButtonState();
    emitChange("set-active-categories");
  }

  function clear() {
    activeCategories.clear();
    syncButtonState();
    emitChange("clear-categories");
  }

  return {
    init,
    getActiveCategories,
    setActiveCategories,
    clear
  };
}