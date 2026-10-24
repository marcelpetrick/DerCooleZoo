// SPDX-FileCopyrightText: 2026 Marcel Petrick
// SPDX-License-Identifier: GPL-3.0-or-later
/** Local WebAudio synthesis, created only following a user gesture. */
export interface ZooAudio {
  unlock: () => void;
  update: (sound: number, music: number, event: string) => void;
  dispose: () => void;
}
interface Cue {
  frequency: number;
  type: OscillatorType;
  duration: number;
  end?: number;
  pulses?: number;
}
const cues: Record<string, Cue> = {
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
  select: { frequency: 620, end: 780, type: "sine", duration: 0.09 },
  nav: { frequency: 520, end: 660, type: "sine", duration: 0.09 },
  tap: { frequency: 440, end: 540, type: "sine", duration: 0.07 },
  feed: { frequency: 390, end: 560, type: "triangle", duration: 0.17 },
  water: { frequency: 720, end: 1120, type: "sine", duration: 0.16 },
  pet: { frequency: 580, end: 850, type: "sine", duration: 0.22 },
  clear: { frequency: 360, end: 640, type: "triangle", duration: 0.12 },
  repair: { frequency: 300, end: 460, type: "triangle", duration: 0.1 },
  buy: { frequency: 740, end: 980, type: "sine", duration: 0.16 },
  food: { frequency: 420, end: 620, type: "triangle", duration: 0.14 },
  error: { frequency: 370, end: 300, type: "sine", duration: 0.18 },
  save: { frequency: 660, end: 880, type: "sine", duration: 0.14 },
  unlock: { frequency: 780, end: 1170, type: "sine", duration: 0.28 },
  walk: { frequency: 280, end: 360, type: "triangle", duration: 0.09 },
  fence: { frequency: 330, end: 480, type: "triangle", duration: 0.12 },
  remove: { frequency: 480, end: 720, type: "sine", duration: 0.12 },
  hire: { frequency: 590, end: 890, type: "sine", duration: 0.2 },
};
/** Stylized quiet squeaks, bleats, chirps and hums, rather than recordings. */
const animalCues: Record<string, Cue> = {
  rabbit: { frequency: 660, end: 950, type: "sine", duration: 0.12, pulses: 2 },
  guinea: {
    frequency: 780,
    end: 1050,
    type: "sine",
    duration: 0.11,
    pulses: 3,
  },
  goat: {
    frequency: 220,
    end: 180,
    type: "triangle",
    duration: 0.18,
    pulses: 3,
  },
  pig: {
    frequency: 190,
    end: 260,
    type: "triangle",
    duration: 0.13,
    pulses: 2,
  },
  raccoon: {
    frequency: 520,
    end: 760,
    type: "sine",
    duration: 0.12,
    pulses: 3,
  },
  fox: {
    frequency: 450,
    end: 700,
    type: "triangle",
    duration: 0.12,
    pulses: 2,
  },
  otter: { frequency: 810, end: 1020, type: "sine", duration: 0.1, pulses: 3 },
  flamingo: {
    frequency: 350,
    end: 500,
    type: "triangle",
    duration: 0.12,
    pulses: 2,
  },
  iguana: { frequency: 320, end: 380, type: "sine", duration: 0.1, pulses: 2 },
  tortoise: {
    frequency: 260,
    end: 310,
    type: "sine",
    duration: 0.13,
    pulses: 2,
  },
  meerkat: { frequency: 710, end: 900, type: "sine", duration: 0.1, pulses: 2 },
  parrot: {
    frequency: 880,
    end: 650,
    type: "triangle",
    duration: 0.14,
    pulses: 3,
  },
  zebra: {
    frequency: 330,
    end: 540,
    type: "triangle",
    duration: 0.18,
    pulses: 2,
  },
  giraffe: {
    frequency: 160,
    end: 200,
    type: "sine",
    duration: 0.25,
    pulses: 2,
  },
  camel: {
    frequency: 180,
    end: 230,
    type: "triangle",
    duration: 0.22,
    pulses: 2,
  },
  kangaroo: {
    frequency: 410,
    end: 540,
    type: "sine",
    duration: 0.12,
    pulses: 2,
  },
  crocodile: {
    frequency: 140,
    end: 190,
    type: "triangle",
    duration: 0.2,
    pulses: 2,
  },
  penguin: {
    frequency: 550,
    end: 390,
    type: "triangle",
    duration: 0.14,
    pulses: 3,
  },
  elephant: {
    frequency: 290,
    end: 440,
    type: "triangle",
    duration: 0.24,
    pulses: 2,
  },
  hippo: { frequency: 150, end: 220, type: "sine", duration: 0.22, pulses: 2 },
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
    endFrequency = frequency,
    delay = 0,
  ): void {
    const ctx = context!;
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();
    const start = ctx.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.linearRampToValueAtTime(
      endFrequency,
      start + duration * 0.7,
    );
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(
      type === "square" ? 0.035 : 0.08,
      start + 0.015,
    );
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope);
    envelope.connect(destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
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
    if (changed && volume(soundVolume) > 0) {
      const [name, detail] = event.split(":");
      const cue =
        name === "animal" && detail
          ? Object.hasOwn(animalCues, detail)
            ? animalCues[detail]
            : cues.animal
          : Object.hasOwn(cues, name)
            ? cues[name]
            : null;
      if (cue) {
        for (let pulse = 0; pulse < (cue.pulses ?? 1); pulse++) {
          const variation = pulse % 2 === 0 ? 1 : 1.06;
          tone(
            cue.frequency * variation,
            cue.type,
            cue.duration,
            effects,
            (cue.end ?? cue.frequency) * variation,
            pulse * (cue.duration + 0.035),
          );
        }
      }
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
