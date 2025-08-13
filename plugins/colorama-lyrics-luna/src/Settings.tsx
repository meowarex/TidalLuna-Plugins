import { ReactiveStore } from "@luna/core";
import { LunaSettings, LunaSwitchSetting } from "@luna/ui";
import React from "react";

export type ColoramaMode = "single" | "gradient-experimental" | "cover" | "cover-gradient";

export const settings = await ReactiveStore.getPluginStorage("ColoramaLyrics", {
  enabled: true,
  mode: "single" as ColoramaMode,
  // Store colors as RGB hex (#RRGGBB) and opacity separately (0-100)
  singleColor: "#FFFFFF",
  singleAlpha: 100,
  gradientStart: "#FFFFFF",
  gradientStartAlpha: 100,
  gradientEnd: "#AAFFFF",
  gradientEndAlpha: 100,
  gradientAngle: 0,
  customColors: [] as string[],
  excludeInactive: false
});

export const Settings = () => {
  const [enabled, setEnabled] = React.useState(settings.enabled);
  const [mode, setMode] = React.useState<ColoramaMode>(settings.mode);
  const [singleColor, setSingleColor] = React.useState(settings.singleColor);
  const [singleAlpha, setSingleAlpha] = React.useState<number>(settings.singleAlpha ?? 100);
  const [gradientStart, setGradientStart] = React.useState(settings.gradientStart);
  const [gradientStartAlpha, setGradientStartAlpha] = React.useState<number>(settings.gradientStartAlpha ?? 100);
  const [gradientEnd, setGradientEnd] = React.useState(settings.gradientEnd);
  const [gradientEndAlpha, setGradientEndAlpha] = React.useState<number>(settings.gradientEndAlpha ?? 100);
  const [gradientAngle, setGradientAngle] = React.useState(settings.gradientAngle);
  const [customInput, setCustomInput] = React.useState(settings.singleColor);
  const [customColors, setCustomColors] = React.useState(settings.customColors);
  const [showPicker, setShowPicker] = React.useState(false);
  const [isAnimatingIn, setIsAnimatingIn] = React.useState(false);
  const [shouldRender, setShouldRender] = React.useState(false);
  const [excludeInactive, setExcludeInactive] = React.useState(settings.excludeInactive);
  const [activeEndpoint, setActiveEndpoint] = React.useState<'single' | 'start' | 'end'>('single');
  const AnySwitch = LunaSwitchSetting as unknown as React.ComponentType<any>;

  // Helper for HEX normalization
  const normalizeToRGB = (hex: string, fallback: string = "#FFFFFF"): string => {
    let v = hex.trim().toLowerCase();
    if (!v.startsWith('#')) v = `#${v}`;
    // #rgb or #rgba -> expand
    if (/^#([0-9a-f]{3,4})$/.test(v)) {
      const m = v.slice(1);
      const r = m[0];
      const g = m[1];
      const b = m[2];
      // ignore alpha if provided (#rgba)
      return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
    }
    // #aarrggbb -> strip alpha
    if (/^#([0-9a-f]{8})$/.test(v)) {
      const rrggbb = v.slice(3);
      return `#${rrggbb}`.toUpperCase();
    }
    // #rrggbb
    if (/^#([0-9a-f]{6})$/.test(v)) return v.toUpperCase();
    return fallback;
  };

  const colorPresets = [
    "#FFFFFF", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF",
    "#FF8800", "#8800FF", "#0088FF", "#88FF00", "#FF0088", "#00FF88",
    "#444444", "#888888", "#CCCCCC", "#1DB954", "#E22134", "#1976D2"
  ];

  const openPicker = (endpoint: 'single' | 'start' | 'end' = 'single') => {
    setActiveEndpoint(endpoint);
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

  const hexColorRegex = /^#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})$/i;

  const applyCustomInputColor = (raw: string, updateInput: boolean): void => {
    const trimmed = raw.trim();
    if (!hexColorRegex.test(trimmed)) return;
    if (mode === "single") {
      const next = normalizeToRGB(trimmed);
      setSingleColor((settings.singleColor = next));
      if (updateInput) setCustomInput(next);
    } else if (mode === "gradient-experimental") {
      const norm = normalizeToRGB(trimmed);
      if (activeEndpoint === 'end') {
        setGradientEnd((settings.gradientEnd = norm));
      } else {
        setGradientStart((settings.gradientStart = norm));
      }
      if (updateInput) setCustomInput(norm);
    }
    requestApply();
  };

  const addCustomColor = () => {
    const trimmed = customInput.trim();
    if (
      hexColorRegex.test(trimmed) &&
      !colorPresets.includes(trimmed) &&
      !customColors.includes(normalizeToRGB(trimmed))
    ) {
      const updated = [...customColors, normalizeToRGB(trimmed)];
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

      {/* Mode selection via dropdown (aligned right) */}
      <div style={{ padding: "8px 0", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontWeight: "normal", fontSize: "1.075rem" }}>Mode</div>
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
            background: "rgba(255,255,255,0.08)",
            color: "#fff",
            cursor: "pointer",
            marginLeft: "auto",
            minWidth: 180
          }}
        >
          <option value="single" style={{ color: '#000', background: '#fff' }}>Single</option>
          <option value="gradient-experimental" style={{ color: '#000', background: '#fff' }}>Gradient - Experimental</option>
          <option value="cover" style={{ color: '#000', background: '#fff' }}>Cover - Experimental</option>
          <option value="cover-gradient" style={{ color: '#000', background: '#fff' }}>Cover (Gradient) - Experimental</option>
        </select>
      </div>

      {/* Single color */}
      <div style={{ padding: "8px 0", display: mode === "single" ? "flex" : "none", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: "normal", fontSize: "1.075rem", marginBottom: 4 }}>Lyrics Color</div>
          <div style={{ opacity: 0.7, fontSize: 14 }}>Set lyrics color</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", position: "relative" }}>
          <button
            onClick={() => (showPicker ? closePicker() : openPicker('single'))}
            style={{
              width: 32,
              height: 32,
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 6,
              cursor: "pointer",
              background: normalizeToRGB(singleColor)
            }}
          />
        </div>
      </div>
      

      {/* Gradient controls (open picker) */}
      <div style={{ padding: "8px 0", display: mode === "gradient-experimental" ? "flex" : "none", justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: "normal", fontSize: "1.075rem", marginBottom: 4 }}>Gradient (Experimental)</div>
          <div style={{ opacity: 0.7, fontSize: 14 }}>Set colors & angle</div>
        </div>
        <button
          onClick={() => { setCustomInput(gradientStart); openPicker('start'); }}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.08)',
            color: '#fff',
            cursor: 'pointer'
          }}
        >
          Configure
        </button>
      </div>

      {/* Cover gradient controls (open picker for angle) */}
      <div style={{ padding: "8px 0", display: mode === "cover-gradient" ? "flex" : "none", justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: "normal", fontSize: "1.075rem", marginBottom: 4 }}>Cover (Gradient) - Experimental</div>
          <div style={{ opacity: 0.7, fontSize: 14 }}>Set angle</div>
        </div>
        <button
          onClick={() => openPicker('start')}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.08)',
            color: '#fff',
            cursor: 'pointer'
          }}
        >
          Configure
        </button>
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
            <div style={{ marginBottom: 12, color: "#fff", fontWeight: "bold", fontSize: 14 }}>
              {mode === 'single' ? 'Single Color' : 'Gradient Colors'}
            </div>
              {mode === 'gradient-experimental' && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Editing</div>
                <button
                  onClick={() => { setActiveEndpoint('start'); setCustomInput(gradientStart); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px', borderRadius: 8,
                    border: activeEndpoint === 'start' ? '1px solid rgba(255,255,255,0.5)' : '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255,255,255,0.05)', color: '#fff', cursor: 'pointer'
                  }}
                >
                  <span style={{ width: 14, height: 14, borderRadius: 3, background: normalizeToRGB(gradientStart), border: '1px solid rgba(255,255,255,0.3)' }} />
                  <span style={{ fontSize: 12 }}>Start</span>
                </button>
                <button
                  onClick={() => { setActiveEndpoint('end'); setCustomInput(gradientEnd); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px', borderRadius: 8,
                    border: activeEndpoint === 'end' ? '1px solid rgba(255,255,255,0.5)' : '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255,255,255,0.05)', color: '#fff', cursor: 'pointer'
                  }}
                >
                  <span style={{ width: 14, height: 14, borderRadius: 3, background: normalizeToRGB(gradientEnd), border: '1px solid rgba(255,255,255,0.3)' }} />
                  <span style={{ fontSize: 12 }}>End</span>
                </button>
              </div>
            )}
            {mode !== 'cover-gradient' && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginBottom: 16 }}>
                {allColors.map((color, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      if (mode === "single") {
                        const next = normalizeToRGB(color);
                        setSingleColor((settings.singleColor = next));
                      } else if (mode === "gradient-experimental") {
                        if (activeEndpoint === 'end') {
                          setGradientEnd((settings.gradientEnd = normalizeToRGB(color)));
                        } else {
                          setGradientStart((settings.gradientStart = normalizeToRGB(color)));
                        }
                      }
                      setCustomInput(normalizeToRGB(color));
                      requestApply();
                    }}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      border: "1px solid rgba(255,255,255,0.2)",
                      background: normalizeToRGB(color),
                      cursor: "pointer"
                    }}
                  />
                ))}
              </div>
            )}
            {mode !== 'cover-gradient' && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginBottom: 6 }}>Custom Hex (#RRGGBB)</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="text"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        applyCustomInputColor(customInput, true);
                        addCustomColor();
                      }
                    }}
                    placeholder="#RRGGBB"
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
                      applyCustomInputColor(customInput, false);
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
            )}
            {/* Sliders inside picker based on mode */}
            {mode === 'single' && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, marginBottom: 6 }}>Alpha</div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={singleAlpha}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setSingleAlpha((settings.singleAlpha = value));
                    requestApply();
                  }}
                  style={{ width: '100%' }}
                />
              </div>
            )}

            {mode === 'gradient-experimental' && (
              <div style={{ marginBottom: 16, display: 'grid', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: normalizeToRGB(gradientStart), border: '1px solid rgba(255,255,255,0.3)' }} />
                    <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>Start Alpha</div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={gradientStartAlpha}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setGradientStartAlpha((settings.gradientStartAlpha = value));
                      requestApply();
                    }}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: normalizeToRGB(gradientEnd), border: '1px solid rgba(255,255,255,0.3)' }} />
                    <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>End Alpha</div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={gradientEndAlpha}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setGradientEndAlpha((settings.gradientEndAlpha = value));
                      requestApply();
                    }}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>Angle</div>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{gradientAngle}°</div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    step={1}
                    value={gradientAngle}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setGradientAngle((settings.gradientAngle = value));
                      requestApply();
                    }}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            )}

            {mode === 'cover-gradient' && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>Angle</div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{gradientAngle}°</div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={1}
                  value={gradientAngle}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setGradientAngle((settings.gradientAngle = value));
                    requestApply();
                  }}
                  style={{ width: '100%' }}
                />
              </div>
            )}

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
      <AnySwitch
        title="Exclude Inactive"
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


