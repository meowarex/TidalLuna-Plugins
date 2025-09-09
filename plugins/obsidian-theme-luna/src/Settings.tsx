import { ReactiveStore } from "@luna/core";
import { LunaSettings, LunaSwitchSetting } from "@luna/ui";
import React from "react";

export const settings = await ReactiveStore.getPluginStorage("OLEDTheme", {
	qualityColorMatchedSeekBar: true,
	oledFriendlyButtons: true,
	lightMode: false,
});

export const Settings = () => {
	const [qualityColorMatchedSeekBar, setQualityColorMatchedSeekBar] =
		React.useState(settings.qualityColorMatchedSeekBar);
	const [oledFriendlyButtons, setOledFriendlyButtons] = React.useState(
		settings.oledFriendlyButtons,
	);
	const [lightMode, setLightMode] = React.useState(settings.lightMode);

	return (
		<LunaSettings>
			<LunaSwitchSetting
				title="Quality Color Matched Seek Bar"
				desc="Color the Seek/Progress Bar based on audio quality"
				checked={qualityColorMatchedSeekBar}
				onChange={(_, checked) => {
					console.log(
						"Quality Color Matched Seek Bar:",
						checked ? "enabled" : "disabled",
					);
					setQualityColorMatchedSeekBar(
						(settings.qualityColorMatchedSeekBar = checked),
					);
					// Update styles immediately when setting changes
					if ((window as any).updateOLEDThemeStyles) {
						(window as any).updateOLEDThemeStyles();
					}
				}}
			/>
			<LunaSwitchSetting
				title="OLED Friendly Buttons"
				desc="Remove button styling from OLED theme to keep buttons with original Tidal appearance"
				checked={oledFriendlyButtons}
				onChange={(_, checked) => {
					console.log(
						"OLED Friendly Buttons:",
						checked ? "enabled" : "disabled",
					);
					setOledFriendlyButtons((settings.oledFriendlyButtons = checked));
					// Update styles immediately when setting changes
					if ((window as any).updateOLEDThemeStyles) {
						(window as any).updateOLEDThemeStyles();
					}
				}}
			/>
			<LunaSwitchSetting
				title="Light Mode | Experimental"
				desc="Use the light theme instead of the dark theme. This is experimental and may not work as expected."
				checked={lightMode}
				onChange={(_, checked) => {
					console.log("Light Mode:", checked ? "enabled" : "disabled");
					setLightMode((settings.lightMode = checked));
					// Update styles immediately when setting changes
					if ((window as any).updateOLEDThemeStyles) {
						(window as any).updateOLEDThemeStyles();
					}
				}}
			/>
		</LunaSettings>
	);
};
