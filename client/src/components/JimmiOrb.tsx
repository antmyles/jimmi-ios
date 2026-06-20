import type { CSSProperties } from "react";
import { motion } from "framer-motion";

export type JimmiOrbTopic = "general" | "training" | "nutrition" | "recovery";
export type OrbVoiceState = "idle" | "listening" | "thinking" | "speaking" | "interrupted" | "unsupported" | "error";

type JimmiOrbProps = {
  orbState: OrbVoiceState;
  lastMessageTopic?: JimmiOrbTopic;
  size?: "compact" | "hero";
};

type Particle = {
  id: string;
  x: number;
  y: number;
  r: number;
  opacity: number;
  blur: number;
  depth: number;
  layer: "rear" | "core" | "front";
};

type DustParticle = {
  id: string;
  x: number;
  y: number;
  r: number;
  opacity: number;
};

type StateVisual = {
  pulse: string;
  sphere: string;
  aura: string;
  particle: string;
  bloom: string;
  colorName: "warm-white" | "electric-blue" | "signal-red" | "dimmed-white" | "muted-gray";
  rgb: string;
  coreRgb: string;
  edgeRgb: string;
  dustRgb: string;
};

const stateStyles: Record<OrbVoiceState, StateVisual> = {
  idle: {
    pulse: "opacity-26 scale-100",
    sphere: "opacity-90 scale-100",
    aura: "opacity-30",
    particle: "opacity-88",
    bloom: "opacity-64",
    colorName: "dimmed-white",
    rgb: "238, 236, 229",
    coreRgb: "255, 255, 255",
    edgeRgb: "164, 164, 158",
    dustRgb: "232, 232, 224",
  },
  listening: {
    pulse: "opacity-62 scale-[1.026]",
    sphere: "opacity-100 scale-[1.014]",
    aura: "opacity-66",
    particle: "opacity-100",
    bloom: "opacity-100",
    colorName: "warm-white",
    rgb: "255, 255, 255",
    coreRgb: "255, 255, 255",
    edgeRgb: "210, 214, 214",
    dustRgb: "255, 255, 255",
  },
  thinking: {
    pulse: "opacity-68 scale-[1.032]",
    sphere: "opacity-100 scale-[1.018]",
    aura: "opacity-74",
    particle: "opacity-100",
    bloom: "opacity-100",
    colorName: "electric-blue",
    rgb: "64, 159, 255",
    coreRgb: "203, 232, 255",
    edgeRgb: "22, 83, 214",
    dustRgb: "118, 190, 255",
  },
  speaking: {
    pulse: "opacity-72 scale-[1.04]",
    sphere: "opacity-100 scale-[1.024]",
    aura: "opacity-78",
    particle: "opacity-100",
    bloom: "opacity-100",
    colorName: "signal-red",
    rgb: "255, 49, 67",
    coreRgb: "255, 204, 206",
    edgeRgb: "172, 9, 23",
    dustRgb: "255, 92, 104",
  },
  interrupted: {
    pulse: "opacity-34 scale-[0.992]",
    sphere: "opacity-86 scale-[0.994]",
    aura: "opacity-38",
    particle: "opacity-82",
    bloom: "opacity-62",
    colorName: "dimmed-white",
    rgb: "226, 223, 214",
    coreRgb: "255, 252, 244",
    edgeRgb: "144, 140, 132",
    dustRgb: "220, 216, 206",
  },
  error: {
    pulse: "opacity-36 scale-[0.988]",
    sphere: "opacity-78 scale-[0.986]",
    aura: "opacity-42",
    particle: "opacity-76",
    bloom: "opacity-66",
    colorName: "signal-red",
    rgb: "255, 54, 70",
    coreRgb: "255, 190, 194",
    edgeRgb: "132, 10, 22",
    dustRgb: "255, 98, 110",
  },
  unsupported: {
    pulse: "opacity-20 scale-100",
    sphere: "opacity-64 scale-100",
    aura: "opacity-22",
    particle: "opacity-62",
    bloom: "opacity-42",
    colorName: "muted-gray",
    rgb: "152, 154, 156",
    coreRgb: "214, 216, 216",
    edgeRgb: "84, 86, 88",
    dustRgb: "170, 172, 172",
  },
};

const topicMotionSeconds: Record<JimmiOrbTopic, number> = {
  general: 18,
  training: 12,
  nutrition: 15,
  recovery: 22,
};

const stateMotionSeconds: Record<OrbVoiceState, number> = {
  idle: 20,
  listening: 9,
  thinking: 7,
  speaking: 5,
  interrupted: 24,
  unsupported: 28,
  error: 18,
};

const seededRandom = (seed: number) => {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453123;
  return value - Math.floor(value);
};

