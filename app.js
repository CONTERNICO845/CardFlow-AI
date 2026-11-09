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
  setup: $("#setup-screen"), study: $("#study-screen"), summary: $("#summary-screen"), quickExam: $("#quick-exams-screen"),
  jsonInput: $("#json-input"), jsonFile: $("#json-file"), dataStatus: $("#data-status"),
  cardsPerRound: $("#cards-per-round"), secondsPerCard: $("#seconds-per-card"), timerEnabled: $("#timer-enabled"), breakEnabled: $("#break-enabled"),
  start: $("#start-session"), card: $("#flashcard"), front: $("#card-front-text"), back: $("#card-back-text"),
  progress: $("#progress-label"), progressBar: $("#progress-bar"), timerWrap: $("#timer-wrap"), timer: $("#timer-value"),
  toast: $("#toast"), scoreRing: $(".score-ring"),
  examBuilder: $("#exam-builder"), examWorkspace: $("#exam-workspace"), examPrompt: $("#exam-prompt"),
  examJson: $("#exam-json-input"), examJsonStatus: $("#exam-json-status"), examTitle: $("#exam-title"),
  examInstructions: $("#exam-instructions"), examParagraphs: $("#exam-paragraphs"), wordBank: $("#word-bank-words"),
  wordBankToggle: $("#word-bank-toggle"), examResults: $("#exam-results"), examScore: $("#exam-score"),
  examMistakes: $("#exam-mistakes"), tenseFeedback: $("#tense-feedback")
};

const themeToggle = $("#theme-toggle");

function applyTheme(isDark) {
  document.body.classList.toggle("dark-mode", isDark);
  themeToggle.setAttribute("aria-pressed", String(isDark));
  themeToggle.setAttribute("aria-label", isDark ? "Activar modo claro" : "Activar modo oscuro");
  themeToggle.querySelector(".theme-icon").textContent = isDark ? "☀" : "☾";
  themeToggle.querySelector(".theme-label").textContent = isDark ? "Modo claro" : "Modo oscuro";
}

