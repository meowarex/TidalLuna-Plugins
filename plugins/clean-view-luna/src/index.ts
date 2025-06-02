import { ftch, LunaUnload, Tracer } from "@luna/core";
import { settings, Settings } from "./Settings";

// Import CSS directly using Luna's file:// syntax
import styles from "file://styles.css?minify";

export const { trace } = Tracer("[Clean View]");
export { Settings };

// clean up resources
export const unloads = new Set<LunaUnload>();

const themeUrl =
	"https://raw.githubusercontent.com/itzzexcel/neptune-projects/refs/heads/main/plugins/plugins/not-actual-fullscreen/src/separated-lyrics.css";

function ApplyCSS(style: string): HTMLStyleElement {
	const styleElement = document.createElement("style");
	styleElement.type = "text/css";
	styleElement.textContent = style;
	document.head.appendChild(styleElement);
	return styleElement;
}

async function HttpGet(url: string): Promise<string | null> {
	try {
		const content = await ftch.text(url);
		return content;
	} catch (error) {
		trace.msg.err(`Failed to fetch URL: ${error instanceof Error ? error.message : String(error)}`);
		return null;
	}
}

var isCleanView = false;
var appliedStyle: HTMLStyleElement | null = null;
var currentTrackSrc: string | null = null; // Track current album art to prevent unnecessary updates

const updateButtonStates = function (): void {
	const hideButton = document.querySelector(".hide-ui-button") as HTMLElement;
	const unhideButton = document.querySelector(".unhide-ui-button") as HTMLElement;

	if (hideButton) {
		hideButton.style.display = settings.hideUIEnabled && !isCleanView ? "flex" : "none";
	}
	if (unhideButton) {
		unhideButton.style.display = settings.hideUIEnabled && isCleanView ? "flex" : "none";
	}
};

// Function to get dynamic styles including player bar visibility
const getDynamicStyles = function (): string {
	let dynamicStyles = styles;

	// Add player bar hiding with hover reveal if setting is disabled
	if (!settings.playerBarVisible) {
		dynamicStyles += `
/* Hide player bar when setting is disabled, but show on hover */
[data-test="footer-player"] {
    opacity: 0 !important;
    transition: opacity 0.3s ease-in-out !important;
    pointer-events: auto !important;
}

[data-test="footer-player"]:hover {
    opacity: 1 !important;
}

/* Also show player bar when hovering over the bottom area */
body:has([data-test="footer-player"]:hover) [data-test="footer-player"],
body [data-test="footer-player"]:hover {
    opacity: 1 !important;
}
`;
	}

	return dynamicStyles;
};

// Function to update styles when settings change
const updateCleanViewStyles = function (): void {
	if (isCleanView && appliedStyle) {
		// Remove old styles and apply new ones with updated settings
		appliedStyle.remove();
		appliedStyle = ApplyCSS(getDynamicStyles());
	}
};

// Make this function available globally so Settings can call it
(window as any).updateCleanViewStyles = updateCleanViewStyles;

const toggleCleanView = function (): void {
	if (isCleanView) {
		if (appliedStyle) {
			appliedStyle.remove();
			appliedStyle = null;
		}
	} else {
		appliedStyle = ApplyCSS(getDynamicStyles());
		// Debug: Log bottom-left buttons to help identify selectors
		//debugBottomLeftButtons();
	}
	isCleanView = !isCleanView;
	updateButtonStates();
};

// const debugBottomLeftButtons = function(): void {
//     setTimeout(() => {
//         const nowPlayingContainer = document.querySelector('[class*="_nowPlayingContainer"]');
//         if (nowPlayingContainer) {
//             const buttons = nowPlayingContainer.querySelectorAll('button');
//             //trace.msg.log(`Found ${buttons.length} buttons in now playing container:`);
//             buttons.forEach((button, index) => {
//                 const classes = button.className;
//                 const dataTest = button.getAttribute('data-test');
//                 const title = button.getAttribute('title');
//                 const ariaLabel = button.getAttribute('aria-label');
//                 //trace.msg.log(`Button ${index}: classes="${classes}", data-test="${dataTest}", title="${title}", aria-label="${ariaLabel}"`);
//             });
//         }
//     }, 1000);
// };