const gaussianish = (seed: number) => {
  const a = seededRandom(seed);
  const b = seededRandom(seed + 91.17);
  const c = seededRandom(seed + 181.43);
  return (a + b + c) / 3;
};

const particles: Particle[] = Array.from({ length: 132 }, (_, index) => {
  const theta = seededRandom(index + 2.7) * Math.PI * 2;
  const radial = Math.pow(gaussianish(index + 8.3), 1.52) * 84;
  const depth = seededRandom(index + 15.9) * 2 - 1;
  const verticalCompression = 0.9 + depth * 0.05;
  const perspective = 1 + depth * 0.09;
  const jitterX = (seededRandom(index + 38.1) - 0.5) * 4.8;
  const jitterY = (seededRandom(index + 58.4) - 0.5) * 4.8;
  const x = 100 + Math.cos(theta) * radial * perspective + jitterX;
  const y = 100 + Math.sin(theta) * radial * verticalCompression + jitterY;
  const distance = Math.hypot(x - 100, y - 100) / 86;
  const edgeFade = Math.max(0, 1 - Math.pow(distance, 2.35));
  const depthLight = 0.52 + Math.max(depth, -0.4) * 0.34;
  const brightChance = seededRandom(index + 71.2);
  const largeSpark = brightChance > 0.91 ? 1.85 : brightChance > 0.78 ? 1.34 : 1;
  const coreBoost = 1 + (1 - Math.min(distance, 1)) * 0.38;
  const r = (0.42 + seededRandom(index + 99.6) * 1.35) * largeSpark * coreBoost * (0.94 + Math.max(depth, 0) * 0.24);
  const layer: Particle["layer"] = depth > 0.32 ? "front" : depth < -0.32 ? "rear" : "core";

  return {
    id: `realistic-particle-${index}`,
    x,
    y,
    r: Math.min(4.2, r),
    opacity: Math.min(0.98, Math.max(0.08, edgeFade * depthLight * (0.55 + seededRandom(index + 118.9) * 0.48))),
    blur: depth < -0.45 ? 0.62 : depth < -0.1 ? 0.28 : 0,
    depth,
    layer,
  };
}).filter((particle) => particle.opacity > 0.11 && Math.hypot(particle.x - 100, particle.y - 100) < 91);

const dustParticles: DustParticle[] = Array.from({ length: 18 }, (_, index) => {
  const theta = seededRandom(index + 304.2) * Math.PI * 2;
  const radius = 78 + seededRandom(index + 332.8) * 23;

  return {
    id: `outer-dust-${index}`,
    x: 100 + Math.cos(theta) * radius,
    y: 100 + Math.sin(theta) * radius * 0.94,
    r: 0.34 + seededRandom(index + 350.4) * 0.72,
    opacity: 0.1 + seededRandom(index + 378.7) * 0.24,
  };
}).filter((particle) => particle.x > -6 && particle.x < 206 && particle.y > -6 && particle.y < 206);

const rearParticles = particles.filter((particle) => particle.layer === "rear");
const coreParticles = particles.filter((particle) => particle.layer === "core");
const frontParticles = particles.filter((particle) => particle.layer === "front");
const brightParticles = particles.filter((particle) => particle.r > 2.15 && particle.opacity > 0.42).slice(0, 18);

function renderParticle(particle: Particle | DustParticle, fill = "url(#jimmi-realistic-particle)") {
  const blur = "blur" in particle && particle.blur > 0 ? { filter: `blur(${particle.blur}px)` } : undefined;

  return (
    <circle
      key={particle.id}
      cx={particle.x}
      cy={particle.y}
      r={particle.r}
      fill={fill}
      opacity={particle.opacity}
      style={blur}
    />
  );
}

