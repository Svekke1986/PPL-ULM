(function () {
  'use strict';

  const BANK = window.QUESTION_BANK || {};
  const SUBJECTS = window.SUBJECTS;
  const LICENCES = window.LICENCES;
  const app = document.getElementById('app');
  const LETTERS = ['A', 'B', 'C', 'D'];

  // ---------- helpers ----------
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shuffle = arr => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem('pplulm.' + key); return v ? JSON.parse(v) : fallback; }
      catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('pplulm.' + key, JSON.stringify(value)); } catch (e) { /* ignore */ }
    }
  };
  const fmtTime = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  function questionsFor(licence, subject) {
    return (BANK[subject] || []).filter(q => q.lic.includes(licence));
  }
  function licenceSubjects(licence) {
    return Object.keys(LICENCES[licence].exams);
  }
  function stats(licence, subject) {
    return store.get(`stats.${licence}.${subject}`, { answered: 0, correct: 0 });
  }
  function addStat(licence, subject, ok) {
    const s = stats(licence, subject);
    s.answered++; if (ok) s.correct++;
    store.set(`stats.${licence}.${subject}`, s);
  }

  // Present options in random order (like the real exam) while remembering the correct one.
  function present(q) {
    const order = shuffle([0, 1, 2, 3]);
    return Object.assign({}, q, { o: order.map(i => q.o[i]), c: order.indexOf(q.c) });
  }

  function sourceHtml(q) {
    const s = window.resolveSource(q.src);
    const ref = q.ref ? ` — <em>${esc(q.ref)}</em>` : '';
    const lo = q.lo ? `<div class="small">ECQB-leerdoel ${esc(q.lo)}${q.loText ? ': ' + esc(q.loText) : ''}</div>` : '';
    return `<div class="source">📘 Bron: <strong>${esc(s.org)}</strong> – <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>${ref}${lo}</div>`;
  }

  function feedbackHtml(q, chosen) {
    const ok = chosen === q.c;
    const head = ok
      ? '✅ Juist!'
      : `❌ Fout – het juiste antwoord is ${LETTERS[q.c]}: ${esc(q.o[q.c])}`;
    const whyWrong = ok ? '' :
      `<p><strong>Jouw antwoord (${LETTERS[chosen]})</strong> is niet correct. Waarom het juiste antwoord klopt:</p>`;
    const review = q.review
      ? '<div class="review">⚠️ Let op: over deze vraag bestaat twijfel tussen het antwoord in de voorbeeldvragen en de officiële regelgeving. Controleer de bron.</div>'
      : '';
    const ai = q.ai
      ? '<div class="review">🤖 Deze vraag is door AI gegenereerd en niet gecontroleerd. De uitleg en de bronverwijzing kunnen fouten bevatten.</div>'
      : '';
    return `<div class="feedback ${ok ? 'ok' : 'bad'}">
      <h3>${head}</h3>
      ${whyWrong}
      <p>${esc(q.e || 'Geen uitleg beschikbaar.')}</p>
      ${review}${ai}
      ${sourceHtml(q)}
    </div>`;
  }

  function questionHtml(q, opts) {
    const imgs = (q.img || []).map(src => `<img src="${esc(src)}" alt="Bijlage bij de vraag" loading="lazy">`).join('');
    const options = q.o.map((text, i) => {
      let cls = 'option';
      if (opts.reveal) {
        if (i === q.c) cls += ' correct';
        else if (i === opts.chosen) cls += ' wrong';
      } else if (i === opts.chosen) cls += ' selected';
      return `<button class="${cls}" data-i="${i}" ${opts.locked ? 'disabled' : ''}>
        <span class="letter">${LETTERS[i]}</span><span>${esc(text)}</span></button>`;
    }).join('');
    return `<div class="q-meta"><span>${opts.counter || ''}</span><span>${q.ai ? '<span class="badge badge-ai">AI-gegenereerd</span>' : (q.lo ? 'ECQB ' + esc(q.lo) : '')}</span></div>
      <p class="q-text">${esc(q.q)}</p>
      ${imgs ? `<div class="q-images">${imgs}</div>` : ''}
      <div class="options">${options}</div>`;
  }

  // ---------- views ----------
  function viewHome() {
    const count = l => Object.keys(LICENCES[l].exams).reduce((n, s) => n + questionsFor(l, s).length, 0);
    app.innerHTML = `
      <h1>Oefen je PPL- of ULM-theorie</h1>
      <p class="lead">Kies je opleiding, daarna het vak. Je kunt onbeperkt oefenen met directe feedback, of een proefexamen afleggen met hetzelfde aantal vragen en dezelfde tijd als op het examen.</p>
      <div class="notice"><strong>Dit is geen officieel platform.</strong> Het is niet verbonden aan EASA, de BCAA of het DGLV.
        Slagen op deze website geeft <strong>geen garantie</strong> dat je slaagt voor het echte theorie-examen.</div>
      <div class="grid grid-2">
        <a class="card licence-card" href="#/ppl">
          <div class="big">🛩️</div>
          <h2>PPL(A)</h2>
          <p class="muted">${esc(LICENCES.PPL.full)}<br>9 vakken · ${count('PPL')} vragen in de databank</p>
        </a>
        <a class="card licence-card" href="#/ulm">
          <div class="big">🪂</div>
          <h2>ULM</h2>
          <p class="muted">${esc(LICENCES.ULM.full)}<br>4 vakken · ${count('ULM')} vragen in de databank</p>
        </a>
      </div>`;
  }

  function viewLicence(licence) {
    const L = LICENCES[licence];
    const ai = window.AI.available();
    const cards = licenceSubjects(licence).map(key => {
      const S = SUBJECTS[key];
      const n = questionsFor(licence, key).length;
      const ex = L.exams[key];
      const st = stats(licence, key);
      const pct = st.answered ? Math.round(100 * st.correct / st.answered) : 0;
      const canPractice = n > 0 || ai;
      return `<div class="card subject-card">
        <div class="subject-head">
          <div class="subject-icon">${S.icon}</div>
          <div><h3>${esc(S.code)} · ${esc(S.name)}</h3><div class="subject-meta">${esc(S.en)}</div></div>
        </div>
        <div class="subject-meta">${n} vragen in de databank · examen: ${ex.questions} vragen / ${ex.minutes} min</div>
        ${st.answered ? `<div class="subject-meta">Jouw score: ${st.correct}/${st.answered} (${pct}%)</div><div class="progress"><span style="width:${pct}%"></span></div>` : ''}
        ${n === 0 ? `<div class="subject-meta">${ai ? 'Nog geen vragen in de databank: oefenen gebeurt met AI-vragen.' : 'Nog geen vragen in de databank.'}</div>` : ''}
        <div class="btn-row">
          <a class="btn btn-primary" href="#/${licence.toLowerCase()}/${key}/oefenen" ${canPractice ? '' : 'aria-disabled="true" onclick="return false" style="opacity:.5;pointer-events:none"'}>Oefenen</a>
          <a class="btn btn-accent" href="#/${licence.toLowerCase()}/${key}/examen" ${n ? '' : 'aria-disabled="true" onclick="return false" style="opacity:.5;pointer-events:none"'}>Proefexamen</a>
        </div>
      </div>`;
    }).join('');
    const passTxt = L.passRule === 'total'
      ? `Je moet minimaal ${L.passMark}% halen over de vier vakken samen.`
      : `Je moet minimaal ${L.passMark}% halen per vak.`;
    const pass = window.resolveSource(L.passSource);
    const exSrc = window.resolveSource(L.examSource);
    app.innerHTML = `
      <div class="crumbs"><a href="#/">Home</a> › ${esc(L.name)}</div>
      <h1>${esc(L.name)}</h1>
      <p class="lead">${esc(L.full)}. ${passTxt}
        <span class="small">(<a href="${esc(pass.url)}" target="_blank" rel="noopener">${esc(L.passRef)}</a>)</span></p>
      ${L.examVerified ? '' : `<div class="notice">ℹ️ Het aantal vragen en de examentijd per vak voor de PPL zijn een richtwaarde. Controleer de actuele waarden bij de <a href="${esc(exSrc.url)}" target="_blank" rel="noopener">BCAA</a> (BCAA/AltMoC/FCL/2022-01).</div>`}
      <div class="grid grid-3">${cards}</div>`;
  }

  // ---------- practice ----------
  let practice = null;

  function viewPractice(licence, subject) {
    const pool = questionsFor(licence, subject);
    if (!pool.length && !window.AI.available()) { location.hash = '#/' + licence.toLowerCase(); return; }
    const deckKey = `deck.${licence}.${subject}`;
    practice = { licence, subject, pool, deckKey, q: null, chosen: null, session: { answered: 0, correct: 0 }, count: 0 };
    nextPractice();
  }

  function drawFromDeck() {
    const P = practice;
    const ids = new Set(P.pool.map(q => q.id));
    let deck = store.get(P.deckKey, []).filter(id => ids.has(id));
    if (!deck.length) deck = shuffle([...ids]);
    const id = deck.shift();
    store.set(P.deckKey, deck);
    return P.pool.find(q => q.id === id);
  }

  async function nextPractice(forceAI) {
    const P = practice;
    P.chosen = null;
    P.count++;
    const ai = window.AI.available();
    const useAI = ai && (forceAI || !P.pool.length || (window.AI.settings().mix && P.count % 3 === 0));
    if (useAI) {
      renderPracticeLoading();
      try {
        const examples = shuffle(P.pool.length ? P.pool : Object.values(BANK).flat()).slice(0, 3);
        P.q = present(await window.AI.generate(P.licence, P.subject, examples));
      } catch (err) {
        if (!P.pool.length) { renderPracticeError(err); return; }
        P.q = present(drawFromDeck());
        P.aiError = err.message;
      }
    } else {
      P.q = present(drawFromDeck());
    }
    renderPractice();
  }

  function practiceHeader() {
    const P = practice;
    const S = SUBJECTS[P.subject];
    const ai = window.AI.available();
    return `<div class="crumbs"><a href="#/">Home</a> › <a href="#/${P.licence.toLowerCase()}">${esc(LICENCES[P.licence].name)}</a> › ${esc(S.name)}</div>
      <div class="quiz-head">
        <div><h1>${S.icon} ${esc(S.name)}</h1><div class="muted small">Oefenmodus · ${P.pool.length} vragen in de databank${ai ? ' · AI-vragen aan' : ''}</div></div>
        <span class="score-pill">Sessie: ${P.session.correct}/${P.session.answered}</span>
      </div>`;
  }

  function renderPracticeLoading() {
    app.innerHTML = practiceHeader() + `<div class="card"><span class="spinner"></span> Nieuwe vraag wordt gegenereerd…</div>`;
  }
  function renderPracticeError(err) {
    app.innerHTML = practiceHeader() + `<div class="card"><div class="feedback bad"><h3>Kon geen vraag genereren</h3><p>${esc(err.message)}</p></div>
      <div class="quiz-actions"><a class="btn" href="#/instellingen">Instellingen</a><button class="btn btn-primary" id="retry">Opnieuw proberen</button></div></div>`;
    document.getElementById('retry').onclick = () => nextPractice(true);
  }

  function renderPractice() {
    const P = practice;
    const answered = P.chosen !== null;
    const aiBtn = window.AI.available() && P.pool.length ? '<button class="btn" id="ai-q">✨ AI-vraag</button>' : '';
    app.innerHTML = practiceHeader() + `
      ${P.aiError ? `<div class="notice">AI-vraag mislukt (${esc(P.aiError)}). Er werd een vraag uit de databank getoond.</div>` : ''}
      <div class="card">
        ${questionHtml(P.q, { chosen: P.chosen, reveal: answered, locked: answered, counter: `Vraag ${P.count}` })}
        ${answered ? feedbackHtml(P.q, P.chosen) : ''}
        <div class="quiz-actions">
          <a class="btn" href="#/${P.licence.toLowerCase()}">← Vakken</a>
          <div class="btn-row">${aiBtn}<button class="btn btn-primary" id="next">${answered ? 'Volgende vraag →' : 'Overslaan →'}</button></div>
        </div>
      </div>`;
    P.aiError = null;
    app.querySelectorAll('.option').forEach(b => b.onclick = () => {
      if (P.chosen !== null) return;
      P.chosen = +b.dataset.i;
      const ok = P.chosen === P.q.c;
      P.session.answered++; if (ok) P.session.correct++;
      if (!P.q.ai) addStat(P.licence, P.subject, ok);
      renderPractice();
      app.querySelector('.feedback')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    document.getElementById('next').onclick = () => nextPractice();
    const ai = document.getElementById('ai-q');
    if (ai) ai.onclick = () => nextPractice(true);
    bindImages();
  }

  // ---------- exam ----------
  let exam = null;

  function viewExamIntro(licence, subject) {
    const L = LICENCES[licence], S = SUBJECTS[subject], ex = L.exams[subject];
    const pool = questionsFor(licence, subject);
    const n = Math.min(ex.questions, pool.length);
    const short = pool.length < ex.questions;
    const minutes = short ? Math.max(1, Math.round(ex.minutes * n / ex.questions)) : ex.minutes;
    app.innerHTML = `
      <div class="crumbs"><a href="#/">Home</a> › <a href="#/${licence.toLowerCase()}">${esc(L.name)}</a> › ${esc(S.name)} › Proefexamen</div>
      <div class="card">
        <h1>${S.icon} Proefexamen ${esc(S.name)}</h1>
        <p class="lead">${esc(L.name)} · ${ex.questions} vragen · ${ex.minutes} minuten · geslaagd vanaf ${L.passMark}%${L.passRule === 'total' ? ' (op het echte ULM-examen geldt dit over de 4 vakken samen)' : ''}</p>
        ${short ? `<div class="notice">De databank bevat voor dit vak nog maar ${pool.length} vragen. Dit proefexamen telt daarom ${n} vragen en ${minutes} minuten (in verhouding).</div>` : ''}
        <ul class="muted">
          <li>Tijdens het examen zie je nog niet of je antwoord juist is, net zoals op het echte examen.</li>
          <li>Je kunt vragen markeren en terugkeren tot je inlevert.</li>
          <li>Na het inleveren of als de tijd om is, krijg je je score en de uitleg bij elke vraag.</li>
        </ul>
        <div class="btn-row"><a class="btn" href="#/${licence.toLowerCase()}">Annuleren</a><button class="btn btn-accent" id="start">▶ Start proefexamen</button></div>
      </div>`;
    document.getElementById('start').onclick = () => startExam(licence, subject, n, minutes);
  }

  function startExam(licence, subject, n, minutes) {
    stopTimer();
    const questions = shuffle(questionsFor(licence, subject)).slice(0, n).map(present);
    exam = { licence, subject, questions, answers: Array(n).fill(null), flags: Array(n).fill(false), i: 0, remaining: minutes * 60, done: false };
    exam.timer = setInterval(() => {
      exam.remaining--;
      const t = document.getElementById('timer');
      if (t) { t.textContent = fmtTime(Math.max(0, exam.remaining)); t.classList.toggle('low', exam.remaining <= 60); }
      if (exam.remaining <= 0) finishExam(true);
    }, 1000);
    renderExam();
  }

  function stopTimer() { if (exam && exam.timer) { clearInterval(exam.timer); exam.timer = null; } }

  function renderExam() {
    const E = exam, q = E.questions[E.i], S = SUBJECTS[E.subject];
    const answeredCount = E.answers.filter(a => a !== null).length;
    const nav = E.questions.map((_, k) => {
      const cls = [E.answers[k] !== null ? 'answered' : '', k === E.i ? 'current' : '', E.flags[k] ? 'flagged' : ''].join(' ');
      return `<button class="${cls}" data-k="${k}" title="Vraag ${k + 1}">${k + 1}</button>`;
    }).join('');
    app.innerHTML = `
      <div class="quiz-head">
        <div><h1>${S.icon} Proefexamen ${esc(S.name)}</h1><div class="muted small">${esc(LICENCES[E.licence].name)} · ${answeredCount}/${E.questions.length} beantwoord</div></div>
        <div class="timer ${E.remaining <= 60 ? 'low' : ''}" id="timer" aria-label="Resterende tijd">${fmtTime(E.remaining)}</div>
      </div>
      <div class="card">
        ${questionHtml(q, { chosen: E.answers[E.i], reveal: false, locked: false, counter: `Vraag ${E.i + 1} van ${E.questions.length}` })}
        <div class="quiz-actions">
          <div class="btn-row">
            <button class="btn" id="prev" ${E.i === 0 ? 'disabled' : ''}>← Vorige</button>
            <button class="btn" id="flag">${E.flags[E.i] ? '🚩 Gemarkeerd' : '🏳️ Markeer'}</button>
          </div>
          <div class="btn-row">
            ${E.i < E.questions.length - 1 ? '<button class="btn btn-primary" id="next">Volgende →</button>' : ''}
            <button class="btn btn-accent" id="submit">Inleveren</button>
          </div>
        </div>
        <div class="navgrid">${nav}</div>
      </div>`;
    app.querySelectorAll('.option').forEach(b => b.onclick = () => { E.answers[E.i] = +b.dataset.i; renderExam(); });
    app.querySelectorAll('.navgrid button').forEach(b => b.onclick = () => { E.i = +b.dataset.k; renderExam(); });
    document.getElementById('prev').onclick = () => { if (E.i > 0) { E.i--; renderExam(); } };
    const next = document.getElementById('next');
    if (next) next.onclick = () => { E.i++; renderExam(); };
    document.getElementById('flag').onclick = () => { E.flags[E.i] = !E.flags[E.i]; renderExam(); };
    document.getElementById('submit').onclick = () => {
      const open = E.answers.filter(a => a === null).length;
      if (confirm(open ? `Je hebt nog ${open} vraag/vragen niet beantwoord. Toch inleveren?` : 'Examen inleveren?')) finishExam(false);
    };
    bindImages();
  }

  function finishExam(timeUp) {
    const E = exam;
    if (!E || E.done) return;
    E.done = true;
    stopTimer();
    const L = LICENCES[E.licence];
    const correct = E.questions.reduce((n, q, k) => n + (E.answers[k] === q.c ? 1 : 0), 0);
    const pct = Math.round(100 * correct / E.questions.length);
    const passed = pct >= L.passMark;
    E.questions.forEach((q, k) => { if (E.answers[k] !== null) addStat(E.licence, E.subject, E.answers[k] === q.c); });
    const history = store.get(`exams.${E.licence}.${E.subject}`, []);
    history.unshift({ date: new Date().toISOString(), correct, total: E.questions.length });
    store.set(`exams.${E.licence}.${E.subject}`, history.slice(0, 20));

    const reviews = E.questions.map((q, k) => {
      const a = E.answers[k];
      const body = a === null
        ? `<div class="feedback bad"><h3>⏺ Niet beantwoord – het juiste antwoord is ${LETTERS[q.c]}: ${esc(q.o[q.c])}</h3><p>${esc(q.e)}</p>${sourceHtml(q)}</div>`
        : feedbackHtml(q, a);
      return `<div class="card review-item" id="r${k}">${questionHtml(q, { chosen: a, reveal: true, locked: true, counter: `Vraag ${k + 1}` })}${body}</div>`;
    }).join('');
    const nav = E.questions.map((q, k) => `<button class="${E.answers[k] === q.c ? 'r-ok' : 'r-bad'}" data-k="${k}">${k + 1}</button>`).join('');
    const S = SUBJECTS[E.subject];
    app.innerHTML = `
      <div class="crumbs"><a href="#/">Home</a> › <a href="#/${E.licence.toLowerCase()}">${esc(L.name)}</a> › ${esc(S.name)} › Resultaat</div>
      <div class="card result-hero ${passed ? 'pass' : 'fail'}">
        ${timeUp ? '<p><strong>⏰ De tijd is om.</strong></p>' : ''}
        <div class="pct">${pct}%</div>
        <p><strong>${correct} van ${E.questions.length} juist</strong> – ${passed ? `geslaagd (≥ ${L.passMark}%)` : `niet geslaagd (minimum ${L.passMark}%)`}</p>
        <p class="small">Een proefexamen geeft geen garantie op het resultaat van het echte examen.</p>
        <div class="btn-row" style="justify-content:center">
          <a class="btn" href="#/${E.licence.toLowerCase()}">Terug naar vakken</a>
          <a class="btn btn-accent" href="#/${E.licence.toLowerCase()}/${E.subject}/examen">Nieuw proefexamen</a>
        </div>
        <div class="navgrid" style="justify-content:center">${nav}</div>
      </div>
      <h2 style="margin-top:24px">Overzicht met uitleg</h2>
      ${reviews}`;
    app.querySelectorAll('.navgrid button').forEach(b => b.onclick = () => document.getElementById('r' + b.dataset.k).scrollIntoView({ behavior: 'smooth' }));
    bindImages();
    window.scrollTo(0, 0);
  }

  // ---------- settings ----------
  function viewSettings() {
    const s = window.AI.settings();
    app.innerHTML = `
      <div class="crumbs"><a href="#/">Home</a> › Instellingen</div>
      <div class="card">
        <h1>Instellingen</h1>
        <h2 style="margin-top:16px">AI-vraaggenerator (optioneel)</h2>
        <p class="muted">Standaard komen de vragen uit de databank met gecontroleerde ECQB-voorbeeldvragen. Wil je extra, nieuw gegenereerde vragen, dan kun je je eigen Google Gemini API-sleutel invullen.
          De sleutel wordt alleen in deze browser bewaard. AI-vragen worden duidelijk gemarkeerd en <strong>niet gecontroleerd</strong>: de uitleg en de bronnen kunnen fouten bevatten.</p>
        <label class="check"><input type="checkbox" id="ai-enabled" ${s.enabled ? 'checked' : ''}> AI-vragen inschakelen</label>
        <label class="field" for="ai-key">Gemini API-sleutel</label>
        <input type="password" id="ai-key" value="${esc(s.apiKey)}" placeholder="AIza…" autocomplete="off">
        <label class="field" for="ai-model">Model</label>
        <input type="text" id="ai-model" value="${esc(s.model)}">
        <label class="check"><input type="checkbox" id="ai-mix" ${s.mix ? 'checked' : ''}> In oefenmodus elke 3e vraag door AI laten genereren</label>
        <div class="btn-row" style="margin-top:18px">
          <button class="btn btn-primary" id="save">Opslaan</button>
          <button class="btn" id="test">Test verbinding</button>
        </div>
        <p id="msg" class="small"></p>
        <h2 style="margin-top:24px">Voortgang</h2>
        <p class="muted">Je scores worden alleen lokaal in deze browser bewaard.</p>
        <button class="btn" id="reset">Voortgang wissen</button>
      </div>`;
    const read = () => ({
      enabled: document.getElementById('ai-enabled').checked,
      apiKey: document.getElementById('ai-key').value.trim(),
      model: document.getElementById('ai-model').value.trim() || 'gemini-2.5-flash',
      mix: document.getElementById('ai-mix').checked
    });
    const msg = document.getElementById('msg');
    document.getElementById('save').onclick = () => { window.AI.save(read()); msg.textContent = '✅ Opgeslagen.'; };
    document.getElementById('test').onclick = async () => {
      window.AI.save(Object.assign(read(), { enabled: true }));
      msg.innerHTML = '<span class="spinner"></span> Testen…';
      try {
        const q = await window.AI.generate('PPL', 'air_law', (BANK.air_law || []).slice(0, 2));
        msg.textContent = '✅ Werkt! Voorbeeld: ' + q.q;
      } catch (e) { msg.textContent = '❌ ' + e.message; }
    };
    document.getElementById('reset').onclick = () => {
      if (!confirm('Alle lokale scores en voortgang wissen?')) return;
      Object.keys(localStorage).filter(k => k.startsWith('pplulm.') && k !== 'pplulm.ai').forEach(k => localStorage.removeItem(k));
      msg.textContent = 'Voortgang gewist.';
    };
  }

  // ---------- images ----------
  const lightbox = document.getElementById('lightbox');
  lightbox.onclick = () => lightbox.classList.add('hidden');
  function bindImages() {
    app.querySelectorAll('.q-images img').forEach(img => img.onclick = () => {
      lightbox.querySelector('img').src = img.src;
      lightbox.classList.remove('hidden');
    });
  }

  // ---------- router ----------
  function route() {
    if (exam && !exam.done) { stopTimer(); exam = null; } // leaving a running exam
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    const licence = (parts[0] || '').toUpperCase();
    document.querySelectorAll('.topnav a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#/' + (parts[0] || '')));
    window.scrollTo(0, 0);
    if (!parts.length) return viewHome();
    if (parts[0] === 'instellingen') return viewSettings();
    if (!LICENCES[licence]) return viewHome();
    if (parts.length === 1) return viewLicence(licence);
    const subject = parts[1];
    if (!LICENCES[licence].exams[subject]) return viewLicence(licence);
    if (parts[2] === 'examen') return viewExamIntro(licence, subject);
    return viewPractice(licence, subject);
  }

  window.addEventListener('hashchange', route);
  window.addEventListener('beforeunload', e => { if (exam && !exam.done) { e.preventDefault(); e.returnValue = ''; } });
  route();
})();