const createHideUIButton = function (): void {
	setTimeout(() => {
		// Only create button if Hide UI is enabled in settings
		if (!settings.hideUIEnabled) return;

		// Look for the fullscreen button's parent container
		const fullscreenButton = document.querySelector('[data-test="request-fullscreen"]');
		if (!fullscreenButton || !fullscreenButton.parentElement) {
			// Retry if fullscreen button not found yet
			setTimeout(() => createHideUIButton(), 1000);
			return;
		}

		// Check if our button already exists
		if (document.querySelector(".hide-ui-button")) return;

		const buttonContainer = fullscreenButton.parentElement;

		// Create our hide UI button
		const hideUIButton = document.createElement("button");
		hideUIButton.className = "hide-ui-button";
		hideUIButton.setAttribute("aria-label", "Hide UI");
		hideUIButton.setAttribute("title", "Hide UI");
		hideUIButton.textContent = "Hide UI";

		// Style to match Tidal's buttons
		hideUIButton.style.cssText = `
            background-color: var(--wave-color-solid-accent-fill);
            color: black;
            border: none;
            border-radius: 12px;
            height: 40px;
            padding: 0 12px;
            margin-left: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background-color 0.2s ease;
            font-size: 12px;
            font-weight: 600;
            white-space: nowrap;
        `;

		// Add hover effect
		hideUIButton.addEventListener("mouseenter", () => {
			hideUIButton.style.backgroundColor = "lightgray";
		});

		hideUIButton.addEventListener("mouseleave", () => {
			hideUIButton.style.backgroundColor = "var(--wave-color-solid-accent-fill)";
		});

		hideUIButton.onclick = toggleCleanView;

		// Insert after the fullscreen button
		buttonContainer.insertBefore(hideUIButton, fullscreenButton.nextSibling);

		//trace.msg.log("Hide UI button added next to fullscreen button");
		updateButtonStates();
	}, 1000);
};

