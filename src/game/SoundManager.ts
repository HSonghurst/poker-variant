// Sound Manager using Web Audio API for procedural sound effects

class SoundManagerClass {
  private audioContext: AudioContext | null = null;
  private masterVolume: number = 0.3;
  private enabled: boolean = true;

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  // Arrow shot - short twang
  playArrowShot(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.1);
    osc.type = 'triangle';

    gain.gain.setValueAtTime(this.masterVolume * 0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  }

  // Fireball launch - whoosh
  playFireball(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const noise = this.createNoise(ctx, 0.15);
    const gain = ctx.createGain();
    const noiseGain = ctx.createGain();

    osc.connect(gain);
    noise.connect(noiseGain);
    gain.connect(ctx.destination);
    noiseGain.connect(ctx.destination);

    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.15);
    osc.type = 'sawtooth';

    gain.gain.setValueAtTime(this.masterVolume * 0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    noiseGain.gain.setValueAtTime(this.masterVolume * 0.15, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  }

  // Explosion - boom
  playExplosion(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const noise = this.createNoise(ctx, 0.3);
    const gain = ctx.createGain();
    const noiseGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.connect(gain);
    noise.connect(filter);
    filter.connect(noiseGain);
    gain.connect(ctx.destination);
    noiseGain.connect(ctx.destination);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);

    osc.frequency.setValueAtTime(100, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.3);
    osc.type = 'sine';

    gain.gain.setValueAtTime(this.masterVolume * 0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    noiseGain.gain.setValueAtTime(this.masterVolume * 0.3, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  }

  // Hit sound - thud
  playHit(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.08);
    osc.type = 'sine';

    gain.gain.setValueAtTime(this.masterVolume * 0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  }

  // Sword swing - swish
  playSwordSwing(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    const noise = this.createNoise(ctx, 0.12);
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2000, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.12);
    filter.Q.value = 2;

    gain.gain.setValueAtTime(this.masterVolume * 0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
  }

  // Critical hit - sharp zing
  playCritical(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(2400, ctx.currentTime + 0.1);
    osc.type = 'square';

    osc2.frequency.setValueAtTime(1500, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(3000, ctx.currentTime + 0.1);
    osc2.type = 'square';

    gain.gain.setValueAtTime(this.masterVolume * 0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
    osc2.start(ctx.currentTime);
    osc2.stop(ctx.currentTime + 0.1);
  }

  // Death sound - descending tone
  playDeath(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.25);
    osc.type = 'triangle';

    gain.gain.setValueAtTime(this.masterVolume * 0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  }

  // Level up - ascending chime
  playLevelUp(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();

    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.frequency.value = freq;
      osc.type = 'sine';

      const startTime = ctx.currentTime + i * 0.08;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(this.masterVolume * 0.2, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

      osc.start(startTime);
      osc.stop(startTime + 0.3);
    });
  }

  // Victory fanfare
  playVictory(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();

    const notes = [523, 659, 784, 659, 784, 1047]; // Victory melody
    const durations = [0.15, 0.15, 0.15, 0.15, 0.15, 0.4];

    let time = ctx.currentTime;
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.frequency.value = freq;
      osc.type = 'triangle';

      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(this.masterVolume * 0.3, time + 0.02);
      gain.gain.setValueAtTime(this.masterVolume * 0.3, time + durations[i] - 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, time + durations[i]);

      osc.start(time);
      osc.stop(time + durations[i]);

      time += durations[i];
    });
  }

  // Freeze effect - icy crystalline sound
  playFreeze(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.setValueAtTime(2000, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(4000, ctx.currentTime + 0.15);
    osc.type = 'sine';

    osc2.frequency.setValueAtTime(2100, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(4200, ctx.currentTime + 0.15);
    osc2.type = 'sine';

    gain.gain.setValueAtTime(this.masterVolume * 0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
    osc2.start(ctx.currentTime);
    osc2.stop(ctx.currentTime + 0.15);
  }

  // Taunt ability - horn sound
  playTaunt(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.setValueAtTime(250, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(200, ctx.currentTime + 0.2);
    osc.type = 'sawtooth';

    gain.gain.setValueAtTime(this.masterVolume * 0.25, ctx.currentTime);
    gain.gain.setValueAtTime(this.masterVolume * 0.25, ctx.currentTime + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  }

  // Sweep attack - whooshing arc
  playSweep(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    const noise = this.createNoise(ctx, 0.2);
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(500, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.1);
    filter.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.2);
    filter.Q.value = 3;

    gain.gain.setValueAtTime(this.masterVolume * 0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
  }

  // Chain fire - crackling
  playChainFire(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();

    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      const startTime = ctx.currentTime + i * 0.05;
      osc.frequency.setValueAtTime(100 + Math.random() * 100, startTime);
      osc.frequency.exponentialRampToValueAtTime(50, startTime + 0.08);
      osc.type = 'sawtooth';

      gain.gain.setValueAtTime(this.masterVolume * 0.15, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.08);

      osc.start(startTime);
      osc.stop(startTime + 0.08);
    }
  }

  // XP collect - soft ping
  playXPCollect(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.08);
    osc.type = 'sine';

    gain.gain.setValueAtTime(this.masterVolume * 0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  }

  // Helper to create white noise
  private createNoise(ctx: AudioContext, duration: number): AudioBufferSourceNode {
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.start(ctx.currentTime);

    return noise;
  }
}

export const SoundManager = new SoundManagerClass();
