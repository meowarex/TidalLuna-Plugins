const log = (message: string) => console.log(`[Audio Visualizer] ${message}`);

let audioContext: AudioContext | null = null;
let monoAnalyser: AnalyserNode | null = null;
let leftAnalyser: AnalyserNode | null = null;
let rightAnalyser: AnalyserNode | null = null;
let splitter: ChannelSplitterNode | null = null;
let audioSource: MediaStreamAudioSourceNode | null = null;
let trackedEl: HTMLMediaElement | null = null;
let capturedTrack: MediaStreamTrack | null = null;
let trackCleanup: (() => void) | null = null;
let docCleanup: (() => void) | null = null;

let desiredFFT = 2048;
let desiredSmoothing = 0.8;

let monoByteFreq: Uint8Array | null = null;
let monoByteTime: Uint8Array | null = null;
let monoFloatFreq: Float32Array | null = null;
let monoFloatTime: Float32Array | null = null;
let leftFloatTime: Float32Array | null = null;
let rightFloatTime: Float32Array | null = null;

export interface AudioData {
	byteFrequency: Uint8Array;
	byteTimeDomain: Uint8Array;
	floatFrequency: Float32Array;
	floatTimeDomain: Float32Array;
	leftTimeDomain: Float32Array;
	rightTimeDomain: Float32Array;
	sampleRate: number;
	fftSize: number;
	binCount: number;
}

// Connection states
// disconnected - no audio source
// pending - wired but audio isn't detected (track muted / loading)
// live - audio is detected
export type ConnectionState = "disconnected" | "pending" | "live";
let state: ConnectionState = "disconnected";
let onStateChange: ((state: ConnectionState) => void) | null = null;

export const setOnStateChange = (cb: ((state: ConnectionState) => void) | null): void => {
	onStateChange = cb;
};

export const getState = (): ConnectionState => state;
export const isLive = (): boolean => state === "live";

const setState = (next: ConnectionState): void => {
	if (next === state) return;
	state = next;
	try {
		onStateChange?.(next);
	} catch {}
};

// Analyser / buffer setup

export const setFFTSize = (size: number): void => {
	desiredFFT = size;
	if (monoAnalyser) monoAnalyser.fftSize = size;
	if (leftAnalyser) leftAnalyser.fftSize = size;
	if (rightAnalyser) rightAnalyser.fftSize = size;
	allocateBuffers();
};

export const setSmoothing = (value: number): void => {
	desiredSmoothing = value;
	if (monoAnalyser) monoAnalyser.smoothingTimeConstant = value;
	if (leftAnalyser) leftAnalyser.smoothingTimeConstant = value;
	if (rightAnalyser) rightAnalyser.smoothingTimeConstant = value;
};

const allocateBuffers = (): void => {
	if (!monoAnalyser) return;
	const bc = monoAnalyser.frequencyBinCount;
	monoByteFreq = new Uint8Array(bc);
	monoByteTime = new Uint8Array(bc);
	monoFloatFreq = new Float32Array(bc);
	monoFloatTime = new Float32Array(monoAnalyser.fftSize);

	if (leftAnalyser && rightAnalyser) {
		leftFloatTime = new Float32Array(leftAnalyser.fftSize);
		rightFloatTime = new Float32Array(rightAnalyser.fftSize);
	}
};

const createAnalyser = (ctx: AudioContext, fftSize: number, smoothing: number): AnalyserNode => {
	const a = ctx.createAnalyser();
	a.fftSize = fftSize;
	a.smoothingTimeConstant = smoothing;
	a.minDecibels = -100;
	a.maxDecibels = -10;
	return a;
};

const ensureContext = (): boolean => {
	try {
		if (!audioContext || audioContext.state === "closed") {
			audioContext = new AudioContext();
		}

		if (!monoAnalyser) {
			monoAnalyser = createAnalyser(audioContext, desiredFFT, desiredSmoothing);
			leftAnalyser = createAnalyser(audioContext, desiredFFT, desiredSmoothing);
			rightAnalyser = createAnalyser(audioContext, desiredFFT, desiredSmoothing);
			splitter = audioContext.createChannelSplitter(2);
			splitter.connect(leftAnalyser, 0);
			splitter.connect(rightAnalyser, 1);
			allocateBuffers();
		}

		if (audioContext.state === "suspended") {
			audioContext.resume().catch(() => {});
		}

		return true;
	} catch (err) {
		log(`Failed to create audio context: ${err}`);
		return false;
	}
};

// Source / track wiring

const clearTrackListeners = (): void => {
	trackCleanup?.();
	trackCleanup = null;
};

const detachSource = (): void => {
	clearTrackListeners();
	if (audioSource) {
		try {
			audioSource.disconnect();
		} catch {}
		audioSource = null;
	}
	capturedTrack = null;
	trackedEl = null;
};

// captureFromEl() is retried after log spam to stop it <3
let loggedCaptureFailure = false;
const logCaptureFailureOnce = (message: string): void => {
	if (loggedCaptureFailure) return;
	loggedCaptureFailure = true;
	log(message);
};

