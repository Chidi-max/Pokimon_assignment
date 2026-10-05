const PAGE_SIZE = 20;
const API = "https://pokeapi.co/api/v2/pokemon";

const TYPE_COLORS = {
  normal: "#a8a77a", fire: "#ee8130", water: "#6390f0", electric: "#f7d02c",
  grass: "#7ac74c", ice: "#96d9d6", fighting: "#c22e28", poison: "#a33ea1",
  ground: "#e2bf65", flying: "#a98ff3", psychic: "#f95587", bug: "#a6b91a",
  rock: "#b6a136", ghost: "#735797", dragon: "#6f35fc", dark: "#705746",
  steel: "#b7b7ce", fairy: "#d685ad"
};

const grid = document.getElementById("grid");
const statusEl = document.getElementById("status");
const searchInput = document.getElementById("search");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const pageInfo = document.getElementById("page-info");
const themeToggle = document.getElementById("theme-toggle");

// Theme: dark by default, remember the choice
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeToggle.setAttribute("aria-checked", theme === "dark");
  try {
    localStorage.setItem("theme", theme);
  } catch (e) {}
}

let savedTheme = "dark";
try {
  savedTheme = localStorage.getItem("theme") || "dark";
} catch (e) {}
applyTheme(savedTheme);

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
});

let offset = 0;
let totalCount = 0;
let loaded = [];        // details of the Pokémon on the current page
let allPokemon = [];    // every Pokémon name and url, fetched once
const detailsCache = new Map();
let searchToken = 0;
let searchTimer;

const pager = document.querySelector(".pager");

// Fetch the full name list once so search works across every page
const allPokemonPromise = fetch(`${API}?limit=100000&offset=0`)
  .then((res) => res.json())
  .then((data) => {
    allPokemon = data.results;
  })
  .catch((err) => console.error(err));

async function getDetails(url) {
  if (detailsCache.has(url)) return detailsCache.get(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Detail request failed");
  const data = await res.json();
  detailsCache.set(url, data);
  return data;
}

async function loadPage() {
  statusEl.textContent = "Loading Pokémon...";
  grid.innerHTML = "";
  prevBtn.disabled = true;
  nextBtn.disabled = true;

  try {
    const listRes = await fetch(`${API}?limit=${PAGE_SIZE}&offset=${offset}`);
    if (!listRes.ok) throw new Error("List request failed");
    const listData = await listRes.json();
    totalCount = listData.count;

    loaded = await Promise.all(listData.results.map((item) => getDetails(item.url)));

    searchInput.value = "";
    render(loaded);
    statusEl.textContent = "";
  } catch (err) {
    statusEl.textContent = "Oops, something went wrong. Please try again.";
    console.error(err);
  }

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pages = Math.ceil(totalCount / PAGE_SIZE) || 1;
  pageInfo.textContent = `Page ${page} of ${pages}`;
  prevBtn.disabled = offset === 0;
  nextBtn.disabled = offset + PAGE_SIZE >= totalCount;
}

function render(list) {
  grid.innerHTML = "";

  if (list.length === 0) {
    statusEl.textContent = "No Pokémon found.";
    return;
  }
  statusEl.textContent = "";

  list.forEach((p) => grid.appendChild(createCard(p)));
}

function createCard(p) {
  const mainType = p.types[0].type.name;
  const card = document.createElement("article");
  card.className = "card";
  card.style.setProperty("--type-color", TYPE_COLORS[mainType] || "#aaa");

  const img = document.createElement("img");
  img.src = p.sprites.other["official-artwork"].front_default || p.sprites.front_default;
  img.alt = p.name;
  img.loading = "lazy";

  const id = document.createElement("div");
  id.className = "id";
  id.textContent = `#${String(p.id).padStart(3, "0")}`;

  const name = document.createElement("h2");
  name.textContent = p.name;

  const types = document.createElement("div");
  types.className = "types";
  p.types.forEach((t) => {
    const span = document.createElement("span");
    span.className = "type";
    span.textContent = t.type.name;
    span.style.setProperty("--type-color", TYPE_COLORS[t.type.name] || "#aaa");
    types.appendChild(span);
  });

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = `Height ${p.height / 10} m, Weight ${p.weight / 10} kg`;

  const button = document.createElement("button");
  button.className = "info-btn";
  button.textContent = "Say hi";

  const message = document.createElement("p");
  message.className = "message";

  button.addEventListener("click", () => {
    const abilities = p.abilities.map((a) => a.ability.name).join(" and ");
    message.textContent = `I am ${p.name} and I have ${abilities}.`;
  });

  card.append(img, id, name, types, meta, button, message);
  return card;
}

async function runSearch() {
  const term = searchInput.value.trim().toLowerCase();
  const token = ++searchToken;

  // Empty search: go back to the normal page view
  if (term === "") {
    pager.style.display = "";
    render(loaded);
    return;
  }

  pager.style.display = "none";
  statusEl.textContent = "Searching...";

  await allPokemonPromise;
  if (token !== searchToken) return;

  const matches = allPokemon.filter((p) => p.name.includes(term));
  const shown = matches.slice(0, PAGE_SIZE);

  if (shown.length === 0) {
    grid.innerHTML = "";
    statusEl.textContent = "No Pokémon found.";
    return;
  }

  try {
    const results = await Promise.all(shown.map((p) => getDetails(p.url)));
    if (token !== searchToken) return;
    render(results);
    if (matches.length > PAGE_SIZE) {
      statusEl.textContent = `Showing the first ${PAGE_SIZE} of ${matches.length} matches. Type more to narrow it down.`;
    }
  } catch (err) {
    statusEl.textContent = "Oops, something went wrong. Please try again.";
    console.error(err);
  }
}

// Filter the name list already loaded, wait a moment after typing stops
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 250);
});

nextBtn.addEventListener("click", () => {
  offset += PAGE_SIZE;
  loadPage();
});

prevBtn.addEventListener("click", () => {
  offset = Math.max(0, offset - PAGE_SIZE);
  loadPage();
});

loadPage();