// Marker: Core Setup
import { LunaUnload, Tracer, ftch } from "@luna/core";
import { StyleTag, PlayState, observePromise, observe } from "@luna/lib";
import { settings, Settings } from "./Settings";
// Interpret integer backgroundScale (e.g., 10=1.0x, 20=2.0x)
const getScaledMultiplier = (): number => {
    const value = settings.backgroundScale;
    return value / 10;
};

// Import CSS files directly using Luna's file:// syntax - Took me a while to figure out <3
import baseStyles from "file://styles.css?minify";
import playerBarHidden from "file://player-bar-hidden.css?minify";
import lyricsGlow from "file://lyrics-glow.css?minify";
import coverEverywhereCss from "file://cover-everywhere.css?minify";

// Core tracer and exports
export const { trace } = Tracer("[Radiant Lyrics]");
export { Settings };

// clean up resources
export const unloads = new Set<LunaUnload>();

// Marker: Styles and Settings Integration
// StyleTag instances for different CSS modules
const lyricsStyleTag = new StyleTag("RadiantLyrics-lyrics", unloads);
const baseStyleTag = new StyleTag("RadiantLyrics-base", unloads);
const playerBarStyleTag = new StyleTag("RadiantLyrics-player-bar", unloads);
const lyricsGlowStyleTag = new StyleTag("RadiantLyrics-lyrics-glow", unloads);

// Apply lyrics glow styles if enabled
if (settings.lyricsGlowEnabled) {
	lyricsGlowStyleTag.css = lyricsGlow;
}

// Apply base styles always (contains global fixes and conditional UI hiding styles)
baseStyleTag.css = baseStyles;

// Update CSS variables for lyrics text glow based on settings
const updateRadiantLyricsTextGlow = function (): void {
	const root = document.documentElement;
	root.style.setProperty("--rl-glow-outer", `${settings.textGlow}px`);
	root.style.setProperty("--rl-glow-inner", "2px");
};

// Function to update styles when settings change
const updateRadiantLyricsStyles = function (): void {
	if (isHidden) {
		// Apply optional player bar hiding
		if (!settings.playerBarVisible) {
			playerBarStyleTag.css = playerBarHidden;
		} else {
			playerBarStyleTag.remove();
		}
		// Ensure lyrics glow styles are not applied when hidden
		lyricsGlowStyleTag.remove();
		return;
	}

	// Update lyrics glow based on setting (only when UI is visible)
	const lyricsContainer = document.querySelector('[class^="_lyricsContainer"]');
	if (lyricsContainer) {
		if (settings.lyricsGlowEnabled) {
			(lyricsContainer as HTMLElement).classList.remove("lyrics-glow-disabled");
			lyricsGlowStyleTag.css = lyricsGlow;
			updateRadiantLyricsTextGlow();
		} else {
			(lyricsContainer as HTMLElement).classList.add("lyrics-glow-disabled");
			lyricsGlowStyleTag.remove();
		}
	} else {
		observePromise<HTMLElement>(unloads, '[class^="_lyricsContainer"]')
			.then((el) => {
				if (!el) return;
				if (settings.lyricsGlowEnabled) {
					el.classList.remove("lyrics-glow-disabled");
					lyricsGlowStyleTag.css = lyricsGlow;
					updateRadiantLyricsTextGlow();
				} else {
					el.classList.add("lyrics-glow-disabled");
					lyricsGlowStyleTag.remove();
				}
			})
			.catch(() => {});
	}

	// Track title glow toggle based on settings
	const trackTitleEl = document.querySelector(
		'[data-test="now-playing-track-title"]',
	) as HTMLElement | null;
	if (trackTitleEl) {
		if (settings.trackTitleGlow && settings.lyricsGlowEnabled) {
			trackTitleEl.classList.remove("rl-title-glow-disabled");
		} else {
			trackTitleEl.classList.add("rl-title-glow-disabled");
		}
	}
};

// Marker: UI Visibility Control
// UI state shared across features
var isHidden = false;
let unhideButtonAutoFadeTimeout: number | null = null;

// Helper to safely create a one-off timeout that clears previous if any
const safelySetAutoFadeTimeout = (
	existingId: number | null,
	fn: () => void,
	delay: number,
): number => {
	if (existingId != null) window.clearTimeout(existingId);
	return window.setTimeout(fn, delay);
};

