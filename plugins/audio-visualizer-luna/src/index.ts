import { LunaUnload, Tracer } from "@luna/core";
import { StyleTag, PlayState, safeInterval } from "@luna/lib";
import { settings, Settings } from "./Settings";
import {
	startAudioVisualizerServer,
	stopAudioVisualizerServer,
	isWindows
} from "./index.native";

// Import CSS styles for the visualizer
import visualizerStyles from "file://styles.css?minify";

const { trace } = Tracer("[Audio Visualizer]");
const unloads = new Set<LunaUnload>();

// StyleTag for CSS
new StyleTag("AudioVisualizer", unloads, visualizerStyles);

export { Settings };

// Logger (like MPV does)
const verbose = false;
const logger = {
	log: (message: string) => verbose ? trace.log(message) : null,
	warn: (message: string) => verbose ? trace.msg.warn(message) : trace.warn(message),
	err: (message: string) => verbose ? trace.msg.err(message) : trace.err(message)
};

// State variables
let port = 0;
let visualizerInitialized = false;
let currentStreamTrackId: number | string | null = null;
let nextStreamTrackId: number | string | null = null;

// Audio visualization state
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let audioSource: MediaElementAudioSourceNode | null = null;
let dataArray: Uint8Array | null = null;
let animationId: number | null = null;
let streamAudioElement: HTMLAudioElement | null = null;

// Canvas and container
let visualizerContainer: HTMLDivElement | null = null;
let canvas: HTMLCanvasElement | null = null;
let canvasContext: CanvasRenderingContext2D | null = null;

// Config
const config = {
	enabled: true,
	position: "left" as "left" | "right",
	width: 200,
	height: 40,
	get barCount() {
		return settings.barCount;
	},
	get color() {
		return settings.barColor;
	},
	get barRounding() {
		return settings.barRounding;
	},
	sensitivity: 1.5,
	smoothing: 0.8,
};

// Initialize server (like MPV's startServer pattern) - Windows only
if (isWindows) {
	startAudioVisualizerServer().then(async (p) => {
		port = p;
		logger.log(`Audio Visualizer server started on port ${port}`);

		try {
			visualizerInitialized = true;
			logger.log("Audio Visualizer initialized successfully");
		} catch (err) {
			logger.err(`Failed to initialize Audio Visualizer: ${err}`);
		}
	}).catch((err) => {
		logger.err(`Failed to start Audio Visualizer server: ${err}`);
	});
} else {
	// Non-Windows: initialize immediately without server
	visualizerInitialized = true;
	port = 0;
	logger.log("Audio Visualizer initialized (non-Windows, using native audio)");
}

// Cleanup on unload
unloads.add(async () => {
	if (visualizerInitialized) {
		try {
			logger.log("Shutting down Audio Visualizer");
			stopAudioVisualizerServer();
		} catch (err) {
			logger.err(`Error shutting down Audio Visualizer: ${err}`);
		}
	}
	stopAudioVisualizerServer();
	visualizerInitialized = false;
	port = 0;
});

// Load queue into visualizer (like loadPlayQueueIntoMPV)
async function loadQueueIntoVisualizer() {
	// Only use HTTP streams on Windows
	if (!isWindows || !visualizerInitialized || !port) return;

	try {
		const playQueue = PlayState.playQueue;
		if (!playQueue?.elements || playQueue.elements.length === 0) {
			logger.warn("No play queue available");
			return;
		}

		const currentIndex = playQueue.currentIndex || 0;
		const currentElement = playQueue.elements[currentIndex];

		if (!currentElement) {
			logger.warn("No current element in play queue");
			return;
		}

		const currentTrackId = currentElement.mediaItemId;
		const nextTrackId = currentIndex + 1 < playQueue.elements.length ?
			playQueue.elements[currentIndex + 1].mediaItemId : null;

		// Check if already synced
		if (currentStreamTrackId === currentTrackId && nextStreamTrackId === nextTrackId) {
			return;
		}

		logger.log(`Syncing queue - Current: ${currentTrackId}, Next: ${nextTrackId}`);

		// Load current track
		const currentUrl = `http://localhost:${port}/stream/${currentTrackId}`;
		await loadStreamUrl(currentUrl);
		currentStreamTrackId = currentTrackId;

		// Preload next track after 1 second (like MPV does)
		if (nextTrackId) {
			nextStreamTrackId = nextTrackId;

			setTimeout(async () => {
				try {
					// Just ensure next URL is ready
					logger.log("Next track ready in queue");
				} catch (err) {
					logger.warn(`Failed to preload next track: ${err}`);
				}
			}, 1000);
		} else {
			nextStreamTrackId = null;
		}

		logger.log("Queue loaded into visualizer successfully");
	} catch (err) {
		logger.err(`Error loading queue into visualizer: ${err}`);
	}
}

