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

  // Helicopter rotor: a low sawtooth chopped by an 11 Hz square LFO.
  // Louder the higher the heli flies.
  setRotor(on, alt01) {
    if (!this.ctx) return;
    if (!this.rotorOsc) {
      try {
        this.rotorOsc = this.ctx.createOscillator();
        this.rotorOsc.type = 'sawtooth';
        this.rotorOsc.frequency.value = 82;
        this.rotorGain = this.ctx.createGain();
        this.rotorGain.gain.value = 0;
        const lfo = this.ctx.createOscillator();
        lfo.type = 'square';
        lfo.frequency.value = 11;
        const lg = this.ctx.createGain();
        lg.gain.value = 0.014;
        lfo.connect(lg);
        lg.connect(this.rotorGain.gain);
        this.rotorOsc.connect(this.rotorGain);
        this.rotorGain.connect(this.master);
        this.rotorOsc.start();
        lfo.start();
      } catch { this.rotorOsc = null; return; }
    }
    this.rotorGain.gain.setTargetAtTime(on ? 0.02 + alt01 * 0.03 : 0, this.ctx.currentTime, 0.15);
  }

  // The PD heli announcing itself.
  sirenHeli() {
    this._tone(660, 0.16, 0.2, 'square', 880);
    setTimeout(() => this._tone(880, 0.16, 0.2, 'square', 660), 180);
  }

  // In-car radio: a tiny step sequencer. Each station is a bpm + root +
  // scale (see config RADIO_STATIONS); every step plays a bass note on the
  // beat and a lead note walking the scale. A lookahead timer keeps the
  // loop steady; -1 switches the radio off.
  setRadio(station) {
    if (!this.ctx) return;
    if (station < 0) {
      if (this.radioTimer) { clearInterval(this.radioTimer); this.radioTimer = null; }
      this.radioStation = -1;
      return;
    }
    if (this.radioStation === station && this.radioTimer) return;
    this.radioStation = station;
    if (this.radioTimer) clearInterval(this.radioTimer);
    this.radioStep = 0;
    // Station data is passed in through the window hook the game sets:
    // radio.js hands the station object to audio via setRadioStation.
    const st = this.radioData;
    if (!st) return;
    const stepMs = (60 / st.bpm / 4) * 1000;
    this.radioTimer = setInterval(() => {
      if (!this.ctx || this.radioStation < 0) return;
      const step = this.radioStep++ % 16;
      const scale = st.scale;
      const root = st.root;
      // Bass on the beat, root or fifth.
      if (step % 4 === 0) {
        const semis = step === 8 ? 7 : 0;
        this._tone(root / 2 * Math.pow(2, semis / 12), 0.22, 0.16, 'triangle');
      }
      // Lead walks the scale, one note per step, seeded by the station.
      const idx = (step * 2 + (st.tag === 'latin' ? 1 : 0) + (step % 3)) % scale.length;
      const semis = scale[idx] + 12;
      if (step % 2 === 0) this._tone(root * Math.pow(2, semis / 12), 0.14, 0.07, 'square');
    }, stepMs);
  }

  // The game hands the current station's data here before setRadio plays it.
  setRadioStationData(st) { this.radioData = st; }

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
