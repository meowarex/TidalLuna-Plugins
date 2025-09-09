import { ReactiveStore } from "@luna/core";
import { LunaSettings } from "@luna/ui";
import React from "react";

export const settings = await ReactiveStore.getPluginStorage("ElementHider", {
	hiddenElements: [] as Array<{
		selector: string;
		tagName: string;
		className: string;
		textContent: string;
		timestamp: number;
	}>,
});

export const Settings = () => {
	return null;
};
