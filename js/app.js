(function () {
  'use strict';

  const BANK = window.QUESTION_BANK || {};
  // Aanvullende vragen (js/extra.js, beheerd via beheer.html): alleen goedgekeurde vragen komen in de oefenvragen.
  (window.EXTRA_QUESTIONS || []).filter(q => q.status === 'approved' && BANK[q.subject]).forEach(q => {
    const ai = /^AI\b/.test(q.opgesteld || '');  // door AI opgesteld (en door een mens nagekeken): eigen categorie
    BANK[q.subject].push({ ...q, extra: true, ai, lo: ai ? 'AI' : q.lo, img: q.img || [], loText: q.loText || '' });
  });
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

  // Afkortingen uit vraag, antwoorden en uitleg, met volledige benaming en korte uitleg.
  function glossaryHtml(q) {
    if (!window.GLOSSARY) return '';
    const items = window.GLOSSARY.find([q.q, ...q.o, q.e]);
    if (!items.length) return '';
    return `<details class="glossary" open><summary>📖 Afkortingen in deze vraag (${items.length})</summary><ul>${items.map(i =>
      `<li><strong>${esc(i.key)}</strong> – <em>${esc(i.full)}</em>: ${esc(i.text)}</li>`).join('')}</ul></details>`;
  }

  // Brondocument van een AI-vraag (veld "doc"; zonder doc = KB ULM).
  const AI_DOCS = { kb: { name: 'het KB ULM', src: 'kbulm' }, sera: { name: 'SERA', src: 'sera' }, sera2012: { name: 'SERA', src: 'sera' } };
  const aiDoc = q => AI_DOCS[q.doc || 'kb'] || { name: 'de wettekst', src: q.src };

  // Antwoord van een AI-vraag: de bron en het stuk tekst waarop de vraag gebaseerd is.
  function aiSourceHtml(q) {
    const s = window.resolveSource(q.src || aiDoc(q).src);
    return `<div class="source">📘 Bron: <strong>${esc(s.org)}</strong> – <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>${q.ref ? ` — <em>${esc(q.ref)}</em>` : ''}
      ${q.citaat ? `<div class="small ai-quote-label">Tekst uit het document${q.doc === 'sera' ? ' (geldende tekst, enkel in het Engels)' : ''}; het gemarkeerde deel is waar het antwoord op steunt:</div>
      <blockquote class="ai-quote">${fragmentHtml(q.fragment || q.citaat, q.citaat)}</blockquote>` : ''}</div>`;
  }

  // Stuk wettekst rond het citaat: tabellen als tabel, het citaat gemarkeerd.
  function fragmentHtml(text, cit) {
    const c = (cit || '').trim();
    const mark = line => {
      const t = line.trim();
      if (t.length > 3 && c.includes(t)) return `<mark>${esc(line)}</mark>`;
      return c && line.includes(c) ? esc(line).replace(esc(c), `<mark>${esc(c)}</mark>`) : esc(line);
    };
    const isRow = l => (l.match(/\|/g) || []).length >= 2;
    const out = [];
    let rows = [];
    const flush = () => {
      if (!rows.length) return;
      out.push(`<div class="ai-table-wrap"><table class="ai-table">${rows.filter(r => !/^\s*\|?\s*-{3}/.test(r)).map(r => {
        const t = r.trim(), md = t.startsWith('|') && t.endsWith('|'); // Markdown-rij: | a | b |
        const hl = t.length > 3 && (c.includes(t) || t.includes(c));
        const cells = (md ? t.slice(1, -1) : r).split('|');
        return `<tr${hl ? ' class="hl"' : ''}>${cells.map(x => `<td>${esc(x.trim())}</td>`).join('')}</tr>`;
      }).join('')}</table></div>`);
      rows = [];
    };
    for (const line of text.split('\n')) {
      if (isRow(line)) { rows.push(line); continue; }
      flush();
      if (line.trim()) out.push(`<div>${mark(line)}</div>`);
    }
    flush();
    return out.join('');
  }

  function sourceHtml(q) {
    if (q.ai) return aiSourceHtml(q);
    const s = window.resolveSource(q.src);
    const ref = q.ref ? ` — <em>${esc(q.ref)}</em>` : '';
    const lo = q.extra
      ? `<div class="small">${q.ai ? 'AI-gegenereerde vraag' : 'Aanvullende vraag'}, opgesteld op basis van de wettekst</div>`
      : q.auteur
      ? `<div class="small">Onderwerp (ECQB ${esc(q.lo)})${q.loText ? ': ' + esc(q.loText) : ''} · Auteur van de vraag: ${esc(q.auteur)}</div>`
      : q.lo ? `<div class="small">ECQB-leerdoel ${esc(q.lo)}${q.loText ? ': ' + esc(q.loText) : ''}</div>` : '';
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
    return `<div class="feedback ${ok ? 'ok' : 'bad'}">
      <h3>${head}</h3>
      ${whyWrong}
      <p class="explain">${esc(q.e || 'Geen uitleg beschikbaar.').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>
      ${q.eImg ? `<div class="explain-fig"><img src="${esc(q.eImg)}" alt="Schets bij de uitleg"></div>` : ''}
      ${review}
      ${glossaryHtml(q)}
      ${sourceHtml(q)}
    </div>`;
  }

  // Weerbericht (METAR/TAF) in een kader, met het gevraagde deel gemarkeerd (alleen als volledig woord).
  function codeHtml(code, mark) {
    let html = esc(code);
    if (mark) {
      const m = esc(mark).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      html = html.replace(new RegExp(`(^|\\s)(${m})(?=\\s|$)`), '$1<mark>$2</mark>');
    }
    return `<div class="wx-code" aria-label="Weerbericht">${html}</div>`;
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
    const tag = q.extra ? (q.ai ? `🤖 AI-gegenereerde vraag, gebaseerd op ${esc(aiDoc(q).name)}` : `Aanvullende vraag · ${esc(q.basis || 'aanvullend')}`) : q.auteur ? `Aanvullende vraag · auteur: ${esc(q.auteur)}` : (q.lo ? 'ECQB ' + esc(q.lo) : '');
    return `<div class="q-meta"><span>${opts.counter || ''}</span><span>${tag}</span></div>
      ${q.code ? codeHtml(q.code, q.mark) : ''}
      <p class="q-text">${esc(q.q)}</p>
      ${imgs ? `<div class="q-images">${imgs}</div>` : ''}
      <div class="options">${options}</div>`;
  }

  // ---------- views ----------
  function viewHome() {
    const count = l => Object.keys(LICENCES[l].exams).reduce((n, s) => n + questionsFor(l, s).length, 0);
    app.innerHTML = `
      <h1>Oefen je PPL- of ULM-theorie</h1>
      <p class="lead">Kies bij <strong>Licentie</strong> je opleiding en daarna het vak: oefen met examenvragen of leg een proefexamen af met hetzelfde aantal vragen en dezelfde tijd als op het examen. Bij <strong>Oefeningen</strong> maakt de site telkens een nieuwe oefening.</p>
      <div class="notice"><strong>Dit is geen officieel platform.</strong> Het is niet verbonden aan EASA, de BCAA of het DGLV.
        Slagen op deze website geeft <strong>geen garantie</strong> dat je slaagt voor het echte theorie-examen.</div>
      <section class="home-section">
      <h2 class="section-title">Licentie</h2>
      <p class="muted section-sub">Oefenvragen per vak, met oefenmodus en proefexamen</p>
      <div class="grid grid-2">
        <a class="card licence-card" href="#/ppl">
          <div class="big">🛩️</div>
          <h2>PPL(A)</h2>
          <p class="muted">${esc(LICENCES.PPL.full)}<br>9 vakken · ${count('PPL')} oefenvragen</p>
        </a>
        <a class="card licence-card" href="#/ulm">
          <div class="big">🪂</div>
          <h2>ULM</h2>
          <p class="muted">${esc(LICENCES.ULM.full)}<br>4 vakken · ${count('ULM')} oefenvragen</p>
        </a>
      </div>
      </section>
      <section class="home-section">
      <h2 class="section-title">Oefeningen</h2>
      <p class="muted section-sub">De site maakt telkens een nieuwe oefening, met stap-voor-stap uitleg</p>
      <div class="grid grid-3">
        <a class="card licence-card" href="#/rekenvragen">
          <div class="big">🧮</div>
          <h2>Rekenvragen</h2>
          <p class="muted">Telkens nieuwe rekenoefeningen met stap-voor-stap uitleg<br>${Object.keys(window.CALC.GENERATORS).length} vakken · ${Object.values(window.CALC.GENERATORS).reduce((n, l) => n + l.length, 0)} soorten oefeningen</p>
        </a>
        <a class="card licence-card" href="#/vor">
          <div class="big">📡</div>
          <h2>VOR &amp; radionavigatie</h2>
          <p class="muted">VOR, ADF en RMI aflezen op telkens nieuw getekende instrumenten<br>${Object.keys(window.RADIONAV.GENERATORS).length} instrumenten · ${Object.values(window.RADIONAV.GENERATORS).reduce((n, l) => n + l.length, 0)} soorten oefeningen</p>
        </a>
        <a class="card licence-card" href="#/metar">
          <div class="big">🌦️</div>
          <h2>METAR &amp; TAF</h2>
          <p class="muted">Telkens een nieuw weerbericht: wat betekent dit deel, en wat doe je ermee?<br>${Object.keys(window.METAR.GENERATORS).length} onderdelen · ${Object.values(window.METAR.GENERATORS).reduce((n, l) => n + l.length, 0)} soorten oefeningen</p>
        </a>
      </div>
      </section>`;
  }

  function viewLicence(licence) {
    const L = LICENCES[licence];
    const cards = licenceSubjects(licence).map(key => {
      const S = SUBJECTS[key];
      const n = questionsFor(licence, key).length;
      const ex = L.exams[key];
      const st = stats(licence, key);
      const pct = st.answered ? Math.round(100 * st.correct / st.answered) : 0;
      return `<div class="card subject-card">
        <div class="subject-head">
          <div class="subject-icon">${S.icon}</div>
          <div><h3>${esc(S.code)} · ${esc(S.name)}</h3><div class="subject-meta">${esc(S.en)}</div></div>
        </div>
        <div class="subject-meta">${n} oefenvragen · examen: ${ex.questions} vragen / ${ex.minutes} min</div>
        ${st.answered ? `<div class="subject-meta">Jouw score: ${st.correct}/${st.answered} (${pct}%)</div><div class="progress"><span style="width:${pct}%"></span></div>` : ''}
        ${n === 0 ? '<div class="subject-meta">Nog geen oefenvragen voor dit vak.</div>' : ''}
        <div class="btn-row">
          <a class="btn btn-primary" href="#/${licence.toLowerCase()}/${key}/oefenen" ${n ? '' : 'aria-disabled="true" onclick="return false" style="opacity:.5;pointer-events:none"'}>Oefenen</a>
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
      <p class="small muted">Aantal vragen en examentijd per vak: <a href="${esc(exSrc.url)}" target="_blank" rel="noopener">${esc(L.examRef)}</a>.</p>
      <div class="grid grid-3">${cards}</div>`;
  }

  // ---------- practice ----------
  let practice = null;

  function chaptersFor(licence, subject) {
    const all = questionsFor(licence, subject);
    return (window.CHAPTERS[subject] || []).map(ch => ({
      ch, count: all.filter(q => window.chapterOf(subject, q.lo) === ch).length
    }));
  }

  function viewPractice(licence, subject, chapterId) {
    const all = questionsFor(licence, subject);
    const chapter = (window.CHAPTERS[subject] || []).find(c => c.id === chapterId) || null;
    const pool = chapter ? all.filter(q => window.chapterOf(subject, q.lo) === chapter) : all;
    if (!pool.length) {
      location.hash = chapter ? `#/${licence.toLowerCase()}/${subject}/oefenen` : '#/' + licence.toLowerCase();
      return;
    }
    const deckKey = `deck.${licence}.${subject}${chapter ? '.' + chapter.id : ''}`;
    practice = { licence, subject, chapter, pool, deckKey, q: null, chosen: null, session: { answered: 0, correct: 0 }, count: 0 };
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

  function nextPractice() {
    const P = practice;
    P.chosen = null;
    P.count++;
    P.q = present(drawFromDeck());
    renderPractice();
  }

  function practiceHeader() {
    const P = practice;
    const S = SUBJECTS[P.subject];
    const total = questionsFor(P.licence, P.subject).length;
    const chapterOpts = chaptersFor(P.licence, P.subject)
      .filter(c => c.count > 0)
      .map(c => `<option value="${esc(c.ch.id)}" ${P.chapter === c.ch ? 'selected' : ''}>${esc(c.ch.name)} (${c.count})</option>`).join('');
    return `<div class="crumbs"><a href="#/">Home</a> › <a href="#/${P.licence.toLowerCase()}">${esc(LICENCES[P.licence].name)}</a> › ${esc(S.name)}</div>
      <div class="quiz-head">
        <div><h1>${S.icon} ${esc(S.name)}</h1><div class="muted small">Oefenmodus · ${P.pool.length} vragen${P.chapter ? ' in dit hoofdstuk' : ''}</div></div>
        <span class="score-pill">Sessie: ${P.session.correct}/${P.session.answered}</span>
      </div>
      ${chapterOpts ? `<div class="chapter-filter">
        <label for="chapter">Hoofdstuk</label>
        <select id="chapter"><option value="">Alle hoofdstukken (${total})</option>${chapterOpts}</select>
      </div>` : ''}
      ${P.chapter && P.chapter.id === 'ai' ? aiBannerHtml() : ''}`;
  }

  function aiBannerHtml() {
    return `<div class="ai-notice ai-banner">🤖 <strong>Deze vragen zijn gegenereerd door AI</strong> op basis van officiële documenten. Lees altijd het officiële document na: bij elk antwoord staan de bron en de tekst waarop de vraag gebaseerd is.</div>`;
  }

  function bindChapterSelect() {
    const sel = document.getElementById('chapter');
    if (sel) sel.onchange = () => {
      const base = `#/${practice.licence.toLowerCase()}/${practice.subject}/oefenen`;
      location.hash = sel.value ? `${base}/${sel.value}` : base;
    };
  }

  // Kaart met de vraag, met de kompasrekenmachine ernaast (breed scherm) of eronder (mobiel).
  function withCompassCalc(cardHtml, q, context) {
    const side = window.COMPASSCALC ? window.COMPASSCALC.html(q, context) : '';
    return side
      ? `<div class="qa-layout"><div class="qa-main">${cardHtml}</div><aside class="qa-side">${side}</aside></div>`
      : cardHtml;
  }

  function renderPractice() {
    const P = practice;
    const answered = P.chosen !== null;
    app.innerHTML = practiceHeader() + withCompassCalc(`
      <div class="card">
        ${questionHtml(P.q, { chosen: P.chosen, reveal: answered, locked: answered, counter: `Vraag ${P.count}` })}
        ${answered ? feedbackHtml(P.q, P.chosen) : ''}
        <div class="quiz-actions">
          <a class="btn" href="#/${P.licence.toLowerCase()}">← Vakken</a>
          <div class="btn-row"><button class="btn btn-primary" id="next">${answered ? 'Volgende vraag →' : 'Overslaan →'}</button></div>
        </div>
      </div>`, P.q, P.subject);
    app.querySelectorAll('.option').forEach(b => b.onclick = () => {
      if (P.chosen !== null) return;
      P.chosen = +b.dataset.i;
      const ok = P.chosen === P.q.c;
      P.session.answered++; if (ok) P.session.correct++;
      addStat(P.licence, P.subject, ok);
      renderPractice();
      app.querySelector('.feedback')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    document.getElementById('next').onclick = () => nextPractice();
    bindChapterSelect();
    if (window.COMPASSCALC) window.COMPASSCALC.bind(app);
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
        <p class="lead">${esc(L.name)} · ${ex.questions} vragen · ${ex.minutes} minuten · geslaagd vanaf ${L.passMark}% (${Math.ceil(ex.questions * L.passMark / 100)} juist)${L.passRule === 'total' ? ' (op het echte ULM-examen geldt dit over de 4 vakken samen)' : ''}</p>
        ${short ? `<div class="notice">Voor dit vak zijn er nog maar ${pool.length} oefenvragen. Dit proefexamen telt daarom ${n} vragen en ${minutes} minuten (in verhouding).</div>` : ''}
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
        ? `<div class="feedback bad"><h3>⏺ Niet beantwoord – het juiste antwoord is ${LETTERS[q.c]}: ${esc(q.o[q.c])}</h3><p class="explain">${esc(q.e).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>${glossaryHtml(q)}${sourceHtml(q)}</div>`
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

  // ---------- generated practice sets (rekenvragen, radionavigatie) ----------
  // Elke set heeft groepen (vakken of instrumenten) met generatoren die telkens een nieuwe oefening maken.
  const SETS = {
    rekenvragen: {
      title: 'Rekenvragen', icon: '🧮', api: () => window.CALC, statsKey: 'calcstats', groupWord: 'Vakken',
      order: Object.keys(SUBJECTS), // zelfde volgorde als de vakken: 10, 20, 30 …
      group: key => ({ icon: SUBJECTS[key].icon, title: `${SUBJECTS[key].code} · ${SUBJECTS[key].name}`, name: SUBJECTS[key].name, tags: window.CALC.LICENCE_TAGS[key] }),
      lead: 'Kies een vak. De site maakt telkens een nieuwe oefening met andere getallen. Het juiste antwoord wordt berekend, de foute antwoorden zijn typische denkfouten. Na je antwoord zie je de berekening stap voor stap.',
      sub: 'Rekenvragen · telkens nieuwe getallen'
    },
    metar: {
      title: 'METAR & TAF', icon: '🌦️', api: () => window.METAR, statsKey: 'metarstats', groupWord: 'Onderdelen',
      order: ['metar', 'toepassen', 'taf'],
      group: key => { const G = window.METAR.GROUPS[key]; return { icon: G.icon, title: G.name, name: G.name, tags: ['PPL', 'ULM'], desc: G.desc }; },
      lead: 'Kies een onderdeel. De site maakt telkens een nieuw, realistisch weerbericht voor een Belgisch vliegveld en vraagt wat een deel betekent of wat je ermee moet doen. Na je antwoord zie je het hele bericht ontcijferd.',
      sub: 'METAR & TAF · telkens een nieuw weerbericht'
    },
    vor: {
      title: 'VOR & radionavigatie', icon: '📡', api: () => window.RADIONAV, statsKey: 'radiostats', groupWord: 'Instrumenten',
      order: ['vor', 'adf', 'rmi'],
      group: key => { const G = window.RADIONAV.GROUPS[key]; return { icon: G.icon, title: G.name, name: G.name, tags: ['PPL'], desc: G.desc }; },
      lead: 'Kies een instrument. De site tekent telkens een nieuw instrument met een andere stand, in de stijl van de examenbijlagen (NAV-019, NAV-022, NAV-024). Na je antwoord zie je stap voor stap hoe je het afleest.',
      sub: 'Radionavigatie · telkens een nieuwe instrumentstand'
    }
  };
  let calc = null;

  function viewSetHome(setKey) {
    const SET = SETS[setKey], API = SET.api();
    const cards = SET.order.filter(k => API.GENERATORS[k]).map(key => {
      const G = SET.group(key), gens = API.GENERATORS[key];
      const st = store.get(`${SET.statsKey}.${key}`, { answered: 0, correct: 0 });
      const pct = st.answered ? Math.round(100 * st.correct / st.answered) : 0;
      const tags = G.tags.map(t => `<span class="badge">${t}</span>`).join(' ');
      return `<a class="card subject-card licence-card" href="#/${setKey}/${key}">
        <div class="subject-head">
          <div class="subject-icon">${G.icon}</div>
          <div><h3>${esc(G.title)}</h3><div class="subject-meta">${tags}</div></div>
        </div>
        ${G.desc ? `<div class="subject-meta">${esc(G.desc)}</div>` : ''}
        <div class="subject-meta">${gens.map(g => esc(g.name)).join(' · ')}</div>
        ${st.answered ? `<div class="subject-meta">Jouw score: ${st.correct}/${st.answered} (${pct}%)</div><div class="progress"><span style="width:${pct}%"></span></div>` : ''}
      </a>`;
    }).join('');
    app.innerHTML = `
      <div class="crumbs"><a href="#/">Home</a> › ${esc(SET.title)}</div>
      <h1>${SET.icon} ${esc(SET.title)}</h1>
      <p class="lead">${esc(SET.lead)}</p>
      <div class="grid grid-3">${cards}</div>`;
  }

  function viewSet(setKey, group, typeId) {
    const gens = SETS[setKey].api().GENERATORS[group];
    const type = gens.find(g => g.id === typeId) || null;
    calc = { setKey, group, type, q: null, chosen: null, count: 0, session: { answered: 0, correct: 0 } };
    nextCalc();
  }

  function nextCalc() {
    const C = calc;
    C.chosen = null;
    C.count++;
    C.q = present(SETS[C.setKey].api().generate(C.group, C.type && C.type.id));
    renderCalc();
  }

  function renderCalc() {
    const C = calc, SET = SETS[C.setKey], G = SET.group(C.group), gens = SET.api().GENERATORS[C.group];
    const answered = C.chosen !== null;
    const opts = gens.map(g => `<option value="${esc(g.id)}" ${C.type === g ? 'selected' : ''}>${esc(g.name)}</option>`).join('');
    app.innerHTML = `
      <div class="crumbs"><a href="#/">Home</a> › <a href="#/${C.setKey}">${esc(SET.title)}</a> › ${esc(G.name)}</div>
      <div class="quiz-head">
        <div><h1>${SET.icon} ${esc(G.name)}</h1><div class="muted small">${esc(SET.sub)}</div></div>
        <span class="score-pill">Sessie: ${C.session.correct}/${C.session.answered}</span>
      </div>
      <div class="chapter-filter">
        <label for="calctype">Soort oefening</label>
        <select id="calctype"><option value="">Alle soorten (willekeurig)</option>${opts}</select>
      </div>
      ${withCompassCalc(`<div class="card">
        ${questionHtml(C.q, { chosen: C.chosen, reveal: answered, locked: answered, counter: `Oefening ${C.count} · ${esc(C.q.typeName)}` })}
        ${answered ? feedbackHtml(C.q, C.chosen) : ''}
        <div class="quiz-actions">
          <a class="btn" href="#/${C.setKey}">← ${esc(SET.groupWord)}</a>
          <button class="btn btn-primary" id="next">${answered ? 'Nieuwe oefening →' : 'Andere oefening →'}</button>
        </div>
      </div>`, C.q, C.group)}`;
    app.querySelectorAll('.option').forEach(b => b.onclick = () => {
      if (C.chosen !== null) return;
      C.chosen = +b.dataset.i;
      const ok = C.chosen === C.q.c;
      C.session.answered++; if (ok) C.session.correct++;
      const key = `${SET.statsKey}.${C.group}`;
      const st = store.get(key, { answered: 0, correct: 0 });
      st.answered++; if (ok) st.correct++;
      store.set(key, st);
      renderCalc();
      app.querySelector('.feedback')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    document.getElementById('next').onclick = () => nextCalc();
    document.getElementById('calctype').onchange = e => {
      location.hash = `#/${C.setKey}/${C.group}${e.target.value ? '/' + e.target.value : ''}`;
    };
    bindImages();
    if (window.COMPASSCALC) window.COMPASSCALC.bind(app);
  }

  // ---------- settings ----------
  // Elke rij is een vak (of instrument) met de localStorage-sleutels die bij die voortgang horen.
  function progressRows() {
    const keys = () => Object.keys(localStorage).filter(k => k.startsWith('pplulm.'));
    const rows = [];
    Object.keys(LICENCES).forEach(lic => {
      licenceSubjects(lic).forEach(sub => {
        const S = SUBJECTS[sub];
        const own = k => k === `pplulm.stats.${lic}.${sub}` || k === `pplulm.exams.${lic}.${sub}`
          || k === `pplulm.deck.${lic}.${sub}` || k.startsWith(`pplulm.deck.${lic}.${sub}.`);
        rows.push({ section: LICENCES[lic].name, id: `${lic}.${sub}`, label: `${S.icon} ${S.name}`,
          st: stats(lic, sub), exams: store.get(`exams.${lic}.${sub}`, []).length, keys: () => keys().filter(own) });
      });
    });
    Object.keys(SETS).forEach(setKey => {
      const SET = SETS[setKey], API = SET.api();
      if (!API) return;
      SET.order.filter(k => API.GENERATORS[k]).forEach(key => {
        const G = SET.group(key), full = `pplulm.${SET.statsKey}.${key}`;
        rows.push({ section: SET.title, id: `${setKey}.${key}`, label: `${G.icon} ${G.name}`,
          st: store.get(`${SET.statsKey}.${key}`, { answered: 0, correct: 0 }), exams: 0, keys: () => keys().filter(k => k === full) });
      });
    });
    return rows;
  }

  function viewSettings() {
    const rows = progressRows();
    const sections = [...new Set(rows.map(r => r.section))].map(sec => {
      const list = rows.filter(r => r.section === sec).map(r => {
        const has = r.keys().length > 0;
        const pct = r.st.answered ? Math.round(100 * r.st.correct / r.st.answered) : 0;
        const info = r.st.answered
          ? `${r.st.correct}/${r.st.answered} juist (${pct}%)${r.exams ? ` · ${r.exams} proefexamen${r.exams > 1 ? 's' : ''}` : ''}`
          : (has ? 'Alleen oefenvolgorde of proefexamens bewaard' : 'Nog geen voortgang');
        return `<li class="progress-row">
          <div><div>${esc(r.label)}</div><div class="muted small">${info}</div></div>
          <button class="btn btn-small" data-reset="${esc(r.id)}" ${has ? '' : 'disabled'}>Wissen</button>
        </li>`;
      }).join('');
      return `<h3 class="progress-section">${esc(sec)}</h3><ul class="progress-list">${list}</ul>`;
    }).join('');
    app.innerHTML = `
      <div class="crumbs"><a href="#/">Home</a> › Instellingen</div>
      <div class="card">
        <h1>Instellingen</h1>
        <h2 style="margin-top:16px">Voortgang</h2>
        <p class="muted">Je scores worden alleen lokaal in deze browser bewaard. Je kunt de voortgang per vak wissen (score, oefenvolgorde en proefexamens van dat vak) of alles in één keer.</p>
        ${sections}
        <h3 class="progress-section">Alles</h3>
        <button class="btn" id="reset">Alle voortgang wissen</button>
        <p id="msg" class="small"></p>
      </div>`;
    app.querySelectorAll('[data-reset]').forEach(btn => btn.onclick = () => {
      const r = rows.find(x => x.id === btn.dataset.reset);
      if (!r || !confirm(`Voortgang van "${r.label.replace(/^\S+\s/, '')}" (${r.section}) wissen?`)) return;
      r.keys().forEach(k => localStorage.removeItem(k));
      viewSettings();
      document.getElementById('msg').textContent = `Voortgang van ${r.label.replace(/^\S+\s/, '')} (${r.section}) gewist.`;
    });
    document.getElementById('reset').onclick = () => {
      if (!confirm('Alle lokale scores en voortgang wissen?')) return;
      Object.keys(localStorage).filter(k => k.startsWith('pplulm.')).forEach(k => localStorage.removeItem(k));
      viewSettings();
      document.getElementById('msg').textContent = 'Alle voortgang gewist.';
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
    if (SETS[parts[0]]) return parts[1] && SETS[parts[0]].api().GENERATORS[parts[1]] ? viewSet(parts[0], parts[1], parts[2]) : viewSetHome(parts[0]);
    if (!LICENCES[licence]) return viewHome();
    if (parts.length === 1) return viewLicence(licence);
    const subject = parts[1];
    if (!LICENCES[licence].exams[subject]) return viewLicence(licence);
    if (parts[2] === 'examen') return viewExamIntro(licence, subject);
    return viewPractice(licence, subject, parts[3]);
  }

  // Opruimen: de vroegere AI-instellingen (incl. API-sleutel) uit de browser verwijderen.
  try { localStorage.removeItem('pplulm.ai'); } catch (e) { /* ignore */ }

  window.addEventListener('hashchange', route);
  window.addEventListener('beforeunload', e => { if (exam && !exam.done) { e.preventDefault(); e.returnValue = ''; } });
  route();
})();
