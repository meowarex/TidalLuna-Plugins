// MARKER: Core Setup
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
import floatingPlayerBarCss from "file://floating-player-bar.css?minify";

// Core tracer and exports
export const { trace } = Tracer("[Radiant Lyrics]");
export { Settings };

// clean up resources
export const unloads = new Set<LunaUnload>();

// StyleTag instances for different CSS modules
const lyricsStyleTag = new StyleTag("RadiantLyrics-lyrics", unloads);
const baseStyleTag = new StyleTag("RadiantLyrics-base", unloads);
const playerBarStyleTag = new StyleTag("RadiantLyrics-player-bar", unloads);
const lyricsGlowStyleTag = new StyleTag("RadiantLyrics-lyrics-glow", unloads);
const floatingPlayerBarStyleTag = new StyleTag("RadiantLyrics-floating-player-bar", unloads);

// Apply lyrics glow styles if enabled
if (settings.lyricsGlowEnabled) {
	lyricsGlowStyleTag.css = lyricsGlow;
}

// MARKER: Floating Player Bar

// Hex color to RGB
// (i'm deranged and love Hexadecimal)
const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
	let cleaned = (hex || "#000000").replace("#", "");
	if (cleaned.length === 3) {
		cleaned = cleaned[0] + cleaned[0] + cleaned[1] + cleaned[1] + cleaned[2] + cleaned[2];
	}
	if (cleaned.length !== 6) {
		return { r: 0, g: 0, b: 0 };
	}
	return {
		r: parseInt(cleaned.substring(0, 2), 16) || 0,
		g: parseInt(cleaned.substring(2, 4), 16) || 0,
		b: parseInt(cleaned.substring(4, 6), 16) || 0,
	};
};

// Apply Settings to Floating Player Bar using inline styles because idk.. CSS is hard (Change my mind!)
const applyPlayerBarTintToElement = (): void => {
	const footerPlayer = document.querySelector('[data-test="footer-player"]') as HTMLElement;
	if (!footerPlayer) return;
	// Always apply tint regardless of floating state
	const alpha = settings.playerBarTint / 10;
	const { r, g, b } = hexToRgb(settings.playerBarTintColor);
	footerPlayer.style.setProperty("background-color", `rgba(${r}, ${g}, ${b}, ${alpha})`, "important");
	if (settings.floatingPlayerBar) {
		footerPlayer.style.setProperty("border-radius", `${settings.playerBarRadius}px`, "important");
		const spacing = settings.playerBarSpacing;
		footerPlayer.style.setProperty("bottom", `${spacing}px`, "important");
		footerPlayer.style.setProperty("left", `${spacing}px`, "important");
		footerPlayer.style.setProperty("width", `calc(100% - ${spacing * 2}px)`, "important");
	} else {
		footerPlayer.style.removeProperty("border-radius");
		footerPlayer.style.removeProperty("bottom");
		footerPlayer.style.removeProperty("left");
		footerPlayer.style.removeProperty("width");
	}
};

// Apply/update the floating player bar stylesheet + tint
const applyFloatingPlayerBar = (): void => {
	if (settings.floatingPlayerBar) {
		floatingPlayerBarStyleTag.css = floatingPlayerBarCss;
	} else {
		floatingPlayerBarStyleTag.remove();
	}
	applyPlayerBarTintToElement();
};

// Alias for settings callback
const updateRadiantLyricsPlayerBarTint = applyFloatingPlayerBar;

// Apply floating player bar styles if enabled
if (settings.floatingPlayerBar) {
	floatingPlayerBarStyleTag.css = floatingPlayerBarCss;
}

// Apply Tint and Observe in case doesn't exist yet (ik this isnt the best way to do it but.. make a PR i dare ya!)
applyPlayerBarTintToElement();
observe<HTMLElement>(unloads, '[data-test="footer-player"]', () => {
	applyPlayerBarTintToElement();
});

// MARKER: Quality-Based Seeker Color
// Colors for the quality tier (Max, High, Low)
const qualityColors: Record<string, string> = {
	Max: "#ffd432",
	High: "#3fe",
	Low: "#FFFFFF",
};

