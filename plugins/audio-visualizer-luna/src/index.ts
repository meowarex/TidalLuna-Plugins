import { LunaUnload, Tracer } from "@luna/core";
import { StyleTag, PlayState } from "@luna/lib";
import { MediaItem } from "@luna/lib";
import { settings, Settings } from "./Settings";

// Import platform-specific audio handling
import {
	startAudioVisualizerServer,
	stopAudioVisualizerServer,
	isWindows
} from "./index.native";

// Import CSS styles for the visualizer
import visualizerStyles from "file://styles.css?minify";

// Initialize tracer (for future use)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { trace } = Tracer("[Audio Visualizer]");

// Helper function for consistent logging
const log = (message: string) => console.log(`[Audio Visualizer] ${message}`);
const warn = (message: string) => console.warn(`[Audio Visualizer] ${message}`);
const error = (message: string) =>
	console.error(`[Audio Visualizer] ${message}`);
export { Settings };

// Basic config with settings
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
	visualizerType: "bars" as "bars" | "waveform" | "circular",
};

// Clean up resources
export const unloads = new Set<LunaUnload>();

// StyleTag for CSS
new StyleTag("AudioVisualizer", unloads, visualizerStyles);

// Audio context and analyzer
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let audioSource: MediaElementAudioSourceNode | null = null;
let dataArray: Uint8Array | null = null;
let animationId: number | null = null;
let currentAudioElement: HTMLAudioElement | null = null;
let streamAudioElement: HTMLAudioElement | null = null;
let isSourceConnected: boolean = false;
let visualizerServerPort: number = 0;
let currentTrackIdForStream: number | string | null = null;

// Canvas and container elements
let visualizerContainer: HTMLDivElement | null = null;
let canvas: HTMLCanvasElement | null = null;
let canvasContext: CanvasRenderingContext2D | null = null;

// Initialize Windows audio streaming server
const initializeWindowsAudioServer = async (): Promise<void> => {
	if (!isWindows) return;

	try {
		visualizerServerPort = await startAudioVisualizerServer();
		log(`Windows audio stream server started on port ${visualizerServerPort}`);
		
		// Preload the stream for the current track immediately
		const currentMedia = await MediaItem.fromPlaybackContext();
		if (currentMedia?.tidalItem?.id) {
			preloadStreamForTrack(currentMedia.tidalItem.id);
		}
	} catch (err) {
		error(`Failed to start Windows audio stream server: ${err}`);
	}
};

// Preload stream for a track (without playing it yet)
const preloadStreamForTrack = (trackId: number | string): void => {
	if (!streamAudioElement) {
		streamAudioElement = new Audio();
		streamAudioElement.crossOrigin = "anonymous";
		streamAudioElement.muted = true;
		streamAudioElement.volume = 0;
		streamAudioElement.style.display = "none";
		streamAudioElement.preload = "auto"; // Start loading immediately
		document.body.appendChild(streamAudioElement);
		log("Created streaming audio element for Windows (preloading)");
	}

	const streamUrl = `http://localhost:${visualizerServerPort}/stream/${trackId}`;
	if (streamAudioElement.src !== streamUrl) {
		streamAudioElement.src = streamUrl;
		// Set to load but don't play yet
		streamAudioElement.load();
		log(`Preloading stream for track ${trackId}`);
	}
};

// Create or update streaming audio element for Windows
const getStreamAudioElement = (trackId: number | string): HTMLAudioElement => {
	// Make sure stream is preloaded for this track
	preloadStreamForTrack(trackId);
	if (!streamAudioElement) {
		throw new Error("Stream audio element failed to initialize");
	}
	return streamAudioElement;
};

// Sync the stream element to the main playback for perfect synchronization
const syncStreamToMainPlayback = (): void => {
	if (!streamAudioElement || !currentAudioElement || !isWindows) return;

	try {
		// Check if main audio is playing
		if (currentAudioElement.paused) {
			// Pause stream if main is paused
			if (!streamAudioElement.paused) {
				streamAudioElement.pause();
			}
		} else {
			// Play stream if main is playing - don't wait for full buffering
			if (streamAudioElement.paused) {
				// Try to play, even if not fully buffered (like MPV does)
				// Preload should have done most of the work by now
				streamAudioElement.play().catch(() => {
					// Silently fail if not ready - it's loading in background
				});
			}
		}

		// Sync playback time - only resync if drift is significant (like MPV's 2 second threshold)
		const timeDiff = Math.abs(streamAudioElement.currentTime - currentAudioElement.currentTime);
		if (timeDiff > 1) {
			// If drift is > 1 second, resync (was 0.5, now more lenient like MPV)
			streamAudioElement.currentTime = currentAudioElement.currentTime;
		}
	} catch {
		// Ignore sync errors - they're not critical
	}
};

