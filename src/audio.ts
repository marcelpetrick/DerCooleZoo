// SPDX-FileCopyrightText: 2026 Marcel Petrick
// SPDX-License-Identifier: GPL-3.0-or-later
/** Local WebAudio synthesis, created only following a user gesture. */
export interface ZooAudio {
  unlock: () => void;
  update: (sound: number, music: number, event: string) => void;
  dispose: () => void;
}
const cues: Record<
  string,
  { frequency: number; type: OscillatorType; duration: number }
> = {
  coin: { frequency: 1046.5, type: "sine", duration: 0.16 },
  ticket: { frequency: 784, type: "triangle", duration: 0.15 },
  arrival: { frequency: 659.25, type: "sine", duration: 0.35 },
  built: { frequency: 392, type: "triangle", duration: 0.14 },
  build: { frequency: 392, type: "triangle", duration: 0.14 },
  clean: { frequency: 1174.66, type: "sine", duration: 0.12 },
  done: { frequency: 880, type: "sine", duration: 0.12 },
  animal: { frequency: 523.25, type: "triangle", duration: 0.2 },
  popcorn: { frequency: 293.66, type: "square", duration: 0.045 },
  goal: { frequency: 1318.51, type: "sine", duration: 0.3 },
  expansion: { frequency: 698.46, type: "triangle", duration: 0.3 },
};
const melody = [261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 349.23];
const volume = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

export function createAudio(): ZooAudio {
  let context: AudioContext | null = null;
  let effects: GainNode;
  let music: GainNode;
  let disposed = false;
  let lastEvent = "";
  let nextMusicAt = 0;
  let note = 0;
  function tone(
    frequency: number,
    type: OscillatorType,
    duration: number,
    destination: GainNode,
  ): void {
    const ctx = context!;
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    envelope.gain.setValueAtTime(0, ctx.currentTime);
    envelope.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.015);
    envelope.gain.exponentialRampToValueAtTime(
      0.0001,
      ctx.currentTime + duration,
    );
    oscillator.connect(envelope);
    envelope.connect(destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration + 0.02);
  }
  function unlock(): void {
    if (disposed || typeof globalThis.AudioContext === "undefined") return;
    try {
      if (!context) {
        context = new AudioContext();
        effects = context.createGain();
        music = context.createGain();
        effects.gain.value = 0;
        music.gain.value = 0;
        effects.connect(context.destination);
        music.connect(context.destination);
      }
      if (context.state === "suspended") void context.resume().catch(() => {});
    } catch {
      context = null;
    }
  }
  function update(
    soundVolume: number,
    musicVolume: number,
    event: string,
  ): void {
    const changed = lastEvent !== event;
    lastEvent = event;
    if (!context) return;
    effects.gain.setTargetAtTime(
      volume(soundVolume),
      context.currentTime,
      0.02,
    );
    music.gain.setTargetAtTime(
      volume(musicVolume) * 0.45,
      context.currentTime,
      0.05,
    );
    if (changed && volume(soundVolume) > 0 && cues[event]) {
      const cue = cues[event];
      tone(cue.frequency, cue.type, cue.duration, effects);
    }
    if (volume(musicVolume) > 0 && context.currentTime >= nextMusicAt) {
      tone(melody[note++ % melody.length], "sine", 1.2, music);
      nextMusicAt = context.currentTime + 1.8;
    }
  }
  function dispose(): void {
    disposed = true;
    if (context) {
      effects.disconnect();
      music.disconnect();
      void context.close().catch(() => {});
      context = null;
    }
  }
  return { unlock, update, dispose };
}
