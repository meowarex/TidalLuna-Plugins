import { LunaUnload, Tracer } from "@luna/core";
import { StyleTag } from "@luna/lib";
import { settings, Settings } from "./Settings";

// Import CSS directly using Luna's file:// syntax.. Took me a while to figure out this existed
import originalStyle from "file://theme.css?minify";

export const { trace, errSignal } = Tracer("[OLED Theme]");
export { Settings };

// called when plugin is unloaded.
// clean up resources
export const unloads = new Set<LunaUnload>();

const styleTag = new StyleTag("OLEDTheme", unloads);

// Function to apply theme styles based on current settings
const applyThemeStyles = function (): void {
	let modifiedStyle = originalStyle;

	// Remove SeekBar coloring if Quality Color Matched Seek Bar is enabled
	if (settings.qualityColorMatchedSeekBar) {
		modifiedStyle = modifiedStyle.replace(/\[class\^="_progressBarWrapper"\]\s*\{[^}]*\}/g, "");
	}

	// Remove button styling if OLED Friendly Buttons is enabled
	if (settings.oledFriendlyButtons) {
		const originalRuleCount = (modifiedStyle.match(/\{[^}]*\}/g) || []).length;

		// Split CSS into individual rules and filter out button-related ones
		const cssRules = modifiedStyle.split("}").filter((rule) => rule.trim());
		const filteredRules = cssRules.filter((rule) => {
			const lowerRule = rule.toLowerCase();

			// Check if this rule might affect buttons
			const isButtonRule =
				// Direct button selectors
				lowerRule.includes("button") ||
				lowerRule.includes('[role="button"]') ||
				lowerRule.includes('[type="button"]') ||
				lowerRule.includes('[type="submit"]') ||
				lowerRule.includes('[type="reset"]') ||
				// Class-based button selectors
				lowerRule.includes("btn") ||
				lowerRule.includes("_button") ||
				lowerRule.includes("-button") ||
				lowerRule.includes("button-") ||
				lowerRule.includes("button_") ||
				// Common button-related classes
				lowerRule.includes("clickable") ||
				lowerRule.includes("action") ||
				lowerRule.includes("control") ||
				lowerRule.includes("icon") ||
				// Data attributes that might be buttons
				(lowerRule.includes("data-test") && lowerRule.includes("button")) ||
				(lowerRule.includes("aria-label") && lowerRule.includes("button")) ||
				// Button states
				(lowerRule.includes(":hover") && (lowerRule.includes("button") || lowerRule.includes("btn"))) ||
				(lowerRule.includes(":focus") && (lowerRule.includes("button") || lowerRule.includes("btn"))) ||
				(lowerRule.includes(":active") && (lowerRule.includes("button") || lowerRule.includes("btn"))) ||
				// Cursor pointer (often used on buttons)
				(lowerRule.includes("cursor") && lowerRule.includes("pointer")) ||
				// Any class containing button-like patterns
				/\[class[^=]*=["'][^"']*button/i.test(rule) ||
				/\[class[^=]*=["'][^"']*btn/i.test(rule) ||
				/\[class[^=]*=["'][^"']*click/i.test(rule) ||
				/\[class[^=]*=["'][^"']*action/i.test(rule) ||
				/\[class[^=]*=["'][^"']*control/i.test(rule);

			// Return true to keep the rule if it's NOT a button rule
			return !isButtonRule;
		});

		modifiedStyle = filteredRules.join("} ") + (filteredRules.length > 0 ? "}" : "");
	}

	styleTag.css = modifiedStyle;
};

// Make this function available globally so Settings can call it
(window as any).updateOLEDThemeStyles = applyThemeStyles;

// Apply the OLED theme
applyThemeStyles();