const captureFromEl = (el: HTMLMediaElement): boolean => {
	const capture = (el as unknown as { captureStream?: () => MediaStream }).captureStream;
	if (typeof capture !== "function") {
		logCaptureFailureOnce("captureStream() not available on media element");
		return false;
	}

	let stream: MediaStream;
	try {
		stream = capture.call(el);
	} catch (err) {
		logCaptureFailureOnce(`captureStream() failed: ${err}`);
		return false;
	}

	const tracks = stream.getAudioTracks();
	// No audio track yet
	if (tracks.length === 0) return false;
	if (!ensureContext()) return false;

	detachSource();

	const track = tracks[0];
	try {
		audioSource = audioContext!.createMediaStreamSource(stream);
		audioSource.connect(monoAnalyser!);
		audioSource.connect(splitter!);
	} catch (err) {
		log(`Failed to connect captured stream: ${err}`);
		audioSource = null;
		return false;
	}

	trackedEl = el;
	capturedTrack = track;
	const onUnmute = () => setState("live");
	const onMute = () => {
		if (state === "live") setState("pending");
	};
	const onEnded = () => {
		detachSource();
		setState("pending");
	};
	track.addEventListener("unmute", onUnmute);
	track.addEventListener("mute", onMute);
	track.addEventListener("ended", onEnded);
	trackCleanup = () => {
		track.removeEventListener("unmute", onUnmute);
		track.removeEventListener("mute", onMute);
		track.removeEventListener("ended", onEnded);
	};

	// Captured tracks start muted until samples flow; wait for "unmute" instead of guessing.
	loggedCaptureFailure = false;
	setState(track.muted ? "pending" : "live");
	return true;
};

// An element is worth capturing from when it's actually advancing audio.
const isPlayingAudio = (el: HTMLMediaElement): boolean => !el.paused && !el.ended && el.readyState >= 2;


const captureFrom = (el: HTMLMediaElement): void => {
	if (el === trackedEl) {
		if (state === "live") return;
		if (capturedTrack && capturedTrack.readyState === "live" && !capturedTrack.muted) {
			setState("live"); // healthy track, we just missed its unmute event
			return;
		}
	}
	captureFromEl(el);
};
// Capture media events (timeupdate & playing etc..)
const MEDIA_ACTIVE_EVENTS = ["playing", "timeupdate"] as const;
const MEDIA_RESET_EVENTS = ["pause", "ended", "emptied", "abort"] as const;

const onMediaActive = (e: Event): void => {
	const el = e.target;
	if (el instanceof HTMLMediaElement && isPlayingAudio(el)) captureFrom(el);
};

const onMediaReset = (e: Event): void => {
	if (e.target === trackedEl) {
		detachSource();
		setState("pending");
	}
};

/** global media listeners */
export const init = (): void => {
	ensureContext();
	if (docCleanup) return;
	for (const ev of MEDIA_ACTIVE_EVENTS) document.addEventListener(ev, onMediaActive, true);
	for (const ev of MEDIA_RESET_EVENTS) document.addEventListener(ev, onMediaReset, true);
	docCleanup = () => {
		for (const ev of MEDIA_ACTIVE_EVENTS) document.removeEventListener(ev, onMediaActive, true);
		for (const ev of MEDIA_RESET_EVENTS) document.removeEventListener(ev, onMediaReset, true);
	};
};

/** capture from whatever is already playing (plugin loaded mid-playback) */
export const scan = (): void => {
	if (!ensureContext()) return;
	for (const el of document.querySelectorAll<HTMLMediaElement>(
		"video, audio",
	)) {
		if (isPlayingAudio(el)) {
			captureFrom(el);
			if (state === "live") return;
		}
	}
};

export const sample = (): AudioData | null => {
	const ctx = audioContext;
	if (!ctx || !monoAnalyser || !monoByteFreq || !monoByteTime || !monoFloatFreq || !monoFloatTime || !leftFloatTime || !rightFloatTime || !leftAnalyser || !rightAnalyser) return null;

	if (ctx.state === "suspended") {
		ctx.resume().catch(() => {});
	}

	monoAnalyser.getByteFrequencyData(monoByteFreq);
	monoAnalyser.getByteTimeDomainData(monoByteTime);
	monoAnalyser.getFloatFrequencyData(monoFloatFreq);
	monoAnalyser.getFloatTimeDomainData(monoFloatTime);
	leftAnalyser.getFloatTimeDomainData(leftFloatTime);
	rightAnalyser.getFloatTimeDomainData(rightFloatTime);

	return {
		byteFrequency: monoByteFreq,
		byteTimeDomain: monoByteTime,
		floatFrequency: monoFloatFreq,
		floatTimeDomain: monoFloatTime,
		leftTimeDomain: leftFloatTime,
		rightTimeDomain: rightFloatTime,
		sampleRate: ctx.sampleRate,
		fftSize: monoAnalyser.fftSize,
		binCount: monoAnalyser.frequencyBinCount,
	};
};

export const hasSignal = (data: AudioData): boolean => {
	const avg = data.byteFrequency.reduce((s, v) => s + v, 0) / data.byteFrequency.length;
	return avg > 5;
};

export const dispose = (): void => {
	docCleanup?.();
	docCleanup = null;
	detachSource();
	setState("disconnected");
	onStateChange = null;

	if (audioContext && audioContext.state !== "closed") {
		audioContext.close().catch(() => {});
	}
	audioContext = null;
	monoAnalyser = null;
	leftAnalyser = null;
	rightAnalyser = null;
	splitter = null;
	monoByteFreq = null;
	monoByteTime = null;
	monoFloatFreq = null;
	monoFloatTime = null;
	leftFloatTime = null;
	rightFloatTime = null;
};
