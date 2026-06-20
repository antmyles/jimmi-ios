/*
 * JIMMI Orb design philosophy: Monastic Tech Minimalism revised from reference, d378fb02 frameless float revision.
 * This component should feel like a quiet black-label coaching instrument: a structured emissive particle globe, organic surface motion, and restrained functional state color without a visible circular touch frame. Camera framing deliberately balances breathing room with sharper apparent scale so the particle shell stays clear without clipping against the WebGL canvas.
 */

import { Canvas, useFrame } from "@react-three/fiber";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { AdditiveBlending, BackSide, Color, DoubleSide, Group, Mesh, Points, ShaderMaterial, Vector2 } from "three";
import {
  haloFragmentShader,
  haloVertexShader,
  particleFragmentShader,
  particleVertexShader,
  rimFragmentShader,
  rimVertexShader,
} from "./orbShaders";
import {
  JimmiOrbQuality,
  JimmiOrbState,
  QUALITY_DPR,
  QUALITY_PARTICLE_COUNT,
  damp,
  resolveStatePreset,
} from "./orbState";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";
import "./JimmiWebGLOrb.css";

export type { JimmiOrbQuality, JimmiOrbState } from "./orbState";

const JIMMI_ORB_VERSION = "d378fb02";

export interface JimmiWebGLOrbProps {
  state?: JimmiOrbState;
  isPressed?: boolean;
  onClick?: () => void;
  className?: string;
  size?: number | string;
  quality?: JimmiOrbQuality;
  reducedMotion?: boolean;
  colors?: Partial<Record<JimmiOrbState, string>>;
  touchPoint?: { x: number; y: number; strength: number };
  ariaLabel?: string;
  disabled?: boolean;
  motionScale?: number;
}

interface JimmiOrbSceneProps {
  state: JimmiOrbState;
  isPressed: boolean;
  quality: JimmiOrbQuality;
  reducedMotion: boolean;
  colors?: Partial<Record<JimmiOrbState, string>>;
  touchPoint: { x: number; y: number; strength: number };
  motionScale: number;
}

interface ParticleAttributes {
  positions: Float32Array;
  seeds: Float32Array;
  layers: Float32Array;
  sizes: Float32Array;
}

