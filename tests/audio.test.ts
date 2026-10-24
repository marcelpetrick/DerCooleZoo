// SPDX-FileCopyrightText: 2026 Marcel Petrick
// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, expect, test, vi } from "vitest";
import { createAudio } from "../src/audio";
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
  expect(oscillators).toHaveLength(13);
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