// Find the audio element - this is a bit of a hack but it works
const findAudioElement = (): HTMLAudioElement | null => {
	// Try main selectors first
	const selectors = [
		"audio",
		"video",
		"audio[data-test]",
		'[data-test="audio-player"] audio',
	];

	for (const selector of selectors) {
		const element = document.querySelector(selector) as HTMLAudioElement;
		if (
			element &&
			(element.tagName === "AUDIO" || element.tagName === "VIDEO")
		) {
			return element;
		}
	}

	// Quick scan for any audio elements
	const audioElements = document.querySelectorAll("audio, video");
	for (const element of audioElements) {
		const audioEl = element as HTMLAudioElement;
		if (audioEl.src || audioEl.currentSrc) {
			return audioEl;
		}
	}

	return null;
};

// Initialize audio visualization
const initializeAudioVisualizer = async (): Promise<void> => {
	try {
		// For Windows, get current track and setup stream
		let audioElement: HTMLAudioElement | null = null;

		if (isWindows && visualizerServerPort > 0) {
			try {
				const currentMedia = await MediaItem.fromPlaybackContext();
				if (currentMedia?.tidalItem?.id) {
					const trackId = currentMedia.tidalItem.id;
					currentTrackIdForStream = trackId;
					audioElement = getStreamAudioElement(trackId);
					log(`Using Windows stream for track ${trackId}`);
				}
			} catch (err) {
				warn(`Failed to get current media for Windows stream: ${err}`);
				// Fall back to finding audio element
				audioElement = findAudioElement();
			}
		} else {
			// Non-Windows: use existing approach
			audioElement = findAudioElement();
		}

		if (!audioElement) {
			return;
		}

		// create audio context
		if (!audioContext) {
			audioContext = new AudioContext();
			log("Created AudioContext");
		}

		// create analyser
		if (!analyser) {
			analyser = audioContext.createAnalyser();
			analyser.fftSize = 512; // Fixed power of 2 that provides enough frequency bins
			analyser.smoothingTimeConstant = config.smoothing;
			dataArray = new Uint8Array(analyser.frequencyBinCount);
			log("Created AnalyserNode");
		}

		// attempt audio connection if not already connected
		if (!isSourceConnected && audioElement !== currentAudioElement) {
			try {
				// Create audio source - this might fail if already connected elsewhere
				audioSource = audioContext.createMediaElementSource(audioElement);
				audioSource.connect(analyser);
				// CRITICAL: connect back to destination for audio output (otherwise no sound)
				analyser.connect(audioContext.destination);

				currentAudioElement = audioElement;
				isSourceConnected = true;
				log("Connected to audio stream with output");
			} catch (connectErr) {
				// Audio is connected elsewhere - that's fine, we just can't visualize
				if (
					connectErr instanceof Error &&
					connectErr.message.includes("already connected")
				) {
					log("Audio already connected elsewhere - skipping visualization");
				}
				return;
			}
		}

		// Resume context only if needed and don't wait for it
		// (otherwise it will wait for the audio to start playing)
		if (audioContext.state === "suspended") {
			audioContext.resume().catch(() => {}); // Fire and forget
		}

		// Create UI only if it doesn't exist
		if (!visualizerContainer) {
			createVisualizerUI();
		}

		// Start animation only if not already running
		if (!animationId) {
			animate();
		}
	} catch (err) {
		// log errors
		console.error(err);
	}
};

// Create the visualizer UI container and canvas
const createVisualizerUI = (): void => {
	// Remove existing visualizer if it exists
	removeVisualizerUI();

	if (!config.enabled) return;

	// Find the search bar
	const searchField = document.querySelector(
		'input[class*="_searchField"]',
	) as HTMLInputElement;
	if (!searchField) {
		warn("Search field not found");
		return;
	}

	const searchContainer = searchField.parentElement;
	if (!searchContainer) {
		warn("Search container not found");
		return;
	}

	// Create visualizer container
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

	// Create canvas
	canvas = document.createElement("canvas");
	canvas.width = config.width;
	canvas.height = config.height;
	canvas.style.cssText = `
        width: ${config.width}px;
        height: ${config.height}px;
        border-radius: 4px;
    `;

	visualizerContainer.appendChild(canvas);
	canvasContext = canvas.getContext("2d");

	// Insert visualizer next to search bar
	if (config.position === "left") {
		searchContainer.parentElement?.insertBefore(
			visualizerContainer,
			searchContainer,
		);
	} else {
		searchContainer.parentElement?.insertBefore(
			visualizerContainer,
			searchContainer.nextSibling,
		);
	}
};

