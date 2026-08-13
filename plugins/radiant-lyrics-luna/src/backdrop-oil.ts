// MARKER: Oil Backdrop
//   cover art -> palette -> procedural oil waves <3
//
// The shader below is ported verbatim from Terax's website:
//   https://github.com/crynta/Terax-website - components/line-waves.tsx
//   Copyright Crynta, Apache-2.0
//
// Fully procedural, art only feeds the colours.

import { Mesh, Program, Renderer, Triangle } from "ogl";
import { type Rgb, samplePalette } from "./backdrop";
import { settings } from "./Settings";

const getDpr = (): number =>
	settings.performanceMode ? 1 : Math.min(window.devicePixelRatio || 1, 2);

// Same coast as kawarp
const RAMP_SECONDS = 1.8;
// Values below are what terax.app actually renders with
// (background-waves.tsx, not the component defaults)
const REFERENCE_WAVE_SPEED = 0.35;
const REFERENCE_WARP = 0.3;
// Slider defaults land on the reference
const REFERENCE_SPEED_AT_SETTING = 175;
const REFERENCE_WARP_AT_SETTING = 100;
// Brightness is its own setting (theirs assumes full opacity)
// Shimmer has its own clock (sharing dragged the whole pattern)
const DRIFT_SPEED_AT_SETTING = 100;
// Glide, don't snap
const POINTER_LERP = 0.04;

// Palette crossfade rate
const COLOUR_LERP = 0.05;
// Site's values for the rest
const INNER_LINES = 40;
const OUTER_LINES = 15;
const ROTATION_DEG = -38;
const EDGE_FADE_WIDTH = 0;
// Site turns this off
const COLOUR_CYCLE_SPEED = 0;
const DRIFT_INFLUENCE = 1.6;

const vertexShader = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0, 1);
}
`;

const fragmentShader = `
precision highp float;

uniform float uTime;
uniform vec3 uResolution;
uniform float uSpeed;
uniform float uInnerLines;
uniform float uOuterLines;
uniform float uWarpIntensity;
uniform float uRotation;
uniform float uEdgeFadeWidth;
uniform float uColorCycleSpeed;
uniform float uBrightness;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uMouse;
uniform float uMouseInfluence;
uniform bool uEnableMouse;

#define HALF_PI 1.5707963

float hashF(float n) {
  return fract(sin(n * 127.1) * 43758.5453123);
}

float smoothNoise(float x) {
  float i = floor(x);
  float f = fract(x);
  float u = f * f * (3.0 - 2.0 * f);
  return mix(hashF(i), hashF(i + 1.0), u);
}

float displaceA(float coord, float t) {
  float result = sin(coord * 2.123) * 0.2;
  result += sin(coord * 3.234 + t * 4.345) * 0.1;
  result += sin(coord * 0.589 + t * 0.934) * 0.5;
  return result;
}

float displaceB(float coord, float t) {
  float result = sin(coord * 1.345) * 0.3;
  result += sin(coord * 2.734 + t * 3.345) * 0.2;
  result += sin(coord * 0.189 + t * 0.934) * 0.3;
  return result;
}

