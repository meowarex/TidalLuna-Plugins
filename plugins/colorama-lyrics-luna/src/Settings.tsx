import { ReactiveStore } from "@luna/core";
import { LunaSettings, LunaNumberSetting, LunaSwitchSetting, LunaTextSetting } from "@luna/ui";
import React from "react";

export type ColoramaMode = "single" | "gradient" | "auto-single" | "auto-gradient";

export const settings = await ReactiveStore.getPluginStorage("ColoramaLyrics", {
  enabled: true,
  mode: "single" as ColoramaMode,
  // Store colors as ARGB hex (#AARRGGBB)
  singleColor: "#FFFFFFFF",
  gradientStart: "#FFFFFFFF",
  gradientEnd: "#88AAFFFF",
  gradientAngle: 0,
  customColors: [] as string[],
  excludeInactive: false
});

export const Settings = () => {
  const [enabled, setEnabled] = React.useState(settings.enabled);
  const [mode, setMode] = React.useState<ColoramaMode>(settings.mode);
  const [singleColor, setSingleColor] = React.useState(settings.singleColor);
  const [gradientStart, setGradientStart] = React.useState(settings.gradientStart);
  const [gradientEnd, setGradientEnd] = React.useState(settings.gradientEnd);
  const [gradientAngle, setGradientAngle] = React.useState(settings.gradientAngle);
  const [customInput, setCustomInput] = React.useState(settings.singleColor);
  const [customColors, setCustomColors] = React.useState(settings.customColors);
  const [showPicker, setShowPicker] = React.useState(false);
  const [isAnimatingIn, setIsAnimatingIn] = React.useState(false);
  const [shouldRender, setShouldRender] = React.useState(false);
  const [excludeInactive, setExcludeInactive] = React.useState(settings.excludeInactive);

  // Helpers for ARGB <-> components
  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
  const normalizeToARGB = (hex: string, fallback: string = "#FFFFFFFF"): string => {
    let v = hex.trim().toLowerCase();
    if (!v.startsWith('#')) v = `#${v}`;
    // #rgb or #rgba -> expand
    if (/^#([0-9a-f]{3,4})$/.test(v)) {
      const m = v.slice(1);
      const a = m.length === 4 ? m[3] : 'f';
      const r = m[0];
      const g = m[1];
      const b = m[2];
      v = `#${a}${r}${g}${b}${r}${g}${b}${a}`; // temporary, will reformat below
    }
    // #rrggbb
    if (/^#([0-9a-f]{6})$/.test(v)) {
      const m = v.slice(1);
      const rrggbb = m;
      const aa = 'ff';
      return `#${aa}${rrggbb}`.toUpperCase();
    }
    // #aarrggbb
    if (/^#([0-9a-f]{8})$/.test(v)) return v.toUpperCase();
    return fallback;
  };
  const setAlphaOnARGB = (argb: string, alpha01: number): string => {
    const a = clamp(Math.round(alpha01 * 255), 0, 255).toString(16).padStart(2, '0');
    const body = argb.replace('#', '').slice(2);
    return (`#${a}${body}`).toUpperCase();
  };
  const getAlpha01 = (argb: string): number => {
    const v = normalizeToARGB(argb);
    const a = parseInt(v.slice(1, 3), 16);
    return clamp(a / 255, 0, 1);
  };

  const colorPresets = [
    "#FFFFFFFF", "#FF0000FF", "#00FF00FF", "#0000FFFF", "#FFFF00FF", "#FF00FFFF", "#00FFFFFF",
    "#FF8800FF", "#8800FFFF", "#0088FFFF", "#88FF00FF", "#FF0088FF", "#00FF88FF",
    "#444444FF", "#888888FF", "#CCCCCCFF", "#1DB954FF", "#E22134FF", "#1976D2FF"
  ];

  const openPicker = () => {
    setShowPicker(true);
    setShouldRender(true);
    setTimeout(() => setIsAnimatingIn(true), 10);
  };
  const closePicker = () => {
    setIsAnimatingIn(false);
    setTimeout(() => {
      setShowPicker(false);
      setShouldRender(false);
    }, 200);
  };

  const argbColorRegex = /^#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})$/i;

  const addCustomColor = () => {
    const trimmed = customInput.trim();
    if (
      argbColorRegex.test(trimmed) &&
      !colorPresets.includes(trimmed) &&
      !customColors.includes(normalizeToARGB(trimmed))
    ) {
      const updated = [...customColors, normalizeToARGB(trimmed)];
      setCustomColors(updated);
      settings.customColors = updated;
    }
  };

  const removeCustomColor = (color: string) => {
    const updated = customColors.filter(c => c !== color);
    setCustomColors(updated);
    settings.customColors = updated;
  };

  const allColors = [...colorPresets, ...customColors];

  const requestApply = () => {
    (window as any).applyColoramaLyrics?.();
  };

  return (
    <LunaSettings>

      {/* Mode selection via dropdown */}
      <div style={{ padding: "8px 0", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ minWidth: 160 }}>
          <div style={{ fontWeight: "normal", fontSize: "1.075rem", marginBottom: 4 }}>Mode</div>
          <div style={{ opacity: 0.7, fontSize: 14 }}>Choose how lyrics are colored</div>
        </div>
        <select
          value={mode}
          onChange={(e) => {
            const next = e.target.value as ColoramaMode;
            setMode((settings.mode = next));
            requestApply();
          }}
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(255,255,255,0.05)",
            color: "#fff",
            cursor: "pointer"
          }}
        >
          <option value="single">Single</option>
          <option value="gradient">Gradient</option>
          <option value="auto-single">Auto (Cover)</option>
          <option value="auto-gradient">Auto Gradient</option>
        </select>
      </div>

      {/* Single color */}
      <div style={{ padding: "8px 0", display: mode === "single" ? "flex" : "none", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: "normal", fontSize: "1.075rem", marginBottom: 4 }}>Lyrics Color</div>
          <div style={{ opacity: 0.7, fontSize: 14 }}>Solid color (HEX/ARGB HEX)</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", position: "relative" }}>
          <button
            onClick={() => (showPicker ? closePicker() : openPicker())}
            style={{
              width: 32,
              height: 32,
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 6,
              cursor: "pointer",
              background: normalizeToARGB(singleColor)
            }}
          />
        </div>
      </div>
      <div style={{ display: mode === "single" ? 'block' : 'none' }}>
        <LunaNumberSetting
          title="Single Alpha"
          desc="Opacity of the single color (0-100%)"
          min={0}
          max={100}
          step={1}
          value={Math.round(getAlpha01(singleColor) * 100)}
          onNumber={(value: number) => {
            const next = setAlphaOnARGB(normalizeToARGB(singleColor), value / 100);
            setSingleColor((settings.singleColor = next));
            if (customInput) setCustomInput(next);
            requestApply();
          }}
        />
      </div>

      {/* Gradient controls */}
      <div style={{ padding: "8px 0", display: mode === "gradient" ? "block" : "none" }}>
        <div style={{ fontWeight: "normal", fontSize: "1.075rem", marginBottom: 4 }}>Gradient</div>
        <div style={{ opacity: 0.7, fontSize: 14, marginBottom: 8 }}>Pick start/end and angle</div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            onClick={() => {
              setCustomInput(gradientStart);
              openPicker();
            }}
            title="Start Color"
            style={{ width: 32, height: 32, border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, background: normalizeToARGB(gradientStart) }}
          />
          <button
            onClick={() => {
              setCustomInput(gradientEnd);
              openPicker();
            }}
            title="End Color"
            style={{ width: 32, height: 32, border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, background: normalizeToARGB(gradientEnd) }}
          />
        </div>
        <LunaNumberSetting
          title="Start Alpha"
          desc="Opacity of the gradient start (0-100%)"
          min={0}
          max={100}
          step={1}
          value={Math.round(getAlpha01(gradientStart) * 100)}
          onNumber={(value: number) => {
            const next = setAlphaOnARGB(normalizeToARGB(gradientStart), value / 100);
            setGradientStart((settings.gradientStart = next));
            requestApply();
          }}
        />
        <LunaNumberSetting
          title="End Alpha"
          desc="Opacity of the gradient end (0-100%)"
          min={0}
          max={100}
          step={1}
          value={Math.round(getAlpha01(gradientEnd) * 100)}
          onNumber={(value: number) => {
            const next = setAlphaOnARGB(normalizeToARGB(gradientEnd), value / 100);
            setGradientEnd((settings.gradientEnd = next));
            requestApply();
          }}
        />
        <LunaNumberSetting
          title="Gradient Angle"
          desc="Angle in degrees (0-360)"
          min={0}
          max={360}
          step={1}
          value={gradientAngle}
          onNumber={(value: number) => {
            setGradientAngle((settings.gradientAngle = value));
            requestApply();
          }}
        />
      </div>

      {/* Modal for picking and managing colors (reused) */}
      {shouldRender && (
        <>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.6)",
              zIndex: 1000,
              opacity: isAnimatingIn ? 1 : 0,
              transition: "opacity 0.2s ease"
            }}
            onClick={closePicker}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              background: "rgba(20,20,20,0.98)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 16,
              padding: 20,
              minWidth: 320,
              maxWidth: "90vw",
              maxHeight: "90vh",
              zIndex: 1001,
              boxShadow: "0 20px 40px rgba(0,0,0,0.7)",
              opacity: isAnimatingIn ? 1 : 0,
              transform: isAnimatingIn ? "translate(-50%, -50%) scale(1)" : "translate(-50%, -50%) scale(0.9)",
              transition: "all 0.2s ease"
            }}
          >
            <div style={{ marginBottom: 12, color: "#fff", fontWeight: "bold", fontSize: 14 }}>Choose Color (ARGB HEX)</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginBottom: 16 }}>
              {allColors.map((color, index) => (
                <button
                  key={index}
                  onClick={() => {
                    if (mode === "single") {
                      const next = normalizeToARGB(color);
                      setSingleColor((settings.singleColor = next));
                    } else if (mode === "gradient") {
                      // Toggle which endpoint to update based on last edited input
                      if (customInput.toLowerCase() === gradientEnd.toLowerCase()) {
                        setGradientEnd((settings.gradientEnd = normalizeToARGB(color)));
                      } else {
                        setGradientStart((settings.gradientStart = normalizeToARGB(color)));
                      }
                    }
                    setCustomInput(normalizeToARGB(color));
                    requestApply();
                    closePicker();
                  }}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: normalizeToARGB(color),
                    cursor: "pointer"
                  }}
                />
              ))}
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginBottom: 6 }}>Custom ARGB Hex (#AARRGGBB)</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const trimmed = customInput.trim();
                      if (argbColorRegex.test(trimmed)) {
                        if (mode === "single") {
                          setSingleColor((settings.singleColor = normalizeToARGB(trimmed)));
                        } else if (mode === "gradient") {
                          if (customInput.toLowerCase() === gradientEnd.toLowerCase()) {
                            setGradientEnd((settings.gradientEnd = normalizeToARGB(trimmed)));
                          } else {
                            setGradientStart((settings.gradientStart = normalizeToARGB(trimmed)));
                          }
                        }
                        requestApply();
                      }
                      addCustomColor();
                    }
                  }}
                  placeholder="#AARRGGBB"
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(255,255,255,0.1)",
                    color: "#fff",
                    fontSize: 14,
                    fontFamily: "monospace",
                    boxSizing: "border-box"
                  }}
                />
                <button
                  onClick={() => {
                    const trimmed = customInput.trim();
                    if (argbColorRegex.test(trimmed)) {
                      if (mode === "single") {
                        setSingleColor((settings.singleColor = normalizeToARGB(trimmed)));
                      } else if (mode === "gradient") {
                        if (customInput.toLowerCase() === gradientEnd.toLowerCase()) {
                          setGradientEnd((settings.gradientEnd = normalizeToARGB(trimmed)));
                        } else {
                          setGradientStart((settings.gradientStart = normalizeToARGB(trimmed)));
                        }
                      }
                      requestApply();
                    }
                    addCustomColor();
                  }}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    border: "1px solid rgba(255,255,255,0.3)",
                    background: "rgba(255,255,255,0.15)",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s ease"
                  }}
                >
                  +
                </button>
              </div>
            </div>
            <button
              onClick={closePicker}
              style={{
                width: "100%",
                padding: 8,
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.1)",
                color: "#fff",
                cursor: "pointer",
                fontSize: 12
              }}
            >
              Done
            </button>
          </div>
        </>
      )}
      <LunaSwitchSetting
        title="Exclude Inactive | Experimental"
        desc="Apply color/gradient only to the currently active lyric line"
        checked={excludeInactive}
        onChange={(_: unknown, checked: boolean) => {
          setExcludeInactive((settings.excludeInactive = checked));
          requestApply();
        }}
      />
    </LunaSettings>
  );
};