const updateButtonStates = function (): void {
	const hideButton = document.querySelector(".hide-ui-button") as HTMLElement;
	const unhideButton = document.querySelector(
		".unhide-ui-button",
	) as HTMLElement;

	if (hideButton) {
		if (settings.hideUIEnabled && !isHidden) {
			hideButton.style.display = "flex";
			// Small delay to ensure display is set first, then fade in
			setTimeout(() => {
				hideButton.style.opacity = "1";
				hideButton.style.visibility = "visible";
				hideButton.style.pointerEvents = "auto";
			}, 50);
		} else {
			// Hide UI button immediately when clicked - (couldn't get the fade to work)
			hideButton.style.display = "none";
			hideButton.style.opacity = "0";
			hideButton.style.visibility = "hidden";
			hideButton.style.pointerEvents = "none";
		}
	}
	if (unhideButton) {
		// Clear any existing auto-fade timeout
		if (unhideButtonAutoFadeTimeout != null) {
			window.clearTimeout(unhideButtonAutoFadeTimeout);
			unhideButtonAutoFadeTimeout = null;
		}

		if (settings.hideUIEnabled && isHidden) {
			unhideButton.style.display = "flex";
			// Remove the hide-immediately class and let it fade in smoothly
			unhideButton.classList.remove("hide-immediately");
			unhideButton.classList.remove("auto-faded");
			// Small delay to ensure display is set first, then fade in - (Works for unhide button.. but not hide button.. because uhh idk)
			setTimeout(() => {
				unhideButton.style.opacity = "1";
				unhideButton.style.visibility = "visible";
				unhideButton.style.pointerEvents = "auto";

				// Set up auto-fade after 2 seconds
				unhideButtonAutoFadeTimeout = safelySetAutoFadeTimeout(
					unhideButtonAutoFadeTimeout,
					() => {
						if (isHidden && unhideButton && !unhideButton.matches(":hover")) {
							unhideButton.classList.add("auto-faded");
						}
					},
					2000,
				);
			}, 50);
		} else {
			// Smooth fade out for Unhide UI button
			unhideButton.style.opacity = "0";
			unhideButton.style.visibility = "hidden";
			unhideButton.style.pointerEvents = "none";
			unhideButton.classList.remove("auto-faded");
			// Keep display: flex to maintain transitions, then hide after fade
			setTimeout(() => {
				if (unhideButton.style.opacity === "0") {
					unhideButton.style.display = "none";
				}
			}, 500); // Wait for transition to complete
		}
	}
};

// Toggle hide/unhide UI
const toggleRadiantLyrics = function (): void {
	const nowPlayingContainer = document.querySelector(
		'[class*="_nowPlayingContainer"]',
	) as HTMLElement;
	if (isHidden) {
		const unhideButton = document.querySelector(
			".unhide-ui-button",
		) as HTMLElement;
		if (unhideButton) unhideButton.classList.add("hide-immediately");
		isHidden = !isHidden;
		if (nowPlayingContainer)
			nowPlayingContainer.classList.remove("radiant-lyrics-ui-hidden");
		document.body.classList.remove("radiant-lyrics-ui-hidden");
		setTimeout(() => {
			if (!isHidden) {
				lyricsStyleTag.remove();
				playerBarStyleTag.remove();
			}
		}, 500);
		updateButtonStates();
	} else {
		isHidden = !isHidden;
		updateButtonStates();
		setTimeout(() => {
			updateRadiantLyricsStyles();
			if (nowPlayingContainer)
				nowPlayingContainer.classList.add("radiant-lyrics-ui-hidden");
			document.body.classList.add("radiant-lyrics-ui-hidden");
		}, 50);
	}
};

