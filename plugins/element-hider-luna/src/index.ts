import { LunaUnload, Tracer } from "@luna/core";
import { StyleTag, ContextMenu } from "@luna/lib";
import { settings, Settings } from "./Settings";

// Import CSS directly using Luna's file:// syntax
import styles from "file://styles.css?minify";

export const { trace } = Tracer("[Element Hider]");

// Export Settings
export { Settings };

// Clean up resources
export const unloads = new Set<LunaUnload>();

// StyleTag for element hider
const styleTag = new StyleTag("Element-Hider", unloads, styles);

// State management
let targetElement: HTMLElement | null = null;
let hiddenElements = new WeakSet<HTMLElement>();
let hiddenElementsArray: HTMLElement[] = [];

// MutationObserver for reactive element detection
let elementObserver: MutationObserver | null = null;

// Generate a unique selector for an element
function generateElementSelector(element: HTMLElement): string {
	// Priority 1: ID (most specific)
	if (element.id) {
		return `#${element.id}`;
	}

	// Priority 2: data-test attribute (very specific for Tidal <3)
	const dataTest = element.getAttribute("data-test");
	if (dataTest) {
		return `[data-test="${dataTest}"]`;
	}

	// Priority 3: Combination of tag + specific classes + position
	let selector = element.tagName.toLowerCase();

	// Get filtered classes (exclude our temporary classes)
	const classes = element.className
		? element.className
				.trim()
				.split(/\s+/)
				.filter((cls) => {
					return (
						cls.length > 0 &&
						!cls.startsWith("element-hider-") &&
						cls !== "element-hider-target" &&
						cls !== "element-hider-hiding" &&
						cls !== "element-hider-hidden"
					);
				})
		: [];

	// Only use classes if we have them and they're not generic and dumb
	if (classes.length > 0) {
		// Use ALL classes to be very specific
		selector += "." + classes.join(".");

		// Add parent context for extra specificity (for when the element is inside another element)
		const parent = element.parentElement;
		if (parent && parent.tagName !== "BODY" && parent.tagName !== "HTML") {
			const parentClasses = parent.className
				? parent.className
						.trim()
						.split(/\s+/)
						.filter((cls) => {
							return cls.length > 0 && !cls.startsWith("element-hider-");
						})
				: [];

			if (parentClasses.length > 0) {
				const parentSelector =
					parent.tagName.toLowerCase() +
					"." +
					parentClasses.slice(0, 2).join(".");
				selector = `${parentSelector} > ${selector}`;
			}
		}
	} else {
		// If no useful classes, use position-based selector with parent context
		const parent = element.parentElement;
		if (parent) {
			const siblings = Array.from(parent.children).filter(
				(child) => child.tagName === element.tagName,
			);
			const index = siblings.indexOf(element);
			if (index >= 0) {
				selector += `:nth-of-type(${index + 1})`;

				// Add parent context
				if (parent.tagName !== "BODY" && parent.tagName !== "HTML") {
					const parentClasses = parent.className
						? parent.className
								.trim()
								.split(/\s+/)
								.filter((cls) => {
									return cls.length > 0 && !cls.startsWith("element-hider-");
								})
						: [];

					if (parentClasses.length > 0) {
						const parentSelector =
							parent.tagName.toLowerCase() +
							"." +
							parentClasses.slice(0, 2).join(".");
						selector = `${parentSelector} > ${selector}`;
					}
				}
			}
		}
	}

	trace.log(`Generated specific selector: ${selector}`);
	return selector;
}

// Save hidden element to persistent storage | uses @Inrixia's Reactive Storage <3
function saveHiddenElement(element: HTMLElement): void {
	const selector = generateElementSelector(element);
	const elementInfo = {
		selector: selector,
		tagName: element.tagName,
		className: element.className || "",
		textContent: element.textContent?.substring(0, 100) || "",
		timestamp: Date.now(),
	};

	// Check if element is already saved
	const existingIndex = settings.hiddenElements.findIndex(
		(stored) => stored.selector === elementInfo.selector,
	);

	if (existingIndex === -1) {
		settings.hiddenElements.push(elementInfo);
		trace.log(`Saved element: ${elementInfo.selector}`);
		trace.log(`Total stored: ${settings.hiddenElements.length}`);
	} else {
		trace.log(`Element already saved: ${elementInfo.selector}`);
	}
}

// Remove hidden element from persistent storage (for unhiding)
function removeSavedElement(element: HTMLElement): void {
	const selector = generateElementSelector(element);
	const index = settings.hiddenElements.findIndex(
		(stored) => stored.selector === selector,
	);

	if (index !== -1) {
		settings.hiddenElements.splice(index, 1);
		trace.log(`Permanently removed: ${selector}`);
		trace.log(`Remaining stored: ${settings.hiddenElements.length}`);
	}
}

