import { LunaUnload, Tracer } from "@luna/core";
import { StyleTag, observePromise, PlayState, Quality, type MediaItem } from "@luna/lib";
import { settings, Settings } from "./Settings";

// Import CSS files directly using Luna's file:// syntax
import darkTheme from "file://dark-theme.css?minify";
import oledFriendlyTheme from "file://oled-friendly.css?minify";
import lightTheme from "file://light-theme.css?minify";

export const { trace } = Tracer("[OLED Theme]");
export { Settings };

// called when plugin is unloaded.
// clean up resources
export const unloads = new Set<LunaUnload>();

// StyleTag instance for theme management
const themeStyleTag = new StyleTag("OLED-Theme", unloads);

// Quality color mapping
const QUALITY_COLORS = {
    MAX: "#FED330",    // Max/HiFi
    HIGH: "#31FFEE",   // High
    LOW: "#FFFFFE"     // Low
};

// Function to get quality color based on audio quality
const getQualityColor = (audioQuality: string): string => {
    const quality = audioQuality?.toUpperCase();
    if (quality?.includes("HI_RES_LOSSLESS")) {
        return QUALITY_COLORS.MAX;
    } else if (quality?.includes("LOSSLESS")) {
        return QUALITY_COLORS.HIGH;
    } else {
        return QUALITY_COLORS.LOW;
    }
};

// Function to Reset Seek Bar Color (if setting gets disabled while playing)
const resetSeekBarColor = async (): Promise<void> => {
    try {
        const progressBarWrapper = await observePromise<HTMLElement>(unloads, `[class^="_progressBarWrapper"]`);
        if (!progressBarWrapper) return;
        progressBarWrapper.style.removeProperty('color');
        progressBarWrapper.querySelectorAll('[class*="progress"], [class*="bar"]').forEach(el => {
            if (el instanceof HTMLElement) el.style.removeProperty('color');
        });
    } catch (error) {
        trace.msg.err(`Failed to reset seek bar color: ${error}`);
    }
};

// Function to apply quality-based seek bar coloring (if enabled)
const applyQualityColors = async (): Promise<void> => {
    if (!settings.qualityColorMatchedSeekBar) return;
    try {
        const progressBarWrapper = await observePromise<HTMLElement>(unloads, `[class^="_progressBarWrapper"]`);
        if (!progressBarWrapper) return;
        const audioQuality = PlayState.playbackContext?.actualAudioQuality;
        if (!audioQuality) return;
        const qualityColor = getQualityColor(audioQuality);
        progressBarWrapper.style.setProperty('color', qualityColor, 'important');
        progressBarWrapper.querySelectorAll('[class*="progress"], [class*="bar"]').forEach(el => {
            if (el instanceof HTMLElement) el.style.setProperty('color', qualityColor, 'important');
        });
        //trace.msg.log(`Applied quality color ${qualityColor}`);
    } catch (error) {
        trace.msg.err(`Failed to apply quality colors: ${error}`);
    }
};

// Function to monitor track changes using track ID
const setupQualityMonitoring = (): void => {
    let lastTrackId: string | null = null;
    const interval = setInterval(() => {
        if (!settings.qualityColorMatchedSeekBar) return;
        const currentTrackId = PlayState.playbackContext?.actualProductId;
        if (currentTrackId && currentTrackId !== lastTrackId) {
            //trace.msg.log(`[OLED Theme] Track ID changed: ${lastTrackId} -> ${currentTrackId}`);
            lastTrackId = currentTrackId;
            applyQualityColors();
        }
    }, 250);
    unloads.add(() => clearInterval(interval));

    // Initial color application (if a track is already loaded)
    const currentTrackId = PlayState.playbackContext?.actualProductId;
    if (settings.qualityColorMatchedSeekBar && currentTrackId) {
        lastTrackId = currentTrackId;
        applyQualityColors();
    }
};

// Function to apply theme styles based on current settings
const applyThemeStyles = function(): void {
    // Choose the appropriate CSS file based on settings
    let selectedStyle: string;
    
    if (settings.lightMode) {
        // Light mode - (OLED friendly doesn't apply to light theme)
        selectedStyle = lightTheme;
    } else {
        // Dark mode
        selectedStyle = settings.oledFriendlyButtons ? oledFriendlyTheme : darkTheme;
    }
    
    // Remove SeekBar coloring if Quality Color Matched Seek Bar is enabled
    // This allows our manual coloring to take precedence
    if (settings.qualityColorMatchedSeekBar) {
        selectedStyle = selectedStyle.replace(/\[class\^="_progressBarWrapper"\]\s*\{[^}]*\}/g, '');
        setupQualityMonitoring();
    } else {
        // If disabling, reset the seek bar color
        resetSeekBarColor();
    }
    
    // Apply the selected theme using StyleTag
    themeStyleTag.css = selectedStyle;


};

// Make this function available globally so Settings can call it
(window as any).updateOLEDThemeStyles = applyThemeStyles;

// Apply the OLED theme initially
applyThemeStyles();