// Create buttons
const createHideUIButton = function (): void {
	setTimeout(() => {
		if (!settings.hideUIEnabled) return;
		const fullscreenButton = document.querySelector(
			'[data-test="request-fullscreen"]',
		);
		if (!fullscreenButton || !fullscreenButton.parentElement) {
			setTimeout(() => createHideUIButton(), 1000);
			return;
		}
		if (document.querySelector(".hide-ui-button")) return;
		const buttonContainer = fullscreenButton.parentElement;
		const hideUIButton = document.createElement("button");
		hideUIButton.className = "hide-ui-button";
		hideUIButton.setAttribute("aria-label", "Hide UI");
		hideUIButton.setAttribute("title", "Hide UI");
		hideUIButton.textContent = "Hide UI";
		hideUIButton.style.backgroundColor = "#ffffff";
		hideUIButton.style.color = "black";
		hideUIButton.style.border = "none";
		hideUIButton.style.borderRadius = "12px";
		hideUIButton.style.height = "40px";
		hideUIButton.style.padding = "0 12px";
		hideUIButton.style.marginLeft = "8px";
		hideUIButton.style.cursor = "pointer";
		hideUIButton.style.display = "flex";
		hideUIButton.style.alignItems = "center";
		hideUIButton.style.justifyContent = "center";
		hideUIButton.style.fontSize = "12px";
		hideUIButton.style.fontWeight = "600";
		hideUIButton.style.whiteSpace = "nowrap";
		hideUIButton.style.transition =
			"opacity 0.5s ease-in-out, visibility 0.5s ease-in-out, background-color 0.2s ease-in-out";
		hideUIButton.style.opacity = "0";
		hideUIButton.style.visibility = "hidden";
		hideUIButton.style.pointerEvents = "none";
		hideUIButton.addEventListener("mouseenter", () => {
			hideUIButton.style.backgroundColor = "#e5e5e5";
		});
		hideUIButton.addEventListener("mouseleave", () => {
			hideUIButton.style.backgroundColor = "#ffffff";
		});
		hideUIButton.onclick = toggleRadiantLyrics;
		buttonContainer.insertBefore(hideUIButton, fullscreenButton.nextSibling);
		setTimeout(() => {
			if (settings.hideUIEnabled && !isHidden) {
				hideUIButton.style.opacity = "1";
				hideUIButton.style.visibility = "visible";
				hideUIButton.style.pointerEvents = "auto";
			}
		}, 100);
	}, 1000);
};

const createUnhideUIButton = function (): void {
	setTimeout(() => {
		if (!settings.hideUIEnabled) return;
		if (document.querySelector(".unhide-ui-button")) return;
		const nowPlayingContainer = document.querySelector(
			'[class*="_nowPlayingContainer"]',
		) as HTMLElement;
		if (!nowPlayingContainer) {
			setTimeout(() => createUnhideUIButton(), 1000);
			return;
		}
		const unhideUIButton = document.createElement("button");
		unhideUIButton.className = "unhide-ui-button";
		unhideUIButton.setAttribute("aria-label", "Unhide UI");
		unhideUIButton.setAttribute("title", "Unhide UI");
		unhideUIButton.textContent = "Unhide";
		unhideUIButton.style.cssText = `position: absolute; top: 10px; right: 10px; background-color: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3); border-radius: 12px; height: 40px; padding: 0 12px; cursor: pointer; display: none; align-items: center; justify-content: center; transition: all 0.5s ease-in-out; font-size: 12px; font-weight: 600; white-space: nowrap; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); z-index: 1000; box-shadow: 0 4px 12px rgba(0,0,0,0.3); opacity: 0; visibility: hidden; pointer-events: none;`;
		unhideUIButton.addEventListener("mouseenter", () => {
			unhideUIButton.style.backgroundColor = "rgba(255,255,255,0.3)";
			unhideUIButton.style.transform = "scale(1.05)";
			unhideUIButton.classList.remove("auto-faded");
		});
		unhideUIButton.addEventListener("mouseleave", () => {
			unhideUIButton.style.backgroundColor = "rgba(255,255,255,0.2)";
			unhideUIButton.style.transform = "scale(1)";
			window.setTimeout(() => {
				if (isHidden && !unhideUIButton.matches(":hover")) {
					unhideUIButton.classList.add("auto-faded");
				}
			}, 2000);
		});
		unhideUIButton.onclick = toggleRadiantLyrics;
		nowPlayingContainer.appendChild(unhideUIButton);
		updateButtonStates();
	}, 1500);
};

// Marker: Background Rendering
// Variable setup
let globalSpinningBgStyleTag: StyleTag | null = null;
let globalBackgroundContainer: HTMLElement | null = null;
let globalBackgroundImage: HTMLImageElement | null = null;
let globalBlackBg: HTMLElement | null = null;
let globalGradientOverlay: HTMLElement | null = null;
let currentGlobalCoverSrc: string | null = null;
let lastUpdateTime = 0;
const getUpdateThrottle = () => (settings.performanceMode ? 1500 : 500);

// Now Playing background caching
let nowPlayingBackgroundContainer: HTMLElement | null = null;
let nowPlayingBackgroundImage: HTMLImageElement | null = null;
let nowPlayingBlackBg: HTMLElement | null = null;
let nowPlayingGradientOverlay: HTMLElement | null = null;
let currentNowPlayingCoverSrc: string | null = null;
let spinAnimationAdded = false;

