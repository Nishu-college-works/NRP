/* MoodReel — mood & vibe movie picker · OMDb API + localStorage watchlist */
const API_KEY = "https://www.omdbapi.com/?i=tt3896198&apikey=f67e6bec"; // free key: https://www.omdbapi.com/apikey.aspx
const API = "https://www.omdbapi.com/";
const FALLBACK = "data:image/svg+xml," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750"><rect width="100%" height="100%" fill="#1e293b"/><text x="50%" y="50%" fill="#64748b" font-family="monospace" font-size="26" text-anchor="middle">NO POSTER</text></svg>'
);
const VIBES = {
  action: { label: "Action",       keys: ["mission", "hero", "war"] },
  fun:    { label: "Fun / Light",  keys: ["comedy", "love", "party"] },
  mind:   { label: "Mind-Bending", keys: ["space", "time", "matrix"] },
  chill:  { label: "Chilling",     keys: ["ghost", "haunt", "nightmare"] },
};

const $ = (s) => document.querySelector(s);
const grid = $("#grid"), statusEl = $("#status"), sectionTitle = $("#section-title");
const dialog = $("#modal"), wlToggle = $("#wl-toggle"), wlCount = $("#wl-count");
const cache = new Map();
const state = { vibe: "action", view: "discover" };
let current = null;

const omdb = async (params) => (await fetch(`${API}?apikey=${API_KEY}${params}`)).json();
const posterOf = (m) => (m.Poster && m.Poster !== "N/A" ? m.Poster : FALLBACK);

/* ---------- Watchlist helpers (localStorage) ---------- */
const getWL = () => JSON.parse(localStorage.getItem("moodreel") || "[]");
const inWL = (id) => getWL().some((m) => m.imdbID === id);
const slim = (m) => ({ imdbID: m.imdbID, Title: m.Title, Year: m.Year, Poster: m.Poster });
const syncCount = () => (wlCount.textContent = getWL().length);

function toggleWL(movie) {
  const list = inWL(movie.imdbID) ? getWL().filter((m) => m.imdbID !== movie.imdbID) : [...getWL(), slim(movie)];
  localStorage.setItem("moodreel", JSON.stringify(list));
  syncCount();
  if (state.view === "watchlist") return showWatchlist();
  grid.querySelectorAll(`.card[data-id="${movie.imdbID}"] [data-wl]`).forEach((b) => updateBtn(b, movie.imdbID));
  if (dialog.open && current?.imdbID === movie.imdbID) updateBtn($("#m-save"), movie.imdbID);
}

/* ---------- Rendering ---------- */
function updateBtn(btn, id) {
  const saved = inWL(id);
  btn.classList.toggle("saved", saved || state.view === "watchlist");
  btn.textContent = state.view === "watchlist" ? "✕ Remove" : saved ? "✓ Saved" : "+ Watchlist";
}

function cardHTML(m, i) {
  return `<article class="card" data-id="${m.imdbID}" style="animation-delay:${i * 45}ms">
    <img src="${posterOf(m)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK}'">
    <span class="rating" data-rating>★ …</span>
    <div class="card-body">
      <h3>${m.Title}</h3>
      <p class="year">${m.Year}</p>
      <button class="wl-btn" data-wl>+ Watchlist</button>
    </div>
  </article>`;
}

function paintCards(movies) {
  movies.forEach((m) => cache.set(m.imdbID, m));
  grid.innerHTML = movies.length ? movies.map(cardHTML).join("")
    : '<p class="empty">Nothing here yet — hit "+ Watchlist" on any movie. 🎬</p>';
  grid.querySelectorAll("[data-wl]").forEach((b) => updateBtn(b, b.closest(".card").dataset.id));
  if (movies.length) movies.forEach((m) => hydrateRating(m.imdbID));
}

