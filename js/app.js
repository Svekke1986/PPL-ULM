(function () {
  'use strict';

  const BANK = window.QUESTION_BANK || {};
  // Aanvullende vragen (js/extra.js, beheerd via beheer.html): alleen goedgekeurde vragen komen in de oefenvragen.
  (window.EXTRA_QUESTIONS || []).filter(q => q.status === 'approved' && BANK[q.subject]).forEach(q => {
    const ai = /^AI\b/.test(q.opgesteld || '');  // door AI opgesteld (en door een mens nagekeken): eigen categorie
    // Met een ECQB-leerdoelcode verschijnt de vraag ook in haar onderwerphoofdstuk (naast "AI-gegenereerde vragen").
    const lo = /^\d+(\.\d+)+$/.test(q.lo || '') ? q.lo : (ai ? 'AI' : q.lo || '');
    const aipBE = /^aip/.test(q.doc || '');  // Belgische AIP: alleen in de categorie "AIP België" (geen examenstof)
    BANK[q.subject].push({ ...q, extra: true, ai, lo, aipBE, img: q.img || [], loText: q.loText || '' });
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
  // Examentimer: resterende tijd, of na het einde van de tijd de overtijd met een plusteken.
  const fmtExamTime = r => r >= 0 ? fmtTime(r) : '+' + fmtTime(-r);

  // Bevestiging in een eigen venster van de site (geen browsermelding). Geeft een Promise<boolean>.
  // "text" is HTML die de site zelf opbouwt (dynamische waarden worden vooraf ge-escaped).
  function ask({ title, text = '', ok = 'OK', cancel = 'Annuleren', danger = false }) {
    return new Promise(resolve => {
      document.querySelector('.modal-backdrop')?.remove();
      const wrap = document.createElement('div');
      wrap.className = 'modal-backdrop';
      wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 id="modal-title">${esc(title)}</h2>${text}
        <div class="btn-row modal-actions">${cancel ? `<button class="btn" data-a="0">${esc(cancel)}</button>` : ''}
          <button class="btn ${danger ? 'btn-danger' : 'btn-accent'}" data-a="1">${esc(ok)}</button></div></div>`;
      const onKey = e => { if (e.key === 'Escape') close(false); };
      const close = v => { wrap.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
      wrap.addEventListener('click', e => {
        if (e.target === wrap) return close(false);
        const b = e.target.closest('[data-a]');
        if (b) close(b.dataset.a === '1');
      });
      document.addEventListener('keydown', onKey);
      document.body.appendChild(wrap);
      wrap.querySelector('[data-a="1"]').focus();
    });
  }

  // Verborgen dubbele ECQB-voorbeeldvragen tellen alleen mee in de selectie met enkel de originele voorbeeldvragen.
  // Oefenexamenvragen van een instructeur alleen in hun eigen categorie (ze overlappen grotendeels met bestaande vragen).
  function questionsFor(licence, subject, chapterId = null) {
    return (BANK[subject] || []).filter(q => q.lic.includes(licence) && (!q.dubbel || chapterId === 'ecqb') && (!q.oefenexamen || chapterId === 'jh') && (!q.aipBE || chapterId === 'aip'));
  }
  function licenceSubjects(licence) {
    return Object.keys(LICENCES[licence].exams);
  }
  // Score van de lopende oefenronde van een vak (begint opnieuw bij een nieuwe ronde of "Opnieuw beginnen").
  function roundStats(licence, subject, chapterId = null) {
    return store.get(`deck.${licence}.${subject}${chapterId ? '.' + chapterId : ''}.ronde`, { answered: 0, correct: 0 });
  }
  // Voortgangsregel op de vakkaart: score en aantal gehad in de lopende ronde, met balk.
  function roundProgressHtml(label, st, n) {
    if (!st.answered) return '';
    const pct = Math.round(100 * st.correct / st.answered), done = n ? Math.min(100, Math.round(100 * st.answered / n)) : 0;
    return `<div class="subject-meta">${label}: ${st.correct}/${st.answered} juist (${pct}%) · ${st.answered} van ${n} vragen gehad</div><div class="progress" title="Voortgang in deze ronde"><span style="width:${done}%"></span></div>`;
  }

  // Present options in random order (like the real exam) while remembering the correct one.
  function present(q) {
    if (q.vast) return Object.assign({}, q);  // vaste volgorde (opties verwijzen naar elkaar, bv. "A en B zijn juist")
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
  const AI_DOCS = { kb: { name: 'het KB ULM', src: 'kbulm' }, sera: { name: 'SERA', src: 'sera' }, sera2012: { name: 'SERA', src: 'sera' },
    aipgen: { name: 'de AIP België', src: 'aip' }, aipenr: { name: 'de AIP België', src: 'aip' } };
  const EN_DOCS = new Set(['sera', 'aircrew', 'airops', 'ml', 'part21', 'occ', 'atmans', 'adr', 'br', 'aipgen', 'aipenr']); // geldende teksten die enkel in het Engels bestaan (EASA, AIP)
  const aiDoc = q => AI_DOCS[q.doc || 'kb'] || { name: q.basis || 'de wettekst', src: q.src };

  // Antwoord van een AI-vraag: de bron en het stuk tekst waarop de vraag gebaseerd is.
  function aiSourceHtml(q) {
    const loLine = /^\d/.test(q.lo || '') ? `<div class="small">ECQB-leerdoel ${esc(q.lo)}${q.loText ? ': ' + esc(q.loText) : ''}</div>` : '';
    if (!q.doc) {  // AI-vraag zonder wettekst (bv. Beginselen van het vliegen): bron = de ECQB-leerdoelen
      const s = window.resolveSource(q.src || 'syl');
      return `<div class="source">📘 Bron: <strong>${esc(s.org)}</strong> – <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>${loLine}</div>`;
    }
    const s = window.resolveSource(q.src || aiDoc(q).src);
    return `<div class="source">📘 Bron: <strong>${esc(s.org)}</strong> – <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>${q.ref ? ` — <em>${esc(q.ref)}</em>` : ''}
      ${q.citaat ? `<div class="small ai-quote-label">Tekst uit het document${EN_DOCS.has(q.doc) ? ' (geldende tekst, enkel in het Engels)' : ''}; het gemarkeerde deel is waar het antwoord op steunt:</div>
      <blockquote class="ai-quote">${fragmentHtml(q.fragment || q.citaat, q.citaat)}</blockquote>` : ''}${loLine}</div>`;
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
    const tag = q.oefenexamen ? `📝 ${esc(q.oefenexamen)} · ${esc(q.auteur)}` : q.extra ? (q.ai ? (q.doc ? `🤖 AI-gegenereerde vraag, gebaseerd op ${esc(aiDoc(q).name)}` : '🤖 AI-gegenereerde vraag') : `Aanvullende vraag · ${esc(q.basis || 'aanvullend')}`) : q.auteur ? `Aanvullende vraag · auteur: ${esc(q.auteur)}` : (q.lo ? 'ECQB ' + esc(q.lo) : '');
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
      </section>
      <section class="home-section">
      <h2 class="section-title">Simulator</h2>
      <p class="muted section-sub">Oefen de bediening van de glass cockpit, met scenario's die telkens andere gegevens krijgen</p>
      <div class="grid grid-3">
        <a class="card licence-card" href="g3x/index.html">
          <div class="big">🧭</div>
          <h2>G3X Touch Trainer</h2>
          <p class="muted">Simulator in de stijl van de Garmin G3X Touch voor een Tecnam P2008 JC vanaf EBZH: PFD, kaart, motor, radio's, transponder, vluchtplan, naderingen en autopilot<br>50+ scenario's met willekeurige gegevens</p>
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
      // Categorieën met een eigen sessie (oefenexamens) krijgen een eigen voortgangsregel.
      const own = (window.CHAPTERS[key] || []).filter(c => c.eigenSessie).map(c =>
        roundProgressHtml(esc(c.name), roundStats(licence, key, c.id), questionsFor(licence, key, c.id).filter(q => inChapter(key, q, c)).length)).join('');
      return `<div class="card subject-card">
        <div class="subject-head">
          <div class="subject-icon">${S.icon}</div>
          <div><h3>${esc(S.code)} · ${esc(S.name)}</h3><div class="subject-meta">${esc(S.en)}</div></div>
        </div>
        <div class="subject-meta">${n} oefenvragen · examen: ${ex.questions} vragen / ${ex.minutes} min</div>
        ${roundProgressHtml('Huidige ronde', roundStats(licence, key), n)}${own}
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

  // Hoort een vraag bij een hoofdstuk? AI-vragen: in "AI-gegenereerde vragen" én (met leerdoelcode) in hun onderwerp.
  const inChapter = (subject, q, ch) => ch.id === 'ai' ? !!q.ai : ch.id === 'ecqb' ? !q.extra && !q.auteur : ch.id === 'jh' ? !!q.oefenexamen : ch.id === 'aip' ? !!q.aipBE : window.chapterOf(subject, q.lo) === ch;

  function chaptersFor(licence, subject) {
    return (window.CHAPTERS[subject] || []).map(ch => ({
      ch, count: questionsFor(licence, subject, ch.id).filter(q => inChapter(subject, q, ch)).length
    }));
  }

  function viewPractice(licence, subject, chapterId) {
    const chapter = (window.CHAPTERS[subject] || []).find(c => c.id === chapterId) || null;
    const all = questionsFor(licence, subject, chapter && chapter.id);
    const pool = chapter ? all.filter(q => inChapter(subject, q, chapter)) : all;
    if (!pool.length) {
      location.hash = chapter ? `#/${licence.toLowerCase()}/${subject}/oefenen` : '#/' + licence.toLowerCase();
      return;
    }
    const deckKey = `deck.${licence}.${subject}${chapter ? '.' + chapter.id : ''}`;
    practice = { licence, subject, chapter, pool, deckKey, q: null, chosen: null, hist: [], pos: -1 };
    nextPractice();
  }

  // Elke vraag komt één keer aan bod per ronde (stapel per vak of hoofdstuk, bewaard tussen bezoeken).
  function drawFromDeck() {
    const P = practice;
    const ids = new Set(P.pool.map(q => q.id));
    // Bij een nieuw bezoek: de vraag die vorige keer open stond (getrokken, nog niet beantwoord) opnieuw tonen,
    // in plaats van een nieuwe te trekken. Zo gaat er geen vraag verloren als je de pagina verlaat.
    const open = store.get(P.deckKey + '.open', null);
    const seenNow = store.get(P.deckKey + '.gezien', null);
    if (!P.hist.length && open && ids.has(open) && Array.isArray(seenNow) && seenNow.includes(open)) {
      const deckNow = store.get(P.deckKey, []).filter(id => ids.has(id));
      P.roundPos = seenNow.filter(id => ids.has(id)).indexOf(open) + 1;
      P.roundSize = ids.size;
      P.lastOfRound = deckNow.length === 0;
      return P.pool.find(q => q.id === open);
    }
    let deck = store.get(P.deckKey, []).filter(id => ids.has(id));
    // Vragen die deze ronde al aan bod kwamen (oudere stapels zonder lijst: alles wat niet meer in de stapel zit).
    let seen = store.get(P.deckKey + '.gezien', null);
    if (!Array.isArray(seen)) seen = [...ids].filter(id => !deck.includes(id));
    seen = seen.filter(id => ids.has(id));
    if (!deck.length) {  // nieuwe ronde
      deck = shuffle([...ids]);
      seen = [];
      store.set(P.deckKey + '.ronde', { answered: 0, correct: 0, per: {} });
    } else {  // vragen die sinds het begin van de ronde zijn toegevoegd: alsnog op een willekeurige plaats in de stapel
      const known = new Set([...deck, ...seen]);
      [...ids].filter(id => !known.has(id)).forEach(id => deck.splice(Math.floor(Math.random() * (deck.length + 1)), 0, id));
    }
    const id = deck.shift();
    seen.push(id);
    store.set(P.deckKey, deck);
    store.set(P.deckKey + '.gezien', seen);
    store.set(P.deckKey + '.open', id);
    P.roundPos = seen.length;  // de hoeveelste vraag van deze ronde
    P.roundSize = ids.size;
    P.lastOfRound = deck.length === 0;
    return P.pool.find(q => q.id === id);
  }

  // Eigen ronde met score en overzicht: het hele vak, of een categorie met een eigen sessie (bv. de oefenexamens).
  // Elke selectie (heel vak, hoofdstuk of categorie) heeft een eigen ronde met teller, score en eindoverzicht.
  const roundName = P => P.chapter ? P.chapter.name.replace(/^[^\p{L}\p{N}]+\s/u, '') : SUBJECTS[P.subject].name;
  const roundScore = P => store.get(P.deckKey + '.ronde', { answered: 0, correct: 0, per: {} });

  // Deel (hoofdstuk, of het oefenexamen) van een vraag voor de uitsplitsing van de score.
  function partOf(q) {
    if (practice.chapter && practice.chapter.eigenSessie && q.oefenexamen) return q.oefenexamen;
    const ch = window.chapterOf(practice.subject, q.lo || '');
    return ch ? ch.name : q.ai ? 'AI-gegenereerde vragen (zonder leerdoel)' : 'Overige';
  }

  // Ronde afgerond (vak, hoofdstuk of categorie): totaalscore + per deel.
  function roundDoneHtml(ended) {
    const P = practice, r = store.get(P.deckKey + '.ronde', { answered: 0, correct: 0, per: {} });
    const pct = (c, n) => n ? Math.round(100 * c / n) : 0;
    const order = (window.CHAPTERS[P.subject] || []).map(c => c.name);
    const rank = name => order.indexOf(name) + 1 || 99;
    const rows = Object.entries(r.per || {}).sort((x, y) => rank(x[0]) - rank(y[0]) || x[0].localeCompare(y[0]))
      .map(([name, [n, c]]) => `<tr><td>${esc(name)}</td><td>${c}/${n}</td><td><strong>${pct(c, n)} %</strong></td></tr>`).join('');
    return `<div class="round-done">
      <h3>${ended ? `Sessie beëindigd: ${r.answered} van ${P.roundSize} vragen van ${esc(roundName(P))} beantwoord` : `🎉 Alle ${P.roundSize} vragen van ${esc(roundName(P))} gehad`}</h3>
      <p class="round-total">Totaalscore: <strong>${r.correct} van ${r.answered}</strong> juist (<strong>${pct(r.correct, r.answered)} %</strong>)${ended ? '' : restHtml(r)}</p>
      ${rows ? `<table class="round-table"><thead><tr><th>Deel</th><th>Juist</th><th>Score</th></tr></thead><tbody>${rows}</tbody></table>` : ''}
      <p class="small">${ended ? '' : 'Met “Nieuwe ronde” begin je opnieuw met alle vragen, in een andere volgorde.'}</p>
    </div>${wrongListHtml(r)}`;
  }

  // Wat er naast de beantwoorde vragen in de ronde zat: echt overgeslagen, of nog uit een sessie van vóór de score werd bijgehouden.
  function restHtml(r) {
    const skipped = (r.overgeslagen || []).length, earlier = Math.max(0, practice.roundSize - r.answered - skipped);
    return (skipped ? ` · ${skipped} overgeslagen` : '') + (earlier ? ` · ${earlier} uit een eerdere sessie (niet in de score)` : '');
  }

  // Foute antwoorden van de ronde: per vraag je antwoord en het juiste, open te klappen voor de uitleg en de bron.
  function wrongListHtml(r) {
    const P = practice;
    const wrong = (r.fout || []).map(f => ({ f, q: P.pool.find(q => q.id === f.id) })).filter(x => x.q);
    if (!wrong.length) return r.answered ? '<p class="wrong-none">Geen enkele fout in deze ronde. 👏</p>' : '';
    return `<div class="wrong-list">
      <h3>❌ Foute antwoorden in deze ronde (${wrong.length})</h3>
      <p class="small muted">Tik op een vraag voor de uitleg.</p>
      ${wrong.map(({ f, q }, k) => {
        const imgs = (q.img || []).map(src => `<img src="${esc(src)}" alt="Bijlage bij de vraag" loading="lazy">`).join('');
        return `<details class="wrong-item">
          <summary><span class="wrong-q">${k + 1}. ${esc(q.q)}</span>
            <span class="wrong-a">Jouw antwoord: <span class="wrong-mine">${f.keuze === null ? 'niet beantwoord' : esc(f.keuze)}</span></span>
            <span class="wrong-a">Juist: <strong class="wrong-right">${esc(q.o[q.c])}</strong></span></summary>
          <div class="wrong-body">${imgs ? `<div class="q-images">${imgs}</div>` : ''}
            <p class="explain">${esc(q.e || 'Geen uitleg beschikbaar.').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>${glossaryHtml(q)}${sourceHtml(q)}</div>
        </details>`;
      }).join('')}
    </div>`;
  }

  // Sessie beëindigen: (bij een heel vak) eerst de score tonen, daarna opnieuw beginnen met alle vragen.
  function restartPractice() {
    const P = practice;
    const reset = () => {
      // Hoofdstuk: alleen die stapel. Heel vak: stapels van het vak én van alle hoofdstukken, plus de rondescore.
      // (De sleutels van een hoofdstuk beginnen met die van het vak; omgekeerd niet.)
      // Categorieën met een eigen sessie (oefenexamens) blijven staan als je het hele vak opnieuw begint.
      const prefix = `pplulm.${P.deckKey}`;
      const own = P.chapter ? [] : (window.CHAPTERS[P.subject] || []).filter(c => c.eigenSessie).map(c => `${prefix}.${c.id}`);
      const keep = k => own.some(o => k === o || k.startsWith(o + '.'));
      Object.keys(localStorage).filter(k => (k === prefix || k.startsWith(prefix + '.')) && !keep(k)).forEach(k => localStorage.removeItem(k));
      viewPractice(P.licence, P.subject, P.chapter && P.chapter.id);
    };
    const r = store.get(P.deckKey + '.ronde', { answered: 0 });
    if (!r.answered) {
      ask({ title: 'Opnieuw beginnen?', text: '<p>Deze sessie beëindigen en opnieuw beginnen met alle vragen?</p>', ok: 'Opnieuw beginnen' }).then(ok => ok && reset());
      return;
    }
    app.innerHTML = practiceHeader() + `<div class="card">${roundDoneHtml(true)}
      <div class="quiz-actions"><button class="btn" id="cancel">← Verder oefenen</button>
        <button class="btn btn-primary" id="again">Opnieuw beginnen →</button></div></div>`;
    document.getElementById('cancel').onclick = () => renderPractice();
    document.getElementById('again').onclick = reset;
    document.getElementById('restart').disabled = true;
    bindChapterSelect();
    bindImages();
  }

  // Geschiedenis van deze sessie: terug naar vorige vragen en weer vooruit.
  function showEntry(i) {
    const P = practice, e = P.hist[i];
    P.pos = i;
    Object.assign(P, { q: e.q, chosen: e.chosen, roundPos: e.roundPos, roundSize: e.roundSize, lastOfRound: e.lastOfRound });
    renderPractice();
  }

  function nextPractice() {
    const P = practice;
    if (P.pos < P.hist.length - 1) return showEntry(P.pos + 1);  // vooruit in de geschiedenis
    if (P.q && P.chosen === null) {  // "Overslaan": de vraag als overgeslagen noteren in de ronde
      const r = roundScore(P);
      r.overgeslagen = [...new Set([...(r.overgeslagen || []), P.q.id])];
      store.set(P.deckKey + '.ronde', r);
    }
    const q = present(drawFromDeck());
    P.hist.push({ q, chosen: null, roundPos: P.roundPos, roundSize: P.roundSize, lastOfRound: P.lastOfRound });
    showEntry(P.hist.length - 1);
  }

  function prevPractice() {
    if (practice.pos > 0) showEntry(practice.pos - 1);
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
        <div><h1>${S.icon} ${esc(S.name)}</h1><div class="muted small">Oefenmodus · ${P.pool.length} vragen${P.chapter ? ({ ecqb: ' (originele ECQB-voorbeeldvragen)', jh: ' (oefenexamens, vaste antwoordvolgorde)', aip: ' (AIP België, geen ECQB-examenstof)' }[P.chapter.id] || ' in dit hoofdstuk') : ''}</div></div>
        <div class="head-actions"><span class="score-pill" title="Score in deze ronde">Ronde: ${roundScore(P).correct}/${roundScore(P).answered}</span>
          <button class="btn btn-small" id="restart" title="Sessie beëindigen en opnieuw beginnen">⟲ Opnieuw beginnen</button></div>
      </div>
      ${chapterOpts ? `<div class="chapter-filter">
        <label for="chapter">Hoofdstuk</label>
        <select id="chapter"><option value="">Alle hoofdstukken (${total})</option>${chapterOpts}</select>
      </div>` : ''}
      ${P.chapter && P.chapter.id === 'ai' ? aiBannerHtml() : ''}`;
  }

  function aiBannerHtml() {
    return `<div class="ai-notice ai-banner">🤖 <strong>Deze vragen zijn gegenereerd door AI</strong> op basis van officiële documenten en de ECQB-leerdoelen. Lees altijd het officiële document na: bij elk antwoord staan de bron en de tekst waarop de vraag gebaseerd is.</div>`;
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
        ${questionHtml(P.q, { chosen: P.chosen, reveal: answered, locked: answered, counter: `Vraag ${P.roundPos} van ${P.roundSize}` })}
        ${answered ? feedbackHtml(P.q, P.chosen) : ''}
        ${answered && P.lastOfRound ? roundDoneHtml() : ''}
        <div class="quiz-actions">
          <a class="btn" href="#/${P.licence.toLowerCase()}">← Vakken</a>
          <div class="btn-row">
            <button class="btn" id="prev" ${P.pos > 0 ? '' : 'disabled'}>← Vorige</button>
            <button class="btn btn-primary" id="next">${answered && P.lastOfRound && P.pos === P.hist.length - 1 ? 'Nieuwe ronde →' : answered || P.pos < P.hist.length - 1 ? 'Volgende vraag →' : 'Overslaan →'}</button>
          </div>
        </div>
      </div>`, P.q, P.subject);
    app.querySelectorAll('.option').forEach(b => b.onclick = () => {
      if (P.chosen !== null) return;
      P.chosen = +b.dataset.i;
      P.hist[P.pos].chosen = P.chosen;
      const ok = P.chosen === P.q.c;
      store.set(P.deckKey + '.open', null);  // beantwoord: niet meer openstaand
      {  // score van de ronde, ook per deel
        const r = store.get(P.deckKey + '.ronde', { answered: 0, correct: 0, per: {} });
        r.per = r.per || {};
        const part = partOf(P.q), t = r.per[part] || [0, 0];
        r.answered++; t[0]++;
        if (ok) { r.correct++; t[1]++; }
        else (r.fout = r.fout || []).push({ id: P.q.id, keuze: P.q.o[P.chosen] });
        r.overgeslagen = (r.overgeslagen || []).filter(id => id !== P.q.id);  // later toch beantwoord
        r.per[part] = t;
        store.set(P.deckKey + '.ronde', r);
      }
      renderPractice();
      if (P.lastOfRound) { app.querySelector('.round-done')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return; }
      app.querySelector('.feedback')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    document.getElementById('next').onclick = () => nextPractice();
    document.getElementById('prev').onclick = () => prevPractice();
    document.getElementById('restart').onclick = () => restartPractice();
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
          <li>Na het inleveren krijg je je score en de uitleg bij elke vraag.</li>
          <li>Is de tijd om, dan kun je nog verder werken en later inleveren. Je resultaat vermeldt dan de overtijd en je score op het moment dat de tijd om was.</li>
        </ul>
        <div class="btn-row"><a class="btn" href="#/${licence.toLowerCase()}">Annuleren</a><button class="btn btn-accent" id="start">▶ Start proefexamen</button></div>
      </div>`;
    document.getElementById('start').onclick = () => startExam(licence, subject, n, minutes);
  }

  function startExam(licence, subject, n, minutes) {
    stopTimer();
    const questions = shuffle(questionsFor(licence, subject)).slice(0, n).map(present);
    exam = { licence, subject, n, minutes, questions, answers: Array(n).fill(null), flags: Array(n).fill(false), i: 0, remaining: minutes * 60, done: false };
    exam.timer = setInterval(() => {
      const E = exam;
      E.remaining--;
      const t = document.getElementById('timer');
      if (t) { t.textContent = fmtExamTime(E.remaining); t.classList.toggle('low', E.remaining <= 60 && E.remaining >= 0); t.classList.toggle('over', E.remaining < 0); }
      if (E.remaining === 0) {  // tijd om: niet automatisch inleveren, maar de stand van dat moment bewaren
        E.answersAtTime = E.answers.slice();
        ask({ title: '⏰ De tijd is om', ok: 'Nu inleveren', cancel: 'Verder werken',
          text: '<p>Op het echte examen wordt je examen nu automatisch ingeleverd.</p><p>Hier kun je nog verder werken en later inleveren. In je resultaat staat dan hoeveel overtijd je gebruikte en wat je score was op het moment dat de tijd om was.</p>'
        }).then(ok => { if (ok && exam === E) finishExam(); });
      }
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
        <div class="head-actions"><div class="timer ${E.remaining < 0 ? 'over' : E.remaining <= 60 ? 'low' : ''}" id="timer" aria-label="${E.remaining < 0 ? 'Overtijd' : 'Resterende tijd'}">${fmtExamTime(E.remaining)}</div>
          <button class="btn btn-small" id="restart" title="Dit examen stoppen en een nieuw proefexamen beginnen">⟲ Opnieuw beginnen</button></div>
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
    document.getElementById('restart').onclick = () => ask({
      title: 'Opnieuw beginnen?', ok: 'Nieuw proefexamen', cancel: 'Verder met dit examen',
      text: '<p>Dit proefexamen stoppen en een nieuw beginnen, met andere vragen en de volle tijd? Je antwoorden van dit examen worden niet bewaard.</p>'
    }).then(ok => { if (ok && exam === E && !E.done) startExam(E.licence, E.subject, E.n, E.minutes); });
    document.getElementById('submit').onclick = () => {
      const open = E.answers.map((a, k) => a === null ? k + 1 : 0).filter(Boolean);
      const flagged = E.flags.map((f, k) => f ? k + 1 : 0).filter(Boolean);
      const time = E.remaining >= 0 ? `Je hebt nog <strong>${fmtTime(E.remaining)}</strong> tijd.` : `<strong>De tijd is om</strong> (${fmtExamTime(E.remaining)} overtijd); dat komt in je resultaat.`;
      ask({
        title: 'Examen inleveren?', ok: 'Inleveren', cancel: 'Verder werken',
        text: `<p>${E.questions.length - open.length} van ${E.questions.length} vragen beantwoord. ${time}</p>
          ${open.length ? `<p class="modal-warn">⚠️ Nog niet beantwoord: vraag ${open.join(', ')}.</p>` : ''}
          ${flagged.length ? `<p>🚩 Gemarkeerd: vraag ${flagged.join(', ')}.</p>` : ''}
          <p class="small muted">Na het inleveren kun je je antwoorden niet meer wijzigen.</p>`
      }).then(ok => { if (ok && exam === E) finishExam(); });
    };
    bindImages();
  }

  function finishExam() {
    const E = exam;
    if (!E || E.done) return;
    E.done = true;
    stopTimer();
    document.querySelector('.modal-backdrop')?.remove();
    const L = LICENCES[E.licence];
    const score = answers => E.questions.reduce((n, q, k) => n + (answers[k] === q.c ? 1 : 0), 0);
    const correct = score(E.answers);
    const pct = Math.round(100 * correct / E.questions.length);
    const passed = pct >= L.passMark;
    // Ingeleverd na het einde van de tijd: overtijd en de score op het moment dat de tijd om was.
    const overtime = Math.max(0, -E.remaining);
    const late = E.answersAtTime ? (() => {
      const c = score(E.answersAtTime), p = Math.round(100 * c / E.questions.length);
      return { c, p, passed: p >= L.passMark };
    })() : null;
    const history = store.get(`exams.${E.licence}.${E.subject}`, []);
    history.unshift({ date: new Date().toISOString(), correct, total: E.questions.length, ...(late ? { overtime, correctAtTime: late.c } : {}) });
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
        <div class="pct">${pct}%</div>
        <p><strong>${correct} van ${E.questions.length} juist</strong> – ${passed ? `geslaagd (≥ ${L.passMark}%)` : `niet geslaagd (minimum ${L.passMark}%)`}</p>
        ${late ? `<div class="overtime-note"><p><strong>⏰ Ingeleverd ${fmtTime(overtime)} na het einde van de tijd</strong> (examentijd ${E.minutes} min).</p>
          <p>Op het moment dat de tijd om was, had je <strong>${late.c} van ${E.questions.length} juist (${late.p}%)</strong> – ${late.passed ? 'geslaagd' : 'niet geslaagd'}. Op het echte examen telt alleen dat resultaat.</p></div>` : ''}
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
        ${st.answered ? `<div class="subject-meta">Huidige sessie: ${st.correct}/${st.answered} juist (${pct}%)</div><div class="progress" title="Percentage juist in deze sessie"><span style="width:${pct}%"></span></div>` : ''}
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
    calc = { setKey, group, type, q: null, chosen: null, count: 0 };
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
    // Sessiescore per groep, bewaard tussen bezoeken; "Opnieuw beginnen" zet ze op nul.
    const key = `${SET.statsKey}.${C.group}`, st = store.get(key, { answered: 0, correct: 0 });
    const opts = gens.map(g => `<option value="${esc(g.id)}" ${C.type === g ? 'selected' : ''}>${esc(g.name)}</option>`).join('');
    app.innerHTML = `
      <div class="crumbs"><a href="#/">Home</a> › <a href="#/${C.setKey}">${esc(SET.title)}</a> › ${esc(G.name)}</div>
      <div class="quiz-head">
        <div><h1>${SET.icon} ${esc(G.name)}</h1><div class="muted small">${esc(SET.sub)}</div></div>
        <div class="head-actions"><span class="score-pill" title="Score sinds je deze sessie begon">Sessie: ${st.correct}/${st.answered}</span>
          <button class="btn btn-small" id="restart" title="Sessiescore op nul zetten">⟲ Opnieuw beginnen</button></div>
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
      st.answered++; if (ok) st.correct++;
      store.set(key, st);
      renderCalc();
      app.querySelector('.feedback')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    document.getElementById('next').onclick = () => nextCalc();
    document.getElementById('restart').onclick = () => ask({
      title: 'Opnieuw beginnen?', ok: 'Opnieuw beginnen',
      text: `<p>Je sessiescore voor ${esc(G.name)} (${st.correct}/${st.answered}) wordt op nul gezet.</p>`
    }).then(ok => { if (ok) { store.set(key, { answered: 0, correct: 0 }); renderCalc(); } });
    document.getElementById('calctype').onchange = e => {
      location.hash = `#/${C.setKey}/${C.group}${e.target.value ? '/' + e.target.value : ''}`;
    };
    bindImages();
    if (window.COMPASSCALC) window.COMPASSCALC.bind(app);
  }

  // ---------- settings ----------
  // Elke rij is een vak (of instrument) met de localStorage-sleutels die bij die voortgang horen.
  function viewSettings() {
    app.innerHTML = `
      <div class="crumbs"><a href="#/">Home</a> › Instellingen</div>
      <div class="card">
        <h1>Instellingen</h1>
        <h2 style="margin-top:16px">Voortgang</h2>
        <p class="muted">Je scores worden alleen lokaal in deze browser bewaard. Opnieuw beginnen met een vak doe je in het vak zelf, met “⟲ Opnieuw beginnen”. Hier kun je alles in één keer wissen.</p>
        <button class="btn" id="reset">Alle voortgang wissen</button>
        <p id="msg" class="small"></p>
      </div>`;
    document.getElementById('reset').onclick = () => {
      ask({ title: 'Alle voortgang wissen?', text: '<p>Alle lokale scores en voortgang in deze browser worden gewist. Dat kan niet ongedaan gemaakt worden.</p>', ok: 'Alles wissen', danger: true }).then(ok => {
        if (!ok) return;
        Object.keys(localStorage).filter(k => k.startsWith('pplulm.')).forEach(k => localStorage.removeItem(k));
        viewSettings();
        document.getElementById('msg').textContent = 'Alle voortgang gewist.';
      });
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

  // ---------- bezoekersteller (GoatCounter, zonder cookies) ----------
  // De site gebruikt #/-adressen; daarom tellen we zelf bij elke paginawissel (vak, oefening, examen …).
  function countView(parts) {
    const code = window.ANALYTICS && window.ANALYTICS.goatcounter;
    if (!code) return;
    const path = '/' + parts.slice(0, 3).join('/');
    const send = () => window.goatcounter && window.goatcounter.count && window.goatcounter.count({ path, title: document.title });
    if (window.goatcounter && window.goatcounter.count) return send();
    if (!document.getElementById('gc-script')) {
      const sc = document.createElement('script');
      sc.id = 'gc-script'; sc.async = true; sc.src = 'https://gc.zgo.at/count.js';
      sc.dataset.goatcounter = `https://${code}.goatcounter.com/count`;
      sc.dataset.goatcounterSettings = JSON.stringify({ no_onload: true });
      sc.onload = send;
      document.head.appendChild(sc);
    }
  }

  // ---------- router ----------
  function route() {
    if (exam && !exam.done) { stopTimer(); exam = null; } // leaving a running exam
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    const licence = (parts[0] || '').toUpperCase();
    document.querySelectorAll('.topnav a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#/' + (parts[0] || '')));
    window.scrollTo(0, 0);
    countView(parts);
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
