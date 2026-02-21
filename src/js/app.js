// OurMeals - V1 Day 4 (single-file vanilla JS)
// Adds: Grocery list generation + copy + persistence

const STORAGE_KEY = "ourmeals_v1";
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function initialState() {
  const now = new Date().toISOString();
  return {
    version: 1,
    meals: [],       // { id, name, ingredients[] }
    weekPlan: null,  // { days: [{ label, mealId }] }
    grocery: {
      items: [],     // { text, checked }
      generatedAt: null,
    },
    meta: { createdAt: now, updatedAt: now },
  };
}

function coerceState(parsed) {
  const base = initialState();
  if (!parsed || typeof parsed !== "object") return base;

  const meals = Array.isArray(parsed.meals) ? parsed.meals : [];
  const weekPlan = parsed.weekPlan && typeof parsed.weekPlan === "object" ? parsed.weekPlan : null;

  const grocery =
    parsed.grocery && typeof parsed.grocery === "object"
      ? {
          items: Array.isArray(parsed.grocery.items) ? parsed.grocery.items : [],
          generatedAt: parsed.grocery.generatedAt || null,
        }
      : base.grocery;

  const meta =
    parsed.meta && typeof parsed.meta === "object"
      ? { ...base.meta, ...parsed.meta }
      : base.meta;

  return { ...base, ...parsed, meals, weekPlan, grocery, meta };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    return coerceState(JSON.parse(raw));
  } catch {
    return initialState();
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "id_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}

let state = loadState();
saveState(state);

// ---- DOM ----
const mealForm = document.getElementById("mealForm");
const mealName = document.getElementById("mealName");
const mealIngredients = document.getElementById("mealIngredients");
const mealList = document.getElementById("mealList");
const mealCount = document.getElementById("mealCount");
const emptyHint = document.getElementById("emptyHint");
const seedBtn = document.getElementById("seedBtn");
const resetBtn = document.getElementById("resetBtn");
const searchInput = document.getElementById("search");

// modal
const modalBackdrop = document.getElementById("modalBackdrop");
const editModal = document.getElementById("editModal");
const closeModalBtn = document.getElementById("closeModal");
const editForm = document.getElementById("editForm");
const editName = document.getElementById("editName");
const editIngredients = document.getElementById("editIngredients");
const deleteFromModalBtn = document.getElementById("deleteFromModal");

// week plan
const generateWeekBtn = document.getElementById("generateWeekBtn");
const clearWeekBtn = document.getElementById("clearWeekBtn");
const weekList = document.getElementById("weekList");
const weekHint = document.getElementById("weekHint");

// grocery
const generateGroceryBtn = document.getElementById("generateGroceryBtn");
const clearGroceryBtn = document.getElementById("clearGroceryBtn");
const copyGroceryBtn = document.getElementById("copyGroceryBtn");
const groceryListEl = document.getElementById("groceryList");
const groceryHint = document.getElementById("groceryHint");

// ---- UI State ----
let searchTerm = "";
let editingMealId = null;

// ---- Helpers ----
function normalize(str) {
  return (str || "").toLowerCase().trim();
}

function mealMatches(meal, term) {
  if (!term) return true;
  const t = normalize(term);
  if (normalize(meal.name).includes(t)) return true;
  return meal.ingredients.some((ing) => normalize(ing).includes(t));
}

function findMealById(mealId) {
  return state.meals.find((m) => m.id === mealId) || null;
}

function shuffledCopy(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1200);
}

// ---- Render ----
function renderMeals() {
  const filtered = state.meals.filter((m) => mealMatches(m, searchTerm));
  mealCount.textContent = String(state.meals.length);
  mealList.innerHTML = "";

  const isEmpty = state.meals.length === 0;
  emptyHint.style.display = isEmpty ? "block" : "none";

  if (filtered.length === 0 && !isEmpty) {
    const li = document.createElement("li");
    li.innerHTML = `<div><div class="meal-title">No matches</div><div class="meal-ingredients">Try a different search.</div></div>`;
    mealList.appendChild(li);
    return;
  }

  for (const meal of filtered) {
    const li = document.createElement("li");

    const left = document.createElement("div");
    const title = document.createElement("div");
    title.className = "meal-title";
    title.textContent = meal.name;

    const ing = document.createElement("div");
    ing.className = "meal-ingredients";
    ing.textContent = meal.ingredients.join("\n");

    left.appendChild(title);
    if (meal.ingredients.length) left.appendChild(ing);

    const actions = document.createElement("div");
    actions.className = "row";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openEditModal(meal.id));

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.textContent = "Delete";
    delBtn.className = "danger";
    delBtn.addEventListener("click", () => deleteMeal(meal.id));

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    li.appendChild(left);
    li.appendChild(actions);

    mealList.appendChild(li);
  }
}