async function hydrateRating(id) {
  const badge = grid.querySelector(`.card[data-id="${id}"] [data-rating]`);
  if (!badge) return;
  if (cache.get(id)?.imdbRating) { badge.textContent = "★ " + cache.get(id).imdbRating; return; }
  try {
    const d = await omdb("&i=" + id);
    if (d.Response !== "True") throw 0;
    cache.set(id, { ...cache.get(id), ...d });
    badge.textContent = "★ " + d.imdbRating;
  } catch { badge.textContent = "★ –"; }
}

async function showDiscover() {
  state.view = "discover";
  wlToggle.classList.remove("active");
  const vibe = VIBES[state.vibe];
  const kw = vibe.keys[Math.floor(Math.random() * vibe.keys.length)];
  const page = 1 + Math.floor(Math.random() * 3);
  sectionTitle.textContent = "Tonight's vibe: " + vibe.label;
  statusEl.textContent = `Scanning the reels for "${kw}"…`;
  grid.innerHTML = "";
  try {
    const data = await omdb(`&s=${encodeURIComponent(kw)}&type=movie&page=${page}`);
    if (data.Response !== "True") throw data.Error;
    paintCards(data.Search.filter((m) => m.Type === "movie"));
    statusEl.textContent = `Matched "${kw}" · page ${page} of ${Math.ceil(data.totalResults / 10)}`;
  } catch (err) {
    statusEl.textContent = API_KEY.includes("YOUR_")
      ? "⚠ Paste your free OMDb API key at the top of script.js"
      : "⚠ " + (err || "Could not reach OMDb — try again.");
  }
}

function showWatchlist() {
  state.view = "watchlist";
  wlToggle.classList.add("active");
  sectionTitle.textContent = "Your Watchlist";
  statusEl.textContent = "";
  paintCards(getWL());
}

/* ---------- Modal + Surprise Me ---------- */
function openModal(m) {
  current = m;
  $("#m-poster").src = posterOf(m);
  $("#m-title").textContent = m.Title;
  $("#m-meta").textContent = (m.Year || "TBA") + " · ★ …";
  $("#m-overview").textContent = m.Plot || "Rolling the details…";
  updateBtn($("#m-save"), m.imdbID);
  dialog.showModal();
  enrichModal(m.imdbID);
}

async function enrichModal(id) {
  try {
    const d = cache.get(id)?.Plot ? cache.get(id) : await omdb("&i=" + id + "&plot=full");
    if (!d || d.Response !== "True") throw 0;
    cache.set(id, { ...cache.get(id), ...d });
    if (current?.imdbID !== id || !dialog.open) return;
    $("#m-meta").textContent = `${d.Year} · ★ ${d.imdbRating} / 10 · ${d.Genre}`;
    $("#m-overview").textContent = !d.Plot || d.Plot === "N/A" ? "No plot on file for this one yet." : d.Plot;
    const badge = grid.querySelector(`.card[data-id="${id}"] [data-rating]`);
    if (badge) badge.textContent = "★ " + d.imdbRating;
  } catch { $("#m-overview").textContent = "Could not load details for this one."; }
}

async function surprise() {
  statusEl.textContent = "🎲 Rolling the dice…";
  try {
    const { keys } = VIBES[state.vibe];
    const kw = keys[Math.floor(Math.random() * keys.length)];
    const page = 1 + Math.floor(Math.random() * 5);
    const data = await omdb(`&s=${encodeURIComponent(kw)}&type=movie&page=${page}`);
    if (data.Response !== "True") throw data.Error;
    const pick = data.Search[Math.floor(Math.random() * data.Search.length)];
    if (!pick) throw "No results on that roll";
    openModal(pick);
    statusEl.textContent = "";
  } catch (err) {
    statusEl.textContent = "⚠ The dice slipped — " + (err || "try again.");
  }
}

/* ---------- Events ---------- */
$("#vibes").addEventListener("click", (e) => {
  const btn = e.target.closest(".vibe");
  if (!btn) return;
  document.querySelectorAll(".vibe").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  state.vibe = btn.dataset.vibe;
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
  const movie = cache.get(card.dataset.id);
  if (!movie) return;
  if (e.target.closest("[data-wl]")) return toggleWL(movie);
  openModal(movie);
});

syncCount();
showDiscover();
