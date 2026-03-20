const STORAGE_KEY = "ourmeals_v2";
const LEGACY_STORAGE_KEY = "ourmeals_v1";
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function initialState() {
  const now = new Date().toISOString();
  return {
    version: 2,
    meals: [],
    weekPlan: null,
    grocery: {
      items: [],
      generatedAt: null,
    },
    dinnerSuggestion: {
      mealId: null,
      generatedAt: null,
    },
    meta: { createdAt: now, updatedAt: now },
  };
}

function hydrateMeal(raw) {
  return {
    id: raw.id || uid(),
    name: typeof raw.name === "string" ? raw.name.trim() : "",
    ingredients: Array.isArray(raw.ingredients)
      ? raw.ingredients.map((item) => String(item).trim()).filter(Boolean)
      : [],
  };
}

function coerceWeekPlan(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.days)) return null;
  const days = DAYS.map((label, index) => {
    const existing = raw.days[index] || {};
    return { label, mealId: existing.mealId || null };
  });
  return { days };
}

function coerceState(parsed) {
  const base = initialState();
  if (!parsed || typeof parsed !== "object") return base;

  const meals = Array.isArray(parsed.meals)
    ? parsed.meals.map(hydrateMeal).filter((meal) => meal.name)
    : [];

  const grocery =
    parsed.grocery && typeof parsed.grocery === "object"
      ? {
          items: Array.isArray(parsed.grocery.items)
            ? parsed.grocery.items.map((item) => ({
                text: String(item.text || "").trim(),
                checked: !!item.checked,
              })).filter((item) => item.text)
            : [],
          generatedAt: parsed.grocery.generatedAt || null,
        }
      : base.grocery;

  const dinnerSuggestion =
    parsed.dinnerSuggestion && typeof parsed.dinnerSuggestion === "object"
      ? {
          mealId: parsed.dinnerSuggestion.mealId || null,
          generatedAt: parsed.dinnerSuggestion.generatedAt || null,
        }
      : base.dinnerSuggestion;

  const meta =
    parsed.meta && typeof parsed.meta === "object"
      ? { ...base.meta, ...parsed.meta }
      : base.meta;

  return {
    ...base,
    ...parsed,
    meals,
    weekPlan: coerceWeekPlan(parsed.weekPlan),
    grocery,
    dinnerSuggestion,
    meta,
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return coerceState(JSON.parse(raw));

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) return coerceState(JSON.parse(legacy));

    return initialState();
  } catch {
    return initialState();
  }
}

function saveState(currentState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));
  } catch {}
}

function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "id_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}

let state = loadState();
saveState(state);

const mealForm = document.getElementById("mealForm");
const mealName = document.getElementById("mealName");
const mealIngredients = document.getElementById("mealIngredients");
const mealList = document.getElementById("mealList");
const mealCount = document.getElementById("mealCount");
const emptyHint = document.getElementById("emptyHint");
const seedBtn = document.getElementById("seedBtn");
const resetBtn = document.getElementById("resetBtn");
const searchInput = document.getElementById("search");

const modalBackdrop = document.getElementById("modalBackdrop");
const editModal = document.getElementById("editModal");
const closeModalBtn = document.getElementById("closeModal");
const editForm = document.getElementById("editForm");
const editName = document.getElementById("editName");
const editIngredients = document.getElementById("editIngredients");
const deleteFromModalBtn = document.getElementById("deleteFromModal");

const generateWeekBtn = document.getElementById("generateWeekBtn");
const clearWeekBtn = document.getElementById("clearWeekBtn");
const weekList = document.getElementById("weekList");
const weekHint = document.getElementById("weekHint");

const generateGroceryBtn = document.getElementById("generateGroceryBtn");
const clearGroceryBtn = document.getElementById("clearGroceryBtn");
const copyGroceryBtn = document.getElementById("copyGroceryBtn");
const groceryListEl = document.getElementById("groceryList");
const groceryHint = document.getElementById("groceryHint");
const grocerySummary = document.getElementById("grocerySummary");

const decisionLabel = document.getElementById("decisionLabel");
const decisionMeal = document.getElementById("decisionMeal");
const decisionIngredients = document.getElementById("decisionIngredients");
const pickDinnerBtn = document.getElementById("pickDinnerBtn");
const regenerateDinnerBtn = document.getElementById("regenerateDinnerBtn");
const saveTonightBtn = document.getElementById("saveTonightBtn");

const statMeals = document.getElementById("statMeals");
const statPlanned = document.getElementById("statPlanned");
const statGroceries = document.getElementById("statGroceries");

