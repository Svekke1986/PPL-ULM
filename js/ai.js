// Optionele AI-vraaggenerator (Google Gemini) met de eigen API-sleutel van de gebruiker.
// De sleutel wordt alleen lokaal in de browser bewaard (localStorage) en rechtstreeks naar Google gestuurd.

window.AI = (function () {
  const KEY = 'pplulm.ai';
  const DEFAULTS = { enabled: false, apiKey: '', model: 'gemini-2.5-flash', mix: true };

  function settings() {
    try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch (e) { return Object.assign({}, DEFAULTS); }
  }
  function save(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode */ }
  }
  function available() {
    const s = settings();
    return s.enabled && !!s.apiKey;
  }

  function buildPrompt(licence, subjectKey, examples, chapterName) {
    const subj = window.SUBJECTS[subjectKey];
    const lic = window.LICENCES[licence];
    const sourceList = Object.entries(window.SOURCES)
      .map(([k, v]) => `- "${k}": ${v.org} – ${v.title}`).join('\n');
    const ex = examples.map(q => JSON.stringify({
      question: q.q, options: q.o, correct: q.c, explanation: q.e, source: q.src, ref: q.ref
    })).join('\n');
    return `Je bent examinator voor het Belgische theorie-examen ${lic.name} (${lic.full}).
Schrijf EEN nieuwe meerkeuzevraag in het Nederlands voor het vak "${subj.name}" (${subj.en}, ECQB-vak ${subj.code})${chapterName ? `, hoofdstuk "${chapterName}"` : ''}.

Eisen:
- Stijl en moeilijkheid zoals het officiële ECQB/DGLV-examen (zie voorbeelden).
- Precies 4 antwoordopties die qua vorm en lengte sterk op elkaar lijken; exact één is juist.
- Geen "alle bovenstaande" of "geen van beide".
- Geef een korte, feitelijk correcte uitleg waarom het juiste antwoord juist is en waarom de andere fout zijn.
- Verwijs naar een officiële bron: kies "source" uit deze lijst en geef in "ref" het precieze artikel/hoofdstuk (bv. "SERA.5001" of "Part-FCL FCL.025"). Verzin geen artikels; als je het exacte artikel niet zeker weet, geef dan alleen het hoofdstuk.
${sourceList}
- Gebruik voor de Belgische AIP de source "aip:HOOFDSTUK", bv. "aip:ENR-1.4".
- Herhaal geen van de voorbeeldvragen.

Voorbeelden uit de vragenbank:
${ex}

Antwoord UITSLUITEND met JSON in dit formaat:
{"question": "...", "options": ["...","...","...","..."], "correct": 0, "explanation": "...", "source": "sera", "ref": "..."}`;
  }

  async function generate(licence, subjectKey, examples, chapterName) {
    const s = settings();
    if (!s.apiKey) throw new Error('Geen API-sleutel ingesteld (zie Instellingen).');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(s.model)}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': s.apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(licence, subjectKey, examples, chapterName) }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.9 }
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Gemini API ${res.status}: ${err.error?.message || res.statusText}`);
    }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    const obj = JSON.parse(text.replace(/```json|```/g, '').trim());
    if (!obj.question || !Array.isArray(obj.options) || obj.options.length !== 4 ||
        !Number.isInteger(obj.correct) || obj.correct < 0 || obj.correct > 3) {
      throw new Error('De AI gaf geen geldige vraag terug. Probeer opnieuw.');
    }
    return {
      id: 'ai-' + Date.now(),
      lo: '', loText: '',
      q: String(obj.question),
      o: obj.options.map(String),
      c: obj.correct,
      img: [],
      e: String(obj.explanation || ''),
      src: String(obj.source || 'syl'),
      ref: String(obj.ref || ''),
      review: false,
      ai: true
    };
  }

  return { settings, save, available, generate };
})();
