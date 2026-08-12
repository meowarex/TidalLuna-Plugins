// MARKER: Kawarp Backdrop
//   cover art URL -> fetch -> ImageBitmap -> kawarp -> animated backdrop <3

// Imported @ 1.2.0
import { Kawarp, type KawarpOptions } from "@kawarp/core";
import { settings } from "./Settings";

/** kawarp wants real units none if this fake luna slop (love you @inrixia <3) */
const getLiveOptions = (): KawarpOptions => {
	const options: KawarpOptions = {
		warpIntensity: settings.backdropWarp / 100,
		blurPasses: settings.backdropBlurPasses,
		animationSpeed: settings.backdropSpeed / 100,
		saturation: settings.backdropSaturation / 100,
		dithering: settings.backdropDithering / 1000,
		scale: settings.backdropScale / 100,
	};
	if (!settings.performanceMode) return options;
	// Super WIP (probs also barely helps atleast rn)
	return {
		...options,
		blurPasses: Math.min(options.blurPasses ?? 8, 4),
		dithering: 0,
	};
};

const getDpr = (): number =>
	settings.performanceMode ? 1 : Math.min(window.devicePixelRatio || 1, 2);

// Claude did all the auto darken stuff cause i'm not bothered to make this stuff a second time.. (so ignore comment bloat)

// Auto-darken samples the album art at this size to judge how bright it is.
// 16x16 is 256 pixels and the GPU does the downscale.
const SAMPLE_SIZE = 16;
// Never crush the backdrop to black, however blinding the cover art is
const MIN_BRIGHTNESS = 0.15;
// Darken strength maps onto a luminance ceiling: how bright the backdrop is
// allowed to read before it gets pulled down. Strength 1 barely touches
// anything, 100 keeps even white covers well below the lyrics.
const CEILING_AT_MIN_STRENGTH = 0.9;
const CEILING_AT_MAX_STRENGTH = 0.15;
// Seconds to coast between full speed and a standstill. Linear, so the
// deceleration is constant rather than dropping off a cliff and then crawling.
const RAMP_SECONDS = 1.8;
// kawarp's album-art crossfade defaults to 1000ms - keep rendering a little
// past that so a track change still resolves while playback is paused
const CROSSFADE_RENDER_MS = 1400;

/**
 * Mean Rec. 709 luma of an image, 0-1.
 *
 * Measured on the source art rather than the rendered canvas. The shader output
 * is in constant motion, so sampling it gives a brightness that drifts with the
 * animation; the cover art is fixed, so one reading per track is exact and
 * stays put. A blur preserves mean luminance, so this is also a faithful
 * predictor of how bright the finished backdrop lands.
 */
