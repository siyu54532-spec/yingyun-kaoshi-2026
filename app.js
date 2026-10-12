(() => {
  const bank = window.QUESTION_BANK || [];
  const byId = new Map(bank.map(question => [question.id, question]));
  const chapters = [...new Set(bank.map(question => question.chapter))];
  const storageKey = "operations-exam-2026-v1";
  const app = document.getElementById("app");
  const headerStatus = document.getElementById("header-status");
  const setup = { chapters: new Set(chapters), type: "all", count: 20 };
  let session = loadSession();
  let reviewFilter = "wrong";
  let navOpen = false;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function shuffled(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function optionOrder() {
    const order = shuffled([0, 1, 2, 3]);
    if (order.every((index, position) => index === position)) [order[0], order[1]] = [order[1], order[0]];
    return order;
  }

  function saveSession() {
    try { localStorage.setItem(storageKey, JSON.stringify(session)); } catch (_) { /* Local file storage may be unavailable. */ }
  }

  function loadSession() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (!saved || !["exam", "result"].includes(saved.stage) || !Array.isArray(saved.questions) || !saved.questions.length) return null;
      if (!saved.questions.every(item => byId.has(item.id) && Array.isArray(item.order) && item.order.length === 4 && new Set(item.order).size === 4 && item.order.every(index => Number.isInteger(index) && index >= 0 && index < 4))) return null;
      if (!saved.responses || typeof saved.responses !== "object") saved.responses = {};
      saved.current = Math.max(0, Math.min(saved.questions.length - 1, Number(saved.current) || 0));
      return saved;
    } catch (_) { return null; }
  }

  function clearSession() {
    session = null;
    try { localStorage.removeItem(storageKey); } catch (_) { /* Ignore unavailable storage. */ }
  }

  function availableQuestions() {
    return bank.filter(question => setup.chapters.has(question.chapter) && (setup.type === "all" || question.type === setup.type));
  }

  function selectedCount() {
    const available = availableQuestions().length;
    return setup.count === "all" ? available : Math.min(setup.count, available);
  }

  function renderSetup() {
    headerStatus.textContent = `${bank.length} 道题 · ${chapters.length} 个章节`;
    const chapterRows = chapters.map(chapter => {
      const count = bank.filter(question => question.chapter === chapter).length;
      return `<label class="chapter-row"><input type="checkbox" data-chapter="${escapeHtml(chapter)}" ${setup.chapters.has(chapter) ? "checked" : ""}><span class="chapter-name">${escapeHtml(chapter)}</span><span class="chapter-count">${count} 题</span></label>`;
    }).join("");
    app.innerHTML = `<div class="setup-view">
      <p class="eyebrow">2026 · 营运大部</p><h1>考试题库</h1>
      <p class="intro">覆盖员工行为、营业员管理、顾客投诉、租金收缴及营业额入账五个章节。</p>
      <div class="stats-strip"><div class="stat"><strong>${bank.length}</strong><span>题目总数</span></div><div class="stat"><strong>${bank.filter(q => q.type === "single").length}</strong><span>单选题</span></div><div class="stat"><strong>${bank.filter(q => q.type === "multiple").length}</strong><span>多选题</span></div></div>
      <div class="setup-grid"><section><div class="section-heading"><h2>考试章节</h2><small>选择至少一章</small></div><div class="chapter-list">${chapterRows}</div></section>
      <section class="settings-panel"><div class="control-group"><h2>题目类型</h2><div class="segmented" role="group" aria-label="题目类型">${[["all","全部"],["single","单选"],["multiple","多选"]].map(([value,label]) => `<button type="button" data-type="${value}" class="${setup.type === value ? "active" : ""}" aria-pressed="${setup.type === value}">${label}</button>`).join("")}</div></div>
      <div class="control-group"><h2>考试题量</h2><div class="count-grid" role="group" aria-label="考试题量">${[[10,"10题"],[20,"20题"],[50,"50题"],["all","全部"]].map(([value,label]) => `<button type="button" data-count="${value}" class="${setup.count === value ? "active" : ""}" aria-pressed="${setup.count === value}">${label}</button>`).join("")}</div></div>
      <div class="selection-summary"><span>当前题池 ${availableQuestions().length} 题</span><strong>本次 ${selectedCount()} 题</strong></div>
      <button type="button" class="primary-button wide" id="start-exam" ${selectedCount() ? "" : "disabled"}>开始考试</button>
      ${selectedCount() ? "" : '<p class="empty-note">当前筛选没有可用题目，请调整章节或题型。</p>'}
      </section></div></div>`;
    app.querySelectorAll("[data-chapter]").forEach(input => input.addEventListener("change", () => {
      if (input.checked) setup.chapters.add(input.dataset.chapter);
      else setup.chapters.delete(input.dataset.chapter);
      renderSetup();
    }));
    app.querySelectorAll("[data-type]").forEach(button => button.addEventListener("click", () => { setup.type = button.dataset.type; renderSetup(); }));
    app.querySelectorAll("[data-count]").forEach(button => button.addEventListener("click", () => { setup.count = button.dataset.count === "all" ? "all" : Number(button.dataset.count); renderSetup(); }));
    app.querySelector("#start-exam").addEventListener("click", () => startExam());
  }

  function startExam(questionIds) {
    const pool = questionIds ? questionIds.map(id => byId.get(id)).filter(Boolean) : availableQuestions();
    const count = questionIds ? pool.length : selectedCount();
    if (!count) return;
    session = {
      stage: "exam",
      questions: shuffled(pool).slice(0, count).map(question => ({ id: question.id, order: optionOrder() })),
      responses: {}, current: 0, startedAt: Date.now()
    };
    navOpen = false;
    saveSession();
    renderExam();
    window.scrollTo(0, 0);
  }

  function responseFor(id) {
    const selected = session.responses[id];
    return Array.isArray(selected) ? selected : [];
  }

  function answeredCount() {
    return session.questions.filter(item => responseFor(item.id).length > 0).length;
  }

  function renderExam() {
    const total = session.questions.length;
    const item = session.questions[session.current];
    const question = byId.get(item.id);
    const selected = responseFor(item.id);
    const answered = answeredCount();
    headerStatus.textContent = `考试中 · 已答 ${answered}/${total}`;
    app.innerHTML = `<div class="exam-view">
      <div class="exam-heading"><div><p class="eyebrow">模拟考试</p><h1>营运测评</h1><p>已答 ${answered} / ${total} 题</p></div><button type="button" class="text-button" id="abandon-exam">结束本次考试</button></div>
      <div class="progress-track" role="progressbar" aria-valuenow="${answered}" aria-valuemin="0" aria-valuemax="${total}" aria-label="答题进度"><div class="progress-fill" style="width:${answered / total * 100}%"></div></div>
      <div class="exam-layout"><aside class="navigator ${navOpen ? "open" : ""}"><button class="nav-toggle" type="button" id="nav-toggle">题目导航</button><div class="navigator-content"><div class="nav-head"><h2>题目导航</h2><span>${answered}/${total} 已答</span></div><div class="number-grid">${session.questions.map((entry, index) => `<button type="button" data-go="${index}" class="${responseFor(entry.id).length ? "answered" : ""} ${session.current === index ? "current" : ""}" aria-label="第${index + 1}题${responseFor(entry.id).length ? "，已答" : "，未答"}" ${session.current === index ? 'aria-current="step"' : ""}>${index + 1}</button>`).join("")}</div><div class="nav-legend"><span><i class="done"></i>已答</span><span><i></i>未答</span></div></div></aside>
      <section class="question-panel" aria-label="当前题目"><div class="question-meta"><span class="type-tag ${question.type === "multiple" ? "multi" : ""}">${question.type === "single" ? "单选题" : "多选题"}</span><span>${escapeHtml(question.chapter)}</span><span class="question-index">${session.current + 1} / ${total}</span></div>
      <h2 class="question-stem">${escapeHtml(question.stem)}</h2><div class="options" role="group" aria-label="答案选项">${item.order.map((originalIndex, displayIndex) => `<button type="button" class="option-button ${selected.includes(originalIndex) ? "selected" : ""}" data-option="${originalIndex}" aria-pressed="${selected.includes(originalIndex)}"><span class="option-letter">${String.fromCharCode(65 + displayIndex)}</span><span class="option-text">${escapeHtml(question.options[originalIndex])}</span></button>`).join("")}</div>
      <div class="question-actions"><button type="button" class="secondary-button" id="previous" ${session.current === 0 ? "disabled" : ""}>上一题</button><div class="action-right"><button type="button" class="secondary-button" id="next" ${session.current === total - 1 ? "disabled" : ""}>下一题</button><button type="button" class="primary-button" id="submit">交卷</button></div></div></section></div></div>`;
    app.querySelectorAll("[data-option]").forEach(button => button.addEventListener("click", () => {
      const index = Number(button.dataset.option);
      session.responses[item.id] = question.type === "single" ? [index] : selected.includes(index) ? selected.filter(value => value !== index) : [...selected, index];
      saveSession();
      renderExam();
    }));
    app.querySelectorAll("[data-go]").forEach(button => button.addEventListener("click", () => goTo(Number(button.dataset.go))));
    app.querySelector("#nav-toggle").addEventListener("click", () => { navOpen = !navOpen; app.querySelector(".navigator").classList.toggle("open", navOpen); });
    app.querySelector("#previous").addEventListener("click", () => goTo(session.current - 1));
    app.querySelector("#next").addEventListener("click", () => goTo(session.current + 1));
    app.querySelector("#submit").addEventListener("click", submitExam);
    app.querySelector("#abandon-exam").addEventListener("click", () => {
      if (window.confirm("结束本次考试？当前作答将被清除。")) { clearSession(); renderSetup(); window.scrollTo(0, 0); }
    });
  }

  function goTo(index) {
    if (index < 0 || index >= session.questions.length) return;
    session.current = index;
    saveSession();
    renderExam();
    window.scrollTo(0, 0);
  }

  function isCorrect(item) {
    const selected = responseFor(item.id);
    const answer = byId.get(item.id).answer.map(letter => letter.charCodeAt(0) - 65);
    return selected.length === answer.length && selected.every(index => answer.includes(index));
  }

  function submitExam() {
    const unanswered = session.questions.length - answeredCount();
    if (unanswered && !window.confirm(`还有 ${unanswered} 题未作答，确定交卷吗？`)) return;
    session.stage = "result";
    session.submittedAt = Date.now();
    saveSession();
    reviewFilter = "wrong";
    renderResult();
    window.scrollTo(0, 0);
  }

  function renderReviewCard(item, index) {
    const question = byId.get(item.id);
    const selected = responseFor(item.id);
    const answers = question.answer.map(letter => letter.charCodeAt(0) - 65);
    const correct = isCorrect(item);
    const status = selected.length ? (correct ? "正确" : "错误") : "未答";
    return `<article class="review-card"><div class="review-top"><span class="review-status ${correct ? "correct" : ""}">${status}</span><span>第 ${index + 1} 题</span><span>${question.type === "single" ? "单选" : "多选"}</span><span>${escapeHtml(question.chapter)}</span></div>
      <h3>${escapeHtml(question.stem)}</h3><ul class="review-options">${item.order.map((originalIndex, displayIndex) => `<li class="${answers.includes(originalIndex) ? "answer" : selected.includes(originalIndex) ? "wrong-choice" : ""}"><b>${String.fromCharCode(65 + displayIndex)}.</b><span>${escapeHtml(question.options[originalIndex])}${answers.includes(originalIndex) ? " · 正确答案" : selected.includes(originalIndex) ? " · 你的选择" : ""}</span></li>`).join("")}</ul></article>`;
  }

  function renderResult() {
    const total = session.questions.length;
    const correct = session.questions.filter(isCorrect).length;
    const wrong = session.questions.filter(item => !isCorrect(item));
    const unanswered = session.questions.filter(item => !responseFor(item.id).length).length;
    const singleCorrect = session.questions.filter(item => byId.get(item.id).type === "single" && isCorrect(item)).length;
    const multiCorrect = session.questions.filter(item => byId.get(item.id).type === "multiple" && isCorrect(item)).length;
    const singleTotal = session.questions.filter(item => byId.get(item.id).type === "single").length;
    const multiTotal = total - singleTotal;
    const minutes = Math.max(1, Math.ceil(((session.submittedAt || Date.now()) - session.startedAt) / 60000));
    headerStatus.textContent = `本次成绩 · ${correct}/${total} 题正确`;
    const shown = reviewFilter === "wrong" ? wrong : session.questions;
    app.innerHTML = `<div class="result-view"><p class="eyebrow">考试结果</p><div class="result-header"><div><h1>本次考试已完成</h1><p>答对 ${correct} 题，共 ${total} 题</p></div><div class="score"><strong>${Math.round(correct / total * 100)}</strong><span>分</span></div></div>
      <div class="result-summary"><div class="stat"><strong>${singleCorrect}/${singleTotal}</strong><span>单选正确</span></div><div class="stat"><strong>${multiCorrect}/${multiTotal}</strong><span>多选正确</span></div><div class="stat"><strong>${unanswered}</strong><span>未作答</span></div><div class="stat"><strong>${minutes}<small style="font-size:14px"> 分钟</small></strong><span>答题用时</span></div></div>
      <div class="result-actions"><button type="button" class="primary-button" id="new-exam">新建考试</button><button type="button" class="secondary-button" id="retry-wrong" ${wrong.length ? "" : "disabled"}>重做错题（${wrong.length}）</button></div>
      <div class="review-toolbar"><h2>答题回顾</h2><div class="segmented" role="group" aria-label="回顾范围"><button type="button" data-review="wrong" class="${reviewFilter === "wrong" ? "active" : ""}" aria-pressed="${reviewFilter === "wrong"}">错题 ${wrong.length}</button><button type="button" data-review="all" class="${reviewFilter === "all" ? "active" : ""}" aria-pressed="${reviewFilter === "all"}">全部 ${total}</button></div></div>
      <div class="review-list">${shown.length ? shown.map(item => renderReviewCard(item, session.questions.indexOf(item))).join("") : '<div class="empty-review">本次没有错题。</div>'}</div></div>`;
    app.querySelector("#new-exam").addEventListener("click", () => { clearSession(); renderSetup(); window.scrollTo(0, 0); });
    app.querySelector("#retry-wrong").addEventListener("click", () => startExam(wrong.map(item => item.id)));
    app.querySelectorAll("[data-review]").forEach(button => button.addEventListener("click", () => { reviewFilter = button.dataset.review; renderResult(); }));
  }

  if (!bank.length) {
    app.innerHTML = '<p class="empty-note">题库加载失败，请确认 questions.js 与本页面位于同一文件夹。</p>';
  } else if (session?.stage === "exam") renderExam();
  else if (session?.stage === "result") renderResult();
  else renderSetup();
})();
