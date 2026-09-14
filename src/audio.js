import {assetUrl} from "./assets.js";
/* Procedural sound for the book: a music-box lullaby bed, and small tactile effects
   (page turns, chimes, pops, hoots, purrs). Everything is synthesized with Web Audio so
   the book needs no sound files beyond the narration. */

const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];

function midiToHz(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

export class SoundKit {
  constructor(context) {
    this.ctx = context;
    this.master = context.createGain();
    this.master.gain.value = 0.9;
    this.music = context.createGain();
    this.music.gain.value = 0.35;
    this.sfx = context.createGain();
    this.sfx.gain.value = 0.7;
    this.music.connect(this.master);
    this.sfx.connect(this.master);
    this.master.connect(context.destination);
    this.reverb = this.makeReverb(2.6, 0.32);
    this.reverbSend = context.createGain();
    this.reverbSend.gain.value = 0.35;
    this.reverbSend.connect(this.reverb).connect(this.master);
    this.muted = false;
    this.lullaby = null;
    this.noise = this.makeNoise();
    // recorded sounds: shared effects (public/audio/sfx) and a book's music and ambience
    this.bank = {};
    this.musicTrack = null;
    this.musicSource = null;
    this.ambienceTrack = null;
    this.ambienceVolume = 0.3;
    this.ambienceSource = null;
    this.ambienceGain = context.createGain();
    this.ambienceGain.gain.value = 0;
    this.ambienceGain.connect(this.sfx);
  }

  /* ---------- recorded sounds ---------- */

  /** Decode a set of { name: url } into the bank (missing files are simply skipped). */
  async loadSamples(entries) {
    await Promise.all(Object.entries(entries).map(async ([name, url]) => {
      try {
        const res = await fetch(assetUrl(url));
        if (!res.ok) return;
        this.bank[name] = await this.ctx.decodeAudioData(await res.arrayBuffer());
      } catch (error) { /* optional */ }
    }));
  }

  /** Play a recorded sound if the bank has it; returns false so callers can fall back to synthesis. */
  sample(name, { volume = 0.8, rate = 1, reverb = 0.2, out = this.sfx } = {}) {
    const buffer = this.bank[name];
    if (!buffer) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g).connect(out);
    if (reverb > 0) { const send = this.ctx.createGain(); send.gain.value = reverb; g.connect(send).connect(this.reverbSend); }
    src.start();
    return true;
  }

  async decode(url) {
    try { const res = await fetch(assetUrl(url)); if (!res.ok) return null; return await this.ctx.decodeAudioData(await res.arrayBuffer()); } catch (error) { return null; }
  }

  /** The book's music: a recorded loop when it has one, else the music-box lullaby. */
  setMusicTrack(buffer) { this.musicTrack = buffer || null; }
  setAmbience(buffer, volume = 0.3) { this.ambienceTrack = buffer || null; this.ambienceVolume = volume; }

  createLoopSource(buffer) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    // A loop ending exactly on a 128-frame boundary can repeat the last render block
    // indefinitely in Chromium. Leave one sample off aligned buffers (23 µs at 44.1 kHz).
    if (buffer.length > 1 && buffer.length % 128 === 0) {
      src.loopEnd = (buffer.length - 1) / buffer.sampleRate;
    }
    return src;
  }

  /** Start the current track (the site's own on the shelf, a book's inside it), crossfading
      out of whatever was playing. With no track, the music-box lullaby plays. */
  startMusic() {
    this.stopMusic(this.musicSource ? 1.6 : 0.01);
    if (!this.musicTrack) { this.startLullaby(); return; }
    const src = this.createLoopSource(this.musicTrack);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(1, this.ctx.currentTime + 2.5);
    src.connect(g).connect(this.music);
    src.start();
    this.musicSource = { src, g };
  }

  stopMusic(fade = 1.2) {
    this.stopLullaby();
    const m = this.musicSource;
    if (!m) return;
    this.musicSource = null;
    const t = this.ctx.currentTime;
    m.g.gain.setTargetAtTime(0.0001, t, fade / 3);
    setTimeout(() => { try { m.src.stop(); } catch (error) { /* already stopped */ } }, fade * 1000 + 100);
  }

  startAmbience() {
    this.stopAmbience(0.01);
    if (!this.ambienceTrack) return;
    const src = this.createLoopSource(this.ambienceTrack);
    src.connect(this.ambienceGain);
    this.ambienceGain.gain.setTargetAtTime(this.ambienceVolume, this.ctx.currentTime, 1.2);
    src.start();
    this.ambienceSource = src;
  }

  stopAmbience(fade = 1.2) {
    const src = this.ambienceSource;
    if (!src) return;
    this.ambienceSource = null;
    this.ambienceGain.gain.setTargetAtTime(0, this.ctx.currentTime, fade / 3);
    setTimeout(() => { try { src.stop(); } catch (error) { /* already stopped */ } }, fade * 1000 + 100);
  }

  /* ---------- creature calls and story sounds (recorded when available) ---------- */

  quack(note = 3, volume = 0.6) { if (!this.sample("quack", { volume, rate: 0.95 + (note % 5) * 0.03 })) this.chime(5, volume); }
  baa(note = 1, volume = 0.6) { if (!this.sample("baa", { volume, rate: 0.95 + (note % 5) * 0.03 })) this.chime(1, volume); }
  caw(note = 0, volume = 0.55) { if (!this.sample("caw", { volume, rate: 0.95 + (note % 5) * 0.03 })) this.chime(0, volume); }
  whale(note = 0, volume = 0.7) { if (!this.sample("whale", { volume, rate: 1, reverb: 0.5 })) this.chime(0, volume); }
  giggle(note = 5, volume = 0.6) { if (!this.sample("giggle", { volume, rate: 0.95 + (note % 5) * 0.03 })) this.chime(6, volume); }
  bubbles(note = 3, volume = 0.5) { if (!this.sample("bubbles", { volume, rate: 0.9 + Math.random() * 0.2 })) this.pop(1.4); }
  flutter(note = 3, volume = 0.5) { if (!this.sample("flutter", { volume, rate: 0.9 + Math.random() * 0.2 })) this.puff(); }
  sneeze(note = 3, volume = 0.7) { if (!this.sample("sneeze", { volume })) { this.whoosh(true); setTimeout(() => this.pop(1.4), 220); } }
  snap(note = 3, volume = 0.55) { if (!this.sample("snap", { volume, rate: 0.95 + (note % 5) * 0.04 })) this.click(); }
  boing(note = 3, volume = 0.5) { if (!this.sample("boing", { volume, rate: 0.95 + (note % 5) * 0.03 })) this.pop(1.3); }
  howl(note = 0, volume = 0.6) { if (!this.sample("howl", { volume, reverb: 0.5 })) this.chime(0, volume); }
  drum(note = 0, volume = 0.7) { if (!this.sample("drum", { volume, rate: 0.95 + (note % 3) * 0.05 })) this.pop(0.45); }
  bell(note = 0, volume = 0.6) { if (!this.sample("bell", { volume, reverb: 0.5 })) this.chime(7, volume); }
  crack(note = 0, volume = 0.6) { if (!this.sample("crack", { volume })) this.click(); }
  splash(note = 0, volume = 0.6) { if (!this.sample("splash", { volume, rate: 0.95 + (note % 3) * 0.05 })) this.pop(0.8); }
  cranecall(note = 0, volume = 0.5) { if (!this.sample("cranecall", { volume, reverb: 0.4 })) this.chime(6, volume); }
  rustle(note = 0, volume = 0.45) { if (!this.sample("rustle", { volume, rate: 0.9 + Math.random() * 0.2 })) this.puff(); }
  cluck(note = 0, volume = 0.5) { if (!this.sample("cluck", { volume })) this.click(); }
  breath(note = 0, volume = 0.5) { if (!this.sample("breath", { volume })) this.whoosh(false); }
  croak(note = 0, volume = 0.6) { if (!this.sample("croak", { volume, rate: 0.95 + (note % 3) * 0.05 })) this.chime(1, volume); }
  moo(note = 0, volume = 0.6) { if (!this.sample("moo", { volume, rate: 0.95 + (note % 3) * 0.04 })) this.chime(0, volume); }
  fizz(note = 0, volume = 0.6) { if (!this.sample("fizz", { volume })) { this.puff(); setTimeout(() => this.pop(1.3), 300); } }
  launch(note = 0, volume = 0.7) { if (!this.sample("launch", { volume, reverb: 0.3 })) this.whoosh(true); }
  thunder(note = 0, volume = 0.6) { if (!this.sample("thunder", { volume, reverb: 0.5 })) this.chime(0, volume); }
  trumpet(note = 0, volume = 0.6) { if (!this.sample("trumpet", { volume, rate: 0.95 + (note % 3) * 0.05 })) this.chime(5, volume); }
  tuktuk(note = 0, volume = 0.55) { if (!this.sample("tuktuk", { volume })) this.chime(4, volume); }
  monkey(note = 0, volume = 0.55) { if (!this.sample("monkey", { volume, rate: 0.95 + (note % 3) * 0.05 })) this.giggle(5, volume); }
  otter(note = 0, volume = 0.55) { if (!this.sample("otter", { volume, rate: 0.95 + (note % 3) * 0.05 })) this.chime(6, volume); }
  hornbill(note = 0, volume = 0.55) { if (!this.sample("hornbill", { volume })) this.caw(0, volume); }
  cheer(note = 0, volume = 0.6) { if (!this.sample("cheer", { volume, reverb: 0.3 })) this.sparkle(); }
  thunk(note = 0, volume = 0.6) { if (!this.sample("thunk", { volume, rate: 0.95 + (note % 3) * 0.05 })) this.pop(0.6); }
  laugh(note = 0, volume = 0.55) { if (!this.sample("laugh", { volume })) this.giggle(5, volume); }
  crumble(note = 0, volume = 0.6) { if (!this.sample("crumble", { volume })) this.pop(0.5); }
  rain(note = 0, volume = 0.5) { if (!this.sample("rain", { volume, reverb: 0.3 })) this.puff(); }
  khaen(note = 0, volume = 0.55) { if (!this.sample("khaen", { volume })) this.chime(4, volume); }
  shimmer(volume = 0.35) { return this.sample("shimmer", { volume, reverb: 0.4 }); }

  makeNoise() {
    const seconds = 2;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  makeReverb(seconds, decay) {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * seconds);
    const impulse = this.ctx.createBuffer(2, length, rate);
    for (let c = 0; c < 2; c++) {
      const data = impulse.getChannelData(c);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.2) * decay;
      }
    }
    const convolver = this.ctx.createConvolver();
    convolver.buffer = impulse;
    return convolver;
  }

  setMusicVolume(v) { this.music.gain.value = v * 0.5; }
  setSfxVolume(v) { this.sfx.gain.value = v; }
  setMuted(m) {
    this.muted = m;
    this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  /* ---------- music box lullaby ---------- */

  boxNote(midi, when, velocity = 0.5, duration = 1.6, out = this.music) {
    const ctx = this.ctx;
    const hz = midiToHz(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(velocity, when + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0008, when + duration);
    const o1 = ctx.createOscillator();
    o1.type = "sine";
    o1.frequency.value = hz;
    const o2 = ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.value = hz * 4.05; // bright metallic partial
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.28, when);
    g2.gain.exponentialRampToValueAtTime(0.001, when + duration * 0.35);
    const o3 = ctx.createOscillator();
    o3.type = "triangle";
    o3.frequency.value = hz * 2;
    const g3 = ctx.createGain();
    g3.gain.value = 0.12;
    o1.connect(g);
    o2.connect(g2).connect(g);
    o3.connect(g3).connect(g);
    g.connect(out);
    g.connect(this.reverbSend);
    o1.start(when); o2.start(when); o3.start(when);
    o1.stop(when + duration + 0.05); o2.stop(when + duration + 0.05); o3.stop(when + duration + 0.05);
  }

  startLullaby() {
    if (this.lullaby) return;
    const ctx = this.ctx;
    const beat = 0.62; // 3/4 waltz feel, gentle
    // An original 16-bar melody in D major, music-box register.
    const melody = [
      [74, 2], [78, 1], [81, 2], [78, 1], [76, 3],
      [74, 2], [76, 1], [78, 2], [76, 1], [74, 3],
      [73, 2], [74, 1], [76, 2], [78, 1], [81, 3],
      [79, 2], [78, 1], [76, 2], [74, 1], [74, 3],
      [81, 2], [83, 1], [86, 2], [83, 1], [81, 3],
      [79, 2], [81, 1], [78, 2], [76, 1], [78, 3],
      [76, 2], [74, 1], [73, 2], [71, 1], [69, 3],
      [74, 2], [76, 1], [78, 2], [73, 1], [74, 3],
    ];
    const bass = [62, 57, 55, 62, 62, 57, 55, 62, 59, 62, 57, 62, 62, 55, 57, 62];
    const chordTones = { 62: [66, 69], 57: [61, 64], 55: [59, 62], 59: [62, 66] };
    let index = 0;
    let bar = 0;
    let next = ctx.currentTime + 0.3;
    const schedule = () => {
      while (next < ctx.currentTime + 1.5) {
        const [note, len] = melody[index % melody.length];
        this.boxNote(note, next, 0.34, len * beat * 1.4);
        // accompaniment on beats of each bar (bars of 3 beats)
        if (index % 5 === 0 || index % 5 === 3) {
          const root = bass[bar % bass.length];
          this.boxNote(root - 12, next, 0.2, beat * 2.4);
          const tones = chordTones[root] || [root + 4, root + 7];
          this.boxNote(tones[0], next + beat * 0.98, 0.11, beat * 1.6);
          this.boxNote(tones[1], next + beat * 1.96, 0.11, beat * 1.6);
          if (index % 5 === 3) bar++;
        }
        next += len * beat;
        index++;
      }
    };
    schedule();
    this.lullaby = setInterval(schedule, 400);
  }

  stopLullaby() {
    if (this.lullaby) clearInterval(this.lullaby);
    this.lullaby = null;
  }

  /* ---------- effects ---------- */

  chime(step = 0, velocity = 0.5) {
    const midi = 86 + PENTATONIC[Math.abs(step) % PENTATONIC.length];
    this.boxNote(midi, this.ctx.currentTime, velocity, 1.8, this.sfx);
  }

  sparkle() {
    this.shimmer(0.3);
    const t = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const midi = 91 + PENTATONIC[Math.floor(Math.random() * 6)];
      this.boxNote(midi, t + i * 0.055, 0.22, 0.9, this.sfx);
    }
  }

  pop(pitch = 1) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(420 * pitch, t);
    o.frequency.exponentialRampToValueAtTime(140 * pitch, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g).connect(this.sfx);
    o.start(t); o.stop(t + 0.2);
  }

  puff() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(300, t + 0.4);
    f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t); src.stop(t + 0.55);
  }

  pageTurn() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(1800, t);
    f.frequency.exponentialRampToValueAtTime(5200, t + 0.25);
    f.frequency.exponentialRampToValueAtTime(900, t + 0.55);
    f.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.28, t + 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.62);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t); src.stop(t + 0.7);
    // soft paper thump at the end
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(140, t + 0.5);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.62);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, t + 0.5);
    g2.gain.exponentialRampToValueAtTime(0.25, t + 0.52);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.68);
    o.connect(g2).connect(this.sfx);
    o.start(t + 0.5); o.stop(t + 0.7);
  }

  hoot() {
    if (this.sample("hoot", { volume: 0.6, reverb: 0.35 })) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const at = t + i * 0.38;
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(330, at);
      o.frequency.linearRampToValueAtTime(390, at + 0.08);
      o.frequency.linearRampToValueAtTime(300, at + 0.3);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.4, at + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.34);
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 900;
      o.connect(f).connect(g).connect(this.sfx);
      g.connect(this.reverbSend);
      o.start(at); o.stop(at + 0.4);
    }
  }

  meow() {
    if (this.sample("meow", { volume: 0.6 })) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(520, t);
    o.frequency.linearRampToValueAtTime(780, t + 0.16);
    o.frequency.linearRampToValueAtTime(460, t + 0.5);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(1200, t);
    f.frequency.linearRampToValueAtTime(2200, t + 0.2);
    f.frequency.linearRampToValueAtTime(900, t + 0.5);
    f.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    o.connect(f).connect(g).connect(this.sfx);
    o.start(t); o.stop(t + 0.6);
  }

  yawn() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(220, t);
    o.frequency.linearRampToValueAtTime(330, t + 0.5);
    o.frequency.linearRampToValueAtTime(180, t + 1.3);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(600, t);
    f.frequency.linearRampToValueAtTime(1400, t + 0.5);
    f.frequency.linearRampToValueAtTime(400, t + 1.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.14, t + 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    o.connect(f).connect(g).connect(this.sfx);
    o.start(t); o.stop(t + 1.5);
  }

  click() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 2600;
    f.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t); src.stop(t + 0.06);
    this.pop(2.2);
  }

  glow() {
    const t = this.ctx.currentTime;
    [74, 78, 81, 86].forEach((m, i) => this.boxNote(m, t + i * 0.12, 0.3, 2.4, this.sfx));
  }

  whoosh(up = true) {
    if (this.sample("gust", { volume: 0.45, rate: up ? 1.05 : 0.85, reverb: 0.1 })) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(up ? 300 : 1500, t);
    f.frequency.exponentialRampToValueAtTime(up ? 1500 : 300, t + 0.7);
    f.Q.value = 1.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.2);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t); src.stop(t + 0.85);
  }

  lampSwitch(on) {
    this.pop(on ? 1.6 : 1.1);
  }
}
