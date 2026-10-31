/* Eenvoudige vectoricoontjes (SVG) in de stijl van de G3X Touch-hoofdmenutegels: witte lijntekening op blauw. */
window.G3X = window.G3X || {};
(function () {
  const s = body => `<svg viewBox="0 0 48 48" width="40" height="40" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  G3X.icons = {
    MAP: s('<path d="M6 12l12-4 12 4 12-4v28l-12 4-12-4-12 4z"/><path d="M18 8v28M30 12v28"/>'),
    CHARTS: s('<rect x="10" y="6" width="28" height="36" rx="2"/><path d="M16 16h16M16 23h16M16 30h10"/>'),
    FPL: s('<circle cx="10" cy="36" r="3"/><circle cx="38" cy="12" r="3"/><path d="M12 34l10-8 8 2 6-14"/><path d="M34 10l6-2-2 6"/>'),
    WPT: s('<path d="M24 42s-12-11-12-20a12 12 0 0124 0c0 9-12 20-12 20z"/><circle cx="24" cy="22" r="4"/>'),
    NRST: s('<circle cx="24" cy="24" r="16"/><circle cx="24" cy="24" r="8"/><circle cx="24" cy="24" r="1.5" fill="#fff"/><path d="M24 4v6M24 38v6M4 24h6M38 24h6"/>'),
    WX: s('<path d="M14 34a7 7 0 010-14 10 10 0 0119 2 6 6 0 01-1 12z"/><path d="M18 40l-2 4M26 40l-2 4M34 40l-2 4"/>'),
    TRAFFIC: s('<path d="M24 6l18 18-18 18L6 24z"/><path d="M24 16v16M16 24h16"/>'),
    TERRAIN: s('<path d="M4 40l12-20 8 12 6-8 14 16z"/><path d="M16 20l-3-5"/>'),
    ENG: s('<path d="M8 32a16 16 0 0132 0"/><path d="M24 32l8-12"/><circle cx="24" cy="32" r="2.5" fill="#fff"/><path d="M12 30h3M33 30h3M24 18v3"/>'),
    TIMER: s('<circle cx="24" cy="27" r="15"/><path d="M24 17v10l6 4"/><path d="M19 6h10M24 6v6M38 12l3-3"/>'),
    CHK: s('<rect x="8" y="8" width="32" height="32" rx="3"/><path d="M15 25l6 6 12-14"/>'),
    FPLLIST: s('<path d="M6 12h14l4 4h18v24H6z"/><path d="M12 26h24M12 32h16"/>'),
    INFO: s('<circle cx="24" cy="24" r="17"/><path d="M24 22v12"/><circle cx="24" cy="15" r="1.8" fill="#fff"/>'),
    USER: s('<path d="M24 6l5.5 11.5L42 19l-9 8.8 2.2 12.6L24 34.4l-11.2 6L15 27.8 6 19l12.5-1.5z"/>'),
    SETUP: s('<circle cx="24" cy="24" r="6"/><path d="M24 4v6M24 38v6M4 24h6M38 24h6M9.9 9.9l4.2 4.2M33.9 33.9l4.2 4.2M9.9 38.1l4.2-4.2M33.9 14.1l4.2-4.2"/>'),
    PFD: s('<rect x="6" y="8" width="36" height="32" rx="3"/><path d="M6 24h36"/><path d="M14 18h20M18 30h12"/><path d="M20 24h8"/>'),
    MSG: s('<rect x="6" y="10" width="36" height="26" rx="3"/><path d="M6 14l18 12 18-12"/>'),
    TRIP: s('<rect x="10" y="6" width="28" height="36" rx="3"/><rect x="15" y="11" width="18" height="8"/><path d="M16 26h4M22 26h4M28 26h4M16 33h4M22 33h4M28 33h4"/>'),
    PROC: s('<path d="M6 36h36"/><path d="M10 12l20 20"/><path d="M26 32h4v-4"/><path d="M34 14l6 2-2 6"/>'),
    TOOLS: s('<path d="M30 8a8 8 0 00-9.6 10.5L8 30.9 17.1 40l12.4-12.4A8 8 0 0040 18l-6 6-4-4z"/>'),
    MUSIC: s('<path d="M18 36V12l20-4v24"/><circle cx="14" cy="36" r="4"/><circle cx="34" cy="32" r="4"/>'),
    DTO: `<svg viewBox="0 0 48 48" width="34" height="34" fill="none" stroke="#ff2bff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 10h12a14 14 0 010 28H8z"/><path d="M24 24h18M36 18l6 6-6 6"/></svg>`,
    HOME: `<svg viewBox="0 0 48 48" width="22" height="22" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"><path d="M6 24L24 8l18 16"/><path d="M12 22v18h24V22"/></svg>`,
  };
})();