// Check if an element matches any stored selector (EXACT match only)
function matchesStoredSelector(element: HTMLElement): boolean {
	for (const storedElement of settings.hiddenElements) {
		try {
			// Only use EXACT selector match - no fallbacks during reactive hiding
			if (element.matches(storedElement.selector)) {
				return true;
			}
		} catch (error) {
			trace.warn(`Invalid selector: ${storedElement.selector}`, error);
		}
	}

	return false;
}

// Hide element directly without animation
function hideElementDirectly(element: HTMLElement): void {
	if (hiddenElements.has(element)) return;

	element.classList.add("element-hider-hidden");
	hiddenElements.add(element);
	hiddenElementsArray.push(element);
	trace.log(
		`Hidden element: ${element.tagName}${element.className ? "." + element.className.split(" ")[0] : ""}`,
	);
}

// Hide the target element with animation
function hideTargetElement(): void {
	if (!targetElement) return;

	trace.log(
		`Hiding with animation: ${targetElement.tagName}${targetElement.className ? "." + targetElement.className.split(" ")[0] : ""}`,
	);

	// Add hiding animation class
	targetElement.classList.add("element-hider-hiding");

	// Store reference to the element
	const elementToHide = targetElement;

	// Save to persistent storage
	saveHiddenElement(elementToHide);

	// Wait for animation to complete, then hide
	setTimeout(() => {
		elementToHide.classList.add("element-hider-hidden");
		elementToHide.classList.remove(
			"element-hider-hiding",
			"element-hider-target",
		);
		hiddenElements.add(elementToHide);
		hiddenElementsArray.push(elementToHide);
	}, 300);

	// Clear target reference
	targetElement = null;
}

// Unhide all elements permanently (remove from storage)
function unhideAllElements(): void {
	trace.log(
		`Permanently unhiding ${settings.hiddenElements.length} saved elements`,
	);

	// Show all currently hidden elements
	hiddenElementsArray.forEach((element) => {
		if (document.body.contains(element)) {
			element.classList.remove("element-hider-hidden", "element-hider-hiding");
		}
	});

	// Clear both storage and runtime collections
	settings.hiddenElements = [];
	hiddenElements = new WeakSet<HTMLElement>();
	hiddenElementsArray = [];
}

// Process all elements in the document to hide matching ones (with strict matching)
function processAllElements(): void {
	if (settings.hiddenElements.length === 0) return;

	trace.log(
		`Scanning document for ${settings.hiddenElements.length} stored selectors`,
	);
	let hiddenCount = 0;

	// Use querySelectorAll for each stored selector with validation
	settings.hiddenElements.forEach((storedElement, index) => {
		try {
			trace.log(`Searching for: ${storedElement.selector}`);
			const elements = document.querySelectorAll(storedElement.selector);
			trace.log(`Found ${elements.length} matches for selector ${index + 1}`);

			// Limit to prevent over-hiding (safety check)
			if (elements.length > 10) {
				trace.warn(
					`Selector too broad (${elements.length} matches), skipping: ${storedElement.selector}`,
				);
				return;
			}

			elements.forEach((element, elemIndex) => {
				const htmlElement = element as HTMLElement;
				if (!hiddenElements.has(htmlElement)) {
					hideElementDirectly(htmlElement);
					hiddenCount++;
					trace.log(
						`Hid element ${elemIndex + 1}/${elements.length} for selector ${index + 1}`,
					);
				}
			});
		} catch (error) {
			trace.warn(`Invalid selector: ${storedElement.selector}`, error);
		}
	});

	if (hiddenCount > 0) {
		trace.log(`Total elements hidden: ${hiddenCount}`);
	}
}

// Process new elements that are added to the DOM
function processNewElements(addedNodes: NodeList): void {
	addedNodes.forEach((node) => {
		if (node.nodeType !== Node.ELEMENT_NODE) return;

		const element = node as HTMLElement;

		// Check the element itself
		if (matchesStoredSelector(element)) {
			hideElementDirectly(element);
		}

		// Check all descendant elements
		const descendants = element.querySelectorAll("*");
		descendants.forEach((descendant) => {
			if (matchesStoredSelector(descendant as HTMLElement)) {
				hideElementDirectly(descendant as HTMLElement);
			}
		});
	});
}

// Set up reactive element observer
function setupElementObserver(): void {
	if (elementObserver) return;

	elementObserver = new MutationObserver((mutations) => {
		mutations.forEach((mutation) => {
			if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
				processNewElements(mutation.addedNodes);
			}
		});
	});

	elementObserver.observe(document.body, {
		childList: true,
		subtree: true,
	});

	trace.log(`Set up reactive element observer`);
}

