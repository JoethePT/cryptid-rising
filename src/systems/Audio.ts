// Procedural audio: 16-bit console-style FM music + synthesized sound effects (Web Audio API).
// Everything is generated at runtime — no audio files, nothing to license.
// All music here is original; songs are written as chord charts + hand-written lead lines below.

type SfxName =
  | 'swing' | 'hit' | 'heavy' | 'hurt' | 'jump' | 'orb' | 'powerup' | 'transform' | 'slam' | 'throw'
  | 'poof' | 'caw' | 'roar' | 'boom' | 'crack' | 'select' | 'move' | 'pause' | 'pounce' | 'zap' | 'thunder'
  // creature voices
  | 'bigfoot' | 'raptor' | 'dragon' | 'moose' | 'golem' | 'wyrm' | 'growl' | 'huskdie' | 'howl' | 'snarl' | 'step';

export type Ambience = 'forest' | 'canyon' | 'storm';

interface VoiceOpts {
  type?: OscillatorType;
  pitch: [number, number][]; // [time offset, Hz] breakpoints
  dur: number;
  vol: number;
  growl?: number; // LFO rate (Hz) for a rough, rattling throat
  growlDepth?: number; // fraction of pitch
  formants: [number, number][]; // [centre Hz, Q] — gives the vowel/throat character
  breath?: number; // noise mixed in
  echo?: boolean;
}

export type SongName = 'title' | 'forest' | 'canyon' | 'storm' | 'boss' | 'clear' | 'gameover';

interface Song {
  bpm: number;
  chords: string[]; // one chord per bar, e.g. 'Dm', 'Bb', 'A', 'G7'
  lead: string; // 16th-note tokens: note ('D5'), '-' hold, '.' rest
  bass: 'drive' | 'gallop' | 'pulse' | 'long';
  arp: 'up' | 'updown' | 'none';
  drums: { k: string; s: string; h: string } | null; // 16-step patterns, 'x' = hit
  loop: boolean;
  leadVol?: number;
}

// ------------------------------------------------------------------ songs (original compositions)