const applyQualityProgressColor = (): void => {
	const progressIndicator = document.querySelector(
		'[data-test="progress-indicator"]',
	) as HTMLElement | null;
	if (!progressIndicator) return;

	// Reset to white (for when the setting gets disabled)
	if (!settings.qualityProgressColor) {
		progressIndicator.style.setProperty("background-color", "#FFFFFF", "important");
		return;
	}

	// get the media-state tag (Max, High, Low)
	const qualityButton = document.querySelector(
		'[data-test="media-state-max"], [data-test="media-state-high"], [data-test="media-state-low"]',
	) as HTMLElement | null;
	if (!qualityButton) return;

	const qualityText = qualityButton.textContent?.trim() ?? "";
	const color = qualityColors[qualityText];
	if (!color) return;

	progressIndicator.style.setProperty("background-color", color, "important");
};

// Called Settings
const updateQualityProgressColor = (): void => {
	applyQualityProgressColor();
};

function setupQualityProgressObserver(): void {
	// Apply on load (uses observeTrackChanges instead of polling yay me <3)
	if (settings.qualityProgressColor) {
		applyQualityProgressColor();
	}
}

// Apply base styles always (I kinda dont really remember what this does but it's important i guess)
baseStyleTag.css = baseStyles;

// Update CSS variables for lyrics text glow based on settings
const updateRadiantLyricsTextGlow = function (): void {
	const root = document.documentElement;
	root.style.setProperty("--rl-glow-outer", `${settings.textGlow}px`);
	root.style.setProperty("--rl-glow-inner", "2px");
};

// Function to update styles when settings change
const updateRadiantLyricsStyles = function (): void {
	// Handle Player Bar Visibility
	if (isHidden) {
		if (!settings.playerBarVisible) {
			playerBarStyleTag.css = playerBarHidden;
		} else {
			playerBarStyleTag.remove();
		}
	} else {
		playerBarStyleTag.remove();
	}

	// Handle Floating Player Bar
	applyFloatingPlayerBar();

	// Update lyrics glow based on setting (Always apply if enabled, even when UI is hidden)
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

// MARKER: UI Visibility Control
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
				updateRadiantLyricsStyles();
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

// MARKER: Background Rendering
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
(window as any).updateRadiantLyricsPlayerBarTint = updateRadiantLyricsPlayerBarTint;
(window as any).updateQualityProgressColor = updateQualityProgressColor;

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

	// Clean up spinning background
	cleanUpGlobalSpinningBackground();
};

// I may or may not have forgotten what this does..
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

// Init performance mode
if (settings.performanceMode) {
	document.body.classList.add("performance-mode");
}

// Init text glow
updateRadiantLyricsTextGlow();

// Init global background
updateCoverArtBackground(1);

// Cleanups
unloads.add(() => {
	cleanUpDynamicArt();

	// Clean up floating player bar inline styles
	const footerPlayer = document.querySelector('[data-test="footer-player"]') as HTMLElement;
	if (footerPlayer) {
		footerPlayer.style.removeProperty("background-color");
		footerPlayer.style.removeProperty("border-radius");
		footerPlayer.style.removeProperty("bottom");
		footerPlayer.style.removeProperty("left");
		footerPlayer.style.removeProperty("width");
	}

	// Clean up HideUI button auto-fade timeout
	if (unhideButtonAutoFadeTimeout != null) {
		window.clearTimeout(unhideButtonAutoFadeTimeout);
		unhideButtonAutoFadeTimeout = null;
	}

	// Clean up HideUI button
	const hideButton = document.querySelector(".hide-ui-button");
	if (hideButton && hideButton.parentNode) {
		hideButton.parentNode.removeChild(hideButton);
	}

	const unhideButton = document.querySelector(".unhide-ui-button");
	if (unhideButton && unhideButton.parentNode) {
		unhideButton.parentNode.removeChild(unhideButton);
	}

	// Clean up sticky lyrics elements
	document.querySelectorAll(".sticky-lyrics-trigger, .sticky-lyrics-dropdown").forEach((el) => {
		el.remove();
	});

	// Clean up spin animations
	const spinAnimationStyle = document.querySelector("#spinAnimation");
	if (spinAnimationStyle && spinAnimationStyle.parentNode) {
		spinAnimationStyle.parentNode.removeChild(spinAnimationStyle);
	}

	// Clean up spinning background
	cleanUpGlobalSpinningBackground();
});