let searchTerm = "";
let editingMealId = null;

function normalize(str) {
  return (str || "").toLowerCase().trim();
}

function mealMatches(meal, term) {
  if (!term) return true;
  const query = normalize(term);
  if (normalize(meal.name).includes(query)) return true;
  return meal.ingredients.some((ingredient) => normalize(ingredient).includes(query));
}

function findMealById(mealId) {
  return state.meals.find((meal) => meal.id === mealId) || null;
}

function shuffledCopy(arr) {
  const copy = arr.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function toast(message) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1400);
}

function getTodayIndex() {
  const dayIndex = new Date().getDay();
  return dayIndex === 0 ? 6 : dayIndex - 1;
}

function countPlannedDays() {
  if (!state.weekPlan || !Array.isArray(state.weekPlan.days)) return 0;
  return state.weekPlan.days.filter((day) => !!day.mealId).length;
}

function createEmptyWeekPlan() {
  return {
    days: DAYS.map((label) => ({ label, mealId: null })),
  };
}

function getWeekPlanOrEmpty() {
  return state.weekPlan && Array.isArray(state.weekPlan.days) ? state.weekPlan : createEmptyWeekPlan();
}

function emptyGroceryState() {
  return {
    items: [],
    generatedAt: null,
  };
}

function getPlannedMealNames() {
  if (!state.weekPlan || !Array.isArray(state.weekPlan.days)) return [];
  return state.weekPlan.days
    .map((day) => findMealById(day.mealId))
    .filter(Boolean)
    .map((meal) => meal.name);
}

function pickDinnerCandidate() {
  if (!state.meals.length) return null;

  const plannedToday = state.weekPlan && state.weekPlan.days ? state.weekPlan.days[getTodayIndex()] : null;
  if (plannedToday && plannedToday.mealId) {
    return findMealById(plannedToday.mealId);
  }

  const usedIds = new Set(
    state.weekPlan && state.weekPlan.days
      ? state.weekPlan.days.map((day) => day.mealId).filter(Boolean)
      : []
  );

  const pool = state.meals.filter((meal) => !usedIds.has(meal.id));
  const source = pool.length ? pool : state.meals;
  return source[Math.floor(Math.random() * source.length)] || null;
}

function renderStats() {
  statMeals.textContent = String(state.meals.length);
  statPlanned.textContent = `${countPlannedDays()}/7`;
  statGroceries.textContent = String(state.grocery.items.length);
}