let sampleCtx: CanvasRenderingContext2D | null = null;
const measureLuminance = (source: CanvasImageSource): number | null => {
	if (!sampleCtx) {
		const sampler = document.createElement("canvas");
		sampler.width = SAMPLE_SIZE;
		sampler.height = SAMPLE_SIZE;
		sampleCtx = sampler.getContext("2d", { willReadFrequently: true });
	}
	if (!sampleCtx) return null;
	try {
		sampleCtx.clearRect(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
		sampleCtx.drawImage(source, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
		const { data } = sampleCtx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
		let sum = 0;
		for (let i = 0; i < data.length; i += 4) {
			// Green dominates how bright a colour reads to the eye
			sum +=
				(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
		}
		return sum / (data.length / 4);
	} catch {
		return null;
	}
};

export class KawarpLayer {
	private host: HTMLElement;
	private canvas: HTMLCanvasElement;
	private kawarp: Kawarp | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private currentSrc: string | null = null;
	private loadToken = 0;
	private appliedOptions = "";
	private running = false;
	private failed = false;
	// Luminance of the current cover art - measured once when it loads
	private coverLuminance: number | null = null;
	private brightness = 1;
	private playing = true;
	private rafId: number | null = null;
	private shaderTime = 0;
	private lastFrame = 0;
	// Current speed multiplier, eased between 0 and 1
	private speedFactor = 1;
	private transitionUntil = 0;

	constructor(host: HTMLElement, id: string, zIndex: string) {
		this.host = host;
		this.canvas = document.createElement("canvas");
		// Same id shape BetterLyrics uses, so its own detection selector matches
		this.canvas.id = `better-lyrics-kawarp-${id}`;
		this.canvas.className = "rl-kawarp-canvas";
		this.canvas.style.zIndex = zIndex;
		host.appendChild(this.canvas);

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

	private onContextLost = (event: Event): void => {
		// Preventing default is what allows a restore to be delivered
		event.preventDefault();
		this.running = false;
		this.kawarp = null;
		this.appliedOptions = "";
	};

	private onContextRestored = (): void => {
		this.kawarp = null;
		this.appliedOptions = "";
		this.failed = false;
		const src = this.currentSrc;
		this.currentSrc = null;
		this.apply(src);
	};

	private ensureEngine(): Kawarp | null {
		if (this.kawarp || this.failed) return this.kawarp;
		try {
			this.syncSize();
			this.kawarp = new Kawarp(this.canvas, getLiveOptions());
			this.appliedOptions = JSON.stringify(getLiveOptions());
		} catch (_err) {
			// No WebGL/context refused
			this.failed = true;
			this.kawarp = null;
		}
		return this.kawarp;
	}

	private syncSize(): void {
		const dpr = getDpr();
		const rect = this.host.getBoundingClientRect();
		const width = Math.max(1, Math.round(rect.width * dpr));
		const height = Math.max(1, Math.round(rect.height * dpr));
		if (this.canvas.width === width && this.canvas.height === height) return;
		this.canvas.width = width;
		this.canvas.height = height;
		this.kawarp?.resize();
	}

	/** False once Tidal has rebuilt the container */
	isMountedIn(container: HTMLElement): boolean {
		return this.canvas.parentElement === container;
	}

	/**
	 * Whether this canvas is actually on screen.
	 */
	isVisible(): boolean {
		if (!this.canvas.isConnected) return false;
		if (typeof this.canvas.checkVisibility === "function") {
			return this.canvas.checkVisibility({ checkVisibilityCSS: true });
		}
		return getComputedStyle(this.canvas).visibility !== "hidden";
	}

	/** Push current settings + cover art into engine. */
	apply(src: string | null): boolean {
		const engine = this.ensureEngine();
		if (!engine) return false;

		const options = getLiveOptions();
		const serialized = JSON.stringify(options);
		if (serialized !== this.appliedOptions) {
			engine.setOptions(options);
			this.appliedOptions = serialized;
		}

		const opacity = String(settings.backdropOpacity / 100);
		if (this.canvas.style.opacity !== opacity)
			this.canvas.style.opacity = opacity;

		this.updateBrightness();
		this.applyFilter();

		this.syncSize();

		if (src && src !== this.currentSrc) {
			this.currentSrc = src;
			void this.loadCover(engine, src);
		}
		return true;
	}

	/**
	 * Tidal's CDN sends no Access-Control-Allow-Origin (Drove me insane so using Fetch instead of kawarp)
	 */
	private async loadCover(engine: Kawarp, src: string): Promise<void> {
		const token = ++this.loadToken;
		try {
			const res = await fetch(src);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const blob = await res.blob();
			// A newer track won the race
			if (token !== this.loadToken || this.kawarp !== engine) return;
			// Decode once
			const bitmap = await createImageBitmap(blob);
			if (token !== this.loadToken || this.kawarp !== engine) {
				bitmap.close();
				return;
			}
			try {
				this.coverLuminance = measureLuminance(bitmap);
				engine.loadImageElement(bitmap);
				this.transitionUntil =
					performance.now() + CROSSFADE_RENDER_MS;
				this.ensureLoop();
			} finally {
				bitmap.close();
			}
			this.updateBrightness();
		} catch {
			try {
				if (token !== this.loadToken || this.kawarp !== engine) return;
				// Fallback for data:/blob: sources & i guess CORS
				this.coverLuminance = null;
				await engine.loadImage(src);
				this.updateBrightness();
			} catch {
				// Keep previous frame & later retry
				if (token === this.loadToken) this.currentSrc = null;
			}
		}
	}

	/** Contrast & auto-darken use canvas itself so for once no need for a million elements <3 */
	private applyFilter(): void {
		const parts: string[] = [];
		if (settings.backdropContrast !== 100) {
			// kawarp has no contrast uniform soo CSS time <3 (@aya would be proud)
			parts.push(`contrast(${settings.backdropContrast}%)`);
		}
		if (this.brightness < 0.999) {
			parts.push(`brightness(${this.brightness.toFixed(3)})`);
		}
		const filter = parts.join(" ");
		if (this.canvas.style.filter !== filter) this.canvas.style.filter = filter;
	}

	/**
	 * Decide the flat darkening for the current cover. (Luminance + Settings Value)
	 */
	private updateBrightness(): void {
		let brightness = 1;
		const strength = settings.backdropDarken;
		if (strength > 0 && this.coverLuminance !== null) {
			// container behind canvas is black so opacity scales brightness (cheap shortcut)
			const effective = this.coverLuminance * (settings.backdropOpacity / 100);
			const ceiling =
				CEILING_AT_MIN_STRENGTH -
				(strength / 100) * (CEILING_AT_MIN_STRENGTH - CEILING_AT_MAX_STRENGTH);
			if (effective > ceiling && effective > 0) {
				brightness = Math.max(ceiling / effective, MIN_BRIGHTNESS);
			}
		}
		if (brightness === this.brightness) return;
		this.brightness = brightness;
		this.applyFilter();
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

	/**
	 * render loop (replacing kawarp.start RIP)
	 */
	private tick = (): void => {
		this.rafId = null;
		if (!this.kawarp || !this.running) return;

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

		this.shaderTime += dt * (settings.backdropSpeed / 100) * this.speedFactor;
		this.kawarp.renderFrame(this.shaderTime);

		// Keep rendering while a track's crossfade is still resolving (NOT audio crossfade btw [it's the fading of cover arts])
		if (this.speedFactor === 0 && target === 0 && now >= this.transitionUntil) {
			return;
		}
		this.rafId = requestAnimationFrame(this.tick);
	};

	private ensureLoop(): void {
		if (this.rafId !== null || !this.running || !this.kawarp) return;
		this.lastFrame = performance.now();
		this.rafId = requestAnimationFrame(this.tick);
	}

	start(): void {
		if (this.running || !this.kawarp) return;
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
		this.kawarp?.dispose();
		this.kawarp = null;
		this.canvas.remove();
		this.currentSrc = null;
		this.appliedOptions = "";
	}
}
