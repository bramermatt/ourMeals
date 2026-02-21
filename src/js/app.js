// OurMeals - Day 1 (single-file vanilla JS)

const STORAGE_KEY = "ourmeals_v1";

function initialState() {
  const now = new Date().toISOString();
  return {
    version: 1,
    meals: [],
    weekPlan: null,
    groceryList: [],
    settings: { avoidRepeats: true },
    meta: { createdAt: now, updatedAt: now },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw);

    // light sanity checks
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.meals)) {
      return initialState();
    }
    return parsed;
  } catch {
    return initialState();
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // if storage is full/blocked, app still works for the session
  }
}

function updateState(mutatorFn) {
  state = mutatorFn(state);
  state.meta.updatedAt = new Date().toISOString();
  saveState(state);
  render();
}

// --- UI ---
const stateView = document.getElementById("stateView");
const addSampleBtn = document.getElementById("addSample");
const resetBtn = document.getElementById("reset");

// Use crypto.randomUUID if available; fallback otherwise.
function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "id_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}

function render() {
  stateView.textContent = JSON.stringify(state, null, 2);
}

// --- Events ---
addSampleBtn.addEventListener("click", () => {
  updateState((s) => {
    const n = s.meals.length + 1;
    const meal = {
      id: uid(),
      name: `Sample Meal ${n}`,
      ingredients: ["ground beef", "tortillas", "cheese"],
    };
    return { ...s, meals: [meal, ...s.meals] };
  });
});

resetBtn.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  state = initialState();
  saveState(state);
  render();
});

// --- Boot ---
let state = loadState();
saveState(state); // ensures first run persists
render();