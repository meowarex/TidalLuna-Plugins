import { LunaUnload, Tracer } from "@luna/core";
import { StyleTag, PlayState } from "@luna/lib";
import { settings, Settings } from "./Settings";

// Import CSS styles for the visualizer
import visualizerStyles from "file://styles.css?minify";

export const { trace } = Tracer("[Audio Visualizer]");

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
const styleTag = new StyleTag("AudioVisualizer", unloads, visualizerStyles);

// Audio context and analyzer
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let audioSource: MediaElementAudioSourceNode | null = null;
let dataArray: Uint8Array | null = null;
let animationId: number | null = null;
let currentAudioElement: HTMLAudioElement | null = null;
let isSourceConnected: boolean = false;

// Canvas and container elements
let visualizerContainer: HTMLDivElement | null = null;
let canvas: HTMLCanvasElement | null = null;
let canvasContext: CanvasRenderingContext2D | null = null;

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
		// Find the audio element
		const audioElement = findAudioElement();
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
			} catch (error) {
				// Audio is connected elsewhere - that's fine, we just can't visualize
				if (
					error instanceof Error &&
					error.message.includes("already connected")
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

	// Update canvas color in case it changed
	canvasContext.fillStyle = config.color;
	canvasContext.strokeStyle = config.color;

	// Check if we have real audio data - this might not be needed but its a good idea
	let hasRealAudio = false;
	if (analyser && dataArray) {
		analyser.getByteFrequencyData(dataArray);
		// Check if there's actual audio signal (not just silence)
		const avgVolume =
			dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
		hasRealAudio = avgVolume > 5; // Threshold for detecting actual audio
	}

	// Clear canvas
	canvasContext.clearRect(0, 0, canvas.width, canvas.height);

	if (hasRealAudio && analyser && dataArray) {
		// Draw real audio visualization
		switch (config.visualizerType) {
			case "bars": // Is implemented YAYYY (default)
				drawBars();
				break;
			case "waveform": // Not implemented yet
				drawWaveform();
				break;
			case "circular": // Not implemented yet
				drawCircular();
				break;
		}
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

// Draw waveform visualization - NOT IMPLEMENTED YET
// const drawWaveform = (): void => {
//     if (!canvasContext || !dataArray || !canvas) return;

//     const centerY = canvas.height / 2;
//     const amplitudeScale = canvas.height / 512;

//     canvasContext.strokeStyle = config.color;
//     canvasContext.lineWidth = 2;
//     canvasContext.beginPath();

//     for (let i = 0; i < config.barCount; i++) {
//         const dataIndex = Math.floor(i * (dataArray.length / config.barCount));
//         const amplitude = (dataArray[dataIndex] - 128) * config.sensitivity * amplitudeScale;

//         const x = (i / config.barCount) * canvas.width;
//         const y = centerY + amplitude;

//         if (i === 0) {
//             canvasContext.moveTo(x, y);
//         } else {
//             canvasContext.lineTo(x, y);
//         }
//     }

//     canvasContext.stroke();
// };

// Draw circular visualization - NOT IMPLEMENTED YET
// const drawCircular = (): void => {
//     if (!canvasContext || !dataArray || !canvas) return;

//     const centerX = canvas.width / 2;
//     const centerY = canvas.height / 2;
//     const radius = Math.min(centerX, centerY) - 10;

//     canvasContext.strokeStyle = config.color;
//     canvasContext.lineWidth = 2;

//     for (let i = 0; i < config.barCount; i++) {
//         const dataIndex = Math.floor(i * (dataArray.length / config.barCount));
//         const amplitude = (dataArray[dataIndex] * config.sensitivity) / 255;

//         const angle = (i / config.barCount) * Math.PI * 2;
//         const startX = centerX + Math.cos(angle) * radius * 0.7;
//         const startY = centerY + Math.sin(angle) * radius * 0.7;
//         const endX = centerX + Math.cos(angle) * radius * (0.7 + amplitude * 0.3);
//         const endY = centerY + Math.sin(angle) * radius * (0.7 + amplitude * 0.3);

//         canvasContext.beginPath();
//         canvasContext.moveTo(startX, startY);
//         canvasContext.lineTo(endX, endY);
//         canvasContext.stroke();
//     }
// };

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
(window as any).updateAudioVisualizer = updateAudioVisualizer;

// Clean up function
const cleanupAudioVisualizer = (): void => {
	// stop animation and hide UI - don't touch audio connections (otherwise it will reconnect)
	if (animationId) {
		cancelAnimationFrame(animationId);
		animationId = null;
	}

	removeVisualizerUI();

	// i was killing audio connections - But it was reconnecting and being a pain
	// so i just left it alone - it works fine
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
const initialize = (): void => {
	log("Audio Visualizer plugin initializing...");

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

	// Fully disconnect and reset everything
	if (audioSource) {
		try {
			audioSource.disconnect();
			log("Disconnected audio source completely");
		} catch (e) {
			log("Audio source already disconnected");
		}
	}

	// Close audio context completely on plugin unload
	if (audioContext && audioContext.state !== "closed") {
		audioContext.close();
		log("Closed AudioContext");
	}

	// Reset all references
	audioContext = null;
	analyser = null;
	audioSource = null;
	dataArray = null;
	currentAudioElement = null;
	isSourceConnected = false;
};

// Register cleanup
unloads.add(completeCleanup);

// Start initialization
initialize();