function renderMeals() {
  const filteredMeals = state.meals.filter((meal) => mealMatches(meal, searchTerm));
  mealCount.textContent = String(state.meals.length);
  mealList.innerHTML = "";

  const isEmpty = state.meals.length === 0;
  emptyHint.style.display = isEmpty ? "block" : "none";

  if (filteredMeals.length === 0 && !isEmpty) {
    const li = document.createElement("li");
    li.innerHTML = '<div><div class="meal-title">No matches</div><div class="meal-ingredients">Try a different search.</div></div>';
    mealList.appendChild(li);
    return;
  }

  filteredMeals.forEach((meal) => {
    const li = document.createElement("li");

    const left = document.createElement("div");
    const title = document.createElement("div");
    title.className = "meal-title";
    title.textContent = meal.name;

    const ingredients = document.createElement("div");
    ingredients.className = "meal-ingredients";
    ingredients.textContent = meal.ingredients.length
      ? meal.ingredients.join("\n")
      : "No ingredients added yet.";

    left.appendChild(title);
    left.appendChild(ingredients);

    const actions = document.createElement("div");
    actions.className = "row";

    const useBtn = document.createElement("button");
    useBtn.type = "button";
    useBtn.textContent = "Use tonight";
    useBtn.addEventListener("click", () => {
      commit({
        ...state,
        dinnerSuggestion: {
          mealId: meal.id,
          generatedAt: new Date().toISOString(),
        },
      });
      toast("Dinner idea ready");
    });

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openEditModal(meal.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.textContent = "Delete";
    deleteBtn.className = "danger";
    deleteBtn.addEventListener("click", () => deleteMeal(meal.id));

    actions.append(useBtn, editBtn, deleteBtn);
    li.append(left, actions);
    mealList.appendChild(li);
  });
}

function renderDinnerSuggestion() {
  const meal = findMealById(state.dinnerSuggestion.mealId);

  regenerateDinnerBtn.disabled = state.meals.length === 0;
  pickDinnerBtn.disabled = state.meals.length === 0;
  saveTonightBtn.disabled = !meal;

  if (!meal) {
    decisionLabel.textContent = "Add a few meals and let OurMeals break the dinner deadlock.";
    decisionMeal.textContent = "No meal picked yet";
    decisionIngredients.textContent = "Your saved meal ideas will show up here with a quick ingredient preview.";
    return;
  }

  const plannedNames = new Set(getPlannedMealNames());
  const alreadyPlanned = plannedNames.has(meal.name);
  const todayLabel = DAYS[getTodayIndex()];

  decisionLabel.textContent = alreadyPlanned
    ? `${meal.name} is already in your week plan, which might make tonight easier.`
    : `One solid option for ${todayLabel.toLowerCase()} night.`;
  decisionMeal.textContent = meal.name;
  decisionIngredients.textContent = meal.ingredients.length
    ? meal.ingredients.join(", ")
    : "No ingredients added yet, but you can still plan it.";
}

function renderWeek() {
  weekList.innerHTML = "";
  const hasMeals = state.meals.length > 0;
  const plan = getWeekPlanOrEmpty();

  weekHint.style.display = hasMeals ? "none" : "block";
  generateWeekBtn.disabled = !hasMeals;
  clearWeekBtn.disabled = !plan.days.some((day) => day.mealId);

  const todayIndex = getTodayIndex();

  plan.days.forEach((day, index) => {
    const li = document.createElement("li");

    const topRow = document.createElement("div");
    topRow.className = "week-row";

    const dayLabel = document.createElement("span");
    dayLabel.className = `day${index === todayIndex ? " today" : ""}`;
    dayLabel.textContent = index === todayIndex ? `${day.label} - Today` : day.label;

    const currentMeal = findMealById(day.mealId);
    const summary = document.createElement("span");
    summary.className = currentMeal ? "week-meal" : "week-empty";
    summary.textContent = currentMeal ? currentMeal.name : "Nothing picked yet";

    topRow.append(dayLabel, summary);

    const controls = document.createElement("div");
    controls.className = "week-controls";

    const select = document.createElement("select");
    select.setAttribute("aria-label", `Meal for ${day.label}`);

    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "Choose a meal";
    select.appendChild(emptyOption);

    state.meals.forEach((meal) => {
      const option = document.createElement("option");
      option.value = meal.id;
      option.textContent = meal.name;
      option.selected = meal.id === day.mealId;
      select.appendChild(option);
    });

    select.addEventListener("change", (event) => {
      setDayMeal(index, event.target.value || null);
    });

    const rerollBtn = document.createElement("button");
    rerollBtn.type = "button";
    rerollBtn.className = "week-quick";
    rerollBtn.textContent = "Shuffle";
    rerollBtn.disabled = state.meals.length === 0;
    rerollBtn.addEventListener("click", () => randomizeDayMeal(index));

    controls.append(select, rerollBtn);
    li.append(topRow, controls);
    weekList.appendChild(li);
  });
}

function renderGrocery() {
  groceryListEl.innerHTML = "";

  const hasWeek = countPlannedDays() > 0;
  const hasItems = state.grocery.items.length > 0;
  const plannedNames = getPlannedMealNames();

  groceryHint.style.display = hasWeek ? "none" : "block";
  generateGroceryBtn.disabled = !hasWeek;
  copyGroceryBtn.disabled = !hasItems;
  clearGroceryBtn.disabled = !hasItems;

  if (plannedNames.length) {
    grocerySummary.classList.remove("hidden");
    grocerySummary.textContent = `Built from: ${plannedNames.join(", ")}`;
  } else {
    grocerySummary.classList.add("hidden");
    grocerySummary.textContent = "";
  }

  if (!hasItems) return;

  state.grocery.items.forEach((item, index) => {
    const li = document.createElement("li");
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!item.checked;
    checkbox.addEventListener("change", () => toggleGroceryItem(index, checkbox.checked));

    const text = document.createElement("span");
    text.className = `item${item.checked ? " checked" : ""}`;
    text.textContent = item.text;

    label.append(checkbox, text);
    li.appendChild(label);
    groceryListEl.appendChild(li);
  });
}

function render() {
  renderStats();
  renderMeals();
  renderDinnerSuggestion();
  renderWeek();
  renderGrocery();
}

function commit(nextState) {
  state = nextState;
  state.meta.updatedAt = new Date().toISOString();
  saveState(state);
  render();
}

function addMeal(name, ingredientLines) {
  const trimmedName = name.trim();
  if (!trimmedName) return;

  const meal = {
    id: uid(),
    name: trimmedName,
    ingredients: ingredientLines.map((item) => item.trim()).filter(Boolean),
  };

  commit({
    ...state,
    meals: [meal, ...state.meals],
    dinnerSuggestion: state.dinnerSuggestion.mealId
      ? state.dinnerSuggestion
      : { mealId: meal.id, generatedAt: new Date().toISOString() },
  });
}

function deleteMeal(id) {
  if (editingMealId === id) closeModal();

  const nextWeek = state.weekPlan
    ? {
        days: state.weekPlan.days.map((day) => ({
          ...day,
          mealId: day.mealId === id ? null : day.mealId,
        })),
      }
    : null;

  const nextDinnerSuggestion =
    state.dinnerSuggestion.mealId === id ? { mealId: null, generatedAt: null } : state.dinnerSuggestion;

  commit({
    ...state,
    meals: state.meals.filter((meal) => meal.id !== id),
    weekPlan: nextWeek,
    dinnerSuggestion: nextDinnerSuggestion,
    grocery: emptyGroceryState(),
  });
}

function updateMeal(id, updates) {
  const nextMeals = state.meals.map((meal) => (meal.id === id ? { ...meal, ...updates } : meal));
  commit({ ...state, meals: nextMeals });
}

function seedMeals() {
  const samples = [
    { name: "Crispy Tacos", ingredients: ["tortillas", "ground beef", "cheese", "lettuce", "salsa"] },
    { name: "Creamy Spaghetti", ingredients: ["pasta", "marinara", "parmesan", "garlic bread"] },
    { name: "Chicken Stir Fry", ingredients: ["chicken", "soy sauce", "rice", "mixed veggies"] },
    { name: "Burger Night", ingredients: ["buns", "ground beef", "cheese", "pickles", "fries"] },
    { name: "Sheet Pan Sausage", ingredients: ["sausage", "baby potatoes", "broccoli", "olive oil"] },
    { name: "Quesadillas", ingredients: ["tortillas", "cheese", "chicken", "sour cream"] },
    { name: "Breakfast for Dinner", ingredients: ["eggs", "bacon", "pancake mix", "fruit"] },
  ];

  const meals = samples.map((sample) => ({
    id: uid(),
    name: sample.name,
    ingredients: sample.ingredients,
  }));

  commit({
    ...state,
    meals: [...meals, ...state.meals],
    dinnerSuggestion: { mealId: meals[0].id, generatedAt: new Date().toISOString() },
  });
}

function resetAll() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  state = initialState();
  saveState(state);
  searchTerm = "";
  searchInput.value = "";
  closeModal();
  render();
}

