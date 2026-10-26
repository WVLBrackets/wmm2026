"use client";

import { Pipette } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";

type EyeDropperConstructor = new () => {
  open: () => Promise<{ sRGBHex: string }>;
};

/**
 * Parse a CSS color string into a `#rrggbb` value for `<input type="color">`.
 * Returns null when the value is not a simple hex the native picker accepts.
 */
export function cssColorToPickerHex(value: string): string | null {
  const v = value.trim();
  const short = /^#([0-9a-fA-F]{3})$/.exec(v);
  if (short) {
    const [r, g, b] = short[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  if (/^#[0-9a-fA-F]{8}$/.test(v)) return `#${v.slice(1, 7)}`.toLowerCase();
  return null;
}

/**
 * Whether the Chromium EyeDropper API is available in this browser.
 */
function eyeDropperSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as Window & { EyeDropper?: EyeDropperConstructor })
      .EyeDropper === "function"
  );
}

/**
 * Shared admin color control: live swatch, hex text, color wheel, eyedropper.
 */
export default function AdminColorField({
  id,
  label,
  value,
  onChange,
  help,
  testId,
  placeholder = "#152c3a",
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  help?: string;
  testId?: string;
  placeholder?: string;
}) {
  const reactId = useId();
  const fieldId = id ?? `ve-color-${reactId}`;
  const swatchTestId = testId ? `${testId}-swatch` : `${fieldId}-swatch`;
  const pickerTestId = testId ? `${testId}-picker` : `${fieldId}-picker`;
  const dropperTestId = testId ? `${testId}-eyedropper` : `${fieldId}-eyedropper`;
  const [dropperError, setDropperError] = useState("");
  const [canEyedrop, setCanEyedrop] = useState(false);

  useEffect(() => {
    setCanEyedrop(eyeDropperSupported());
  }, []);

  const pickerHex = useMemo(
    () => cssColorToPickerHex(value) ?? "#000000",
    [value],
  );
  const previewBackground = value.trim() || "transparent";

  /**
   * Open the system eyedropper and apply the sampled sRGB hex.
   */
  async function pickFromScreen() {
    setDropperError("");
    const Ctor = (window as Window & { EyeDropper?: EyeDropperConstructor })
      .EyeDropper;
    if (!Ctor) {
      setDropperError("Eyedropper is not supported in this browser.");
      return;
    }
    try {
      const result = await new Ctor().open();
      if (result?.sRGBHex) onChange(result.sRGBHex);
    } catch {
      /* User cancelled — ignore. */
    }
  }

  return (
    <label className="ve-field" htmlFor={fieldId}>
      <span>{label}</span>
      {help ? <span className="ve-help">{help}</span> : null}
      <div className="ve-color-row">
        <span
          className="ve-color-preview"
          style={{ background: previewBackground }}
          title={value.trim() || "No color"}
          aria-hidden
          data-testid={testId ? `${testId}-preview` : `${fieldId}-preview`}
        />
        <input
          type="color"
          aria-label={`${label} color wheel`}
          value={pickerHex}
          onChange={(e) => onChange(e.target.value)}
          data-testid={pickerTestId}
        />
        <input
          id={fieldId}
          data-testid={testId ?? fieldId}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          aria-label={`${label} hex or CSS color`}
        />
        {canEyedrop ? (
          <button
            type="button"
            className="ve-color-eyedropper"
            onClick={() => void pickFromScreen()}
            data-testid={dropperTestId}
            title="Sample a color from the screen"
            aria-label={`${label} eyedropper`}
          >
            <Pipette size={14} strokeWidth={2.25} aria-hidden />
          </button>
        ) : null}
      </div>
      {/* Keep a stable hook for tests that looked for *-swatch on type=color */}
      <span className="ve-sr-only" data-testid={swatchTestId}>
        {pickerHex}
      </span>
      {dropperError ? (
        <span className="ve-help" role="status">
          {dropperError}
        </span>
      ) : null}
    </label>
  );
}
