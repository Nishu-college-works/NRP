/* MoodReel — TMDb Edition */
const API_KEY = "YOUR_TMDB_API_KEY_HERE"; // Get free key at themoviedb.org/settings/api
const API = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/w500";
const FALLBACK = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750"><rect width="100%" height="100%" fill="#1e293b"/><text x="50%" y="50%" fill="#64748b" font-family="monospace" font-size="26" text-anchor="middle">NO POSTER</text></svg>');
const VIBES = { 28: "Action", 35: "Fun / Light", 878: "Mind-Bending", 27: "Chilling" };

const $ = (s) => document.querySelector(s);
const grid = $("#grid"), statusEl = $("#status"), sectionTitle = $("#section-title");
const dialog = $("#modal"), wlToggle = $("#wl-toggle"), wlCount = $("#wl-count");
const state = { genre: 28, view: "discover" };
let current = null;

const getWL = () => JSON.parse(localStorage.getItem("moodreel") || "[]");
const inWL = (id) => getWL().some((m) => m.id === id);
const slim = (m) => ({ id: m.id, title: m.title, release_date: m.release_date, vote_average: m.vote_average, poster_path: m.poster_path, overview: m.overview });
const syncCount = () => (wlCount.textContent = getWL().length);

function toggleWL(movie) {
  const list = inWL(movie.id) ? getWL().filter((m) => m.id !== movie.id) : [...getWL(), slim(movie)];
  localStorage.setItem("moodreel", JSON.stringify(list));
  syncCount();
  if (state.view === "watchlist") return showWatchlist();
  grid.querySelectorAll(`.card[data-id="${movie.id}"] [data-wl]`).forEach((b) => updateBtn(b, movie.id));
  if (dialog.open && current?.id === movie.id) updateBtn($("#m-save"), movie.id);
}

function updateBtn(btn, id) {
  const saved = inWL(id);
  btn.classList.toggle("saved", saved || state.view === "watchlist");
  btn.textContent = state.view === "watchlist" ? "✕ Remove" : saved ? "✓ Saved" : "+ Watchlist";
}

function cardHTML(m, i) {
  const year = (m.release_date || "").slice(0, 4) || "TBA";
  const src = m.poster_path ? IMG + m.poster_path : FALLBACK;
  return `<article class="card" data-id="${m.id}" style="animation-delay:${i * 45}ms">
    <img src="${src}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK}'">
    <span class="rating">★ ${Number(m.vote_average || 0).toFixed(1)}</span>
    <div class="card-body">
      <h3>${m.title}</h3><p class="year">${year}</p>
      <button class="wl-btn" data-wl>+ Watchlist</button>
    </div>
  </article>`;
}

function paintCards(movies) {
  grid.innerHTML = movies.length ? movies.map(cardHTML).join("") : '<p class="empty">Nothing here yet — hit "+ Watchlist" on any movie. 🎬</p>';
  grid.querySelectorAll("[data-wl]").forEach((b) => updateBtn(b, +b.closest(".card").dataset.id));
}

async function fetchDiscover(genreId, page = 1) {
  const url = `${API}/discover/movie?api_key=${API_KEY}&with_genres=${genreId}&sort_by=popularity.desc&vote_count.gte=300&with_original_language=en&page=${page}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("API Error");
  const data = await res.json();
  return data.results.filter((m) => m.title);
}

async function showDiscover() {
  state.view = "discover";
  wlToggle.classList.remove("active");
  sectionTitle.textContent = "Tonight's vibe: " + VIBES[state.genre];
  statusEl.textContent = "Scanning the reels…";
  grid.innerHTML = "";
  try {
    const movies = await fetchDiscover(state.genre);
    paintCards(movies);
    statusEl.textContent = "";
  } catch {
    statusEl.textContent = API_KEY.includes("YOUR_") ? "⚠ Paste your free TMDb API key at the top of script.js" : "⚠ Could not reach TMDb.";
  }
}

function showWatchlist() {
  state.view = "watchlist";
  wlToggle.classList.add("active");
  sectionTitle.textContent = "Your Watchlist";
  statusEl.textContent = "";
  paintCards(getWL());
}

function openModal(m) {
  current = m;
  $("#m-poster").src = m.poster_path ? IMG + m.poster_path : FALLBACK;
  $("#m-title").textContent = m.title;
  $("#m-meta").textContent = `${(m.release_date || "").slice(0, 4) || "TBA"}  ·  ★ ${Number(m.vote_average || 0).toFixed(1)} / 10`;
  $("#m-overview").textContent = (m.overview || "").trim() || "No overview on file for this one yet.";
  updateBtn($("#m-save"), m.id);
  dialog.showModal();
}

async function surprise() {
  statusEl.textContent = "🎲 Rolling the dice…";
  try {
    const page = 1 + Math.floor(Math.random() * 3);
    const movies = await fetchDiscover(state.genre, page);
    const pick = movies[Math.floor(Math.random() * movies.length)];
    if (!pick) throw new Error("empty pool");
    openModal(pick);
    statusEl.textContent = "";
  } catch { statusEl.textContent = "⚠ The dice slipped — check your API key."; }
}

$("#vibes").addEventListener("click", (e) => {
  const btn = e.target.closest(".vibe");
  if (!btn) return;
  document.querySelectorAll(".vibe").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  state.genre = +btn.dataset.genre;
  showDiscover();
});

$("#find").addEventListener("click", showDiscover);
$("#surprise").addEventListener("click", surprise);
wlToggle.addEventListener("click", () => (state.view === "watchlist" ? showDiscover() : showWatchlist()));
$("#m-close").addEventListener("click", () => dialog.close());
$("#m-save").addEventListener("click", () => current && toggleWL(current));
dialog.addEventListener("click", (e) => e.target === dialog && dialog.close());

grid.addEventListener("click", (e) => {
  const card = e.target.closest(".card");
  if (!card) return;
  const id = +card.dataset.id;
  const movie = state.view === "watchlist" ? getWL().find(m => m.id === id) : JSON.parse(sessionStorage.getItem(`movie_${id}`) || "null");
  
  // Fallback for caching if sessionStorage isn't used, we just grab from DOM or state
  const title = card.querySelector("h3").textContent;
  const year = card.querySelector(".year").textContent;
  const rating = parseFloat(card.querySelector(".rating").textContent.replace("★ ", ""));
  const poster = card.querySelector("img").src;
  
  const fallbackMovie = { id, title, release_date: year, vote_average: rating, poster_path: poster.replace(IMG, ""), overview: "Click 'Find Movies' to load full details." };
  
  if (e.target.closest("[data-wl]")) return toggleWL(movie || fallbackMovie);
  openModal(movie || fallbackMovie);
});

syncCount();
showDiscover();
