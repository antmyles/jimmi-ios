/*
 * JIMMI Orb design philosophy: Monastic Tech Minimalism.
 * Keep the component quiet, monochrome, tactile, and premium; state color is functional, restrained, and never decorative.
 */

import { Color } from "three";

export type JimmiOrbState = "idle" | "listening" | "thinking" | "speaking" | "interrupted" | "error" | "unsupported";
export type JimmiOrbQuality = "low" | "medium" | "high" | "ultra";

export interface OrbStatePreset {
  accent: string;
  core: string;
  particle: string;
  intensity: number;
  pulse: number;
  turbulence: number;
  wave: number;
  speed: number;
  halo: number;
  pointSize: number;
}

export const DEFAULT_STATE_COLORS: Record<JimmiOrbState, string> = {
  idle: "#a8a093",
  listening: "#fffdf6",
  thinking: "#4bb3f4",
  speaking: "#e0443e",
  interrupted: "#a9a095",
  error: "#b99a61",
  unsupported: "#6e7883",
};

export const ORB_STATE_PRESETS: Record<JimmiOrbState, OrbStatePreset> = {
  idle: {
    accent: DEFAULT_STATE_COLORS.idle,
    core: "#8e877d",
    particle: "#a59d90",
    intensity: 0.42,
    pulse: 0.02,
    turbulence: 0.2,
    wave: 0.018,
    speed: 0.16,
    halo: 0.06,
    pointSize: 2.05,
  },
  listening: {
    accent: DEFAULT_STATE_COLORS.listening,
    core: "#ffffff",
    particle: "#ffffff",
    intensity: 1.24,
    pulse: 0.42,
    turbulence: 0.5,
    wave: 0.18,
    speed: 0.5,
    halo: 0.52,
    pointSize: 3.4,
  },
  thinking: {
    accent: DEFAULT_STATE_COLORS.thinking,
    core: "#abd7ff",
    particle: "#caeaff",
    intensity: 1.3,
    pulse: 0.38,
    turbulence: 0.84,
    wave: 0.38,
    speed: 0.66,
    halo: 0.62,
    pointSize: 3.35,
  },
  speaking: {
    accent: DEFAULT_STATE_COLORS.speaking,
    core: "#ffd8d2",
    particle: "#ffe2dd",
    intensity: 1.44,
    pulse: 0.56,
    turbulence: 0.72,
    wave: 0.88,
    speed: 0.82,
    halo: 0.74,
    pointSize: 3.6,
  },
  interrupted: {
    accent: DEFAULT_STATE_COLORS.interrupted,
    core: "#d6d0c7",
    particle: "#e1dbd0",
    intensity: 0.98,
    pulse: 0.24,
    turbulence: 0.42,
    wave: 0.18,
    speed: 0.4,
    halo: 0.34,
    pointSize: 2.85,
  },
  error: {
    accent: DEFAULT_STATE_COLORS.error,
    core: "#fff8e6",
    particle: "#fffef8",
    intensity: 1.2,
    pulse: 0.42,
    turbulence: 0.6,
    wave: 0.42,
    speed: 0.56,
    halo: 0.52,
    pointSize: 3.2,
  },
  unsupported: {
    accent: DEFAULT_STATE_COLORS.unsupported,
    core: "#c8d1da",
    particle: "#d9e2ea",
    intensity: 0.86,
    pulse: 0.12,
    turbulence: 0.34,
    wave: 0.1,
    speed: 0.3,
    halo: 0.24,
    pointSize: 2.52,
  },
};

export const QUALITY_PARTICLE_COUNT: Record<JimmiOrbQuality, number> = {
  low: 1500,
  medium: 3000,
  high: 5200,
  ultra: 7600,
};

export const QUALITY_DPR: Record<JimmiOrbQuality, [number, number]> = {
  low: [1, 1.25],
  medium: [1, 1.65],
  high: [1, 2],
  ultra: [1.25, 2.5],
};

export function resolveStatePreset(
  state: JimmiOrbState,
  colors?: Partial<Record<JimmiOrbState, string>>,
): OrbStatePreset {
  const preset = ORB_STATE_PRESETS[state] ?? ORB_STATE_PRESETS.idle;
  const accent = colors?.[state] ?? preset.accent;

  return {
    ...preset,
    accent,
    core: state === "idle" && colors?.idle ? colors.idle : preset.core,
  };
}

export function colorToArray(color: Color | string): [number, number, number] {
  const value = color instanceof Color ? color : new Color(color);
  return [value.r, value.g, value.b];
}

export function damp(current: number, target: number, lambda: number, delta: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * delta));
}