// apply scaled pixel sizes to cover art
const applyScaledPixelSize = (img: HTMLImageElement | null): void => {
    if (!img) return;
    const scale = getScaledMultiplier();
    const apply = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (w > 0 && h > 0) {
            const wPx = Math.round(w * scale);
            const hPx = Math.round(h * scale);
            const wStr = `${wPx}px`;
            const hStr = `${hPx}px`;
            if (img.style.width !== wStr) img.style.width = wStr;
            if (img.style.height !== hStr) img.style.height = hStr;
        }
    };
    if (img.complete && img.naturalWidth > 0) {
        apply();
    } else {
        img.addEventListener("load", apply, { once: true });
    }
};

// Update Cover Art background for Now Playing and Global
function updateCoverArtBackground(method: number = 0): void {
	if (method === 1) {
		setTimeout(() => {
			updateCoverArtBackground();
			return;
		}, 2000);
	}

	let coverArtImageElement = document.querySelector(
		'figure[class*="_albumImage"] > div > div > div > img',
	) as HTMLImageElement;
	let coverArtImageSrc: string | null = null;

	if (coverArtImageElement) {
		coverArtImageSrc = coverArtImageElement.src;
		// Use higher resolution for better quality, but consider performance mode
		const targetRes = settings.performanceMode ? "640x640" : "1280x1280";
		coverArtImageSrc = coverArtImageSrc.replace(/\d+x\d+/, targetRes);
		if (coverArtImageElement.src !== coverArtImageSrc) {
			coverArtImageElement.src = coverArtImageSrc;
		}
	} else {
		const videoElement = document.querySelector(
			'figure[class*="_albumImage"] > div > div > div > video',
		) as HTMLVideoElement;
		if (videoElement) {
			coverArtImageSrc = videoElement.getAttribute("poster");
			if (coverArtImageSrc) {
				const targetRes = settings.performanceMode ? "640x640" : "1280x1280";
				coverArtImageSrc = coverArtImageSrc.replace(/\d+x\d+/, targetRes);
			}
		} else {
			cleanUpDynamicArt();
			return;
		}
	}

	// Update backgrounds when we have a valid cover art source
	if (coverArtImageSrc) {
		// Apply global spinning background if enabled
		if (settings.CoverEverywhere) {
			applyGlobalSpinningBackground(coverArtImageSrc);
		}

		// Apply spinning CoverArt background to the Now Playing container - OPTIMIZED
		const nowPlayingContainerElement = document.querySelector(
			'[class*="_nowPlayingContainer"]',
		) as HTMLElement;
		if (nowPlayingContainerElement) {
			// Create DOM structure if it doesn't exist (REUSE ELEMENTS)
			if (
				!nowPlayingBackgroundContainer ||
				!nowPlayingContainerElement.contains(nowPlayingBackgroundContainer)
			) {
				// Clean up any old elements first
				nowPlayingContainerElement
					.querySelectorAll(
						".now-playing-background-image, .now-playing-black-bg, .now-playing-gradient-overlay",
					)
					.forEach((el) => {
						el.remove();
					});

				// Create container
				nowPlayingBackgroundContainer = document.createElement("div");
				nowPlayingBackgroundContainer.className =
					"now-playing-background-container";
				nowPlayingBackgroundContainer.style.cssText = `
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                    height: 100%;
                    z-index: -3;
                    pointer-events: none;
                    overflow: hidden;
                `;
				nowPlayingContainerElement.appendChild(nowPlayingBackgroundContainer);

				// Create black background layer
				nowPlayingBlackBg = document.createElement("div");
				nowPlayingBlackBg.className = "now-playing-black-bg";
				nowPlayingBlackBg.style.cssText = `
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                    height: 100%;
                    background: #000;
                    z-index: -2;
                    pointer-events: none;
                `;
				nowPlayingBackgroundContainer.appendChild(nowPlayingBlackBg);

				// Create background image
				nowPlayingBackgroundImage = document.createElement("img");
				nowPlayingBackgroundImage.className = "now-playing-background-image";
				nowPlayingBackgroundImage.style.cssText = `
                    position: absolute;
                    left: 50%;
                    top: 50%;
                    transform: translate(-50%, -50%);
                    object-fit: cover;
                    z-index: -1;
                    transform-origin: center center;
                `;
				nowPlayingBackgroundContainer.appendChild(nowPlayingBackgroundImage);

				// Create gradient overlay
				nowPlayingGradientOverlay = document.createElement("div");
				nowPlayingGradientOverlay.className = "now-playing-gradient-overlay";
				nowPlayingGradientOverlay.style.cssText = `
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                    height: 100%;
                    background: radial-gradient(circle at center, transparent 0%, rgba(0, 0, 0, 0.3) 60%, rgba(0, 0, 0, 0.8) 90%);
                    z-index: -1;
                    pointer-events: none;
                `;
				nowPlayingBackgroundContainer.appendChild(nowPlayingGradientOverlay);
			}

			// Update image source efficiently
			if (
				nowPlayingBackgroundImage &&
				nowPlayingBackgroundImage.src !== coverArtImageSrc
			) {
				nowPlayingBackgroundImage.src = coverArtImageSrc;
				currentNowPlayingCoverSrc = coverArtImageSrc;
			}

			// Apply pixel-based size using intrinsic dimensions
			applyScaledPixelSize(nowPlayingBackgroundImage);

			// Apply performance-optimized settings (filter/animation); size handled above
			if (nowPlayingBackgroundImage) {
				if (settings.performanceMode) {
					// Performance mode with spinning enabled
					const blur = Math.min(settings.backgroundBlur, 20);
					const contrast = Math.min(settings.backgroundContrast, 150);
					const radiusPm = `${settings.backgroundRadius}%`;
					if (nowPlayingBackgroundImage.style.borderRadius !== radiusPm)
						nowPlayingBackgroundImage.style.borderRadius = radiusPm;
					const filt = `blur(${blur}px) brightness(${settings.backgroundBrightness / 100}) contrast(${contrast}%)`;
					if (nowPlayingBackgroundImage.style.filter !== filt)
						nowPlayingBackgroundImage.style.filter = filt;
					const anim = settings.spinningArt
						? `spin ${settings.spinSpeed}s linear infinite`
						: "none";
					const wc = settings.spinningArt ? "transform" : "auto";
					if (nowPlayingBackgroundImage.style.animation !== anim)
						nowPlayingBackgroundImage.style.animation = anim;
					if (nowPlayingBackgroundImage.style.willChange !== wc)
						nowPlayingBackgroundImage.style.willChange = wc;
					nowPlayingBackgroundImage.classList.remove("performance-mode-static");
				} else {
					// Normal mode
					const radiusNm = `${settings.backgroundRadius}%`;
					if (nowPlayingBackgroundImage.style.borderRadius !== radiusNm)
						nowPlayingBackgroundImage.style.borderRadius = radiusNm;
					const filt = `blur(${settings.backgroundBlur}px) brightness(${settings.backgroundBrightness / 100}) contrast(${settings.backgroundContrast}%)`;
					if (nowPlayingBackgroundImage.style.filter !== filt)
						nowPlayingBackgroundImage.style.filter = filt;
					const anim = settings.spinningArt
						? `spin ${settings.spinSpeed}s linear infinite`
						: "none";
					const wc = settings.spinningArt ? "transform" : "auto";
					if (nowPlayingBackgroundImage.style.animation !== anim)
						nowPlayingBackgroundImage.style.animation = anim;
					if (nowPlayingBackgroundImage.style.willChange !== wc)
						nowPlayingBackgroundImage.style.willChange = wc;
					nowPlayingBackgroundImage.classList.remove("performance-mode-static");
				}
			}

			// Add keyframe animation only once
			if (!spinAnimationAdded) {
				const styleSheet = document.createElement("style");
				styleSheet.id = "spinAnimation";
				styleSheet.textContent = `
                    @keyframes spin {
                        from { transform: translate(-50%, -50%) rotate(0deg); }
                        to { transform: translate(-50%, -50%) rotate(360deg); }
                    }
                `;
				document.head.appendChild(styleSheet);
				spinAnimationAdded = true;
			}
		}
	}
}

