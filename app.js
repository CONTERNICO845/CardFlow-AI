/* CardFlow AI — aplicación estática, sin dependencias y apta para GitHub Pages. */
const $ = (selector) => document.querySelector(selector);

const state = {
  allCards: [],
  round: [],
  index: 0,
  results: { knew: [], review: [], missed: [] },
  timerId: null,
  secondsLeft: 0,
  pointerStart: null,
  dragging: false,
  isAnimating: false,
  reviewOnly: false
};

const els = {
  setup: $("#setup-screen"), study: $("#study-screen"), summary: $("#summary-screen"),
  jsonInput: $("#json-input"), jsonFile: $("#json-file"), dataStatus: $("#data-status"),
  cardsPerRound: $("#cards-per-round"), secondsPerCard: $("#seconds-per-card"), timerEnabled: $("#timer-enabled"), breakEnabled: $("#break-enabled"),
  start: $("#start-session"), card: $("#flashcard"), front: $("#card-front-text"), back: $("#card-back-text"),
  progress: $("#progress-label"), progressBar: $("#progress-bar"), timerWrap: $("#timer-wrap"), timer: $("#timer-value"),
  toast: $("#toast"), scoreRing: $(".score-ring")
};

function showScreen(name) {
  [els.setup, els.study, els.summary].forEach((screen) => screen.classList.add("hidden"));
  els[name].classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function notify(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(notify.timeout);
  notify.timeout = window.setTimeout(() => els.toast.classList.remove("show"), 2800);
}

function validateCards(raw) {
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error("El contenido no es JSON válido. Revisa comillas, llaves y comas."); }
  if (!Array.isArray(parsed)) throw new Error("El JSON debe ser un arreglo: [ { \"front\": \"...\", \"back\": \"...\" } ].");
  const cards = parsed
    .filter((item) => item && typeof item.front === "string" && typeof item.back === "string")
    .map((item) => ({ front: item.front.trim(), back: item.back.trim() }))
    .filter((item) => item.front && item.back);
  if (!cards.length) throw new Error("No encontré tarjetas válidas con las claves front y back.");
  return cards;
}

function readCards({ quiet = false } = {}) {
  try {
    state.allCards = validateCards(els.jsonInput.value);
    els.dataStatus.textContent = `✓ ${state.allCards.length} tarjeta${state.allCards.length === 1 ? "" : "s"} lista${state.allCards.length === 1 ? "" : "s"}.`;
    els.dataStatus.className = "data-status valid";
    return state.allCards;
  } catch (error) {
    state.allCards = [];
    els.dataStatus.textContent = error.message;
    els.dataStatus.className = "data-status invalid";
    if (!quiet) notify(error.message);
    return null;
  }
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function startRound(cards = null, reviewOnly = false) {
  const source = cards || readCards();
  if (!source?.length) return;
  const amount = Math.max(1, Number.parseInt(els.cardsPerRound.value, 10) || 1);
  state.round = shuffle(source).slice(0, Math.min(amount, source.length));
  state.index = 0;
  state.results = { knew: [], review: [], missed: [] };
  state.reviewOnly = reviewOnly;
  showScreen("study");
  renderCard();
}

function renderCard() {
  const card = state.round[state.index];
  if (!card) return finishRound();
  state.isAnimating = false;
  els.card.className = "flashcard";
  els.front.textContent = card.front;
  els.back.textContent = card.back;
  const current = state.index + 1;
  els.progress.textContent = `Tarjeta ${current} de ${state.round.length}`;
  els.progressBar.style.width = `${((current - 1) / state.round.length) * 100}%`;
  startTimer();
}

function flipCard() {
  if (state.isAnimating) return;
  els.card.classList.toggle("flipped");
}

function startTimer() {
  window.clearInterval(state.timerId);
  if (!els.timerEnabled.checked) {
    els.timerWrap.classList.add("hidden");
    return;
  }
  els.timerWrap.classList.remove("hidden", "warning");
  state.secondsLeft = Math.max(1, Number.parseInt(els.secondsPerCard.value, 10) || 15);
  updateTimer();
  state.timerId = window.setInterval(() => {
    state.secondsLeft -= 1;
    updateTimer();
    if (state.secondsLeft <= 0) {
      window.clearInterval(state.timerId);
      notify("Tiempo agotado: esta tarjeta irá a repaso.");
      answer("review");
    }
  }, 1000);
}

function updateTimer() {
  els.timer.textContent = state.secondsLeft;
  els.timerWrap.classList.toggle("warning", state.secondsLeft <= 5);
}

function answer(result) {
  if (state.isAnimating || !state.round[state.index]) return;
  state.isAnimating = true;
  window.clearInterval(state.timerId);
  const animation = { knew: "swipe-left", missed: "swipe-right", review: "swipe-down" }[result];
  els.card.classList.remove("dragging");
  els.card.classList.add(animation);
  const stamp = result === "knew" ? "#swipe-yes" : result === "missed" ? "#swipe-no" : "#swipe-review";
  $(stamp).style.display = "block";
  window.setTimeout(() => {
    state.results[result].push(state.round[state.index]);
    state.index += 1;
    $(stamp).style.display = "";
    renderCard();
  }, 260);
}

function finishRound() {
  window.clearInterval(state.timerId);
  els.progressBar.style.width = "100%";
  const total = state.round.length;
  const knew = state.results.knew.length;
  const percent = total ? Math.round((knew / total) * 100) : 0;
  $("#score-percent").textContent = `${percent}%`;
  els.scoreRing.style.setProperty("--score", `${percent}%`);
  $("#knew-count").textContent = knew;
  $("#review-count").textContent = state.results.review.length;
  $("#missed-count").textContent = state.results.missed.length;
  const pending = state.results.review.length + state.results.missed.length;
  $("#summary-copy").textContent = pending ? `Has dejado ${pending} tarjeta${pending === 1 ? "" : "s"} para consolidar.` : "¡Dominaste todas las tarjetas de esta ronda!";
  $("#review-weak").classList.toggle("hidden", pending === 0);
  showScreen("summary");
  const breakSeconds = Number(els.breakEnabled.value);
  if (breakSeconds && !state.reviewOnly) notify(`Descanso sugerido: ${breakSeconds >= 60 ? `${breakSeconds / 60} minuto(s)` : `${breakSeconds} segundos`}.`);
}

function setupDrag() {
  const threshold = 90;
  els.card.addEventListener("pointerdown", (event) => {
    if (state.isAnimating) return;
    state.pointerStart = { x: event.clientX, y: event.clientY };
    state.dragging = false;
    els.card.setPointerCapture?.(event.pointerId);
  });
  els.card.addEventListener("pointermove", (event) => {
    if (!state.pointerStart || state.isAnimating) return;
    const dx = event.clientX - state.pointerStart.x;
    const dy = event.clientY - state.pointerStart.y;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) state.dragging = true;
    if (!state.dragging) return;
    const rotation = Math.max(-13, Math.min(13, dx / 14));
    els.card.classList.add("dragging");
    els.card.style.transform = `translate(${dx}px, ${Math.max(0, dy)}px) rotate(${rotation}deg)`;
    $("#swipe-yes").style.display = dx < -35 ? "block" : "";
    $("#swipe-no").style.display = dx > 35 ? "block" : "";
    $("#swipe-review").style.display = dy > 35 && Math.abs(dx) < 50 ? "block" : "";
  });
  function release(event) {
    if (!state.pointerStart || state.isAnimating) return;
    const dx = event.clientX - state.pointerStart.x;
    const dy = event.clientY - state.pointerStart.y;
    const wasDrag = state.dragging;
    state.pointerStart = null;
    els.card.style.transform = "";
    els.card.classList.remove("dragging");
    ["#swipe-yes", "#swipe-no", "#swipe-review"].forEach((id) => { $(id).style.display = ""; });
    if (!wasDrag) { flipCard(); return; }
    if (dy > threshold && Math.abs(dx) < threshold) answer("review");
    else if (dx < -threshold) answer("knew");
    else if (dx > threshold) answer("missed");
  }
  els.card.addEventListener("pointerup", release);
  els.card.addEventListener("pointercancel", release);
  els.card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); flipCard(); }
  });
}

function loadFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { els.jsonInput.value = reader.result; readCards(); };
  reader.onerror = () => notify("No se pudo leer el archivo seleccionado.");
  reader.readAsText(file, "UTF-8");
}

document.querySelectorAll(".source-tab").forEach((tab) => tab.addEventListener("click", () => {
  document.querySelectorAll(".source-tab").forEach((button) => { button.classList.toggle("active", button === tab); button.setAttribute("aria-selected", button === tab ? "true" : "false"); });
  $("#paste-source").classList.toggle("hidden", tab.dataset.source !== "paste");
  $("#file-source").classList.toggle("hidden", tab.dataset.source !== "file");
}));

els.jsonInput.addEventListener("input", () => readCards({ quiet: true }));
els.jsonFile.addEventListener("change", (event) => loadFile(event.target.files[0]));
const dropZone = $(".file-drop");
["dragenter", "dragover"].forEach((event) => dropZone.addEventListener(event, (e) => { e.preventDefault(); dropZone.classList.add("dragover"); }));
["dragleave", "drop"].forEach((event) => dropZone.addEventListener(event, (e) => { e.preventDefault(); dropZone.classList.remove("dragover"); }));
dropZone.addEventListener("drop", (event) => loadFile(event.dataTransfer.files[0]));
$("#load-sample").addEventListener("click", async () => {
  try { const response = await fetch("sample.json"); els.jsonInput.value = await response.text(); readCards(); notify("Tarjetas de ejemplo cargadas."); }
  catch { notify("No se pudo cargar el ejemplo. Abre el sitio desde un servidor o GitHub Pages."); }
});
$("#copy-prompt").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText($("#ai-prompt").textContent); notify("Mini-prompt copiado."); }
  catch { notify("Selecciona y copia manualmente el mini-prompt."); }
});
els.start.addEventListener("click", () => startRound());
$("#exit-session").addEventListener("click", () => { window.clearInterval(state.timerId); showScreen("setup"); });
document.querySelectorAll(".answer-btn").forEach((button) => button.addEventListener("click", () => answer(button.dataset.result)));
$("#new-session").addEventListener("click", () => showScreen("setup"));
$("#review-weak").addEventListener("click", () => startRound([...state.results.review, ...state.results.missed], true));
document.addEventListener("keydown", (event) => {
  if (els.study.classList.contains("hidden") || event.target.matches("input, textarea, select")) return;
  if (event.key === "ArrowLeft") answer("knew");
  if (event.key === "ArrowRight") answer("missed");
  if (event.key === "ArrowDown") { event.preventDefault(); answer("review"); }
});

setupDrag();
readCards({ quiet: true });