// Load stream URL into audio element
async function loadStreamUrl(url: string): Promise<void> {
	if (!streamAudioElement) {
		streamAudioElement = new Audio();
		streamAudioElement.crossOrigin = "anonymous";
		streamAudioElement.muted = true;
		streamAudioElement.volume = 0;
		streamAudioElement.preload = "auto";
		streamAudioElement.style.display = "none";
		document.body.appendChild(streamAudioElement);
	}

	streamAudioElement.src = url;
	streamAudioElement.load();
}

// Main sync function (like MPV's doStuff)
const doVisualizeStuff = async () => {
	try {
		const currentPlaying = PlayState.playing;
		const currentPlayTime = PlayState.playTime;

		// Determine which audio element to sync
		const audioToSync = isWindows ? streamAudioElement : findAudioElement();
		if (!audioToSync) return;

		// Sync play state
		if (currentPlaying && audioToSync.paused) {
			audioToSync.play().catch(() => {});
		} else if (!currentPlaying && !audioToSync.paused) {
			audioToSync.pause();
		}

		// Sync time if drift > 0.5 seconds
		if (Math.abs(audioToSync.currentTime - currentPlayTime) > 0.5) {
			audioToSync.currentTime = currentPlayTime;
		}
	} catch (err) {
		logger.err(`Error in visualization sync: ${err}`);
	}
};

// Watch PlayState changes
PlayState.onState(unloads, async () => {
	if (!visualizerInitialized) return;
	await doVisualizeStuff();
	await loadQueueIntoVisualizer();
});

// Find audio element for non-Windows
const findAudioElement = (): HTMLAudioElement | null => {
	const selectors = ["audio", "video", "audio[data-test]", '[data-test="audio-player"] audio'];
	for (const selector of selectors) {
		const element = document.querySelector(selector) as HTMLAudioElement;
		if (element && (element.tagName === "AUDIO" || element.tagName === "VIDEO")) {
			return element;
		}
	}
	return null;
};

