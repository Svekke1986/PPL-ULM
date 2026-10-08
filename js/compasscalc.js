// Kompasrekenmachine: graden optellen/aftrekken en terugbrengen naar 0–360°.
// Alleen zichtbaar in de oefenmodus (niet tijdens een proefexamen).
// Luchtvaartstandaard: noorden als koers = 360°, als radiaal of peiling = 000°.

window.COMPASSCALC = (function () {
  'use strict';

  const state = { a: '', op: '+', b: '' };
  let lastQ = null; // bij een nieuwe vraag worden de velden en het resultaat leeggemaakt
  const OPEN_KEY = 'pplulm.compasscalc.open';

  const pad = v => String(v).padStart(3, '0');
  const norm = v => ((v % 360) + 360) % 360;
  const rad = d => d * Math.PI / 180;

  // Is dit een vraag waarbij je met graden (richtingen) rekent?
  function relevant(q) {
    const txt = [q.q, ...(q.o || [])].join(' ');
    return /\d{1,3}\s*°(?!\s*[CF])/.test(txt) || /\b(QDM|QDR|QTE|QUJ|radiaal|koers|peiling|variatie|deviatie)\b/i.test(q.q);
  }

  function compute() {
    const a = parseFloat(String(state.a).replace(',', '.'));
    const b = parseFloat(String(state.b).replace(',', '.'));
    if (!isFinite(a) || !isFinite(b)) return null;
    const raw = state.op === '+' ? a + b : a - b;
    const res = Math.round(norm(raw) * 10) / 10;
    const turns = Math.round((res - raw) / 360); // aantal keer +360 (negatief = −360)
    return { a, b, raw, res, turns };
  }

  function fmt(v) {
    const r = Math.round(v * 10) / 10;
    const s = Number.isInteger(r) ? pad(Math.abs(r)) : String(Math.abs(r)).replace('.', ',');
    return (r < 0 ? '−' : '') + s + '°';
  }

  function resultHtml() {
    const r = compute();
    if (!r) return '<p class="muted small">Vul een startwaarde en een aantal graden in.</p>';
    const opSym = state.op === '+' ? '+' : '−';
    const disp = r.res === 0 ? '360° (noorden)' : fmt(r.res);
    const steps = [`${fmt(r.a)} ${opSym} ${fmt(Math.abs(r.b))} = ${fmt(r.raw)}`];
    if (r.turns < 0) steps.push(`${fmt(r.raw)} is ${r.raw === 360 ? 'precies' : 'meer dan'} 360°: trek ${Math.abs(r.turns) > 1 ? Math.abs(r.turns) + ' × ' : ''}360° af → ${disp}`);
    if (r.turns > 0) steps.push(`${fmt(r.raw)} is negatief: tel ${r.turns > 1 ? r.turns + ' × ' : ''}360° op → ${disp}`);
    const north = r.res === 0;
    const main = north ? '360°' : fmt(r.res);
    const sweep = norm(r.b);
    const dirTxt = state.op === '+' ? 'rechtsom' : 'linksom';
    const tip = sweep > 180
      ? `Let op: ${sweep}° ${dirTxt} is dezelfde eindrichting als ${360 - sweep}° ${state.op === '+' ? 'linksom' : 'rechtsom'} (korter).`
      : '';
    return `
      <div class="ccalc-result">
        <div class="ccalc-big">${main}</div>
        <div class="small">${steps.join('<br>')}</div>
        ${north ? '<div class="small">Noorden: als koers schrijf je 360°, als radiaal of peiling 000°.</div>' : ''}
        ${tip ? `<div class="small muted">${tip}</div>` : ''}
      </div>
      ${roseSvg(r.a, r.res, state.op, sweep)}`;
  }

  // Kleine kompasroos: beginrichting (grijs), draai (oranje boog) en eindrichting (blauw).
  function roseSvg(a, res, op, sweep) {
    const c = 70, r = 52;
    const P = (d, rr) => [c + Math.sin(rad(d)) * rr, c - Math.cos(rad(d)) * rr];
    const f = n => n.toFixed(1);
    const [ax, ay] = P(a, r - 6), [ex, ey] = P(res, r - 6);
    const [s1x, s1y] = P(a, 30);
    const end = op === '+' ? a + sweep : a - sweep;
    const [s2x, s2y] = P(end, 30);
    const large = sweep > 180 ? 1 : 0, cw = op === '+' ? 1 : 0;
    const arc = sweep > 0 && sweep < 360 ? `<path d="M${f(s1x)},${f(s1y)} A30,30 0 ${large} ${cw} ${f(s2x)},${f(s2y)}" fill="none" stroke="#d97706" stroke-width="2.5"/>` : '';
    const lbl = (d, t) => { const [x, y] = P(d, r + 10); return `<text x="${f(x)}" y="${f(y)}" font-size="10" text-anchor="middle" dominant-baseline="central" fill="currentColor">${t}</text>`; };
    return `<svg class="ccalc-rose" viewBox="0 0 140 140" width="140" height="140" aria-label="Kompasroos">
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="currentColor" stroke-opacity=".35"/>
      ${lbl(0, 'N')}${lbl(90, 'O')}${lbl(180, 'Z')}${lbl(270, 'W')}
      ${arc}
      <line x1="${c}" y1="${c}" x2="${f(ax)}" y2="${f(ay)}" stroke="#8a94a6" stroke-width="3" stroke-linecap="round"/>
      <line x1="${c}" y1="${c}" x2="${f(ex)}" y2="${f(ey)}" stroke="#2f7cf6" stroke-width="3" stroke-linecap="round"/>
      <circle cx="${c}" cy="${c}" r="3" fill="currentColor"/>
    </svg>`;
  }

  function html(q) {
    if (q !== lastQ) { lastQ = q; state.a = ''; state.b = ''; state.op = '+'; }
    if (!relevant(q)) return '';
    // Breed scherm: naast de vraag, standaard open. Mobiel: eronder, open/dicht zoals de gebruiker het laatst koos.
    let open = window.matchMedia && window.matchMedia('(min-width: 1000px)').matches;
    if (!open) { try { open = localStorage.getItem(OPEN_KEY) === '1'; } catch (e) { /* ignore */ } }
    return `<details class="ccalc" ${open ? 'open' : ''}>
      <summary>🧭 Kompasrekenmachine</summary>
      <div class="ccalc-body">
        <div class="ccalc-row">
          <input id="cc-a" inputmode="decimal" placeholder="start, bv. 100" value="${state.a}" aria-label="Startwaarde in graden">
          <div class="ccalc-ops">
            <button type="button" class="btn ${state.op === '+' ? 'btn-primary' : ''}" data-op="+" aria-label="optellen">+</button>
            <button type="button" class="btn ${state.op === '-' ? 'btn-primary' : ''}" data-op="-" aria-label="aftrekken">−</button>
          </div>
          <input id="cc-b" inputmode="decimal" placeholder="graden, bv. 345" value="${state.b}" aria-label="Aantal graden">
        </div>
        <div class="ccalc-quick">
          <button type="button" class="btn" data-quick="180">± 180° (omkeren)</button>
          <button type="button" class="btn" data-quick="clear">Wissen</button>
        </div>
        <div id="cc-out">${resultHtml()}</div>
      </div>
    </details>`;
  }

  function bind(root) {
    const box = root.querySelector('.ccalc');
    if (!box) return;
    const out = box.querySelector('#cc-out');
    const refresh = () => { out.innerHTML = resultHtml(); };
    box.addEventListener('toggle', () => {
      if (window.matchMedia && window.matchMedia('(min-width: 1000px)').matches) return; // naast de vraag: niet onthouden
      try { localStorage.setItem(OPEN_KEY, box.open ? '1' : '0'); } catch (e) { /* ignore */ }
    });
    box.querySelector('#cc-a').oninput = e => { state.a = e.target.value; refresh(); };
    box.querySelector('#cc-b').oninput = e => { state.b = e.target.value; refresh(); };
    box.querySelectorAll('[data-op]').forEach(btn => btn.onclick = () => {
      state.op = btn.dataset.op;
      box.querySelectorAll('[data-op]').forEach(b2 => b2.classList.toggle('btn-primary', b2.dataset.op === state.op));
      refresh();
    });
    box.querySelectorAll('[data-quick]').forEach(btn => btn.onclick = () => {
      if (btn.dataset.quick === 'clear') { state.a = ''; state.b = ''; state.op = '+'; }
      else { state.b = '180'; if (state.a === '') state.a = ''; }
      box.querySelector('#cc-a').value = state.a;
      box.querySelector('#cc-b').value = state.b;
      box.querySelectorAll('[data-op]').forEach(b2 => b2.classList.toggle('btn-primary', b2.dataset.op === state.op));
      refresh();
    });
  }

  return { html, bind, relevant, _compute: () => compute(), _state: state };
})();
