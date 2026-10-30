/* Eenvoudige geluiden met WebAudio: klik, waarschuwing, hoogte-alert, AP-ontkoppeling, timer. */
window.G3X = window.G3X || {};
(function () {
  const AU = { ctx: null, enabled: () => G3X.avionics && G3X.avionics.A.sound, last: {} };
  AU.ensure = () => { if (!AU.ctx) { try { AU.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AU.ctx = null; } } if (AU.ctx && AU.ctx.state === 'suspended') AU.ctx.resume(); };
  function tone(freq, t0, dur, type = 'sine', gain = 0.12) {
    const c = AU.ctx; const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = 0;
    o.connect(g); g.connect(c.destination);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + 0.01); g.gain.setValueAtTime(gain, t0 + dur - 0.02); g.gain.linearRampToValueAtTime(0, t0 + dur);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  AU.play = name => {
    if (!AU.enabled() || !AU.ctx) return;
    const now = performance.now(); if (AU.last[name] && now - AU.last[name] < 400) return; AU.last[name] = now;
    const t = AU.ctx.currentTime;
    switch (name) {
      case 'click': tone(1200, t, 0.03, 'square', 0.04); break;
      case 'warn': for (let i = 0; i < 3; i++) tone(880, t + i * 0.18, 0.12, 'square', 0.1); break;
      case 'caution': for (let i = 0; i < 2; i++) tone(620, t + i * 0.22, 0.14, 'triangle', 0.1); break;
      case 'adv': tone(520, t, 0.12, 'sine', 0.08); break;
      case 'altalert': tone(1000, t, 0.12); tone(800, t + 0.15, 0.12); break;
      case 'apdisc': for (let i = 0; i < 3; i++) { tone(700, t + i * 0.3, 0.1, 'sawtooth', 0.08); tone(500, t + i * 0.3 + 0.1, 0.1, 'sawtooth', 0.08); } break;
      case 'minimums': for (let i = 0; i < 3; i++) tone(950, t + i * 0.12, 0.08, 'square', 0.08); break;
      case 'timer': for (let i = 0; i < 4; i++) tone(1300, t + i * 0.15, 0.08, 'square', 0.07); break;
      case 'stall': tone(400, t, 0.35, 'sawtooth', 0.09); break;
      case 'ok': tone(660, t, 0.08); tone(880, t + 0.09, 0.14); break;
      case 'fail': tone(300, t, 0.25, 'triangle', 0.1); break;
    }
  };
  G3X.audio = AU;
})();
