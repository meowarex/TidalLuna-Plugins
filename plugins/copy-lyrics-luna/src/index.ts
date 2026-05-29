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
	textarea.setAttribute("readonly", "");
	textarea.style.position = "fixed"; // Avoid scrolling to bottom
	textarea.style.top = "0";
	textarea.style.left = "0";
	textarea.style.opacity = "0";
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

const LINE_SELECTORS = [
	".rl-wbw-container .rl-wbw-line",
	'[data-test="now-playing-lyrics"] span[data-test="lyrics-line"]',
	'[class*="_lyricsText"] > div > span',
].join(",");

const OVERLAY_LINE_SELECTOR = ".rl-wbw-container .rl-wbw-line";
const LYRICS_ROOT_SELECTOR = [
	'[data-test="now-playing-lyrics"]',
	'[class*="_lyricsText"]',
	".rl-wbw-container",
].join(",");

let isPointerDownInLyrics = false;
let suppressNextClick = false;
let suppressClickResetTimer: number | null = null;

const isElement = (node: Node | null): node is Element =>
	Boolean(node && node.nodeType === Node.ELEMENT_NODE);

const getElementFromNode = (node: Node | null): Element | null => {
	if (!node) return null;
	return isElement(node) ? node : node.parentElement;
};

const isInLyrics = (node: Node | null): boolean =>
	Boolean(getElementFromNode(node)?.closest(LYRICS_ROOT_SELECTOR));

const rangeIntersectsNode = (range: Range, node: Node): boolean => {
	try {
		return range.intersectsNode(node);
	} catch {
		return false;
	}
};

const normalizeLineText = (text: string): string =>
	text
		.replace(/\u00a0/g, " ")
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n[ \t]+/g, "\n")
		.replace(/[ \t]{2,}/g, " ")
		.trim();

const getTextInsideRange = (line: HTMLElement, range: Range): string => {
	if (
		!line.contains(range.startContainer) &&
		!line.contains(range.endContainer)
	) {
		return normalizeLineText(line.textContent ?? "");
	}

	const selected = document.createRange();
	selected.selectNodeContents(line);
	if (line.contains(range.startContainer)) {
		selected.setStart(range.startContainer, range.startOffset);
	}
	if (line.contains(range.endContainer)) {
		selected.setEnd(range.endContainer, range.endOffset);
	}

	return normalizeLineText(selected.toString());
};

const getSelectedLines = (range: Range, selector: string): HTMLElement[] =>
	Array.from(document.querySelectorAll(selector)).filter(
		(node): node is HTMLElement =>
			node instanceof HTMLElement && rangeIntersectsNode(range, node),
	);

const getLyricsTextFromRange = (range: Range): string => {
	const overlayLines = getSelectedLines(range, OVERLAY_LINE_SELECTOR);
	const lines =
		overlayLines.length > 0
			? overlayLines
			: getSelectedLines(range, LINE_SELECTORS);

	if (lines.length === 0) {
		return isInLyrics(range.commonAncestorContainer)
			? normalizeLineText(range.toString())
			: "";
	}

	return lines
		.map((line) =>
			line.classList.contains("rl-wbw-spacer")
				? ""
				: getTextInsideRange(line, range),
		)
		.join("\n")
		.trim();
};

const getSelectedLyricsText = (selection: Selection): string => {
	const chunks: string[] = [];
	for (let i = 0; i < selection.rangeCount; i++) {
		const text = getLyricsTextFromRange(selection.getRangeAt(i));
		if (text.length > 0) chunks.push(text);
	}
	return chunks.join("\n").trim();
};

const suppressUpcomingClick = (): void => {
	suppressNextClick = true;
	if (suppressClickResetTimer !== null) {
		window.clearTimeout(suppressClickResetTimer);
	}
	suppressClickResetTimer = window.setTimeout(() => {
		suppressNextClick = false;
		suppressClickResetTimer = null;
	}, 250);
};

const onMouseDown = (event: MouseEvent): void => {
	isPointerDownInLyrics = isInLyrics(event.target as Node | null);
};

const onMouseUp = (): void => {
	if (!isPointerDownInLyrics) return;

	const selection = window.getSelection();
	if (selection?.toString().trim()) {
		const text = getSelectedLyricsText(selection);
		if (text.length > 0) {
			SetClipboard(text);
			trace.msg.log("Copied to clipboard!");
			selection.removeAllRanges();
			suppressUpcomingClick();
		}
	}

	isPointerDownInLyrics = false;
};

const onClickHooked = (event: MouseEvent): boolean | undefined => {
	if (!suppressNextClick) return;

	suppressNextClick = false;
	if (suppressClickResetTimer !== null) {
		window.clearTimeout(suppressClickResetTimer);
		suppressClickResetTimer = null;
	}
	event.preventDefault();
	event.stopPropagation();
	event.stopImmediatePropagation();
	return false;
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
	if (suppressClickResetTimer !== null) {
		window.clearTimeout(suppressClickResetTimer);
		suppressClickResetTimer = null;
	}
});