function showScreen(name) {
  [els.setup, els.study, els.summary, els.quickExam].forEach((screen) => screen.classList.add("hidden"));
  els[name].classList.remove("hidden");
  const route = name === "quickExam" ? "quick-exams" : "flashcards";
  document.querySelectorAll(".nav-link").forEach((link) => {
    const isActive = link.dataset.route === route;
    link.classList.toggle("active", isActive);
    if (isActive) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function notify(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(notify.timeout);
  notify.timeout = window.setTimeout(() => els.toast.classList.remove("show"), 2800);
}

// Rutas de primer nivel. Añadir una nueva sección sólo requiere registrar su ruta y pantalla aquí.
const routes = {
  flashcards: "setup",
  "quick-exams": "quickExam"
};

function navigate(route) {
  const screen = routes[route];
  if (!screen) return;
  if (route === "flashcards") window.clearInterval(state.timerId);
  showScreen(screen);
}

const EXAM_DIFFICULTIES = {
  easy: { label: "Fácil", paragraphs: 2, blanks: 6 },
  medium: { label: "Medio", paragraphs: 3, blanks: 10 },
  hard: { label: "Difícil", paragraphs: 4, blanks: 14 }
};

const examState = { exam: null };

function selectedVerbTenses() {
  return Array.from($("#verb-tenses").selectedOptions).map((option) => option.value);
}

function currentExamDifficulty() {
  return document.querySelector('input[name="exam-difficulty"]:checked').value;
}

function buildExamPrompt() {
  const tenses = selectedVerbTenses();
  const difficulty = EXAM_DIFFICULTIES[currentExamDifficulty()];
  const tenseList = tenses.length ? tenses.join(", ") : "ninguno (selecciona al menos uno)";
  const schema = {
    version: "1.0",
    title: "English verb tenses practice",
    instructions: "Complete every blank with the correct form of the verb.",
    difficulty: difficulty.label,
    selectedTenses: ["Present Simple", "Past Simple"],
    paragraphs: [{
      id: "p1",
      text: "Every morning, Laura {{b1}} coffee. Last Saturday, she {{b2}} a new recipe.",
      questions: [
        { id: "b1", sentence: "Every morning, Laura ___ coffee.", baseForm: "make", correctAnswer: "makes", verbTense: "Present Simple" },
        { id: "b2", sentence: "Last Saturday, she ___ a new recipe.", baseForm: "try", correctAnswer: "tried", verbTense: "Past Simple" }
      ]
    }]
  };
  els.examPrompt.value = `Actúa como creador de exámenes de inglés. Genera un examen de completar espacios en blanco con exactamente ${difficulty.paragraphs} párrafos y ${difficulty.blanks} espacios. Dificultad: ${difficulty.label}.\n\nPractica únicamente estos tiempos verbales: ${tenseList}. Distribúyelos de forma equilibrada cuando sea posible.\n\nDevuelve EXCLUSIVAMENTE un objeto JSON válido, sin Markdown, comentarios ni texto antes o después. Debe cumplir exactamente estas reglas:\n- Usa la misma estructura y los mismos nombres de campos del ejemplo.\n- El campo \"difficulty\" debe ser exactamente \"${difficulty.label}\".\n- Cada párrafo debe incluir texto natural en inglés en \"text\" y los marcadores de sus espacios como {{id}}, por ejemplo {{b1}}.\n- Cada marcador debe aparecer una sola vez en el texto y debe tener una pregunta correspondiente en \"questions\".\n- Cada pregunta necesita un \"id\" único en todo el examen, una \"sentence\" completa con ___ en lugar del espacio, la \"baseForm\" en infinitivo (por ejemplo, \"be\"), la \"correctAnswer\" conjugada que completa el texto (por ejemplo, \"are\") y el \"verbTense\" usado.\n- \"selectedTenses\" debe reflejar sólo los tiempos usados.\n- No reveles las formas correctas en \"text\".\n\nFormato JSON esperado:\n${JSON.stringify(schema, null, 2)}`;
}

function normalizeAnswer(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function validateExam(raw) {
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error("El contenido no es JSON válido. Elimina cualquier texto o bloque Markdown de la respuesta de la IA."); }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("El examen debe ser un objeto JSON.");
  const supportedDifficulties = Object.values(EXAM_DIFFICULTIES).map((difficulty) => difficulty.label);
  if (!supportedDifficulties.includes(parsed.difficulty)) throw new Error("El examen debe incluir 'difficulty' con uno de estos valores: Fácil, Medio o Difícil.");
  if (!Array.isArray(parsed.paragraphs) || !parsed.paragraphs.length) throw new Error("El JSON necesita un arreglo 'paragraphs' con al menos un párrafo.");

  const usedIds = new Set();
  const paragraphs = parsed.paragraphs.map((paragraph, index) => {
    if (!paragraph || typeof paragraph.text !== "string" || !paragraph.text.trim()) throw new Error(`El párrafo ${index + 1} necesita un campo 'text'.`);
    if (!Array.isArray(paragraph.questions) || !paragraph.questions.length) throw new Error(`El párrafo ${index + 1} necesita preguntas en 'questions'.`);
    const questions = paragraph.questions.map((question, questionIndex) => {
      if (!question || typeof question.id !== "string" || !question.id.trim()) throw new Error(`La pregunta ${questionIndex + 1} del párrafo ${index + 1} no tiene un id válido.`);
      const id = question.id.trim();
      if (usedIds.has(id)) throw new Error(`El id '${id}' está repetido. Cada espacio debe tener un id único.`);
      if (typeof question.sentence !== "string" || !question.sentence.includes("___")) throw new Error(`La pregunta '${question.id}' necesita una oración con ___ para el espacio.`);
      if (typeof question.baseForm !== "string" || !question.baseForm.trim()) throw new Error(`La pregunta '${question.id}' necesita una forma base válida en 'baseForm'.`);
      if (typeof question.correctAnswer !== "string" || !question.correctAnswer.trim()) throw new Error(`La pregunta '${question.id}' necesita una respuesta conjugada válida en 'correctAnswer'.`);
      if (typeof question.verbTense !== "string" || !question.verbTense.trim()) throw new Error(`La pregunta '${question.id}' necesita indicar su tiempo verbal.`);
      const token = `{{${id}}}`;
      const appearances = paragraph.text.split(token).length - 1;
      if (appearances !== 1) throw new Error(`El marcador ${token} debe aparecer exactamente una vez en el texto del párrafo ${index + 1}.`);
      usedIds.add(id);
      return { id, sentence: question.sentence.trim(), baseForm: question.baseForm.trim(), correctAnswer: question.correctAnswer.trim(), verbTense: question.verbTense.trim() };
    });
    const unresolved = paragraph.text.match(/{{([^{}]+)}}/g) || [];
    if (unresolved.length !== questions.length) throw new Error(`El párrafo ${index + 1} contiene un marcador sin una pregunta asociada.`);
    return { id: typeof paragraph.id === "string" ? paragraph.id : `p${index + 1}`, text: paragraph.text.trim(), questions };
  });

  return {
    title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : "Completa los espacios",
    instructions: typeof parsed.instructions === "string" && parsed.instructions.trim() ? parsed.instructions.trim() : "Completa cada espacio con la forma correcta del verbo.",
    difficulty: parsed.difficulty,
    paragraphs
  };
}

function shuffled(items) {
  return shuffle(items);
}

function renderExam(exam) {
  examState.exam = exam;
  els.examTitle.textContent = exam.title;
  els.examInstructions.textContent = exam.instructions;
  els.examParagraphs.replaceChildren();
  const baseForms = [];

  exam.paragraphs.forEach((paragraph, paragraphIndex) => {
    const paragraphElement = document.createElement("p");
    paragraphElement.className = "exam-paragraph";
    const label = document.createElement("span");
    label.className = "exam-paragraph-label";
    label.textContent = `Párrafo ${paragraphIndex + 1}`;
    paragraphElement.append(label);
    const questionById = new Map(paragraph.questions.map((question) => [question.id, question]));
    const tokenPattern = /{{([^{}]+)}}/g;
    let lastIndex = 0;
    let match;
    while ((match = tokenPattern.exec(paragraph.text))) {
      paragraphElement.append(document.createTextNode(paragraph.text.slice(lastIndex, match.index)));
      const question = questionById.get(match[1]);
      const input = document.createElement("input");
      input.type = "text";
      input.className = "blank-input";
      input.dataset.questionId = question.id;
      input.autocomplete = "off";
      input.spellcheck = false;
      input.setAttribute("aria-label", `Respuesta para ${question.verbTense}: ${question.sentence}`);
      input.style.width = `${Math.max(88, Math.min(180, question.correctAnswer.length * 12 + 35))}px`;
      paragraphElement.append(input);
      if (exam.difficulty !== "Difícil") paragraphElement.append(document.createTextNode(` (${question.baseForm})`));
      lastIndex = tokenPattern.lastIndex;
    }
    paragraphElement.append(document.createTextNode(paragraph.text.slice(lastIndex)));
    els.examParagraphs.append(paragraphElement);
    baseForms.push(...paragraph.questions.map((question) => question.baseForm));
  });

  els.wordBank.replaceChildren();
  shuffled([...new Set(baseForms)]).forEach((baseForm) => {
    const chip = document.createElement("span");
    chip.className = "word-chip";
    chip.textContent = baseForm;
    els.wordBank.append(chip);
  });
  els.wordBankToggle.checked = false;
  els.wordBank.classList.add("hidden");
  els.examResults.classList.add("hidden");
  els.examBuilder.classList.add("hidden");
  els.examWorkspace.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function gradeExam() {
  if (!examState.exam) return;
  const questions = examState.exam.paragraphs.flatMap((paragraph) => paragraph.questions);
  const inputs = new Map(Array.from(document.querySelectorAll(".blank-input")).map((input) => [input.dataset.questionId, input]));
  const mistakes = [];
  questions.forEach((question) => {
    const input = inputs.get(question.id);
    const isCorrect = normalizeAnswer(input.value) === normalizeAnswer(question.correctAnswer);
    input.classList.toggle("correct", isCorrect);
    input.classList.toggle("incorrect", !isCorrect);
    if (!isCorrect) mistakes.push({ ...question, given: input.value.trim() });
  });
  const correct = questions.length - mistakes.length;
  els.examScore.textContent = `Resultado: ${correct} de ${questions.length} respuestas correctas (${Math.round((correct / questions.length) * 100)}%).`;
  els.examMistakes.replaceChildren();
  if (!mistakes.length) {
    const success = document.createElement("p");
    success.textContent = "¡Excelente! No hubo respuestas incorrectas. Has dominado los tiempos verbales de este examen.";
    els.examMistakes.append(success);
    els.tenseFeedback.textContent = "Siguiente paso: intenta otra dificultad o combina más tiempos verbales.";
  } else {
    const list = document.createElement("div");
    list.className = "mistake-list";
    mistakes.forEach((mistake) => {
      const item = document.createElement("article");
      item.className = "mistake";
      const given = document.createElement("div");
      const givenLabel = document.createElement("span");
      givenLabel.textContent = `Tu respuesta · ${mistake.verbTense}`;
      const givenValue = document.createElement("strong");
      givenValue.textContent = mistake.given || "Sin respuesta";
      given.append(givenLabel, givenValue);
      const expected = document.createElement("div");
      const expectedLabel = document.createElement("span");
      expectedLabel.textContent = "Respuesta correcta";
      const expectedValue = document.createElement("strong");
      expectedValue.textContent = mistake.correctAnswer;
      expected.append(expectedLabel, expectedValue);
      item.append(given, expected);
      list.append(item);
    });
    els.examMistakes.append(list);
    const tenseCounts = mistakes.reduce((counts, mistake) => {
      counts[mistake.verbTense] = (counts[mistake.verbTense] || 0) + 1;
      return counts;
    }, {});
    const focus = Object.entries(tenseCounts).sort((a, b) => b[1] - a[1]).map(([tense, count]) => `${tense} (${count})`).join(", ");
    els.tenseFeedback.replaceChildren();
    const heading = document.createElement("h3");
    heading.textContent = "Qué reforzar";
    const feedback = document.createElement("p");
    feedback.append("Te conviene practicar: ");
    const focusText = document.createElement("strong");
    focusText.textContent = focus;
    feedback.append(focusText, ". Revisa las oraciones marcadas y compara la forma verbal con el contexto de tiempo.");
    els.tenseFeedback.append(heading, feedback);
  }
  els.examResults.classList.remove("hidden");
  els.examResults.scrollIntoView({ behavior: "smooth", block: "start" });
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
document.querySelectorAll(".nav-link").forEach((link) => link.addEventListener("click", () => navigate(link.dataset.route)));
$(".app-logo").addEventListener("click", (event) => { event.preventDefault(); navigate("flashcards"); });

$("#verb-tenses").addEventListener("change", buildExamPrompt);
document.querySelectorAll('input[name="exam-difficulty"]').forEach((input) => input.addEventListener("change", buildExamPrompt));
$("#copy-exam-prompt").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(els.examPrompt.value); notify("Instrucción del examen copiada."); }
  catch { notify("Selecciona y copia manualmente la instrucción."); }
});
$("#load-exam").addEventListener("click", () => {
  try {
    const exam = validateExam(els.examJson.value);
    const blanks = exam.paragraphs.reduce((total, paragraph) => total + paragraph.questions.length, 0);
    els.examJsonStatus.textContent = `✓ Examen válido: ${exam.paragraphs.length} párrafo(s) y ${blanks} espacio(s).`;
    els.examJsonStatus.className = "data-status valid";
    renderExam(exam);
  } catch (error) {
    els.examJsonStatus.textContent = error.message;
    els.examJsonStatus.className = "data-status invalid";
    notify(error.message);
  }
});
$("#new-exam").addEventListener("click", () => {
  els.examWorkspace.classList.add("hidden");
  els.examBuilder.classList.remove("hidden");
  els.examJson.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
});
els.wordBankToggle.addEventListener("change", () => els.wordBank.classList.toggle("hidden", !els.wordBankToggle.checked));
$("#grade-exam").addEventListener("click", gradeExam);
themeToggle.addEventListener("click", () => {
  const willUseDarkMode = !document.body.classList.contains("dark-mode");
  applyTheme(willUseDarkMode);
  localStorage.setItem("cardflow-theme", willUseDarkMode ? "dark" : "light");
});
document.addEventListener("keydown", (event) => {
  if (els.study.classList.contains("hidden") || event.target.matches("input, textarea, select")) return;
  if (event.key === "ArrowLeft") answer("knew");
  if (event.key === "ArrowRight") answer("missed");
  if (event.key === "ArrowDown") { event.preventDefault(); answer("review"); }
});

setupDrag();
const savedTheme = localStorage.getItem("cardflow-theme");
applyTheme(savedTheme ? savedTheme === "dark" : true);
readCards({ quiet: true });
buildExamPrompt();