// Remove visualizer UI
const removeVisualizerUI = (): void => {
	if (visualizerContainer) {
		visualizerContainer.remove();
		visualizerContainer = null;
		canvas = null;
		canvasContext = null;
	}
};

// Animation loop for rendering visualizer
const animate = (): void => {
	if (!canvasContext || !canvas) {
		animationId = null;
		return;
	}

	// Sync Windows stream to main playback
	if (isWindows) {
		syncStreamToMainPlayback();
	}

	// Update canvas color in case it changed
	canvasContext.fillStyle = config.color;
	canvasContext.strokeStyle = config.color;

	// Check if we have real audio data - this might not be needed but its a good idea
	let hasRealAudio = false;
	if (analyser && dataArray) {
		analyser.getByteFrequencyData(dataArray);
		// Check if there's actual audio signal (not just silence)
		let sum = 0;
		const len = dataArray.length;
		for (let i = 0; i < len; i++) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			sum += (dataArray as any)[i];
		}
		const avgVolume = sum / len;
		hasRealAudio = avgVolume > 5; // Threshold for detecting actual audio
	}

	// Clear canvas
	canvasContext.clearRect(0, 0, canvas.width, canvas.height);

	if (hasRealAudio && analyser && dataArray) {
		// Draw real audio visualization
		drawBars();
	} else {
		// Draw cool scrolling wave effect when no audio
		drawScrollingWave();
	}

	animationId = requestAnimationFrame(animate);
};

// Global wave animation state
let waveTime = 0;

// Helper function to draw rounded rectangles
const drawRoundedRect = (
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number,
): void => {
	ctx.beginPath();
	ctx.roundRect(x, y, width, height, radius);
	ctx.fill();
};

// Draw scrolling wave effect when no audio is detected
const drawScrollingWave = (): void => {
	if (!canvasContext || !canvas) return;

	waveTime += 0.05; // Speed of wave animation

	const barCount = config.barCount;
	const barWidth = canvas.width / barCount;
	const maxHeight = canvas.height * 0.6;

	canvasContext.fillStyle = config.color;

	for (let i = 0; i < barCount; i++) {
		// Create a sine wave that scrolls back and forth
		const x = i / barCount;
		const wave1 = Math.sin(x * Math.PI * 2 + waveTime) * 0.3;
		const wave2 = Math.sin(x * Math.PI * 4 + waveTime * 1.3) * 0.2;
		const wave3 = Math.sin(x * Math.PI * 6 + waveTime * 0.7) * 0.1;

		// Combine waves for complex pattern
		const combinedWave = (wave1 + wave2 + wave3 + 1) / 2; // Normalize to 0-1

		// Add a traveling wave effect
		const travelWave = Math.sin(x * Math.PI * 3 - waveTime * 2) * 0.5 + 0.5;

		// Final height calculation
		const barHeight = maxHeight * combinedWave * travelWave * 0.8 + 2; // Minimum height of 2px

		const xPos = i * barWidth;
		const yPos = (canvas.height - barHeight) / 2;

		// Draw rounded or square bars based on setting
		if (config.barRounding) {
			drawRoundedRect(canvasContext, xPos, yPos, barWidth - 1, barHeight, 2);
		} else {
			canvasContext.fillRect(xPos, yPos, barWidth - 1, barHeight);
		}
	}
};

// Draw frequency bars - default
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

		// Draw rounded or square bars based on setting
		if (config.barRounding) {
			drawRoundedRect(canvasContext, x, y, barWidth - 1, barHeight, 2);
		} else {
			canvasContext.fillRect(x, y, barWidth - 1, barHeight);
		}
	}
};

// Update visualizer settings
const updateAudioVisualizer = (): void => {
	if (analyser) {
		// use a fixed size that provides enough frequency bins
		analyser.fftSize = 512; // Fixed power of 2 - important
		analyser.smoothingTimeConstant = config.smoothing;
		dataArray = new Uint8Array(analyser.frequencyBinCount);
	}

	if (canvas) {
		canvas.width = config.width;
		canvas.height = config.height;
		canvas.style.width = `${config.width}px`;
		canvas.style.height = `${config.height}px`;
	}

	// Recreate UI if position changed
	createVisualizerUI();
};

// Make updateAudioVisualizer available globally for settings
(window as unknown as { updateAudioVisualizer: (() => void) }).updateAudioVisualizer = updateAudioVisualizer;