// Create UI
const createVisualizerUI = (): void => {
	if (visualizerContainer) return;
	if (!config.enabled) return;

	const searchField = document.querySelector('input[class*="_searchField"]') as HTMLInputElement;
	if (!searchField) return;

	const searchContainer = searchField.parentElement;
	if (!searchContainer) return;

	visualizerContainer = document.createElement("div");
	visualizerContainer.id = "audio-visualizer-container";
	visualizerContainer.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        margin-${config.position === "left" ? "right" : "left"}: 12px;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 8px;
        padding: 4px;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
    `;

	canvas = document.createElement("canvas");
	canvas.width = config.width;
	canvas.height = config.height;
	canvas.style.cssText = `width: ${config.width}px; height: ${config.height}px; border-radius: 4px;`;

	visualizerContainer.appendChild(canvas);
	canvasContext = canvas.getContext("2d");

	if (config.position === "left") {
		searchContainer.parentElement?.insertBefore(visualizerContainer, searchContainer);
	} else {
		searchContainer.parentElement?.insertBefore(visualizerContainer, searchContainer.nextSibling);
	}
};

// Remove UI
const removeVisualizerUI = (): void => {
	if (visualizerContainer) {
		visualizerContainer.remove();
		visualizerContainer = null;
		canvas = null;
		canvasContext = null;
	}
};

// Initialize audio context when needed
const initializeAudioContext = (): void => {
	if (audioContext) return;

	// Use stream element on Windows, native audio on other platforms
	const audioElement = isWindows ? streamAudioElement : findAudioElement();
	if (!audioElement) return;

	try {
		audioContext = new AudioContext();
		analyser = audioContext.createAnalyser();
		analyser.fftSize = 512;
		analyser.smoothingTimeConstant = config.smoothing;
		dataArray = new Uint8Array(analyser.frequencyBinCount);

		audioSource = audioContext.createMediaElementSource(audioElement);
		audioSource.connect(analyser);
		analyser.connect(audioContext.destination);

		if (audioContext.state === "suspended") {
			audioContext.resume().catch(() => {});
		}

		logger.log("Audio context initialized");
	} catch (err) {
		logger.err(`Failed to initialize audio context: ${err}`);
	}
};

// Draw functions
const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void => {
	ctx.beginPath();
	ctx.roundRect(x, y, width, height, radius);
	ctx.fill();
};

const drawBars = (): void => {
	if (!canvasContext || !dataArray || !canvas) return;

	const barWidth = canvas.width / config.barCount;
	const heightScale = canvas.height / 255;

	canvasContext.fillStyle = config.color;

	for (let i = 0; i < config.barCount; i++) {
		const dataIndex = Math.floor(i * (dataArray.length / config.barCount));
		const barHeight = dataArray[dataIndex] * config.sensitivity * heightScale;
		const x = i * barWidth;
		const y = canvas.height - barHeight;

		if (config.barRounding) {
			drawRoundedRect(canvasContext, x, y, barWidth - 1, barHeight, 2);
		} else {
			canvasContext.fillRect(x, y, barWidth - 1, barHeight);
		}
	}
};

let waveTime = 0;

const drawScrollingWave = (): void => {
	if (!canvasContext || !canvas) return;

	waveTime += 0.05;
	const barCount = config.barCount;
	const barWidth = canvas.width / barCount;
	const maxHeight = canvas.height * 0.6;

	canvasContext.fillStyle = config.color;

	for (let i = 0; i < barCount; i++) {
		const x = i / barCount;
		const wave = Math.sin(x * Math.PI * 2 + waveTime) * 0.3 + Math.sin(x * Math.PI * 4 + waveTime * 1.3) * 0.2;
		const barHeight = maxHeight * (wave + 1) / 2 + 2;
		const xPos = i * barWidth;
		const yPos = (canvas.height - barHeight) / 2;

		if (config.barRounding) {
			drawRoundedRect(canvasContext, xPos, yPos, barWidth - 1, barHeight, 2);
		} else {
			canvasContext.fillRect(xPos, yPos, barWidth - 1, barHeight);
		}
	}
};

// Animation loop
const animate = (): void => {
	if (!canvasContext || !canvas) {
		animationId = null;
		return;
	}

	canvasContext.fillStyle = config.color;
	canvasContext.strokeStyle = config.color;

	let hasRealAudio = false;
	if (analyser && dataArray) {
		analyser.getByteFrequencyData(dataArray);
		let sum = 0;
		for (let i = 0; i < dataArray.length; i++) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			sum += (dataArray as any)[i];
		}
		hasRealAudio = sum / dataArray.length > 5;
	}

	canvasContext.clearRect(0, 0, canvas.width, canvas.height);

	if (hasRealAudio && analyser && dataArray) {
		drawBars();
	} else {
		drawScrollingWave();
	}

	animationId = requestAnimationFrame(animate);
};

// Main initialization
const initialize = (): void => {
	logger.log("Audio Visualizer initializing...");

	createVisualizerUI();
	initializeAudioContext();
	animate();

	// Periodic sync (like MPV's safeInterval)
	safeInterval(unloads, async () => {
		if (!visualizerInitialized) return;
		await doVisualizeStuff();
		await loadQueueIntoVisualizer();
	}, 1000);
};

// Cleanup on unload
unloads.add(() => {
	logger.log("Audio Visualizer cleanup");

	if (animationId) {
		cancelAnimationFrame(animationId);
		animationId = null;
	}

	removeVisualizerUI();

	if (audioSource) {
		try {
			audioSource.disconnect();
		} catch {
			// Already disconnected
		}
	}

	if (audioContext?.state !== "closed") {
		audioContext?.close();
	}

	if (streamAudioElement) {
		streamAudioElement.pause();
		streamAudioElement.src = "";
		streamAudioElement.remove();
		streamAudioElement = null;
	}

	audioContext = null;
	analyser = null;
	audioSource = null;
	dataArray = null;
	currentStreamTrackId = null;
	nextStreamTrackId = null;
});

// Start
setTimeout(initialize, 100);
