import { Tracer } from "@luna/core";

import { settings } from "./Settings";

const { trace } = Tracer("[Radiant Lyrics]");

const sylTrace = (...args: unknown[]) => {
	if (settings.syllableLogging) trace.log(...args);
};

export const RL_PLATFORM = "rl";

const RL_ACCESS_TOKEN_ID = "58hy4s86";
const RL_ACCESS_TOKEN = "xjehy2lfg5h5mjwotoxrcqugam";
// Yup that's right, plaintext token in a public Repo!!
// The API does not return sensitive data & won't be plain text like this in the future <3

let cachedPublicIP: string | undefined;

export async function ip(): Promise<string | undefined> {
	if (cachedPublicIP) return cachedPublicIP;
	try {
		const res = await fetch("https://api.ipify.org?format=text");
		if (res.ok) cachedPublicIP = (await res.text()).trim();
	} catch {}
	return cachedPublicIP;
}

export async function auth(): Promise<Record<string, string>> {
	const clientIP = await ip();
	return {
		"P-Access-Token-Id": RL_ACCESS_TOKEN_ID,
		"P-Access-Token": RL_ACCESS_TOKEN,
		"x-client-ip": clientIP ?? "null",
	};
}

// Platform param (just for DX logging)
const platformQs = `platform=${encodeURIComponent(RL_PLATFORM)}`;

// Query string & params
function query(
	title: string,
	artist: string,
	isrc: string | undefined,
	options?: { romanize?: boolean; flush?: boolean },
): string {
	let q = `?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`;
	if (isrc) q += `&isrc=${encodeURIComponent(isrc)}`;
	if (options?.romanize) q += "&romanize=true";
	if (options?.flush) q += "&flush=true";
	q += `&${platformQs}`;
	return q;
}

// Response types

export interface WordTiming {
	text: string;
	time: number;
	duration: number;
	isBackground: boolean;
	romanized?: string;
}

export interface WordLine {
	text: string;
	startTime: number;
	duration: number;
	endTime: number;
	syllabus: WordTiming[];
	element: {
		key: string;
		songPart?: string;
		songPartIndex?: number;
		singer: string;
	};
	translation: string | null;
	romanized?: string;
}

export interface ApiLine {
	text: string;
	startTime: number;
	duration: number;
	endTime: number;
	syllabus?: WordTiming[];
	element?: {
		key: string;
		songPart?: string;
		songPartIndex?: number;
		singer?: string;
	};
	translation?: string | null;
	romanized?: string;
}

export interface WordLyricsResponse {
	type: "Word";
	data: WordLine[];
	metadata: {
		source: string;
		title: string;
		language: string;
		totalDuration: string;
		agents?: Record<string, { type: string; name: string; alias: string }>;
		songParts?: Array<{ name: string; time: number; duration: number }>;
	};
	_cached?: boolean;
}

export interface LineLyricsResponse {
	type: "Line";
	data: ApiLine[];
	metadata: {
		source: string;
		title: string;
		language: string;
		totalDuration: string;
		agents?: Record<string, { type: string; name: string; alias: string }>;
		songParts?: Array<{ name: string; time: number; duration: number }>;
	};
	_cached?: boolean;
}

export type LyricsApiResponse = WordLyricsResponse | LineLyricsResponse;

type FetchOutcome =
	| { status: "ok"; data: LyricsApiResponse | null }
	| { status: "404" }
	| { status: "500" }
	| { status: "err" };