// MARKER: Sticky Lyrics Feature

const STICKY_ICONS: Record<string, string> = {
	chevron: '<svg viewBox="0 0 24 24" width="10" height="10" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M4.29289 8.29289C4.68342 7.90237 5.31658 7.90237 5.70711 8.29289L12 14.5858L18.2929 8.29289C18.6834 7.90237 19.3166 7.90237 19.7071 8.29289C20.0976 8.68342 20.0976 9.31658 19.7071 9.70711L12.7071 16.7071C12.3166 17.0976 11.6834 17.0976 11.2929 16.7071L4.29289 9.70711C3.90237 9.31658 3.90237 8.68342 4.29289 8.29289Z" fill="currentColor"/></svg>',
	sparkle: '<svg viewBox="0 0 512 512" width="12" height="12"><path fill="currentColor" d="M208,512a24.84,24.84,0,0,1-23.34-16l-39.84-103.6a16.06,16.06,0,0,0-9.19-9.19L32,343.34a25,25,0,0,1,0-46.68l103.6-39.84a16.06,16.06,0,0,0,9.19-9.19L184.66,144a25,25,0,0,1,46.68,0l39.84,103.6a16.06,16.06,0,0,0,9.19,9.19l103,39.63A25.49,25.49,0,0,1,400,320.52a24.82,24.82,0,0,1-16,22.82l-103.6,39.84a16.06,16.06,0,0,0-9.19,9.19L231.34,496A24.84,24.84,0,0,1,208,512Zm66.85-254.84h0Z"/><path fill="currentColor" d="M88,176a14.67,14.67,0,0,1-13.69-9.4L57.45,122.76a7.28,7.28,0,0,0-4.21-4.21L9.4,101.69a14.67,14.67,0,0,1,0-27.38L53.24,57.45a7.31,7.31,0,0,0,4.21-4.21L74.16,9.79A15,15,0,0,1,86.23.11,14.67,14.67,0,0,1,101.69,9.4l16.86,43.84a7.31,7.31,0,0,0,4.21,4.21L166.6,74.31a14.67,14.67,0,0,1,0,27.38l-43.84,16.86a7.28,7.28,0,0,0-4.21,4.21L101.69,166.6A14.67,14.67,0,0,1,88,176Z"/><path fill="currentColor" d="M400,256a16,16,0,0,1-14.93-10.26l-22.84-59.37a8,8,0,0,0-4.6-4.6l-59.37-22.84a16,16,0,0,1,0-29.86l59.37-22.84a8,8,0,0,0,4.6-4.6L384.9,42.68a16.45,16.45,0,0,1,13.17-10.57,16,16,0,0,1,16.86,10.15l22.84,59.37a8,8,0,0,0,4.6,4.6l59.37,22.84a16,16,0,0,1,0,29.86l-59.37,22.84a8,8,0,0,0-4.6,4.6l-22.84,59.37A16,16,0,0,1,400,256Z"/></svg>',
};

const getStickyIcon = (): string => STICKY_ICONS[settings.stickyLyricsIcon] ?? STICKY_ICONS.chevron;

const applyStickyIcon = (): void => {
	const trigger = document.querySelector(".sticky-lyrics-trigger") as HTMLElement;
	if (!trigger) return;
	trigger.innerHTML = getStickyIcon();
	trigger.style.paddingLeft = settings.stickyLyricsIcon === "sparkle" ? "5px" : "5px";
};

// Console: StickyLyrics.icon = "sparkle" or "chevron"
// I'm picky and prefer the Sparkle.. shhh
(window as any).StickyLyrics = {
	get icon() { return settings.stickyLyricsIcon; },
	set icon(value: string) {
		const key = value.toLowerCase();
		if (!STICKY_ICONS[key]) {
			console.log(`[Radiant Lyrics] Unknown icon "${value}". Available: ${Object.keys(STICKY_ICONS).join(", ")}`);
			return;
		}
		settings.stickyLyricsIcon = key;
		applyStickyIcon();
		console.log(`[Radiant Lyrics] Sticky Lyrics icon set to "${key}"`);
	},
};

