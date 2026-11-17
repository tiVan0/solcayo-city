// Solcayo — synthesized WebAudio: engine hum, police siren, beeps, jingles,
// a soft procedural music loop. No audio files, no network.
export function createAudio() {
  const audio = {
    ctx: null, muted: false, sirenOn: false,
    engineOsc: null, engineGain: null, sirenOsc: null, sirenGain: null,
    musicTimer: 0, musicStep: 0,
    ensure() {
      if (audio.ctx) return true;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        audio.ctx = new AC();
        // Engine: a low sawtooth whose pitch follows speed.
        audio.engineOsc = audio.ctx.createOscillator();
        audio.engineOsc.type = 'sawtooth';
        audio.engineOsc.frequency.value = 60;
        audio.engineGain = audio.ctx.createGain();
        audio.engineGain.gain.value = 0;
        audio.engineOsc.connect(audio.engineGain).connect(audio.ctx.destination);
        audio.engineOsc.start();
        // Siren: a sine that wails between two notes.
        audio.sirenOsc = audio.ctx.createOscillator();
        audio.sirenOsc.type = 'sine';
        audio.sirenOsc.frequency.value = 700;
        audio.sirenGain = audio.ctx.createGain();
        audio.sirenGain.gain.value = 0;
        audio.sirenOsc.connect(audio.sirenGain).connect(audio.ctx.destination);
        audio.sirenOsc.start();
        return true;
      } catch {
        return false;
      }
    },
    setMuted(m) {
      audio.muted = m;
      if (audio.ctx) audio.ctx.suspend?.();
      if (!m && audio.ctx) audio.ctx.resume?.();
    },
    engine(speed, top) {
      if (!audio.ctx || audio.muted) return;
      const ratio = Math.abs(speed) / Math.max(1, top);
      audio.engineOsc.frequency.value = 55 + ratio * 140;
      audio.engineGain.gain.value = speed !== 0 ? 0.02 + ratio * 0.03 : 0;
    },
    siren(on) {
      audio.sirenOn = on;
      if (!audio.ctx) return;
      audio.sirenGain.gain.value = on && !audio.muted ? 0.025 : 0;
    },
    updateSiren(tick) {
      if (!audio.ctx || !audio.sirenOn || audio.muted) return;
      audio.sirenOsc.frequency.value = 650 + 250 * Math.sin(tick * 0.12);
    },
    beep(freq, dur) {
      if (!audio.ctx || audio.muted) return;
      try {
        const o = audio.ctx.createOscillator();
        const g = audio.ctx.createGain();
        o.type = 'square'; o.frequency.value = freq;
        g.gain.setValueAtTime(0.06, audio.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + dur);
        o.connect(g).connect(audio.ctx.destination);
        o.start(); o.stop(audio.ctx.currentTime + dur);
      } catch { /* audio is best-effort */ }
    },
    punch() { audio.beep(180, 0.09); },
    horn() { audio.beep(340, 0.18); },
    jingle() {
      if (!audio.ctx || audio.muted) return;
      [523, 659, 784, 1046].forEach((f, i) => {
        setTimeout(() => audio.beep(f, 0.16), i * 110);
      });
    },
    // A lazy 8-bar loop: a soft triangle bass + a pentatonic pluck, scheduled
    // one step per tick so it costs nothing when the tab is hidden.
    updateMusic(dt, tick) {
      if (!audio.ctx || audio.muted) return;
      audio.musicTimer += dt;
      if (audio.musicTimer < 24) return;
      audio.musicTimer = 0;
      const scale = [262, 294, 330, 392, 440, 523];
      const note = scale[audio.musicStep % scale.length];
      audio.musicStep += 1;
      try {
        const o = audio.ctx.createOscillator();
        const g = audio.ctx.createGain();
        o.type = 'triangle'; o.frequency.value = note;
        g.gain.setValueAtTime(0.025, audio.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + 0.5);
        o.connect(g).connect(audio.ctx.destination);
        o.start(); o.stop(audio.ctx.currentTime + 0.5);
      } catch { /* best-effort */ }
    },
  };
  return audio;
}
