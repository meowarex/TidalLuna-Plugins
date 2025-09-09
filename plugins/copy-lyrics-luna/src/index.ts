import { type LunaUnload, Tracer } from "@luna/core";
import { StyleTag } from "@luna/lib";

// Import CSS directly using Luna's file:// syntax - Took me a while to figure out <3
import unlockSelection from "file://styles.css?minify";

export const { trace } = Tracer("[Copy Lyrics]");

// clean up resources
export const unloads = new Set<LunaUnload>();

// Style injection via side effect
new StyleTag("Copy-Lyrics", unloads, unlockSelection);

function SetClipboard(text: string): void {
	const textarea = document.createElement("textarea");
	textarea.value = text;
	textarea.style.position = "fixed"; // Avoid scrolling to bottom
	document.body.appendChild(textarea);
	textarea.select();

	try {
		const success = document.execCommand("copy");
		if (!success) throw new Error("Failed to copy text.");
	} catch (err) {
		trace.msg.err(err instanceof Error ? err.message : String(err));
	} finally {
		document.body.removeChild(textarea);
	}
}

let isSelecting = false;

const onMouseDown = (): void => {
	isSelecting = true;
};

const onMouseUp = (): void => {
	if (isSelecting) {
		const selection = window.getSelection();
		if (selection?.toString().length > 0) {
			const selectedSpans: HTMLSpanElement[] = [];
			const range = selection.getRangeAt(0);
			let container: Node | null = range.commonAncestorContainer;

			// Normalize container: if it's a text node, use its parent element/node
			if (container && container.nodeType === Node.TEXT_NODE) {
				container = (container.parentElement ?? container.parentNode) as Node | null;
			}

			// If parent has data-current, treat as single-line copy case
			if (
				container &&
				container.nodeType === Node.ELEMENT_NODE &&
				(container as Element).hasAttribute("data-current")
			) {
				const text_ = selection.toString().trim();
				SetClipboard(text_);
				trace.msg.log("Copied to clipboard!");
				return;
			}

			// Ensure we have an Element or Document before querying
			if (
				!container ||
				(container.nodeType !== Node.ELEMENT_NODE &&
					container.nodeType !== Node.DOCUMENT_NODE)
			) {
				isSelecting = false;
				return;
			}

			// Get all the spans inside the container.
			const spans = (container as Element | Document).getElementsByTagName(
				"span",
			);
			for (const span of spans) {
				if (selection.containsNode(span, true)) {
					selectedSpans.push(span as HTMLSpanElement);
				}
			}

			// Concat the text of the selected spans.
			let hasCorrectAttribute = false;
			let text = "";
			selectedSpans.forEach((span) => {
				if (span.hasAttribute("data-current")) {
					hasCorrectAttribute = true;
					text += span.textContent + "\n";
					if (
						[...span.classList].some((className) =>
							className.startsWith("endOfStanza--"),
						)
					) {
						text += "\n";
					}
				}
			});

			text = text.trim();

			if (hasCorrectAttribute) {
				SetClipboard(text);
				trace.msg.log("Copied to clipboard!");
				selection.removeAllRanges();
			}
		}
		isSelecting = false;
	}
};

const onClickHooked = (event: MouseEvent): boolean | undefined => {
	if (!isSelecting) return;

	const target = event.target as HTMLElement;
	if (
		target.tagName.toLowerCase() === "span" &&
		target.hasAttribute("data-current")
	) {
		// Prevent default behavior and stop event propagation
		event.preventDefault();
		event.stopPropagation();
		event.stopImmediatePropagation();
		return false;
	}
	return undefined;
};

// Add event listener with capture phase to intercept events before they reach other handlers

document.addEventListener("click", onClickHooked, true);

document.addEventListener("mousedown", onMouseDown);

document.addEventListener("mouseup", onMouseUp);

// Add cleanup to unloads
unloads.add((): void => {
	// Remove event listeners
	document.removeEventListener("click", onClickHooked, true);
	document.removeEventListener("mousedown", onMouseDown);
	document.removeEventListener("mouseup", onMouseUp);
});