// Global functions
(window as any).showAllElementsFromSettings = unhideAllElements;
(window as any).debugElementHider = () => {
	trace.log(`=== Element Hider Debug Info ===`);
	trace.log(`Stored elements: ${settings.hiddenElements.length}`);
	trace.log(`Currently hidden elements: ${hiddenElementsArray.length}`);
	trace.log(`Reactive hiding enabled: true`);
	settings.hiddenElements.forEach((element, index) => {
		trace.log(`${index + 1}. ${element.selector} (${element.tagName})`);
	});
	trace.log(`================================`);
};

// Handle highlighting target element
function highlightElement(element: HTMLElement): void {
	// Remove previous highlights
	document.querySelectorAll(".element-hider-target").forEach((el) => {
		el.classList.remove("element-hider-target");
	});

	// Highlight current element
	element.classList.add("element-hider-target");
	targetElement = element;
}

// Remove highlight
function removeHighlight(): void {
	if (targetElement) {
		targetElement.classList.remove("element-hider-target");
		targetElement = null;
	}
}

// Context menu state management
let currentContextElement: HTMLElement | null = null;
let customMenu: HTMLElement | null = null;
let contextMenuTimeout: number | null = null;
let waitingForBuiltInMenu = false;

// Listen for right-click events to capture the target for context menu
document.addEventListener(
	"contextmenu",
	(event: MouseEvent) => {
		const target = event.target as HTMLElement;

		// Don't interfere with native context menus on inputs, textareas, etc.
		if (
			target.tagName === "INPUT" ||
			target.tagName === "TEXTAREA" ||
			target.isContentEditable
		) {
			currentContextElement = null;
			return;
		}

		// Don't show menu on our own custom menu
		if (target.closest(".element-hider-custom-menu")) {
			return;
		}

		// Close any existing custom menu
		closeCustomMenu();

		// Store the right-clicked element for context menu
		currentContextElement = target;
		waitingForBuiltInMenu = true;

		// Store event coordinates for potential custom menu
		const eventX = event.clientX;
		const eventY = event.clientY;

		// Prevent default immediately if we plan to handle it
		event.preventDefault();

		// Wait to see if the built-in context menu appears
		contextMenuTimeout = window.setTimeout(() => {
			// If we're still waiting and no built-in menu appeared, show our custom menu
			if (waitingForBuiltInMenu && currentContextElement) {
				showCustomMenu(eventX, eventY);
			}
			waitingForBuiltInMenu = false;
		}, 150); // Wait 150ms for built-in menu

		// Don't prevent default initially - let Luna try to handle the context menu
	},
	true,
);

// Listen for clicks to close custom menu
document.addEventListener(
	"click",
	(event: MouseEvent) => {
		const target = event.target as HTMLElement;

		// If clicking outside our custom menu, close it
		if (customMenu && !target.closest(".element-hider-custom-menu")) {
			closeCustomMenu();
			removeHighlight();
		}
	},
	true,
);

// Handle escape key to close custom menu and remove highlights
document.addEventListener("keydown", (event: KeyboardEvent) => {
	if (event.key === "Escape") {
		if (customMenu) {
			closeCustomMenu();
		}
		removeHighlight();
	}
});

// Create custom context menu
function createCustomMenu(): HTMLElement {
	const menu = document.createElement("div");
	menu.className = "element-hider-custom-menu";

	// Hide Element option
	const hideItem = document.createElement("button");
	hideItem.className = "element-hider-menu-item";
	hideItem.innerHTML = `Hide This Element`;
	hideItem.addEventListener("click", () => {
		if (currentContextElement) {
			targetElement = currentContextElement;
			hideTargetElement();
			closeCustomMenu();
		}
	});

	// Add hover effects for highlighting
	hideItem.addEventListener("mouseenter", () => {
		if (currentContextElement) {
			highlightElement(currentContextElement);
		}
	});

	hideItem.addEventListener("mouseleave", () => {
		removeHighlight();
	});

	// Unhide All Elements option
	const unhideAllItem = document.createElement("button");
	unhideAllItem.className = "element-hider-menu-item";
	unhideAllItem.innerHTML = `Unhide All Elements (${hiddenElementsArray.length})`;
	unhideAllItem.addEventListener("click", () => {
		unhideAllElements();
		closeCustomMenu();
	});

	menu.appendChild(hideItem);
	menu.appendChild(unhideAllItem);

	return menu;
}

// Show custom context menu
function showCustomMenu(x: number, y: number): void {
	closeCustomMenu();

	customMenu = createCustomMenu();
	document.body.appendChild(customMenu);

	// Position the menu
	const rect = customMenu.getBoundingClientRect();
	const finalX = Math.min(x, window.innerWidth - rect.width - 10);
	const finalY = Math.min(y, window.innerHeight - rect.height - 10);

	customMenu.style.left = `${finalX}px`;
	customMenu.style.top = `${finalY}px`;

	trace.log(`Context menu opened for: ${currentContextElement?.tagName}`);
}