const SONGS: Record<SongName, Song> = {
  // Title: "Moonlit Totem" — slow, mysterious A minor
  title: {
    bpm: 92, loop: true, bass: 'long', arp: 'updown', drums: { k: 'x.......x.......', s: '................', h: '....x.......x...' },
    chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'E', 'E'],
    lead: [
      'A4 - - - - - - - E5 - - - - - - -',
      'F5 - - - - - E5 - C5 - - - - - - -',
      'E5 - - - - - D5 - C5 - - - D5 - - -',
      'B4 - - - - - - - G4 - - - - - - -',
      'A4 - - - C5 - - - E5 - - - A5 - - -',
      'G5 - - - F5 - - - E5 - - - C5 - - -',
      'B4 - - - - - - - G#4 - - - - - - -',
      'B4 - - - - - - - E4 - - - - - . .',
    ].join(' '),
    leadVol: 0.8,
  },
  // Stage 1: "Old-Growth Run" — driving D minor
  forest: {
    bpm: 132, loop: true, bass: 'drive', arp: 'up',
    drums: { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.xx' },
    chords: ['Dm', 'Bb', 'C', 'A', 'Dm', 'Bb', 'Gm', 'A'],
    lead: [
      'D5 - - - A4 - - - D5 - E5 - F5 - - -',
      'F5 - E5 - D5 - - - C5 - D5 - Bb4 - - -',
      'C5 - - - G4 - - - C5 - D5 - E5 - - -',
      'E5 - - - C#5 - - - A4 - - - - - . .',
      'A5 - - - G5 - F5 - E5 - F5 - D5 - - -',
      'D5 - - - F5 - - - Bb5 - A5 - G5 - F5 -',
      'G5 - - - F5 - E5 - D5 - - - Bb4 - - -',
      'C#5 - - - E5 - - - A5 - - - - - - .',
    ].join(' '),
  },
  // Stage 2: "Bones of the Badlands" — E phrygian gallop
  canyon: {
    bpm: 140, loop: true, bass: 'gallop', arp: 'updown',
    drums: { k: 'x..x..x.x..x..x.', s: '....x.......x..x', h: 'x.x.x.x.x.x.x.x.' },
    chords: ['Em', 'F', 'Em', 'D', 'Em', 'F', 'G', 'F'],
    lead: [
      'E5 - - - F5 - E5 - D5 - E5 - - - B4 -',
      'C5 - - - A4 - - - F5 - E5 - F5 - - -',
      'G5 - F5 - E5 - - - B4 - C5 - B4 - G4 -',
      'A4 - - - D5 - - - F#5 - E5 - D5 - - -',
      'E5 - - - E5 - G5 - B5 - - - A5 - G5 -',
      'A5 - - - F5 - - - C6 - B5 - A5 - - -',
      'G5 - - - D5 - - - B4 - D5 - G5 - - -',
      'F5 - E5 - F5 - G5 - E5 - - - - - . .',
    ].join(' '),
  },
  // Stage 3: "Eye of the Squall" — soaring F# minor
  storm: {
    bpm: 146, loop: true, bass: 'drive', arp: 'updown',
    drums: { k: 'x...x..xx...x...', s: '....x.......x.x.', h: 'x.xxx.xxx.xxx.xx' },
    chords: ['F#m', 'D', 'E', 'C#', 'F#m', 'D', 'Bm', 'C#'],
    lead: [
      'F#5 - - - C#5 - - - F#5 - G#5 - A5 - - -',
      'A5 - G#5 - F#5 - - - D5 - E5 - F#5 - - -',
      'G#5 - - - E5 - - - B4 - E5 - G#5 - - -',
      'G#5 - F5 - C#5 - - - - - . . C#5 - E5 -',
      'F#5 - - - A5 - C#6 - B5 - A5 - G#5 - - -',
      'F#5 - - - A5 - - - D6 - C#6 - B5 - A5 -',
      'B5 - - - F#5 - - - D5 - F#5 - B5 - - -',
      'C#6 - - - G#5 - - - F5 - - - C#5 - . .',
    ].join(' '),
  },
  // Boss: "Hollow Lord" — tense C minor
  boss: {
    bpm: 152, loop: true, bass: 'pulse', arp: 'up',
    drums: { k: 'x.x...x.x.x...x.', s: '....x.......x.xx', h: 'xxxxxxxxxxxxxxxx' },
    chords: ['Cm', 'Cm', 'Ab', 'G', 'Cm', 'Db', 'Ab', 'G'],
    lead: [
      'C5 - . C5 Eb5 - . C5 G5 - - - F#5 - G5 -',
      'Ab5 - G5 - F5 - Eb5 - D5 - Eb5 - C5 - - -',
      'Ab4 - . Ab4 C5 - . Ab4 Eb5 - - - D5 - C5 -',
      'B4 - - - D5 - - - G5 - - - B5 - - -',
      'C6 - - - G5 - - - Eb5 - - - C5 - - -',
      'Db5 - F5 - Ab5 - - - G5 - F5 - Db5 - - -',
      'C5 - Eb5 - Ab5 - - - G5 - F5 - Eb5 - D5 -',
      'D5 - - - B4 - - - G4 - - - . . . .',
    ].join(' '),
  },
  clear: {
    bpm: 150, loop: false, bass: 'long', arp: 'none', drums: { k: 'x...x...x.x.x...', s: '....x.......x...', h: '................' },
    chords: ['C', 'F', 'G', 'C'],
    lead: [
      'G4 - C5 - E5 - G5 - - - E5 - G5 - - -',
      'A5 - - - F5 - A5 - C6 - - - - - - -',
      'B5 - - - G5 - - - D6 - - - B5 - - -',
      'C6 - - - - - - - - - - - . . . .',
    ].join(' '),
  },
  gameover: {
    bpm: 80, loop: false, bass: 'long', arp: 'none', drums: null,
    chords: ['Am', 'F', 'Dm', 'E'],
    lead: [
      'E5 - - - - - D5 - C5 - - - - - - -',
      'A4 - - - - - G4 - F4 - - - - - - -',
      'F4 - - - E4 - - - D4 - - - - - - -',
      'E4 - - - - - - - - - - - . . . .',
    ].join(' '),
  },
};

// ------------------------------------------------------------------ helpers

const NOTE_INDEX: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