// Function to apply spinning background to the entire app (cover everywhere)
const applyGlobalSpinningBackground = (coverArtImageSrc: string): void => {
	const appContainer = document.querySelector(
		'[data-test="main"]',
	) as HTMLElement;

	if (!settings.CoverEverywhere) {
		cleanUpGlobalSpinningBackground();
		return;
	}

	// Only throttle image src updates; style updates below always run for responsiveness
	const now = Date.now();
	const shouldUpdateImageSrc =
		now - lastUpdateTime >= getUpdateThrottle() ||
		currentGlobalCoverSrc !== coverArtImageSrc;
	if (shouldUpdateImageSrc) {
		lastUpdateTime = now;
		currentGlobalCoverSrc = coverArtImageSrc;
	}

	// Add StyleTag if not present
	if (!globalSpinningBgStyleTag) {
		globalSpinningBgStyleTag = new StyleTag(
			"RadiantLyrics-global-spinning-bg",
			unloads,
			coverEverywhereCss,
		);
	}

	if (!appContainer) return;

	// Create container structure if it doesn't exist (REUSE DOM ELEMENTS)
	if (!globalBackgroundContainer) {
		globalBackgroundContainer = document.createElement("div");
		globalBackgroundContainer.className = "global-background-container";
		globalBackgroundContainer.style.cssText = `
            position: fixed;
            left: 0;
            top: 0;
            width: 100vw;
            height: 100vh;
            z-index: -3;
            pointer-events: none;
            overflow: hidden;
        `;
		appContainer.appendChild(globalBackgroundContainer);

		// Create black background layer
		globalBlackBg = document.createElement("div");
		globalBlackBg.className = "global-spinning-black-bg";
		globalBackgroundContainer.appendChild(globalBlackBg);

		// Create image element
		globalBackgroundImage = document.createElement("img");
		globalBackgroundImage.className = "global-spinning-image";
		globalBackgroundImage.style.cssText = `
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            object-fit: cover;
            z-index: -1;
            will-change: transform;
            transform-origin: center center;
        `;
		globalBackgroundContainer.appendChild(globalBackgroundImage);

		// Create gradient overlay
		globalGradientOverlay = document.createElement("div");
		globalGradientOverlay.className = "global-spinning-gradient-overlay";
		globalGradientOverlay.style.cssText = `
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background: radial-gradient(circle at center, transparent 0%, rgba(0, 0, 0, 0.3) 60%, rgba(0, 0, 0, 0.8) 90%);
            z-index: -1;
            pointer-events: none;
        `;
		globalBackgroundContainer.appendChild(globalGradientOverlay);
	}

	// Ensure gradient overlay exists even if container was pre-existing
	if (!globalGradientOverlay && globalBackgroundContainer) {
		globalGradientOverlay = document.createElement("div");
		globalGradientOverlay.className = "global-spinning-gradient-overlay";
		globalGradientOverlay.style.cssText = `
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background: radial-gradient(circle at center, transparent 0%, rgba(0, 0, 0, 0.3) 60%, rgba(0, 0, 0, 0.8) 90%);
            z-index: -1;
            pointer-events: none;
        `;
		globalBackgroundContainer.appendChild(globalGradientOverlay);
	}

	// Update image source efficiently (throttled)
	if (
		shouldUpdateImageSrc &&
		globalBackgroundImage &&
		globalBackgroundImage.src !== coverArtImageSrc
	) {
		globalBackgroundImage.src = coverArtImageSrc;
	}

	// Apply performance-optimized settings
	if (globalBackgroundImage) {
		// Pixel-based sizing based on intrinsic dimensions
		applyScaledPixelSize(globalBackgroundImage);
		const radius = `${settings.backgroundRadius}%`;
		// Performance mode optimizations
		if (settings.performanceMode) {
			// Performance mode with spinning enabled
			globalBackgroundImage.style.filter = `blur(${Math.min(settings.backgroundBlur, 20)}px) brightness(${settings.backgroundBrightness / 100}) contrast(${Math.min(settings.backgroundContrast, 150)}%)`;
			if (globalBackgroundImage.style.borderRadius !== radius)
				globalBackgroundImage.style.borderRadius = radius;
			// Do not apply radius to vignette overlay; matches Now Playing behavior
			if (settings.spinningArt) {
				globalBackgroundImage.style.animation = `spinGlobal ${settings.spinSpeed}s linear infinite`;
				globalBackgroundImage.style.willChange = "transform";
			} else {
				globalBackgroundImage.style.animation = "none";
				globalBackgroundImage.style.willChange = "auto";
			}
			globalBackgroundImage.classList.remove("performance-mode-static");
		} else {
			// Normal mode
			globalBackgroundImage.style.filter = `blur(${settings.backgroundBlur}px) brightness(${settings.backgroundBrightness / 100}) contrast(${settings.backgroundContrast}%)`;
			if (globalBackgroundImage.style.borderRadius !== radius)
				globalBackgroundImage.style.borderRadius = radius;
			// Do not apply radius to vignette overlay; matches Now Playing behavior
			if (settings.spinningArt) {
				globalBackgroundImage.style.animation = `spinGlobal ${settings.spinSpeed}s linear infinite`;
				globalBackgroundImage.style.willChange = "transform";
			} else {
				globalBackgroundImage.style.animation = "none";
				globalBackgroundImage.style.willChange = "auto";
			}
			globalBackgroundImage.classList.remove("performance-mode-static");
		}
	}
};

