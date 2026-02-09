import { ReactiveStore } from "@luna/core";
import { LunaSettings, LunaSwitchSetting, LunaNumberSetting } from "@luna/ui";
import React from "react";

export const settings = await ReactiveStore.getPluginStorage("RadiantLyrics", {
	lyricsGlowEnabled: true,
	trackTitleGlow: false,
	hideUIEnabled: true,
	playerBarVisible: false,
	CoverEverywhere: true,
	performanceMode: false,
	spinningArt: true,
	textGlow: 20,
	backgroundScale: 15,
	backgroundRadius: 25,
	backgroundContrast: 120,
	backgroundBlur: 80,
	backgroundBrightness: 40,
	spinSpeed: 45,
	settingsAffectNowPlaying: true,
	stickyLyricsFeature: true,
	stickyLyrics: false,
	stickyLyricsIcon: "chevron" as string,
});

export const Settings = () => {
	const [hideUIEnabled, setHideUIEnabled] = React.useState(
		settings.hideUIEnabled,
	);
	const [playerBarVisible, setPlayerBarVisible] = React.useState(
		settings.playerBarVisible,
	);
	const [lyricsGlowEnabled, setLyricsGlowEnabled] = React.useState(
		settings.lyricsGlowEnabled,
	);
	const [textGlow, setTextGlow] = React.useState(settings.textGlow);
	const [CoverEverywhere, setCoverEverywhere] = React.useState(
		settings.CoverEverywhere,
	);
	const [performanceMode, setPerformanceMode] = React.useState(
		settings.performanceMode,
	);
	const [spinningArt, setspinningArt] = React.useState(
		settings.spinningArt,
	);
	const [backgroundContrast, setBackgroundContrast] = React.useState(
		settings.backgroundContrast,
	);
	const [backgroundBlur, setBackgroundBlur] = React.useState(
		settings.backgroundBlur,
	);
	const [backgroundBrightness, setBackgroundBrightness] = React.useState(
		settings.backgroundBrightness,
	);
	const [spinSpeed, setSpinSpeed] = React.useState(settings.spinSpeed);
	const [settingsAffectNowPlaying, setSettingsAffectNowPlaying] =
		React.useState(settings.settingsAffectNowPlaying);
	const [trackTitleGlow, setTrackTitleGlow] = React.useState(
		settings.trackTitleGlow,
	);
	const [backgroundScale, setBackgroundScale] = React.useState(
		settings.backgroundScale,
	);
	const [backgroundRadius, setBackgroundRadius] = React.useState(
		settings.backgroundRadius,
	);
	const [stickyLyricsFeature, setStickyLyricsFeature] = React.useState(
		settings.stickyLyricsFeature,
	);

	// Derive props and override onChange to accept a broader first param type
	type BaseSwitchProps = React.ComponentProps<typeof LunaSwitchSetting>;
	type AnySwitchProps = Omit<BaseSwitchProps, "onChange"> & {
		onChange: (_: unknown, checked: boolean) => void;
		checked: boolean;
	};
	const AnySwitch = LunaSwitchSetting as unknown as React.ComponentType<
		AnySwitchProps
	>;

	return (
		<LunaSettings>
			<AnySwitch
				title="Lyrics Glow Effect"
				desc="Enable glowing effect for lyrics & Font Styling Changes"
				checked={lyricsGlowEnabled}
				onChange={(_: unknown, checked: boolean) => {
					setLyricsGlowEnabled((settings.lyricsGlowEnabled = checked));
					// Update styles immediately when setting changes
					if ((window as any).updateRadiantLyricsStyles) {
						(window as any).updateRadiantLyricsStyles();
					}
				}}
			/>
			<AnySwitch
				title="Track Title Glow"
				desc="Apply glow to the track title"
				checked={trackTitleGlow}
				onChange={(_: unknown, checked: boolean) => {
					setTrackTitleGlow((settings.trackTitleGlow = checked));
					if ((window as any).updateRadiantLyricsStyles) {
						(window as any).updateRadiantLyricsStyles();
					}
				}}
			/>
			<AnySwitch
				title="Sticky Lyrics"
				desc="Adds a dropdown to the Lyrics tab that auto-switches to Play Queue when lyrics aren't available"
				checked={stickyLyricsFeature}
				onChange={(_: unknown, checked: boolean) => {
					setStickyLyricsFeature((settings.stickyLyricsFeature = checked));
					if ((window as any).updateStickyLyricsFeature) {
						(window as any).updateStickyLyricsFeature();
					}
				}}
			/>
			<AnySwitch
				title="Hide UI Feature"
				desc="Enable hide/unhide UI functionality with toggle buttons"
				checked={hideUIEnabled}
				onChange={(_: unknown, checked: boolean) => {
					setHideUIEnabled((settings.hideUIEnabled = checked));
				}}
			/>
			<AnySwitch
				title="Player Bar Visibility in Hide UI Mode"
				desc="Keep player bar visible when UI is hidden"
				checked={playerBarVisible}
				onChange={(_: unknown, checked: boolean) => {
					console.log("Player Bar Visibility:", checked ? "visible" : "hidden");
					setPlayerBarVisible((settings.playerBarVisible = checked));
					// Update styles immediately when setting changes
					if ((window as any).updateRadiantLyricsStyles) {
						(window as any).updateRadiantLyricsStyles();
					}
				}}
			/>
			<AnySwitch
				title="Cover Everywhere"
				desc="Apply the spinning Cover Art background to the entire app, not just the Now Playing view, Heavily Inspired by Cover-Theme by @Inrixia"
				checked={CoverEverywhere}
				onChange={(_: unknown, checked: boolean) => {
					console.log(
						"Spinning Cover Everywhere:",
						checked ? "enabled" : "disabled",
					);
					setCoverEverywhere(
						(settings.CoverEverywhere = checked),
					);
					// Update styles immediately when setting changes
					if ((window as any).updateRadiantLyricsGlobalBackground) {
						(window as any).updateRadiantLyricsGlobalBackground();
					}
				}}
			/>
			<AnySwitch
				title="Performance Mode | Experimental"
				desc="Performance mode: Reduces blur effects & uses smaller image sizes, to optimize GPU usage"
				checked={performanceMode}
				onChange={(_: unknown, checked: boolean) => {
					console.log("Performance Mode:", checked ? "enabled" : "disabled");
					setPerformanceMode((settings.performanceMode = checked));
					// Update background animations immediately when setting changes
					if ((window as any).updateRadiantLyricsGlobalBackground) {
						(window as any).updateRadiantLyricsGlobalBackground();
					}
					if ((window as any).updateRadiantLyricsNowPlayingBackground) {
						(window as any).updateRadiantLyricsNowPlayingBackground();
					}
				}}
			/>
			<AnySwitch
				title="Background Cover Spin" // Cheers @Max/n0201 for the idea <3
				desc="Enable the spinning cover art background animation"
				checked={spinningArt}
				onChange={(_: unknown, checked: boolean) => {
					console.log(
						"Background Cover Spin:",
						checked ? "enabled" : "disabled",
					);
					setspinningArt((settings.spinningArt = checked));
					if ((window as any).updateRadiantLyricsGlobalBackground) {
						(window as any).updateRadiantLyricsGlobalBackground();
					}
					if (
						settings.settingsAffectNowPlaying &&
						(window as any).updateRadiantLyricsNowPlayingBackground
					) {
						(window as any).updateRadiantLyricsNowPlayingBackground();
					}
				}}
			/>
			<LunaNumberSetting
				title="Text Glow"
				desc="Adjust the glow size of lyrics (0-100, default: 20)"
				min={0}
				max={100}
				step={1}
				value={textGlow}
				onNumber={(value: number) => {
					setTextGlow((settings.textGlow = value));
					// Update variables immediately when setting changes
					if ((window as any).updateRadiantLyricsTextGlow) {
						(window as any).updateRadiantLyricsTextGlow();
					}
				}}
			/>
						<LunaNumberSetting
				title="Background Scale"
				desc="Adjust the scale of the background cover (1=10% - 50=500%)"
				min={1}
				max={50}
				step={1}
				value={backgroundScale}
				onNumber={(value: number) => {
					setBackgroundScale((settings.backgroundScale = value));
					if ((window as any).updateRadiantLyricsGlobalBackground) {
						(window as any).updateRadiantLyricsGlobalBackground();
					}
					if (
						settings.settingsAffectNowPlaying &&
						(window as any).updateRadiantLyricsNowPlayingBackground
					) {
						(window as any).updateRadiantLyricsNowPlayingBackground();
					}
				}}
			/>
			<LunaNumberSetting
				title="Background Radius"
				desc="Adjust the cover art corner radius (0-100%, 100% = circle)"
				min={0}
				max={100}
				step={1}
				value={backgroundRadius}
				onNumber={(value: number) => {
					setBackgroundRadius((settings.backgroundRadius = value));
					if ((window as any).updateRadiantLyricsGlobalBackground) {
						(window as any).updateRadiantLyricsGlobalBackground();
					}
					if (
						settings.settingsAffectNowPlaying &&
						(window as any).updateRadiantLyricsNowPlayingBackground
					) {
						(window as any).updateRadiantLyricsNowPlayingBackground();
					}
				}}
			/>
			<LunaNumberSetting
				title="Background Contrast"
				desc="Adjust the contrast of the spinning background (0-200, default: 120)"
				min={0}
				max={200}
				step={1}
				value={backgroundContrast}
				onNumber={(value: number) => {
					setBackgroundContrast((settings.backgroundContrast = value));
					if ((window as any).updateRadiantLyricsGlobalBackground) {
						(window as any).updateRadiantLyricsGlobalBackground();
					}
					if (
						settings.settingsAffectNowPlaying &&
						(window as any).updateRadiantLyricsNowPlayingBackground
					) {
						(window as any).updateRadiantLyricsNowPlayingBackground();
					}
				}}
			/>
			<LunaNumberSetting
				title="Background Blur"
				desc="Adjust the blur amount of the spinning background (0-200, default: 80)"
				min={0}
				max={200}
				step={1}
				value={backgroundBlur}
				onNumber={(value: number) => {
					console.log("Background Blur:", value);
					setBackgroundBlur((settings.backgroundBlur = value));
					if ((window as any).updateRadiantLyricsGlobalBackground) {
						(window as any).updateRadiantLyricsGlobalBackground();
					}
					if (
						settings.settingsAffectNowPlaying &&
						(window as any).updateRadiantLyricsNowPlayingBackground
					) {
						(window as any).updateRadiantLyricsNowPlayingBackground();
					}
				}}
			/>
			<LunaNumberSetting
				title="Background Brightness"
				desc="Adjust the brightness of the spinning background (0-100, default: 40)"
				min={0}
				max={100}
				step={1}
				value={backgroundBrightness}
				onNumber={(value: number) => {
					console.log("Background Brightness:", value);
					setBackgroundBrightness((settings.backgroundBrightness = value));
					if ((window as any).updateRadiantLyricsGlobalBackground) {
						(window as any).updateRadiantLyricsGlobalBackground();
					}
					if (
						settings.settingsAffectNowPlaying &&
						(window as any).updateRadiantLyricsNowPlayingBackground
					) {
						(window as any).updateRadiantLyricsNowPlayingBackground();
					}
				}}
			/>
			<LunaNumberSetting
				title="Spin Speed"
				desc="Adjust the rotation speed in seconds (10-120, default: 45) - Lower values = Faster rotation"
				min={10}
				max={120}
				step={1}
				value={spinSpeed}
				onNumber={(value: number) => {
					console.log("Spin Speed:", value);
					setSpinSpeed((settings.spinSpeed = value));
					if ((window as any).updateRadiantLyricsGlobalBackground) {
						(window as any).updateRadiantLyricsGlobalBackground();
					}
					if (
						settings.settingsAffectNowPlaying &&
						(window as any).updateRadiantLyricsNowPlayingBackground
					) {
						(window as any).updateRadiantLyricsNowPlayingBackground();
					}
				}}
			/>
			<AnySwitch
				title="Settings Affect Now Playing"
				desc="Apply background settings to Now Playing view"
				checked={settingsAffectNowPlaying}
				onChange={(_: unknown, checked: boolean) => {
					console.log(
						"Settings Affect Now Playing:",
						checked ? "enabled" : "disabled",
					);
					setSettingsAffectNowPlaying(
						(settings.settingsAffectNowPlaying = checked),
					);
					// Update Now Playing background immediately when setting changes
					if ((window as any).updateRadiantLyricsNowPlayingBackground) {
						(window as any).updateRadiantLyricsNowPlayingBackground();
					}
				}}
			/>
		</LunaSettings>
	);
};