const createUnhideUIButton = function (): void {
	setTimeout(() => {
		// Only create button if Hide UI is enabled in settings
		if (!settings.hideUIEnabled) return;

		// Check if our button already exists
		if (document.querySelector(".unhide-ui-button")) return;

		// Create our unhide UI button and position it on the left side above player
		const unhideUIButton = document.createElement("button");
		unhideUIButton.className = "unhide-ui-button";
		unhideUIButton.setAttribute("aria-label", "Unhide UI");
		unhideUIButton.setAttribute("title", "Unhide UI");
		unhideUIButton.textContent = "Unhide";

		// Style for bottom-left positioning with blur and transparency
		unhideUIButton.style.cssText = `
            position: fixed;
            bottom: 120px;
            left: 20px;
            background-color: rgba(255, 255, 255, 0.2);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 12px;
            height: 50px;
            padding: 0 16px;
            cursor: pointer;
            display: none;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
            font-size: 14px;
            font-weight: 600;
            white-space: nowrap;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            z-index: 9999;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;

		// Add hover effect
		unhideUIButton.addEventListener("mouseenter", () => {
			unhideUIButton.style.backgroundColor = "rgba(255, 255, 255, 0.3)";
			unhideUIButton.style.transform = "scale(1.05)";
		});

		unhideUIButton.addEventListener("mouseleave", () => {
			unhideUIButton.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
			unhideUIButton.style.transform = "scale(1)";
		});

		unhideUIButton.onclick = toggleCleanView;

		// Append to body instead of a specific container
		document.body.appendChild(unhideUIButton);

		//trace.msg.log("Unhide UI button added to bottom-left above player bar");
		updateButtonStates();
	}, 1500); // Slight delay after hide button
};

function observeTrackTitle(): void {
	// Observe track title changes
	const trackTitleElement = document.querySelector('[class^="_trackTitleContainer"]');
	if (trackTitleElement) {
		const titleObserver = new MutationObserver(() => {
			setTimeout(() => {
				onTrackChanged();
			}, 300);
		});

		titleObserver.observe(trackTitleElement, {
			childList: true,
			subtree: true,
		});

		unloads.add(() => titleObserver.disconnect());
	}

	// Also observe the album image container for changes
	const albumImageContainer = document.querySelector('figure[class*="_albumImage"]');
	if (albumImageContainer) {
		const imageObserver = new MutationObserver(() => {
			setTimeout(() => {
				onTrackChanged();
			}, 100); // Slightly longer delay for image loading
		});

		imageObserver.observe(albumImageContainer, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["src", "poster"],
		});

		unloads.add(() => imageObserver.disconnect());
	}

	// Set up a periodic check as fallback
	const periodicCheck = setInterval(() => {
		onTrackChanged();
	}, 100); // Check every 100ms

	unloads.add(() => clearInterval(periodicCheck));
}

// Also observe for the buttons to appear so we can add our buttons
function observeForButtons(): void {
	const observer = new MutationObserver(() => {
		// Only observe for buttons if Hide UI is enabled
		if (settings.hideUIEnabled) {
			const fullscreenButton = document.querySelector('[data-test="request-fullscreen"]');
			if (fullscreenButton && !document.querySelector(".hide-ui-button")) {
				createHideUIButton();
			}

			// Create unhide button if it doesn't exist
			if (!document.querySelector(".unhide-ui-button")) {
				createUnhideUIButton();
			}
		}
	});

	observer.observe(document.body, {
		childList: true,
		subtree: true,
	});

	unloads.add(() => observer.disconnect());
}

const onTrackChanged = function (method: number = 0): void {
	if (method === 1) {
		setTimeout(() => {
			onTrackChanged();
			return;
		}, 2000);
	}

	let albumImageElement = document.querySelector('figure[class*="_albumImage"] > div > div > div > img') as HTMLImageElement;
	let albumImageSrc: string | null = null;

	if (albumImageElement) {
		albumImageSrc = albumImageElement.src;
		// Set res to 1280x1280
		albumImageSrc = albumImageSrc.replace(/\d+x\d+/, "1280x1280");
		albumImageElement.src = albumImageSrc;
	} else {
		const videoElement = document.querySelector('figure[class*="_albumImage"] > div > div > div > video') as HTMLVideoElement;
		if (videoElement) {
			albumImageSrc = videoElement.getAttribute("poster");
			if (albumImageSrc) {
				// Set res to 1280x1280
				albumImageSrc = albumImageSrc.replace(/\d+x\d+/, "1280x1280");
			}
		} else {
			cleanUpDynamicArt();
			//trace.msg.log("Couldn't get album art"); - Broken as fucky
			return;
		}
	}

	// Only update if the image source has actually changed
	if (albumImageSrc && albumImageSrc !== currentTrackSrc) {
		currentTrackSrc = albumImageSrc;
		//trace.msg.log(`Track changed, updating background: ${albumImageSrc}`); - Accidentally left this in Prod...

		// Setting background to the *="nowPlayingContainer" element
		const nowPlayingContainerElement = document.querySelector('[class*="_nowPlayingContainer"]') as HTMLElement;
		if (nowPlayingContainerElement) {
			// Remove existing corner images if they exist
			const existingImages = nowPlayingContainerElement.querySelectorAll(".corner-image");
			existingImages.forEach((img) => img.remove());

			// Create and append center image
			const centerImg = document.createElement("img");
			centerImg.src = albumImageSrc;
			centerImg.className = "corner-image";
			centerImg.style.position = "absolute";
			centerImg.style.left = "50%";
			centerImg.style.top = "50%";
			centerImg.style.transform = "translate(-50%, -50%)";
			centerImg.style.width = "75vw";
			centerImg.style.height = "150vh";
			centerImg.style.objectFit = "cover";
			centerImg.style.zIndex = "-1";
			centerImg.style.filter = "blur(100px) brightness(0.4) contrast(1.2) saturate(1)";
			centerImg.style.animation = "spin 35s linear infinite";
			centerImg.style.animationDelay = "5s"; // Add a 5-second delay
			nowPlayingContainerElement.appendChild(centerImg);

			const centerImg2 = document.createElement("img");
			centerImg2.src = albumImageSrc;
			centerImg2.className = "corner-image";
			centerImg2.style.position = "absolute";
			centerImg2.style.left = "50%";
			centerImg2.style.top = "50%";
			centerImg2.style.transform = "translate(-50%, -50%)";
			centerImg2.style.width = "75vw";
			centerImg2.style.height = "150vh";
			centerImg2.style.objectFit = "cover";
			centerImg2.style.zIndex = "-1";
			centerImg2.style.filter = "blur(100px) brightness(0.4) contrast(1.2) saturate(1)";
			centerImg2.style.animation = "spin 35s linear infinite";
			nowPlayingContainerElement.appendChild(centerImg2);

			// Add keyframe animation if it doesn't exist
			if (!document.querySelector("#spinAnimation")) {
				const styleSheet = document.createElement("style");
				styleSheet.id = "spinAnimation";
				styleSheet.textContent = `
                    @keyframes spin {
                        from { transform: translate(-50%, -50%) rotate(0deg); }
                        to { transform: translate(-50%, -50%) rotate(360deg); }
                    }
                `;
				document.head.appendChild(styleSheet);
			}
		}
	}
};

const cleanUpDynamicArt = function (): void {
	const cornerImages = document.getElementsByClassName("corner-image");
	Array.from(cornerImages).forEach((element) => {
		element.remove();
	});
	currentTrackSrc = null; // Reset current track source
};

// STYLES FOR THE LYRICS - Added Top-level async since Luna plugins are modules <3
const style = await HttpGet(themeUrl);
const styleElement = style ? ApplyCSS(style) : null;

// Initialize the button creation and observers
observeForButtons();
observeTrackTitle();
onTrackChanged(1);

// Add cleanup to unloads
unloads.add(() => {
	if (styleElement && styleElement.parentNode) {
		styleElement.parentNode.removeChild(styleElement);
	}

	if (appliedStyle && appliedStyle.parentNode) {
		appliedStyle.parentNode.removeChild(appliedStyle);
	}

	cleanUpDynamicArt();

	// Clean up our custom buttons
	const hideButton = document.querySelector(".hide-ui-button");
	if (hideButton && hideButton.parentNode) {
		hideButton.parentNode.removeChild(hideButton);
	}

	const unhideButton = document.querySelector(".unhide-ui-button");
	if (unhideButton && unhideButton.parentNode) {
		unhideButton.parentNode.removeChild(unhideButton);
	}

	// Clean up spin animation
	const spinAnimationStyle = document.querySelector("#spinAnimation");
	if (spinAnimationStyle && spinAnimationStyle.parentNode) {
		spinAnimationStyle.parentNode.removeChild(spinAnimationStyle);
	}
});