export function JimmiOrb({ orbState, lastMessageTopic = "general", size = "hero" }: JimmiOrbProps) {
  const styles = stateStyles[orbState];
  const sizeClass = size === "hero" ? "h-[clamp(9.75rem,26vh,14.5rem)] w-[clamp(9.75rem,26vh,14.5rem)]" : "h-full w-full";
  const orbCssVars = {
    "--jimmi-orb-rgb": styles.rgb,
    "--jimmi-orb-core-rgb": styles.coreRgb,
    "--jimmi-orb-edge-rgb": styles.edgeRgb,
  } as CSSProperties;

  return (
    <span
      data-jimmi-orb="realistic-css-particle-sphere"
      data-orb-renderer="framer-motion-lightweight-svg"
      data-orb-state={orbState}
      data-orb-color={styles.colorName}
      data-orb-topic={lastMessageTopic}
      aria-hidden="true"
      style={orbCssVars}
      className={`jimmi-orb-root relative block aspect-square ${sizeClass} overflow-visible rounded-full bg-black`}
    >
      <motion.span animate={{ opacity: orbState === "listening" ? 0.74 : orbState === "thinking" || orbState === "speaking" ? 0.68 : 0.32, scale: orbState === "speaking" ? 1.05 : orbState === "thinking" ? 1.035 : orbState === "listening" ? 1.025 : 1 }} transition={{ duration: 0.16, ease: "easeOut" }} className={`pointer-events-none absolute inset-[8%] rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(var(--jimmi-orb-core-rgb),0.26),rgba(var(--jimmi-orb-rgb),0.15)_29%,rgba(var(--jimmi-orb-edge-rgb),0.06)_55%,rgba(0,0,0,0)_74%)] blur-xl ${styles.aura}`} aria-hidden="true" />
      <motion.span animate={{ opacity: orbState === "listening" ? 0.54 : orbState === "thinking" || orbState === "speaking" ? 0.62 : 0.22, scale: orbState === "speaking" ? 1.08 : orbState === "thinking" ? 1.05 : 1 }} transition={{ duration: 0.16, ease: "easeOut" }} className={`pointer-events-none absolute inset-[16%] rounded-full bg-[rgba(var(--jimmi-orb-rgb),0.12)] blur-2xl ${styles.pulse}`} aria-hidden="true" />

      <svg
        className={`absolute inset-0 h-full w-full transition duration-150 ${styles.sphere}`}
        viewBox="0 0 200 200"
        role="presentation"
        focusable="false"
      >
        <defs>
          <radialGradient id="jimmi-realistic-core" cx="50%" cy="50%" r="57%">
            <stop offset="0%" stopColor={`rgba(${styles.coreRgb},0.28)`} />
            <stop offset="28%" stopColor={`rgba(${styles.rgb},0.13)`} />
            <stop offset="58%" stopColor={`rgba(${styles.edgeRgb},0.034)`} />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <radialGradient id="jimmi-realistic-particle" cx="38%" cy="32%" r="72%">
            <stop offset="0%" stopColor={`rgba(${styles.coreRgb},1)`} />
            <stop offset="42%" stopColor={`rgba(${styles.rgb},0.96)`} />
            <stop offset="100%" stopColor={`rgba(${styles.edgeRgb},0.34)`} />
          </radialGradient>
        </defs>

        <circle cx="100" cy="100" r="86" fill="url(#jimmi-realistic-core)" />
        <motion.g animate={{ rotate: 360 }} transition={{ duration: stateMotionSeconds[orbState], repeat: Infinity, ease: "linear" }} className={styles.particle} style={{ transformOrigin: "100px 100px" }}>
          {dustParticles.map((particle) => renderParticle(particle, `rgba(${styles.dustRgb},0.82)`))}
          {rearParticles.map((particle) => renderParticle(particle))}
        </motion.g>
        <motion.g animate={{ rotate: -360 }} transition={{ duration: topicMotionSeconds[lastMessageTopic], repeat: Infinity, ease: "linear" }} className={styles.particle} style={{ transformOrigin: "100px 100px" }}>
          {coreParticles.map((particle) => renderParticle(particle))}
        </motion.g>
        <motion.g animate={{ rotate: -360 }} transition={{ duration: Math.max(4, stateMotionSeconds[orbState] * 0.72), repeat: Infinity, ease: "linear" }} className={styles.particle} style={{ transformOrigin: "100px 100px" }}>
          {frontParticles.map((particle) => renderParticle(particle))}
        </motion.g>
        <g className={`transition duration-150 ${styles.bloom}`} style={{ filter: "drop-shadow(0 0 3px rgba(var(--jimmi-orb-core-rgb),0.72))" }}>
          {brightParticles.map((particle) => (
            <circle
              key={`bloom-${particle.id}`}
              cx={particle.x}
              cy={particle.y}
              r={Math.max(1.1, particle.r * 0.82)}
              fill={`rgba(${styles.coreRgb},0.98)`}
              opacity={Math.min(0.94, particle.opacity * 0.82)}
            />
          ))}
        </g>
        <motion.circle animate={{ r: orbState === "speaking" ? 58 : orbState === "thinking" ? 56 : 52, opacity: orbState === "idle" ? 0.55 : 0.82 }} transition={{ duration: 0.16, ease: "easeOut" }} cx="100" cy="100" fill={`rgba(${styles.coreRgb},0.052)`} />
      </svg>

      <span className={`pointer-events-none absolute inset-[12%] rounded-full bg-[radial-gradient(circle_at_center,rgba(var(--jimmi-orb-core-rgb),0.12),rgba(var(--jimmi-orb-rgb),0)_59%)] blur-md transition duration-150 ${styles.bloom}`} aria-hidden="true" />
      <span className="pointer-events-none absolute inset-[-5%] rounded-full bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,0,0,0.28)_69%,rgba(0,0,0,0.96)_100%)]" aria-hidden="true" />
    </span>
  );
}
