/*
 * JIMMI Orb design philosophy: Monastic Tech Minimalism revised from reference, d378fb02 frameless float revision.
 * The orb should read as a realistic structured emissive particle globe: UV-sphere dot rows, organic valleys, soft silhouette, and restrained functional color without a visible circular frame.
 */

export const particleVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uIntensity;
  uniform float uPulse;
  uniform float uTurbulence;
  uniform float uWave;
  uniform float uPressed;
  uniform float uReducedMotion;
  uniform float uPointScale;
  uniform vec2 uTouchPoint;
  uniform float uTouchStrength;

  attribute float aSeed;
  attribute float aLayer;
  attribute float aSize;

  varying float vAlpha;
  varying float vBrightness;
  varying float vAccent;
  varying float vEdge;
  varying float vSeed;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.13));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);

    return mix(
      mix(
        mix(hash(i + vec3(0.0, 0.0, 0.0)), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x),
        f.y
      ),
      mix(
        mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x),
        f.y
      ),
      f.z
    );
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.54;
    for (int i = 0; i < 4; i++) {
      value += noise(p) * amplitude;
      p = p * 2.03 + vec3(6.7, 3.1, 4.3);
      amplitude *= 0.48;
    }
    return value;
  }

  mat3 rotateY(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
  }

  mat3 rotateX(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c);
  }

  void main() {
    float slow = mix(1.0, 0.24, uReducedMotion);
    float t = uTime * slow;
    vec3 baseNormal = normalize(position);
    vec3 p = position;

    float latitude = atan(baseNormal.y, length(baseNormal.xz));
    float longitude = atan(baseNormal.z, baseNormal.x);
    vec3 flow = baseNormal * 2.15 + vec3(t * 0.15, -t * 0.11, t * 0.19);

    float largeField = fbm(flow);
    float secondField = fbm(baseNormal * 4.7 + vec3(-t * 0.19, t * 0.13, t * 0.07));
    float ridge = 1.0 - abs(largeField * 2.0 - 1.0);
    ridge = pow(clamp(ridge, 0.0, 1.0), 1.85);

    float rowMicroMotion = sin(longitude * 9.0 + latitude * 4.0 + t * 0.75 + aSeed * 6.2831) * 0.012;
    float speechWave = sin((longitude * 5.5) + (latitude * 9.0) - t * 5.4 + aSeed * 2.4) * uWave * 0.08;
    float listenPulse = sin(t * 4.2 + aLayer * 6.2831) * uPulse * 0.04;
    float pressCompression = 0.0;
    vec2 projectedTouch = baseNormal.xy;
    float touchDistance = length(projectedTouch - uTouchPoint);
    float frontFacingTouch = smoothstep(-0.08, 0.74, baseNormal.z);
    float touchInfluence = smoothstep(0.58, 0.04, touchDistance) * frontFacingTouch * uTouchStrength;
    float touchRipple = sin(touchDistance * 28.0 - t * 10.6 + aSeed * 2.8) * touchInfluence * 0.038;
    float touchCompression = -touchInfluence * 0.095;

    float displacement = (largeField - 0.5) * (0.18 + uTurbulence * 0.38);
    displacement += (secondField - 0.5) * (0.045 + uTurbulence * 0.06);
    displacement += ridge * uTurbulence * 0.13;
    displacement += rowMicroMotion + speechWave + listenPulse + pressCompression + touchRipple + touchCompression;

    p += baseNormal * displacement;
    p = rotateY(t * 0.055) * rotateX(sin(t * 0.13) * 0.035) * p;

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    vec3 viewNormal = normalize(normalMatrix * baseNormal);
    float facing = clamp(dot(viewNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0);
    float edge = pow(1.0 - facing, 1.25);
    float frontDepth = smoothstep(-0.92, 0.78, p.z);
    float valley = smoothstep(0.24, 0.82, largeField);
    float peak = smoothstep(0.48, 0.96, ridge + secondField * 0.45);

    float particleBrightness = clamp(0.18 + valley * 0.78 + peak * 0.56 + edge * 0.46, 0.0, 1.55);
    float valleyOpacity = smoothstep(0.14, 0.62, largeField + ridge * 0.28);
    float visibilityFloor = 0.18 + edge * 0.18;
    vAlpha = clamp((visibilityFloor + valleyOpacity * 0.82 + peak * 0.12) * (0.38 + frontDepth * 0.72) * uIntensity, 0.0, 1.0);
    vBrightness = particleBrightness;
    vAccent = clamp(abs(speechWave) * 5.5 + uPulse * 0.3 + peak * 0.24 + touchInfluence * 0.42, 0.0, 1.0);
    vEdge = edge;
    vSeed = aSeed;

    float perspective = 4.9 / max(1.38, -mvPosition.z);
    float sizeByLight = mix(0.78, 1.58, clamp(particleBrightness + touchInfluence * 0.32, 0.0, 1.0));
    gl_PointSize = clamp(aSize * uPointScale * uPixelRatio * perspective * sizeByLight, 1.15, 6.8);
  }
`;

export const particleFragmentShader = /* glsl */ `
  precision highp float;

  uniform vec3 uBaseColor;
  uniform vec3 uAccentColor;
  uniform float uAccentMix;
  uniform float uPressed;

  varying float vAlpha;
  varying float vBrightness;
  varying float vAccent;
  varying float vEdge;
  varying float vSeed;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv);
    if (d > 0.5) discard;

    float core = smoothstep(0.5, 0.04, d);
    float bead = pow(max(1.0 - d * 2.0, 0.0), 1.55);
    float pinLight = pow(max(1.0 - d * 2.0, 0.0), 6.0);
    float accent = clamp(uAccentMix * (0.34 + vAccent * 0.82 + vEdge * 0.22), 0.0, 0.86);

    vec3 color = mix(uBaseColor, uAccentColor, accent);
    color *= 0.72 + vBrightness * 1.05;
    color += mix(vec3(pinLight * 0.34), uAccentColor * pinLight * 0.36, accent * 0.74);

    float alpha = core * vAlpha * (0.34 + bead * 0.82 + pinLight * 0.22);
    gl_FragColor = vec4(color, alpha);
  }
`;

export const rimVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const rimFragmentShader = /* glsl */ `
  precision highp float;

  uniform vec3 uAccentColor;
  uniform float uIntensity;
  uniform float uAccentMix;
  uniform float uPressed;

  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vec3 viewDir = normalize(vViewPosition);
    float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 4.8);
    vec3 mono = vec3(0.88, 0.84, 0.76);
    vec3 color = mix(mono, uAccentColor, clamp(uAccentMix * 0.38, 0.0, 0.48));
    float alpha = fresnel * (0.018 + uIntensity * 0.038);
    gl_FragColor = vec4(color, alpha);
  }
`;

export const haloVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const haloFragmentShader = /* glsl */ `
  precision highp float;

  uniform vec3 uAccentColor;
  uniform float uHalo;
  uniform float uAccentMix;
  uniform float uPressed;

  varying vec2 vUv;

  void main() {
    vec2 p = vUv - vec2(0.5);
    p.x *= 1.02;
    float d = length(p);
    float halo = smoothstep(0.78, 0.0, d);
    float center = smoothstep(0.24, 0.0, d) * 0.16;
    vec3 mono = vec3(0.72, 0.68, 0.6);
    vec3 color = mix(mono, uAccentColor, clamp(uAccentMix * 0.44, 0.0, 0.56));
    float alpha = (halo * 0.026 + center * 0.018) * uHalo;
    gl_FragColor = vec4(color, alpha);
  }
`;
