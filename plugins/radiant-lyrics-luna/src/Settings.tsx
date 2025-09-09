import { ReactiveStore } from "@luna/core";
import { LunaSettings, LunaSwitchSetting, LunaNumberSetting } from "@luna/ui";
import React from "react";

export const settings = await ReactiveStore.getPluginStorage("RadiantLyrics", {
	hideUIEnabled: true,
	trackTitleGlow: false,
	playerBarVisible: false,
	lyricsGlowEnabled: true,
	textGlow: 20,
	spinningCoverEverywhere: true,
	performanceMode: false,
	spinningArtEnabled: true,
	backgroundContrast: 120,
	backgroundBlur: 80,
	backgroundBrightness: 40,
	spinSpeed: 45,
	settingsAffectNowPlaying: true,
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
	const [spinningCoverEverywhere, setSpinningCoverEverywhere] = React.useState(
		settings.spinningCoverEverywhere,
	);
	const [performanceMode, setPerformanceMode] = React.useState(
		settings.performanceMode,
	);
	const [spinningArtEnabled, setSpinningArtEnabled] = React.useState(
		settings.spinningArtEnabled,
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

	// Use a permissive wrapper to align with current usage props
	const AnySwitch = LunaSwitchSetting as unknown as React.ComponentType<
		Record<string, unknown>
	>;

	return (
		<LunaSettings>
			<AnySwitch
				title="Lyrics Glow Effect"
				desc="Enable glowing effect for lyrics & Font Stytling Changes"
				checked={lyricsGlowEnabled}
				onChange={(_: void, checked: boolean) => {
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
				onChange={(_: void, checked: boolean) => {
					setTrackTitleGlow((settings.trackTitleGlow = checked));
					if ((window as any).updateRadiantLyricsStyles) {
						(window as any).updateRadiantLyricsStyles();
					}
				}}
			/>
			<AnySwitch
				title="Hide UI Feature"
				desc="Enable hide/unhide UI functionality with toggle buttons"
				checked={hideUIEnabled}
				onChange={(_: void, checked: boolean) => {
					setHideUIEnabled((settings.hideUIEnabled = checked));
				}}
			/>
			<AnySwitch
				title="Player Bar Visibility in Hide UI Mode"
				desc="Keep player bar visible when UI is hidden"
				checked={playerBarVisible}
				onChange={(_: void, checked: boolean) => {
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
				checked={spinningCoverEverywhere}
				onChange={(_: void, checked: boolean) => {
					console.log(
						"Spinning Cover Everywhere:",
						checked ? "enabled" : "disabled",
					);
					setSpinningCoverEverywhere(
						(settings.spinningCoverEverywhere = checked),
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
				onChange={(_: void, checked: boolean) => {
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
				checked={spinningArtEnabled}
				onChange={(_: void, checked: boolean) => {
					console.log(
						"Background Cover Spin:",
						checked ? "enabled" : "disabled",
					);
					setSpinningArtEnabled((settings.spinningArtEnabled = checked));
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
				onChange={(_: void, checked: boolean) => {
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