// cleanup function
const cleanUpGlobalSpinningBackground = function (): void {
	if (globalBackgroundContainer && globalBackgroundContainer.parentNode) {
		globalBackgroundContainer.parentNode.removeChild(globalBackgroundContainer);
	}
	globalBackgroundContainer = null;
	globalBackgroundImage = null;
	globalBlackBg = null;
	globalGradientOverlay = null;
	currentGlobalCoverSrc = null;

	if (globalSpinningBgStyleTag) {
		globalSpinningBgStyleTag.remove();
		globalSpinningBgStyleTag = null;
	}
};

// Function to update global background when settings change
const updateRadiantLyricsGlobalBackground = function (): void {
	// Apply performance mode class to document body
	if (settings.performanceMode) {
		document.body.classList.add("performance-mode");
	} else {
		document.body.classList.remove("performance-mode");
	}

	if (settings.CoverEverywhere) {
		// Get current cover art and apply global background
		updateCoverArtBackground();
	} else {
		cleanUpGlobalSpinningBackground();
	}
};

// Function to update Now Playing background when settings change
const updateRadiantLyricsNowPlayingBackground = function (): void {
	const nowPlayingBackgroundImages = document.querySelectorAll(
		".now-playing-background-image",
	);
	nowPlayingBackgroundImages.forEach((img: Element) => {
		const imgElement = img as HTMLImageElement;

		// Default values when settings don't affect Now Playing
		const defaultBlur = 80;
		const defaultBrightness = 40;
		const defaultContrast = 120;
		const defaultSpinSpeed = 45;

		let blur: number, brightness: number, contrast: number, spinSpeed: number;

		if (settings.settingsAffectNowPlaying) {
			blur = settings.backgroundBlur;
			brightness = settings.backgroundBrightness;
			contrast = settings.backgroundContrast;
			spinSpeed = settings.spinSpeed;
		} else {
			blur = defaultBlur;
			brightness = defaultBrightness;
			contrast = defaultContrast;
			spinSpeed = defaultSpinSpeed;
		}

		// Apply pixel-based size using intrinsic dimensions and current scale
		applyScaledPixelSize(imgElement);
		const radius = `${settings.backgroundRadius}%`;
		if (imgElement.style.borderRadius !== radius) imgElement.style.borderRadius = radius;

		// Performance mode optimizations
		if (settings.performanceMode) {
			// Reduce blur and effects for better performance, but keep spinning
			blur = Math.min(blur, 20);
			contrast = Math.min(contrast, 150);
			if (settings.spinningArt) {
				imgElement.style.animation = `spin ${spinSpeed}s linear infinite`;
				imgElement.style.willChange = "transform";
			} else {
				imgElement.style.animation = "none";
				imgElement.style.willChange = "auto";
			}
			imgElement.classList.remove("performance-mode-static");
		} else {
			if (settings.spinningArt) {
				imgElement.style.animation = `spin ${spinSpeed}s linear infinite`;
				imgElement.style.willChange = "transform";
			} else {
				imgElement.style.animation = "none";
				imgElement.style.willChange = "auto";
			}
			imgElement.classList.remove("performance-mode-static");
		}

		imgElement.style.filter = `blur(${blur}px) brightness(${brightness / 100}) contrast(${contrast}%)`;
	});
};

