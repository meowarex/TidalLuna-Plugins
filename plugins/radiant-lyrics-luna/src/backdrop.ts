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

// Sample size for auto-darken (GPU does the downscale)
const SAMPLE_SIZE = 16;
// Never go fully black
const MIN_BRIGHTNESS = 0.15;
// Darken strength -> luminance ceiling
const CEILING_AT_MIN_STRENGTH = 0.9;
const CEILING_AT_MAX_STRENGTH = 0.15;
// Seconds to coast to a stop (linear)
const RAMP_SECONDS = 1.8;
// Render past the cover crossfade (1000ms)
const CROSSFADE_RENDER_MS = 1400;

/** Mean luma of the art (measure source, not the moving canvas) */
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
			// Green reads brightest
			sum +=
				(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
		}
		return sum / (data.length / 4);
	} catch {
		return null;
	}
};


// Load a cover as an <img>. Works on for Lunar (Fetch didn't work..)

const loadCoverElement = async (src: string): Promise<HTMLImageElement> => {
	const attempt = (anonymous: boolean) =>
		new Promise<HTMLImageElement>((resolve, reject) => {
			const img = new Image();
			if (anonymous) img.crossOrigin = "anonymous";
			img.onload = () => resolve(img);
			img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
			img.src = src;
		});
	try {
		return await attempt(true);
	} catch {
		return await attempt(false);
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
	// Measured once per cover
	private coverLuminance: number | null = null;
	private brightness = 1;
	private playing = true;
	private rafId: number | null = null;
	private shaderTime = 0;
	private lastFrame = 0;
	// Eased 0-1
	private speedFactor = 1;
	private transitionUntil = 0;

	constructor(host: HTMLElement, id: string, zIndex: string) {
		this.host = host;
		this.canvas = document.createElement("canvas");
		// detection selector
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
		// Needed or no restore fires
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
		// Aurora: render a single row of pixels and let CSS stretch it down the whole canvas (makes bands of color)
		const height =
			settings.backdropStyle === 1
				? 1
				: Math.max(1, Math.round(rect.height * dpr));
		if (this.canvas.width === width && this.canvas.height === height) return;
		this.canvas.width = width;
		this.canvas.height = height;
		this.kawarp?.resize();
	}

	/** False once Tidal has rebuilt the container */
	isMountedIn(container: HTMLElement): boolean {
		return this.canvas.parentElement === container;
	}

	/** Actually on screen? */
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
			// Newer track won
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
			// Fallback for Lunar
			try {
				if (token !== this.loadToken || this.kawarp !== engine) return;
				const img = await loadCoverElement(src);
				if (token !== this.loadToken || this.kawarp !== engine) return;
				this.coverLuminance = measureLuminance(img);
				engine.loadImageElement(img);
				this.transitionUntil = performance.now() + CROSSFADE_RENDER_MS;
				this.ensureLoop();
				this.updateBrightness();
			} catch {
				try {
					if (token !== this.loadToken || this.kawarp !== engine) return;
					// Last resort (Darkening is unavailable)
					this.coverLuminance = null;
					await engine.loadImage(src);
					this.updateBrightness();
				} catch {
					// Keep previous frame & later retry
					if (token === this.loadToken) this.currentSrc = null;
				}
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