// Clean up function
const cleanupAudioVisualizer = (): void => {
	// stop animation and hide UI - don't touch audio connections (otherwise it will reconnect)
	if (animationId) {
		cancelAnimationFrame(animationId);
		animationId = null;
	}

	removeVisualizerUI();

	// Clean up stream audio element if on Windows
	if (streamAudioElement) {
		streamAudioElement.pause();
		streamAudioElement.src = "";
		streamAudioElement.remove();
		streamAudioElement = null;
	}

	// i was killing audio connections - But it was reconnecting and being a pain
	// so i just left it alone - it works fine
};

// Observer for media transitions on Windows
const setupWindowsMediaObserver = (): void => {
	if (!isWindows) return;

	const checkMediaTransition = async () => {
		try {
			const currentMedia = await MediaItem.fromPlaybackContext();
			if (currentMedia?.tidalItem?.id) {
				const trackId = currentMedia.tidalItem.id;
				if (trackId !== currentTrackIdForStream && visualizerServerPort > 0) {
					currentTrackIdForStream = trackId;
					log(`Media changed on Windows, preloading stream for track ${trackId}`);

					// Preload stream for new track immediately
					preloadStreamForTrack(trackId);

					// Reinitialize audio if needed
					if (audioContext?.state === "suspended") {
						audioContext.resume().catch(() => {});
					}
				}
			}
		} catch (err) {
			warn(`Error checking media transition: ${err}`);
		}
	};

	// Check on play state changes using observer pattern
	PlayState.onState(unloads, checkMediaTransition);
};

// Initialize when DOM is ready and track is playing
const observePlayState = (): void => {
	let hasTriedInitialization = false;
	let checkCount = 0;

	const checkAndInitialize = () => {
		checkCount++;

		// Only try to initialize once when music starts playing
		if (PlayState.playing && !hasTriedInitialization) {
			hasTriedInitialization = true;
			log("Initializing audio visualizer...");

			// Initialize immediately - no delay (after audio starts playing ofc)
			initializeAudioVisualizer().then(() => {
				if (audioContext && analyser) {
					log("Audio visualizer ready!");
				} else {
					hasTriedInitialization = false; // Allow retry if failed
				}
			});
		} else if (!PlayState.playing && hasTriedInitialization) {
			// Reset try flag when music stops so it can try again next time (otherwise it explode)
			hasTriedInitialization = false;
		}

		// Keep animation running regardless of play state
		if (!animationId) {
			animate();
		}
	};

	// Start with fast checking, then slow down
	const fastInterval = setInterval(() => {
		checkAndInitialize();
		if (checkCount > 10) {
			// After 10 quick checks, switch to slower
			clearInterval(fastInterval);
			const slowInterval = setInterval(checkAndInitialize, 2000);
			unloads.add(() => clearInterval(slowInterval));
		}
	}, 200); // Check every 200ms initially

	unloads.add(() => clearInterval(fastInterval));

	// Immediate first check
	checkAndInitialize();
};

// Initialize the plugin
const initialize = async (): Promise<void> => {
	log("Audio Visualizer plugin initializing...");

	// Initialize Windows audio server if on Windows
	if (isWindows) {
		await initializeWindowsAudioServer();
		setupWindowsMediaObserver();
	}

	// Start immediately - DOM should be ready by plugin load
	setTimeout(() => {
		log("Starting visualizer...");
		// Create UI immediately so wave effect shows
		createVisualizerUI();
		// Start animation loop immediately
		animate();
		// Also observe play state for audio detection
		observePlayState();
	}, 100); // Minimal delay to ensure DOM is ready
};

// Complete cleanup function for plugin unload
const completeCleanup = (): void => {
	log("Complete cleanup - plugin unloading");

	if (animationId) {
		cancelAnimationFrame(animationId);
		animationId = null;
	}

	removeVisualizerUI();

	// Clean up stream
	cleanupAudioVisualizer();

	// Fully disconnect and reset everything
	if (audioSource) {
		try {
			audioSource.disconnect();
			log("Disconnected audio source completely");
		} catch {
			log("Audio source already disconnected");
		}
	}

	// Close audio context completely on plugin unload
	if (audioContext?.state !== "closed") {
		audioContext?.close();
		log("Closed AudioContext");
	}

	// Stop Windows server if on Windows
	if (isWindows) {
		stopAudioVisualizerServer();
		log("Stopped audio visualizer server");
	}

	// Reset all references
	audioContext = null;
	analyser = null;
	audioSource = null;
	dataArray = null;
	currentAudioElement = null;
	streamAudioElement = null;
	isSourceConnected = false;
	visualizerServerPort = 0;
	currentTrackIdForStream = null;
};

// Register cleanup
unloads.add(completeCleanup);

// Start initialization
initialize();