vec2 rotate2D(vec2 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

void main() {
  vec2 coords = gl_FragCoord.xy / uResolution.xy;
  coords = coords * 2.0 - 1.0;
  coords = rotate2D(coords, uRotation);

  float halfT = uTime * uSpeed * 0.5;
  float fullT = uTime * uSpeed;

  float mouseWarp = 0.0;
  if (uEnableMouse) {
    vec2 mPos = rotate2D(uMouse * 2.0 - 1.0, uRotation);
    float mDist = length(coords - mPos);
    mouseWarp = uMouseInfluence * exp(-mDist * mDist * 4.0);
  }

  float warpAx = coords.x + displaceA(coords.y, halfT) * uWarpIntensity + mouseWarp;
  float warpAy = coords.y - displaceA(coords.x * cos(fullT) * 1.235, halfT) * uWarpIntensity;
  float warpBx = coords.x + displaceB(coords.y, halfT) * uWarpIntensity + mouseWarp;
  float warpBy = coords.y - displaceB(coords.x * sin(fullT) * 1.235, halfT) * uWarpIntensity;

  vec2 fieldA = vec2(warpAx, warpAy);
  vec2 fieldB = vec2(warpBx, warpBy);
  vec2 blended = mix(fieldA, fieldB, mix(fieldA, fieldB, 0.5));

  float fadeTop = smoothstep(uEdgeFadeWidth, uEdgeFadeWidth + 0.4, blended.y);
  float fadeBottom = smoothstep(-uEdgeFadeWidth, -(uEdgeFadeWidth + 0.4), blended.y);
  float vMask = 1.0 - max(fadeTop, fadeBottom);

  float tileCount = mix(uOuterLines, uInnerLines, vMask);
  float scaledY = blended.y * tileCount;
  float nY = smoothNoise(abs(scaledY));

  float ridge = pow(
    step(abs(nY - blended.x) * 2.0, HALF_PI) * cos(2.0 * (nY - blended.x)),
    5.0
  );

  float lines = 0.0;
  for (float i = 1.0; i < 3.0; i += 1.0) {
    lines += pow(max(fract(scaledY), fract(-scaledY)), i * 2.0);
  }

  float pattern = vMask * lines;

  float cycleT = fullT * uColorCycleSpeed;
  float lum = (pattern + lines * ridge) * (cos(blended.y + cycleT * 0.5) * 0.5 + 1.0);

  vec3 baseColor = (uColor1 + uColor2 + uColor3) / 3.0;
  vec3 col = lum * baseColor * uBrightness;
  float alpha = clamp(length(col), 0.0, 1.0);

  gl_FragColor = vec4(col, alpha);
}
`;

/** Drifting warp point (odd periods so it barely repeats) */
const driftPoint = (t: number): [number, number] => [
	0.5 + 0.35 * Math.sin(t * 0.7) * Math.cos(t * 0.31),
	0.5 + 0.35 * Math.cos(t * 0.53) * Math.sin(t * 0.23),
];

export class OilLayer {
	private host: HTMLElement;
	private canvas: HTMLCanvasElement;
	private renderer: Renderer | null = null;
	private program: Program | null = null;
	private mesh: Mesh | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private currentSrc: string | null = null;
	private loadToken = 0;
	private running = false;
	private failed = false;
	private playing = true;
	private rafId: number | null = null;
	private shaderTime = 0;
	private driftTime = 0;
	private lastFrame = 0;
	// Smoothed position + raw target
	private pointer: [number, number] = [0.5, 0.5];
	private cursorTarget: [number, number] = [0.5, 0.5];
	private cursorBound = false;
	// Eased 0-1
	private speedFactor = 1;
	private targetColours: [Rgb, Rgb, Rgb] = [
		[1, 1, 1],
		[1, 1, 1],
		[1, 1, 1],
	];

	constructor(host: HTMLElement, id: string, zIndex: string) {
		this.host = host;
		this.canvas = document.createElement("canvas");
		this.canvas.id = `rl-oil-${id}`;
		// kawarp's class, CSS already positions it
		this.canvas.className = "rl-kawarp-canvas";
		this.canvas.style.zIndex = zIndex;

		this.canvas.addEventListener(
			"webglcontextlost",
			this.onContextLost as EventListener,
			false,
		);
		this.canvas.addEventListener(
			"webglcontextrestored",
			this.onContextRestored as EventListener,
			false,
		);

		if (typeof ResizeObserver !== "undefined") {
			this.resizeObserver = new ResizeObserver(() => {
				this.syncSize();
			});
			this.resizeObserver.observe(host);
		}
	}

	private onCursorMove = (event: MouseEvent): void => {
		const r = this.canvas.getBoundingClientRect();
		if (!r.width || !r.height) return;
		this.cursorTarget = [
			(event.clientX - r.left) / r.width,
			// Shader is y-up
			1 - (event.clientY - r.top) / r.height,
		];
	};

	private bindCursor(want: boolean): void {
		if (want === this.cursorBound) return;
		this.cursorBound = want;
		// On window so it tracks behind content
		if (want) window.addEventListener("mousemove", this.onCursorMove);
		else window.removeEventListener("mousemove", this.onCursorMove);
	}

	private onContextLost = (event: Event): void => {
		// Needed or no restore fires
		event.preventDefault();
		this.running = false;
		this.renderer = null;
		this.program = null;
		this.mesh = null;
	};

	private onContextRestored = (): void => {
		this.renderer = null;
		this.program = null;
		this.mesh = null;
		this.failed = false;
		const src = this.currentSrc;
		this.currentSrc = null;
		this.apply(src);
	};

	private ensureEngine(): Program | null {
		if (this.program || this.failed) return this.program;
		try {
			// Hand ogl our canvas (keeps CSS + cleanup the same)
			const renderer = new Renderer({
				canvas: this.canvas,
				alpha: true,
				premultipliedAlpha: false,
			});
			const gl = renderer.gl;
			gl.clearColor(0, 0, 0, 0);

			const program = new Program(gl, {
				vertex: vertexShader,
				fragment: fragmentShader,
				uniforms: {
					uTime: { value: 0 },
					uResolution: { value: [1, 1, 1] },
					uSpeed: { value: 1 },
					uInnerLines: { value: INNER_LINES },
					uOuterLines: { value: OUTER_LINES },
					uWarpIntensity: { value: 1 },
					uRotation: { value: (ROTATION_DEG * Math.PI) / 180 },
					uEdgeFadeWidth: { value: EDGE_FADE_WIDTH },
					uColorCycleSpeed: { value: COLOUR_CYCLE_SPEED },
					uBrightness: { value: 0.2 },
					uColor1: { value: [1, 1, 1] },
					uColor2: { value: [1, 1, 1] },
					uColor3: { value: [1, 1, 1] },
					uMouse: { value: new Float32Array([0.5, 0.5]) },
					uMouseInfluence: { value: DRIFT_INFLUENCE },
					// On, we just drive it ourselves
					uEnableMouse: { value: true },
				},
			});

			this.renderer = renderer;
			this.program = program;
			this.mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
			this.host.appendChild(this.canvas);
			this.syncSize();
		} catch (_err) {
			// No WebGL/context refused
			this.failed = true;
			this.renderer = null;
			this.program = null;
		}
		return this.program;
	}

	private syncSize(): void {
		if (!this.renderer || !this.program) return;
		const dpr = getDpr();
		const rect = this.host.getBoundingClientRect();
		const width = Math.max(1, Math.round(rect.width));
		const height = Math.max(1, Math.round(rect.height));
		this.renderer.dpr = dpr;
		this.renderer.setSize(width, height);
		const gl = this.renderer.gl;
		this.program.uniforms.uResolution.value = [
			gl.canvas.width,
			gl.canvas.height,
			gl.canvas.width / gl.canvas.height,
		];
	}

	/** False once Tidal has rebuilt the container */
	isMountedIn(container: HTMLElement): boolean {
		return this.canvas.parentElement === container;
	}

	isVisible(): boolean {
		if (!this.canvas.isConnected) return false;
		if (typeof this.canvas.checkVisibility === "function") {
			return this.canvas.checkVisibility({ checkVisibilityCSS: true });
		}
		return getComputedStyle(this.canvas).visibility !== "hidden";
	}

	/** Push current settings + cover art into the shader. */
	apply(src: string | null): boolean {
		const program = this.ensureEngine();
		if (!program) return false;

		const opacity = String(settings.backdropOilOpacity / 100);
		if (this.canvas.style.opacity !== opacity)
			this.canvas.style.opacity = opacity;

		program.uniforms.uWarpIntensity.value =
			REFERENCE_WARP * (settings.backdropOilWarp / REFERENCE_WARP_AT_SETTING);
		program.uniforms.uSpeed.value =
			REFERENCE_WAVE_SPEED *
			(settings.backdropOilSpeed / REFERENCE_SPEED_AT_SETTING);
		// Own dial, no art here to wash out lyrics
		program.uniforms.uBrightness.value = settings.backdropOilBrightness / 100;

		this.bindCursor(settings.backdropOilFollowCursor);

		// No uniforms for these, so ride the canvas
		const grade: string[] = [];
		if (settings.backdropOilContrast !== 100)
			grade.push(`contrast(${settings.backdropOilContrast}%)`);
		if (settings.backdropOilSaturation !== 100)
			grade.push(`saturate(${settings.backdropOilSaturation}%)`);
		const filter = grade.join(" ");
		if (this.canvas.style.filter !== filter) this.canvas.style.filter = filter;

		this.syncSize();

		if (src && src !== this.currentSrc) {
			this.currentSrc = src;
			void this.loadPalette(src);
		}
		return true;
	}

	/** Tidal sends no CORS headers, so fetch + decode ourselves */
	private async loadPalette(src: string): Promise<void> {
		const token = ++this.loadToken;
		try {
			const res = await fetch(src);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const blob = await res.blob();
			if (token !== this.loadToken) return;
			const bitmap = await createImageBitmap(blob);
			try {
				if (token !== this.loadToken) return;
				this.targetColours = samplePalette(bitmap);
				this.ensureLoop();
			} finally {
				bitmap.close();
			}
		} catch {
			// Keep the old palette, retry later
			if (token === this.loadToken) this.currentSrc = null;
		}
	}

	/** Track play/pause (ramp render loop) */
	setPlaying(playing: boolean): void {
		if (this.playing === playing) return;
		this.playing = playing;
		this.ensureLoop();
	}

	/** Where the speed multiplier is heading (1 = playing 0 = paused) */
	private get targetFactor(): number {
		if (!settings.backdropPlaybackReactive) return 1;
		return this.playing ? 1 : 0;
	}

	private tick = (): void => {
		this.rafId = null;
		const program = this.program;
		const renderer = this.renderer;
		const mesh = this.mesh;
		if (!program || !renderer || !mesh || !this.running) return;

		const now = performance.now();
		// freeze so backgrounded tab doesn't jump shader
		const dt = Math.min((now - this.lastFrame) / 1000, 0.1);
		this.lastFrame = now;

		const target = this.targetFactor;
		const step = dt / RAMP_SECONDS;
		if (this.speedFactor < target) {
			this.speedFactor = Math.min(target, this.speedFactor + step);
		} else if (this.speedFactor > target) {
			this.speedFactor = Math.max(target, this.speedFactor - step);
		}

		// Own clock in real seconds, speed lives in uSpeed
		this.shaderTime += dt * this.speedFactor;
		program.uniforms.uTime.value = this.shaderTime;

		// Not the speed ramp's target
		let shimmer: [number, number];
		if (settings.backdropOilFollowCursor) {
			shimmer = this.cursorTarget;
		} else {
			this.driftTime +=
				dt *
				(settings.backdropOilShimmerSpeed / DRIFT_SPEED_AT_SETTING) *
				this.speedFactor;
			shimmer = driftPoint(this.driftTime);
		}
		// Glide when the source changes
		this.pointer[0] += (shimmer[0] - this.pointer[0]) * POINTER_LERP;
		this.pointer[1] += (shimmer[1] - this.pointer[1]) * POINTER_LERP;
		program.uniforms.uMouse.value[0] = this.pointer[0];
		program.uniforms.uMouse.value[1] = this.pointer[1];

		// Ease into a new track's palette rather than cutting
		for (const [i, key] of (["uColor1", "uColor2", "uColor3"] as const).entries()) {
			const current = program.uniforms[key].value as number[];
			const wanted = this.targetColours[i];
			for (let c = 0; c < 3; c++) {
				current[c] += (wanted[c] - current[c]) * COLOUR_LERP;
			}
		}

		renderer.render({ scene: mesh });

		// Stopped, park the loop
		if (this.speedFactor === 0 && target === 0) return;
		this.rafId = requestAnimationFrame(this.tick);
	};

	private ensureLoop(): void {
		if (this.rafId !== null || !this.running || !this.program) return;
		this.lastFrame = performance.now();
		this.rafId = requestAnimationFrame(this.tick);
	}

	start(): void {
		if (this.running || !this.program) return;
		this.running = true;
		this.ensureLoop();
	}

	stop(): void {
		if (!this.running) return;
		this.running = false;
		if (this.rafId !== null) {
			cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}
	}

	setPaused(paused: boolean): void {
		if (paused) this.stop();
		else this.start();
	}

	dispose(): void {
		this.stop();
		this.bindCursor(false);
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		this.canvas.removeEventListener(
			"webglcontextlost",
			this.onContextLost as EventListener,
		);
		this.canvas.removeEventListener(
			"webglcontextrestored",
			this.onContextRestored as EventListener,
		);
		// ogl has no disposer
		this.renderer?.gl.getExtension("WEBGL_lose_context")?.loseContext();
		this.renderer = null;
		this.program = null;
		this.mesh = null;
		this.canvas.remove();
		this.currentSrc = null;
	}
}