function generateWeekPlan() {
  if (!state.meals.length) return;

  const mealIds = shuffledCopy(state.meals.map((meal) => meal.id));
  const chosen = [];
  while (chosen.length < 7) {
    mealIds.forEach((id) => {
      if (chosen.length < 7) chosen.push(id);
    });
  }

  commit({
    ...state,
    weekPlan: {
      days: DAYS.map((label, index) => ({ label, mealId: chosen[index] })),
    },
    grocery: emptyGroceryState(),
  });
}

function clearWeekPlan() {
  commit({ ...state, weekPlan: createEmptyWeekPlan(), grocery: emptyGroceryState() });
}

function setDayMeal(dayIndex, mealId) {
  const plan = getWeekPlanOrEmpty();
  const nextDays = plan.days.map((day, index) => (index === dayIndex ? { ...day, mealId } : day));
  commit({ ...state, weekPlan: { days: nextDays }, grocery: emptyGroceryState() });
}

function randomizeDayMeal(dayIndex) {
  if (!state.meals.length) return;

  const plan = getWeekPlanOrEmpty();
  const currentId = plan.days[dayIndex].mealId;
  const otherSelections = new Set(
    plan.days.map((day, index) => (index === dayIndex ? null : day.mealId)).filter(Boolean)
  );

  const preferred = state.meals.filter((meal) => meal.id !== currentId && !otherSelections.has(meal.id));
  const fallback = state.meals.filter((meal) => meal.id !== currentId);
  const pool = preferred.length ? preferred : fallback.length ? fallback : state.meals;
  const nextMeal = pool[Math.floor(Math.random() * pool.length)];

  setDayMeal(dayIndex, nextMeal ? nextMeal.id : null);
}

