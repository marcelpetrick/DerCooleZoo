// SPDX-FileCopyrightText: 2026 Marcel Petrick
// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, expect, test, vi } from "vitest";
import { createAudio, musicTracksCount } from "../src/audio";
const param = () => ({
  value: 0,
  setValueAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
  setTargetAtTime: vi.fn(),
});
function fakeContext(state = "running", reject = false) {
  const gains: {
    gain: ReturnType<typeof param>;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }[] = [];
  const oscillators: {
    type: string;
    frequency: ReturnType<typeof param>;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    onended: (() => void) | null;
  }[] = [];
  const context = {
    currentTime: 0,
    state,
    destination: {},
    createGain: vi.fn(() => {
      const g = { gain: param(), connect: vi.fn(), disconnect: vi.fn() };
      gains.push(g);
      return g;
    }),
    createOscillator: vi.fn(() => {
      const o = {
        type: "sine",
        frequency: param(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null as (() => void) | null,
      };
      oscillators.push(o);
      return o;
    }),
    resume: vi.fn(() =>
      reject ? Promise.reject(new Error("blocked")) : Promise.resolve(),
    ),
    close: vi.fn(() =>
      reject ? Promise.reject(new Error("closed")) : Promise.resolve(),
    ),
  };
  const constructor = vi.fn(function () {
    return context;
  });
  vi.stubGlobal("AudioContext", constructor);
  return { context, gains, oscillators, constructor };
}
afterEach(() => vi.unstubAllGlobals());
test("never initializes audio before a gesture and handles unsupported browsers", () => {
  const { constructor } = fakeContext();
  const audio = createAudio();
  audio.update(1, 1, "coin");
  expect(constructor).not.toHaveBeenCalled();
  vi.stubGlobal("AudioContext", undefined);
  audio.unlock();
  audio.update(1, 1, "arrival");
  audio.dispose();
  expect(constructor).not.toHaveBeenCalled();
});
test("initializes once, synthesizes varied short cues and disconnects finished notes", () => {
  const { constructor, context, gains, oscillators } = fakeContext();
  const audio = createAudio();
  audio.unlock();
  audio.unlock();
  expect(constructor).toHaveBeenCalledTimes(1);
  expect(gains.slice(0, 2).map((g) => g.gain.value)).toEqual([0, 0]);
  for (const event of [
    "coin",
    "ticket",
    "arrival",
    "built",
    "build",
    "clean",
    "done",
    "animal",
    "popcorn",
    "goal",
    "expansion",
  ])
    audio.update(0.5, 0, event);
  expect(oscillators).toHaveLength(11);
  expect(new Set(oscillators.map((o) => o.type))).toEqual(
    new Set(["sine", "triangle", "square"]),
  );
  for (const o of oscillators) {
    expect(o.start).toHaveBeenCalledWith(0);
    o.onended!();
    expect(o.disconnect).toHaveBeenCalledOnce();
  }
  audio.update(0.5, 0, "expansion");
  audio.update(0.5, 0, "unknown");
  expect(oscillators).toHaveLength(11);
  audio.dispose();
  expect(context.close).toHaveBeenCalledOnce();
  expect(gains[0].disconnect).toHaveBeenCalledOnce();
  audio.unlock();
  expect(constructor).toHaveBeenCalledTimes(1);
  audio.update(1, 1, "coin");
});
test("music and effects mute independently and sparse music follows the audio clock", () => {
  const { context, gains, oscillators } = fakeContext();
  const audio = createAudio();
  audio.unlock();
  audio.update(0, 1, "coin");
  expect(oscillators).toHaveLength(1);
  audio.update(0, 1, "arrival");
  expect(oscillators).toHaveLength(1);
  context.currentTime = 2;
  audio.update(0, 1, "arrival");
  expect(oscillators).toHaveLength(2);
  context.currentTime = 4;
  audio.update(1, 0, "coin");
  expect(oscillators).toHaveLength(3);
  expect(gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(1, 4, 0.02);
  expect(gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 4, 0.05);
  for (let i = 0; i < 10; i++) {
    context.currentTime += 2;
    audio.update(0, 1, "");
  }
  expect(oscillators.length).toBeGreaterThan(3);
  expect(oscillators.length).toBeLessThan(13);
  audio.update(NaN, Infinity, "coin");
  expect(gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 24, 0.02);
  audio.update(-1, 2, "");
  expect(gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 24, 0.02);
  expect(gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(
    0.45,
    24,
    0.05,
  );
  audio.dispose();
});
test("resumes a suspended context and contains rejected resume or close promises", async () => {
  const { context } = fakeContext("suspended", true);
  const audio = createAudio();
  audio.unlock();
  await Promise.resolve();
  expect(context.resume).toHaveBeenCalledOnce();
  audio.dispose();
  await Promise.resolve();
  expect(context.close).toHaveBeenCalledOnce();
});
test("contains initialization failures and disposal before unlock", () => {
  vi.stubGlobal(
    "AudioContext",
    vi.fn(function () {
      throw new Error("unavailable");
    }),
  );
  const audio = createAudio();
  expect(() => audio.unlock()).not.toThrow();
  audio.update(1, 1, "coin");
  audio.dispose();
  audio.unlock();
  const untouched = createAudio();
  untouched.dispose();
  untouched.unlock();
});

test("every child-friendly action cue supports serials and repeated actions", () => {
  const { oscillators } = fakeContext();
  const audio = createAudio();
  audio.unlock();
  const actions = [
    "select",
    "nav",
    "tap",
    "feed",
    "water",
    "pet",
    "clean",
    "clear",
    "repair",
    "built",
    "buy",
    "food",
    "error",
    "save",
    "unlock",
    "walk",
    "fence",
    "remove",
    "hire",
  ];
  for (const action of actions) {
    const before = oscillators.length;
    audio.update(0.5, 0, `${action}:1`);
    expect(oscillators).toHaveLength(before + 1);
    audio.update(0.5, 0, `${action}:1`);
    expect(oscillators).toHaveLength(before + 1);
    audio.update(0.5, 0, `${action}:2`);
    expect(oscillators).toHaveLength(before + 2);
  }
  for (const oscillator of oscillators) {
    expect(oscillator.frequency.linearRampToValueAtTime).toHaveBeenCalledOnce();
    expect(oscillator.stop.mock.calls[0][0]).toBeLessThan(0.4);
    expect(["sine", "triangle"]).toContain(oscillator.type);
  }
  const before = oscillators.length;
  audio.update(1, 0, "constructor:1");
  audio.update(1, 0, "__proto__:2");
  expect(oscillators).toHaveLength(before);
  audio.dispose();
});

test("all catalog animals have distinct gentle synthesized voices and cleanup", async () => {
  const { species } = await import("../src/catalog");
  const { oscillators, gains } = fakeContext();
  const audio = createAudio();
  audio.unlock();
  const pitches = new Set<number>();
  for (const animal of species) {
    const before = oscillators.length;
    audio.update(0.4, 0, `animal:${animal.id}:1`);
    const notes = oscillators.slice(before);
    expect(notes.length).toBeGreaterThanOrEqual(2);
    expect(notes.length).toBeLessThanOrEqual(3);
    pitches.add(notes[0].frequency.setValueAtTime.mock.calls[0][0]);
    expect(notes[0].start).toHaveBeenCalledWith(0);
    expect(notes[1].start.mock.calls[0][0]).toBeGreaterThan(0);
    for (const note of notes) {
      expect(note.stop.mock.calls[0][0]).toBeLessThan(0.8);
      expect(["sine", "triangle"]).toContain(note.type);
      note.onended!();
      expect(note.disconnect).toHaveBeenCalledOnce();
    }
    audio.update(0.4, 0, `animal:${animal.id}:1`);
    expect(oscillators).toHaveLength(before + notes.length);
    audio.update(0.4, 0, `animal:${animal.id}:2`);
    expect(oscillators).toHaveLength(before + notes.length * 2);
  }
  expect(pitches.size).toBe(species.length);
  const before = oscillators.length;
  audio.update(0.4, 0, "animal:unknown:3");
  expect(oscillators).toHaveLength(before + 1);
  expect(oscillators.at(-1)!.frequency.setValueAtTime).toHaveBeenCalledWith(
    523.25,
    0,
  );
  audio.update(0, 0, "animal:goat:4");
  expect(oscillators).toHaveLength(before + 1);
  for (const gain of gains.slice(2)) {
    expect(
      gain.gain.linearRampToValueAtTime.mock.calls[0][0],
    ).toBeLessThanOrEqual(0.08);
  }
  audio.dispose();
});

test("play and friendly events have short gentle musical cues", () => {
  const { oscillators } = fakeContext();
  const audio = createAudio();
  audio.unlock();
  for (const event of [
    "laugh",
    "school",
    "birthday",
    "sunny",
    "family",
    "photo",
    "balloon",
  ]) {
    const before = oscillators.length;
    audio.update(0.4, 0, event);
    expect(oscillators.length).toBeGreaterThan(before);
    const notes = oscillators.slice(before);
    expect(notes.length).toBeLessThanOrEqual(3);
    for (const note of notes)
      expect(note.stop.mock.calls[0][0]).toBeLessThan(1);
  }
  const before = oscillators.length;
  audio.update(0, 0, "laugh");
  expect(oscillators).toHaveLength(before);
  audio.dispose();
});

test("five distinct original tunes skip immediately and all respect music mute", () => {
  const { context, oscillators } = fakeContext();
  const audio = createAudio();
  audio.unlock();
  expect(musicTracksCount).toBe(5);
  const signatures = new Set<string>();
  for (let track = 0; track < musicTracksCount; track++) {
    context.currentTime = track * 10;
    audio.update(0, 0, "", (track + musicTracksCount - 1) % musicTracksCount);
    const before = oscillators.length;
    audio.update(0, 0.7, "", track);
    expect(oscillators).toHaveLength(before + 1);
    const note = oscillators.at(-1)!;
    const pitch = note.frequency.setValueAtTime.mock.calls[0][0];
    const duration = note.stop.mock.calls[0][0] - context.currentTime;
    signatures.add(`${note.type}:${pitch}:${duration.toFixed(2)}`);
    // Skip again before the scheduled beat: the next tune starts immediately.
    audio.update(0, 0.7, "", (track + 1) % musicTracksCount);
    expect(oscillators).toHaveLength(before + 2);
  }
  expect(signatures.size).toBe(musicTracksCount);
  const count = oscillators.length;
  for (const track of [-1, musicTracksCount, NaN, Infinity]) {
    audio.update(0, 0, "", track);
    expect(oscillators).toHaveLength(count);
  }
  audio.dispose();
});