function renderWeek() {
  weekList.innerHTML = "";

  if (!state.weekPlan || !Array.isArray(state.weekPlan.days) || state.weekPlan.days.length !== 7) {
    weekHint.style.display = "block";
    clearWeekBtn.disabled = true;
    return;
  }

  weekHint.style.display = "none";
  clearWeekBtn.disabled = false;

  for (const day of state.weekPlan.days) {
    const li = document.createElement("li");

    const daySpan = document.createElement("span");
    daySpan.className = "day";
    daySpan.textContent = day.label + ":";

    const mealSpan = document.createElement("span");
    const meal = findMealById(day.mealId);
    if (meal) {
      mealSpan.className = "week-meal";
      mealSpan.textContent = meal.name;
    } else {
      mealSpan.className = "week-empty";
      mealSpan.textContent = "(missing meal)";
    }

    li.appendChild(daySpan);
    li.appendChild(mealSpan);
    weekList.appendChild(li);
  }
}

function renderGrocery() {
  groceryListEl.innerHTML = "";

  const hasWeek = state.weekPlan && Array.isArray(state.weekPlan.days) && state.weekPlan.days.length === 7;
  const hasItems = state.grocery.items.length > 0;

  groceryHint.style.display = hasWeek ? "none" : "block";

  copyGroceryBtn.disabled = !hasItems;
  clearGroceryBtn.disabled = !hasItems;
  generateGroceryBtn.disabled = !hasWeek;

  if (!hasItems) return;

  state.grocery.items.forEach((it, idx) => {
    const li = document.createElement("li");

    const label = document.createElement("label");

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!it.checked;
    cb.addEventListener("change", () => toggleGroceryItem(idx, cb.checked));

    const span = document.createElement("span");
    span.className = "item";
    span.textContent = it.text;

    label.appendChild(cb);
    label.appendChild(span);

    li.appendChild(label);
    groceryListEl.appendChild(li);
  });
}

function render() {
  renderMeals();
  renderWeek();
  renderGrocery();
}

// ---- Mutations ----
function commit(nextState) {
  state = nextState;
  state.meta.updatedAt = new Date().toISOString();
  saveState(state);
  render();
}

function addMeal(name, ingredientsLines) {
  const trimmedName = name.trim();
  if (!trimmedName) return;

  const ingredients = ingredientsLines.map((x) => x.trim()).filter(Boolean);
  const meal = { id: uid(), name: trimmedName, ingredients };
  commit({ ...state, meals: [meal, ...state.meals] });
}

function deleteMeal(id) {
  if (editingMealId === id) closeModal();
  commit({ ...state, meals: state.meals.filter((m) => m.id !== id) });
}

function updateMeal(id, updates) {
  const nextMeals = state.meals.map((m) => (m.id !== id ? m : { ...m, ...updates }));
  commit({ ...state, meals: nextMeals });
}

function seedMeals() {
  const samples = [
    { name: "Tacos", ingredients: ["tortillas", "ground beef", "cheese", "lettuce"] },
    { name: "Spaghetti", ingredients: ["pasta", "marinara", "parmesan"] },
    { name: "Stir Fry", ingredients: ["chicken", "soy sauce", "rice", "mixed veggies"] },
    { name: "Burgers", ingredients: ["buns", "ground beef", "cheese", "pickles"] },
    { name: "Quesadillas", ingredients: ["tortillas", "cheese", "chicken (optional)"] },
    { name: "Pizza Night", ingredients: ["pizza", "salad kit"] },
    { name: "Breakfast for Dinner", ingredients: ["eggs", "bacon", "pancake mix"] },
  ];
  const newMeals = samples.map((s) => ({ id: uid(), name: s.name, ingredients: s.ingredients }));
  commit({ ...state, meals: [...newMeals, ...state.meals] });
}