// Close custom context menu
function closeCustomMenu(): void {
	if (customMenu) {
		customMenu.remove();
		customMenu = null;
	}

	if (contextMenuTimeout) {
		clearTimeout(contextMenuTimeout);
		contextMenuTimeout = null;
	}
}

// Try to hook into the context menu when it appears
const contextMenuObserver = new MutationObserver((mutations) => {
	mutations.forEach((mutation) => {
		mutation.addedNodes.forEach((node) => {
			if (node.nodeType === Node.ELEMENT_NODE) {
				const element = node as HTMLElement;

				// Look for Tidal's context menu
				if (
					element.matches('[data-test="contextmenu"]') ||
					element.querySelector('[data-test="contextmenu"]')
				) {
					const contextMenu = element.matches('[data-test="contextmenu"]')
						? element
						: (element.querySelector(
								'[data-test="contextmenu"]',
							) as HTMLElement);

					if (contextMenu && currentContextElement && waitingForBuiltInMenu) {
						// Built-in menu appeared, cancel custom menu timeout
						waitingForBuiltInMenu = false;
						if (contextMenuTimeout) {
							clearTimeout(contextMenuTimeout);
							contextMenuTimeout = null;
						}
						addElementHiderOptions(contextMenu);
					}
				}
			}
		});
	});
});

// Add our options to the existing context menu
function addElementHiderOptions(contextMenu: HTMLElement): void {
	// Create hide element button
	const hideButton = document.createElement("button");
	hideButton.className = "element-hider-menu-item";
	hideButton.style.cssText = `
		display: flex;
		align-items: center;
		padding: 8px 16px;
		cursor: pointer;
		color: var(--wave-color-text, #ffffff);
		background: transparent;
		border: none;
		width: 100%;
		text-align: left;
		transition: background-color 0.15s ease;
		font-family: inherit;
		font-size: 14px;
	`;
	hideButton.innerHTML = `Hide This Element`;

	hideButton.addEventListener("click", () => {
		if (currentContextElement) {
			targetElement = currentContextElement;
			hideTargetElement();
		}
	});

	// Add hover effects for highlighting
	hideButton.addEventListener("mouseenter", () => {
		hideButton.style.background = "var(--wave-color-background-hover, #3a3a3a)";
		if (currentContextElement) {
			highlightElement(currentContextElement);
		}
	});

	hideButton.addEventListener("mouseleave", () => {
		hideButton.style.background = "transparent";
		removeHighlight();
	});

	// Create unhide all button
	const unhideAllButton = document.createElement("button");
	unhideAllButton.className = "element-hider-menu-item";
	unhideAllButton.style.cssText = hideButton.style.cssText;
	unhideAllButton.innerHTML = `Unhide All Elements (${hiddenElementsArray.length})`;

	unhideAllButton.addEventListener("click", unhideAllElements);

	// Add hover effects for unhide all button
	unhideAllButton.addEventListener("mouseenter", () => {
		unhideAllButton.style.background =
			"var(--wave-color-background-hover, #3a3a3a)";
	});
	unhideAllButton.addEventListener("mouseleave", () => {
		unhideAllButton.style.background = "transparent";
	});

	// Add a separator if the menu has other items
	if (contextMenu.children.length > 0) {
		const separator = document.createElement("div");
		separator.style.cssText = `
			height: 1px;
			background: var(--wave-color-border, #444);
			margin: 4px 8px;
		`;
		contextMenu.appendChild(separator);
	}

	// Add our buttons
	contextMenu.appendChild(hideButton);
	contextMenu.appendChild(unhideAllButton);
}

// Start observing for context menus
contextMenuObserver.observe(document.body, {
	childList: true,
	subtree: true,
});

// Initialize plugin
function initializePlugin() {
	trace.log("Initializing plugin...");

	// Process immediately when DOM is ready
	trace.log("Starting element processing...");

	// Process existing elements
	processAllElements();

	// Set up reactive observer for new elements
	setupElementObserver();

	trace.log("Plugin fully initialized");
}

// Run initialization when DOM is ready
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initializePlugin);
} else {
	initializePlugin();
}

// Add cleanup to unloads
unloads.add(() => {
	// Stop observing
	if (elementObserver) {
		elementObserver.disconnect();
		elementObserver = null;
	}
	contextMenuObserver.disconnect();

	// Close any open custom menu
	closeCustomMenu();

	// Remove highlights
	removeHighlight();

	// Clean up global functions
	(window as any).showAllElementsFromSettings = undefined;
	(window as any).debugElementHider = undefined;

	trace.log("Plugin unloaded");
});

trace.log("Plugin loaded - Right-click any element to hide it!");
