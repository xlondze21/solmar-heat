// Solmar Heat — audio.js
// Synthesized WebAudio only: engine hum, two-tone siren, gunshot, pickup blip,
// crash thud, punch thump. No audio files, no network. Every method is a
// no-op until ensure() runs on a user gesture, and a no-op in Node.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenLfo = null;
    this.muted = false;
  }

  ensure() {
    if (this.ctx || typeof window === 'undefined') return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      // Engine: sawtooth through a lowpass, pitch follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 50;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 420;
      this.engineOsc.connect(filt);
      filt.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      // Siren: square wave wobbling between two tones.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'square';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenLfo = this.ctx.createOscillator();
      this.sirenLfo.type = 'square';
      this.sirenLfo.frequency.value = 0.9;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 260;
      this.sirenLfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.sirenLfo.start();
    } catch {
      this.ctx = null;
    }
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  setEngine(speed01, driving) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(46 + speed01 * 130, t, 0.08);
    this.engineGain.gain.setTargetAtTime(driving ? 0.05 + speed01 * 0.06 : 0, t, 0.1);
  }

  setSiren(on) {
    if (!this.ctx) return;
    this.sirenGain.gain.setTargetAtTime(on ? 0.028 : 0, this.ctx.currentTime, 0.2);
  }

  _burst(duration, filterFreq, gain, type = 'lowpass') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(filt);
    filt.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  _tone(freq, duration, gain, type = 'sine', slideTo = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  shot() { this._burst(0.14, 2400, 0.5, 'highpass'); this._tone(160, 0.09, 0.25, 'square', 60); }
  punch() { this._burst(0.08, 300, 0.4); }
  crash(hard) { this._burst(hard ? 0.3 : 0.15, 220, hard ? 0.6 : 0.3); }
  blip() { this._tone(880, 0.12, 0.2, 'sine', 1320); }
  denied() { this._tone(180, 0.18, 0.2, 'square', 120); }
  missionDone() {
    this._tone(523, 0.14, 0.22, 'triangle');
    setTimeout(() => this._tone(659, 0.14, 0.22, 'triangle'), 130);
    setTimeout(() => this._tone(784, 0.22, 0.22, 'triangle'), 260);
  }
  busted() { this._tone(392, 0.4, 0.25, 'sawtooth', 196); }
}