// Tear down all sticky lyrics UI (trigger + dropdown + classes)
// For when the feature is disabled in plugin settings
const teardownStickyLyrics = (): void => {
	document.querySelectorAll(".sticky-lyrics-trigger").forEach((el) => el.remove());
	document.querySelectorAll(".sticky-lyrics-dropdown").forEach((el) => el.remove());
	const lyricsTab = document.querySelector('[data-test="tabs-lyrics"]');
	if (lyricsTab) lyricsTab.classList.remove("sticky-lyrics-open");
};

// Called from Settings
const updateStickyLyricsFeature = (): void => {
	if (settings.stickyLyricsFeature) {
		// Feature enabled - inject the dropdown
		const tab = document.querySelector('[data-test="tabs-lyrics"]');
		if (tab && !tab.querySelector(".sticky-lyrics-trigger")) {
			createStickyLyricsDropdown();
		}
	} else {
		// Feature disabled — remove everything & disable inner toggle
		settings.stickyLyrics = false;
		teardownStickyLyrics();
	}
};
(window as any).updateStickyLyricsFeature = updateStickyLyricsFeature;

const createStickyLyricsDropdown = (): void => {
	if (!settings.stickyLyricsFeature) return;
	const lyricsTab = document.querySelector(
		'[data-test="tabs-lyrics"]',
	) as HTMLElement;
	if (!lyricsTab) return;
	if (lyricsTab.querySelector(".sticky-lyrics-trigger")) return;

	// Trigger
	// lives inside the Lyrics <li>
	const trigger = document.createElement("div");
	trigger.className = "sticky-lyrics-trigger";
	trigger.setAttribute("title", "Sticky Lyrics");

	// Set the icon & it's styling
	// is only needed because i'm picky and prefer the Sparkle.. shhh
	trigger.innerHTML = getStickyIcon();
	//trigger.style.paddingLeft = settings.stickyLyricsIcon === "sparkle" ? "5px" : "5px";

	// Block non-click events on trigger from reaching the Lyrics tab (capture phase)
	// (capture phase stops the tab from activating & runs the toggle before the event is consumed by the SVG child) - Thx React.. again..
	for (const evtName of ["pointerdown", "pointerup", "mousedown", "mouseup"] as const) {
		trigger.addEventListener(evtName, (e: Event) => {
			e.stopPropagation();
		}, true);
	}

	// Dropdown 
	// lives in document.body so its events never touch the Lyrics tab - Thx React..
	const dropdown = document.createElement("div");
	dropdown.className = "sticky-lyrics-dropdown";
	dropdown.style.display = "none";

	dropdown.innerHTML = `
		<div class="sticky-lyrics-dropdown-row">
			<span class="sticky-lyrics-label">Sticky Lyrics</span>
			<label class="sticky-lyrics-switch">
				<input type="checkbox" ${settings.stickyLyrics ? "checked" : ""}>
				<span class="sticky-lyrics-slider"></span>
			</label>
		</div>
	`;

	// Toggle dropdown on trigger click 
	const openDropdown = (): void => {
		const buttonRect = lyricsTab.getBoundingClientRect();
		dropdown.style.top = `${buttonRect.bottom}px`;
		dropdown.style.left = `${buttonRect.left}px`;
		dropdown.style.width = `${buttonRect.width}px`;
		dropdown.style.display = "block";
		lyricsTab.classList.add("sticky-lyrics-open");
	};
	const closeDropdown = (): void => {
		dropdown.style.display = "none";
		lyricsTab.classList.remove("sticky-lyrics-open");
	};

	trigger.addEventListener("click", (e: MouseEvent) => {
		e.stopPropagation();
		const isActive = lyricsTab.getAttribute("aria-selected") === "true";
		if (!isActive) {
			// Navigate to Lyrics & open dropdown
			lyricsTab.click();
			// Delay to let the tab activate
			setTimeout(() => openDropdown(), 150);
			return;
		}
		// Toggle dropdown
		if (dropdown.style.display === "none") {
			openDropdown();
		} else {
			closeDropdown();
		}
	}, true);

	// Handle toggle switch change
	const checkbox = dropdown.querySelector(
		'input[type="checkbox"]',
	) as HTMLInputElement;
	checkbox.addEventListener("change", () => {
		settings.stickyLyrics = checkbox.checked;
		if (settings.stickyLyrics) {
			handleStickyLyricsTrackChange();
		}
	});

	// Close dropdown when clicking outside trigger & dropdown
	const handleOutsideClick = (e: MouseEvent): void => {
		if (!trigger.contains(e.target as Node) && !dropdown.contains(e.target as Node)) {
			closeDropdown();
		}
	};
	document.addEventListener("click", handleOutsideClick);

	// Trigger goes inside the Lyrics <li> & dropdown goes in <body>
	lyricsTab.appendChild(trigger);
	document.body.appendChild(dropdown);

	// Register cleanup
	unloads.add(() => {
		document.removeEventListener("click", handleOutsideClick);
		lyricsTab.classList.remove("sticky-lyrics-open");
		trigger.remove();
		dropdown.remove();
	});
};