function midi(note: string) {
  const m = /^([A-G][#b]?)(-?\d)$/.exec(note);
  if (!m) return 60;
  return 12 * (Number(m[2]) + 1) + NOTE_INDEX[m[1]];
}
const hz = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

function chordNotes(name: string): number[] {
  const m = /^([A-G][#b]?)(m?)(7?)$/.exec(name)!;
  const root = NOTE_INDEX[m[1]];
  const third = m[2] ? 3 : 4;
  const notes = [root, root + third, root + 7];
  if (m[3]) notes.push(root + (m[2] ? 10 : 10));
  return notes;
}

const MUTE_KEY = 'cryptid-rising-muted';

// ------------------------------------------------------------------ engine

class AudioEngine {
  private ctx?: AudioContext;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private echo!: DelayNode;
  private noiseBuf!: AudioBuffer;
  private song?: Song;
  private songName?: SongName;
  private step = 0;
  private nextTime = 0;
  private timer?: number;
  private leadTokens: string[] = [];
  private ducked = false;
  private ambBus?: GainNode;
  private ambNodes: AudioScheduledSourceNode[] = [];
  muted = false;

  constructor() {
    try { this.muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* storage unavailable */ }
  }

  get ready() { return !!this.ctx && this.ctx.state === 'running'; }

  /** Must be called from a user gesture (key press / click). Safe to call repeatedly. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      // gentle glue compression
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      this.master.connect(comp).connect(ctx.destination);
      this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.42; this.musicBus.connect(this.master);
      this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.7; this.sfxBus.connect(this.master);
      // slap-back echo for the lead (that classic console hall)
      this.echo = ctx.createDelay(1); this.echo.delayTime.value = 0.18;
      const fb = ctx.createGain(); fb.gain.value = 0.28;
      const wet = ctx.createGain(); wet.gain.value = 0.35;
      this.echo.connect(fb).connect(this.echo);
      this.echo.connect(wet).connect(this.musicBus);
      // white noise for drums/sfx
      const len = ctx.sampleRate;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.pendingSong) { const s = this.pendingSong; this.pendingSong = undefined; this.play(s); }
    if (this.pendingAmb) { const a = this.pendingAmb; this.pendingAmb = undefined; this.ambience(a); }
  }

  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0'); } catch { /* ignore */ }
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
    return this.muted;
  }

  /** Lower the music (pause menu). */
  duck(on: boolean) {
    this.ducked = on;
    if (this.ctx) this.musicBus.gain.setTargetAtTime(on ? 0.12 : 0.42, this.ctx.currentTime, 0.1);
  }

  // ---------------------------------------------------------------- music

  private pendingSong?: SongName;

  play(name: SongName) {
    if (!this.ctx) { this.pendingSong = name; return; }
    if (this.songName === name && this.song?.loop) return;
    this.stopMusic();
    this.song = SONGS[name];
    this.songName = name;
    this.leadTokens = this.song.lead.split(/\s+/);
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.06;
    this.timer = window.setInterval(() => this.schedule(), 25);
    if (this.ducked) this.duck(true);
  }

  stopMusic() {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = undefined;
    this.song = undefined;
    this.songName = undefined;
  }

  private schedule() {
    const ctx = this.ctx, song = this.song;
    if (!ctx || !song) return;
    const stepDur = 60 / song.bpm / 4;
    const total = song.chords.length * 16;
    while (this.nextTime < ctx.currentTime + 0.12) {
      if (this.step >= total) {
        if (!song.loop) { this.stopMusic(); return; }
        this.step = 0;
      }
      this.playStep(song, this.step, this.nextTime, stepDur);
      this.step++;
      this.nextTime += stepDur;
    }
  }

  private playStep(song: Song, step: number, t: number, sd: number) {
    const bar = Math.floor(step / 16), s = step % 16;
    const chord = chordNotes(song.chords[bar]);
    const root = 36 + chord[0] + (chord[0] > 5 ? -12 : 0); // octave 2

    // lead
    const tok = this.leadTokens[step];
    if (tok && tok !== '-' && tok !== '.') {
      let len = 1;
      while (this.leadTokens[step + len] === '-') len++;
      this.fm(hz(midi(tok)), t, len * sd * 0.95, { ratio: 1, index: 2.2, decay: 0.35, vol: 0.2 * (song.leadVol ?? 1), lead: true, vibrato: len > 3 });
    }

    // bass
    const bassVol = 0.32;
    switch (song.bass) {
      case 'drive':
        if (s % 2 === 0) this.fm(hz(s % 4 === 2 ? root + 12 : root), t, sd * 1.6, { ratio: 1, index: 3.2, decay: 0.12, vol: bassVol });
        break;
      case 'gallop':
        if ([0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15].includes(s)) this.fm(hz(s % 8 === 0 ? root : root + (s % 4 === 0 ? 12 : 0)), t, sd * 0.9, { ratio: 1, index: 3, decay: 0.08, vol: bassVol * 0.9 });
        break;
      case 'pulse':
        this.fm(hz(s % 8 === 6 ? root + 12 : root), t, sd * 0.85, { ratio: 1, index: 3.5, decay: 0.06, vol: bassVol * 0.85 });
        break;
      case 'long':
        if (s === 0) this.fm(hz(root), t, sd * 15, { ratio: 1, index: 1.5, decay: 0.6, vol: bassVol * 0.8 });
        break;
    }

    // arpeggio (chord tones, octave 4/5)
    if (song.arp !== 'none' && s % 2 === 0) {
      const tones = [...chord, chord[0] + 12];
      const seq = song.arp === 'up' ? tones : [...tones, ...tones.slice(1, -1).reverse()];
      const n = 60 + seq[(s / 2) % seq.length];
      this.square(hz(n), t, sd * 0.9, 0.035);
    }

    // drums
    const d = song.drums;
    if (d) {
      if (d.k[s] === 'x') this.kick(t);
      if (d.s[s] === 'x') this.snare(t);
      if (d.h[s] === 'x') this.hat(t, s % 4 === 2 ? 0.05 : 0.03);
    }
  }

  // ---------------------------------------------------------------- voices

  /** 2-operator FM voice (sine modulator -> sine carrier): the Genesis-style bass/brass sound. */
  private fm(f: number, t: number, dur: number, o: { ratio: number; index: number; decay: number; vol: number; lead?: boolean; vibrato?: boolean }) {
    const ctx = this.ctx!;
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), modGain = ctx.createGain(), amp = ctx.createGain();
    car.frequency.value = f; mod.frequency.value = f * o.ratio;
    modGain.gain.setValueAtTime(f * o.index, t);
    modGain.gain.exponentialRampToValueAtTime(Math.max(1, f * o.index * 0.25), t + o.decay);
    mod.connect(modGain).connect(car.frequency);
    if (o.vibrato) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.012, t + 0.25);
      lfo.connect(lg).connect(car.frequency); lfo.start(t); lfo.stop(t + dur + 0.1);
    }
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(o.vol, t + 0.008);
    amp.gain.setTargetAtTime(o.vol * 0.6, t + 0.02, o.decay);
    amp.gain.setTargetAtTime(0, t + dur, 0.03);
    car.connect(amp).connect(this.musicBus);
    if (o.lead) amp.connect(this.echo);
    car.start(t); mod.start(t);
    car.stop(t + dur + 0.2); mod.stop(t + dur + 0.2);
  }

  private square(f: number, t: number, dur: number, vol: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = f;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.musicBus); o.start(t); o.stop(t + dur + 0.02);
  }

  private noise(t: number, dur: number, vol: number, filter: BiquadFilterType, freq: number, dest: AudioNode, q = 1) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    src.loop = true; // long sounds (thunder) outlast the 1s noise buffer
    const f = ctx.createBiquadFilter(); f.type = filter; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
    return { f, g };
  }

  private kick(t: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.55, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g).connect(this.musicBus); o.start(t); o.stop(t + 0.25);
  }

  private snare(t: number) {
    this.noise(t, 0.16, 0.28, 'bandpass', 1800, this.musicBus, 0.8);
    const ctx = this.ctx!;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g).connect(this.musicBus); o.start(t); o.stop(t + 0.12);
  }

  private hat(t: number, vol: number) {
    this.noise(t, 0.045, vol * 2.5, 'highpass', 7500, this.musicBus);
  }

  // ---------------------------------------------------------------- creature voices

  /** Formant-filtered growling oscillator: the building block for every creature voice. */
  private voice(t: number, o: VoiceOpts) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sawtooth';
    osc.frequency.setValueAtTime(o.pitch[0][1], t);
    for (const [dt, f] of o.pitch.slice(1)) osc.frequency.exponentialRampToValueAtTime(f, t + dt);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(o.vol, t + Math.min(0.12, o.dur * 0.2));
    amp.gain.setValueAtTime(o.vol, t + o.dur * 0.6);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    if (o.growl) {
      // amplitude + pitch roughness
      const lfo = ctx.createOscillator(), lg = ctx.createGain(), trem = ctx.createGain();
      lfo.type = 'square'; lfo.frequency.value = o.growl;
      lg.gain.value = o.pitch[0][1] * (o.growlDepth ?? 0.15);
      lfo.connect(lg).connect(osc.frequency);
      trem.gain.value = o.vol * 0.45; lfo.connect(trem).connect(amp.gain);
      lfo.start(t); lfo.stop(t + o.dur + 0.05);
    }
    const mix = ctx.createGain(); mix.gain.value = 1;
    for (const [f, q] of o.formants) {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
      osc.connect(bp).connect(mix);
    }
    mix.connect(amp).connect(this.sfxBus);
    if (o.echo) amp.connect(this.echo);
    osc.start(t); osc.stop(t + o.dur + 0.05);
    if (o.breath) {
      const { f, g } = this.noise(t, o.dur, o.breath, 'bandpass', o.formants[0][0] * 1.5, this.sfxBus, 0.8);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.breath, t + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
      void f;
    }
  }

  private creature(name: SfxName, t: number) {
    const v = (o: VoiceOpts, at = t) => this.voice(at, o);
    switch (name) {
      case 'bigfoot':
        // two chest thumps, then a deep throaty bellow
        [0, 0.18].forEach((d) => this.thump(t + d, 90, 0.7));
        v({ pitch: [[0, 120], [0.5, 105], [1.5, 70]], dur: 1.6, vol: 0.55, growl: 26, growlDepth: 0.2, formants: [[380, 3], [750, 4]], breath: 0.25 }, t + 0.35);
        break;
      case 'raptor':
        // shrill, rattling screech
        v({ pitch: [[0, 700], [0.15, 1500], [0.5, 1200], [0.9, 650]], dur: 0.95, vol: 0.32, growl: 42, growlDepth: 0.08, formants: [[2400, 5], [3600, 6]], breath: 0.15 });
        v({ type: 'square', pitch: [[0, 1400], [0.6, 900]], dur: 0.6, vol: 0.06, formants: [[3000, 3]] }, t + 0.05);
        break;
      case 'dragon':
        v({ pitch: [[0, 170], [0.4, 150], [1.6, 85]], dur: 1.7, vol: 0.5, growl: 19, growlDepth: 0.18, formants: [[500, 2.5], [1250, 4]], breath: 0.3, echo: true });
        this.sfx('zap');
        break;
      case 'moose':
        // nasal rising-then-falling bellow
        v({ pitch: [[0, 150], [0.5, 250], [1.1, 230], [1.7, 120]], dur: 1.8, vol: 0.45, growl: 8, growlDepth: 0.04, formants: [[650, 6], [1050, 8], [2200, 6]], breath: 0.12, echo: true });
        break;
      case 'golem': {
        v({ pitch: [[0, 95], [1.2, 60]], dur: 1.3, vol: 0.45, growl: 22, growlDepth: 0.25, formants: [[300, 2], [900, 3]], breath: 0.2 });
        // bone rattle: a burst of dry clicks
        for (let i = 0; i < 18; i++) this.noise(t + 0.1 + i * 0.05 + Math.random() * 0.02, 0.03, 0.35, 'bandpass', 2600 + Math.random() * 1500, this.sfxBus, 4);
        break;
      }
      case 'wyrm':
        // long serpent hiss under a crackling screech
        this.noise(t, 1.3, 0.3, 'bandpass', 5200, this.sfxBus, 1.5);
        v({ type: 'square', pitch: [[0, 520], [0.4, 980], [1.2, 420]], dur: 1.25, vol: 0.18, growl: 33, growlDepth: 0.1, formants: [[1600, 4], [2900, 5]], echo: true });
        break;
      case 'growl':
        v({ pitch: [[0, 120], [0.5, 95]], dur: 0.55, vol: 0.28, growl: 30, growlDepth: 0.2, formants: [[320, 3], [700, 4]], breath: 0.12 });
        break;
      case 'huskdie':
        v({ pitch: [[0, 420], [0.7, 110]], dur: 0.75, vol: 0.25, growl: 35, growlDepth: 0.12, formants: [[600, 3], [1400, 4]], breath: 0.18 });
        break;
      case 'howl':
        // ghostly rising howl with echo
        v({ type: 'triangle', pitch: [[0, 380], [0.35, 690], [1.1, 650], [1.6, 470]], dur: 1.7, vol: 0.28, formants: [[700, 2], [1100, 3]], echo: true });
        v({ type: 'sine', pitch: [[0, 760], [0.35, 1380], [1.6, 940]], dur: 1.6, vol: 0.08, formants: [[1400, 2]], echo: true }, t + 0.02);
        break;
      case 'snarl':
        v({ pitch: [[0, 160], [0.3, 130]], dur: 0.35, vol: 0.3, growl: 48, growlDepth: 0.3, formants: [[500, 3], [1500, 3]], breath: 0.25 });
        break;
      case 'step':
        this.thump(t, 70, 0.35);
        break;
    }
  }

  private thump(t: number, f: number, vol: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.45, t + 0.14);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g).connect(this.sfxBus); o.start(t); o.stop(t + 0.2);
    this.noise(t, 0.08, vol * 0.4, 'lowpass', 500, this.sfxBus);
  }

  // ---------------------------------------------------------------- ambience

  /** Looping background atmosphere for a stage (null = silence). */
  ambience(name: Ambience | null) {
    for (const n of this.ambNodes) { try { n.stop(); } catch { /* already stopped */ } }
    this.ambNodes = [];
    const ctx = this.ctx;
    if (!ctx || !name) { this.pendingAmb = name ?? undefined; return; }
    if (!this.ambBus) { this.ambBus = ctx.createGain(); this.ambBus.gain.value = 0.22; this.ambBus.connect(this.master); }
    const t = ctx.currentTime;
    const loopNoise = (type: BiquadFilterType, f: number, q: number, vol: number, wobble: number, rate: number) => {
      const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const filt = ctx.createBiquadFilter(); filt.type = type; filt.frequency.value = f; filt.Q.value = q;
      const g = ctx.createGain(); g.gain.value = vol;
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = rate; lg.gain.value = wobble;
      lfo.connect(lg).connect(filt.frequency);
      src.connect(filt).connect(g).connect(this.ambBus!);
      src.start(t); lfo.start(t);
      this.ambNodes.push(src, lfo);
      return g;
    };
    if (name === 'forest') {
      loopNoise('lowpass', 500, 0.5, 0.35, 200, 0.07); // soft breeze
      // crickets: a high tone gated in quick chirps, swelling slowly
      const o = ctx.createOscillator(), chirp = ctx.createGain(), gate = ctx.createOscillator(), gg = ctx.createGain(), swell = ctx.createOscillator(), sg = ctx.createGain();
      o.frequency.value = 4400; chirp.gain.value = 0;
      gate.type = 'square'; gate.frequency.value = 28; gg.gain.value = 0.03;
      swell.frequency.value = 0.6; sg.gain.value = 0.03;
      gate.connect(gg).connect(chirp.gain); swell.connect(sg).connect(chirp.gain);
      o.connect(chirp).connect(this.ambBus);
      o.start(t); gate.start(t); swell.start(t);
      this.ambNodes.push(o, gate, swell);
    } else if (name === 'canyon') {
      loopNoise('bandpass', 700, 1.2, 0.6, 400, 0.11); // desert wind gusts
      loopNoise('highpass', 5000, 0.5, 0.08, 1500, 0.05); // blowing sand
    } else if (name === 'storm') {
      loopNoise('highpass', 2500, 0.4, 0.45, 300, 0.2); // rain
      loopNoise('bandpass', 450, 1.5, 0.7, 300, 0.13); // howling wind
    }
  }

  private pendingAmb?: Ambience;

  // ---------------------------------------------------------------- sfx

  sfx(name: SfxName) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime + 0.005, out = this.sfxBus;
    if (['bigfoot', 'raptor', 'dragon', 'moose', 'golem', 'wyrm', 'growl', 'huskdie', 'howl', 'snarl', 'step'].includes(name)) {
      this.creature(name, t);
      return;
    }
    const tone = (type: OscillatorType, f0: number, f1: number, dur: number, vol: number, at = t) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur);
      g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.001, at + dur);
      o.connect(g).connect(out); o.start(at); o.stop(at + dur + 0.02);
    };
    const sweepNoise = (dur: number, vol: number, f0: number, f1: number, type: BiquadFilterType = 'bandpass', at = t) => {
      const { f } = this.noise(at, dur, vol, type, f0, out, 1.2);
      f.frequency.exponentialRampToValueAtTime(f1, at + dur);
    };
    switch (name) {
      case 'swing': sweepNoise(0.12, 0.25, 900, 3200); break;
      case 'pounce': sweepNoise(0.22, 0.3, 600, 2600); tone('sawtooth', 220, 440, 0.12, 0.08); break;
      case 'throw': sweepNoise(0.25, 0.3, 400, 1800); break;
      case 'hit':
        tone('square', 320, 90, 0.08, 0.22);
        this.noise(t, 0.08, 0.35, 'lowpass', 2500, out);
        break;
      case 'heavy':
        tone('sine', 160, 40, 0.18, 0.6);
        tone('square', 220, 60, 0.12, 0.18);
        this.noise(t, 0.16, 0.45, 'lowpass', 1800, out);
        break;
      case 'hurt': tone('square', 440, 110, 0.25, 0.18); tone('sawtooth', 300, 80, 0.22, 0.1); break;
      case 'jump': tone('square', 260, 620, 0.12, 0.09); break;
      case 'orb':
        [0, 4, 7, 12].forEach((n, i) => tone('sine', hz(84 + n), hz(84 + n), 0.25, 0.16, t + i * 0.05));
        break;
      case 'powerup':
        [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => tone('square', hz(64 + n), hz(64 + n), 0.12, 0.07, t + i * 0.055));
        sweepNoise(0.6, 0.15, 800, 6000, 'highpass');
        break;
      case 'transform': {
        // beast roar: detuned growling saws + noise swell
        [55, 58, 82].forEach((f) => {
          const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
          o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 1.4, t); o.frequency.exponentialRampToValueAtTime(f, t + 1.2);
          lfo.frequency.value = 23; lg.gain.value = f * 0.25; lfo.connect(lg).connect(o.frequency);
          g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.15); g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
          const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
          o.connect(lp).connect(g).connect(out); o.start(t); lfo.start(t); o.stop(t + 1.6); lfo.stop(t + 1.6);
        });
        sweepNoise(1.4, 0.35, 300, 1200);
        break;
      }
      case 'roar': {
        const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(48, t + 1);
        lfo.frequency.value = 17; lg.gain.value = 18; lfo.connect(lg).connect(o.frequency);
        g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.12); g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
        o.connect(lp).connect(g).connect(out); o.start(t); lfo.start(t); o.stop(t + 1.2); lfo.stop(t + 1.2);
        sweepNoise(1, 0.25, 250, 700);
        break;
      }
      case 'slam': case 'boom':
        tone('sine', 120, 30, 0.45, 0.8);
        this.noise(t, 0.4, 0.5, 'lowpass', 900, out);
        break;
      case 'crack': this.noise(t, 0.12, 0.45, 'highpass', 2500, out); tone('square', 180, 60, 0.1, 0.12); break;
      case 'poof': sweepNoise(0.35, 0.3, 3000, 300); tone('triangle', 600, 150, 0.3, 0.08); break;
      case 'caw': {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'square'; o.frequency.setValueAtTime(900, t); o.frequency.linearRampToValueAtTime(620, t + 0.08); o.frequency.linearRampToValueAtTime(760, t + 0.18);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 3;
        g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        o.connect(bp).connect(g).connect(out); o.start(t); o.stop(t + 0.25);
        break;
      }
      case 'zap':
        tone('sawtooth', 1800, 300, 0.25, 0.1);
        sweepNoise(0.3, 0.3, 5000, 1200, 'highpass');
        break;
      case 'thunder': {
        // distant rolling thunder: low filtered noise with a slow swell and decay
        const { f, g } = this.noise(t, 2.6, 0.001, 'lowpass', 260, out, 0.7);
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.7, t + 0.08);
        g.gain.exponentialRampToValueAtTime(0.25, t + 0.6); g.gain.exponentialRampToValueAtTime(0.001, t + 2.5);
        f.frequency.setValueAtTime(420, t); f.frequency.exponentialRampToValueAtTime(120, t + 2.2);
        break;
      }
      case 'move': tone('square', 660, 660, 0.05, 0.06); break;
      case 'select': tone('square', 660, 660, 0.06, 0.07); tone('square', 990, 990, 0.1, 0.07, t + 0.06); break;
      case 'pause': tone('square', 520, 260, 0.15, 0.08); break;
    }
  }
}

export const audio = new AudioEngine();
