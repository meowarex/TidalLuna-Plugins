import { LunaUnload, Tracer } from "@luna/core";
import { StyleTag, PlayState } from "@luna/lib";
import { settings, Settings } from "./Settings";

import styles from "file://styles.css?minify";

export const { trace } = Tracer("[Colorama Lyrics]");
export { Settings };

export const unloads = new Set<LunaUnload>();

new StyleTag("ColoramaLyrics", unloads, styles);

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

// build rgba() from hex + alpha percentage
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  let v = hex.trim();
  if (!v.startsWith('#')) v = `#${v}`;
  if (/^#([0-9a-fA-F]{3})$/.test(v)) {
    const r = parseInt(v[1] + v[1], 16);
    const g = parseInt(v[2] + v[2], 16);
    const b = parseInt(v[3] + v[3], 16);
    return { r, g, b };
  }
  if (/^#([0-9a-fA-F]{6})$/.test(v)) {
    const r = parseInt(v.slice(1, 3), 16);
    const g = parseInt(v.slice(3, 5), 16);
    const b = parseInt(v.slice(5, 7), 16);
    return { r, g, b };
  }
  // 8-digit hex expects #AARRGGBB. Indices 1-3 are the alpha byte (ignored here),
  // so r/g/b are extracted from v.slice(3,5), v.slice(5,7), v.slice(7,9) respectively.
  if (/^#([0-9a-fA-F]{8})$/.test(v)) {
    const r = parseInt(v.slice(3, 5), 16);
    const g = parseInt(v.slice(5, 7), 16);
    const b = parseInt(v.slice(7, 9), 16);
    return { r, g, b };
  }
  return null;
}

function rgbaFromHexAndAlpha(hex: string, alphaPercent: number | undefined): string {
  const rgb = hexToRgb(hex);
  const a = Math.max(0.05, Math.min(100, alphaPercent ?? 100)) / 100;
  if (!rgb) return `rgba(255,255,255,${a})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}

function applySingleColor(color: string) {
  const alpha = (settings as any).singleAlpha ?? 100;
  const rgba = rgbaFromHexAndAlpha(color, alpha);
  document.documentElement.style.setProperty('--cl-lyrics-color', rgba);
  document.documentElement.style.setProperty('--cl-glow1', rgba);
  document.documentElement.style.setProperty('--cl-glow2', rgba);
  document.documentElement.style.removeProperty('--cl-grad-start');
  document.documentElement.style.removeProperty('--cl-grad-end');
  document.documentElement.style.removeProperty('--cl-grad-angle');
  document.body.classList.remove('colorama-gradient');
  document.body.classList.add('colorama-single');
}

function applyGradient(start: string, end: string, angle: number) {
  const startAlpha = (settings as any).gradientStartAlpha ?? 100;
  const endAlpha = (settings as any).gradientEndAlpha ?? 100;
  const startRgba = rgbaFromHexAndAlpha(start, startAlpha);
  const endRgba = rgbaFromHexAndAlpha(end, endAlpha);
  document.documentElement.style.setProperty('--cl-grad-start', startRgba);
  document.documentElement.style.setProperty('--cl-grad-end', endRgba);
  document.documentElement.style.setProperty('--cl-grad-angle', `${angle}deg`);
  document.documentElement.style.setProperty('--cl-glow1', startRgba);
  document.documentElement.style.setProperty('--cl-glow2', endRgba);
  document.body.classList.remove('colorama-single');
  document.body.classList.add('colorama-gradient');
}

function resetModeClasses(): void {
  document.body.classList.remove('colorama-single', 'colorama-gradient');
}

async function applyCoverColors(gradient: boolean) {
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
  if (settings.excludeInactive) {
    document.body.classList.add('colorama-only-active');
  } else {
    document.body.classList.remove('colorama-only-active');
  }
  resetModeClasses();
  switch (settings.mode) {
    case "single":
      applySingleColor(settings.singleColor);
      break;
    case "gradient-experimental":
      applyGradient(settings.gradientStart, settings.gradientEnd, settings.gradientAngle);
      break;
    case "cover":
      applyCoverColors(false);
      break;
    case "cover-gradient":
      applyCoverColors(true);
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
      if (settings.mode === 'cover' || settings.mode === 'cover-gradient') {
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

// for some reason, re-apply after Radiant updates its styles/backgrounds
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