function deterministicNoise(index: number, salt = 0): number {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function buildParticleAttributes(targetCount: number): ParticleAttributes {
  const rings = Math.max(28, Math.round(Math.sqrt(targetCount * 0.46)));
  const columns = Math.max(48, Math.round(targetCount / rings));
  const count = rings * columns;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const layers = new Float32Array(count);
  const sizes = new Float32Array(count);

  let index = 0;
  for (let ring = 0; ring < rings; ring += 1) {
    const v = (ring + 0.5) / rings;
    const phi = v * Math.PI;
    const y = Math.cos(phi);
    const radiusAtY = Math.sin(phi);
    const stagger = ring % 2 === 0 ? 0 : 0.5;

    for (let column = 0; column < columns; column += 1) {
      const u = (column + stagger) / columns;
      const theta = u * Math.PI * 2;
      const seed = deterministicNoise(index, 1.7);
      const seedB = deterministicNoise(index, 9.1);
      const microShell = 1 + (seed - 0.5) * 0.006;
      const sizeFalloffAtPoles = 0.78 + Math.sin(phi) * 0.34;

      positions[index * 3] = Math.cos(theta) * radiusAtY * microShell;
      positions[index * 3 + 1] = y * microShell;
      positions[index * 3 + 2] = Math.sin(theta) * radiusAtY * microShell;
      seeds[index] = seed;
      layers[index] = v * 0.72 + seedB * 0.28;
      sizes[index] = (0.78 + seed * 0.72) * sizeFalloffAtPoles;
      index += 1;
    }
  }

  return { positions, seeds, layers, sizes };
}

function accentMixForState(state: JimmiOrbState): number {
  switch (state) {
    case "thinking":
      return 0.84;
    case "speaking":
      return 0.96;
    case "interrupted":
      return 0.14;
    case "error":
      return 0.42;
    case "unsupported":
      return 0.24;
    case "listening":
      return 0.1;
    case "idle":
    default:
      return 0;
  }
}

function transitionLambdaForState(state: JimmiOrbState, reducedMotion: boolean): number {
  const multiplier = reducedMotion ? 0.72 : 1;

  switch (state) {
    case "listening":
      return 4.2 * multiplier;
    case "speaking":
      return 10.2 * multiplier;
    case "thinking":
      return 6.2 * multiplier;
    case "interrupted":
      return 8.2 * multiplier;
    case "error":
      return 7.4 * multiplier;
    case "unsupported":
      return 5.2 * multiplier;
    case "idle":
    default:
      return 4.8 * multiplier;
  }
}

function entryImpulseForState(state: JimmiOrbState): number {
  switch (state) {
    case "listening":
      return 0.28;
    case "speaking":
      return 0.52;
    case "thinking":
      return 0.24;
    case "interrupted":
      return 0.3;
    case "error":
      return 0.58;
    case "unsupported":
      return 0.16;
    case "idle":
    default:
      return 0.12;
  }
}

function impulseDecayForState(state: JimmiOrbState): number {
  switch (state) {
    case "listening":
      return 1.55;
    case "speaking":
      return 2.05;
    case "thinking":
      return 1.12;
    case "interrupted":
      return 1.85;
    case "error":
      return 1.45;
    case "unsupported":
      return 0.75;
    case "idle":
    default:
      return 0.95;
  }
}

function JimmiOrbScene({ state, isPressed, quality, reducedMotion, colors, touchPoint, motionScale }: JimmiOrbSceneProps) {
  const groupRef = useRef<Group>(null);
  const pointsRef = useRef<Points>(null);
  const rimMaterialRef = useRef<ShaderMaterial>(null);
  const haloMaterialRef = useRef<ShaderMaterial>(null);
  const particleMaterialRef = useRef<ShaderMaterial>(null);
  const impulseRef = useRef(0);
  const motionTimeRef = useRef(0);
  const previousStateRef = useRef<JimmiOrbState>(state);
  const activeRef = useRef({
    intensity: 0.7,
    pulse: 0.08,
    turbulence: 0.22,
    wave: 0.05,
    speed: 0.32,
    halo: 0.18,
    pointSize: 2.25,
    pressed: 0,
    touchX: 0,
    touchY: 0,
    touchStrength: 0,
    accentMix: 0,
  });
  const baseColorRef = useRef(new Color("#f5efe4"));
  const accentColorRef = useRef(new Color("#f5efe4"));

  const particleCount = useMemo(() => {
    const base = QUALITY_PARTICLE_COUNT[quality] ?? QUALITY_PARTICLE_COUNT.medium;
    return reducedMotion ? Math.max(900, Math.floor(base * 0.52)) : base;
  }, [quality, reducedMotion]);

  const attributes = useMemo(() => buildParticleAttributes(particleCount), [particleCount]);

  const particleUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uBaseColor: { value: new Color("#f5efe4") },
      uAccentColor: { value: new Color("#f5efe4") },
      uAccentMix: { value: 0 },
      uIntensity: { value: 0.7 },
      uPulse: { value: 0.08 },
      uTurbulence: { value: 0.22 },
      uWave: { value: 0.05 },
      uPressed: { value: 0 },
      uReducedMotion: { value: reducedMotion ? 1 : 0 },
      uPointScale: { value: 2.25 },
      uTouchPoint: { value: new Vector2(0, 0) },
      uTouchStrength: { value: 0 },
    }),
    [reducedMotion],
  );

  const rimUniforms = useMemo(
    () => ({
      uAccentColor: { value: new Color("#f5efe4") },
      uIntensity: { value: 0.7 },
      uAccentMix: { value: 0 },
      uPressed: { value: 0 },
    }),
    [],
  );

  const haloUniforms = useMemo(
    () => ({
      uAccentColor: { value: new Color("#f5efe4") },
      uHalo: { value: 0.18 },
      uAccentMix: { value: 0 },
      uPressed: { value: 0 },
    }),
    [],
  );

  useEffect(() => {
    if (previousStateRef.current !== state) {
      impulseRef.current = entryImpulseForState(state);
      previousStateRef.current = state;
    }
  }, [state]);

  useFrame(({ clock, gl }, delta) => {
    const preset = resolveStatePreset(state, colors);
    const active = activeRef.current;
    const lambda = transitionLambdaForState(state, reducedMotion);
    const safeMotionScale = Number.isFinite(motionScale) ? Math.min(1.4, Math.max(0.2, motionScale)) : 1;
    const impulse = impulseRef.current;

    const touchPressTarget = Math.min(1, touchPoint.strength * 0.42 + (isPressed ? 0.34 : 0));

    active.intensity = damp(active.intensity, preset.intensity + impulse * 0.14 + touchPoint.strength * 0.055, lambda, delta);
    active.pulse = damp(active.pulse, preset.pulse + impulse * 0.22 + touchPoint.strength * 0.035, lambda, delta);
    active.turbulence = damp(active.turbulence, preset.turbulence + impulse * 0.04, lambda, delta);
    active.wave = damp(active.wave, preset.wave + impulse * 0.1, lambda, delta);
    active.speed = damp(active.speed, preset.speed * safeMotionScale, lambda, delta);
    active.halo = damp(active.halo, preset.halo + impulse * 0.08 + touchPoint.strength * 0.04, lambda, delta);
    active.pointSize = damp(active.pointSize, preset.pointSize + touchPoint.strength * 0.06, lambda, delta);
    active.pressed = damp(active.pressed, touchPressTarget, reducedMotion ? 9.4 : 15.2, delta);
    active.touchX = damp(active.touchX, touchPoint.x, reducedMotion ? 7.2 : 12.8, delta);
    active.touchY = damp(active.touchY, touchPoint.y, reducedMotion ? 7.2 : 12.8, delta);
    active.touchStrength = damp(active.touchStrength, touchPoint.strength, reducedMotion ? 5.8 : 9.6, delta);
    active.accentMix = damp(active.accentMix, accentMixForState(state), lambda, delta);
    impulseRef.current = Math.max(0, impulse - delta * impulseDecayForState(state));

    motionTimeRef.current += delta * (reducedMotion ? Math.min(active.speed, 0.18) : active.speed);
    const t = motionTimeRef.current;
    baseColorRef.current.lerp(new Color(preset.particle), 1 - Math.exp(-lambda * delta));
    accentColorRef.current.lerp(new Color(preset.accent), 1 - Math.exp(-lambda * delta));

    if (groupRef.current) {
      const pressedScale = 1 - active.pressed * 0.056;
      const breathingScale = 1 + Math.sin(t * 1.25) * active.pulse * 0.01;
      groupRef.current.scale.setScalar(pressedScale * breathingScale);
      groupRef.current.rotation.y += delta * (reducedMotion ? 0.012 : 0.032 + active.turbulence * 0.012) * safeMotionScale;
      groupRef.current.rotation.x = -0.06 + Math.sin(t * 0.28) * 0.018;
    }

    if (pointsRef.current) {
      pointsRef.current.rotation.z = Math.sin(t * 0.18) * 0.018;
    }

    if (particleMaterialRef.current) {
      const uniforms = particleMaterialRef.current.uniforms;
      uniforms.uTime.value = motionTimeRef.current;
      uniforms.uPixelRatio.value = Math.min(gl.getPixelRatio(), reducedMotion ? 1.15 : 2);
      uniforms.uBaseColor.value.copy(baseColorRef.current);
      uniforms.uAccentColor.value.copy(accentColorRef.current);
      uniforms.uAccentMix.value = active.accentMix;
      uniforms.uIntensity.value = active.intensity;
      uniforms.uPulse.value = active.pulse;
      uniforms.uTurbulence.value = active.turbulence;
      uniforms.uWave.value = active.wave;
      uniforms.uPressed.value = active.pressed;
      uniforms.uReducedMotion.value = reducedMotion ? 1 : 0;
      uniforms.uPointScale.value = active.pointSize;
      uniforms.uTouchPoint.value.set(active.touchX, active.touchY);
      uniforms.uTouchStrength.value = active.touchStrength;
    }

    if (rimMaterialRef.current) {
      rimMaterialRef.current.uniforms.uAccentColor.value.copy(accentColorRef.current);
      rimMaterialRef.current.uniforms.uIntensity.value = active.intensity;
      rimMaterialRef.current.uniforms.uAccentMix.value = active.accentMix;
      rimMaterialRef.current.uniforms.uPressed.value = active.pressed;
    }

    if (haloMaterialRef.current) {
      haloMaterialRef.current.uniforms.uAccentColor.value.copy(accentColorRef.current);
      haloMaterialRef.current.uniforms.uHalo.value = active.halo;
      haloMaterialRef.current.uniforms.uAccentMix.value = active.accentMix;
      haloMaterialRef.current.uniforms.uPressed.value = active.pressed;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0, -0.2]} scale={[2.16, 2.16, 1]}>
        <planeGeometry args={[1.5, 1.5, 1, 1]} />
        <shaderMaterial
          ref={haloMaterialRef}
          vertexShader={haloVertexShader}
          fragmentShader={haloFragmentShader}
          uniforms={haloUniforms}
          transparent
          depthWrite={false}
          depthTest={false}
          blending={AdditiveBlending}
          side={DoubleSide}
        />
      </mesh>

      <points ref={pointsRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[attributes.positions, 3]} />
          <bufferAttribute attach="attributes-aSeed" args={[attributes.seeds, 1]} />
          <bufferAttribute attach="attributes-aLayer" args={[attributes.layers, 1]} />
          <bufferAttribute attach="attributes-aSize" args={[attributes.sizes, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={particleMaterialRef}
          vertexShader={particleVertexShader}
          fragmentShader={particleFragmentShader}
          uniforms={particleUniforms}
          transparent
          depthWrite={false}
          depthTest={true}
          blending={AdditiveBlending}
        />
      </points>

      <mesh scale={1.012}>
        <sphereGeometry args={[1, 64, 42]} />
        <shaderMaterial
          ref={rimMaterialRef}
          vertexShader={rimVertexShader}
          fragmentShader={rimFragmentShader}
          uniforms={rimUniforms}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          side={BackSide}
        />
      </mesh>
    </group>
  );
}

export const JimmiWebGLOrb = memo(function JimmiWebGLOrb({
  state = "idle",
  isPressed = false,
  onClick,
  className = "",
  size = 220,
  quality = "medium",
  reducedMotion,
  colors,
  touchPoint,
  ariaLabel = "JIMMI voice orb",
  disabled = false,
  motionScale = 1,
}: JimmiWebGLOrbProps) {
  const prefersReducedMotion = usePrefersReducedMotion(reducedMotion);
  const dpr = prefersReducedMotion ? ([1, 1.15] as [number, number]) : QUALITY_DPR[quality];
  const [touchResponse, setTouchResponse] = useState({ x: 0, y: 0, strength: 0 });
  const style = useMemo(
    () => ({ "--jimmi-orb-size": typeof size === "number" ? `${size}px` : size }) as CSSProperties,
    [size],
  );

  const updateTouchResponse = useCallback((event: PointerEvent<HTMLButtonElement>, strength: number) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1));
    const y = Math.max(-1, Math.min(1, -(((event.clientY - rect.top) / rect.height) * 2 - 1)));
    setTouchResponse({ x, y, strength });
  }, []);

  const handlePointerDown = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    updateTouchResponse(event, 1.14);
  }, [updateTouchResponse]);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    if (event.buttons > 0 || event.pointerType === "touch") {
      updateTouchResponse(event, 0.84);
    }
  }, [updateTouchResponse]);

  const releaseTouchResponse = useCallback(() => {
    setTouchResponse((current) => ({ ...current, strength: 0 }));
  }, []);

  return (
    <button
      type="button"
      className={`jimmi-orb ${className}`.trim()}
      style={style}
      onClick={disabled ? undefined : onClick}
      onPointerDown={disabled ? undefined : handlePointerDown}
      onPointerMove={disabled ? undefined : handlePointerMove}
      onPointerUp={disabled ? undefined : releaseTouchResponse}
      onPointerCancel={disabled ? undefined : releaseTouchResponse}
      onPointerLeave={disabled ? undefined : releaseTouchResponse}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={isPressed}
      data-state={state}
      data-pressed={isPressed ? "true" : "false"}
      data-orb-version={JIMMI_ORB_VERSION}
      data-orb-transition-smoothing="phase-continuous"
      data-orb-motion-scale={motionScale}
    >
      <span className="jimmi-orb__fallback" aria-hidden="true" />
      <span className="jimmi-orb__status-ring" aria-hidden="true" />
      <span className="jimmi-orb__canvas" aria-hidden="true">
        <Canvas
          camera={{ position: [0, 0, 4.35], fov: 40, near: 0.1, far: 20 }}
          dpr={dpr}
          gl={{ alpha: true, antialias: quality !== "low", powerPreference: "high-performance" }}
          resize={{ scroll: false, debounce: { scroll: 50, resize: 0 } }}
        >
          <JimmiOrbScene
            state={state}
            isPressed={isPressed}
            quality={quality}
            reducedMotion={prefersReducedMotion}
            colors={colors}
            touchPoint={touchPoint ?? touchResponse}
            motionScale={motionScale}
          />
        </Canvas>
      </span>
    </button>
  );
});

export default JimmiWebGLOrb;
