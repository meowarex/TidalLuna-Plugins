import { LunaUnload, Tracer } from "@luna/core";
import { StyleTag, observe, observePromise, PlayState } from "@luna/lib";
import { settings, Settings } from "./Settings";

import styles from "file://styles.css?minify";

export const { trace } = Tracer("[Colorama Lyrics]");
export { Settings };

export const unloads = new Set<LunaUnload>();

const styleTag = new StyleTag("ColoramaLyrics", unloads, styles);

// Simple dominant color extraction from current cover art
async function getCoverArtElement(): Promise<HTMLImageElement | null> {
  const img = document.querySelector('figure[class*="_albumImage"] > div > div > div > img') as HTMLImageElement | null;
  if (img) return img;
  const video = document.querySelector('figure[class*="_albumImage"] > div > div > div > video') as HTMLVideoElement | null;
  if (video) {
    const poster = video.getAttribute("poster");
    if (!poster) return null;
    const tempImg = new Image();
    tempImg.crossOrigin = "anonymous";
    tempImg.src = poster;
    await new Promise<void>((resolve) => {
      tempImg.onload = () => resolve();
      tempImg.onerror = () => resolve();
    });
    return tempImg as unknown as HTMLImageElement;
  }
  return null;
}

function getDominantColorsFromImage(img: HTMLImageElement, count: number = 2): string[] {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return ["#ffffff", "#88aaff"]; // fallback
    const w = 64;
    const h = 64;
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;

    // Simple k-means-ish binning into 16 buckets per channel
    const buckets = new Map<string, number>();
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const key = `${Math.round(r/16)},${Math.round(g/16)},${Math.round(b/16)}`;
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    const sorted = [...buckets.entries()].sort((a, b) => b[1] - a[1]);
    const picked = sorted.slice(0, Math.max(1, count)).map(([key]) => {
      const [r, g, b] = key.split(',').map(v => parseInt(v, 10) * 16);
      return `#${[r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`;
    });
    return picked;
  } catch {
    return ["#ffffff", "#88aaff"]; // fallback
  }
}

function applySingleColor(color: string) {
  document.documentElement.style.setProperty('--cl-lyrics-color', color);
  document.documentElement.style.setProperty('--cl-glow1', color);
  document.documentElement.style.setProperty('--cl-glow2', color);
  document.documentElement.style.removeProperty('--cl-grad-start');
  document.documentElement.style.removeProperty('--cl-grad-end');
  document.documentElement.style.removeProperty('--cl-grad-angle');
  document.body.classList.remove('colorama-gradient');
  document.body.classList.add('colorama-single');
}

function applyGradient(start: string, end: string, angle: number) {
  document.documentElement.style.setProperty('--cl-grad-start', start);
  document.documentElement.style.setProperty('--cl-grad-end', end);
  document.documentElement.style.setProperty('--cl-grad-angle', `${angle}deg`);
  document.documentElement.style.setProperty('--cl-glow1', start);
  document.documentElement.style.setProperty('--cl-glow2', end);
  document.body.classList.remove('colorama-single');
  document.body.classList.add('colorama-gradient');
}

async function applyAutoColors(gradient: boolean) {
  const img = await getCoverArtElement();
  if (!img) return;
  const colors = getDominantColorsFromImage(img, gradient ? 2 : 1);
  if (gradient) {
    const start = colors[0] ?? settings.gradientStart;
    const end = colors[1] ?? settings.gradientEnd;
    applyGradient(start, end, settings.gradientAngle);
  } else {
    const color = colors[0] ?? settings.singleColor;
    applySingleColor(color);
  }
}

function applyColoramaLyrics(): void {
  if (!settings.enabled) {
    document.body.classList.remove('colorama-single', 'colorama-gradient');
    return;
  }

  // Toggle only-active-line mode class
  if (settings.onlyActiveLine) {
    document.body.classList.add('colorama-only-active');
  } else {
    document.body.classList.remove('colorama-only-active');
  }
  switch (settings.mode) {
    case "single":
      applySingleColor(settings.singleColor);
      break;
    case "gradient":
      applyGradient(settings.gradientStart, settings.gradientEnd, settings.gradientAngle);
      break;
    case "auto-single":
      applyAutoColors(false);
      break;
    case "auto-gradient":
      applyAutoColors(true);
      break;
  }
}

(window as any).applyColoramaLyrics = applyColoramaLyrics;

// Re-apply on track changes (for auto modes)
function observeTrackChanges(): void {
  let lastTrackId: string | null = null;
  const check = () => {
    const currentTrackId = PlayState.playbackContext?.actualProductId;
    if (currentTrackId && currentTrackId !== lastTrackId) {
      lastTrackId = currentTrackId;
      if (settings.mode.startsWith("auto")) {
        setTimeout(() => applyColoramaLyrics(), 200);
      }
    }
  };
  const interval = setInterval(check, 500);
  unloads.add(() => clearInterval(interval));
  check();
}

// Initial apply and observers
setTimeout(() => applyColoramaLyrics(), 200);
observeTrackChanges();

// Ensure compatibility: re-apply after Radiant updates its styles/backgrounds
function hookRadiantUpdates(): void {
  const w = window as any;
  const wrap = (name: string) => {
    const fn = w[name];
    if (typeof fn === 'function' && !fn.__coloramaPatched) {
      const orig = fn.bind(w);
      const patched = (...args: unknown[]) => {
        const result = orig(...args);
        try { applyColoramaLyrics(); } catch {}
        return result;
      };
      (patched as any).__coloramaPatched = true;
      w[name] = patched;
    }
  };
  wrap('updateRadiantLyricsStyles');
  wrap('updateRadiantLyricsNowPlayingBackground');
  wrap('updateRadiantLyricsGlobalBackground');
  wrap('updateRadiantLyricsTextGlow');
}

setTimeout(() => hookRadiantUpdates(), 0);