// Make these functions available globally so Settings can call them
(window as any).updateRadiantLyricsStyles = updateRadiantLyricsStyles;
(window as any).updateRadiantLyricsGlobalBackground =
	updateRadiantLyricsGlobalBackground;
(window as any).updateRadiantLyricsNowPlayingBackground =
	updateRadiantLyricsNowPlayingBackground;
(window as any).updateRadiantLyricsTextGlow = updateRadiantLyricsTextGlow;

const cleanUpDynamicArt = function (): void {
	// Clean up cached Now Playing elements
	if (
		nowPlayingBackgroundContainer &&
		nowPlayingBackgroundContainer.parentNode
	) {
		nowPlayingBackgroundContainer.parentNode.removeChild(
			nowPlayingBackgroundContainer,
		);
	}
	nowPlayingBackgroundContainer = null;
	nowPlayingBackgroundImage = null;
	nowPlayingBlackBg = null;
	nowPlayingGradientOverlay = null;
	currentNowPlayingCoverSrc = null;

	// Clean up any remaining elements (fallback)
	const nowPlayingBackgroundImages = document.getElementsByClassName(
		"now-playing-background-image",
	);
	Array.from(nowPlayingBackgroundImages).forEach((element) => {
		element.remove();
	});

	// Also clean up global spinning backgrounds
	cleanUpGlobalSpinningBackground();
};