// Lyrics lookup (network)
export async function fetchLyrics(
	title: string,
	artist: string,
	isrc: string | undefined,
	romanize: boolean,
): Promise<LyricsApiResponse | null> {
	const params = query(title, artist, isrc, { romanize });
	const atomixUrl = `https://api.atomix.one/rl-api${params}`;
	const fallbackUrl = `https://rl-api.kineticsand.net/lyrics${params}`;

	const rlApiHeaders = await auth();

	const tryFetch = async (url: string, useAtomixAuth: boolean): Promise<FetchOutcome> => {
		try {
			sylTrace(`RL API: Fetching lyrics: ${url}`);
			const res = await fetch(url, {
				headers: useAtomixAuth ? rlApiHeaders : undefined,
			});
			if (!res.ok) {
				trace.log(`RL API: fetch failed: ${res.status} from ${url}`);
				if (res.status === 404) return { status: "404" };
				return res.status === 500 ? { status: "500" } : { status: "err" };
			}
			const data = (await res.json()) as LyricsApiResponse;
			if (!data?.data || !Array.isArray(data.data)) {
				trace.log("Lyrics API returned invalid payload");
				return { status: "ok", data: null };
			}
			if (data.type !== "Word" && data.type !== "Line") {
				trace.log("Lyrics not available in supported format");
				return { status: "ok", data: null };
			}
			return { status: "ok", data };
		} catch (err) {
			trace.log(`RL API: fetch error from ${url}: ${err}`);
			return { status: "err" };
		}
	};

	const primary = await tryFetch(atomixUrl, true);
	if (primary.status === "ok") return primary.data;
	if (primary.status === "404") {
		trace.log("RL API: 404 — no API lyrics exist for this track");
		return null;
	}
	if (primary.status === "500") {
		trace.log("RL API: 500 (Execution Timeout) — fallback");
	}

	const fallback = await tryFetch(fallbackUrl, false);
	if (fallback.status === "ok") return fallback.data;
	if (fallback.status === "404") {
		trace.log("RL API: 404 from fallback — no API lyrics exist for this track");
		return null;
	}
	if (fallback.status === "500") {
		trace.log("RL API: 500 from fallback — API IS ACTUALLY BORKED!");
		return null;
	}

	trace.log("RL API: All Endpoints Failed");
	return null;
}

export async function flushLyrics(track: {
	title: string;
	artist: string;
	isrc?: string;
}): Promise<
	| { ok: true; data: LyricsApiResponse & { _flush?: string } }
	| { ok: false; status: number; notFound: boolean }
> {
	const q = query(track.title, track.artist, track.isrc, {
		flush: true,
	});
	const url = `https://api.atomix.one/rl-api${q}`;
	const headers = await auth();
	const res = await fetch(url, { headers });
	if (res.status === 404) {
		return { ok: false, status: 404, notFound: true };
	}
	if (!res.ok) {
		return { ok: false, status: res.status, notFound: false };
	}
	const data = (await res.json()) as LyricsApiResponse & { _flush?: string };
	return { ok: true, data };
}

// Romanize
export async function romanizeLyrics(
	lineTexts: string[],
): Promise<string[] | null> {
	if (lineTexts.length === 0) return null;

	const payload = {
		type: "Line" as const,
		data: lineTexts.map((text, idx) => ({
			text,
			startTime: idx,
			duration: 0,
			endTime: idx,
		})),
	};

	const romanizeQuery = `?${platformQs}`;
	const urls: { url: string; useAtomixAuth: boolean }[] = [
		{
			url: `https://api.atomix.one/rl-api/romanize${romanizeQuery}`,
			useAtomixAuth: true,
		},
		{
			url: `https://rl-api.kineticsand.net/romanize${romanizeQuery}`,
			useAtomixAuth: false,
		},
	];

	for (const { url, useAtomixAuth } of urls) {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 5000);
		try {
			const romanizeHeaders: Record<string, string> = {
				"content-type": "application/json",
			};
			if (useAtomixAuth) {
				Object.assign(romanizeHeaders, await auth());
			}
			const res = await fetch(url, {
				method: "POST",
				headers: romanizeHeaders,
				body: JSON.stringify(payload),
				signal: controller.signal,
			});
			clearTimeout(timeout);
			if (!res.ok) {
				trace.log(`Romanize: request failed ${res.status} | ${url}`);
				continue;
			}

			const data = (await res.json()) as {
				type?: string;
				data?: Array<{ text?: string; romanized?: string }>;
			};
			if (!Array.isArray(data?.data)) continue;

			return lineTexts.map((original, idx) => {
				const item = data.data?.[idx];
				return item?.romanized ?? item?.text ?? original;
			});
		} catch (err) {
			clearTimeout(timeout);
			if (err instanceof DOMException && err.name === "AbortError") {
				trace.log(`Romanize: request timed out | ${url}`);
			} else {
				trace.log(`Romanize: request error | ${url} | ${err}`);
			}
		}
	}

	return null;
}