function resetAll() {
  localStorage.removeItem(STORAGE_KEY);
  state = initialState();
  saveState(state);
  searchTerm = "";
  searchInput.value = "";
  closeModal();
  render();
}

// ---- Planner ----
function generateWeekPlan() {
  if (state.meals.length === 0) return;

  const mealIds = state.meals.map((m) => m.id);
  const shuffled = shuffledCopy(mealIds);

  let chosen = [];
  if (shuffled.length >= 7) {
    chosen = shuffled.slice(0, 7);
  } else {
    while (chosen.length < 7) {
      for (const id of shuffled) {
        chosen.push(id);
        if (chosen.length === 7) break;
      }
    }
  }

  const days = DAYS.map((label, idx) => ({ label, mealId: chosen[idx] }));
  commit({ ...state, weekPlan: { days } });
}

function clearWeekPlan() {
  commit({ ...state, weekPlan: null });
}

// ---- Grocery generation ----
function canonicalIngredient(s) {
  // basic normalization for V1
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

function titleCase(s) {
  // keep it simple: capitalize first letter only
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function generateGroceryList() {
  if (!state.weekPlan || !Array.isArray(state.weekPlan.days) || state.weekPlan.days.length !== 7) return;

  const counts = new Map(); // key -> count
  const original = new Map(); // key -> representative display string

  for (const day of state.weekPlan.days) {
    const meal = findMealById(day.mealId);
    if (!meal) continue;

    for (const ing of meal.ingredients) {
      const key = canonicalIngredient(ing);
      if (!key) continue;

      counts.set(key, (counts.get(key) || 0) + 1);
      if (!original.has(key)) original.set(key, ing.trim());
    }
  }

  const items = Array.from(counts.keys())
    .sort((a, b) => a.localeCompare(b))
    .map((key) => {
      const display = original.get(key) || key;
      const n = counts.get(key) || 1;
      const text = n > 1 ? `${titleCase(display)} (x${n})` : titleCase(display);
      return { text, checked: false };
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
  commit({ ...state, grocery: { items: [], generatedAt: null } });
}

function toggleGroceryItem(index, checked) {
  const next = state.grocery.items.map((it, i) => (i === index ? { ...it, checked } : it));
  commit({ ...state, grocery: { ...state.grocery, items: next } });
}

async function copyGroceryList() {
  if (!state.grocery.items.length) return;

  // plain text works great for Apple Reminders / Google Keep paste
  const text = state.grocery.items
    .map((it) => `- ${it.text}`)
    .join("\n");

  try {
    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard");
  } catch {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    toast("Copied");
  }
}

// ---- Modal ----
function openEditModal(mealId) {
  const meal = state.meals.find((m) => m.id === mealId);
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

  const ingredients = editIngredients.value
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  updateMeal(editingMealId, { name, ingredients });
  closeModal();
}

modalBackdrop.addEventListener("click", closeModal);
closeModalBtn.addEventListener("click", closeModal);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

// ---- Events ----
mealForm.addEventListener("submit", (e) => {
  e.preventDefault();
  addMeal(mealName.value, mealIngredients.value.split("\n"));
  mealName.value = "";
  mealIngredients.value = "";
  mealName.focus();
});

seedBtn.addEventListener("click", seedMeals);
resetBtn.addEventListener("click", resetAll);

searchInput.addEventListener("input", (e) => {
  searchTerm = e.target.value;
  render();
});

editForm.addEventListener("submit", (e) => { e.preventDefault(); saveEdits(); });
deleteFromModalBtn.addEventListener("click", () => { if (editingMealId) deleteMeal(editingMealId); });

generateWeekBtn.addEventListener("click", generateWeekPlan);
clearWeekBtn.addEventListener("click", clearWeekPlan);

generateGroceryBtn.addEventListener("click", generateGroceryList);
clearGroceryBtn.addEventListener("click", clearGroceryList);
copyGroceryBtn.addEventListener("click", copyGroceryList);

// ---- Boot ----
render();