// Reduce work when tab hidden: pause animations; restore on visible
document.addEventListener("visibilitychange", () => {
	const isHiddenDoc = document.hidden;
	const images = document.querySelectorAll(
		".global-spinning-image, .now-playing-background-image",
	);
	images.forEach((img) => {
		const el = img as HTMLElement;
		if (isHiddenDoc) {
			// Pause animation but keep state
			if (el.style.animationPlayState !== "paused")
				el.style.animationPlayState = "paused";
			if (el.style.willChange !== "auto") el.style.willChange = "auto";
		} else {
			if (el.style.animationPlayState !== "running")
				el.style.animationPlayState = "running";
			if (
				el.classList.contains("global-spinning-image") ||
				el.classList.contains("now-playing-background-image")
			) {
				if (el.style.willChange !== "transform")
					el.style.willChange = "transform";
			}
		}
	});
});

// Apply initial performance mode class
if (settings.performanceMode) {
	document.body.classList.add("performance-mode");
}

// Initialize text glow CSS variables on load
updateRadiantLyricsTextGlow();

updateCoverArtBackground(1);

// Add cleanup to unloads
unloads.add(() => {
	cleanUpDynamicArt();

	// Clean up auto-fade timeout
	if (unhideButtonAutoFadeTimeout != null) {
		window.clearTimeout(unhideButtonAutoFadeTimeout);
		unhideButtonAutoFadeTimeout = null;
	}

	// Clean up our custom buttons
	const hideButton = document.querySelector(".hide-ui-button");
	if (hideButton && hideButton.parentNode) {
		hideButton.parentNode.removeChild(hideButton);
	}

	const unhideButton = document.querySelector(".unhide-ui-button");
	if (unhideButton && unhideButton.parentNode) {
		unhideButton.parentNode.removeChild(unhideButton);
	}

	// Clean up spin animations
	const spinAnimationStyle = document.querySelector("#spinAnimation");
	if (spinAnimationStyle && spinAnimationStyle.parentNode) {
		spinAnimationStyle.parentNode.removeChild(spinAnimationStyle);
	}

	// Clean up global spinning backgrounds
	cleanUpGlobalSpinningBackground();
});

// Marker: Observers
// Shared observer-based hooks and polling fallbacks
const observeTrackChanges = (): void => {
	let lastTrackId: string | null = null;
	let checkCount = 0;
	let currentInterval = 500;
	const checkTrackChange = () => {
		const currentTrackId = PlayState.playbackContext?.actualProductId;
		if (currentTrackId && currentTrackId !== lastTrackId) {
			lastTrackId = currentTrackId;
			updateCoverArtBackground();
			checkCount = 0;
			currentInterval = 250;
		}
		checkCount++;
		if (checkCount > 10 && currentInterval < 1000)
			currentInterval = Math.min(currentInterval * 1.2, 1000);
	};
	const intervalId = setInterval(() => checkTrackChange(), currentInterval);
	unloads.add(() => clearInterval(intervalId));
	const currentTrackId = PlayState.playbackContext?.actualProductId;
	if (currentTrackId) {
		lastTrackId = currentTrackId;
		setTimeout(() => updateCoverArtBackground(), 100);
	}
};

function setupHeaderObserver(): void {
	const existing = document.querySelector('[data-test="header-container"]');
	if (existing && !document.querySelector(".hide-ui-button"))
		createHideUIButton();
	observe<HTMLElement>(unloads, '[data-test="header-container"]', () => {
		if (!document.querySelector(".hide-ui-button")) createHideUIButton();
	});
}

function setupNowPlayingObserver(): void {
	const existing = document.querySelector('[class*="_nowPlayingContainer"]');
	if (existing && !document.querySelector(".unhide-ui-button"))
		createUnhideUIButton();
	observe<HTMLElement>(unloads, '[class*="_nowPlayingContainer"]', () => {
		if (!document.querySelector(".unhide-ui-button")) createUnhideUIButton();
	});
}

function setupTrackTitleObserver(): void {
	const trackTitleEl = document.querySelector(
		'[data-test="now-playing-track-title"]',
	) as HTMLElement | null;
	if (trackTitleEl) {
		if (settings.trackTitleGlow && settings.lyricsGlowEnabled) {
			trackTitleEl.classList.remove("rl-title-glow-disabled");
		} else {
			trackTitleEl.classList.add("rl-title-glow-disabled");
		}
	}
	observe<HTMLElement>(
		unloads,
		'[data-test="now-playing-track-title"]',
		(el) => {
			if (!el) return;
			if (settings.trackTitleGlow && settings.lyricsGlowEnabled) {
				el.classList.remove("rl-title-glow-disabled");
			} else {
				el.classList.add("rl-title-glow-disabled");
			}
		},
	);
}

// Initialize the button creation and observers (non-polling)
setupHeaderObserver();
setupNowPlayingObserver();
setupTrackTitleObserver();
observeTrackChanges();