// Handle switching tabs on track change
const handleStickyLyricsTrackChange = (): void => {
	if (!settings.stickyLyricsFeature || !settings.stickyLyrics) return;

	// Process the track change and update tab state
	// Tidal takes a while to process the track change sometimes :(
	setTimeout(() => {
		if (!settings.stickyLyricsFeature || !settings.stickyLyrics) return;

		const lyricsTab = document.querySelector(
			'[data-test="tabs-lyrics"]',
		) as HTMLElement;
		const playQueueTab = document.querySelector(
			'[data-test="tabs-play-queue"]',
		) as HTMLElement;

		if (!lyricsTab) {
			// fall back to play queue
			if (playQueueTab) playQueueTab.click();
			return;
		}

		// Attempt to switch to lyrics
		lyricsTab.click();

		// Verify we actually stayed on lyrics after a short delay
		// TODO: Make not shitty (one day maybe)
		setTimeout(() => {
			if (!settings.stickyLyrics) return;
			const onLyrics = document.querySelector(
				'[data-test="tabs-lyrics"][aria-selected="true"]',
			);
			if (!onLyrics && playQueueTab) {
				// Got redirected away from lyrics - fall back to play queue
				playQueueTab.click();
			}
		}, 800);
	}, 1200);
};

// Observer: create dropdown when lyrics tab appears & detect track changes
function setupStickyLyricsObserver(): void {
	// Create dropdown if lyrics tab already exists
	if (settings.stickyLyricsFeature) {
		const existing = document.querySelector('[data-test="tabs-lyrics"]');
		if (existing && !existing.querySelector(".sticky-lyrics-trigger")) {
			createStickyLyricsDropdown();
		}
	}

	// Re-create dropdown whenever lyrics tab is back from the ether
	observe<HTMLElement>(unloads, '[data-test="tabs-lyrics"]', () => {
		if (!settings.stickyLyricsFeature) return;
		const tab = document.querySelector('[data-test="tabs-lyrics"]');
		if (tab && !tab.querySelector(".sticky-lyrics-trigger")) {
			createStickyLyricsDropdown();
		}
	});

	// Detect track changes & trigger sticky lyrics switching
	let stickyLastTrackId: string | null =
		PlayState.playbackContext?.actualProductId ?? null;
	const checkStickyTrackChange = (): void => {
		if (!settings.stickyLyricsFeature || !settings.stickyLyrics) return;
		const currentTrackId = PlayState.playbackContext?.actualProductId;
		if (currentTrackId && currentTrackId !== stickyLastTrackId) {
			stickyLastTrackId = currentTrackId;
			handleStickyLyricsTrackChange();
		}
	};
	const stickyIntervalId = setInterval(checkStickyTrackChange, 500);
	unloads.add(() => clearInterval(stickyIntervalId));
}

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
			if (settings.qualityProgressColor) applyQualityProgressColor();
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
		if (settings.qualityProgressColor) setTimeout(() => applyQualityProgressColor(), 100);
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

// Init observers
setupHeaderObserver();
setupNowPlayingObserver();
setupTrackTitleObserver();
observeTrackChanges();
setupStickyLyricsObserver();
setupQualityProgressObserver();