function planSuggestedDinnerForToday() {
  const mealId = state.dinnerSuggestion.mealId;
  if (!mealId) return;
  setDayMeal(getTodayIndex(), mealId);
  toast("Planned for today");
}

function generateDinnerSuggestion() {
  const meal = pickDinnerCandidate();
  if (!meal) return;
  commit({
    ...state,
    dinnerSuggestion: {
      mealId: meal.id,
      generatedAt: new Date().toISOString(),
    },
  });
}

function canonicalIngredient(str) {
  return str.replace(/\s+/g, " ").trim().toLowerCase();
}

function titleCase(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function generateGroceryList() {
  const plan = getWeekPlanOrEmpty();
  const plannedDays = plan.days.filter((day) => day.mealId);
  if (!plannedDays.length) return;

  const counts = new Map();
  const original = new Map();

  plannedDays.forEach((day) => {
    const meal = findMealById(day.mealId);
    if (!meal) return;

    meal.ingredients.forEach((ingredient) => {
      const key = canonicalIngredient(ingredient);
      if (!key) return;

      counts.set(key, (counts.get(key) || 0) + 1);
      if (!original.has(key)) original.set(key, ingredient.trim());
    });
  });

  const items = Array.from(counts.keys())
    .sort((a, b) => a.localeCompare(b))
    .map((key) => {
      const display = original.get(key) || key;
      const count = counts.get(key) || 1;
      return {
        text: count > 1 ? `${titleCase(display)} (x${count})` : titleCase(display),
        checked: false,
      };
    });

  commit({
    ...state,
    grocery: {
      items,
      generatedAt: new Date().toISOString(),
    },
  });
  toast("Grocery list generated");
}

function clearGroceryList() {
  commit({
    ...state,
    grocery: {
      items: [],
      generatedAt: null,
    },
  });
}

function toggleGroceryItem(index, checked) {
  const nextItems = state.grocery.items.map((item, itemIndex) =>
    itemIndex === index ? { ...item, checked } : item
  );
  commit({
    ...state,
    grocery: {
      ...state.grocery,
      items: nextItems,
    },
  });
}

async function copyGroceryList() {
  if (!state.grocery.items.length) return;

  const text = state.grocery.items.map((item) => `- ${item.text}`).join("\n");

  try {
    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard");
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    toast("Copied");
  }
}

function openEditModal(mealId) {
  const meal = findMealById(mealId);
  if (!meal) return;

  editingMealId = mealId;
  editName.value = meal.name;
  editIngredients.value = meal.ingredients.join("\n");

  modalBackdrop.classList.remove("hidden");
  editModal.classList.remove("hidden");
  editName.focus();
}

function closeModal() {
  editingMealId = null;
  modalBackdrop.classList.add("hidden");
  editModal.classList.add("hidden");
}

function saveEdits() {
  if (!editingMealId) return;

  const name = editName.value.trim();
  if (!name) return;

  updateMeal(editingMealId, {
    name,
    ingredients: editIngredients.value.split("\n").map((item) => item.trim()).filter(Boolean),
  });
  closeModal();
}

modalBackdrop.addEventListener("click", closeModal);
closeModalBtn.addEventListener("click", closeModal);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeModal();
});

mealForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addMeal(mealName.value, mealIngredients.value.split("\n"));
  mealName.value = "";
  mealIngredients.value = "";
  mealName.focus();
});

seedBtn.addEventListener("click", seedMeals);
resetBtn.addEventListener("click", resetAll);

searchInput.addEventListener("input", (event) => {
  searchTerm = event.target.value;
  renderMeals();
});

editForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveEdits();
});

deleteFromModalBtn.addEventListener("click", () => {
  if (editingMealId) deleteMeal(editingMealId);
});

pickDinnerBtn.addEventListener("click", generateDinnerSuggestion);
regenerateDinnerBtn.addEventListener("click", generateDinnerSuggestion);
saveTonightBtn.addEventListener("click", planSuggestedDinnerForToday);

generateWeekBtn.addEventListener("click", generateWeekPlan);
clearWeekBtn.addEventListener("click", clearWeekPlan);

generateGroceryBtn.addEventListener("click", generateGroceryList);
clearGroceryBtn.addEventListener("click", clearGroceryList);
copyGroceryBtn.addEventListener("click", copyGroceryList);

if (!state.dinnerSuggestion.mealId && state.meals.length) {
  state = {
    ...state,
    dinnerSuggestion: {
      mealId: state.meals[0].id,
      generatedAt: new Date().toISOString(),
    },
  };
  saveState(state);
}

render();
