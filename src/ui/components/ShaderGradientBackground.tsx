import type { JSX } from "preact";
import { useEffect, useRef } from "preact/hooks";
import type { Ore } from "../../domain/grades";

interface RankPalette {
  c1: [number, number, number]; // Base abyss
  c2: [number, number, number]; // Main wave body
  c3: [number, number, number]; // Bright crest
  accent?: [number, number, number]; // Subtle glimmer
  accentWeight: number;
  speed: number;
  turbulence: number;
  intensity: number; // Incremental visual presence: Iron ~5%, Gold ~30%, Emerald ~50%, Diamond ~75%, Netherite 100%
  height: number;
  flickerRate: number; // Fraction of cells eligible for white glint (Netherite: 50% less, Diamond: 75% less, Emerald: 90% less, Gold & rest: 0)
}

function hex(h: string): [number, number, number] {
  const n = parseInt(h.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const PALETTES: Partial<Record<Ore, RankPalette>> = {
  // Coal: 0% visual (disabled, pure dark) - not in PALETTES

  // Iron: ~5% visual (barely visible cold metallic slate breathing)
  iron: {
    c1: hex("#090b0e"),
    c2: hex("#12161f"),
    c3: hex("#1c222d"),
    accent: hex("#293242"),
    accentWeight: 0.0,
    speed: 0.04,
    turbulence: 0.2,
    intensity: 0.05,
    height: 350,
    flickerRate: 0.0, // none
  },

  // Gold: ~30% visual (warm slow embers, subtle bronze current)
  gold: {
    c1: hex("#160d04"),
    c2: hex("#63380b"),
    c3: hex("#b45309"),
    accent: hex("#f59e0b"),
    accentWeight: 0.12,
    speed: 0.09,
    turbulence: 0.45,
    intensity: 0.26,
    height: 410,
    flickerRate: 0.0, // none for gold and rest
  },

  // Emerald: ~50% visual (subterranean forest current)
  emerald: {
    c1: hex("#072013"),
    c2: hex("#106834"),
    c3: hex("#16a34a"),
    accent: hex("#4ade80"),
    accentWeight: 0.18,
    speed: 0.12,
    turbulence: 0.65,
    intensity: 0.44,
    height: 450,
    flickerRate: 0.0045, // reduced by 90%
  },

  // Diamond: ~75% visual (crystalline cyan liquid drift with soft amber hints)
  diamond: {
    c1: hex("#06202e"),
    c2: hex("#0273a8"),
    c3: hex("#0ea5e9"),
    accent: hex("#eab308"), // subtle golden grain hints
    accentWeight: 0.18,
    speed: 0.15,
    turbulence: 0.85,
    intensity: 0.62,
    height: 490,
    flickerRate: 0.0112, // reduced by 75%
  },

  // Netherite: 100% visual (full apex majesty: cosmic void, royal purple, luminous lilac aurora)
  netherite: {
    c1: hex("#140620"),
    c2: hex("#7e22ce"),
    c3: hex("#a855f7"),
    accent: hex("#e9d5ff"),
    accentWeight: 0.32,
    speed: 0.18,
    turbulence: 1.0,
    intensity: 0.82,
    height: 520,
    flickerRate: 0.0225, // reduced by half
  },
};

const VS = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FS = `
precision highp float;
varying vec2 vUv;
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform vec3 uAccent;
uniform float uAccentWeight;
uniform float uSpeed;
uniform float uTurbulence;
uniform float uIntensity;
uniform float uPixelSize;
uniform float uFlickerRate;
uniform float uMode; // 0.0 = pulse, 1.0 = flow, 2.0 = smooth

// 2D Simplex Noise
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// 4x4 Bayer matrix lookup for authentic pixel-art dither dissolve
float bayer4(vec2 p) {
  vec2 b = floor(mod(mod(p, 4.0) + 4.0, 4.0));
  int x = int(b.x);
  int y = int(b.y);
  int idx = y * 4 + x;
  if (idx == 0) return 0.0 / 16.0;
  if (idx == 1) return 8.0 / 16.0;
  if (idx == 2) return 2.0 / 16.0;
  if (idx == 3) return 10.0 / 16.0;
  if (idx == 4) return 12.0 / 16.0;
  if (idx == 5) return 4.0 / 16.0;
  if (idx == 6) return 14.0 / 16.0;
  if (idx == 7) return 6.0 / 16.0;
  if (idx == 8) return 3.0 / 16.0;
  if (idx == 9) return 11.0 / 16.0;
  if (idx == 10) return 1.0 / 16.0;
  if (idx == 11) return 9.0 / 16.0;
  if (idx == 12) return 15.0 / 16.0;
  if (idx == 13) return 7.0 / 16.0;
  if (idx == 14) return 13.0 / 16.0;
  return 5.0 / 16.0;
}

void main() {
  float pSize = uMode < 1.5 ? max(1.0, uPixelSize) : 1.0;
  bool isPixel = uMode < 1.5;

  vec2 coord = gl_FragCoord.xy;

  // Align pixels from the TOP edge so the top row is 100% a full, whole pixel
  float yFromTop = uResolution.y - coord.y;
  float cellY = floor(yFromTop / pSize);

  // Align pixels horizontally around the center so badge is perfectly centered on the pixel grid
  float xFromCenter = coord.x - uResolution.x * 0.5;
  float cellX = floor((xFromCenter + pSize * 0.5) / pSize);

  vec2 cellIndex = vec2(cellX, cellY);

  // Snapped coordinates centered within each cell
  float snappedY = uResolution.y - (cellY + 0.5) * pSize;
  float snappedX = uResolution.x * 0.5 + cellX * pSize;
  vec2 snapped = isPixel ? vec2(snappedX, snappedY) : coord;

  // Center of badge in screen space (adapts between sheet modal and ranked page)
  float centerY = uResolution.y > 350.0 ? (uResolution.y * 0.55) : (uResolution.y - 85.0 * (uResolution.y / 264.0));
  vec2 center = vec2(uResolution.x * 0.5, centerY);

  // Exact original screen coordinates on Ranked screen, isotropic on modal sheet
  vec2 uv = uResolution.y > 350.0 ? ((snapped - center) / (uResolution.y * 0.5)) : ((snapped - center) / 180.0);

  float t = uTime * uSpeed;

  // Organic S-curve meandering river flow of pixels
  vec2 flowUv = uv * vec2(1.25, 0.85);
  flowUv.x += sin(flowUv.y * 2.0 + t * 0.4) * 0.28;

  float stream1 = snoise(flowUv * 1.5 + vec2(t * 0.26, -t * 0.32));
  float stream2 = snoise(flowUv * 2.4 + vec2(stream1 * 0.55, t * 0.2));
  float stream3 = snoise(flowUv * 3.2 + vec2(-t * 0.16, stream2 * 0.45));

  float wave = (stream1 * 0.52 + stream2 * 0.36 + stream3 * 0.22) * uTurbulence;

  // Concentrated behind the hero badge with natural falloff
  float distFromHero = length(uv * vec2(0.8, 1.0));
  float falloff = smoothstep(1.85, 0.2, distFromHero);

  float w1 = smoothstep(-0.35, 0.45, wave) * falloff * uIntensity;
  float w2 = smoothstep(0.08, 0.72, wave) * falloff * uIntensity;

  if (isPixel) {
    w1 = floor(w1 * 8.0 + 0.5) / 8.0;
    w2 = floor(w2 * 8.0 + 0.5) / 8.0;
  }

  vec3 col = mix(uC1, uC2, w1);
  col = mix(col, uC3, w2 * 0.85);

  if (uAccentWeight > 0.0) {
    float w3 = smoothstep(0.25, 0.75, wave) * falloff * uIntensity;
    if (isPixel) w3 = floor(w3 * 5.0 + 0.5) / 5.0;
    col = mix(col, uAccent, w3 * uAccentWeight * 0.8);
  }

  // White pixel flicker (Netherite -50%, Diamond -75%, Emerald -90%, Gold/rest 0; opacity halved to 0.20)
  if (uFlickerRate > 0.0) {
    float cellSeed = fract(sin(dot(cellIndex, vec2(127.1, 311.7))) * 43758.5453);
    float isEligible = step(1.0 - uFlickerRate, cellSeed);
    float twinkleSpeed = 0.35 + 0.45 * fract(cellSeed * 13.0);
    float cellPhase = fract(cellSeed * 5.0 + uTime * twinkleSpeed);
    float flicker = smoothstep(0.91, 0.99, sin(cellPhase * 6.28318)) * isEligible;
    flicker *= step(0.18, falloff * uIntensity);

    // Soft half-opacity sparkle: 0.20 intensity
    col = mix(col, vec3(1.0, 1.0, 1.0), flicker * 0.20);
  }

  if (isPixel) {
    // Subtle pixel texture variation
    float cellHash = fract(sin(dot(cellIndex, vec2(127.1, 311.7))) * 43758.5453);
    col += (cellHash - 0.5) * 0.04 * uIntensity;

    // Crisp 12px pixel grid line definition aligned to top and center
    vec2 intra = vec2(fract((xFromCenter + pSize * 0.5) / pSize), fract(yFromTop / pSize));
    float borderDist = min(min(intra.x, 1.0 - intra.x), min(intra.y, 1.0 - intra.y));
    float gridLine = smoothstep(0.0, 0.12, borderDist);
    col *= (0.76 + 0.24 * gridLine);

    // Subtle contrast pocket behind the badge center so dark badges (Netherite) pop with 100% clarity
    float badgePocket = smoothstep(0.15, 0.8, distFromHero);
    col = mix(uC1 * 0.75, col, 0.6 + 0.4 * badgePocket);

    // Retro Bayer dither dissolve into background:
    // On sheet modal: top is 100% solid full pixels across ALL ranks (no checkerboard blur), dissolves down toward stats
    // On ranked screen: keep exact original formula
    float fade;
    if (uResolution.y <= 350.0) {
      float yNorm = (cellY + 0.5) * pSize / uResolution.y;
      fade = smoothstep(0.95, 0.50, yNorm);
    } else {
      vec2 p = gl_FragCoord.xy / uResolution.xy;
      fade = smoothstep(0.02, 0.65, 1.0 - p.y) * min(0.85, uIntensity * 1.1 + 0.05);
    }
    float dither = bayer4(cellIndex);
    float mask = step(dither, fade);
    gl_FragColor = vec4(col, mask);
  } else {
    vec2 p = gl_FragCoord.xy / uResolution.xy;
    float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    col += (grain - 0.5) * (0.016 + 0.02 * uIntensity);
    float mask = uResolution.y <= 350.0
      ? smoothstep(0.95, 0.35, (cellY + 0.5) * pSize / uResolution.y)
      : (smoothstep(0.0, 0.45, 1.0 - p.y) * min(0.85, uIntensity * 1.1 + 0.05));
    gl_FragColor = vec4(col, mask);
  }
}
`;

export function ShaderGradientBackground({
  ore,
  className,
  style,
  opacity = 1,
  height,
}: {
  ore: Ore;
  className?: string;
  style?: JSX.CSSProperties;
  opacity?: number;
  height?: number;
}) {
  if (import.meta.env.VITEST) return null;

  const pal = PALETTES[ore];
  if (!pal) return null; // No effect for Coal

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const actualH = height ?? (pal.height + 120);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    });
    if (!gl) return;

    const ctx = gl;
    function compile(type: number, src: string) {
      const s = ctx.createShader(type)!;
      ctx.shaderSource(s, src);
      ctx.compileShader(s);
      return s;
    }

    const prog = gl.createProgram()!;
    const vs = compile(gl.VERTEX_SHADER, VS);
    const fs = compile(gl.FRAGMENT_SHADER, FS);
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    // Fullscreen quad buffer
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const aPos = gl.getAttribLocation(prog, "aPosition");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "uResolution");
    const uTime = gl.getUniformLocation(prog, "uTime");
    const uC1 = gl.getUniformLocation(prog, "uC1");
    const uC2 = gl.getUniformLocation(prog, "uC2");
    const uC3 = gl.getUniformLocation(prog, "uC3");
    const uAcc = gl.getUniformLocation(prog, "uAccent");
    const uAccW = gl.getUniformLocation(prog, "uAccentWeight");
    const uSpd = gl.getUniformLocation(prog, "uSpeed");
    const uTurb = gl.getUniformLocation(prog, "uTurbulence");
    const uInt = gl.getUniformLocation(prog, "uIntensity");
    const uPix = gl.getUniformLocation(prog, "uPixelSize");
    const uFlick = gl.getUniformLocation(prog, "uFlickerRate");

    gl.uniform3fv(uC1, pal.c1);
    gl.uniform3fv(uC2, pal.c2);
    gl.uniform3fv(uC3, pal.c3);
    gl.uniform3fv(uAcc, pal.accent ?? [0, 0, 0]);
    gl.uniform1f(uAccW, pal.accentWeight);
    gl.uniform1f(uSpd, pal.speed);
    gl.uniform1f(uTurb, pal.turbulence);
    gl.uniform1f(uInt, pal.intensity);
    gl.uniform1f(uPix, 12.0); // Exact 12px badge pixel size!
    gl.uniform1f(uFlick, pal.flickerRate);

    let animId: number;
    let isPaused = false;
    let isIntersecting = true;
    let startTime = performance.now();
    const isSheet = !!canvas.closest(".sheet");
    const targetH = actualH;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function resize() {
      if (!canvas || !gl) return;
      const w = Math.min(canvas.clientWidth || 360, 540);
      const h = Math.min(canvas.clientHeight || 480, targetH);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    }
    resize();
    window.addEventListener("resize", resize);

    // ResizeObserver ensures canvas updates its buffer as the modal sheet finishes its 200ms slide-up animation
    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas);

    // IntersectionObserver is ONLY for the main scrollable page, NOT for sheets (sheets start at translateY(100%) offscreen which falsely pauses them)
    let observer: IntersectionObserver | null = null;
    if (!isSheet) {
      observer = new IntersectionObserver(([entry]) => {
        isIntersecting = entry.isIntersecting;
        if (!isIntersecting) {
          cancelAnimationFrame(animId);
        } else if (!isPaused && !reducedMotion) {
          animId = requestAnimationFrame(render);
        }
      });
      observer.observe(canvas);
    }

    function onVisibilityChange() {
      if (document.hidden) {
        isPaused = true;
        cancelAnimationFrame(animId);
      } else {
        isPaused = false;
        startTime = performance.now();
        if ((isSheet || isIntersecting) && !reducedMotion) {
          animId = requestAnimationFrame(render);
        }
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    function render(now: number = performance.now()) {
      if (!gl || !canvas || isPaused) return;
      if (!isSheet && !isIntersecting) return;

      const elapsed = (now - startTime) / 1000;
      gl.useProgram(prog);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, reducedMotion ? 0 : elapsed);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      if (!reducedMotion) {
        animId = requestAnimationFrame(render);
      }
    }

    render();
    // Safety frame: ensure resize runs right after sheet animation begins
    requestAnimationFrame(() => {
      resize();
      render();
    });

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      ro.disconnect();
      if (observer) observer.disconnect();
      // Instantly hide canvas before WebGL teardown to eliminate any 1-frame compositor white flash
      if (canvas) {
        canvas.style.opacity = "0";
        canvas.style.visibility = "hidden";
      }
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      // Free WebGL context immediately to prevent exhausting context limits across screen transitions
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [ore, pal, actualH]);

  return (
    <div
      class={`shader-gradient-wrapper ${className ?? ""}`.trim()}
      aria-hidden="true"
      style={{
        height: `${actualH}px`,
        opacity,
        ...style,
      }}
    >
      <canvas ref={canvasRef} class="shader-gradient-canvas" />
    </div>
  );
}
